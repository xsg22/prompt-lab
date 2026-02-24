import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { 
  message,
  theme 
} from "antd";
import { 
  UserOutlined, 
  LockOutlined} from '@ant-design/icons';
import { 
  LoginFormPage, 
  ProFormText,
  ProFormCheckbox
} from '@ant-design/pro-components';
import { useAuth } from "@/contexts/UnifiedAuthContext";


export function LoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const { token } = theme.useToken();
  const { login } = useAuth();
  const redirect = new URLSearchParams(window.location.search).get('redirect');

  const onSubmit = async (values: any) => {
    setLoading(true);
    try {
      await login(values.username, values.password);
      
      message.success('登录成功', 2, () => {
        if (redirect) {
          navigate(redirect);
        } else {
          navigate("/project");
        }
      });
      
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || '登录失败，请检查账号和密码';
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ height: '100vh' }}>
      <LoginFormPage
        onFinish={onSubmit}
        backgroundImageUrl="https://gw.alipayobjects.com/zos/rmsportal/FfdJeJRQWjEeGTpqgBKj.png"
        backgroundVideoUrl="https://gw.alipayobjects.com/v/huamei_gcee1x/afts/video/jXRBRK_VAwoAAAAAAAAAAAAAK4eUAQBr"
        logo="https://images.pexels.com/photos/5380664/pexels-photo-5380664.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1"
        title="Prompt管理平台"
        subTitle="打造智能化数字未来"
        containerStyle={{
          backgroundColor: 'rgba(155, 153, 153, 0.65)',
          backdropFilter: 'blur(8px)',
          borderRadius: '12px',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)'
        }}
        submitter={{
          searchConfig: {
            submitText: '登录',
          },
          submitButtonProps: {
            loading,
            size: 'large',
            style: {
              width: '100%',
            },
          },
        }}
      >
        <ProFormText
          name="username"
          fieldProps={{
            size: 'large',
            prefix: (
              <UserOutlined
                style={{
                  color: token.colorTextSecondary,
                }}
                className={'prefixIcon'}
              />
            ),
          }}
          placeholder="请输入账号"
          rules={[
            {
              required: true,
              message: '请输入账号',
            },
          ]}
        />
        <ProFormText.Password
          name="password"
          fieldProps={{
            size: 'large',
            prefix: (
              <LockOutlined
                style={{
                  color: token.colorTextSecondary,
                }}
                className={'prefixIcon'}
              />
            ),
          }}
          placeholder="请输入密码"
          rules={[
            {
              required: true,
              message: '请输入密码',
            },
            {
              min: 6,
              message: '密码至少6位',
            },
          ]}
        />
        <div
          style={{
            marginBottom: 24,
          }}
        >
          <ProFormCheckbox noStyle name="autoLogin">
            自动登录
          </ProFormCheckbox>
        </div>

        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
            还没有账户？
          </span>
          <Link
            to={`/register${redirect ? '?redirect=' + redirect : ''}`}
            style={{
              fontWeight: 'bold',
              color: token.colorPrimary,
              marginLeft: 8
            }}
          >
            立即注册
          </Link>
        </div>
      </LoginFormPage>
    </div>
  );
}
