/**
 * Example: Phase 7G — PDF Encryption
 * Demonstrates password protection and permission restrictions.
 * Requires: npm install @cantoo/pdf-lib (optional peer dependency)
 * Run: npm run example:encryption
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const { render } = await import('../dist/index.js')

try {
  const pdf = await render({
    pageSize: 'A4',
    margins: { top: 40, bottom: 40, left: 40, right: 40 },
    defaultFont: 'Inter',
    defaultFontSize: 12,
    encryption: {
      userPassword: 'reader123',
      ownerPassword: 'admin456',
      permissions: {
        printing: false,
        modifying: false,
        copying: false,
        annotating: true,
      },
    },
    content: [
      {
        type: 'heading',
        level: 1,
        text: 'Encrypted PDF Example',
        spaceAfter: 12,
      },
      {
        type: 'paragraph',
        text: 'This document is encrypted and password-protected.',
        spaceAfter: 12,
      },
      {
        type: 'heading',
        level: 2,
        text: 'Encryption Details',
        spaceAfter: 8,
      },
      {
        type: 'list',
        style: 'unordered',
        items: [
          { text: 'userPassword: "reader123" — Required to open the PDF' },
          { text: 'ownerPassword: "admin456" — Required to modify permissions' },
          { text: 'Printing: Disabled' },
          { text: 'Copying text: Disabled' },
          { text: 'Modifying: Disabled' },
          { text: 'Annotating: Enabled' },
        ],
        spaceAfter: 12,
      },
      {
        type: 'heading',
        level: 2,
        text: 'Security Configuration',
        spaceAfter: 8,
      },
      {
        type: 'paragraph',
        text: 'Encryption configuration includes userPassword (prompted when opening), ownerPassword (required to change permissions), and granular permissions for printing, modifying, copying, and annotating.',
        spaceAfter: 12,
      },
      {
        type: 'heading',
        level: 2,
        text: 'Use Cases',
        spaceAfter: 8,
      },
      {
        type: 'list',
        style: 'unordered',
        items: [
          { text: 'Confidential documents with restricted access' },
          { text: 'Contracts that cannot be modified' },
          { text: 'Reports that cannot be printed or copied' },
          { text: 'Surveys with read-only content but annotatable forms' },
        ],
        spaceAfter: 16,
      },
      {
        type: 'paragraph',
        text: 'Requires @cantoo/pdf-lib as a peer dependency. If not installed, encryption throws ENCRYPTION_NOT_AVAILABLE error.',
      },
    ],
  })

  const outPath = path.join(__dirname, '..', 'output', 'phase7-encryption.pdf')
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, pdf)

  console.log(`✓ Phase 7G Encryption example: ${outPath}`)
  console.log(`   Size: ${(pdf.byteLength / 1024).toFixed(1)} KB`)
  console.log('   Open with password: reader123')
  console.log('   Note: Printing, copying, and modifying are disabled')
} catch (err: any) {
  if (err.code === 'ENCRYPTION_NOT_AVAILABLE') {
    console.error(
      '✗ Encryption not available. Install @cantoo/pdf-lib:',
      err.message
    )
    process.exit(1)
  }
  throw err
}
