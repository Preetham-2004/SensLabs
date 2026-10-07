import { describe, expect, it } from "vitest";
import { assessSensitivityConfidence, didLastBlockScoreBest } from "./resultAssessment";

describe("assessSensitivityConfidence", () => {
  it("reports medium when swipes agree but preference trials have not been run", () => {
    const result = assessSensitivityConfidence({ calibrationSwipeCounts: [1000, 1010, 995] });
    expect(result.level).toBe("Medium");
    expect(result.reasons.join(" ")).toContain("Personal fit has not been tested yet.");
  });

  it("allows high confidence only when consistent calibration and preference trials exist", () => {
    expect(assessSensitivityConfidence({
      calibrationSwipeCounts: [1000, 1002, 998],
      preferenceTrialsCompleted: true,
    }).level).toBe("High");
  });

  it("reports low when calibration swipes vary a lot", () => {
    const result = assessSensitivityConfidence({ calibrationSwipeCounts: [800, 1000, 1200] });
    expect(result.level).toBe("Low");
    expect(result.reasons.join(" ")).toContain("varied by");
  });

  it("lowers confidence for an edge winner, disagreeing repeats, and a flat score curve", () => {
    const result = assessSensitivityConfidence({
      calibrationSwipeCounts: [1000, 1002, 998],
      bestValueAtTestedEdge: true,
      repeatBlockScores: [[40, 100]],
      scoreCurve: [80, 81, 80],
      preferenceTrialsCompleted: true,
    });
    expect(result.level).toBe("Low");
    expect(result.reasons).toHaveLength(3);
  });
});

describe("didLastBlockScoreBest", () => {
  it("flags a last block that scores above all earlier blocks", () => {
    expect(didLastBlockScoreBest([54, 61, 69])).toBe(true);
  });

  it("does not flag an earlier best, ties, or insufficient blocks", () => {
    expect(didLastBlockScoreBest([70, 64, 68])).toBe(false);
    expect(didLastBlockScoreBest([70, 70])).toBe(false);
    expect(didLastBlockScoreBest([70])).toBe(false);
  });
});
