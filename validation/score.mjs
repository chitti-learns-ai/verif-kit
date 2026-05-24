// Verif-Kit validation-study scorer.
//
// One command, reproducible. For each case under cases/<id>/ that has a
// VE-authored ve.test.ts, it:
//   1. CONTAMINATION CHECK — parses ve.test.ts imports; the blind VE must import
//      only './sut' (+ test libs). Any import of oracle/buggy/correct/impl =
//      contaminated (independence violated) → case fails.
//   2. DETECTION RUN — points sut.ts at oracle/<id>/buggy, runs the suite.
//      A non-zero exit (some test failed) means the VE DETECTED the bug.
//   3. FALSE-POSITIVE RUN — points sut.ts at oracle/<id>/correct, runs again.
//      Any failure here is a false positive (the VE flagged correct code).
//   4. Compares against oracle/<id>/meta.json `expectDetection` (default true).
//      A case is OK iff: detected === expectDetection, no false positive, not contaminated.
//      → honest MISSES (expectDetection:false) are first-class and must NOT fail
//        the study; a case that was supposed to be missed but got "detected"
//        (or vice-versa) DOES fail — the harness must track ground truth.
//
// Writes results.json + a markdown table to stdout. Exit non-zero if any case
// does not match its ground truth.
//
// Run from the repo root (after `npm install`):  node validation/score.mjs
// Requires vitest + fast-check (declared in package.json devDependencies).

import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Resolve everything relative to THIS file so the scorer is location-independent.
const SELF = dirname(fileURLToPath(import.meta.url)); // .../validation
const CASES = join(SELF, 'cases');
const ORACLE = join(SELF, 'oracle');
const CONFIG = join(SELF, 'vitest.config.ts');

function sutContent(id, variant) {
  return (
    `// AUTO-MANAGED by score.mjs — points the SUT at the chosen oracle variant.\n` +
    `// The blind VE imports the public API by name (signatures live in spec.md) and\n` +
    `// must NOT read this file or anything under validation/oracle/.\n` +
    `export * from '../../oracle/${id}/${variant}';\n`
  );
}

function runVitest(filter) {
  // `npx vitest` resolves vitest from the nearest node_modules (walks up from
  // cwd), so this works both inside a host repo and in a standalone install.
  // root is pinned in the config, so `filter` is matched against discovered tests.
  const r = spawnSync('npx', ['vitest', 'run', filter, '--config', CONFIG], {
    cwd: SELF,
    shell: true,
    encoding: 'utf8'
  });
  return r.status === 0 ? 0 : 1; // 0 = all pass; 1 = some test failed / error
}

function importSpecifiers(src) {
  const specs = [];
  const re = /(?:from|import)\s+['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(src)) !== null) specs.push(m[1]);
  return specs;
}

const ids = readdirSync(CASES)
  .filter((d) => existsSync(join(CASES, d, 've.test.ts')))
  .sort();

const results = [];
let anyFail = false;

for (const id of ids) {
  const caseDir = join(CASES, id);
  const sutPath = join(caseDir, 'sut.ts');
  const filter = `cases/${id}/ve.test.ts`; // substring filter against the discovered test set
  const metaPath = join(ORACLE, id, 'meta.json');
  const meta = existsSync(metaPath) ? JSON.parse(readFileSync(metaPath, 'utf8')) : {};
  const expectDetection = meta.expectDetection !== false;

  // 1. Contamination check.
  const testSrc = readFileSync(join(caseDir, 've.test.ts'), 'utf8');
  const specs = importSpecifiers(testSrc);
  const contaminated = specs.some((s) => /(oracle|buggy|correct|impl)/i.test(s));

  // 2. Detection run (buggy).
  writeFileSync(sutPath, sutContent(id, 'buggy'));
  const buggyFail = runVitest(filter) !== 0;

  // 3. False-positive run (correct).
  writeFileSync(sutPath, sutContent(id, 'correct'));
  const correctFail = runVitest(filter) !== 0;

  // Restore default (buggy).
  writeFileSync(sutPath, sutContent(id, 'buggy'));

  const detected = buggyFail;
  const falsePositive = correctFail;
  // A case is OK when: no false positive, no contamination, and a CATCHABLE bug
  // (expectDetection:true) was actually detected. An honest MISS
  // (expectDetection:false) is OK regardless of detection — it exists to prove
  // the harness reports negatives. Catching an expected-miss is a logged SURPRISE
  // (bonus), never a failure.
  const surprise = !expectDetection && detected;
  const ok = (expectDetection ? detected : true) && !falsePositive && !contaminated;
  if (!ok) anyFail = true;

  results.push({
    id,
    domain: meta.domain ?? '?',
    bugClass: meta.bugClass ?? '?',
    expectDetection,
    detected,
    surprise,
    falsePositive,
    contaminated,
    ok
  });
}

writeFileSync(
  join(SELF, 'results.json'),
  JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2)
);

const detTrue = results.filter((r) => r.expectDetection);
const detected = detTrue.filter((r) => r.detected).length;
const misses = results.filter((r) => !r.expectDetection);
const missesHeldOut = misses.filter((r) => !r.detected).length;
const surprises = results.filter((r) => r.surprise).length;
const fps = results.filter((r) => r.falsePositive).length;
const contam = results.filter((r) => r.contaminated).length;

console.log('\n| # | domain | bug class | expect | detected | false-pos | contaminated | OK |');
console.log('|---|--------|-----------|--------|----------|-----------|--------------|----|');
for (const r of results) {
  console.log(
    `| ${r.id} | ${r.domain} | ${r.bugClass} | ${r.expectDetection ? 'detect' : 'MISS(honest)'} | ${r.detected ? 'yes' : 'no'} | ${r.falsePositive ? 'YES' : 'no'} | ${r.contaminated ? 'YES' : 'no'} | ${r.ok ? '✅' : '❌'} |`
  );
}
console.log(
  `\nDetection on catchable bugs: ${detected}/${detTrue.length}` +
    ` | honest misses (expected-not-caught): ${missesHeldOut}/${misses.length}` +
    ` | surprise catches: ${surprises}` +
    ` | false positives: ${fps} | contaminated: ${contam}`
);
console.log(
  anyFail
    ? '\nSTUDY RESULT: ❌ ground-truth mismatch (see ❌ rows)'
    : '\nSTUDY RESULT: ✅ all cases match ground truth'
);
process.exit(anyFail ? 1 : 0);
