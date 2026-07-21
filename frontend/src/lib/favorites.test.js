import { describe, it, expect, beforeEach, vi } from "vitest";
import { isFavorite, toggleFavorite, getFavoriteIds, onFavoritesChanged } from "./favorites";

beforeEach(() => {
  localStorage.clear();
});

describe("favorites", () => {
  it("a team starts unfavorited", () => {
    expect(isFavorite(1)).toBe(false);
  });

  it("toggling favorites a team and returns the new state", () => {
    const result = toggleFavorite(1);
    expect(result).toBe(true);
    expect(isFavorite(1)).toBe(true);
    expect(isFavorite(2)).toBe(false);
  });

  it("toggling again un-favorites it", () => {
    toggleFavorite(1);
    const result = toggleFavorite(1);
    expect(result).toBe(false);
    expect(isFavorite(1)).toBe(false);
  });

  it("getFavoriteIds reflects the current set", () => {
    toggleFavorite(1);
    toggleFavorite(2);
    expect(getFavoriteIds().sort()).toEqual([1, 2]);
    toggleFavorite(1);
    expect(getFavoriteIds()).toEqual([2]);
  });

  it("survives a fresh read as if the page reloaded", () => {
    toggleFavorite(5);
    expect(isFavorite(5)).toBe(true);
    expect(getFavoriteIds()).toEqual([5]);
  });

  it("dispatches a change event other listeners can react to", () => {
    const handler = vi.fn();
    const unsubscribe = onFavoritesChanged(handler);
    toggleFavorite(7);
    expect(handler).toHaveBeenCalledTimes(1);
    unsubscribe();
    toggleFavorite(7);
    expect(handler).toHaveBeenCalledTimes(1); // not called again after unsubscribe
  });

  it("corrupted localStorage content is treated as no favorites, not a crash", () => {
    localStorage.setItem("tourneyforge_favorite_teams", "{not valid json");
    expect(isFavorite(1)).toBe(false);
    expect(getFavoriteIds()).toEqual([]);
  });
});
