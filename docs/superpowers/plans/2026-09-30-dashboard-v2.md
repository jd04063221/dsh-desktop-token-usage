# 用量看板 v2（分组口径 · 命中率条 · 配色系统）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把看板改成「堆叠柱 + 命中率细条」两段共用 X 轴，新增按模型/按供应商/都统计的分组口径与三套可配置配色，命中率条改用数据驱动的纵轴。

**Architecture:** Host（`lib/session-usage.js`）在聚合时**只增不改**地产出 `byGroup`（每天）与 `groups`（全范围），并把命中率分母改成 hit + miss；配置经 `index.js` 的 `Config` schema 与 Remote 校验（合并语义、白名单回落）；Client（`client.js`）把这套数据渲染成两段布局 + 两颗 chip + 自定义 tooltip，配色落成根节点上的 CSS 变量（三套 × 浅/深，用 `prefers-color-scheme` 切换）。

**Tech Stack:** 纯 JS（无构建、无图表库），DSH bundle（`client.js` 浏览器半 + `index.js`/`lib` Host 半），测试用 `node --test` + 自建的假 React/DOM（`test/client-smoke.test.mjs`）。

**Spec:** `docs/superpowers/specs/2026-09-30-dashboard-viz-design.md`

**测试命令（每个任务都用这一条）：** `node --test "test/*.test.mjs"`（等价于 `npm test`；Host 相关用例在缺 `~/.dsh/sessions` 时会自动 skip）

---

## 文件结构（先锁定职责）

| 文件 | 职责 | 本计划怎么动 |
| --- | --- | --- |
| `lib/session-usage.js` | 会话日志 → 索引 → 聚合；唯一的 Host 数学层 | 加 `hitRateOf()`；`summarize()` 加 `byGroup`/`groups`；命中率改用新口径 |
| `index.js` | Host 半：Config schema、Remote 描述符、校验、写配置 | 加 `groupBy`/`palette`；`parseConfigPatch` 白名单回落；`parseConfigView` 放宽；`setConfig` 合并语义 |
| `client.js` | 浏览器半：看板、侧边栏卡片、配置卡 | 趋势区拆两段；加 chip、tooltip、配色变量；`ConfigForm` 加两个控件；统计卡/拆分区跟随口径 |
| `test/session-usage.test.mjs` | Host 数学的测试 | 加 `hitRateOf` 用例；加分组不变量用例 |
| `test/client-smoke.test.mjs` | 两个半边的假环境冒烟 | 夹具补 `groups`/`byGroup`；改写趋势用例；扩配置卡与 codec 用例 |
| `docs/DESIGN.md`、`README.md`、`README-zh.md`、`CHANGELOG.md`、`CHANGELOG-zh.md` | 文档 | 图表小节改写、看板说明、未发布条目 |

---

### Task 1: Host —— 命中率口径统一（`hitRateOf`）

**Files:**
- Modify: `lib/session-usage.js:61-65`（`totalOf`/`inputOf` 旁边）、`lib/session-usage.js:677`（`totals.cacheHitRate`）
- Test: `test/session-usage.test.mjs:18-32`（import 列表）、文件末尾新增用例

- [ ] **Step 1: 写失败用例**

把 `hitRateOf` 加进 `test/session-usage.test.mjs` 顶部的 import 列表（与 `totalOf` 同一行），并在文件末尾追加：

```js
test('the cache-hit rate puts cache writes on the miss side', () => {
  // buckets = [uncachedInput, output, cacheRead, cacheWrite, reasoning]
  assert.equal(hitRateOf([100, 0, 900, 0, 0]), 0.9)
  assert.ok(Math.abs(hitRateOf([100, 0, 900, 100, 0]) - 9 / 11) < 1e-12, 'cache writes are a miss')
  assert.equal(hitRateOf([0, 10, 0, 0, 0]), 0, 'no hit and no prompt-side miss reads as 0')
  assert.equal(hitRateOf([0, 0, 0, 0, 0]), null, 'and an empty range is null, not a fake 0')
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test "test/*.test.mjs" 2>&1 | Select-String -Pattern "hit rate" -Context 0,3`
Expected: 该用例失败，报 `hitRateOf is not a function`（或 import 报 `does not provide an export named`）。

- [ ] **Step 3: 实现**

在 `lib/session-usage.js` 的 `inputOf` 之后加入：

```js
/**
 * Cache-hit share of prompt-side input: hits over hits + misses, where a cache
 * write counts as a miss — the provider had to compute that prefix. `null` when
 * the range saw no prompt-side tokens at all.
 */
export function hitRateOf(buckets) {
  const hit = num(buckets[2])
  const miss = num(buckets[0]) + num(buckets[3])
  return hit + miss > 0 ? hit / (hit + miss) : null
}
```

并把 `summarize()` 里原来的

```js
      cacheHitRate: cacheRead + uncachedInput > 0 ? cacheRead / (cacheRead + uncachedInput) : 0,
```

改成

```js
      cacheHitRate: hitRateOf(totals) ?? 0,
```

（同一行上方的 `const cacheRead = totals[2]` / `const uncachedInput = totals[0]` 若不再被别处使用，一并删掉——它们是这次改动造成的孤儿。）

- [ ] **Step 4: 跑测试确认通过**

Run: `node --test "test/*.test.mjs"`
Expected: 全部 PASS（本机有 `~/.dsh/sessions` 时约 6 秒）。

- [ ] **Step 5: 提交**

```bash
git add lib/session-usage.js test/session-usage.test.mjs
git commit -m "fix: 缓存命中率把 cacheWrite 计入 miss 侧（hitRateOf）"
```

---

### Task 2: Host —— 每天 `byGroup` + 全范围 `groups`

**Files:**
- Modify: `lib/session-usage.js:589-590`（`dayMap`/`modelMap` 旁）、`:610`（day 初始化）、`:616-629`（route 循环）、`:637-645`（days 映射）、`:661-688`（返回值）
- Test: `test/session-usage.test.mjs` 文件末尾

- [ ] **Step 1: 写失败用例**

```js
test('the summarizer groups every day by model and by provider', { skip: !haveSessions }, () => {
  const payload = summarize({ useCache: false })
  assert.ok(payload.groups, 'the payload must carry the two groupings')

  for (const day of payload.days) {
    for (const mode of ['model', 'provider']) {
      const sum = Object.values(day.byGroup[mode]).reduce(
        (acc, buckets) => acc.map((value, index) => value + buckets[index]),
        [0, 0, 0, 0, 0],
      )
      assert.deepEqual(sum, day.buckets, day.day + ' ' + mode + ' must re-add to the day buckets')
    }
  }

  const groupTotal = (entries) => entries.reduce((sum, entry) => sum + entry.totalTokens, 0)
  assert.equal(groupTotal(payload.groups.model), payload.totals.totalTokens)
  assert.equal(groupTotal(payload.groups.provider), payload.totals.totalTokens)
  assert.ok(payload.groups.model.length <= payload.models.length, 'models merge across providers')
  assert.deepEqual(
    payload.groups.provider.map((entry) => entry.key).sort(),
    [...new Set(payload.models.map((model) => model.provider))].sort(),
    'every provider seen in the range appears exactly once',
  )
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test "test/*.test.mjs" 2>&1 | Select-String -Pattern "groups every day" -Context 0,4`
Expected: 失败，`payload.groups` 为 `undefined`。

- [ ] **Step 3: 实现**

(a) 在 `summarize()` 里 `const modelMap = new Map()` 之后加一行：

```js
  const groupMaps = { model: new Map(), provider: new Map() }
```

(b) day 初始化（`day = { day: …, buckets: EMPTY(), turns: 0, requests: 0, byModel: new Map() }`）加上 `byGroup`：

```js
        day = {
          day: hour.hour.slice(0, 10),
          buckets: EMPTY(),
          turns: 0,
          requests: 0,
          byModel: new Map(),
          byGroup: { model: new Map(), provider: new Map() },
        }
```

(c) `for (const [route, buckets] of Object.entries(hour.byModel))` 循环里，在现有 `modelMap` 累加之后补上分组累加：

```js
        const slash = route.indexOf('/')
        const provider = slash > 0 ? route.slice(0, slash) : route
        const model = slash > 0 ? route.slice(slash + 1) : route
        for (const [mode, key] of [['model', model], ['provider', provider]]) {
          const perDay = day.byGroup[mode]
          let slot = perDay.get(key)
          if (!slot) {
            slot = EMPTY()
            perDay.set(key, slot)
          }
          addInto(slot, buckets)
          const globalMap = groupMaps[mode]
          let globalSlot = globalMap.get(key)
          if (!globalSlot) {
            globalSlot = EMPTY()
            globalMap.set(key, globalSlot)
          }
          addInto(globalSlot, buckets)
        }
```

(d) `days` 映射里加 `byGroup`（保留 `byModel` 给热更新期间的老客户端）：

```js
    .map((day) => ({
      day: day.day,
      buckets: day.buckets,
      turns: day.turns,
      requests: day.requests,
      byModel: Object.fromEntries(day.byModel),
      byGroup: {
        model: Object.fromEntries(day.byGroup.model),
        provider: Object.fromEntries(day.byGroup.provider),
      },
    }))
```

(e) `models` 之后加排序函数与两个列表：

```js
  const rankedGroups = (map) =>
    [...map.entries()]
      .map(([key, buckets]) => ({ key, buckets, totalTokens: totalOf(buckets) }))
      .sort((a, b) => b.totalTokens - a.totalTokens || (a.key < b.key ? -1 : 1))
```

并在返回对象里 `models` 之后加：

```js
    groups: {
      model: rankedGroups(groupMaps.model),
      provider: rankedGroups(groupMaps.provider),
    },
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node --test "test/*.test.mjs"`
Expected: 全部 PASS。

- [ ] **Step 5: 提交**

```bash
git add lib/session-usage.js test/session-usage.test.mjs
git commit -m "feat(host): 聚合产出按模型/按供应商两种分组"
```

---

### Task 3: Host —— 配置项 `groupBy` / `palette`（schema、白名单、合并语义）

**Files:**
- Modify: `index.js:36-52`（`SURFACES`/`Config`）、`:169-193`（`parseConfigView`/`parseConfigPatch`/描述符）、`:236-242`（`setConfig`）、`:276-284`（`windows` 构造）
- Test: `test/client-smoke.test.mjs:209-253`（夹具）、`:751-755`（codec 断言）

- [ ] **Step 1: 写失败用例**

在 `test/client-smoke.test.mjs` 末尾那个「the Host descriptor and the Client contribution agree」用例里，把 codec 断言区替换成：

```js
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
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test "test/*.test.mjs" 2>&1 | Select-String -Pattern "descriptor and the Client" -Context 0,6`
Expected: 失败，实际值只有 `{ hours: 6, days: 7 }`（`groupBy`/`palette` 被丢掉）。

- [ ] **Step 3: 实现**

(a) `index.js` 顶部常量区（`SURFACES` 之后）加：

```js
const GROUP_BY = ['model', 'provider', 'both']
const PALETTES = ['primer', 'cvd', 'muted']
const oneOf = (value, allowed, fallback) => (allowed.includes(value) ? value : fallback)
```

(b) `Config` 里 `days` 之后加两项（schemastery 的 `Schema.union([...])` 直接吃字面量，已实测）：

```js
  groupBy: Schema.union(['model', 'provider', 'both'])
    .default('both')
    .description('看板统计口径：按实际模型 / 按 API 供应商 / 都统计（都统计时图表上出现切换 chip）。'),
  palette: Schema.union(['primer', 'cvd', 'muted'])
    .default('primer')
    .description('看板配色：primer（GitHub 默认）/ cvd（色盲友好）/ muted（低饱和）。浅色与深色由系统主题决定。'),
```

(c) `parseConfigPatch` 改成「只改传进来的键」的合并语义：

```js
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
```

(d) `parseConfigView` 放宽为可选键：

```js
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
```

(e) `setConfig` 用 patch 覆盖而不是只挑两键：

```js
  async setConfig(patch) {
    const next = parseConfigPatch(patch)
    const entry = this.entry()
    if (entry === undefined) throw new Error('找不到本插件的 Loader 条目，无法写入配置')
    await this.configEditor.edit(entry, (current) => ({ ...current, ...next }))
    return { ...this.windows, ...next, writable: true }
  }
```

(f) `apply()` 里现有的 `const windows = { hours: clamp(config?.hours, 23), days: clamp(config?.days, 30) }` 改成：

```js
  const windows = {
    hours: clamp(config?.hours, 23),
    days: clamp(config?.days, 30),
    groupBy: oneOf(config?.groupBy, GROUP_BY, 'both'),
    palette: oneOf(config?.palette, PALETTES, 'primer'),
  }
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node --test "test/*.test.mjs"`
Expected: 全部 PASS（`client.js` 还没消费新键，但 Host 侧契约已成立）。

- [ ] **Step 5: 提交**

```bash
git add index.js test/client-smoke.test.mjs
git commit -m "feat(host): 配置新增 groupBy 与 palette（白名单 + 合并语义）"
```

---

### Task 4: Client —— 三套配色变量 + `data-dtu-palette`

**Files:**
- Modify: `client.js:24-25`（`SERIES`/`OTHER`）、`client.js:231-232`（`CSS` 开头与 `.dtu-root`）、`client.js:1171-1173`（根节点）
- Test: `test/client-smoke.test.mjs` 的样式与根节点断言

- [ ] **Step 1: 写失败用例**

在 `test/client-smoke.test.mjs` 里新增：

```js
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
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test "test/*.test.mjs" 2>&1 | Select-String -Pattern "carries its palette" -Context 0,4`
Expected: 失败，`data-dtu-palette` 为 `undefined`。

- [ ] **Step 3: 实现**

(a) `client.js:24-25` 的常量改成变量引用：

```js
    const SERIES = ['var(--dtu-s1)', 'var(--dtu-s2)', 'var(--dtu-s3)', 'var(--dtu-s4)', 'var(--dtu-s5)']
    const OTHER = 'var(--dtu-other)'
```

并在同处加一个折叠桶的键常量（趋势图与拆分列表共用）：

```js
    /** The folded bucket key: its label is 其他 everywhere. */
    const OTHER_KEY = '__other__'
```

(b) `CSS` 模板串里 `.dtu-root` 那一行改成「先写 primer 浅色变量，再写它的基础样式」：

```css
.dtu-root{
  --dtu-s1:#4c8dff; --dtu-s2:#3fb950; --dtu-s3:#d29922; --dtu-s4:#a371f7; --dtu-s5:#ec6a5e;
  --dtu-other:#6e7681; --dtu-hit:#57606a;
  --dtu-heat-0:#ebedf0; --dtu-heat-1:#9be9a8; --dtu-heat-2:#40c463; --dtu-heat-3:#30a14e; --dtu-heat-4:#216e39;
  display:block;height:100%;overflow:auto;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-size:13px}
.dtu-root[data-dtu-palette="cvd"]{
  --dtu-s1:#0072b2; --dtu-s2:#e69f00; --dtu-s3:#009e73; --dtu-s4:#cc79a7; --dtu-s5:#56b4e9;
  --dtu-other:#7b8794; --dtu-hit:#0072b2;
  --dtu-heat-0:#eef4fa; --dtu-heat-1:#c6dbef; --dtu-heat-2:#7fb3d9; --dtu-heat-3:#3d85c6; --dtu-heat-4:#084594}
.dtu-root[data-dtu-palette="muted"]{
  --dtu-s1:#4c6a92; --dtu-s2:#6e9c7a; --dtu-s3:#c9a227; --dtu-s4:#9a6b8f; --dtu-s5:#7a8ca3;
  --dtu-other:#8a857c; --dtu-hit:#4c6a92;
  --dtu-heat-0:#f0efe9; --dtu-heat-1:#cfd8c4; --dtu-heat-2:#a8bb98; --dtu-heat-3:#7d9a6d; --dtu-heat-4:#547049}
@media (prefers-color-scheme: dark){
  .dtu-root{
    --dtu-s1:#4c8dff; --dtu-s2:#3fb950; --dtu-s3:#d29922; --dtu-s4:#a371f7; --dtu-s5:#ec6a5e;
    --dtu-other:#8b949e; --dtu-hit:#8b949e;
    --dtu-heat-0:#161b22; --dtu-heat-1:#0e4429; --dtu-heat-2:#006d32; --dtu-heat-3:#26a641; --dtu-heat-4:#39d353}
  .dtu-root[data-dtu-palette="cvd"]{
    --dtu-s1:#58a6ff; --dtu-s2:#ffc857; --dtu-s3:#4dd4ac; --dtu-s4:#f0a6c8; --dtu-s5:#83c9f4;
    --dtu-other:#9aa5b1; --dtu-hit:#58a6ff;
    --dtu-heat-0:#111823; --dtu-heat-1:#12395c; --dtu-heat-2:#1b5a8a; --dtu-heat-3:#2f7fbd; --dtu-heat-4:#5fb0e8}
  .dtu-root[data-dtu-palette="muted"]{
    --dtu-s1:#8fa8c8; --dtu-s2:#9dc0a6; --dtu-s3:#e0c46a; --dtu-s4:#c49ab8; --dtu-s5:#a8b6c6;
    --dtu-other:#a8a196; --dtu-hit:#8fa8c8;
    --dtu-heat-0:#1a1a17; --dtu-heat-1:#2c3a28; --dtu-heat-2:#47603e; --dtu-heat-3:#688a56; --dtu-heat-4:#8fb273}
}
```

热力图色阶也要走变量：`Heatmap` 生成格子时把背景写成 `'var(--dtu-heat-' + level + ')'`（内层 opacity 分级保留），图例四格同样处理。

(c) 根节点带上面板名（`DashboardBody` 从 `useStore()` 拿到 `config`）：

```js
      const palette = state.config?.palette ?? 'primer'
      return h(
        'div',
        { className: 'dtu-root', 'data-dtu-palette': palette },
        …
      )
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node --test "test/*.test.mjs"`
Expected: 全部 PASS。

- [ ] **Step 5: 提交**

```bash
git add client.js test/client-smoke.test.mjs
git commit -m "feat(client): 三套配色变量（浅/深各一份）与 data-dtu-palette"
```

---

### Task 5: Client —— 趋势区拆成两段（柱 + 命中率条，共用 X 轴）

**Files:**
- Modify: `client.js:808-969`（`TrendChart` 整体替换为 `TrendSection`）、`client.js:1139`（调用点）、`client.js:272-300`（图表 CSS）
- Test: `test/client-smoke.test.mjs:513-610`（趋势用例整体改写）

- [ ] **Step 1: 写失败用例**

把 `test/client-smoke.test.mjs` 的 `trendPayload()` 换成带分组与命中率的夹具，并把 `renderTrend()` 与两个趋势用例替换为：

```js
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
  const dayY = numbers.filter((_, index) => index % 2 === 1)
  assert.ok(dayY.every((y) => y >= 0 && y <= 100), 'the curve stays inside the strip')
  // the two empty days carry no rate, so only three points are plotted; 95% sits 8.33%
  // down from the band top (89.5-95.5) and 90% sits 91.67% down
  assert.deepEqual(dayY, [8.33, 91.67, 8.33], '95% near the top, 90% near the bottom')
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test "test/*.test.mjs" 2>&1 | Select-String -Pattern "shared axis|10% headroom" -Context 0,4`
Expected: 失败（`dtu-chartBars`/`dtu-chartHit`/`dtu-axisHit` 都不存在）。

- [ ] **Step 3: 实现**

(a) 用下面这个组件替换 `client.js` 里的整个 `TrendChart`（`:808-969`）。它保留「HTML 柱子 + 百分比定位」的画法（不测宽、不引图表库），命中率条用 `preserveAspectRatio="none"` 的 SVG overlay，刻度文字走 HTML 绝对定位：

```js
    const EQUAL = [0, 0, 0, 0, 0]

    /** Cache-hit share of a day, in 0-1; null when the day saw no prompt tokens. */
    function hitRateOf(buckets) {
      const hit = buckets[2]
      const miss = buckets[0] + buckets[3]
      return hit + miss > 0 ? hit / (hit + miss) : null
    }

    /**
     * The strip's scale, from the visible days: min - 10% of the span to max + 10%.
     * A flat (or single-day) series gets +/-1pp, and a range with no hit rate at all
     * falls back to 0-100 so the empty strip still reads as a scale.
     */
    function hitRateBand(rates) {
      const seen = rates.filter((rate) => rate !== null)
      if (seen.length === 0) return { lo: 0, hi: 100 }
      const min = Math.min(...seen) * 100
      const max = Math.max(...seen) * 100
      const pad = max - min > 0 ? (max - min) * 0.1 : 1
      return { lo: Math.max(0, min - pad), hi: Math.min(100, max + pad) }
    }

    /**
     * Monotone cubic interpolation (Fritsch-Carlson) through points in 0-100 space,
     * as a single path. Straight hops corner at every day; a plain spline overshoots,
     * and next to a day with no usage that means dipping out of the plot.
     */
    function monotonePath(points) {
      const n = points.length
      const round = (value) => Math.round(value * 100) / 100
      if (n === 0) return ''
      if (n === 1) return 'M' + round(points[0].x) + ',' + round(points[0].y)
      const slopes = []
      for (let i = 0; i < n - 1; i += 1) slopes.push((points[i + 1].y - points[i].y) / (points[i + 1].x - points[i].x))
      const tangents = [slopes[0]]
      for (let i = 1; i < n - 1; i += 1) {
        tangents.push(slopes[i - 1] * slopes[i] <= 0 ? 0 : (slopes[i - 1] + slopes[i]) / 2)
      }
      tangents.push(slopes[n - 2])
      for (let i = 0; i < n - 1; i += 1) {
        if (slopes[i] === 0) {
          tangents[i] = 0
          tangents[i + 1] = 0
          continue
        }
        const before = tangents[i] / slopes[i]
        const after = tangents[i + 1] / slopes[i]
        const sum = before * before + after * after
        if (sum > 9) {
          const scale = 3 / Math.sqrt(sum)
          tangents[i] = scale * before * slopes[i]
          tangents[i + 1] = scale * after * slopes[i]
        }
      }
      let d = 'M' + round(points[0].x) + ',' + round(points[0].y)
      for (let i = 0; i < n - 1; i += 1) {
        const span = (points[i + 1].x - points[i].x) / 3
        d +=
          ' C' + round(points[i].x + span) + ',' + round(points[i].y + tangents[i] * span) +
          ' ' + round(points[i + 1].x - span) + ',' + round(points[i + 1].y - tangents[i + 1] * span) +
          ' ' + round(points[i + 1].x) + ',' + round(points[i + 1].y)
      }
      return d
    }

    const CHIP_GROUPS = [
      { id: 'model', label: '按模型' },
      { id: 'provider', label: '按供应商' },
    ]

    function TrendSection({ days, groups, groupBy }) {
      const [mode, setMode] = React.useState('model')
      const [hover, setHover] = React.useState(null)
      const active = groupBy === 'both' ? mode : groupBy
      const entries = (groups && groups[active]) || []
      const top = entries.slice(0, 5)
      const colorOf = new Map(top.map((entry, index) => [entry.key, SERIES[index % SERIES.length]]))
      const columns = days.map((day) => {
        const grouped = (day.byGroup && day.byGroup[active]) || {}
        const total = totalOf(day.buckets)
        const named = top.reduce((sum, entry) => sum + totalOf(grouped[entry.key] ?? EQUAL), 0)
        const segments = top.map((entry) => ({ key: entry.key, value: totalOf(grouped[entry.key] ?? EQUAL) }))
        if (total - named > 0) segments.push({ key: OTHER_KEY, value: total - named })
        return { day: day.day, total, turns: day.turns, segments, hit: hitRateOf(day.buckets) }
      })
      const max = niceMax(columns.reduce((peak, column) => Math.max(peak, column.total), 0))
      const band = hitRateBand(columns.map((column) => column.hit))
      const axisX = (index) => ((index + 0.5) / columns.length) * 100
      const hitY = (rate) => (1 - (rate * 100 - band.lo) / (band.hi - band.lo)) * 100
      const hitPoints = columns
        .map((column, index) => (column.hit === null ? null : { x: axisX(index), y: hitY(column.hit) }))
        .filter((point) => point !== null)
      const hitPath = monotonePath(hitPoints)
      const bandTicks = [band.lo, (band.lo + band.hi) / 2, band.hi]
      const labelled =
        columns.length <= 16
          ? columns.map((_, index) => index)
          : [0, Math.floor((columns.length - 1) / 3), Math.floor((2 * (columns.length - 1)) / 3), columns.length - 1]
      const hovered = hover === null ? null : columns[hover]
      return h(
        'div',
        { className: 'dtu-trend' },
        h(
          'div',
          { className: 'dtu-trendHead' },
          h('div', { className: 'dtu-hint' }, '柱按 token 堆叠；下面的细条是缓存命中率，两段共用同一条 X 轴'),
          groupBy === 'both'
            ? h(ChipGroup, { items: CHIP_GROUPS, value: mode, onSelect: setMode, label: '统计口径' })
            : null,
        ),
        h(
          'div',
          { className: 'dtu-chartBars' },
          h(
            'div',
            { className: 'dtu-axisY' },
            [0, 0.25, 0.5, 0.75, 1].map((tick) =>
              h('span', { key: tick, style: { top: tick * 100 + '%' } }, compact(max * (1 - tick))),
            ),
          ),
          h(
            'div',
            { className: 'dtu-grid' },
            [0, 0.25, 0.5, 0.75, 1].map((tick) =>
              h('div', { key: tick, className: 'dtu-gridline', style: { top: tick * 100 + '%' } }),
            ),
          ),
          h(
            'div',
            { className: 'dtu-bars' },
            columns.map((column, index) =>
              h(
                'div',
                {
                  key: column.day,
                  className: 'dtu-col',
                  'data-day': column.day,
                  onMouseEnter: () => setHover(index),
                  onMouseLeave: () => setHover(null),
                },
                column.segments.map((segment, segmentIndex) =>
                  h('div', {
                    key: segment.key + '-' + segmentIndex,
                    className: 'dtu-seg',
                    style: {
                      height: (segment.value / max) * 100 + '%',
                      background: segment.key === OTHER_KEY ? OTHER : colorOf.get(segment.key),
                    },
                  }),
                ),
              ),
            ),
          ),
        ),
        h(
          'div',
          { className: 'dtu-chartHit' },
          h(
            'div',
            { className: 'dtu-axisHit' },
            bandTicks.map((tick) => h('span', { key: tick, style: { top: hitY(tick / 100) + '%' } }, tick.toFixed(1) + '%')),
          ),
          h(
            'svg',
            { viewBox: '0 0 100 100', preserveAspectRatio: 'none' },
            h('path', {
              d: hitPath,
              fill: 'none',
              stroke: 'var(--dtu-hit)',
              strokeWidth: 1.5,
              strokeLinecap: 'round',
              vectorEffect: 'non-scaling-stroke',
            }),
          ),
          columns.map((column, index) =>
            h('span', {
              key: column.day,
              className: column.hit === null ? 'dtu-hitDot dtu-hitDotEmpty' : 'dtu-hitDot',
              style: { left: axisX(index) + '%', top: column.hit === null ? '100%' : hitY(column.hit) + '%' },
              onMouseEnter: () => setHover(index),
              onMouseLeave: () => setHover(null),
            }),
          ),
        ),
        h(
          'div',
          { className: 'dtu-axisX' },
          labelled.map((index) => h('span', { key: index, style: { left: axisX(index) + '%' } }, columns[index].day.slice(5))),
        ),
        hovered
          ? h(
              'div',
              { className: 'dtu-cursor', style: { left: axisX(hover) + '%' } },
              h(
                'div',
                { className: 'dtu-tip', 'data-day': hovered.day },
                h('div', { className: 'dtu-tipTitle' }, hovered.day + ' · ' + grouped(hovered.total) + ' tokens'),
                hovered.segments
                  .filter((segment) => segment.value > 0)
                  .map((segment) =>
                    h(
                      'div',
                      { key: segment.key, className: 'dtu-tipRow' },
                      h('span', {
                        className: 'dtu-dot',
                        style: { background: segment.key === OTHER_KEY ? OTHER : colorOf.get(segment.key) },
                      }),
                      segment.key === OTHER_KEY ? '其他' : segment.key,
                      h('b', null, compact(segment.value)),
                    ),
                  ),
                h('div', { className: 'dtu-tipRow' }, '缓存命中率', h('b', null, hovered.hit === null ? '—' : percent(hovered.hit))),
              ),
            )
          : null,
      )
    }
```

(b) 调用点（`client.js:1139`）改成：

```js
          h(Section, { title: '按天 Token 趋势' }, h(TrendSection, { days: data.days, groups: data.groups, groupBy: groupByMode })),
```

其中 `groupByMode` 先在 `DashboardBody` 顶部写成 `const groupByMode = 'model'`，Task 6 再换成配置值。

(c) 样式（`CSS` 里 `.dtu-chart` 那一段）替换为：

```css
.dtu-trend{position:relative}
.dtu-trendHead{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:6px}
.dtu-chartBars{position:relative;height:190px;margin-top:4px}
.dtu-chartHit{position:relative;height:44px;margin-top:16px}
.dtu-chartHit svg{position:absolute;left:52px;right:44px;top:0;width:auto;height:44px}
.dtu-axisHit{position:absolute;left:0;top:0;bottom:0;width:50px;color:var(--dsw-alias-label-secondary);font-size:11px}
.dtu-axisHit span{position:absolute;right:6px;transform:translateY(-50%)}
.dtu-hitDot{position:absolute;width:5px;height:5px;border-radius:50%;background:var(--dtu-hit);transform:translate(-50%,-50%)}
.dtu-hitDotEmpty{background:transparent}
.dtu-cursor{position:absolute;top:0;bottom:26px;width:1px;background:var(--dsw-alias-border-l1);pointer-events:none}
.dtu-tip{position:absolute;top:6px;left:0;transform:translateX(-50%);min-width:160px;padding:8px 10px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-1);box-shadow:0 6px 18px rgba(0,0,0,.18);font-size:12px;pointer-events:none;z-index:3}
.dtu-tipTitle{font-weight:600;margin-bottom:4px}
.dtu-tipRow{display:flex;align-items:center;gap:6px}
.dtu-tipRow b{margin-left:auto;font-weight:600}
```

（`.dtu-bars`/`.dtu-axisY`/`.dtu-grid`/`.dtu-axisX` 沿用现有规则；`.dtu-cursor` 包住 `.dtu-tip`，tooltip 用 `transform: translateX(-50%)` 跟随指示线。）

- [ ] **Step 4: 跑测试确认通过**

Run: `node --test "test/*.test.mjs"`
Expected: 全部 PASS，含上面两条新用例。

- [ ] **Step 5: 提交**

```bash
git add client.js test/client-smoke.test.mjs
git commit -m "feat(client): 趋势区拆成柱图 + 命中率条（共用 X 轴、数据驱动纵轴）"
```

---

### Task 6: Client —— 拆分区 chip、统计卡跟随、配置表单两个控件

**Files:**
- Modify: `client.js:1094-1105`（统计卡）、`client.js:1140-1167`（`模型用量` → `用量拆分`）、`client.js:567-636`（`ConfigForm`）
- Test: `test/client-smoke.test.mjs:441-486`（配置卡用例）与新增拆分区用例

- [ ] **Step 1: 写失败用例**

(a) 配置卡用例里，把输入断言换成「两个数字输入 + 两个下拉」，并断言保存值：

```js
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
  assert.equal(selects.length, 2, 'one enum field per new option')
  assert.deepEqual(selects.map((select) => select.props.value), ['both', 'primer'])
```

保存断言改成：

```js
  assert.deepEqual(
    plain(record.saved),
    [{ hours: 6, days: 7, groupBy: 'both', palette: 'primer' }],
    'save must send both windows and both enum options',
  )
```

(b) 新增拆分区用例：

```js
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
```

（假 React 无法跨渲染保留 hook 状态，切 chip 之后的观感放在 Task 7 Step 6 手工验证；这里锁住「区块标题、chip、统计卡文案」三处都在。）

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test "test/*.test.mjs" 2>&1 | Select-String -Pattern "breakdown offers|configuration card" -Context 0,4`
Expected: 配置卡用例失败（select 数为 0，保存值少两个键）；拆分区用例失败（没有 `用量拆分` 与 chip）。

- [ ] **Step 3: 实现**

(a) `DashboardBody` 顶部加口径状态：

```js
      const [breakdownMode, setBreakdownMode] = React.useState('model')
      const groupByMode = state.config?.groupBy ?? 'both'
      const activeGroups = (data && data.groups && data.groups[breakdownMode]) || []
      const topGroup = activeGroups.length > 0 ? activeGroups[0] : null
```

（这些要在 `const totals = …` 之后、`return` 之前；`data` 可能是 `null`，条件与现有代码的写法保持一致。）

(b) 统计卡最后一张：

```js
            h(Card, {
              label: breakdownMode === 'provider' ? '最常用供应商' : '最常用模型',
              value: topGroup ? topGroup.key : '—',
              sub: topGroup ? '占比 ' + percent(topGroup.totalTokens / Math.max(1, totals.totalTokens)) : null,
              title: topGroup ? topGroup.key : undefined,
            }),
```

(c) 把 `模型用量` 那个 `Section`（`:1140-1167`）整段换成 `用量拆分`：

```js
          h(
            Section,
            {
              title: '用量拆分',
              extra:
                groupByMode === 'both'
                  ? h(ChipGroup, { items: CHIP_GROUPS, value: breakdownMode, onSelect: setBreakdownMode, label: '拆分口径' })
                  : h('span', { className: 'dtu-hint' }, breakdownMode === 'provider' ? '按供应商' : '按模型'),
            },
            h(
              'div',
              { className: 'dtu-models' },
              h(Donut, { entries: activeGroups, totalTokens: totals.totalTokens, selected: hovered, onSelect: setHovered }),
              h(
                'div',
                { className: 'dtu-rows' },
                activeGroups.map((entry, index) =>
                  h(
                    'div',
                    {
                      key: entry.key,
                      className: 'dtu-row',
                      onMouseEnter: () => setHovered(entry.key),
                      onMouseLeave: () => setHovered(null),
                    },
                    h(
                      'div',
                      { className: 'dtu-rowName', title: entry.key },
                      h('span', { className: 'dtu-dot', style: { background: index < 5 ? SERIES[index] : OTHER } }),
                      entry.key,
                    ),
                    h('div', { className: 'dtu-rowTotal' }, compact(entry.totalTokens)),
                    h('div', { className: 'dtu-rowShare' }, totals.totalTokens > 0 ? percent(entry.totalTokens / totals.totalTokens) : '0%'),
                  ),
                ),
              ),
            ),
          ),
```

`Donut` 的入参同步改名：`{ models }` → `{ entries }`，内部 `model.route` → `entry.key`、`models[index]` → `entries[index]`，颜色用 `index < 5 ? SERIES[index] : OTHER`。

(d) `ConfigForm` 里补两个 `select`（放在两个数字输入之后），并把 `values` 初值写全：

```js
      const values = draft ?? {
        hours: current.hours,
        days: current.days,
        groupBy: current.groupBy ?? 'both',
        palette: current.palette ?? 'primer',
      }
```

```js
        h(
          'label',
          { className: 'dtu-field' },
          h('span', null, '统计口径'),
          h(
            'select',
            {
              className: 'dtu-input',
              value: values.groupBy,
              disabled: locked,
              onChange: (event) => setDraft({ ...values, groupBy: event.target.value }),
            },
            h('option', { value: 'both' }, '都统计（图表上可切换）'),
            h('option', { value: 'model' }, '按实际模型'),
            h('option', { value: 'provider' }, '按 API 供应商'),
          ),
        ),
        h(
          'label',
          { className: 'dtu-field' },
          h('span', null, '配色方案'),
          h(
            'select',
            {
              className: 'dtu-input',
              value: values.palette,
              disabled: locked,
              onChange: (event) => setDraft({ ...values, palette: event.target.value }),
            },
            h('option', { value: 'primer' }, 'Primer（GitHub 默认）'),
            h('option', { value: 'cvd' }, '色盲友好（Okabe–Ito）'),
            h('option', { value: 'muted' }, '低饱和雾面'),
          ),
        ),
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node --test "test/*.test.mjs"`
Expected: 全部 PASS。

- [ ] **Step 5: 提交**

```bash
git add client.js test/client-smoke.test.mjs
git commit -m "feat(client): 拆分口径 chip、统计卡跟随、配置表单新增口径与配色"
```

---

### Task 7: 文档 + 手工验证

**Files:**
- Modify: `docs/DESIGN.md:292-300`（4.3 图表小节）、`README.md`、`README-zh.md`、`CHANGELOG.md`、`CHANGELOG-zh.md`

- [ ] **Step 1: 改 DESIGN.md**

把 `4.3 图表怎么画` 一节的「趋势图」那一条改成：

```markdown
- **趋势图**：柱是 flex 列 + 百分比高度的堆叠 div（文字由 HTML 渲染，保持清晰）；命中率是下方独立的细条，
  用一层 `preserveAspectRatio="none"` 的 SVG overlay 画单调三次曲线（曲线没有文字，压缩不失真），
  两段共用同一条 X 轴。命中率条的纵轴由可见范围的数据决定（min − 10% 跨度 → max + 10% 跨度），
  所以 90%–98% 的命中率也能看出起伏，而不是贴在 0–100% 的顶端；
- **配色**：三套色板（primer / cvd / muted）全部落成根节点的 CSS 变量，浅/深由 `prefers-color-scheme` 覆盖——
  宿主只提供 `--dsw-alias-*` 语义 token，没有图表色板 token（实测 `app.asar` 里 `--dsw-chart-*` 为 0 命中）。
```

- [ ] **Step 2: 改两份 README 的看板说明**

`README-zh.md` / `README.md` 里描述看板的那一节，补三条：① 趋势区是「柱 + 命中率条、共用 X 轴」；② 统计口径可在设置里选「按模型 / 按供应商 / 都统计」，都统计时图表上出现切换 chip；③ 配色可在设置里选三套，浅/深跟随系统主题。

- [ ] **Step 3: CHANGELOG 加未发布段落**

在 `CHANGELOG-zh.md` 的 `## [0.1.4]` 之前插入：

```markdown
## [未发布]

### 新增

- **统计口径可选**：按实际模型（跨 provider 合并同名模型）/ 按 API 供应商 / 都统计。都统计时趋势区与「用量拆分」各有一个 chip，可各自切换。
- **配色方案可选**：primer（GitHub 默认）/ cvd（Okabe–Ito 色盲友好）/ muted（低饱和雾面），每套都有浅色与深色两份变量，跟随系统主题自动切换。

### 变更

- **趋势区拆成两段**：上面是 token 堆叠柱，下面是缓存命中率细条，两段共用同一条 X 轴；命中率不再挤在柱图的 0–100% 右轴上。
- **命中率条纵轴改为数据驱动**：统计期的 min/max 决定范围，两端各留 10% 跨度余量；命中率曲线沿用单调三次插值。
- **命中率口径**：miss 侧加入 cacheWrite（hit / (hit + miss)），与官方口径一致；本机 cacheWrite 恒为 0，数值不变。
```

`CHANGELOG.md` 同步加英文段落。

- [ ] **Step 4: 跑全量测试**

Run: `node --test "test/*.test.mjs"`
Expected: 全部 PASS。

- [ ] **Step 5: 提交**

```bash
git add docs/DESIGN.md README.md README-zh.md CHANGELOG.md CHANGELOG-zh.md
git commit -m "docs: 看板 v2 的图表与配色说明，CHANGELOG 未发布段落"
```

- [ ] **Step 6: 手工验证（必须做，headless 覆盖不到指针行为）**

1. 重启 DSH（Host 半改了，热更新不够），打开「Token 用量」看板。
2. 三套配色 × 浅色/深色各看一遍：柱、环形、热力图、命中率线的颜色都要跟着变。
3. 悬停柱子与命中率条：贯穿两段的竖直指示线出现、tooltip 显示当天 token 明细与真实命中率。
4. 切范围（7d / 30d / 全部）与来源筛选：命中率轴与 Top5 顺序随数据重算，chip 状态保留。
5. 把 `groupBy` 设成 `model`：两颗 chip 消失、图表固定按模型；设成 `both` 再回来。
6. 与 `$DSH_HOME/storages/session_projcache/sessions/*.json` 对拍一次总量，确认口径改动没有动到数字。

Expected: 每一条都符合描述；任何一条不符，先修再提交。

---

## 自查（已跑）

- **Spec 覆盖**：spec `2.1 → Task 1；`2.2/`2.3 → Task 2 + Task 5/6 的 Top5+其他；`2.4 → Task 5；`3 → Task 5/6；`4 → Task 3 + Task 6(d)；`5 → Task 4；`6.1 → Task 2；`6.2 → Task 3；`6.3 → Task 5/6；`6.4 → Task 3 的宽松校验 + Task 2 保留 `byModel`/`models`；`7 → Task 5 的边界（空/单日/全等由 `hitRateBand` 覆盖）；`8 → 每个任务的测试步 + Task 7 Step 6；`9 → Task 7；`10 的风险项在 Task 3（枚举写法已实测）与 Task 5（假 DOM 覆盖）各有落点。
- **与 spec 的一处偏差（已说明）**：spec `8 写的「调用 onMouseEnter 后断言两段同时进入 hover」在现有假 React 下做不到（每次渲染重置 hooks，状态不跨渲染保留）。本计划改成「断言行/点都挂了 `onMouseEnter` 且 `data-day` 可对应」，真实联动放进 Task 7 Step 6 的手工验证；spec `10 自己也写了「headless 覆盖不到真实指针行为」，所以两边不冲突。
- **占位符扫描**：无 TBD/TODO；每个改代码的步骤都给了可粘贴的代码块。
- **命名一致性**：`hitRateOf`（Host 与 Client 各一份、同名同义）、`groups.model`/`groups.provider`、`byGroup.model`/`byGroup.provider`、`OTHER_KEY`、`hitRateBand`、`monotonePath`、`TrendSection`、`groupByMode`/`breakdownMode` 全文一致。
