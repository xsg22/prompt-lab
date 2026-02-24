import React, { useState } from 'react';
import { Navigate, Link, useNavigate } from 'react-router-dom';
import { theme, App } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { LoginFormPage, ProFormText } from '@ant-design/pro-components';
import { useAuth } from '@/contexts/UnifiedAuthContext';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const { login, isSignedIn } = useAuth();
  const redirect = new URLSearchParams(window.location.search).get('redirect');

  if (isSignedIn) {
    return <Navigate to="/project" replace />;
  }

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
        backgroundImageUrl="/auth_bg.png"
        backgroundVideoUrl="/auth_video.mp4"
        logo="/favicon.png"
        title="PromptLab"
        subTitle="专业的AI提示词管理平台"
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
};

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const { register, isSignedIn } = useAuth();
  const redirect = new URLSearchParams(window.location.search).get('redirect');

  if (isSignedIn) {
    return <Navigate to="/project" replace />;
  }

  const onSubmit = async (values: any) => {
    setLoading(true);
    try {
      await register(values.username, values.password, values.nickname);
      message.success('注册成功', 1, () => {
        if (redirect) {
          navigate(`/login?redirect=${redirect}`);
        } else {
          navigate("/login");
        }
      });
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || '注册失败，请重试';
      message.error(errorMessage);      
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ height: '100vh' }}>
      <LoginFormPage
        onFinish={onSubmit}
        backgroundImageUrl="/auth_bg.png"
        backgroundVideoUrl="/auth_video.mp4"
        logo="/favicon.png"
        title="PromptLab"
        subTitle="专业的AI提示词管理平台"
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
};
