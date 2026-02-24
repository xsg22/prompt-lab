import React, { useState, useEffect } from 'react';

import {
  Button,
  Form,
  Input,
  Select,
  Modal,
  App,
  message,
  Table,
  Checkbox,
  Typography,
  Alert,
  Divider
} from 'antd';
import { DatasetsAPI, EvalPipelinesAPI } from '@/lib/api';
import type { DatasetItem } from '@/types/datasets';
const { Option } = Select;
const { Text } = Typography;

// 评估任务设计组件
interface EvaluationPipelineDesignerProps {
  open: boolean;
  onCreated: (pipeline: any) => void;
  onClose: () => void;
  projectId?: number;
}

const CreateEvaluationPipeline: React.FC<EvaluationPipelineDesignerProps> = ({
  open,
  onCreated,
  onClose,
  projectId }) => {
  
  // 状态定义
  const [name, setName] = useState('');
  const [description, ] = useState('');
  const [selectedDatasetId, setSelectedDatasetId] = useState<number>(0);
  const [datasets, setDatasets] = useState<any[]>([]);
  const [datasetItems, setDatasetItems] = useState<DatasetItem[]>([]);
  const [selectedItemIds, setSelectedItemIds] = useState<number[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [datasetSearchValue, setDatasetSearchValue] = useState('');
  const { message: messageApi } = App.useApp();

  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  // 加载数据集
  useEffect(() => {
    if (projectId) {
      loadDatasets(projectId);
    }
  }, [projectId]);

  // 当数据集选择改变时，加载数据项
  useEffect(() => {
    if (selectedDatasetId) {
      loadDatasetItems(selectedDatasetId);
    } else {
      setDatasetItems([]);
      setSelectedItemIds([]);
    }
  }, [selectedDatasetId]);

  // 加载数据集
  const loadDatasets = async (projectId: number) => {
    try {
      const response = await DatasetsAPI.getAllDatasets(projectId);
      setDatasets(response.data);
    } catch (error: any) {
      console.error('操作失败', error);
      messageApi.error(error?.response?.data?.detail?.message || '加载数据集失败');
    }
  };

  // 加载数据集项
  const loadDatasetItems = async (datasetId: number) => {
    setLoadingItems(true);
    try {
      const response = await DatasetsAPI.getItems(datasetId, {
        enabled_only: true,
        page: 1,
        page_size: 20
      });
      setDatasetItems(response.data.data || []);
    } catch (error: any) {
      console.error('操作失败', error);
      messageApi.error(error?.response?.data?.detail?.message || '加载数据集项失败');
      setDatasetItems([]);
    } finally {
      setLoadingItems(false);
    }
  };

  // 处理数据集选择
  const handleDatasetChange = (datasetId: number) => {
    setSelectedDatasetId(datasetId);
    form.setFieldValue('dataset_id', datasetId);
  };

  // 处理数据项选择
  const handleItemSelection = (itemId: number, checked: boolean) => {
    if (checked) {
      if (selectedItemIds.length >= 5) {
        messageApi.warning('最多只能选择5条数据项');
        return;
      }
      setSelectedItemIds([...selectedItemIds, itemId]);
    } else {
      setSelectedItemIds(selectedItemIds.filter(id => id !== itemId));
    }
  };

  // 全选/取消全选
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const maxSelection = Math.min(datasetItems.length, 5);
      const newSelection = datasetItems.slice(0, maxSelection).map(item => Number(item.id));
      setSelectedItemIds(newSelection);
      if (datasetItems.length > 5) {
        messageApi.info('已选择前5条数据项');
      }
    } else {
      setSelectedItemIds([]);
    }
  };

  const handleSubmit = async () => {
    try {
      await form.validateFields()
      
      setLoading(true);

      const payload = {
        project_id: projectId,
        name,
        description,
        dataset_id: selectedDatasetId,
        selected_item_ids: selectedItemIds.length > 0 ? selectedItemIds : undefined,
        columns: []
      };
      
      const response = await EvalPipelinesAPI.createPipeline(payload);
      message.success('创建评估任务成功');

      // 重置表单
      form.resetFields()
      setSelectedDatasetId(0);
      setDatasetItems([]);
      setSelectedItemIds([]);

      onCreated(response.data);
      
    } catch (error: any) {
      console.error('操作失败', error);
      messageApi.error(error?.response?.data?.detail?.message || '创建评估任务失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取所有变量列
  const getVariableColumns = () => {
    if (datasetItems.length === 0) return [];
    
    const allVariables = new Set<string>();
    datasetItems.forEach(item => {
      if (item.variables_values) {
        Object.keys(item.variables_values).forEach(key => allVariables.add(key));
      }
    });
    
    return Array.from(allVariables).map(varName => ({
      title: varName,
      dataIndex: 'variables_values',
      width: 150,
      ellipsis: true,
      render: (variables: Record<string, any>) => {
        const value = variables?.[varName];
        if (value === undefined || value === null) {
          return <Text type="secondary">-</Text>;
        }
        return <Text>{String(value).slice(0, 50)}</Text>;
      }
    }));
  };

  // 数据项表格列定义
  const columns = [
    {
      title: () => (
        <Checkbox
          checked={selectedItemIds.length === Math.min(datasetItems.length, 5) && datasetItems.length > 0}
          indeterminate={selectedItemIds.length > 0 && selectedItemIds.length < Math.min(datasetItems.length, 5)}
          onChange={(e) => handleSelectAll(e.target.checked)}
        >
          {'选择'}
        </Checkbox>
      ),
      dataIndex: 'selection',
      width: 80,
      fixed: 'left' as const,
      render: (_: any, record: DatasetItem) => (
        <Checkbox
          checked={selectedItemIds.includes(Number(record.id))}
          onChange={(e) => handleItemSelection(Number(record.id), e.target.checked)}
        />
      )
    },
    {
      title: '名称',
      dataIndex: 'name',
      width: 120,
      fixed: 'left' as const,
      ellipsis: true,
      render: (text: string) => text || '未命名'
    },
    ...getVariableColumns()
  ];

  return (
    <Modal
      title={'创建评估任务'}
      open={open}
      onCancel={onClose}
      width={800}
      footer={[
        <Button key="cancel" onClick={onClose}>
          {'取消'}
        </Button>,
        <Button 
          key="submit" 
          type="primary" 
          loading={loading}
          onClick={handleSubmit}
        >
          {'创建'}
        </Button>
      ]}
    >
      <Form
        form={form}
        layout="vertical"
        preserve={false}
      >
        <Form.Item name="name" label={'名称'} rules={[{ required: true, message: '请输入名称' }]}>
          <Input placeholder={'输入名称'} onChange={(e) => setName(e.target.value)} />
        </Form.Item>
        {/* <Form.Item name="description" label="描述" rules={[{ message: '请输入描述' }]}>
          <Input.TextArea rows={4} placeholder="输入描述" onChange={(e) => setDescription(e.target.value)} />
        </Form.Item> */}
        <Form.Item name="dataset_id" label={'数据集'} rules={[{ required: true, message: '请选择数据集' }]}>
          <Select 
            placeholder={'请选择数据集'} 
            onChange={handleDatasetChange}
            showSearch
            searchValue={datasetSearchValue}
            onSearch={setDatasetSearchValue}
            filterOption={(input, option) =>
              (option?.children as unknown as string)?.toLowerCase().includes(input.toLowerCase())
            }
            onSelect={() => setDatasetSearchValue('')}
          >
            {datasets.map(dataset => (
              <Option key={dataset.id} value={dataset.id}>
                {dataset.name}
              </Option>
            ))}
          </Select>
        </Form.Item>

        {selectedDatasetId > 0 && (
          <>
            <Divider />
            <div style={{ marginBottom: 16 }}>
              <Text strong>{'数据项选择'}</Text>
              <Alert
                type="info"
                message={'选择要包含在评估任务中的数据项（最多5条）。表格支持左右滑动查看所有变量列。如果不选择，系统将自动使用前5条启用的数据项。'}
                style={{ marginTop: 8, marginBottom: 16 }}
                showIcon
              />
            </div>

            <Table
              columns={columns}
              dataSource={datasetItems}
              rowKey="id"
              loading={loadingItems}
              pagination={false}
              size="small"
              scroll={{ x: 'max-content', y: 200 }}
              locale={{
                emptyText: loadingItems ? '加载中...' : '暂无数据项'
              }}
            />

            {selectedItemIds.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <Text type="success">{`已选择 ${selectedItemIds.length} 条数据项`}</Text>
              </div>
            )}
          </>
        )}
      </Form>
    </Modal>
  );
};

export default CreateEvaluationPipeline; 