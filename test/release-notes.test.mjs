import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

// `scripts/release-notes.mjs` is what the release job in
// `.github/workflows/publish.yml` feeds to `gh release create`, so a regression in it
// is a broken release page. These tests pin the three things that must hold for every
// released version: it exits cleanly, the body is a changelog section, and no link in
// it is left relative (a release page cannot resolve the repository's own paths).

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const script = path.join(root, 'scripts', 'release-notes.mjs')
const base = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
  .repository.url.replace(/^git\+/, '').replace(/\.git$/, '')
const changelog = fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8')
/** Released versions, newest first. */
const versions = [...changelog.matchAll(/^## \[(\d+\.\d+\.\d+)\]/gm)].map((match) => match[1])

const run = (...args) => {
  try {
    return { status: 0, stdout: execFileSync(process.execPath, [script, ...args], { cwd: root, encoding: 'utf8' }), stderr: '' }
  } catch (error) {
    return { status: error.status, stdout: error.stdout ?? '', stderr: error.stderr ?? '' }
  }
}

test('every released version yields release notes from its changelog section', () => {
  assert.ok(versions.length >= 7, `the changelog still lists the released versions (found ${versions.length})`)
  for (const version of versions) {
    const { status, stdout } = run(version)
    assert.equal(status, 0, `${version} exits cleanly`)
    assert.ok(/^### /m.test(stdout), `${version} has a changelog subsection`)
    assert.ok(stdout.trim().length > 100, `${version} has a body`)
    assert.deepEqual(
      [...stdout.matchAll(/\]\((?!#)(?!https?:)[^)]+\)/g)].map((match) => match[0]),
      [],
      `${version} leaves no link relative`,
    )
    const lines = stdout.trimEnd().split('\n')
    if (version === versions.at(-1)) {
      assert.ok(!stdout.includes('**Full Changelog**'), `${version} is the first release, so it has no compare link`)
    } else {
      assert.match(
        lines.at(-1),
        new RegExp(`^\\*\\*Full Changelog\\*\\*: ${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/compare/v\\d+\\.\\d+\\.\\d+\\.\\.\\.v${version.replace(/\./g, '\\.')}$`),
        `${version} ends with a compare link`,
      )
    }
  }
})

test('an unknown version is refused with the versions that do exist', () => {
  const { status, stderr } = run('9.9.9')
  assert.equal(status, 1)
  assert.match(stderr, /no `## \[9\.9\.9\]` section in CHANGELOG\.md \(found: /)
})

test('no version at all prints the usage line', () => {
  const { status, stderr } = run()
  assert.equal(status, 2)
  assert.match(stderr, /usage: node scripts\/release-notes\.mjs <version>/)
})
