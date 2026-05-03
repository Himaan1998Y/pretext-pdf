import type { InlineSpan, RichLine, PdfDocument } from './types.js';
/**
 * Compose mixed-format spans into laid-out RichLine[] for rendering.
 *
 * Algorithm:
 * 1. Tokenize all spans into (word, fontConfig) pairs — split on whitespace boundaries
 * 2. Measure each token's width using Pretext
 * 3. Greedily pack tokens onto lines respecting contentWidth
 * 4. Apply alignment offsets
 *
 * Restriction: all spans must use the same fontSize (enforced by validate.ts).
 */
export declare function measureRichText(spans: InlineSpan[], fontSize: number, lineHeight: number, contentWidth: number, align: 'left' | 'center' | 'right', doc: PdfDocument): Promise<RichLine[]>;
//# sourceMappingURL=rich-text.d.ts.map