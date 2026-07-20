import { describe, it, expect } from "vitest";
import { validatePassword, passwordStrength } from "./password";

describe("validatePassword", () => {
  it("accepts a password with lower/upper/digit, 8-72 chars, not equal to the username", () => {
    expect(validatePassword("Test1234", "someone")).toEqual({ valid: true, errors: [] });
  });

  it("rejects too short / too long", () => {
    expect(validatePassword("Ab1", "x").valid).toBe(false);
    expect(validatePassword("A".repeat(80) + "b1", "x").valid).toBe(false);
  });

  it("requires at least one lowercase, one uppercase, and one digit", () => {
    expect(validatePassword("alllowercase1", "x").errors).toContain("Хоча б одна велика літера");
    expect(validatePassword("ALLUPPERCASE1", "x").errors).toContain("Хоча б одна мала літера");
    expect(validatePassword("NoDigitsHere", "x").errors).toContain("Хоча б одна цифра");
  });

  it("rejects a password equal to the username, case-insensitively", () => {
    const result = validatePassword("AdminPass1", "AdminPass1");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Не збігається з логіном");
  });
});

describe("passwordStrength", () => {
  it("scores 0 for empty, up to 3 for long+varied", () => {
    expect(passwordStrength("")).toBe(0);
    expect(passwordStrength("Sh0rt!")).toBeLessThan(3);
    expect(passwordStrength("VeryLongPassword123!")).toBe(3);
  });

  it("is capped at 3 even for an extremely strong password", () => {
    expect(passwordStrength("Sup3rDup3rLongPassword!!!###")).toBe(3);
  });
});
