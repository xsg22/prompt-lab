"use client"

import { useState, useEffect } from 'react'
import { 
  Card, 
  Typography, 
  Button, 
  Table, 
  Space, 
  Divider,
  message,
  Tooltip,
  Popconfirm,
  Tag,
  Empty,
  Skeleton,
} from 'antd'
import { Link, useParams } from 'react-router-dom'
import { 
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined, 
  ExclamationCircleOutlined,
  ReloadOutlined,
  BarChartOutlined
} from '@ant-design/icons'
import { EditDatasetModal } from '@/components/EditDatasetModal'
import { DataAnalysisModal } from '@/components/DataAnalysisModal'
import { DatasetsAPI } from '../../lib/api'
import type { ColumnType } from 'antd/es/table/interface'
import { useProjectJump } from '@/hooks/useProjectJump'

const { Title, Text } = Typography

interface Dataset {
  id: number;
  name: string;
  description: string | null;
  prompt_id: number;
  prompt_name: string;
  prompt_version_id: number;
  version_number: number;
  variables: string[];
  created_at: string;
  updated_at: string;
}

export default function DatasetsPage() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [analysisModalOpen, setAnalysisModalOpen] = useState(false);
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null);
  const { projectJumpTo } = useProjectJump()
  const projectId = useParams().projectId
  // 加载数据集列表
  const fetchDatasets = async () => {
    if (!projectId) {
      return;
    }
    try {
      setLoading(true);
      const response = await DatasetsAPI.getAllDatasets(Number(projectId));
      
      setDatasets(response.data);
    } catch (error: any) {
      console.error('加载数据集列表失败:', error);
      message.error(error?.response?.data?.detail?.message || '加载数据集列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDatasets();
  }, []);

  // 表格列定义
  const columns: ColumnType<any>[] = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: any) => (
        <Link to={projectJumpTo(`datasets/${record.id}`)}>{text}</Link>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (text: string) => text || <Text type="secondary">无描述</Text>,
    },
    {
      title: '变量',
      key: 'variables',
      dataIndex: 'variables',
      render: (variables: string[]) => (
        <Space wrap>
          {variables && variables.length > 0 ? (
            variables.slice(0, 3).map(variable => (
              <Tag key={variable} color="blue">
                {variable}
              </Tag>
            ))
          ) : (
            <Text type="secondary"></Text>
          )}
          {variables && variables.length > 3 && (
            <Tag color="default">+{variables.length - 3}</Tag>
          )}
        </Space>
      ),
    },
    {
      title: '创建人',
      dataIndex: 'creator_name',
      key: 'creator_name',
      filters: [...new Set(datasets.map((item: any) => item.creator_name))].map((creator_name: string) => ({
        text: creator_name,
        value: creator_name
      })),
      // onFilter: (value: string, record: any) => record.nickname === value
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      key: 'updated_at',
      render: (text: string) => new Date(text).toLocaleString(),
      sorter: (a: Dataset, b: Dataset) => 
        new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime(),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Dataset) => (
        <Space size="middle">
          <Tooltip title="查看详情">
            <Link to={projectJumpTo(`/datasets/${record.id}`)}>
              <Button 
                type="text" 
                icon={<EditOutlined />} 
              />
            </Link>
          </Tooltip>
          <Tooltip title="数据分析">
            <Button 
              type="text" 
              icon={<BarChartOutlined />}
              onClick={() => handleAnalysis(record)}
            />
          </Tooltip>
          <Tooltip title="删除">
            <Popconfirm
              title="确定要删除这个数据集吗?"
              description="删除后将无法恢复，包括所有的数据集条目。"
              onConfirm={() => handleDelete(record.id)}
              okText="确定"
              cancelText="取消"
              icon={<ExclamationCircleOutlined style={{ color: 'red' }} />}
            >
              <Button type="text" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </Tooltip>
        </Space>
      ),
    },
  ];

  // 处理创建数据集
  const handleCreate = () => {
    setCreateModalOpen(true);
  };

  // 处理数据分析
  const handleAnalysis = (dataset: Dataset) => {
    setSelectedDataset(dataset);
    setAnalysisModalOpen(true);
  };

  // 处理删除数据集
  const handleDelete = async (id: number) => {
    try {
      await DatasetsAPI.deleteDataset(id);
      message.success('数据集已删除');
      setDatasets(datasets.filter(dataset => dataset.id !== id));
    } catch (error) {
      console.error('删除数据集失败:', error);
      message.error('删除数据集失败');
    }
  };

  // 数据集创建/编辑成功后的处理
  const handleDatasetSaved = () => {
    fetchDatasets();
  };

  return (
      <div style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Title level={3} style={{ margin: 0 }}>数据集管理</Title>
          <Space>
            <Button 
              type="primary" 
              icon={<PlusOutlined />} 
              onClick={handleCreate}
            >
              创建数据集
            </Button>
            <Button 
              icon={<ReloadOutlined />} 
              onClick={fetchDatasets}
            >
              刷新
            </Button>
          </Space>
        </div>
        
        <Divider style={{ marginTop: 0 }} />
        
        {loading ? (
          <Card>
            <Skeleton active paragraph={{ rows: 10 }} />
          </Card>
        ) : (
          <Card>
            <Table 
              columns={columns} 
              dataSource={datasets} 
              rowKey="id"
              sticky
              scroll={{ y: 'calc(100vh - 200px)' }}
              pagination={{ 
                defaultPageSize: 10,
                showSizeChanger: true,
                pageSizeOptions: ['10', '20', '50', '100'],
                showTotal: (total) => `共 ${total} 条数据`
              }}
              locale={{
                emptyText: (
                  <Empty 
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="暂无数据集"
                  >
                    <Button 
                      type="primary" 
                      onClick={handleCreate}
                    >
                      创建数据集
                    </Button>
                  </Empty>
                )
              }}
            />
          </Card>
        )}
        
        {/* 创建数据集模态框 */}
        {createModalOpen && (
          <EditDatasetModal
            open={createModalOpen}
            onClose={() => setCreateModalOpen(false)}
            onSaved={handleDatasetSaved}
          />
        )}
        
        {/* 数据分析模态框 */}
        {analysisModalOpen && selectedDataset && (
          <DataAnalysisModal
            visible={analysisModalOpen}
            onCancel={() => {
              setAnalysisModalOpen(false);
              setSelectedDataset(null);
            }}
            dataset={selectedDataset}
          />
        )}
      </div>
  );
} 