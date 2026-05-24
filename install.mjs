#!/usr/bin/env node
// Verif-Kit cross-platform installer. Run from the TARGET repo root:
//   node <path-to>/verif-kit/install.mjs
// Copies the command surface (.claude/) + engine (.verif-kit/), seeds
// verif-kit.config.json if absent, and writes a per-file sha256 manifest. It does
// NOT edit your .specify/extensions.yml (YAML mutation is risky) — see install.md
// for the one-line after_implement hook to add manually.

import { cpSync, mkdirSync, existsSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const PKG = dirname(fileURLToPath(import.meta.url)); // the verif-kit/ source dir
const TARGET = process.cwd();

function copyDir(src, dst) {
  if (!existsSync(src)) return;
  mkdirSync(dst, { recursive: true });
  cpSync(src, dst, { recursive: true });
}

// 1. command surface
copyDir(join(PKG, 'agents'), join(TARGET, '.claude', 'agents'));
copyDir(join(PKG, 'skills'), join(TARGET, '.claude', 'skills'));

// 2. engine — templates next to spec-kit's if present, else under .verif-kit/
const templatesTo = existsSync(join(TARGET, '.specify'))
  ? join(TARGET, '.specify', 'templates')
  : join(TARGET, '.verif-kit', 'templates');
copyDir(join(PKG, 'templates'), templatesTo);
copyDir(join(PKG, 'scripts'), join(TARGET, '.verif-kit', 'scripts'));
copyDir(join(PKG, 'framework'), join(TARGET, '.verif-kit', 'framework'));

// 3. config (never overwrite an existing one)
const cfg = join(TARGET, 'verif-kit.config.json');
if (!existsSync(cfg)) {
  cpSync(join(PKG, 'verif-kit.config.example.json'), cfg);
  console.log('• wrote verif-kit.config.json — EDIT it for your project (commands, paths, risk tiers).');
} else {
  console.log('• verif-kit.config.json already present — left untouched.');
}

// 4. manifest with per-file sha256 (tamper/version tracking, like spec-kit manifests)
function* walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else yield p;
  }
}
const files = {};
for (const f of walk(PKG)) {
  files[relative(PKG, f).replace(/\\/g, '/')] = createHash('sha256').update(readFileSync(f)).digest('hex');
}
mkdirSync(join(TARGET, '.verif-kit'), { recursive: true });
writeFileSync(
  join(TARGET, '.verif-kit', 'verif-kit.json'),
  JSON.stringify({ name: 'verif-kit', installedAt: new Date().toISOString(), files }, null, 2)
);

console.log('✓ Verif-Kit installed.');
console.log('  Next: edit verif-kit.config.json, then run  /verif-kit-verify <module>');
console.log('  Spec-kit integration (optional): add the after_implement hook from install.md.');
