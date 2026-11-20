import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath } from 'node:url';

// base './' 로 두면 GitHub Pages 하위 경로(/chemdict-lab/)에서도 그대로 동작합니다.
// 오프라인 모드(PWA): 한 번 열면 앱·번역·펌웨어 파일을 기기에 저장해 인터넷 없이도 열립니다.
export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',          // 측정 중 자동 새로고침 금지: 새 버전은 사용자가 눌러서 적용
      injectRegister: false,
      includeAssets: ['favicon-32.png', 'logo-64.png', 'logo-128.png', 'logo-180.png'],
      manifest: {
        name: 'ChemDict Lab',
        short_name: 'ChemDict Lab',
        description: '아두이노 센서로 하는 과학실험·과학센서실험 — 코딩 없이 바로 측정하고 그래프로 해석하는 무료 MBL 앱',
        categories: ['education', 'science'],
        lang: 'ko',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        background_color: '#f7f8f7',   // 2.1: 기본 화면이 밝은 색 (A안)
        theme_color: '#ffffff',
        icons: [
          { src: 'logo-180.png', sizes: '180x180', type: 'image/png' },
          { src: 'logo-256.png', sizes: '256x256', type: 'image/png' },
          { src: 'logo-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'logo-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,hex,webmanifest}'],
        globIgnores: ['og.png'],   // 공유 미리보기 그림은 오프라인 저장에서 뺌
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        navigateFallback: 'index.html',
      },
    }),
  ],
  server: {
    fs: { allow: [fileURLToPath(new URL('..', import.meta.url))] },
  },
});
