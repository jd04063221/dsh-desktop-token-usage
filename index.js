/**
 * Host half of the local token-usage dashboard.
 *
 * It publishes one Remote over DSH's official Typert channel — the mechanism the
 * shipped providers use, and the only carrier that survives both an HTTP-served
 * page and the desktop shell's bridged fetch. Nothing here touches the network:
 * the payload is derived entirely from session logs already on this machine.
 *
 * Two constraints shape the code:
 *
 *  - **Only `@deepseek-ai/schemastery` is imported.** A profile-installed bundle
 *    cannot resolve the other `@deepseek-ai/*` packages (they live inside the DSH
 *    installation, not in the profile's `node_modules`), so `TypertRemoteService`
 *    is replaced by the two public calls it wraps — `ctx.reflect.provide` plus a
 *    frozen `typertRemote` binding. Schemastery *is* a declared dependency, which
 *    is what makes the official Config card in Settings → Plugins possible.
 *  - The windows are resolved from that Config, so the browser never has
 *    to know them.
 */
import fs from 'node:fs'
import path from 'node:path'

import Schema from '@deepseek-ai/schemastery'

import { PLUGIN_CACHE_DIR, cardRollup, summarize } from './lib/session-usage.js'

/** npm package name, claimed by both faces: the Remote's package and the Loader row's specifier. */
const REMOTE_PACKAGE = 'dsh-desktop-token-usage'
/** The Loader row's own id, deliberately short and stable: `include:<ROW_ID>`. */
const ROW_ID = 'dsh-desktop-token-usage'
/** The Cordis service key the gateway resolves this Remote from. */
const REMOTE_SERVICE = 'dshTokenUsage'
/** The wire namespace every endpoint shares. */
const REMOTE_NAMESPACE = 'dshUsage'

const SURFACES = ['client', 'cli', 'subagent', 'none']

const GROUP_BY = ['model', 'provider', 'both']
const PALETTES = ['primer', 'cvd', 'muted']
const oneOf = (value, allowed, fallback) => (allowed.includes(value) ? value : fallback)

/**
 * The dashboard's configured-window rollup, editable in Settings → Plugins.
 * `0` disables a window; with both disabled the rollup falls back to the
 * all-time figures.
 */
export const Config = Schema.object({
  hours: Schema.natural()
    .max(23)
    .default(0)
    .description('看板「配置窗口」里最近多少小时的用量（0-23）；0 表示关闭这个窗口。'),
  days: Schema.natural()
    .max(30)
    .default(0)
    .description('看板「配置窗口」里最近多少天的用量（1-30）；0 表示关闭这个窗口。'),
  groupBy: Schema.union(['model', 'provider', 'both'])
    .default('both')
    .description('看板统计口径：按实际模型 / 按 API 供应商 / 都统计（都统计时图表上出现切换 chip）。'),
  palette: Schema.union(['primer', 'cvd', 'muted'])
    .default('primer')
    .description('看板配色：primer（GitHub 默认）/ cvd（色盲友好）/ muted（低饱和）。浅色与深色由系统主题决定。'),
})

/**
 * A bounded record of the last calls, written inside this plugin's own cache
 * directory (see `PLUGIN_CACHE_DIR`). When the dashboard shows nothing, this file
 * answers the first question — did the browser reach the Host at all — without
 * needing the page console.
 *
 * These are diagnostics, not data: setting `DSH_TOKEN_USAGE_DIAG=0` turns every
 * write below off, and the plugin keeps working. The directory is overridable
 * because the test suite runs `apply` too, and these two files are what a human
 * inspects to tell which generation is live.
 */
const DIAG_ENABLED = !/^(0|false|off|no)$/i.test(process.env.DSH_TOKEN_USAGE_DIAG ?? '')
const DIAG_DIR = process.env.DSH_TOKEN_USAGE_DIAG_DIR || PLUGIN_CACHE_DIR
const CALL_LOG = path.join(DIAG_DIR, 'calls.json')
const BOOT_LOG = path.join(DIAG_DIR, 'boot.json')
const CALL_LOG_LIMIT = 20
const calls = []

function writeJson(file, value) {
  if (!DIAG_ENABLED) return
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    // Atomic: write beside the target then rename, so a reader never sees half a
    // file and a killed process cannot leave a truncated one behind.
    const tmp = `${file}.${process.pid}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(value))
    fs.renameSync(tmp, file)
  } catch {
    // Diagnostics must never fail a call.
  }
}

function recordCall(entry) {
  calls.push(entry)
  if (calls.length > CALL_LOG_LIMIT) calls.shift()
  writeJson(CALL_LOG, { updatedAt: Date.now(), calls })
}

/**
 * Accept the browser's filter loosely: an absent filter means "everything", and
 * anything malformed degrades to a default rather than failing the call.
 */
function parseFilter(value) {
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'object' || Array.isArray(value)) throw new TypeError('dshUsage/summary filter: not an object')
  const instant = (candidate) =>
    typeof candidate === 'number' && Number.isFinite(candidate) && candidate > 0 ? candidate : null
  const sources = Array.isArray(value.sources)
    ? value.sources.filter((source) => typeof source === 'string' && SURFACES.includes(source))
    : null
  return {
    sinceMs: instant(value.sinceMs),
    untilMs: instant(value.untilMs),
    sources: sources && sources.length > 0 ? sources : null,
  }
}

/** Structural check on the value crossing the boundary. */
function parseSummary(value) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError('dshUsage/summary result: not an object')
  }
  if (typeof value.totals !== 'object' || value.totals === null) {
    throw new TypeError('dshUsage/summary result: missing totals')
  }
  if (!Array.isArray(value.totals.buckets) || value.totals.buckets.length !== 5) {
    throw new TypeError('dshUsage/summary result: bad totals.buckets')
  }
  if (!Array.isArray(value.days) || !Array.isArray(value.models)) {
    throw new TypeError('dshUsage/summary result: missing days or models')
  }
  if (typeof value.card !== 'object' || value.card === null || !Array.isArray(value.card.blocks)) {
    throw new TypeError('dshUsage/summary result: missing card')
  }
  if (typeof value.heatmap !== 'object' || value.heatmap === null || !Array.isArray(value.heatmap.days)) {
    throw new TypeError('dshUsage/summary result: missing heatmap')
  }
  return value
}

const clamp = (value, max) => {
  const number = typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : 0
  return Math.max(0, Math.min(max, number))
}

const codec = (typeSymbol, parse) => ({ mode: 'strict', typeSymbol, create: () => ({ parse }) })

function descriptor(method, parameters, typeSymbol, parse) {
  return {
    id: `${REMOTE_PACKAGE}#${REMOTE_NAMESPACE}/${method}`,
    service: REMOTE_SERVICE,
    namespace: REMOTE_NAMESPACE,
    method,
    invocation: { kind: 'direct' },
    parameters,
    result: codec(`${REMOTE_PACKAGE}#${typeSymbol}`, parse),
  }
}

const jsonParameter = (name, typeSymbol, parse, acceptsUndefined = false) => ({
  name,
  wire: name,
  source: 'json',
  codec: codec(`${REMOTE_PACKAGE}#${typeSymbol}`, parse),
  acceptsUndefined,
})

const SUMMARY_DESCRIPTOR = descriptor(
  'summary',
  [jsonParameter('filter', 'UsageFilter', parseFilter, true)],
  'UsageSummary',
  parseSummary,
)

/** Both config endpoints answer this shape; the form renders it verbatim. */
function parseConfigView(value) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError('dshUsage/config result: not an object')
  }
  if (typeof value.hours !== 'number' || typeof value.days !== 'number') {
    throw new TypeError('dshUsage/config result: missing hours or days')
  }
  return {
    ...value,
    groupBy: oneOf(value.groupBy, GROUP_BY, 'both'),
    palette: oneOf(value.palette, PALETTES, 'primer'),
  }
}

/** The form save payload: numbers clamped, enums whitelisted, absent keys untouched. */
function parseConfigPatch(value) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError('dshUsage/setConfig patch: not an object')
  }
  const patch = {}
  if (value.hours !== undefined) patch.hours = clamp(value.hours, 23)
  if (value.days !== undefined) patch.days = clamp(value.days, 30)
  if (value.groupBy !== undefined) patch.groupBy = oneOf(value.groupBy, GROUP_BY, 'both')
  if (value.palette !== undefined) patch.palette = oneOf(value.palette, PALETTES, 'primer')
  return patch
}

const CONFIG_DESCRIPTOR = descriptor('config', [], 'UsageConfig', parseConfigView)
const SET_CONFIG_DESCRIPTOR = descriptor(
  'setConfig',
  [jsonParameter('patch', 'UsageConfigPatch', parseConfigPatch)],
  'UsageConfig',
  parseConfigView,
)

/**
 * The Remote receiver. Methods live on the prototype because the gateway reads
 * them with `Reflect.get`, and the service carries the frozen `typertRemote`
 * binding its `validateBinding` step requires — the same shape
 * `TypertRemoteService` would have stamped.
 */
class UsageService {
  constructor(windows) {
    this.windows = windows
    this.configEditor = undefined
  }

  /**
   * Receive the Loader's config editor. Kept optional on purpose: without it the
   * plugin still reports and renders its windows, only the form turns read-only.
   */
  attachConfigEditor(configEditor) {
    this.configEditor = configEditor
  }

  /** This plugin's own Loader row, found in the composed configuration. */
  entry() {
    if (!this.configEditor) return undefined
    const rows = this.configEditor.configuration()
    const mine = rows.find((item) => {
      const options = item.entry?.options
      return options?.name === REMOTE_PACKAGE || item.entry?.id?.includes(ROW_ID)
    })
    return mine?.entry
  }

  /** The windows in force, plus whether the form may write them. */
  async config() {
    return { ...this.windows, writable: this.entry() !== undefined }
  }

  /**
   * Persist new windows through the Loader's own editor, so the value lands in
   * the profile patch rather than in a file this plugin owns. The Loader then
   * restarts this fiber with the new config, which recomputes the windows.
   */
  async setConfig(patch) {
    const next = parseConfigPatch(patch)
    const entry = this.entry()
    if (entry === undefined) throw new Error('找不到本插件的 Loader 条目，无法写入配置')
    await this.configEditor.edit(entry, (current) => ({ ...current, ...next }))
    return { ...this.windows, ...next, writable: true }
  }

  /** Token usage rolled up for one range, plus the configured windows for one config. */
  async summary(filter) {
    const started = Date.now()
    const accepted = parseFilter(filter)
    try {
      const payload = summarize({
        sinceMs: accepted?.sinceMs ?? null,
        untilMs: accepted?.untilMs ?? null,
        sources: accepted?.sources ?? null,
      })
      payload.card = cardRollup(this.windows)
      recordCall({
        at: started,
        filter: accepted ?? null,
        windows: this.windows,
        sessions: payload.totals.sessions,
        totalTokens: payload.totals.totalTokens,
        days: payload.days.length,
        models: payload.models.length,
        cardBlocks: payload.card.blocks.map((block) => block.id),
        elapsedMs: Date.now() - started,
      })
      return payload
    } catch (error) {
      recordCall({ at: started, filter: accepted ?? null, error: error?.message ?? String(error) })
      throw error
    }
  }
}

/**
 * Register the service and its descriptors. Both registrations are tied to this
 * fiber's lifetime, so unloading the plugin withdraws the endpoints.
 */
export function apply(ctx, config) {
  const windows = {
    hours: clamp(config?.hours, 23),
    days: clamp(config?.days, 30),
    groupBy: oneOf(config?.groupBy, GROUP_BY, 'both'),
    palette: oneOf(config?.palette, PALETTES, 'primer'),
  }
  const boot = { appliedAt: Date.now(), windows }
  writeJson(BOOT_LOG, boot)
  ctx.inject(['typert'], (remoteCtx) => {
    boot.injectedAt = Date.now()
    try {
      const service = new UsageService(windows)
      service.typertRemote = Object.freeze({ service, serviceKey: REMOTE_SERVICE, namespace: REMOTE_NAMESPACE })
      remoteCtx.reflect.provide(REMOTE_SERVICE, service)
      boot.providedAt = Date.now()

      // Optional on purpose: a profile without the editor keeps working.
      remoteCtx.inject(['configEditor'], (configCtx) => {
        service.attachConfigEditor(configCtx.configEditor)
      })

      const unregister = remoteCtx.typert.register({
        package: REMOTE_PACKAGE,
        face: 'host',
        schemas: [],
        model: { services: [], events: [], objects: [] },
        invocations: [SUMMARY_DESCRIPTOR, CONFIG_DESCRIPTOR, SET_CONFIG_DESCRIPTOR],
      })
      boot.registeredAt = Date.now()
      remoteCtx.effect(() => () => void unregister(), 'dsh-desktop-token-usage: usage remote')
    } catch (error) {
      boot.error = error?.message ?? String(error)
    }
    writeJson(BOOT_LOG, boot)
  })
}
