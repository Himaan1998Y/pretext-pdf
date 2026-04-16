/**
 * Template: Non-Disclosure Agreement (NDA)
 *
 * Legally binding confidentiality agreement with:
 * - 7 standard legal clauses (Definitions, Confidential Information, Obligations, Exclusions, Term, Remedies, Governing Law)
 * - Two-party signature blocks with witness/notary section
 * - Security: Encryption enabled (allowCopying: false) to prevent unauthorized distribution
 * - DRAFT watermark for circulation management
 * - Bookmarks for easy navigation between clauses
 * - Proper metadata for legal document management
 *
 * Usage: npx tsx templates/nda.ts
 *
 * Extended Example: For bilateral agreements (mutual NDA), both party roles are shown.
 * For unilateral agreements, remove the second party block. Witness section is optional—
 * remove if not required by jurisdiction.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createMetadata, createFooter, colors, typography } from './utils.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const { render } = await import('../dist/index.js')

const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

// TODO: Customize party names, effective date, governing law, contact details below

const pdf = await render({
  pageSize: 'A4',
  margins: { top: 50, bottom: 60, left: 64, right: 64 },
  defaultFontSize: 11,
  // Security: Prevent copying to protect confidential agreement terms
  allowCopying: false,
  // Watermark for document lifecycle management
  watermark: { text: 'DRAFT', opacity: 0.08, rotation: -45, fontSize: 84 },
  // Searchable PDF with proper legal document metadata
  metadata: createMetadata(
    'Non-Disclosure Agreement',
    'Legal Department',
    'Confidentiality Agreement - Bilateral NDA'
  ),
  // Multi-page document needs footer with page numbers
  footer: createFooter('NDA', 'Confidentiality Agreement'),
  // Bookmarks enable navigation between clauses in PDF viewers
  bookmarks: { minLevel: 1, maxLevel: 2 },
  content: [
    // Document title and execution date
    {
      type: 'heading',
      level: 1,
      text: 'NON-DISCLOSURE AGREEMENT',
      fontSize: 18,
      color: colors.primary,
      align: 'center',
      spaceAfter: 2,
    },
    {
      type: 'paragraph',
      text: 'This Agreement is entered into as of the 15th day of April, 2026',
      fontSize: 10,
      color: colors.gray700,
      align: 'center',
      spaceAfter: 16,
    },

    // Parties
    {
      type: 'paragraph',
      text: 'BETWEEN:',
      fontWeight: 700,
      spaceAfter: 4,
    },
    {
      type: 'paragraph',
      text: 'TechFlow Inc., a corporation organized and existing under the laws of California, with its principal place of business at 123 Tech Street, San Francisco, California 94102, USA\n\n(hereinafter referred to as the "Disclosing Party")',
      fontSize: 10.5,
      color: colors.gray700,
      spaceAfter: 12,
    },

    {
      type: 'paragraph',
      text: 'AND:',
      fontWeight: 700,
      spaceAfter: 4,
    },
    {
      type: 'paragraph',
      text: 'Acme Corporation, a corporation organized and existing under the laws of the United Kingdom, with its principal place of business at 456 Business Avenue, London, United Kingdom\n\n(hereinafter referred to as the "Receiving Party")',
      fontSize: 10.5,
      color: colors.gray700,
      spaceAfter: 20,
    },

    {
      type: 'paragraph',
      text: 'WHEREAS the parties wish to discuss potential business opportunities and to protect the confidentiality of proprietary information disclosed during such discussions;',
      fontSize: 10.5,
      color: colors.gray700,
      spaceAfter: 12,
    },

    {
      type: 'paragraph',
      text: 'NOW THEREFORE in consideration of the mutual covenants and agreements contained herein, the parties agree as follows:',
      fontSize: 10.5,
      fontWeight: 700,
      color: colors.gray700,
      spaceAfter: 16,
    },

    // Clauses
    {
      type: 'heading',
      level: 2,
      text: '1. DEFINITIONS',
      fontSize: 11,
      spaceAfter: 6,
    },
    {
      type: 'paragraph',
      text: '"Confidential Information" means any non-public information disclosed by the Disclosing Party to the Receiving Party, whether orally, visually, in writing, or in any other form, including but not limited to technical data, trade secrets, business plans, financial information, and strategic plans. Confidential Information excludes information that: (a) is or becomes publicly available through no breach of this Agreement; (b) is rightfully received by the Receiving Party from a third party without confidentiality obligations; (c) is independently developed by the Receiving Party without use of Confidential Information; or (d) is required to be disclosed by law.',
      fontSize: 10.5,
      color: colors.gray700,
      spaceAfter: 14,
    },

    {
      type: 'heading',
      level: 2,
      text: '2. CONFIDENTIAL INFORMATION',
      fontSize: 11,
      spaceAfter: 6,
    },
    {
      type: 'paragraph',
      text: 'The Disclosing Party discloses Confidential Information to the Receiving Party solely for the purpose of evaluating potential business collaboration. The Receiving Party shall treat all Confidential Information as strictly confidential and shall not disclose it to third parties without prior written consent of the Disclosing Party.',
      fontSize: 10.5,
      color: colors.gray700,
      spaceAfter: 14,
    },

    {
      type: 'heading',
      level: 2,
      text: '3. OBLIGATIONS OF THE RECEIVING PARTY',
      fontSize: 11,
      spaceAfter: 6,
    },
    {
      type: 'paragraph',
      text: 'The Receiving Party shall: (a) protect Confidential Information using the same degree of care it uses for its own confidential information, but no less than reasonable care; (b) limit access to employees and contractors who have a legitimate need-to-know and who are bound by written confidentiality obligations; (c) not use Confidential Information for any purpose other than evaluation of the potential business relationship.',
      fontSize: 10.5,
      color: colors.gray700,
      spaceAfter: 14,
    },

    {
      type: 'heading',
      level: 2,
      text: '4. EXCLUSIONS',
      fontSize: 11,
      spaceAfter: 6,
    },
    {
      type: 'paragraph',
      text: 'The obligations of the Receiving Party under this Agreement shall not apply to any information that is required to be disclosed by court order, regulatory authority, or law. The Receiving Party shall provide prompt notice to the Disclosing Party of any such legally required disclosure to allow the Disclosing Party to seek protective orders.',
      fontSize: 10.5,
      color: colors.gray700,
      spaceAfter: 14,
    },

    {
      type: 'heading',
      level: 2,
      text: '5. TERM AND TERMINATION',
      fontSize: 11,
      spaceAfter: 6,
    },
    {
      type: 'paragraph',
      text: 'This Agreement shall commence on the date first written above and continue for a period of three (3) years unless terminated earlier by either party upon thirty (30) days written notice. Obligations with respect to Confidential Information shall survive termination of this Agreement for a period of three (3) years.',
      fontSize: 10.5,
      color: colors.gray700,
      spaceAfter: 14,
    },

    {
      type: 'heading',
      level: 2,
      text: '6. REMEDIES',
      fontSize: 11,
      spaceAfter: 6,
    },
    {
      type: 'paragraph',
      text: 'The Receiving Party acknowledges that any breach of this Agreement may cause irreparable harm for which monetary damages may be an inadequate remedy. Accordingly, in addition to any other remedies available at law or in equity, the Disclosing Party shall be entitled to seek equitable relief including injunction and specific performance.',
      fontSize: 10.5,
      color: colors.gray700,
      spaceAfter: 14,
    },

    {
      type: 'heading',
      level: 2,
      text: '7. GOVERNING LAW',
      fontSize: 11,
      spaceAfter: 6,
    },
    {
      type: 'paragraph',
      text: 'This Agreement shall be governed by and construed in accordance with the laws of the State of California, USA, without regard to its conflicts of law principles. Any legal action or proceeding arising under this Agreement shall be brought exclusively in the courts located in San Francisco County, California.',
      fontSize: 10.5,
      color: colors.gray700,
      spaceAfter: 24,
    },

    // Signatures
    {
      type: 'heading',
      level: 2,
      text: 'SIGNATURES',
      fontSize: 11,
      spaceAfter: 12,
    },

    {
      type: 'table',
      columns: [{ width: '1*' }, { width: '1*' }],
      rows: [
        {
          cells: [
            {
              text: 'FOR TECHFLOW INC.\n\n\n_______________________\nSignature\n\n_______________________\nName (Print)\n\n_______________________\nTitle\n\n_______________________\nDate',
              fontSize: 10,
              color: colors.gray700,
            },
            {
              text: 'FOR ACME CORPORATION\n\n\n_______________________\nSignature\n\n_______________________\nName (Print)\n\n_______________________\nTitle\n\n_______________________\nDate',
              fontSize: 10,
              color: colors.gray700,
            },
          ],
        },
      ],
      borderWidth: 0,
      cellPaddingV: 8,
      spaceAfter: 16,
    },

    // Witness/Notary (optional)
    {
      type: 'heading',
      level: 4,
      text: 'Witness / Notary Public (Optional)',
      fontSize: 9,
      color: '#888888',
      spaceAfter: 8,
    },
    {
      type: 'paragraph',
      text: '_______________________\nWitness/Notary Signature\n\n_______________________\nName (Print) & Seal\n\n_______________________\nDate',
      fontSize: 9,
      color: '#555555',
    },
  ],
})

const outPath = path.join(__dirname, 'output', 'nda.pdf')
fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, pdf)

console.log(`✓ NDA PDF: ${outPath} (${(pdf.byteLength / 1024).toFixed(1)} KB)`)
console.log(`  Encryption: copy protection enabled`)
