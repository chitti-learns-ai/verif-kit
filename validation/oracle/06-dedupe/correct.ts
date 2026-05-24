// O(n) using a Set. SameValueZero semantics match Array.prototype.includes
// (NaN is considered present; -0 and 0 are the same), so OUTPUTS are identical
// to the buggy version — the only difference is time complexity.
export function dedupe(arr: number[]): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  for (const x of arr) {
    if (!seen.has(x)) {
      seen.add(x);
      out.push(x);
    }
  }
  return out;
}
