// Local admin dashboard — talks directly to the already-deployed backend's
// REST API (the same one the real site uses). No separate backend of its
// own; this file is just a UI shell around /api/admin/users, /api/teams,
// /api/tournaments, /api/matches.
const DEFAULT_BACKEND_URL = "https://tourneyforge-backend.onrender.com";
const LS_TOKEN = "admin_panel_token";
const LS_BACKEND = "admin_panel_backend_url";

let token = localStorage.getItem(LS_TOKEN) || null;
let backendUrl = localStorage.getItem(LS_BACKEND) || DEFAULT_BACKEND_URL;
let currentUser = null;
let teamsCache = [];
let usersCache = [];
let tournamentsCache = [];

const $ = (id) => document.getElementById(id);

// Small square thumbnail for a base64 dataURL avatar/logo, or a dim
// diamond placeholder when none is set — same visual convention as the
// main site's <Logo> fallback (Profile.jsx), just plain DOM here since
// this panel has no framework.
function avatarEl(src) {
  if (src) {
    const img = document.createElement("img");
    img.className = "avatar";
    img.src = src;
    img.alt = "";
    return img;
  }
  const div = document.createElement("div");
  div.className = "avatar-placeholder";
  div.innerHTML = "<span></span>";
  return div;
}

function nameCell(avatarSrc, text) {
  const td = document.createElement("td");
  td.className = "name-cell";
  td.appendChild(avatarEl(avatarSrc));
  const span = document.createElement("span");
  span.textContent = text;
  td.appendChild(span);
  return td;
}

function setBackendUrl(url) {
  backendUrl = url.replace(/\/$/, "");
  localStorage.setItem(LS_BACKEND, backendUrl);
}

async function apiFetch(path, options = {}) {
  const res = await fetch(`${backendUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  let body = null;
  if (res.status !== 204) {
    try {
      body = await res.json();
    } catch {
      body = null;
    }
  }
  if (!res.ok) {
    throw new Error(body?.error || `HTTP ${res.status}`);
  }
  return body;
}

// --- Auth ---

async function login() {
  const username = $("loginUsername").value.trim();
  const password = $("loginPassword").value;
  $("loginMsg").textContent = "";
  try {
    const res = await apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    token = res.token;
    localStorage.setItem(LS_TOKEN, token);
    currentUser = res.user;
    onLoggedIn();
  } catch (e) {
    $("loginMsg").textContent = e.message;
  }
}

function logout() {
  token = null;
  localStorage.removeItem(LS_TOKEN);
  currentUser = null;
  $("app").style.display = "none";
  $("loginBox").style.display = "block";
  $("whoBox").textContent = "";
  $("logoutBtn").style.display = "none";
}

// Backend already rejects every actual read/write here for role "user"
// (requireAdmin/requireContentManager, checked fresh from the DB on every
// request) — but login() and restoreSession() used to wave any successful
// login straight through to the dashboard shell regardless of role, so a
// plain user account could still get past the login screen and stare at a
// UI full of silently-failing requests. This is the single place both
// paths funnel through, so the gate goes here once instead of twice.
function onLoggedIn() {
  if (currentUser.role !== "admin" && currentUser.role !== "organizer") {
    $("loginMsg").textContent = "Ця панель доступна лише для admin/organizer акаунтів.";
    logout();
    return;
  }
  $("loginBox").style.display = "none";
  $("app").style.display = "block";
  $("whoBox").innerHTML = "";
  $("whoBox").append(
    `${currentUser.username} `,
    Object.assign(document.createElement("span"), {
      className: "role-tag",
      textContent: `(${currentUser.role})`,
    })
  );
  $("logoutBtn").style.display = "inline-block";
  loadUsers();
  loadTeams();
  loadTournaments();
}

async function restoreSession() {
  if (!token) return;
  try {
    const res = await apiFetch("/api/auth/me");
    if (!res.user) throw new Error("no session");
    currentUser = res.user;
    onLoggedIn();
  } catch {
    logout();
  }
}

// --- Tabs ---

function initTabs() {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      $(`panel-${btn.dataset.tab}`).classList.add("active");
    });
  });
}

// --- Users ---

const ROLES = ["admin", "organizer", "user"];

async function loadUsers() {
  $("usersMsg").textContent = "";
  try {
    usersCache = await apiFetch("/api/admin/users");
    applyUsersFilter();
  } catch (e) {
    $("usersMsg").textContent = e.message;
    $("usersMsg").className = "msg error";
  }
}

function applyUsersFilter() {
  const q = $("usersFilter").value.trim().toLowerCase();
  const filtered = q ? usersCache.filter((u) => u.username.toLowerCase().includes(q)) : usersCache;
  $("usersCount").textContent = `${filtered.length} / ${usersCache.length}`;
  renderUsers(filtered);
}

function renderUsers(users) {
  const body = $("usersBody");
  body.innerHTML = "";
  if (users.length === 0) {
    body.innerHTML = '<tr class="empty-row"><td colspan="4">Нікого не знайдено</td></tr>';
    return;
  }
  for (const u of users) {
    const tr = document.createElement("tr");

    const tdName = nameCell(u.avatar, u.username);

    const tdRole = document.createElement("td");
    const roleSelect = document.createElement("select");
    ROLES.forEach((r) => {
      const opt = document.createElement("option");
      opt.value = r;
      opt.textContent = r;
      if (r === u.role) opt.selected = true;
      roleSelect.appendChild(opt);
    });
    roleSelect.addEventListener("change", async () => {
      try {
        await apiFetch(`/api/admin/users/${u.id}`, {
          method: "PUT",
          body: JSON.stringify({ role: roleSelect.value }),
        });
        flashMsg("usersMsg", `Роль ${u.username} → ${roleSelect.value}`, "ok");
      } catch (e) {
        flashMsg("usersMsg", e.message, "error");
        roleSelect.value = u.role;
      }
    });
    tdRole.appendChild(roleSelect);

    const tdDate = document.createElement("td");
    tdDate.textContent = new Date(u.createdAt).toLocaleDateString();

    const tdActions = document.createElement("td");
    tdActions.className = "row-actions";

    const resetBtn = document.createElement("button");
    resetBtn.textContent = "Скинути пароль";
    resetBtn.onclick = () => openResetModal(u);
    tdActions.appendChild(resetBtn);

    const delBtn = document.createElement("button");
    delBtn.className = "danger";
    delBtn.textContent = "Видалити";
    delBtn.onclick = async () => {
      if (!confirm(`Видалити акаунт "${u.username}"? Незворотно.`)) return;
      try {
        await apiFetch(`/api/admin/users/${u.id}`, { method: "DELETE" });
        loadUsers();
      } catch (e) {
        flashMsg("usersMsg", e.message, "error");
      }
    };
    tdActions.appendChild(delBtn);

    tr.append(tdName, tdRole, tdDate, tdActions);
    body.appendChild(tr);
  }
}

let resetTarget = null;
function openResetModal(user) {
  resetTarget = user;
  $("resetPasswordInput").value = "";
  $("resetMsg").textContent = "";
  $("resetModalBackdrop").classList.add("open");
}
function closeResetModal() {
  $("resetModalBackdrop").classList.remove("open");
  resetTarget = null;
}
async function confirmReset() {
  const password = $("resetPasswordInput").value;
  try {
    await apiFetch(`/api/admin/users/${resetTarget.id}/reset-password`, {
      method: "POST",
      body: JSON.stringify({ password }),
    });
    closeResetModal();
    flashMsg("usersMsg", `Пароль для ${resetTarget.username} скинуто.`, "ok");
  } catch (e) {
    $("resetMsg").textContent = e.message;
  }
}

// --- Teams ---

const RARITIES = ["", "Common", "Rare", "Epic", "Legendary"];

async function loadTeams() {
  $("teamsMsg").textContent = "";
  try {
    teamsCache = await apiFetch("/api/teams");
    applyTeamsFilter();
  } catch (e) {
    $("teamsMsg").textContent = e.message;
    $("teamsMsg").className = "msg error";
  }
}

function applyTeamsFilter() {
  const q = $("teamsFilter").value.trim().toLowerCase();
  const filtered = q ? teamsCache.filter((t) => t.name.toLowerCase().includes(q)) : teamsCache;
  $("teamsCount").textContent = `${filtered.length} / ${teamsCache.length}`;
  renderTeams(filtered);
}

function renderTeams(teams) {
  const body = $("teamsBody");
  body.innerHTML = "";
  if (teams.length === 0) {
    body.innerHTML = '<tr class="empty-row"><td colspan="5">Нічого не знайдено</td></tr>';
    return;
  }
  for (const t of teams) {
    const tr = document.createElement("tr");

    const tdName = nameCell(t.logo, t.name);

    const tdDisc = document.createElement("td");
    tdDisc.textContent = t.discipline;

    const tdCount = document.createElement("td");
    tdCount.textContent = t.tournaments ?? 0;

    const tdRarity = document.createElement("td");
    const raritySelect = document.createElement("select");
    RARITIES.forEach((r) => {
      const opt = document.createElement("option");
      opt.value = r;
      opt.textContent = r || "Авто";
      if ((t.rarityOverride ?? "") === r) opt.selected = true;
      raritySelect.appendChild(opt);
    });
    raritySelect.addEventListener("change", async () => {
      try {
        await apiFetch(`/api/teams/${t.id}`, {
          method: "PUT",
          body: JSON.stringify({ rarityOverride: raritySelect.value || null }),
        });
        flashMsg("teamsMsg", `Рідкість ${t.name} оновлено.`, "ok");
      } catch (e) {
        flashMsg("teamsMsg", e.message, "error");
      }
    });
    tdRarity.appendChild(raritySelect);

    const tdActions = document.createElement("td");
    tdActions.className = "row-actions";
    const delBtn = document.createElement("button");
    delBtn.className = "danger";
    delBtn.textContent = "Видалити";
    delBtn.onclick = async () => {
      if (!confirm(`Видалити команду "${t.name}"?`)) return;
      try {
        await apiFetch(`/api/teams/${t.id}`, { method: "DELETE" });
        loadTeams();
      } catch (e) {
        flashMsg("teamsMsg", e.message, "error");
      }
    };
    tdActions.appendChild(delBtn);

    tr.append(tdName, tdDisc, tdCount, tdRarity, tdActions);
    body.appendChild(tr);
  }
}

// --- Tournaments ---

// Mirrors the backend's real lifecycle (see tournaments.js STATUS_VALUES)
// — "draft" until the final match is won, then "completed" automatically.
// No separate "active" state exists anywhere in the app's own logic.
const STATUSES = ["draft", "completed"];

async function loadTournaments() {
  $("tournamentsMsg").textContent = "";
  try {
    tournamentsCache = await apiFetch("/api/tournaments");
    applyTournamentsFilter();
  } catch (e) {
    $("tournamentsMsg").textContent = e.message;
    $("tournamentsMsg").className = "msg error";
  }
}

function applyTournamentsFilter() {
  const q = $("tournamentsFilter").value.trim().toLowerCase();
  const filtered = q
    ? tournamentsCache.filter((tr) => tr.name.toLowerCase().includes(q))
    : tournamentsCache;
  $("tournamentsCount").textContent = `${filtered.length} / ${tournamentsCache.length}`;
  renderTournaments(filtered);
}

function renderTournaments(tours) {
  const body = $("tournamentsBody");
  body.innerHTML = "";
  if (tours.length === 0) {
    body.innerHTML = '<tr class="empty-row"><td colspan="5">Нічого не знайдено</td></tr>';
    return;
  }
  for (const tour of tours) {
    const tr = document.createElement("tr");

    const tdName = document.createElement("td");
    tdName.textContent = tour.name;

    const tdDisc = document.createElement("td");
    tdDisc.textContent = tour.discipline;

    const tdStatus = document.createElement("td");
    const statusSelect = document.createElement("select");
    STATUSES.forEach((s) => {
      const opt = document.createElement("option");
      opt.value = s;
      opt.textContent = s;
      if (s === tour.status) opt.selected = true;
      statusSelect.appendChild(opt);
    });
    statusSelect.addEventListener("change", async () => {
      try {
        await apiFetch(`/api/tournaments/${tour.id}`, {
          method: "PUT",
          body: JSON.stringify({ status: statusSelect.value }),
        });
        flashMsg("tournamentsMsg", `Статус "${tour.name}" → ${statusSelect.value}`, "ok");
      } catch (e) {
        flashMsg("tournamentsMsg", e.message, "error");
      }
    });
    tdStatus.appendChild(statusSelect);

    const tdTeams = document.createElement("td");
    tdTeams.textContent = tour.teams?.length ?? 0;

    const tdActions = document.createElement("td");
    tdActions.className = "row-actions";

    const addTeamBtn = document.createElement("button");
    addTeamBtn.textContent = "+ команда";
    addTeamBtn.onclick = () => openRegisterModal(tour);
    tdActions.appendChild(addTeamBtn);

    const genBtn = document.createElement("button");
    genBtn.textContent = "Згенерувати сітку";
    genBtn.onclick = async () => {
      try {
        await apiFetch(`/api/tournaments/${tour.id}/generate-bracket`, { method: "POST" });
        flashMsg("tournamentsMsg", `Сітку "${tour.name}" згенеровано.`, "ok");
        loadTournaments();
      } catch (e) {
        flashMsg("tournamentsMsg", e.message, "error");
      }
    };
    tdActions.appendChild(genBtn);

    const delBtn = document.createElement("button");
    delBtn.className = "danger";
    delBtn.textContent = "Видалити";
    delBtn.onclick = async () => {
      if (!confirm(`Видалити турнір "${tour.name}"? Незворотно.`)) return;
      try {
        await apiFetch(`/api/tournaments/${tour.id}`, { method: "DELETE" });
        loadTournaments();
      } catch (e) {
        flashMsg("tournamentsMsg", e.message, "error");
      }
    };
    tdActions.appendChild(delBtn);

    tr.append(tdName, tdDisc, tdStatus, tdTeams, tdActions);
    body.appendChild(tr);
  }
}

let registerTarget = null;
function openRegisterModal(tour) {
  registerTarget = tour;
  $("registerMsg").textContent = "";
  const select = $("registerTeamSelect");
  select.innerHTML = "";
  const registeredIds = new Set((tour.teams ?? []).map((tt) => tt.teamId));
  const candidates = teamsCache.filter(
    (t) => t.discipline === tour.discipline && !registeredIds.has(t.id)
  );
  if (candidates.length === 0) {
    const opt = document.createElement("option");
    opt.textContent = "Немає доступних команд цієї дисципліни";
    opt.disabled = true;
    select.appendChild(opt);
  }
  candidates.forEach((t) => {
    const opt = document.createElement("option");
    opt.value = t.id;
    opt.textContent = t.name;
    select.appendChild(opt);
  });
  $("registerModalBackdrop").classList.add("open");
}
function closeRegisterModal() {
  $("registerModalBackdrop").classList.remove("open");
  registerTarget = null;
}
async function confirmRegister() {
  const teamId = $("registerTeamSelect").value;
  if (!teamId) {
    $("registerMsg").textContent = "Немає обраної команди.";
    return;
  }
  try {
    await apiFetch(`/api/tournaments/${registerTarget.id}/register`, {
      method: "POST",
      body: JSON.stringify({ teamId: Number(teamId) }),
    });
    closeRegisterModal();
    loadTournaments();
  } catch (e) {
    $("registerMsg").textContent = e.message;
  }
}

async function createTournament() {
  const name = $("newTourName").value.trim();
  $("createTourMsg").textContent = "";
  if (!name) {
    $("createTourMsg").textContent = "Вкажи назву.";
    $("createTourMsg").className = "msg error";
    return;
  }
  try {
    await apiFetch("/api/tournaments", {
      method: "POST",
      body: JSON.stringify({
        name,
        discipline: $("newTourDiscipline").value,
        bracketType: $("newTourBracket").value,
        matchFormat: Number($("newTourFormat").value),
      }),
    });
    $("newTourName").value = "";
    flashMsg("createTourMsg", "Турнір створено.", "ok");
    loadTournaments();
  } catch (e) {
    flashMsg("createTourMsg", e.message, "error");
  }
}

// --- Small helpers ---

function flashMsg(id, text, kind) {
  const el = $(id);
  el.textContent = text;
  el.className = `msg ${kind}`;
  if (kind === "ok") setTimeout(() => { if (el.textContent === text) el.textContent = ""; }, 3000);
}

// --- Wire up ---

$("backendUrlInput").value = backendUrl;
$("backendUrlInput").addEventListener("change", (e) => setBackendUrl(e.target.value));
$("loginBtn").addEventListener("click", login);
$("loginPassword").addEventListener("keydown", (e) => { if (e.key === "Enter") login(); });
$("logoutBtn").addEventListener("click", logout);
$("resetCancelBtn").addEventListener("click", closeResetModal);
$("resetConfirmBtn").addEventListener("click", confirmReset);
$("registerCancelBtn").addEventListener("click", closeRegisterModal);
$("registerConfirmBtn").addEventListener("click", confirmRegister);
$("createTourBtn").addEventListener("click", createTournament);
$("usersFilter").addEventListener("input", applyUsersFilter);
$("teamsFilter").addEventListener("input", applyTeamsFilter);
$("tournamentsFilter").addEventListener("input", applyTournamentsFilter);
initTabs();
restoreSession();
