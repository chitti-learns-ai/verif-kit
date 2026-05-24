// Functionally correct, but O(n^2): `includes` rescans the whole result each
// step. For large inputs this is pathologically slow — yet every output value
// is identical to the linear version. A purely functional spec cannot see this.
export function dedupe(arr: number[]): number[] {
  const out: number[] = [];
  for (const x of arr) {
    if (!out.includes(x)) {
      out.push(x);
    }
  }
  return out;
}
