import { useState, useEffect, useCallback, forwardRef, useImperativeHandle, useRef, useMemo } from "react"
import {
    Card,
    Typography,
    Button,
    Input,
    Space,
    Select,
    Empty,
    Row,
    Col,
    Tag,
    Badge,
    Divider,
    Tooltip,
    Statistic,
    Progress,
    Modal,
    Form,
    Switch,
    InputNumber,
    message,
    Popconfirm,
    Spin,
    Dropdown,
    Popover,
    Tree,
    Segmented

} from "antd"
import {
    CopyOutlined,
    PlusOutlined,
    DeleteOutlined,
    ExperimentOutlined,
    SaveOutlined,
    SettingOutlined,
    PlayCircleOutlined,
    EditOutlined,
    BulbOutlined,
    ThunderboltOutlined,
    CheckCircleOutlined,
    ClockCircleOutlined,
    MoreOutlined,
    EyeOutlined,
    DownOutlined,
    BranchesOutlined,
    QuestionCircleOutlined,
    ArrowRightOutlined,
    DiffOutlined,
    HistoryOutlined,
    StopOutlined


} from "@ant-design/icons"
import { useNavigate, useParams, useSearchParams } from "react-router-dom"

import { PromptsAPI, AiModelAPI, ModelsAPI } from '@/lib/api'
import { useProjectJump } from "@/hooks/useProjectJump"
import LongTextEditor from '../../components/ui/LongTextEditor'
import { copyToClipboard, saveEditorModePreference, getEditorModePreference } from '@/lib/utils'
import { HeightController } from '../../utils/heightControl'
import { translateMessages, detectLanguage } from '@/utils/translator'
import { processWithConcurrency } from '@/utils/concurrency'
import { LLM_REQUEST_SOURCES } from '@/constants/llmSources'
import TestCaseGeneratorModal from '../../components/TestCaseGeneratorModal'
import TextDiffViewer from '../../components/text-diff/TextDiffViewer'
import JSONDisplay from '@/components/json/JSONDisplay'
import { JsonImportModal } from '../../components/JsonImportModal'
import OptimizationTrigger, { type OptimizationFeedback, type OptimizationResult } from '@/components/OptimizationTrigger'
import PromptOptimizer from '../../components/PromptOptimizer'
import { TestCaseCard, DatasetActions, ExportToDatasetModal, ImportFromDatasetModal } from '@/components/prompt'
import AssistantChat from '@/components/prompt-assistant/AssistantChat'
import RequestDetailsModal from '../../components/RequestDetailsModal'
import PromptHistoryDrawer from '../../components/PromptHistoryDrawer'
import type { PromptVersion, TestCase } from "@/types/prompt"
import type { AvailableModel } from "@/types/llm"
import type { AssistantContext } from "@/types/promptAssistant"

const { Text } = Typography
const { Option } = Select











interface Message {
    id?: number;
    role: string;
    content: string;
    order: number;
}

interface OutputItem {
    id: number;
    model: string;
    timestamp: Date;
    response: string;
    cost: number; // 费用,美元
    execution_time: number; // 执行时间,毫秒
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
        projectId: number;
        promptId?: number;
        promptVersionId?: number;
        source?: string;
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
    language?: 'zh' | 'en' | 'compare';
}

// 预定义数据
const MESSAGE_ROLES = [
    { name: "System", value: "system", icon: "🛡️", color: "#722ed1" },
    { name: "User", value: "user", icon: "👤", color: "#1890ff" },
    { name: "Assistant", value: "assistant", icon: "🤖", color: "#52c41a" },
    { name: "Function", value: "function", icon: "⚡", color: "#fa8c16" },
];



// 模型配置变更对比组件
const ModelConfigDiff = ({ oldConfig, newConfig }: {
    oldConfig: ModelConfig,
    newConfig: ModelConfig,
}) => {
    
    const changes = [];

    // 检查模型变更
    if (oldConfig.model !== newConfig.model || oldConfig.provider !== newConfig.provider) {

        changes.push({
            key: '模型',
            oldValue: `${oldConfig.provider} / ${oldConfig.model}`,
            newValue: `${newConfig.provider} / ${newConfig.model}`
        });
    }

    // 检查参数变更
    const paramKeys: (keyof ModelConfig)[] = ['temperature', 'top_p', 'max_tokens', 'presence_penalty', 'frequency_penalty'];
    const paramNames = {
        temperature: 'Temperature',
        top_p: 'Top P',
        max_tokens: 'Max Tokens',
        presence_penalty: 'Presence Penalty',
        frequency_penalty: 'Frequency Penalty'
    } as Record<keyof ModelConfig, string>;

    paramKeys.forEach(key => {
        const oldVal = oldConfig[key];
        const newVal = newConfig[key];
        if (oldVal !== newVal) {
            changes.push({
                key: paramNames[key],
                oldValue: oldVal !== undefined ? String(oldVal) : '默认',
                newValue: newVal !== undefined ? String(newVal) : '默认'
            });
        }
    });

    if (changes.length === 0) {
        return null;
    }

    return (
        <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                <SettingOutlined style={{ color: '#fa8c16', marginRight: 4 }} />
                <Text strong style={{ fontSize: '13px' }}>{'模型配置'}{'变更'}</Text>
                <Tag color="orange" style={{ marginLeft: 8, fontSize: '10px' }}>{changes.length} {'项变更'}</Tag>
            </div>
            <div style={{
                border: '1px solid #d9d9d9',
                borderRadius: '6px',
                overflow: 'hidden'
            }}>
                {changes.map((change, index) => (
                    <div key={index} style={{
                        padding: '8px 12px',
                        borderBottom: index < changes.length - 1 ? '1px solid #f0f0f0' : 'none',
                        background: '#fafafa'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
                            <Text strong style={{ fontSize: '12px', minWidth: '80px' }}>{change.key}</Text>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{
                                padding: '2px 6px',
                                background: '#fff2f0',
                                borderRadius: '3px',
                                fontSize: '11px',
                                fontFamily: 'monospace'
                            }}>
                                {change.oldValue}
                            </div>
                            <ArrowRightOutlined style={{ fontSize: '10px', color: '#999' }} />
                            <div style={{
                                padding: '2px 6px',
                                background: '#f6ffed',
                                borderRadius: '3px',
                                fontSize: '11px',
                                fontFamily: 'monospace'
                            }}>
                                {change.newValue}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// 提取变量函数
const extractVariables = (text: string): string[] => {
    const regex = /{{([\w\u4e00-\u9fa5\u0800-\u4e00\uf900-\ufaff]+)}}/g;
    const matches = text.match(regex) || [];
    return [...new Set(matches.map(match => match.slice(2, -2)))];
}

// 新增：智能变量管理函数 - 优化版本
const smartVariableUpdate = (
    currentVars: string[],
    newVars: string[],
    testCases: TestCase[]
): { updatedVars: string[], updatedCases: TestCase[] } => {
    const varsToAdd = newVars.filter(v => !currentVars.includes(v));
    const varsToRemove = currentVars.filter(v => !newVars.includes(v));

    // 如果没有变量变化，直接返回原数据
    if (varsToAdd.length === 0 && varsToRemove.length === 0) {
        return { updatedVars: currentVars, updatedCases: testCases };
    }

    // 更新变量列表
    const updatedVars = newVars;

    // 只有在真正需要更新时才处理测试用例
    const updatedCases = testCases.map(testCase => {
        let needsUpdate = false;
        const newCase = { ...testCase };

        // 添加新变量
        varsToAdd.forEach(v => {
            if (!newCase[v]) {
                newCase[v] = "";
                needsUpdate = true;
            }
        });

        // 移除已删除的变量
        varsToRemove.forEach(v => {
            if (v in newCase) {
                delete newCase[v];
                needsUpdate = true;
            }
        });

        return needsUpdate ? newCase : testCase; // 只有需要更新时才返回新对象
    });

    return { updatedVars, updatedCases };
};



interface EditorPageProps {
    onStateChange?: (hasEdited: boolean) => void;
    onBackToOverview?: () => void;
}

export const PromptEditorPage = forwardRef<{ hasEdited: boolean }, EditorPageProps>(
    function PromptEditorPage({ onStateChange }, ref) {
        
        const { projectJumpTo } = useProjectJump();
        const params = useParams();
        const [searchParams] = useSearchParams();
        const projectId = params.projectId;
        const promptId = params.id as string;
        const versionParam = searchParams.get('version');
        const navigate = useNavigate();

        // 初始化状态
        const [promptName, setPromptName] = useState<string>('提示词编辑器');
        const [versions, setVersions] = useState<PromptVersion[]>([]);
        const [_, setLoading] = useState(true);

        // 核心状态
        const [messages, setMessages] = useState<Message[]>([
            { role: "system", content: "", order: 0 },
            { role: "user", content: "", order: 1 }
        ]);
        const [variables, setVariables] = useState<string[]>([]);
        const [testCases, setTestCases] = useState<TestCase[]>([]);
        const [outputs, setOutputs] = useState<OutputItem[]>([]);
        const [isLoading, setIsLoading] = useState(false);
        const [hasEdited, setHasEdited] = useState(false);
        const [promptVersionId, setPromptVersionId] = useState<string | null>(null);
        const [currentVersion, setCurrentVersion] = useState<any>(null);

        // 双语编辑状态
        const [languageMode, setLanguageMode] = useState<'zh' | 'en' | 'compare'>('zh');
        const [englishMessages, setEnglishMessages] = useState<Message[]>([
            { role: "system", content: "", order: 0 },
            { role: "user", content: "", order: 1 }
        ]);
        const [isTranslating, setIsTranslating] = useState(false);
        const isUpdatingFromTranslationRef = useRef(false);

        // 动态模型相关状态
        const [availableModels, setAvailableModels] = useState<AvailableModel[]>([]);
        const [_modelsLoading, setModelsLoading] = useState(true);

        // 模型配置
        const [modelConfig, setModelConfig] = useState<ModelConfig>({
            provider: '',
            model: ''
        });

        // UI状态
        const [showModelSettings, setShowModelSettings] = useState(false);
        const [saveDialogOpen, setSaveDialogOpen] = useState(false);
        const [promptVersionName, setPromptVersionName] = useState("");
        const [treeExpandedKeys, setTreeExpandedKeys] = useState<string[]>([]);
        const [selectOpen, setSelectOpen] = useState(false);

        // 添加消息引用管理
        const messageRefs = useRef<(HTMLDivElement | null)[]>([]);

        // 添加文本编辑器引用管理
        const textAreaRefs = useRef<{ [key: string]: HTMLTextAreaElement | null }>({});

        // 添加测试用例引用管理
        const testCaseRefs = useRef<(HTMLDivElement | null)[]>([]);

        // 添加变量定位状态跟踪
        const variablePositionState = useRef<{
            [key: string]: { // key: `${messageIndex}-${variable}`
                currentIndex: number;
                totalCount: number;
                currentLanguage?: 'zh' | 'en'; // 对照模式下当前定位的语言
            }
        }>({});

        // 添加请求取消控制器
        const abortControllerRef = useRef<AbortController | null>(null);

        // 强制同步 showModelSettings 和 selectOpen 状态
        useEffect(() => {
            if (!showModelSettings && selectOpen) {
                setSelectOpen(false);
            }
        }, [showModelSettings, selectOpen]);

        const [currentTestCase, setCurrentTestCase] = useState(0);



        // 新增：防抖相关状态
        const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
        const lastExtractedVarsRef = useRef<string[]>([]);

        // 添加消息编辑防抖定时器
        const messageEditDebounceRef = useRef<NodeJS.Timeout | null>(null);

        // 管理测试用例引用数组长度
        useEffect(() => {
            testCaseRefs.current = testCaseRefs.current.slice(0, testCases.length);
            while (testCaseRefs.current.length < testCases.length) {
                testCaseRefs.current.push(null);
            }
        }, [testCases.length]);

        // 新增：滚动到指定测试用例的函数
        const scrollToTestCase = useCallback((testCaseIndex: number) => {
            const targetRef = testCaseRefs.current[testCaseIndex];
            if (targetRef) {
                // 先滚动到测试用例
                targetRef.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center'
                });

                // 添加高亮效果
                targetRef.style.transition = 'box-shadow 0.3s ease, transform 0.3s ease';
                targetRef.style.boxShadow = '0 0 20px rgba(24, 144, 255, 0.6)';
                targetRef.style.transform = 'scale(1.02)';

                // 设置当前选中的测试用例
                setCurrentTestCase(testCaseIndex);

                setTimeout(() => {
                    targetRef.style.boxShadow = '';
                    targetRef.style.transform = '';
                }, 2000);
            }
        }, []);

        // 使用 useMemo 缓存变量分组计算
        const variableGroups = useMemo(() => {
            if (languageMode === 'compare') {
                // 对照模式：合并中英文消息的变量
                const groups: Array<{
                    messageIndex: number;
                    role: string;
                    variables: string[];
                    preview: string;
                    source: 'zh' | 'en' | 'both';
                }> = [];

                for (let index = 0; index < Math.max(messages.length, englishMessages.length); index++) {
                    const zhMsg = messages[index];
                    const enMsg = englishMessages[index];

                    if (zhMsg || enMsg) {
                        const zhVars = zhMsg ? extractVariables(zhMsg.content) : [];
                        const enVars = enMsg ? extractVariables(enMsg.content) : [];
                        const allVars = [...new Set([...zhVars, ...enVars])];

                        if (allVars.length > 0) {
                            const role = zhMsg?.role || enMsg?.role || 'user';
                            const preview = zhMsg?.content || enMsg?.content || '';
                            groups.push({
                                messageIndex: index,
                                role,
                                variables: allVars,
                                preview: preview.slice(0, 20) + (preview.length > 20 ? '...' : ''),
                                source: zhVars.length > 0 && enVars.length > 0 ? 'both' :
                                    zhVars.length > 0 ? 'zh' : 'en'
                            });
                        }
                    }
                }
                return groups;
            } else {
                // 单语言模式
                const messagesToAnalyze = languageMode === 'zh' ? messages : englishMessages;

                return messagesToAnalyze.map((msg, index) => {
                    const varsInMessage = extractVariables(msg.content);
                    return {
                        messageIndex: index,
                        role: msg.role,
                        variables: varsInMessage,
                        preview: msg.content.slice(0, 20) + (msg.content.length > 20 ? '...' : ''),
                        source: languageMode as 'zh' | 'en'
                    };
                }).filter(item => item.variables.length > 0);
            }
        }, [messages, englishMessages, languageMode]);

        // 移除原来的 getVariablesByMessage 函数，使用 useMemo 缓存的结果

        // 新增：获取变量在文本中的所有位置
        const findAllVariablePositions = (content: string, variable: string): number[] => {
            const variablePattern = `{{${variable}}}`;
            const positions: number[] = [];
            let startIndex = 0;

            while (true) {
                const index = content.indexOf(variablePattern, startIndex);
                if (index === -1) break;
                positions.push(index);
                startIndex = index + variablePattern.length;
            }

            return positions;
        };

        // 使用 useCallback 优化函数引用
        const scrollToVariable = useCallback((messageIndex: number, variable: string) => {
            const variablePattern = `{{${variable}}}`;
            const stateKey = `${messageIndex}-${variable}`;

            // 定义精确滚动到指定位置的函数
            const scrollToPosition = (refKey: string, content: string, targetIndex: number) => {
                const textArea = textAreaRefs.current[refKey];
                if (!textArea || !content) return false;

                const positions = findAllVariablePositions(content, variable);
                if (positions.length === 0 || targetIndex >= positions.length) return false;

                const startIndex = positions[targetIndex];
                const endIndex = startIndex + variablePattern.length;

                // 先滚动到消息卡片
                const targetRef = messageRefs.current[messageIndex];
                if (targetRef) {
                    targetRef.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }

                // 延迟一点再操作文本选择，确保滚动完成
                setTimeout(() => {
                    // 聚焦到文本区域
                    textArea.focus();

                    // 选中变量文本
                    textArea.setSelectionRange(startIndex, endIndex);

                    // 简化的滚动定位方法
                    const scrollToSelection = () => {
                        try {
                            // 方法1: 使用DOM精确测量（最准确）
                            const tempDiv = document.createElement('div');
                            const computedStyle = getComputedStyle(textArea);

                            // 完全复制TextArea的样式
                            tempDiv.style.cssText = `
                                position: absolute;
                                left: -9999px;
                                top: -9999px;
                                width: ${textArea.clientWidth}px;
                                font-family: ${computedStyle.fontFamily};
                                font-size: ${computedStyle.fontSize};
                                line-height: ${computedStyle.lineHeight};
                                padding: ${computedStyle.padding};
                                border: none;
                                white-space: pre-wrap;
                                word-wrap: break-word;
                                overflow-wrap: break-word;
                                box-sizing: ${computedStyle.boxSizing};
                            `;

                            // 设置到变量位置之前的文本
                            tempDiv.textContent = content.substring(0, startIndex);
                            document.body.appendChild(tempDiv);

                            // 获取实际高度
                            const actualHeight = tempDiv.offsetHeight;
                            document.body.removeChild(tempDiv);

                            // 计算目标滚动位置（将变量位置居中显示）
                            const targetScrollTop = Math.max(0, actualHeight - textArea.clientHeight / 2);

                            // 设置滚动位置
                            textArea.scrollTop = targetScrollTop;

                        } catch (error) {
                            // 方法2: 简单行计算备用
                            console.log('使用备用滚动方法', error);

                            const beforeText = content.substring(0, startIndex);
                            const lines = beforeText.split('\n').length;

                            // 根据实际字体大小计算行高
                            const fontSize = parseInt(getComputedStyle(textArea).fontSize) || 14;
                            const lineHeight = fontSize * 1.4; // 一般行高是字体大小的1.4倍

                            const approximateTop = (lines - 1) * lineHeight;
                            const targetTop = Math.max(0, approximateTop - textArea.clientHeight / 2);
                            textArea.scrollTop = targetTop;
                        }
                    };

                    // 立即执行滚动定位
                    scrollToSelection();

                    // 添加高亮效果到消息卡片
                    if (targetRef) {
                        targetRef.style.transition = 'box-shadow 0.3s ease';
                        targetRef.style.boxShadow = '0 0 20px rgba(255, 193, 7, 0.6)'; // 橙色高亮表示变量定位

                        setTimeout(() => {
                            targetRef.style.boxShadow = '';
                        }, 3000);
                    }
                }, 300); // 等待滚动动画完成

                return true;
            };

            // 初始化或获取状态
            if (!variablePositionState.current[stateKey]) {
                // 计算总出现次数
                let totalCount = 0;
                let zhCount = 0;
                let enCount = 0;

                if (languageMode === 'compare') {
                    const zhMsg = messages[messageIndex];
                    const enMsg = englishMessages[messageIndex];

                    if (zhMsg) {
                        zhCount = findAllVariablePositions(zhMsg.content, variable).length;
                    }
                    if (enMsg) {
                        enCount = findAllVariablePositions(enMsg.content, variable).length;
                    }
                    totalCount = zhCount + enCount;

                    variablePositionState.current[stateKey] = {
                        currentIndex: 0,
                        totalCount,
                        currentLanguage: zhCount > 0 ? 'zh' : 'en'
                    };
                } else {
                    const messagesToAnalyze = languageMode === 'zh' ? messages : englishMessages;
                    const message = messagesToAnalyze[messageIndex];

                    if (message) {
                        totalCount = findAllVariablePositions(message.content, variable).length;
                    }

                    variablePositionState.current[stateKey] = {
                        currentIndex: 0,
                        totalCount,
                        currentLanguage: languageMode as 'zh' | 'en'
                    };
                }
            }

            const state = variablePositionState.current[stateKey];
            if (state.totalCount === 0) return;

            // 根据语言模式处理定位
            if (languageMode === 'compare') {
                const zhMsg = messages[messageIndex];
                const enMsg = englishMessages[messageIndex];
                const zhPositions = zhMsg ? findAllVariablePositions(zhMsg.content, variable) : [];
                const enPositions = enMsg ? findAllVariablePositions(enMsg.content, variable) : [];

                // 计算当前应该定位的位置
                if (state.currentLanguage === 'zh' && zhPositions.length > 0) {
                    const zhIndex = state.currentIndex;
                    if (zhIndex < zhPositions.length) {
                        // 在中文消息中定位
                        scrollToPosition(`zh-${messageIndex}`, zhMsg!.content, zhIndex);

                        // 更新状态
                        if (zhIndex + 1 >= zhPositions.length) {
                            // 中文定位完毕，切换到英文
                            state.currentLanguage = 'en';
                            state.currentIndex = 0;
                        } else {
                            state.currentIndex++;
                        }
                        return;
                    }
                }

                if (state.currentLanguage === 'en' && enPositions.length > 0) {
                    const enIndex = state.currentIndex;
                    if (enIndex < enPositions.length) {
                        // 在英文消息中定位
                        scrollToPosition(`en-${messageIndex}`, enMsg!.content, enIndex);

                        // 更新状态
                        if (enIndex + 1 >= enPositions.length) {
                            // 英文定位完毕，循环回中文开始
                            state.currentLanguage = 'zh';
                            state.currentIndex = 0;
                        } else {
                            state.currentIndex++;
                        }
                        return;
                    }
                }

                // 如果当前语言没有变量，切换到另一种语言
                if (state.currentLanguage === 'zh' && zhPositions.length === 0) {
                    state.currentLanguage = 'en';
                    state.currentIndex = 0;
                } else if (state.currentLanguage === 'en' && enPositions.length === 0) {
                    state.currentLanguage = 'zh';
                    state.currentIndex = 0;
                }

            } else {
                // 单语言模式：简单循环
                const messagesToAnalyze = languageMode === 'zh' ? messages : englishMessages;
                const message = messagesToAnalyze[messageIndex];

                if (message) {
                    const positions = findAllVariablePositions(message.content, variable);
                    if (positions.length > 0) {
                        scrollToPosition(`${languageMode}-${messageIndex}`, message.content, state.currentIndex);

                        // 更新状态：循环到下一个位置
                        state.currentIndex = (state.currentIndex + 1) % positions.length;
                    }
                }
            }
        }, [languageMode, messages, englishMessages]);

        // 数据集操作相关状态
        const [exportToDatasetModalVisible, setExportToDatasetModalVisible] = useState(false);
        const [importFromDatasetModalVisible, setImportFromDatasetModalVisible] = useState(false);
        
        // JSON导入相关状态
        const [jsonImportModalVisible, setJsonImportModalVisible] = useState(false);

        // 自动生成测试用例相关状态
        const [generateModalVisible, setGenerateModalVisible] = useState(false);

        // 提示词优化相关状态
        const [feedbackModalVisible, setFeedbackModalVisible] = useState(false);
        const [selectedOutputForFeedback, setSelectedOutputForFeedback] = useState<OutputItem | null>(null);
        const [optimizationModalVisible, setOptimizationModalVisible] = useState(false);
        const [singleOptimizationData, setSingleOptimizationData] = useState<{
            outputItem: OutputItem;
            feedback: OptimizationFeedback;
            onUpdateStatus: (outputId: number, status: 'optimizing' | 'completed' | 'failed' | 'cancelled', result?: any, error?: string) => void;
        } | undefined>(undefined);
        
        // 存储每个运行结果的优化输入记录
        const [optimizationInputRecords, setOptimizationInputRecords] = useState<Map<number, {
            description: string;
            expectedOutput: string;
        }>>(new Map());

        // 请求详情弹窗状态
        const [requestDetailsModalVisible, setRequestDetailsModalVisible] = useState(false);
        const [selectedOutputForDetails, setSelectedOutputForDetails] = useState<OutputItem | null>(null);

        // 历史记录抽屉状态
        const [historyDrawerVisible, setHistoryDrawerVisible] = useState(false);

        // 编辑器模式状态 - 从本地存储读取上次保存的模式
        const [editorMode, setEditorMode] = useState<'writing' | 'testing'>(() => {
            return promptId ? getEditorModePreference(promptId) : 'testing';
        });

        // useImperativeHandle
        useImperativeHandle(ref, () => ({
            hasEdited
        }), [hasEdited]);

        // 初始化数据加载
        useEffect(() => {
            const loadData = async () => {
                try {
                    setLoading(true);

                    const promptResponse = await PromptsAPI.getPrompt(Number(promptId));
                    if (promptResponse.data.name) {
                        setPromptName(promptResponse.data.name);
                    }

                    const versionsResponse = await PromptsAPI.getVersions(Number(promptId));
                    const versionList = versionsResponse.data;
                    setVersions(versionList);

                    // 确定要使用的版本ID
                    let targetVersionId = versionParam;
                    if (!targetVersionId && versionList.length > 0) {
                        // 如果没有version参数，使用最新版本（第一个）
                        targetVersionId = versionList[0].id.toString();
                    }

                    // 更新URL以包含版本参数（仅当有有效版本ID时）
                    if (targetVersionId && !versionParam) {
                        const url = new URL(window.location.href);
                        url.searchParams.set('version', targetVersionId);
                        window.history.replaceState({}, '', url.toString());
                    }

                    setPromptVersionId(targetVersionId);
                    setLoading(false);
                } catch (error) {
                    console.error('加载数据失败', error);
                    setLoading(false);
                }
            };

            if (promptId) {
                loadData();
            }
        }, [promptId, versionParam]);

        // 加载可用模型
        useEffect(() => {
            const loadAvailableModels = async () => {
                try {
                    setModelsLoading(true);
                    const response = await ModelsAPI.getAvailableModels(Number(projectId));
                    setAvailableModels(response.data);

                    // 如果没有设置模型，选择第一个可用模型
                    if (response.data.length > 0 && !modelConfig.model) {
                        const firstModel = response.data[0];
                        setModelConfig({
                            provider: firstModel.provider_type,
                            model: firstModel.model_id
                        });
                        setTreeExpandedKeys([firstModel.provider_type]);
                    }
                } catch (error) {
                    console.error('加载可用模型失败', error);
                    message.error('加载模型列表失败');
                } finally {
                    setModelsLoading(false);
                }
            };

            if (projectId) {
                loadAvailableModels();
            }
        }, [projectId]);

        useEffect(() => {
            if (onStateChange) {
                onStateChange(hasEdited);
            }
        }, [hasEdited, onStateChange]);

        // 版本加载功能
        const loadVersionContent = async () => {
            if (!promptId || !promptVersionId) return;

            try {
                // 标记正在加载版本，避免触发变量提取
                isUpdatingFromTranslationRef.current = true;

                const response = await PromptsAPI.getVersion(Number(promptId), Number(promptVersionId));
                const version = response.data;

                setCurrentVersion(version);

                // 加载消息
                if (version.messages && version.messages.length > 0) {
                    setMessages(version.messages.sort((a: any, b: any) => a.order - b.order));
                }

                // 加载变量
                if (version.variables && version.variables.length > 0) {
                    setVariables(version.variables);
                }

                // 加载模型配置
                if (version.model_params) {
                    const params = version.model_params;
                    setModelConfig({
                        provider: params.provider || '',
                        model: params.model || '',
                        temperature: params.temperature,
                        top_p: params.top_p,
                        max_tokens: params.max_tokens,
                        presence_penalty: params.presence_penalty,
                        frequency_penalty: params.frequency_penalty,
                        language: params.language
                    });

                    // 加载双语数据
                    if (params.bilingual_data) {
                        const bilingualData = params.bilingual_data;
                        if (bilingualData.chinese_messages) {
                            setMessages(bilingualData.chinese_messages);
                        }
                        if (bilingualData.english_messages) {
                            setEnglishMessages(bilingualData.english_messages);
                        }
                        // 根据保存的语言设置语言模式
                        if (params.language) {
                            setLanguageMode(params.language);
                        }
                    }

                    const language = params.language || 'zh';
                    setLanguageMode(language);
                }

                // 加载测试用例
                try {
                    const testCasesResponse = await PromptsAPI.getTestCases(Number(promptId), Number(promptVersionId));
                    if (testCasesResponse.data && testCasesResponse.data.length > 0) {
                        const cases = testCasesResponse.data.map((tc: any) => {
                            const testCase = tc.variables_values;
                            // 为旧数据添加默认元数据（兼容性处理）
                            if (!tc.metadatas) {
                                testCase.metadatas = {
                                    source: 'manual',
                                    generatedAt: new Date(tc.created_at || Date.now()).toISOString()
                                };
                            } else {
                                testCase.metadatas = tc.metadatas;
                            }
                            return testCase;
                        });
                        setTestCases(cases);
                    }
                } catch (testCaseError) {
                    console.log('没有测试用例或加载测试用例失败');
                }

                setHasEdited(false);

                // 重置标记
                setTimeout(() => {
                    isUpdatingFromTranslationRef.current = false;
                }, 100);
            } catch (error) {
                console.error('加载版本内容失败', error);
                message.error('加载版本内容失败');
                isUpdatingFromTranslationRef.current = false;
            }
        };

        // 初始化加载
        useEffect(() => {
            if (promptVersionId) {
                loadVersionContent();
            }
        }, [promptId, promptVersionId]);

        // 页面离开确认
        useEffect(() => {
            const handleBeforeUnload = (e: BeforeUnloadEvent) => {
                        if (hasEdited) {
            const message = '您有未保存的更改，确定要返回吗？';
                    e.preventDefault();
                    e.returnValue = message;
                    return message;
                }
            };

            window.addEventListener('beforeunload', handleBeforeUnload);

            return () => {
                window.removeEventListener('beforeunload', handleBeforeUnload);
            };
        }, [hasEdited]);

        // 双语翻译功能
        const handleTranslate = async (targetLanguage: 'zh' | 'en') => {
            const messagesToTranslate = targetLanguage === 'zh' ? englishMessages : messages;
            if (!messagesToTranslate.length) return;

            setIsTranslating(true);
            try {
                const translatedMessages = await translateMessages(
                    messagesToTranslate,
                    englishMessages,
                    targetLanguage,
                    Number(projectId),
                    promptId ? Number(promptId) : undefined,
                    promptVersionId ? Number(promptVersionId) : undefined,
                );

                // 标记正在从翻译更新，避免触发变量提取
                isUpdatingFromTranslationRef.current = true;

                if (targetLanguage === 'en') {
                    setEnglishMessages(translatedMessages);
                } else {
                    setMessages(translatedMessages);
                }

                // 短暂延迟后重置标记，确保状态更新完成
                setTimeout(() => {
                    isUpdatingFromTranslationRef.current = false;
                }, 100);

                message.success(`已成功翻译为${targetLanguage}`);
                setHasEdited(true);

            } catch (error) {
                console.error('翻译过程失败', error);
                message.error('翻译失败，请重试');
            } finally {
                setIsTranslating(false);
            }
        };

        const switchToLanguageMode = (mode: 'zh' | 'en' | 'compare') => {
            setLanguageMode(mode);
        };

        // 核心功能函数
        const updateModelConfig = (key: keyof ModelConfig, value: any | undefined) => {
            setModelConfig({
                ...modelConfig,
                [key]: value
            });
            setHasEdited(true);
        };

        // 优化消息内容更新 - 添加防抖
        const updateMessageContent = useCallback((index: number, content: string) => {
            // 立即更新UI显示
            const newMessages = [...messages];
            newMessages[index] = { ...newMessages[index], content };
            setMessages(newMessages);
            setHasEdited(true);

            // 防抖处理变量提取（避免频繁计算）
            if (messageEditDebounceRef.current) {
                clearTimeout(messageEditDebounceRef.current);
            }

            // 延迟触发变量提取，减少性能开销
            messageEditDebounceRef.current = setTimeout(() => {
                // 这里不需要额外操作，变量提取由useEffect自动处理
                // 防抖的目的是减少useEffect的触发频率
            }, 300);
        }, [messages]);

        // 英文消息内容更新 - 添加防抖
        const updateEnglishMessageContent = useCallback((index: number, content: string) => {
            const newEnglishMessages = [...englishMessages];
            if (!newEnglishMessages[index]) {
                newEnglishMessages[index] = { role: 'user', content: '', order: index };
            }
            newEnglishMessages[index] = { ...newEnglishMessages[index], content };
            setEnglishMessages(newEnglishMessages);
            setHasEdited(true);

            // 同样的防抖机制
            if (messageEditDebounceRef.current) {
                clearTimeout(messageEditDebounceRef.current);
            }

            messageEditDebounceRef.current = setTimeout(() => {
                // 延迟触发变量提取
            }, 300);
        }, [englishMessages]);

        // 清理防抖定时器
        useEffect(() => {
            return () => {
                if (messageEditDebounceRef.current) {
                    clearTimeout(messageEditDebounceRef.current);
                }
            };
        }, []);

        const updateMessageRole = (index: number, role: string) => {
            const newMessages = [...messages];
            newMessages[index] = { ...newMessages[index], role };
            setMessages(newMessages);
            setHasEdited(true);
        };

        const addMessage = () => {
            const newOrder = messages.length > 0
                ? Math.max(...messages.map(m => m.order)) + 1
                : 0;

            setMessages([
                ...messages,
                {
                    role: "user",
                    content: "",
                    order: newOrder
                }
            ]);
            setHasEdited(true);
        };

        const handleCopyMessage = (index: number) => {
            const messageToCopy = messages[index];
            const newMessages = [...messages];
            const newMessage = {
                ...messageToCopy,
                order: messageToCopy.order + 1
            };

            for (let i = index + 1; i < newMessages.length; i++) {
                newMessages[i] = {
                    ...newMessages[i],
                    order: newMessages[i].order + 1
                };
            }

            newMessages.splice(index + 1, 0, newMessage);
            setMessages(newMessages);
            setHasEdited(true);
        };

        const handleDeleteMessage = (index: number) => {
                    if (messages.length <= 1) {
            message.warning('至少需要保留一条消息');
                return;
            }

            const newMessages = [...messages];
            newMessages.splice(index, 1);

            for (let i = index; i < newMessages.length; i++) {
                newMessages[i] = {
                    ...newMessages[i],
                    order: newMessages[i].order - 1
                };
            }

            setMessages(newMessages);
            setHasEdited(true);
        };

        const addTestCase = () => {
            const newCase: TestCase = {};
            variables.forEach(variable => {
                newCase[variable] = "";
            });
            // 添加手动创建的元数据
            newCase.metadatas = {
                source: 'manual',
                generatedAt: new Date().toISOString()
            };
            setTestCases([newCase, ...testCases]);
        };

        const deleteTestCase = useCallback((index: number) => {
            setTestCases(prevCases => {
                const newCases = [...prevCases];
                newCases.splice(index, 1);
                return newCases;
            });

            // 更新当前选中的测试用例索引
            setCurrentTestCase(prev => {
                if (prev === index) {
                    return Math.min(prev, testCases.length - 2); // -2 因为删除了一个
                } else if (prev > index) {
                    return prev - 1;
                }
                return prev;
            });
        }, [testCases.length]);

        // 删除所有测试用例
        const deleteAllTestCases = useCallback(() => {
            setTestCases([]);
            setCurrentTestCase(0);
            message.success(`已删除所有 ${testCases.length} 个测试用例`);
        }, [testCases.length]);

        const updateTestCase = useCallback((index: number, variable: string, value: string) => {
            setTestCases(prevCases => {
                // 使用函数式更新，只更新特定索引的测试用例
                const newCases = [...prevCases];
                newCases[index] = {
                    ...newCases[index],
                    [variable]: value
                };
                return newCases;
            });
        }, []);

        const getCurrentModelDisplayName = () => {
            const currentModel = modelConfig.model;
            const foundModel = availableModels.find(m =>
                m.model_id === currentModel && m.provider_type === modelConfig.provider
            );
            return foundModel ? `${foundModel.provider_name}/${foundModel.name}` :
                currentModel ? `${modelConfig.provider}/${currentModel}` : '选择模型';
        };

        // 计算运行结果展示的动态高度
        const getResultDisplayHeight = (content: string, outputCount: number = outputs.length) => {
            const baseLineHeight = 40;
            const minLines = 3.5;
            const maxLinesForMultiple = 5;
            const maxLinesForSingle = 15;

            if (!content) {
                return {
                    maxHeight: `${baseLineHeight * minLines}px`,
                    overflowY: 'auto' as const
                };
            }

            // 计算实际换行符数量
            const explicitLines = (content.match(/\n/g) || []).length + 1; // +1 因为最后一行没有换行符

            // 根据字符长度估算需要的行数（自动换行）
            // 考虑容器宽度和字符宽度，11px字体大约每行35-45个字符
            const estimatedWrappedLines = Math.ceil(content.length / 35);

            // 取较大值，因为实际显示行数是两者的最大值
            const estimatedLines = Math.max(minLines, explicitLines, estimatedWrappedLines);

            let targetLines = minLines;

            if (outputCount === 1) {
                // 单条记录时允许更高的显示高度，给用户更好的阅读体验
                targetLines = Math.min(estimatedLines, maxLinesForSingle);
            } else if (outputCount > 1) {
                // 多条记录时限制最大高度，保持界面紧凑
                targetLines = Math.min(estimatedLines, maxLinesForMultiple);
            }

            return {
                maxHeight: `${baseLineHeight * targetLines}px`,
                overflowY: 'auto' as const
            };
        };

        // 取消当前请求
        const cancelRequest = useCallback(() => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
                abortControllerRef.current = null;
                
                // 更新输出状态，停止所有正在加载的项目
                setOutputs(prevOutputs => 
                    prevOutputs.map(output => 
                        output.isLoading 
                            ? { 
                                ...output, 
                                isLoading: false, 
                                error: '用户已取消请求',
                                response: ''
                              }
                            : output
                    )
                );
                
                // 重置加载状态
                setIsLoading(false);
                
                message.info('已取消请求');
            }
        }, []);

        const handleRun = async () => {
            // 取消之前的请求
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }

            // 创建新的 AbortController
            abortControllerRef.current = new AbortController();
            const signal = abortControllerRef.current.signal;

            setIsLoading(true);
            setOutputs([]);

            try {
                // 根据语言模式确定要运行的消息
                const messagesToRun = languageMode === 'zh' ? messages : englishMessages; // 对照模式默认使用英文消息

                const currentModel = modelConfig.model;
                const config: Record<string, any> = {
                    model: currentModel
                };

                if (modelConfig.provider !== undefined) config.provider = modelConfig.provider;
                if (modelConfig.temperature !== undefined) config.temperature = modelConfig.temperature;
                if (modelConfig.top_p !== undefined) config.top_p = modelConfig.top_p;
                if (modelConfig.max_tokens !== undefined) config.max_tokens = modelConfig.max_tokens;
                if (modelConfig.presence_penalty !== undefined) config.presence_penalty = modelConfig.presence_penalty;
                if (modelConfig.frequency_penalty !== undefined) config.frequency_penalty = modelConfig.frequency_penalty;

                if (testCases.length === 0) {
                    const response = await AiModelAPI.callLLM({
                        messages: messagesToRun,
                        config: config,
                        project_id: Number(projectId),
                        prompt_id: promptId ? Number(promptId) : undefined,
                        prompt_version_id: promptVersionId ? Number(promptVersionId) : undefined,
                        source: LLM_REQUEST_SOURCES.PROMPT_EDITOR_TEST,
                    }, signal);

                    const data = response.data;

                    setOutputs([{
                        id: Date.now(),
                        model: currentModel,
                        timestamp: new Date(),
                        response: data.message,
                        cost: data.cost || 0,
                        execution_time: data.execution_time || 0,
                        tokens: data.tokens,
                        testCase: {},
                        requestDetails: {
                            messages: messagesToRun,
                            modelConfig: config,
                            projectId: Number(projectId),
                            promptId: promptId ? Number(promptId) : undefined,
                            promptVersionId: promptVersionId ? Number(promptVersionId) : undefined,
                            source: LLM_REQUEST_SOURCES.PROMPT_EDITOR_TEST,
                        }
                    }]);
                } else {
                    const placeholders = testCases.map((testCase, index) => ({
                        id: Date.now() + index,
                        model: currentModel,
                        timestamp: new Date(),
                        response: "",
                        cost: 0,
                        execution_time: 0,
                        tokens: {
                            prompt: 0,
                            completion: 0,
                            total: 0
                        },
                        testCase,
                        isLoading: true
                    }));

                    setOutputs(placeholders);

                    // 并发控制 - 限制同时进行的请求数量
                    const MAX_CONCURRENT_REQUESTS = 5;

                    // 处理单个测试用例的函数
                    const processTestCase = async (testCase: any, index: number): Promise<void> => {
                            const processedMessages = messagesToRun.map(msg => ({
                                role: msg.role,
                                content: msg.content.replace(/{{(\w+)}}/g, (_, key) => testCase[key] || `{{${key}}}`)
                            }));
                        
                        try {

                            const response = await AiModelAPI.callLLM({
                                messages: processedMessages,
                                config: config,
                                project_id: Number(projectId),
                                prompt_id: promptId ? Number(promptId) : undefined,
                                prompt_version_id: promptVersionId ? Number(promptVersionId) : undefined,
                                source: LLM_REQUEST_SOURCES.PROMPT_EDITOR_TEST,
                            }, signal);

                            const data = response.data;

                            setOutputs(prevOutputs =>
                                prevOutputs.map((output, idx) =>
                                    idx === index
                                        ? {
                                            ...output,
                                            response: data.message,
                                            cost: data.cost || 0,
                                            execution_time: data.execution_time || 0,
                                            tokens: data.tokens,
                                            isLoading: false,
                                            requestDetails: {
                                                messages: processedMessages,
                                                modelConfig: config,
                                                projectId: Number(projectId),
                                                promptId: promptId ? Number(promptId) : undefined,
                                                promptVersionId: promptVersionId ? Number(promptVersionId) : undefined,
                                                source: LLM_REQUEST_SOURCES.PROMPT_EDITOR_TEST,
                                            }
                                        }
                                        : output
                                )
                            );
                        } catch (error: any) {
                            // 检查是否因为取消导致的错误
                            if (signal.aborted || error.name === 'CanceledError' || error.code === 'ERR_CANCELED') {
                                console.log(`测试用例 ${index + 1} 请求被用户取消`);
                                return;
                            }
                            
                            console.error(`测试用例 ${index + 1} 调用模型时出错:`, error);
                            const errorMessage = error.response?.data?.detail || '调用模型时出错';

                            setOutputs(prevOutputs =>
                                prevOutputs.map((output, idx) =>
                                    idx === index
                                        ? {
                                            ...output,
                                            response: "",
                                            error: errorMessage,
                                            isLoading: false,
                                            requestDetails: {
                                                messages: processedMessages,
                                                modelConfig: config,
                                                projectId: Number(projectId),
                                                promptId: promptId ? Number(promptId) : undefined,
                                                promptVersionId: promptVersionId ? Number(promptVersionId) : undefined,
                                                source: LLM_REQUEST_SOURCES.PROMPT_EDITOR_TEST,
                                            }
                                        }
                                        : output
                                )
                            );
                        }
                    };

                    // 使用并发控制处理所有测试用例
                    await processWithConcurrency(testCases, processTestCase, MAX_CONCURRENT_REQUESTS);
                }
            } catch (error: any) {
                // 检查是否因为取消导致的错误
                if (signal.aborted || error.name === 'CanceledError' || error.code === 'ERR_CANCELED') {
                    console.log('Request was cancelled by user');
                    return;
                }
                
                console.error('调用模型时出错', error);
                const errorMessage = error.response?.data?.detail || '调用模型时出错';
                message.error(errorMessage);
            } finally {
                setIsLoading(false);
                // 清除 AbortController 引用
                abortControllerRef.current = null;
            }
        };

        const handleCopyOutput = async (text: string) => {
                        const success = await copyToClipboard(text);
        if (success) {
            message.success('复制成功');
        } else {
            message.error('复制失败');
        }
        };

        const handleSaveNewVersion = async () => {
            if (!promptId) return;

            try {
                // 根据语言模式确定要保存的消息, 默认使用englishMessages
                const messagesToSave = languageMode === 'zh' ? messages : englishMessages;
                const currentModelName = modelConfig.model;

                let modelParams = {
                    provider: modelConfig.provider,
                    model: currentModelName,
                    temperature: modelConfig.temperature,
                    top_p: modelConfig.top_p,
                    max_tokens: modelConfig.max_tokens,
                    presence_penalty: modelConfig.presence_penalty,
                    frequency_penalty: modelConfig.frequency_penalty,
                    // 添加语言标记
                    language: languageMode,
                    // 如果有双语版本，保存为额外信息
                    bilingual_data: languageMode === 'compare' || englishMessages.length > 0 ? {
                        chinese_messages: messages,
                        english_messages: englishMessages
                    } : undefined
                } as any;

                const response = await PromptsAPI.createVersion(Number(promptId), {
                    prompt_id: Number(promptId),
                    messages: messagesToSave,
                    variables: variables,
                    model_name: currentModelName,
                    model_params: modelParams
                });
                const result = response.data;

                message.success(`提示词已保存为新版本 (${languageMode === 'zh' ? '中文' : 'English'})`);

                setSaveDialogOpen(false);
                setPromptVersionName('');
                setHasEdited(false);

                if (testCases.length > 0) {
                    for (const testCase of testCases) {
                        // 过滤掉元数据字段，只保存变量值
                        const { metadatas, ...variables_values } = testCase;
                        await PromptsAPI.createTestCase(Number(promptId), result.id, {
                            prompt_version_id: result.id,
                            variables_values: variables_values,
                            name: "",
                            metadatas: metadatas
                        });
                    }
                }

                if (result.id) {
                    setPromptVersionId(result.id);
                    setCurrentVersion(result);
                    navigate(projectJumpTo(`prompts/${promptId}/editor?version=${result.id}`));

                    // 刷新版本列表
                    setVersions([result, ...versions]);
                }
            } catch (error) {
                console.error('保存模板失败，请重试', error);
                message.error('保存模板失败，请重试');
            }
        };

        // 优化后的变量提取逻辑 - 修复循环依赖问题，但保持原有延迟
        useEffect(() => {
            // 如果正在从翻译更新，则跳过变量提取
            if (isUpdatingFromTranslationRef.current) {
                return;
            }

            // 清除之前的定时器
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }

            // 设置防抖延迟 - 这里保持原来的延迟用于变量提取
            debounceTimerRef.current = setTimeout(() => {
                let allVars: string[] = [];

                // 根据语言模式确定要检测的消息
                if (languageMode === 'zh') {
                    // 中文模式：只检测中文消息
                    allVars = messages.reduce((acc, msg) => {
                        const msgVars = extractVariables(msg.content);
                        return [...acc, ...msgVars];
                    }, [] as string[]);
                } else if (languageMode === 'en') {
                    // 英文模式：只检测英文消息
                    allVars = englishMessages.reduce((acc, msg) => {
                        const msgVars = extractVariables(msg.content);
                        return [...acc, ...msgVars];
                    }, [] as string[]);
                } else if (languageMode === 'compare') {
                    // 对照模式：同时检测中文和英文消息
                    const chineseVars = messages.reduce((acc, msg) => {
                        const msgVars = extractVariables(msg.content);
                        return [...acc, ...msgVars];
                    }, [] as string[]);

                    const englishVars = englishMessages.reduce((acc, msg) => {
                        const msgVars = extractVariables(msg.content);
                        return [...acc, ...msgVars];
                    }, [] as string[]);

                    allVars = [...chineseVars, ...englishVars];
                }

                const uniqueVars = [...new Set(allVars)];

                // 检查变量是否真的发生了变化
                const lastVars = lastExtractedVarsRef.current;
                const hasChanged = uniqueVars.length !== lastVars.length ||
                    uniqueVars.some(v => !lastVars.includes(v)) ||
                    lastVars.some(v => !uniqueVars.includes(v));

                if (hasChanged) {
                    console.log('Variables changed:', {
                        from: lastVars,
                        to: uniqueVars,
                        added: uniqueVars.filter(v => !lastVars.includes(v)),
                        removed: lastVars.filter(v => !uniqueVars.includes(v))
                    });

                    // 使用函数式更新避免循环依赖
                    setVariables(currentVars => {
                        setTestCases(currentTestCases => {
                            const { updatedCases } = smartVariableUpdate(
                                currentVars,
                                uniqueVars,
                                currentTestCases
                            );

                            // 更新引用
                            lastExtractedVarsRef.current = uniqueVars;

                            return updatedCases;
                        });

                        return uniqueVars;
                    });

                    // 只有在真正变化时才标记为已编辑
                    setHasEdited(true);
                }
            }, 100); // 减少到100ms，因为现在有了消息编辑防抖

            // 清理函数
            return () => {
                if (debounceTimerRef.current) {
                    clearTimeout(debounceTimerRef.current);
                }
            };
        }, [messages, englishMessages, languageMode]);

        // 初始化时更新变量引用
        useEffect(() => {
            if (variables.length > 0) {
                lastExtractedVarsRef.current = variables;
            }
        }, []);

        // 管理消息引用数组长度
        useEffect(() => {
            const currentMessages = languageMode === 'zh' ? messages :
                languageMode === 'en' ? englishMessages :
                    messages;
            messageRefs.current = messageRefs.current.slice(0, currentMessages.length);
            while (messageRefs.current.length < currentMessages.length) {
                messageRefs.current.push(null);
            }
        }, [messages, englishMessages, languageMode]);

        // 重置变量定位状态（当消息内容变化时）
        useEffect(() => {
            // 清空所有变量定位状态，因为消息内容可能已经改变
            variablePositionState.current = {};
        }, [messages, englishMessages]);

        // 数据集操作相关函数
        const handleOpenExportToDatasetModal = () => {
            setExportToDatasetModalVisible(true);
        };

        const handleCloseExportToDatasetModal = () => {
            setExportToDatasetModalVisible(false);
        };

        const handleOpenImportFromDatasetModal = () => {
            setImportFromDatasetModalVisible(true);
        };

        const handleCloseImportFromDatasetModal = () => {
            setImportFromDatasetModalVisible(false);
        };

        // JSON导入相关函数
        const handleOpenJsonImportModal = () => {
            setJsonImportModalVisible(true);
        };

        const handleCloseJsonImportModal = () => {
            setJsonImportModalVisible(false);
        };

        const handleJsonImport = (testCase: TestCase) => {
            // 将新的测试用例添加到最前面
            setTestCases([testCase, ...testCases]);
            setHasEdited(true);
        };

        const handleImportFromDatasetSuccess = (newTestCases: TestCase[]) => {
            setTestCases(prev => [...prev, ...newTestCases]);
            setHasEdited(true);
        };

        // 版本切换处理函数
        const handleVersionChange = (targetVersion: any) => {
            navigate(projectJumpTo(`prompts/${promptId}/editor?version=${targetVersion.id}`));
            setPromptVersionId(targetVersion.id);
            setCurrentVersion(targetVersion);
        };

        // 版本切换确认状态
        const [showVersionConfirm, setShowVersionConfirm] = useState(false);
        const [pendingVersion, setPendingVersion] = useState<any>(null);

        const requestVersionChange = (targetVersion: any) => {
            const isCurrentVersion = Number(promptVersionId) === targetVersion.id;
            if (hasEdited && !isCurrentVersion) {
                setPendingVersion(targetVersion);
                setShowVersionConfirm(true);
            } else {
                handleVersionChange(targetVersion);
            }
        };

        const confirmVersionChange = () => {
            if (pendingVersion) {
                handleVersionChange(pendingVersion);
                setPendingVersion(null);
            }
            setShowVersionConfirm(false);
        };

        // 版本下拉菜单
        const versionMenuItems = versions.map(version => {
            const isCurrentVersion = Number(promptVersionId) === version.id;

            return {
                key: version.id.toString(),
                label: (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: 130 }}>
                        <div>
                            <div style={{ fontWeight: 500 }}>Version {version.version_number}</div>
                            <div style={{ fontSize: '12px', color: '#999' }}>
                                {new Date(version.created_at).toLocaleDateString()}
                            </div>
                        </div>
                        {isCurrentVersion && (
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#1890ff' }} />
                        )}
                    </div>
                ),
                onClick: () => requestVersionChange(version)
            };
        });

        // 自动生成测试用例相关函数
        const handleGenerateTestCases = () => {
            setGenerateModalVisible(true);
        };

        const handleAcceptGeneratedCases = (casesToAdd: TestCase[]) => {
            setTestCases([...testCases, ...casesToAdd]);
            message.success(`已添加 ${casesToAdd.length} 个测试用例`);
        };

        const handleCloseGenerateModal = () => {
            setGenerateModalVisible(false);
        };

        // 提示词优化相关函数
        const handleOpenFeedback = (output: OutputItem) => {
            setSelectedOutputForFeedback(output);
            setFeedbackModalVisible(true);
        };

        // 根据优化状态决定打开哪个弹窗
        const handleOpenOptimizationOrFeedback = (output: OutputItem) => {
            // 如果优化已完成或失败，显示优化结果
            if (output.optimizationStatus === 'completed' || output.optimizationStatus === 'failed') {
                setSingleOptimizationData({
                    outputItem: output,
                    feedback: output.feedback || {
                        description: getOptimizationInputRecord(output.id).description,
                        expectedOutput: getOptimizationInputRecord(output.id).expectedOutput
                    },
                    onUpdateStatus: handleUpdateOptimizationStatus
                });
                setOptimizationModalVisible(true);
            } else {
                // 其他情况（未开始、被取消）：打开反馈弹窗开始新优化
                handleOpenFeedback(output);
            }
        };

        const handleCloseFeedback = () => {
            setFeedbackModalVisible(false);
            setSelectedOutputForFeedback(null);
        };

        // 请求详情相关函数
        const handleOpenRequestDetails = (output: OutputItem) => {
            setSelectedOutputForDetails(output);
            setRequestDetailsModalVisible(true);
        };

        const handleCloseRequestDetails = () => {
            setRequestDetailsModalVisible(false);
            setSelectedOutputForDetails(null);
        };

        // 历史记录相关函数
        const handleOpenHistoryDrawer = () => {
            setHistoryDrawerVisible(true);
        };

        const handleCloseHistoryDrawer = () => {
            setHistoryDrawerVisible(false);
        };

        const handleViewHistoryDetails = (outputItem: OutputItem) => {
            setSelectedOutputForDetails(outputItem);
            setRequestDetailsModalVisible(true);
        };



        const handleStartOptimization = async (outputId: number, feedback: OptimizationFeedback) => {
            const targetOutput = outputs.find(output => output.id === outputId);
            if (!targetOutput) return;

            // 设置反馈信息和优化状态
            setOutputs(prevOutputs =>
                prevOutputs.map(output =>
                    output.id === outputId
                        ? {
                            ...output,
                            hasFeedback: true,
                            feedback: feedback,
                            optimizationStatus: 'optimizing'
                        }
                        : output
                )
            );

            // 设置单例优化数据并打开PromptOptimizer
            setSingleOptimizationData({
                outputItem: targetOutput,
                feedback: feedback,
                onUpdateStatus: handleUpdateOptimizationStatus
            });
            setOptimizationModalVisible(true);
        };

        // 处理优化状态更新
        const handleUpdateOptimizationStatus = (
            outputId: number,
            status: 'optimizing' | 'completed' | 'failed' | 'cancelled',
            result?: any,
            error?: string
        ) => {
            setOutputs(prevOutputs =>
                prevOutputs.map(output =>
                    output.id === outputId
                        ? {
                            ...output,
                            optimizationStatus: status,
                            optimizationResult: result,
                            optimizationError: error
                        }
                        : output
                )
            );
        };



        const handleCloseOptimization = () => {
            setOptimizationModalVisible(false);
        };

        // 从优化弹窗返回反馈弹窗
        const handleReturnToFeedback = () => {
            if (singleOptimizationData) {
                setSelectedOutputForFeedback(singleOptimizationData.outputItem);
                setFeedbackModalVisible(true);
            }
        };

        // 保存优化输入记录
        const saveOptimizationInputRecord = (outputId: number, description: string, expectedOutput: string) => {
            setOptimizationInputRecords(prevRecords => {
                const newRecords = new Map(prevRecords);
                newRecords.set(outputId, { description, expectedOutput });
                return newRecords;
            });
        };

        // 获取优化输入记录
        const getOptimizationInputRecord = (outputId: number) => {
            return optimizationInputRecords.get(outputId) || { description: '', expectedOutput: '' };
        };

        const handleApplyOptimization = (optimizedMessages: Message[]) => {
            // 根据语言模式应用优化后的提示词
            if (languageMode === 'zh') {
                setMessages(optimizedMessages);
            } else {
                setEnglishMessages(optimizedMessages);
            }
            setHasEdited(true);

            // 清除所有反馈标记
            setOutputs(prevOutputs =>
                prevOutputs.map(output => ({
                    ...output,
                    hasFeedback: false,
                    feedback: undefined,
                    isMarkedForOptimization: false
                }))
            );
        };

        // 构建助理上下文
        const assistantContext: AssistantContext = useMemo(() => ({
            currentMessages: languageMode === 'zh' ? messages : 
                            languageMode === 'en' ? englishMessages : messages,
            variables,
            testCases,
            language: languageMode,
            promptName
        }), [messages, englishMessages, variables, testCases, languageMode, promptName]);

         /**
         * 处理上下文更新
         * 当编辑服务成功修改提示词后，这个函数会被调用
         */
        const handleContextUpdate = (newContext: AssistantContext) => {
            console.log('=== Prompt Context Update ===');
            console.log('Original Context:', assistantContext);
            console.log('New Context:', newContext);
            
            // 检查是否真的有变化
            const hasChanges = JSON.stringify(assistantContext) !== JSON.stringify(newContext);
            console.log('Content has changes:', hasChanges);
            
            if (hasChanges) {
                setHasEdited(true);
                if (languageMode === 'zh') {
                    setMessages(newContext.currentMessages);
                } else {
                    setEnglishMessages(newContext.currentMessages);
                }
                message.success('✅ 提示词已成功更新！');
            } else {
                message.warning('⚠️ 提示词内容没有变化');
            }
        };


        const autoSize = (role: string, language: string) => {
            const fallbackConfig = HeightController.getResponsiveBaseConfig(role);
            return {
                minRows: fallbackConfig.minRows,
                maxRows: language === 'compare' ? 
                    Math.round(fallbackConfig.maxRows * 0.8) : // 对照模式稍微减少高度
                    fallbackConfig.maxRows
            };
        };


        const getTreeData = (availableModels: AvailableModel[]) => {
            // 按 providerId 分组
            const groupedByProvider = availableModels.reduce((acc, model) => {
                if (!acc[model.provider_type]) {
                    acc[model.provider_type] = {
                        providerName: model.provider_name,
                        models: []
                    };
                }
                acc[model.provider_type].models.push(model);
                return acc;
            }, {} as Record<string, { providerName: string; models: AvailableModel[] }>);

            // 构建树形数据
            const treeData = Object.entries(groupedByProvider).map(([providerId, group]) => ({
                title: group.providerName,
                key: providerId,
                icon: null,
                selectable: false, // 供应商节点不可选择，只能展开
                children: group.models.map(model => ({
                    title: model.name,
                    key: `${providerId}:${model.model_id}`,
                    icon: null,
                    isLeaf: true,
                    selectable: true, // 模型节点可选择
                    provider: providerId,
                    model: model.model_id
                }))
            }));

            return treeData;
        }

        // 紧凑卡片式布局 - 使用统一高度控制框架
        return (
            <div style={HeightController.getContainerStyle()}>
                {/* 简化的顶部工具栏 */}
                <Card style={HeightController.getToolbarStyle()}>
                    <Row align="middle" style={{ height: '100%' }}>
                        <Col flex="auto">
                            <Space size={12}>
                                {/* 标题和基础信息 */}
                                <div>
                                    <Text strong style={{ fontSize: '16px' }}>
                                        {`${promptName}`}
                                    </Text>
                                    {hasEdited && <Badge dot style={{ marginLeft: 8 }} />}
                                </div>

                                <Divider type="vertical" style={{ height: 24 }} />

                                {/* 模式切换 */}
                                <div>
                                    <Text type="secondary" style={{ fontSize: '12px', marginRight: 8 }}>{'模式'}:</Text>
                                    <Segmented
                                        size="small"
                                        value={editorMode}
                                        onChange={(value) => {
                                            const newMode = value as 'writing' | 'testing';
                                            setEditorMode(newMode);
                                            // 保存模式偏好到本地存储
                                            if (promptId) {
                                                saveEditorModePreference(promptId, newMode);
                                            }
                                        }}
                                        options={[
                                            {
                                                label: (
                                                    <Space size={4}>
                                                        <ExperimentOutlined style={{ color: editorMode === 'testing' ? '#1677ff' : '#888' }} />
                                                        <span style={{ color: editorMode === 'testing' ? '#1677ff' : '#888' }}>{'调试'}</span>
                                                    </Space>
                                                ),
                                                value: 'testing',
                                            },
                                            {
                                                label: (
                                                    <Space size={4}>
                                                        <EditOutlined style={{ color: editorMode === 'writing' ? '#1677ff' : '#888' }} />
                                                        <span style={{ color: editorMode === 'writing' ? '#1677ff' : '#888' }}>{'创作'}</span>
                                                    </Space>
                                                ),
                                                value: 'writing',
                                            },
                                        ]}
                                    />
                                </div>

                                <Divider type="vertical" style={{ height: 24 }} />

                                {/* 紧凑统计 */}
                                <Space size={8}>
                                    <Text type="secondary" style={{ fontSize: '12px' }}>
                                        <BulbOutlined /> {variables.length} 变量
                                    </Text>
                                    <Text type="secondary" style={{ fontSize: '12px' }}>
                                        <ExperimentOutlined /> {testCases.length} {'测试用例'}
                                    </Text>
                                    <Text type="secondary" style={{ fontSize: '12px' }}>
                                        <CheckCircleOutlined /> {outputs.length > 0 ? Math.round((outputs.filter(o => !o.error).length / outputs.length) * 100) : 0}%
                                    </Text>
                                </Space>

                                {/* 版本选择 */}
                                {versions.length > 0 && (
                                    <Space align="center">
                                        <Text type="secondary" style={{ fontSize: '12px' }}>{'当前版本'}:</Text>
                                        <Dropdown
                                            menu={{ items: versionMenuItems }}
                                            trigger={['click']}
                                            placement="bottomLeft"
                                            overlayStyle={{
                                                maxHeight: '300px',
                                                overflow: 'auto',
                                                width: '180px'
                                            }}
                                        >
                                            <Button size="small">
                                                <Space size={4}>
                                                    <BranchesOutlined />
                                                    <Text strong>V{currentVersion?.version_number || 1}</Text>
                                                    <Badge count={versions.length} size="small" />
                                                    <DownOutlined style={{ fontSize: '10px' }} />
                                                </Space>
                                            </Button>
                                        </Dropdown>
                                        <Popconfirm
                                            title={'返回查看模式'}
                                            description={'您有未保存的更改，确定要返回吗？'}
                                            onConfirm={() => navigate(projectJumpTo(`prompts/${promptId}/overview?version=${promptVersionId}`))}
                                            okText={'确定'}
                                            cancelText={'取消'}
                                            disabled={!hasEdited}
                                        >
                                            <Button
                                                size="small"
                                                type="text"
                                                onClick={!hasEdited ? () => navigate(projectJumpTo(`prompts/${promptId}/overview?version=${promptVersionId}`)) : undefined}
                                            >
                                                {'去概览'}
                                            </Button>
                                        </Popconfirm>
                                    </Space>
                                )}
                            </Space>
                        </Col>

                        <Col>
                            <Space size={8}>
                                <Popover
                                    content={
                                        <div style={{ width: 200 }}>
                                            {/* 模型选择区域 */}
                                            <div style={{ marginBottom: 16 }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                                    <Text strong style={{ fontSize: '13px' }}>{'模型配置'}</Text>
                                                </div>
                                                <Select
                                                    value={`${modelConfig.provider}:${modelConfig.model}`}
                                                    style={{ width: '100%' }}
                                                    placeholder={'选择模型'}
                                                    size="small"
                                                    open={selectOpen && showModelSettings}
                                                    onOpenChange={(open) => {
                                                        if (showModelSettings) {
                                                            setSelectOpen(open);
                                                        }
                                                    }}
                                                    dropdownStyle={{
                                                        display: (selectOpen && showModelSettings) ? 'block' : 'none'
                                                    }}
                                                    popupRender={() => (
                                                        <div style={{ padding: '4px 0' }}>
                                                            <Tree
                                                                treeData={getTreeData(availableModels)}
                                                                expandedKeys={treeExpandedKeys}
                                                                selectedKeys={[`${modelConfig.provider}:${modelConfig.model}`]}
                                                                blockNode={true}
                                                                autoExpandParent={false}
                                                                onExpand={(expandedKeys) => {
                                                                    setTreeExpandedKeys(expandedKeys as string[]);
                                                                }}
                                                                onSelect={(_selectedKeys, info) => {
                                                                    // 只处理叶子节点（模型节点）的选择
                                                                    if (info.node.isLeaf && info.node.selectable) {
                                                                        const { provider, model } = info.node as any;
                                                                        setModelConfig({
                                                                            ...modelConfig,
                                                                            provider,
                                                                            model
                                                                        });
                                                                        setHasEdited(true);
                                                                        // 选择模型后关闭下拉列表
                                                                        setSelectOpen(false);
                                                                    }
                                                                }}
                                                                titleRender={(nodeData) => {
                                                                    return (
                                                                        <span
                                                                            onClick={(e) => {
                                                                                // 如果是供应商节点（有children的节点），点击时展开/折叠
                                                                                if ((nodeData as any).children && (nodeData as any).children.length > 0) {
                                                                                    e.stopPropagation();
                                                                                    const nodeKey = nodeData.key as string;
                                                                                    const isExpanded = treeExpandedKeys.includes(nodeKey);
                                                                                    if (isExpanded) {
                                                                                        setTreeExpandedKeys(prev => prev.filter(key => key !== nodeKey));
                                                                                    } else {
                                                                                        setTreeExpandedKeys(prev => [...prev, nodeKey]);
                                                                                    }
                                                                                }
                                                                            }}
                                                                            style={{ cursor: 'pointer' }}
                                                                        >
                                                                            {nodeData.title}
                                                                        </span>
                                                                    );
                                                                }}
                                                                showIcon={false}
                                                                style={{ fontSize: '12px' }}
                                                            />
                                                        </div>
                                                    )}
                                                >
                                                    <Select.Option value={`${modelConfig.provider}:${modelConfig.model}`}>
                                                        {getCurrentModelDisplayName()}
                                                    </Select.Option>
                                                </Select>
                                            </div>

                                            <Divider style={{ margin: '12px 0' }} />

                                            {/* 参数配置区域 */}
                                            <div style={{ marginBottom: 16 }}>
                                                <Text type="secondary" style={{ fontSize: '11px', marginBottom: 8, display: 'block' }}>
                                                    {'高级参数（可选）'}
                                                </Text>

                                                {/* Temperature */}
                                                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8, gap: 8 }}>
                                                    <Switch
                                                        size="small"
                                                        checked={modelConfig.temperature !== undefined}
                                                        onChange={(checked) =>
                                                            updateModelConfig('temperature', checked ? 0.7 : undefined)
                                                        }
                                                    />
                                                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
                                                        <Text style={{ fontSize: '12px', minWidth: '80px' }}>Temperature</Text>
                                                        <Tooltip title={'控制输出的随机性，越高越随机'} placement="top">
                                                            <QuestionCircleOutlined style={{ fontSize: '10px', color: '#999' }} />
                                                        </Tooltip>
                                                    </div>
                                                    <InputNumber
                                                        size="small"
                                                        min={0}
                                                        max={2}
                                                        step={0.1}
                                                        value={modelConfig.temperature}
                                                        style={{ width: 70, fontSize: '11px' }}
                                                        onChange={(value) => updateModelConfig('temperature', value)}
                                                        disabled={modelConfig.temperature === undefined}
                                                    />
                                                </div>

                                                {/* Top P */}
                                                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8, gap: 8 }}>
                                                    <Switch
                                                        size="small"
                                                        checked={modelConfig.top_p !== undefined}
                                                        onChange={(checked) =>
                                                            updateModelConfig('top_p', checked ? 1 : undefined)
                                                        }
                                                    />
                                                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
                                                        <Text style={{ fontSize: '12px', minWidth: '80px' }}>Top P</Text>
                                                        <Tooltip title={'核采样，控制词汇选择范围'} placement="top">
                                                            <QuestionCircleOutlined style={{ fontSize: '10px', color: '#999' }} />
                                                        </Tooltip>
                                                    </div>
                                                    <InputNumber
                                                        size="small"
                                                        min={0}
                                                        max={1}
                                                        step={0.01}
                                                        value={modelConfig.top_p}
                                                        style={{ width: 70, fontSize: '11px' }}
                                                        onChange={(value) => updateModelConfig('top_p', value)}
                                                        disabled={modelConfig.top_p === undefined}
                                                    />
                                                </div>

                                                {/* Max Tokens */}
                                                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8, gap: 8 }}>
                                                    <Switch
                                                        size="small"
                                                        checked={modelConfig.max_tokens !== undefined}
                                                        onChange={(checked) =>
                                                            updateModelConfig('max_tokens', checked ? 2000 : undefined)
                                                        }
                                                    />
                                                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
                                                        <Text style={{ fontSize: '12px', minWidth: '80px' }}>Max Tokens</Text>
                                                        <Tooltip title={'最大输出长度'} placement="top">
                                                            <QuestionCircleOutlined style={{ fontSize: '10px', color: '#999' }} />
                                                        </Tooltip>
                                                    </div>
                                                    <InputNumber
                                                        size="small"
                                                        min={100}
                                                        max={8000}
                                                        step={100}
                                                        value={modelConfig.max_tokens}
                                                        style={{ width: 70, fontSize: '11px' }}
                                                        onChange={(value) => updateModelConfig('max_tokens', value)}
                                                        disabled={modelConfig.max_tokens === undefined}
                                                    />
                                                </div>

                                                {/* Presence Penalty */}
                                                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8, gap: 8 }}>
                                                    <Switch
                                                        size="small"
                                                        checked={modelConfig.presence_penalty !== undefined}
                                                        onChange={(checked) =>
                                                            updateModelConfig('presence_penalty', checked ? 0 : undefined)
                                                        }
                                                    />
                                                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
                                                        <Text style={{ fontSize: '12px', minWidth: '80px' }}>Presence</Text>
                                                        <Tooltip title={'减少重复内容的出现'} placement="top">
                                                            <QuestionCircleOutlined style={{ fontSize: '10px', color: '#999' }} />
                                                        </Tooltip>
                                                    </div>
                                                    <InputNumber
                                                        size="small"
                                                        min={-2}
                                                        max={2}
                                                        step={0.1}
                                                        value={modelConfig.presence_penalty}
                                                        style={{ width: 70, fontSize: '11px' }}
                                                        onChange={(value) => updateModelConfig('presence_penalty', value)}
                                                        disabled={modelConfig.presence_penalty === undefined}
                                                    />
                                                </div>

                                                {/* Frequency Penalty */}
                                                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8, gap: 8 }}>
                                                    <Switch
                                                        size="small"
                                                        checked={modelConfig.frequency_penalty !== undefined}
                                                        onChange={(checked) =>
                                                            updateModelConfig('frequency_penalty', checked ? 0 : undefined)
                                                        }
                                                    />
                                                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
                                                        <Text style={{ fontSize: '12px', minWidth: '80px' }}>Frequency</Text>
                                                        <Tooltip title={'降低词频重复'} placement="top">
                                                            <QuestionCircleOutlined style={{ fontSize: '10px', color: '#999' }} />
                                                        </Tooltip>
                                                    </div>
                                                    <InputNumber
                                                        size="small"
                                                        min={-2}
                                                        max={2}
                                                        step={0.1}
                                                        value={modelConfig.frequency_penalty}
                                                        style={{ width: 70, fontSize: '11px' }}
                                                        onChange={(value) => updateModelConfig('frequency_penalty', value)}
                                                        disabled={modelConfig.frequency_penalty === undefined}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    }
                                    title={null}
                                    open={showModelSettings}
                                    onOpenChange={(open) => {
                                        setShowModelSettings(open);
                                        // 当 Popover 关闭时，同时关闭 Select 的下拉菜单
                                        if (!open) {
                                            setSelectOpen(false);
                                        }
                                    }}
                                    trigger="click"
                                    placement="bottomLeft"
                                    styles={{
                                        body: {
                                            padding: 12
                                        }
                                    }}
                                >
                                    <Button
                                        size="small"
                                        type="text"
                                        icon={<SettingOutlined />}
                                    >
                                        {getCurrentModelDisplayName()}
                                    </Button>
                                </Popover>
                                <Button
                                    size="small"
                                    icon={<SaveOutlined />}
                                    onClick={() => setSaveDialogOpen(true)}
                                    disabled={isLoading}
                                >
                                    {hasEdited ? '保存*' : '保存'}
                                </Button>
                                <Button
                                    type="primary"
                                    icon={isLoading ? <StopOutlined /> : <PlayCircleOutlined />}
                                    loading={false}
                                    disabled={!isLoading && messages.length === 0}
                                    onClick={isLoading ? cancelRequest : handleRun}
                                    style={{
                                        backgroundColor: isLoading ? '#ff4d4f' : undefined,
                                        borderColor: isLoading ? '#ff4d4f' : undefined,
                                    }}
                                >
                                    {isLoading ? '取消' : '运行'}
                                </Button>
                            </Space>
                        </Col>
                    </Row>
                </Card>

                <Row gutter={16}>
                    {/* 左侧：消息编辑 */}
                    <Col span={editorMode === 'writing' ? 12 : 10}>
                        <Card
                            title={
                                <Space>
                                    <EditOutlined />
                                    <span>{'消息编辑'}</span>
                                    {hasEdited && <Badge dot />}
                                    {/* 语言模式切换 */}
                                    <Divider type="vertical" />
                                    <Space size={4}>
                                        <Button
                                            size="small"
                                            type={languageMode === 'zh' ? 'primary' : 'default'}
                                            onClick={() => switchToLanguageMode('zh')}
                                        >
                                            {'中文'}
                                        </Button>
                                        <Button
                                            size="small"
                                            type={languageMode === 'en' ? 'primary' : 'default'}
                                            onClick={() => switchToLanguageMode('en')}
                                        >
                                            {'English'}
                                        </Button>
                                        <Button
                                            size="small"
                                            type={languageMode === 'compare' ? 'primary' : 'default'}
                                            onClick={() => switchToLanguageMode('compare')}
                                        >
                                            {'对照'}
                                        </Button>
                                    </Space>
                                </Space>
                            }
                            extra={
                                <Space size={4}>
                                    <Button
                                        type="primary"
                                        size="small"
                                        icon={<PlusOutlined />}
                                        onClick={addMessage}
                                    >
                                        {'消息'}
                                    </Button>
                                </Space>
                            }
                            style={HeightController.getCardStyle()}
                            styles={{
                                body: {
                                    height: 'calc(100vh - 250px)',
                                    overflow: 'auto',
                                    padding: `8px`
                                }
                            }}
                        >
                            <Space direction="vertical" style={{ width: '100%' }} size={12}>
                                {/* 根据语言模式显示不同内容 */}
                                {languageMode === 'compare' ? (
                                    // 对照模式：左右分栏
                                    <div>
                                        {messages.map((msg, index) => {
                                            const roleInfo = MESSAGE_ROLES.find(r => r.value === msg.role);
                                            const enMsg = englishMessages[index] || { role: msg.role, content: "", order: msg.order };
                                            const detectedLang = detectLanguage(msg.content);

                                            return (
                                                <Card
                                                    key={index}
                                                    ref={(el) => { messageRefs.current[index] = el; }}
                                                    size="small"
                                                    style={{ borderLeft: `4px solid ${roleInfo?.color || '#d9d9d9'}`, marginBottom: 12 }}
                                                    title={
                                                        <Space size={8}>
                                                            <span style={{ fontSize: '14px' }}>{roleInfo?.icon || '💬'}</span>
                                                            <Select
                                                                value={msg.role}
                                                                size="small"
                                                                style={{ width: 90 }}
                                                                onChange={(value) => updateMessageRole(index, value)}
                                                            >
                                                                {MESSAGE_ROLES.map(role => (
                                                                    <Option key={role.value} value={role.value}>
                                                                        {role.name}
                                                                    </Option>
                                                                ))}
                                                            </Select>
                                                            <Badge count={index + 1} size="small" style={{ backgroundColor: roleInfo?.color }} />
                                                            <Tag color={detectedLang === 'zh' ? 'blue' : detectedLang === 'en' ? 'green' : 'orange'} style={{ fontSize: '10px' }}>
                                                                {detectedLang === 'zh' ? '中文' : detectedLang === 'en' ? 'EN' : '混合'}
                                                            </Tag>
                                                        </Space>
                                                    }
                                                    extra={
                                                        <Space size={4}>
                                                            <Button
                                                                type="text"
                                                                size="small"
                                                                icon={<CopyOutlined />}
                                                                onClick={() => handleCopyMessage(index)}
                                                            />
                                                            <Popconfirm
                                                                title={'确认删除'}
                                                                description={'确定要删除这条消息吗？'}
                                                                okText={'删除'}
                                                                cancelText={'取消'}
                                                                okType="danger"
                                                                onConfirm={() => handleDeleteMessage(index)}
                                                            >
                                                                <Button type="text" size="small" icon={<DeleteOutlined />} danger />
                                                            </Popconfirm>
                                                        </Space>
                                                    }
                                                >
                                                    <Row gutter={8}>
                                                        <Col span={12}>
                                                            <div style={{ marginBottom: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                <Text strong style={{ fontSize: '11px' }}>{'🇨🇳 中文版本'}</Text>
                                                                <Button
                                                                    type="text"
                                                                    size="small"
                                                                    icon={<BulbOutlined />}
                                                                    style={{ fontSize: '10px', height: '20px' }}
                                                                    onClick={() => handleTranslate('zh')}
                                                                    loading={isTranslating}
                                                                >
                                                                    {'译中'}
                                                                </Button>
                                                            </div>
                                                            <LongTextEditor
                                                                value={msg.content}
                                                                onChange={(newValue) => updateMessageContent(index, newValue)}
                                                                placeholder={msg.role === "system" ? '你是一个专业的{{角色}}...' : '输入消息...'}
                                                                autoSize={autoSize(msg.role, 'compare')}
                                                                onTextAreaRef={(ref) => {
                                                                    textAreaRefs.current[`zh-${index}`] = ref;
                                                                }}
                                                            />
                                                        </Col>
                                                        <Col span={12}>
                                                            <div style={{ marginBottom: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                <Text strong style={{ fontSize: '11px' }}>{'🇺🇸 English版本'}</Text>
                                                                <Button
                                                                    type="text"
                                                                    size="small"
                                                                    icon={<BulbOutlined />}
                                                                    style={{ fontSize: '10px', height: '20px' }}
                                                                    onClick={() => handleTranslate('en')}
                                                                    loading={isTranslating}
                                                                >
                                                                    {'译英'}
                                                                </Button>
                                                            </div>
                                                            <LongTextEditor
                                                                value={enMsg.content}
                                                                autoSize={autoSize(msg.role, 'compare')}
                                                                onChange={(newValue) => updateEnglishMessageContent(index, newValue)}
                                                                placeholder={msg.role === "system" ? "You are a professional {{role}}..." : "Enter message..."}
                                                                onTextAreaRef={(ref) => {
                                                                    textAreaRefs.current[`en-${index}`] = ref;
                                                                }}
                                                            />
                                                        </Col>
                                                    </Row>
                                                    <div style={{ marginTop: 8, fontSize: '11px', color: '#999', display: 'flex', justifyContent: 'space-between' }}>
                                                        <span>{'💡 使用 {{变量名}} 插入变量, 只能使用文字、数字、下划线'}</span>
                                                        <span>{`中文: ${msg.content.length} 字符`} | {`英文: ${enMsg.content.length} 字符`}</span>
                                                    </div>
                                                </Card>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    // 单语言模式
                                    <div>
                                        {(languageMode === 'zh' ? messages : englishMessages).map((msg, index) => {
                                            const roleInfo = MESSAGE_ROLES.find(r => r.value === msg.role);

                                            return (
                                                <Card
                                                    key={index}
                                                    ref={(el) => { messageRefs.current[index] = el; }}
                                                    size="small"
                                                    style={{ borderLeft: `4px solid ${roleInfo?.color || '#d9d9d9'}`, marginBottom: 12 }}
                                                    title={
                                                        <Space size={8}>
                                                            <span style={{ fontSize: '14px' }}>{roleInfo?.icon || '💬'}</span>
                                                            <Select
                                                                value={msg.role}
                                                                size="small"
                                                                style={{ width: 90 }}
                                                                onChange={(value) => updateMessageRole(index, value)}
                                                            >
                                                                {MESSAGE_ROLES.map(role => (
                                                                    <Option key={role.value} value={role.value}>
                                                                        {role.name}
                                                                    </Option>
                                                                ))}
                                                            </Select>
                                                            <Badge count={index + 1} size="small" style={{ backgroundColor: roleInfo?.color }} />
                                                            <Tag color={languageMode === 'zh' ? 'blue' : 'green'} style={{ fontSize: '10px' }}>
                                                                {languageMode === 'zh' ? '中文' : 'English'}
                                                            </Tag>
                                                        </Space>
                                                    }
                                                    extra={
                                                        <Space size={4}>
                                                            <Tooltip title={'复制消息'}>
                                                                <Button
                                                                    type="text"
                                                                    size="small"
                                                                    icon={<CopyOutlined />}
                                                                    onClick={() => handleCopyMessage(index)}
                                                                />
                                                            </Tooltip>
                                                            <Tooltip title={'删除消息'}>
                                                                <Popconfirm
                                                                    title={'确认删除'}
                                                                    description={'确定要删除这条消息吗？'}
                                                                    okText={'删除'}
                                                                    cancelText={'取消'}
                                                                    okType="danger"
                                                                    onConfirm={() => handleDeleteMessage(index)}
                                                                >
                                                                    <Button type="text" size="small" icon={<DeleteOutlined />} danger />
                                                                </Popconfirm>
                                                            </Tooltip>
                                                        </Space>
                                                    }
                                                >
                                                    <LongTextEditor
                                                        value={msg.content}
                                                            autoSize={autoSize(msg.role, languageMode)}
                                                        onChange={(newValue) => {
                                                            if (languageMode === 'zh') {
                                                                updateMessageContent(index, newValue);
                                                            } else {
                                                                updateEnglishMessageContent(index, newValue);
                                                            }
                                                        }}
                                                        placeholder={msg.role === "system" ? (languageMode === 'zh' ? '你是一个专业的{{角色}}...' : 'You are a professional {{role}}...') : (languageMode === 'zh' ? '输入消息...' : 'Enter message...')}
                                                        onTextAreaRef={(ref) => {
                                                            textAreaRefs.current[`${languageMode}-${index}`] = ref;
                                                        }}
                                                    />
                                                    <div style={{ marginTop: 8, fontSize: '11px', color: '#999', display: 'flex', justifyContent: 'space-between' }}>
                                                        <span>{'💡 使用 {{变量名}} 插入变量, 只能使用文字、数字、下划线'}</span>
                                                        <span>{`字符数: ${msg.content.length}`}</span>
                                                    </div>
                                                </Card>
                                            );
                                        })}
                                    </div>
                                )}
                            </Space>
                        </Card>
                    </Col>

                    {/* 右侧：根据模式显示不同内容 */}
                    {editorMode === 'writing' ? (
                        /* 编写模式：显示助理面板 */
                        <Col span={12}>
                            <AssistantChat
                                projectId={Number(projectId)}
                                promptId={Number(promptId)}
                                promptVersionId={Number(promptVersionId)}
                                context={assistantContext}
                                style={HeightController.getCardStyle()}
                                height="calc(100vh - 180px)"
                                onContextUpdate={handleContextUpdate}
                            />
                        </Col>
                    ) : (
                        /* 调试模式：显示测试用例和结果 */
                        <>
                            {/* 中间：测试用例 */}
                            <Col span={7}>
                                <Card
                            title={
                                <Space>
                                    <ExperimentOutlined />
                                    <span>{'测试用例'}</span>
                                    <Badge count={testCases.length} size="small" />
                                </Space>
                            }
                            extra={
                                <Space size={4}>
                                    <Tooltip title={'生成测试用例'}>
                                        <Button
                                            type="dashed"
                                            size="small"
                                            icon={<BulbOutlined />}
                                            onClick={handleGenerateTestCases}
                                        >
                                            {'智能生成'}
                                        </Button>
                                    </Tooltip>
                                    <DatasetActions
                                        onImportFromDataset={handleOpenImportFromDatasetModal}
                                        onExportToDataset={handleOpenExportToDatasetModal}
                                        onImportFromJson={handleOpenJsonImportModal}
                                        hasVariables={variables.length > 0}
                                        hasTestCases={testCases.length > 0}
                                    />
                                    <Tooltip title={'用例'}>
                                        <Button
                                            type="primary"
                                            size="small"
                                            icon={<PlusOutlined />}
                                            onClick={addTestCase}
                                        >
                                            {'用例'}
                                        </Button>
                                    </Tooltip>
                                </Space>
                            }
                            style={HeightController.getCardStyle()}
                            styles={{
                                body: {
                                    height: 'calc(100vh - 250px)',
                                    overflow: 'auto',
                                    padding: `8px`
                                }
                            }}
                        >
                            <Space direction="vertical" style={{ width: '100%' }} size={8}>
                                {/* 变量总览 */}
                                <Card size="small" style={{ background: '#f0f9ff' }}>
                                    <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Text strong style={{ fontSize: '12px' }}>{'🔧 变量总览'}</Text>
                                    </div>

                                    {/* 按消息分组显示变量 */}
                                    <div style={{ maxHeight: '120px', overflow: 'auto' }}>
                                        {variableGroups.length > 0 ? (
                                            variableGroups.map((group, groupIndex) => {
                                                const roleInfo = MESSAGE_ROLES.find(r => r.value === group.role);
                                                return (
                                                    <div key={groupIndex} style={{ marginBottom: 6 }}>
                                                        <div style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            flexWrap: 'wrap',
                                                            gap: '4px',
                                                            fontSize: '10px',
                                                            color: '#666'
                                                        }}>
                                                            <span style={{ marginRight: 4 }}>{roleInfo?.icon || '💬'}</span>
                                                            <Text style={{ fontSize: '10px', color: '#666', marginRight: 8 }}>
                                                                {roleInfo?.name} #{group.messageIndex + 1}:
                                                            </Text>
                                                            {group.variables.map(variable => (
                                                                <Tag
                                                                    key={`${group.messageIndex}-${variable}`}
                                                                    color="blue"
                                                                    style={{
                                                                        fontSize: '9px',
                                                                        margin: 0,
                                                                        cursor: 'pointer',
                                                                        padding: '1px 4px',
                                                                        lineHeight: '16px',
                                                                        position: 'relative'
                                                                    }}
                                                                    onClick={() => scrollToVariable(group.messageIndex, variable)}
                                                                    title={(() => {
                                                                        const stateKey = `${group.messageIndex}-${variable}`;
                                                                        const state = variablePositionState.current[stateKey];
                                                                        const extraInfo = state && state.totalCount > 1 
                                                                            ? ` (${state.currentIndex + 1}/${state.totalCount})`
                                                                            : '';
                                                                        return `点击定位到第${group.messageIndex + 1}条消息中的变量 ${variable}${extraInfo}`;
                                                                    })()}
                                                                >
                                                                    {variable}
                                                                    {(() => {
                                                                        // 计算变量在这条消息中的出现次数
                                                                        let totalInMessage = 0;
                                                                        if (languageMode === 'compare') {
                                                                            const enMsg = englishMessages[group.messageIndex];
                                                                            const enCount = enMsg ? findAllVariablePositions(enMsg.content, variable).length : 0;
                                                                            totalInMessage = enCount;
                                                                        } else {
                                                                            const messagesToCheck = languageMode === 'zh' ? messages : englishMessages;
                                                                            const msg = messagesToCheck[group.messageIndex];
                                                                            totalInMessage = msg ? findAllVariablePositions(msg.content, variable).length : 0;
                                                                        }

                                                                        return totalInMessage > 1 ? (
                                                                            <span
                                                                                style={{
                                                                                    display: 'inline-block',
                                                                                    backgroundColor: '#fff',
                                                                                    color: '#1890ff',
                                                                                    borderRadius: '50%',
                                                                                    width: '14px',
                                                                                    height: '14px',
                                                                                    lineHeight: '14px',
                                                                                    textAlign: 'center',
                                                                                    fontSize: '8px',
                                                                                    fontWeight: 'bold',
                                                                                    marginLeft: '2px',
                                                                                }}
                                                                                title={`该变量在此消息中出现${totalInMessage}次`}
                                                                            >
                                                                                {totalInMessage}
                                                                            </span>
                                                                        ) : null;
                                                                    })()}
                                                                </Tag>
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        ) : (
                                            <div style={{ textAlign: 'center', padding: '8px', color: '#999', fontSize: '11px' }}>
                                                {'暂无变量，在消息中使用 {{变量名}} 来添加变量'}
                                            </div>
                                        )}
                                    </div>
                                </Card>

                                {/* 测试用例列表 - 使用优化的组件 */}
                                {testCases.map((testCase, index) => (
                                    <div
                                        key={`${index}-${testCase.metadatas?.generatedAt || 'manual'}`}
                                        ref={(el) => { testCaseRefs.current[index] = el; }}
                                    >
                                        <TestCaseCard
                                            testCase={testCase}
                                            index={index}
                                            currentTestCase={currentTestCase}
                                            autoSize={{ minRows: 1, maxRows: testCases.length == 1 ? 10 : 5 }}
                                            onUpdate={updateTestCase}
                                            onDelete={deleteTestCase}
                                            onSelect={setCurrentTestCase}
                                        />
                                    </div>
                                ))}

                                {/* 批量操作 */}
                                <Card size="small" style={{ background: '#f6ffed' }}>
                                    <Space size={8} style={{ width: '100%', justifyContent: 'center' }}>
                                        <Button
                                            type="dashed"
                                            size="small"
                                            icon={<CopyOutlined />}
                                            onClick={() => {
                                                if (testCases.length > 0 && currentTestCase < testCases.length) {
                                                    const currentCase = testCases[currentTestCase];
                                                    const newCase = { ...currentCase };
                                                    // 如果是复制的，更新元数据为手动添加
                                                    newCase.metadatas = {
                                                        source: 'manual',
                                                        generatedAt: new Date().toISOString()
                                                    };
                                                    setTestCases([...testCases, newCase]);
                                                }
                                            }}
                                            disabled={testCases.length === 0}
                                        >
                                            {'复制当前用例'}
                                        </Button>
                                        <Popconfirm
                                            title={'确认删除所有测试用例'}
                                            description={`确定要删除所有 ${testCases.length} 个测试用例吗？此操作不可恢复。`}
                                            okText={'确认删除'}
                                            cancelText={'取消'}
                                            okType="danger"
                                            placement="top"
                                            onConfirm={deleteAllTestCases}
                                        >
                                            <Button
                                                type="dashed"
                                                size="small"
                                                icon={<DeleteOutlined />}
                                                danger
                                                disabled={testCases.length === 0}
                                            >
                                                {'删除所有'}
                                            </Button>
                                        </Popconfirm>
                                    </Space>
                                </Card>
                            </Space>
                        </Card>
                    </Col>

                    {/* 右侧：运行结果 */}
                    <Col span={7}>
                        <Card
                            title={
                                <Space>
                                    <ThunderboltOutlined />
                                    <span>{'输出结果'}</span>
                                    <Badge count={outputs.length} size="small" />
                                </Space>
                            }
                            extra={
                                <Space size={4}>
                                    <Tag color={isLoading ? "orange" : "green"} style={{ fontSize: '10px' }}>
                                        {isLoading ? '运行中' : '就绪'}
                                    </Tag>
                                    <Button
                                        type="text"
                                        size="small"
                                        icon={<HistoryOutlined />}
                                        onClick={handleOpenHistoryDrawer}
                                        style={{ fontSize: '12px', color: '#666' }}
                                    >
                                        {'历史'}
                                    </Button>
                                </Space>
                            }
                            style={HeightController.getCardStyle()}
                            styles={{
                                body: {
                                    height: 'calc(100vh - 250px)',
                                    overflow: 'auto',
                                    padding: `8px`
                                }
                            }}
                        >
                            <Space direction="vertical" style={{ width: '100%' }} size={8}>
                                {/* 执行状态 */}
                                <Card size="small" style={{ background: '#f0f9ff' }}>
                                    <Row gutter={8}>
                                        <Col span={12}>
                                            <Statistic
                                                title={'总耗时'}
                                                value={outputs.length > 0 ? outputs.reduce((sum, output) => sum + output.execution_time / 1000, 0).toFixed(3) : 0}
                                                suffix="s"
                                                valueStyle={{ fontSize: '14px' }}
                                            />
                                        </Col>
                                        <Col span={12}>
                                            <Statistic
                                                title={'总费用'}
                                                value={outputs.reduce((sum, output) => sum + (Number(output.cost) || 0), 0)}
                                                prefix="$"
                                                valueStyle={{ fontSize: '14px' }}
                                                precision={6}
                                            />
                                        </Col>
                                    </Row>
                                    <div style={{ marginTop: 8 }}>
                                        <Text style={{ fontSize: '11px', color: '#666' }}>{'执行进度'}</Text>
                                        <Progress
                                            percent={outputs.length > 0 ?
                                                Math.round((outputs.filter(o => !o.isLoading).length / outputs.length) * 100) : 0}
                                            size="small"
                                        />
                                    </div>
                                </Card>

                                {/* 结果展示 */}
                                {outputs.length > 0 ? (
                                    outputs.map((output, idx) => (
                                        <Card
                                            key={output.id}
                                            size="small"
                                            style={{ border: '1px solid #e8f5e8' }}
                                            title={
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <Space size={4}>
                                                        <Badge count={idx + 1} size="small" style={{ backgroundColor: '#52c41a' }} />
                                                        <Text style={{ fontSize: '12px' }}>{'结果'} {idx + 1}</Text>
                                                        {output.isLoading && <Spin size="small" />}

                                                        {/* 测试用例关联指示器 */}
                                                        {testCases.length > 0 && idx < testCases.length && (
                                                            <Tooltip title={'点击定位到对应测试用例'}>
                                                                <Tag
                                                                    color="blue"
                                                                    style={{ fontSize: '9px', margin: '0 4px', cursor: 'pointer' }}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        scrollToTestCase(idx);
                                                                    }}
                                                                >
                                                                    {`用例${idx + 1}`}
                                                                </Tag>
                                                            </Tooltip>
                                                        )}

                                                        {/* 优化状态标签 */}
                                                        {output.optimizationStatus === 'optimizing' && (
                                                            <Tag color="processing" style={{ fontSize: '9px', margin: '0 4px' }}>
                                                                <Spin size="small" style={{ marginRight: 4 }} />
                                                                {'优化中'}
                                                            </Tag>
                                                        )}
                                                        {output.optimizationStatus === 'completed' && (
                                                            <Tag color="success" style={{ fontSize: '9px', margin: '0 4px' }}>
                                                                {'已优化'} {output.optimizationResult?.score}/100
                                                            </Tag>
                                                        )}
                                                        {output.optimizationStatus === 'failed' && (
                                                            <Tag color="error" style={{ fontSize: '9px', margin: '0 4px' }}>
                                                                {'优化失败'}
                                                            </Tag>
                                                        )}
                                                        {output.hasFeedback && !output.optimizationStatus && (
                                                            <Tag
                                                                color="orange"
                                                                style={{ fontSize: '9px', margin: '0 4px' }}
                                                            >
                                                                {'已反馈'}
                                                            </Tag>
                                                        )}

                                                        <ClockCircleOutlined style={{ fontSize: '10px', color: '#999' }} />
                                                        <Text style={{ fontSize: '10px', color: '#999' }}>{output.execution_time / 1000}s</Text>
                                                    </Space>
                                                    <Space size={4}>
                                                        <Text type="success" style={{ fontSize: '11px', fontWeight: 'bold' }}>
                                                            $ {output.cost}
                                                        </Text>
                                                        {!output.isLoading && !output.error && (
                                                            <Space size={4}>
                                                                {/* 优化提示词按钮 - 保持曝光 */}
                                                                <Tooltip title={
                                                                    output.optimizationStatus === 'optimizing' ? '查看优化进度' :
                                                                        output.optimizationStatus === 'completed' ? '查看优化详情' :
                                                                            output.optimizationStatus === 'failed' ? '查看错误信息' :
                                                                                output.hasFeedback ? '修改描述' : '优化提示词'
                                                                }>
                                                                    <Button
                                                                        type="text"
                                                                        size="small"
                                                                        icon={<ThunderboltOutlined />}
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleOpenOptimizationOrFeedback(output);
                                                                        }}
                                                                        style={{
                                                                            color: output.hasFeedback || output.optimizationStatus ? '#fa8c16' : '#666',
                                                                            background: output.hasFeedback || output.optimizationStatus ? '#fff7e6' : 'transparent'
                                                                        }}
                                                                    />
                                                                </Tooltip>

                                                                {/* 更多操作下拉菜单 */}
                                                                <Dropdown
                                                                    menu={{
                                                                        items: [
                                                                            {
                                                                                key: 'copy',
                                                                                label: '复制结果',
                                                                                icon: <CopyOutlined />,
                                                                                onClick: () => handleCopyOutput(output.response)
                                                                            },
                                                                            {
                                                                                key: 'details',
                                                                                label: '查看详情',
                                                                                icon: <EyeOutlined />,
                                                                                onClick: () => handleOpenRequestDetails(output)
                                                                            }
                                                                        ]
                                                                    }}
                                                                    trigger={['hover']}
                                                                    placement="bottomRight"
                                                                >
                                                                    <Button
                                                                        type="text"
                                                                        size="small"
                                                                        icon={<MoreOutlined />}
                                                                        onClick={(e) => e.stopPropagation()}
                                                                        style={{ color: '#666' }}
                                                                    />
                                                                </Dropdown>
                                                            </Space>
                                                        )}
                                                    </Space>
                                                </div>
                                            }
                                            extra={
                                                <></>
                                            }
                                        >
                                            <div style={{
                                                background: output.error ? '#fff2f0' : '#f6ffed',
                                                border: `1px solid ${output.error ? '#ffccc7' : '#d9f7be'}`,
                                                borderRadius: '4px',
                                                fontSize: '11px',
                                                lineHeight: '1.4',
                                                padding: '8px',
                                                ...getResultDisplayHeight(output.response || '')
                                            }}>
                                                {output.isLoading ? (
                                                    <div style={{ textAlign: 'center', padding: '20px 0' }}>
                                                        <Spin />
                                                        <div style={{ marginTop: 8 }}>{'正在生成回答...'}</div>
                                                    </div>
                                                ) : output.error ? (
                                                    <div>
                                                        <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{'❌ 调用失败'}</div>
                                                        <div>{output.error}</div>
                                                    </div>
                                                ) : (
                                                    <JSONDisplay
                                                        content={output.response || '正在生成中...'}
                                                        useContainerHeight={true}
                                                    />
                                                )}
                                            </div>

                                            {!output.isLoading && !output.error && output.response && output.tokens && (
                                                <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between' }}>
                                                    <Space size={8}>
                                                        {/* 展示token信息 */}
                                                        <Tag color="blue" style={{ fontSize: '9px' }}>Total: {output.tokens.total}</Tag>
                                                        <Tag color="green" style={{ fontSize: '9px' }}>Completion: {output.tokens.completion}</Tag>
                                                        <Tag color="yellow" style={{ fontSize: '9px' }}>Prompt: {output.tokens.prompt}</Tag>
                                                    </Space>
                                                    <Text style={{ fontSize: '9px', color: '#999' }}>{output.response.length} {`字符数: ${output.response.length}`}</Text>
                                                </div>
                                            )}
                                        </Card>
                                    ))
                                ) : (
                                    <div style={{
                                        height: '100%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        minHeight: '300px'
                                    }}>
                                        <Empty
                                            description={'点击运行按钮开始'}
                                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                                        />
                                    </div>
                                )}

                                {/* 统计汇总 */}
                                {outputs.length > 0 && (
                                    <Card size="small" style={{ background: '#fff7e6' }}>
                                        <Row gutter={8}>
                                            <Col span={8}>
                                                                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#fa8c16' }}>
                                            {Math.round((outputs.filter(o => !o.error).length / outputs.length) * 100)}%
                                        </div>
                                        <div style={{ fontSize: '10px', color: '#999' }}>{'成功率'}</div>
                                    </div>
                                            </Col>
                                            <Col span={8}>
                                                <div style={{ textAlign: 'center' }}>
                                                    <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#52c41a' }}>100%</div>
                                                    <div style={{ fontSize: '10px', color: '#999' }}>{'平均质量'}</div>
                                                </div>
                                            </Col>
                                            <Col span={8}>
                                                <div style={{ textAlign: 'center' }}>
                                                    <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#1890ff' }}>{outputs.length > 0 ? (outputs.reduce((sum, output) => sum + output.execution_time / 1000, 0) / outputs.length).toFixed(3) : 0}s</div>
                                                    <div style={{ fontSize: '10px', color: '#999' }}>{'平均延迟'}</div>
                                                </div>
                                            </Col>
                                        </Row>
                                    </Card>
                                )}
                            </Space>
                        </Card>
                    </Col>
                        </>
                    )}
                </Row>



                {/* 保存版本弹窗 */}
                <Modal
                    title={
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                            <SaveOutlined style={{ marginRight: 8 }} />
                            <span>{'保存新版本'}</span>
                        </div>
                    }
                    open={saveDialogOpen}
                    onCancel={() => setSaveDialogOpen(false)}
                    onOk={handleSaveNewVersion}
                    okText={'确认保存'}
                    cancelText={'取消'}
                    confirmLoading={isLoading}
                    width={800}
                    style={{ top: 20 }}
                >
                    <div style={{ maxHeight: '70vh', overflow: 'auto' }}>
                        {/* 版本信息输入 */}
                        <Card size="small" style={{ marginBottom: 16 }}>
                            <Form layout="vertical">
                                <Form.Item
                                    label={'版本备注'}
                                    rules={[{ required: true, message: '请输入版本备注' }]}
                                    style={{ marginBottom: 8 }}
                                >
                                    <Input
                                        placeholder={'描述本次修改的主要内容...'}
                                        value={promptVersionName}
                                        onChange={(e) => setPromptVersionName(e.target.value)}
                                        size="small"
                                    />
                                </Form.Item>

                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Text type="secondary" style={{ fontSize: '12px' }}>{'保存语言'}:</Text>
                                    <Tag color={languageMode === 'zh' ? 'blue' : languageMode === 'en' ? 'green' : 'orange'}>
                                        {languageMode === 'zh' ? '中文' : languageMode === 'en' ? 'English' : '对照'}
                                    </Tag>
                                    <Divider type="vertical" />
                                    <Text type="secondary" style={{ fontSize: '12px' }}>
                                        {`消息: ${(languageMode === 'zh' ? messages : englishMessages).length} 条`} |
                                        {`变量: ${variables.length} 个`} |
                                        {`测试用例: ${testCases.length} 个`}
                                    </Text>
                                </div>
                            </Form>
                        </Card>

                        {/* {'变更对比区域'} */}
                        {currentVersion && (
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
                                    <DiffOutlined style={{ color: '#1890ff', marginRight: 4 }} />
                                    <Text strong style={{ fontSize: '14px' }}>{'变更对比'}</Text>
                                    <Text type="secondary" style={{ fontSize: '12px', marginLeft: 8 }}>
                                        {`与版本 ${currentVersion?.version_number || 1} 的差异`}
                                    </Text>
                                </div>

                                {/* {'模型配置变更'} */}
                                {currentVersion.model_params && (
                                    <ModelConfigDiff
                                        oldConfig={{
                                            provider: currentVersion.model_params.provider || '',
                                            model: currentVersion.model_params.model || '',
                                            temperature: currentVersion.model_params.temperature,
                                            top_p: currentVersion.model_params.top_p,
                                            max_tokens: currentVersion.model_params.max_tokens,
                                            presence_penalty: currentVersion.model_params.presence_penalty,
                                            frequency_penalty: currentVersion.model_params.frequency_penalty,
                                            language: currentVersion.model_params.language
                                        }}
                                        newConfig={modelConfig}
                                    />
                                )}

                                {/* {'提示词内容变更'} */}
                                {languageMode !== 'compare' && currentVersion.messages && (() => {
                                    const currentMessages = languageMode === 'zh' ? messages : englishMessages;
                                    const oldMessagesText = currentVersion.messages
                                        .sort((a: any, b: any) => a.order - b.order)
                                        .map((msg: any) => `[${msg.role.toUpperCase()}]\n${msg.content}`)
                                        .join('\n\n');
                                    const newMessagesText = currentMessages
                                        .sort((a, b) => a.order - b.order)
                                        .map(msg => `[${msg.role.toUpperCase()}]\n${msg.content}`)
                                        .join('\n\n');

                                    return (
                                        <TextDiffViewer
                                            oldText={oldMessagesText}
                                            newText={newMessagesText}
                                            title={`提示词内容 (${languageMode === 'zh' ? '中文' : 'English'})`}
                                        />
                                    );
                                })()}

                                {/* 双语对比（对照模式时） */}
                                {languageMode === 'compare' && currentVersion.model_params?.bilingual_data && (
                                    <>
                                        {/* {'英文变更'} */}
                                        {(() => {
                                            const oldEnglishText = (currentVersion.model_params.bilingual_data.english_messages || [])
                                                .sort((a: any, b: any) => a.order - b.order)
                                                .map((msg: any) => `[${msg.role.toUpperCase()}]\n${msg.content}`)
                                                .join('\n\n');
                                            const newEnglishText = englishMessages
                                                .sort((a, b) => a.order - b.order)
                                                .map(msg => `[${msg.role.toUpperCase()}]\n${msg.content}`)
                                                .join('\n\n');

                                            return (
                                                <TextDiffViewer
                                                    oldText={oldEnglishText}
                                                    newText={newEnglishText}
                                                    title={'提示词内容 (English版本)'}
                                                />
                                            );
                                        })()}

                                        {/* {'中文变更'} */}
                                        {(() => {
                                            const oldChineseText = (currentVersion.model_params.bilingual_data.chinese_messages || [])
                                                .sort((a: any, b: any) => a.order - b.order)
                                                .map((msg: any) => `[${msg.role.toUpperCase()}]\n${msg.content}`)
                                                .join('\n\n');
                                            const newChineseText = messages
                                                .sort((a, b) => a.order - b.order)
                                                .map(msg => `[${msg.role.toUpperCase()}]\n${msg.content}`)
                                                .join('\n\n');

                                            return (
                                                <TextDiffViewer
                                                    oldText={oldChineseText}
                                                    newText={newChineseText}
                                                    title={'提示词内容 (中文版本)'}
                                                />
                                            );
                                        })()}
                                    </>
                                )}

                                {/* {'如果没有任何变更'} */}
                                {!currentVersion.model_params && (
                                    <div style={{
                                        textAlign: 'center',
                                        padding: '24px',
                                        background: '#f9f9f9',
                                        borderRadius: '6px',
                                        border: '1px dashed #d9d9d9'
                                    }}>
                                        <CheckCircleOutlined style={{ fontSize: '24px', color: '#52c41a', marginBottom: 8 }} />
                                        <div style={{ color: '#666', fontSize: '14px' }}>{'这是第一个版本，没有变更对比'}</div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 没有当前版本时的提示 */}
                        {!currentVersion && (
                            <Card size="small">
                                <div style={{ textAlign: 'center', padding: '16px' }}>
                                    <BulbOutlined style={{ fontSize: '24px', color: '#1890ff', marginBottom: 8 }} />
                                    <div style={{ color: '#666', fontSize: '14px' }}>
                                        {'这将是该提示词的第一个版本'}
                                    </div>
                                </div>
                            </Card>
                        )}
                    </div>
                </Modal>

                {/* 数据集操作相关Modal */}
                <ExportToDatasetModal
                    visible={exportToDatasetModalVisible}
                    onClose={handleCloseExportToDatasetModal}
                    testCases={testCases}
                    variables={variables}
                    projectId={Number(projectId)}
                />

                <ImportFromDatasetModal
                    visible={importFromDatasetModalVisible}
                    onClose={handleCloseImportFromDatasetModal}
                    onImportSuccess={handleImportFromDatasetSuccess}
                    variables={variables}
                    projectId={Number(projectId)}
                />

                {/* JSON导入Modal */}
                <JsonImportModal
                    visible={jsonImportModalVisible}
                    onClose={handleCloseJsonImportModal}
                    onImport={handleJsonImport}
                    variables={variables}
                />

                {/* 版本切换确认弹窗 */}
                                                    <Modal
                    title={'确认切换版本'}
                    open={showVersionConfirm}
                    onOk={confirmVersionChange}
                    onCancel={() => {
                        setShowVersionConfirm(false);
                        setPendingVersion(null);
                    }}
                    okText={'确定切换'}
                    cancelText={'取消'}
                >
                    <p>{`您有未保存的更改，确定要切换到版本 ${pendingVersion?.version_number || 1} 吗？`}</p>
                    <p style={{ color: '#999', fontSize: '12px' }}>
                        {'切换后当前的更改将会丢失，建议先保存当前版本。'}
                    </p>
                </Modal>

                {/* 自动生成测试用例Modal */}
                <TestCaseGeneratorModal
                    visible={generateModalVisible}
                    onClose={handleCloseGenerateModal}
                    onAccept={handleAcceptGeneratedCases}
                    messages={languageMode === 'zh' ? messages : languageMode === 'en' ? englishMessages : messages}
                    variables={variables}
                    projectId={Number(projectId)}
                    promptId={promptId ? Number(promptId) : undefined}
                    promptVersionId={promptVersionId ? Number(promptVersionId) : undefined}
                />

                {/* 优化触发Modal */}
                <OptimizationTrigger
                    visible={feedbackModalVisible}
                    outputItem={selectedOutputForFeedback}
                    onClose={handleCloseFeedback}
                    onStartOptimization={handleStartOptimization}
                    onSaveInputRecord={saveOptimizationInputRecord}
                    onGetInputRecord={getOptimizationInputRecord}
                />

                {/* 提示词优化器 */}
                <PromptOptimizer
                    visible={optimizationModalVisible}
                    onClose={handleCloseOptimization}
                    onApplyOptimization={handleApplyOptimization}
                    currentMessages={languageMode === 'zh' ? messages : englishMessages}
                    singleOptimization={singleOptimizationData}
                    modelConfig={modelConfig}
                    projectId={Number(projectId)}
                    promptId={promptId ? Number(promptId) : undefined}
                    promptVersionId={promptVersionId ? Number(promptVersionId) : undefined}
                    onReturnToFeedback={handleReturnToFeedback}
                />

                {/* 请求详情弹窗 */}
                <RequestDetailsModal
                    visible={requestDetailsModalVisible}
                    onClose={handleCloseRequestDetails}
                    outputItem={selectedOutputForDetails}
                />

                {/* 历史记录抽屉 */}
                <PromptHistoryDrawer
                    visible={historyDrawerVisible}
                    onClose={handleCloseHistoryDrawer}
                    promptId={Number(promptId)}
                    projectId={Number(projectId)}
                    onViewDetails={handleViewHistoryDetails}
                    source="prompt_editor_test"
                />


            </div>
        );
    }
);

// 为了向后兼容，也导出为默认导出
export default PromptEditorPage; 