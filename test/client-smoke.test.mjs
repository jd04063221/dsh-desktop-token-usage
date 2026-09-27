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
import path from 'node:path'
import test from 'node:test'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

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
  const record = { slots: [], effects: [], mounted: [], injected: [] }
  // A Remote resolves to its `{ ok, value }` envelope, never to the bare payload.
  const namespace = { summary: options.summary ?? (async (filter) => ({ ok: true, value: summaryPayload(filter) })) }
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
  assert.ok(main, 'a main panel must be registered')
  assert.ok(footer, 'a sidebar footer entry must be registered')
  assert.equal(main.options.key, 'dsh-token-usage')
  assert.equal(footer.options.id, 'dsh-token-usage')
  assert.equal(typeof main.component, 'function')
  assert.equal(typeof footer.component, 'function')

  // Styles are owned by the fiber and removed on unload.
  assert.equal(document.head.children.length, 1)
  assert.equal(document.head.children[0].dataset.plugin, 'dsh-token-usage')
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

test('with both card windows off the card falls back to the all-time split', async () => {
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

  const entry = record.slots.find((item) => item.options?.name === 'sidebar.footer.action')
  const card = collect(render({ type: entry.component, props: { ...entry.options.inject(), wide: true } })).join(' ')
  assert.match(card, /5,200/, `expected the all-time total, got: ${card}`)
  assert.match(card, /输入 5,000 · 输出 200/)
  assert.match(card, /缓存命中 90\.0%/)
  assert.ok(!card.includes('近 6 小时'), 'a disabled window must not render')
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

  const entry = record.slots.find((item) => item.options?.name === 'sidebar.footer.action')
  const card = collect(render({ type: entry.component, props: { ...entry.options.inject(), wide: true } })).join(' ')
  assert.match(card, /读取失败/, 'the card must report the failure too')
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

test('the Host descriptor and the Client contribution agree', async () => {
  const registered = []
  const provided = []
  const hostCtx = {
    inject: (deps, callback) => {
      assert.deepEqual(deps, ['typert'])
      callback({
        typert: { register: (contribution) => { registered.push(contribution); return () => {} } },
        reflect: { provide: (name, value, check) => { provided.push({ name, value, check }); return () => {} } },
        effect: () => {},
      })
    },
  }
  const host = await import('../index.js')
  assert.deepEqual(Object.keys(host).sort(), ['Config', 'apply'], 'the Host half exports only its Config and apply')
  host.apply(hostCtx)

  assert.equal(registered.length, 1, 'the Host must register exactly one contribution')
  const hostContribution = registered[0]
  const hostDescriptor = hostContribution.invocations[0]

  // The service and its binding are what `validateBinding` in the gateway checks.
  assert.equal(provided.length, 1)
  const service = provided[0].value
  assert.equal(provided[0].name, hostDescriptor.service, 'the provided service key must match the descriptor')
  assert.equal(typeof Object.getPrototypeOf(service).summary, 'function', 'the method belongs on the prototype')
  assert.deepEqual(Object.keys(service.typertRemote).sort(), ['namespace', 'service', 'serviceKey'])
  assert.equal(service.typertRemote.service, service)
  assert.equal(service.typertRemote.serviceKey, hostDescriptor.service)
  assert.equal(service.typertRemote.namespace, hostDescriptor.namespace)

  const { plugin } = loadClient()
  const { ctx, record } = fakeContext()
  plugin.apply(ctx)
  const clientDescriptor = record.mounted[0].descriptors[0]

  assert.equal(hostContribution.package, record.mounted[0].package)
  for (const key of ['id', 'service', 'namespace', 'method']) {
    assert.equal(clientDescriptor[key], hostDescriptor[key], `descriptor.${key} disagrees between the two halves`)
  }
  assert.deepEqual(plain(clientDescriptor.invocation), plain(hostDescriptor.invocation))
  assert.equal(clientDescriptor.result.typeSymbol, hostDescriptor.result.typeSymbol)

  const hostParam = hostDescriptor.parameters[0]
  const clientParam = clientDescriptor.parameters[0]
  assert.equal(clientParam.name, hostParam.name)
  assert.equal(clientParam.wire, hostParam.wire)
  assert.equal(clientParam.source, hostParam.source)
  assert.equal(clientParam.acceptsUndefined, hostParam.acceptsUndefined)
  assert.equal(clientParam.codec.typeSymbol, hostParam.codec.typeSymbol)

  // The declared filter codec must survive the values the browser actually sends.
  const parse = hostParam.codec.create().parse
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
  assert.ok(hostDescriptor.result.create().parse(summaryPayload()))
})
