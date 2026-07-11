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

// Помилка з реальною відповіддю бекенду (не-OK статус). Відрізняється від
// мережевої помилки (fetch кинув сам, бекенд недоступний) — лише остання
// має спрацьовувати фолбек на demo-дані/тиху відмову нижче.
export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Той самий ключ, що й lib/auth.jsx використовує для токена в localStorage
// (не імпортуємо звідти напряму, щоб уникнути циклічної залежності —
// auth.jsx сам імпортує login/getMe з цього файлу).
const TOKEN_KEY = "arena_token";

// Обгортка над fetch: на мережевій помилці кидає її як є (фолбек нижче її
// зловить), а на не-OK відповіді кидає ApiError з повідомленням бекенду.
// Токен (якщо є) додається автоматично — бекенд ігнорує його на публічних
// GET-роутах і вимагає лише на мутуючих (create/update/delete).
async function request(path, options) {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
  });
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      // Тіло не JSON — лишаємо дефолтне повідомлення.
    }
    throw new ApiError(res.status, message);
  }
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
  } catch (err) {
    if (err instanceof ApiError) throw err;
    // Фолбек лише на мережеву помилку: повертаємо введені дані з тимчасовим id.
    return { id: demoTeams().length + 1, ...data };
  }
}

export async function updateTeam(id, data) {
  try {
    return await request(`/api/teams/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  } catch (err) {
    if (err instanceof ApiError) throw err;
    return { id, ...data };
  }
}

export async function deleteTeam(id) {
  try {
    await request(`/api/teams/${id}`, { method: "DELETE" });
    return { ok: true };
  } catch (err) {
    if (err instanceof ApiError) throw err;
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
  } catch (err) {
    if (err instanceof ApiError) throw err;
    return { id: 1, teams: [], matches: [], ...data };
  }
}

export async function registerTeam(tournamentId, teamId) {
  try {
    return await request(`/api/tournaments/${tournamentId}/register`, {
      method: "POST",
      body: JSON.stringify({ teamId }),
    });
  } catch (err) {
    if (err instanceof ApiError) throw err;
    return { teamId };
  }
}

export async function generateBracket(tournamentId) {
  return request(`/api/tournaments/${tournamentId}/generate-bracket`, { method: "POST" });
}

// Без demo-фолбеку — переупорядкування без бекенду не зберегти, помилка має
// дійти до UI, а не тихо відкотитись.
export async function reorderTournamentTeams(tournamentId, teamIds) {
  return request(`/api/tournaments/${tournamentId}/teams/reorder`, {
    method: "PUT",
    body: JSON.stringify({ teamIds }),
  });
}

export async function deleteTournament(id) {
  try {
    await request(`/api/tournaments/${id}`, { method: "DELETE" });
    return { ok: true };
  } catch (err) {
    if (err instanceof ApiError) throw err;
    return { ok: true };
  }
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

// --- Автентифікація ---

// Без demo-фолбеку — логін без бекенду не має сенсу, помилка має дійти до UI.
export async function login(username, password) {
  return request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export async function getMe() {
  return request("/api/auth/me");
}

// --- Гравці ---

// Без demo-фолбеку, як і submitMatchScore — без бекенду немає що показувати,
// виклик має впасти явно, щоб UI показав помилку замість фейкових даних.
export async function getPlayerStats(id, { refresh = false } = {}) {
  return request(`/api/players/${id}/stats${refresh ? "?refresh=1" : ""}`);
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
      team.players.filter((p) => !p.isSubstitute).map((p) => p.rank)
    );
    const def = DISCIPLINES[team.discipline];
    return { discipline: team.discipline, unit: def?.unit ?? "", label: r.label, value: r.value };
  }
}
