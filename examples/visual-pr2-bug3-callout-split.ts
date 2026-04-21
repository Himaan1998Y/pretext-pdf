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

// Short body — 4 lines. Combined with the tight custom page height below,
// the split must happen RIGHT AT the title boundary. Under the pre-fix
// bug, availableForLines did not subtract titleHeight, so the paginator
// packed 3-4 content lines onto page 1 with no room for the title — the
// background rect clipped the title row. Post-fix, only 1-2 content lines
// fit on page 1 and the rest flows to page 2, keeping the title visible.
const longBody = Array.from({ length: 8 }, (_, i) =>
  `Line ${i + 1} of the callout body text — fills one line at the given width.`
).join(' ')

// Tight custom page matching the regression test geometry.
// pageContentHeight = paddingV(10) + titleH(~21) + lh(18) + paddingV(10) + 1 = 60pt
// ─ Pre-fix paginator computes availableForLines = 60 - 10 - 10 = 40pt
//   floor(40 / 18) = 2 content lines crammed onto page 1 → the
//   title's reserved 21pt is consumed by body lines; background rect
//   + content overdraw the title row.
// ─ Post-fix paginator computes availableForLines = 40 - 21 = 19pt
//   floor(19 / 18) = 1 content line. Title is safely reserved; the
//   second body line flows to page 2.
//
// Total page height = 60pt content + 20pt top margin + 20pt bottom margin = 100pt.
const pdf = await render({
  pageSize: [360, 100],
  margins: { top: 20, bottom: 20, left: 30, right: 30 },
  defaultFontSize: 11,
  content: [
    { type: 'callout', style: 'info', title: 'Callout Title — Must NOT Be Clipped', content: longBody },
    { type: 'paragraph', text: 'Trailing paragraph — should sit BELOW the callout background, not inside it.', fontSize: 10, color: '#555555', spaceBefore: 8 },
  ],
})

writeFileSync('test-output/pr2-bug3-callout-split.pdf', pdf)
console.log(`OK — wrote test-output/pr2-bug3-callout-split.pdf (${pdf.length} bytes)`)
