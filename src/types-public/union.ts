/**
 * pretext-pdf — Discriminated union of every public content element.
 *
 * This module imports element types from elements-text, elements-block,
 * and elements-media. Those modules MUST NOT import from this file, to
 * keep the dependency graph one-directional.
 */
import type {
  ParagraphElement,
  HeadingElement,
  RichParagraphElement,
  BlockquoteElement,
  CalloutElement,
  CodeBlockElement,
} from './elements-text.js'
import type {
  SpacerElement,
  TableElement,
  ListElement,
  HorizontalRuleElement,
  PageBreakElement,
  TocElement,
  FootnoteDefElement,
  CommentElement,
  FormFieldElement,
} from './elements-block.js'
import type {
  ImageElement,
  SvgElement,
  QrCodeElement,
  BarcodeElement,
  ChartElement,
  FloatGroupElement,
} from './elements-media.js'

/** @public */
export type ContentElement =
  | ParagraphElement
  | HeadingElement
  | SpacerElement
  | TableElement
  | ImageElement
  | SvgElement
  | QrCodeElement
  | BarcodeElement
  | ChartElement
  | ListElement
  | HorizontalRuleElement
  | PageBreakElement
  | CodeBlockElement
  | RichParagraphElement
  | BlockquoteElement
  | TocElement
  | CommentElement
  | FormFieldElement
  | CalloutElement
  | FootnoteDefElement
  | FloatGroupElement
