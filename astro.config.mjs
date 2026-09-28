import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// 커스텀 도메인(edu.koreanblog.xyz) 배포에서는 워크플로가 SITE_URL 을 넘기고 BASE_PATH 는 비어 있다.
// 로컬에서는 루트(/)로 동작한다.
export default defineConfig({
  site: process.env.SITE_URL || 'https://edu.koreanblog.xyz',
  base: process.env.BASE_PATH || '/',
  trailingSlash: 'always',
  integrations: [
    sitemap({
      // 검색 결과 페이지는 색인할 필요가 없다
      filter: (page) => !page.includes('/search/'),
    }),
  ],
});
