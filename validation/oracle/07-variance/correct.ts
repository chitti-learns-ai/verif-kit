// Two-pass: compute the mean, then sum squared deviations. Numerically stable —
// translation-invariant to high precision because deviations are formed against
// the actual mean rather than via a difference of two huge magnitudes.
export function variance(xs: number[]): number {
  if (xs.length === 0) throw new Error('variance: empty array');
  const n = xs.length;
  let sum = 0;
  for (const x of xs) sum += x;
  const mean = sum / n;
  let acc = 0;
  for (const x of xs) {
    const d = x - mean;
    acc += d * d;
  }
  return acc / n;
}
