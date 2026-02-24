import React, { useState, useEffect, useRef } from 'react';
import {
    Modal,
    Card,
    Typography,
    Button,
    Space,
    Badge,
    Tag,
    Row,
    Col,
    Spin,
    Steps,
    message
} from 'antd';

import {
    CheckCircleOutlined,
    ExperimentOutlined,
    RocketOutlined,
    TrophyOutlined,
    DiffOutlined
} from '@ant-design/icons';
import { AIFeaturesAPI, AiModelAPI } from '@/lib/api';
import JSONDisplay from '@/components/json/JSONDisplay';
import TextDiffViewer from '@/components/text-diff/TextDiffViewer';
import { LLM_REQUEST_SOURCES } from '@/constants/llmSources';
import type { OptimizationResult, OptimizationFeedback } from '@/components/OptimizationTrigger';



const { Text } = Typography;

// 类型定义
interface Message {
    role: string;
    content: string;
    order: number;
}

interface TestCase {
    [key: string]: string;
}

interface OutputItem {
    id: number;
    model: string;
    timestamp: Date;
    response: string;
    cost: number;
    execution_time: number;
    testCase: TestCase;
    isLoading?: boolean;
    error?: string;
    tokens: {
        prompt: number;
        completion: number;
        total: number;
    };
    // 新增反馈相关字段
    hasFeedback?: boolean;
    feedback?: OptimizationFeedback;
    // 优化状态字段
    optimizationStatus?: 'idle' | 'optimizing' | 'completed' | 'failed' | 'cancelled';
    optimizationResult?: OptimizationResult;
    optimizationError?: string;
    // 请求详情信息
    requestDetails?: {
        messages: Array<{
            role: string;
            content: string;
        }>;
        modelConfig: any;
    };
}

interface ModelConfig {
    provider: string;
    model: string;
    temperature?: number;
    top_p?: number;
    max_tokens?: number;
    presence_penalty?: number;
    frequency_penalty?: number;
}

interface OptimizationRound {
    round: number;
    analysis: string;
    optimizedPrompt: Message[];
    testResults: OutputItem[];
    improvementScore: number;
    issues: string[];
    evaluation?: string;
    originalResult?: string;
    optimizedResult?: string;
    wasRejected?: boolean; // 标记是否被拒绝（得分较低）
}

interface PromptOptimizerProps {
    visible: boolean;
    onClose: () => void;
    onApplyOptimization: (optimizedMessages: Message[]) => void;
    currentMessages: Message[];
    // 支持两种模式：批量优化（多个反馈）和单例优化（单个输出）
    feedbackList?: { outputItem: OutputItem; feedback: OptimizationFeedback }[];
    singleOptimization?: {
        outputItem: OutputItem;
        feedback: OptimizationFeedback;
        onUpdateStatus: (outputId: number, status: 'optimizing' | 'completed' | 'failed' | 'cancelled', result?: any, error?: string) => void;
    };
    modelConfig: ModelConfig;
    projectId: number;
    promptId?: number;
    promptVersionId?: number;
    // 返回反馈弹窗的回调
    onReturnToFeedback?: () => void;
}

const PromptOptimizer: React.FC<PromptOptimizerProps> = ({
    visible,
    onClose,
    onApplyOptimization,
    currentMessages,
    singleOptimization,
    modelConfig,
    projectId,
    promptId,
    promptVersionId,
    onReturnToFeedback
}) => {
    // 翻译
    
    
    const [currentStep, setCurrentStep] = useState(0);
    const [optimizationRounds, setOptimizationRounds] = useState<OptimizationRound[]>([]);
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [finalResult, setFinalResult] = useState<Message[] | null>(null);
    const [initialScore, setInitialScore] = useState<number | null>(null);
    const [bestRound, setBestRound] = useState<OptimizationRound | null>(null);
    const [optimizationCompleted, setOptimizationCompleted] = useState(false);
    const [currentBaseMessages, setCurrentBaseMessages] = useState<Message[]>(currentMessages);
    // 优化终止状态 - 使用ref确保立即生效，生命周期与优化任务绑定
    const cancelledRef = useRef(false);
    const optimizationTaskIdRef = useRef<string | null>(null);

    // 健壮的AI JSON响应解析函数
    const parseAIJsonResponse = (response: string, type: 'optimization' | 'evaluation'): any => {
        // 清理响应文本
        let cleanedResponse = response.trim();
        console.log('cleanedResponse:', cleanedResponse);
        // 尝试多种JSON提取模式
        const patterns = [
            /```\{[\s\S]*\}```/,
            /\{[\s\S]*\}/,
            /```json\s*([\s\S]*?)\s*```/,
            /```\s*([\s\S]*?)\s*```/
        ];

        let jsonText = '';

        for (const pattern of patterns) {
            const match = cleanedResponse.match(pattern);
            if (match) {
                jsonText = match[1] || match[0];
                break;
            }
        }

        if (!jsonText) {
            throw new Error(`未找到有效的JSON格式${type === 'optimization' ? '优化' : '评分'}结果`);
        }

        // 清理JSON文本
        jsonText = jsonText
            .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // 移除控制字符
            .replace(/\\n/g, '\\n') // 保持换行符转义
            .replace(/\\"/g, '\\"') // 保持引号转义
            .replace(/\\'/g, "'") // 处理单引号
            .trim();

        try {
            console.log('jsonText:', jsonText);
            return JSON.parse(jsonText);
        } catch (parseError) {
            // 尝试修复未转义的引号
            const fixedJson = jsonText
                .replace(/([^\\])"/g, '$1\\"') // 修复未转义的引号
                .replace(/^"/, '\\"') // 修复开头的未转义引号
                .replace(/: "([^"]*)"([^,}])/g, ': "$1\\"$2'); // 修复字符串中的引号

            return JSON.parse(fixedJson);
        }
    };

    // 评估当前结果的函数
    const evaluateCurrentResult = async (result: string, feedback: OptimizationFeedback, prompts: Message[]): Promise<number> => {
        const currentTaskId = optimizationTaskIdRef.current;
        console.log('开始评估当前结果, 任务ID:', currentTaskId, '取消状态:', cancelledRef.current);
        // 检查是否被取消
        if (cancelledRef.current) {
            console.log('评估当前结果时被取消, 任务ID:', currentTaskId);
            return 70; // 返回默认分数
        }
        
        const evaluationPrompt = `
请评估以下AI输出结果的质量：

## 当前提示词：
${prompts.map(msg => `[${msg.role.toUpperCase()}]\n${msg.content}`).join('\n\n')}

## 当前输出：
${result}

## 用户反馈问题：
${feedback.description}

${feedback.expectedOutput ? `## 用户期望输出：\n${feedback.expectedOutput}` : ''}

## 评估要求：
1. 分析提示词结构和逻辑是否合理
2. 评估当前输出是否解决了用户反馈的问题
3. 判断问题出现的原因（提示词结构、语言表达、逻辑顺序等）
4. 评估输出质量和用户满意度
5. 给出0-100的综合评分
6. 提供针对提示词的具体改进建议
7. 评估时，如无特殊要求请忽略空格和换行的微小差异，重点关注内容质量

请返回JSON格式的评估结果：
\`\`\`json
{
    "score": 75,
    "evaluation": "具体评价说明",
    "promptIssues": ["提示词问题1", "提示词问题2"],
    "improvements": ["可改进点1", "可改进点2"],
    "issues": ["存在问题1", "存在问题2"],
    "recommendation": "针对提示词的优化建议"
}
\`\`\``;

        try {
            const response = await AIFeaturesAPI.callFeature(projectId, {
                feature_key: 'prompt_optimizer',
                messages: [{ role: 'user', content: evaluationPrompt }],
                temperature: 0.2,
                max_tokens: 1000,
                prompt_id: promptId,
                prompt_version_id: promptVersionId,
            });

            const evaluationResult = parseAIJsonResponse(response.data.message, 'evaluation');
            return evaluationResult.score || 70;
        } catch (error) {
            console.error('评估失败:', error);
            return 70; // 默认分数
        }
    };

    // 评估优化后的结果的函数
    const evaluateOptimizedResult = async (originalResult: string, optimizedResult: string, originalPrompts: Message[], optimizedPrompts: Message[]): Promise<any> => {
        // 检查是否被取消
        if (cancelledRef.current) {
            console.log('评估优化结果时被取消');
            return { score: 75, evaluation: '优化被取消', improvements: [], issues: [], recommendation: '' };
        }
        
        // 使用AI评分系统
        const evaluationPrompt = `
        请评估以下提示词优化的效果：
        
        ## 原始提示词：
        ${originalPrompts.map(msg => `[${msg.role.toUpperCase()}]\n${msg.content}`).join('\n\n')}
        
        ## 优化后提示词：
        ${optimizedPrompts.map(msg => `[${msg.role.toUpperCase()}]\n${msg.content}`).join('\n\n')}
        
        ## 原始输出：
        ${originalResult}
        
        ## 优化后输出：
        ${optimizedResult}
        
        ## 用户反馈问题：
        ${singleOptimization!.feedback.description}
        
        ${singleOptimization!.feedback.expectedOutput ? `## 用户期望输出：\n${singleOptimization!.feedback.expectedOutput}` : ''}
        
        ## 评估要求：
        1. 对比原始提示词和优化后提示词的结构和逻辑
        2. 分析提示词优化的具体改进点
        3. 对比原始输出和优化后输出
        4. 评估是否解决了用户反馈的问题
        5. 评估输出质量的改进程度
        6. 给出0-100的综合评分
        7. 提供具体的评价建议和进一步优化方向
        8. 评估时，如无特殊要求请忽略空格和换行的微小差异，重点关注内容质量和解决问题的程度
        
        请返回JSON格式的评估结果：
        \`\`\`json
        {
            "score": 85,
            "evaluation": "具体评价说明",
            "promptImprovements": ["提示词改进点1", "提示词改进点2"],
            "outputImprovements": ["输出改进点1", "输出改进点2"],
            "improvements": ["改进点1", "改进点2"],
            "issues": ["仍存在的问题1", "仍存在的问题2"],
            "recommendation": "进一步优化建议"
        }
        \`\`\`
        `;

        // 使用专门的评分系统评估优化效果
        let evaluationData: any = { score: 75, evaluation: '优化完成' };
        try {
            const evaluationResponse = await AIFeaturesAPI.callFeature(projectId, {
                feature_key: 'prompt_optimizer',
                messages: [{ role: 'user', content: evaluationPrompt }],
                temperature: 0.2,
                max_tokens: 1000,
                prompt_id: promptId,
                prompt_version_id: promptVersionId,
            });

            evaluationData = parseAIJsonResponse(evaluationResponse.data.message, 'evaluation');
        } catch (evaluationError: any) {
            console.error('评分过程失败:', evaluationError);

            // 使用默认评分
            evaluationData = {
                score: 75,
                evaluation: `评分过程失败：${evaluationError?.message || '未知错误'}`,
                improvements: ['评分系统错误'],
                issues: ['无法获取详细评分'],
                recommendation: '请检查网络连接和AI服务状态'
            };
        }
        return evaluationData;
    };

    // 构建优化提示词的函数
    const createOptimizationPrompt = (round: number, baseMessages: Message[], previousResults?: OptimizationRound[]) => {
        const feedbackText = `用例反馈：
测试数据：${JSON.stringify(singleOptimization?.outputItem.testCase)}
当前输出：${singleOptimization?.outputItem.response}
用户需求：${singleOptimization?.feedback.description}
${singleOptimization?.feedback.expectedOutput ? `期望输出：${singleOptimization?.feedback.expectedOutput}` : ''}`;


        const previousAnalysis = previousResults?.map(result =>
            `第${result.round}轮优化：
分析：${result.analysis}
改进评分：${result.improvementScore}/100
发现问题：${result.issues.join(', ')}`
        ).join('\n\n');

        return `# 提示词优化专家

你是一个专业的提示词优化专家。现在需要对一个提示词进行第${round}轮优化。

## 当前提示词：
${baseMessages.map(msg => `[role:${msg.role}]\n${msg.content}`).join('\n\n')}

## 用户反馈：
${feedbackText}

${previousResults && previousResults.length > 0 ? `## 之前的优化结果：\n${previousAnalysis}` : ''}

## 优化目标：
1. 解决用户反馈中的具体问题
2. 提高输出质量和用户满意度
3. 保持提示词的清晰性和有效性
4. ${round > 1 ? '基于之前优化的经验进一步改进' : '进行首轮优化分析'}
5. ${round > 2 ? '可以参考用户的期望输出' : '不能简单的把用户期望输出的例子放到提示词里'}

请按以下JSON格式返回优化结果：

\`\`\`json
{
  "analysis": "详细分析当前提示词存在的问题",
  "optimizedPrompt": [
    {
      "role": "system", 
      "content": "优化后的系统消息",
      "order": 0
    },
    {
      "role": "user",
      "content": "优化后的用户消息", 
      "order": 1
    }
  ],
  "expectedImprovements": ["改进点1", "改进点2"],
  "confidenceScore": 85
}
\`\`\`

注意：
- 保持原有的消息结构、语言类型和变量占位符
- 忽略提示词里[role:system]、[role:assistant]、[role:user]等内容，这是描述角色，不是提示词内容
- 优化要针对性解决反馈中的具体问题
- 确保优化后的提示词更加清晰、有效
- ${round > 1 ? '请充分考虑之前轮次的经验' : ''}
- ${round > 2 ? '可以参考用户的期望输出' : '不能简单的把用户期望输出的例子放到提示词里'}`;
    };

    // 执行单轮优化
    const performOptimizationRound = async (round: number, baseMessages: Message[]): Promise<OptimizationRound | null> => {
        try {
            // 检查是否被取消
            if (cancelledRef.current) {
                console.log(`第${round}轮优化在开始前被取消`);
                return null;
            }

            const optimizationPrompt = createOptimizationPrompt(round, baseMessages, optimizationRounds);

            
            const currentTaskId = optimizationTaskIdRef.current;
            console.log(`第${round}轮优化开始调用AI, 任务ID:`, currentTaskId, '取消状态:', cancelledRef.current);

            const response = await AIFeaturesAPI.callFeature(projectId, {
                feature_key: 'prompt_optimizer',
                messages: [{ role: 'user', content: optimizationPrompt }],
                temperature: 0.3,
                max_tokens: 4000,
                prompt_id: promptId,
                prompt_version_id: promptVersionId,
            });

            // AI调用完成后立即检查是否被取消
            if (cancelledRef.current) {
                console.log(`第${round}轮优化AI调用完成后被取消, 任务ID:`, currentTaskId);
                return null;
            }

            console.log(`第${round}轮优化AI调用完成, 任务ID:`, currentTaskId, '取消状态:', cancelledRef.current);

            // 解析AI返回的结果
            let optimizationResult;
            try {
                optimizationResult = parseAIJsonResponse(response.data.message, 'optimization');
            } catch (parseError: any) {
                console.error('解析优化结果失败:', parseError);
                console.log('原始AI响应:', response.data.message);

                // 创建一个基于当前基础提示词的优化结果作为后备
                optimizationResult = {
                    analysis: `AI优化分析：基于用户反馈进行了调整。原始错误：${parseError?.message || '未知错误'}`,
                    optimizedPrompt: baseMessages.map(msg => ({
                        ...msg,
                        content: msg.content.includes('优化') ? msg.content : msg.content + "\n\n[注意：请根据用户反馈调整输出风格和内容]"
                    })),
                    expectedImprovements: ["语气优化", "结构改进", "响应准确性提升"],
                    confidenceScore: 70
                };

                // 如果optimizedPrompt为空或需要后备处理，使用当前基础提示词
                if (!optimizationResult.optimizedPrompt || optimizationResult.optimizedPrompt.length === 0 || (optimizationResult as any).needsFallback) {
                    optimizationResult.optimizedPrompt = baseMessages.map(msg => ({
                        ...msg,
                        content: msg.content.includes('优化') ? msg.content : msg.content + "\n\n[注意：请根据用户反馈调整输出风格和内容]"
                    }));
                }
            }


             // 用优化后的提示词运行测试用例
             let testResult: OutputItem | null = null;
             const testCase = singleOptimization?.outputItem.testCase;
             if (testCase) {

                 const processedMessages = optimizationResult.optimizedPrompt.map((msg: any) => ({
                     role: msg.role,
                     content: msg.content.replace(/{{(\w+)}}/g, (_: any, key: string) => testCase[key] || `{{${key}}}`)
                 }));

                 try {
                     const testResponse = await AiModelAPI.callLLM({
                        messages: processedMessages,
                        config: {
                            model: modelConfig.model,
                            provider: modelConfig.provider,
                            temperature: modelConfig.temperature,
                            top_p: modelConfig.top_p,
                            max_tokens: modelConfig.max_tokens
                        },
                        project_id: projectId,
                        prompt_id: promptId,
                        prompt_version_id: promptVersionId,
                        source: LLM_REQUEST_SOURCES.PROMPT_OPTIMIZER_TEST
                    });

                    if (cancelledRef.current) {
                        console.log(`第${round}轮优化在测试用例执行后被取消`);
                        return null;
                    }

                    testResult = {
                        id: Date.now(),
                        model: modelConfig.model,
                        timestamp: new Date(),
                        response: testResponse.data.message,
                        cost: testResponse.data.cost || 0,
                        execution_time: testResponse.data.execution_time || 0,
                        tokens: testResponse.data.tokens,
                        testCase: testCase || {}
                    };
                } catch (testError) {
                    console.error(`测试用例执行失败:`, testError);
                }
            }

            // 使用专门的评分系统评估优化效果
            let evaluationData: any = { score: 75, evaluation: '优化完成' };
            let originalResult = '';
            let optimizedResult = '';

                         if (testResult) {

                 // 单例模式下获取原始结果进行对比
                 const targetOutput = singleOptimization!.outputItem;
                 originalResult = targetOutput.response;
                 optimizedResult = testResult.response;
                 evaluationData = await evaluateOptimizedResult(originalResult, optimizedResult, baseMessages, optimizationResult.optimizedPrompt);
                 
                 // 评估完成后检查是否被取消
                 if (cancelledRef.current) {
                     console.log(`第${round}轮优化在评估后被取消`);
                     return null;
                 }
             }

            const improvementScore = evaluationData.score || -1;

            // 分析问题（基于反馈）
            const issues = evaluationData.issues || [singleOptimization?.feedback.description];

            return {
                round,
                analysis: optimizationResult.analysis,
                optimizedPrompt: optimizationResult.optimizedPrompt,
                testResults: testResult ? [testResult] : [],
                improvementScore,
                issues: issues, // 限制显示的问题数量
                evaluation: evaluationData.evaluation,
                originalResult,
                optimizedResult
            };

        } catch (error) {
            console.error(`第${round}轮优化失败，请重试`, error);
            message.error(`第${round}轮优化失败，请重试`);
            throw error;
        }
    };

    // 开始多轮优化流程
    const startOptimization = async (continueFromPrevious = false) => {
        // 为新的优化任务生成唯一ID并重置取消状态
        if (!continueFromPrevious) {
            const taskId = `opt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            optimizationTaskIdRef.current = taskId;
            cancelledRef.current = false;
            console.log('开始新的优化任务:', taskId);
        }
        
        setIsOptimizing(true);
        setOptimizationCompleted(false);

                if (!continueFromPrevious) {
                    setOptimizationRounds([]);
                    setCurrentStep(0);
                    setFinalResult(null);
                    setInitialScore(null);
                    setBestRound(null);
                    setCurrentBaseMessages(currentMessages);
                }

                const maxRounds = continueFromPrevious ? optimizationRounds.length + 2 : 3;
                let currentBest = bestRound || null;

                console.log('开始优化', cancelledRef.current);
                                 try {
                     // 检查是否被取消
                     if (cancelledRef.current) {
                         console.log('优化已被取消，停止执行');
                         return;
                     }

                     // 1. 获取初始评分（仅在新开始时）
                     if (!continueFromPrevious && !initialScore && singleOptimization) {
                         const score = await evaluateCurrentResult(
                             singleOptimization.outputItem.response,
                             singleOptimization.feedback,
                             currentMessages
                         );
                         
                         // 再次检查是否被取消
                         if (cancelledRef.current) {
                             console.log('优化在评估阶段被取消');
                             return;
                         }
                         
                         setInitialScore(score);
                     }

                    const rounds: OptimizationRound[] = continueFromPrevious ? [...optimizationRounds] : [];
                    let baselineScore = continueFromPrevious ? (bestRound?.improvementScore || 0) : (initialScore || 70);
                    let workingBaseMessages = continueFromPrevious ? currentBaseMessages : currentMessages;

                                         for (let round = rounds.length + 1; round <= maxRounds; round++) {
                         // 检查是否被取消
                         if (cancelledRef.current) {
                             console.log(`第${round}轮优化前被取消`);
                             return;
                         }

                         setCurrentStep(round - 1);

                         const result = await performOptimizationRound(round, workingBaseMessages);
                         
                         // 优化轮次完成后再次检查是否被取消
                         if (cancelledRef.current) {
                             console.log(`第${round}轮优化后被取消`);
                             return;
                         }
                        if (result) {
                            // 评分比较逻辑
                            if (result.improvementScore > baselineScore) {
                                // 分数更高，接受这轮优化
                                rounds.push(result);
                                currentBest = result;
                                baselineScore = result.improvementScore;
                                // 更新工作基础消息为优化后的结果
                                workingBaseMessages = result.optimizedPrompt;
                                setCurrentBaseMessages(workingBaseMessages);
                                console.log(`第${round}轮优化成功：${result.improvementScore} > ${baselineScore}，下轮将基于此结果优化`);
                            } else {
                                // 分数更低，拒绝这轮优化
                                result.wasRejected = true;
                                rounds.push(result);
                                console.log(`第${round}轮优化被拒绝：${result.improvementScore} <= ${baselineScore}，继续使用上轮最佳结果`);
                            }

                            setOptimizationRounds([...rounds]);
                            setBestRound(currentBest);

                            // 如果改进评分很高，可以提前结束
                            if (currentBest && currentBest.improvementScore > 90) {
                                break;
                            }
                        } else {
                            break;
                        }

                        // 轮次间暂停
                        if (round < maxRounds) {
                            await new Promise(resolve => setTimeout(resolve, 1000));
                        }
                    }

                    // 使用最佳结果
                    if (currentBest) {
                        setFinalResult(currentBest.optimizedPrompt);
                        setCurrentStep(maxRounds);
                        setOptimizationCompleted(true);

                        // 单例模式下自动更新状态
                        if (singleOptimization) {
                            const optimizationResult = {
                                optimizedPrompt: currentBest.optimizedPrompt,
                                originalResult: currentBest.originalResult || '',
                                optimizedResult: currentBest.optimizedResult || '',
                                score: currentBest.improvementScore,
                                evaluation: currentBest.evaluation || '优化完成',
                                executionTime: currentBest.testResults[0]?.execution_time || 0,
                                promptDiff: {
                                    added: [],
                                    removed: [],
                                    modified: ['AI优化调整']
                                }
                            };

                            singleOptimization.onUpdateStatus(
                                singleOptimization.outputItem.id,
                                'completed',
                                optimizationResult
                            );
                        }
                    }

                } catch (error) {
                    console.error('优化流程失败:', error);
                    message.error('优化流程失败，请重试');

                    setFinalResult(currentBest?.optimizedPrompt || []);
                    setCurrentStep(maxRounds);
                    setOptimizationCompleted(true);

                    // 单例模式下更新失败状态
                    if (singleOptimization) {
                        singleOptimization.onUpdateStatus(
                            singleOptimization.outputItem.id,
                            'failed',
                            undefined,
                            error instanceof Error ? error.message : '优化流程失败，请重试'
                        );
                    }
                } finally {
                    setIsOptimizing(false);
                }
    };

    // 应用优化结果
    const handleApplyOptimization = () => {
        if (finalResult) {
            onApplyOptimization(finalResult);
            message.success('已应用优化后的提示词');
            onClose();
        }
    };

    // 当 currentMessages 改变时更新基础消息
    useEffect(() => {
        setCurrentBaseMessages(currentMessages);
    }, [currentMessages]);

    // 当弹窗关闭时重置状态，确保下次打开时状态正确
    useEffect(() => {
        if (!visible) {
            console.log('弹窗关闭，重置UI状态，但保持取消标志有效');
            // 只重置UI状态，不重置取消标志
            // 取消标志会在下次开始新的优化任务时重置
            setCurrentStep(0);
            setOptimizationRounds([]);
            setIsOptimizing(false);
            setFinalResult(null);
            setInitialScore(null);
            setBestRound(null);
            setOptimizationCompleted(false);
            // 注意：不重置 cancelledRef.current，让它保持有效直到下次新任务
        }
    }, [visible]);

    // 当弹窗打开时，恢复状态或自动开始优化
    useEffect(() => {
        if (visible && singleOptimization) {
            const { outputItem } = singleOptimization;
            
            // 只有在将要开始新的优化任务时才重置取消状态
            // 如果是查看已完成的结果，不重置取消状态
            
            // 如果优化已完成，恢复完成状态
            if (outputItem.optimizationStatus === 'completed' && outputItem.optimizationResult) {
                const result = outputItem.optimizationResult;
                
                // 恢复优化完成状态
                setOptimizationCompleted(true);
                setCurrentStep(3);
                setIsOptimizing(false);
                
                // 设置最终结果
                if (result.optimizedPrompt) {
                    setFinalResult(result.optimizedPrompt);
                }
                
                // 创建模拟的优化轮次数据用于显示
                const mockRounds: OptimizationRound[] = [
                    {
                        round: 1,
                        analysis: '优化完成',
                        optimizedPrompt: result.optimizedPrompt || currentMessages,
                        improvementScore: result.score || 85,
                        issues: [],
                        evaluation: result.evaluation || '优化完成',
                        originalResult: result.originalResult || '',
                        optimizedResult: result.optimizedResult || '',
                        testResults: [{
                            id: Math.random(),
                            response: result.optimizedResult || '',
                            execution_time: result.executionTime || 1000,
                            cost: 0,
                            model: modelConfig.provider,
                            timestamp: new Date(),
                            testCase: {},
                            tokens: {
                                prompt: 0,
                                completion: 0,
                                total: 0
                            }
                        }]
                    }
                ];
                setOptimizationRounds(mockRounds);
                setBestRound(mockRounds[0]);
                return;
            }
            
            // 如果优化失败，恢复失败状态
            if (outputItem.optimizationStatus === 'failed') {
                setOptimizationCompleted(true);
                setCurrentStep(3);
                setIsOptimizing(false);
                return;
            }
            
            // 其他情况（未开始、被取消等）：自动开始新的优化
            console.log('将开始新的优化任务，当前取消状态:', cancelledRef.current);
            startOptimization();
        }
    }, [visible, singleOptimization]);

    const steps = [
        { title: '第一轮优化', description: '基础问题分析' },
        { title: '第二轮优化', description: '深度结构调整' },
        { title: '第三轮优化', description: '精细化改进' },
        { title: '优化完成', description: '选择最佳版本' }
    ];

         const handleCancel = () => {
         // 优化进行中时，显示确认对话框
         Modal.confirm({
             title: '确认终止优化',
             content: '优化正在进行中，关闭弹窗将终止当前优化流程。是否确认关闭？',
             okText: '确认关闭',
             cancelText: '继续优化',
             onOk: () => {
                 // 终止优化流程 - 立即设置ref标志
                 const currentTaskId = optimizationTaskIdRef.current;
                 console.log('终止优化流程, 任务ID:', currentTaskId);
                 cancelledRef.current = true;
                 setIsOptimizing(false);
                 setOptimizationCompleted(false);
                 
                 // 更新优化状态为取消
                 if (singleOptimization) {
                     singleOptimization.onUpdateStatus(
                         singleOptimization.outputItem.id,
                         'cancelled',
                         undefined,
                         '优化完成'
                     );
                 }
                 
                 // 直接关闭弹窗，取消标志将保持有效直到下次开始新的优化任务
                 onClose();
             }
         });
     }

    return (
        <Modal
            title={
                <Space>
                    <RocketOutlined style={{ color: '#1890ff' }} />
                    <span>{'AI智能优化'}</span>
                    <Tag color="processing">{'多轮迭代优化'}</Tag>
                </Space>
            }
            open={visible}
                         onCancel={() => {
                 if (isOptimizing) {
                     // 优化进行中时，显示确认对话框
                     handleCancel();
                 } else {
                     // 非优化状态，直接关闭
                     onClose();
                 }
             }}
            footer={
                optimizationCompleted ? [
                    <Button key="cancel" onClick={onClose}>
                        {'取消'}
                    </Button>,
                    onReturnToFeedback && (
                        <Button
                            key="returnToFeedback"
                            onClick={() => {
                                onClose();
                                onReturnToFeedback();
                            }}
                        >
                            {'返回反馈'}
                        </Button>
                    ),
                    <Button
                        key="restart"
                        onClick={() => startOptimization(false)}
                        disabled={isOptimizing}
                    >
                        {'重新优化'}
                    </Button>,
                    <Button
                        key="continue"
                        onClick={() => startOptimization(true)}
                        disabled={isOptimizing}
                    >
                        {'继续优化'}
                    </Button>,
                    <Button
                        key="apply"
                        type="primary"
                        icon={<CheckCircleOutlined />}
                        onClick={handleApplyOptimization}
                        disabled={!finalResult}
                    >
                        {'应用最优版本'}
                    </Button>
                ].filter(Boolean) : isOptimizing ? [
                    <Button key="cancel" onClick={handleCancel}>
                        {'关闭'}
                    </Button>,
                    onReturnToFeedback && (
                        <Button
                            key="returnToFeedback"
                            onClick={() => {
                                onClose();
                                onReturnToFeedback();
                            }}
                        >
                            {'返回反馈'}
                        </Button>
                    )
                ].filter(Boolean) : [
                    <Button key="cancel" onClick={onClose}>
                        {'关闭'}
                    </Button>,
                    onReturnToFeedback && (
                        <Button
                            key="returnToFeedback"
                            onClick={() => {
                                onClose();
                                onReturnToFeedback();
                            }}
                        >
                            {'返回反馈'}
                        </Button>
                    )
                ].filter(Boolean)
            }
            width={1000}
            style={{ top: 20 }}
        >
            <div style={{ maxHeight: '80vh', overflow: 'auto' }}>
                {/* 步骤指示器 */}
                <div style={{ marginBottom: 24 }}>
                    <Steps current={currentStep} items={steps} size="small" />
                </div>

                {/* 反馈概览 */}
                <Card size="small" style={{ marginBottom: 16, background: '#f0f9ff' }}>
                    <div style={{ marginBottom: 8 }}>
                        <Text strong>{'用户反馈概览'}</Text>
                        {initialScore && (
                            <Tag color="orange" style={{ marginLeft: 8, fontSize: '11px' }}>
                                {`初始评分: ${initialScore}`}
                            </Tag>
                        )}
                        {bestRound && (
                            <Tag color="green" style={{ marginLeft: 8, fontSize: '11px' }}>
                                {`最佳评分: ${bestRound?.improvementScore}`}
                            </Tag>
                        )}
                    </div>
                    <Row gutter={8} style={{ marginTop: 8 }}>
                        <Col span={12}>
                            <div style={{ marginBottom: 4 }}>
                                <Text strong style={{ fontSize: '11px', color: '#1890ff' }}>{'用例描述'}</Text>
                            </div>
                            <div style={{
                                background: '#f0f9ff',
                                border: '1px solid #bae7ff',
                                borderRadius: '4px',
                                padding: '8px',
                                fontSize: '12px',
                                minHeight: '60px',
                                overflow: 'auto'
                            }}>
                                <JSONDisplay content={singleOptimization?.feedback.description || '无描述'} />
                            </div>
                        </Col>
                        {singleOptimization?.feedback.expectedOutput && (
                            <Col span={12}>
                                <div style={{ marginBottom: 4 }}>
                                    <Text strong style={{ fontSize: '11px', color: '#52c41a' }}>{'期望输出'}</Text>
                                </div>
                                <div style={{
                                    background: '#f6ffed',
                                    border: '1px solid #d9f7be',
                                    borderRadius: '4px',
                                    padding: '8px',
                                    fontSize: '12px',
                                    minHeight: '60px',
                                    overflow: 'auto'
                                }}>
                                    <JSONDisplay content={singleOptimization?.feedback.expectedOutput} />
                                </div>
                            </Col>
                        )}
                    </Row>
                </Card>

                {/* 优化进度展示 */}
                {isOptimizing && (
                    <Card size="small" style={{ marginBottom: 16, textAlign: 'center' }}>
                        <Spin size="large" />
                        <div style={{ marginTop: 16 }}>
                            <Text strong style={{ fontSize: '16px' }}>
                                {`正在执行第${optimizationRounds.length + 1}轮优化...`}
                            </Text>
                        </div>
                        <div style={{ marginTop: 8 }}>
                            <Text type="secondary">
                                {'AI正在分析并优化您的提示词，请稍候'}
                            </Text>
                        </div>
                    </Card>
                )}

                {/* 优化结果展示 */}
                {optimizationRounds.map((round, _index) => (
                    <Card
                        key={round.round}
                        size="small"
                        style={{
                            marginBottom: 16,
                            border: round.wasRejected
                                ? '1px solid #ff7875'
                                : round.improvementScore === Math.max(...optimizationRounds.map(r => r.improvementScore))
                                    ? '2px solid #52c41a'
                                    : '1px solid #d9d9d9',
                            background: round.wasRejected ? '#fff2f0' : 'white'
                        }}
                        title={
                            <Space>
                                <Badge count={round.round} size="small" style={{ backgroundColor: '#1890ff' }} />
                                <span>{`第${round.round}轮优化`}</span>
                                <Tag color={round.improvementScore > 85 ? 'green' : round.improvementScore > 70 ? 'orange' : 'red'}>
                                    {`评分: ${round.improvementScore}`}
                                </Tag>
                                {round.wasRejected && (
                                    <Tag color="red">{'被拒绝'}</Tag>
                                )}
                                {round.improvementScore === Math.max(...optimizationRounds.map(r => r.improvementScore)) && !round.wasRejected && (
                                    <Tag color="gold" icon={<TrophyOutlined />}>{'最佳'}</Tag>
                                )}
                            </Space>
                        }
                    >
                        {/* 分析结果 */}
                        <div style={{ marginBottom: 12 }}>
                            <Text strong style={{ fontSize: '13px' }}>{'🔍 分析结果：'}</Text>
                            {round.wasRejected && (
                                <div style={{
                                    marginTop: 4,
                                    padding: '8px',
                                    background: '#fff1f0',
                                    border: '1px solid #ffccc7',
                                    borderRadius: '4px',
                                    fontSize: '12px',
                                    color: '#cf1322'
                                }}>
                                    {`⚠️ 本轮优化被拒绝：评分(${round.improvementScore})低于基准线，使用上一轮最佳结果继续优化`}
                                </div>
                            )}
                            <div style={{ marginTop: 4, fontSize: '12px', color: '#666' }}>
                                {round.analysis}
                            </div>
                        </div>

                        {/* 提示词对比 */}
                        <div style={{ marginBottom: 12 }}>
                            <Text strong style={{ fontSize: '13px' }}>
                                <DiffOutlined style={{ marginRight: 4 }} />
                                {'提示词对比'}
                            </Text>
                            <TextDiffViewer
                                oldText={currentMessages.map(msg => `[${msg.role.toUpperCase()}]\n${msg.content}`).join('\n\n')}
                                newText={round.optimizedPrompt.map(msg => `[${msg.role.toUpperCase()}]\n${msg.content}`).join('\n\n')}
                                title={`第${round.round}轮优化对比`}
                            />
                        </div>

                        {/* 结果对比（单例模式） */}
                        {round.originalResult && round.optimizedResult && (
                            <div style={{ marginBottom: 12 }}>
                                <Text strong style={{ fontSize: '13px' }}>
                                    <ExperimentOutlined style={{ marginRight: 4 }} />
                                    {'结果对比'}
                                </Text>
                                <Row gutter={8} style={{ marginTop: 4 }}>
                                    <Col span={12}>
                                        <div style={{ marginBottom: 4 }}>
                                            <Text strong style={{ fontSize: '11px', color: '#fa8c16' }}>{'原始结果'}</Text>
                                        </div>
                                        <div style={{
                                            background: '#fff2f0',
                                            border: '1px solid #ffccc7',
                                            borderRadius: '4px',
                                            padding: '6px',
                                            fontSize: '10px',
                                            maxHeight: '100px',
                                            overflow: 'auto'
                                        }}>
                                            <JSONDisplay content={round.originalResult} />
                                        </div>
                                    </Col>
                                    <Col span={12}>
                                        <div style={{ marginBottom: 4 }}>
                                            <Text strong style={{ fontSize: '11px', color: '#52c41a' }}>{'优化结果'}</Text>
                                        </div>
                                        <div style={{
                                            background: '#f6ffed',
                                            border: '1px solid #d9f7be',
                                            borderRadius: '4px',
                                            padding: '6px',
                                            fontSize: '10px',
                                            maxHeight: '100px',
                                            overflow: 'auto'
                                        }}>
                                            <JSONDisplay content={round.optimizedResult} />
                                        </div>
                                    </Col>
                                </Row>
                            </div>
                        )}

                        {/* AI评价（单例模式） */}
                        {round.evaluation && (
                            <div style={{ marginBottom: 12 }}>
                                <Text strong style={{ fontSize: '13px' }}>{'🎯 AI评价：'}</Text>
                                <div style={{
                                    background: '#f0f9ff',
                                    border: '1px solid #d6e4ff',
                                    borderRadius: '4px',
                                    padding: '8px',
                                    marginTop: 4,
                                    fontSize: '12px'
                                }}>
                                    {round.evaluation}
                                </div>
                            </div>
                        )}

                        {/* 测试结果 */}
                        {round.testResults.length > 0 && (
                            <div>
                                <Text strong style={{ fontSize: '13px' }}>{'🧪 测试结果：'}</Text>
                                <Row gutter={8} style={{ marginTop: 4 }}>
                                    {round.testResults.slice(0, 2).map((result, resultIndex) => (
                                        <Col span={12} key={resultIndex}>
                                            <div style={{
                                                background: '#f6ffed',
                                                border: '1px solid #d9f7be',
                                                borderRadius: '4px',
                                                padding: '6px',
                                                fontSize: '10px',
                                                maxHeight: '80px',
                                                overflow: 'auto'
                                            }}>
                                                {result.response.substring(0, 100)}{result.response.length > 100 ? '...' : ''}
                                            </div>
                                        </Col>
                                    ))}
                                </Row>
                            </div>
                        )}
                    </Card>
                ))}

                {/* 最终结果展示 */}
                {finalResult && currentStep === 3 && (
                    <Card size="small" style={{ background: '#f6ffed', border: '2px solid #52c41a' }}>
                        <div style={{ textAlign: 'center', marginBottom: 16 }}>
                            <TrophyOutlined style={{ fontSize: '24px', color: '#52c41a' }} />
                            <div style={{ marginTop: 8 }}>
                                <Text strong style={{ fontSize: '16px', color: '#52c41a' }}>
                                    {'优化完成！'}
                                </Text>
                            </div>
                            <div style={{ marginTop: 4 }}>
                                <Text type="secondary">
                                    {`经过${optimizationRounds.length}轮优化，已为您生成最佳提示词版本`}
                                </Text>
                            </div>
                        </div>

                        <div style={{
                            background: 'white',
                            border: '1px solid #d9f7be',
                            borderRadius: '6px',
                            padding: '12px'
                        }}>
                            <Text strong style={{ marginBottom: 12, display: 'block' }}>{'最终优化对比：'}</Text>
                            <TextDiffViewer
                                oldText={currentMessages.map(msg => `[${msg.role.toUpperCase()}]\n${msg.content}`).join('\n\n')}
                                newText={finalResult.map(msg => `[${msg.role.toUpperCase()}]\n${msg.content}`).join('\n\n')}
                                title={'原始版本 vs 最终优化版本'}
                            />
                        </div>
                    </Card>
                )}
            </div>
        </Modal>
    );
};

export default PromptOptimizer; 