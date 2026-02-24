import { useState } from "react"
import { Modal, Form, Input, Button, message } from "antd"

import { ProjectsAPI } from '@/lib/api'
import type { Project } from "@/types/Project";

interface CreateProjectModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (project: Project) => void;
}

export function CreateProjectModal({
  open,
  onClose,
  onCreated
}: CreateProjectModalProps) {
  
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  
  const handleSubmit = async () => {
    try {
      await form.validateFields()
      const values = form.getFieldsValue()
      
      setLoading(true)
      
      try {
        // 直接调用API创建项目
        const response = await ProjectsAPI.createProject({
          name: values.name,
          description: values.description
        });
        
        const project = response.data;
        message.success('项目创建成功')
        
        // 重置表单
        form.resetFields()
        
        // 关闭弹窗
        onCreated(project)
      } catch (error: any) {
        const errorMsg = error?.response?.data?.detail?.message || error?.message || '创建项目失败';
        message.error(errorMsg);
      } finally {
        setLoading(false)
      }
    } catch (error) {
      // 表单验证失败
      console.error('表单验证失败', error);
    }
  }
  
  return (
    <Modal
      title={'创建新项目'}
      open={open}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose}>
          {'取消'}
        </Button>,
        <Button 
          key="submit" 
          type="primary" 
          loading={loading}
          onClick={handleSubmit}
        >
          {'创建'}
        </Button>
      ]}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          name: "",
          description: ""
        }}
      >
        <Form.Item
          name="name"
          label={'项目名称'}
          rules={[{ required: true, message: '请输入项目名称' }]}
        >
          <Input placeholder={'请输入项目名称'} />
        </Form.Item>
      </Form>
    </Modal>
  )
} 