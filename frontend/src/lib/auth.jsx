// Auth context: two fixed seeded accounts (Admin/admin, User/user), no
// self-registration. Token is a JWT from POST /api/auth/login, kept in
// localStorage so a refresh doesn't log the user out (and so the same
// login is shared across multiple tabs open at once — this is a LAN-party
// tool, an admin running several tournaments side by side in several tabs
// staying logged in everywhere is the normal case, not an edge case);
// validated against GET /api/auth/me on mount (catches an expired/tampered
// token).
//
// A `storage` event fires in every OTHER tab (never the one that made the
// change) whenever this key changes — without listening for it, a second
// tab logging out (or logging in as someone else) silently invalidated the
// first tab's token without the first tab's React state ever finding out:
// reproduced live as an untouched "Admin" tab getting bounced to /login (or
// silently acting as the wrong user) only once it happened to remount for
// an unrelated reason, long after the actual moment the other tab logged
// out. Reacting to the event keeps every open tab's `user` state truthful
// immediately, while still sharing one login across tabs as intended.
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { login as apiLogin, register as apiRegister, getMe } from "./api";

const TOKEN_KEY = "arena_token";
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setLoading(false);
      return;
    }
    getMe()
      .then((res) => setUser(res.user))
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    function onStorage(e) {
      if (e.key !== TOKEN_KEY) return;
      if (!e.newValue) {
        setUser(null);
        return;
      }
      getMe()
        .then((res) => setUser(res.user))
        .catch(() => setUser(null));
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const login = useCallback(async (username, password) => {
    const res = await apiLogin(username, password);
    localStorage.setItem(TOKEN_KEY, res.token);
    // /api/auth/login only returns { id, username, role } — it doesn't carry
    // bio/avatar. Seeding `user` straight from that response left a
    // freshly-logged-in account looking wiped (bio "0/500", avatar reset to
    // the file picker) even though the profile was intact server-side; it
    // only reappeared after an unrelated full page reload re-ran the
    // getMe() below via the mount effect. Fetch the full profile here too,
    // so login and refresh always populate the same shape of `user`.
    const me = await getMe();
    setUser(me.user);
    return me.user;
  }, []);

  const register = useCallback(async (username, password) => {
    const res = await apiRegister(username, password);
    localStorage.setItem(TOKEN_KEY, res.token);
    const me = await getMe();
    setUser(me.user);
    return me.user;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  }, []);

  const isAdmin = user?.role === "admin";
  const canManageContent = isAdmin || user?.role === "organizer";

  return (
    <AuthContext.Provider
      value={{ user, setUser, loading, login, register, logout, isAdmin, canManageContent }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
