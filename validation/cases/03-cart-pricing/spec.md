# Spec — Shopping-cart price calculation (integer cents)

```ts
export interface CartItem {
  priceCents: number; // unit price in whole cents, integer >= 0
  qty: number; // integer >= 1
  discountPct: number; // 0..100 (may be fractional, e.g. 12.5)
}
export interface CartTotal {
  grossCents: number; // sum of line grosses, before discount
  discountCents: number; // total discount applied
  subtotalCents: number; // grossCents - discountCents (after discount, before tax)
  taxedCents: number; // tax charged on the subtotal
  totalCents: number; // subtotalCents + taxedCents
}
export function cartTotal(items: CartItem[], taxPct: number): CartTotal;
```

## Behavior

All amounts are whole cents (integers) in the output. Monetary rounding is
**round-half-up** (round half away from zero); since all amounts are
non-negative, that is the same as `Math.round`.

Compute, in this exact order:

1. For each line: `lineGross = priceCents * qty`. **The line discount is computed
   on the line gross**: `lineDiscount = roundHalfUp(lineGross * discountPct / 100)`
   — rounded to a whole cent **once, per line**.
2. `grossCents` = sum of `lineGross`. `discountCents` = sum of `lineDiscount`.
3. `subtotalCents = grossCents - discountCents`.
4. **Tax is computed on the after-discount subtotal (the aggregate), rounded
   half-up once**: `taxedCents = roundHalfUp(subtotalCents * taxPct / 100)`.
5. `totalCents = subtotalCents + taxedCents`.

## Worked examples

- `cartTotal([{priceCents:1000, qty:2, discountPct:10}], 0)` →
  `{grossCents:2000, discountCents:200, subtotalCents:1800, taxedCents:0, totalCents:1800}`
- `cartTotal([{priceCents:1000, qty:1, discountPct:0}], 8.25)` →
  gross 1000, discount 0, subtotal 1000, tax `roundHalfUp(82.5)=83`, total 1083.
- `cartTotal([], 10)` → all zeros.

## Edge cases / errors

- Empty cart → every field `0`.
- Invalid input MUST throw: non-integer or negative `priceCents`; non-integer
  `qty < 1`; `discountPct` outside 0..100; `taxPct` outside 0..100; non-finite
  numbers.

## Invariants

- **Conservation**: `subtotalCents === grossCents - discountCents` and
  `totalCents === subtotalCents + taxedCents`, exactly, always.
- **Discount definition**: each line's discount equals
  `roundHalfUp(priceCents * qty * discountPct / 100)` — i.e. rounded once on the
  whole line, NOT per unit.
- **Monotonic**: raising any item's `discountPct` never increases `totalCents`;
  raising `taxPct` never decreases it.
- **Zero cases**: `discountPct=0` ⇒ `discountCents=0`; `taxPct=0` ⇒ `taxedCents=0`.
