"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import DrillSuite from "./DrillSuite";
import { GAME_PROFILES, type GameId } from "../lib/gameProfiles";
import { gameSensitivityForCm360 } from "../lib/sensitivity";
import styles from "./page.module.css";

const CARD_WIDTH_CM = 8.56;
const SENSITIVITY_CANDIDATES = [
  { id: "lower", label: "Lower", factor: 0.88, hint: "Slower turns, more mouse movement" },
  { id: "medium", label: "Middle", factor: 1, hint: "Matches your measured comfortable turn" },
  { id: "higher", label: "Higher", factor: 1.12, hint: "Faster turns, less mouse movement" },
] as const;
type Phase = "setup" | "sweep" | "done" | "dpi";
type DpiChoice = "unanswered" | "known";
export default function Home() {
  const viewRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef({
    phase: "setup" as Phase,
    sweepCounts: 0,
  });
  const dpiReadingsRef = useRef<number[]>([]);
  const captureMouseRef = useRef<() => void>(() => {});
  const [phase, setPhase] = useState<Phase>("setup");
  const [selectedGame, setSelectedGame] = useState<GameId>("cs2");
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [dpiChoice, setDpiChoice] = useState<DpiChoice>("unanswered");
  const [sweepCounts, setSweepCounts] = useState(0);
  const [dpi, setDpi] = useState<number | null>(null);
  const [dpiReadings, setDpiReadings] = useState<number[]>([]);
  const [dpiCounts, setDpiCounts] = useState(0);
  const [locked, setLocked] = useState(false);
  const [rawInput, setRawInput] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    dpiReadingsRef.current = dpiReadings;
  }, [dpiReadings]);

  useEffect(() => {
    const host = viewRef.current;
    if (!host) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#dce6e9");
    scene.fog = new THREE.Fog("#dce6e9", 14, 36);
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 100);
    camera.position.set(0, 1.65, 6);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    host.appendChild(renderer.domElement);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x71808a, 2.1));
    const light = new THREE.DirectionalLight(0xffffff, 2.6);
    light.position.set(-4, 8, 5);
    scene.add(light);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(18, 24),
      new THREE.MeshStandardMaterial({ color: 0x8c9b96, roughness: 0.9 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.z = -2;
    scene.add(floor);
    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0xe5e2d8, roughness: 0.95 });
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(18, 7, 0.3), wallMaterial);
    backWall.position.set(0, 3.5, -14);
    scene.add(backWall);
    for (const x of [-9, 9]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(0.3, 7, 24), wallMaterial);
      wall.position.set(x, 3.5, -2);
      scene.add(wall);
    }

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
        setSelectedCandidateId(null);
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
        session.phase = "setup";
        setPhase("setup");
        return;
      }
      setSweepCounts(count);
      setSelectedCandidateId(null);
      setMessage("Your movement is measured. Choose one of the three game settings below to practice in Phase 2.");
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
      renderer.domElement.remove();
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
    setSweepCounts(0);
    setSelectedCandidateId(null);
    setErrorMessage("");
    setMessage("Click Start swipe below. Then click the range to capture the mouse, swipe once, and press Esc to finish.");
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
    setDpiCounts(0);
    setErrorMessage("");
    setMessage("Click Start estimate below. Then click the range, move one card length, and press Esc to save this swipe.");
    setPhase("dpi");
  };

  const validDpi = dpi !== null && Number.isFinite(dpi) && dpi > 0 ? dpi : null;
  const gameProfile = GAME_PROFILES[selectedGame];
  const baseCm360 = validDpi && sweepCounts > 0 ? (2 * sweepCounts * 2.54) / validDpi : null;
  const candidateSettings = baseCm360 && validDpi
    ? SENSITIVITY_CANDIDATES.map((candidate) => {
        const cm360 = baseCm360 / candidate.factor;
        return {
          ...candidate,
          cm360,
          gameSensitivity: gameSensitivityForCm360(cm360, validDpi, gameProfile.yawDegreesPerCountAtSensitivityOne),
        };
      })
    : [];
  const selectedCandidate = candidateSettings.find((candidate) => candidate.id === selectedCandidateId) ?? null;
  const practiceBaselineCounts = selectedCandidate && phase === "done" && sweepCounts > 0
    ? sweepCounts / selectedCandidate.factor
    : 0;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>SENSLAB / AIM SETUP</p>
          <h1>Find your starting sensitivity</h1>
        </div>
        <p className={styles.status}>{locked ? `MOUSE CAPTURED · ${rawInput ? "RAW INPUT" : "STANDARD INPUT"} · ESC TO RELEASE` : "CS2 + VALORANT"}</p>
      </header>

      <section className={styles.layout}>
        <div className={styles.range} ref={viewRef} aria-label="Neutral first-person mouse movement measurement range">
          <div className={styles.crosshair} aria-hidden="true"><span /><span /></div>
          {!locked && <div className={styles.enterHint} aria-hidden="true">{phase === "sweep" || phase === "dpi" ? "Click to capture mouse" : "Complete the steps, then start your swipe"}</div>}
        </div>

        <aside className={styles.panel}>
          <section className={styles.intro}>
            <p className={styles.eyebrow}>PHASE 1 / FIND YOUR BASELINE</p>
            <h2>Three quick steps</h2>
            <p className={styles.hint}>Choose your game and DPI, measure one comfortable swipe, then pick a setting to practice.</p>
          </section>

          <section className={styles.task}>
            <p className={styles.step}><span>01</span> Game &amp; DPI</p>
            <div className={styles.inlineFields}>
              <label className={styles.field}><span>GAME</span><select id="game" value={selectedGame} onChange={(event) => {
                setSelectedGame(event.target.value as GameId);
                setSweepCounts(0);
                setSelectedCandidateId(null);
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
                setSelectedCandidateId(null);
                sessionRef.current.phase = "setup";
                setPhase("setup");
              }} /></label>
            </div>
            <p className={styles.hint}>{validDpi ? `Using ${validDpi} DPI. Keep this value set in your mouse app while you test.` : "Enter the DPI active in your mouse app to calculate game settings."}</p>
            <details className={styles.dpiHelp}>
              <summary>Don't know your DPI? Estimate it</summary>
              <p className={styles.hint}>Check it in your mouse app first if possible. Otherwise use a standard card's long edge for three swipes. This estimates counts per inch; it cannot read your mouse sensor setting.</p>
              {phase === "dpi" ? (
                <p className={styles.activeTask}>Swipe one card length and press Esc. Counts: {dpiCounts}</p>
              ) : (
                <button className={styles.secondaryButton} onClick={startDpiSwipe}>{dpiReadings.length === 0 ? "Start 3-swipe DPI estimate" : dpiReadings.length === 3 ? "Measure DPI again" : `Continue estimate · swipe ${dpiReadings.length + 1}/3`}</button>
              )}
              {dpiReadings.length > 0 && <p className={styles.resultLine}>{dpiReadings.length} of 3 swipes saved{validDpi !== null && dpiReadings.length === 3 ? ` - estimated ${validDpi} DPI` : ""}</p>}
            </details>
          </section>

          <section className={styles.task}>
            <p className={styles.step}><span>02</span> Measure your swipe</p>
            <p className={styles.hint}>Use a comfortable mousepad distance. SensLab treats it as a 180° turn.</p>
            {phase === "sweep" ? (
              <div className={styles.activeTask}>
                <strong>{sweepCounts.toLocaleString()} movement counts</strong>
                <span>Click the range to capture the mouse. Move from one comfortable edge to the other, then press Esc.</span>
                {!locked && <button className={styles.primaryButton} onClick={() => captureMouseRef.current()}>Start swipe</button>}
              </div>
            ) : phase === "dpi" ? (
              <div className={styles.activeTask}>
                <strong>{dpiCounts.toLocaleString()} movement counts</strong>
                <span>Click the range to capture the mouse. Move one card length, then press Esc to save this swipe.</span>
                {!locked && <button className={styles.secondaryButton} onClick={() => captureMouseRef.current()}>Start estimate swipe</button>}
              </div>
            ) : (
              <button className={styles.primaryButton} onClick={startSweep} disabled={validDpi === null}>Measure my comfortable swipe</button>
            )}
            {sweepCounts > 0 && phase !== "sweep" && <p className={styles.resultLine}>Measured: {sweepCounts.toLocaleString()} counts = 180°</p>}
          </section>

          {message && <p className={styles.message} aria-live="polite">{message}</p>}
          {errorMessage && <p className={styles.error} role="alert">{errorMessage}</p>}

          {phase === "done" && (
            <section className={styles.task}>
              <p className={styles.step}><span>03</span> Pick a setting to practice</p>
              <p className={styles.hint}>Choose a starting point. You decide which feels best in Phase 2. <a href={gameProfile.yawSourceUrl} target="_blank" rel="noreferrer">About the game value</a></p>
              <div className={styles.candidateList}>
                {candidateSettings.map((candidate) => (
                  <article className={styles.candidateCard} key={candidate.id}>
                    <span>{candidate.label.toUpperCase()}</span>
                    <strong>{candidate.gameSensitivity.toFixed(3)}</strong>
                    <p>{candidate.hint}</p>
                    <p>{candidate.cm360.toFixed(1)} cm for one full turn at {validDpi} DPI</p>
                    <button className={selectedCandidateId === candidate.id ? styles.secondaryButton : styles.primaryButton} onClick={() => setSelectedCandidateId(candidate.id)}>
                      {selectedCandidateId === candidate.id ? "Selected for Phase 2" : "Choose this setting"}
                    </button>
                  </article>
                ))}
              </div>
              {selectedCandidate && <div className={styles.recommendation}>
                <span>YOUR PHASE 2 SETTING</span>
                <strong>{gameProfile.name}: {selectedCandidate.gameSensitivity.toFixed(3)} at {validDpi} DPI</strong>
                <p>Set {validDpi} DPI in your mouse app and enter {selectedCandidate.gameSensitivity.toFixed(3)} in {gameProfile.name} yourself. Then go to Phase 2 and practice with this same setting.</p>
                <a className={styles.primaryButton} href="#phase2">Continue to Phase 2</a>
              </div>}
              <button className={styles.secondaryButton} onClick={startSweep}>Measure my swipe again</button>
            </section>
          )}

          {validDpi && sweepCounts > 0 && phase !== "done" && <p className={styles.resultLine}>{((2 * sweepCounts * 2.54) / validDpi).toFixed(1)} cm swipe · {validDpi} DPI</p>}
        </aside>
      </section>
      <DrillSuite
        baselineCounts={practiceBaselineCounts}
        candidateLabel={selectedCandidate ? `${gameProfile.name} ${selectedCandidate.gameSensitivity.toFixed(3)}` : null}
        gameDpi={validDpi}
      />
    </main>
  );
}
