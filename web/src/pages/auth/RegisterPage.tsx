import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { 
  theme,
  message
} from "antd";
import { 
  UserOutlined, 
  LockOutlined} from '@ant-design/icons';
import { 
  LoginFormPage, 
  ProFormText} from '@ant-design/pro-components';
import { useAuth } from "@/contexts/UnifiedAuthContext";



export function RegisterPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const { register, isSignedIn } = useAuth();
  const { token } = theme.useToken();
  const redirect = new URLSearchParams(window.location.search).get('redirect');

  if (isSignedIn) {
    navigate("/project");
    return;
  }

  const onSubmit = async (values: any) => {
    setLoading(true);
    try {
      await register(values.username, values.password, values.nickname);
      message.success('注册成功，请登录', 1, () => {
        if (redirect) {
          navigate(`/login?redirect=${redirect}`);
        } else {
          navigate("/login");
        }
      });
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || '注册失败，请稍后重试';
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
        subTitle="创建您的个人账户"
        containerStyle={{
          backgroundColor: 'rgba(155, 153, 153, 0.65)',
          backdropFilter: 'blur(8px)',
          borderRadius: '12px',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)'
        }}
        submitter={{
          searchConfig: {
            submitText: '注册',
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
            {
              min: 3,
              message: '账号至少3个字符',
            },
          ]}
        />
        <ProFormText
          name="nickname"
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
          placeholder="请输入昵称（选填）"
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
          placeholder="请设置密码"
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

        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
            已有账户？
          </span>
          <Link
            to={`/login${redirect ? '?redirect=' + redirect : ''}`}
            style={{
              fontWeight: 'bold',
              color: token.colorPrimary,
              marginLeft: 8
            }}
          >
            立即登录
          </Link>
        </div>
      </LoginFormPage>
    </div>
  );
}
