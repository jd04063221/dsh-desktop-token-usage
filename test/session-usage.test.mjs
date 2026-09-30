/**
 * Tests for the session-log rollup. Run with `npm test` (node --test).
 *
 * The golden case cross-checks our fold against DSH's own persisted projection:
 * `~/.dsh/storages/session_projcache/sessions/session-5964a5d3-*.json` carries
 * `record.rows.tokenUsage.val.totals`, computed by the Harness itself.
 *
 * Tests that need real session logs skip themselves when `~/.dsh/sessions` is
 * absent, so the suite still runs on a clean machine.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  DAY_MS,
  HOUR_MS,
  buildIndex,
  cardRollup,
  clearIndexCache,
  dayKey,
  enumerateSessionFiles,
  foldUsage,
  localDayStart,
  readSessionRecords,
  scanZstdFrames,
  summarize,
  totalOf,
} from '../lib/session-usage.js'

// `apply` writes the plugin's own diagnostics; keep them off the live files,
// which a human reads to tell which Host generation is running.
process.env.DSH_TOKEN_USAGE_DIAG_DIR ??= fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-desktop-token-usage-diag-'))

/** Local midnight of a `YYYY-MM-DD` key. */
const dayKeyParts = (key) => key.split('-').map(Number)
const dayStart = (key) => {
  const [year, month, day] = dayKeyParts(key)
  return new Date(year, month - 1, day).getTime()
}

const SESSIONS = path.join(os.homedir(), '.dsh', 'sessions')
const PROJECTIONS = path.join(os.homedir(), '.dsh', 'storages', 'session_projcache', 'sessions')
const haveSessions = fs.existsSync(SESSIONS)

/**
 * The golden case needs no hard-coded session id: the Harness names a projection
 * cache after a session, and the log directory carries that same id (root
 * sessions `session-<id>`, subagents the bare id), so any cached session whose
 * log is still on disk can serve. Logs touched within the last ten minutes are
 * skipped: the running session keeps appending to its log, which would make the
 * projection the stale side of the comparison.
 */
const goldenSession = (() => {
  if (!haveSessions || !fs.existsSync(PROJECTIONS)) return null
  const filesById = new Map(enumerateSessionFiles().map((file) => [path.basename(path.dirname(file)), file]))
  for (const name of fs.readdirSync(PROJECTIONS).sort()) {
    const id = name.endsWith('.json') ? name.slice(0, -'.json'.length) : ''
    const file = id && filesById.get(id)
    if (file && Date.now() - fs.statSync(file).mtimeMs > 10 * 60 * 1000) return { id, file, cache: path.join(PROJECTIONS, name) }
  }
  return null
})()

test('a frame-scan finds the concatenated frames and parses every record', { skip: !haveSessions }, () => {
  const files = enumerateSessionFiles()
  assert.ok(files.length > 0, 'expected at least one session log')
  const largest = files.map((file) => ({ file, size: fs.statSync(file).size })).sort((a, b) => b.size - a.size)[0]
  const { frames } = scanZstdFrames(fs.readFileSync(largest.file))
  assert.ok(frames.length > 1, `expected concatenated frames, saw ${frames.length}`)
  const { records } = readSessionRecords(largest.file)
  assert.ok(records.length >= frames.length, 'every frame carries at least one record')
  assert.equal(records[0].type, 'session')
})

test('foldUsage replaces a repeated (turn, step) slot and adds after a retry', () => {
  const usage = (input, output) => ({
    type: 'assistant/message',
    time: 1,
    data: {
      turn: 1,
      step: 1,
      usage: { inputTokens: input, outputTokens: output, cacheReadTokens: 0, cacheWriteTokens: 0 },
      message: { source: { kind: 'model', provider: 'p', model: 'm' } },
    },
  })

  // Two records in one slot: the second settles and replaces the first.
  assert.deepEqual(foldUsage([usage(10, 1), usage(30, 2)]).totals, [30, 2, 0, 0, 0])

  // A retry closes the slot, so the next call adds instead of replacing.
  assert.deepEqual(
    foldUsage([usage(10, 1), { type: 'llm/retry-started', data: { turn: 1, step: 1 } }, usage(30, 2)]).totals,
    [40, 3, 0, 0, 0],
  )

  // reasoningTokens is a subset of outputTokens and must not reach the total.
  const reasoning = foldUsage([
    { ...usage(0, 0), data: { turn: 2, step: 1, usage: { inputTokens: 5, outputTokens: 7, reasoningTokens: 7 } } },
  ])
  assert.equal(totalOf(reasoning.totals), 12)

  // A replaced slot stays attributed to the record that settled it.
  const attributed = foldUsage([usage(10, 1), usage(30, 2)])
  assert.equal(attributed.entries.length, 1)
  assert.deepEqual(attributed.entries[0].buckets, [30, 2, 0, 0, 0])
})

test('folded totals match the Harness projection for a real session', { skip: !goldenSession }, () => {
  const expected = JSON.parse(fs.readFileSync(goldenSession.cache, 'utf8')).record.rows.tokenUsage.val.totals
  const { records } = readSessionRecords(goldenSession.file)
  assert.equal(records[0]?.id, goldenSession.id, 'the log directory names the session it holds')
  const { totals } = foldUsage(records)
  // The projection carries the four billed buckets; reasoning is a subset of
  // output and belongs to no projected total, so only its bound is asserted.
  assert.deepEqual(
    totals.slice(0, 4),
    [expected.uncachedInputTokens, expected.outputTokens, expected.cacheReadTokens, expected.cacheWriteTokens],
    'the four projected buckets must match',
  )
  assert.ok(totals[4] <= totals[1], 'reasoningTokens must stay inside outputTokens')
})

test('the rollup is internally consistent', { skip: !haveSessions }, () => {
  clearIndexCache()
  const payload = summarize({ useCache: false })
  const [input, output, cacheRead, cacheWrite, reasoning] = payload.totals.buckets
  assert.equal(payload.totals.totalTokens, input + output + cacheRead + cacheWrite)
  assert.ok(reasoning <= output, 'reasoningTokens must stay inside outputTokens')

  // Days and models must re-sum to the same grand total.
  const daySum = payload.days.reduce((sum, day) => sum + totalOf(day.buckets), 0)
  const modelSum = payload.models.reduce((sum, model) => sum + model.totalTokens, 0)
  assert.equal(daySum, payload.totals.totalTokens)
  assert.equal(modelSum, payload.totals.totalTokens)

  // Each day rollup equals the sum of its own per-model cells.
  for (const day of payload.days) {
    const perModel = Object.values(day.byModel).reduce((sum, buckets) => sum + totalOf(buckets), 0)
    assert.equal(perModel, totalOf(day.buckets), `per-model cells disagree on ${day.day}`)
  }
  assert.ok(payload.totals.sessions > 0)
  assert.ok(payload.models.length > 0)
})

test('millisecond ranges partition the total and source filters narrow it', { skip: !haveSessions }, () => {
  clearIndexCache()
  // This suite reads the LIVE session logs and the running session keeps appending
  // to them, so every window below shares one upper bound taken at the start of the
  // current hour. Pinning any later instant would not help: hour filtering is per
  // bucket, so a bound inside the current hour still admits records written after it.
  const pinnedUntil = Math.floor(Date.now() / HOUR_MS) * HOUR_MS
  const all = summarize({ untilMs: pinnedUntil })
  if (all.days.length === 0) return

  // One-day ranges must partition the grand total exactly. Windows are aligned
  // to whole hours, so a local-midnight boundary is exact.
  let partitioned = 0
  let turns = 0
  for (const day of all.days) {
    const start = dayStart(day.day)
    const single = summarize({ sinceMs: start, untilMs: Math.min(start + DAY_MS, pinnedUntil) })
    partitioned += single.totals.totalTokens
    turns += single.totals.turns
  }
  assert.equal(partitioned, all.totals.totalTokens, 'per-day ranges must partition the total')
  assert.equal(turns, all.totals.turns)

  // An hour window can only be a subset of the day that contains it.
  const day = all.days[all.days.length - 1]
  const hourStartMs = new Date(...dayKeyParts(day.day), 12).getTime()
  const wholeDay = summarize({ sinceMs: dayStart(day.day), untilMs: Math.min(dayStart(day.day) + DAY_MS, pinnedUntil) })
  const oneHour = summarize({ sinceMs: hourStartMs, untilMs: Math.min(hourStartMs + HOUR_MS, pinnedUntil) })
  assert.ok(oneHour.totals.totalTokens <= wholeDay.totals.totalTokens)

  // A source filter can only narrow, and an unknown source yields nothing.
  const clients = summarize({ sources: ['client'], untilMs: pinnedUntil })
  assert.ok(clients.totals.totalTokens <= all.totals.totalTokens)
  assert.equal(summarize({ sources: ['nope'], untilMs: pinnedUntil }).totals.totalTokens, 0)
})

test('the heatmap ignores the time range and partitions by source', { skip: !haveSessions }, () => {
  clearIndexCache()
  const all = summarize()
  if (all.days.length === 0) return
  assert.equal(all.heatmap.weeks, 53)
  assert.ok(all.heatmap.days.length > 0)
  for (const day of all.heatmap.days) {
    assert.ok(Number.isFinite(day.tokens) && Number.isFinite(day.turns) && Number.isFinite(day.requests))
  }

  // A calendar narrowed to one day is what a heatmap is not for. Compare the day
  // grid rather than the token values: the keys come from the date grid and so are
  // stable while the live logs grow, and a calendar that followed the range filter
  // would collapse to a single day here.
  const last = all.days[all.days.length - 1].day
  const narrow = summarize({ sinceMs: dayStart(last), untilMs: dayStart(last) + DAY_MS })
  assert.deepEqual(
    narrow.heatmap.days.map((day) => day.day),
    all.heatmap.days.map((day) => day.day),
    'the calendar must not follow the range filter',
  )

  // But it does follow the source filter, and the surfaces partition it exactly.
  // The heatmap deliberately ignores the range, so no window can pin it: it is read
  // from the live index, and this session may append a record mid-loop. Re-read once
  // when the two snapshots disagree; a genuine partition bug fails both times.
  const heatTotal = () => summarize().heatmap.days.reduce((sum, day) => sum + day.tokens, 0)
  const perSurfaceTotal = () =>
    ['client', 'cli', 'subagent', 'none'].reduce(
      (sum, source) => sum + summarize({ sources: [source] }).heatmap.days.reduce((s, day) => s + day.tokens, 0),
      0,
    )
  let expected = heatTotal()
  let actual = perSurfaceTotal()
  if (actual !== expected) {
    expected = heatTotal()
    actual = perSurfaceTotal()
  }
  assert.equal(actual, expected, 'the surfaces must partition the calendar')
})

test('the sidebar card follows the configured windows', { skip: !haveSessions }, () => {
  const both = cardRollup({ hours: 6, days: 7 })
  assert.deepEqual(both.blocks.map((block) => block.id), ['hours', 'days'])
  assert.equal(both.all, null, 'enabled windows replace the all-time fallback')

  const off = cardRollup({ hours: 0, days: 0 })
  assert.deepEqual(off.blocks, [])
  assert.ok(off.all, 'with both windows off the card falls back to the all-time figures')

  // A window cannot exceed the all-time total, and the split is by construction.
  for (const block of both.blocks) {
    assert.ok(block.totalTokens <= off.all.totalTokens, `${block.id} exceeds the all-time total`)
    assert.equal(block.inputTokens, block.buckets[0] + block.buckets[2])
    assert.equal(block.outputTokens, block.buckets[1])
    assert.equal(block.totalTokens, block.inputTokens + block.outputTokens + block.buckets[3])
  }
  assert.ok(both.blocks[0].totalTokens <= both.blocks[1].totalTokens, '6 hours cannot exceed 7 days')

  // Clamping belongs to this module, not to the caller.
  const clamped = cardRollup({ hours: 99, days: -3 })
  assert.deepEqual([clamped.hours, clamped.days], [23, 0])
  assert.deepEqual(clamped.blocks.map((block) => block.id), ['hours'])
})

test('an unchanged log set reuses the in-process index', { skip: !haveSessions }, () => {
  clearIndexCache()
  const first = buildIndex()
  const second = buildIndex()
  assert.equal(first, second, 'the second call must reuse the memoized index')
  clearIndexCache()
})

test('dayKey buckets in local time, not UTC', () => {
  // 2026-01-01T00:30 local is 2025-12-31 in UTC for UTC+8.
  assert.equal(dayKey(new Date(2026, 0, 1, 0, 30, 0).getTime()), '2026-01-01')
})

test('the Remote service answers a filter and records the call', { skip: !haveSessions }, async () => {
  const provided = []
  const { apply, Config } = await import('../index.js')

  // The Config schema is what the Settings → Plugins card renders.
  const standard = Config['~standard']
  assert.equal(standard.vendor, 'schemastery')
  const defaults = standard.validate({})
  assert.deepEqual([defaults.value.hours, defaults.value.days], [0, 0])
  assert.deepEqual([standard.validate({ hours: 23, days: 30 }).value.hours, standard.validate({ hours: 23, days: 30 }).value.days], [23, 30])
  assert.ok(standard.validate({ hours: 24 }).issues, 'hours above 23 must be refused')
  assert.ok(standard.validate({ days: 31 }).issues, 'days above 30 must be refused')

  const edits = []
  const configEditor = {
    configuration: () => [
      { entry: { id: 'include:other', options: { name: 'some-other-plugin' } } },
      { entry: { id: 'include:dsh-desktop-token-usage', options: { name: 'dsh-desktop-token-usage' } }, inherited: {}, override: {} },
    ],
    edit: async (entry, change) => {
      edits.push({ entryId: entry.id, next: change({ hours: 0, days: 0 }, {}) })
    },
  }
  apply(
    {
      inject: (deps, callback) => {
        assert.deepEqual(deps, ['typert'])
        callback({
          typert: { register: () => () => {} },
          reflect: { provide: (name, value) => { provided.push({ name, value }); return () => {} } },
          effect: () => {},
          inject: (innerDeps, innerCallback) => {
            assert.deepEqual(innerDeps, ['configEditor'])
            innerCallback({ configEditor })
          },
        })
      },
    },
    { hours: 6, days: 7 },
  )
  assert.equal(provided.length, 1)

  const payload = await provided[0].value.summary({ sinceMs: null, untilMs: null, sources: ['client'] })
  assert.equal(payload.totals.buckets.length, 5)
  assert.ok(payload.totals.sessions > 0)
  assert.ok(payload.days.length > 0)
  assert.deepEqual(payload.card.blocks.map((block) => block.id), ['hours', 'days'])
  assert.equal(payload.card.all, null)

  // The config endpoints report the windows in force and write through the
  // Loader's own editor, choosing this plugin's row out of the whole profile.
  const service = provided[0].value
  assert.deepEqual(await service.config(), { hours: 6, days: 7, writable: true })
  assert.deepEqual(await service.setConfig({ hours: 12, days: -4 }), { hours: 12, days: 0, writable: true })
  assert.equal(edits.length, 1)
  assert.equal(edits[0].entryId, 'include:dsh-desktop-token-usage')
  assert.deepEqual(edits[0].next, { hours: 12, days: 0 })

  // The same call must leave a diagnostic trail the shell can read back.
  const logPath = path.join(process.env.DSH_TOKEN_USAGE_DIAG_DIR, 'calls.json')
  const log = JSON.parse(fs.readFileSync(logPath, 'utf8'))
  const last = log.calls[log.calls.length - 1]
  assert.equal(last.sessions, payload.totals.sessions)
  assert.deepEqual(last.filter, { sinceMs: null, untilMs: null, sources: ['client'] })
  assert.deepEqual(last.cardBlocks, ['hours', 'days'])
  // The write is atomic — it goes through a `.tmp` sibling and is renamed — so a
  // committed call must leave no temp file behind for a reader to trip over.
  assert.ok(
    !fs.readdirSync(process.env.DSH_TOKEN_USAGE_DIAG_DIR).some((name) => name.endsWith('.tmp')),
    'a committed diagnostic write must leave no .tmp file behind',
  )
})

test('every path the plugin persists stays inside its one cache directory', async () => {
  const { PLUGIN_CACHE_DIR, DSH_HOME, CACHE_FILE, SESSIONS_ROOT } = await import('../lib/session-usage.js')
  assert.equal(PLUGIN_CACHE_DIR, path.join(DSH_HOME, 'cache', 'dsh-desktop-token-usage'))
  assert.equal(CACHE_FILE, path.join(PLUGIN_CACHE_DIR, 'sessions-index.json'))
  assert.equal(SESSIONS_ROOT, path.join(DSH_HOME, 'sessions'), 'sessions are read, never written')
  assert.ok(CACHE_FILE.startsWith(PLUGIN_CACHE_DIR + path.sep), 'the cache must live in that directory')
  // The Host writes nothing but into `PLUGIN_CACHE_DIR`; grep the sources rather
  // than trusting this list to stay complete.
  const root = path.dirname(fileURLToPath(import.meta.url))
  for (const file of ['../index.js', '../lib/session-usage.js']) {
    const source = fs.readFileSync(path.join(root, file), 'utf8')
    for (const match of source.matchAll(/writeFileSync\(\s*([A-Za-z_$][\w$]*)/g)) {
      const target = match[1]
      assert.ok(
        ['tmp'].includes(target),
        `${file} must only ever writeFileSync to a temp path, not to ${target}`,
      )
    }
  }
})

test('the Loader row is found by id even when its name is not the scoped package', async () => {
  // A profile row installed before the package was scoped carries no scoped
  // `options.name`; the row id is what keeps the settings form writable.
  const edits = []
  const configEditor = {
    configuration: () => [{ entry: { id: 'include:dsh-desktop-token-usage' } }],
    edit: async (entry) => { edits.push(entry.id) },
  }
  const provided = []
  const { apply } = await import('../index.js')
  apply(
    {
      inject: (deps, callback) => {
        callback({
          typert: { register: () => () => {} },
          reflect: { provide: (name, value) => { provided.push({ name, value }); return () => {} } },
          effect: () => {},
          inject: (innerDeps, innerCallback) => innerCallback({ configEditor }),
        })
      },
    },
    { hours: 2, days: 0 },
  )
  const service = provided[0].value
  assert.deepEqual(await service.config(), { hours: 2, days: 0, writable: true })
  await service.setConfig({ hours: 3, days: 0 })
  assert.deepEqual(edits, ['include:dsh-desktop-token-usage'])
})

test('without a Loader config editor the config endpoints degrade honestly', async () => {
  const provided = []
  const { apply } = await import('../index.js')
  apply({
    inject: (deps, callback) => {
      callback({
        typert: { register: () => () => {} },
        reflect: { provide: (name, value) => { provided.push({ name, value }); return () => {} } },
        effect: () => {},
        inject: () => {},
      })
    },
  })
  const service = provided[0].value
  assert.deepEqual(await service.config(), { hours: 0, days: 0, writable: false })
  await assert.rejects(() => service.setConfig({ hours: 1, days: 1 }), /找不到本插件的 Loader 条目/)
})

test('localDayStart snaps to local midnight', () => {
  const noon = new Date(2026, 8, 27, 12, 34, 56).getTime()
  assert.equal(localDayStart(noon), new Date(2026, 8, 27).getTime())
})
