/**
 * PR #2 visual verification — Bug 3 (titled callout background clips title on page split).
 *
 * Pre-fix: `splitBlock` did not subtract `calloutData.titleHeight` from
 * `availableForLines`, so on the first chunk of a titled callout that
 * spanned a page break, extra content lines were packed into the space
 * reserved for the title row. The background rectangle then clipped
 * the title text (title row was partly overdrawn by content).
 *
 * This example produces a titled callout whose content is long enough
 * to force a split across two pages when placed after preceding content.
 * In the rendered PDF:
 *   - Page 1: the callout starts, the title row is fully visible inside
 *     the tinted background, and the first body line sits below the title.
 *   - Page 2: the continuation chunk starts at the top, no title, and
 *     the rest of the body is visible.
 *
 * If Bug 3 regressed, the title text on page 1 would be partially
 * overdrawn by body content, or the background rect would truncate
 * the title row.
 */
import { render } from '../dist/index.js'
import { writeFileSync, mkdirSync } from 'fs'

mkdirSync('test-output', { recursive: true })

// Build body text long enough to force a split. Each sentence adds ~1 line
// at 480pt content width with 11pt font; ~25 sentences → ~25 lines, which
// is taller than any reasonable remaining-space-on-page so the callout
// MUST split across the page boundary.
const longBody = Array.from({ length: 25 }, (_, i) =>
  `Line ${i + 1} of the callout body. This sentence adds one line at the default font size and content width so the callout becomes tall enough to force a page split regardless of where on page 1 it begins.`
).join(' ')

const pdf = await render({
  pageSize: 'A4',
  margins: { top: 60, bottom: 60, left: 60, right: 60 },
  defaultFontSize: 11,
  content: [
    { type: 'heading', level: 1, text: 'PR #2 · Bug 3 Visual Verification', fontSize: 18, color: '#1a1a2e', spaceAfter: 6 },
    { type: 'paragraph', text: 'A titled callout below is long enough to split across two pages. The title row on page 1 must be fully visible inside the tinted background, with content beginning on the line BELOW the title (not overlapping it).', color: '#555555', fontSize: 10, spaceAfter: 14 },

    // Filler tuned so the callout starts around the middle of page 1; because
    // the callout body alone is taller than any remaining page height, it must
    // split across the page break.
    ...Array.from({ length: 12 }, (_, i) => ({
      type: 'paragraph' as const,
      text: `Filler paragraph ${i + 1}: this line consumes vertical space so the callout below starts partway down page 1 and then overflows onto page 2.`,
      fontSize: 10,
      color: '#555555',
      spaceAfter: 4,
    })),

    { type: 'callout', style: 'info', title: 'Callout Title — Must NOT Be Clipped', content: longBody },

    { type: 'paragraph', text: 'Post-callout trailing paragraph — confirms y-tracking on page 2 is correct so any following content sits below the continuation chunk (not inside it).', fontSize: 10, color: '#555555', spaceBefore: 10 },
  ],
})

writeFileSync('test-output/pr2-bug3-callout-split.pdf', pdf)
console.log(`OK — wrote test-output/pr2-bug3-callout-split.pdf (${pdf.length} bytes)`)
