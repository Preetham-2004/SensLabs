export function metricLabel(key: string) {
  const labels: Record<string, string> = {
    hitRatePercent: "Hit rate", shotsTaken: "Shots fired", meanTimeToHitMs: "Average time to hit", misses: "Misses",
    meanOvershootDeg: "Average distance past target", meanUndershootDeg: "Average distance short of target",
    meanFinalErrorDeg: "Average distance from target", onTargetPercent: "Time on target",
    meanAngularErrorDeg: "Mean angular error", rmsAngularErrorDeg: "RMS angular error",
  };
  return labels[key] ?? key;
}

export function metricValue(key: string, value: number) {
  if (key.endsWith("Percent")) return `${value.toFixed(1)}%`;
  if (key.endsWith("Ms")) return `${(value / 1000).toFixed(2)} sec`;
  if (key === "shotsTaken") return String(value);
  if (key === "misses") return String(value);
  return `${value.toFixed(2)}°`;
}
