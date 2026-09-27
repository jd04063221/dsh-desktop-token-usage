# dsh-token-usage

一个**完全离线**的 DSH（DeepSeek Harness）token 用量统计插件。

- **Host 半边**扫描 `$DSH_HOME/sessions/**/session.vN.jsonl.zstd`，折叠出真实的 token 用量；
- **Client 半边**在左侧栏底部（Settings 上方）挂一张紧凑卡片，点开后在中央面板打开看板：
  时间范围与来源筛选、6 张统计卡、活跃热力图、按天 Token 趋势（按模型堆叠 + 缓存命中率折线）、模型用量环形图与列表。

不联网、不上报、不调用任何 API：所有数字都来自本机已有的会话日志。

## 安装

本仓库是一个 DSH bundle（`package.json` 声明了 `dsh.bundle.patch` 与 `dsh.client`）。用官方入口安装即可，
不需要手改 profile 文件、也不需要跑 pnpm：

```
plugin_manager  action: install_bundle  target: <本目录的绝对路径>
```

安装后：

- Host 半边随 bundle 激活（无需重启，`patchReload: live`）；
- Client 半边由 `dsh-client-modules` 扫描进浏览器启动图，HMR 会把它推给已打开的页面；
  若卡片没出现，硬刷新页面（Ctrl/Cmd+Shift+R）一次即可。

卸载：`plugin_manager action: remove_bundle target: dsh-token-usage`。

## 使用

1. 看**左侧栏底部**、Settings 上方那张卡片：显示总 token 数与缓存命中率；
2. 点它 → 中央面板打开看板；
3. 看板顶部可按**时间范围**（最近 7/14/30/90 天、全部、自定义）与**来源**筛选，右下角有刷新按钮。

筛选在后端完成：每次改动都会重新向 Host 请求一次聚合结果（Host 侧有按文件 mtime+size 的索引缓存，
热调用在百毫秒级）。

## 数据口径

这一节很重要——数字的含义完全由 DSH 的日志语义决定。

| 指标 | 口径 |
|---|---|
| Tokens 用量 | `未缓存输入 + 输出 + 缓存读取 + 缓存写入` |
| 未缓存输入 | `usage.inputTokens`——**provider 原生字段里它就是「未命中缓存」的那部分**，DSH 自己的投影把它重命名为 `uncachedInputTokens` |
| 缓存读取 / 写入 | `usage.cacheReadTokens` / `usage.cacheWriteTokens` |
| 输出 | `usage.outputTokens`（`reasoningTokens` 是它的**子集**，绝不重复计入） |
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

## 验证状态

已完成的验证（详见 `docs/DESIGN.md` 的「验证证据」一节）：

- 折叠结果与 **DSH 自己的投影缓存**逐字段一致（`session-5964a5d3-*`：`286650 / 182633 / 43826560 / 0`）；
- 日与模型两个维度的汇总都能重新加总回总量，逐日筛选能精确划分总量；
- Host 描述符与 Client contribution 在测试里**逐字段对拍**，参数编解码器接受浏览器实际会发的值；
- 客户端两半在无浏览器环境下用假 React/DOM 渲染通过，样式注入与卸载有断言；
- 安装后 `include:dsh-token-usage` 的 `fiberPhase` 为 `active`，`sidebar.footer.action` 里出现
  `dsh-token-usage`（`active: true`）——即 Host 导入成功、客户端 bundle 已被页面加载。

**未完成**：无法在本环境直接读取渲染后的像素或浏览器控制台，所以"看板长什么样、数字对不对"需要你肉眼确认一次。

## 开发

```
npm test        # node --test：聚合黄金对拍 + 客户端无浏览器冒烟测试
```

目录：

```
index.js                     Host 半边：注册 Remote 服务（零 import，见 docs/DESIGN.md）
client.js                    Client 半边：窗口 __ModuleLoader__ 工厂 + 看板与侧边栏卡片
lib/session-usage.js         纯 Node 聚合：多帧 zstd 读取、折叠、按天/模型汇总、索引缓存
test/session-usage.test.mjs  聚合与黄金对拍
test/client-smoke.test.mjs   客户端工厂 / 槽位注册 / 两半 wire 契约对拍
docs/DESIGN.md               设计、数据契约、踩过的坑与验证证据
docs/research/               前期调研记录与可复用的会话日志探针脚本
```

## License

MIT
