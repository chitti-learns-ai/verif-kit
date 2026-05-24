# Spec — `compareVersions(v1, v2)`

Derived from the public README of the `compare-versions` library.

```ts
export default function compareVersions(v1: string, v2: string): -1 | 0 | 1;
```

## Behavior

Compare two [semver](https://semver.org) version strings and report their order:

- returns `1` if `v1` is greater than `v2`,
- returns `0` if they are equal,
- returns `-1` if `v1` is less than `v2`.

The return value is suitable as a comparator for `Array.prototype.sort`.

> This library supports the full semver specification, including comparing
> versions with a **different number of digits** like `1.0.0`, `1.0`, and `1`,
> and pre-release versions like `1.0.0-alpha`.

## Documented examples

```js
compareVersions('10.1.8', '10.0.4'); //  1
compareVersions('10.0.1', '10.0.1'); //  0
compareVersions('10.1.1', '10.2.2'); // -1

// usable as a sort comparator:
['1.5.19', '1.2.3', '1.5.5'].sort(compareVersions);
//=> ['1.2.3', '1.5.5', '1.5.19']
```

## Accepted version forms

Per the docs, ALL of the following are valid inputs and must compare correctly:

- three-segment: `1.0.0`, `10.1.8`
- two-segment: `1.0`, `10.8`
- single-segment: `1`, `10`, `9`
- with a pre-release suffix: `1.0.0-alpha`, `1.0.0-beta`

A version with fewer segments is treated as having zeros in the missing
positions, so `1` ≡ `1.0.0`, `1.0` ≡ `1.0.0`, etc.

## Worked expectations (implied by the docs)

| call | result |
|---|---|
| `compareVersions('10', '9')` | `1` |
| `compareVersions('10', '10')` | `0` |
| `compareVersions('9', '10')` | `-1` |
| `compareVersions('10.8', '10.4')` | `1` |
| `compareVersions('1.0', '1.0.0')` | `0` |
| `compareVersions('1', '1')` | `0` |

## Invariants

- **Totality / no crashes**: for any two strings drawn from the accepted version
  forms above (one, two, or three numeric segments, with or without a pre-release
  suffix), the function returns one of `-1`, `0`, `1`. It never throws for a
  documented, well-formed version — including equal single-segment or two-segment
  versions.
- **Reflexive equality**: `compareVersions(v, v) === 0` for any accepted `v`.
- **Antisymmetry**: `compareVersions(a, b)` and `compareVersions(b, a)` have
  opposite signs (and are both `0` only when equal).
- **Segment padding**: comparing versions of different lengths pads the shorter
  with zeros (`'1' ` vs `'1.0.0'` are equal).
