// 获取DOM元素
const editor = utils._id('editor');
const preview = utils._id('preview');
const previewBox = utils._query('.preview-box');


// 实时渲染函数
function renderPreview(editor) {
    const markdownStr = editor.value();
    //const html = marked.parse(markdownStr);
    const html = easyMDE.markdown(markdownStr);
    preview.innerHTML = html;

    //高亮代码
    hljs.highlightAll();
}

// side by side
function sideBySideAction(editor){
    let displayValue = 'display';
    if(utils._style(previewBox, 'display')){
        renderPreview(editor);
        displayValue='';
    }
    utils._style(previewBox, 'display', displayValue);
}

// 添加事件监听
//editor.addEventListener('input', renderPreview);

const easyMDE = new EasyMDE({
    element: utils._id('editor'),
    autoDownloadFontAwesome: false,
    spellChecker: false,
    minHeight: "300px",
    maxHeight: "calc(100vh - 180px)",
    toolbar: [{
        name: 'bold',
        action: EasyMDE.toggleBold,
        className: "fa fa-bold",
        title: "Bold",
    }, {
        name: 'italic',
        action: EasyMDE.toggleItalic,
        className: "fa fa-italic",
        title: "Italic",
    }, {
        name: 'heading',
        action: EasyMDE.toggleHeadingSmaller,
        className: "fa fa-header",
        title: "Heading",
    }, '|', 'quote', 'unordered-list', 'ordered-list', '|', 'link', 'image', '|', {
        name: 'preview',
        className: "fa fa-eye no-disable",
        title: "Toggle Preview",
        action: (editor) => {
           renderPreview(editor);
        }
    }, {
        name:'side-by-side',
        className:'fa fa-columns no-disable no-mobile',
        title:'Toggle Side by Side',
        action: (editor) => {
           sideBySideAction(editor);
        }
    }, {
        name:'fullscreen',
        action: EasyMDE.toggleFullScreen,
        className: "fa fa-arrows-alt no-disable no-mobile",
        title: "Toggle Fullscreen"
    }, '|', 'guide',{
        name:'undo',
        action: EasyMDE.undo,
        className: "fa fa-undo",
        title: "Undo"
    },{
        name:'redo',
        action: EasyMDE.redo,
        className: "fa fa-redo",
        title: "Redo"
    }]
});
easyMDE.value(`# Markdown 示例

## 代码块
\`\`\`javascript
function hello() {
    console.log("Hello, World!");
}
\`\`\`

## 列表
- 项目1
- 项目2
  - 子项目
  - 子项目

## 强调
*斜体* 和 &zwnj;**粗体**&zwnj;

## 引用
> 这是引用内容

## 链接
[GitHub](https://github.com)

## 表格
| 标题1 | 标题2 |
|-------|-------|
| 内容1 | 内容2 |
`);
