import { defineConfig } from 'vite';

// npm run dev 에서 /api 요청을 wrangler(npm run dev:api, 8788 포트)로 넘긴다.
// wrangler 를 안 켜도 화면은 돌아가고, 사진은 임시 도형으로 대신한다.
export default defineConfig({
  build: {
    // public/assets/ (그림)와 섞이지 않게 빌드 결과물은 dist/build/ 로
    assetsDir: 'build',
  },
  server: {
    host: true,
    proxy: {
      '/api': 'http://localhost:8788',
    },
  },
});
