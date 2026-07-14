/**
 * fileService.js
 * 核心文件处理服务模块 - 职责单一，统一管理系统的临时文件数据
 * 借助 LocalStorage 实现数据的本地持久化，防止页面刷新丢失
 * 新增功能：支持文件夹管理，允许不同文件夹下文件同名，下载时保留文件夹结构
 */

const FILE_STORAGE_KEY = 'TEMP_FILE_MANAGER_FILES';

// 允许编辑的常见文本文件类型扩展名集合
const SUPPORTED_TEXT_EXTENSIONS = [
    'txt', 'md', 'js', 'css', 'html', 'json', 'xml', 
    'ini', 'csv', 'py', 'java', 'ts', 'sh', 'yml', 'yaml', 'sql'
];

// 文件夹分隔符
const FOLDER_SEPARATOR = '/';

/**
 * 判断文件名是否是支持的文本格式
 * @param {string} filename 
 * @returns {{supported: boolean, ext: string}}
 */
function checkFileSupport(filename) {
    if (!filename || !filename.includes('.')) {
        return { supported: true, ext: 'txt' }; // 默认无后缀时补全为 txt
    }
    const ext = filename.split('.').pop().toLowerCase();
    const supported = SUPPORTED_TEXT_EXTENSIONS.includes(ext);
    return { supported, ext };
}

/**
 * 获取文件夹路径
 * @param {string} name 文件夹名称
 * @param {string} parentPath 父路径
 * @returns {string}
 */
function getFolderPath(name, parentPath = '') {
    const parent = parentPath ? parentPath + FOLDER_SEPARATOR : '';
    return parent + name;
}

/**
 * 解析路径，返回数组 [root, folder1, folder2, ...]
 * @param {string} path
 * @returns {Array<string>}
 */
function parsePath(path) {
    if (!path) return [];
    return path.split(FOLDER_SEPARATOR).filter(part => part);
}

/**
 * 从 LocalStorage 加载所有文件
 * @returns {Array} 所有文件列表
 */
function getAllFiles() {
    const rawData = localStorage.getItem(FILE_STORAGE_KEY);
    if (!rawData) {
        // 提供一些默认的引导文件，使用户体验更佳
        const defaultFiles = [
            {
                id: 'default-1',
                name: '欢迎阅读.md',
                extension: 'md',
                content: '# 网页轻量级文件管理系统\n\n这是一个完全在浏览器中运行的临时文件管理器！\n\n### 😉 特色功能：\n1. **持久化保存**：文件保存在 LocalStorage 中，页面刷新/关闭不会丢失。\n2. **多格式支持**：支持 .txt, .md, .js, .css, .html 等常见文本格式，非法格式（如图片、压缩包）会有贴心引导提示。\n3. **文件夹管理**：支持创建文件夹，将文件归类管理。不同文件夹下的文件可以同名。\n4. **打包下载**：勾选多个文件可以一键打包下载为 .zip 压缩包，文件夹结构会被保留。\n5. **按行检索**：支持查看文件的任意指定起止行数内容，非常适合阅读较长代码/日志！\n6. **多项联删**：支持多选框，批量删除无用文件。',
                path: '',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            {
                id: 'default-2',
                name: '示例代码.js',
                extension: 'js',
                content: '// 用户可以用本系统修改并保存此段代码\nfunction calculateSum(a, b) {\n    console.log("正在计算 " + a + " 和 " + b + " 的和...");\n    return a + b;\n}\n\nconst result = calculateSum(2026, 623);\nconsole.log("计算结果是: ", result);',
                path: '',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            {
                id: 'default-folder-1',
                name: '项目文件',
                extension: 'folder',
                content: '这是一个示例文件夹',
                path: '',
                isFolder: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        ];
        localStorage.setItem(FILE_STORAGE_KEY, JSON.stringify(defaultFiles));
        return defaultFiles;
    }
    try {
        return JSON.parse(rawData);
    } catch (e) {
        console.error('解析 LocalStorage 失败，重置为空', e);
        return [];
    }
}

/**
 * 将文件数据保存到 LocalStorage
 * @param {Array} files 
 */
function saveAllFiles(files) {
    localStorage.setItem(FILE_STORAGE_KEY, JSON.stringify(files));
}

/**
 * 根据 ID 获取特定文件
 * @param {string} id 
 * @returns {Object|null}
 */
function getFileById(id) {
    const files = getAllFiles();
    return files.find(f => f.id === id) || null;
}

/**
 * 新建文件夹
 * @param {string} name 文件夹名称
 * @param {string} parentPath 父路径
 * @returns {{success: boolean, message: string, folder?: Object}}
 */
function createFolder(name, parentPath = '') {
    if (!name || name.trim() === '') {
        return { success: false, message: '文件夹名称不能为空！' };
    }
    
    let trimmedName = name.trim();
    
    // 检查名称是否包含非法字符
    if (trimmedName.includes(FOLDER_SEPARATOR)) {
        return { success: false, message: '文件夹名称不能包含 "/" 符号！' };
    }

    const files = getAllFiles();
    const folderPath = getFolderPath(trimmedName, parentPath);
    
    // 检查是否已存在同名文件夹（在同一层级）
    const isDuplicate = files.some(f => f.name.toLowerCase() === trimmedName.toLowerCase() && f.path === folderPath);
    if (isDuplicate) {
        return { success: false, message: `文件夹 "${trimmedName}" 已存在于此位置。` };
    }

    const newFolder = {
        id: 'folder-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
        name: trimmedName,
        extension: 'folder',
        content: '',
        path: folderPath,
        isFolder: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    files.push(newFolder);
    saveAllFiles(files);

    return { success: true, message: '文件夹创建成功！', folder: newFolder };
}

/**
 * 新建临时文本文件
 * @param {string} name 文件名
 * @param {string} content 初始内容
 * @param {string} parentPath 父文件夹路径
 * @returns {{success: boolean, message: string, file?: Object}}
 */
function createFile(name, content = '', parentPath = '') {
    if (!name || name.trim() === '') {
        return { success: false, message: '文件名不能为空！' };
    }
    
    let trimmedName = name.trim();
    const { supported, ext } = checkFileSupport(trimmedName);
    
    if (!supported) {
        return { success: false, message: `暂不支持该文件类型 (.${ext})，本系统仅支持文本编辑。` };
    }

    // 若无后缀，自动补全 .txt 后缀
    if (!trimmedName.includes('.')) {
        trimmedName = `${trimmedName}.txt`;
    }

    const files = getAllFiles();
    const filePath = getFolderPath(trimmedName, parentPath);
    
    // 检查重名（在同一层级）
    const isDuplicate = files.some(f => f.name.toLowerCase() === trimmedName.toLowerCase() && f.path === filePath);
    if (isDuplicate) {
        return { success: false, message: `文件名 "${trimmedName}" 已存在于此位置。` };
    }

    const newFile = {
        id: 'file-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
        name: trimmedName,
        extension: ext,
        content: content,
        path: filePath,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    files.push(newFile);
    saveAllFiles(files);

    return { success: true, message: '文件创建成功！', file: newFile };
}

/**
 * 更新文件内容
 * @param {string} id 
 * @param {string} content 
 * @returns {{success: boolean, message: string, file?: Object}}
 */
function updateFile(id, content) {
    const files = getAllFiles();
    const fileIndex = files.findIndex(f => f.id === id);
    if (fileIndex === -1) {
        return { success: false, message: '未找到指定文件，更新失败。' };
    }

    files[fileIndex].content = content;
    files[fileIndex].updatedAt = new Date().toISOString();
    
    saveAllFiles(files);
    return { success: true, message: '文件已成功保存！', file: files[fileIndex] };
}

/**
 * 删除单个文件
 * @param {string} id 
 * @returns {{success: boolean, message: string}}
 */
function deleteFile(id) {
    const files = getAllFiles();
    const filtered = files.filter(f => f.id !== id);
    if (files.length === filtered.length) {
        return { success: false, message: '未找到该文件，删除失败。' };
    }

    saveAllFiles(filtered);
    return { success: true, message: '文件已被删除。' };
}

/**
 * 批量删除多个文件
 * @param {Array<string>} ids 
 * @returns {{success: boolean, message: string, deletedCount: number}}
 */
function deleteFiles(ids) {
    if (!ids || ids.length === 0) {
        return { success: false, message: '未选择任何文件！', deletedCount: 0 };
    }

    const files = getAllFiles();
    const filtered = files.filter(f => !ids.includes(f.id));
    const deletedCount = files.length - filtered.length;

    saveAllFiles(filtered);
    return { success: true, message: `成功批量删除了 ${deletedCount} 个文件。`, deletedCount };
}

/**
 * 按关键字搜索文件（检索文件名或文件内容）
 * @param {string} keyword 
 * @returns {Array} 搜索后的文件副本列表
 */
function searchFiles(keyword) {
    const files = getAllFiles();
    if (!keyword || keyword.trim() === '') {
        return files;
    }
    const cleanWord = keyword.trim().toLowerCase();
    return files.filter(f => 
        f.name.toLowerCase().includes(cleanWord) || 
        f.content.toLowerCase().includes(cleanWord)
    );
}

/**
 * 读取指定文件某些行的内容（1-based）
 * @param {string} id 文件ID
 * @param {number} startLine 起始行 (从 1 起始)
 * @param {number} endLine 结束行 (从 1 起始，包含)
 * @returns {{success: boolean, message: string, linesContent?: string, totalLines?: number}}
 */
function getFileLines(id, startLine, endLine) {
    const file = getFileById(id);
    if (!file) {
        return { success: false, message: '未找到对应文件。' };
    }

    const content = file.content;
    // 分割行。兼容 windows 换行、Mac 换行、Linux 换行
    const lines = content.split(/\r?\n/);
    const totalLines = lines.length;

    // 参数安全性规整转换
    let start = parseInt(startLine, 10);
    let end = parseInt(endLine, 10);

    if (isNaN(start) || start < 1) {
        start = 1;
    }
    if (isNaN(end) || end < 1) {
        end = totalLines;
    }

    // 边界条件规整
    if (start > totalLines) start = totalLines;
    if (end > totalLines) end = totalLines;
    if (start > end) {
        // 如果开始行大于结束行，做相互交换确保区间正常
        const temp = start;
        start = end;
        end = temp;
    }

    // slice 是 0-based，含左不含右。
    // 第 n 行对应的 index 是 n-1
    const sliced = lines.slice(start - 1, end);
    const linesContent = sliced.join('\n');

    return {
        success: true,
        message: `成功截取第 ${start} 至 ${end} 行 (共 ${sliced.length} 行) 内容。`,
        linesContent,
        totalLines,
        range: { start, end }
    };
}

/**
 * 下载单个临时文件
 * @param {string} id 
 * @returns {{success: boolean, message: string}}
 */
function downloadFile(id) {
    const file = getFileById(id);
    if (!file) {
        return { success: false, message: '未找到对应文件，无法下载。' };
    }

    try {
        const blob = new Blob([file.content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return { success: true, message: `开始下载 "${file.name}"。 `};
    } catch (e) {
        console.error('下载单文件失败', e);
        return { success: false, message: '浏览器环境不支持或由于安全限制下载失败。' };
    }
}

/**
 * 批量下载指定文件，保存为 ZIP。
 * 需要依赖外部引入的 JSZip 库 (window.JSZip)。
 * 现在会保留文件夹结构，允许不同文件夹下文件同名。
 * @param {Array<string>} ids 
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function downloadFiles(ids) {
    if (!ids || ids.length === 0) {
        return { success: false, message: '未选中任何要下载的文件。' };
    }

    if (!window.JSZip) {
        return { 
            success: false, 
            message: '网页未检测到 JSZip 压缩依赖库！请联系管理员或确认 index.html 中已正确加载 JSZip。' 
        };
    }

    try {
        const files = getAllFiles();
        const targets = files.filter(f => ids.includes(f.id));
        if (targets.length === 0) {
            return { success: false, message: '没有符合要求的有效文件，无法打包。' };
        }

        const zip = new JSZip();
        
        // 遍历将内容存入 zip，保留文件夹结构
        targets.forEach(item => {
            // 如果有文件夹路径，使用路径结构
            if (item.path && item.path !== '') {
                const filePath = item.path + FOLDER_SEPARATOR + item.name;
                zip.file(filePath, item.content);
            } else {
                // 如果在根目录，直接使用文件名
                zip.file(item.name, item.content);
            }
        });

        // 生成二进制 blob
        const contentBlob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(contentBlob);
        
        const timestamp = new Date().toISOString().slice(0, 10);
        const zipName = `files_archive_${timestamp}.zip`;

        const a = document.createElement('a');
        a.href = url;
        a.download = zipName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        return { success: true, message: `已成功打包 ${targets.length} 个文件（包含文件夹结构），并触发 ZIP 归档包下载。` };
    } catch (err) {
        console.error('打包压缩下载失败', err);
        return { success: false, message: '在执行打包压缩时遇到异常错误: ' + err.message };
    }
}

/**
 * 获取指定路径下的所有文件和文件夹
 * @param {string} parentPath 父路径
 * @returns {Array} 包含该目录下所有项目的数组
 */
function getItemsByPath(parentPath = '') {
    const files = getAllFiles();
    return files.filter(f => f.path === parentPath);
}

/**
 * 获取文件或文件夹的父路径
 * @param {string} path 
 * @returns {string}
 */
function getParentPath(path) {
    const parts = parsePath(path);
    if (parts.length <= 1) return '';
    parts.pop();
    return parts.join(FOLDER_SEPARATOR);
}

/**
 * 检查文件夹是否存在
 * @param {string} path 
 * @returns {boolean}
 */
function folderExists(path) {
    const files = getAllFiles();
    return files.some(f => f.path === path && f.isFolder);
}

/**
 * 检查文件夹是否为空
 * @param {string} path 
 * @returns {boolean}
 */
function isFolderEmpty(path) {
    const items = getItemsByPath(path);
    const files = items.filter(f => !f.isFolder);
    return files.length === 0;
}

// 暴露 API 到全局，便于网页 app.js 调用
window.FileService = {
    getAllFiles,
    getFileById,
    createFolder,
    createFile,
    updateFile,
    deleteFile,
    deleteFiles,
    searchFiles,
    getFileLines,
    downloadFile,
    downloadFiles,
    getItemsByPath,
    getParentPath,
    folderExists,
    isFolderEmpty
};