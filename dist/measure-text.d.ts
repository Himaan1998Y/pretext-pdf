/**
 * measure-text.ts — Low-level text and font measurement primitives
 * No document-element knowledge. Used by all measurement modules.
 */
export type HyphenatorOpts = {
    instance: HypherInstance;
    minWordLength: number;
    leftMin: number;
    rightMin: number;
};
type HypherInstance = {
    hyphenate(word: string): string[];
};
export declare function getPretext(): Promise<typeof import("./vendor/pretext/layout.js")>;
export declare function getHyphenator(language: string): Promise<HypherInstance>;
/**
 * Detect text direction and apply Unicode Bidi Algorithm (TR9) for visual reordering.
 * Returns the visual-order text ready for measurement and rendering.
 */
export declare function detectAndReorderRTL(text: string, dirOverride?: 'ltr' | 'rtl' | 'auto'): Promise<{
    visual: string;
    isRTL: boolean;
    logical: string;
}>;
/**
 * Measure a single word's rendered width using pretext at maxWidth=99999.
 */
export declare function measureWord(word: string, fontString: string): Promise<number>;
/**
 * Measure unwrapped (single-line) text width using pretext at large maxWidth.
 * Handles multi-line text by returning the max width across all lines.
 */
export declare function measureNaturalTextWidth(text: string, fontSize: number, fontFamily: string, fontWeight: 400 | 700): Promise<number>;
export declare function getThaiSegmenter(): Intl.Segmenter | null;
/**
 * Full hyphenation path: intelligently splits text into lines with Liang's algorithm.
 * Handles CJK (character-level breaks), Thai/Lao (Intl.Segmenter), and Latin (space + hyphens).
 * Returns lines with actual hyphens added to hyphenated words.
 */
export declare function measureTextWithHyphenation(text: string, fontString: string, maxWidth: number, opts: HyphenatorOpts): Promise<Array<{
    text: string;
    width: number;
}>>;
/**
 * Core text measurement: delegates to hyphenation path or direct Pretext layout.
 * If no hyphenator is available, falls back to direct layout (text wraps without hyphens).
 */
export declare function measureText(text: string, fontSize: number, fontFamily: string, fontWeight: 400 | 700, maxWidth: number, lineHeight: number, hyphenatorOpts?: HyphenatorOpts): Promise<Array<{
    text: string;
    width: number;
}>>;
export {};
//# sourceMappingURL=measure-text.d.ts.map