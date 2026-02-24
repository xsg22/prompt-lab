import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Layout,
  Card,
  Typography,
  Button,
  Table,
  Space,
  Tag,
  message,
  Statistic,
  Row,
  Col,
  Empty,
  Tooltip,
  Progress
} from 'antd';
import {
  ArrowLeftOutlined,
  EyeOutlined,
  ReloadOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined
} from '@ant-design/icons';
import { EvalPipelinesAPI } from '@/lib/api';
import { useProjectJump } from '@/hooks/useProjectJump';
import { type EvalResult } from '@/types/evaluation';

const { Header, Content } = Layout;
const { Title, Text } = Typography;



const EvalHistoryPage = () => {
  const { pipelineId } = useParams();
  const navigate = useNavigate();
  const { projectJumpTo } = useProjectJump();
  const [messageApi, contextHolder] = message.useMessage();

  const [loading, setLoading] = useState(false);
  const [historyResults, setHistoryResults] = useState<EvalResult[]>([]);
  const [pipelineName, setPipelineName] = useState('');

  useEffect(() => {
    if (pipelineId) {
      loadEvalHistory();
      loadPipelineInfo();
    }
  }, [pipelineId]);

  // 加载评估历史记录
  const loadEvalHistory = async () => {
    setLoading(true);
    try {
      const response = await EvalPipelinesAPI.getEvalHistory(Number(pipelineId));
      setHistoryResults(response.data);
    } catch (error: any) {
      console.error('加载评估历史失败', error);
      const errorMessage = error.response?.data?.detail || '加载评估历史失败';
      messageApi.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // 加载流水线信息
  const loadPipelineInfo = async () => {
    try {
      const response = await EvalPipelinesAPI.getPipeline(Number(pipelineId));
      setPipelineName(response.data.name);
    } catch (error: any) {
      console.error('加载流水线信息失败', error);
    }
  };

  // 查看评估结果详情
  const viewResultDetail = (resultId: number) => {
    navigate(projectJumpTo(`eval-pipelines/${pipelineId}/results/${resultId}`));
  };

  // 返回流水线详情
  const goBack = () => {
    navigate(projectJumpTo(`eval-pipelines/${pipelineId}`));
  };

  // 格式化运行类型显示
  const formatRunType = (runType: string) => {
    if (runType === 'staging') {
      return '草稿';
    }
    if (runType.startsWith('batch_')) {
      const dateStr = runType.replace('batch_', '').replace(/_/g, ' ');
      return `批量评估 ${dateStr}`;
    }
    return runType;
  };

  // 计算进度
  const calculateProgress = (result: EvalResult) => {
    const total = result.total_count || 0;
    const completed = (result.passed_count || 0) + (result.unpassed_count || 0) + (result.failed_count || 0);
    return total > 0 ? Math.round((completed / total) * 100) : 0;
  };

  // 获取状态显示
  const getStatusDisplay = (result: EvalResult) => {
    if (result.status === 'new') {
      return <Tag color="default">初始化中</Tag>;
    }

    if (result.status === 'running') {
      return <Tag icon={<LoadingOutlined />} color="processing">运行中</Tag>;
    }

    if (result.status === 'completed') {
      return <Tag icon={<CheckCircleOutlined />} color="success">已完成</Tag>;
    }

    return <Tag color="warning">部分成功</Tag>;
  };

  // 表格列定义
  const columns = [
    {
      title: '运行类型',
      dataIndex: 'run_type',
      key: 'run_type',
      render: (runType: string) => (
        <div>
          <Text strong>{formatRunType(runType)}</Text>
        </div>
      )
    },
    {
      title: '状态',
      key: 'status',
      render: (_: any, record: EvalResult) => getStatusDisplay(record)
    },
    {
      title: '进度',
      key: 'progress',
      render: (_: any, record: EvalResult) => {
        const total = record.total_count || 0;
        const completed = (record.passed_count || 0) + (record.unpassed_count || 0);
        const failed = record.failed_count || 0;
        const progress = calculateProgress(record);

        return (
          <div style={{ minWidth: 120 }}>
            <Progress 
              percent={progress} 
              size="small" 
              status={failed > 0 ? 'exception' : progress === 100 ? 'success' : 'active'}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {completed + failed}/{total}
            </Text>
          </div>
        );
      }
    },
    {
      title: '结果统计',
      key: 'stats',
      render: (_: any, record: EvalResult) => {
        // 对于批量评估（非staging），显示最后一列的通过/失败统计
        if (record.run_type !== 'staging' && record.total_count !== undefined && record.total_count > 0) {
          const passedCount = record.passed_count || 0;
          const unpassedCount = record.unpassed_count || 0;
          const failedCount = record.failed_count || 0;
          const totalCount = record.total_count || 0;

          return (
            <Space size="small" direction="vertical" style={{ fontSize: 12 }}>
              <div>
                <Space size="small">
                  <Tooltip title="通过用例">
                    <Tag color="success" style={{ margin: 0 }}>
                      <CheckCircleOutlined /> {passedCount}
                    </Tag>
                  </Tooltip>
                  <Tooltip title="未通过用例">
                    <Tag color="error" style={{ margin: 0 }}>
                      <CloseCircleOutlined /> {unpassedCount}
                    </Tag>
                  </Tooltip>
                  <Tooltip title="失败用例">
                    <Tag color="warning" style={{ margin: 0 }}>
                      <CloseCircleOutlined /> {failedCount}
                    </Tag>
                  </Tooltip>
                </Space>
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  成功率: {((passedCount / totalCount) * 100).toFixed(1)}%
                </Text>
              </div>
            </Space>
          );
        }

        // 对于staging或其他类型，显示任务执行统计
        const completed = record.passed_count || 0;
        const failed = record.failed_count || 0;

        return (
          <Space size="small">
            <Tooltip title="任务成功">
              <Tag color="success" style={{ margin: 0 }}>
                <CheckCircleOutlined /> {completed}
              </Tag>
            </Tooltip>
            {failed > 0 && (
              <Tooltip title="任务失败">
                <Tag color="error" style={{ margin: 0 }}>
                  <CloseCircleOutlined /> {failed}
                </Tag>
              </Tooltip>
            )}
          </Space>
        );
      }
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (time: string) => (
        <Tooltip title={new Date(time).toLocaleString()}>
          <Text type="secondary">
            <ClockCircleOutlined style={{ marginRight: 4 }} />
            {new Date(time).toLocaleString()}
          </Text>
        </Tooltip>
      )
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: EvalResult) => (
        <Space size="middle">
          <Button 
            type="text" 
            icon={<EyeOutlined />} 
            onClick={() => viewResultDetail(record.id)}
          >
            查看详情
          </Button>
        </Space>
      )
    }
  ];

  return (
    <Layout className="eval-history-page">
      {contextHolder}
      
      <Header className="page-header" style={{ background: '#fff', padding: '0 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Button 
              type="text" 
              icon={<ArrowLeftOutlined />} 
              onClick={goBack}
              style={{ marginRight: 16 }}
            >
              返回
            </Button>
            <Title level={4} style={{ margin: 0, display: 'inline' }}>
              {pipelineName} - 评估历史
            </Title>
          </div>

          <div>
            <Button 
              icon={<ReloadOutlined />} 
              onClick={loadEvalHistory}
              loading={loading}
            >
              刷新
            </Button>
          </div>
        </div>
      </Header>

      <Content style={{ padding: '16px', backgroundColor: '#f0f2f5' }}>
        <Card>
          {historyResults.length > 0 ? (
            <>
              <Row gutter={16} style={{ marginBottom: 24 }}>
                <Col span={6}>
                  <Statistic 
                    title="总评估次数" 
                    value={historyResults.length} 
                    prefix={<ClockCircleOutlined />}
                  />
                </Col>
                <Col span={6}>
                  <Statistic 
                    title="已完成评估" 
                    value={historyResults.filter(r => calculateProgress(r) === 100).length}
                    prefix={<CheckCircleOutlined />}
                  />
                </Col>
                <Col span={6}>
                  <Statistic 
                    title="运行中评估" 
                    value={historyResults.filter(r => {
                      const progress = calculateProgress(r);
                      return progress > 0 && progress < 100;
                    }).length}
                    // prefix={<LoadingOutlined />}
                  />
                </Col>
                <Col span={6}>
                  <Statistic 
                    title="最近评估" 
                    value={historyResults.length > 0 ? 
                      new Date(historyResults[0].created_at).toLocaleDateString() : '-'}
                    prefix={<ClockCircleOutlined />}
                  />
                </Col>
              </Row>

              <Table 
                columns={columns} 
                dataSource={historyResults} 
                rowKey="id"
                loading={loading}
                sticky
                scroll={{ y: 'calc(100vh - 200px)' }}
                pagination={{
                  defaultPageSize: 10,
                  showSizeChanger: true,
                  pageSizeOptions: ['10', '20', '50'],
                  showTotal: (total) => `共 ${total} 条记录`
                }}
              />
            </>
          ) : (
            <Empty 
              description="暂无评估历史记录"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            >
              <Button type="primary" onClick={goBack}>
                返回流水线
              </Button>
            </Empty>
          )}
        </Card>
      </Content>
    </Layout>
  );
};

export default EvalHistoryPage; 