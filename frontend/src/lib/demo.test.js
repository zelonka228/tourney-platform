import { describe, it, expect } from "vitest";
import {
  winTarget,
  validScorelines,
  isPowerOfTwo,
  seedPositions,
  teamRarity,
  avgRating,
  liveRankFromStats,
  effectivePlayerRank,
  liveNickFromStats,
  effectivePlayerNick,
  winnersRoundCount,
  losersRoundCount,
  lbWinnerDestination,
  loserDestination,
  bracketPlan,
} from "./demo";

describe("winTarget / validScorelines", () => {
  it("BO1 needs 1 win, BO3 needs 2, BO5 needs 3", () => {
    expect(winTarget(1)).toBe(1);
    expect(winTarget(3)).toBe(2);
    expect(winTarget(5)).toBe(3);
  });

  it("lists every valid scoreline for BO3 (2:0, 2:1, 1:2, 0:2)", () => {
    expect(validScorelines(3)).toEqual([
      [2, 0],
      [2, 1],
      [1, 2],
      [0, 2],
    ]);
  });
});

describe("isPowerOfTwo", () => {
  it("accepts 2/4/8/16/32", () => {
    for (const n of [2, 4, 8, 16, 32]) expect(isPowerOfTwo(n)).toBe(true);
  });
  it("rejects non-powers, 1, 0, and negatives", () => {
    for (const n of [1, 0, -4, 3, 5, 6, 7, 9, 12]) expect(isPowerOfTwo(n)).toBe(false);
  });
});

describe("seedPositions", () => {
  // Mirrors backend/src/bracket.js seedOrder() exactly — these three sizes
  // are the ones the project has already hand-verified match the backend.
  it("matches the standard tournament seeding order for 2/4/8", () => {
    expect(seedPositions(2)).toEqual([1, 2]);
    expect(seedPositions(4)).toEqual([1, 4, 2, 3]);
    expect(seedPositions(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
  });
});

describe("bracketPlan", () => {
  it("computes byes up to the next power of two", () => {
    expect(bracketPlan(5)).toEqual({ full: 8, rounds: 3, matches: 7, byes: 3 });
    expect(bracketPlan(4)).toEqual({ full: 4, rounds: 2, matches: 3, byes: 0 });
  });
});

describe("double-elimination bracket math (mirrors backend/src/bracket.js)", () => {
  it("winners/losers round counts for 4 and 8 teams", () => {
    expect(winnersRoundCount(4)).toBe(2);
    expect(losersRoundCount(4)).toBe(2);
    expect(winnersRoundCount(8)).toBe(3);
    expect(losersRoundCount(8)).toBe(4);
  });

  it("routes a winners-bracket round-0 loser into losers round 0", () => {
    expect(loserDestination(4, 0, 0)).toEqual({ round: 0, position: 0 });
    expect(loserDestination(4, 0, 1)).toEqual({ round: 0, position: 0 });
  });

  it("the last losers-bracket round has no winner destination (goes to the grand final instead)", () => {
    expect(lbWinnerDestination(4, losersRoundCount(4) - 1, 0)).toBeNull();
  });
});

describe("teamRarity — the field's own name (best/tournaments) can lie, only the exact best format is trusted", () => {
  it("rarityOverride wins over everything else when set", () => {
    expect(teamRarity({ rarityOverride: "Epic", best: "1/4 фіналу", tournaments: 0 })).toBe(
      "Epic"
    );
  });

  it("Common when best isn't the win-format string, no matter how high tournaments is", () => {
    // Regression: this exact case (Shadow Pact, tournaments=4, best="1/4 фіналу")
    // was a real bug found by the user — tournaments alone used to imply Legendary.
    expect(teamRarity({ best: "1/4 фіналу", tournaments: 9 })).toBe("Common");
    expect(teamRarity({ best: null, tournaments: 9 })).toBe("Common");
  });

  it("Rare/Epic/Legendary scale with tournaments only once best confirms a real win", () => {
    expect(teamRarity({ best: "1 місце ×1", tournaments: 1 })).toBe("Rare");
    expect(teamRarity({ best: "1 місце ×2", tournaments: 2 })).toBe("Epic");
    // Legendary's bar sits at 8, not 3 — 5 and 7 wins are still (a lot of)
    // Epic, only 8+ crosses into Legendary. See the comment on teamRarity.
    expect(teamRarity({ best: "1 місце ×5", tournaments: 5 })).toBe("Epic");
    expect(teamRarity({ best: "1 місце ×7", tournaments: 7 })).toBe("Epic");
    expect(teamRarity({ best: "1 місце ×8", tournaments: 8 })).toBe("Legendary");
  });
});

describe("avgRating", () => {
  it("CS2/Dota (numeric kind): averages and rounds, ignores blank ranks instead of treating them as 0", () => {
    // Regression: Number("") === 0 in JS, which used to silently drag the
    // average down for a player with no rank entered yet.
    const result = avgRating("CS2", [2000, 2200, ""]);
    expect(result.value).toBe(2100);
    expect(result.label).toBe("2100");
  });

  it("returns null/— when every rank is blank or the list is empty", () => {
    expect(avgRating("CS2", ["", "  "]).value).toBeNull();
    expect(avgRating("CS2", []).value).toBeNull();
    expect(avgRating("CS2", []).label).toBe("—");
  });

  it("Valorant (rank kind): averages rank indices and maps back to a rank name", () => {
    // Diamond=5, Immortal=7 -> avg index 6 -> Ascendant
    const result = avgRating("Valorant", ["Diamond", "Immortal"]);
    expect(result.label).toBe("Ascendant");
  });

  it("unrecognized Valorant rank strings fall back to index 0 (Iron), not NaN", () => {
    const result = avgRating("Valorant", ["Unrated", "Iron"]);
    expect(result.value).toBe(0);
    expect(result.label).toBe("Iron");
  });
});

describe("liveRankFromStats / effectivePlayerRank", () => {
  it("CS2 uses eloOrMmr directly", () => {
    expect(liveRankFromStats("CS2", { eloOrMmr: 3200 })).toBe(3200);
  });

  it("Valorant strips a trailing sub-tier number and matches a known rank", () => {
    expect(liveRankFromStats("Valorant", { rank: { label: "Diamond 2" } })).toBe("Diamond");
    expect(liveRankFromStats("Valorant", { rank: { label: "Radiant" } })).toBe("Radiant");
  });

  it("Valorant 'Unrated' (or anything unrecognized) returns null so the manual rank is kept", () => {
    // Regression: this exact bug once let a raw RR number (e.g. 772) leak in
    // as a VALORANT_RANKS array index, silently showing "Iron" instead of
    // the real rank.
    expect(liveRankFromStats("Valorant", { rank: { label: "Unrated" } })).toBeNull();
  });

  it("Dota 2 has no live integration — always null regardless of payload shape", () => {
    expect(liveRankFromStats("Dota 2", { eloOrMmr: 5000 })).toBeNull();
  });

  it("effectivePlayerRank prefers cached live stats over the manual rank, and falls back cleanly on malformed cache", () => {
    const player = { rank: "2000", externalStats: JSON.stringify({ eloOrMmr: 3300 }) };
    expect(effectivePlayerRank("CS2", player)).toBe(3300);

    const brokenCache = { rank: "2000", externalStats: "{not json" };
    expect(effectivePlayerRank("CS2", brokenCache)).toBe("2000");

    const noCache = { rank: "2000" };
    expect(effectivePlayerRank("CS2", noCache)).toBe("2000");
  });
});

describe("liveNickFromStats / effectivePlayerNick", () => {
  it("Valorant nick is trimmed down from the full Riot ID (name#tag) to just the name", () => {
    expect(liveNickFromStats("Valorant", { displayName: "lucio9#masia" })).toBe("lucio9");
  });

  it("CS2 nick is used as-is", () => {
    expect(liveNickFromStats("CS2", { displayName: "s1mple" })).toBe("s1mple");
  });

  it("effectivePlayerNick falls back to the manual nick with no cache or a malformed one", () => {
    expect(effectivePlayerNick("CS2", { nick: "manualNick" })).toBe("manualNick");
    expect(
      effectivePlayerNick("CS2", { nick: "manualNick", externalStats: "not json" })
    ).toBe("manualNick");
  });
});
