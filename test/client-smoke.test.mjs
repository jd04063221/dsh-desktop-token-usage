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

const React = {
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

/** Render an element tree by invoking function components, as React would. */
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
    return render(node.type(node.props))
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
function fakeContext() {
  const record = { slots: [], effects: [], mounted: [], injected: [] }
  const namespace = { summary: async () => summaryPayload() }
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

function summaryPayload() {
  return {
    version: 1,
    generatedAt: Date.now(),
    elapsedMs: 1,
    filter: { sinceDay: null, untilDay: null, sources: null },
    coverage: { files: 2, skipped: 0, firstTime: 1, lastTime: 2, surfaces: { client: 2, cli: 0, subagent: 0, none: 0 } },
    totals: {
      buckets: [1000, 200, 4000, 0, 50],
      totalTokens: 5200,
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
  assert.match(wide, /5\.2万|5,200/, `expected a compact total, got: ${wide}`)

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
  assert.deepEqual(Object.keys(host), ['apply'], 'the Host half must stay dependency-free and export only apply')
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
  assert.deepEqual(plain(parse({ sinceDay: '2026-09-01', untilDay: null, sources: ['client'] })), {
    sinceDay: '2026-09-01',
    untilDay: null,
    sources: ['client'],
  })
  assert.equal(parse({ sinceDay: 'nonsense', sources: ['bogus'] }).sinceDay, null)
  assert.equal(parse(undefined), undefined)
  assert.throws(() => parse('nope'))

  // The result codec must accept what the Host's summarizer returns.
  assert.ok(hostDescriptor.result.create().parse(summaryPayload()))
})
