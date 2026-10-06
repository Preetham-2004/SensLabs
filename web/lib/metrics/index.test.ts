import { describe, expect, it } from "vitest";
import { angularErrorDegrees, calculateFlickErrors, calculateFlickMetrics, calculatePrecisionMetrics, calculateTrackingMetrics, forwardProgressRadians } from "./index";

describe("drill metrics with fake mouse-session data", () => {
  it("measures angular error and progress past a flick target", () => {
    expect(angularErrorDegrees(0, 0, Math.PI / 4, 0)).toBeCloseTo(45);
    const progress = forwardProgressRadians(0, 0, Math.PI / 4, 0, Math.PI / 3, 0);
    expect(calculateFlickErrors(0, 0, Math.PI / 4, 0, Math.PI / 3, 0, progress)).toMatchObject({
      errorDeg: 15, overshootDeg: 15, undershootDeg: 0,
    });
  });

  it("calculates flick hit rate, time, misses, and errors", () => {
    const result = calculateFlickMetrics([
      { spawnTime: 100, time: 300, hit: true, errorDeg: 0.5, overshootDeg: 1, undershootDeg: 0 },
      { spawnTime: 400, time: 900, hit: false, errorDeg: 3, overshootDeg: 0, undershootDeg: 3 },
    ]);
    expect(result.hitRatePercent).toBe(50); expect(result.meanTimeToHitMs).toBe(200);
    expect(result.misses).toBe(1); expect(result.meanOvershootDeg).toBe(0.5);
    expect(result.meanUndershootDeg).toBe(1.5); expect(result.meanFinalErrorDeg).toBe(1.75);
  });

  it("weights tracking errors by elapsed time", () => {
    const result = calculateTrackingMetrics([
      { time: 0, errorDeg: 0, targetRadiusDeg: 1 },
      { time: 100, errorDeg: 2, targetRadiusDeg: 1 },
      { time: 200, errorDeg: 2, targetRadiusDeg: 1 },
    ]);
    expect(result.onTargetPercent).toBe(50); expect(result.meanAngularErrorDeg).toBe(1);
    expect(result.rmsAngularErrorDeg).toBeCloseTo(Math.sqrt(2));
  });

  it("calculates precision hits, hit time, and final error", () => {
    const result = calculatePrecisionMetrics([
      { time: 250, hit: true, errorDeg: 0.2 }, { time: 700, hit: false, errorDeg: 1.2 },
    ], [100, 500]);
    expect(result.hitRatePercent).toBe(50); expect(result.meanTimeToHitMs).toBe(150);
    expect(result.meanFinalErrorDeg).toBeCloseTo(0.7);
  });
});
