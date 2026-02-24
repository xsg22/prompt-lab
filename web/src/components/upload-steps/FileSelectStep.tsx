import { Upload, Button, Space, Typography, Divider, message } from 'antd'

import { InboxOutlined, DownloadOutlined, FileTextOutlined } from '@ant-design/icons'
import { useUploadContext } from '../UploadDatasetWizard'

const { Dragger } = Upload
const { Text, Title } = Typography

interface FileSelectStepProps {
  datasetId: string
  variables: string[]
}

export default function FileSelectStep({ datasetId, variables }: FileSelectStepProps) {
  const { state, setState, nextStep } = useUploadContext()

  // 处理文件选择
  const handleFileSelect = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      message.error('请选择CSV格式的文件')
      return false
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      const base64Content = btoa(unescape(encodeURIComponent(content)))
      
      setState(prev => ({
        ...prev,
        file,
        fileContent: base64Content
      }))
      
      message.success('文件读取成功，点击下一步进行预览')
    }
    
    reader.onerror = () => {
      message.error('文件读取失败，请重新选择')
    }
    
    reader.readAsText(file, 'UTF-8')
    return false // 阻止默认上传行为
  }

  // 下载模板文件
  const downloadTemplate = () => {
    const headers = ['is_enabled', 'name', ...variables]
    const sampleData = [
      ['1', '这是条目名称', ...variables.map(() => '示例值')]
    ]
    
    const csvContent = [
      headers.join(','),
      ...sampleData.map(row => row.join(','))
    ].join('\n')
    
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `dataset_template_${datasetId}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    
    message.success('模板文件下载成功')
  }

  // 移除文件
  const handleRemoveFile = () => {
    setState(prev => ({
      ...prev,
      file: null,
      fileContent: null
    }))
  }

  return (
    <div>
      <Title level={4}>{'选择CSV文件'}</Title>
      
      {/* 模板下载区域 */}
      <div style={{ marginBottom: 24, padding: 16, backgroundColor: '#f5f5f5', borderRadius: 6 }}>
        <Space direction="vertical" size="small" style={{ width: '100%' }}>
          <Text strong>📋 {'使用说明'}</Text>
          <Text type="secondary">
            {'请确保CSV文件包含以下必需字段：'}
          </Text>
          <ul style={{ margin: '8px 0', paddingLeft: 20 }}>
            <li><Text code>is_enabled</Text> 或 <Text code>状态</Text> - {'条目启用状态 (0/1 或 true/false)'}</li>
            <li><Text code>name</Text> 或 <Text code>名称</Text> - {'条目名称'}</li>
            {variables.map(variable => (
              <li key={variable}><Text code>{variable}</Text> - {'变量值'}</li>
            ))}
          </ul>
          <Button 
            icon={<DownloadOutlined />} 
            onClick={downloadTemplate}
            type="primary"
            ghost
          >
            {'下载CSV模板'}
          </Button>
        </Space>
      </div>

      <Divider />

      {/* 文件上传区域 */}
      <Dragger
        accept=".csv"
        beforeUpload={handleFileSelect}
        fileList={state.file ? [{
          uid: '1',
          name: state.file.name,
          status: 'done',
          size: state.file.size
        }] : []}
        onRemove={handleRemoveFile}
        multiple={false}
        showUploadList={{
          showRemoveIcon: true,
          showDownloadIcon: false
        }}
        customRequest={() => {}} // 禁用自动上传
        style={{ marginBottom: 24 }}
      >
        <p className="ant-upload-drag-icon">
          <InboxOutlined style={{ fontSize: 48, color: '#1890ff' }} />
        </p>
        <p className="ant-upload-text" style={{ fontSize: 16 }}>
          {'点击或拖拽CSV文件到此处'}
        </p>
        <p className="ant-upload-hint" style={{ color: '#999' }}>
          {'支持单个CSV文件上传，文件大小不超过10MB'}
        </p>
      </Dragger>

      {/* 操作按钮 */}
      <div style={{ textAlign: 'right' }}>
        <Space>
          <Button
            type="primary"
            onClick={nextStep}
            disabled={!state.file || !state.fileContent}
          >
            {'下一步：预览数据'}
          </Button>
        </Space>
      </div>

      {/* 文件信息 */}
      {state.file && (
        <div style={{ marginTop: 16, padding: 12, backgroundColor: '#f0f9ff', borderRadius: 6 }}>
          <Space>
            <FileTextOutlined style={{ color: '#1890ff' }} />
            <Text strong>{'已选择文件：'}</Text>
            <Text>{state.file.name}</Text>
            <Text type="secondary">({(state.file.size / 1024).toFixed(1)} KB)</Text>
          </Space>
        </div>
      )}
    </div>
  )
} 