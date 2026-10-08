"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import Image from "next/image";
import { DRILL_CONFIG } from "../lib/drillConfig";
import type { DrillState, DrillType, RoundResult } from "./drill/model";
import { emptyState } from "./drill/model";
import { metricLabel, metricValue } from "./drill/metricFormat";
import { useDrillEngine } from "./drill/useDrillEngine";
import styles from "./page.module.css";
import { useAuth } from "./AuthProvider";
import { DEFAULT_PLAYER_DATA, loadPlayerData, rememberRound, savePlayerData, writePlayerDataLocally, type PlayerData } from "../lib/playerData";
import { apiRequest } from "../lib/apiClient";
import ReactionTest, { ReactionTestLauncher } from "./ReactionTest";
import reactionStyles from "./reaction.module.css";

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
    void (canvas as HTMLCanvasElement).requestPointerLock({ unadjustedMovement: true }).catch(() => {});
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
    <section className={styles.drillSection} id="phase2" data-phase={phase} data-panel-open={panelOpen} data-reaction-open={reactionOpen}>
      <nav className={styles.topBar} aria-label="SensLab navigation">
        <Link className={styles.topBarBrand} href="/" aria-label="SensLab home"><Image className={styles.topBarLogo} src="/senslab-minimal-logo.png" alt="" width={38} height={30} /></Link>
        <Link className={styles.topBarLink} href="/calibrate"><em>01</em> Calibrate</Link>
        <Link className={`${styles.topBarLink} ${styles.topBarLinkActive}`} href="/practice" aria-current="page"><em>02</em> Practice</Link>
        <Link className={styles.topBarLink} href="/history">History</Link>
      </nav>
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
            <span className={styles.soundHit} aria-hidden="true" /> Hit sound <span className={styles.soundMiss} aria-hidden="true" /> Miss sound
          </p>
          <details className={styles.crosshairSettings}>
            <summary>
              <span className={styles.crosshairSummaryIcon} aria-hidden="true" />
              <span className={styles.crosshairSummaryText}>Customize your crosshair<small>Shape, color and size</small></span>
              <span className={styles.crosshairSummaryToggle} aria-hidden="true" />
            </summary>
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
                <input type="range" min="8" max="48" value={crosshairSize} onChange={(event) => setCrosshairSize(Number(event.target.value))} />
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
                <span>{result.drill === "precision" && key === "meanTimeToHitMs" ? `${value.toFixed(0)} ms` : metricValue(key, value)}</span>
              </div>
            ))}
            {result.drill === "flick" && (
              <p className={styles.hint}>The first number shows how far your aim went past a target. The second shows how far it stopped short. Smaller numbers mean closer aim.</p>
            )}
            <p className={styles.hint}>
              Raw data saved in memory for this page session: {result.mouseSamples.length} mouse samples and {result.clickTimes.length} click times.
            </p>
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
          style={{ "--crosshair-color": crosshairColor, "--crosshair-size": `${crosshairSize}px`, "--crosshair-gap": `${crosshairGap}px`, "--crosshair-dot-size": `${Math.max(3, Math.round(crosshairSize / 4))}px` } as CSSProperties}
          aria-hidden="true"
        >
          <span /><span /><span /><span /><span />
        </div>
        {phase === "idle" && <div className={styles.scenePrompt}>CLICK SETUP, CHOOSE A DRILL, THEN CLICK START</div>}
        {phase === "countdown" && <div className={styles.scenePrompt}>GET GET READY · {countdown}</div>}
        {phase === "active" && <div className={styles.sceneLabel}>{drillType === "tracking" ? "KEEP YOUR CROSSHAIR ON TARGET" : "AIM AND SHOOT THE TARGETS"}</div>}
        {reactionOpen && (
          <div className={reactionStyles.reactionScene}>
            <ReactionTest onClose={() => setReactionOpen(false)} />
          </div>
        )}
      </div>
    </section>
  );
}
