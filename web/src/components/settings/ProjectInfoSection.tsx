import { useState, useEffect } from 'react';

import { 
  Card, 
  Form, 
  Input, 
  Button, 
  Modal, 
  Typography, 
  notification 
} from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';
import { ProjectAPI } from '@/lib/api';
import { useNavigate } from 'react-router-dom';
import { useProject } from '@/contexts/ProjectContext';

const { Title, Text, Paragraph } = Typography;
const { confirm } = Modal;

interface ProjectInfo {
  id: number;
  name: string;
  created_at?: string;
  updated_at?: string;
}

interface ProjectInfoSectionProps {
  projectId: string | undefined;
}

export function ProjectInfoSection({ projectId }: ProjectInfoSectionProps) {
  
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const { updateProject, removeProject } = useProject();
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [projectInfo, setProjectInfo] = useState<ProjectInfo | null>(null);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');

  // 获取项目信息
  useEffect(() => {
    if (projectId) {
      fetchProjectInfo();
    }
  }, [projectId]);

  const fetchProjectInfo = async () => {
    try {
      setLoading(true);
      const response = await ProjectAPI.getProjectDetails(parseInt(projectId!));
      setProjectInfo(response.data);
      form.setFieldsValue({
        name: response.data.name
      });
    } catch (error: any) {
      notification.error({
        message: '获取项目信息失败',
        description: error.response?.data?.detail || error.message
      });
    } finally {
      setLoading(false);
    }
  };

  // 更新项目名称
  const handleUpdateProject = async (values: { name: string }) => {
    if (!projectId) return;

    try {
      setLoading(true);
      await ProjectAPI.updateProject(parseInt(projectId), { name: values.name });
      
      notification.success({
        message: '项目信息更新成功'
      });
      
      // 更新本地状态
      const updatedProject = { ...projectInfo!, name: values.name };
      setProjectInfo(updatedProject);
      
      // 同步更新全局状态 - 从API响应获取完整项目信息
      const projectResponse = await ProjectAPI.getProjectDetails(parseInt(projectId));
      updateProject(projectResponse.data);
    } catch (error: any) {
      notification.error({
        message: '更新项目信息失败',
        description: error.response?.data?.detail || error.message
      });
    } finally {
      setLoading(false);
    }
  };

  // 显示删除确认对话框
  const showDeleteConfirm = () => {
    confirm({
      title: '删除项目确认',
      icon: <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />,
      content: (
        <div>
          <Paragraph type="danger">
            此操作将永久删除项目及其所有数据，包括：
          </Paragraph>
          <ul style={{ color: '#ff4d4f' }}>
            <li>所有提示词和版本</li>
            <li>所有数据集和数据项</li>
            <li>所有评估任务和结果</li>
            <li>所有成员和权限</li>
            <li>所有API配置</li>
          </ul>
          <Paragraph type="danger">
            <strong>此操作无法撤销！</strong>
          </Paragraph>
        </div>
      ),
      okText: '继续删除',
      okType: 'danger',
      cancelText: '取消',
      onOk() {
        setDeleteModalVisible(true);
      }
    });
  };

  // 执行删除项目
  const handleDeleteProject = async () => {
    if (!projectId || !projectInfo) return;

    if (deleteConfirmName !== projectInfo.name) {
      notification.error({
        message: '项目名称不匹配',
        description: '请输入正确的项目名称以确认删除'
      });
      return;
    }

    try {
      setDeleteLoading(true);
      await ProjectAPI.deleteProject(parseInt(projectId), deleteConfirmName);
      
      notification.success({
        message: '项目删除成功',
        description: '项目及其所有数据已被永久删除'
      });
      
      // 同步删除全局状态
      removeProject(parseInt(projectId));
      
      // 删除成功后跳转到项目列表页面
      navigate("/project");
    } catch (error: any) {
      notification.error({
        message: '删除项目失败',
        description: error.response?.data?.detail || error.message
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div>
      <Card title="项目信息">
        <Form
          form={form}
          layout="vertical"
          onFinish={handleUpdateProject}
          disabled={loading}
        >
          <Form.Item
            label="项目名称"
            name="name"
            rules={[
              { required: true, message: '请输入项目名称' },
              { max: 10, message: '项目名称不能超过10个字符' }
            ]}
            extra="项目名称将在整个应用程序中显示。"
          >
            <Input placeholder="输入项目名称" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading}>
              保存更改
            </Button>
          </Form.Item>
        </Form>
      </Card>

      <Card title="危险操作" style={{ marginTop: 24 }}>
        <div>
          <Title level={5} type="danger">删除项目</Title>
          <Paragraph type="secondary">
            一旦删除，项目及其所有数据将无法恢复。
          </Paragraph>
          <Button danger onClick={showDeleteConfirm}>
            删除项目
          </Button>
        </div>
      </Card>

      {/* 删除确认模态框 */}
      <Modal
        title="确认删除项目"
        open={deleteModalVisible}
        onCancel={() => {
          setDeleteModalVisible(false);
          setDeleteConfirmName('');
        }}
        footer={[
          <Button 
            key="cancel" 
            onClick={() => {
              setDeleteModalVisible(false);
              setDeleteConfirmName('');
            }}
          >
            取消
          </Button>,
          <Button 
            key="delete" 
            type="primary" 
            danger
            loading={deleteLoading}
            disabled={deleteConfirmName !== projectInfo?.name}
            onClick={handleDeleteProject}
          >
            确认删除
          </Button>
        ]}
      >
        <div>
          <Paragraph>
            请输入项目名称 <Text code>{projectInfo?.name}</Text> 以确认删除：
          </Paragraph>
          <Input
            placeholder={`输入 ${projectInfo?.name} 确认删除`}
            value={deleteConfirmName}
            onChange={(e) => setDeleteConfirmName(e.target.value)}
            onPressEnter={handleDeleteProject}
          />
          <Paragraph style={{ marginTop: 12, marginBottom: 0 }} type="secondary">
            输入项目名称后才能删除
          </Paragraph>
        </div>
      </Modal>
    </div>
  );
}

export default ProjectInfoSection; 