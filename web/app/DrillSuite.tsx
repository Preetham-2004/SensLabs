"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import * as THREE from "three";
import { DRILL_CONFIG } from "../lib/drillConfig";
import {
  angularErrorDegrees,
  calculateFlickMetrics,
  calculateFlickErrors,
  calculatePrecisionMetrics,
  calculateTrackingMetrics,
  forwardProgressRadians,
  type FlickAttempt,
  type MouseSample,
  type TrackingObservation,
} from "../lib/metrics";
import styles from "./page.module.css";

type DrillType = "flick" | "tracking" | "precision";
type RoundResult = {
  drill: DrillType;
  candidateLabel: string;
  gameDpi: number;
  startedAt: number;
  endedAt: number;
  mouseSamples: MouseSample[];
  clickTimes: number[];
  metrics: Record<string, number>;
};
type DrillState = {
  phase: "idle" | "countdown" | "active" | "results";
  type: DrillType | null;
  startedAt: number;
  countdownEndsAt: number;
  targetStartedAt: number;
  targetIndex: number;
  yaw: number;
  pitch: number;
  startYaw: number;
  startPitch: number;
  targetYaw: number;
  targetPitch: number;
  farthestProgress: number;
  flickAttempts: FlickAttempt[];
  spawnTimes: number[];
  observations: TrackingObservation[];
  mouseSamples: MouseSample[];
  clickTimes: number[];
  pathSeed: number[];
};

const radians = Math.PI / 180;
const wrapRadians = (value: number) => Math.atan2(Math.sin(value), Math.cos(value));
const sessionSafeTargetRadius = (radiusDeg: number) => radiusDeg < 1 ? 1.7 : 2.6;

function playFeedback(isHit: boolean) {
  const AudioContextClass = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;

  const audio = new AudioContextClass();
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  const now = audio.currentTime;
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(isHit ? 740 : 220, now);
  oscillator.frequency.exponentialRampToValueAtTime(isHit ? 980 : 150, now + 0.09);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.12, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + (isHit ? 0.13 : 0.18));
  oscillator.connect(gain);
  gain.connect(audio.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.19);
  oscillator.onended = () => { void audio.close(); };
}

const emptyState = (): DrillState => ({
  phase: "idle", type: null, startedAt: 0, countdownEndsAt: 0, targetStartedAt: 0,
  targetIndex: 0, yaw: 0, pitch: 0, startYaw: 0, startPitch: 0, targetYaw: 0,
  targetPitch: 0, farthestProgress: 0, flickAttempts: [], spawnTimes: [],
  observations: [], mouseSamples: [], clickTimes: [], pathSeed: [],
});

function targetAngles(type: DrillType, index: number, seed: number[]) {
  if (type === "tracking") {
    const t = index / 1000;
    const [a, b, c, d] = seed;
    const config = DRILL_CONFIG.tracking;
    return {
      yaw: (Math.sin(t * config.yawFrequency + a) * config.yawPrimaryAmount + Math.sin(t * config.yawSecondaryFrequency + b) * config.yawSecondaryAmount) * config.maxYawDeg * radians,
      pitch: (Math.sin(t * config.pitchFrequency + c) * config.pitchPrimaryAmount + Math.sin(t * config.pitchSecondaryFrequency + d) * config.pitchSecondaryAmount) * config.maxPitchDeg * radians,
    };
  }
  const config = type === "flick" ? DRILL_CONFIG.flick : DRILL_CONFIG.precision;
  const angle = (config.minAngleDeg + Math.random() * (config.maxAngleDeg - config.minAngleDeg)) * radians;
  const direction = Math.random() * Math.PI * 2;
  return { yaw: Math.sin(direction) * angle, pitch: Math.cos(direction) * angle };
}

export default function DrillSuite({
  baselineCounts,
  candidateLabel,
  gameDpi,
}: {
  baselineCounts: number;
  candidateLabel: string | null;
  gameDpi: number | null;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const stateRef = useRef<DrillState>(emptyState());
  const targetRef = useRef<THREE.Mesh | null>(null);
  const [phase, setPhase] = useState<DrillState["phase"]>("idle");
  const [drillType, setDrillType] = useState<DrillType>("flick");
  const [countdown, setCountdown] = useState(0);
  const [targetNumber, setTargetNumber] = useState(0);
  const [points, setPoints] = useState(0);
  const [crosshairShape, setCrosshairShape] = useState<"plus" | "dot" | "ring">("plus");
  const [crosshairColor, setCrosshairColor] = useState("#b8ff43");
  const [crosshairSize, setCrosshairSize] = useState(22);
  const [crosshairGap, setCrosshairGap] = useState(5);
  const [result, setResult] = useState<RoundResult | null>(null);
  const [history, setHistory] = useState<RoundResult[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const drillSession = stateRef.current;
    const currentBaselineCounts = baselineCounts;
    const currentCandidateLabel = candidateLabel;
    const currentGameDpi = gameDpi;
    const host = hostRef.current;
    if (!host) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#b8c9c7");
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 100);
    camera.position.set(0, 1.65, 6);
    scene.add(camera);
    cameraRef.current = camera;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    host.appendChild(renderer.domElement);
    scene.add(new THREE.HemisphereLight(0xe9f6f2, 0x344c49, 2.1));
    const light = new THREE.DirectionalLight(0xffffff, 2);
    light.position.set(-4, 9, 4);
    scene.add(light);
    const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x39464a, roughness: 0.88, metalness: 0.12 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(34, 42), floorMaterial);
    floor.rotation.x = -Math.PI / 2; floor.position.set(0, -0.02, -8); scene.add(floor);
    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x26383b, roughness: 0.9 });
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(30, 9, 0.5), wallMaterial);
    backWall.position.set(0, 4.5, -25); scene.add(backWall);
    for (const x of [-15, 15]) { const wall = new THREE.Mesh(new THREE.BoxGeometry(0.5, 9, 38), wallMaterial); wall.position.set(x, 4.5, -8); scene.add(wall); }
    const laneMat = new THREE.MeshBasicMaterial({ color: 0x45b9a1 });
    const trimMat = new THREE.MeshBasicMaterial({ color: 0xe2a457 });
    for (const x of [-5, 5]) {
      const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 30), laneMat);
      stripe.rotation.x = -Math.PI / 2; stripe.position.set(x, 0.015, -9); scene.add(stripe);
    }
    for (const z of [-8, -14, -20]) {
      const marker = new THREE.Mesh(new THREE.PlaneGeometry(9.8, 0.07), trimMat);
      marker.rotation.x = -Math.PI / 2; marker.position.set(0, 0.02, z); scene.add(marker);
    }
    const backPanel = new THREE.Mesh(new THREE.BoxGeometry(18, 3.2, 0.16), new THREE.MeshStandardMaterial({ color: 0x34494a, roughness: 0.7, metalness: 0.16 }));
    backPanel.position.set(0, 2.9, -20.8); scene.add(backPanel);
    for (const x of [-11, 11]) {
      const lightStrip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 6.5, 0.12), new THREE.MeshBasicMaterial({ color: 0x45b9a1 }));
      lightStrip.position.set(x, 4.6, -20.68); scene.add(lightStrip);
    }

    // Original low-poly training sidearm, assembled from simple meshes.
    const tool = new THREE.Group();
    tool.position.set(0.43, -0.39, -0.72);
    tool.rotation.set(-0.08, -0.08, -0.04);
    camera.add(tool);
    const toolBody = new THREE.MeshStandardMaterial({ color: 0x253235, roughness: 0.36, metalness: 0.55 });
    const toolTop = new THREE.MeshStandardMaterial({ color: 0x3d5553, roughness: 0.32, metalness: 0.65 });
    const toolGrip = new THREE.MeshStandardMaterial({ color: 0x1c2628, roughness: 0.9 });
    const toolAccent = new THREE.MeshStandardMaterial({ color: 0xe2a457, roughness: 0.4, metalness: 0.3 });
    const addToolPart = (size: [number, number, number], position: [number, number, number], material: THREE.Material, rotationX = 0) => {
      const part = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
      part.position.set(...position); part.rotation.x = rotationX; tool.add(part);
    };
    addToolPart([0.23, 0.17, 0.42], [0, 0.02, -0.03], toolBody);
    addToolPart([0.19, 0.08, 0.34], [0, 0.14, -0.12], toolTop);
    addToolPart([0.1, 0.1, 0.27], [0, 0.1, -0.42], toolBody);
    addToolPart([0.12, 0.25, 0.16], [0, -0.17, 0.02], toolGrip, 0.22);
    addToolPart([0.135, 0.018, 0.21], [0, -0.29, 0.015], toolTop, 0.22);
    addToolPart([0.055, 0.025, 0.08], [0, 0.19, -0.11], toolAccent);
    addToolPart([0.27, 0.035, 0.1], [0, 0.055, 0.18], toolBody);
    const targetMaterial = new THREE.MeshStandardMaterial({ color: 0x02c9f4, emissive: 0x00647b, emissiveIntensity: 1.8, side: THREE.DoubleSide, roughness: 0.25, metalness: 0.05 });
    const target = new THREE.Mesh(new THREE.SphereGeometry(0.55, 32, 24), targetMaterial);
    const targetOutline = new THREE.Mesh(new THREE.TorusGeometry(0.69, 0.045, 10, 48), new THREE.MeshBasicMaterial({ color: 0xb6f8ff }));
    target.add(targetOutline);
    target.visible = false; scene.add(target); targetRef.current = target;
    const resize = () => { if (!host.clientWidth || !host.clientHeight) return; camera.aspect = host.clientWidth / host.clientHeight; camera.updateProjectionMatrix(); renderer.setSize(host.clientWidth, host.clientHeight); };
    const observer = new ResizeObserver(resize); observer.observe(host); resize();
    const canvas = renderer.domElement;
    const placeTarget = (yaw: number, pitch: number, radiusDeg: number) => {
      const distance = 12;
      const boundedYaw = yaw;
      const boundedPitch = pitch;
      const local = new THREE.Vector3(Math.sin(boundedYaw) * Math.cos(boundedPitch), Math.sin(boundedPitch), -Math.cos(boundedYaw) * Math.cos(boundedPitch));
      target.position.copy(camera.position).add(local.multiplyScalar(distance));
      target.lookAt(camera.position);
      const visibleRadiusDeg = Math.max(radiusDeg, sessionSafeTargetRadius(radiusDeg));
      const radius = distance * Math.tan(visibleRadiusDeg * radians);
      target.geometry.dispose();
      target.geometry = new THREE.SphereGeometry(radius, 32, 24);
      target.scale.setScalar(1);
      targetOutline.position.set(0, 0, radius * 0.1);
      targetOutline.scale.setScalar(radius / 0.55);
      targetOutline.rotation.set(0, 0, 0);
      target.visible = true;
    };
    const spawnTarget = (session: DrillState, now: number) => {
      if (!session.type) return;
      const angle = targetAngles(session.type, session.targetIndex, session.pathSeed);
      session.targetYaw = session.type === "tracking" ? angle.yaw : session.yaw + angle.yaw;
      session.targetPitch = session.type === "tracking" ? angle.pitch : session.pitch + angle.pitch;
      session.targetStartedAt = now;
      session.startYaw = session.yaw;
      session.startPitch = session.pitch;
      session.farthestProgress = 0;
      const radius = session.type === "precision" ? DRILL_CONFIG.precision.targetRadiusDeg : DRILL_CONFIG.flick.targetRadiusDeg;
      placeTarget(session.targetYaw, session.targetPitch, radius);
      session.spawnTimes.push(now);
      setTargetNumber(session.targetIndex + 1);
    };
    const finish = (now: number) => {
      const session = stateRef.current;
      if (!session.type) return;
      target.visible = false;
      let metrics: Record<string, number>;
      if (session.type === "flick") {
        metrics = { ...calculateFlickMetrics(session.flickAttempts) };
      } else if (session.type === "tracking") {
        metrics = { ...calculateTrackingMetrics(session.observations) };
      } else {
        metrics = { ...calculatePrecisionMetrics(session.flickAttempts.map(({ time, hit, errorDeg }) => ({ time, hit, errorDeg })), session.spawnTimes) };
      }
      const round: RoundResult = {
        drill: session.type,
        candidateLabel: currentCandidateLabel ?? "Unknown setting",
        gameDpi: currentGameDpi ?? 0,
        startedAt: session.startedAt,
        endedAt: now,
        mouseSamples: [...session.mouseSamples],
        clickTimes: [...session.clickTimes],
        metrics,
      };
      setResult(round); setHistory((previous) => [...previous, round]);
      session.phase = "results"; setPhase("results");
      if (document.pointerLockElement === canvas) document.exitPointerLock();
    };
    const recordAttempt = (now: number, timedOut = false) => {
      const session = stateRef.current;
      if (!session.type || !["flick", "precision"].includes(session.type)) return;
      const radius = session.type === "precision" ? DRILL_CONFIG.precision.targetRadiusDeg : DRILL_CONFIG.flick.targetRadiusDeg;
      const { errorDeg, overshootDeg, undershootDeg } = calculateFlickErrors(
        session.startYaw, session.startPitch, session.targetYaw, session.targetPitch,
        session.yaw, session.pitch, session.farthestProgress,
      );
      const hit = !timedOut && errorDeg <= radius;
      if (session.type === "flick") playFeedback(hit);
      setPoints((value) => value + (hit ? 100 : 0));
      session.flickAttempts.push({ spawnTime: session.targetStartedAt, time: now, hit, errorDeg, overshootDeg, undershootDeg });
      if (session.type === "flick" && session.flickAttempts.length >= DRILL_CONFIG.flick.targetCount) { finish(now); return; }
      if (session.type === "precision" && session.flickAttempts.length >= DRILL_CONFIG.precision.targetCount) { finish(now); return; }
      session.targetIndex += 1;
      spawnTarget(session, now);
    };
    const onMouseMove = (event: MouseEvent) => {
      const session = stateRef.current;
      if (document.pointerLockElement !== canvas || session.phase !== "active") return;
      const now = performance.now();
      const degreesPerCount = currentBaselineCounts > 0 ? 180 / currentBaselineCounts : 0.08;
      session.yaw += event.movementX * degreesPerCount * radians;
      session.pitch = THREE.MathUtils.clamp(session.pitch - event.movementY * degreesPerCount * radians, -80 * radians, 80 * radians);
      session.yaw = THREE.MathUtils.clamp(session.yaw, -Math.PI, Math.PI);
      camera.rotation.set(session.pitch, -session.yaw, 0, "YXZ");
      session.mouseSamples.push({ time: now, dx: event.movementX, dy: event.movementY, yaw: session.yaw, pitch: session.pitch });
      if (session.type !== "tracking") {
        session.farthestProgress = Math.max(session.farthestProgress, forwardProgressRadians(
          session.startYaw, session.startPitch, session.targetYaw, session.targetPitch, session.yaw, session.pitch,
        ));
      }
    };
    const onTargetClick = () => {
      const session = stateRef.current;
      if (document.pointerLockElement !== canvas) return;
      if (session.phase === "countdown") return;
      if (session.phase !== "active") return;
      const now = performance.now();
      session.clickTimes.push(now);
      if (session.type === "tracking") {
        const hit = angularErrorDegrees(session.yaw, session.pitch, session.targetYaw, session.targetPitch)
          <= DRILL_CONFIG.tracking.targetRadiusDeg;
        playFeedback(hit);
        setPoints((value) => value + (hit ? 10 : 0));
        return;
      }
      recordAttempt(now);
    };
    const onLockChange = () => {
      if (document.pointerLockElement === canvas) return;
      const session = stateRef.current;
      if (session.phase === "active") setError("Mouse released. Click the range to capture it again or press Esc to stop.");
    };
    const onCanvasClick = () => {
      if (stateRef.current.phase !== "countdown" && stateRef.current.phase !== "active") return;
      if (document.pointerLockElement === canvas) return;
      void canvas.requestPointerLock({ unadjustedMovement: true }).catch(() => {
        setError("Mouse capture was blocked. Click inside the range again to allow mouse control.");
      });
    };
    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("click", onTargetClick);
    canvas.addEventListener("click", onCanvasClick);
    document.addEventListener("pointerlockchange", onLockChange);
    let frame = 0;
    const render = (frameTime: number) => {
      const session = stateRef.current;
      const now = performance.now();
      if (session.phase === "countdown") {
        if (now >= session.countdownEndsAt) {
          session.phase = "active"; session.startedAt = now; session.targetIndex = 0;
          setPoints(0);
          session.mouseSamples = []; session.clickTimes = []; session.flickAttempts = []; session.spawnTimes = []; session.observations = [];
          if (session.type === "tracking") session.pathSeed = Array.from({ length: 4 }, () => Math.random() * Math.PI * 2);
          setPhase("active");
          if (session.type === "tracking") spawnTarget(session, now);
          else spawnTarget(session, now);
        }
      } else if (session.phase === "active" && session.type) {
        if (session.type === "tracking") {
          const elapsed = now - session.startedAt;
          const path = targetAngles("tracking", elapsed, session.pathSeed);
          session.targetYaw = path.yaw; session.targetPitch = path.pitch;
          placeTarget(path.yaw, path.pitch, DRILL_CONFIG.tracking.targetRadiusDeg);
          session.observations.push({ time: now, errorDeg: angularErrorDegrees(session.yaw, session.pitch, path.yaw, path.pitch), targetRadiusDeg: DRILL_CONFIG.tracking.targetRadiusDeg });
          if (elapsed >= DRILL_CONFIG.tracking.durationMs) finish(now);
        } else {
          const timeout = session.type === "flick" ? DRILL_CONFIG.flick.targetTimeoutMs : DRILL_CONFIG.precision.targetTimeoutMs;
          if (now - session.targetStartedAt >= timeout) recordAttempt(now, true);
        }
        if (session.type === "tracking") setCountdown(Math.max(0, Math.ceil((DRILL_CONFIG.tracking.durationMs - (now - session.startedAt)) / 1000)));
      }
      if (session.phase === "active") camera.rotation.set(session.pitch, -session.yaw, 0, "YXZ");
      renderer.render(scene, camera);
      frame = requestAnimationFrame(render);
    };
    render(0);
    return () => {
      cancelAnimationFrame(frame); observer.disconnect(); canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("click", onTargetClick); canvas.removeEventListener("click", onCanvasClick); document.removeEventListener("pointerlockchange", onLockChange);
      if (document.pointerLockElement === canvas) document.exitPointerLock();
      scene.traverse((object) => { if (object instanceof THREE.Mesh) { object.geometry.dispose(); const materials = Array.isArray(object.material) ? object.material : [object.material]; materials.forEach((material) => material.dispose()); } });
      renderer.dispose(); renderer.domElement.remove(); targetRef.current = null; cameraRef.current = null;
    };
  }, [baselineCounts, candidateLabel, gameDpi]);

  const startRound = () => {
    if (baselineCounts <= 0 || !candidateLabel || !gameDpi) return;
    const host = hostRef.current;
    const canvas = host?.querySelector("canvas");
    if (!canvas) return;
    const session = emptyState();
    session.phase = "countdown"; session.type = drillType; session.countdownEndsAt = performance.now() + DRILL_CONFIG.countdownSeconds * 1000;
    stateRef.current = session;
    cameraRef.current?.rotation.set(0, 0, 0, "YXZ");
    setResult(null); setError(""); setCountdown(DRILL_CONFIG.countdownSeconds); setTargetNumber(0); setPoints(0); setPhase("countdown");
    void (canvas as HTMLCanvasElement).requestPointerLock({ unadjustedMovement: true }).catch(() => {
      setError("Click inside the range to capture the mouse. The drill countdown will continue.");
    });
  };

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
    <section className={styles.drillSection} id="phase2">
      <div className={styles.drillIntro}>
        <p className={styles.eyebrow}>PHASE 2 - MEASURED DRILLS</p>
        <h2>Practice and see what happened</h2>
        <p className={styles.hint}>Tune your reticle, then practice the selected Phase 1 setting in SensLab's training bay. Hit and miss tones give immediate feedback.</p>
      </div>
      <div className={styles.drillControls}>
        {candidateLabel && gameDpi !== null && <p className={styles.resultLine}>Selected practice setting: {candidateLabel} at {gameDpi} DPI. Set these values manually in your mouse app and game.</p>}
        <p className={styles.soundNote}><span className={styles.soundHit}>●</span> Hit tone <span className={styles.soundMiss}>●</span> Miss tone</p>
        <details className={styles.crosshairSettings}>
          <summary>Customize your crosshair</summary>
          <div className={styles.crosshairControls}>
            <label>Shape<select value={crosshairShape} onChange={(event) => setCrosshairShape(event.target.value as typeof crosshairShape)}><option value="plus">Plus</option><option value="dot">Dot</option><option value="ring">Ring</option></select></label>
            <label>Color<select value={crosshairColor} onChange={(event) => setCrosshairColor(event.target.value)}><option value="#b8ff43">Lime</option><option value="#42e8ff">Cyan</option><option value="#ffffff">White</option><option value="#ffcf4a">Amber</option><option value="#ff5f72">Coral</option></select></label>
            <label>Size <strong>{crosshairSize}px</strong><input type="range" min="12" max="36" value={crosshairSize} onChange={(event) => setCrosshairSize(Number(event.target.value))} /></label>
            <label>Gap <strong>{crosshairGap}px</strong><input type="range" min="0" max="12" value={crosshairGap} onChange={(event) => setCrosshairGap(Number(event.target.value))} /></label>
          </div>
        </details>
        <label className={styles.inputLabel} htmlFor="drill">Choose a drill</label>
        <select id="drill" value={drillType} onChange={(event) => setDrillType(event.target.value as DrillType)} disabled={phase === "active" || phase === "countdown"}>
          <option value="flick">Flick - 30 targets</option><option value="tracking">Tracking - 20 seconds</option><option value="precision">Precision - 20 small targets</option>
        </select>
        {phase === "idle" || phase === "results" ? <button className={styles.primaryButton} onClick={startRound} disabled={baselineCounts <= 0 || !candidateLabel}>Start {DRILL_CONFIG.countdownSeconds}-second instruction countdown</button> : <p className={styles.activeTask}>{phase === "countdown" ? `Get ready: ${countdown}` : drillType === "tracking" ? `Track the target - ${countdown} seconds left` : `Target ${targetNumber} of ${drillType === "flick" ? DRILL_CONFIG.flick.targetCount : DRILL_CONFIG.precision.targetCount} - click the center after aiming`}</p>}
        {baselineCounts <= 0 && <p className={styles.hint}>Complete Phase 1 and choose a sensitivity to unlock practice.</p>}
        {phase === "countdown" && <p className={styles.hint}>{drillType === "flick" ? "Flick to each target and click it." : drillType === "tracking" ? "Keep your crosshair on the moving target; do not click." : "Carefully aim and click each small target."}</p>}
        {error && <p className={styles.error}>{error}</p>}
      </div>
      <div className={styles.drillRange} ref={hostRef} aria-label="SensLab measured drill range">
        <div className={styles.drillHud}>
          <div><span>POINTS</span><strong>{points}</strong></div>
          <div><span>DRILL</span><strong>{phase === "countdown" ? `READY ${countdown}` : drillType.toUpperCase()}</strong></div>
          <div><span>PROGRESS</span><strong>{drillType === "tracking" ? `${countdown}s` : `${targetNumber}/${drillType === "flick" ? DRILL_CONFIG.flick.targetCount : DRILL_CONFIG.precision.targetCount}`}</strong></div>
        </div>
        <div
          className={styles.drillCrosshair}
          data-shape={crosshairShape}
          style={{ "--crosshair-color": crosshairColor, "--crosshair-size": `${crosshairSize}px`, "--crosshair-gap": `${crosshairGap}px` } as CSSProperties}
          aria-hidden="true"
        ><span /><span /><span /><span /><span /></div>
        {phase === 'idle' && <div className={styles.scenePrompt}>CHOOSE A DRILL AND CLICK START</div>}
        {phase === 'countdown' && <div className={styles.scenePrompt}>GET READY · {countdown}</div>}
        {phase === 'active' && <div className={styles.sceneLabel}>{drillType === 'tracking' ? 'KEEP YOUR CROSSHAIR ON TARGET' : 'AIM AND CLICK THE TARGET'}</div>}
      </div>
      {result && <section className={styles.results}>
        <p className={styles.step}>{result.drill[0].toUpperCase() + result.drill.slice(1)} results - {result.candidateLabel} at {result.gameDpi} DPI</p>
        {Object.entries(result.metrics).map(([key, value]) => <div className={styles.resultRow} key={key}><strong>{metricLabel(key)}</strong><span>{metricValue(key, value)}</span></div>)}
        <p className={styles.hint}>Raw data saved in memory for this page session: {result.mouseSamples.length} mouse samples and {result.clickTimes.length} click times.</p>
        <button className={styles.secondaryButton} onClick={() => { setPhase("idle"); setResult(null); }}>Close results</button>
      </section>}
      {history.length > 0 && <section className={styles.drillHistory}>
        <p className={styles.step}>Practice history - compare settings you tried</p>
        {history.map((round, index) => <p className={styles.hint} key={`${round.startedAt}-${index}`}>
          {round.candidateLabel} at {round.gameDpi} DPI - {round.drill} - {Object.entries(round.metrics).filter(([key]) => key === "hitRatePercent" || key === "onTargetPercent" || key === "meanAngularErrorDeg").map(([key, value]) => `${metricLabel(key)} ${metricValue(key, value)}`).join(" · ")}
        </p>)}
      </section>}
      <p className={styles.hint}>Completed rounds kept in this browser session: {history.length}. They are not sent to the API or saved after leaving the page.</p>
    </section>
  );
}

function metricLabel(key: string) {
  const labels: Record<string, string> = {
    hitRatePercent: "Hit rate", meanTimeToHitMs: "Average time to hit", misses: "Misses",
    meanOvershootDeg: "Average overshoot", meanUndershootDeg: "Average undershoot",
    meanFinalErrorDeg: "Average final angular error", onTargetPercent: "Time on target",
    meanAngularErrorDeg: "Mean angular error", rmsAngularErrorDeg: "RMS angular error",
  };
  return labels[key] ?? key;
}

function metricValue(key: string, value: number) {
  if (key.endsWith("Percent")) return `${value.toFixed(1)}%`;
  if (key.endsWith("Ms")) return `${(value / 1000).toFixed(2)} sec`;
  if (key === "misses") return String(value);
  return `${value.toFixed(2)}°`;
}
