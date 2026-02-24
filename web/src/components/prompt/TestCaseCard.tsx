import React, { memo, useCallback } from 'react';
import { Card, Space, Badge, Typography, Tag, Button } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';

import LongTextEditor from '@/components/ui/LongTextEditor';
import type { TestCase } from '@/types/prompt';

const { Text } = Typography;

interface TestCaseCardProps {
    testCase: TestCase;
    index: number;
    currentTestCase: number;
    autoSize?: {
        minRows: number;
        maxRows: number;
    };
    onUpdate: (index: number, variable: string, value: string) => void;
    onDelete: (index: number) => void;
    onSelect: (index: number) => void;
}

const TestCaseCard = memo<TestCaseCardProps>(({ 
    testCase, 
    index, 
    currentTestCase, 
    autoSize,
    onUpdate, 
    onDelete, 
    onSelect 
}) => {
    
    const metadata = testCase.metadatas;
    const isAIGenerated = metadata?.source === 'ai_generated';
    const caseType = metadata?.type;
    const isSelected = currentTestCase === index;

    // 根据类型设置颜色
    const getTypeColor = (type?: string) => {
        switch (type) {
            case 'normal': return '#52c41a'; // 绿色
            case 'boundary': return '#fa8c16'; // 橙色
            case 'error': return '#ff4d4f'; // 红色
            default: return '#1890ff'; // 蓝色（手动添加）
        }
    };

    const getTypeText = (type?: string) => {
        switch (type) {
            case 'normal': return '正常';
            case 'boundary': return '边界';
            case 'error': return '异常';
            default: return '手动';
        }
    };

    // 使用 useCallback 优化事件处理器
    const handleUpdate = useCallback((variable: string, value: string) => {
        onUpdate(index, variable, value);
    }, [index, onUpdate]);

    const handleDelete = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        onDelete(index);
    }, [index, onDelete]);

    const handleSelect = useCallback(() => {
        onSelect(index);
    }, [index, onSelect]);

    return (
        <Card
            size="small"
            style={{
                border: isSelected ? '2px solid #1890ff' : '1px solid #e8f4fd',
                backgroundColor: isSelected ? '#f0f9ff' : 'white'
            }}
            onClick={handleSelect}
            title={
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Space size={4}>
                        <Badge count={index + 1} size="small" style={{ backgroundColor: isSelected ? '#1890ff' : '#52c41a' }} />
                        <Text style={{ fontSize: '12px' }}>{`用例 ${index + 1}`}</Text>
                        {/* 显示类型标签 */}
                        <Tag
                            color={getTypeColor(caseType)}
                            style={{ fontSize: '10px', margin: '0 2px' }}
                        >
                            {isAIGenerated ? '🤖' : '👤'} {getTypeText(caseType)}
                        </Tag>
                        {isSelected && <Tag color="blue" style={{ fontSize: '10px' }}>{'选中'}</Tag>}
                    </Space>
                    <Button
                        type="text"
                        size="small"
                        icon={<DeleteOutlined />}
                        danger
                        onClick={handleDelete}
                    />
                </div>
            }
        >
            <Space direction="vertical" style={{ width: '100%' }} size={4}>
                {Object.entries(testCase).filter(([key]) => key !== 'metadatas').map(([key, value]) => (
                    <div key={key} style={{ display: 'flex', flexDirection: 'column' }}>
                        <Text strong style={{ fontSize: '11px', color: '#666', marginBottom: 2 }}>
                            {key}:
                        </Text>
                        <LongTextEditor
                            value={value || ''}
                            onChange={(newValue) => handleUpdate(key, newValue)}
                            placeholder={`输入${key}值`}
                            autoSize={autoSize}
                        />
                    </div>
                ))}
            </Space>
        </Card>
    );
});

TestCaseCard.displayName = 'TestCaseCard';

export default TestCaseCard; 