// layout.js - 负责布局和样式变化的逻辑

// 动态角色注册与管理
window.roles = [];
window.registerRole = function(roleObj) {
    if (roleObj && roleObj.name) {
        window.roles.push(roleObj);
    }
};
window.currentRole = null;

/**
 * 渲染角色/技能选择按钮区
 */
function renderRoleSelector() {
    // 消息容器
    const msgContainer = _util.id('msg-container');
    if (!msgContainer) return;
    // 检查是否已存在
    if (_util.id('role-selector')) return;
    if (!window.roles || window.roles.length === 0) return; // 无角色时不显示选择区
    // 创建按钮区
    const selector = _util.ce('div');
    selector.id = 'role-selector';
    selector.className = 'role-selector-area';
    // 按钮
    (window.roles || []).forEach((role, idx) => {
        const btn = _util.ce('button');
        btn.textContent = role.name;
        btn.title = role.intro || '';
        btn.className = 'role-selector-btn';
        btn.onclick = function() {
            selectRole(idx);
        };
        selector.appendChild(btn);
    });
    // 插入到msg-container底部
    msgContainer.appendChild(selector);
}

function waitForRolesAndRenderSelector() {
    // 若roles还未加载，延迟重试
    if (!window.roles || window.roles.length === 0) {
        setTimeout(waitForRolesAndRenderSelector, 100);
        return;
    }
    renderRoleSelector();
}

/**
 * 选择角色/技能
 */
function selectRole(idx) {
    let currentRole = window.currentRole = window.roles[idx];
    // 记录角色到localStorage
    localStorage.setItem('chatai_selected_role', String(idx));
    // conversation前插入系统提示词
    if (currentRole && currentRole.systemPrompt) {
        // 避免重复插入
        if (!conversation.length || conversation[0].role !== 'system') {
            conversation.unshift(currentRole.systemPrompt);
        } else {
            conversation[0] = currentRole.systemPrompt;
        }
    }
    // 隐藏选择区
    hideRoleSelector();
    // 修改聊天对象名称
    const chatName = _util.id('chat-name');
    if (chatName) chatName.textContent = currentRole.name;
    // 显示对象介绍消息
    showRoleIntro(currentRole);
}

function showRoleIntro(role) {
    // 先移除旧的介绍消息
    let oldIntro = _util.id('role-intro-msg');
    if (oldIntro) oldIntro.remove();
    // 新建介绍消息
    const msgContainer = _util.id('msg-container');
    if (!msgContainer) return;
    const intro = _util.ce('div');
    intro.id = 'role-intro-msg';
    intro.className = 'role-intro-msg';
    intro.style.textAlign = 'center';
    intro.style.color = '#888';
    intro.style.margin = '12px 0 8px 0';
    intro.textContent = role.intro || `你正在与「${role.name}」对话。`;
    // 始终插入到消息区最顶部
    if (msgContainer.firstChild) {
        msgContainer.insertBefore(intro, msgContainer.firstChild);
    } else {
        msgContainer.appendChild(intro);
    }
    // 展示引导步骤
    let oldGuide = _util.id('role-guide-msg');
    if (oldGuide) oldGuide.remove();
    if (role.guide && Array.isArray(role.guide)) {
        const guide = _util.ce('div');
        guide.id = 'role-guide-msg';
        guide.className = 'role-guide-msg';
        guide.style.textAlign = 'left';
        guide.style.color = '#666';
        guide.style.margin = '0 0 8px 0';
        guide.style.fontSize = '13px';
        guide.innerHTML = '<b>使用引导：</b><ul style="margin:4px 0 0 18px;padding:0;">' +
            role.guide.map(item => `<li>${item}</li>`).join('') + '</ul>';
        // 插在intro下方
        if (intro.nextSibling) {
            msgContainer.insertBefore(guide, intro.nextSibling);
        } else {
            msgContainer.appendChild(guide);
        }
    }
}

// 隐藏角色选择区
function hideRoleSelector() {
    const selector = _util.id('role-selector');
    if (selector) selector.style.display = 'none';
}

// 监听用户发消息后自动隐藏角色选择区
function setupRoleSelectorAutoHide() {
    // 监听发送按钮
    const sendBtn = _util.id('send-btn');
    if (sendBtn) {
        sendBtn.addEventListener('click', hideRoleSelector, true);
    }
    // 监听输入框回车
    const input = _util.id('msg-input');
    if (input) {
        input.addEventListener('keydown', function(event) {
            if (event.key === 'Enter' && !event.shiftKey) {
                hideRoleSelector();
            }
        }, true);
    }
}

// 聊天窗右上角增加角色切换按钮
function addRoleSwitchButton() {
  const btnRow = _util.id('btnRow');
  if (!btnRow) return;
  if(_util.id('changeRole')) return;
  // <button id="changeRole" class="icon-btn change-role-btn" title="切换角色">切换角色</button>
  const btn = _util.ce('button');
  btn.id = 'changeRole';
  btn.className = 'icon-btn change-role-btn';
  btn.title = '切换角色';
  btn.textContent = '切换角色';
  btn.onclick = function() {
      const selector = _util.id('role-selector');
      if (selector) {
          selector.style.display = (selector.style.display === 'none' || selector.style.display === '') ? 'flex' : 'none';
      } else {
          renderRoleSelector();
      }
      if (currentRole) {
          showRoleIntro(currentRole);
      }
  };
  _util.ac(btnRow, btn);
}

// 清除历史记录后重置角色选择状态
function addClearHistoryButton() {
    // <button id="clearHistoryBtn" class="icon-btn clear-history-btn" title="清除历史">清除历史</button>
    const btnRow = _util.id('btnRow');
    if (!btnRow) return;
    if(_util.id('clearHistoryBtn')) return;
    const btn = _util.ce('button');
    btn.id = 'clearHistoryBtn';
    btn.className = 'icon-btn clear-history-btn';
    btn.title = '清除历史';
    btn.textContent = '清除历史';
    btn.onclick = function() {
      localStorage.removeItem('chatHistory');
      localStorage.removeItem('chatai_conversation');
      localStorage.removeItem('chatai_selected_role');
      localStorage.removeItem('lastRole');
      currentRole = null;
      const selector = _util.id('role-selector');
      if (selector) selector.remove();
      const chatName = _util.id('chat-name');
      if (chatName) chatName.textContent = '新对话';
      location.reload();
    }
    _util.ac(btnRow, btn);
}

// 聊天UI初始化，若为新对话则显示角色选择区
function initChatUI() {
    if (window.hasInitChat) {
        return;
    }
    window.hasInitChat = true;

    // 恢复上次选择的角色
    let savedIdx = localStorage.getItem('chatai_selected_role');
    if (savedIdx && window.roles[savedIdx]) {
        selectRole(Number(savedIdx));
        // 显示角色介绍（防止selectRole被隐藏选择区时未显示）
        showRoleIntro(window.roles[savedIdx]);
    } else {
        // 新对话时显示角色/技能选择区（确保角色已加载）
        waitForRolesAndRenderSelector();
    }
    // 新UI中的发送按钮和输入框
    const sendBtn = _util.id('send-btn');
    const input = _util.id('msg-input');
    if (sendBtn) {
        sendBtn.addEventListener('click', window.sendMessage);
    }
    if (input) {
        input.addEventListener('keydown', function(event) {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                window.sendMessage();
            }
        });
    }
    setupRoleSelectorAutoHide();
    addRoleSwitchButton();
    addClearHistoryButton();
    // 点击消息区域外时，收起所有已展开的消息按钮
    _util.on(document, 'click', function (event) {
        if (!event.target.closest('.message')) {
            _util.qa('.message.show-actions').forEach(function (el) {
                el.classList.remove('show-actions');
            });
        }
    });
    // 初始化布局相关事件
    if (typeof initLayoutEvents === 'function') {
        initLayoutEvents();
    }
    // 优先从localStorage还原对话
    if (typeof loadConversationFromStorage === 'function') {
        loadConversationFromStorage();
    }
    // 渲染历史消息
    if (conversation && conversation.length) {
        conversation.forEach(function(msg) {
            if (window.appendMessage) window.appendMessage(msg.role, msg.content);
        });
    }
}
window.initChatUI = initChatUI;

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
    _util.qa('.contact-item').forEach(i => i.classList.remove('active'));
    el.classList.add('active');
}