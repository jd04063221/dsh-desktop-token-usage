/**
 * Host half of the local token-usage dashboard.
 *
 * It publishes one Remote over DSH's official Typert channel — the mechanism the
 * shipped providers use, and the only carrier that survives both an HTTP-served
 * page and the desktop shell's bridged fetch. Nothing here touches the network:
 * the payload is derived entirely from session logs already on this machine.
 *
 * **No imports.** A profile-installed bundle cannot resolve `@deepseek-ai/*`:
 * those packages live inside the DSH installation, not in the profile's
 * `node_modules`, so `import { TypertRemoteService } from …` fails the whole
 * entry with ERR_MODULE_NOT_FOUND. The base class only wraps two public calls
 * (`ctx.reflect.provide` plus a frozen `typertRemote` binding), so both are made
 * here directly and the module stays dependency-free.
 */
import fs from 'node:fs'
import path from 'node:path'

import { DSH_HOME, summarize } from './lib/session-usage.js'

/** The npm package identity both faces claim. */
const REMOTE_PACKAGE = 'dsh-token-usage'
/** The Cordis service key the gateway resolves this Remote from. */
const REMOTE_SERVICE = 'dshTokenUsage'
/** The wire namespace every endpoint shares. */
const REMOTE_NAMESPACE = 'dshUsage'

/**
 * A bounded record of the last calls, written next to the index cache. When the
 * dashboard shows nothing, this file answers the first question — did the
 * browser reach the Host at all — without needing the page console.
 */
const CALL_LOG = path.join(DSH_HOME, 'cache', 'dsh-token-usage', 'calls.json')
const BOOT_LOG = path.join(DSH_HOME, 'cache', 'dsh-token-usage', 'boot.json')
const CALL_LOG_LIMIT = 20
const calls = []

function writeJson(file, value) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, JSON.stringify(value))
  } catch {
    // Diagnostics must never fail a call.
  }
}

function recordCall(entry) {
  calls.push(entry)
  if (calls.length > CALL_LOG_LIMIT) calls.shift()
  writeJson(CALL_LOG, { updatedAt: Date.now(), calls })
}

const SURFACES = ['client', 'cli', 'subagent', 'none']

/**
 * Accept the browser's filter loosely: an absent filter means "everything", and
 * anything malformed degrades to a default rather than failing the call. Day
 * keys are compared as strings, so only their shape is enforced.
 */
function parseFilter(value) {
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'object' || Array.isArray(value)) throw new TypeError('dshUsage/summary filter: not an object')
  const day = (candidate) => (typeof candidate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(candidate) ? candidate : null)
  const sources = Array.isArray(value.sources)
    ? value.sources.filter((source) => typeof source === 'string' && SURFACES.includes(source))
    : null
  return {
    sinceDay: day(value.sinceDay),
    untilDay: day(value.untilDay),
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
  return value
}

const codec = (typeSymbol, parse) => ({ mode: 'strict', typeSymbol, create: () => ({ parse }) })

const SUMMARY_DESCRIPTOR = {
  id: `${REMOTE_PACKAGE}#${REMOTE_NAMESPACE}/summary`,
  service: REMOTE_SERVICE,
  namespace: REMOTE_NAMESPACE,
  method: 'summary',
  invocation: { kind: 'direct' },
  parameters: [
    {
      name: 'filter',
      wire: 'filter',
      source: 'json',
      codec: codec(`${REMOTE_PACKAGE}#UsageFilter`, parseFilter),
      acceptsUndefined: true,
    },
  ],
  result: codec(`${REMOTE_PACKAGE}#UsageSummary`, parseSummary),
}

/**
 * The Remote receiver. Methods live on the prototype because the gateway reads
 * them with `Reflect.get`, and the service carries the frozen `typertRemote`
 * binding its `validateBinding` step requires — the same shape
 * `TypertRemoteService` would have stamped.
 */
class UsageService {
  /** Token usage rolled up for one filter; see lib/session-usage.js. */
  async summary(filter) {
    const started = Date.now()
    const accepted = parseFilter(filter)
    try {
      const payload = summarize({
        sinceDay: accepted?.sinceDay ?? null,
        untilDay: accepted?.untilDay ?? null,
        sources: accepted?.sources ?? null,
      })
      recordCall({
        at: started,
        filter: accepted ?? null,
        sessions: payload.totals.sessions,
        totalTokens: payload.totals.totalTokens,
        days: payload.days.length,
        models: payload.models.length,
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
 * Register the service and its descriptor. Both registrations are tied to this
 * fiber's lifetime, so unloading the plugin withdraws the endpoint.
 */
export function apply(ctx) {
  const boot = { appliedAt: Date.now() }
  writeJson(BOOT_LOG, boot)
  ctx.inject(['typert'], (remoteCtx) => {
    boot.injectedAt = Date.now()
    try {
      const service = new UsageService()
      service.typertRemote = Object.freeze({ service, serviceKey: REMOTE_SERVICE, namespace: REMOTE_NAMESPACE })
      remoteCtx.reflect.provide(REMOTE_SERVICE, service)
      boot.providedAt = Date.now()

      const unregister = remoteCtx.typert.register({
        package: REMOTE_PACKAGE,
        face: 'host',
        schemas: [],
        model: { services: [], events: [], objects: [] },
        invocations: [SUMMARY_DESCRIPTOR],
      })
      boot.registeredAt = Date.now()
      remoteCtx.effect(() => () => void unregister(), 'dsh-token-usage: usage remote')
    } catch (error) {
      boot.error = error?.message ?? String(error)
    }
    writeJson(BOOT_LOG, boot)
  })
}
