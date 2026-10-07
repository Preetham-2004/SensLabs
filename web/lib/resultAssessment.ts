import { RESULT_CONFIDENCE_RULES } from "./resultRules";

export type ConfidenceLevel = "High" | "Medium" | "Low";
export type ConfidenceInput = {
  calibrationSwipeCounts: number[];
  bestValueAtTestedEdge?: boolean;
  repeatBlockScores?: number[][];
  scoreCurve?: number[];
  preferenceTrialsCompleted?: boolean;
};

export type ConfidenceAssessment = {
  level: ConfidenceLevel;
  reasons: string[];
  swipeVariationPercent: number | null;
};

const relativeSpreadPercent = (values: number[]) => {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return ((Math.max(...values) - Math.min(...values)) / Math.max(Math.abs(mean), 1)) * 100;
};

const downgrade = (level: ConfidenceLevel): ConfidenceLevel =>
  level === "High" ? "Medium" : "Low";

export function assessSensitivityConfidence(input: ConfidenceInput): ConfidenceAssessment {
  const rules = RESULT_CONFIDENCE_RULES;
  const swipes = input.calibrationSwipeCounts.filter((count) => Number.isFinite(count) && count > 0);
  const sortedSwipes = [...swipes].sort((a, b) => a - b);
  const medianSwipe = sortedSwipes.length ? sortedSwipes[Math.floor(sortedSwipes.length / 2)] : 0;
  const swipeVariationPercent = medianSwipe
    ? ((sortedSwipes[sortedSwipes.length - 1] - sortedSwipes[0]) / medianSwipe) * 100
    : null;
  let level: ConfidenceLevel = "High";
  const reasons: string[] = [];

  if (swipes.length < rules.requiredCalibrationSwipes) {
    level = "Low";
    reasons.push(`Only ${swipes.length} of ${rules.requiredCalibrationSwipes} calibration swipes are available.`);
  } else if (swipeVariationPercent !== null && swipeVariationPercent >= rules.swipeVariationLowPercent) {
    level = "Low";
    reasons.push(`Your calibration swipes varied by ${swipeVariationPercent.toFixed(0)}% from shortest to longest.`);
  } else if (swipeVariationPercent !== null && swipeVariationPercent >= rules.swipeVariationMediumPercent) {
    level = downgrade(level);
    reasons.push(`Your calibration swipes varied by ${swipeVariationPercent.toFixed(0)}%, so the measured range is less certain.`);
  }

  if (input.bestValueAtTestedEdge) {
    level = downgrade(level);
    reasons.push("The best tested value was at the edge of the tested range.");
  }

  const repeatDisagreement = (input.repeatBlockScores ?? []).some((scores) =>
    scores.length >= 2 && relativeSpreadPercent(scores) >= rules.repeatBlockDisagreementPercent,
  );
  if (repeatDisagreement) {
    level = downgrade(level);
    reasons.push("Repeated sensitivity blocks disagreed with each other.");
  }

  const scoreCurve = input.scoreCurve ?? [];
  const flatCurve = scoreCurve.length >= rules.minimumScoreCurveCandidates
    && relativeSpreadPercent(scoreCurve) <= rules.flatScoreCurveMaxSpreadPercent;
  if (flatCurve) {
    level = downgrade(level);
    reasons.push("Scores were similar across the tested range, so there was no clear winner.");
  }

  if (rules.highConfidenceRequiresPreferenceTrials && !input.preferenceTrialsCompleted && level === "High") {
    level = "Medium";
  }
  if (reasons.length === 0) {
    reasons.push(input.preferenceTrialsCompleted
      ? "Calibration was consistent and the sensitivity trials had a clear result."
      : "The calibration swipes were consistent. Personal fit has not been tested yet.");
  }

  return { level, reasons, swipeVariationPercent };
}

export function didLastBlockScoreBest(blockScores: number[]): boolean {
  if (blockScores.length < 2 || blockScores.some((score) => !Number.isFinite(score))) return false;
  const lastScore = blockScores[blockScores.length - 1];
  const previousBest = Math.max(...blockScores.slice(0, -1));
  return lastScore > previousBest;
}
