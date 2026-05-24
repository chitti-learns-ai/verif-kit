# Verif-Kit verification-agent validation — FINDINGS

_Reproduce with `node validation/score.mjs` from the repo root → writes
`results.json`._

## What was measured

Does the independent `verification-engineer` agent — blind to the implementation,
working from a spec alone — actually catch bugs, without crying wolf on correct
code? Method: 10 synthetic designs across 9 domains, each with ONE planted,
hint-free bug and a correct control. A fresh agent verifies each from its spec
only (oracle/impls + answer keys held in an `oracle/` tree it is never pointed
at; a contamination check confirms each agent test imports only `./sut`). The
scorer runs every case against buggy AND correct and compares to a pre-declared
`expectDetection` ground truth.

## Headline numbers (14 synthetic cases — plus a separate 8-case real-world study)

_This file documents the **synthetic** study (14 cases). There is also a
**real-world** study of 8 bugs that actually shipped in famous MIT libraries —
see `real-world/README.md`. One-command re-score here: `node validation/score.mjs`
→ **STUDY RESULT: ✅ all cases match ground truth.**_

- **Catchable bugs detected: 13/13** — precedence (calculator), missing subtractive
  cases (roman numerals), per-unit-vs-per-line money rounding (e-commerce),
  get-doesn't-refresh recency (LRU), surrogate-pair split (Unicode), naive-variance
  catastrophic cancellation (numerics, caught soundly — see below), calendar
  end-of-month overflow (date/time), a CSV parser that ignores quoted delimiters
  (parser), and **5 security cases**: IDOR / broken access control (OWASP A01),
  authentication bypass (expired-session replay), vertical privilege escalation
  (fail-open default), SQL injection (interpolation vs parameter binding), and
  secret leakage (denylist vs allowlist serializer).
- **Honest misses held out: 1/1** — `dedupe` (an O(n²) performance regression that
  is *functionally perfect*) was correctly reported **CONFORMS**. A spec with no
  complexity bound makes the defect invisible to functional verification, and the
  agent honestly did not invent one.
- **False positives: 0** — the scorer caught three over-reaches before final
  (an unsound variance MR; unsound substring checks in the SQL-injection and
  secret-leak security tests) and one real bug in the *control* itself (a
  prototype-key flaw in the privilege-escalation reference, exposed by the
  verifier's `valueOf` probe). All found and resolved on the record.
- **Contamination: 0** — no agent test reached the implementation or answer key.

## The two results that make this credible (not theater)

1. **`06-dedupe` — an honest, intended MISS.** The agent said "conforms," because
   it could not (and should not) detect a pure performance bug from a functional
   spec. A study that only contains catchable bugs and reports 100% is
   indistinguishable from a rigged one; this documented negative shows the harness
   reports truth, including "I can't catch this."

2. **`07-variance` — a false positive FOUND then FIXED (the framework learning in
   public).** Batch 2: the agent caught the naive catastrophic-cancellation bug
   but via a large-magnitude (k=1e12) translation-invariance relation that is
   **unsound** — shifting `[-1e6,1e6]` by `1e12` exceeds float64's representable
   precision, so it rejects *any* algorithm, including the correct one. The
   reproducible scorer caught it (the correct-impl run failed). The lesson — every
   metamorphic relation has a validity domain and must hold for a correct impl —
   was encoded in the agent charter. Batch 3 re-run under that rule: the agent
   caught the bug **soundly** via a numerically-stable two-pass reference model +
   hand-derived golden values on large-but-*exactly-representable* integers
   (`[1e9,1e9+1,1e9+2]` → variance 2/3; DUT returns 0), and **proved its checks
   pass a correct two-pass implementation** (a bench self-test). Detect-buggy,
   pass-correct: clean. This round-trip — honest FP → documented lesson → sound
   fix — is stronger evidence than a first-try 100% would have been.

3. **`08-access-control` — the security lens works on a real bug class.** Given a
   spec stating an ownership policy, the agent modeled it and attacked with two
   principals: `eve` reading `alice`'s note by its exact id. The buggy store
   returned another user's secret (IDOR); the agent flagged it **P0 / OWASP A01**.
   A functional happy-path test (owner reads own note) PASSES on the buggy code —
   only adversarial, two-principal authorization testing catches it.

4. **`10-csv-parse` — the verifier found a spec ambiguity that exposed a bug in
   the *control* (not just the buggy impl).** Verifying the CSV parser, the agent
   asked: what should happen on malformed quote usage like `"a"b` (text after a
   closing quote)? The spec didn't say. The agent's strict reference model threw;
   the *correct* control silently returned `["ab"]` — which violates the spec's
   own "no silent corruption" invariant. So the agent's tests failed on the
   control too (a scorer-flagged false positive) — but the right fix was to the
   spec + control, not the test. As architect (standing in for the sleeping
   human) the ambiguity was resolved strict, the control was corrected to throw,
   and the re-score is clean. This is the IV&V escalation loop working: the
   verifier made the *spec* better and caught a latent control defect.

## Bug-class & domain coverage so far

Semantic (precedence) · missing-cases (roman) · money rounding/conservation
(cart) · stateful recency (LRU) · encoding/surrogate (Unicode) · performance/
complexity (dedupe, honest miss) · numerical catastrophic cancellation (variance) ·
**security/IDOR (access-control)** · **calendar end-of-month (date/time)** ·
**parser silent-corruption + missing error path (CSV)**. Domains: calculator,
converter, e-commerce, data structure, text/encoding, statistics, multi-user
service, date/time, parsing. **Still missing** (planned): concurrency/async race
(likely an honest miss — valuable), integer overflow (>2^53), idempotency/retry,
API-contract/input-mutation, and integer-overflow. Timezone/DST was scoped out as
a deterministic case (validating it needs a TZ-controlled runner); the date/time
class is covered by the end-of-month case.

**Runtime/E2E lens — DEMONSTRATED (not just specified).** The runtime lens
(drive the real app via Playwright/MCP) was proven on a sample web app: a
headless Playwright run on chromium booted the built app and exercised its
critical navigation route — **1 test passed in 23.2s**. So "boots + critical path
works" is a real, executed check, not a paper claim. (This single run is the
runtime-lens proof-of-mechanism; a planted-bug E2E case is still future work.)

**Real-GitHub-bug validation** remains future work: the bugs here are original
(anti-memorization) rather than mined from a specific project's history; a
mined-bug study would further strengthen external validity.

## Threats to validity (stated, not hidden)

- **Shared-spec correlation (Knight & Leveson):** the agent's reference model and
  the implementation both descend from the same spec, so a misreading common to
  both can escape a scoreboard. Mitigated — not eliminated — by oracle-free checks
  (metamorphic, hand-derived golden values, the Unicode validity oracle). The
  Unicode case (05) is direct evidence the agent applies this mitigation: it
  explicitly refused a `.slice`-based reference model because it would share the
  bug.
- **Single model family:** the study author and the agent are the same model
  family; this measures a lower bound on what a truly independent human verifier
  would find, not an upper bound.
- **Small N (7):** indicative, not publication-grade. Expanding to ≥10 across more
  bug classes.
- **Novel-bug choice:** bugs are original (not copied from Defects4J/QuixBugs) to
  avoid LLM memorization (arXiv 2411.13323), but they are still author-chosen.
- **Spec-quality confound:** a miss could mean a weak spec, not a weak agent;
  specs were reviewed by an independent overseer agent.

## Bottom line

On this sample the independent agent detected every catchable bug (5/5) with zero
contamination, correctly held out a functional-invisible miss, and — most
usefully — the reproducible scorer caught the agent over-reaching with an unsound
metamorphic relation (the variance false positive), which has been turned into a
charter rule. The agent is demonstrably useful AND the harness is honest about its
limits. It is not, and is not claimed to be, a perfect or complete bug detector.
