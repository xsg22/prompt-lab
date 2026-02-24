import { useState, useRef, useEffect, useCallback } from 'react';
import { message } from 'antd';

import AssistantService from '../services/assistantService';
import PromptEditService from '../services/promptEditService';
import type { 
  AssistantContext, 
  ChatMessage, 
  AssistantState,
  AssistantMode} from '@/types/promptAssistant';

interface UsePromptAssistantOptions {
  projectId: number;
  promptId: number;
  promptVersionId: number;
  context: AssistantContext;
  defaultMode?: AssistantMode;
  onContextUpdate?: (newContext: AssistantContext) => void;
}

export function usePromptAssistant({
  projectId,
  promptId,
  promptVersionId,
  context,
  defaultMode = 'chat',
  onContextUpdate
}: UsePromptAssistantOptions) {
  
  // 翻译
  
  
  // 状态管理
  const [state, setState] = useState<AssistantState>({
    messages: [],
    suggestions: [],
    isLoading: false,
    isThinking: false,
    currentSuggestion: null,
    mode: defaultMode,
    isStreaming: false,
    pendingActions: [],
    replySuggestions: [],
    isLoadingSuggestions: false,
    shouldGenerateSuggestions: false // 初始化为false
  });

  // 服务实例
  const assistantService = useRef<AssistantService | null>(null);
  const promptEditService = useRef<PromptEditService | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  // 添加 AbortController 引用
  const abortControllerRef = useRef<AbortController | null>(null);
  // 当前流式响应的消息ID
  const streamingMessageRef = useRef<string | null>(null);

  // 初始化服务
  useEffect(() => {
    assistantService.current = new AssistantService(projectId, promptId, promptVersionId);
    promptEditService.current = new PromptEditService(projectId, promptId, promptVersionId);
    setIsInitialized(true);
  }, [projectId, promptId, promptVersionId]);

  // 取消当前请求
  const cancelRequest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      
      // 如果正在流式响应，更新流式消息内容为停止提示
      if (streamingMessageRef.current) {
        setState(prev => {
          const updatedMessages = prev.messages.map(msg => 
            msg.id === streamingMessageRef.current 
              ? { 
                  ...msg, 
                  content: msg.content || '已停止内容生成', // 保留已生成的内容，如果没有内容则显示停止提示
                  isStreaming: false // 关键：将消息的isStreaming设置为false
                }
              : msg
          );
          
          return {
            ...prev,
            messages: updatedMessages,
            isLoading: false,
            isThinking: false,
            isStreaming: false,
            shouldGenerateSuggestions: true // 标记需要生成建议
          };
        });
        
        streamingMessageRef.current = null;
        
      } else {
        // 添加"已停止内容生成"的助理消息
        const cancelMessage: ChatMessage = {
          id: `assistant_${Date.now()}`,
          role: 'assistant',
          content: '已停止内容生成',
          timestamp: new Date(),
          isStreaming: false // 确保新消息不是流式状态
        };
        
        setState(prev => {
          const updatedMessages = [...prev.messages, cancelMessage];
          
          return {
            ...prev,
            messages: updatedMessages,
            isLoading: false,
            isThinking: false,
            isStreaming: false,
            shouldGenerateSuggestions: true // 标记需要生成建议
          };
        });
      }
    }
  }, []);

  // 切换模式
  const switchMode = useCallback((mode: AssistantMode) => {
    setState(prev => ({ ...prev, mode }));
  }, []);

  // 处理流式更新
  const handleStreamUpdate = useCallback((content: string) => {
    setState(prev => ({
      ...prev,
      messages: prev.messages.map(msg => 
        msg.id === streamingMessageRef.current 
          ? { ...msg, content, streamingContent: content }
          : msg
      )
    }));
  }, []);

  // 生成回复建议
  const generateReplySuggestions = useCallback(async (messages: ChatMessage[]) => {
    if (!assistantService.current || messages.length === 0) return;
    
    setState(prev => ({ ...prev, isLoadingSuggestions: true }));
    
    // 创建独立的 AbortController 用于建议生成
    const suggestionAbortController = new AbortController();
    
    try {
      const suggestions = await assistantService.current!.generateReplySuggestions(
        context,
        messages,
        suggestionAbortController.signal
      );
      
      // 检查是否被取消
      if (suggestionAbortController.signal.aborted) {
        return;
      }
      
      setState(prev => ({
        ...prev,
        replySuggestions: suggestions,
        isLoadingSuggestions: false
      }));
    } catch (error) {
      // 检查是否因为取消导致的错误
      if (suggestionAbortController.signal.aborted) {
        console.log('Reply suggestions generation was cancelled');
        return;
      }
      
      console.error('Failed to generate reply suggestions:', error);
      setState(prev => ({
        ...prev,
        replySuggestions: [],
        isLoadingSuggestions: false
      }));
    }
  }, [context]);

  // 监听shouldGenerateSuggestions标记，取消操作后生成回复建议
  useEffect(() => {
    if (state.shouldGenerateSuggestions && !state.isLoading && !state.isThinking) {
      // 重置标记并生成建议
      setState(prev => ({ ...prev, shouldGenerateSuggestions: false }));
      generateReplySuggestions(state.messages);
    }
  }, [state.shouldGenerateSuggestions, state.isLoading, state.isThinking, state.messages, generateReplySuggestions]);

  // 发送消息 - 支持双模式
  const sendMessage = useCallback(async (userInput: string) => {
    if (!assistantService.current || !userInput.trim()) return;
    
    // 取消之前的请求
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }

        console.log('🚀 开始发送消息:', userInput);
        
        // 创建新的 AbortController
        abortControllerRef.current = new AbortController();
        const signal = abortControllerRef.current.signal;
        
        // 添加用户消息
        const userMessage: ChatMessage = {
          id: `user_${Date.now()}`,
          role: 'user',
          content: userInput,
          timestamp: new Date(),
          type: 'text',
          mode: state.mode
        };

        const messagesWithUser = [...state.messages, userMessage];

        setState(prev => ({ 
          ...prev, 
          messages: messagesWithUser,
          isLoading: true, 
          isThinking: true,
          replySuggestions: [],
          isLoadingSuggestions: false
        }));

        try {
      // 生成助理回复
      const response = await assistantService.current!.generateResponse(
        userInput,
        context,
        messagesWithUser,
        handleStreamUpdate,
        signal
      );

      // 检查是否被取消
      if (signal.aborted) {
        return;
      }

      // 处理不同模式的响应
      if (response.mode === 'chat') {
        // Chat模式：直接添加文本回复
        const assistantChatMessage: ChatMessage = {
          id: `assistant_${Date.now()}`,
          role: 'assistant',
          content: response.content,
          timestamp: new Date(),
          type: 'text',
          mode: 'chat'
        };

        const finalMessages = [...messagesWithUser, assistantChatMessage];
        
        setState(prev => ({
          ...prev,
          messages: finalMessages,
          isLoading: false,
          isThinking: false,
          isStreaming: false
        }));

        // 生成回复建议
        generateReplySuggestions(finalMessages);

      } else {
        // Agent模式：添加动作提案
        const assistantActionMessage: ChatMessage = {
          id: `assistant_${Date.now()}`,
          role: 'assistant',
          content: response.content,
          timestamp: new Date(),
          type: 'action_proposal',
          mode: 'agent'
        };

        const finalMessages = [...messagesWithUser, assistantActionMessage];
        
        setState(prev => ({
          ...prev,
          messages: finalMessages,
          pendingActions: response.actionProposal ? [response.actionProposal] : [],
          isLoading: false,
          isThinking: false,
          isStreaming: false
        }));
      }

      // 清除 AbortController 引用
      abortControllerRef.current = null;
      streamingMessageRef.current = null;

    } catch (error) {
      // 检查是否因为取消导致的错误
      if (signal.aborted) {
        console.log('Request was cancelled by user');
        return;
      }
      
      console.error('Failed to send message:', error);
      
      // 在聊天框中显示错误消息，而不是弹出提示
      const errorMessage: ChatMessage = {
        id: `assistant_${Date.now()}`,
        role: 'assistant',
        content: '生成失败，请重试',
        timestamp: new Date()
      };
      
      setState(prev => ({
        ...prev,
        messages: [...prev.messages, errorMessage],
        isLoading: false,
        isThinking: false,
        isStreaming: false
      }));
      
      // 清除 AbortController 引用
      abortControllerRef.current = null;
      streamingMessageRef.current = null;
        }
  }, [context, state.messages, state.mode, generateReplySuggestions, handleStreamUpdate]);

  // Chat模式流式发送消息
  const sendChatMessage = useCallback(async (userInput: string) => {
    if (!assistantService.current || !userInput.trim()) return;
    
    // 取消之前的请求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // 创建新的 AbortController
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;
    
    // 添加用户消息
    const userMessage: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: userInput,
      timestamp: new Date(),
      type: 'text',
      mode: 'chat'
    };

    // 创建空的助理消息用于流式更新
    const assistantMessage: ChatMessage = {
      id: `assistant_${Date.now()}`,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      type: 'text',
      mode: 'chat',
      isStreaming: true
    };

    streamingMessageRef.current = assistantMessage.id;

    const messagesWithUserAndAssistant = [...state.messages, userMessage, assistantMessage];

    setState(prev => ({ 
      ...prev, 
      messages: messagesWithUserAndAssistant,
      isLoading: true, 
      isThinking: false, // Chat模式下不需要thinking状态，因为有流式消息
      isStreaming: true,
      replySuggestions: [],
      isLoadingSuggestions: false
    }));

    try {
      // 生成Chat模式回复
      const content = await assistantService.current!.generateChatResponse(
        userInput,
        context,
        [...state.messages, userMessage],
        handleStreamUpdate,
        signal
      );

      // 检查是否被取消
      if (signal.aborted) {
        return;
      }

      // 完成流式响应
      setState(prev => ({
        ...prev,
        messages: prev.messages.map(msg => 
          msg.id === assistantMessage.id 
            ? { ...msg, content, isStreaming: false }
            : msg
        ),
        isLoading: false,
        isThinking: false,
        isStreaming: false
      }));

      // 生成回复建议
      const finalMessages = messagesWithUserAndAssistant.map(msg => 
        msg.id === assistantMessage.id 
          ? { ...msg, content, isStreaming: false }
          : msg
      );
      generateReplySuggestions(finalMessages);

      // 清除引用
      abortControllerRef.current = null;
      streamingMessageRef.current = null;

    } catch (error) {
      if (signal.aborted) {
        console.log('Chat request was cancelled by user');
        return;
      }
      
      console.error('Failed to send chat message:', error);
      
      // 确保助理消息存在，然后更新为错误状态
      setState(prev => ({
        ...prev,
        messages: prev.messages.map(msg => 
          msg.id === assistantMessage.id 
            ? { ...msg, content: '生成失败，请重试', isStreaming: false, error: true }
            : msg
        ),
        isLoading: false,
        isThinking: false,
        isStreaming: false
      }));
      
      abortControllerRef.current = null;
      streamingMessageRef.current = null;
    }
  }, [context, state.messages, generateReplySuggestions, handleStreamUpdate]);

  // 应用动作提案
  const applyActionProposal = useCallback(async (proposalId: string) => {
    console.log('🚀 开始应用动作提案:', proposalId);
    
    const proposal = state.pendingActions.find(p => p.id === proposalId);
    if (!proposal || !promptEditService.current) {
      message.error('未找到对应的修改提案');
      return;
    }

    try {
      // 执行真实的编辑操作
      const editResult = await promptEditService.current.applyActionProposal(
        context,
        proposal
      );

      if (!editResult.success) {
        message.error(editResult.error || '应用修改失败');
        return;
      }

      // 更新提示词上下文
      if (editResult.newContext && onContextUpdate) {
        
        try {
          await onContextUpdate(editResult.newContext);
          console.log('✅ 上下文更新成功');
        } catch (updateError) {
          console.error('❌ 上下文更新失败:', updateError);
          return;
        }
      }

      // 标记为已应用
      setState(prev => ({
        ...prev,
        pendingActions: prev.pendingActions.map(p => 
          p.id === proposalId 
            ? { ...p, isApproved: true, isApplied: true }
            : p
        )
      }));


    } catch (error) {
      console.error('应用修改失败', error);
      message.error('应用修改失败，请重试');
    }
  }, [state.pendingActions, context, onContextUpdate]);

  // 拒绝动作提案
  const rejectActionProposal = useCallback((proposalId: string) => {
    setState(prev => ({
      ...prev,
      pendingActions: prev.pendingActions.filter(p => p.id !== proposalId)
    }));
    message.info('已拒绝修改提案');
  }, []);

  // 重新生成最后一条助手回复
  const regenerateLastResponse = useCallback(async () => {
    if (!assistantService.current || state.messages.length < 2) return;
    
    // 取消之前的请求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // 创建新的 AbortController
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;
    
    // 找到最后一条用户消息和移除最后一条助手消息
    let lastUserMessage = '';
    let messagesBeforeLastAssistant: ChatMessage[] = [];
    let lastMode: AssistantMode = 'chat';
    
    for (let i = state.messages.length - 1; i >= 0; i--) {
      if (state.messages[i].role === 'assistant') {
        lastMode = state.messages[i].mode || 'chat';
        // 移除最后一条助手消息
        messagesBeforeLastAssistant = state.messages.slice(0, i);
        // 找到之前的用户消息
        for (let j = i - 1; j >= 0; j--) {
          if (state.messages[j].role === 'user') {
            lastUserMessage = state.messages[j].content;
            break;
          }
        }
        break;
      }
    }

    if (!lastUserMessage) {
      message.error('未找到可重新生成的消息');
      return;
    }

    // 根据模式选择重新生成方法
    if (lastMode === 'chat') {
      // Chat模式：使用流式响应重新生成
      const assistantMessage: ChatMessage = {
        id: `assistant_${Date.now()}`,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        type: 'text',
        mode: 'chat',
        isStreaming: true
      };

      streamingMessageRef.current = assistantMessage.id;

      setState(prev => ({ 
        ...prev, 
        messages: [...messagesBeforeLastAssistant, assistantMessage],
        isLoading: true, 
        isThinking: true,
        isStreaming: true,
        replySuggestions: [], // 清空之前的回复建议
        isLoadingSuggestions: false
      }));

      try {
        const content = await assistantService.current!.generateChatResponse(
          lastUserMessage,
          context,
          messagesBeforeLastAssistant,
          handleStreamUpdate,
          signal
        );

        if (signal.aborted) return;

        const finalMessages = [...messagesBeforeLastAssistant, { ...assistantMessage, content, isStreaming: false }];

        setState(prev => ({
          ...prev,
          messages: finalMessages,
          isLoading: false,
          isThinking: false,
          isStreaming: false
        }));

        generateReplySuggestions(finalMessages);
        
      } catch (error) {
        if (signal.aborted) return;
        console.error('Failed to regenerate chat response:', error);
        
        // 更新流式消息显示错误信息
        setState(prev => ({
          ...prev,
          messages: prev.messages.map(msg => 
            msg.id === assistantMessage.id 
              ? { ...msg, content: '生成失败，请重试', isStreaming: false, error: true }
              : msg
          ),
          isLoading: false,
          isThinking: false,
          isStreaming: false
        }));
        
        // 清除引用
        abortControllerRef.current = null;
        streamingMessageRef.current = null;
        
        // 注意：错误情况下不调用 generateReplySuggestions
      }
    } else {
      // Agent模式：重新生成提案
      setState(prev => ({ 
        ...prev, 
        isLoading: true, 
        isThinking: true,
        messages: messagesBeforeLastAssistant,
        pendingActions: [],
        replySuggestions: [], // 清空之前的回复建议
        isLoadingSuggestions: false
      }));

      try {
        const response = await assistantService.current!.generateResponse(
          lastUserMessage,
          context,
          messagesBeforeLastAssistant,
          undefined,
          signal
        );

        if (signal.aborted) return;

        const assistantMessage: ChatMessage = {
          id: `assistant_${Date.now()}`,
          role: 'assistant',
          content: response.content,
          timestamp: new Date(),
          type: 'action_proposal',
          mode: 'agent'
        };

        const finalMessages = [...messagesBeforeLastAssistant, assistantMessage];

        setState(prev => ({
          ...prev,
          messages: finalMessages,
          pendingActions: response.actionProposal ? [response.actionProposal] : [],
          isLoading: false,
          isThinking: false
        }));

      } catch (error) {
        if (signal.aborted) return;
        console.error('Failed to regenerate agent response:', error);
        
        // 在聊天框中显示错误消息
        const errorMessage: ChatMessage = {
          id: `assistant_${Date.now()}`,
          role: 'assistant',
          content: '生成失败，请重试',
          timestamp: new Date()
        };
        
        setState(prev => ({
          ...prev,
          messages: [...messagesBeforeLastAssistant, errorMessage],
          isLoading: false,
          isThinking: false,
          isStreaming: false
        }));
      }
    }
    
    // 清除 AbortController 引用
    abortControllerRef.current = null;
    streamingMessageRef.current = null;
  }, [context, state.messages, generateReplySuggestions, handleStreamUpdate]);

  // 清空对话
  const clearChat = useCallback(() => {
    setState(prev => ({
      ...prev,
      messages: [],
      replySuggestions: [],
      isLoadingSuggestions: false,
      pendingActions: [],
      suggestions: []
    }));
  }, []);

  return {
    // 状态
    messages: state.messages,
    isLoading: state.isLoading,
    isThinking: state.isThinking,
    isInitialized,
    mode: state.mode,
    isStreaming: state.isStreaming,
    replySuggestions: state.replySuggestions,
    isLoadingSuggestions: state.isLoadingSuggestions,
    pendingActions: state.pendingActions,
    suggestions: state.suggestions,
    
    // 方法
    sendMessage,
    sendChatMessage,
    switchMode,
    applyActionProposal,
    rejectActionProposal,
    regenerateLastResponse,
    clearChat,
    cancelRequest
  };
} 