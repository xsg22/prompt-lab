import { useState, useEffect, useMemo } from "react"
import {
  Card,
  Typography,
  Button,
  Input,
  Space,
  List,
  Modal,
  Form,
  Divider,
  Empty,
  Skeleton,
  Dropdown,
  message,
  Popconfirm,
  Checkbox,
  Tag,
  Select,
  Radio,
  Badge,
  Tabs,
  Tooltip,
  Row,
  Col,
  Switch,
  Drawer,
  ColorPicker,
  Collapse,
  FloatButton
} from "antd"
import {
  PlusOutlined,
  SearchOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  MoreOutlined,
  ExclamationCircleOutlined,
  HeartOutlined,
  HeartFilled,
  TagOutlined,
  UserOutlined,
  CalendarOutlined,
  FilterOutlined,
  CopyOutlined} from "@ant-design/icons"
import { formatDistanceToNow } from "date-fns"
import { zhCN } from "date-fns/locale"
import { Link, useParams, useNavigate } from "react-router-dom";
import { PromptsAPI } from '@/lib/api'
import { useProjectJump } from "@/hooks/useProjectJump"
import { extractDataFromResponse } from '@/lib/utils'
import { useAuth } from "@/contexts/UnifiedAuthContext"
import { type Prompt, type Tag as PromptTag, type FilterOptions, type ViewMode } from '@/types/prompt'

const { Title, Paragraph, Text } = Typography
const { TextArea } = Input
const { Option } = Select
const { Panel } = Collapse

// 添加一些自定义样式
const promptCardStyles = {
  promptCard: {
    transition: 'all 0.3s ease',
    border: '1px solid #f0f0f0',
    cursor: 'default'
  },
  bulkSelectOverlay: {
    position: 'absolute' as const,
    top: 8,
    left: 8,
    zIndex: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 4,
    padding: 4,
  },
  tagContainer: {
    marginBottom: 8,
    minHeight: 24,
    display: 'flex',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 500,
    margin: 0,
    color: '#262626',
  },
  cardDescription: {
    minHeight: 44,
    color: '#666',
    marginBottom: 8,
  },
  cardMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 12,
    color: '#8c8c8c',
  },
  favoriteButton: {
    border: 'none',
    boxShadow: 'none',
    padding: 0,
  },
  filterBadge: {
    marginLeft: 4,
  },
  batchToolbar: {
    marginTop: 16,
    padding: 12,
    background: '#f5f5f5',
    borderRadius: 6,
    border: '1px solid #d9d9d9',
  },
  groupHeader: {
    fontSize: 14,
    fontWeight: 500,
    color: '#262626',
  }
}

export default function PromptsPage() {
  
  // 基础状态
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [tags, setTags] = useState<PromptTag[]>([])
  const [loading, setLoading] = useState(true)
  const [tagsLoading, setTagsLoading] = useState(false)
  const { user } = useAuth()
  
  // 筛选和排序状态
  const [filters, setFilters] = useState<FilterOptions>({
    search: "",
    selectedTags: [],
    status: "all",
    creator: "all",
    favoritesOnly: false,
    isTemplate: null,
    sortBy: "updated_at",
    sortOrder: "desc"
  })
  
  // 视图模式
  const [viewMode, setViewMode] = useState<ViewMode>({
    groupBy: 'none'
  })
  
  // 弹窗状态
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showTagModal, setShowTagModal] = useState(false)
  const [editModalVisible, setEditModalVisible] = useState(false)
  const [filterDrawerVisible, setFilterDrawerVisible] = useState(false)
  const [copyModalVisible, setCopyModalVisible] = useState(false)
  
  // 表单和编辑状态
  const [form] = Form.useForm()
  const [tagForm] = Form.useForm()
  const [editForm] = Form.useForm()
  const [copyForm] = Form.useForm()
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null)
  const [copyingPrompt, setCopyingPrompt] = useState<Prompt | null>(null)
  const [selectedPrompts, setSelectedPrompts] = useState<number[]>([])
  const [bulkMode, setBulkMode] = useState(false)
  
  // 其他状态
  const [openDropdownId, setOpenDropdownId] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState("all")
  const [promptCreating, setPromptCreating] = useState(false)
  const [promptCopying, setPromptCopying] = useState(false)
  const projectId = useParams().projectId
  const { projectJumpTo } = useProjectJump()
  const navigate = useNavigate()

  // 加载数据
  useEffect(() => {
    if (!projectId) return
    fetchData()
  }, [projectId, filters])

  const fetchData = async () => {
    try {
      setLoading(true)
      
      // 构建查询参数
      const params: any = {
        project_id: Number(projectId),
        page: 1,
        page_size: 100,
      }
      
      if (filters.search) params.search = filters.search
      if (filters.selectedTags.length > 0) params.tags = filters.selectedTags.join(',')
      if (filters.status !== 'all') params.status = filters.status
      if (filters.creator !== 'all') params.creator = filters.creator
      if (filters.favoritesOnly) params.favorites_only = true
      if (filters.isTemplate !== null) params.is_template = filters.isTemplate
      params.sort_by = filters.sortBy
      params.sort_order = filters.sortOrder

      const response = await PromptsAPI.getPrompts(Number(projectId), params);
      setPrompts(extractDataFromResponse<Prompt>(response))
    } catch (error) {
      console.error("Error fetching prompts:", error)
      message.error('加载提示词列表失败')
    } finally {
      setLoading(false)
    }
  }

  // 加载标签
  const fetchTags = async () => {
    if (!projectId) return
    try {
      setTagsLoading(true)
      const response = await PromptsAPI.getTags(Number(projectId))
      setTags(response.data)
    } catch (error) {
      console.error("Error fetching tags:", error)
    } finally {
      setTagsLoading(false)
    }
  }

  useEffect(() => {
    fetchTags()
  }, [projectId])

  // 创建新提示词
  const handleCreatePrompt = async () => {
    try {
      setPromptCreating(true)
      const values = await form.validateFields()
      const response = await PromptsAPI.createPrompt({
        name: values.name,
        description: values.description || null,
        project_id: Number(projectId),
        tag_ids: values.tag_ids || []
      })
      const newPrompt = response.data
      setPrompts([newPrompt, ...prompts])
      setShowCreateModal(false)
      form.resetFields()
      message.success('提示词创建成功', 2,
        () => {
          navigate(projectJumpTo(`prompts/${newPrompt.id}/editor`))
        }
      )
    } catch (error) {
      console.error("Error creating prompt:", error)
      message.error('创建提示词失败')
    } finally {
      setPromptCreating(false)
    }
  }

  // 复制提示词
  const handleCopyPrompt = (prompt: Prompt) => {
    setCopyingPrompt(prompt)
    setCopyModalVisible(true)
    copyForm.setFieldsValue({
      name: `${prompt.name} (副本)`,
      description: prompt.description || "",
      tag_ids: prompt.tags?.map(tag => tag.id) || []
    })
  }

  // 执行复制操作
  const handleConfirmCopy = async () => {
    if (!copyingPrompt) return
    try {
      setPromptCopying(true)
      const values = await copyForm.validateFields()
      
      // 直接调用复制接口，传递用户修改的内容
      const response = await PromptsAPI.duplicatePrompt(copyingPrompt.id, {
        name: values.name,
        description: values.description || null,
        tag_ids: values.tag_ids || []
      })
      const duplicatedPrompt = response.data
      
      setPrompts([duplicatedPrompt, ...prompts])
      setCopyModalVisible(false)
      setCopyingPrompt(null)
      copyForm.resetFields()
      message.success('提示词复制成功', 2, () => {
        navigate(projectJumpTo(`prompts/${duplicatedPrompt.id}/editor`))
      })
    } catch (error) {
      console.error("Error copying prompt:", error)
      message.error('复制提示词失败')
    } finally {
      setPromptCopying(false)
    }
  }

  // 切换收藏状态
  const handleToggleFavorite = async (promptId: number, event?: React.MouseEvent) => {
    if (event) {
      event.preventDefault()
      event.stopPropagation()
    }
    
    try {
      const response = await PromptsAPI.toggleFavorite(promptId)
      const isNowFavorited = response.data.is_favorited
      
      setPrompts(prompts.map(p => 
        p.id === promptId 
          ? { ...p, is_favorited: isNowFavorited }
          : p
      ))
      
      message.success(isNowFavorited ? '已添加到收藏' : '已取消收藏')
    } catch (error) {
      console.error("Error toggling favorite:", error)
      message.error('操作失败')
    }
  }

  // 创建标签
  const handleCreateTag = async () => {
    try {
      const values = await tagForm.validateFields()
      const response = await PromptsAPI.createTag({
        name: values.name,
        color: values.color?.toHexString?.() || values.color,
        project_id: Number(projectId)
      })
      const newTag = response.data
      setTags([...tags, newTag])
      setShowTagModal(false)
      tagForm.resetFields()
      message.success('标签创建成功')
    } catch (error) {
      console.error("Error creating tag:", error)
      message.error('创建标签失败')
    }
  }

  // 删除提示词
  const handleDeletePrompt = async (promptToDelete: Prompt) => {
    if (!promptToDelete) return

    try {
      await PromptsAPI.deletePrompt(promptToDelete.id)
      setPrompts(prompts.filter(p => p.id !== promptToDelete.id))
      message.success('提示词删除成功')
    } catch (error) {
      console.error("Error deleting prompt:", error)
      message.error('删除提示词失败')
    }
  }

  // 编辑提示词
  const handleEditPrompt = (prompt: Prompt) => {
    setEditingPrompt(prompt)
    setEditModalVisible(true)
    editForm.setFieldsValue({
      name: prompt.name,
      description: prompt.description || "",
      tag_ids: prompt.tags?.map(tag => tag.id) || [],
      status: prompt.status,
      is_template: prompt.is_template
    })
  }

  // 保存编辑
  const handleSaveEditPrompt = async () => {
    if (!editingPrompt) return
    try {
      const values = await editForm.validateFields()
      const response = await PromptsAPI.updatePrompt(editingPrompt.id, {
        name: values.name,
        description: values.description || null,
        tag_ids: values.tag_ids || [],
        status: values.status,
        is_template: values.is_template
      })
      setPrompts(prompts.map(p => p.id === editingPrompt.id ? { ...p, ...response.data } : p))
      setEditModalVisible(false)
      setEditingPrompt(null)
      message.success('提示词已更新')
    } catch (error) {
      message.error('更新失败')
    }
  }

  // 批量操作
  const handleBatchOperation = async (action: string, tagId?: number) => {
    if (selectedPrompts.length === 0) {
      message.warning('请先选择要操作的提示词')
      return
    }

    try {
      await PromptsAPI.batchOperation({
        prompt_ids: selectedPrompts,
        action,
        tag_id: tagId
      })
      
      if (action === 'delete') {
        setPrompts(prompts.filter(p => !selectedPrompts.includes(p.id)))
        message.success(`已删除 ${selectedPrompts.length} 个提示词`)
      } else {
        await fetchData() // 重新加载数据
        message.success('批量操作完成')
      }
      
      setSelectedPrompts([])
      setBulkMode(false)
    } catch (error) {
      console.error("Batch operation error:", error)
      message.error('批量操作失败')
    }
  }

  // 筛选和分组逻辑
  const filteredAndGroupedPrompts = useMemo(() => {
    let filtered = [...prompts]
    
    // 按活跃标签页筛选
    if (activeTab === 'favorites') {
      filtered = filtered.filter(p => p.is_favorited)
    } else if (activeTab === 'mine') {
      filtered = filtered.filter(p => p.user_id === Number(user?.id)) // 需要实际的用户ID
    } else if (activeTab === 'templates') {
      filtered = filtered.filter(p => p.is_template)
    }

    // 分组逻辑
    if (viewMode.groupBy === 'none') {
      return { ungrouped: filtered }
    }

    const grouped: { [key: string]: Prompt[] } = {}
    
    filtered.forEach(prompt => {
      let key = '未分类'
      
      switch (viewMode.groupBy) {
        case 'creator':
          key = prompt.nickname || '未知用户'
          break
        case 'status':
          key = prompt.status === 'active' ? '活跃' : 
                prompt.status === 'archived' ? '已归档' : '草稿'
          break
        case 'tags':
          if (prompt.tags?.length > 0) {
            key = prompt.tags[0].name
          }
          break
      }
      
      if (!grouped[key]) {
        grouped[key] = []
      }
      grouped[key].push(prompt)
    })

    return grouped
  }, [prompts, activeTab, viewMode.groupBy])

  // 格式化日期 - 将UTC时间转换为本地时间显示
  const formatDate = (dateString: string) => {
    try {
      // 如果dateString是UTC+0时间，确保正确解析为UTC时间
      let date: Date
      
      if (dateString.endsWith('Z') || dateString.includes('+')) {
        // 如果已经是ISO格式，直接使用
        date = new Date(dateString)
      } else {
        // 如果是简单格式（如 "2023-12-01 10:00:00"），假设为UTC时间
        date = new Date(dateString + 'Z')
      }
      
      // 检查日期是否有效
      if (isNaN(date.getTime())) {
        return '无效时间'
      }
      
      return formatDistanceToNow(date, {
        addSuffix: true,
        locale: zhCN
      })
    } catch (e) {
      return '未知时间'
    }
  }

  // 渲染提示词卡片
  const renderPromptCard = (prompt: Prompt) => (
    <Card
      key={prompt.id}
      hoverable
      style={promptCardStyles.promptCard}
      className="prompt-card"
      actions={[
        <Tooltip title="查看" key="view">
          <Link to={projectJumpTo(`prompts/${prompt.id}/overview`)}>
            <EyeOutlined />
          </Link>
        </Tooltip>,
        <Tooltip title="编辑" key="edit">
          <Link to={projectJumpTo(`prompts/${prompt.id}/editor`)}>
            <EditOutlined />
          </Link>
        </Tooltip>,
        <Tooltip title={prompt.is_favorited ? '取消收藏' : '收藏'} key="favorite">
          <Button
            type="text"
            style={promptCardStyles.favoriteButton}
            icon={prompt.is_favorited ? <HeartFilled style={{color: '#ff4d4f'}} /> : <HeartOutlined />}
            onClick={(e) => handleToggleFavorite(prompt.id, e)}
          />
        </Tooltip>,
        <Dropdown
          key="more"
          menu={{ items: renderActionMenu(prompt) }}
          placement="bottomRight"
          trigger={['click']}
          open={openDropdownId === prompt.id}
          onOpenChange={(visible) => {
            setOpenDropdownId(visible ? prompt.id : null)
          }}
        >
          <MoreOutlined />
        </Dropdown>,
      ]}
    >
      {bulkMode && (
        <div style={promptCardStyles.bulkSelectOverlay}>
          <Checkbox
            checked={selectedPrompts.includes(prompt.id)}
            onChange={(e) => {
              if (e.target.checked) {
                setSelectedPrompts([...selectedPrompts, prompt.id])
              } else {
                setSelectedPrompts(selectedPrompts.filter(id => id !== prompt.id))
              }
            }}
          />
        </div>
      )}
      
      <Skeleton loading={loading} active avatar={false}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
          <div style={{ flex: 1 }}>
            <Link to={projectJumpTo(`prompts/${prompt.id}/overview`)}>
              <Title level={5} style={promptCardStyles.cardTitle}>
                {prompt.name}
              </Title>
            </Link>
          </div>
          <Space>
            {/* {prompt.is_template && (
              <Tag color="purple" icon={<BookOutlined />}>模板</Tag>
            )} */}
            {prompt.status === 'archived' && (
              <Tag color="default">已归档</Tag>
            )}
            {prompt.status === 'draft' && (
              <Tag color="orange">草稿</Tag>
            )}
          </Space>
        </div>

        {prompt.description ? (
          <Paragraph 
            ellipsis={{ rows: 2 }} 
            style={promptCardStyles.cardDescription}
          >
            {prompt.description}
          </Paragraph>
        ) : (
          <div style={{ height: 44, display: 'flex', alignItems: 'center' }}>
            <Text type="secondary" italic>无描述</Text>
          </div>
        )}

        {/* 标签显示 */}
        <div style={promptCardStyles.tagContainer}>
          {prompt.tags && prompt.tags.length > 0 ? (
            <Space wrap>
              {prompt.tags.slice(0, 3).map(tag => (
                <Tag 
                  key={tag.id} 
                  color={tag.color || 'default'} 
                  style={{ margin: 0 }}
                >
                  {tag.name}
                </Tag>
              ))}
              {prompt.tags.length > 3 && (
                <Tag style={{ margin: 0 }}>+{prompt.tags.length - 3}</Tag>
              )}
            </Space>
          ) : null}
        </div>

        <Divider style={{ margin: '8px 0' }} />
        
        <div style={promptCardStyles.cardMeta}>
          <Space>
            <UserOutlined />
            <span>{prompt.nickname}</span>
          </Space>
          <Space>
            <CalendarOutlined />
            <span>{formatDate(prompt.updated_at)}</span>
          </Space>
        </div>
      </Skeleton>
    </Card>
  )

  // 渲染操作菜单
  const renderActionMenu = (prompt: Prompt) => [
    {
      key: 'editPrompt',
      label: (
        <div onClick={() => { handleEditPrompt(prompt); }} style={{ width: '100%' }}>
          <Space>
            <EditOutlined />
            编辑信息
          </Space>
        </div>
      ),
    },
    {
      key: 'copyPrompt',
      label: (
        <div onClick={() => { handleCopyPrompt(prompt); }} style={{ width: '100%' }}>
          <Space>
            <CopyOutlined />
            复制
          </Space>
        </div>
      ),
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'delete',
      danger: true,
      label: (
        <div onClick={(e) => e.stopPropagation()} style={{ width: '100%' }}>
          <Popconfirm
            title="确定要删除这个提示词吗?"
            description="删除后将无法恢复，包括所有的数据。"
            placement="bottom"
            onConfirm={() => {
              handleDeletePrompt(prompt)
              setOpenDropdownId(null)
            }}
            onCancel={() => setOpenDropdownId(null)}
            okText="确定"
            cancelText="取消"
            icon={<ExclamationCircleOutlined style={{ color: 'red' }} />}
          >
            <div style={{ width: '100%', cursor: 'pointer' }}>
              <Space>
                <DeleteOutlined />
                删除
              </Space>
            </div>
          </Popconfirm>
        </div>
      ),
    },
  ]

  // 渲染筛选抽屉
  const renderFilterDrawer = () => (
    <Drawer
      title="筛选设置"
      placement="right"
      width={320}
      open={filterDrawerVisible}
      onClose={() => setFilterDrawerVisible(false)}
      extra={
        <Button 
          type="link" 
          onClick={() => {
            setFilters({
              search: "",
              selectedTags: [],
              status: "all",
              creator: "all",
              favoritesOnly: false,
              isTemplate: null,
              sortBy: "updated_at",
              sortOrder: "desc"
            })
          }}
        >
          重置
        </Button>
      }
    >
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <div>
          <Text strong>搜索</Text>
          <Input
            placeholder="搜索提示词名称或描述..."
            allowClear
            value={filters.search}
            onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
            style={{ marginTop: 8 }}
          />
        </div>

        <div>
          <Text strong>标签</Text>
          <Select
            mode="multiple"
            placeholder="选择标签"
            style={{ width: '100%', marginTop: 8 }}
            value={filters.selectedTags}
            onChange={(value) => setFilters(prev => ({ ...prev, selectedTags: value }))}
            loading={tagsLoading}
          >
            {tags.map(tag => (
              <Option key={tag.id} value={tag.id}>
                <Tag color={tag.color || 'default'} style={{ margin: 0 }}>
                  {tag.name}
                </Tag>
              </Option>
            ))}
          </Select>
        </div>

        <div>
          <Text strong>状态</Text>
          <Radio.Group
            style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}
            value={filters.status}
            onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
          >
            <Radio value="all">全部</Radio>
            <Radio value="active">活跃</Radio>
            <Radio value="archived">已归档</Radio>
            <Radio value="draft">草稿</Radio>
          </Radio.Group>
        </div>

        <div>
          <Text strong>创建者</Text>
          <Radio.Group
            style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}
            value={filters.creator}
            onChange={(e) => setFilters(prev => ({ ...prev, creator: e.target.value }))}
          >
            <Radio value="all">全部</Radio>
            <Radio value="mine">我的</Radio>
            <Radio value="others">其他人</Radio>
          </Radio.Group>
        </div>

        <div>
          <Text strong>其他筛选</Text>
          <div style={{ marginTop: 8 }}>
            <Checkbox
              checked={filters.favoritesOnly}
              onChange={(e) => setFilters(prev => ({ ...prev, favoritesOnly: e.target.checked }))}
            >
              仅显示收藏
            </Checkbox>
          </div>
          {/* <div style={{ marginTop: 8 }}>
            <Checkbox
              checked={filters.isTemplate === true}
              onChange={(e) => setFilters(prev => ({ 
                ...prev, 
                isTemplate: e.target.checked ? true : null 
              }))}
            >
              仅显示模板
            </Checkbox>
          </div> */}
        </div>

        <div>
          <Text strong>排序</Text>
          <div style={{ marginTop: 8 }}>
            <Select
              style={{ width: '100%', marginBottom: 8 }}
              value={filters.sortBy}
              onChange={(value) => setFilters(prev => ({ ...prev, sortBy: value }))}
            >
              <Option value="updated_at">更新时间</Option>
              <Option value="created_at">创建时间</Option>
              <Option value="name">名称</Option>
            </Select>
            <Radio.Group
              value={filters.sortOrder}
              onChange={(e) => setFilters(prev => ({ ...prev, sortOrder: e.target.value }))}
            >
              <Radio value="desc">降序</Radio>
              <Radio value="asc">升序</Radio>
            </Radio.Group>
          </div>
        </div>
      </Space>
    </Drawer>
  )

  return (
    <div style={{ padding: '24px' }}>
      {/* 头部区域 */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <Title level={2} style={{ margin: 0 }}>提示词管理</Title>
          </div>
          <Space>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setShowCreateModal(true)}
            >
              创建提示词
            </Button>
            <Button
              icon={<TagOutlined />}
              onClick={() => setShowTagModal(true)}
            >
              标签
            </Button>
          </Space>
        </div>

        {/* 快速标签页 */}
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'all',
              label: (
                <Badge count={prompts.length} showZero>
                  <span>全部</span>
                </Badge>
              ),
            },
            {
              key: 'favorites',
              label: (
                <Badge count={prompts.filter(p => p.is_favorited).length}>
                  <Space>
                    <HeartOutlined />
                    <span>收藏</span>
                  </Space>
                </Badge>
              ),
            },
            {
              key: 'mine',
              label: (
                <Badge count={prompts.filter(p => p.user_id === Number(user?.id)).length}>
                  <Space>
                    <UserOutlined />
                    <span>我的</span>
                  </Space>
                </Badge>
              ),
            },
            // {
            //   key: 'templates',
            //   label: (
            //     <Badge count={prompts.filter(p => p.is_template).length}>
            //       <Space>
            //         <BookOutlined />
            //         <span>模板</span>
            //       </Space>
            //     </Badge>
            //   ),
            // },
          ]}
        />
      </div>

      {/* 工具栏 */}
      <Card style={{ marginBottom: 16 }}>
        <Row justify="space-between" align="middle">
          <Col flex="auto">
            <Space>
              <Input
                placeholder="搜索提示词..."
                allowClear
                prefix={<SearchOutlined />}
                style={{ width: 300 }}
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              />
              
              <Button
                icon={<FilterOutlined />}
                onClick={() => setFilterDrawerVisible(true)}
              >
                筛选
                {(filters.selectedTags.length > 0 || filters.status !== 'all' || 
                  filters.creator !== 'all' || filters.favoritesOnly || 
                  filters.isTemplate !== null) && (
                  <Badge dot style={promptCardStyles.filterBadge} />
                )}
              </Button>
            </Space>
          </Col>
          
          <Col>
            <Space>
              
              <Select
                value={viewMode.groupBy}
                onChange={(value) => setViewMode(prev => ({ ...prev, groupBy: value }))}
                style={{ width: 120 }}
              >
                <Option value="none">不分组</Option>
                <Option value="creator">按创建者</Option>
                <Option value="tags">按标签</Option>
                <Option value="status">按状态</Option>
              </Select>

              <Switch
                checked={bulkMode}
                onChange={setBulkMode}
                checkedChildren="批量"
                unCheckedChildren="批量"
              />
            </Space>
          </Col>
        </Row>

        {/* 批量操作栏 */}
        {bulkMode && (
          <div style={promptCardStyles.batchToolbar}>
            <Row justify="space-between" align="middle">
              <Col>
                <Space>
                  <Checkbox
                    indeterminate={selectedPrompts.length > 0 && selectedPrompts.length < prompts.length}
                    checked={selectedPrompts.length === prompts.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedPrompts(prompts.map(p => p.id))
                      } else {
                        setSelectedPrompts([])
                      }
                    }}
                  >
                    全选
                  </Checkbox>
                  <Text>已选择 {selectedPrompts.length} 项</Text>
                </Space>
              </Col>
              <Col>
                <Space>
                  <Button 
                    size="small"
                    onClick={() => handleBatchOperation('favorite')}
                    disabled={selectedPrompts.length === 0}
                  >
                    批量收藏
                  </Button>
                  <Button 
                    size="small"
                    onClick={() => handleBatchOperation('archive')}
                    disabled={selectedPrompts.length === 0}
                  >
                    批量归档
                  </Button>
                  <Popconfirm
                    title="确定要删除选中的提示词吗？"
                    onConfirm={() => handleBatchOperation('delete')}
                    disabled={selectedPrompts.length === 0}
                  >
                    <Button 
                      size="small"
                      danger
                      disabled={selectedPrompts.length === 0}
                    >
                      批量删除
                    </Button>
                  </Popconfirm>
                </Space>
              </Col>
            </Row>
          </div>
        )}
      </Card>

      {/* 主内容区域 */}
      <div>
        {Object.keys(filteredAndGroupedPrompts).map(groupKey => {
          const groupPrompts = filteredAndGroupedPrompts[groupKey]
          
          if (viewMode.groupBy === 'none') {
            // 不分组直接显示
            return (
              <List
                key="ungrouped"
                grid={{
                  gutter: 16,
                  xs: 1,
                  sm: 1,
                  md: 2,
                  lg: 3,
                  xl: 3,
                  xxl: 5
                }}
                dataSource={groupPrompts}
                loading={loading}
                locale={{
                  emptyText: (
                    <Empty
                      description={filters.search ? '没有找到匹配的提示词' : '暂无提示词'}
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                    />
                  )
                }}
                renderItem={(prompt) => (
                  <List.Item>
                    {renderPromptCard(prompt)}
                  </List.Item>
                )}
              />
            )
          } else {
            // 分组显示
            return (
              <Collapse
                key={groupKey}
                style={{ marginBottom: 16 }}
                defaultActiveKey={[groupKey]}
              >
                <Panel
                  header={
                    <Space>
                      <Text style={promptCardStyles.groupHeader}>{groupKey}</Text>
                      <Badge count={groupPrompts.length} showZero />
                    </Space>
                  }
                  key={groupKey}
                >
                  <List
                    grid={{
                      gutter: 16,
                      xs: 1,
                      sm: 1,
                      md: 2,
                      lg: 3,
                      xl: 3,
                      xxl: 5
                    }}
                    dataSource={groupPrompts}
                    renderItem={(prompt) => (
                      <List.Item>
                        {renderPromptCard(prompt)}
                      </List.Item>
                    )}
                  />
                </Panel>
              </Collapse>
            )
          }
        })}
      </div>

      {/* 筛选抽屉 */}
      {renderFilterDrawer()}

      {/* 创建提示词对话框 */}
      <Modal
        title="创建新提示词"
        open={showCreateModal}
        onCancel={() => setShowCreateModal(false)}
        footer={[
          <Button key="cancel" onClick={() => setShowCreateModal(false)}>
            取消
          </Button>,
          <Button key="create" type="primary" onClick={handleCreatePrompt} loading={promptCreating}>
            创建
          </Button>,
        ]}
        destroyOnClose
        width={520}
      >
        <Form
          form={form}
          layout="vertical"
          preserve={false}
        >
          <Form.Item
            name="name"
            label="提示词名称"
            rules={[{ required: true, message: '请输入提示词名称' }]}
          >
            <Input placeholder="输入提示词名称" />
          </Form.Item>
          <Form.Item
            name="description"
            label="描述"
          >
            <TextArea
              rows={4}
              placeholder="简要描述此提示词的功能和用途"
            />
          </Form.Item>
          <Form.Item
            name="tag_ids"
            label="标签"
          >
            <Select
              mode="multiple"
              placeholder="选择标签"
              loading={tagsLoading}
            >
              {tags.map(tag => (
                <Option key={tag.id} value={tag.id}>
                  <Tag color={tag.color || 'default'} style={{ margin: 0 }}>
                    {tag.name}
                  </Tag>
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑提示词对话框 */}
      <Modal
        title="编辑提示词"
        open={editModalVisible}
        onCancel={() => { setEditModalVisible(false); setEditingPrompt(null); }}
        onOk={handleSaveEditPrompt}
        okText="保存"
        cancelText="取消"
        destroyOnClose
      >
        <Form
          form={editForm}
          layout="vertical"
          preserve={false}
        >
          <Form.Item
            name="name"
            label="提示词名称"
            rules={[{ required: true, message: '请输入提示词名称' }]}
          >
            <Input placeholder="输入提示词名称" />
          </Form.Item>
          <Form.Item
            name="description"
            label="描述（可选）"
          >
            <TextArea
              rows={4}
              placeholder="简要描述此提示词的功能和用途"
            />
          </Form.Item>
          <Form.Item
            name="tag_ids"
            label="标签"
          >
            <Select
              mode="multiple"
              placeholder="选择标签"
              loading={tagsLoading}
            >
              {tags.map(tag => (
                <Option key={tag.id} value={tag.id}>
                  <Tag color={tag.color || 'default'} style={{ margin: 0 }}>
                    {tag.name}
                  </Tag>
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="status"
                label="状态"
              >
                <Select>
                  <Option value="active">活跃</Option>
                  <Option value="draft">草稿</Option>
                  <Option value="archived">已归档</Option>
                </Select>
              </Form.Item>
            </Col>
            {/* <Col span={12}>
              <Form.Item
                name="is_template"
                label="模板"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
            </Col> */}
          </Row>
        </Form>
      </Modal>

      {/* 复制提示词对话框 */}
      <Modal
        title="复制提示词"
        open={copyModalVisible}
        onCancel={() => { setCopyModalVisible(false); setCopyingPrompt(null); }}
        footer={[
          <Button key="cancel" onClick={() => { setCopyModalVisible(false); setCopyingPrompt(null); }}>
            取消
          </Button>,
          <Button key="copy" type="primary" onClick={handleConfirmCopy} loading={promptCopying}>
            复制
          </Button>,
        ]}
        destroyOnClose
        width={520}
      >
        <Form
          form={copyForm}
          layout="vertical"
          preserve={false}
        >
          <Form.Item
            name="name"
            label="提示词名称"
            rules={[{ required: true, message: '请输入提示词名称' }]}
          >
            <Input placeholder="输入提示词名称" />
          </Form.Item>
          <Form.Item
            name="description"
            label="描述"
          >
            <TextArea
              rows={4}
              placeholder="简要描述此提示词的功能和用途"
            />
          </Form.Item>
          <Form.Item
            name="tag_ids"
            label="标签"
          >
            <Select
              mode="multiple"
              placeholder="选择标签"
              loading={tagsLoading}
            >
              {tags.map(tag => (
                <Option key={tag.id} value={tag.id}>
                  <Tag color={tag.color || 'default'} style={{ margin: 0 }}>
                    {tag.name}
                  </Tag>
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* 标签管理对话框 */}
      <Modal
        title="标签管理"
        open={showTagModal}
        onCancel={() => setShowTagModal(false)}
        footer={null}
        destroyOnClose
      >
        <div style={{ marginBottom: 16 }}>
          <Form
            form={tagForm}
            layout="inline"
            onFinish={handleCreateTag}
          >
            <Form.Item
              name="name"
              rules={[{ required: true, message: '请输入标签名称' }]}
              style={{ flex: 1 }}
            >
              <Input placeholder="标签名称" />
            </Form.Item>
            <Form.Item name="color">
              <ColorPicker />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit">
                添加
              </Button>
            </Form.Item>
          </Form>
        </div>
        
        <Divider />
        
        <div>
          <Text strong>现有标签</Text>
          <div style={{ marginTop: 8 }}>
            <Space wrap>
              {tags.map(tag => (
                <Tag
                  key={tag.id}
                  color={tag.color || 'default'}
                  closable
                  onClose={() => {
                    // 删除标签的逻辑
                    Modal.confirm({
                      title: '确定删除这个标签吗？',
                      content: '删除后，所有使用此标签的提示词将失去该标签。',
                      onOk: async () => {
                        try {
                          await PromptsAPI.deleteTag(tag.id)
                          setTags(tags.filter(t => t.id !== tag.id))
                          message.success('标签已删除')
                        } catch (error) {
                          message.error('删除失败')
                        }
                      }
                    })
                  }}
                >
                  {tag.name}
                </Tag>
              ))}
            </Space>
          </div>
        </div>
      </Modal>

      {/* 浮动按钮 */}
      <FloatButton.Group
        trigger="hover"
        type="primary"
        style={{ right: 24 }}
        icon={<PlusOutlined />}
      >
        <FloatButton
          icon={<PlusOutlined />}
          tooltip="新建提示词"
          onClick={() => setShowCreateModal(true)}
        />
        <FloatButton
          icon={<TagOutlined />}
          tooltip="管理标签"
          onClick={() => setShowTagModal(true)}
        />
        <FloatButton
          icon={<FilterOutlined />}
          tooltip="筛选"
          onClick={() => setFilterDrawerVisible(true)}
        />
      </FloatButton.Group>
    </div>
  )
} 