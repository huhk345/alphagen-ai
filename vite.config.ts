import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.VITE_GITHUB_CLIENT_ID': JSON.stringify(env.VITE_GITHUB_CLIENT_ID || env.GITHUB_CLIENT_ID),
        'process.env.ALLOWED_EMAILS': JSON.stringify(env.VITE_ALLOWED_EMAILS || env.ALLOWED_EMAILS),
        'process.env.VITE_API_URL': JSON.stringify(env.VITE_API_URL),
        'process.env.GITHUB_CLIENT_SECRET': JSON.stringify(env.GITHUB_CLIENT_SECRET),
        'process.env.GITHUB_CLIENT_ID': JSON.stringify(env.GITHUB_CLIENT_ID),

      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
