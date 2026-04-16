/**
 * Shared utilities and design system for pretext-pdf templates
 * Provides: formatting functions, color palette, typography scale, metadata helpers
 */

// Design System Colors
export const colors = {
  primary: '#1a1a2e',      // Dark navy for headings, emphasis
  accent: '#0070f3',       // Blue for links, key info
  success: '#5cb85c',      // Green for completed/approved
  warning: '#f0ad4e',      // Orange for in-progress/caution
  danger: '#d9534f',       // Red for errors/not started
  subtle: '#f0f4ff',       // Light blue for table header backgrounds
  gray700: '#555555',
  gray600: '#666666',
  gray500: '#888888',
  gray400: '#999999',
  gray300: '#dddddd',
  gray200: '#e8e8e8',
  gray100: '#f8f8f8',
}

// Typography Scale
export const typography = {
  h1: 28,
  h2: 14,
  h3: 11,
  h4: 9,
  body: 10.5,
  small: 8.5,
}

/**
 * Format currency with symbol and 2 decimal places
 * Supports: USD ($), EUR (€), GBP (£), or generic currency code
 */
export function formatCurrency(amount: number, currency: string): string {
  const symbols: Record<string, string> = { USD: '$', EUR: '€', GBP: '£' }
  return `${symbols[currency] || currency} ${amount.toFixed(2)}`
}

/**
 * Format Indian Rupees with proper comma placement (Crore, Lakh, Thousand)
 * Example: 1234567.89 → ₹12,34,567.89
 */
export function formatINR(amount: number): string {
  const [integer, decimal] = amount.toFixed(2).split('.')
  const lastThree = integer.slice(-3)
  const rest = integer.slice(0, -3)
  const formatted = rest
    ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + lastThree
    : lastThree
  return `₹${formatted}.${decimal}`
}

/**
 * Convert amount to words in Indian format (Crore, Lakh, Thousand, Rupees, Paise)
 * Example: 1234567.89 → "Rupees Twelve Lakh Thirty Four Thousand Five Hundred Sixty Seven and Eighty Nine Paise Only"
 * Used for GST invoices (mandatory compliance)
 */
export function amountInWords(amount: number): string {
  const ones = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen',
  ]
  const tens = [
    '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty',
    'Sixty', 'Seventy', 'Eighty', 'Ninety',
  ]

  function twoDigits(n: number): string {
    if (n < 20) return ones[n]
    return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '')
  }

  function threeDigits(n: number): string {
    if (n >= 100)
      return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + twoDigits(n % 100) : '')
    return twoDigits(n)
  }

  const rupees = Math.floor(amount)
  const paise = Math.round((amount - rupees) * 100)

  let words = ''
  if (rupees >= 10_000_000) words += threeDigits(Math.floor(rupees / 10_000_000)) + ' Crore '
  if (rupees % 10_000_000 >= 100_000)
    words += threeDigits(Math.floor((rupees % 10_000_000) / 100_000)) + ' Lakh '
  if (rupees % 100_000 >= 1_000)
    words += threeDigits(Math.floor((rupees % 100_000) / 1_000)) + ' Thousand '
  const remainder = rupees % 1_000
  if (remainder >= 100) words += threeDigits(Math.floor(remainder / 100)) + ' Hundred '
  words += twoDigits(remainder % 100)

  let result = 'Rupees ' + words.trim()
  if (paise > 0) result += ` and ${twoDigits(paise)} Paise`
  return result + ' Only'
}

/**
 * Create consistent metadata for PDF documents
 * Improves searchability and organization in document viewers
 */
export function createMetadata(title: string, author: string, subject: string) {
  return {
    title,
    author,
    subject,
    creationDate: new Date(),
  }
}

/**
 * Create standard footer with page numbers
 * Format: "Document Type · Page N of M · Company/Author Name"
 */
export function createFooter(docType: string, company: string) {
  return {
    text: `${docType}  ·  Page {{pageNumber}} of {{totalPages}}  ·  ${company}`,
    fontSize: 8,
    color: colors.gray500,
    align: 'center' as const,
  }
}
