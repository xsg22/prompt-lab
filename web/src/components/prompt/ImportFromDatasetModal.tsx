import React, { useState, useEffect } from 'react';
import {
    Modal,
    Button,
    Form,
    Select,
    Table,
    Checkbox,
    Typography,
    Alert,
    Divider,
    message
} from 'antd';
import {
    EditOutlined as EditIcon
} from '@ant-design/icons';

import { DatasetsAPI } from '@/lib/api';
import type { Dataset, DatasetItem } from '@/types/datasets';
import type { TestCase } from '@/types/prompt';

const { Option } = Select;
const { Text } = Typography;

interface ImportFromDatasetModalProps {
    visible: boolean;
    onClose: () => void;
    onImportSuccess: (testCases: TestCase[]) => void;
    variables: string[];
    projectId: number;
}

const ImportFromDatasetModal: React.FC<ImportFromDatasetModalProps> = ({
    visible,
    onClose,
    onImportSuccess,
    variables,
    projectId
}) => {
    
    const [datasets, setDatasets] = useState<Dataset[]>([]);
    const [selectedImportDatasetId, setSelectedImportDatasetId] = useState<number>(0);
    const [datasetItems, setDatasetItems] = useState<DatasetItem[]>([]);
    const [selectedItemIds, setSelectedItemIds] = useState<number[]>([]);
    const [loadingItems, setLoadingItems] = useState(false);
    const [importDatasetSearchValue, setImportDatasetSearchValue] = useState('');
    const [isImportingFromDataset, setIsImportingFromDataset] = useState(false);
    const [variableMappings, setVariableMappings] = useState<Record<string, string>>({});
    const [editingMappings, setEditingMappings] = useState(false);

    // 加载数据集
    const loadDatasets = async () => {
        try {
            const response = await DatasetsAPI.getAllDatasets(projectId);
            setDatasets(response.data);
        } catch (error: any) {
            console.error('操作失败', error);
            message.error('加载数据集列表失败');
        }
    };

    useEffect(() => {
        if (visible) {
            loadDatasets();
        }
    }, [visible, projectId]);

    const handleClose = () => {
        setImportDatasetSearchValue('');
        setSelectedImportDatasetId(0);
        setDatasetItems([]);
        setSelectedItemIds([]);
        setVariableMappings({});
        setEditingMappings(false);
        onClose();
    };

    // 加载数据集项
    const loadDatasetItems = async (datasetId: number) => {
        setLoadingItems(true);
        try {
            const response = await DatasetsAPI.getItems(datasetId, {
                enabled_only: true,
                page: 1,
                page_size: 50
            });
            setDatasetItems(response.data.data || []);
            
            // 自动生成变量映射
            generateDefaultMappings(response.data.data || []);
        } catch (error: any) {
            console.error('操作失败', error);
            message.error('加载数据集项失败');
            setDatasetItems([]);
        } finally {
            setLoadingItems(false);
        }
    };

    // 生成默认变量映射
    const generateDefaultMappings = (items: DatasetItem[]) => {
        if (items.length === 0) return;
        
        const datasetVariables = new Set<string>();
        items.forEach(item => {
            if (item.variables_values) {
                Object.keys(item.variables_values).forEach(key => datasetVariables.add(key));
            }
        });
        
        const mappings: Record<string, string> = {};
        const datasetVarArray = Array.from(datasetVariables);
        
        // 尝试智能匹配变量名
        variables.forEach(promptVar => {
            // 完全匹配
            if (datasetVarArray.includes(promptVar)) {
                mappings[promptVar] = promptVar;
            } else {
                // 模糊匹配（小写、去除下划线等）
                const normalizedPromptVar = promptVar.toLowerCase().replace(/[_-]/g, '');
                const matchedVar = datasetVarArray.find(datasetVar => 
                    datasetVar.toLowerCase().replace(/[_-]/g, '') === normalizedPromptVar
                );
                if (matchedVar) {
                    mappings[promptVar] = matchedVar;
                } else {
                    // 如果没有匹配，默认使用第一个数据集变量（如果存在）
                    mappings[promptVar] = datasetVarArray[0] || '';
                }
            }
        });
        
        setVariableMappings(mappings);
    };

    // 处理数据集选择
    const handleImportDatasetChange = (datasetId: number) => {
        setSelectedImportDatasetId(datasetId);
        if (datasetId) {
            loadDatasetItems(datasetId);
        } else {
            setDatasetItems([]);
            setSelectedItemIds([]);
            setVariableMappings({});
        }
    };

    // 处理数据项选择
    const handleItemSelection = (itemId: number, checked: boolean) => {
        if (checked) {
            if (selectedItemIds.length >= 10) {
                message.warning('最多只能选择10条数据项');
                return;
            }
            setSelectedItemIds([...selectedItemIds, itemId]);
        } else {
            setSelectedItemIds(selectedItemIds.filter(id => id !== itemId));
        }
    };

    // 全选/取消全选
    const handleSelectAllItems = (checked: boolean) => {
        if (checked) {
            const maxSelection = Math.min(datasetItems.length, 10);
            setSelectedItemIds(datasetItems.slice(0, maxSelection).map(item => Number(item.id)));
        } else {
            setSelectedItemIds([]);
        }
    };

    // 处理变量映射变更
    const handleMappingChange = (promptVar: string, datasetVar: string) => {
        setVariableMappings(prev => ({
            ...prev,
            [promptVar]: datasetVar
        }));
    };

    // 执行从数据集导入测试用例
    const handleImportFromDataset = async () => {
        if (selectedItemIds.length === 0) {
            message.warning('请选择要导入的数据项');
            return;
        }

        // 检查变量映射是否完整
        const missingMappings = variables.filter(v => !variableMappings[v]);
        if (missingMappings.length > 0) {
            message.warning(`请为以下变量配置映射关系：${missingMappings.join(', ')}`);
            return;
        }

        setIsImportingFromDataset(true);

        try {
            const selectedItems = datasetItems.filter(item => selectedItemIds.includes(Number(item.id)));
            
            const newTestCases: TestCase[] = selectedItems.map(item => {
                const newCase: TestCase = {
                    metadatas: {
                        source: 'manual' as const,
                        type: 'normal' as const,
                        generatedAt: new Date().toISOString()
                    }
                };

                // 根据映射关系转换变量值
                variables.forEach(promptVar => {
                    const datasetVar = variableMappings[promptVar];
                    if (datasetVar && item.variables_values?.[datasetVar] !== undefined) {
                        newCase[promptVar] = item.variables_values[datasetVar];
                    } else {
                        newCase[promptVar] = '';
                    }
                });

                return newCase;
            });

            message.success(`成功导入 ${selectedItemIds.length} 条测试用例`);
            onImportSuccess(newTestCases);
            handleClose();
        } catch (error: any) {
            console.error('操作失败', error);
            message.error('导入测试用例失败，请重试');
        } finally {
            setIsImportingFromDataset(false);
        }
    };

    // 获取所有数据集变量列
    const getImportVariableColumns = () => {
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

    return (
        <Modal
            title={'从数据集导入测试用例'}
            open={visible}
            onCancel={handleClose}
            width={800}
            footer={[
                <Button key="cancel" onClick={handleClose}>
                    {'取消'}
                </Button>,
                <Button 
                    key="import" 
                    type="primary" 
                    loading={isImportingFromDataset}
                    onClick={handleImportFromDataset}
                    disabled={selectedItemIds.length === 0}
                >
                    {`导入 (${selectedItemIds.length} 条)`}
                </Button>
            ]}
        >
            <Form layout="vertical">
                <Form.Item label={'选择数据集'} required>
                    <Select 
                        placeholder={'请选择数据集'} 
                        value={selectedImportDatasetId || undefined}
                        onChange={handleImportDatasetChange}
                        showSearch
                        searchValue={importDatasetSearchValue}
                        onSearch={setImportDatasetSearchValue}
                        filterOption={(input, option) =>
                            (option?.children as unknown as string)?.toLowerCase().includes(input.toLowerCase())
                        }
                        onSelect={() => setImportDatasetSearchValue('')}
                    >
                        {datasets.map(dataset => (
                            <Option key={dataset.id} value={Number(dataset.id)}>
                                {dataset.name}
                            </Option>
                        ))}
                    </Select>
                </Form.Item>

                {/* 变量映射信息显示和编辑 - 优化样式 */}
                {selectedImportDatasetId > 0 && variables.length > 0 && Object.keys(variableMappings).length > 0 && (
                    <Form.Item label={'变量映射关系'}>
                        <div style={{ 
                            padding: '16px', 
                            background: '#f0f8ff', 
                            border: '1px solid #91d5ff', 
                            borderRadius: '8px'
                        }}>
                            <div style={{ 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                alignItems: 'center', 
                                marginBottom: '12px' 
                            }}>
                                <div style={{ fontSize: '16px', fontWeight: 600, color: '#1890ff' }}>
                                    {'🔄 变量映射关系'}
                                </div>
                                <Button 
                                    type="link" 
                                    size="small"
                                    icon={<EditIcon />}
                                    onClick={() => setEditingMappings(!editingMappings)}
                                    style={{ fontSize: '14px' }}
                                >
                                    {editingMappings ? '完成编辑' : '编辑映射'}
                                </Button>
                            </div>
                            <div style={{ fontSize: '14px', color: '#666', marginBottom: '12px' }}>
                                {'将数据集变量（左侧）映射到提示词变量（右侧）：'}
                            </div>
                            <div style={{ 
                                display: 'grid', 
                                gap: '8px',
                                gridTemplateColumns: '1fr'
                            }}>
                                {Object.entries(variableMappings).map(([promptVar, datasetVar]) => (
                                    <div key={promptVar} style={{ 
                                        fontSize: '14px', // 增大字体
                                        padding: '12px', // 增加内边距
                                        background: '#ffffff', 
                                        border: '1px solid #e0e0e0', 
                                        borderRadius: '6px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center', // 居中对齐
                                        gap: '12px' // 控制间距
                                    }}>
                                        {editingMappings ? (
                                            <Select
                                                size="small"
                                                style={{ minWidth: 140 }}
                                                value={datasetVar}
                                                onChange={(value) => handleMappingChange(promptVar, value)}
                                                placeholder={'选择数据集变量'}
                                            >
                                                {datasetItems.length > 0 && (() => {
                                                    const allVars = new Set<string>();
                                                    datasetItems.forEach(item => {
                                                        if (item.variables_values) {
                                                            Object.keys(item.variables_values).forEach(key => allVars.add(key));
                                                        }
                                                    });
                                                    return Array.from(allVars).map(varName => (
                                                        <Option key={varName} value={varName}>
                                                            {varName}
                                                        </Option>
                                                    ));
                                                })()}
                                            </Select>
                                        ) : (
                                            <span style={{ 
                                                color: '#52c41a', 
                                                fontWeight: 600,
                                                fontSize: '15px' // 稍微增大数据集变量字体
                                            }}>
                                                {datasetVar}
                                            </span>
                                        )}
                                        <span style={{ 
                                            color: '#999', 
                                            fontSize: '16px',
                                            fontWeight: 'bold'
                                        }}>→</span>
                                        <span style={{ 
                                            color: '#1890ff', 
                                            fontWeight: 600,
                                            fontSize: '15px' // 稍微增大提示词变量字体
                                        }}>
                                            {promptVar}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </Form.Item>
                )}

                {selectedImportDatasetId > 0 && (
                    <>
                        <Divider />
                        <div style={{ marginBottom: 16 }}>
                            <Text strong>{'数据项选择'}</Text>
                            <Alert
                                type="info"
                                message={'选择要导入的数据项（最多10条）。表格支持左右滑动查看所有变量列。'}
                                style={{ marginTop: 8, marginBottom: 16 }}
                                showIcon
                            />
                        </div>

                        <Table
                            columns={[
                                {
                                    title: () => (
                                        <Checkbox
                                            checked={selectedItemIds.length === Math.min(datasetItems.length, 10) && datasetItems.length > 0}
                                            indeterminate={selectedItemIds.length > 0 && selectedItemIds.length < Math.min(datasetItems.length, 10)}
                                            onChange={(e: any) => handleSelectAllItems(e.target.checked)}
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
                                            onChange={(e: any) => handleItemSelection(Number(record.id), e.target.checked)}
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
                                ...getImportVariableColumns()
                            ]}
                            dataSource={datasetItems}
                            rowKey="id"
                            loading={loadingItems}
                            pagination={false}
                            size="small"
                            scroll={{ x: 'max-content', y: 300 }}
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

export default ImportFromDatasetModal;
