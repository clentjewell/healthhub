import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { abs, urlset, ymd } from '../lib/sitemap';

export const GET: APIRoute = async () => {
  const posts = (await getCollection('blog')).filter((p) => !p.data.draft);
  return urlset(
    posts.map((p) => ({
      loc: abs(`/blog/${p.id}/`),
      lastmod: ymd(p.data.updatedDate ?? p.data.publishDate),
    })),
  );
};
