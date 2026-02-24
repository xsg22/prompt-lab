import React from 'react';
import { Segmented, Tooltip } from 'antd';
import { MessageOutlined, RobotOutlined } from '@ant-design/icons';
import type { AssistantMode } from '@/types/promptAssistant';


interface ModeToggleProps {
  mode: AssistantMode;
  onChange: (mode: AssistantMode) => void;
  disabled?: boolean;
}

const ModeToggle: React.FC<ModeToggleProps> = ({ mode, onChange, disabled = false }) => {
  
  const options = [
    {
      label: (
        <Tooltip title={'咨询模式：与助理讨论提示词设计思路和最佳实践'}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <MessageOutlined />
            <span>Chat</span>
          </div>
        </Tooltip>
      ),
      value: 'chat' as const
    },
    {
      label: (
        <Tooltip title={'代理模式：让助理直接修改提示词内容'}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <RobotOutlined />
            <span>Agent</span>
          </div>
        </Tooltip>
      ),
      value: 'agent' as const
    }
  ];

  return (
    <Segmented
      value={mode}
      onChange={onChange}
      options={options}
      disabled={disabled}
      size="small"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.04)' }}
    />
  );
};

export default ModeToggle; 