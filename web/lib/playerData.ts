import type { GameId } from "./gameProfiles";
import { apiRequest } from "./apiClient";

export type Phase1Snapshot = {
  phase: "setup" | "sweep" | "done" | "dpi";
  selectedGame: GameId;
  selectedCandidateId: string | null;
  sensitivityAdjustmentSteps: number;
  dpiChoice: "unanswered" | "known";
  sweepCounts: number;
  swipeReadings: number[];
  dpi: number | null;
  dpiReadings: number[];
  dpiCounts: number;
  calibrationId: string | null;
};

export type PracticePreferences = {
  drillType: "flick" | "tracking" | "precision";
  trackingSpeed: number;
  crosshairShape: "plus" | "dot" | "ring";
  crosshairColor: string;
  crosshairSize: number;
  crosshairGap: number;
};

export type PlayerData = {
  version: 1;
  updatedAt: number;
  ownerId?: string | null;
  calibration: Phase1Snapshot;
  practice: PracticePreferences;
};

export const PLAYER_DATA_KEY = "senslab:player-data";
export const LOCAL_ROUNDS_KEY = "senslab:pending-rounds";
export const LOCAL_CALIBRATIONS_KEY = "senslab:calibrations";

export const DEFAULT_PLAYER_DATA: PlayerData = {
  version: 1,
  updatedAt: 0,
  calibration: {
    phase: "setup",
    selectedGame: "cs2",
    selectedCandidateId: null,
    sensitivityAdjustmentSteps: 0,
    dpiChoice: "unanswered",
    sweepCounts: 0,
    swipeReadings: [],
    dpi: null,
    dpiReadings: [],
    dpiCounts: 0,
    calibrationId: null,
  },
  practice: {
    drillType: "flick",
    trackingSpeed: 0.55,
    crosshairShape: "plus",
    crosshairColor: "#b8ff43",
    crosshairSize: 22,
    crosshairGap: 5,
  },
};

export function readLocalPlayerData(): PlayerData | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(PLAYER_DATA_KEY);
    return stored ? { ...DEFAULT_PLAYER_DATA, ...JSON.parse(stored) } : null;
  } catch {
    return null;
  }
}

export function writeLocalPlayerData(data: PlayerData, ownerId: string | null) {
  if (typeof window !== "undefined" && ownerId) localStorage.setItem(PLAYER_DATA_KEY, JSON.stringify({ ...data, ownerId }));
}

export function readLocalRecords(key: string): Array<Record<string, any>> {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function writeLocalRecords(key: string, records: Array<Record<string, any>>) {
  if (typeof window !== "undefined") localStorage.setItem(key, JSON.stringify(records));
}

export function discardGuestData() {
  if (typeof window === "undefined") return;
  const profile = readLocalPlayerData();
  if (profile && !profile.ownerId) localStorage.removeItem(PLAYER_DATA_KEY);
  for (const key of [LOCAL_CALIBRATIONS_KEY, LOCAL_ROUNDS_KEY]) {
    const ownedRecords = readLocalRecords(key).filter((record) => record.ownerId);
    if (ownedRecords.length) writeLocalRecords(key, ownedRecords);
    else localStorage.removeItem(key);
  }
}

export function rememberCalibration(calibration: Phase1Snapshot, ownerId: string | null = null) {
  if (typeof window === "undefined" || !ownerId || calibration.phase !== "done" || !calibration.calibrationId) return;
  const records = readLocalRecords(LOCAL_CALIBRATIONS_KEY).filter((record) => record.id !== calibration.calibrationId);
  records.unshift({ id: calibration.calibrationId, ownerId, data: calibration, createdAt: Date.now() });
  writeLocalRecords(LOCAL_CALIBRATIONS_KEY, records);
}

export function rememberRound(round: Record<string, any>) {
  if (typeof window === "undefined" || !round.id || !round.ownerId) return;
  const records = readLocalRecords(LOCAL_ROUNDS_KEY).filter((record) => record.id !== round.id);
  records.unshift(round);
  writeLocalRecords(LOCAL_ROUNDS_KEY, records);
}

export async function loadPlayerData(token: string | null, ownerId: string | null = null): Promise<PlayerData> {
  if (!token || !ownerId) return DEFAULT_PLAYER_DATA;
  const local = readLocalPlayerData();
  try {
    const response = await apiRequest<{ data: PlayerData | null }>("/profile", token);
    const remote = response.data;
    if (!remote) return local?.ownerId === ownerId ? local : DEFAULT_PLAYER_DATA;
    if (local?.ownerId === ownerId && local.updatedAt > remote.updatedAt) {
      void apiRequest("/profile", token, { method: "PUT", body: JSON.stringify({ data: local }) }).catch(() => {});
      return local;
    }
    writeLocalPlayerData(remote, ownerId);
    return remote;
  } catch {
    return local?.ownerId === ownerId ? local : DEFAULT_PLAYER_DATA;
  }
}

export async function savePlayerData(data: PlayerData, token: string | null, ownerId: string | null = null): Promise<PlayerData> {
  if (!token || !ownerId) return { ...DEFAULT_PLAYER_DATA, ...data, ownerId: null };
  const updated = writePlayerDataLocally(data, ownerId);
  await apiRequest("/profile", token, { method: "PUT", body: JSON.stringify({ data: updated }) });
  return updated;
}

export function writePlayerDataLocally(data: PlayerData, ownerId: string | null = null): PlayerData {
  if (!ownerId) return { ...DEFAULT_PLAYER_DATA, ...data, ownerId: null, updatedAt: Date.now() };
  const stored = readLocalPlayerData();
  const existing = stored?.ownerId === ownerId ? stored : null;
  const updated: PlayerData = {
    ...DEFAULT_PLAYER_DATA,
    ...existing,
    ...data,
    updatedAt: Date.now(),
    ownerId,
    calibration: data.calibration ?? existing?.calibration ?? DEFAULT_PLAYER_DATA.calibration,
    practice: data.practice ?? existing?.practice ?? DEFAULT_PLAYER_DATA.practice,
  };
  writeLocalPlayerData(updated, ownerId);
  rememberCalibration(updated.calibration, ownerId);
  return updated;
}
