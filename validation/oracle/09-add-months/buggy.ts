function parse(iso: string): { y: number; m: number; d: number } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) throw new Error(`addMonths: invalid date ${iso}`);
  const y = +m[1]!;
  const mo = +m[2]!;
  const d = +m[3]!;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) {
    throw new Error(`addMonths: not a real date ${iso}`);
  }
  return { y, m: mo, d };
}

export function addMonths(iso: string, n: number): string {
  if (!Number.isInteger(n)) throw new Error(`addMonths: n must be an integer, got ${n}`);
  const { y, m, d } = parse(iso);
  const dt = new Date(Date.UTC(y, m - 1, d));
  // BUG: setUTCMonth overflows when the target month has fewer days than `d`
  // (e.g. Jan 31 + 1 month → "Feb 31" → rolls forward to Mar 3) instead of
  // clamping to the last valid day of the target month.
  dt.setUTCMonth(dt.getUTCMonth() + n);
  return dt.toISOString().slice(0, 10);
}
