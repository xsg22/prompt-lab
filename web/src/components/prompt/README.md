# Prompt组件集合

本目录包含与提示词相关的UI组件。

## 组件列表

### TestCaseCard
测试用例卡片组件，用于显示和编辑单个测试用例。

### DatasetActions
数据集操作下拉菜单组件，提供导入/导出数据集的入口。

**Props:**
- `onImportFromDataset: () => void` - 从数据集导入回调
- `onExportToDataset: () => void` - 导出到数据集回调
- `hasVariables: boolean` - 是否有变量（影响导入按钮状态）
- `hasTestCases: boolean` - 是否有测试用例（影响导出按钮状态）

### ExportToDatasetModal
导出测试用例到数据集的Modal组件。

**功能特性:**
- 支持选择现有数据集或创建新数据集
- 数据集搜索过滤
- 批量导出测试用例

**Props:**
- `visible: boolean` - 显示状态
- `onClose: () => void` - 关闭回调
- `testCases: TestCase[]` - 要导出的测试用例
- `variables: string[]` - 提示词变量列表
- `projectId: number` - 项目ID

### ImportFromDatasetModal
从数据集导入测试用例的Modal组件。

**功能特性:**
- 数据集选择和数据项预览
- 智能变量映射（完全匹配 > 模糊匹配 > 默认映射）
- 可编辑的变量映射关系
- 支持选择多个数据项（最多10条）
- 优化的UI样式（减少弹框宽度，增大字体，居中对齐）

**Props:**
- `visible: boolean` - 显示状态
- `onClose: () => void` - 关闭回调
- `onImportSuccess: (testCases: TestCase[]) => void` - 导入成功回调
- `variables: string[]` - 提示词变量列表
- `projectId: number` - 项目ID

## 重构说明

这些组件是从 `PromptEditorPage.tsx` 中提取出来的，目的是：
1. 减少主文件的行数和复杂度
2. 提高组件复用性
3. 便于维护和测试
4. 优化用户体验

### UI优化
- 将导入弹框宽度从1000px减少到800px
- 增大变量映射关系中的字体大小（14px-16px）
- 使用网格布局和居中对齐减少变量之间的距离
- 增加内边距和间距提升视觉效果
- 调整映射关系显示方向：数据集变量（左）→ 提示词变量（右），符合数据流向逻辑

### 智能变量映射
- 优先进行完全匹配
- 支持模糊匹配（忽略大小写、下划线、连字符）
- 智能回退到第一个可用变量
- 用户可手动编辑映射关系
