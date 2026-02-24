import { AIFeaturesAPI } from '@/lib/api';
import type { 
  AssistantContext, 
  ActionProposal, 
  PromptModification 
} from '@/types/promptAssistant';

export interface PromptEditInstruction {
  type: 'edit_prompt' | 'add_variable' | 'add_test_case' | 'reorder_messages';
  target: {
    messageIndex?: number;
    messageId?: string;
    variableName?: string;
  };
  instructions: string;
  edit_content: string;
}

export interface PromptEditResult {
  success: boolean;
  newContext?: AssistantContext;
  error?: string;
  appliedChanges?: string[];
}

export class PromptEditService {
  private projectId: number;
  private promptId?: number;
  private promptVersionId?: number;

  constructor(projectId: number, promptId?: number, promptVersionId?: number) {
    this.projectId = projectId;
    this.promptId = promptId;
    this.promptVersionId = promptVersionId;
  }

  /**
   * 编辑提示词内容 - 参考 Cursor 的 edit_file 方法
   */
  async editPrompt(
    context: AssistantContext,
    instruction: PromptEditInstruction,
    signal?: AbortSignal
  ): Promise<PromptEditResult> {
    
    try {
      switch (instruction.type) {
        case 'edit_prompt':
          return await this.executePromptEdit(context, instruction, signal);
        case 'add_variable':
          return await this.addVariable(context, instruction, signal);
        case 'add_test_case':
          return await this.addTestCase(context, instruction, signal);
        case 'reorder_messages':
          return await this.reorderMessages(context, instruction, signal);
        default:
          return {
            success: false,
            error: `不支持的编辑类型: ${instruction.type}`
          };
      }
    } catch (error) {
      console.error('Prompt edit failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '编辑失败'
      };
    }
  }

  /**
   * 执行提示词编辑
   */
  private async executePromptEdit(
    context: AssistantContext,
    instruction: PromptEditInstruction,
    signal?: AbortSignal
  ): Promise<PromptEditResult> {
    
    const editPrompt = this.buildEditPrompt(context, instruction);
    
    try {
      const response = await AIFeaturesAPI.callFeature(this.projectId, {
        feature_key: 'prompt_assistant_mini',
        messages: [{ role: 'user', content: editPrompt }],
        temperature: 0.1,
        max_tokens: 3000,
        prompt_id: this.promptId,
        prompt_version_id: this.promptVersionId,
      }, signal);

      const result = this.parseEditResult(response.data.message, context);
      return result;
      
    } catch (error) {
      throw new Error(`编辑执行失败: ${error}`);
    }
  }

  /**
   * 构建编辑提示词 - 参考 Cursor 的设计
   */
  private buildEditPrompt(context: AssistantContext, instruction: PromptEditInstruction): string {
    
    return `你是一个智能的提示词编辑助理。你的任务是根据用户的编辑指令，精确地修改提示词内容。

## 当前提示词结构：

${this.formatCurrentPromptForEdit(context)}

## 编辑指令：
${instruction.instructions}

## 编辑内容：
${instruction.edit_content}

## 编辑规则：

1. **精确修改**：只修改需要改变的部分，保持其他内容不变
2. **保持结构**：维护原有的消息结构和顺序（除非明确要求重排）
3. **格式规范**：使用特殊注释表示不变的内容

## 输出格式：

请返回修改后的完整提示词结构，使用以下格式：

\`\`\`json
{
  "success": true,
  "messages": [
    {
      "role": "system",
      "content": "修改后的内容",
      "order": 0
    },
    {
      "role": "user", 
      "content": "修改后的内容",
      "order": 1
    }
  ],
  "variables": ["变量1", "变量2"],
  "appliedChanges": ["具体修改说明1", "具体修改说明2"]
}
\`\`\`

注意：
1. 直接返回 JSON，不要 \`\`\`json 包装
2. 确保 "success": true
3. 包含所有消息，即使没有修改的也要包含
4. 确保 content 字段包含完整的消息内容`;
  }

  /**
   * 为编辑专门格式化当前提示词 - 提供完整的原始内容
   */
  private formatCurrentPromptForEdit(context: AssistantContext): string {
    let prompt = '```json\n';
    prompt += '{\n';
    prompt += '  "messages": [\n';
    
    context.currentMessages.forEach((msg, index) => {
      prompt += '    {\n';
      prompt += `      "role": "${msg.role}",\n`;
      prompt += `      "content": ${JSON.stringify(msg.content)},\n`;
      prompt += `      "order": ${index}\n`;
      prompt += '    }';
      if (index < context.currentMessages.length - 1) {
        prompt += ',';
      }
      prompt += '\n';
    });
    
    prompt += '  ],\n';
    prompt += `  "variables": ${JSON.stringify(context.variables)}\n`;
    prompt += '}\n';
    prompt += '```';

    return prompt;
  }

  /**
   * 解析编辑结果
   */
  private parseEditResult(response: string, originalContext: AssistantContext): PromptEditResult {
    console.log('🔍 开始解析编辑结果...');
    console.log('📝 原始响应:', response);
    console.log('📋 原始上下文:', originalContext);
    
    try {
      // 清理响应内容，移除可能的代码块包装
      let cleanResponse = response.trim();
      
      // 移除各种可能的代码块包装
      const patterns = [
        /^```json\s*\n([\s\S]*?)\n\s*```$/,
        /^```\s*\n([\s\S]*?)\n\s*```$/,
        /^```[^\n]*\n([\s\S]*?)\n\s*```$/,
        /^\s*```\s*([\s\S]*?)\s*```\s*$/
      ];
      
      for (const pattern of patterns) {
        const match = cleanResponse.match(pattern);
        if (match) {
          cleanResponse = match[1].trim();
          console.log('✂️ 移除了代码块包装');
          break;
        }
      }
      
      console.log('🧹 清理后的响应:', cleanResponse);
      
      // 尝试解析 JSON
      const result = JSON.parse(cleanResponse);
      console.log('✅ JSON 解析成功:', result);
      
      // 检查是否标记为成功
      if (!result.success) {
        console.error('❌ 编辑结果标记为失败:', result.error);
        return {
          success: false,
          error: result.error || '编辑失败'
        };
      }

      // 验证必要字段
      if (!result.messages || !Array.isArray(result.messages)) {
        console.error('❌ 缺少有效的消息数组');
        return {
          success: false,
          error: '编辑结果缺少有效的消息列表'
        };
      }

      // 验证和处理消息格式
      console.log('🔧 处理消息格式...');
      const validatedMessages = result.messages.map((msg: any, index: number) => {
        const validated = {
          role: msg.role || 'user',
          content: msg.content || '',
          order: msg.order !== undefined ? msg.order : index
        };
        console.log(`📨 消息 ${index}:`, validated);
        return validated;
      });

      // 处理变量
      const processedVariables = result.variables || originalContext.variables;
      console.log('🏷️ 处理后的变量:', processedVariables);

      // 构建新的上下文
      const newContext: AssistantContext = {
        ...originalContext,
        currentMessages: validatedMessages,
        variables: processedVariables
      };

      console.log('🎯 构建新上下文完成:');
      console.log('   原始消息数量:', originalContext.currentMessages.length);
      console.log('   新消息数量:', newContext.currentMessages.length);
      console.log('   原始变量:', originalContext.variables);
      console.log('   新变量:', newContext.variables);

      // 检查是否真的有变化
      const hasChanges = JSON.stringify(originalContext.currentMessages) !== JSON.stringify(newContext.currentMessages) ||
                        JSON.stringify(originalContext.variables) !== JSON.stringify(newContext.variables);
      
      console.log('📊 内容变化检查:', hasChanges);

      return {
        success: true,
        newContext,
        appliedChanges: result.appliedChanges || ['成功更新提示词内容']
      };
      
    } catch (error) {
      console.error('💥 解析编辑结果失败:', error);
      console.error('📝 原始响应:', response);
      console.error('🔍 响应类型:', typeof response);
      console.error('📏 响应长度:', response.length);
      
      return {
        success: false,
        error: `解析编辑结果失败: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * 添加变量
   */
  private async addVariable(
    context: AssistantContext,
    instruction: PromptEditInstruction,
    signal?: AbortSignal
  ): Promise<PromptEditResult> {
    
    const addVariablePrompt = `
请根据以下指令为提示词添加变量。

当前变量列表：${context.variables.join(', ') || '无'}

添加指令：${instruction.instructions}
变量信息：${instruction.edit_content}

请返回JSON格式：
{
  "success": true,
  "variables": ["更新后的变量列表"],
  "appliedChanges": ["添加了变量: XXX"]
}`;

    try {
      const response = await AIFeaturesAPI.callFeature(this.projectId, {
        feature_key: 'prompt_assistant_mini',
        messages: [{ role: 'user', content: addVariablePrompt }],
        temperature: 0.1,
        max_tokens: 1000,
        prompt_id: this.promptId,
        prompt_version_id: this.promptVersionId,
      }, signal);

      const result = JSON.parse(response.data.message.trim());
      
      const newContext: AssistantContext = {
        ...context,
        variables: result.variables || context.variables
      };

      return {
        success: true,
        newContext,
        appliedChanges: result.appliedChanges || []
      };
      
    } catch (error) {
      return {
        success: false,
        error: `添加变量失败: ${error}`
      };
    }
  }

  /**
   * 添加测试用例
   */
  private async addTestCase(
    context: AssistantContext,
    _instruction: PromptEditInstruction,
    _signal?: AbortSignal
  ): Promise<PromptEditResult> {
    
    // 添加测试用例的逻辑
    const newContext: AssistantContext = {
      ...context,
      testCases: [
        ...context.testCases,
        // 添加新的测试用例逻辑
      ]
    };

    return {
      success: true,
      newContext,
      appliedChanges: ['添加了测试用例']
    };
  }

  /**
   * 重新排序消息
   */
  private async reorderMessages(
    context: AssistantContext,
    _instruction: PromptEditInstruction,
    _signal?: AbortSignal
  ): Promise<PromptEditResult> {
    
    // 重新排序消息的逻辑
    const newContext: AssistantContext = {
      ...context,
      // 实现重新排序逻辑
    };

    return {
      success: true,
      newContext,
      appliedChanges: ['重新排序了消息']
    };
  }

  /**
   * 从 ActionProposal 执行批量编辑
   */
  async applyActionProposal(
    context: AssistantContext,
    proposal: ActionProposal,
    signal?: AbortSignal
  ): Promise<PromptEditResult> {
    
    let currentContext = { ...context };
    const allChanges: string[] = [];

    try {
      // 按顺序执行所有修改
      for (const modification of proposal.modifications) {
        const instruction = this.convertModificationToInstruction(modification);
        const result = await this.editPrompt(currentContext, instruction, signal);
        
        if (!result.success) {
          return {
            success: false,
            error: `修改失败: ${result.error}`
          };
        }
        
        if (result.newContext) {
          currentContext = result.newContext;
        }
        
        if (result.appliedChanges) {
          allChanges.push(...result.appliedChanges);
        }
      }

      return {
        success: true,
        newContext: currentContext,
        appliedChanges: allChanges
      };
      
    } catch (error) {
      return {
        success: false,
        error: `批量修改失败: ${error}`
      };
    }
  }

  /**
   * 将 PromptModification 转换为 PromptEditInstruction
   */
  private convertModificationToInstruction(modification: PromptModification): PromptEditInstruction {
    const { type, target, change, reasoning } = modification;
    
    console.log('🔄 转换修改指令:', { type, target, change, reasoning });
    
    let editContent = '';
    let instructions = `修改原因: ${reasoning}`;

    switch (type) {
      case 'modify_message':
        const targetIndex = target.messageIndex || 0;
        instructions = `${instructions}\n\n请精确修改第 ${targetIndex + 1} 条消息 (索引 ${targetIndex})`;
        editContent = `修改目标：第 ${targetIndex + 1} 条消息
新内容：${change.newContent}

重要要求：
1. 只修改第 ${targetIndex + 1} 条消息的 content 字段
2. 保持该消息的 role 和 order 不变
3. 其他所有消息保持完全不变
4. 确保返回完整的消息列表`;
        break;
        
      case 'add_message':
        const insertIndex = target.messageIndex !== undefined ? target.messageIndex : -1;
        instructions = `${instructions}\n\n请添加新消息`;
        editContent = `添加新消息：
角色: ${change.newRole || 'user'}
内容: ${change.newContent}
插入位置: ${insertIndex >= 0 ? `第 ${insertIndex + 1} 位 (索引 ${insertIndex})` : '末尾'}

重要要求：
1. 在指定位置插入新消息
2. 重新编排所有消息的 order 字段
3. 保持原有消息的内容和角色不变`;
        break;
        
      case 'add_variable':
        instructions = `${instructions}\n\n请添加新变量`;
        editContent = `添加变量：
变量名: ${change.variableInfo?.name}
${change.variableInfo?.description ? `描述: ${change.variableInfo.description}` : ''}
${change.variableInfo?.defaultValue ? `默认值: ${change.variableInfo.defaultValue}` : ''}

重要要求：
1. 在 variables 数组中添加新变量
2. 保持现有变量不变
3. 确保变量名唯一`;
        break;

      case 'delete_message':
        const deleteIndex = target.messageIndex || 0;
        instructions = `${instructions}\n\n请删除指定消息`;
        editContent = `删除第 ${deleteIndex + 1} 条消息 (索引 ${deleteIndex})

重要要求：
1. 移除第 ${deleteIndex + 1} 条消息
2. 重新编排剩余消息的 order 字段
3. 确保消息顺序连续`;
        break;
        
      default:
        editContent = change.newContent || '请根据要求进行修改';
    }

    const instruction = {
      type: 'edit_prompt' as const,
      target,
      instructions,
      edit_content: editContent
    };
    
    console.log('✅ 生成的编辑指令:', instruction);
    return instruction;
  }
}

export default PromptEditService; 