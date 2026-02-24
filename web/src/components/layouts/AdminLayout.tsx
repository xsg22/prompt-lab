"use client"

import { useEffect, useState, type ReactNode } from 'react'
import { Layout, Menu, theme, Dropdown, Button, Space, Tooltip } from 'antd'
import type { MenuProps } from 'antd'
import {
  DatabaseOutlined,
  TableOutlined,
  BarChartOutlined,
  DownOutlined,
  PlusOutlined,
  SettingOutlined
} from '@ant-design/icons'
import { Link, Outlet, useNavigate, useParams } from 'react-router-dom'
import { useLocation } from 'react-router-dom'
import { UserNav } from '../ui/UserNav'
import { UserAPI } from '@/lib/api'
import type { Project } from '@/types/Project'
import { useAuth } from '@/contexts/UnifiedAuthContext'
import { useProject } from '@/contexts/ProjectContext'
import { CreateProjectModal } from '../CreateProjectModal'

const { Header, Content, Footer } = Layout

export interface AdminLayoutProps {
  children?: ReactNode
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const { currentProject, projects, setCurrentProject, setProjects, addProject } = useProject();
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const { user } = useAuth();
  const projectId = useParams().projectId
  const navigate = useNavigate()
  const pathname = useLocation().pathname
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken()

  const getProjectId = () => {
    return projectId || currentProject?.id || null;
  }

  const menuItems = [
    {
      key: 'prompts',
      icon: <DatabaseOutlined />,
      label: '提示词库',
      path: '/project/' + getProjectId() + '/prompts',
    },
    {
      key: 'datasets',
      icon: <TableOutlined />,
      label: '数据集管理',
      path: '/project/' + getProjectId() + '/datasets',
    },
    {
      key: 'eval-pipelines',
      icon: <BarChartOutlined />,
      label: '提示词评估',
      path: '/project/' + getProjectId() + '/eval-pipelines',
    }
  ]

  useEffect(() => {
    if (currentProject) {
      if (!projectId) {
        navigate(`/project/${currentProject.id}/prompts`)
      }
      return;
    }

    UserAPI.getProjects().then(res => {
      setProjects(res.data)

      if (projectId) {
        const project = res.data.find((project: Project) => project.id === parseInt(projectId))
        if (project) {
          setCurrentProject(project)
        } else {
          navigate('/project')
        }
      } else {
        let currentProjectId = user?.currentProjectId
        if (!currentProjectId && res.data.length > 0) {
          currentProjectId = res.data[0].id
        }
        if (currentProjectId) {
          // 重定向到当前项目
          navigate(`/project/${currentProjectId}/prompts`)
        }
      }
    })
  }, [projectId])

  const switchProject = (project: Project) => {
    setCurrentProject(project)

    UserAPI.switchProject(project.id).then(_res => {
      // 只替换项目ID，不替换路径
      navigate(`/project/${project.id}/prompts`)
    })
  }

  const handleCreateProject = () => {
    setCreateModalOpen(true)
  }

  const handleProjectSettings = () => {
    navigate(`/project/${getProjectId()}/settings`)
  }

  // 项目菜单
  const projectMenuItems: MenuProps['items'] = [
    ...projects.map((project: Project) => ({
      key: project.id,
      label: project.name,
      onClick: () => switchProject(project),
    })),
    {
      type: 'divider',
    },
    {
      key: 'create',
      label: '创建新项目',
      icon: <PlusOutlined />,
      onClick: handleCreateProject
    },
  ]

  // 确定当前活跃的菜单项
  const getSelectedKeys = () => {
    if (pathname.includes('/datasets')) return ['datasets'];
    if (pathname.includes('/prompts')) return ['prompts'];
    if (pathname.includes('/eval-pipelines')) return ['eval-pipelines'];
    if (pathname.includes('/settings')) return ['settings'];
    return ['']; // 默认选中提示词库
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: colorBgContainer, padding: '0 16px', display: 'flex', alignItems: 'center' }}>
        <div style={{ marginRight: 40, fontSize: '18px', fontWeight: 'bold' }}>
          <Link to="/" style={{ color: 'inherit' }}>
            Prompt Lab
          </Link>
        </div>

        {/* 项目选择下拉菜单 */}
        <Dropdown menu={{ items: projectMenuItems }} trigger={['click']}>
          <Button type="text">
            <Space>
              {currentProject?.name || ''}
              <DownOutlined />
            </Space>
          </Button>
        </Dropdown>

        {/* 水平菜单 */}
        <Menu
          theme="light"
          mode="horizontal"
          selectedKeys={getSelectedKeys()}
          style={{ flex: 1, minWidth: 0 }}
          items={menuItems.map((item: any) => ({
            key: item.key,
            icon: item.icon,
            label: <Link to={item.path}>{item.label}</Link>,
            children: item.children,
            onClick: (_e: any) => {
              if (item.children) {
                // e.preventDefault()
                navigate(item.children[0].path)
              }
            },
          }))}
        />

        {/* 项目设置 */}
        {currentProject && (
          <Tooltip title="项目设置">
            <Button 
              type="text" 
              icon={<SettingOutlined />} 
              onClick={handleProjectSettings}
              style={{ marginRight: 16 }}
            />
          </Tooltip>
        )}

        {/* 用户导航 */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 16 }}>
          <UserNav />
        </div>
      </Header>
      <Content style={{ marginTop: '4px', overflow: 'initial' }}>
        <div
          style={{
            paddingLeft: '30px',
            paddingRight: '30px',
            minHeight: 360,
            background: colorBgContainer,
            borderRadius: borderRadiusLG,
          }}
        >
          {children || <Outlet />}
        </div>
      </Content>
      <Footer style={{ textAlign: 'center' }}>
        Prompt Lab ©{new Date().getFullYear()} Created by Ai
      </Footer>

      {/* 创建项目弹窗 */}
      <CreateProjectModal
        open={createModalOpen}
        onCreated={(project: Project) => {
          setCreateModalOpen(false)
          switchProject(project)
          addProject(project)
        }}
        onClose={() => setCreateModalOpen(false)}
      />
    </Layout>
  )
} 