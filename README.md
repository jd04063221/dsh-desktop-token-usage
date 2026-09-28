# dsh-token-usage

一个**完全离线**的 DSH（DeepSeek Harness）token 用量统计插件。

- **Host 半边**扫描 `$DSH_HOME/sessions/**/session.vN.jsonl.zstd`，折叠出真实的 token 用量；
- **Client 半边**在左侧栏底部（Settings 上方）挂一张卡片，点开后在中央面板打开看板：
  时间范围与来源筛选、6 张统计卡、活跃热力图、按天 Token 趋势（按模型堆叠 + 缓存命中率折线）、模型用量环形图与列表。

侧边栏卡片显示哪一段时间的用量由**插件配置**决定（默认关闭两个窗口，卡片显示累计值）：
在 **设置 → 插件 → Token 用量** 里可以分别打开「最近 N 小时」（0-23）与「最近 N 天」（1-30）两个窗口；
两个都关掉就回到累计视图。每个窗口各自显示**输入量、输出量与缓存命中率**。

不联网、不上报、不调用任何 API：所有数字都来自本机已有的会话日志。

## 安装

本仓库是一个 DSH bundle（`package.json` 声明了 `dsh.bundle.patch` 与 `dsh.client`）。用官方入口安装即可，
不需要手改 profile 文件：

```
plugin_manager  action: install_bundle  target: <本目录的绝对路径>
```

因为本包依赖 `@deepseek-ai/schemastery`（官方 Config 卡片需要的 schema 库），而 `install_bundle` 对本地目录
采用 `link:` 安装、**不会**为被链接的包装依赖，所以先在本仓库里装一次：

```
npm install            # 只装 dev/运行依赖，不联网获取任何数据
```

### 改完代码后：客户端热更新，Host 需要重启

| 改了哪半边 | 怎么生效 |
|---|---|
| `client.js`（界面） | 浏览器端的模块快照按 mtime/size 变更后由 HMR 推给页面；没生效就硬刷新一次页面（Ctrl/Cmd+Shift+R） |
| `index.js` / `lib/*`（Host） | **必须重启 DSH**：重新启用条目只会重挂 fiber，不会重新导入已缓存的 JS 模块代。同理，新增/修改 `Config` 字段也要重启才会出现在设置里 |

判断当前跑的是哪一版：看 `$DSH_HOME/cache/dsh-token-usage/boot.json` 是否存在、`windows` 是否符合预期。

卸载：`plugin_manager action: remove_bundle target: dsh-token-usage`。

## 使用

1. 看**左侧栏底部**、Settings 上方那张卡片：按配置显示各窗口的输入/输出量与缓存命中率；
2. 点它 → 中央面板打开看板；
3. 看板顶部可按**时间范围**（最近 7/14/30/90 天、全部、自定义）与**来源**筛选，右下角有刷新按钮。

筛选与汇总都在 Host 完成：每次改动都会重新向 Host 请求一次聚合结果（Host 侧有按文件 mtime+size 的索引缓存，
热调用在百毫秒级）。卡片每 5 分钟静默刷新一次——小时窗口本来就随时间滑动，即使没有新的用量也应该更新。

### 活跃热力图怎么读

- 是**日历**（周一对齐、近 53 周），带**月份**与**星期**坐标；格子固定 11px，不会随面板宽度被拉伸；
- 色阶取**非零日的四分位**，而不是"当日 ÷ 最大值"——后者只要有一天特别大，其余就全被压成同一档灰；
- 顶部可切换 **Tokens / 轮次**；默认选**有数据天数更多**的那一维（导入历史较多的机器上 token 很少，
  默认按 token 画会几乎是空网格）；
- 它**跟随来源筛选，但不受时间范围影响**：日历被筛成 7 天，就是"一年网格里亮 7 格"，那正是热力图不该有的样子。

## 配置项

在 **插件 → Token 用量** 页里编辑（侧边栏 `Plugins` 入口 → Token 用量）：页面中部会出现
「侧边栏卡片显示的时间跨度」两个输入框与保存按钮。

DSH **不会**从 `Config` schema 自动生成编辑器——自己带配置的插件必须把表单渲染到
`plugins.bundle.config` 槽（按包名寻址）。本插件就是这么做的：保存时调用官方 `configEditor`，
值最终落在 profile 的 `cordis.patch.yml` 里，所以也可以直接在那里写：

```yaml
- id: dsh-token-usage
  disabled: false
  config:
    hours: 6
    days: 7
```

| 键 | 默认 | 说明 |
|---|---|---|
| `hours` | `0` | 侧边栏卡片显示最近多少小时的用量（0-23）。`0` = 关闭这个窗口 |
| `days` | `0` | 侧边栏卡片显示最近多少天的用量（1-30）。`0` = 关闭这个窗口 |

两个都关（默认）时卡片显示累计值，与没有这两个参数之前一样。窗口按**本地时间**取整到小时：
「最近 6 小时」= 从 6 小时前的整点开始算。

保存后**立即生效**：Cordis 的 `fiber.update()` 会重启这个插件的 fiber，`apply` 会带着新配置再跑一次
（所以每次改值不需要重启 DSH）；表单保存后会自动重新读取配置并刷新卡片。


## 数据口径

这一节很重要——数字的含义完全由 DSH 的日志语义决定。

| 指标 | 口径 |
|---|---|
| Tokens 用量 | `未缓存输入 + 输出 + 缓存读取 + 缓存写入` |
| **输入量**（卡片） | `未缓存输入 + 缓存读取`——即 provider 实际收到的全部提示词 token |
| **输出量**（卡片） | `usage.outputTokens`（`reasoningTokens` 是它的**子集**，绝不重复计入） |
| 未缓存输入 | `usage.inputTokens`——**provider 原生字段里它就是「未命中缓存」的那部分**，DSH 自己的投影把它重命名为 `uncachedInputTokens` |
| 缓存读取 / 写入 | `usage.cacheReadTokens` / `usage.cacheWriteTokens` |
| 平均缓存命中率 | `缓存读取 ÷ (缓存读取 + 未缓存输入)` |
| 请求数量 | 结算后的模型调用次数（见下面的「折叠」） |
| 完成轮次 | `turn/end` 事件数 |
| 活跃天数 | 有 token 或轮次的本地日期数（按**本地时区**，不是 UTC） |

**折叠语义（容易算错的地方）**：同一条 `(turn, step)` 内后一条 usage 会**替换**前一条——流式数字被最终
结算覆盖；只有 `llm/retry-started` 关掉槽位之后，重试的另一次调用才**累加**。所以「总量 = 所有 usage 求和」
是错的，必须折叠。本插件的折叠逻辑与 `dsh-token-meter` 的 `tokenUsage` 投影逐行对应，并有测试对拍。

### 来源筛选为什么只有三项

DSH 0.1.7-rc.2 的会话日志里**没有**「客户端来源」字段：`SessionHeader` 只有
`version/id/createdAt/cwd/parentSession/isSeeded/origin/delegationDepth/agentPreset`，而 `origin` 唯一取值是
`'subagent'`。桌面端与网页端在本地数据上无法区分。因此看板只提供**可由本地信号推导**的三项：

| 标签 | 判定依据 |
|---|---|
| 桌面·网页 | 存在真实用户轮次（`user/message` 且 `source.kind ∈ {user, user-approval}`）且带 `source.rpcId` |
| 命令行·机器人 | 有真实用户轮次但**没有** `rpcId`（headless / SDK / ACP / 机器人等无客户端驱动） |
| 子代理 | `header.origin === 'subagent'` 或 `delegationDepth > 0` |

没有任何用户轮次的会话（例如只跑过斜杠命令）计入「全部」，不单列。

## 已知限制

- **首次聚合较慢**：约 150 个会话文件、9 万+ 条记录，冷启动约 3–4 秒；之后按文件指纹增量，热调用百毫秒级。
  缓存写在 `$DSH_HOME/cache/dsh-token-usage/sessions-index.json`，删掉它只会让下次变慢。
- **导入的历史会话可能用量为 0**：如果历史会话是导入的（例如 reasonix 迁移），其 usage 字段确实全为 0，
  这是有效数据，不是缺失，本插件不会回退去估算。
- **界面文案为中文硬编码**：没有接 Client locale 服务，避免多引入一条会随版本变化的依赖。
- **窗口取整到小时**：日志里没有分钟级分桶，所以「最近 1 小时」按整点对齐。
- **卡片刷新有延迟**：没有 Host→Client 的推送通道，卡片靠 5 分钟定时静默刷新；刚改完配置或刚想立刻更新时，
  点一下卡片打开看板再点「刷新」即可。

## 验证状态

已完成的验证（详见 `docs/DESIGN.md` 的「验证证据」一节）：

- 折叠结果与 **DSH 自己的投影缓存**逐字段一致（`session-5964a5d3-*`：`286650 / 182633 / 43826560 / 0`）；
- 日与模型两个维度的汇总都能重新加总回总量，按天/按小时的毫秒区间能精确划分总量；
- 卡片窗口汇总：每个窗口只能小于等于累计值、输入输出拆分的恒等式、参数越界（`hours=99`/`days=-3`）被夹紧；
- `Config` schema 用 Standard Schema 接口验证：默认 0/0，`hours=24`、`days=31` 被拒；
- Host 描述符与 Client contribution 在测试里**逐字段对拍**，参数编解码器接受浏览器实际会发的值；
- 客户端两半在无浏览器环境下用假 React/DOM 渲染通过（含卡片窗口行与累计回退两种形态），样式注入与卸载有断言；
- 安装后 `include:dsh-token-usage` 的 `fiberPhase` 为 `active`，`sidebar.footer.action` 与 `main` 里都出现
  `dsh-token-usage`（`active: true`）；
- 浏览器 → Host 的 RPC 已被证明打通（Host 侧索引在页面调用后被重写）。

**未完成 / 需要你确认**：

1. 本环境无浏览器控制，看板的视觉与数字需要你肉眼确认；
2. **配置表单的首次生效需要重启一次 DSH**：DSH 缓存已导入的 JS 模块代，重新启用条目只重挂 fiber。
   重启后 **插件 → Token 用量** 页面中部会出现那张配置卡（`Config.listConfigs` 的状态也会从
   `absent` 变成 `schema`）。

### 出问题时先看哪里

`$DSH_HOME/cache/dsh-token-usage/` 下有两个自诊断文件：

- `boot.json`：Host 激活链路（`appliedAt`/`injectedAt`/`providedAt`/`registeredAt`）与生效的 `windows`，
  有 `error` 就说明卡在哪一步；**文件不存在说明当前跑的是更早的 Host 模块代，需要重启**；
- `calls.json`：最近 20 次看板请求（筛选条件、窗口、会话数、总 token、耗时）。若浏览器从未请求过，
  说明是客户端模块没加载或没重载 —— **硬刷新页面**（Ctrl/Cmd+Shift+R）；Host 侧改动只能靠重启。

另外，`Config.listConfigs` 的 `status` 直接告诉你 Host 模块代是否包含本插件的配置：
`absent` = 当前 fiber 的模块没有 `Config` 导出（旧模块代，设置里不会有选项）；
`schema` = 已识别到 schemastery schema，设置里会出现 `hours` / `days`。
客户端旧于 Host 也会出问题——所以客户端在拿不到 `card` 字段时会**回退到累计值**，不会停在"正在读取"。

## 开发

```
npm install     # 装 @deepseek-ai/schemastery（link 安装不会为被链接的包装依赖）
npm test        # node --test：聚合黄金对拍 + 窗口汇总 + 客户端无浏览器冒烟测试
```

目录：

```
index.js                     Host 半边：Config（schemastery）+ 注册用量 Remote 服务
client.js                    Client 半边：窗口 __ModuleLoader__ 工厂 + 看板与侧边栏卡片
lib/session-usage.js         纯 Node 聚合：多帧 zstd 读取、折叠、按小时分桶、窗口汇总、索引缓存
test/session-usage.test.mjs  聚合、毫秒区间、卡片窗口、日历、Config schema、Remote 服务
test/client-smoke.test.mjs   客户端工厂 / 槽位注册 / 两半 wire 契约对拍 / 渲染
docs/DESIGN.md               设计、数据契约、踩过的坑与验证证据
docs/research/               前期调研记录与可复用的会话日志探针脚本
CHANGELOG.md                 版本变更记录（含提交索引）
```

## License

MIT
