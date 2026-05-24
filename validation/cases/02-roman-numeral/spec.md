# Spec — Integer → Roman numeral

```ts
export function toRoman(n: number): string;
```

## Behavior

Convert an integer `n` in the range **1..3999 inclusive** to its standard Roman
numeral string, using **subtractive notation**.

Subtractive notation means the six "subtractive pairs" are used instead of four
repeated symbols:

- 4 → `IV`, 9 → `IX`
- 40 → `XL`, 90 → `XC`
- 400 → `CD`, 900 → `CM`

A symbol is otherwise repeated at most three times. The result is the unique
canonical Roman form.

## Worked examples (these define the required output exactly)

| n | toRoman(n) |
|---|---|
| 1 | `I` |
| 3 | `III` |
| 4 | `IV` |
| 9 | `IX` |
| 14 | `XIV` |
| 40 | `XL` |
| 90 | `XC` |
| 400 | `CD` |
| 944 | `CMXLIV` |
| 1994 | `MCMXCIV` |
| 2023 | `MMXXIII` |
| 3999 | `MMMCMXCIX` |

## Edge cases / errors

- `n` outside 1..3999, or non-integer, MUST throw an `Error` — never return a
  malformed or empty string silently.

## Invariants

- **Canonical form**: no symbol (`I`,`X`,`C`,`M`) appears 4+ times in a row; the
  subtractive pairs above are used wherever applicable.
- **Round-trip**: parsing `toRoman(n)` back by standard Roman rules yields `n`
  (you may write your own parser as an oracle).
- **Monotonic length-ish**: not strictly required, but each value maps to exactly
  one canonical string.
