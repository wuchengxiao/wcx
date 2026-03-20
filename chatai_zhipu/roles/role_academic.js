// 学术助手角色
window.registerRole && window.registerRole({
    name: '学术助手',
    intro: '我可以帮你解答学术问题，提供简明解释。',
    guide: [
        '1. 选择“学术助手”角色。',
        '2. 输入你想要了解的学科问题或知识点。',
        '3. 可要求举例、公式推导或简明解释。',
        '4. 如需更详细讲解，可补充“请详细讲解”或“请举例说明”。',
        '5. 结果支持Markdown公式和列表，便于理解。'
    ],
    systemPrompt: {
        role: 'system',
        content: '你是学术问答助手，回答要简明、准确，支持Markdown公式和列表。'
    }
});
