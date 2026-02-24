import { useState, useEffect } from "react";
import {
    Modal,
    Form,
    Input,
    Space,
    Tag,
    Card,
    Typography,
    Button,
    Spin,
    Row,
    Col
} from "antd";
import { BulbOutlined } from "@ant-design/icons";

import JSONDisplay from '@/components/json/JSONDisplay';
import type { TestCase } from '@/types/prompt';

const { Text } = Typography;

// 类型定义
export interface OptimizationFeedback {
    description: string;
    expectedOutput?: string;
}

export interface OptimizationResult {
    optimizedPrompt: any[];
    originalResult: string;
    optimizedResult: string;
    score: number;
    evaluation: string;
    executionTime: number;
    promptDiff?: {
        added: string[];
        removed: string[];
        modified: string[];
    };
}

export interface OutputItem {
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

// 组件属性接口
interface OptimizationTriggerProps {
    visible: boolean;
    outputItem: OutputItem | null;
    onClose: () => void;
    onStartOptimization: (outputId: number, feedback: OptimizationFeedback) => void;
    onSaveInputRecord: (outputId: number, description: string, expectedOutput: string) => void;
    onGetInputRecord: (outputId: number) => { description: string; expectedOutput: string };
}

const OptimizationTrigger: React.FC<OptimizationTriggerProps> = ({ 
    visible, 
    outputItem, 
    onClose, 
    onStartOptimization, 
    onSaveInputRecord, 
    onGetInputRecord 
}) => {
    
    const [form] = Form.useForm();
    const [isStarting, setIsStarting] = useState(false);

    // 当弹窗打开或 outputItem 变化时，恢复之前保存的输入内容
    useEffect(() => {
        if (visible && outputItem) {
            const savedRecord = onGetInputRecord(outputItem.id);
            form.setFieldsValue({
                description: savedRecord.description,
                expectedOutput: savedRecord.expectedOutput || outputItem.response || ''
            });
        }
    }, [visible, outputItem, form, onGetInputRecord]);

    // 当弹窗关闭时，重置表单
    useEffect(() => {
        if (!visible) {
            form.resetFields();
        }
    }, [visible, form]);

    // 处理表单字段变化，实时保存输入记录
    const handleFieldChange = () => {
        if (outputItem && visible) {
            const currentValues = form.getFieldsValue();
            onSaveInputRecord(
                outputItem.id,
                currentValues.description || '',
                currentValues.expectedOutput || ''
            );
        }
    };

    const handleSubmit = async () => {
        try {
            setIsStarting(true);
            const values = await form.validateFields();
            const feedback: OptimizationFeedback = {
                description: values.description,
                expectedOutput: values.expectedOutput
            };

            if (outputItem) {
                onStartOptimization(outputItem.id, feedback);
            }

            form.resetFields();
            onClose();
        } catch (error) {
            console.error('表单验证失败', error);
        } finally {
            setIsStarting(false);
        }
    };

    const handleCancel = () => {
        form.resetFields();
        onClose();
    };

    // 如果正在优化中，显示不同的界面
    if (outputItem?.optimizationStatus === 'optimizing') {
        return (
            <Modal
                title={
                    <Space>
                        <Spin size="small" />
                        <span>{'优化进行中'}</span>
                        <Tag color="processing">{'AI分析中'}</Tag>
                    </Space>
                }
                open={visible}
                onCancel={handleCancel}
                footer={[
                    <Button key="close" onClick={handleCancel}>
                        {'关闭'}
                    </Button>
                ]}
                width={600}
                style={{ top: 20 }}
            >
                <div>
                    <Card size="small" style={{ marginBottom: 16, background: '#f0f9ff' }}>
                        <div style={{ textAlign: 'center', padding: '20px 0' }}>
                            <Spin size="large" />
                            <div style={{ marginTop: 16 }}>
                                <Text strong style={{ fontSize: '16px' }}>{'正在优化提示词...'}</Text>
                            </div>
                            <div style={{ marginTop: 8 }}>
                                <Text type="secondary" style={{ fontSize: '12px' }}>
                                    {'AI正在分析您的反馈，生成优化方案并验证效果，请稍候'}
                                </Text>
                            </div>
                        </div>
                    </Card>

                    {outputItem.feedback && (
                        <Card size="small" style={{ background: '#fff7e6' }}>
                            <div style={{ marginBottom: 8 }}>
                                <Text strong style={{ fontSize: '13px' }}>{'优化需求：'}</Text>
                            </div>
                            <div style={{ marginBottom: 8 }}>
                                <Text style={{ fontSize: '12px' }}>{outputItem.feedback.description}</Text>
                            </div>
                            {outputItem.feedback.expectedOutput && (
                                <div>
                                    <Text strong style={{ fontSize: '13px' }}>{'期望输出：'}</Text>
                                    <div style={{
                                        background: '#f6ffed',
                                        padding: '8px',
                                        borderRadius: '4px',
                                        marginTop: 4,
                                        fontSize: '12px'
                                    }}>
                                        {outputItem.feedback.expectedOutput}
                                    </div>
                                </div>
                            )}
                        </Card>
                    )}
                </div>
            </Modal>
        );
    }

    return (
        <Modal
            title={
                <Space>
                    <BulbOutlined style={{ color: '#1890ff' }} />
                    <span>{'优化提示词'}</span>
                    <Tag color="blue">{'单例优化'}</Tag>
                </Space>
            }
            open={visible}
            onCancel={handleCancel}
            onOk={handleSubmit}
            okText={'开始优化'}
            cancelText={'取消'}
            confirmLoading={isStarting}
            width={1200}
            style={{ top: 20 }}
        >
            <Row gutter={24} style={{ height: 'calc(100vh - 300px)', minHeight: '500px' }}>
                {/* 左侧：请求详情和原始输出结果 */}
                <Col span={12}>
                    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                        
                        {/* 说明信息 */}
                        <div style={{
                            background: '#f0f9ff',
                            border: '1px solid #d6e4ff',
                            borderRadius: '6px',
                            padding: '12px',
                            marginTop: 16,
                            marginBottom: 16
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                                <BulbOutlined style={{ color: '#1890ff', marginRight: 6 }} />
                                <Text strong style={{ fontSize: '13px' }}>{'单例优化说明'}</Text>
                            </div>
                            <Text type="secondary" style={{ fontSize: '12px' }}>
                                {'AI将针对此案例进行专门优化，分析问题、改进提示词并验证效果。'}
                                {'优化过程在后台执行，您可以继续处理其他案例。'}
                            </Text>
                        </div>

                        {/* 当前输出结果 */}
                        {outputItem && (
                            <Card 
                                size="small" 
                                title={<Text strong>{'原始输出结果'}</Text>}
                                style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
                                bodyStyle={{ padding: '12px', flex: 1, display: 'flex', flexDirection: 'column' }}
                            >
                                <div style={{
                                    background: '#f6ffed',
                                    border: '1px solid #d9f7be',
                                    borderRadius: '4px',
                                    padding: '12px',
                                    fontSize: '12px',
                                    flex: 1,
                                    overflow: 'auto',
                                    wordBreak: 'break-word'
                                }}>
                                    <JSONDisplay content={outputItem.response} maxHeight="460px" />
                                </div>
                            </Card>
                        )}

                    </div>
                </Col>

                {/* 右侧：优化需求说明和期望输出 */}
                <Col span={12}>
                    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <Form
                            form={form}
                            layout="vertical"
                            onFieldsChange={handleFieldChange}
                            style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
                        >
                            
                            {/* 优化需求说明 */}
                            <Form.Item
                                name="description"
                                label={'优化需求说明'}
                                rules={[{ required: true, message: '请描述您希望如何优化这个结果' }]}
                                style={{ marginBottom: 16 }}
                            >
                                <Input.TextArea
                                    rows={3}
                                    placeholder={'请描述您希望如何优化这个结果，例如：语气更加友好、格式更加规范、内容更加详细等...'}
                                    style={{ resize: 'none' }}
                                />
                            </Form.Item>

                            {/* 期望输出（可选） */}
                            <Form.Item
                                name="expectedOutput"
                                label={'期望输出（可选）'}
                                style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
                            >
                                <Input.TextArea
                                    placeholder={'如果您有具体的期望输出，请在这里提供...'}
                                    style={{ 
                                        resize: 'none',
                                        flex: 1,
                                        minHeight: '480px',
                                    }}
                                />
                            </Form.Item>
                        </Form>
                    </div>
                </Col>
            </Row>
        </Modal>
    );
};

export default OptimizationTrigger;