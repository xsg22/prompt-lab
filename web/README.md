# PromptLab 前端

这是PromptLab项目的前端部分，使用Vite、React、TypeScript、Tailwind CSS和Ant Design构建。

## 技术栈

- **框架**: React + TypeScript
- **构建工具**: Vite
- **路由**: React Router
- **样式**: Tailwind CSS + Ant Design
- **HTTP客户端**: Axios

## 目录结构

```
src/
├── components/       # UI组件
│   ├── layouts/      # 布局组件
│   └── ui/           # 基础UI组件
├── contexts/         # React上下文
├── hooks/            # 自定义React钩子
├── lib/              # 工具库
├── pages/            # 页面组件
├── utils/            # 工具函数
├── App.tsx           # 应用入口
├── AppRoutes.tsx     # 路由配置
└── main.tsx          # 主渲染入口
```

## 开发

1. 安装依赖
```bash
npm install
```

2. 启动开发服务器
```bash
npm run dev
```

3. 构建生产版本
```bash
npm run build
```

## API连接

默认情况下，前端应用会连接到`http://localhost:8000`作为API服务器。
可以通过环境变量`VITE_API_URL`修改API地址。

## 主要功能

- 用户认证（登录/注册）
- 提示词管理
- 数据集管理 
- 评估管理
