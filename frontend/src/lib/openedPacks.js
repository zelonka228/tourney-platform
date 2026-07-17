// Which team-card packs this browser has already unboxed — pure localStorage,
// no account/backend involved (teams aren't owned by users in this app, see
// the collection page decision). Keyed by team id so it survives renames.
const KEY = "tourneyforge_opened_packs";

function readSet() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

const CHANGE_EVENT = "opened-packs-changed";

export function isPackOpened(teamId) {
  return readSet().has(teamId);
}

export function openedPacksCount(teamIds) {
  const set = readSet();
  return teamIds.filter((id) => set.has(id)).length;
}

export function markPackOpened(teamId) {
  const set = readSet();
  set.add(teamId);
  try {
    localStorage.setItem(KEY, JSON.stringify([...set]));
  } catch {
    // localStorage unavailable (private mode, quota) — just skip persisting,
    // the pack will re-open next time, no functional break.
  }
  // TeamCard components don't share React state with whatever page lists
  // them (e.g. the Collection gallery's progress counter) — a same-tab
  // custom event is the simplest way to tell any listener to re-check.
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

// Subscribes to pack-opened changes; returns an unsubscribe function.
export function onPacksChanged(handler) {
  window.addEventListener(CHANGE_EVENT, handler);
  return () => window.removeEventListener(CHANGE_EVENT, handler);
}
