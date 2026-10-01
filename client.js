/**
 * Browser half: a sidebar entry plus the usage dashboard it opens.
 *
 * Plain JavaScript on purpose. The module table offers React and nothing else
 * this plugin may depend on — the official guidance is explicit that importing
 * a Harness Client package risks blanking the slot entry when it changes — so
 * every control, chart and style here is written out, and styling uses only the
 * `--dsw-alias-*` theme tokens plus literal colors for the chart series.
 */
window.__ModuleLoader__.load({
  // The module id is the package name, exactly as the official client modules do it.
  id: 'dsh-desktop-token-usage',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    /** UI key: owns the `main` slot, the sidebar panel entry and the panel selection. */
    const PANEL_ID = 'dsh-desktop-token-usage'
    /** npm package name: addresses the Remote and keys this plugin's config card. */
    const REMOTE_PACKAGE = 'dsh-desktop-token-usage'
    const REMOTE_SERVICE = 'dshTokenUsage'
    const REMOTE_NAMESPACE = 'dshUsage'

    const SERIES = ['var(--dtu-s1)', 'var(--dtu-s2)', 'var(--dtu-s3)', 'var(--dtu-s4)', 'var(--dtu-s5)']
    const OTHER = 'var(--dtu-other)'
    /** The folded bucket key: every language labels it through `trend.other`. */
    const OTHER_KEY = '__other__'
    /** Ranks beyond this fold into the grey bucket. */
    const TOP_N = 5
    /** Series colour for a rank; ranks >= TOP_N render as the folded grey. */
    const seriesAt = (index) => (index < TOP_N ? SERIES[index] : OTHER)
    /** Quiet refresh period; keeps hour windows honest without polling hard. */
    const REFRESH_MS = 5 * 60_000

    // ── locale ──────────────────────────────────────────────────────────────

    /**
     * Copy lives in `locales/<id>.json` and reaches this file as one generated
     * block: the browser half is a single dependency-free file, so it cannot read
     * a JSON file at runtime. See `scripts/build-dicts.mjs`.
     */
    const NS = REMOTE_PACKAGE

/* @generated from locales/*.json by scripts/build-dicts.mjs - do not edit by hand */
    const DICT = {
      'en': {
        'range.7d': 'Last 7 days',
        'range.14d': 'Last 14 days',
        'range.30d': 'Last 30 days',
        'range.90d': 'Last 90 days',
        'range.all': 'All',
        'range.custom': 'Custom',
        'range.aria': 'Time range',
        'source.all': 'All',
        'source.client': 'Desktop · Web',
        'source.cli': 'CLI · Bots',
        'source.subagent': 'Subagents',
        'source.aria': 'Session source',
        'group.model': 'By model',
        'group.provider': 'By provider',
        'group.both': 'Both (switchable in the charts)',
        'group.aria': 'Grouping',
        'action.refresh': 'Refresh',
        'config.title': 'Time span of the dashboard\'s configured windows',
        'config.hint': '0 turns a window off; with both off only the all-time figure is shown. Windows snap to the local hour and apply as soon as they are saved; they do not follow the source filter at the top of the dashboard.',
        'config.hours': 'Hours back (0-23)',
        'config.days': 'Days back (0-30)',
        'config.palette': 'Palette',
        'config.palette.primer': 'Primer (GitHub default)',
        'config.palette.cvd': 'Colour-blind friendly (Okabe–Ito)',
        'config.palette.muted': 'Muted',
        'config.save': 'Save',
        'config.saving': 'Saving…',
        'config.current': 'Current: {text}',
        'config.readonly': 'This profile exposes no config editor; edit its cordis.patch.yml instead.',
        'window.hours': 'Last {hours} hours',
        'window.days': 'Last {days} days',
        'window.all': 'All time',
        'sidebar.title': 'Token usage',
        'sidebar.open': 'Open the token usage dashboard',
        'sidebar.rail': 'Token usage · {value}',
        'sidebar.error': 'Could not read - open for details',
        'sidebar.errorShort': 'Read failed',
        'detail.inputOutput': 'Input {input} · Output {output}',
        'detail.cacheHit': 'Cache hit {rate}',
        'state.loading': 'Reading local session logs…',
        'state.empty': 'No usage recorded for this filter.',
        'state.waiting': 'Waiting for the Host usage service… (if this persists, check the console with Ctrl+Shift+I)',
        'state.error': 'Could not read: {message}',
        'state.configError': 'Could not read the configuration',
        'state.badResponse': 'The usage service returned an unrecognised response',
        'card.tokens': 'Tokens',
        'card.tokens.sub': 'Uncached input {uncached} · Cache read {cached} · Output {output}',
        'card.turns': 'Completed turns',
        'card.requests': 'Requests',
        'card.requests.sub': 'Billable model calls',
        'card.activeDays': 'Active days',
        'card.hitRate': 'Average cache hit rate',
        'card.hitRate.sub': 'Cache hits / (hits + misses)',
        'card.topProvider': 'Top provider',
        'card.topModel': 'Top model',
        'card.share': '{percent} of total',
        'section.windows': 'Configured windows',
        'section.windows.hint': 'Fixed look-back windows; they ignore the source filter above. Adjust them under Plugins → Token usage.',
        'section.heat': 'Activity heatmap',
        'section.heat.hint': 'Follows the source filter; the calendar always shows the full history',
        'section.trend': 'Daily token trend',
        'section.breakdown': 'Usage breakdown',
        'heat.metric.aria': 'Heatmap metric',
        'heat.metric.tokens': 'Tokens',
        'heat.metric.turns': 'Turns',
        'heat.scope.weeks': 'Last {weeks} weeks',
        'heat.scope.filter': 'Current filter',
        'heat.unit.tokens': 'tokens',
        'heat.unit.turns': 'turns',
        'heat.less': 'Less',
        'heat.more': 'More',
        'trend.hint': 'Bars stack tokens; the cache hit-rate curve is overlaid on the same chart (real percentages on the right)',
        'trend.other': 'Other',
        'trend.hitRate': 'Cache hit rate',
        'trend.breakdownAria': 'Breakdown by',
        'tip.tokens': 'Tokens',
        'tip.turns': 'Turns',
        'tip.requests': 'Requests',
        'dash.title': 'Token usage',
        'filter.start': 'Start date',
        'filter.end': 'End date',
        'foot.updated': 'Updated {time}',
        'foot.source': 'Source: local session logs ({files}, offline)',
        'foot.inference1': 'Sources are inferred from local signals: desktop and web cannot be told apart offline, and both are reported as ',
        'foot.inference2': '; ',
        'foot.inference3': ' covers sessions with no client.',
        'error.render': '{package} failed to render ({label}): {message}',
        'a11y.dashboard': 'Central dashboard',
        'a11y.sidebar': 'Sidebar card',
        'list.separator': ', ',
        'lang.zh-TW': '繁體中文（臺灣）',
        'lang.zh-HK': '繁體中文（香港）',
        'lang.de': 'Deutsch',
        'lang.fr': 'Français',
        'lang.es': 'Español',
        'lang.it': 'Italiano',
        'lang.ja': '日本語',
        'lang.ko': '한국어',
        'heat.legend.one': '{scope} · {days} day with activity · {total} {unit} in total',
        'heat.legend.other': '{scope} · {days} days with activity · {total} {unit} in total',
        'unit.turns.one': '{n} turn',
        'unit.turns.other': '{n} turns',
        'unit.sessions.one': '{n} session',
        'unit.sessions.other': '{n} sessions',
        'unit.files.one': '{n} file',
        'unit.files.other': '{n} files',
      },
      'zh': {
        'range.7d': '最近 7 天',
        'range.14d': '最近 14 天',
        'range.30d': '最近 30 天',
        'range.90d': '最近 90 天',
        'range.all': '全部',
        'range.custom': '自定义',
        'range.aria': '时间范围',
        'source.all': '全部',
        'source.client': '桌面·网页',
        'source.cli': '命令行·机器人',
        'source.subagent': '子代理',
        'source.aria': '会话来源',
        'group.model': '按模型',
        'group.provider': '按供应商',
        'group.both': '都统计（图表上可切换）',
        'group.aria': '统计口径',
        'action.refresh': '刷新',
        'config.title': '看板「配置窗口」的时间跨度',
        'config.hint': '0 表示关闭该窗口；两个都关闭时只显示累计值。窗口按本地时间取整到小时，保存后立即生效；它们不随看板上方的来源筛选变化。',
        'config.hours': '最近多少小时（0-23）',
        'config.days': '最近多少天（0-30）',
        'config.palette': '配色方案',
        'config.palette.primer': 'Primer（GitHub 默认）',
        'config.palette.cvd': '色盲友好（Okabe–Ito）',
        'config.palette.muted': '低饱和雾面',
        'config.save': '保存',
        'config.saving': '保存中…',
        'config.current': '当前：{text}',
        'config.readonly': '这个 profile 没有提供配置编辑器，请改 profile 的 cordis.patch.yml。',
        'window.hours': '近 {hours} 小时',
        'window.days': '近 {days} 天',
        'window.all': '累计',
        'sidebar.title': 'Token 用量',
        'sidebar.open': '打开 Token 用量看板',
        'sidebar.rail': 'Token 用量 · {value}',
        'sidebar.error': '读取失败，点开查看原因',
        'sidebar.errorShort': '读取失败',
        'detail.inputOutput': '输入 {input} · 输出 {output}',
        'detail.cacheHit': '缓存命中 {rate}',
        'state.loading': '正在读取本地会话日志…',
        'state.empty': '该筛选条件下没有用量记录。',
        'state.waiting': '等待 Host 用量服务…（若长时间不变，按 Ctrl+Shift+I 看控制台报错）',
        'state.error': '读取失败：{message}',
        'state.configError': '配置读取失败',
        'state.badResponse': '用量服务返回了无法识别的响应',
        'card.tokens': 'Tokens 用量',
        'card.tokens.sub': '未缓存输入 {uncached} · 缓存读取 {cached} · 输出 {output}',
        'card.turns': '完成轮次',
        'card.requests': '请求数量',
        'card.requests.sub': '计费模型调用次数',
        'card.activeDays': '活跃天数',
        'card.hitRate': '平均缓存命中率',
        'card.hitRate.sub': '缓存命中 / (缓存命中 + 未命中)',
        'card.topProvider': '最常用供应商',
        'card.topModel': '最常用模型',
        'card.share': '占比 {percent}',
        'section.windows': '配置窗口',
        'section.windows.hint': '固定回溯窗口，不随上方来源筛选变化；在 插件 → Token 用量 里调整',
        'section.heat': '活跃热力图',
        'section.heat.hint': '跟随来源筛选；日历始终显示完整历史',
        'section.trend': '按天 Token 趋势',
        'section.breakdown': '用量拆分',
        'heat.metric.aria': '热力图指标',
        'heat.metric.tokens': 'Tokens',
        'heat.metric.turns': '轮次',
        'heat.scope.weeks': '近 {weeks} 周',
        'heat.scope.filter': '当前筛选',
        'heat.unit.tokens': 'tokens',
        'heat.unit.turns': '轮',
        'heat.less': '较少',
        'heat.more': '较多',
        'trend.hint': '柱按 token 堆叠，缓存命中率曲线叠加在同一张图上（右侧为真实百分比）',
        'trend.other': '其他',
        'trend.hitRate': '缓存命中率',
        'trend.breakdownAria': '拆分口径',
        'tip.tokens': 'Tokens',
        'tip.turns': '轮次',
        'tip.requests': '请求',
        'dash.title': 'Token 用量',
        'filter.start': '开始日期',
        'filter.end': '结束日期',
        'foot.updated': '统计截至 {time}',
        'foot.source': '数据源：本地会话日志（{files}，未联网）',
        'foot.inference1': '来源按本地可观测信号推断：桌面端与网页端无法离线区分，二者同归「',
        'foot.inference2': '」；「',
        'foot.inference3': '」指无客户端的会话。',
        'error.render': '{package} 渲染失败（{label}）：{message}',
        'a11y.dashboard': '中央看板',
        'a11y.sidebar': '侧边栏卡片',
        'list.separator': '、',
        'lang.zh-TW': '繁體中文（臺灣）',
        'lang.zh-HK': '繁體中文（香港）',
        'lang.de': 'Deutsch',
        'lang.fr': 'Français',
        'lang.es': 'Español',
        'lang.it': 'Italiano',
        'lang.ja': '日本語',
        'lang.ko': '한국어',
        'heat.legend.other': '{scope}共 {days} 天有活动 · 合计 {total} {unit}',
        'unit.turns.other': '{n} 轮',
        'unit.sessions.other': '会话 {n} 个',
        'unit.files.other': '{n} 个文件',
      },
      'zh-TW': {
        'range.7d': '最近 7 天',
        'range.14d': '最近 14 天',
        'range.30d': '最近 30 天',
        'range.90d': '最近 90 天',
        'range.all': '全部',
        'range.custom': '自訂',
        'range.aria': '時間範圍',
        'source.all': '全部',
        'source.client': '桌面 · 網頁',
        'source.cli': 'CLI · 機器人',
        'source.subagent': '子代理',
        'source.aria': '工作階段來源',
        'group.model': '按模型',
        'group.provider': '按供應商',
        'group.both': '都統計（圖表上可切換）',
        'group.aria': '分組方式',
        'action.refresh': '重新整理',
        'config.title': '儀表板「設定窗口」的時間跨度',
        'config.hint': '0 表示關閉該窗口；兩個都關閉時只顯示累計值。窗口按本地時間取整到小時，儲存後立即生效；它們不隨儀表板頂部的來源篩選變化。',
        'config.hours': '最近多少小時（0-23）',
        'config.days': '最近多少天（0-30）',
        'config.palette': '配色',
        'config.palette.primer': 'Primer（GitHub 預設）',
        'config.palette.cvd': '色盲友善（Okabe–Ito）',
        'config.palette.muted': '低飽和霧面',
        'config.save': '儲存',
        'config.saving': '儲存中…',
        'config.current': '目前：{text}',
        'config.readonly': '這個 profile 沒有提供設定編輯器，請改編其 cordis.patch.yml。',
        'window.hours': '近 {hours} 小時',
        'window.days': '近 {days} 天',
        'window.all': '累計',
        'sidebar.title': 'Token 用量',
        'sidebar.open': '開啟 Token 用量儀表板',
        'sidebar.rail': 'Token 用量 · {value}',
        'sidebar.error': '讀取失敗，點開查看詳情',
        'sidebar.errorShort': '讀取失敗',
        'detail.inputOutput': '輸入 {input} · 輸出 {output}',
        'detail.cacheHit': '快取命中 {rate}',
        'state.loading': '正在讀取本機工作階段記錄…',
        'state.empty': '此篩選條件下沒有用量紀錄。',
        'state.waiting': '正在等待 Host 用量服務…（若長時間不變，按 Ctrl+Shift+I 查看主控台）',
        'state.error': '無法讀取：{message}',
        'state.configError': '無法讀取設定',
        'state.badResponse': '用量服務傳回了無法識別的回應',
        'card.tokens': 'Tokens 用量',
        'card.tokens.sub': '未快取輸入 {uncached} · 快取讀取 {cached} · 輸出 {output}',
        'card.turns': '完成輪次',
        'card.requests': '請求',
        'card.requests.sub': '計費的模型呼叫',
        'card.activeDays': '活躍天數',
        'card.hitRate': '平均快取命中率',
        'card.hitRate.sub': '快取命中 / (快取命中 + 未命中)',
        'card.topProvider': '最常用供應商',
        'card.topModel': '最常用模型',
        'card.share': '佔比 {percent}',
        'section.windows': '設定窗口',
        'section.windows.hint': '固定的回溯窗口；不隨上方的來源篩選變化。可在 外掛 → Token 用量 中調整。',
        'section.heat': '活動熱力圖',
        'section.heat.hint': '跟隨來源篩選；日曆始終顯示完整歷史',
        'section.trend': '每日 Token 趨勢',
        'section.breakdown': '用量拆分',
        'heat.metric.aria': '熱力圖指標',
        'heat.metric.tokens': 'Tokens',
        'heat.metric.turns': '輪次',
        'heat.scope.weeks': '近 {weeks} 週',
        'heat.scope.filter': '目前篩選',
        'heat.unit.tokens': 'tokens',
        'heat.unit.turns': '輪次',
        'heat.less': '較少',
        'heat.more': '較多',
        'trend.hint': '長條堆疊 Token；快取命中率曲線疊加在同一張圖上（右側標示實際百分比）',
        'trend.other': '其他',
        'trend.hitRate': '快取命中率',
        'trend.breakdownAria': '拆分方式',
        'tip.tokens': 'Tokens',
        'tip.turns': '輪次',
        'tip.requests': '請求',
        'dash.title': 'Token 用量',
        'filter.start': '開始日期',
        'filter.end': '結束日期',
        'foot.updated': '更新於 {time}',
        'foot.source': '資料來源：本機工作階段記錄（{files}，離線）',
        'foot.inference1': '來源由本機訊號推斷：桌面與網頁離線時無法區分，二者同歸「',
        'foot.inference2': '」；「',
        'foot.inference3': '」指沒有用戶端的工作階段。',
        'error.render': '{package} 渲染失敗（{label}）：{message}',
        'a11y.dashboard': '中央儀表板',
        'a11y.sidebar': '側邊欄卡片',
        'list.separator': '、',
        'lang.zh-TW': '繁體中文（臺灣）',
        'lang.zh-HK': '繁體中文（香港）',
        'lang.de': 'Deutsch',
        'lang.fr': 'Français',
        'lang.es': 'Español',
        'lang.it': 'Italiano',
        'lang.ja': '日本語',
        'lang.ko': '한국어',
        'heat.legend.other': '{scope}共 {days} 天有活動 · 合計 {total} {unit}',
        'unit.turns.other': '{n} 輪次',
        'unit.sessions.other': '{n} 個工作階段',
        'unit.files.other': '{n} 個檔案',
      },
      'zh-HK': {
        'range.7d': '最近 7 天',
        'range.14d': '最近 14 天',
        'range.30d': '最近 30 天',
        'range.90d': '最近 90 天',
        'range.all': '全部',
        'range.custom': '自訂',
        'range.aria': '時間範圍',
        'source.all': '全部',
        'source.client': '桌面 · 網頁',
        'source.cli': 'CLI · 機械人',
        'source.subagent': '子代理',
        'source.aria': '工作階段來源',
        'group.model': '按模型',
        'group.provider': '按供應商',
        'group.both': '兩者都要（圖表上可切換）',
        'group.aria': '統計口徑',
        'action.refresh': '重新整理',
        'config.title': '儀表板「配置窗口」的時間跨度',
        'config.hint': '0 表示關閉該窗口；兩個都關閉時只顯示累計值。窗口按本地時間取整到小時，儲存後立即生效；它們不會跟隨儀表板頂部的來源篩選。',
        'config.hours': '最近多少小時（0-23）',
        'config.days': '最近多少天（0-30）',
        'config.palette': '配色',
        'config.palette.primer': 'Primer（GitHub 預設）',
        'config.palette.cvd': '色盲友好（Okabe–Ito）',
        'config.palette.muted': '低飽和霧面',
        'config.save': '儲存',
        'config.saving': '儲存中…',
        'config.current': '目前：{text}',
        'config.readonly': '這個 profile 沒有提供配置編輯器，請改為編輯它的 cordis.patch.yml。',
        'window.hours': '近 {hours} 小時',
        'window.days': '近 {days} 天',
        'window.all': '累計',
        'sidebar.title': 'Token 用量',
        'sidebar.open': '開啟 Token 用量儀表板',
        'sidebar.rail': 'Token 用量 · {value}',
        'sidebar.error': '讀取失敗，點開查看詳情',
        'sidebar.errorShort': '讀取失敗',
        'detail.inputOutput': '輸入 {input} · 輸出 {output}',
        'detail.cacheHit': '緩存命中 {rate}',
        'state.loading': '正在讀取本地工作階段日誌…',
        'state.empty': '這個篩選條件下沒有用量記錄。',
        'state.waiting': '等待 Host 用量服務…（若長時間如此，按 Ctrl+Shift+I 查看控制台）',
        'state.error': '讀取失敗：{message}',
        'state.configError': '無法讀取配置',
        'state.badResponse': '用量服務回傳了無法識別的回應',
        'card.tokens': 'Tokens 用量',
        'card.tokens.sub': '未緩存輸入 {uncached} · 緩存讀取 {cached} · 輸出 {output}',
        'card.turns': '完成輪次',
        'card.requests': '請求數',
        'card.requests.sub': '計費的模型調用次數',
        'card.activeDays': '活躍天數',
        'card.hitRate': '平均緩存命中率',
        'card.hitRate.sub': '緩存命中 / (緩存命中 + 未命中)',
        'card.topProvider': '最常用供應商',
        'card.topModel': '最常用模型',
        'card.share': '佔比 {percent}',
        'section.windows': '配置窗口',
        'section.windows.hint': '固定回溯窗口，不隨上方的來源篩選變化；在 插件 → Token 用量 裡調整。',
        'section.heat': '活動熱力圖',
        'section.heat.hint': '跟隨來源篩選；日曆始終顯示完整歷史',
        'section.trend': '每日 Token 趨勢',
        'section.breakdown': '用量拆分',
        'heat.metric.aria': '熱力圖指標',
        'heat.metric.tokens': 'Tokens',
        'heat.metric.turns': '輪次',
        'heat.scope.weeks': '近 {weeks} 週',
        'heat.scope.filter': '目前篩選',
        'heat.unit.tokens': 'tokens',
        'heat.unit.turns': '輪',
        'heat.less': '較少',
        'heat.more': '較多',
        'trend.hint': '柱按 Token 堆疊；緩存命中率曲線疊加在同一張圖上（右側為真實百分比）',
        'trend.other': '其他',
        'trend.hitRate': '緩存命中率',
        'trend.breakdownAria': '拆分口徑',
        'tip.tokens': 'Tokens',
        'tip.turns': '輪次',
        'tip.requests': '請求',
        'dash.title': 'Token 用量',
        'filter.start': '開始日期',
        'filter.end': '結束日期',
        'foot.updated': '統計截至 {time}',
        'foot.source': '數據來源：本地工作階段日誌（{files}，未聯網）',
        'foot.inference1': '來源按本地可觀測信號推斷：桌面端與網頁端無法離線區分，二者同歸「',
        'foot.inference2': '」；「',
        'foot.inference3': '」指沒有客戶端的工作階段。',
        'error.render': '{package} 渲染失敗（{label}）：{message}',
        'a11y.dashboard': '中央儀表板',
        'a11y.sidebar': '側邊欄卡片',
        'list.separator': '、',
        'lang.zh-TW': '繁體中文（臺灣）',
        'lang.zh-HK': '繁體中文（香港）',
        'lang.de': 'Deutsch',
        'lang.fr': 'Français',
        'lang.es': 'Español',
        'lang.it': 'Italiano',
        'lang.ja': '日本語',
        'lang.ko': '한국어',
        'heat.legend.other': '{scope}共 {days} 天有活動 · 合計 {total} {unit}',
        'unit.turns.other': '{n} 輪',
        'unit.sessions.other': '{n} 個工作階段',
        'unit.files.other': '{n} 個檔案',
      },
      'de': {
        'range.7d': 'Letzte 7 Tage',
        'range.14d': 'Letzte 14 Tage',
        'range.30d': 'Letzte 30 Tage',
        'range.90d': 'Letzte 90 Tage',
        'range.all': 'Alle',
        'range.custom': 'Benutzerdefiniert',
        'range.aria': 'Zeitraum',
        'source.all': 'Alle',
        'source.client': 'Desktop · Web',
        'source.cli': 'CLI · Bots',
        'source.subagent': 'Subagenten',
        'source.aria': 'Sitzungsquelle',
        'group.model': 'Nach Modell',
        'group.provider': 'Nach Anbieter',
        'group.both': 'Beides (in den Diagrammen umschaltbar)',
        'group.aria': 'Gruppierung',
        'action.refresh': 'Aktualisieren',
        'config.title': 'Zeitraum der konfigurierten Fenster des Dashboards',
        'config.hint': '0 schaltet ein Fenster ab; wenn beide aus sind, wird nur der Gesamtwert angezeigt. Die Fenster rasten auf die volle Stunde und gelten sofort nach dem Speichern; sie folgen nicht dem Quellfilter oben im Dashboard.',
        'config.hours': 'Stunden zurück (0-23)',
        'config.days': 'Tage zurück (0-30)',
        'config.palette': 'Palette',
        'config.palette.primer': 'Primer (GitHub-Standard)',
        'config.palette.cvd': 'Farbenblind-freundlich (Okabe–Ito)',
        'config.palette.muted': 'Gedämpft',
        'config.save': 'Speichern',
        'config.saving': 'Speichern…',
        'config.current': 'Aktuell: {text}',
        'config.readonly': 'Dieses Profil bietet keinen Konfigurationseditor; bearbeiten Sie stattdessen seine cordis.patch.yml.',
        'window.hours': 'Letzte {hours} Stunden',
        'window.days': 'Letzte {days} Tage',
        'window.all': 'Gesamter Zeitraum',
        'sidebar.title': 'Token-Nutzung',
        'sidebar.open': 'Dashboard der Token-Nutzung öffnen',
        'sidebar.rail': 'Token-Nutzung · {value}',
        'sidebar.error': 'Konnte nicht gelesen werden - Details öffnen',
        'sidebar.errorShort': 'Lesen fehlgeschlagen',
        'detail.inputOutput': 'Eingabe {input} · Ausgabe {output}',
        'detail.cacheHit': 'Cache-Treffer {rate}',
        'state.loading': 'Lokale Sitzungsprotokolle werden gelesen…',
        'state.empty': 'Für diesen Filter ist keine Nutzung aufgezeichnet.',
        'state.waiting': 'Warten auf den Host-Nutzungsdienst… (wenn das anhält, prüfen Sie die Konsole mit Ctrl+Shift+I)',
        'state.error': 'Konnte nicht gelesen werden: {message}',
        'state.configError': 'Die Konfiguration konnte nicht gelesen werden',
        'state.badResponse': 'Der Nutzungsdienst hat eine unbekannte Antwort zurückgegeben',
        'card.tokens': 'Tokens',
        'card.tokens.sub': 'Ungecachte Eingabe {uncached} · Cache-Lesungen {cached} · Ausgabe {output}',
        'card.turns': 'Abgeschlossene Runden',
        'card.requests': 'Anfragen',
        'card.requests.sub': 'Abrechenbare Modellaufrufe',
        'card.activeDays': 'Aktive Tage',
        'card.hitRate': 'Durchschnittliche Cache-Trefferquote',
        'card.hitRate.sub': 'Cache-Treffer / (Treffer + Fehltreffer)',
        'card.topProvider': 'Führender Anbieter',
        'card.topModel': 'Führendes Modell',
        'card.share': '{percent} des Gesamtwerts',
        'section.windows': 'Konfigurierte Fenster',
        'section.windows.hint': 'Feste Rückblick-Fenster; sie ignorieren den Quellfilter oben. Anpassen unter Plugins → Token-Nutzung.',
        'section.heat': 'Aktivitäts-Heatmap',
        'section.heat.hint': 'Folgt dem Quellfilter; der Kalender zeigt immer die vollständige Historie',
        'section.trend': 'Täglicher Token-Verlauf',
        'section.breakdown': 'Nutzungsaufschlüsselung',
        'heat.metric.aria': 'Heatmap-Metrik',
        'heat.metric.tokens': 'Tokens',
        'heat.metric.turns': 'Runden',
        'heat.scope.weeks': 'Letzte {weeks} Wochen',
        'heat.scope.filter': 'Aktueller Filter',
        'heat.unit.tokens': 'Tokens',
        'heat.unit.turns': 'Runden',
        'heat.less': 'Weniger',
        'heat.more': 'Mehr',
        'trend.hint': 'Die Balken stapeln Tokens; die Kurve der Cache-Trefferquote liegt über demselben Diagramm (reale Prozentwerte rechts)',
        'trend.other': 'Sonstige',
        'trend.hitRate': 'Cache-Trefferquote',
        'trend.breakdownAria': 'Aufschlüsselung nach',
        'tip.tokens': 'Tokens',
        'tip.turns': 'Runden',
        'tip.requests': 'Anfragen',
        'dash.title': 'Token-Nutzung',
        'filter.start': 'Startdatum',
        'filter.end': 'Enddatum',
        'foot.updated': 'Aktualisiert {time}',
        'foot.source': 'Quelle: Lokale Sitzungsprotokolle ({files}, offline)',
        'foot.inference1': 'Quellen werden aus lokalen Signalen abgeleitet: Desktop und Web lassen sich offline nicht unterscheiden; beide werden gemeldet als ',
        'foot.inference2': '; ',
        'foot.inference3': ' deckt Sitzungen ohne Client ab.',
        'error.render': '{package} konnte nicht gerendert werden ({label}): {message}',
        'a11y.dashboard': 'Zentrales Dashboard',
        'a11y.sidebar': 'Karte in der Seitenleiste',
        'list.separator': ', ',
        'lang.zh-TW': '繁體中文（臺灣）',
        'lang.zh-HK': '繁體中文（香港）',
        'lang.de': 'Deutsch',
        'lang.fr': 'Français',
        'lang.es': 'Español',
        'lang.it': 'Italiano',
        'lang.ja': '日本語',
        'lang.ko': '한국어',
        'heat.legend.one': '{scope} · {days} Tag mit Aktivität · {total} {unit} insgesamt',
        'heat.legend.other': '{scope} · {days} Tage mit Aktivität · {total} {unit} insgesamt',
        'unit.turns.one': '{n} Runde',
        'unit.turns.other': '{n} Runden',
        'unit.sessions.one': '{n} Sitzung',
        'unit.sessions.other': '{n} Sitzungen',
        'unit.files.one': '{n} Datei',
        'unit.files.other': '{n} Dateien',
      },
      'fr': {
        'range.7d': '7 derniers jours',
        'range.14d': '14 derniers jours',
        'range.30d': '30 derniers jours',
        'range.90d': '90 derniers jours',
        'range.all': 'Tout',
        'range.custom': 'Personnalisé',
        'range.aria': 'Plage temporelle',
        'source.all': 'Toutes',
        'source.client': 'Desktop · Web',
        'source.cli': 'CLI · Bots',
        'source.subagent': 'Sous-agents',
        'source.aria': 'Source de la session',
        'group.model': 'Par modèle',
        'group.provider': 'Par fournisseur',
        'group.both': 'Les deux (commutable dans les graphiques)',
        'group.aria': 'Regroupement',
        'action.refresh': 'Actualiser',
        'config.title': 'Plage temporelle des fenêtres configurées du tableau de bord',
        'config.hint': '0 désactive une fenêtre ; avec les deux désactivées, seule la valeur cumulée de toute la période est affichée. Les fenêtres sont arrondies à l\'heure locale et prennent effet dès leur enregistrement ; elles ne suivent pas le filtre de source en haut du tableau de bord.',
        'config.hours': 'Heures en arrière (0-23)',
        'config.days': 'Jours en arrière (0-30)',
        'config.palette': 'Palette',
        'config.palette.primer': 'Primer (défaut GitHub)',
        'config.palette.cvd': 'Accessible aux daltoniens (Okabe–Ito)',
        'config.palette.muted': 'Atténuée',
        'config.save': 'Enregistrer',
        'config.saving': 'Enregistrement…',
        'config.current': 'Actuel : {text}',
        'config.readonly': 'Ce profile n\'expose pas d\'éditeur de configuration ; modifiez plutôt son cordis.patch.yml.',
        'window.hours': 'Dernières {hours} heures',
        'window.days': 'Derniers {days} jours',
        'window.all': 'Tout l\'historique',
        'sidebar.title': 'Utilisation des tokens',
        'sidebar.open': 'Ouvrir le tableau de bord d\'utilisation des tokens',
        'sidebar.rail': 'Utilisation des tokens · {value}',
        'sidebar.error': 'Lecture impossible - ouvrir pour plus de détails',
        'sidebar.errorShort': 'Échec de la lecture',
        'detail.inputOutput': 'Entrée {input} · Sortie {output}',
        'detail.cacheHit': 'Réussite du cache {rate}',
        'state.loading': 'Lecture des journaux de sessions locaux…',
        'state.empty': 'Aucun usage enregistré pour ce filtre.',
        'state.waiting': 'En attente du service d\'usage du Host… (si cela persiste, vérifiez la console avec Ctrl+Shift+I)',
        'state.error': 'Lecture impossible : {message}',
        'state.configError': 'Impossible de lire la configuration',
        'state.badResponse': 'Le service d\'usage a renvoyé une réponse non reconnue',
        'card.tokens': 'Tokens',
        'card.tokens.sub': 'Entrée non mise en cache {uncached} · Lecture de cache {cached} · Sortie {output}',
        'card.turns': 'Tours terminés',
        'card.requests': 'Requêtes',
        'card.requests.sub': 'Appels de modèle facturables',
        'card.activeDays': 'Jours d\'activité',
        'card.hitRate': 'Taux de réussite du cache moyen',
        'card.hitRate.sub': 'Réussites du cache / (réussites + échecs)',
        'card.topProvider': 'Fournisseur principal',
        'card.topModel': 'Modèle principal',
        'card.share': '{percent} du total',
        'section.windows': 'Fenêtres configurées',
        'section.windows.hint': 'Fenêtres de recul fixes ; elles ignorent le filtre de source ci-dessus. Ajustez-les sous Plugins → Utilisation des tokens.',
        'section.heat': 'Carte de chaleur d\'activité',
        'section.heat.hint': 'Suit le filtre de source ; le calendrier montre toujours tout l\'historique',
        'section.trend': 'Tendance quotidienne des tokens',
        'section.breakdown': 'Répartition de l\'usage',
        'heat.metric.aria': 'Métrique de la carte de chaleur',
        'heat.metric.tokens': 'Tokens',
        'heat.metric.turns': 'Tours',
        'heat.scope.weeks': 'Dernières {weeks} semaines',
        'heat.scope.filter': 'Filtre actuel',
        'heat.unit.tokens': 'tokens',
        'heat.unit.turns': 'tours',
        'heat.less': 'Moins',
        'heat.more': 'Plus',
        'trend.hint': 'Les barres empilent les tokens ; la courbe de taux de réussite du cache est superposée au même graphique (pourcentages réels à droite)',
        'trend.other': 'Autre',
        'trend.hitRate': 'Taux de réussite du cache',
        'trend.breakdownAria': 'Répartition par',
        'tip.tokens': 'Tokens',
        'tip.turns': 'Tours',
        'tip.requests': 'Requêtes',
        'dash.title': 'Utilisation des tokens',
        'filter.start': 'Date de début',
        'filter.end': 'Date de fin',
        'foot.updated': 'Mis à jour {time}',
        'foot.source': 'Source : journaux de sessions locaux ({files}, hors ligne)',
        'foot.inference1': 'Les sources sont déduites de signaux locaux : le desktop et le web ne peuvent pas être distingués hors ligne, et les deux sont rapportés comme ',
        'foot.inference2': '; ',
        'foot.inference3': ' couvrent les sessions sans client.',
        'error.render': '{package} n\'a pas pu s\'afficher ({label}) : {message}',
        'a11y.dashboard': 'Tableau de bord central',
        'a11y.sidebar': 'Carte de la barre latérale',
        'list.separator': ', ',
        'lang.zh-TW': '繁體中文（臺灣）',
        'lang.zh-HK': '繁體中文（香港）',
        'lang.de': 'Deutsch',
        'lang.fr': 'Français',
        'lang.es': 'Español',
        'lang.it': 'Italiano',
        'lang.ja': '日本語',
        'lang.ko': '한국어',
        'heat.legend.one': '{scope} · {days} jour avec activité · {total} {unit} au total',
        'heat.legend.many': '{scope} · {days} jours avec activité · {total} {unit} au total',
        'heat.legend.other': '{scope} · {days} jours avec activité · {total} {unit} au total',
        'unit.turns.one': '{n} tour',
        'unit.turns.many': '{n} tours',
        'unit.turns.other': '{n} tours',
        'unit.sessions.one': '{n} session',
        'unit.sessions.many': '{n} sessions',
        'unit.sessions.other': '{n} sessions',
        'unit.files.one': '{n} fichier',
        'unit.files.many': '{n} fichiers',
        'unit.files.other': '{n} fichiers',
      },
      'es': {
        'range.7d': 'Últimos 7 días',
        'range.14d': 'Últimos 14 días',
        'range.30d': 'Últimos 30 días',
        'range.90d': 'Últimos 90 días',
        'range.all': 'Todo',
        'range.custom': 'Personalizado',
        'range.aria': 'Intervalo de tiempo',
        'source.all': 'Todos',
        'source.client': 'Desktop · Web',
        'source.cli': 'CLI · Bots',
        'source.subagent': 'Subagentes',
        'source.aria': 'Origen de la sesión',
        'group.model': 'Por modelo',
        'group.provider': 'Por proveedor',
        'group.both': 'Ambos (cambiable en los gráficos)',
        'group.aria': 'Agrupación',
        'action.refresh': 'Actualizar',
        'config.title': 'Intervalo de tiempo de las ventanas configuradas del panel',
        'config.hint': '0 desactiva una ventana; con las dos desactivadas solo se muestra la cifra de todo el periodo. Las ventanas se ajustan a la hora local y se aplican en cuanto se guardan; no siguen el filtro de origen de la parte superior del panel.',
        'config.hours': 'Horas hacia atrás (0-23)',
        'config.days': 'Días hacia atrás (0-30)',
        'config.palette': 'Paleta',
        'config.palette.primer': 'Primer (predeterminado de GitHub)',
        'config.palette.cvd': 'Apto para daltónicos (Okabe–Ito)',
        'config.palette.muted': 'Desaturado',
        'config.save': 'Guardar',
        'config.saving': 'Guardando…',
        'config.current': 'Actual: {text}',
        'config.readonly': 'Este profile no expone un editor de configuración; edite en su lugar su cordis.patch.yml.',
        'window.hours': 'Últimas {hours} horas',
        'window.days': 'Últimos {days} días',
        'window.all': 'Todo el periodo',
        'sidebar.title': 'Uso de Tokens',
        'sidebar.open': 'Abrir el panel de uso de Tokens',
        'sidebar.rail': 'Uso de Tokens · {value}',
        'sidebar.error': 'No se pudo leer - ábralo para ver los detalles',
        'sidebar.errorShort': 'Error de lectura',
        'detail.inputOutput': 'Entrada {input} · Salida {output}',
        'detail.cacheHit': 'Acierto de caché {rate}',
        'state.loading': 'Leyendo registros de sesiones locales…',
        'state.empty': 'No hay uso registrado con este filtro.',
        'state.waiting': 'Esperando al servicio de uso del Host… (si persiste, compruebe la consola con Ctrl+Shift+I)',
        'state.error': 'No se pudo leer: {message}',
        'state.configError': 'No se pudo leer la configuración',
        'state.badResponse': 'El servicio de uso devolvió una respuesta no reconocida',
        'card.tokens': 'Tokens',
        'card.tokens.sub': 'Entrada sin caché {uncached} · Lectura de caché {cached} · Salida {output}',
        'card.turns': 'Turnos completados',
        'card.requests': 'Solicitudes',
        'card.requests.sub': 'Llamadas al modelo facturables',
        'card.activeDays': 'Días activos',
        'card.hitRate': 'Tasa media de aciertos de caché',
        'card.hitRate.sub': 'Aciertos de caché / (aciertos + fallos)',
        'card.topProvider': 'Proveedor principal',
        'card.topModel': 'Modelo principal',
        'card.share': '{percent} del total',
        'section.windows': 'Ventanas configuradas',
        'section.windows.hint': 'Ventanas fijas hacia atrás en el tiempo; ignoran el filtro de origen de arriba. Ajuste las ventanas en Plugins → Uso de Tokens.',
        'section.heat': 'Mapa de calor de actividad',
        'section.heat.hint': 'Sigue el filtro de origen; el calendario siempre muestra todo el historial',
        'section.trend': 'Tendencia diaria de Tokens',
        'section.breakdown': 'Desglose del uso',
        'heat.metric.aria': 'Métrica del mapa de calor',
        'heat.metric.tokens': 'Tokens',
        'heat.metric.turns': 'Turnos',
        'heat.scope.weeks': 'Últimas {weeks} semanas',
        'heat.scope.filter': 'Filtro actual',
        'heat.unit.tokens': 'tokens',
        'heat.unit.turns': 'turnos',
        'heat.less': 'Menos',
        'heat.more': 'Más',
        'trend.hint': 'Las barras apilan los Tokens; la curva de tasa de aciertos de caché se superpone en el mismo gráfico (porcentajes reales a la derecha)',
        'trend.other': 'Otros',
        'trend.hitRate': 'Tasa de aciertos de caché',
        'trend.breakdownAria': 'Desglose por',
        'tip.tokens': 'Tokens',
        'tip.turns': 'Turnos',
        'tip.requests': 'Solicitudes',
        'dash.title': 'Uso de Tokens',
        'filter.start': 'Fecha de inicio',
        'filter.end': 'Fecha de fin',
        'foot.updated': 'Actualizado {time}',
        'foot.source': 'Origen: registros de sesiones locales ({files}, sin conexión)',
        'foot.inference1': 'Los orígenes se infieren de señales locales: escritorio y web no se pueden distinguir sin conexión, y ambos se reportan como ',
        'foot.inference2': '; ',
        'foot.inference3': ' cubre las sesiones sin cliente.',
        'error.render': '{package} no se pudo renderizar ({label}): {message}',
        'a11y.dashboard': 'Panel central',
        'a11y.sidebar': 'Tarjeta de la barra lateral',
        'list.separator': ', ',
        'lang.zh-TW': '繁體中文（臺灣）',
        'lang.zh-HK': '繁體中文（香港）',
        'lang.de': 'Deutsch',
        'lang.fr': 'Français',
        'lang.es': 'Español',
        'lang.it': 'Italiano',
        'lang.ja': '日本語',
        'lang.ko': '한국어',
        'heat.legend.one': '{scope} · {days} día con actividad · {total} {unit} en total',
        'heat.legend.many': '{scope} · {days} días con actividad · {total} {unit} en total',
        'heat.legend.other': '{scope} · {days} días con actividad · {total} {unit} en total',
        'unit.turns.one': '{n} turno',
        'unit.turns.many': '{n} turnos',
        'unit.turns.other': '{n} turnos',
        'unit.sessions.one': '{n} sesión',
        'unit.sessions.many': '{n} sesiones',
        'unit.sessions.other': '{n} sesiones',
        'unit.files.one': '{n} archivo',
        'unit.files.many': '{n} archivos',
        'unit.files.other': '{n} archivos',
      },
      'it': {
        'range.7d': 'Ultimi 7 giorni',
        'range.14d': 'Ultimi 14 giorni',
        'range.30d': 'Ultimi 30 giorni',
        'range.90d': 'Ultimi 90 giorni',
        'range.all': 'Tutto',
        'range.custom': 'Personalizzato',
        'range.aria': 'Intervallo di tempo',
        'source.all': 'Tutte',
        'source.client': 'Desktop · Web',
        'source.cli': 'CLI · Bots',
        'source.subagent': 'Subagent',
        'source.aria': 'Origine della sessione',
        'group.model': 'Per modello',
        'group.provider': 'Per provider',
        'group.both': 'Entrambi (commutabile nei grafici)',
        'group.aria': 'Raggruppamento',
        'action.refresh': 'Aggiorna',
        'config.title': 'Intervallo di tempo delle finestre configurate del pannello',
        'config.hint': '0 disattiva una finestra; con entrambe disattive viene mostrato solo il valore complessivo. Le finestre si arrotondano all\'ora locale e si applicano appena salvate; non seguono il filtro origine in cima al pannello.',
        'config.hours': 'Ore indietro (0-23)',
        'config.days': 'Giorni indietro (0-30)',
        'config.palette': 'Palette',
        'config.palette.primer': 'Primer (predefinito di GitHub)',
        'config.palette.cvd': 'Adatto ai daltonici (Okabe–Ito)',
        'config.palette.muted': 'Desaturato',
        'config.save': 'Salva',
        'config.saving': 'Salvataggio…',
        'config.current': 'Corrente: {text}',
        'config.readonly': 'Questo profile non espone un editor di configurazione; modifica invece il suo cordis.patch.yml.',
        'window.hours': 'Ultime {hours} ore',
        'window.days': 'Ultimi {days} giorni',
        'window.all': 'Tutto il periodo',
        'sidebar.title': 'Utilizzo token',
        'sidebar.open': 'Apri il pannello dell\'utilizzo token',
        'sidebar.rail': 'Utilizzo token · {value}',
        'sidebar.error': 'Lettura non riuscita - apri per i dettagli',
        'sidebar.errorShort': 'Lettura non riuscita',
        'detail.inputOutput': 'Input {input} · Output {output}',
        'detail.cacheHit': 'Cache hit {rate}',
        'state.loading': 'Lettura dei log locali delle sessioni…',
        'state.empty': 'Nessun utilizzo registrato per questo filtro.',
        'state.waiting': 'In attesa del servizio di utilizzo dell\'Host… (se persiste, controlla la console con Ctrl+Shift+I)',
        'state.error': 'Lettura non riuscita: {message}',
        'state.configError': 'Impossibile leggere la configurazione',
        'state.badResponse': 'Il servizio di utilizzo ha restituito una risposta non riconosciuta',
        'card.tokens': 'Tokens',
        'card.tokens.sub': 'Input senza cache {uncached} · Lettura cache {cached} · Output {output}',
        'card.turns': 'Turni completati',
        'card.requests': 'Richieste',
        'card.requests.sub': 'Chiamate al modello fatturabili',
        'card.activeDays': 'Giorni attivi',
        'card.hitRate': 'Percentuale media di cache hit',
        'card.hitRate.sub': 'Cache hit / (hit + miss)',
        'card.topProvider': 'Provider principale',
        'card.topModel': 'Modello principale',
        'card.share': '{percent} del totale',
        'section.windows': 'Finestre configurate',
        'section.windows.hint': 'Finestre di retrospettiva fisse; ignorano il filtro origine sopra. Modificale in Plugin → Utilizzo token.',
        'section.heat': 'Mappa di calore dell\'attività',
        'section.heat.hint': 'Segue il filtro origine; il calendario mostra sempre lo storico completo',
        'section.trend': 'Andamento giornaliero dei token',
        'section.breakdown': 'Scomposizione dell\'utilizzo',
        'heat.metric.aria': 'Metrica della mappa di calore',
        'heat.metric.tokens': 'Tokens',
        'heat.metric.turns': 'Turni',
        'heat.scope.weeks': 'Ultime {weeks} settimane',
        'heat.scope.filter': 'Filtro corrente',
        'heat.unit.tokens': 'tokens',
        'heat.unit.turns': 'turni',
        'heat.less': 'Meno',
        'heat.more': 'Più',
        'trend.hint': 'Le barre impilano i token; la curva della percentuale di cache hit è sovrapposta allo stesso grafico (percentuali reali a destra)',
        'trend.other': 'Altro',
        'trend.hitRate': 'Percentuale di cache hit',
        'trend.breakdownAria': 'Scomposizione per',
        'tip.tokens': 'Tokens',
        'tip.turns': 'Turni',
        'tip.requests': 'Richieste',
        'dash.title': 'Utilizzo token',
        'filter.start': 'Data di inizio',
        'filter.end': 'Data di fine',
        'foot.updated': 'Aggiornato {time}',
        'foot.source': 'Origine: log locali delle sessioni ({files}, offline)',
        'foot.inference1': 'Le origini si deducono da segnali locali: desktop e web non si distinguono offline e vengono entrambi riportati come ',
        'foot.inference2': '; ',
        'foot.inference3': ' copre le sessioni senza client.',
        'error.render': '{package} non è riuscito a eseguire il rendering ({label}): {message}',
        'a11y.dashboard': 'Pannello centrale',
        'a11y.sidebar': 'Scheda della barra laterale',
        'list.separator': ', ',
        'lang.zh-TW': '繁體中文（臺灣）',
        'lang.zh-HK': '繁體中文（香港）',
        'lang.de': 'Deutsch',
        'lang.fr': 'Français',
        'lang.es': 'Español',
        'lang.it': 'Italiano',
        'lang.ja': '日本語',
        'lang.ko': '한국어',
        'heat.legend.one': '{scope} · {days} giorno con attività · {total} {unit} in totale',
        'heat.legend.many': '{scope} · {days} giorni con attività · {total} {unit} in totale',
        'heat.legend.other': '{scope} · {days} giorni con attività · {total} {unit} in totale',
        'unit.turns.one': '{n} turno',
        'unit.turns.many': '{n} turni',
        'unit.turns.other': '{n} turni',
        'unit.sessions.one': '{n} sessione',
        'unit.sessions.many': '{n} sessioni',
        'unit.sessions.other': '{n} sessioni',
        'unit.files.one': '{n} file',
        'unit.files.many': '{n} file',
        'unit.files.other': '{n} file',
      },
      'ja': {
        'range.7d': '直近7日間',
        'range.14d': '直近14日間',
        'range.30d': '直近30日間',
        'range.90d': '直近90日間',
        'range.all': '全期間',
        'range.custom': 'カスタム',
        'range.aria': '時間範囲',
        'source.all': 'すべて',
        'source.client': 'デスクトップ · Web',
        'source.cli': 'CLI · ボット',
        'source.subagent': 'サブエージェント',
        'source.aria': 'セッションのソース',
        'group.model': 'モデル別',
        'group.provider': 'プロバイダー別',
        'group.both': '両方（チャートで切替可能）',
        'group.aria': '集計単位',
        'action.refresh': '更新',
        'config.title': 'ダッシュボードの設定ウィンドウの時間範囲',
        'config.hint': '0でウィンドウをオフにします。両方オフのときは全期間の値のみが表示されます。ウィンドウはローカル時計に基づき時間単位に丸められ、保存するとすぐに適用されます。ダッシュボード上部のソースフィルターには追従しません。',
        'config.hours': '遡る時間数（0-23）',
        'config.days': '遡る日数（0-30）',
        'config.palette': 'パレット',
        'config.palette.primer': 'Primer（GitHubデフォルト）',
        'config.palette.cvd': '色覚多様性に配慮（Okabe–Ito）',
        'config.palette.muted': 'ミュート',
        'config.save': '保存',
        'config.saving': '保存中…',
        'config.current': '現在：{text}',
        'config.readonly': 'このprofileには設定エディターがありません。代わりにそのcordis.patch.ymlを編集してください。',
        'window.hours': '直近{hours}時間',
        'window.days': '直近{days}日',
        'window.all': '全期間',
        'sidebar.title': 'Token使用量',
        'sidebar.open': 'Token使用量ダッシュボードを開く',
        'sidebar.rail': 'Token使用量 · {value}',
        'sidebar.error': '読み取れませんでした — 開いて詳細を確認',
        'sidebar.errorShort': '読み取り失敗',
        'detail.inputOutput': '入力 {input} · 出力 {output}',
        'detail.cacheHit': 'キャッシュヒット {rate}',
        'state.loading': 'ローカルのセッションログを読み取り中…',
        'state.empty': 'このフィルターに一致する使用量の記録はありません。',
        'state.waiting': 'Hostの使用量サービスを待機中…（続く場合は Ctrl+Shift+I でコンソールを確認）',
        'state.error': '読み取れませんでした：{message}',
        'state.configError': '設定を読み取れませんでした',
        'state.badResponse': '使用量サービスから認識できない応答が返されました',
        'card.tokens': 'Tokens',
        'card.tokens.sub': '未キャッシュ入力 {uncached} · キャッシュ読み取り {cached} · 出力 {output}',
        'card.turns': '完了ターン',
        'card.requests': 'リクエスト',
        'card.requests.sub': '課金対象のモデル呼び出し',
        'card.activeDays': 'アクティブな日数',
        'card.hitRate': '平均キャッシュヒット率',
        'card.hitRate.sub': 'キャッシュヒット / (ヒット + ミス)',
        'card.topProvider': 'トッププロバイダー',
        'card.topModel': 'トップモデル',
        'card.share': '全体の{percent}',
        'section.windows': '設定ウィンドウ',
        'section.windows.hint': '固定の遡及ウィンドウで、上のソースフィルターには影響されません。プラグイン → Token使用量 で調整できます。',
        'section.heat': 'アクティビティヒートマップ',
        'section.heat.hint': 'ソースフィルターに追従します。カレンダーは常に全履歴を表示します',
        'section.trend': '日次のTokenトレンド',
        'section.breakdown': '使用量の内訳',
        'heat.metric.aria': 'ヒートマップの指標',
        'heat.metric.tokens': 'Tokens',
        'heat.metric.turns': 'ターン',
        'heat.scope.weeks': '直近{weeks}週間',
        'heat.scope.filter': '現在のフィルター',
        'heat.unit.tokens': 'tokens',
        'heat.unit.turns': 'ターン',
        'heat.less': '少ない',
        'heat.more': '多い',
        'trend.hint': '棒はTokenを積み上げ、キャッシュヒット率の曲線を同じチャートに重ねています（右側が実際のパーセンテージ）',
        'trend.other': 'その他',
        'trend.hitRate': 'キャッシュヒット率',
        'trend.breakdownAria': '内訳の単位',
        'tip.tokens': 'Tokens',
        'tip.turns': 'ターン',
        'tip.requests': 'リクエスト',
        'dash.title': 'Token使用量',
        'filter.start': '開始日',
        'filter.end': '終了日',
        'foot.updated': '最終更新 {time}',
        'foot.source': 'ソース：ローカルのセッションログ（{files}、オフライン）',
        'foot.inference1': 'ソースはローカルのシグナルから推定されます。デスクトップとWebはオフラインでは区別できず、どちらも「',
        'foot.inference2': '」として扱われ、「',
        'foot.inference3': '」はクライアントを持たないセッションです。',
        'error.render': '{package} のレンダリングに失敗しました（{label}）：{message}',
        'a11y.dashboard': '中央ダッシュボード',
        'a11y.sidebar': 'サイドバーカード',
        'list.separator': '、',
        'lang.zh-TW': '繁體中文（臺灣）',
        'lang.zh-HK': '繁體中文（香港）',
        'lang.de': 'Deutsch',
        'lang.fr': 'Français',
        'lang.es': 'Español',
        'lang.it': 'Italiano',
        'lang.ja': '日本語',
        'lang.ko': '한국어',
        'heat.legend.other': '{scope} · 活動があった日数 {days} 日 · 合計 {total} {unit}',
        'unit.turns.other': '{n}ターン',
        'unit.sessions.other': '{n}セッション',
        'unit.files.other': '{n}ファイル',
      },
      'ko': {
        'range.7d': '최근 7일',
        'range.14d': '최근 14일',
        'range.30d': '최근 30일',
        'range.90d': '최근 90일',
        'range.all': '전체',
        'range.custom': '사용자 지정',
        'range.aria': '시간 범위',
        'source.all': '전체',
        'source.client': '데스크톱 · 웹',
        'source.cli': 'CLI · 봇',
        'source.subagent': '서브에이전트',
        'source.aria': '세션 소스',
        'group.model': '모델별',
        'group.provider': '공급자별',
        'group.both': '둘 다 (차트에서 전환 가능)',
        'group.aria': '분류',
        'action.refresh': '새로고침',
        'config.title': '대시보드의 설정된 윈도우 시간 범위',
        'config.hint': '0이면 해당 윈도우를 끕니다. 둘 다 끄면 전체 기간 수치만 표시됩니다. 윈도우는 로컬 시간의 정각에 맞추고 저장 즉시 적용됩니다. 대시보드 상단의 소스 필터를 따르지 않습니다.',
        'config.hours': '최근 몇 시간(0-23)',
        'config.days': '최근 며칠(0-30)',
        'config.palette': '팔레트',
        'config.palette.primer': 'Primer(GitHub 기본값)',
        'config.palette.cvd': '색각 장애 친화적(Okabe–Ito)',
        'config.palette.muted': '저채도',
        'config.save': '저장',
        'config.saving': '저장 중…',
        'config.current': '현재: {text}',
        'config.readonly': '이 profile에는 설정 편집기가 없습니다. 대신 profile의 cordis.patch.yml을 편집하세요.',
        'window.hours': '최근 {hours}시간',
        'window.days': '최근 {days}일',
        'window.all': '전체 기간',
        'sidebar.title': 'Token 사용량',
        'sidebar.open': 'Token 사용량 대시보드 열기',
        'sidebar.rail': 'Token 사용량 · {value}',
        'sidebar.error': '읽기 실패 - 자세한 내용은 열어서 확인하세요',
        'sidebar.errorShort': '읽기 실패',
        'detail.inputOutput': '입력 {input} · 출력 {output}',
        'detail.cacheHit': '캐시 적중 {rate}',
        'state.loading': '로컬 세션 로그를 읽는 중…',
        'state.empty': '이 필터에는 사용량 기록이 없습니다.',
        'state.waiting': 'Host 사용량 서비스를 기다리는 중…(계속되면 Ctrl+Shift+I로 콘솔을 확인하세요)',
        'state.error': '읽기 실패: {message}',
        'state.configError': '설정을 읽지 못했습니다',
        'state.badResponse': '사용량 서비스가 인식할 수 없는 응답을 반환했습니다',
        'card.tokens': 'Token 사용량',
        'card.tokens.sub': '미캐시 입력 {uncached} · 캐시 읽기 {cached} · 출력 {output}',
        'card.turns': '완료된 턴',
        'card.requests': '요청',
        'card.requests.sub': '과금 대상 모델 호출',
        'card.activeDays': '활동 일수',
        'card.hitRate': '평균 캐시 적중률',
        'card.hitRate.sub': '캐시 적중 / (적중 + 미적중)',
        'card.topProvider': '최다 공급자',
        'card.topModel': '최다 모델',
        'card.share': '전체의 {percent}',
        'section.windows': '설정된 윈도우',
        'section.windows.hint': '고정된 과거 기간 윈도우입니다. 위의 소스 필터는 무시합니다. 플러그인 → Token 사용량에서 조정하세요.',
        'section.heat': '활동 히트맵',
        'section.heat.hint': '소스 필터를 따릅니다. 캘린더는 항상 전체 이력을 표시합니다',
        'section.trend': '일별 Token 추세',
        'section.breakdown': '사용량 구성',
        'heat.metric.aria': '히트맵 지표',
        'heat.metric.tokens': 'Tokens',
        'heat.metric.turns': '턴',
        'heat.scope.weeks': '최근 {weeks}주',
        'heat.scope.filter': '현재 필터',
        'heat.unit.tokens': 'tokens',
        'heat.unit.turns': '턴',
        'heat.less': '적음',
        'heat.more': '많음',
        'trend.hint': '막대는 Token을 쌓고, 캐시 적중률 곡선을 같은 차트에 겹칩니다(오른쪽이 실제 백분율)',
        'trend.other': '기타',
        'trend.hitRate': '캐시 적중률',
        'trend.breakdownAria': '구성 기준',
        'tip.tokens': 'Tokens',
        'tip.turns': '턴',
        'tip.requests': '요청',
        'dash.title': 'Token 사용량',
        'filter.start': '시작 날짜',
        'filter.end': '종료 날짜',
        'foot.updated': '{time} 기준 갱신',
        'foot.source': '소스: 로컬 세션 로그({files}, 오프라인)',
        'foot.inference1': '소스는 로컬 신호로 추론합니다. 데스크톱과 웹은 오프라인에서 구분할 수 없어 둘 모두 다음으로 표시됩니다: ',
        'foot.inference2': '; ',
        'foot.inference3': '는 클라이언트가 없는 세션을 포함합니다.',
        'error.render': '{package} 렌더링 실패({label}): {message}',
        'a11y.dashboard': '중앙 대시보드',
        'a11y.sidebar': '사이드바 카드',
        'list.separator': ', ',
        'lang.zh-TW': '繁體中文（臺灣）',
        'lang.zh-HK': '繁體中文（香港）',
        'lang.de': 'Deutsch',
        'lang.fr': 'Français',
        'lang.es': 'Español',
        'lang.it': 'Italiano',
        'lang.ja': '日本語',
        'lang.ko': '한국어',
        'heat.legend.other': '{scope} · 활동한 날 {days}일 · 합계 {total} {unit}',
        'unit.turns.other': '{n} 턴',
        'unit.sessions.other': '{n}개 세션',
        'unit.files.other': '{n}개 파일',
      },
    }
/* @end generated */

    /**
     * Language packs this half adds to the DSH catalog. DSH ships `zh` and `en`
     * itself; every other entry here is ours, and `fallback` is the language both
     * DSH and this file fall back to for a key the pack does not carry.
     */
    const PACKS = [
      { id: 'zh-TW', fallback: 'zh' },
      { id: 'zh-HK', fallback: 'zh' },
      { id: 'de', fallback: 'en' },
      { id: 'fr', fallback: 'en' },
      { id: 'es', fallback: 'en' },
      { id: 'it', fallback: 'en' },
      { id: 'ja', fallback: 'en' },
      { id: 'ko', fallback: 'en' },
    ]

    /** Lookup chain per language: the pack, its parent language, then English. */
    const FALLBACKS = { en: null, zh: 'en' }
    for (const pack of PACKS) FALLBACKS[pack.id] = pack.fallback

    const CHAINS = new Map()
    function chainOf(locale) {
      const start = DICT[locale] ? locale : 'en'
      let chain = CHAINS.get(start)
      if (!chain) {
        chain = []
        let current = start
        while (current && !chain.includes(current)) {
          chain.push(current)
          current = FALLBACKS[current] ?? null
        }
        CHAINS.set(start, chain)
      }
      return chain
    }

    function interpolate(template, params) {
      return template.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match))
    }

    /** A key no language carries renders as itself, which is what a test can see. */
    function translate(locale, key, params) {
      for (const id of chainOf(locale)) {
        const value = DICT[id][key]
        if (value !== undefined) return params ? interpolate(value, params) : value
      }
      return key
    }

    /** The locale service, once it is mounted; absent on a Host that ships none. */
    let localeFace = null
    let activeLocale = 'en'
    let detachFace = null

    /**
     * Renders subscribe here rather than to the service directly. The two plugins
     * mount in whichever order the shell picks, so the service can arrive after
     * this half's first render — a subscription taken at mount time would have
     * captured `null` and never fired again.
     */
    const localeWatchers = new Set()
    function watchLocale(watcher) {
      localeWatchers.add(watcher)
      return () => localeWatchers.delete(watcher)
    }
    function notifyLocale() {
      for (const watcher of [...localeWatchers]) watcher()
    }

    /**
     * Add one language pack to DSH's catalog. A language DSH already ships cannot be
     * added again — the service refuses the duplicate — and a throw here would take
     * the whole dashboard down over a menu entry. Stand down instead: the service's
     * own definition is the better one, and the dictionary below still gets
     * registered, so the copy is ours either way.
     */
    function addPack(locale, pack) {
      try {
        return locale.addLanguage({ id: pack.id, label: translate('en', 'lang.' + pack.id), fallback: pack.fallback })
      } catch (error) {
        console.warn('[dsh-desktop-token-usage] the locale service already ships', pack.id, error)
        return () => {}
      }
    }

    /** Take (or drop) the locale service, then re-read the language through it. */
    function attachFace(face) {
      if (detachFace) {
        detachFace()
        detachFace = null
      }
      localeFace = face && typeof face.getLocale === 'function' ? face : null
      if (localeFace && typeof localeFace.subscribe === 'function') {
        detachFace = localeFace.subscribe(notifyLocale)
      }
      const before = activeLocale
      syncLocale()
      if (activeLocale !== before) notifyLocale()
    }

    const ID_BY_LOWER = Object.fromEntries(Object.keys(DICT).map((id) => [id.toLowerCase(), id]))
    /** Chinese script and region tags that name one of our two Traditional packs. */
    const ALIASES = {
      'zh-hans': 'zh', 'zh-cn': 'zh', 'zh-sg': 'zh', 'zh-my': 'zh',
      'zh-hant': 'zh-TW', 'zh-tw': 'zh-TW', 'zh-hk': 'zh-HK', 'zh-mo': 'zh-HK',
    }

    /** The dictionary id a tag names, or null when no dictionary here speaks it. */
    function supportedId(tag) {
      const text = String(tag ?? '').trim().toLowerCase()
      if (text === '') return null
      if (ID_BY_LOWER[text]) return ID_BY_LOWER[text]
      if (ALIASES[text]) return ALIASES[text]
      const parts = text.split('-')
      if (parts[0] === 'zh') {
        if (parts.some((part) => part === 'hant' || part === 'tw')) return 'zh-TW'
        if (parts.some((part) => part === 'hk' || part === 'mo')) return 'zh-HK'
        return 'zh'
      }
      return ID_BY_LOWER[parts[0]] ?? null
    }

    /** Browser languages, best match first — the rule DSH itself uses. */
    function browserLocale() {
      const list =
        typeof navigator === 'undefined'
          ? []
          : Array.isArray(navigator.languages)
            ? navigator.languages
            : [navigator.language]
      for (const tag of list) {
        const hit = supportedId(tag)
        if (hit) return hit
      }
      return 'en'
    }

    /**
     * Re-read the active language. With the locale service mounted we follow it
     * exactly (a tag we have no dictionary for becomes English, matching the
     * service's own fallback); without one, the browser decides.
     */
    function syncLocale() {
      if (localeFace && typeof localeFace.getLocale === 'function') {
        const snapshot = localeFace.getLocale()
        if (snapshot && typeof snapshot.active === 'string') {
          activeLocale = supportedId(snapshot.active) ?? 'en'
          return activeLocale
        }
      }
      activeLocale = browserLocale()
      return activeLocale
    }

    /**
     * Re-read the language on every render and re-render on a switch. Watching the
     * hub here rather than trusting the slot factory to re-run is what makes a
     * switch visible without a remount, and it costs nothing when no service is
     * mounted.
     */
    function useLocale() {
      const [, setRevision] = React.useState(0)
      React.useEffect(() => watchLocale(() => setRevision((revision) => revision + 1)), [])
      syncLocale()
    }

    const FORMATS = new Map()
    function formatOf(kind, locale) {
      const key = kind + '|' + locale
      let format = FORMATS.get(key)
      if (format === undefined) {
        format =
          kind === 'grouped'
            ? new Intl.NumberFormat(locale)
            : kind === 'compact'
              ? new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 2 })
              : kind === 'plain'
                ? new Intl.NumberFormat(locale, { useGrouping: false })
                : kind === 'percent'
                  ? new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 })
                : kind === 'date'
                  ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'medium' })
                  : kind === 'monthDay'
                    ? new Intl.DateTimeFormat(locale, { month: '2-digit', day: '2-digit' })
                    : null
        FORMATS.set(key, format)
      }
      return format
    }

    const grouped = (value) => formatOf('grouped', activeLocale).format(Math.round(value))
    /**
     * A compact figure, with one correction: a locale that has no unit for this
     * magnitude returns the plain digits and drops the separators the grouped form
     * keeps (zh renders 5,200 as "5200"), so that band is handed to `grouped`.
     */
    function compact(value) {
      if (!Number.isFinite(value) || value === 0) return '0'
      const short = formatOf('compact', activeLocale).format(value)
      return short === formatOf('plain', activeLocale).format(value) ? grouped(value) : short
    }
    const percent = (ratio) => formatOf('percent', activeLocale).format(ratio)
    const stamp = (ms) => formatOf('date', activeLocale).format(new Date(ms))

    /** A `YYYY-MM-DD` data key as a local month and day. */
    function dayLabel(key) {
      const [year, month, day] = key.split('-').map(Number)
      return formatOf('monthDay', activeLocale).format(new Date(year, month - 1, day))
    }

    /** Weekday initials and short month names, Monday first. */
    const CALENDARS = new Map()
    function calendar() {
      let value = CALENDARS.get(activeLocale)
      if (!value) {
        const weekday = new Intl.DateTimeFormat(activeLocale, { weekday: 'narrow' })
        const month = new Intl.DateTimeFormat(activeLocale, { month: 'short' })
        // 2024-01-01 was a Monday, and the calendar's columns start there too.
        value = {
          days: [0, 1, 2, 3, 4, 5, 6].map((index) => weekday.format(new Date(2024, 0, 1 + index))),
          months: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((index) => month.format(new Date(2024, index, 1))),
        }
        CALENDARS.set(activeLocale, value)
      }
      return value
    }

    const t = (key, params) => translate(activeLocale, key, params)

    const PLURALS = new Map()
    function pluralCategory(count) {
      let rules = PLURALS.get(activeLocale)
      if (!rules) {
        rules = new Intl.PluralRules(activeLocale)
        PLURALS.set(activeLocale, rules)
      }
      return rules.select(count)
    }

    /**
     * Pick the CLDR plural form of a countable key. `{n}` carries the grouped
     * figure, so a language places the number wherever its own sentence wants it.
     */
    const pluralKey = (key, count) => key + '.' + pluralCategory(count)
    const countOf = (key, count, params) => t(pluralKey(key, count), { n: grouped(count), ...params })

    // ── filter model ────────────────────────────────────────────────────────

    const RANGES = [
      { id: '7d', labelKey: 'range.7d', days: 7 },
      { id: '14d', labelKey: 'range.14d', days: 14 },
      { id: '30d', labelKey: 'range.30d', days: 30 },
      { id: '90d', labelKey: 'range.90d', days: 90 },
      { id: 'all', labelKey: 'range.all', days: null },
      { id: 'custom', labelKey: 'range.custom', days: null },
    ]
    // Only these are derivable offline; see docs/DESIGN.md.
    const SOURCES = [
      { id: 'all', labelKey: 'source.all', wire: null },
      { id: 'client', labelKey: 'source.client', wire: ['client'] },
      { id: 'cli', labelKey: 'source.cli', wire: ['cli'] },
      { id: 'subagent', labelKey: 'source.subagent', wire: ['subagent'] },
    ]

    function dayKeyOf(date) {
      const month = `${date.getMonth() + 1}`.padStart(2, '0')
      const day = `${date.getDate()}`.padStart(2, '0')
      return `${date.getFullYear()}-${month}-${day}`
    }

    /** Local midnight of the day an instant falls in. */
    function dayStartMs(ms) {
      const date = new Date(ms)
      return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
    }

    /** Local midnight of a `YYYY-MM-DD` key. */
    function dayKeyStartMs(key) {
      const [year, month, day] = key.split('-').map(Number)
      return new Date(year, month - 1, day).getTime()
    }

    const DAY_MS = 86_400_000

    /**
     * Translate the panel's range chips into the wire's absolute milliseconds.
     * Picking a human range is the view's job; the rollup itself is the Host's.
     */
    function wireFilterOf(filter) {
      const preset = RANGES.find((range) => range.id === filter.range)
      let sinceMs = null
      let untilMs = null
      if (preset && preset.days) {
        sinceMs = dayStartMs(Date.now() - (preset.days - 1) * DAY_MS)
      } else if (filter.range === 'custom') {
        if (filter.since) sinceMs = dayKeyStartMs(filter.since)
        if (filter.until) untilMs = dayKeyStartMs(filter.until) + DAY_MS
      }
      const source = SOURCES.find((item) => item.id === filter.source)
      return { sinceMs, untilMs, sources: source ? source.wire : null }
    }

    // ── store ───────────────────────────────────────────────────────────────

    const listeners = new Set()
    let namespace
    let snapshot = {
      status: 'idle',
      error: null,
      // A failure this half names itself is stored as a key, not as a sentence:
      // the catalogue is what turns it into copy, at render time, in the
      // language the user is reading.
      errorKey: null,
      data: null,
      filter: { range: 'all', source: 'all', since: '', until: '' },
      config: null,
      configStatus: 'idle',
      configError: null,
      configErrorKey: null,
    }
    let ticket = 0

    const subscribe = (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    }
    const getSnapshot = () => snapshot
    function patch(next) {
      let changed = false
      for (const [key, value] of Object.entries(next)) {
        if (snapshot[key] !== value) {
          changed = true
          break
        }
      }
      if (!changed) return
      snapshot = { ...snapshot, ...next }
      for (const listener of [...listeners]) listener()
    }

    /** A failed Remote answers `{ ok: false, error }`; a throw carries `message`. */
    const failureOf = (response) => {
      const failure = response && response.error
      return failure ? failure.message ?? failure.code : undefined
    }
    const messageOf = (error) => (error && error.message ? error.message : String(error))
    /** A Host message is shown verbatim; a local one is a catalogue key. */
    const failureText = (message, key) => message ?? (key ? t(key) : '')

    async function load(filter = snapshot.filter, { silent = false } = {}) {
      const mine = ++ticket
      if (!namespace) {
        // The Remote namespace arrives with the mount; keep waiting rather than
        // showing an error the user cannot act on.
        patch({ status: snapshot.data ? 'ready' : 'waiting', filter })
        return
      }
      if (!silent) patch({ status: snapshot.data ? 'ready' : 'loading', filter, error: null, errorKey: null })
      else patch({ filter })
      try {
        const response = await namespace.summary(wireFilterOf(filter))
        if (mine !== ticket) return
        // A Remote returns its `{ ok, value }` envelope as-is: a failure is a
        // value, not a throw, so the branch must be read before trusting it.
        if (!response || response.ok !== true) {
          const failure = failureOf(response)
          patch({ status: 'error', error: failure ?? null, errorKey: failure ? null : 'state.badResponse' })
          return
        }
        patch({ status: 'ready', data: response.value, error: null })
      } catch (error) {
        if (mine !== ticket) return
        patch({ status: 'error', error: messageOf(error), errorKey: null })
      }
    }

    async function loadConfig() {
      if (!namespace) {
        patch({ configStatus: 'waiting' })
        return
      }
      patch({ configStatus: snapshot.config ? 'ready' : 'loading', configError: null, configErrorKey: null })
      try {
        const response = await namespace.config()
        if (!response || response.ok !== true) {
          const failure = failureOf(response)
          patch({
            configStatus: 'error',
            configError: failure ?? null,
            configErrorKey: failure ? null : 'state.configError',
          })
          return
        }
        patch({ configStatus: 'ready', config: response.value, configError: null, configErrorKey: null })
      } catch (error) {
        patch({ configStatus: 'error', configError: messageOf(error), configErrorKey: null })
      }
    }

    /**
     * Persisting a window change restarts this plugin's fiber, so the call itself
     * can be cut short even though the write landed. The read afterwards is the
     * authority on what actually took effect.
     */
    async function saveConfig(next) {
      if (!namespace) return
      patch({ configStatus: 'saving', configError: null })
      try {
        await namespace.setConfig({ hours: next.hours, days: next.days, groupBy: next.groupBy, palette: next.palette })
      } catch (error) {
        patch({ configError: messageOf(error) })
      }
      await loadConfig()
      await load(snapshot.filter, { silent: true })
    }

    const setFilter = (changes) => {
      patch({ filter: { ...snapshot.filter, ...changes } })
      void load(snapshot.filter)
    }
    const reload = () => {
      void load(snapshot.filter, { silent: true })
      void loadConfig()
    }

    /**
     * Subscribe through the two hooks every React since 16.8 exports. The shell's
     * frozen module table decides what `react` re-exports, and a curated subset
     * can omit the late additions — a missing export here would throw during
     * render and blank both seats.
     */
    function useStore() {
      const [value, setValue] = React.useState(getSnapshot)
      React.useEffect(() => subscribe(() => setValue(getSnapshot())), [])
      return value
    }

    // ── bucket totals ───────────────────────────────────────────────────────

    const totalOf = (buckets) => buckets[0] + buckets[1] + buckets[2] + buckets[3]

    // ── styles ──────────────────────────────────────────────────────────────

    const CSS = `
/* The shell owns the theme switch: DSH marks dark with body[data-ds-dark-theme]
   and leaves <body> bare in light mode, so that marker — not the OS preference —
   decides which half of every light-dark() pair is used. Following
   prefers-color-scheme alone would leave the charts light whenever DSH is dark
   on a light desktop (and vice versa). */
.dtu-root{
  color-scheme:light dark;
  --dtu-s1:#4c8dff; --dtu-s2:#3fb950; --dtu-s3:#d29922; --dtu-s4:#a371f7; --dtu-s5:#ec6a5e;
  --dtu-other:light-dark(#6e7681,#8b949e); --dtu-hit:light-dark(#57606a,#8b949e);
  --dtu-heat-0:light-dark(#ebedf0,#161b22); --dtu-heat-1:light-dark(#9be9a8,#0e4429);
  --dtu-heat-2:light-dark(#40c463,#006d32); --dtu-heat-3:light-dark(#30a14e,#26a641);
  --dtu-heat-4:light-dark(#216e39,#39d353);
  display:block;height:100%;overflow:auto;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-size:13px}
body[data-ds-dark-theme] .dtu-root{color-scheme:dark}
body:not([data-ds-dark-theme]) .dtu-root{color-scheme:light}
.dtu-root[data-dtu-palette="cvd"]{
  --dtu-s1:light-dark(#0072b2,#58a6ff); --dtu-s2:light-dark(#e69f00,#ffc857);
  --dtu-s3:light-dark(#009e73,#4dd4ac); --dtu-s4:light-dark(#cc79a7,#f0a6c8);
  --dtu-s5:light-dark(#56b4e9,#83c9f4);
  --dtu-other:light-dark(#7b8794,#9aa5b1); --dtu-hit:light-dark(#0072b2,#58a6ff);
  --dtu-heat-0:light-dark(#eef4fa,#111823); --dtu-heat-1:light-dark(#c6dbef,#12395c);
  --dtu-heat-2:light-dark(#7fb3d9,#1b5a8a); --dtu-heat-3:light-dark(#3d85c6,#2f7fbd);
  --dtu-heat-4:light-dark(#084594,#5fb0e8)}
.dtu-root[data-dtu-palette="muted"]{
  --dtu-s1:light-dark(#4c6a92,#8fa8c8); --dtu-s2:light-dark(#6e9c7a,#9dc0a6);
  --dtu-s3:light-dark(#c9a227,#e0c46a); --dtu-s4:light-dark(#9a6b8f,#c49ab8);
  --dtu-s5:light-dark(#7a8ca3,#a8b6c6);
  --dtu-other:light-dark(#8a857c,#a8a196); --dtu-hit:light-dark(#4c6a92,#8fa8c8);
  --dtu-heat-0:light-dark(#f0efe9,#1a1a17); --dtu-heat-1:light-dark(#cfd8c4,#2c3a28);
  --dtu-heat-2:light-dark(#a8bb98,#47603e); --dtu-heat-3:light-dark(#7d9a6d,#688a56);
  --dtu-heat-4:light-dark(#547049,#8fb273)}
.dtu-head{position:sticky;top:0;z-index:2;display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between;padding:14px 18px;background:var(--dsw-alias-bg-base);border-bottom:1px solid var(--dsw-alias-border-l1)}
.dtu-title{font-size:15px;font-weight:600}
.dtu-controls{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.dtu-group{display:flex;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;overflow:hidden}
.dtu-chip{appearance:none;border:0;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;padding:5px 10px;cursor:pointer;white-space:nowrap}
.dtu-chip+.dtu-chip{border-left:1px solid var(--dsw-alias-border-l1)}
.dtu-chip:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.dtu-chip[aria-pressed="true"]{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font-weight:600}
.dtu-refresh{appearance:none;border:1px solid var(--dsw-alias-border-l1);background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;padding:5px 12px;border-radius:8px;cursor:pointer}
.dtu-refresh:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.dtu-date{background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-primary);border-radius:6px;padding:4px 6px;font:inherit}
.dtu-body{display:flex;flex-direction:column;gap:16px;padding:16px 18px 28px}
.dtu-note{padding:10px 12px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary)}
.dtu-note[data-tone="error"]{border-color:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-state-error-primary)}
.dtu-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px}
.dtu-card{border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-1);padding:12px 14px;display:flex;flex-direction:column;gap:6px;min-width:0}
.dtu-cardLabel{color:var(--dsw-alias-label-secondary);font-size:12px;display:flex;align-items:center;gap:6px}
.dtu-cardValue{font-size:20px;font-weight:600;letter-spacing:.2px;word-break:break-word}
.dtu-cardSub{color:var(--dsw-alias-label-secondary);font-size:11.5px;line-height:1.5}
.dtu-section{border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-1);padding:14px 16px}
.dtu-sectionHead{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px}
.dtu-sectionTitle{font-weight:600}
.dtu-legend{display:flex;flex-wrap:wrap;gap:12px;color:var(--dsw-alias-label-secondary);font-size:11.5px;align-items:center}
.dtu-dot{width:8px;height:8px;border-radius:2px;display:inline-block;margin-right:5px;vertical-align:middle}
.dtu-heatHead{display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between;margin-bottom:10px}
.dtu-heatControls{display:flex;flex-wrap:wrap;gap:12px;align-items:center}
/* 53 fixed weeks sharing whatever the card gives them, inset 15px either side so
   the calendar sits centred instead of butting against the card edges. Nothing
   scrolls and nothing is clipped: 53 columns on a flexible basis always fit, and
   the hover tooltip is free to hang past the calendar without raising a scrollbar
   (it was the *tooltip* — wider than the 160px min-width, thanks to a long token
   count — that poked out of a scrolling box and dragged in the bottom bar). */
.dtu-heatInner{margin-inline:15px}
.dtu-heatMonths{display:flex;gap:3px;height:15px;margin-bottom:4px;color:var(--dsw-alias-label-secondary);font-size:10.5px}
.dtu-monthSpace{width:22px;flex:none}
.dtu-monthCell{flex:1 1 0;min-width:0;white-space:nowrap;overflow:visible}
.dtu-heatRows{display:flex;gap:3px;position:relative}
.dtu-weekdays{display:flex;flex-direction:column;gap:3px;width:22px;flex:none;color:var(--dsw-alias-label-secondary);font-size:10px;line-height:11px}
.dtu-weekdays span{flex:1 1 0;min-height:11px;display:flex;align-items:center}
.dtu-heat{display:flex;gap:3px;flex:1 1 0;min-width:0}
.dtu-week{display:flex;flex-direction:column;gap:3px;flex:1 1 0;min-width:0}
.dtu-cell{width:11px;height:11px;border-radius:24%;background:var(--dsw-alias-bg-layer-2);position:relative;flex:none}
/* Calendar days share this box with the legend swatches, but not their size. */
.dtu-heat .dtu-cell{width:100%;height:auto;aspect-ratio:1}
/* The radius is a share of the box, so a stretched cell keeps the roundness of
   an 11px one; the fill inherits it instead of carrying a second number. */
.dtu-cellFill{position:absolute;inset:0;border-radius:inherit;display:block;transition:background-color .18s ease,filter .12s ease}
/* A day brightens under the cursor: brightness moves nothing, so the grid cannot
   reflow — and the same declaration softens a palette or metric switch too. */
.dtu-heat .dtu-cell:hover .dtu-cellFill{filter:brightness(1.16)}
/* A day with no activity is a hairline rather than a solid block: the calendar
   now spans the card, and a wall of solid greys would read as data instead of as
   emptiness. The step-0 colour is reused as the line, so it is not dead paint. */
.dtu-heat .dtu-cell[data-level="0"]{background:transparent;box-shadow:inset 0 0 0 1px var(--dtu-heat-0)}
/* Today wears a two-tone ring: the panel-coloured line separates it from the
   cell's own colour, the inner line from its neighbours. One line alone vanishes
   on either the palest or the darkest step. */
.dtu-heat .dtu-cell[data-today="true"] .dtu-cellFill{box-shadow:inset 0 0 0 1px var(--dsw-alias-bg-layer-1),inset 0 0 0 2px var(--dsw-alias-label-primary)}
@media (prefers-reduced-motion: reduce){.dtu-cellFill{transition:none}}
.dtu-heatScale{display:flex;align-items:center;gap:4px;color:var(--dsw-alias-label-secondary);font-size:11.5px}
.dtu-trend{position:relative;--dtu-plot-l:52px;--dtu-plot-r:44px}
.dtu-plot{position:relative;padding-bottom:20px}
.dtu-trendHead{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:6px}
.dtu-chartBars{position:relative;height:190px;margin-top:4px}
/* The rate labels own the right gutter — the plot's right inset — and carry the
   real percentages of the band the curve is drawn against. */
.dtu-axisHit{position:absolute;right:0;top:0;bottom:0;width:var(--dtu-plot-r);color:var(--dsw-alias-label-secondary);font-size:11px;text-align:left}
.dtu-axisHit span{position:absolute;left:4px;transform:translateY(-50%);white-space:nowrap}
/* The curve and the dots overlay the bars and share the bars' plot insets (52/44),
   so one percentage scale positions them alongside the hover line. */
.dtu-hitPlot{position:absolute;left:var(--dtu-plot-l);right:var(--dtu-plot-r);top:0;bottom:0;pointer-events:none}
.dtu-hitPlot svg{position:absolute;left:0;right:0;top:0;width:100%;height:100%}
.dtu-plotLine{position:absolute;left:var(--dtu-plot-l);right:var(--dtu-plot-r);top:0;bottom:20px;pointer-events:none}
.dtu-lineKey{display:inline-block;width:14px;height:2px;background:var(--dtu-hit);border-radius:2px;margin-right:5px;vertical-align:middle}
.dtu-hitDot{position:absolute;width:5px;height:5px;border-radius:50%;background:var(--dtu-hit);transform:translate(-50%,-50%);pointer-events:auto}
.dtu-hitDotEmpty{background:transparent}
.dtu-cursor{position:absolute;left:0;top:0;bottom:0;width:1px;background:var(--dsw-alias-border-l1)}
.dtu-tip{position:absolute;top:6px;left:0;width:max-content;max-width:calc(100% - 16px);min-width:160px;padding:8px 10px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-1);box-shadow:0 6px 18px rgba(0,0,0,.18);font-size:12px;pointer-events:none;z-index:3}
/* The heatmap tooltip leans away from the edge it is near instead of centring on
   the column. Half the column span is what one anchor can cover, and the caliper
   below is what makes that exact: left-anchored at the half-way column it ends at
   25px + span, right-anchored it starts at 25px — inside the calendar either way,
   whatever the box's width turns out to be. */
.dtu-tipHeat{top:22px;max-width:calc(50% - 25px)}
.dtu-tipTitle{font-weight:600;margin-bottom:4px}
.dtu-tipRow{display:flex;align-items:center;gap:6px}
/* A long model name is ellipsised, never wrapped: label and figure stay on one line. */
.dtu-tipKey{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dtu-tipRow b{margin-left:auto;font-weight:600}
.dtu-bars{position:absolute;left:var(--dtu-plot-l);right:var(--dtu-plot-r);top:0;bottom:0;display:flex;align-items:flex-end;gap:2px}
.dtu-col{flex:1 1 0;min-width:3px;display:flex;flex-direction:column;justify-content:flex-end;height:100%;position:relative}
.dtu-col:hover{outline:1px solid var(--dsw-alias-border-l2);outline-offset:1px;border-radius:2px}
.dtu-seg{width:100%}
.dtu-axisX{position:absolute;left:var(--dtu-plot-l);right:var(--dtu-plot-r);bottom:2px;height:14px;color:var(--dsw-alias-label-secondary);font-size:11px}
.dtu-axisX span{position:absolute;transform:translateX(-50%);white-space:nowrap}
.dtu-axisY{position:absolute;left:0;top:0;bottom:0;width:50px;color:var(--dsw-alias-label-secondary);font-size:11px}
.dtu-axisY span{position:absolute;right:4px;transform:translateY(-50%);white-space:nowrap}
.dtu-grid{position:absolute;left:var(--dtu-plot-l);right:var(--dtu-plot-r);top:0;bottom:0}
.dtu-gridline{position:absolute;left:0;right:0;border-top:1px solid var(--dsw-alias-border-l1);opacity:.6}
.dtu-models{display:grid;grid-template-columns:minmax(180px,240px) 1fr;gap:20px;align-items:start}
.dtu-donut{position:relative;width:100%;max-width:240px;aspect-ratio:1/1;margin:0 auto}
.dtu-donutCenter{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;pointer-events:none}
.dtu-donutTotal{font-size:22px;font-weight:600}
.dtu-donutLabel{font-size:11.5px;color:var(--dsw-alias-label-secondary)}
.dtu-rows{display:flex;flex-direction:column;gap:2px;min-width:0}
.dtu-row{display:grid;grid-template-columns:1fr auto auto;gap:12px;align-items:center;padding:7px 8px;border-radius:6px}
.dtu-row:hover{background:var(--dsw-alias-bg-layer-2)}
.dtu-rowName{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dtu-rowShare{color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}
.dtu-rowTotal{font-variant-numeric:tabular-nums;font-weight:600}
.dtu-empty{color:var(--dsw-alias-label-secondary);padding:8px 0}
/* One fact per line: three flex items of very different lengths read as a ragged
   paragraph when they wrap, and the long one broke mid-sentence inside a quote. */
.dtu-foot{color:var(--dsw-alias-label-secondary);font-size:11.5px;display:flex;flex-direction:column;gap:3px;line-height:1.6}
.dtu-footEntry{min-width:0}
.dtu-nb{white-space:nowrap}
.dtu-footTop{display:flex;align-items:center;gap:8px;color:var(--dsw-alias-label-secondary);font-size:11.5px}
.dtu-footValue{font-size:16px;font-weight:600;color:var(--dsw-alias-label-primary)}
.dtu-footRow{display:flex;justify-content:space-between;gap:10px;color:var(--dsw-alias-label-secondary);font-size:11.5px}
.dtu-window{display:flex;flex-direction:column;gap:1px;padding:4px 0 5px;border-top:1px solid var(--dsw-alias-border-l1)}
.dtu-window:first-of-type{border-top:0;padding-top:2px}
.dtu-windowLabel{color:var(--dsw-alias-label-secondary);font-size:11.5px;font-weight:600}
.dtu-windowValue{color:var(--dsw-alias-label-primary);font-size:12.5px;font-variant-numeric:tabular-nums}
.dtu-windowMeta{color:var(--dsw-alias-label-secondary);font-size:11px;font-variant-numeric:tabular-nums}
.dtu-form{display:flex;flex-direction:column;gap:10px;padding:12px 14px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-1);max-width:560px}
.dtu-formTitle{font-weight:600}
.dtu-hint{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.6}
.dtu-field{display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:13px}
.dtu-input{width:96px;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-primary);border-radius:6px;padding:4px 8px;font:inherit;text-align:right}
.dtu-input:disabled{opacity:.55}
/* Sized to its own options rather than a fixed 190px: a select clips its closed
   label, and German and French name the grouping in 38-41 characters, which the
   fixed width cut in half ("Beides (in den Diagramme"). Flex still shrinks it
   when the row is narrow. */
.dtu-select{width:auto;min-width:190px;max-width:100%;text-align:left}
.dtu-formActions{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.dtu-save{appearance:none;border:1px solid var(--dsw-alias-brand-primary);background:var(--dsw-alias-brand-primary);color:var(--dsw-alias-bg-base);font:inherit;font-weight:600;padding:5px 16px;border-radius:8px;cursor:pointer}
.dtu-save:disabled{opacity:.5;cursor:default}
.dtu-formStatus{color:var(--dsw-alias-label-secondary);font-size:12px}
.dtu-formStatus[data-tone="error"]{color:var(--dsw-alias-state-error-primary)}
/* The seat lays every occupant on one horizontal line, yet every plugin in it
   declares width:100% — so they can never share it and each one ends up squeezed
   against its neighbours. Making the seat a column is what gives every occupant
   the full-width row it was written for.
   Direction, not wrapping: flex-wrap on a column seat wraps into extra COLUMNS,
   which puts the card beside its neighbour and overflows the sidebar (measured
   live on 0.2.0-rc.2).
   Two selectors, both narrowed to the seat so no ancestor is ever touched
   (forcing a direction on the shell's own row containers would stack the sidebar
   above the main panel): the shell wraps each slot in a display:contents element,
   so the card is not a direct child of the seat today and the direct-child form
   only covers a shell that stops inserting that wrapper. Neither depends on
   DSH's hashed class name. */
[class*="_footerActions"]:has(.dtu-footCard),
:has(> .dtu-footCard){flex-direction:column}
.dtu-footCard{appearance:none;text-align:left;font:inherit;cursor:pointer;flex:1 1 100%;display:flex;flex-direction:column;gap:4px;padding:8px 10px;border-radius:8px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);color:inherit}
.dtu-footCard:hover{background:var(--dsw-alias-bg-layer-2)}
.dtu-rail{appearance:none;font:inherit;cursor:pointer;display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:18px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary)}
.dtu-rail:hover{background:var(--dsw-alias-bg-layer-2)}
.dtu-icon{width:16px;height:16px;flex:none}
`

    // ── small pieces ────────────────────────────────────────────────────────

    function Icon({ size = 16 }) {
      return h(
        'svg',
        {
          className: 'dtu-icon',
          viewBox: '0 0 24 24',
          width: size,
          height: size,
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.8,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
        },
        h('path', { d: 'M4 20V10' }),
        h('path', { d: 'M10 20V4' }),
        h('path', { d: 'M16 20v-7' }),
        h('path', { d: 'M22 20H2' }),
      )
    }

    function ChipGroup({ items, value, onSelect, label }) {
      return h(
        'div',
        { className: 'dtu-group', role: 'group', 'aria-label': label },
        items.map((item) =>
          h(
            'button',
            {
              key: item.id,
              type: 'button',
              className: 'dtu-chip',
              'aria-pressed': value === item.id,
              onClick: () => onSelect(item.id),
            },
            t(item.labelKey),
          ),
        ),
      )
    }

    function Card({ label, value, sub, title }) {
      return h(
        'div',
        { className: 'dtu-card', title },
        h('div', { className: 'dtu-cardLabel' }, label),
        h('div', { className: 'dtu-cardValue' }, value),
        sub ? h('div', { className: 'dtu-cardSub' }, sub) : null,
      )
    }

    function Section({ title, extra, children }) {
      return h(
        'section',
        { className: 'dtu-section' },
        h('div', { className: 'dtu-sectionHead' }, h('div', { className: 'dtu-sectionTitle' }, title), extra ?? null),
        children,
      )
    }

    /**
     * A crash inside a slot entry blanks the panel with no explanation, and the
     * page console is not always at hand. Catching it here turns any render
     * failure into visible text naming the component and the message.
     */
    class Boundary extends React.Component {
      constructor(props) {
        super(props)
        this.state = { error: null }
      }

      static getDerivedStateFromError(error) {
        return { error }
      }

      componentDidCatch(error, info) {
        console.error('[dsh-desktop-token-usage] render failed:', error, info)
      }

      render() {
        const error = this.state.error
        if (error) {
          const message = error && error.message ? error.message : String(error)
          return h(
            'div',
            { className: 'dtu-note', 'data-tone': 'error' },
            t('error.render', { package: REMOTE_PACKAGE, label: this.props.label, message }),
          )
        }
        return this.props.children
      }
    }

    // ── sidebar entry ───────────────────────────────────────────────────────

    /**
     * One card row: the configured window's own label, its input/output split
     * and its cache hit rate. Input counts everything the provider was sent —
     * the cache-missing part plus the cached reads — so the pair reads the way a
     * user thinks about a request.
     */
    /**
     * A configured window's own label. The Host still ships one, for a client
     * older than this file; the id plus the card's own figures are what a
     * localised label needs, and the shipped label stays the fallback.
     */
    function blockLabel(block, card) {
      if (block.id === 'hours' && card && card.hours > 0) return t('window.hours', { hours: card.hours })
      if (block.id === 'days' && card && card.days > 0) return t('window.days', { days: card.days })
      if (block.id === 'all') return t('window.all')
      return block.label
    }

    function CardWindow({ block, card }) {
      return h(
        'div',
        { className: 'dtu-window' },
        h('div', { className: 'dtu-windowLabel' }, blockLabel(block, card)),
        h(
          'div',
          { className: 'dtu-windowValue' },
          t('detail.inputOutput', { input: compact(block.inputTokens), output: compact(block.outputTokens) }),
        ),
        h(
          'div',
          { className: 'dtu-windowMeta' },
          t('detail.cacheHit', { rate: percent(block.cacheHitRate) }) + ' · ' + countOf('unit.turns', block.turns),
        ),
      )
    }

    /**
     * The all-time block, rebuilt from `totals` when the Host answered without a
     * `card`. A Client newer than its Host is a normal upgrade state, and the
     * card must still show figures rather than wait for a field that will only
     * appear after the Host module generation is reloaded.
     */
    function cumulativeBlock(totals) {
      if (!totals || !Array.isArray(totals.buckets)) return null
      const buckets = totals.buckets
      return {
        id: 'all',
        label: null,
        buckets,
        totalTokens: typeof totals.totalTokens === 'number' ? totals.totalTokens : totalOf(buckets),
        inputTokens: typeof totals.inputTokens === 'number' ? totals.inputTokens : buckets[0] + buckets[2],
        outputTokens: buckets[1],
        cacheHitRate: totals.cacheHitRate,
        turns: totals.turns,
        requests: totals.requests,
      }
    }

    /**
     * The usage card in the sidebar foot (`sidebar.footer.action`), and the icon
     * button the collapsed rail gets instead.
     *
     * That seat is a single horizontal row, and every plugin in it declares
     * `width: 100%`, so no two of them can share it — see the `:has()` rule in the
     * stylesheet, which makes the seat wrap so each occupant gets the full-width
     * row it was written for.
     */
    function SidebarEntry(props) {
      const state = useStore()
      useLocale()
      const card = state.data ? state.data.card : null
      const blocks = card ? card.blocks : []
      const all = card ? card.all : state.data ? cumulativeBlock(state.data.totals) : null
      const headline = blocks.length > 0 ? blocks[0].inputTokens + blocks[0].outputTokens : all ? all.totalTokens : 0
      if (props.wide === false) {
        const label = t('sidebar.rail', { value: compact(headline) })
        return h(
          'button',
          { type: 'button', className: 'dtu-rail', title: label, 'aria-label': label, onClick: props.open },
          h(Icon, { size: 16 }),
        )
      }
      let body
      if (state.status === 'error') {
        body = h('div', { className: 'dtu-windowMeta' }, t('sidebar.error'))
      } else if (!state.data) {
        body = h('div', { className: 'dtu-windowMeta' }, t('state.loading'))
      } else if (blocks.length > 0) {
        body = blocks.map((block) => h(CardWindow, { key: block.id, block, card }))
      } else if (!all) {
        body = h('div', { className: 'dtu-windowMeta' }, t('state.empty'))
      } else {
        body = [
          h('div', { key: 'total', className: 'dtu-footValue' }, compact(all.totalTokens)),
          h(
            'div',
            { key: 'split', className: 'dtu-footRow' },
            h('span', null, t('detail.inputOutput', { input: compact(all.inputTokens), output: compact(all.outputTokens) })),
          ),
          h(
            'div',
            { key: 'meta', className: 'dtu-footRow' },
            h('span', null, t('detail.cacheHit', { rate: percent(all.cacheHitRate) })),
            h('span', null, countOf('unit.turns', all.turns)),
          ),
        ]
      }
      return h(
        'button',
        { type: 'button', className: 'dtu-footCard', title: t('sidebar.open'), onClick: props.open },
        h(
          'div',
          { className: 'dtu-footTop' },
          h(Icon, { size: 14 }),
          h('span', null, t('sidebar.title')),
          h(
            'span',
            { style: { marginLeft: 'auto' } },
            state.status === 'error' ? t('sidebar.errorShort') : '',
          ),
        ),
        body,
      )
    }

    // ── configuration form ──────────────────────────────────────────────────

    /** Two windows, or the all-time label when both are off. */
    function describeWindows(config) {
      const parts = []
      if (config.hours > 0) parts.push(t('window.hours', { hours: config.hours }))
      if (config.days > 0) parts.push(t('window.days', { days: config.days }))
      return parts.length > 0 ? parts.join(' + ') : t('window.all')
    }

    /**
     * The plugin's own configuration card. DSH renders no editor from a Config
     * schema — a plugin that has configuration draws it itself into
     * `plugins.bundle.config`, keyed by its package name, and saves through the
     * Loader's config editor on the Host.
     */
    function ConfigForm() {
      const state = useStore()
      useLocale()
      const [draft, setDraft] = React.useState(null)
      const current = state.config ?? { hours: 0, days: 0, writable: false }
      const values = draft ?? {
        hours: current.hours,
        days: current.days,
        groupBy: current.groupBy ?? 'both',
        palette: current.palette ?? 'primer',
      }
      const busy = state.configStatus === 'saving'
      const locked = busy || current.writable === false
      const edit = (key, raw) => {
        const parsed = Number.parseInt(raw, 10)
        setDraft({ ...values, [key]: Number.isFinite(parsed) ? parsed : 0 })
      }
      return h(
        'div',
        { className: 'dtu-form' },
        h('div', { className: 'dtu-formTitle' }, t('config.title')),
        h(
          'div',
          { className: 'dtu-hint' },
          t('config.hint'),
        ),
        h(
          'label',
          { className: 'dtu-field' },
          h('span', null, t('config.hours')),
          h('input', {
            className: 'dtu-input',
            type: 'number',
            min: 0,
            max: 23,
            value: values.hours,
            disabled: locked,
            onChange: (event) => edit('hours', event.target.value),
          }),
        ),
        h(
          'label',
          { className: 'dtu-field' },
          h('span', null, t('config.days')),
          h('input', {
            className: 'dtu-input',
            type: 'number',
            min: 0,
            max: 30,
            value: values.days,
            disabled: locked,
            onChange: (event) => edit('days', event.target.value),
          }),
        ),
        h(
          'label',
          { className: 'dtu-field' },
          h('span', null, t('group.aria')),
          h(
            'select',
            {
              className: 'dtu-input dtu-select',
              value: values.groupBy,
              disabled: locked,
              onChange: (event) => setDraft({ ...values, groupBy: event.target.value }),
            },
            h('option', { value: 'both' }, t('group.both')),
            h('option', { value: 'model' }, t('group.model')),
            h('option', { value: 'provider' }, t('group.provider')),
          ),
        ),
        h(
          'label',
          { className: 'dtu-field' },
          h('span', null, t('config.palette')),
          h(
            'select',
            {
              className: 'dtu-input dtu-select',
              value: values.palette,
              disabled: locked,
              onChange: (event) => setDraft({ ...values, palette: event.target.value }),
            },
            h('option', { value: 'primer' }, t('config.palette.primer')),
            h('option', { value: 'cvd' }, t('config.palette.cvd')),
            h('option', { value: 'muted' }, t('config.palette.muted')),
          ),
        ),
        h(
          'div',
          { className: 'dtu-formActions' },
          h(
            'button',
            { type: 'button', className: 'dtu-save', disabled: locked, onClick: () => void saveConfig(values) },
            busy ? t('config.saving') : t('config.save'),
          ),
          h('span', { className: 'dtu-formStatus' }, t('config.current', { text: describeWindows(current) })),
        ),
        state.configError || state.configErrorKey
          ? h(
              'div',
              { className: 'dtu-formStatus', 'data-tone': 'error' },
              failureText(state.configError, state.configErrorKey),
            )
          : null,
        current.writable === false && state.configStatus !== 'loading'
          ? h(
              'div',
              { className: 'dtu-formStatus', 'data-tone': 'error' },
              t('config.readonly'),
            )
          : null,
      )
    }

    // ── charts ──────────────────────────────────────────────────────────────

    const HEAT_METRICS = [
      { id: 'tokens', labelKey: 'heat.metric.tokens' },
      { id: 'turns', labelKey: 'heat.metric.turns' },
    ]

    /** Local midnight of the Monday starting the week that contains an instant. */
    function weekStartOf(ms) {
      const day = (new Date(ms).getDay() + 6) % 7 // 0 = Monday
      return dayStartMs(ms) - day * DAY_MS
    }

    /**
     * A calendar, not a bar chart: whole weeks aligned to Monday, a month header,
     * weekday labels, and square cells (flex, so nothing stretches them to the
     * panel width). Levels come from quartiles of the non-zero days, because a
     * maximum-relative scale flattens every day onto one shade whenever a single
     * day dwarfs the rest.
     */
    function Heatmap({ heatmap, days }) {
      const [chosen, setMetric] = React.useState(null)
      const [hovered, setHover] = React.useState(null)
      // A Host older than this Client answers without `heatmap`; the requested
      // range's days still fill the calendar rather than leaving it blank.
      const entries = heatmap
        ? heatmap.days
        : (days ?? []).map((day) => ({
            day: day.day,
            tokens: totalOf(day.buckets),
            turns: day.turns,
            requests: day.requests,
          }))
      const byDay = new Map(entries.map((day) => [day.day, day]))
      const weeks = heatmap && heatmap.weeks ? heatmap.weeks : 53
      const scope = heatmap ? t('heat.scope.weeks', { weeks }) : t('heat.scope.filter')
      const today = Date.now()
      const firstWeek = weekStartOf(today - (weeks - 1) * 7 * DAY_MS)
      const todayKey = dayKeyOf(new Date(today))
      // Days that carry a figure for each metric. Tokens are sparse on a machine
      // whose history is mostly imported sessions, so defaulting to the richer
      // dimension is what keeps the calendar from rendering as an empty grid.
      const tokenDays = entries.filter((day) => (day.tokens ?? 0) > 0).length
      const turnDays = entries.filter((day) => (day.turns ?? 0) > 0).length
      const metric = chosen ?? (tokenDays >= turnDays ? 'tokens' : 'turns')

      const columns = []
      let previousMonth = -1
      for (let week = 0; week < weeks; week += 1) {
        const days = []
        let monthLabel = null
        for (let offset = 0; offset < 7; offset += 1) {
          const ms = firstWeek + (week * 7 + offset) * DAY_MS
          const key = dayKeyOf(new Date(ms))
          const entry = byDay.get(key)
          days.push({ key, value: entry ? entry[metric] ?? 0 : 0, entry, future: ms > today })
          if (offset === 0) {
            const month = new Date(ms).getMonth()
            if (month !== previousMonth) {
              monthLabel = calendar().months[month]
              previousMonth = month
            }
          }
        }
        columns.push({ key: `w${week}`, days, monthLabel })
      }

      // The box cannot measure itself, so it never tries to centre: the first half
      // of the calendar anchors its LEFT edge to the hovered column and grows to
      // the right, the second half anchors its RIGHT edge and grows to the left.
      // Either way it stays inside the calendar, and its width stays free to
      // follow a long token count — a centred clamp has to guess that width, which
      // is exactly how it used to poke out and raise a scrollbar. The 25px is the
      // weekday axis and its gap, which the columns start after.
      const tipLeft = (week) => 'calc(25px + (100% - 25px) * ' + Number((week + 0.5) / weeks).toFixed(6) + ')'
      const tipFlips = (week) => (week + 0.5) / weeks >= 0.5

      const values = entries
        .map((day) => day[metric] ?? 0)
        .filter((value) => value > 0)
        .sort((a, b) => a - b)
      const quantile = (p) => (values.length > 0 ? values[Math.min(values.length - 1, Math.floor(p * values.length))] : 0)
      const low = quantile(0.25)
      const mid = quantile(0.5)
      const high = quantile(0.75)
      const levelOf = (value) => (value <= 0 ? 0 : value <= low ? 1 : value <= mid ? 2 : value <= high ? 3 : 4)
      const total = values.reduce((sum, value) => sum + value, 0)
      const metricLabel = metric === 'tokens' ? t('heat.unit.tokens') : t('heat.unit.turns')

      return h(
        'div',
        null,
        h(
          'div',
          { className: 'dtu-heatHead' },
          h(
            'div',
            { className: 'dtu-legend' },
            h(
              'span',
              null,
              t(pluralKey('heat.legend', values.length), {
                scope,
                days: grouped(values.length),
                total: metric === 'tokens' ? compact(total) : grouped(total),
                unit: metricLabel,
              }),
            ),
          ),
          h(
            'div',
            { className: 'dtu-heatControls' },
            h(ChipGroup, { items: HEAT_METRICS, value: metric, onSelect: setMetric, label: t('heat.metric.aria') }),
            h(
              'div',
              { className: 'dtu-heatScale' },
              h('span', null, t('heat.less')),
              [1, 2, 3, 4].map((level) =>
                h(
                  'span',
                  { key: level, className: 'dtu-cell' },
                  h('span', {
                    className: 'dtu-cellFill',
                    style: { background: 'var(--dtu-heat-' + level + ')' },
                  }),
                ),
              ),
              h('span', null, t('heat.more')),
            ),
          ),
        ),
        h(
          'div',
          { className: 'dtu-heatInner' },
          h(
            'div',
            { className: 'dtu-heatMonths' },
            h('div', { className: 'dtu-monthSpace' }),
            columns.map((column) => h('div', { key: column.key, className: 'dtu-monthCell' }, column.monthLabel)),
          ),
          h(
            'div',
            { className: 'dtu-heatRows' },
            h(
              'div',
              { className: 'dtu-weekdays' },
              // A narrow weekday can repeat (English gives T for Tuesday and
              // Thursday), so the key is the row, never the letter.
              calendar().days.map((day, index) =>
                h('span', { key: index }, index % 2 === 0 && index < 5 ? day : ''),
              ),
            ),
            h(
              'div',
              { className: 'dtu-heat' },
              columns.map((column, week) =>
                h(
                  'div',
                  { key: column.key, className: 'dtu-week' },
                  column.days.map((day) => {
                    const entry = day.entry
                    const level = levelOf(day.value)
                    return h(
                      'div',
                      {
                        key: day.key,
                        className: 'dtu-cell',
                        'data-day': day.key,
                        'data-level': level,
                        'data-today': day.key === todayKey ? 'true' : undefined,
                        // A native title used to be a day's only readout; the
                        // dashboard already owns a tooltip, so the calendar
                        // hovers into the very same box the trend chart shows.
                        onMouseEnter: () =>
                          setHover({
                            week,
                            day: day.key,
                            tokens: entry ? entry.tokens : 0,
                            turns: entry ? entry.turns : 0,
                            requests: entry ? entry.requests : 0,
                          }),
                        onMouseLeave: () => setHover(null),
                      },
                      h('span', {
                        className: 'dtu-cellFill',
                        // Step 0 keeps the box but not the paint: the hairline
                        // comes from the [data-level="0"] rule instead.
                        style: { background: level === 0 ? 'transparent' : 'var(--dtu-heat-' + level + ')' },
                      }),
                    )
                  }),
                ),
              ),
            ),
            hovered
              ? h(
                  'div',
                  {
                    className: 'dtu-tip dtu-tipHeat',
                    'data-day': hovered.day,
                    style: {
                      left: tipLeft(hovered.week),
                      transform: tipFlips(hovered.week) ? 'translateX(-100%)' : 'none',
                    },
                  },
                  // Four lines, one number each: the date on its own, then the
                  // same label/value row the trend tooltip uses for every figure.
                  h('div', { className: 'dtu-tipTitle' }, hovered.day),
                  // The same compact formatter the stat cards and the trend tooltip use:
                  // a full 1,451,563,110 would be the widest thing in a box that has to
                  // lean inside half a column span.
                  h('div', { className: 'dtu-tipRow' }, t('tip.tokens'), h('b', null, compact(hovered.tokens))),
                  h('div', { className: 'dtu-tipRow' }, t('tip.turns'), h('b', null, grouped(hovered.turns))),
                  h('div', { className: 'dtu-tipRow' }, t('tip.requests'), h('b', null, grouped(hovered.requests))),
                )
              : null,
          ),
        ),
      )
    }

    function niceMax(value) {
      if (value <= 0) return 1
      const magnitude = 10 ** Math.floor(Math.log10(value))
      const scaled = value / magnitude
      const step = scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10
      return step * magnitude
    }

    const EQUAL = [0, 0, 0, 0, 0]

    /** Cache-hit share of a day, in 0-1; null when the day saw no prompt tokens.
     *  Deliberately mirrored from lib/session-usage.js hitRateOf — the browser bundle
     *  cannot import that ESM module, so keep the two in sync. */
    function hitRateOf(buckets) {
      const hit = buckets[2]
      const miss = buckets[0] + buckets[3]
      return hit + miss > 0 ? hit / (hit + miss) : null
    }

    /**
     * The band the hit-rate curve is drawn against, from the visible days:
     * min - 10% of the span to max + 10%. A flat (or single-day) series gets
     * +/-1pp, and a range with no hit rate at all falls back to 0-100 so an
     * all-empty range still reads as a scale.
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
      { id: 'model', labelKey: 'group.model' },
      { id: 'provider', labelKey: 'group.provider' },
    ]

    function TrendSection({ days, groups, groupBy }) {
      const [mode, setMode] = React.useState('model')
      const [hover, setHover] = React.useState(null)
      const active = groupBy === 'both' ? mode : groupBy
      const entries = (groups && groups[active]) || []
      const top = entries.slice(0, TOP_N)
      const colorOf = new Map(top.map((entry, index) => [entry.key, seriesAt(index)]))
      const segmentColor = (key) => (key === OTHER_KEY ? OTHER : colorOf.get(key) ?? OTHER)
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
      // The box hangs off the hovered column rather than centring on it: half the
      // plot is what one anchor can cover, so a long model name grows away from
      // the edge it is near. Centring inside a clamped box is exactly what used to
      // squeeze a long model id such as deepseek-v4.1-flash onto a second line.
      const tipFlips = hover !== null && axisX(hover) >= 50
      return h(
        'div',
        { className: 'dtu-trend' },
        h(
          'div',
          { className: 'dtu-trendHead' },
          h('div', { className: 'dtu-hint' }, t('trend.hint')),
          groupBy === 'both'
            ? h(ChipGroup, { items: CHIP_GROUPS, value: mode, onSelect: setMode, label: t('group.aria') })
            : null,
        ),
        h(
          'div',
          { className: 'dtu-legend', style: { marginBottom: '6px' } },
          top.map((entry) =>
            h(
              'span',
              { key: entry.key },
              h('span', { className: 'dtu-dot', style: { background: colorOf.get(entry.key) } }),
              entry.key,
            ),
          ),
          h('span', null, h('span', { className: 'dtu-dot', style: { background: OTHER } }), t('trend.other')),
          h('span', null, h('span', { className: 'dtu-lineKey' }), t('trend.hitRate')),
        ),
        h(
          'div',
          { className: 'dtu-plot' },
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
                        background: segmentColor(segment.key),
                      },
                    }),
                  ),
                ),
              ),
            ),
            // Rate overlay: kept last inside the plot so the curve and its dots
            // draw above the bars, on the same percentage scale.
            h(
              'div',
              { className: 'dtu-axisHit' },
              bandTicks.map((tick) =>
                h('span', { key: tick, style: { top: hitY(tick / 100) + '%' } }, percent(tick / 100)),
              ),
            ),
            h(
              'div',
              { className: 'dtu-hitPlot' },
              h(
                'svg',
                { viewBox: '0 0 100 100', preserveAspectRatio: 'none' },
                // The curve is busiest exactly where the columns are tall (a high
                // hit rate means a high bar), and the hit colour alone sits near
                // 1-2:1 against those fills — a wider panel-coloured halo under the
                // line is what keeps it readable where it crosses them.
                h('path', {
                  d: hitPath,
                  fill: 'none',
                  stroke: 'var(--dsw-alias-bg-layer-1)',
                  strokeWidth: 3.5,
                  opacity: 0.75,
                  pointerEvents: 'none',
                  strokeLinecap: 'round',
                  vectorEffect: 'non-scaling-stroke',
                }),
                h('path', {
                  d: hitPath,
                  fill: 'none',
                  stroke: 'var(--dtu-hit)',
                  strokeWidth: 2,
                  opacity: 1,
                  strokeLinecap: 'round',
                  vectorEffect: 'non-scaling-stroke',
                }),
              ),
              columns.map((column, index) =>
                h('span', {
                  key: column.day,
                  className: column.hit === null ? 'dtu-hitDot dtu-hitDotEmpty' : 'dtu-hitDot',
                  style: {
                    left: axisX(index) + '%',
                    top: column.hit === null ? '100%' : hitY(column.hit) + '%',
                    // A panel-coloured ring lifts the marker off the bars without
                    // growing the 5px dot or its hit area; the empty-day marker
                    // stays transparent and unringed.
                    boxShadow: column.hit === null ? undefined : '0 0 0 1.5px var(--dsw-alias-bg-layer-1)',
                  },
                  onMouseEnter: () => setHover(index),
                  onMouseLeave: () => setHover(null),
                }),
              ),
            ),
          ),
          h(
            'div',
            { className: 'dtu-axisX' },
            labelled.map((index) =>
              h('span', { key: index, style: { left: axisX(index) + '%' } }, dayLabel(columns[index].day)),
            ),
          ),
          hovered
            ? h(
                'div',
                { className: 'dtu-plotLine' },
                h('div', { className: 'dtu-cursor', style: { left: axisX(hover) + '%' } }),
                h(
                  'div',
                  {
                    className: 'dtu-tip',
                    'data-day': hovered.day,
                    style: { left: axisX(hover) + '%', transform: tipFlips ? 'translateX(-100%)' : 'none' },
                  },
                  // Same shape as the heatmap's box: the date on its own, then one
                  // figure per row — gluing the date to a number reads as one string,
                  // and a long total would widen the box past its rails.
                  h('div', { className: 'dtu-tipTitle' }, hovered.day),
                  h('div', { className: 'dtu-tipRow' }, t('tip.tokens'), h('b', null, compact(hovered.total))),
                  hovered.segments
                    .filter((segment) => segment.value > 0)
                    .map((segment) =>
                      h(
                        'div',
                        { key: segment.key, className: 'dtu-tipRow' },
                        h('span', {
                          className: 'dtu-dot',
                          style: { background: segmentColor(segment.key) },
                        }),
                        // A long model name is ellipsised, never wrapped: the label
                        // and its figure have to stay on the same line to be readable.
                        h('span', { className: 'dtu-tipKey' }, segment.key === OTHER_KEY ? t('trend.other') : segment.key),
                        h('b', null, compact(segment.value)),
                      ),
                    ),
                  h(
                    'div',
                    { className: 'dtu-tipRow' },
                    t('trend.hitRate'),
                    h('b', null, hovered.hit === null ? '—' : percent(hovered.hit)),
                  ),
                ),
              )
            : null,
        ),
      )
    }

    function Donut({ entries, totalTokens, selected, onSelect }) {
      const radius = 42
      const circumference = 2 * Math.PI * radius
      let offset = 0
      const slices = entries.map((entry, index) => {
        const share = totalTokens > 0 ? entry.totalTokens / totalTokens : 0
        const length = share * circumference
        const slice = { entry, share, length, offset, color: entry.key === OTHER_KEY ? OTHER : seriesAt(index) }
        offset += length
        return slice
      })
      return h(
        'div',
        { className: 'dtu-donut' },
        h(
          'svg',
          { viewBox: '0 0 100 100', width: '100%', height: '100%' },
          h('circle', { cx: 50, cy: 50, r: radius, fill: 'none', stroke: 'var(--dsw-alias-bg-layer-2)', strokeWidth: 12 }),
          h(
            'g',
            { transform: 'rotate(-90 50 50)' },
            slices.map((slice) =>
              h('circle', {
                key: slice.entry.key,
                cx: 50,
                cy: 50,
                r: radius,
                fill: 'none',
                stroke: slice.color,
                strokeWidth: 12,
                strokeDasharray: `${slice.length} ${circumference - slice.length}`,
                strokeDashoffset: -slice.offset,
                style: { cursor: 'pointer', opacity: selected && selected !== slice.entry.key ? 0.35 : 1 },
                onMouseEnter: () => onSelect(slice.entry.key),
                onMouseLeave: () => onSelect(null),
              }),
            ),
          ),
        ),
        h(
          'div',
          { className: 'dtu-donutCenter' },
          h('div', { className: 'dtu-donutTotal' }, compact(totalTokens)),
          h('div', { className: 'dtu-donutLabel' }, t('card.tokens')),
        ),
      )
    }

    // ── dashboard ───────────────────────────────────────────────────────────

    /**
     * The grouping this half renders. A Host newer than this Client ships
     * `groups`/`byGroup` with the summary; an older one only carries route-keyed
     * `byModel`/`models`, and the Client can hot-update before the Host restarts —
     * so rebuild both groupings locally instead of degrading into one grey "other"
     * bar and an empty breakdown. Mirrors the Host's split (provider/model of the
     * route, provider = model = route without a slash) and its ranking:
     * totalTokens desc, then key asc.
     *
     * The by-model key also mirrors the Host's `modelKeyOf`: one model reaches
     * us both as `deepseek-v4.1-flash` and as `deepseek/deepseek-v4.1-flash`,
     * and keying on the raw half would split it into two rows.
     */
    function modelKeyOf(model) {
      const text = String(model ?? '')
      const tail = text.slice(text.lastIndexOf('/') + 1)
      return tail === '' ? text : tail
    }

    function normalizeGrouping(data) {
      if (!data) return { days: [], groups: null }
      if (!Array.isArray(data.days)) return { days: data.days, groups: data.groups ?? null }
      if (data.groups && data.days.every((day) => day && day.byGroup)) {
        return { days: data.days, groups: data.groups }
      }
      const days = data.days
      const routeKeys = new Map()
      for (const model of Array.isArray(data.models) ? data.models : []) {
        routeKeys.set(model.route, { provider: model.provider, model: model.model })
      }
      const keysOf = (route) => {
        const known = routeKeys.get(route)
        if (known) return [modelKeyOf(known.model), known.provider]
        const slash = route.indexOf('/')
        return slash > 0 ? [modelKeyOf(route.slice(slash + 1)), route.slice(0, slash)] : [route, route]
      }
      const groupMaps = { model: new Map(), provider: new Map() }
      const groupedDays = days.map((day) => {
        const perDay = { model: new Map(), provider: new Map() }
        for (const [route, buckets] of Object.entries((day && day.byModel) || {})) {
          const [modelKey, providerKey] = keysOf(route)
          for (const [mode, key] of [['model', modelKey], ['provider', providerKey]]) {
            for (const map of [perDay[mode], groupMaps[mode]]) {
              let slot = map.get(key)
              if (!slot) {
                slot = [0, 0, 0, 0, 0]
                map.set(key, slot)
              }
              buckets.forEach((value, index) => {
                slot[index] += value
              })
            }
          }
        }
        return {
          ...day,
          byGroup: { model: Object.fromEntries(perDay.model), provider: Object.fromEntries(perDay.provider) },
        }
      })
      const ranked = (map) =>
        [...map.entries()]
          .map(([key, buckets]) => ({ key, buckets, totalTokens: totalOf(buckets) }))
          .sort((a, b) => b.totalTokens - a.totalTokens || (a.key < b.key ? -1 : 1))
      return {
        days: groupedDays,
        groups: { model: ranked(groupMaps.model), provider: ranked(groupMaps.provider) },
      }
    }

    function DashboardBody() {
      const state = useStore()
      useLocale()
      const [hovered, setHovered] = React.useState(null)

      const data = state.data
      const filter = state.filter
      const custom = filter.range === 'custom'
      const totals = data ? data.totals : null
      const buckets = totals ? totals.buckets : [0, 0, 0, 0, 0]
      const [breakdownMode, setBreakdownMode] = React.useState('model')
      const groupByMode = state.config?.groupBy ?? 'both'
      const activeBreakdown = groupByMode === 'both' ? breakdownMode : groupByMode
      const grouping = normalizeGrouping(data)
      const activeGroups = (grouping.groups && grouping.groups[activeBreakdown]) || []
      const topGroup = activeGroups.length > 0 ? activeGroups[0] : null
      // Spec §2.3: the donut and the detail list fold to a top five plus the
      // card keeps the true #1 (topGroup), the trend folds its own stack.
      const shown = activeGroups.slice(0, TOP_N)
      if (activeGroups.length > TOP_N) {
        const folded = activeGroups.slice(TOP_N)
        shown.push({
          key: OTHER_KEY,
          totalTokens: folded.reduce((sum, entry) => sum + entry.totalTokens, 0),
          folded: folded.map((entry) => entry.key),
        })
      }

      const head = h(
        'div',
        { className: 'dtu-head' },
        h('div', { className: 'dtu-title' }, t('dash.title')),
        h(
          'div',
          { className: 'dtu-controls' },
          h(ChipGroup, {
            items: RANGES,
            value: filter.range,
            onSelect: (range) => setFilter({ range }),
            label: t('range.aria'),
          }),
          h(ChipGroup, {
            items: SOURCES,
            value: filter.source,
            onSelect: (source) => setFilter({ source }),
            label: t('source.aria'),
          }),
          custom
            ? h(
                React.Fragment,
                null,
                h('input', {
                  className: 'dtu-date',
                  type: 'date',
                  value: filter.since,
                  'aria-label': t('filter.start'),
                  onChange: (event) => setFilter({ since: event.target.value }),
                }),
                h('span', { style: { color: 'var(--dsw-alias-label-secondary)' } }, '→'),
                h('input', {
                  className: 'dtu-date',
                  type: 'date',
                  value: filter.until,
                  'aria-label': t('filter.end'),
                  onChange: (event) => setFilter({ until: event.target.value }),
                }),
              )
            : null,
          h('button', { type: 'button', className: 'dtu-refresh', onClick: reload }, t('action.refresh')),
        ),
      )

      let body
      if (state.status === 'error') {
        body = h(
          'div',
          { className: 'dtu-note', 'data-tone': 'error' },
          t('state.error', { message: failureText(state.error, state.errorKey) }),
        )
      } else if (state.status === 'waiting') {
        body = h(
          'div',
          { className: 'dtu-note' },
          t('state.waiting'),
        )
      } else if (!data) {
        body = h('div', { className: 'dtu-note' }, t('state.loading'))
      } else if (totals.totalTokens === 0 && totals.turns === 0) {
        body = h('div', { className: 'dtu-note' }, t('state.empty'))
      } else {
        body = h(
          React.Fragment,
          null,
          h(
            'div',
            { className: 'dtu-cards' },
            h(Card, {
              label: t('card.tokens'),
              value: grouped(totals.totalTokens),
              sub: t('card.tokens.sub', {
                uncached: compact(buckets[0]),
                cached: compact(buckets[2]),
                output: compact(buckets[1]),
              }),
            }),
            h(Card, { label: t('card.turns'), value: grouped(totals.turns) }),
            h(Card, {
              label: t('card.requests'),
              value: grouped(totals.requests),
              sub: t('card.requests.sub'),
            }),
            h(Card, {
              label: t('card.activeDays'),
              value: grouped(totals.activeDays),
              sub: countOf('unit.sessions', totals.sessions),
            }),
            h(Card, {
              label: t('card.hitRate'),
              value: percent(totals.cacheHitRate),
              sub: t('card.hitRate.sub'),
            }),
            h(Card, {
              label: t(activeBreakdown === 'provider' ? 'card.topProvider' : 'card.topModel'),
              value: topGroup ? topGroup.key : '—',
              sub: topGroup
                ? t('card.share', { percent: percent(topGroup.totalTokens / Math.max(1, totals.totalTokens)) })
                : null,
              title: topGroup ? topGroup.key : undefined,
            }),
          ),
          // The configured windows are wall-clock recency figures: the Host
          // builds them from `{root, useCache, now}` alone, so unlike every other
          // section here they do not follow the source filter. Say so.
          data.card
            ? h(
                Section,
                {
                  title: t('section.windows'),
                  extra: h('span', { className: 'dtu-hint' }, t('section.windows.hint')),
                },
                h(
                  'div',
                  { className: 'dtu-cards' },
                  (data.card.blocks.length > 0 ? data.card.blocks : data.card.all ? [data.card.all] : []).map((block) =>
                    h(Card, {
                      key: block.id,
                      label: blockLabel(block, data.card),
                      value: grouped(block.totalTokens),
                      sub:
                        t('detail.inputOutput', {
                          input: compact(block.inputTokens),
                          output: compact(block.outputTokens),
                        }) +
                        ' · ' +
                        t('detail.cacheHit', { rate: percent(block.cacheHitRate) }) +
                        ' · ' +
                        countOf('unit.turns', block.turns),
                    }),
                  ),
                ),
              )
            : null,
          h(
            Section,
            { title: t('section.heat'), extra: h('span', { className: 'dtu-hint' }, t('section.heat.hint')) },
            h(Heatmap, { heatmap: data.heatmap, days: data.days }),
          ),
          h(
            Section,
            { title: t('section.trend') },
            h(TrendSection, { days: grouping.days, groups: grouping.groups, groupBy: groupByMode }),
          ),
          h(
            Section,
            {
              title: t('section.breakdown'),
              extra:
                groupByMode === 'both'
                  ? h(ChipGroup, {
                      items: CHIP_GROUPS,
                      value: breakdownMode,
                      onSelect: setBreakdownMode,
                      label: t('trend.breakdownAria'),
                    })
                  : h(
                      'span',
                      { className: 'dtu-hint' },
                      t(activeBreakdown === 'provider' ? 'group.provider' : 'group.model'),
                    ),
            },
            h(
              'div',
              { className: 'dtu-models' },
              h(Donut, { entries: shown, totalTokens: totals.totalTokens, selected: hovered, onSelect: setHovered }),
              h(
                'div',
                { className: 'dtu-rows' },
                shown.map((entry, index) =>
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
                      {
                        className: 'dtu-rowName',
                        title: entry.key === OTHER_KEY ? (entry.folded ?? []).join(t('list.separator')) : entry.key,
                      },
                      h('span', {
                        className: 'dtu-dot',
                        style: { background: entry.key === OTHER_KEY ? OTHER : seriesAt(index) },
                      }),
                      entry.key === OTHER_KEY ? t('trend.other') : entry.key,
                    ),
                    h('div', { className: 'dtu-rowTotal' }, compact(entry.totalTokens)),
                    h(
                      'div',
                      { className: 'dtu-rowShare' },
                      totals.totalTokens > 0 ? percent(entry.totalTokens / totals.totalTokens) : percent(0),
                    ),
                  ),
                ),
              ),
            ),
          ),
        )
      }

      const palette = state.config?.palette ?? 'primer'
      return h(
        'div',
        { className: 'dtu-root', 'data-dtu-palette': palette },
        head,
        h(
          'div',
          { className: 'dtu-body' },
          body,
          h(
            'div',
            { className: 'dtu-foot' },
            h('span', null, t('foot.updated', { time: stamp(data ? data.generatedAt : Date.now()) })),
            h('span', null, t('foot.source', { files: countOf('unit.files', data ? data.coverage.files : 0) })),
            h(
              'span',
              { className: 'dtu-footEntry' },
              t('foot.inference1'),
              // Keep each surface name whole: a term may otherwise break between
              // any two characters and leave its quote dangling at a line edge.
              h('span', { className: 'dtu-nb' }, t('source.client')),
              t('foot.inference2'),
              h('span', { className: 'dtu-nb' }, t('source.cli')),
              t('foot.inference3'),
            ),
          ),
        ),
      )
    }

    // ── slot entries (each guarded) ─────────────────────────────────────────

    /** Central panel: a render failure must show text, never a blank seat. */
    function Dashboard(props) {
      useLocale()
      return h(Boundary, { label: t('a11y.dashboard') }, h(DashboardBody, props))
    }

    /** Sidebar foot card, guarded for the same reason. */
    function UsageEntry(props) {
      useLocale()
      return h(Boundary, { label: t('a11y.sidebar') }, h(SidebarEntry, props))
    }

    // ── wire contribution + slots ───────────────────────────────────────────

    /**
     * The Client face of one endpoint. It mirrors the Host descriptor field for
     * field — an id, a namespace, or a `wire` name that drifts breaks the RPC
     * with no error on either side — and validates nothing: a Remote answers its
     * `{ ok, value }` envelope, so a failed decode never surfaces here.
     */
    const encodable = (typeSymbol) => ({
      mode: 'strict',
      typeSymbol: `${REMOTE_PACKAGE}#${typeSymbol}`,
      create: () => ({ parse: (value) => value }),
    })

    const remoteDescriptor = (method, parameters, resultType) => ({
      id: `${REMOTE_PACKAGE}#${REMOTE_NAMESPACE}/${method}`,
      service: REMOTE_SERVICE,
      namespace: REMOTE_NAMESPACE,
      method,
      invocation: { kind: 'direct' },
      parameters,
      result: encodable(resultType),
    })

    const jsonParam = (name, typeSymbol, acceptsUndefined) => ({
      name,
      wire: name,
      source: 'json',
      codec: encodable(typeSymbol),
      acceptsUndefined,
    })

    const CONTRIBUTION = {
      package: REMOTE_PACKAGE,
      descriptors: [
        remoteDescriptor('summary', [jsonParam('filter', 'UsageFilter', true)], 'UsageSummary'),
        remoteDescriptor('config', [], 'UsageConfig'),
        remoteDescriptor('setConfig', [jsonParam('patch', 'UsageConfigPatch', false)], 'UsageConfig'),
      ],
    }

    function apply(ctx) {
      const face = () => ({
        refresh: reload,
        open: () => ctx.get('layout')?.selectPanel(PANEL_ID),
        close: () => ctx.get('layout')?.selectPanel(null),
      })

      // The locale service owns the language catalog and the dictionaries: this
      // half contributes its pack of languages plus one namespace. Both are
      // owned effects, so unloading the plugin takes them back out of the
      // selector and out of the registry.
      //
      // `inject` (rather than a direct `ctx.get`) is what lets the plugin load
      // against a Host that ships no locale service at all: the callback simply
      // never runs, and `syncLocale` then follows the browser's own languages.
      ctx.inject(['locale'], (localeCtx) => {
        const locale = localeCtx.locale
        if (!locale || typeof locale.register !== 'function') return
        attachFace(locale)
        for (const pack of PACKS) {
          localeCtx.effect(
            () => addPack(locale, pack),
            `dsh-desktop-token-usage: language ${pack.id}`,
          )
        }
        // DSH requires both shipped locales in one call; a pack registers alone.
        localeCtx.effect(
          () => locale.register(NS, { zh: DICT.zh, en: DICT.en }),
          'dsh-desktop-token-usage: dictionary zh/en',
        )
        for (const pack of PACKS) {
          localeCtx.effect(
            () => locale.register(NS, pack.id, DICT[pack.id]),
            `dsh-desktop-token-usage: dictionary ${pack.id}`,
          )
        }
        localeCtx.effect(
          () => () => attachFace(null),
          'dsh-desktop-token-usage: locale subscription',
        )
      })

      // Styles belong to the plugin fiber: registered once, removed on unload.
      ctx.effect(() => {
        const tag = document.createElement('style')
        tag.dataset.plugin = PANEL_ID
        tag.textContent = CSS
        document.head.appendChild(tag)
        return () => tag.remove()
      }, 'dsh-desktop-token-usage: styles')

      ctx.effect(() => {
        let cancelled = false
        let unmount
        ctx.remote
          .$mount(CONTRIBUTION)
          .then((dispose) => {
            if (cancelled) {
              dispose()
              return
            }
            unmount = dispose
            ctx.inject([`remote.${REMOTE_NAMESPACE}`], (namespaceCtx) => {
              namespace = namespaceCtx.remote[REMOTE_NAMESPACE]
              void load()
              void loadConfig()
              namespaceCtx.effect(() => () => {
                namespace = undefined
              }, 'dsh-desktop-token-usage: usage namespace')
            })
          })
          .catch((error) => {
            console.error('[dsh-desktop-token-usage] could not mount the usage remote:', error)
          })
        return () => {
          cancelled = true
          if (unmount) unmount()
        }
      }, 'dsh-desktop-token-usage: usage remote')

      // A window like "last 6 hours" slides even while nothing new is logged, and
      // a Config edit only reaches this half on the next call: refresh quietly.
      ctx.effect(() => {
        const timer = setInterval(() => {
          if (namespace) void load(snapshot.filter, { silent: true })
        }, REFRESH_MS)
        return () => clearInterval(timer)
      }, 'dsh-desktop-token-usage: refresh timer')

      ctx.slots.inject('main', () =>
        ctx.slots.register({ name: 'main', key: PANEL_ID, inject: face }, Dashboard),
      )
      // Keyed by the bundle's package name: this is the plugin's own page in the
      // Plugins manager, between its description and its component rows.
      ctx.slots.inject('plugins.bundle.config', () =>
        ctx.slots.register({ name: 'plugins.bundle.config', key: REMOTE_PACKAGE }, ConfigForm),
      )
      // `sidebar.footer.action`: the usage card the user reads at a glance. The
      // seat is one horizontal row and every plugin in it declares width:100%, so
      // the stylesheet's `:has()` rule makes it wrap and each occupant gets its
      // own full-width line.
      ctx.inject(['layout'], (layoutCtx) => {
        layoutCtx.slots.inject('sidebar.footer.action', () =>
          layoutCtx.slots.register({ name: 'sidebar.footer.action', id: PANEL_ID, order: 5, inject: face }, UsageEntry),
        )
      })
    }

    return {
      inject: ['slots', 'remote'],
      apply,
    }
  },
})
