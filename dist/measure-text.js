/**
 * measure-text.ts — Low-level text and font measurement primitives
 * No document-element knowledge. Used by all measurement modules.
 */
import { PretextPdfError } from './errors.js';
/** Lazily-loaded Pretext module — must be imported AFTER polyfill is installed */
let _pretext = null;
export async function getPretext() {
    if (!_pretext) {
        _pretext = await import('@chenglou/pretext');
    }
    return _pretext;
}
// ─── Hyphenation (Liang's algorithm via hypher package) ──────────────────────
export async function getHyphenator(language) {
    let dict;
    try {
        const mod = await import(`hyphenation.${language}`);
        dict = mod.default ?? mod; // dynamic import: ESM default or CJS module object
    }
    catch {
        throw new PretextPdfError('UNSUPPORTED_LANGUAGE', `Hyphenation dictionary for "${language}" not found. Install it with: pnpm add hyphenation.${language}`);
    }
    // @ts-ignore hypher has no type definitions available
    const { default: Hypher } = await import('hypher');
    return new Hypher(dict);
}
// ─── RTL Text Support (Unicode Bidirectional Algorithm via bidi-js) ────────────
/**
 * Detect text direction and apply Unicode Bidi Algorithm (TR9) for visual reordering.
 * Returns the visual-order text ready for measurement and rendering.
 */
export async function detectAndReorderRTL(text, dirOverride) {
    // Step 1: Explicit override takes priority
    if (dirOverride === 'ltr') {
        return { visual: text, isRTL: false, logical: text };
    }
    if (dirOverride === 'rtl') {
        try {
            // @ts-ignore bidi-js has no type definitions
            const bidiFactory = (await import('bidi-js')).default;
            const bidi = typeof bidiFactory === 'function' ? bidiFactory() : bidiFactory;
            const { getEmbeddingLevels, getReorderedString } = bidi;
            const embedLevelsResult = getEmbeddingLevels(text, 'rtl');
            const visual = getReorderedString(text, embedLevelsResult);
            return { visual, isRTL: true, logical: text };
        }
        catch (err) {
            console.error('[pretext-pdf] bidi-js RTL reordering failed — rendering logical order as fallback:', err);
            return { visual: text, isRTL: false, logical: text };
        }
    }
    // Step 2: Auto-detect dominant direction (full RTL block coverage, UAX #9)
    const rtlRanges = /[\u0590-\u08FF\uFB1D-\uFB4F\uFB50-\uFDFF\uFE70-\uFEFF\u{10800}-\u{10CFF}\u{10D00}-\u{10D3F}\u{10E80}-\u{10EFF}\u{10F30}-\u{10FFF}\u{1E800}-\u{1E95F}\u{1EC70}-\u{1ECBF}\u{1EE00}-\u{1EEFF}]/gu;
    const rtlCount = (text.match(rtlRanges) ?? []).length;
    const ltrCount = (text.match(/[a-zA-Z0-9]/g) ?? []).length;
    const isRTL = rtlCount > 0 && rtlCount >= ltrCount;
    if (!isRTL) {
        return { visual: text, isRTL: false, logical: text };
    }
    // Step 3: Apply bidi algorithm (TR9) to reorder visually
    try {
        // @ts-ignore bidi-js has no type definitions
        const bidiFactory = (await import('bidi-js')).default;
        const bidi = typeof bidiFactory === 'function' ? bidiFactory() : bidiFactory;
        const { getEmbeddingLevels, getReorderedString } = bidi;
        const embedLevelsResult = getEmbeddingLevels(text, 'rtl');
        const visual = getReorderedString(text, embedLevelsResult);
        return { visual, isRTL: true, logical: text };
    }
    catch (err) {
        console.warn('bidi-js error during RTL reordering:', err);
        return { visual: text, isRTL: false, logical: text };
    }
}
/**
 * Measure a single word's rendered width using pretext at maxWidth=99999.
 */
export async function measureWord(word, fontString) {
    const { prepareWithSegments, layoutWithLines } = await getPretext();
    if (!word)
        return 0;
    const prepared = prepareWithSegments(word, fontString, {});
    const result = layoutWithLines(prepared, 99999, 99999);
    const lines = result.lines ?? [];
    return lines[0]?.width ?? 0;
}
// ─── Core Text Measurement ────────────────────────────────────────────────────
/**
 * Measure unwrapped (single-line) text width using pretext at large maxWidth.
 * Handles multi-line text by returning the max width across all lines.
 */
export async function measureNaturalTextWidth(text, fontSize, fontFamily, fontWeight) {
    if (!text || text.trim() === '')
        return 0;
    const { prepareWithSegments, layoutWithLines } = await getPretext();
    const weightPrefix = fontWeight === 700 ? 'bold ' : '';
    const fontString = `${weightPrefix}${fontSize}px ${fontFamily}`;
    const prepared = prepareWithSegments(text, fontString, {});
    const result = layoutWithLines(prepared, 99999, 99999);
    const lines = result.lines ?? [];
    return Math.max(0, ...lines.map(l => l.width));
}
// ─── Script-Aware Tokenization ────────────────────────────────────────────────
/**
 * CJK Unified Ideographs and adjacent blocks that require character-level line breaking.
 * Each CJK character is its own break point — no spaces between them.
 * Covers: CJK Radicals, CJK Symbols, Hiragana, Katakana, Bopomofo, Hangul,
 *         CJK Unified Ideographs (4E00–9FFF), Extensions A–G, Compat Ideographs.
 * Unicode source: https://www.unicode.org/faq/han_unification.html
 */
const CJK_CHAR_RE = /[\u2E80-\u2FFF\u3000-\u9FFF\uA960-\uA97F\uAC00-\uD7FF\uF900-\uFAFF\uFE10-\uFE1F\uFE30-\uFE4F\uFF01-\uFF60\u{20000}-\u{3FFFD}]/u;
/** Thai (0E00–0E7F) and Lao (0E80–0EFF) — no spaces between words */
const THAI_LAO_RE = /[\u0E00-\u0EFF]/;
/**
 * Kinsoku line-start forbidden characters (JIS X 4051 subset).
 * These must never appear at the start of a line — they are pulled
 * back onto the previous line even if it causes a slight overflow.
 */
const KINSOKU_START_FORBIDDEN = new Set([
    '。', '．', '、', '，', '！', '？', // sentence/clause endings
    '）', '』', '」', '】', '〕', '〉', '》', // closing brackets
    '・', '：', '；', '…', '‥', // misc
    ')', ']', '}', // ASCII closers in CJK context
    '\uFF01', '\uFF09', '\uFF0C', '\uFF0E', // fullwidth ! ) , .
    '\uFF1A', '\uFF1B', '\uFF1F', // fullwidth : ; ?
    '\u30FB', // katakana middle dot
    '\u201E', // \u201E German low opening quote (PR #165)
]);
/**
 * Lazily-created segmenter for Thai/Lao. Intl.Segmenter is built into Node.js 16+.
 *
 * ICU data availability: Node.js ships with either "full-icu" or "small-icu" data.
 * Small-icu builds (common in CI/Docker) often lack Thai word-boundary data, causing
 * Intl.Segmenter('th') to either throw or produce single-segment output (no breaks).
 *
 * The smoke-test (segment 'สวัสดี' and check length > 1) detects the broken case:
 * - If ICU data is present: the segmenter returns multiple word segments → cached and used.
 * - If ICU data is absent: the segmenter returns one segment (the whole string) → falls back.
 *
 * Fallback behavior: character-level tokenization (one token per Thai codepoint).
 * This is acceptable because Thai has no spaces between words — character-level breaking
 * produces readable text that wraps at each character boundary. It's not linguistically
 * correct but is far better than a single overflowing line.
 *
 * To enable proper Thai segmentation in Node.js, use: node --icu-data-dir=<full-icu-path>
 * or install the `full-icu` npm package and set NODE_ICU_DATA.
 */
let _thaiSegmenter = null;
export function getThaiSegmenter() {
    if (_thaiSegmenter !== null)
        return _thaiSegmenter;
    try {
        // Check ICU data availability before caching
        const seg = new Intl.Segmenter('th', { granularity: 'word' });
        // Quick smoke-test — some Node builds lack Thai ICU data
        const test = [...seg.segment('สวัสดี')];
        if (test.length > 1) {
            _thaiSegmenter = seg;
            return seg;
        }
    }
    catch { /* fall through */ }
    _thaiSegmenter = null; // mark permanently unavailable so we don't retry
    return null;
}
/**
 * Insert zero-width spaces (U+200B) at Thai/Lao word boundaries so that
 * canvas/Skia can break lines at those points. Used by the non-hyphenation path.
 */
function insertThaiBreaks(text) {
    const seg = getThaiSegmenter();
    if (!seg)
        return text; // no ICU data — return unchanged; lines may overflow
    const result = [];
    let inThaiRun = false;
    // Process character by character, only segmenting Thai/Lao runs
    const parts = text.split(/([\u0E00-\u0EFF]+)/);
    for (const part of parts) {
        if (THAI_LAO_RE.test(part)) {
            const words = [];
            for (const { segment, isWordLike } of seg.segment(part)) {
                if (isWordLike !== false && segment.trim())
                    words.push(segment);
                else
                    words.push(segment);
            }
            result.push(words.join('\u200B'));
        }
        else {
            result.push(part);
        }
    }
    return result.join('');
}
/**
 * Tokenize a paragraph into wrapping units:
 * - CJK ideographs: one character per token, no space before consecutive CJK
 * - Thai/Lao: split by Intl.Segmenter word boundaries (falls back to char-level)
 * - Latin / other scripts: split on whitespace (standard behaviour)
 *
 * Preserves the original space intent: a token with spaceBefore=true contributes
 * one spaceWidth to the line width and one ' ' to the line text.
 */
function tokenizeParagraph(para) {
    const tokens = [];
    // Use spread to get proper Unicode scalar values (handles surrogate pairs)
    const chars = [...para];
    let i = 0;
    let pendingSpace = false; // whether the next non-space token has a space before it
    let lastWasCJK = false;
    while (i < chars.length) {
        const ch = chars[i];
        if (ch === ' ' || ch === '\t') {
            pendingSpace = true;
            lastWasCJK = false;
            i++;
            continue;
        }
        if (CJK_CHAR_RE.test(ch)) {
            // Between consecutive CJK chars there is no space — only honour a real
            // whitespace character that appeared between them in the source text.
            tokens.push({ text: ch, spaceBefore: pendingSpace && !lastWasCJK ? true : (pendingSpace && tokens.length > 0) });
            pendingSpace = false;
            lastWasCJK = true;
            i++;
            continue;
        }
        if (THAI_LAO_RE.test(ch)) {
            // Collect the contiguous Thai/Lao run, then segment it into words
            let run = '';
            while (i < chars.length && THAI_LAO_RE.test(chars[i])) {
                run += chars[i];
                i++;
            }
            const seg = getThaiSegmenter();
            let first = true;
            if (seg) {
                for (const { segment, isWordLike } of seg.segment(run)) {
                    if (segment.trim() === '')
                        continue;
                    if (isWordLike === false)
                        continue; // skip punctuation segments
                    tokens.push({ text: segment, spaceBefore: first ? pendingSpace : false });
                    first = false;
                }
            }
            else {
                // ICU not available: fall back to character-level (safe but not ideal)
                for (const c of [...run]) {
                    tokens.push({ text: c, spaceBefore: first ? pendingSpace : false });
                    first = false;
                }
            }
            pendingSpace = false;
            lastWasCJK = false;
            continue;
        }
        // Latin / other: collect until whitespace, CJK, or Thai/Lao
        let word = '';
        while (i < chars.length &&
            chars[i] !== ' ' && chars[i] !== '\t' &&
            !CJK_CHAR_RE.test(chars[i]) &&
            !THAI_LAO_RE.test(chars[i])) {
            word += chars[i];
            i++;
        }
        if (word) {
            tokens.push({ text: word, spaceBefore: pendingSpace && tokens.length > 0 });
            pendingSpace = false;
            lastWasCJK = false;
        }
    }
    return tokens;
}
// ─── Hyphenation + Script-Aware Line-Breaking ─────────────────────────────────
/**
 * Full hyphenation path: intelligently splits text into lines with Liang's algorithm.
 * Handles CJK (character-level breaks), Thai/Lao (Intl.Segmenter), and Latin (space + hyphens).
 * Returns lines with actual hyphens added to hyphenated words.
 */
export async function measureTextWithHyphenation(text, fontString, maxWidth, opts) {
    const { instance: hypher, minWordLength, leftMin, rightMin } = opts;
    const widthCache = new Map();
    const measure = async (w) => {
        if (widthCache.has(w))
            return widthCache.get(w);
        const width = await measureWord(w, fontString);
        widthCache.set(w, width);
        return width;
    };
    let spaceWidth = await measure(' ');
    if (spaceWidth === 0) {
        const aWidth = await measure('a');
        const aaWidth = await measure('a a');
        spaceWidth = aaWidth - 2 * aWidth;
        if (spaceWidth <= 0)
            spaceWidth = Math.max(1, aWidth * 0.3);
    }
    const allLines = [];
    for (const para of text.split('\n')) {
        if (!para.trim()) {
            allLines.push({ text: '', width: 0 });
            continue;
        }
        const tokens = tokenizeParagraph(para);
        // Pre-measure all unique token texts in parallel
        const unique = [...new Set(tokens.map(t => t.text))];
        await Promise.all(unique.map(w => measure(w)));
        const lines = [];
        let currentTokens = [];
        let currentWidth = 0;
        const flush = () => {
            if (currentTokens.length === 0)
                return;
            let lineText = '';
            for (const { text, spaceBefore } of currentTokens) {
                if (lineText.length > 0 && spaceBefore)
                    lineText += ' ';
                lineText += text;
            }
            const allCJK = currentTokens.every(t => CJK_CHAR_RE.test(t.text[0] ?? ''));
            const lineObj = { text: lineText, width: currentWidth };
            if (allCJK) {
                // @ts-ignore hint for renderer: CJK-only lines should not be stretched for justification
                lineObj.hasCJK = true;
            }
            lines.push(lineObj);
            currentTokens = [];
            currentWidth = 0;
        };
        for (const token of tokens) {
            const ww = widthCache.get(token.text);
            const gap = (token.spaceBefore && currentTokens.length > 0) ? spaceWidth : 0;
            const addW = gap + ww;
            if (currentWidth + addW <= maxWidth || currentTokens.length === 0) {
                currentTokens.push(token);
                currentWidth += addW;
                continue;
            }
            // CJK/Thai tokens never hyphenate — just break immediately
            const isCJKLike = CJK_CHAR_RE.test(token.text[0] ?? '') || THAI_LAO_RE.test(token.text[0] ?? '');
            if (isCJKLike || token.text.length < minWordLength) {
                // Kinsoku: if this token is start-forbidden, pull it onto the current line
                // (accept slight overflow) rather than letting it begin the next line.
                if (KINSOKU_START_FORBIDDEN.has(token.text)) {
                    currentTokens.push({ text: token.text, spaceBefore: false });
                    currentWidth += ww;
                    flush();
                }
                else {
                    flush();
                    currentTokens.push({ text: token.text, spaceBefore: false });
                    currentWidth = ww;
                }
                continue;
            }
            // Latin word — try hyphenation
            let hyphenated = false;
            const sylls = hypher.hyphenate(token.text);
            for (let split = sylls.length - 1; split >= 1; split--) {
                const prefix = sylls.slice(0, split).join('');
                const suffix = sylls.slice(split).join('');
                if (prefix.length < leftMin || suffix.length < rightMin)
                    continue;
                const hyphenPart = prefix + '-';
                const hw = await measure(hyphenPart);
                const addHW = (token.spaceBefore && currentTokens.length > 0 ? spaceWidth : 0) + hw;
                if (currentWidth + addHW <= maxWidth) {
                    currentTokens.push({ text: hyphenPart, spaceBefore: token.spaceBefore });
                    currentWidth += addHW;
                    flush();
                    await measure(suffix);
                    currentTokens = [{ text: suffix, spaceBefore: false }];
                    currentWidth = widthCache.get(suffix);
                    hyphenated = true;
                    break;
                }
            }
            if (!hyphenated) {
                // Kinsoku: if this token is start-forbidden, pull it onto the current line
                // (accept slight overflow) rather than letting it begin the next line.
                if (KINSOKU_START_FORBIDDEN.has(token.text)) {
                    currentTokens.push({ text: token.text, spaceBefore: false });
                    currentWidth += ww;
                    flush();
                    currentTokens = [];
                    currentWidth = 0;
                }
                else {
                    flush();
                    currentTokens = [{ text: token.text, spaceBefore: false }];
                    currentWidth = ww;
                }
            }
        }
        flush();
        allLines.push(...lines);
    }
    return allLines;
}
/**
 * Core text measurement: delegates to hyphenation path or direct Pretext layout.
 * If no hyphenator is available, falls back to direct layout (text wraps without hyphens).
 */
export async function measureText(text, fontSize, fontFamily, fontWeight, maxWidth, lineHeight, hyphenatorOpts) {
    if (!text || text.trim() === '')
        return [];
    const { prepareWithSegments, layoutWithLines } = await getPretext();
    const weightPrefix = fontWeight === 700 ? 'bold ' : '';
    const fontString = `${weightPrefix}${fontSize}px ${fontFamily}`;
    // If hyphenator is available and text is long, use hyphenation
    if (hyphenatorOpts && text.length > hyphenatorOpts.minWordLength) {
        return await measureTextWithHyphenation(text, fontString, maxWidth, hyphenatorOpts);
    }
    // Thai/Lao: Skia/canvas doesn't segment Thai — insert zero-width spaces at word
    // boundaries so pretext's line-breaker can split correctly.
    const needsThaiSeg = THAI_LAO_RE.test(text);
    const layoutText = needsThaiSeg ? insertThaiBreaks(text) : text;
    // No hyphenation: use direct pretext layout (handles CJK character-level breaks natively)
    const prepared = prepareWithSegments(layoutText, fontString, {});
    const result = layoutWithLines(prepared, maxWidth, 99999);
    // Strip zero-width spaces from output line texts (they're layout hints, not content)
    return (result.lines ?? []).map((l) => ({
        text: l.text.replace(/\u200B/g, ''),
        width: l.width,
    }));
}
//# sourceMappingURL=measure-text.js.map