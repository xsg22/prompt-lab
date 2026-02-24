import React, { useState, useEffect } from 'react';

import {
  Modal,
  Table,
  Checkbox,
  Typography,
  Alert,
  Button,
  App
} from 'antd';
import { DatasetsAPI } from '@/lib/api';
import type { DatasetItem } from '@/types/datasets';

const { Text } = Typography;

interface DatasetItemSelectionModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (selectedItemIds: number[]) => void;
  datasetId: number;
  initialSelectedIds?: number[];
  isCurrentDataset?: boolean; // 是否是当前正在使用的数据集
}

const DatasetItemSelectionModal: React.FC<DatasetItemSelectionModalProps> = ({
  open,
  onClose,
  onConfirm,
  datasetId,
  initialSelectedIds = [],
  isCurrentDataset = false
}) => {
  
  const [datasetItems, setDatasetItems] = useState<DatasetItem[]>([]);
  const [selectedItemIds, setSelectedItemIds] = useState<number[]>(initialSelectedIds);
  const [loading, setLoading] = useState(false);
  const { message } = App.useApp();

  // 加载数据集项
  useEffect(() => {
    if (open && datasetId) {
      loadDatasetItems();
    }
  }, [open, datasetId]);

  // 重置选中状态
  useEffect(() => {
    if (open) {
      // 只有当前数据集时才使用初始选择项，其他数据集重置为空
      setSelectedItemIds(isCurrentDataset ? initialSelectedIds : []);
    }
  }, [initialSelectedIds, open, isCurrentDataset]);

  const loadDatasetItems = async () => {
    setLoading(true);
    try {
      const response = await DatasetsAPI.getItems(datasetId, {
        enabled_only: true,
        page: 1,
        page_size: 50
      });
      setDatasetItems(response.data.data || []);
    } catch (error) {
      console.error('操作失败', error);
      message.error('加载数据集项失败');
      setDatasetItems([]);
    } finally {
      setLoading(false);
    }
  };

  // 处理数据项选择
  const handleItemSelection = (itemId: number, checked: boolean) => {
    if (checked) {
      if (selectedItemIds.length >= 5) {
        message.warning('最多只能选择5条数据项');
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
        message.info('已选择前5条数据项');
      }
    } else {
      setSelectedItemIds([]);
    }
  };

  const handleConfirm = () => {
    onConfirm(selectedItemIds);
    onClose();
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
      title={'选择数据项'}
      open={open}
      onCancel={onClose}
      width={800}
      footer={[
        <Button key="cancel" onClick={onClose}>
          {'取消'}
        </Button>,
        <Button 
          key="confirm" 
          type="primary" 
          onClick={handleConfirm}
          disabled={selectedItemIds.length === 0}
        >
          {`确认选择 (${selectedItemIds.length})`}
        </Button>
      ]}
    >
      <Alert
        type="info"
        message={'选择要包含在评估任务中的数据项（最多5条）。表格支持左右滑动查看所有变量列。'}
        style={{ marginBottom: 16 }}
        showIcon
      />

      <Table
        columns={columns}
        dataSource={datasetItems}
        rowKey="id"
        loading={loading}
        pagination={false}
        size="small"
        scroll={{ x: 'max-content', y: 400 }}
        locale={{
          emptyText: loading ? '加载中...' : '暂无数据项'
        }}
      />

      {selectedItemIds.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <Text type="success">{`已选择 ${selectedItemIds.length} 条数据项`}</Text>
        </div>
      )}
    </Modal>
  );
};

export default DatasetItemSelectionModal; 