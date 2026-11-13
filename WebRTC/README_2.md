# WebSocket 中继聊天（静态版）

单文件纯静态页面 `index_2.html`：**没有本项目自己的后端**，HTML + CSS + JS 直接跑在浏览器里。
两个页面各自连接第三方免费公共 WebSocket 服务器，服务器把消息**直接转发**给同一房间的其他页面。
全程不使用 WebRTC、SDP、ICE、STUN/TURN，也不做任何点对点连接。

页面本身只保留必要的操作说明；需求、架构、协议和实现细节由本文档说明。

---

## 需求

1. 只用静态页面（HTML + JS），不编写、不部署自己的服务端。
2. 使用第三方免费的公共 WebSocket 服务器。
3. 网页连接 WebSocket 服务器，由服务器把消息转发到另一个网页。
4. **不采用信令方式**：WebSocket 不是用来交换 WebRTC 连接参数，而是直接承载聊天消息；不使用 `RTCPeerConnection`。
5. `index_2.html` 只保留必要操作说明和简单布局。
6. 本文档记录需求、架构、代码实现方式和其它说明。

## 文件说明

| 文件 | 作用 |
| --- | --- |
| `index_2.html` | 本需求的主页面，单文件、零依赖、纯静态 |
| `README_2.md` | 本文档 |
| `index_1.html` | 对照示例：WebRTC + 公共信令 + DataChannel 点对点聊天 |
| `server.cjs` | 可选的零依赖静态文件服务器，默认端口 5173，方便手机通过局域网访问 |

`index_2.html` 与 `index_1.html` 是两种不同模式：

| | `index_1.html` | `index_2.html` |
| --- | --- | --- |
| 连接方式 | WebRTC 点对点 | WebSocket 服务器中继 |
| WebSocket 用途 | 交换 SDP / ICE 信令 | 直接转发聊天消息 |
| 消息路径 | 浏览器 A ⇄ 浏览器 B | 浏览器 A → 服务器 → 浏览器 B |
| 是否用 `RTCPeerConnection` | 是 | 否 |
| 跨网络 | 依赖 NAT 打洞 / TURN | 双方都能连上公共服务器即可 |

## 运行方式

任选其一：

1. **直接双击 `index_2.html`**。
   `file://` 也可以正常工作：页面不加载外部资源，`wss://` 连接不受同源策略限制。
2. 使用自带静态服务器（手机测试推荐）：

```powershell
node server.cjs
# 输出示例：
# Static site running at http://127.0.0.1:5173
# LAN access: http://192.168.x.x:5173
```

然后浏览器打开 `http://127.0.0.1:5173/index_2.html`。
手机与电脑连同一 Wi-Fi 时，打开控制台打印的 `LAN access` 地址，并访问 `/index_2.html`。

端口被占用时可覆盖：

```powershell
$env:PORT=5180; node server.cjs
```

## 操作步骤

1. 双方各自打开 `index_2.html`。
2. 填写**相同的房间名**和各自的昵称，点「连接」。
3. 状态显示「已连接」、在线人数变成 2 后，在输入框输入消息。
4. 按 `Enter` 发送，`Shift` + `Enter` 换行。
5. 对方的页面会收到由公共 WebSocket 服务器转发过来的同一条消息。
6. 断开时点「断开」；异常断线会自动重连，房间名与昵称会保留。

也可以直接用 URL 指定房间，方便把地址发给对方：

```
http://127.0.0.1:5173/index_2.html?room=my-room-8f3k
```

## 架构

```
┌──────────────────────┐        wss://        ┌──────────────────────────┐
│ 页面 A               │ ───────────────────> │ 第三方公共 WebSocket 服务 │
│ index_2.html         │   subscribe / publish │ y-webrtc pub/sub         │
│ 浏览器原生 WebSocket │ <─────────────────── │ topic: cline-ws2-relay:* │
└──────────────────────┘   广播同一 topic 的消息 └──────────────────────────┘
                                                          │
                                                          │ 广播
                                                          ▼
                                               ┌──────────────────────┐
                                               │ 页面 B               │
                                               │ index_2.html         │
                                               │ 同房间 / 同 topic    │
                                               └──────────────────────┘
```

关键点：

- 两个页面都只是普通的 WebSocket 客户端，没有主从之分。
- 服务器按 topic 广播：一条 `publish` 会发给该 topic 下所有订阅者（包括发送者自己）。
- 页面没有创建 `RTCPeerConnection`，没有 `createOffer` / `createAnswer`，也没有 ICE 候选交换。
- 因此消息一定能到达任何连上服务器的页面，不受 NAT 类型影响；代价是消息经过第三方服务器。

## 为什么选这个公共服务器

默认地址：

```text
wss://y-webrtc.fly.dev
```

它是 y-webrtc 项目的公开信令服务器，实现了按 **topic 订阅 / 广播** 的 JSON 协议。虽然项目名字里带 signaling，但本页面**只使用它的 pub/sub 广播能力**，不发送任何 SDP / ICE 数据，所以不构成 WebRTC 信令方案。

开发时用两个连接做过实际探测：

| 端点 | 结果 |
| --- | --- |
| `wss://y-webrtc.fly.dev` | **可用**：A 执行 publish，B 能收到同一 topic 的广播 |
| `wss://signaling.yjs.dev` | 协议兼容，但本次探测握手报错，可填入高级设置重试 |
| `wss://socketsbay.com/wss/v2/1/demo/` | 连接后收不到对端消息（超时） |
| `wss://demo.piesocket.com/...` demo key | 连接后收不到对端消息（超时） |
| `wss://ws.postman-echo.com/raw`、`wss://echo.websocket.org` | 只回显给自己，无法转发给另一个网页 |

如果没有可用的公共实例，可以自行部署 y-webrtc 的 `bin/server.js`（Node.js）：

```powershell
git clone https://github.com/yjs/y-webrtc.git
cd y-webrtc
npm install
$env:PORT=4444; node ./bin/server.js
```

然后把页面高级设置里的地址改成 `ws://localhost:4444`。
注意：页面通过 `https://` 打开时，浏览器只允许连接 `wss://`；`file://` 或 `http://` 页面可以连 `ws://`。

## WebSocket 协议

### 1. 服务器层（y-webrtc 风格）

连接成功后先订阅房间对应的 topic：

```json
{ "type": "subscribe", "topics": ["cline-ws2-relay:my-room"] }
```

发送消息：

```json
{
  "type": "publish",
  "topic": "cline-ws2-relay:my-room",
  "data": {
    "kind": "chat",
    "from": "01a70c5b",
    "name": "A",
    "text": "你好",
    "ts": 1794562501904
  }
}
```

服务器把 `data` 原样广播给该 topic 下的所有订阅者，并附加接收者数量：

```json
{
  "type": "publish",
  "topic": "cline-ws2-relay:my-room",
  "data": { "kind": "chat", "from": "01a70c5b", "name": "A", "text": "你好", "ts": 1794562501904 },
  "clients": 2
}
```

服务器还会：

- 把消息**回显给发送者**，所以客户端必须用 `from === 自己的 ID` 过滤回显；
- 每 30 秒发一次 WebSocket ping 帧，浏览器会自动回 pong，页面不需要处理；
- 支持 `{ "type": "ping" }` → `{ "type": "pong" }`，本页面未使用。

### 2. 应用层（`data.kind`）

| kind | 字段 | 说明 |
| --- | --- | --- |
| `hello` | `from`, `name`, `ts` | 上线 / 心跳，每 4 秒一次，用于在线列表 |
| `chat` | `from`, `name`, `text`, `ts` | 聊天正文 |
| `leave` | `from`, `name`, `ts` | 主动断开 / 关闭页面时尽力发送 |

topic 统一加前缀：`cline-ws2-relay:` + 房间名。
前缀用于降低与其他 y-webrtc 客户端（它们直接用房间名当 topic）的碰撞概率。

### 3. 在线状态

- 收到 `hello` 或 `chat` 时刷新 `peers` Map 中对应 ID 的 `lastSeen`。
- 每 4 秒扫描一次，超过 12 秒没有消息的 peer 判定为离线并移除。
- 在线人数 = 其他在线页面数 + 自己（已连接时 +1）。
- 新 peer 第一次出现时显示「X 加入了房间」；收到 `leave` 或超时移除时显示「X 离开了房间 / 已离线」。

## 代码实现方式

`index_2.html` 内部是一个 IIFE，按职责分为以下几块。

### 1. 连接生命周期

```js
ws = new WebSocket(serverUrl);
ws.addEventListener("open", () => {
  sendJson({ type: "subscribe", topics: [topic] });
  announce("hello");
  startHeartbeat();
});
```

- 连接成功后才允许输入；连接中 / 断开时输入框和发送按钮禁用。
- 房间名、昵称、服务器地址在连接期间锁定，避免运行时状态与已订阅 topic 不一致。
- `generation` 计数器给每次连接编号。旧连接迟到的 `close` / `error` / `message` 事件因为编号不匹配会被忽略，防止「断开后自动重连」与旧事件互相干扰。
- 非手动断开时，`close` 事件触发 3 秒后自动 `connect()`；手动断开（按钮 / 关页）不重连。
- 页面关闭时尽力发送 `leave` 并 `close(1000)`，让对端尽快更新在线列表。

### 2. 消息发送

```js
function publish(data) {
  return sendJson({
    type: "publish",
    topic,
    data: Object.assign({}, data, { from: myId, name: currentName, ts: Date.now() })
  });
}
```

- `myId` 在页面加载时生成：优先 `crypto.randomUUID()`，退化为 `crypto.getRandomValues()`，最后才用 `Math.random()`。
- 消息正文最多 2000 字符，由输入框 `maxlength` 和代码双重限制。
- 发送成功后才在本地追加自己的气泡；服务器回显的自己消息会被过滤，避免重复。

### 3. 消息接收

```js
if (!message || message.type !== "publish" || message.topic !== topic) return;
if (data.from === myId) return; // 忽略自己的回显
if (data.kind === "chat") appendMessage({ name, text, own: false, ts });
```

- 只处理 `type === "publish"` 且 topic 完全匹配的消息，其它协议消息（`pong` 等）直接忽略。
- 对端昵称、文本都会做类型检查和长度截断，避免异常数据破坏页面。
- 渲染用 `textContent` 而不是 `innerHTML`，消息里的 HTML / 脚本只会显示成普通文本。
- 消息区最多保留 300 个节点，超出后移除最旧的，长时间聊天不会无限占内存。
- 每次追加后滚动到底部。

### 4. 在线状态与心跳

- 每 4 秒 `publish({ kind: "hello" })`。
- `peers` 是 `Map<id, { name, lastSeen }>`；`hello` / `chat` 都会刷新 `lastSeen`。
- 每 4 秒清理一次超过 12 秒没有消息的 peer。
- 公告消息（加入 / 离开 / 离线）作为系统行居中显示。

### 5. 本地记忆与 URL 参数

- 房间名、昵称、服务器地址保存到 `localStorage`（键名 `ws2.room` / `ws2.name` / `ws2.server`），下次打开自动填充。
- 支持 `?room=xxx` 覆盖房间名，便于把链接直接发给对方。
- `file://` 或隐私模式下 `localStorage` 可能不可用，读写都包在 `try/catch` 中，失败时退化为「仅本次有效」。

### 6. 界面与可访问性

- 页面只有三块：操作说明、连接设置、聊天区，移动端单列布局。
- 状态文字通过状态点颜色区分：未连接（灰）、连接中（橙）、已连接（绿）、错误（红）。
- 消息区设置 `aria-live="polite"`，新消息可被读屏软件播报。
- 支持 `Enter` 发送、`Shift+Enter` 换行；使用 `event.isComposing` 避免中文输入法选词时误发送。

## 安全与隐私

- **传输加密不等于内容保密**：`wss://` 只加密浏览器到服务器这一段；公共服务器能读取、记录、转发全部消息，没有端到端加密。
- **房间名就是口令**：知道房间名的人都能订阅同一 topic、读消息、冒充昵称发言。请使用足够长、难猜的房间名；页面里的 `my-room-8f3k` 只是示例。
- **没有身份认证**：昵称由客户端自己填写，无法证明对方是谁；不要把它当成可信身份。
- **不要发送敏感信息**：密码、证件、私钥、公司内部资料等都不应经过公共免费服务器。
- **消息不持久化**：刷新页面或关闭标签页后消息全部丢失；服务器也不提供历史记录。
- 页面本身不加载第三方脚本，不存在 CDN 供应链风险；唯一的第三方依赖是 WebSocket 端点。

## 验证

开发时使用 Node 24 + 无头 Edge（`--headless=new --remote-debugging-port=9333`）通过 CDP 打开两个 `index_2.html` 标签页，自动执行：

1. 两个页面填写同一房间、不同昵称并点「连接」；
2. 等待双方 `ws2Debug().connected === true`；
3. 等待双方 `peers.length >= 1`；
4. 页面 A 输入消息并提交；
5. 在页面 B 的 DOM 中查找同一条消息；
6. 检查页面 A 是否本地渲染了自己的消息。

本次实测输出：

```text
房间: e2e-f217a0ac
A: {"room":"e2e-f217a0ac","name":"A","connected":true,"online":2,"peers":[{"name":"B"}]}
B: {"room":"e2e-f217a0ac","name":"B","connected":true,"online":2,"peers":[{"name":"A"}]}
B 收到消息: A 发出的中继测试消息 1794562501904
A 本地渲染: true
A 状态栏: 已连接 · 房间 e2e-f217a0ac
B 状态栏: 已连接 · 房间 e2e-f217a0ac
B 在线人数: 在线 2 人
RESULT: PASS
```

验证脚本为一次性工具，运行完已删除；需要回归时按上面步骤重新编写即可。

## 调试

浏览器控制台执行：

```js
ws2Debug()
// {
//   myId, room, name, server, topic,
//   socketState: 0|1|2|3, connected, online,
//   peers: [{ id, name, ageMs }]
// }
```

`socketState` 对应 `WebSocket.CONNECTING(0)`、`OPEN(1)`、`CLOSING(2)`、`CLOSED(3)`。
`ageMs` 是距离该 peer 最后一次 `hello` / `chat` 的毫秒数，超过 12000 应被清理。

需要观察原始帧时：打开 DevTools → Network → WS，刷新页面并连接，点开对应的 WebSocket 请求，在 Messages / Frames 面板中可以看到 `subscribe`、`publish` 以及服务器广播的原始 JSON。

## 已知限制

- **只支持文本聊天**：没有文件、图片、语音传输。
- **一个页面同一时间只在一个房间**：换房间需要先断开再改房间名重连。
- **依赖公共免费实例**：`y-webrtc.fly.dev` 没有 SLA，可能限流、重启或下线；页面提供高级设置可换地址，必要时自行部署。
- **在线人数是近似值**：依赖 4 秒心跳和 12 秒超时；网络抖动时可能短暂误判。
- **没有消息确认与重发**：`send()` 成功只代表浏览器把数据交给了网络栈；服务器异常时消息可能丢失。
- **没有消息 ID / 去重**：只适用于普通聊天；如果需要严格顺序、幂等或历史记录，应在应用层增加消息 ID 与确认机制。
- **时间戳来自发送方本机时钟**：只用于显示，未做时钟同步，不同设备可能有偏差。
- **公共 topic 可能被碰撞**：前缀降低了概率，但仍建议使用带随机后缀的房间名。
- **无内容审核**：同一房间内任何人都能发言，页面不做过滤。

## 浏览器兼容

Chrome / Edge 80+、Firefox 75+、Safari 15+。

依赖：

- 浏览器原生 `WebSocket`；
- `Map`、`URLSearchParams`、`Array.from`；
- `crypto.randomUUID()`（不支持时自动退化）；
- `localStorage`（不可用时自动退化）。

页面可以直接 `file://` 打开，也可以放在任意静态服务器 / GitHub Pages / Nginx 下；不需要构建步骤，不需要 HTTPS（因为默认连接的是 `wss://`），也不依赖任何 npm 包。

