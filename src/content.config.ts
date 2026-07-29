import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * Content collections for Health Hub Tweed Coast.
 *
 * `classes` (weekly timetable) and `events` (dated) are the self-serve
 * data that Phase 4's git-based CMS will edit, and the SAME shape the
 * Pottsville `/hub/` proposal teaser reads from (Prompt 2). Keep their
 * schemas stable and CMS-friendly (flat, enum-constrained).
 *
 * Every collection carries a `placeholder` flag so Phase-2 seed data is
 * never mistaken for real content — pages badge it and it's easy to purge
 * in Phase 3.
 */

const CATEGORY_CLASS = ['yoga', 'pilates', 'sound', 'movement', 'meditation', 'other'] as const;
const CATEGORY_EVENT = ['workshop', 'seminar', 'sound-bath', 'course', 'community', 'other'] as const;
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

/**
 * CMS-safe optional URL.
 *
 * A git-based CMS writes cleared fields as an empty string (`bookingUrl: ""`),
 * which `z.string().url()` rejects — that would fail the build the first time
 * an editor blanks a booking link. Treat empty/whitespace as "not set".
 */
const optionalUrl = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
  z.string().url().optional(),
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

/** Weekly timetable — recurring class sessions. */
const classes = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/classes' }),
  schema: z.object({
    title: z.string(),
    day: z.enum(DAYS),
    /** 24h "HH:MM". */
    startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Use 24-hour HH:MM, e.g. 09:00'),
    endTime: z.preprocess(
      (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
      z.string().regex(/^\d{2}:\d{2}$/, 'Use 24-hour HH:MM, e.g. 10:15').optional(),
    ),
    instructor: optionalText,
    category: z.enum(CATEGORY_CLASS).default('other'),
    level: optionalText,
    bookingUrl: optionalUrl,
    active: z.boolean().default(true),
    placeholder: z.boolean().default(false),
  }),
});

/** Upcoming events — one-off dated happenings (seminars, sound baths, courses). */
const events = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/events' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    endDate: z.coerce.date().optional(),
    category: z.enum(CATEGORY_EVENT).default('other'),
    instructor: optionalText,
    location: optionalText,
    price: optionalText,
    bookingUrl: optionalUrl,
    image: optionalText,
    summary: z.string(),
    featured: z.boolean().default(false),
    placeholder: z.boolean().default(false),
  }),
});

export const collections = { services, practitioners, classes, events };
