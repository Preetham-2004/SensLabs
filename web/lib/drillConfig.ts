export const DRILL_CONFIG = {
  countdownSeconds: 3,
  flick: { targetCount: 30, targetTimeoutMs: 3000, targetRadiusDeg: 2.6, minAngleDeg: 18, maxAngleDeg: 48 },
  tracking: {
    durationMs: 20000, targetRadiusDeg: 2.6, maxYawDeg: 24, maxPitchDeg: 12,
    yawFrequency: 1.2, yawSecondaryFrequency: 2.1, pitchFrequency: 0.85, pitchSecondaryFrequency: 1.7,
    yawPrimaryAmount: 0.58, pitchPrimaryAmount: 0.62, yawSecondaryAmount: 0.18, pitchSecondaryAmount: 0.2,
  },
  precision: { targetCount: 20, targetTimeoutMs: 3000, targetRadiusDeg: 1.7, minAngleDeg: 12, maxAngleDeg: 42 },
} as const;
