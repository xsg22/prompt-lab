import { Navigate, type RouteObject } from "react-router-dom";
import { PrivateRoute, PublicRoute } from "./components/PrivateRoute";
import { AdminLayout } from "./components/layouts/AdminLayout";

// 页面组件
import { LandingPage } from "./pages/LandingPage";
import PromptsPage from "./pages/prompts/PromptsPage";
import PromptOverviewPage from "./pages/prompts/PromptOverviewPage";
import { LoginPage, RegisterPage } from "@/components/auth/AuthPages";

// 使用现有的页面，去掉不存在的导入
import DatasetsPage from "./pages/datasets/DatasetsPage";
import DatasetDetailPage from "./pages/datasets/DatasetDetailPage";
import { ProjectSettings } from "./pages/project/Settings";
import InvitePage from "./pages/user/InvitePage";
import NotFoundPage from "./pages/NotFoundPage";

// 导入评估流水线页面
import EvalPipelinesPage from "./pages/evaluations/EvalPipelinesPage";
import InstantEvalPipelinePage from "./pages/evaluations/EvalPipelineDetailPage";
import EvalHistoryPage from "./pages/evaluations/EvalHistoryPage";
import EvalResultDetailPage from "./pages/evaluations/EvalResultDetailPage";
import PromptEditorPage from "./pages/prompts/PromptEditorPage";


const routes: RouteObject[] = [
  // 主页路由（无需登录）
  {
    path: "/",
    element: <LandingPage />,
  },
  
  // 公共路由（无需登录）- 放在最前面确保优先匹配
  {
    element: <PublicRoute />,
    children: [
      {
        path: "/login",
        element: <LoginPage />,
      },
      {
        path: "/register",
        element: <RegisterPage />,
      },
      {
        path: "/invite/:token",
        element: <InvitePage />,
      }
    ],
  },
  
  // 工作台重定向
  {
    path: "/dashboard",
    element: <Navigate to="/project" replace />,
  },
  
  // 受保护路由（需要登录）
  {
    element: <PrivateRoute />,
    path: "/project/:projectId?",
    children: [
      {
        element: <AdminLayout />,
        children: [
          {
            path: "",
            element: <PromptsPage />,
          },
          {
            path: "prompts",
            element: <PromptsPage />,
          },
          {
            path: "prompts/:id/overview",
            element: <PromptOverviewPage />,
          },
          {
            path: "prompts/:id/editor",
            element: <PromptEditorPage />,
          },
          {
            path: "datasets",
            element: <DatasetsPage />,
          },
          {
            path: "datasets/:id",
            element: <DatasetDetailPage />,
          },
          { 
            path: 'eval-pipelines', 
            element: <EvalPipelinesPage /> 
          },
          { 
            path: 'eval-pipelines/:pipelineId', 
            element: <InstantEvalPipelinePage /> 
          },
          { 
            path: 'eval-pipelines/:pipelineId/history', 
            element: <EvalHistoryPage /> 
          },
          { 
            path: 'eval-pipelines/:pipelineId/results/:resultId', 
            element: <EvalResultDetailPage /> 
          },
          {
            path: "settings",
            element: <ProjectSettings />,
          },
        ],
      },
    ],
  },

  
  // 404 页面
  {
    path: "*",
    element: <NotFoundPage />,
  },
];

export default routes; 