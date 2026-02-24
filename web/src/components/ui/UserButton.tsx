import React from 'react';
import { Dropdown, Avatar, Space, Typography } from 'antd';
import { UserOutlined, SettingOutlined, LogoutOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { useNavigate } from 'react-router-dom';

const { Text } = Typography;

export const UserButton: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const items: MenuProps['items'] = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人资料',
      onClick: () => navigate('/user/profile'),
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: '账户设置',
      onClick: () => navigate('/user/settings'),
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout,
    },
  ];

  return (
    <Dropdown
      menu={{ items }}
      placement="bottomRight"
      arrow={{ pointAtCenter: true }}
    >
      <Space className="cursor-pointer hover:bg-gray-50 px-2 py-1 rounded-lg transition-colors">
        <Avatar
          size="small"
          src={user.avatar}
          icon={!user.avatar && <UserOutlined />}
        />
        <div className="hidden sm:block">
          <Text className="text-sm font-medium">
            {user.name || user.username}
          </Text>
        </div>
      </Space>
    </Dropdown>
  );
};
