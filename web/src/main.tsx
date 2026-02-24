import '@ant-design/v5-patch-for-react-19';
import 'antd/dist/reset.css'; // Ant Design 5.x 重置样式
import './styles/antd-tailwind.css'; // Ant Design + Tailwind 集成样式
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'


ReactDOM.createRoot(document.getElementById('root')!).render(
  // <React.StrictMode>
    <App />
  // </React.StrictMode>,
)
