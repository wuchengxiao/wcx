// 示例入口，集成 Function Calling 流程（纯静态页面版）

window.onUserSendMessage = async function(userInput, history) {
    const messages = (Array.isArray(history) ? history : []).concat({
        role: 'user',
        content: userInput
    });

    const reply = await window.chatWithFunctionCalling(messages, {
        callLLM: window.callLLM,
        tools: window.llmTools
    });

    return reply.content;
};
