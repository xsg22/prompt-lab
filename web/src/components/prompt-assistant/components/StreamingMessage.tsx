import React, { useEffect, useState } from 'react';
import { Typography, Avatar } from 'antd';
import { RobotOutlined, LoadingOutlined } from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';

const { Text } = Typography;

interface StreamingMessageProps {
  content: string;
  isStreaming: boolean;
  timestamp?: Date;
  style?: React.CSSProperties;
  tokenColor?: string;
}

const StreamingMessage: React.FC<StreamingMessageProps> = ({
  content,
  isStreaming,
  timestamp,
  style,
  tokenColor = '#1890ff'
}) => {
  const [showCursor, setShowCursor] = useState(true);

  // 光标闪烁效果
  useEffect(() => {
    if (!isStreaming) {
      setShowCursor(false);
      return;
    }

    const interval = setInterval(() => {
      setShowCursor(prev => !prev);
    }, 500);

    return () => clearInterval(interval);
  }, [isStreaming]);

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'flex-start',
        marginBottom: 16,
        ...style
      }}
    >
      <div
        style={{
          maxWidth: '80%',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: 12
        }}
      >
        {/* 头像 */}
        <Avatar
          size="small"
          icon={isStreaming ? <LoadingOutlined /> : <RobotOutlined />}
          style={{
            backgroundColor: tokenColor,
            flexShrink: 0
          }}
        />

        {/* 消息内容 */}
        <div
          style={{
            backgroundColor: '#f5f5f5',
            borderRadius: 12,
            padding: '8px 12px',
            position: 'relative',
            minHeight: isStreaming && !content ? '24px' : 'auto'
          }}
        >
          {content || isStreaming ? (
            <div style={{ position: 'relative' }}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
                components={{
                  p: ({ children }) => <div style={{ margin: 0, lineHeight: '1.5' }}>{children}</div>,
                  code: ({ children, className }) => (
                    <code
                      className={className}
                      style={{
                        backgroundColor: '#f0f0f0',
                        padding: '2px 4px',
                        borderRadius: 4,
                        fontFamily: 'Monaco, Consolas, monospace',
                        fontSize: '13px'
                      }}
                    >
                      {children}
                    </code>
                  ),
                  pre: ({ children }) => (
                    <pre
                      style={{
                        backgroundColor: '#f8f8f8',
                        padding: '8px',
                        borderRadius: 4,
                        overflow: 'auto',
                        margin: '8px 0',
                        fontSize: '13px'
                      }}
                    >
                      {children}
                    </pre>
                  )
                }}
              >
                {content || ''}
              </ReactMarkdown>
              
              {/* 流式光标 */}
              {isStreaming && (
                <span
                  style={{
                    display: 'inline-block',
                    width: '2px',
                    height: '16px',
                    backgroundColor: tokenColor,
                    marginLeft: '2px',
                    verticalAlign: 'text-bottom',
                    opacity: showCursor ? 1 : 0,
                    transition: 'opacity 0.1s ease'
                  }}
                />
              )}
            </div>
          ) : (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 6,
              color: '#999',
              fontSize: '12px'
            }}>
              <LoadingOutlined style={{ fontSize: '12px' }} />
              <span>助理正在思考...</span>
            </div>
          )}

          {/* 时间戳 */}
          {timestamp && !isStreaming && (
            <Text
              style={{
                fontSize: '10px',
                color: '#999',
                display: 'block',
                marginTop: 4,
                textAlign: 'right'
              }}
            >
              {timestamp.toLocaleTimeString()}
            </Text>
          )}
        </div>
      </div>
    </div>
  );
};

export default StreamingMessage; 