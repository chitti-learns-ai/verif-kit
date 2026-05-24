# How Verif-Kit improves on Spec-Kit (and how they fit together)

Verif-Kit is modeled on GitHub's Spec-Kit and reuses its best mechanics, but it
exists to fill the gaps Spec-Kit deliberately leaves. They are **complementary,
not competing**: Spec-Kit answers *"did we build what we wrote down?"*; Verif-Kit
answers *"is what we built actually correct — judged independently?"*

## What Verif-Kit borrows from Spec-Kit (don't reinvent the good parts)

- **Persisted, ticking, on-disk checklists** (`- [ ]`→`- [x]`) that survive
  context compaction — Verif-Kit's `*.vplan.md` (cover points) and
  `*.verification-tasks.md` (orchestration phases) use the exact same grammar.
- **Genericity via templates + path-resolving scripts + slash-commands** — prompts
  never hard-code paths; a `vk-check-prerequisites` script is the "where-are-we?"
  JSON oracle, and `verif-kit.config.json` holds every project specific (like
  Spec-Kit's `init-options.json`).
- **A copy-the-engine installer + a file-hash manifest** — `install.mjs` →
  `.claude/` + `.verif-kit/` + a `verif-kit.json` with per-file SHA-256s.
- **The template-override precedent** and the **`## Phase Z`** extension point.

## Where Spec-Kit is weak — and Verif-Kit's answer

| Spec-Kit gap | Verif-Kit answer |
|---|---|
| **Design and check share one context** (`/speckit-implement` writes code and, optionally, its tests off the same spec reading) → the oracle problem; a misread spec yields green-but-wrong | **Two-context independence**: a fresh `verification-engineer` that **never reads the source** (NASA IV&V technical independence) |
| **Tests are OPTIONAL and author-written** ("only include them if explicitly requested") | Verification is the *deliverable*: the verifier *architects an environment* (generator → independent reference model → scoreboard → assertions → coverage) |
| **No coverage or mutation gating** — `tasks.md` can be 100% `[x]` with zero real verification | **Functional-coverage closure gate** + **mutation / fault-injection sign-off** (incl. reference-model self-mutation: "prove the bench can fail") |
| **No oracle independence** | Metamorphic relations, hand-derived goldens, conservation invariants, real data — with an explicit Knight & Leveson "honest residual" |
| **`/speckit-analyze` is structural only** (maps tasks↔requirements by keyword) | A **behavioral scoreboard** that runs stimulus and judges DUT vs an independent model — it can tell you a *calculation* is wrong |
| **No security lens** | **Cyber-engineer lens** (OWASP A01: IDOR / auth bypass / privilege escalation / injection / secret leakage) — empirically catches a planted IDOR in the validation suite |
| **No runtime/E2E lens** | **Runtime lens** (Playwright/MCP) — boots the real app and drives the critical path |
| **No conservation reasoning** | Mandatory **conservation/balance invariant** for value-moving modules |
| **Ships no evidence it works** | **Reproducible bug-injection study** (`evidence/`): real detection + false-positive numbers, including honest misses |

## How they integrate (two seams, different cadence)

1. **`after_implement` hook** (per-increment nudge) — add `verif-kit.verify` under
   `hooks.after_implement` in `.specify/extensions.yml`; Spec-Kit's existing hook
   scanner surfaces `/verif-kit-verify` at the end of `/speckit-implement` with
   **zero changes to Spec-Kit core**.
2. **`## Phase Z` task** (feature-completion gate) — a `/verif-kit-verify` task in
   `tasks.md`, ticked like any other, mandatory for P0/P1.

The highest-value loop: **spec ambiguity discovered by verification flows back
into `spec.md`** — Verif-Kit makes Spec-Kit's specs *better* by stress-testing
them, and the human (the only one allowed to resolve a spec ambiguity) patches
the Spec-Kit-owned file.

## The one honest caveat

Verif-Kit is an LLM-driven verifier, not a theorem prover. It shares the residual
shared-spec blind spot with the author (Knight & Leveson), mitigated by
oracle-free checks but not eliminated, and it escalates genuine ambiguity to the
human. It measures and reports its real detection rate — it never claims to find
every bug. That honesty is itself a feature: a tool that claims perfection can't
be trusted about its limits.
