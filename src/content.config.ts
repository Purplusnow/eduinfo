import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// 직접 작성하는 정보 정리글
const guides = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/guides' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    category: z.string(),
    order: z.number().default(100),
    updated: z.coerce.date(),
    sources: z.array(z.object({ name: z.string(), url: z.string() })).default([]),
  }),
});

// 수집한 뉴스로 자동 생성하는 주간 브리핑(선택 기능)
const digests = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/digests' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    summary: z.string(),
    generated: z.boolean().default(true),
  }),
});

export const collections = { guides, digests };
