/**
 * Custom sitemaps, split by content type (RankMath-style):
 *   /sitemap-index.xml   → lists the sub-sitemaps below
 *   /page-sitemap.xml     → the fixed site pages
 *   /post-sitemap.xml     → blog posts
 *   /event-sitemap.xml    → classes & events
 *   /practitioner-sitemap.xml → practitioner profiles
 * Services have no pages of their own, so they get no sitemap.
 * Each file references public/sitemap.xsl for the branded browser view.
 */
import { site } from '../data/site';

const BASE = site.url.replace(/\/$/, '');
export const abs = (path: string) => BASE + path;

const STYLESHEET = `<?xml-stylesheet type="text/xsl" href="${abs('/sitemap.xsl')}"?>`;

export interface SitemapEntry {
  loc: string;
  lastmod?: string;
}

function xml(body: string): Response {
  return new Response(body, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
}

/** A <urlset> sitemap (a list of page URLs). */
export function urlset(entries: SitemapEntry[]): Response {
  const rows = entries
    .map((e) => `<url><loc>${e.loc}</loc>${e.lastmod ? `<lastmod>${e.lastmod}</lastmod>` : ''}</url>`)
    .join('');
  return xml(
    `<?xml version="1.0" encoding="UTF-8"?>${STYLESHEET}` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${rows}</urlset>`,
  );
}

/** A <sitemapindex> (a list of sub-sitemaps). */
export function sitemapIndex(entries: SitemapEntry[]): Response {
  const rows = entries
    .map((e) => `<sitemap><loc>${e.loc}</loc>${e.lastmod ? `<lastmod>${e.lastmod}</lastmod>` : ''}</sitemap>`)
    .join('');
  return xml(
    `<?xml version="1.0" encoding="UTF-8"?>${STYLESHEET}` +
      `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${rows}</sitemapindex>`,
  );
}

/** W3C date (YYYY-MM-DD) for a lastmod value. */
export const ymd = (d: Date) => d.toISOString().slice(0, 10);
