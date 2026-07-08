// Тонкий шар доступу до даних.
// Звертається до бекенду на http://localhost:4000, а якщо бекенд недоступний
// (fetch кинув помилку або відповідь не-OK) — м'яко відкочується до даних demo.js,
// щоб застосунок працював автономно.

import { TEAMS, avgRating, DISCIPLINES } from "./demo";

// Base URL is configurable via Vite env (VITE_API_URL) for the prod/PostgreSQL
// switch mentioned in the Week 2 spec; falls back to the local dev backend.
const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

// Демо-команди з синтетичним id (index + 1), якщо власного id немає.
function demoTeams() {
  return TEAMS.map((t, i) => ({ id: t.id ?? i + 1, ...t }));
}

// Обгортка над fetch: кидає помилку на не-OK відповіді, щоб спрацював фолбек.
async function request(path, options) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  if (res.status === 204) return null;
  return res.json();
}

// --- Команди ---

export async function getTeams() {
  try {
    return await request("/api/teams");
  } catch {
    return demoTeams();
  }
}

export async function getTeam(id) {
  try {
    return await request(`/api/teams/${id}`);
  } catch {
    return demoTeams().find((t) => String(t.id) === String(id)) ?? null;
  }
}

export async function createTeam(data) {
  try {
    return await request("/api/teams", {
      method: "POST",
      body: JSON.stringify(data),
    });
  } catch {
    // Фолбек: повертаємо введені дані з тимчасовим id.
    return { id: demoTeams().length + 1, ...data };
  }
}

export async function updateTeam(id, data) {
  try {
    return await request(`/api/teams/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  } catch {
    return { id, ...data };
  }
}

export async function deleteTeam(id) {
  try {
    await request(`/api/teams/${id}`, { method: "DELETE" });
    return { ok: true };
  } catch {
    return { ok: true };
  }
}

// --- Турніри ---

export async function getTournaments() {
  try {
    return await request("/api/tournaments");
  } catch {
    return [];
  }
}

export async function getTournament(id) {
  try {
    return await request(`/api/tournaments/${id}`);
  } catch {
    return null;
  }
}

export async function createTournament(data) {
  try {
    return await request("/api/tournaments", {
      method: "POST",
      body: JSON.stringify(data),
    });
  } catch {
    return { id: 1, teams: [], matches: [], ...data };
  }
}

export async function registerTeam(tournamentId, teamId) {
  try {
    return await request(`/api/tournaments/${tournamentId}/register`, {
      method: "POST",
      body: JSON.stringify({ teamId }),
    });
  } catch {
    return { teamId };
  }
}

export async function generateBracket(tournamentId) {
  return request(`/api/tournaments/${tournamentId}/generate-bracket`, { method: "POST" });
}

// --- Матчі ---

// На відміну від інших функцій тут немає demo-фолбеку: без бекенду немає
// що зберігати, і виклик має впасти явно, щоб UI показав помилку.
export async function submitMatchScore(matchId, scoreA, scoreB) {
  return request(`/api/matches/${matchId}/score`, {
    method: "PUT",
    body: JSON.stringify({ scoreA, scoreB }),
  });
}

// --- Рейтинг ---

export async function getTeamRating(id) {
  try {
    return await request(`/api/teams/${id}/rating`);
  } catch {
    const team = demoTeams().find((t) => String(t.id) === String(id));
    if (!team) return null;
    const r = avgRating(
      team.discipline,
      team.players.map((p) => p.rank)
    );
    const def = DISCIPLINES[team.discipline];
    return { discipline: team.discipline, unit: def?.unit ?? "", label: r.label, value: r.value };
  }
}
