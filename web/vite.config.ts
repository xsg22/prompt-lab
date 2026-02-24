import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // 加载环境变量
  const env = loadEnv(mode, process.cwd())
  
  if (mode === 'production' && env.VITE_SERVER_HOST) {
    // 删除不需要的环境变量
    delete env.VITE_SERVER_HOST
  }

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 3000,
      proxy: {
        '/api': {
          target: 'http://localhost:8000',
          changeOrigin: true,
          secure: false,
        },
      },
    },
    build: {
      outDir: path.resolve(__dirname, '../server/app/public'),
      emptyOutDir: true,
    },
    // 将处理后的环境变量传递给应用
    define: {
      'process.env': env
    }
  }
})
