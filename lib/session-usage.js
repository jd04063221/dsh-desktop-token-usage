/**
 * Pure host-side aggregation of DSH session logs into token-usage rollups.
 *
 * No DSH imports: this module is plain Node so it can be unit-tested and run
 * standalone. The plugin's `index.js` only exposes it over the Remote channel.
 *
 * Two facts drive the design, both verified against DSH 0.1.7-rc.2:
 *
 *  1. `session.vN.jsonl.zstd` is a container of **many concatenated zstd
 *     frames** (one per persistence flush, checksummed). `zlib.zstdDecompressSync`
 *     and `createZstdDecompress()` stop after the first frame, so frames are
 *     located structurally (without decompressing) and each slice is inflated on
 *     its own. Their boundaries cannot be found by searching for the magic bytes:
 *     the same four bytes occur inside compressed blocks.
 *
 *  2. Usage lives only on `assistant/message` (with an `assistant/attempt` stream
 *     fallback) as `data.usage.{inputTokens,outputTokens,cacheReadTokens,
 *     cacheWriteTokens,reasoningTokens}`. A later usage record for the **same
 *     (turn, step)** *replaces* the earlier one — the streaming figure is settled
 *     by the final one — unless an `llm/retry-started` closed the slot first.
 *     The total is therefore a fold, not a sum. `reasoningTokens` is a subset of
 *     `outputTokens` and must never be added.
 *
 * `inputTokens` is the *cache-missing* input (DSH's own projection renames it
 * `uncachedInputTokens`), so total = input + output + cacheRead + cacheWrite.
 *
 * Filtering happens here, not in the view: the browser half only renders what
 * this module returns, so the rollup math exists exactly once.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import zlib from 'node:zlib'

// ── locations ────────────────────────────────────────────────────────────────

export const DSH_HOME = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
export const SESSIONS_ROOT = path.join(DSH_HOME, 'sessions')
export const CACHE_FILE = path.join(DSH_HOME, 'cache', 'dsh-token-usage', 'sessions-index.json')

// ── bucket layout (fixed order; bump CACHE_VERSION when semantics change) ────

export const BUCKETS = ['uncachedInput', 'output', 'cacheRead', 'cacheWrite', 'reasoning']
export const CACHE_VERSION = 1

const EMPTY = () => [0, 0, 0, 0, 0]
const addInto = (target, source) => {
  for (let i = 0; i < 5; i += 1) target[i] += source[i]
}
const num = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : 0)

/** `input + output + cacheRead + cacheWrite`; reasoning is already inside output. */
export const totalOf = (buckets) => num(buckets[0]) + num(buckets[1]) + num(buckets[2]) + num(buckets[3])

// ── concatenated-zstd-frame reading ──────────────────────────────────────────

const ZSTD_MAGIC = 0xfd2fb528 // little-endian read of 28 B5 2F FD

/**
 * Walk the frame structure of a concatenated-zstd buffer and return each frame's
 * byte range without decompressing anything. Mirrors the scan in
 * `@deepseek-ai/dsh-session-persistence-jsonl` (`src/zstd.ts`).
 *
 * @returns {{frames: {start: number, end: number}[], tornStart: number|undefined}}
 *   `tornStart` marks a trailing frame cut short by an in-flight append.
 */
export function scanZstdFrames(buffer, maxFrames = Number.POSITIVE_INFINITY) {
  const frames = []
  let offset = 0
  while (offset < buffer.length) {
    const start = offset
    if (buffer.length - offset < 4) return { frames, tornStart: start }
    if (buffer.readUInt32LE(offset) !== ZSTD_MAGIC) {
      throw new Error(`corrupt zstd session log: bad frame magic at byte ${offset}`)
    }
    offset += 4
    if (offset === buffer.length) return { frames, tornStart: start }
    const descriptor = buffer.readUInt8(offset)
    offset += 1
    if ((descriptor & 24) !== 0) throw new Error(`corrupt zstd session log: reserved header bit at byte ${offset - 1}`)
    const contentSizeFlag = descriptor >>> 6
    const singleSegment = (descriptor & 32) !== 0
    const hasChecksum = (descriptor & 4) !== 0
    const dictionaryFlag = descriptor & 3
    const dictionaryBytes = dictionaryFlag === 3 ? 4 : dictionaryFlag
    const contentSizeBytes = contentSizeFlag === 0 ? (singleSegment ? 1 : 0) : 1 << contentSizeFlag
    const remainingHeaderBytes = (singleSegment ? 0 : 1) + dictionaryBytes + contentSizeBytes
    if (buffer.length - offset < remainingHeaderBytes) return { frames, tornStart: start }
    offset += remainingHeaderBytes
    for (;;) {
      if (buffer.length - offset < 3) return { frames, tornStart: start }
      const blockHeader = buffer.readUIntLE(offset, 3)
      offset += 3
      const lastBlock = (blockHeader & 1) !== 0
      const blockType = (blockHeader >>> 1) & 3
      const blockSize = blockHeader >>> 3
      if (blockType === 3) throw new Error(`corrupt zstd session log: reserved block type at byte ${offset - 3}`)
      const payloadBytes = blockType === 1 ? 1 : blockSize
      if (buffer.length - offset < payloadBytes) return { frames, tornStart: start }
      offset += payloadBytes
      if (lastBlock) break
    }
    if (hasChecksum) {
      if (buffer.length - offset < 4) return { frames, tornStart: start }
      offset += 4
    }
    frames.push({ start, end: offset })
    if (frames.length === maxFrames) return { frames }
  }
  return { frames }
}

/** Decompress every frame and parse each JSONL line. */
export function readSessionRecords(file) {
  const buffer = fs.readFileSync(file)
  const { frames, tornStart } = scanZstdFrames(buffer)
  const records = []
  let unparsable = 0
  for (const frame of frames) {
    const text = zlib.zstdDecompressSync(buffer.subarray(frame.start, frame.end)).toString('utf8')
    for (const line of text.split('\n')) {
      if (!line) continue
      try {
        records.push(JSON.parse(line))
      } catch {
        unparsable += 1
      }
    }
  }
  return { records, frames: frames.length, unparsable, torn: tornStart !== undefined }
}

/**
 * Enumerate every session log. Layout:
 * `<root>/<workspace-slug>/<session-id>/session[.vN].jsonl[.zstd]`.
 * A session directory may hold several generations; the highest wins.
 */
export function enumerateSessionFiles(root = SESSIONS_ROOT) {
  const out = []
  if (!fs.existsSync(root)) return out
  for (const workspace of fs.readdirSync(root, { withFileTypes: true })) {
    if (!workspace.isDirectory()) continue
    const workspaceDir = path.join(root, workspace.name)
    for (const session of fs.readdirSync(workspaceDir, { withFileTypes: true })) {
      if (!session.isDirectory()) continue
      const sessionDir = path.join(workspaceDir, session.name)
      let best = null
      for (const name of fs.readdirSync(sessionDir)) {
        const match = /^session(?:\.v(\d+))?\.jsonl(\.zstd)?$/.exec(name)
        if (!match) continue
        const generation = match[1] === undefined ? 0 : Number(match[1])
        if (!best || generation > best.generation) best = { generation, file: path.join(sessionDir, name) }
      }
      if (best) out.push(best.file)
    }
  }
  return out
}

// ── usage extraction ────────────────────────────────────────────────────────

/** Official `usageOf`: `data.usage`, else the last usage chunk in `data.stream`. */
export function usageOf(record) {
  const data = record.data
  if (!data) return undefined
  if (data.usage !== undefined) return data.usage
  const stream = Array.isArray(data.stream) ? data.stream : []
  for (let i = stream.length - 1; i >= 0; i -= 1) {
    const item = stream[i]
    if (item && item.type === 'chunk' && item.chunk && item.chunk.type === 'usage') return item.chunk.usage
  }
  return undefined
}

const bucketsFrom = (usage) => [
  num(usage.inputTokens),
  num(usage.outputTokens),
  num(usage.cacheReadTokens),
  num(usage.cacheWriteTokens),
  num(usage.reasoningTokens),
]

const sameBuckets = (a, b) => {
  for (let i = 0; i < 5; i += 1) if (a[i] !== b[i]) return false
  return true
}

const routeOf = (record) => {
  const source = record.data?.message?.source
  if (source && typeof source.provider === 'string' && typeof source.model === 'string') {
    return { provider: source.provider, model: source.model, route: `${source.provider}/${source.model}` }
  }
  return undefined
}

/**
 * Fold usage records into `(turn, step)` slots exactly as `dsh-token-meter`'s
 * `tokenUsage` projection does.
 *
 * @returns {{totals: number[], entries: object[], requests: number}} `entries`
 *   holds one settled model call per slot, each already attributed to the record
 *   that produced the final figure.
 */
export function foldUsage(records) {
  const totals = EMPTY()
  const entries = []
  let last = null // { turn, step, buckets, index }
  let route
  for (const record of records) {
    if (record.type === 'model/selection') {
      const data = record.data
      if (data && typeof data.provider === 'string' && typeof data.model === 'string') {
        route = { provider: data.provider, model: data.model, route: `${data.provider}/${data.model}` }
      }
      continue
    }
    if (record.type === 'llm/retry-started') {
      if (last && last.turn === num(record.data?.turn) && last.step === num(record.data?.step)) last = null
      continue
    }
    if (record.type !== 'assistant/message' && record.type !== 'assistant/attempt') continue
    const usage = usageOf(record)
    if (usage === undefined) continue
    const own = routeOf(record)
    if (own) route = own
    const turn = num(record.data?.turn)
    const step = num(record.data?.step)
    const buckets = bucketsFrom(usage)
    const previous = last && last.turn === turn && last.step === step ? last.buckets : undefined
    if (previous !== undefined && sameBuckets(previous, buckets)) continue
    const time = num(record.time)
    const label = route ?? { provider: 'unknown', model: 'unknown', route: 'unknown' }
    if (previous !== undefined) {
      for (let i = 0; i < 5; i += 1) totals[i] += buckets[i] - previous[i]
      const entry = entries[last.index]
      entry.buckets = buckets
      entry.time = time || entry.time
      entry.provider = label.provider
      entry.model = label.model
      entry.route = label.route
    } else {
      for (let i = 0; i < 5; i += 1) totals[i] += buckets[i]
      entries.push({ time, turn, step, provider: label.provider, model: label.model, route: label.route, buckets })
    }
    last = { turn, step, buckets, index: previous !== undefined ? last.index : entries.length - 1 }
  }
  return { totals, entries, requests: entries.length }
}

/**
 * Infer a session's origin from locally observable signals only. DSH 0.1.7-rc.2
 * stores no client-surface field, so `client` cannot be split into desktop vs
 * web, and `cli` covers every client-less driver (headless, SDK, ACP, bots).
 */
export function inferSurface(header, records) {
  if (header.origin === 'subagent' || num(header.delegationDepth) > 0) return 'subagent'
  let userTurns = 0
  let withClient = 0
  for (const record of records) {
    if (record.type !== 'user/message') continue
    const source = record.data?.source
    if (!source || (source.kind !== 'user' && source.kind !== 'user-approval')) continue
    userTurns += 1
    if (source.rpcId) withClient += 1
  }
  if (userTurns === 0) return 'none'
  return withClient > 0 ? 'client' : 'cli'
}

// ── per-session summary ─────────────────────────────────────────────────────

/** Local-timezone `YYYY-MM-DD`; `toISOString` would shift the day in UTC+8. */
export function dayKey(ms) {
  const date = new Date(ms)
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function summarizeRecords(records) {
  const header = records.find((record) => record.type === 'session') ?? {}
  const { totals, entries, requests } = foldUsage(records)
  const days = new Map()
  const dayOf = (key) => {
    let day = days.get(key)
    if (!day) {
      day = { day: key, buckets: EMPTY(), turns: 0, requests: 0, byModel: new Map() }
      days.set(key, day)
    }
    return day
  }
  for (const entry of entries) {
    const day = dayOf(dayKey(entry.time))
    day.requests += 1
    addInto(day.buckets, entry.buckets)
    let model = day.byModel.get(entry.route)
    if (!model) {
      model = EMPTY()
      day.byModel.set(entry.route, model)
    }
    addInto(model, entry.buckets)
  }
  // Turns count as activity even when no tokens were billed (imported histories).
  let turns = 0
  for (const record of records) {
    if (record.type !== 'turn/end') continue
    turns += 1
    dayOf(dayKey(num(record.time))).turns += 1
  }
  const times = records.map((record) => num(record.time)).filter((time) => time > 0)
  let title
  for (let i = records.length - 1; i >= 0; i -= 1) {
    if (records[i].type === 'session/title' && typeof records[i].data?.title === 'string') {
      title = records[i].data.title
      break
    }
  }
  return {
    header,
    totals,
    requests,
    turns,
    days,
    firstTime: times.length ? Math.min(...times) : 0,
    lastTime: times.length ? Math.max(...times) : 0,
    title,
    surface: inferSurface(header, records),
  }
}

/** Read one session log into a JSON-safe summary (the cache unit). */
export function summarizeFile(file) {
  const stat = fs.statSync(file)
  const { records, frames, unparsable, torn } = readSessionRecords(file)
  const summary = summarizeRecords(records)
  const header = summary.header
  const relative = path.relative(SESSIONS_ROOT, file)
  return {
    fingerprint: `${stat.mtimeMs}:${stat.size}`,
    frames,
    unparsable,
    torn,
    sessionId: typeof header.id === 'string' ? header.id : path.basename(path.dirname(file)),
    createdAt: num(header.createdAt),
    cwd: typeof header.cwd === 'string' ? header.cwd : undefined,
    workspace: relative.split(path.sep)[0] ?? '',
    surface: summary.surface,
    parentSession: typeof header.parentSession === 'string' ? header.parentSession : undefined,
    title: summary.title,
    firstTime: summary.firstTime,
    lastTime: summary.lastTime,
    turns: summary.turns,
    requests: summary.requests,
    totals: summary.totals,
    days: [...summary.days.values()].map((day) => ({
      day: day.day,
      buckets: day.buckets,
      turns: day.turns,
      requests: day.requests,
      byModel: Object.fromEntries(day.byModel),
    })),
  }
}

// ── index + persisted cache ─────────────────────────────────────────────────

function loadStore() {
  try {
    const parsed = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'))
    if (parsed && parsed.version === CACHE_VERSION && parsed.entries) return parsed
  } catch {
    // A missing or unreadable cache is simply a cold start.
  }
  return { version: CACHE_VERSION, entries: {} }
}

function saveStore(entries) {
  try {
    fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true })
    fs.writeFileSync(CACHE_FILE, JSON.stringify({ version: CACHE_VERSION, entries }))
  } catch {
    // A cache write failure must never fail the request.
  }
}

/** In-process memo, so one warm process never re-reads the store from disk. */
let warm = null

/**
 * Read every session log into per-session summaries, reusing unchanged ones.
 * A session log grows by appending, so `(mtimeMs, size)` is a sound identity.
 */
export function buildIndex({ root = SESSIONS_ROOT, useCache = true } = {}) {
  const files = enumerateSessionFiles(root)
  if (useCache && warm && warm.root === root) {
    let fresh = warm.files.length === files.length
    if (fresh) {
      for (let i = 0; i < files.length; i += 1) {
        if (warm.files[i].file !== files[i]) {
          fresh = false
          break
        }
        const stat = fs.statSync(files[i])
        if (warm.files[i].fingerprint !== `${stat.mtimeMs}:${stat.size}`) {
          fresh = false
          break
        }
      }
    }
    if (fresh) return warm
  }

  const store = useCache ? loadStore() : { entries: {} }
  const entries = {}
  const sessions = []
  const fileList = []
  let changed = false
  let skipped = 0
  for (const file of files) {
    const stat = fs.statSync(file)
    const fingerprint = `${stat.mtimeMs}:${stat.size}`
    fileList.push({ file, fingerprint })
    const cached = store.entries[file]
    let summary
    if (cached && cached.fingerprint === fingerprint && cached.summary) {
      summary = cached.summary
    } else {
      try {
        summary = summarizeFile(file)
      } catch {
        skipped += 1
        continue
      }
      changed = true
    }
    entries[file] = { fingerprint, summary }
    sessions.push(summary)
  }
  if (useCache && (changed || Object.keys(store.entries).length !== Object.keys(entries).length)) {
    saveStore(entries)
  }
  warm = { root, files: fileList, sessions, skipped, builtAt: Date.now() }
  return warm
}

/** Forget the in-process memo (tests, and an explicit refresh). */
export function clearIndexCache() {
  warm = null
}

// ── filtered rollup (the wire payload) ──────────────────────────────────────

/**
 * Roll the index up for one filter. This is the single implementation of the
 * math; the browser half never re-derives any of it.
 *
 * @param {{root?: string, useCache?: boolean, sinceDay?: string|null,
 *          untilDay?: string|null, sources?: string[]|null, now?: number}} options
 */
export function summarize({
  root = SESSIONS_ROOT,
  useCache = true,
  sinceDay = null,
  untilDay = null,
  sources = null,
  now = Date.now(),
} = {}) {
  const started = now
  const index = buildIndex({ root, useCache })
  const wanted = sources && sources.length > 0 ? new Set(sources) : null

  const totals = EMPTY()
  const dayMap = new Map()
  const modelMap = new Map()
  const surfaceCounts = { client: 0, cli: 0, subagent: 0, none: 0 }
  let sessions = 0
  let turns = 0
  let requests = 0
  let firstTime = 0
  let lastTime = 0

  for (const session of index.sessions) {
    if (wanted && !wanted.has(session.surface)) continue
    const days = session.days.filter(
      (day) => (sinceDay === null || day.day >= sinceDay) && (untilDay === null || day.day <= untilDay),
    )
    if (days.length === 0) continue
    sessions += 1
    surfaceCounts[session.surface] = (surfaceCounts[session.surface] ?? 0) + 1
    for (const day of days) {
      turns += day.turns
      requests += day.requests
      addInto(totals, day.buckets)
      let target = dayMap.get(day.day)
      if (!target) {
        target = { day: day.day, buckets: EMPTY(), turns: 0, requests: 0, byModel: new Map() }
        dayMap.set(day.day, target)
      }
      addInto(target.buckets, day.buckets)
      target.turns += day.turns
      target.requests += day.requests
      for (const [route, buckets] of Object.entries(day.byModel)) {
        let model = target.byModel.get(route)
        if (!model) {
          model = EMPTY()
          target.byModel.set(route, model)
        }
        addInto(model, buckets)
        let global = modelMap.get(route)
        if (!global) {
          global = EMPTY()
          modelMap.set(route, global)
        }
        addInto(global, buckets)
      }
    }
    if (session.firstTime > 0) firstTime = firstTime === 0 ? session.firstTime : Math.min(firstTime, session.firstTime)
    if (session.lastTime > 0) lastTime = Math.max(lastTime, session.lastTime)
  }

  const days = [...dayMap.values()]
    .sort((a, b) => (a.day < b.day ? -1 : 1))
    .map((day) => ({
      day: day.day,
      buckets: day.buckets,
      turns: day.turns,
      requests: day.requests,
      byModel: Object.fromEntries(day.byModel),
    }))
  const models = [...modelMap.entries()]
    .map(([route, buckets]) => {
      const slash = route.indexOf('/')
      return {
        route,
        provider: slash > 0 ? route.slice(0, slash) : route,
        model: slash > 0 ? route.slice(slash + 1) : route,
        buckets,
        totalTokens: totalOf(buckets),
      }
    })
    .sort((a, b) => b.totalTokens - a.totalTokens || (a.route < b.route ? -1 : 1))

  const cacheRead = totals[2]
  const uncachedInput = totals[0]
  const totalTokens = totalOf(totals)
  return {
    version: CACHE_VERSION,
    generatedAt: Date.now(),
    elapsedMs: Date.now() - started,
    filter: { sinceDay, untilDay, sources: sources && sources.length > 0 ? [...sources] : null },
    coverage: {
      files: index.files.length,
      skipped: index.skipped,
      firstTime: firstTime || null,
      lastTime: lastTime || null,
      surfaces: surfaceCounts,
    },
    totals: {
      buckets: totals,
      totalTokens,
      cacheHitRate: cacheRead + uncachedInput > 0 ? cacheRead / (cacheRead + uncachedInput) : 0,
      sessions,
      turns,
      requests,
      activeDays: days.filter((day) => totalOf(day.buckets) > 0 || day.turns > 0).length,
      topModel: models.length > 0 ? models[0].route : null,
    },
    days,
    models,
  }
}
