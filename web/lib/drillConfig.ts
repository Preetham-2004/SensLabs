export const DRILL_CONFIG = {
  countdownSeconds: 3,
  flick: { targetCount: 30, targetTimeoutMs: 15000, targetRadiusDeg: 2.0, minAngleDeg: 5, maxAngleDeg: 22 },
  movementStyle: {
    minimumValidFlicks: 10,
    meaningfulGroupShare: 0.2,
    // Set only by scripts/calibrate-style.ts after real player data is collected.
    distanceCutoffsCm: null as { smallMaxCm: number; mediumMaxCm: number } | null,
  },
  tracking: {
    durationMs: 20000, targetRadiusDeg: 2.2,
    speedLevels: [
      { label: "Slow", multiplier: 0.4 },
      { label: "Medium", multiplier: 0.55 },
      { label: "Fast", multiplier: 0.7 },
    ],
    // Play area the target strafes inside (kept in front of the player)
    maxYawDeg: 18, minPitchDeg: 2, maxPitchDeg: 9,
    // FPS-style strafing: angular speed of an enemy running ~10m away
    minSpeedDegPerSec: 24, maxSpeedDegPerSec: 52,
    // How long each A/D strafe lasts before changing direction
    minStrafeMs: 220, maxStrafeMs: 850,
    // How fast the target reaches its new velocity (higher = snappier direction changes)
    accelPerSec: 14,
    // Occasional jumps / crouch-peeks for vertical tracking
    jumpChance: 0.2, jumpHeightDeg: 3.5, jumpDurationMs: 520,
  },
  precision: { targetCount: 20, targetTimeoutMs: 3000, targetRadiusDeg: 0.45, distance: 24, minAngleDeg: 4, maxAngleDeg: 16 },
} as const;
