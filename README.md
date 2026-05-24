# Verif-Kit

**Independent, coverage-driven verification for any codebase.** A fresh-context AI
verification engineer — blind to your implementation by construction — reads your
spec, designs a test plan, builds a self-checking verification environment, drives
it to functional-coverage closure, proves the tests can actually fail (mutation),
and signs off or reports precise, reproducible defects.

![license](https://img.shields.io/badge/license-MIT-blue) ![node](https://img.shields.io/badge/node-%E2%89%A518-brightgreen) ![status](https://img.shields.io/badge/status-v0.1-orange)

Drop it into any repository (`npx github:chitti-learns-ai/verif-kit`), then run
`/verif-kit <module>` whenever you finish a non-trivial piece of logic.

---

## What it verifies

Verif-Kit is not a single test generator — it is a **verification environment** that
applies a battery of complementary techniques. Which ones run is chosen by the
module's risk tier (see [Gating](#risk-tiered-gating)). Each technique exists to
catch a different *class* of defect:

| Verification technique | What it does | Defect class it catches | When it applies |
|---|---|---|---|
| **Conformance / differential** | Builds an **independent reference model** from the spec and compares the module's output to it through a **scoreboard**, over many inputs | Any deviation from specified behavior | Any module with a definable expected result |
| **Property-based** | Asserts **invariants** hold across large random input spaces (idempotence, round-trip, monotonicity, range, ordering) | Universal-property violations a few examples would miss | Pure logic with stable invariants |
| **Metamorphic** | Checks **relations between related runs** when no oracle exists — scaling, translation, permutation-invariance, conservation | Bugs where you can't compute "the right answer" but know how outputs must relate | Numerics, transforms, oracle-hard logic |
| **Boundary-value & equivalence partitioning** | Systematic enumeration of edges (empty, min/max, off-by-one, zero, negative, overflow, Unicode boundaries) and representative input classes | Corner-case and off-by-one bugs | Everything |
| **Stateful / model-based** | Drives **random sequences of operations** against a model of expected state | Ordering / history bugs (cache eviction, store consistency, state machines) | Stateful modules |
| **Conservation / balance** | Verifies value is neither created nor destroyed (sums preserved, double-entry) | Money rounding/leakage, accounting drift | Money & value-moving code |
| **Fuzzing + seed corpus** | Random and adversarial/malformed input; persists a regression corpus | Crashes, silent data corruption, **missing error paths** | Parsers, deserializers, untrusted input |
| **Security (OWASP-aligned)** | Adversarial, **multi-principal** probes — see the security matrix below | Access-control, authn/authz, injection, and disclosure flaws | Auth, multi-user data, untrusted input |
| **Runtime / E2E** | Drives the **actual running app** (Playwright) through its critical path | Integration/wiring failures unit checks can't see | Web apps / UIs |
| **Functional-coverage closure** | Defines **cover points** (input/state/outcome bins) and drives stimulus until all are hit; reports holes | "We never actually exercised that branch" | Every run — it is the stopping criterion |
| **Mutation / fault-injection** | Injects faults into the code (and the bench) to prove the suite can actually fail | Vacuous or weak tests that pass no matter what | Sign-off on P0/P1 modules |

### Security matrix (the cyber-engineer lens)

When a module touches authentication, authorization, multi-user data, or untrusted
input, Verif-Kit runs adversarial probes mapped to OWASP categories:

| Probe | Question it asks |
|---|---|
| **Broken access control / IDOR** (OWASP A01) | Can principal B read or mutate principal A's object just by knowing its id? |
| **Authentication bypass** | Is an expired, empty, or forged credential ever accepted? |
| **Privilege escalation** | Can a lower-privileged (or unknown) role perform a privileged action? (fail-open defaults) |
| **Injection** | Does untrusted input change the *structure* of a query/command/path instead of being treated as data? |
| **Secret leakage** | Do secrets (hashes, tokens, keys) escape into outputs, logs, or serialized responses? |

---

## The verification framework

Verif-Kit adapts **coverage-driven verification (CDV)** — the methodology hardware
teams use (UVM) — to software, and grounds independence in **NASA IV&V** (technical
independence, IEEE 1012). The environment is assembled per module:

```
            ┌─────────────────────────────────────────────────────────┐
            │  constrained-random + directed STIMULUS  (generator)     │
            └───────────────┬───────────────────────┬─────────────────┘
                            │                        │
                            ▼                        ▼
                   ┌──────────────┐        ┌──────────────────────┐
                   │  module(SUT) │        │  reference model     │
                   │  (verified   │        │  (independent,       │
                   │   blind)     │        │   from spec only)    │
                   └──────┬───────┘        └──────────┬───────────┘
                          │                           │
                          ▼                           ▼
                   ┌──────────────────  SCOREBOARD  ──────────────────┐
                   │       compare every output → mismatches          │
                   └──────────────────────┬───────────────────────────┘
                                          ▼
   assertions / invariants  ·  functional-coverage model  ·  security & runtime lenses
                                          ▼
                          mutation / fault-injection sign-off
```

### Process: plan-gate-then-execute

Verification runs in two passes so the cheap work (clarifying the spec) always
happens before the expensive work (proving correctness):

1. **Contract** — an *implementation-free* statement of WHAT the module must do: the
   interface, requirements, invariants, edge cases, error contract, and (if relevant)
   security/runtime expectations. Never HOW.
2. **PLAN pass (cheap)** — the verifier designs the **cover points** (via
   boundary-value + equivalence-partitioning + property/metamorphic analysis) and
   **surfaces every spec ambiguity**. No stimulus or mutation yet.
3. **PLAN GATE** — ambiguities are resolved *before* execution. A genuine spec
   ambiguity escalates to the human (the spec is the shared single point of failure);
   a misread is dropped with a citation.
4. **EXECUTE pass (once)** — the verifier builds the full environment above, drives
   functional coverage to **closure**, runs the security and runtime lenses, and
   **signs off via mutation**.
5. **Designer ⇄ Verifier dialogue** — each finding is classified (confirmed bug /
   verifier misread / out-of-scope / spec-ambiguous) with spec citations. Explicitly
   anti-sycophantic: the author must not blindly fix; the verifier must not blindly
   concede.
6. **Promote** — accepted independent tests join your permanent suite forever.

State lives in **on-disk ticking checklists** (`*.vplan.md`,
`*.verification-tasks.md`), so a compacted or interrupted run resumes by re-reading
the files — ask "where are we?" and the answer is on disk.

### Independence model

The verifier is a **fresh context that never reads your implementation** — so it
cannot inherit the author's blind spots (the failure mode of tools that test the
code they can see). A contamination check fails the run if a verifier test imports
anything but the public API. Because the verifier and the code still share one
spec (Knight & Leveson: same-spec workers make *correlated* errors), the verifier
leans on **oracle-independent** checks — metamorphic relations, hand-derived golden
values, conservation invariants, real data — and reports an explicit residual of
what it could not cover. For P0 modules it can run as a fully separate session.

---

## Risk-tiered gating

Lenses and gates auto-select by the module's tier, declared in
`verif-kit.config.json`:

| Tier | Example | Coverage floor (line/branch) | Mutation floor | Required lenses |
|---|---|---|---|---|
| **P0** correctness-critical | money, safety, crypto | 95 / 90 | 80 | + conservation invariant, separate-session independence |
| **P1** core logic / parsers | ingestion, business rules | 80 / 70 | 70 | + fuzzing |
| **P2** app / UX | routes, view logic | branch 60 | — | + runtime/E2E |
| **P3** chrome / trivial | styling, glue | — | — | skipped |

A module is signed off only when its tier's coverage closes **and** its mutation
floor is met. Effort is right-sized: a trivial pure function gets a handful of
directed cases and a property or two, not a 40-minute fuzz campaign.

---

## Install

From the root of the project you want to verify (no clone, no global install):

```bash
npx github:chitti-learns-ai/verif-kit
# …or from a local checkout:
node /path/to/verif-kit/install.mjs
```

The installer copies the command surface into `.claude/` (the verifier agent + the
`/verif-kit` skill), the engine into `.verif-kit/` (templates, scripts, framework),
and writes a starter `verif-kit.config.json`. It never overwrites an existing
config, and writes a `.verif-kit/verif-kit.json` integrity manifest.

## Usage

```bash
/verif-kit <module>      # e.g.  /verif-kit money
```

It verifies **one module at a time**. It first states which spec it is verifying
against — and if it cannot find one, it asks you rather than assuming. Output is a
report led by a one-line **verdict**, the verification block diagram, a
**"what I tested"** table, a **"what I found"** table, and a plain-English bottom
line (see `templates/report-template.md`).

## Configuration

`verif-kit.config.json` is the one place project specifics live, so the agent stays
portable: your `language`/`framework`, the `commands` to run checks/tests/mutation/
e2e, the `paths` for artifacts, the `riskTiers` floors, and the `security`,
`onlineResearch`, and `independence` toggles. See `verif-kit.config.example.json`.

## Relationship to Spec-Kit

Complementary. Spec-Kit answers *"did we build what we wrote down?"*; Verif-Kit
answers *"is what we built actually correct, judged independently?"* It mirrors
Spec-Kit's install-into-any-repo structure and persisted ticking checklists, and
integrates via an `after_implement` hook (per-increment nudge) and a `Phase Z`
completion gate — with zero changes to Spec-Kit core. See `install.md`.

---

## Validation evidence

Verif-Kit ships reproducible proof that the verifier catches bugs, under
`validation/` (this is evidence, **not** part of the installed tool — it is never
copied into your project). Two studies, re-runnable in one command each:

- **Synthetic** (`node validation/score.mjs`) — 14 planted-bug cases incl. 5
  security classes.
- **Real-world** (`node validation/real-world/score.mjs`) — 8 bugs that actually
  shipped in MIT libraries (pluralize, currency.js, parse-ms, vercel/ms,
  semver-regex, strip-json-comments, compare-versions, word-wrap) and were later
  fixed.

**Combined: 20/20 catchable bugs detected, 0 false positives, 0 contamination.**
Full method, the honest miss, and threats to validity: `validation/README.md`,
`validation/FINDINGS.md`. Publication is gated by `RELEASE-GATE.md` (an independent
auditor must re-run every check and mark it READY).

## Honest limitations

- **LLM-based, not a theorem prover.** Detection is probabilistic and shares the
  spec as a single point of failure with the code; mitigated by oracle-free checks,
  not eliminated. Keep a human in the loop on P0 paths.
- **Framework pack is TypeScript/Vitest only** in v0.1; Python/Hypothesis & Java/jqwik
  are designed for, not yet built.
- The ReDoS detection is **timing-based** (environment-dependent); runtime/E2E is
  demonstrated but has no planted-bug case yet; concurrency and integer-overflow
  lenses are future work.

## Layout

```
verif-kit/
  agents/verification-engineer.md   # the blind, project-agnostic verifier
  skills/verif-kit/SKILL.md         # plan-gate-then-execute orchestrator (+ resume)
  templates/                        # contract · vplan · verification-tasks · report
  framework/typescript/             # scoreboard + coverage-model (language pack v1)
  scripts/{powershell,bash}/        # path resolution + "where are we?" oracle
  install.mjs · install.md          # copy-the-engine installer + integrity manifest
  docs/                             # methodology + design notes
  validation/                       # the bug-injection evidence (not installed)
  RELEASE-GATE.md                   # the binding publish gate
```

## License

MIT — see [LICENSE](LICENSE).
