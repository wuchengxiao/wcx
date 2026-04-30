
// 定义可用的工具（函数调用）
window.enableFunctionCalling = true;// 是否启用函数调用功能 

window.llmTools = [
    {
        type: 'function',
        function: {
            name: 'web_search',
            description: '通过互联网搜索获取最新信息',
            parameters: {
                type: 'object',
                properties: {
                    query: {
                        type: 'string',
                        description: '要搜索的内容'
                    }
                },
                required: ['query']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'generate_image',
            description: '根据用户描述生成图片',
            parameters: {
                type: 'object',
                properties: {
                    prompt: {
                        type: 'string',
                        description: '图片描述'
                    }
                },
                required: ['prompt']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'agent_drawing',
            description: '插画师智能体，根据用户描述生成图片。',
            parameters: {
                type: 'object',
                properties: {
                    query: {
                        type: 'string',
                        description: '用户的问题或查询内容'
                    }
                },
                required: ['query']
            }
        }
    }
];
