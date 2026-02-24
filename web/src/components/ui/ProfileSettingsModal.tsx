import { useState, useEffect } from "react";
import {
  Modal,
  Tabs,
  Form,
  Input,
  Button,
  Typography,
  Divider,
  Skeleton,
  message,
} from "antd";
import { ExclamationCircleOutlined } from "@ant-design/icons";
import { UserAPI } from "@/lib/api";
import { useAuth } from "@/contexts/UnifiedAuthContext";

const { Title, Text, Paragraph } = Typography;
const { confirm } = Modal;

interface ProfileSettingsModalProps {
  open: boolean;
  onClose: () => void;
  defaultTab?: "profile" | "settings";
}

interface UserInfo {
  id: number;
  username: string;
  email?: string;
  nickname?: string;
  created_at: string;
  updated_at: string;
}

export default function ProfileSettingsModal({
  open,
  onClose,
  defaultTab = "profile",
}: ProfileSettingsModalProps) {
  const { logout } = useAuth();
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [profileForm] = Form.useForm();
  const [pwdForm] = Form.useForm();

  useEffect(() => {
    if (open) {
      setActiveTab(defaultTab);
      fetchUser();
    }
  }, [open]);

  const fetchUser = async () => {
    setIsLoading(true);
    try {
      const response = await UserAPI.getCurrentUser();
      setUser(response.data);
      profileForm.setFieldsValue({ nickname: response.data.nickname || "" });
    } catch {
      message.error("获取用户信息失败");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateProfile = async (values: { nickname: string }) => {
    setProfileLoading(true);
    try {
      const response = await UserAPI.updateCurrentUser(values);
      setUser(response.data);
      message.success("个人资料更新成功");
    } catch (error: any) {
      message.error(error.response?.data?.detail || "更新个人资料失败");
    } finally {
      setProfileLoading(false);
    }
  };

  const handleUpdatePassword = async (values: {
    oldPassword: string;
    newPassword: string;
  }) => {
    setPwdLoading(true);
    try {
      await UserAPI.updatePassword({
        old_password: values.oldPassword,
        new_password: values.newPassword,
      });
      message.success("密码修改成功");
      pwdForm.resetFields();
    } catch (error: any) {
      message.error(error.response?.data?.detail || "修改密码失败");
    } finally {
      setPwdLoading(false);
    }
  };

  const showDeleteConfirm = () => {
    confirm({
      title: "确认注销账号？",
      icon: <ExclamationCircleOutlined />,
      content: "此操作将永久删除您的账号和所有相关数据，且无法恢复。",
      okText: "确认注销",
      okType: "danger",
      cancelText: "取消",
      async onOk() {
        setDeleteLoading(true);
        try {
          await UserAPI.deleteCurrentUser();
          message.success("账号已成功注销");
          await logout();
          onClose();
        } catch (error: any) {
          message.error(error.response?.data?.detail || "注销账号失败");
        } finally {
          setDeleteLoading(false);
        }
      },
    });
  };

  const handleClose = () => {
    pwdForm.resetFields();
    onClose();
  };

  const tabItems = [
    {
      key: "profile",
      label: "个人资料",
      children: isLoading ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : (
        user && (
          <>
            <div style={{ marginBottom: 20 }}>
              <Text type="secondary">账号</Text>
              <Paragraph style={{ marginTop: 4, marginBottom: 0 }}>
                {user.username}
              </Paragraph>
            </div>
            <div style={{ marginBottom: 20 }}>
              <Text type="secondary">账号创建时间</Text>
              <Paragraph style={{ marginTop: 4, marginBottom: 0 }}>
                {new Date(user.created_at).toLocaleString()}
              </Paragraph>
            </div>
            <Divider />
            <Title level={5} style={{ marginBottom: 16 }}>
              修改昵称
            </Title>
            <Form form={profileForm} layout="vertical" onFinish={handleUpdateProfile}>
              <Form.Item
                name="nickname"
                label="昵称"
                rules={[
                  { min: 2, message: "昵称长度至少为 2 个字符" },
                  { max: 50, message: "昵称长度不能超过 50 个字符" },
                ]}
              >
                <Input placeholder="请输入您的昵称" />
              </Form.Item>
              <Form.Item style={{ marginBottom: 0 }}>
                <Button type="primary" htmlType="submit" loading={profileLoading}>
                  更新资料
                </Button>
              </Form.Item>
            </Form>
          </>
        )
      ),
    },
    {
      key: "settings",
      label: "账号设置",
      children: isLoading ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : (
        <>
          <Title level={5} style={{ marginBottom: 16 }}>
            修改密码
          </Title>
          <Form form={pwdForm} layout="vertical" onFinish={handleUpdatePassword}>
            <Form.Item
              name="oldPassword"
              label="当前密码"
              rules={[
                { required: true, message: "请输入当前密码" },
                { min: 6, message: "密码长度至少为 6 个字符" },
              ]}
            >
              <Input.Password placeholder="输入当前密码" />
            </Form.Item>
            <Form.Item
              name="newPassword"
              label="新密码"
              rules={[
                { required: true, message: "请输入新密码" },
                { min: 6, message: "密码长度至少为 6 个字符" },
              ]}
            >
              <Input.Password placeholder="输入新密码" />
            </Form.Item>
            <Form.Item
              name="confirmNewPassword"
              label="确认新密码"
              dependencies={["newPassword"]}
              rules={[
                { required: true, message: "请再次输入新密码" },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue("newPassword") === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error("两次输入的新密码不一致"));
                  },
                }),
              ]}
            >
              <Input.Password placeholder="再次输入新密码" />
            </Form.Item>
            <Form.Item style={{ marginBottom: 0 }}>
              <Button type="primary" htmlType="submit" loading={pwdLoading}>
                更新密码
              </Button>
            </Form.Item>
          </Form>

          <Divider />

          <Title level={5} style={{ color: "#f5222d", marginBottom: 8 }}>
            注销账号
          </Title>
          <Paragraph type="secondary" style={{ marginBottom: 16 }}>
            永久删除您的账号和所有相关数据，此操作不可撤销。
          </Paragraph>
          <Button danger onClick={showDeleteConfirm} loading={deleteLoading}>
            注销我的账号
          </Button>
        </>
      ),
    },
  ];

  return (
    <Modal
      open={open}
      onCancel={handleClose}
      footer={null}
      width={520}
      destroyOnClose
    >
      <Tabs
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as "profile" | "settings")}
        items={tabItems}
      />
    </Modal>
  );
}
