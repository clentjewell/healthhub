import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * Content collections for Health Hub Tweed Coast.
 *
 * `events` holds the studio's classes/events — the same nine listings the live
 * site has, each with its own page. It's the self-serve data the CMS edits, and
 * the shape the Pottsville `/hub/` proposal teaser will read from (Prompt 2).
 * Schemas stay flat and enum-constrained so they're CMS-friendly.
 */

const CATEGORY_EVENT = ['workshop', 'seminar', 'sound-bath', 'course', 'community', 'other'] as const;

/**
 * CMS-safe optional URL.
 *
 * A git-based CMS writes cleared fields as an empty string (`bookingUrl: ""`),
 * which `z.string().url()` rejects — that would fail the build the first time
 * an editor blanks a booking link. Treat empty/whitespace as "not set".
 */
const optionalUrl = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
  z
    .string()
    .url()
    // `z.string().url()` accepts "https://example.com/ Some Title" — a shape the
    // WP migration produced by running two fields together. A URL with internal
    // whitespace is always a mistake, so fail the build instead of shipping it.
    .refine((v) => !/\s/.test(v.trim()), { message: 'URL must not contain spaces' })
    .optional(),
);

/** Same idea for plain optional text fields. */
const optionalText = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
  z.string().optional(),
);

/** Per-service pages (per-service preferred for SEO). */
const services = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/services' }),
  schema: z.object({
    title: z.string(),
    /** Short label used in nav/cards. Falls back to title. */
    shortTitle: z.string().optional(),
    summary: z.string(),
    order: z.number().default(99),
    icon: z.string().optional(),
    image: z.string().optional(),
    /** Practitioner (id) who offers this service — services are 1:1 with a provider. */
    provider: optionalText,
    /** Booking pathway for this service (varies per provider — not all Halaxy). */
    bookingUrl: optionalUrl,
    bookingPhone: optionalText,
    draft: z.boolean().default(false),
    placeholder: z.boolean().default(false),
  }),
});

/** Practitioner profiles (consistent template). */
const practitioners = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/practitioners' }),
  schema: z.object({
    name: z.string(),
    /** Professional title, e.g. "Acupuncturist". TODO: confirm per-person (Phase 3). */
    role: z.string().default('Practitioner'),
    order: z.number().default(99),
    image: z.string().optional(),
    /** Per-practitioner booking link (platform varies; empty = phone/contact only). */
    bookingUrl: optionalUrl,
    phone: optionalText,
    /** Service (id) this practitioner offers. */
    service: optionalText,
    modalities: z.array(z.string()).default([]),
    /** Social / external links shown in the profile hero. */
    facebook: optionalUrl,
    instagram: optionalUrl,
    website: optionalUrl,
    /**
     * Fees grouped by category (each group renders as a box). A group is
     * either a single priced service (title + price + note) or a category
     * with several options (title + items[]). Mirrors each practitioner's
     * own structure on the live site.
     */
    feeGroups: z
      .array(
        z.object({
          title: z.string(),
          /** e.g. "75 minutes" — shown under the name. */
          duration: optionalText,
          price: z.string().optional(),
          note: z.string().optional(),
          items: z
            .array(z.object({ label: z.string(), price: z.string().optional() }))
            .default([]),
        }),
      )
      .default([]),
    placeholder: z.boolean().default(false),
  }),
});

/**
 * Classes & events — the studio's offerings, mirroring the live site's nine
 * listings. These are RECURRING, so they are never hidden once a date passes:
 * `schedule` is the human-readable "when", and `date` is only an optional
 * "next session" hint. Ordering is manual via `order`.
 */
const events = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/events' }),
  schema: z.object({
    title: z.string(),
    order: z.number().default(99),
    /** Human-readable schedule, e.g. "Thursdays 11:00am – 12:00pm". */
    schedule: optionalText,
    /** Optional next-session date — displayed only, never used to hide an entry. */
    date: z.coerce.date().optional(),
    category: z.enum(CATEGORY_EVENT).default('other'),
    /** Who runs it, plus their own contact details. */
    instructor: optionalText,
    instructorPhone: optionalText,
    instructorEmail: optionalText,
    instructorWebsite: optionalUrl,
    location: optionalText,
    price: optionalText,
    bookingUrl: optionalUrl,
    image: optionalText,
    summary: z.string(),
    /**
     * Weekly slots, used to build the "Add to calendar" links (see
     * lib/calendar.ts). Left empty for by-appointment offerings and for the
     * timetable overview — no sessions means no calendar links, rather than a
     * guess at when something runs.
     */
    sessions: z
      .array(
        z.object({
          day: z.enum([
            'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
          ]),
          start: z.string().regex(/^\d{2}:\d{2}$/, 'Use 24-hour HH:MM, e.g. 18:00'),
          end: z.string().regex(/^\d{2}:\d{2}$/, 'Use 24-hour HH:MM, e.g. 19:15'),
          /**
           * Name this slot when one listing covers several distinct classes —
           * Hatha & Yin Yoga is really Yin Yang Yoga, Hatha and Yin on three
           * different days, and saying so is clearer than one lumped schedule.
           */
          label: optionalText,
        }),
      )
      .default([]),
    /** Renders the full weekly timetable table on this event's page. */
    showTimetable: z.boolean().default(false),
    featured: z.boolean().default(false),
    /** Show on the site. Turn off to hide without deleting. */
    active: z.boolean().default(true),
    placeholder: z.boolean().default(false),
  }),
});

/**
 * The weekly studio timetable — one entry, `weekly`, rendered as a table on the
 * timetable event page. Held as data rather than prose so it stays a real table
 * (and stays editable) instead of the flattened page-builder markup the
 * WordPress version produced.
 */
const timetable = defineCollection({
  loader: glob({ pattern: '**/*.yml', base: './src/content/timetable' }),
  schema: z.object({
    note: optionalText,
    days: z
      .array(
        z.object({
          day: z.string(),
          sessions: z
            .array(
              z.object({
                name: z.string(),
                /** Displayed as-is, e.g. "8:30am–7:30pm". */
                time: z.string(),
                /** Optional link to the event or practitioner page. */
                href: optionalText,
              }),
            )
            .default([]),
        }),
      )
      .default([]),
  }),
});

/**
 * Blog posts for /blog/.
 *
 * Posts carry their own meta and excerpt rather than deriving them from the
 * body: the excerpt is written to sell the click on the index, which is not the
 * same job as the first paragraph, and a truncated opening line makes a poor
 * meta description.
 */
const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    /** Full browser/tab title. Falls back to `title` plus the brand. */
    metaTitle: optionalText,
    metaDescription: z.string(),
    /** Shown on the index card and used for og:description. */
    excerpt: z.string(),
    /** Free text, e.g. "Yoga & Meditation". Grouping only — not a taxonomy. */
    category: optionalText,
    /**
     * Display name of the author. A plain string rather than a practitioner id:
     * posts may be written by people who do not have a profile on the site, and
     * a guest post should not fail the build for want of one.
     */
    author: z.string(),
    /** Practitioner id, when the author does have a profile to link to. */
    authorId: optionalText,
    publishDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    image: optionalText,
    imageAlt: optionalText,
    /** Reading time in minutes. Author's own estimate; not computed. */
    readingMinutes: z.number().optional(),
    /**
     * The forward half of the footer pair, opposite "Back to the Journal".
     * Per-post because the drafts each end somewhere different — a class piece
     * sends you to the timetable, an acupuncture piece to booking, a hub-wide
     * piece to the team. Omit both and only the back link renders.
     */
    ctaLabel: optionalText,
    ctaHref: optionalText,
    /** Drafts build in dev but never appear in production. */
    draft: z.boolean().default(false),
  }),
});

/**
 * FAQ entries for /faq/. One entry: `general`.
 *
 * A flat list, deliberately not grouped into categories — the questions are
 * written for the way people actually search ("yoga or pilates for beginners"),
 * and sub-headers would only add a layer between the query and the answer.
 *
 * Answers support a small set of `{{token}}` placeholders so facts that live in
 * Settings are never re-typed here. See the comment at the top of
 * src/content/faq/general.yml for the list; an unknown token fails the build
 * rather than shipping a literal "{{typo}}" to a visitor.
 */
const faq = defineCollection({
  loader: glob({ pattern: '**/*.yml', base: './src/content/faq' }),
  schema: z.object({
    items: z
      .array(
        z.object({
          q: z.string(),
          a: z.string(),
          /**
           * URL fragment for deep-linking a single answer, e.g. #booking.
           * Answer engines and support replies cite these, so they are authored
           * rather than generated from the question text, which would change
           * the anchor every time the wording is edited.
           */
          id: z.string(),
        }),
      )
      .default([]),
    /** Shown once under the list. Health-practice compliance, not an answer. */
    disclaimer: optionalText,
  }),
});

/**
 * Site-wide settings (header menu, footer text, NAP, hours, socials).
 * One entry: `general`. Edited in the CMS under Settings.
 */
const settings = defineCollection({
  loader: glob({ pattern: '**/*.yml', base: './src/content/settings' }),
  schema: z.object({
    brandName: z.string(),
    brandTagline: z.string(),

    street: z.string(),
    locality: z.string(),
    region: z.string(),
    postcode: z.string(),
    phone: optionalText,
    email: optionalText,
    mapUrl: z.string(),
    mapQuery: z.string(),
    /**
     * Exact coordinates of the studio, taken from its Google Maps listing.
     * These feed the LocalBusiness `geo` and pin the embedded map on the
     * building rather than letting Google guess from the street name.
     */
    lat: z.number().optional(),
    lng: z.number().optional(),

    hoursLabel: z.string(),
    hoursOpen: z.string().regex(/^\d{2}:\d{2}$/),
    hoursClose: z.string().regex(/^\d{2}:\d{2}$/),

    socialHandle: optionalText,
    instagram: optionalUrl,
    facebook: optionalUrl,

    navItems: z.array(z.object({ label: z.string(), href: z.string() })).default([]),
    bookingLabel: z.string().default('Make a Booking'),
    bookingHref: z.string().default('/make-a-booking'),

    footerBlurb: z.string(),
    footerNote: optionalText,

    contactFormEndpoint: optionalText,
  }),
});

/** Reusable bits of page copy. */
const section = z.object({
  eyebrow: optionalText,
  heading: z.string(),
  lede: optionalText,
  linkLabel: optionalText,
});

/**
 * Editable page copy — one YAML file per page, edited in the CMS under Pages.
 * Only text lives here; layout stays in the templates.
 */
const pages = defineCollection({
  loader: glob({ pattern: '**/*.yml', base: './src/content/pages' }),
  schema: z.object({
    metaTitle: z.string(),
    metaDescription: z.string(),

    // Simple pages (booking / contact / events / practitioners index)
    eyebrow: optionalText,
    heading: optionalText,
    lede: optionalText,

    // Booking
    extraNote: optionalText,

    // Contact
    formHeading: optionalText,
    submitLabel: optionalText,
    showMap: z.boolean().optional(),

    // Classes & Events
    emptyEventsText: optionalText,

    // Home
    hero: z
      .object({
        eyebrow: optionalText,
        heading: z.string(),
        lede: optionalText,
        primaryLabel: optionalText,
        primaryHref: optionalText,
        secondaryLabel: optionalText,
        secondaryHref: optionalText,
      })
      .optional(),
    welcome: z
      .object({
        eyebrow: optionalText,
        heading: z.string(),
        paragraphs: z.array(z.string()).default([]),
      })
      .optional(),
    /**
     * Whether the homepage Services grid shows. A toggle rather than a code
     * change. The SEO layer reads from the collections, not from this, so
     * structured data is unaffected either way.
     *
     * The homepage once also carried a Practitioners carousel, and briefly a
     * carousel variant of Services alongside the grid. Both were removed; the
     * team is reached through /our-practitioners, which is in the nav.
     */
    showServices: z.boolean().default(true),
    services: section.optional(),
    events: section.optional(),
    location: z
      .object({
        eyebrow: optionalText,
        heading: z.string(),
        directionsLabel: optionalText,
        contactLabel: optionalText,
      })
      .optional(),
    cta: z
      .object({
        heading: z.string(),
        leftHeading: z.string(),
        leftBody: optionalText,
        leftLabel: z.string(),
        leftHref: z.string(),
        rightHeading: z.string(),
        rightBody: optionalText,
        rightLabel: z.string(),
        rightHref: z.string(),
      })
      .optional(),
  }),
});

export const collections = { settings, pages, services, practitioners, events, timetable, faq, blog };
