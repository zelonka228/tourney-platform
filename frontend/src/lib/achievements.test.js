import { describe, it, expect } from "vitest";
import { computeAchievements } from "./achievements";

function badge(team, matches, teamsById, key) {
  return computeAchievements(team, matches, teamsById).find((b) => b.key === key).earned;
}

describe("achievements: champion", () => {
  it("earned once the team has ever won a tournament", () => {
    const team = { best: "1 місце ×1", tournaments: 1 };
    expect(badge(team, [], {}, "champion")).toBe(true);
  });

  it("not earned for a team that never won (best is a placement string, not a win)", () => {
    const team = { best: "1/4 фіналу", tournaments: 4 };
    expect(badge(team, [], {}, "champion")).toBe(false);
  });

  it("not earned for a brand-new team with no results yet", () => {
    const team = { best: null, tournaments: 0 };
    expect(badge(team, [], {}, "champion")).toBe(false);
  });
});

describe("achievements: undefeated", () => {
  const team = { best: null, tournaments: 0 };

  it("not earned with zero recorded matches (nothing to be undefeated in)", () => {
    expect(badge(team, [], {}, "undefeated")).toBe(false);
  });

  it("earned when every recorded match was a win", () => {
    const matches = [{ won: true }, { won: true }];
    expect(badge(team, matches, {}, "undefeated")).toBe(true);
  });

  it("not earned as soon as a single loss is recorded", () => {
    const matches = [{ won: true }, { won: false }];
    expect(badge(team, matches, {}, "undefeated")).toBe(false);
  });
});

describe("achievements: giantSlayer", () => {
  it("earned after beating a team of strictly higher rarity", () => {
    const team = { best: null, tournaments: 0 }; // Common
    const opponent = { best: "1 місце ×3", tournaments: 3 }; // Legendary
    const teamsById = { 99: opponent };
    const matches = [{ won: true, opponentId: 99 }];
    expect(badge(team, matches, teamsById, "giantSlayer")).toBe(true);
  });

  it("not earned when the win was against an equal-or-lower rarity team", () => {
    const team = { best: "1 місце ×3", tournaments: 3 }; // Legendary
    const opponent = { best: null, tournaments: 0 }; // Common
    const teamsById = { 99: opponent };
    const matches = [{ won: true, opponentId: 99 }];
    expect(badge(team, matches, teamsById, "giantSlayer")).toBe(false);
  });

  it("not earned on a loss even against a higher-rarity team", () => {
    const team = { best: null, tournaments: 0 };
    const opponent = { best: "1 місце ×3", tournaments: 3 };
    const teamsById = { 99: opponent };
    const matches = [{ won: false, opponentId: 99 }];
    expect(badge(team, matches, teamsById, "giantSlayer")).toBe(false);
  });

  it("not earned on a bye (no opponent) or a deleted opponent missing from teamsById", () => {
    const team = { best: null, tournaments: 0 };
    const matches = [
      { won: true, opponentId: null },
      { won: true, opponentId: 404 }, // not present in teamsById
    ];
    expect(badge(team, matches, {}, "giantSlayer")).toBe(false);
  });
});
