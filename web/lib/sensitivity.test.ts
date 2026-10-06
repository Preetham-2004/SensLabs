import { describe, expect, it } from "vitest";
import { degreesPerCount, gameSensitivityForCm360 } from "./sensitivity";

describe("degreesPerCount", () => {
  it("converts cm/360 and DPI into degrees per mouse count", () => {
    expect(degreesPerCount(30, 800)).toBeCloseTo(0.0381, 4);
  });
});

describe("gameSensitivityForCm360", () => {
  it("converts a physical turn distance into game sensitivity", () => {
    expect(gameSensitivityForCm360(30, 800, 0.022)).toBeCloseTo(0.1733, 3);
    expect(gameSensitivityForCm360(30, 800, 0.06996)).toBeCloseTo(0.0545, 3);
  });
});
