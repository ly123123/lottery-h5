import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  build: { target: 'es2020', chunkSizeWarningLimit: 1200 },
  // 允许通过内网穿透域名访问本地预览（仅影响 dev/preview，不影响构建产物）
  preview: { allowedHosts: ['.trycloudflare.com', 'localhost', '127.0.0.1'] },
  server: { allowedHosts: ['.trycloudflare.com', 'localhost', '127.0.0.1'] },
});
