/**
 * Renders this plugin's own components with SAMPLE data into a DOM-ready tree.
 *
 * The live app's web shell needs an authenticated loopback URL, and the desktop
 * window cannot be driven from a script — so README screenshots are taken from
 * the real components + real CSS rendered by the same fake module table the
 * smoke tests use (test/client-smoke.test.mjs mirrors this harness).
 *
 * Output: one JSON file with { css, tokens, trees } for scripts/render-shots.py.
 *
 *   node scripts/render-shots.mjs <out.json>
 */
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.dirname(here)
const out = process.argv[2] || path.join(root, 'assets', 'shots.json')

// ---- fake React (same shape as the smoke-test shim) ------------------------
let hooks = []
let hookIndex = 0
class Component { constructor(props) { this.props = props || {} } }
const React = {
  Component,
  Fragment: Symbol('Fragment'),
  createElement(type, props) {
    const children = Array.prototype.slice.call(arguments, 2)
    return { type, props: Object.assign({}, props || {}, { children: children.length <= 1 ? children[0] : children }) }
  },
  useState(initial) {
    const slot = hookIndex
    hookIndex += 1
    if (hooks[slot] === undefined) hooks[slot] = typeof initial === 'function' ? initial() : initial
    return [hooks[slot], (next) => { hooks[slot] = next }]
  },
  useEffect() {},
  useSyncExternalStore(_subscribe, getSnapshot) { return getSnapshot() },
}
function fakeElement(tag) {
  return {
    dataset: {}, textContent: '', children: [],
    appendChild(child) { this.children.push(child); child.parent = this },
    remove() { if (this.parent) this.parent.children = this.parent.children.filter((c) => c !== this) },
  }
}
const documentShim = { head: fakeElement('head'), createElement: fakeElement }

function render(node) {
  if (node === null || node === undefined || typeof node === 'boolean') return null
  if (Array.isArray(node)) return node.map(render).filter((child) => child !== null)
  if (typeof node === 'function') { hooks = []; hookIndex = 0; return render(node({})) }
  if (typeof node !== 'object') return node
  if (node.type === React.Fragment) return render(node.props.children)
  if (typeof node.type === 'function') {
    hooks = []
    hookIndex = 0
    // Boundary is a class component; everything else is a function component.
    const isClass = node.type.prototype instanceof Component || typeof node.type.prototype?.render === 'function'
    if (!isClass) return render(node.type(node.props))
    const instance = new node.type(node.props)
    instance.props = node.props
    instance.state = instance.state || {}
    try {
      return render(instance.render())
    } catch (error) {
      const derive = node.type.getDerivedStateFromError
      if (typeof derive !== 'function') throw error
      instance.state = Object.assign({}, instance.state, derive(error))
      if (typeof instance.componentDidCatch === 'function') instance.componentDidCatch(error, {})
      return render(instance.render())
    }
  }
  return { tag: node.type, props: node.props, children: render(node.props.children) }
}

// ---- fake Host context ----------------------------------------------------
function fakeContext(summary, config) {
  const record = {}
  const namespace = {
    summary: async () => ({ ok: true, value: summary }),
    config: async () => ({ ok: true, value: config }),
    setConfig: async () => ({ ok: true, value: config }),
  }
  // One slot facade for every context shape, exactly as the shell hands it out.
  const slots = {
    inject: (_owner, cb) => cb(),
    // The shell's register takes (options, component) — keep both.
    register: (options, component) => { record[options.name] = { options, component }; return () => {} },
  }
  const make = (remote) => ({
    remote,
    slots,
    effect: (fn) => { fn() },
    get: () => ({ selectPanel: () => {} }),
    inject: (_deps, cb) => cb(make({ dshUsage: namespace })),
  })
  return { ctx: make({ $mount: async () => () => {} }), record }
}

// ---- SAMPLE data (deliberately synthetic: no real paths, ids or accounts) --
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rnd = mulberry32(20261001)
const DAY = 86400000
const HOUR = 3600000
const pad = (n) => String(n).padStart(2, '0')
const dayKeyOf = (ms) => { const d = new Date(ms); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) }

const MODELS = [
  { route: 'acme-cloud/deepseek-v4-flash', provider: 'acme-cloud', model: 'deepseek-v4-flash' },
  { route: 'acme-cloud/deepseek-v4-pro', provider: 'acme-cloud', model: 'deepseek-v4-pro' },
  { route: 'self-hosted/kimi-k3', provider: 'self-hosted', model: 'kimi-k3' },
  { route: 'edge-gateway/qwen-3-coder', provider: 'edge-gateway', model: 'qwen-3-coder' },
  { route: 'acme-cloud/gpt-classic', provider: 'acme-cloud', model: 'gpt-classic' },
]
const empty = () => [0, 0, 0, 0, 0]
const totals = empty()
const perModel = new Map()
const days = []
const now = Date.now()
const start = now - 44 * DAY

for (let i = 0; i <= 44; i += 1) {
  const ms = start + i * DAY
  const weekend = [0, 6].includes(new Date(ms).getDay())
  const active = weekend ? rnd() < 0.35 : rnd() < 0.92
  if (!active) { days.push({ day: dayKeyOf(ms), buckets: empty(), turns: 0, requests: 0, byModel: {}, byGroup: { model: {}, provider: {} } }); continue }
  const scale = 0.55 + rnd() * 1.9 + (i / 44) * 0.6
  const dayTotals = empty()
  const byModel = {}
  const byGroupModel = {}
  const byGroupProvider = {}
  let turns = 0
  let requests = 0
  for (const entry of MODELS) {
    if (rnd() < 0.45) continue
    const weight = entry.model === 'deepseek-v4-flash' ? 2.4 : 1
    const inTok = Math.round((12000 + rnd() * 90000) * scale * weight)
    const cache = Math.round(inTok * (0.42 + rnd() * 0.5))
    const outTok = Math.round((900 + rnd() * 9000) * scale * weight)
    const buckets = [inTok, outTok, cache, 0, Math.round(outTok * 0.32)]
    for (let b = 0; b < 5; b += 1) { dayTotals[b] += buckets[b]; totals[b] += buckets[b] }
    const modelTotal = buckets[0] + buckets[1] + buckets[2] + buckets[3]
    byModel[entry.route] = buckets
    byGroupModel[entry.model] = (byGroupModel[entry.model] || empty()).map((v, b) => v + buckets[b])
    byGroupProvider[entry.provider] = (byGroupProvider[entry.provider] || empty()).map((v, b) => v + buckets[b])
    const slot = perModel.get(entry.route) || { buckets: empty(), requests: 0, turns: 0 }
    for (let b = 0; b < 5; b += 1) slot.buckets[b] += buckets[b]
    slot.requests += 1 + Math.round(rnd() * 3)
    slot.turns += 1 + Math.round(rnd() * 2)
    perModel.set(entry.route, slot)
    requests += slot.requests ? 1 + Math.round(rnd() * 3) : 1
    turns += 1 + Math.round(rnd() * 2)
  }
  days.push({ day: dayKeyOf(ms), buckets: dayTotals, turns, requests, byModel, byGroup: { model: byGroupModel, provider: byGroupProvider } })
}

const sum = (b) => b[0] + b[1] + b[2] + b[3]
const ranked = (map) => Object.entries(map).map(([key, buckets]) => ({ key, buckets, totalTokens: sum(buckets) })).sort((a, b) => b.totalTokens - a.totalTokens)
const modelMap = {}
const providerMap = {}
for (const day of days) for (const [k, v] of Object.entries(day.byGroup.model)) modelMap[k] = (modelMap[k] || empty()).map((x, b) => x + v[b])
for (const day of days) for (const [k, v] of Object.entries(day.byGroup.provider)) providerMap[k] = (providerMap[k] || empty()).map((x, b) => x + v[b])

const models = [...perModel.entries()]
  .map(([route, slot]) => {
    const found = MODELS.find((m) => m.route === route)
    return { route, provider: found.provider, model: found.model, buckets: slot.buckets, totalTokens: sum(slot.buckets) }
  })
  .sort((a, b) => b.totalTokens - a.totalTokens)

const cardBlock = (id, label, buckets, turns) => {
  // Same rule as the Host: a window with nothing in it reports null, not 0/0.
  const miss = buckets[0] + buckets[2] + buckets[3]
  return {
    id, label, buckets, totalTokens: sum(buckets), inputTokens: buckets[0] + buckets[2], outputTokens: buckets[1],
    cacheHitRate: miss > 0 ? buckets[2] / miss : null, turns, requests: turns,
  }
}
const lastDays = days.slice(-7).reduce((acc, d) => acc.map((v, b) => v + d.buckets[b]), empty())
// A window the user is looking at is rarely empty — sample data should look lived-in.
const last6h = days.slice(-1).reduce((acc, d) => acc.map((v, b) => v + Math.round(d.buckets[b] * 0.22)), empty())
if (sum(last6h) === 0) for (let b = 0; b < 5; b += 1) last6h[b] = Math.round(lastDays[b] * 0.18)
const cacheRead = totals[2]
const hitRate = cacheRead / (totals[0] + cacheRead + totals[3])

const summary = {
  version: 2,
  generatedAt: now,
  elapsedMs: 42,
  filter: { sinceMs: null, untilMs: null, sources: null },
  coverage: { files: 128, skipped: 0, firstTime: start, lastTime: now, surfaces: { client: 96, cli: 22, subagent: 10, none: 0 } },
  totals: {
    buckets: totals, totalTokens: sum(totals), inputTokens: totals[0] + totals[2], cacheHitRate: hitRate,
    sessions: 128, turns: days.reduce((n, d) => n + d.turns, 0), requests: days.reduce((n, d) => n + d.requests, 0),
    activeDays: days.filter((d) => d.turns > 0).length, topModel: models[0].route,
  },
  days,
  models,
  groups: { model: ranked(modelMap), provider: ranked(providerMap) },
  card: { hours: 6, days: 7, blocks: [cardBlock('hours', '近 6 小时', last6h, 3), cardBlock('days', '近 7 天', lastDays, 18)], all: null },
  heatmap: {
    weeks: 53,
    days: days.map((d) => ({ day: d.day, tokens: sum(d.buckets), turns: d.turns, requests: d.requests })),
  },
}

const config = { hours: 6, days: 7, groupBy: 'both', palette: 'primer', writable: true }

// ---- render -----------------------------------------------------------------
const source = fs.readFileSync(path.join(root, 'client.js'), 'utf8')
let registration
const sandbox = {
  window: { __ModuleLoader__: { load: (value) => { registration = value } } },
  document: documentShim,
  console,
  setInterval: () => 1,
  clearInterval: () => {},
  navigator: { language: 'zh-CN', languages: ['zh-CN'] },
  Intl,
  Date,
  Math,
  Number,
  String,
  Object,
  Array,
  JSON,
  RegExp,
  Error,
  Promise,
  setTimeout,
  clearTimeout,
  isNaN,
  parseFloat,
  parseInt,
}
vm.runInNewContext(source, sandbox, { filename: 'client.js' })
const plugin = registration.factory((name) => {
  if (name === 'react') return React
  throw new Error('unexpected module: ' + name)
})
const { ctx, record } = fakeContext(summary, config)
plugin.apply(ctx)
// apply() kicks the summary call off asynchronously: let the store settle before
// rendering, or the dashboard renders its "reading local logs…" note.
await new Promise((resolve) => setTimeout(resolve, 0))

// The style the plugin itself injects (real CSS, real variable names).
const style = documentShim.head.children.find((child) => child.dataset && child.dataset.plugin)
const css = style ? style.textContent : ''

const treeOf = (name) => {
  const entry = record[name]
  if (!entry) throw new Error('slot not registered: ' + name)
  // Not every seat asks for injected props (the config card reads the store itself).
  const props = typeof entry.options.inject === 'function' ? entry.options.inject() : {}
  return render({ type: entry.component, props })
}

const payload = {
  css,
  // Only the tokens our CSS reads, taken from DSH's own theme definitions
  // (body{} = light, body[data-ds-dark-theme]{} = dark).
  tokens: {
    light: {
      '--dsw-alias-bg-base': '#ffffff',
      '--dsw-alias-bg-layer-1': '#ffffff',
      '--dsw-alias-bg-layer-2': '#f5f6f7',
      '--dsw-alias-bg-layer-3': '#ebeef2',
      '--dsw-alias-border-l1': '#0000000a',
      '--dsw-alias-border-l2': '#0000001a',
      '--dsw-alias-label-primary': '#0f1115',
      '--dsw-alias-label-secondary': '#61666b',
      '--dsw-alias-brand-primary': '#3b82f6',
      '--dsw-alias-state-error-primary': '#ec1313',
    },
    dark: {
      '--dsw-alias-bg-base': '#151517',
      '--dsw-alias-bg-layer-1': '#232324',
      '--dsw-alias-bg-layer-2': '#2c2c2e',
      '--dsw-alias-bg-layer-3': '#353638',
      '--dsw-alias-border-l1': '#ffffff0f',
      '--dsw-alias-border-l2': '#ffffff1f',
      '--dsw-alias-label-primary': '#f1f3f5',
      '--dsw-alias-label-secondary': '#cfd3d6',
      '--dsw-alias-brand-primary': '#3b82f6',
      '--dsw-alias-state-error-primary': '#f25a5a',
    },
  },
  trees: {
    dashboard: treeOf('main'),
    sidebar: treeOf('sidebar.footer.action'),
    // The config card the shell renders on this plugin's page in the Plugins manager.
    settings: treeOf('plugins.bundle.config'),
  },
}

fs.mkdirSync(path.dirname(out), { recursive: true })
fs.writeFileSync(out, JSON.stringify(payload), 'utf8')
console.log('wrote', out, 'bytes', JSON.stringify(payload).length)
console.log('trees: dashboard nodes', JSON.stringify(payload.trees.dashboard).length, '| sidebar', JSON.stringify(payload.trees.sidebar).length)
