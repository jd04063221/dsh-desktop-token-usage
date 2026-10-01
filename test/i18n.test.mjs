/**
 * The invariants that keep the dictionaries, the generated block, the runtime
 * language catalog and the shipped documents from drifting apart.
 *
 * The generated block has no runtime source to compare against, so these are
 * asserted against `locales/*.json` — the source of truth — and against the
 * catalog the client actually registers.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { LOCALE_IDS, PLURAL_KEYS, build, readDictionaries, validateDictionaries } from '../scripts/build-dicts.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.dirname(here)

/**
 * The English pair is what npm and GitHub render, so it stays at the repository
 * root; every other language lives under `translations/`, one file per language
 * in both classes.
 */
const docPath = (file) =>
  file === 'README.md' || file === 'CHANGELOG.md' ? file : path.posix.join('translations', file)
const docFile = (file) => path.join(root, docPath(file))
const source = fs.readFileSync(path.join(root, 'client.js'), 'utf8')
const dicts = readDictionaries()

/** The generated block, which is the only place non-ASCII copy may live. */
const BLOCK = /\/\* @generated[\s\S]*?\/\* @end generated \*\//
const withoutBlock = source.replace(BLOCK, '')

/** The packs the client registers, read back out of the hand-written list. */
const packs = [...source.matchAll(/\{ id: '([A-Za-z0-9-]+)', fallback: '([a-z-]+)' \}/g)].map(([, id, fallback]) => ({ id, fallback }))

/**
 * What the view actually looks a key up with. Scanning every string literal would
 * also hit slot names (`plugins.bundle.config`) and the plural family names
 * (`unit.turns`, which is a prefix rather than a key), and flag those instead.
 */
function keysInSource() {
  const keys = new Set()
  const families = new Set()
  for (const [, key] of withoutBlock.matchAll(/(?<![\w.$])t\('([a-z][\w.]*)'/g)) keys.add(key)
  for (const [, key] of withoutBlock.matchAll(/labelKey: '([a-z][\w.]*)'/g)) keys.add(key)
  // `translate('en', 'lang.' + pack.id)` builds its key at runtime; only the
  for (const [, family] of withoutBlock.matchAll(/(?:countOf|pluralKey)\('([a-z][\w.]*)'/g)) families.add(family)
  return { keys, families }
}

test('the generated block matches locales/*.json byte for byte', () => {
  const { next } = build()
  assert.equal(source, next, 'run: node scripts/build-dicts.mjs')
  assert.match(source, BLOCK, 'client.js must carry the generated dictionary block')
})

test('every dictionary carries the canonical keys, and exactly its own plural forms', () => {
  assert.deepEqual(validateDictionaries(dicts), [])
})

test('the validator rejects the mistakes a translation actually makes', () => {
  // A clean dictionary built from the key authority proves the cases below fail
  // for the reason they name, not because the fixture was already broken.
  const base = { en: dicts.en, de: { ...dicts.en } }
  assert.deepEqual(validateDictionaries(base, ['de']), [])
  const broken = (change) => validateDictionaries({ en: dicts.en, de: { ...dicts.en, ...change } }, ['de'])
  assert.ok(
    broken({ 'window.hours': 'Stunden zurück' }).some((problem) => problem.includes('window.hours')),
    'a translated-away placeholder must be caught',
  )
  assert.ok(
    broken({ 'unit.turns.other': 'Drehungen' }).some((problem) => problem.includes('unit.turns.other')),
    'a plural template that lost its count must be caught',
  )
  const missing = { ...dicts.en }
  delete missing['action.refresh']
  assert.ok(
    validateDictionaries({ en: dicts.en, de: missing }, ['de']).some((problem) => problem.includes('action.refresh')),
    'a dropped key must be caught',
  )
  assert.ok(
    broken({ 'unit.turns.few': '{n} turns' }).some((problem) => problem.includes('unit.turns.few')),
    'a plural category the language does not declare must be caught',
  )
})

test('the shipped catalog, the packs and the dictionaries agree', () => {
  assert.deepEqual(
    packs.map((pack) => pack.id),
    LOCALE_IDS.filter((id) => id !== 'en' && id !== 'zh'),
    'every language pack in the catalog must be registered by the client, in order',
  )
  // DSH requires a fallback chain that terminates at English, and the two
  // Traditional Chinese packs are the only ones with a parent language.
  const expected = { 'zh-TW': 'zh', 'zh-HK': 'zh', de: 'en', fr: 'en', es: 'en', it: 'en', ja: 'en', ko: 'en' }
  for (const pack of packs) assert.equal(pack.fallback, expected[pack.id], `${pack.id} fallback`)
  assert.deepEqual(
    fs.readdirSync(path.join(root, 'locales')).sort(),
    LOCALE_IDS.map((id) => id + '.json').sort(),
    'locales/ holds one file per shipped language',
  )
})

test('every key the client looks up exists', () => {
  const keys = new Set(Object.keys(dicts.en))
  const { keys: used, families } = keysInSource()
  assert.ok(used.size > 60, `expected the view to name its keys, found ${used.size}`)
  const unknown = [...used].filter((key) => !keys.has(key))
  const unknownFamilies = [...families].filter((family) => ![...keys].some((key) => key.startsWith(family + '.')))
  assert.deepEqual(
    [...unknown, ...unknownFamilies],
    [],
    'every key and plural family named in client.js must exist in locales/en.json',
  )
})

test('no copy lives outside the generated block', () => {
  // The guard that stops a half-localized build: a stray CJK string is a string
  // that never follows the language setting. Only the dictionary block may carry
  // non-ASCII copy; comments are scanned too, which is why they are English.
  const nonAscii = withoutBlock
    .split(/\r?\n/)
    .map((line, index) => [index + 1, line])
    // Latin diacritics, `·` and `§` are punctuation, not copy, so the scan starts
    // at the scripts that only ever arrive as translated words.
    .filter(([, line]) =>
      /[\u0370-\u03ff\u0400-\u04ff\u0590-\u05ff\u0600-\u06ff\u0900-\u097f\u0e00-\u0e7f\u1100-\u11ff\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af\u3000-\u303f\uff00-\uffef]/.test(
        line,
      ),
    )
  assert.deepEqual(nonAscii, [], 'move the copy into locales/*.json')
})

test('the Host half carries no copy of its own', () => {
  // The Host has no locale service, so any sentence it writes is a sentence only
  // one reader can read. Its settings descriptions are language-neutral, its
  // diagnostics are English, and the only Chinese left in the package belongs to
  // the view — where a dictionary replaces it.
  const host = fs.readFileSync(path.join(root, 'index.js'), 'utf8')
  assert.deepEqual(
    host
      .split(/\r?\n/)
      .map((line, index) => [index + 1, line])
      .filter(([, line]) => /[\u3400-\u9fff\u3000-\u303f\uff00-\uffef]/.test(line)),
    [],
    'index.js must stay language-neutral',
  )
})

test('the plugin manifests are translated, one per shipped language', () => {
  const manifestDir = path.join(root, 'locale')
  assert.deepEqual(
    fs.readdirSync(manifestDir).sort(),
    LOCALE_IDS.map((id) => id + '.json').sort(),
    'locale/ holds one manifest per shipped language',
  )
  for (const id of LOCALE_IDS) {
    const manifest = JSON.parse(fs.readFileSync(path.join(manifestDir, `${id}.json`), 'utf8'))
    assert.ok(manifest.meta, `${id}.json must carry a meta block`)
    assert.equal(typeof manifest.meta.title, 'string')
    assert.ok(manifest.meta.title.trim().length > 0, `${id}.json title`)
    assert.ok(manifest.meta.description.trim().length > 0, `${id}.json description`)
    if (id !== 'en') {
      assert.notEqual(manifest.meta.description, JSON.parse(fs.readFileSync(path.join(manifestDir, 'en.json'), 'utf8')).meta.description, `${id}.json must be translated`)
    }
  }
})

test('one document per language, in both classes', () => {
  for (const id of LOCALE_IDS) {
    const suffix = id === 'en' ? '' : `-${id}`
    for (const name of ['README', 'CHANGELOG']) {
      const file = docFile(`${name}${suffix}.md`)
      assert.ok(fs.existsSync(file), `${docPath(`${name}${suffix}.md`)} is missing`)
      assert.ok(fs.statSync(file).size > 1000, `${name}${suffix}.md looks empty`)
    }
  }
})

test('every document links to all the others exactly once', () => {
  for (const id of LOCALE_IDS) {
    const suffix = id === 'en' ? '' : `-${id}`
    for (const name of ['README', 'CHANGELOG']) {
      const body = fs.readFileSync(docFile(`${name}${suffix}.md`), 'utf8')
      const head = body.split(/\r?\n/).slice(0, 8).join('\n')
      for (const other of LOCALE_IDS) {
        if (other === id) continue
        const file = `${name}${other === 'en' ? '' : '-' + other}.md`
        // The closing paren matters: `README-zh.md` is a prefix of `README-zh-TW.md`.
        assert.ok(head.includes(`/${file})`), `${name}${suffix}.md must link to ${file}`)
      }
    }
  }
})

test('the documents keep the structure and versions of the English truth', () => {
  const read = (file) => fs.readFileSync(docFile(file), 'utf8')
  // A translated heading has translated words, so only the shape is comparable:
  // the sequence of heading levels, the version titles, and every link target.
  const levels = (body) => (body.match(/^#{1,3} /gm) ?? []).join('|')
  // Version numbers are identical in every language; the label of the unreleased
  // section is translated, so it is normalized before comparing.
  const versions = (body) =>
    (body.match(/^## \[([^\]]+)\]/gm) ?? [])
      .map((line) => (/^## \[\d+\.\d+\.\d+\]/.test(line) ? line : '## [unreleased]'))
      .join('|')
  // Line 3 is the language switcher, whose links necessarily differ per file, so
  // every comparison below starts after it.
  const body = (file) => read(file).split(/\r?\n/).slice(3).join('\n')
  const links = (text, file) =>
    [...new Set((text.match(/\]\(([^)]+)\)/g) ?? []).map((hit) => hit.slice(2, -1)))]
      // An external site may have a translated page of its own (keepachangelog and
      // semver both link one), and an in-page anchor is a translated heading; the
      // repository's own paths are the ones that must never move.
      .filter((target) => !target.startsWith('http') && !target.startsWith('#'))
      // A translated document sits one level deeper, so its relative targets carry a
      // `../../` the English one does not; compare the resolved repository path.
      .map((target) => path.posix.normalize(path.posix.join(path.posix.dirname(file), target)))
      .sort()
  const en = {
    readme: { levels: levels(body('README.md')), links: links(body('README.md'), 'README.md') },
    changelog: {
      levels: levels(body('CHANGELOG.md')),
      versions: versions(body('CHANGELOG.md')),
      links: links(body('CHANGELOG.md'), 'CHANGELOG.md'),
    },
  }
  for (const id of LOCALE_IDS) {
    if (id === 'en') continue
    const readmeName = `README-${id}.md`
    const readme = body(readmeName)
    assert.equal(levels(readme), en.readme.levels, `${readmeName} heading levels`)
    assert.deepEqual(links(readme, docPath(readmeName)), en.readme.links, `${readmeName} link targets`)
    const changelogName = `CHANGELOG-${id}.md`
    const changelog = body(changelogName)
    assert.equal(levels(changelog), en.changelog.levels, `${changelogName} heading levels`)
    assert.equal(versions(changelog), en.changelog.versions, `${changelogName} version titles`)
    assert.deepEqual(links(changelog, docPath(changelogName)), en.changelog.links, `${changelogName} link targets`)
  }
})

test('the plural families are the ones the view actually counts', () => {
  assert.deepEqual(PLURAL_KEYS, ['heat.legend', 'unit.turns', 'unit.sessions', 'unit.files'])
  for (const family of PLURAL_KEYS) {
    assert.ok(Object.keys(dicts.en).some((key) => key.startsWith(family + '.')), `${family} must be plural`)
  }
})
