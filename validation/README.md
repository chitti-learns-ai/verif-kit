# Verif-Kit validation — the evidence (this is PROOF, not the tool)

**Read this first.** Everything in this folder is Verif-Kit's *evidence that the
tool works* — a reproducible bug-detection study. It is **not part of the tool**
and it is **never installed into your project**. When you install Verif-Kit, the
installer copies only the verifier agent, skill, templates, framework, and
scripts; it does **not** copy this folder. These cases live in the repo for one
reason: so anyone can re-run them and confirm Verif-Kit catches bugs, instead of
taking our word for it.

> The tool = the blind verifier (agent + skill + templates + framework).
> This folder = the proof that the blind verifier actually finds bugs.

## Two studies

### 1. Synthetic planted-bug study — `./` (14 cases)
Bugs we designed across many domains, each with a hidden defect and a correct
control. Includes **5 security cases**: IDOR, authentication bypass, vertical
privilege escalation, SQL injection, secret leakage.

```bash
node validation/score.mjs
```
→ **13/13 catchable bugs detected · 1/1 honest miss held out (an O(n²) perf bug) · 0 false positives · 0 contamination.**

### 2. Real-world study — `./real-world/` (8 cases)
Bugs that **actually shipped in famous MIT npm libraries and were later fixed**
(pluralize, currency.js, parse-ms, vercel/ms, semver-regex, strip-json-comments,
compare-versions, word-wrap). See `real-world/README.md` for sources + licenses.

```bash
node validation/real-world/score.mjs
```
→ **7/7 catchable bugs detected · the 1 ReDoS case surprise-caught via a timing probe · 0 false positives · 0 contamination.**

## Combined: 20/20 catchable bugs detected, 0 false positives, 0 contamination (22 cases)

## Why this is credible (not theater)

The scorer is an honest referee: it runs every case against **both** the buggy and
the correct code, so a test that fails on correct code (a false alarm) is caught,
not hidden. Along the way it caught real problems — and we fixed them on the record:

- **Verifier over-reach** — unsound checks that failed on correct code (e.g. a SQL
  test tripped by a literal `?`); the scorer flagged them, a fresh verifier made
  them sound.
- **A bug in our own reference control** — the blind verifier's `role:"valueOf"`
  probe exposed a prototype-pollution flaw we hadn't intended; we fixed it.
- **A genuine residual bug in a shipped library** — the verifier found that
  parse-ms's *official upstream fix is incomplete* (still corrupts sub-millisecond
  fields above ~9e12). A real-world discovery.

A flawless first-try 100% would be *less* trustworthy than this audited
self-correction.

## Honest limits
- The ReDoS catch (real-world #08) is **timing-based** — robust here, but timing
  detection is environment-dependent, not a functional guarantee.
- Single model family; shared-spec blind spots are reduced (oracle-free /
  metamorphic / hand-computed checks) but not eliminated.
- Independence in the default mode is enforced by prompt + a file-read audit + a
  contamination check on the test file — not a hard sandbox. Use separate-session
  mode for evidence-grade independence.

## How to re-run everything
```bash
npm install            # gets vitest + fast-check
node validation/score.mjs              # synthetic study (14 cases)
node validation/real-world/score.mjs   # real-world study (8 cases)
```
Each writes a `results.json` and exits non-zero if any case fails to match its
recorded ground truth.
