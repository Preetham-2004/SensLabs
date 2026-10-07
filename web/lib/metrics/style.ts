import { DRILL_CONFIG } from "../drillConfig";
import type { FlickAttempt, MouseSample } from "./index";

export type MovementStyleStatus = "calibrated" | "uncalibrated" | "not enough data";
export type MovementBreakdown = { smallPercent: number; mediumPercent: number; largePercent: number; mixed: boolean };

export type FlickMovementMeasurement = {
  spawnTime: number;
  clickTime: number;
  distanceCm: number;
  peakSpeedCmPerSecond: number;
  corrections: number;
};

export type MovementStyleEstimate = {
  status: MovementStyleStatus;
  breakdown: MovementBreakdown | null;
  cm360: number;
  validFlickCount: number;
  medianDistanceCm: number | null;
  medianPeakSpeedCmPerSecond: number | null;
  medianCorrections: number | null;
  flicks: FlickMovementMeasurement[];
};

export type MovementStyleInput = {
  mouseSamples: MouseSample[];
  clickTimes: number[];
  flickAttempts: FlickAttempt[];
  dpi: number;
  cm360: number;
};

export type MovementStyleReplayRecording = MovementStyleInput & { version?: number };

const median = (values: number[]): number | null => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
};

function correctionsAfterMainMovement(samples: MouseSample[]): number {
  const dx = samples.reduce((sum, sample) => sum + sample.dx, 0);
  const dy = samples.reduce((sum, sample) => sum + sample.dy, 0);
  const total = Math.hypot(dx, dy);
  if (total === 0) return 0;

  const directionX = dx / total;
  const directionY = dy / total;
  const projectedSteps = samples.map((sample) => sample.dx * directionX + sample.dy * directionY);
  let progress = 0;
  let farthestProgress = 0;
  let mainMovementEnd = -1;
  for (let index = 0; index < projectedSteps.length; index += 1) {
    progress += projectedSteps[index];
    if (progress > farthestProgress) {
      farthestProgress = progress;
      mainMovementEnd = index;
    }
  }

  let corrections = 0;
  let inCorrection = false;
  for (const step of projectedSteps.slice(mainMovementEnd + 1)) {
    if (step < 0) {
      if (!inCorrection) corrections += 1;
      inCorrection = true;
    } else {
      inCorrection = false;
    }
  }
  return corrections;
}

function percentageBreakdown(small: number, medium: number, large: number, total: number): MovementBreakdown {
  const raw = [small, medium, large].map((count) => (count / total) * 100);
  const whole = raw.map(Math.floor);
  let remainder = 100 - whole.reduce((sum, value) => sum + value, 0);
  const order = raw.map((value, index) => ({ index, remainder: value - whole[index] }))
    .sort((left, right) => right.remainder - left.remainder);
  for (let index = 0; index < remainder; index += 1) whole[order[index].index] += 1;

  const rules = DRILL_CONFIG.movementStyle;
  return {
    smallPercent: whole[0],
    mediumPercent: whole[1],
    largePercent: whole[2],
    mixed: small / total >= rules.meaningfulGroupShare && large / total >= rules.meaningfulGroupShare,
  };
}

export function breakdownForDistances(
  distancesCm: number[],
  cutoffsCm: { smallMaxCm: number; mediumMaxCm: number } | null,
): { status: MovementStyleStatus; breakdown: MovementBreakdown | null } {
  if (!cutoffsCm) return { status: "uncalibrated", breakdown: null };
  if (distancesCm.length < DRILL_CONFIG.movementStyle.minimumValidFlicks) {
    return { status: "not enough data", breakdown: null };
  }

  const smallCount = distancesCm.filter((distance) => distance <= cutoffsCm.smallMaxCm).length;
  const mediumCount = distancesCm.filter((distance) => distance > cutoffsCm.smallMaxCm && distance <= cutoffsCm.mediumMaxCm).length;
  const largeCount = distancesCm.length - smallCount - mediumCount;
  return {
    status: "calibrated",
    breakdown: percentageBreakdown(smallCount, mediumCount, largeCount, distancesCm.length),
  };
}

export function calculateMovementStyle(input: MovementStyleInput): MovementStyleEstimate {
  if (!Number.isFinite(input.dpi) || input.dpi <= 0) throw new Error("DPI must be a positive number.");
  if (!Number.isFinite(input.cm360) || input.cm360 <= 0) throw new Error("cm/360 must be a positive number.");

  const countsPerCm = input.dpi / 2.54;
  const samples = [...input.mouseSamples].filter((sample) =>
    Number.isFinite(sample.time) && Number.isFinite(sample.dx) && Number.isFinite(sample.dy),
  ).sort((a, b) => a.time - b.time);
  const flicks: FlickMovementMeasurement[] = [];
  const pairCount = Math.min(input.clickTimes.length, input.flickAttempts.length);

  for (let index = 0; index < pairCount; index += 1) {
    const attempt = input.flickAttempts[index];
    const clickTime = input.clickTimes[index];
    if (!Number.isFinite(attempt.spawnTime) || !Number.isFinite(clickTime) || clickTime < attempt.spawnTime) continue;

    const movement = samples.filter((sample) => sample.time >= attempt.spawnTime && sample.time <= clickTime);
    const distanceCounts = movement.reduce((sum, sample) => sum + Math.hypot(sample.dx, sample.dy), 0);
    let peakSpeedCmPerSecond = 0;
    let previousTime = attempt.spawnTime;
    for (const sample of movement) {
      const elapsedSeconds = (sample.time - previousTime) / 1000;
      if (elapsedSeconds > 0) {
        const speed = Math.hypot(sample.dx, sample.dy) / countsPerCm / elapsedSeconds;
        peakSpeedCmPerSecond = Math.max(peakSpeedCmPerSecond, speed);
      }
      previousTime = sample.time;
    }

    flicks.push({
      spawnTime: attempt.spawnTime,
      clickTime,
      distanceCm: distanceCounts / countsPerCm,
      peakSpeedCmPerSecond,
      corrections: correctionsAfterMainMovement(movement),
    });
  }

  const validFlicks = flicks.filter((flick) => flick.distanceCm > 0);
  const { status, breakdown } = breakdownForDistances(
    validFlicks.map((flick) => flick.distanceCm),
    DRILL_CONFIG.movementStyle.distanceCutoffsCm,
  );

  return {
    status,
    breakdown,
    cm360: input.cm360,
    validFlickCount: validFlicks.length,
    medianDistanceCm: median(validFlicks.map((flick) => flick.distanceCm)),
    medianPeakSpeedCmPerSecond: median(validFlicks.map((flick) => flick.peakSpeedCmPerSecond)),
    medianCorrections: median(validFlicks.map((flick) => flick.corrections)),
    flicks,
  };
}

export function replayMovementStyleRecording(recordingJson: string): MovementStyleEstimate {
  const recording = JSON.parse(recordingJson) as MovementStyleReplayRecording;
  if (!recording || !Array.isArray(recording.mouseSamples) || !Array.isArray(recording.clickTimes) || !Array.isArray(recording.flickAttempts)) {
    throw new Error("Recording must include mouseSamples, clickTimes, and flickAttempts.");
  }
  return calculateMovementStyle(recording);
}
