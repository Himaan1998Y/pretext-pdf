import { computeSegmentLevels } from './bidi.js';
import { analyzeText, canContinueKeepAllTextRun, clearAnalysisCaches, endsWithClosingQuote, isCJK, isNumericRunSegment, kinsokuEnd, kinsokuStart, leftStickyPunctuation, setAnalysisLocale, } from './analysis.js';
import { clearMeasurementCaches, getCorrectedSegmentWidth, getSegmentBreakableFitAdvances, getEngineProfile, getFontMeasurementState, getSegmentMetrics, getSharedGraphemeSegmenter, textMayContainEmoji, } from './measurement.js';
import { countPreparedLines, measurePreparedLineGeometry, normalizeLineStart, stepPreparedLineGeometry, walkPreparedLinesRaw, } from './line-break.js';
import { buildLineTextFromRange, clearLineTextCaches, getLineTextCache, } from './line-text.js';
function createEmptyPrepared(includeSegments) {
    if (includeSegments) {
        return {
            widths: [],
            lineEndFitAdvances: [],
            lineEndPaintAdvances: [],
            kinds: [],
            simpleLineWalkFastPath: true,
            segLevels: null,
            breakableFitAdvances: [],
            letterSpacing: 0,
            spacingGraphemeCounts: [],
            discretionaryHyphenWidth: 0,
            tabStopAdvance: 0,
            chunks: [],
            chunkBySegment: null,
            segments: [],
        };
    }
    return {
        widths: [],
        lineEndFitAdvances: [],
        lineEndPaintAdvances: [],
        kinds: [],
        simpleLineWalkFastPath: true,
        segLevels: null,
        breakableFitAdvances: [],
        letterSpacing: 0,
        spacingGraphemeCounts: [],
        discretionaryHyphenWidth: 0,
        tabStopAdvance: 0,
        chunks: [],
        chunkBySegment: null,
    };
}
function buildBaseCjkUnits(segText, engineProfile) {
    const units = [];
    let unitParts = [];
    let unitStart = 0;
    let unitContainsCJK = false;
    let unitEndsWithClosingQuote = false;
    let unitIsSingleKinsokuEnd = false;
    function pushUnit() {
        if (unitParts.length === 0)
            return;
        units.push({
            text: unitParts.length === 1 ? unitParts[0] : unitParts.join(''),
            start: unitStart,
        });
        unitParts = [];
        unitContainsCJK = false;
        unitEndsWithClosingQuote = false;
        unitIsSingleKinsokuEnd = false;
    }
    function startUnit(grapheme, start, graphemeContainsCJK) {
        unitParts = [grapheme];
        unitStart = start;
        unitContainsCJK = graphemeContainsCJK;
        unitEndsWithClosingQuote = endsWithClosingQuote(grapheme);
        unitIsSingleKinsokuEnd = kinsokuEnd.has(grapheme);
    }
    function appendToUnit(grapheme, graphemeContainsCJK) {
        unitParts.push(grapheme);
        unitContainsCJK = unitContainsCJK || graphemeContainsCJK;
        const graphemeEndsWithClosingQuote = endsWithClosingQuote(grapheme);
        if (grapheme.length === 1 && leftStickyPunctuation.has(grapheme)) {
            unitEndsWithClosingQuote = unitEndsWithClosingQuote || graphemeEndsWithClosingQuote;
        }
        else {
            unitEndsWithClosingQuote = graphemeEndsWithClosingQuote;
        }
        unitIsSingleKinsokuEnd = false;
    }
    for (const gs of getSharedGraphemeSegmenter().segment(segText)) {
        const grapheme = gs.segment;
        const graphemeContainsCJK = isCJK(grapheme);
        if (unitParts.length === 0) {
            startUnit(grapheme, gs.index, graphemeContainsCJK);
            continue;
        }
        if (unitIsSingleKinsokuEnd ||
            kinsokuStart.has(grapheme) ||
            leftStickyPunctuation.has(grapheme) ||
            (engineProfile.carryCJKAfterClosingQuote &&
                graphemeContainsCJK &&
                unitEndsWithClosingQuote)) {
            appendToUnit(grapheme, graphemeContainsCJK);
            continue;
        }
        if (!unitContainsCJK && !graphemeContainsCJK) {
            appendToUnit(grapheme, graphemeContainsCJK);
            continue;
        }
        pushUnit();
        startUnit(grapheme, gs.index, graphemeContainsCJK);
    }
    pushUnit();
    return units;
}
function mergeKeepAllTextUnits(segText, units, breakAfterPunctuation) {
    if (units.length <= 1)
        return units;
    const merged = [];
    let groupStart = -1;
    let groupContainsCJK = false;
    function pushMergedUnit(start, end) {
        const sourceStart = units[start].start;
        const sourceEnd = end < units.length ? units[end].start : segText.length;
        merged.push({
            text: segText.slice(sourceStart, sourceEnd),
            start: sourceStart,
        });
    }
    function flushGroup(end) {
        if (groupStart < 0)
            return;
        if (groupContainsCJK) {
            if (groupStart + 1 === end) {
                merged.push(units[groupStart]);
            }
            else {
                pushMergedUnit(groupStart, end);
            }
        }
        else {
            for (let i = groupStart; i < end; i++)
                merged.push(units[i]);
        }
        groupStart = -1;
        groupContainsCJK = false;
    }
    for (let i = 0; i < units.length; i++) {
        const unit = units[i];
        if (groupStart >= 0 &&
            !canContinueKeepAllTextRun(units[i - 1].text, breakAfterPunctuation)) {
            flushGroup(i);
        }
        if (groupStart < 0)
            groupStart = i;
        groupContainsCJK = groupContainsCJK || isCJK(unit.text);
    }
    flushGroup(units.length);
    return merged;
}
function countRenderedSpacingGraphemes(text, kind) {
    if (kind === 'zero-width-break' ||
        kind === 'soft-hyphen' ||
        kind === 'hard-break') {
        return 0;
    }
    if (kind === 'tab')
        return 1;
    let count = 0;
    const graphemeSegmenter = getSharedGraphemeSegmenter();
    for (const _ of graphemeSegmenter.segment(text))
        count++;
    return count;
}
function addInternalLetterSpacing(width, graphemeCount, letterSpacing) {
    return graphemeCount > 1 ? width + (graphemeCount - 1) * letterSpacing : width;
}
function measureAnalysis(analysis, font, includeSegments, wordBreak, letterSpacing) {
    const engineProfile = getEngineProfile();
    const { cache, emojiCorrection } = getFontMeasurementState(font, textMayContainEmoji(analysis.normalized));
    const discretionaryHyphenWidth = getCorrectedSegmentWidth('-', getSegmentMetrics('-', cache), emojiCorrection) +
        (letterSpacing === 0 ? 0 : letterSpacing);
    const spaceWidth = getCorrectedSegmentWidth(' ', getSegmentMetrics(' ', cache), emojiCorrection);
    const tabStopAdvance = spaceWidth * 8;
    const hasLetterSpacing = letterSpacing !== 0;
    if (analysis.len === 0)
        return createEmptyPrepared(includeSegments);
    const widths = [];
    const lineEndFitAdvances = [];
    const lineEndPaintAdvances = [];
    const kinds = [];
    let simpleLineWalkFastPath = analysis.chunks.length <= 1 && !hasLetterSpacing;
    const segStarts = includeSegments ? [] : null;
    const breakableFitAdvances = [];
    const spacingGraphemeCounts = [];
    const segments = includeSegments ? [] : null;
    const preparedStartByAnalysisIndex = Array.from({ length: analysis.len });
    function pushMeasuredSegment(text, width, lineEndFitAdvance, lineEndPaintAdvance, kind, start, breakableFitAdvance, spacingGraphemeCount) {
        if (kind !== 'text' && kind !== 'space' && kind !== 'zero-width-break') {
            simpleLineWalkFastPath = false;
        }
        widths.push(width);
        lineEndFitAdvances.push(lineEndFitAdvance);
        lineEndPaintAdvances.push(lineEndPaintAdvance);
        kinds.push(kind);
        segStarts?.push(start);
        breakableFitAdvances.push(breakableFitAdvance);
        if (hasLetterSpacing)
            spacingGraphemeCounts.push(spacingGraphemeCount);
        if (segments !== null)
            segments.push(text);
    }
    function pushMeasuredTextSegment(text, kind, start, wordLike, allowOverflowBreaks) {
        const textMetrics = getSegmentMetrics(text, cache);
        const spacingGraphemeCount = hasLetterSpacing
            ? countRenderedSpacingGraphemes(text, kind)
            : 0;
        const width = addInternalLetterSpacing(getCorrectedSegmentWidth(text, textMetrics, emojiCorrection), spacingGraphemeCount, letterSpacing);
        const baseLineEndFitAdvance = kind === 'space' || kind === 'preserved-space' || kind === 'zero-width-break'
            ? 0
            : width;
        const lineEndFitAdvance = baseLineEndFitAdvance === 0
            ? 0
            : baseLineEndFitAdvance + (spacingGraphemeCount > 0 ? letterSpacing : 0);
        const lineEndPaintAdvance = kind === 'space' || kind === 'zero-width-break'
            ? 0
            : width;
        if (allowOverflowBreaks && wordLike && text.length > 1) {
            let fitMode = 'sum-graphemes';
            if (letterSpacing !== 0) {
                fitMode = 'segment-prefixes';
            }
            else if (isNumericRunSegment(text)) {
                fitMode = 'pair-context';
            }
            else if (engineProfile.preferPrefixWidthsForBreakableRuns) {
                fitMode = 'segment-prefixes';
            }
            const fitAdvances = getSegmentBreakableFitAdvances(text, textMetrics, cache, emojiCorrection, fitMode);
            pushMeasuredSegment(text, width, lineEndFitAdvance, lineEndPaintAdvance, kind, start, fitAdvances, spacingGraphemeCount);
            return;
        }
        pushMeasuredSegment(text, width, lineEndFitAdvance, lineEndPaintAdvance, kind, start, null, spacingGraphemeCount);
    }
    for (let mi = 0; mi < analysis.len; mi++) {
        preparedStartByAnalysisIndex[mi] = widths.length;
        const segText = analysis.texts[mi];
        const segWordLike = analysis.isWordLike[mi];
        const segKind = analysis.kinds[mi];
        const segStart = analysis.starts[mi];
        if (segKind === 'soft-hyphen') {
            pushMeasuredSegment(segText, 0, discretionaryHyphenWidth, discretionaryHyphenWidth, segKind, segStart, null, 0);
            continue;
        }
        if (segKind === 'hard-break') {
            pushMeasuredSegment(segText, 0, 0, 0, segKind, segStart, null, 0);
            continue;
        }
        if (segKind === 'tab') {
            pushMeasuredSegment(segText, 0, 0, 0, segKind, segStart, null, hasLetterSpacing ? countRenderedSpacingGraphemes(segText, segKind) : 0);
            continue;
        }
        const segMetrics = getSegmentMetrics(segText, cache);
        if (segKind === 'text' && segMetrics.containsCJK) {
            const baseUnits = buildBaseCjkUnits(segText, engineProfile);
            const measuredUnits = wordBreak === 'keep-all'
                ? mergeKeepAllTextUnits(segText, baseUnits, engineProfile.breakKeepAllAfterPunctuation)
                : baseUnits;
            for (let i = 0; i < measuredUnits.length; i++) {
                const unit = measuredUnits[i];
                pushMeasuredTextSegment(unit.text, 'text', segStart + unit.start, segWordLike, wordBreak === 'keep-all' || !isCJK(unit.text));
            }
            continue;
        }
        pushMeasuredTextSegment(segText, segKind, segStart, segWordLike, true);
    }
    const chunks = mapAnalysisChunksToPreparedChunks(analysis.chunks, preparedStartByAnalysisIndex, widths.length);
    const segLevels = segStarts === null ? null : computeSegmentLevels(analysis.normalized, segStarts);
    let chunkBySegment = null;
    if (includeSegments && chunks.length > 1) {
        chunkBySegment = new Uint32Array(widths.length);
        let c = 0;
        for (let i = 0; i < widths.length; i++) {
            while (c < chunks.length && i >= chunks[c].consumedEndSegmentIndex) {
                c++;
            }
            chunkBySegment[i] = c;
        }
    }
    if (segments !== null) {
        return {
            widths,
            lineEndFitAdvances,
            lineEndPaintAdvances,
            kinds,
            simpleLineWalkFastPath,
            segLevels,
            breakableFitAdvances,
            letterSpacing,
            spacingGraphemeCounts,
            discretionaryHyphenWidth,
            tabStopAdvance,
            chunks,
            chunkBySegment,
            segments,
        };
    }
    return {
        widths,
        lineEndFitAdvances,
        lineEndPaintAdvances,
        kinds,
        simpleLineWalkFastPath,
        segLevels,
        breakableFitAdvances,
        letterSpacing,
        spacingGraphemeCounts,
        discretionaryHyphenWidth,
        tabStopAdvance,
        chunks,
        chunkBySegment,
    };
}
function mapAnalysisChunksToPreparedChunks(chunks, preparedStartByAnalysisIndex, preparedEndSegmentIndex) {
    const preparedChunks = [];
    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const startSegmentIndex = chunk.startSegmentIndex < preparedStartByAnalysisIndex.length
            ? preparedStartByAnalysisIndex[chunk.startSegmentIndex]
            : preparedEndSegmentIndex;
        const endSegmentIndex = chunk.endSegmentIndex < preparedStartByAnalysisIndex.length
            ? preparedStartByAnalysisIndex[chunk.endSegmentIndex]
            : preparedEndSegmentIndex;
        const consumedEndSegmentIndex = chunk.consumedEndSegmentIndex < preparedStartByAnalysisIndex.length
            ? preparedStartByAnalysisIndex[chunk.consumedEndSegmentIndex]
            : preparedEndSegmentIndex;
        preparedChunks.push({
            startSegmentIndex,
            endSegmentIndex,
            consumedEndSegmentIndex,
        });
    }
    return preparedChunks;
}
function prepareInternal(text, font, includeSegments, options) {
    const wordBreak = options?.wordBreak ?? 'normal';
    const letterSpacing = options?.letterSpacing ?? 0;
    const analysis = analyzeText(text, getEngineProfile(), options?.whiteSpace, wordBreak);
    return measureAnalysis(analysis, font, includeSegments, wordBreak, letterSpacing);
}
export function prepare(text, font, options) {
    return prepareInternal(text, font, false, options);
}
export function prepareWithSegments(text, font, options) {
    return prepareInternal(text, font, true, options);
}
function getInternalPrepared(prepared) {
    return prepared;
}
export function layout(prepared, maxWidth, lineHeight) {
    const lineCount = countPreparedLines(getInternalPrepared(prepared), maxWidth);
    return { lineCount, height: lineCount * lineHeight };
}
function createLayoutLine(prepared, cache, width, startSegmentIndex, startGraphemeIndex, endSegmentIndex, endGraphemeIndex) {
    return {
        text: buildLineTextFromRange(prepared, cache, startSegmentIndex, startGraphemeIndex, endSegmentIndex, endGraphemeIndex),
        width,
        start: {
            segmentIndex: startSegmentIndex,
            graphemeIndex: startGraphemeIndex,
        },
        end: {
            segmentIndex: endSegmentIndex,
            graphemeIndex: endGraphemeIndex,
        },
    };
}
function createLayoutLineRange(width, startSegmentIndex, startGraphemeIndex, endSegmentIndex, endGraphemeIndex) {
    return {
        width,
        start: {
            segmentIndex: startSegmentIndex,
            graphemeIndex: startGraphemeIndex,
        },
        end: {
            segmentIndex: endSegmentIndex,
            graphemeIndex: endGraphemeIndex,
        },
    };
}
export function materializeLineRange(prepared, line) {
    return createLayoutLine(prepared, getLineTextCache(prepared), line.width, line.start.segmentIndex, line.start.graphemeIndex, line.end.segmentIndex, line.end.graphemeIndex);
}
export function walkLineRanges(prepared, maxWidth, onLine) {
    if (prepared.widths.length === 0)
        return 0;
    return walkPreparedLinesRaw(getInternalPrepared(prepared), maxWidth, (width, startSegmentIndex, startGraphemeIndex, endSegmentIndex, endGraphemeIndex) => {
        onLine(createLayoutLineRange(width, startSegmentIndex, startGraphemeIndex, endSegmentIndex, endGraphemeIndex));
    });
}
export function measureLineStats(prepared, maxWidth) {
    return measurePreparedLineGeometry(getInternalPrepared(prepared), maxWidth);
}
export function measureNaturalWidth(prepared) {
    let maxWidth = 0;
    walkPreparedLinesRaw(getInternalPrepared(prepared), Number.POSITIVE_INFINITY, width => {
        if (width > maxWidth)
            maxWidth = width;
    });
    return maxWidth;
}
export function layoutNextLine(prepared, start, maxWidth) {
    const internal = getInternalPrepared(prepared);
    const normalizedStart = normalizeLineStart(internal, start);
    if (normalizedStart === null)
        return null;
    const end = {
        segmentIndex: normalizedStart.segmentIndex,
        graphemeIndex: normalizedStart.graphemeIndex,
    };
    const width = stepPreparedLineGeometry(internal, end, maxWidth);
    if (width === null)
        return null;
    return createLayoutLine(prepared, getLineTextCache(prepared), width, normalizedStart.segmentIndex, normalizedStart.graphemeIndex, end.segmentIndex, end.graphemeIndex);
}
export function layoutNextLineRange(prepared, start, maxWidth) {
    const internal = getInternalPrepared(prepared);
    const normalizedStart = normalizeLineStart(internal, start);
    if (normalizedStart === null)
        return null;
    const end = {
        segmentIndex: normalizedStart.segmentIndex,
        graphemeIndex: normalizedStart.graphemeIndex,
    };
    const width = stepPreparedLineGeometry(internal, end, maxWidth);
    if (width === null)
        return null;
    return createLayoutLineRange(width, normalizedStart.segmentIndex, normalizedStart.graphemeIndex, end.segmentIndex, end.graphemeIndex);
}
export function layoutWithLines(prepared, maxWidth, lineHeight) {
    const lines = [];
    if (prepared.widths.length === 0)
        return { lineCount: 0, height: 0, lines };
    const graphemeCache = getLineTextCache(prepared);
    const lineCount = walkPreparedLinesRaw(getInternalPrepared(prepared), maxWidth, (width, startSegmentIndex, startGraphemeIndex, endSegmentIndex, endGraphemeIndex) => {
        lines.push(createLayoutLine(prepared, graphemeCache, width, startSegmentIndex, startGraphemeIndex, endSegmentIndex, endGraphemeIndex));
    });
    return { lineCount, height: lineCount * lineHeight, lines };
}
export function clearCache() {
    clearAnalysisCaches();
    clearLineTextCaches();
    clearMeasurementCaches();
}
export function setLocale(locale) {
    setAnalysisLocale(locale);
    clearCache();
}
//# sourceMappingURL=layout.js.map