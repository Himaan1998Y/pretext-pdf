/**
 * Phase 8B — Interactive Forms Example
 *
 * Demonstrates all AcroForm field types: text, checkbox, radio, dropdown, button.
 * Open the output PDF in Adobe Reader or Preview to interact with the fields.
 *
 * Run: npm run example:forms
 * Output: output/phase8-forms.pdf
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { render } from '../dist/index.js'
import type { PdfDocument } from '../dist/index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const doc: PdfDocument = {
  metadata: {
    title: 'Interactive Form Demo',
    author: 'pretext-pdf',
    subject: 'AcroForm fields example',
  },
  content: [
    { type: 'heading', level: 1, text: 'Job Application Form' },
    { type: 'paragraph', text: 'Please fill in all required fields below. Fields marked with * are required.' },
    { type: 'spacer', height: 8 },

    // Text fields
    { type: 'heading', level: 2, text: 'Personal Information' },
    { type: 'form-field', fieldType: 'text', name: 'fullName', label: 'Full Name *', placeholder: 'John Doe' },
    { type: 'form-field', fieldType: 'text', name: 'email', label: 'Email Address *', placeholder: 'john@example.com' },
    { type: 'form-field', fieldType: 'text', name: 'phone', label: 'Phone Number', placeholder: '+91 98765 43210' },
    { type: 'spacer', height: 8 },

    // Dropdown
    { type: 'heading', level: 2, text: 'Role Preferences' },
    {
      type: 'form-field',
      fieldType: 'dropdown',
      name: 'department',
      label: 'Preferred Department',
      options: [
        { value: 'eng', label: 'Engineering' },
        { value: 'design', label: 'Design' },
        { value: 'product', label: 'Product' },
        { value: 'marketing', label: 'Marketing' },
        { value: 'operations', label: 'Operations' },
      ],
      defaultSelected: 'eng',
    },
    { type: 'spacer', height: 8 },

    // Radio group
    {
      type: 'form-field',
      fieldType: 'radio',
      name: 'experience',
      label: 'Years of Experience',
      options: [
        { value: '0-2', label: '0-2 years' },
        { value: '3-5', label: '3-5 years' },
        { value: '6-10', label: '6-10 years' },
        { value: '10+', label: '10+ years' },
      ],
      defaultSelected: '3-5',
    },
    { type: 'spacer', height: 8 },

    // Multiline text
    { type: 'heading', level: 2, text: 'Cover Letter' },
    {
      type: 'form-field',
      fieldType: 'text',
      name: 'coverLetter',
      label: 'Tell us about yourself *',
      multiline: true,
      height: 80,
    },
    { type: 'spacer', height: 8 },

    // Checkbox
    { type: 'heading', level: 2, text: 'Agreement' },
    {
      type: 'form-field',
      fieldType: 'checkbox',
      name: 'agreeTerms',
      label: 'I agree to the terms and conditions *',
      checked: false,
    },
    {
      type: 'form-field',
      fieldType: 'checkbox',
      name: 'newsletter',
      label: 'Subscribe to company newsletter',
      checked: true,
    },
    { type: 'spacer', height: 16 },

    // Submit button
    {
      type: 'form-field',
      fieldType: 'button',
      name: 'submitBtn',
      label: 'Submit Application',
      width: 150,
      backgroundColor: '#0070F3',
      borderColor: '#0050B3',
    },
  ],
}

const outputDir = path.join(__dirname, '..', 'output')
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir)

const pdf = await render(doc)
const outputPath = path.join(outputDir, 'phase8-forms.pdf')
fs.writeFileSync(outputPath, pdf)
console.log(`Written: ${outputPath} (${(pdf.length / 1024).toFixed(1)} KB)`)
console.log('   Open in Adobe Reader or Chrome to interact with the form fields.')
