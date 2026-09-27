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

import {
  buildIndex,
  clearIndexCache,
  dayKey,
  enumerateSessionFiles,
  foldUsage,
  readSessionRecords,
  scanZstdFrames,
  summarize,
  totalOf,
} from '../lib/session-usage.js'

const GOLDEN_SESSION = 'session-5964a5d3-...'
const PROJECTION_CACHE = path.join(
  os.homedir(),
  '.dsh',
  'storages',
  'session_projcache',
  'sessions',
  `${GOLDEN_SESSION}.json`,
)
const SESSIONS = path.join(os.homedir(), '.dsh', 'sessions')
const haveSessions = fs.existsSync(SESSIONS)

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

test('folded totals match the Harness projection for a real session', { skip: !haveSessions || !fs.existsSync(PROJECTION_CACHE) }, () => {
  const expected = JSON.parse(fs.readFileSync(PROJECTION_CACHE, 'utf8')).record.rows.tokenUsage.val.totals
  const file = enumerateSessionFiles().find((candidate) => readSessionRecords(candidate).records[0]?.id === GOLDEN_SESSION)
  assert.ok(file, `session log for ${GOLDEN_SESSION} not found`)
  const { totals } = foldUsage(readSessionRecords(file).records)
  assert.deepEqual(totals, [
    expected.uncachedInputTokens,
    expected.outputTokens,
    expected.cacheReadTokens,
    expected.cacheWriteTokens,
    0,
  ])
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

test('day filters partition the total and source filters narrow it', { skip: !haveSessions }, () => {
  clearIndexCache()
  const all = summarize()
  if (all.days.length === 0) return

  // One-day ranges must partition the grand total exactly.
  let partitioned = 0
  let turns = 0
  for (const day of all.days) {
    const single = summarize({ sinceDay: day.day, untilDay: day.day })
    partitioned += single.totals.totalTokens
    turns += single.totals.turns
  }
  assert.equal(partitioned, all.totals.totalTokens, 'per-day ranges must partition the total')
  assert.equal(turns, all.totals.turns)

  // A source filter can only narrow, and an unknown source yields nothing.
  const clients = summarize({ sources: ['client'] })
  assert.ok(clients.totals.totalTokens <= all.totals.totalTokens)
  assert.equal(summarize({ sources: ['nope'] }).totals.totalTokens, 0)
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
  const { apply } = await import('../index.js')
  apply({
    inject: (deps, callback) => {
      assert.deepEqual(deps, ['typert'])
      callback({
        typert: { register: () => () => {} },
        reflect: { provide: (name, value) => { provided.push({ name, value }); return () => {} } },
        effect: () => {},
      })
    },
  })
  assert.equal(provided.length, 1)

  const payload = await provided[0].value.summary({ sinceDay: null, untilDay: null, sources: ['client'] })
  assert.equal(payload.totals.buckets.length, 5)
  assert.ok(payload.totals.sessions > 0)
  assert.ok(payload.days.length > 0)

  // The same call must leave a diagnostic trail the shell can read back.
  const logPath = path.join(process.env.DSH_HOME || path.join(os.homedir(), '.dsh'), 'cache', 'dsh-token-usage', 'calls.json')
  const log = JSON.parse(fs.readFileSync(logPath, 'utf8'))
  const last = log.calls[log.calls.length - 1]
  assert.equal(last.sessions, payload.totals.sessions)
  assert.deepEqual(last.filter, { sinceDay: null, untilDay: null, sources: ['client'] })
})
