#!/usr/bin/env node
/**
 * Check the artifact `npm publish` would upload.
 *
 * `package.json` ships by whitelist (`files`), and npm drops whatever that
 * whitelist forgets without a word — a mistake that only surfaces after a release,
 * when a user's install is missing a file. This script packs the real tarball,
 * asserts its file list against what the plugin needs at runtime, installs it into
 * a scratch project and loads both exported faces, which is what a consumer does.
 *
 * Usage:
 *   node scripts/verify-package.mjs
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { LOCALE_IDS } from './build-dicts.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.dirname(here)
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))

/**
 * Run npm and return stdout; a non-zero exit becomes a failure.
 *
 * npm is a `.cmd` shim on Windows, so it always goes through a shell. The command
 * is assembled into one string on purpose: Node deprecates handing an argument
 * array to a shell (DEP0190), and the parts are simple enough to quote by hand.
 */
function npm(args, cwd = root) {
  const command = ['npm', ...args.map((arg) => (/\s/.test(arg) ? `"${arg}"` : arg))].join(' ')
  const result = spawnSync(command, { cwd, encoding: 'utf8', shell: true, stdio: ['ignore', 'pipe', 'pipe'] })
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(`npm ${args.join(' ')} exited ${result.status}\n${result.stderr ?? ''}`)
  }
  return result.stdout ?? ''
}

/**
 * The whitelist by kind. `docs/` (the design record), `locales/` (the dictionary
 * source the generated block is built from), `test/` and `scripts/` are
 * repository-only and must never reach the tarball.
 */
const EXACT = [
  'package.json',
  'LICENSE',
  'README.md',
  'CHANGELOG.md',
  'index.js',
  'client.js',
  'cordis.patch.yml',
  'icon.svg',
]
const PREFIXES = ['lib/', 'assets/', 'locale/', 'translations/']

/** What the plugin cannot work without: the two faces, the patch, the manifest. */
const REQUIRED = [
  ...EXACT,
  'lib/session-usage.js',
  'translations/README-zh.md',
  'translations/CHANGELOG-zh.md',
  ...LOCALE_IDS.map((id) => `locale/${id}.json`),
]

/**
 * Loaded inside the scratch project, after the tarball is installed. It is a file
 * rather than `--eval` so a bare specifier resolves the way a user's import does.
 */
const PROBE = `import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const NAME = ${JSON.stringify(manifest.name)}

const host = await import(NAME)
assert.deepEqual(Object.keys(host).sort(), ['Config', 'apply'], 'the Host half exports only Config and apply')
assert.equal(typeof host.apply, 'function', 'the Host half must stay loadable on its own')
assert.deepEqual(
  Object.keys(host.Config.dict).sort(),
  ['days', 'groupBy', 'hours', 'palette'],
  'the Config schema drives the settings card',
)

const manifestPath = fileURLToPath(import.meta.resolve(NAME + '/package.json'))
const dir = path.dirname(manifestPath)
const installed = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
assert.equal(installed.name, NAME, 'the installed manifest must be the same package')
assert.equal(installed.dsh.bundle.patch, './cordis.patch.yml', 'the bundle patch keeps its declared path')
assert.ok(fs.existsSync(path.join(dir, installed.dsh.bundle.patch)), 'the bundle patch must ship')

// The Browser half cannot be imported in Node: it registers itself with the page's
// module loader and needs \`window\`. It is resolved and read instead.
const client = fileURLToPath(import.meta.resolve(NAME + '/client'))
assert.ok(client.endsWith('client.js'), 'the ./client export must resolve to client.js')
assert.ok(fs.readFileSync(client, 'utf8').includes('__ModuleLoader__'), 'client.js must register a DSH client module')

const dictionaries = fs.readdirSync(path.join(dir, 'locale')).filter((file) => file.endsWith('.json'))
assert.equal(dictionaries.length, ${LOCALE_IDS.length}, 'one manifest translation per shipped language')
`

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), `${manifest.name}-pack-`))
try {
  const [entry] = JSON.parse(npm(['pack', '--json', '--pack-destination', scratch]))
  const tarball = path.join(scratch, entry.filename)
  const files = entry.files.map((file) => file.path).sort()

  const strays = files.filter((file) => !EXACT.includes(file) && !PREFIXES.some((prefix) => file.startsWith(prefix)))
  assert.deepEqual(strays, [], 'only the whitelist may reach the tarball')

  const missing = REQUIRED.filter((file) => !files.includes(file))
  assert.deepEqual(missing, [], 'every runtime file must be in the tarball')

  // A screenshot the README embeds but the tarball omits is a broken image on npm.
  const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8')
  const embedded = [...readme.matchAll(/\]\((assets\/[^)]+)\)/g)].map(([, file]) => file)
  assert.ok(embedded.length > 0, 'the README must keep embedding its screenshots')
  assert.deepEqual(
    embedded.filter((file) => !files.includes(file)),
    [],
    'every screenshot the README embeds must ship',
  )

  // Install the tarball the way a consumer does, then load both faces from it.
  fs.writeFileSync(
    path.join(scratch, 'package.json'),
    JSON.stringify({ name: 'pack-probe', private: true, type: 'module' }, null, 2),
  )
  fs.writeFileSync(path.join(scratch, 'probe.mjs'), PROBE)
  npm(['install', '--no-audit', '--no-fund', '--no-save', tarball], scratch)

  const probe = spawnSync(process.execPath, ['probe.mjs'], { cwd: scratch, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  if (probe.status !== 0) {
    throw new Error(`the installed package failed to load\n${probe.stdout ?? ''}\n${probe.stderr ?? ''}`)
  }

  console.log(`${manifest.name}@${manifest.version}: ${files.length} files packed, both faces load after install`)
} finally {
  fs.rmSync(scratch, { recursive: true, force: true })
}
