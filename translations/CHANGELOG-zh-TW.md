# 變更日誌

[English](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/CHANGELOG.md) | [中文](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/translations/CHANGELOG-zh.md) | 繁體中文（臺灣） | [繁體中文（香港）](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/translations/CHANGELOG-zh-HK.md) | [Deutsch](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/translations/CHANGELOG-de.md) | [Français](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/translations/CHANGELOG-fr.md) | [Español](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/translations/CHANGELOG-es.md) | [Italiano](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/translations/CHANGELOG-it.md) | [日本語](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/translations/CHANGELOG-ja.md) | [한국어](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/translations/CHANGELOG-ko.md)

本檔案記錄 `dsh-desktop-token-usage` 的所有重要變更。
格式基於 [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)，版本號遵循 [Semantic Versioning](https://semver.org/)。

> **升級注意**：本插件是 DSH bundle，分兩半載入。`client.js`（介面）由瀏覽器熱更新，
> 而 `index.js` / `lib/*`（Host）在 DSH 程序裡**快取著已匯入的 JS 模組世代**——重新啟用插件不夠，
> 改 specifier、重新安裝、甚至重新命名套件也不會重新匯入（Node 按 realpath 快取 ESM）：
> 必須重新啟動一次 DSH，新程式碼才會載入。要判斷目前跑的是哪一個世代，看 `Config.listConfigs`
> 對本插件回報 `schema` 還是 `absent`，再看你改過之後程序有沒有重啟過；`boot.json`
> 每次 `apply` 都會重寫，所以它的存在只能告訴你 fiber 最近一次重新掛載的時間。

## [0.1.6] - 2026-10-05

### 新增

- **多語言（i18n）**：儀表板現在**遵循 DSH 自身的語言設定**——插件沒有自己的選擇器，在 DSH 中切換語言，儀表板立即
  跟著切換，無需重新載入。這裡隨附十種語言：`en` 與 `zh` 走 DSH 內建字典，另有本插件註冊進 DSH 目錄的 `zh-TW`
  （臺灣正體）、`zh-HK`（香港繁體）、`de`、`fr`、`es`、`it`、`ja` 與 `ko` 語言包。數字、百分比、日期、星期與月份
  名稱、複數形式全部來自 `Intl`，因此千分位分隔、英文寫 `K`/`M`/`B` 之處改寫 `萬`/`億`、以及各語言自己的複數類別都能
  正確呈現。文案放在 `locales/<id>.json`，由 [`scripts/build-dicts.mjs`](../scripts/build-dicts.mjs) 產生進用戶端產物：
  產生區塊絕不可手改，它過期時測試就會失敗。`translations/README-<id>.md` 與 `translations/CHANGELOG-<id>.md` 隨每一種發佈語言提供這兩份
  文件。注意：選用語言包後，**DSH 自身的介面**仍停留在 `zh`/`en`——只有本插件切換。

### 修復

- **趨勢提示框的讀法與熱力圖一致**：標題不再把日期與 Token 總數黏在一起——日期獨自一行，總數自成一行 `Tokens` 列
  （緊湊格式），一行就是一個數字。
- **提示框內不再換行**：框寬跟隨內容（`width:max-content`），並從游標所在的欄位懸出——左半區靠左錨定、右半區靠右
  錨定——而不是在受限的框內置中；像 `deepseek-v4.1-flash` 這樣長的模型名稱會以省略號收在單行，不會被擠到第二行。

### 計畫中

- **多語言的剩餘梯隊**：其餘六個語言代碼 `pt-BR`、`ru`、`vi`、`th`、`id` 與 `ar` 已設計但尚未實作。`ar` 還需要
  從右到左的外殼——內距、提示框與座標軸側別都要鏡像，而時間軸仍保持由左至右——這十種發佈語言都不需要。見
  [設計文件](../docs/superpowers/specs/2026-10-01-i18n-design.md)。

## [0.1.5] - 2026-10-01

### 新增

- **分組選項**：按實際模型（跨供應商合併同名模型）、按 API 供應商，或兩者都要。選「兩者」時，趨勢區與拆分區各有
  一顆自己的 chip，可獨立切換。
- **配色選項**：primer（GitHub 預設）、cvd（Okabe-Ito，色盲友善）或 muted（低飽和），每套都附有一組會自動跟隨
  系統主題的淺色與深色變數。

### 變更

- **命中率曲線疊加在長條上**：Token 堆疊長條與快取命中率曲線共用一張圖（曲線按統計期的 min−10% 跨度 ~ max+10%
  跨度映射到繪圖區，右側標示真實百分比），不再獨佔一條細帶。
- **命中率曲線的 Y 軸改為資料驅動**：由統計期的 min/max 決定範圍，兩端各加上 10% 跨度的餘量；曲線沿用單調三次
  插值。
- **命中率語意**：未命中側現在包含 cacheWrite（hit / (hit + miss)），與官方定義一致；本機 cacheWrite 恆為 0，所以
  數字沒有變化。

### 修復

- **圖表配色跟隨 DSH 自身的主題開關**，而不是作業系統：DSH 用 `body[data-ds-dark-theme]` 標記深色，淺色模式下
  `<body>` 不帶任何標記，因此配色現在讀這個標記（透過 `light-dark()` + `color-scheme`），不再依賴
  `prefers-color-scheme`。從前「淺色桌機 + 深色外殼」會讓所有圖表停在淺色，「深色桌機 + 淺色外殼」則相反。
- **一個模型一列**：供應商之間模型 id 的寫法不一致——`commandcode` 報 `deepseek/deepseek-v4.1-flash`，而
  `opencode-go` 報 `deepseek-v4.1-flash`，按模型視圖把同一個模型列了兩次。現在按模型的鍵取 id 的最後一段；按供應商
  視圖仍把兩者分開。
- **活動熱力圖鋪滿整列**：固定的 53 週不再停在卡片半途。現在全部 53 個欄位在同一個 11px 基準上均分可用寬度（格子
  保持正方形，月份軸與星期帶也隨之伸縮）；只有窄到放不下 11px 格子的卡片才退回橫向捲動，而且捲動開在最新的一週，
  而不是最舊的（本機上是空白的）那幾週。圓角改為格子的 24% 而非固定 2px，切換配色或指標會在 0.18s 內交叉淡變，游標
  移過一天會用 `filter: brightness()` 提亮（不造成版面位移、不重排），`prefers-reduced-motion` 會關閉轉場。
- **熱力圖三處可讀性修正**：沒有活動的一天保留 1px 的第 0 階細描邊而不是實心色塊（日曆一鋪滿卡片，一片實心灰會被
  讀成資料）；「今天」用雙色內縮環標示（外側面板色、內側標籤色），在最淺與最深的色階上都看得見；游標移過一天時，
  現在抬起的是儀表板自己的提示框——與趨勢圖同一個框，按欄中心的一部分鎖在繪圖區內，排成四行：日期 / Tokens / 輪次 /
  請求，其中 Token 數字使用與統計卡片、趨勢提示框相同的緊湊格式（`1.45亿` 而不是 `145,156,311`，這樣再長的 Token 數
  也不會把框撐寬）——取代了原本延遲且樣式不受控的原生 `title`。整個日曆**置中、左右各留 15px**，53 個欄位均分剩餘
  寬度，所以現在**完全不捲動**——捲動框已經消失。底部那條列一直就是懸停框：Token 數字一長，它就超過為其設定的 160px
  最小寬度，於是在邊緣欄位探出捲動框外，差 1px 就足夠觸發。現在這個框會避開靠近的那一側——左半區的欄靠左對齊並向右
  生長，右半區的欄靠右對齊並向左生長——`max-width:calc(50% - 25px)` 保證半個欄位的跨度容得下整個框。它在任何寬度下
  都不會越過日曆，而且不需要測量自身寬度就能保證這一點。
- **儀表板頁腳改成一行一件事。** 三個長度差異很大的 flex 項目擠成一段參差的段落，長註記還會在「…」詞語中間斷行；
  現在每個加引號的詞語都不可斷行。

## [0.1.4] - 2026-09-30

### 變更

- **側邊欄卡片現在在頁腳席位裡獨佔一整行。** `sidebar.footer.action` 是單一橫向行（`display: flex`），標準安裝下
  `dsh-opencode-go-usage`、Cordis 徽章與 `commandcode-panel` 也坐在裡面——而它們**全都**宣告 `width: 100%`，所以誰
  也無法與別人共享這一行。在實際的 0.2.0-rc.2 視窗中測量：沒有任何干預時，本插件的卡片被擠到 **105.2px**，而鄰居占
  150.8px，三組文字互相撞在一起。於是卡片把**席位變成縱向列**（`[class*="_footerActions"]:has(.dtu-footCard)`），讓
  每個占用者都拿到它為整行而寫的那一行：卡片橫跨整個 **256px**。以類名後綴加 `:has()` 匹配，讓它不依賴 DSH 的雜湊
  類名，也不碰任何祖先元素——強迫外殼自己的橫向容器改變方向，會把側邊欄堆到主面板之上。用 `flex-direction` 而非
  `flex-wrap` 有兩個原因：外殼把每個槽位包在 `display: contents` 元素裡，直接子代選擇器永遠匹配不到席位；而且在**縱向
  列**的席位上 `flex-wrap` 意味著「另起一列」——實測會把卡片放到鄰居旁邊，並把側邊欄撐寬到 387.8px 而溢出。這需要
  `:has()`，所以下方的相容性表現在記錄內建的 Chromium。
- **同樣的兩個窗口也顯示在儀表板裡**，在 `設定窗口` 一行中：標籤、總量、輸入/輸出拆分、快取命中率與輪次。它們按
  本地牆鐘時間回溯——Host 只用 `{root, useCache, now}` 建構它們——刻意忽略來源篩選，因此那一行會說明這一點，而不是
  混在跟隨篩選的統計卡片中。兩個窗口都關閉時，退回成單一的累計卡片。
- **每日趨勢不再把兩個量綱放在同一張圖上。** 快取命中率原來是一條畫在 Token 長條上的折線，有自己的 0-100% 右軸；
  由於它通常在 90% 以上，這條線一直飄在繪圖區頂端，與下方的長條看不出任何關聯。命中率已經在統計卡片與 `設定窗口`
  行中逐窗口給出，所以那條曲線沒有了：圖表改成在長條上疊加**每日 Token 總量**，共用同一條左側 Token 軸，頂點落在
  每個堆疊欄的頂部，構成與走勢一眼可一起讀出。沒有用量的日子，曲線落回基準線，使「先空後爆」的形狀更清楚。圖例中
  的命中率條目變成了 `每日總計`。
- **曲線流動而不是轉角。** 相鄰兩天之間以**單調三次**（Fritsch-Carlson）插值相連，因此切線在每個資料點上都連續。
  刻意選單調而非一般樣條：一般樣條會在資料點之間過沖，而緊鄰沒有用量的日子，那意味著跌破座標軸。
- **寫入改為原子、有上限、可關閉。** 兩個寫入者現在都先寫 `<name>.<pid>.tmp` 再 rename 覆寫目標，因此並發讀取永遠
  看不到半截檔案，被終止的程序也不可能留下被截斷的檔案。工作階段索引上限 800 筆（丟棄最舊的，需要時重新掃描），崩潰
  遺留的 `.tmp` 會在下次寫入時清掉。Host 的診斷（`calls.json`、`boot.json`）可用 `DSH_TOKEN_USAGE_DIAG=0` 完全關閉。
  所有寫入都發生在 `$DSH_HOME/cache/dsh-desktop-token-usage/` 之內；README 現在逐一說明每個檔案的用途與如何關閉。
- **宣告對 DSH Desktop 0.2.0-rc.1 的相容性。** 插件仍然不宣告任何 `@deepseek-ai/dsh*` peer dependency，而那才是
  DSH 實際校驗的；`engines.dsh` 放寬為 `^0.1.7-rc.2 || ^0.2.0-rc.1`，僅供人閱讀。本插件涉及的每個已發布套件都在
  兩個版本間做了 diff：`dsh-plugin-manager` 位元組完全一致，`dsh-client-ui-sidebar`、`dsh-client-ui-layout` 與
  `dsh-client-ui-cordis` 只有版本字串、一次分析呼叫與標題列 CSS 的差異。槽契約未改變。

### 說明

- 發布後，在 DSH Desktop `0.2.0-rc.2` 上用插件 `0.1.3` 做了一次手工試用：儀表板與 Remote 呼叫正常。
- 入口曾短暫移到 `sidebar.panellist`，它給側邊欄一條自己擁有的整行——但那個席位只渲染一個圖示與一個標籤，卡片存在
  要顯示的用量數字將無處可放。後來移回來了。

## [0.1.3] - 2026-09-28

### 變更

- **CI 現在透過 Trusted Publishing（OIDC）發布；儲存庫不再保存 npm token。** workflow 移除 `NODE_AUTH_TOKEN`、
  加上 `id-token: write`，並在 runner 上升級 npm（Node 22 內附的 npm 低於 trusted publishing 要求的 11.5.1）。
  Provenance 證明會自動產生，並且不再引用 `NPM_TOKEN` 儲存庫密鑰。

## [0.1.2] - 2026-09-28

### 變更

- **套件名稱去掉 scope**：`@jd04063221/dsh-desktop-token-usage` → `dsh-desktop-token-usage`。0.1.0 與 0.1.1 是有
  scope 的套件；帶 scope 的名稱已棄用並指向此處。無 scope 的名稱不需要對應的 npm scope，所以安裝指令更短，發布也
  不再依賴擁有它。同步更新了 Host 的 `REMOTE_PACKAGE`、Client 模組的 `id`，以及 `cordis.patch.yml` 中的列
  `name`。列 `id` 與 `PANEL_ID` 槽鍵本來就是無 scope 的字串，因此這次不需要遷移任何 profile 設定。

### 說明

- GitHub 儲存庫名稱本來就是 `dsh-desktop-token-usage`，所以儲存庫 URL 與發布標籤都不需要更改。

## [0.1.1] - 2026-09-28

### 修復

- **npm 頁面預設渲染的是中文 README。** npm 11 在 `@npmcli/package-json/lib/normalize.js` 中以
  `{README,README.*}` 做 glob 並取第一個看起來像 markdown 的符合項；在本機上該 glob 回傳 `README.zh.md`，於是
  packument 的 `readme` 欄位存的是中文文件。中文文件現在命名為 `README-zh.md` 與 `CHANGELOG-zh.md`（連字號不屬於
  該 glob，因此只有 `README.md` 會被選中）。

### 變更

- 兩份文件頂部的語言切換連結改為 GitHub 絕對 URL：相對連結無法從 npm 套件頁面開啟，因為 npm 不會把儲存庫檔案當成
  頁面提供。絕對 URL 在 GitHub 與 npm 上都可用。

### 新增

- GitHub Actions 發布 workflow（`.github/workflows/publish.yml`）：推送 `v*` 標籤即發布到 npm，手動執行預設為
  乾跑（dry run），推送標籤時會核對標籤與 `package.json` 中的 `version` 是否一致。認證使用 `NPM_TOKEN` 儲存庫
  密鑰（一個啟用繞過 2FA 的細粒度存取權杖）。

## [0.1.0] - 2026-09-27

首個版本：完全離線的 Token 用量統計，所有資料都取自本機 `$DSH_HOME/sessions` 底下的工作階段記錄。

### 新增

**統計與資料層**

- 讀取 `session.vN.jsonl.zstd`：這些檔案是**多個 zstd 幀首尾相接**的容器。Node 的解壓 API 只解碼第一幀，因此程式
  依照官方 `scanZstdFrames` 以結構掃描（不解壓）定位幀邊界，再逐幀解壓、逐行解析。
- `(turn, step)` **折疊**語義：同一槽位內，較晚的 usage 紀錄取代較早的那條，只有 `llm/retry-started` 之後才開始累加；
  `reasoningTokens` 被視為 `outputTokens` 的子集，不重複計入。
- 索引按**本地小時**分桶，按檔案 `mtime+size` 增量快取，持久化到
  `$DSH_HOME/cache/dsh-desktop-token-usage/sessions-index.json`。
- 工作階段來源推斷：`用戶端（桌面 · 網頁）`（desktop · web）/ `CLI · 機器人`（CLI · bot）/ `子代理`（subagent）——
  記錄中沒有用戶端來源欄位，因此來源只能從 `origin`、`delegationDepth` 與用戶輪次的 `source.rpcId` 推導。

**介面**

- 透過官方 Typert 通道暴露三個 Remote：`dshUsage/summary`（用量彙總）、`dshUsage/config`（讀取卡片窗口，含
  `writable`），以及 `dshUsage/setConfig`（透過官方 `configEditor` 寫回 profile patch）。

**使用者介面**

- 側邊欄底部卡片（`sidebar.footer.action`）：依設定顯示「最近 N 小時」/「最近 N 天」窗口或累計值；每個窗口顯示
  **輸入量**（未快取輸入 + 快取讀取）、**輸出量**與**快取命中率**。
- 中央儀表板（`main` 面板）：時間範圍與來源篩選、6 張統計卡片、活動熱力圖、每日 Token 趨勢（按模型堆疊加上快取
  命中率折線）、模型用量環形圖與占比列表。
- 活動**日曆**：週一起算、最近 53 週，帶月份表頭與星期座標，格子固定 11px；頂部可切換 **Tokens / 輪次**，預設選取
  有資料天數較多的維度。
- 外掛頁設定表單（`plugins.bundle.config`）：`hours`（0-23）與 `days`（1-30），`0` 表示關閉該窗口。
- 整個 UI 只依賴 React 與 `--dsw-alias-*` 主題 token，不引用任何 `@deepseek-ai` 用戶端套件。

**診斷**

- `boot.json`：Host 啟動鏈路（apply / typert 注入 / 服務提供 / 描述符註冊）與生效的窗口設定。
- `calls.json`：最近 20 次儀表板呼叫（篩選、窗口、工作階段數、Token 總數、耗時）。

### 修復

- **Remote 回傳值被當成 payload**：真實形狀是 `{ ok, value }` / `{ ok: false, error }`，失敗是值而不是例外。
  原本的程式讓 `data.totals` 停在 `undefined`，導致整個儀表板拋錯、渲染空白，而側邊欄卡片只顯示 `0`。
- **儀表板高度塌陷**：`.dtu-body` 使用 `flex:1 + min-height:0`，當父容器高度不確定時被裁切並塌成 0 高；
  改回 `display:block + height:100% + overflow:auto`，並把頁首做成 sticky。
- **熱力圖格子被拉伸**：`grid-auto-columns` 會擴張軌道以填滿容器寬度，把 11px 方塊拉成寬條；改用 flex 版面。
- **熱力圖色階失效**：先前按「當日 ÷ 最大值」分桶，只要有一天特別大，其餘全落進同一桶；改用非零日的四分位。
- **新增渲染錯誤邊界**：槽位內任何渲染例外現在都會顯示文字說明，而不是一整塊空白。
- **測試覆寫了正式環境的診斷檔案**：`npm test` 裡的 `apply` 寫入了真正的 `boot.json` / `calls.json`，
  而 README 恰恰教人看這兩個檔案來判斷「目前跑的是哪一代 Host」。診斷目錄現在可用環境變數
  `DSH_TOKEN_USAGE_DIAG_DIR` 覆蓋，測試套件會自動指向暫存目錄，不再污染正式檔案。
- **測試與工作階段記錄寫入競爭**：「按日區間劃分總量」這類斷言會在執行中的工作階段追加紀錄時偶發失敗
  （觀測到的差距：157,951 tokens，且按日總和反而*大於*快照總量）。這些窗口現在共用一個釘在**當前整點**的上界——
  按小時過濾是按桶進行的，所以釘住「現在」沒有用：之後寫進當前小時桶的紀錄仍會計入。熱力圖刻意忽略時間範圍，因此
  改為比對穩定的日期網格，跨快照加總時重讀一次。

### 變更
- 索引桶從「天」改為**本地小時**（`CACHE_VERSION` 1 → 2，首次啟動會重建一次索引），
  讓「最近幾個小時」這類窗口成為可能；儀表板的每日圖表由 Host 從小時桶合併而成。
- 熱力圖資料獨立於時間範圍（`summary` 回應多了 `heatmap` 欄位，它仍跟隨來源篩選）：
  日曆被篩到 7 天等於「一年網格裡亮 7 格」，那不是熱力圖該有的意思。
- 設定值透過官方 `configEditor` 持久化到 profile 的 `cordis.patch.yml`，不寫進插件自己的檔案。
- 引入唯一的 `@deepseek-ai/*` 相依 `@deepseek-ai/schemastery`（官方 `Config` 卡片所需）。

### 發佈準備（npm）

- **套件名稱、列 id 與儲存庫名稱統一為 `@jd04063221/dsh-desktop-token-usage`**（scope 在 0.1.2 中去掉）：
  本插件只面向 **DSH Desktop**（資料來自 Desktop 的 `$DSH_HOME/sessions`），所以名稱帶 `desktop` 以與其他形態區分。
  同步更新：套件名稱、Host 的 `REMOTE_PACKAGE`、Client 模組的 `id`（官方慣例是模組的 `id` 即其套件名稱——見
  `dsh-api-remotes/lib/client.js`）、`cordis.patch.yml` 中的列 `name`**與**列 `id`、設定卡的槽鍵
  （`plugins.bundle.config` 以**套件名稱**為鍵）、診斷與索引快取目錄，以及 GitHub 儲存庫 URL。
- **這幾處漏掉任何一處都會靜默失效**：模組 `id` 與設定卡鍵必須等於套件名稱，列 `name` 必須是安裝進 profile 的確切
  套件名稱。列 `id` 同時也是 profile 中 `- id: …` 設定覆蓋的錨點——改它意味著要遷移那條覆蓋，否則已儲存的
  `hours`/`days` 會失效（本次已遷移）。Host 識別自己的 Loader 條目時，同時匹配**套件名稱**與**列 id**，所以舊列仍能
  讀寫設定（有測試涵蓋）。
- 移除 `private: true`，補上 `author` / `repository` / `homepage` / `bugs` / `keywords` /
  `publishConfig.access=public`（有 scope 的套件預設為 restricted）/ `engines.dsh`（聲明性；DSH 不強制）/
  `prepublishOnly: npm test`，外加新的 MIT `LICENSE`。
- ⚠️ **`name` / `author` / 儲存庫 URL 中的 `jd04063221` 是佔位使用者名稱**：發布前必須換成你自己的 npm scope 與
  GitHub 使用者名稱。

### 相容性與回退

- **用戶端比 Host 新**是常態（前者熱更新、後者要重新啟動），因此每個缺失欄位都有回退：缺 `card` 時，累計區塊由
  `totals` 即時算出；缺 `heatmap` 時，日曆用當前篩選範圍的 `days` 填充，標題措辭隨之改變。
- 當 profile 沒有提供 `configEditor` 時，設定表單變成**唯讀**並說明原因，寫入介面則明確回報錯誤。

### 文件

- `README.md`（英文，預設）/ `README-zh.md`（中文）：安裝、使用、設定選項、Token 計算口徑表、來源推斷的局限、
  已知限制與排查順序，兩份檔案頂部的切換列互相連結。
- `docs/DESIGN.md`：資料契約、關鍵取捨，以及踩過的坑（多幀 zstd、信封、模組世代快取、設定頁機制等等）。
- `docs/research/`：早期研究筆記與可重用的工作階段記錄探測腳本。
- `docs/` 不發布：`files` 白名單現在帶有明確的 `!docs` 條目（npm 的 `files` 支援取反，而根目錄的 `.npmignore`
  無法覆蓋 `files`，所以取反才是有效的形式）。
- 研究筆記已脫敏：`C:\Users\<user>` 這類機器路徑改寫為 `%USERPROFILE%` / `$DSH_HOME`，引用真實紀錄時使用者目錄
  寫成 `<user>`，並在文件頂部寫明這條慣例。

### 已知限制

- 桌面與網頁在本機資料中**無法區分**，合併為「桌面 · 網頁」。
- 窗口粒度取整到小時（記錄中沒有分鐘級標記）。
- 卡片沒有推送通道，依賴每 5 分鐘的靜默重新整理；想立刻看到設定變更，開啟儀表板並按「重新整理」。
- 匯入的歷史工作階段（例如 reasonix 遷移）usage 全為 0；這是有效資料，不會估算。

### 相容性

- **實測環境：DSH Desktop `0.1.7-rc.2`**（`@deepseek-ai/dsh-desktop@0.1.7-rc.2`）、Windows 11 專業版
  build 26200（AMD64）、Node v25.2.1。插件啟用、側邊欄卡片、儀表板、外掛頁設定卡、瀏覽器 → Host RPC，
  以及與 DSH 自身投影快取逐欄位對拍數字，全部通過驗證——可保證在 0.1.7-rc.2 上正常使用。
- `engines.dsh` 宣告為 `^0.1.7-rc.2`（先前是 `>=0.1.7-rc.2`，那等於宣稱對 0.2/1.0 也相容，並無依據）。
  該欄位是**聲明性**的：官方文件明確寫著，宣告一個範圍並不會拒收不相容的 Host。
- 更早的 DSH 發佈可能沒有本插件使用的 `plugins.bundle.config` 槽與 `configEditor` 服務；更新的版本尚未測試。
- 實測結論也寫進了兩處展示文字：`package.json` 中的 `description` 與 locale 的 `meta.description`。原因是外掛清單
  介面（`listBundles`）把 `package.json` 的**檔案 URL** 傳給 `readPluginMeta`，而官方文件說
  "File paths and file URLs return no metadata"，所以在該路徑下只有 `package.json` 的描述會生效（實測：清單中每個
  bundle 都只有 `description`、沒有 `meta`）；locale 那一條用於能按套件名稱解析中繼資料的 UI 路徑。

### 驗證

- 折疊結果與 DSH 自身的投影快取逐欄位一致（`session-5964a5d3-*`：`286650 / 182633 / 43826560 / 0`）。
- 彙總自洽：日/模型維度可加總回總量；按日與按小時的毫秒區間精確劃分總量；日曆按來源精確劃分；每個窗口彙總 ≤
  累計值；`hours=99` / `days=-3` 被夾緊。
- 兩端的 wire 描述符逐欄位一致（三個端點），參數編解碼器接受瀏覽器實際傳送的值。
- 在沒有瀏覽器的環境中以假 React/DOM 渲染通過（涵蓋卡片兩種形態、設定表單、日曆結構與兩處回退）。
- 安裝後 `fiberPhase: active`，且 `sidebar.footer.action` 與 `main` 都已註冊。
- 共 23 個測試，`npm test` 全綠。**視覺呈現與最終數字需要人工確認**（本環境沒有瀏覽器控制）。

---

## 附錄：提交索引

0.1.0 版由以下提交組成（`git log --reverse`，截至 `2b4be69`）：

| 提交 | 時間 | 內容 |
|---|---|---|
| `9b46227` | 15:01 | 本機工作階段記錄的 Host 端 Token 聚合與用量 Remote 介面 |
| `3b63332` | 15:02 | 側邊欄用量卡片與中央 Token 儀表板 |
| `5407357` | 15:02 | 聚合基準對拍與無瀏覽器用戶端煙霧測試 |
| `6d6408e` | 15:02 | README、設計筆記與早期研究筆記 |
| `7d66caa` | 15:58 | 修正 `{ok,value}` 信封與面板高度塌陷 |
| `61f272d` | 16:04 | Host 啟動鏈路追蹤與疑難排解文件 |
| `5ad18db` | 16:48 | 官方 Config 設定卡片窗口，索引細化到小時 |
| `dda8906` | 16:49 | 修正設定如何生效的說明（設定變更走 `fiber.restart`） |
| `3a593c5` | 16:58 | 用戶端在 Host 缺少 `card` 時回退到累計值 |
| `2ae0a20` | 19:00 | 外掛頁內建設定表單（hours/days） |
| `e104dc2` | 19:31 | 重做活動熱力圖（日曆語意、座標軸、分位數色階、指標切換） |
| `2b4be69` | 09:20 | 套件名稱改為帶 scope 並補齊 npm 發佈元資料（發佈準備） |
