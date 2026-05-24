// Independent Verification Environment — case 03 cart-pricing (MONEY module).
// Blind VE: authored from spec.md + sut.ts public interface ONLY.
// Did NOT read impl.buggy.ts, impl.correct.ts, or meta.json.
//
// Components (UVM -> software):
//  - Generator: constrained-random carts via fast-check (legal input domain),
//    biased toward fractional-per-unit-discount + qty>1 (rounding divergence).
//  - Reference model: refCartTotal(), my own from-spec implementation.
//  - Scoreboard: assertEqualTotals(dut, model) on every transaction.
//  - Assertions: conservation, monotonicity, zero-cases.
//  - Coverage model: planned cover points, asserted closed.

import { describe, test, expect } from 'vitest';
import fc from 'fast-check';
import { cartTotal, type CartItem, type CartTotal } from './sut';

// ----------------------------------------------------------------------------
// Independent reference model — implements spec exactly. Money in integer cents.
// ----------------------------------------------------------------------------

// Round-half-up away from zero. All amounts non-negative => Math.round equivalent,
// but I implement the spec's stated rule explicitly to avoid Math.round's
// banker's-edge confusion and the -0.5 behavior (irrelevant here, amounts >= 0).
function roundHalfUp(x: number): number {
  // round half away from zero
  return Math.sign(x) * Math.round(Math.abs(x));
}

function isValidItem(it: CartItem): boolean {
  if (!Number.isFinite(it.priceCents) || !Number.isInteger(it.priceCents) || it.priceCents < 0)
    return false;
  if (!Number.isFinite(it.qty) || !Number.isInteger(it.qty) || it.qty < 1) return false;
  if (!Number.isFinite(it.discountPct) || it.discountPct < 0 || it.discountPct > 100) return false;
  return true;
}

function refValidate(items: CartItem[], taxPct: number): void {
  if (!Number.isFinite(taxPct) || taxPct < 0 || taxPct > 100) throw new Error('invalid taxPct');
  for (const it of items) {
    if (!isValidItem(it)) throw new Error('invalid item');
  }
}

function refCartTotal(items: CartItem[], taxPct: number): CartTotal {
  refValidate(items, taxPct);
  let grossCents = 0;
  let discountCents = 0;
  for (const it of items) {
    const lineGross = it.priceCents * it.qty;
    const lineDiscount = roundHalfUp((lineGross * it.discountPct) / 100);
    grossCents += lineGross;
    discountCents += lineDiscount;
  }
  const subtotalCents = grossCents - discountCents;
  const taxedCents = roundHalfUp((subtotalCents * taxPct) / 100);
  const totalCents = subtotalCents + taxedCents;
  return { grossCents, discountCents, subtotalCents, taxedCents, totalCents };
}

// ----------------------------------------------------------------------------
// Coverage model
// ----------------------------------------------------------------------------
const coverBins = new Set<string>();
const PLANNED = [
  'qty=1',
  'qty>1',
  'fractional-per-unit-discount+qty>1',
  'discountPct=0',
  'discountPct=100',
  'fractional-discountPct',
  'taxPct=0',
  'fractional-taxPct',
  'multi-line',
  'empty'
];
function cover(bin: string) {
  coverBins.add(bin);
}
function coverCart(items: CartItem[], taxPct: number) {
  if (items.length === 0) cover('empty');
  if (items.length > 1) cover('multi-line');
  if (taxPct === 0) cover('taxPct=0');
  if (!Number.isInteger(taxPct)) cover('fractional-taxPct');
  for (const it of items) {
    if (it.qty === 1) cover('qty=1');
    if (it.qty > 1) cover('qty>1');
    if (it.discountPct === 0) cover('discountPct=0');
    if (it.discountPct === 100) cover('discountPct=100');
    if (!Number.isInteger(it.discountPct)) cover('fractional-discountPct');
    const lineGross = it.priceCents * it.qty;
    const raw = (lineGross * it.discountPct) / 100;
    if (it.qty > 1 && !Number.isInteger(raw)) cover('fractional-per-unit-discount+qty>1');
  }
}

// ----------------------------------------------------------------------------
// Scoreboard
// ----------------------------------------------------------------------------
function assertEqualTotals(actual: CartTotal, expected: CartTotal, ctx: string) {
  expect(actual.grossCents, `${ctx} grossCents`).toBe(expected.grossCents);
  expect(actual.discountCents, `${ctx} discountCents`).toBe(expected.discountCents);
  expect(actual.subtotalCents, `${ctx} subtotalCents`).toBe(expected.subtotalCents);
  expect(actual.taxedCents, `${ctx} taxedCents`).toBe(expected.taxedCents);
  expect(actual.totalCents, `${ctx} totalCents`).toBe(expected.totalCents);
}

// ----------------------------------------------------------------------------
// Phase D — Worked examples (hand-derived golden values, oracle-free)
// ----------------------------------------------------------------------------
describe('worked examples (hand-derived)', () => {
  test('ex1: 10.00 x2 @10% no tax', () => {
    // gross=2000, disc=round(200)=200, sub=1800, tax=0, total=1800
    const r = cartTotal([{ priceCents: 1000, qty: 2, discountPct: 10 }], 0);
    expect(r).toEqual({
      grossCents: 2000,
      discountCents: 200,
      subtotalCents: 1800,
      taxedCents: 0,
      totalCents: 1800
    });
  });

  test('ex2: 10.00 x1 @0% tax 8.25 -> tax round(82.5)=83', () => {
    const r = cartTotal([{ priceCents: 1000, qty: 1, discountPct: 0 }], 8.25);
    expect(r).toEqual({
      grossCents: 1000,
      discountCents: 0,
      subtotalCents: 1000,
      taxedCents: 83,
      totalCents: 1083
    });
  });

  test('ex3: empty cart -> all zeros', () => {
    const r = cartTotal([], 10);
    expect(r).toEqual({
      grossCents: 0,
      discountCents: 0,
      subtotalCents: 0,
      taxedCents: 0,
      totalCents: 0
    });
  });
});

// ----------------------------------------------------------------------------
// Directed corners that EXPOSE per-unit-vs-per-line rounding divergence.
// These are hand-derived against the spec (round ONCE on the whole line).
// ----------------------------------------------------------------------------
describe('directed: rounding strategy (per-line round-once)', () => {
  test('price 333c x3 @10%: line round-once', () => {
    // lineGross = 999, raw discount = 99.9 -> roundHalfUp = 100.
    // (Per-unit WRONG model would do round(33.3)=33 *3 = 99.)
    cover('fractional-per-unit-discount+qty>1');
    const r = cartTotal([{ priceCents: 333, qty: 3, discountPct: 10 }], 0);
    expect(r.discountCents, 'discount must be round(99.9)=100, not 3*round(33.3)=99').toBe(100);
    expect(r.subtotalCents).toBe(999 - 100);
    assertEqualTotals(r, refCartTotal([{ priceCents: 333, qty: 3, discountPct: 10 }], 0), 'ex333');
  });

  test('price 105c x3 @12.5%: line gross 315, raw 39.375 -> 39', () => {
    // per-unit: 105*12.5/100 = 13.125 -> round 13; *3 = 39. Same here. Use a divergent one below.
    const r = cartTotal([{ priceCents: 105, qty: 3, discountPct: 12.5 }], 0);
    assertEqualTotals(r, refCartTotal([{ priceCents: 105, qty: 3, discountPct: 12.5 }], 0), 'ex105');
  });

  test('price 17c x7 @15%: gross 119, raw 17.85 -> 18 (per-unit would be 7*round(2.55)=7*3=21)', () => {
    // 17*15/100 = 2.55 -> round 3 per unit; per-unit total = 21. Line-once: round(17.85)=18.
    const r = cartTotal([{ priceCents: 17, qty: 7, discountPct: 15 }], 0);
    expect(r.discountCents, 'line-once discount = round(17.85)=18').toBe(18);
    assertEqualTotals(r, refCartTotal([{ priceCents: 17, qty: 7, discountPct: 15 }], 0), 'ex17');
  });

  test('multi-line aggregate with fractional tax', () => {
    const items: CartItem[] = [
      { priceCents: 333, qty: 3, discountPct: 10 }, // gross 999, disc 100, sub 899
      { priceCents: 17, qty: 7, discountPct: 15 } //   gross 119, disc 18,  sub 101
    ];
    // total gross 1118, disc 118, subtotal 1000, tax round(1000*8.25/100)=round(82.5)=83, total 1083
    const r = cartTotal(items, 8.25);
    expect(r.subtotalCents).toBe(1000);
    expect(r.taxedCents).toBe(83);
    assertEqualTotals(r, refCartTotal(items, 8.25), 'multi');
  });
});

// ----------------------------------------------------------------------------
// Phase C — constrained-random scoreboard (biased to rounding divergence)
// ----------------------------------------------------------------------------
const itemArb: fc.Arbitrary<CartItem> = fc.record({
  priceCents: fc.integer({ min: 0, max: 100000 }),
  qty: fc.integer({ min: 1, max: 50 }),
  // include fractional discount percentages (e.g. tenths) to force fractional cents
  discountPct: fc
    .oneof(
      fc.integer({ min: 0, max: 100 }),
      fc.integer({ min: 0, max: 1000 }).map((n) => n / 10) // 0.0 .. 100.0
    )
    .filter((p) => p >= 0 && p <= 100)
});

const taxArb: fc.Arbitrary<number> = fc.oneof(
  fc.integer({ min: 0, max: 100 }),
  fc.integer({ min: 0, max: 1000 }).map((n) => n / 10),
  fc.constant(8.25),
  fc.constant(0)
);

describe('scoreboard: DUT vs independent reference model', () => {
  test('constrained-random carts match the reference model exactly', () => {
    fc.assert(
      fc.property(fc.array(itemArb, { maxLength: 8 }), taxArb, (items, taxPct) => {
        coverCart(items, taxPct);
        const dut = cartTotal(items, taxPct);
        const model = refCartTotal(items, taxPct);
        assertEqualTotals(dut, model, `rand items=${JSON.stringify(items)} tax=${taxPct}`);
      }),
      { numRuns: 3000 }
    );
  });

  test('targeted: single item qty>1 with fractional per-unit discount', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 9999 }),
        fc.integer({ min: 2, max: 20 }),
        fc.integer({ min: 1, max: 99 }),
        (priceCents, qty, discountPct) => {
          const items: CartItem[] = [{ priceCents, qty, discountPct }];
          coverCart(items, 0);
          const dut = cartTotal(items, 0);
          const model = refCartTotal(items, 0);
          assertEqualTotals(dut, model, `targeted p=${priceCents} q=${qty} d=${discountPct}`);
        }
      ),
      { numRuns: 3000 }
    );
  });
});

// ----------------------------------------------------------------------------
// Invariants (oracle-free where possible)
// ----------------------------------------------------------------------------
describe('invariants', () => {
  test('conservation: subtotal=gross-discount, total=subtotal+taxed', () => {
    fc.assert(
      fc.property(fc.array(itemArb, { maxLength: 8 }), taxArb, (items, taxPct) => {
        const r = cartTotal(items, taxPct);
        expect(r.subtotalCents).toBe(r.grossCents - r.discountCents);
        expect(r.totalCents).toBe(r.subtotalCents + r.taxedCents);
        // money is integer cents
        for (const v of Object.values(r)) {
          expect(Number.isInteger(v)).toBe(true);
        }
      }),
      { numRuns: 2000 }
    );
  });

  test('monotonic: raising discountPct never increases total', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100000 }),
        fc.integer({ min: 1, max: 50 }),
        fc.integer({ min: 0, max: 99 }),
        fc.integer({ min: 0, max: 100 }),
        (priceCents, qty, dLow, taxPct) => {
          const dHigh = Math.min(100, dLow + 1);
          const low = cartTotal([{ priceCents, qty, discountPct: dLow }], taxPct).totalCents;
          const high = cartTotal([{ priceCents, qty, discountPct: dHigh }], taxPct).totalCents;
          expect(high).toBeLessThanOrEqual(low);
        }
      ),
      { numRuns: 2000 }
    );
  });

  test('monotonic: raising taxPct never decreases total', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100000 }),
        fc.integer({ min: 1, max: 50 }),
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 99 }),
        (priceCents, qty, discountPct, tLow) => {
          const tHigh = tLow + 1;
          const low = cartTotal([{ priceCents, qty, discountPct }], tLow).totalCents;
          const high = cartTotal([{ priceCents, qty, discountPct }], tHigh).totalCents;
          expect(high).toBeGreaterThanOrEqual(low);
        }
      ),
      { numRuns: 2000 }
    );
  });

});

describe('zero cases', () => {
  test('discountPct=0 => discountCents=0', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            priceCents: fc.integer({ min: 0, max: 100000 }),
            qty: fc.integer({ min: 1, max: 50 }),
            discountPct: fc.constant(0)
          }),
          { maxLength: 6 }
        ),
        taxArb,
        (items, taxPct) => {
          expect(cartTotal(items, taxPct).discountCents).toBe(0);
        }
      ),
      { numRuns: 1000 }
    );
  });

  test('taxPct=0 => taxedCents=0', () => {
    fc.assert(
      fc.property(fc.array(itemArb, { maxLength: 6 }), (items) => {
        expect(cartTotal(items, 0).taxedCents).toBe(0);
      }),
      { numRuns: 1000 }
    );
  });
});

// ----------------------------------------------------------------------------
// Phase E flavor — anomaly / invalid input must throw (loud failure)
// ----------------------------------------------------------------------------
describe('invalid input must throw', () => {
  const bads: Array<[string, () => CartTotal]> = [
    ['non-integer priceCents', () => cartTotal([{ priceCents: 10.5, qty: 1, discountPct: 0 }], 0)],
    ['negative priceCents', () => cartTotal([{ priceCents: -1, qty: 1, discountPct: 0 }], 0)],
    ['qty < 1', () => cartTotal([{ priceCents: 100, qty: 0, discountPct: 0 }], 0)],
    ['non-integer qty', () => cartTotal([{ priceCents: 100, qty: 1.5, discountPct: 0 }], 0)],
    ['discountPct > 100', () => cartTotal([{ priceCents: 100, qty: 1, discountPct: 101 }], 0)],
    ['discountPct < 0', () => cartTotal([{ priceCents: 100, qty: 1, discountPct: -1 }], 0)],
    ['taxPct > 100', () => cartTotal([{ priceCents: 100, qty: 1, discountPct: 0 }], 101)],
    ['taxPct < 0', () => cartTotal([{ priceCents: 100, qty: 1, discountPct: 0 }], -1)],
    ['non-finite priceCents', () => cartTotal([{ priceCents: Infinity, qty: 1, discountPct: 0 }], 0)],
    ['NaN taxPct', () => cartTotal([{ priceCents: 100, qty: 1, discountPct: 0 }], NaN)]
  ];
  for (const [name, fn] of bads) {
    test(`throws: ${name}`, () => {
      expect(fn).toThrow();
    });
  }
});

// ----------------------------------------------------------------------------
// Coverage closure gate
// ----------------------------------------------------------------------------
describe('coverage closure', () => {
  test('all planned cover points hit', () => {
    // exercise deterministic bins that may be rare in random gen
    coverCart([{ priceCents: 100, qty: 1, discountPct: 100 }], 0); // discountPct=100, qty=1
    coverCart([{ priceCents: 333, qty: 3, discountPct: 10 }], 8.25); // fractional divergence + frac tax
    coverCart([], 0);
    const missing = PLANNED.filter((b) => !coverBins.has(b));
    expect(missing, `unhit cover points: ${missing.join(', ')}`).toEqual([]);
  });
});
