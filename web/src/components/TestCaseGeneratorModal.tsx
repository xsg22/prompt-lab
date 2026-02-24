import React, { useState } from 'react';
import {
    Modal,
    Button,
    Space,
    Card,
    Checkbox,
    Typography,
    Spin,
    message,
    InputNumber,
    Row,
    Col,
    Divider,
    Input,
    Collapse
} from 'antd';
import {
    BulbOutlined,
    CheckCircleOutlined,
    ExperimentOutlined,
    ExclamationCircleOutlined,
    SettingOutlined,
    EditOutlined,
    CaretRightOutlined
} from '@ant-design/icons';

import { callAIGenerateTestCases, type TestCaseCount, type VariableConstraint } from '@/utils/prompt';
import { type TestCase } from '@/types/prompt';

const { Text } = Typography;
const { TextArea } = Input;
const { Panel } = Collapse;

interface Message {
    role: string;
    content: string;
    order: number;
}

interface GeneratedTestCases {
    normal: TestCase[];
    boundary: TestCase[];
    error: TestCase[];
}



interface TestCaseGeneratorModalProps {
    visible: boolean;
    onClose: () => void;
    onAccept: (testCases: TestCase[]) => void;
    messages: Message[];
    variables: string[];
    projectId: number;
    promptId?: number;
    promptVersionId?: number;
}

export const TestCaseGeneratorModal: React.FC<TestCaseGeneratorModalProps> = ({
    visible,
    onClose,
    onAccept,
    messages,
    variables,
    projectId,
    promptId,
    promptVersionId
}) => {
    
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedTestCases, setGeneratedTestCases] = useState<GeneratedTestCases>({
        normal: [],
        boundary: [],
        error: []
    });
    const [selectedGeneratedCases, setSelectedGeneratedCases] = useState<Set<string>>(new Set());
    const [testCaseCounts, setTestCaseCounts] = useState<TestCaseCount>({
        normal: 5,
        boundary: 0,
        error: 0
    });
    const [variableConstraints, setVariableConstraints] = useState<Record<string, string>>({});
    const [customRequirement, setCustomRequirement] = useState<string>('');

    const handleCountChange = (type: keyof TestCaseCount, value: number | null) => {
        if (value !== null && value >= 0 && value <= 100) {
            setTestCaseCounts(prev => ({
                ...prev,
                [type]: value
            }));
        }
    };

    const handleVariableConstraintChange = (variable: string, constraint: string) => {
        setVariableConstraints(prev => ({
            ...prev,
            [variable]: constraint
        }));
    };

    const handleGenerate = async () => {
        if (variables.length === 0) {
            message.warning('请先添加变量');
            return;
        }

        const totalCount = testCaseCounts.normal + testCaseCounts.boundary + testCaseCounts.error;
        if (totalCount === 0) {
            message.warning('请先设置测试用例数量');
            return;
        }

        setIsGenerating(true);

        try {
            const constraints: VariableConstraint[] = Object.entries(variableConstraints)
                .filter(([_, constraint]) => constraint.trim())
                .map(([variable, constraint]) => ({ variable, constraint: constraint.trim() }));

            const result = await callAIGenerateTestCases(
                messages,
                variables,
                projectId,
                testCaseCounts,
                constraints.length > 0 ? constraints : undefined,
                customRequirement.trim() || undefined,
                promptId,
                promptVersionId,
            );

            setGeneratedTestCases(result);

            const normalIds = result.normal.map((_, index) => `normal-${index}`);
            setSelectedGeneratedCases(new Set(normalIds));

            message.success('测试用例生成成功');
        } catch (error: any) {
            console.error('生成测试用例失败', error);
            message.error('生成测试用例失败，请重试');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSelectGeneratedCase = (category: string, index: number, selected: boolean) => {
        const caseId = `${category}-${index}`;
        const newSelected = new Set(selectedGeneratedCases);
        
        if (selected) {
            newSelected.add(caseId);
        } else {
            newSelected.delete(caseId);
        }
        
        setSelectedGeneratedCases(newSelected);
    };

    const handleSelectAllCategory = (category: 'normal' | 'boundary' | 'error', selected: boolean) => {
        const newSelected = new Set(selectedGeneratedCases);
        const cases = generatedTestCases[category];
        
        cases.forEach((_, index) => {
            const caseId = `${category}-${index}`;
            if (selected) {
                newSelected.add(caseId);
            } else {
                newSelected.delete(caseId);
            }
        });
        
        setSelectedGeneratedCases(newSelected);
    };

    const handleAcceptGeneratedCases = () => {
        const casesToAdd: TestCase[] = [];
        
        selectedGeneratedCases.forEach(caseId => {
            const [category, indexStr] = caseId.split('-');
            const index = parseInt(indexStr);
            
            if (category === 'normal' && generatedTestCases.normal[index]) {
                casesToAdd.push(generatedTestCases.normal[index]);
            } else if (category === 'boundary' && generatedTestCases.boundary[index]) {
                casesToAdd.push(generatedTestCases.boundary[index]);
            } else if (category === 'error' && generatedTestCases.error[index]) {
                casesToAdd.push(generatedTestCases.error[index]);
            }
        });

        if (casesToAdd.length > 0) {
            onAccept(casesToAdd);
            handleClose();
        } else {
            message.warning('请选择要添加的测试用例');
        }
    };

    const handleClose = () => {
        // 只清空生成结果和选择状态，保留配置信息
        setGeneratedTestCases({ normal: [], boundary: [], error: [] });
        setSelectedGeneratedCases(new Set());
        onClose();
    };

    const renderTestCaseCategory = (
        category: 'normal' | 'boundary' | 'error',
        title: string,
        icon: React.ReactNode,
        borderColor: string,
        backgroundColor: string
    ) => {
        const cases = generatedTestCases[category];
        if (cases.length === 0) return null;

        return (
            <Card
                size="small"
                title={
                    <Space>
                        <Checkbox
                            checked={cases.every((_, index) => 
                                selectedGeneratedCases.has(`${category}-${index}`)
                            )}
                            indeterminate={
                                cases.some((_, index) => 
                                    selectedGeneratedCases.has(`${category}-${index}`)
                                ) && !cases.every((_, index) => 
                                    selectedGeneratedCases.has(`${category}-${index}`)
                                )
                            }
                            onChange={(e) => handleSelectAllCategory(category, e.target.checked)}
                        />
                        {icon}
                        <Text strong>{title} ({cases.length})</Text>
                    </Space>
                }
                style={{ border: `1px solid ${borderColor}` }}
            >
                <Space direction="vertical" style={{ width: '100%' }} size={8}>
                    {cases.map((testCase, index) => (
                        <Card
                            key={index}
                            size="small"
                            style={{
                                background: selectedGeneratedCases.has(`${category}-${index}`) ? backgroundColor : '#fafafa'
                            }}
                            styles={{ body: { padding: '8px 12px' } }}
                        >
                            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                                <Space direction="vertical" size={4}>
                                    {Object.entries(testCase).filter(([key]) => key !== 'metadatas').map(([key, value]) => (
                                        <div key={key}>
                                            <Text strong style={{ fontSize: '12px' }}>{key}:</Text>
                                            <Text style={{ fontSize: '12px', marginLeft: 8 }}>{JSON.stringify(value)}</Text>
                                        </div>
                                    ))}
                                </Space>
                                <Checkbox
                                    checked={selectedGeneratedCases.has(`${category}-${index}`)}
                                    onChange={(e) => handleSelectGeneratedCase(category, index, e.target.checked)}
                                />
                            </Space>
                        </Card>
                    ))}
                </Space>
            </Card>
        );
    };

    const renderCountSettings = () => (
        <div style={{ marginBottom: 8 }}>
            <Row gutter={16}>
                <Col span={8}>
                    <Space size={6} align="center">
                        <CheckCircleOutlined style={{ color: '#52c41a', fontSize: '14px' }} />
                        <Text style={{ fontSize: '14px', minWidth: '50px' }}>{'正常情况'}</Text>
                        <InputNumber
                            min={0}
                            max={100}
                            value={testCaseCounts.normal}
                            onChange={(value) => handleCountChange('normal', value)}
                            style={{ width: '60px' }}
                            size="middle"
                            placeholder={'数量'}
                        />
                    </Space>
                </Col>
                <Col span={8}>
                    <Space size={6} align="center">
                        <ExperimentOutlined style={{ color: '#fa8c16', fontSize: '14px' }} />
                        <Text style={{ fontSize: '14px', minWidth: '50px' }}>{'边界情况'}</Text>
                        <InputNumber
                            min={0}
                            max={100}
                            value={testCaseCounts.boundary}
                            onChange={(value) => handleCountChange('boundary', value)}
                            style={{ width: '60px' }}
                            size="middle"
                            placeholder={'数量'}
                        />
                    </Space>
                </Col>
                <Col span={8}>
                    <Space size={6} align="center">
                        <ExclamationCircleOutlined style={{ color: '#ff4d4f', fontSize: '14px' }} />
                        <Text style={{ fontSize: '14px', minWidth: '50px' }}>{'异常情况'}</Text>
                        <InputNumber
                            min={0}
                            max={100}
                            value={testCaseCounts.error}
                            onChange={(value) => handleCountChange('error', value)}
                            style={{ width: '60px' }}
                            size="middle"
                            placeholder={'数量'}
                        />
                    </Space>
                </Col>
            </Row>
        </div>
    );

    const renderVariableConstraints = () => {
        // 动态计算最长变量名的宽度，确保所有变量名都能完整显示
        const maxVariableNameLength = variables.length > 0 ? Math.max(...variables.map(v => v.length)) : 0;
        // 基础宽度 + 字符宽度估算 + 冒号和padding
        const variableColWidth = Math.min(150, Math.max(80, maxVariableNameLength * 8 + 20));
        
        return (
            <div style={{ marginBottom: 8 }}>
                <div style={{ marginBottom: 6 }}>
                    <Space size={4}>
                        <EditOutlined style={{ fontSize: '14px' }} />
                        <Text style={{ fontSize: '14px' }}>{'变量约束'}</Text>
                        <Text type="secondary" style={{ fontSize: '13px' }}>({'可选'})</Text>
                    </Space>
                </div>
                <Space direction="vertical" style={{ width: '100%' }} size={8}>
                    {variables.map(variable => (
                        <Row key={variable} align="top" gutter={8}>
                            <Col flex={`${variableColWidth}px`}>
                                <Text strong style={{ 
                                    fontSize: '14px', 
                                    lineHeight: '32px',
                                    display: 'block',
                                    textAlign: 'right',
                                    paddingRight: '4px',
                                    whiteSpace: 'nowrap'
                                }}>
                                    {variable}:
                                </Text>
                            </Col>
                            <Col flex="1">
                                <TextArea
                                    placeholder={'为此变量设置约束条件，例如：必须是有效的邮箱地址'}
                                    value={variableConstraints[variable] || ''}
                                    onChange={(e) => handleVariableConstraintChange(variable, e.target.value)}
                                    size="middle"
                                    autoSize={{ minRows: 1, maxRows: 3 }}
                                    style={{ 
                                        fontSize: '14px',
                                        resize: 'none',
                                        height: '30px'
                                    }}
                                />
                            </Col>
                        </Row>
                    ))}
                </Space>
            </div>
        );
    };

    const renderCustomRequirement = () => (
        <div>
            <div style={{ marginBottom: 6 }}>
                <Space size={4}>
                    <EditOutlined style={{ fontSize: '14px' }} />
                    <Text style={{ fontSize: '14px' }}>{'整体要求'}</Text>
                    <Text type="secondary" style={{ fontSize: '13px' }}>({'可选'})</Text>
                </Space>
            </div>
            <TextArea
                placeholder={'描述测试用例的整体要求，例如：测试用例应该覆盖电商场景'}
                value={customRequirement}
                onChange={(e) => setCustomRequirement(e.target.value)}
                rows={3}
                maxLength={500}
                showCount
                style={{ fontSize: '14px' }}
                size="middle"
            />
        </div>
    );

    // 检查是否有生成的测试用例
    const hasGeneratedCases = generatedTestCases.normal.length > 0 || 
                             generatedTestCases.boundary.length > 0 || 
                             generatedTestCases.error.length > 0;

    const renderConfigurationSection = () => {
        const configContent = (
            <div style={{ 
                padding: hasGeneratedCases ? '0 4px 8px 4px' : '12px',
                maxHeight: hasGeneratedCases ? '300px' : 'auto',
                overflow: hasGeneratedCases ? 'auto' : 'visible'
            }}>
                <Space direction="vertical" style={{ width: '100%' }} size={8}>
                    {renderCountSettings()}
                    {variables.length > 0 && (
                        <>
                            <Divider style={{ margin: '6px 0' }} />
                            {renderVariableConstraints()}
                        </>
                    )}
                    {hasGeneratedCases ? (
                        <div style={{ 
                            borderTop: '1px solid #f0f0f0', 
                            paddingTop: 8,
                            marginTop: 4
                        }}>
                            {renderCustomRequirement()}
                        </div>
                    ) : (
                        <>
                            <Divider style={{ margin: '6px 0' }} />
                            {renderCustomRequirement()}
                        </>
                    )}
                </Space>
                {!hasGeneratedCases && (
                    <div style={{ marginTop: 8 }}>
                        <Text type="secondary" style={{ fontSize: '11px' }}>
                            {'* 每种类型最多可生成100个测试用例'}
                        </Text>
                    </div>
                )}
            </div>
        );

        if (hasGeneratedCases) {
            // 有生成结果时，使用折叠面板弱化显示
            return (
                <Collapse 
                    size="small"
                    expandIcon={({ isActive }) => <CaretRightOutlined rotate={isActive ? 90 : 0} />}
                    style={{ 
                        marginBottom: 12,
                        backgroundColor: '#fafafa',
                        border: '1px solid #f0f0f0',
                        borderRadius: 6
                    }}
                >
                    <Panel 
                        header={
                            <Space size={4}>
                                <SettingOutlined style={{ fontSize: '12px', color: '#8c8c8c' }} />
                                <Text style={{ fontSize: '12px', color: '#8c8c8c' }}>{'生成配置'}</Text>
                                {isGenerating && <Spin size="small" />}
                            </Space>
                        } 
                        key="config"
                        style={{ 
                            backgroundColor: '#fafafa',
                            border: 'none'
                        }}
                    >
                        {configContent}
                    </Panel>
                </Collapse>
            );
        } else {
            // 没有生成结果时，正常显示
            return (
                <Card 
                    size="small" 
                    title={
                        <Space size={4}>
                            <SettingOutlined />
                            <Text strong>{'生成配置'}</Text>
                            {isGenerating && (
                                <Space size={4}>
                                    <Spin size="small" />
                                    <Text style={{ fontSize: '12px', color: '#1890ff' }}>{'生成中...'}</Text>
                                </Space>
                            )}
                        </Space>
                    }
                    style={{ marginBottom: 12 }}
                    styles={{ body: { padding: '0px' } }}
                >
                    {configContent}
                </Card>
            );
        }
    };

    return (
        <Modal
            title={
                <Space>
                    <BulbOutlined />
                    <span>{'智能生成测试用例'}</span>
                </Space>
            }
            open={visible}
            onCancel={handleClose}
            width={800}
            style={hasGeneratedCases ? { 
                top: 20,
                paddingBottom: 0
            } : undefined}
            styles={hasGeneratedCases ? {
                body: {
                    height: Math.min(800, window.innerHeight - 200),
                    overflow: 'auto',
                    padding: '16px'
                },
                content: {
                    maxHeight: `${window.innerHeight - 80}px`,
                    overflow: 'hidden'
                }
            } : {
                body: {
                    padding: '16px'
                }
            }}
            footer={
                <Space size={8}>
                    <Button key="regenerate" onClick={handleGenerate} loading={isGenerating}>
                        {hasGeneratedCases ? '重新生成' : '开始生成'}
                    </Button>
                    <Button key="cancel" onClick={handleClose} disabled={isGenerating}>
                        {'取消'}
                    </Button>
                    <Button
                        key="accept"
                        type="primary"
                        onClick={handleAcceptGeneratedCases}
                        disabled={selectedGeneratedCases.size === 0 || isGenerating}
                    >
                        {'添加测试用例'} ({selectedGeneratedCases.size})
                    </Button>
                </Space>
            }
        >
            <Space direction="vertical" style={{ width: '100%' }} size={12}>
                {/* 配置区域 */}
                {renderConfigurationSection()}

                {/* 正常情况 */}
                {renderTestCaseCategory(
                    'normal',
                    '正常情况',
                    <CheckCircleOutlined style={{ color: '#52c41a' }} />,
                    '#d9f7be',
                    '#f6ffed'
                )}

                {/* 边界情况 */}
                {renderTestCaseCategory(
                    'boundary',
                    '边界情况',
                    <ExperimentOutlined style={{ color: '#fa8c16' }} />,
                    '#ffe7ba',
                    '#fff7e6'
                )}

                {/* 异常情况 */}
                {renderTestCaseCategory(
                    'error',
                    '异常情况',
                    <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />,
                    '#ffccc7',
                    '#fff2f0'
                )}
            </Space>
        </Modal>
    );
};

export default TestCaseGeneratorModal; 