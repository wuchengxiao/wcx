// =============================================
    // 3. 默认模板
    // =============================================
    const MERMAID_TEMPLATES = [{
        key:'activeButton',
        label:'可交互按钮',
        code:`flowchart LR
    A[点击这里跳转] --> B[执行操作]
    
    %% 点击节点 A 会打开百度
    click A href "https://www.baidu.com" "点击跳转到百度"`
    },{
        key: 'user_login_form',
        label:'用户登录表单',
        code:`flowchart TD
    subgraph Body[ ]
    direction TD
    %% 定义表单标题
    Title["📋 用户登录表单"]
    
    %% 模拟输入框（使用平行四边形或矩形）
    InputUser["👤 请输入用户名: ____________"]
    InputPass["🔒 请输入密码: ____________"]
     
    %% 模拟按钮（使用圆角矩形，并自定义颜色使其看起来像按钮）
    BtnLogin(["🚀 登 录"])
    BtnReset(["🔄 重 置"])

    %% 节点之间的连线（模拟表单布局）
    Title --> InputUser --> InputPass
    InputPass --> BtnLogin
    InputPass --> BtnReset

    end
    %% 自定义样式，使其更像 UI 界面
    style Body fill:#fff
    style Title fill:#f9f9f9,stroke:#333,stroke-width:2px,font-size:20px,font-weight:bold
    style InputUser fill:#fff,stroke:#ccc,stroke-width:1px,font-size:16px
    style InputPass fill:#fff,stroke:#ccc,stroke-width:1px,font-size:16px
    style BtnLogin fill:#4CAF50,stroke:#4CAF50,color:#fff,font-size:16px,font-weight:bold
    style BtnReset fill:#e7e7e7,stroke:#ccc,color:#333,font-size:16px,font-weight:bold`
    },
        {
            key: 'flowchart',
            label: '流程图',
            code: `flowchart TD
    A[开始] --> B{是否通过?}
    B -- 是 --> C[执行成功]
    B -- 否 --> D[返回错误]
    C --> E[结束]
    D --> E`
        },
        {
            key: 'sequence',
            label: '时序图',
            code: `sequenceDiagram
    participant U as 用户
    participant W as Web
    participant S as 服务
    U->>W: 提交请求
    W->>S: 调用接口
    S-->>W: 返回结果
    W-->>U: 展示响应`
        },
        {
            key: 'class',
            label: '类图',
            code: `classDiagram
    class User {
      +String id
      +String name
      +login()
    }
    class Order {
      +String orderId
      +create()
    }
    User "1" --> "*" Order : places`
        },
        {
            key: 'state',
            label: '状态图',
            code: `stateDiagram-v2
    [*] --> 待处理
    待处理 --> 审核中: 提交
    审核中 --> 已通过: 同意
    审核中 --> 已驳回: 拒绝
    已通过 --> [*]
    已驳回 --> [*]`
        },
        {
            key: 'er',
            label: 'ER图',
            code: `erDiagram
    USER ||--o{ ORDER : places
    ORDER ||--|{ ORDER_ITEM : contains
    PRODUCT ||--o{ ORDER_ITEM : referenced
    USER {
      string id
      string name
    }
    ORDER {
      string id
      date created_at
    }`
        },
        {
            key: 'xy',
            label: 'XY图',
            code: `xychart-beta
    title "月度访问量"
    x-axis [Jan, Feb, Mar, Apr, May, Jun]
    y-axis "PV" 0 --> 1000
    bar [120, 260, 380, 520, 760, 880]
    line [100, 240, 360, 500, 700, 920]`
        },
        {
            key: 'journey',
            label: '旅程图',
            code: `journey
    title 用户下单旅程
    section 访问阶段
      打开首页: 5: 用户
      浏览商品: 4: 用户
    section 下单阶段
      加入购物车: 4: 用户
      提交订单: 3: 用户
      完成支付: 5: 用户`
        },
        {
            key: 'pie',
            label: '饼图',
            code: `pie showData
    title 流量来源占比
    "直接访问" : 42
    "搜索引擎" : 28
    "社交媒体" : 18
    "其他" : 12`
        },
        {
            key: 'mindmap',
            label: '思维导图',
            code: `mindmap
  root((项目规划))
    需求
      用户故事
      验收标准
    设计
      架构
      UI
    开发
      前端
      后端
    测试
      单元测试
      集成测试`
        },
        {
            key: 'git',
            label: 'Git图',
            code: `gitGraph
    commit id: "init"
    branch feature/login
    checkout feature/login
    commit id: "login page"
    commit id: "auth api"
    checkout main
    merge feature/login
    commit id: "release v1.0"`
        },
        {
            key: 'kanban',
            label: '看板图',
            code: `kanban
    title 开发看板
    section 待办
      需求评审
      数据库设计
    section 进行中
      接口开发
      页面联调
    section 已完成
      项目初始化`
        },
        {
            key: 'architecture',
            label: '架构图',
            code: `architecture-beta
    group client(cloud)[客户端]
    group app(server)[应用层]
    group data(database)[数据层]

    service web(internet)[Web]
    service api(server)[API]
    service db(database)[MySQL]
    service cache(database)[Redis]

    web:R -- L:api
    api:B -- T:db
    api:R -- L:cache`
        },
        {
            key: 'packet',
            label: '数据包图',
            code: `packet-beta
    0-15: "Source Port"
    16-31: "Destination Port"
    32-63: "Sequence Number"
    64-95: "Acknowledgment Number"
    96-99: "Header Length"
    100-105: "Flags"
    106-127: "Window Size"
    128-143: "Checksum"
    144-159: "Urgent Pointer"`
        }
    ];