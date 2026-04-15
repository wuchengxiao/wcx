// 封装 requestTextByMessages 为 callLLM，适配 Function Calling 需求

(function() {
  function getRequestContext() {
    const token = window.processinput && window.processinput.processedApiKey
      ? window.processinput.processedApiKey
      : '';
    const url = window.processinput && window.processinput.processedUrl
      ? window.processinput.processedUrl
      : (window.globalTextApiConfig && window.globalTextApiConfig.apiUrl ? window.globalTextApiConfig.apiUrl : '');

    return {
      token,
      url
    };
  }

  function getChoiceDelta(choice) {
    return choice && choice.delta ? choice.delta : null;
  }

  function appendToolCalls(target, incoming) {
    if (!Array.isArray(incoming) || !incoming.length) {
      return target;
    }

    const list = Array.isArray(target) ? target : [];
    incoming.forEach(call => {
      if (!call) {
        return;
      }

      const index = typeof call.index === 'number' ? call.index : list.length;
      if (!list[index]) {
        list[index] = {
          id: call.id || '',
          type: call.type || 'function',
          function: {
            name: call.function && call.function.name ? call.function.name : '',
            arguments: call.function && typeof call.function.arguments === 'string' ? call.function.arguments : ''
          }
        };
      } else {
        if (call.id) {
          list[index].id = call.id;
        }
        if (call.type) {
          list[index].type = call.type;
        }
        if (!list[index].function) {
          list[index].function = {
            name: '',
            arguments: ''
          };
        }
        if (call.function && call.function.name) {
          list[index].function.name = call.function.name;
        }
        if (call.function && typeof call.function.arguments === 'string') {
          list[index].function.arguments += call.function.arguments;
        }
      }
    });

    return list;
  }

  window.callLLM = async function({ messages, tools, token, url }) {
    if (!window.requestTextByMessages) {
      throw new Error('文本请求功能未加载，请刷新页面后重试。');
    }

    const requestContext = getRequestContext();
    const requestToken = token || requestContext.token;
    const requestUrl = url || requestContext.url;
    const payloadMessages = Array.isArray(messages) ? messages : [];

    const generator = window.requestTextByMessages({
      messages: payloadMessages,
      token: requestToken,
      url: requestUrl,
      tools: Array.isArray(tools) ? tools : undefined
    });

    let content = '';
    let toolCalls = null;
    let finishReason = 'stop';

    for await (const chunk of generator) {
      if (!chunk) {
        continue;
      }

      if (chunk.error) {
        throw chunk.error instanceof Error ? chunk.error : new Error(String(chunk.error));
      }

      const choice = chunk.choices && chunk.choices[0] ? chunk.choices[0] : null;
      const delta = getChoiceDelta(choice);

      if (delta && typeof delta.content === 'string') {
        content += delta.content;
      }

      if (delta && Array.isArray(delta.tool_calls)) {
        toolCalls = appendToolCalls(toolCalls, delta.tool_calls);
      }

      if (choice && choice.message && typeof choice.message.content === 'string') {
        content += choice.message.content;
      }

      if (choice && Array.isArray(choice.message && choice.message.tool_calls)) {
        toolCalls = appendToolCalls(toolCalls, choice.message.tool_calls);
      }

      if (choice && choice.finish_reason) {
        finishReason = choice.finish_reason;
      } else if (chunk.finish_reason) {
        finishReason = chunk.finish_reason;
      }
    }

    return {
      content,
      tool_calls: toolCalls,
      finish_reason: toolCalls && toolCalls.length ? (finishReason || 'tool_calls') : finishReason
    };
  };
})();
