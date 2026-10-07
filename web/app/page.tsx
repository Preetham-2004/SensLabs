"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import * as THREE from "three";
import { GAME_PROFILES, type GameId } from "../lib/gameProfiles";
import { gameSensitivityForCm360 } from "../lib/sensitivity";
import { assessSensitivityConfidence } from "../lib/resultAssessment";
import styles from "./page.module.css";
import { useAuth } from "./AuthProvider";
import { DEFAULT_PLAYER_DATA, loadPlayerData, readLocalPlayerData, savePlayerData, writePlayerDataLocally, type Phase1Snapshot } from "../lib/playerData";
import AccountLinks from "./AccountLinks";

const CARD_WIDTH_CM = 8.56;
const SENSITIVITY_CANDIDATES = [
  { id: "lower", label: "Lower", factor: 0.88, hint: "Slower turns, more mouse movement" },
  { id: "medium", label: "Medium", factor: 1, hint: "Matches your measured comfortable turn" },
  { id: "higher", label: "Higher", factor: 1.12, hint: "Faster turns, less mouse movement" },
] as const;
const SENSITIVITY_ADJUSTMENT_STEP = 0.02;
const MAX_SENSITIVITY_ADJUSTMENT_STEPS = 25;
type Phase = "setup" | "sweep" | "done" | "dpi";
type DpiChoice = "unanswered" | "known";
export default function Home() {
  const { user, token, loading: authLoading } = useAuth();
  const [stateReady, setStateReady] = useState(false);
  const viewRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef({
    phase: "setup" as Phase,
    sweepCounts: 0,
  });
  const dpiReadingsRef = useRef<number[]>([]);
  const swipeReadingsRef = useRef<number[]>([]);
  const captureMouseRef = useRef<() => void>(() => {});
  const [phase, setPhase] = useState<Phase>("setup");
  const [selectedGame, setSelectedGame] = useState<GameId>("cs2");
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [sensitivityAdjustmentSteps, setSensitivityAdjustmentSteps] = useState(0);
  const [dpiChoice, setDpiChoice] = useState<DpiChoice>("unanswered");
  const [sweepCounts, setSweepCounts] = useState(0);
  const [swipeReadings, setSwipeReadings] = useState<number[]>([]);
  const [dpi, setDpi] = useState<number | null>(null);
  const [dpiReadings, setDpiReadings] = useState<number[]>([]);
  const [dpiCounts, setDpiCounts] = useState(0);
  const [locked, setLocked] = useState(false);
  const [rawInput, setRawInput] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [calibrationId, setCalibrationId] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    let active = true;
    void loadPlayerData(token, user?.id ?? null).then((data) => {
      if (!active) return;
      const saved = data.calibration;
      const restoredPhase = saved.phase === "done" && saved.swipeReadings.length === 3 ? "done" : "setup";
      setPhase(restoredPhase);
      sessionRef.current.phase = restoredPhase;
      sessionRef.current.sweepCounts = saved.sweepCounts;
      setSelectedGame(saved.selectedGame);
      setSelectedCandidateId(restoredPhase === "done" ? saved.selectedCandidateId : null);
      setSensitivityAdjustmentSteps(saved.sensitivityAdjustmentSteps);
      setDpiChoice(saved.dpiChoice);
      setSweepCounts(saved.sweepCounts);
      swipeReadingsRef.current = saved.swipeReadings;
      setSwipeReadings(saved.swipeReadings);
      setDpi(saved.dpi);
      dpiReadingsRef.current = saved.dpiReadings;
      setDpiReadings(saved.dpiReadings);
      setDpiCounts(saved.dpiCounts);
      setCalibrationId(saved.calibrationId);
      setMessage(restoredPhase === "done" ? "Your saved calibration is ready. You can choose another sensitivity or return to practice." : "Your saved choices are ready to continue.");
      setStateReady(true);
    });
    return () => { active = false; };
  }, [authLoading, token, user?.id]);

  useEffect(() => {
    if (!stateReady) return;
    const snapshot: Phase1Snapshot = {
      phase, selectedGame, selectedCandidateId, sensitivityAdjustmentSteps,
      dpiChoice, sweepCounts, swipeReadings, dpi, dpiReadings, dpiCounts, calibrationId,
    };
    const current = { ...DEFAULT_PLAYER_DATA, ...readLocalPlayerData(), calibration: snapshot };
    writePlayerDataLocally(current, user?.id ?? null);
    const timer = window.setTimeout(() => { void savePlayerData(current, token, user?.id ?? null).catch(() => {}); }, 500);
    return () => window.clearTimeout(timer);
  }, [stateReady, token, user?.id, phase, selectedGame, selectedCandidateId, sensitivityAdjustmentSteps, dpiChoice, sweepCounts, swipeReadings, dpi, dpiReadings, dpiCounts, calibrationId]);

  useEffect(() => {
    dpiReadingsRef.current = dpiReadings;
  }, [dpiReadings]);

  useEffect(() => {
    const host = viewRef.current;
    if (!host) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#152334");
    scene.fog = new THREE.Fog("#152334", 16, 38);
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 100);
    camera.position.set(0, 1.65, 6);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    host.appendChild(renderer.domElement);
    scene.add(new THREE.HemisphereLight(0xe7fff8, 0x1a2c2a, 1.9));
    const light = new THREE.DirectionalLight(0xffffff, 2.4);
    light.position.set(-4, 8, 5);
    scene.add(light);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(18, 24),
      new THREE.MeshStandardMaterial({ color: 0x26384d, roughness: 0.88 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.z = -2;
    scene.add(floor);
    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x34465c, roughness: 0.92 });
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(18, 7, 0.3), wallMaterial);
    backWall.position.set(0, 3.5, -14);
    scene.add(backWall);
    for (const x of [-9, 9]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(0.3, 7, 24), wallMaterial);
      wall.position.set(x, 3.5, -2);
      scene.add(wall);
    }
    const lane = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 22), new THREE.MeshBasicMaterial({ color: 0x91b4bf }));
    lane.rotation.x = -Math.PI / 2;
    lane.position.set(0, 0.02, -2);
    scene.add(lane);
    const marker = new THREE.Mesh(new THREE.PlaneGeometry(8, 0.08), new THREE.MeshBasicMaterial({ color: 0x8da3b5 }));
    marker.rotation.x = -Math.PI / 2;
    marker.position.set(0, 0.025, -8);
    scene.add(marker);

    const resize = () => {
      if (!host.clientWidth || !host.clientHeight) return;
      camera.aspect = host.clientWidth / host.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(host.clientWidth, host.clientHeight);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    const canvas = renderer.domElement;
    const onMouseMove = (event: MouseEvent) => {
      if (document.pointerLockElement !== canvas) return;
      const session = sessionRef.current;
      const dx = event.movementX;

      if (session.phase === "sweep") {
        session.sweepCounts += Math.abs(dx);
        setSweepCounts(Math.round(session.sweepCounts));
        return;
      }
      if (session.phase === "dpi") {
        session.sweepCounts += Math.abs(dx);
        setDpiCounts(Math.round(session.sweepCounts));
        return;
      }
    };

    const saveDpiSwipe = (counts: number) => {
      if (counts < 20) {
        setErrorMessage("That swipe was too short to measure. Start again and move one full card length.");
        setPhase("setup");
        sessionRef.current.phase = "setup";
        return;
      }
      const next = [...dpiReadingsRef.current, counts].slice(-3);
      dpiReadingsRef.current = next;
      setDpiReadings(next);
      setDpiCounts(counts);
      if (next.length === 3) {
        const middleCounts = [...next].sort((a, b) => a - b)[1];
        setDpi(Math.round(middleCounts / (CARD_WIDTH_CM / 2.54)));
        setDpiChoice("known");
        setSweepCounts(0);
        swipeReadingsRef.current = [];
        setSwipeReadings([]);
        setSelectedCandidateId(null);
        setSensitivityAdjustmentSteps(0);
      }
      setErrorMessage("");
      setPhase("setup");
      sessionRef.current.phase = "setup";
    };

    const finishSweep = () => {
      const session = sessionRef.current;
      const count = Math.round(session.sweepCounts);
      if (count < 30) {
        setErrorMessage("That swipe was too short. Start again and use your full comfortable mousepad movement.");
        session.sweepCounts = 0;
        swipeReadingsRef.current = [];
        setSweepCounts(0);
        setSwipeReadings([]);
        session.phase = "setup";
        setPhase("setup");
        return;
      }
      const nextReadings = [...swipeReadingsRef.current, count].slice(-3);
      swipeReadingsRef.current = nextReadings;
      setSwipeReadings(nextReadings);
      if (nextReadings.length < 3) {
        session.sweepCounts = 0;
        setSweepCounts(0);
        setErrorMessage("");
        setMessage(`Swipe ${nextReadings.length} of 3 captured. Return your mouse to the starting edge, then start swipe ${nextReadings.length + 1}.`);
        return;
      }
      const medianCounts = [...nextReadings].sort((a, b) => a - b)[1];
      setSweepCounts(medianCounts);
      setSelectedCandidateId("medium");
      setSensitivityAdjustmentSteps(0);
      setCalibrationId(crypto.randomUUID());
      setMessage("Three swipes captured. SensLab used the middle measurement to reduce variation.");
      setErrorMessage("");
      session.phase = "done";
      setPhase("done");
    };

    const onLockChange = () => {
      const isLocked = document.pointerLockElement === canvas;
      setLocked(isLocked);
      const session = sessionRef.current;
      if (isLocked) return;
      if (session.phase === "sweep") finishSweep();
      else if (session.phase === "dpi") saveDpiSwipe(Math.round(session.sweepCounts));
    };

    const captureMeasurementMouse = () => {
      if (document.pointerLockElement === canvas) return;
      if (sessionRef.current.phase !== "sweep" && sessionRef.current.phase !== "dpi") return;

      void canvas.requestPointerLock({ unadjustedMovement: true })
        .then(() => setRawInput(true))
        .catch(() => {
          setRawInput(false);
          void canvas.requestPointerLock();
        });
    };
    captureMouseRef.current = captureMeasurementMouse;

    const onCanvasClick = () => {
      captureMeasurementMouse();
    };

    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("click", onCanvasClick);
    document.addEventListener("pointerlockchange", onLockChange);
    let frame = 0;
    const render = () => {
      renderer.render(scene, camera);
      frame = requestAnimationFrame(render);
    };
    render();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("click", onCanvasClick);
      document.removeEventListener("pointerlockchange", onLockChange);
      if (document.pointerLockElement === canvas) document.exitPointerLock();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
      renderer.dispose();
      renderer.domElement.parentElement?.removeChild(renderer.domElement);
    };
  }, []);

  const startSweep = () => {
    if (!validDpi) {
      setErrorMessage("Enter the DPI active on your mouse, or use the three-swipe estimate, to calculate game settings.");
      return;
    }
    const session = sessionRef.current;
    session.phase = "sweep";
    session.sweepCounts = 0;
    swipeReadingsRef.current = [];
    setSwipeReadings([]);
    setSweepCounts(0);
    setSelectedCandidateId(null);
    setSensitivityAdjustmentSteps(0);
    setErrorMessage("");
    setMessage("Measure the same straight, comfortable edge-to-edge swipe three times. Press Esc after each one.");
    setPhase("sweep");
  };

  const startDpiSwipe = () => {
    if (dpiReadings.length === 3) {
      dpiReadingsRef.current = [];
      setDpiReadings([]);
      setDpi(null);
    }
    const session = sessionRef.current;
    session.phase = "dpi";
    session.sweepCounts = 0;
    swipeReadingsRef.current = [];
    setSwipeReadings([]);
    setDpiCounts(0);
    setErrorMessage("");
    setMessage("Click Start estimate below, then click the chamber. One card length, then Esc to lock it.");
    setPhase("dpi");
  };

  const validDpi = dpi !== null && Number.isFinite(dpi) && dpi > 0 ? dpi : null;
  const gameProfile = GAME_PROFILES[selectedGame];
  const baseCm360 = validDpi && sweepCounts > 0 ? 2 * ((sweepCounts * 2.54) / validDpi) : null;
  const sensitivityAdjustment = 1 + sensitivityAdjustmentSteps * SENSITIVITY_ADJUSTMENT_STEP;
  const candidateSettings = baseCm360 && validDpi
    ? SENSITIVITY_CANDIDATES.map((candidate) => {
        const cm360 = baseCm360 / candidate.factor / sensitivityAdjustment;
        return {
          ...candidate,
          cm360,
          gameSensitivity: gameProfile.yawVerified && gameProfile.yawDegreesPerCountAtSensitivityOne !== null
            ? gameSensitivityForCm360(cm360, validDpi, gameProfile.yawDegreesPerCountAtSensitivityOne)
            : null,
        };
      })
    : [];
  const selectedCandidate = candidateSettings.find((candidate) => candidate.id === selectedCandidateId) ?? null;
  const lowerCandidate = candidateSettings.find((candidate) => candidate.id === "lower");
  const middleCandidate = candidateSettings.find((candidate) => candidate.id === "medium");
  const higherCandidate = candidateSettings.find((candidate) => candidate.id === "higher");
  const confidence = assessSensitivityConfidence({ calibrationSwipeCounts: swipeReadings });
  const practiceBaselineCounts = selectedCandidate && phase === "done" && sweepCounts > 0
    ? sweepCounts / selectedCandidate.factor / sensitivityAdjustment
    : 0;
  const practiceHref = selectedCandidate && validDpi
    ? { pathname: "/practice", query: {
        game: selectedGame,
        dpi: String(validDpi),
        ...(selectedCandidate.gameSensitivity === null ? {} : { sensitivity: selectedCandidate.gameSensitivity.toFixed(3) }),
        cm360: selectedCandidate.cm360.toFixed(2),
        baseline: String(practiceBaselineCounts),
      } }
    : null;
  const step1State = validDpi && phase !== "dpi" ? "done" : "current";
  const step2State = !validDpi || phase === "dpi" ? "idle" : phase === "sweep" || sweepCounts === 0 ? "current" : "done";
  const step3State = phase !== "done" ? "idle" : selectedCandidate ? "done" : "current";

  return (
    <main className={styles.page} data-phase={phase}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.logoMark} aria-hidden="true">SL</span>
          <div>
            <p className={styles.eyebrow}>SensLab</p>
            <h1>Find your sensitivity</h1>
          </div>
        </div>
        <nav className={styles.phaseNav} aria-label="App phases">
          <span className={`${styles.phaseChip} ${styles.phaseChipActive}`}><em>01</em> Setup</span>
          {practiceHref ? (
            <Link className={styles.phaseChip} href={practiceHref}><em>02</em> Practice</Link>
          ) : (
            <span className={styles.phaseChip} aria-disabled="true"><em>02</em> Practice</span>
          )}
        </nav>
        <div className={styles.status}><p>{locked ? `Mouse captured · ${rawInput ? "raw input" : "OS accel active"} · Esc to release` : `${GAME_PROFILES[selectedGame].name} · ready to calibrate`}</p><AccountLinks /></div>
      </header>

      <ol className={styles.stepper} aria-label="Phase 1 steps">
        <li className={styles.stepperItem} data-state={step1State}>
          <span>01</span>
          <div><strong>Game &amp; DPI</strong><p>{validDpi ? `${validDpi} DPI — dialed in` : "Select your title & sensor DPI"}</p></div>
        </li>
        <li className={styles.stepperItem} data-state={step2State}>
          <span>02</span>
          <div><strong>Natural swipe</strong><p>{sweepCounts > 0 && phase !== "sweep" ? `${sweepCounts.toLocaleString()} median counts captured` : `${swipeReadings.length}/3 repeated swipes`}</p></div>
        </li>
        <li className={styles.stepperItem} data-state={step3State}>
          <span>03</span>
          <div><strong>Choose your weapon</strong><p>{selectedCandidate ? `${selectedCandidate.label} — locked` : "Three settings. You decide."}</p></div>
        </li>
      </ol>

      <section className={styles.layout}>
        <div className={styles.range} ref={viewRef} aria-label="Neutral first-person mouse movement measurement range">
          <div className={styles.rangeBadge}>SensLab calibration chamber</div>
          <div className={styles.crosshair} aria-hidden="true"><span /><span /></div>
          {!locked && <div className={styles.enterHint} aria-hidden="true">{phase === "sweep" || phase === "dpi" ? "Click to engage" : "Set up your config, then lock in"}</div>}
        </div>

        <aside className={styles.panel}>
          <section className={styles.intro}>
            <p className={styles.eyebrow}>Phase 1 // Calibration</p>
            <h2>Zero in on your sens</h2>
            <p className={styles.hint}>Select your game and DPI, capture your natural swipe, then choose the setting that feels right.</p>
          </section>

          <section className={styles.task} data-state={step1State}>
            <p className={styles.step}><span>01</span> Game &amp; Sensor</p>
            <div className={styles.inlineFields}>
              <label className={styles.field}><span>GAME</span><select id="game" value={selectedGame} onChange={(event) => {
                setSelectedGame(event.target.value as GameId);
                setSweepCounts(0);
                swipeReadingsRef.current = [];
                setSwipeReadings([]);
                setSelectedCandidateId(null);
                setSensitivityAdjustmentSteps(0);
                sessionRef.current.phase = "setup";
                setPhase("setup");
              }}>
                <option value="cs2">CS2</option><option value="valorant">VALORANT</option>
              </select></label>
              <label className={styles.field}><span>MOUSE DPI</span><input id="dpi" type="number" min="100" max="40000" step="50" value={dpi ?? ""} placeholder="e.g. 800" onChange={(event) => {
                const value = event.target.value;
                const parsed = value === "" ? null : Number(value);
                const valid = parsed !== null && Number.isFinite(parsed) && parsed > 0 ? parsed : null;
                setDpi(valid);
                setDpiChoice(valid === null ? "unanswered" : "known");
                dpiReadingsRef.current = [];
                setDpiReadings([]);
                setSweepCounts(0);
                swipeReadingsRef.current = [];
                setSwipeReadings([]);
                setSelectedCandidateId(null);
                setSensitivityAdjustmentSteps(0);
                sessionRef.current.phase = "setup";
                setPhase("setup");
              }} /></label>
            </div>
            <p className={styles.hint}>{validDpi ? `Locked at ${validDpi} DPI. Keep this set in your mouse software.` : "Punch in the DPI from your mouse software to compute your settings."}</p>
            <details className={styles.dpiHelp}>
              <summary>No idea? Estimate it here</summary>
              <p className={styles.hint}>Check it in your mouse app first if possible. Otherwise use a standard card's long edge for three swipes. This estimates counts per inch; it cannot read your mouse sensor setting.</p>
              {phase === "dpi" ? (
                <p className={styles.activeTask}>Swipe one card length and press Esc. Counts: {dpiCounts}</p>
              ) : (
                <button className={styles.secondaryButton} onClick={startDpiSwipe}>{dpiReadings.length === 0 ? "Start 3-swipe DPI estimate" : dpiReadings.length === 3 ? "Measure DPI again" : `Continue estimate · swipe ${dpiReadings.length + 1}/3`}</button>
              )}
              {dpiReadings.length > 0 && <p className={styles.resultLine}>{dpiReadings.length} of 3 swipes saved{validDpi !== null && dpiReadings.length === 3 ? ` - estimated ${validDpi} DPI` : ""}</p>}
            </details>
          </section>

          <section className={styles.task} data-state={step2State}>
            <p className={styles.step}><span>02</span> Measure your swipe</p>
            <p className={styles.hint}>Repeat the same comfortable edge-to-edge mousepad swipe 3 times. SensLab treats that distance as a 180° turn and uses the middle count.</p>
            {phase === "sweep" ? (
              <div className={styles.activeTask}>
                <strong>{sweepCounts.toLocaleString()} movement counts</strong>
                <span>{swipeReadings.length} of 3 saved. Click the range to capture the mouse, make the same straight swipe, then press Esc. Repeat from the same starting edge.</span>
                {!locked && <button className={styles.primaryButton} onClick={() => captureMouseRef.current()}>Start swipe {swipeReadings.length + 1} of 3</button>}
              </div>
            ) : phase === "dpi" ? (
              <div className={styles.activeTask}>
                <strong>{dpiCounts.toLocaleString()} movement counts</strong>
                <span>Click the range to capture the mouse. Move one card length, then press Esc to save this swipe.</span>
                {!locked && <button className={styles.secondaryButton} onClick={() => captureMouseRef.current()}>Start estimate swipe</button>}
              </div>
            ) : (
              <button className={styles.primaryButton} onClick={startSweep} disabled={validDpi === null}>Measure 3 comfortable swipes</button>
            )}
            {sweepCounts > 0 && phase !== "sweep" && <p className={styles.resultLine}>Measured: {sweepCounts.toLocaleString()} counts = 180°</p>}
          </section>

          {message && <p className={styles.message} aria-live="polite">{message}</p>}
          {errorMessage && <p className={styles.error} role="alert">{errorMessage}</p>}

          {phase === "done" && (
            <section className={styles.task} data-state={step3State}>
              <p className={styles.step}><span>03</span> Pick a setting to practice</p>
              <p className={styles.hint}>Choose a starting point and try it in normal play.</p>
              {lowerCandidate && middleCandidate && higherCandidate && (
                <div className={styles.resultSummary}>
                  <p className={styles.resultEyebrow}>A good starting point</p>
                  <p className={styles.resultMiddle}>Start with <strong>{middleCandidate.gameSensitivity?.toFixed(3) ?? "Not verified"}</strong></p>
                  <div className={styles.gameConversion}>
                    <strong>{gameProfile.name} at {validDpi} DPI</strong>
                    {middleCandidate.gameSensitivity === null
                      ? <p>In-game sensitivity: <strong>Not verified yet</strong></p>
                      : <p>Middle setting: <strong>{middleCandidate.gameSensitivity.toFixed(3)}</strong></p>}
                  </div>
                  <p className={styles.weeklyAdvice}>Use this sensitivity for one week before changing it.</p>
                </div>
              )}
              <section className={styles.confidenceCard} aria-live="polite">
                <p>Calibration confidence: <strong>{confidence.level}</strong></p>
                {confidence.level === "Low" && <button className={styles.secondaryButton} onClick={startSweep}>Redo calibration</button>}
              </section>
              <details className={styles.whyResult}>
                <summary>Why this result?</summary>
                <p>SensLab counted three mouse swipes and used the middle result. Mouse or computer settings can affect the measurement.</p>
              </details>
              <div className={styles.sensitivityAdjustments}>
                <p className={styles.hint}>Fine-tune all three options in 2% steps. Your measured swipe remains the starting point.</p>
                <div className={styles.adjustmentButtons}>
                  <button className={styles.secondaryButton} onClick={() => setSensitivityAdjustmentSteps((steps) => Math.max(-MAX_SENSITIVITY_ADJUSTMENT_STEPS, steps - 1))} disabled={sensitivityAdjustmentSteps <= -MAX_SENSITIVITY_ADJUSTMENT_STEPS}>Lower</button>
                  <strong>{sensitivityAdjustmentSteps > 0 ? "+" : ""}{sensitivityAdjustmentSteps * 2}%</strong>
                  <button className={styles.secondaryButton} onClick={() => setSensitivityAdjustmentSteps((steps) => Math.min(MAX_SENSITIVITY_ADJUSTMENT_STEPS, steps + 1))} disabled={sensitivityAdjustmentSteps >= MAX_SENSITIVITY_ADJUSTMENT_STEPS}>Higher</button>
                </div>
                {sensitivityAdjustmentSteps !== 0 && <button className={styles.resetAdjustment} onClick={() => setSensitivityAdjustmentSteps(0)}>Reset adjustment</button>}
              </div>
              <div className={styles.candidateList}>
                {candidateSettings.map((candidate) => (
                  <article className={`${styles.candidateCard} ${selectedCandidateId === candidate.id ? styles.candidateCardSelected : ""}`} key={candidate.id}>
                    <span>{candidate.label}</span>
                    <strong>{candidate.gameSensitivity?.toFixed(3) ?? "Not verified"}</strong>
                    {candidate.gameSensitivity === null
                      ? <p>{gameProfile.name} conversion: not verified yet</p>
                      : <p>{gameProfile.name}: {candidate.gameSensitivity.toFixed(3)} at {validDpi} DPI</p>}
                    <button className={selectedCandidateId === candidate.id ? styles.secondaryButton : styles.primaryButton} onClick={() => setSelectedCandidateId(candidate.id)}>
                      {selectedCandidateId === candidate.id ? "Selected for practice" : "Choose this setting"}
                    </button>
                  </article>
                ))}
              </div>
              {selectedCandidate && practiceHref && <div className={styles.recommendation}>
                <span>Your Phase 2 starting point</span>
                <strong>{gameProfile.name}: {selectedCandidate.gameSensitivity?.toFixed(3) ?? "Not verified"} at {validDpi} DPI</strong>
                <p>{selectedCandidate.gameSensitivity === null
                  ? `SensLab cannot show a game value for ${gameProfile.name} yet.`
                  : `Set this sensitivity in ${gameProfile.name} and try it for a week.`}</p>
                <Link className={styles.primaryButton} href={practiceHref}>Enter the practice range</Link>
              </div>}
              <button className={styles.secondaryButton} onClick={startSweep}>Measure my swipe again</button>
            </section>
          )}

        </aside>
      </section>
    </main>
  );
}
