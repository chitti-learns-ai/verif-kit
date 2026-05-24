export interface CartItem {
  priceCents: number;
  qty: number;
  discountPct: number;
}
export interface CartTotal {
  grossCents: number;
  discountCents: number;
  subtotalCents: number;
  taxedCents: number;
  totalCents: number;
}

function roundHalfUp(x: number): number {
  return Math.round(x);
}

function validate(items: CartItem[], taxPct: number): void {
  if (!Array.isArray(items)) throw new Error('cartTotal: items must be an array');
  if (!Number.isFinite(taxPct) || taxPct < 0 || taxPct > 100) {
    throw new Error(`cartTotal: taxPct must be in 0..100, got ${taxPct}`);
  }
  for (const it of items) {
    if (!Number.isInteger(it.priceCents) || it.priceCents < 0) {
      throw new Error(`cartTotal: priceCents must be a non-negative integer, got ${it.priceCents}`);
    }
    if (!Number.isInteger(it.qty) || it.qty < 1) {
      throw new Error(`cartTotal: qty must be an integer >= 1, got ${it.qty}`);
    }
    if (!Number.isFinite(it.discountPct) || it.discountPct < 0 || it.discountPct > 100) {
      throw new Error(`cartTotal: discountPct must be in 0..100, got ${it.discountPct}`);
    }
  }
}

export function cartTotal(items: CartItem[], taxPct: number): CartTotal {
  validate(items, taxPct);
  let grossCents = 0;
  let discountCents = 0;
  for (const it of items) {
    const lineGross = it.priceCents * it.qty;
    const unitDiscount = roundHalfUp((it.priceCents * it.discountPct) / 100);
    const lineDiscount = unitDiscount * it.qty;
    grossCents += lineGross;
    discountCents += lineDiscount;
  }
  const subtotalCents = grossCents - discountCents;
  const taxedCents = roundHalfUp((subtotalCents * taxPct) / 100);
  const totalCents = subtotalCents + taxedCents;
  return { grossCents, discountCents, subtotalCents, taxedCents, totalCents };
}
