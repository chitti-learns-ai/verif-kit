# Verif-Kit — independent, coverage-driven verification for any project

> **Spec-kit tells you "did we build what we wrote down?"  Verif-Kit tells you
> "is what we built actually correct — judged independently?"**

Verif-Kit is a portable, AI-driven verification tool you drop into any repository.
A fresh-context agent that **never sees your implementation** reads only your
spec, **intelligently designs test cases**, builds a **coverage-driven,
self-checking verification environment** (independent reference model +
scoreboard + property/metamorphic/fuzz/security/runtime checks), drives it to
**functional-coverage closure**, proves the tests can actually fail
(**mutation/fault-injection**), and either **signs off** or reports precise,
reproducible discrepancies — escalating genuine spec ambiguities to you.

It is modeled on GitHub's **Spec-Kit** (same persisted, ticking, compaction-
surviving on-disk checklists; same install-into-any-repo structure) but fills the
gaps Spec-Kit deliberately leaves: independence, coverage/mutation gating,
security, and runtime checks — and unlike Spec-Kit, **it ships evidence that it
works.**

## Why it's different (and honest about limits)

Most AI test tools write tests *for the code they can see* — which bakes the
implementation's bugs in as "expected." Verif-Kit's verifier is **blind to the
source by construction** (NASA IV&V "technical independence"), so it can't inherit
the author's blind spots. It leans on **oracle-independent** checks (metamorphic
relations, hand-derived golden values, conservation invariants) to mitigate the
one residual risk — that the verifier and the code share the same spec
(Knight & Leveson: same-spec workers make *correlated* errors). It does **not**
claim to find every bug; it measures and reports its real rate, including what it
cannot catch.

## Evidence (not "trust me")

Verif-Kit ships its proof: two reproducible bug-detection studies under
`validation/` (which is **evidence, not part of the installed tool** — it is never
copied into your project). Re-run them yourself:

**1. Synthetic study — 14 cases** (`node validation/score.mjs`): designed bugs
across many domains, each with a correct control. Includes **5 security cases** —
IDOR, authentication bypass, vertical privilege escalation, SQL injection, secret
leakage. → **13/13 catchable detected · 1/1 honest miss held out** (an O(n²) perf
bug functional verification *cannot* see) **· 0 false positives · 0 contamination.**

**2. Real-world study — 8 cases** (`node validation/real-world/score.mjs`): bugs
that **actually shipped in famous MIT libraries and were later fixed** (pluralize,
currency.js, parse-ms, vercel/ms, semver-regex, strip-json-comments,
compare-versions, word-wrap ReDoS). → **7/7 catchable detected · 0 false
positives · 0 contamination** (the ReDoS case was surprise-caught via a timing probe).

**Combined: 20/20 catchable bugs detected, 0 false positives, across 22 cases.**

The reproducible scorer is an honest referee — it runs every case against the
buggy **and** the correct code, so a false alarm can't hide. It earned its keep:
it caught the verifier over-reaching (unsound checks that tripped on correct
code), it surfaced a **real bug in our own reference control** (a prototype-key
flaw the blind verifier's `valueOf` probe exposed), and the verifier even found a
**genuine residual bug in a shipped library** (parse-ms's official fix is still
incomplete above ~9e12). All found, fixed, and documented on the record — a
flawless first-try 100% would be *less* credible than this audited self-correction.

Independence is auditable: implementations and answer keys live in an `oracle/`
tree the verifier is never pointed at, and a contamination check fails the run if
a verifier test imports anything but the public API. (Honest caveat: that check
proves the *test file* doesn't import the implementation; in the default
in-session mode, "the agent didn't read the source while authoring" is enforced
by prompt + a self-reported file-read audit, not a hard sandbox — use the
separate-session mode for evidence-grade independence.)

## How it works (plan-gate-then-execute)

1. **Contract** — the author writes an *implementation-free* contract (WHAT + the
   interface, never HOW).
2. **PLAN pass (cheap)** — a fresh verifier reads the spec and **surfaces every
   ambiguity** before any expensive work; you resolve them (the spec gets better).
3. **EXECUTE pass (once)** — the verifier builds the full environment, drives
   coverage to closure, applies security + runtime lenses, and signs off via
   mutation.
4. **Promote** — accepted independent tests join your permanent suite forever.

State lives in **on-disk ticking checklists** (`*.vplan.md`,
`*.verification-tasks.md`) using Spec-Kit's exact `- [ ]`→`- [x]` convention, so a
compacted or interrupted run resumes by re-reading the file — ask "where are we?"
and the answer is on disk.

## Install (into any repo) — one command

From the root of the project you want to verify:

```bash
# Once Verif-Kit is on GitHub (no clone, no global install — like `specify init`/uvx):
npx github:<OWNER>/verif-kit

# …or, from a local checkout of this repo:
node /path/to/verif-kit/install.mjs
```

Either way the installer copies the command surface into `.claude/` (agent +
skill), the engine into `.verif-kit/` (templates + scripts + framework), and writes
a starter `verif-kit.config.json` (your test runner, paths, risk tiers,
security/runtime toggles) plus a `.verif-kit/verif-kit.json` integrity manifest. It
never overwrites an existing config. Then **edit `verif-kit.config.json`** for your
project and you're ready.

Use it:

```
/verif-kit <module>     # after you implement a non-trivial piece of logic
```

(`/verif-kit` is the generic command; in a repo that already wired the
in-repo flow it may be exposed as `/ivv`.) It integrates with Spec-Kit two ways —
a per-increment `after_implement` hook (nudge) and a feature-completion `Phase Z`
task (gate) — with zero changes to Spec-Kit core. See `install.md` for the hook snippet.

## What Verif-Kit verifies (lenses) — with honest validation status

Lenses auto-select by the module's risk tier in `verif-kit.config.json`. Marked by
how much the validation study actually exercises each:

- ✅ **validated by a planted bug** (study caught it): functional correctness
  (reference-model scoreboard) · boundary/equivalence/property/metamorphic ·
  conservation/balance (money & value-moving code) · fuzz + missing-error-path
  (parsers) · **security: IDOR / horizontal access control (OWASP A01)** · numerical
  soundness.
- ⚙️ **demonstrated mechanically** (run, not yet a planted-bug case): mutation /
  bench-has-teeth (per-case self-mutation), and the **runtime/E2E** lens (a real
  headless Playwright run booted a sample web app and passed its critical route).
- 📝 **specified but NOT yet exercised by a planted bug** (honest gap): the rest of
  the security lens (auth-bypass, privilege escalation, injection, secret
  leakage), a persisted fuzz seed corpus, and Jepsen-style history checking.

Treat 📝 lenses as design intent, not proven capability, until cases land for them.

## Layout

```
verif-kit/
  agents/verification-engineer.md     # the blind, project-agnostic verifier
  skills/verif-kit/SKILL.md      # plan-gate-then-execute orchestrator (+ resume)
  templates/                          # contract + vplan + verification-tasks (ticking checklists)
  framework/typescript/               # scoreboard + coverage-model (language pack v1)
  scripts/{powershell,bash}/          # path-resolution + "where-are-we?" prerequisites oracle
  install.{ps1,sh,md}                 # copy-the-engine installer + verif-kit.json manifest
  docs/                               # methodology + the spec-kit study/comparison
  evidence/                           # the bug-injection validation results
```

## Honest status (v0.1 — independently reviewed)

Verif-Kit v0.1 is complete and installable: blind agent, orchestrator, ticking
templates, portability config, framework pack, cross-platform scripts, installer
+ manifest, docs, and **two reproducible validation studies — 22 cases total**:
14 synthetic (13/13 catchable detected, 1/1 honest miss) + 8 real bugs that
actually shipped in famous MIT libraries (7/7 detected). **Combined: 20/20
catchable bugs detected, 0 false positives, 0 contamination.** Publication is
gated by `RELEASE-GATE.md`, which an independent fresh-context auditor must mark
**READY** by re-running every check — it cannot be bypassed by relabelling a gap
"future work."

**Known limitations (do not oversell):**
- **LLM-based, not a prover.** Detection is probabilistic; it shares the spec as a
  single point of failure with the code (Knight & Leveson), mitigated by
  oracle-free checks, not eliminated. Keep a human in the loop on P0 paths.
- **v1 framework pack is TypeScript/Vitest only**; Python/Hypothesis & Java/jqwik
  are designed for, not built.
- **The shipped `framework/` (Scoreboard/CoverageModel) is not yet used by the
  study's own cases** (each re-implements inline) — so the reusable pack itself is
  under-validated. Porting 2–3 cases onto it is the next hardening step.
- **Security is validated by 5 planted bugs** (IDOR, auth bypass, privilege
  escalation, SQL injection, secret leakage). Remaining gaps: the ReDoS detection
  is **timing-based** (environment-dependent); runtime/E2E is demonstrated but has
  **no planted-bug case**; concurrency and integer-overflow classes are future work.
See `RELEASE-GATE.md` for the binding publish gate, `STATUS.md` for the live ledger,
and `validation/FINDINGS.md` + `validation/real-world/README.md` for the full
honest write-ups + threats to validity.
