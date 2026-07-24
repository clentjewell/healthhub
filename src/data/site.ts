/**
 * Single source of truth for site-wide constants.
 *
 * NAP (Name / Address / Phone) lives here ONLY. The header, footer,
 * contact page, and the LocalBusiness JSON-LD (Phase 5) all read from
 * this file so the address and hours can never drift out of sync.
 */

export const site = {
  name: 'Health Hub Tweed Coast',
  shortName: 'Health Hub',
  // Health Hub is the community / studio arm of the Pottsville Acupuncture brand.
  tagline: 'Tweed Coast',
  domain: 'healthhubtweedcoast.com.au',
  url: 'https://healthhubtweedcoast.com.au',
  description:
    'Health Hub Tweed Coast — a community wellness studio at Hastings Point. Acupuncture, allied health, movement classes and events on the Tweed Coast.',
} as const;

/** NAP — Name, Address, Phone. The canonical address block. */
export const nap = {
  legalName: 'Health Hub Tweed Coast',
  street: '87–89 Tweed Coast Road',
  locality: 'Hastings Point',
  region: 'NSW',
  postcode: '2489',
  country: 'Australia',
  countryCode: 'AU',
  // TODO(content): confirm public phone number from the live site (Phase 3).
  phone: '',
  // TODO(content): confirm public reception email (Phase 3).
  email: '',
  /** Google Maps place link — TODO(content): confirm exact place URL (Phase 3). */
  mapUrl: 'https://www.google.com/maps/search/?api=1&query=87-89+Tweed+Coast+Road+Hastings+Point+NSW+2489',
  /** Geo coordinates for JSON-LD — TODO(seo): confirm precise lat/lng (Phase 5). */
  geo: { lat: -28.359, lng: 153.578 },
} as const;

/** Opening hours — Mon–Sun 08:00–18:30. */
export const hours = {
  label: 'Monday – Sunday, 8:00am – 6:30pm',
  // Machine-readable form for schema.org OpeningHoursSpecification (Phase 5).
  spec: [
    {
      days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      opens: '08:00',
      closes: '18:30',
    },
  ],
} as const;

/** Social handles. */
export const social = {
  handle: '@healthhubtweedcoast',
  // TODO(content): confirm live social URLs (Phase 3).
  instagram: 'https://www.instagram.com/healthhubtweedcoast/',
  facebook: '',
} as const;

/** Primary navigation for the Health Hub site. */
export const nav = [
  { label: 'Home', href: '/' },
  { label: 'Services', href: '/services' },
  { label: 'Practitioners', href: '/practitioners' },
  { label: 'Classes & Events', href: '/classes-events' },
  { label: 'Contact', href: '/contact' },
] as const;

/** Primary booking call-to-action (Halaxy pathways live on /booking). */
export const bookingCta = { label: 'Make a Booking', href: '/booking' } as const;

export const fullAddress =
  `${nap.street}, ${nap.locality} ${nap.region} ${nap.postcode}`;
