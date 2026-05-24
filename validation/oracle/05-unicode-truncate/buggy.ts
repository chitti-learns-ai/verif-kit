export function truncate(s: string, maxCodePoints: number): string {
  if (!Number.isInteger(maxCodePoints) || maxCodePoints < 0) {
    throw new Error(`truncate: maxCodePoints must be a non-negative integer, got ${maxCodePoints}`);
  }
  return s.slice(0, maxCodePoints);
}
