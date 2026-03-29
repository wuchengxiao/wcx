// 思考内容管理器
var ReasoningManager = (function() {
    var instances = new Map();

    function createInstance(bubble) {
        var instance = {
            bubble: bubble,
            reasoningDiv: null,
            toggleBtn: null,
            statusSpan: null,
            content: '',
            collapsed: false,
            hasFormalContent: false
        };

        instance.statusSpan = _util.ce('span');
        instance.statusSpan.className = 'stream-status';
        instance.statusSpan.textContent = '思考中...';
        bubble.appendChild(instance.statusSpan);

        instance.reasoningDiv = _util.ce('div');
        instance.reasoningDiv.className = 'reasoning-content';
        instance.reasoningDiv.textContent = '';
        bubble.insertBefore(instance.reasoningDiv, bubble.firstChild);

        instance.toggleBtn = _util.ce('button');
        instance.toggleBtn.className = 'toggle-reasoning-btn';
        instance.toggleBtn.style.display = 'none';
        instance.toggleBtn.textContent = '展开思考内容';
        instance.toggleBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            instance.collapsed = !instance.collapsed;
            if (instance.collapsed) {
                instance.reasoningDiv.classList.add('collapsed');
                instance.toggleBtn.textContent = '展开思考内容';
            } else {
                instance.reasoningDiv.classList.remove('collapsed');
                instance.toggleBtn.textContent = '收起思考内容';
            }
        });
        bubble.insertBefore(instance.toggleBtn, instance.reasoningDiv.nextSibling);

        return instance;
    }

    return {
        init: function(bubble) {
            var instance = createInstance(bubble);
            instances.set(bubble, instance);
            return instance;
        },

        getInstance: function(bubble) {
            return instances.get(bubble);
        },

        appendReasoning: function(bubble, content) {
            var instance = instances.get(bubble);
            if (!instance || instance.hasFormalContent) return;
            instance.content += content;
            if (instance.reasoningDiv) {
                instance.reasoningDiv.textContent = instance.content;
            }
        },

        showReasoning: function(bubble) {
            var instance = instances.get(bubble);
            if (!instance) return;
            instance.collapsed = false;
            if (instance.reasoningDiv) {
                instance.reasoningDiv.classList.remove('collapsed');
            }
            if (instance.toggleBtn) {
                instance.toggleBtn.textContent = '收起思考内容';
            }
        },

        hideReasoning: function(bubble) {
            var instance = instances.get(bubble);
            if (!instance) return;
            instance.collapsed = true;
            if (instance.reasoningDiv) {
                instance.reasoningDiv.classList.add('collapsed');
            }
            if (instance.toggleBtn) {
                instance.toggleBtn.textContent = '展开思考内容';
            }
        },

        clearReasoning: function(bubble) {
            var instance = instances.get(bubble);
            if (!instance) return;
            instance.content = '';
            if (instance.reasoningDiv) {
                instance.reasoningDiv.textContent = '';
            }
        },

        setFormalContentStarted: function(bubble) {
            var instance = instances.get(bubble);
            if (!instance) return;
            instance.hasFormalContent = true;
            this.hideReasoning(bubble);
            if (instance.toggleBtn) {
                instance.toggleBtn.style.display = '';
            }
        },

        clearStatus: function(bubble) {
            var instance = instances.get(bubble);
            if (!instance) return;
            if (instance.statusSpan) {
                instance.statusSpan.textContent = '';
            }
        },

        destroy: function(bubble) {
            instances.delete(bubble);
        }
    };
})();
