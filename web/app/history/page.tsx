"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiRequest } from "../../lib/apiClient";
import { LOCAL_CALIBRATIONS_KEY, LOCAL_ROUNDS_KEY, readLocalRecords } from "../../lib/playerData";
import { useAuth } from "../AuthProvider";
import AccountLinks from "../AccountLinks";
import styles from "../account-ui.module.css";

type HistoryData = { calibrations: Array<Record<string, any>>; rounds: Array<Record<string, any>> };
const EMPTY_HISTORY: HistoryData = { calibrations: [], rounds: [] };

function dateLabel(value: unknown) {
  if (typeof value === "number") return new Date(value).toLocaleString();
  if (typeof value === "string") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toLocaleString();
  }
  return "Date unavailable";
}

export default function HistoryPage() {
  const { user, token, loading } = useAuth();
  const [history, setHistory] = useState(EMPTY_HISTORY);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    if (loading) return;
    let active = true;
    if (!user || !token) {
      setHistory(EMPTY_HISTORY);
      setBusy(false);
      return;
    }
    const matchesUser = (record: Record<string, any>) => record.ownerId === user.id;
    const local: HistoryData = {
      calibrations: readLocalRecords(LOCAL_CALIBRATIONS_KEY).filter(matchesUser),
      rounds: readLocalRecords(LOCAL_ROUNDS_KEY).filter(matchesUser),
    };
    void apiRequest<HistoryData>("/history", token)
      .then((remote) => {
        if (!active) return;
        const merge = (key: "calibrations" | "rounds") => {
          return remote[key];
        };
        setHistory({ calibrations: merge("calibrations"), rounds: merge("rounds") });
      })
      .catch(() => { if (active) setHistory(local); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [loading, token, user?.id]);

  return (
    <main className={`${styles.page} ${styles.historyPage}`}>
      <div className={styles.wrap}>
        <header className={styles.top}><div><Link href="/">← SensLab</Link><h1>History</h1><p>Your saved calibration and practice rounds.</p></div><AccountLinks /></header>
        {!user && <section className={styles.entry}><h3>Sign in to save your progress</h3><p>Calibration and practice history are saved only to a signed-in gamer account. <Link href="/login">Log in</Link> or <Link href="/signup">create an account</Link> to view your history.</p></section>}
        <h2 className={styles.sectionTitle}>Practice rounds</h2>
        {busy ? <p>Loading history…</p> : history.rounds.length ? <div className={styles.historyList}>
          {history.rounds.map((entry) => {
            const data = (entry.data as Record<string, any> | undefined) ?? entry;
            const settings = data.settings ?? {};
            const metrics = data.metrics ?? {};
            return <article className={styles.entry} key={String(entry.id)}>
              <h3>{data.candidateLabel ?? settings.candidateLabel ?? "Practice round"}</h3>
              <p>{String(data.drill ?? settings.drillType ?? "drill").toUpperCase()} · {data.gameDpi ?? settings.gameDpi ?? "—"} DPI · {dateLabel(entry.created_at ?? data.savedAt)}</p>
              <p>{Object.entries(metrics).map(([name, value]) => `${name.replaceAll(/([A-Z])/g, " $1")}: ${typeof value === "number" ? value.toFixed(1) : value}`).join(" · ") || "Round metrics saved"}</p>
              <p>{typeof data.mouseSampleCount === "number" ? `${data.mouseSampleCount} mouse samples and ${data.clickCount ?? 0} clicks saved` : Array.isArray(data.mouseSamples) ? `${data.mouseSamples.length} mouse samples and ${data.clickTimes?.length ?? 0} clicks saved` : "Raw round data saved"}</p>
            </article>;
          })}
        </div> : <p>No practice rounds saved yet. Complete a drill in Phase 2 and it will appear here.</p>}

        <h2 className={styles.sectionTitle}>Phase 1 calibrations</h2>
        {busy ? null : history.calibrations.length ? <div className={styles.historyList}>
          {history.calibrations.map((entry) => {
            const data = (entry.data as Record<string, any> | undefined) ?? {};
            return <article className={styles.entry} key={String(entry.id)}>
              <h3>{String(data.selectedGame ?? "Game").toUpperCase()} calibration</h3>
              <p>{dateLabel(entry.created_at ?? entry.createdAt)}</p>
              <p>{data.dpi ?? "DPI not set"} DPI · {data.swipeReadings?.length ?? 0} comfortable swipes · {data.selectedCandidateId ? `${data.selectedCandidateId} option selected` : "No sensitivity selected"}</p>
            </article>;
          })}
        </div> : <p>No completed calibrations saved yet.</p>}
      </div>
    </main>
  );
}
