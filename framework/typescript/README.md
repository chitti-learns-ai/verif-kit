# Verif-Kit framework — TypeScript pack (v1)

Two small, dependency-free helpers the verifier wires into its environment.
Designed to be used with **Vitest** + **fast-check**, but they are plain TS and
work with any runner.

- **`Scoreboard<I,O>`** — differential checker: runs each input through the DUT
  and the verifier's independent reference model, records mismatches, and gates
  sign-off via `assertClean()`. Default equality is deep + bigint-aware; pass
  `eq` for float tolerance or order-insensitive collections.
- **`CoverageModel`** — functional-coverage tracker: declare the cover points the
  plan requires, `cover()` them during stimulus, and gate sign-off via
  `assertClosed()`. Reflect each closed bin back into the on-disk `*.vplan.md`
  checkbox so an interrupted run resumes.

## Wiring (sketch)

```ts
import { Scoreboard } from 'verif-kit/framework/typescript/scoreboard';
import { CoverageModel } from 'verif-kit/framework/typescript/coverage-model';
import * as fc from 'fast-check';
import { fnUnderTest } from '<dut public api>'; // the DUT — interface only

const model = (i: In): Out => {/* independent from-spec reimplementation */};
const sb = new Scoreboard({ dut: fnUnderTest, model });
const cov = new CoverageModel(['empty', 'single', 'boundary-min', 'boundary-max', 'year-wrap']);

fc.assert(fc.property(arbInput, (i) => {
  sb.check(i);
  cov.coverIf(i.length === 0, 'empty');
  // … cover the other bins …
}));

sb.assertClean();      // DUT agreed with the independent model on every input
cov.assertClosed();    // every planned scenario was exercised
```

## Other language packs (planned)

`framework/python/` (Hypothesis) and `framework/java/` (jqwik) mirror this API —
a `Scoreboard` (differential vs reference model) and a `CoverageModel` (functional
closure). The methodology is language-independent; only the property/runner
bindings change.
