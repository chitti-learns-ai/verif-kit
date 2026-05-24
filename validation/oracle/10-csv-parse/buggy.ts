// BUG: naive split on commas. It ignores quoting entirely, so any comma inside a
// quoted field wrongly becomes a separator, the surrounding quotes are left in
// the values, "" escaping is not decoded, and an unterminated quote never throws.
// It silently returns a different-but-plausible field list.
export function parseCsvLine(line: string): string[] {
  return line.split(',');
}
