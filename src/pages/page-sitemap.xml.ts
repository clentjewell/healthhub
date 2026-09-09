import type { APIRoute } from 'astro';
import { abs, urlset } from '../lib/sitemap';

// The fixed pages of the site (listings + standalone pages).
export const GET: APIRoute = () =>
  urlset([
    { loc: abs('/') },
    { loc: abs('/our-practitioners/') },
    { loc: abs('/events/') },
    { loc: abs('/blog/') },
    { loc: abs('/make-a-booking/') },
    { loc: abs('/contact/') },
    { loc: abs('/faq/') },
  ]);
