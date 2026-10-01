# 用量看板 v2：分组口径 · 命中率条 · 配色系统（设计稿）

> 日期：2026-09-30 · 状态：**待实现**（brainstorming 已定稿，等 spec 复审）
> 影响面：`client.js`、`lib/session-usage.js`、`index.js`、`test/*`、`README.md` / `README-zh.md`、`CHANGELOG.md` / `CHANGELOG-zh.md`、`docs/DESIGN.md`
> 视觉稿存档：`.superpowers/brainstorm/dsh-1790830733/content/`（`visual-direction` / `layout-c-primer` / `hitrate-axis` / `palette-variants`；该目录已被 `.gitignore` 忽略，不进 git）
> 决策：本设计由浏览器伴侣逐步确认——布局 C 方案、chip 分工 B、视觉方向 A（Primer）、轴策略 B + 0.1.4 单调三次、柱图去每日合计线、三套配色全部保留并做成设置项。

## 1. 目标与非目标

### 1.1 目标

1. **趋势区改版（C 方案）**：上面是 token 堆叠柱，下面是命中率细条，两段**共用同一条 X 轴**（日期刻度只画一次）。
2. **统计口径可选**：按实际模型 / 按 API 供应商 / 都统计；「都统计」下由两颗独立 chip 现场切换（趋势区一颗，环形+明细一颗）。
3. **命中率条采用数据驱动的纵轴**：统计期的 min/max 决定轴范围，两端各留 10% 跨度余量，配合 0.1.4 已有的单调三次平滑，命中率的变化一眼可见。
4. **三套配色做成设置项**（Primer / 色盲友好 / 低饱和雾面），每套都有独立的浅色与深色变量，跟随宿主主题自动切换。

### 1.2 非目标

- 不改侧边栏那张用量卡片（本次只动看板）。
- 不改会话日志读取链路，不引入图表库，不引入新的运行时依赖。
- 不做「按供应商展开到模型」的二级下钻（后续需要再加）。
- 不做数据导出、不做自定义配色（色板固定三套）。
- 本设计不含版本号变更；`client.js` 属打包文件，改动要发版才能到 npm（见第 9 节）。

## 2. 数据与口径

### 2.1 命中率

- `hit = usage.cacheReadTokens`，`miss = usage.inputTokens + usage.cacheWriteTokens`（`inputTokens` 就是未缓存输入，即 buckets[0]；**miss 含缓存写入**，与官方口径一致。本机 cacheWrite 恒为 0，所以现值不变）。
- 日命中率 = `hit / (hit + miss)`；分母为 0 的当天记 `null`（**不进曲线点列**，曲线跨过该日连接两侧）。
- 汇总命中率（统计卡、侧边栏卡片沿用同一函数）同样改用 hit + miss 为分母。

### 2.2 分组键

| 口径 | 键 | 含义 |
| --- | --- | --- |
| 按模型 | `model` 字段（不含 provider 前缀） | 跨 provider 合并：commandcode / opencode-go / deepseek-account 下的同一个 `deepseek/deepseek-v4.1-flash` 汇总成一条 |
| 按供应商 | `provider` 字段 | 只按 provider 聚合，不再区分底下是哪个模型 |

路由 id 仍是 `provider + '/' + model`（`model` 自身可能含 `/`，例如 `commandcode/deepseek/deepseek-v4.1-flash`）——拆分仍按**第一个** `/`。

### 2.3 Top N

柱图、环形图、明细列表统一 **Top 5 + 其他**：按**当前筛选范围**的总 token 降序取前 5，其余合并为「其他」；颜色跨区块、跨天稳定（同一分组在同一位置同色）。色板 `--dtu-s1…s5` 给 Top5，`--dtu-other` 给「其他」。

### 2.4 命中率条纵轴（B 方案）

设可见范围内所有 `hit != null` 的日命中率集合为 `V`（百分比）：

- 有数据时：`lo = min(V) - 0.1 * (max(V) - min(V))`，`hi = max(V) + 0.1 * (max(V) - min(V))`。
- `max(V) - min(V) == 0`（各日相同）或只有 1 天：退化为 `[v - 1, v + 1]`。
- `V` 为空（整个范围无用量）：退回 `[0, 100]`。
- `lo` / `hi` 钳制在 `[0, 100]` 内。
- 轴只画 3 个刻度（下 / 中 / 上），中值画虚线；刻度值是**真实百分比**（保留 1 位小数）。
- 切换范围 / 来源筛选时按新的可见集重算。

## 3. 界面结构（自上而下）

1. **头部**（现状保留）：标题、范围 chips（7d / 14d / 30d / 90d / 全部 / 自定义）、来源 chips（全部 / 桌面·网页 / 命令行·机器人 / 子代理）、刷新。
2. **配置窗口行**（现状保留）：hours / days 两个窗口的输入输出与命中率。
3. **统计卡一行 6 张**：总 Token / 会话 / 请求 / 活跃天数 / 平均命中率 / 最常用（**文案跟随「拆分 chip」**：按模型时显示最常用模型，按供应商时显示最常用供应商）。
4. **按天趋势**：标题栏右侧一颗 chip（按模型 / 按供应商）。上方堆叠柱（**不画每日合计曲线**），下方命中率条（高 40px、独立轴、单调三次平滑、末端圆点）；两段共用 X 轴。
5. **用量拆分**：标题栏右侧一颗 chip（与趋势区互不影响）。左环形（Top5 + 其他）+ 右明细列表（名称 / token / 占比 / 占比条）。
6. **活跃度热力图**（现状保留）：色阶随所选配色方案。

`groupBy = model | provider` 时对应 chip 隐藏并锁定；`groupBy = both` 时两颗 chip 都显示，各自默认「按模型」。

## 4. 配置项

| 键 | 取值 | 默认 | 说明 |
| --- | --- | --- | --- |
| `groupBy` | `model` \| `provider` \| `both` | `both` | 统计口径；`both` 显示两颗 chip |
| `palette` | `primer` \| `cvd` \| `muted` | `primer` | 配色方案；浅/深由主题决定，不由配置决定 |
| `hours` | 0–23 | 0 | 现状保留 |
| `days` | 0–30 | 0 | 现状保留 |

- 行为在插件页配置卡（`Config` schema）里，与 hours/days 并列。
- `setConfig` 走**合并语义**：只改传进来的键，未传的键保持原值（否则旧客户端保存 hours/days 会把新键重置）。
- 写入前做白名单校验：非法取值回落到默认值，不抛错。

## 5. 配色与主题

### 5.1 宿主现状（实测）

对 115.7 MB 的 `app.asar` 做全量字节扫描：

| 串 | 命中 |
| --- | --- |
| `--dsw-chart-1` / `--dsw-chart-other` / `--dsw-provider-1` / `--dsw-trend-line` | **0** |
| `data-color-scheme` / `dsw-color-scheme` | 0 |
| `--dsw-alias-bg-base` | 54 |
| `prefers-color-scheme` | 30 |

结论：DSH 只提供 `--dsw-alias-*` 语义 token，**没有图表色板 token**；宿主用 `nativeTheme.themeSource` 驱动 `prefers-color-scheme`（asar 里的 `isDarkMode` 就是这么判断的）。因此色板必须插件自带，浅/深用媒体查询切换。

### 5.2 机制

- 颜色全部落到插件根节点的 CSS 变量上：`--dtu-s1 … --dtu-s5`（Top5）、`--dtu-other`（其他灰）、`--dtu-hit`（命中率线）、`--dtu-heat-0 … --dtu-heat-4`（热力图色阶）。
- 方案切换：根节点属性 `data-dtu-palette="primer | cvd | muted"`（由配置写入）。
- 浅/深：同一批变量在 `@media (prefers-color-scheme: dark)` 里覆盖；主题切换时浏览器自动重算，无需 JS 监听。
- 柱子、环形、chip、网格线仍用 `--dsw-alias-*` 语义 token（它们本来就是主题感知的）。

### 5.3 三套色板

**P1 · primer（GitHub Primer）**

| 槽位 | 浅色 | 深色 |
| --- | --- | --- |
| s1…s5 | `#4c8dff` `#3fb950` `#d29922` `#a371f7` `#ec6a5e` | 同左 |
| 其他 | `#6e7681` | `#8b949e` |
| hit | `#57606a` | `#8b949e` |
| heat0…4 | `#ebedf0` `#9be9a8` `#40c463` `#30a14e` `#216e39` | `#161b22` `#0e4429` `#006d32` `#26a641` `#39d353` |
| 页面底 / 面板 / 边框 | `#ffffff` / `#f6f8fa` / `#d8dee4` | `#0d1117` / `#161b22` / `#30363d` |

**P2 · cvd（Okabe–Ito 色盲友好，热力图改蓝色阶）**

| 槽位 | 浅色 | 深色 |
| --- | --- | --- |
| s1…s5 | `#0072b2` `#e69f00` `#009e73` `#cc79a7` `#56b4e9` | `#58a6ff` `#ffc857` `#4dd4ac` `#f0a6c8` `#83c9f4` |
| 其他 | `#7b8794` | `#9aa5b1` |
| hit | `#0072b2` | `#58a6ff` |
| heat0…4 | `#eef4fa` `#c6dbef` `#7fb3d9` `#3d85c6` `#084594` | `#111823` `#12395c` `#1b5a8a` `#2f7fbd` `#5fb0e8` |
| 页面底 / 面板 / 边框 | `#ffffff` / `#f5f7fa` / `#d7dee6` | `#0d1117` / `#161b22` / `#30363d` |

**P3 · muted（低饱和雾面）**

| 槽位 | 浅色 | 深色 |
| --- | --- | --- |
| s1…s5 | `#4c6a92` `#6e9c7a` `#c9a227` `#9a6b8f` `#7a8ca3` | `#8fa8c8` `#9dc0a6` `#e0c46a` `#c49ab8` `#a8b6c6` |
| 其他 | `#8a857c` | `#a8a196` |
| hit | `#4c6a92` | `#8fa8c8` |
| heat0…4 | `#f0efe9` `#cfd8c4` `#a8bb98` `#7d9a6d` `#547049` | `#1a1a17` `#2c3a28` `#47603e` `#688a56` `#8fb273` |
| 页面底 / 面板 / 边框 | `#fbfaf7` / `#f3f1ec` / `#ddd8cf` | `#12120f` / `#1c1b18` / `#34332e` |

## 6. 改动点

### 6.1 Host：`lib/session-usage.js`

`summarize()` 的返回**只增不改**（旧字段原样保留给热更新期间的老客户端）：

```jsonc
{
  "days": [{
    "day": "2026-09-27",
    "buckets": [/* 5 桶，现状 */],
    "turns": 12, "requests": 34,
    "byModel": { "commandcode/deepseek/deepseek-v4.1-flash": [/* buckets */] },  // 现状：route 键，保留
    "byGroup": {                                                                  // 新增
      "model":    { "deepseek/deepseek-v4.1-flash": [/* buckets */] },
      "provider": { "commandcode": [/* buckets */] }
    }
  }],
  "models": [ { "route": "...", "provider": "...", "model": "...", "buckets": [], "totalTokens": 0 } ], // 现状：保留
  "groups": {                                                                     // 新增
    "model":    [ { "key": "deepseek/deepseek-v4.1-flash", "buckets": [], "totalTokens": 0 } ],
    "provider": [ { "key": "commandcode",                 "buckets": [], "totalTokens": 0 } ]
  }
}
```

- 折叠循环里每笔用量已带 `provider / model / route`，顺手累加到 `byGroup.model` / `byGroup.provider` 与全局 `groups.*` 即可，不需要二次扫描。
- `groups.*` 按 `totalTokens` 降序（与现状 `models` 的排序一致）。
- `totals.cacheHitRate` 的分母改为 `hit + miss`（见 2.1）。

### 6.2 Host：`index.js`（wire 与配置）

- `Config` schema 增加 `groupBy` / `palette` 两项（枚举 + 默认值）；实现时确认 schemastery 的枚举写法，退路是 `Schema.string().default(...)` + `setConfig` 白名单校验。
- 配置读接口 `config()` 的返回加这两个键；`validateConfig` 同步放宽校验（缺失即默认）。
- `setConfig(patch)` 改为合并语义，并对两个新键做白名单校验。
- `summary` 结果的 `validateSummary()` 只做**宽松**校验：`groups` 与 `days[].byGroup` 允许缺失（老 Host 不给），存在时校验形状。
- `index.js` 的 `cardBlock` / 侧边栏卡片数据不变（本次不动侧边栏）。

### 6.3 Client：`client.js`

- **`TrendChart` → 拆成两段**：上段柱图（沿用「flex 列 + 百分比高度」的 div 布局，不测宽）、下段命中率条（`preserveAspectRatio="none"` 的 SVG overlay + HTML 绝对定位的刻度文字，命中率线本身没有文字，横向压缩不失真）。X 轴刻度只在下段底部画一次。
- **命中率曲线**：复用现有 `curvePath()` 的单调三次插值（Fritsch–Carlson），把 Y 值换成命中率；删除柱图上的「每日合计」曲线与图例里对应那一项，图例改为「缓存命中率」。
- **chip**：`ChipGroup` 已是现成组件，趋势区与拆分区各挂一个，状态各自独立；`groupBy != both` 时不渲染。
- **悬停联动**：两段共用一个 hover 状态（日期）；悬停任一段 → 该日两段同时高亮（竖直虚线贯穿两段）、柱子提亮、命中率圆点放大；移出清除。
- **自定义 tooltip**：替换现在的原生 `title`。内容 = 日期、总 token、各分组明细（Top5 + 其他）、当天命中率（真实百分比）。定位用容器内绝对坐标，跟随鼠标列，贴近视口边缘时翻转。
- **统计卡最后一张**跟随拆分 chip 的文案与取值。
- **配色**：`SERIES` / `OTHER` 两个常量与相关内联色改为 `var(--dtu-s1…s5)` / `var(--dtu-other)`；根节点加 `data-dtu-palette`；CSS 里补齐三套 × 浅/深变量（第 5.3 节的三张表）。
- **`ConfigForm`** 增加两个控件（分组口径、配色方案），仍走 `namespace.setConfig`；加载回填与保存后重载沿用现有 `loadConfig / saveConfig`。

### 6.4 兼容性矩阵（客户端热更新、Host 要重启，必然出现新老组合）

| 组合 | 表现 |
| --- | --- |
| 新 Client + 新 Host | 全功能 |
| 新 Client + 老 Host | `groups` / `byGroup` 缺失 → 客户端用 `days[].byModel` + `models[]` **本地重算**分组（provider/model 字段都在）；配置缺 `groupBy` / `palette` → 回落默认值，chip 仍可用 |
| 老 Client + 新 Host | 老客户端只读 `byModel` / `models`，新增字段被忽略；`setConfig` 合并语义保证不会重置新键 |

## 7. 交互与边界

- **范围/来源切换**：重新取数后，命中率轴与 Top5 顺序都按新范围重算；hover 状态清空。
- **只有 1 天**：柱图单柱居中；命中率条退化为 ±1pp 轴。
- **各日命中率完全相同**：±1pp 轴；曲线是水平线（不是折线）。
- **某日无用量**：柱图该日空；命中率点列跳过该日，曲线跨过去连。
- **整个范围无命中率数据**：轴退回 0–100%，曲线不画，条内显示「无数据」占位。
- **超长范围**：沿用现状的天数裁剪/标签稀疏策略，不新增逻辑。
- **浅色/深色切换**：CSS 变量即时生效，图表无需重渲染。

## 8. 测试与验证

- `test/session-usage.test.mjs`（Host）：
  - 新增分组断言：同一 model 跨多个 provider 时，`groups.model` 合并、`groups.provider` 分开；每天 `byGroup` 的两个 map 相加都等于当天 `buckets`。
  - 新增命中率分母断言：构造 `cacheWrite > 0` 的样本，验证 `totals.cacheHitRate` 用的是 hit + miss。
  - 金标准对拍（与 DSH 投影缓存）保持不变，仍须通过。
- `test/client-smoke.test.mjs`（Client，假 DOM）：
  - 渲染新看板后断言：趋势区存在两段（柱容器 + 命中率条）、命中率条刻度文字等于按规则算出的 `lo / mid / hi`、chip 在 `both` 下出现而在 `model` 下不出现、根节点带 `data-dtu-palette`。
  - 用构造好的 snapshot 调用柱子/命中率条的 `onMouseEnter` 回调，断言两段同时进入 hover 状态、tooltip 内容含当天命中率。
  - 边界：空 snapshot、单日 snapshot、命中率全等 snapshot 不抛错。
- 手工验证：本机 DSH 重启后打开看板，三种配色 × 浅/深目视检查；与 `session_projcache` 的数字对拍仍一致。

## 9. 落地顺序与发版影响

1. Host 聚合（`lib/session-usage.js`）+ 单测。
2. `index.js` 配置与 wire（含合并语义、宽松校验）。
3. Client 布局改版（两段 + 共用 X 轴 + chip + 悬停联动 + tooltip）。
4. 配色系统 + `ConfigForm` 两个控件。
5. 文档：`README.md` / `README-zh.md` 的看板截图说明、`CHANGELOG` 新条目、`docs/DESIGN.md` `4.3 节改写（现文写的是「缓存命中率折线用 SVG overlay」的旧形态）。
6. 发版：`client.js` 与 `index.js` 都属 npm 打包文件，改动要发 **0.1.5** 才能到达用户（0.1.4 已发布，不重发）；版本号与 CHANGELOG 条目在发版时一起处理。

## 10. 风险与未决

| 项 | 说明 |
| --- | --- |
| schemastery 枚举写法 | 实现第 3 步时确认；退路是 `Schema.string()` + `setConfig` 白名单 |
| 悬停联动的 headless 覆盖 | 假 DOM 只能断言回调后的状态，不能验证真实指针行为；真实观感靠手工验证 |
| 命中率轴的可读性 | B 方案把波动放大后，也可能让微小抖动（0.2pp）看起来像大起大落；如出现，退路是把余量从 10% 提到 20% |
| 「其他」一档的颜色 | 三套色板的灰值见 5.3；若与其他色区分度不足，可改为降低饱和度的中性灰并加 2px 描边 |
| 新老组合的回归 | 刻意保留 `byModel` / `models`，但只在第 8 节的测试里覆盖新 Client + 老 Host 一条路径，老 Client + 新 Host 靠字段只增不改来保证 |
