export interface PromptVersion {
    id: number;
    prompt_id: number;
    version_number: number;
    variables: string[];
    created_at: string;
    messages?: any[];
    model_name?: string;
    model_params?: any;
}

export interface TestCase {
    [key: string]: any;
    // 可选的元数据字段
    metadatas?: {
        source: 'manual' | 'ai_generated'; // 来源：手动添加 或 AI生成
        type?: 'normal' | 'boundary' | 'error'; // 类型：正常、边界、异常
        generatedAt?: string; // 生成时间
    };
}

export interface Tag {
    id: number
    name: string
    color?: string
    project_id: number
}

export interface Prompt {
    id: number
    name: string
    description: string | null
    created_at: string
    updated_at: string
    nickname?: string
    user_id?: number
    status: string
    is_template: boolean
    tags: Tag[]
    is_favorited: boolean
}

export interface FilterOptions {
    search: string
    selectedTags: number[]
    status: string
    creator: string
    favoritesOnly: boolean
    isTemplate: boolean | null
    sortBy: string
    sortOrder: string
}

export interface ViewMode {
    groupBy: 'none' | 'creator' | 'tags' | 'status'
}