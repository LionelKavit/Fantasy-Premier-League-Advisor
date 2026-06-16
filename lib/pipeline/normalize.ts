export function normalizeSignal(value: number, min: number, max: number): number {
  if (max === min) return 0;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

export function normalizeInverted(value: number, min: number, max: number): number {
  if (max === min) return 1;
  return Math.max(0, Math.min(1, 1 - (value - min) / (max - min)));
}
