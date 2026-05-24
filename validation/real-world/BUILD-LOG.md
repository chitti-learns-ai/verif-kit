# Verif-Kit GitHub Real-Bug Study — Build Log

Goal: build real-world bug-detection cases from ACTUAL shipped-and-fixed bugs in
permissively-licensed npm libraries. Each landed case = `{cases/<id>/{spec.md,sut.ts},
oracle/<id>/{buggy.ts,correct.ts,meta.json,LICENSE-*.txt}}`. No `ve.test.ts` (blind
verifier writes that later).

Honesty rule: every attempt logged as LANDED or REJECTED with a specific reason.

---

## Attempts log

(chronological)

### LANDED 01-pluralize-bases
- repo: plurals/pluralize (MIT)
- bug: the `-sis`/`-ses` singularization regex captured stem `ba`, so
  `singular('bases')` returned `'basis'` (and `'databases'`->`'databasis'`)
  instead of `'base'`/`'database'`.
- fix commit: c46c6af6998a11c92212feea004f67cb2e76124c (parent e2ed8d18)
- bug class: incorrect regex / over-broad capture group
- verified: buggy vs correct DIVERGE on singular('bases') and singular('databases');
  AGREE on analyses/diagnoses/crises/theses (fix is surgical). plural() unaffected.
- spec authored from README usage docs only; no hint at "bases".

### LANDED 02-currencyjs-distribute
- repo: scurker/currency.js (MIT)
- bug: distribute() chose the leftover-penny direction from the per-item value
  (0 for leftover parts -> treated as >=0) instead of the total's sign, so a
  small NEGATIVE amount was distributed as POSITIVE parts (sum had wrong sign).
- fix commit: 2e907c2f5af53d661f3770728b4d99ece6458030 (PR #99)
- bug class: comparison on wrong variable -> conservation/sign violation
- verified: currency(-0.01).distribute(5) buggy=[0.01,0,0,0,0] sum +0.01 vs
  correct=[-0.01,0,0,0,0] sum -0.01. Also -0.03/4. Positive amounts AGREE.
- spec authored from README + JSDoc; conservation invariant stated generically,
  no hint at negatives.

### LANDED 03-parse-ms-infinity
- repo: sindresorhus/parse-ms (MIT)
- bug: for near-MAX_VALUE input, milliseconds*1e6 overflows to Infinity and
  Math.trunc(Infinity % 1000) is NaN, so microseconds/nanoseconds come back NaN.
- fix commit: b2221004589ecbb6297014d4138c9d56f58ac7df (PR #20)
- bug class: overflow-to-Infinity -> NaN (missing finite guard)
- verified: parseMilliseconds(Number.MAX_VALUE) buggy micro/nano = NaN vs
  correct = 0. All normal + 1e300 inputs AGREE (narrow boundary case — honest).
- spec states "every field is a finite number for any finite input" invariant
  without naming MAX_VALUE.

### LANDED 04-ms-negative-decimal
- repo: vercel/ms (MIT)
- bug: parse regex allowed only ONE integer digit after a leading minus
  ('\-?\d?'), so '-10.5h' (>=2 integer digits, negative) failed to parse and
  returned undefined instead of -37800000.
- fix commit: 2669f23e99be0bb6b65d365151884de52434301c (PR #111)
- bug class: incorrect regex quantifier
- verified: ms('-10.5h') buggy=undefined vs correct=-37800000; same for
  '-100.5s','-10.5m'. Positive decimals and single-digit negatives AGREE.
- spec states sign-symmetry + decimal/integer-parity invariants from README;
  no hint at the multi-digit-negative case.

### LANDED 05-semver-regex-truncate
- repo: sindresorhus/semver-regex (MIT)
- bug: prerelease/build segments used LAZY quantifiers ({0,100}?), so extracting
  a full SemVer string captured only MAJOR.MINOR.PATCH and dropped the
  -prerelease+build suffix.
- fix commit: e93d9c81ca2b27a7c63ae8f45725dfceb0df2d4a (PR #23, "Fix false positives")
- bug class: incorrect regex (lazy quantifier truncation)
- verified: README's OWN example
  '1.2.3-alpha.10.beta.0+build.unicorn.rainbow'.match(re)[0] = '1.2.3' (buggy)
  vs full string (correct). .test() passes in both; plain '1.0.0' AGREES.
- spec anchored to semver.org 2.0.0 + README examples; full-token-capture
  invariant; no hint.
- NOTE: sut.ts uses extensionless import to match the existing study convention
  (resolved by the vitest/TS harness the blind VE runs under); buggy.ts /
  correct.ts verified directly with explicit .ts extensions.

### NOTE (held, not landed): word-wrap CVE-2023-26115 (jonschlinkert/word-wrap, MIT)
- ReDoS in `options.trim` via /\s+$/g catastrophic backtracking; fix replaces
  with manual trimTabAndSpaces.
- Held: pure performance/ReDoS bug. On normal inputs buggy==correct by VALUE; the
  only difference is execution TIME on a crafted input. The verif-kit scorer
  compares behavior/values, so a value-identical timing bug is harness-fragile.
  Would require expectDetection:false + a timeout-based oracle. Revisit only if
  short on value-divergent cases. (fix commit 9f626935f3fac6ec0f3c4b26baea4eb9740d9645)

### LANDED 06-strip-json-comments-escape
- repo: sindresorhus/strip-json-comments (MIT)
- bug: "is this quote escaped?" used jsonString[i-1]==='\\' && jsonString[i-2]!=='\\',
  which only handles runs of 1-2 backslashes; for a run of 3+ it misjudges parity,
  so a string whose quote IS escaped is treated as terminated and an in-string
  // or /* gets wrongly stripped as a comment.
- fix commit: 23acbfec0e758d7aa21ca203d176f820ae9d73be (PR #41)
- bug class: off-by-one / incomplete escape-run parity counting
- verified: input with 3 backslashes before a quote (String.raw`{"x":"a\\\"//y"}`)
  -> buggy strips in-string `//y"}`, correct preserves. 0/1/2-backslash inputs AGREE.
- spec describes "strings are inviolate" + JSON backslash-parity escaping rule
  (standard JSON semantics, not a hint at the specific 3-backslash failing input).

### LANDED 07-compare-versions-shortcrash
- repo: omichelsen/compare-versions (MIT)
- bug: one/two-segment versions have undefined patch segment; the prerelease
  check did `(s1[2] + s2[2]).indexOf('-')`, but undefined+undefined === NaN
  (a number), so .indexOf throws TypeError. Crashes on documented input.
- fix commit: 0919141b865e41c3b4a5fe911921ac7b87ab3253
- bug class: missing case / unguarded undefined -> crash
- verified: compareVersions('10','10') THROWS in buggy, returns 0 in correct.
  Also '1','1' and '1-alpha','1'. 3-segment comparisons AGREE.
- spec anchored to README's explicit claim of supporting '1.0.0','1.0','1';
  totality/reflexive-equality invariants. (Pre-TS 2015 source, UMD->ESM.)

### LANDED 08-word-wrap-redos  (expectDetection: FALSE — honest hard case)
- repo: jonschlinkert/word-wrap (MIT)
- bug: CVE-2023-26115 ReDoS — options.trim did result.replace(/\s+$/g,''),
  catastrophic backtracking on a long whitespace run. Fix uses manual
  trimTabAndSpaces.
- fix commit: 9f626935f3fac6ec0f3c4b26baea4eb9740d9645
- bug class: performance/ReDoS (+ secondary spec-ambiguous per-line-trim value change)
- verified: PERF — buggy ~30s vs correct ~4ms on ' \t'*50000+'!' with trim:true.
  Also a VALUE diff on multi-line trim ('a \n\nb \n \nc' vs 'a\n\nb\n\nc').
- expectDetection:false because catching the ReDoS needs a timing/timeout oracle,
  and the value difference depends on a debatable reading of "trim trailing
  whitespace from the returned string". Included as the deliberate hard case.
- NOTE: the fix-commit behavior does NOT match a later-added test ('a\nb\nc');
  that test depends on commits after 9f62693. correct.ts is exactly 9f62693.


---

## Summary

### Counts
- Repos/bugs SERIOUSLY investigated (diff read + reasoned about): 9
- LANDED: 8 cases (7 expectDetection:true + 1 honest expectDetection:false)
- HELD/REJECTED: see below

### LANDED cases
| id | repo | bug class | fix commit |
|----|------|-----------|------------|
| 01-pluralize-bases | plurals/pluralize | incorrect regex (over-broad capture) | c46c6af |
| 02-currencyjs-distribute | scurker/currency.js | wrong-variable comparison -> conservation/sign violation | 2e907c2 |
| 03-parse-ms-infinity | sindresorhus/parse-ms | overflow-to-Infinity -> NaN | b222100 |
| 04-ms-negative-decimal | vercel/ms | incorrect regex quantifier | 2669f23 |
| 05-semver-regex-truncate | sindresorhus/semver-regex | incorrect regex (lazy quantifier truncation) | e93d9c8 |
| 06-strip-json-comments-escape | sindresorhus/strip-json-comments | off-by-one escape-run parity | 23acbfe |
| 07-compare-versions-shortcrash | omichelsen/compare-versions | missing case / undefined->NaN crash | 0919141 |
| 08-word-wrap-redos | jonschlinkert/word-wrap | performance/ReDoS (expectDetection:false) | 9f62693 |

### REJECTED / not pursued (with reasons)
- **sindresorhus/slugify** — `1aaea23 Fix handling of plural acronyms`: REJECTED.
  Depends on `@sindresorhus/transliterate` (heavy transitive dep); not isolatable
  into a self-contained pure-logic module without pulling in the transliteration
  tables. Would violate "no heavy deps".
- **jonschlinkert/word-wrap** as a clean logic case — DOWNGRADED to expectDetection:false
  (landed as 08): the headline bug is ReDoS (a timing bug); the only value
  divergence (per-line vs end-of-string trim) rests on a debatable reading of the
  README, and the fix-commit behavior doesn't even match a later-added test.
  Kept as the deliberate honest hard case rather than a clean true-positive.
- **omichelsen/compare-versions** `760e273 fix(satisfies)` — NOT pursued: 31-line
  multi-concern change across index.ts spanning satisfies()+comparator parsing;
  harder to isolate one trigger and to spec without hinting. Used the cleaner,
  single-trigger `0919141` short-version crash instead (landed as 07).
- **jonschlinkert/kind-of** `975c13a fix type checking vul in ctorName` — NOT
  pursued: the "bug" is a prototype-pollution/security hardening of constructor-
  name detection; the divergence requires adversarial crafted objects and is hard
  to specify as intended behavior from the README without effectively describing
  the exploit (i.e. hinting). Lower-signal than the landed set.
- **scurker/currency.js** `347bd3c rounds half up` — NOT pursued (a second
  currency.js bug): viable but redundant with the already-landed currency.js
  distribute case; one case per library keeps the corpus diverse across repos.

### Honesty notes
- Every landed case was executed: buggy.ts and correct.ts both import and run,
  they DISAGREE on the recorded triggerInput, and AGREE on control inputs. A
  single consolidated check (22 assertions) passes — see the build session.
- No ve.test.ts written (the blind verifier authors those separately).
- All sources are MIT-licensed; each library's LICENSE is saved next to its
  extracted code as oracle/<id>/LICENSE-<lib>.txt. Code is reproduced verbatim
  (UMD/CJS wrappers mechanically converted to ESM exports; internal logic
  unchanged) as small excerpts for verification research, with attribution.
- The scratch clone dir (_scratch/) was removed after extraction.
