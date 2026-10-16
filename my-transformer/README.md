# Token Lab 模拟推理演示

纯前端教学演示：本地 Markdown 语料统计、共现 Embedding、简化 QKV Self-Attention 和 N-gram 逐 token 生成。不会连接真实模型或上传语料。

## 本地运行

由于应用使用 JavaScript ES Modules 和 IndexedDB，请通过本地 HTTP 服务打开，不要直接双击 `index.html`。

在 PowerShell 中进入项目目录并运行：

```powershell
npm start
```

然后打开 <http://127.0.0.1:8000>。停止服务时在终端按 `Ctrl+C`。无需安装 npm 依赖；项目自带的 Node.js 服务只监听本机回环地址。

所有语料、统计结果、提示词和会话均保存在当前浏览器的本地存储中。清除浏览器站点数据会删除这些内容。

