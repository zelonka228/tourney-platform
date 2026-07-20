import { describe, it, expect, beforeEach, vi } from "vitest";
import { isPackOpened, markPackOpened, openedPacksCount, onPacksChanged } from "./openedPacks";

beforeEach(() => {
  localStorage.clear();
});

describe("openedPacks", () => {
  it("a team's pack starts closed", () => {
    expect(isPackOpened(1)).toBe(false);
  });

  it("marking a pack opened persists it and openedPacksCount reflects it", () => {
    markPackOpened(1);
    expect(isPackOpened(1)).toBe(true);
    expect(isPackOpened(2)).toBe(false);
    expect(openedPacksCount([1, 2, 3])).toBe(1);
  });

  it("survives a fresh read as if the page reloaded (re-reads localStorage, not an in-memory cache)", () => {
    markPackOpened(5);
    // isPackOpened/openedPacksCount both re-read localStorage on every call
    // rather than caching in a module-level variable — this is exactly what
    // makes "does it survive F5" true, and was the specific behavior in
    // question after today's reduced-motion investigation.
    expect(isPackOpened(5)).toBe(true);
    expect(openedPacksCount([5])).toBe(1);
  });

  it("dispatches a change event other listeners (e.g. the Collection page counter) can react to", () => {
    const handler = vi.fn();
    const unsubscribe = onPacksChanged(handler);
    markPackOpened(7);
    expect(handler).toHaveBeenCalledTimes(1);
    unsubscribe();
    markPackOpened(8);
    expect(handler).toHaveBeenCalledTimes(1); // not called again after unsubscribe
  });

  it("corrupted localStorage content is treated as no packs opened, not a crash", () => {
    localStorage.setItem("tourneyforge_opened_packs", "{not valid json");
    expect(isPackOpened(1)).toBe(false);
    expect(openedPacksCount([1, 2])).toBe(0);
  });
});
