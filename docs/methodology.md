# Verif-Kit methodology — why it's built this way

Verif-Kit is not "an LLM that writes tests." It is an **independent, coverage-driven
verification environment** assembled from established software- and hardware-
verification practice. This document grounds each design choice in its source so
the tool's claims are auditable, and states honestly what it cannot do.

## 1. Independence (the core) — NASA IV&V / IEEE 1012

The foundational rule: the verifier **never sees the implementation**. This is
*technical independence* from NASA's Independent Verification & Validation
(SWE-141) and IEEE 1012 — the V&V team is not the development team and **builds
its own tools and models**. Why it matters: when the same context writes the code
and its tests, the test oracle merely replays the author's understanding, so a
misread spec yields a *green-but-wrong* result (the oracle problem). Verif-Kit's
verifier derives expected behavior from the spec/contract alone and writes an
independent reference model.

## 2. The honest limit — Knight & Leveson (1986)

Independence reduces but does **not eliminate** correlated errors: Knight &
Leveson showed that independently-developed programs built from the *same
specification* fail in correlated ways, because people make equivalent mistakes
reading the same spec. So the verifier and the code share one residual single
point of failure — the spec. Verif-Kit mitigates (never claims to eliminate) this by:
- **oracle-independent checks** (metamorphic relations, hand-derived golden
  values, externally-known truths, real data) that don't depend on a shared
  expected-value;
- **escalating genuine spec ambiguity to the human** (the only party who can
  patch the shared SPOF);
- reporting an explicit **"honest residual"** in every run.

## 3. Coverage-driven verification — Doulos CDV / UVM

From hardware's Coverage-Driven Verification and UVM: a **self-checking
environment** (assertions + an end-to-end **scoreboard** vs a **reference model**)
driven by **constrained-random stimulus** to **functional-coverage closure**
against a **verification plan**. Verif-Kit maps these to software: fast-check
arbitraries (generator), an independent from-spec model + a `Scoreboard`
(checker), property/invariant assertions, and a `CoverageModel` that gates
sign-off on closure. Coverage tells you *which scenarios were exercised*, not just
which lines ran.

## 4. Beyond UVM — practices from correctness-critical software

- **Differential testing** (SQLite runs queries through independent engines and
  diffs) — Verif-Kit's scoreboard is differential by construction.
- **Branch/MC-DC coverage discipline** (SQLite holds 100% on its core) — drive
  high branch coverage, and don't pad with unreachable defensive code, which
  blunts fuzzing.
- **Coverage-guided fuzzing + a persisted seed corpus** (SQLite's `fuzzcheck`;
  Linux's syzkaller, 3000+ kernel bugs) — for parsers and untrusted input; every
  failing input becomes a permanent regression seed.
- **Conservation / double-entry invariants** (Beancount/GnuCash) — for any
  value-moving module, "nothing created or destroyed; parts re-sum to the whole."
- **Anomaly / fault-injection** (Jepsen's *nemesis*) — verify graceful, loud
  behavior under malformed input, corrupt/partial state, interruptions, clock skew.
- **Model-based history checking** (Jepsen's Knossos/Elle) — for stateful and
  concurrent code: random operation histories + fault injection checked against a
  consistency model.

## 5. Security — OWASP Top 10 A01 (Broken Access Control)

For modules touching auth, multi-user/tenant data, or untrusted input, the
verifier acts as a cyber-engineer. Broken Access Control is OWASP's #1 risk
(present in ~94% of tested apps). Verif-Kit models the access-control policy from
the spec and attacks it with **two principals**: B given A's identifier must not
read or mutate A's resource (**IDOR / horizontal escalation**); protected
operations must require valid auth (no bypass; client-side gates don't count); a
non-admin must not reach admin functionality (**vertical escalation**); plus
injection/path-traversal and secret-leakage checks. Scope is **logic-level**
bypass (the app's own code) — crypto strength and OS/extension attacks are out of
scope and stated as such.

## 6. Intelligent test-case generation

Generating the *right* cases matters more than many. Verif-Kit's verifier combines
**equivalence partitioning** + **boundary-value analysis** (the richest bug
source) + **requirement/invariant tracing** + **property/metamorphic** +
adversarial/domain knowledge (with optional online research of domain corner
cases — never the implementation). This follows 2025 research on LLM test
generation (boundary-value prompting and property-based edge-case exploration:
arXiv 2501.14465, 2505.09830), which finds systematic boundary + partition design
materially improves fault detection over unstructured generation.

### Metamorphic-relation soundness (a real failure mode Verif-Kit learned)

An MR must hold for a *correct* implementation, not merely fail for a buggy one;
every MR has a **validity domain**. In Verif-Kit's own validation study, a
translation-invariance relation applied with a huge shift (k=1e12) flagged the
buggy naive-variance formula but **also rejected the correct two-pass
implementation** — a false positive caused by an out-of-domain MR (the shifted
inputs left float64's representable range). The lesson, now a charter rule:
bound the transform so inputs stay representable, or catch the bug *soundly* via
a numerically-stable reference model + hand-derived golden values on
large-but-exactly-representable inputs.

## 7. Validation by bug injection (Verif-Kit ships evidence)

Most AI test tools ask you to trust them. Verif-Kit ships a reproducible
bug-injection study (`validation/`, summarized in `evidence/`): novel
(non-benchmark, to avoid LLM memorization — arXiv 2411.13323) planted bugs across
domains, each with a correct control, verified blind, scored by a one-command
runner that fails on any ground-truth mismatch and runs a contamination check.
The study deliberately includes **honest misses** (a pure performance bug a
functional spec can't see) and surfaced a **real false positive** (the MR above) —
because a flawless 100% is less credible than an honest, audited result.

## 8. Plan-gate-then-execute

Spec ambiguities are *discovered by* planning the verification but *resolving*
them is cheap while *proving* correctness is expensive. So Verif-Kit runs a cheap
PLAN pass that surfaces ambiguities for the human to resolve **first**, then a
one-shot EXECUTE pass — never paying the expensive build twice for a known gap.
State persists in on-disk ticking checklists (spec-kit's `- [ ]`→`- [x]`
mechanic) so an interrupted/compacted run resumes from disk.

## 9. Proportionality — the STAGED GATE (this governs how deep to go)

> The earlier sections describe the *full* environment. This section governs **how
> much of it to build** — because building all of it on every module is the failure
> mode this tool was reborn to fix.

**The evidence.** On the money_management_tool calibration (11 modules verified, ~10 h,
documented in that repo's `reports/overnight-build/verification-retrospective.md`),
**every one of the 4 real bugs was found by a cheap, *directed* technique** —
independent spec re-reading and a handful of metamorphic/boundary/adversarial tests
that each take minutes. The expensive phase — thousands of constrained-random cases
plus mutation testing — found **zero new bugs**; it only *confirmed* correctness on
the 7 clean modules and *measured test-suite strength*. Verification consumed ~10×
the design time for that yield. Running bug-discovery-priced machinery as a default,
regardless of risk or evidence, is the antipattern.

**The principles** (grounded, not invented):
- **Risk-based testing** — effort is proportional to risk, and you test to an
  *acceptable* risk level, not to zero. (ISTQB / ISO 29119; effort ∝ risk is the
  first rule of the discipline.)
- **Mutation testing is the most expensive, lowest-new-bug-yield lens** — systematic
  reviews call it impractical at scale (mutant volume); industrial CI studies adopt a
  small *live-mutant budget* instead of exhaustive runs. So it is **gated**, not
  default, and it measures regression-suite strength rather than finding product bugs.
- **Defect-detection effectiveness comes from combining a FEW techniques**, not from
  exhausting one — boundary-value analysis + equivalence partitioning + metamorphic
  relations are the high-yield trio; volume of random cases has sharply diminishing
  returns once functional coverage closes.

**The flow** (full operational detail in `agents/verification-engineer.md`
§"Right-sized execution — the staged gate"):

```
Triage (seconds)            classify risk tier; set time budget ≈ 1× design time
  │  Chrome → decline IV&V (smoke only)
  ▼
Stage 1 — PLAN + PROBE      independent spec read + ambiguity sweep, THEN a small
(cheap, minutes; always     high-leverage targeted set: boundary + metamorphic/
 for Core/Critical)         conservation + 2–3 golden vectors + HAZARD-CLASS
  │   ← MOST BUGS DIE HERE   adversarial probes (injectivity / ambiguity / sign /
  │                          permutation / malformed). Run them. Escalate ambiguity.
  ▼
STAGE-1 GATE                escalate to Stage 2 ONLY if:
  │                           (a) Stage 1 found a real bug (smoke ⇒ fire), OR
  │                           (b) Critical tier with a state/combinatorial space the
  │                               targeted set can't pin, OR
  │                           (c) sign-off-grade depth explicitly requested.
  │   else → STOP, sign off at Stage 1 (promote tests, state residual + that
  │          Stage 2 was deliberately skipped — acceptable risk at lower cost).
  ▼
Stage 2 — DEEPEN            reference model + scoreboard + BOUNDED random (grow N
(expensive, gated,          until coverage CLOSES, then stop) + security/runtime
 time-boxed, Critical-       lenses + INCREMENTAL, SAMPLED mutation on critical
 mostly)                     functions only. Time-boxed to the budget.
```

**Hard rule:** total verification wall-time targets **≤ ~1× the module's design
time**. A Stage-1 sign-off is a real sign-off. Over-testing and under-testing are
both judgment failures; this tool's redesign exists because over-testing was the one
actually being committed.

## References

NASA SWE-141 (IV&V); IEEE 1012; ISO/IEC/IEEE 29119. Knight & Leveson, "An
Experimental Evaluation of the Assumption of Independence in Multiversion
Programming" (1986). Doulos Coverage-Driven Verification; Accellera UVM.
"How SQLite Is Tested" (sqlite.org/testing.html). syzkaller / KCOV. Jepsen
(Kingsbury) — Knossos/Elle. Beancount/GnuCash double-entry. OWASP Top 10 A01:2021
Broken Access Control. LLM test-generation: arXiv 2501.14465, 2505.09830;
benchmark memorization: arXiv 2411.13323. Multi-agent verification: arXiv
2511.16708. Sycophancy in multi-agent debate: arXiv 2509.23055, 2509.16533.
