// Strict RFC-4180-style single-record parser. A field is EITHER fully quoted
// (begins with ") or fully unquoted (contains no "). Anything else is malformed
// and throws, per the spec's "no silent corruption" invariant: an input either
// parses to the correct fields or throws — it never returns a plausible-but-wrong
// list. (Strict resolution of the malformed-quote ambiguity, architect decision
// 2026-05-24, surfaced by the IV&V verifier.)
export function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  const n = line.length;
  let i = 0;
  while (true) {
    let cur = '';
    if (line[i] === '"') {
      // quoted field
      i++;
      let closed = false;
      while (i < n) {
        const c = line[i];
        if (c === '"') {
          if (line[i + 1] === '"') {
            cur += '"'; // escaped quote
            i += 2;
          } else {
            closed = true; // closing quote
            i++;
            break;
          }
        } else {
          cur += c; // data (incl. comma) inside quotes
          i++;
        }
      }
      if (!closed) throw new Error(`parseCsvLine: unterminated quote in ${JSON.stringify(line)}`);
      if (i < n && line[i] !== ',') {
        throw new Error(`parseCsvLine: unexpected text after closing quote in ${JSON.stringify(line)}`);
      }
    } else {
      // unquoted field — must contain no quote
      while (i < n && line[i] !== ',') {
        if (line[i] === '"') {
          throw new Error(`parseCsvLine: unexpected quote in unquoted field in ${JSON.stringify(line)}`);
        }
        cur += line[i];
        i++;
      }
    }
    fields.push(cur);
    if (i < n && line[i] === ',') {
      i++;
      if (i === n) {
        fields.push(''); // trailing comma → trailing empty field
        break;
      }
      continue;
    }
    break;
  }
  return fields;
}
