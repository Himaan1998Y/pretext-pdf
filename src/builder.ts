/**
 * Builder API for pretext-pdf
 *
 * Provides a fluent, chainable interface for constructing PDF documents.
 * Accumulates ContentElement[] and delegates final rendering to render().
 */

import { runPipeline } from './pipeline.js'
import { applyPostProcessing } from './post-process.js'
import { validate } from './validate.js'
import type {
  PdfDocument,
  ContentElement,
  ParagraphElement,
  HeadingElement,
  TableElement,
  ImageElement,
  ListElement,
  CodeBlockElement,
  RichParagraphElement,
  BlockquoteElement,
  HorizontalRuleElement,
  CalloutElement,
  SvgElement,
  CommentElement,
  FormFieldElement,
  FootnoteDefElement,
  TocElement,
  InlineSpan,
  Margins,
  FontSpec,
  HeaderFooterSpec,
  DocumentMetadata,
} from './types.js'
import type { PluginDefinition } from './plugin-types.js'

/**
 * Options for initializing the PDF builder.
 * Includes all PdfDocument fields except 'content' (which is managed by the builder).
 * @public
 */
export interface PdfBuilderOptions {
  pageSize?: PdfDocument['pageSize']
  margins?: Partial<Margins>
  defaultFont?: string
  defaultFontSize?: number
  defaultLineHeight?: number
  fonts?: FontSpec[]
  header?: HeaderFooterSpec
  footer?: HeaderFooterSpec
  metadata?: DocumentMetadata
  defaultParagraphStyle?: PdfDocument['defaultParagraphStyle']
  sections?: PdfDocument['sections']
  plugins?: PluginDefinition[]
}

/**
 * Fluent builder returned by {@link createPdf}.
 * @public
 */
export interface PdfBuilder {
  addText(text: string, opts?: Partial<Omit<ParagraphElement, 'type' | 'text'>>): PdfBuilder
  addHeading(text: string, opts?: Partial<Omit<HeadingElement, 'type' | 'text' | 'level'>> & { level?: number }): PdfBuilder
  addTable(opts: Omit<TableElement, 'type'>): PdfBuilder
  addImage(src: ImageElement['src'], opts?: Partial<Omit<ImageElement, 'type' | 'src'>>): PdfBuilder
  addList(opts: Omit<ListElement, 'type'>): PdfBuilder
  addCode(text: string, opts: Omit<CodeBlockElement, 'type' | 'text'>): PdfBuilder
  addRichText(spans: InlineSpan[], opts?: Partial<Omit<RichParagraphElement, 'type' | 'spans'>>): PdfBuilder
  addBlockquote(text: string, opts?: Partial<Omit<BlockquoteElement, 'type' | 'text'>>): PdfBuilder
  addHr(opts?: Partial<Omit<HorizontalRuleElement, 'type'>>): PdfBuilder
  addSpacer(height: number): PdfBuilder
  addPageBreak(): PdfBuilder
  /** Render an inline SVG string (requires @napi-rs/canvas peer dep). */
  addSvg(svg: string, opts?: Partial<Omit<SvgElement, 'type' | 'svg'>>): PdfBuilder
  /** Add a callout box (info / warning / tip / note). */
  addCallout(content: string, opts?: Partial<Omit<CalloutElement, 'type' | 'content'>>): PdfBuilder
  /** Add an invisible sticky-note comment annotation. */
  addComment(contents: string, opts?: Partial<Omit<CommentElement, 'type' | 'contents'>>): PdfBuilder
  /** Add an interactive AcroForm field (text, checkbox, radio, dropdown, button). */
  addFormField(opts: Omit<FormFieldElement, 'type'>): PdfBuilder
  /** Define a reusable footnote (referenced by footnote-ref spans in rich paragraphs). */
  addFootnoteDef(id: string, text: string, opts?: Partial<Omit<FootnoteDefElement, 'type' | 'id' | 'text'>>): PdfBuilder
  /** Insert an auto-generated Table of Contents. */
  addTableOfContents(opts?: Partial<Omit<TocElement, 'type'>>): PdfBuilder
  /** Set the default paragraph/heading style applied doc-wide. */
  defaultStyle(style: PdfDocument['defaultParagraphStyle']): PdfBuilder
  /** Add a per-section header/footer override for the given page range. */
  section(fromPage: number, toPage: number, overrides: { header?: HeaderFooterSpec; footer?: HeaderFooterSpec }): PdfBuilder
  toDocument(): PdfDocument
  build(): Promise<Uint8Array>
}

/**
 * Create a new PDF document using the fluent builder API.
 *
 * @example
 * ```ts
 * const pdf = await createPdf({ pageSize: 'Letter' })
 *   .addHeading('Hello')
 *   .addText('This is a paragraph.')
 *   .addHr()
 *   .build()
 * ```
 * @public
 */
export function createPdf(options: PdfBuilderOptions = {}): PdfBuilder {
  const content: ContentElement[] = []
  let defaultParagraphStyle: PdfDocument['defaultParagraphStyle'] = options.defaultParagraphStyle
  const sections: NonNullable<PdfDocument['sections']> = options.sections ? [...options.sections] : []
  const plugins = options.plugins

  return {
    /**
     * Add a paragraph.
     */
    addText(text: string, opts?: Partial<Omit<ParagraphElement, 'type' | 'text'>>): PdfBuilder {
      content.push({ type: 'paragraph', text, ...opts })
      return this
    },

    /**
     * Add a heading.
     */
    addHeading(text: string, opts?: Partial<Omit<HeadingElement, 'type' | 'text' | 'level'>> & { level?: number }) {
      const level = (opts?.level ?? 1) as 1 | 2 | 3 | 4
      const { level: _, ...restOpts } = opts ?? {}
      content.push({ type: 'heading', level, text, ...restOpts })
      return this
    },

    /**
     * Add a table.
     */
    addTable(opts: Omit<TableElement, 'type'>): PdfBuilder {
      content.push({ type: 'table', ...opts })
      return this
    },

    /**
     * Add an image.
     */
    addImage(src: ImageElement['src'], opts?: Partial<Omit<ImageElement, 'type' | 'src'>>): PdfBuilder {
      content.push({ type: 'image', src, ...opts })
      return this
    },

    /**
     * Add a list (ordered or unordered).
     */
    addList(opts: Omit<ListElement, 'type'>): PdfBuilder {
      content.push({ type: 'list', ...opts })
      return this
    },

    /**
     * Add a code block.
     */
    addCode(text: string, opts: Omit<CodeBlockElement, 'type' | 'text'>): PdfBuilder {
      content.push({ type: 'code', text, ...opts })
      return this
    },

    /**
     * Add a rich paragraph with mixed formatting (bold, italic, color).
     */
    addRichText(spans: InlineSpan[], opts?: Partial<Omit<RichParagraphElement, 'type' | 'spans'>>): PdfBuilder {
      content.push({ type: 'rich-paragraph', spans, ...opts })
      return this
    },

    /**
     * Add a blockquote.
     */
    addBlockquote(text: string, opts?: Partial<Omit<BlockquoteElement, 'type' | 'text'>>): PdfBuilder {
      content.push({ type: 'blockquote', text, ...opts })
      return this
    },

    /**
     * Add a horizontal rule.
     */
    addHr(opts?: Partial<Omit<HorizontalRuleElement, 'type'>>): PdfBuilder {
      content.push({ type: 'hr', ...opts })
      return this
    },

    /**
     * Add a spacer (vertical whitespace).
     */
    addSpacer(height: number): PdfBuilder {
      content.push({ type: 'spacer', height })
      return this
    },

    /**
     * Add a page break.
     */
    addPageBreak(): PdfBuilder {
      content.push({ type: 'page-break' })
      return this
    },

    addSvg(svg: string, opts?: Partial<Omit<SvgElement, 'type' | 'svg'>>): PdfBuilder {
      content.push({ type: 'svg', svg, ...opts } as SvgElement)
      return this
    },

    addCallout(c: string, opts?: Partial<Omit<CalloutElement, 'type' | 'content'>>): PdfBuilder {
      content.push({ type: 'callout', content: c, ...opts } as CalloutElement)
      return this
    },

    addComment(contents: string, opts?: Partial<Omit<CommentElement, 'type' | 'contents'>>): PdfBuilder {
      content.push({ type: 'comment', contents, ...opts } as CommentElement)
      return this
    },

    addFormField(opts: Omit<FormFieldElement, 'type'>): PdfBuilder {
      content.push({ type: 'form-field', ...opts } as FormFieldElement)
      return this
    },

    addFootnoteDef(id: string, text: string, opts?: Partial<Omit<FootnoteDefElement, 'type' | 'id' | 'text'>>): PdfBuilder {
      content.push({ type: 'footnote-def', id, text, ...opts } as FootnoteDefElement)
      return this
    },

    addTableOfContents(opts?: Partial<Omit<TocElement, 'type'>>): PdfBuilder {
      content.push({ type: 'toc', ...opts } as TocElement)
      return this
    },

    defaultStyle(style: PdfDocument['defaultParagraphStyle']): PdfBuilder {
      defaultParagraphStyle = style
      return this
    },

    section(fromPage: number, toPage: number, overrides: { header?: HeaderFooterSpec; footer?: HeaderFooterSpec }): PdfBuilder {
      sections.push({ fromPage, toPage, ...overrides })
      return this
    },

    /**
     * Get the underlying declarative document.
     * Useful for inspection, serialization, or reusing with render().
     *
     * **Note:** Plugins are a rendering concern and are NOT included in the returned document.
     * If you pass this document to `render()` directly, supply plugins separately via
     * `RenderOptions.plugins`. Use `build()` if you want plugins applied automatically.
     */
    toDocument(): PdfDocument {
      const doc = {
        pageSize: options.pageSize,
        margins: options.margins,
        defaultFont: options.defaultFont,
        defaultFontSize: options.defaultFontSize,
        defaultLineHeight: options.defaultLineHeight,
        fonts: options.fonts,
        header: options.header,
        footer: options.footer,
        metadata: options.metadata,
        ...(defaultParagraphStyle !== undefined && { defaultParagraphStyle }),
        ...(sections.length > 0 && { sections }),
        content,
      } as PdfDocument
      return doc
    },

    /**
     * Build the PDF and return the bytes.
     */
    async build(): Promise<Uint8Array> {
      const doc = this.toDocument()
      const rawBytes = await runPipeline(doc, plugins !== undefined ? { plugins } : {})
      return applyPostProcessing(rawBytes, doc)
    },
  }
}
