import { fetchFaceitStats } from "./faceit.js";
import { fetchOpenDotaStats } from "./opendota.js";
import { fetchValorantStats } from "./valorant.js";

export { IntegrationError } from "./faceit.js";

const FETCHERS = {
  CS2: fetchFaceitStats,
  "Dota 2": fetchOpenDotaStats,
  Valorant: fetchValorantStats,
};

export function fetcherFor(discipline) {
  return FETCHERS[discipline] ?? null;
}
