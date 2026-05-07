import { isCJK } from './analysis.js';
let measureContext = null;
const segmentMetricCaches = new Map();
let cachedEngineProfile = null;
let lastContextFont = null;
const warnedFonts = new Set();
// Safari's prefix-fit policy is useful for ordinary word-sized runs, but letting
// it measure every growing prefix of a giant segment recreates a pathological
// superlinear prepare-time path. Past this size, switch to the cheaper
// pair-context model and keep the public behavior linear.
const MAX_PREFIX_FIT_GRAPHEMES = 96;
const emojiPresentationRe = /\p{Emoji_Presentation}/u;
const maybeEmojiRe = /[\p{Emoji_Presentation}\p{Extended_Pictographic}\p{Regional_Indicator}\uFE0F\u20E3]/u;
let sharedGraphemeSegmenter = null;
const emojiCorrectionCache = new Map();
export function getMeasureContext() {
    if (measureContext !== null)
        return measureContext;
    if (typeof OffscreenCanvas !== 'undefined') {
        measureContext = new OffscreenCanvas(1, 1).getContext('2d');
        return measureContext;
    }
    if (typeof document !== 'undefined') {
        measureContext = document.createElement('canvas').getContext('2d');
        return measureContext;
    }
    throw new Error('Text measurement requires OffscreenCanvas or a DOM canvas context.');
}
export function getSegmentMetricCache(font) {
    let cache = segmentMetricCaches.get(font);
    if (!cache) {
        cache = new Map();
        segmentMetricCaches.set(font, cache);
    }
    return cache;
}
export function getSegmentMetrics(seg, cache) {
    let metrics = cache.get(seg);
    if (metrics === undefined) {
        const ctx = getMeasureContext();
        metrics = {
            width: ctx.measureText(seg).width,
            containsCJK: isCJK(seg),
        };
        cache.set(seg, metrics);
    }
    return metrics;
}
export function getEngineProfile() {
    if (cachedEngineProfile !== null)
        return cachedEngineProfile;
    if (typeof navigator === 'undefined') {
        cachedEngineProfile = {
            lineFitEpsilon: 0.005,
            carryCJKAfterClosingQuote: false,
            breakKeepAllAfterPunctuation: true,
            preferPrefixWidthsForBreakableRuns: false,
            preferEarlySoftHyphenBreak: false,
        };
        return cachedEngineProfile;
    }
    const ua = navigator.userAgent;
    const vendor = navigator.vendor;
    const isSafari = vendor === 'Apple Computer, Inc.' &&
        ua.includes('Safari/') &&
        !ua.includes('Chrome/') &&
        !ua.includes('Chromium/') &&
        !ua.includes('CriOS/') &&
        !ua.includes('FxiOS/') &&
        !ua.includes('EdgiOS/');
    const isChromium = ua.includes('Chrome/') ||
        ua.includes('Chromium/') ||
        ua.includes('CriOS/') ||
        ua.includes('Edg/');
    cachedEngineProfile = {
        lineFitEpsilon: isSafari ? 1 / 64 : 0.005,
        carryCJKAfterClosingQuote: isChromium,
        breakKeepAllAfterPunctuation: !isSafari,
        preferPrefixWidthsForBreakableRuns: isSafari,
        preferEarlySoftHyphenBreak: isSafari,
    };
    return cachedEngineProfile;
}
export function parseFontSize(font) {
    const m = font.match(/(\d+(?:\.\d+)?)\s*px/);
    if (m)
        return parseFloat(m[1]);
    if (!warnedFonts.has(font) && typeof console !== 'undefined') {
        warnedFonts.add(font);
        console.warn('pretext: no px size in font "' + font + '"; emoji correction may be inaccurate');
    }
    return 16;
}
export function getSharedGraphemeSegmenter() {
    if (sharedGraphemeSegmenter === null) {
        sharedGraphemeSegmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    }
    return sharedGraphemeSegmenter;
}
function isEmojiGrapheme(g) {
    return emojiPresentationRe.test(g) || g.includes('\uFE0F');
}
export function textMayContainEmoji(text) {
    return maybeEmojiRe.test(text);
}
function getEmojiCorrection(font, fontSize) {
    const cached = emojiCorrectionCache.get(font);
    if (cached !== undefined)
        return cached;
    const ctx = getMeasureContext();
    if (lastContextFont !== font) {
        ctx.font = font;
        lastContextFont = font;
    }
    const canvasW = ctx.measureText('\u{1F600}').width;
    let correction = 0;
    const inflationDetected = canvasW > fontSize + 0.5;
    if (inflationDetected &&
        typeof document !== 'undefined' &&
        document.body !== null) {
        const span = document.createElement('span');
        span.style.font = font;
        span.style.display = 'inline-block';
        span.style.visibility = 'hidden';
        span.style.position = 'absolute';
        span.textContent = '\u{1F600}';
        document.body.appendChild(span);
        const domW = span.getBoundingClientRect().width;
        document.body.removeChild(span);
        if (canvasW - domW > 0.5) {
            correction = canvasW - domW;
        }
    }
    // Only cache if the comparison completed or no inflation was detected.
    // If body was null when inflation was detected, skip caching so we retry
    // once document.body becomes available.
    if (!inflationDetected || (typeof document !== 'undefined' && document.body !== null)) {
        emojiCorrectionCache.set(font, correction);
    }
    return correction;
}
function countEmojiGraphemes(text) {
    let count = 0;
    const graphemeSegmenter = getSharedGraphemeSegmenter();
    for (const g of graphemeSegmenter.segment(text)) {
        if (isEmojiGrapheme(g.segment))
            count++;
    }
    return count;
}
function getEmojiCount(seg, metrics) {
    if (metrics.emojiCount === undefined) {
        metrics.emojiCount = countEmojiGraphemes(seg);
    }
    return metrics.emojiCount;
}
export function getCorrectedSegmentWidth(seg, metrics, emojiCorrection) {
    if (emojiCorrection === 0)
        return metrics.width;
    return metrics.width - getEmojiCount(seg, metrics) * emojiCorrection;
}
export function getSegmentGraphemeWidths(seg, cache, emojiCorrection) {
    const widths = [];
    const graphemeSegmenter = getSharedGraphemeSegmenter();
    for (const gs of graphemeSegmenter.segment(seg)) {
        const graphemeMetrics = getSegmentMetrics(gs.segment, cache);
        widths.push(getCorrectedSegmentWidth(gs.segment, graphemeMetrics, emojiCorrection));
    }
    return widths.length > 1 ? widths : null;
}
export function getSegmentBreakableFitAdvances(seg, metrics, cache, emojiCorrection, mode) {
    const graphemeSegmenter = getSharedGraphemeSegmenter();
    const graphemes = [];
    for (const gs of graphemeSegmenter.segment(seg)) {
        graphemes.push(gs.segment);
    }
    const cacheMode = mode === 'segment-prefixes' && graphemes.length > MAX_PREFIX_FIT_GRAPHEMES
        ? 'pair-context'
        : mode;
    const cached = metrics.breakableFitAdvancesByMode?.[cacheMode];
    if (cached !== undefined) {
        return cached;
    }
    function cacheAdvances(advances) {
        const byMode = metrics.breakableFitAdvancesByMode ??= {};
        byMode[cacheMode] = advances;
        return advances;
    }
    if (graphemes.length <= 1) {
        return cacheAdvances(null);
    }
    if (cacheMode === 'sum-graphemes') {
        const advances = [];
        for (const grapheme of graphemes) {
            const graphemeMetrics = getSegmentMetrics(grapheme, cache);
            advances.push(getCorrectedSegmentWidth(grapheme, graphemeMetrics, emojiCorrection));
        }
        return cacheAdvances(advances);
    }
    if (cacheMode === 'pair-context') {
        const advances = [];
        let previousGrapheme = null;
        let previousWidth = 0;
        for (const grapheme of graphemes) {
            const graphemeMetrics = getSegmentMetrics(grapheme, cache);
            const currentWidth = getCorrectedSegmentWidth(grapheme, graphemeMetrics, emojiCorrection);
            if (previousGrapheme === null) {
                advances.push(currentWidth);
            }
            else {
                const pair = previousGrapheme + grapheme;
                const pairMetrics = getSegmentMetrics(pair, cache);
                advances.push(getCorrectedSegmentWidth(pair, pairMetrics, emojiCorrection) - previousWidth);
            }
            previousGrapheme = grapheme;
            previousWidth = currentWidth;
        }
        return cacheAdvances(advances);
    }
    const advances = [];
    let prefix = '';
    let prefixWidth = 0;
    for (const grapheme of graphemes) {
        prefix += grapheme;
        const prefixMetrics = getSegmentMetrics(prefix, cache);
        const nextPrefixWidth = getCorrectedSegmentWidth(prefix, prefixMetrics, emojiCorrection);
        advances.push(nextPrefixWidth - prefixWidth);
        prefixWidth = nextPrefixWidth;
    }
    return cacheAdvances(advances);
}
export function getFontMeasurementState(font, needsEmojiCorrection) {
    const ctx = getMeasureContext();
    if (lastContextFont !== font) {
        ctx.font = font;
        lastContextFont = font;
    }
    const cache = getSegmentMetricCache(font);
    const fontSize = parseFontSize(font);
    const emojiCorrection = needsEmojiCorrection ? getEmojiCorrection(font, fontSize) : 0;
    return { cache, fontSize, emojiCorrection };
}
export function clearMeasurementCaches() {
    segmentMetricCaches.clear();
    emojiCorrectionCache.clear();
    sharedGraphemeSegmenter = null;
    lastContextFont = null;
    warnedFonts.clear();
    cachedEngineProfile = null;
}
//# sourceMappingURL=measurement.js.map