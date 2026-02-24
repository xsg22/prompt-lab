import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Tabs, Typography, notification, Spin } from 'antd';
import { ProjectAPI } from '@/lib/api';
import { ModelsManagementSection } from '@/components/settings/ModelsManagementSection';
import { MembersSection } from '@/components/settings/MembersSection';
import { ProjectInfoSection } from '@/components/settings/ProjectInfoSection';
import { AIFeatureModelsSection } from '@/components/settings/AIFeatureModelsSection';
import { useAuth } from '@/contexts/UnifiedAuthContext';

const { Title } = Typography;
const { TabPane } = Tabs;

interface Member {
  id: number;
  user_id: number;
  email: string;
  nickname?: string;
  role: 'admin' | 'member' | 'readonly';
}

export function ProjectSettings() {
  const { projectId } = useParams();
  const [activeTab, setActiveTab] = useState('members');
  const [, setProjectInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserRole, setCurrentUserRole] = useState<'admin' | 'member' | 'readonly' | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (projectId) {
      setLoading(true);

      // 并行获取项目信息和用户角色
      Promise.all([
        ProjectAPI.getProjectDetails(parseInt(projectId)),
        ProjectAPI.getProjectMembers(parseInt(projectId)),
      ])
        .then(([projectRes, membersRes]) => {
          setProjectInfo(projectRes.data);

          // 获取当前用户在该项目中的角色
          const currentUser = membersRes.data.find((member: Member) => member.user_id === Number(user?.id));
          setCurrentUserRole(currentUser?.role || null);
        })
        .catch(err => {
          notification.error({
            message: '获取项目信息失败',
            description: err.message
          });
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [projectId]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <Title level={2}>项目设置</Title>
      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane tab="成员管理" key="members">
          <MembersSection projectId={projectId} />
        </TabPane>
        {currentUserRole === 'admin' && (
          <TabPane tab="项目信息" key="project-info">
            <ProjectInfoSection projectId={projectId} />
          </TabPane>
        )}
        {/* <TabPane tab="API Keys" key="apikeys">
          <ApiKeysSection projectId={projectId} />
        </TabPane> */}
        <TabPane tab="模型管理" key="models">
          <ModelsManagementSection projectId={parseInt(projectId!)} />
        </TabPane>
        <TabPane tab="AI功能模型" key="ai-feature-models">
          <AIFeatureModelsSection projectId={parseInt(projectId!)} />
        </TabPane>
        {/* <TabPane tab="账单" key="billing">
          <BillingSection projectId={projectId} />
        </TabPane> */}
      </Tabs>
    </div>
  );
}

export default ProjectSettings; 