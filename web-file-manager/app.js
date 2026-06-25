/**
 * app.js
 * 页面交互模块 - 负责 UI 渲染、事件绑定和数据联锁
 * 严格调用 FileService 提供的数据函数，实现展示与底层逻辑彻底解耦。
 */

document.addEventListener('DOMContentLoaded', () => {
    // 基础状态管理记录
    let activeFileId = null;       // 当前在右栏查看/编辑的文件 ID
    let isEditing = false;         // 右栏当前是否处于可编辑模式
    let selectedIds = new Set();    // 保存复选框选中的文件 ID 集合
    let isLineFilterActive = false;// 查看模式下是否激活了行段筛选模式
    let cmInstance = null;         // CodeMirror 语法高亮编辑器实例
    let autoSaveEnabled = false;   // 当前编辑会话的自动保存状态
    let autoSaveTimer = null;      // 自动保存定时器
    let lastSavedContent = '';     // 最近一次保存成功后的内容快照
    let hasUnsavedChanges = false; // 当前是否存在未保存修改

    // DOM 节点引用声明
    const newFilenameInput = document.getElementById('new-filename');
    const newFileContentInput = document.getElementById('new-filecontent');
    const newFileContentContainer = document.getElementById('new-filecontent-container');
    const btnToggleNewExpand = document.getElementById('btn-toggle-new-expand');
    const btnCreateFile = document.getElementById('btn-create-file');
    const dropZone = document.getElementById('drop-zone');

    const searchKeyword = document.getElementById('search-keyword');
    const btnSearch = document.getElementById('btn-search');
    const btnResetSearch = document.getElementById('btn-reset-search');

    const selectedCountLabel = document.getElementById('selected-count');
    const btnBulkDownload = document.getElementById('btn-bulk-download');
    const btnBulkDelete = document.getElementById('btn-bulk-delete');

    const totalFilesCount = document.getElementById('total-files-count');
    const checkboxSelectAll = document.getElementById('checkbox-select-all');
    const filesListBody = document.getElementById('files-list-body');

    const editorPlaceholder = document.getElementById('editor-placeholder');
    const editorWorkspace = document.getElementById('editor-workspace');
    const activeFileStatus = document.getElementById('active-file-status');
    const activeFilename = document.getElementById('active-filename');
    const activeFileExt = document.getElementById('active-file-ext');
    const activeFileCreated = document.getElementById('active-file-created');
    const activeFileUpdated = document.getElementById('active-file-updated');

    const lineFilterControl = document.getElementById('line-filter-control');
    const inputLineStart = document.getElementById('line-start');
    const inputLineEnd = document.getElementById('line-end');
    const btnGetLines = document.getElementById('btn-get-lines');
    const btnRestoreFull = document.getElementById('btn-restore-full');
    const lineFilterMsg = document.getElementById('line-filter-msg');

    const activeEditorTextarea = document.getElementById('active-editor-textarea');
    const activeEditorContainer = document.getElementById('active-editor-container');
    const btnToggleActiveExpand = document.getElementById('btn-toggle-active-expand');
    const btnTogglePowerTools = document.getElementById('btn-toggle-power-tools');
    const powerToolsPanel = document.getElementById('power-tools-panel');
    const maximizedEditToolbar = document.getElementById('maximized-edit-toolbar');
    const autoSaveToggle = document.getElementById('autosave-toggle');
    const btnToolbarSave = document.getElementById('btn-toolbar-save');
    const saveStatusIndicator = document.getElementById('save-status-indicator');

    const ptLanguageSelect = document.getElementById('pt-language-select');

    const ptMultiPrefix = document.getElementById('pt-multi-prefix');
    const ptMultiSuffix = document.getElementById('pt-multi-suffix');
    const btnApplyPrefixSuffix = document.getElementById('btn-apply-prefix-suffix');

    const ptNumStart = document.getElementById('pt-num-start');
    const ptNumStep = document.getElementById('pt-num-step');
    const ptNumFormat = document.getElementById('pt-num-format');
    const btnApplyNumbering = document.getElementById('btn-apply-numbering');

    const ptFindStr = document.getElementById('pt-find-str');
    const ptReplaceStr = document.getElementById('pt-replace-str');
    const btnReplaceAll = document.getElementById('btn-replace-all');
    const ptCaseSensitive = document.getElementById('pt-case-sensitive');
    const ptRegex = document.getElementById('pt-regex');

    const viewModeActions = document.getElementById('view-mode-actions');
    const editModeActions = document.getElementById('edit-mode-actions');

    const btnEditMode = document.getElementById('btn-edit-mode');
    const btnDownloadActive = document.getElementById('btn-download-active');
    const btnSaveContent = document.getElementById('btn-save-content');
    const btnCancelEdit = document.getElementById('btn-cancel-edit');

    /**
     * 1. 核心渲染与状态同步函数 & CodeMirror 懒加载初始化
     * ========================================== */

    function initCodeMirrorIfNeeded() {
        if (!cmInstance && window.CodeMirror) {
            cmInstance = window.CodeMirror.fromTextArea(activeEditorTextarea, {
                lineNumbers: true,               // 显示行号
                mode: 'text/plain',              // 默认文本模式
                theme: 'default',                // 主题样式
                lineWrapping: true,              // 自动折行
                viewportMargin: Infinity,        // 合理视距
                readOnly: true                   // 默认只读
            });

            // 当 CodeMirror 内容改变时，需要把内容反馈同步回隐藏 textarea
            cmInstance.on('change', () => {
                activeEditorTextarea.value = cmInstance.getValue();
                syncUnsavedChangesState();
            });
        }
    }

    function getCurrentEditorValue() {
        return cmInstance ? cmInstance.getValue() : activeEditorTextarea.value;
    }

    function setSaveStatus(message, statusType = 'idle') {
        if (!saveStatusIndicator) return;
        saveStatusIndicator.textContent = message;
        saveStatusIndicator.className = `save-status-indicator status-${statusType}`;
    }

    function clearAutoSaveTimer() {
        if (autoSaveTimer) {
            window.clearInterval(autoSaveTimer);
            autoSaveTimer = null;
        }
    }

    function updateMaximizedEditToolbar() {
        const shouldShow = isEditing && activeEditorContainer.classList.contains('maximized-editor-container');
        maximizedEditToolbar.classList.toggle('d-none', !shouldShow);
    }

    function syncUnsavedChangesState() {
        if (!isEditing || !activeFileId) {
            hasUnsavedChanges = false;
            return;
        }

        hasUnsavedChanges = getCurrentEditorValue() !== lastSavedContent;

        if (!activeEditorContainer.classList.contains('maximized-editor-container')) {
            return;
        }

        if (hasUnsavedChanges) {
            setSaveStatus(autoSaveEnabled ? '存在未保存修改（自动保存已开启）' : '存在未保存修改', 'warning');
        } else if (autoSaveEnabled) {
            setSaveStatus('自动保存已开启，等待下一次同步', 'info');
        } else {
            setSaveStatus('内容已与文件同步', 'idle');
        }
    }

    function setAutoSaveEnabled(enabled) {
        autoSaveEnabled = Boolean(enabled);
        autoSaveToggle.checked = autoSaveEnabled;
        clearAutoSaveTimer();

        if (autoSaveEnabled && isEditing && activeFileId) {
            autoSaveTimer = window.setInterval(() => {
                saveActiveFile({ source: 'auto', showToast: false, stayInEditMode: true, skipIfUnchanged: true });
            }, 5 * 60 * 1000);

            setSaveStatus(hasUnsavedChanges ? '自动保存已开启，将每 5 分钟保存一次' : '自动保存已开启，等待下一次同步', 'info');
        } else if (isEditing) {
            setSaveStatus(hasUnsavedChanges ? '自动保存已关闭，存在未保存修改' : '自动保存已关闭', hasUnsavedChanges ? 'warning' : 'idle');
        }
    }

    function resetEditSessionState() {
        clearAutoSaveTimer();
        autoSaveEnabled = false;
        autoSaveToggle.checked = false;
        lastSavedContent = '';
        hasUnsavedChanges = false;
        setSaveStatus('尚未保存', 'idle');
        updateMaximizedEditToolbar();
    }

    function saveActiveFile(options = {}) {
        const {
            source = 'manual',
            showToast = true,
            stayInEditMode = false,
            skipIfUnchanged = false
        } = options;

        if (!activeFileId) {
            return { success: false, skipped: true, message: '当前没有可保存的活跃文件。' };
        }

        const textValue = getCurrentEditorValue();
        const changed = textValue !== lastSavedContent;

        if (skipIfUnchanged && !changed) {
            const idleMessage = source === 'auto'
                ? `自动保存检查完成（${formatTimeDetail(new Date().toISOString())}），当前无新增修改。`
                : '当前没有新的修改需要保存。';
            setSaveStatus(idleMessage, 'idle');
            return { success: true, skipped: true, message: idleMessage };
        }

        const res = window.FileService.updateFile(activeFileId, textValue);
        const latestFile = res.file || window.FileService.getFileById(activeFileId);

        if (res.success) {
            lastSavedContent = textValue;
            hasUnsavedChanges = false;

            if (latestFile) {
                activeFileUpdated.textContent = formatTimeDetail(latestFile.updatedAt);
            }

            const saveTime = latestFile ? formatTimeDetail(latestFile.updatedAt) : formatTimeDetail(new Date().toISOString());
            setSaveStatus(source === 'auto' ? `已自动保存 · ${saveTime}` : `已手动保存 · ${saveTime}`, 'success');

            if (showToast) {
                alertFeedback(true, source === 'auto' ? `自动保存成功：${res.message}` : res.message);
            }

            refreshAll();

            if (!stayInEditMode) {
                viewFile(activeFileId);
            }
        } else {
            setSaveStatus(source === 'auto' ? `自动保存失败：${res.message}` : `保存失败：${res.message}`, 'danger');
            if (showToast) {
                alertFeedback(false, res.message);
            }
        }

        return res;
    }

    /**
     * 根据文件名后缀智能识别高亮 mode
     */
    function autoDetectLanguageByExt(ext) {
        switch (ext) {
            case 'js': return 'javascript';
            case 'css': return 'css';
            case 'md': return 'markdown';
            case 'html': return 'htmlmixed';
            case 'json': return 'javascript'; // json 能够复用 javascript mode
            default: return 'text/plain';
        }
    }

    /**
     * 渲染文件列表表格
     * @param {Array} filesList 
     */
    function renderFileList(filesList = null) {
        // 如果没有传入，默认拉取全部文件
        const files = filesList || window.FileService.getAllFiles();
        
        // 更新文件总数显示
        totalFilesCount.textContent = window.FileService.getAllFiles().length;

        // 清空列表
        filesListBody.innerHTML = '';

        if (files.length === 0) {
            filesListBody.innerHTML = `
                <tr>
                    <td colspan="5" class="empty-placeholder">
                        ${searchKeyword.value.trim() ? '🔍 未找到与关键字匹配的临时文件。' : '📭 目前没有任何临时文件，请在上方输入或拖入文件创建。'}
                    </td>
                </tr>
            `;
            checkboxSelectAll.checked = false;
            updateBulkActionsState();
            return;
        }

        // 渲染列表项
        files.forEach(file => {
            const tr = document.createElement('tr');
            if (activeFileId === file.id) {
                tr.classList.add('active-row');
            }

            const trChecked = selectedIds.has(file.id);
            const formattedTime = formatTime(file.createdAt);

            tr.innerHTML = `
                <td class="txt-center">
                    <input type="checkbox" class="file-item-checkbox" data-id="${file.id}" ${trChecked ? 'checked' : ''} />
                </td>
                <td class="file-name-cell" title="${file.name}">
                    <span class="file-icon">${getFileEmoji(file.extension)}</span>
                    <span class="file-name-text">${escapeHtml(file.name)}</span>
                </td>
                <td><span class="badge badge-ext">${file.extension}</span></td>
                <td class="time-col" title="${file.createdAt}">${formattedTime}</td>
                <td class="action-cell txt-center">
                    <button class="btn-action btn-view" title="在线查看" data-id="${file.id}">👁️ 查看</button>
                    <button class="btn-action btn-edit" title="在线编辑" data-id="${file.id}">📝 编辑</button>
                    <button class="btn-action btn-download" title="下载至本地" data-id="${file.id}">📥 下载</button>
                    <button class="btn-action btn-delete" title="删除文件" data-id="${file.id}">🗑️ 删除</button>
                </td>
            `;

            // 监听这一行复选框的点击
            const checkbox = tr.querySelector('.file-item-checkbox');
            checkbox.addEventListener('change', (e) => {
                const id = checkbox.getAttribute('data-id');
                if (checkbox.checked) {
                    selectedIds.add(id);
                } else {
                    selectedIds.delete(id);
                }
                updateBulkActionsState();
                syncSelectAllState(files);
            });

            // 快捷点击行展示文件
            tr.querySelector('.file-name-cell').addEventListener('click', () => {
                viewFile(file.id);
            });

            // 各种功能按键事件绑定
            tr.querySelector('.btn-view').addEventListener('click', () => viewFile(file.id));
            tr.querySelector('.btn-edit').addEventListener('click', () => editFile(file.id));
            tr.querySelector('.btn-download').addEventListener('click', () => {
                const res = window.FileService.downloadFile(file.id);
                alertFeedback(res.success, res.message);
            });
            tr.querySelector('.btn-delete').addEventListener('click', () => {
                if (confirm(`确定要彻底删除临时文件 "${file.name}" 吗？`)) {
                    const res = window.FileService.deleteFile(file.id);
                    alertFeedback(res.success, res.message);
                    if (activeFileId === file.id) {
                        closeWorkspace();
                    }
                    selectedIds.delete(file.id);
                    refreshAll();
                }
            });

            filesListBody.appendChild(tr);
        });

        syncSelectAllState(files);
        updateBulkActionsState();
    }

    /**
     * 同步修改全选框的勾选状态
     */
    function syncSelectAllState(currentRenderedFiles) {
        if (currentRenderedFiles.length === 0) {
            checkboxSelectAll.checked = false;
            return;
        }
        const allRenderedSelected = currentRenderedFiles.every(f => selectedIds.has(f.id));
        checkboxSelectAll.checked = allRenderedSelected;
    }

    /**
     * 更新顶部批量操作按钮的可点状态
     */
    function updateBulkActionsState() {
        const count = selectedIds.size;
        selectedCountLabel.textContent = count;

        if (count > 0) {
            btnBulkDownload.disabled = false;
            btnBulkDelete.disabled = false;
        } else {
            btnBulkDownload.disabled = true;
            btnBulkDelete.disabled = true;
        }
    }

    /**
     * 关闭右侧在线编辑器面板，恢复默认空白占位
     */
    function closeWorkspace() {
        activeFileId = null;
        isEditing = false;
        isLineFilterActive = false;
        resetEditSessionState();
        editorWorkspace.classList.add('d-none');
        editorPlaceholder.classList.remove('d-none');
        
        activeFileStatus.className = 'file-status-label status-idle';
        activeFileStatus.textContent = '当前无活跃文件';
        
        inputLineStart.value = '';
        inputLineEnd.value = '';
        lineFilterMsg.textContent = '';

        // 还原可能存在的放大编辑状态
        activeEditorContainer.classList.remove('maximized-editor-container');
        btnToggleActiveExpand.textContent = '🔍 放大编辑';
        btnToggleActiveExpand.classList.add('btn-outline');
        btnToggleActiveExpand.classList.remove('btn-primary');

        // 还原高级工具面板
        powerToolsPanel.classList.add('d-none');
        btnTogglePowerTools.classList.remove('btn-primary');
        btnTogglePowerTools.classList.add('btn-outline');
    }

    /**
     * 进入查看模式
     * @param {string} id 
     * @param {number} startLine 
     * @param {number} endLine 
     */
    function viewFile(id, startLine = null, endLine = null) {
        initCodeMirrorIfNeeded();

        const file = window.FileService.getFileById(id);
        if (!file) {
            alertFeedback(false, '加载文件失败，该文件不存在。');
            closeWorkspace();
            return;
        }

        activeFileId = id;
        isEditing = false;
        clearAutoSaveTimer();
        autoSaveEnabled = false;
        autoSaveToggle.checked = false;
        hasUnsavedChanges = false;

        // UI 切换
        editorPlaceholder.classList.add('d-none');
        editorWorkspace.classList.remove('d-none');

        // 更新状态标签
        activeFileStatus.className = 'file-status-label status-view';
        activeFileStatus.textContent = '🔍 在线查看 (只读)';

        // 按钮容器切换
        viewModeActions.classList.remove('d-none');
        editModeActions.classList.add('d-none');

        // 文件基本属性显示
        activeFilename.textContent = file.name;
        activeFileExt.textContent = file.extension;
        activeFileCreated.textContent = formatTimeDetail(file.createdAt);
        activeFileUpdated.textContent = formatTimeDetail(file.updatedAt);

        // 显示并控制特定行加载项
        lineFilterControl.style.opacity = '1';
        lineFilterControl.style.pointerEvents = 'auto';

        // 文本域只读
        activeEditorTextarea.readOnly = true;
        activeEditorTextarea.style.backgroundColor = '#f8fafd';

        // 智能设置下拉框高亮语言 mode 并且触发
        const detectedMode = autoDetectLanguageByExt(file.extension);
        ptLanguageSelect.value = detectedMode === 'htmlmixed' ? 'htmlmixed' : (detectedMode === 'markdown' ? 'markdown' : detectedMode);

        let finalShowContent = '';

        // 核心：若设置了行号，检索其行段
        if (startLine !== null || endLine !== null) {
            const start = parseInt(startLine, 10);
            const end = parseInt(endLine, 10);
            const res = window.FileService.getFileLines(id, start, end);
            
            if (res.success) {
                finalShowContent = res.linesContent;
                isLineFilterActive = true;
                lineFilterMsg.innerHTML = `<span class="badge-line-success">过滤成功</span> 已过滤呈现原文件的第 <b>${res.range.start}</b> 至 <b>${res.range.end}</b> 行内容（原文件总计: ${res.totalLines} 行）。`;
                inputLineStart.value = res.range.start;
                inputLineEnd.value = res.range.end;
            } else {
                finalShowContent = file.content;
                lineFilterMsg.innerHTML = `<span class="badge-line-fail">截取异常</span> ${res.message}，已恢复全文呈现。`;
            }
        } else {
            // 装载全文
            finalShowContent = file.content;
            isLineFilterActive = false;
            lineFilterMsg.textContent = '当前正在查看全部内容。可通过输入上方行数来截取展示。';
            // 显示原文件共有几行
            const totalLinesCount = file.content.split(/\r?\n/).length;
            lineFilterMsg.textContent += ` (共计 ${totalLinesCount} 行)`;
        }

        // 把渲染代理给 CodeMirror
        if (cmInstance) {
            cmInstance.setValue(finalShowContent);
            cmInstance.setOption('mode', detectedMode);
            cmInstance.setOption('readOnly', true);
            // 刷新高亮排版渲染
            setTimeout(() => cmInstance.refresh(), 1);
        } else {
            activeEditorTextarea.value = finalShowContent;
        }

        setSaveStatus('查看模式下不可保存', 'idle');
        updateMaximizedEditToolbar();

        // 高亮选中左侧的该文件那一行
        updateRowHighlight();
    }

    /**
     * 进入编辑模式
     * @param {string} id 
     */
    function editFile(id) {
        initCodeMirrorIfNeeded();

        const file = window.FileService.getFileById(id);
        if (!file) {
            alertFeedback(false, '加载文件错误。');
            return;
        }

        // 编辑时先退出行过滤段落查看。加载全部内容。
        activeFileId = id;
        isEditing = true;
        lastSavedContent = file.content;
        hasUnsavedChanges = false;

        // UI 切换
        editorPlaceholder.classList.add('d-none');
        editorWorkspace.classList.remove('d-none');

        // 修改状态标签
        activeFileStatus.className = 'file-status-label status-edit';
        activeFileStatus.textContent = '✍️ 正在编辑文件...';

        // 切换控制按钮
        viewModeActions.classList.add('d-none');
        editModeActions.classList.remove('d-none');

        // 文件基本属性显示
        activeFilename.textContent = file.name;
        activeFileExt.textContent = file.extension;
        activeFileCreated.textContent = formatTimeDetail(file.createdAt);
        activeFileUpdated.textContent = formatTimeDetail(file.updatedAt);

        // 智能自动高亮
        const detectedMode = autoDetectLanguageByExt(file.extension);
        ptLanguageSelect.value = detectedMode;

        // 阻止行过滤功能（编辑下必须编辑全文）
        lineFilterControl.style.opacity = '0.4';
        lineFilterControl.style.pointerEvents = 'none';
        lineFilterMsg.textContent = '提示：在线编辑模式下不支持分行截断，必须更新完整文卷。';

        // 文本域可写真实获焦
        activeEditorTextarea.readOnly = false;
        activeEditorTextarea.style.backgroundColor = '#ffffff';

        if (cmInstance) {
            cmInstance.setValue(file.content);
            cmInstance.setOption('mode', detectedMode);
            cmInstance.setOption('readOnly', false);
            setTimeout(() => {
                cmInstance.refresh();
                cmInstance.focus();
            }, 1);
        } else {
            activeEditorTextarea.value = file.content;
            activeEditorTextarea.focus();
        }

        setSaveStatus('可开始编辑；放大后可使用自动保存', 'idle');
        updateMaximizedEditToolbar();

        // 高亮行
        updateRowHighlight();
    }

    /**
     * 根据 activeFileId 更新左侧对应的选中高亮高亮行
     */
    function updateRowHighlight() {
        const rows = filesListBody.querySelectorAll('tr');
        rows.forEach(row => {
            const checkbox = row.querySelector('.file-item-checkbox');
            if (checkbox) {
                const id = checkbox.getAttribute('data-id');
                if (id === activeFileId) {
                    row.classList.add('active-row');
                } else {
                    row.classList.remove('active-row');
                }
            }
        });
    }

    /**
     * 刷新左侧面板和相关计算
     */
    function refreshAll() {
        const keyword = searchKeyword.value;
        const filteredFiles = window.FileService.searchFiles(keyword);
        renderFileList(filteredFiles);
    }

    // ==========================================
    // 2. 表单与控制事件响应
    // ==========================================

    /**
     * 手动创建文件按钮
     */
    btnCreateFile.addEventListener('click', () => {
        const fileName = newFilenameInput.value;
        const initialContent = newFileContentInput.value;

        const res = window.FileService.createFile(fileName, initialContent);
        alertFeedback(res.success, res.message);

        if (res.success && res.file) {
            // 清空新建框并恢复输入区大小以防还在最大化中
            newFilenameInput.value = '';
            newFileContentInput.value = '';
            
            if (newFileContentContainer.classList.contains('maximized-editor-container')) {
                btnToggleNewExpand.click();
            }
            
            // 刷新列表并自动查看新创建的文件
            refreshAll();
            viewFile(res.file.id);
        }
    });

    /**
     * 新建文件区 - 放大编辑与还原大小
     */
    btnToggleNewExpand.addEventListener('click', () => {
        const isMaximized = newFileContentContainer.classList.toggle('maximized-editor-container');
        if (isMaximized) {
            btnToggleNewExpand.innerHTML = '🔍 还原大小';
            btnToggleNewExpand.classList.remove('btn-outline');
            btnToggleNewExpand.classList.add('btn-primary');
            newFileContentInput.rows = 20; // 放大时提供更多的高度
        } else {
            btnToggleNewExpand.innerHTML = '🔍 放大编辑';
            btnToggleNewExpand.classList.add('btn-outline');
            btnToggleNewExpand.classList.remove('btn-primary');
            newFileContentInput.rows = 3;  // 还原为原本的紧凑设计
        }
    });

    /**
     * 用户输入文件名回车直接创建
     */
    newFilenameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            btnCreateFile.click();
        }
    });

    /**
     * 实时检索和高级搜索
     */
    searchKeyword.addEventListener('input', () => {
        refreshAll();
    });

    btnSearch.addEventListener('click', () => {
        refreshAll();
    });

    btnResetSearch.addEventListener('click', () => {
        searchKeyword.value = '';
        refreshAll();
    });

    /**
     * 批量勾选：全选 / 反选
     */
    checkboxSelectAll.addEventListener('change', () => {
        const keyword = searchKeyword.value;
        // 如果有搜索，只全选目前界面上搜索筛选出来的文件
        const list = window.FileService.searchFiles(keyword);
        
        if (checkboxSelectAll.checked) {
            list.forEach(f => selectedIds.add(f.id));
        } else {
            list.forEach(f => selectedIds.delete(f.id));
        }
        refreshAll();
    });

    /**
     * 批量下载 选中为一个.zip
     */
    btnBulkDownload.addEventListener('click', async () => {
        if (selectedIds.size === 0) return;
        
        btnBulkDownload.disabled = true;
        const originalText = btnBulkDownload.textContent;
        btnBulkDownload.textContent = '⚡ 正在打包归档...';

        const idsArray = Array.from(selectedIds);
        const res = await window.FileService.downloadFiles(idsArray);
        
        alertFeedback(res.success, res.message);
        
        btnBulkDownload.textContent = originalText;
        btnBulkDownload.disabled = false;
    });

    /**
     * 批量删除
     */
    btnBulkDelete.addEventListener('click', () => {
        const count = selectedIds.size;
        if (count === 0) return;

        if (confirm(`您好，确认要一次性彻底删除已勾选的 ${count} 个临时文本文件吗？删除后数据无法恢复。`)) {
            const idsArray = Array.from(selectedIds);
            const res = window.FileService.deleteFiles(idsArray);
            alertFeedback(res.success, res.message);

            // 清理已选缓存
            selectedIds.clear();

            // 若当前展开查看的文件在被删除队列中，关闭右侧编辑器
            if (idsArray.includes(activeFileId)) {
                closeWorkspace();
            }

            refreshAll();
        }
    });

    // ==========================================
    // 3. 在线查看和特定编辑面板控制
    // ==========================================

    /**
     * 行范围获取按钮
     */
    btnGetLines.addEventListener('click', () => {
        if (!activeFileId) return;
        const start = parseInt(inputLineStart.value, 10);
        const end = parseInt(inputLineEnd.value, 10);

        if (isNaN(start) || isNaN(end)) {
            alertFeedback(false, '请输入合法的数字边界行数。');
            return;
        }

        // 调用带区间重绘
        viewFile(activeFileId, start, end);
    });

    /**
     * 全文恢复按钮
     */
    btnRestoreFull.addEventListener('click', () => {
        if (!activeFileId) return;
        inputLineStart.value = '';
        inputLineEnd.value = '';
        viewFile(activeFileId); // 重新视图渲染（不加范围，代表全文）
    });

    /**
     * 点击进入编辑模式
     */
    btnEditMode.addEventListener('click', () => {
        if (!activeFileId) return;
        editFile(activeFileId);
    });

    /**
     * 独立保存已编辑好的文件
     */
    btnSaveContent.addEventListener('click', () => {
        saveActiveFile({ source: 'manual', showToast: true, stayInEditMode: false, skipIfUnchanged: false });
    });

    /**
     * 取消编辑
     */
    btnCancelEdit.addEventListener('click', () => {
        if (!activeFileId) return;
        // 如果用户写过了，进行取消警示
        const file = window.FileService.getFileById(activeFileId);
        if (file && activeEditorTextarea.value !== file.content) {
            if (!confirm('您对内容作出了修改，确定要丢弃这些未保存的内容吗？')) {
                return;
            }
        }
        // 重新进入只读查看
        viewFile(activeFileId);
    });

    /**
     * 快捷单项下载工作区对应活跃文件
     */
    btnDownloadActive.addEventListener('click', () => {
        if (!activeFileId) return;
        const res = window.FileService.downloadFile(activeFileId);
        alertFeedback(res.success, res.message);
    });

    /**
     * 在线查看/编辑区 - 放大编辑与还原大小
     */
    btnToggleActiveExpand.addEventListener('click', () => {
        const isMaximized = activeEditorContainer.classList.toggle('maximized-editor-container');
        if (isMaximized) {
            btnToggleActiveExpand.innerHTML = '🔍 还原大小';
            btnToggleActiveExpand.classList.remove('btn-outline');
            btnToggleActiveExpand.classList.add('btn-primary');
            updateMaximizedEditToolbar();
            syncUnsavedChangesState();
        } else {
            btnToggleActiveExpand.innerHTML = '🔍 放大编辑';
            btnToggleActiveExpand.classList.add('btn-outline');
            btnToggleActiveExpand.classList.remove('btn-primary');

            // 还原高级工具面板
            powerToolsPanel.classList.add('d-none');
            btnTogglePowerTools.classList.add('btn-outline');
            btnTogglePowerTools.classList.remove('btn-primary');
            updateMaximizedEditToolbar();
        }
    });

    autoSaveToggle.addEventListener('change', () => {
        if (!isEditing) {
            autoSaveToggle.checked = false;
            alertFeedback(false, '请先进入编辑模式后再开启自动保存。');
            return;
        }
        setAutoSaveEnabled(autoSaveToggle.checked);
    });

    btnToolbarSave.addEventListener('click', () => {
        if (!isEditing) {
            alertFeedback(false, '当前处于查看模式，无法执行保存。');
            return;
        }
        saveActiveFile({ source: 'manual', showToast: true, stayInEditMode: true, skipIfUnchanged: false });
    });

    /**
     * 5. 🛠️ Notepad++ 高级编辑面板 toggler
     */
    btnTogglePowerTools.addEventListener('click', () => {
        const isHidden = powerToolsPanel.classList.toggle('d-none');
        if (isHidden) {
            btnTogglePowerTools.classList.add('btn-outline');
            btnTogglePowerTools.classList.remove('btn-primary');
        } else {
            btnTogglePowerTools.classList.remove('btn-outline');
            btnTogglePowerTools.classList.add('btn-primary');
            // 如果 CodeMirror 在运行，拉取并刷新显示
            if (cmInstance) {
                cmInstance.refresh();
            }
        }
    });

    /**
     * 监听下拉框语言切换，动态更新高亮
     */
    ptLanguageSelect.addEventListener('change', () => {
        const selectedMode = ptLanguageSelect.value;
        if (cmInstance) {
            cmInstance.setOption('mode', selectedMode);
            alertFeedback(true, `🎨 已成功将着色器切换为 [${selectedMode.toUpperCase()}] 语法高亮！`);
        }
    });

    /**
     * 辅助解析：获取当前光标所在的所有关联行。对 Notepad++ Column Editor 的模拟
     */
    function getSelectedLinesInfo(textarea) {
        // 如果接入了 CodeMirror，优先运用其高阶的 Selection 范围进行处理
        if (cmInstance) {
            const doc = cmInstance.getDoc();
            const hasSelection = cmInstance.somethingSelected();
            const startLineIdx = doc.getCursor('start').line;
            const endLineIdx = doc.getCursor('end').line;
            const fullText = cmInstance.getValue();
            const lines = fullText.split('\n');

            let targetLinesRange = { startIdx: 0, endIdx: lines.length - 1 };
            if (hasSelection) {
                targetLinesRange.startIdx = startLineIdx;
                targetLinesRange.endIdx = endLineIdx;
            }

            return { lines, range: targetLinesRange, hasSelection };
        }

        const text = textarea.value;
        const startPos = textarea.selectionStart;
        const endPos = textarea.selectionEnd;
        const lines = text.split('\n');
        
        let targetLinesRange = { startIdx: 0, endIdx: lines.length - 1 };
        const hasSelection = startPos !== endPos;

        if (hasSelection) {
            let currentOffset = 0;
            let startLineIdx = -1;
            let endLineIdx = -1;

            for (let i = 0; i < lines.length; i++) {
                // 用该行本身的长度 + 换行符 1 字符计算相对偏移量
                const lineLength = lines[i].length + 1; 
                const lineStart = currentOffset;
                const lineEnd = currentOffset + lineLength;

                if (startPos >= lineStart && startPos < lineEnd) {
                    startLineIdx = i;
                }
                if (endPos > lineStart && endPos <= lineEnd) {
                    endLineIdx = i;
                }
                currentOffset += lineLength;
            }

            if (startLineIdx !== -1) {
                targetLinesRange.startIdx = startLineIdx;
                targetLinesRange.endIdx = endLineIdx !== -1 ? endLineIdx : lines.length - 1;
            }
        }
        return { lines, range: targetLinesRange, hasSelection };
    }

    /**
     * 🛠️ 多行前缀与后缀插入编辑 (Notepad++ 多行同时列编辑)
     */
    btnApplyPrefixSuffix.addEventListener('click', () => {
        if (!isEditing) {
            alertFeedback(false, '❌ 无法编辑！当前处于【只读查看模式】，请点击左下角“进入编辑模式”。');
            return;
        }

        const prefixValue = ptMultiPrefix.value;
        const suffixValue = ptMultiSuffix.value;

        if (!prefixValue && !suffixValue) {
            alertFeedback(false, '⚠️ 请至少输入前缀或后缀的一项！');
            return;
        }

        const { lines, range } = getSelectedLinesInfo(activeEditorTextarea);

        for (let i = range.startIdx; i <= range.endIdx; i++) {
            lines[i] = prefixValue + lines[i] + suffixValue;
        }

        const updatedText = lines.join('\n');
        if (cmInstance) {
            cmInstance.setValue(updatedText);
        } else {
            activeEditorTextarea.value = updatedText;
        }
        
        // 置空输入
        ptMultiPrefix.value = '';
        ptMultiSuffix.value = '';
        
        alertFeedback(true, `⚡ 多行同时插入成功！已应用于第 ${range.startIdx + 1} 到第 ${range.endIdx + 1} 行。`);
    });

    /**
     * 🛠️ 多行自增序号列编辑器插入
     */
    btnApplyNumbering.addEventListener('click', () => {
        if (!isEditing) {
            alertFeedback(false, '❌ 无法编辑！当前处于【只读查看模式】，请开启“页面编辑”。');
            return;
        }

        let startVal = parseInt(ptNumStart.value, 10);
        let stepVal = parseInt(ptNumStep.value, 10);
        const formatVal = ptNumFormat.value || '';

        if (isNaN(startVal)) startVal = 1;
        if (isNaN(stepVal)) stepVal = 1;

        const { lines, range } = getSelectedLinesInfo(activeEditorTextarea);

        let currentVal = startVal;
        for (let i = range.startIdx; i <= range.endIdx; i++) {
            lines[i] = currentVal + formatVal + lines[i];
            currentVal += stepVal;
        }

        const updatedText = lines.join('\n');
        if (cmInstance) {
            cmInstance.setValue(updatedText);
        } else {
            activeEditorTextarea.value = updatedText;
        }
        alertFeedback(true, `⚡ 序号插入成功！已应用于第 ${range.startIdx + 1} 到第 ${range.endIdx + 1} 行。`);
    });

    /**
     * 🛠️ 批量查找与全部替换 (支持区分大小写与正则表达式)
     */
    btnReplaceAll.addEventListener('click', () => {
        if (!isEditing) {
            alertFeedback(false, '❌ 无法编辑！当前处于【只读查看模式】。');
            return;
        }

        const findVal = ptFindStr.value;
        const replaceVal = ptReplaceStr.value;

        if (!findVal) {
            alertFeedback(false, '⚠️ 查找文本不能为空！');
            return;
        }

        const text = cmInstance ? cmInstance.getValue() : activeEditorTextarea.value;
        const isCaseSensitive = ptCaseSensitive.checked;
        const isRegex = ptRegex.checked;

        let findRegex;
        try {
            if (isRegex) {
                const flags = isCaseSensitive ? 'g' : 'gi';
                findRegex = new RegExp(findVal, flags);
            } else {
                // 安全转义普通搜索词
                const escapedFind = findVal.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                const flags = isCaseSensitive ? 'g' : 'gi';
                findRegex = new RegExp(escapedFind, flags);
            }
        } catch (e) {
            alertFeedback(false, `❌ 正则表达式编译错误: ${e.message}`);
            return;
        }

        const matches = text.match(findRegex);
        const count = matches ? matches.length : 0;

        if (count === 0) {
            alertFeedback(false, `🔍 未找到任何匹配项 "${findVal}"。`);
            return;
        }

        const updatedText = text.replace(findRegex, replaceVal);
        if (cmInstance) {
            cmInstance.setValue(updatedText);
        } else {
            activeEditorTextarea.value = updatedText;
        }
        
        // 置空输入
        ptFindStr.value = '';
        ptReplaceStr.value = '';

        alertFeedback(true, `🔁 替换完成！成功批量替换了 ${count} 处匹配文本。`);
    });


    // ==========================================
    // 4. HTML5 元素拖拽导入（Drag and Drop）
    // ==========================================

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.add('dragging');
    });

    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('dragging');
    });

    dropZone.addEventListener('drop', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('dragging');

        const files = e.dataTransfer.files;
        if (!files || files.length === 0) return;

        let successImports = [];
        let failImports = [];

        // 将 File 读内容封装为 Promise
        const readFilePromise = (file) => {
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = function(evt) {
                    const content = evt.target.result;
                    const res = window.FileService.createFile(file.name, content);
                    if (res.success) {
                        successImports.push(file.name);
                    } else {
                        failImports.push(`${file.name} (${res.message})`);
                    }
                    resolve();
                };
                reader.onerror = function() {
                    failImports.push(`${file.name} (读取文件失败)`);
                    resolve();
                };
                reader.readAsText(file);
            });
        };

        const readPromises = [];
        for (let i = 0; i < files.length; i++) {
            readPromises.push(readFilePromise(files[i]));
        }

        // 等待全部拖入的文件读取且由 fileService 分配成功
        await Promise.all(readPromises);

        // 构建合并反馈气泡
        if (successImports.length > 0 && failImports.length === 0) {
            alertFeedback(true, `📥 成功拖拽导入 ${successImports.length} 个本地文本文件！`);
        } else if (successImports.length > 0 && failImports.length > 0) {
            alertFeedback(true, `📥 导入部分完成。成功导入 ${successImports.length} 个文件；不支持或由于命名重名导致以下加载失败：\n - ${failImports.join('\n - ')}`);
        } else {
            alertFeedback(false, `❌ 导入失败，未识别到有效的文本文件件。详情原因：\n - ${failImports.join('\n - ')}`);
        }

        // 重新刷列表视图
        refreshAll();
    });

    activeEditorTextarea.addEventListener('input', () => {
        syncUnsavedChangesState();
    });

    // ==========================================
    // 5. 其他辅助函数
    // ==========================================

    /**
     * 优雅非阻塞 Toast 自动消隐提示气泡代替原生阻断式 alert
     * @param {boolean} isSuccess 
     * @param {string} msg 
     */
    function alertFeedback(isSuccess, msg) {
        const toastContainer = document.getElementById('toast-container');
        if (!toastContainer) return;

        // 创建专属气泡
        const toast = document.createElement('div');
        toast.className = `toast-item ${isSuccess ? 'toast-success' : 'toast-danger'}`;
        
        // 渲染专属状态前缀
        const icon = isSuccess ? '✅' : '❌';
        
        toast.innerHTML = `
            <span class="toast-icon">${icon}</span>
            <div class="toast-content">${escapeHtml(msg).replace(/\n/g, '<br>')}</div>
        `;

        // 加到窗口中
        toastContainer.appendChild(toast);

        // 设定销毁计时器，比 CSS animation-delay 稍长即可彻底回收 DOM 节点
        const timeoutMs = isSuccess ? 3500 : 5300; // 成功消息 3.5 秒消失，错误消息 5.3 秒以便用户详细看
        setTimeout(() => {
            if (toast && toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, timeoutMs);
    }

    /**
     * 格式化存储时间简写
     */
    function formatTime(isoStr) {
        if (!isoStr) return '-';
        const date = new Date(isoStr);
        const H = String(date.getHours()).padStart(2, '0');
        const M = String(date.getMinutes()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${month}-${day} ${H}:${M}`;
    }

    /**
     * 详细时间戳呈现
     */
    function formatTimeDetail(isoStr) {
        if (!isoStr) return '-';
        const date = new Date(isoStr);
        return date.toLocaleString('zh-CN', { hour12: false });
    }

    /**
     * 转义 HTML 特殊字符（安全防护）
     */
    function escapeHtml(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    /**
     * 根据后缀确定相应的精美 Unicode 图标
     */
    function getFileEmoji(ext) {
        switch (ext) {
            case 'txt': return '📄';
            case 'md': return '📝';
            case 'js': return '💛';
            case 'ts': return '💙';
            case 'css': return '🎨';
            case 'html': return '🌐';
            case 'json': return '⚙️';
            case 'xml': return '🗂️';
            case 'py': return '🐍';
            case 'java': return '☕';
            case 'sql': return '💾';
            case 'sh': return '🐚';
            default: return '📄';
        }
    }

    // ==========================================
    // 6. 初始渲染引导运行
    // ==========================================
    refreshAll();
});
