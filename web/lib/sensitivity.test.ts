import { describe, expect, it } from "vitest";
import { cm360ForGameSensitivity, degreesPerCount, gameSensitivityForCm360, SENSITIVITY_COMPARISON_EXAMPLES } from "./sensitivity";

describe("degreesPerCount", () => {
  it("converts cm/360 and DPI into degrees per mouse count", () => {
    expect(degreesPerCount(30, 800)).toBeCloseTo(0.0381, 4);
  });
});

describe("gameSensitivityForCm360", () => {
  it("converts a physical turn distance into game sensitivity", () => {
    expect(gameSensitivityForCm360(30, 800, 0.022)).toBeCloseTo(1.7318, 3);
    expect(gameSensitivityForCm360(30, 800, 0.06996)).toBeCloseTo(0.5450, 3);
  });

  it("converts the requested VALORANT examples to cm/360", () => {
    const examples = SENSITIVITY_COMPARISON_EXAMPLES.valorant;
    expect(cm360ForGameSensitivity(examples[0].sensitivity, examples[0].dpi, 0.07)).toBeCloseTo(30.2, 1);
    expect(cm360ForGameSensitivity(examples[1].sensitivity, examples[1].dpi, 0.07)).toBeCloseTo(30.8, 1);
  });

  it("round trips cm/360 back to the original VALORANT sensitivity", () => {
    const cm360 = cm360ForGameSensitivity(0.54, 800, 0.07);
    expect(gameSensitivityForCm360(cm360, 800, 0.07)).toBeCloseTo(0.54, 10);
  });

  it("converts the requested CS2 example to cm/360", () => {
    const example = SENSITIVITY_COMPARISON_EXAMPLES.cs2[0];
    expect(cm360ForGameSensitivity(example.sensitivity, example.dpi, 0.022)).toBeCloseTo(96.2, 1);
  });

  it("keeps the game comparison examples independent from candidate adjustment buttons", () => {
    const originalReferences = JSON.stringify(SENSITIVITY_COMPARISON_EXAMPLES);
    for (const buttonAdjustment of [-0.5, 0.5]) {
      const adjustedCandidateCm360 = 30 / (1 + buttonAdjustment);
      expect(adjustedCandidateCm360).not.toBe(30);
      expect(JSON.stringify(SENSITIVITY_COMPARISON_EXAMPLES)).toBe(originalReferences);
    }
  });
});
