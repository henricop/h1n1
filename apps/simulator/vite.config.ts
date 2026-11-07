import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({ plugins: [react()], build: { target: 'es2022', chunkSizeWarningLimit: 1600 }, server: { host: '127.0.0.1', port: 3000, strictPort: true } });
