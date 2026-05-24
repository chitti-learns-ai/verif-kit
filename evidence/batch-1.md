# Verif-Kit evidence — bug-injection validation (10 cases)

> Unlike most AI test tools, Verif-Kit ships *evidence* it catches bugs. This is a
> controlled study, fully reproducible with `node validation/score.mjs`
> (writes `results.json`). Full method + threats: `validation/FINDINGS.md`.

## Method (in one paragraph)

7 synthetic designs across 6 domains, each with ONE planted, hint-free bug and a
correct control. A fresh `verification-engineer` reads only the spec (never the
implementation; impls + answer keys live in an `oracle/` tree it is never pointed
at; a contamination check fails the run if a verifier test imports anything but
the public API), builds its own coverage-driven environment, and we score its
tests against the buggy AND the correct implementation. Bugs are **original** (not
copied from public benchmarks, to avoid LLM memorization).

## Results

| # | Domain | Bug class | Expected | Outcome |
|---|--------|-----------|----------|---------|
| 01 | calculator | operator precedence (semantic) | detect | ✅ detected (metamorphic precedence + golden) |
| 02 | converter | missing subtractive cases (Roman 4/9) | detect | ✅ detected (oracle-free round-trip parser over all 1..3999) |
| 03 | e-commerce | money rounding / conservation (per-unit vs per-line) | detect | ✅ detected (independent reference model found the withheld `333×3` drift) |
| 04 | data structure | stateful LRU recency (get doesn't refresh) | detect | ✅ detected (model-based random op-histories) |
| 05 | text/encoding | UTF-16 surrogate-pair split | detect | ✅ detected — verifier *recognized the shared-blind-spot trap*, refused a `.slice` reference model, used oracle-free validity checks |
| 06 | algorithm | O(n²) perf regression (functionally perfect) | **honest MISS** | ✅ correctly reported CONFORMS — functional verification can't see a pure perf bug |
| 07 | numerics | naive-variance catastrophic cancellation | detect | ✅ detected SOUNDLY (batch-3 re-run): stable two-pass reference model + large-but-exactly-representable golden inputs; proven to pass a correct impl. (Batch 2 first caught it via an *unsound* large-k MR → a false positive the scorer surfaced → lesson encoded → re-run clean.) |
| 08 | security / multi-user | broken access control — IDOR / horizontal privilege escalation (OWASP A01) | detect | ✅ detected — modeled the ownership policy, attacked with two principals (B reads A's note by id); flagged P0 |
| 09 | date/time | calendar end-of-month overflow (missing clamp) | detect | ✅ detected — boundary-value analysis on month-end days; `addMonths('2021-01-31',1)`→'2021-03-03' vs '2021-02-28' |
| 10 | parser / ingestion | naive split ignores quoted delimiters + missing error path | detect | ✅ detected — fuzz + quoted-comma invariant; also surfaced a spec ambiguity (`"a"b`) that exposed a bug in the *control*, resolved strict per the no-silent-corruption invariant |

## Headline numbers — two studies, 22 cases total

This page details the original synthetic batch. The study has since grown to two:

**Synthetic — 14 cases** (`node validation/score.mjs`): **13/13 catchable detected · 1/1 honest miss · 0 false positives · 0 contamination.** Now includes **5 security cases** — IDOR, authentication bypass, vertical privilege escalation, SQL injection, secret leakage.

**Real-world — 8 cases** (`node validation/real-world/score.mjs`): bugs that actually shipped in famous MIT libraries and were later fixed. **7/7 catchable detected · 0 false positives · 0 contamination** (the ReDoS case was surprise-caught via a timing probe). See `validation/real-world/README.md`.

**Combined: 20/20 catchable bugs detected, 0 false positives, across 22 cases.**

- Bug classes: semantic, missing-case, money-rounding/conservation, stateful, encoding, performance (honest miss), numerical, regex, overflow, ReDoS, and **security** (IDOR, auth bypass, privilege escalation, injection, secret leakage). Domains span calculators, converters, e-commerce, data structures, parsers, dates, statistics, and multi-user services.
- The scorer also caught the verifier over-reaching (unsound checks, fixed), a real bug in our own control (prototype-key flaw), and a genuine residual bug in a shipped library (parse-ms's official fix is incomplete) — all documented, not hidden.

## What makes this credible (not theater)

1. **A documented honest miss (06).** The verifier said "conforms" on
   functionally-perfect-but-slow code, because a functional spec gives it no way
   to see a complexity regression. A study that only contains catchable bugs and
   reports 100% is indistinguishable from a rigged one.
2. **A real imperfection caught by the harness (07).** The verifier over-reached
   with a metamorphic relation valid only inside floating-point's representable
   range; at k=1e12 it rejects even the correct implementation. The reproducible
   scorer caught this (the correct-impl run failed), the study exits non-zero, and
   the lesson — *every metamorphic relation has a validity domain; it must hold
   for a correct impl too* — is now a rule in the verifier's charter. A flawless
   100% would be less trustworthy than this.

## Honest limits

Small N (7); single model family (lower bound on what an independent human finds,
not an upper bound); shared-spec correlation (Knight & Leveson) mitigated by
oracle-free checks but not eliminated. Still missing and planned: concurrency,
timezone/DST, integer overflow, idempotency, a security auth-bypass case, and a
runtime web-app (E2E) case. See `FINDINGS.md`.
