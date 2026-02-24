// 分页请求参数
export interface PaginationParams {
  page?: number;
  page_size?: number;
}

// 排序参数
export interface SortParams {
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

// 搜索参数
export interface SearchParams {
  search?: string;
}

// 分页元数据
export interface PaginationMeta {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

// 分页响应
export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

// ProTable请求参数类型
export interface ProTableParams {
  current?: number;
  pageSize?: number;
  [key: string]: any;
}

// 通用列表查询参数
export interface ListQueryParams extends PaginationParams, SortParams, SearchParams {
  enabled_only?: boolean;
} 