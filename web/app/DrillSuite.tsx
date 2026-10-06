"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { DRILL_CONFIG } from "../lib/drillConfig";
import type { DrillState, DrillType, RoundResult } from "./drill/model";
import { emptyState } from "./drill/model";
import { metricLabel, metricValue } from "./drill/metricFormat";
import { useDrillEngine } from "./drill/useDrillEngine";
import styles from "./page.module.css";

export default function DrillSuite({
  baselineCounts,
  candidateLabel,
  gameDpi,
}: {
  baselineCounts: number;
  candidateLabel: string | null;
  gameDpi: number | null;
}) {

  const [phase, setPhase] = useState<DrillState["phase"]>("idle");
  const [panelOpen, setPanelOpen] = useState(false);
  const [drillType, setDrillType] = useState<DrillType>("flick");
  const [trackingSpeed, setTrackingSpeed] = useState(0.55);
  const trackingSpeedRef = useRef(0.55);
  const [countdown, setCountdown] = useState(0);
  const [targetNumber, setTargetNumber] = useState(0);
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
    setTargetNumber,
    setError,
  });
  const { hostRef, cameraRef, stateRef, scoreRef } = engine;



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
    setTargetNumber(0);
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
      <nav className={styles.phaseNav} aria-label="App phases">
        <button
          className={styles.phaseChip}
          type="button"
          onClick={() => {
            if (document.referrer.startsWith(window.location.origin)) window.history.back();
            else window.location.assign("/");
          }}
        >
          <em>01</em> Setup
        </button>
        <span className={`${styles.phaseChip} ${styles.phaseChipActive}`}>
          <em>02</em> Practice
        </span>
      </nav>
      <button className={styles.fullscreenButton} type="button" onClick={toggleFullscreen} aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}>
        {isFullscreen ? "Exit fullscreen" : "Fullscreen"}
      </button>
      <div className={styles.drillIntro}>
        <span className={styles.logoMark} aria-hidden="true">SL</span>
        <div>
          <p className={styles.eyebrow}>Phase 2 · measured drills</p>
          <h2>Practice and see what happened</h2>
          <p className={styles.hint}>SensLab training bay <span className={styles.introDivider}>/</span> Tune your reticle, then practice your Phase 1 setting.</p>
        </div>
      </div>
      {!panelOpen && phase !== "countdown" && phase !== "active" && (
        <div className={styles.rangeDock}>
          <span className={styles.rangeDockDrill}>{drillType === "flick" ? "Flick · 30 targets" : drillType === "tracking" ? "Tracking · 20 sec" : "Precision · 20 targets"}</span>
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
              Selected practice setting: {candidateLabel} at {gameDpi} DPI. Set these values manually in your mouse app and game.
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
            <option value="flick">Flick - 30 targets (Gridshot)</option>
            <option value="tracking">Tracking - 20 seconds</option>
            <option value="precision">Precision - 20 small targets</option>
          </select>
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
                : `Target ${targetNumber} of ${drillType === "flick" ? DRILL_CONFIG.flick.targetCount : DRILL_CONFIG.precision.targetCount} - aim and shoot`
              }
            </p>
          )}
          {baselineCounts <= 0 && <p className={styles.hint}>Complete Phase 1 and choose a sensitivity to unlock practice.</p>}
          {phase === "countdown" && (
            <p className={styles.hint}>
              {drillType === "flick"
                ? "Gridshot mode: 3 active targets on wide grid. Shoot a target to instantly respawn it."
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
            {Object.entries(result.metrics).map(([key, value]) => (
              <div className={styles.resultRow} key={key}>
                <strong>{metricLabel(key)}</strong>
                <span>{metricValue(key, value)}</span>
              </div>
            ))}
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
        <p className={styles.hint}>Completed rounds kept in this browser session: {history.length}. They are not sent to the API or saved after leaving the page.</p>
      </aside>
      <div className={styles.drillRange} ref={hostRef} aria-label="SensLab measured drill range">
        <div className={styles.drillHud}>
          <div><span>POINTS</span><strong>{points}</strong></div>
          <div><span>ACCURACY</span><strong>{accuracy.toFixed(1)}%</strong></div>
          <div><span>DRILL</span><strong>{phase === "countdown" ? `READY ${countdown}` : drillType.toUpperCase()}</strong></div>
          <div><span>{drillType === "flick" ? "HITS" : "PROGRESS"}</span><strong>{drillType === "tracking" ? `${countdown}s` : `${targetNumber}/${drillType === "flick" ? DRILL_CONFIG.flick.targetCount : DRILL_CONFIG.precision.targetCount}`}</strong></div>
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
      </div>
    </section>
  );
}
