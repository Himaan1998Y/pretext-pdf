import { alignNoJustify, colorSchema, spaceSchema, inlineSpanSchema } from './shared.js'

export const imageSchema = {
  type: 'object',
  required: ['type', 'src'],
  properties: {
    type: { type: 'string', const: 'image' },
    src: { type: 'string', description: 'Absolute file path or URL' },
    format: { type: 'string', enum: ['png', 'jpg', 'auto'] },
    width: { type: 'number' },
    height: { type: 'number' },
    align: alignNoJustify,
    spaceAfter: spaceSchema,
    spaceBefore: spaceSchema,
    float: { type: 'string', enum: ['left', 'right'] },
    floatText: { type: 'string' },
    floatWidth: { type: 'number', description: 'Image column width in pt. Default: 35% of content width.' },
    floatGap: { type: 'number', description: 'Gap between image and text columns in pt. Default: 12' },
    floatSpans: { type: 'array', items: inlineSpanSchema, description: 'Rich-text spans rendered alongside the image. Alternative to floatText.' },
    floatFontSize: { type: 'number', description: 'Font size for floatText in pt.' },
    floatFontFamily: { type: 'string', description: 'Font family for floatText.' },
    floatColor: colorSchema,
  },
} as const

export const svgSchema = {
  type: 'object',
  required: ['type'],
  properties: {
    type: { type: 'string', const: 'svg' },
    svg: { type: 'string', description: 'Inline SVG markup string' },
    src: { type: 'string', description: 'Absolute path or https:// URL to an SVG file' },
    width: { type: 'number' },
    height: { type: 'number' },
    align: alignNoJustify,
    spaceBefore: spaceSchema,
    spaceAfter: spaceSchema,
  },
} as const

export const qrCodeSchema = {
  type: 'object',
  required: ['type', 'data'],
  properties: {
    type: { type: 'string', const: 'qr-code' },
    data: { type: 'string' },
    size: { type: 'number' },
    errorCorrectionLevel: { type: 'string', enum: ['L', 'M', 'Q', 'H'] },
    foreground: colorSchema,
    background: colorSchema,
    margin: { type: 'number', description: 'Quiet-zone modules around the symbol. Default: 4' },
    align: alignNoJustify,
    spaceBefore: spaceSchema,
    spaceAfter: spaceSchema,
  },
} as const

export const barcodeSchema = {
  type: 'object',
  required: ['type', 'symbology', 'data'],
  properties: {
    type: { type: 'string', const: 'barcode' },
    symbology: { type: 'string', description: "e.g. 'code128', 'ean13', 'qrcode'" },
    data: { type: 'string' },
    width: { type: 'number' },
    height: { type: 'number' },
    includeText: { type: 'boolean' },
    align: alignNoJustify,
    spaceBefore: spaceSchema,
    spaceAfter: spaceSchema,
  },
} as const

export const chartSchema = {
  type: 'object',
  required: ['type', 'spec'],
  properties: {
    type: { type: 'string', const: 'chart' },
    spec: { type: 'object', description: 'Vega-Lite JSON specification. Requires vega and vega-lite peer deps.' },
    width: { type: 'number' },
    height: { type: 'number' },
    caption: { type: 'string', description: 'Optional figure caption rendered below the chart.' },
    align: alignNoJustify,
    spaceBefore: spaceSchema,
    spaceAfter: spaceSchema,
  },
} as const
