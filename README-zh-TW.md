# dsh-desktop-token-usage

[English](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/README.md) | [中文](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/README-zh.md) | 繁體中文（臺灣） | [繁體中文（香港）](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/README-zh-HK.md) | [Deutsch](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/README-de.md) | [Français](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/README-fr.md) | [Español](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/README-es.md) | [Italiano](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/README-it.md) | [日本語](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/README-ja.md) | [한국어](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/README-ko.md)

一個**完全離線**的 DSH（DeepSeek Harness）Token 用量統計外掛。

- **Host 半邊**掃描 `$DSH_HOME/sessions/**/session.vN.jsonl.zstd`，折疊出真實的 Token 用量；
- **Client 半邊**在左側邊欄底部掛一張用量卡片；點擊它會在中央面板開啟儀表板：時間範圍與來源篩選、6 張統計卡片、
  一行「設定窗口」、活動熱力圖、每日 Token 趨勢（快取命中率曲線疊加在 Token 長條上，右側標示實際百分比，縱軸在統計期
  最小值/最大值之外各留 10% 餘量），以及模型用量環形圖與列表。

卡片與儀表板的**設定窗口**行回報哪幾段時間，由**外掛設定**決定（兩個窗口預設都是關閉）：在
**設定 → 外掛 → `Token 用量`** 中，可以各自獨立開啟「最近 N 小時」（0-23）與「最近 N 天」（1-30）兩個窗口；
兩個都關掉時，每個顯示面都退回成單一的累計區塊。
這兩個窗口按本地牆鐘時間回溯，刻意忽略儀表板的來源篩選，所以它們自成一行，而不是混在跟隨篩選的統計卡片裡。
同一張設定頁還能挑選**分組方式**——按模型、按供應商，或都統計（都統計時，趨勢區與拆分區 `用量拆分` 各會出現一顆
可切換的 chip）——以及**配色**——primer、cvd 或 muted，每套都有淺色與深色兩組，跟隨 DSH 自身的明暗開關
(`body[data-ds-dark-theme]`)，因此圖表永遠不會和外殼不一致。

側邊欄底部是一條與所有註冊在那裡的其他外掛共用的橫向行，而它們**全都**宣告了 `width: 100%`——所以沒有任何兩個能
共用它。實測（沒有任何干預時）這張卡片被擠到 105.2px。於是卡片把那一行**變成縱向列**
(`[class*="_footerActions"]:has(.dtu-footCard)`——以類名後綴加上 `:has()` 定位，所以不依賴 DSH 的雜湊類名，也不會碰到
任何祖先元素)，讓席位中的每個外掛都拿到它按整行設計的那一行；這張卡片橫跨整個 256px。用 `flex-direction` 而不是
`flex-wrap`，是因為外殼把每個槽位包進一層 `display: contents` 元素——直接子代選擇器永遠匹配不到席位——而且在縱向列的
席位上 `flex-wrap` 意味著「另起一列」，反而會把卡片推到旁邊去。這需要 `:has()`；見下方的相容性表。

不連網、不上報、不呼叫任何 API：每個數字都來自機器上已有的工作階段記錄。

## 界面截圖

以本插件**自己的元件**搭配**範例資料**渲染——截圖由 [`scripts/render-shots.mjs`](scripts/render-shots.mjs)
（真實的 `client.js` 與 CSS，接一個假 Host）加上 [`scripts/render-shots.py`](scripts/render-shots.py)
（無頭 Chrome）離線產生，不涉及任何工作階段記錄、路徑或帳號資訊。先是淺色主題，再是深色主題。截圖以中文渲染——
第一支腳本接受 `--locale <id>` 可渲染其他語言——本 README 的十種語言版本共用同一組圖片。

![儀表板，淺色主題](assets/dashboard-light.png)

6 張統計卡片、「設定窗口」行、活動熱力圖、命中率曲線疊加在長條上的每日 Token 趨勢，以及模型用量拆分。

![儀表板，深色主題](assets/dashboard-dark.png)

深色主題下的同一張儀表板——每套配色都附有淺色與深色兩組。

| 活動熱力圖 | 每日趨勢 |
|---|---|
| ![活動熱力圖](assets/heatmap-light.png) | ![每日趨勢](assets/trend-light.png) |

| 側邊欄卡片 | 它在外掛管理員中的頁面 |
|---|---|
| ![側邊欄卡片](assets/sidebar-dark.png) | ![設定](assets/settings-light.png) |

側邊欄底部的卡片顯示兩個設定窗口；點擊它會開啟上方的儀表板。插件在外掛管理員中的頁面則承載窗口跨度、分組方式與配色。

## 相容性與測試環境

**已在 DSH Desktop 0.1.7-rc.2 上完整驗證，並針對 0.2.0-rc.1 做了相容性核對；插件 0.1.3 也在 0.2.0-rc.2 上手工試用過，沒有問題。**

| 項目 | 實測環境 |
|---|---|
| DSH | Desktop `0.1.7-rc.2`（完整驗證）、`0.2.0-rc.1`（相容性核對）與 `0.2.0-rc.2`（`0.1.3` 手工試用） |
| 內建執行環境 | Electron 44 / Chromium 152 / Node 24.18.1（把席位變成縱向列需要 `:has()`，Chrome 105+；配色主題需要 `light-dark()`，Chrome 123+） |
| 作業系統 | Windows 11 專業版，build 26200，AMD64 |
| Node（用來執行測試） | v25.2.1、v26.7.0 |

驗證遠不只「裝得上」：插件啟用達到 `fiberPhase: active`、側邊欄卡片與中央儀表板渲染、外掛頁自帶的設定卡可讀可寫、
瀏覽器 → Host 的 Remote 呼叫端到端可用，以及每個欄位都與 DSH 自身的投影快取交叉核對一致。

針對 `0.2.0-rc.1` 的核對是**結構性**的，而不是再跑一次完整驗證。本插件涉及的每個已發布套件都與 `0.1.7-rc.2` 做了
diff：`dsh-plugin-manager` 位元組完全一致；而在 `dsh-client-ui-sidebar`、`dsh-client-ui-layout` 與
`dsh-client-ui-cordis` 中，只有版本字串、一次分析呼叫與標題列 CSS 不同。`sidebar.footer.action` 槽的契約與其
`{ wide }` owner props 沒有改變，本插件匯入的套件（`dsh-api-remotes`、`dsh-client-ui-layout`、`dsh-client-ui-sidebar`）
名稱也保持不變。在 `0.2.0-rc.1` 上的手工試用回報儀表板與 Remote 呼叫正常；插件 `0.1.3` 同樣在 `0.2.0-rc.2` 上手工
試用過，回報相同。

本插件**沒有**宣告任何 `@deepseek-ai/dsh*` peer dependency，而這正是 DSH 實際校驗的東西——不宣告 peer 範圍就完全
不施加任何版本限制。`engines.dsh` 宣告為 `^0.1.7-rc.2 || ^0.2.0-rc.1` 僅供人閱讀：官方文件明確寫著，宣告一個範圍
並不會拒收不相容的 Host。

**上表以外的版本未經測試。** 更早的 DSH 版本可能缺少本插件使用的 `plugins.bundle.config` 槽與 `configEditor` 服務
（缺少它們就沒有設定卡，設定只能手動編輯 profile patch）；比 `0.2.0-rc.2` 更新的版本尚未驗證。

## 寫入磁碟的內容

插件讀取工作階段記錄，只寫入自己的一個目錄：`$DSH_HOME/cache/dsh-desktop-token-usage/`。不會在任何工作階段記錄
旁邊寫入東西，不會在 `$DSH_HOME` 底下其他位置建立、修改或刪除任何東西，也從不連網。

| 該目錄下的檔案 | 由誰寫入 | 用途 | 如何關閉 |
|---|---|---|---|
| `sessions-index.json` | `lib/session-usage.js` | 依工作階段的折疊快取，讓熱呼叫不必重新掃描每個 `session.vN.jsonl.zstd` | 刪除它；下次呼叫時會重建 |
| `calls.json` | `index.js` | 診斷：最近 20 次 Remote 呼叫 | `DSH_TOKEN_USAGE_DIAG=0` |
| `boot.json` | `index.js` | 診斷：fiber 最近一次被 apply 的時間 | `DSH_TOKEN_USAGE_DIAG=0` |

兩個寫入者都是**原子**的：它們先寫入同目錄的 `<name>.<pid>.tmp`，再以 rename 覆寫目標，因此並發讀取永遠看不到
半截檔案，被終止的程序也不會留下被截斷的檔案。索引上限 800 筆（丟棄最舊的，需要時重新掃描），崩潰遺留的任何
`.tmp` 會在下次寫入時清掉。

## 安裝

本儲存庫是一個 DSH bundle（`package.json` 宣告了 `dsh.bundle.patch` 與 `dsh.client`）。透過官方入口安裝即可，
不需要手動編輯 profile 檔案：

```
plugin_manager  action: install_bundle  target: <本目錄的絕對路徑>
```

因為本套件依賴 `@deepseek-ai/schemastery`（官方 Config 卡片所需的 schema 函式庫），而 `install_bundle` 對本地目錄
採用 `link:` 安裝、**不會**為被連結的套件安裝相依，所以先在本儲存庫內安裝一次：

```
npm install            # 只安裝 dev/runtime 相依套件，不從網路取得任何資料
```

### 改完程式碼後：用戶端熱更新，Host 需要重新啟動

| 改了哪一半 | 如何生效 |
|---|---|
| `client.js`（UI） | 瀏覽器端的模組快照在 mtime/size 變更後由 HMR 推送到頁面；若未生效，強制重新整理頁面一次（Ctrl/Cmd+Shift+R） |
| `index.js` / `lib/*`（Host） | **必須重新啟動 DSH**：重新啟用條目只會重新掛載 fiber，不會重新匯入已快取的 JS 模組世代。同理，新增或修改 `Config` 欄位也需要重新啟動後才會出現在設定裡 |

要判斷目前執行的是哪一個版本：檢查 `$DSH_HOME/cache/dsh-desktop-token-usage/boot.json` 是否存在，以及 `windows`
是否符合預期。

解除安裝：`plugin_manager action: remove_bundle target: dsh-desktop-token-usage`。

> 套件名稱與插件的**列 id** 是兩回事：列 id 是 `dsh-desktop-token-usage`（profile 中設定覆蓋的錨點），
> 套件名稱是 `dsh-desktop-token-usage`。解除安裝/安裝用套件名稱，改設定用列 id。

## 使用

1. 看**左側邊欄底部**、位於設定上方的那張卡片：依你的設定顯示每個窗口的輸入/輸出量與快取命中率；
2. 點擊它 → 儀表板在中央面板開啟；
3. 在儀表板頂部可按**時間範圍**（最近 7/14/30/90 天、全部、自訂）與**來源**篩選；
   右下角有一顆重新整理按鈕。

篩選與聚合都在 Host 進行：每次變更都會向 Host 發出新的聚合請求（Host 保存以檔案 mtime+size 為鍵的索引快取，
所以熱呼叫在數百毫秒內）。卡片每 5 分鐘靜默重新整理一次——小時窗口本來就會隨時間滑動，所以即使沒有新的用量也
應該更新。

### 活動熱力圖怎麼讀

- 它是一份**日曆**（週一起算，最近 53 週），帶有**月份**與**星期**軸；格子均分卡片的寬度，因此會隨卡片伸縮並保持
  正方形（11px 是參考尺寸）；
- 色階採用**非零日的四分位**，而不是「當日 ÷ 最大值」——後者只要有一天特別大，其餘全部都會被壓成同一階灰色；
- 標頭可在 **Tokens / 輪次** 之間切換；預設選取**有資料天數較多**的那一個維度（在匯入大量歷史的機器上 Token 稀疏，
  預設畫 Token 會得到幾乎空白的網格）；
- 它**跟隨來源篩選，但不受時間範圍影響**：日曆被篩到只剩 7 天，等於「一年的網格裡只亮 7 格」，那正是熱力圖不該有
  的樣子。

## 在地化

儀表板**遵循 DSH 自身的語言設定**，它沒有自己的語言選擇器：在 DSH 中變更語言，儀表板會立即跟著切換，不需重新
載入。

- `en` 與 `zh` 是 DSH 內建的 locale，本插件為兩者都提供了字典；
- 以下語言包已註冊進 DSH 的目錄，因此會出現在 DSH 自己的選擇器中：`zh-TW`（臺灣正體）、`zh-HK`（香港繁體）、
  `de`、`fr`、`es`、`it`、`ja` 與 `ko`。其餘六個代碼——`pt-BR`、`ru`、`vi`、`th`、`id` 與 `ar`（從右到左）——已設計但
  尚未實作；見[設計文件](docs/superpowers/specs/2026-10-01-i18n-design.md)；
- 文案放在 `locales/<id>.json`，一種語言一個扁平檔案，由 `node scripts/build-dicts.mjs` 產生到 `client.js`。
  絕不要手動編輯產生區塊——它過期時 `npm test` 會失敗；
- 數字、百分比、日期、星期與月份名稱、複數形式全部來自 `Intl`，因此不論是千分位分組方式不同、以 `萬`/`億` 取代英文
  的 `K`/`M`/`B`，或是有複數變化的語言，都會正確顯示；
- `README-<id>.md` 與 `CHANGELOG-<id>.md` 提供十種語言各自的這兩份文件。它們留在儲存庫中供 GitHub 使用；npm 只
  顯示 `README.md`。

## 設定

在 **外掛 → `Token 用量`** 頁面中編輯（即側邊欄的 `Plugins` 入口 → `Token 用量`）：頁面中間會出現兩個輸入框，
標示為 `儀表板「設定窗口」的時間跨度`，以及一顆儲存按鈕。

DSH **不會**從 `Config` schema 自動產生編輯器——自帶設定的插件必須把表單渲染進 `plugins.bundle.config` 槽
（以套件名稱定址）。本插件正是這樣做的：儲存時呼叫官方 `configEditor`，值最終寫入 profile 的 `cordis.patch.yml`，
所以你也可以直接在那裡撰寫：

```yaml
- id: dsh-desktop-token-usage
  disabled: false
  config:
    hours: 6
    days: 7
```

| 鍵 | 預設 | 說明 |
|---|---|---|
| `hours` | `0` | 「設定窗口」區段回報多少小時（0-23）。`0` = 關閉此窗口 |
| `days` | `0` | 「設定窗口」區段回報多少天（1-30）。`0` = 關閉此窗口 |

兩個都關閉（預設）時，卡片顯示累計值，就像這兩個參數存在之前一樣。窗口按**本地時間**取整到小時：「最近 6 小時」
表示從 6 小時前的整點開始算。

變更在儲存後**立即生效**：Cordis 的 `fiber.update()` 會重新啟動本插件的 fiber，`apply` 帶著新設定再執行一次
（所以改值永遠不需要重新啟動 DSH）；儲存後，表單會重新讀取設定並自動重新整理卡片。


## 資料語意

這一節很重要——數字的意義完全由 DSH 的記錄語意決定。

| 指標 | 定義 |
|---|---|
| Token 用量 | `uncached input + output + cache read + cache write` |
| **輸入量**（卡片） | `uncached input + cache read`——即供應商實際收到的所有提示詞 Token |
| **輸出量**（卡片） | `usage.outputTokens`（`reasoningTokens` 是它的**子集**，絕不重複計入） |
| 未快取輸入 | `usage.inputTokens`——**在供應商的原生欄位中，這本來就是未命中快取的那部分**；DSH 自身的投影把它改名為 `uncachedInputTokens` |
| 快取讀取 / 寫入 | `usage.cacheReadTokens` / `usage.cacheWriteTokens` |
| 平均快取命中率 | `cache read ÷ (cache read + uncached input + cache write)`——未命中側包含快取寫入 |
| 請求數 | 結算後的模型呼叫次數（見下方的「折疊」） |
| 完成輪次 | `turn/end` 事件數 |
| 按模型分組 | 模型 id 的**最後一段**：同一個模型，`commandcode` 報成 `deepseek/deepseek-v4.1-flash`、`opencode-go` 報成 `deepseek-v4.1-flash`，兩者折疊進同一列；按供應商分組仍會把兩者分開 |

**折疊語義（容易把數學算錯的地方）**：在同一個 `(turn, step)` 內，較晚的 usage 條目會**取代**較早的那條——
串流數字被最終結算覆寫；只有在 `llm/retry-started` 關閉槽位之後，另一次重試呼叫才會**累加**。所以「總量 = 所有
usage 的總和」是錯的，你必須折疊。本插件的折疊邏輯與 `dsh-token-meter` 中的 `tokenUsage` 投影逐行對應，並有交叉
核對測試涵蓋。

### 來源篩選為什麼只有三個選項

DSH 0.1.7-rc.2 的工作階段記錄**沒有**「用戶端來源」欄位：`SessionHeader` 只有
`version/id/createdAt/cwd/parentSession/isSeeded/origin/delegationDepth/agentPreset`，而 `origin` 唯一取過的值是
`'subagent'`。桌面與網頁無法從本機資料區分。因此儀表板只提供**可由本機訊號推導**的三個選項：

| 標籤 | 判定方式 |
|---|---|
| 桌面 · 網頁 | 存在真實的用戶輪次（`user/message` 且 `source.kind ∈ {user, user-approval}`）並帶有 `source.rpcId` |
| CLI · 機器人 | 有真實的用戶輪次但**沒有** `rpcId`（headless / SDK / ACP / 機器人等，沒有用戶端驅動） |
| 子代理 | `header.origin === 'subagent'` 或 `delegationDepth > 0` |

完全沒有用戶輪次的工作階段（例如只執行過斜線命令的）計入 `全部`，不會單獨列出。

## 已知限制

- **首次聚合很慢**：約 150 個工作階段檔案、90,000+ 筆紀錄，冷啟動約需 3–4 秒；之後按檔案指紋增量，熱呼叫在數百
  毫秒內。快取寫入 `$DSH_HOME/cache/dsh-desktop-token-usage/sessions-index.json`；刪除它只會讓下次執行變慢。
- **匯入的歷史工作階段可能回報零用量**：如果歷史工作階段是匯入的（例如 reasonix 遷移），其 usage 欄位確實全是 0。
  這是有效的資料，不是缺失的資料，本插件不會回退去估算。
- **只有十種語言完成翻譯**：儀表板遵循 DSH 的語言設定，但其文案尚未涵蓋 DSH 可設定的每一種語言；上方「在地化」
  一節列出了仍缺少的六種。
- **窗口取整到小時**：記錄沒有分鐘級的分桶，所以「最近 1 小時」對齊到整點。
- **卡片的重新整理有延遲**：沒有 Host→Client 推送通道，卡片依賴每 5 分鐘一次的靜默重新整理計時器；如果你剛改完
  設定、想立刻更新，點擊卡片開啟儀表板，再按 `重新整理`。

## 驗證狀態

目前完成的驗證（詳見 `docs/DESIGN.md` 的「驗證證據」一節）：

- 折疊結果與 **DSH 自身的投影快取**逐欄位一致（`session-5964a5d3-*`：`286650 / 182633 / 43826560 / 0`）；
- 按日與按模型的彙總都能重新加總回總量，按日/按小時的毫秒區間能精確劃分總量；
- 卡片窗口彙總：每個窗口只能小於或等於累計值、輸入/輸出拆分的恆等式成立，越界參數（`hours=99`/`days=-3`）會被夾緊；
- `Config` schema 透過 Standard Schema 介面驗證：預設 0/0，而 `hours=24` 與 `days=31` 被拒絕；
- Host 描述符與 Client 貢獻在測試中**逐欄位交叉核對**，參數編解碼器接受瀏覽器實際傳送的值；
- Client 的兩半在無瀏覽器環境中以假 React/DOM 渲染通過（涵蓋卡片窗口行與累計回退兩種形態），並對樣式注入與卸載
  有斷言；
- 安裝後 `include:dsh-desktop-token-usage` 的 `fiberPhase` 為 `active`，且 `dsh-desktop-token-usage` 同時出現在
  `sidebar.footer.action` 與 `main` 中（`active: true`）；
- 瀏覽器 → Host 的 RPC 路徑已證明可用（頁面呼叫後，Host 側的索引會被重寫）。

**已確認 / 仍需你確認**：

1. **Host 側的設定鏈路已端到端驗證**：`Config.listConfigs` 回報本插件的 `status: schema`
   （`id: include:dsh-desktop-token-usage`、`name` 為套件名稱）；重新啟動 fiber 後，`boot.json` 的 `windows`
   等於 profile 中設定的 `{hours:5, days:1}`——無論是讀取設定還是透過 `configEditor` 寫回，在作用域套件名稱下都正常
   運作。
2. **用戶端仍需強制重新整理頁面**（Ctrl/Cmd+Shift+R）：外掛頁中間的設定卡由用戶端註冊
   （`plugins.bundle.config` 以**套件名稱**為鍵），必須載入新的用戶端模組才會出現。
3. **Host 模組世代仍需重新啟動一次**：Node 以解析後的 realpath 快取 ESM，因此編輯檔案——甚至重新命名套件——都
   不會重新匯入；實際上 `import('dsh-desktop-token-usage') === import('dsh-desktop-token-usage')` 是同一個模組
   實例。所以熱力圖所依賴的 `payload.heatmap` 等新 Host 程式碼只能靠重新啟動載入；在此之前用戶端會走「缺少
   `heatmap`」的回退。
4. 儀表板的視覺效果（包含重做的熱力圖）需要你親眼確認——這個環境沒有瀏覽器控制。

### 出問題時先看哪裡

兩個自我診斷檔案位於 `$DSH_HOME/cache/dsh-desktop-token-usage/` 底下：

- `boot.json`：Host 啟動鏈路（`appliedAt`/`injectedAt`/`providedAt`/`registeredAt`）與生效的 `windows`；若有
  `error`，會告訴你卡在哪一步。每次 `apply` 都會重寫它，所以 `appliedAt` 是 fiber 最近一次重新掛載的時間；但**它
  無法證明你正在執行最新程式碼**——編輯檔案不會重新匯入模組，只有重新啟動才會。
- `calls.json`：最近 20 次儀表板請求（篩選、窗口、工作階段數、Token 總數、耗時）。**有紀錄證明瀏覽器 → Host 的
  路徑可用；沒有紀錄本身並不能證明路徑壞了**（檔案可能只是被刪了），所以要和 `boot.json` 一起看；如果確實從來沒有
  紀錄，多半是用戶端模組從未載入——**強制重新整理頁面**（Ctrl/Cmd+Shift+R）。

另外，`Config.listConfigs` 回傳的 `status` 可以直接告訴你目前 fiber 的模組有沒有匯出 `Config`：`absent` = 舊的
模組世代（外掛頁上不會有設定卡）；`schema` = 已識別出 schemastery schema（本插件屬於這種）。注意 `schema` 只代表
**可以被驗證**；設定介面仍由插件本身渲染到外掛頁（見上方「設定」一節），DSH 不會從 schema 自動產生表單。
用戶端比 Host 舊也會出問題——這就是為什麼用戶端在拿不到 `card` 欄位時會**回退到累計值**，而不是停在「載入中」。

## 開發

```
npm install     # 安裝 @deepseek-ai/schemastery（link 安裝不會為被連結的套件安裝相依）
npm test        # node --test：聚合基準交叉核對 + 窗口彙總 + 無瀏覽器用戶端煙霧測試
```

測試也會執行 `apply`，所以它們寫入診斷檔案時會指向一個暫存目錄（`DSH_TOKEN_USAGE_DIAG_DIR`），不會覆寫
`$DSH_HOME/cache/dsh-desktop-token-usage/` 底下你想檢查的那兩個檔案。

目錄結構：

```
index.js                     Host 半邊：Config（schemastery）+ 註冊用量 Remote 服務
client.js                    Client 半邊：window __ModuleLoader__ 工廠 + 儀表板與側邊欄入口
lib/session-usage.js         純 Node 聚合：多幀 zstd 讀取、折疊、按小時分桶、窗口彙總、索引快取
test/session-usage.test.mjs  聚合、毫秒區間、卡片窗口、日曆、Config schema、Remote 服務
test/client-smoke.test.mjs   用戶端工廠 / 槽位註冊 / 兩半 wire 契約交叉核對 / 渲染
docs/DESIGN.md               設計、資料契約、踩過的坑與驗證證據
docs/research/               前期研究筆記與可重用的工作階段記錄探測腳本
CHANGELOG.md                 版本歷史（附提交索引）
```

文件共有十種語言：英文是預設（`README.md` / `CHANGELOG.md`），其他每一種語言都有自己的 `README-<id>.md` /
`CHANGELOG-<id>.md`。十種語言全部透過各檔案第 3 行的切換列互相連結。

## 授權

MIT
