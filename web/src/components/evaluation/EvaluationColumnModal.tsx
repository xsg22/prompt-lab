import { useState, useEffect } from 'react';

import {
  Card,
  Typography,
  Button,
  Input,
  Row,
  Col,
  Form,
  Modal,
  Avatar,
  Checkbox,
  Select} from 'antd';
import { 
  ArrowLeftOutlined} from '@ant-design/icons';
import { 
  useStepTypesByCategory,
  getStepConfigComponent,
  useStepTypeInfo
} from '@/components/evaluation-steps';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
  
// 添加评估列模态框组件
const EvaluationColumnModal = ({ 
    visible, 
    column,
    availableColumns, 
    datasetVariables = [],
    onClose, 
    onSave,
    onAddColumn,
    projectId
  }: { 
    visible: boolean, 
    column: any, 
    availableColumns: any[], 
    datasetVariables?: string[],
    onClose: () => void, 
    onAddColumn: (columnData: any) => void,
    onSave: (columnData: any) => void,
    projectId: number
  }) => {
    
    const [selectedType, setSelectedType] = useState<string | null>(null);
    const [useColumnRef, setUseColumnRef] = useState(false);
    const [useExpectedRef, setUseExpectedRef] = useState(false);
    const [supportsInputRef, setSupportsInputRef] = useState(false);
    const [supportsExpectedRef, setSupportsExpectedRef] = useState(false);
    const [form] = Form.useForm();
    
    // 使用hooks获取步骤类型信息
    const groupedStepTypes = useStepTypesByCategory();
    const stepTypeInfo = useStepTypeInfo(selectedType || '');

    useEffect(() => {
      if (!visible) {
        setSelectedType(null);
        form.resetFields();
      } else if (column) {
        setSelectedType(column.column_type);

        const formValues = {
            name: column.name,
            ...(typeof column.config ==='object'?column.config:JSON.parse(column.config))
        };
        form.setFieldsValue(formValues);
      }
    }, [visible, form, column]);
    
    const handleTypeSelect = (type: string) => {
      setSelectedType(type);
    };
    
    // 当selectedType变化时更新支持的引用类型
    useEffect(() => {
      if (stepTypeInfo) {
        setSupportsInputRef(stepTypeInfo.supportsInputRef || false);
        setSupportsExpectedRef(stepTypeInfo.supportsExpectedRef || false);
      }
    }, [stepTypeInfo]);
    
    // 检查名称是否重复
    const checkNameDuplicate = (name: string): string | null => {
      if (!name) return null;
      
      // 检查是否与数据集变量重名
      if (datasetVariables.includes(name)) {
        return `列名 "${name}" 与数据集变量重名，请使用其他名称`;
      }
      
      // 检查是否与已有列重名（编辑时排除自己）
      const duplicateColumn = availableColumns.find(col => 
        col.name === name && (!column || col.id !== column.id)
      );
      
      if (duplicateColumn) {
        return `列名 "${name}" 已存在，请使用其他名称`;
      }
      
      return null;
    };
    
    const handleAddColumn = () => {
      if (!selectedType) return;
      
      form.validateFields().then(values => {
        // 检查名称重复
        const duplicateError = checkNameDuplicate(values.name);
        if (duplicateError) {
          form.setFields([{
            name: 'name',
            errors: [duplicateError]
          }]);
          return;
        }
        
        const config = { ...values };
        
        onAddColumn({
            type: selectedType,
            name: values.name,
            config,
            position: availableColumns.length
          });

        handleClose();
      }).catch(err => {
        console.error('表单验证失败', err);
      });
    };

    const handleSave = () => {
        form.validateFields().then(values => {
          // 检查名称重复
          const duplicateError = checkNameDuplicate(values.name);
          if (duplicateError) {
            form.setFields([{
              name: 'name',
              errors: [duplicateError]
            }]);
            return;
          }
          
          const config = { ...values };
          
          onSave({
            ...column,
            column_type: selectedType,
            name: values.name,
            config
          });

          handleClose();
        }).catch(err => {
          console.error('表单验证失败', err);
        });
      };

    const handleClose = () => {
      form.resetFields();
      setSelectedType(null);
      setUseColumnRef(false);
      setUseExpectedRef(false);
      onClose();
    };
    
    // 按分类对步骤类型进行分组 (使用hook获取)
    
    const StepConfigComponent = selectedType ? getStepConfigComponent(selectedType) : null;
    
    return (
      <Modal
        title={'添加评估列'}
        width={700}
        open={visible}
        onCancel={handleClose}
        footer={!selectedType ? [
          <Button key="cancel" onClick={handleClose}>{'取消'}</Button>
        ] : [
          <Button key="back" onClick={() => setSelectedType(null)}>
            <ArrowLeftOutlined /> {'返回列表'}
          </Button>,
          <Button key="cancel" onClick={handleClose}>
            {'取消'}
          </Button>,
          <Button 
            key="submit" 
            type="primary" 
            onClick={column ? handleSave : handleAddColumn}
          >
            {column ? '保存' : '添加'}
          </Button>
        ]}
      >
        {!selectedType ? (
          <div>
            <Paragraph>{'选择要添加的评估列类型：'}</Paragraph>
            {Object.entries(groupedStepTypes).map(([category, types]) => (
              <div key={category} style={{ marginBottom: 24 }}>
                <Title level={5}>{category}</Title>
                <Row gutter={[16, 16]}>
                  {types.map(type => (
                    <Col span={8} key={type.key}>
                      <Card
                        hoverable
                        style={{ height: '100%' }}
                        onClick={() => handleTypeSelect(type.key)}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                          <Avatar icon={type.icon} style={{ marginRight: 8 }} />
                          <Text strong>{type.name}</Text>
                        </div>
                        <Text type="secondary">{type.description}</Text>
                      </Card>
                    </Col>
                  ))}
                </Row>
              </div>
            ))}
          </div>
        ) : (
          <div>
            <Form form={form} layout="vertical">
              <Form.Item
                label={'列名称'}
                name="name"
                rules={[
                  { required: true, message: '请输入列名称' },
                  {
                    validator: async (_, value) => {
                      if (!value) return;
                      const duplicateError = checkNameDuplicate(value);
                      if (duplicateError) {
                        throw new Error(duplicateError);
                      }
                    }
                  }
                ]}
              >
                <Input placeholder={'请输入列名称'} />
              </Form.Item>
              
              <Card title={'配置'} style={{ marginBottom: 16 }}>
                {StepConfigComponent && <StepConfigComponent form={form} availableColumns={availableColumns} projectId={projectId} />}
              </Card>
              
              {/* 变量引用区域 */}
              {(supportsInputRef || supportsExpectedRef) && (
                <Card title={'变量引用'} style={{ marginBottom: 16 }}>
                  {supportsInputRef && (
                    <div style={{ marginBottom: 16 }}>
                      <Checkbox 
                        checked={useColumnRef} 
                        onChange={(e) => setUseColumnRef(e.target.checked)}
                      >
                        {'使用前面列的值作为输入'}
                      </Checkbox>
                      
                      {useColumnRef && (
                        <Form.Item 
                          name="reference_column" 
                          style={{ marginTop: 8 }}
                          rules={[{ required: useColumnRef, message: '请选择引用的列' }]}
                        >
                          <Select placeholder={'选择要引用的列'}>
                            {availableColumns.map(col => (
                              <Option key={col.id} value={col.name}>{col.name}</Option>
                            ))}
                          </Select>
                        </Form.Item>
                      )}
                    </div>
                  )}
                  
                  {supportsExpectedRef && (
                    <div>
                      <Checkbox 
                        checked={useExpectedRef} 
                        onChange={(e) => setUseExpectedRef(e.target.checked)}
                      >
                        {'使用前面列的值作为期望值'}
                      </Checkbox>
                      
                      {useExpectedRef && (
                        <Form.Item 
                          name="expected_column" 
                          style={{ marginTop: 8 }}
                          rules={[{ required: useExpectedRef, message: '请选择引用的列' }]}
                        >
                          <Select placeholder={'选择要引用的列'}>
                            {availableColumns.map(col => (
                              <Option key={col.id} value={col.name}>{col.name}</Option>
                            ))}
                          </Select>
                        </Form.Item>
                      )}
                    </div>
                  )}
                </Card>
              )}
            </Form>
          </div>
        )}
      </Modal>
    );
  };

  export default EvaluationColumnModal;