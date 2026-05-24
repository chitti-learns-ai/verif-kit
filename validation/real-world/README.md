# Verif-Kit real-world validation study

This is the **external-validity** half of Verif-Kit's evidence: instead of bugs we
invented, these are **real bugs that actually shipped in popular open-source npm
libraries and were later fixed by their maintainers**. For each, we reconstruct
the function at the commit *just before* the fix (`oracle/<id>/buggy.ts`) and *at*
the fix (`oracle/<id>/correct.ts`), write a spec from the library's own docs, and
have a blind verifier (which never sees either implementation) try to catch it.

Run it (from the repo root, after `npm install`):

```bash
node validation/real-world/score.mjs
```

Result: **7/7 catchable bugs detected, the 1 ReDoS case surprise-caught via a
timing probe, 0 false positives, 0 contamination.** See `FINDINGS`/`BUILD-LOG.md`
and each `oracle/<id>/meta.json` for the exact fix commit and bug summary.

## Cases and sources

| id | library | license | real fix commit |
|----|---------|---------|-----------------|
| 01 | plurals/pluralize | MIT | regex over-capture in `-sis/-ses` |
| 02 | scurker/currency.js | MIT | `distribute()` sign/conservation bug |
| 03 | sindresorhus/parse-ms | MIT | overflow → NaN/Infinity in sub-ms fields |
| 04 | vercel/ms | MIT | negative-decimal regex quantifier |
| 05 | sindresorhus/semver-regex | MIT | lazy quantifier truncates prerelease/build |
| 06 | sindresorhus/strip-json-comments | MIT | backslash-run parity off-by-one |
| 07 | omichelsen/compare-versions | MIT | crash on short equal versions |
| 08 | jonschlinkert/word-wrap | MIT | ReDoS (CVE-2023-26115) — the honest perf case |

## Attribution & licensing

Each case reproduces a **small excerpt** of the named library's source for
verification-research purposes. Every library is **MIT-licensed**, and the full
license text for each is preserved alongside the excerpt at
`oracle/<id>/LICENSE-<lib>.txt`. All copyrights belong to their respective
authors. These excerpts are included solely to demonstrate and reproduce
Verif-Kit's bug-detection evidence; they are not a redistribution of the libraries.
