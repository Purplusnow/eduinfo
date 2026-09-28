import { defineConfig } from 'astro/config';

// GitHub Pages 프로젝트 페이지(https://<user>.github.io/<repo>/)에서는 워크플로가
// SITE_URL, BASE_PATH 를 넘겨준다. 로컬에서는 루트(/)로 동작한다.
export default defineConfig({
  site: process.env.SITE_URL || 'http://localhost:4321',
  base: process.env.BASE_PATH || '/',
  trailingSlash: 'always',
});
