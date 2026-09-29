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
 * Rollups are bucketed **by local hour**, so a "last N hours" window is exact to
 * the hour; day views are derived from those hour buckets by this module, never
 * by a view. Filtering happens here too: the browser half only renders.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import zlib from 'node:zlib'

// ── locations ────────────────────────────────────────────────────────────────

export const DSH_HOME = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
export const SESSIONS_ROOT = path.join(DSH_HOME, 'sessions')
export const CACHE_FILE = path.join(DSH_HOME, 'cache', 'dsh-desktop-token-usage', 'sessions-index.json')

// ── bucket layout (fixed order; bump CACHE_VERSION when semantics change) ────

export const BUCKETS = ['uncachedInput', 'output', 'cacheRead', 'cacheWrite', 'reasoning']
export const CACHE_VERSION = 2
export const HOUR_MS = 3_600_000
export const DAY_MS = 86_400_000

const EMPTY = () => [0, 0, 0, 0, 0]
const addInto = (target, source) => {
  for (let i = 0; i < 5; i += 1) target[i] += source[i]
}
const num = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : 0)

/** `input + output + cacheRead + cacheWrite`; reasoning is already inside output. */
export const totalOf = (buckets) => num(buckets[0]) + num(buckets[1]) + num(buckets[2]) + num(buckets[3])

/** Everything the provider was sent: the cache-missing part plus the cached part. */
export const inputOf = (buckets) => num(buckets[0]) + num(buckets[2])

// ── time keys (all local time; `toISOString` would shift the day in UTC+8) ───

const pad = (value) => `${value}`.padStart(2, '0')

/** Local `YYYY-MM-DD` of an instant. */
export function dayKey(ms) {
  const date = new Date(ms)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Local `YYYY-MM-DDTHH` of an instant. */
export function hourKey(ms) {
  const date = new Date(ms)
  return `${dayKey(ms)}T${pad(date.getHours())}`
}

/** Local midnight of the day containing an instant. */
export function localDayStart(ms) {
  const date = new Date(ms)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

/** Local instant at the start of an hour key. */
function hourStart(hour) {
  const [date, time] = hour.split('T')
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day, Number(time)).getTime()
}

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

function summarizeRecords(records) {
  const header = records.find((record) => record.type === 'session') ?? {}
  const { totals, entries, requests } = foldUsage(records)
  const hours = new Map()
  const hourOf = (key) => {
    let hour = hours.get(key)
    if (!hour) {
      hour = { hour: key, buckets: EMPTY(), turns: 0, requests: 0, byModel: new Map() }
      hours.set(key, hour)
    }
    return hour
  }
  for (const entry of entries) {
    const hour = hourOf(hourKey(entry.time))
    hour.requests += 1
    addInto(hour.buckets, entry.buckets)
    let model = hour.byModel.get(entry.route)
    if (!model) {
      model = EMPTY()
      hour.byModel.set(entry.route, model)
    }
    addInto(model, entry.buckets)
  }
  // Turns count as activity even when no tokens were billed (imported histories).
  let turns = 0
  for (const record of records) {
    if (record.type !== 'turn/end') continue
    turns += 1
    hourOf(hourKey(num(record.time))).turns += 1
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
    hours,
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
    hours: [...summary.hours.values()].map((hour) => ({
      hour: hour.hour,
      buckets: hour.buckets,
      turns: hour.turns,
      requests: hour.requests,
      byModel: Object.fromEntries(hour.byModel),
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
 * An hour belongs to a range when it overlaps it. Windows are therefore aligned
 * to whole hours — the resolution the sidebar window selector offers.
 */
const hourInRange = (hour, sinceMs, untilMs) => {
  if (sinceMs === null && untilMs === null) return true
  const start = hourStart(hour)
  if (sinceMs !== null && start + HOUR_MS <= sinceMs) return false
  if (untilMs !== null && start >= untilMs) return false
  return true
}

/** Columns a calendar heatmap shows; GitHub's number, and a comfortable width. */
export const HEATMAP_WEEKS = 53

/** Local midnight of the Monday starting the week that contains an instant. */
export function weekStart(ms) {
  const day = new Date(ms).getDay() // 0 = Sunday
  return localDayStart(ms) - ((day + 6) % 7) * DAY_MS
}

/**
 * Calendar history for the heatmap. It follows the **source** filter but never
 * the time range: a calendar narrowed to seven days is seven lit cells in a
 * year-long grid, which is exactly what a heatmap is not for.
 */
function heatmapOf(index, wanted, now) {
  const firstWeek = weekStart(now - (HEATMAP_WEEKS - 1) * 7 * DAY_MS)
  const byDay = new Map()
  for (const session of index.sessions) {
    if (wanted && !wanted.has(session.surface)) continue
    for (const hour of session.hours) {
      if (!hourInRange(hour.hour, firstWeek, null)) continue
      const key = hour.hour.slice(0, 10)
      let day = byDay.get(key)
      if (!day) {
        day = { day: key, buckets: EMPTY(), turns: 0, requests: 0 }
        byDay.set(key, day)
      }
      addInto(day.buckets, hour.buckets)
      day.turns += hour.turns
      day.requests += hour.requests
    }
  }
  return [...byDay.values()]
    .sort((a, b) => (a.day < b.day ? -1 : 1))
    .map((day) => ({
      day: day.day,
      tokens: totalOf(day.buckets),
      turns: day.turns,
      requests: day.requests,
    }))
}

/**
 * Roll the index up for one range. This is the single implementation of the
 * math; the browser half never re-derives any of it.
 *
 * @param {{root?: string, useCache?: boolean, sinceMs?: number|null,
 *          untilMs?: number|null, sources?: string[]|null, now?: number}} options
 */
export function summarize({
  root = SESSIONS_ROOT,
  useCache = true,
  sinceMs = null,
  untilMs = null,
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
    const hours = session.hours.filter((hour) => hourInRange(hour.hour, sinceMs, untilMs))
    if (hours.length === 0) continue
    sessions += 1
    surfaceCounts[session.surface] = (surfaceCounts[session.surface] ?? 0) + 1
    for (const hour of hours) {
      turns += hour.turns
      requests += hour.requests
      addInto(totals, hour.buckets)
      let day = dayMap.get(hour.hour.slice(0, 10))
      if (!day) {
        day = { day: hour.hour.slice(0, 10), buckets: EMPTY(), turns: 0, requests: 0, byModel: new Map() }
        dayMap.set(day.day, day)
      }
      addInto(day.buckets, hour.buckets)
      day.turns += hour.turns
      day.requests += hour.requests
      for (const [route, buckets] of Object.entries(hour.byModel)) {
        let model = day.byModel.get(route)
        if (!model) {
          model = EMPTY()
          day.byModel.set(route, model)
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
    const start = hourStart(hours[0].hour)
    const end = hourStart(hours[hours.length - 1].hour) + HOUR_MS
    if (firstTime === 0 || start < firstTime) firstTime = start
    if (end > lastTime) lastTime = end
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
  return {
    version: CACHE_VERSION,
    generatedAt: Date.now(),
    elapsedMs: Date.now() - started,
    filter: { sinceMs, untilMs, sources: sources && sources.length > 0 ? [...sources] : null },
    coverage: {
      files: index.files.length,
      skipped: index.skipped,
      firstTime: firstTime || null,
      lastTime: lastTime || null,
      surfaces: surfaceCounts,
    },
    totals: {
      buckets: totals,
      totalTokens: totalOf(totals),
      inputTokens: inputOf(totals),
      cacheHitRate: cacheRead + uncachedInput > 0 ? cacheRead / (cacheRead + uncachedInput) : 0,
      sessions,
      turns,
      requests,
      activeDays: days.filter((day) => totalOf(day.buckets) > 0 || day.turns > 0).length,
      topModel: models.length > 0 ? models[0].route : null,
    },
    days,
    models,
    // Independent of the requested range on purpose; see heatmapOf.
    heatmap: { weeks: HEATMAP_WEEKS, days: heatmapOf(index, wanted, now) },
  }
}

// ── configured dashboard windows ────────────────────────────────────────────

/** One card row: the figures a window shows, with nothing derived in the view. */
function cardBlock(id, label, payload) {
  return {
    id,
    label,
    buckets: payload.totals.buckets,
    totalTokens: payload.totals.totalTokens,
    inputTokens: payload.totals.inputTokens,
    outputTokens: payload.totals.buckets[1],
    cacheHitRate: payload.totals.cacheHitRate,
    turns: payload.totals.turns,
    requests: payload.totals.requests,
  }
}

/**
 * Build the configured-window rollup the dashboard renders. `hours` 0 disables
 * the hour window, `days` 0 disables the day window; with both disabled it falls
 * back to the all-time figures it produced before windows existed.
 *
 * The windows are wall-clock recency and deliberately ignore the request's
 * source filter, so the dashboard shows them in a section of their own.
 *
 * @param {{hours: number, days: number}} windows resolved from the plugin config
 * @param {{root?: string, useCache?: boolean, now?: number}} [options]
 */
export function cardRollup(windows, options = {}) {
  const now = options.now ?? Date.now()
  const shared = { root: options.root, useCache: options.useCache, now }
  const hours = Math.max(0, Math.min(23, Math.trunc(windows?.hours ?? 0)))
  const days = Math.max(0, Math.min(30, Math.trunc(windows?.days ?? 0)))
  const blocks = []
  if (hours > 0) {
    blocks.push(cardBlock('hours', `近 ${hours} 小时`, summarize({ ...shared, sinceMs: now - hours * HOUR_MS })))
  }
  if (days > 0) {
    blocks.push(
      cardBlock('days', `近 ${days} 天`, summarize({ ...shared, sinceMs: localDayStart(now - (days - 1) * DAY_MS) })),
    )
  }
  const all = blocks.length === 0 ? cardBlock('all', '累计', summarize({ ...shared })) : null
  return { hours, days, blocks, all }
}
