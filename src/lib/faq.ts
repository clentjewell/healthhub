/**
 * Placeholder resolution for FAQ answers.
 *
 * The FAQ repeats facts that are already recorded elsewhere — the address, the
 * opening hours, which services take online bookings. Re-typing them into an
 * answer is how a site ends up telling a visitor one thing on /faq/ and another
 * on the practitioner's own page, which is worse than saying nothing: an answer
 * engine will happily quote the wrong one. So the volatile parts are tokens,
 * resolved here from the same collections the rest of the site renders from.
 *
 * The booking split is the reason this exists. The first draft of the FAQ said
 * yoga and functional fitness were phone-only, while both practitioners in fact
 * have online booking links on their profiles.
 */
import { getCollection, getEntry } from 'astro:content';
import { getSettings, formatAddress } from './content';

/** "A", "A and B", "A, B and C" — no Oxford comma, matching the site's copy. */
function listSentence(parts: string[]): string {
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

export async function faqTokens(): Promise<Record<string, string>> {
  const s = await getSettings();

  const services = (await getCollection('services'))
    .filter((x) => !x.data.draft)
    .sort((a, b) => a.data.order - b.data.order);

  const online: string[] = [];
  const byPhone: string[] = [];
  for (const svc of services) {
    const label = svc.data.shortTitle ?? svc.data.title;
    const who = svc.data.provider ? await getEntry('practitioners', svc.data.provider) : undefined;
    (who?.data.bookingUrl ? online : byPhone).push(label);
  }

  return {
    address: formatAddress(s),
    hours: s.hoursLabel,
    phone: s.phone ?? '',
    bookOnline: listSentence(online),
    bookByPhone: listSentence(byPhone),
  };
}

/**
 * Substitutes {{token}} in an answer.
 *
 * An unrecognised token throws rather than rendering literally. A visitor
 * reading "open {{huors}}" is a worse outcome than a failed deploy, and the
 * build is the only place that mistake can still be caught cheaply.
 */
export function applyTokens(text: string, tokens: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    if (!(key in tokens)) {
      throw new Error(
        `FAQ answer uses unknown placeholder {{${key}}}. Known tokens: ${Object.keys(tokens).join(', ')}.`,
      );
    }
    return tokens[key];
  });
}
