// OpenDota API — free, public, no key required (rate-limited: 60 req/min,
// 50k/month on the free tier). Docs: https://docs.opendota.com/
import { IntegrationError } from "./faceit.js";

const BASE_URL = "https://api.opendota.com/api";
const STEAM64_BASE = 76561197960265728n;

// Dota rank_tier is `medal*10 + star` (e.g. 42 = Archon 2); Immortal (medal 8)
// has no star and uses leaderboard_rank instead.
const MEDALS = [
  null, "Herald", "Guardian", "Crusader", "Archon", "Legend", "Ancient", "Divine", "Immortal",
];

function rankLabel(rankTier, leaderboardRank) {
  if (rankTier == null) return "Приховано";
  const medal = Math.floor(rankTier / 10);
  const star = rankTier % 10;
  if (medal === 8) return leaderboardRank ? `Immortal · #${leaderboardRank}` : "Immortal";
  return `${MEDALS[medal] ?? "?"} ${star}`;
}

// Accepts a Steam profile URL (numeric /profiles/<steamid64> form only —
// vanity /id/<name> URLs need a separate Steam Web API lookup we don't do
// here) or a raw OpenDota account_id.
export function parseSteamRef(raw) {
  const trimmed = raw.trim();
  const profileMatch = trimmed.match(/steamcommunity\.com\/profiles\/(\d{17})/);
  if (profileMatch) {
    return Number(BigInt(profileMatch[1]) - STEAM64_BASE);
  }
  if (/steamcommunity\.com\/id\//.test(trimmed)) {
    throw new IntegrationError(
      400,
      "Посилання на профіль з ім'ям (vanity URL) не підтримується — потрібне посилання виду steamcommunity.com/profiles/<цифри>."
    );
  }
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  throw new IntegrationError(400, "Невалідне посилання на Steam-профіль.");
}

async function call(path) {
  const res = await fetch(`${BASE_URL}${path}`, { headers: { "User-Agent": "TourneyForge/1.0" } });
  if (res.status === 404) throw new IntegrationError(404, "Гравця не знайдено на OpenDota.");
  if (!res.ok) throw new IntegrationError(502, `OpenDota API повернув помилку ${res.status}.`);
  return res.json();
}

export async function fetchOpenDotaStats(rawRef) {
  const accountId = parseSteamRef(rawRef);
  const [profile, wl, recent] = await Promise.all([
    call(`/players/${accountId}`),
    call(`/players/${accountId}/wl`),
    call(`/players/${accountId}/recentMatches`),
  ]);
  if (!profile?.profile) {
    throw new IntegrationError(404, "Гравця не знайдено на OpenDota (можливо, приватна статистика).");
  }

  const sample = recent.slice(0, 20);
  const kd = sample.length
    ? (() => {
        const kills = sample.reduce((s, m) => s + m.kills, 0);
        const deaths = sample.reduce((s, m) => s + m.deaths, 0) || 1;
        return kills / deaths;
      })()
    : null;

  // Win streak: walk recent matches newest-first, count consecutive wins.
  let winStreak = 0;
  for (const m of recent) {
    const won = m.player_slot < 128 ? m.radiant_win : !m.radiant_win;
    if (!won) break;
    winStreak++;
  }

  return {
    provider: "opendota",
    displayName: profile.profile.personaname ?? null,
    avatar: profile.profile.avatarfull ?? null,
    profileUrl: profile.profile.profileurl ?? null,
    rank: { label: rankLabel(profile.rank_tier, profile.leaderboard_rank), value: profile.rank_tier ?? null },
    eloOrMmr: null, // Valve has hidden numeric MMR since 2018; only the medal tier above is public.
    stats: {
      kd,
      hsPercent: null, // not a Dota concept
      winratePercent: wl.win + wl.lose > 0 ? (100 * wl.win) / (wl.win + wl.lose) : null,
      wins: wl.win,
      losses: wl.lose,
      matches: wl.win + wl.lose,
      winStreak,
    },
  };
}
