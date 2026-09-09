import { getEntry } from 'astro:content';

/**
 * Typed accessors for the CMS-editable settings and page copy.
 *
 * Both throw if the entry is missing, which fails the build rather than
 * rendering a page full of `undefined` — the same "a bad edit never reaches
 * the live site" guarantee the deploy workflow relies on.
 */

export async function getSettings() {
  const entry = await getEntry('settings', 'general');
  if (!entry) throw new Error('Missing src/content/settings/general.yml');
  return entry.data;
}

export type PageId = 'home' | 'booking' | 'contact' | 'events' | 'practitioners' | 'faq' | 'blog';

export async function getPage(id: PageId) {
  const entry = await getEntry('pages', id);
  if (!entry) throw new Error(`Missing src/content/pages/${id}.yml`);
  return entry.data;
}

/** Full single-line address, derived so it can't drift from the parts. */
export function formatAddress(s: Awaited<ReturnType<typeof getSettings>>) {
  return `${s.street}, ${s.locality} ${s.region} ${s.postcode}`;
}

/** Map embed src for the studio.
 *  1. If `mapEmbed` is set (the "Embed a map" code from the Google Business
 *     listing), use it — that's what shows the rich place card with rating and
 *     directions. Accepts either the whole <iframe …> or just its src URL.
 *  2. Otherwise fall back to a keyless place embed by business name + address,
 *     so it still resolves to the listing (name + directions) rather than a
 *     bare coordinate pin. */
export function mapEmbedSrc(s: Awaited<ReturnType<typeof getSettings>>) {
  const custom = (s.mapEmbed ?? '').trim();
  if (custom) {
    const m = custom.match(/src\s*=\s*["']([^"']+)["']/i);
    return m ? m[1] : custom;
  }
  const name = `${s.brandName ?? ''} ${s.brandTagline ?? ''}`.trim();
  const q = [name, s.street, `${s.locality} ${s.region} ${s.postcode}`]
    .map((p) => (p ?? '').trim())
    .filter(Boolean)
    .join(', ') || (s.lat != null && s.lng != null ? `${s.lat},${s.lng}` : s.mapQuery);
  return `https://maps.google.com/maps?q=${encodeURIComponent(q)}&t=&z=16&ie=UTF8&iwloc=&output=embed`;
}
