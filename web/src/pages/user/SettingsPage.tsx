import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Card, 
  Typography, 
  Form, 
  Input, 
  Button, 
  Skeleton, 
  Modal,
  message 
} from "antd";
import { ExclamationCircleOutlined } from "@ant-design/icons";
import { UserAPI } from "@/lib/api";
import { useAuth } from "@/contexts/UnifiedAuthContext";

const { Title, Text, Paragraph } = Typography;
const { confirm } = Modal;

export default function SettingsPage() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [form] = Form.useForm();

  // 检查用户是否已登录
  useEffect(() => {
    const checkAuth = async () => {
      try {
        await UserAPI.getCurrentUser();
        setIsLoading(false);
      } catch (error: any) {
        console.error('验证登录状态失败', error);
        if (error.response?.status === 401) {
          message.error('请先登录');
          navigate("/login");
        }
      }
    };

    checkAuth();
  }, [navigate]);

  // 修改密码
  const onFinish = async (values: { 
    oldPassword: string; 
    newPassword: string; 
    confirmNewPassword: string 
  }) => {
    // 验证两次输入的密码是否一致
    if (values.newPassword !== values.confirmNewPassword) {
      message.error('两次输入的新密码不一致');
      return;
    }

    setLoading(true);
    try {
      await UserAPI.updatePassword({
        old_password: values.oldPassword,
        new_password: values.newPassword,
      });

      message.success('密码修改成功');
      form.resetFields();
    } catch (error: any) {
      console.error("修改密码失败:", error);
      message.error(error.response?.data?.detail || '修改密码失败');
    } finally {
      setLoading(false);
    }
  };

  // 显示注销账号确认对话框
  const showDeleteConfirm = () => {
    confirm({
      title: '确认注销账号？',
      icon: <ExclamationCircleOutlined />,
      content: '此操作将永久删除您的账号和所有相关数据，且无法恢复。',
      okText: '确认注销',
      okType: 'danger',
      cancelText: '取消',
      onOk() {
        deleteAccount();
      }
    });
  };

  // 注销账号
  const deleteAccount = async () => {
    setDeleteLoading(true);
    try {
      await UserAPI.deleteCurrentUser();
      message.success('账号已成功注销');

      // 清除登录状态
      await logout();

      // 跳转到登录页
      navigate("/login");
    } catch (error: any) {
      console.error("注销账号失败:", error);
      message.error(error.response?.data?.detail || '注销账号失败');
    } finally {
      setDeleteLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div style={{ padding: '100px', textAlign: 'center' }}>
        <Skeleton active paragraph={{ rows: 6 }} />
      </div>
    );
  }

  return (
    <div style={{ background: 'white', borderRadius: 8, padding: 24 }}>
      <Title level={2} style={{ marginBottom: '24px' }}>账号设置</Title>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* 修改密码 */}
        <Card 
          title={<Title level={4} style={{ margin: 0 }}>修改密码</Title>}
          extra={<Text type="secondary">更新您的账号密码</Text>}
        >
          <Form
            form={form}
            layout="vertical"
            onFinish={onFinish}
          >
            <Form.Item
              name="oldPassword"
              label="当前密码"
              rules={[
                { required: true, message: '请输入当前密码' },
                { min: 6, message: '密码长度至少为 6 个字符' }
              ]}
            >
              <Input.Password placeholder="输入当前密码" />
            </Form.Item>

            <Form.Item
              name="newPassword"
              label="新密码"
              rules={[
                { required: true, message: '请输入新密码' },
                { min: 6, message: '密码长度至少为 6 个字符' }
              ]}
            >
              <Input.Password placeholder="输入新密码" />
            </Form.Item>

            <Form.Item
              name="confirmNewPassword"
              label="确认新密码"
              rules={[
                { required: true, message: '请再次输入新密码' },
                { min: 6, message: '密码长度至少为 6 个字符' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('newPassword') === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error('两次输入的新密码不一致'));
                  },
                }),
              ]}
            >
              <Input.Password placeholder="再次输入新密码" />
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
              >
                {loading ? '更新中...' : '更新密码'}
              </Button>
            </Form.Item>
          </Form>
        </Card>

        {/* 注销账号 */}
        <Card 
          title={<Title level={4} style={{ margin: 0, color: '#f5222d' }}>注销账号</Title>}
          extra={<Text type="secondary">永久删除您的账号和所有相关数据，此操作不可撤销</Text>}
          style={{ borderColor: '#ffccc7' }}
        >
          <Paragraph type="secondary" style={{ marginBottom: '16px' }}>
            请谨慎操作，注销后所有数据将无法恢复。
          </Paragraph>
          
          <Button 
            danger 
            onClick={showDeleteConfirm}
            loading={deleteLoading}
          >
            {deleteLoading ? '处理中...' : '注销我的账号'}
          </Button>
        </Card>
      </div>
    </div>
  );
} 