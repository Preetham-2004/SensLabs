export const RESULT_CONFIDENCE_RULES = {
  requiredCalibrationSwipes: 3,
  swipeVariationMediumPercent: 5,
  swipeVariationLowPercent: 15,
  repeatBlockDisagreementPercent: 20,
  flatScoreCurveMaxSpreadPercent: 5,
  minimumScoreCurveCandidates: 3,
  highConfidenceRequiresPreferenceTrials: true,
} as const;
