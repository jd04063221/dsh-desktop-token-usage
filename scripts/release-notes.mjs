#!/usr/bin/env node
/**
 * Print the GitHub Release notes for one version, taken from CHANGELOG.md.
 *
 * Used by the `release` job in .github/workflows/publish.yml, and equally by hand:
 *
 *   node scripts/release-notes.mjs 0.1.6 > notes.md
 *
 * A release body needs three things the changelog file cannot carry as-is:
 *   - the section for that version (`## [0.1.6]` up to the next `## ` heading);
 *   - repository-relative links rewritten to absolute URLs pinned at the tag,
 *     because a release page does not resolve `scripts/foo.mjs` on its own;
 *   - a `**Full Changelog**` compare link against the previous version heading.
 *
 * Output is always LF, whatever the working copy uses, so the same notes come out
 * on a Windows checkout and on the runner.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.dirname(here)

const version = process.argv[2]
if (!version) {
  console.error('usage: node scripts/release-notes.mjs <version>   (e.g. 0.1.6)')
  process.exit(2)
}

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
// "git+https://github.com/owner/repo.git" -> "https://github.com/owner/repo"
const base = manifest.repository.url.replace(/^git\+/, '').replace(/\.git$/, '')

const text = fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8')
const headings = [...text.matchAll(/^## \[([^\]]+)\].*$/gm)]
const at = headings.findIndex((heading) => heading[1] === version)
if (at < 0) {
  console.error(
    `no \`## [${version}]\` section in CHANGELOG.md (found: ${headings.map((h) => h[1]).join(', ')})`,
  )
  process.exit(1)
}
const start = headings[at].index + headings[at][0].length
const end = at + 1 < headings.length ? headings[at + 1].index : text.length
const body = text
  .slice(start, end)
  .replace(/\r\n/g, '\n')
  .trim()
  // An in-page anchor stays as it is; anything else is a repository path.
  .replace(/\]\((?!#)(?!https?:)([^)]+)\)/g, (_all, target) => `](${base}/blob/v${version}/${target})`)

const previous = at + 1 < headings.length ? headings[at + 1][1] : null
const footer = previous ? `\n\n**Full Changelog**: ${base}/compare/v${previous}...v${version}` : ''
process.stdout.write(`${body}${footer}\n`)
