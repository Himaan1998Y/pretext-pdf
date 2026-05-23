/**
 * validate/elements/list.ts — List element validator (with 2-level nesting).
 * Extracted from src/validate.ts (#11a).
 */
import type { ContentElement } from '../../types.js'
import { PretextPdfError } from '../../errors.js'
import { ALLOWED_PROPS_SUB } from '../../allowed-props.js'
import {
  HEX_COLOR_REGEX,
  assertUnknownProps,
  withCycleGuard,
  type ValidationContext,
} from '../helpers.js'

export function validateList(
  el: Extract<ContentElement, { type: 'list' }>,
  prefix: string,
  depth: number,
  ctx: ValidationContext,
): void {
  if (el.style !== 'ordered' && el.style !== 'unordered') {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (list): 'style' must be 'ordered' or 'unordered'`)
  }
  if (!Array.isArray(el.items) || el.items.length === 0) {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (list): 'items' must be a non-empty array`)
  }

  // Wrap list items walk with cycle guard
  withCycleGuard(ctx.seen, el, depth + 1, prefix, () => {
    for (let ii = 0; ii < el.items.length; ii++) {
      const item = el.items[ii]!
      // Strict: validate list item properties
      if (ctx.strict) {
        assertUnknownProps(item, ALLOWED_PROPS_SUB['list-item'], `${prefix}.items[${ii}]`, ctx.errors)
      }
      if (typeof item.text !== 'string' || item.text.trim() === '') {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (list): items[${ii}].text must be a non-empty string`)
      }
      // NEW: Validate dir field
      if (item.dir !== undefined && !['ltr', 'rtl', 'auto'].includes(item.dir)) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (list): items[${ii}].dir must be 'ltr', 'rtl', or 'auto'`)
      }
      if (item.fontWeight !== undefined && ![400, 700].includes(item.fontWeight)) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (list): items[${ii}].fontWeight must be 400 or 700`)
      }
      // Validate nested items (1 level deep)
      if (item.items) {
        if (!Array.isArray(item.items) || item.items.length === 0) {
          throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (list): items[${ii}].items must be a non-empty array if provided`)
        }
        for (let ni = 0; ni < item.items.length; ni++) {
          const nested = item.items[ni]!
          // Strict: validate nested list item properties
          if (ctx.strict) {
            assertUnknownProps(nested, ALLOWED_PROPS_SUB['list-item'], `${prefix}.items[${ii}].items[${ni}]`, ctx.errors)
          }
          if (typeof nested.text !== 'string' || nested.text.trim() === '') {
            throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (list): items[${ii}].items[${ni}].text must be a non-empty string`)
          }
          if (nested.items !== undefined) {
            throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (list): items[${ii}].items[${ni}].items is not allowed — maximum nesting depth is 2 levels`)
          }
        }
      }
    }
  })
  if (el.color !== undefined && !HEX_COLOR_REGEX.test(el.color)) {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (list): 'color' must be a 6-digit hex string like '#ff0000'. Got: '${el.color}'`)
  }
  if (el.nestedNumberingStyle !== undefined && !['continue', 'restart'].includes(el.nestedNumberingStyle)) {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (list): 'nestedNumberingStyle' must be 'continue' or 'restart'. Got: '${el.nestedNumberingStyle}'`)
  }
  if (el.indent !== undefined && (typeof el.indent !== 'number' || el.indent < 0)) {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (list): 'indent' must be a non-negative number`)
  }
  if (el.markerWidth !== undefined && (typeof el.markerWidth !== 'number' || el.markerWidth <= 0)) {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (list): 'markerWidth' must be a positive number`)
  }
  if (el.marker !== undefined && (typeof el.marker !== 'string' || el.marker.trim() === '')) {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (list): 'marker' must be a non-empty string`)
  }
}
