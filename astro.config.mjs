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
  // No redirects: every route below mirrors a URL the live WordPress site
  // already serves, so the cutover needs no redirect map. See README.
  //   /                              /
  //   /our-practitioners/            index (WP page)
  //   /our-practitioner/{slug}/      detail (WP CPT, singular base)
  //   /events/                       index (WP events archive)
  //   /event/{slug}/                 detail (WP event, singular base)
  //   /make-a-booking/               /make-a-booking/
  //   /contact/                      /contact/
  integrations: [
    sitemap(),
  ],
  image: {
    // Built-in astro:assets pipeline (sharp) → WebP + responsive sizes.
    // Remote images are scoped to the live site we migrate from (Phase 3).
    domains: ['healthhubtweedcoast.com.au'],
  },
});
