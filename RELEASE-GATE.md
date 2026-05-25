# Verif-Kit release gate (binding)

This is the gate that decides whether Verif-Kit may be published. It exists because
an earlier "overseer" had no teeth: it flagged gaps and then those gaps were
quietly relabelled "future work" and shipped anyway. This file removes that
escape hatch.

## The binding rule

1. The verdict is **READY** only if **every MUST item below passes against real,
   re-run evidence** — not against a claim written in a doc.
2. **No MUST item may be downgraded to "future work," "nice to have," or "v2" in
   order to pass.** If a MUST fails, the verdict is **BLOCKED**, full stop.
3. The only way a failing MUST item can be set aside is a **written human waiver**
   recorded in the "Human waivers" section at the bottom, dated and signed by the
   project owner. The author/agent may **not** self-waive.
4. "Accepted limits" (the list further down) are allowed **only** if they remain
   honestly **disclosed** in the published docs. Hiding a limit flips it to a FAIL.

## MUST items (all must PASS)

| # | Requirement | How to verify (re-run, don't trust docs) | Pass criteria |
|---|-------------|------------------------------------------|---------------|
| M1 | Bug detection is proven & reproducible (synthetic) | `node validation/score.mjs` | Exits 0; ≥13 catchable detected; 0 false positives; 0 contamination |
| M2 | Real-world validation against bugs that actually shipped | `node validation/real-world/score.mjs` | Exits 0; ≥7 catchable detected; 0 false positives; 0 contamination |
| M3 | Real-world cases are genuinely real | open ≥3 `validation/real-world/oracle/*/meta.json` | Each has a real `fixCommitUrl` to a real repo + a permissive license recorded |
| M4 | Security tested broadly (not one case) | count security cases in `validation/cases/` + real-world | ≥5 distinct security classes present and detected (auth bypass, privilege escalation, injection, secret leak, IDOR) |
| M5 | No false alarms anywhere | both scorer runs above | Both report `false positives: 0` |
| M6 | Independence is real | inspect a scorer + a `ve.test.ts` | A contamination check exists and passes; verifier tests import only the public API, never `oracle/`/`buggy`/`correct` |
| M7 | Honest reporting (no overclaim) | grep docs for "100%", "guarantee" | No claim of 100%/guaranteed detection; honest-limits section present in README + validation/README |
| M8 | Zero personal / private data | privacy grep over `verif-kit/` for the owner's name, email, machine paths, the money project, bank names | **Zero** matches |
| M9 | One-command install works | run `node install.mjs` in a throwaway temp dir | Exits 0; installs agent+skill+templates; does NOT copy `validation/` into the target |
| M10 | Standard, publishable repo | list `verif-kit/` top level | README, LICENSE, CONTRIBUTING.md, CHANGELOG.md, .gitignore, package.json all present |
| M11 | Proof vs tool is unmistakable | read `validation/README.md` | States plainly that validation/ is evidence, not the installed tool |

## Accepted limits (disclosed, NOT blockers — but they MUST stay disclosed)

These are known gaps the owner has accepted for v0.1, on the condition they remain
written down honestly in the published docs:

- The ReDoS detection is **timing-based** (environment-dependent), not a functional guarantee.
- There is **no planted-bug end-to-end (browser) case** yet — the E2E lens is demonstrated, not bug-validated.
- **Multi-engine / WebKit (iOS Safari) E2E** is wired via `commands.e2eEngines` but not yet validated by a planted Safari-only bug.
- Only a **TypeScript/Vitest** framework pack ships; other languages are designed-for, not built.
- Default independence is **prompt + audit + contamination check**, not a hard OS sandbox (separate-session mode is stronger).
- Single model family; shared-spec blind spots are reduced, not eliminated.

If any of these stops being disclosed in the docs, the relevant MUST item (M7) FAILS.

## Verdict log

_The independent auditor records each run here: date, per-item PASS/FAIL with the
evidence it saw, and the binary verdict (READY / BLOCKED)._

### 2026-05-24 — independent re-run audit (fresh-context auditor)

Every MUST item was re-verified by running the named command or opening the named
file. No doc claims were trusted.

| # | Result | Evidence I actually saw |
|---|--------|-------------------------|
| M1 | PASS | Ran `node validation/score.mjs` myself → exit 0. Table: 13/13 catchable detected, 1/1 honest miss (06-dedupe O(n²)) held out, 0 false positives, 0 contaminated. "STUDY RESULT: ✅". |
| M2 | PASS | Ran `node validation/real-world/score.mjs` myself → exit 0. 7/7 catchable detected, ReDoS case surprise-caught, 0 false positives, 0 contaminated. "STUDY RESULT: ✅". |
| M3 | PASS | Opened 4 real-world `oracle/*/meta.json` (pluralize, currency.js, semver-regex, word-wrap, parse-ms). Each has a real github.com `fixCommitUrl` + recorded MIT license. WebFetched 2 commit URLs (scurker/currency.js …458030 "Fix distribution with -0.01 (#99)"; sindresorhus/semver-regex …2d4a "Fix some false positive matches (#23)") — both real, content matches the bug summary. |
| M4 | PASS | 5 distinct security classes present and all `expectDetection:true` and all detected (rows ✅ in M1 run): 08 IDOR/horizontal access control, 11 auth bypass, 12 vertical privilege escalation, 13 SQL injection, 14 secret leak. |
| M5 | PASS | Both scorer runs above printed `false positives: 0`. |
| M6 | PASS | Both `score.mjs` files contain a real contamination check (parses imports, flags any `oracle\|buggy\|correct\|impl`). Grepped imports of all 22 `ve.test.ts`: every one imports only `./sut` + `vitest`/`fast-check`/`node:crypto`. Read `08-access-control/ve.test.ts` — builds its own independent reference model from spec, imports `./sut` only. `sut.ts` is an auto-managed re-export shim. |
| M7 | PASS | Grep for `100%`/`guarantee(d)` found only anti-overclaim usages (e.g. "a flawless 100% would be *less* credible", "Never claim 100% / finds every bug") and coverage-closure metric, never a bug-detection overclaim. Honest-limits sections present in `README.md` (lines 21-31, 158-171) and `validation/README.md` (lines 56-63). All 5 accepted limits remain disclosed in the docs. |
| M8 | PASS | Grep tool + an independent Node scan of 181 files (excluding node_modules/.git) for Hemanth, chitti, tnvmu, OneDrive, "money management/tool/tracker", budget-window, and `C:\Users\tnvmu` → **0 matches**. LICENSE copyright is "Verif-Kit contributors" (no personal name). MIT author names in real-world cases are required attribution, not a leak. |
| M9 | PASS | Ran `node install.mjs` from a fresh `mktemp -d` dir → exit 0. Created `.claude/agents/verification-engineer.md`, `.claude/skills/verif-kit/SKILL.md`, `.verif-kit/{framework,scripts,templates}`, `verif-kit.config.json`. `validation/` was NOT copied (ls of target/validation → No such file or directory). Temp dir deleted afterward. |
| M10 | PASS | `verif-kit/` top level has README.md (9458B), LICENSE (real MIT, 1077B), CONTRIBUTING.md (1918B), CHANGELOG.md (2803B), .gitignore (221B), package.json (1212B) — all present and non-trivial. |
| M11 | PASS | `validation/README.md` line 1: "Verif-Kit validation — the evidence (this is PROOF, not the tool)"; lines 3-13 state plainly it is "not part of the tool" and "never installed into your project". Confirmed empirically by M9 (installer does not copy it). |

**VERDICT: READY**

Auditor note (non-blocking, for the owner's awareness — NOT a MUST failure): the
`README.md` "Honest status (v0.1)" block (lines 149-170) still describes a "10-case
… study (9/9 catchable detected)" and says the security lens is "validated only for
IDOR" / auth-bypass+priv-esc+injection+secret-leak are "NOT yet exercised by a
planted bug." The current studies are 14 + 8 = 22 cases with all 5 security classes
planted and detected, so the README *understates* present capability in those
spots. Understatement is not an overclaim and does not fail M7, but the stale
numbers are internally inconsistent with the live scorers and `validation/README.md`
— worth reconciling before publishing.

## Human waivers

_Empty. Only the project owner may add a waiver here to set aside a failing MUST
item, with date + reason. The author/agent must not write here._
