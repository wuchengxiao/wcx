//输入正确token后，保存url,和apikey的内容。
var processinput = null;
let conversation = [];
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
 * 保存token到localStorage，保留2小时
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
        const twoHours = 2 * 60 * 60 * 1000; // 2小时的毫秒数
        const isExpired = (Date.now() - tokenData.timestamp) > twoHours;
        
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
    const loginMsg = _util.id('loginMsg');
    if (loginMsg) {
        loginMsg.innerText = msg;
    }
}

/**
 * 从登录表单获取token输入值
 * @returns {Array} token数组
 */
function getInputs() {
    const tokenInput = _util.id('token') ;
    if (!tokenInput) {
        return [];
    }
    var inputVar = tokenInput.value;
    if (inputVar.length > 0 && inputVar.length < 3) {
        return ['3', 'a', inputVar, '3', '0', '4'];
    }
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
async function runTest(inputVars) {
    if (inputVars && inputVars.preventDefault) {
        inputVars.preventDefault();
        inputVars = getInputs();
    }
    if (!Array.isArray(inputVars) || inputVars.length === 0) {
        showError('请检查输入格式');
        return;
    }
    processinput = processinputVars(inputVars, url, apikey);
    if (!processinput.isSuccess) {
        showError("登录失败，请检查输入内容是否正确");
        return;
    }
    // 保存token到localStorage，保留2小时
    const tokenInput = _util.id('token');
    const tokenValue = tokenInput ? tokenInput.value : inputVars.join('-');
    saveTokenToStorage(tokenValue);
    const loginDom = _util.id('login');
    if (loginDom) {
        loginDom.style.display = 'none';
    }
    const appDom = _util.id('app');
    if (appDom) {
        appDom.style.display = 'block';
    }
    // 通知index.js初始化聊天UI
    if (window.onLoginSuccess) window.onLoginSuccess();
}

/**
 * 页面加载时自动登录
 */
function autoLogin() {
    const savedToken = getTokenFromStorage();
    if (savedToken) {
        // 将savedToken转换为输入框需要的格式
        const inputVars = savedToken.split('-');
        // 自动执行登录
        runTest(inputVars);
    } else{
        // 没有有效token，显示登录界面
        showLogin();
    }
}

/**
 * 显示登录界面
 */
function showLogin() {
    var loginDom = _util.ce('div');
    loginDom.className = 'login';
    loginDom.id = 'login';
    loginDom.innerHTML = `
        <h2>登录</h2>
        <input type="text" id="token" placeholder="31-a1-51-31-01-41">
        <button id="loginBtn">登录</button>
        <p id="loginMsg" class="error"></p>
    `;
    _util.bodyAc(loginDom);
    _util.on(_util.id('loginBtn'), 'click', runTest);
    _util.hide('app');
}

/**
 * 退出登录
 */
function logout() {
    // 清空 localStorage
    localStorage.clear();
    
    // 清空对话历史
    conversation = [];
    processinput = null;
    hasInitChat = false;
    window.currentRole = null;
    
    location.reload();
}

// 页面加载完成后尝试自动登录
if (document.readyState === 'loading') {
    _util.on(document, 'DOMContentLoaded', autoLogin);
} else {
    autoLogin();
}