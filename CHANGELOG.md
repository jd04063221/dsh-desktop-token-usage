# 更新日志

本文件记录 `dsh-token-usage` 的所有重要变更。
格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

> **升级注意**：本插件是 DSH bundle，分两半加载。`client.js`（界面）由浏览器热更新，
> `index.js` / `lib/*`（Host）在 DSH 进程里**缓存着已导入的 JS 模块代**——重新启用插件不够，
> 需要重启一次 DSH 才会加载新代码。判断当前跑的是哪一版：看 `$DSH_HOME/cache/dsh-token-usage/boot.json`
> 是否存在，或 `Config.listConfigs` 对本插件报 `schema` 还是 `absent`。

## [0.1.0] - 2026-09-27

首个版本：完全离线的 token 用量统计，数据全部来自本机 `$DSH_HOME/sessions` 下的会话日志。

### 新增

**统计与数据层**

- 读取 `session.vN.jsonl.zstd`：这些文件是**多个 zstd 帧首尾拼接**的容器，Node 的解压 API 只解第一帧，
  因此按官方 `scanZstdFrames` 的结构化扫描（不解压）定位帧边界后逐帧解压、逐行解析。
- `(turn, step)` **折叠**语义：同一槽位内后一条 usage 替换前一条，`llm/retry-started` 之后才累加；
  `reasoningTokens` 视为 `outputTokens` 的子集不重复计入。
- 索引按**本地小时**分桶，按文件 `mtime+size` 增量缓存，落盘于
  `$DSH_HOME/cache/dsh-token-usage/sessions-index.json`。
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

### 变更

- 索引桶从「天」改为「本地小时」（`CACHE_VERSION` 1 → 2，首次启动会重建一次索引），
  使「近几个小时」这类窗口成为可能；看板的按天图表由 Host 从小时桶归并。
- 热力图数据独立于时间范围（`summary` 响应新增 `heatmap`，仍跟随来源筛选）：
  日历被筛成 7 天就是「一年网格里亮 7 格」，不是热力图该有的语义。
- 配置值通过官方 `configEditor` 持久化到 profile 的 `cordis.patch.yml`，不写入插件自己的文件。
- 引入唯一一个 `@deepseek-ai/*` 依赖 `@deepseek-ai/schemastery`（官方 `Config` 卡片所需）。

### 兼容与回退

- **客户端比 Host 新**是常态（前者热更新、后者要重启），因此对缺失字段都做了回退：
  缺 `card` 时用 `totals` 现算累计块；缺 `heatmap` 时用当前筛选范围的 `days` 填日历，标题措辞同步改变。
- profile 里没有提供 `configEditor` 时，配置表单转为**只读**并说明原因，写入接口明确报错。

### 文档

- `README.md`：安装、使用、配置项、token 口径表、来源推断的局限、已知限制、排查顺序。
- `docs/DESIGN.md`：数据契约、关键取舍，以及踩过的坑（多帧 zstd、信封、模块代缓存、配置页机制等）。
- `docs/research/`：前期调研记录与可复用的会话日志探针脚本。

### 已知限制

- 桌面端与网页端在本地数据上**无法区分**，合并为「桌面·网页」。
- 窗口粒度取整到小时（日志里没有分钟级标记）。
- 卡片没有推送通道，靠 5 分钟定时静默刷新；刚改完配置想立刻看到可点开看板按「刷新」。
- 导入的历史会话（如 reasonix 迁移）usage 全为 0，属有效数据，不估算。

### 验证

- 折叠结果与 DSH 自身投影缓存逐字段对拍一致（`session-5964a5d3-*`：`286650 / 182633 / 43826560 / 0`）。
- 汇总自洽：日/模型维度可重新加总回总量；按天与按小时的毫秒区间能精确划分总量；
  日历按来源精确划分；窗口汇总恒 ≤ 累计值；`hours=99` / `days=-3` 被夹紧。
- 两端 wire 描述符逐字段对拍（三个端点），参数 codec 可接受浏览器实际发送的值。
- 无浏览器环境下用假 React/DOM 渲染通过（含卡片两形态、配置表单、日历结构、两处回退）。
- 安装后 `fiberPhase: active`，`sidebar.footer.action` 与 `main` 均已注册。
- 共 22 个测试，`npm test` 全绿。**界面视觉与最终数字需人工确认**（本环境无浏览器控制）。

---

## 附录：提交索引

首个版本由以下提交构成（`git log --reverse`）：

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
