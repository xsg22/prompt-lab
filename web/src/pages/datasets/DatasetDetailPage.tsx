import { useParams, useNavigate } from "react-router-dom"
import { useState, useEffect, useRef, type ReactNode } from "react"
import {
  Card,
  Typography,
  Button,
  Divider,
  Space,
  Popconfirm,
  Empty,
  message,
  Switch,
  Tooltip
} from "antd"
import {
  EditOutlined,
  ArrowLeftOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  UploadOutlined
} from "@ant-design/icons"
import { EditableProTable } from '@ant-design/pro-components'
import type { ProColumns, ActionType } from '@ant-design/pro-components'
import { EditDatasetModal } from "@/components/EditDatasetModal"
import { UploadDatasetWizard } from '@/components/UploadDatasetWizard'
import { DatasetsAPI } from "@/lib/api"
import LongTextEditor from "@/components/ui/LongTextEditor"

const { Title, Text } = Typography

// 定义数据集类型
interface Dataset {
  id: string;
  name: string;
  prompt_id: number;
  prompt_name: string;
  prompt_version_id: number;
  version_number: number;
  description: string | null;
  variables: string[];
  evaluation_strategy: 'exact' | 'keyword' | 'json' | 'prompt';
  evaluation_config: any;
  created_at: string;
  updated_at: string;
}

// 定义数据集条目类型
interface DatasetItem {
  id: string;
  dataset_id: string;
  name: string;
  variables_values: Record<string, string>;
  is_enabled: boolean;
  created_at: string;
}

export default function DatasetDetailPage() {
  const params = useParams()
  const navigate = useNavigate()
  const id = params.id as string
  const [dataset, setDataset] = useState<Dataset | null>(null)
  const [loading, setLoading] = useState(true)
  const actionRef = useRef<ActionType>(null)

  // 编辑数据集状态
  const [editDatasetModalOpen, setEditDatasetModalOpen] = useState(false)

  // 上传数据集弹窗相关状态
  const [uploadModalOpen, setUploadModalOpen] = useState(false)

  // 批量操作状态
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])

  // 统计状态
  const [totalCount, setTotalCount] = useState(0)
  const [enabledCount, setEnabledCount] = useState(0)

  // 刷新触发器
  const [, setRefreshTrigger] = useState(0)

  // 列显示控制
  const [hiddenColumns] = useState<string[]>([])

  // 可编辑行状态
  const [editableKeys, setEditableKeys] = useState<React.Key[]>([])

  // 刷新数据的通用方法
  const refreshData = () => {
    setRefreshTrigger(prev => prev + 1);
    fetchDataset();
    // 强制刷新表格
    actionRef.current?.reload?.();
  }

  // 加载数据集信息
  const fetchDataset = async () => {
    try {
      setLoading(true)
      const response = await DatasetsAPI.getDataset(Number(id))
      const data = response.data
      setDataset(data)
    } catch (error) {
      console.error("加载数据集失败:", error)
      message.error(error instanceof Error ? error.message : '加载数据集失败')
    } finally {
      setLoading(false)
    }

    // 加载统计信息
    const enabledCountResponse = await DatasetsAPI.getDatasetItemsEnabledCount(Number(id))
    setTotalCount(enabledCountResponse.data.total)
    setEnabledCount(enabledCountResponse.data.enabled)
  }

  useEffect(() => {
    fetchDataset()
  }, [id])

  // 复制数据集条目
  const handleCopyItem = async (item: DatasetItem) => {
    try {
      // 创建一个新对象，移除id属性
      const { id: itemId, ...itemWithoutId } = item;

      // 准备请求数据
      const newItem = {
        ...itemWithoutId,
        name: `${item.name} (副本)`,
        is_enabled: false // 复制的条目默认不启用
      };

      // 发送请求创建新条目
      await DatasetsAPI.createItem(Number(id), newItem);

      message.success('复制成功');

      // 刷新表格
      refreshData();
    } catch (error) {
      console.error("复制条目失败:", error);
      message.error('复制失败');
    }
  };

  // 批量删除条目
  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要删除的条目');
      return;
    }

    try {
      const itemIds = selectedRowKeys.map(key => Number(key));
      await DatasetsAPI.batchDeleteItems(Number(id), itemIds);

      message.success(`成功删除 ${selectedRowKeys.length} 个条目`);
      setSelectedRowKeys([]);
      refreshData();
    } catch (error) {
      console.error("批量删除失败:", error);
      message.error('批量删除失败，请重试');
    }
  };

  // 切换条目启用状态
  const handleToggleEnabled = async (record: DatasetItem, checked: boolean) => {
    try {
      await DatasetsAPI.updateItem(Number(id), Number(record.id), {
        is_enabled: checked
      });

      message.success(`条目已${checked ? '已启用' : '已禁用'}`);
      refreshData();
    } catch (error) {
      console.error("更新条目状态失败:", error);
      message.error('更新条目状态失败，请重试');
    }
  };

  // 添加新条目
  const handleAddNewItem = () => {
    const newId = `new_${Date.now()}`;
    const newRecord = {
      id: newId,
      dataset_id: id,
      name: '',
      variables_values: dataset?.variables?.reduce((acc, varName) => {
        acc[varName] = '';
        return acc;
      }, {} as Record<string, string>) || {},
      is_enabled: true,
      created_at: new Date().toISOString(),
    };

    // 使用actionRef添加新行并设为可编辑
    actionRef.current?.addEditRecord?.(newRecord, {
      position: 'top',
    });
  };

  // 生成变量列
  const generateVariableColumns = (): ProColumns<DatasetItem>[] => {
    if (!dataset || !dataset.variables || dataset.variables.length === 0) {
      return [];
    }

    return dataset.variables.map(variable => ({
      title: variable,
      dataIndex: ['variables_values', variable],
      key: 'variables_values.' + variable,
      width: 150,
      ellipsis: true,
      sorter: false,
      hideInSearch: true,
      hidden: hiddenColumns.includes(variable),
      fieldProps: {
        placeholder: `请输入${variable}`,
      },
      formItemProps: {
        rules: [
          {
            message: `请输入${variable}`,
          },
        ],
      },
      render: (text: ReactNode, record: DatasetItem) => {
        console.log('render', text, record)
        return (
          <div style={{ width: '200px' }}>
            <LongTextEditor
              value={record.variables_values[variable] || ''}
              onChange={() => { }} // 查看模式下不需要处理变更
              placeholder={`请输入${variable}`}
              maxPreviewLength={30}
              editable={false}
            />
          </div>
        );
      },
      renderFormItem: (_, { value, onChange }) => {
        return (
          <LongTextEditor
            value={value || ''}
            onChange={(newValue) => onChange?.(newValue)}
            placeholder={`请输入${variable}`}
            maxPreviewLength={30} // 设置预览长度为50个字符
            editable={true}
          />
        );
      },
    }));
  };

  // 表格列定义
  const columns: ProColumns<DatasetItem>[] = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 100,
      sorter: true,
    },
    {
      title: '状态',
      dataIndex: 'is_enabled',
      key: 'is_enabled',
      width: 80,
      valueType: 'switch',
      sorter: true,
      hideInSearch: true,
      render: (_: any, record: DatasetItem) => (
        <Tooltip title={record.is_enabled ? '已启用' : '已禁用'}>
          <Switch
            checkedChildren={<CheckCircleOutlined />}
            unCheckedChildren={<CloseCircleOutlined />}
            checked={record.is_enabled}
            size="small"
            onChange={(checked) => handleToggleEnabled(record, checked)}
          />
        </Tooltip>
      ),
    },
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 150,
      sorter: true,
      fieldProps: {
        placeholder: '请输入名称',
      },
      formItemProps: {
        rules: [
          {
            required: false,
            message: '请输入名称',
          },
        ],
      },
    },
    // 动态生成的变量列
    ...generateVariableColumns(),
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 120,
      valueType: 'dateTime',
      sorter: true,
      hideInSearch: true,
      editable: false,
    },
    {
      title: '操作',
      valueType: 'option',
      width: '120px',
      fixed: 'right',
      render: (_text, record, _, action) => {
        const isEditing = editableKeys.includes(record.id);
        const isNewRecord = record.id.toString().startsWith('new_');

        if (isEditing) {
          return [
            <span key="editing">编辑中...</span>
          ];
        }

        const actionButtons = [
          <a
            key="edit"
            onClick={() => {
              action?.startEditable?.(record.id);
            }}
          >
            编辑
          </a>,
          <a
            key="copy"
            onClick={() => handleCopyItem(record)}
          >
            复制
          </a>,
        ];

        if (!isNewRecord) {
          actionButtons.push(
            <Popconfirm
              key="delete"
              title="确认删除"
              description="确定要删除这个条目吗？此操作不可恢复。"
              onConfirm={async () => {
                try {
                  await DatasetsAPI.deleteItem(Number(id), Number(record.id));
                  message.success('条目删除成功');
                  refreshData();
                } catch (error) {
                  console.error("删除条目失败:", error);
                  message.error('删除条目失败');
                }
              }}
              okText="删除"
              cancelText="取消"
              okType="danger"
            >
              <a>删除</a>
            </Popconfirm>
          );
        }

        return actionButtons;
      },
    },
  ];

  // 打开编辑数据集模态框
  const handleEditDataset = () => {
    setEditDatasetModalOpen(true);
  };

  // 数据集保存成功后的处理
  const handleDatasetSaved = () => {
    fetchDataset();
  };

  return (
    <div style={{ padding: 12 }}>
      {/* 顶部信息和操作 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div style={{ flex: 1 }}>
          <Button
            icon={<ArrowLeftOutlined />}
            type="link"
            onClick={() => navigate(-1)}
            style={{ marginLeft: -12, marginBottom: 8 }}
          >
            返回
          </Button>
          <Title level={3} style={{ marginTop: 0, marginBottom: 12 }}>{dataset?.name || '数据集详情'}</Title>
          <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
            {dataset?.description && (
              <Text type="secondary">{dataset.description}</Text>
            )}

            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '16px', fontWeight: '500' }}>{enabledCount}/{totalCount}</div>
              <div style={{ fontSize: '12px', color: '#666' }}>启用/总数</div>
            </div>
          </div>
        </div>
        <Space>
          <Button
            icon={<UploadOutlined />}
            onClick={() => setUploadModalOpen(true)}
          >
            批量导入
          </Button>
          <Button
            icon={<EditOutlined />}
            onClick={handleEditDataset}
          >
            编辑信息
          </Button>
        </Space>
      </div>

      <Divider style={{ marginTop: 0, marginBottom: 6 }} />

      {/* 数据集条目表格 */}
      <Card>
        <EditableProTable<DatasetItem>
          actionRef={actionRef}
          loading={loading}
          columns={columns}
          sticky
          request={async (params, sort, _filter) => {
            try {
              // 处理排序
              const sortField = Object.keys(sort || {})[0] || 'created_at';
              const sortOrder = Object.values(sort || {})[0] === 'ascend' ? 'asc' : 'desc';

              console.log('params', params)
              
              // 计算分页参数 - 直接使用前端的当前页和页大小
              const current = params.current || 1;
              const pageSize = params.pageSize || 20;

              const response = await DatasetsAPI.getItems(Number(id), {
                search: params.name || '', // 只搜索name字段
                sort_by: sortField,
                sort_order: sortOrder,
                page: current,
                page_size: pageSize,
              });

              const { data: items, meta } = response.data;

              // 确保每个条目的variables_values是对象
              const processedItems = items.map((item: any) => {
                if (typeof item.variables_values === 'string') {
                  try {
                    item.variables_values = JSON.parse(item.variables_values);
                  } catch (e) {
                    item.variables_values = {};
                  }
                } else if (!item.variables_values) {
                  item.variables_values = {};
                }
                return item;
              });

              console.log('processedItems', processedItems.length, 'total', meta.total)
              return {
                data: processedItems,
                success: true,
                total: meta.total,
              };
            } catch (error) {
              console.error("加载数据失败:", error);
              message.error('加载数据失败');
              return {
                data: [],
                success: false,
                total: 0,
              };
            }
          }}
          rowKey="id"
          pagination={{
            defaultPageSize: 20,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条/总共 ${total} 条`,
            size: 'default',
            showQuickJumper: true,
          }}
          search={{
            span: { xs: 24, sm: 12, md: 8, lg: 6, xl: 6, xxl: 6 },
            labelWidth: 60,
            defaultCollapsed: false,
            searchText: '搜索',
            collapseRender: false,
            layout: 'horizontal',
            optionRender: (_searchConfig, _formProps, dom) => {
              const options = [dom[1]];
              options.push(
                <Button
                  type="default"
                  // icon={<PlusOutlined />}
                  onClick={handleAddNewItem}
                >
                  添加数据
                </Button>
              );
              return options;
            },
          }}
          options={{
            search: false, // 禁用内置搜索，使用自定义搜索
            reload: false,
            setting: false, // 禁用内置设置，使用自定义列设置
            density: false,
          }}
          scroll={{ x: 'max-content', y: 'calc(100vh - 200px)' }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="暂无数据集条目"
              />
            ),
          }}
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
            renderCell: (_checked, _record, _index, originNode) => {
              return originNode;
            },
          }}
          tableAlertRender={false} // 禁用表格上方的选择提示
          toolBarRender={() => {
            const toolbar = [];
            if (selectedRowKeys.length > 0) {
              toolbar.push(
                <Space key="batch-actions">
                  <span style={{ color: '#666' }}>已选择 {selectedRowKeys.length} 项</span>
                  <Popconfirm
                    title="确认批量删除"
                    description={`确定要删除选中的 ${selectedRowKeys.length} 个条目吗？`}
                    onConfirm={handleBatchDelete}
                    okText="删除"
                    cancelText="取消"
                    okType="danger"
                  >
                    <Button danger size="small">
                      批量删除
                    </Button>
                  </Popconfirm>
                  <Button size="small" onClick={() => setSelectedRowKeys([])}>
                    取消选择
                  </Button>
                </Space>
              );
            }
            return toolbar;
          }}
          editable={{
            type: 'multiple',
            editableKeys,
            onChange: setEditableKeys,
            actionRender: (_record: any, _config: any, defaultDoms: any) => {
              return [
                defaultDoms.save,
                defaultDoms.cancel,
              ]
            },
            onSave: async (key, record: any) => {
              try {
                // 'variables_values.'开头的 key对于的值， 放到variables_values对象里
                for (const key in record) {
                  if (Object.prototype.hasOwnProperty.call(record, key)) {
                    if (key.startsWith('variables_values.')) {
                      const subKey = key.split('.')[1];
                      record.variables_values[subKey] = record[key];
                      // 删除原属性
                      delete record[key];
                    }
                  }
                }

                if (record.id && !record.id.toString().startsWith('new_')) {
                  // 更新现有条目
                  await DatasetsAPI.updateItem(Number(id), Number(record.id), {
                    name: record.name,
                    variables_values: record.variables_values,
                    is_enabled: record.is_enabled,
                  });
                  message.success('条目更新成功');
                } else {
                  // 创建新条目
                  await DatasetsAPI.createItem(Number(id), {
                    name: record.name,
                    variables_values: record.variables_values,
                    is_enabled: record.is_enabled,
                  });
                  message.success('条目创建成功');
                }

                // 移除编辑状态
                setEditableKeys(editableKeys.filter(k => k !== key));
                refreshData();
                return true;
              } catch (error) {
                console.error("保存失败:", error);
                message.error('保存失败，请重试');
                return false;
              }
            },
            onCancel: async (key) => {
              console.log('oncancel', key)
              // 如果是新记录，从editableKeys中移除
              if (key.toString().startsWith('new_')) {
                setEditableKeys(editableKeys.filter(k => k !== key));
              }
              return true;
            },
          }}
          recordCreatorProps={false} // 禁用底部添加按钮
        />
      </Card>

      {/* 编辑数据集模态框 */}
      {editDatasetModalOpen && (
        <EditDatasetModal
          open={editDatasetModalOpen}
          onClose={() => setEditDatasetModalOpen(false)}
          datasetId={id}
          onSaved={handleDatasetSaved}
        />
      )}

      {/* 上传数据集弹窗 */}
      {uploadModalOpen && dataset && (
        <UploadDatasetWizard
          open={uploadModalOpen}
          onClose={() => setUploadModalOpen(false)}
          datasetId={id}
          variables={dataset.variables || []}
          onUploaded={refreshData}
        />
      )}
    </div>
  )
} 