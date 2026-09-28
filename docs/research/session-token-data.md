# DSH 本地会话日志 token 用量数据：完整格式与读取方法

> 调研对象：**DSH（DeepSeek Harness）桌面版 0.1.7-rc.2**，Windows。
> 调研范围：**只读**。未修改 `~/.dsh` 下任何数据（仅新增了本仓库 `docs/research/.cache/` 索引缓存）。
> 调研时间：2026-09-27。样本：`$DSH_HOME/sessions/` 下 **151 个** `session.v4.jsonl.zstd`，93,354+ 条记录，最大单文件 2,705,456 字节 / **4,779 个 zstd 帧**。
>
> **脱敏约定**：本机用户目录写作 `%USERPROFILE%`（即 `C:\Users\<user>`），DSH 数据根写作 `$DSH_HOME`
> （默认 `%USERPROFILE%\.dsh`）；引用真实记录时，用户目录一律写成 `<user>`。

配套脚本：**[`probe-sessions.mjs`](./probe-sessions.mjs)**（可直接运行、可 `import`）。

---

## 目录

1. [结论速查（TL;DR）](#0-结论速查)
2. [Q1 多帧 zstd 的正确读法](#q1-多帧-zstd-的正确读法)
3. [Q2 记录 schema 与增量语义](#q2-记录-schema-与增量语义)
4. [Q3 token 用量字段](#q3-token-用量字段)
5. [Q4 模型 / provider 标识](#q4-模型--provider-标识)
6. [Q5 会话「来源」（surface）](#q5-会话来源surface)
7. [Q6 时间戳与全量枚举去重](#q6-时间戳与全量枚举去重)
8. [Q7 性能与缓存](#q7-性能与缓存)
9. [实测汇总数字](#8-实测汇总数字)
10. [给插件的落地建议](#9-给插件的落地建议)

---

## 0. 结论速查

| 问题 | 结论 |
|---|---|
| 多帧 zstd | 文件 = **多个独立带校验和 zstd 帧首尾拼接**。Node 的 `zstdDecompressSync` / `createZstdDecompress` **只解第一帧**。必须先做**不解压的结构化帧扫描**（官方 `scanZstdFrames`）拿到每帧 `[start,end)`，再对每段字节单独 `zstdDecompressSync`。 |
| 记录条数 | 4,779 帧 = 4,779 条记录（rc.2 的写路径是「一批一帧」，头部帧单独 1 帧）。 |
| token 字段路径 | `assistant/message` → `data.usage.{inputTokens, outputTokens, cacheReadTokens?, cacheWriteTokens?, reasoningTokens?, totalTokens}` |
| 总 token 公式 | `totalTokens = inputTokens + outputTokens + cacheReadTokens + cacheWriteTokens`（**已实测 16,895/16,895 条完全吻合，0 例外**）。`reasoningTokens` 是 `outputTokens` 的**子集**，**不进**公式。 |
| 模型/provider | `assistant/message` → `data.message.source = {kind:"model", provider, model}`；路由 id = `` `${provider}/${model}` ``，例如 `commandcode/deepseek/deepseek-v4.1-flash`。 |
| surface（桌面/命令行/网页/机器人/远程） | **本地日志里没有这个字段。** 官方 `SessionHeader` 只有 `version,id,createdAt,cwd?,parentSession?,isSeeded,origin?,delegationDepth,agentPreset?`，且 `origin` **唯一取值是 `'subagent'`**。六个来源标签在 0.1.7-rc.2 的 asar 里完全不存在。只能近似推断（见 Q5）。 |
| 时间戳 | 每条记录 `time`（epoch **毫秒**）+ 单调 `seq`；header `createdAt`（epoch 毫秒）。 |
| 全量枚举 | `~/.dsh/sessions/<workspace-slug>/<session-id>/session.vN.jsonl.zstd`，取**数值最高的 generation**。子会话也是**独立文件**，靠 `header.origin === 'subagent'` / `delegationDepth > 0` 识别。 |
| 性能 | 冷解析 151 文件 **≈3.5–3.8 s**；按 `mtimeMs+size` 缓存后二次聚合 **≈0.09–0.25 s**。 |
| 实测总量 | 151 会话（含 4 子会话）：**214,434,897** token；其中根会话 147 个 = 175,467,914，子会话 4 个 = 38,966,983。 |

---

## Q1 多帧 zstd 的正确读法

### 1.1 官方怎么写

证据：`dsh/node_modules/@deepseek-ai/dsh-session-persistence-jsonl/README.zh.md`「物理编码」节：

> 默认产物是独立 Zstandard 帧的标准拼接：一个仅包含 header 行的带校验和帧，后跟每个持久 append 批次一个带校验和帧，使用 Node 内置 Zstandard API 的默认压缩级别（无级别开关）。

证据：`dsh/node_modules/@deepseek-ai/dsh-session-persistence-jsonl/lib/index.js:3190-3197`

```js
const headerFrame = await compressZstdFrame(header);
const eventFrame = await compressZstdFrame(body);
...
return this.compression === "zstd" ? compressZstdFrame(body) : body;
```

证据：`.../lib/index.js:1288,1291,1369-1371`

```js
const ZSTD_MAGIC = 4247762216;                  // 0xFD2FB528，LE 读取 = 魔数 28 B5 2F FD
const CHECKSUM_OPTIONS = { params: { [constants.ZSTD_c_checksumFlag]: 1 } };
async function compressZstdFrame(input) { return zstdCompressAsync(input, CHECKSUM_OPTIONS); }
```

### 1.2 官方怎么读（这就是必须复刻的算法）

**第一步：结构化帧扫描（不解压）** — `.../lib/index.js:1300-1363`

```js
function scanZstdFrames(buffer, maxFrames = Number.POSITIVE_INFINITY) {
	const frames = [];
	let offset = 0;
	while (offset < buffer.length) {
		const start = offset;
		if (buffer.length - offset < 4) return { frames, tornStart: start };
		if (buffer.readUInt32LE(offset) !== ZSTD_MAGIC) throw new Error(`corrupt Zstandard session log: invalid frame magic at byte ${offset}`);
		offset += 4;
		if (offset === buffer.length) return { frames, tornStart: start };
		const descriptor = buffer.readUInt8(offset); offset += 1;
		if ((descriptor & 24) !== 0) throw new Error(`... reserved frame-header bit at byte ${offset - 1}`);
		const contentSizeFlag = descriptor >>> 6;
		const singleSegment = (descriptor & 32) !== 0;
		const checksum = (descriptor & 4) !== 0;
		const dictionaryFlag = descriptor & 3;
		const dictionaryBytes = dictionaryFlag === 3 ? 4 : dictionaryFlag;
		const contentSizeBytes = contentSizeFlag === 0 ? singleSegment ? 1 : 0 : 1 << contentSizeFlag;
		const remainingHeaderBytes = (singleSegment ? 0 : 1) + dictionaryBytes + contentSizeBytes;
		if (buffer.length - offset < remainingHeaderBytes) return { frames, tornStart: start };
		offset += remainingHeaderBytes;
		for (;;) {
			if (buffer.length - offset < 3) return { frames, tornStart: start };
			const blockHeader = buffer.readUIntLE(offset, 3); offset += 3;
			const lastBlock = (blockHeader & 1) !== 0;
			const blockType = (blockHeader >>> 1) & 3;
			const blockSize = blockHeader >>> 3;
			if (blockType === 3) throw new Error(`... reserved block type at byte ${offset - 3}`);
			const payloadBytes = blockType === 1 ? 1 : blockSize;   // RLE block 只占 1 字节
			if (buffer.length - offset < payloadBytes) return { frames, tornStart: start };
			offset += payloadBytes;
			if (lastBlock) break;
		}
		if (checksum) { if (buffer.length - offset < 4) return { frames, tornStart: start }; offset += 4; }
		frames.push({ start, end: offset });
		if (frames.length === maxFrames) return { frames };
	}
	return { frames };
}
```

**第二步：逐帧解压** — `.../lib/index.js:1253-1279`（`PublicZstdFrameDecoder`，公共 API 回退路径）

```js
for (const { start, end } of frames) {
    let decoded;
    try { decoded = zstdDecompressSync(source.subarray(start, end)); }
    catch (error) { throw new Error(`corrupt Zstandard session log: frame at byte ${start} failed validation`, { cause: error }); }
    yield decoded;
}
```

> 官方为了性能优先走 `NodePrivateZstdFrameDecoder`（`.../lib/index.js:1157-1245`），它用 Node 流的**私有** `stream._handle.writeSync(...)` + `_writeState` 复用同一个原生 zstd context 做跨帧同步解码（`privateZstdStream()` 探针在 `:1140-1150`）。
> **离线插件不需要这个优化**——`PublicZstdFrameDecoder` 的「逐帧 `zstdDecompressSync`」语义完全等价，且不依赖 Node 私有字段。本次实测 151 文件 3.5 s，性能足够。

**第三步：撕裂尾帧恢复** — `.../lib/index.js:1395-1397`。若 `scanZstdFrames` 返回了 `tornStart`（进程在写帧中途被杀），可用 `zstdDecompressAsync(input, { finishFlush: constants.ZSTD_e_flush })` 抢救出完整解码的记录。实测本机 151 个文件 **`torn` 全为 `false`**。

### 1.3 实测输出（含那个 4,779 帧 / 2.7 MB 的文件）

```
$ node probe-sessions.mjs scan "%USERPROFILE%\.dsh\sessions\--C-<local-dir>-<project>--\session-8e7bf112-...\session.v4.jsonl.zstd"
```
```json
{
  "file": "C:\\Users\\<user>\\.dsh\\sessions\\--C-<local-dir>-<project>--\\session-8e7bf112-...\\session.v4.jsonl.zstd",
  "bytes": 2705456,
  "frames": 4779,
  "torn": false,
  "records": 4779,
  "types": {
    "session": 1,
    "permission/preset": 1,
    "sandbox/mode": 1,
    "approval/policy": 1,
    "agent-preset/selected": 1,
    "turn/start": 56,
    "step/start": 927,
    "user/message": 56,
    "assistant/message": 927,
    "tool/call": 912,
    "tool/result": 912,
    "step/end": 927,
    "turn/end": 56,
    "session/title": 1
  }
}
```

失败对照（**证明 Node 原生一次性 API 只解第一帧**）：

```
$ node -e "const z=require('node:zlib'),fs=require('node:fs');console.log(z.zstdDecompressSync(fs.readFileSync(process.argv[1])).toString('utf8').split('\n').filter(Boolean).length)" <上面那个文件>
1
```
只解出 1 行 —— 就是 `{"type":"session",...}` 头记录。而按帧扫描后是 **4,779** 条。

---

## Q2 记录 schema 与增量语义

### 2.1 顶层信封

每条记录（除 header 外）统一信封：

```jsonc
{ "type": "<event-type>", "seq": <非负整数，会话内单调>, "time": <epoch 毫秒>, "data": { ... } }
```

`user/message` / `tool/result` / `assistant/message` / `system/message` 额外带 **`surfaceOp`**（见 2.4）。

### 2.2 header（第 1 帧，1 行）

实测样例（本机 `session-5964a5d3` 真实数据）：

```json
{"type":"session","version":4,"id":"session-5964a5d3-...","createdAt":1790323734725,"cwd":"C:\\Users\\<user>\\Documents\\deepseek-harness\\default-workspace","isSeeded":false,"delegationDepth":0,"agentPreset":"standard"}
```

子会话样例（真实数据，来自本机 `0a83a1b2`）：

```json
{"type":"session","version":4,"id":"0a83a1b2-...","createdAt":1790476594864,"cwd":"C:\\<local-dir>\\dsh-usage","parentSession":"session-ad260567-...","isSeeded":false,"origin":"subagent","delegationDepth":1,"agentPreset":"cordis"}
```

字段全集（官方权威定义）：`dsh/node_modules/@deepseek-ai/dsh-session-format-v3-to-v4/README.zh.md:216`

> | 逻辑 header | 精确的必需字段 `version`、`id`、`createdAt`、`isSeeded`、`delegationDepth`；可选字段 `cwd`、`parentSession`、`origin`、`agentPreset`；**无其他键**。Version 为 4，id 为字符串，创建时间／深度为非负安全整数，seeded 为布尔值，存在的 cwd 为绝对路径，可选 id 为字符串，**存在的 origin 为 `subagent`**。 |

实测 151 个 header 的键集统计：

```
147  {agentPreset,createdAt,cwd,delegationDepth,id,isSeeded,type,version}
  4  {agentPreset,createdAt,cwd,delegationDepth,id,isSeeded,origin,parentSession,type,version}
```

> ⚠️ **重要：header 里没有 profile / surface / client 字段。** 想判定「桌面端 vs 网页端」不能靠 header。

### 2.3 全部记录类型（151 文件实测，含计数）

| type | 计数 | data 关键字段 |
|---|---:|---|
| `session` | 151 | header，见 2.2 |
| `permission/preset` | 165 | `{preset}` |
| `sandbox/mode` | 161 | `{mode}` 或字符串 `"delegation"` |
| `approval/policy` | 156 | `{policy}` 或字符串 `"delegation"` |
| `approval/asked` | 36 | `{id, toolName, callId, reason}` |
| `approval/decided` | 36 | 审批结果 |
| `agent-preset/selected` | 139 | `{agentPreset}` |
| `turn/start` | 1060 | `{turn}` |
| `turn/end` | 1055 | `{turn, reason:{kind}}` |
| `step/start` | 16827 | `{turn, step}` |
| `step/end` | 16822 | `{turn, step}` |
| `user/message` | 1151 | `{content[], source, role:"user", id}` |
| `system/message` | 20 | `{turn, step, message:{role:"system", content[], source:{kind:"system-prompt"}, id}}` |
| `assistant/message` | 16822 | `{turn, step, message, usage?, stream[]}` ← **token 在这里** |
| `assistant/attempt` | 15 | `{turn, step, stream[]}`（重试/失败的额外尝试，**不含 usage**） |
| `tool/call` | 17888 | `{turn, step, callId, name, arguments}` |
| `tool/result` | 17884 | `{turn, step, message:{role:"tool", toolCallId, content[], isError, id}}` |
| `tool/ptc-dispatch` | 932 | `{rootCallId, parentCallId, subCallId, name, arguments, isError, content[]}` |
| `tool/ptc-dispatch-start` | 933 | 同上（开始侧） |
| `llm/retry` | 1 | `{retryId, turn, step, provider, mode, policyKey, retry, maxRetries, delayMs, failure}` |
| `llm/retry-started` | 1 | `{turn, step, ...}` |
| `request/header` | 24 | `{header:{config:{provider,model,maxTokens}, adapterDefaults, tools[]}, reason}` |
| `request/context` | 18 | `{provider, model, contextWindow}` |
| `model/selection` | 5 | `{provider, model, reasoningEffort?}` |
| `session/title` | 153 | `{title, messageSeqs[], source}` |
| `session/title-llm-request` | 13 | `{titleProvider, messageSeqs[], route:{provider,model}, system, messages[], maxTokens}` |
| `session/end-seed` | 12 | `{}`（seed 边界标记） |
| `agent/inbox/spliced` | 188 | `{target, start, inserted[], removedCount?}` |
| `workspace/changes` | 24 | `{turn}` |
| `system/message` | 20 | 见上 |
| `todo/write` | 14 | `{todos:[{content,status}]}` |
| `deliverables/presented` | 11 | 交付物清单 |
| `command/run` | 11 | `{commandId, name, args, source:{kind:"user"}}` |
| `command/done` | 11 | 命令结果 |
| `subagent/descriptor` | 4 | `{version, mode, provider, label, agentProvider, agentModel, agentReasoningEffort?}` |
| `subagent/catalog` | 4 | `{version, childId, childCreatedAt, mode, label}` |
| `subagent/model-selection-policy` | 14 | `{allowedModels:[{provider,model}]}` |
| `session-log-deepseek/delivery-accepted` | 247 | `{sessionId, sessionFormatVersion, throughSeq}`（云端日志投递确认） |
| `goal/change` | 1 | `{kind, version, operation, goal:{id,revision,objective,phase,maxGoalRounds}, roundsStarted, createdAt, updatedAt}` |

### 2.4 增量 / 快照语义

**结论：日志是「仅追加（append-only）」的，事件一旦提交绝不重写。** 证据链：

1. `dsh-session-persistence-jsonl/README.zh.md`「持久性与崩溃语义」：
   > **已提交事件绝不重写。** …… 后续每个批次追加行或一个压缩帧，并在 append 完成前 `fsync`；捕获到写入或同步失败时把文件回滚到之前的字节长度。

2. 实测 151 文件，**`seq` 严格单调、无重复**，`type` 只有追加形态，**不存在任何 patch/update/delta/revision 类型的记录**。

3. 但**「表层（surface）」有 append/replace 两种作用**。`user/message`、`assistant/message`、`tool/result`、`system/message` 带 `surfaceOp`：

```jsonc
"surfaceOp": "append"
// 或
"surfaceOp": { "kind": "replace", "startSeq": 12, "endSeq": 20 }
```

证据：`dsh-session/lib/types/surface.js:13-34`（`SURFACE_EVENT_TYPES` / `isSurfaceEvent`），以及 `dsh-token-meter/lib/types/surface-fold.js` 的 `planSurfaceTokens`：
```js
const op = event.surfaceOp;
if (op === 'append') return { tokens, deltaTokens: tokens, node, target: 'append' };
const startIdx = nodes.findIndex(candidate => candidate.seq === op.startSeq);
const endIdx = nodes.findIndex(candidate => candidate.seq === op.endSeq);
```
> 注意：这里的 **`surface` 指「模型可见的事件序列（发给 LLM 的上下文）」**，即 `compaction/summary`、`compaction/prune` 会 `replace` 掉一段历史。**它不是「客户端来源」！**本机实测 100% 都是 `"surfaceOp":"append"`（无压缩发生过）。
>
> `contextPressure` 投影因此维护 `surfaceTokens`（启发式估算）+ `sampledSurfaceTokens`，见 `dsh-token-meter/lib/types/usage-projection.js` 的 `contextPressureProjectionDefinition`。这与 provider 报的 token 是两套东西，**不要混用**。

**token 用量的「替换」语义**（重要）：`dsh-token-meter/lib/types/usage-projection.js` 的 `tokenUsageProjectionDefinition.apply`：

```js
if (event.type === 'llm/retry-started') {
    return state.last?.turn === event.data.turn && state.last.step === event.data.step
        ? { ...state, last: null } : state;   // 重试 → 关闭替换槽位，下一次调用「累加」
}
...
const previous = state.last !== null && state.last.turn === turn && state.last.step === step
    ? state.last.buckets : undefined;
if (previous !== undefined && bucketsEqual(previous, buckets)) return state;
return { totals: addReplacing(state.totals, previous, buckets), last: { turn, step, buckets } };
```

即：**同一个 `(turn, step)` 内，后一条 usage 会「先减掉前一条再加新的」**（流式 usage 被最终结算替换）。跨 `llm/retry-started` 则重新开槽、累加。

> **本机实测**：151 文件共 16,895 条带 usage 的记录，**没有任何一个 `(turn, step)` 出现两次**（`duplicateTurnStepSlots = 0`），因此本数据集上 `fold === naiveSum`（差额 0.0000%）。但**插件必须实现 fold 形式**，否则一旦遇到重试场景就会多算。

### 2.5 怎么界定「一轮（turn）」

日志里是**显式**的，不需要猜：

- `turn/start` → `data.turn`（1-based）开启一轮
- `turn/end` → `data.turn` + `data.reason.kind`（实测值：`completed`）关闭一轮
- 轮内由 `step/start` / `step/end`（`data.turn` + `data.step`）划分 step

本机统计：`turn/start` 1060 / `turn/end` 1055（差 5 = 5 个会话在采样瞬间正开着轮次）；`step/start` 16827 / `step/end` 16822。

官方对「一轮的 token」的**严格**折叠在 `dsh-client-ui-chat/lib/client.js:10209-10322` 的 `deriveTurnTokenUsage(events)`（与 `dsh-token-meter/lib/types/turn-usage.js` 同源）。它的状态机是：

```
idle --turn/start--> (turn=T)
  idle --step/start--> open(turn,step)
  open --assistant/attempt--> 取 stream 里最后一个 usage chunk 作 sample，closeOpen() 后转 finishClosed
  open --assistant/message--> sample = data.usage ?? streamUsage(stream)；closeOpen(messageRoute(data.message)) 后转 settled{by:"message"}
  open|settled --llm/retry--> 转 settled{by:"retry"}
  settled --llm/retry-started--> 转 open（同 turn/step；by 必须是 retry）
  open --step/end--> closeOpen() 后回 idle
  turn/end（state 必须为 idle 且未见过 end）--> sawEnd = true
返回：invalid || !sawEnd || state.kind !== 'idle' ? undefined : aggregateAttempts(attempts)
```

关键点：官方**宁可整轮返回 `undefined` 也不给不精确的数字**；`normalizeUsage` 的校验包括 `reasoningTokens ≤ outputTokens`、`totalTokens - outputTokens ≥ input+cacheRead+cacheWrite`、以及「cacheRead 与 cacheWrite 同时存在时 `totalTokens - outputTokens` 必须**恰好等于** `input+cacheRead+cacheWrite`」（`turn-usage.js:20-70`）。

**推荐给离线插件的口径**：按 `(turn, step)` 折叠 + 替换语义即可（等价于官方 `tokenUsage` 投影）。若要 100% 复刻 GUI 的「本轮用量」展开，再实现上面的状态机。

---

## Q3 token 用量字段

### 3.1 位置

**唯一位置**：`assistant/message` 的 `data.usage`。

```jsonc
{
  "type": "assistant/message",
  "seq": 24,
  "time": 1790407551765,
  "data": {
    "turn": 1,
    "step": 2,
    "message": {
      "role": "assistant",
      "content": [ { "type": "reasoning", "text": "..." }, { "type": "tool-call", "id": "...", "name": "run_code", "arguments": "..." } ],
      "source": { "kind": "model", "provider": "commandcode", "model": "deepseek/deepseek-v4.1-flash" },
      "id": "0ab88df2-..."
    },
    "usage": {
      "inputTokens": 1060,
      "outputTokens": 324,
      "cacheReadTokens": 15744,
      "reasoningTokens": 52,
      "totalTokens": 17128
    }
  },
  "surfaceOp": "append"
}
```
↑ **真实记录**，来自 `~/.dsh/sessions/--C-Users-<user>-Documents-deepseek-harness-default-workspace--/0639a2b5-.../session.v4.jsonl.zstd`。

**回退路径**：`assistant/attempt` 没有 `data.usage`，但它的 `data.stream[]` 里可能有 `{"type":"chunk","chunk":{"type":"usage","usage":{...}}}`。官方 `usageOf()` 的判定顺序是「`assistant/message` 且 `data.usage !== undefined` → 用 `data.usage`；否则取 `stream` 里**最后一个** `usage` chunk」（`dsh-llm/lib/types/assistant-stream.js:304-311` 的 `lastAssistantStreamChunk`）。

实测本机：`assistant/attempt` 带 usage 的记录数 = **0**，所以离线插件只读 `data.usage` 就够；但实现回退更稳。

### 3.2 字段全名与语义

官方 `TokenUsage` 接口（`dsh-llm/lib/typert.host.js:529`，逐字）：

```ts
export interface TokenUsage {
    inputTokens: number;
    outputTokens: number;
    totalTokens?: number;
    cacheReadTokens?: number;
    cacheWriteTokens?: number;
    reasoningTokens?: number;
}
```

| 字段（磁盘上就是这个 camelCase） | 必需 | 含义 | 是否进 total |
|---|---|---|---|
| `data.usage.inputTokens` | ✅ | **未命中缓存的输入** token。官方投影里叫 `uncachedInputTokens` | ✅ |
| `data.usage.outputTokens` | ✅ | 输出 token（**含** `reasoningTokens`） | ✅ |
| `data.usage.cacheReadTokens` | ❌ | 缓存命中读取的输入 token | ✅ |
| `data.usage.cacheWriteTokens` | ❌ | 缓存写入的输入 token | ✅ |
| `data.usage.reasoningTokens` | ❌ | 思维链 token，**是 outputTokens 的子集** | ❌ **绝不加** |
| `data.usage.totalTokens` | ❌（实测总在） | provider/适配器给出的总额 | — |

**provider 原生名 → 磁盘名**（`dsh-llm-deepseek/lib/index.js:1803-1816`，Anthropic Messages 风格）：

```js
for (const [wire, local] of Object.entries({
    input_tokens: "inputTokens",
    output_tokens: "outputTokens",
    cache_read_input_tokens: "cacheReadTokens",
    cache_creation_input_tokens: "cacheWriteTokens"
})) { ... usage[local] = value; }
```

OpenAI/pi-ai 风格（`dsh-llm-pi-ai/lib/index.js:1367-1375`）：

```js
function mapUsage(usage) {
	return {
		inputTokens: usage.input,
		outputTokens: usage.output,
		totalTokens: usage.totalTokens,
		...usage.cacheRead > 0 ? { cacheReadTokens: usage.cacheRead } : {},
		...usage.cacheWrite > 0 ? { cacheWriteTokens: usage.cacheWrite } : {}
	};
}
```
> ⚠️ 注意差异：**Anthropic 风格**的 `input_tokens` 本身**不含** cache read/write（所以总和要加）；官方投影把它改名 `uncachedInputTokens` 正是这个意思。**不要**再对 `outputTokens` 减 `reasoningTokens`——官方明确说「Sum disjoint provider usage buckets **without double-counting reasoning output**」。

### 3.3 总 token 的官方公式

`dsh-token-meter/lib/index.js:592-595`：

```js
/** Sum disjoint provider usage buckets without double-counting reasoning output. */
function usageTokens(usage) {
	return usage.inputTokens + (usage.cacheReadTokens ?? 0) + (usage.cacheWriteTokens ?? 0) + usage.outputTokens;
}
```

`dsh-llm-deepseek/lib/index.js:1988`（写盘前就设好 `totalTokens`）：

```js
usage.totalTokens = usage.inputTokens + usage.outputTokens + (usage.cacheReadTokens ?? 0) + (usage.cacheWriteTokens ?? 0);
```

`dsh-token-meter/lib/types/turn-usage.js:29` 的硬约束（证明 reasoning ⊂ output）：

```js
if (reasoningTokens !== undefined && (!isCount(reasoningTokens) || reasoningTokens > outputTokens)) return undefined;
```

### 3.4 实测验证

**（a）公式自洽性**（对 151 个文件里全部带 usage 的记录）：

```json
{
  "usageRecords": 16895,
  "totalTokensMatchesFormula": 16895,
  "mismatches": 0,
  "recordsWithReasoning": 517,
  "reasoningSum": 391138,
  "recordsWithCacheWrite": 0
}
```
→ 磁盘上的 `totalTokens` **逐条**等于 `inputTokens + outputTokens + cacheReadTokens + cacheWriteTokens`。**0 例外。**（`cacheWriteTokens` 本机全为 0，因为 DeepSeek/opencode 这些网关不下发 cache creation。）

**（b）与官方投影缓存对拍**（黄金验证）。DSH 把 `tokenUsage` 投影持久化在
`$DSH_HOME/storages/session_projcache/sessions/<session-id>.json`
（包 `dsh-session-projection-cache`）。取 `session-5964a5d3` 的缓存：

```json
"tokenUsage":{"ver":2,"seq":1165,"val":{
  "totals":{"uncachedInputTokens":286650,"outputTokens":182633,"cacheReadTokens":43826560,"cacheWriteTokens":0},
  "last":{"turn":6,"step":14,"buckets":{"uncachedInputTokens":144,"outputTokens":1245,"cacheReadTokens":451200,"cacheWriteTokens":0}}}}
```

用 `probe-sessions.mjs` 解析**同一个会话的原始日志**：

```json
"usage": {
  "totals": { "uncachedInputTokens": 286650, "outputTokens": 182633, "cacheReadTokens": 43826560, "cacheWriteTokens": 0, "reasoningTokens": 0 },
  "totalTokens": 44295843,
  "usageRecords": 169
}
```

→ **四桶逐字节吻合（286650 / 182633 / 43826560 / 0）**。这证明：
1. 多帧解码正确；
2. `(turn,step)` 折叠正确；
3. `reasoningTokens` 不进 total 正确（该会话 reasoning 全 0，另经 (a) 验证）。

**（c）单会话累计**：`session-5964a5d3` = **44,295,843** token（169 次 LLM 调用，其中 cacheRead 43,826,560 占 98.9%）。

> 💡 **注意**：`session_projcache` 只有 22 个会话的缓存文件，且是**惰性写**的。**不能作为真源**，只能当校验参照。真源永远是 `session.v4.jsonl.zstd`。

---

## Q4 模型 / provider 标识

### 4.1 稳定字段路径

主路径 —— `assistant/message` → `data.message.source`：

```json
"source": { "kind": "model", "provider": "commandcode", "model": "deepseek/deepseek-v4.1-flash" }
```

- `provider`：注册的 LLM provider id，磁盘枚举实测：`reasonix`、`commandcode`、`deepseek-account`、`opencode-go`
- `model`：该 provider 下的模型 id，**本身可能含 `/`**，实测：`opencodego/deepseek-v4-flash`、`commandcode/deepseek/deepseek-v4-flash`、`deepseek-flash`、`deepseek/deepseek-v4.1-flash`
- **联合路由 id 没有单独字段**，官方处处用 `` `${provider}\0${model}` `` 或显示时 `${provider}/${model}`：
  - `dsh-token-meter/lib/types/turn-usage.js:11-14`：`const { provider, model } = message.source; return provider.length > 0 && model.length > 0 ? { provider, model } : undefined;`
  - `dsh-client-ui-chat/lib/client.js:10184`：`unique.set(\`${route.provider}\0${route.model}\`, route);`
  - `session_projcache` 里 `commandCodeCost.selection = {"provider":"deepseek-account","model":"deepseek-flash"}`

→ **插件应把路由 id 定义为 `${provider}/${model}`**（与截图里的 `commandcode/deepseek/deepseek-v4-flash`、`opencodego/deepseek-flash` 形态一致）。

### 4.2 本机全部路由（实测）

| provider | model | assistant 调用数 | 累计 token |
|---|---|---:|---:|
| `commandcode` | `deepseek/deepseek-v4.1-flash` | 553 | 103,631,828 |
| `opencode-go` | `deepseek-v4.1-flash` | 293 | 55,678,346 |
| `deepseek-account` | `deepseek-flash` | 245 | 55,124,723 |
| `reasonix` | `opencodego/deepseek-v4-flash` | 8822 | 0 |
| `reasonix` | `commandcode/deepseek/deepseek-v4-flash` | 3746 | 0 |
| `reasonix` | `commandcode/deepseek/deepseek-v4-flash-vision-exp` | 923 | 0 |
| `reasonix` | `deepseek/deepseek-flash` | 754 | 0 |
| `reasonix` | `opencodego/deepseek-flash` | 456 | 0 |
| `reasonix` | `deepseek/deepseek-v4-flash` | 410 | 0 |
| `reasonix` | `commandcode/stealth/ox-alpha` | 245 | 0 |
| `reasonix` | `opencodego/deepseek-v4-pro` | 172 | 0 |
| `reasonix` | `deepseek/deepseek-v4-flash-vision-exp` | 114 | 0 |
| `reasonix` | `opencodego/kimi-k3` | 42 | 0 |
| `reasonix` | `commandcode/moonshotai/Kimi-K3` | 36 | 0 |
| `reasonix` | `reasonix-import` | 34 | 0 |

> ⚠️ **`reasonix` 的 133 个会话是历史导入数据，usage 全为 0**（每条 `assistant/message` 都是 `{inputTokens:0,outputTokens:0,cacheReadTokens:0,reasoningTokens:0,totalTokens:0}`）。插件必须**把「全 0 usage」当作有效但无用量**，不能据此报错，也**不能把 0 当成缺失**去回退到 `stream`（否则会把 0 覆盖成真实流式值，与本机真源不一致）。判断口径：**有 usage 对象即采信，即使全 0**。

### 4.3 会话中途切换模型怎么表达

三种信号，语义不同：

1. **隐式（主）**：同一会话的 `assistant/message` 序列里 `message.source` 直接变化。**不需要任何额外记录**。实测 `session-d769c20e` 同时含 `deepseek-account/deepseek-flash` 与 `opencode-go/deepseek-v4.1-flash`。
2. **显式选择**：`model/selection`，`data = {provider, model, reasoningEffort?}`。实测：
   ```json
   {"type":"model/selection","seq":8,"time":1790473970133,"data":{"provider":"opencode-go","model":"deepseek-v4.1-flash","reasoningEffort":"high"}}
   ```
   `session-5964a5d3` 里 `seq:1165` 有一条切到 `commandcode/deepseek/deepseek-v4.1-flash`，但**该会话此后再无 assistant/message**（它就是最后一条）——说明该记录是「已选但未使用」。
3. **请求级**：`request/header` → `data.header.config.{provider,model,maxTokens}`；`request/context` → `{provider, model, contextWindow}`。会话中途换模型会追加新的 `request/header`（带 `data.reason`，实测值 `"initial"`）。

**推荐**：用 `assistant/message`.`data.message.source` 做归属（**每次调用都带**，绝对可靠）；`model/selection` 只作为「用户意愿」的补充；`request/header` 太重（含完整工具 schema），不要全量解析。

### 4.4 子会话的模型

子会话自己的 `assistant/message` 也带 `source`；另有 `subagent/descriptor`（子会话第 0 条）记录被指派的模型：

```json
{"type":"subagent/descriptor","seq":0,"time":1790476594876,"data":{"version":3,"mode":"continuable","provider":"spawn","label":"<subagent-label>","agentProvider":"opencode-go","agentModel":"deepseek-v4.1-flash","agentReasoningEffort":"high"}}
```

---

## Q5 会话「来源」（surface）

### 5.1 直接结论：本地日志无法精确区分

我做了以下穷尽排查，结论是**这六个分类在 0.1.7-rc.2 里不存在**：

| 排查 | 结果 |
|---|---|
| `grep "桌面端\|命令行\|网页端\|机器人"` 全 asar | 只命中 README/文档正文，**无任何枚举定义**；`机器人` **零命中** |
| `grep "'desktop'.{0,80}'cli'\|...'web'.{0,40}'bot'"` | **零命中** |
| `SessionHeader` 接口（`dsh-session-format-v3-to-v4/README.zh.md:216`、`dsh-api-session-controller/lib/typert.host.js:2189` 的 `SessionWireHeader`） | 只有 `origin?: 'subagent'`，**唯一取值 `subagent`** |
| 151 个 header 的键集 | 只有上面两种，无 profile/surface/client 字段 |
| `~/.dsh/profiles/` | 只存在 `desktop`、`web` 两个 profile 目录，但**会话日志不记录自己属于哪个 profile** |
| `~/.dsh/` 其它存储 | `storages/workspace.json`（工作区↔会话 id 映射，无来源）、`storages/session_projcache/`（投影缓存，无来源） |

> 父 agent 提到的截图筛选（全部/桌面端/命令行/网页端/机器人/远程）是**待实现插件的 UI 设计**，不是官方已有功能。

### 5.2 本地可用的近似信号

| 信号 | 路径 | 能区分什么 |
|---|---|---|
| `origin === 'subagent'` / `delegationDepth > 0` | header | **子会话** vs 根会话（**100% 可靠**，本机 4/4 命中） |
| 真实用户轮次的 `source.rpcId` 是否存在 | `user/message`.`data.source.rpcId` | **有人类客户端** vs **无客户端**（headless / SDK / ACP / 机器人 / 远程） |
| `source.clientTimeZone` | `user/message`.`data.source.clientTimeZone` | 本机恒为 `Asia/Shanghai`；远程/机器人应会不同 |
| `user/message`.`data.source.kind` | 同上 | `user` / `user-approval` = 真人；`agent-instructions` / `runtime-context` / `skill-catalog` / `ptc-mode` / `tool-jobs` = 系统注入 |
| `command/run`.`data.source.kind` | `command/run` | `"user"` = 用户键入 `/命令` |
| `subagent/descriptor`.`data.provider` | 子会话 seq 0 | `"spawn"`（父进程内派发）等 |

实测量化（151 会话）：

```
surface=client : 146   ← 真实用户轮次带 rpcId
surface=none   :   1   ← 无任何真实用户轮次（session-e74d10d4，只有 /命令）
（4 个子会话单独归类）
cli            :   0   ← 本机从未用 headless/SDK/ACP 产生过会话
```

**判定伪代码**（已实现在 `probe-sessions.mjs` 的 `inferSurface()`）：

```js
function inferSurface(header, records) {
  if (header.origin === 'subagent' || header.delegationDepth > 0) return 'subagent'
  let realTurns = 0, withRpc = 0
  for (const rec of records) {
    if (rec.type !== 'user/message') continue
    const kind = rec.data?.source?.kind
    if (kind !== 'user' && kind !== 'user-approval') continue
    realTurns += 1
    if (rec.data.source.rpcId) withRpc += 1
  }
  if (realTurns === 0) return 'none'
  return withRpc > 0 ? 'client' : 'cli'      // client 无法再细分桌面端/网页端
}
```

### 5.3 给插件的建议（诚实方案）

1. **映射建议**：`全部` ← 全部；`命令行` ← `inferSurface()==='cli'`；`机器人`/`远程` ← 需外部信号（见 3）；`桌面端`+`网页端` ← 合并为 `inferSurface()==='client'`，若 UI 必须两个 tab，则都指向同一集合并给出说明。
2. **要真正区分桌面端 vs 网页端**，只能引入**会话日志之外**的来源，例如：
   - 在插件自己的 host 端 hook 里，对**本次运行**新产生的会话打标（`profile` 名来自 `$DSH_HOME/profiles/<name>` 的环境/启动上下文）；历史会话无法回溯。
   - 依赖 `~/.dsh/storages/` 中后续新增的元数据（0.1.7-rc.2 还没有）。
3. **不要**用 `agentPreset` 冒充 surface —— 实测 `standard` 140 / `ptc` 8 / `cordis` 3，它是 agent 预设（是否 PTC 模式、是否 cordis 宿主），与会话来源**弱相关**（`cordis` 恰好只出现在子会话里，但那是子会话的特性，不是来源）。

---

## Q6 时间戳与全量枚举去重

### 6.1 时间戳

| 位置 | 字段 | 格式 | 实测样例 |
|---|---|---|---|
| header | `createdAt` | **epoch 毫秒**（整数） | `1790323734725` → 2026-09-25 |
| 每条记录 | `time` | **epoch 毫秒**（整数） | `1790407551765` |
| 每条记录 | `seq` | 会话内**单调递增整数**，从 0 起 | `24` |
| `assistant/message`.`data.stream[].time` | 同上 | epoch 毫秒（流式增量） | `1787722316950` |
| `approval/asked` 等 | 无独立时间 | 用外层 `time` | — |

**没有任何 ISO 字符串时间**（`~/.dsh/storages/workspace.json` 里的 `createdAt: "2026-09-25T08:08:54.131Z"` 是**工作区**元数据，与会话记录无关，别混用）。

> **时区**：`new Date(time)` 后请用**本地时区**做「按天」聚合。本机 `clientTimeZone` 恒为 `Asia/Shanghai`；用 `toISOString()` 会得到 UTC 日期，跨 08:00 边界会串天。`probe-sessions.mjs` 的 `aggregate()` 为了稳定用了 UTC（`toISOString().slice(0,10)`）——**插件里请改成本地时区**。

### 6.2 全量枚举

```
~/.dsh/sessions/
  --<normalized-cwd>--/                     ← workspace slug（把 cwd 的 \ : 空格等转成 ~XXXX~ 或 -）
    <session-id>/                           ← 一个会话一个目录
      session.v4.jsonl.zstd                 ← 当前 generation（本机 151/151 全是 v4）
      session.v3.jsonl.zstd                 ← 可能的旧 generation（同目录可并存 v0..vN）
      session.v4.jsonl                     ← compression:'none' 时的明文形态
```

- **遍历 `~/.dsh/sessions/*/*/session*.jsonl*` 就是全部**（实测 27 个 workspace × 151 会话目录，无遗漏目录、无隐藏元数据文件——会话目录里**只有**这一个文件）。
- **generation 选择**：同名会话目录下可能有多代，取**数值最高**的一代（官方 `open()` 行为：「运行时操作选择数值最高的规范 generation」，见 `README.zh.md` 磁盘布局节）。`probe-sessions.mjs` 的 `enumerateSessionFiles()` 已实现。
- **子会话是独立文件**，与父会话同在一个 workspace 目录下。本机 4 个子会话的目录名是**裸 UUID**（`0a83a1b2-...`），根会话是 `session-<uuid>` —— 这是个可用的启发式，但**不要依赖它**，请用 `header.origin === 'subagent'` / `header.delegationDepth > 0`。
- **识别子会话的两种可靠方式**：
  1. 自己的 header：`origin === 'subagent'` 且 `parentSession` 指向父会话 id；
  2. 父会话的 `subagent/catalog` 记录：`data.childId` 列出全部子会话：
     ```json
     {"type":"subagent/catalog","seq":162,"time":1790476589077,"data":{"version":0,"childId":"fc03e841-...","childCreatedAt":1790476589047,"mode":"continuable","label":"<subagent-label>"}}
     ```
- **是否排除子会话**：取决于产品口径。实测子会话 4 个占 **38,966,983 / 214,434,897 = 18.2%** —— **不是可忽略的量级**，必须显式给用户一个开关（建议默认**计入**，因为子 agent 的 token 同样计入账单）。

### 6.3 全量聚合伪代码

```js
// 1) 枚举（取每个会话目录的最高 generation）
files = []
for wsDir of readdir(SESSIONS_ROOT):
  for sessDir of readdir(wsDir):
    best = null
    for name of readdir(sessDir):
      m = /^session(?:\.v(\d+))?\.jsonl(\.zstd)?$/.exec(name)
      if m and (!best or gen(m) > best.gen): best = { gen, file }
    if best: files.push(best.file)

// 2) 逐文件解析（可缓存）
for file of files:
  key = `${stat.mtimeMs}:${stat.size}`
  if cache[file].key === key: summary = cache[file].summary   // 命中，零解析
  else:
    buf    = readFile(file)
    {frames, tornStart} = scanZstdFrames(buf)                 // 不解压的帧边界扫描
    records = []
    for f of frames:
      text = zstdDecompressSync(buf[f.start..f.end]).utf8      // ★ 逐帧解压
      records.push(...text.split('\n').filter(nonEmpty).map(JSON.parse))
    header = records[0]                                        // type === 'session'
    fold   = foldTokenUsage(records)                           // ★ 官方 (turn,step) 替换语义
    summary = { header, fold, routes: routesOf(records), surface: inferSurface(header, records) }
    cache[file] = { key, summary }

// 3) 过滤 + 聚合
selected = summaries.filter(s => includeSubagents || s.surface !== 'subagent')
totals = sum over selected of fold.totals
// 按天：new Date(header.createdAt) 用【本地时区】取 YYYY-MM-DD
// 按模型：优先按 (provider, model, turn, step) 归集；退化方案见下
```

**按模型归集的精确做法**：`assistant/message` **同时**携带 `data.message.source` 和 `data.usage`，所以**可以逐条精确归集，无需比例分摊**：

```js
for rec of records where rec.type === 'assistant/message' && rec.data.usage:
  route = `${rec.data.message.source.provider}/${rec.data.message.source.model}`
  acc[route] += totalFromBuckets(bucketsFrom(rec.data.usage))
```

> `probe-sessions.mjs` 的 `aggregate()` 为了不保留全量记录，用的是**按调用次数比例分摊**的近似（结果里有 `approx: true` 标记）。生产插件应改成上面的**逐条精确归集**，代价是每个文件多遍历一次 `records`（已在内存里，成本可忽略）。

### 6.4 去重注意事项

1. **不要对文件做「多代同时计入」** —— 同一会话目录里 v3 与 v4 并存时只取最高代，否则重复计数。
2. **不要重复计 `data.stream` 里的 usage** —— `assistant/message` 的 `data.usage` 与 `data.stream` 里最后一个 usage chunk 是**同一份数据的两种表示**。`usageOf()` 保证只取一份。
3. **`reasoningTokens` 不加**。
4. **同 `(turn, step)` 要替换而非累加**。
5. **`session-log-deepseek/delivery-accepted` 与用量无关**，是云端日志投递确认（`throughSeq`），忽略。
6. **全 0 usage 是有效数据**，不要当成缺失去回退（见 4.2 的 ⚠️）。
7. **跨 workspace 无需去重** —— 会话目录归属于唯一 workspace，同一 `session-<uuid>` 不会出现在两个 workspace 下（本机 151 个 id 全唯一）。

---

## Q7 性能与缓存

### 7.1 实测（Windows，Node v25.2.1，151 文件 / 93,354+ 记录 / 合计约 45 MB 压缩）

| 场景 | 耗时 | 备注 |
|---|---:|---|
| **冷解析全部 151 文件**（帧扫描 + 逐帧解压 + JSON.parse） | **3,490 ms** | 无缓存 |
| 冷聚合（含按天/按模型归集 + JSON 序列化） | **3,500–3,800 ms** | 端到端 |
| 单文件：2.7 MB / 4,779 帧 | 帧扫描 **2.9 ms** + 逐帧解压 **140 ms** = **143 ms** | 最大的那个文件 |
| **热聚合**（`mtimeMs+size` 缓存命中） | **94–254 ms** | 含 Node 启动 ≈60–90 ms；命中时 `elapsedMs` 实测 **4–110 ms** |
| 仅读 header（`scanZstdFrames(buf, 1)` + 解 1 帧） | ≈1 ms/文件 | 用于列表页 |

**结论**：
- 冷启动 3.5 s 对「打开一个看板」可接受但偏慢 → **建议做磁盘缓存**。
- 缓存键用 **`mtimeMs + size`** 足够可靠：日志是 append-only，任何追加都会同时改变 size 和 mtime。实测本机 151/151 全部命中，二次聚合 ~0.1 s。
- **不需要增量追加解析**（不需要记住上次解析到第几帧）——因为文件级缓存粒度已经让热路径降到 4 ms；真要增量，可记录 `(bytesRead, lastSeq)` 从 `scanZstdFrames` 的偏移继续。收益很小，复杂度不划算。
- 建议的缓存位置：插件自己的 storage（**不要写 `~/.dsh/sessions/`**，那是 DSH 的数据目录）。
- 若要进一步压低冷启动：**并发解析**（`node:worker_threads` 或 `p-limit` 4–8 并发）。`zstdDecompressSync` 是同步阻塞 CPU 的，单线程下 3.5 s 基本是硬底；4 并发预期降到 ~1.1 s。

### 7.2 内存

全量解析 151 文件会把 ~200 MB 解压后的 JSON 留在内存（`tool/result` 的文本很大，单条可达 19 KB+）。**必须逐文件处理、处理完立即丢弃 `records`**，只保留 `summary`（本脚本就是这么做的）。`aggregate()` 全程峰值 RSS < 300 MB。

---

## 8. 实测汇总数字

```
$ node probe-sessions.mjs perf
{
  "files": 151,
  "records": 93354,
  "coldParseMs": 3490,
  "warmAggregateMs": 4156,     ← 首次运行（缓存未建立）
  "cacheHits": 0,
  "sessions": 151,
  "totalTokens": 205342949
}
$ node probe-sessions.mjs perf     # 第二次（缓存已建立）
{ "files": 151, "records": 93354, "coldParseMs": 3051, "warmAggregateMs": 98, "cacheHits": 151, ... }
```

全量聚合（`aggregate` 命令原样输出，快照于 2026-09-27，**含** 4 个子会话）：

```json
{
  "files": 151, "sessions": 151, "cacheHits": 148, "elapsedMs": 110,
  "totals": {
    "uncachedInputTokens": 10784280,
    "outputTokens": 1484906,
    "cacheReadTokens": 204641536,
    "cacheWriteTokens": 0,
    "reasoningTokens": 395020,
    "totalTokens": 216910722
  },
  "bySurface": { "client": 146, "subagent": 4, "none": 1 },
  "byProvider": { "reasonix": 131, "commandcode": 11, "deepseek-account": 2, "opencode-go": 7 }
}
```

| 维度 | 数值 |
|---|---:|
| 会话文件 | 151 |
| 根会话 / 子会话 | 147 / 4 |
| 总 token（官方公式） | **216,910,722** |
| 根会话合计 | ≈176,558,658 |
| 子会话合计 | ≈40,634,317（占 **18.7%**） |
| `uncachedInputTokens` | 10,784,280 |
| `outputTokens` | 1,484,906 |
| `cacheReadTokens` | 204,641,536（**占总量 94.3%**） |
| `cacheWriteTokens` | **0（本机 provider 均不下发）** |
| `reasoningTokens` | 395,020（⊂ output，**不计入 total**） |
| 有非零用量的会话 | **17 / 151**（其余 134 个为 `reasonix` 历史导入，usage 全 0） |
| 有非零用量的日期 | 2026-09-25 / 09-26 / 09-27 三天 |

Top 5 会话（按 token）：

| session-id | token | 标题 |
|---|---:|---|
| `session-5964a5d3-...` | 44,295,843 | `<标题已脱敏>` |
| `session-c4ae5dc9-...` | 34,322,037 | `<标题已脱敏>` |
| `session-1839f2e0-...` | 29,325,164 | `<标题已脱敏>` |
| `session-399ee08f-...` | 19,132,460 | `<标题已脱敏>` |
| `session-d769c20e-...` | 15,103,438 | `<标题已脱敏>` |

按 provider（按调用比例分摊到路由；精确做法见 6.3）：

| provider | token |
|---|---:|
| `commandcode` | ≈104,722,572 |
| `opencode-go` | ≈57,345,680 |
| `deepseek-account` | ≈55,124,723 |
| `reasonix` | 0（133 个导入会话 usage 全 0） |

> ⚠️ **数字每次运行都会增长**，因为当前这个会话正在被写入（这也是验证「缓存按 `mtimeMs+size` 失效」的现成实验：168 小时内它反复命中，只有正在写的那个文件缓存未命中）。上表是 2026-09-27 单次快照，请以自行跑一遍 `aggregate` 的结果为准。

---

## 9. 给插件的落地建议

### 9.1 必做

1. **逐帧解码**（Q1），不要用 `zstdDecompressSync(wholeFile)`。
2. **`(turn, step)` 替换语义折叠**（Q3.3），不要裸求和。
3. **`totalTokens = input + output + cacheRead + cacheWrite`**，`reasoningTokens` 不加。
4. **全 0 usage 视为有效**，不要回退到 `stream`。
5. **按天用本地时区**，不要 `toISOString()`。
6. **`mtimeMs + size` 文件级缓存**，缓存写在自己的 storage 里。
7. **子会话开关**（默认建议计入），用 `header.origin === 'subagent'` 判定。

### 9.2 建议

8. **逐条精确归集模型**（`(rec.data.message.source, rec.data.usage)` 同一条记录），不要比例分摊。
9. **`cacheReadTokens` 单列展示**（本机占 ~95%，不分列的话「输入 token」会失真到无法解读）。
10. **按 provider 也分一层**（用户会想看「这个月 commandcode 用了多少 vs deepseek-account」）。
11. **面向前端的「来源」筛选**：只实现能可靠区分的三档（子会话 / 有客户端 / 无客户端），其余档位要么合并、要么由插件在 host 端 hook 里对**新会话**额外打标（历史无法回溯）。

### 9.3 陷阱清单

| 陷阱 | 后果 |
|---|---|
| 直接 `zstdDecompressSync(整个文件)` | 只拿到 1 条 header 记录，总量显示 0 |
| 用 `createZstdDecompress()` 流式拼接读 | 同上，只出第一帧 |
| 按帧魔数 `28 B5 2F FD` 的出现位置切分 | **会误切** —— 压缩数据块里也出现同样的字节序列（本机最大文件魔数出现次数恰好等于帧数只是巧合）。**必须按官方 `scanZstdFrames` 的帧头/块头结构解析。** |
| `reasoningTokens` 加进 total | 重复计数（reasoning ⊂ output） |
| 同一 `(turn,step)` 累加而不替换 | 重试场景多算（本机数据恰好未触发） |
| 用 `session_projcache` 当真源 | 只有 22 个会话有缓存，且惰性写入 |
| 对 `reasonix` 的 0 usage 报错或回退 | 133 个会话口径错乱 |
| `new Date(createdAt).toISOString().slice(0,10)` | 东八区跨天串位 |
| 把 `surfaceOp` 当「客户端来源」 | 语义完全不同（那是模型可见上下文的作用） |
| 把 `agentPreset` 当 surface | `standard`/`ptc`/`cordis` 是 agent 预设 |

---

## 附录 A：`probe-sessions.mjs` 命令

```powershell
$env:PYTHONIOENCODING='utf-8'; [Console]::OutputEncoding=[System.Text.Encoding]::UTF8
cd C:\<local-dir>\dsh-usage\docs\research

node probe-sessions.mjs types                        # 全局记录类型统计（151 文件）
node probe-sessions.mjs scan  <文件>                 # 单文件：帧数 + 类型计数
node probe-sessions.mjs session <文件>               # 单会话详情（token/模型/来源/标题）
node probe-sessions.mjs sample <type> [n]            # 某类型样例记录
node probe-sessions.mjs aggregate [--exclude-subagents] [--no-cache] [--root <dir>]
node probe-sessions.mjs perf                         # 冷/热耗时基准
```

可 `import` 的导出：

```js
import {
  scanZstdFrames,        // (Buffer, maxFrames?) -> { frames:[{start,end}], tornStart? }
  readSessionRecords,    // (path) -> { records, frames, bytes, tornStart }
  readSessionHeader,     // (path) -> header（只解第一帧）
  enumerateSessionFiles, // (root?) -> string[]（每会话取最高 generation）
  usageOf,               // (record) -> usage | undefined（含 stream 回退）
  bucketsFrom,           // (usage) -> 5 桶
  foldTokenUsage,        // (records) -> { totals, byTurn, byStep, attempts, last }
  totalFromBuckets,      // (buckets) -> 官方公式总额
  inferSurface,          // (header, records) -> 'subagent'|'client'|'cli'|'none'
  sessionSummary,        // (path) -> 会话摘要
  aggregate,             // ({root,includeSubagents,useCache}) -> 全量聚合
  DSH_SESSIONS_ROOT,
} from './probe-sessions.mjs'
```

## 附录 B：证据索引（asar 路径:行号）

| 主题 | 位置 |
|---|---|
| 帧魔数常量 | `@deepseek-ai/dsh-session-persistence-jsonl/lib/index.js:1288` |
| 帧扫描算法 | 同上 `:1300-1363` |
| 逐帧解压（公共 API） | 同上 `:1253-1279`（`PublicZstdFrameDecoder`） |
| 逐帧解压（Node 私有优化） | 同上 `:1133-1245` |
| 撕裂尾帧恢复 | 同上 `:1388-1397` |
| 写盘：header 帧 + 批次帧 | 同上 `:3187-3197` |
| 校验和选项 | 同上 `:1291`、`:1560-1562` |
| 磁盘布局 / 已提交不回写 | 同上 `README.zh.md`「磁盘布局」「持久性与崩溃语义」 |
| `TokenUsage` 接口 | `@deepseek-ai/dsh-llm/lib/typert.host.js:529` |
| Anthropic 字段映射 | `@deepseek-ai/dsh-llm-deepseek/lib/index.js:1803-1816` |
| `totalTokens` 赋值 | 同上 `:1988` |
| pi-ai 字段映射 | `@deepseek-ai/dsh-llm-pi-ai/lib/index.js:1367-1375` |
| `usageTokens()` 公式 | `@deepseek-ai/dsh-token-meter/lib/index.js:592-595` |
| `tokenUsage` 投影折叠（替换语义） | `@deepseek-ai/dsh-token-meter/lib/types/usage-projection.js` |
| `contextPressure` 投影 | 同上 |
| `surfaceOp` / surface fold | `@deepseek-ai/dsh-token-meter/lib/types/surface-fold.js`、`surface-projection.js` |
| `reasoningTokens ≤ outputTokens` 约束 | `@deepseek-ai/dsh-token-meter/lib/types/turn-usage.js:29` |
| 每轮用量状态机 | `@deepseek-ai/dsh-client-ui-chat/lib/client.js:10209-10322` |
| `lastAssistantStreamChunk` | `@deepseek-ai/dsh-llm/lib/types/assistant-stream.js:304-311` |
| SessionHeader 精确字段 | `@deepseek-ai/dsh-session-format-v3-to-v4/README.zh.md:216` |
| `SessionHeader` TS 声明 | `@deepseek-ai/dsh-api-session-controller/lib/typert.host.js:213, 2017, 2189` |
| surface 事件类型集合 | `@deepseek-ai/dsh-session/lib/types/surface.js:13-34` |
| 投影缓存结构 | `~/.dsh/storages/session_projcache/sessions/<session-id>.json` |
| 工作区元数据（非会话） | `~/.dsh/storages/workspace.json` |
