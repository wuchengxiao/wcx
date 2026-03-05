// layout.js - 负责布局和样式变化的逻辑

/**
 * 初始化UI布局相关事件
 */
function initLayoutEvents() {
    // 联网搜索选项切换事件
    const enableWebSearch = _util.id('enableWebSearch');
    const searchEngine = _util.id('searchEngine');
    if (enableWebSearch && searchEngine) {
        searchEngine.style.display = enableWebSearch.checked ? 'block' : 'none';
        enableWebSearch.addEventListener('change', function() {
            searchEngine.style.display = this.checked ? 'block' : 'none';
        });
    }

    // 工具行切换事件（点击+号显示/隐藏配置栏）
    const toggleToolsBtn = _util.id('toggleToolsBtn');
    const toolsRow = _util.id('toolsRow');
    if (toggleToolsBtn && toolsRow) {
        toggleToolsBtn.addEventListener('click', function(e) {
            e.preventDefault();
            const isHidden = toolsRow.style.display === 'none';
            toolsRow.style.display = isHidden ? 'flex' : 'none';
        });
    }

    // 窗口大小改变时重置状态
    window.addEventListener('resize', () => {
        const container = _util.id('app-container');
        if (window.innerWidth > 768) {
            container.classList.remove('chat-active');
        }
    });
}

/**
 * 选择聊天会话（布局切换）
 * @param {HTMLElement} el - 被点击的联系人元素
 */
function selectChat(el) {
    const container = _util.id('app-container');
    // 移动端：添加类名，触发 CSS transform 滑动
    if (window.innerWidth <= 768) {
        container.classList.add('chat-active');
    }
    
    // 桌面端：仅高亮样式
    document.querySelectorAll('.contact-item').forEach(i => i.classList.remove('active'));
    el.classList.add('active');
}