# Changelog

English | [中文](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/CHANGELOG-zh.md)

This file documents all notable changes to `dsh-desktop-token-usage`.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the version numbers follow [Semantic Versioning](https://semver.org/).

> **Upgrade note**: This plugin is a DSH bundle that loads in two halves. `client.js` (the UI) is hot-reloaded by the browser,
> while `index.js` / `lib/*` (the Host) **caches the JS module generation it has already imported** inside the DSH process — re-enabling
> the plugin is not enough, and neither is changing the specifier, reinstalling, or even renaming the package (Node caches ESM by realpath):
> DSH must be restarted once before the new code is loaded. To tell which generation is running, check whether `Config.listConfigs`
> reports `schema` or `absent` for this plugin, together with whether the process has been restarted since your change; `boot.json`
> is rewritten by every `apply`, so its existence only tells you when the fiber was last remounted.

## [0.1.4] - 2026-09-30

### Changed

- **The sidebar card now gets a full-width line of its own in the footer seat.** `sidebar.footer.action` is a single
  horizontal row (`display: flex`) and on a stock install `dsh-opencode-go-usage`, the Cordis badge and
  `commandcode-panel` sit in it too — and every one of them declares `width: 100%`, so none of them can share the row.
  Measured in a live 0.2.0-rc.2 window, with nothing intervening this plugin's card is squeezed to **105.2px** while its
  neighbour takes 150.8px, and the three sets of labels run into each other. The card now turns the **seat into a
  column** (`[class*="_footerActions"]:has(.dtu-footCard)`), so every occupant gets the full-width line it was written
  for: the card spans the whole **256px**. Matching on the class suffix plus `:has()` keeps it independent of DSH's
  hashed class names and keeps it off every ancestor — forcing a direction on the shell's own row containers would stack
  the sidebar above the main panel. It is `flex-direction` rather than `flex-wrap` for two reasons: the shell wraps each
  slot in a `display: contents` element, so a direct-child selector never matches the seat; and on a **column** seat
  `flex-wrap` means "start another column" — measured, that puts the card beside its neighbour and widens the sidebar to
  387.8px, overflowing it. This needs `:has()`, which is why the compatibility table below now records the bundled
  Chromium.
- **The same windows are shown in the dashboard too**, in a `配置窗口` row: label, total, input/output split, cache hit
  rate and turns. They are wall-clock recency — the Host builds them from `{root, useCache, now}` alone — and
  deliberately ignore the source filter, so that row says so instead of sitting among the filter-following stat cards.
  With both windows off it falls back to a single cumulative card.
- **The per-day trend no longer puts two scales on one plot.** The cache hit rate was a line drawn over the token bars
  with its own 0-100% right-hand axis; since it normally sits above 90%, the line floated along the top of the plot
  with no visible relation to the bars under it. The hit rate is already given per window in the stat cards and the
  `配置窗口` row, so that curve is gone: the chart now overlays the **daily token total** on the bars instead, sharing
  the one left-hand token axis, its vertices landing on each stacked column's top so the composition and the trend read
  together. Days with no usage drop the line to the baseline, which makes the empty-then-spike shape clearer. The
  legend's hit-rate entry became `每日合计`.
- **The curve flows instead of cornering.** Neighbouring days are joined by a **monotone cubic** (Fritsch-Carlson)
  interpolation, so the tangent is continuous at every data point. Monotone rather than a plain spline on purpose: a
  plain spline overshoots between points, and right next to a day with no usage that means dipping below the axis.
- **Writes are atomic, bounded, and switchable off.** Both writers now write a `<name>.<pid>.tmp` sibling and rename it
  over the target, so a concurrent reader never sees a partial file and a killed process cannot leave a truncated one.
  The session index is capped at 800 entries (oldest dropped, re-scanned on demand) and any `.tmp` a crash left behind
  is swept on the next write. The Host's diagnostics (`calls.json`, `boot.json`) can be turned off entirely with
  `DSH_TOKEN_USAGE_DIAG=0`. Everything is written inside `$DSH_HOME/cache/dsh-desktop-token-usage/`; the README now
  documents each file, what it is for, and how to turn it off.
- **Compatibility is declared for DSH Desktop 0.2.0-rc.1.** The plugin still declares no `@deepseek-ai/dsh*` peer
  dependency, which is what DSH actually validates; `engines.dsh` is widened to `^0.1.7-rc.2 || ^0.2.0-rc.1` for
  readers only. Every published package this plugin touches was diffed across the two releases: `dsh-plugin-manager`
  is byte-identical, and `dsh-client-ui-sidebar`, `dsh-client-ui-layout` and `dsh-client-ui-cordis` differ only in the
  version string, one analytics call and title-bar CSS. The slot contract is unchanged.

### Note

- The entry briefly moved to `sidebar.panellist`, which gives a full-width row the sidebar owns — but that seat renders
  an icon and a label only, so the usage numbers the card exists to show would have had nowhere to go. It came back.

## [0.1.3] - 2026-09-28

### Changed

- **CI now publishes through Trusted Publishing (OIDC); the repository no longer stores an npm token.** The
  workflow drops `NODE_AUTH_TOKEN`, adds `id-token: write`, and upgrades npm on the runner (Node 22 ships an npm
  older than the 11.5.1 that trusted publishing requires). Provenance attestations are generated automatically,
  and the `NPM_TOKEN` repository secret is no longer referenced.

## [0.1.2] - 2026-09-28

### Changed

- **The package name dropped its scope**: `@jd04063221/dsh-desktop-token-usage` → `dsh-desktop-token-usage`.
  Versions 0.1.0 and 0.1.1 were scoped packages; the scoped name is deprecated and now points here. An unscoped
  name needs no matching npm scope, so the install command is shorter and publishing no longer depends on owning one.
  Updated in step: the Host's `REMOTE_PACKAGE`, the Client module `id`, and the row `name` in `cordis.patch.yml`.
  The row `id` and the `PANEL_ID` slot key already were the unscoped string, so no profile configuration had to be
  migrated this time.

### Note

- The GitHub repository name was already `dsh-desktop-token-usage`, so neither the repository URL nor the release
  tags needed changing.

## [0.1.1] - 2026-09-28

### Fixed

- **The npm page rendered the Chinese README by default.** npm 11 picks the readme in
  `@npmcli/package-json/lib/normalize.js` by globbing `{README,README.*}` and taking the first markdown-looking
  match; on this machine that glob returned `README.zh.md`, so the packument's `readme` field held the Chinese
  document. The Chinese docs are now named `README-zh.md` and `CHANGELOG-zh.md` (a hyphen is not part of that
  glob, so only `README.md` can be selected).

### Changed

- The language switcher links at the top of both documents are absolute GitHub URLs: a relative link cannot be
  opened from the npm package page, because npm does not serve repository files as pages. Absolute URLs work on
  both GitHub and npm.

### Added

- A GitHub Actions publish workflow (`.github/workflows/publish.yml`): pushing a `v*` tag publishes to npm,
  a manual run defaults to the dry run, and a tag push is checked against the `version` in `package.json`.
  Authentication uses the `NPM_TOKEN` repository secret (a granular access token with bypass 2FA enabled).

## [0.1.0] - 2026-09-27

First release: fully offline token usage statistics, with all data taken from the session logs under the local `$DSH_HOME/sessions`.

### Added

**Statistics and data layer**

- Reads `session.vN.jsonl.zstd`: these files are containers in which **multiple zstd frames are concatenated end to end**. Node's
  decompression API only decodes the first frame, so the code locates frame boundaries with a structural scan (without decompressing) following
  the official `scanZstdFrames`, then decompresses frame by frame and parses line by line.
- `(turn, step)` **folding** semantics: within the same slot a later usage record replaces the earlier one, and accumulation only
  starts after `llm/retry-started`; `reasoningTokens` is treated as a subset of `outputTokens` and is not counted twice.
- The index is bucketed by **local hour** and cached incrementally by file `mtime+size`, persisted to
  `$DSH_HOME/cache/dsh-desktop-token-usage/sessions-index.json`.
- Session origin inference: `客户端（桌面·网页）` (desktop · web) / `命令行·机器人` (CLI · bot) / `子代理` (subagent) — the logs contain no client-origin
  field, so the origin can only be derived from `origin`, `delegationDepth`, and the `source.rpcId` of the user turn.

**Interfaces**

- Exposes three Remotes over the official Typert channel: `dshUsage/summary` (usage summary), `dshUsage/config`
  (reads the card window, including `writable`), and `dshUsage/setConfig` (writes back to the profile patch through the official `configEditor`).

**User interface**

- Sidebar footer card (`sidebar.footer.action`): shows the "last N hours" / "last N days" window or the cumulative value depending on
  configuration; each window displays the **input volume** (uncached input + cache reads), the **output volume**, and the **cache hit rate**.
- Central dashboard (the `main` panel): time range and origin filters, 6 statistic cards, an activity heatmap,
  a daily token trend (stacked by model plus a cache hit rate line), a model usage donut chart, and a share list.
- Activity **calendar**: Monday-aligned over the last 53 weeks, with month headers and weekday coordinates, and cells fixed at 11px;
  a control at the top switches between **Tokens / turns**, defaulting to whichever dimension has more days with data.
- Plugin page configuration form (`plugins.bundle.config`): `hours` (0-23) and `days` (1-30), where `0` disables that window.
- The entire UI depends only on React and the `--dsw-alias-*` theme tokens, and references no `@deepseek-ai` client package.

**Diagnostics**

- `boot.json`: the Host activation chain (apply / typert injection / service provision / descriptor registration) and the effective window configuration.
- `calls.json`: the last 20 dashboard invocations (filters, windows, session count, total tokens, elapsed time).

### Fixed

- **Remote return values were treated as payloads**: the real shape is `{ ok, value }` / `{ ok: false, error }`, where failure is a value rather than an exception.
  The original code left `data.totals` as `undefined`, which made the entire dashboard throw and render blank while the sidebar card showed only `0`.
- **Dashboard height collapse**: `.dtu-body` used `flex:1 + min-height:0`, which was clipped whenever the parent container height was
  indeterminate and collapsed to a height of 0; reverted to `display:block + height:100% + overflow:auto`, with the header made sticky.
- **Heatmap cells stretched**: `grid-auto-columns` expands tracks to fill the container width, stretching the 11px squares into wide bars; switched to a flex layout.
- **Heatmap color scale failed**: it previously bucketed by "day ÷ maximum", so a single exceptionally large day pushed everything else into the same
  bucket; switched to quartiles over non-zero days.
- **Added a rendering error boundary**: any rendering exception inside a slot now shows a text explanation instead of a blank block.
- **Tests overwrote production diagnostic files**: the `apply` in `npm test` wrote the real `boot.json` / `calls.json`,
  while the README specifically teaches people to read those two files to tell "which generation of Host is currently running". The diagnostics directory
  can now be overridden with the `DSH_TOKEN_USAGE_DIAG_DIR` environment variable, and the test suite points at a temporary directory automatically, so it no longer pollutes production files.
- **Tests racing the session log writer**: assertions such as "per-day ranges partition the total" failed intermittently
  whenever the running session appended a record (observed gap: 157,951 tokens, with the per-day sum coming out *larger*
  than the snapshot total). Those windows now share an upper bound pinned to the **start of the current hour** — hour
  filtering is per bucket, so pinning "now" would not help: records written later into the current hour bucket still count.
  The heatmap deliberately ignores the time range, so it now compares the stable date grid instead, with a single re-read
  when summing across snapshots.

### Changed

- Index buckets changed from days to **local hours** (`CACHE_VERSION` 1 → 2, which rebuilds the index once on first start),
  making windows such as "the last few hours" possible; the dashboard's daily chart is merged from the hourly buckets by the Host.
- Heatmap data is independent of the time range (the `summary` response gained a `heatmap` field, which still follows the origin filter):
  a calendar filtered down to 7 days would mean "7 lit cells in a one-year grid", which is not what a heatmap should mean.
- Configuration values are persisted to the profile's `cordis.patch.yml` through the official `configEditor`, not to the plugin's own files.
- Introduced the single `@deepseek-ai/*` dependency `@deepseek-ai/schemastery` (required by the official `Config` card).

### Release preparation (npm)

- **Package name, row id and repository name unified as `@jd04063221/dsh-desktop-token-usage`** (the scope was dropped in 0.1.2):
  this plugin only targets **DSH Desktop** (its data comes from Desktop's `$DSH_HOME/sessions`), so the name carries `desktop` to keep it
  apart from any other surface. Updated together: the package name, the Host's `REMOTE_PACKAGE`, the Client module `id` (the official
  convention is that a module's `id` is its package name — see `dsh-api-remotes/lib/client.js`), the row `name` **and** row `id` in
  `cordis.patch.yml`, the configuration card's slot key (`plugins.bundle.config` is keyed by the **package name**), the diagnostics and
  index-cache directory, and the GitHub repository URL.
- **Missing any one of these fails silently**: the module `id` and the config-card key must equal the package name, and the row `name` must be
  the exact package name installed into the profile. The row `id` is also the anchor for a profile's `- id: …` configuration override —
  changing it means migrating that override, or the saved `hours`/`days` stop applying (migrated here). When recognizing its own Loader entry
  the Host matches both the **package name** and the **row id**, so a legacy row can still read and write configuration (covered by a test).
- Removed `private: true` and added `author` / `repository` / `homepage` / `bugs` / `keywords` /
  `publishConfig.access=public` (scoped packages default to restricted) / `engines.dsh` (declarative; DSH does not enforce it) / `prepublishOnly: npm test`,
  plus a new MIT `LICENSE`.
- ⚠️ **`jd04063221` in `name` / `author` / the repository URLs is a placeholder username**: it must be replaced with your own npm scope and GitHub username before publishing
  (see "Publishing to npm" in the README for the item-by-item list).

### Compatibility and fallbacks

- **A Client newer than the Host** is the normal state (the former hot-reloads, the latter needs a restart), so every missing field has a fallback:
  when `card` is absent, the cumulative block is computed on the fly from `totals`; when `heatmap` is absent, the calendar is filled from the `days` of the current
  filter range, and the heading wording changes accordingly.
- When the profile does not provide `configEditor`, the configuration form becomes **read-only** with an explanation of the reason, and the write interface reports an explicit error.

### Documentation

- `README.md` (English, the default) / `README-zh.md` (Chinese): installation, usage, configuration options,
  the token accounting table, the limits of origin inference, known limitations, and a troubleshooting order,
  with the two top-of-file switchers linking to each other.
- `docs/DESIGN.md`: the data contract, the key trade-offs, and the pitfalls encountered (multi-frame zstd, the envelope, module generation caching, the configuration page mechanism, and so on).
- `docs/research/`: early research notes and reusable session-log probe scripts.
- `docs/` is not published: the `files` whitelist now carries an explicit `!docs` entry (npm's `files` does
  support negation, while a root `.npmignore` cannot override `files`, so negation is the form that works).
- Research notes redacted: machine paths such as `C:\Users\<user>` are written as `%USERPROFILE%` / `$DSH_HOME`,
  real records quote the user directory as `<user>`, and the convention is stated at the top of the document.

### Known limitations

- Desktop and web **cannot be distinguished** in local data and are merged into "desktop · web".
- Window granularity is rounded to the hour (the logs contain no minute-level markers).
- The card has no push channel and relies on a silent refresh every 5 minutes; to see a configuration change immediately, open the dashboard and click "Refresh".
- Imported historical sessions (such as the reasonix migration) all have a usage of 0; this is valid data and is not estimated.

### Compatibility

- **Tested environment: DSH Desktop `0.1.7-rc.2`** (`@deepseek-ai/dsh-desktop@0.1.7-rc.2`), Windows 11 Pro
  build 26200 (AMD64), Node v25.2.1. Plugin activation, the sidebar card, the dashboard, the plugin page configuration card, browser → Host RPC,
  and a field-by-field reconciliation of the numbers against DSH's own projection cache all passed verification — normal use on 0.1.7-rc.2 is guaranteed.
- `engines.dsh` is declared as `^0.1.7-rc.2` (previously `>=0.1.7-rc.2`, which amounted to claiming compatibility with 0.2/1.0 as well, without evidence).
  The field is **declarative**: the official documentation states plainly that declaring a range does not reject incompatible hosts.
- Earlier DSH releases may not have the `plugins.bundle.config` slot and the `configEditor` service this plugin uses; newer versions have not been tested.
- The measured conclusion is also written into two display texts: the `description` in `package.json` and the locale's `meta.description`.
  The reason is that the plugin list interface (`listBundles`) passes the **file URL** of `package.json` to `readPluginMeta`,
  and the official documentation says "File paths and file URLs return no metadata", so only the `package.json` description takes effect on that path
  (as measured: every bundle in the list has only a `description` and no `meta`); the locale entry is used by UI paths that can resolve metadata by package name.

### Verification

- The folding result matches DSH's own projection cache field by field (`session-5964a5d3-*`: `286650 / 182633 / 43826560 / 0`).
- The summary is self-consistent: the day/model dimensions re-add to the total; the daily and hourly millisecond intervals partition the total exactly;
  the calendar partitions exactly by origin; every window summary is ≤ the cumulative value; `hours=99` / `days=-3` are clamped.
- The wire descriptors on both sides match field by field (three endpoints), and the parameter codec accepts the values the browser actually sends.
- Rendering passes with a fake React/DOM in an environment with no browser (covering both card forms, the configuration form, the calendar structure, and both fallbacks).
- After installation, `fiberPhase: active`, and both `sidebar.footer.action` and `main` are registered.
- 23 tests in total, with `npm test` fully green. **The visual appearance and the final numbers require manual confirmation** (this environment has no browser control).

---

## Appendix: commit index

Release 0.1.0 consists of the following commits (`git log --reverse`, up to `2b4be69`):

| Commit | Time | Content |
|---|---|---|
| `9b46227` | 15:01 | Host-side token aggregation over local session logs and the usage Remote interfaces |
| `3b63332` | 15:02 | Sidebar usage card and central token dashboard |
| `5407357` | 15:02 | Aggregation golden reconciliation and browserless client smoke tests |
| `6d6408e` | 15:02 | README, design notes, and early research notes |
| `7d66caa` | 15:58 | Fixed the `{ok,value}` envelope and the panel height collapse |
| `61f272d` | 16:04 | Host activation chain tracing and troubleshooting docs |
| `5ad18db` | 16:48 | Official Config configuration card window, index refined to hours |
| `dda8906` | 16:49 | Corrected the notes on how configuration takes effect (config changes go through `fiber.restart`) |
| `3a593c5` | 16:58 | Client falls back to the cumulative value when the Host lacks `card` |
| `2ae0a20` | 19:00 | Built-in configuration form on the plugin page (hours/days) |
| `e104dc2` | 19:31 | Reworked the activity heatmap (calendar semantics, axes, quantile color scale, metric toggle) |
| `2b4be69` | 09:20 | Changed the package name to a scoped one and completed the npm publishing metadata (release preparation) |
