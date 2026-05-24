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

## References

NASA SWE-141 (IV&V); IEEE 1012; ISO/IEC/IEEE 29119. Knight & Leveson, "An
Experimental Evaluation of the Assumption of Independence in Multiversion
Programming" (1986). Doulos Coverage-Driven Verification; Accellera UVM.
"How SQLite Is Tested" (sqlite.org/testing.html). syzkaller / KCOV. Jepsen
(Kingsbury) — Knossos/Elle. Beancount/GnuCash double-entry. OWASP Top 10 A01:2021
Broken Access Control. LLM test-generation: arXiv 2501.14465, 2505.09830;
benchmark memorization: arXiv 2411.13323. Multi-agent verification: arXiv
2511.16708. Sycophancy in multi-agent debate: arXiv 2509.23055, 2509.16533.
