import React, { useState } from 'react';
import { Modal, Button } from 'antd';
import { ExpandOutlined, CopyOutlined } from '@ant-design/icons';
import { copyToClipboard } from '@/lib/utils';
import { message } from 'antd';


interface JSONDisplayProps {
    content: string;
    maxHeight?: string;
    useContainerHeight?: boolean; // 新增：是否使用容器高度
}

// JSON 检测和格式化工具函数
const isValidJSON = (str: string): boolean => {
    try {
        JSON.parse(str.trim());
        return true;
    } catch {
        return false;
    }
};

const formatJSON = (jsonStr: string): string => {
    try {
        return JSON.stringify(JSON.parse(jsonStr.trim()), null, 2);
    } catch {
        return jsonStr;
    }
};

const JSONDisplay: React.FC<JSONDisplayProps> = ({ 
    content, 
    maxHeight = '100px',
    useContainerHeight = false
}) => {
    
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const isJSON = isValidJSON(content);
    
    const handleCopy = async (text: string) => {
        const success = await copyToClipboard(text);
        if (success) {
            message.success('复制成功');
        } else {
            message.error('复制失败');
        }
    };
    
    if (!content.trim()) {
        return <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#999' }}>{'暂无内容'}</div>;
    }
    
    // 普通文本显示
    if (!isJSON) {
        const isLongContent = content.length > 200 || content.split('\n').length > 3;
        const shouldUseMaxHeight = isLongContent && !useContainerHeight;
        
        return (
            <div 
                style={{ position: 'relative', height: useContainerHeight ? '100%' : 'auto' }}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                <div style={{
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    maxHeight: shouldUseMaxHeight ? maxHeight : 'none',
                    height: useContainerHeight ? '100%' : 'auto',
                    overflow: shouldUseMaxHeight ? 'hidden' : (useContainerHeight ? 'auto' : 'visible'),
                    position: 'relative',
                    fontSize: '11px',
                    lineHeight: '1.4',
                    padding: '8px',
                    background: '#f8f9fa',
                    border: '1px solid #e9ecef',
                    borderRadius: '3px',
                    boxSizing: 'border-box'
                }}>
                    {content}
                    
                </div>
                
                {/* 放大按钮 - 鼠标悬停时显示 */}
                {isLongContent && (
                    <Button
                        type="text"
                        size="small"
                        icon={<ExpandOutlined />}
                        style={{
                            position: 'absolute',
                            top: '4px',
                            right: '4px',
                            fontSize: '12px',
                            height: '24px',
                            width: '24px',
                            padding: 0,
                            opacity: isHovered ? 1 : 0,
                            transition: 'opacity 0.2s ease-in-out',
                            background: 'rgba(255, 255, 255, 0.9)',
                            border: '1px solid #d9d9d9',
                            borderRadius: '4px',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                        }}
                        onClick={() => setIsModalVisible(true)}
                    />
                )}
                
                {/* 长文本展开模态框 */}
                <Modal
                    title={'文本内容'}
                    open={isModalVisible}
                    onCancel={() => setIsModalVisible(false)}
                    footer={[
                        <Button 
                            key="copy" 
                            icon={<CopyOutlined />}
                            onClick={() => handleCopy(content)}
                        >
                            {'复制'}
                        </Button>,
                        <Button key="close" onClick={() => setIsModalVisible(false)}>
                            {'关闭'}
                        </Button>
                    ]}
                    width={800}
                    style={{ top: 20 }}
                >
                    <div style={{
                        maxHeight: '60vh',
                        overflow: 'auto',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        fontSize: '13px',
                        lineHeight: '1.5',
                        padding: '12px',
                        background: '#f8f9fa',
                        border: '1px solid #e9ecef',
                        borderRadius: '6px',
                        fontFamily: 'SFMono-Regular, Consolas, "Liberation Mono", Menlo, Courier, monospace'
                    }}>
                        {content}
                    </div>
                </Modal>
            </div>
        );
    }
    
    // JSON格式显示
    const formattedJSON = formatJSON(content);
    const isLongJSON = formattedJSON.split('\n').length > 4 || formattedJSON.length > 300;
    const shouldUseMaxHeightForJSON = isLongJSON && !useContainerHeight;
    
    return (
        <div 
            style={{ position: 'relative', height: useContainerHeight ? '100%' : 'auto' }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <pre style={{
                fontFamily: 'SFMono-Regular, Consolas, "Liberation Mono", Menlo, Courier, monospace',
                fontSize: '10px',
                lineHeight: '1.4',
                margin: 0,
                padding: '8px',
                background: '#f8f9fa',
                border: '1px solid #e9ecef',
                borderRadius: '3px',
                overflow: 'auto',
                maxHeight: shouldUseMaxHeightForJSON ? maxHeight : 'none',
                height: useContainerHeight ? '100%' : 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                position: 'relative',
                boxSizing: 'border-box'
            }}>
                {formattedJSON}
               
            </pre>
            
            {/* 放大按钮 - 鼠标悬停时显示 */}
            {isLongJSON && (
                <Button
                    type="text"
                    size="small"
                    icon={<ExpandOutlined />}
                    style={{
                        position: 'absolute',
                        top: '4px',
                        right: '4px',
                        fontSize: '12px',
                        height: '24px',
                        width: '24px',
                        padding: 0,
                        opacity: isHovered ? 1 : 0,
                        transition: 'opacity 0.2s ease-in-out',
                        background: 'rgba(255, 255, 255, 0.9)',
                        border: '1px solid #d9d9d9',
                        borderRadius: '4px',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                    }}
                    onClick={() => setIsModalVisible(true)}
                />
            )}
            
            {/* JSON展开模态框 */}
            <Modal
                title={'JSON 内容'}
                open={isModalVisible}
                onCancel={() => setIsModalVisible(false)}
                footer={[
                    <Button 
                        key="copy" 
                        icon={<CopyOutlined />}
                        onClick={() => handleCopy(formattedJSON)}
                    >
                        {'复制JSON'}
                    </Button>,
                    <Button 
                        key="copy-raw" 
                        onClick={() => handleCopy(content)}
                    >
                        {'复制原文'}
                    </Button>,
                    <Button key="close" onClick={() => setIsModalVisible(false)}>
                        {'关闭'}
                    </Button>
                ]}
                width={900}
                style={{ top: 20 }}
            >
                <div style={{
                    maxHeight: '70vh',
                    overflow: 'auto',
                    fontSize: '12px',
                    lineHeight: '1.5'
                }}>
                    <pre style={{
                        fontFamily: 'SFMono-Regular, Consolas, "Liberation Mono", Menlo, Courier, monospace',
                        margin: 0,
                        padding: '16px',
                        background: '#f8f9fa',
                        border: '1px solid #e9ecef',
                        borderRadius: '6px',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word'
                    }}>
                        {formattedJSON}
                    </pre>
                </div>
            </Modal>
        </div>
    );
};

export default JSONDisplay; 