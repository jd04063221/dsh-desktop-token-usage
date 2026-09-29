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
      config: null,
      configStatus: 'idle',
      configError: null,
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
          patch({ status: 'error', error: failureOf(response) || '用量服务返回了无法识别的响应' })
          return
        }
        patch({ status: 'ready', data: response.value, error: null })
      } catch (error) {
        if (mine !== ticket) return
        patch({ status: 'error', error: messageOf(error) })
      }
    }

    async function loadConfig() {
      if (!namespace) {
        patch({ configStatus: 'waiting' })
        return
      }
      patch({ configStatus: snapshot.config ? 'ready' : 'loading' })
      try {
        const response = await namespace.config()
        if (!response || response.ok !== true) {
          patch({ configStatus: 'error', configError: failureOf(response) || '配置读取失败' })
          return
        }
        patch({ configStatus: 'ready', config: response.value, configError: null })
      } catch (error) {
        patch({ configStatus: 'error', configError: messageOf(error) })
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
        await namespace.setConfig({ hours: next.hours, days: next.days })
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
.dtu-heatHead{display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between;margin-bottom:10px}
.dtu-heatControls{display:flex;flex-wrap:wrap;gap:12px;align-items:center}
.dtu-heatScroll{overflow-x:auto;padding-bottom:4px}
.dtu-heatInner{width:max-content}
.dtu-heatMonths{display:flex;gap:3px;height:15px;margin-bottom:4px;color:var(--dsw-alias-label-secondary);font-size:10.5px}
.dtu-monthSpace{width:22px;flex:none}
.dtu-monthCell{width:11px;flex:none;white-space:nowrap;overflow:visible}
.dtu-heatRows{display:flex;gap:3px}
.dtu-weekdays{display:flex;flex-direction:column;gap:3px;width:22px;flex:none;color:var(--dsw-alias-label-secondary);font-size:10px;line-height:11px}
.dtu-weekdays span{height:11px}
.dtu-heat{display:flex;gap:3px}
.dtu-week{display:flex;flex-direction:column;gap:3px}
.dtu-cell{width:11px;height:11px;border-radius:2px;background:var(--dsw-alias-bg-layer-2);position:relative;flex:none}
.dtu-cellFill{position:absolute;inset:0;border-radius:2px;background:var(--dsw-alias-brand-primary);display:block}
.dtu-heatScale{display:flex;align-items:center;gap:4px;color:var(--dsw-alias-label-secondary);font-size:11.5px}
.dtu-chart{position:relative;height:260px;margin-top:4px}
/* The cache-hit band shares the bar chart's plot insets, so the two columns line
   up; it carries its own 0-100% axis instead of a second scale on one plot. */
.dtu-chartHit{height:104px}
.dtu-bars{position:absolute;left:52px;right:44px;top:0;bottom:22px;display:flex;align-items:flex-end;gap:2px}
.dtu-col{flex:1 1 0;min-width:3px;display:flex;flex-direction:column;justify-content:flex-end;height:100%;position:relative}
.dtu-col:hover{outline:1px solid var(--dsw-alias-border-l2);outline-offset:1px;border-radius:2px}
.dtu-seg{width:100%}
.dtu-line{position:absolute;left:52px;right:44px;top:0;bottom:22px;pointer-events:none}
.dtu-line svg{width:100%;height:100%;display:block}
.dtu-axisX{position:absolute;left:52px;right:44px;bottom:0;height:18px;color:var(--dsw-alias-label-secondary);font-size:11px}
.dtu-axisX span{position:absolute;transform:translateX(-50%);white-space:nowrap}
.dtu-axisY{position:absolute;left:0;top:0;bottom:22px;width:50px;color:var(--dsw-alias-label-secondary);font-size:11px}
.dtu-axisY span{position:absolute;right:4px;transform:translateY(-50%);white-space:nowrap}
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
.dtu-form{display:flex;flex-direction:column;gap:10px;padding:12px 14px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-1);max-width:560px}
.dtu-formTitle{font-weight:600}
.dtu-hint{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.6}
.dtu-field{display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:13px}
.dtu-input{width:96px;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-primary);border-radius:6px;padding:4px 8px;font:inherit;text-align:right}
.dtu-input:disabled{opacity:.55}
.dtu-formActions{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.dtu-save{appearance:none;border:1px solid var(--dsw-alias-brand-primary);background:var(--dsw-alias-brand-primary);color:var(--dsw-alias-bg-base);font:inherit;font-weight:600;padding:5px 16px;border-radius:8px;cursor:pointer}
.dtu-save:disabled{opacity:.5;cursor:default}
.dtu-formStatus{color:var(--dsw-alias-label-secondary);font-size:12px}
.dtu-formStatus[data-tone="error"]{color:var(--dsw-alias-state-error-primary)}
/* The seat lays every occupant on one horizontal line, yet every plugin in it
   declares width:100% — so they can never share it, and each one ends up
   squeezed against its neighbours. The :has() selector addresses the seat by its
   child, which keeps this independent of DSH's hashed class names; the wrap then
   gives every occupant the full-width row it was written for. */
:has(> .dtu-footCard){flex-wrap:wrap}
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
        console.error('[dsh-desktop-token-usage] render failed:', error, info)
      }

      render() {
        const error = this.state.error
        if (error) {
          const message = error && error.message ? error.message : String(error)
          return h(
            'div',
            { className: 'dtu-note', 'data-tone': 'error' },
            `dsh-desktop-token-usage 渲染失败（${this.props.label}）：${message}`,
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
        label: '累计',
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
      const card = state.data ? state.data.card : null
      const blocks = card ? card.blocks : []
      const all = card ? card.all : state.data ? cumulativeBlock(state.data.totals) : null
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
      } else if (!state.data) {
        body = h('div', { className: 'dtu-windowMeta' }, '正在读取本地会话日志…')
      } else if (blocks.length > 0) {
        body = blocks.map((block) => h(CardWindow, { key: block.id, block }))
      } else if (!all) {
        body = h('div', { className: 'dtu-windowMeta' }, '该筛选条件下没有用量记录。')
      } else {
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

    // ── configuration form ──────────────────────────────────────────────────

    /** `近 6 小时 + 近 7 天`, or `累计` when both windows are off. */
    function describeWindows(config) {
      const parts = []
      if (config.hours > 0) parts.push(`近 ${config.hours} 小时`)
      if (config.days > 0) parts.push(`近 ${config.days} 天`)
      return parts.length > 0 ? parts.join(' + ') : '累计'
    }

    /**
     * The plugin's own configuration card. DSH renders no editor from a Config
     * schema — a plugin that has configuration draws it itself into
     * `plugins.bundle.config`, keyed by its package name, and saves through the
     * Loader's config editor on the Host.
     */
    function ConfigForm() {
      const state = useStore()
      const [draft, setDraft] = React.useState(null)
      const current = state.config ?? { hours: 0, days: 0, writable: false }
      const values = draft ?? { hours: current.hours, days: current.days }
      const busy = state.configStatus === 'saving'
      const locked = busy || current.writable === false
      const edit = (key, raw) => {
        const parsed = Number.parseInt(raw, 10)
        setDraft({ ...values, [key]: Number.isFinite(parsed) ? parsed : 0 })
      }
      return h(
        'div',
        { className: 'dtu-form' },
        h('div', { className: 'dtu-formTitle' }, '看板「配置窗口」的时间跨度'),
        h(
          'div',
          { className: 'dtu-hint' },
          '0 表示关闭该窗口；两个都关闭时只显示累计值。窗口按本地时间取整到小时，保存后立即生效；它们不随看板上方的来源筛选变化。',
        ),
        h(
          'label',
          { className: 'dtu-field' },
          h('span', null, '最近多少小时（0-23）'),
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
          h('span', null, '最近多少天（0-30）'),
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
          'div',
          { className: 'dtu-formActions' },
          h(
            'button',
            { type: 'button', className: 'dtu-save', disabled: locked, onClick: () => void saveConfig(values) },
            busy ? '保存中…' : '保存',
          ),
          h('span', { className: 'dtu-formStatus' }, `当前：${describeWindows(current)}`),
        ),
        state.configError
          ? h('div', { className: 'dtu-formStatus', 'data-tone': 'error' }, state.configError)
          : null,
        current.writable === false && state.configStatus !== 'loading'
          ? h(
              'div',
              { className: 'dtu-formStatus', 'data-tone': 'error' },
              '这个 profile 没有提供配置编辑器，请改 profile 的 cordis.patch.yml。',
            )
          : null,
      )
    }

    // ── charts ──────────────────────────────────────────────────────────────

    const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日']
    const HEAT_LEVEL_OPACITY = [0, 0.3, 0.5, 0.75, 1]
    const HEAT_METRICS = [
      { id: 'tokens', label: 'Tokens' },
      { id: 'turns', label: '轮次' },
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
      const scope = heatmap ? `近 ${weeks} 周` : '当前筛选'
      const today = Date.now()
      const firstWeek = weekStartOf(today - (weeks - 1) * 7 * DAY_MS)
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
              monthLabel = `${month + 1}月`
              previousMonth = month
            }
          }
        }
        columns.push({ key: `w${week}`, days, monthLabel })
      }

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
      const metricLabel = metric === 'tokens' ? 'tokens' : '轮'

      return h(
        'div',
        null,
        h(
          'div',
          { className: 'dtu-heatHead' },
          h(
            'div',
            { className: 'dtu-legend' },
            h('span', null, `${scope}共 ${values.length} 天有活动 · 合计 ${metric === 'tokens' ? compact(total) : grouped(total)} ${metricLabel}`),
          ),
          h(
            'div',
            { className: 'dtu-heatControls' },
            h(ChipGroup, { items: HEAT_METRICS, value: metric, onSelect: setMetric, label: '热力图指标' }),
            h(
              'div',
              { className: 'dtu-heatScale' },
              h('span', null, '较少'),
              [1, 2, 3, 4].map((level) =>
                h(
                  'span',
                  { key: level, className: 'dtu-cell' },
                  h('span', { className: 'dtu-cellFill', style: { opacity: HEAT_LEVEL_OPACITY[level] } }),
                ),
              ),
              h('span', null, '较多'),
            ),
          ),
        ),
        h(
          'div',
          { className: 'dtu-heatScroll' },
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
                WEEKDAY_LABELS.map((label, index) => h('span', { key: label }, index % 2 === 0 && index < 5 ? label : '')),
              ),
              h(
                'div',
                { className: 'dtu-heat' },
                columns.map((column) =>
                  h(
                    'div',
                    { key: column.key, className: 'dtu-week' },
                    column.days.map((day) => {
                      const entry = day.entry
                      const value = day.value
                      return h(
                        'div',
                        {
                          key: day.key,
                          className: 'dtu-cell',
                          title: entry
                            ? `${day.key} · ${grouped(entry.tokens)} tokens · ${entry.turns} 轮 · ${entry.requests} 次请求`
                            : day.key,
                        },
                        levelOf(value) > 0
                          ? h('span', { className: 'dtu-cellFill', style: { opacity: HEAT_LEVEL_OPACITY[levelOf(value)] } })
                          : null,
                      )
                    }),
                  ),
                ),
              ),
            ),
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
      const hitPoints = columns
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
            '缓存命中率（下图）',
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
        ),
        hitPoints
          ? h(
              'div',
              { className: 'dtu-chart dtu-chartHit' },
              h(
                'div',
                { className: 'dtu-grid' },
                ticks.map((tick) => h('div', { key: tick, className: 'dtu-gridline', style: { top: `${tick * 100}%` } })),
              ),
              h(
                'div',
                { className: 'dtu-axisY' },
                ticks.map((tick) => h('span', { key: tick, style: { top: `${tick * 100}%` } }, `${Math.round((1 - tick) * 100)}%`)),
              ),
              h(
                'div',
                { className: 'dtu-line' },
                h(
                  'svg',
                  { viewBox: '0 0 100 100', preserveAspectRatio: 'none' },
                  h('polyline', {
                    points: hitPoints,
                    fill: 'none',
                    stroke: 'var(--dsw-alias-state-warn-primary)',
                    strokeWidth: 1.5,
                    vectorEffect: 'non-scaling-stroke',
                  }),
                ),
              ),
              h(
                'div',
                { className: 'dtu-axisX' },
                labelled.map((index) =>
                  h('span', { key: index, style: { left: `${((index + 0.5) / columns.length) * 100}%` } }, columns[index].day.slice(5)),
                ),
              ),
            )
          : null,
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
          // The configured windows are wall-clock recency figures: the Host
          // builds them from `{root, useCache, now}` alone, so unlike every other
          // section here they do not follow the source filter. Say so.
          data.card
            ? h(
                Section,
                {
                  title: '配置窗口',
                  extra: h(
                    'span',
                    { className: 'dtu-hint' },
                    '固定回溯窗口，不随上方来源筛选变化；在 插件 → Token 用量 里调整',
                  ),
                },
                h(
                  'div',
                  { className: 'dtu-cards' },
                  (data.card.blocks.length > 0 ? data.card.blocks : data.card.all ? [data.card.all] : []).map((block) =>
                    h(Card, {
                      key: block.id,
                      label: block.label,
                      value: grouped(block.totalTokens),
                      sub: `输入 ${compact(block.inputTokens)} · 输出 ${compact(block.outputTokens)} · 缓存命中 ${percent(block.cacheHitRate)} · ${grouped(block.turns)} 轮`,
                    }),
                  ),
                ),
              )
            : null,
          h(
            Section,
            { title: '活跃热力图', extra: h('span', { className: 'dtu-hint' }, '跟随来源筛选；日历始终显示完整历史') },
            h(Heatmap, { heatmap: data.heatmap, days: data.days }),
          ),
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

    /** Sidebar foot card, guarded for the same reason. */
    function UsageEntry(props) {
      return h(Boundary, { label: '侧边栏卡片' }, h(SidebarEntry, props))
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
