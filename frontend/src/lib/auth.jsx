// Auth context: two fixed seeded accounts (Admin/admin, User/user), no
// self-registration. Token is a JWT from POST /api/auth/login, kept in
// localStorage so a refresh doesn't log the user out; validated against
// GET /api/auth/me on mount (catches an expired/tampered token).
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

  const login = useCallback(async (username, password) => {
    const res = await apiLogin(username, password);
    localStorage.setItem(TOKEN_KEY, res.token);
    setUser(res.user);
    return res.user;
  }, []);

  const register = useCallback(async (username, password) => {
    const res = await apiRegister(username, password);
    localStorage.setItem(TOKEN_KEY, res.token);
    setUser(res.user);
    return res.user;
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
