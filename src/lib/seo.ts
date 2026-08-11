/**
 * Title and description helpers.
 *
 * The live WordPress site publishes no meta descriptions at all and titles that
 * are just the page name, so there was nothing to migrate — these are written
 * here. Two rules worth keeping:
 *
 *   - a title should say what the page is AND where the studio is, because
 *     almost every useful search for a local studio carries a place;
 *   - a description should never be cut mid-word, which is what happens if you
 *     let the search engine do the trimming.
 */
import { site } from '../data/site';

/** Google renders roughly this many characters of a title before truncating. */
const TITLE_MAX = 62;
/** And roughly this much of a description. */
const DESC_MAX = 158;

/** Trim to `max` on a word boundary, adding an ellipsis only if text was lost. */
export function clamp(text: string, max = DESC_MAX): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const at = cut.lastIndexOf(' ');
  return `${(at > max * 0.6 ? cut.slice(0, at) : cut).replace(/[,;:.—-]+$/, '')}…`;
}

/**
 * Page title plus the brand. Falls back to a shortened brand when the full one
 * would push the title past what Google shows — better a visible brand than one
 * that gets cut off mid-word.
 */
export function pageTitle(title?: string): string {
  if (!title) return `${site.name} · Wellness Studio, Hastings Point`;
  const full = `${title} · ${site.name}`;
  if (full.length <= TITLE_MAX) return full;
  const short = `${title} · Health Hub`;
  return short.length <= TITLE_MAX ? short : clamp(title, TITLE_MAX);
}
