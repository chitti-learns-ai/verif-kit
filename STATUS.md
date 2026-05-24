# Verif-Kit — build status (autonomous overnight build, started 2026-05-23)

**Vision.** A portable, publishable verification tool — "spec-kit, but for
verification." Drop it into ANY project (a calculator, a shopping site, a mobile
app backend, a library) and it gives you an **independent, coverage-driven
verification environment** authored by a fresh-context AI agent that **never sees
your implementation** — only your spec. It surfaces spec ambiguities for you to
resolve, then builds a reference model + scoreboard + property/metamorphic/fuzz
tests, drives functional-coverage closure, and signs off (or reports real bugs).

Differentiator vs. existing tools (qodo-cover, ai-testing-agent, etc., none
dominant): **independence (blind to source) + coverage-driven sign-off +
bug-injection-validated**. We prove it catches bugs, with numbers.

## Planned package layout (project-agnostic)

```
verif-kit/
  README.md                     # what/why/install/use, with the validation evidence
  agents/verification-engineer.md   # generalized, project-agnostic (no money-domain assumptions)
  skills/verify/SKILL.md            # generalized orchestrator (plan-gate-then-execute)
  templates/verification-contract-template.md
  templates/vplan-template.md
  framework/                    # language packs; v1 = TypeScript (scoreboard.ts, coverage-model.ts)
  install.mjs / install.md      # one cross-platform installer: copies agent+skill+templates into a target repo's .claude/
  docs/methodology.md           # IV&V (SWE-141), CDV (Doulos), Knight&Leveson, SQLite, Jepsen, bug-injection validation
  evidence/                     # the validation-study results (detection rate, false-positive rate)
```

## Status checklist — v0.1 COMPLETE (independently reviewed)

- [x] Research existing tools, bug benchmarks, books, methodologies
- [x] Bug-injection validation: **two studies, 22 cases** — synthetic (14, in `validation/`) + real-world (8 shipped-and-fixed bugs from MIT libraries, in `validation/real-world/`)
- [x] Blind VE scored: **20/20 catchable detected · 1 honest miss held out · 0 false positives · 0 contamination** (`node validation/score.mjs` and `node validation/real-world/score.mjs` → ✅)
- [x] Generalized, config-driven agent + verif-kit-verify SKILL (no host-project assumptions)
- [x] WebSearch/WebFetch on the VE (domain edge-case research; implementation off-limits)
- [x] Cross-platform scripts + installer (smoke-tested) + manifest + README + methodology + better-than-speckit docs
- [x] Security lens validated by **5 planted bugs** — IDOR (OWASP A01), auth bypass, vertical privilege escalation, SQL injection, secret leakage; runtime/E2E lens demonstrated by a real Playwright run
- [x] Spec-kit integration dogfooded (after_implement hook → /ivv)
- [x] **Final overseer review: VERDICT = SHIP-WORTHY (v0.1, with stated limits).** Overseer re-ran the study cold and confirmed it reproduces; flagged doc-number drift (fixed), framework-pack-not-self-used (documented gap), and remaining future work below.

### Future work (overseer should-fix / nice-to-have, not blocking v0.1)
- [ ] Port 2–3 validation cases to consume the shipped `framework/` Scoreboard/CoverageModel (validate the reusable pack itself)
- [ ] Add a concurrency/async-race case (likely a 2nd honest miss — high signal) + integer-overflow + idempotency
- [ ] Land a planted-bug case for the rest of the security lens (auth-bypass / privilege-escalation) and a planted-bug E2E case
- [ ] Real-GitHub-bug reconstruction study (external validity)
- [ ] Default to separate-session independence for evidence-grade runs (in-session is prompt-enforced, not sandboxed)

## Honest constraints (no overselling)

- The agent is an LLM; it is not a theorem prover. Detection is probabilistic and
  shares blind spots with same-spec authors (Knight & Leveson). We measure and
  report the real rate rather than claim "100% bug detection."
- v1 framework is TypeScript/Vitest. Other languages need framework packs
  (Python/Hypothesis, Java/jqwik) — designed for, not yet built.
