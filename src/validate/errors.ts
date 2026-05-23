/**
 * validate/errors.ts — Structured error parsing for validateDocument().
 * Extracted from src/validate.ts (#11a).
 */
import type { PdfDocument, ValidationError } from '../types.js'
import type { ErrorCode } from '../errors.js'

export function isValidPdfDocumentLike(doc: unknown): doc is PdfDocument {
  return doc !== null && typeof doc === 'object' && !Array.isArray(doc)
}

/** Parse a PretextPdfError message into structured ValidationError entries */
export function parseValidationErrorsStructured(message: string, code: string): ValidationError[] {
  if (message.startsWith('Strict validation failed')) {
    const lines = message
      .split('\n')
      .slice(1) // skip "Strict validation failed (N issues):" header
      .filter(l => Boolean(l.trim()) && !l.startsWith('...'))
    return lines.map(line => {
      const colonIdx = line.indexOf(':')
      const path = colonIdx > 0 ? line.slice(0, colonIdx).trim() : 'document'
      const rest = colonIdx > 0 ? line.slice(colonIdx + 1).trim() : line.trim()
      const suggMatch = rest.match(/did you mean "([^"]+)"/)
      const suggestion = suggMatch ? suggMatch[1] : undefined
      const isUnknown = rest.includes('unknown property')
      const unknownProp = isUnknown ? (/\.([^.[]+)$/.exec(path)?.[1] ?? path) : undefined
      return {
        path,
        message: rest,
        code: 'UNKNOWN_PROPERTY',
        severity: 'error' as const,
        ...(unknownProp !== undefined && { unknownProp }),
        ...(suggestion !== undefined && { suggestion }),
      }
    })
  }
  const colonIdx = message.indexOf(':')
  // A valid path (e.g. "content[0] (paragraph) spans[0].href") never contains ". " (period + space).
  // Prose fragments like "margins.left must be a non-negative finite number. Got" do, so we reject them.
  const candidate = message.slice(0, colonIdx).trim()
  const hasPathPrefix = colonIdx > 0 && !/\. /.test(candidate)
  const path = hasPathPrefix ? candidate : 'document'
  const msgText = hasPathPrefix ? message.slice(colonIdx + 1).trim() : message
  return [{
    path,
    message: msgText,
    code: code as ErrorCode,
    severity: 'error' as const,
  }]
}
