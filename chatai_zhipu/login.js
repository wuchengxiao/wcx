//输入正确token后，保存url,和apikey的内容。
var processinput = null;
let conversation = messages ? messages.slice() : [];
let isSending = false;
let hasInitChat = false;

/**
 * 在指定位置插入字符
 * @param {number} position - 插入位置
 * @param {string} char - 要插入的字符
 * @param {string} originalString - 原始字符串
 * @returns {string} 插入字符后的新字符串
 */
function insertCharAtPosition(position, char, originalString) {
    if (position < 0 || position > originalString.length) {
        throw new Error('位置参数超出字符串范围');
    }
    return originalString.slice(0, position) + char + originalString.slice(position);
}

/**
 * 对固定加密字符串进行N次解密
 * @param {number} decryptTimes - 解密次数
 * @returns {string} 解密后的字符串
 */
function decryptStringNTimes(decryptTimes, encryptedString) {
    if (!encryptedString) {
        return null;
    }
    // 简单的解密算法（示例：字符位置交换）
    for (let i = 0; i < decryptTimes; i++) {
        encryptedString = atob(encryptedString);
    }
    return encryptedString;
}

/**
 * 保存token到localStorage，保留1小时
 * @param {string} tokenValue - token值
 */
function saveTokenToStorage(tokenValue) {
    const tokenData = {
        token: tokenValue,
        timestamp: Date.now()
    };
    localStorage.setItem('chatai_token', JSON.stringify(tokenData));
}

/**
 * 从localStorage获取token，检查是否过期
 * @returns {string|null} token值或null
 */
function getTokenFromStorage() {
    const stored = localStorage.getItem('chatai_token');
    if (!stored) {
        return null;
    }
    
    try {
        const tokenData = JSON.parse(stored);
        const oneHour = 60 * 60 * 1000; // 1小时的毫秒数
        const isExpired = (Date.now() - tokenData.timestamp) > oneHour;
        
        if (isExpired) {
            localStorage.removeItem('chatai_token');
            return null;
        }
        
        return tokenData.token;
    } catch (e) {
        localStorage.removeItem('chatai_token');
        return null;
    }
}

/**
 * 显示登录错误信息
 * @param {string} msg - 错误消息
 */
function showError(msg) {
    _util.text('loginMsg', msg);
}

/**
 * 从登录表单获取token输入值
 * @returns {Array} token数组
 */
function getInputs() {
    var inputVar = _util.id('token').value;
    return inputVar.split('-');
}

/**
 * 处理输入的token，提取url和apikey
 * @param {Array} inputVars - token数组
 * @param {string} sourceUrl - 加密的url
 * @param {string} sourceApiKey - 加密的apikey
 * @returns {Object} 包含processedUrl, processedApiKey, isSuccess的对象
 */
function processinputVars(inputVars, sourceUrl, sourceApiKey) {
    let isSuccess = false;
    if (inputVars.length < 6) {
        return {
            isSuccess
        };
    }
    let processedUrl = '';
    let processedApiKey = '';
    try {
        processedUrl = decryptStringNTimes(inputVars[2], insertCharAtPosition(inputVars[0], inputVars[1], sourceUrl));
        processedApiKey = decryptStringNTimes(inputVars[5], insertCharAtPosition(inputVars[3], inputVars[4], sourceApiKey));
    } catch (e) {
        return {
            isSuccess
        };
    }
    isSuccess = true;
    return {
        processedUrl,
        processedApiKey,
        isSuccess
    };
}

/**
 * 处理登录测试/验证
 */
async function runTest() {
    var inputVars = getInputs();
    processinput = processinputVars(inputVars, url, apikey);
    if (!processinput.isSuccess) {
        showError("token error");
        return;
    }
    
    // 保存token到localStorage，保留1小时
    const tokenValue = _util.id('token').value;
    saveTokenToStorage(tokenValue);
    
    _util.hide('login');

    // 开始聊天
    _util.show('app-container');
    initChatUI();
}

/**
 * 页面加载时自动登录
 */
function autoLogin() {
    const savedToken = getTokenFromStorage();
    if (savedToken) {
        // 填充token输入框
        const tokenInput = _util.id('token');
        if (tokenInput) {
            tokenInput.value = savedToken;
        }
        // 自动执行登录
        runTest();
    }
}

/**
 * 退出登录
 */
function logout() {
    // 清空 localStorage
    localStorage.removeItem('chatai_token');
    
    // 清空对话历史
    conversation = [];
    processinput = null;
    hasInitChat = false;
    
    // 清空输入框
    const tokenInput = _util.id('token');
    if (tokenInput) {
        tokenInput.value = '';
    }
    
    // 清空聊天消息
    const msgContainer = _util.id('msg-container');
    if (msgContainer) {
        // 保留打字指示器，清空其他消息
        const typing = _util.id('typing');
        msgContainer.innerHTML = '';
        if (typing) {
            msgContainer.appendChild(typing);
        }
    }
    
    // 隐藏聊天界面，显示登录界面
    _util.hide('app-container');
    _util.show('login');
    
    // 清空错误提示
    _util.text('loginMsg', '');
}

// 页面加载完成后尝试自动登录
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoLogin);
} else {
    autoLogin();
}