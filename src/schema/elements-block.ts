import { colorSchema, spaceSchema, fontWeightSchema } from './shared.js'

export const spacerSchema = {
  type: 'object',
  required: ['type', 'height'],
  properties: {
    type: { type: 'string', const: 'spacer' },
    height: { type: 'number', description: 'Height in pt' },
  },
} as const

export const hrSchema = {
  type: 'object',
  required: ['type'],
  properties: {
    type: { type: 'string', const: 'hr' },
    thickness: { type: 'number' },
    color: colorSchema,
    spaceBefore: { type: 'number', description: 'Space above line in pt. Default: 12.' },
    spaceAfter: { type: 'number', description: 'Space below line in pt. Default: 12.' },
  },
} as const

export const pageBreakSchema = {
  type: 'object',
  required: ['type'],
  properties: {
    type: { type: 'string', const: 'page-break' },
  },
} as const

export const commentSchema = {
  type: 'object',
  required: ['type', 'contents'],
  properties: {
    type: { type: 'string', const: 'comment' },
    contents: { type: 'string' },
    author: { type: 'string' },
    color: colorSchema,
    open: { type: 'boolean' },
    spaceAfter: spaceSchema,
  },
} as const

/** Shared base properties present on every FormFieldElement variant. */
const formFieldBaseProperties = {
  type: { type: 'string', const: 'form-field' },
  name: { type: 'string', description: 'Unique field name used in PDF AcroForm dictionary.' },
  label: { type: 'string' },
  width: { type: 'number' },
  height: { type: 'number' },
  fontSize: { type: 'number' },
  borderColor: colorSchema,
  backgroundColor: colorSchema,
  keepTogether: { type: 'boolean', description: 'If true, never break this element across pages. Default: true' },
  spaceAfter: spaceSchema,
  spaceBefore: spaceSchema,
  accessibilityLabel: { type: 'string', description: 'Written to the PDF /TU AcroForm annotation entry for screen-reader announcements.' },
} as const

/** Shared options array used by radio and dropdown variants. */
const formFieldOptionsSchema = {
  type: 'array',
  minItems: 1,
  items: {
    type: 'object',
    required: ['value', 'label'],
    properties: {
      value: { type: 'string', minLength: 1 },
      label: { type: 'string', minLength: 1 },
    },
    additionalProperties: false,
  },
} as const

/**
 * Discriminated-union schema for form-field elements.
 * The `fieldType` property is the discriminant; each oneOf branch constrains
 * the allowed properties to the specific variant.
 */
export const formFieldSchema = {
  type: 'object',
  required: ['type', 'fieldType', 'name'],
  oneOf: [
    {
      description: 'Single-line or multi-line text input.',
      properties: {
        ...formFieldBaseProperties,
        fieldType: { type: 'string', const: 'text' },
        placeholder: { type: 'string' },
        defaultValue: { type: 'string' },
        multiline: { type: 'boolean' },
        maxLength: { type: 'number', minimum: 1 },
      },
      required: ['type', 'fieldType', 'name'],
    },
    {
      description: 'Boolean on/off checkbox.',
      properties: {
        ...formFieldBaseProperties,
        fieldType: { type: 'string', const: 'checkbox' },
        checked: { type: 'boolean', description: 'Initial checked state. Default: false.' },
      },
      required: ['type', 'fieldType', 'name'],
    },
    {
      description: 'Radio button group — exactly one option is selectable.',
      properties: {
        ...formFieldBaseProperties,
        fieldType: { type: 'string', const: 'radio' },
        options: formFieldOptionsSchema,
        defaultSelected: { type: 'string', description: 'value of the pre-selected option.' },
      },
      required: ['type', 'fieldType', 'name', 'options'],
    },
    {
      description: 'Dropdown / select list — exactly one option is selectable.',
      properties: {
        ...formFieldBaseProperties,
        fieldType: { type: 'string', const: 'dropdown' },
        options: formFieldOptionsSchema,
        defaultSelected: { type: 'string', description: 'value of the pre-selected option.' },
      },
      required: ['type', 'fieldType', 'name', 'options'],
    },
    {
      description: 'Clickable push-button (no value submitted).',
      properties: {
        ...formFieldBaseProperties,
        fieldType: { type: 'string', const: 'button' },
      },
      required: ['type', 'fieldType', 'name'],
    },
  ],
} as const

export const floatGroupSchema = {
  type: 'object',
  required: ['type', 'image', 'float', 'content'],
  properties: {
    type: { type: 'string', const: 'float-group' },
    image: {
      type: 'object',
      required: ['src'],
      properties: {
        src: { type: 'string', description: 'Absolute file path or URL' },
        format: { type: 'string', enum: ['png', 'jpg', 'auto'] },
        height: { type: 'number' },
      },
    },
    float: { type: 'string', enum: ['left', 'right'] },
    floatWidth: { type: 'number', description: 'Image column width in pt. Default: 35% of content width.' },
    floatGap: { type: 'number', description: 'Gap between image and text columns in pt. Default: 12' },
    content: {
      type: 'array',
      description: 'Content elements rendered in the text column (paragraph, heading, rich-paragraph).',
      items: { type: 'object' },
    },
    spaceBefore: spaceSchema,
    spaceAfter: spaceSchema,
  },
} as const

void fontWeightSchema // imported for completeness
