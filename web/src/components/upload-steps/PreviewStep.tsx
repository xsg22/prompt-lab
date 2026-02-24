import { useEffect, useState } from 'react'

import { Button, Space, Typography, Table, Alert, Tag, Spin, Switch, message } from 'antd'
import { CheckCircleOutlined, CloseCircleOutlined, WarningOutlined, InfoCircleOutlined } from '@ant-design/icons'
import { useUploadContext } from '../UploadDatasetWizard'
import { DatasetsAPI } from '@/lib/api'

const { Text, Title } = Typography

interface PreviewStepProps {
  datasetId: string
  variables: string[]
}

interface PreviewData {
  is_valid: boolean
  total_rows: number
  valid_rows: number
  invalid_rows: number
  headers: string[]
  preview_data: any[]
  errors: any[]
  missing_columns: string[]
  extra_columns: string[]
}

export default function PreviewStep({ datasetId }: PreviewStepProps) {
  const { state, setState, nextStep, prevStep } = useUploadContext()
  const [loading, setLoading] = useState(false)
  const [previewData, setPreviewData] = useState<PreviewData | null>(null)
  const [skipInvalidRows, setSkipInvalidRows] = useState(true)

  // 组件加载时自动预览
  useEffect(() => {
    if (state.fileContent && !previewData) {
      handlePreview()
    }
  }, [state.fileContent])

  // 预览文件内容
  const handlePreview = async () => {
    if (!state.fileContent || !state.file) return

    setLoading(true)
    try {
      const response = await DatasetsAPI.previewUpload(Number(datasetId), {
        file_content: state.fileContent,
        file_name: state.file.name
      })

      setPreviewData(response.data)
      setState(prev => ({
        ...prev,
        previewData: response.data
      }))
    } catch (error: any) {
      message.error(`${'预览失败'}: ${error.response?.data?.detail || error.message}`)
    } finally {
      setLoading(false)
    }
  }

  // 开始上传
  const handleStartUpload = async () => {
    if (!state.fileContent || !state.file || !previewData) return

    setState(prev => ({
      ...prev,
      isUploading: true
    }))

    try {
      const response = await DatasetsAPI.startUpload(Number(datasetId), {
        file_content: state.fileContent,
        file_name: state.file.name,
        skip_invalid_rows: skipInvalidRows
      })

      setState(prev => ({
        ...prev,
        uploadTask: response.data
      }))

      nextStep()
    } catch (error: any) {
      message.error(`${'上传启动失败'}: ${error.response?.data?.detail || error.message}`)
      setState(prev => ({
        ...prev,
        isUploading: false
      }))
    }
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 50 }}>
        <Spin size="large" />
        <div style={{ marginTop: 16 }}>
          <Text>{'正在分析文件内容...'}</Text>
        </div>
      </div>
    )
  }

  if (!previewData) {
    return (
      <div style={{ textAlign: 'center', padding: 50 }}>
        <Button type="primary" onClick={handlePreview}>
          {'开始预览'}
        </Button>
      </div>
    )
  }

  // 表格列定义
  const columns = previewData.headers.map(header => ({
    title: header,
    dataIndex: header,
    key: header,
    width: 150,
    ellipsis: true,
    render: (text: any) => (
      <span title={text}>{text || '(空)'}</span>
    )
  }))

  return (
    <div>
      <Title level={4}>{'数据预览与验证'}</Title>

      {/* 验证结果概览 */}
      <div style={{ marginBottom: 24 }}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          {/* 整体状态 */}
          <Alert
            type={previewData.is_valid ? 'success' : 'warning'}
            icon={previewData.is_valid ? <CheckCircleOutlined /> : <WarningOutlined />}
            message={
              previewData.is_valid
                ? '文件验证通过，可以开始上传'
                : '文件存在问题，请检查后再上传'
            }
            showIcon
          />

          {/* 统计信息 */}
          <div style={{ display: 'flex', gap: 16 }}>
            <Tag icon={<InfoCircleOutlined />} color="blue">
              {'总行数'}: {previewData.total_rows}
            </Tag>
            <Tag icon={<CheckCircleOutlined />} color="green">
              {'有效行数'}: {previewData.valid_rows}
            </Tag>
            {previewData.invalid_rows > 0 && (
              <Tag icon={<CloseCircleOutlined />} color="red">
                {'无效行数'}: {previewData.invalid_rows}
              </Tag>
            )}
          </div>
        </Space>
      </div>

      {/* 字段检查结果 */}
      {(previewData.missing_columns.length > 0 || previewData.extra_columns.length > 0) && (
        <div style={{ marginBottom: 24 }}>
          {previewData.missing_columns.length > 0 && (
            <Alert
              type="error"
              message={'缺少必需字段'}
              description={
                <div>
                  <Text>{'以下字段是必需的但在文件中未找到：'}</Text>
                  <div style={{ marginTop: 8 }}>
                    {previewData.missing_columns.map(col => (
                      <Tag color="red" key={col}>{col}</Tag>
                    ))}
                  </div>
                </div>
              }
              style={{ marginBottom: 8 }}
            />
          )}
          
          {previewData.extra_columns.length > 0 && (
            <Alert
              type="info"
              message={'额外字段'}
              description={
                <div>
                  <Text>{'文件中包含以下额外字段（将被忽略；编辑数据集时可以添加这些字段）：'}</Text>
                  <div style={{ marginTop: 8 }}>
                    {previewData.extra_columns.map(col => (
                      <Tag color="blue" key={col}>{col}</Tag>
                    ))}
                  </div>
                </div>
              }
            />
          )}
        </div>
      )}

      {/* 错误列表 */}
      {previewData.errors.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <Alert
            type="warning"
            message={`发现 ${previewData.errors.length} 个数据错误`}
            description={
              <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                {previewData.errors.slice(0, 10).map((error, index) => (
                  <div key={index} style={{ marginBottom: 4 }}>
                    <Text type="danger">{`第${error.row_number}行: `} </Text>
                    <Text>{error.error_message}</Text>
                  </div>
                ))}
                {previewData.errors.length > 10 && (
                  <Text type="secondary">{`... 还有 ${previewData.errors.length - 10} 个错误`}</Text>
                )}
              </div>
            }
          />
        </div>
      )}

      {/* 数据预览表格 */}
      <div style={{ marginBottom: 24 }}>
        <Title level={5}>{'数据预览（前10行）'}</Title>
        <Table
          size="small"
          columns={columns}
          dataSource={previewData.preview_data.map((row, index) => ({
            ...row,
            key: index
          }))}
          pagination={false}
          scroll={{ x: 800 }}
          bordered
        />
      </div>

      {/* 上传选项 */}
      {previewData.invalid_rows > 0 && (
        <div style={{ marginBottom: 24, padding: 16, backgroundColor: '#f5f5f5', borderRadius: 6 }}>
          <Space align="center">
            <Text strong>{'上传选项：'}</Text>
            <Switch
              checked={skipInvalidRows}
              onChange={setSkipInvalidRows}
              checkedChildren={'跳过无效行'}
              unCheckedChildren={'停止上传'}
            />
            <Text type="secondary">
              {skipInvalidRows 
                ? `将跳过 ${previewData.invalid_rows} 个无效行，上传 ${previewData.valid_rows} 个有效行`
                : '遇到无效行时停止上传，请先修复数据问题'
              }
            </Text>
          </Space>
        </div>
      )}

      {/* 操作按钮 */}
      <div style={{ textAlign: 'right' }}>
        <Space>
          <Button onClick={prevStep}>
            {'上一步'}
          </Button>
          <Button 
            type="primary" 
            onClick={handleStartUpload}
            disabled={previewData.missing_columns.length > 0 || (!skipInvalidRows && previewData.invalid_rows > 0)}
            loading={state.isUploading}
          >
            {'开始上传'}
          </Button>
        </Space>
      </div>
    </div>
  )
} 