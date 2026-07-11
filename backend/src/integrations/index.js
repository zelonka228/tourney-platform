import { fetchFaceitStats } from "./faceit.js";
import { fetchValorantStats } from "./valorant.js";

export { IntegrationError } from "./faceit.js";

const FETCHERS = {
  CS2: fetchFaceitStats,
  Valorant: fetchValorantStats,
};

export function fetcherFor(discipline) {
  return FETCHERS[discipline] ?? null;
}
