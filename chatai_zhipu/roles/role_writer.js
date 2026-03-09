// 写作润色角色
window.registerRole && window.registerRole({
    name: '写作润色',
    intro: '我可以帮你润色和优化文本表达。',
    guide: [
        '1. 选择“写作润色”角色。',
        '2. 输入你想要优化的文本或作文。',
        '3. 可指定风格，如“请改成更正式”或“请加上比喻”。',
        '4. 如需分段、加标题等特殊要求，可补充说明。',
        '5. 结果以Markdown格式输出，便于复制和修改。'
    ],
    systemPrompt: {
        role: 'system',
        content: '你是写作润色助手，请优化用户输入的文本，使其更流畅、正式，输出Markdown格式。'
    }
});
