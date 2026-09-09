import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { abs, urlset } from '../lib/sitemap';

export const GET: APIRoute = async () => {
  const events = (await getCollection('events')).filter((e) => e.data.active !== false);
  return urlset(events.map((e) => ({ loc: abs(`/event/${e.id}/`) })));
};
