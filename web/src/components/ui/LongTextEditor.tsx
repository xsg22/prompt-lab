import React, { useState, useEffect } from 'react';
import { Input, Button, Modal, Typography, Tooltip, Radio } from 'antd';
import {
  ExpandOutlined,
  CodeOutlined,
  FileTextOutlined
} from '@ant-design/icons';

const { TextArea } = Input;
const { Text } = Typography;

interface LongTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxPreviewLength?: number;
  editable?: boolean;
  autoSize?: {
    minRows: number;
    maxRows: number;
  };
  onTextAreaRef?: (ref: HTMLTextAreaElement | null) => void;
  // 简洁模式 
  simpleMode?: boolean;
}

const LongTextEditor: React.FC<LongTextEditorProps> = ({
  value = '',
  onChange,
  placeholder,
  maxPreviewLength = 10,
  editable = true,
  autoSize,
  onTextAreaRef,
  simpleMode = true,
}) => {
  // 状态
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [tempValue, setTempValue] = useState(value);
  const [viewMode, setViewMode] = useState<'plain' | 'code'>('plain');
  const [isHovered, setIsHovered] = useState(false);

  // 当外部value变更时，更新tempValue
  useEffect(() => {
    setTempValue(value);
  }, [value]);

  // 内容是否超长
  const isLongText = value.length > maxPreviewLength;

  // 直接编辑处理
  const handleDirectChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!editable) return;
    const newValue = e.target.value;
    onChange(newValue);
  };

  // 打开展开编辑模态框
  const openExpandModal = () => {
    setTempValue(value);
    setIsModalVisible(true);
  };

  // 保存展开编辑
  const handleModalOk = () => {
    onChange(tempValue);
    setIsModalVisible(false);
  };

  // 取消展开编辑
  const handleModalCancel = () => {
    setTempValue(value); // 恢复原值
    setIsModalVisible(false);
  };

  // 尝试格式化JSON
  const formatJSON = () => {
    try {
      const parsed = JSON.parse(tempValue);
      setTempValue(JSON.stringify(parsed, null, 2));
    } catch (e) {
      // 如果不是合法JSON，不做任何处理
    }
  };

  // 检测是否为JSON
  const isJSON = (text: string): boolean => {
    try {
      JSON.parse(text);
      return true;
    } catch (e) {
      return false;
    }
  };

  // 如果是查看模式且内容超长，使用 Tooltip 显示完整内容
  if (!editable && isLongText) {
    return (
      <div>
        {simpleMode ? (
          <Tooltip title={value} placement="topLeft" styles={{ body: { maxWidth: '400px' } }}>
            <div
              style={{
                width: '100%',
                minHeight: '32px',
                padding: '4px 11px',
                cursor: 'help',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                lineHeight: '24px',
                color: '#000000d9',
              }}
            >
              {value || placeholder || '请输入文本'}
            </div>
          </Tooltip>
        ) : (
          <div
            style={{
              width: '100%',
              minHeight: '32px',
              padding: '4px 11px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'pre-wrap',
              lineHeight: '24px',
              color: '#000000d9',
            }}
          >
            {value || placeholder || '请输入文本'}
          </div>
        )}
      </div>

    );
  }

  // 如果是查看模式且内容不超长，直接显示
  if (!editable) {
    return (
      <div
        style={{
          width: '100%',
          minHeight: '32px',
          padding: '4px 11px',
          overflow: 'hidden',
          lineHeight: '24px',
          color: '#000000d9',
          whiteSpace: simpleMode ? 'nowrap' : 'pre-wrap',
        }}
      >
        {value !== null && value !== undefined ? value : placeholder || '请输入文本'}
      </div>
    );
  }

  const areaAutoSize = autoSize || {
    minRows: 1,
    maxRows: isLongText ? 2 : 1
  };

  return (
    <>
      <div
        style={{ position: 'relative' }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <TextArea
          ref={(ref) => {
            if (onTextAreaRef) {
              // TextArea组件的ref是ResizableTextArea的实例，需要获取其textarea属性
              const textAreaElement = ref?.resizableTextArea?.textArea || null;
              onTextAreaRef(textAreaElement);
            }
          }}
          value={value}
          onChange={handleDirectChange}
          placeholder={placeholder || '请输入文本'}
          autoSize={areaAutoSize}
          style={{
            width: '100%',
            resize: 'none'
          }}
        />

        {/* 悬浮工具栏 - 只在内容超长时显示展开按钮 */}
        {isLongText && editable && (
          <div
            style={{
              position: 'absolute',
              right: '8px',
              top: '8px',
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              borderRadius: '4px',
              padding: '2px',
              display: isHovered ? 'block' : 'none',
              opacity: isHovered ? 1 : 0,
              pointerEvents: isHovered ? 'auto' : 'none',
              transition: 'opacity 0.2s',
              zIndex: 2,
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}
          >
            <Tooltip title="展开编辑">
              <Button
                type="text"
                size="small"
                icon={<ExpandOutlined />}
                onClick={openExpandModal}
              />
            </Tooltip>
          </div>
        )}
      </div>

      {/* 展开编辑模态框 */}
      <Modal
        title="展开编辑"
        open={isModalVisible}
        onOk={handleModalOk}
        onCancel={handleModalCancel}
        width={800}
        maskClosable={false}
        destroyOnClose
        footer={[
          <Button key="format" onClick={formatJSON} disabled={!isJSON(tempValue)}>
            格式化JSON
          </Button>,
          <Button key="cancel" onClick={handleModalCancel}>
            取消
          </Button>,
          <Button key="submit" type="primary" onClick={handleModalOk}>
            保存
          </Button>,
        ]}
      >
        <div style={{ marginBottom: '10px' }}>
          <Radio.Group
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value)}
            buttonStyle="solid"
            size="small"
          >
            <Radio.Button value="plain"><FileTextOutlined /> 普通文本</Radio.Button>
            <Radio.Button value="code"><CodeOutlined /> 代码模式</Radio.Button>
          </Radio.Group>
        </div>

        <TextArea
          value={tempValue}
          onChange={(e) => setTempValue(e.target.value)}
          placeholder={placeholder || '请输入文本'}
          autoSize={{ minRows: 15, maxRows: 25 }}
          style={{
            width: '100%',
            marginBottom: '15px',
            fontFamily: viewMode === 'code' ? 'monospace' : 'inherit',
            fontSize: viewMode === 'code' ? '14px' : 'inherit'
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Text type="secondary">
            字符数: {tempValue.length}
          </Text>
        </div>
      </Modal>
    </>
  );
};

export default LongTextEditor; 