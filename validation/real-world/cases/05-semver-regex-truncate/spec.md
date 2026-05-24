# Spec — `semverRegex()`: a regular expression that matches SemVer versions

Derived from the public README of the `semver-regex` library.

```ts
export default function semverRegex(): RegExp;
```

## Behavior

`semverRegex()` returns a **fresh** regular expression (global, case-insensitive)
that matches [Semantic Versioning](https://semver.org) version strings inside
text. A new RegExp is returned on each call so callers don't share `lastIndex`
state.

It is used three ways, all documented:

```js
semverRegex().test('v1.0.0');
//=> true

semverRegex().test('1.2.3-alpha.10.beta.0+build.unicorn.rainbow');
//=> true

semverRegex().exec('unicorn 1.0.0 rainbow')[0];
//=> '1.0.0'

'unicorn 1.0.0 and rainbow 2.1.3'.match(semverRegex());
//=> ['1.0.0', '2.1.3']
```

## What a SemVer version is (per semver.org 2.0.0)

A version is `MAJOR.MINOR.PATCH`, optionally followed by:

- a **pre-release** label: a leading `-` then dot-separated identifiers
  (e.g. `-alpha`, `-alpha.10.beta`, `-rc.1`, `-0`, `-4`),
- and/or **build metadata**: a leading `+` then dot-separated identifiers
  (e.g. `+build.unicorn.rainbow`, `+asdf`, `+build.1848`).

An optional leading `v`/`V` prefix is tolerated. Numeric core identifiers have no
leading zeros.

## Extraction semantics (the defining property)

When the regex matches a version embedded in (or equal to) a string, the matched
substring is the **entire version token**, INCLUDING any pre-release and build-
metadata parts — not merely the `MAJOR.MINOR.PATCH` core.

Worked, from the README:

| input passed to `.match()` / `.exec()[0]` | extracted match |
|---|---|
| `'1.0.0'` | `'1.0.0'` |
| `'unicorn 1.0.0 rainbow'` | `'1.0.0'` |
| `'1.2.3-alpha.10.beta.0+build.unicorn.rainbow'` | `'1.2.3-alpha.10.beta.0+build.unicorn.rainbow'` |
| `'unicorn 1.0.0 and rainbow 2.1.3'` | `['1.0.0', '2.1.3']` |

## Invariants

- **Full-token capture**: for any valid SemVer string `v` (with or without a
  pre-release and/or build-metadata suffix), `v.match(semverRegex())[0] === v`.
  In particular, a version that HAS a pre-release/build suffix must match the
  whole thing, not get truncated to its `MAJOR.MINOR.PATCH` prefix.
- **`test` agrees with `match`**: if `semverRegex().test(v)` is `true` for a
  standalone valid version `v`, then `v.match(semverRegex())[0]` equals `v`.
- **Fresh state**: two calls return regexes that match independently.
- **No false negatives on documented forms**: every version form shown in the
  README examples matches.
