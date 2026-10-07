"use client";

import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import * as THREE from "three";
import { DRILL_CONFIG } from "../../lib/drillConfig";
import {
  angularErrorDegrees,
  calculateFlickMetrics,
  calculateFlickErrors,
  calculatePrecisionMetrics,
  calculateTrackingMetrics,
  forwardProgressRadians,
} from "../../lib/metrics";
import { calculateMovementStyle } from "../../lib/metrics/style";
import { emptyState, sessionSafeTargetRadius, SoundEngine, targetAngles, GRID_NODES, radians, type DrillState, type GridTarget, type RoundResult } from "./model";
import { createTrainingScene } from "./createTrainingScene";

type DrillPhase = DrillState["phase"];
type DrillEngineOptions = {
  baselineCounts: number;
  candidateLabel: string | null;
  gameDpi: number | null;
  getTrackingSpeed: () => number;
  setAccuracy: Dispatch<SetStateAction<number>>;
  setPanelOpen: Dispatch<SetStateAction<boolean>>;
  setResult: Dispatch<SetStateAction<RoundResult | null>>;
  setHistory: Dispatch<SetStateAction<RoundResult[]>>;
  setPhase: Dispatch<SetStateAction<DrillPhase>>;
  setPoints: Dispatch<SetStateAction<number>>;
  setCountdown: Dispatch<SetStateAction<number>>;
  setTargetNumber: Dispatch<SetStateAction<number>>;
  setError: Dispatch<SetStateAction<string>>;
};

export function useDrillEngine({
  baselineCounts,
  candidateLabel,
  gameDpi,
  getTrackingSpeed,
  setAccuracy,
  setPanelOpen,
  setResult,
  setHistory,
  setPhase,
  setPoints,
  setCountdown,
  setTargetNumber,
  setError,
}: DrillEngineOptions) {
  const hostRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const stateRef = useRef<DrillState>(emptyState());
  const scoreRef = useRef({ hits: 0, attempts: 0 });
  const soundEngineRef = useRef<SoundEngine | null>(null);
  const toolGroupRef = useRef<THREE.Group | null>(null);
  const muzzleFlashMatRef = useRef<THREE.MeshBasicMaterial | null>(null);
  const targetMeshesRef = useRef<THREE.Mesh[]>([]);

  useEffect(() => {

    const soundEngine = new SoundEngine();
    soundEngineRef.current = soundEngine;
    const currentBaselineCounts = baselineCounts;
    const currentCandidateLabel = candidateLabel;
    const currentGameDpi = gameDpi;
    const host = hostRef.current;
    if (!host) return;

    const { scene, camera, renderer } = createTrainingScene(host, cameraRef, toolGroupRef, muzzleFlashMatRef, targetMeshesRef);
    const targetMeshes = targetMeshesRef.current;

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

    // Helper: Position target mesh i at specified yaw & pitch (Clean sphere, no outlines)
    const placeTargetMesh = (
      meshIndex: number,
      yaw: number,
      pitch: number,
      radiusDeg: number,
      distance = 12,
      minimumVisibleRadiusDeg = sessionSafeTargetRadius(radiusDeg),
    ) => {
      const targetMesh = targetMeshes[meshIndex];
      if (!targetMesh) return;

      const boundedPitch = Math.max(pitch, 0.025);
      const local = new THREE.Vector3(
        Math.sin(yaw) * Math.cos(boundedPitch),
        Math.sin(boundedPitch),
        -Math.cos(yaw) * Math.cos(boundedPitch)
      );
      targetMesh.position.copy(camera.position).add(local.multiplyScalar(distance));
      targetMesh.lookAt(camera.position);

      const visibleRadiusDeg = Math.max(radiusDeg, minimumVisibleRadiusDeg);
      const radius = distance * Math.tan(visibleRadiusDeg * radians);
      targetMesh.geometry.dispose();
      targetMesh.geometry = new THREE.SphereGeometry(radius, 32, 24);
      targetMesh.scale.setScalar(1);
      targetMesh.visible = true;
    };

    // Helper: select an unoccupied grid node from the multi-target flick layout.
    const spawnMultiTargetFlickTarget = (session: DrillState, slotIndex: number, now: number) => {
      const occupiedIndices = new Set(session.gridTargets.map((gt) => gt.gridIndex));
      const availableIndices: number[] = [];
      for (let i = 0; i < GRID_NODES.length; i++) {
        if (!occupiedIndices.has(i)) availableIndices.push(i);
      }

      if (availableIndices.length === 0) return;
      const randomIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
      const node = GRID_NODES[randomIndex];

      const newTarget: GridTarget = {
        gridIndex: randomIndex,
        yaw: node.yaw,
        pitch: node.pitch,
        spawnTime: now,
        startYaw: session.yaw,
        startPitch: session.pitch,
      };

      if (slotIndex >= 0 && slotIndex < session.gridTargets.length) {
        session.gridTargets[slotIndex] = newTarget;
      } else {
        session.gridTargets.push(newTarget);
      }
    };

    const spawnTarget = (session: DrillState, now: number) => {
      if (!session.type) return;

      if (session.type === "flick") {
        // Multi-target flick mode: three simultaneous targets on the wide grid.
        session.gridTargets = [];
        spawnMultiTargetFlickTarget(session, 0, now);
        spawnMultiTargetFlickTarget(session, 1, now);
        spawnMultiTargetFlickTarget(session, 2, now);
        session.targetStartedAt = now;
        session.startYaw = session.yaw;
        session.startPitch = session.pitch;
        session.spawnTimes.push(now);
        setTargetNumber(0);
        return;
      }

      const angle = targetAngles(session.type, session.targetIndex, session.pathSeed);
      session.targetYaw = angle.yaw;
      session.targetPitch = Math.max(angle.pitch, 0.025);
      session.targetStartedAt = now;
      session.startYaw = session.yaw;
      session.startPitch = session.pitch;
      session.farthestProgress = 0;
      const radius = session.type === "precision" ? DRILL_CONFIG.precision.targetRadiusDeg : DRILL_CONFIG.flick.targetRadiusDeg;
      if (session.type === "precision") {
        placeTargetMesh(0, session.targetYaw, session.targetPitch, radius, DRILL_CONFIG.precision.distance, radius);
      } else {
        placeTargetMesh(0, session.targetYaw, session.targetPitch, radius);
      }
      session.spawnTimes.push(now);
      setTargetNumber(session.targetIndex + 1);
    };

    const finish = (now: number) => {
      const session = stateRef.current;
      if (!session.type) return;

      targetMeshes.forEach((m) => { m.visible = false; });

      let metrics: Record<string, number>;
      if (session.type === "flick") {
        metrics = { ...calculateFlickMetrics(session.flickAttempts) };
      } else if (session.type === "tracking") {
        metrics = { ...calculateTrackingMetrics(session.observations) };
      } else {
        metrics = { ...calculatePrecisionMetrics(session.flickAttempts.map(({ time, hit, errorDeg }) => ({ time, hit, errorDeg })), session.spawnTimes) };
      }
      setAccuracy(Number((metrics.hitRatePercent ?? metrics.onTargetPercent ?? 0).toFixed(1)));

      const cm360 = currentGameDpi && currentBaselineCounts > 0
        ? (2 * currentBaselineCounts * 2.54) / currentGameDpi
        : null;
      const movementStyleEstimate = session.type === "flick" && cm360 !== null
        ? calculateMovementStyle({
            mouseSamples: session.mouseSamples,
            clickTimes: session.clickTimes,
            flickAttempts: session.flickAttempts,
            dpi: currentGameDpi!,
            cm360,
          })
        : undefined;

      const round: RoundResult = {
        id: crypto.randomUUID(),
        drill: session.type,
        candidateLabel: currentCandidateLabel ?? "Unknown setting",
        gameDpi: currentGameDpi ?? 0,
        startedAt: session.startedAt,
        endedAt: now,
        mouseSamples: [...session.mouseSamples],
        clickTimes: [...session.clickTimes],
        ...(cm360 !== null ? { cm360 } : {}),
        ...(session.type === "flick" ? {
          flickAttempts: [...session.flickAttempts],
        } : {}),
        ...(movementStyleEstimate ? { movementStyleEstimate } : {}),
        metrics,
      };

      setResult(round);
      setHistory((previous) => [...previous, round]);
      session.phase = "results";
      setPhase("results");
      setPanelOpen(true);
      if (document.pointerLockElement === canvas) document.exitPointerLock();
    };

    const recordAttempt = (now: number, timedOut = false) => {
      const session = stateRef.current;
      if (!session.type || session.type !== "precision") return;
      const radius = DRILL_CONFIG.precision.targetRadiusDeg;
      const { errorDeg, overshootDeg, undershootDeg } = calculateFlickErrors(
        session.startYaw, session.startPitch, session.targetYaw, session.targetPitch,
        session.yaw, session.pitch, session.farthestProgress,
      );
      const hit = !timedOut && errorDeg <= radius;
      if (hit) soundEngine.playHit();
      else soundEngine.playMiss();

      scoreRef.current.attempts += 1;
      if (hit) scoreRef.current.hits += 1;
      setPoints((value) => value + (hit ? 100 : -100));
      setAccuracy(Number(((scoreRef.current.hits / scoreRef.current.attempts) * 100).toFixed(1)));
      session.flickAttempts.push({ spawnTime: session.targetStartedAt, time: now, hit, errorDeg, overshootDeg, undershootDeg });

      if (session.flickAttempts.length >= DRILL_CONFIG.precision.targetCount) { finish(now); return; }
      session.targetIndex += 1;
      spawnTarget(session, now);
    };

    const onMouseMove = (event: MouseEvent) => {
      const session = stateRef.current;
      if (document.pointerLockElement !== canvas || session.phase !== "active") return;
      const now = performance.now();
      const degreesPerCount = currentBaselineCounts > 0 ? 180 / currentBaselineCounts : 0.08;
      session.yaw += event.movementX * degreesPerCount * radians;
      session.pitch = THREE.MathUtils.clamp(session.pitch - event.movementY * degreesPerCount * radians, -75 * radians, 75 * radians);
      session.yaw = THREE.MathUtils.clamp(session.yaw, -Math.PI, Math.PI);
      camera.rotation.set(session.pitch, -session.yaw, 0, "YXZ");
      session.mouseSamples.push({ time: now, dx: event.movementX, dy: event.movementY, yaw: session.yaw, pitch: session.pitch });
      if (session.type !== "tracking") {
        session.farthestProgress = Math.max(session.farthestProgress, forwardProgressRadians(
          session.startYaw, session.startPitch, session.targetYaw, session.targetPitch, session.yaw, session.pitch,
        ));
      }
    };

    const flickErrorsForTarget = (session: DrillState, target: GridTarget, now: number) => {
      let farthestProgress = 0;
      for (const sample of session.mouseSamples) {
        if (sample.time < target.spawnTime || sample.time > now) continue;
        farthestProgress = Math.max(farthestProgress, forwardProgressRadians(
          target.startYaw, target.startPitch, target.yaw, target.pitch, sample.yaw, sample.pitch,
        ));
      }
      return calculateFlickErrors(
        target.startYaw, target.startPitch, target.yaw, target.pitch,
        session.yaw, session.pitch, farthestProgress,
      );
    };

    const triggerGunRecoil = () => {
      soundEngine.playFire();

      if (toolGroupRef.current) {
        toolGroupRef.current.position.z = -0.46;
        toolGroupRef.current.rotation.x = 0.04;
      }
      if (muzzleFlashMatRef.current) {
        muzzleFlashMatRef.current.opacity = 0.95;
      }
    };

    const onTargetClick = () => {
      const session = stateRef.current;
      if (document.pointerLockElement !== canvas) return;
      if (session.phase === "countdown" || session.phase !== "active") return;
      // Tracking is a pure trace drill: the gun cannot be fired.
      if (session.type === "tracking") return;
      const now = performance.now();
      session.clickTimes.push(now);

      triggerGunRecoil();

      // Multi-target flick drill click logic.
      if (session.type === "flick") {
        let bestSlotIndex = -1;
        let minErrorDeg = Infinity;
        const radius = DRILL_CONFIG.flick.targetRadiusDeg;

        for (let i = 0; i < session.gridTargets.length; i++) {
          const gt = session.gridTargets[i];
          const errorDeg = angularErrorDegrees(session.yaw, session.pitch, gt.yaw, gt.pitch);
          if (errorDeg < minErrorDeg) {
            minErrorDeg = errorDeg;
            bestSlotIndex = i;
          }
        }

        scoreRef.current.attempts += 1;
        if (bestSlotIndex >= 0 && minErrorDeg <= radius) {
          // HIT! Respawn target at another open grid node
          soundEngine.playHit();
          const hitTarget = session.gridTargets[bestSlotIndex];
          const flickErrors = flickErrorsForTarget(session, hitTarget, now);
          session.flickAttempts.push({ spawnTime: hitTarget.spawnTime, time: now, hit: true, ...flickErrors });
          scoreRef.current.hits += 1;
          setPoints((v) => v + 100);

          session.targetIndex += 1;
          setTargetNumber(session.targetIndex);

          if (session.targetIndex >= DRILL_CONFIG.flick.targetCount) {
            finish(now);
            return;
          }

          spawnMultiTargetFlickTarget(session, bestSlotIndex, now);
        } else {
          // MISS!
          soundEngine.playMiss();
          const nearestTarget = session.gridTargets[bestSlotIndex];
          if (!nearestTarget) return;
          const flickErrors = flickErrorsForTarget(session, nearestTarget, now);
          session.flickAttempts.push({
            spawnTime: nearestTarget.spawnTime,
            time: now,
            hit: false,
            ...flickErrors,
          });
          setPoints((v) => v - 100);
        }
        setAccuracy(Number(((scoreRef.current.hits / scoreRef.current.attempts) * 100).toFixed(1)));
        return;
      }

      recordAttempt(now);
    };

    const onLockChange = () => {
      if (document.pointerLockElement !== canvas) {
        const session = stateRef.current;
        if (session.phase === "active") setError("Mouse released. Click the range to capture it again or press Esc to stop.");
      }
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

    // --- FPS-STYLE STRAFE SIMULATOR (tracking drill) ---
    // Mimics an enemy doing A/D strafes: quick direction changes, varied speeds,
    // short pauses, crouch/stand height changes and occasional jumps.
    const strafe = {
      yaw: 0, pitch: 0, basePitch: 0, basePitchTarget: 0,
      vel: 0, targetVel: 0, speed: 1, nextChangeAt: 0, jumpStart: -1, lastNow: 0,
    };
    const randRange = (min: number, max: number) => min + Math.random() * (max - min);

    const resetStrafe = (now: number) => {
      const c = DRILL_CONFIG.tracking;
      const start = targetAngles("tracking", 0, []);
      strafe.yaw = start.yaw;
      strafe.basePitch = start.pitch;
      strafe.basePitchTarget = start.pitch;
      strafe.pitch = start.pitch;
      strafe.vel = 0;
      strafe.speed = getTrackingSpeed();
      strafe.targetVel = (Math.random() < 0.5 ? -1 : 1) * randRange(c.minSpeedDegPerSec, c.maxSpeedDegPerSec) * strafe.speed * radians;
      strafe.nextChangeAt = now + randRange(c.minStrafeMs, c.maxStrafeMs);
      strafe.jumpStart = -1;
      strafe.lastNow = now;
    };

    const pickNextStrafe = (now: number) => {
      const c = DRILL_CONFIG.tracking;
      const limit = c.maxYawDeg * radians;
      const currentDir = Math.sign(strafe.targetVel) || (Math.random() < 0.5 ? -1 : 1);
      // Mostly reverse (ADAD), sometimes keep direction with a new speed
      let dir = Math.random() < 0.75 ? -currentDir : currentDir;
      // Steer back toward the centre when near the edges
      if (strafe.yaw > limit * 0.55) dir = -1;
      if (strafe.yaw < -limit * 0.55) dir = 1;
      const speed = randRange(c.minSpeedDegPerSec, c.maxSpeedDegPerSec) * strafe.speed * radians;
      // Brief counter-strafe stop now and then
      strafe.targetVel = Math.random() < 0.1 ? 0 : dir * speed;
      strafe.nextChangeAt = now + randRange(c.minStrafeMs, c.maxStrafeMs);
      // Crouch / stand height change
      if (Math.random() < 0.3) {
        strafe.basePitchTarget = randRange(c.minPitchDeg, c.maxPitchDeg - c.jumpHeightDeg) * radians;
      }
      // Occasional jump
      if (strafe.jumpStart < 0 && Math.random() < c.jumpChance) strafe.jumpStart = now;
    };

    const updateStrafe = (now: number) => {
      const c = DRILL_CONFIG.tracking;
      const dt = Math.min(Math.max((now - strafe.lastNow) / 1000, 0), 0.05);
      strafe.lastNow = now;
      if (now >= strafe.nextChangeAt) pickNextStrafe(now);

      // Accelerate toward the target velocity (snappy, like a player changing direction)
      strafe.vel += (strafe.targetVel - strafe.vel) * (1 - Math.exp(-c.accelPerSec * strafe.speed * dt));
      strafe.yaw += strafe.vel * dt;

      const limit = c.maxYawDeg * radians;
      if (Math.abs(strafe.yaw) > limit) {
        const side = Math.sign(strafe.yaw);
        strafe.yaw = side * limit;
        strafe.targetVel = -side * Math.abs(strafe.targetVel || randRange(c.minSpeedDegPerSec, c.maxSpeedDegPerSec) * radians);
        strafe.vel *= -0.3;
      }

      // Vertical: smooth crouch/stand plus jump arc
      strafe.basePitch += (strafe.basePitchTarget - strafe.basePitch) * (1 - Math.exp(-4 * dt));
      let jumpOffset = 0;
      if (strafe.jumpStart >= 0) {
        const t = (now - strafe.jumpStart) / c.jumpDurationMs;
        if (t >= 1) strafe.jumpStart = -1;
        else jumpOffset = 4 * t * (1 - t) * c.jumpHeightDeg * radians;
      }
      strafe.pitch = THREE.MathUtils.clamp(strafe.basePitch + jumpOffset, c.minPitchDeg * radians, c.maxPitchDeg * radians);
    };

    let animFrameId = 0;
    let lastAccuracyUpdate = 0;
    let lastTrackingScoreUpdate = 0;
    let trackingScoreStartIndex = 0;

    const render = (frameTime: number) => {
      const session = stateRef.current;
      const now = performance.now();

      // Smooth sidearm and arm recoil recovery
      if (toolGroupRef.current) {
        toolGroupRef.current.position.z = THREE.MathUtils.lerp(toolGroupRef.current.position.z, -0.52, 0.25);
        toolGroupRef.current.rotation.x = THREE.MathUtils.lerp(toolGroupRef.current.rotation.x, -0.05, 0.25);
      }
      if (muzzleFlashMatRef.current) {
        muzzleFlashMatRef.current.opacity = THREE.MathUtils.lerp(muzzleFlashMatRef.current.opacity, 0, 0.35);
      }

      if (session.phase === "countdown") {
        if (now >= session.countdownEndsAt) {
          session.phase = "active";
          session.startedAt = now;
          session.targetIndex = 0;
          setPoints(0);
          setAccuracy(0);
          scoreRef.current = { hits: 0, attempts: 0 };
          lastAccuracyUpdate = frameTime;
          lastTrackingScoreUpdate = frameTime;
          trackingScoreStartIndex = 0;
          session.mouseSamples = [];
          session.clickTimes = [];
          session.flickAttempts = [];
          session.spawnTimes = [];
          session.observations = [];
          if (session.type === "tracking") resetStrafe(now);
          setPhase("active");
          spawnTarget(session, now);
        }
      } else if (session.phase === "active" && session.type) {
        if (session.type === "flick") {
          // Render the three active multi-target flick targets across the wide grid.
          for (let i = 0; i < 3; i++) {
            const gt = session.gridTargets[i];
            if (gt) {
              placeTargetMesh(i, gt.yaw, gt.pitch, DRILL_CONFIG.flick.targetRadiusDeg);
            } else {
              if (targetMeshes[i]) targetMeshes[i].visible = false;
            }
          }
        } else if (session.type === "tracking") {
          const elapsed = now - session.startedAt;
          updateStrafe(now);
          const path = { yaw: strafe.yaw, pitch: strafe.pitch };
          session.targetYaw = path.yaw;
          session.targetPitch = path.pitch;
          placeTargetMesh(0, path.yaw, path.pitch, DRILL_CONFIG.tracking.targetRadiusDeg);
          if (targetMeshes[1]) targetMeshes[1].visible = false;
          if (targetMeshes[2]) targetMeshes[2].visible = false;

          session.observations.push({
            time: now,
            errorDeg: angularErrorDegrees(session.yaw, session.pitch, path.yaw, path.pitch),
            targetRadiusDeg: DRILL_CONFIG.tracking.targetRadiusDeg,
          });

          if (frameTime - lastAccuracyUpdate >= 100 && session.observations.length > 0) {
            const trackingMetrics = calculateTrackingMetrics(session.observations);
            setAccuracy(Number(trackingMetrics.onTargetPercent.toFixed(1)));
            lastAccuracyUpdate = frameTime;
          }
          if (frameTime - lastTrackingScoreUpdate >= 1000) {
            const recentObservations = session.observations.slice(trackingScoreStartIndex);
            if (recentObservations.length > 0) {
              const recentHits = recentObservations.filter((observation) => observation.errorDeg <= observation.targetRadiusDeg).length;
              setPoints((value) => value + (recentHits >= recentObservations.length / 2 ? 100 : -100));
              trackingScoreStartIndex = session.observations.length;
            }
            lastTrackingScoreUpdate = frameTime;
          }
          if (elapsed >= DRILL_CONFIG.tracking.durationMs) finish(now);
        } else {
          // Precision mode (Single target)
          placeTargetMesh(
            0,
            session.targetYaw,
            session.targetPitch,
            DRILL_CONFIG.precision.targetRadiusDeg,
            DRILL_CONFIG.precision.distance,
            DRILL_CONFIG.precision.targetRadiusDeg,
          );
          if (targetMeshes[1]) targetMeshes[1].visible = false;
          if (targetMeshes[2]) targetMeshes[2].visible = false;

          const timeout = DRILL_CONFIG.precision.targetTimeoutMs;
          if (now - session.targetStartedAt >= timeout) recordAttempt(now, true);
        }

        if (session.type === "tracking") {
          setCountdown(Math.max(0, Math.ceil((DRILL_CONFIG.tracking.durationMs - (now - session.startedAt)) / 1000)));
        }
      }

      if (session.phase === "active") camera.rotation.set(session.pitch, -session.yaw, 0, "YXZ");
      renderer.render(scene, camera);
      animFrameId = requestAnimationFrame(render);
    };

    render(0);

    return () => {
      cancelAnimationFrame(animFrameId);
      observer.disconnect();
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("click", onTargetClick);
      canvas.removeEventListener("click", onCanvasClick);
      document.removeEventListener("pointerlockchange", onLockChange);
      if (document.pointerLockElement === canvas) document.exitPointerLock();
      soundEngine.dispose();
      soundEngineRef.current = null;
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
      cameraRef.current = null;
    };
  }, [baselineCounts, candidateLabel, gameDpi]);

  return { hostRef, cameraRef, stateRef, scoreRef };
}
