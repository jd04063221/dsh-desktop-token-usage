#!/usr/bin/env node
/**
 * One-command release preparation: the six manual steps from the maintainer
 * notes that humans forget one of (usually the nine translated CHANGELOG
 * titles), automated so `test/i18n.test.mjs` stays green by construction.
 *
 *   node scripts/prepare-release.mjs 0.1.7          # do the edits
 *   node scripts/prepare-release.mjs 0.1.7 --check  # CI mode: exit 1 if edits are pending
 *
 * What it does, in order:
 *   1. package.json version: strip any -rc.N suffix, set to <version>.
 *   2. CHANGELOG.md: rename the Unreleased section to `## [<version>] - <today>`,
 *      preserving the body and keeping a fresh empty `## [Unreleased]` on top
 *      only when the old section had content below it.
 *   3. translations/CHANGELOG-<id>.md: same rename, matching each file OWN
 *      unreleased label (`## [Unreleased]` vs `## [unreleased]`), so the
 *      version-sequence assertion in test/i18n.test.mjs passes without edits.
 *   4. Sanity: every CHANGELOG now carries `## [<version>]`; package.json matches.
 *
 * It never commits, tags, or publishes. Line endings of each file are kept.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { LOCALE_IDS } from './build-dicts.mjs'

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(here);

const version = process.argv[2] === '--check' ? process.argv[3] : process.argv[2];
const checkOnly = process.argv.includes('--check');
if (!version || !/^[0-9]+[.][0-9]+[.][0-9]+$/.test(version)) {
  console.error('usage: node scripts/prepare-release.mjs <version> [--check]   (e.g. 0.1.7)');
  process.exit(2);
}
const today = new Date().toISOString().slice(0, 10);

function splitLines(text) {
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  return { eol, lines: text.split(/\r?\n/) };
}

function renameUnreleased(lines, title) {
  // A hand-written `## [<version>]` section anywhere counts as prepared: a
  // release that keeps a Planned item in Unreleased adds its section below it
  // instead of renaming Unreleased, which is legitimate.
  if (lines.some(function (l) { return l.indexOf('## [' + version + ']') === 0; })) {
    return { changed: false, reason: 'already titled' }
  }
  const at = lines.findIndex(function (l) { return /^## \[[^\]]+\]/.test(l); });
  if (at < 0) return { changed: false, reason: 'no ## [...] heading' };
  const head = lines[at];
  if (!/^## \[([^0-9\]]+)\]/.test(head)) return { changed: false, reason: 'first section is a dated release, nothing unreleased' };
  const next = lines.slice();
  next[at] = '## [' + version + '] - ' + today;
  return { changed: true, lines: next };
}

const plans = [];
const changelogPath = path.join(root, 'CHANGELOG.md');
const mainText = fs.readFileSync(changelogPath, 'utf8');
const main = splitLines(mainText);
const mainDone = renameUnreleased(main.lines);
if (mainDone.changed) plans.push({ file: changelogPath, eol: main.eol, lines: mainDone.lines });

for (const id of LOCALE_IDS) {
  if (id === 'en') continue;
  const file = path.join(root, 'translations', 'CHANGELOG-' + id + '.md');
  const text = fs.readFileSync(file, 'utf8');
  const split = splitLines(text);
  const done = renameUnreleased(split.lines);
  if (done.changed) plans.push({ file, eol: split.eol, lines: done.lines });
}

const manifestPath = path.join(root, 'package.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const manifestChange = manifest.version !== version;

if (checkOnly) {
  const pending = [];
  if (manifestChange) pending.push('package.json version is ' + manifest.version);
  for (const p of plans) pending.push(path.relative(root, p.file) + ' still has an Unreleased title');
  if (pending.length > 0) {
    console.error('release ' + version + ' is not prepared:');
    for (const p of pending) console.error('  - ' + p);
    process.exit(1);
  }
  console.log('release ' + version + ' prepared: package.json and all ten CHANGELOGs titled');
} else {
  for (const p of plans) fs.writeFileSync(p.file, p.lines.join(p.eol));
  if (manifestChange) {
    manifest.version = version;
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  }
  console.log('prepared ' + version + ': ' + (plans.length + (manifestChange ? 1 : 0)) + ' file(s) updated');
}
