# Spec — Pluralize / singularize an English word

Derived from the public README/usage docs of the `pluralize` library. Describes
the intended behavior of the singular/plural API.

```ts
export function plural(word: string): string;
export function singular(word: string): string;
export function isPlural(word: string): boolean;
export function isSingular(word: string): boolean;
```

## Behavior

The library applies a pre-defined, ordered list of morphological rules to convert
an English word between its singular and plural forms.

- `plural(word)` returns the plural form of `word`.
- `singular(word)` returns the singular form of `word`.
- `isPlural(word)` / `isSingular(word)` report which form the word is already in.

Casing of the input is preserved in the usual English way (the transformation
changes the ending, not the overall capitalization pattern of the leading
characters).

## Worked examples (from the docs)

| call | result |
|---|---|
| `plural("test")` | `"tests"` |
| `plural("regex")` | `"regexes"` |
| `singular("singles")` | `"single"` |
| `plural("apple")` | `"apples"` |
| `singular("apples")` | `"apple"` |

The library is expected to handle the full range of ordinary English nouns,
including common regular nouns, words ending in `-s`/`-es`, and the standard
irregular and Greco-Latin forms (e.g. `analysis`/`analyses`,
`diagnosis`/`diagnoses`, `crisis`/`crises`, `index`/`indices`,
`child`/`children`, `mouse`/`mice`).

## Invariants

- **Singular/plural inverse on regular nouns**: for an ordinary English noun
  given in its singular form `s` whose plural `p = plural(s)` differs from `s`,
  applying `singular(p)` recovers the original singular: `singular(plural(s)) === s`.
  This round-trip must hold for everyday vocabulary — both short common nouns and
  longer compound/derived nouns built from them.
- **Idempotence of form**: `plural(plural(s))` equals `plural(s)` for a noun that
  is already plural-stable, and likewise `singular(singular(p))` equals
  `singular(p)`.
- **Greco-Latin `-sis`/`-ses` words** (e.g. `analysis`↔`analyses`,
  `diagnosis`↔`diagnoses`, `thesis`↔`theses`) convert correctly and round-trip.
- `isSingular(word)` is true iff `singular(word) === word` under the library's
  rules; `isPlural` is the dual.

## Notes

The transformation is rule-based and best-effort over real English; it is not
expected to invent forms for nonsense strings. The invariants above target
ordinary, well-formed English nouns.
