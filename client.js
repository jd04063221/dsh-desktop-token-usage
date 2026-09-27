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
  id: 'dsh-token-usage',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    /** Must equal the package name: it addresses both the `main` slot and the Remote. */
    const PANEL_ID = 'dsh-token-usage'
    const REMOTE_PACKAGE = 'dsh-token-usage'
    const REMOTE_SERVICE = 'dshTokenUsage'
    const REMOTE_NAMESPACE = 'dshUsage'

    const SERIES = ['#4c8dff', '#3fb950', '#d29922', '#a371f7', '#ec6a5e', '#39c5cf']
    const OTHER = '#6e7681'
    /** Quiet refresh period; keeps hour windows honest without polling hard. */
    const REFRESH_MS = 5 * 60_000

    // ── filter model ────────────────────────────────────────────────────────

    const RANGES = [
      { id: '7d', label: '最近 7 天', days: 7 },
      { id: '14d', label: '最近 14 天', days: 14 },
      { id: '30d', label: '最近 30 天', days: 30 },
      { id: '90d', label: '最近 90 天', days: 90 },
      { id: 'all', label: '全部', days: null },
      { id: 'custom', label: '自定义', days: null },
    ]
    // Only these are derivable offline; see docs/DESIGN.md.
    const SOURCES = [
      { id: 'all', label: '全部', wire: null },
      { id: 'client', label: '桌面·网页', wire: ['client'] },
      { id: 'cli', label: '命令行·机器人', wire: ['cli'] },
      { id: 'subagent', label: '子代理', wire: ['subagent'] },
    ]

    function dayKeyOf(date) {
      const month = `${date.getMonth() + 1}`.padStart(2, '0')
      const day = `${date.getDate()}`.padStart(2, '0')
      return `${date.getFullYear()}-${month}-${day}`
    }

    const todayKey = () => dayKeyOf(new Date())

    function shiftDays(key, delta) {
      const [year, month, day] = key.split('-').map(Number)
      return dayKeyOf(new Date(year, month - 1, day + delta))
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
      data: null,
      filter: { range: 'all', source: 'all', since: '', until: '' },
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

    async function load(filter = snapshot.filter, { silent = false } = {}) {
      const mine = ++ticket
      if (!namespace) {
        // The Remote namespace arrives with the mount; keep waiting rather than
        // showing an error the user cannot act on.
        patch({ status: snapshot.data ? 'ready' : 'waiting', filter })
        return
      }
      if (!silent) patch({ status: snapshot.data ? 'ready' : 'loading', filter, error: null })
      else patch({ filter })
      try {
        const response = await namespace.summary(wireFilterOf(filter))
        if (mine !== ticket) return
        // A Remote returns its `{ ok, value }` envelope as-is: a failure is a
        // value, not a throw, so the branch must be read before trusting it.
        if (!response || response.ok !== true) {
          const failure = response && response.error
          patch({
            status: 'error',
            error: (failure && (failure.message ?? failure.code)) || '用量服务返回了无法识别的响应',
          })
          return
        }
        patch({ status: 'ready', data: response.value, error: null })
      } catch (error) {
        if (mine !== ticket) return
        patch({ status: 'error', error: error && error.message ? error.message : String(error) })
      }
    }

    const setFilter = (changes) => {
      patch({ filter: { ...snapshot.filter, ...changes } })
      void load(snapshot.filter)
    }
    const reload = () => void load(snapshot.filter, { silent: true })

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

    // ── formatting ──────────────────────────────────────────────────────────

    const grouped = (value) => Math.round(value).toLocaleString('en-US')

    function compact(value) {
      if (!Number.isFinite(value) || value === 0) return '0'
      if (value >= 1e8) return `${(value / 1e8).toFixed(2)}亿`
      if (value >= 1e4) return `${(value / 1e4).toFixed(1)}万`
      return grouped(value)
    }

    const percent = (ratio) => `${(ratio * 100).toFixed(1)}%`

    const totalOf = (buckets) => buckets[0] + buckets[1] + buckets[2] + buckets[3]

    /** `provider/model`, shortened for display: the vendor prefix repeats a lot. */
    function shortRoute(route) {
      const parts = route.split('/')
      if (parts.length <= 2) return route
      return `${parts[0]}/…/${parts[parts.length - 1]}`
    }

    // ── styles ──────────────────────────────────────────────────────────────

    const CSS = `
.dtu-root{display:block;height:100%;overflow:auto;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-size:13px}
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
.dtu-heat{display:grid;grid-auto-flow:column;grid-template-rows:repeat(7,11px);gap:3px;overflow-x:auto;padding-bottom:4px}
.dtu-cell{width:11px;height:11px;border-radius:2px;background:var(--dsw-alias-bg-layer-2);position:relative}
.dtu-cellFill{position:absolute;inset:0;border-radius:2px;background:var(--dsw-alias-brand-primary)}
.dtu-heatScale{display:flex;align-items:center;gap:4px;color:var(--dsw-alias-label-secondary);font-size:11.5px}
.dtu-chart{position:relative;height:260px;margin-top:4px}
.dtu-bars{position:absolute;left:52px;right:44px;top:0;bottom:22px;display:flex;align-items:flex-end;gap:2px}
.dtu-col{flex:1 1 0;min-width:3px;display:flex;flex-direction:column;justify-content:flex-end;height:100%;position:relative}
.dtu-col:hover{outline:1px solid var(--dsw-alias-border-l2);outline-offset:1px;border-radius:2px}
.dtu-seg{width:100%}
.dtu-line{position:absolute;left:52px;right:44px;top:0;bottom:22px;pointer-events:none}
.dtu-line svg{width:100%;height:100%;display:block}
.dtu-axisX{position:absolute;left:52px;right:44px;bottom:0;height:18px;color:var(--dsw-alias-label-secondary);font-size:11px}
.dtu-axisX span{position:absolute;transform:translateX(-50%);white-space:nowrap}
.dtu-axisY{position:absolute;left:0;top:0;bottom:22px;width:50px;color:var(--dsw-alias-label-secondary);font-size:11px}
.dtu-axisY span,.dtu-axisYr span{position:absolute;right:4px;transform:translateY(-50%);white-space:nowrap}
.dtu-axisYr{position:absolute;right:0;top:0;bottom:22px;width:42px;color:var(--dsw-alias-label-secondary);font-size:11px}
.dtu-axisYr span{right:auto;left:4px}
.dtu-grid{position:absolute;left:52px;right:44px;top:0;bottom:22px}
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
.dtu-rowProvider{color:var(--dsw-alias-label-secondary);font-size:11.5px;margin-left:6px}
.dtu-rowShare{color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}
.dtu-rowTotal{font-variant-numeric:tabular-nums;font-weight:600}
.dtu-empty{color:var(--dsw-alias-label-secondary);padding:8px 0}
.dtu-foot{color:var(--dsw-alias-label-secondary);font-size:11.5px;display:flex;flex-wrap:wrap;gap:12px}
.dtu-footEntry{min-width:0;max-width:360px}
.dtu-footTop{display:flex;align-items:center;gap:8px;color:var(--dsw-alias-label-secondary);font-size:11.5px}
.dtu-footValue{font-size:16px;font-weight:600;color:var(--dsw-alias-label-primary)}
.dtu-footRow{display:flex;justify-content:space-between;gap:10px;color:var(--dsw-alias-label-secondary);font-size:11.5px}
.dtu-window{display:flex;flex-direction:column;gap:1px;padding:4px 0 5px;border-top:1px solid var(--dsw-alias-border-l1)}
.dtu-window:first-of-type{border-top:0;padding-top:2px}
.dtu-windowLabel{color:var(--dsw-alias-label-secondary);font-size:11.5px;font-weight:600}
.dtu-windowValue{color:var(--dsw-alias-label-primary);font-size:12.5px;font-variant-numeric:tabular-nums}
.dtu-windowMeta{color:var(--dsw-alias-label-secondary);font-size:11px;font-variant-numeric:tabular-nums}
.dtu-footCard{appearance:none;text-align:left;font:inherit;cursor:pointer;width:100%;display:flex;flex-direction:column;gap:4px;padding:8px 10px;border-radius:8px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);color:inherit}
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
            item.label,
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
        console.error('[dsh-token-usage] render failed:', error, info)
      }

      render() {
        const error = this.state.error
        if (error) {
          const message = error && error.message ? error.message : String(error)
          return h(
            'div',
            { className: 'dtu-note', 'data-tone': 'error' },
            `dsh-token-usage 渲染失败（${this.props.label}）：${message}`,
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
    function CardWindow({ block }) {
      return h(
        'div',
        { className: 'dtu-window' },
        h('div', { className: 'dtu-windowLabel' }, block.label),
        h(
          'div',
          { className: 'dtu-windowValue' },
          `输入 ${compact(block.inputTokens)} · 输出 ${compact(block.outputTokens)}`,
        ),
        h(
          'div',
          { className: 'dtu-windowMeta' },
          `缓存命中 ${percent(block.cacheHitRate)} · ${block.turns} 轮`,
        ),
      )
    }

    function SidebarEntry(props) {
      const state = useStore()
      const card = state.data ? state.data.card : null
      const blocks = card ? card.blocks : []
      const all = card ? card.all : null
      const headline = blocks.length > 0 ? blocks[0].inputTokens + blocks[0].outputTokens : all ? all.totalTokens : 0
      if (props.wide === false) {
        const label = `Token 用量 · ${compact(headline)}`
        return h(
          'button',
          { type: 'button', className: 'dtu-rail', title: label, 'aria-label': label, onClick: props.open },
          h(Icon, { size: 16 }),
        )
      }
      let body
      if (state.status === 'error') {
        body = h('div', { className: 'dtu-windowMeta' }, '读取失败，点开查看原因')
      } else if (!card) {
        body = h('div', { className: 'dtu-windowMeta' }, '正在读取本地会话日志…')
      } else if (blocks.length > 0) {
        body = blocks.map((block) => h(CardWindow, { key: block.id, block }))
      } else if (all) {
        body = [
          h('div', { key: 'total', className: 'dtu-footValue' }, compact(all.totalTokens)),
          h(
            'div',
            { key: 'split', className: 'dtu-footRow' },
            h('span', null, `输入 ${compact(all.inputTokens)} · 输出 ${compact(all.outputTokens)}`),
          ),
          h(
            'div',
            { key: 'meta', className: 'dtu-footRow' },
            h('span', null, `缓存命中 ${percent(all.cacheHitRate)}`),
            h('span', null, `${all.turns} 轮`),
          ),
        ]
      }
      return h(
        'button',
        { type: 'button', className: 'dtu-footCard', title: '打开 Token 用量看板', onClick: props.open },
        h(
          'div',
          { className: 'dtu-footTop' },
          h(Icon, { size: 14 }),
          h('span', null, 'Token 用量'),
          h('span', { style: { marginLeft: 'auto' } }, state.status === 'error' ? '读取失败' : ''),
        ),
        body,
      )
    }

    // ── charts ──────────────────────────────────────────────────────────────

    const HEAT_WEEKS = 53

    function Heatmap({ days, first, last }) {
      const byDay = new Map(days.map((day) => [day.day, day]))
      const max = days.reduce((peak, day) => Math.max(peak, totalOf(day.buckets)), 0)
      const end = todayKey()
      const total = HEAT_WEEKS * 7
      const cells = []
      for (let index = 0; index < total; index += 1) {
        const key = shiftDays(end, index - total + 1)
        const day = byDay.get(key)
        const tokens = day ? totalOf(day.buckets) : 0
        const turns = day ? day.turns : 0
        let level = 0
        if (tokens > 0 || turns > 0) {
          level = 1
          if (max > 0) {
            const ratio = tokens / max
            if (ratio >= 0.85) level = 4
            else if (ratio >= 0.45) level = 3
            else if (ratio >= 0.15) level = 2
          }
        }
        cells.push(
          h(
            'div',
            {
              key,
              className: 'dtu-cell',
              title: `${key} · ${tokens ? grouped(tokens) : 0} tokens · ${turns} 轮`,
            },
            level > 0 ? h('div', { className: 'dtu-cellFill', style: { opacity: [0, 0.28, 0.5, 0.75, 1][level] } }) : null,
          ),
        )
      }
      return h(
        'div',
        null,
        h(
          'div',
          { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' } },
          h('div', { className: 'dtu-legend' }, first && last ? h('span', null, `${first} ~ ${last}`) : null),
          h(
            'div',
            { className: 'dtu-heatScale' },
            h('span', null, '较少'),
            [1, 2, 3, 4].map((level) =>
              h(
                'span',
                { key: level, className: 'dtu-cell', style: { position: 'relative', display: 'inline-block' } },
                h('span', { className: 'dtu-cellFill', style: { opacity: [0, 0.28, 0.5, 0.75, 1][level] } }),
              ),
            ),
            h('span', null, '较多'),
          ),
        ),
        h('div', { className: 'dtu-heat' }, cells),
      )
    }

    function niceMax(value) {
      if (value <= 0) return 1
      const magnitude = 10 ** Math.floor(Math.log10(value))
      const scaled = value / magnitude
      const step = scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10
      return step * magnitude
    }

    function TrendChart({ days, models }) {
      const top = models.slice(0, 5)
      const routes = top.map((model) => model.route)
      const colorOf = new Map(top.map((model, index) => [model.route, SERIES[index % SERIES.length]]))
      const columns = days.map((day) => {
        const segments = top.map((model) => ({ route: model.route, value: totalOf(day.byModel[model.route] ?? [0, 0, 0, 0, 0]) }))
        const named = segments.reduce((sum, segment) => sum + segment.value, 0)
        const dayTotal = totalOf(day.buckets)
        if (dayTotal - named > 0) segments.push({ route: '其他', value: dayTotal - named })
        const input = day.buckets[0]
        const cacheRead = day.buckets[2]
        return {
          day: day.day,
          total: dayTotal,
          turns: day.turns,
          segments,
          hit: cacheRead + input > 0 ? cacheRead / (cacheRead + input) : null,
        }
      })
      const max = niceMax(columns.reduce((peak, column) => Math.max(peak, column.total), 0))
      const labelled = columns.length <= 16 ? columns.map((_, index) => index) : [0, Math.floor((columns.length - 1) / 3), Math.floor((2 * (columns.length - 1)) / 3), columns.length - 1]
      const ticks = [0, 0.25, 0.5, 0.75, 1]
      const points = columns
        .map((column, index) => (column.hit === null ? null : `${((index + 0.5) / columns.length) * 100},${100 - column.hit * 100}`))
        .filter(Boolean)
        .join(' ')
      return h(
        'div',
        null,
        h(
          'div',
          { className: 'dtu-legend', style: { marginBottom: '6px' } },
          top.map((model, index) =>
            h(
              'span',
              { key: model.route, title: model.route },
              h('span', { className: 'dtu-dot', style: { background: SERIES[index % SERIES.length] } }),
              shortRoute(model.route),
            ),
          ),
          h(
            'span',
            null,
            h('span', { className: 'dtu-dot', style: { background: OTHER } }),
            '其他',
          ),
          h(
            'span',
            null,
            h('span', { className: 'dtu-dot', style: { background: 'var(--dsw-alias-state-warn-primary)', borderRadius: '50%' } }),
            '缓存命中率',
          ),
        ),
        h(
          'div',
          { className: 'dtu-chart' },
          h(
            'div',
            { className: 'dtu-grid' },
            ticks.map((tick) =>
              h('div', { key: tick, className: 'dtu-gridline', style: { top: `${tick * 100}%` } }),
            ),
          ),
          h(
            'div',
            { className: 'dtu-axisY' },
            ticks.map((tick) => h('span', { key: tick, style: { top: `${tick * 100}%` } }, compact(max * (1 - tick)))),
          ),
          h(
            'div',
            { className: 'dtu-axisYr' },
            ticks.map((tick) => h('span', { key: tick, style: { top: `${tick * 100}%` } }, `${Math.round((1 - tick) * 100)}%`)),
          ),
          h(
            'div',
            { className: 'dtu-bars' },
            columns.map((column) =>
              h(
                'div',
                {
                  key: column.day,
                  className: 'dtu-col',
                  title: `${column.day} · ${grouped(column.total)} tokens · ${column.turns} 轮${
                    column.hit === null ? '' : ` · 缓存命中 ${percent(column.hit)}`
                  }`,
                },
                column.segments.map((segment, index) =>
                  h('div', {
                    key: `${segment.route}-${index}`,
                    className: 'dtu-seg',
                    style: {
                      height: `${(segment.value / max) * 100}%`,
                      background: colorOf.get(segment.route) ?? OTHER,
                    },
                  }),
                ),
              ),
            ),
          ),
          points
            ? h(
                'div',
                { className: 'dtu-line' },
                h(
                  'svg',
                  { viewBox: '0 0 100 100', preserveAspectRatio: 'none' },
                  h('polyline', {
                    points,
                    fill: 'none',
                    stroke: 'var(--dsw-alias-state-warn-primary)',
                    strokeWidth: 1.5,
                    vectorEffect: 'non-scaling-stroke',
                  }),
                ),
              )
            : null,
          h(
            'div',
            { className: 'dtu-axisX' },
            labelled.map((index) =>
              h('span', { key: index, style: { left: `${((index + 0.5) / columns.length) * 100}%` } }, columns[index].day.slice(5)),
            ),
          ),
        ),
      )
    }

    function Donut({ models, totalTokens, selected, onSelect }) {
      const radius = 42
      const circumference = 2 * Math.PI * radius
      let offset = 0
      const slices = models.map((model, index) => {
        const share = totalTokens > 0 ? model.totalTokens / totalTokens : 0
        const length = share * circumference
        const slice = { model, share, length, offset, color: SERIES[index % SERIES.length] }
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
                key: slice.model.route,
                cx: 50,
                cy: 50,
                r: radius,
                fill: 'none',
                stroke: slice.color,
                strokeWidth: 12,
                strokeDasharray: `${slice.length} ${circumference - slice.length}`,
                strokeDashoffset: -slice.offset,
                style: { cursor: 'pointer', opacity: selected && selected !== slice.model.route ? 0.35 : 1 },
                onMouseEnter: () => onSelect(slice.model.route),
                onMouseLeave: () => onSelect(null),
              }),
            ),
          ),
        ),
        h(
          'div',
          { className: 'dtu-donutCenter' },
          h('div', { className: 'dtu-donutTotal' }, compact(totalTokens)),
          h('div', { className: 'dtu-donutLabel' }, 'Tokens 用量'),
        ),
      )
    }

    // ── dashboard ───────────────────────────────────────────────────────────

    function DashboardBody() {
      const state = useStore()
      const [hovered, setHovered] = React.useState(null)

      const data = state.data
      const filter = state.filter
      const custom = filter.range === 'custom'
      const totals = data ? data.totals : null
      const days = data ? data.days : []
      const buckets = totals ? totals.buckets : [0, 0, 0, 0, 0]
      const topShare = totals && totals.totalTokens > 0 && data.models.length > 0 ? data.models[0].totalTokens / totals.totalTokens : 0

      const head = h(
        'div',
        { className: 'dtu-head' },
        h('div', { className: 'dtu-title' }, 'Token 用量'),
        h(
          'div',
          { className: 'dtu-controls' },
          h(ChipGroup, { items: RANGES, value: filter.range, onSelect: (range) => setFilter({ range }), label: '时间范围' }),
          h(ChipGroup, { items: SOURCES, value: filter.source, onSelect: (source) => setFilter({ source }), label: '会话来源' }),
          custom
            ? h(
                React.Fragment,
                null,
                h('input', {
                  className: 'dtu-date',
                  type: 'date',
                  value: filter.since,
                  'aria-label': '开始日期',
                  onChange: (event) => setFilter({ since: event.target.value }),
                }),
                h('span', { style: { color: 'var(--dsw-alias-label-secondary)' } }, '→'),
                h('input', {
                  className: 'dtu-date',
                  type: 'date',
                  value: filter.until,
                  'aria-label': '结束日期',
                  onChange: (event) => setFilter({ until: event.target.value }),
                }),
              )
            : null,
          h('button', { type: 'button', className: 'dtu-refresh', onClick: reload }, '刷新'),
        ),
      )

      let body
      if (state.status === 'error') {
        body = h('div', { className: 'dtu-note', 'data-tone': 'error' }, `读取失败：${state.error}`)
      } else if (state.status === 'waiting') {
        body = h(
          'div',
          { className: 'dtu-note' },
          '等待 Host 用量服务…（若长时间不变，按 Ctrl+Shift+I 看控制台报错）',
        )
      } else if (!data) {
        body = h('div', { className: 'dtu-note' }, '正在读取本地会话日志…')
      } else if (totals.totalTokens === 0 && totals.turns === 0) {
        body = h('div', { className: 'dtu-note' }, '该筛选条件下没有用量记录。')
      } else {
        body = h(
          React.Fragment,
          null,
          h(
            'div',
            { className: 'dtu-cards' },
            h(Card, {
              label: 'Tokens 用量',
              value: grouped(totals.totalTokens),
              sub: `未缓存输入 ${compact(buckets[0])} · 缓存读取 ${compact(buckets[2])} · 输出 ${compact(buckets[1])}`,
            }),
            h(Card, { label: '完成轮次', value: grouped(totals.turns) }),
            h(Card, { label: '请求数量', value: grouped(totals.requests), sub: '计费模型调用次数' }),
            h(Card, { label: '活跃天数', value: grouped(totals.activeDays), sub: `会话 ${grouped(totals.sessions)} 个` }),
            h(Card, {
              label: '平均缓存命中率',
              value: percent(totals.cacheHitRate),
              sub: '缓存读取 / (缓存读取 + 未缓存输入)',
            }),
            h(Card, {
              label: '最常用模型',
              value: totals.topModel ? shortRoute(totals.topModel) : '—',
              sub: totals.topModel ? `占比 ${percent(topShare)}` : null,
              title: totals.topModel ?? undefined,
            }),
          ),
          h(Section, { title: '活跃热力图' }, h(Heatmap, { days: data.days, first: days[0] ? days[0].day : null, last: days[days.length - 1] ? days[days.length - 1].day : null })),
          h(Section, { title: '按天 Token 趋势' }, h(TrendChart, { days: data.days, models: data.models })),
          h(
            Section,
            { title: '模型用量' },
            h(
              'div',
              { className: 'dtu-models' },
              h(Donut, { models: data.models, totalTokens: totals.totalTokens, selected: hovered, onSelect: setHovered }),
              h(
                'div',
                { className: 'dtu-rows' },
                data.models.map((model, index) =>
                  h(
                    'div',
                    { key: model.route, className: 'dtu-row', onMouseEnter: () => setHovered(model.route), onMouseLeave: () => setHovered(null) },
                    h(
                      'div',
                      { className: 'dtu-rowName', title: model.route },
                      h('span', { className: 'dtu-dot', style: { background: SERIES[index % SERIES.length] } }),
                      shortRoute(model.route),
                      h('span', { className: 'dtu-rowProvider' }, model.provider),
                    ),
                    h('div', { className: 'dtu-rowTotal' }, compact(model.totalTokens)),
                    h('div', { className: 'dtu-rowShare' }, totals.totalTokens > 0 ? percent(model.totalTokens / totals.totalTokens) : '0%'),
                  ),
                ),
              ),
            ),
          ),
        )
      }

      return h(
        'div',
        { className: 'dtu-root' },
        head,
        h(
          'div',
          { className: 'dtu-body' },
          body,
          h(
            'div',
            { className: 'dtu-foot' },
            h('span', null, `统计截至 ${new Date(data ? data.generatedAt : Date.now()).toLocaleString('zh-CN')}`),
            h('span', null, `数据源：本地会话日志（${data ? data.coverage.files : 0} 个文件，未联网）`),
            h(
              'span',
              null,
              data && data.card
                ? `侧边栏卡片：${data.card.blocks.map((block) => block.label).join(' + ') || '累计'}（在 设置 → 插件 → Token 用量 里调整）`
                : null,
            ),
            h(
              'span',
              { className: 'dtu-footEntry' },
              '来源按本地可观测信号推断：桌面端与网页端无法离线区分，二者同归「桌面·网页」；「命令行·机器人」指无客户端的会话。',
            ),
          ),
        ),
      )
    }

    // ── slot entries (each guarded) ─────────────────────────────────────────

    /** Central panel: a render failure must show text, never a blank seat. */
    function Dashboard(props) {
      return h(Boundary, { label: '中央看板' }, h(DashboardBody, props))
    }

    /** Sidebar footer card, guarded for the same reason. */
    function UsageEntry(props) {
      return h(Boundary, { label: '侧边栏卡片' }, h(SidebarEntry, props))
    }

    // ── wire contribution + slots ───────────────────────────────────────────

    const CONTRIBUTION = {
      package: REMOTE_PACKAGE,
      descriptors: [
        {
          id: `${REMOTE_PACKAGE}#${REMOTE_NAMESPACE}/summary`,
          service: REMOTE_SERVICE,
          namespace: REMOTE_NAMESPACE,
          method: 'summary',
          invocation: { kind: 'direct' },
          parameters: [
            {
              name: 'filter',
              wire: 'filter',
              source: 'json',
              codec: { mode: 'strict', typeSymbol: `${REMOTE_PACKAGE}#UsageFilter`, create: () => ({ parse: (value) => value }) },
              acceptsUndefined: true,
            },
          ],
          result: {
            mode: 'strict',
            typeSymbol: `${REMOTE_PACKAGE}#UsageSummary`,
            create: () => ({ parse: (value) => value }),
          },
        },
      ],
    }

    function apply(ctx) {
      const face = () => ({
        refresh: reload,
        open: () => ctx.get('layout')?.selectPanel(PANEL_ID),
        close: () => ctx.get('layout')?.selectPanel(null),
      })

      // Styles belong to the plugin fiber: registered once, removed on unload.
      ctx.effect(() => {
        const tag = document.createElement('style')
        tag.dataset.plugin = PANEL_ID
        tag.textContent = CSS
        document.head.appendChild(tag)
        return () => tag.remove()
      }, 'dsh-token-usage: styles')

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
              namespaceCtx.effect(() => () => {
                namespace = undefined
              }, 'dsh-token-usage: usage namespace')
            })
          })
          .catch((error) => {
            console.error('[dsh-token-usage] could not mount the usage remote:', error)
          })
        return () => {
          cancelled = true
          if (unmount) unmount()
        }
      }, 'dsh-token-usage: usage remote')

      // A window like "last 6 hours" slides even while nothing new is logged, and
      // a Config edit only reaches this half on the next call: refresh quietly.
      ctx.effect(() => {
        const timer = setInterval(() => {
          if (namespace) void load(snapshot.filter, { silent: true })
        }, REFRESH_MS)
        return () => clearInterval(timer)
      }, 'dsh-token-usage: refresh timer')

      ctx.slots.inject('main', () =>
        ctx.slots.register({ name: 'main', key: PANEL_ID, inject: face }, Dashboard),
      )
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
