/**
 * Headless verification of both plugin faces, since this environment has no
 * browser control.
 *
 *  - loads `client.js` through a fake `window.__ModuleLoader__` and a minimal
 *    React/DOM shim, then applies it to a fake Cordis context and asserts what
 *    it registers;
 *  - renders the Dashboard and the sidebar entry through a tiny element
 *    renderer, so a typo in the view fails here instead of blanking a slot;
 *  - loads `index.js` with the DSH protocol package stubbed, and checks that the
 *    Host descriptor and the Client contribution agree field by field. A silent
 *    mismatch there would break the RPC with no error anywhere else.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

// `apply` writes the plugin's own diagnostics; keep them off the live files,
// which a human reads to tell which Host generation is running.
process.env.DSH_TOKEN_USAGE_DIAG_DIR ??= fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-desktop-token-usage-diag-'))

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.dirname(here)

// ── minimal React + DOM ─────────────────────────────────────────────────────

let hooks = []
let hookIndex = 0

class Component {
  constructor(props) {
    this.props = props ?? {}
  }
}

const React = {
  Component,
  Fragment: Symbol('Fragment'),
  createElement(type, props, ...children) {
    return { type, props: { ...(props ?? {}), children: children.length <= 1 ? children[0] : children } }
  },
  useState(initial) {
    const slot = hookIndex
    hookIndex += 1
    if (hooks[slot] === undefined) hooks[slot] = typeof initial === 'function' ? initial() : initial
    return [hooks[slot], (next) => { hooks[slot] = next }]
  },
  useEffect() {},
  useSyncExternalStore(_subscribe, getSnapshot) {
    return getSnapshot()
  },
}

function createElement(tag) {
  return {
    dataset: {},
    textContent: '',
    children: [],
    appendChild(child) {
      this.children.push(child)
      child.parent = this
    },
    remove() {
      if (!this.parent) return
      this.parent.children = this.parent.children.filter((child) => child !== this)
    },
  }
}

const document = { head: createElement('head'), createElement }

/** Render an element tree by invoking components, as React would. */
function render(node) {
  if (node === null || node === undefined || typeof node === 'boolean') return null
  if (Array.isArray(node)) return node.map(render).filter((child) => child !== null)
  if (typeof node === 'function') {
    hooks = []
    hookIndex = 0
    return render(node({}))
  }
  if (typeof node !== 'object') return node
  if (node.type === React.Fragment) return render(node.props.children)
  if (typeof node.type === 'function') {
    hooks = []
    hookIndex = 0
    const isClass = node.type.prototype instanceof Component || typeof node.type.prototype?.render === 'function'
    if (!isClass) return render(node.type(node.props))
    const instance = new node.type(node.props)
    instance.props = node.props
    instance.state = instance.state ?? {}
    try {
      return render(instance.render())
    } catch (error) {
      // Route a child failure to the boundary the way React does.
      const derive = node.type.getDerivedStateFromError
      if (typeof derive !== 'function') throw error
      instance.state = { ...instance.state, ...derive(error) }
      if (typeof instance.componentDidCatch === 'function') instance.componentDidCatch(error, {})
      return render(instance.render())
    }
  }
  return { tag: node.type, props: node.props, children: render(node.props.children) }
}

/** Flatten a rendered tree into `[tag, text]` pairs for assertions. */
function collect(node, out = []) {
  if (node === null || node === undefined) return out
  if (Array.isArray(node)) {
    for (const child of node) collect(child, out)
    return out
  }
  if (typeof node === 'string' || typeof node === 'number') {
    out.push(String(node))
    return out
  }
  collect(node.children, out)
  return out
}

// ── loading the Client half ─────────────────────────────────────────────────

function loadClient() {
  const source = fs.readFileSync(path.join(root, 'client.js'), 'utf8')
  const required = []
  let registration
  const sandbox = {
    window: { __ModuleLoader__: { load: (value) => { registration = value } } },
    document,
    console,
    // The page's timers: the plugin only arms one quiet refresh.
    setInterval: () => 1,
    clearInterval: () => {},
  }
  vm.runInNewContext(source, sandbox, { filename: 'client.js' })
  assert.ok(registration, 'client.js must register a module factory')
  const plugin = registration.factory((name) => {
    required.push(name)
    if (name === 'react') return React
    throw new Error(`client.js required an unexpected module: ${name}`)
  })
  return { registration, plugin, required }
}

/** A fake Cordis context recording everything the plugin registers. */
function fakeContext(options = {}) {
  const record = { slots: [], effects: [], mounted: [], injected: [], saved: [] }
  // A Remote resolves to its `{ ok, value }` envelope, never to the bare payload.
  const namespace = {
    summary: options.summary ?? (async (filter) => ({ ok: true, value: summaryPayload(filter) })),
    config: options.config ?? (async () => ({ ok: true, value: { hours: 6, days: 7, writable: true } })),
    setConfig:
      options.setConfig ??
      (async (patch) => {
        record.saved.push(patch)
        return { ok: true, value: { ...patch, writable: true } }
      }),
  }
  const remote = {
    $mount: async (contribution) => {
      record.mounted.push(contribution)
      return () => {}
    },
  }
  const make = (extra = {}) => ({
    remote,
    get: () => ({ selectPanel: () => {} }),
    inject: (deps, callback) => {
      record.injected.push(deps)
      callback(make({ remote: { ...remote, dshUsage: namespace } }))
    },
    effect: (fn, label) => {
      const cleanup = fn()
      record.effects.push({ label, cleanup })
    },
    slots: {
      inject: (owner, callback) => {
        const disposable = callback()
        record.slots.push({ owner, disposable })
      },
      register: (options, component) => {
        record.slots.push({ options, component })
        return () => {}
      },
    },
    ...extra,
  })
  return { ctx: make(), record }
}

/** One card row, shaped exactly as `cardRollup` in the Host half emits it. */
function cardBlock(id, label, buckets, cacheHitRate, turns) {
  return {
    id,
    label,
    buckets,
    totalTokens: buckets[0] + buckets[1] + buckets[2] + buckets[3],
    inputTokens: buckets[0] + buckets[2],
    outputTokens: buckets[1],
    cacheHitRate,
    turns,
    requests: turns,
  }
}

function summaryPayload() {
  return {
    version: 2,
    generatedAt: Date.now(),
    elapsedMs: 1,
    filter: { sinceMs: null, untilMs: null, sources: null },
    coverage: { files: 2, skipped: 0, firstTime: 1, lastTime: 2, surfaces: { client: 2, cli: 0, subagent: 0, none: 0 } },
    totals: {
      buckets: [1000, 200, 4000, 0, 50],
      totalTokens: 5200,
      inputTokens: 5000,
      cacheHitRate: 0.8,
      sessions: 2,
      turns: 7,
      requests: 9,
      activeDays: 3,
      topModel: 'p/a',
    },
    days: [
      {
        day: '2026-09-25',
        buckets: [500, 100, 2000, 0, 25],
        turns: 3,
        requests: 4,
        byModel: { 'p/a': [500, 100, 2000, 0, 25] },
        byGroup: {
          model: { a: [500, 100, 2000, 0, 25] },
          provider: { p: [500, 100, 2000, 0, 25] },
        },
      },
      {
        day: '2026-09-26',
        buckets: [500, 100, 2000, 0, 25],
        turns: 4,
        requests: 5,
        byModel: { 'p/a': [300, 60, 1000, 0, 15], 'q/b': [200, 40, 1000, 0, 10] },
        byGroup: {
          model: { a: [300, 60, 1000, 0, 15], b: [200, 40, 1000, 0, 10] },
          provider: { p: [300, 60, 1000, 0, 15], q: [200, 40, 1000, 0, 10] },
        },
      },
    ],
    models: [
      { route: 'p/a', provider: 'p', model: 'a', buckets: [800, 160, 3000, 0, 40], totalTokens: 3960 },
      { route: 'q/b', provider: 'q', model: 'b', buckets: [200, 40, 1000, 0, 10], totalTokens: 1240 },
    ],
    groups: {
      model: [
        { key: 'a', buckets: [800, 160, 3000, 0, 40], totalTokens: 3960 },
        { key: 'b', buckets: [200, 40, 1000, 0, 10], totalTokens: 1240 },
      ],
      provider: [
        { key: 'p', buckets: [800, 160, 3000, 0, 40], totalTokens: 3960 },
        { key: 'q', buckets: [200, 40, 1000, 0, 10], totalTokens: 1240 },
      ],
    },
    card: {
      hours: 6,
      days: 7,
      blocks: [
        cardBlock('hours', '近 6 小时', [400, 80, 1600, 0, 20], 0.8, 2),
        cardBlock('days', '近 7 天', [1000, 200, 4000, 0, 50], 0.8, 7),
      ],
      all: null,
    },
    heatmap: {
      weeks: 3,
      days: [
        { day: '2026-09-24', tokens: 0, turns: 2, requests: 2 },
        { day: '2026-09-25', tokens: 5000, turns: 3, requests: 4 },
        { day: '2026-09-26', tokens: 200, turns: 4, requests: 5 },
      ],
    },
  }
}

// ── tests ───────────────────────────────────────────────────────────────────

/** Values built inside the `vm` realm need normalizing before strict compares. */
const plain = (value) => JSON.parse(JSON.stringify(value))

test('the Client half requires only React and registers both slots', async () => {
  const { plugin, required } = loadClient()
  assert.deepEqual(required, ['react'], 'the module table offers React; nothing else may be required')
  assert.deepEqual(plain(plugin.inject), ['slots', 'remote'])

  const { ctx, record } = fakeContext()
  plugin.apply(ctx)
  // The Remote namespace arrives one microtask after `$mount` resolves.
  await new Promise((resolve) => setTimeout(resolve, 0))

  assert.deepEqual(plain(record.injected), [['layout'], ['remote.dshUsage']], 'both services must be awaited')
  assert.equal(record.mounted.length, 1)

  const registrations = record.slots.filter((entry) => entry.options)
  const main = registrations.find((entry) => entry.options.name === 'main')
  const footer = registrations.find((entry) => entry.options.name === 'sidebar.footer.action')
  const config = registrations.find((entry) => entry.options.name === 'plugins.bundle.config')
  assert.ok(main, 'a main panel must be registered')
  assert.ok(footer, 'a sidebar footer entry must be registered')
  assert.ok(config, 'the plugin must draw its own configuration card')
  assert.equal(main.options.key, 'dsh-desktop-token-usage')
  assert.equal(footer.options.id, 'dsh-desktop-token-usage')
  assert.equal(config.options.key, 'dsh-desktop-token-usage', 'the card is keyed by the bundle package name')
  assert.equal(typeof main.component, 'function')
  assert.equal(typeof footer.component, 'function')
  assert.equal(typeof config.component, 'function')

  // The seat is one horizontal row shared with other plugins, and every plugin in
  // it declares width:100%. The card therefore turns the seat into a column,
  // addressing it through its own class suffix plus :has() so nothing depends on
  // DSH's hashed class names and no ancestor is ever touched. Wrapping is not the
  // fix: on a column seat flex-wrap would lay the card out beside its neighbour.
  // The direct-child form is the fallback for a shell that stops inserting the
  // display:contents slot wrapper the seat has today.
  const styles = document.head.children[0].textContent
  assert.ok(
    styles.includes('[class*="_footerActions"]:has(.dtu-footCard)'),
    'the entry must turn the seat into a column, matching it by class suffix',
  )
  assert.ok(
    styles.includes(':has(> .dtu-footCard){flex-direction:column}'),
    'and it must still work if the shell stops wrapping the slot',
  )
  assert.ok(
    !/\.dtu-footCard\)\{flex-wrap/.test(styles) && !/:has\(\.dtu-footCard\)\{flex-wrap/.test(styles),
    'flex-wrap is the wrong tool: on a column seat it wraps into extra columns',
  )
  assert.ok(styles.includes('flex:1 1 100%'), 'the card must claim the full line it moved onto')

  // Styles are owned by the fiber and removed on unload.
  assert.equal(document.head.children.length, 1)
  assert.equal(document.head.children[0].dataset.plugin, 'dsh-desktop-token-usage')
  assert.ok(
    record.effects.some((effect) => effect.label.includes('refresh timer')),
    'the plugin must arm its quiet refresh so hour windows stay current',
  )
  for (const effect of record.effects) if (typeof effect.cleanup === 'function') effect.cleanup()
  assert.equal(document.head.children.length, 0, 'disposal must remove the injected styles')
})

test('the sidebar entry and the dashboard render without a browser', async () => {
  const { plugin } = loadClient()
  const { ctx, record } = fakeContext()
  plugin.apply(ctx)

  const entry = record.slots.find((item) => item.options?.name === 'sidebar.footer.action')
  // Await the initial load the apply pass kicked off.
  await new Promise((resolve) => setTimeout(resolve, 0))

  const wide = collect(render({ type: entry.component, props: { ...entry.options.inject(), wide: true } })).join(' ')
  assert.match(wide, /Token 用量/)
  // Every configured window is its own row, split into input and output.
  assert.match(wide, /近 6 小时/)
  assert.match(wide, /近 7 天/)
  assert.match(wide, /输入 2,000 · 输出 80/, `expected the hour window's split, got: ${wide}`)
  assert.match(wide, /输入 5,000 · 输出 200/, `expected the day window's split, got: ${wide}`)
  assert.match(wide, /缓存命中 80\.0%/)

  const rail = render({ type: entry.component, props: { ...entry.options.inject(), wide: false } })
  assert.equal(rail.tag, 'button')
  assert.match(rail.props['aria-label'], /Token 用量/)

  const main = record.slots.find((item) => item.options?.name === 'main')
  const tree = render({ type: main.component, props: main.options.inject() })
  const body = collect(tree).join(' ')
  for (const expected of [
    'Token 用量',
    'Tokens 用量',
    '完成轮次',
    '请求数量',
    '活跃天数',
    '平均缓存命中率',
    '缓存命中 / (缓存命中 + 未命中)',
    '最常用模型',
    '活跃热力图',
    '按天 Token 趋势',
    '用量拆分',
    '未联网',
  ]) {
    assert.ok(body.includes(expected), `the dashboard must render "${expected}"`)
  }
  // The source tabs must stay honest about what is derivable offline.
  assert.ok(body.includes('桌面·网页') && body.includes('命令行·机器人'), 'expected the derived source tabs')

  // The trend legend is scoped: it keys the stacked colours and the hit-rate line.
  // A whole-page match would be satisfied by the stat card's 缓存命中率 instead.
  const legendNodes = []
  const collectLegends = (node) => {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) return node.forEach(collectLegends)
    if (node.props?.className === 'dtu-legend') legendNodes.push(node)
    collectLegends(node.children)
  }
  collectLegends(tree)
  const trendLegend = legendNodes.find((node) => collect(node).includes('其他'))
  assert.ok(trendLegend, 'the trend section must carry its own legend')
  const legendTexts = collect(trendLegend)
  for (const entry of summaryPayload().groups.model.slice(0, 5)) {
    assert.ok(legendTexts.includes(entry.key), `the legend must name the Top5 key ${entry.key}`)
  }
  assert.ok(legendTexts.includes('缓存命中率'), 'the daily-total key was replaced by a hit-rate key')
  const legendClasses = []
  const collectLegendClasses = (node) => {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) return node.forEach(collectLegendClasses)
    if (typeof node.props?.className === 'string') legendClasses.push(node.props.className)
    collectLegendClasses(node.children)
  }
  collectLegendClasses(trendLegend)
  assert.ok(legendClasses.includes('dtu-lineKey'), 'the hit-rate key draws as a line swatch')
  assert.ok(legendClasses.filter((name) => name === 'dtu-dot').length >= 3, 'the colour keys draw as dots')

  // The configured windows are wall-clock figures the Host builds without the
  // source filter, so they get their own section instead of a filter-following card.
  assert.ok(body.includes('配置窗口'), 'the dashboard must carry the configured windows')
  assert.ok(body.includes('近 6 小时') && body.includes('近 7 天'), 'both configured windows must be named')
  assert.ok(body.includes('2,080'), `expected the hour window's total, got: ${body.slice(0, 500)}`)
  assert.ok(
    body.includes('输入 2,000 · 输出 80 · 缓存命中 80.0% · 2 轮'),
    'each window must show its own split, not the filtered totals',
  )
  assert.ok(body.includes('不随上方来源筛选变化'), 'the section must not claim to follow the filter')
})

test('the dashboard carries its palette on the root and ships three light/dark sets', async () => {
  const { plugin } = loadClient()
  const { ctx, record } = fakeContext()
  plugin.apply(ctx)
  await new Promise((resolve) => setTimeout(resolve, 0))

  const main = record.slots.find((item) => item.options?.name === 'main')
  const tree = render({ type: main.component, props: main.options.inject() })
  const roots = []
  const walk = (node) => {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) return node.forEach(walk)
    if (node.props?.className === 'dtu-root') roots.push(node)
    walk(node.children)
  }
  walk(tree)
  assert.equal(roots.length, 1)
  assert.equal(roots[0].props['data-dtu-palette'], 'primer', 'the default palette is primer')

  const styles = document.head.children[0].textContent
  for (const palette of ['cvd', 'muted']) {
    assert.ok(styles.includes('[data-dtu-palette="' + palette + '"]'), palette + ' must have a variable block')
  }
  assert.ok(styles.includes('prefers-color-scheme: dark'), 'light/dark switch is a media query')
  assert.ok(styles.includes('--dtu-s1:#0072b2'), 'the cvd series colour must be a variable value')
  assert.ok(styles.includes('--dtu-other:'), 'the folded bucket keeps its own grey')
})

test('with both windows off the dashboard falls back to the all-time rollup', async () => {
  const { plugin } = loadClient()
  const payload = summaryPayload()
  payload.card = {
    hours: 0,
    days: 0,
    blocks: [],
    all: cardBlock('all', '累计', [1000, 200, 4000, 0, 50], 0.9, 7),
  }
  const { ctx, record } = fakeContext({ summary: async () => ({ ok: true, value: payload }) })
  plugin.apply(ctx)
  await new Promise((resolve) => setTimeout(resolve, 0))

  const main = record.slots.find((item) => item.options?.name === 'main')
  const body = collect(render({ type: main.component, props: main.options.inject() })).join(' ')
  assert.ok(body.includes('配置窗口'), 'the section stays, labelled with the all-time block')
  assert.ok(body.includes('输入 5,000 · 输出 200 · 缓存命中 90.0% · 7 轮'), `expected the all-time split, got: ${body.slice(0, 500)}`)
  assert.ok(!body.includes('近 6 小时'), 'a disabled window must not be listed')
})

test('a Host older than this Client still fills the dashboard and the calendar', async () => {
  const { plugin } = loadClient()
  // The upgrade state that actually happened: a current Client half talking to a
  // Host module generation that predates `card`. The dashboard must still render,
  // and the calendar must fall back to the range's days rather than an empty year.
  const payload = summaryPayload()
  delete payload.card
  delete payload.totals.inputTokens
  delete payload.heatmap
  const { ctx, record } = fakeContext({ summary: async () => ({ ok: true, value: payload }) })
  plugin.apply(ctx)
  await new Promise((resolve) => setTimeout(resolve, 0))

  const main = record.slots.find((item) => item.options?.name === 'main')
  const panel = collect(render({ type: main.component, props: main.options.inject() })).join(' ')
  assert.ok(!panel.includes('读取失败'), 'a missing `card` is not a failed read')
  assert.match(panel, /当前筛选共 2 天有活动/, `expected a filled calendar, got: ${panel.slice(0, 200)}`)
})

test('a failed Remote result shows its message instead of blanking the panel', async () => {
  const { plugin } = loadClient()
  const { ctx, record } = fakeContext({
    summary: async () => ({ ok: false, error: { code: 'gateway/service-unavailable', message: 'active Service "dshTokenUsage" is unavailable' } }),
  })
  plugin.apply(ctx)
  await new Promise((resolve) => setTimeout(resolve, 0))

  const main = record.slots.find((item) => item.options?.name === 'main')
  const text = collect(render({ type: main.component, props: main.options.inject() })).join(' ')
  assert.match(text, /读取失败/)
  assert.match(text, /is unavailable/)
})

test('a malformed payload shows an error instead of a blank panel', async () => {
  const { plugin } = loadClient()
  // A Host that answers with a shape the view cannot walk must not blank the seat.
  const { ctx, record } = fakeContext({ summary: async () => ({ ok: true, value: { ...summaryPayload(), days: null } }) })
  plugin.apply(ctx)
  await new Promise((resolve) => setTimeout(resolve, 0))

  const main = record.slots.find((item) => item.options?.name === 'main')
  const text = collect(render({ type: main.component, props: main.options.inject() })).join(' ')
  assert.match(text, /渲染失败/, `expected a visible failure, got: ${text}`)
  assert.ok(text.trim().length > 0, 'the panel must never render nothing')
})

test('the configuration card renders the windows and saves them to the Host', async () => {
  const { plugin } = loadClient()
  const { ctx, record } = fakeContext()
  plugin.apply(ctx)
  await new Promise((resolve) => setTimeout(resolve, 0))

  const slot = record.slots.find((item) => item.options?.name === 'plugins.bundle.config')
  const tree = render({ type: slot.component, props: { entryKey: 'dsh-desktop-token-usage', view: 'page' } })
  const text = collect(tree).join(' ')
  assert.match(text, /看板「配置窗口」的时间跨度/)
  assert.match(text, /当前：近 6 小时 \+ 近 7 天/)
  assert.match(text, /不随看板上方的来源筛选变化/, 'the form must say the windows ignore the filter')

  const find = (node, match) => {
    if (!node || typeof node !== 'object') return null
    if (Array.isArray(node)) {
      for (const child of node) {
        const hit = find(child, match)
        if (hit) return hit
      }
      return null
    }
    if (match(node)) return node
    return find(node.children, match)
  }
  const inputs = []
  const selects = []
  const walkInputs = (node) => {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) return node.forEach(walkInputs)
    if (node.tag === 'input') inputs.push(node)
    if (node.tag === 'select') selects.push(node)
    walkInputs(node.children)
  }
  walkInputs(tree)
  assert.equal(inputs.length, 2, 'one number field per window')
  assert.deepEqual(inputs.map((input) => input.props.value), [6, 7])
  assert.deepEqual(inputs.map((input) => input.props.max), [23, 30])
  assert.equal(inputs[0].props.disabled, false)
  assert.equal(selects.length, 2, 'one enum field per new option')
  assert.deepEqual(selects.map((select) => select.props.value), ['both', 'primer'])

  const button = find(tree, (node) => node.tag === 'button' && node.props.className === 'dtu-save')
  assert.ok(button, 'the card must have a save control')
  button.props.onClick()
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.deepEqual(
    plain(record.saved),
    [{ hours: 6, days: 7, groupBy: 'both', palette: 'primer' }],
    'save must send both windows and both enum options',
  )
})

test('without a Host config editor the card is read-only and says so', async () => {
  const { plugin } = loadClient()
  const { ctx, record } = fakeContext({
    config: async () => ({ ok: true, value: { hours: 0, days: 0, writable: false } }),
  })
  plugin.apply(ctx)
  await new Promise((resolve) => setTimeout(resolve, 0))

  const slot = record.slots.find((item) => item.options?.name === 'plugins.bundle.config')
  const tree = render({ type: slot.component, props: { entryKey: 'dsh-desktop-token-usage', view: 'page' } })
  const text = collect(tree).join(' ')
  assert.match(text, /当前：累计/, 'both windows off reads as the cumulative view')
  assert.match(text, /没有提供配置编辑器/)

  const inputs = []
  const walk = (node) => {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) return node.forEach(walk)
    if (node.tag === 'input') inputs.push(node)
    walk(node.children)
  }
  walk(tree)
  assert.ok(inputs.every((input) => input.props.disabled === true), 'fields must be disabled')
})

test('the breakdown offers its own chip and the last stat card speaks its language', async () => {
  const { plugin } = loadClient()
  const { ctx, record } = fakeContext()
  plugin.apply(ctx)
  await new Promise((resolve) => setTimeout(resolve, 0))
  const main = record.slots.find((item) => item.options?.name === 'main')

  const tree = render({ type: main.component, props: main.options.inject() })
  const text = collect(tree).join(' ')
  assert.match(text, /用量拆分/)
  assert.match(text, /最常用模型/, 'by default the card speaks of models')

  const labels = []
  const walk = (node) => {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) return node.forEach(walk)
    if (node.props?.className === 'dtu-chip') labels.push(collect(node).join(''))
    walk(node.children)
  }
  walk(tree)
  assert.ok(labels.includes('按供应商'), 'the breakdown section must offer the provider switch')
})

test('a locked groupBy hides both switches and the breakdown follows the lock', async () => {
  const { plugin } = loadClient()
  const { ctx, record } = fakeContext({
    config: async () => ({ ok: true, value: { hours: 6, days: 7, groupBy: 'provider', palette: 'primer', writable: true } }),
  })
  plugin.apply(ctx)
  await new Promise((resolve) => setTimeout(resolve, 0))
  const main = record.slots.find((item) => item.options?.name === 'main')

  const tree = render({ type: main.component, props: main.options.inject() })
  const text = collect(tree).join(' ')
  assert.match(text, /最常用供应商/, 'the stat card must speak of providers when the mode is locked')
  const rowNames = []
  const labels = []
  const walk = (node) => {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) return node.forEach(walk)
    if (node.props?.className === 'dtu-rowName') rowNames.push(collect(node).join(''))
    if (node.props?.className === 'dtu-chip') labels.push(collect(node).join(''))
    walk(node.children)
  }
  walk(tree)
  assert.deepEqual(rowNames, ['p', 'q'], 'the locked breakdown must render provider rows, not model rows')
  assert.ok(
    !labels.includes('按模型') && !labels.includes('按供应商'),
    'a locked config hides both switches instead of offering a dead one',
  )
})

test('an older Host without groups still fills the breakdown and stacks named bars', async () => {
  const { plugin } = loadClient()
  // The upgrade state the Host actually ships: route-keyed byModel/models only.
  const payload = summaryPayload()
  delete payload.groups
  for (const day of payload.days) delete day.byGroup
  const { ctx, record } = fakeContext({ summary: async () => ({ ok: true, value: payload }) })
  plugin.apply(ctx)
  await new Promise((resolve) => setTimeout(resolve, 0))
  const main = record.slots.find((item) => item.options?.name === 'main')

  const tree = render({ type: main.component, props: main.options.inject() })
  const rowNames = []
  const rowShares = []
  const segments = []
  const walk = (node) => {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) return node.forEach(walk)
    if (node.props?.className === 'dtu-rowName') rowNames.push(collect(node).join(''))
    if (node.props?.className === 'dtu-rowShare') rowShares.push(collect(node).join(''))
    if (node.props?.className === 'dtu-seg') segments.push(node)
    walk(node.children)
  }
  walk(tree)
  assert.deepEqual(rowNames, ['a', 'b'], 'the model rows must be rebuilt locally, not left empty')
  assert.deepEqual(rowShares, ['76.2%', '23.8%'], 'each rebuilt row carries its share of the range')
  const named = segments.filter((segment) => segment.props.style?.background !== 'var(--dtu-other)')
  assert.ok(segments.length > 0, 'the trend must still draw its stacked bars')
  assert.ok(
    named.length > 0,
    'bars must keep a real series colour — folding everything into 其他 is the failure mode',
  )
})

// ── the trend line ──────────────────────────────────────────────────────────

/** Five days: two empty, a spike, then a dip — hit rates live in 90-95%. */
function trendPayload() {
  const payload = summaryPayload()
  const day = (name, total, cacheRead) => ({
    day: name,
    buckets: [total - cacheRead, 0, cacheRead, 0, 0],
    turns: 1,
    requests: 1,
    byModel: { 'p/a': [total - cacheRead, 0, cacheRead, 0, 0] },
    byGroup: {
      model: { a: [total - cacheRead, 0, cacheRead, 0, 0] },
      provider: { p: [total - cacheRead, 0, cacheRead, 0, 0] },
    },
  })
  payload.days = [
    day('2026-09-21', 0, 0),
    day('2026-09-22', 0, 0),
    day('2026-09-23', 400, 380),
    day('2026-09-24', 1000, 900),
    day('2026-09-25', 200, 190),
  ]
  return payload
}

/** Renders the dashboard and reports the trend section's parts. */
async function renderTrend(payload) {
  const { plugin } = loadClient()
  const summary = payload ? async () => ({ ok: true, value: payload }) : undefined
  const { ctx, record } = fakeContext(summary ? { summary } : {})
  plugin.apply(ctx)
  await new Promise((resolve) => setTimeout(resolve, 0))

  const main = record.slots.find((item) => item.options?.name === 'main')
  const classes = []
  const curves = {}
  const texts = []
  const walk = (node) => {
    if (node === null || node === undefined || typeof node !== 'object') return
    if (Array.isArray(node)) return node.forEach(walk)
    const name = typeof node.props?.className === 'string' ? node.props.className : null
    if (name) {
      classes.push(name)
      if (name === 'dtu-chartHit') {
        const sweep = (child) => {
          if (child === null || child === undefined || typeof child !== 'object') return
          if (Array.isArray(child)) return child.forEach(sweep)
          if (child.tag === 'path') curves.hit = child.props.d
          sweep(child.children)
        }
        sweep(node)
      }
    }
    if (typeof node.children === 'string' || typeof node.children === 'number') texts.push(String(node.children))
    walk(node.children)
  }
  walk(render({ type: main.component, props: main.options.inject() }))
  return { classes, curves, texts }
}

test('the trend stacks bars and a hit-rate strip under one shared axis', async () => {
  const { classes, curves } = await renderTrend(trendPayload())

  assert.equal(classes.filter((name) => name === 'dtu-chartBars').length, 1, 'the bars keep one plot')
  assert.equal(classes.filter((name) => name === 'dtu-chartHit').length, 1, 'the hit rate gets its own strip')
  assert.equal(classes.filter((name) => name === 'dtu-line').length, 0, 'the daily-total curve is gone')
  assert.equal(classes.filter((name) => name === 'dtu-axisX').length, 1, 'the X axis is drawn once, under both')
  assert.equal(classes.filter((name) => name === 'dtu-axisHit').length, 1, 'the strip carries its own labels')
  assert.match(curves.hit, /^M/, 'the hit rate is one smooth path, not a polyline')
})

test('the hit-rate strip scales to the visible days with 10% headroom', async () => {
  const { curves, texts } = await renderTrend(trendPayload())
  // rates: 95%, 90%, 95% -> min 90, max 95, span 5, pad 0.5 -> axis 89.5-95.5
  assert.ok(texts.includes('89.5%'), 'the lower bound is min - 10% of the span')
  assert.ok(texts.includes('95.5%'), 'the upper bound is max + 10% of the span')
  assert.ok(texts.includes('92.5%'), 'the middle gridline is the band centre')
  const numbers = (curves.hit.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number)
  // the path is 'M x,y' plus 6 coordinates per cubic segment, so a day's own y
  // sits at index 1 and at 2 + 6 * segment + 5; the in-between y's are control
  // points and must not be mistaken for plotted days.
  const dayY = [numbers[1], ...[0, 1].map((segment) => numbers[2 + 6 * segment + 5])]
  assert.ok(dayY.every((y) => y >= 0 && y <= 100), 'the curve stays inside the strip')
  // the two empty days carry no rate, so only three points are plotted; 95% sits 8.33%
  // down from the band top (89.5-95.5) and 90% sits 91.67% down
  assert.deepEqual(dayY, [8.33, 91.67, 8.33], '95% near the top, 90% near the bottom')
})

test('the hit-rate dots and the hover line each live in their own inset plot frame', async () => {
  const { plugin } = loadClient()
  const { ctx, record } = fakeContext({ summary: async () => ({ ok: true, value: trendPayload() }) })
  plugin.apply(ctx)
  await new Promise((resolve) => setTimeout(resolve, 0))
  const main = record.slots.find((item) => item.options?.name === 'main')

  // Walk a rendered tree, remembering each node's chain of class names.
  const framesOf = (tree) => {
    const frames = []
    const walk = (node, chain) => {
      if (node === null || node === undefined || typeof node !== 'object') return
      if (Array.isArray(node)) return node.forEach((child) => walk(child, chain))
      const names = typeof node.props?.className === 'string' ? node.props.className.split(' ') : []
      const next = names.length > 0 ? [...chain, ...names] : chain
      if (names.length > 0 || node.tag === 'svg') frames.push({ node, chain: next })
      walk(node.children, next)
    }
    walk(tree, [])
    return frames
  }
  // The curve and the dots share the bars' inset frame, or they drift off it.
  const idle = framesOf(render({ type: main.component, props: main.options.inject() }))
  const dots = idle.filter((frame) => frame.chain.includes('dtu-hitDot'))
  assert.equal(dots.length, 5, 'one dot per column, empty days included')
  for (const dot of dots) assert.ok(dot.chain.includes('dtu-hitPlot'), 'a dot outside .dtu-hitPlot would not sit on the curve')
  const curve = idle.find((frame) => frame.node.tag === 'svg' && frame.node.props.preserveAspectRatio === 'none')
  assert.ok(curve, 'the hit-rate curve must be drawn')
  assert.ok(curve.chain.includes('dtu-hitPlot'), 'the curve lives in the same inset frame as the dots')

  // Drive TrendSection directly to observe the hover tree: real React re-renders
  // after onMouseEnter, and the fake harness keeps hook state only across
  // back-to-back invocations of the same component.
  const findElement = (node, predicate) => {
    if (node === null || node === undefined || typeof node !== 'object') return null
    if (Array.isArray(node)) {
      for (const child of node) {
        const hit = findElement(child, predicate)
        if (hit) return hit
      }
      return null
    }
    if (node.type !== undefined && predicate(node)) return node
    return findElement(node.props?.children, predicate)
  }
  const dash = main.component(main.options.inject())
  const body = dash.props.children
  hooks = []
  hookIndex = 0
  const trendElement = findElement(
    body.type(body.props),
    (el) => typeof el.type === 'function' && el.props?.days && el.props?.groups && el.props?.groupBy !== undefined,
  )
  assert.ok(trendElement, 'the trend section element must be reachable for the hover drive')
  hooks = []
  hookIndex = 0
  const beforeHover = trendElement.type(trendElement.props)
  const column = findElement(beforeHover, (el) => el.props?.className === 'dtu-col')
  assert.ok(column, 'a column must carry the hover handler')
  column.props.onMouseEnter()
  hookIndex = 0 // replay the component with the hook state the handler just set
  const hovered = framesOf(render(trendElement.type(trendElement.props)))
  const cursor = hovered.find((frame) => frame.chain.includes('dtu-cursor'))
  assert.ok(cursor, 'hovering a column must render the cursor line')
  assert.ok(cursor.chain.includes('dtu-plotLine'), 'the cursor line must live inside the inset .dtu-plotLine frame')
  assert.ok(cursor.chain.includes('dtu-trend'), 'and the frame hangs off the trend section')
  const tip = hovered.find((frame) => frame.chain.includes('dtu-tip'))
  assert.ok(tip, 'the tooltip follows the cursor')
  assert.ok(tip.chain.includes('dtu-cursor'), 'the tooltip hangs off the cursor line')

  // Structure alone cannot prove the insets: lock the geometry in CSS too.
  const styles = document.head.children[0].textContent
  assert.ok(styles.includes('.dtu-hitPlot{position:absolute;left:52px;right:44px'), "the dot frame must share the bars' insets")
  assert.ok(styles.includes('.dtu-plotLine{position:absolute;left:52px;right:44px'), "the cursor frame must share the bars' insets")
  assert.ok(
    styles.includes('.dtu-trend{position:relative;padding-bottom:20px}'),
    'the date band needs its own space below both segments',
  )
  assert.ok(
    styles.includes('.dtu-axisX{position:absolute;left:52px;right:44px;bottom:2px;height:14px'),
    'the date band must sit below the hit strip, not under it',
  )
  assert.ok(
    styles.includes('.dtu-plotLine{position:absolute;left:52px;right:44px;top:0;bottom:20px'),
    'the cursor spans both segments and stops where the axis band starts',
  )
  assert.ok(!styles.includes('bottom:22px'), 'the dead 22px axis reserve inside the bars panel is gone')
})

test('the heatmap renders a Monday-aligned calendar with axes and a metric switch', async () => {
  const { plugin } = loadClient()
  const { ctx, record } = fakeContext()
  plugin.apply(ctx)
  await new Promise((resolve) => setTimeout(resolve, 0))

  const main = record.slots.find((item) => item.options?.name === 'main')
  const tree = render({ type: main.component, props: main.options.inject() })
  const text = collect(tree).join(' ')

  // The fixture has three days with turns but only two with tokens, so the
  // default metric lands on the richer dimension instead of an empty grid.
  assert.match(text, /近 3 周共 3 天有活动 · 合计 9 轮/, 'the calendar summarises its own window')
  assert.match(text, /Tokens/)
  assert.match(text, /轮次/)
  assert.match(text, /较少/)
  assert.match(text, /较多/)

  const classes = []
  const walk = (node) => {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) return node.forEach(walk)
    if (node.props && typeof node.props.className === 'string') classes.push(node.props.className)
    walk(node.children)
  }
  walk(tree)
  const cells = classes.filter((name) => name === 'dtu-cell').length
  const weeks = classes.filter((name) => name === 'dtu-week').length
  assert.equal(weeks, 3, 'one column per week')
  // 7 days per week column, plus the four legend swatches.
  assert.equal(cells, 3 * 7 + 4)
  assert.ok(classes.includes('dtu-weekdays'), 'weekday labels exist')
  assert.ok(classes.includes('dtu-heatMonths'), 'month labels exist')
  assert.ok(classes.some((name) => name === 'dtu-monthCell'), 'the month axis is laid out')

  // The weekday axis labels Monday, Wednesday and Friday down its column.
  const weekday = []
  const collectWeekdays = (node) => {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) return node.forEach(collectWeekdays)
    if (node.props?.className === 'dtu-weekdays') weekday.push(...collect(node.children))
    collectWeekdays(node.children)
  }
  collectWeekdays(tree)
  assert.deepEqual(weekday, ['一', '', '三', '', '五', '', ''])

  // The five-colour scale paints directly; opacity would grade it a second time.
  const fills = []
  const collectFills = (node) => {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) return node.forEach(collectFills)
    if (node.props?.className === 'dtu-cellFill') fills.push(node)
    collectFills(node.children)
  }
  collectFills(tree)
  assert.ok(fills.length > 0, 'the legend and the active days must paint their swatches')
  for (const fill of fills) {
    assert.match(String(fill.props.style.background), /^var\(--dtu-heat-[0-4]\)$/, 'each swatch paints a scale colour directly')
    assert.ok(!('opacity' in fill.props.style), 'the colour scale must not be graded a second time by opacity')
  }
})

test('the Host descriptor and the Client contribution agree', async () => {
  const registered = []
  const provided = []
  const attached = []
  const configEditor = {
    configuration: () => [{ entry: { id: 'include:dsh-desktop-token-usage', options: { name: 'dsh-desktop-token-usage' } } }],
    edit: async () => {},
  }
  const hostCtx = {
    inject: (deps, callback) => {
      assert.deepEqual(deps, ['typert'])
      const remoteCtx = {
        typert: { register: (contribution) => { registered.push(contribution); return () => {} } },
        reflect: { provide: (name, value, check) => { provided.push({ name, value, check }); return () => {} } },
        effect: () => {},
        inject: (innerDeps, innerCallback) => {
          assert.deepEqual(innerDeps, ['configEditor'])
          innerCallback({ configEditor })
          attached.push(true)
        },
      }
      callback(remoteCtx)
    },
  }
  const host = await import('../index.js')
  assert.deepEqual(Object.keys(host).sort(), ['Config', 'apply'], 'the Host half exports only its Config and apply')
  host.apply(hostCtx)
  assert.equal(attached.length, 1, 'the Loader config editor is picked up when the profile provides one')

  assert.equal(registered.length, 1, 'the Host must register exactly one contribution')
  const hostContribution = registered[0]
  const hostDescriptor = (method) => hostContribution.invocations.find((item) => item.method === method)

  // The service and its binding are what `validateBinding` in the gateway checks.
  assert.equal(provided.length, 1)
  const service = provided[0].value
  assert.equal(provided[0].name, hostDescriptor('summary').service, 'the provided service key must match the descriptor')
  for (const method of ['summary', 'config', 'setConfig']) {
    assert.equal(typeof Object.getPrototypeOf(service)[method], 'function', `${method} belongs on the prototype`)
  }
  assert.deepEqual(Object.keys(service.typertRemote).sort(), ['namespace', 'service', 'serviceKey'])
  assert.equal(service.typertRemote.service, service)
  assert.equal(service.typertRemote.serviceKey, hostDescriptor('summary').service)
  assert.equal(service.typertRemote.namespace, hostDescriptor('summary').namespace)

  const { plugin } = loadClient()
  const { ctx, record } = fakeContext()
  plugin.apply(ctx)
  const clientDescriptors = record.mounted[0].descriptors

  assert.equal(hostContribution.package, record.mounted[0].package)
  assert.equal(hostContribution.invocations.length, 3, 'summary, config and setConfig')
  assert.equal(clientDescriptors.length, 3)
  for (const clientDescriptor of clientDescriptors) {
    const host = hostDescriptor(clientDescriptor.method)
    assert.ok(host, `the Host must declare ${clientDescriptor.method}`)
    for (const key of ['id', 'service', 'namespace', 'method']) {
      assert.equal(clientDescriptor[key], host[key], `${clientDescriptor.method}.${key} disagrees between the halves`)
    }
    assert.deepEqual(plain(clientDescriptor.invocation), plain(host.invocation))
    assert.equal(clientDescriptor.result.typeSymbol, host.result.typeSymbol)
    assert.equal(clientDescriptor.parameters.length, host.parameters.length)
    host.parameters.forEach((hostParam, index) => {
      const clientParam = clientDescriptor.parameters[index]
      assert.equal(clientParam.name, hostParam.name)
      assert.equal(clientParam.wire, hostParam.wire)
      assert.equal(clientParam.source, hostParam.source)
      assert.equal(clientParam.acceptsUndefined, hostParam.acceptsUndefined)
      assert.equal(clientParam.codec.typeSymbol, hostParam.codec.typeSymbol)
    })
  }

  // The declared filter codec must survive the values the browser actually sends.
  const summary = hostDescriptor('summary')
  const parse = summary.parameters[0].codec.create().parse
  assert.deepEqual(plain(parse({ sinceMs: 1_790_000_000_000, untilMs: null, sources: ['client'] })), {
    sinceMs: 1_790_000_000_000,
    untilMs: null,
    sources: ['client'],
  })
  assert.deepEqual(plain(parse({ sinceMs: 'nonsense', sources: ['bogus'] })), {
    sinceMs: null,
    untilMs: null,
    sources: null,
  })
  assert.equal(parse(undefined), undefined)
  assert.throws(() => parse('nope'))

  // The result codec must accept what the Host's summarizer returns.
  assert.ok(summary.result.create().parse(summaryPayload()))

  // The write codec clamps numbers and whitelists the two enums.
  const patch = hostDescriptor('setConfig').parameters[0].codec.create().parse
  assert.deepEqual(plain(patch({ hours: 99, days: -3 })), { hours: 23, days: 0 })
  assert.deepEqual(plain(patch({ hours: 6, days: 7 })), { hours: 6, days: 7 })
  assert.deepEqual(plain(patch({ hours: 6, days: 7, groupBy: 'provider', palette: 'cvd' })), {
    hours: 6,
    days: 7,
    groupBy: 'provider',
    palette: 'cvd',
  })
  assert.deepEqual(plain(patch({ groupBy: 'nonsense', palette: 'nope' })), { groupBy: 'both', palette: 'primer' })
  assert.throws(() => patch('nope'))
  assert.ok(
    hostDescriptor('config').result.create().parse({ hours: 6, days: 7, groupBy: 'both', palette: 'primer', writable: true }),
  )
  assert.ok(
    hostDescriptor('config').result.create().parse({ hours: 0, days: 0, writable: false }),
    'an older Host without the two new keys must still parse',
  )

  // The form hardcodes its six <option> values — the Client cannot import the
  // Host's schema — so pin both halves to each other: the option sets must equal
  // the Config schema's enums, and the write codec must accept every option.
  const configSlot = record.slots.find((item) => item.options?.name === 'plugins.bundle.config')
  const formTree = render({ type: configSlot.component, props: { entryKey: 'dsh-desktop-token-usage', view: 'page' } })
  const optionSets = []
  const collectSelects = (node) => {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) return node.forEach(collectSelects)
    if (node.tag === 'select') {
      const values = []
      const collectOptions = (child) => {
        if (!child || typeof child !== 'object') return
        if (Array.isArray(child)) return child.forEach(collectOptions)
        if (child.tag === 'option') values.push(child.props.value)
        collectOptions(child.children)
      }
      collectOptions(node.children)
      optionSets.push(values)
    }
    collectSelects(node.children)
  }
  collectSelects(formTree)
  assert.equal(optionSets.length, 2, 'both enums must be selects in the form')
  const schemaEnums = (key) => host.Config.dict[key].list.map((member) => member.value).sort()
  assert.deepEqual([...optionSets[0]].sort(), schemaEnums('groupBy'), 'the groupBy options must match the Host schema')
  assert.deepEqual([...optionSets[1]].sort(), schemaEnums('palette'), 'the palette options must match the Host schema')
  for (const [key, values] of [['groupBy', optionSets[0]], ['palette', optionSets[1]]]) {
    for (const value of values) {
      assert.equal(patch({ [key]: value })[key], value, `the Host must accept its own ${key} value ${value}`)
    }
  }
})
