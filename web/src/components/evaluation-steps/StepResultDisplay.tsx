import React from 'react';
import { Spin, Typography, Tag } from 'antd';

import type { CellResultProps } from './types';
import { HumanInputResult } from './HumanInputStep';
import LongTextEditor from '../ui/LongTextEditor';

const { Text } = Typography;

// 通用结果展示组件
export const StepResultDisplay: React.FC<CellResultProps> = ({
  cell,
  status,
  stepType,
  column,
  onSaveHumanInput
}) => {
  
  
  if (status === 'running') {
    return (
      <div style={{ textAlign: 'center', padding: '10px 0' }}>
        <Spin size="small" tip={'执行中...'} />
      </div>
    );
  }

  // 特殊处理人工输入类型
  if (stepType === 'human_input') {
    return <HumanInputResult cell={cell} stepType={stepType} column={column} onSaveHumanInput={onSaveHumanInput} />;
  }

  if (!cell.value) {
    return <Text type="secondary">{'暂无结果'}</Text>;
  }

  // 评估类型步骤结果展示
  if (stepType === 'exact_multi_match' || stepType === 'exact_match' || stepType === 'contains' || stepType === 'regex' || stepType === 'type_validation') {
    return (
      <div>
        <Tag color={cell.value.value ? 'success' : 'error'}>
          {cell.value.value ? 'true' : 'false'}
        </Tag>
        {cell.error_message && (
          <div style={{ marginTop: 8 }}>
            <Text type="secondary" style={{ fontSize: '12px', marginRight: 8 }}>{'结果'}:</Text>
            <LongTextEditor
              value={cell.error_message}
              onChange={() => { }} // 结果展示是只读的
              maxPreviewLength={200}
            />
          </div>
        )}
      </div>
    );
  }

  // 数值类型结果
  if (stepType === 'numeric_distance' || stepType === 'cosine_similarity') {
    const numericValue = typeof cell.value === 'number'
      ? cell.value
      : parseFloat(String(cell.value));

    if (!isNaN(numericValue)) {
      return (
        <div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: 4 }}>
            {numericValue.toFixed(4)}
          </div>
          {cell.error_message && (
            <LongTextEditor
              value={cell.error_message}
              onChange={() => { }} // 结果展示是只读的
              maxPreviewLength={150}
            />
          )}
        </div>
      );
    }
  }

  // JSON提取结果
  if (stepType === 'json_extraction') {
    const value = cell.value !== undefined
      ? (typeof cell.value === 'object'
        ? cell.value.value
        : String(cell.value))
      : JSON.stringify(cell.value, null, 2)
    console.log('json_extraction', value)
    return (
      <LongTextEditor
        value={value}
        onChange={() => { }} // 结果展示是只读的
        maxPreviewLength={200}
        editable={false}
      />
    );
  }

  // 默认展示方式 - 使用LongTextEditor
  const displayValue = cell.display_value?.value || cell.value;

  return (
    <div style={{ marginTop: 8 }}>
      <LongTextEditor
        value={
          displayValue !== undefined
            ? (typeof displayValue === 'object'
              ? JSON.stringify(displayValue, null, 2)
              : String(displayValue))
            : JSON.stringify(displayValue, null, 2)
        }
        onChange={() => { }} // 结果展示是只读的
        maxPreviewLength={100}
        editable={false}
        simpleMode={stepType !== 'prompt_template'}
      />
    </div>
  );
};

export default StepResultDisplay; 