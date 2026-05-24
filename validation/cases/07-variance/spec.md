# Spec — Population variance

```ts
export function variance(xs: number[]): number;
```

## Behavior

Return the **population variance** of `xs`: the mean of the squared deviations
from the arithmetic mean.

`variance(xs) = (1/n) * Σ (xᵢ − mean)²`, where `mean = (1/n) Σ xᵢ`, `n = xs.length`.

## Worked examples

- `variance([2, 4, 4, 4, 5, 5, 7, 9])` → `4`
- `variance([1, 2, 3])` → `0.6666666666666666`
- `variance([5, 5, 5])` → `0`
- `variance([42])` → `0`

## Edge cases / errors

- Empty array → throw (variance of no data is undefined).
- All inputs are finite numbers (you may assume finite, non-NaN inputs).

## Invariants

- **Non-negative**: `variance(xs) >= 0` for all inputs.
- **Translation invariance**: adding a constant `k` to every element does not
  change the variance — `variance(xs) === variance(xs.map(x => x + k))` for any
  finite `k`. (Variance measures spread, not location.)
- **Scale**: `variance(xs.map(x => c*x)) === c*c * variance(xs)`.
- **Zero spread**: a constant array has variance `0`.
