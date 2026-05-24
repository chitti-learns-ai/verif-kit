export function truncate(s: string, maxCodePoints: number): string {
  if (!Number.isInteger(maxCodePoints) || maxCodePoints < 0) {
    throw new Error(`truncate: maxCodePoints must be a non-negative integer, got ${maxCodePoints}`);
  }
  // Array.from / spread iterate by code point, so surrogate pairs stay intact.
  return Array.from(s).slice(0, maxCodePoints).join('');
}
