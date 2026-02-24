import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Card, 
  Typography, 
  Form, 
  Input, 
  Button, 
  Skeleton, 
  message,
  Divider
} from "antd";
import { UserAPI } from "@/lib/api";

const { Title, Text, Paragraph } = Typography;

interface User {
  id: number;
  username: string;
  email?: string;
  nickname?: string;
  created_at: string;
  updated_at: string;
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [form] = Form.useForm();

  // 获取用户信息
  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const response = await UserAPI.getCurrentUser();
        setUser(response.data);
        form.setFieldsValue({
          nickname: response.data.nickname || ""
        });
      } catch (error: any) {
        console.error('获取用户信息失败', error);
        if (error.response?.status === 401) {
          message.error('请先登录');
          navigate("/login");
        } else {
          message.error('获取用户信息失败');
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserProfile();
  }, [navigate, form]);

  // 更新个人资料
  const onFinish = async (values: { nickname: string }) => {
    setLoading(true);
    try {
      const response = await UserAPI.updateCurrentUser(values);
      setUser(response.data);
      message.success('个人资料更新成功');
    } catch (error: any) {
      console.error("更新个人资料失败:", error);
      message.error(error.response?.data?.detail || '更新个人资料失败');
    } finally {
      setLoading(false);
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
      <Card
        title={<Title level={3}>个人资料</Title>}
        extra={<Text type="secondary">查看和更新您的个人资料信息</Text>}
      >
        {user && (
          <>
            <div style={{ marginBottom: '24px' }}>
              <Text type="secondary">账号</Text>
              <Paragraph style={{ marginTop: '8px' }}>{user.username}</Paragraph>
            </div>
            
            <div style={{ marginBottom: '24px' }}>
              <Text type="secondary">账号创建时间</Text>
              <Paragraph style={{ marginTop: '8px' }}>
                {new Date(user.created_at).toLocaleString()}
              </Paragraph>
            </div>
            
            <Divider />
            
            <Title level={4} style={{ marginBottom: '16px' }}>修改昵称</Title>
            <Form
              form={form}
              layout="vertical"
              onFinish={onFinish}
            >
              <Form.Item
                name="nickname"
                label="昵称"
                rules={[
                  { min: 2, message: '昵称长度至少为 2 个字符' },
                  { max: 50, message: '昵称长度不能超过 50 个字符' }
                ]}
              >
                <Input placeholder="请输入您的昵称" />
              </Form.Item>
              
              <Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={loading}
                >
                  {loading ? '更新中...' : '更新资料'}
                </Button>
              </Form.Item>
            </Form>
          </>
        )}
      </Card>
    </div>
  );
} 