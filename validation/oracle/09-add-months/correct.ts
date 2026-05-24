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
  const zeroBased = m - 1 + n;
  const targetYear = y + Math.floor(zeroBased / 12);
  const targetMonth0 = ((zeroBased % 12) + 12) % 12; // 0..11
  // Last day of the target month (day 0 of the following month).
  const daysInMonth = new Date(Date.UTC(targetYear, targetMonth0 + 1, 0)).getUTCDate();
  const targetDay = Math.min(d, daysInMonth); // clamp — no overflow
  const dt = new Date(Date.UTC(targetYear, targetMonth0, targetDay));
  return dt.toISOString().slice(0, 10);
}
