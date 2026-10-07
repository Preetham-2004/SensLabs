import { describe, expect, it } from "vitest";
import type { FlickAttempt, MouseSample } from "./index";
import { breakdownForDistances, calculateMovementStyle, replayMovementStyleRecording, type MovementStyleInput } from "./style";

function makeInput(distancesCm: number[], speedCmPerSecond: number[], cm360 = 35): MovementStyleInput {
  const dpi = 254;
  const countsPerCm = dpi / 2.54;
  const mouseSamples: MouseSample[] = [];
  const clickTimes: number[] = [];
  const flickAttempts: FlickAttempt[] = [];

  distancesCm.forEach((distanceCm, index) => {
    const spawnTime = index * 2000;
    const movementDurationMs = (distanceCm / speedCmPerSecond[index]) * 1000;
    const clickTime = spawnTime + 1000;
    mouseSamples.push({
      time: spawnTime + movementDurationMs,
      dx: distanceCm * countsPerCm,
      dy: 0,
      yaw: 0,
      pitch: 0,
    });
    clickTimes.push(clickTime);
    flickAttempts.push({ spawnTime, time: clickTime, hit: true, errorDeg: 0, overshootDeg: 0, undershootDeg: 0 });
  });

  return { mouseSamples, clickTimes, flickAttempts, dpi, cm360 };
}

describe("calculateMovementStyle", () => {
  it("measures a 10 cm flick from mouse counts", () => {
    const input = makeInput([10], [20]);
    input.dpi = 25.4;
    input.mouseSamples[0].dx = 100;
    expect(calculateMovementStyle(input).flicks[0].distanceCm).toBeCloseTo(10, 6);
  });

  it("shows uncalibrated when no real distance cutoffs are configured", () => {
    const result = calculateMovementStyle(makeInput(Array(10).fill(4), Array(10).fill(20)));
    expect(result.status).toBe("uncalibrated");
    expect(result.breakdown).toBeNull();
  });

  it("reports category shares that add up to 100 percent", () => {
    const result = breakdownForDistances([1, 2, 3, 4, 5, 7, 8, 9, 13, 14], { smallMaxCm: 5, mediumMaxCm: 10 });
    expect(result.status).toBe("calibrated");
    expect(result.breakdown!.smallPercent + result.breakdown!.mediumPercent + result.breakdown!.largePercent).toBe(100);
    expect(result.breakdown).toMatchObject({ smallPercent: 50, mediumPercent: 30, largePercent: 20, mixed: true });
  });

  it("does not call a set of only small movements mixed", () => {
    const result = breakdownForDistances(Array(10).fill(4), { smallMaxCm: 5, mediumMaxCm: 10 });
    expect(result.breakdown).toMatchObject({ smallPercent: 100, mediumPercent: 0, largePercent: 0, mixed: false });
  });

  it("requires at least ten flicks for a calibrated breakdown", () => {
    const result = breakdownForDistances(Array(9).fill(4), { smallMaxCm: 5, mediumMaxCm: 10 });
    expect(result.status).toBe("not enough data");
    expect(result.breakdown).toBeNull();
  });

  it("handles zero movement without throwing", () => {
    const input = makeInput([0], [20]);
    input.mouseSamples[0].dx = 0;
    expect(() => calculateMovementStyle(input)).not.toThrow();
    expect(calculateMovementStyle(input).flicks[0].distanceCm).toBe(0);
    expect(calculateMovementStyle(input).status).toBe("uncalibrated");
  });

  it("stores the round cm/360 with the same physical movement", () => {
    const input = makeInput([10], [20], 30);
    const first = calculateMovementStyle(input);
    const second = calculateMovementStyle({ ...input, cm360: 50 });
    expect(first.flicks[0].distanceCm).toBe(second.flicks[0].distanceCm);
    expect(first.cm360).toBe(30);
    expect(second.cm360).toBe(50);
  });

  it("counts correction movements after the main forward movement", () => {
    const input = makeInput([1], [20]);
    input.mouseSamples = [20, 10, -3, -3, 1, -3, -3].map((dx, index) => ({
      time: (index + 1) * 50,
      dx,
      dy: 0,
      yaw: 0,
      pitch: 0,
    }));
    expect(calculateMovementStyle(input).flicks[0].corrections).toBe(2);
  });

  it("replays an exported raw recording", () => {
    const input = makeInput([10], [20], 42);
    input.dpi = 25.4;
    input.mouseSamples[0].dx = 100;
    const replayed = replayMovementStyleRecording(JSON.stringify(input));
    expect(replayed.medianDistanceCm).toBeCloseTo(10, 6);
    expect(replayed.cm360).toBe(42);
    expect(replayed.status).toBe("uncalibrated");
  });
});
