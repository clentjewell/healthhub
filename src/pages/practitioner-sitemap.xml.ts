import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { abs, urlset } from '../lib/sitemap';

export const GET: APIRoute = async () => {
  const pracs = (await getCollection('practitioners')).filter((p) => p.data.active !== false);
  return urlset(pracs.map((p) => ({ loc: abs(`/our-practitioner/${p.id}/`) })));
};
