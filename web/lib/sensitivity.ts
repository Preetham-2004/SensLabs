export const SENSITIVITY_COMPARISON_EXAMPLES = {
  cs2: [{ sensitivity: 0.54, dpi: 800 }],
  valorant: [{ sensitivity: 0.54, dpi: 800 }, { sensitivity: 0.265, dpi: 1600 }],
} as const;

export function degreesPerCount(cm360: number, dpi: number): number {
  if (!Number.isFinite(cm360) || cm360 <= 0) {
    throw new Error("cm/360 must be a positive number.");
  }
  if (!Number.isFinite(dpi) || dpi <= 0) {
    throw new Error("DPI must be a positive number.");
  }

  const counts360 = (cm360 / 2.54) * dpi;
  return 360 / counts360;
}

export function gameSensitivityForCm360(cm360: number, dpi: number, yawDegreesPerCount: number): number {
  if (!Number.isFinite(cm360) || cm360 <= 0) throw new Error("cm/360 must be a positive number.");
  if (!Number.isFinite(dpi) || dpi <= 0) throw new Error("DPI must be a positive number.");
  if (!Number.isFinite(yawDegreesPerCount) || yawDegreesPerCount <= 0) {
    throw new Error("Game yaw must be a positive number.");
  }
  return (360 * 2.54) / (cm360 * dpi * yawDegreesPerCount);
}

export function cm360ForGameSensitivity(sensitivity: number, dpi: number, yawDegreesPerCount: number): number {
  if (!Number.isFinite(sensitivity) || sensitivity <= 0) throw new Error("Game sensitivity must be a positive number.");
  if (!Number.isFinite(dpi) || dpi <= 0) throw new Error("DPI must be a positive number.");
  if (!Number.isFinite(yawDegreesPerCount) || yawDegreesPerCount <= 0) {
    throw new Error("Game yaw must be a positive number.");
  }
  return (2.54 * 360) / (dpi * sensitivity * yawDegreesPerCount);
}
