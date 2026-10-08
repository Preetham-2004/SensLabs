"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import Image from "next/image";
import * as THREE from "three";
import { motion, useReducedMotion } from "motion/react";
import { GAME_PROFILES, type GameId } from "../../lib/gameProfiles";
import { gameSensitivityForCm360 } from "../../lib/sensitivity";
import { assessSensitivityConfidence } from "../../lib/resultAssessment";
import styles from "../page.module.css";
import { useAuth } from "../AuthProvider";
import { DEFAULT_PLAYER_DATA, loadPlayerData, readLocalPlayerData, savePlayerData, writePlayerDataLocally, type Phase1Snapshot } from "../../lib/playerData";

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
  const { user, token, loading: authLoading, logout } = useAuth();
  const reduceMotion = useReducedMotion();
  const [stateReady, setStateReady] = useState(false);
  const viewRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef({
    phase: "setup" as Phase,
    sweepCounts: 0,
  });
  const dpiReadingsRef = useRef<number[]>([]);
  const swipeReadingsRef = useRef<number[]>([]);
  const captureMouseRef = useRef<() => void>(() => {});
  const captureArmedRef = useRef(false);
  const [phase, setPhase] = useState<Phase>("setup");
  const [selectedGame, setSelectedGame] = useState<GameId>("cs2");
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [crosshairShape, setCrosshairShape] = useState(DEFAULT_PLAYER_DATA.practice.crosshairShape);
  const [crosshairColor, setCrosshairColor] = useState(DEFAULT_PLAYER_DATA.practice.crosshairColor);
  const [crosshairSize, setCrosshairSize] = useState(DEFAULT_PLAYER_DATA.practice.crosshairSize);
  const [crosshairGap, setCrosshairGap] = useState(DEFAULT_PLAYER_DATA.practice.crosshairGap);
  const [sensitivityAdjustmentSteps, setSensitivityAdjustmentSteps] = useState(0);
  const [dpiChoice, setDpiChoice] = useState<DpiChoice>("unanswered");
  const [sweepCounts, setSweepCounts] = useState(0);
  const [swipeReadings, setSwipeReadings] = useState<number[]>([]);
  const [dpi, setDpi] = useState<number | null>(null);
  const [dpiReadings, setDpiReadings] = useState<number[]>([]);
  const [dpiCounts, setDpiCounts] = useState(0);
  const [locked, setLocked] = useState(false);
  const [immersiveCapture, setImmersiveCapture] = useState(false);
  const [rawInput, setRawInput] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [calibrationId, setCalibrationId] = useState<string | null>(null);

  const armCaptureGuide = () => {
    captureArmedRef.current = true;
    setImmersiveCapture(true);
  };
  const disarmCaptureGuide = () => {
    captureArmedRef.current = false;
    setImmersiveCapture(false);
  };

  useEffect(() => {
    if (authLoading) return;
    let active = true;
    void loadPlayerData(token, user?.id ?? null).then((data) => {
      if (!active) return;
      const saved = data.calibration;
      setCrosshairShape(data.practice.crosshairShape);
      setCrosshairColor(data.practice.crosshairColor);
      setCrosshairSize(data.practice.crosshairSize);
      setCrosshairGap(data.practice.crosshairGap);
      const restoredPhase = saved.phase === "done" && saved.swipeReadings.length === 3 ? "done" : "setup";
      setPhase(restoredPhase);
      sessionRef.current.phase = restoredPhase;
      sessionRef.current.sweepCounts = saved.sweepCounts;
      setSelectedGame(data.updatedAt === 0 && user?.preferred_game ? user.preferred_game : saved.selectedGame);
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
    if (!stateReady || !user || !token) return;
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
    scene.background = new THREE.Color("#091522");
    scene.fog = new THREE.FogExp2("#091522", 0.012);
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 100);
    camera.position.set(0, 1.65, 5.5);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    host.appendChild(renderer.domElement);
    scene.add(new THREE.AmbientLight(0xa8c7e2, 1.35));
    const light = new THREE.DirectionalLight(0xd9efff, 1.8);
    light.position.set(-3, 11, 4);
    scene.add(light);
    const spot = new THREE.SpotLight(0x76dfff, 3.2, 42, Math.PI / 2.8, 0.5);
    spot.position.set(0, 10, -5);
    spot.target.position.set(0, 2.5, -24);
    scene.add(spot, spot.target);

    const roomWidth = 34;
    const roomDepth = 40;
    const roomCenterZ = -13;
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(roomWidth, roomDepth),
      new THREE.MeshStandardMaterial({ color: 0x14283b, roughness: 0.82, metalness: 0.08 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, -0.02, roomCenterZ);
    scene.add(floor);
    const floorGrid = new THREE.GridHelper(roomWidth, 17, 0x65b4c5, 0x35556c);
    floorGrid.position.set(0, 0.012, roomCenterZ);
    const floorGridMaterials = Array.isArray(floorGrid.material) ? floorGrid.material : [floorGrid.material];
    floorGridMaterials.forEach((material) => {
      material.transparent = true;
      material.opacity = 0.48;
      material.depthWrite = false;
    });
    scene.add(floorGrid);

    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x101f30, roughness: 0.9, metalness: 0.03 });
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(roomWidth, 14, 0.4), wallMaterial);
    backWall.position.set(0, 7, -33);
    scene.add(backWall);
    for (const side of [-1, 1]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(0.4, 14, roomDepth), wallMaterial);
      wall.position.set(side * (roomWidth / 2), 7, roomCenterZ);
      scene.add(wall);
    }
    const ceiling = new THREE.Mesh(
      new THREE.BoxGeometry(roomWidth, 0.3, roomDepth),
      new THREE.MeshStandardMaterial({ color: 0x0c1826, roughness: 0.95, metalness: 0.02 }),
    );
    ceiling.position.set(0, 14, roomCenterZ);
    scene.add(ceiling);

    const wallGridMaterial = new THREE.LineBasicMaterial({ color: 0x315066, transparent: true, opacity: 0.44 });
    const backGridPoints: THREE.Vector3[] = [];
    for (let x = -16; x <= 16; x += 4) {
      backGridPoints.push(new THREE.Vector3(x, 0, -32.78), new THREE.Vector3(x, 13.8, -32.78));
    }
    for (let y = 2; y < 14; y += 2) {
      backGridPoints.push(new THREE.Vector3(-17, y, -32.78), new THREE.Vector3(17, y, -32.78));
    }
    scene.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(backGridPoints), wallGridMaterial));
    for (const side of [-1, 1]) {
      const points: THREE.Vector3[] = [];
      const x = side * 16.78;
      for (let z = -31; z <= 5; z += 4) {
        points.push(new THREE.Vector3(x, 0, z), new THREE.Vector3(x, 13.8, z));
      }
      for (let y = 2; y < 14; y += 2) {
        points.push(new THREE.Vector3(x, y, -33), new THREE.Vector3(x, y, 7));
      }
      scene.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points), wallGridMaterial));
    }

    const edgeLightMaterial = new THREE.MeshBasicMaterial({ color: 0x9be9f2 });
    for (const side of [-1, 1]) {
      const edge = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.045, roomDepth), edgeLightMaterial);
      edge.position.set(side * 16.72, 13.78, roomCenterZ);
      scene.add(edge);
    }
    const backEdge = new THREE.Mesh(new THREE.BoxGeometry(roomWidth, 0.045, 0.045), edgeLightMaterial);
    backEdge.position.set(0, 13.78, -32.72);
    scene.add(backEdge);

    const lane = new THREE.Mesh(new THREE.PlaneGeometry(0.045, roomDepth), new THREE.MeshBasicMaterial({ color: 0x72cedb, transparent: true, opacity: 0.52 }));
    lane.rotation.x = -Math.PI / 2;
    lane.position.set(0, 0.02, roomCenterZ);
    scene.add(lane);

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
      disarmCaptureGuide();
      if (counts < 20) {
        setErrorMessage("That movement was too short. Try again and move your mouse the full length of the card.");
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
        const estimatedDpi = middleCounts / (CARD_WIDTH_CM / 2.54);
        setDpi(Math.max(100, Math.floor(estimatedDpi / 100) * 100));
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
      disarmCaptureGuide();
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
        setMessage(`Swipe ${nextReadings.length} of 3 saved. Return your mouse to the starting edge, then click anywhere to begin swipe ${nextReadings.length + 1}.`);
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
      if (isLocked) {
        captureArmedRef.current = false;
        return;
      }
      captureArmedRef.current = false;
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

    const onDocumentClick = (event: MouseEvent) => {
      if (event.target instanceof Element && event.target.closest("button, a, input, select, textarea, summary")) return;
      if (captureArmedRef.current) captureMeasurementMouse();
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && document.pointerLockElement !== canvas) {
        disarmCaptureGuide();
      }
    };

    canvas.addEventListener("mousemove", onMouseMove);
    document.addEventListener("click", onDocumentClick);
    document.addEventListener("pointerlockchange", onLockChange);
    document.addEventListener("keydown", onEscape);
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
      document.removeEventListener("click", onDocumentClick);
      document.removeEventListener("pointerlockchange", onLockChange);
      document.removeEventListener("keydown", onEscape);
      if (document.pointerLockElement === canvas) document.exitPointerLock();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
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
    setMessage("Measure the same straight, comfortable swipe three times. Click anywhere to begin each swipe, then press Esc at the far edge.");
    armCaptureGuide();
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
    setMessage("Use a bank card. Click Start estimate, then click anywhere to begin. Move your mouse along the card's long side and press Esc.");
    armCaptureGuide();
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
    <main className={styles.page} data-phase={phase} data-immersive={immersiveCapture ? "true" : "false"}>
      <motion.ol
        className={styles.stepper}
        aria-label="Phase 1 steps"
        initial={reduceMotion ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.1, ease: "easeOut" }}
      >
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
      </motion.ol>

      <section className={styles.layout}>
        <motion.nav
          className={styles.sideNav}
          aria-label="SensLab sections"
          initial={reduceMotion ? false : { opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.16, ease: "easeOut" }}
        >
          <Link className={styles.sideNavItemActive} href="/calibrate" aria-current="page">
            <span aria-hidden="true">⌖</span>
            <span><strong>Sensitivity finder</strong><small>Find your starting sens</small></span>
          </Link>
          {practiceHref ? (
            <Link className={styles.sideNavItem} href={practiceHref}>
              <span aria-hidden="true">◎</span>
              <span><strong>Aim practice</strong><small>Try your setting</small></span>
            </Link>
          ) : (
            <span className={styles.sideNavItemDisabled} aria-disabled="true">
              <span aria-hidden="true">◎</span>
              <span><strong>Aim practice</strong><small>Available after calibration</small></span>
            </span>
          )}
          <Link className={styles.sideNavItem} href="/history">
            <span aria-hidden="true">▤</span>
            <span><strong>Progress</strong><small>Review your history</small></span>
          </Link>
          <div className={styles.sideNavProfileBottom}>
            <details className={styles.profileMenu}>
              <summary className={styles.profileButton} aria-label="Open profile menu" title="Profile">
                <Image className={styles.profileLogo} src="/senslab-minimal-logo.png" alt="" width={30} height={30} />
                <span className={styles.profilePerson} aria-hidden="true">
                  <svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5" /><path d="M5.5 20c.5-3.6 2.8-5.4 6.5-5.4s6 1.8 6.5 5.4" /></svg>
                </span>
              </summary>
              <div className={styles.profileDropdown}>
                {user ? <><strong>{user.username || user.email.split("@")[0]}</strong><Link href="/account">Account settings</Link><button type="button" onClick={logout}>Sign out</button></> : <><Link href="/login">Log in</Link><Link href="/signup">Create account</Link></>}
              </div>
            </details>
          </div>
        </motion.nav>

        <div className={styles.range} ref={viewRef} aria-label="Neutral first-person mouse movement measurement range">
          <div className={styles.rangeBadge}>SensLab calibration chamber</div>
          <div
            className={styles.crosshair}
            data-shape={crosshairShape}
            style={{ "--crosshair-color": crosshairColor, "--crosshair-size": `${crosshairSize}px`, "--crosshair-gap": `${crosshairGap}px`, "--crosshair-dot-size": `${Math.max(3, Math.round(crosshairSize / 4))}px` } as CSSProperties}
            aria-hidden="true"
          >
            <span /><span /><span /><span /><span />
          </div>
          {immersiveCapture && (
            <div className={styles.captureGuide} role="status" aria-live="polite">
              <span className={styles.captureGuideEyebrow}>{phase === "dpi" ? "DPI ESTIMATE" : "PHASE 1 · NATURAL SWIPE"}</span>
              <strong>{locked ? "Reach the far edge, then press Esc" : phase === "dpi" ? `Swipe ${dpiReadings.length + 1} of 3` : `Swipe ${swipeReadings.length + 1} of 3`}</strong>
              <p>{locked
                ? phase === "dpi"
                  ? "Move your mouse from one end of the card to the other. Stop, then press Esc to save this swipe."
                  : "Swipe from one end of your mousepad to the other in a straight path. Stop as soon as you reach the far edge, then press Esc to save this swipe."
                : phase === "dpi"
                  ? "Click anywhere to begin. Move your mouse along the card's long side, then press Esc."
                  : "Click anywhere to capture your mouse. Start at one edge of your mousepad. Swipe straight to the other edge, stop there, and press Esc."}</p>
              {locked && <p className={styles.captureCount}>Movement captured: {(phase === "dpi" ? dpiCounts : sweepCounts).toLocaleString()} counts</p>}
              {phase === "sweep" && <div className={styles.captureProgress} aria-label={`${swipeReadings.length} of 3 swipes saved`}>
                {[0, 1, 2].map((index) => <span key={index} data-complete={index < swipeReadings.length ? "true" : "false"} />)}
              </div>}
              <small>{locked ? "Press Esc to finish this swipe and return to the controls." : "The range will return to its normal layout after each swipe."}</small>
            </div>
          )}
        </div>

        <motion.aside
          className={styles.panel}
          initial={reduceMotion ? false : { opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.55, delay: 0.12, ease: "easeOut" }}
        >
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
            <p className={styles.hint}>{validDpi ? `DPI set to ${validDpi}. Keep the same value in your mouse software.` : "Enter the DPI shown in your mouse software to calculate your settings."}</p>
            <details className={styles.dpiHelp}>
              <summary>Need help finding your DPI?</summary>
              <p className={styles.hint}>First, check your mouse software. If you can’t find your DPI there, use a bank card. Move your mouse along the card’s long side in a straight line. Repeat this three times. We’ll use the middle result to estimate your DPI. This is only an estimate; SensLab can’t read your mouse’s actual DPI.</p>
              {phase === "dpi" ? (
                <p className={styles.activeTask}>Move your mouse along the card’s long side, then press Esc. Movement: {dpiCounts}</p>
              ) : (
                <button className={styles.secondaryButton} onClick={startDpiSwipe}>{dpiReadings.length === 0 ? "Start estimate" : dpiReadings.length === 3 ? "Measure again" : `Continue · swipe ${dpiReadings.length + 1} of 3`}</button>
              )}
              {dpiReadings.length > 0 && <p className={styles.resultLine}>{dpiReadings.length} of 3 swipes saved{validDpi !== null && dpiReadings.length === 3 ? ` - estimated ${validDpi} DPI (rounded down to the nearest 100)` : ""}</p>}
            </details>
          </section>

          <section className={styles.task} data-state={step2State}>
            <p className={styles.step}><span>02</span> Measure your swipe</p>
            <p className={styles.hint}>Repeat the same comfortable edge-to-edge mousepad swipe 3 times. SensLab treats that distance as a 180° turn and uses the middle count.</p>
            {phase === "sweep" ? (
              <div className={styles.activeTask}>
                <strong>{sweepCounts.toLocaleString()} movement counts</strong>
                <span>{swipeReadings.length} of 3 saved. Click anywhere to begin, make the same straight swipe, then press Esc. Repeat from the same starting edge.</span>
                {!locked && <button className={styles.primaryButton} onClick={armCaptureGuide}>Prepare swipe {swipeReadings.length + 1} of 3</button>}
              </div>
            ) : phase === "dpi" ? (
              <div className={styles.activeTask}>
                <strong>{dpiCounts.toLocaleString()} movement counts</strong>
                <span>Move your mouse along the card’s long side, then press Esc to save this swipe.</span>
                {!locked && <button className={styles.secondaryButton} onClick={() => { armCaptureGuide(); captureMouseRef.current(); }}>Start estimate swipe</button>}
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

        </motion.aside>
      </section>
    </main>
  );
}
