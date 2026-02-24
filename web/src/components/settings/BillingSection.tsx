import { useState, useEffect } from 'react';
import { Card, Typography, Button, Row, Col, Progress, Divider, Spin } from 'antd';
import { ProjectAPI } from '@/lib/api';

const { Title, Text, Link } = Typography;

interface BillingSectionProps {
  projectId?: string;
}

interface BillingInfo {
  planName: string;
  requestCount: number;
  requestLimit: number;
  retrievalCount: number;
  retrievalLimit: number | null;
  stripePortalUrl?: string;
}

export function BillingSection({ projectId }: BillingSectionProps) {
  const [billingInfo, setBillingInfo] = useState<BillingInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (projectId) {
      setLoading(true);
      ProjectAPI.getBillingInfo(parseInt(projectId))
        .then(res => {
          setBillingInfo(res.data);
        })
        .catch(err => {
          console.error('获取账单信息失败', err);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [projectId]);

  if (loading) {
    return <Spin size="large" />;
  }

  if (!billingInfo) {
    return <Text>无法获取账单信息</Text>;
  }

  return (
    <div>
      <Card>
        <Row gutter={[16, 16]}>
          <Col span={24}>
            <Title level={4}>账单信息</Title>
            <Text>当前计划: {billingInfo.planName}</Text>
            {billingInfo.stripePortalUrl && (
              <Button 
                type="primary" 
                style={{ marginLeft: 16 }}
                onClick={() => window.open(billingInfo.stripePortalUrl, '_blank')}
              >
                更改计划
              </Button>
            )}
          </Col>
        </Row>
        <Divider />
        
        <Row gutter={[24, 24]}>
          <Col span={12}>
            <Card title="请求使用量" bordered={false}>
              <Typography.Title level={5}>
                {billingInfo.requestCount} of {billingInfo.requestLimit} 请求
              </Typography.Title>
              <Progress 
                percent={Math.min(100, (billingInfo.requestCount / billingInfo.requestLimit) * 100)} 
                showInfo={false} 
              />
            </Card>
          </Col>
          
          <Col span={12}>
            <Card title="提示词检索使用量" bordered={false}>
              <Typography.Title level={5}>
                {billingInfo.retrievalCount} 检索
                {billingInfo.retrievalLimit && ` of ${billingInfo.retrievalLimit}`}
              </Typography.Title>
              {billingInfo.retrievalLimit && (
                <Progress 
                  percent={Math.min(100, (billingInfo.retrievalCount / billingInfo.retrievalLimit) * 100)} 
                  showInfo={false} 
                />
              )}
            </Card>
          </Col>
        </Row>
      </Card>

      {/* <div style={{ marginTop: 16 }}>
        <Text>您当前在 <strong>{billingInfo.planName}</strong> 计划上。使用 </Text>
        <Link href="https://stripe.com" target="_blank">Stripe 门户</Link>
        <Text> 编辑您的账单详情。</Text>
      </div> */}

      <div style={{ marginTop: 8 }}>
        <Text>
          了解更多关于定价的信息，请查看我们的 
          <Link href="/docs" target="_blank">文档</Link> 或联系我们：
          <Link href="mailto:support@promptlab.cn">support@promptlab.cn</Link>
        </Text>
      </div>
    </div>
  );
} 