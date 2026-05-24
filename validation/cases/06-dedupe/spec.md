# Spec — Deduplicate while preserving order

```ts
export function dedupe(arr: number[]): number[];
```

## Behavior

Return a new array containing each distinct value from `arr`, in the order of its
**first** occurrence. Duplicates after the first are removed.

## Worked examples

- `dedupe([1, 2, 2, 3, 1])` → `[1, 2, 3]`
- `dedupe([])` → `[]`
- `dedupe([5, 5, 5])` → `[5]`
- `dedupe([3, 1, 2])` → `[3, 1, 2]`
- `dedupe([0, -0])` → `[0]` (treat `0` and `-0` as the same value)
- `dedupe([NaN, NaN])` → `[NaN]` (NaN equals NaN for dedup purposes, SameValueZero)

## Edge cases / errors

- Empty array → empty array.
- Input is not mutated.

## Invariants

- **Idempotent**: `dedupe(dedupe(x))` deep-equals `dedupe(x)`.
- **Membership preserved**: the set of values in the output equals the set of
  values in the input (under SameValueZero equality).
- **Order**: output order matches first-occurrence order in the input.
- **No mutation**: `arr` is unchanged after the call.
- **Subsequence**: the output is a subsequence of the input.
