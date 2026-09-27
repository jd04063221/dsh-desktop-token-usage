# 设计说明

面向 DSH 0.1.7-rc.2（桌面版，profile `desktop`）。记录数据契约、关键取舍，以及为什么某些看起来"绕"的写法是必须的。

## 1. 数据从哪来

唯一数据源是**本机已有的会话日志**：

```
$DSH_HOME/sessions/<workspace-slug>/<session-id>/session.vN.jsonl.zstd
```

同一个会话目录可能有多个 generation（`session.jsonl` / `session.v4.jsonl`…），取数值最高的那个。
子会话是**独立文件**，与父会话同处一个 workspace 目录下，靠 header 里的 `origin: 'subagent'` /
`delegationDepth > 0` 识别。

### 1.1 这些文件是「多个 zstd 帧首尾拼接」

实测最大的文件 2.7 MB 里串了 **4779 个独立帧**（每批 append 一帧，带校验和）。后果：

- `zlib.zstdDecompressSync(整文件)` 与 `createZstdDecompress()` 都**只解第一帧**——你只会拿到那行
  `{"type":"session",…}` 头部记录，然后以为日志是空的；
- **不能**用「搜索魔数 `28 B5 2F FD` 然后切分」来定位帧边界：压缩块内部也会出现同样的字节序列，会误切。

正确做法是复刻官方 `dsh-session-persistence-jsonl` 的结构化帧扫描：读魔数 → frame descriptor →
逐个 block header 累加长度，**完全不解压**地算出每帧的 `[start, end)`，再逐段 `zstdDecompressSync`。
`lib/session-usage.js` 的 `scanZstdFrames` 就是这段逻辑。实测该文件扫描 2.9 ms + 逐帧解压 140 ms。

### 1.2 token 用量只在一个地方

`assistant/message` → `data.usage.{inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens, reasoningTokens}`。
`assistant/attempt` 是回退路径（读 `data.stream` 里最后一个 `{type:'chunk', chunk:{type:'usage'}}`），本机 0 条命中。

```
total = inputTokens + outputTokens + cacheReadTokens + cacheWriteTokens
```

- `inputTokens` **本身就是「未命中缓存」的输入**（DSH 自己的投影把它改名成 `uncachedInputTokens`）；
- `reasoningTokens` 是 `outputTokens` 的**子集**，加进去就重复计数。

### 1.3 必须「折叠」，不能直接求和

官方 `dsh-token-meter` 的 `tokenUsage` 投影维护**一个** `last` 槽位：

```
同 (turn, step) 且 last 匹​​配 → 先减掉旧值再加新值（流式数字被最终结算替换）
llm/retry-started 清空 last  → 下一次调用改为累加
```

所以「总量 = 全部 usage 求和」在重试场景会偏大。本机数据恰好没有任何 `(turn, step)` 重复，
因此 `fold == 朴素求和`——但实现必须是折叠形式，否则一旦出现重试就会算错。
`foldUsage()` 同时把每个**结算后的**槽位连同其发生时间与模型记下来，供按天/按模型归因（逐条精确，不做比例分摊）。

## 2. 为什么 Host 半边「零 import」

这是本次最贵的一课。

DSH 的官方包（`@deepseek-ai/*`）**只存在于 DSH 安装目录内**，不在 profile 的 `node_modules` 里。
一个 profile bundle 里写：

```js
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'   // ← 会挂
```

结果是整条 entry 直接 `ERR_MODULE_NOT_FOUND`，入口状态 `failed to import`，插件完全不激活。
复现（普通 Node 按 profile 目录解析）：

```
> cd ~/.dsh/profiles/desktop
> node -e "import('dsh-token-usage')"
ERR_MODULE_NOT_FOUND: Cannot find package '@deepseek-ai/dsh-typert-protocol' imported from .../index.js
```

顺带发现：机器上已安装的 `@mars-sea/dsh-commandcode-provider` 也踩了同一个坑（它的 host 半边 import
`@deepseek-ai/dsh-timeout` 失败），只有它的**客户端**半边在工作——所以列表里能看到它的卡片，但它的 host 服务
`commandcodeUsage` 并不存在。

**这条约束的边界**：`install_bundle` 对本地目录采用 `link:` 安装，pnpm **不会为被链接的包装依赖**，
所以「声明成真依赖」只在包被真正装进 profile（而非 link）时才自动生效；link 场景下依赖必须由本仓库自己
`npm install` 提供（见 README）。这也是为什么本包只留了**唯一一个** `@deepseek-ai/*` import —— 官方 Config
卡片必需的 `@deepseek-ai/schemastery`；它在 `dependencies` 里，且安装后 `node -e "import(...)"` 可解析。
schemastery 的 schema 用 Standard Schema（`~standard`）暴露校验，`resolveConfig` 只调
`Config['~standard'].validate()`，loader 的 `isSchemastery` 只看 `~standard.vendor === 'schemastery'`，
所以即使 profile 里存在另一份 schemastery 副本也不会互不认。

### 2.1 于是自己搭最小服务

`TypertRemoteService` 基类只做两件公开的事，读完 `@deepseek-ai/cordis` 与 `dsh-api-gateway` 的源码后可以照做：

1. 注册 Cordis 服务：`ctx.reflect.provide(serviceKey, value)`（`Service` 的构造函数内部就是这一句）；
2. 盖一个可见绑定，网关 `validateBinding` 会逐字段校验它：

```js
service.typertRemote = Object.freeze({ service, serviceKey, namespace })
```

网关的检查是（`dsh-api-gateway/lib/index.js`）：

```
receiver = ctx.get(descriptor.service)           // 必须是个对象
binding  = Reflect.get(originalOf(receiver), 'typertRemote')
binding.service === original && binding.serviceKey === serviceKey
                              && binding.namespace === namespace
method   = Reflect.get(callReceiver, descriptor.method)   // 必须是函数
```

另外 `descriptor = ctx.typert.local.get(endpoint)`，其中 `endpoint = `${namespace}/${method}``；
描述符在 `dsh-typert-registry` 里还要过一遍 `validateInvocation`（id/service/namespace/method 非空、
codec 合法、JSON 参数不得声明 `lookup`）。这些都已按源码对齐。`describe` 用的
"no catalogued Service" 报错只查**编译期生成的目录**，看不到运行时动态提供的服务，因此不能用来判断服务是否存在。

### 2.2 描述符两侧必须逐字段一致

Host 的 `typert.register({...invocations})` 与 Client 的 `ctx.remote.$mount({...descriptors})` 各写一份，
任何不一致都会让 RPC 静默失败。因此 `test/client-smoke.test.mjs` 把两半的描述符**逐字段对拍**
（`id / service / namespace / method / invocation.kind / result.typeSymbol / parameters[*].{name,wire,source,acceptsUndefined,codec.typeSymbol}`）。

### 2.3 Remote 方法返回的是 `{ ok, value }` 信封，失败也不抛异常

最容易踩、且症状极具误导性的一个坑。客户端 `namespace.summary(args)` 的返回值**不是** payload，而是：

```js
{ ok: true,  value: <业务结果> }
{ ok: false, error: { code, message } }
```

依据：客户端网关 `dsh-api-gateway/lib/client.js` 的 `invoke()` 返回 `{ok,value}` / `{ok:false,error}`，而
`RemoteNamespaceService.install()` 的 getter 原样返回它（**不拆包**）；可工作插件 commandcode 的客户端也是
这么用的（`const response = await this.remote.report(); if (response.ok) … response.value … else … response.error.message`）。

把信封当 payload 的后果（本插件第一版就是这样）：`data.totals` 是 `undefined` → 视图在
`totals.totalTokens` 处抛错 → **整个面板空白**、侧边栏卡片只剩一个 `0`。而 Host 侧一切正常，
`calls.json` 里也看不到错误——因为错误发生在浏览器里。

教训：**测试里的假实现必须复刻真实信封形状**，否则测试会替你把 bug 藏起来（本仓库的假实现已改成
返回 `{ok:true,value}`，并新增 `ok:false` 用例）。

### 2.4 配置：侧边栏卡片的两个窗口

需求是「卡片显示哪一段时间的用量可选（近几小时 / 近几天）」。做法：

- `index.js` 导出官方 `Config`（`Schema.object({ hours, days })`，`0` 表示关闭），卡片窗口因此可以在
  **设置 → 插件** 里改，也能写进 profile 的 `cordis.patch.yml`；
- **窗口由 Host 解析**，随每次 `summary` 响应一起返回 `card: { hours, days, blocks, all }`，浏览器不需要知道
  配置值，也不需要二次请求；两个窗口都关时返回 `all`（累计），与没有这个功能时完全一致；
- 每个 block 自带 `inputTokens = 未缓存输入 + 缓存读取`、`outputTokens`、`cacheHitRate`，视图只负责排版
  （`输入 x · 输出 y` 与缓存命中率），不做任何口径推导。

**为什么把内部桶从「天」换成「小时」**：`logs` 里没有任何分钟级标记，按天分桶根本表达不了「最近 6 小时」。
现在索引按**本地小时**（`YYYY-MM-DDTHH`）存桶，`summarize({sinceMs, untilMs})` 以「小时与区间相交」判定包含关系，
天视图由 Host 从小时桶归并（图表用的 `days` 仍是 Host 算的，视图不合并）。代价是索引缓存版本从 1 升到 2
（首次会重建一次）。`hours` 上限 23、`days` 上限 30，越界值在 `lib/session-usage.js` 里夹紧（有测试）。

**改配置不需要重启**：Cordis 的 `fiber.update(config)` 对活动 fiber 会走
`this._resolveConfig(config)` → `internal/update` → **`this.restart()`**，也就是带着新配置重新执行 `apply`；
`resolveConfig` 会用本插件的 schema 校验并填默认值。所以设置里保存即生效，卡片在下一次调用时体现。

### 2.5 Host 模块代是缓存的：改 Host 半边必须重启

实测：`plugin_manager action: set_plugin` 关掉再打开只会**重挂 fiber**，不会重新导入已经缓存的 JS 模块代。
所以反复「重新启用」看到的一直是第一版 host 代码：`Config.listConfigs` 持续报 `absent`、
诊断文件不更新、`apply` 收到的仍是旧 config。判断当前跑的是哪一版，看 `boot.json` 是否存在即可。

| 改动的半边 | 生效方式 |
|---|---|
| `client.js` | 客户端模块快照按 mtime/size 变更，HMR 推给页面；必要时硬刷新 |
| `index.js` / `lib/*` | **重启 DSH**（`remove_bundle` + 重新 `install_bundle` 也不够，specifier 未变） |

这也解释了为什么本次交付里「配置卡生效」只能标注为**待重启后确认**。

## 3. 为什么筛选放在 Host

看板的筛选维度（时间范围 × 来源）如果放到浏览器算，就得把「按天 × 模型 × 来源」的求和逻辑写第二遍。
现在的分工是：

- Host（`lib/session-usage.js`）拥有**唯一一份**汇总数学，接收 `{sinceDay, untilDay, sources}`，返回已经算好的
  `totals / days / models`；
- Client 只做渲染与筛选交互，筛选变化即重新调用一次 Remote。

代价是每次改筛选多一次本机 RPC（Host 有索引缓存，热调用百毫秒级）；收益是口径只可能错一次。

### 3.1 索引缓存

`buildIndex()` 按 `(mtimeMs, size)` 作为单个会话文件的身份（日志只追加，追加必然同时改动这两者）：

- 进程内 memo：一次热请求里未变的文件不重复解析；
- 磁盘缓存 `$DSH_HOME/cache/dsh-token-usage/sessions-index.json`：重启后冷启动也只需解析变化的文件。

实测：151 个文件 / 93,354 条记录，冷解析 3.5–4.0 s，热调用（含 Node 启动）4–254 ms。

## 4. Client 半边

### 4.1 只有 React 可以用

官方 `cordis-plugin-development` skill 的 `references/practices.md` 写得很直接：**不要** require
`@deepseek-ai/dsh-client-ui-primitives` 或任何 Harness 客户端包——它们会变，而纯 JS 插件没有类型检查，
一个抛错的组件会让你整个 slot entry 变成空白。所以：

- `client.js` 只 `require('react')`（浏览器模块表的内置项），所有控件、图表、样式手写；
- 样式只用 `--dsw-alias-*` 主题 token（`cordis_inspect_query` 的 `Theme` 列出的那 14 个），
  图表配色用字面量色值——按官方说法字面量只用于"artwork"；
- 样式标签在 `apply` 里用 `ctx.effect` 注入并在卸载时移除，不在组件里注入；
- 不做 locale 命名空间，中文文案直接写在模块里，少一条会随版本变化的链路。

### 4.2 挂载点

跟随参考实现（`@mars-sea/dsh-commandcode-provider`）的选择，用**侧边栏底部卡片**而不是顶部图标列表：

| 槽位 | 注册 | 说明 |
|---|---|---|
| `main`（keyed） | `{ name:'main', key:'dsh-token-usage', inject: face }` | 中央面板本体 |
| `sidebar.footer.action`（list） | 在 `ctx.inject(['layout'], …)` 里注册 `{ id:'dsh-token-usage', order:5, inject: face }` | 侧边栏卡片；外壳只给 `wide` 这个 owner prop，卡片自己负责 chrome 与 `aria-label` |

点卡片走 `ctx.get('layout')?.selectPanel('dsh-token-usage')`；`selectPanel` 会先校验 `main` 注册表。

### 4.3 图表怎么画

不引入图表库：

- **热力图**：CSS grid（`grid-auto-flow: column` + 7 行），格子用主题背景色 + 内层 `opacity` 分级，
  固定 53 周 × 7 天，日期按本地时区逐格推算；
- **趋势图**：柱子是 flex 列 + 百分比高度的堆叠 div（文字由 HTML 渲染，保持清晰），
  缓存命中率折线用一层 `preserveAspectRatio="none"` 的 SVG overlay（折线没有文字，压缩不失真）；
- **环形图**：SVG `circle` + `stroke-dasharray/​stroke-dashoffset`，按占比切段。

## 5. 验证证据

| 项 | 方式 | 结果 |
|---|---|---|
| 多帧 zstd 读取 | 对 2.7 MB / 4779 帧的真实文件扫描并解析 | 4779 条记录，首条为会话头 |
| 折叠正确性 | 与 DSH 自己的投影缓存 `session-5964a5d3-*.json` 的 `rows.tokenUsage.val.totals` 对拍 | `[286650, 182633, 43826560, 0]` 完全一致 |
| 汇总自洽 | 日汇总、模型汇总都能重新加总回总量；按天/按小时的毫秒区间能精确划分总量；来源筛选只能收窄 | 通过 |
| 卡片窗口 | 每个窗口 ≤ 累计值；输入/输出拆分恒等式；`hours=99`/`days=-3` 被夹紧；两窗口都关时回退到 `all` | 通过 |
| Config schema | Standard Schema `~standard.validate`：默认 `0/0`，`hours=24`/`days=31` 被拒 | 通过 |
| 两半 wire 契约 | 描述符逐字段对拍 + 参数 codec 喂真实取值（含越界与非法类型） | 通过 |
| 客户端可运行 | 假 React/DOM 下加载工厂、`apply`、渲染卡片（窗口行 / 累计回退）与看板、断言样式注入与卸载、刷新定时器已挂 | 通过（16/16 测试） |
| 实际激活 | `plugin_manager list_plugins` → `include:dsh-token-usage` | `fiberPhase: active` |
| 客户端挂载 | `Slots.listSubTree` → `sidebar.footer.action` / `main` | `dsh-token-usage`（`active: true`），两处都在 |
| 浏览器 → Host RPC | 页面调用后 `$DSH_HOME/cache/dsh-token-usage/sessions-index.json` 被重写 | 打通 |
| **配置卡生效** | 需要重启 DSH 后 `Config.listConfigs` 报 `schema` | **待重启确认** |
| **视觉与数字** | **需要人眼确认** | 本环境无浏览器控制，未验证 |


### 5.1 看板没数据时先看这两个文件

Host 会把自诊断写到 `$DSH_HOME/cache/dsh-token-usage/`：

| 文件 | 内容 | 怎么用 |
|---|---|---|
| `boot.json` | Host 激活链路的四个时间戳与可选 `error` | 缺 `injectedAt` 说明 `typert` 服务没注入；有 `error` 说明注册被拒 |
| `calls.json` | 最近 20 次 `summary` 调用（筛选条件、会话数、总 token、耗时） | 浏览器**从没**请求过 → 问题在客户端 mount/模块加载；有记录但数字不对 → 问题在聚合口径 |

注意 `calls.json` 只在 Host 方法**被真正执行**时写入：若请求被网关在 `prepareInvocation` 阶段拒绝
（描述符没注册、绑定不合法），不会有记录——所以它在，说明链接通；它不在，不能单独证明链接不通，
要结合 `boot.json` 一起看。

## 6. 后续可做

- 会话明细表（数据已在 `summarize` 的中间结构里，只是没有暴露到 payload）；
- 成本估算（需要单价表，会引入外部数据，与"不联网"取舍冲突）；
- 若将来 DSH 的会话 header 增加客户端来源字段，把来源筛选扩到六项，判定函数集中在 `inferSurface`。
