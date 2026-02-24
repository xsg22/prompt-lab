import React from 'react'
import { Select, Space, Spin } from 'antd'
import { GlobalOutlined } from '@ant-design/icons'
import { useLanguage } from '../../contexts/LanguageContext'

const { Option } = Select

interface LanguageSwitchProps {
  size?: 'small' | 'middle' | 'large'
  placement?: 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight'
  style?: React.CSSProperties
  className?: string
}

export default function LanguageSwitch({ 
  size = 'middle', 
  placement = 'bottomRight',
  style,
  className 
}: LanguageSwitchProps) {
  const { currentLanguage, changeLanguage, supportedLanguages, isChangingLanguage } = useLanguage()

  return (
    <Select
      size={size}
      value={currentLanguage}
      onChange={changeLanguage}
      style={{ minWidth: 100, ...style }}
      className={className}
      placement={placement}
      suffixIcon={isChangingLanguage ? <Spin size="small" /> : <GlobalOutlined />}
      disabled={isChangingLanguage}
    >
      {supportedLanguages.map(language => (
        <Option key={language.code} value={language.code}>
          <Space size={4}>
            <span>{language.nativeName}</span>
          </Space>
        </Option>
      ))}
    </Select>
  )
}

// 简化版语言切换按钮组件（只显示图标和当前语言）
export function LanguageSwitchCompact({ 
  size = 'middle',
  style,
  className 
}: Omit<LanguageSwitchProps, 'placement'>) {
  const { currentLanguage, changeLanguage, supportedLanguages, isChangingLanguage } = useLanguage()
  
  // const currentLanguageInfo = supportedLanguages.find(lang => lang.code === currentLanguage)

  return (
    <Select
      size={size}
      value={currentLanguage}
      onChange={changeLanguage}
      style={{ minWidth: 80, ...style }}
      className={className}
      suffixIcon={isChangingLanguage ? <Spin size="small" /> : <GlobalOutlined />}
      disabled={isChangingLanguage}
    >
      {supportedLanguages.map(language => (
        <Option key={language.code} value={language.code}>
          {language.code.toUpperCase()}
        </Option>
      ))}
    </Select>
  )
}
