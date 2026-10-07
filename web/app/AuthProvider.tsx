"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { apiRequest, TOKEN_KEY } from "../lib/apiClient";
import { discardGuestData, LOCAL_CALIBRATIONS_KEY, LOCAL_ROUNDS_KEY, readLocalPlayerData, readLocalRecords, writeLocalRecords } from "../lib/playerData";

type User = { id: string; email: string };
type AuthContextValue = {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
};
const AuthContext = createContext<AuthContextValue | null>(null);

type AuthResponse = { access_token?: string; confirmation_required?: boolean; user?: User };
type SignedInResponse = { access_token: string; user: User };

async function uploadLocalData(token: string, userId: string) {
  const profile = readLocalPlayerData();
  if (profile && profile.updatedAt > 0) {
    try {
      const remote = await apiRequest<{ data: { updatedAt?: number } | null }>("/profile", token);
      const profileBelongsToUser = profile.ownerId === userId;
      if (profileBelongsToUser && (!remote.data || profile.updatedAt > (remote.data.updatedAt ?? 0))) {
        await apiRequest("/profile", token, { method: "PUT", body: JSON.stringify({ data: profile }) });
      }
    } catch { /* Profile can sync on the next save. */ }
  }
  for (const [key, endpoint] of [[LOCAL_CALIBRATIONS_KEY, "/calibrations"], [LOCAL_ROUNDS_KEY, "/rounds"]] as const) {
    const records = readLocalRecords(key);
    const remaining = [];
    for (const record of records) {
      const belongsToUser = record.ownerId === userId;
      if (!belongsToUser) { remaining.push(record); continue; }
      try {
        const payload = endpoint === "/calibrations" ? { id: record.id, data: record.data } : { id: record.id, data: record };
        await apiRequest(endpoint, token, { method: "POST", body: JSON.stringify(payload) });
      } catch { remaining.push(record); }
    }
    writeLocalRecords(key, remaining);
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const accept = useCallback(async (response: SignedInResponse) => {
    localStorage.setItem(TOKEN_KEY, response.access_token);
    setToken(response.access_token);
    setUser(response.user);
    void uploadLocalData(response.access_token, response.user.id);
  }, []);

  useEffect(() => {
    const callbackParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const callbackToken = callbackParams.get("access_token");
    if (callbackToken) {
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
      setToken(callbackToken);
      apiRequest<User>("/auth/me", callbackToken)
        .then((currentUser) => {
          localStorage.setItem(TOKEN_KEY, callbackToken);
          setUser(currentUser);
          void uploadLocalData(callbackToken, currentUser.id);
        })
        .catch(() => {
          setToken(null);
          localStorage.removeItem(TOKEN_KEY);
          discardGuestData();
        })
        .finally(() => setLoading(false));
      return;
    }

    const storedToken = localStorage.getItem(TOKEN_KEY);
    if (!storedToken) { discardGuestData(); setLoading(false); return; }
    setToken(storedToken);
    apiRequest<User>("/auth/me", storedToken)
      .then((currentUser) => { setUser(currentUser); void uploadLocalData(storedToken, currentUser.id); })
      .catch(() => { localStorage.removeItem(TOKEN_KEY); setToken(null); discardGuestData(); })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    await accept(await apiRequest<SignedInResponse>("/auth/login", null, { method: "POST", body: JSON.stringify({ email, password }) }));
  }, [accept]);
  const signup = useCallback(async (email: string, password: string) => {
    const response = await apiRequest<AuthResponse>("/auth/signup", null, { method: "POST", body: JSON.stringify({ email, password }) });
    if (!response.access_token || !response.user) return false;
    await accept({ access_token: response.access_token, user: response.user });
    return true;
  }, [accept]);
  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem("senslab:player-data");
    discardGuestData();
    setToken(null);
    setUser(null);
  }, []);
  const value = useMemo(() => ({ user, token, loading, login, signup, logout }), [user, token, loading, login, signup, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
