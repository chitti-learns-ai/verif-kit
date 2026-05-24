# Spec — Parse one CSV line (RFC-4180 style)

```ts
export function parseCsvLine(line: string): string[];
```

## Behavior

Split a single CSV record into its field values.

- Fields are separated by commas.
- A field MAY be wrapped in double quotes. **A quoted field may contain commas**,
  which are part of the value, NOT separators.
- Inside a quoted field, a literal double-quote is written as two double-quotes
  (`""`) and decodes to one (`"`).
- The returned values are **unquoted and unescaped** (the surrounding quotes and
  the `""`-escaping are removed).

## Worked examples (define the semantics exactly)

| input | output |
|---|---|
| `a,b,c` | `["a","b","c"]` |
| `` (empty string) | `[""]` |
| `a,,c` | `["a","","c"]` |
| `"a,b",c` | `["a,b","c"]` (the quoted comma is data → TWO fields, not three) |
| `"she said ""hi""",x` | `['she said "hi"', "x"]` |
| `"",x` | `["","x"]` (empty quoted field) |

## Edge cases / errors

- An unterminated quoted field (opening quote with no closing quote) MUST throw —
  never return a silently-wrong split.
- A field is EITHER fully quoted (begins with `"`) OR fully unquoted (contains no
  `"`). Malformed quote usage MUST throw: a `"` inside an unquoted field
  (e.g. `a"b`), or any character other than a comma after a closing quote
  (e.g. `"a"b`). (Strict resolution per the "no silent corruption" invariant —
  architect decision 2026-05-24, surfaced by the IV&V verifier as a spec
  ambiguity.)

## Invariants

- **Quoted commas are data**: for any strings u and v with no quotes/newlines,
  `parseCsvLine('"' + u + ',' + v + '"')` returns `[u + ',' + v]` (exactly one
  field), regardless of how many commas u and v contain.
- **Round-trip**: a value with no comma/quote survives `parseCsvLine(value)[0] === value`.
- **Field count**: equals (number of top-level, i.e. non-quoted, commas) + 1.
- **No silent corruption**: every input either parses to the correct fields or
  throws — it never returns a different-but-plausible field list.
