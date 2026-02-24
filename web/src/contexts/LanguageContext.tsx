import React, { createContext, useContext } from 'react'

// 语言上下文类型定义
interface LanguageContextType {
  currentLanguage: string
  changeLanguage: (language: string) => void
  supportedLanguages: Array<{ code: string; name: string; nativeName: string }>
  isChangingLanguage: boolean
}

// 创建语言上下文
const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

// 语言提供者组件（简化版，固定为中文）
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const contextValue: LanguageContextType = {
    currentLanguage: 'zh',
    changeLanguage: () => {}, // 空函数，不再切换语言
    supportedLanguages: [{ code: 'zh', name: '中文', nativeName: '中文' }],
    isChangingLanguage: false
  }

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  )
}

// 自定义Hook用于使用语言上下文
export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}
