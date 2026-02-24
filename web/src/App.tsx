import { BrowserRouter as Router } from 'react-router-dom';
import { useRoutes } from 'react-router-dom';
import { ProjectProvider } from './contexts/ProjectContext';
import routes from './routes';
import { ConfigProvider, App as AntdApp } from 'antd';
import zhCN from 'antd/locale/zh_CN'
import { AuthWrapper } from '@/components/auth/AuthWrapper'

const theme = {
  token: {
    colorPrimary: '#1890ff',
  },
}

function App() {
  return (
      <AntdApp>
        <ConfigProvider locale={zhCN} theme={theme}>
          <Router future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
            <AuthWrapper>
              <ProjectProvider>
                <AppContent />
              </ProjectProvider>
            </AuthWrapper>
          </Router>
        </ConfigProvider>
      </AntdApp>
  );
}

function AppContent() {
  const routeElements = useRoutes(routes);
  return <>{routeElements}</>;
}

export default App;
