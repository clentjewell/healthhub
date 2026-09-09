import type { APIRoute } from 'astro';
import { abs, sitemapIndex } from '../lib/sitemap';

export const GET: APIRoute = () =>
  sitemapIndex([
    { loc: abs('/page-sitemap.xml') },
    { loc: abs('/post-sitemap.xml') },
    { loc: abs('/event-sitemap.xml') },
    { loc: abs('/practitioner-sitemap.xml') },
  ]);
