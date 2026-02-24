/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  // 避免与Ant Design样式冲突
  corePlugins: {
    preflight: false, // 禁用Tailwind的样式重置，避免与antd冲突
  },
  theme: {
    extend: {
      colors: {
        primary: "hsl(var(--primary))",
        secondary: "hsl(var(--secondary))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        muted: "hsl(var(--muted))",
        "muted-foreground": "hsl(var(--muted-foreground))",
        border: "hsl(var(--border))",
      },
    },
  },
  plugins: [],
  // 确保Ant Design组件不受影响
  important: false,
} 