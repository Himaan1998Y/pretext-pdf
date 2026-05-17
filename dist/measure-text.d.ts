/**
 * measure-text.ts — Low-level text and font measurement primitives
 * No document-element knowledge. Used by all measurement modules.
 */
export declare function setBidiWarnFn(fn: (msg: string) => void): void;
export type HyphenatorOpts = {
    instance: HypherInstance;
    minWordLength: number;
    leftMin: number;
    rightMin: number;
};
/** Maximum entries retained in a wordWidthCache before FIFO eviction kicks in. */
export declare const WORD_WIDTH_CACHE_MAX = 50000;
type HypherInstance = {
    hyphenate(word: string): string[];
};
export declare function getPretext(): Promise<typeof import("./vendor/pretext/layout.js")>;
export declare function getHyphenator(language: string): Promise<HypherInstance>;
/**
 * Pure auto-detection of dominant text direction. Returns true if RTL characters
 * are present and at least as numerous as ASCII LTR characters.
 */
export declare function autoDetectRTL(text: string): boolean;
/**
 * Resolve effective text direction. Explicit `ltr` / `rtl` always wins —
 * auto-detect never runs for explicit overrides.
 *
 * Bug fix (B3): previously the auto-detect path could silently flip an
 * explicitly-set `dir: 'rtl'` paragraph back to LTR when its text happened to
 * be ASCII-only (e.g. a romanized RTL placeholder or a translation tag).
 * Routing explicit dir through this helper makes the override authoritative.
 */
export declare function determineDirection(text: string, explicitDir?: 'ltr' | 'rtl' | 'auto'): boolean;
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
export declare function measureWord(word: string, fontString: string, cache?: Map<string, number>): Promise<number>;
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
export declare function measureTextWithHyphenation(text: string, fontString: string, maxWidth: number, opts: HyphenatorOpts, docWordCache?: Map<string, number>): Promise<Array<{
    text: string;
    width: number;
}>>;
/**
 * Core text measurement: delegates to hyphenation path or direct Pretext layout.
 * If no hyphenator is available, falls back to direct layout (text wraps without hyphens).
 */
export declare function measureText(text: string, fontSize: number, fontFamily: string, fontWeight: 400 | 700, maxWidth: number, lineHeight: number, hyphenatorOpts?: HyphenatorOpts, wordWidthCache?: Map<string, number>): Promise<Array<{
    text: string;
    width: number;
}>>;
export {};
//# sourceMappingURL=measure-text.d.ts.map