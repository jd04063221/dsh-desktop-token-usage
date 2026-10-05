#!/usr/bin/env node
/**
 * DSH compatibility harness for this plugin's Host half.
 *
 * Answers "does the next DSH still feed this plugin what it reads?" with the
 * target version's own code, not with a mock:
 *
 *   1. writes a session log using that version's own encoders
 *      (`encodeCurrentHeader` / `encodeCurrentEvent`, canonical generation
 *      filename, concatenated zstd frames);
 *   2. folds the same events with that version's own `tokenUsage` projection
 *      (`dsh-token-meter`) and with this plugin's `lib/session-usage.js`;
 *   3. checks every canonical generation name is discovered, that several
 *      generations in one directory resolve to the highest, and that a
 *      subagent header is classified as such.
 *
 * Usage:
 *   node scripts/dsh-compat.mjs <node_modules/@deepseek-ai> <label>
 *
 * Give it a directory holding the DSH packages you want to test, e.g.
 *
 *   mkdir /tmp/dsh-live && cd /tmp/dsh-live
 *   npm install @deepseek-ai/cordis@<cordis of that release> \
 *     @deepseek-ai/dsh-session@<v> @deepseek-ai/dsh-session-format@<v> \
 *     @deepseek-ai/dsh-session-format-catalog@<v> @deepseek-ai/dsh-token-meter@<v>
 *   node <this repo>/scripts/dsh-compat.mjs /tmp/dsh-live/node_modules/@deepseek-ai tested
 *
 * It is deliberately not part of `npm test`: it needs DSH packages, which are
 * not this plugin's dependencies.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import zlib from 'node:zlib'

const dir = process.argv[2]
const label = process.argv[3] ?? path.basename(dir)
const load = (p) => import('file:///' + p)
const { sessionFormatLogFilename } = await load(dir + '/dsh-session-format/lib/index.js')
const { sessionFormatCatalog } = await load(dir + '/dsh-session-format-catalog/lib/index.js')
const { SESSION_FORMAT_VERSION } = await load(dir + '/dsh-session/lib/index.js')
const { tokenUsageProjectionDefinition: projection } = await load(dir + '/dsh-token-meter/lib/types/usage-projection.js')

const home = path.join(os.tmpdir(), 'dsh-compat-home-' + label)
const root = path.join(home, 'sessions')
fs.rmSync(home, { recursive: true, force: true })
process.env.DSH_HOME = home
const plugin = await load('C:/各类工作脚本/dsh-usage/lib/session-usage.js')
const target = plugin
const NL = String.fromCharCode(10)
const frame = (lines) => zlib.zstdCompressSync(Buffer.from(lines.join(NL) + NL))
const headerOf = (id, extra = {}) => JSON.stringify(sessionFormatCatalog.encodeCurrentHeader({ version: SESSION_FORMAT_VERSION, id, createdAt: Date.UTC(2026, 9, 3, 10, 0, 0), isSeeded: false, delegationDepth: 0, ...extra }, 0))
const writeSession = (workspace, id, lines, name) => {
  const d = path.join(root, workspace, id)
  fs.mkdirSync(d, { recursive: true })
  const file = path.join(d, name ?? sessionFormatLogFilename(SESSION_FORMAT_VERSION) + '.zstd')
  fs.writeFileSync(file, Buffer.concat(lines.map((l) => frame([l]))))
  return file
}

// ---- 1. fold equivalence against this version's own projection ----
const at = Date.UTC(2026, 9, 3, 10, 0, 0)
const usage = (i, o, r, w, rs) => ({ inputTokens: i, outputTokens: o, ...(r ? { cacheReadTokens: r } : {}), ...(w ? { cacheWriteTokens: w } : {}), ...(rs ? { reasoningTokens: rs } : {}) })
const events = [
  { type: 'user/message', data: { source: { kind: 'user', rpcId: 'rpc-1' } } },
  { type: 'turn/start', data: { turn: 1 } },
  { type: 'assistant/attempt', data: { turn: 1, step: 1, stream: [{ type: 'chunk', chunk: { type: 'usage', usage: usage(1000, 50, 4000, 0, 20) } }] } },
  { type: 'assistant/message', data: { turn: 1, step: 1, usage: usage(1200, 80, 5000, 100, 30) } },
  { type: 'llm/retry-started', data: { turn: 1, step: 1 } },
  { type: 'assistant/attempt', data: { turn: 1, step: 1, stream: [{ type: 'chunk', chunk: { type: 'usage', usage: usage(300, 10, 900, 0, 5) } }] } },
  { type: 'turn/end', data: { turn: 1, reason: 'completed' } },
  { type: 'turn/start', data: { turn: 2 } },
  { type: 'assistant/message', data: { turn: 2, step: 1, usage: usage(500, 25, 1500, 0, 0) } },
  { type: 'turn/end', data: { turn: 2, reason: 'completed' } },
]
const sequenced = events.map((e, i) => ({ seq: i + 1, at: at + i * 1000, ...e }))
const encodedEvents = sequenced.map((e) => JSON.stringify(sessionFormatCatalog.encodeCurrentEvent(e)))
const foldFile = writeSession('ws-a', 'sess-fold', [headerOf('sess-fold', { cwd: 'C:\\ws' }), ...encodedEvents], sessionFormatLogFilename(SESSION_FORMAT_VERSION) + '.zstd')
let state = projection.init()
for (const e of sequenced) state = projection.apply(state, e)
const expected = state.totals
const t = target.summarize({ root, useCache: false, now: at + 86_400_000 }).totals
const mine = { uncachedInputTokens: t.buckets[0], outputTokens: t.buckets[1], cacheReadTokens: t.buckets[2], cacheWriteTokens: t.buckets[3] }
const keys = ['uncachedInputTokens', 'outputTokens', 'cacheReadTokens', 'cacheWriteTokens']

// ---- 2. every canonical generation name, one session directory each ----
const names = []
for (let v = 0; v <= SESSION_FORMAT_VERSION; v += 1) {
  for (const suffix of ['', '.zstd']) {
    const n = sessionFormatLogFilename(v) + suffix
    names.push(n)
    writeSession('ws-b', 'gen-' + v + (suffix || '-plain'), [headerOf('gen-' + v)], n)
  }
}
// ---- 3. several generations in one directory: the highest wins, no double count ----
writeSession('ws-c', 'multi', [headerOf('multi')], sessionFormatLogFilename(1) + '.zstd')
writeSession('ws-c', 'multi', [headerOf('multi')], sessionFormatLogFilename(3) + '.zstd')
// ---- 4. a subagent session's header ----
let subagentOk = false
try {
  const subLine = headerOf('sess-sub', { origin: 'subagent', delegationDepth: 0, cwd: 'C:\\ws' })
  writeSession('ws-d', 'sess-sub', [subLine, JSON.stringify(sessionFormatCatalog.encodeCurrentEvent({ seq: 1, at, type: 'turn/end', data: { turn: 1, reason: 'completed' } }))])
  subagentOk = true
} catch (e) { console.log('  subagent header encode failed: ' + e.message) }

const found = target.enumerateSessionFiles(root).map((f) => path.basename(f))
const foundSet = new Set(found)
const multi = target.enumerateSessionFiles(root).filter((f) => f.includes(path.join('ws-c', 'multi'))).map((f) => path.basename(f))
const payload = target.summarize({ root, useCache: false, now: at + 86_400_000 })

console.log('### ' + label + '  (SESSION_FORMAT_VERSION ' + SESSION_FORMAT_VERSION + ')')
console.log('  fold: log written by this version\u2019s encoders (' + path.basename(foldFile) + ', ' + fs.statSync(foldFile).size + ' bytes)')
console.log('    its  tokenUsage : ' + JSON.stringify(expected))
console.log('    plugin buckets  : ' + JSON.stringify(mine))
console.log('    ' + keys.map((k) => k.replace('Tokens', '') + (expected[k] === mine[k] ? '=ok' : '=MISMATCH')).join(' ') + '  turns=' + t.turns + (t.turns === 2 ? ' ok' : ' MISMATCH') + '  reasoning=' + t.buckets[4] + '  requests=' + t.requests)
console.log('  naming: ' + names.filter((n) => foundSet.has(n)).length + '/' + names.length + ' canonical generation names discovered (' + found.length + ' sessions total)')
const highest = sessionFormatLogFilename(3) + '.zstd'
console.log('  multi-generation dir resolves to: ' + JSON.stringify(multi) + (multi.length === 1 && multi[0] === highest ? '  ok (highest wins)' : '  CHECK'))
console.log('  subagent header: ' + (subagentOk ? 'accepted by this version\u2019s encoder; plugin surfaceCounts.subagent=' + payload.coverage.surfaces.subagent : 'not written'))
const pass = keys.every((k) => expected[k] === mine[k]) && t.turns === 2 && names.every((n) => foundSet.has(n)) && multi.length === 1
console.log('  VERDICT: ' + (pass ? 'PASS' : 'FAIL'))
