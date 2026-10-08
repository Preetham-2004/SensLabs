"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest, COOKIE_SESSION } from "../lib/apiClient";
import { discardGuestData, LOCAL_CALIBRATIONS_KEY, LOCAL_ROUNDS_KEY, PLAYER_DATA_KEY, readLocalPlayerData, readLocalRecords, writeLocalRecords } from "../lib/playerData";

export type GamePreference = "valorant" | "cs2";
export type User = { id: string; email: string; username?: string; preferred_game?: GamePreference };
type AuthContextValue = {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, username: string, preferredGame: GamePreference) => Promise<void>;
  updateAccount: (username: string, preferredGame: GamePreference) => Promise<void>;
  deleteAccount: () => Promise<void>;
  logout: () => Promise<void>;
};
const AuthContext = createContext<AuthContextValue | null>(null);

type AuthResponse = { user?: User };
type SignedInResponse = { user: User };

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
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const accept = useCallback(async (response: SignedInResponse) => {
    setToken(COOKIE_SESSION);
    setUser(response.user);
    void uploadLocalData(COOKIE_SESSION, response.user.id);
  }, []);

  useEffect(() => {
    const legacyToken = localStorage.getItem("senslab:access-token");
    const restoreSession = legacyToken
      ? apiRequest<User>("/auth/session", null, { method: "POST", headers: { Authorization: `Bearer ${legacyToken}` } })
      : apiRequest<User>("/auth/me");
    if (legacyToken) localStorage.removeItem("senslab:access-token");
    restoreSession
      .then((currentUser) => { setToken(COOKIE_SESSION); setUser(currentUser); void uploadLocalData(COOKIE_SESSION, currentUser.id); })
      .catch(() => { setToken(null); discardGuestData(); })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const response = await apiRequest<SignedInResponse>("/auth/login", null, { method: "POST", body: JSON.stringify({ email, password }) });
    await accept(response);
  }, [accept]);
  const signup = useCallback(async (email: string, password: string, username: string, preferredGame: GamePreference) => {
    const response = await apiRequest<AuthResponse>("/auth/signup", null, { method: "POST", body: JSON.stringify({ email, password, username, preferred_game: preferredGame }) });
    if (!response.user) throw new Error("Could not sign in after creating your account. Please try logging in.");
    await accept(response as SignedInResponse);
  }, [accept]);
  const updateAccount = useCallback(async (username: string, preferredGame: GamePreference) => {
    if (!token) throw new Error("Please sign in to update your account.");
    const updated = await apiRequest<User>("/auth/profile", token, {
      method: "PATCH",
      body: JSON.stringify({ username, preferred_game: preferredGame }),
    });
    setUser(updated);
  }, [token]);
  const deleteAccount = useCallback(async () => {
    if (!token || !user) throw new Error("Please sign in before deleting your account.");
    await apiRequest<{ status: string }>("/auth/account", token, { method: "DELETE" });

    const accountId = user.id;
    const localProfile = readLocalPlayerData();
    if (localProfile?.ownerId === accountId) localStorage.removeItem(PLAYER_DATA_KEY);
    for (const key of [LOCAL_CALIBRATIONS_KEY, LOCAL_ROUNDS_KEY]) {
      writeLocalRecords(key, readLocalRecords(key).filter((record) => record.ownerId !== accountId));
    }
    setToken(null);
    setUser(null);
  }, [token, user]);
  const logout = useCallback(async () => {
    await apiRequest("/auth/logout", null, { method: "POST" }).catch(() => {});
    localStorage.removeItem("senslab:access-token");
    localStorage.removeItem("senslab:player-data");
    discardGuestData();
    setToken(null);
    setUser(null);
    router.replace("/");
  }, [router]);
  const value = useMemo(() => ({ user, token, loading, login, signup, updateAccount, deleteAccount, logout }), [user, token, loading, login, signup, updateAccount, deleteAccount, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
