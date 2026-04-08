/**
 * Phase 8H — Inline Formatting Example
 * Demonstrates superscript, subscript, letter-spacing, and small-caps
 */
import { render } from '../dist/index.js'
import { writeFileSync, mkdirSync } from 'fs'

mkdirSync('output', { recursive: true })

const pdf = await render({
  pageSize: 'A4',
  margins: { top: 60, bottom: 60, left: 60, right: 60 },
  metadata: { title: 'pretext-pdf Inline Formatting Demo' },
  content: [
    {
      type: 'heading',
      level: 1,
      text: 'Inline Formatting',
    },
    // Superscript
    {
      type: 'heading',
      level: 2,
      text: 'Superscript',
    },
    {
      type: 'rich-paragraph',
      fontSize: 14,
      spans: [
        { text: 'E = mc' },
        { text: '2', verticalAlign: 'superscript', color: '#0070f3' },
        { text: '   (Einstein\'s mass-energy equivalence)' },
      ],
    },
    {
      type: 'rich-paragraph',
      fontSize: 14,
      spans: [
        { text: 'Area = pi*r' },
        { text: '2', verticalAlign: 'superscript', color: '#0070f3' },
        { text: '   (circle area formula)' },
      ],
    },
    {
      type: 'rich-paragraph',
      fontSize: 14,
      spans: [
        { text: '(a + b)' },
        { text: 'n', verticalAlign: 'superscript', color: '#0070f3' },
        { text: ' = Sum ' },
        { text: 'n', verticalAlign: 'superscript', color: '#666666', fontSize: 11 },
        { text: 'C' },
        { text: 'k', verticalAlign: 'subscript', color: '#666666', fontSize: 11 },
        { text: ' a' },
        { text: 'n-k', verticalAlign: 'superscript', color: '#0070f3' },
        { text: 'b' },
        { text: 'k', verticalAlign: 'superscript', color: '#0070f3' },
      ],
    },
    // Subscript
    {
      type: 'heading',
      level: 2,
      text: 'Subscript',
    },
    {
      type: 'rich-paragraph',
      fontSize: 14,
      spans: [
        { text: 'H' },
        { text: '2', verticalAlign: 'subscript', color: '#e63946' },
        { text: 'O   (water)' },
      ],
    },
    {
      type: 'rich-paragraph',
      fontSize: 14,
      spans: [
        { text: 'CO' },
        { text: '2', verticalAlign: 'subscript', color: '#e63946' },
        { text: '   (carbon dioxide)' },
      ],
    },
    {
      type: 'rich-paragraph',
      fontSize: 14,
      spans: [
        { text: 'C' },
        { text: '6', verticalAlign: 'subscript', color: '#e63946' },
        { text: 'H' },
        { text: '12', verticalAlign: 'subscript', color: '#e63946' },
        { text: 'O' },
        { text: '6', verticalAlign: 'subscript', color: '#e63946' },
        { text: '   (glucose)' },
      ],
    },
    // Letter Spacing
    {
      type: 'heading',
      level: 2,
      text: 'Letter Spacing',
    },
    {
      type: 'paragraph',
      text: 'Normal text — no letter spacing applied.',
      fontSize: 13,
    },
    {
      type: 'paragraph',
      text: 'Slight tracking — letterSpacing: 0.5',
      fontSize: 13,
      letterSpacing: 0.5,
    },
    {
      type: 'paragraph',
      text: 'DISPLAY TITLE — letterSpacing: 2',
      fontSize: 13,
      letterSpacing: 2,
    },
    {
      type: 'paragraph',
      text: 'WIDE SPACED — letterSpacing: 4',
      fontSize: 13,
      letterSpacing: 4,
    },
    // Small Caps
    {
      type: 'heading',
      level: 2,
      text: 'Small Caps',
    },
    {
      type: 'heading',
      level: 3,
      text: 'This Heading Uses Small Caps for Elegance',
      smallCaps: true,
    },
    {
      type: 'paragraph',
      text: 'Small caps are great for section labels, brand names, and formal headings.',
    },
    {
      type: 'paragraph',
      text: 'Antigravity Technologies — Small Caps Style',
      fontSize: 14,
      smallCaps: true,
      letterSpacing: 1,
    },
    // Combined
    {
      type: 'heading',
      level: 2,
      text: 'Combined: Scientific Paper',
    },
    {
      type: 'paragraph',
      text: 'ABSTRACT',
      fontSize: 11,
      smallCaps: true,
      letterSpacing: 1.5,
      color: '#333333',
    },
    {
      type: 'rich-paragraph',
      fontSize: 11,
      spans: [
        { text: 'We present a new algorithm with O(n' },
        { text: '2', verticalAlign: 'superscript' },
        { text: ') time complexity. Water (H' },
        { text: '2', verticalAlign: 'subscript' },
        { text: 'O) solubility at 25 degrees C reaches 3.2x10' },
        { text: '-4', verticalAlign: 'superscript' },
        { text: ' mol/L. See Equation 1' },
        { text: 'a', verticalAlign: 'superscript', fontSize: 9, color: '#666666' },
        { text: ' for derivation.' },
      ],
    },
  ],
})

writeFileSync('output/phase8-inline.pdf', pdf)
console.log('Written: output/phase8-inline.pdf')
