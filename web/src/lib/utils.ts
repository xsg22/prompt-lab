import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 安全的复制文本到剪贴板
 * 兼容不同浏览器环境和HTTPS/HTTP
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    // 优先使用现代 Clipboard API (需要 HTTPS)
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    
    // 降级方案：使用传统的 execCommand 方法
    const textArea = document.createElement('textarea');
    textArea.value = text;
    
    // 设置样式使其不可见
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    const result = document.execCommand('copy');
    document.body.removeChild(textArea);
    
    return result;
  } catch (error) {
    console.error('复制失败:', error);
    return false;
  }
}

/**
 * 处理API响应格式的兼容性
 * 支持分页响应和普通数组响应
 */
export function extractDataFromResponse<T>(response: any): T[] {
  // 如果是分页响应格式
  if (response.data && response.data.data && Array.isArray(response.data.data)) {
    return response.data.data
  }
  
  // 如果是普通数组格式
  if (response.data && Array.isArray(response.data)) {
    return response.data
  }
  
  // 兜底返回空数组
  return []
}

/**
 * 从分页响应中提取元数据信息
 */
export function extractMetaFromResponse(response: any): { total?: number; page?: number; page_size?: number } {
  if (response.data && response.data.meta) {
    return response.data.meta
  }
  return {}
}

/**
 * 保存提示词编辑器模式偏好到本地存储
 * @param promptId 提示词ID
 * @param mode 编辑器模式
 */
export function saveEditorModePreference(promptId: string, mode: 'writing' | 'testing'): void {
  try {
    const key = `prompt-editor-mode-${promptId}`;
    localStorage.setItem(key, mode);
  } catch (error) {
    console.warn('保存编辑器模式偏好失败:', error);
  }
}

/**
 * 获取提示词编辑器模式偏好从本地存储
 * @param promptId 提示词ID
 * @returns 编辑器模式，如果没有保存则返回默认值 'writing'
 */
export function getEditorModePreference(promptId: string): 'writing' | 'testing' {
  try {
    const key = `prompt-editor-mode-${promptId}`;
    const saved = localStorage.getItem(key);
    if (saved && (saved === 'writing' || saved === 'testing')) {
      return saved;
    }
  } catch (error) {
    console.warn('读取编辑器模式偏好失败:', error);
  }
  return 'testing'; // 默认模式
}