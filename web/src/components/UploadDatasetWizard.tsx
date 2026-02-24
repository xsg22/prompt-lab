import React, { useState, useContext, createContext } from 'react'

import { Modal, Steps, message } from 'antd'
import FileSelectStep from './upload-steps/FileSelectStep'
import PreviewStep from './upload-steps/PreviewStep'
import UploadProgressStep from './upload-steps/UploadProgressStep'
import ResultStep from './upload-steps/ResultStep'

const { Step } = Steps

// 上传状态类型
interface UploadState {
  currentStep: number
  file: File | null
  fileContent: string | null
  previewData: any | null
  uploadTask: any | null
  isUploading: boolean
  isCompleted: boolean
  errors: any[]
}

// 上传上下文
interface UploadContextType {
  state: UploadState
  setState: React.Dispatch<React.SetStateAction<UploadState>>
  nextStep: () => void
  prevStep: () => void
  resetWizard: () => void
}

const UploadContext = createContext<UploadContextType | null>(null)

export const useUploadContext = () => {
  const context = useContext(UploadContext)
  if (!context) {
    throw new Error('useUploadContext must be used within UploadProvider')
  }
  return context
}

interface UploadDatasetWizardProps {
  open: boolean
  onClose: () => void
  datasetId: string
  variables: string[]
  onUploaded: () => void
}

export function UploadDatasetWizard({
  open,
  onClose,
  datasetId,
  variables,
  onUploaded
}: UploadDatasetWizardProps) {
  const [state, setState] = useState<UploadState>({
    currentStep: 0,
    file: null,
    fileContent: null,
    previewData: null,
    uploadTask: null,
    isUploading: false,
    isCompleted: false,
    errors: []
  })

  const nextStep = () => {
    setState(prev => ({
      ...prev,
      currentStep: Math.min(prev.currentStep + 1, 3)
    }))
  }

  const prevStep = () => {
    setState(prev => ({
      ...prev,
      currentStep: Math.max(prev.currentStep - 1, 0)
    }))
  }

  const resetWizard = () => {
    setState({
      currentStep: 0,
      file: null,
      fileContent: null,
      previewData: null,
      uploadTask: null,
      isUploading: false,
      isCompleted: false,
      errors: []
    })
  }

  const handleClose = () => {
    if (state.isUploading) {
      message.warning('上传正在进行中，请稍后再关闭')
      return
    }
    resetWizard()
    onClose()
  }

  const steps = [
    {
      title: '选择文件',
      content: <FileSelectStep datasetId={datasetId} variables={variables} />
    },
    {
      title: '预览确认',
      content: <PreviewStep datasetId={datasetId} variables={variables} />
    },
    {
      title: '上传进度',
      content: <UploadProgressStep datasetId={datasetId} />
    },
    {
      title: '完成',
      content: <ResultStep onUploaded={onUploaded} />
    }
  ]

  const contextValue: UploadContextType = {
    state,
    setState,
    nextStep,
    prevStep,
    resetWizard
  }

  return (
    <Modal
      title={'批量上传数据集'}
      open={open}
      onCancel={handleClose}
      footer={null}
      width={800}
      destroyOnClose
      maskClosable={!state.isUploading}
      closable={!state.isUploading}
    >
      <UploadContext.Provider value={contextValue}>
        <div style={{ padding: '20px 0' }}>
          <Steps current={state.currentStep} style={{ marginBottom: 30 }}>
            {steps.map(item => (
              <Step key={item.title} title={item.title} />
            ))}
          </Steps>
          <div style={{ minHeight: 400 }}>
            {steps[state.currentStep].content}
          </div>
        </div>
      </UploadContext.Provider>
    </Modal>
  )
} 