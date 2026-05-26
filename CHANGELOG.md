# Changelog

All notable changes to Verif-Kit are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/); versioning is [SemVer](https://semver.org/).

## [Unreleased]

### Changed — RIGHT-SIZED STAGED GATE (the headline: stop the 10× over-testing)
- **Verification depth is now earned by risk + evidence, not spent by default.**
  Replaced "PLAN then always build the full environment" with a structural staged
  gate: **Triage → Stage 1 (cheap independent plan + targeted boundary/metamorphic/
  adversarial probes — the bug-finding stage, always run for non-chrome tiers) →
  Stage-1 gate → Stage 2 (reference model + scoreboard + bounded random + sampled
  mutation) ONLY when a real bug was found, the tier is Critical with an unpinnable
  state space, or sign-off-grade depth is explicitly requested.** A Stage-1 sign-off
  is a real sign-off.
- **Hard time budget:** total verification time targets **≈ 1× the module's design
  time**, never 10×. Mutation is now **Stage-2-only, incremental, sampled** (it
  measures regression-suite strength, not product bugs) and never gates Core/Supporting
  modules. New `staging` block + per-tier `defaultStage` in `verif-kit.config.json`.
- **Why (evidence-based, not a guess):** on a real 11-module calibration (the
  money_management_tool study, `validation/calibration-money-tracker.md`), every one
  of the 4 real bugs was caught by cheap Stage-1 techniques; the heavy constrained-
  random + mutation phase found **zero new bugs** while consuming ~10× the design
  time. Grounded in risk-based testing (effort ∝ risk; test to *acceptable* risk) and
  the documented impracticality of exhaustive mutation testing. Updated `docs/methodology.md`
  (§9 Proportionality), the agent charter (§"Right-sized execution"), and the `/verif-kit`
  skill (Phase 4 staged gate; tier-scaled sign-off bar).

### Added
- **Multi-engine E2E** (`commands.e2eEngines`) — run the critical path on each listed
  browser engine; include `webkit` to approximate iOS Safari (catches Safari-only
  quirks). Wired but **not yet validated by a planted Safari-only bug**.

### Changed
- Renamed the command `/verif-kit-verify` → **`/verif-kit`** (single-purpose tool;
  dropped the redundant verb).
- The verifier now **announces which spec it is verifying against**, and **asks** the
  user when it can't confidently find one — never assumes.

### Fixed
- Enforce **LF line endings** (`.gitattributes`): a CRLF clone on Windows broke the
  agent's `---` frontmatter delimiter, so the verification-engineer agent failed to
  register. Install docs now state the mandatory full Claude Code restart.

## [0.1.0] — 2026-05-24

First public release. An independent, coverage-driven AI verification tool: a
blind, fresh-context agent verifies your code from the spec alone.

### Added
- **Blind verification-engineer agent** (`agents/`) — never reads the
  implementation; builds an independent reference model + scoreboard + property/
  metamorphic checks, drives functional-coverage closure, and signs off via
  mutation/fault-injection. Plan-gate-then-execute. Right-sizes effort to module
  complexity/risk.
- **`/verif-kit` orchestrator skill** (`skills/`) — runs the flow, resumes
  from on-disk ticking checklists, shows live progress, emits a human-readable
  report (verdict + block diagram + "tested/found" tables + plain-English bottom line).
- **Lenses:** functional/boundary/equivalence/property/metamorphic, conservation/
  balance (money & value-moving code), fuzz, **security (OWASP A01 — IDOR/access
  control)**, **runtime/E2E (Playwright)**, mutation/fault-injection. Optional
  online domain research (never the implementation).
- **Ticking, compaction-surviving templates** (`templates/`): verification
  contract, vplan (cover points), verification-tasks (orchestration), report.
- **TypeScript framework pack** (`framework/typescript/`): `Scoreboard` + `CoverageModel`.
- **Cross-platform scripts** (`scripts/{powershell,bash}/`): path resolver,
  "where-are-we?" prerequisites oracle, setup.
- **Installer** (`install.mjs`) + per-project `verif-kit.config.json` + file-hash manifest.
- **Spec-kit integration**: `after_implement` hook + Phase Z task (zero changes to spec-kit core).
- **Validation evidence** (`validation/`): a reproducible bug-injection study —
  10 cases / 9 domains, 9/9 catchable bugs detected, 1/1 honest miss held out,
  0 false positives, 0 contamination (`node validation/score.mjs`).
- **Docs** (`docs/`): methodology (IV&V/SWE-141, CDV, Knight & Leveson, SQLite,
  Jepsen, OWASP), the better-than-spec-kit comparison.

### Known limitations (v0.1)
- LLM-based, not a theorem prover; shares the spec as a single point of failure
  with the code (mitigated by oracle-free checks, not eliminated). Keep a human in
  the loop on P0 paths.
- Framework pack is TypeScript/Vitest only (Python/Hypothesis & Java/jqwik planned).
- Security validated for IDOR; runtime/E2E demonstrated but not yet a planted-bug
  case; concurrency, integer-overflow, multi-file modules, and a real-GitHub-bug
  study are future work.
- In the default in-session mode, independence is prompt-enforced + import-audited,
  not sandboxed; use separate-session mode for evidence-grade runs.
