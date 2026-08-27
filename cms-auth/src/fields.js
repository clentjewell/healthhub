/**
 * Friendly field metadata — turns raw frontmatter keys into plain-English,
 * grouped, hinted form fields (the thing that makes the Pottsville editor feel
 * approachable). Anything not listed here falls back to a humanised label with
 * no hint, so new fields still appear; they just look less polished until added.
 */

export const FIELD_META = {
  blog: {
    groups: [
      { title: 'The article', fields: ['title', 'excerpt', 'category', 'author'] },
      { title: 'Main image', fields: ['image', 'imageAlt'] },
      { title: 'Button at the end of the post', fields: ['ctaLabel', 'ctaHref'] },
      { title: 'Search & social (SEO)', fields: ['metaTitle', 'metaDescription'] },
      { title: 'Settings', fields: ['order', 'publishDate', 'readingMinutes', 'authorId', 'updatedDate', 'draft'] },
    ],
    labels: {
      title: 'Headline', excerpt: 'Short summary', category: 'Category', author: 'Author name',
      image: 'Main image', imageAlt: 'Image description (alt text)',
      ctaLabel: 'Button text', ctaHref: 'Button link',
      metaTitle: 'Browser-tab title', metaDescription: 'Google description',
      order: 'Order on the blog page', publishDate: 'Publish date', readingMinutes: 'Reading time (minutes)',
      authorId: 'Author profile (slug)', updatedDate: 'Updated date', draft: 'Keep hidden (draft)',
    },
    hints: {
      excerpt: 'One or two sentences shown on the blog list — write it to earn the click.',
      imageAlt: 'Describe the image for screen readers and SEO.',
      metaDescription: 'About 150 characters. Shows under the title in Google results.',
      order: 'Lower numbers appear first.',
      draft: 'Tick to keep this out of the live site.',
      authorId: 'The practitioner’s page slug, e.g. kate-doedee. Leave blank for guest writers.',
    },
  },

  practitioners: {
    groups: [
      { title: 'Who they are', fields: ['name', 'role'] },
      { title: 'Photo', fields: ['image'] },
      { title: 'Booking & contact', fields: ['bookingUrl', 'phone', 'service'] },
      { title: 'Links', fields: ['facebook', 'instagram', 'website'] },
      { title: 'Fees', fields: ['feeGroups'] },
      { title: 'Settings', fields: ['order'] },
    ],
    labels: {
      name: 'Full name', role: 'Role / title', image: 'Photo', bookingUrl: 'Online booking link',
      phone: 'Phone', service: 'Service (slug)', order: 'Order on the practitioners page',
      feeGroups: 'Fees & class passes',
    },
    hints: {
      role: 'e.g. Hatha & Yin Yoga Teacher.',
      service: 'The matching service slug, e.g. hatha-yin-yoga.',
      order: 'Lower numbers appear first.',
      feeGroups: 'Advanced: a list of fee tables. Keep the layout/indentation.',
    },
  },

  events: {
    groups: [
      { title: 'The class / event', fields: ['title', 'summary', 'schedule', 'category'] },
      { title: 'Image', fields: ['image'] },
      { title: 'Who runs it & cost', fields: ['instructor', 'instructorPhone', 'price', 'bookingUrl', 'location'] },
      { title: 'When it runs', fields: ['sessions'] },
      { title: 'Settings', fields: ['order', 'active', 'showTimetable'] },
    ],
    labels: {
      title: 'Name', summary: 'Short summary', schedule: 'When (short text)', category: 'Category',
      image: 'Image', instructor: 'Runs it', instructorPhone: 'Their phone', price: 'Price',
      bookingUrl: 'Booking link', location: 'Location', sessions: 'Session times',
      order: 'Order in the list', active: 'Show on the site', showTimetable: 'Show the weekly timetable on this page',
    },
    hints: {
      schedule: 'e.g. “Monday mornings — 75 minutes”.',
      sessions: 'Advanced: the recurring days and times. Keep the layout/indentation.',
      active: 'Untick to hide this event without deleting it.',
    },
  },

  services: {
    groups: [
      { title: 'Service', fields: ['title', 'shortTitle', 'summary'] },
      { title: 'Image & icon', fields: ['image', 'icon'] },
      { title: 'Settings', fields: ['order', 'practitioner'] },
    ],
    labels: { title: 'Name', shortTitle: 'Short name', summary: 'Summary', image: 'Image', icon: 'Icon', order: 'Order', practitioner: 'Practitioner (slug)' },
    hints: { shortTitle: 'Used in menus/cards; falls back to the name.', order: 'Lower numbers appear first.' },
  },

  pages: {
    // Pages vary; use generic grouping with SEO split out.
    groups: [
      { title: 'On the page', fields: ['eyebrow', 'heading', 'lede'] },
      { title: 'Search & social (SEO)', fields: ['metaTitle', 'metaDescription'] },
    ],
    labels: {
      eyebrow: 'Small label above the heading', heading: 'Main heading', lede: 'Intro paragraph',
      metaTitle: 'Browser-tab title', metaDescription: 'Google description',
    },
    hints: {
      metaDescription: 'About 150 characters. Shows under the title in Google results.',
    },
  },
};

/** Ordered [key, groupTitle] for a collection's data, honouring the config and
 *  appending any leftover keys under "More". */
export function groupedKeys(collection, data) {
  const meta = FIELD_META[collection];
  const keys = Object.keys(data);
  if (!meta) return [{ title: null, keys }];
  const used = new Set();
  const groups = meta.groups.map((g) => {
    const gk = g.fields.filter((f) => keys.includes(f));
    gk.forEach((k) => used.add(k));
    return { title: g.title, keys: gk };
  }).filter((g) => g.keys.length);
  const leftover = keys.filter((k) => !used.has(k));
  if (leftover.length) groups.push({ title: 'More', keys: leftover });
  return groups;
}

export function labelFor(collection, key, fallback) {
  return (FIELD_META[collection]?.labels?.[key]) || fallback;
}
export function hintFor(collection, key) {
  return FIELD_META[collection]?.hints?.[key] || '';
}

/** Live-site URL for a content file, for the preview pane and "View live". */
export function previewPath(collection, filename) {
  const slug = filename.replace(/\.(md|yml)$/, '');
  switch (collection) {
    case 'blog': return `/blog/${slug}/`;
    case 'practitioners': return `/our-practitioner/${slug}/`;
    case 'events': return `/event/${slug}/`;
    case 'services': return `/`;
    case 'faq': return `/faq/`;
    case 'timetable': return `/event/health-hub-studio-time-table/`;
    case 'pages': return PAGE_URLS[slug] || `/`;
    default: return `/`;
  }
}
const PAGE_URLS = {
  home: '/', blog: '/blog/', contact: '/contact/', faq: '/faq/',
  'our-practitioners': '/our-practitioners/', events: '/events/', booking: '/make-a-booking/',
};
