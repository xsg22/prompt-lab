import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

// 导入语言资源
import zhCN from './locales/zh.json'
import enUS from './locales/en.json'

// 支持的语言列表
export const supportedLanguages = [
  { code: 'zh', name: '中文', nativeName: '中文' },
  { code: 'en', name: 'English', nativeName: 'English' }
]

// 语言资源配置
const resources = {
  zh: {
    translation: zhCN
  },
  en: {
    translation: enUS
  }
}

// 初始化i18n
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'zh', // 默认语言
    
    // 语言检测配置
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      lookupLocalStorage: 'promptlab_language',
      caches: ['localStorage'],
    },

    interpolation: {
      escapeValue: false, // React已经处理了XSS保护
    },

    // 调试模式
    debug: process.env.NODE_ENV === 'development',
  })

export default i18n
