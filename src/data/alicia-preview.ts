/**
 * Shared data for the two Alicia Grace layout previews under /preview/.
 * TEMPORARY — built so the client can compare where her class times & fees
 * should live (a combined class page vs. directly on her profile). Delete this
 * file and the two /preview/alicia-* pages once the client has decided.
 *
 * Times & fees are from the client's website-review document.
 */
export interface FeeItem { label: string; price?: string }
export interface FeeGroup {
  title: string;
  duration?: string;
  price?: string;
  note?: string;
  items?: FeeItem[];
}

export const aliciaName = 'Alicia Grace';
export const aliciaRole = 'Trauma-Informed Yoga Teacher';
export const aliciaImage = '/images/practitioners/alicia-grace.webp';
export const aliciaBookingUrl = 'https://www.omneyoga.com/appointments';
export const aliciaPhone = '0406 987 909';

/** Short intro used on the combined class page. */
export const aliciaIntro =
  'Inclusive, empowering classes that blend traditional yoga with evidence-based, ' +
  'trauma-informed practice — from gentle Seniors Yoga to evening Yin, plus 1:1 ' +
  'private sessions in-person and online.';

/** The three class styles, for the description block. */
export const aliciaClasses: { name: string; body: string }[] = [
  {
    name: 'Seniors Yoga',
    body:
      'A gentle class of mindful movement and meditation with the support of chairs ' +
      'and yoga props. Suitable for seniors and anyone seeking a practice tailored to ' +
      'injuries or reduced mobility.',
  },
  {
    name: 'Yoga & Meditation',
    body:
      'A general class structured like a traditional yoga class — an opening mindfulness ' +
      'practice, movement to warm and cool the body, and a closing breathing practice or ' +
      'meditation. Drawn from Hatha, Ashtanga and Yin lineages to balance strength and ease.',
  },
  {
    name: 'Yin Yoga',
    body:
      'A slow-paced, floor-based evening practice based on Traditional Chinese Medicine ' +
      'principles. Poses are held for longer with the support of props, making space to ' +
      'rest, release and wind down at the end of the day.',
  },
];

/** Full times & fees, shown in the FeesBox on both previews. */
export const aliciaFeeGroups: FeeGroup[] = [
  {
    title: 'Yoga & Meditation',
    duration: 'Tue 6:00–7:15pm · Fri 9:30–10:45am · Sun 8:00–9:15am (75 min)',
    items: [
      { label: 'Casual class', price: '$24' },
      { label: '5-class pass', price: '$110' },
      { label: '10-class pass', price: '$200' },
    ],
  },
  {
    title: 'Yin Yoga',
    duration: 'Wed 6:00–7:15pm (75 min)',
    items: [
      { label: 'Casual class', price: '$24' },
      { label: '5-class pass', price: '$110' },
      { label: '10-class pass', price: '$200' },
    ],
  },
  {
    title: 'Seniors Yoga',
    duration: 'Tue & Thu 9:30–10:30am (60 min)',
    items: [
      { label: 'Casual class', price: '$18' },
      { label: '5-class pass', price: '$85' },
      { label: '10-class pass', price: '$160' },
    ],
  },
  {
    title: '1:1 Private Yoga (in-person & online)',
    items: [
      { label: 'Initial session (90 min)', price: '$120' },
      { label: 'Follow-up session (60 min)', price: '$90' },
      { label: 'Start-up package (1 initial + 2 follow-ups)', price: '$275' },
      { label: '5 pack (5 follow-ups)', price: '$400' },
    ],
  },
];
