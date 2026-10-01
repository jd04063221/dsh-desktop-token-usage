# DSH｜dsh-desktop-token-usage（Token 用量看板）｜在本机离线统计并可视化 DSH 的 token 用量

> **非官方项目，由社区成员独立开发和维护。**

**项目地址**

- GitHub：<https://github.com/jd04063221/dsh-desktop-token-usage>
- npm：<https://www.npmjs.com/package/dsh-desktop-token-usage>
- 许可证：MIT｜当前 npm 最新版：0.1.5（仓库 `main` 另有待发布的 0.1.6，见文末「版本说明」）

**项目介绍**

一个**完全离线**的 DSH（DeepSeek Harness）token 用量统计插件。它不联网、不上报、不调用任何 API：
**Host 半边**扫描本机已有的会话日志 `$DSH_HOME/sessions/**/session.vN.jsonl.zstd`，按 DSH 自身的折叠语义
折算出真实用量；**Client 半边**在左侧栏底部挂一张用量卡片，点开就在中央面板打开完整看板。

它能看什么：

- **侧边栏卡片**：按插件配置显示「最近 N 小时」「最近 N 天」两个窗口的输入/输出量与缓存命中率，
  每 5 分钟静默刷新（小时窗口本身随时钟滑动）；
- **看板**：时间范围筛选（最近 7/14/30/90 天、全部、自定义）与来源筛选（桌面·网页 / 命令行·机器人 / 子代理）、
  6 张统计卡、「配置窗口」一行、活跃热力图、按天 Token 趋势、模型用量环形图与列表；
- **活跃热力图**：周一对齐的日历（近 53 周），带月份与星期坐标；色阶取**非零日的四分位**而不是「当日 ÷ 最大值」，
  顶部可在 Tokens / 轮次之间切换，默认选有数据天数更多的那一维；它跟随来源筛选，但刻意不受时间范围影响；
- **按天趋势**：token 堆叠柱上叠加缓存命中率曲线（右侧标真实百分比，纵轴按统计期最小值/最大值留 10% 余量）；
- **设置页**（设置 → 插件 → Token 用量）：两个窗口的跨度（小时 0–23、天数 1–30）、统计口径
  （按模型 / 按供应商 / 都统计）与配色方案（primer / cvd / muted 三套，各自的浅色与深色跟随 DSH 自己的明暗开关）；
- **多语言**（`main` 上待发布的 0.1.6，npm 上的 0.1.5 尚无）：看板跟随 **DSH 自身的语言设置**，插件没有自己的语言选择器；内置 en / zh 字典，
  另把 zh-TW、zh-HK、de、fr、es、it、ja、ko 注册进 DSH 的语言目录；数字、百分比、日期与复数全部走 `Intl`。

**与 DSH 的集成方式**

这是一个标准 DSH bundle，两半各司其职：

1. **安装与加载**：`package.json` 声明 `dsh.bundle.patch`（`cordis.patch.yml`）与 `dsh.client`，
   用官方入口 `plugin_manager action: install_bundle` 装进 profile，之后由 Cordis 加载这一行；
2. **Host 半边（`index.js` + `lib/session-usage.js`）**：用 `@deepseek-ai/schemastery` 定义插件 `Config`，
   注册用量 Remote 服务，负责读日志、折叠用量、按小时分桶、做窗口汇总；索引缓存在
   `$DSH_HOME/cache/dsh-desktop-token-usage/sessions-index.json`，按文件 mtime+size 判定增量；
3. **Client 半边（`client.js`）**：按官方 `__ModuleLoader__` 工厂注册，挂在
   `sidebar.footer.action` 槽与中央 `main` 面板上。侧边栏那条 footer 是横向行且每个插件都声明
   `width: 100%`（实测本插件卡片被挤到 105.2px），所以卡片用
   `[class*="_footerActions"]:has(.dtu-footCard)` 把席位变成纵向列，让席位里每个插件都拿到整行
   （不依赖 DSH 的哈希类名，也不碰任何祖先元素）；
4. **浏览器 → Host 的 Remote 调用**：走 `@deepseek-ai/dsh-api-remotes`。筛选与聚合都在 Host 完成，
   每次改动都是一次真实的 Radix 调用，而不是在客户端重算；
5. **配置链路**：DSH 不会从 `Config` schema 自动生成编辑器，所以插件把表单渲染到
   `plugins.bundle.config` 槽（按**包名**寻址），保存时调用官方 `configEditor`，值最终落在 profile 的
   `cordis.patch.yml` 里；保存后 Cordis 的 `fiber.update()` 重启本插件 fiber，配置**立即生效、无需重启 DSH**；
6. **语言链路**：`ctx.inject(['locale'])` 把 8 个语言包注册进 DSH 的语言目录，于是它们出现在 DSH 自己的语言选择器里；
7. **口径对齐**：折叠逻辑与 DSH 自身 `dsh-token-meter` 的 `tokenUsage` 投影逐行对应并有测试对拍——
   同一条 `(turn, step)` 内后一条 usage **替换**前一条（流式数字被最终结算覆盖），只有 `llm/retry-started`
   关掉槽位后重试的另一次调用才**累加**，所以「总量 = 所有 usage 求和」是错的。

**写入磁盘的内容**：只有一个自己的目录 `$DSH_HOME/cache/dsh-desktop-token-usage/`（索引缓存 + 两个自诊断文件）。
不在会话日志旁写任何东西，不在 `$DSH_HOME` 其他位置创建/修改/删除文件，也从不访问网络；两处写入都是原子的
（先写 `<name>.<pid>.tmp` 再 rename 覆盖）。

**截图**

![看板·浅色](https://raw.githubusercontent.com/jd04063221/dsh-desktop-token-usage/main/assets/dashboard-light.png)

*看板（浅色）：6 张统计卡、「配置窗口」一行、活跃热力图、按天 Token 趋势（命中率曲线叠加在柱上）、模型用量拆分。*

![看板·深色](https://raw.githubusercontent.com/jd04063221/dsh-desktop-token-usage/main/assets/dashboard-dark.png)

*同一张看板的深色主题——三套配色各自都有浅色与深色两份。*

| 活跃热力图 | 按天趋势 |
|---|---|
| ![活跃热力图](https://raw.githubusercontent.com/jd04063221/dsh-desktop-token-usage/main/assets/heatmap-light.png) | ![按天趋势](https://raw.githubusercontent.com/jd04063221/dsh-desktop-token-usage/main/assets/trend-light.png) |

| 侧边栏卡片 | 插件页（设置） |
|---|---|
| ![侧边栏卡片](https://raw.githubusercontent.com/jd04063221/dsh-desktop-token-usage/main/assets/sidebar-dark.png) | ![设置页](https://raw.githubusercontent.com/jd04063221/dsh-desktop-token-usage/main/assets/settings-light.png) |

> 截图由插件**自己的组件**离线渲染、数据为**示例数据**（`scripts/render-shots.mjs` + 无头 Chrome），
> 不涉及任何真实会话日志、路径或账号信息。

**安装**

直接用 npm 上的包名安装即可（`install_bundle` 接受 registry 包名：它先用 `pnpm view` 查询注册表，
再以 `pnpm add` 装进当前 profile）：

```
plugin_manager  action: install_bundle  target: dsh-desktop-token-usage
```

卸载：`plugin_manager action: remove_bundle target: dsh-desktop-token-usage`。

想用 `main` 上待发布的功能（多语言、最新的热力图/趋势图修复），从源码安装：

```bash
git clone https://github.com/jd04063221/dsh-desktop-token-usage.git
cd dsh-desktop-token-usage
npm install        # 本地目录走 link: 安装，不会为被链接的包装依赖，所以先装一次 @deepseek-ai/schemastery
```

```
plugin_manager  action: install_bundle  target: <本目录的绝对路径>
```

改完代码后：`client.js`（界面）走 HMR 热更新，必要时硬刷新页面；`index.js` / `lib/*`（Host）**必须重启 DSH**——
Node 按 realpath 缓存 ESM，重新启用插件、重装甚至改包名都不会重新导入。

**兼容性与测试环境**

| 项目 | 实测环境 |
|---|---|
| DSH | Desktop `0.1.7-rc.2` 与 `0.2.0-rc.2`（完整验证）、`0.2.0-rc.1`（兼容性核对） |
| 内置运行时 | Electron 44 / Chromium 152 / Node 24.18.1 |
| 操作系统 | Windows 11 专业版，build 26200，AMD64 |

验证不止「能装上」：插件激活到 `fiberPhase: active`、侧边栏卡片与中央看板渲染、插件页自带配置卡可读可写、
浏览器 → Host 的 Remote 调用打通，以及折叠结果与 DSH 自身投影缓存**逐字段对拍一致**。
本插件的开发机现在跑的正是 DSH Desktop `0.2.0-rc.2`，这一整套在上面完整跑过：`boot.json` 里激活链路各阶段齐全、
`calls.json` 记录到真实的看板请求（183 个会话、61 天、17 个模型，热调用约 0.5 秒）、生效窗口与 profile 配置一致。
本插件**没有**声明任何 `@deepseek-ai/dsh*` 的 peer dependency（`engines.dsh` 仅供人阅读）。
上表之外的版本未测试：更早的 DSH 可能没有 `plugins.bundle.config` 槽与 `configEditor` 服务。

**已知限制**

- **首次聚合较慢**：约 150 个会话文件、9 万+ 条记录，冷启动约 3–4 秒；之后按文件指纹增量，热调用百毫秒级；
- **导入的历史会话用量可能为 0**：若历史会话是导入的，其 usage 字段确实全为 0，这是有效数据，插件不会回退去估算；
- **窗口取整到小时**：日志里没有分钟级分桶；
- **卡片刷新有延迟**：没有 Host → Client 的推送通道，靠 5 分钟定时刷新，想立刻更新可点开看板按「刷新」；
- **只翻译了十种语言**：其余六种（pt-BR、ru、vi、th、id、ar）设计已定稿、尚未实现。

**版本说明**：npm 上最新发布版是 **0.1.5**；仓库 `main` 另有待发布的 0.1.6，
包含十种语言的本地化、热力图与趋势图的可读性修复、以及侧边栏卡片与设置页的渲染图。想用多语言请从源码安装。

---

# DSH | dsh-desktop-token-usage (Token Usage Dashboard) | Offline, on-machine token usage stats for DSH

> **Unofficial project, independently developed and maintained by community members.**

**Project URL:** <https://github.com/jd04063221/dsh-desktop-token-usage> (npm: <https://www.npmjs.com/package/dsh-desktop-token-usage>)

**Introduction**

A **fully offline** token usage statistics plugin for DSH (DeepSeek Harness) — no network access, no telemetry,
no API calls. The **Host half** scans the session logs already on your machine
(`$DSH_HOME/sessions/**/session.vN.jsonl.zstd`) and folds out real usage with DSH's own semantics; the **Client half**
mounts a usage card at the foot of the left sidebar, and clicking it opens the full dashboard in the central panel:
time-range and source filters, six stat cards, a configured-windows row, an activity heatmap, a per-day token trend
with the cache hit-rate curve overlaid on the bars, and a model usage donut with a list. Settings → Plugins →
Token usage carries the window spans, the grouping (by model / by provider / both) and the palette; the dashboard
follows **DSH's own language setting** and ships ten locales.

**How it integrates with DSH**

- A standard DSH bundle (`dsh.bundle.patch` + `dsh.client`), installed through `plugin_manager install_bundle` and
  loaded by Cordis from the profile;
- Host half: `schemastery` `Config` plus a usage Remote service; reads session logs, folds usage and caches an index
  keyed by file mtime+size under `$DSH_HOME/cache/dsh-desktop-token-usage/`;
- Client half: registered through the official `__ModuleLoader__` factory into the `sidebar.footer.action` slot and the
  central `main` panel; filtering and aggregation are real browser → Host Remote calls (`@deepseek-ai/dsh-api-remotes`);
- Its config form renders into the `plugins.bundle.config` slot (keyed by package name) and saves through the official
  `configEditor`, so values land in the profile's `cordis.patch.yml` and take effect after `fiber.update()` — no restart;
- Eight extra language packs are registered into DSH's locale catalog, so they appear in DSH's own language selector;
- The folding logic is cross-checked field-by-field against DSH's own `dsh-token-meter` `tokenUsage` projection.

**Screenshots:** the six images above (dashboard light/dark, heatmap, trend, sidebar card, settings page), rendered
offline from the plugin's own components with sample data.

**Install:** `plugin_manager action: install_bundle target: dsh-desktop-token-usage` — a plain npm install from the
official registry (the manager queries it with `pnpm view` and then `pnpm add`s the package into the current profile);
`remove_bundle target: dsh-desktop-token-usage` uninstalls. npm `latest` is 0.1.5; the localization and the latest
heatmap/trend fixes are on `main`, waiting for 0.1.6 — get those from a source checkout (`npm install`, then
`install_bundle` with the directory's absolute path).

**Tested environment:** DSH Desktop `0.1.7-rc.2` and `0.2.0-rc.2` (full verification), `0.2.0-rc.1`
(compatibility check); Electron 44 / Chromium 152 / Node 24.18.1; Windows 11 Pro, build 26200, AMD64.
No `@deepseek-ai/dsh*` peer dependency is declared. MIT licensed.
