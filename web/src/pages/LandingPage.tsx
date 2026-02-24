import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Typography, Row, Col, Avatar, Badge, Tag, Spin } from 'antd';
import './LandingPage.css';
import {
  RocketOutlined,
  BulbOutlined,
  TeamOutlined,
  DatabaseOutlined,
  ExperimentOutlined,
  TagsOutlined,
  LineChartOutlined,
  CheckCircleOutlined,
  StarOutlined,
  PlayCircleOutlined,
  ArrowRightOutlined,
  CodeOutlined,
  RobotOutlined,
  FileTextOutlined,
  SettingOutlined,
  GithubOutlined,
  WechatOutlined,
  MailOutlined,
  PhoneOutlined
} from '@ant-design/icons';
import { useAuth } from '@/contexts/UnifiedAuthContext';

const { Title, Text, Paragraph } = Typography;

export const LandingPage: React.FC = () => {
  const [, setActiveFeature] = useState(0);
  const { user, isLoaded, isSignedIn, logout } = useAuth();

  const features = [
    {
      icon: <BulbOutlined />,
      title: '智能提示词编辑器',
      description: '专业的提示词创建和编辑环境，支持语法高亮、实时预览和版本控制',
      color: '#1890ff',
      bgGradient: { from: '#e6f7ff', to: '#f0f9ff' },
      borderColor: '#e1f5fe',
      shadowColor: 'rgba(24, 144, 255, 0.08)',
      shadowColorHover: 'rgba(24, 144, 255, 0.15)',
      iconGradient: { from: '#1890ff', to: '#40a9ff' },
      iconShadow: 'rgba(24, 144, 255, 0.3)'
    },
    {
      icon: <DatabaseOutlined />,
      title: '数据集管理',
      description: '轻松管理测试数据集，支持批量导入、可视化预览和智能标注',
      color: '#52c41a',
      bgGradient: { from: '#f6ffed', to: '#f0fff4' },
      borderColor: '#d9f7be',
      shadowColor: 'rgba(82, 196, 26, 0.08)',
      shadowColorHover: 'rgba(82, 196, 26, 0.15)',
      iconGradient: { from: '#52c41a', to: '#73d13d' },
      iconShadow: 'rgba(82, 196, 26, 0.3)'
    },
    {
      icon: <ExperimentOutlined />,
      title: '自动化评估',
      description: '多维度评估系统，支持精确匹配、语义相似度、LLM评判等多种评估方法',
      color: '#722ed1',
      bgGradient: { from: '#f9f0ff', to: '#f6f0ff' },
      borderColor: '#efdbff',
      shadowColor: 'rgba(114, 46, 209, 0.08)',
      shadowColorHover: 'rgba(114, 46, 209, 0.15)',
      iconGradient: { from: '#722ed1', to: '#9254de' },
      iconShadow: 'rgba(114, 46, 209, 0.3)'
    },
    {
      icon: <TeamOutlined />,
      title: '团队协作',
      description: '多人协作工作空间，支持权限管理、标签系统和收藏功能',
      color: '#fa8c16',
      bgGradient: { from: '#fff7e6', to: '#fff2e8' },
      borderColor: '#ffd591',
      shadowColor: 'rgba(250, 140, 22, 0.08)',
      shadowColorHover: 'rgba(250, 140, 22, 0.15)',
      iconGradient: { from: '#fa8c16', to: '#ffa940' },
      iconShadow: 'rgba(250, 140, 22, 0.3)'
    }
  ];

  const evaluationMethods = [
    { name: '精确匹配', icon: <CheckCircleOutlined /> },
    { name: '多重匹配', icon: <TagsOutlined /> },
    { name: 'JSON提取', icon: <CodeOutlined /> },
    { name: 'LLM断言', icon: <RobotOutlined /> },
    { name: '正则表达式', icon: <FileTextOutlined /> },
    { name: '余弦相似度', icon: <LineChartOutlined /> },
    { name: '代码执行', icon: <SettingOutlined /> },
    { name: '人工评估', icon: <TeamOutlined /> }
  ];

  const useCases = [
    {
      title: 'AI产品开发',
      description: '为AI应用开发高质量的提示词，确保模型输出的准确性和一致性',
      icon: <RobotOutlined style={{ color: '#1890ff' }} />,
      examples: ['聊天机器人对话优化', '内容生成质量控制', 'API接口响应标准化']
    },
    {
      title: '内容创作',
      description: '为创意写作、营销文案、技术文档等场景优化提示词策略',
      icon: <FileTextOutlined style={{ color: '#52c41a' }} />,
      examples: ['营销文案模板', '技术文档生成', '创意故事写作']
    },
    {
      title: '数据分析',
      description: '构建专业的数据分析和报告生成的提示词，提高分析效率和质量',
      icon: <LineChartOutlined style={{ color: '#722ed1' }} />,
      examples: ['数据洞察提取', '报告自动生成', '趋势分析总结']
    },
    {
      title: '教育培训',
      description: '为在线教育、培训课程、知识问答系统开发教学辅助提示词',
      icon: <BulbOutlined style={{ color: '#fa8c16' }} />,
      examples: ['个性化学习指导', '作业批改助手', '知识点解析']
    }
  ];

  const testimonials = [
    {
      name: '李明',
      role: 'AI产品经理',
      company: '创新科技有限公司',
      content: 'PromptLab帮助我们的团队将提示词开发效率提升了300%，质量控制也更加严格可靠。',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=ming'
    },
    {
      name: '王小红',
      role: 'NLP工程师',
      company: '智能应用研发中心',
      content: '评估系统非常全面，多种评估方法让我们能够从不同角度验证提示词效果。',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=xiaohong'
    },
    {
      name: '张强',
      role: '技术总监',
      company: '数字化解决方案',
      content: '团队协作功能很棒，现在整个团队都能高效地参与提示词优化工作。',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=qiang'
    }
  ];

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)'
    }}>
      {/* 导航栏 */}
      <nav style={{
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid rgba(0, 0, 0, 0.05)',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <div style={{
          maxWidth: '1400px',
          margin: '0 auto',
          padding: '0 24px',
          height: '72px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              fontSize: '28px',
              fontWeight: 'bold',
              color: '#1890ff',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <RocketOutlined />
              PromptLab
            </div>
            <Badge
              style={{
                backgroundColor: '#1890ff',
                color: 'white',
                fontSize: '10px',
                height: '18px',
                lineHeight: '18px',
                borderRadius: '9px',
                padding: '0 6px',
                boxShadow: 'none'
              }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {!isLoaded && (
              <div className="loading">
                <Spin />
              </div>
            )}
            {isSignedIn && user && (
              <div className="user-info">
                欢迎回来，{user.name || user.username}

                <Button size="small" style={{ fontSize: '14px', padding: '4px', marginLeft: '10px' }} onClick={() => {
                  // 退出登录
                  logout()
                }}>
                  退出
                </Button>
              </div>
            )}
            {!isSignedIn && (
              <div className="auth-buttons">
                <Link to="/login">
                  <Button type="text" size="large" style={{ fontSize: '16px', height: '40px' }}>
                    登录
                  </Button>
                </Link>
                <Link to="/register">
                  <Button
                    type="primary"
                    size="large"
                    style={{
                      fontSize: '16px',
                      height: '40px',
                      padding: '0 24px',
                      borderRadius: '8px',
                      boxShadow: '0 4px 12px rgba(24, 144, 255, 0.3)'
                    }}
                  >
                    注册
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* 英雄区域 */}
      <section style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        position: 'relative',
        overflow: 'hidden',
        padding: '120px 0 100px 0'
      }}>
        {/* 背景装饰 */}
        <div style={{
          position: 'absolute',
          top: '-50%',
          right: '-20%',
          width: '800px',
          height: '800px',
          background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)',
          borderRadius: '50%'
        }} />
        <div style={{
          position: 'absolute',
          bottom: '-30%',
          left: '-10%',
          width: '600px',
          height: '600px',
          background: 'radial-gradient(circle, rgba(255,255,255,0.05) 0%, transparent 70%)',
          borderRadius: '50%'
        }} />

        <div style={{
          maxWidth: '1400px',
          margin: '0 auto',
          padding: '0 24px',
          textAlign: 'center',
          position: 'relative',
          zIndex: 1
        }}>
          {/* 顶部标签 */}
          <div style={{ marginBottom: '32px' }}>
            <Badge
              count="NEW"
              style={{
                backgroundColor: '#52c41a',
                color: 'white',
                fontSize: '12px',
                fontWeight: 'bold',
                padding: '4px 12px',
                borderRadius: '16px',
                boxShadow: '0 4px 12px rgba(82, 196, 26, 0.4)'
              }}
            >
              <Tag
                style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  color: 'white',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '20px',
                  padding: '8px 20px',
                  fontSize: '16px',
                  fontWeight: '500',
                  backdropFilter: 'blur(10px)'
                }}
              >
                🚀 专业AI提示词开发平台
              </Tag>
            </Badge>
          </div>

          {/* 主标题 */}
          <Title
            level={1}
            style={{
              fontSize: 'clamp(3rem, 8vw, 6rem)',
              lineHeight: 1.1,
              marginBottom: '24px',
              color: 'white',
              fontWeight: 'bold',
              textShadow: '0 4px 20px rgba(0,0,0,0.3)',
              background: 'linear-gradient(135deg, #ffffff 0%, #e6f7ff 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}
          >
            {'让AI提示词开发\n更高效、更专业'.split('\n').map((line, index) => (
              <span key={index}>
                {line}
                {index < '让AI提示词开发\n更高效、更专业'.split('\n').length - 1 && <br />}
              </span>
            ))}
          </Title>

          {/* 副标题 */}
          <Paragraph
            style={{
              fontSize: 'clamp(1.125rem, 3vw, 1.5rem)',
              color: 'rgba(255, 255, 255, 0.9)',
              marginBottom: '48px',
              maxWidth: '800px',
              margin: '0 auto 48px auto',
              lineHeight: 1.6,
              textShadow: '0 2px 10px rgba(0,0,0,0.2)'
            }}
          >
            {'专为AI开发者和内容创作者设计的一站式提示词管理平台\n通过智能编辑器、自动化评估和团队协作功能，显著提升开发效率和质量'.split('\n').map((line, index) => (
              <span key={index}>
                {line}
                {index < '专为AI开发者和内容创作者设计的一站式提示词管理平台\n通过智能编辑器、自动化评估和团队协作功能，显著提升开发效率和质量'.split('\n').length - 1 && <br />}
              </span>
            ))}
          </Paragraph>

          {/* 行动按钮 */}
          <div style={{
            marginBottom: '80px',
            display: 'flex',
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: '20px',
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            {isSignedIn ? (
              // 已登录：显示控制台入口
              <Link to="/project">
                <Button
                  type="primary"
                  size="large"
                  icon={<PlayCircleOutlined />}
                  style={{
                    height: '60px',
                    padding: '0 40px',
                    fontSize: '18px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, #1890ff 0%, #722ed1 100%)',
                    border: 'none',
                    boxShadow: '0 8px 25px rgba(24, 144, 255, 0.4)',
                    fontWeight: '600'
                  }}
                  className="landing-btn-primary"
                >
                  进入控制台
                </Button>
              </Link>
            ) : (
              // 未登录：显示注册按钮
              <Link to="/register">
                <Button
                  type="primary"
                  size="large"
                  icon={<PlayCircleOutlined />}
                  style={{
                    height: '60px',
                    padding: '0 40px',
                    fontSize: '18px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, #1890ff 0%, #722ed1 100%)',
                    border: 'none',
                    boxShadow: '0 8px 25px rgba(24, 144, 255, 0.4)',
                    fontWeight: '600'
                  }}
                  className="landing-btn-primary"
                >
                  立即开始使用
                </Button>
              </Link>
            )}
            <Link to="/login">
              <Button
                size="large"
                icon={<FileTextOutlined />}
                style={{
                  height: '60px',
                  padding: '0 40px',
                  fontSize: '18px',
                  borderRadius: '12px',
                  background: 'rgba(255, 255, 255, 0.15)',
                  color: 'white',
                  border: '2px solid rgba(255, 255, 255, 0.3)',
                  backdropFilter: 'blur(10px)',
                  fontWeight: '600'
                }}
                className="landing-btn-secondary"
              >
                观看演示
              </Button>
            </Link>
          </div>

          {/* 统计数据 */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(20px)',
            borderRadius: '24px',
            padding: '40px 20px',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            maxWidth: '1000px',
            margin: '0 auto'
          }}>
            <Row gutter={[32, 32]}>
              <Col xs={12} sm={6} md={6} lg={6}>
                <div style={{ textAlign: 'center', paddingLeft: '55px' }}>
                  <div style={{
                    fontSize: 'clamp(2rem, 4vw, 3rem)',
                    fontWeight: 'bold',
                    color: '#1890ff',
                    marginBottom: '8px',
                    textShadow: '0 2px 10px rgba(0,0,0,0.1)',
                  }}>
                    1,200+
                  </div>
                  <div style={{
                    fontSize: '16px',
                    color: 'rgba(255, 255, 255, 0.8)',
                    fontWeight: '500'
                  }}>
                    活跃用户
                  </div>
                </div>
              </Col>
              <Col xs={12} sm={6} md={6} lg={6}>
                <div style={{ textAlign: 'center', paddingLeft: '55px' }}>
                  <div style={{
                    fontSize: 'clamp(2rem, 4vw, 3rem)',
                    fontWeight: 'bold',
                    color: '#52c41a',
                    marginBottom: '8px',
                    textShadow: '0 2px 10px rgba(0,0,0,0.1)'
                  }}>
                    15,000+
                  </div>
                  <div style={{
                    fontSize: '16px',
                    color: 'rgba(255, 255, 255, 0.8)',
                    fontWeight: '500'
                  }}>
                    创建提示词
                  </div>
                </div>
              </Col>
              <Col xs={12} sm={6} md={6} lg={6}>
                <div style={{ textAlign: 'center', paddingLeft: '55px' }}>
                  <div style={{
                    fontSize: 'clamp(2rem, 4vw, 3rem)',
                    fontWeight: 'bold',
                    color: '#722ed1',
                    marginBottom: '8px',
                    textShadow: '0 2px 10px rgba(0,0,0,0.1)'
                  }}>
                    50,000+
                  </div>
                  <div style={{
                    fontSize: '16px',
                    color: 'rgba(255, 255, 255, 0.8)',
                    fontWeight: '500'
                  }}>
                    运行评估
                  </div>
                </div>
              </Col>
              <Col xs={12} sm={6} md={6} lg={6}>
                <div style={{ textAlign: 'center', paddingLeft: '55px' }}>
                  <div style={{
                    fontSize: 'clamp(2rem, 4vw, 3rem)',
                    fontWeight: 'bold',
                    color: '#fa8c16',
                    marginBottom: '8px',
                    textShadow: '0 2px 10px rgba(0,0,0,0.1)'
                  }}>
                    300%
                  </div>
                  <div style={{
                    fontSize: '16px',
                    color: 'rgba(255, 255, 255, 0.8)',
                    fontWeight: '500'
                  }}>
                    平均提效
                  </div>
                </div>
              </Col>
            </Row>
          </div>
        </div>
      </section>

      {/* 核心功能 */}
      <section style={{
        padding: '120px 0',
        background: 'linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)',
        position: 'relative'
      }}>
        <div style={{
          maxWidth: '1400px',
          margin: '0 auto',
          padding: '0 24px'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '80px' }}>
            <Title
              level={2}
              style={{
                fontSize: 'clamp(2rem, 5vw, 3.5rem)',
                fontWeight: 'bold',
                marginBottom: '24px',
                background: 'linear-gradient(135deg, #1890ff 0%, #722ed1 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
              }}
            >
              强大的功能，专业的体验
            </Title>
            <Paragraph style={{
              fontSize: '20px',
              color: '#666',
              maxWidth: '600px',
              margin: '0 auto',
              lineHeight: 1.6
            }}>
              全方位提升您的提示词开发工作流程
            </Paragraph>
          </div>

          <Row gutter={[40, 40]}>
            {features.map((feature, index) => (
              <Col key={index} xs={24} md={12} lg={6}>
                <div style={{
                  background: `linear-gradient(135deg, ${feature.bgGradient.from} 0%, ${feature.bgGradient.to} 100%)`,
                  borderRadius: '24px',
                  padding: '48px 32px',
                  textAlign: 'center',
                  height: '100%',
                  border: `1px solid ${feature.borderColor}`,
                  boxShadow: `0 8px 32px ${feature.shadowColor}`,
                  transition: 'all 0.3s ease',
                  cursor: 'pointer'
                }}
                  className="feature-card"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-8px)';
                    e.currentTarget.style.boxShadow = `0 16px 48px ${feature.shadowColorHover}`;
                    setActiveFeature(index);
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = `0 8px 32px ${feature.shadowColor}`;
                  }}
                >
                  <div style={{
                    width: '80px',
                    height: '80px',
                    borderRadius: '20px',
                    background: `linear-gradient(135deg, ${feature.iconGradient.from} 0%, ${feature.iconGradient.to} 100%)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 24px auto',
                    boxShadow: `0 8px 24px ${feature.iconShadow}`
                  }}>
                    <div style={{ fontSize: '36px', color: 'white' }}>
                      {feature.icon}
                    </div>
                  </div>
                  <Title level={4} style={{ marginBottom: '16px', fontSize: '22px' }}>
                    {feature.title}
                  </Title>
                  <Paragraph style={{ color: '#666', fontSize: '16px', lineHeight: 1.6, margin: 0 }}>
                    {feature.description}
                  </Paragraph>
                </div>
              </Col>
            ))}
          </Row>
        </div>
      </section>

      {/* 评估方法展示 */}
      <section style={{
        padding: '100px 0',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* 背景装饰 */}
        <div style={{
          position: 'absolute',
          top: '20%',
          left: '80%',
          width: '600px',
          height: '600px',
          background: 'radial-gradient(circle, rgba(255,255,255,0.05) 0%, transparent 70%)',
          borderRadius: '50%'
        }} />

        <div style={{
          maxWidth: '1400px',
          margin: '0 auto',
          padding: '0 24px',
          position: 'relative',
          zIndex: 1
        }}>
          <div style={{ textAlign: 'center', marginBottom: '80px' }}>
            <Title
              level={2}
              style={{
                fontSize: 'clamp(2rem, 5vw, 3.5rem)',
                fontWeight: 'bold',
                marginBottom: '24px',
                color: 'white',
                textShadow: '0 4px 20px rgba(0,0,0,0.3)'
              }}
            >
              多维度评估系统
            </Title>
            <Paragraph style={{
              fontSize: '20px',
              color: 'rgba(255, 255, 255, 0.9)',
              maxWidth: '600px',
              margin: '0 auto',
              lineHeight: 1.6,
              textShadow: '0 2px 10px rgba(0,0,0,0.2)'
            }}>
              支持8+种评估方法，全面验证提示词效果
            </Paragraph>
          </div>

          <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
            <Row gutter={[24, 24]}>
              {evaluationMethods.map((method, index) => (
                <Col key={index} xs={12} sm={8} md={6} lg={6}>
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.15)',
                    backdropFilter: 'blur(20px)',
                    borderRadius: '16px',
                    padding: '24px 16px',
                    textAlign: 'center',
                    height: '120px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    transition: 'all 0.3s ease',
                    cursor: 'pointer'
                  }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-4px)';
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                    }}
                  >
                    <div style={{
                      fontSize: '28px',
                      color: 'white',
                      marginBottom: '8px',
                      textShadow: '0 2px 8px rgba(0,0,0,0.3)'
                    }}>
                      {method.icon}
                    </div>
                    <Text style={{
                      color: 'white',
                      fontWeight: '600',
                      fontSize: '14px',
                      textShadow: '0 1px 4px rgba(0,0,0,0.3)'
                    }}>
                      {method.name}
                    </Text>
                  </div>
                </Col>
              ))}
            </Row>
          </div>
        </div>
      </section>

      {/* 使用场景 */}
      <section style={{
        padding: '120px 0',
        background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
        position: 'relative'
      }}>
        <div style={{
          maxWidth: '1400px',
          margin: '0 auto',
          padding: '0 24px'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '80px' }}>
            <Title
              level={2}
              style={{
                fontSize: 'clamp(2rem, 5vw, 3.5rem)',
                fontWeight: 'bold',
                marginBottom: '24px',
                background: 'linear-gradient(135deg, #1890ff 0%, #722ed1 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
              }}
            >
              适用于多种场景
            </Title>
            <Paragraph style={{
              fontSize: '20px',
              color: '#666',
              maxWidth: '600px',
              margin: '0 auto',
              lineHeight: 1.6
            }}>
              无论您在哪个领域，PromptLab都能助您成功
            </Paragraph>
          </div>

          <Row gutter={[40, 40]}>
            {useCases.map((useCase, index) => (
              <Col key={index} xs={24} md={12}>
                <div style={{
                  background: 'white',
                  borderRadius: '24px',
                  padding: '40px',
                  height: '100%',
                  border: '1px solid #f0f0f0',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
                  transition: 'all 0.3s ease',
                  cursor: 'pointer'
                }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-8px)';
                    e.currentTarget.style.boxShadow = '0 16px 48px rgba(0, 0, 0, 0.12)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.08)';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '24px' }}>
                    <div style={{
                      fontSize: '48px',
                      flexShrink: 0,
                      marginTop: '8px'
                    }}>
                      {useCase.icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <Title level={4} style={{
                        marginBottom: '16px',
                        fontSize: '24px',
                        color: '#262626'
                      }}>
                        {useCase.title}
                      </Title>
                      <Paragraph style={{
                        color: '#666',
                        marginBottom: '24px',
                        fontSize: '16px',
                        lineHeight: 1.6
                      }}>
                        {useCase.description}
                      </Paragraph>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {useCase.examples.map((example, idx) => (
                          <Tag
                            key={idx}
                            style={{
                              background: 'linear-gradient(135deg, #e6f7ff 0%, #f0f9ff 100%)',
                              color: '#1890ff',
                              border: '1px solid #91d5ff',
                              borderRadius: '20px',
                              padding: '4px 12px',
                              fontSize: '12px',
                              fontWeight: '500'
                            }}
                          >
                            {example}
                          </Tag>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </Col>
            ))}
          </Row>
        </div>
      </section>

      {/* 用户评价 */}
      <section style={{
        padding: '120px 0',
        background: 'linear-gradient(135deg, #f6ffed 0%, #e6f7ff 100%)',
        position: 'relative'
      }}>
        <div style={{
          maxWidth: '1400px',
          margin: '0 auto',
          padding: '0 24px'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '80px' }}>
            <Title
              level={2}
              style={{
                fontSize: 'clamp(2rem, 5vw, 3.5rem)',
                fontWeight: 'bold',
                marginBottom: '24px',
                background: 'linear-gradient(135deg, #1890ff 0%, #722ed1 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
              }}
            >
              用户反馈
            </Title>
            <Paragraph style={{
              fontSize: '20px',
              color: '#666',
              maxWidth: '600px',
              margin: '0 auto',
              lineHeight: 1.6
            }}>
              看看其他用户如何评价PromptLab
            </Paragraph>
          </div>

          <Row gutter={[40, 40]}>
            {testimonials.map((testimonial, index) => (
              <Col key={index} xs={24} md={8}>
                <div style={{
                  background: 'white',
                  borderRadius: '24px',
                  padding: '32px',
                  height: '100%',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.8)',
                  transition: 'all 0.3s ease',
                  cursor: 'pointer'
                }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-8px)';
                    e.currentTarget.style.boxShadow = '0 16px 48px rgba(0, 0, 0, 0.12)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.08)';
                  }}
                >
                  <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                    <div style={{
                      color: '#faad14',
                      fontSize: '20px',
                      marginBottom: '16px',
                      filter: 'drop-shadow(0 2px 4px rgba(250, 173, 20, 0.3))'
                    }}>
                      {[...Array(5)].map((_, i) => <StarOutlined key={i} />)}
                    </div>
                    <Paragraph style={{
                      fontStyle: 'italic',
                      color: '#666',
                      fontSize: '16px',
                      lineHeight: 1.6,
                      margin: 0,
                      position: 'relative'
                    }}>
                      <span style={{
                        fontSize: '32px',
                        color: '#d9d9d9',
                        position: 'absolute',
                        left: '-8px',
                        top: '-8px'
                      }}>"</span>
                      {testimonial.content}
                      <span style={{
                        fontSize: '32px',
                        color: '#d9d9d9'
                      }}>"</span>
                    </Paragraph>
                  </div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '16px'
                  }}>
                    <Avatar
                      size={56}
                      src={testimonial.avatar}
                      style={{
                        border: '3px solid #f0f0f0',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
                      }}
                    />
                    <div style={{ textAlign: 'left' }}>
                      <div style={{
                        fontWeight: '600',
                        fontSize: '16px',
                        color: '#262626',
                        marginBottom: '4px'
                      }}>
                        {testimonial.name}
                      </div>
                      <div style={{
                        fontSize: '14px',
                        color: '#666',
                        marginBottom: '2px'
                      }}>
                        {testimonial.role}
                      </div>
                      <div style={{
                        fontSize: '13px',
                        color: '#999'
                      }}>
                        {testimonial.company}
                      </div>
                    </div>
                  </div>
                </div>
              </Col>
            ))}
          </Row>
        </div>
      </section>

      {/* 开始使用 */}
      <section style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        position: 'relative',
        overflow: 'hidden',
        padding: '120px 0'
      }}>
        {/* 背景装饰 */}
        <div style={{
          position: 'absolute',
          top: '-30%',
          left: '-20%',
          width: '800px',
          height: '800px',
          background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)',
          borderRadius: '50%'
        }} />
        <div style={{
          position: 'absolute',
          bottom: '-40%',
          right: '-10%',
          width: '600px',
          height: '600px',
          background: 'radial-gradient(circle, rgba(255,255,255,0.05) 0%, transparent 70%)',
          borderRadius: '50%'
        }} />

        <div style={{
          maxWidth: '1000px',
          margin: '0 auto',
          textAlign: 'center',
          padding: '0 24px',
          position: 'relative',
          zIndex: 1
        }}>
          <Title
            level={2}
            style={{
              fontSize: 'clamp(2.5rem, 6vw, 4rem)',
              fontWeight: 'bold',
              marginBottom: '24px',
              color: 'white',
              textShadow: '0 4px 20px rgba(0,0,0,0.3)',
              lineHeight: 1.2
            }}
          >
            准备开始您的AI提示词开发之旅？
          </Title>
          <Paragraph style={{
            fontSize: 'clamp(1.125rem, 3vw, 1.5rem)',
            color: 'rgba(255, 255, 255, 0.9)',
            marginBottom: '48px',
            maxWidth: '700px',
            margin: '0 auto 48px auto',
            lineHeight: 1.6,
            textShadow: '0 2px 10px rgba(0,0,0,0.2)'
          }}>
            立即注册，免费体验PromptLab的强大功能
          </Paragraph>
          <div style={{
            display: 'flex',
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: '24px',
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            {isSignedIn ? (
              // 已登录：显示控制台入口
              <Link to="/project">
                <Button
                  type="primary"
                  size="large"
                  icon={<ArrowRightOutlined />}
                  style={{
                    height: '64px',
                    padding: '0 48px',
                    fontSize: '18px',
                    borderRadius: '12px',
                    background: 'white',
                    color: '#667eea',
                    border: 'none',
                    boxShadow: '0 8px 25px rgba(255, 255, 255, 0.3)',
                    fontWeight: '600'
                  }}
                  onMouseEnter={(e) => {
                    const target = e.currentTarget as HTMLElement;
                    target.style.transform = 'translateY(-2px)';
                    target.style.boxShadow = '0 12px 30px rgba(255, 255, 255, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    const target = e.currentTarget as HTMLElement;
                    target.style.transform = 'translateY(0)';
                    target.style.boxShadow = '0 8px 25px rgba(255, 255, 255, 0.3)';
                  }}
                >
                  进入控制台
                </Button>
              </Link>
            ) : (
              // 未登录：显示注册按钮
              <Link to="/register">
                <Button
                  type="primary"
                  size="large"
                  icon={<ArrowRightOutlined />}
                  style={{
                    height: '64px',
                    padding: '0 48px',
                    fontSize: '18px',
                    borderRadius: '12px',
                    background: 'white',
                    color: '#667eea',
                    border: 'none',
                    boxShadow: '0 8px 25px rgba(255, 255, 255, 0.3)',
                    fontWeight: '600'
                  }}
                  onMouseEnter={(e) => {
                    const target = e.currentTarget as HTMLElement;
                    target.style.transform = 'translateY(-2px)';
                    target.style.boxShadow = '0 12px 30px rgba(255, 255, 255, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    const target = e.currentTarget as HTMLElement;
                    target.style.transform = 'translateY(0)';
                    target.style.boxShadow = '0 8px 25px rgba(255, 255, 255, 0.3)';
                  }}
                >
                  免费注册使用
                </Button>
              </Link>
            )}
            <Button
              size="large"
              style={{
                height: '64px',
                padding: '0 48px',
                fontSize: '18px',
                borderRadius: '12px',
                background: 'rgba(255, 255, 255, 0.15)',
                color: 'white',
                border: '2px solid rgba(255, 255, 255, 0.3)',
                backdropFilter: 'blur(10px)',
                fontWeight: '600'
              }}
              onMouseEnter={(e) => {
                const target = e.currentTarget as HTMLElement;
                target.style.background = 'rgba(255, 255, 255, 0.25)';
                target.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                const target = e.currentTarget as HTMLElement;
                target.style.background = 'rgba(255, 255, 255, 0.15)';
                target.style.transform = 'translateY(0)';
              }}
            >
              联系销售团队
            </Button>
          </div>
        </div>
      </section>

      {/* 页脚 */}
      <footer style={{
        background: '#001529',
        color: 'white',
        padding: '80px 0 40px 0',
        position: 'relative'
      }}>
        <div style={{
          maxWidth: '1400px',
          margin: '0 auto',
          padding: '0 24px'
        }}>
          <Row gutter={[48, 48]}>
            <Col xs={24} sm={12} md={8}>
              <div style={{ marginBottom: '32px' }}>
                <div style={{
                  fontSize: '28px',
                  fontWeight: 'bold',
                  color: '#1890ff',
                  marginBottom: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <RocketOutlined />
                  PromptLab
                </div>
                <Paragraph style={{
                  color: '#8c8c8c',
                  lineHeight: 1.8,
                  fontSize: '16px',
                  maxWidth: '300px'
                }}>
                  专业的AI提示词开发与管理平台，为开发者和创作者提供高效的提示词工程解决方案。
                </Paragraph>
                <div style={{
                  display: 'flex',
                  gap: '16px',
                  marginTop: '24px'
                }}>
                  <Button
                    type="text"
                    icon={<GithubOutlined />}
                    size="large"
                    onClick={() => {
                      // 另起页面
                      window.open('https://github.com/xsg22', '_blank');
                    }}
                    style={{
                      color: '#8c8c8c',
                      transition: 'color 0.3s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = '#1890ff';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = '#8c8c8c';
                    }}
                  />
                  {/* <Button 
                    type="text" 
                    icon={<WechatOutlined />} 
                    size="large"
                    style={{ 
                      color: '#8c8c8c',
                      transition: 'color 0.3s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = '#52c41a';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = '#8c8c8c';
                    }}
                  /> */}
                  <Button
                    type="text"
                    icon={<MailOutlined />}
                    size="large"
                    style={{
                      color: '#8c8c8c',
                      transition: 'color 0.3s ease'
                    }}
                    onClick={() => {
                      window.location.href = 'mailto:xsgnzb1@gmail.com';
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = '#fa8c16';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = '#8c8c8c';
                    }}
                  />
                </div>
              </div>
            </Col>
            <Col xs={12} sm={6} md={4}>
              <Title level={5} style={{
                color: 'white',
                marginBottom: '24px',
                fontSize: '18px'
              }}>
                产品功能
              </Title>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <a href="#" style={{
                  color: '#8c8c8c',
                  textDecoration: 'none',
                  fontSize: '15px',
                  transition: 'color 0.3s ease'
                }} onMouseEnter={(e: any) => e.target.style.color = '#1890ff'} onMouseLeave={(e: any) => e.target.style.color = '#8c8c8c'}>
                  智能编辑器
                </a>
                <a href="#" style={{
                  color: '#8c8c8c',
                  textDecoration: 'none',
                  fontSize: '15px',
                  transition: 'color 0.3s ease'
                }} onMouseEnter={(e: any) => e.target.style.color = '#1890ff'} onMouseLeave={(e: any) => e.target.style.color = '#8c8c8c'}>
                  数据集管理
                </a>
                <a href="#" style={{
                  color: '#8c8c8c',
                  textDecoration: 'none',
                  fontSize: '15px',
                  transition: 'color 0.3s ease'
                }} onMouseEnter={(e: any) => e.target.style.color = '#1890ff'} onMouseLeave={(e: any) => e.target.style.color = '#8c8c8c'}>
                  自动评估
                </a>
                <a href="#" style={{
                  color: '#8c8c8c',
                  textDecoration: 'none',
                  fontSize: '15px',
                  transition: 'color 0.3s ease'
                }} onMouseEnter={(e: any) => e.target.style.color = '#1890ff'} onMouseLeave={(e: any) => e.target.style.color = '#8c8c8c'}>
                  团队协作
                </a>
              </div>
            </Col>
            <Col xs={12} sm={6} md={4}>
              <Title level={5} style={{
                color: 'white',
                marginBottom: '24px',
                fontSize: '18px'
              }}>
                解决方案
              </Title>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <a href="#" style={{
                  color: '#8c8c8c',
                  textDecoration: 'none',
                  fontSize: '15px',
                  transition: 'color 0.3s ease'
                }} onMouseEnter={(e: any) => e.target.style.color = '#1890ff'} onMouseLeave={(e: any) => e.target.style.color = '#8c8c8c'}>
                  AI产品开发
                </a>
                <a href="#" style={{
                  color: '#8c8c8c',
                  textDecoration: 'none',
                  fontSize: '15px',
                  transition: 'color 0.3s ease'
                }} onMouseEnter={(e: any) => e.target.style.color = '#1890ff'} onMouseLeave={(e: any) => e.target.style.color = '#8c8c8c'}>
                  内容创作
                </a>
                <a href="#" style={{
                  color: '#8c8c8c',
                  textDecoration: 'none',
                  fontSize: '15px',
                  transition: 'color 0.3s ease'
                }} onMouseEnter={(e: any) => e.target.style.color = '#1890ff'} onMouseLeave={(e: any) => e.target.style.color = '#8c8c8c'}>
                  数据分析
                </a>
                <a href="#" style={{
                  color: '#8c8c8c',
                  textDecoration: 'none',
                  fontSize: '15px',
                  transition: 'color 0.3s ease'
                }} onMouseEnter={(e: any) => e.target.style.color = '#1890ff'} onMouseLeave={(e: any) => e.target.style.color = '#8c8c8c'}>
                  教育培训
                </a>
              </div>
            </Col>
            <Col xs={12} sm={6} md={4}>
              <Title level={5} style={{
                color: 'white',
                marginBottom: '24px',
                fontSize: '18px'
              }}>
                支持帮助
              </Title>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <a href="#" style={{
                  color: '#8c8c8c',
                  textDecoration: 'none',
                  fontSize: '15px',
                  transition: 'color 0.3s ease'
                }} onMouseEnter={(e: any) => e.target.style.color = '#1890ff'} onMouseLeave={(e: any) => e.target.style.color = '#8c8c8c'}>
                  使用文档
                </a>
                {/* <a href="#" style={{
                  color: '#8c8c8c',
                  textDecoration: 'none',
                  fontSize: '15px',
                  transition: 'color 0.3s ease'
                }} onMouseEnter={(e: any) => e.target.style.color = '#1890ff'} onMouseLeave={(e: any) => e.target.style.color = '#8c8c8c'}>
                  API参考
                </a> */}
                <a href="#" style={{
                  color: '#8c8c8c',
                  textDecoration: 'none',
                  fontSize: '15px',
                  transition: 'color 0.3s ease'
                }} onMouseEnter={(e: any) => e.target.style.color = '#1890ff'} onMouseLeave={(e: any) => e.target.style.color = '#8c8c8c'}>
                  社区论坛
                </a>
                <a style={{
                  color: '#8c8c8c',
                  textDecoration: 'none',
                  fontSize: '15px',
                  transition: 'color 0.3s ease'
                }} onMouseEnter={(e: any) => e.target.style.color = '#1890ff'} onMouseLeave={(e: any) => e.target.style.color = '#8c8c8c'} onClick={() => {
                  window.location.href = 'mailto:xsgnzb1@gmail.com';
                }}>
                  联系客服
                </a>
              </div>
            </Col>
            <Col xs={24} sm={12} md={4}>
              <Title level={5} style={{
                color: 'white',
                marginBottom: '24px',
                fontSize: '18px'
              }}>
                联系方式
              </Title>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ color: '#8c8c8c', fontSize: '15px' }}>
                  <MailOutlined style={{ marginRight: '8px', color: '#1890ff' }} />
                  xsgnzb1@gmail.com
                </div>
                <div style={{ color: '#8c8c8c', fontSize: '15px' }}>
                  <WechatOutlined style={{ marginRight: '8px', color: '#52c41a' }} />
                  SGXue_1002
                </div>
                <div style={{ color: '#8c8c8c', fontSize: '15px' }}>
                  <PhoneOutlined style={{ marginRight: '8px', color: '#fa8c16' }} />
                  183-9706-6749
                </div>
              </div>
            </Col>
          </Row>

          <div style={{
            borderTop: '1px solid #434343',
            marginTop: '60px',
            paddingTop: '32px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px'
          }}>
            <div style={{ color: '#8c8c8c', fontSize: '14px' }}>
              © 2024 PromptLab. 保留所有权利.
            </div>
            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
              <a href="#" style={{
                color: '#8c8c8c',
                textDecoration: 'none',
                fontSize: '14px',
                transition: 'color 0.3s ease'
              }} onMouseEnter={(e: any) => e.target.style.color = '#1890ff'} onMouseLeave={(e: any) => e.target.style.color = '#8c8c8c'}>
                隐私政策
              </a>
              <a href="#" style={{
                color: '#8c8c8c',
                textDecoration: 'none',
                fontSize: '14px',
                transition: 'color 0.3s ease'
              }} onMouseEnter={(e: any) => e.target.style.color = '#1890ff'} onMouseLeave={(e: any) => e.target.style.color = '#8c8c8c'}>
                服务条款
              </a>
              <a href="#" style={{
                color: '#8c8c8c',
                textDecoration: 'none',
                fontSize: '14px',
                transition: 'color 0.3s ease'
              }} onMouseEnter={(e: any) => e.target.style.color = '#1890ff'} onMouseLeave={(e: any) => e.target.style.color = '#8c8c8c'}>
                用户协议
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}; 