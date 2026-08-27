// =============================================
// 6. 代码提示（Mermaid 关键字）
// =============================================
const MERMAID_KEYWORDS = [// 图表类型
{
    word: 'graph',
    type: '图表类型',
    desc: '流程图'
}, {
    word: 'flowchart',
    type: '图表类型',
    desc: '流程图'
}, {
    word: 'sequenceDiagram',
    type: '图表类型',
    desc: '时序图'
}, {
    word: 'classDiagram',
    type: '图表类型',
    desc: '类图'
}, {
    word: 'stateDiagram-v2',
    type: '图表类型',
    desc: '状态图'
}, {
    word: 'erDiagram',
    type: '图表类型',
    desc: 'ER图'
}, {
    word: 'gantt',
    type: '图表类型',
    desc: '甘特图'
}, {
    word: 'pie',
    type: '图表类型',
    desc: '饼图'
}, {
    word: 'mindmap',
    type: '图表类型',
    desc: '思维导图'
}, {
    word: 'timeline',
    type: '图表类型',
    desc: '时间线图'
}, // 关键字
{
    word: 'subgraph',
    type: '关键字',
    desc: '子图开始'
}, {
    word: 'end',
    type: '关键字',
    desc: '结束'
}, {
    word: 'direction',
    type: '关键字',
    desc: '方向'
}, // 方向
{
    word: 'TB',
    type: '方向',
    desc: '从上到下'
}, {
    word: 'BT',
    type: '方向',
    desc: '从下到上'
}, {
    word: 'RL',
    type: '方向',
    desc: '从右到左'
}, {
    word: 'LR',
    type: '方向',
    desc: '从左到右'
}, {
    word: 'TD',
    type: '方向',
    desc: '从上到下'
}, // 节点形状
{
    word: 'A[文本]',
    type: '节点',
    desc: '矩形节点'
}, {
    word: 'A(文本)',
    type: '节点',
    desc: '圆角矩形'
}, {
    word: 'A((文本))',
    type: '节点',
    desc: '圆形节点'
}, {
    word: 'A{文本}',
    type: '节点',
    desc: '菱形节点'
}, {
    word: 'A>文本]',
    type: '节点',
    desc: '不对称形状'
}, // 连接线
{
    word: '-->',
    type: '连接线',
    desc: '箭头'
}, {
    word: '---',
    type: '连接线',
    desc: '实线'
}, {
    word: '-.-',
    type: '连接线',
    desc: '虚线'
}, {
    word: '==>',
    type: '连接线',
    desc: '粗箭头'
}, {
    word: '-.->',
    type: '连接线',
    desc: '虚线箭头'
}, // 时序图关键字
{
    word: 'participant',
    type: '时序图',
    desc: '参与者'
}, {
    word: 'actor',
    type: '时序图',
    desc: '角色'
}, {
    word: 'Note',
    type: '时序图',
    desc: '备注'
}, {
    word: 'loop',
    type: '时序图',
    desc: '循环'
}, {
    word: 'alt',
    type: '时序图',
    desc: '分支'
}, {
    word: 'opt',
    type: '时序图',
    desc: '可选'
}, {
    word: 'rect',
    type: '时序图',
    desc: '矩形'
}, // 甘特图
{
    word: 'title',
    type: '甘特图',
    desc: '标题'
}, {
    word: 'dateFormat',
    type: '甘特图',
    desc: '日期格式'
}, {
    word: 'section',
    type: '甘特图',
    desc: '分组'
}, // 其他
{
    word: '%%',
    type: '注释',
    desc: '注释'
}, {
    word: 'style',
    type: '样式',
    desc: '自定义样式'
}, {
    word: 'link',
    type: '链接',
    desc: '添加链接'
}, {
    word: 'click',
    type: '交互',
    desc: '点击事件'
}, // 样式与 UI 定制相关
{
    word: 'classDef',
    type: '样式',
    desc: '定义可复用的样式类'
}, {
    word: 'class',
    type: '样式',
    desc: '将样式类应用到节点'
}, {
    word: 'linkStyle',
    type: '样式',
    desc: '定义连接线的样式'
}, {
    word: '%%{init:',
    type: '配置',
    desc: '全局初始化配置指令'
}, {
    word: 'theme:',
    type: '配置',
    desc: '设置图表主题(如dark,base)'
}, {
    word: 'themeVariables:',
    type: '配置',
    desc: '自定义主题变量'
}, // 常用 CSS 样式属性
{
    word: 'fill:',
    type: '属性',
    desc: '节点背景填充色'
}, {
    word: 'stroke:',
    type: '属性',
    desc: '节点边框颜色'
}, {
    word: 'stroke-width:',
    type: '属性',
    desc: '边框粗细(如:2px)'
}, {
    word: 'stroke-dasharray:',
    type: '属性',
    desc: '边框虚线样式(如:5 5)'
}, {
    word: 'color:',
    type: '属性',
    desc: '节点文字颜色'
}, {
    word: 'font-size:',
    type: '属性',
    desc: '字体大小'
}, {
    word: 'font-weight:',
    type: '属性',
    desc: '字体粗细(如:bold)'
}, {
    word: 'font-style:',
    type: '属性',
    desc: '字体样式(如:italic)'
}, {
    word: 'text-align:',
    type: '属性',
    desc: '文本对齐方式'
}, // 节点内联样式简写
{
    word: ':::',
    type: '语法',
    desc: '节点内联应用样式类(如 A:::myClass)'
}];
