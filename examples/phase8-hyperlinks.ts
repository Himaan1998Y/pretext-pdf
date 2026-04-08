/**
 * Phase 8G — Hyperlinks Example
 * Demonstrates external links, email links, and internal cross-references
 */
import { render } from '../dist/index.js'
import { writeFileSync, mkdirSync } from 'fs'

mkdirSync('output', { recursive: true })

const pdf = await render({
  pageSize: 'A4',
  margins: { top: 60, bottom: 60, left: 60, right: 60 },
  metadata: { title: 'pretext-pdf Hyperlinks Demo' },
  bookmarks: true,
  content: [
    {
      type: 'heading',
      level: 1,
      text: 'Hyperlinks Demo',
      anchor: 'top',
    },
    {
      type: 'paragraph',
      text: 'pretext-pdf supports external links, email links, and internal cross-references.',
    },
    {
      type: 'heading',
      level: 2,
      text: 'External Links',
      anchor: 'external',
      url: 'https://github.com/Himaan1998Y/pretext-pdf',
    },
    {
      type: 'paragraph',
      text: 'Click the heading above to visit the GitHub repo.',
    },
    {
      type: 'paragraph',
      text: 'This entire paragraph is also a clickable link.',
      url: 'https://www.npmjs.com/package/pretext-pdf',
    },
    {
      type: 'heading',
      level: 2,
      text: 'Rich Text Links',
      anchor: 'rich-links',
    },
    {
      type: 'rich-paragraph',
      fontSize: 12,
      spans: [
        { text: 'You can also embed links inline: visit ' },
        { text: 'pretext on GitHub', href: 'https://github.com/chenglou/pretext', color: '#0070f3', underline: true },
        { text: ' or send an email to ' },
        { text: 'himanshu@antigravity.dev', href: 'mailto:himanshu@antigravity.dev', color: '#0070f3', underline: true },
        { text: '.' },
      ],
    },
    {
      type: 'heading',
      level: 2,
      text: 'Internal Cross-References',
      anchor: 'internal',
    },
    {
      type: 'rich-paragraph',
      fontSize: 12,
      spans: [
        { text: 'Jump to ' },
        { text: 'External Links section', href: '#external', color: '#0070f3', underline: true },
        { text: ' or back to ' },
        { text: 'top of document', href: '#top', color: '#0070f3', underline: true },
        { text: '.' },
      ],
    },
    {
      type: 'heading',
      level: 2,
      text: 'Email Links',
    },
    {
      type: 'paragraph',
      text: 'Contact us at support@example.com',
      url: 'mailto:support@example.com',
    },
  ],
})

writeFileSync('output/phase8-hyperlinks.pdf', pdf)
console.log('Written: output/phase8-hyperlinks.pdf')
