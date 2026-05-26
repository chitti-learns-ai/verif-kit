# Calibration study — why Verif-Kit went staged (real-project evidence)

> Verif-Kit's **right-sized staged gate** (methodology §9) is not a guess. It comes
> from instrumenting a real, sustained use of the *previous* (always-full-environment)
> version on an offline-first personal-finance app, then asking the architect's
> question: *did the expensive machinery earn its cost?* It did not. This is that data.

## The run

Eleven non-trivial logic modules (money math, parsers, matchers, attribution engines,
sync) each went through the full PLAN→EXECUTE flow: independent fresh-context verifier,
implementation-free contract, reference model + scoreboard + constrained-random stimulus
+ functional-coverage closure + mutation/fault-injection. **~10 hours of verification
against ~1 hour of design — a 10× ratio.**

| Modules verified | Promoted tests | Functional coverage | Mutation range | **Real code bugs found** |
|---|---|---|---|---|
| 11 | ~452 | 100% on all 11 | 71%–100% | **4** |

Seven of the eleven modules (64%) found **zero** code bugs from the full heavy run.

## The decisive finding — which technique caught each bug

| Bug | Severity | Caught by | Cost of that technique |
|-----|----------|-----------|------------------------|
| Same-day ordering depended on import order (price-trend module) | real | metamorphic *permutation* relation — surfaced by reading the spec in the PLAN stage | minutes |
| Same-day attribution flipped with import order (FIFO engine) | P0 | metamorphic *permutation* relation — PLAN stage | minutes |
| Identity-key collision merged two distinct entities | P0 (latent) | *adversarial injectivity* probe (~a dozen crafted strings) | minutes |
| Matcher guessed instead of staying silent on ambiguous input | P0 | *one directed ambiguity* test (two equal candidates) | minutes |

**All four bugs were found by cheap, directed, reasoning-driven techniques** —
independent spec re-reading plus a handful of boundary / metamorphic / adversarial
tests. **The expensive phase — thousands of constrained-random cases + mutation
testing — found zero new bugs.** It *confirmed* correctness on the clean modules and
*measured test-suite strength* (useful for regression), but it was not where defects
were discovered — and it was run at full volume on every module regardless of risk or
of whether the cheap stage had already drawn blood.

## The architect's conclusion (now the methodology)

- **Front-load the cheap, high-yield techniques** (independent spec reading +
  boundary/equivalence + metamorphic/conservation + hazard-class adversarial probes).
  This is **Stage 1**, and it is where bugs die.
- **Gate the expensive machinery** (reference-model scoreboard at volume, mutation,
  fuzz) behind **evidence or Critical risk** — **Stage 2**. Most modules never need it.
- **Mutation** is the most expensive, lowest-new-bug-yield lens; make it Stage-2-only,
  incremental, sampled, and a *regression-strength* metric — never a default gate.
- **Budget verification time at ≈ 1× design time.** Acceptable risk, not zero risk,
  per risk-based testing.

Applied retroactively: all 4 bugs are Stage-1 finds; only the 2–3 Critical money-truth
modules (two of which had blood) would have earned Stage 2 — an estimated **~70–80%
time reduction with the same bugs caught**. See `calibration-revalidation.md` for the
empirical re-run that tests this claim by re-catching the four bugs with Stage-1 alone.

## Sources
Risk-based testing (effort ∝ risk; acceptable-risk stopping): ISTQB / ISO 29119 and
practitioner guides. Mutation-testing cost/impracticality at scale and CI live-mutant
budgets: systematic literature reviews + industrial CI case studies. (Full URLs in the
host project's retrospective and in `docs/methodology.md` references.)
