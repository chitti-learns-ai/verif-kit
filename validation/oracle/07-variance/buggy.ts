// Naive one-pass "computational formula": E[x^2] - (E[x])^2.
// Algebraically correct, but suffers catastrophic cancellation when the mean is
// large relative to the spread: both terms are ~1e18 and their difference loses
// most significant digits (can even go slightly negative). Agrees with the
// correct value for modest-magnitude data.
export function variance(xs: number[]): number {
  if (xs.length === 0) throw new Error('variance: empty array');
  const n = xs.length;
  let sum = 0;
  let sumSq = 0;
  for (const x of xs) {
    sum += x;
    sumSq += x * x;
  }
  const mean = sum / n;
  return sumSq / n - mean * mean;
}
