// Which teams this browser has starred — pure localStorage, same convention
// as lib/openedPacks.js (teams aren't owned by accounts in this app, so
// there's no natural backend home for a per-user favorites list; a per-
// browser one is honest about what it actually is).
const KEY = "tourneyforge_favorite_teams";

function readSet() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function writeSet(set) {
  try {
    localStorage.setItem(KEY, JSON.stringify([...set]));
  } catch {
    // localStorage unavailable (private mode, quota) — favorite just won't
    // persist this session, no functional break.
  }
}

const CHANGE_EVENT = "favorite-teams-changed";

export function isFavorite(teamId) {
  return readSet().has(teamId);
}

export function getFavoriteIds() {
  return [...readSet()];
}

// Returns the new state (true = now favorited) so callers can update local
// UI state without a second isFavorite() read.
export function toggleFavorite(teamId) {
  const set = readSet();
  const next = !set.has(teamId);
  if (next) set.add(teamId);
  else set.delete(teamId);
  writeSet(set);
  window.dispatchEvent(new Event(CHANGE_EVENT));
  return next;
}

// Subscribes to favorites changes; returns an unsubscribe function. Same
// same-tab-only caveat as onPacksChanged — a custom event, not the
// cross-tab `storage` event, since every consumer here lives in one tab.
export function onFavoritesChanged(handler) {
  window.addEventListener(CHANGE_EVENT, handler);
  return () => window.removeEventListener(CHANGE_EVENT, handler);
}
