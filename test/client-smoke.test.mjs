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
      { day: '2026-09-25', buckets: [500, 100, 2000, 0, 25], turns: 3, requests: 4, byModel: { 'p/a': [500, 100, 2000, 0, 25] } },
      { day: '2026-09-26', buckets: [500, 100, 2000, 0, 25], turns: 4, requests: 5, byModel: { 'p/a': [300, 60, 1000, 0, 15], 'q/b': [200, 40, 1000, 0, 10] } },
    ],
    models: [
      { route: 'p/a', provider: 'p', model: 'a', buckets: [800, 160, 3000, 0, 40], totalTokens: 3960 },
      { route: 'q/b', provider: 'q', model: 'b', buckets: [200, 40, 1000, 0, 10], totalTokens: 1240 },
    ],
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

  assert.deepEqual(plain(record.injected), [['remote.dshUsage']], 'the Remote namespace must be awaited')
  assert.equal(record.mounted.length, 1)

  const registrations = record.slots.filter((entry) => entry.options)
  const main = registrations.find((entry) => entry.options.name === 'main')
  const panel = registrations.find((entry) => entry.options.name === 'sidebar.panellist')
  const config = registrations.find((entry) => entry.options.name === 'plugins.bundle.config')
  assert.ok(main, 'a main panel must be registered')
  assert.ok(panel, 'a sidebar panel entry must be registered')
  assert.ok(config, 'the plugin must draw its own configuration card')
  assert.equal(main.options.key, 'dsh-desktop-token-usage')
  assert.equal(panel.options.id, 'dsh-desktop-token-usage', 'the list id addresses the matching main panel')
  assert.equal(panel.options.label, 'Token 用量', 'the sidebar paints this string as the row title')
  assert.equal(typeof panel.options.order, 'number')
  assert.equal(panel.options.inject, undefined, 'the sidebar owns the click, so no face is injected here')
  assert.equal(config.options.key, 'dsh-desktop-token-usage', 'the card is keyed by the bundle package name')
  assert.equal(typeof main.component, 'function')
  assert.equal(typeof panel.component, 'function')
  assert.equal(typeof config.component, 'function')

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

  const entry = record.slots.find((item) => item.options?.name === 'sidebar.panellist')
  // Await the initial load the apply pass kicked off.
  await new Promise((resolve) => setTimeout(resolve, 0))

  // The sidebar owns the row, the click and the label; the occupant is only a
  // glyph, so it must honour the edge the row asks for and paint nothing else.
  const glyph = render({ type: entry.component, props: { size: 18, active: false } })
  assert.equal(glyph.tag, 'svg', 'the occupant must be a bare glyph')
  assert.equal(glyph.props.width, 18, 'the glyph must use the size the row passes')
  assert.equal(glyph.props.height, 18)
  assert.equal(collect(glyph).join(''), '', 'the glyph carries no text of its own')

  const main = record.slots.find((item) => item.options?.name === 'main')
  const body = collect(render({ type: main.component, props: main.options.inject() })).join(' ')
  for (const expected of [
    'Token 用量',
    'Tokens 用量',
    '完成轮次',
    '请求数量',
    '活跃天数',
    '平均缓存命中率',
    '最常用模型',
    '活跃热力图',
    '按天 Token 趋势',
    '模型用量',
    '缓存命中率',
    '未联网',
  ]) {
    assert.ok(body.includes(expected), `the dashboard must render "${expected}"`)
  }
  // The source tabs must stay honest about what is derivable offline.
  assert.ok(body.includes('桌面·网页') && body.includes('命令行·机器人'), 'expected the derived source tabs')
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
  assert.match(text, /侧边栏卡片显示的时间跨度/)
  assert.match(text, /当前：近 6 小时 \+ 近 7 天/)

  const inputs = []
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
  const walk = (node, visit) => {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) return node.forEach((child) => walk(child, visit))
    visit(node)
    walk(node.children, visit)
  }
  walk(tree, (node) => {
    if (node.tag === 'input') inputs.push(node)
  })
  assert.equal(inputs.length, 2, 'one field per window')
  assert.deepEqual(inputs.map((input) => input.props.value), [6, 7])
  assert.deepEqual(inputs.map((input) => input.props.max), [23, 30])
  assert.equal(inputs[0].props.disabled, false)

  const button = find(tree, (node) => node.tag === 'button' && node.props.className === 'dtu-save')
  assert.ok(button, 'the card must have a save control')
  button.props.onClick()
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.deepEqual(plain(record.saved), [{ hours: 6, days: 7 }], 'save must send both windows')
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

  // The write codec clamps rather than trusting the browser.
  const patch = hostDescriptor('setConfig').parameters[0].codec.create().parse
  assert.deepEqual(plain(patch({ hours: 99, days: -3 })), { hours: 23, days: 0 })
  assert.deepEqual(plain(patch({ hours: 6, days: 7 })), { hours: 6, days: 7 })
  assert.throws(() => patch('nope'))
  assert.ok(hostDescriptor('config').result.create().parse({ hours: 6, days: 7, writable: true }))
})
