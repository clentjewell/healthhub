/**
 * Schema.org JSON-LD builders.
 *
 * Everything is emitted as a single `@graph` per page so nodes can reference
 * each other by `@id` instead of repeating the business details on every page.
 * All facts come from the content collections — the address, hours and socials
 * are only ever edited in Settings, and this reads from there.
 *
 * `geo` comes from the coordinates on the studio's own Google Maps listing, held
 * in Settings — not from geocoding the street address, which resolved only to
 * the road centreline.
 */
import { site } from '../data/site';

type Settings = {
  brandName: string;
  brandTagline: string;
  street: string;
  locality: string;
  region: string;
  postcode: string;
  phone?: string;
  email?: string;
  mapUrl: string;
  lat?: number;
  lng?: number;
  hoursOpen: string;
  hoursClose: string;
  instagram?: string;
  facebook?: string;
  footerBlurb: string;
};

export const BUSINESS_ID = `${site.url}/#business`;
export const WEBSITE_ID = `${site.url}/#website`;

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** Absolute URL from a site-relative path, always with a trailing slash. */
export function abs(path: string): string {
  const p = path === '/' ? '/' : `${path.replace(/\/+$/, '')}/`;
  return new URL(p, site.url).href;
}

/**
 * The business itself. `HealthAndBeautyBusiness` is a Google-recognised
 * LocalBusiness subtype — accurate for a wellness studio, and it avoids
 * claiming to be a medical clinic, which carries obligations the client has not
 * asked for.
 */
export function businessNode(s: Settings) {
  const sameAs = [s.facebook, s.instagram].filter(Boolean);
  return {
    '@type': ['LocalBusiness', 'HealthAndBeautyBusiness'],
    '@id': BUSINESS_ID,
    name: site.name,
    alternateName: `${s.brandName} ${s.brandTagline}`,
    description: s.footerBlurb,
    url: site.url,
    ...(s.phone ? { telephone: s.phone } : {}),
    ...(s.email ? { email: s.email } : {}),
    image: abs('/assets/og-default.jpg').replace(/\/$/, ''),
    logo: `${site.url}/images/logo.png`,
    hasMap: s.mapUrl,
    address: {
      '@type': 'PostalAddress',
      streetAddress: s.street,
      addressLocality: s.locality,
      addressRegion: s.region,
      postalCode: s.postcode,
      addressCountry: 'AU',
    },
    ...(s.lat != null && s.lng != null
      ? { geo: { '@type': 'GeoCoordinates', latitude: s.lat, longitude: s.lng } }
      : {}),
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: DAYS,
        opens: s.hoursOpen,
        closes: s.hoursClose,
      },
    ],
    ...(sameAs.length ? { sameAs } : {}),
    areaServed: [
      { '@type': 'Place', name: 'Hastings Point' },
      { '@type': 'Place', name: 'Pottsville' },
      { '@type': 'Place', name: 'Cabarita Beach' },
      { '@type': 'Place', name: 'Tweed Coast' },
    ],
  };
}

export function websiteNode() {
  return {
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    url: site.url,
    name: site.name,
    inLanguage: 'en-AU',
    publisher: { '@id': BUSINESS_ID },
  };
}

/** A practitioner profile. */
export function personNode(p: {
  id: string;
  name: string;
  role: string;
  image?: string;
  phone?: string;
  facebook?: string;
  instagram?: string;
  website?: string;
  serviceTitle?: string;
  summary?: string;
}) {
  const sameAs = [p.facebook, p.instagram, p.website].filter(Boolean);
  const url = abs(`/our-practitioner/${p.id}`);
  return {
    '@type': 'Person',
    '@id': `${url}#person`,
    name: p.name,
    jobTitle: p.role,
    url,
    ...(p.summary ? { description: p.summary } : {}),
    ...(p.image ? { image: `${site.url}${p.image}` } : {}),
    ...(p.phone ? { telephone: p.phone } : {}),
    ...(p.serviceTitle ? { knowsAbout: p.serviceTitle } : {}),
    worksFor: { '@id': BUSINESS_ID },
    ...(sameAs.length ? { sameAs } : {}),
  };
}

/**
 * A recurring class or event.
 *
 * These repeat weekly with no known series start, so the "when" is expressed as
 * an `eventSchedule` (`Schedule` with `byDay` + times) rather than a `startDate`.
 * Inventing a start date to satisfy Google's preferred shape would be publishing
 * a fact the client never gave us.
 */
export function eventNode(
  e: {
    id: string;
    title: string;
    summary: string;
    image?: string;
    price?: string;
    instructor?: string;
    location?: string;
    bookingUrl?: string;
    sessions: { day: string; start: string; end: string }[];
  },
  s: Settings,
) {
  const url = abs(`/event/${e.id}`);
  return {
    '@type': 'Event',
    '@id': `${url}#event`,
    name: e.title,
    description: e.summary,
    url,
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
    ...(e.image ? { image: `${site.url}${e.image}` } : {}),
    ...(e.sessions.length
      ? {
          eventSchedule: e.sessions.map((x) => ({
            '@type': 'Schedule',
            repeatFrequency: 'P1W',
            byDay: `https://schema.org/${x.day}`,
            startTime: x.start,
            endTime: x.end,
            scheduleTimezone: 'Australia/Sydney',
          })),
        }
      : {}),
    location: {
      '@type': 'Place',
      name: e.location ?? site.name,
      address: {
        '@type': 'PostalAddress',
        streetAddress: s.street,
        addressLocality: s.locality,
        addressRegion: s.region,
        postalCode: s.postcode,
        addressCountry: 'AU',
      },
    },
    organizer: { '@id': BUSINESS_ID },
    ...(e.instructor ? { performer: { '@type': 'Person', name: e.instructor } } : {}),
    ...(e.price
      ? {
          offers: {
            '@type': 'Offer',
            price: e.price.replace(/[^\d.]/g, '') || undefined,
            priceCurrency: 'AUD',
            availability: 'https://schema.org/InStock',
            url: e.bookingUrl ?? url,
          },
        }
      : {}),
  };
}

/** The services the studio offers, as an offer catalogue on the business. */
export function serviceCatalogueNode(
  services: { title: string; summary: string; providerName?: string; href: string }[],
) {
  return {
    '@type': 'OfferCatalog',
    '@id': `${site.url}/#services`,
    name: `Services at ${site.name}`,
    itemListElement: services.map((s, i) => ({
      '@type': 'Offer',
      position: i + 1,
      itemOffered: {
        '@type': 'Service',
        name: s.title,
        description: s.summary,
        url: abs(s.href),
        ...(s.providerName
          ? { provider: { '@type': 'Person', name: s.providerName } }
          : {}),
        areaServed: { '@type': 'Place', name: 'Tweed Coast, NSW' },
      },
    })),
  };
}

/** Breadcrumb trail. Pass the ancestors; the current page is appended. */
export function breadcrumbNode(trail: { name: string; path: string }[]) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((t, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: t.name,
      item: abs(t.path),
    })),
  };
}

/**
 * BlogPosting for a single post.
 *
 * `author` is a Person by name rather than a reference to the business: a post
 * is written by someone, and attributing it to the studio would lose the very
 * thing that makes a practitioner's article worth reading. When the author has
 * a profile here, their page is linked as the Person's url so the two records
 * are joinable.
 */
export function blogPostingNode(p: {
  title: string;
  description: string;
  path: string;
  author: string;
  authorPath?: string;
  published: Date;
  updated?: Date;
  image?: string;
}) {
  return {
    '@type': 'BlogPosting',
    '@id': `${abs(p.path)}#post`,
    headline: p.title,
    description: p.description,
    url: abs(p.path),
    mainEntityOfPage: abs(p.path),
    inLanguage: 'en-AU',
    datePublished: p.published.toISOString().slice(0, 10),
    ...(p.updated ? { dateModified: p.updated.toISOString().slice(0, 10) } : {}),
    ...(p.image ? { image: abs(p.image) } : {}),
    /**
     * A hub-wide piece is written by the studio, not a person — attributing it
     * to a Person named "Health Hub Tweed Coast" would invent one. Those point
     * at the business node instead, which already carries the NAP and socials.
     */
    author: p.authorPath
      ? { '@type': 'Person', name: p.author, url: abs(p.authorPath) }
      : p.author === site.name
        ? { '@id': BUSINESS_ID }
        : { '@type': 'Person', name: p.author },
    publisher: { '@id': BUSINESS_ID },
    isPartOf: { '@id': WEBSITE_ID },
  };
}

/**
 * FAQPage for /faq/.
 *
 * Only ever emitted on the FAQ page itself. Google's guidance is that FAQPage
 * belongs on a page whose main content *is* the question list, and stacking a
 * second one onto the homepage — which already carries the business and website
 * nodes — would make the same answers compete with themselves for attribution.
 *
 * Note this is not chasing a rich result: Google restricted FAQ rich snippets to
 * well-known health and government sites, so a local studio will not get the
 * expandable SERP treatment. The value is machine-readable Q&A for answer
 * engines. The page presents the same answers in native <details> accordions —
 * closed or open, they are in the served HTML, so this node and the page never
 * disagree about what the answer is.
 *
 * `isPartOf` ties the page to the site, and `about` to the business, so an
 * engine reading only this node still knows whose answers these are.
 */
export function faqPageNode(
  items: { q: string; a: string; id: string }[],
  path: string,
) {
  return {
    '@type': 'FAQPage',
    '@id': `${abs(path)}#faq`,
    url: abs(path),
    isPartOf: { '@id': WEBSITE_ID },
    about: { '@id': BUSINESS_ID },
    inLanguage: 'en-AU',
    mainEntity: items.map((it) => ({
      '@type': 'Question',
      '@id': `${abs(path)}#${it.id}`,
      name: it.q,
      acceptedAnswer: { '@type': 'Answer', text: it.a },
    })),
  };
}

/** A simple collection page listing pointer (practitioners / events index). */
export function itemListNode(
  name: string,
  items: { name: string; path: string }[],
) {
  return {
    '@type': 'ItemList',
    name,
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      url: abs(it.path),
    })),
  };
}
