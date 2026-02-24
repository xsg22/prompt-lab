import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';

import {
  Layout,
  Card,
  Typography,
  Button,
  Spin,
  Tag,
  message,
  Empty,
  Table,
  Tooltip,
  Switch,
  Badge,
  Statistic,
  Row,
  Col,
  Progress,
  Modal,
  Select
} from 'antd';
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  FileTextOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  DatabaseOutlined,
  ExperimentOutlined,
  ImportOutlined
} from '@ant-design/icons';
import { EvalPipelinesAPI, PromptsAPI } from '@/lib/api';
import App from 'antd/es/app';
import {
  StepResultDisplay,
  useStepTypes
} from '@/components/evaluation-steps';
import LongTextEditor from '@/components/ui/LongTextEditor';
import { useProjectJump } from '@/hooks/useProjectJump';
import { type EvalResult } from '@/types/evaluation';

const { Header, Content } = Layout;
const { Title, Text } = Typography;



// 列数据
interface ColumnData {
  id: number;
  name: string;
  column_type: string;
  position: number;
  config: any;
}


// 评估结果详情页面
const EvalResultDetailPage = () => {
  
  const { pipelineId, resultId } = useParams();
  const navigate = useNavigate();
  const { projectJumpTo } = useProjectJump();
  const [messageApi, contextHolder] = message.useMessage();
  
  // 获取所有步骤类型信息
  const stepTypes = useStepTypes();
  const getStepTypeInfo = (type: string) => {
    return stepTypes.find(step => step.key === type);
  };

  // 状态定义
  const [loading, setLoading] = useState(false);
  const [pipeline, setPipeline] = useState<{ name: string, description?: string }>({ name: '' });
  const [evalResult, setEvalResult] = useState<EvalResult | null>(null);
  const [columns, setColumns] = useState<ColumnData[]>([]);
  const [samples, setSamples] = useState<any[]>([]);
  const [promptsInfo, setPromptsInfo] = useState<{ [key: number]: { name: string, version_number: number } }>({}); // 提示词信息
  const [showDatasetColumns, setShowDatasetColumns] = useState(() => {
    const saved = localStorage.getItem('eval-result-show-dataset-columns');
    return saved ? JSON.parse(saved) : true;
  });
  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalItems, setTotalItems] = useState(0);
  // 过滤状态
  const [showFailedOnly, setShowFailedOnly] = useState(false);
  // 轮询状态
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
  // 导入失败用例状态
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [selectedPromptId, setSelectedPromptId] = useState<number | null>(null);
  const [importingCases, setImportingCases] = useState(false);
  const [selectedPromptMappings, setSelectedPromptMappings] = useState<Record<string, string>>({});

  // 加载数据
  useEffect(() => {
    if (pipelineId && resultId) {
      loadResultDetail();
    }
  }, [pipelineId, resultId]);

  // 轮询机制：当有正在运行的任务时，每3秒更新一次状态
  useEffect(() => {
    const startPolling = () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }

      const interval = setInterval(async () => {
        if (evalResult && (evalResult.status === 'running' || evalResult.status === 'new')) {
          try {
            // 更新评估结果状态
            const resultResponse = await EvalPipelinesAPI.getEvalResultDetail(Number(resultId));
            const resultInfo = resultResponse.data as EvalResult;

            // 检查是否有状态变化或进度更新
            const hasStatusChange = resultInfo.status !== evalResult.status;
            const hasProgressChange = (
              resultInfo.passed_count !== evalResult.passed_count ||
              resultInfo.unpassed_count !== evalResult.unpassed_count ||
              resultInfo.failed_count !== evalResult.failed_count ||
              resultInfo.total_count !== evalResult.total_count
            );

            // 更新状态
            setEvalResult(resultInfo);

            // 如果有进度变化，刷新当前页数据
            if (hasProgressChange || hasStatusChange) {
              await loadCellsData(currentPage, pageSize, resultInfo.run_type);
            }

            // 如果任务完成，停止轮询
            if (resultInfo.status === 'completed' || resultInfo.status === 'failed') {
              clearInterval(interval);
              setPollingInterval(null);
            }
          } catch (error) {
            console.error('轮询更新失败', error);
            // 轮询失败也不停止，继续尝试
          }
        } else {
          // 没有正在运行的任务，停止轮询
          clearInterval(interval);
          setPollingInterval(null);
        }
      }, 3000); // 改为3秒轮询，更及时反映进度

      setPollingInterval(interval);
    };

    // 当有正在运行的任务时开始轮询
    if (evalResult && (evalResult.status === 'running' || evalResult.status === 'new')) {
      startPolling();
    }

    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [evalResult?.status, resultId, currentPage, pageSize, showFailedOnly]);

  // 组件卸载时清理轮询
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, []);

  // 当过滤条件改变时重新加载数据
  useEffect(() => {
    if (evalResult) {
      setCurrentPage(1); // 重置到第一页
      loadCellsData(1, pageSize, evalResult.run_type);
    }
  }, [showFailedOnly]);

  // 加载单元格数据（分页）
  const loadCellsData = async (page: number, size: number, runType: string) => {
    try {
      const cellsResponse = await EvalPipelinesAPI.getPipelineCells(Number(pipelineId), runType, page, size, showFailedOnly);
      const paginatedData = cellsResponse.data;

      // 更新分页信息
      setTotalItems(paginatedData.meta.total);
      setCurrentPage(paginatedData.meta.page);

      // 转换和设置样本数据
      const transformedSamples = transformData(paginatedData.data);
      setSamples(transformedSamples);
    } catch (error: any) {
      console.error('操作失败', error);
      message.error('加载单元格数据失败');
    }
  };

  // 加载评估结果详情
  const loadResultDetail = async () => {
    setLoading(true);
    try {
      // 加载流水线信息
      const pipelineResponse = await EvalPipelinesAPI.getPipeline(Number(pipelineId));
      const pipelineData = pipelineResponse.data;
      setPipeline({
        name: pipelineData.name,
        description: pipelineData.description
      });

      // 加载评估结果基础信息
      let resultResponse = await EvalPipelinesAPI.getEvalResultDetail(Number(resultId));
      let resultInfo = resultResponse.data as EvalResult;
      setEvalResult(resultInfo);

      // 加载流水线列配置
      const columnsResponse = await EvalPipelinesAPI.getPipelineColumns(Number(pipelineId));
      const processedColumns = columnsResponse.data.flatMap((column: any) => {
        if (column.column_type === 'dataset_variable') {
          return column.config.variables.map((variable: string) => ({
            id: `dataset.${variable}`,
            name: variable,
            column_type: column.column_type,
            config: {
              variables: [variable]
            }
          }));
        }
        return [{
          id: column.id,
          name: column.name,
          column_type: column.column_type,
          config: column.config || {}
        }];
      });
      setColumns(processedColumns);

      // 加载提示词信息：优先从评估结果中获取历史版本信息
      if (resultInfo && resultInfo.prompt_versions) {
        // 从评估结果中获取当时执行时的提示词版本信息
        const promptsData: { [key: number]: { name: string, version_number: number } } = {};
        Object.values(resultInfo.prompt_versions).forEach((promptInfo: any) => {
          promptsData[promptInfo.prompt_id] = {
            name: promptInfo.prompt_name,
            version_number: promptInfo.version_number
          };
        });
        setPromptsInfo(promptsData);
      } else {
        // 如果评估结果中没有版本信息，则实时获取（向后兼容旧数据）
        const promptIds = processedColumns
          .filter((column: any) => column.column_type === 'prompt_template' && column.config.prompt_id)
          .map((column: any) => column.config.prompt_id);

        if (promptIds.length > 0) {
          const promptsData: { [key: number]: { name: string, version_number: number } } = {};
          await Promise.all(promptIds.map(async (promptId: number) => {
            try {
              // 获取提示词基本信息
              const promptResponse = await PromptsAPI.getPrompt(promptId);
              const promptName = promptResponse.data.name;

              // 获取活跃版本信息
              const versionResponse = await PromptsAPI.getActiveVersion(promptId);
              const versionNumber = versionResponse.data.version_number;

              promptsData[promptId] = {
                name: promptName,
                version_number: versionNumber
              };
            } catch (error) {
              console.error('获取提示词信息失败', error);
              promptsData[promptId] = {
                name: '提示词{promptId}',
                version_number: 1
              };
            }
          }));
          setPromptsInfo(promptsData);
        }
      }

      // 初始化加载第一页数据
      if (resultInfo) {
        await loadCellsData(1, pageSize, resultInfo.run_type);
      }
    } catch (error: any) {
      console.error('操作失败', error);
      const errorMessage = error.response?.data?.detail || '加载评估结果详情失败';
      messageApi.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // 转换单元格数据为表格需要的格式
  const transformData = (data: any[]) => {
    const groupedData: Record<string, Record<string, any>> = {};

    // 按照 dataset_item_id 进行分组
    data.forEach(item => {
      const { dataset_item_id, column_name, column_type, value } = item;

      // 如果该 dataset_item_id 还没有对应的分组，创建一个新对象
      if (!groupedData[dataset_item_id]) {
        groupedData[dataset_item_id] = {};
      }

      // 使用 column_name 作为键，存储整个数据对象
      if (column_type === 'dataset_variable') {
        Object.entries(value?.value || {}).forEach(([variableKey, variableValue]: [string, any]) => {
          const id = `dataset.${variableKey}`;
          groupedData[dataset_item_id][id] = {
            ...item,
            column_name: id,
            value: {
              "value": variableValue,
            },
            display_value: {
              "value": variableValue,
            }
          }
        });
      } else {
        groupedData[dataset_item_id][column_name] = item;
      }
      groupedData[dataset_item_id]['dataset_item_id'] = dataset_item_id;
    });

    // 将分组结果转换为数组格式
    return Object.values(groupedData);
  }

  // 返回评估历史页面
  const goBack = () => {
    navigate(projectJumpTo(`eval-pipelines/${pipelineId}/history`));
  };

  // 计算进度
  const calculateProgress = () => {
    if (!evalResult) return 0;
    const passed = evalResult.passed_count || 0;
    const unpassed = evalResult.unpassed_count || 0;
    const failed = evalResult.failed_count || 0;
    const total = evalResult.total_count || 0;

    if (total === 0) return 0;

    const completed = passed + failed + unpassed;
    return Math.round((completed / total) * 100);
  };

  // 计算成功率
  const calculateSuccessRate = () => {
    if (!evalResult) return 0;
    const passed = evalResult.passed_count || 0;
    const total = evalResult.total_count || 0;
    return total > 0 ? ((passed / total) * 100).toFixed(1) : '0';
  };

  // 根据通过率获取颜色配置
  const getSuccessRateColors = (successRate: number) => {
    if (successRate >= 90) {
      // 优秀：深绿色
      return {
        gradient: 'linear-gradient(135deg, #52c41a 0%, #389e0d 100%)',
        shadow: '0 4px 12px rgba(82, 196, 26, 0.3)',
        emoji: '🎉',
        label: '优秀'
      };
    } else if (successRate >= 80) {
      // 良好：浅绿色
      return {
        gradient: 'linear-gradient(135deg, #73d13d 0%, #52c41a 100%)',
        shadow: '0 4px 12px rgba(115, 209, 61, 0.3)',
        emoji: '✅',
        label: '良好'
      };
    } else if (successRate >= 70) {
      // 中等：橙绿色
      return {
        gradient: 'linear-gradient(135deg, #95de64 0%, #73d13d 100%)',
        shadow: '0 4px 12px rgba(149, 222, 100, 0.3)',
        emoji: '✓',
        label: '中等'
      };
    } else if (successRate >= 60) {
      // 偏低：黄色
      return {
        gradient: 'linear-gradient(135deg, #fadb14 0%, #d4b106 100%)',
        shadow: '0 4px 12px rgba(250, 219, 20, 0.3)',
        emoji: '⚠️',
        label: '偏低'
      };
    } else if (successRate >= 40) {
      // 较差：橙色
      return {
        gradient: 'linear-gradient(135deg, #fa8c16 0%, #d46b08 100%)',
        shadow: '0 4px 12px rgba(250, 140, 22, 0.3)',
        emoji: '📊',
        label: '较差'
      };
    } else {
      // 很差：红色
      return {
        gradient: 'linear-gradient(135deg, #ff7875 0%, #f5222d 100%)',
        shadow: '0 4px 12px rgba(255, 120, 117, 0.3)',
        emoji: '❌',
        label: '很差'
      };
    }
  };

  // 保存数据集列显示状态
  const handleToggleDatasetColumns = (show: boolean) => {
    setShowDatasetColumns(show);
    localStorage.setItem('eval-result-show-dataset-columns', JSON.stringify(show));
  };

  // 获取失败用例数据并转换为测试用例格式
  const getFailedCasesData = async () => {
    if (!evalResult) return [];
    
    try {
      // 获取所有失败的记录
      const response = await EvalPipelinesAPI.getPipelineCells(
        Number(pipelineId), 
        evalResult.run_type, 
        1, 
        100, // 获取大量数据以确保包含所有失败用例
        true // 只获取失败记录
      );
      
      const failedData = response.data.data;
      
      // 按 dataset_item_id 分组，提取数据集变量
      const groupedData: Record<string, Record<string, any>> = {};
      
      failedData.forEach((item: any) => {
        const { dataset_item_id, column_type, value } = item;
        
        if (column_type === 'dataset_variable' && value?.value) {
          if (!groupedData[dataset_item_id]) {
            groupedData[dataset_item_id] = {};
          }
          
          // 提取变量值
          Object.entries(value.value).forEach(([key, val]) => {
            groupedData[dataset_item_id][key] = val;
          });
        }
      });
      
      // 转换为测试用例格式
      const testCases = Object.values(groupedData).map((variables) => ({
        ...variables,
        metadatas: {
          source: 'manual' as const,
          type: 'error' as const,
          generatedAt: new Date().toISOString()
        }
      }));
      
      return testCases;
    } catch (error: any) {
      console.error('操作失败', error);
      message.error('获取失败用例数据失败');
      return [];
    }
  };

  // 获取变量映射关系
  const getVariableMappings = async (promptId: number) => {
    try {
      // 查找评估流水线中对应提示词的prompt_template列配置
      const targetColumn = columns.find(col => 
        col.column_type === 'prompt_template' && 
        col.config?.prompt_id === promptId
      );
      
      if (targetColumn && targetColumn.config?.variable_mappings) {
        return targetColumn.config.variable_mappings;
      }
      
      // 如果没有找到映射配置，返回空对象
      return {};
    } catch (error) {
      console.error('操作失败', error);
      return {};
    }
  };

  // 根据映射关系转换变量（从数据集变量转换为提示词变量）
  const convertVariablesByMapping = (datasetVariables: Record<string, any>, variableMappings: Record<string, string>) => {
    const promptVariables: Record<string, any> = {};
    
    // variableMappings 格式：{提示词变量名: 数据集变量名}
    // 我们需要反向映射：从数据集变量名找到对应的提示词变量名
    Object.entries(variableMappings).forEach(([promptVar, datasetVar]) => {
      if (datasetVar in datasetVariables) {
        promptVariables[promptVar] = datasetVariables[datasetVar];
      }
    });
    
    // 如果没有映射配置，尝试直接匹配相同的变量名
    if (Object.keys(promptVariables).length === 0) {
      Object.keys(datasetVariables).forEach(key => {
        promptVariables[key] = datasetVariables[key];
      });
    }
    
    return promptVariables;
  };

  // 处理导入失败用例
  const handleImportFailedCases = async () => {
    if (!selectedPromptId) {
      message.error('请选择要导入的提示词');
      return;
    }
    
    setImportingCases(true);
    try {
      const failedCases = await getFailedCasesData();
      
      if (failedCases.length === 0) {
        message.warning('没有找到失败的用例数据');
        setImportModalVisible(false);
        setImportingCases(false);
        return;
      }
      
      // 获取变量映射关系
      const variableMappings = await getVariableMappings(selectedPromptId);
      
      // 获取选中提示词的活跃版本ID
      const versionResponse = await PromptsAPI.getActiveVersion(selectedPromptId);
      const versionId = versionResponse.data.id;
      
      // 将失败用例根据变量映射转换后保存到数据库
      let successCount = 0;
      for (const testCase of failedCases) {
        try {
          // 移除元数据字段，获取数据集变量
          const { metadatas, ...datasetVariables } = testCase;
          
          // 根据变量映射转换为提示词变量
          const promptVariables = convertVariablesByMapping(datasetVariables, variableMappings);
          
          await PromptsAPI.createTestCase(selectedPromptId, versionId, {
            prompt_version_id: versionId,
            variables_values: promptVariables,
            name: "",
            metadatas: metadatas
          });
          successCount++;
        } catch (error) {
          console.error('操作失败', error);
        }
      }
      
      if (successCount > 0) {
        message.success(`已成功导入 ${successCount} 个失败用例到提示词`);
        setImportModalVisible(false);
        setSelectedPromptId(null);
        setSelectedPromptMappings({});
        
        // 导航到提示词编辑页面
        navigate(projectJumpTo(`prompts/${selectedPromptId}/editor`));
      } else {
        message.error('导入失败，请重试');
      }
    } catch (error) {
      console.error('操作失败', error);
      message.error('导入失败用例失败');
    } finally {
      setImportingCases(false);
    }
  };

  // 计算数据集列数量
  const datasetColumnsCount = useMemo(() => {
    return columns.filter(column => column.column_type === 'dataset_variable').length;
  }, [columns]);

  // 获取数据集列名列表
  const datasetColumnNames = useMemo(() => {
    return columns
      .filter(column => column.column_type === 'dataset_variable')
      .map(column => column.name);
  }, [columns]);

  // 定义表格列
  const tableColumns = useMemo(() => {
    // 基础列
    const baseColumns = [
      {
        title: '数据ID',
        dataIndex: 'dataset_item_id',
        key: 'dataset_item_id',
        width: 80,
        fixed: 'left' as const,
      }
    ];

    // 分离数据集列和评估列
    const datasetColumns: any[] = [];
    const evalColumns: any[] = [];

    columns.forEach(column => {
      if (column.column_type === 'dataset_variable') {
        const datasetColumn = {
          title: (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <DatabaseOutlined style={{ color: '#1890ff' }} />
              <span>{column.name}</span>
            </div>
          ),
          dataIndex: column.id,
          key: column.id,
          width: 150,
          render: (_: any, record: any) => {
            const value = record[column.id]?.display_value?.value || '';
            return (
              <div >
                <LongTextEditor
                  value={value || ''}
                  onChange={() => { }}
                  placeholder={''}
                  maxPreviewLength={30}
                  editable={false}
                  simpleMode={false}
                />
              </div>
            );
          }
        };
        datasetColumns.push(datasetColumn);
      } else {
        // 找到对应的步骤类型
        const columnType = getStepTypeInfo(column.column_type) || {
          icon: <FileTextOutlined />,
          name: column.column_type
        };

        const evalColumn = {
          title: (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {columnType.icon}
                {column.column_type === 'prompt_template' ? (
                  <Tooltip
                    title={
                      column.config?.prompt_id && promptsInfo[column.config.prompt_id]
                        ? `提示词：${promptsInfo[column.config.prompt_id].name} (v${promptsInfo[column.config.prompt_id].version_number})`
                        : '提示词模板'
                    }
                    placement="topLeft"
                  >
                    <span style={{ cursor: 'help', textDecoration: 'underline dotted' }}>
                      {column.name}
                    </span>
                  </Tooltip>
                ) : (
                  <span>{column.name}</span>
                )}
              </div>
              <Tag color="blue" style={{ marginTop: 4 }}>{columnType.name}</Tag>
            </div>
          ),
          dataIndex: column.id.toString(),
          key: column.id.toString(),
          width: 200,
          render: (_: any, record: any) => {
            const cell = record[column.name] || {};
            const status = cell.status;

            return (
              <div style={{ padding: '8px 0' }}>
                <StepResultDisplay
                  cell={cell}
                  status={status}
                  stepType={column.column_type}
                  column={column}
                />
              </div>
            );
          }
        };
        evalColumns.push(evalColumn);
      }
    });

    // 根据显示状态决定是否包含数据集列
    const finalColumns = [
      ...baseColumns,
      ...(showDatasetColumns ? datasetColumns : []),
      ...evalColumns
    ];

    return finalColumns;
  }, [columns, samples, showDatasetColumns]);

  // 渲染页面
  return (
    <App>
      <Layout className="eval-result-detail-page">
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
                {'返回'}
              </Button>
              <Title level={4} style={{ margin: 0, display: 'inline' }}>
                {pipeline.name} - {'评估结果详情'}
              </Title>
            </div>
          </div>
        </Header>

        <Content style={{ padding: '16px', backgroundColor: '#f0f2f5' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '100px 0' }}>
              <Spin size="large" tip={'加载中...'} />
            </div>
          ) : (
            <>
              {/* 摘要信息 */}
              <Card style={{ marginBottom: 16 }}>
                <Title level={5} style={{ marginBottom: 16 }}>{'评估摘要'}</Title>

                {evalResult && (
                  <>
                    {/* 第一行：重点突出的成功率和进度 */}
                    <Row gutter={24} style={{ marginBottom: 24 }}>
                      <Col span={8}>
                        {(() => {
                          const successRate = parseFloat(calculateSuccessRate().toString());
                          const colors = getSuccessRateColors(successRate);
                          return (
                            <div style={{
                              background: colors.gradient,
                              borderRadius: '12px',
                              padding: '24px',
                              textAlign: 'center',
                              color: 'white',
                              boxShadow: colors.shadow
                            }}>
                              <div style={{ fontSize: '16px', fontWeight: 500, marginBottom: '8px' }}>
                                {colors.emoji} {'通过率'} ({colors.label})
                              </div>
                              <div style={{ fontSize: '36px', fontWeight: 'bold', lineHeight: 1 }}>
                                {calculateSuccessRate()}%
                              </div>
                              <div style={{ fontSize: '14px', opacity: 0.9, marginTop: '8px' }}>
                                {`${evalResult.passed_count} / ${evalResult.total_count} 用例通过`}
                                {evalResult.status === 'running' && (
                                  <div style={{ fontSize: '12px', marginTop: '4px' }}>
                                    🔄 {'实时更新中'}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                      </Col>

                      <Col span={8}>
                        <div style={{
                          background: evalResult.status === 'running'
                            ? 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)'
                            : evalResult.failed_count && evalResult.failed_count > 0
                              ? 'linear-gradient(135deg, #ff7875 0%, #f5222d 100%)'
                              : 'linear-gradient(135deg, #52c41a 0%, #389e0d 100%)',
                          borderRadius: '12px',
                          padding: '24px',
                          textAlign: 'center',
                          color: 'white',
                          boxShadow: evalResult.status === 'running'
                            ? '0 4px 12px rgba(24, 144, 255, 0.3)'
                            : evalResult.failed_count && evalResult.failed_count > 0
                              ? '0 4px 12px rgba(255, 77, 79, 0.3)'
                              : '0 4px 12px rgba(82, 196, 26, 0.3)'
                        }}>
                          <div style={{ fontSize: '16px', fontWeight: 500, marginBottom: '8px' }}>
                            {evalResult.status === 'running' ? '⏳ 执行进度' : '📊 任务进度'}
                          </div>
                          <div style={{ fontSize: '36px', fontWeight: 'bold', lineHeight: 1 }}>
                            {calculateProgress()}%
                          </div>
                          <div style={{ marginTop: '12px' }}>
                            <Progress
                              percent={calculateProgress()}
                              status={evalResult.status === 'running' ? 'active' :
                                evalResult.failed_count && evalResult.failed_count > 0 ? 'exception' : 'success'}
                              strokeWidth={6}
                              showInfo={false}
                              strokeColor="rgba(255, 255, 255, 0.9)"
                              trailColor="rgba(255, 255, 255, 0.2)"
                            />
                          </div>
                          {evalResult.status === 'running' && (
                            <div style={{ fontSize: '12px', opacity: 0.9, marginTop: '4px' }}>
                              {'正在执行中...'}
                            </div>
                          )}
                        </div>
                      </Col>

                      <Col span={8}>
                        <div style={{
                          background: '#fafafa',
                          border: '2px solid #d9d9d9',
                          borderRadius: '12px',
                          padding: '20px',
                          textAlign: 'left'
                        }}>
                          <div style={{ fontSize: '16px', fontWeight: 500, marginBottom: '16px', color: '#666', textAlign: 'center' }}>
                            📋 {'测试信息'}
                          </div>

                          {/* 提示词信息 */}
                          {Object.keys(promptsInfo).length > 0 && (
                            <div>
                              <div style={{
                                fontSize: '13px',
                                color: '#666',
                                marginBottom: '8px',
                                borderTop: '1px solid #e0e0e0',
                                paddingTop: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}>
                                <ExperimentOutlined style={{ marginRight: '4px', color: '#52c41a' }} />
                                {'评估提示词'}
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {Object.entries(promptsInfo).map(([promptId, info]) => (
                                  <Link to={projectJumpTo(`prompts/${promptId}/overview`)}>
                                    <div key={promptId} style={{
                                      background: '#f9f9f9',
                                      padding: '6px 8px',
                                      borderRadius: '4px',
                                      border: '1px solid #e6f7ff',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      fontSize: '12px'
                                    }}>
                                      <div style={{ display: 'flex', alignItems: 'center' }}>
                                        <FileTextOutlined style={{ color: '#52c41a', marginRight: '4px', fontSize: '12px' }} />
                                        <span style={{ fontWeight: 500, color: '#333' }}>{info.name}</span>
                                      </div>
                                      <Tag color="green" style={{ margin: 0, fontSize: '10px', padding: '0 4px', lineHeight: '16px' }}>
                                        v{info.version_number}
                                      </Tag>
                                    </div>
                                  </Link>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </Col>
                    </Row>

                    {/* 第二行：详细统计数据 */}
                    <Row gutter={16}>
                      <Col span={6}>
                        <Statistic
                          title={'总用例数'}
                          value={evalResult.total_count || 0}
                          prefix={<DatabaseOutlined />}
                          valueStyle={{ fontSize: '24px', fontWeight: 'bold' }}
                        />
                      </Col>
                      <Col span={6}>
                        <Statistic
                          title={'通过用例'}
                          value={evalResult.passed_count || 0}
                          prefix={<CheckCircleOutlined />}
                          valueStyle={{ color: '#52c41a', fontSize: '24px', fontWeight: 'bold' }}
                        />
                      </Col>
                      <Col span={6}>
                        <Statistic
                          title={'未通过用例'}
                          value={evalResult.unpassed_count || 0}
                          prefix={<CloseCircleOutlined />}
                          valueStyle={{ color: '#faad14', fontSize: '24px', fontWeight: 'bold' }}
                        />
                      </Col>
                      <Col span={6}>
                        <Statistic
                          title={'异常用例'}
                          value={evalResult.failed_count || 0}
                          prefix={<CloseCircleOutlined />}
                          valueStyle={{ color: '#ff4d4f', fontSize: '24px', fontWeight: 'bold' }}
                        />
                      </Col>
                    </Row>
                  </>
                )}



                {evalResult && (
                  <div style={{ marginTop: 16, padding: '12px', background: '#fafafa', borderRadius: '6px' }}>
                    <Text type="secondary">
                      {'创建时间：'}{new Date(evalResult.created_at).toLocaleString()}
                      {evalResult.updated_at && evalResult.updated_at !== evalResult.created_at && (
                        <span style={{ marginLeft: 16 }}>
                          {'更新时间：'}{new Date(evalResult.updated_at).toLocaleString()}
                        </span>
                      )}
                    </Text>
                  </div>
                )}
              </Card>

              {/* 详情表格 */}
              <Card>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <Title level={5} style={{ margin: 0 }}>{'评估详情'}</Title>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
                      <span style={{ fontSize: '14px', color: '#666' }}>{'只看失败记录'}</span>
                      <Switch
                        checked={showFailedOnly}
                        onChange={(checked) => setShowFailedOnly(checked)}
                        size="small"
                        checkedChildren={'开'}
                        unCheckedChildren={'关'}
                      />
                    </div>
                    {/* 导入失败用例按钮 */}
                    {evalResult && evalResult.status === 'completed' && ((evalResult.failed_count || 0) > 0 || (evalResult.unpassed_count || 0) > 0) && (
                      <Button
                        type="primary"
                        ghost
                        size="small"
                        icon={<ImportOutlined />}
                        onClick={() => setImportModalVisible(true)}
                        style={{ 
                          borderColor: '#ff4d4f', 
                          color: '#ff4d4f',
                          backgroundColor: '#fff1f0'
                        }}
                      >
                        {'导入失败用例'}
                      </Button>
                    )}
                  </div>
                </div>

                {samples.length > 0 ? (
                  <>
                    {/* 数据集列控制器 */}
                    {datasetColumnsCount > 0 && (
                      <div style={{
                        marginBottom: '16px',
                        padding: '8px 12px',
                        background: '#fafafa',
                        borderRadius: '6px',
                        border: '1px solid #f0f0f0'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <DatabaseOutlined style={{ color: '#1890ff' }} />
                            <span style={{ fontWeight: 500 }}>{'数据集列'}</span>
                            <Badge count={datasetColumnsCount} style={{ backgroundColor: '#1890ff' }} />
                            {!showDatasetColumns && (
                              <Tooltip
                                title={
                                  <div>
                                    <div style={{ marginBottom: '4px' }}>已隐藏的数据集列：</div>
                                    {datasetColumnNames.map(name => (
                                      <div key={name} style={{ color: '#fff', opacity: 0.85 }}>• {`${name}`}</div>
                                    ))}
                                  </div>
                                }
                              >
                                <Tag color="orange" style={{ cursor: 'help' }}>
                                  {`已隐藏 ${datasetColumnsCount} 列`}
                                </Tag>
                              </Tooltip>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '12px', color: '#666' }}>
                              {showDatasetColumns ? '显示' : '隐藏'}
                            </span>
                            <Switch
                              checked={showDatasetColumns}
                              onChange={handleToggleDatasetColumns}
                              checkedChildren={<EyeOutlined />}
                              unCheckedChildren={<EyeInvisibleOutlined />}
                              style={{ backgroundColor: showDatasetColumns ? '#1890ff' : undefined }}
                            />
                          </div>
                        </div>
                        {showDatasetColumns && (
                          <div style={{
                            marginTop: '8px',
                            fontSize: '12px',
                            color: '#999',
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '4px'
                          }}>
                            {'显示列：'}
                            {datasetColumnNames.map(name => (
                              <Tag key={name} color="blue" style={{ fontSize: '11px', padding: '0 4px' }}>{`${name}`}</Tag>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <Table
                      columns={tableColumns}
                      dataSource={samples}
                      rowKey="dataset_item_id"
                      bordered
                      size="middle"
                      sticky
                      scroll={{ x: 'max-content', y: 'calc(100vh - 200px)' }}
                      loading={loading}
                      pagination={{
                        current: currentPage,
                        pageSize: pageSize,
                        total: totalItems,
                        showSizeChanger: true,
                        pageSizeOptions: ['10', '20', '50', '100'],
                        showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条数据行`,
                        onChange: (page, size) => {
                          setCurrentPage(page);
                          if (size !== pageSize) {
                            setPageSize(size);
                          }
                          if (evalResult) {
                            loadCellsData(page, size || pageSize, evalResult.run_type);
                          }
                        },
                        onShowSizeChange: (_, size) => {
                          setPageSize(size);
                          setCurrentPage(1);
                          if (evalResult) {
                            loadCellsData(1, size, evalResult.run_type);
                          }
                        }
                      }}
                    />
                  </>
                ) : (
                  <Empty description={'无数据'} />
                )}
              </Card>
            </>
          )}
        </Content>

        {/* 导入失败用例弹窗 */}
        <Modal
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ImportOutlined style={{ color: '#ff4d4f' }} />
              <span>{'导入失败用例到提示词'}</span>
            </div>
          }
          open={importModalVisible}
          onCancel={() => {
            setImportModalVisible(false);
            setSelectedPromptId(null);
            setSelectedPromptMappings({});
          }}
          onOk={handleImportFailedCases}
          confirmLoading={importingCases}
          okText={'确认导入'}
          cancelText={'取消'}
          width={600}
        >
          <div style={{ padding: '16px 0' }}>
            <div style={{ marginBottom: '16px' }}>
              <Text type="secondary">
                {'将当前评估中的失败用例导入到指定提示词的测试用例中，以便进行错误复现和调试。'}
              </Text>
            </div>
            
            {evalResult && (
              <div style={{ 
                background: '#fff2e8', 
                border: '1px solid #ffd591', 
                borderRadius: '6px', 
                padding: '12px', 
                marginBottom: '16px' 
              }}>
                <div style={{ fontSize: '14px', color: '#ad6800', marginBottom: '4px' }}>
                  <strong>{'失败用例统计：'}</strong>
                </div>
                <div style={{ fontSize: '13px', color: '#ad6800' }}>
                  • {'未通过用例：'}{evalResult.unpassed_count || 0} 个
                </div>
                <div style={{ fontSize: '13px', color: '#ad6800' }}>
                  • {'异常用例：'}{evalResult.failed_count || 0} 个
                </div>
                <div style={{ fontSize: '13px', color: '#ad6800', marginTop: '4px' }}>
                  {`总计：${evalResult.failed_count || 0} 个失败用例将被导入。（最多导入100条）`}
                </div>
              </div>
            )}

            <div>
              <div style={{ marginBottom: '8px' }}>
                <span style={{ color: '#ff4d4f' }}>*</span>
                <span style={{ fontWeight: 500 }}>{'选择目标提示词：'}</span>
              </div>
              <Select
                placeholder={'请选择要导入失败用例的提示词'}
                style={{ width: '100%' }}
                value={selectedPromptId}
                onChange={async (promptId) => {
                  setSelectedPromptId(promptId);
                  // 获取选中提示词的变量映射
                  const mappings = await getVariableMappings(promptId);
                  setSelectedPromptMappings(mappings);
                }}
                size="large"
              >
                {Object.entries(promptsInfo).map(([promptId, info]) => (
                  <Select.Option key={promptId} value={Number(promptId)}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FileTextOutlined style={{ color: '#52c41a' }} />
                        <span>{info.name}</span>
                      </div>
                      <Tag color="green">v{info.version_number}</Tag>
                    </div>
                  </Select.Option>
                ))}
              </Select>
            </div>

            {/* 变量映射信息显示 */}
            {selectedPromptId && Object.keys(selectedPromptMappings).length > 0 && (
              <div style={{ 
                marginTop: '16px', 
                padding: '12px', 
                background: '#f0f8ff', 
                border: '1px solid #91d5ff', 
                borderRadius: '6px'
              }}>
                <div style={{ fontSize: '14px', fontWeight: 500, marginBottom: '8px', color: '#1890ff' }}>
                  🔄 {'变量映射关系：'}
                </div>
                <div style={{ fontSize: '12px', color: '#666' }}>
                  {'数据集变量将按以下映射关系转换为提示词变量：'}
                </div>
                <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {Object.entries(selectedPromptMappings).map(([promptVar, datasetVar]) => (
                    <div key={promptVar} style={{ 
                      fontSize: '12px', 
                      padding: '4px 8px', 
                      background: '#ffffff', 
                      border: '1px solid #e0e0e0', 
                      borderRadius: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <span style={{ color: '#1890ff', fontWeight: 500 }}>{datasetVar}</span>
                      <span style={{ color: '#999', margin: '0 8px' }}>→</span>
                      <span style={{ color: '#52c41a', fontWeight: 500 }}>{promptVar}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedPromptId && Object.keys(selectedPromptMappings).length === 0 && (
              <div style={{ 
                marginTop: '16px', 
                padding: '8px 12px', 
                background: '#fff7e6', 
                border: '1px solid #ffd591', 
                borderRadius: '6px',
                fontSize: '12px',
                color: '#ad6800'
              }}>
                ⚠️ {'注意：未找到变量映射配置，将尝试直接使用相同的变量名进行匹配。'}
              </div>
            )}

            <div style={{ 
              marginTop: '16px', 
              padding: '8px 12px', 
              background: '#f6ffed', 
              border: '1px solid #b7eb8f', 
              borderRadius: '6px',
              fontSize: '12px',
              color: '#389e0d'
            }}>
              {'💡 提示：导入后您可以在提示词编辑页面的测试用例中看到这些失败的用例，它们会被标记为"错误类型"，方便您进行调试和优化。'}
            </div>
          </div>
        </Modal>
      </Layout>
    </App>
  );
};

export default EvalResultDetailPage; 