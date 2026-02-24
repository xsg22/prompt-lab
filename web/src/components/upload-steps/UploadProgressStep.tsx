import { useEffect, useState } from 'react'

import { Progress, Typography, Space, Spin, Button, Alert, message } from 'antd'
import { LoadingOutlined, CheckCircleOutlined, CloseCircleOutlined, SyncOutlined } from '@ant-design/icons'
import { useUploadContext } from '../UploadDatasetWizard'
import { DatasetsAPI } from '@/lib/api'

const { Text, Title } = Typography

interface UploadProgressStepProps {
  datasetId: string
}

interface UploadStatus {
  task: {
    id: number
    status: 'pending' | 'processing' | 'completed' | 'failed'
    total_rows: number
    processed_rows: number
    success_rows: number
    failed_rows: number
    created_at: string
    updated_at: string
    completed_at?: string
  }
  progress_percentage: number
  estimated_time_remaining?: number
}

export default function UploadProgressStep({ }: UploadProgressStepProps) {
  const { state, setState, nextStep } = useUploadContext()
  const [uploadStatus, setUploadStatus] = useState<UploadStatus | null>(null)
  const [polling, setPolling] = useState(false)

  // 获取上传状态
  const fetchUploadStatus = async () => {
    if (!state.uploadTask?.task_id) return

    try {
      const response = await DatasetsAPI.getUploadStatus(state.uploadTask.task_id)
      const status = response.data
      setUploadStatus(status)

      // 如果上传完成，自动跳转到结果页
      if (status.task.status === 'completed' || status.task.status === 'failed') {
        setPolling(false)
        setState(prev => ({
          ...prev,
          isUploading: false,
          isCompleted: true
        }))
        
        // 延迟1秒后跳转，让用户看到完成状态
        setTimeout(() => {
          nextStep()
        }, 1500)
      }
    } catch (error: any) {
      console.error('获取上传状态失败', error)
      message.error('获取上传状态失败')
    }
  }

  // 开始轮询状态
  useEffect(() => {
    if (state.uploadTask?.task_id && !polling) {
      setPolling(true)
      fetchUploadStatus()
    }
  }, [state.uploadTask])

  // 轮询上传状态
  useEffect(() => {
    let interval: NodeJS.Timeout

    if (polling && (uploadStatus?.task.status === 'processing' || uploadStatus?.task.status === 'pending')) {
      interval = setInterval(() => {
        fetchUploadStatus()
      }, 1000) // 每秒查询一次
    }

    return () => {
      if (interval) {
        clearInterval(interval)
      }
    }
  }, [polling, uploadStatus?.task.status])

  // 取消上传（注意：后端处理可能已经开始，这里主要是停止前端轮询）
  const handleCancel = () => {
    setPolling(false)
    setState(prev => ({
      ...prev,
      isUploading: false
    }))
    message.info('已停止监控上传进度')
  }

  // 格式化时间
  const formatTime = (seconds: number) => {
    if (seconds < 60) {
      return `${seconds}秒`
    } else if (seconds < 3600) {
      return `${Math.floor(seconds / 60)}分${seconds % 60}秒`
    } else {
      return `${Math.floor(seconds / 3600)}小时${Math.floor((seconds % 3600) / 60)}分`
    }
  }

  if (!state.uploadTask) {
    return (
      <div style={{ textAlign: 'center', padding: 50 }}>
        <Alert
          type="error"
          message={'上传任务信息丢失'}
          description={'请重新开始上传流程'}
        />
      </div>
    )
  }

  if (!uploadStatus) {
    return (
      <div style={{ textAlign: 'center', padding: 50 }}>
        <Spin size="large" indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />} />
        <div style={{ marginTop: 16 }}>
          <Text>{'正在初始化上传任务...'}</Text>
        </div>
      </div>
    )
  }

  const { task, progress_percentage, estimated_time_remaining } = uploadStatus

  // 根据状态显示不同的图标和颜色
  const getStatusConfig = () => {
    switch (task.status) {
      case 'pending':
        return {
          icon: <SyncOutlined spin />,
          status: 'active' as const,
          color: '#1890ff',
          text: '准备中...'
        }
      case 'processing':
        return {
          icon: <LoadingOutlined spin />,
          status: 'active' as const,
          color: '#1890ff',
          text: '上传中...'
        }
      case 'completed':
        return {
          icon: <CheckCircleOutlined />,
          status: 'success' as const,
          color: '#52c41a',
          text: '上传完成'
        }
      case 'failed':
        return {
          icon: <CloseCircleOutlined />,
          status: 'exception' as const,
          color: '#ff4d4f',
          text: '上传失败'
        }
      default:
        return {
          icon: <SyncOutlined />,
          status: 'normal' as const,
          color: '#d9d9d9',
          text: '未知状态'
        }
    }
  }

  const statusConfig = getStatusConfig()

  return (
    <div>
      <Title level={4}>{'上传进度'}</Title>

      <div style={{ padding: '40px 20px', textAlign: 'center' }}>
        {/* 主进度条 */}
        <div style={{ marginBottom: 40 }}>
          <Progress
            type="circle"
            percent={Math.round(progress_percentage)}
            size={120}
            status={statusConfig.status}
            format={(percent) => (
              <div>
                <div style={{ fontSize: 20, fontWeight: 'bold', color: statusConfig.color }}>
                  {percent}%
                </div>
                <div style={{ fontSize: 12, color: '#666' }}>
                  {statusConfig.text}
                </div>
              </div>
            )}
          />
        </div>

        {/* 状态信息 */}
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div style={{ fontSize: 16, color: statusConfig.color }}>
            {statusConfig.icon}
            <span style={{ marginLeft: 8 }}>{statusConfig.text}</span>
          </div>

          {/* 详细统计 */}
          <div style={{ backgroundColor: '#f5f5f5', padding: 16, borderRadius: 6 }}>
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text>{'总行数:'}</Text>
                <Text strong>{task.total_rows}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text>{'已处理:'}</Text>
                <Text strong>{task.processed_rows}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text>{'成功:'}</Text>
                <Text strong style={{ color: '#52c41a' }}>{task.success_rows}</Text>
              </div>
              {task.failed_rows > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text>{'失败:'}</Text>
                  <Text strong style={{ color: '#ff4d4f' }}>{task.failed_rows}</Text>
                </div>
              )}
            </Space>
          </div>

          {/* 时间信息 */}
          {estimated_time_remaining && task.status === 'processing' && (
            <Text type="secondary">
              {`预计剩余时间: ${formatTime(estimated_time_remaining)}`}
            </Text>
          )}

          {task.status === 'completed' && task.completed_at && (
            <Text type="secondary">
              {`完成时间: ${formatTime(new Date(task.completed_at).getTime() / 1000)}`}
            </Text>
          )}
        </Space>

        {/* 操作按钮 */}
        <div style={{ marginTop: 40 }}>
          {task.status === 'processing' && (
            <Button onClick={handleCancel} type="default">
              {'停止监控'}
            </Button>
          )}
          
          {(task.status === 'completed' || task.status === 'failed') && (
            <Button type="primary" onClick={nextStep}>
              {'查看结果'}
            </Button>
          )}
        </div>

        {/* 失败提示 */}
        {task.status === 'failed' && (
          <Alert
            type="error"
            message={'上传失败'}
            description={'请检查网络连接或联系管理员'}
            style={{ marginTop: 20, textAlign: 'left' }}
          />
        )}
      </div>
    </div>
  )
} 