// 游戏状态
let gameState = {
    isPlaying: false,
    scores: { left: 0, right: 0 },
    currentQuestion: null,
    foodMoving: false,
    foodPositions: { left: 0, right: 0 },
    gameSpeed: 50,
    foodSpeed: 2,
    foodEmojis: ['🍎', '🍌', '🍊', '🍇', '🍓', '🍒', '🍑', '🍍', '🥝', '🥭', '🍉', '🍋']
};

// DOM元素
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');
const startContainer = document.getElementById('startContainer');
const gameControls = document.getElementById('gameControls');
const leftQuestion = document.getElementById('leftQuestion');
const rightQuestion = document.getElementById('rightQuestion');
const leftScore = document.getElementById('leftScore');
const rightScore = document.getElementById('rightScore');
const leftFood = document.querySelector('.left-food');
const rightFood = document.querySelector('.right-food');
const leftMonsterContainer = document.querySelector('.monster-container.left');
const rightMonsterContainer = document.querySelector('.monster-container.right');
const options = document.querySelectorAll('.option');

// 初始化游戏
function initGame() {
    startBtn.addEventListener('click', startGame);
    restartBtn.addEventListener('click', restartGame);
    options.forEach(option => {
        option.addEventListener('click', handleOptionClick);
    });
}

// 开始游戏
function startGame() {
    gameState.isPlaying = true;
    gameState.scores = { left: 0, right: 0 };
    
    // 隐藏开始按钮，显示游戏控件
    startContainer.style.display = 'none';
    gameControls.style.display = 'flex';
    restartBtn.style.display = 'none';
    
    // 更新分数
    updateScores();
    
    // 生成新题目（会自动初始化食物）
    generateQuestion();
}

// 重新开始游戏
function restartGame() {
    // 隐藏游戏控件，显示开始按钮
    gameControls.style.display = 'none';
    startContainer.style.display = 'block';
    restartBtn.style.display = 'none';
    
    // 隐藏食物
    leftFood.style.display = 'none';
    rightFood.style.display = 'none';
    
    // 重置怪兽位置和样式
    leftMonsterContainer.style.left = '50px';
    rightMonsterContainer.style.right = '50px';
    leftMonsterContainer.classList.remove('victory', 'defeat');
    rightMonsterContainer.classList.remove('victory', 'defeat');
    
    // 隐藏胜利特效
    const victoryEffect = document.querySelector('.victory-effect');
    victoryEffect.style.display = 'none';
    victoryEffect.innerHTML = '';
    
    // 重置游戏状态
    gameState.isPlaying = false;
    gameState.foodMoving = false;
    gameState.scores = { left: 0, right: 0 };
    
    // 更新分数
    updateScores();
}

// 生成题目
function generateQuestion() {
    // 生成随机加法题目
    const num1 = Math.floor(Math.random() * 50) + 1;
    const num2 = Math.floor(Math.random() * 50) + 1;
    const correctAnswer = num1 + num2;
    
    // 生成错误选项
    let wrongAnswers = [];
    while (wrongAnswers.length < 2) {
        const wrong = Math.floor(Math.random() * 100) + 1;
        if (wrong !== correctAnswer && !wrongAnswers.includes(wrong)) {
            wrongAnswers.push(wrong);
        }
    }
    
    // 合并选项并随机排序
    const allOptions = [correctAnswer, ...wrongAnswers];
    shuffleArray(allOptions);
    
    // 保存当前题目
    gameState.currentQuestion = {
        question: `${num1} + ${num2} = ?`,
        options: allOptions,
        correctIndex: allOptions.indexOf(correctAnswer)
    };
    
    // 更新UI
    leftQuestion.textContent = gameState.currentQuestion.question;
    rightQuestion.textContent = gameState.currentQuestion.question;
    
    // 更新选项
    updateOptions();
    
    // 初始化食物
    startFoodMovement();
}

// 更新选项
function updateOptions() {
    // 更新左边选项
    for (let i = 0; i < 3; i++) {
        const leftOption = options[i];
        const rightOption = options[i + 3];
        
        leftOption.textContent = gameState.currentQuestion.options[i];
        rightOption.textContent = gameState.currentQuestion.options[i];
        
        // 重置选项样式
        leftOption.className = 'option';
        rightOption.className = 'option';
        
        // 启用选项
        leftOption.disabled = false;
        rightOption.disabled = false;
    }
}

// 选项点击处理
function handleOptionClick(event) {
    if (!gameState.isPlaying) return;
    
    const player = event.target.dataset.player;
    const optionIndex = parseInt(event.target.dataset.option);
    const isCorrect = optionIndex === gameState.currentQuestion.correctIndex;
    
    // 停止食物移动
    clearInterval(gameState.foodTimer);
    
    // 处理两边玩家的选项
    ['left', 'right'].forEach(p => {
        const playerOptions = document.querySelectorAll(`.question-area.${p} .option`);
        
        // 更新所有选项样式
        playerOptions.forEach((option, index) => {
            if (index === gameState.currentQuestion.correctIndex) {
                option.classList.add('correct');
            } else {
                option.classList.add('incorrect');
            }
            option.disabled = true;
        });
    });
    
    // 如果答对了
    if (isCorrect) {
        // 移动怪兽吃食物
        eatFood(player);
        
        // 增加星星
        gameState.scores[player] += 1;
        updateScores();
        
        // 检查游戏是否结束
        if (gameState.scores[player] >= 5) {
            endGame();
            return;
        }
    }
    
    // 2秒后生成新题目和食物
    setTimeout(() => {
        // 重置怪兽位置
        leftMonsterContainer.style.left = '50px';
        rightMonsterContainer.style.right = '50px';
        
        // 生成新题目
        generateQuestion();
        
        // 启用选项
        options.forEach(option => {
            option.disabled = false;
            option.classList.remove('correct', 'incorrect');
        });
    }, 2000);
}

// 开始食物移动
function startFoodMovement() {
    // 从foodEmojis中随机选择食物
    const leftFoodEmoji = gameState.foodEmojis[Math.floor(Math.random() * gameState.foodEmojis.length)];
    const rightFoodEmoji = gameState.foodEmojis[Math.floor(Math.random() * gameState.foodEmojis.length)];
    
    // 设置食物内容
    leftFood.textContent = leftFoodEmoji;
    rightFood.textContent = rightFoodEmoji;
    
    // 显示食物
    leftFood.style.display = 'block';
    rightFood.style.display = 'block';
    
    // 重置食物位置
    gameState.foodPositions.left = 100;
    gameState.foodPositions.right = 100;
    leftFood.style.left = '100px';
    rightFood.style.left = '600px'; // 直接设置左边距离，便于移动
    
    // 开始移动
    gameState.foodMoving = true;
    gameState.foodTimer = setInterval(() => {
        moveFood();
    }, gameState.gameSpeed);
}

// 移动食物
function moveFood() {
    // 移动左边食物（向右）
    gameState.foodPositions.left += gameState.foodSpeed;
    leftFood.style.left = gameState.foodPositions.left + 'px';
    
    // 移动右边食物（向左）
    gameState.foodPositions.right += gameState.foodSpeed;
    rightFood.style.left = (700 - gameState.foodPositions.right) + 'px'; // 调整为700以适应容器宽度
    
    // 检查是否到达城堡（中间位置）
    const castleCenter = 400; // 城堡在中间位置
    const castleWidth = 60; // 城堡宽度的一半
    
    // 左边食物到达城堡的判断
    if (gameState.foodPositions.left + 30 >= castleCenter - castleWidth) { // 30是食物宽度
        leftFood.style.display = 'none';
    }
    
    // 右边食物到达城堡的判断
    if (700 - gameState.foodPositions.right <= castleCenter + castleWidth) {
        rightFood.style.display = 'none';
    }
    
    // 如果两个食物都消失了
    if (leftFood.style.display === 'none' && rightFood.style.display === 'none') {
        // 停止食物移动
        clearInterval(gameState.foodTimer);
        gameState.foodMoving = false;
        
        // 生成新题目
        generateQuestion();
    }
}

// 吃食物
function eatFood(player) {
    const food = player === 'left' ? leftFood : rightFood;
    const monsterContainer = player === 'left' ? leftMonsterContainer : rightMonsterContainer;
    
    // 获取食物位置
    const foodPosition = player === 'left' ? gameState.foodPositions.left : gameState.foodPositions.right;
    
    // 移动怪兽到食物位置
    if (player === 'left') {
        monsterContainer.style.left = foodPosition - 50 + 'px';
    } else {
        monsterContainer.style.right = foodPosition - 50 + 'px';
    }
    
    // 隐藏食物
    food.style.display = 'none';
    
    // 2秒后重置怪兽位置
    setTimeout(() => {
        if (player === 'left') {
            monsterContainer.style.left = '50px';
        } else {
            monsterContainer.style.right = '50px';
        }
    }, 2000);
}

// 更新分数
function updateScores() {
    // 更新左边怪兽的星星
    const leftStars = leftScore.querySelectorAll('.star');
    leftStars.forEach((star, index) => {
        if (index < gameState.scores.left) {
            star.classList.add('active');
        } else {
            star.classList.remove('active');
        }
    });
    
    // 更新右边怪兽的星星
    const rightStars = rightScore.querySelectorAll('.star');
    rightStars.forEach((star, index) => {
        if (index < gameState.scores.right) {
            star.classList.add('active');
        } else {
            star.classList.remove('active');
        }
    });
}

// 结束游戏
function endGame() {
    gameState.isPlaying = false;
    clearInterval(gameState.foodTimer);
    
    // 确定获胜方
    const winner = gameState.scores.left >= 5 ? 'left' : 'right';
    
    // 显示胜利特效
    showVictoryEffect(winner);
    
    // 显示重新开始按钮
    restartBtn.style.display = 'block';
    
    // 隐藏食物
    leftFood.style.display = 'none';
    rightFood.style.display = 'none';
}

// 工具函数：打乱数组
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// 显示胜利特效
function showVictoryEffect(winner) {
    const victoryEffect = document.querySelector('.victory-effect');
    const losingSide = winner === 'left' ? 'right' : 'left';
    const winnerContainer = winner === 'left' ? leftMonsterContainer : rightMonsterContainer;
    const loserContainer = losingSide === 'left' ? leftMonsterContainer : rightMonsterContainer;
    
    // 显示胜利特效容器
    victoryEffect.style.display = 'block';
    victoryEffect.innerHTML = '';
    
    // 1. 显示胜利文字
    const victoryText = document.createElement('div');
    victoryText.className = 'victory-text';
    victoryText.textContent = winner === 'left' ? '左边怪兽获胜！' : '右边怪兽获胜！';
    victoryEffect.appendChild(victoryText);
    
    // 2. 创建胜利光环
    const victoryHalo = document.createElement('div');
    victoryHalo.className = `victory-halo ${winner}`;
    victoryEffect.appendChild(victoryHalo);
    
    // 3. 创建爆炸粒子效果
    createParticles(victoryEffect, winner);
    
    // 4. 为获胜怪兽添加胜利动画
    winnerContainer.classList.add('victory');
    
    // 5. 为失败怪兽添加失败动画
    loserContainer.classList.add('defeat');
}

// 创建粒子效果
function createParticles(container, winner) {
    const particleCount = 30;
    const colors = ['#ffd700', '#ffeb3b', '#ffc107', '#ff9800'];
    const startX = winner === 'left' ? 100 : 700;
    
    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'victory-particle';
        
        // 设置初始位置（获胜怪兽的位置）
        particle.style.left = startX + 'px';
        particle.style.top = '150px';
        particle.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        
        container.appendChild(particle);
        
        // 计算随机方向和距离
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * 100 + 50;
        const targetX = startX + Math.cos(angle) * distance;
        const targetY = 150 + Math.sin(angle) * distance;
        
        // 动画粒子
        animateParticle(particle, targetX, targetY);
    }
}

// 动画粒子
function animateParticle(particle, targetX, targetY) {
    const duration = 1000 + Math.random() * 1000;
    const startTime = performance.now();
    const startX = parseInt(particle.style.left);
    const startY = parseInt(particle.style.top);
    
    function updateParticle(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // 使用缓动函数
        const easeOut = 1 - Math.pow(1 - progress, 3);
        
        // 计算当前位置
        const currentX = startX + (targetX - startX) * easeOut;
        const currentY = startY + (targetY - startY) * easeOut;
        
        // 更新粒子位置
        particle.style.left = currentX + 'px';
        particle.style.top = currentY + 'px';
        
        // 更新透明度
        particle.style.opacity = 1 - progress;
        
        if (progress < 1) {
            requestAnimationFrame(updateParticle);
        } else {
            // 移除粒子
            particle.remove();
        }
    }
    
    requestAnimationFrame(updateParticle);
}

// 初始化游戏
document.addEventListener('DOMContentLoaded', initGame);