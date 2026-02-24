import { AIFeaturesAPI } from '@/lib/api';
import type { 
  AssistantContext, 
  ChatMessage, 
  Suggestion,
  UserIntent,
  AssistantMode,
  AssistantResponse,
  PromptModification
} from '@/types/promptAssistant';

export class AssistantService {
    private projectId: number;
    private promptId: number;
    private promptVersionId: number;

    constructor(projectId: number, promptId: number, promptVersionId: number) {
        this.projectId = projectId;
        this.promptId = promptId;
        this.promptVersionId = promptVersionId;
    }

    /**
     * 分析用户输入，识别意图和模式
     */
    async analyzeUserIntent(userInput: string, context: AssistantContext, signal?: AbortSignal): Promise<{intent: UserIntent, mode: AssistantMode}> {
        const intentAnalysisPrompt = `
分析用户的输入，判断用户的意图和对话模式。

用户输入："${userInput}"

当前提示词上下文：
- 消息数量：${context.currentMessages.length}
- 变量数量：${context.variables.length}  
- 语言模式：${context.language}

请从以下意图中选择最符合的一个，并判断应该使用哪种模式：

意图类型：
- improve_prompt: 改进现有提示词
- create_template: 创建新的提示词模板
- add_variables: 添加或优化变量
- fix_issues: 修复提示词问题
- optimize_performance: 优化性能和效果
- modify_content: 修改具体内容
- restructure_prompt: 重构提示词结构
- general_question: 一般性询问
- consultation: 咨询建议
- explanation: 解释说明

模式判断规则：
- chat模式：用户想要咨询、了解、讨论，不涉及具体修改操作
- agent模式：用户要求助理直接修改、创建、优化提示词内容

返回格式：
{
  "intent": "意图类型",
  "mode": "chat或agent"
}

只返回JSON，不要其他内容。`;

        try {
            const response = await AIFeaturesAPI.callFeature(this.projectId, {
                feature_key: 'prompt_assistant_mini',
                messages: [{ role: 'user', content: intentAnalysisPrompt }],
                temperature: 0.1,
                max_tokens: 100,
                prompt_id: this.promptId,
                prompt_version_id: this.promptVersionId,
            }, signal);

            const result = JSON.parse(response.data.message.trim());
            return {
                intent: result.intent as UserIntent,
                mode: result.mode as AssistantMode
            };
        } catch (error) {
            console.error('Intent analysis failed:', error);
            return {
                intent: 'general_question',
                mode: 'chat'
            };
        }
    }

    /**
     * Chat模式：流式生成回复
     */
    async generateChatResponse(
        userInput: string,
        context: AssistantContext,
        chatHistory: ChatMessage[] = [],
        onStreamUpdate?: (content: string) => void,
        signal?: AbortSignal
    ): Promise<string> {
        const systemPrompt = this.buildChatSystemPrompt(context);

        const conversationMessages = [
            { role: 'system', content: systemPrompt },
            ...chatHistory.slice(-6).map(msg => ({
                role: msg.role,
                content: msg.content
            })),
            { role: 'user', content: userInput }
        ];

        try {
            const result = await AIFeaturesAPI.callFeatureStream(this.projectId, {
                feature_key: 'prompt_assistant_chat',
                messages: conversationMessages,
                temperature: 0.7,
                max_tokens: 2000,
                prompt_id: this.promptId,
                prompt_version_id: this.promptVersionId,
            }, signal, onStreamUpdate);

            return result.content;
        } catch (error) {
            console.error('Chat response generation failed:', error);
            throw error;
        }
    }

    /**
     * Agent模式：生成结构化修改提案
     */
    async generateAgentResponse(
        userInput: string,
        context: AssistantContext,
        intent: UserIntent,
        chatHistory: ChatMessage[] = [],
        signal?: AbortSignal
    ): Promise<AssistantResponse> {
        const systemPrompt = this.buildAgentSystemPrompt(context, intent);

        const conversationMessages = [
            { role: 'system', content: systemPrompt },
            ...chatHistory.slice(-6).map(msg => ({
                role: msg.role,
                content: msg.content
            })),
            { role: 'user', content: userInput }
        ];

        try {
            const response = await AIFeaturesAPI.callFeature(this.projectId, {
                feature_key: 'prompt_assistant_chat',
                messages: conversationMessages,
                temperature: 0.6,
                max_tokens: 2500,
                prompt_id: this.promptId,
                prompt_version_id: this.promptVersionId,
            }, signal);

            const fullResponse = response.data.message;
            return this.parseAgentResponse(fullResponse, context);
        } catch (error) {
            console.error('Agent response generation failed:', error);
            throw error;
        }
    }

    /**
     * 统一的响应生成入口
     */
    async generateResponse(
        userInput: string,
        context: AssistantContext,
        chatHistory: ChatMessage[] = [],
        onStreamUpdate?: (content: string) => void,
        signal?: AbortSignal
    ): Promise<AssistantResponse> {
        const { intent, mode } = await this.analyzeUserIntent(userInput, context, signal);

        if (mode === 'chat') {
            const content = await this.generateChatResponse(
                userInput, 
                context, 
                chatHistory, 
                onStreamUpdate, 
                signal
            );
            
            return {
                mode: 'chat',
                content,
                requiresApproval: false
            };
        } else {
            return await this.generateAgentResponse(
                userInput,
                context,
                intent,
                chatHistory,
                signal
            );
        }
    }

    /**
     * 构建Chat模式的系统提示词
     */
    private buildChatSystemPrompt(context: AssistantContext): string {
        return `你是一个专业的提示词工程师助理，专门帮助用户理解和改进AI提示词。

当前用户的提示词上下文：
- 消息数量：${context.currentMessages.length}
- 当前消息结构：
${context.currentMessages.map((msg, i) => `  ${i + 1}. [${msg.role.toUpperCase()}]: ${msg.content.slice(0, 100)}${msg.content.length > 100 ? '...' : ''}`).join('\n')}
- 变量：${context.variables.join(', ') || '无'}
- 语言模式：${context.language === 'zh' ? '中文' : context.language === 'en' ? '英文' : '中英对照'}

你的职责（Chat模式）：
1. 回答用户关于提示词设计的问题
2. 提供专业的建议和最佳实践
3. 解释提示词工程的概念和技巧
4. 分析现有提示词的优缺点
5. 推荐改进思路和方向

回复要求：
- 用中文回复，语言自然流畅
- 提供具体、可操作的建议
- 保持专业但易懂的语调
- 不要直接提供具体的修改代码，而是提供思路和建议
- 如果用户需要具体修改，建议他们明确表达修改需求`;
    }

    /**
     * 构建Agent模式的系统提示词
     */
    private buildAgentSystemPrompt(context: AssistantContext, intent: UserIntent): string {
        return `你是一个专业的提示词工程师，现在要帮助用户直接修改提示词内容。

当前用户的提示词上下文：
- 消息数量：${context.currentMessages.length}
- 当前消息结构：
${context.currentMessages.map((msg, i) => `  ${i + 1}. [${msg.role.toUpperCase()}]: ${msg.content}`).join('\n')}
- 变量：${context.variables.join(', ') || '无'}
- 语言模式：${context.language === 'zh' ? '中文' : context.language === 'en' ? '英文' : '中英对照'}
- 用户意图：${intent}

你的职责（Agent模式）：
1. 分析用户需求，制定具体的修改方案
2. 生成详细的修改提案，包括具体的操作步骤
3. 提供修改预览和影响评估
4. 确保修改的专业性和有效性

返回格式要求：
你必须返回一个JSON对象，包含以下结构：

{
  "mode": "agent",
  "content": "简要说明你要做什么修改以及为什么",
  "actionProposal": {
    "id": "唯一标识符",
    "title": "修改标题",
    "description": "详细描述",
    "modifications": [
      {
        "id": "修改ID",
        "type": "修改类型",
        "target": {"messageIndex": 索引或其他目标信息},
        "change": {"newContent": "新内容"},
        "reasoning": "修改理由"
      }
    ],
    "confidence": 90,
    "tags": ["相关标签"],
    "estimatedImpact": "high|medium|low",
    "category": "structure|content|variables|optimization"
  },
  "requiresApproval": true
}

修改类型包括：
- add_message: 添加消息
- modify_message: 修改消息内容
- delete_message: 删除消息
- reorder_messages: 重新排序
- add_variable: 添加变量
- modify_variable: 修改变量
- delete_variable: 删除变量

只返回JSON，不要其他格式。`;
    }

    /**
     * 解析Agent模式的响应
     */
    private parseAgentResponse(response: string, context: AssistantContext): AssistantResponse {
        try {
            // 尝试解析JSON响应
            const parsed = JSON.parse(response);
            
            // 验证和补充数据
            if (parsed.actionProposal) {
                parsed.actionProposal.id = parsed.actionProposal.id || `action_${Date.now()}`;
                parsed.actionProposal.modifications = parsed.actionProposal.modifications || [];
                
                // 为每个修改添加预览
                parsed.actionProposal.modifications.forEach((mod: PromptModification) => {
                    if (!mod.preview && mod.type === 'modify_message' && mod.target.messageIndex !== undefined) {
                        const targetMessage = context.currentMessages[mod.target.messageIndex];
                        if (targetMessage && mod.change.newContent) {
                            mod.preview = this.generatePreview(targetMessage.content, mod.change.newContent);
                        }
                    }
                });
            }

            return parsed as AssistantResponse;
        } catch (error) {
            console.error('Failed to parse agent response:', error);
            
            // 降级处理：返回基本的chat模式响应
            return {
                mode: 'chat',
                content: response || '解析响应失败，请重试。',
                requiresApproval: false
            };
        }
    }

    /**
     * 生成修改预览
     */
    private generatePreview(oldContent: string, newContent: string): string {
        // 简单的预览生成，实际可以使用更复杂的diff算法
        if (oldContent.length > 100 || newContent.length > 100) {
            return `修改前：${oldContent.slice(0, 50)}...\n修改后：${newContent.slice(0, 50)}...`;
        }
        return `修改前：${oldContent}\n修改后：${newContent}`;
    }

    /**
     * 生成快速开始建议
     */
    async generateQuickStart(context: AssistantContext, signal?: AbortSignal): Promise<Suggestion[]> {
        if (context.currentMessages.length > 0) {
            return []; // 如果已有内容，不显示快速开始
        }

        const quickStartPrompt = `用户刚开始创建提示词，当前没有任何内容。请生成3个快速开始的建议，涵盖不同的应用场景。

请为每个建议使用以下格式：
\`\`\`suggestion
标题：[建议标题]
类型：template_recommendation
置信度：90
标签：[相关标签]

推理：[为什么推荐这个模板]

具体修改：
[具体的消息内容，包括system和user消息]
\`\`\`

三个建议应该涵盖：
1. 客服助手模板
2. 内容创作助手模板  
3. 代码助手模板`;

        try {
            const response = await AIFeaturesAPI.callFeature(this.projectId, {
                feature_key: 'prompt_assistant_mini',
                messages: [{ role: 'user', content: quickStartPrompt }],
                temperature: 0.8,
                max_tokens: 1500,
                prompt_id: this.promptId,
                prompt_version_id: this.promptVersionId,
            }, signal);

            const { suggestions } = this.parseAssistantResponse(response.data.message, context);
            return suggestions;
        } catch (error) {
            console.error('Quick start generation failed:', error);
            return [];
        }
    }

    /**
     * 解析助理回复，提取建议（保持向后兼容）
     */
    private parseAssistantResponse(
        fullResponse: string,
        _context: AssistantContext
    ): { message: string; suggestions: Suggestion[] } {
        const suggestions: Suggestion[] = [];

        // 提取建议块
        const suggestionRegex = /```suggestion\n([\s\S]*?)\n```/g;
        let match;
        let cleanMessage = fullResponse;

        while ((match = suggestionRegex.exec(fullResponse)) !== null) {
            const suggestionBlock = match[1];
            const suggestion = this.parseSuggestionBlock(suggestionBlock);
            if (suggestion) {
                suggestions.push(suggestion);
            }

            // 从消息中移除建议块
            cleanMessage = cleanMessage.replace(match[0], '');
        }

        return {
            message: cleanMessage.trim(),
            suggestions
        };
    }

    /**
     * 解析单个建议块（保持向后兼容）
     */
    private parseSuggestionBlock(block: string): Suggestion | null {
        try {
            const lines = block.split('\n');
            let title = '';
            let type: Suggestion['type'] = 'prompt_improvement';
            let confidence = 80;
            let tags: string[] = [];
            let reasoning = '';
            let content = '';

            let currentSection = '';

            for (const line of lines) {
                const trimmedLine = line.trim();

                if (trimmedLine.startsWith('标题：')) {
                    title = trimmedLine.replace('标题：', '').trim();
                } else if (trimmedLine.startsWith('类型：')) {
                    const typeStr = trimmedLine.replace('类型：', '').trim();
                    if (['prompt_improvement', 'variable_suggestion', 'template_recommendation', 'structure_optimization'].includes(typeStr)) {
                        type = typeStr as Suggestion['type'];
                    }
                } else if (trimmedLine.startsWith('置信度：')) {
                    const confidenceStr = trimmedLine.replace('置信度：', '').trim();
                    confidence = parseInt(confidenceStr) || 80;
                } else if (trimmedLine.startsWith('标签：')) {
                    const tagsStr = trimmedLine.replace('标签：', '').trim();
                    tags = tagsStr.split(',').map(tag => tag.trim()).filter(tag => tag);
                } else if (trimmedLine.startsWith('推理：')) {
                    reasoning = trimmedLine.replace('推理：', '').trim();
                    currentSection = 'reasoning';
                } else if (trimmedLine.startsWith('具体修改：')) {
                    currentSection = 'content';
                } else if (trimmedLine && currentSection === 'reasoning') {
                    reasoning += ' ' + trimmedLine;
                } else if (trimmedLine && currentSection === 'content') {
                    content += trimmedLine + '\n';
                }
            }

            if (!title || !content.trim()) {
                return null;
            }

            return {
                id: `suggestion_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                type,
                title,
                content: content.trim(),
                reasoning: reasoning.trim(),
                confidence,
                tags,
                isApplied: false,
                mode: 'chat' // 默认为chat模式
            };
        } catch (error) {
            console.error('Failed to parse suggestion block:', error);
            return null;
        }
    }

    /**
     * 生成回复建议 - 基于当前对话上下文
     */
    async generateReplySuggestions(
        context: AssistantContext,
        chatHistory: ChatMessage[] = [],
        signal?: AbortSignal
    ): Promise<string[]> {
        if (chatHistory.length === 0) {
            return [];
        }

        // 只取最近的对话
        const recentMessages = chatHistory.slice(-4);
        const lastAssistantMessage = recentMessages
            .filter(msg => msg.role === 'assistant')
            .pop();

        if (!lastAssistantMessage) {
            return [];
        }

        const suggestionPrompt = `根据以下对话上下文，生成2条用户可能的下一步提问或请求。

对话历史：
${recentMessages.map((msg, _) => `[${msg.role.toUpperCase()}]: ${msg.content}`).join('\n\n')}

当前提示词上下文：
- 消息数量：${context.currentMessages.length}
- 变量：${context.variables.join(', ') || '无'}
- 语言模式：${context.language === 'zh' ? '中文' : context.language === 'en' ? '英文' : '中英对照'}

请生成2条简洁、具体的后续提问，每条在15字以内。要求：
1. 基于助理的最后回复，提出合理的后续问题
2. 关注提示词优化、改进或使用相关的问题
3. 简洁明了，方便点击

格式要求：
只返回2行文本，每行一个建议，不要编号或其他格式。`;

        try {
            const response = await AIFeaturesAPI.callFeature(this.projectId, {
                feature_key: 'prompt_assistant_mini',
                messages: [{ role: 'user', content: suggestionPrompt }],
                temperature: 0.8,
                max_tokens: 100,
                prompt_id: this.promptId,
                prompt_version_id: this.promptVersionId,
            }, signal);

            const suggestions = response.data.message
                .trim()
                .split('\n')
                .filter(line => line.trim())
                .slice(0, 2);

            return suggestions;
        } catch (error) {
            console.error('Reply suggestions generation failed:', error);
            return [];
        }
    }
}

export default AssistantService; 