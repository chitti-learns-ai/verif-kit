---
name: verif-kit-verify
description: Verif-Kit's independent verification flow. Orchestrates a TWO-CONTEXT verification of a code module — the Designer (this session, which has the source) hands an implementation-free contract to a fresh verification-engineer subagent that NEVER sees the source. Plan-gate-then-execute: a cheap PLAN pass surfaces spec ambiguities for the human to resolve FIRST, then a one-shot EXECUTE pass builds a coverage-driven, self-checking environment (constrained-random stimulus → independent reference model + scoreboard → assertions → functional-coverage closure → security + runtime lenses → mutation sign-off). State persists in on-disk ticking checklists so a compacted/interrupted run resumes by re-reading them. Project-agnostic: all repo specifics come from verif-kit.config.json. Triggers on "/verif-kit-verify", "verify this independently", "run IV&V". Different from running an existing test suite — this WRITES an independent verification environment in a fresh context.
---

# Verif-Kit — independent verification orchestrator

You orchestrate a two-context, coverage-driven verification. Read this whole file,
then `verif-kit.config.json` at the repo root, then run the phases in order. The
flow is **plan-gate-then-execute**: clarify the spec BEFORE paying for the full
environment — finding ambiguities is cheap, proving correctness is expensive, so
never pay the expensive part twice.

## ⛔ HARD REQUIREMENT — the real agent, or stop

The independent verifier MUST be the **`verification-engineer`** subagent
(`agents/verification-engineer.md`). Custom agents register at session start. **If
the Agent tool reports it is unavailable, STOP** and ask the user to restart so it
loads — do NOT substitute a generic agent (a generic agent lacks the
coverage-driven, independence, and lens discipline and produces "basic
verification," which defeats the purpose). Launching a substitute is a protocol
violation.

## Roles

- **Designer** — THIS session; has the source; defends design intent; fixes confirmed bugs.
- **Verification Engineer (VE)** — the fresh `verification-engineer` subagent; never reads the source; builds the environment from the contract + spec.
- **Orchestrator** — THIS session, neutral hat: writes the contract, spawns the VE, relays the dialogue faithfully, ticks the on-disk checklists, writes the report.
- **Architect / Client** — the human. Sole authority on spec ambiguity.

## Read config first (portability)

Read `verif-kit.config.json`. Use its `commands` (verifyFast / runQuarantine /
fullVerify / mutation / e2e / pathPrefix), `paths` (verificationDir / contract /
vplan / verificationTasks / quarantineDir / independentTestsDir / corpusDir /
reportsDir), `riskTiers` (coverage/mutation floors + which lenses are required),
`security`, `onlineResearch`, and `independence`. Never hard-code a path or
toolchain location.

## Resume ("where are we?")

Before starting fresh, check for an in-progress run:
1. If `paths.verificationTasks` for this module exists, read it and resume at the first `- [ ]` VT line.
2. If a `*.vplan.md` exists with some cover points already `- [x]`, do NOT re-derive them — continue closing the open `[ ]` bins.
3. Reconstruct prior discrepancies from the latest `reports/ivv/*.md`.
State is on disk in the checklists; the model carries no cross-invocation memory.

## Phase 0 — Preconditions
Run `commands.verifyFast`; the module must be coherent before verification.

**Locate the spec — announce it, or ask. NEVER silently assume.** Find the
governing spec doc(s) for this module, then do exactly one of:
- **Found it →** print a clear, explicit message to the user naming what you will
  verify against, e.g.:
  `📄 Spec I'm verifying against: specs/checkout/spec.md (§3 Pricing). Verifying module: card-payment. Say so if that's wrong.`
  List every doc you'll use. State this BEFORE doing any verification work so the
  user can correct you.
- **Did NOT find it (or you're not confident) →** STOP and ASK the user: "I
  couldn't find a spec for `<module>` — point me to the file/folder, or tell me
  there's no written spec and I'll co-write a short contract of intended behavior
  with you first." Do not guess a spec, do not infer one silently, do not proceed
  on an assumed spec. No spec located = ask, every time.

Create/seed `verificationTasks` from `templates/verification-tasks-template.md` and tick VT001–VT002.

## Phase 1 — Handoff (contract)
Wearing the Designer hat, write an implementation-free contract from
`templates/verification-contract-template.md` to `paths.contract`: WHAT + the
interface, never HOW; quote exact signatures; fill requirements, invariants, edge
cases, out-of-scope, the error contract, and (if applicable) the security §9 /
runtime §10 expectations. If you can't describe a behavior without the algorithm,
it's underspecified — fix it now. Tick VT010.

## Phase 2 — PLAN pass (cheap)
Spawn the **`verification-engineer`** (MODE: PLAN). Give it ONLY: the contract
path, the spec paths, the quoted signatures, the `vplan` output path, and the
quarantine path it will later use. **Do NOT reference the implementation source.**
It writes the vplan (cover points via equivalence-partitioning + boundary-value +
property/metamorphic) and returns the **spec-ambiguity list**. Audit independence
(its "files I read" must contain no implementation body). Tick VT020–VT023.

## Phase 3 — PLAN GATE (resolve before executing)
For each ambiguity, wearing the Designer hat, classify: GENUINE-AMBIGUITY
(escalate) / VE-MISREAD (cite the spec; drop) / OUT-OF-SCOPE (cite; drop).
Escalate genuine ones to the human with a tight decision packet (exact quote,
Reading A/Designer, Reading B/VE, impact, recommended default) — use
AskUserQuestion when clean. Apply each decision to the contract/spec (and code if
behavior changes) BEFORE executing. If no ambiguities, proceed. Tick VT030–VT032.

## Phase 4 — EXECUTE pass (expensive; once)
Spawn a FRESH **`verification-engineer`** (MODE: EXECUTE) with the clarified
contract + vplan + quarantine path + `commands.runQuarantine` + the project's
lint/type rules (for promotability). It builds the environment (generator →
independent reference model → scoreboard → assertions → coverage model), drives
functional-coverage to closure (flipping each closed cover point `- [ ]`→`- [x]`
in the vplan on disk), applies the **security** lens (if `security.enabled` and
the module touches authz/authn/multi-user — OWASP A01: IDOR, auth bypass,
privilege escalation, injection, secret leakage) and the **runtime/E2E** lens (if
a running app, via `commands.e2e`), and at sign-off runs `commands.mutation` +
the reference-model self-mutation check. Capture its Sign-off Report; re-audit
independence. Tick VT040–VT045.

## Phase 5 — Triage discrepancies
Classify each CONFIRMED-BUG (fix code) / VE-MISREAD (cite spec) / SPEC-AMBIGUOUS
(re-gate to the human). Anti-sycophancy: the Designer doesn't blindly fix; the
VE's reasoning isn't overruled by confidence — only by a spec citation. No
`SendMessage` to a subagent → if a dispute needs the VE's rebuttal, re-spawn a
fresh VE with the single specific question (cheap), never a full rebuild. Never
weaken a check to force green. Tick VT050–VT052.

## Phase 6 — Promote
Move accepted independent tests from `paths.quarantineDir` →
`paths.independentTestsDir` (fixing relative-import depth), ensure they pass the
project's lint/format, and run `commands.fullVerify` green with them included.
Tick VT060–VT061.

## Phase 7 — Report
Write the dated report to `paths.reportsDir` **using `templates/report-template.md`**
and print it to the user. Lead with the VERDICT; show the ASCII environment
**block diagram**, the **"What I tested"** + **"What I found"** tables (key items
highlighted), coverage % + mutation score + bench-has-teeth, a short
**plain-English bottom line**, and the mandatory **honest residual** (shared-spec
blind spots, lenses not applied). Human voice — concise, never a robotic textbook
dump. Tick VT070–VT071.

## Show your work throughout (output + visibility matter most)
The user must always see what's happening, never opaque background churn:
- **Up front (after Phase 1–2):** present the verification PLAN — the ASCII block
  diagram of the environment + the cover-point list — so the designer sees what
  you'll test before you spend time on it.
- **As you go:** tick `verification-tasks.md` on disk AND announce each step as it
  finishes (`✓ PLAN — 12 cover points, 1 ambiguity`, `✓ scoreboard 300 cases clean`,
  `✓ coverage 100%`, `✓ mutation 92%`).
- **Right-size visibly:** state the effort chosen for this module and why — a
  trivial pure function gets a handful of cases in minutes (skip mutation/E2E); a
  P0 module gets the full environment. Match a human verification engineer's
  judgment; neither over- nor under-test.

## Cadence (proportionality)
Full `/verif-kit-verify` runs once per module when its logic is substantially
complete — not per micro-edit. A small post-sign-off fix re-runs the promoted
suite (`commands.fullVerify`); re-spawn the EXECUTE pass only if behavior/spec
materially changed. Mutation + E2E run only at the EXECUTE/sign-off pass. Skip
trivial/chrome modules.

## Independence: in-session subagent vs separate session
Default (`independence.mode: in-session-subagent`): a fresh VE subagent in this
session, source withheld by prompt + the read audit. For tiers listed in
`independence.escalateToSeparateSessionForTiers` (e.g. P0), run the VE as a
separate session whose only inputs are the on-disk contract + spec and whose only
outputs are the quarantine tests + report — those files are the entire interface,
so this is a config switch, not a rewrite. Never let the Designer also be the
verifier (no independence = the failure mode this flow exists to eliminate).

## Ground rules (never violate)
1. The VE is the real `verification-engineer` agent or the run does not happen.
2. The VE never sees the implementation; contamination voids the run.
3. Clarify spec ambiguity at the PLAN gate — before the expensive EXECUTE pass.
4. Never resolve a genuine spec ambiguity without the human.
5. Never weaken a check to force green; fix code or clarify spec.
6. A sign-off requires closed functional coverage AND a mutation score proving the bench can fail.
7. Always promote accepted tests; always persist progress in the on-disk checklists; always state the honest residual; never claim perfection.
