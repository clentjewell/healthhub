// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Static output → Cloudflare Pages.
// The production domain is the single canonical `site` value used for
// absolute URLs, sitemap, canonical tags and JSON-LD (SEO layer, Phase 5).
export default defineConfig({
  site: 'https://healthhubtweedcoast.com.au',
  output: 'static',
  trailingSlash: 'ignore',
  redirects: {
    // The booking page lives at /make-a-booking to match the URL the live
    // WordPress site already uses. This keeps the earlier preview path working.
    '/booking': '/make-a-booking',
  },
  integrations: [
    sitemap({
      // The Pottsville-styled proposal page must never be indexed on this
      // domain — it is excluded from the sitemap (see also robots.txt).
      filter: (page) => !page.includes('/proposals/'),
    }),
  ],
  image: {
    // Built-in astro:assets pipeline (sharp) → WebP + responsive sizes.
    // Remote images are scoped to the live site we migrate from (Phase 3).
    domains: ['healthhubtweedcoast.com.au'],
  },
});
