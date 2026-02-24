import React from 'react';

import { 
    Modal, 
    Button, 
    Space, 
    Row, 
    Col, 
    Statistic, 
    Divider,
    Typography,
    message 
} from 'antd';
import { 
    EyeOutlined, 
    CopyOutlined,
    CloseOutlined 
} from '@ant-design/icons';
import { copyToClipboard } from '@/lib/utils';
import JSONDisplay from '@/components/json/JSONDisplay';

const { Text } = Typography;

interface RequestDetailsModalProps {
    visible: boolean;
    onClose: () => void;
    outputItem: {
        id: number;
        model: string;
        timestamp: Date;
        response: string;
        cost: number;
        execution_time: number;
        tokens: {
            prompt: number;
            completion: number;
            total: number;
        };
        error?: string;
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
        testCase: any;
    } | null;
}

const RequestDetailsModal: React.FC<RequestDetailsModalProps> = ({
    visible,
    onClose,
    outputItem
}) => {
    
    // 复制原始请求数据
    const handleCopyRawRequest = async () => {
        if (!outputItem?.requestDetails) {
            message.error('没有请求详情可以复制');
            return;
        }

        const rawRequest = {
            model: outputItem.model,
            modelConfig: outputItem.requestDetails.modelConfig,
            messages: outputItem.requestDetails.messages
        };

        const success = await copyToClipboard(JSON.stringify(rawRequest, null, 2));
        if (success) {
            message.success('原始请求已复制到剪贴板');
        } else {
            message.error('复制失败');
        }
    };

    if (!outputItem) return null;

    return (
        <Modal
            title={
                <Space>
                    <EyeOutlined />
                    <span>{'请求详情'}</span>
                </Space>
            }
            open={visible}
            onCancel={onClose}
            footer={
                <Space>
                    <Button 
                        icon={<CopyOutlined />}
                        onClick={handleCopyRawRequest}
                    >
                        {'复制原始请求'}
                    </Button>
                    <Button 
                        type="primary" 
                        icon={<CloseOutlined />}
                        onClick={onClose}
                    >
                        {'关闭'}
                    </Button>
                </Space>
            }
            width={1200}
            style={{ top: 20 }}
        >
            <div style={{ maxHeight: '75vh', overflow: 'auto' }}>
                {/* 概览信息 */}
                <Row gutter={16} style={{ marginBottom: 16 }}>
                    <Col span={4}>
                        <Statistic 
                            title={'模型'}
                            value={outputItem.model}
                            valueStyle={{ fontSize: '13px' }}
                        />
                    </Col>
                    <Col span={4}>
                        <Statistic 
                            title={'执行时间'}
                            value={outputItem.execution_time}
                            suffix="ms"
                            valueStyle={{ fontSize: '13px' }}
                        />
                    </Col>
                    <Col span={4}>
                        <Statistic 
                            title={'费用'}
                            value={outputItem.cost}
                            prefix="$"
                            precision={6}
                            valueStyle={{ fontSize: '13px' }}
                        />
                    </Col>
                    <Col span={4}>
                        <Statistic 
                            title={'输入Token'}
                            value={outputItem.tokens.prompt}
                            valueStyle={{ fontSize: '13px' }}
                        />
                    </Col>
                    <Col span={4}>
                        <Statistic 
                            title={'输出Token'}
                            value={outputItem.tokens.completion}
                            valueStyle={{ fontSize: '13px' }}
                        />
                    </Col>
                    <Col span={4}>
                        <Statistic 
                            title={'总Token'}
                            value={outputItem.tokens.total}
                            valueStyle={{ fontSize: '13px' }}
                        />
                    </Col>
                </Row>

                <Divider style={{ margin: '12px 0' }} />

                <Row gutter={16}>
                    {/* 左侧：输入信息 */}
                    <Col span={12}>
                        <div style={{ 
                            background: '#fafafa', 
                            border: '1px solid #e8e8e8',
                            borderRadius: 6,
                            height: '50vh',
                            overflow: 'auto'
                        }}>
                            {/* 模型配置 */}
                            <div style={{ 
                                background: '#f0f0f0', 
                                padding: '8px 12px', 
                                borderBottom: '1px solid #e8e8e8',
                                fontWeight: 'bold',
                                fontSize: '13px'
                            }}>
                                {'🔧 模型配置'}
                            </div>
                            <div style={{ padding: '8px 12px' }}>
                                <JSONDisplay 
                                    content={JSON.stringify(outputItem.requestDetails?.modelConfig || {}, null, 2)}
                                />
                            </div>

                            <Divider style={{ margin: '8px 0' }} />

                            {/* 输入消息 */}
                            <div style={{ 
                                background: '#f0f0f0', 
                                padding: '8px 12px', 
                                borderBottom: '1px solid #e8e8e8',
                                fontWeight: 'bold',
                                fontSize: '13px'
                            }}>
                                {'💬 输入消息'}
                            </div>
                            <div style={{ padding: '8px 12px' }}>
                                {outputItem.requestDetails?.messages?.map((msg, index) => (
                                    <div key={index} style={{ marginBottom: 8 }}>
                                        <div style={{ 
                                            background: msg.role === 'system' ? '#e6f4ff' : msg.role === 'user' ? '#f6ffed' : '#fff7e6',
                                            border: `1px solid ${msg.role === 'system' ? '#91caff' : msg.role === 'user' ? '#b7eb8f' : '#ffd591'}`,
                                            borderRadius: 4,
                                            padding: 8
                                        }}>
                                            <div style={{ 
                                                fontWeight: 'bold',
                                                fontSize: '11px',
                                                color: msg.role === 'system' ? '#1677ff' : msg.role === 'user' ? '#52c41a' : '#fa8c16',
                                                marginBottom: 4
                                            }}>
                                                {msg.role.toUpperCase()}
                                            </div>
                                            <div style={{ 
                                                fontSize: '12px',
                                                lineHeight: 1.4,
                                                whiteSpace: 'pre-wrap',
                                                fontFamily: 'SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace'
                                            }}>
                                                {msg.content}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* 测试用例信息 */}
                            {Object.keys(outputItem.testCase || {}).length > 0 && (
                                <>
                                    <Divider style={{ margin: '8px 0' }} />
                                    <div style={{ 
                                        background: '#f0f0f0', 
                                        padding: '8px 12px', 
                                        borderBottom: '1px solid #e8e8e8',
                                        fontWeight: 'bold',
                                        fontSize: '13px'
                                    }}>
                                        {'🧪 测试用例'}
                                    </div>
                                    <div style={{ padding: '8px 12px' }}>
                                        <JSONDisplay 
                                            content={JSON.stringify(outputItem.testCase, null, 2)}
                                        />
                                    </div>
                                </>
                            )}
                        </div>
                    </Col>

                    {/* 右侧：输出信息 */}
                    <Col span={12}>
                        <div style={{ 
                            background: '#fafafa', 
                            border: '1px solid #e8e8e8',
                            borderRadius: 6,
                            height: '50vh',
                            overflow: 'auto'
                        }}>
                            <div style={{ 
                                background: outputItem.error ? '#fff2f0' : '#f6ffed', 
                                padding: '8px 12px', 
                                borderBottom: '1px solid #e8e8e8',
                                fontWeight: 'bold',
                                fontSize: '13px',
                                color: outputItem.error ? '#cf1322' : '#52c41a'
                            }}>
                                {outputItem.error ? '❌ 输出错误' : '✅ 输出结果'}
                            </div>
                            <div style={{ padding: '12px' }}>
                                {outputItem.error ? (
                                    <div style={{
                                        background: '#fff2f0',
                                        border: '1px solid #ffccc7',
                                        borderRadius: 4,
                                        padding: 12,
                                        color: '#cf1322',
                                        fontSize: '13px',
                                        lineHeight: 1.5
                                    }}>
                                        {outputItem.error}
                                    </div>
                                ) : (
                                    <div style={{
                                        background: '#f6ffed',
                                        border: '1px solid #d9f7be',
                                        borderRadius: 4,
                                        padding: 12,
                                        whiteSpace: 'pre-wrap',
                                        lineHeight: 1.5,
                                        fontSize: '13px',
                                        fontFamily: 'SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace'
                                    }}>
                                        {outputItem.response}
                                    </div>
                                )}

                                {/* 时间戳信息 */}
                                <div style={{ 
                                    marginTop: 12,
                                    padding: 8,
                                    background: '#f0f0f0',
                                    borderRadius: 4,
                                    fontSize: '11px',
                                    color: '#666'
                                }}>
                                    <Text type="secondary">
                                        {`请求时间: ${new Date(outputItem.timestamp).toLocaleString()}`}
                                    </Text>
                                </div>
                            </div>
                        </div>
                    </Col>
                </Row>
            </div>
        </Modal>
    );
};

export default RequestDetailsModal;