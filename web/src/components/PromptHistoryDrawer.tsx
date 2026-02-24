import React, { useState, useEffect } from 'react';

import { 
    Drawer, 
    Space, 
    Tag, 
    List, 
    Avatar, 
    Typography, 
    Spin, 
    Empty, 
    Pagination,
    message
} from 'antd';
import { HistoryOutlined } from '@ant-design/icons';
import { PromptsAPI } from '@/lib/api';
// 定义OutputItem类型
interface OutputItem {
    id: number;
    model: string;
    timestamp: Date;
    response: string;
    cost: number;
    execution_time: number;
    testCase: any;
    error?: string;
    tokens: {
        prompt: number;
        completion: number;
        total: number;
    };
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

const { Text } = Typography;

interface PromptHistoryDrawerProps {
    /** 抽屉是否可见 */
    visible: boolean;
    /** 关闭抽屉的回调 */
    onClose: () => void;
    /** 提示词ID */
    promptId: number;
    /** 项目ID */
    projectId: number;
    /** 查看历史记录详情的回调 */
    onViewDetails: (outputItem: OutputItem) => void;
    /** 请求来源筛选，默认为 'prompt_editor_test' */
    source?: string;
    /** 抽屉宽度，默认600 */
    width?: number;
}

interface HistoryItem {
    id: number;
    created_at: string;
    success: boolean;
    input?: {
        model?: string;
        messages?: Array<{
            role: string;
            content: string;
        }>;
        temperature?: number;
        top_p?: number;
        max_tokens?: number;
        presence_penalty?: number;
        frequency_penalty?: number;
    };
    output?: string;
    error_message?: string;
    execution_time?: number;
    total_tokens?: number;
    prompt_tokens?: number;
    completion_tokens?: number;
    cost?: string;
    source?: string;
    prompt_version_id?: number;
}

interface HistoryPagination {
    current: number;
    pageSize: number;
    total: number;
}

const PromptHistoryDrawer: React.FC<PromptHistoryDrawerProps> = ({
    visible,
    onClose,
    promptId,
    projectId,
    onViewDetails,
    source = 'prompt_editor_test',
    width = 600
}) => {
    
    const [historyData, setHistoryData] = useState<HistoryItem[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyPagination, setHistoryPagination] = useState<HistoryPagination>({
        current: 1,
        pageSize: 10,
        total: 0
    });

    const fetchHistoryData = async (page: number, pageSize: number) => {
        setHistoryLoading(true);
        try {
            const response = await PromptsAPI.getHistory(promptId, {
                page,
                page_size: pageSize,
                source
            });
            setHistoryData(response.data.data);
            setHistoryPagination(prev => ({
                ...prev,
                current: page,
                total: response.data.meta.total
            }));
        } catch (error) {
            console.error('操作失败', error);
            message.error('获取历史数据失败');
        } finally {
            setHistoryLoading(false);
        }
    };

    const handleHistoryPageChange = (page: number, pageSize?: number) => {
        fetchHistoryData(page, pageSize || historyPagination.pageSize);
    };

    const handleViewHistoryDetails = (historyItem: HistoryItem) => {
        // 将历史记录数据转换为OutputItem格式
        const convertedOutputItem: OutputItem = {
            id: historyItem.id,
            model: historyItem.input?.model || 'unknown',
            timestamp: new Date(historyItem.created_at),
            response: historyItem.output || '',
            cost: Number(historyItem.cost) || 0,
            execution_time: historyItem.execution_time || 0,
            testCase: {},
            error: historyItem.error_message || undefined,
            tokens: {
                prompt: historyItem.prompt_tokens || 0,
                completion: historyItem.completion_tokens || 0,
                total: historyItem.total_tokens || 0
            },
            requestDetails: {
                messages: historyItem.input?.messages || [],
                modelConfig: Object.fromEntries(Object.entries(historyItem.input || {}).filter(([key]) => key !== 'messages')),
                projectId: projectId,
                promptId: promptId,
                promptVersionId: historyItem.prompt_version_id || undefined,
                source: historyItem.source
            }
        };
        onViewDetails(convertedOutputItem);
    };

    const handleClose = () => {
        onClose();
        setHistoryData([]);
        setHistoryPagination(prev => ({ ...prev, current: 1, total: 0 }));
    };

    // 当抽屉打开时加载数据
    useEffect(() => {
        if (visible && promptId) {
            fetchHistoryData(1, historyPagination.pageSize);
        }
    }, [visible, promptId, source]);

    return (
        <Drawer
            title={
                <Space>
                    <HistoryOutlined />
                    <span>{'历史记录'}</span>
                    <Tag color="blue">{source}</Tag>
                </Space>
            }
            placement="right"
            onClose={handleClose}
            open={visible}
            width={width}
            bodyStyle={{ padding: 0 }}
        >
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                {historyLoading ? (
                    <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                        <Spin size="large" />
                    </div>
                ) : historyData.length === 0 ? (
                    <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                        <Empty description={'暂无历史记录'} />
                    </div>
                ) : (
                    <>
                        <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
                            <List
                                itemLayout="vertical"
                                dataSource={historyData}
                                renderItem={(item: HistoryItem) => (
                                    <List.Item
                                        key={item.id}
                                        style={{
                                            cursor: 'pointer',
                                            border: '1px solid #f0f0f0',
                                            borderRadius: '6px',
                                            marginBottom: '12px',
                                            padding: '12px',
                                            transition: 'all 0.2s'
                                        }}
                                        onClick={() => handleViewHistoryDetails(item)}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.borderColor = '#1890ff';
                                            e.currentTarget.style.boxShadow = '0 2px 8px rgba(24, 144, 255, 0.15)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.borderColor = '#f0f0f0';
                                            e.currentTarget.style.boxShadow = 'none';
                                        }}
                                    >
                                        <List.Item.Meta
                                            avatar={
                                                <Avatar 
                                                    style={{ 
                                                        backgroundColor: item.success ? '#52c41a' : '#ff4d4f',
                                                        fontSize: '12px'
                                                    }}
                                                >
                                                    {item.success ? '✓' : '✗'}
                                                </Avatar>
                                            }
                                            title={
                                                <Space>
                                                    <Text strong style={{ fontSize: '14px' }}>
                                                        {item.input?.model || 'unknown'}
                                                    </Text>
                                                    <Tag color="blue" style={{ fontSize: '10px' }}>
                                                        {new Date(item.created_at).toLocaleString()}
                                                    </Tag>
                                                </Space>
                                            }
                                            description={
                                                <div>
                                                    <div style={{ marginBottom: '4px' }}>
                                                        <Text type="secondary" style={{ fontSize: '12px' }}>
                                                            {item.success 
                                                                ? (item.output?.slice(0, 100) + ((item.output?.length || 0) > 100 ? '...' : ''))
                                                                : item.error_message
                                                            }
                                                        </Text>
                                                    </div>
                                                    <Space size={8}>
                                                        <Text type="secondary" style={{ fontSize: '11px' }}>
                                                            {`耗时: ${item.execution_time || 0}ms`}
                                                        </Text>
                                                        <Text type="secondary" style={{ fontSize: '11px' }}>
                                                            {`Token: ${item.total_tokens || 0}`}
                                                        </Text>
                                                        <Text type="secondary" style={{ fontSize: '11px' }}>
                                                            {'费用: ${{amount}}'}
                                                        </Text>
                                                    </Space>
                                                </div>
                                            }
                                        />
                                    </List.Item>
                                )}
                            />
                        </div>
                        <div style={{ borderTop: '1px solid #f0f0f0', padding: '16px' }}>
                            <Pagination
                                current={historyPagination.current}
                                pageSize={historyPagination.pageSize}
                                total={historyPagination.total}
                                onChange={handleHistoryPageChange}
                                showSizeChanger
                                showQuickJumper
                                showTotal={(total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`}
                                size="small"
                            />
                        </div>
                    </>
                )}
            </div>
        </Drawer>
    );
};

export default PromptHistoryDrawer;