// 图片相关功能模块
var assistantImageUrls = []; 

// 检测文本中的图片URL
function extractImageUrls(text) {
    const imageRegex = /https?:\/\/[^\s<>"']*\.(?:jpg|jpeg|png|gif|webp|bmp)/gi;
    const urls = text.match(imageRegex) || [];
    urls.forEach(url => {
        if (!assistantImageUrls.includes(url)) {
            assistantImageUrls.push(url);
        }
    });
}

// 创建图片预览区域
function createImagePreviewArea() {
    if (!assistantImageUrls || assistantImageUrls.length === 0) {
        return null;
    }
    console.log('创建图片预览区域，URL列表:', assistantImageUrls);
    const imageContainer = _util.ce('div');
    imageContainer.className = 'image-preview-container';
    const label = _util.ce('div');
    label.className = 'image-preview-label';
    label.textContent = '图片预览：';
    imageContainer.appendChild(label);
    const imagesWrapper = _util.ce('div');
    imagesWrapper.className = 'images-wrapper';
    assistantImageUrls.forEach(url => {
        const imageItem = _util.ce('div');
        imageItem.className = 'image-item';
        const img = _util.ce('img');
        img.src = url;
        img.alt = '预览图片';
        img.addEventListener('click', function() {
            openImageFullscreen(url);
        });
        imageItem.appendChild(img);
        imagesWrapper.appendChild(imageItem);
    });
    imageContainer.appendChild(imagesWrapper);
    assistantImageUrls = []; // 清空URL列表，避免重复添加
    return imageContainer;
}

// 图片全屏预览
function openImageFullscreen(imageUrl) {
    const fullscreenContainer = _util.ce('div');
    fullscreenContainer.style.position = 'fixed';
    fullscreenContainer.style.top = '0';
    fullscreenContainer.style.left = '0';
    fullscreenContainer.style.width = '100%';
    fullscreenContainer.style.height = '100%';
    fullscreenContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.95)';
    fullscreenContainer.style.display = 'flex';
    fullscreenContainer.style.alignItems = 'center';
    fullscreenContainer.style.justifyContent = 'center';
    fullscreenContainer.style.zIndex = '10001';
    const img = _util.ce('img');
    img.src = imageUrl;
    img.style.maxWidth = '90%';
    img.style.maxHeight = '90%';
    img.style.objectFit = 'contain';
    _util.ac(fullscreenContainer, img);
    fullscreenContainer.addEventListener('click', function() {
      _util.bodyRc(fullscreenContainer);
    });
    _util.bodyAc(fullscreenContainer);
}

// 导出
window.extractImageUrls = extractImageUrls;
window.createImagePreviewArea = createImagePreviewArea;
window.openImageFullscreen = openImageFullscreen;