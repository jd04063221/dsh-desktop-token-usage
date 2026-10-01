#!/usr/bin/env node
/**
 * Assemble `locales/<id>.json` into the generated dictionary block inside
 * `client.js`.
 *
 * The browser half is a single, dependency-free file: it cannot read a JSON file
 * at runtime, so the dictionaries have to be inlined. They are generated rather
 * than hand-written so that each language stays a self-contained file (one writer
 * per language, no merge conflicts in `client.js`) and so that the shipped copy
 * can never drift from the source of truth.
 *
 * Usage:
 *   node scripts/build-dicts.mjs           # rewrite the block in client.js
 *   node scripts/build-dicts.mjs --check    # exit 1 when the block is stale
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.dirname(here)
const CLIENT = path.join(root, 'client.js')
const LOCALES = path.join(root, 'locales')

/** Shipped dictionaries, in catalog order. `en` is the key authority. */
export const LOCALE_IDS = ['en', 'zh', 'zh-TW', 'zh-HK', 'de', 'fr', 'es', 'it', 'ja', 'ko']

/** The dictionary every other one is keyed against. */
export const KEY_AUTHORITY = 'en'

/** Keys whose suffix is a CLDR plural category rather than part of the name. */
export const PLURAL_KEYS = ['heat.legend', 'unit.turns', 'unit.sessions', 'unit.files']

const START = '/* @generated from locales/*.json by scripts/build-dicts.mjs - do not edit by hand */'
const END = '/* @end generated */'

const pluralCategories = (id) => new Intl.PluralRules(id).resolvedOptions().pluralCategories

/** The `{name}` slots a template carries, sorted so two sets compare as text. */
const placeholdersOf = (value) => (String(value).match(/\{\w+\}/g) ?? []).sort()

/** Read and validate every dictionary; returns `{ id: { key: value } }`. */
export function readDictionaries(dir = LOCALES, ids = LOCALE_IDS) {
  const missing = []
  const dicts = {}
  // A subset still needs the key authority: `--only=de` checks German against the
  // English key set rather than against German.
  const wanted = ids.includes(KEY_AUTHORITY) ? ids : [KEY_AUTHORITY, ...ids]
  for (const id of wanted) {
    const file = path.join(dir, `${id}.json`)
    if (!fs.existsSync(file)) {
      missing.push(file)
      continue
    }
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'))
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error(`${id}.json must be a flat object of string values`)
    }
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value !== 'string') throw new Error(`${id}.json: "${key}" is not a string`)
    }
    dicts[id] = parsed
  }
  if (missing.length > 0) throw new Error('missing dictionaries: ' + missing.join(', '))
  return dicts
}

/** Every problem that would make a dictionary unusable at runtime. */
export function validateDictionaries(dicts, ids = LOCALE_IDS) {
  if (!dicts[KEY_AUTHORITY]) throw new Error(`the ${KEY_AUTHORITY} dictionary is required as the key authority`)
  const problems = []
  const family = (key) => PLURAL_KEYS.find((name) => key.startsWith(name + '.')) ?? null
  const base = (key) => {
    const owner = family(key)
    return owner ? key.slice(owner.length + 1) : null
  }
  const plainKeys = Object.keys(dicts.en).filter((key) => family(key) === null)
  const plain = new Set(plainKeys)

  for (const id of ids) {
    const dict = dicts[id]
    if (!dict) {
      problems.push(`${id}: no dictionary`)
      continue
    }
    const own = new Set(Object.keys(dict))
    for (const key of plainKeys) if (!own.has(key)) problems.push(`${id}: missing "${key}"`)
    for (const key of own) {
      if (plain.has(key)) continue
      const owner = family(key)
      const category = base(key)
      if (!owner) {
        problems.push(`${id}: unexpected key "${key}"`)
        continue
      }
      if (!pluralCategories(id).includes(category)) {
        problems.push(`${id}: "${key}" is not a CLDR plural category of ${id}`)
      }
    }
    // The declared categories must all be present: a partial set falls through to
    // the key name at runtime, which renders as "unit.turns.few" on screen.
    for (const owner of PLURAL_KEYS) {
      const have = new Set([...own].filter((key) => family(key) === owner).map(base))
      const want = new Set(pluralCategories(id))
      for (const category of want) if (!have.has(category)) problems.push(`${id}: missing "${owner}.${category}"`)
      for (const category of have) if (!want.has(category)) problems.push(`${id}: "${owner}.${category}" is not a CLDR category of ${id}`)
    }
    // A placeholder is substituted by name at runtime, so one translated away is
    // invisible until the number disappears from the screen. Every key English
    // carries must carry the same set. (A plural key English has no category for
    // is skipped: there is nothing to compare it with.)
    for (const [key, english] of Object.entries(dicts[KEY_AUTHORITY])) {
      // A key this language correctly has no category for is not a place to
      // compare: the coverage check above already owns missing keys.
      if (!(key in dict)) continue
      const want = placeholdersOf(english)
      if (want.length === 0) continue
      const have = placeholdersOf(dict[key])
      if (have.join(',') !== want.join(',')) {
        problems.push(`${id}: "${key}" carries {${have.join(',')}} where English carries {${want.join(',')}}`)
      }
    }
  }
  return problems
}

const quote = (value) => "'" + value.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'"

/** The generated block, as lines without any line ending. */
export function renderBlock(dicts, ids = LOCALE_IDS) {
  const lines = [START, '    const DICT = {']
  for (const id of ids) {
    lines.push(`      '${id}': {`)
    for (const [key, value] of Object.entries(dicts[id])) lines.push(`        ${quote(key)}: ${quote(value)},`)
    lines.push('      },')
  }
  lines.push('    }', END)
  return lines
}

/** Replace the block in `source`, keeping its own line ending. */
export function spliceBlock(source, block) {
  const eol = source.includes('\r\n') ? '\r\n' : '\n'
  const lines = source.split(/\r?\n/)
  const from = lines.findIndex((line) => line.trim() === START)
  const to = lines.findIndex((line) => line.trim() === END)
  if (from < 0 || to < from) throw new Error('client.js has no generated dictionary block')
  const next = [...lines.slice(0, from), ...block, ...lines.slice(to + 1)]
  return next.join(eol)
}

export function build({ dir = LOCALES, ids = LOCALE_IDS } = {}) {
  const dicts = readDictionaries(dir, ids)
  const problems = validateDictionaries(dicts, ids)
  if (problems.length > 0) throw new Error('dictionary validation failed:\n  ' + problems.join('\n  '))
  const source = fs.readFileSync(CLIENT, 'utf8')
  return { dicts, source, next: spliceBlock(source, renderBlock(dicts, ids)) }
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invoked) {
  try {
    // `--only=en,zh` is a development aid: it checks the wiring before every
    // dictionary has been translated. The test always builds the full catalog.
    const only = (process.argv.find((arg) => arg.startsWith('--only=')) ?? '').slice('--only='.length)
    const ids = only ? only.split(',').map((id) => id.trim()).filter(Boolean) : LOCALE_IDS
    const { source, next } = build({ ids })
    // `--validate` never writes: a language can be checked on its own, which is
    // what keeps the generated block free of half-translated languages.
    if (process.argv.includes('--validate')) {
      const dictionaries = readDictionaries(LOCALES, ids)
      const found = validateDictionaries(dictionaries, ids)
      if (found.length > 0) {
        console.error(found.join('\n'))
        process.exit(1)
      }
      console.log(`${ids.join(', ')}: ok`)
    } else if (process.argv.includes('--check')) {
      if (source !== next) {
        console.error('client.js dictionary block is stale - run: node scripts/build-dicts.mjs')
        process.exit(1)
      }
      console.log('dictionary block is up to date')
    } else {
      fs.writeFileSync(CLIENT, next)
      console.log(`wrote ${ids.length} dictionaries into client.js`)
    }
  } catch (error) {
    console.error(String(error && error.message ? error.message : error))
    process.exit(1)
  }
}
