import { alignSchema, alignNoJustify, fontWeightSchema, colorSchema, spaceSchema } from './shared.js'
import { paragraphSchema, headingSchema, blockquoteSchema, codeSchema, calloutSchema, richParagraphSchema, listSchema, tocSchema, footnoteDefSchema } from './elements-text.js'
import { imageSchema, svgSchema, qrCodeSchema, barcodeSchema, chartSchema } from './elements-media.js'
import { spacerSchema, hrSchema, pageBreakSchema, commentSchema, formFieldSchema, floatGroupSchema } from './elements-block.js'
import { tableSchema } from './elements-table.js'

export const pdfDocumentSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'PdfDocument',
  description: 'Top-level descriptor for a pretext-pdf document.',
  type: 'object',
  required: ['content'],
  properties: {
    content: {
      type: 'array',
      description: 'Document content elements rendered top-to-bottom.',
      items: {
        oneOf: [
          paragraphSchema,
          headingSchema,
          spacerSchema,
          hrSchema,
          pageBreakSchema,
          imageSchema,
          svgSchema,
          tableSchema,
          listSchema,
          blockquoteSchema,
          codeSchema,
          calloutSchema,
          richParagraphSchema,
          tocSchema,
          footnoteDefSchema,
          qrCodeSchema,
          barcodeSchema,
          commentSchema,
          formFieldSchema,
          floatGroupSchema,
          chartSchema,
        ],
      },
    },

    pageSize: {
      description: 'Page size. Default: A4 (595×842 pt). Custom: [width, height] in pt.',
      oneOf: [
        {
          type: 'string',
          enum: ['A4', 'Letter', 'Legal', 'A3', 'A5', 'Tabloid'],
        },
        {
          type: 'array',
          items: { type: 'number' },
          minItems: 2,
          maxItems: 2,
          description: '[width, height] in points',
        },
      ],
    },

    margins: {
      type: 'object',
      description: 'Page margins in pt. Default: all 72pt (1 inch).',
      properties: {
        top: { type: 'number' },
        bottom: { type: 'number' },
        left: { type: 'number' },
        right: { type: 'number' },
      },
    },

    defaultFont: {
      type: 'string',
      description: 'Default font family for body text. Default: Inter',
    },

    defaultFontSize: {
      type: 'number',
      description: 'Default font size in pt. Default: 12',
    },

    defaultLineHeight: {
      type: 'number',
      description: 'Default line height in pt. Default: fontSize * 1.5',
    },

    fonts: {
      type: 'array',
      description: 'Custom fonts to load and embed.',
      items: {
        type: 'object',
        required: ['family', 'src'],
        properties: {
          family: { type: 'string' },
          weight: fontWeightSchema,
          style: { type: 'string', enum: ['normal', 'italic'] },
          src: { type: 'string', description: 'Absolute file path to a TTF/OTF font file' },
        },
      },
    },

    header: {
      type: 'object',
      description: 'Header rendered at top of every page. Supports {{pageNumber}} and {{totalPages}}.',
      required: ['text'],
      properties: {
        text: { type: 'string', description: 'Use {{pageNumber}} and {{totalPages}} as tokens' },
        fontSize: { type: 'number' },
        align: alignNoJustify,
        fontFamily: { type: 'string' },
        fontWeight: fontWeightSchema,
        color: colorSchema,
      },
    },

    footer: {
      type: 'object',
      description: 'Footer rendered at bottom of every page. Supports {{pageNumber}} and {{totalPages}}.',
      required: ['text'],
      properties: {
        text: { type: 'string', description: 'Use {{pageNumber}} and {{totalPages}} as tokens' },
        fontSize: { type: 'number' },
        align: alignNoJustify,
        fontFamily: { type: 'string' },
        fontWeight: fontWeightSchema,
        color: colorSchema,
      },
    },

    sections: {
      type: 'array',
      description: 'Page-range overrides for header/footer. First matching section wins. Falls back to doc.header/footer.',
      items: {
        type: 'object',
        properties: {
          fromPage: { type: 'number', description: 'First page (1-based, inclusive). Default: 1' },
          toPage: { type: 'number', description: 'Last page (1-based, inclusive). Default: Infinity' },
          header: {
            type: 'object',
            properties: {
              text: { type: 'string' },
              fontSize: { type: 'number' },
              align: alignNoJustify,
              fontFamily: { type: 'string' },
              fontWeight: fontWeightSchema,
              color: colorSchema,
            },
          },
          footer: {
            type: 'object',
            properties: {
              text: { type: 'string' },
              fontSize: { type: 'number' },
              align: alignNoJustify,
              fontFamily: { type: 'string' },
              fontWeight: fontWeightSchema,
              color: colorSchema,
            },
          },
        },
      },
    },

    watermark: {
      type: 'object',
      description: 'Watermark overlay rendered on every page behind content.',
      properties: {
        text: { type: 'string' },
        fontFamily: { type: 'string' },
        fontWeight: fontWeightSchema,
        fontSize: { type: 'number' },
        color: colorSchema,
        opacity: { type: 'number', minimum: 0, maximum: 1 },
        rotation: { type: 'number', description: 'Rotation in degrees (counter-clockwise). Default: -45' },
      },
    },

    encryption: {
      type: 'object',
      description: 'Password protection and permission control for the output PDF.',
      properties: {
        userPassword: { type: 'string', description: 'Password required to open the document.' },
        ownerPassword: { type: 'string', description: 'Password for full unrestricted access.' },
        permissions: {
          type: 'object',
          properties: {
            printing: { type: 'boolean' },
            copying: { type: 'boolean' },
            modifying: { type: 'boolean' },
            annotating: { type: 'boolean' },
          },
        },
      },
    },

    metadata: {
      type: 'object',
      description: 'PDF document metadata written into file properties.',
      properties: {
        title: { type: 'string' },
        author: { type: 'string' },
        subject: { type: 'string' },
        keywords: { type: 'array', items: { type: 'string' } },
        creator: { type: 'string' },
        language: { type: 'string', description: "BCP47 language tag e.g. 'en-US', 'hi', 'ar'" },
        producer: { type: 'string' },
        accessibility: { type: 'object', description: 'Reserved for PDF/UA and WCAG accessibility metadata (v1.8+). No render-time effect in v1.x.' },
        semantic: { type: 'object', description: 'Reserved for semantic document structure metadata (v1.8+). No render-time effect in v1.x.' },
      },
    },

    defaultParagraphStyle: {
      type: 'object',
      description: 'Default style applied to every paragraph and heading that does not set the field explicitly.',
      properties: {
        fontSize: { type: 'number' },
        lineHeight: { type: 'number' },
        fontFamily: { type: 'string' },
        fontWeight: fontWeightSchema,
        color: colorSchema,
        align: alignSchema,
        letterSpacing: { type: 'number' },
        spaceBefore: spaceSchema,
        spaceAfter: spaceSchema,
      },
    },

    bookmarks: {
      description: 'PDF bookmark outline. Set to false to disable, or provide config object.',
      oneOf: [
        { type: 'boolean', const: false },
        {
          type: 'object',
          properties: {
            minLevel: { type: 'number', enum: [1, 2, 3, 4] },
            maxLevel: { type: 'number', enum: [1, 2, 3, 4] },
          },
        },
      ],
    },

    hyphenation: {
      type: 'object',
      description: 'Automatic word hyphenation. Requires installing the matching hyphenation.XX npm package.',
      required: ['language'],
      properties: {
        language: { type: 'string', description: "Language code e.g. 'en-us', 'de', 'fr'" },
        minWordLength: { type: 'number' },
        leftMin: { type: 'number' },
        rightMin: { type: 'number' },
      },
    },

    signature: {
      type: 'object',
      description: 'Signature applied to the rendered PDF. Providing p12 enables PKCS#7 cryptographic signing (requires @signpdf/* peer deps); without p12 a visual-only placeholder box is drawn.',
      properties: {
        p12: { type: 'string', description: 'Absolute path to a .p12/.pfx certificate file, or base64-encoded cert bytes. Triggers PKCS#7/CMS digital signing. Requires @signpdf/signpdf, @signpdf/placeholder-pdf-lib, @signpdf/signer-p12, and pdf-lib peer deps.' },
        passphrase: { type: 'string', description: 'Passphrase to decrypt the P12 certificate. Omit if the certificate has no passphrase.' },
        contactInfo: { type: 'string', description: 'Contact info (e.g. email address) embedded in the PDF signature dictionary. Default: empty string.' },
        signerName: { type: 'string' },
        reason: { type: 'string' },
        location: { type: 'string' },
        x: { type: 'number' },
        y: { type: 'number' },
        width: { type: 'number' },
        height: { type: 'number' },
        page: { type: 'number', description: 'Page index (0-based). Default: last page.' },
        borderColor: colorSchema,
        fontSize: { type: 'number' },
        invisible: { type: 'boolean', description: 'If true, skip the visual signature box — crypto-only invisible signing. Default: false.' },
      },
    },

    flattenForms: {
      type: 'boolean',
      description: 'If true, flatten all form fields into static content. Default: false',
    },

    allowedFileDirs: {
      type: 'array',
      items: { type: 'string' },
      description: 'Restrict filesystem access to these absolute directory paths.',
    },
  },
  // additionalProperties: false on the root object catches unknown top-level keys
  // in AI-agent and MCP code-generation contexts, where an LLM might hallucinate
  // a property that doesn't exist. Element schemas (content items) are intentionally
  // not locked down here — they use runtime validation in validate/index.ts which
  // produces precise per-property VALIDATION_ERROR messages for better DX than
  // JSON Schema's generic "additional property" error.
  additionalProperties: false,
} as const satisfies Record<string, unknown>
