import { useState } from "react";
import { Link } from "react-router-dom";
import { Button, Dropdown, Avatar } from "antd";
import { UserOutlined, SettingOutlined, LogoutOutlined } from "@ant-design/icons";
import { useAuth } from "@/contexts/UnifiedAuthContext";
import ProfileSettingsModal from "./ProfileSettingsModal";

export function UserNav() {
  const { user, logout } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<"profile" | "settings">("profile");

  const getInitials = () => {
    if (!user) return "";
    if (user.name) {
      return user.name.charAt(0).toUpperCase();
    }
    return (user.username || '?').charAt(0).toUpperCase();
  };

  if (!user) {
    return (
      <Button>
        <Link to="/login">登录</Link>
      </Button>
    );
  }

  const openModal = (tab: "profile" | "settings") => {
    setModalTab(tab);
    setModalOpen(true);
  };

  const items = [
    {
      key: "profile",
      icon: <UserOutlined />,
      label: "个人资料",
      onClick: () => openModal("profile"),
    },
    {
      key: "settings",
      icon: <SettingOutlined />,
      label: "账号设置",
      onClick: () => openModal("settings"),
    },
    {
      type: "divider" as const,
    },
    {
      key: "logout",
      icon: <LogoutOutlined />,
      label: '登出',
      onClick: logout,
    },
  ];

  return (
    <>
      <Dropdown
        menu={{ items }}
        placement="bottomRight"
        trigger={["click"]}
      >
        <Avatar
          style={{ 
            backgroundColor: "#1890ff", 
            cursor: "pointer" 
          }}
        >
          {getInitials()}
        </Avatar>
      </Dropdown>

      <ProfileSettingsModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        defaultTab={modalTab}
      />
    </>
  );
}
