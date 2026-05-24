# Spec — Unicode-safe string truncation

```ts
export function truncate(s: string, maxCodePoints: number): string;
```

## Behavior

Return at most `maxCodePoints` **Unicode code points** of `s`.

- Length is counted in **code points**, NOT UTF-16 code units. An emoji like `😀`
  (U+1F600) is ONE code point (but two UTF-16 units).
- If `s` has `maxCodePoints` or fewer code points, return `s` unchanged.
- Otherwise return exactly the first `maxCodePoints` code points of `s`.
- **The result must always be a valid Unicode string** — never split a surrogate
  pair, never emit a lone/unpaired surrogate.

## Worked examples

- `truncate("hello", 3)` → `"hel"`
- `truncate("hello", 10)` → `"hello"`
- `truncate("😀😀😀", 2)` → `"😀😀"` (two code points, four UTF-16 units)
- `truncate("a😀b", 2)` → `"a😀"`
- `truncate("", 5)` → `""`

## Edge cases / errors

- `maxCodePoints` must be a non-negative integer, else throw.
- `truncate(s, 0)` → `""`.

## Invariants

- **Validity**: `truncate(s, n)` is ALWAYS a well-formed Unicode string — it
  contains no unpaired surrogate code unit. (This holds for every `s` and `n`.)
- **Code-point bound**: `[...truncate(s, n)].length <= n`.
- **Prefix**: `truncate(s, n)` is a code-point prefix of `s` (the first
  `min(n, codePointLength(s))` code points).
- **Idempotent-ish**: `truncate(truncate(s, n), n) === truncate(s, n)`.
- **No-op when short**: if `[...s].length <= n`, `truncate(s, n) === s`.
