import React, { useState } from 'react';
import {
    Modal,
    Button,
    Input,
    Typography,
    Space,
    Alert,
    message
} from 'antd';
import { 
    ImportOutlined,
    CheckCircleOutlined,
    ExclamationCircleOutlined 
} from '@ant-design/icons';

import { type TestCase } from '@/types/prompt';

const { TextArea } = Input;
const { Text } = Typography;

interface JsonImportModalProps {
    visible: boolean;
    onClose: () => void;
    onImport: (testCase: TestCase) => void;
    variables: string[];
}

export function JsonImportModal({ 
    visible, 
    onClose, 
    onImport, 
    variables 
}: JsonImportModalProps) {
    
    const [jsonInput, setJsonInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [validationError, setValidationError] = useState<string | null>(null);
    const [parsedData, setParsedData] = useState<any>(null);
    const [unmatchedVariables, setUnmatchedVariables] = useState<string[]>([]);

    const validateAndParseJson = (jsonText: string) => {
        setValidationError(null);
        setUnmatchedVariables([]);
        setParsedData(null);

        if (!jsonText.trim()) {
            return false;
        }

        try {
            const parsed = JSON.parse(jsonText);
            
            // 检查是否为对象
            if (typeof parsed !== 'object' || Array.isArray(parsed) || parsed === null) {
                setValidationError('JSON格式不正确，请检查语法');
                return false;
            }

            // 检查是否包含数据
            const keys = Object.keys(parsed);
            if (keys.length === 0) {
                setValidationError('JSON数据为空或不包含有效变量');
                return false;
            }

            // 检查变量匹配
            const unmatched = keys.filter(key => !variables.includes(key));
            if (unmatched.length > 0) {
                setUnmatchedVariables(unmatched);
            }

            setParsedData(parsed);
            return true;
        } catch (error) {
            setValidationError('JSON格式不正确，请检查语法');
            return false;
        }
    };

    const handleJsonChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const value = e.target.value;
        setJsonInput(value);
        
        if (value.trim()) {
            validateAndParseJson(value);
        } else {
            setValidationError(null);
            setParsedData(null);
            setUnmatchedVariables([]);
        }
    };

    const handleImport = async () => {
        if (!parsedData) {
            return;
        }

        setLoading(true);
        try {
            // 创建测试用例对象，只包含匹配的变量
            const testCase: TestCase = {};
            
            // 为所有当前变量设置值
            variables.forEach(variable => {
                const value = parsedData[variable];
                if (value !== undefined) {
                    // 如果是对象或数组，转换为JSON字符串
                    if (typeof value === 'object' && value !== null) {
                        testCase[variable] = JSON.stringify(value, null, 2);
                    } else {
                        // 其他类型转换为字符串
                        testCase[variable] = String(value);
                    }
                } else {
                    testCase[variable] = '';
                }
            });

            // 添加元数据
            testCase.metadatas = {
                source: 'manual',
                type: 'normal',
                generatedAt: new Date().toISOString()
            };

            onImport(testCase);
            message.success('JSON测试用例导入成功');
            handleClose();
        } catch (error) {
            message.error('导入失败，请检查JSON格式');
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setJsonInput('');
        setValidationError(null);
        setParsedData(null);
        setUnmatchedVariables([]);
        onClose();
    };

    const isValid = parsedData && !validationError;

    return (
        <Modal
            title={
                <Space>
                    <ImportOutlined />
                    {'通过JSON导入测试用例'}
                </Space>
            }
            open={visible}
            onCancel={handleClose}
            width={600}
            footer={[
                <Button key="cancel" onClick={handleClose}>
                    {'取消'}
                </Button>,
                <Button
                    key="import"
                    type="primary"
                    icon={<CheckCircleOutlined />}
                    loading={loading}
                    disabled={!isValid}
                    onClick={handleImport}
                >
                    {'确定'}
                </Button>
            ]}
        >
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
                <Text type="secondary">
                    {'输入JSON格式的测试数据，键为变量名，值为变量值'}
                </Text>

                <div>
                    <Text strong style={{ marginBottom: 8, display: 'block' }}>
                        {'JSON数据：'}
                    </Text>
                    <TextArea
                        value={jsonInput}
                        onChange={handleJsonChange}
                        placeholder={`请输入JSON格式的数据，例如：
{
  "变量1": "值1",
  "变量2": "值2"
} `}
                        rows={8}
                        style={{ fontFamily: 'monospace' }}
                    />
                </div>

                {/* 验证错误提示 */}
                {validationError && (
                    <Alert
                        type="error"
                        icon={<ExclamationCircleOutlined />}
                        message={validationError}
                        showIcon
                    />
                )}

                {/* 不匹配变量警告 */}
                {unmatchedVariables.length > 0 && (
                    <Alert
                        type="warning"
                        icon={<ExclamationCircleOutlined />}
                        message={`以下变量在当前提示词中不存在：${unmatchedVariables.join(', ')}`}
                        description={'这些变量将被忽略，只会导入匹配的变量。'}
                        showIcon
                    />
                )}

                {/* 成功解析提示 */}
                {isValid && (
                    <Alert
                        type="success"
                        icon={<CheckCircleOutlined />}
                        message={`已解析 ${parsedData.length} 个变量，其中 ${variables.length} 个匹配当前提示词变量。`}
                        showIcon
                    />
                )}

                {/* 当前变量提示 */}
                {variables.length > 0 && (
                    <div>
                        <Text strong style={{ marginBottom: 4, display: 'block' }}>
                            {'当前提示词变量：'}
                        </Text>
                        <Text code style={{ fontSize: '12px' }}>
                            {variables.join(', ')}
                        </Text>
                    </div>
                )}
            </Space>
        </Modal>
    );
}
