// HenrikDev unofficial Valorant API — NOT official/guaranteed, requires a
// free key obtained via their Discord (see docs.henrikdev.xyz/general/auth).
// Set VALORANT_API_KEY in backend/.env. There is no Riot-sanctioned public
// API for third-party rank lookups, so this integration can break or get
// rate-limited without warning — accepted tradeoff, see project notes.
import { IntegrationError } from "./faceit.js";

const BASE_URL = "https://api.henrikdev.xyz";
const REGIONS = ["eu", "na", "ap", "kr", "latam", "br"];

// Accepts "Name#Tag" directly, or a tracker.gg profile URL
// (tracker.gg/valorant/profile/riot/Name%23Tag/overview).
export function parseValorantRef(raw) {
  const trimmed = decodeURIComponent(raw.trim());
  const trackerMatch = trimmed.match(/tracker\.gg\/valorant\/profile\/riot\/([^/?#]+)/);
  const idPart = trackerMatch ? decodeURIComponent(trackerMatch[1]) : trimmed;
  const hashIdx = idPart.lastIndexOf("#");
  if (hashIdx <= 0 || hashIdx === idPart.length - 1) {
    throw new IntegrationError(400, "Riot ID має бути у форматі Ім'я#Тег.");
  }
  return { name: idPart.slice(0, hashIdx), tag: idPart.slice(hashIdx + 1) };
}

async function call(path) {
  const key = process.env.VALORANT_API_KEY;
  if (!key) {
    throw new IntegrationError(503, "VALORANT_API_KEY не налаштовано на сервері.");
  }
  const res = await fetch(`${BASE_URL}${path}`, { headers: { Authorization: key } });
  if (res.status === 404) throw new IntegrationError(404, "Гравця не знайдено (перевірте Riot ID та регіон).");
  if (res.status === 401) throw new IntegrationError(503, "Невалідний VALORANT_API_KEY.");
  if (!res.ok) throw new IntegrationError(502, `Valorant API повернув помилку ${res.status}.`);
  return res.json();
}

// region isn't user-supplied in this project (players only pick a Riot ID),
// so we probe the regions in order and use whichever answers first.
async function fetchMmrAnyRegion(name, tag) {
  let lastErr;
  for (const region of REGIONS) {
    try {
      return await call(`/valorant/v3/mmr/${region}/pc/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`);
    } catch (err) {
      lastErr = err;
      if (err.status && err.status !== 404) throw err; // real failure (503/502) — stop probing
    }
  }
  throw lastErr;
}

export async function fetchValorantStats(rawRef) {
  const { name, tag } = parseValorantRef(rawRef);
  // Riot's API has no face photo for Valorant — `card.small` is the player
  // card art, which is what trackers show in place of an avatar. Best-effort:
  // a failure here (rate limit, transient error) shouldn't sink the whole
  // widget, so it's fetched alongside the MMR call and just left blank.
  const [body, account] = await Promise.all([
    fetchMmrAnyRegion(name, tag),
    call(`/valorant/v1/account/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`).catch(() => null),
  ]);
  const data = body?.data;
  if (!data) throw new IntegrationError(404, "Гравця не знайдено.");

  // The v3 mmr response includes a `seasonal` breakdown of wins/games per
  // act; field names beyond current.tier/current.rr aren't pinned down in
  // public docs, so this is read defensively — if the shape doesn't match,
  // we simply show fewer stats instead of crashing the widget.
  const currentSeason = Array.isArray(data.seasonal) ? data.seasonal.at(-1) : null;
  const wins = currentSeason?.wins ?? null;
  const games = currentSeason?.games ?? currentSeason?.number_of_games ?? null;

  return {
    provider: "valorant",
    displayName: `${name}#${tag}`,
    avatar: account?.data?.card?.small ?? null,
    profileUrl: `https://tracker.gg/valorant/profile/riot/${encodeURIComponent(`${name}#${tag}`)}/overview`,
    rank: { label: data.current?.tier?.name ?? "—", value: data.current?.tier?.id ?? null },
    eloOrMmr: data.current?.rr ?? null,
    stats: {
      kd: null, // not exposed by this endpoint without aggregating raw match history
      hsPercent: null,
      winratePercent: wins != null && games ? (100 * wins) / games : null,
      wins,
      losses: wins != null && games != null ? games - wins : null,
      matches: games,
      winStreak: null,
    },
  };
}
