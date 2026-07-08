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

async function call(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
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

  // --- Double elimination not yet supported ---
  const doubleTeam = await call("POST", "/api/teams", { name: "Double Team", discipline: "CS2" });
  const doubleAttempt = await call("POST", "/api/tournaments", {
    name: "DoubleCup",
    discipline: "CS2",
    bracketType: "double",
    matchFormat: 1,
    teamIds: [doubleTeam.data.id],
  });
  ok(doubleAttempt.status === 400, "POST /api/tournaments double-elim with teamIds → 400");
  await call("DELETE", `/api/teams/${doubleTeam.data.id}`);

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
