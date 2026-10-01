# dsh-desktop-token-usage

[English](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/README.md) | [中文](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/README-zh.md) | [繁體中文（臺灣）](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/README-zh-TW.md) | [繁體中文（香港）](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/README-zh-HK.md) | [Deutsch](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/README-de.md) | [Français](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/README-fr.md) | [Español](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/README-es.md) | [Italiano](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/README-it.md) | [日本語](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/README-ja.md) | 한국어

DSH(DeepSeek Harness)용 **완전 오프라인** Token 사용량 통계 플러그인입니다.

- **Host 쪽**은 `$DSH_HOME/sessions/**/session.vN.jsonl.zstd`를 스캔해 폴딩으로 실제 Token 사용량을 뽑아냅니다;
- **Client 쪽**은 왼쪽 사이드바 하단에 사용량 카드를 얹습니다. 클릭하면 중앙 패널에 대시보드가 열립니다: 시간 범위와
  소스 필터, 통계 카드 6장, **설정된 윈도우** 행, 활동 히트맵, 일별 Token 추세(Token 막대 위에 캐시 적중률 곡선을
  겹치고 오른쪽에 실제 백분율을 표시하며 세로축은 기간의 최소/최대보다 10% 여유를 둠), 그리고 모델 사용량 도넛
  차트와 목록입니다.

카드와 대시보드의 **설정된 윈도우** 행이 어느 기간을 보여줄지는 **플러그인 설정**으로 정합니다(두 윈도우 모두 기본값은
꺼져 있습니다): **설정 → 플러그인 → `Token 用量`**(Token 사용량)에서 "최근 N시간" 윈도우(0-23)와 "최근 N일"
윈도우(1-30)를 각각 켤 수 있고, 둘 다 끄면 각 화면은 하나의 누적 블록으로 돌아갑니다.
이 윈도우들은 실제 경과 시간 기준이라 대시보드의 소스 필터를 일부러 무시하므로, 필터를 따르는 통계 카드들 사이가 아니라
자기만의 행에 놓입니다.
같은 설정 페이지에서 **분류** — 모델별, 공급자별, 또는 둘 다(둘 다면 추세 섹션과 `사용량 구성` 섹션에 각각 전환 가능한
칩이 생김) — 와 **팔레트** — `primer`(`Primer(GitHub 기본값)`), `cvd`(`색각 장애 친화적(Okabe–Ito)`),
`muted`(`저채도`) — 를 고릅니다. 각 팔레트에는 DSH 자체의 밝기/어두움 토글(`body[data-ds-dark-theme]`)을 따르는
밝은색·어두운색 세트가 있어 차트가 셸과 절대 어긋나지 않습니다.

사이드바 하단은 그곳에 등록된 다른 플러그인들과 모두가 공유하는 가로 한 줄인데, 각자 `width: 100%`를 선언하기 때문에
둘 이상이 한 줄을 나눌 수 없습니다. 실측 기준 아무것도 개입하지 않으면 이 카드는 105.2px로 눌립니다. 그래서 카드는
그 줄을 **세로 열**로 바꿉니다(`[class*="_footerActions"]:has(.dtu-footCard)` — 클래스 이름 뒷부분에 `:has()`를
붙여 찾으므로 DSH의 해시 클래스 이름에 의존하지 않고 조상 요소도 건드리지 않습니다). 이렇게 하면 자리에 있는 각
플러그인이 처음에 설계된 가로 한 줄을 온전히 얻고, 이 카드는 256px 전체를 차지합니다. `flex-wrap`이 아니라
`flex-direction`을 쓰는 이유는, 셸이 각 슬롯을 `display: contents` 요소로 감싸 직접 자식 선택자가 자리에 절대 매치되지
않고, 열 자리에서 `flex-wrap`은 "다른 열을 시작하라"는 뜻이 되어 카드를 옆으로 밀어버리기 때문입니다. 이때 `:has()`가
필요합니다. 아래 호환성 표를 보세요.

네트워크 접근 없음, 텔레메트리 없음, API 호출 없음: 모든 숫자는 이미 이 기기에 있는 세션 로그에서 나옵니다.

## 스크린샷

이 플러그인 자신의 컴포넌트로 **샘플 데이터**를 렌더링한 것입니다 — 스크린샷은
[`scripts/render-shots.mjs`](scripts/render-shots.mjs)(실제 `client.js`와 CSS에 가짜 Host를 물린 방식)와
[`scripts/render-shots.py`](scripts/render-shots.py)(headless Chrome)가 오프라인으로 생성하므로, 세션 로그·경로·
계정 정보가 하나도 포함되지 않습니다. 먼저 밝은 테마, 다음에 어두운 테마입니다. 스크린샷은 중국어로 렌더링되어
있으며 — 첫 번째 스크립트는 `--locale <id>`를 받아 다른 언어로 렌더링합니다 — 이 README의 열 가지 언어 버전이 모두
같은 이미지 세트를 공유합니다.

![대시보드, 밝은 테마](assets/dashboard-light.png)

통계 카드 6장, 설정된 윈도우 행, 활동 히트맵, 막대 위에 캐시 적중률 곡선을 겹친 일별 Token 추세, 그리고 모델 사용량
구성입니다.

![대시보드, 어두운 테마](assets/dashboard-dark.png)

어두운 테마의 같은 대시보드 — 각 팔레트에는 밝은색·어두운색 세트가 있습니다.

| 활동 히트맵 | 일별 추세 |
|---|---|
| ![활동 히트맵](assets/heatmap-light.png) | ![일별 추세](assets/trend-light.png) |

| 사이드바 카드 | 플러그인 관리자의 해당 페이지 |
|---|---|
| ![사이드바 카드](assets/sidebar-dark.png) | ![설정](assets/settings-light.png) |

사이드바 하단의 카드는 설정된 두 윈도우를 보여주고, 클릭하면 위의 대시보드가 열립니다. 플러그인 관리자 속 이 플러그인의
페이지에는 윈도우 기간, 분류, 팔레트가 있습니다.

## 호환성 및 테스트 환경

**DSH Desktop 0.1.7-rc.2에서 완전히 검증했고, 0.2.0-rc.1은 호환성을 확인했으며, 플러그인 0.1.3은 0.2.0-rc.2에서 직접
시험해 문제 없었습니다.**

| 항목 | 테스트 환경 |
|---|---|
| DSH | Desktop `0.1.7-rc.2` (전체 검증), `0.2.0-rc.1` (호환성 확인), `0.2.0-rc.2` (`0.1.3` 수동 시연) |
| 번들 런타임 | Electron 44 / Chromium 152 / Node 24.18.1 (자리를 세로 열로 바꾸려면 `:has()`, Chrome 105+; 팔레트 테마에는 `light-dark()`, Chrome 123+) |
| 운영 체제 | Windows 11 Pro, build 26200, AMD64 |
| Node (테스트 실행용) | v25.2.1, v26.7.0 |

검증은 단순히 "설치됩니다"를 훨씬 넘었습니다: 플러그인 활성화가 `fiberPhase: active`에 이르는 것, 사이드바 카드와 중앙
대시보드의 렌더링, 플러그인 페이지가 지닌 설정 카드의 읽기·쓰기 가능 여부, 브라우저 → Host의 Remote 호출이 양끝까지
동작하는 것, 그리고 모든 필드가 DSH 자체 프로젝션 캐시와 교차 대조에서 일치하는 것까지 확인했습니다.

`0.2.0-rc.1`에 대한 확인은 두 번째 완전한 실행이 아니라 구조적 점검이었습니다. 이 플러그인이 건드리는 모든 공개
패키지를 `0.1.7-rc.2`와 diff했습니다: `dsh-plugin-manager`는 바이트 단위로 동일하고, `dsh-client-ui-sidebar`,
`dsh-client-ui-layout`, `dsh-client-ui-cordis`에는 버전 문자열, 분석 호출 하나, 타이틀바 CSS만 다릅니다.
`sidebar.footer.action` 슬롯 계약과 그 `{ wide }` owner props는 그대로이며, 이 플러그인이 import하는
패키지(`dsh-api-remotes`, `dsh-client-ui-layout`, `dsh-client-ui-sidebar`)도 이름을 유지합니다. `0.2.0-rc.1`에서의
수동 시험은 대시보드와 Remote 호출이 동작한다고 보고했고, 플러그인 `0.1.3` 역시 `0.2.0-rc.2`에서 수동으로 시험해 같은
결과를 보고했습니다.

이 플러그인은 `@deepseek-ai/dsh*` peer dependency를 **선언하지 않으며**, DSH가 실제로 검증하는 것도 바로 그것입니다 —
peer 범위가 없으면 아무 버전 제한도 걸리지 않습니다. `engines.dsh`는 `^0.1.7-rc.2 || ^0.2.0-rc.1`로 선언되어 있지만
이것은 사람을 위한 것입니다: 공식 문서는 범위를 선언해도 호환되지 않는 Host가 거부되지는 않는다고 명시합니다.

**위 표에 없는 버전은 테스트하지 않았습니다.** 더 이전의 DSH 빌드에는 이 플러그인이 쓰는 `plugins.bundle.config` 슬롯과
`configEditor` 서비스가 없을 수 있습니다(없으면 설정 카드가 없고, 설정은 profile 패치를 손으로 수정해서만 바꿀 수
있습니다). `0.2.0-rc.2`보다 새로운 빌드는 아직 검증하지 않았습니다.

## 디스크에 쓰는 것

플러그인은 세션 로그를 읽고, 쓰기는 오직 자기 디렉터리 하나 안에서만 합니다:
`$DSH_HOME/cache/dsh-desktop-token-usage/`. 세션 로그 옆에는 아무것도 쓰지 않고, `$DSH_HOME` 아래 다른 곳에 파일을
만들거나 수정하거나 삭제하지 않으며, 네트워크에는 절대 접속하지 않습니다.

| 그 디렉터리 안의 파일 | 작성 주체 | 용도 | 끄는 방법 |
|---|---|---|---|
| `sessions-index.json` | `lib/session-usage.js` | 세션별 폴딩 캐시. 데운 호출이 모든 `session.vN.jsonl.zstd`를 다시 스캔하지 않도록 | 삭제하면 됩니다. 다음 호출 때 다시 만들어집니다 |
| `calls.json` | `index.js` | 진단: 최근 Remote 호출 20건 | `DSH_TOKEN_USAGE_DIAG=0` |
| `boot.json` | `index.js` | 진단: fiber가 마지막으로 적용된 시각 | `DSH_TOKEN_USAGE_DIAG=0` |

두 작성기는 모두 **원자적**입니다: 대상 옆에 `<name>.<pid>.tmp`를 쓴 뒤 그 위에 rename하므로, 동시에 읽는 쪽은 절대
반쪽짜리 파일을 보지 못하고 죽은 프로세스가 잘린 파일을 남기지 않습니다. 인덱스는 최대 800건(가장 오래된 것부터 버리고
필요할 때 다시 스캔)이며, 충돌이 남긴 `.tmp`는 다음 쓰기 때 정리됩니다.

## 설치

이 저장소는 DSH 번들입니다(`package.json`는 `dsh.bundle.patch`와 `dsh.client`를 선언합니다). 공식 진입점을 통해
설치하면 되며, profile 파일을 손으로 수정할 필요는 없습니다:

```
plugin_manager  action: install_bundle  target: <absolute path to this directory>
```

이 패키지는 `@deepseek-ai/schemastery`(공식 Config 카드가 필요로 하는 스키마 라이브러리)에 의존하는데,
`install_bundle`은 로컬 디렉터리에 `link:` 설치를 쓰고 링크된 패키지에는 의존성을 **설치하지 않으므로**, 먼저 이 저장소
안에서 한 번 설치합니다:

```
npm install            # installs dev/runtime dependencies only, no network data
```

### 코드 수정 후: 클라이언트는 핫 리로드, Host는 재시작이 필요

| 바꾼 쪽 | 적용 방식 |
|---|---|
| `client.js` (UI) | 브라우저 쪽 모듈 스냅샷은 mtime/size가 바뀌면 HMR이 페이지로 밀어줍니다. 적용되지 않으면 페이지를 한 번 하드 새로고침하세요(Ctrl/Cmd+Shift+R) |
| `index.js` / `lib/*` (Host) | **DSH를 재시작해야 합니다**: 항목을 다시 켜면 fiber를 다시 얹을 뿐, 캐시된 JS 모듈 세대를 다시 import하지 않습니다. 마찬가지로 `Config` 필드를 추가하거나 바꾸어도 설정에 나타나려면 재시작이 필요합니다 |

현재 실행 중인 버전을 가려내는 법: `$DSH_HOME/cache/dsh-desktop-token-usage/boot.json`이 존재하는지, `windows`가
기대와 일치하는지 확인합니다.

제거: `plugin_manager action: remove_bundle target: dsh-desktop-token-usage`.

> 패키지 이름과 플러그인 **row id**는 서로 다른 것입니다: row id는 `dsh-desktop-token-usage`(profile에서 설정
> 덮어쓰기의 앵커)이고, 패키지 이름은 `dsh-desktop-token-usage`. 제거/설치에는 패키지 이름을, 설정 변경에는 row id를
> 사용하세요.

## 사용법

1. **왼쪽 사이드바 하단**, 설정 위의 카드를 봅니다: 설정에 따라 각 윈도우의 입력/출력량과 캐시 적중률을 보여줍니다;
2. 클릭하면 → 중앙 패널에 대시보드가 열립니다;
3. 대시보드 상단에서 **시간 범위**(최근 7/14/30/90일, 전체, 사용자 지정)와 **소스**로 필터링할 수 있습니다;
   새로고침 버튼은 오른쪽 아래 모서리에 있습니다.

필터링과 집계는 모두 Host에서 일어납니다: 변경할 때마다 Host에 새 집계 요청을 보냅니다(Host는 파일 mtime+size를 키로
하는 인덱스 캐시를 두어, 데운 호출은 수백 밀리초 수준입니다). 카드는 5분마다 조용히 새로고침됩니다 — 시간 윈도우는
어차피 시계에 따라 밀리므로, 새로운 사용량이 없어도 갱신되어야 합니다.

### 활동 히트맵 읽는 법

- **월요일 정렬, 최근 53주**짜리 **캘린더**에 **월**과 **요일** 축이 있습니다. 칸은 카드 폭을 나눠 쓰므로 카드와 함께
  늘어나고 정사각형을 유지합니다(11px가 기준 크기);
- 색 농도는 "당일 ÷ 최대값"이 아니라 **0이 아닌 날의 사분위수**를 씁니다 — 후자는 하루만 유난히 크면 나머지가 전부 같은
  회색 농도로 눌립니다;
- 머리글에서 **Tokens / 턴**을 전환할 수 있고, 기본값은 **데이터가 있는 날이 더 많은** 쪽입니다(가져온 이력이 많은
  기계에서는 token이 희소하므로 기본적으로 token을 그리면 거의 빈 격자가 됩니다);
- **소스 필터를 따르지만 시간 범위의 영향은 받지 않습니다**: 캘린더를 7일로 좁히면 "1년 격자에서 7칸이 켜진 것"이 되는데,
  바로 히트맵이 보여서는 안 되는 모습입니다.

## 현지화

대시보드는 **DSH 자체의 언어 설정**을 따릅니다. 자체 언어 선택기는 없습니다: DSH에서 언어를 바꾸면 대시보드도 함께,
즉시, 새로고침 없이 전환됩니다.

- `en`과 `zh`는 DSH의 내장 로케일이고, 이 플러그인은 둘 다 위한 사전을 제공합니다;
- 다음 언어 팩은 DSH의 카탈로그에 등록되어 있어 DSH 자체 선택기에 나타납니다: `zh-TW`(臺灣正體), `zh-HK`(香港繁體),
  `de`, `fr`, `es`, `it`, `ja`, `ko`. 나머지 여섯 코드 — `pt-BR`, `ru`, `vi`, `th`, `id`, `ar`(오른쪽에서 왼쪽) — 는
  설계만 되고 아직 구현되지 않았습니다. [설계 문서](docs/superpowers/specs/2026-10-01-i18n-design.md)를 보세요;
- 문구는 `locales/<id>.json`에 언어당 하나의 평문 파일로 있으며, `node scripts/build-dicts.mjs`가 `client.js`로
  생성합니다. 생성된 블록은 절대 손으로 고치지 마세요 — 오래된 상태면 `npm test`가 실패합니다;
- 숫자, 백분율, 날짜, 요일·월 이름, 복수형은 모두 `Intl`에서 오므로, 수천 단위 구분이 다른 언어나 영어가 `K`/`M`/`B`를
  쓰는 곳에 `萬`/`億`을 쓰는 언어, 복수형이 변하는 언어도 올바르게 읽힙니다;
- `README-<id>.md`와 `CHANGELOG-<id>.md`가 열 언어 각각에서 두 문서를 담습니다. 이 파일들은 GitHub를 위해 저장소에
  있고, npm은 `README.md`만 보여줍니다.

## 설정

**플러그인 → `Token 用量`** 페이지에서 편집합니다 — 사이드바의 `Plugins` 항목 → `Token 用量`: 페이지 중앙에 입력 상자
두 개와 저장 버튼이 있는데, 입력 상자의 라벨은 `대시보드의 설정된 윈도우 시간 범위`(사이드바 카드에 표시되는 시간
범위)입니다.

DSH는 `Config` 스키마에서 편집기를 **자동으로 생성하지 않습니다** — 설정을 직접 가져오는 플러그인은 폼을 패키지 이름으로
지정되는 `plugins.bundle.config` 슬롯에 렌더링해야 합니다. 이 플러그인이 하는 일이 바로 그것입니다: 저장 시 공식
`configEditor`를 호출하고, 값은 profile의 `cordis.patch.yml`에 놓이므로 거기에 직접 써도 됩니다:

```yaml
- id: dsh-desktop-token-usage
  disabled: false
  config:
    hours: 6
    days: 7
```

| 키 | 기본값 | 설명 |
|---|---|---|
| `hours` | `0` | 설정된 윈도우 섹션이 보고하는 시간 수(0-23). `0` = 이 윈도우를 끔 |
| `days` | `0` | 설정된 윈도우 섹션이 보고하는 일 수(1-30). `0` = 이 윈도우를 끔 |

둘 다 끄면(기본값) 카드는 이 두 파라미터가 생기기 전과 똑같이 누적값을 보여줍니다. 윈도우는 **로컬 시간** 기준으로
시간 단위로 반올림합니다: "최근 6시간"은 6시간 전 정각에서 시작한다는 뜻입니다.

변경은 저장 후 **즉시** 적용됩니다: Cordis의 `fiber.update()`가 이 플러그인의 fiber를 재시작하고 `apply`가 새 설정으로
다시 실행됩니다(값을 바꿀 때마다 DSH를 재시작할 필요가 없습니다). 저장 후에는 폼이 설정을 다시 읽어 카드를 자동으로
갱신합니다.


## 데이터 의미론

이 절은 중요합니다 — 숫자의 의미는 전적으로 DSH의 로그 의미론에 의해 결정됩니다.

| 지표 | 정의 |
|---|---|
| Tokens 사용량 | `uncached input + output + cache read + cache write` |
| **입력량**(카드) | `uncached input + cache read` — 즉, 공급자가 실제로 받은 모든 prompt Token |
| **출력량**(카드) | `usage.outputTokens`(`reasoningTokens`는 그 **부분 집합**이며 절대 두 번 세지 않음) |
| 미캐시 입력 | `usage.inputTokens` — **공급자의 원시 필드에서는 이미 캐시에 미달한 부분입니다**; DSH 자체 프로젝션은 이를 `uncachedInputTokens`로 바꿉니다 |
| 캐시 읽기 / 쓰기 | `usage.cacheReadTokens` / `usage.cacheWriteTokens` |
| 평균 캐시 적중률 | `cache read ÷ (cache read + uncached input + cache write)` — 미적중 쪽에 캐시 쓰기가 포함됩니다 |
| 요청 수 | 정산 후 모델 호출 수(아래 "폴딩" 참조) |
| 완료된 턴 | `turn/end` 이벤트 수 |
| 모델별 분류 | 모델 id의 **마지막 조각**: 같은 모델이 `commandcode`에서는 `deepseek/deepseek-v4.1-flash`로, `opencode-go`에서는 `deepseek-v4.1-flash`로 들어와 둘 다 한 행으로 합쳐집니다. 공급자별로 묶으면 둘은 여전히 분리됩니다 |

**폴딩 의미론(계산이 쉽게 어긋나는 지점)**: 같은 `(turn, step)` 안에서 나중 usage 항목이 이전 항목을 **대체**합니다 —
스트리밍 숫자는 최종 정산으로 덮어써지며, `llm/retry-started`가 그 슬롯을 닫은 다음에야 다른 재시도 호출이 **누적**
합니다. 그래서 "총계 = 모든 usage의 합"은 틀렸고, 반드시 폴딩해야 합니다. 이 플러그인의 폴딩 로직은 `dsh-token-meter`의
`tokenUsage` 프로젝션과 한 줄씩 대응하며, 교차 대조 테스트로 커버됩니다.

### 소스 필터에 세 가지밖에 없는 이유

DSH 0.1.7-rc.2의 세션 로그에는 "클라이언트 소스" 필드가 **없습니다**: `SessionHeader`는
`version/id/createdAt/cwd/parentSession/isSeeded/origin/delegationDepth/agentPreset`만 담고, `origin`이 가지는 값은
오직 `'subagent'`뿐입니다. 데스크톱과 웹은 로컬 데이터로 구별할 수 없습니다. 그래서 대시보드는 **로컬 신호로부터 도출
가능한** 세 가지만 제안합니다:

| 라벨 | 판정 근거 |
|---|---|
| 데스크톱 · 웹 | 실제 사용자 턴이 존재하고(`source.kind ∈ {user, user-approval}`인 `user/message`) `source.rpcId`를 담음 |
| CLI · 봇 | 실제 사용자 턴이 있는데 `rpcId`가 **없음**(headless / SDK / ACP / 봇 등, 클라이언트 없이 구동) |
| 서브에이전트 | `header.origin === 'subagent'` 또는 `delegationDepth > 0` |

사용자 턴이 아예 없는 세션(예: 슬래시 명령만 실행한 세션)은 `전체`에 포함되며 별도로 나열되지 않습니다.

## 알려진 한계

- **첫 집계가 느립니다**: 약 150개 세션 파일과 90,000건이 넘는 레코드에서 콜드 스타트는 약 3–4초입니다. 그 후에는 파일
  지문 기준 증분으로 바뀌어 데운 호출은 수백 밀리초 수준이 됩니다. 캐시는
  `$DSH_HOME/cache/dsh-desktop-token-usage/sessions-index.json`에 쓰이며, 삭제하면 다음 실행이 느려질 뿐입니다.
- **가져온 과거 세션은 사용량이 0으로 보고될 수 있습니다**: 과거 세션이 가져온 경우(예: reasonix 마이그레이션)에는 usage
  필드가 정말로 전부 0입니다. 이는 유효한 데이터이지 누락된 데이터가 아니며, 이 플러그인은 추정으로 대체하지 않습니다.
- **열 언어만 번역되어 있습니다**: 대시보드는 DSH의 언어 설정을 따르지만, 문구는 아직 DSH를 설정할 수 있는
  모든 언어를 담고 있지 않습니다. 위의 현지화 절에 여전히 빠진 여섯 언어가 나열되어 있습니다.
- **윈도우는 시간 단위로 반올림됩니다**: 로그에 분 단위 버킷이 없어 "최근 1시간"은 정각에 맞습니다.
- **카드 갱신에는 지연이 있습니다**: Host→Client 푸시 채널이 없어 카드는 5분 주기의 조용한 새로고침 타이머에
  의존합니다. 방금 설정을 바꿨거나 바로 갱신하고 싶다면, 카드를 눌러 대시보드를 연 다음 `새로고침`(refresh)을 누르세요.

## 검증 상태

지금까지 완료한 검증(`docs/DESIGN.md`의 "verification evidence" 절 참조):

- 폴딩 결과가 **DSH 자체 프로젝션 캐시**와 필드 단위로 일치합니다(`session-5964a5d3-*`:
  `286650 / 182633 / 43826560 / 0`);
- 일별·모델별 요약 모두 합계로 다시 더해지고, 일별/시간별 밀리초 구간이 합계를 정확히 분할합니다;
- 카드 윈도우 요약: 모든 윈도우는 누적값 이하일 수밖에 없고, 입력/출력 분할 항등식이 성립하며, 범위를 벗어난 파라미터
  (`hours=99`/`days=-3`)는 클램프됩니다;
- `Config` 스키마가 Standard Schema 인터페이스로 검증됩니다: 기본값은 0/0이고 `hours=24`, `days=31`은 거부됩니다;
- Host 디스크립터와 Client 기여분은 테스트에서 **필드 단위로 교차 대조**되며, 파라미터 코덱은 브라우저가 실제로
  보내는 값을 받습니다;
- 클라이언트 두 반쪽이 브라우저가 없는 환경에서 가짜 React/DOM으로 렌더링됩니다(카드 윈도우 행과 누적 대체 두 경우
  모두, 스타일 주입과 언마운트에 단언 포함);
- 설치 후 `include:dsh-desktop-token-usage`의 `fiberPhase`가 `active`이고, `dsh-desktop-token-usage`가
  `sidebar.footer.action`과 `main` 양쪽에 나타납니다(`active: true`);
- 브라우저 → Host RPC 경로가 동작함이 증명됩니다(페이지가 호출한 뒤 Host 쪽 인덱스가 다시 쓰입니다).

**확인됨 / 아직 확인이 필요함**:

1. **Host 쪽 설정 경로가 양끝까지 검증되었습니다**: `Config.listConfigs`가 이 플러그인에 대해 `status: schema`를
   보고합니다(`id: include:dsh-desktop-token-usage`, `name`은 패키지 이름). fiber를 재시작한 뒤 `boot.json`의
   `windows`는 profile에 설정된 `{hours:5, days:1}`과 같으며, 설정 읽기와 `configEditor`를 통한 쓰기 모두
   스코프가 지정된 패키지 이름 아래에서 올바르게 작동합니다.
2. **클라이언트는 아직 페이지 하드 새로고침이 필요합니다**(Ctrl/Cmd+Shift+R): 플러그인 페이지 중앙의 설정 카드는
   클라이언트가 등록하며(`plugins.bundle.config`는 **패키지 이름**이 키), 새 클라이언트 모듈이 로드되어야
   나타납니다.
3. **Host 모듈 세대에는 재시작이 아직 한 번 필요합니다**: Node는 해석된 realpath 기준으로 ESM을 캐시하므로 파일을
   고치거나 심지어 패키지 이름을 바꾸어도 다시 import되지 않습니다. 실은
   `import('dsh-desktop-token-usage') === import('dsh-desktop-token-usage')`가 같은 모듈 인스턴스입니다. 그래서
   히트맵이 의존하는 `payload.heatmap` 같은 새 Host 코드는 재시작해서만 로드됩니다. 그전까지 클라이언트는
   "missing `heatmap`" 대체 경로를 씁니다.
4. 대시보드의 시각적 요소(재작업된 히트맵 포함)는 직접 눈으로 확인해야 합니다 — 이 환경에는 브라우저 제어가 없습니다.

### 문제가 생기면 어디를 볼 것인가

자체 진단 파일 두 개가 `$DSH_HOME/cache/dsh-desktop-token-usage/`에 있습니다:

- `boot.json`: Host 활성화 체인(`appliedAt`/`injectedAt`/`providedAt`/`registeredAt`)과 활성 `windows`.
  `error`가 있으면 어느 단계에서 멈췄는지 알려줍니다. 모든 `apply`가 이 파일을 다시 쓰므로 `appliedAt`은 fiber가
  가장 최근에 다시 얹어진 시각입니다. 다만 **최신 코드를 돌리고 있다는 증거는 될 수 없습니다** — 파일을 고쳐도 모듈은
  다시 import되지 않고, 오직 재시작만이 그렇게 합니다.
- `calls.json`: 최근 대시보드 요청 20건(필터, 윈도우, 세션 수, 총 Token, 소요 시간).
  **기록이 하나라도 있으면 브라우저 → Host 경로가 동작한다는 증거입니다. 기록이 없다는 것만으로 경로가 고장났다는
  증거는 아닙니다**(파일이 그냥 지워졌을 수도 있으니 `boot.json`과 함께 읽으세요). 정말 한 번도 기록이 없었다면
  클라이언트 모듈이 아마도 아예 로드되지 않은 것입니다 — **페이지를 하드 새로고침하세요**(Ctrl/Cmd+Shift+R).

또한 `Config.listConfigs`의 `status`는 현재 fiber의 모듈이 `Config`를 내보내는지 직접 알려줍니다: `absent` = 오래된
모듈 세대(플러그인 페이지에 설정 카드가 없습니다); `schema` = schemastery 스키마가 인식되었다는 뜻(이 플러그인의 경우가
바로 이것입니다). `schema`는 **검증할 수 있다는** 뜻일 뿐이며, 설정 UI는 여전히 플러그인이 플러그인 페이지에 직접
렌더링합니다(위의 "설정" 절 참조). DSH는 스키마에서 폼을 생성하지 않습니다.
Host보다 오래된 클라이언트도 문제를 일으킵니다 — 그래서 클라이언트는 `card` 필드를 얻지 못하면 "로딩"에 멈춰 있는 대신
**누적값으로 대체**합니다.

## 개발

```
npm install     # installs @deepseek-ai/schemastery (a link install does not install dependencies for linked packages)
npm test        # node --test: aggregation golden cross-check + window summaries + browserless client smoke tests
```

테스트는 `apply`도 실행하므로, 진단 파일을 쓸 때는 임시 디렉터리(`DSH_TOKEN_USAGE_DIAG_DIR`)를 가리키게 되어
`$DSH_HOME/cache/dsh-desktop-token-usage/`에서 보고 싶은 그 두 파일을 덮어쓰지 않습니다.

구조:

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

문서는 열 언어로 제공됩니다: 기본은 영어(`README.md` / `CHANGELOG.md`)이고, 나머지 언어마다 각자의
`README-<id>.md` / `CHANGELOG-<id>.md`가 있습니다. 열 파일 모두 각 파일 3번째 줄의 스위처로 서로 연결되어 있습니다.

## 라이선스

MIT
