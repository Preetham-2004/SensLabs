"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiRequest } from "../../lib/apiClient";
import { LOCAL_CALIBRATIONS_KEY, LOCAL_ROUNDS_KEY, readLocalRecords } from "../../lib/playerData";
import { GAME_PROFILES, type GameId } from "../../lib/gameProfiles";
import { gameSensitivityForCm360 } from "../../lib/sensitivity";
import { assessSensitivityConfidence } from "../../lib/resultAssessment";
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

type Detail = { label: string; value: string };

function DetailsPanel({ title, items, empty = "No details saved." }: { title: string; items: Detail[]; empty?: string }) {
  return <section className={styles.detailPanel}>
    <h4>{title}</h4>
    {items.length ? <dl>{items.map((item) => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl> : <p>{empty}</p>}
  </section>;
}

function displayValue(value: unknown, fallback = "Not recorded") {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "number") return Number.isInteger(value) ? value.toLocaleString() : value.toFixed(2);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function recordedDetail(label: string, value: unknown, format: (value: unknown) => string = (item) => displayValue(item)): Detail | null {
  if (value === null || value === undefined || value === "") return null;
  return { label, value: format(value) };
}

function metricLabel(name: string) {
  return name.replaceAll(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase()).trim();
}

function metricValue(name: string, value: unknown) {
  if (typeof value !== "number") return displayValue(value);
  const formatted = Number.isInteger(value) ? value.toLocaleString() : value.toFixed(2);
  if (/percent|rate/i.test(name)) return `${formatted}%`;
  if (/deg/i.test(name)) return `${formatted}°`;
  if (/ms/i.test(name)) return `${formatted} ms`;
  return formatted;
}

function flattenDetails(value: unknown, prefix: string): Detail[] {
  if (value === null || value === undefined || value === "") return [];
  if (typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0) return [];
  if (Array.isArray(value) && value.length === 0) return [];
  if (Array.isArray(value)) return [{ label: metricLabel(prefix), value: `${value.length} records` }];
  if (typeof value === "object") {
    return Object.entries(value).flatMap(([key, nested]) => flattenDetails(nested, `${prefix} ${key}`));
  }
  return [{ label: metricLabel(prefix), value: metricValue(prefix, value) }];
}

function calibrationResults(data: Record<string, any>): Detail[] {
  const game = GAME_PROFILES[data.selectedGame as GameId];
  const dpi = Number(data.dpi);
  const counts = Number(data.sweepCounts);
  const steps = Number(data.sensitivityAdjustmentSteps ?? 0);
  const baseCm360 = dpi > 0 && counts > 0 ? (2 * counts * 2.54) / dpi : null;
  const selected = data.selectedCandidateId;
  const swipeReadings = Array.isArray(data.swipeReadings) ? data.swipeReadings : [];
  const confidence = assessSensitivityConfidence({ calibrationSwipeCounts: swipeReadings });
  const candidates = [
    { id: "lower", label: "Lower", factor: 0.88 },
    { id: "medium", label: "Medium", factor: 1 },
    { id: "higher", label: "Higher", factor: 1.12 },
  ];
  const results: Detail[] = [];
  if (selected) results.push({ label: "Selected option", value: candidates.find((candidate) => candidate.id === selected)?.label ?? String(selected) });
  if (swipeReadings.length) results.push({ label: "Calibration confidence", value: `${confidence.level} · ${confidence.reasons.join(" ")}` });
  if (typeof data.sensitivityAdjustmentSteps === "number") {
    results.push({ label: "Sensitivity adjustment", value: `${steps > 0 ? "+" : ""}${steps * 2}% (${steps} steps)` });
  }
  if (baseCm360 && game && dpi) {
    results.push(...candidates.map((candidate) => {
      const cm360 = baseCm360 / candidate.factor / (1 + steps * 0.02);
      const sensitivity = game.yawVerified && game.yawDegreesPerCountAtSensitivityOne
        ? gameSensitivityForCm360(cm360, dpi, game.yawDegreesPerCountAtSensitivityOne)
        : null;
      return {
        label: `${candidate.label} setting${selected === candidate.id ? " · selected" : ""}`,
        value: `${sensitivity === null ? "Unverified sensitivity" : sensitivity.toFixed(3)} · ${cm360.toFixed(2)} cm/360°`,
      };
    }));
  }
  return results;
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
          const byId = new Map(remote[key].map((record) => [String(record.id), record]));
          for (const record of local[key]) {
            if (!byId.has(String(record.id))) byId.set(String(record.id), record);
          }
          return [...byId.values()];
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
        <header className={`${styles.top} ${!loading && !user ? styles.historySignedOut : ""}`}>
          <div><Link href={user ? "/calibrate" : "/"} className={styles.backButton}>Back</Link><h1>History</h1><p>Your saved calibration and practice rounds.</p></div>
          {user && <AccountLinks />}
        </header>
        {!loading && !user && <section className={`${styles.entry} ${styles.historySignIn}`}>
          <div>
            <span className={styles.historyEyebrow}>YOUR PROGRESS</span>
            <h2>Keep your progress in one place.</h2>
            <p>Sign in to revisit your calibrations and practice results, or create an account to start saving them.</p>
          </div>
          <div className={styles.historyPromptActions}>
            <Link href="/login">Log in</Link>
            <Link href="/signup">Create account</Link>
          </div>
        </section>}
        <h2 className={styles.sectionTitle}>Practice rounds</h2>
        {busy ? <p>Loading history…</p> : history.rounds.length ? <div className={styles.historyList}>
          {history.rounds.map((entry) => {
            const data = (entry.data as Record<string, any> | undefined) ?? entry;
            const settings = data.settings ?? {};
            const metrics = data.metrics ?? {};
            const drill = data.drill ?? settings.drillType;
            const game = data.game ?? String(data.candidateLabel ?? settings.candidateLabel ?? "Game").split(/[ ·]/)[0];
            const sampleCount = data.mouseSampleCount ?? data.mouseSamples?.length;
            const clickCount = data.clickCount ?? data.clickTimes?.length;
            const durationMs = typeof data.startedAt === "number" && typeof data.endedAt === "number" ? Math.max(0, data.endedAt - data.startedAt) : null;
            const crosshairParts = [data.crosshairShape ?? settings.crosshairShape, data.crosshairColor ?? settings.crosshairColor].filter((value) => value !== null && value !== undefined && value !== "");
            const crosshairDimensions = [data.crosshairSize ?? settings.crosshairSize, data.crosshairGap ?? settings.crosshairGap].filter((value) => value !== null && value !== undefined);
            const didItems = [
              recordedDetail("Game", game, (value) => String(value).toUpperCase()),
              recordedDetail("Drill", drill, (value) => String(value).toUpperCase()),
              recordedDetail("Sensitivity setting", data.candidateLabel ?? settings.candidateLabel),
              recordedDetail("Mouse DPI", data.gameDpi ?? settings.gameDpi, (value) => `${displayValue(value)} DPI`),
              recordedDetail("Elapsed time", durationMs, (value) => `${(Number(value) / 1000).toFixed(1)} seconds`),
              recordedDetail("cm/360°", data.cm360, (value) => `${displayValue(value)} cm/360°`),
              recordedDetail("Baseline movement", data.baselineCounts ?? settings.baselineCounts, (value) => `${displayValue(value)} counts`),
              recordedDetail("Tracking speed", data.trackingSpeed ?? settings.trackingSpeed),
              crosshairParts.length ? { label: "Crosshair", value: crosshairParts.join(" · ") } : null,
              crosshairDimensions.length ? { label: "Crosshair size / gap", value: crosshairDimensions.map((value) => displayValue(value)).join(" / ") } : null,
              sampleCount !== undefined || clickCount !== undefined
                ? { label: "Input recorded", value: `${sampleCount === undefined ? "" : `${displayValue(sampleCount)} mouse samples`}${sampleCount !== undefined && clickCount !== undefined ? " · " : ""}${clickCount === undefined ? "" : `${displayValue(clickCount)} clicks`}` }
                : null,
            ].filter((item): item is Detail => item !== null);
            const outcomeItems: Detail[] = Object.entries(metrics).flatMap(([name, value]) => flattenDetails(value, name));
            if (data.movementStyleEstimate && typeof data.movementStyleEstimate === "object") {
              outcomeItems.push(...Object.entries(data.movementStyleEstimate).flatMap(([name, value]) => flattenDetails(value, `Movement ${name}`)));
            }
            return <article className={styles.entry} key={String(entry.id)}>
              <div className={styles.historyEntryHead}><h3>{String(game).toUpperCase()} · {String(drill ?? "Practice").toUpperCase()}</h3><span>{dateLabel(entry.created_at ?? data.savedAt)}</span></div>
              <div className={styles.historyColumns}>
                <DetailsPanel title="What you did" items={didItems} />
                <DetailsPanel title="Results" items={outcomeItems} empty="No drill metrics were saved for this round." />
              </div>
            </article>;
          })}
        </div> : <section className={styles.emptyState}><span>02</span><div><strong>No practice rounds yet</strong><p>Complete a drill in Phase 2 to see your results and compare future rounds.</p></div></section>}

        <h2 className={styles.sectionTitle}>Phase 1 calibrations</h2>
        {busy ? null : history.calibrations.length ? <div className={styles.historyList}>
          {history.calibrations.map((entry) => {
            const data = (entry.data as Record<string, any> | undefined) ?? {};
            const swipes = Array.isArray(data.swipeReadings) ? data.swipeReadings : [];
            const estimateReadings = Array.isArray(data.dpiReadings) ? data.dpiReadings : [];
            const didItems = [
              recordedDetail("Game", data.selectedGame, (value) => String(value).toUpperCase()),
              recordedDetail("Mouse DPI", data.dpi, (value) => `${displayValue(value)} DPI`),
              recordedDetail("DPI entry", data.dpiChoice, (value) => value === "known" ? "Entered manually" : String(value)),
              estimateReadings.length ? { label: "DPI estimate swipe readings", value: estimateReadings.map((value: unknown) => `${displayValue(value)} counts`).join(" · ") } : null,
              swipes.length ? { label: "Comfortable swipe readings", value: swipes.map((value: unknown) => `${displayValue(value)} counts`).join(" · ") } : null,
              recordedDetail("Calibration movement", data.sweepCounts, (value) => `${displayValue(value)} counts (180°)`),
              recordedDetail("Calibration state", data.phase),
            ].filter((item): item is Detail => item !== null);
            return <article className={styles.entry} key={String(entry.id)}>
              <div className={styles.historyEntryHead}><h3>{String(data.selectedGame ?? "Game").toUpperCase()} · CALIBRATION</h3><span>{dateLabel(entry.created_at ?? entry.createdAt)}</span></div>
              <div className={styles.historyColumns}>
                <DetailsPanel title="What you did" items={didItems} />
                <DetailsPanel title="Results" items={calibrationResults(data)} />
              </div>
            </article>;
          })}
        </div> : <section className={styles.emptyState}><span>01</span><div><strong>No calibrations yet</strong><p>Complete Phase 1 to save your measurements and recommended sensitivity settings.</p></div></section>}
      </div>
    </main>
  );
}
