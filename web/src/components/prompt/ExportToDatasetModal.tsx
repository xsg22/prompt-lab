import React, { useState, useEffect } from 'react';
import {
    Modal,
    Button,
    Input,
    List,
    Avatar,
    Typography,
    Form,
    message
} from 'antd';
import {
    SearchOutlined,
    DatabaseOutlined,
    PlusOutlined
} from '@ant-design/icons';

import { DatasetsAPI } from '@/lib/api';
import type { Dataset } from '@/types/datasets';
import type { TestCase } from '@/types/prompt';

const { Text } = Typography;

interface ExportToDatasetModalProps {
    visible: boolean;
    onClose: () => void;
    testCases: TestCase[];
    variables: string[];
    projectId: number;
}

const ExportToDatasetModal: React.FC<ExportToDatasetModalProps> = ({
    visible,
    onClose,
    testCases,
    variables,
    projectId
}) => {
    
    const [datasetSearchValue, setDatasetSearchValue] = useState('');
    const [datasets, setDatasets] = useState<Dataset[]>([]);
    const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(null);
    const [isCreatingNewDataset, setIsCreatingNewDataset] = useState(false);
    const [newDatasetForm] = Form.useForm();
    const [isImporting, setIsImporting] = useState(false);

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
        setDatasetSearchValue('');
        setSelectedDatasetId(null);
        setIsCreatingNewDataset(false);
        newDatasetForm.resetFields();
        onClose();
    };

    const handleImportToDataset = async () => {
        if (!selectedDatasetId && !isCreatingNewDataset) {
            message.warning('请选择数据集或创建新数据集');
            return;
        }

        setIsImporting(true);

        try {
            if (isCreatingNewDataset) {
                await newDatasetForm.validateFields();
                const values = newDatasetForm.getFieldsValue();

                const createResponse = await DatasetsAPI.createDataset({
                    name: values.name,
                    description: values.description || '',
                    project_id: projectId,
                    variables: variables
                });

                await DatasetsAPI.importTestCases(createResponse.data.id, testCases.map(tc => ({
                    ...tc,
                    status: 1
                })));

                message.success(`已成功创建数据集 "${values.name}" 并导入${testCases.length}个测试用例`);
            } else if (selectedDatasetId) {
                await DatasetsAPI.importTestCases(selectedDatasetId, testCases.map(tc => ({
                    ...tc,
                    status: 1
                })));

                const selectedDataset = datasets.find(d => d.id === selectedDatasetId);
                message.success(`已成功导入${testCases.length}个测试用例到数据集 "${selectedDataset?.name}"`);
            }

            handleClose();
        } catch (error: any) {
            console.error('操作失败', error);
            if (error.response?.data?.detail) {
                message.error(`导入失败: ${error.response?.data?.detail}`);
            } else {
                message.error('导入测试用例失败，请重试');
            }
        } finally {
            setIsImporting(false);
        }
    };

    // 过滤搜索数据集
    const filteredDatasets = datasetSearchValue
        ? datasets.filter(d =>
            d.name.toLowerCase().includes(datasetSearchValue.toLowerCase()))
        : datasets;

    return (
        <Modal
            title={'导出到数据集'}
            open={visible}
            onCancel={handleClose}
            footer={[
                <Button key="cancel" onClick={handleClose}>
                    {'取消'}
                </Button>,
                <Button
                    key="import"
                    type="primary"
                    onClick={handleImportToDataset}
                    loading={isImporting}
                    disabled={!selectedDatasetId && !isCreatingNewDataset}
                >
                    {'导入'}
                </Button>
            ]}
            width={600}
        >
            <div style={{ marginBottom: 16 }}>
                <Input
                    placeholder={'搜索数据集'}
                    value={datasetSearchValue}
                    onChange={(e) => setDatasetSearchValue(e.target.value)}
                    prefix={<SearchOutlined />}
                    allowClear
                />
            </div>

            {!isCreatingNewDataset && (
                <div>
                    <div style={{ marginBottom: 8 }}>
                        <Text strong>{'选择现有数据集：'}</Text>
                    </div>

                    <List
                        style={{ 
                            maxHeight: 300, 
                            overflow: 'auto', 
                            marginBottom: 16, 
                            border: '1px solid #f0f0f0', 
                            borderRadius: 4 
                        }}
                        size="small"
                        dataSource={filteredDatasets}
                        renderItem={dataset => (
                            <List.Item
                                key={dataset.id}
                                onClick={() => setSelectedDatasetId(dataset.id)}
                                style={{
                                    cursor: 'pointer',
                                    background: selectedDatasetId === dataset.id ? '#e6f7ff' : undefined,
                                    padding: '8px 16px'
                                }}
                            >
                                <List.Item.Meta
                                    avatar={<Avatar icon={<DatabaseOutlined />} />}
                                    title={dataset.name}
                                    description={
                                        <div>
                                            <Text type="secondary" style={{ fontSize: 12 }}>
                                                {dataset.description || '无描述'}
                                            </Text>
                                            <div style={{ marginTop: 4 }}>
                                                <Text type="secondary" style={{ fontSize: 12 }}>
                                                    {dataset.variables && dataset.variables.length > 0 ? `变量: ${dataset.variables.join(', ')}` : '无变量'}
                                                </Text>
                                            </div>
                                        </div>
                                    }
                                />
                            </List.Item>
                        )}
                        locale={{ emptyText: '暂无数据集，请创建新数据集' }}
                    />

                    <div style={{ textAlign: 'center', marginBottom: 16 }}>
                        <Button
                            type="dashed"
                            icon={<PlusOutlined />}
                            onClick={() => {
                                setIsCreatingNewDataset(true);
                                setSelectedDatasetId(null);
                            }}
                        >
                            {'创建新数据集'}
                        </Button>
                    </div>
                </div>
            )}

            {isCreatingNewDataset && (
                <div>
                    <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        marginBottom: 16 
                    }}>
                        <Text strong>{'创建新数据集：'}</Text>
                        <Button
                            type="link"
                            onClick={() => {
                                setIsCreatingNewDataset(false);
                                newDatasetForm.resetFields();
                            }}
                        >
                            {'返回选择'}
                        </Button>
                    </div>

                    <Form
                        form={newDatasetForm}
                        layout="vertical"
                    >
                        <Form.Item
                            name="name"
                            label={'数据集名称'}
                            rules={[{ required: true, message: '请输入数据集名称' }]}
                        >
                            <Input placeholder={'输入数据集名称'} />
                        </Form.Item>

                        <Form.Item
                            name="description"
                            label={'描述'}
                        >
                            <Input.TextArea
                                placeholder={'数据集描述（可选）'}
                                rows={3}
                            />
                        </Form.Item>

                        <div style={{ marginBottom: 16 }}>
                            <Text type="secondary">
                                {`注：数据集将使用当前提示词模板的变量(${variables.join(', ')})`}
                            </Text>
                        </div>
                    </Form>
                </div>
            )}
        </Modal>
    );
};

export default ExportToDatasetModal;
