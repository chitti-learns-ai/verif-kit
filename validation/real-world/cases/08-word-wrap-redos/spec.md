# Spec — `wordwrap(str, options)`: wrap words to a specified length

Derived from the public README of the `word-wrap` library.

```ts
export default function wordwrap(str: string, options?: {
  width?: number;     // default 50
  indent?: string;    // default '' (prepended to each line)
  newline?: string;   // default '\n'
  trim?: boolean;     // default false
  cut?: boolean;      // default false
  escape?: (line: string) => string;
}): string;
```

## Behavior

Insert line breaks into `str` so that lines do not exceed `width` characters,
breaking at word boundaries (spaces). Returns the wrapped string.

- `width` — the column width before wrapping to a new line (default 50).
- `indent` — a string prepended to each output line (default none).
- `newline` — the line separator inserted between wrapped lines (default `\n`).
- `escape` — a function applied to each line's text.
- `cut` — if `true`, break words longer than `width` instead of overflowing.
- `trim` — see below.

If `str` is `null` or `undefined`, the function returns it unchanged (no wrapping is performed).

## `options.trim`

> Trim trailing whitespace from the returned string. This option is included
> since `.trim()` would also strip the leading indentation from the first line.

So with `trim: true`, trailing whitespace is removed (without disturbing the
leading indentation of the first line). With `trim: false` (the default),
whitespace introduced or preserved by wrapping is left in place.

## Invariants

- **Width bound**: with default options and a normal sentence, no produced line
  (excluding the indent) exceeds `width` characters, as long as individual words
  fit.
- **Word preservation**: the non-whitespace words of the input appear, in order,
  in the output; wrapping only changes where whitespace/newlines fall.
- **Robustness / termination**: `wordwrap` returns in time roughly proportional
  to the input length. It must not exhibit pathological (super-linear) slowdown
  or hang on any input — including inputs consisting largely of whitespace —
  regardless of the options. A call on a moderately large string always
  completes quickly.
- **Idempotent on trivial input**: an empty string returns an empty string; a
  string with no spaces longer than `width` is returned unchanged unless
  `cut: true`.

## Notes

This spec is written from the library's documentation. The exact placement of
trailing whitespace on individual wrapped lines under `trim` is described only by
the prose above ("trim trailing whitespace from the returned string"); the
primary, unambiguous correctness obligation captured here is the
robustness/termination invariant.
