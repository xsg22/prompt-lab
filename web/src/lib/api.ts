import type { AvailableModel, LLMCallResponse } from '@/types/llm';
import http from './http';
import type { AxiosResponse } from 'axios';

/**
 * 提示词相关API
 */
export const PromptsAPI = {
  // 获取所有提示词 - 支持筛选参数
  getPrompts: (projectId: number, params?: {
    page?: number;
    page_size?: number;
    search?: string;
    tags?: string;
    status?: string;
    creator?: string;
    favorites_only?: boolean;
    is_template?: boolean;
    sort_by?: string;
    sort_order?: string;
  }) => {
    const searchParams = new URLSearchParams({ project_id: projectId.toString() });
    
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.page_size) searchParams.append('page_size', params.page_size.toString());
    if (params?.search) searchParams.append('search', params.search);
    if (params?.tags) searchParams.append('tags', params.tags);
    if (params?.status) searchParams.append('status', params.status);
    if (params?.creator) searchParams.append('creator', params.creator);
    if (params?.favorites_only) searchParams.append('favorites_only', 'true');
    if (params?.is_template !== undefined) searchParams.append('is_template', params.is_template.toString());
    if (params?.sort_by) searchParams.append('sort_by', params.sort_by);
    if (params?.sort_order) searchParams.append('sort_order', params.sort_order);
    
    return http.get(`/api/prompts/?${searchParams.toString()}`);
  },
  
  // 获取特定提示词
  getPrompt: (id: number) => http.get(`/api/prompts/${id}`),
  
  // 创建提示词
  createPrompt: (data: any) => http.post('/api/prompts/', data),
  
  // 更新提示词
  updatePrompt: (id: number, data: any) => http.patch(`/api/prompts/${id}`, data),
  
  // 删除提示词
  deletePrompt: (id: number) => http.delete(`/api/prompts/${id}`),
  
  // === 标签管理相关 ===
  
  // 获取项目标签列表
  getTags: (projectId: number) => http.get(`/api/prompts/tags?project_id=${projectId}`),
  
  // 创建标签
  createTag: (data: any) => http.post('/api/prompts/tags', data),
  
  // 更新标签
  updateTag: (tagId: number, data: any) => http.patch(`/api/prompts/tags/${tagId}`, data),
  
  // 删除标签
  deleteTag: (tagId: number) => http.delete(`/api/prompts/tags/${tagId}`),

  // === 收藏功能 ===
  
  // 切换收藏状态
  toggleFavorite: (promptId: number) => http.post(`/api/prompts/${promptId}/favorite`),
  
  // 复制提示词
  duplicatePrompt: (promptId: number, data?: { name?: string; description?: string; tag_ids?: number[] }) => 
    http.post(`/api/prompts/${promptId}/duplicate`, data || {}),

  // === 批量操作 ===
  
  // 批量操作提示词
  batchOperation: (data: {
    prompt_ids: number[];
    action: string;
    tag_id?: number;
  }) => http.post('/api/prompts/batch', data),

  // === 统计信息 ===
  
  // 获取提示词统计信息
  getStats: (projectId: number) => http.get(`/api/prompts/stats?project_id=${projectId}`),
  
  // 获取提示词的活跃版本
  getActiveVersion: (promptId: number) => http.get(`/api/prompts/${promptId}/active-version`),
  
  // 获取提示词的所有版本
  getVersions: (promptId: number) => http.get(`/api/prompts/${promptId}/versions`),
  
  // 获取特定版本
  getVersion: (promptId: number, versionId: number) => http.get(`/api/prompts/${promptId}/versions/${versionId}`),
  
  // 创建版本
  createVersion: (promptId: number, data: any) => http.post(`/api/prompts/${promptId}/versions`, data),
  
  // 获取版本的测试用例
  getTestCases: (promptId: number, versionId: number) => http.get(`/api/prompts/${promptId}/versions/${versionId}/testcases`),
  
  // 创建测试用例
  createTestCase: (promptId: number, versionId: number, data: any) => http.post(`/api/prompts/${promptId}/versions/${versionId}/testcases`, data),
  
  // 获取提示词关联的数据集
  getDatasets: (promptId: number) => http.get(`/api/prompts/${promptId}/datasets`),
  
  // 获取提示词历史记录
  getHistory: (promptId: number, params?: {
    page?: number;
    page_size?: number;
    source?: string;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.page_size) searchParams.append('page_size', params.page_size.toString());
    if (params?.source) searchParams.append('source', params.source);
    
    const queryString = searchParams.toString();
    const url = `/api/prompts/${promptId}/history${queryString ? `?${queryString}` : ''}`;
    return http.get(url);
  },
};

/**
 * 数据集相关API
 */
export const DatasetsAPI = {
  // 获取所有数据集
  getAllDatasets: (projectId: number) => http.get(`/api/datasets/?project_id=${projectId}`),
  
  // 获取特定数据集
  getDataset: (id: number) => http.get(`/api/datasets/${id}`),
  
  // 创建数据集
  createDataset: (data: any) => http.post('/api/datasets/', data),
  
  // 更新数据集
  updateDataset: (id: number, data: any) => http.patch(`/api/datasets/${id}`, data),
  
  // 删除数据集
  deleteDataset: (id: number) => http.delete(`/api/datasets/${id}`),
  
  // 获取数据集条目
  getItems: (datasetId: number, params?: {
    enabled_only?: boolean;
    search?: string;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
    page?: number;
    page_size?: number;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.enabled_only) searchParams.append('enabled_only', 'true');
    if (params?.search) searchParams.append('search', params.search);
    if (params?.sort_by) searchParams.append('sort_by', params.sort_by);
    if (params?.sort_order) searchParams.append('sort_order', params.sort_order);
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.page_size) searchParams.append('page_size', params.page_size.toString());
    
    const queryString = searchParams.toString();
    const url = `/api/datasets/${datasetId}/items${queryString ? `?${queryString}` : ''}`;
    return http.get(url);
  },

  // 获取数据集启用和总条目数量
  getDatasetItemsEnabledCount: (datasetId: number) => http.get(`/api/datasets/${datasetId}/items/enabled_count`),
  
  // 获取特定数据集条目
  getItem: (datasetId: number, itemId: number) => http.get(`/api/datasets/${datasetId}/items/${itemId}`),
  
  // 创建数据集条目
  createItem: (datasetId: number, data: any) => http.post(`/api/datasets/${datasetId}/items`, data),
  
  // 更新数据集条目
  updateItem: (datasetId: number, itemId: number, data: any) => http.patch(`/api/datasets/${datasetId}/items/${itemId}`, data),
  
  // 删除数据集条目
  deleteItem: (datasetId: number, itemId: number) => http.delete(`/api/datasets/${datasetId}/items/${itemId}`),
  
  // 批量删除数据集条目
  batchDeleteItems: (datasetId: number, itemIds: number[]) => 
    http.delete(`/api/datasets/${datasetId}/items`, { data: itemIds }),
  
  // 批量创建数据集条目
  batchCreateItems: (datasetId: number, data: any) => http.post(`/api/datasets/${datasetId}/items/batch`, data),
  
  // 导入测试用例到数据集
  importTestCases: (datasetId: string, data: any) => http.post(`/api/datasets/${datasetId}/import-testcases`, data),

  // === 新的上传相关接口 ===
  
  // 预览上传文件
  previewUpload: (datasetId: number, data: { file_content: string; file_name: string }) => 
    http.post(`/api/datasets/${datasetId}/upload/preview`, data),
  
  // 开始上传任务
  startUpload: (datasetId: number, data: { file_content: string; file_name: string; skip_invalid_rows?: boolean }) => 
    http.post(`/api/datasets/${datasetId}/upload/start`, data),
  
  // 获取上传状态
  getUploadStatus: (taskId: number) => 
    http.get(`/api/datasets/upload/status/${taskId}`),
  
  // 获取上传结果
  getUploadResult: (taskId: number) => 
    http.get(`/api/datasets/upload/result/${taskId}`),
  
  // 重试上传
  retryUpload: (data: { task_id: number; retry_failed_only?: boolean }) => 
    http.post('/api/datasets/upload/retry', data),

  // 创建数据分析提示词
  createAnalysisPrompt: (datasetId: number, data: {
    analysis_description: string;
    output_fields: Array<{field_name: string; description: string}>;
  }) => http.post(`/api/datasets/${datasetId}/analysis`, data),
};

/**
 * 评估相关API
 */
export const EvaluationsAPI = {
  // 获取所有评估
  getAllEvaluations: (projectId: number) => http.get(`/api/evaluations/?project_id=${projectId}`),
  
  // 获取特定评估
  getEvaluation: (id: number) => http.get(`/api/evaluations/${id}`),
  
  // 创建评估
  createEvaluation: (data: any) => http.post('/api/evaluations/', data),
  
  // 删除评估
  deleteEvaluation: (id: number) => http.delete(`/api/evaluations/${id}`),
  
  // 获取评估结果
  getResults: (evaluationId: number) => http.get(`/api/evaluations/${evaluationId}/results`),
  
  // 获取特定评估结果
  getResult: (evaluationId: number, resultId: number) => http.get(`/api/evaluations/${evaluationId}/results/${resultId}`),
  
  // 执行评估
  executeEvaluation: (id: number) => http.post(`/api/evaluations/${id}/execute`),
};

/**
 * 大模型 API相关
 */
export const AiModelAPI = {
  // 调用大模型 API - 支持取消请求
  callLLM: (data: any, signal?: AbortSignal) => http.post<LLMCallResponse>('/api/llmapi/', data, {
    signal
  }),

  // 流式调用大模型 API - 支持Server-Sent Events
  callLLMStream: async (data: any, signal?: AbortSignal, onChunk?: (content: string) => void) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_SERVER_HOST|| ''}/api/llmapi/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token') || ''}`,
        },
        body: JSON.stringify(data),
        signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('ReadableStream not supported');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';
      
      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) break;
          
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                
                if (data.type === 'chunk' && data.content) {
                  accumulated += data.content;
                  if (onChunk) {
                    onChunk(accumulated);
                  }
                } else if (data.type === 'done') {
                  // 流式完成
                  return {
                    content: accumulated,
                    usage: data.usage,
                    cost: data.cost,
                    execution_time: data.execution_time,
                    model: data.model
                  };
                } else if (data.type === 'error') {
                  throw new Error(data.error || '流式调用失败');
                }
              } catch (parseError) {
                console.warn('解析SSE数据失败:', parseError);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
      
      return {
        content: accumulated,
        usage: null,
        cost: null,
        execution_time: null,
        model: null
      };
    } catch (error) {
      if (signal?.aborted) {
        throw new Error('请求已取消');
      }
      throw error;
    }
  }
};

/**
 * 输出结果相关API
 */
export const OutputsAPI = {
  // 获取特定输出结果
  getOutput: (id: number) => http.get(`/api/outputs/${id}`),
  
  // 获取测试用例的所有输出结果
  getTestCaseOutputs: (testCaseId: number) => http.get(`/api/testcases/${testCaseId}/outputs`),
  
  // 创建新的输出结果
  createOutput: (testCaseId: number, data: any) => http.post(`/api/testcases/${testCaseId}/outputs`, data),
}; 

/**
 * 用户相关API
 */
export const UserAPI = {
  // 获取当前用户信息
  getCurrentUser: () => http.get('/api/users/me'),
  // 获取当前用户项目列表
  getProjects: () => http.get('/api/users/projects'),
  // 切换当前项目
  switchProject: (projectId: number) => http.post(`/api/users/switch-project/${projectId}`),
  // 更新当前用户信息
  updateCurrentUser: (data: any) => http.patch('/api/users/me', data),
  // 删除当前用户
  deleteCurrentUser: () => http.delete('/api/users/me'),
  // 更新密码
  updatePassword: (data: any) => http.post('/api/users/change-password', data),
};

/**
 * auth相关API
 */
export const AuthAPI = {
  // 登录
  login: (data: any) => http.post('/api/auth/login', data),
  // 登出
  logout: () => http.post('/api/auth/logout'),
  // 注册
  register: (data: any) => http.post('/api/auth/register', data),
  // 发送验证码
  sendVerification: (data: any) => http.post('/api/auth/send-verification', data),
  // 验证token
  verifyToken: (data: any) => http.post('/api/auth/verify-token', data),
  
  // 添加缺失的方法
  getCurrentUser: () => http.get('/api/auth/me').then(response => {
    const userData = response.data;
    return {
      id: userData.id,
      username: userData.username,
      email: userData.email,
      name: userData.nickname,
      avatar: userData.avatar_url,
      currentProjectId: userData.current_project_id,
      createdAt: userData.created_at,
      updatedAt: userData.updated_at,
    };
  }),
  
  updateUser: (data: any) => http.put('/api/auth/me', {
    nickname: data.name,
    avatar_url: data.avatar,
  }).then(response => {
    const userData = response.data;
    return {
      id: userData.id,
      username: userData.username,
      email: userData.email,
      name: userData.nickname,
      avatar: userData.avatar_url,
      createdAt: userData.created_at,
      updatedAt: userData.updated_at,
    };
  }),
};

/**
 * 项目相关API
 */
export const ProjectsAPI = {
  // 创建新项目
  createProject: (data: any) => http.post('/api/projects/', data),
  
  // 获取项目详情
  getProject: (id: number) => http.get(`/api/projects/${id}`),
  
  // 更新项目
  updateProject: (id: number, data: any) => http.patch(`/api/projects/${id}`, data),
  
  // 删除项目
  deleteProject: (id: number) => http.delete(`/api/projects/${id}`),
};

// 项目API
export const ProjectAPI = {
  // 项目详情
  getProjectDetails: (projectId: number) => {
    return http.get(`/api/projects/${projectId}`);
  },

  // 更新项目基础信息
  updateProject: (projectId: number, data: { name?: string }) => {
    return http.patch(`/api/projects/${projectId}`, data);
  },

  // 删除项目
  deleteProject: (projectId: number, projectName: string) => {
    return http.delete(`/api/projects/${projectId}`, { 
      data: { project_name: projectName } 
    });
  },

  // 获取账单信息
  getBillingInfo: (projectId: number) => {
    return http.get(`/api/projects/${projectId}/billing`);
  },

  // 获取项目成员
  getProjectMembers: (projectId: number) => {
    return http.get(`/api/projects/${projectId}/members`);
  },

  // 邀请成员
  inviteMember: (projectId: number, email: string, role: 'admin' | 'member' | 'readonly') => {
    return http.post(`/api/projects/${projectId}/members/invite`, { email, role });
  },

  // 生成邀请链接
  generateInviteLink: (projectId: number) => {
    return http.post(`/api/projects/${projectId}/members/invite-link`);
  },

  // 移除成员
  removeMember: (projectId: number, memberId: number) => {
    return http.delete(`/api/projects/${projectId}/members/${memberId}`);
  },

  // 切换成员角色（支持admin/member/readonly）
  updateMemberRole: (projectId: number, memberId: number, role: 'admin' | 'member' | 'readonly') => {
    return http.put(`/api/projects/${projectId}/members/${memberId}/role`, { role });
  },

  // 获取API密钥
  getApiKeys: (projectId: number) => {
    return http.get(`/api/projects/${projectId}/apikeys`);
  },

  // 创建API密钥
  createApiKey: (projectId: number, name: string) => {
    return http.post(`/api/projects/${projectId}/apikeys`, { name });
  },

  // 删除API密钥
  deleteApiKey: (projectId: number, keyId: number) => {
    return http.delete(`/api/projects/${projectId}/apikeys/${keyId}`);
  },

  // 获取自定义模型
  getCustomModels: (projectId: number) => {
    return http.get(`/api/projects/${projectId}/models`);
  },

  // 创建自定义模型
  createCustomModel: (projectId: number, modelData: any) => {
    return http.post(`/api/projects/${projectId}/models`, modelData);
  },

  // 更新自定义模型
  updateCustomModel: (projectId: number, modelId: number, modelData: any) => {
    return http.put(`/api/projects/${projectId}/models/${modelId}`, modelData);
  },

  // 删除自定义模型
  deleteCustomModel: (projectId: number, modelId: number) => {
    return http.delete(`/api/projects/${projectId}/models/${modelId}`);
  },

  // 获取大模型API配置
  getLlmApiConfig: (projectId: number) => {
    return http.get(`/api/projects/${projectId}/llm-config`);
  },

  // 更新大模型API配置
  updateLlmApiConfig: (projectId: number, data: any) => {
    return http.patch(`/api/projects/${projectId}/llm-config`, data);
  },
};

/**
 * 邀请相关API
 */
export const InviteAPI = {
  // 验证邀请链接
  validateInvite: (token: string) => {
    return http.get(`/api/invites/${token}/validate`);
  },
  
  // 接受邀请
  acceptInvite: (token: string) => {
    return http.post(`/api/invites/${token}/accept`);
  }
};

// 添加评估流水线相关的API接口
export const EvalPipelinesAPI = {
  // 获取所有评估流水线
  getAll: (projectId: number) => {
    return http.get(`/api/eval-pipelines/?project_id=${projectId}&staging=true`);
  },
  
  // 获取特定评估流水线
  getPipeline: (pipelineId: number) => {
    return http.get(`/api/eval-pipelines/${pipelineId}`);
  },
  
  // 创建评估流水线
  createPipeline: (data: any) => {
    return http.post('/api/eval-pipelines/', data);
  },

  // 更新评估流水线数据集
  changeDataset: (pipelineId: number, data: { dataset_id: number; selected_item_ids?: number[] }) => {
    return http.put(`/api/eval-pipelines/${pipelineId}/change-dataset`, data);
  },
  
  // 更新评估流水线
  updatePipeline: (pipelineId: number, data: any) => {
    return http.put(`/api/eval-pipelines/${pipelineId}`, data);
  },
  
  // 删除评估流水线
  deletePipeline: (pipelineId: number) => {
    return http.delete(`/api/eval-pipelines/${pipelineId}`);
  },

  // 获取评估流水线列
  getPipelineColumns: (pipelineId: number) => {
    return http.get(`/api/eval-pipelines/${pipelineId}/columns`);
  },

  // 添加评估流水线列
  addPipelineColumn: (pipelineId: number, data: any) => {
    return http.post(`/api/eval-pipelines/${pipelineId}/columns`, data);
  },

  // 更新评估流水线列
  updatePipelineColumn: (pipelineId: number, columnId: number, data: any) => {
    return http.put(`/api/eval-pipelines/${pipelineId}/columns/${columnId}`, data);
  },

  // 删除评估流水线列
  deletePipelineColumn: (pipelineId: number, columnId: number) => {
    return http.delete(`/api/eval-pipelines/${pipelineId}/columns/${columnId}`);
  },

  // 获取评估流水线cell的值
  getPipelineCells: (pipelineId: number, runType: string, page?: number, pageSize?: number, showFailedOnly?: boolean) => {
    const params = new URLSearchParams({
      run_type: runType
    });
    if (page !== undefined) params.append('page', page.toString());
    if (pageSize !== undefined) params.append('page_size', pageSize.toString());
    if (showFailedOnly !== undefined) params.append('show_failed_only', showFailedOnly.toString());
    return http.get(`/api/eval-pipelines/${pipelineId}/cells?${params.toString()}`);
  },

  // 更新评估流水线cell的值
  updatePipelineCell: (pipelineId: number, cellId: number, data: any) => {
    return http.patch(`/api/eval-pipelines/${pipelineId}/cell/${cellId}`, data);
  },
  
  // 获取评估流水线的结果
  getPipelineResultStatus: (pipelineId: number) => {
    return http.get(`/api/eval-pipelines/${pipelineId}/result/status`);
  },
  
  // 创建评估结果
  createResult: (pipelineId: number, data: any) => {
    return http.post(`/api/eval-pipelines/${pipelineId}/results`, data);
  },
  
  // 删除评估结果
  deleteResult: (pipelineId: number, resultId: number) => {
    return http.delete(`/api/eval-pipelines/${pipelineId}/results/${resultId}`);
  },

  // 使用行执行模式执行评估结果
  executeResultRows: (resultId: number, datasetItemIds?: number[]) => {
    const params = datasetItemIds ? `?dataset_item_ids=${datasetItemIds.join(',')}` : '';
    return http.post(`/api/eval-pipelines/results/${resultId}/execute-rows${params}`);
  },
  
  // 获取行任务执行进度
  getRowTaskProgress: (resultId: number) => http.get(`/api/eval-pipelines/results/${resultId}/row-progress`),
  
  // 获取行任务列表
  getRowTasks: (resultId: number) => http.get(`/api/eval-pipelines/results/${resultId}/row-tasks`),
  
  // 执行单列评估
  evaluateColumn: (pipelineId: number, data: {
    column_id: number;
    dataset_item_id?: number;
    previous_values?: {[key: number]: any};
    value?: any;
    config?: any;
  }) => {
    return http.post(`/api/eval-pipelines/${pipelineId}/evaluate-column`, data);
  },

  // 获取评估历史记录
  getEvalHistory: (pipelineId: number) => {
    return http.get(`/api/eval-pipelines/${pipelineId}/results?exclude_staging=true`);
  },

  // 获取项目的所有评估历史记录
  getProjectEvalHistory: (projectId: number) => {
    return http.get(`/api/eval-pipelines/project/${projectId}/results?exclude_staging=true`);
  },

  // 获取评估结果详情
  getEvalResultDetail: (resultId: number) => {
    return http.get(`/api/eval-pipelines/results/${resultId}`);
  }
};

/**
 * 模型管理相关API
 */
export const ModelsAPI = {
  // ===== 提供商定义管理 =====
  
  // 获取所有可用的提供商定义（从后端配置获取）
  getProviderDefinitions: () => {
    return http.get('/api/models/provider-definitions');
  },

  // 获取指定提供商定义
  getProviderDefinition: (providerType: string) => {
    return http.get(`/api/models/provider-definitions/${providerType}`);
  },

  // ===== 提供商实例管理 =====
  
  // 获取项目下的所有提供商实例
  getProviderInstances: (projectId: number) => {
    return http.get(`/api/models/projects/${projectId}/provider-instances`);
  },

  // 获取特定提供商实例
  getProviderInstance: (projectId: number, instanceId: number) => {
    return http.get(`/api/models/projects/${projectId}/provider-instances/${instanceId}`);
  },

  // 创建提供商实例
  createProviderInstance: (projectId: number, data: {
    name: string;
    provider_type: string;
    config: Record<string, any>;
    enabled_models: string[];
  }) => {
    return http.post(`/api/models/projects/${projectId}/provider-instances`, data);
  },

  // 更新提供商实例
  updateProviderInstance: (projectId: number, instanceId: number, data: {
    name?: string;
    config?: Record<string, any>;
    is_enabled?: boolean;
    enabled_models?: string[];
  }) => {
    return http.put(`/api/models/projects/${projectId}/provider-instances/${instanceId}`, data);
  },

  // 删除提供商实例
  deleteProviderInstance: (projectId: number, instanceId: number) => {
    return http.delete(`/api/models/projects/${projectId}/provider-instances/${instanceId}`);
  },

  // 测试提供商实例连接
  testProviderInstance: (projectId: number, instanceId: number) => {
    return http.post(`/api/models/projects/${projectId}/provider-instances/${instanceId}/test`);
  },

  // ===== 自定义模型管理 =====
  
  // 获取项目下的自定义模型
  getCustomModels: (projectId: number) => {
    return http.get(`/api/models/projects/${projectId}/custom-models`);
  },

  // 获取特定自定义模型
  getCustomModel: (projectId: number, modelId: number) => {
    return http.get(`/api/models/projects/${projectId}/custom-models/${modelId}`);
  },

  // 添加自定义模型
  createCustomModel: (projectId: number, data: {
    name: string;
    model_id: string;
    provider_instance_id: number;
    description?: string;
    context_window?: number;
    input_cost_per_token?: number;
    output_cost_per_token?: number;
    supports_streaming?: boolean;
    supports_tools?: boolean;
    supports_vision?: boolean;
    config?: Record<string, any>;
  }) => {
    return http.post(`/api/models/projects/${projectId}/custom-models`, data);
  },

  // 更新自定义模型
  updateCustomModel: (projectId: number, modelId: number, data: {
    name?: string;
    description?: string;
    context_window?: number;
    input_cost_per_token?: number;
    output_cost_per_token?: number;
    supports_streaming?: boolean;
    supports_tools?: boolean;
    supports_vision?: boolean;
    config?: Record<string, any>;
    is_enabled?: boolean;
  }) => {
    return http.put(`/api/models/projects/${projectId}/custom-models/${modelId}`, data);
  },

  // 删除自定义模型
  deleteCustomModel: (projectId: number, modelId: number) => {
    return http.delete(`/api/models/projects/${projectId}/custom-models/${modelId}`);
  },

  // ===== 可用模型查询 =====
  
  // 获取项目下所有可用的模型（用于前端选择）
  getAvailableModels: (projectId: number): Promise<AxiosResponse<AvailableModel[]>> => {
    return http.get(`/api/models/projects/${projectId}/available-models`);
  },

  // 获取特定模型的调用配置
  getModelCallConfig: (projectId: number, modelId: string) => {
    return http.get(`/api/models/projects/${projectId}/models/${modelId}/config`);
  },

  // ===== 模型连接测试 =====
  
  // 测试提供商连接（不保存实例）
  testConnection: (data: {
    provider_type: string;
    config: Record<string, any>;
  }) => {
    return http.post('/api/models/test-connection', data);
  }
};

/**
 * AI功能模型配置及调用 API
 *
 * 支持的 feature_key：
 *   translate               - 提示词翻译
 *   test_case_generator     - 测试用例生成
 *   prompt_optimizer        - 提示词优化
 *   prompt_assistant_chat   - AI助手对话（标准）
 *   prompt_assistant_mini   - AI助手辅助任务（快速）
 */
export const AIFeaturesAPI = {
  /** 获取项目所有AI功能模型配置 */
  getFeatureConfigs: (projectId: number) => {
    return http.get(`/api/projects/${projectId}/ai-feature-configs`);
  },

  /** 批量更新AI功能模型配置 */
  updateFeatureConfigs: (projectId: number, configs: Array<{
    feature_key: string;
    provider: string;
    model_id: string;
  }>) => {
    return http.put(`/api/projects/${projectId}/ai-feature-configs`, { configs });
  },

  /** AI功能调用（非流式）：后端自动读取配置的模型 */
  callFeature: (projectId: number, data: {
    feature_key: string;
    messages: Array<{ role: string; content: string }>;
    temperature?: number;
    max_tokens?: number;
    prompt_id?: number;
    prompt_version_id?: number;
    extra_params?: Record<string, any>;
  }, signal?: AbortSignal) => {
    return http.post<LLMCallResponse>(`/api/projects/${projectId}/ai-features/call`, data, { signal });
  },

  /** AI功能调用（流式SSE）：后端自动读取配置的模型 */
  callFeatureStream: async (
    projectId: number,
    data: {
      feature_key: string;
      messages: Array<{ role: string; content: string }>;
      temperature?: number;
      max_tokens?: number;
      prompt_id?: number;
      prompt_version_id?: number;
    },
    signal?: AbortSignal,
    onChunk?: (content: string) => void,
  ) => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SERVER_HOST || ''}/api/projects/${projectId}/ai-features/call-stream`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('access_token') || ''}`,
          },
          body: JSON.stringify(data),
          signal,
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('ReadableStream not supported');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = decoder.decode(value, { stream: true });
          const lines = text.split('\n').filter(l => l.trim());

          for (const line of lines) {
            try {
              const chunk = JSON.parse(line);
              if (chunk.type === 'chunk' && chunk.content) {
                accumulated += chunk.content;
                onChunk?.(chunk.content);
              } else if (chunk.type === 'done') {
                return {
                  content: accumulated,
                  usage: chunk.usage ?? null,
                  cost: chunk.cost ?? null,
                  execution_time: chunk.execution_time ?? null,
                  model: chunk.model ?? null,
                };
              } else if (chunk.type === 'error') {
                throw new Error(chunk.error || '流式调用失败');
              }
            } catch (parseError) {
              console.warn('解析SSE数据失败:', parseError);
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      return { content: accumulated, usage: null, cost: null, execution_time: null, model: null };
    } catch (error) {
      if (signal?.aborted) {
        throw new Error('请求已取消');
      }
      throw error;
    }
  },
};