// Smoke test for the REST API. Requires the backend running (npm run start).
// Exercises the happy path (teams + tournaments CRUD, registration) and the
// error contract (400/404/409). Cleans up everything it creates.
//
//   Terminal 1: npm run start
//   Terminal 2: npm test
//
// Uses Node's global fetch (Node 18+). No dependencies.

const BASE = process.env.API_URL ?? "http://localhost:4000";

let passed = 0;
let failed = 0;

function ok(cond, label) {
  if (cond) {
    passed++;
    console.log(`  ok   ${label}`);
  } else {
    failed++;
    console.error(`  FAIL ${label}`);
  }
}

let authToken = null;

async function call(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  let data = null;
  if (res.status !== 204) {
    try {
      data = await res.json();
    } catch {
      data = null;
    }
  }
  return { status: res.status, data };
}

async function main() {
  console.log(`Testing API at ${BASE}\n`);

  // Health
  const health = await call("GET", "/api/health");
  ok(health.status === 200 && health.data?.ok === true, "GET /api/health → 200 {ok:true}");

  // Auth: mutating routes require an admin token (see backend/src/auth.js).
  const login = await call("POST", "/api/auth/login", { username: "Admin", password: "admin" });
  ok(login.status === 200 && login.data?.token, "POST /api/auth/login (Admin) → 200 with token");
  authToken = login.data?.token;

  const badLogin = await call("POST", "/api/auth/login", { username: "Admin", password: "wrong" });
  ok(badLogin.status === 401, "POST /api/auth/login with bad password → 401");

  const unauthed = authToken;
  authToken = null;
  const blocked = await call("POST", "/api/teams", { name: "ShouldBeBlocked", discipline: "CS2" });
  ok(blocked.status === 401, "POST /api/teams without a token → 401");
  authToken = unauthed;

  // --- Teams: happy path ---
  const created = await call("POST", "/api/teams", {
    name: "QA Squad",
    discipline: "CS2",
    players: [{ nick: "tester", role: "IGL", rank: "2000" }],
  });
  ok(created.status === 201 && created.data?.id, "POST /api/teams → 201 with id");
  const teamId = created.data?.id;

  const got = await call("GET", `/api/teams/${teamId}`);
  ok(got.status === 200 && got.data?.players?.length === 1, "GET /api/teams/:id → 200 with players");

  const rating = await call("GET", `/api/teams/${teamId}/rating`);
  ok(
    rating.status === 200 && rating.data?.unit === "FACEIT ELO" && rating.data?.value === 2000,
    "GET /api/teams/:id/rating → 200 with computed value"
  );

  const updated = await call("PUT", `/api/teams/${teamId}`, { name: "QA Squad v2" });
  ok(updated.status === 200 && updated.data?.name === "QA Squad v2", "PUT /api/teams/:id → 200 updated");

  // --- Teams: error contract ---
  const missing = await call("POST", "/api/teams", { discipline: "CS2" });
  ok(missing.status === 400, "POST /api/teams without name → 400");

  const badDiscipline = await call("POST", "/api/teams", { name: "X", discipline: "LoL" });
  ok(badDiscipline.status === 400, "POST /api/teams with bad discipline → 400");

  const notThere = await call("GET", "/api/teams/999999");
  ok(notThere.status === 404, "GET /api/teams/:id (missing) → 404");

  const dupeTeam = await call("POST", "/api/teams", {
    name: "QA Squad v2",
    discipline: "CS2",
  });
  ok(dupeTeam.status === 409, "POST /api/teams with duplicate name → 409");

  // --- Tournaments: happy path ---
  const tour = await call("POST", "/api/tournaments", {
    name: "QA Cup",
    discipline: "CS2",
    bracketType: "single",
    matchFormat: 3,
  });
  ok(tour.status === 201 && tour.data?.id, "POST /api/tournaments → 201 with id");
  const tourId = tour.data?.id;

  const reg = await call("POST", `/api/tournaments/${tourId}/register`, { teamId });
  ok(reg.status === 201, "POST /api/tournaments/:id/register → 201");

  const dupe = await call("POST", `/api/tournaments/${tourId}/register`, { teamId });
  ok(dupe.status === 409, "duplicate register → 409");

  const regGhost = await call("POST", `/api/tournaments/${tourId}/register`, { teamId: 999999 });
  ok(regGhost.status === 404, "register missing team → 404");

  const putTour = await call("PUT", `/api/tournaments/${tourId}`, { status: "active" });
  ok(putTour.status === 200 && putTour.data?.status === "active", "PUT /api/tournaments/:id → 200 updated");

  const badFormat = await call("POST", "/api/tournaments", {
    name: "Bad",
    discipline: "CS2",
    bracketType: "single",
    matchFormat: 2,
  });
  ok(badFormat.status === 400, "POST /api/tournaments with bad matchFormat → 400");

  // --- Bracket generation + scoring: 4 teams, power of 2, no byes ---
  const bracketTeamIds = [teamId];
  for (let i = 0; i < 3; i++) {
    const t = await call("POST", "/api/teams", { name: `Bracket Team ${i}`, discipline: "CS2" });
    bracketTeamIds.push(t.data.id);
  }

  const b4 = await call("POST", "/api/tournaments", {
    name: "Bracket4",
    discipline: "CS2",
    bracketType: "single",
    matchFormat: 1,
    teamIds: bracketTeamIds,
  });
  ok(
    b4.status === 201 && b4.data?.matches?.length === 3,
    "POST /api/tournaments with 4 teamIds → 3 matches (no byes)"
  );
  const b4Id = b4.data?.id;
  const round0 = b4.data.matches.filter((m) => m.round === 0).sort((a, c) => a.position - c.position);
  const final4 = b4.data.matches.find((m) => m.round === 1);

  const scoreM0 = await call("PUT", `/api/matches/${round0[0].id}/score`, { scoreA: 1, scoreB: 0 });
  ok(scoreM0.status === 200 && scoreM0.data?.match?.status === "done", "PUT /api/matches/:id/score → 200 done");
  ok(scoreM0.data?.advanced != null, "score of round0 match0 → advances winner to final");

  const badScore = await call("PUT", `/api/matches/${round0[1].id}/score`, { scoreA: 3, scoreB: 1 });
  ok(badScore.status === 400, "PUT /api/matches/:id/score with score invalid for BO1 → 400");

  const scoreM1 = await call("PUT", `/api/matches/${round0[1].id}/score`, { scoreA: 1, scoreB: 0 });
  ok(scoreM1.status === 200, "PUT /api/matches/:id/score round0 match1 → 200");

  const reScore = await call("PUT", `/api/matches/${round0[1].id}/score`, { scoreA: 1, scoreB: 0 });
  ok(reScore.status === 409, "re-submitting a finished match's score → 409");

  const scoreFinal = await call("PUT", `/api/matches/${final4.id}/score`, { scoreA: 1, scoreB: 0 });
  ok(
    scoreFinal.status === 200 && scoreFinal.data?.champion != null,
    "PUT /api/matches/:id/score on final → 200 with champion"
  );

  const champTeam = await call("GET", `/api/teams/${bracketTeamIds[0]}`);
  ok(
    champTeam.data?.tournaments === 1 && champTeam.data?.best === "1 місце ×1",
    "champion team gets tournaments incremented and best set"
  );

  const undecided = await call("PUT", `/api/matches/${final4.id}/score`, { scoreA: 1, scoreB: 0 });
  ok(undecided.status === 409, "submitting score to an already-completed final → 409");

  await call("DELETE", `/api/tournaments/${b4Id}`);
  for (const id of bracketTeamIds.slice(1)) await call("DELETE", `/api/teams/${id}`);

  // --- Bracket generation: 3 teams → one bye that auto-advances ---
  const byeTeamIds = [];
  for (let i = 0; i < 3; i++) {
    const t = await call("POST", "/api/teams", { name: `Bye Team ${i}`, discipline: "CS2" });
    byeTeamIds.push(t.data.id);
  }
  const b3 = await call("POST", "/api/tournaments", {
    name: "Bracket3",
    discipline: "CS2",
    bracketType: "single",
    matchFormat: 1,
    teamIds: byeTeamIds,
  });
  ok(b3.status === 201 && b3.data?.matches?.length === 3, "3 teams → 3 matches (1 bye + 1 real + final)");
  const byeMatch = b3.data.matches.find(
    (m) => m.round === 0 && (m.teamAId == null) !== (m.teamBId == null)
  );
  ok(byeMatch?.status === "bye", "bye match auto-resolved to status 'bye'");
  const b3Final = b3.data.matches.find((m) => m.round === 1);
  ok(
    b3Final?.teamAId === byeTeamIds[0] || b3Final?.teamBId === byeTeamIds[0],
    "bye team auto-advanced into the final slot"
  );
  const noOpponent = await call("PUT", `/api/matches/${byeMatch.id}/score`, { scoreA: 1, scoreB: 0 });
  ok(noOpponent.status === 400, "submitting a score to a bye match → 400");

  await call("DELETE", `/api/tournaments/${b3.data.id}`);
  for (const id of byeTeamIds) await call("DELETE", `/api/teams/${id}`);

  // --- Double elimination: only power-of-two team counts are supported ---
  const doubleTeam = await call("POST", "/api/teams", { name: "Double Team", discipline: "CS2" });
  const doubleAttempt = await call("POST", "/api/tournaments", {
    name: "DoubleCup",
    discipline: "CS2",
    bracketType: "double",
    matchFormat: 1,
    teamIds: [doubleTeam.data.id],
  });
  ok(doubleAttempt.status === 400, "POST /api/tournaments double-elim with 1 team (not pow2) → 400");
  await call("DELETE", `/api/teams/${doubleTeam.data.id}`);

  // --- Double elimination: 4 teams, full run without a bracket reset ---
  // (the WB champion wins the grand final outright).
  function matchAt(matches, bracket, round, position) {
    return matches.find((m) => m.bracket === bracket && m.round === round && m.position === position);
  }

  {
    const teamIds = [];
    for (let i = 0; i < 4; i++) {
      const t = await call("POST", "/api/teams", { name: `DE Team ${i}`, discipline: "CS2" });
      teamIds.push(t.data.id);
    }
    const de = await call("POST", "/api/tournaments", {
      name: "DE4",
      discipline: "CS2",
      bracketType: "double",
      matchFormat: 1,
      teamIds,
    });
    ok(
      de.status === 201 && de.data?.matches?.length === 7,
      "POST /api/tournaments double-elim, 4 teams → 201, 7 matches (3 WB + 2 LB + 2 final)"
    );
    const deId = de.data.id;
    const m = de.data.matches;

    const wb0a = matchAt(m, "winners", 0, 0);
    const wb0b = matchAt(m, "winners", 0, 1);
    ok(
      matchAt(m, "final", 1, 0)?.status === "pending-unused",
      "grand-final reset match starts as 'pending-unused'"
    );

    const r1 = await call("PUT", `/api/matches/${wb0a.id}/score`, { scoreA: 1, scoreB: 0 });
    ok(
      r1.status === 200 && r1.data.advancedLoser != null,
      "double-elim: WB round0 match win → loser routed into losers bracket"
    );
    const wb0aLoser = wb0a.teamBId;
    ok(
      r1.data.advancedLoser.teamAId === wb0aLoser || r1.data.advancedLoser.teamBId === wb0aLoser,
      "the actual loser team landed in the losers-bracket slot"
    );

    const r2 = await call("PUT", `/api/matches/${wb0b.id}/score`, { scoreA: 1, scoreB: 0 });
    ok(r2.status === 200 && r2.data.advancedLoser != null, "double-elim: WB round0 match1 win → loser routed too");

    // Losers-bracket round 0 should now have both round-0 losers seated.
    const afterWb0 = await call("GET", `/api/tournaments/${deId}`);
    const lb0 = matchAt(afterWb0.data.matches, "losers", 0, 0);
    ok(lb0.teamAId != null && lb0.teamBId != null, "losers-bracket round0 match got both WB round0 losers");

    const lbWinner = lb0.teamAId;
    const rLb0 = await call("PUT", `/api/matches/${lb0.id}/score`, { scoreA: 1, scoreB: 0 });
    ok(rLb0.status === 200 && rLb0.data.advanced != null, "losers-bracket round0 win → advances within LB");

    const wbFinal = matchAt(afterWb0.data.matches, "winners", 1, 0);
    const rWbFinal = await call("PUT", `/api/matches/${wbFinal.id}/score`, { scoreA: 1, scoreB: 0 });
    const wbChampion = rWbFinal.data.match.scoreA > rWbFinal.data.match.scoreB ? wbFinal.teamAId : wbFinal.teamBId;
    ok(
      rWbFinal.status === 200 && rWbFinal.data.advanced?.bracket === "final" && rWbFinal.data.advanced?.round === 0,
      "WB final win → advances into the grand final (round 0), not a nonexistent WB round 2"
    );
    ok(
      rWbFinal.data.advancedLoser != null,
      "WB final loser also drops into the losers bracket's last round"
    );

    const afterWbFinal = await call("GET", `/api/tournaments/${deId}`);
    const lb1 = matchAt(afterWbFinal.data.matches, "losers", 1, 0);
    ok(lb1.teamAId === lbWinner && lb1.teamBId != null, "losers-bracket last round has LB survivor + WB final loser");

    const rLb1 = await call("PUT", `/api/matches/${lb1.id}/score`, { scoreA: 1, scoreB: 0 });
    ok(
      rLb1.status === 200 && rLb1.data.advanced?.bracket === "final" && rLb1.data.advanced?.round === 0,
      "losers-bracket champion advances into the grand final's teamB slot"
    );

    const afterLbFinal = await call("GET", `/api/tournaments/${deId}`);
    const gf0 = matchAt(afterLbFinal.data.matches, "final", 0, 0);
    ok(
      gf0.teamAId === wbChampion && gf0.teamBId != null,
      "grand final round0 has the WB champion (teamA) and the LB champion (teamB)"
    );

    // WB champion (teamA) wins the grand final outright → tournament done,
    // the reset match (round 1) is never activated.
    const rGf = await call("PUT", `/api/matches/${gf0.id}/score`, { scoreA: 1, scoreB: 0 });
    ok(
      rGf.status === 200 && rGf.data.champion === wbChampion && rGf.data.advanced == null,
      "grand final won by the WB champion → tournament decided, no reset match needed"
    );
    const doneCheck = await call("GET", `/api/tournaments/${deId}`);
    ok(doneCheck.data.status === "completed", "tournament status → completed after grand final");
    ok(
      matchAt(doneCheck.data.matches, "final", 1, 0)?.status === "pending-unused",
      "reset match stayed 'pending-unused' — never needed"
    );

    await call("DELETE", `/api/tournaments/${deId}`);
    for (const id of teamIds) await call("DELETE", `/api/teams/${id}`);
  }

  // --- Double elimination: 4 teams, the LB finalist forces a bracket reset ---
  {
    const teamIds = [];
    for (let i = 0; i < 4; i++) {
      const t = await call("POST", "/api/teams", { name: `DE Reset Team ${i}`, discipline: "CS2" });
      teamIds.push(t.data.id);
    }
    const de = await call("POST", "/api/tournaments", {
      name: "DE4Reset",
      discipline: "CS2",
      bracketType: "double",
      matchFormat: 1,
      teamIds,
    });
    const deId = de.data.id;
    const m = de.data.matches;
    const wb0a = matchAt(m, "winners", 0, 0);
    const wb0b = matchAt(m, "winners", 0, 1);

    await call("PUT", `/api/matches/${wb0a.id}/score`, { scoreA: 1, scoreB: 0 });
    await call("PUT", `/api/matches/${wb0b.id}/score`, { scoreA: 1, scoreB: 0 });
    let cur = await call("GET", `/api/tournaments/${deId}`);
    const lb0 = matchAt(cur.data.matches, "losers", 0, 0);
    await call("PUT", `/api/matches/${lb0.id}/score`, { scoreA: 1, scoreB: 0 });
    const wbFinal = matchAt(cur.data.matches, "winners", 1, 0);
    const rWbFinal = await call("PUT", `/api/matches/${wbFinal.id}/score`, { scoreA: 1, scoreB: 0 });
    const wbChampion = rWbFinal.data.match.scoreA > rWbFinal.data.match.scoreB ? wbFinal.teamAId : wbFinal.teamBId;
    cur = await call("GET", `/api/tournaments/${deId}`);
    const lb1 = matchAt(cur.data.matches, "losers", 1, 0);
    const rLb1 = await call("PUT", `/api/matches/${lb1.id}/score`, { scoreA: 1, scoreB: 0 });
    const lbChampion = rLb1.data.match.scoreA > rLb1.data.match.scoreB ? lb1.teamAId : lb1.teamBId;
    ok(lbChampion !== wbChampion, "sanity: WB and LB champions are different teams");

    cur = await call("GET", `/api/tournaments/${deId}`);
    const gf0 = matchAt(cur.data.matches, "final", 0, 0);
    ok(gf0.teamAId === wbChampion && gf0.teamBId === lbChampion, "grand final seated as expected");

    // LB champion (teamB) wins round 0 → reset match activates instead of
    // the tournament completing.
    const rGf0 = await call("PUT", `/api/matches/${gf0.id}/score`, { scoreA: 0, scoreB: 1 });
    ok(
      rGf0.status === 200 &&
        rGf0.data.champion == null &&
        rGf0.data.advanced?.bracket === "final" &&
        rGf0.data.advanced?.round === 1,
      "LB champion wins grand-final round0 → bracket-reset match activates, tournament not yet decided"
    );
    ok(
      rGf0.data.advanced.teamAId === wbChampion && rGf0.data.advanced.teamBId === lbChampion,
      "reset match seated with the same two teams"
    );
    const notDoneYet = await call("GET", `/api/tournaments/${deId}`);
    ok(notDoneYet.data.status !== "completed", "tournament not completed yet — reset match still pending");

    const gf1 = matchAt(notDoneYet.data.matches, "final", 1, 0);
    const rGf1 = await call("PUT", `/api/matches/${gf1.id}/score`, { scoreA: 1, scoreB: 0 });
    ok(
      rGf1.status === 200 && rGf1.data.champion === wbChampion && rGf1.data.advanced == null,
      "reset match decides the tournament (WB champion wins the second match)"
    );
    const finallyDone = await call("GET", `/api/tournaments/${deId}`);
    ok(finallyDone.data.status === "completed", "tournament status → completed after the reset match");

    await call("DELETE", `/api/tournaments/${deId}`);
    for (const id of teamIds) await call("DELETE", `/api/teams/${id}`);
  }

  // --- Double elimination: resetting a WB match also un-drops its loser ---
  {
    const teamIds = [];
    for (let i = 0; i < 4; i++) {
      const t = await call("POST", "/api/teams", { name: `DE Undo Team ${i}`, discipline: "CS2" });
      teamIds.push(t.data.id);
    }
    const de = await call("POST", "/api/tournaments", {
      name: "DE4Undo",
      discipline: "CS2",
      bracketType: "double",
      matchFormat: 1,
      teamIds,
    });
    const deId = de.data.id;
    const wb0a = matchAt(de.data.matches, "winners", 0, 0);

    const played = await call("PUT", `/api/matches/${wb0a.id}/score`, { scoreA: 1, scoreB: 0 });
    const lb0Id = played.data.advancedLoser.id;

    const resetResult = await call("POST", `/api/matches/${wb0a.id}/reset`);
    ok(
      resetResult.status === 200 && resetResult.data.match.status === "pending",
      "resetting a WB match → 200, match back to pending"
    );
    ok(
      resetResult.data.loserMatch?.id === lb0Id &&
        resetResult.data.loserMatch.teamAId == null &&
        resetResult.data.loserMatch.teamBId == null,
      "resetting a WB match also clears the losers-bracket slot the loser had dropped into"
    );

    // Play it again, then also finish the losers-bracket match it feeds —
    // now resetting the WB match should be BLOCKED, since the loser already
    // played on in the losers bracket.
    await call("PUT", `/api/matches/${wb0a.id}/score`, { scoreA: 1, scoreB: 0 });
    const wb0b = de.data.matches.find((m2) => m2.bracket === "winners" && m2.round === 0 && m2.position === 1);
    await call("PUT", `/api/matches/${wb0b.id}/score`, { scoreA: 1, scoreB: 0 });
    const afterBoth = await call("GET", `/api/tournaments/${deId}`);
    const lb0 = matchAt(afterBoth.data.matches, "losers", 0, 0);
    await call("PUT", `/api/matches/${lb0.id}/score`, { scoreA: 1, scoreB: 0 });

    const blockedReset = await call("POST", `/api/matches/${wb0a.id}/reset`);
    ok(
      blockedReset.status === 409,
      "resetting a WB match is blocked once its loser already played on in the losers bracket"
    );

    await call("DELETE", `/api/tournaments/${deId}`);
    for (const id of teamIds) await call("DELETE", `/api/teams/${id}`);
  }

  // --- Cleanup ---
  const delTour = await call("DELETE", `/api/tournaments/${tourId}`);
  ok(delTour.status === 204, "DELETE /api/tournaments/:id → 204");

  const delTeam = await call("DELETE", `/api/teams/${teamId}`);
  ok(delTeam.status === 204, "DELETE /api/teams/:id → 204");

  const delAgain = await call("DELETE", `/api/teams/${teamId}`);
  ok(delAgain.status === 404, "DELETE already-deleted team → 404");

  // --- Unknown route ---
  const unknown = await call("GET", "/api/nope");
  ok(unknown.status === 404, "GET unknown route → 404");

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("\nTest run crashed (is the backend running on " + BASE + "?):");
  console.error(e.message);
  process.exit(1);
});
