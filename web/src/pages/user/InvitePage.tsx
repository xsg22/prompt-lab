import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Button, Card, Typography, Spin, Space, message } from 'antd';
import { InviteAPI } from '@/lib/api';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import styled from 'styled-components';

const { Title, Text } = Typography;

interface InviteInfo {
  projectId: number;
  projectName: string;
  inviterName: string;
}

const Container = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background-color: #f5f5f5;
`;

const StyledCard = styled(Card)`
  width: 100%;
  max-width: 500px;
  text-align: center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
`;

const Logo = styled.div`
  margin-bottom: 24px;
  
  img {
    width: 120px;
    height: auto;
  }
`;

const ActionContainer = styled.div`
  margin-top: 24px;
`;

export default function InvitePage() {
  const params = useParams();
  const { token } = params;
  const navigate = useNavigate();
  const { isSignedIn, isLoaded } = useAuth();
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    validateInvite();
  }, [token]);

  const validateInvite = async () => {
    if (!token) {
      setError('无效的邀请链接');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const res = await InviteAPI.validateInvite(token);
      setInviteInfo(res.data);
    } catch (err: any) {
      console.error('验证邀请链接失败:', err);
      setError(err.response?.data?.message || '无效的邀请链接');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinProject = async () => {
    if (!token || !inviteInfo) return;

    try {
      setJoining(true);
      const res = await InviteAPI.acceptInvite(token);
      message.success(res.data.message || '成功加入项目', 3);
      
      // 加入成功后跳转到项目页面
      setTimeout(() => {
        navigate(`/project/${inviteInfo.projectId}/prompts`);
      }, 3000);
    } catch (err: any) {
      console.error('加入项目失败:', err);
      message.error(err.response?.data?.message || '加入项目失败，请重试', 3);
    } finally {
      setJoining(false);
    }
  };

  if (loading || !isLoaded) {
    return (
      <Container>
        <StyledCard>
          <Spin size="large" />
          <Text style={{ display: 'block', marginTop: 16 }}>
            {loading ? '正在验证邀请链接...' : '正在检查登录状态...'}
          </Text>
        </StyledCard>
      </Container>
    );
  }

  if (error) {
    return (
      <Container>
        <StyledCard>
          <Title level={3}>邀请链接错误</Title>
          <Text type="danger">{error}</Text>
          <ActionContainer>
            <Button type="primary" onClick={() => navigate('/')}>
              返回首页
            </Button>
          </ActionContainer>
        </StyledCard>
      </Container>
    );
  }

  return (
    <Container>
      <StyledCard>
        <Logo>
          <img src="/favicon.png" alt="Prompt Lab Logo" />
        </Logo>
        <Title level={3}>
          {inviteInfo?.inviterName} 邀请你加入项目 {inviteInfo?.projectName}
        </Title>
        
        <ActionContainer>
          {isSignedIn ? (
            <Button 
              type="primary" 
              size="large" 
              onClick={handleJoinProject}
              loading={joining}
            >
              加入项目
            </Button>
          ) : (
            <Space direction="vertical" size="middle">
              <Text>请先登录或注册账号</Text>
              <Space>
                <Button type="primary" size="large">
                  <Link to={`/login?redirect=${window.location.pathname}`}>登录</Link>
                </Button>
                <Button size="large">
                  <Link to={`/register?redirect=${window.location.pathname}`}>注册</Link>
                </Button>
              </Space>
            </Space>
          )}
        </ActionContainer>
      </StyledCard>
    </Container>
  );
}
