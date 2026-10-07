import { DRILL_CONFIG } from "../../lib/drillConfig";
import type { FlickAttempt, MouseSample, TrackingObservation } from "../../lib/metrics";
import type { MovementStyleEstimate } from "../../lib/metrics/style";
export type DrillType = "flick" | "tracking" | "precision";
export type RoundResult = {
  id: string;
  drill: DrillType;
  candidateLabel: string;
  gameDpi: number;
  startedAt: number;
  endedAt: number;
  mouseSamples: MouseSample[];
  clickTimes: number[];
  cm360?: number;
  flickAttempts?: FlickAttempt[];
  movementStyleEstimate?: MovementStyleEstimate;
  metrics: Record<string, number>;
};

export type GridTarget = {
  gridIndex: number;
  yaw: number;
  pitch: number;
  spawnTime: number;
  startYaw: number;
  startPitch: number;
};

export type DrillState = {
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
  gridTargets: GridTarget[];
};

export const radians = Math.PI / 180;
export const sessionSafeTargetRadius = (radiusDeg: number) => radiusDeg < 1 ? 1.5 : 2.0;

// 24 wide spatial grid nodes for the multi-target flick drill (4 rows x 6 columns).
// Spans -20° to +20° horizontally and +1.5° to +12.0° vertically.
export const GRID_NODES = [
  // Row 0 (Low)
  { yaw: -20 * radians, pitch: 1.5 * radians },
  { yaw: -12 * radians, pitch: 1.5 * radians },
  { yaw: -4 * radians, pitch: 1.5 * radians },
  { yaw: 4 * radians, pitch: 1.5 * radians },
  { yaw: 12 * radians, pitch: 1.5 * radians },
  { yaw: 20 * radians, pitch: 1.5 * radians },

  // Row 1 (Mid-Low)
  { yaw: -20 * radians, pitch: 5.0 * radians },
  { yaw: -12 * radians, pitch: 5.0 * radians },
  { yaw: -4 * radians, pitch: 5.0 * radians },
  { yaw: 4 * radians, pitch: 5.0 * radians },
  { yaw: 12 * radians, pitch: 5.0 * radians },
  { yaw: 20 * radians, pitch: 5.0 * radians },

  // Row 2 (Mid-High)
  { yaw: -20 * radians, pitch: 8.5 * radians },
  { yaw: -12 * radians, pitch: 8.5 * radians },
  { yaw: -4 * radians, pitch: 8.5 * radians },
  { yaw: 4 * radians, pitch: 8.5 * radians },
  { yaw: 12 * radians, pitch: 8.5 * radians },
  { yaw: 20 * radians, pitch: 8.5 * radians },

  // Row 3 (High)
  { yaw: -20 * radians, pitch: 12.0 * radians },
  { yaw: -12 * radians, pitch: 12.0 * radians },
  { yaw: -4 * radians, pitch: 12.0 * radians },
  { yaw: 4 * radians, pitch: 12.0 * radians },
  { yaw: 12 * radians, pitch: 12.0 * radians },
  { yaw: 20 * radians, pitch: 12.0 * radians },
];

export class SoundEngine {
  private ctx: AudioContext | null = null;

  private getContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx || this.ctx.state === "closed") {
      const AudioContextClass = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        this.ctx = new AudioContextClass();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  public playFire() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    try {
      const crackOsc = ctx.createOscillator();
      const crackGain = ctx.createGain();
      crackOsc.type = "sawtooth";
      crackOsc.frequency.setValueAtTime(2200, now);
      crackOsc.frequency.exponentialRampToValueAtTime(60, now + 0.025);
      crackGain.gain.setValueAtTime(0.35, now);
      crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
      crackOsc.connect(crackGain);
      crackGain.connect(ctx.destination);
      crackOsc.start(now);
      crackOsc.stop(now + 0.035);

      const punchOsc = ctx.createOscillator();
      const punchGain = ctx.createGain();
      punchOsc.type = "sine";
      punchOsc.frequency.setValueAtTime(160, now);
      punchOsc.frequency.exponentialRampToValueAtTime(35, now + 0.07);
      punchGain.gain.setValueAtTime(0.4, now);
      punchGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      punchOsc.connect(punchGain);
      punchGain.connect(ctx.destination);
      punchOsc.start(now);
      punchOsc.stop(now + 0.09);

      const boltOsc = ctx.createOscillator();
      const boltGain = ctx.createGain();
      boltOsc.type = "triangle";
      boltOsc.frequency.setValueAtTime(1200, now + 0.015);
      boltOsc.frequency.exponentialRampToValueAtTime(300, now + 0.045);
      boltGain.gain.setValueAtTime(0.001, now);
      boltGain.gain.setValueAtTime(0.18, now + 0.015);
      boltGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      boltOsc.connect(boltGain);
      boltGain.connect(ctx.destination);
      boltOsc.start(now + 0.015);
      boltOsc.stop(now + 0.055);
    } catch {
      // Audio fallback
    }
  }

  public playHit() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime + 0.015;

    try {
      const pingOsc = ctx.createOscillator();
      const pingGain = ctx.createGain();
      pingOsc.type = "triangle";
      pingOsc.frequency.setValueAtTime(1174.66, now);
      pingOsc.frequency.exponentialRampToValueAtTime(1479.98, now + 0.07);
      pingGain.gain.setValueAtTime(0.001, now);
      pingGain.gain.exponentialRampToValueAtTime(0.24, now + 0.004);
      pingGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
      pingOsc.connect(pingGain);
      pingGain.connect(ctx.destination);
      pingOsc.start(now);
      pingOsc.stop(now + 0.13);
    } catch {
      // Audio fallback
    }
  }

  public playMiss() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime + 0.015;

    try {
      const thudOsc = ctx.createOscillator();
      const thudGain = ctx.createGain();
      thudOsc.type = "triangle";
      thudOsc.frequency.setValueAtTime(180, now);
      thudOsc.frequency.exponentialRampToValueAtTime(70, now + 0.08);

      thudGain.gain.setValueAtTime(0.12, now);
      thudGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);

      thudOsc.connect(thudGain);
      thudGain.connect(ctx.destination);
      thudOsc.start(now);
      thudOsc.stop(now + 0.10);
    } catch {
      // Audio fallback
    }
  }

  public dispose() {
    if (this.ctx && this.ctx.state !== "closed") {
      void this.ctx.close();
    }
    this.ctx = null;
  }
}

export const emptyState = (): DrillState => ({
  phase: "idle", type: null, startedAt: 0, countdownEndsAt: 0, targetStartedAt: 0,
  targetIndex: 0, yaw: 0, pitch: 0, startYaw: 0, startPitch: 0, targetYaw: 0,
  targetPitch: 0, farthestProgress: 0, flickAttempts: [], spawnTimes: [],
  observations: [], mouseSamples: [], clickTimes: [], pathSeed: [], gridTargets: [],
});

export function targetAngles(type: DrillType, _index: number, _seed: number[]) {
  if (type === "tracking") {
    // Start position only; live movement comes from the strafe simulator in the render loop.
    const config = DRILL_CONFIG.tracking;
    return { yaw: 0, pitch: ((config.minPitchDeg + config.maxPitchDeg) / 2) * radians };
  }

  const config = DRILL_CONFIG.precision;
  const radius = (config.minAngleDeg + Math.random() * (config.maxAngleDeg - config.minAngleDeg)) * radians;
  const angleDir = (Math.random() - 0.5) * Math.PI * 0.75;

  return {
    yaw: Math.sin(angleDir) * radius,
    pitch: Math.abs(Math.cos(angleDir)) * radius + (2.0 * radians),
  };
}
