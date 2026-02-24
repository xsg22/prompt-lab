import { useEffect, useState } from 'react'

import { Result, Button, Space, Typography, Table, Alert, Collapse, Tag, message } from 'antd'
import { CheckCircleOutlined, CloseCircleOutlined, WarningOutlined, DownloadOutlined, RedoOutlined } from '@ant-design/icons'
import { useUploadContext } from '../UploadDatasetWizard'
import { DatasetsAPI } from '@/lib/api'

const { Text, Title } = Typography
const { Panel } = Collapse

interface ResultStepProps {
  onUploaded: () => void
}

interface UploadResult {
  task: {
    id: number
    status: 'completed' | 'failed'
    total_rows: number
    success_rows: number
    failed_rows: number
    file_name: string
    created_at: string
    completed_at?: string
  }
  errors: Array<{
    id: number
    row_number: number
    error_type: string
    error_message: string
    row_data: any
  }>
  success_rate: number
  has_errors: boolean
}

export default function ResultStep({ onUploaded }: ResultStepProps) {
  const { state, resetWizard } = useUploadContext()
  const [result, setResult] = useState<UploadResult | null>(null)
  const [, setLoading] = useState(false)
  const [retrying, setRetrying] = useState(false)

  // 获取上传结果
  const fetchUploadResult = async () => {
    if (!state.uploadTask?.task_id) return

    setLoading(true)
    try {
      const response = await DatasetsAPI.getUploadResult(state.uploadTask.task_id)
      setResult(response.data)
    } catch (error: any) {
      console.error('获取上传结果失败', error)
      message.error('获取上传结果失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (state.uploadTask?.task_id) {
      fetchUploadResult()
    }
  }, [state.uploadTask])

  // 重试失败的行
  const handleRetry = async () => {
    if (!state.uploadTask?.task_id || !result) return

    setRetrying(true)
    try {
      await DatasetsAPI.retryUpload({
        task_id: state.uploadTask.task_id,
        retry_failed_only: true
      })

      message.success('重试任务已创建，请稍后查看结果')
      // 可以选择重新开始向导流程或者关闭
      resetWizard()
    } catch (error: any) {
      message.error(`${'重试失败'}: ${error.response?.data?.detail || error.message}`)
    } finally {
      setRetrying(false)
    }
  }

  // 下载错误报告
  const downloadErrorReport = () => {
    if (!result?.errors.length) return

    const csvHeaders = ['行号', '错误类型', '错误信息', '原始数据']
    const csvRows = result.errors.map(error => [
      error.row_number,
      error.error_type,
      error.error_message,
      JSON.stringify(error.row_data)
    ])

    const csvContent = [
      csvHeaders.join(','),
      ...csvRows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `upload_errors_${state.uploadTask?.task_id}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    message.success('错误报告下载成功')
  }

  // 完成并关闭
  const handleFinish = () => {
    onUploaded() // 刷新数据集列表
    resetWizard()
  }

  if (!result) {
    return (
      <div style={{ textAlign: 'center', padding: 50 }}>
        <Text>{'正在获取上传结果...'}</Text>
      </div>
    )
  }

  const isSuccess = result.task.status === 'completed' && result.task.failed_rows === 0
  const hasPartialSuccess = result.task.status === 'completed' && result.task.success_rows > 0

  // 错误表格列定义
  const errorColumns = [
    {
      title: '行号',
      dataIndex: 'row_number',
      key: 'row_number',
      width: 80,
      sorter: (a: any, b: any) => a.row_number - b.row_number
    },
    {
      title: '错误类型',
      dataIndex: 'error_type',
      key: 'error_type',
      width: 120,
      render: (type: string) => {
        const colorMap: Record<string, string> = {
          'invalid_status': 'red',
          'missing_expected_output': 'orange',
          'missing_variable': 'yellow',
          'database_error': 'red',
          'batch_error': 'purple'
        }
        return <Tag color={colorMap[type] || 'default'}>{type}</Tag>
      }
    },
    {
      title: '错误信息',
      dataIndex: 'error_message',
      key: 'error_message',
      ellipsis: true
    }
  ]

  // 根据结果状态选择Result组件的props
  const getResultProps = () => {
    if (isSuccess) {
      return {
        status: 'success' as const,
        title: '上传成功！',
        subTitle: `成功上传了 ${result.task.total_rows} 条数据到数据集`,
        icon: <CheckCircleOutlined style={{ color: '#52c41a' }} />
      }
    } else if (hasPartialSuccess) {
      return {
        status: 'warning' as const,
        title: '部分上传成功',
        subTitle: `成功上传了 ${result.task.success_rows} 条数据，${result.task.failed_rows} 条数据失败`,
        icon: <WarningOutlined style={{ color: '#faad14' }} />
      }
    } else {
      return {
        status: 'error' as const,
        title: '上传失败',
        subTitle: '所有数据都上传失败，请检查数据格式后重试',
        icon: <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
      }
    }
  }

  const resultProps = getResultProps()

  return (
    <div>
      <Result
        {...resultProps}
        extra={
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            {/* 统计信息 */}
            <div style={{ backgroundColor: '#f5f5f5', padding: 16, borderRadius: 6 }}>
              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                <Title level={5} style={{ margin: 0 }}>{'上传统计'}</Title>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text>{'文件名:'}</Text>
                  <Text strong>{result.task.file_name}</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text>{'总行数:'}</Text>
                  <Text strong>{result.task.total_rows}</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text>{'成功率:'}</Text>
                  <Text strong style={{ color: result.success_rate >= 80 ? '#52c41a' : '#faad14' }}>
                    {result.success_rate.toFixed(1)}%
                  </Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text>{'成功行数:'}</Text>
                  <Text strong style={{ color: '#52c41a' }}>{result.task.success_rows}</Text>
                </div>
                {result.task.failed_rows > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text>{'失败行数:'}</Text>
                    <Text strong style={{ color: '#ff4d4f' }}>{result.task.failed_rows}</Text>
                  </div>
                )}
                {result.task.completed_at && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text>{'完成时间:'}</Text>
                    <Text>{new Date(result.task.completed_at).toLocaleString()}</Text>
                  </div>
                )}
              </Space>
            </div>

            {/* 错误详情 */}
            {result.has_errors && result.errors.length > 0 && (
              <Collapse style={{ textAlign: 'left' }}>
                <Panel 
                  header={`错误详情 (${result.errors.length} 个错误)`}
                  key="errors"
                  extra={
                    <Button
                      size="small"
                      icon={<DownloadOutlined />}
                      onClick={(e) => {
                        e.stopPropagation()
                        downloadErrorReport()
                      }}
                    >
                      {'下载错误报告'}
                    </Button>
                  }
                >
                  <Table
                    size="small"
                    columns={errorColumns}
                    dataSource={result.errors.map(error => ({ ...error, key: error.id }))}
                    pagination={{
                      pageSize: 5,
                      showSizeChanger: false,
                      showQuickJumper: true
                    }}
                    scroll={{ x: 600 }}
                  />
                </Panel>
              </Collapse>
            )}

            {/* 操作按钮 */}
            <Space>
              {result.has_errors && result.task.failed_rows > 0 && (
                <Button
                  icon={<RedoOutlined />}
                  onClick={handleRetry}
                  loading={retrying}
                >
                  {'重试失败行'}
                </Button>
              )}
              
              <Button type="primary" onClick={handleFinish}>
                {'完成'}
              </Button>
            </Space>

            {/* 成功提示 */}
            {hasPartialSuccess && (
              <Alert
                type="info"
                message={'提示'}
                description={'部分数据上传成功。您可以下载错误报告查看失败原因，修正数据后重新上传失败的行。'}
                showIcon
                style={{ textAlign: 'left' }}
              />
            )}
          </Space>
        }
      />
    </div>
  )
} 