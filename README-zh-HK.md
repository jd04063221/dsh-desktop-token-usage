# dsh-desktop-token-usage

[English](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/README.md) | [中文](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/README-zh.md) | [繁體中文（臺灣）](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/README-zh-TW.md) | 繁體中文（香港） | [Deutsch](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/README-de.md) | [Français](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/README-fr.md) | [Español](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/README-es.md) | [Italiano](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/README-it.md) | [日本語](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/README-ja.md) | [한국어](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/README-ko.md)

一個**完全離線**的 DSH（DeepSeek Harness）Token 用量統計插件。

- **Host 半邊**掃描 `$DSH_HOME/sessions/**/session.vN.jsonl.zstd`，折疊出真實的 Token 用量；
- **Client 半邊**在左側邊欄底部掛一張用量卡片；點擊它會在中央面板開啟儀表板：
  時間範圍與來源篩選、6 張統計卡片、一行配置窗口、活動熱力圖、按天 Token 趨勢
  （緩存命中率曲線疊加在 Token 柱上，右側標示真實百分比，Y 軸在統計期最小值／最大值之外各留 10% 餘量）、
  以及模型用量環形圖與清單。

卡片與儀表板的**配置窗口**一行回報哪些時間跨度，由**插件配置**決定（兩個窗口預設都關閉）：
在**設定 → 插件 → `Token 用量`** 裡可以分別啟用「最近 N 小時」（0-23）與「最近 N 天」（1-30）兩個窗口；
兩個都關掉時，兩處都退回單一累計區塊。
這兩個窗口按本地掛鐘時間回溯，**刻意不理會儀表板頂部的來源篩選**——所以它們單獨佔一行，
而不是混在跟隨篩選的統計卡片之中。
同一張設定頁面還可選擇**統計口徑**——按模型、按供應商，或兩者都要（兩者都要時，趨勢部分與拆分部分 `用量拆分`
各多一個可切換的 chip）——以及**配色**——Primer（GitHub 預設）、色盲友好（Okabe–Ito）或低飽和霧面，
每種都有亮色與暗色兩組，並跟隨 DSH 自己的亮／暗開關（`body[data-ds-dark-theme]`），
所以圖表永遠不會與外殼不一致。

側邊欄底部是一條橫向行，與註冊在那裡的其他插件共用，而它們**全部**都宣告了 `width: 100%`——因此誰也擠不進去
（實測：沒有任何干預時，這張卡片被擠到只剩 105.2px）。於是卡片把那一行**變成縱向列**
（`[class*="_footerActions"]:has(.dtu-footCard)`——以類名後綴加上 `:has()` 定位，因此不依賴 DSH 的雜湊類名，
也不會碰到任何祖先元素），讓席位裡每個插件都拿到它按整行寫出的那一行；這張卡片鋪滿整個 256px。
用 `flex-direction` 而不是 `flex-wrap`，是因為外殼會把每個槽位包進一層 `display: contents` 元素——
直接子代選擇器永遠匹配不到席位——而且在縱向列的席位上，`flex-wrap` 的意思是「另起一列」，反而會把卡片擠到鄰居旁邊。
這需要 `:has()`；見下方的相容性表。

不存取網絡、不上報遙測、不調用任何 API：每一個數字都來自本機已有的工作階段日誌。

## 界面截圖

用本插件**自己的元件**配合**範例數據**渲染——截圖由 [`scripts/render-shots.mjs`](scripts/render-shots.mjs)
（真實的 `client.js` 與 CSS，接一個假 Host）加上 [`scripts/render-shots.py`](scripts/render-shots.py)
（無頭 Chrome）離線生成，因此不涉及任何工作階段日誌、路徑或帳號資料。
先是亮色主題，再是暗色主題。截圖統一以中文渲染——第一個腳本接受 `--locale <id>` 可渲染成其他語言——
這份 README 的十種語言變體共用同一組圖片。

![儀表板，亮色主題](assets/dashboard-light.png)

6 張統計卡片、配置窗口一行、活動熱力圖、緩存命中率曲線疊加在柱上的按天 Token 趨勢，以及模型用量拆分。

![儀表板，暗色主題](assets/dashboard-dark.png)

同一個儀表板的暗色主題——每種配色都附有亮色與暗色兩組。

| 活動熱力圖 | 按天趨勢 |
|---|---|
| ![活動熱力圖](assets/heatmap-light.png) | ![按天趨勢](assets/trend-light.png) |

| 側邊欄卡片 | 它在插件管理員中的頁面 |
|---|---|
| ![側邊欄卡片](assets/sidebar-dark.png) | ![設定頁](assets/settings-light.png) |

側邊欄底部那張卡片顯示兩個配置窗口；點擊它會開啟上方的儀表板。插件在插件管理員中的頁面承載窗口跨度、
統計口徑與配色。

## 兼容性與測試環境

**已在 DSH Desktop 0.1.7-rc.2 與 0.2.0-rc.2 上完整驗證，並核對了與 0.2.0-rc.1 的相容性。**

| 項目 | 測試環境 |
|---|---|
| DSH | Desktop `0.1.7-rc.2` 與 `0.2.0-rc.2`（完整驗證）、`0.2.0-rc.1`（相容性核對） |
| 內置運行時 | Electron 44 / Chromium 152 / Node 24.18.1（把席位改成縱向列需要 `:has()`，Chrome 105+；配色主題需要 `light-dark()`，Chrome 123+） |
| 作業系統 | Windows 11 Pro, build 26200, AMD64 |
| Node（用來執行測試） | v25.2.1, v26.7.0 |

驗證遠不止「裝得上」：插件啟用到 `fiberPhase: active`、側邊欄卡片與中央儀表板渲染、插件頁自帶的配置卡可讀可寫、
瀏覽器 → Host 的 Remote 調用端到端打通，以及每個字段都與 DSH 自己的投影緩存交叉核對一致。

`0.2.0-rc.1` 的核對是結構性的，而不是再完整跑一遍：本插件涉及的每一個已發布包都與 `0.1.7-rc.2` 做了 diff——
`dsh-plugin-manager` 逐位元一致；`dsh-client-ui-sidebar`、`dsh-client-ui-layout` 與 `dsh-client-ui-cordis`
只有版本字符串、一行分析調用與標題欄 CSS 的差異。`sidebar.footer.action` 槽位的契約與其 `{ wide }` owner props 未改變，
本插件 import 的套件（`dsh-api-remotes`、`dsh-client-ui-layout`、`dsh-client-ui-sidebar`）名稱也保持不變。
在 `0.2.0-rc.1` 上的手工試用回報儀表板與 Remote 調用正常；`0.2.0-rc.2` 則在本插件自己的開發機上跑了完整驗證：啟用達到 `fiberPhase: active`、側邊欄卡片與中央儀表板發出真實的 Remote 調用（`calls.json`）、`boot.json` 裡生效的窗口與 profile 一致。

本插件**沒有**宣告任何 `@deepseek-ai/dsh*` peer dependency，而這正是 DSH 實際校驗的東西——不宣告 peer 範圍就完全不施加版本約束。`engines.dsh` 宣告為 `^0.1.7-rc.2 || ^0.2.0-rc.1` 純粹給人看：官方文檔明確指出宣告範圍並不會
拒絕不相容的 Host。

**上表以外的版本未經測試。** 更早的 DSH 版本可能缺少本插件用到的 `plugins.bundle.config` 槽位與 `configEditor`
服務（沒有它們就沒有配置卡，配置只能手動編輯 profile patch）；比 `0.2.0-rc.2` 更新的版本尚未驗證。

## 寫入磁盤的內容

插件只讀取工作階段日誌，寫入則全部局限在自己的一個目錄裡：
`$DSH_HOME/cache/dsh-desktop-token-usage/`。不會在工作階段日誌旁寫任何東西，不會在 `$DSH_HOME` 下的其他位置
建立、修改或刪除任何檔案，也從不存取網絡。

| 該目錄下的檔案 | 由誰寫入 | 用途 | 如何關閉 |
|---|---|---|---|
| `sessions-index.json` | `lib/session-usage.js` | 按工作階段的折疊緩存，讓熱調用不必重新掃描每個 `session.vN.jsonl.zstd` | 刪掉它；下次調用會自動重建 |
| `calls.json` | `index.js` | 診斷：最近 20 次 Remote 調用 | `DSH_TOKEN_USAGE_DIAG=0` |
| `boot.json` | `index.js` | 診斷：fiber 最近一次被 apply 的時間 | `DSH_TOKEN_USAGE_DIAG=0` |

兩處寫入都是**原子**的：先在同目錄寫一個 `<name>.<pid>.tmp`，再 rename 覆蓋目標——於是並發讀取者永遠看不到半截檔案，
被殺死的進程也不會留下被截斷的檔案。索引上限 800 條（丟棄最舊的，需要時重新掃描），
崩潰遺留的 `.tmp` 會在下次寫入時清掉。

## 安裝

本倉庫是一個 DSH bundle（`package.json` 宣告了 `dsh.bundle.patch` 與 `dsh.client`）。用官方入口安裝即可，
不需要手動編輯 profile 檔案。本套件已發佈到 npm 官方源，所以直接寫套件名即可——管理器會到註冊表解析它並裝進目前
的 profile：

```
plugin_manager  action: install_bundle  target: dsh-desktop-token-usage
```

想改為從本地目錄安裝（例如跑 `main` 上尚未發佈的版本），把 `install_bundle` 指向本目錄的絕對路徑即可。

```
plugin_manager  action: install_bundle  target: <absolute path to this directory>
```

因為本套件依賴 `@deepseek-ai/schemastery`（官方 Config 卡片所需的 schema 庫），而 `install_bundle` 對本地目錄採用
`link:` 安裝、**不會**為被連結的套件安裝依賴，所以先在本倉庫裡安裝一次：

```
npm install            # installs dev/runtime dependencies only, no network data
```

### 修改代碼之後：Client 熱更新，Host 需要重啟

| 改了哪一半 | 如何生效 |
|---|---|
| `client.js`（介面） | 瀏覽器端的模組快照在 mtime/size 變更後由 HMR 推送到頁面；若沒生效，硬重新整理頁面一次（Ctrl/Cmd+Shift+R） |
| `index.js` / `lib/*`（Host） | **必須重啟 DSH**：重新啟用條目只會重新掛載 fiber，不會重新導入已快取的 JS 模組代。同理，新增或修改 `Config` 字段也要重啟後才會出現在設定裡 |

要判斷目前運行的是哪個版本：檢查 `$DSH_HOME/cache/dsh-desktop-token-usage/boot.json` 是否存在，
以及 `windows` 是否符合預期。

卸載：`plugin_manager action: remove_bundle target: dsh-desktop-token-usage`。

> 套件名稱與插件**行 id** 是兩回事：行 id 是 `dsh-desktop-token-usage`（profile 中配置覆蓋的錨點），
> 套件名稱是 `dsh-desktop-token-usage`。卸載／安裝用套件名稱，改配置用行 id。

## 使用

1. 看**左側邊欄底部**、設定上方那張卡片：按你的配置顯示每個窗口的輸入／輸出量與緩存命中率；
2. 點擊它 → 儀表板在中央面板開啟；
3. 儀表板頂部可按**時間範圍**（最近 7/14/30/90 天、全部、自訂）與**來源**篩選，右下角有一個重新整理按鈕。

篩選與匯總都在 Host 完成：每次變更都會向 Host 發出一次新的聚合請求（Host 持有按檔案 mtime+size 的索引緩存，
熱調用在數百毫秒級）。卡片每 5 分鐘靜默重新整理一次——小時窗口本來就隨時間滑動，所以即使沒有新的用量也應該更新。

### 活動熱力圖怎麼讀

- 它是一份**日曆**（週一起算、近 53 週），帶**月份**與**星期**兩個軸；格子分攤卡片的寬度，
  隨卡片伸縮並保持正方形（11px 是參考尺寸）；
- 色階取**非零日的四分位**，而不是「當日 ÷ 最大值」——後者只要有一天特別大，其餘全部都會被壓成同一檔灰；
- 標題可在 **Tokens / 輪次** 之間切換；預設選**有數據天數較多**的那一維（匯入歷史很多的機器上 token 很稀疏，
  預設按 token 畫會幾乎是空網格）；
- 它**跟隨來源篩選，但不受時間範圍影響**：日曆被篩成 7 天，就等於「一年網格裡亮 7 格」，
  那正是熱力圖不該有的樣子。

## 本地化

儀表板**跟隨 DSH 自身的語言設定**。它沒有自己的語言選擇器：在 DSH 裡改語言，儀表板即時跟著切換，無需重新載入。

- `en` 與 `zh` 是 DSH 內建的 locale，本插件為兩者都提供了字典；
- 以下語言包會註冊進 DSH 的語言目錄，因此會出現在 DSH 自己的選擇器裡：`zh-TW`（臺灣正體）、
  `zh-HK`（香港繁體）、`de`、`fr`、`es`、`it`、`ja` 與 `ko`。其餘六個代碼——`pt-BR`、`ru`、
  `vi`、`th`、`id` 與 `ar`（從右到左）——已設計但尚未實現；見
  [設計稿](docs/superpowers/specs/2026-10-01-i18n-design.md)；
- 文案放在 `locales/<id>.json`，一種語言一個扁平檔案，由 `node scripts/build-dicts.mjs` 生成進 `client.js`。
  絕對不要手動修改生成塊——它過期時 `npm test` 會失敗；
- 數字、百分比、日期、星期與月份名稱，以及複數形式全部來自 `Intl`，因此千分位分組寫法不同、
  在英文寫 `K`/`M`/`B` 的地方寫 `萬`/`億`、或需要複數變化的語言都能正確顯示；
- `README-<id>.md` 與 `CHANGELOG-<id>.md` 以十種語言提供這兩份文檔。它們留在倉庫裡供 GitHub 閱讀；
  npm 只顯示 `README.md`。

## 配置項

在**插件 → `Token 用量`** 頁面編輯（側邊欄的 `Plugins` 入口 → `Token 用量`）：頁面中間插件會畫出
自己的卡片——小時輸入框、天數輸入框、統計口徑與配色的下拉選單，以及一個儲存按鈕。

DSH **不會**從 `Config` schema 自動生成編輯器——自帶配置的插件必須把表單渲染進 `plugins.bundle.config` 槽位
（按套件名稱尋址）。本插件正是這樣做的：儲存時調用官方 `configEditor`，值最終落在 profile 的 `cordis.patch.yml` 裡，
所以你也可以直接在那裡寫：

```yaml
- id: dsh-desktop-token-usage
  disabled: false
  config:
    hours: 6
    days: 7
```

| 鍵 | 預設值 | 說明 |
|---|---|---|
| `hours` | `0` | 配置窗口部分回報多少小時的用量（0-23）。`0` = 關閉該窗口 |
| `days` | `0` | 配置窗口部分回報多少天的用量（1-30）。`0` = 關閉該窗口 |

兩個都關閉（預設）時，卡片顯示累計值，與這兩個參數存在之前一樣。窗口按**本地時間**取整到小時：
「最近 6 小時」＝從 6 小時前的整點開始算。

儲存後**立即生效**：Cordis 的 `fiber.update()` 會重啟本插件的 fiber，`apply` 會帶著新配置再跑一次
（所以改值永遠不需要重啟 DSH）；儲存後，表單會重新讀取配置並自動重新整理卡片。


## 數據口徑

這一節很重要——數字的含義完全由 DSH 的日誌語義決定。

| 指標 | 定義 |
|---|---|
| Tokens 用量 | `uncached input + output + cache read + cache write` |
| **輸入量**（卡片） | `uncached input + cache read`——即供應商實際收到的每一個提示詞 token |
| **輸出量**（卡片） | `usage.outputTokens`（`reasoningTokens` 是它的**子集**，絕不重複計算） |
| 未緩存輸入 | `usage.inputTokens`——**在供應商的原生字段裡，這本來就是未命中緩存的那部分**；DSH 自己的投影把它改名為 `uncachedInputTokens` |
| 緩存讀取 / 寫入 | `usage.cacheReadTokens` / `usage.cacheWriteTokens` |
| 平均緩存命中率 | `cache read ÷ (cache read + uncached input + cache write)`——未命中的一側包含緩存寫入 |
| 請求數 | 結算後的模型調用次數（見下方的「折疊」） |
| 完成輪次 | `turn/end` 事件的數量 |
| 按模型分組 | 模型 id 的**最後一段**：同一個模型從 `commandcode` 來是 `deepseek/deepseek-v4.1-flash`，從 `opencode-go` 來是 `deepseek-v4.1-flash`，兩者會折疊成同一行；按供應商分組則仍會把兩者分開 |

**折疊語義（最容易算錯的地方）**：在同一個 `(turn, step)` 之中，較晚的 usage 條目會**取代**較早的那一條——
串流數字被最終結算覆蓋；只有當 `llm/retry-started` 關閉該時隙之後，另一次重試調用才會**累加**。
所以「總計 = 所有 usage 相加」是錯的，你必須折疊。本插件的折疊邏輯與 `dsh-token-meter` 中的 `tokenUsage` 投影逐行對應，
並有交叉核對測試覆蓋。

### 為什麼來源篩選只有三個選項

DSH 0.1.7-rc.2 的工作階段日誌**沒有**「客戶端來源」字段：`SessionHeader` 只帶
`version/id/createdAt/cwd/parentSession/isSeeded/origin/delegationDepth/agentPreset`，而 `origin` 從來只取過
`'subagent'` 一個值。桌面端與網頁端無法從本地數據區分。因此儀表板只提供**可由本地信號推導**的三個選項：

| 標籤 | 如何判定 |
|---|---|
| 桌面 · 網頁 | 存在真實的用戶輪次（帶 `source.kind ∈ {user, user-approval}` 的 `user/message`），且帶有 `source.rpcId` |
| CLI · 機械人 | 有真實的用戶輪次但**沒有** `rpcId`（無頭／SDK／ACP／機械人之類，沒有客戶端驅動） |
| 子代理 | `header.origin === 'subagent'` 或 `delegationDepth > 0` |

完全沒有用戶輪次的工作階段（例如只執行斜線指令的）會計入 `全部`，不會單獨列出。

## 已知限制

- **首次聚合很慢**：大約 150 個工作階段檔案、90,000+ 條記錄時，冷啟動約需 3–4 秒；之後按檔案指紋增量進行，
  熱調用在數百毫秒級。緩存寫入 `$DSH_HOME/cache/dsh-desktop-token-usage/sessions-index.json`；刪掉它只會讓下一次執行變慢。
- **匯入的歷史工作階段可能回報零用量**：如果一個歷史工作階段是匯入的（例如 reasonix 遷移），
  它的用量字段真的全是 0。那是有效數據，不是缺失數據，本插件不會退回去估算。
- **只翻譯了十種語言**：儀表板會跟隨 DSH 的語言設定，但它的文案尚未覆蓋
  DSH 可設定的每一種語言；上方的「本地化」一節列出了仍然缺少的六種。
- **窗口按小時取整**：日誌沒有分鐘級的桶，所以「最近 1 小時」會對齊到整點。
- **卡片刷新有延遲**：沒有 Host→Client 的推送通道，卡片依靠每 5 分鐘一次的靜默重新整理計時器；
  剛改完配置、或想立刻更新時，點擊卡片打開儀表板，再按 `重新整理`。

## 驗證狀態

目前已完成的驗證（見 `docs/DESIGN.md` 的「驗證證據」一節）：

- 折疊結果與 **DSH 自己的投影緩存**逐字段一致（`session-5964a5d3-*`：`286650 / 182633 / 43826560 / 0`）；
- 按天與按模型的匯總都能加回總計，按天／按小時的毫秒區間恰好分割總計；
- 卡片窗口匯總：每個窗口只可能小於或等於累計值，輸入／輸出拆分恆等式成立，超出範圍的參數（`hours=99`／`days=-3`）會被鉗制；
- `Config` schema 透過 Standard Schema 接口校驗通過：預設 0/0，而 `hours=24` 與 `days=31` 會被拒絕；
- Host 描述符與 Client 貢獻在測試中**逐字段交叉核對**，參數編解碼器接受瀏覽器實際發送的值；
- 兩個 Client 半邊在無瀏覽器環境下用假 React/DOM 渲染（涵蓋卡片窗口行與累計回退），並對樣式注入與卸載有斷言；
- 安裝後，`include:dsh-desktop-token-usage` 的 `fiberPhase` = `active`，且 `dsh-desktop-token-usage` 同時出現在
  `sidebar.footer.action` 與 `main`（`active: true`）；
- 瀏覽器 → Host 的 RPC 路徑已證明可用（頁面調用之後 Host 端索引會被重寫）。

**已確認 ／ 仍需你確認**：

1. **Host 端的配置路徑已端到端驗證**：`Config.listConfigs` 對本插件回報 `status: schema`
   （`id: include:dsh-desktop-token-usage`，`name` 為套件名稱）；重啟 fiber 後，`boot.json` 的
   `windows` 等於 profile 中配置的 `{hours:5, days:1}`——讀取配置與透過 `configEditor` 寫回
   在帶 scope 的套件名稱下都正常運作。
2. **Client 仍需硬重新整理頁面**（Ctrl/Cmd+Shift+R）：插件頁中部的配置卡由 client 註冊
   （`plugins.bundle.config` 按**套件名稱**尋址），必須載入新的 client 模組後才會出現。
3. **Host 模組代仍需重啟一次**：Node 按解析後的 realpath 快取 ESM，所以編輯檔案——甚至重新命名套件——
   都不會重新導入；實際上
   `import('dsh-desktop-token-usage') === import('dsh-desktop-token-usage')` 是同一個模組實例。因此熱力圖依賴的
   `payload.heatmap` 之類新 Host 程式碼只能透過重啟載入；在此之前 client 會走「缺少 `heatmap`」的回退。
4. 儀表板的視覺效果（包括重做後的熱力圖）需要你親眼確認——本環境沒有瀏覽器控制。

### 出問題時先看哪裡

兩個自我診斷檔案位於 `$DSH_HOME/cache/dsh-desktop-token-usage/` 之下：

- `boot.json`：Host 啟動鏈（`appliedAt`／`injectedAt`／`providedAt`／`registeredAt`）與當前生效的
  `windows`；如果有 `error`，它會告訴你哪一步卡住了。每次 `apply` 都會重寫它，所以 `appliedAt` 是
  fiber 最近一次重新掛載的時間；但**它無法證明你正在運行最新程式碼**——編輯檔案不會重新導入模組，只有重啟才會。
- `calls.json`：最近 20 次儀表板請求（篩選條件、窗口、工作階段數、總 token、耗時）。
  **有記錄證明瀏覽器 → Host 路徑可用；沒有記錄本身並不能證明路徑壞了**（檔案可能只是被刪了），
  所以要結合 `boot.json` 一起看；如果確實從來沒有過記錄，多半是 client 模組根本沒載入——**硬重新整理頁面**
  （Ctrl/Cmd+Shift+R）。

另外，`Config.listConfigs` 回傳的 `status` 可以直接告訴你當前 fiber 的模組是否導出 `Config`：
`absent` ＝ 舊的模組代（插件頁上不會有配置卡）；`schema` ＝ 已識別出 schemastery schema
（本插件屬於這種）。注意 `schema` 只表示它**可以被校驗**；配置介面仍由插件自己渲染進插件頁
（見上文「配置項」），DSH 不會從 schema 生成表單。
比 Host 舊的 Client 同樣會出問題——這就是為什麼 Client 拿不到 `card` 字段時會**回退到累計值**，
而不是停在「載入中」。

## 開發

```
npm install     # installs @deepseek-ai/schemastery (a link install does not install dependencies for linked packages)
npm test        # node --test: aggregation golden cross-check + window summaries + browserless client smoke tests
```

測試也會執行 `apply`，所以當它們寫診斷檔案時，指向的是一個臨時目錄（`DSH_TOKEN_USAGE_DIAG_DIR`），
不會覆蓋 `$DSH_HOME/cache/dsh-desktop-token-usage/` 底下你想查看的那兩個檔案。

結構：

```
index.js                     Host half: Config (schemastery) + registration of the usage Remote service
client.js                    Client half: window __ModuleLoader__ factory + dashboard and sidebar entry
lib/session-usage.js         Pure Node aggregation: multi-frame zstd reading, folding, hourly bucketing, window summaries, index cache
test/session-usage.test.mjs  Aggregation, millisecond ranges, card windows, calendar, Config schema, Remote service
test/client-smoke.test.mjs   Client factory / slot registration / two-half wire-contract cross-check / rendering
docs/DESIGN.md               Design, data contracts, pitfalls hit, and verification evidence
docs/research/               Earlier research notes and reusable session-log probe scripts
CHANGELOG.md                 Version history (with a commit index)
```

文檔備有十種語言：英文是預設（`README.md` / `CHANGELOG.md`），其他每種語言都有各自的
`README-<id>.md` / `CHANGELOG-<id>.md`。十份文件都透過各自第 3 行的切換器互相連結。

## 授權條款

MIT
