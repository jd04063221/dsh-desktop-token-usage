# 變更日誌

[English](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/CHANGELOG.md) | [中文](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/translations/CHANGELOG-zh.md) | [繁體中文（臺灣）](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/translations/CHANGELOG-zh-TW.md) | 繁體中文（香港） | [Deutsch](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/translations/CHANGELOG-de.md) | [Français](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/translations/CHANGELOG-fr.md) | [Español](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/translations/CHANGELOG-es.md) | [Italiano](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/translations/CHANGELOG-it.md) | [日本語](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/translations/CHANGELOG-ja.md) | [한국어](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/translations/CHANGELOG-ko.md)

本文件記錄 `dsh-desktop-token-usage` 的所有重大變更。
格式遵循 [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)，版本號遵循 [Semantic Versioning](https://semver.org/)。

> **升級提示**：本插件是一個分兩半載入的 DSH bundle。`client.js`（介面）由瀏覽器熱重載，
> 而 `index.js` / `lib/*`（Host）會在 DSH 進程內**快取它已導入的 JS 模組代**——僅重新啟用
> 插件不夠，改動說明符、重新安裝甚至重新命名套件也不夠（Node 按 realpath 快取 ESM）：
> 必須重啟一次 DSH，新程式碼才會載入。要判斷當前運行的是哪一代，看 `Config.listConfigs`
> 對本插件回報的是 `schema` 還是 `absent`，並結合改動之後進程是否重啟過；`boot.json`
> 每次 `apply` 都會重寫，所以它的存在只告訴你 fiber 最近一次重新掛載的時間。

## [Unreleased]

### 新增

- **本地化（i18n）**：儀表板現在**跟隨 DSH 自身的語言設定**——它沒有自己的選擇器，
  在 DSH 裡切換語言，儀表板立即跟著切換，無需重新載入。這裡提供十種語言：
  `en` 與 `zh` 透過 DSH 內建字典，加上本插件註冊進 DSH 目錄的 `zh-TW`（臺灣正體）、`zh-HK`（香港繁體）、`de`、`fr`、
  `es`、`it`、`ja` 與 `ko` 語言包。數字、百分比、日期、星期與月份名稱以及複數形式全部來自 `Intl`，
  因此千分位、在英文寫 `K`/`M`/`B` 的地方寫 `萬`/`億`，以及每種語言自己的複數類別都會正確顯示。文案放在 `locales/<id>.json`
  裡，由 [`scripts/build-dicts.mjs`](../scripts/build-dicts.mjs) 生成進 client bundle：生成塊
  絕不能手改，它過期時會有測試失敗。 `translations/README-<id>.md` 與 `translations/CHANGELOG-<id>.md`
  以每種已推出的語言提供這兩份文檔。注意：選擇語言包後，**DSH 自身的介面**仍停留在
  `zh`/`en`——只有本插件會切換。

### 修正

- **趨勢提示框讀起來像熱力圖的**：標題不再把日期黏在 token 總量上——日期
  獨立成行，總量則是自己的一行 `Tokens`（緊湊格式），一行就是一個數字。
- **提示框內部不再換行**：框跟隨其內容（`width:max-content`），並掛在
  滑過的欄位上——左半邊靠左錨定、右半邊靠右錨定——而不是在一個被鉗制的框裡置中；
  像 `deepseek-v4.1-flash` 這樣長的模型名稱會在一行內以省略號收尾，而不是被擠到第二行。

### 計劃中

- **本地化，剩餘梯隊**：六個語言代碼 `pt-BR`、`ru`、`vi`、`th`、`id` 與 `ar` 已設計
  但尚未實現。`ar` 還需要從右到左的外殼——鏡像的內縮、提示框與軸的一側，同時
  時間軸保持從左到右——這是已推出的十種語言都不需要的。見
  [設計稿](../docs/superpowers/specs/2026-10-01-i18n-design.md)。

## [0.1.5] - 2026-10-01

### 新增

- **分組選項**：按實際模型（同名模型跨供應商合併）、按 API 供應商，或兩者都要。選「兩者都要」時，
  趨勢部分與拆分部分各帶自己的 chip，可獨立切換。
- **配色選項**：`primer`（GitHub 預設）、`cvd`（Okabe-Ito，色盲友好）或 `muted`（低飽和），
  每套都附帶亮色與暗色兩組變量，自動跟隨系統主題。

### 變更

- **命中率曲線疊加在柱上**：token 堆疊柱與緩存命中率曲線共用一張圖（曲線按統計期的 min−10% span ~ max+10% span
  映射到繪圖區，右側標示真實百分比），而不再各自佔一條。
- **命中率曲線的 Y 軸由數據決定**：統計期的 min/max 決定範圍，兩端各留 10% 的跨度；曲線保持單調三次插值。
- **命中率語義**：未命中現在包含 cacheWrite（hit / (hit + miss)），與官方定義一致；本機 cacheWrite 恆為 0，
  因此沒有任何數字改變。

### 修正

- **圖表配色跟隨 DSH 自己的主題開關**，而不是作業系統的：DSH 用 `body[data-ds-dark-theme]` 標記暗色，
  亮色模式下 `<body>` 不帶該屬性，所以配色現在讀取那個標記（透過 `light-dark()` + `color-scheme`）
  而不是 `prefers-color-scheme`。亮色桌面上的深色外殼過去會讓所有圖表保持亮色——深色桌面上的亮色外殼則相反。
- **一個模型一行**：各供應商對模型 id 的寫法不一致——`commandcode` 回報 `deepseek/deepseek-v4.1-flash`，
  而 `opencode-go` 回報 `deepseek-v4.1-flash`，按模型視圖把同一個模型列了兩次。按模型的鍵現在是 id 的末段；
  按供應商視圖仍把兩者分開。
- **活動熱力圖填滿整行**：固定的 53 週不再停在卡片中途。全部 53 欄現在按一個 11px 的基準共享可用寬度
  （格子保持正方形，月份軸與星期帶隨之伸縮）；只有窄到放不下 11px 格子的卡片才會回退為捲動，
  而且捲動會開在最新的一週，而不是最舊的（本機上是空的）那些。圓角改為格子的 24% 而不是固定的 2px，
  切換配色或指標會在 0.18s 交叉淡入淡出，滑過某天會透過 `filter: brightness()` 提亮
  （沒有佈局位移、沒有重排），`prefers-reduced-motion` 會關掉過渡。
- **熱力圖的三處可讀性修正**：沒有活動的一天保留 1px 的 step-0 細線而不是實心色塊
  （一旦日曆鋪滿卡片，一面實心灰牆會被讀成數據）；今天以雙色內嵌圓環標記（外圈面板色、內圈標籤色），
  在最淺與最深的色階上都清晰可見；滑過某天現在會喚出儀表板自己的提示框——與趨勢圖顯示的同一個框，
  按欄位中心的一部分鉗制在繪圖區內，排成四行：日期 / Tokens / 輪次 / 請求，其中 token 數字使用與統計卡
  和趨勢提示框相同的緊湊格式（`1.45亿` 而不是 `145,156,311`，因此任何 token 數都不會把框撐寬）——
  取代原本延遲出現、無法樣式化的原生 `title`。整個日曆**左右各留 15px 置中**，其 53 欄共享餘下的寬度，
  因此現在**完全不捲動**——捲動框消失了。底部那條橫桿一直以來其實就是懸停框：token 數字一長，
  就比它為之鉗制的 160px 最小寬度更寬，於是在邊緣欄位它會戳出捲動框，差一個像素就露餡。
  框現在會避開它靠近的那一側——左半邊的欄位靠左對齊並向右生長，右半邊的欄位靠右對齊並向左生長——
  `max-width:calc(50% - 25px)` 保證欄位跨度的一半裝得下整個框。它在任何寬度下都不會越過日曆，
  而且不需要測量自身寬度就能保證這一點。
- **儀表板頁腳一行只讀一件事。** 三個長度差異極大的 flex 項目換行成一段參差不齊的文字，
  長註釋還在一個「…」術語中間斷開；現在每個加引號的術語都不可斷行。

## [0.1.4] - 2026-09-30

### 變更

- **側邊欄卡片現在在頁腳席位中擁有自己的整行。** `sidebar.footer.action` 是單一條橫向行（`display: flex`），
  在全新安裝上 `dsh-opencode-go-usage`、Cordis 徽章與 `commandcode-panel` 也坐在裡面——而它們**全部**都宣告
  `width: 100%`，因此誰也無法共享這一行。在一個活的 0.2.0-rc.2 視窗中實測，沒有任何干預時本插件的卡片被擠到
  **105.2px**，而它的鄰居佔了 150.8px，三組標籤互相撞在一起。卡片現在把**席位變成縱向列**
  （`[class*="_footerActions"]:has(.dtu-footCard)`），於是每個佔用者都拿到它按整行寫出的那一行：
  卡片鋪滿整個 **256px**。以類名後綴加上 `:has()` 匹配，使它獨立於 DSH 的雜湊類名，也不碰任何祖先——
  強迫外殼自己的行容器改變方向會把側邊欄堆到主面板之上。用 `flex-direction` 而不是 `flex-wrap` 有兩個原因：
  外殼把每個槽位包進一層 `display: contents` 元素，直接子代選擇器永遠匹配不到席位；而在**縱向列**席位上
  `flex-wrap` 意思是「另起一列」——實測中這會把卡片放到鄰居旁邊，並把側邊欄撐到 387.8px 而溢出。
  這需要 `:has()`，所以下面的相容性表現在會記錄內置的 Chromium。
- **同一組窗口也會顯示在儀表板中**，成爲 `配置窗口` 一行：標籤、總計、輸入／輸出拆分、緩存命中率與輪次。
  它們按掛鐘時間回溯——Host 只用 `{root, useCache, now}` 構建——並刻意無視來源篩選，所以那一行會這樣說明自己，
  而不是混在跟隨篩選的統計卡之中。兩個窗口都關閉時，會回退為單一累計卡片。
- **按天趨勢不再把兩把尺放在同一張圖上。** 緩存命中率原本是畫在 token 柱上的一條線，帶自己的 0-100% 右軸；
  由於它通常在 90% 以上，這條線一直浮在繪圖區頂部，與下方的柱看不出關係。命中率已經在統計卡與 `配置窗口`
  一行中按窗口給出，於是那條曲線刪掉了：圖表現在改為在柱上疊加**每日 token 總量**，共用左側唯一的 token 軸，
  其頂點落在每個堆疊柱的頂部，因此構成與趨勢可以一起讀。沒有用量的日子會把線拉回基線，
  使「平靜後暴漲」的形狀更清晰。圖例中的命中率項變成了 `每日合計`。
- **曲線流動而非轉角。** 相鄰的日子用**單調三次**（Fritsch-Carlson）插值連接，因此切線在每個數據點上都連續。
  刻意選單調而不是普通樣條：普通樣條會在點之間過衝，而在緊鄰沒有用量的日子時，那意味著跌到軸以下。
- **寫入是原子、有上限、可關閉的。** 兩個寫入器現在都先寫一個 `<name>.<pid>.tmp` 同伴檔案，再 rename 覆蓋目標，
  因此並發讀取者永遠看不到半截檔案，被殺死的進程也不會留下被截斷的檔案。工作階段索引上限 800 條
  （丟棄最舊的，需要時重新掃描），崩潰遺留的 `.tmp` 會在下次寫入時清掉。Host 的診斷（`calls.json`、`boot.json`）
  可以用 `DSH_TOKEN_USAGE_DIAG=0` 完全關閉。所有內容都寫在 `$DSH_HOME/cache/dsh-desktop-token-usage/` 之內；
  README 現在會說明每個檔案的用途以及如何關閉。
- **已宣告與 DSH Desktop 0.2.0-rc.1 相容。** 插件仍然沒有宣告任何 `@deepseek-ai/dsh*` peer 依賴，
  而那才是 DSH 實際校驗的；`engines.dsh` 放寬為 `^0.1.7-rc.2 || ^0.2.0-rc.1`，純粹給人看。
  本插件涉及的每個已發布包都在兩個版本之間做了 diff：`dsh-plugin-manager` 逐位元一致，
  `dsh-client-ui-sidebar`、`dsh-client-ui-layout` 與 `dsh-client-ui-cordis` 只有版本字符串、一行分析調用與標題欄 CSS 的差異。槽位契約未改變。

### 注意

- 發佈後，在 DSH Desktop `0.2.0-rc.2` 上用插件 `0.1.3` 做了手工試用：儀表板與 Remote 調用正常。
- 入口曾短暫移到 `sidebar.panellist`，它提供側邊欄擁有的整行——但那個席位只渲染一個圖標和一個標籤，
  卡片存在要顯示的用量數字會無處可去。它回來了。

## [0.1.3] - 2026-09-28

### 變更

- **CI 現在透過 Trusted Publishing（OIDC）發佈；倉庫不再存儲 npm token。** 工作流去掉了 `NODE_AUTH_TOKEN`，
  加上 `id-token: write`，並在 runner 上升級 npm（Node 22 自帶的 npm 早於 trusted publishing 所需的 11.5.1）。
  來源證明會自動生成，`NPM_TOKEN` 倉庫 secret 不再被引用。

## [0.1.2] - 2026-09-28

### 變更

- **套件名稱去掉了 scope**：`@jd04063221/dsh-desktop-token-usage` → `dsh-desktop-token-usage`。
  0.1.0 與 0.1.1 是帶 scope 的套件；帶 scope 的名稱已棄用並指向此處。不帶 scope 的名稱不需要對應的 npm scope，
  因此安裝命令更短，發佈也不再依賴擁有它。同步更新了：Host 的 `REMOTE_PACKAGE`、Client 模組 `id`，
  以及 `cordis.patch.yml` 中的行 `name`。行 `id` 與 `PANEL_ID` 槽位鍵本來就是不帶 scope 的字符串，
  所以這次不需要遷移任何 profile 配置。

### 注意

- GitHub 倉庫名稱本來就是 `dsh-desktop-token-usage`，所以倉庫 URL 與發佈標籤都不需要改。

## [0.1.1] - 2026-09-28

### 修正

- **npm 頁面預設渲染了中文 README。** npm 11 在 `@npmcli/package-json/lib/normalize.js` 中透過對
  `{README,README.*}` 做 glob 並取第一個看起來像 markdown 的匹配來挑選 readme；本機上該 glob 回傳了
  `README.zh.md`，因此 packument 的 `readme` 字段裝的是中文文檔。中文文檔現改名為 `README-zh.md`
  與 `CHANGELOG-zh.md`（連字元不屬於那個 glob，因此只有 `README.md` 可以被選中）。

### 變更

- 兩份文檔頂部的語言切換連結現在是絕對 GitHub URL：相對連結無法從 npm 套件頁面打開，
  因為 npm 不會把倉庫檔案作為頁面提供。絕對 URL 在 GitHub 與 npm 上都可用。

### 新增

- 一個 GitHub Actions 發佈工作流（`.github/workflows/publish.yml`）：推送 `v*` 標籤會發佈到 npm，
  手動執行預設為試運行，標籤推送會與 `package.json` 中的 `version` 核對。
  認證使用 `NPM_TOKEN` 倉庫 secret（一個啟用了 bypass 2FA 的細粒度訪問令牌）。

## [0.1.0] - 2026-09-27

首次發佈：完全離線的 Token 用量統計，所有數據取自本地 `$DSH_HOME/sessions` 下的工作階段日誌。

### 新增

**統計與數據層**

- 讀取 `session.vN.jsonl.zstd`：這些檔案是**多個 zstd 幀首尾相接**的容器。Node 的解壓 API 只解碼第一幀，
  因此程式碼依照官方的 `scanZstdFrames` 用結構掃描（不解壓）定位幀邊界，再逐幀解壓、逐行解析。
- `(turn, step)` **折疊**語義：同一個時隙內較晚的 usage 記錄取代較早的那一條，只有在 `llm/retry-started` 之後
  才開始累加；`reasoningTokens` 被視為 `outputTokens` 的子集，不重複計算。
- 索引按**本地小時**分桶，並按檔案 `mtime+size` 增量緩存，持久化到
  `$DSH_HOME/cache/dsh-desktop-token-usage/sessions-index.json`。
- 工作階段來源推斷：`桌面 · 網頁`（desktop · web）／`CLI · 機械人`（CLI · bot）／`子代理`（subagent）——
  日誌中沒有客戶端來源字段，因此來源只能從 `origin`、`delegationDepth` 以及用戶輪次的 `source.rpcId` 推導。

**介面**

- 透過官方 Typert 通道暴露三個 Remote：`dshUsage/summary`（用量匯總）、`dshUsage/config`
  （讀取卡片窗口，含 `writable`），以及 `dshUsage/setConfig`（透過官方 `configEditor` 寫回 profile patch）。

**用戶介面**

- 側邊欄頁腳卡片（`sidebar.footer.action`）：按配置顯示「最近 N 小時」／「最近 N 天」窗口或累計值；
  每個窗口顯示**輸入量**（未緩存輸入 + 緩存讀取）、**輸出量**與**緩存命中率**。
- 中央儀表板（`main` 面板）：時間範圍與來源篩選、6 張統計卡、活動熱力圖、按天 Token 趨勢
  （按模型堆疊加上一條緩存命中率線）、模型用量環形圖與佔比清單。
- 活動**日曆**：週一起算、涵蓋近 53 週，帶月份表頭與星期坐標，格子固定 11px；
  頂部的控件在 **Tokens / 輪次** 之間切換，預設選有數據天數較多的那一維。
- 插件頁配置表單（`plugins.bundle.config`）：`hours`（0-23）與 `days`（1-30），`0` 表示停用該窗口。
- 整個介面只依賴 React 與 `--dsw-alias-*` 主題令牌，不引用任何 `@deepseek-ai` 客戶端套件。

**診斷**

- `boot.json`：Host 啟動鏈（apply / typert 注入 / 服務提供 / 描述符註冊）與生效的窗口配置。
- `calls.json`：最近 20 次儀表板調用（篩選、窗口、工作階段數、總 token、耗時）。

### 修正

- **Remote 返回值被當成了載荷**：真實結構是 `{ ok, value }` / `{ ok: false, error }`，其中失敗是值而不是異常。
  原程式碼把 `data.totals` 留成 `undefined`，導致整個儀表板拋錯、渲染空白，而側邊欄卡片只顯示 `0`。
- **儀表板高度塌陷**：`.dtu-body` 用 `flex:1 + min-height:0`，只要父容器高度不確定就會被裁剪並塌成高度 0；
  已改回 `display:block + height:100% + overflow:auto`，標題列改為 sticky。
- **熱力圖格子被拉伸**：`grid-auto-columns` 會把軌道擴張到填滿容器寬度，把 11px 的方塊拉成寬條；已改用 flex 佈局。
- **熱力圖色階失效**：此前按「當日 ÷ 最大值」分桶，單獨一天特別大就會把其餘全部推進同一個桶；已改為非零日的四分位。
- **新增渲染錯誤邊界**：槽位內任何渲染異常現在會顯示一段文字說明，而不是一塊空白。
- **測試覆寫了生產診斷檔案**：`npm test` 裡的 `apply` 寫入了真實的 `boot.json` / `calls.json`，
  而 README 恰恰教人讀這兩個檔案來判斷「當前運行的是哪一代 Host」。診斷目錄現在可用環境變量
  `DSH_TOKEN_USAGE_DIAG_DIR` 覆蓋，測試套件會自動指向臨時目錄，因此不再污染生產檔案。
- **測試與工作階段日誌寫入器競態**：像「按天區間分割總計」這樣的斷言會間歇性失敗，只要運行中的工作階段
  追加了一條記錄（觀測到的缺口：157,951 tokens，且按天之和比快照總計*更大*）。這些窗口現在共享一個釘在
  **當前小時起點**的上界——小時過濾是按桶進行的，釘住「現在」沒有用：稍後寫入當前小時桶的記錄仍會計入。
  熱力圖刻意無視時間範圍，因此它改為比較穩定的日期網格，並在跨快照求和時只重讀一次。

### 變更

- 索引分桶從天改為**本地小時**（`CACHE_VERSION` 1 → 2，首次啟動會重建一次索引），
  使「最近幾個小時」之類的窗口成為可能；儀表板的每日圖表由 Host 從小時桶合併而來。
- 熱力圖數據與時間範圍無關（`summary` 回應新增了 `heatmap` 字段，它仍然跟隨來源篩選）：
  日曆被篩成 7 天等於「一年網格裡亮 7 格」，那不是熱力圖應有的含義。
- 配置值透過官方 `configEditor` 持久化到 profile 的 `cordis.patch.yml`，而不是插件自己的檔案。
- 引入了唯一的 `@deepseek-ai/*` 依賴 `@deepseek-ai/schemastery`（官方 `Config` 卡片所需）。

### 發佈準備（npm）

- **套件名稱、行 id 與倉庫名稱統一為 `@jd04063221/dsh-desktop-token-usage`**（scope 已於 0.1.2 去掉）：
  本插件只面向 **DSH Desktop**（數據來自 Desktop 的 `$DSH_HOME/sessions`），因此名稱帶上 `desktop` 以與其他介面區分。
  一起更新了：套件名稱、Host 的 `REMOTE_PACKAGE`、Client 模組 `id`（官方約定模組的 `id` 即其套件名稱——
  見 `dsh-api-remotes/lib/client.js`）、`cordis.patch.yml` 中的行 `name` **與**行 `id`、
  配置卡的槽位鍵（`plugins.bundle.config` 按**套件名稱**尋址）、診斷與索引緩存目錄，以及 GitHub 倉庫 URL。
- **漏掉其中任何一項都會靜默失效**：模組 `id` 與配置卡鍵必須等於套件名稱，行 `name` 必須是安裝進 profile 的
  準確套件名稱。行 `id` 同時也是 profile 中 `- id: …` 配置覆蓋的錨點——改動它意味著要遷移該覆蓋，
  否則已保存的 `hours`/`days` 會失效（此處已遷移）。Host 在識別自己的 Loader 條目時會同時匹配**套件名稱**
  與**行 id**，因此舊的行仍可讀寫配置（有測試覆蓋）。
- 移除了 `private: true`，新增 `author` / `repository` / `homepage` / `bugs` / `keywords` /
  `publishConfig.access=public`（帶 scope 的套件預設為 restricted）/ `engines.dsh`（聲明式；DSH 不強制）
  / `prepublishOnly: npm test`，以及新的 MIT `LICENSE`。
- ⚠️ **`name` / `author` / 倉庫 URL 中的 `jd04063221` 是佔位用戶名**：發佈前必須換成你自己的 npm scope
  與 GitHub 用戶名（逐項清單見 README 的「Publishing to npm」）。

### 相容與回退

- **Client 比 Host 新**是常態（前者熱重載，後者需要重啟），因此每個缺失字段都有回退：
  `card` 缺失時，累計區塊會從 `totals` 即時計算；`heatmap` 缺失時，日曆會用當前篩選範圍的 `days` 填充，
  標題措辭也隨之改變。
- 當 profile 沒有提供 `configEditor` 時，配置表單變為**唯讀**並說明原因，寫入接口回報明確的錯誤。

### 文檔

- `README.md`（英文，預設）/ `README-zh.md`（中文）：安裝、使用、配置選項、token 計賬表、
  來源推斷的局限、已知限制，以及疑難排查順序，兩者頂部的切換器互相連結。
- `docs/DESIGN.md`：數據契約、關鍵取捨，以及遇到的坑（多幀 zstd、信封、模組代緩存、配置頁機制等等）。
- `docs/research/`：早期研究筆記與可重用的工作階段日誌探查腳本。
- `docs/` 不發佈：`files` 白名單現在帶一條顯式的 `!docs` 條目（npm 的 `files` 支持取反，
  而根目錄的 `.npmignore` 無法覆蓋 `files`，所以取反才是有效形式）。
- 研究筆記已脫敏：`C:\Users\<user>` 之類的機器路徑寫作 `%USERPROFILE%` / `$DSH_HOME`，
  真實記錄把用戶目錄寫作 `<user>`，該約定在文檔頂部說明。

### 已知限制

- 桌面端與網頁端在本地數據中**無法區分**，合併為「桌面 · 網頁」。
- 窗口粒度按小時取整（日誌沒有分鐘級標記）。
- 卡片沒有推送通道，依靠每 5 分鐘一次的靜默重新整理；要立即看到配置變更，打開儀表板並按「重新整理」。
- 匯入的歷史工作階段（例如 reasonix 遷移）用量全是 0；這是有效數據，不會被估算。

### 相容性

- **測試環境：DSH Desktop `0.1.7-rc.2`**（`@deepseek-ai/dsh-desktop@0.1.7-rc.2`），Windows 11 Pro
  build 26200（AMD64），Node v25.2.1。插件啟用、側邊欄卡片、儀表板、插件頁配置卡、瀏覽器 → Host RPC，
  以及與 DSH 自己投影緩存逐字段對賬全部通過驗證——0.1.7-rc.2 上的正常使用有保障。
- `engines.dsh` 宣告為 `^0.1.7-rc.2`（此前是 `>=0.1.7-rc.2`，等於在沒有證據的情況下宣稱與 0.2/1.0 也相容）。
  該字段是**聲明式**的：官方文檔明確指出宣告範圍並不會拒絕不相容的 Host。
- 更早的 DSH 發行版可能沒有本插件用到的 `plugins.bundle.config` 槽位與 `configEditor` 服務；更新的版本尚未測試。
- 實測結論同時寫進了兩處顯示文案：`package.json` 裡的 `description` 與 locale 的 `meta.description`。
  原因是插件列表接口（`listBundles`）把 `package.json` 的**文件 URL** 傳給 `readPluginMeta`，
  而官方文檔說「File paths and file URLs return no metadata」，因此該路徑上只有 `package.json` 的 description 生效
  （實測：列表中的每個 bundle 都只有 `description` 而沒有 `meta`）；locale 條目供能按套件名稱解析元數據的 UI 路徑使用。

### 驗證

- 折疊結果與 DSH 自己的投影緩存逐字段一致（`session-5964a5d3-*`：`286650 / 182633 / 43826560 / 0`）。
- 匯總自洽：天／模型維度能加回總計；按天與按小時的毫秒區間恰好分割總計；日曆按來源恰好分割；
  每個窗口匯總 ≤ 累計值；`hours=99` / `days=-3` 被鉗制。
- 兩側的線描述符逐字段匹配（三個端點），參數編解碼器接受瀏覽器實際發送的值。
- 在無瀏覽器環境中以假 React/DOM 渲染通過（涵蓋兩種卡片形態、配置表單、日曆結構與兩種回退）。
- 安裝後 `fiberPhase: active`，且 `sidebar.footer.action` 與 `main` 都已註冊。
- 共 23 個測試，`npm test` 全綠。**視覺效果與最終數字需要人工確認**（本環境沒有瀏覽器控制）。

---

## 附錄：提交索引

0.1.0 版本由以下提交組成（`git log --reverse`，截至 `2b4be69`）：

| 提交 | 時間 | 內容 |
|---|---|---|
| `9b46227` | 15:01 | 本地工作階段日誌上的 Host 端 token 聚合與用量 Remote 接口 |
| `3b63332` | 15:02 | 側邊欄用量卡片與中央 Token 儀表板 |
| `5407357` | 15:02 | 聚合黃金基準對賬與無瀏覽器 client 冒煙測試 |
| `6d6408e` | 15:02 | README、設計筆記與早期研究筆記 |
| `7d66caa` | 15:58 | 修正 `{ok,value}` 信封與面板高度塌陷 |
| `61f272d` | 16:04 | Host 啟動鏈追蹤與疑難排查文檔 |
| `5ad18db` | 16:48 | 官方 Config 配置卡窗口，索引細化到小時 |
| `dda8906` | 16:49 | 修正配置如何生效的說明（配置變更走 `fiber.restart`） |
| `3a593c5` | 16:58 | Host 缺少 `card` 時 client 回退到累計值 |
| `2ae0a20` | 19:00 | 插件頁內建配置表單（hours/days） |
| `e104dc2` | 19:31 | 重做活動熱力圖（日曆語義、坐標軸、分位色階、指標切換） |
| `2b4be69` | 09:20 | 套件名稱改為帶 scope 並補全 npm 發佈元數據（發佈準備） |
