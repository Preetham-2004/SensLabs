export type ClickSample = { time: number; hit: boolean; errorDeg: number; timeToHitMs?: number };
export type MouseSample = { time: number; dx: number; dy: number; yaw: number; pitch: number };
export type FlickAttempt = ClickSample & { spawnTime: number; overshootDeg: number; undershootDeg: number };
export type TrackingObservation = { time: number; errorDeg: number; targetRadiusDeg: number };
export type FlickMetrics = { hitRatePercent: number; shotsTaken: number; meanTimeToHitMs: number; misses: number; meanOvershootDeg: number; meanUndershootDeg: number; meanFinalErrorDeg: number };
export type TrackingMetrics = { onTargetPercent: number; meanAngularErrorDeg: number; rmsAngularErrorDeg: number };
export type PrecisionMetrics = { hitRatePercent: number; meanTimeToHitMs: number; meanFinalErrorDeg: number };

const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
const wrapRadians = (value: number) => Math.atan2(Math.sin(value), Math.cos(value));
const toDegrees = (value: number) => value * (180 / Math.PI);

export function angularErrorDegrees(yaw: number, pitch: number, targetYaw: number, targetPitch: number): number {
  return Math.hypot(wrapRadians(targetYaw - yaw), targetPitch - pitch) * (180 / Math.PI);
}

export function forwardProgressRadians(
  startYaw: number, startPitch: number, targetYaw: number, targetPitch: number, yaw: number, pitch: number,
): number {
  const deltaYaw = wrapRadians(targetYaw - startYaw);
  const deltaPitch = targetPitch - startPitch;
  const length = Math.hypot(deltaYaw, deltaPitch) || 1;
  return ((wrapRadians(yaw - startYaw) * deltaYaw) + ((pitch - startPitch) * deltaPitch)) / length;
}

export function calculateFlickErrors(
  startYaw: number, startPitch: number, targetYaw: number, targetPitch: number,
  yaw: number, pitch: number, farthestProgressRadians: number,
) {
  const targetDistanceDeg = Math.hypot(wrapRadians(targetYaw - startYaw), targetPitch - startPitch) * (180 / Math.PI);
  const farthestProgressDeg = toDegrees(farthestProgressRadians);
  return {
    errorDeg: angularErrorDegrees(yaw, pitch, targetYaw, targetPitch),
    overshootDeg: Math.max(0, farthestProgressDeg - targetDistanceDeg),
    undershootDeg: Math.max(0, targetDistanceDeg - farthestProgressDeg),
  };
}

export function calculateFlickMetrics(attempts: FlickAttempt[]): FlickMetrics {
  const hits = attempts.filter((attempt) => attempt.hit);
  return {
    hitRatePercent: attempts.length ? (hits.length / attempts.length) * 100 : 0,
    shotsTaken: attempts.length,
    meanTimeToHitMs: average(hits.map((attempt) => attempt.time - attempt.spawnTime)),
    misses: attempts.length - hits.length,
    meanOvershootDeg: average(attempts.map((attempt) => attempt.overshootDeg)),
    meanUndershootDeg: average(attempts.map((attempt) => attempt.undershootDeg)),
    meanFinalErrorDeg: average(attempts.map((attempt) => attempt.errorDeg)),
  };
}

export function calculateTrackingMetrics(observations: TrackingObservation[]): TrackingMetrics {
  if (observations.length < 2) return { onTargetPercent: 0, meanAngularErrorDeg: 0, rmsAngularErrorDeg: 0 };
  let totalMs = 0; let onTargetMs = 0; let weightedError = 0; let weightedSquaredError = 0;
  for (let index = 1; index < observations.length; index += 1) {
    const previous = observations[index - 1];
    const weightMs = Math.min(Math.max(0, observations[index].time - previous.time), 100);
    totalMs += weightMs;
    weightedError += previous.errorDeg * weightMs;
    weightedSquaredError += previous.errorDeg ** 2 * weightMs;
    if (previous.errorDeg <= previous.targetRadiusDeg) onTargetMs += weightMs;
  }
  return {
    onTargetPercent: totalMs ? (onTargetMs / totalMs) * 100 : 0,
    meanAngularErrorDeg: totalMs ? weightedError / totalMs : 0,
    rmsAngularErrorDeg: totalMs ? Math.sqrt(weightedSquaredError / totalMs) : 0,
  };
}

export function calculatePrecisionMetrics(clicks: Array<ClickSample & { spawnTime?: number }>, spawnTimes: number[]): PrecisionMetrics {
  const hits = clicks.filter((click) => click.hit);
  return {
    hitRatePercent: spawnTimes.length ? (hits.length / spawnTimes.length) * 100 : 0,
    meanTimeToHitMs: average(hits.map((click) => {
      if (click.timeToHitMs !== undefined) return click.timeToHitMs;
      if (click.spawnTime !== undefined) return Math.max(0, click.time - click.spawnTime);
      let spawnTime = spawnTimes[0] ?? click.time;
      for (const time of spawnTimes) if (time <= click.time) spawnTime = time;
      return click.time - spawnTime;
    })),
    meanFinalErrorDeg: average(clicks.map((click) => click.errorDeg)),
  };
}
