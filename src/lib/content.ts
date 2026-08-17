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

export type PageId = 'home' | 'booking' | 'contact' | 'events' | 'practitioners' | 'faq';

export async function getPage(id: PageId) {
  const entry = await getEntry('pages', id);
  if (!entry) throw new Error(`Missing src/content/pages/${id}.yml`);
  return entry.data;
}

/** Full single-line address, derived so it can't drift from the parts. */
export function formatAddress(s: Awaited<ReturnType<typeof getSettings>>) {
  return `${s.street}, ${s.locality} ${s.region} ${s.postcode}`;
}

/** Keyless Google Maps embed for the settings address. */
export function mapEmbedSrc(s: Awaited<ReturnType<typeof getSettings>>) {
  // Prefer the exact coordinates when we have them: a text query lets Google
  // pick, and for this address it lands on the road rather than the building.
  const q = s.lat != null && s.lng != null ? `${s.lat},${s.lng}` : s.mapQuery;
  return `https://maps.google.com/maps?q=${encodeURIComponent(
    q,
  )}&t=&z=16&ie=UTF8&iwloc=&output=embed`;
}
