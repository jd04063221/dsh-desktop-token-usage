#!/usr/bin/env node
/**
 * probe-sessions.mjs — 只读解析 DSH 会话日志（session.vN.jsonl.zstd）的 token 用量。
 *
 * 为什么不能用现成 API：
 *   DSH 会话日志是「多个 zstd 帧首尾拼接」的容器（每个持久 append 批次一帧，
 *   含校验和）。Node 的 zlib.zstdDecompressSync / createZstdDecompress 只解第一帧。
 *   正确做法 = 先做**不触发解压的结构化帧扫描**定位每帧字节边界（官方
 *   dsh-session-persistence-jsonl 的 scanZstdFrames，见 docs/research/session-token-data.md），
 *   再对每段字节单独 zstdDecompressSync。
 *
 * 用法（在 pwsh 里请加 UTF-8 前缀，避免中文乱码）：
 *   node probe-sessions.mjs types                       # 全局记录类型统计
 *   node probe-sessions.mjs scan  <文件>                # 单文件：帧数 + 类型计数
 *   node probe-sessions.mjs session <文件> [--json]     # 单会话：token/模型/来源详情
 *   node probe-sessions.mjs sample <type> [n]           # 每种类型的样例记录
 *   node probe-sessions.mjs aggregate [--root <dir>] [--exclude-subagents] [--no-cache]
 *   node probe-sessions.mjs perf                        # 全量解析耗时基准
 *
 * 导出（可 import）：
 *   scanZstdFrames, readSessionRecords, enumerateSessionFiles,
 *   foldTokenUsage, sessionSummary, DSH_SESSIONS_ROOT
 */
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import os from 'node:os'

// ───────────────────────── 1. 多帧 zstd 读取 ─────────────────────────

const ZSTD_MAGIC = 0xfd2fb528 // readUInt32LE 视角的 28 B5 2F FD
export const ZSTD_MAGIC_BYTES = Buffer.from([0x28, 0xb5, 0x2f, 0xfd])

/**
 * 结构化定位拼接 zstd 帧的字节范围，**不解压**。
 * 逐字对应 @deepseek-ai/dsh-session-persistence-jsonl 的 src/zstd.ts `scanZstdFrames`。
 * @returns {{frames: {start:number,end:number}[], tornStart: number|undefined}}
 *   frames 为完整帧；tornStart 为末尾被截断（撕裂）帧的起始偏移。
 */
export function scanZstdFrames(buffer, maxFrames = Number.POSITIVE_INFINITY) {
  const frames = []
  let offset = 0
  while (offset < buffer.length) {
    const start = offset
    if (buffer.length - offset < 4) return { frames, tornStart: start }
    if (buffer.readUInt32LE(offset) !== ZSTD_MAGIC) {
      throw new Error(`corrupt Zstandard session log: invalid frame magic at byte ${offset}`)
    }
    offset += 4
    if (offset === buffer.length) return { frames, tornStart: start }
    const descriptor = buffer.readUInt8(offset)
    offset += 1
    if ((descriptor & 24) !== 0) throw new Error(`corrupt Zstandard session log: reserved frame-header bit at byte ${offset - 1}`)
    const contentSizeFlag = descriptor >>> 6
    const singleSegment = (descriptor & 32) !== 0
    const checksum = (descriptor & 4) !== 0
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
      if (blockType === 3) throw new Error(`corrupt Zstandard session log: reserved block type at byte ${offset - 3}`)
      const payloadBytes = blockType === 1 ? 1 : blockSize
      if (buffer.length - offset < payloadBytes) return { frames, tornStart: start }
      offset += payloadBytes
      if (lastBlock) break
    }
    if (checksum) {
      if (buffer.length - offset < 4) return { frames, tornStart: start }
      offset += 4
    }
    frames.push({ start, end: offset })
    if (frames.length === maxFrames) return { frames }
  }
  return { frames }
}

/** 逐帧解压并解析 JSONL。返回全部记录（按磁盘顺序）。 */
export function readSessionRecords(file) {
  const buf = fs.readFileSync(file)
  const { frames, tornStart } = scanZstdFrames(buf)
  const records = []
  for (const frame of frames) {
    const text = zlib.zstdDecompressSync(buf.subarray(frame.start, frame.end)).toString('utf8')
    for (const line of text.split('\n')) if (line.length) records.push(JSON.parse(line))
  }
  return { records, frames: frames.length, bytes: buf.length, tornStart }
}

/** 只读头部：只解第一帧（等同官方 readFirstZstdLine 的语义）。 */
export function readSessionHeader(file) {
  const buf = fs.readFileSync(file)
  const { frames } = scanZstdFrames(buf, 1)
  if (frames.length === 0) throw new Error('no complete frame')
  const f = frames[0]
  const text = zlib.zstdDecompressSync(buf.subarray(f.start, f.end)).toString('utf8')
  return JSON.parse(text.split('\n')[0])
}

export const DSH_SESSIONS_ROOT = path.join(os.homedir(), '.dsh', 'sessions')

/**
 * 枚举全部会话文件。布局：<root>/<workspace-slug>/<session-id>/session.vN.jsonl[.zstd]
 * 同一个会话目录里可能有多个 generation（v0..v4）；取数值最高的一个。
 */
export function enumerateSessionFiles(root = DSH_SESSIONS_ROOT) {
  const out = []
  if (!fs.existsSync(root)) return out
  for (const ws of fs.readdirSync(root, { withFileTypes: true })) {
    if (!ws.isDirectory()) continue
    const wsDir = path.join(root, ws.name)
    for (const sd of fs.readdirSync(wsDir, { withFileTypes: true })) {
      if (!sd.isDirectory()) continue
      const sdDir = path.join(wsDir, sd.name)
      let best = null
      for (const name of fs.readdirSync(sdDir)) {
        const m = /^session(?:\.v(\d+))?\.jsonl(\.zstd)?$/.exec(name)
        if (!m) continue
        const gen = m[1] === undefined ? 0 : Number(m[1])
        if (!best || gen > best.gen) best = { gen, file: path.join(sdDir, name) }
      }
      if (best) out.push(best.file)
    }
  }
  return out
}

// ───────────────────────── 2. token 用量折叠（复刻官方语义）─────────────────────────

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

/** 官方 usage-projection.js: usageOf() —— 优先 data.usage，否则取 stream 里最后一个 usage chunk。 */
export function usageOf(record) {
  if (record.type !== 'assistant/message' && record.type !== 'assistant/attempt') return undefined
  const d = record.data
  if (d && d.usage !== undefined) return d.usage
  const stream = d && Array.isArray(d.stream) ? d.stream : []
  for (let i = stream.length - 1; i >= 0; i -= 1) {
    const r = stream[i]
    if (r && r.type === 'chunk' && r.chunk && r.chunk.type === 'usage') return r.chunk.usage
  }
  return undefined
}

/** 单条 usage → 官方四桶投影（inputTokens 是「未命中缓存」的输入）。 */
export const bucketsFrom = (u) => ({
  uncachedInputTokens: num(u.inputTokens),
  outputTokens: num(u.outputTokens),
  cacheReadTokens: num(u.cacheReadTokens),
  cacheWriteTokens: num(u.cacheWriteTokens),
  reasoningTokens: num(u.reasoningTokens),
})

/**
 * 复刻 dsh-token-meter 的 `tokenUsage` 投影（lib/types/usage-projection.js）。
 * 关键语义：**同一个 (turn, step) 内后一条 usage 会替换前一条**（流式 usage 被最终
 * 结算替换）；`llm/retry-started` 关闭替换槽位，使重试的另一次调用累加。
 * 因此「累计 = 全量求和」是错的，必须用本函数。
 * @returns {{totals: object, byTurn: Map<number, object>, byStep: Array, attempts: number, last: object|null}}
 */
export function foldTokenUsage(records) {
  const zero = () => ({ uncachedInputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, reasoningTokens: 0 })
  const totals = zero()
  const byTurn = new Map()
  const byStep = []
  let last = null
  let attempts = 0
  const addReplacing = (t, prev, next) => {
    t.uncachedInputTokens += next.uncachedInputTokens - (prev ? prev.uncachedInputTokens : 0)
    t.outputTokens += next.outputTokens - (prev ? prev.outputTokens : 0)
    t.cacheReadTokens += next.cacheReadTokens - (prev ? prev.cacheReadTokens : 0)
    t.cacheWriteTokens += next.cacheWriteTokens - (prev ? prev.cacheWriteTokens : 0)
    t.reasoningTokens += next.reasoningTokens - (prev ? prev.reasoningTokens : 0)
  }
  const same = (a, b) => a && b &&
    a.uncachedInputTokens === b.uncachedInputTokens && a.outputTokens === b.outputTokens &&
    a.cacheReadTokens === b.cacheReadTokens && a.cacheWriteTokens === b.cacheWriteTokens &&
    a.reasoningTokens === b.reasoningTokens
  for (const rec of records) {
    if (rec.type === 'llm/retry-started') {
      if (last && last.turn === rec.data?.turn && last.step === rec.data?.step) last = null
      continue
    }
    if (rec.type !== 'assistant/message' && rec.type !== 'assistant/attempt') continue
    const u = usageOf(rec)
    if (u === undefined) continue
    const turn = num(rec.data?.turn)
    const step = num(rec.data?.step)
    const buckets = bucketsFrom(u)
    const prev = last && last.turn === turn && last.step === step ? last.buckets : undefined
    if (!same(prev, buckets)) {
      addReplacing(totals, prev, buckets)
      const t = byTurn.get(turn) || zero()
      addReplacing(t, prev, buckets)
      byTurn.set(turn, t)
      byStep.push({ seq: rec.seq, time: rec.time, turn, step, buckets, replacedPrevious: prev !== undefined })
      attempts += 1
    }
    last = { turn, step, buckets }
  }
  return { totals, byTurn, byStep, attempts, last }
}

/** 官方 usageTokens() 公式：input + cacheRead + cacheWrite + output（reasoning 属于 output，不重复计）。 */
export const totalFromBuckets = (b) =>
  num(b.uncachedInputTokens) + num(b.cacheReadTokens) + num(b.cacheWriteTokens) + num(b.outputTokens)

// ───────────────────────── 3. 模型 / provider / 来源 ─────────────────────────

/** 从 assistant/message 的 message.source 取路由；会话中途换模型会得到多个。 */
function routesOf(records) {
  const counts = new Map()
  for (const rec of records) {
    if (rec.type !== 'assistant/message') continue
    const s = rec.data?.message?.source
    if (!s || !s.provider) continue
    const key = `${s.provider}/${s.model}`
    const e = counts.get(key) || { route: key, provider: s.provider, model: s.model, count: 0, firstTime: rec.time, lastTime: rec.time }
    e.count += 1
    e.lastTime = rec.time
    counts.set(key, e)
  }
  // 显式切换记录（/model 命令）
  for (const rec of records) {
    if (rec.type !== 'model/selection') continue
    const d = rec.data || {}
    const key = `${d.provider}/${d.model}`
    const e = counts.get(key) || { route: key, provider: d.provider, model: d.model, count: 0, firstTime: rec.time, lastTime: rec.time }
    e.explicitSelection = true
    e.reasoningEffort = d.reasoningEffort
    counts.set(key, e)
  }
  return [...counts.values()].sort((a, b) => a.firstTime - b.firstTime)
}

/**
 * 仅凭本地文件推断「会话来源」。DSH 0.1.7-rc.2 的会话 header 里**没有** client-surface
 * 字段（SessionHeader 只有 version/id/createdAt/cwd/parentSession/isSeeded/origin/
 * delegationDepth/agentPreset，且 origin 唯一取值是 'subagent'）。
 * 所以只能用下面的可观测信号推导：
 *   - subagent : header.origin === 'subagent' 或 delegationDepth > 0
 *   - cli      : 存在真实用户轮次但没有客户端 rpcId（headless/SDK/ACP 无客户端）
 *   - client   : 真实用户轮次带 source.rpcId（桌面端或网页端；二者无法再区分）
 *   - none     : 没有任何用户轮次（如仅 slash 命令会话）
 */
export function inferSurface(header, records) {
  const origin = header.origin
  const depth = num(header.delegationDepth)
  if (origin === 'subagent' || depth > 0) return 'subagent'
  let realTurns = 0
  let withRpc = 0
  for (const rec of records) {
    if (rec.type !== 'user/message') continue
    const kind = rec.data?.source?.kind
    if (kind !== 'user' && kind !== 'user-approval') continue
    realTurns += 1
    if (rec.data?.source?.rpcId) withRpc += 1
  }
  if (realTurns === 0) return 'none'
  return withRpc > 0 ? 'client' : 'cli'
}

function turnCounts(records) {
  let starts = 0, ends = 0, steps = 0
  for (const rec of records) {
    if (rec.type === 'turn/start') starts += 1
    else if (rec.type === 'turn/end') ends += 1
    else if (rec.type === 'step/end') steps += 1
  }
  return { turnStarts: starts, turnEnds: ends, closedSteps: steps }
}

/** 一个会话的完整摘要。 */
export function sessionSummary(file, { keepRecords = false } = {}) {
  const { records, frames, bytes, tornStart } = readSessionRecords(file)
  const headerIdx = records.findIndex((r) => r.type === 'session')
  const header = headerIdx >= 0 ? records[headerIdx] : {}
  const body = headerIdx >= 0 ? records.slice(headerIdx + 1) : records
  const fold = foldTokenUsage(records)
  const types = {}
  for (const r of records) types[r.type] = (types[r.type] || 0) + 1
  const times = records.map((r) => r.time).filter((t) => typeof t === 'number')
  const title = records.findLast?.((r) => r.type === 'session/title')?.data?.title
    ?? [...records].reverse().find((r) => r.type === 'session/title')?.data?.title
  const out = {
    file,
    bytes,
    frames,
    torn: tornStart !== undefined,
    records: records.length,
    types,
    header: { id: header.id, version: header.version, createdAt: header.createdAt, cwd: header.cwd, isSeeded: header.isSeeded, delegationDepth: header.delegationDepth, agentPreset: header.agentPreset, origin: header.origin, parentSession: header.parentSession },
    sessionId: header.id,
    workspaceSlug: path.basename(path.dirname(path.dirname(file))),
    createdAt: header.createdAt,
    firstTime: times.length ? Math.min(...times) : undefined,
    lastTime: times.length ? Math.max(...times) : undefined,
    surface: inferSurface(header, records),
    routes: routesOf(records),
    usage: { totals: fold.totals, totalTokens: totalFromBuckets(fold.totals), usageRecords: fold.attempts },
    turns: turnCounts(records),
    title,
  }
  if (keepRecords) out.records_ = records
  return out
}

// ───────────────────────── 4. 缓存 + 全量聚合 ─────────────────────────

const CACHE_DIR = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '.cache')
const CACHE_FILE = path.join(CACHE_DIR, 'probe-sessions-index.json')

function loadCache() {
  try { return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')) } catch { return { version: 1, entries: {} } }
}
function saveCache(cache) {
  fs.mkdirSync(CACHE_DIR, { recursive: true })
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache))
}

/**
 * 全量聚合。按 (mtimeMs, size) 建索引缓存 —— 因为只读文件不会自变，
 * 未变更的文件直接复用上次的 sessionSummary。
 * @param {{root?:string, includeSubagents?:boolean, useCache?:boolean, onProgress?:Function}} opts
 */
export function aggregate({ root = DSH_SESSIONS_ROOT, includeSubagents = true, useCache = true, onProgress } = {}) {
  const files = enumerateSessionFiles(root)
  const cache = useCache ? loadCache() : { version: 1, entries: {} }
  const next = { version: 1, entries: {} }
  const sessions = []
  const t0 = performance.now()
  let cacheHits = 0
  for (let i = 0; i < files.length; i += 1) {
    const file = files[i]
    const st = fs.statSync(file)
    const key = `${st.mtimeMs}:${st.size}`
    const hit = cache.entries[file]
    let summary
    if (hit && hit.key === key) { summary = hit.summary; cacheHits += 1 } else { summary = sessionSummary(file) }
    next.entries[file] = { key, summary }
    if (includeSubagents || summary.surface !== 'subagent') sessions.push(summary)
    if (onProgress) onProgress(i + 1, files.length)
  }
  const elapsedMs = performance.now() - t0
  if (useCache) saveCache(next)

  const totals = { uncachedInputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, reasoningTokens: 0 }
  const byDay = new Map()
  const byModel = new Map()
  const bySurface = new Map()
  const byWorkspace = new Map()
  const byProvider = new Map()
  for (const s of sessions) {
    const u = s.usage.totals
    for (const k of Object.keys(totals)) totals[k] += num(u[k])
    const day = s.createdAt ? new Date(s.createdAt).toISOString().slice(0, 10) : 'unknown'
    const d = byDay.get(day) || { day, sessions: 0, ...{ uncachedInputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, reasoningTokens: 0 } }
    d.sessions += 1
    for (const k of Object.keys(totals)) d[k] += num(u[k])
    byDay.set(day, d)
    bySurface.set(s.surface, (bySurface.get(s.surface) || 0) + 1)
    byWorkspace.set(s.workspaceSlug, (byWorkspace.get(s.workspaceSlug) || 0) + 1)
    // 同一会话内多路由：按 assistant/message 计数比例分摊（无逐条 usage×route 时最合理的近似）
    const routeCounts = s.routes.reduce((a, r) => a + r.count, 0) || 1
    for (const r of s.routes) {
      const share = r.count / routeCounts
      const m = byModel.get(r.route) || { route: r.route, provider: r.provider, model: r.model, sessions: 0, calls: 0, uncachedInputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, reasoningTokens: 0, approx: true }
      m.sessions += 1
      m.calls += r.count
      for (const k of Object.keys(totals)) m[k] += num(u[k]) * share
      byModel.set(r.route, m)
      byProvider.set(r.provider, (byProvider.get(r.provider) || 0) + 1)
    }
  }
  return {
    root, files: files.length, sessions: sessions.length, cacheHits, elapsedMs,
    parseMs: elapsedMs, totals: { ...totals, totalTokens: totalFromBuckets(totals) },
    byDay: [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day)),
    byModel: [...byModel.values()].sort((a, b) => b.cacheReadTokens + b.uncachedInputTokens - (a.cacheReadTokens + a.uncachedInputTokens)),
    bySurface: Object.fromEntries(bySurface),
    byProvider: Object.fromEntries(byProvider),
    byWorkspace: Object.fromEntries([...byWorkspace].sort((a, b) => b[1] - a[1])),
    sessionList: sessions,
  }
}

// ───────────────────────── 5. CLI ─────────────────────────

const argv = process.argv.slice(2)
const cmd = argv[0]
const flag = (name) => argv.includes(name)
const opt = (name, dflt) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : dflt }
const positional = argv.slice(1).filter((a) => !a.startsWith('--'))

function main() {
  if (cmd === 'types') {
    const files = enumerateSessionFiles(opt('--root', DSH_SESSIONS_ROOT))
    const types = new Map()
    const t0 = performance.now()
    for (const f of files) {
      let r; try { r = readSessionRecords(f) } catch (e) { console.error('ERR', f, e.message); continue }
      for (const rec of r.records) types.set(rec.type, (types.get(rec.type) || 0) + 1)
    }
    const ms = performance.now() - t0
    console.log(JSON.stringify({ files: files.length, elapsedMs: +ms.toFixed(1), types: Object.fromEntries([...types].sort((a, b) => b[1] - a[1])) }, null, 2))
    return
  }
  if (cmd === 'scan') {
    const { records, frames, bytes, tornStart } = readSessionRecords(positional[0])
    const types = {}
    for (const r of records) types[r.type] = (types[r.type] || 0) + 1
    console.log(JSON.stringify({ file: positional[0], bytes, frames, torn: tornStart !== undefined, records: records.length, types }, null, 2))
    return
  }
  if (cmd === 'session') {
    const s = sessionSummary(positional[0])
    console.log(JSON.stringify(s, null, 2))
    return
  }
  if (cmd === 'sample') {
    const want = positional[0]
    const limit = Number(positional[1] || 1)
    const seen = new Map()
    for (const f of enumerateSessionFiles(opt('--root', DSH_SESSIONS_ROOT))) {
      let r; try { r = readSessionRecords(f) } catch { continue }
      for (const rec of r.records) {
        if (want && rec.type !== want) continue
        if (!seen.has(rec.type)) seen.set(rec.type, [])
        if (seen.get(rec.type).length < limit) seen.get(rec.type).push({ _file: f, ...rec })
      }
    }
    console.log(JSON.stringify(Object.fromEntries(seen), null, 2))
    return
  }
  if (cmd === 'aggregate') {
    const a = aggregate({
      root: opt('--root', DSH_SESSIONS_ROOT),
      includeSubagents: !flag('--exclude-subagents'),
      useCache: !flag('--no-cache'),
      onProgress: (i, n) => { if (process.stderr.isTTY) process.stderr.write(`\r${i}/${n}`) },
    })
    const { sessionList, ...rest } = a
    console.log(JSON.stringify(rest, null, 2))
    return
  }
  if (cmd === 'perf') {
    const files = enumerateSessionFiles()
    // 冷解析（无缓存）
    const t0 = performance.now()
    let recs = 0
    for (const f of files) { try { recs += readSessionRecords(f).records.length } catch {} }
    const cold = performance.now() - t0
    // 全量聚合（第二次：走缓存）
    const t1 = performance.now()
    const a = aggregate({ includeSubagents: true, useCache: true })
    const warm = performance.now() - t1
    console.log(JSON.stringify({
      files: files.length, records: recs,
      coldParseMs: +cold.toFixed(0), warmAggregateMs: +warm.toFixed(0),
      cacheHits: a.cacheHits, sessions: a.sessions, totalTokens: a.totals.totalTokens,
    }, null, 2))
    return
  }
  console.log(fs.readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 30).map((l) => l.replace(/^ \* ?/, '')).join('\n'))
}

// 仅在直接执行时跑 CLI；被 import 时保持纯库。
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(decodeURIComponent(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')))) main()
