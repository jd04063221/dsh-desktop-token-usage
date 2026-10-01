# 更新日志

[English](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/CHANGELOG.md) | 中文

本文件记录 `dsh-desktop-token-usage` 的所有重要变更。
格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

> **升级注意**：本插件是 DSH bundle，分两半加载。`client.js`（界面）由浏览器热更新，
> `index.js` / `lib/*`（Host）在 DSH 进程里**缓存着已导入的 JS 模块代**——重新启用插件不够，
> 换 specifier、重装、甚至改包名也不会重新导入（Node 按 realpath 缓存 ESM），必须重启一次 DSH。
> 判断当前跑的是哪一代：看 `Config.listConfigs` 对本插件报 `schema` 还是 `absent`，再叠加
> 「本次改动之后是否重启过」；`boot.json` 每次 `apply` 都会重写，只能说明 fiber 最近一次重挂的时间。

## [未发布]

### 修复

- **趋势图的悬停框改成和热力图同一种读法**：标题不再把日期和 token 总数拼在一行——日期单独一行，
  总数单独成为 `Tokens` 行（紧凑格式），一行就是一个数字。

### 计划中

- **多语言（i18n）**：设计已定稿、**待实现**——见 [设计稿](docs/superpowers/specs/2026-10-01-i18n-design.md)。
  语言跟随 DSH 自身的语言设置（插件不自带选择器），15 个语言代码 / 3 梯队（`en`/`zh` 内置，`zh-TW` `zh-HK` `de`
  `fr` `es` `it` `ja` `ko` `pt-BR` `ru` `vi` `th` `id` `ar` 为语言包），`ar` 需 RTL，数字/日期/复数按 `Intl` 本地化。
  注意：选中语言包后 **DSH 自身界面仍回落 `zh`/`en`**，只有本插件切换。

## [0.1.5] - 2026-10-01

### 新增

- **统计口径可选**：按实际模型（跨 provider 合并同名模型）/ 按 API 供应商 / 都统计。都统计时趋势区与「用量拆分」各有一个 chip，可各自切换。
- **配色方案可选**：primer（GitHub 默认）/ cvd（Okabe–Ito 色盲友好）/ muted（低饱和雾面），每套都有浅色与深色两份变量，跟随系统主题自动切换。

### 变更

- **命中率曲线叠加在柱图上**：token 堆叠柱与缓存命中率曲线共用一张图（曲线按统计期 min−10% 跨度 ~ max+10% 跨度映射到绘图区高度，右侧标真实百分比），不再单独占一条细条。
- **命中率曲线的纵轴改为数据驱动**：统计期的 min/max 决定范围，两端各留 10% 跨度余量；命中率曲线沿用单调三次插值。
- **命中率口径**：miss 侧加入 cacheWrite（hit / (hit + miss)），与官方口径一致；本机 cacheWrite 恒为 0，数值不变。

### 修复

- **色板跟随 DSH 自身的主题开关**，而不是操作系统：DSH 用 `body[data-ds-dark-theme]` 标记深色、浅色时 `<body>`
  上不带该标记，因此色板改为读这个标记（走 `light-dark()` + `color-scheme`），不再依赖 `prefers-color-scheme`。
  此前「系统浅色 + DSH 深色」会让所有图表停在浅色，「系统深色 + DSH 浅色」则相反。
- **同一个模型不再算成两行**：各 provider 报的模型 id 不一样——`commandcode` 报 `deepseek/deepseek-v4.1-flash`，
  `opencode-go` 报 `deepseek-v4.1-flash`，原先「按模型」会把它列成两行。现在按模型分组取 id 的**最后一段**；
  「按供应商」仍然把两家分开。
- **活跃热力图铺满整行**：固定的 53 周不再只占卡片左侧一段，53 列按同一 11px 基准等分可用宽度（格子保持正方形，
  月份轴与周一分隔线同步伸缩）；只有卡片窄到装不下 11px 格子时才横向滚动，且滚动框停在**最新**一周，
  而不是从最旧的（本机为空白的）那些周开始。格子圆角改为格宽的 24%（不再是固定 2px），
  配色/指标切换有 0.18s 颜色过渡，悬停用 `filter: brightness()` 提亮（不产生位移、不重排网格），
  `prefers-reduced-motion` 下关闭过渡。
- **热力图补齐三处可读性**：无活动日只留 1px 的第 0 档描边而不是实色块（日历铺满整行后，一片实色灰会被读成数据）；
  「今天」用底色 + 主文字色的双层内描边标出，浅色级与深色级上都看得见；悬停改用看板自己的 tooltip
  （与趋势图同一个盒子，四行：日期 / Tokens / 轮次 / 请求，其中 Tokens 用与统计卡、趋势图一致的紧凑格式
  ——`1.45亿` 而不是 `145,156,311`，这样再长的用量也不会把框撑宽），
  不再依赖有延迟、样式不受控的原生 `title`。热力图整块**居中、左右各留 15px**，53 列按同一基准等分剩余宽度，
  于是**不再有任何横向滚动**（滚动容器已删除）；之前底部那条滚动条的真凶正是悬停框——token 数一长它就超过
  160px 的宽度假设，在最左 / 最右列探出滚动容器，1px 也足以触发滚动条。现在悬停框改成**按列翻边对齐**：
  左半区的列左对齐（向右展开）、右半区的列右对齐（向左展开），`max-width:calc(50% - 25px)` 保证半个列区间
  容得下整框，任何宽度下都不越界——而且完全不依赖测量悬停框自身的宽度。
- **看板页脚改为一行一件事**：三个长度差很大的 flex 项挤成一段参差的段落，长句还会在「…」中间断行；
  现在每个「…」词条都禁止断行。

## [0.1.4] - 2026-09-30

### 变更

- **侧边栏卡片现在在页脚席位里独占一整行。** `sidebar.footer.action` 是一条横向行（`display: flex`），
  标准安装下 `dsh-opencode-go-usage`、Cordis 徽章、`commandcode-panel` 也占着它——而它们**全都**声明了
  `width: 100%`，所以谁也做不到「和邻居分享这一行」。在真实的 0.2.0-rc.2 页面上实测：没有任何干预时，
  本插件的卡片被压到 **105.2px** 宽（邻居 150.8px），三方文本互相挤成一团。
  现在改为把**席位变成纵向列**（`[class*="_footerActions"]:has(.dtu-footCard)`），于是每个占用者都拿到
  它按整行写的那一行：卡片 **256px** 铺满、不再被压。用类名后缀加 `:has()` 定位，既不依赖 DSH 的哈希类名，
  也不会碰到任何祖先元素（给 shell 自己的横向容器改方向会把侧边栏和主面板叠起来）。
  为什么是 `flex-direction` 而不是 `flex-wrap`：外壳会给每个槽位包一层 `display: contents` 元素，
  直接子代选择器因此匹配不到席位；而即使匹配上了，在**列**容器上 `flex-wrap` 的含义是「另起一列」——
  实测会让卡片跑到邻居右边、把侧边栏撑到 387.8px 并溢出。这也需要 `:has()`，
  所以下方兼容性表里补上了内置的 Chromium 版本。
- **同样的两个窗口也出现在看板里**，即「配置窗口」那一行：标签、总量、输入/输出拆分、缓存命中率与轮次。
  它们按本地墙钟时间回溯——Host 只用 `{root, useCache, now}` 构造它们——刻意不跟随来源筛选，
  所以那一行明确写出这一点，而不是混进跟随筛选的统计卡；两个窗口都关时退回成一张累计卡。
- **按天趋势不再把两个量纲画在同一张图上。** 缓存命中率原来是一条叠在 token 柱上的折线，带自己的右轴 0-100%；
  它通常都在 90% 以上，于是折线一直飘在图顶，和下面的柱子看不出任何关系。既然命中率已经在统计卡和「配置窗口」
  里逐项给出，这条曲线就不再画命中率，而是**改为在柱图上叠加每日 token 合计**：曲线与柱子共用同一个左轴，
  顶点落在每个堆叠柱的顶上，柱子的构成与曲线的走势一眼可对；没有用量的日子曲线落到底线，
  「先空后爆」的形状反而更清楚。图例里相应地把命中率那条换成了「每日合计」。
- **曲线是平滑过渡，不是折线。** 相邻两天之间用**单调三次插值**（Fritsch–Carlson）连接，曲线在每个数据点上
  切线连续，所以是流过去而不是拐过去；选单调插值而不是普通样条，是因为普通样条会在数据点之间过冲——
  紧挨着零用量日时，那意味着曲线会冲到坐标轴以下。
- **写入改为原子、有上限、可关闭。** 两处写入都改为先写 `<name>.<pid>.tmp` 再 rename 覆盖目标，
  于是并发读取者永远看不到半截文件，被杀死的进程也不可能留下截断的文件。会话索引上限 800 条
  （超出丢最旧，需要时会重新扫描），崩溃留下的 `.tmp` 会在下次写入时清掉。Host 的诊断文件
  （`calls.json`、`boot.json`）可以用 `DSH_TOKEN_USAGE_DIAG=0` 整体关闭。所有写入都发生在
  `$DSH_HOME/cache/dsh-desktop-token-usage/` 之内；README 新增一节逐个说明写了什么、用途、以及如何关闭。
- **声明对 DSH Desktop 0.2.0-rc.1 的兼容性。** 本插件仍不声明任何 `@deepseek-ai/dsh*` peer dependency，
  而这才是 DSH 实际校验的东西；`engines.dsh` 放宽为 `^0.1.7-rc.2 || ^0.2.0-rc.1`（仅供人阅读）。
  把本插件涉及的所有已发布包在两个版本间逐文件对比：`dsh-plugin-manager` 完全一致，
  `dsh-client-ui-sidebar`、`dsh-client-ui-layout`、`dsh-client-ui-cordis` 只有版本号字符串、
  一行埋点与标题栏 CSS 的差异。槽契约未变。

### 说明

- 发布后在 DSH Desktop `0.2.0-rc.2` 上补做了一次手工试用：插件 `0.1.3` 的看板与 Remote 调用正常。
- 入口曾短暂迁到 `sidebar.panellist`：那个席位确实能给出侧边栏自己拥有的整行，但它只渲染一个图标加一个标题，
  而卡片存在的意义——用量数字——将无处可放。因此迁了回来。

## [0.1.3] - 2026-09-28

### 变更

- **CI 发布改用 Trusted Publishing（OIDC），仓库里不再保存任何 npm token。** workflow 去掉
  `NODE_AUTH_TOKEN`、加上 `id-token: write`，并在 runner 上升级 npm（Node 22 自带的 npm 低于
  trusted publishing 要求的 11.5.1）。provenance 证明会自动生成，仓库密钥 `NPM_TOKEN` 已不再被引用。

## [0.1.2] - 2026-09-28

### 变更

- **包名去掉作用域**：`@jd04063221/dsh-desktop-token-usage` → `dsh-desktop-token-usage`。0.1.0 与 0.1.1 是
  作用域包；作用域名已 deprecate 并指向本包。无作用域名不要求账号拥有同名 scope，安装命令更短，发布也不再
  依赖 scope 归属。同步改了 Host 的 `REMOTE_PACKAGE`、Client 的模块 `id` 与 `cordis.patch.yml` 的行 `name`；
  行 `id` 与 `PANEL_ID` 本来就等于无作用域名，因此这次不需要迁移任何 profile 配置。

### 说明

- GitHub 仓库名本来就是 `dsh-desktop-token-usage`，所以仓库地址与发布 tag 都不需要改动。

## [0.1.1] - 2026-09-28

### 修复

- **npm 页面默认渲染的是中文 README。** npm 11 在 `@npmcli/package-json/lib/normalize.js` 里用
  `{README,README.*}` 做 glob 并取第一个像 markdown 的匹配；本机上该 glob 先返回 `README.zh.md`，
  于是 packument 的 `readme` 字段存的是中文文档。中文文档现改名为 `README-zh.md` 与 `CHANGELOG-zh.md`
  （连字符不属于该 glob，因此只有 `README.md` 会被选中）。

### 变更

- 两份文档顶部的语言切换链接改为 GitHub 绝对地址：相对链接在 npm 包页面上点不开（npm 不把仓库文件当页面
  提供），绝对地址在 GitHub 与 npm 上都可用。

### 新增

- GitHub Actions 发布 workflow（`.github/workflows/publish.yml`）：推 `v*` 标签即发布到 npm，
  手动运行默认 dry-run，且打标签时会校验 tag 与 `package.json` 里的 `version` 一致。
  认证使用仓库密钥 `NPM_TOKEN`（需开启 bypass 2FA 的 granular token）。

## [0.1.0] - 2026-09-27

首个版本：完全离线的 token 用量统计，数据全部来自本机 `$DSH_HOME/sessions` 下的会话日志。

### 新增

**统计与数据层**

- 读取 `session.vN.jsonl.zstd`：这些文件是**多个 zstd 帧首尾拼接**的容器，Node 的解压 API 只解第一帧，
  因此按官方 `scanZstdFrames` 的结构化扫描（不解压）定位帧边界后逐帧解压、逐行解析。
- `(turn, step)` **折叠**语义：同一槽位内后一条 usage 替换前一条，`llm/retry-started` 之后才累加；
  `reasoningTokens` 视为 `outputTokens` 的子集不重复计入。
- 索引按**本地小时**分桶，按文件 `mtime+size` 增量缓存，落盘于
  `$DSH_HOME/cache/dsh-desktop-token-usage/sessions-index.json`。
- 会话来源推断：`客户端（桌面·网页）` / `命令行·机器人` / `子代理`——日志里没有客户端来源字段，
  只能从 `origin`、`delegationDepth`、用户轮次的 `source.rpcId` 推导。

**接口**

- 通过官方 Typert 通道暴露三个 Remote：`dshUsage/summary`（用量汇总）、`dshUsage/config`
  （读取卡片窗口，含 `writable`）、`dshUsage/setConfig`（经官方 `configEditor` 写回 profile patch）。

**界面**

- 侧边栏底部卡片（`sidebar.footer.action`）：按配置显示「近 N 小时」「近 N 天」窗口或累计值，
  每个窗口显示**输入量**（未缓存输入 + 缓存读取）、**输出量**与**缓存命中率**。
- 中央看板（`main` 面板）：时间范围与来源筛选、6 张统计卡、活跃热力图、
  按天 Token 趋势（按模型堆叠 + 缓存命中率折线）、模型用量环形图与占比列表。
- 活跃**日历**：周一对齐近 53 周，带月份表头与星期坐标，格子固定 11px；
  顶部可切换 **Tokens / 轮次**，默认选有数据天数更多的一维。
- 插件页配置表单（`plugins.bundle.config`）：`hours`（0-23）与 `days`（1-30），`0` 表示关闭该窗口。
- 全部界面只依赖 React 与 `--dsw-alias-*` 主题 token，不引用任何 `@deepseek-ai` 客户端包。

**诊断**

- `boot.json`：Host 激活链路（apply / typert 注入 / 服务提供 / 描述符注册）与生效的窗口配置。
- `calls.json`：最近 20 次看板调用（筛选条件、窗口、会话数、总 token、耗时）。

### 修复

- **Remote 返回值被当作 payload**：真实形状是 `{ ok, value }` / `{ ok: false, error }`，失败是值而不是异常。
  原写法导致 `data.totals` 为 `undefined`，看板整个抛错变空白、侧边栏卡片只显示 `0`。
- **看板高度塌陷**：`.dtu-body` 用 `flex:1 + min-height:0`，父容器高度不确定时被裁成 0 高；
  改回 `display:block + height:100% + overflow:auto` 并把头部做成 sticky。
- **热力图格子被拉伸**：`grid-auto-columns` 会把轨道撑满容器宽度，11px 方块被拉成宽条；改为 flex 布局。
- **热力图色阶失效**：原按「当日 ÷ 最大值」分档，只要有一天特别大，其余全落同一档；改用非零日的四分位。
- **新增渲染错误边界**：槽位内任何渲染异常都会显示文字说明，不再整块空白。
- **测试会覆盖线上诊断文件**：`npm test` 里的 `apply` 会写真实的 `boot.json` / `calls.json`，
  而 README 恰恰教人看这两个文件判断"当前跑的是哪一代 Host"。诊断目录现在可用环境变量
  `DSH_TOKEN_USAGE_DIAG_DIR` 覆盖，测试套件自动指向临时目录，不再污染线上文件。
- **测试与会话日志写入竞争**：「按天区间划分总量」这类断言会在运行中的会话往日志追加一条记录时偶发失败
  （实测差 157,951 token，且 per-day 之和反而大于快照总量）。现在这些窗口统一按**当前整点**钉住上界——
  按小时分桶的过滤语义决定了「钉在现在」无效：当前小时桶里之后写入的记录仍会被算进来。热力图刻意不受
  时间范围约束，因此改为比对稳定的日期网格，跨快照求和时重读一次兜底。

### 变更

- 索引桶从「天」改为「本地小时」（`CACHE_VERSION` 1 → 2，首次启动会重建一次索引），
  使「近几个小时」这类窗口成为可能；看板的按天图表由 Host 从小时桶归并。
- 热力图数据独立于时间范围（`summary` 响应新增 `heatmap`，仍跟随来源筛选）：
  日历被筛成 7 天就是「一年网格里亮 7 格」，不是热力图该有的语义。
- 配置值通过官方 `configEditor` 持久化到 profile 的 `cordis.patch.yml`，不写入插件自己的文件。
- 引入唯一一个 `@deepseek-ai/*` 依赖 `@deepseek-ai/schemastery`（官方 `Config` 卡片所需）。

### 发布准备（npm）

- **包名、行 id 与仓库名统一为 `@jd04063221/dsh-desktop-token-usage`**（作用域在 0.1.2 中去掉）：
  本插件只对应 DSH **桌面版**（数据来自 Desktop 的 `$DSH_HOME/sessions`），名字里带 `desktop` 以区分其他形态。
  同步改了包名、Host 的 `REMOTE_PACKAGE`、Client 的模块 `id`（官方约定模块 `id` 即包名，见
  `dsh-api-remotes/lib/client.js`）、`cordis.patch.yml` 的行 `name` 与行 `id`、配置卡槽位键
  （`plugins.bundle.config` 以**包名**为键）、诊断与索引缓存目录，以及 GitHub 仓库地址。
- **这几处漏改任何一处都会静默失效**：模块 `id` 与配置卡键必须等于包名，行 `name` 必须是安装进 profile 的确切包名。
  行 `id` 同时是 profile 里 `- id: …` 配置覆盖的锚点——改它必须一并迁移那条覆盖，否则已保存的 `hours`/`days`
  会失效（本次已迁移）。Host 认自己的 Loader 条目时同时匹配**包名**与**行 id**，所以过渡期的旧行也能读写配置（有测试覆盖）。
- 去掉 `private: true`，补齐 `author` / `repository` / `homepage` / `bugs` / `keywords` /
  `publishConfig.access=public`（scoped 包默认 restricted）/ `engines.dsh`（声明性，DSH 不强制）/ `prepublishOnly: npm test`，
  新增 MIT `LICENSE`。
- ⚠️ `name` / `author` / 仓库地址里的 **`jd04063221` 是占位用户名**：发布前必须换成你自己的 npm scope 与 GitHub 用户名
  （逐处清单见 README「发布到 npm」）。

### 兼容与回退

- **客户端比 Host 新**是常态（前者热更新、后者要重启），因此对缺失字段都做了回退：
  缺 `card` 时用 `totals` 现算累计块；缺 `heatmap` 时用当前筛选范围的 `days` 填日历，标题措辞同步改变。
- profile 里没有提供 `configEditor` 时，配置表单转为**只读**并说明原因，写入接口明确报错。

### 文档

- `README.md`（英文，默认）/ `README-zh.md`（中文）：安装、使用、配置项、token 口径表、来源推断的局限、
  已知限制、排查顺序，两份顶部互相链接。
- `docs/DESIGN.md`：数据契约、关键取舍，以及踩过的坑（多帧 zstd、信封、模块代缓存、配置页机制等）。
- `docs/research/`：前期调研记录与可复用的会话日志探针脚本。
- 发布时不带 `docs/`：`files` 白名单显式加上 `!docs`（实测 npm 的 `files` 支持取反，而根 `.npmignore`
  不能覆盖 `files`，所以取反才是有效写法）。
- 调研文档脱敏：本机路径如 `C:\Users\<user>` 改写为 `%USERPROFILE%` / `$DSH_HOME`，引用真实记录时
  用户目录写成 `<user>`，并在文档开头写明这条脱敏约定。

### 已知限制

- 桌面端与网页端在本地数据上**无法区分**，合并为「桌面·网页」。
- 窗口粒度取整到小时（日志里没有分钟级标记）。
- 卡片没有推送通道，靠 5 分钟定时静默刷新；刚改完配置想立刻看到可点开看板按「刷新」。
- 导入的历史会话（如 reasonix 迁移）usage 全为 0，属有效数据，不估算。

### 兼容性

- **实测环境：DSH Desktop `0.1.7-rc.2`**（`@deepseek-ai/dsh-desktop@0.1.7-rc.2`）、Windows 11 专业版
  build 26200（AMD64）、Node v25.2.1。插件激活、侧边栏卡片、看板、插件页配置卡、浏览器 → Host RPC
  以及与 DSH 自身投影缓存的数字对拍，全部验证通过——可保证在 0.1.7-rc.2 上正常使用。
- `engines.dsh` 声明为 `^0.1.7-rc.2`（原先写 `>=0.1.7-rc.2`，那等于宣称对 0.2/1.0 也兼容，没有依据）。
  该字段是**声明性**的：官方明确说 declaring a range does not reject incompatible hosts。
- 更早的 DSH 未必有本插件用到的 `plugins.bundle.config` 槽与 `configEditor` 服务；更新的版本未测试。
- 实测结论同时写进两处展示文本：`package.json` 的 `description` 与 locale 的 `meta.description`。
  原因是插件列表接口（`listBundles`）把 `package.json` 的 **file URL** 传给 `readPluginMeta`，
  而官方说明「File paths and file URLs return no metadata」，所以该路径下只有 `package.json` 描述生效
  （实测：列表里所有 bundle 都只有 `description`、没有 `meta`）；locale 那条用于能按包名解析元信息的 UI 路径。

### 验证

- 折叠结果与 DSH 自身投影缓存逐字段对拍一致（`session-5964a5d3-*`：`286650 / 182633 / 43826560 / 0`）。
- 汇总自洽：日/模型维度可重新加总回总量；按天与按小时的毫秒区间能精确划分总量；
  日历按来源精确划分；窗口汇总恒 ≤ 累计值；`hours=99` / `days=-3` 被夹紧。
- 两端 wire 描述符逐字段对拍（三个端点），参数 codec 可接受浏览器实际发送的值。
- 无浏览器环境下用假 React/DOM 渲染通过（含卡片两形态、配置表单、日历结构、两处回退）。
- 安装后 `fiberPhase: active`，`sidebar.footer.action` 与 `main` 均已注册。
- 共 23 个测试，`npm test` 全绿。**界面视觉与最终数字需人工确认**（本环境无浏览器控制）。

---

## 附录：提交索引

0.1.0 由以下提交构成（`git log --reverse`，截至 `2b4be69`）：

| 提交 | 时间 | 内容 |
|---|---|---|
| `9b46227` | 15:01 | Host 端本地会话日志 token 聚合与用量 Remote 接口 |
| `3b63332` | 15:02 | 侧边栏用量卡片与中央 Token 看板 |
| `5407357` | 15:02 | 聚合黄金对拍与客户端无浏览器冒烟测试 |
| `6d6408e` | 15:02 | README、设计说明与前期调研记录 |
| `7d66caa` | 15:58 | 修复 `{ok,value}` 信封与面板高度塌陷 |
| `61f272d` | 16:04 | Host 激活链路留痕与排查文档 |
| `5ad18db` | 16:48 | 官方 Config 配置卡片窗口，索引细化到小时 |
| `dda8906` | 16:49 | 修正配置生效说明（改配置走 `fiber.restart`） |
| `3a593c5` | 16:58 | 客户端在 Host 缺少 `card` 时回退到累计值 |
| `2ae0a20` | 19:00 | 插件页自带配置表单（hours/days） |
| `e104dc2` | 19:31 | 重做活跃热力图（日历语义、坐标轴、分位数色阶、指标切换） |
| `2b4be69` | 09:20 | 包名改为作用域名并补齐 npm 发布元数据（发布准备） |
