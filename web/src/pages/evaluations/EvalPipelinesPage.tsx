import { useState, useEffect } from 'react';
import {
  Card,
  Typography,
  Button,
  Table,
  Space,
  message,
  Popconfirm,
  Row,
  Col,
  Tooltip
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  HistoryOutlined,
  EditOutlined
} from '@ant-design/icons';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { EvalPipelinesAPI } from '@/lib/api';
import CreateEvaluationPipeline from '@/components/CreateEvaluationPipeline';
import { useProjectJump } from '@/hooks/useProjectJump';

const { Title } = Typography;

export default function EvalPipelinesPage() {
  const [pipelines, setPipelines] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const projectId = Number(useParams().projectId);
  const navigate = useNavigate();
  const { projectJumpTo } = useProjectJump();

  useEffect(() => {
    if (projectId) {
      loadPipelines();
    }
  }, [projectId]);

  // 加载所有评估任务
  const loadPipelines = async () => {
    setLoading(true);
    try {
      const response = await EvalPipelinesAPI.getAll(projectId);
      setPipelines(response.data);
    } catch (error) {
      console.error('加载评估任务失败:', error);
      message.error('加载评估任务失败');
    } finally {
      setLoading(false);
    }
  };

  // 打开创建模态框
  const openCreateModal = () => {
    setShowCreateModal(true);
  };

  // 关闭创建模态框
  const closeCreateModal = () => {
    setShowCreateModal(false);
  };

  // 删除评估任务
  const deletePipeline = async (id: number) => {
    try {
      await EvalPipelinesAPI.deletePipeline(id);
      message.success('删除评估任务成功');
      loadPipelines();
    } catch (error) {
      console.error('删除评估任务失败:', error);
      message.error('删除评估任务失败');
    }
  };

  // 查看评估任务
  const viewPipeline = (id: number) => {
    navigate(projectJumpTo(`eval-pipelines/${id}`));
  };

  // 查看评估历史
  const viewHistory = (id: number) => {
    navigate(projectJumpTo(`eval-pipelines/${id}/history`));
  };

  // 表格列定义
  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: any) => (
        <a onClick={() => viewPipeline(record.id)}>{text}</a>
      )
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true
    },
    {
      title: '数据集',
      dataIndex: 'dataset_name',
      key: 'dataset_name',
      ellipsis: true,
      render: (text: string, record: any) => (
        <Link to={projectJumpTo(`datasets/${record.dataset_id}`)}>{text}</Link>
      )
    },
    {
      title: '创建者',
      dataIndex: 'creator_name',
      key: 'creator_name'
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (text: string) => new Date(text).toLocaleString()
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      key: 'updated_at',
      render: (text: string) => new Date(text).toLocaleString()
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: any) => (
        <Space size="middle">
          <Tooltip title="编辑">
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => viewPipeline(record.id)}
            title="编辑"
          >
          </Button>
          </Tooltip>
          
          <Tooltip title="查看执行历史">
            <Button
              type="text"
              icon={<HistoryOutlined />}
              onClick={() => viewHistory(record.id)}
              title="查看执行历史"
            >
            </Button>
          </Tooltip>

          <Tooltip title="删除">
            <Popconfirm
              title="确定要删除这个评估任务吗?"
              onConfirm={() => deletePipeline(record.id)}
              okText="删除"
              cancelText="取消"
            >
              <Button type="text" danger icon={<DeleteOutlined />}>
              </Button>
            </Popconfirm>
          </Tooltip>
        </Space>
      )
    }
  ];

  return (
    <div style={{ padding: 24 }}>

      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={3}>评估任务</Title>
        </Col>
        <Col>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={openCreateModal}
          >
            创建评估
          </Button>
        </Col>
      </Row>

      <Card>
        <Table
          columns={columns}
          dataSource={pipelines}
          rowKey="id"
          loading={loading}
          sticky
          scroll={{ y: 'calc(100vh - 200px)' }}
          pagination={{
            defaultPageSize: 10,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50'],
            showTotal: (total) => `共 ${total} 条数据`
          }}
        />
      </Card>

      {/* 创建流水线模态框 */}
      <CreateEvaluationPipeline
        projectId={projectId}
        open={showCreateModal}
        onClose={closeCreateModal}
        onCreated={(pipeline: any) => {
          closeCreateModal();
          navigate(projectJumpTo(`eval-pipelines/${pipeline.id}`));
        }}
      />
    </div>
  );
} 