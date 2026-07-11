// FACEIT Data API v4 — official, requires a free API key from
// developers.faceit.com (App Studio → create app → "Server-side" API key).
// Set FACEIT_API_KEY in backend/.env. Docs: https://docs.faceit.com/docs/data-api/
const BASE_URL = "https://open.faceit.com/data/v4";

export class IntegrationError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Accepts a raw nickname or a profile URL like
// https://www.faceit.com/en/players/NICKNAME[/stats/cs2].
export function parseFaceitRef(raw) {
  const trimmed = raw.trim();
  const match = trimmed.match(/faceit\.com\/[a-z-]+\/players\/([^/?#]+)/i);
  return decodeURIComponent(match ? match[1] : trimmed);
}

async function call(path) {
  const key = process.env.FACEIT_API_KEY;
  if (!key) {
    throw new IntegrationError(503, "FACEIT_API_KEY не налаштовано на сервері.");
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (res.status === 404) throw new IntegrationError(404, "Гравця не знайдено на FACEIT.");
  if (!res.ok) throw new IntegrationError(502, `FACEIT API повернув помилку ${res.status}.`);
  return res.json();
}

// Lifetime stat values in the FACEIT API are all strings, keyed by
// human-readable labels (confirmed via community-documented responses —
// the OpenAPI spec types `lifetime` as a free-form map).
function toNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function fetchFaceitStats(rawRef) {
  const nickname = parseFaceitRef(rawRef);
  const player = await call(`/players?nickname=${encodeURIComponent(nickname)}`);
  const game = player.games?.cs2 ?? player.games?.csgo;
  if (!game) {
    throw new IntegrationError(404, "У гравця немає прив'язаного CS2/CS:GO акаунту на FACEIT.");
  }

  let lifetime = {};
  try {
    const stats = await call(`/players/${player.player_id}/stats/${player.games?.cs2 ? "cs2" : "csgo"}`);
    lifetime = stats.lifetime ?? {};
  } catch {
    // Stats endpoint can 404 for players with zero matches — elo/level still shown.
  }

  const matches = toNumber(lifetime["Matches"]);
  const wins = toNumber(lifetime["Wins"]);

  return {
    provider: "faceit",
    displayName: player.nickname,
    avatar: player.avatar || null,
    profileUrl: player.faceit_url ? player.faceit_url.replace("{lang}", "en") : null,
    rank: { label: `Level ${game.skill_level ?? "—"}`, value: game.skill_level ?? null },
    eloOrMmr: game.faceit_elo ?? null,
    stats: {
      kd: toNumber(lifetime["Average K/D Ratio"]),
      hsPercent: toNumber(lifetime["Average Headshots %"]),
      winratePercent: toNumber(lifetime["Win Rate %"]),
      wins,
      losses: matches != null && wins != null ? matches - wins : null,
      matches,
      winStreak: toNumber(lifetime["Current Win Streak"]),
    },
  };
}
