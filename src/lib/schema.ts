/**
 * Schema.org JSON-LD builders.
 *
 * Everything is emitted as a single `@graph` per page so nodes can reference
 * each other by `@id` instead of repeating the business details on every page.
 * All facts come from the content collections — the address, hours and socials
 * are only ever edited in Settings, and this reads from there.
 *
 * Deliberately absent: `geo` coordinates. Geocoding the street address only
 * resolved to the road centreline, and a wrong pin is worse than none — Google
 * geocodes from `address` and `hasMap` anyway. Add `geo` here once the exact
 * coordinates are taken from the Google Business Profile.
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
