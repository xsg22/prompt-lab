import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import type { FormInstance } from 'antd';
import {
  Layout,
  Card,
  Typography,
  Button,
  Select,
  Spin,
  Space,
  Tag,
  message,
  Empty,
  Modal,
  Table,
  Tooltip,
  Switch,
  Badge
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
  FileTextOutlined,
  RedoOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  DatabaseOutlined,
  SwapOutlined
} from '@ant-design/icons';
import { DatasetsAPI, EvalPipelinesAPI } from '@/lib/api';
import App from 'antd/es/app';
import {
  StepResultDisplay,
  useStepTypes
} from '@/components/evaluation-steps';
import EvaluationColumnModal from '@/components/evaluation/EvaluationColumnModal';
import LongTextEditor from '@/components/ui/LongTextEditor';
import DatasetItemSelectionModal from '@/components/DatasetItemSelectionModal';
import { useProjectJump } from '@/hooks/useProjectJump';

const { Header, Content } = Layout;

// 步骤类型定义
export interface StepType {
  key: string;        // 步骤类型唯一标识
  name: string;       // 步骤类型显示名称
  description: string; // 步骤类型描述
  icon: ReactNode;     // 步骤类型图标
  category: string;    // 步骤分类
  supportsInputRef?: boolean; // 是否支持变量引用
  supportsExpectedRef?: boolean; // 是否支持期望值引用
  needsExecutionButton?: boolean; // 是否需要执行按钮
}

// 步骤配置组件的props
export interface StepProps {
  form: FormInstance;  // antd表单实例
  availableColumns: any[]; // 可用的前序列
  projectId: number;   // 项目ID
  previousColumns?: any[]; // 前序列（可选）
}

// 步骤配置
export interface StepConfig {
  [key: string]: any;
}

// 步骤执行结果
export interface StepResult {
  output?: any;        // 输出结果
  passed?: boolean;    // 是否通过
  details?: any;       // 详细信息
  error?: string;      // 错误信息
}

// 结果展示组件的props
export interface CellResultProps {
  result: StepResult | null; // 结果
  status: string;           // 状态
  stepType: string;         // 步骤类型
  column: any;              // 列数据
  onSaveHumanInput?: (value: any) => void; // 保存人工输入的回调
}

// 列数据
export interface ColumnData {
  id: number;
  name: string;
  column_type: string;
  position: number;
  config: any;
}

// 评估列cell值 
export interface EvalCell {
  id: number,
  dataset_item_id: number,
  eval_column_id: number,
  display_value: any,
  value: any,
  error_message: string,
  status: string,
  column_name: string,
}

// 表格式评估流水线页面
const InstantEvalPipelinePage = () => {
  const pipelineId = Number(useParams().pipelineId);
  const projectId = Number(useParams().projectId);
  const [messageApi, contextHolder] = message.useMessage();
  const navigate = useNavigate();
  const { projectJumpTo } = useProjectJump();
  
  // 获取所有步骤类型信息
  const stepTypes = useStepTypes();
  const getStepTypeInfo = (type: string) => {
    return stepTypes.find(step => step.key === type);
  };

  // 状态定义
  const [pipeline, setPipeline] = useState<{ name: string, description?: string }>({ name: '' });
  const [loading, setLoading] = useState(false);
  const [datasets, setDatasets] = useState<any[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<any>(null);
  const [samples, setSamples] = useState<any[]>([]);
  const [columns, setColumns] = useState<ColumnData[]>([]);
  const [cellResults, setCellResults] = useState<Record<string, Record<string, any>>>({});
  const [cellStatuses, setCellStatuses] = useState<Record<string, Record<string, string>>>({});
  const [addColumnVisible, setAddColumnVisible] = useState(false);
  const [editingColumn, setEditingColumn] = useState<any>(null);
  const [executingAll, setExecutingAll] = useState(false);
  const [refreshPipeline, setRefreshPipeline] = useState(false);
  const [itemSelectionVisible, setItemSelectionVisible] = useState(false);
  const [currentDatasetItemIds, setCurrentDatasetItemIds] = useState<number[]>([]);
  const [itemSelectionDatasetId, setItemSelectionDatasetId] = useState<number>(0);
  const [isSelectingCurrentDataset, setIsSelectingCurrentDataset] = useState<boolean>(false);
  // 添加数据集列显示控制状态
  const [showDatasetColumns, setShowDatasetColumns] = useState(() => {
    // 从localStorage读取用户偏好，默认显示
    const saved = localStorage.getItem('eval-pipeline-show-dataset-columns');
    return saved ? JSON.parse(saved) : true;
  });
  // 数据集搜索状态
  const [datasetSearchValue, setDatasetSearchValue] = useState('');

  // 加载流水线数据
  useEffect(() => {
    if (pipelineId) {
      loadPipeline(pipelineId);
    }
  }, [pipelineId]);

  // 加载项目数据集
  useEffect(() => {
    if (projectId) {
      loadDatasets(projectId);
    }
  }, [projectId]);

  // 刷新流水线结果, 3分钟刷新一次cells，然后再查询resultStatus
  const refreshPipelineResult = async (pipelineId: number) => {
    if (refreshPipeline) return;

    try {
      setRefreshPipeline(true);

      // 否则启动轮询检查任务状态
      let isCompleted = false;
      let retryCount = 0;
      const maxRetries = 30; // 最多轮询30次

      while (!isCompleted && retryCount < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 3000)); // 等待1秒

        try {
          const taskStatus = await EvalPipelinesAPI.getPipelineResultStatus(pipelineId);
          const resultStatus = taskStatus.data;

          if (resultStatus.new === 0 && resultStatus.running === 0) {
            isCompleted = true;
          }
          loadCells(pipelineId);

          retryCount++;
        } catch (error: any) {
          console.error('操作失败', error);
          retryCount = maxRetries; // 出错时停止轮询
        }
      }
    } catch (error: any) {
      console.error('操作失败', error);
    } finally {
      setRefreshPipeline(false);
    }
  }

  // 加载流水线
  const loadPipeline = async (pipelineId: number) => {
    setLoading(true);
    try {
      const response = await EvalPipelinesAPI.getPipeline(pipelineId);
      const pipelineData = response.data;

      setPipeline({
        name: pipelineData.name,
        description: pipelineData.description
      });

      const columnsResponse = await EvalPipelinesAPI.getPipelineColumns(pipelineId);


      setColumns(columnsResponse.data.flatMap((column: any) => {
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
        }]
      }));

      refreshPipelineResult(pipelineId);

      if (pipelineData.dataset_id) {
        const datasetResponse = await DatasetsAPI.getDataset(pipelineData.dataset_id);
        setSelectedDataset(datasetResponse.data);
      }
    } catch (error: any) {
      console.error('操作失败', error);
      const errorMessage = error.response?.data?.detail || '加载流水线失败';
      messageApi.error(errorMessage);
    } finally {

    }
  };

  const loadCells = async (pipelineId: number) => {
    try {
      // staging环境数据通常不多，使用较大的页面大小获取所有数据
      const cellsResponse = await EvalPipelinesAPI.getPipelineCells(pipelineId, 'staging', 1, 100);
      console.log('cellsResponse', cellsResponse);

      
      // 兼容分页响应格式
      const cellsData = cellsResponse.data.data || cellsResponse.data;
  
      // 按照 dataset_itme_id 分组后，将每个样本的变量值作为对象的属性
      const samples = transformData(cellsData);
      console.log('samples', samples);
      setSamples(samples);

      // 提取当前的数据项ID
      const datasetItemIds = samples.map(item => Number(item.dataset_item_id));
      setCurrentDatasetItemIds(datasetItemIds);
    } finally {
      setLoading(false);
    }
  }

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
        Object.entries(value).forEach(([variableKey, variableValue]: [string, any]) => {
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
          console.log('groupedData[dataset_item_id][id]:', {
            ...item,
            eval_column_id: id,
            column_name: id,
            value: {
              "value": variableValue,
            },
            display_value: {
              "value": variableValue,
            }
          });
        });
      } else {
        groupedData[dataset_item_id][column_name] = item;
      }
      groupedData[dataset_item_id]['dataset_item_id'] = dataset_item_id;
    });

    // 将分组结果转换为数组格式
    return Object.values(groupedData);
  }

  // 加载数据集
  const loadDatasets = async (projectId: number) => {
    try {
      const response = await DatasetsAPI.getAllDatasets(projectId);
      setDatasets(response.data);
    } catch (error: any) {
      console.error('操作失败', error);
      const errorMessage = error.response?.data?.detail || '加载数据集失败';
      messageApi.error(errorMessage);
    }
  };

  // 修改数据集变更处理
  const handleDatasetChange = async (datasetId: number) => {
    const dataset = datasets.find(d => d.id === datasetId);
    if (dataset) {
      try {
        // 通知服务更新数据集
        await EvalPipelinesAPI.changeDataset(pipelineId, {
          dataset_id: datasetId
        }).then(() => {
          loadPipeline(Number(pipelineId));
        });
      } catch (error: any) {
        console.error('操作失败', error);
        const errorMessage = error.response?.data?.detail || '更新数据集失败';
        messageApi.error(errorMessage);
      }
    }
  };

  // 打开数据项选择模态框（用于指定数据集）
  const handleSelectDatasetItemsForDataset = (datasetId: number) => {
    setItemSelectionDatasetId(datasetId);

    // 判断是否选择的是当前数据集
    const isCurrentDataset = selectedDataset && datasetId === selectedDataset.id;
    setIsSelectingCurrentDataset(isCurrentDataset);

    // 注意：不要修改 currentDatasetItemIds，它应该始终保持当前数据集的真实状态
    // 模态框会根据 isCurrentDataset 来决定显示哪些已选择项

    setItemSelectionVisible(true);
  };

  // 确认选择数据项
  const handleConfirmItemSelection = async (selectedItemIds: number[]) => {
    if (!itemSelectionDatasetId) return;

    try {
      // 使用新的数据项更新数据集
      await EvalPipelinesAPI.changeDataset(pipelineId, {
        dataset_id: itemSelectionDatasetId,
        selected_item_ids: selectedItemIds
      });

      // 更新当前数据集的已选择项ID（这会成为新的当前数据集）
      setCurrentDatasetItemIds(selectedItemIds);
      loadPipeline(Number(pipelineId));
      messageApi.success('数据项更新成功');
    } catch (error: any) {
      console.error('操作失败', error);
      const errorMessage = error.response?.data?.detail || '更新数据项失败';
      messageApi.error(errorMessage);
    }
  };

  // 修改添加列
  const handleAddColumn = async (columnData: any) => {

    try {
      const response = await EvalPipelinesAPI.addPipelineColumn(pipelineId, {
        pipeline_id: pipelineId,
        name: columnData.name,
        column_type: columnData.type,
        config: columnData.config,
        position: columns.length
      });
      const newColumn = response.data

      setColumns(prevColumns => [...prevColumns, newColumn]);

      executeCell(newColumn, undefined);
    } catch (error: any) {
      console.error('操作失败', error);
      const errorMessage = error.response?.data?.detail || '添加列失败';
      messageApi.error(errorMessage);
    }
  };

  // 修改保存列编辑
  const handleSaveColumn = async (updatedColumn: any) => {
    console.log('updatedColumn', updatedColumn);

    const response = await EvalPipelinesAPI.updatePipelineColumn(pipelineId, updatedColumn.id, updatedColumn);
    console.log('response', response);

    setColumns(prevColumns =>
      prevColumns.map(column =>
        column.id === updatedColumn.id ? updatedColumn : column
      )
    );

    setEditingColumn(null);
  };

  // 修改删除列
  const handleDeleteColumn = async (columnId: number) => {
    // 显示确认对话框
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个评估列吗？相关的评估结果将一并删除。',
      onOk: async () => {
        const response = await EvalPipelinesAPI.deletePipelineColumn(pipelineId, columnId);
        console.log('delete column response', response);
        setColumns(prevColumns => prevColumns.filter(column => column.id !== columnId));

        // 清除该列的结果
        setCellResults(prevResults => {
          const newResults = { ...prevResults };
          Object.keys(newResults).forEach(sampleId => {
            if (newResults[sampleId] && newResults[sampleId][columnId]) {
              delete newResults[sampleId][columnId];
            }
          });
          return newResults;
        });

        setCellStatuses(prevStatuses => {
          const newStatuses = { ...prevStatuses };
          Object.keys(newStatuses).forEach(sampleId => {
            if (newStatuses[sampleId] && newStatuses[sampleId][columnId]) {
              delete newStatuses[sampleId][columnId];
            }
          });
          return newStatuses;
        });
      }
    });
  };

  // 处理人工输入保存
  const handleSaveHumanInput = (_columnId: number, cellId: number, value: any) => {

    // 自动保存该单元格的值
    if (pipelineId) {
      EvalPipelinesAPI.updatePipelineCell(pipelineId, cellId, {
        value: { value },
        display_value: { value },
        status: 'completed'
      }).then(() => {
        messageApi.success('保存成功');
      }).catch(err => {
        console.error('操作失败', err);
        const errorMessage = err.response?.data?.detail || '保存失败';
        messageApi.error(errorMessage);
      });
    }
  }

  // 执行单元格
  const executeCell = async (column: ColumnData, sampleId: number | undefined) => {

    try {
      // 处理变量引用
      const config = { ...column.config };

      // 将对应cell的status设置为running
      setSamples(prevSamples => {
        const newSamples = [...prevSamples];
        newSamples.forEach((columns: any) => {
          Object.values(columns).forEach((item: any) => {
            if (item.eval_column_id === column.id && (sampleId ? item.dataset_item_id === sampleId : true)) {
              item.status = 'running';
            }
          });
        });

        console.log('newSamples', newSamples);
        return newSamples;
      });

      // 调用单列评估API启动任务
      await EvalPipelinesAPI.evaluateColumn(pipelineId, {
        dataset_item_id: sampleId,
        column_id: column.id,
        value: column.column_type === 'human_input' ? column.config.value : undefined,
        config: config // 传递处理后的配置
      }).then(res => {
        console.log('execute cell response', res);
        refreshPipelineResult(pipelineId);
      });
    } catch (error: any) {
      console.error('操作失败', error);
      const errorMessage = error.response?.data?.detail || '执行单元格失败';
      messageApi.error(errorMessage);
    }
  };


  // 执行所有单元格
  const executeAllCells = async () => {
    if (!selectedDataset) {
      messageApi.warning('请先选择数据集');
      return;
    }

    if (columns.length === 0) {
      messageApi.warning('请先添加评估列');
      return;
    }

    // 计算数据集记录条数，dataset对应is_enable=true的记录数
    const enabledCountResponse = await DatasetsAPI.getDatasetItemsEnabledCount(selectedDataset.id);
    const recordCount = enabledCountResponse.data.enabled;
    const evalColumnsCount = columns.filter(col => col.column_type !== 'dataset_variable').length;

    // 最后一列category是不是'assertion'
    const lastColumn = columns[columns.length - 1];
    const lastColumnCategory = getStepTypeInfo(lastColumn.column_type)?.category;
    if (lastColumnCategory !== 'assertion') {
      messageApi.warning('最后一列必须是断言类型');
      return;
    }

    Modal.confirm({
      title: '执行完整评估',
      width: 500,
      content: (
        <div>
          <p>您将对数据集下所有记录执行完整评估功能：</p>
          <ul style={{ margin: '16px 0', paddingLeft: 20 }}>
            <li>数据集记录：{recordCount} 条</li>
            <li>评估列数：{evalColumnsCount} 个</li>
          </ul>
          <div style={{ background: '#f6f8fa', padding: 12, borderRadius: 6, marginTop: 16 }}>
            <div style={{ color: '#856404', fontWeight: 500, marginBottom: 8 }}>⚠️ 重要提醒：</div>
            <ul style={{ margin: 0, paddingLeft: 20, color: '#856404' }}>
              <li>评估将异步执行，需要耗费较长时间</li>
              <li>执行过程中您可以关闭页面，不会影响评估进度</li>
              <li>完成后可在评估历史记录中查看结果</li>
            </ul>
          </div>
        </div>
      ),
      okText: '确认执行',
      cancelText: '取消',
      okType: 'primary',
      onOk: async () => {
        setExecutingAll(true);

        try {
          // 创建新的评估结果（非staging类型）
          const currentTime = new Date().toISOString().slice(0, 19).replace('T', '_');
          const runType = `batch_${currentTime}`;

          const result = await EvalPipelinesAPI.createResult(pipelineId, {
            pipeline_id: pipelineId,
            run_type: runType,
            execution_mode: 'row_based'
          });

          messageApi.success('完整评估已启动，您可以在评估历史记录中查看进度');

          // 跳转到评估历史详情页面
          setTimeout(() => {
            navigate(projectJumpTo(`eval-pipelines/${pipelineId}/results/${result.data.id}`));
          }, 1500);

        } catch (error: any) {
          console.error('操作失败', error);
          const errorMessage = error.response?.data?.detail || '启动完整评估失败';
          messageApi.error(errorMessage);
        } finally {
          setExecutingAll(false);
        }
      }
    });
  };

  // 保存数据集列显示状态到localStorage
  const handleToggleDatasetColumns = (show: boolean) => {
    setShowDatasetColumns(show);
    localStorage.setItem('eval-pipeline-show-dataset-columns', JSON.stringify(show));
  };

  // 定义表格列
  const tableColumns = useMemo(() => {
    // 基础列：数据集记录
    const baseColumns = [
      {
        title: '数据ID',
        dataIndex: 'dataset_item_id',
        key: 'dataset_item_id',
        width: 40,
        fixed: 'left' as const,
        hidden: true
      },
      // {
      //   title: '数据名称',
      //   dataIndex: 'name',
      //   key: 'name',
      //   width: 100,
      //   fixed: 'left' as const,
      //   hidden: true
      // }
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
          dataIndex: column.name,
          key: column.name,
          width: 100,
          render: (_: any, record: any) => {
            console.log('load dataset variable', record, column);
            const value = record[column.id]?.display_value ? record[column.id]?.display_value?.value : '';
            return (
              <div style={{ maxWidth: '200px' }}>
                <LongTextEditor
                  value={value || ''}
                  onChange={() => { }} // 查看模式下不需要处理变更
                  placeholder={''}
                  maxPreviewLength={30}
                  editable={false}
                />
              </div>
            )
          }
        };
        datasetColumns.push(datasetColumn);
      } else {
        // 找到对应的步骤类型
        const columnType = getStepTypeInfo(column.column_type) || {
          icon: <FileTextOutlined />,
          name: column.column_type
        };

        const stepType = getStepTypeInfo(column.column_type);

        const evalColumn = {
          title: (
            <div>
              <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Space>
                  {columnType.icon}
                  <span>{column.name}</span>
                </Space>
                <Space size="small">
                  <Button
                    type="text"
                    size="small"
                    icon={<EditOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingColumn(column);
                      setAddColumnVisible(true);
                    }}
                  />
                  <Button
                    type="text"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteColumn(column.id);
                    }}
                  />
                </Space>
              </div>
              <div>
                <Tag color="blue">{columnType.name}</Tag>
                {stepType?.needsExecutionButton !== false && (
                  <Button
                    type="link"
                    size="small"
                    icon={<PlayCircleOutlined />}
                    onClick={() => executeCell(column, undefined)}
                    loading={status === 'running'}
                  >
                    执行
                  </Button>
                )}
              </div>
            </div>
          ),
          dataIndex: column.id.toString(),
          key: column.id.toString(),
          width: 200,
          render: (_: any, record: any) => {
            const cell = record[column.name] || {};
            const status = cell.status;
            const stepType = getStepTypeInfo(column.column_type);

            return (
              <div style={{ padding: '8px 0' }}>
                <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                  

                  {stepType?.needsExecutionButton !== false && (
                    <Button
                      type="link"
                      size="small"
                      icon={<RedoOutlined />}
                      onClick={() => executeCell(column, record.dataset_item_id)}
                      loading={!status || status === 'running'}
                    >
                      {column.column_type !== 'human_input' && (
                        <Space>
                          {status === 'new' && <>未执行</>}
                          {(!status || status === 'running') && <>执行中</>}
                          {status === 'completed' && <>成功</>}
                          {status === 'failed' && <>失败</>}
                        </Space>
                      )}
                    </Button>
                  )}
                </div>

                <StepResultDisplay
                  cell={cell}
                  status={status}
                  stepType={column.column_type}
                  column={column}
                  onSaveHumanInput={
                    column.column_type === 'human_input'
                      ? (value) => {
                        console.log('save human input', value, record, column);
                        handleSaveHumanInput(column.id, record[column.name].id, value)
                      }
                      : undefined
                  }
                />
              </div>
            );
          }
        };
        evalColumns.push(evalColumn);
      }
    });

    // 添加列按钮
    const addColumnButton = {
      title: (
        <Button
          type="dashed"
          icon={<PlusOutlined />}
          onClick={() => setAddColumnVisible(true)}
          style={{ width: '100%' }}
        >
          添加评估列
        </Button>
      ),
      dataIndex: 'add_column',
      key: 'add_column',
      width: 150,
      render: () => null
    };

    // 根据显示状态决定是否包含数据集列
    const finalColumns = [
      ...baseColumns,
      ...(showDatasetColumns ? datasetColumns : []),
      ...evalColumns,
      addColumnButton
    ];

    return finalColumns;
  }, [selectedDataset, columns, cellResults, cellStatuses, samples, showDatasetColumns]);

  // 计算数据集列数量用于显示
  const datasetColumnsCount = useMemo(() => {
    return columns.filter(column => column.column_type === 'dataset_variable').length;
  }, [columns]);

  // 获取数据集列名列表用于提示
  const datasetColumnNames = useMemo(() => {
    return columns
      .filter(column => column.column_type === 'dataset_variable')
      .map(column => column.name);
  }, [columns]);

  console.log('load table columns', loading);

  // 渲染页面
  return (
    <App>
      <Layout className="eval-table-page">
        {contextHolder}

        <Header className="page-header" style={{ background: '#fff', padding: '0px 16px', borderBottom: '1px solid #f0f0f0' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '24px',
            flexWrap: 'wrap'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              flex: 1,
              minWidth: 0
            }}>
              <Typography.Title
                level={4}
                style={{
                  margin: 0,
                  color: '#1890ff',
                  fontSize: '18px',
                  fontWeight: 600,
                  whiteSpace: 'nowrap'
                }}
              >
                {pipeline.name}
              </Typography.Title>

              <div style={{
                width: '1px',
                height: '20px',
                backgroundColor: '#d9d9d9',
                margin: '0 4px'
              }} />

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                <span style={{
                  color: '#666',
                  fontSize: '14px',
                  whiteSpace: 'nowrap'
                }}>
                  数据集:
                </span>
                                 <Select
                   placeholder="选择数据集"
                   value={selectedDataset?.id}
                   onChange={handleDatasetChange}
                   style={{ minWidth: 200, maxWidth: 300, flex: 1 }}
                   showSearch
                   searchValue={datasetSearchValue}
                   onSearch={setDatasetSearchValue}
                   filterOption={false}
                   dropdownRender={() => {
                     const filteredDatasets = datasets.filter(dataset =>
                       dataset.name.toLowerCase().includes(datasetSearchValue.toLowerCase())
                     );
                     
                     return (
                       <div>
                         {filteredDatasets.length > 0 ? (
                           filteredDatasets.map(dataset => (
                             <div
                               key={dataset.id}
                               style={{
                                 padding: '8px 12px',
                                 display: 'flex',
                                 justifyContent: 'space-between',
                                 alignItems: 'center',
                                 cursor: 'pointer',
                                 borderBottom: '1px solid #f0f0f0'
                               }}
                               onMouseEnter={(e) => {
                                 e.currentTarget.style.backgroundColor = '#f5f5f5';
                               }}
                               onMouseLeave={(e) => {
                                 e.currentTarget.style.backgroundColor = 'transparent';
                               }}
                             >
                               <span
                                 onClick={() => {
                                   handleDatasetChange(dataset.id);
                                   setDatasetSearchValue(''); // 选择后清空搜索
                                 }}
                                 style={{ flex: 1, fontSize: '14px' }}
                               >
                                 {dataset.name}
                               </span>
                               <Button
                                 type="text"
                                 size="small"
                                 icon={<SwapOutlined />}
                                 onClick={(e) => {
                                   e.stopPropagation();
                                   handleSelectDatasetItemsForDataset(dataset.id);
                                 }}
                                 style={{ marginLeft: 8 }}
                                 title="选择数据项"
                               />
                             </div>
                           ))
                         ) : (
                           <div style={{ 
                             padding: '8px 12px', 
                             color: '#999', 
                             textAlign: 'center' 
                           }}>
                             暂无匹配的数据集
                           </div>
                         )}
                       </div>
                     );
                   }}
                 >
                  {datasets.map(dataset => (
                    <Select.Option key={dataset.id} value={dataset.id}>
                      {dataset.name}
                    </Select.Option>
                  ))}
                </Select>
              </div>
            </div>

            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={executeAllCells}
              loading={executingAll}
              disabled={!selectedDataset || columns.length === 0 || samples.length === 0}
              size="large"
              style={{
                height: '40px',
                fontSize: '14px',
                fontWeight: 500,
                whiteSpace: 'nowrap'
              }}
            >
              全量执行
            </Button>
          </div>
        </Header>

        <Content style={{ padding: '16px', backgroundColor: '#f0f2f5' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '100px 0' }}>
              <Spin size="large" tip="加载中..." />
            </div>
          ) : (
            <Card>
              {selectedDataset ? (
                samples.length > 0 ? (
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
                            <span style={{ fontWeight: 500 }}>数据集列</span>
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
                                  已隐藏 {datasetColumnsCount} 列
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
                            显示列：
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
                      pagination={{
                        defaultPageSize: 10,
                        showSizeChanger: true,
                        pageSizeOptions: ['10', '20', '50']
                      }}
                    />
                  </>
                ) : (
                  <Empty description="数据集中没有样本" />
                )
              ) : (
                <Empty description="请先选择数据集" />
              )}
            </Card>
          )}
        </Content>

        {/* 添加列模态框 */}
        <EvaluationColumnModal
          visible={addColumnVisible}
          column={editingColumn}
          availableColumns={columns}
          datasetVariables={selectedDataset?.variables || []}
          onClose={() => {
            setAddColumnVisible(false);
            setEditingColumn(null);
          }}
          onAddColumn={handleAddColumn}
          onSave={handleSaveColumn}
          projectId={projectId}
        />

        {/* 数据项选择模态框 */}
        <DatasetItemSelectionModal
          open={itemSelectionVisible}
          onClose={() => setItemSelectionVisible(false)}
          onConfirm={handleConfirmItemSelection}
          datasetId={itemSelectionDatasetId}
          initialSelectedIds={currentDatasetItemIds}
          isCurrentDataset={isSelectingCurrentDataset}
        />
      </Layout>
    </App>
  );
};

export default InstantEvalPipelinePage; 