import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// base './' 로 두면 GitHub Pages 하위 경로(/chemdict-lab/)에서도 그대로 동작합니다.
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    fs: { allow: [fileURLToPath(new URL('..', import.meta.url))] },
  },
});
