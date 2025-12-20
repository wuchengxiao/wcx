// 游戏配置
const GAME_CONFIG = {
    TOTAL_ROUNDS: 10,
    TIME_PER_ROUND: 15000, // 15秒
    POINTS_PER_CORRECT: 10
};

// 垃圾数据 - 包含名称、类型和表情符号
const GARBAGE_DATA = [
    // 厨房垃圾 (kitchen)
    { name: '苹果核', type: 'kitchen', emoji: '🍎' },
    { name: '香蕉皮', type: 'kitchen', emoji: '🍌' },
    { name: '鸡蛋壳', type: 'kitchen', emoji: '🥚' },
    { name: '剩菜', type: 'kitchen', emoji: '🍚' },
    { name: '骨头', type: 'kitchen', emoji: '🦴' },
    { name: '橙子皮', type: 'kitchen', emoji: '🍊' },
    { name: '西瓜皮', type: 'kitchen', emoji: '🍉' },
    { name: '鱼骨头', type: 'kitchen', emoji: '🐟' },
    { name: '胡萝卜皮', type: 'kitchen', emoji: '🥕' },
    { name: '菜叶', type: 'kitchen', emoji: '🥬' },
    { name: '咖啡渣', type: 'kitchen', emoji: '☕' },
    { name: '剩饭剩菜', type: 'kitchen', emoji: '🍝' },
    { name: '番茄皮', type: 'kitchen', emoji: '🍅' },
    { name: '果皮', type: 'kitchen', emoji: '🍇' },
    { name: '茶叶渣', type: 'kitchen', emoji: '🍵' },
    { name: '面包屑', type: 'kitchen', emoji: '🍞' },
    
    // 可回收垃圾 (recycle)
    { name: '牛奶盒', type: 'recycle', emoji: '🥛' },
    { name: '矿泉水瓶', type: 'recycle', emoji: '🚰' },
    { name: '易拉罐', type: 'recycle', emoji: '🥤' },
    { name: '报纸', type: 'recycle', emoji: '📰' },
    { name: '杂志', type: 'recycle', emoji: '📚' },
    { name: '纸箱', type: 'recycle', emoji: '📦' },
    { name: '塑料瓶', type: 'recycle', emoji: '🍶' },
    { name: '玻璃瓶', type: 'recycle', emoji: '🍷' },
    { name: '铝箔纸', type: 'recycle', emoji: '🥡' },
    { name: '旧衣服', type: 'recycle', emoji: '👕' },
    { name: '塑料餐具', type: 'recycle', emoji: '🍴' },
    { name: '金属罐', type: 'recycle', emoji: '🥫' },
    { name: '废铁', type: 'recycle', emoji: '⚙️' },
    { name: '旧书籍', type: 'recycle', emoji: '📖' },
    { name: '塑料盒', type: 'recycle', emoji: '📦' },
    { name: '玻璃瓶', type: 'recycle', emoji: '🍾' },
    { name: '易拉罐', type: 'recycle', emoji: '🥤' },
    
    // 有害垃圾 (harmful)
    { name: '电池', type: 'harmful', emoji: '🔋' },
    { name: '灯泡', type: 'harmful', emoji: '💡' },
    { name: '过期药品', type: 'harmful', emoji: '💊' },
    { name: '温度计', type: 'harmful', emoji: '🌡️' },
    { name: '杀虫剂', type: 'harmful', emoji: '🧪' },
    { name: '油漆桶', type: 'harmful', emoji: '🎨' },
    { name: '注射器', type: 'harmful', emoji: '💉' },
    { name: '化妆品瓶', type: 'harmful', emoji: '💄' },
    { name: '指甲油', type: 'harmful', emoji: '💅' },
    { name: '过期化妆品', type: 'harmful', emoji: '🧴' },
    { name: '农药瓶', type: 'harmful', emoji: '🧪' },
    { name: '胶片', type: 'harmful', emoji: '🎞️' },
    { name: '锂电池', type: 'harmful', emoji: '🔋' },
    { name: '水银温度计', type: 'harmful', emoji: '🌡️' },
    
    // 其他垃圾 (other)
    { name: '纸巾', type: 'other', emoji: '🧻' },
    { name: '塑料袋', type: 'other', emoji: '🛍️' },
    { name: '烟头', type: 'other', emoji: '🚬' },
    { name: '灰尘', type: 'other', emoji: '🌫️' },
    { name: '陶瓷碎片', type: 'other', emoji: '🍽️' },
    { name: '尿不湿', type: 'other', emoji: '👶' },
    { name: '一次性手套', type: 'other', emoji: '🧤' },
    { name: '破布', type: 'other', emoji: '🧵' },
    { name: '毛发', type: 'other', emoji: '💇' },
    { name: '创可贴', type: 'other', emoji: '🩹' },
    { name: '卫生纸', type: 'other', emoji: '🧻' },
    { name: '旧毛巾', type: 'other', emoji: '🧼' },
    { name: '渣土', type: 'other', emoji: '🏗️' },
    { name: '一次性筷子', type: 'other', emoji: '🥢' },
    { name: '口香糖', type: 'other', emoji: '🍬' }
];

// 游戏状态
let gameState = {
    currentRound: 1,
    score: 0,
    currentGarbage: null,
    gameStartTime: null,
    gameEndTime: null,
    isDragging: false,
    draggedElement: null,
    dragOffset: { x: 0, y: 0 },
    originalTransition: '',
    originalPosition: '',
    originalZIndex: '',
    originalOpacity: '',
    timerInterval: null // 保存定时器ID
};

// DOM元素
const elements = {
    startPage: document.getElementById('startPage'),
    gamePage: document.getElementById('gamePage'),
    endPage: document.getElementById('endPage'),
    startBtn: document.getElementById('startBtn'),
    score: document.getElementById('score'),
    round: document.getElementById('round'),
    timer: document.getElementById('timer'),
    garbageArea: document.getElementById('garbageArea'),
    kitchenTrash: document.getElementById('kitchenTrash'),
    recycleTrash: document.getElementById('recycleTrash'),
    otherTrash: document.getElementById('otherTrash'),
    harmfulTrash: document.getElementById('harmfulTrash'),
    finalScore: document.getElementById('finalScore'),
    stars: document.getElementById('stars'),
    nameInputSection: document.getElementById('nameInputSection'),
    playerName: document.getElementById('playerName'),
    saveBtn: document.getElementById('saveBtn'),
    restartBtn: document.getElementById('restartBtn'),
    rankingBtn: document.getElementById('rankingBtn'),
    rankingModal: document.getElementById('rankingModal'),
    closeRankingBtn: document.getElementById('closeRankingBtn'),
    closeModal: document.querySelector('.close'),
    rankings: document.getElementById('rankings')
};

// 初始化游戏
function initGame() {
    // 绑定事件监听器
    bindEventListeners();
    
    // 初始化排行榜
    updateRankingsDisplay();
}

// 绑定事件监听器
function bindEventListeners() {
    // 开始游戏按钮
    elements.startBtn.addEventListener('click', startGame);
    
    // 重新挑战按钮
    elements.restartBtn.addEventListener('click', restartGame);
    
    // 排行榜按钮
    elements.rankingBtn.addEventListener('click', showRankings);
    
    // 关闭排行榜按钮
    elements.closeRankingBtn.addEventListener('click', hideRankings);
    elements.closeModal.addEventListener('click', hideRankings);
    
    // 点击模态框外部关闭
    elements.rankingModal.addEventListener('click', (e) => {
        if (e.target === elements.rankingModal) {
            hideRankings();
        }
    });
    
    // 保存成绩按钮
    elements.saveBtn.addEventListener('click', saveScore);
    
    // 点击垃圾桶的事件
    const trashCans = [elements.kitchenTrash, elements.recycleTrash, elements.otherTrash, elements.harmfulTrash];
    trashCans.forEach(can => {
        can.addEventListener('dragover', handleDragOver);
        can.addEventListener('drop', handleDrop);
    });
}

// 开始游戏
function startGame() {
    // 重置游戏状态
    gameState = {
        currentRound: 1,
        score: 0,
        currentGarbage: null,
        gameStartTime: Date.now(),
        gameEndTime: null,
        isDragging: false,
        draggedElement: null,
        dragOffset: { x: 0, y: 0 },
        originalTransition: '',
        originalPosition: '',
        originalZIndex: '',
        originalOpacity: '',
        timerInterval: null
    };
    
    // 清空所有垃圾桶
    const trashCans = [elements.kitchenTrash, elements.recycleTrash, elements.otherTrash, elements.harmfulTrash];
    trashCans.forEach(can => {
        const garbageElements = can.querySelectorAll('.trash-can-garbage');
        garbageElements.forEach(garbage => garbage.remove());
    });
    
    // 更新UI
    elements.score.textContent = gameState.score;
    elements.round.textContent = gameState.currentRound;
    elements.timer.textContent = GAME_CONFIG.TIME_PER_ROUND / 1000;
    
    // 切换页面
    elements.startPage.classList.remove('active');
    elements.gamePage.classList.add('active');
    
    // 开始第一回合
    nextRound();
}

// 下一回合
function nextRound() {
    if (gameState.currentRound > GAME_CONFIG.TOTAL_ROUNDS) {
        endGame();
        return;
    }
    
    // 清空垃圾区域
    elements.garbageArea.innerHTML = '';
    
    // 更新回合数
    elements.round.textContent = gameState.currentRound;
    
    // 随机选择一个垃圾
    const randomIndex = Math.floor(Math.random() * GARBAGE_DATA.length);
    gameState.currentGarbage = GARBAGE_DATA[randomIndex];
    
    // 创建垃圾元素
    const garbageElement = document.createElement('div');
    garbageElement.className = 'garbage';
    garbageElement.draggable = true;
    garbageElement.dataset.type = gameState.currentGarbage.type;
    
    // 设置初始样式，确保没有额外的margin或padding影响定位
    garbageElement.style.margin = '0';
    garbageElement.style.padding = '30px 50px'; // 明确设置padding，确保一致性
    garbageElement.style.boxSizing = 'border-box'; // 确保padding不影响元素尺寸计算
    
    // 创建表情符号元素
    const emojiElement = document.createElement('div');
    emojiElement.className = 'garbage-emoji';
    emojiElement.textContent = gameState.currentGarbage.emoji;
    
    // 创建名称元素
    const nameElement = document.createElement('div');
    nameElement.className = 'garbage-name';
    nameElement.textContent = gameState.currentGarbage.name;
    
    // 添加到垃圾元素
    garbageElement.appendChild(emojiElement);
    garbageElement.appendChild(nameElement);
    
    // 添加拖拽事件
    garbageElement.addEventListener('dragstart', handleDragStart);
    garbageElement.addEventListener('dragend', handleDragEnd);
    
    // 添加触摸事件支持
    garbageElement.addEventListener('touchstart', handleTouchStart);
    garbageElement.addEventListener('touchmove', handleTouchMove);
    garbageElement.addEventListener('touchend', handleTouchEnd);
    
    // 添加到页面
    elements.garbageArea.appendChild(garbageElement);
    
    // 开始倒计时
    startTimer();
}

// 开始倒计时
function startTimer() {
    // 清除之前的定时器（如果存在）
    if (gameState.timerInterval) {
        clearInterval(gameState.timerInterval);
    }
    
    let remainingTime = GAME_CONFIG.TIME_PER_ROUND / 1000;
    elements.timer.textContent = remainingTime;
    
    // 保存定时器ID到gameState
    gameState.timerInterval = setInterval(() => {
        remainingTime--;
        elements.timer.textContent = remainingTime;
        
        if (remainingTime <= 0) {
            clearInterval(gameState.timerInterval);
            gameState.timerInterval = null;
            // 时间到，自动进入下一回合
            gameState.currentRound++;
            nextRound();
        }
    }, 1000);
}

// 拖拽开始
function handleDragStart(e) {
    gameState.isDragging = true;
    gameState.draggedElement = e.target;
    
    // 设置拖拽数据
    e.dataTransfer.setData('text/plain', e.target.dataset.type);
    
    // 添加拖拽效果
    e.target.style.opacity = '0.5';
    
    // 记录鼠标偏移量
    const rect = e.target.getBoundingClientRect();
    gameState.dragOffset.x = e.clientX - rect.left;
    gameState.dragOffset.y = e.clientY - rect.top;
}

// 拖拽结束
function handleDragEnd(e) {
    gameState.isDragging = false;
    gameState.draggedElement = null;
    
    // 恢复元素样式
    e.target.style.opacity = '1';
}

// 拖拽经过
function handleDragOver(e) {
    e.preventDefault();
    // 添加拖拽提示样式
    e.currentTarget.style.transform = 'translateY(-10px) scale(1.1)';
}

// 触摸开始
function handleTouchStart(e) {
    e.preventDefault();
    const touch = e.touches[0];
    
    // 获取真正的垃圾元素（可能触摸的是子元素）
    let garbageElement = e.target;
    if (!garbageElement.classList.contains('garbage')) {
        garbageElement = garbageElement.closest('.garbage');
    }
    
    if (!garbageElement) return;
    
    gameState.isDragging = true;
    gameState.draggedElement = garbageElement;
    
    // 获取元素在视口中的精确位置
    const rect = garbageElement.getBoundingClientRect();
    
    // 计算触摸点相对于元素左上角的偏移量（精确到像素）
    gameState.dragOffset.x = Math.round(touch.clientX - rect.left);
    gameState.dragOffset.y = Math.round(touch.clientY - rect.top);
    
    // 记录原始样式
    gameState.originalTransition = garbageElement.style.transition;
    gameState.originalPosition = garbageElement.style.position;
    gameState.originalZIndex = garbageElement.style.zIndex;
    gameState.originalOpacity = garbageElement.style.opacity;
    
    // 应用拖拽样式
    garbageElement.style.opacity = '0.5';
    garbageElement.style.position = 'fixed';
    garbageElement.style.zIndex = '1000';
    garbageElement.style.transition = 'none';
    garbageElement.style.pointerEvents = 'none'; // 防止触摸事件干扰
    
    // 立即更新元素位置，确保与手指位置一致
    garbageElement.style.left = `${touch.clientX - gameState.dragOffset.x}px`;
    garbageElement.style.top = `${touch.clientY - gameState.dragOffset.y}px`;
}

// 触摸移动
function handleTouchMove(e) {
    e.preventDefault();
    if (!gameState.isDragging || !gameState.draggedElement) return;
    
    const touch = e.touches[0];
    
    // 直接更新位置，使用requestAnimationFrame提高性能
    requestAnimationFrame(() => {
        const element = gameState.draggedElement;
        if (!element) return;
        
        // 确保元素保持fixed定位
        element.style.position = 'fixed';
        
        // 计算新位置 - fixed定位不需要考虑scrollX/Y
        const x = touch.clientX - gameState.dragOffset.x;
        const y = touch.clientY - gameState.dragOffset.y;
        
        // 直接设置元素位置，避免任何可能的延迟
        element.style.left = `${x}px`;
        element.style.top = `${y}px`;
    });
}

// 触摸结束
function handleTouchEnd(e) {
    e.preventDefault();
    if (!gameState.isDragging || !gameState.draggedElement) return;
    
    const touch = e.changedTouches[0];
    const element = gameState.draggedElement;
    
    // 恢复元素样式
    element.style.pointerEvents = '';
    
    // 恢复原始样式（如果有保存）
    if (gameState.originalOpacity) {
        element.style.opacity = gameState.originalOpacity;
    } else {
        element.style.opacity = '1';
    }
    
    if (gameState.originalPosition) {
        element.style.position = gameState.originalPosition;
    } else {
        element.style.position = '';
    }
    
    if (gameState.originalZIndex) {
        element.style.zIndex = gameState.originalZIndex;
    } else {
        element.style.zIndex = '';
    }
    
    if (gameState.originalTransition) {
        element.style.transition = gameState.originalTransition;
    } else {
        element.style.transition = 'all 0.3s ease';
    }
    
    // 检查是否放置在垃圾桶上
    const dropTarget = document.elementFromPoint(touch.clientX, touch.clientY);
    if (dropTarget && dropTarget.closest('.trash-can')) {
        const trashCan = dropTarget.closest('.trash-can');
        // 创建一个模拟的drop事件
        const dropEvent = new Event('drop', { bubbles: true });
        // 设置必要的属性
        dropEvent.currentTarget = trashCan;
        dropEvent.dataTransfer = {
            getData: () => element.dataset.type
        };
        // 触发drop事件
        trashCan.dispatchEvent(dropEvent);
    }
    
    // 重置游戏状态
    gameState.isDragging = false;
    gameState.draggedElement = null;
    gameState.dragOffset = { x: 0, y: 0 };
    gameState.originalTransition = '';
    gameState.originalPosition = '';
    gameState.originalZIndex = '';
    gameState.originalOpacity = '';
}

// 放置垃圾
function handleDrop(e) {
    e.preventDefault();
    
    // 恢复垃圾桶样式
    e.currentTarget.style.transform = '';
    
    // 获取拖拽的数据
    const garbageType = e.dataTransfer.getData('text/plain');
    const trashCanType = e.currentTarget.id.replace('Trash', '');
    
    // 检查是否正确分类
    if (garbageType === trashCanType) {
        // 正确分类，加分
        gameState.score += GAME_CONFIG.POINTS_PER_CORRECT;
        elements.score.textContent = gameState.score;
        
        // 显示得分动画
        showScoreAnimation(e.currentTarget);
        
        // 获取拖拽元素的emoji
        if (gameState.draggedElement && gameState.currentGarbage) {
            // 创建垃圾emoji元素
            const garbageEmojiElement = document.createElement('div');
            garbageEmojiElement.className = 'trash-can-garbage';
            garbageEmojiElement.textContent = gameState.currentGarbage.emoji;
            
            // 计算垃圾桶内已有垃圾的数量
            const existingGarbage = e.currentTarget.querySelectorAll('.trash-can-garbage');
            const garbageCount = existingGarbage.length;
            
            // 实现合理的堆放逻辑，确保垃圾不会超出垃圾桶范围
            const maxItemsPerRow = 4;
            const row = Math.floor(garbageCount / maxItemsPerRow);
            const col = garbageCount % maxItemsPerRow;
            
            // 计算水平和垂直偏移量
            const horizontalPadding = 10; // 垃圾桶左右内边距
            const verticalPadding = 10; // 垃圾桶底部内边距
            const topPadding = 10; // 垃圾桶顶部内边距
            const itemSize = 24; // 垃圾元素的近似大小
            const spacing = 5; // 元素间距
            
            // 水平居中排列，每个垃圾桶最多显示3行
            if (row < 3) {
                // 计算水平位置，确保与左右桶壁保持10px距离
                const canWidth = e.currentTarget.offsetWidth - horizontalPadding * 2;
                const totalContentWidth = maxItemsPerRow * (itemSize + spacing) - spacing;
                const startX = Math.max(horizontalPadding, (canWidth - totalContentWidth) / 2);
                
                // 计算垂直位置，确保与底部和顶部桶壁保持10px距离
                const canHeight = e.currentTarget.offsetHeight - verticalPadding - topPadding;
                const totalContentHeight = 3 * (itemSize + spacing) - spacing;
                const availableHeight = canHeight - totalContentHeight;
                const yPos = verticalPadding + availableHeight + (2 - row) * (itemSize + spacing);
                
                // 计算水平位置
                const xPos = startX + col * (itemSize + spacing);
                
                // 添加随机旋转效果，但保持在合理范围内
                const randomRotation = Math.random() * 30 - 15; // 随机旋转 -15度 到 15度
                
                // 设置垃圾元素的位置
                garbageEmojiElement.style.position = 'absolute';
                garbageEmojiElement.style.bottom = `${yPos}px`;
                garbageEmojiElement.style.left = `${xPos}px`;
                garbageEmojiElement.style.transform = `rotate(${randomRotation}deg)`;
                garbageEmojiElement.style.zIndex = row;
            } else {
                // 如果垃圾桶已满，不添加新垃圾（保持在可视范围内）
                garbageEmojiElement.style.display = 'none';
            }
            
            // 添加到垃圾桶
            e.currentTarget.appendChild(garbageEmojiElement);
        }
    }
    
    // 移除当前垃圾
    if (gameState.draggedElement) {
        gameState.draggedElement.remove();
    }
    
    // 清除当前倒计时
    if (gameState.timerInterval) {
        clearInterval(gameState.timerInterval);
        gameState.timerInterval = null;
    }
    
    // 进入下一回合
    gameState.currentRound++;
    nextRound();
}

// 显示得分动画
function showScoreAnimation(target) {
    const scoreElement = document.createElement('div');
    scoreElement.textContent = '+10';
    scoreElement.style.cssText = `
        position: absolute;
        color: #FFD166;
        font-size: 1.5rem;
        font-weight: bold;
        pointer-events: none;
        animation: scoreFly 1s ease-out forwards;
    `;
    
    // 设置位置
    const rect = target.getBoundingClientRect();
    scoreElement.style.left = rect.left + rect.width / 2 + 'px';
    scoreElement.style.top = rect.top + 'px';
    
    document.body.appendChild(scoreElement);
    
    // 添加动画
    const style = document.createElement('style');
    style.textContent = `
        @keyframes scoreFly {
            0% { transform: translate(-50%, 0) scale(1); opacity: 1; }
            100% { transform: translate(-50%, -100px) scale(1.5); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
    
    // 动画结束后移除元素
    setTimeout(() => {
        scoreElement.remove();
        style.remove();
    }, 1000);
}

// 结束游戏
function endGame() {
    gameState.gameEndTime = Date.now();
    const gameTime = gameState.gameEndTime - gameState.gameStartTime;
    
    // 切换页面
    elements.gamePage.classList.remove('active');
    elements.endPage.classList.add('active');
    
    // 更新最终得分
    elements.finalScore.textContent = gameState.score;
    
    // 显示星星
    displayStars();
    
    // 检查是否进入前10名
    if (isTopTen()) {
        elements.nameInputSection.style.display = 'block';
        elements.playerName.focus();
    } else {
        elements.nameInputSection.style.display = 'none';
    }
}

// 显示星星
function displayStars() {
    elements.stars.innerHTML = '';
    const starCount = Math.floor(gameState.score / 10);
    
    for (let i = 0; i < starCount; i++) {
        const starElement = document.createElement('div');
        starElement.className = 'star';
        starElement.textContent = '⭐';
        elements.stars.appendChild(starElement);
    }
}

// 检查是否进入前10名
function isTopTen() {
    const rankings = getRankings();
    return rankings.length < 10 || gameState.score > rankings[rankings.length - 1].score;
}

// 保存得分
function saveScore() {
    const name = elements.playerName.value.trim();
    if (!name) {
        alert('请输入你的姓名！');
        elements.playerName.focus();
        return;
    }
    
    const gameTime = gameState.gameEndTime - gameState.gameStartTime;
    const scoreData = {
        name: name,
        score: gameState.score,
        stars: Math.floor(gameState.score / 10),
        time: gameTime,
        timestamp: Date.now()
    };
    
    // 获取当前排行榜
    const rankings = getRankings();
    
    // 添加新成绩
    rankings.push(scoreData);
    
    // 排序
    rankings.sort((a, b) => {
        // 按分数降序
        if (b.score !== a.score) return b.score - a.score;
        // 按星星数降序
        if (b.stars !== a.stars) return b.stars - a.stars;
        // 按时间升序
        if (b.time !== a.time) return a.time - b.time;
        // 按时间戳升序（最早的优先）
        return a.timestamp - b.timestamp;
    });
    
    // 保留前20名
    const top20 = rankings.slice(0, 20);
    
    // 保存到localStorage
    localStorage.setItem('garbageGameRankings', JSON.stringify(top20));
    
    // 更新排行榜显示
    updateRankingsDisplay();
    
    // 隐藏姓名输入
    elements.nameInputSection.style.display = 'none';
    
    // 显示排行榜
    showRankings();
}

// 获取排行榜
function getRankings() {
    const rankings = localStorage.getItem('garbageGameRankings');
    return rankings ? JSON.parse(rankings) : [];
}

// 更新排行榜显示
function updateRankingsDisplay() {
    const rankings = getRankings();
    elements.rankings.innerHTML = '';
    
    rankings.forEach((item, index) => {
        const rankingItem = document.createElement('div');
        rankingItem.className = 'ranking-item';
        
        const stars = '⭐'.repeat(item.stars);
        const time = (item.time / 1000).toFixed(1);
        
        rankingItem.innerHTML = `
            <div class="rank">${index + 1}</div>
            <div class="player-name">${item.name}</div>
            <div class="player-score">${item.score}分</div>
            <div class="player-stars">${stars}</div>
        `;
        
        elements.rankings.appendChild(rankingItem);
    });
}

// 显示排行榜
function showRankings() {
    elements.rankingModal.classList.add('active');
}

// 隐藏排行榜
function hideRankings() {
    elements.rankingModal.classList.remove('active');
}

// 重新挑战
function restartGame() {
    // 清空所有垃圾桶
    const trashCans = [elements.kitchenTrash, elements.recycleTrash, elements.otherTrash, elements.harmfulTrash];
    trashCans.forEach(can => {
        const garbageElements = can.querySelectorAll('.trash-can-garbage');
        garbageElements.forEach(garbage => garbage.remove());
    });
    
    elements.endPage.classList.remove('active');
    elements.startPage.classList.add('active');
}

// 初始化游戏
window.addEventListener('DOMContentLoaded', initGame);