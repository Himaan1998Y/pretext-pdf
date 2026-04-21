/**
 * PR #2 visual verification — Bug 1 (rich-text leading-space after hard break).
 *
 * Pre-fix: an `isLeadingSpace` guard dropped the first token of any
 * continuation span that began with whitespace AFTER a `\n` hard break.
 * A span like `'  ·  Antigravity Systems'` rendered with the leading
 * `'  '` silently dropped, producing `·Antigravity Systems` at x=0
 * instead of the intended indented `  ·  Antigravity Systems`.
 *
 * This example builds a document where every rich-paragraph uses `\n`
 * hard breaks followed by leading-space continuation spans. In the
 * rendered PDF the `·` separators must appear with consistent indentation
 * and NOT flush against the left margin of the continuation lines.
 */
import { render } from '../dist/index.js'
import { writeFileSync, mkdirSync } from 'fs'

mkdirSync('test-output', { recursive: true })

const pdf = await render({
  pageSize: 'A4',
  margins: { top: 48, bottom: 48, left: 60, right: 60 },
  defaultFontSize: 11,
  content: [
    { type: 'heading', level: 1, text: 'PR #2 · Bug 1 Visual Verification', fontSize: 18, color: '#1a1a2e', spaceAfter: 6 },
    { type: 'paragraph', text: 'Every rich-paragraph below contains a \\n hard break followed by a leading-space continuation span. Before the fix, the leading spaces were dropped and the dot separator appeared flush against the left margin. After the fix, every dot must appear at a consistent indent.', color: '#555555', fontSize: 10, spaceAfter: 14 },

    { type: 'heading', level: 3, text: 'CASE 1 — Two-line contact block', fontSize: 9, color: '#888888', smallCaps: true, letterSpacing: 2, spaceAfter: 4 },
    { type: 'rich-paragraph', fontSize: 11, spans: [
      { text: 'himanshu@antigravity.dev', color: '#0070f3' },
      { text: '  ·  +91 98765 43210', color: '#555555' },
      { text: '\n  ·  github.com/Himaan1998Y', color: '#555555' },
      { text: '  ·  linkedin.com/in/himanshu-jain', color: '#555555' },
    ], spaceAfter: 14 },

    { type: 'heading', level: 3, text: 'CASE 2 — Role + employer on wrapped second line', fontSize: 9, color: '#888888', smallCaps: true, letterSpacing: 2, spaceAfter: 4 },
    { type: 'rich-paragraph', fontSize: 12, spans: [
      { text: 'Founder & CEO', fontWeight: 700 },
      { text: '\n  ·  Antigravity Systems Pvt. Ltd.', color: '#333333' },
      { text: '  ·  2022 – Present', color: '#888888' },
    ], spaceAfter: 10 },
    { type: 'rich-paragraph', fontSize: 12, spans: [
      { text: 'Co-Founder', fontWeight: 700 },
      { text: '\n  ·  KS Lodhi Realty & Buildwell', color: '#333333' },
      { text: '  ·  2020 – Present', color: '#888888' },
    ], spaceAfter: 14 },

    { type: 'heading', level: 3, text: 'CASE 3 — Multi-line bulleted summary', fontSize: 9, color: '#888888', smallCaps: true, letterSpacing: 2, spaceAfter: 4 },
    { type: 'rich-paragraph', fontSize: 11, spans: [
      { text: 'Skills', fontWeight: 700 },
      { text: '\n  ·  TypeScript · Rust · Python', color: '#333333' },
      { text: '\n  ·  PDF engineering · Typography · Layout', color: '#333333' },
      { text: '\n  ·  Multi-agent orchestration · LLM fine-tuning', color: '#333333' },
    ], spaceAfter: 14 },

    { type: 'callout', style: 'tip', title: 'What to look for', content: 'Every dot on a continuation line must have roughly 2-char whitespace on its left. Pre-fix: dot would sit flush against the left margin of the line. Post-fix: consistent indentation.' },
  ],
})

writeFileSync('test-output/pr2-bug1-separator.pdf', pdf)
console.log(`OK — wrote test-output/pr2-bug1-separator.pdf (${pdf.length} bytes)`)
