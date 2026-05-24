# Contributing to Verif-Kit

Thanks for your interest. Verif-Kit is small and principled — contributions should
preserve the principles that make it trustworthy.

## Non-negotiable principles

1. **Independence.** The verifier must never read the implementation under test —
   only the spec/contract. Anything that leaks the implementation into the
   verifier (or derives the "expected" answer from the code) defeats the tool.
2. **Honesty over flattery.** We report the real detection rate, document honest
   misses, and state residual blind spots. Never claim "100% / finds every bug."
3. **Oracle independence.** Prefer metamorphic relations, hand-derived goldens,
   and conservation invariants over a single shared oracle (Knight & Leveson).
4. **Right-size the effort.** Match verification depth to a module's complexity and
   risk — like a human verification engineer. Neither over- nor under-test.

## Ways to contribute

- **Add a validation case** (`validation/cases/<id>/`): a `spec.md` + `sut.ts`,
  with the implementations + answer key under `validation/oracle/<id>/`
  (`buggy.ts`, `correct.ts`, `meta.json`). Author ORIGINAL bugs (don't copy famous
  benchmark bugs — LLMs may have memorized them). Run `node validation/score.mjs`;
  it must stay green (or add an honest `expectDetection: false` miss, documented).
- **Add a language pack** (`framework/<lang>/`): mirror the TypeScript pack's
  `Scoreboard` (differential vs reference model) and `CoverageModel` (functional
  closure) for Python/Hypothesis, Java/jqwik, etc.
- **Improve a lens or the report format.** The output is a first-class deliverable;
  keep it human, table-driven, and honest.

## Ground rules

- No personal data or project-specific identifiers in committed files — Verif-Kit is
  domain-agnostic by design.
- Keep docs claims tied to reproducible evidence (`validation/`).
- Discuss larger changes in an issue first.
