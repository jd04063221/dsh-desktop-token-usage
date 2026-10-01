# dsh-desktop-token-usage

[English](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/README.md) | [中文](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/README-zh.md) | [繁體中文（臺灣）](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/README-zh-TW.md) | [繁體中文（香港）](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/README-zh-HK.md) | [Deutsch](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/README-de.md) | [Français](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/README-fr.md) | [Español](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/README-es.md) | [Italiano](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/README-it.md) | 日本語 | [한국어](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/README-ko.md)

DSH（DeepSeek Harness）向けの**完全オフライン**のToken使用量統計プラグインです。

- **Host側**は `$DSH_HOME/sessions/**/session.vN.jsonl.zstd` を走査し、実際に使われたToken量を折り畳み算出します；
- **Client側**は左サイドバーの下部に使用量カードを配置します。クリックすると中央パネルにダッシュボードが開き：期間とソースのフィルター、6枚の統計カード、設定ウィンドウの行、アクティビティヒートマップ、日次のTokenトレンド（キャッシュヒット率の曲線をTokenの棒に重ねて表示し、右側に実際のパーセンテージをラベル表示、Y軸は期間の最小・最大から上下10%余分に確保）、そしてモデル別使用量のドーナツチャートとリストが表示されます。

カードとダッシュボードの**設定ウィンドウ**の行が報告する時間範囲は、**プラグイン設定**（2つのウィンドウはデフォルトでオフ）で決まります：**設定 → プラグイン → `Token 用量`**（Token使用量）では、「直近N時間」ウィンドウ（0-23）と「直近N日」ウィンドウ（1-30）をそれぞれ独立に有効化できます。両方をオフにすると、各画面は単一の累積値にフォールバックします。
これらのウィンドウは実時間ベースの「直近」であり、ダッシュボードのソースフィルターは意図的に無視するため、フィルターに追従する統計カードの中には入らず、専用の行に並びます。
同じ設定ページで**集計単位** — モデル別、プロバイダー別、または両方（両方の場合はトレンドセクションと内訳セクション `使用量の内訳` それぞれに切り替え可能なチップが付きます）— と**カラーパレット** — Primer（GitHubデフォルト）、色覚多様性に配慮（Okabe–Ito）、ミュート — も選べます。各パレットはライトセットとダークセットを備え、DSH自身のライト/ダーク切り替え（`body[data-ds-dark-theme]`）に追従するため、チャートがシェルと食い違うことはありません。

サイドバー下部は、そこに登録された他のすべてのプラグインと共有する1つの横並びの行であり、それらはすべて `width: 100%` を宣言しているため — 2つが同じ行を共有することはできません。ライブ計測では、何も挟まらない状態でこのカードは105.2pxに押し込まれます。そこでカードはその行を**列**（`[class*="_footerActions"]:has(.dtu-footCard)` — クラスのサフィックスと `:has()` にキーを置くため、DSHのハッシュ化されたクラス名に依存せず、祖先要素も一切触りません）に変え、座席の各プラグインに本来想定された全幅の行を与えます。このカードは256px全体を占有します。`flex-wrap` ではなく `flex-direction` としたのは、シェルが各スロットを `display: contents` 要素で包むため直接子セレクタは座席に決してマッチせず、さらに列の座席では `flex-wrap` は「別の列を始める」意味になり、代わりにカードを隣のカードの横へ押し出してしまうからです。これには `:has()` が必要です。下の互換性表を参照してください。

ネットワークアクセスも、テレメトリも、API呼び出しもありません：すべての数値は、すでにあなたのマシンにあるセッションログから得られます。

## スクリーンショット

このプラグイン自身のコンポーネントで**サンプルデータ**をレンダリングしたものです — 画像はオフラインで [`scripts/render-shots.mjs`](scripts/render-shots.mjs)（偽のHostに対して実際の `client.js` とCSSを使用）と [`scripts/render-shots.py`](scripts/render-shots.py)（ヘッドレスChrome）によって生成されるため、セッションログ・パス・アカウント情報は一切関与しません。最初がライトテーマ、次がダークテーマです。画像は中国語でレンダリングされています — 最初のスクリプトは `--locale <id>` を受け取り別の言語でレンダリングします — このREADMEの10言語すべての版が同じ画像セットを共有します。

![ダッシュボード、ライトテーマ](assets/dashboard-light.png)

6枚の統計カード、設定ウィンドウの行、アクティビティヒートマップ、キャッシュヒット率の曲線を棒に重ねた日次Tokenトレンド、そしてモデル別使用量の内訳。

![ダッシュボード、ダークテーマ](assets/dashboard-dark.png)

ダークテーマでの同じダッシュボード — 各パレットはライトセットとダークセットを備えています。

| アクティビティヒートマップ | 日次トレンド |
|---|---|
| ![アクティビティヒートマップ](assets/heatmap-light.png) | ![日次トレンド](assets/trend-light.png) |

| サイドバーカード | プラグインマネージャーでのそのページ |
|---|---|
| ![サイドバーカード](assets/sidebar-dark.png) | ![設定](assets/settings-light.png) |

サイドバー下部のカードは2つの設定ウィンドウを表示し、クリックすると上のダッシュボードが開きます。プラグインマネージャーでのプラグインのページには、ウィンドウの時間範囲、集計単位、パレットが備わっています。
## 互換性とテスト環境

**DSH Desktop 0.1.7-rc.2 で完全検証済み、0.2.0-rc.1 で互換性を確認済み、さらにプラグイン0.1.3は 0.2.0-rc.2 で手動試行し問題なし。**

| 項目 | テスト環境 |
|---|---|
| DSH | Desktop `0.1.7-rc.2`（完全検証）、`0.2.0-rc.1`（互換性確認）、`0.2.0-rc.2`（`0.1.3` の手動試行） |
| 同梱ランタイム | Electron 44 / Chromium 152 / Node 24.18.1（座席を列にするには `:has()` が必要（Chrome 105+）。パレットのテーマ付けには `light-dark()` が必要（Chrome 123+）） |
| オペレーティングシステム | Windows 11 Pro, build 26200, AMD64 |
| Node（テスト実行用） | v25.2.1, v26.7.0 |

検証は「インストールできる」をはるかに超えるものでした：プラグインのアクティベーションが `fiberPhase: active` に到達すること、サイドバーカードと中央ダッシュボードのレンダリング、プラグインページの設定カードが読み書き可能であること、ブラウザ → Host のRemote呼び出しが端から端まで動作すること、そして全フィールドがDSH自身のプロジェクションキャッシュと突合で一致すること。

`0.2.0-rc.1` に対する確認は、2回目の完全実行ではなく構造的なチェックでした。このプラグインが触れるすべての公開パケージを `0.1.7-rc.2` と差分比較：`dsh-plugin-manager` はバイト単位で同一、`dsh-client-ui-sidebar`、`dsh-client-ui-layout`、`dsh-client-ui-cordis` ではバージョン文字列・1件の分析呼び出し・タイトルバーCSSのみが異なります。`sidebar.footer.action` スロットの契約とその `{ wide }` owner propsは変わらず、このプラグインがインポートするパケージ（`dsh-api-remotes`、`dsh-client-ui-layout`、`dsh-client-ui-sidebar`）も名前を保っています。`0.2.0-rc.1` での手動試行ではダッシュボードとRemote呼び出しが動作すると報告され、プラグイン `0.1.3` も `0.2.0-rc.2` で手動試行されて同じ結果です。

このプラグインは `@deepseek-ai/dsh*` のpeer dependencyを**宣言しておらず**、DSHが実際に検証しているのはそれです — peerレンジがなければバージョン制約はまったく課されません。`engines.dsh` は `^0.1.7-rc.2 || ^0.2.0-rc.1` と宣言されていますが、これは人間向けの記録にすぎません：公式ドキュメントには、レンジを宣言しても互換性のないHostを拒否しないと明記されています。

**上表以外のバージョンは未テストです。** より古いDSHビルドには、このプラグインが使う `plugins.bundle.config` スロットと `configEditor` サービスがない可能性があります（それらがなければ設定カードはなく、設定はprofile patchを手で編集するしかありません）。`0.2.0-rc.2` より新しいビルドはまだ検証されていません。

## ディスクに書き込むもの

プラグインはセッションログを読み取り、書き込みは自分の1つのディレクトリの中だけです：
`$DSH_HOME/cache/dsh-desktop-token-usage/`。セッションログの隣に何かを書くことはなく、`$DSH_HOME` 配下の他の場所に何かを作成・変更・削除することも、ネットワークアクセスをすることもありません。

| そのディレクトリ内のファイル | 書き込み元 | 用途 | 無効化する方法 |
|---|---|---|---|
| `sessions-index.json` | `lib/session-usage.js` | セッションごとのフォールドキャッシュ。ウォームな呼び出しで `session.vN.jsonl.zstd` を再スキャンしないために使う | 削除する。次の呼び出しで再構築される |
| `calls.json` | `index.js` | 診断：直近20件のRemote呼び出し | `DSH_TOKEN_USAGE_DIAG=0` |
| `boot.json` | `index.js` | 診断：fiberが最後にapplyされた時刻 | `DSH_TOKEN_USAGE_DIAG=0` |

両方の書き込みは**アトミック**です：同じディレクトリに `<name>.<pid>.tmp` を書き込み、ターゲットへrenameします。そのため並行する読み取り側が部分的なファイルを見ることはなく、殺されたプロセスが切り詰められたファイルを残すこともありません。インデックスは800件に上限され（古いものが捨てられ、必要に応じて再スキャン）、クラッシュで残った `.tmp` は次の書き込み時に掃除されます。

## インストール

このリポジトリはDSHバンドルです（`package.json` は `dsh.bundle.patch` と `dsh.client` を宣言しています）。公式のエントリポイントからインストールしてください。profileファイルを手で編集する必要はありません：

```
plugin_manager  action: install_bundle  target: <absolute path to this directory>
```

このパケージは `@deepseek-ai/schemastery`（公式のConfigカードが必要とするスキーマライブラリ）に依存し、`install_bundle` はローカルディレクトリに `link:` インストールを使うため、リンクされたパケージの依存は**インストールしません**。先にこのリポジトリの中で一度インストールしてください：

```
npm install            # installs dev/runtime dependencies only, no network data
```

### コード編集後：クライアントはホットリロード、Hostは再起動が必要

| 変更した半側 | 有効になる方法 |
|---|---|
| `client.js`（UI） | ブラウザ側のモジュールスナップショットは、mtime/sizeが変わるとHMRでページにプッシュされます。反映されない場合はページをハードリロード（Ctrl/Cmd+Shift+R）してください |
| `index.js` / `lib/*`（Host） | **DSHの再起動が必要**：エントリを再有効化してもfiberの再マウントだけで、キャッシュされたJSモジュール世代を再インポートしません。同様に `Config` フィールドの追加・変更も、設定に表示されるまで再起動が必要です |

現在どのバージョンが動いているかの判別：`$DSH_HOME/cache/dsh-desktop-token-usage/boot.json` が存在するか、`windows` が期待どおりかを確認します。

アンインストール：`plugin_manager action: remove_bundle target: dsh-desktop-token-usage`。

> パケージ名とプラグインの**行id**は別物です：行idは `dsh-desktop-token-usage`（profileにおける設定オーバーライドのアンカー）で、
> パケージ名も `dsh-desktop-token-usage` です。アンインストール/インストールにはパケージ名を使い、設定変更には行idを使います。
## 使い方

1. **左サイドバーの下部**、設定の上のカードを見ます：設定に応じて各ウィンドウの入力/出力量とキャッシュヒット率が表示されます；
2. クリック → 中央パネルにダッシュボードが開きます；
3. ダッシュボードの上部で**時間範囲**（直近7/14/30/90日、全期間、カスタム）と**ソース**でフィルターでき；
   更新ボタンは右下にあります。

フィルターと集計はいずれもHost内で行われます：変更のたびにHostへ新しい集計リクエストが送られます（Hostはファイルのmtime+sizeをキーにしたインデックスキャッシュを持つため、ウォームな呼び出しは数百ミリ秒です）。カードは5分ごとに静かに更新されます — 時間ウィンドウは時計に合わせてスライドするので、新しい使用量がなくても更新されるはずです。

### アクティビティヒートマップの読み方

- **カレンダー**（月曜起点、直近53週）で、**月**と**曜日**の軸を持ちます。セルはカードの幅を分配して使うため、それに伴って伸びつつ正方形を保ちます（11pxが基準サイズ）；
- 色スケールは「日 ÷ 最大値」ではなく、**0でない日の四分位数**を使います。後者だと、異常に大きい1日が他のすべてを同じ灰色に押し込めます；
- ヘッダーで **Tokens / ターン** を切り替えます。デフォルトは**データがある日数が多い**方の指標です（履歴を大量にインポートしたマシンではトークンは疎らなので、デフォルトでトークンを描くとほぼ空のグリッドになります）；
- **ソースフィルターには追従しますが、時間範囲の影響は受けません**：7日に絞り込んだカレンダーは「1年のグリッドの中で7個だけ光るセル」の意味になり、ヒートマップとしてまったく望ましくない姿になります。

## ローカライゼーション

ダッシュボードは**DSH自身の言語設定**に従います。独自の言語選択器は持たず、DSHの言語を変えればダッシュボードもリロードなしですぐに切り替わります。

- `en` と `zh` はDSHの組み込みロケールで、このプラグインはどちらにも辞書を同梱しています；
- 以下の言語パックはDSHのカタログに登録されているため、DSH自身のセレクタに表示されます：`zh-TW`（臺灣正體）、`zh-HK`（香港繁體）、`de`、`fr`、`es`、`it`、`ja`、`ko`。残りの6つのコード — `pt-BR`、`ru`、`vi`、`th`、`id`、`ar`（右から左）— は設計済みですが未実装です。[設計](docs/superpowers/specs/2026-10-01-i18n-design.md) を参照してください；
- コピーは `locales/<id>.json` に1言語1つのフラットなファイルで置かれ、`node scripts/build-dicts.mjs` により `client.js` に生成されます。生成ブロックを決して手で編集しないでください — 古いままだと `npm test` が失敗します；
- 数字、パーセンテージ、日付、曜日・月の名前、複数形はすべて `Intl` 由来なので、千の区切り方が違う言語、英語が `K`/`M`/`B` と書くところに `萬`/`億` を書く言語、複数形を活用する言語でも正しく表示されます；
- `README-<id>.md` と `CHANGELOG-<id>.md` は10言語それぞれで両ドキュメントを提供しています。GitHubのためにリポジトリに置かれ、npmが表示するのは `README.md` のみです。

## 設定

**プラグイン → `Token 用量`** のページ（Token使用量）— サイドバーの `Plugins` エントリ → `Token 用量` — で編集します：ページの中央ではプラグインが独自のカードを描画します — 時間数の入力欄、日数の入力欄、集計単位とパレットの選択、そして保存ボタンです。

DSHは `Config` スキーマから編集器を**自動生成しません** — 自分で設定を持つプラグインは、フォームを `plugins.bundle.config` スロット（パケージ名でアドレス指定）にレンダリングしなければなりません。このプラグインもまさにそれを行っています：保存時に公式の `configEditor` を呼び、値はprofileの `cordis.patch.yml` に入るため、直接そこで書くこともできます：

```yaml
- id: dsh-desktop-token-usage
  disabled: false
  config:
    hours: 6
    days: 7
```

| キー | デフォルト | 説明 |
|---|---|---|
| `hours` | `0` | 設定ウィンドウセクションが報告する時間数（0-23）。`0` = このウィンドウをオフにする |
| `days` | `0` | 設定ウィンドウセクションが報告する日数（1-30）。`0` = このウィンドウをオフにする |

両方オフ（デフォルト）のとき、カードはこの2つのパラメータが存在する前と同じように累積値を表示します。ウィンドウは**ローカル時間**で時間単位に丸められます：「直近6時間」は6時間前の時刻の先頭から始まる意味です。

変更は保存後**すぐに**有効になります：Cordisの `fiber.update()` はこのプラグインのfiberを再起動し、`apply` が新しい設定でもう一度実行されるため（値を変更するためにDSHを再起動する必要は決してありません）、保存後フォームは設定を再読み込みし、カードを自動的に更新します。


## データの意味

このセクションは重要です — 数値の意味はDSHのログの意味論に完全に決定されます。

| 指標 | 定義 |
|---|---|
| Token使用量 | `uncached input + output + cache read + cache write` |
| **入力量**（カード） | `uncached input + cache read` — つまりプロバイダーが実際に受け取ったすべてのプロンプトトークン |
| **出力量**（カード） | `usage.outputTokens`（`reasoningTokens` はその**部分集合**であり、二重計上はされません） |
| 未キャッシュ入力 | `usage.inputTokens` — **プロバイダーのネイティブフィールドでは、これはすでにキャッシュミスした部分です**。DSH自身のプロジェクションはこれを `uncachedInputTokens` と改名します |
| キャッシュ読み取り / 書き込み | `usage.cacheReadTokens` / `usage.cacheWriteTokens` |
| 平均キャッシュヒット率 | `cache read ÷ (cache read + uncached input + cache write)` — ミス側にはキャッシュ書き込みが含まれます |
| リクエスト数 | 精算後のモデル呼び出し回数（下の「フォールド」を参照） |
| 完了ターン | `turn/end` イベントの数 |
| モデル別集計 | モデルidの**最後のセグメント**：ある1つのモデルが `commandcode` からは `deepseek/deepseek-v4.1-flash`、`opencode-go` からは `deepseek-v4.1-flash` として届き、両者は1行に折り畳まれます。プロバイダー別集計でも2つは分離されたままです |

**フォールドの意味論（計算を間違えやすい箇所）**：同じ `(turn, step)` の中では、後の方の使用量エントリが前のものを**置き換えます** — ストリーミング中の数値は最終精算で上書きされるからです。`llm/retry-started` がスロットを閉じた後にはじめて、リトライの別呼び出しが**累加**します。つまり「合計 = すべての使用量の和」は間違いで、折り畳まなければなりません。このプラグインのフォールドロジックは `dsh-token-meter` の `tokenUsage` 投影と1行ずつ対応しており、突合テストでカバーされています。

### なぜソースフィルターの選択肢は3つだけなのか

DSH 0.1.7-rc.2 のセッションログには「クライアントのソース」フィールドが**ありません**：`SessionHeader` が持つのは `version/id/createdAt/cwd/parentSession/isSeeded/origin/delegationDepth/agentPreset` だけで、`origin` が取る値は `'subagent'` のみです。デスクトップとWebはローカルデータでは区別できません。そのためダッシュボードは**ローカルのシグナルから導出できる**3つの選択肢だけを提供します：

| ラベル | 判定方法 |
|---|---|
| デスクトップ · Web | 実在のユーザーターンがあり（`source.kind ∈ {user, user-approval}` の `user/message`）、`source.rpcId` を持つ |
| CLI · ボット | 実在のユーザーターンがあるが `rpcId` が**ない**（ヘッドレス / SDK / ACP / ボットなど、クライアントが駆動しないもの） |
| サブエージェント | `header.origin === 'subagent'` または `delegationDepth > 0` |

ユーザーターンが一つもないセッション（例：スラッシュコマンドだけを実行したもの）は `すべて`（all）に計上され、個別には一覧されません。

## 既知の制限

- **最初の集計は遅い**：セッションファイル約150個・レコード90,000件超で、コールドスタートは約3〜4秒です。その後はファイルのフィンガープリントによる増分処理になり、ウォームな呼び出しは数百ミリ秒になります。キャッシュは `$DSH_HOME/cache/dsh-desktop-token-usage/sessions-index.json` に書き込まれます。削除しても次の実行が遅くなるだけです。
- **インポートされた過去のセッションは使用量0を報告することがあります**：過去のセッションがインポートされていた場合（例：reasonixからの移行）、その使用量フィールドは本当にすべて0です。これは欠損データではなく有効なデータであり、このプラグインは推定で補うことはしません。
- **翻訳されたのは10言語のみです**：ダッシュボードはDSHの言語設定に追従しますが、その文言はDSHで設定できるすべての
  言語をまだカバーしていません。上のローカライゼーションの節に、未対応の6言語を挙げています。
- **ウィンドウは時間単位に丸められます**：ログに分単位のバケットがないため、「直近1時間」は時刻の先頭に整列します。
- **カードの更新には遅延があります**：Host→Clientのプッシュチャネルがないため、カードは5分ごとのサイレント更新タイマーに依存します。設定を変更した直後ですぐに更新したいときは、カードをクリックしてダッシュボードを開き、`更新`（refresh）を押してください。

## 検証状況

これまでに完了した検証（`docs/DESIGN.md` の「検証エビデンス」節を参照）：

- 折り畳み結果が**DSH自身のプロジェクションキャッシュ**とフィールド単位で一致（`session-5964a5d3-*`：`286650 / 182633 / 43826560 / 0`）；
- 日次・モデル別のどちらの集計も合計に再加算でき、日次/時間次のミリ秒区間が合計を正確に分割します；
- カードのウィンドウ集計：各ウィンドウは累積値以下にしかならず、入力/出力の分割恒等式が成立し、範囲外パラメータ（`hours=99`/`days=-3`）はクランプされます；
- `Config` スキーマはStandard Schemaインターフェースで検証されます：デフォルト0/0、`hours=24` と `days=31` は拒否されます；
- Host記述子とClient貢献はテストで**フィールド単位の突合**が行われ、パラメータのコーデックはブラウザが実際に送る値を受け付けます；
- Clientの両半分はブラウザのない環境で偽のReact/DOMによりレンダリングされます（カードのウィンドウ行と累積フォールバックの両方をカバー）。スタイル注入とアンマウントにアサートがあります；
- インストール後、`include:dsh-desktop-token-usage` の `fiberPhase` = `active`、`dsh-desktop-token-usage` は `sidebar.footer.action` と `main` の両方に出現（`active: true`）；
- ブラウザ → Host のRPCパスが動作することが証明されています（ページ呼び出し後にHost側インデックスが書き換えられます）。

**確認済み / あなたによる確認が必要なもの**：

1. **Host側の設定パスはエンドツーエンドで検証済み**：`Config.listConfigs` はこのプラグインに `status: schema` を報告します（`id: include:dsh-desktop-token-usage`、`name` はパケージ名）。fiber再起動後、`boot.json` の `windows` はprofileに設定された `{hours:5, days:1}` と一致します — 設定の読み取りと `configEditor` 経由の書き戻しの両方が、スコープ付きパケージ名の下で正しく機能します。
2. **クライアントはまだハードリロードが必要です**（Ctrl/Cmd+Shift+R）：プラグインページ中央の設定カードはクライアントが登録するもの（`plugins.bundle.config` は**パケージ名**をキーにする）で、新しいクライアントモジュールが読み込まれるまで表示されません。
3. **Hostモジュール世代にはまだ再起動が1回必要です**：Nodeは解決後のrealpathでESMをキャッシュするため、ファイルを編集しても — パケージ名を変更しても — 再インポートは起きません。実際 `import('dsh-desktop-token-usage') === import('dsh-desktop-token-usage')` は同じモジュールインスタンスです。そのため、ヒートマップが依存する `payload.heatmap` といった新しいHostコードは再起動によってのみ読み込めます。それまでクライアントは「`heatmap` が欠けている」フォールバックを取ります。
4. ダッシュボードの見た目（作り直したヒートマップを含む）はあなたの目で確認する必要があります — この環境にはブラウザ操作がありません。

### 何かが壊れたときに見る場所

`$DSH_HOME/cache/dsh-desktop-token-usage/` の下に自己診断ファイルが2つあります：

- `boot.json`：Hostのアクティベーションチェーン（`appliedAt`/`injectedAt`/`providedAt`/`registeredAt`）と有効な `windows`。`error` があれば、どのステップで止まったかを教えてくれます。毎回の `apply` がこれを書き換えるため、`appliedAt` はfiberの最新の再マウント時刻です。しかし**実行中のコードが最新である証明にはなりません** — ファイル編集ではモジュールは再インポートされず、再起動のみがそれを起こします。
- `calls.json`：直近20件のダッシュボードリクエスト（フィルター、ウィンドウ、セッション数、合計Token、経過時間）。**記録があることはブラウザ → Host パスが動く証明です。記録がないことはそれ単体ではパスが壊れている証明になりません**（単にファイルが削除されただけの可能性もある）ので、`boot.json` と合わせて読みます。記録が本当に一度もない場合、クライアントモジュールがほとんど確実に読み込まれていません — **ページをハードリロードしてください**（Ctrl/Cmd+Shift+R）。

さらに、`Config.listConfigs` の `status` は、現在のfiberのモジュールが `Config` をエクスポートしているかを直接教えてくれます：`absent` = 古いモジュール世代（プラグインページに設定カードはありません）；`schema` = schemasteryスキーマが認識された（このプラグインはこの場合）。なお `schema` は**検証可能である**というだけです。設定UIは今でもプラグイン自身がプラグインページにレンダリングします（上の「設定」節を参照）。DSHがスキーマからフォームを生成することはありません。
Hostより古いクライアントも問題を起こします — そのためクライアントは `card` フィールドが取得できないとき「読み取り中」のまま留まらず、**累積値にフォールバック**します。

## 開発

```
npm install     # installs @deepseek-ai/schemastery (a link install does not install dependencies for linked packages)
npm test        # node --test: aggregation golden cross-check + window summaries + browserless client smoke tests
```

テストは `apply` も実行するため、診断ファイルを書くときは一時ディレクトリ（`DSH_TOKEN_USAGE_DIAG_DIR`）を指し、`$DSH_HOME/cache/dsh-desktop-token-usage/` の下で確認したい2つのファイルを上書きしません。

レイアウト：

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

ドキュメントは10言語で用意されています：デフォルトは英語（`README.md` / `CHANGELOG.md`）、それ以外の言語はそれぞれ
独自の `README-<id>.md` / `CHANGELOG-<id>.md` を持ちます。10言語すべては、各ファイルの3行目のスイッチャーで相互にリンクされています。

## ライセンス

MIT
