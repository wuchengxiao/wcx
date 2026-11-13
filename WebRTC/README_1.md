# WebRTC 点对点聊天（静态版）

单文件纯静态页面 `index_1.html`：**没有任何后端**，HTML + JS 直接跑在浏览器里。
双方通过第三方免费公共 WebSocket 服务器交换 SDP / ICE 信令，聊天消息与文件走 **WebRTC DataChannel** 点对点传输（不经过服务器）。

页面本身只保留操作步骤；实现方法、协议细节、故障排查本文档说明。

---

## 文件说明

| 文件 | 作用 |
| --- | --- |
| `index_1.html` | 静态版主页面（推荐），单文件、零依赖 |
| `index.html` | 早期 PeerJS 版示例，依赖 `lib/peerjs.min.js`（缺失时自动回退 unpkg CDN），走 PeerJS 公共服务器与其免费 TURN |
| `server.cjs` | 零依赖静态文件服务器（Node 内置模块），默认端口 5173，监听 `0.0.0.0`，方便手机用局域网 IP 访问 |

## 运行方式

任选其一：

1. **直接双击 `index_1.html`**（`file://` 也能正常工作，页面不用 `fetch`，WebSocket 不受同源限制）。
2. 用自带静态服务器（手机测试推荐）：

```powershell
node server.cjs
# 输出示例：
# Static site running at http://127.0.0.1:5173
# LAN access: http://192.168.x.x:5173
```

端口被占用时可用环境变量覆盖：

```powershell
$env:PORT=5180; node server.cjs
```

然后浏览器打开 `http://127.0.0.1:5173/index_1.html`；手机连同一 Wi-Fi 时打开控制台打印的 `LAN access` 地址。

## 操作步骤

1. 双方各自打开本页面。
2. 填写**相同的房间名**，点「应用房间 / 重连信令」。
3. 在「同一房间的在线设备」里点对方 ID 的「连接」（双方同时点也没关系，会自动协商）。
4. 状态显示「已连接：…」且输入框可用后，即可发送消息、表情和文件（Enter 发送）。
5. 连不上时先点「网络检测」，按提示补充 TURN 服务器（见下文「NAT 与 TURN」）。

---

## 实现原理

### 1. 为什么用 y-webrtc 公共信令

WebRTC 只规定 P2P 媒体/数据通道，**不规定信令**，需要一条通道把 SDP 和 ICE 候选送给对方。为了做到「零后端」，只能借用别人长期在线的公共 WebSocket 服务。

实测过的公共端点：

| 端点 | 结果 |
| --- | --- |
| `wss://y-webrtc.fly.dev` | **可用**：y-webrtc 信令服务，按 topic 广播 JSON |
| `wss://signaling.yjs.dev` | 作为备用（同一协议） |
| `demo.piesocket.com` 旧/新 demo key | 握手成功但返回 `Unkown API Key`，需注册 |
| `socketsbay.com`、`ntfy.sh`、`broker.emqx.io`、`relay.damus.io` | 连接失败/超时 |
| `ws.postman-echo.com`、`echo.websocket.events` | 只回显给自己，无法向对端广播 |

因此默认使用 `wss://y-webrtc.fly.dev`，页面里也可填写其它兼容地址。

### 2. 信令协议（y-webrtc 风格）

```jsonc
// 连接后先订阅房间（topic）
{ "type": "subscribe", "topics": ["cline-p2p-demo"] }

// 发送：服务器把 data 广播给该 topic 的所有订阅者（包括发送者自己）
{ "type": "publish", "topic": "cline-p2p-demo", "data": { "kind": "hello", "from": "a1b2c3d4" } }

// 接收
{ "type": "publish", "topic": "cline-p2p-demo", "data": { ... } }
```

服务器会把消息**回显**给发送者，所以客户端用 `data.from === myId` 过滤自己的消息。

自定义的 `data.kind`：

| kind | 说明 |
| --- | --- |
| `hello` | 在线心跳（每 4 秒），用于「在线设备」列表 |
| `bye` | 主动离开房间 / 关页 |
| `offer` | 发起方 SDP（含 `to`） |
| `answer` | 应答方 SDP |
| `candidate` | trickle ICE 候选 |
| `hangup` | 挂断通知 |
| `busy` | 对方已在与别人通信 |

在线状态：`hello` 刷新 `peers` Map，超时 12 秒未收到心跳即移除。信令服务器按顺序尝试（单个超时 8 秒），断线后 2 秒自动重连；切换房间先发 `bye` 再重新订阅。

### 3. 建立 P2P 连接

发起方（点「连接」的一方）：

1. `new RTCPeerConnection({ iceServers, iceCandidatePoolSize: 2 })`
2. `pc.createDataChannel("chat", { ordered: true })`
3. `createOffer()` → `setLocalDescription()` → 广播 `offer`
4. `onicecandidate` 每来一个候选就广播 `candidate`

应答方（收到 `offer` 的一方）：

1. `setRemoteDescription(offer)` → 补加缓存的候选 → `createAnswer()` → 广播 `answer`

两个容易踩的坑，页面都已处理：

- **候选早于描述到达**：候选可能在 `offer`/`answer` 之前就送到，此时 `remoteDescription` 还是 `null`，直接 `addIceCandidate` 会抛错。所以全部先压进 `pendingCandidates`，等远端描述就绪后再统一补加。
- **双方同时点「连接」的 offer 冲突（glare）**：比较双方 ID，ID 较大的一方 `teardown` 后转为应答方，ID 较小的一方继续作为发起方，避免两条 offer 互相顶掉。

其它保护：收到 `offer` 时若已连接其他设备则回 `busy`；建连计时器 25 秒，超时提示「ICE 未能完成」并清理连接；页面关闭时广播 `bye` + `hangup`。

### 4. NAT 与 TURN（跨网络的关键）

页面默认的 ICE 服务器：

```js
const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun.cloudflare.com:3478" },
  { urls: "stun:stun.miwifi.com:3478" },
  { urls: "stun:stun.chat.bilibili.com:3478" },
  { urls: ["turn:openrelay.metered.ca:80", "turn:openrelay.metered.ca:443",
           "turn:openrelay.metered.ca:443?transport=tcp"],
    username: "openrelayproject", credential: "openrelayproject" },
  ...CUSTOM_TURN_SERVERS
];
```

- **同一局域网**：只靠 host 候选就能直连，STUN/TURN 全部不可用也不影响。
- **跨网络**（手机流量 ↔ 家庭宽带、对称 NAT、运营商 CGNAT）：**必须有一个真正可用的 TURN**。STUN 只能发现公网地址，打洞失败时没有中继就连不通。

开发机实测（沙箱网络）所有 STUN/TURN 都返回 `701 ... host lookup error`，仍能在同一台机器的两个标签页之间靠 host 候选直连成功。这说明「本机能连」不代表「跨网能连」。

补充 TURN 的方式：编辑 `index_1.html` 配置区的 `CUSTOM_TURN_SERVERS`：

```js
const CUSTOM_TURN_SERVERS = [
  { urls: "turn:your.turn.server:3478", username: "user", credential: "pass" },
  { urls: "turns:your.turn.server:5349", username: "user", credential: "pass" }
];
```

免费/低价 TURN 可选：metered.ca（Open Relay 已限流）、Cloudflare Calls、自建 coturn。云厂商的 TURN 通常要求短期凭证，需要另外搭一个小接口签发。

### 5. 连接质量显示

`onopen` 之后调用 `getStats()`，从 `transport.selectedCandidatePairId`（找不到时退化为 `state === "succeeded"` 且 `selected`/`nominated` 的 `candidate-pair`）读取本端/对端候选类型，判断是否经过中继：

- 任一端是 `relay` → 显示「TURN 中继」
- 否则 → 显示「P2P 直连」

同时把 local/remote 候选类型（`host` / `srflx` / `prflx` / `relay`）写进状态栏，方便判断网络形态。

### 6. 「网络检测」按钮

新建一个临时 `RTCPeerConnection`，创建 dummy DataChannel 后 `createOffer()` + `setLocalDescription()`，收集候选最多 8 秒，然后：

- 按 `typ host|srflx|prflx|relay` 统计数量并打印每个候选原文；
- 打印前 6 条 `onicecandidateerror`（例如 `701 STUN host lookup received error` 表示 DNS/网络层面就解析不到 STUN 域名）；
- `relay = 0` 时在状态栏警告「缺少 relay，跨网络需要 TURN」。

## DataChannel 上的应用层协议

所有消息都是 JSON 文本：

| kind | 字段 | 说明 |
| --- | --- | --- |
| `chat` | `text` | 普通聊天 |
| `file-start` | `id`, `name`, `size`, `mime` | 文件元信息 |
| `file-chunk` | `id`, `data`(base64) | 16KB 分片 |
| `file-end` | `id` | 传输结束 |

文件传输实现要点：

- 每片 16KB（`FILE_CHUNK_SIZE`），Base64 编码后放入 JSON（体积约 +33%，换来纯文本协议的简单可靠）。
- **背压**：发送前若 `dataChannel.bufferedAmount > 1MB` 则每 50ms 等待一次，避免一次性塞爆发送缓冲区导致内存暴涨。
- 接收端按 `id` 累积 `Uint8Array`，收齐后 `new Blob(chunks, { type: mime })` + `URL.createObjectURL()` 生成下载链接（文件名取自对端）。
- 限制：整个文件会被读进内存（`file.arrayBuffer()`），**大文件（数百 MB 以上）容易 OOM**；没有进度条、没有断点续传、没有校验和。传输过程中断开则丢弃半成品。

## 安全与隐私

- DataChannel 本身由 **DTLS 加密**，P2P 直接连接时中间人难度高；走 TURN 时内容仍是端到端加密的，中继只转发密文。
- **信令是明文的（wss 只加密传输链路）**：公共服务器能看到房间名、SDP、ICE 候选，其中候选包含内网 IP。不要在公共信令服务器上传敏感内容。
- **房间名等于口令**：同一房间内任何人收到 `offer` 都会自动应答建连（页面只有「已连接其他人时回 busy」的保护）。因此请使用难猜的房间名，`cline-p2p-demo` 仅用于本地测试。
- 页面不持久化任何消息，刷新即丢失。

## 调试

浏览器控制台执行：

```js
p2pDebug()
// { myId, room, joining, connected, remoteId, peers: [...],
//   signalingState, connectionState, iceConnectionState, iceGatheringState,
//   dataChannelState, pendingCandidates }
```

状态含义：

| 字段 | 期望值 |
| --- | --- |
| `signalingState` | `1`（WebSocket.OPEN） |
| `connectionState` / `iceConnectionState` | `connected` |
| `dataChannelState` | `open` |
| `pendingCandidates` | 建连完成后应为 `0`（残留说明候选未补加） |

ICE / 连接状态变化会打印 `[ice] state:`、`[pc] state:`，STUN/TURN 解析失败会打印 `[ice] 701 ... host lookup error`，据此可判断是信令不通还是 NAT 打洞失败。

## 自动化验证

开发时用 Node + headless Edge（`--headless=new --remote-debugging-port`）通过 CDP 打开两个标签页，自动完成：等待信令连接 → 校验双方出现在「在线设备」→ 点「连接」→ 断言 `p2pDebug().connected === true` → 发送一条消息并在对端校验。当时的输出：

```
信令已连接
A = d2f54f0d | B = 541f861a
在线设备发现正常
B 点击连接： clicked
P2P 已连接
A 状态： 已连接：541f861a（P2P 直连 / 本机 host，对端 host）
B 状态： 已连接：d2f54f0d（P2P 直连 / 本机 host，对端 prflx）
消息收发：OK
RESULT: CONNECTED
```

该脚本为一次性验证工具，验证完毕后已删除；需要回归测试时按上面步骤重新编写即可（依赖本机安装 Edge 与 Node 22+）。

## 已知限制

- 公共信令服务器**没有 SLA**：`y-webrtc.fly.dev` 是免费实例，可能限流或下线；可自行部署 y-webrtc 信令服务并填入页面。
- 只支持**一对一会话**（第二个人发起会收到「对方正在与其它设备通信」）。
- 文件传输无进度显示、无断点续传，大文件占内存。
- 页面无消息历史、无消息确认/重发机制（DataChannel 有序可靠，但连接断开即丢失上下文）。
- 房间名区分大小写与首尾空格（保存前会 `trim()`）。
- 跨网络需要你自己提供可用的 TURN，仓库不内置任何付费凭证。

## 浏览器兼容

Chrome / Edge 80+、Firefox 75+、Safari 15+。依赖 `RTCPeerConnection`、`RTCDataChannel`、`crypto.getRandomValues`、`Blob`、`URL.createObjectURL`。`file://` 直开即可，不需要 HTTPS（信令是 `wss://`，不受页面来源限制）。

