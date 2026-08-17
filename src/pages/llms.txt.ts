/**
 * /llms.txt — a plain-text summary for AI assistants and answer engines.
 *
 * Generated from the same collections the pages render from, so it cannot drift
 * out of date the way a hand-maintained file would. Facts only: no marketing
 * claims, and nothing that isn't already published on the site.
 */
import type { APIRoute } from 'astro';
import { getCollection, getEntry } from 'astro:content';
import { getSettings, formatAddress } from '../lib/content';
import { site } from '../data/site';
import { sessionLabel } from '../lib/calendar';
import { faqTokens, applyTokens } from '../lib/faq';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const GET: APIRoute = async () => {
  const s = await getSettings();
  const practitioners = (await getCollection('practitioners')).sort(
    (a, b) => a.data.order - b.data.order,
  );
  const services = (await getCollection('services'))
    .filter((x) => !x.data.draft)
    .sort((a, b) => a.data.order - b.data.order);
  const events = (await getCollection('events'))
    .filter((e) => e.data.active)
    .sort((a, b) => a.data.order - b.data.order);

  const byId = new Map(practitioners.map((p) => [p.id, p.data.name]));

  // Same resolved answers the page renders, so the two can never disagree.
  const faq = await getEntry('faq', 'general');
  const tokens = await faqTokens();
  const faqItems = (faq?.data.items ?? []).map((it) => ({
    ...it,
    a: applyTokens(it.a, tokens),
  }));
  const faqDisclaimer = faq?.data.disclaimer;

  const lines: string[] = [
    `# ${site.name}`,
    '',
    `> ${s.footerBlurb}`,
    '',
    `A community wellness studio in Hastings Point on the NSW Tweed Coast. Each`,
    `service is run by an independent practitioner who manages their own bookings`,
    `and fees; there is no central booking system.`,
    '',
    '## Visit',
    '',
    `- Address: ${formatAddress(s)}`,
    `- Open: ${s.hoursLabel}`,
    ...(s.phone ? [`- Phone: ${s.phone}`] : []),
    ...(s.email ? [`- Email: ${s.email}`] : []),
    `- Directions: ${s.mapUrl}`,
    ...(s.facebook ? [`- Facebook: ${s.facebook}`] : []),
    ...(s.instagram ? [`- Instagram: ${s.instagram}`] : []),
    '',
    '## Services',
    '',
    'Services do not have their own pages — each links to the practitioner who',
    'provides it, where the fees and booking pathway are listed.',
    '',
    ...services.map((x) => {
      const who = x.data.provider ? byId.get(x.data.provider) : undefined;
      const url = x.data.provider ? `${site.url}/our-practitioner/${x.data.provider}/` : '';
      return `- [${x.data.title}](${url})${who ? ` — ${who}` : ''}: ${x.data.summary}`;
    }),
    '',
    '## Practitioners',
    '',
    ...practitioners.map(
      (p) =>
        `- [${p.data.name}](${site.url}/our-practitioner/${p.id}/) — ${p.data.role}` +
        `${p.data.phone ? `, ${p.data.phone}` : ''}`,
    ),
    '',
    '## Classes and events',
    '',
    'These run on a repeating weekly schedule rather than as one-off dates.',
    '',
    ...events.map((e) => {
      const when = e.data.sessions.length
        ? e.data.sessions
            .map((x) => sessionLabel({ day: DAYS.indexOf(x.day), start: x.start, end: x.end, label: x.label }))
            .join('; ')
        : (e.data.schedule ?? 'By arrangement');
      const cost = e.data.price ? ` — ${e.data.price}` : '';
      return `- [${e.data.title}](${site.url}/event/${e.id}/) — ${when}${cost}` +
        `${e.data.instructor ? ` — with ${e.data.instructor}` : ''}`;
    }),
    '',
    // The full Q&A, not a pointer to it. An assistant answering "do I need a
    // referral for acupuncture at Hastings Point" should be able to answer from
    // this file without fetching another page, and each answer keeps the
    // fragment that cites it on the site.
    '## Frequently asked questions',
    '',
    ...faqItems.flatMap((it) => [
      `### ${it.q}`,
      '',
      it.a,
      '',
      `Source: ${site.url}/faq/#${it.id}`,
      '',
    ]),
    ...(faqDisclaimer ? [`_${faqDisclaimer}_`, ''] : []),
    '## Key pages',
    '',
    `- [Home](${site.url}/)`,
    `- [Practitioners](${site.url}/our-practitioners/)`,
    `- [Classes & events](${site.url}/events/)`,
    `- [Weekly timetable](${site.url}/event/health-hub-studio-time-table/)`,
    `- [Make a booking](${site.url}/make-a-booking/)`,
    `- [FAQ](${site.url}/faq/)`,
    `- [Contact](${site.url}/contact/)`,
    '',
  ];

  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
