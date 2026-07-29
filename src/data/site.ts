/**
 * Build-time site configuration.
 *
 * Only values that are NOT content live here — the canonical domain and the
 * SEO fallbacks used to build absolute URLs. Everything editable (address,
 * hours, phone, socials, header menu, footer text, page copy) lives in the
 * CMS-backed collections:
 *
 *   src/content/settings/general.yml   → Settings in the CMS
 *   src/content/pages/*.yml            → Pages in the CMS
 *
 * Read those via `src/lib/content.ts` (`getSettings()` / `getPage()`).
 */
export const site = {
  name: 'Health Hub Tweed Coast',
  domain: 'healthhubtweedcoast.com.au',
  url: 'https://healthhubtweedcoast.com.au',
  /** Fallback meta description for pages that don't set their own. */
  description:
    'Health Hub Tweed Coast — a community wellness studio at Hastings Point. Acupuncture, allied health, movement classes and events on the Tweed Coast.',
} as const;
