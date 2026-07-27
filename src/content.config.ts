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

/** Per-service pages (per-service preferred for SEO). */
const services = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/services' }),
  schema: z.object({
    title: z.string(),
    /** Short label used in nav/cards. Falls back to title. */
    shortTitle: z.string().optional(),
    summary: z.string(),
    order: z.number().default(99),
    /** Emoji or short glyph placeholder until real iconography (Phase 3). */
    icon: z.string().optional(),
    image: z.string().optional(),
    /** Optional practitioner ids offering this service. */
    practitioners: z.array(z.string()).default([]),
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
    /** Per-practitioner Halaxy booking link. TODO where not found (Phase 3). */
    bookingUrl: z.string().url().optional(),
    modalities: z.array(z.string()).default([]),
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
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    instructor: z.string().optional(),
    category: z.enum(CATEGORY_CLASS).default('other'),
    level: z.string().optional(),
    bookingUrl: z.string().url().optional(),
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
    instructor: z.string().optional(),
    location: z.string().optional(),
    price: z.string().optional(),
    bookingUrl: z.string().url().optional(),
    image: z.string().optional(),
    summary: z.string(),
    featured: z.boolean().default(false),
    placeholder: z.boolean().default(false),
  }),
});

export const collections = { services, practitioners, classes, events };
