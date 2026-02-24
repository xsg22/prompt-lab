# PromptHistoryDrawer 组件

## 概述

`PromptHistoryDrawer` 是一个用于显示提示词历史请求记录的右侧抽屉组件。它提供了分页浏览历史记录，点击查看详情等功能。

## 功能特性

- 📊 **分页展示**: 支持分页浏览历史记录，避免一次性加载大量数据
- 🔍 **详情查看**: 点击历史记录可以查看完整的请求和响应详情
- 🎯 **来源筛选**: 支持按请求来源筛选历史记录
- 📱 **响应式设计**: 自适应不同屏幕尺寸
- ⚡ **性能优化**: 懒加载数据，仅在打开时获取

## 使用方法

```tsx
import PromptHistoryDrawer from '@/components/PromptHistoryDrawer';

function MyComponent() {
  const [visible, setVisible] = useState(false);
  
  const handleViewDetails = (outputItem: OutputItem) => {
    // 处理查看详情逻辑
    console.log('查看详情:', outputItem);
  };

  return (
    <>
      <Button onClick={() => setVisible(true)}>
        查看历史
      </Button>
      
      <PromptHistoryDrawer
        visible={visible}
        onClose={() => setVisible(false)}
        promptId={123}
        projectId={456}
        onViewDetails={handleViewDetails}
        source="prompt_editor_test"
      />
    </>
  );
}
```

## Props

| 属性名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `visible` | `boolean` | ✅ | - | 抽屉是否可见 |
| `onClose` | `() => void` | ✅ | - | 关闭抽屉的回调函数 |
| `promptId` | `number` | ✅ | - | 提示词ID |
| `projectId` | `number` | ✅ | - | 项目ID |
| `onViewDetails` | `(outputItem: OutputItem) => void` | ✅ | - | 查看历史记录详情的回调函数 |
| `source` | `string` | ❌ | `'prompt_editor_test'` | 请求来源筛选条件 |
| `width` | `number` | ❌ | `600` | 抽屉宽度（像素） |

## 数据结构

### HistoryItem 接口

```typescript
interface HistoryItem {
  id: number;
  created_at: string;
  success: boolean;
  input?: {
    config?: {
      model?: string;
    };
    messages?: Array<{
      role: string;
      content: string;
    }>;
  };
  output?: string;
  error_message?: string;
  execution_time?: number;
  total_tokens?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
  cost?: string;
  source?: string;
  prompt_version_id?: number;
}
```

### OutputItem 转换

组件会自动将 `HistoryItem` 转换为 `OutputItem` 格式，以便与 `RequestDetailsModal` 组件兼容：

```typescript
const convertedOutputItem: OutputItem = {
  id: historyItem.id,
  model: historyItem.input?.config?.model || 'unknown',
  timestamp: new Date(historyItem.created_at),
  response: historyItem.output || '',
  cost: Number(historyItem.cost) || 0,
  execution_time: historyItem.execution_time || 0,
  testCase: {},
  error: historyItem.error_message || undefined,
  tokens: {
    prompt: historyItem.prompt_tokens || 0,
    completion: historyItem.completion_tokens || 0,
    total: historyItem.total_tokens || 0
  },
  requestDetails: {
    messages: historyItem.input?.messages || [],
    modelConfig: historyItem.input?.config || {},
    projectId: projectId,
    promptId: promptId,
    promptVersionId: historyItem.prompt_version_id || undefined,
    source: historyItem.source
  }
};
```

## API 依赖

组件依赖 `PromptsAPI.getHistory()` 方法获取历史数据：

```typescript
const response = await PromptsAPI.getHistory(promptId, {
  page,
  page_size: pageSize,
  source
});
```

## 样式特性

- **悬浮效果**: 鼠标悬浮时历史记录项会有边框高亮和阴影效果
- **状态指示**: 使用不同颜色的头像表示成功/失败状态
- **信息密度**: 紧凑的信息展示，包含模型、时间、输出预览、性能指标
- **分页控件**: 底部分页控件支持快速跳转和页面大小调整

## 注意事项

1. **权限检查**: 确保用户对指定的 `promptId` 和 `projectId` 有访问权限
2. **错误处理**: 组件内部已处理网络错误，会显示错误消息
3. **性能**: 仅在抽屉打开时才会发起数据请求
4. **数据清理**: 抽屉关闭时会自动清理数据和重置分页状态

## 集成示例

在 `PromptEditorPage` 中的使用示例：

```tsx
// 状态管理
const [historyDrawerVisible, setHistoryDrawerVisible] = useState(false);

// 事件处理
const handleOpenHistoryDrawer = () => {
  setHistoryDrawerVisible(true);
};

const handleCloseHistoryDrawer = () => {
  setHistoryDrawerVisible(false);
};

const handleViewHistoryDetails = (outputItem: OutputItem) => {
  setSelectedOutputForDetails(outputItem);
  setRequestDetailsModalVisible(true);
};

// 渲染
<PromptHistoryDrawer
  visible={historyDrawerVisible}
  onClose={handleCloseHistoryDrawer}
  promptId={Number(promptId)}
  projectId={Number(projectId)}
  onViewDetails={handleViewHistoryDetails}
  source="prompt_editor_test"
/>
```

## 扩展性

组件设计时考虑了扩展性：

- 支持自定义筛选条件（`source` 参数）
- 支持自定义抽屉宽度
- 数据转换逻辑可以根据需要调整
- 可以轻松添加更多筛选选项（时间范围、模型类型等）