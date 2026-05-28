import { alignNoJustify, fontWeightSchema, colorSchema, dirSchema, spaceSchema } from './shared.js'

export const tableSchema = {
  type: 'object',
  required: ['type', 'columns', 'rows'],
  properties: {
    type: { type: 'string', const: 'table' },
    columns: {
      type: 'array',
      items: {
        type: 'object',
        required: ['width'],
        properties: {
          width: { oneOf: [{ type: 'number' }, { type: 'string', description: "Fraction e.g. '2*', '*', or 'auto'" }] },
          align: alignNoJustify,
        },
      },
    },
    rows: {
      type: 'array',
      items: {
        type: 'object',
        required: ['cells'],
        properties: {
          cells: {
            type: 'array',
            items: {
              type: 'object',
              required: ['text'],
              properties: {
                text: { type: 'string' },
                align: alignNoJustify,
                fontWeight: fontWeightSchema,
                fontFamily: { type: 'string' },
                fontSize: { type: 'number' },
                color: colorSchema,
                bgColor: colorSchema,
                colspan: { type: 'number' },
                rowspan: { type: 'number' },
                dir: dirSchema,
                tabularNumbers: { type: 'boolean', description: 'Render digits at fixed slot width.' },
              },
            },
          },
          isHeader: { type: 'boolean' },
        },
      },
    },
    borderColor: colorSchema,
    borderWidth: { type: 'number' },
    headerBgColor: colorSchema,
    fontSize: { type: 'number' },
    cellPaddingH: { type: 'number', description: 'Horizontal cell padding in pt. Default: 8' },
    cellPaddingV: { type: 'number', description: 'Vertical cell padding in pt. Default: 6' },
    spaceAfter: spaceSchema,
    spaceBefore: spaceSchema,
    dir: dirSchema,
    headerRows: { type: 'number', description: 'Number of header rows (repeated on continuation pages).' },
  },
} as const
