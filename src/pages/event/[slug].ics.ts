/**
 * A real .ics file per event, at /event/{slug}.ics.
 *
 * Generated at build time so the "iCalendar" option in the Add to calendar
 * dropdown is a plain download that works without JavaScript. Each session
 * becomes a weekly recurring entry, so the file does not go stale between
 * deploys the way a fixed single date would.
 */
import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';
import { buildIcs } from '../../lib/calendar';
import { site } from '../../data/site';

export const getStaticPaths: GetStaticPaths = async () => {
  const events = await getCollection('events');
  return events
    .filter((e) => e.data.active && e.data.sessions.length > 0)
    .map((entry) => ({ params: { slug: entry.id }, props: { entry } }));
};

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const GET: APIRoute = ({ props }) => {
  const { entry } = props as { entry: Awaited<ReturnType<typeof getCollection<'events'>>>[number] };
  const d = entry.data;

  const ics = buildIcs({
    title: d.title,
    description: d.summary,
    location: d.location ?? 'Health Hub Tweed Coast, Hastings Point',
    url: `${site.url}/event/${entry.id}/`,
    slug: entry.id,
    sessions: d.sessions.map((s) => ({
      day: DAYS.indexOf(s.day),
      start: s.start,
      end: s.end,
    })),
  });

  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${entry.id}.ics"`,
    },
  });
};
