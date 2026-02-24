import React, { useState } from 'react';
import { Form, Select, Input, InputNumber, Slider, Button, Card } from 'antd';

import type { StepProps, CellResultProps } from './types';
import LongTextEditor from '../ui/LongTextEditor';

const { Option } = Select;

// 人工输入配置组件
export const HumanInputStepConfig: React.FC<StepProps> = () => {
  
  
  return (
    <>
      <Form.Item label={'输入类型'} name="input_type" initialValue="text">
        <Select>
          <Option value="text">{'文本'}</Option>
          <Option value="number">{'数字'}</Option>
          <Option value="select">{'选择项'}</Option>
          <Option value="slider">{'滑块'}</Option>
        </Select>
      </Form.Item>
      
      <Form.Item noStyle shouldUpdate={(prev, curr) => prev.input_type !== curr.input_type}>
        {({ getFieldValue }) => {
          const inputType = getFieldValue('input_type');
          
          if (inputType === 'select') {
            return (
              <Form.Item label={'选项 (一行一个)'} name="options">
                <Input.TextArea 
                  rows={4} 
                  placeholder={'输入选项，每行一个'} 
                />
              </Form.Item>
            );
          }
          
          if (inputType === 'number' || inputType === 'slider') {
            return (
              <>
                <Form.Item label={'最小值'} name="min_value" initialValue={0}>
                  <InputNumber />
                </Form.Item>
                <Form.Item label={'最大值'} name="max_value" initialValue={100}>
                  <InputNumber />
                </Form.Item>
                <Form.Item label={'步长'} name="step" initialValue={1}>
                  <InputNumber />
                </Form.Item>
              </>
            );
          }
          
          return null;
        }}
      </Form.Item>
      
      <Form.Item label={'默认值'} name="default_value">
        <Input placeholder={'默认值'} />
      </Form.Item>
    </>
  );
};

// 人工输入结果组件
export const HumanInputResult: React.FC<CellResultProps> = ({ 
  cell,
  column, 
  onSaveHumanInput 
}) => {
  
  const isEditable = onSaveHumanInput !== undefined;
  const [inputValue, setInputValue] = useState<any>(
    cell.value !== undefined && cell.value !== null ? 
      (typeof cell.value === 'object' ? cell.value.value : JSON.parse(cell.value).value) : ''
  );
    
  const handleSave = () => {
    if (onSaveHumanInput) {
      onSaveHumanInput(inputValue);
    }
  };
  
  const renderInputField = () => {
    const inputType = column?.config?.input_type || 'text';
    
    switch (inputType) {
      case 'text':
        return (
          <LongTextEditor
            value={inputValue}
            onChange={(value) => setInputValue(value)}
            placeholder={'请输入文本'}
          />
        );
      case 'number':
        return (
          <InputNumber 
            value={inputValue} 
            onChange={(value) => setInputValue(value)}
            min={column?.config?.min_value || 0}
            max={column?.config?.max_value || 100}
            step={column?.config?.step || 1}
            style={{ width: '100%' }}
          />
        );
      case 'select':
        const options = column?.config?.options?.split('\n') || [];
        return (
          <Select
            value={inputValue}
            onChange={(value) => setInputValue(value)}
            style={{ width: '100%' }}
          >
            {options.map((option: string, index: number) => (
              <Option key={index} value={option.trim()}>{option.trim()}</Option>
            ))}
          </Select>
        );
      case 'slider':
        return (
          <Slider
            value={inputValue}
            onChange={(value) => setInputValue(value)}
            min={column?.config?.min_value || 0}
            max={column?.config?.max_value || 100}
            step={column?.config?.step || 1}
          />
        );
      default:
        return <Input value={inputValue} onChange={(e) => setInputValue(e.target.value)} />;
    }
  };
  
  return (
    <div>
      {isEditable ? (
        <Card size="small" title={column.name}>
          <div style={{ marginBottom: 16 }}>
            {renderInputField()}
          </div>
          <Button type="primary" onClick={handleSave}>{'保存'}</Button>
        </Card>
      ) : (
        <div>
          {inputValue}
        </div>
      )}
    </div>
  );
};

export default HumanInputStepConfig; 