"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { DRILL_CONFIG } from "../lib/drillConfig";
import type { DrillState, DrillType, RoundResult } from "./drill/model";
import { emptyState } from "./drill/model";
import { metricLabel, metricValue } from "./drill/metricFormat";
import { useDrillEngine } from "./drill/useDrillEngine";
import { replayMovementStyleRecording, type MovementStyleEstimate } from "../lib/metrics/style";
import styles from "./page.module.css";
import { useAuth } from "./AuthProvider";
import { DEFAULT_PLAYER_DATA, loadPlayerData, rememberRound, savePlayerData, writePlayerDataLocally, type PlayerData } from "../lib/playerData";
import { apiRequest } from "../lib/apiClient";
import ReactionTest, { ReactionTestLauncher } from "./ReactionTest";

export default function DrillSuite({
  baselineCounts,
  candidateLabel,
  gameDpi,
  conversionVerified,
}: {
  baselineCounts: number;
  candidateLabel: string | null;
  gameDpi: number | null;
  conversionVerified: boolean;
}) {
  const { user, token, loading: authLoading } = useAuth();
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [saveNotice, setSaveNotice] = useState("");
  const [loadedPlayerData, setLoadedPlayerData] = useState<PlayerData>(DEFAULT_PLAYER_DATA);
  const savedRoundIds = useRef(new Set<string>());

  const [phase, setPhase] = useState<DrillState["phase"]>("idle");
  const [panelOpen, setPanelOpen] = useState(false);
  const [reactionOpen, setReactionOpen] = useState(false);
  const [drillType, setDrillType] = useState<DrillType>("flick");
  const [trackingSpeed, setTrackingSpeed] = useState(0.55);
  const trackingSpeedRef = useRef(0.55);
  const [countdown, setCountdown] = useState(0);
  const [points, setPoints] = useState(0);
  const [accuracy, setAccuracy] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [crosshairShape, setCrosshairShape] = useState<"plus" | "dot" | "ring">("plus");
  const [crosshairColor, setCrosshairColor] = useState("#b8ff43");
  const [crosshairSize, setCrosshairSize] = useState(22);
  const [crosshairGap, setCrosshairGap] = useState(5);
  const [result, setResult] = useState<RoundResult | null>(null);
  const [history, setHistory] = useState<RoundResult[]>([]);
  const [error, setError] = useState("");
  const [replayJson, setReplayJson] = useState("");
  const [replayEstimate, setReplayEstimate] = useState<MovementStyleEstimate | null>(null);
  const [replayError, setReplayError] = useState("");
  const engine = useDrillEngine({
    baselineCounts,
    candidateLabel,
    gameDpi,
    getTrackingSpeed: () => trackingSpeedRef.current,
    setAccuracy,
    setPanelOpen,
    setResult,
    setHistory,
    setPhase,
    setPoints,
    setCountdown,
    setError,
  });
  const { hostRef, cameraRef, stateRef, scoreRef } = engine;

  useEffect(() => {
    if (authLoading) return;
    let active = true;
    void loadPlayerData(token, user?.id ?? null).then((data) => {
      if (!active) return;
      setLoadedPlayerData(data);
      setDrillType(data.practice.drillType);
      setTrackingSpeed(data.practice.trackingSpeed);
      trackingSpeedRef.current = data.practice.trackingSpeed;
      setCrosshairShape(data.practice.crosshairShape);
      setCrosshairColor(data.practice.crosshairColor);
      setCrosshairSize(data.practice.crosshairSize);
      setCrosshairGap(data.practice.crosshairGap);
      setPreferencesReady(true);
    });
    return () => { active = false; };
  }, [authLoading, token, user?.id]);

  useEffect(() => {
    if (!preferencesReady || !user || !token) return;
    const preferences = { drillType, trackingSpeed, crosshairShape, crosshairColor, crosshairSize, crosshairGap };
    const current: PlayerData = { ...loadedPlayerData, practice: preferences };
    writePlayerDataLocally(current, user?.id ?? null);
    const timer = window.setTimeout(() => { void savePlayerData(current, token, user?.id ?? null).catch(() => {}); }, 400);
    return () => window.clearTimeout(timer);
  }, [preferencesReady, loadedPlayerData, token, user?.id, drillType, trackingSpeed, crosshairShape, crosshairColor, crosshairSize, crosshairGap]);

  useEffect(() => {
    if (!result || !user || !token || savedRoundIds.current.has(result.id)) return;
    savedRoundIds.current.add(result.id);
    const record = {
      ...result,
      savedAt: Date.now(),
      ownerId: user.id,
      game: candidateLabel?.split(/[ · ]/)[0] ?? "unknown",
      settings: { candidateLabel, gameDpi, baselineCounts, drillType: result.drill, trackingSpeed, crosshairShape, crosshairColor, crosshairSize, crosshairGap },
    };
    rememberRound(record);
    void apiRequest("/rounds", token, { method: "POST", body: JSON.stringify({ id: result.id, data: record }) })
      .then(() => setSaveNotice("Round saved to your account."))
      .catch(() => setSaveNotice("Round saved in this browser. It will sync after sign-in."));
  }, [result, token, user?.id, candidateLabel, gameDpi, baselineCounts, drillType, trackingSpeed, crosshairShape, crosshairColor, crosshairSize, crosshairGap]);



  const startRound = () => {
    if (baselineCounts <= 0 || !candidateLabel || !gameDpi) return;
    const host = hostRef.current;
    const canvas = host?.querySelector("canvas");
    if (!canvas) return;
    const session = emptyState();
    session.phase = "countdown";
    session.type = drillType;
    session.countdownEndsAt = performance.now() + DRILL_CONFIG.countdownSeconds * 1000;
    stateRef.current = session;
    cameraRef.current?.rotation.set(0, 0, 0, "YXZ");
    scoreRef.current = { hits: 0, attempts: 0 };
    setResult(null);
    setReplayEstimate(null);
    setReplayError("");
    setPanelOpen(false);
    setError("");
    setCountdown(DRILL_CONFIG.countdownSeconds);
    setPoints(0);
    setAccuracy(0);
    setPhase("countdown");
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      void document.documentElement.requestFullscreen().catch(() => {
        setError("Fullscreen was blocked. Use the expand control to enter fullscreen.");
      });
    }
    void (canvas as HTMLCanvasElement).requestPointerLock({ unadjustedMovement: true }).catch(() => {
      setError("Click inside the range to capture the mouse. The drill countdown will continue.");
    });
  };

  const exportLastRound = () => {
    if (!result?.movementStyleEstimate || result.drill !== "flick") return;
    const recording = {
      version: 1,
      mouseSamples: result.mouseSamples,
      clickTimes: result.clickTimes,
      flickAttempts: result.flickAttempts ?? [],
      dpi: result.gameDpi,
      cm360: result.cm360,
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(recording, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `senslab-flick-${new Date().toISOString().replaceAll(":", "-")}.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const replayRecording = () => {
    try {
      setReplayEstimate(replayMovementStyleRecording(replayJson));
      setReplayError("");
    } catch (cause) {
      setReplayEstimate(null);
      setReplayError(cause instanceof Error ? cause.message : "Could not replay this recording.");
    }
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else if (document.documentElement.requestFullscreen) {
      void document.documentElement.requestFullscreen().catch(() => setError("Fullscreen is not available in this browser."));
    }
  };

  useEffect(() => {
    const updateFullscreen = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", updateFullscreen);
    updateFullscreen();
    return () => document.removeEventListener("fullscreenchange", updateFullscreen);
  }, []);

  useEffect(() => {
    if (phase !== "countdown") return;
    const timer = window.setInterval(() => {
      const session = stateRef.current;
      if (session.phase === "countdown") {
        setCountdown(Math.max(0, Math.ceil((session.countdownEndsAt - performance.now()) / 1000)));
      }
    }, 100);
    return () => window.clearInterval(timer);
  }, [phase]);

  return (
    <section className={styles.drillSection} id="phase2" data-phase={phase} data-panel-open={panelOpen}>
      <button className={styles.fullscreenButton} type="button" onClick={toggleFullscreen} aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}>
        {isFullscreen ? "Exit fullscreen" : "Fullscreen"}
      </button>
      {!panelOpen && phase !== "countdown" && phase !== "active" && (
        <div className={styles.rangeDock}>
          <span className={styles.rangeDockDrill}>{drillType === "flick" ? "Flick · 30 sec" : drillType === "tracking" ? "Tracking · 20 sec" : "Precision · 30 sec"}</span>
          <Link className={styles.dockSensitivityButton} href="/calibrate">Change sensitivity</Link>
          <button className={styles.dockStartButton} type="button" onClick={startRound} disabled={baselineCounts <= 0 || !candidateLabel}>Start</button>
          <button className={styles.dockSettingsButton} type="button" onClick={() => setPanelOpen(true)} aria-expanded={false}>Setup</button>
        </div>
      )}
      <aside className={styles.drillSidebar}>
        <div className={styles.sidebarHeader}>
          <span>Range setup</span>
          <button type="button" onClick={() => setPanelOpen(false)} aria-label="Minimize range setup">Minimize</button>
        </div>
        <div className={styles.drillControls}>
          {candidateLabel && gameDpi !== null && (
            <p className={styles.resultLine}>
              Practice starting point: {candidateLabel} at {gameDpi} DPI. {conversionVerified
                ? "Set the verified game value manually in your mouse app and game."
                : "The in-game sensitivity conversion is not verified; no game value is provided."}
            </p>
          )}
          <p className={styles.soundNote}>
            <span className={styles.soundHit}>●</span> Hit sound <span className={styles.soundMiss}>●</span> Miss sound
          </p>
          <details className={styles.crosshairSettings}>
            <summary>Customize your crosshair</summary>
            <div className={styles.crosshairControls}>
              <label>
                Shape
                <select value={crosshairShape} onChange={(event) => setCrosshairShape(event.target.value as typeof crosshairShape)}>
                  <option value="plus">Plus</option>
                  <option value="dot">Dot</option>
                  <option value="ring">Ring</option>
                </select>
              </label>
              <label>
                Color
                <select value={crosshairColor} onChange={(event) => setCrosshairColor(event.target.value)}>
                  <option value="#b8ff43">Lime</option>
                  <option value="#42e8ff">Cyan</option>
                  <option value="#ffffff">White</option>
                  <option value="#ffcf4a">Amber</option>
                  <option value="#ff5f72">Coral</option>
                </select>
              </label>
              <label>
                Size <strong>{crosshairSize}px</strong>
                <input type="range" min="12" max="36" value={crosshairSize} onChange={(event) => setCrosshairSize(Number(event.target.value))} />
              </label>
              <label>
                Gap <strong>{crosshairGap}px</strong>
                <input type="range" min="0" max="12" value={crosshairGap} onChange={(event) => setCrosshairGap(Number(event.target.value))} />
              </label>
            </div>
          </details>
          <label className={styles.inputLabel} htmlFor="drill">
            Choose a drill
          </label>
          <select id="drill" value={drillType} onChange={(event) => setDrillType(event.target.value as DrillType)} disabled={phase === "active" || phase === "countdown"}>
            <option value="flick">Multi-target flick - 30 seconds</option>
            <option value="tracking">Tracking - 20 seconds</option>
            <option value="precision">Precision - 30 seconds · small targets</option>
          </select>
          <ReactionTestLauncher onLaunch={() => setReactionOpen(true)} />
          {drillType === "tracking" && (
            <label className={styles.inputLabel} htmlFor="tracking-speed">
              Target speed
              <select
                id="tracking-speed"
                value={trackingSpeed}
                disabled={phase === "active" || phase === "countdown"}
                onChange={(event) => {
                  const speed = Number(event.target.value);
                  setTrackingSpeed(speed);
                  trackingSpeedRef.current = speed;
                }}
              >
                {DRILL_CONFIG.tracking.speedLevels.map((level) => (
                  <option key={level.label} value={level.multiplier}>
                    {level.label} ({level.multiplier}×)
                  </option>
                ))}
              </select>
            </label>
          )}
          {phase === "idle" || phase === "results" ? (
            <button className={styles.primaryButton} onClick={startRound} disabled={baselineCounts <= 0 || !candidateLabel}>
              Start {DRILL_CONFIG.countdownSeconds}-second instruction countdown
            </button>
          ) : (
            <p className={styles.activeTask}>
              {phase === "countdown"
                ? `Get ready: ${countdown}`
                : drillType === "tracking"
                ? `Track the target - ${countdown} seconds left`
                : `${countdown} seconds left - aim and shoot`
              }
            </p>
          )}
          {baselineCounts <= 0 && <p className={styles.hint}>Complete Phase 1 and choose a sensitivity to unlock practice.</p>}
          {phase === "countdown" && (
            <p className={styles.hint}>
              {drillType === "flick"
                ? "Multi-target flick: shoot one of three targets to respawn it elsewhere."
                : drillType === "tracking"
                ? "Keep your crosshair on the moving target; do not click."
                : "Micro-adjust onto each distant small target, then click to fire."}
            </p>
          )}
          {error && <p className={styles.error}>{error}</p>}
        </div>
        {result && (
          <section className={styles.results}>
            <p className={styles.step}>
              {result.drill[0].toUpperCase() + result.drill.slice(1)} results - {result.candidateLabel} at {result.gameDpi} DPI
            </p>
            {result.drill === "flick" && result.movementStyleEstimate && (
              <div className={styles.movementStyleResult}>
                <div className={styles.movementStyleComparison}>
                  <div>
                    <span>Measured mouse movement · {result.movementStyleEstimate.cm360.toFixed(1)} cm/360</span>
                    <strong>
                      {result.movementStyleEstimate.status === "uncalibrated"
                        ? result.movementStyleEstimate.medianDistanceCm === null
                          ? "No mouse travel recorded"
                          : `${result.movementStyleEstimate.medianDistanceCm.toFixed(1)} cm median travel per flick`
                        : result.movementStyleEstimate.status === "not enough data"
                        ? "Not enough flicks to summarize"
                        : `${result.movementStyleEstimate.breakdown!.smallPercent}% small, ${result.movementStyleEstimate.breakdown!.mediumPercent}% medium, ${result.movementStyleEstimate.breakdown!.largePercent}% large`}
                    </strong>
                    {result.movementStyleEstimate.status === "uncalibrated" && (
                      <span>Small, medium, and large categories need real player calibration data.</span>
                    )}
                    {result.movementStyleEstimate.breakdown?.mixed && <span>mixed (both small and large movements)</span>}
                  </div>
                </div>
                <p>This is an estimate from your mouse movement, not a guarantee of how you hold the mouse.</p>
                <small>
                  Median per flick: {result.movementStyleEstimate.medianDistanceCm?.toFixed(1) ?? "—"} cm · {result.movementStyleEstimate.medianPeakSpeedCmPerSecond?.toFixed(1) ?? "—"} cm/s · {result.movementStyleEstimate.medianCorrections?.toFixed(1) ?? "—"} corrections
                </small>
              </div>
            )}
            {Object.entries(result.metrics).map(([key, value]) => (
              <div className={styles.resultRow} key={key}>
                <strong>{metricLabel(key)}</strong>
                <span>{metricValue(key, value)}</span>
              </div>
            ))}
            <p className={styles.hint}>
              Raw data saved in memory for this page session: {result.mouseSamples.length} mouse samples and {result.clickTimes.length} click times.
            </p>
            {process.env.NODE_ENV === "development" && result.drill === "flick" && (
              <section className={styles.movementStyleReplay}>
                <button className={styles.secondaryButton} onClick={exportLastRound}>Export last round as JSON</button>
                <details>
                  <summary>Replay a saved flick recording (development)</summary>
                  <input type="file" accept="application/json,.json" onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (file) setReplayJson(await file.text());
                  }} />
                  <textarea aria-label="Flick recording JSON" rows={4} value={replayJson} onChange={(event) => setReplayJson(event.target.value)} placeholder="Or paste exported JSON here" />
                  <button className={styles.secondaryButton} onClick={replayRecording} disabled={!replayJson.trim()}>Replay estimate</button>
                  {replayError && <p className={styles.error}>{replayError}</p>}
                  {replayEstimate && <p className={styles.hint}>Estimate: {replayEstimate.status === "calibrated" && replayEstimate.breakdown
                    ? `${replayEstimate.breakdown.smallPercent}% small, ${replayEstimate.breakdown.mediumPercent}% medium, ${replayEstimate.breakdown.largePercent}% large`
                    : replayEstimate.status === "uncalibrated" ? "uncalibrated" : "not enough data"} · {replayEstimate.validFlickCount} flicks · {replayEstimate.cm360.toFixed(1)} cm/360</p>}
                </details>
              </section>
            )}
            <button className={styles.secondaryButton} onClick={() => { setPhase("idle"); setResult(null); setPanelOpen(false); }}>
              Close results
            </button>
          </section>
        )}
        {history.length > 0 && (
          <section className={styles.drillHistory}>
            <p className={styles.step}>Practice history - compare settings you tried</p>
            {history.map((round, index) => (
              <p className={styles.hint} key={`${round.startedAt}-${index}`}>
                {round.candidateLabel} at {round.gameDpi} DPI - {round.drill} -{" "}
                {Object.entries(round.metrics)
                  .filter(([key]) => key === "hitRatePercent" || key === "onTargetPercent" || key === "meanAngularErrorDeg")
                  .map(([key, value]) => `${metricLabel(key)} ${metricValue(key, value)}`)
                  .join(" · ")}
              </p>
            ))}
          </section>
        )}
        <p className={styles.hint}>{saveNotice || `Completed rounds in this session: ${history.length}. ${user ? "Rounds are saved to your account." : "Rounds are not saved while signed out."}`}</p>
      </aside>
      <div className={styles.drillRange} ref={hostRef} aria-label="SensLab measured drill range">
        <div className={styles.drillHud}>
          <div><span>POINTS</span><strong>{points}</strong></div>
          <div><span>ACCURACY</span><strong>{accuracy.toFixed(1)}%</strong></div>
          <div><span>DRILL</span><strong>{phase === "countdown" ? `READY ${countdown}` : drillType.toUpperCase()}</strong></div>
          <div><span>TIME LEFT</span><strong>{`${countdown}s`}</strong></div>
        </div>
        <div
          className={styles.drillCrosshair}
          data-shape={crosshairShape}
          style={{ "--crosshair-color": crosshairColor, "--crosshair-size": `${crosshairSize}px`, "--crosshair-gap": `${crosshairGap}px` } as CSSProperties}
          aria-hidden="true"
        >
          <span /><span /><span /><span /><span />
        </div>
        {phase === "idle" && <div className={styles.scenePrompt}>CHOOSE A DRILL AND CLICK START</div>}
        {phase === "countdown" && <div className={styles.scenePrompt}>GET GET READY · {countdown}</div>}
        {phase === "active" && <div className={styles.sceneLabel}>{drillType === "tracking" ? "KEEP YOUR CROSSHAIR ON TARGET" : "AIM AND SHOOT THE TARGETS"}</div>}
        {reactionOpen && <ReactionTest onClose={() => setReactionOpen(false)} />}
      </div>
    </section>
  );
}
