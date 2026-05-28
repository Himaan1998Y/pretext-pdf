/** Atomic sub-schemas shared across element schemas. */

export const alignSchema = { type: 'string', enum: ['left', 'center', 'right', 'justify'] } as const
export const alignNoJustify = { type: 'string', enum: ['left', 'center', 'right'] } as const
export const fontWeightSchema = { type: 'number', enum: [400, 700] } as const
export const colorSchema = { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$', description: '6-digit hex color e.g. #FF0000' } as const
export const dirSchema = { type: 'string', enum: ['ltr', 'rtl', 'auto'] } as const
export const spaceSchema = { type: 'number', description: 'Space in points (pt)' } as const

export const inlineSpanSchema = {
  type: 'object',
  required: ['text'],
  properties: {
    text: { type: 'string' },
    dir: dirSchema,
    fontFamily: { type: 'string' },
    fontWeight: fontWeightSchema,
    fontStyle: { type: 'string', enum: ['normal', 'italic'] },
    color: colorSchema,
    fontSize: { type: 'number' },
    underline: { type: 'boolean' },
    strikethrough: { type: 'boolean' },
    url: { type: 'string' },
    href: { type: 'string' },
    verticalAlign: { type: 'string', enum: ['superscript', 'subscript'] },
    smallCaps: { type: 'boolean' },
    letterSpacing: { type: 'number' },
    footnoteRef: { type: 'string' },
  },
} as const
