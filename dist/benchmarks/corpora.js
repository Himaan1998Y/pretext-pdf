function baseDoc(content, overrides = {}) {
    return {
        pageSize: 'A4',
        margins: { top: 56, bottom: 56, left: 56, right: 56 },
        defaultFontSize: 11,
        content,
        ...overrides,
    };
}
function richTextMixedSpans() {
    return baseDoc([
        { type: 'heading', level: 1, text: 'Rich Text Stress' },
        {
            type: 'rich-paragraph',
            spans: [
                { text: 'The ', },
                { text: 'quick', fontWeight: 700 },
                { text: ' brown ', color: '#555555' },
                { text: 'fox', underline: true },
                { text: ' jumps over the lazy dog, then repeats the same styled fragments to exercise packing and wrapping.' },
            ],
            spaceAfter: 10,
        },
        {
            type: 'rich-paragraph',
            spans: [
                { text: 'Bold ', fontWeight: 700 },
                { text: 'colored ', color: '#d97706' },
                { text: 'linked', href: 'https://example.com', underline: true, color: '#2563eb' },
                { text: ' text with repeated spans across a longer line to stress the compositor.' },
            ],
        },
    ]);
}
function tableStress() {
    const rows = [
        {
            isHeader: true,
            cells: [
                { text: 'Item', fontWeight: 700 },
                { text: 'Category', fontWeight: 700 },
                { text: 'Qty', fontWeight: 700, align: 'right' },
                { text: 'Amount', fontWeight: 700, align: 'right' },
            ],
        },
        ...Array.from({ length: 14 }, (_, i) => ({
            cells: [
                { text: `Line item ${i + 1} with longer text that may wrap` },
                { text: i % 2 === 0 ? 'Services' : 'Hosting' },
                { text: String(i + 1), align: 'right' },
                { text: `₹${(i + 1) * 1250}`, align: 'right' },
            ],
        })),
    ];
    return baseDoc([
        { type: 'heading', level: 1, text: 'Table Stress' },
        { type: 'paragraph', text: 'A table corpus for repeated headers, mixed alignment, and row height pressure.' },
        {
            type: 'table',
            columns: [
                { width: '3*', align: 'left' },
                { width: '2*', align: 'left' },
                { width: 60, align: 'right' },
                { width: 90, align: 'right' },
            ],
            rows,
            headerBgColor: '#1a1a2e',
            borderColor: '#d8d8d8',
            borderWidth: 0.5,
            cellPaddingH: 8,
            cellPaddingV: 6,
        },
    ]);
}
function cjkLayout() {
    return baseDoc([
        { type: 'heading', level: 1, text: 'CJK Layout' },
        {
            type: 'paragraph',
            text: '中文排版需要稳定的换行和宽度测量。これは日本語の段落であり、文字の流れと改行の安定性を確認します。',
            lineHeight: 16,
        },
        {
            type: 'paragraph',
            text: '韩国어와 中文 mixed text helps expose whether width-based wrapping stays predictable across scripts.',
            lineHeight: 16,
        },
    ]);
}
function rtlLayout() {
    return baseDoc([
        { type: 'heading', level: 1, text: 'RTL Layout', dir: 'rtl' },
        {
            type: 'paragraph',
            text: 'هذا نص عربي لاختبار التدفق من اليمين إلى اليسار والتحقق من أن القياس لا يكسر الترتيب البصري.',
            dir: 'rtl',
            align: 'right',
            lineHeight: 16,
        },
        {
            type: 'paragraph',
            text: 'עברית משולבת עם English text to verify mixed-script wrapping and alignment across directions.',
            dir: 'rtl',
            align: 'right',
            lineHeight: 16,
        },
    ]);
}
function punctuationHeavy() {
    return baseDoc([
        { type: 'heading', level: 1, text: 'Punctuation Heavy' },
        {
            type: 'paragraph',
            text: 'Quotes, commas, semicolons, parentheses (lots of them), em-dashes — and ellipses... should not cause layout surprises.',
        },
        {
            type: 'paragraph',
            text: '"Repeated punctuation!!!" "Repeated punctuation!!!" "Repeated punctuation!!!" stresses line breaking and token reuse.',
        },
    ]);
}
function invoiceShowcase() {
    return baseDoc([
        { type: 'heading', level: 1, text: 'Invoice Showcase' },
        { type: 'paragraph', text: 'A compact business document corpus for pricing, tables, and totals.' },
        {
            type: 'table',
            columns: [
                { width: '3*', align: 'left' },
                { width: 60, align: 'right' },
                { width: 80, align: 'right' },
                { width: 90, align: 'right' },
            ],
            rows: [
                {
                    isHeader: true,
                    cells: [
                        { text: 'Description', fontWeight: 700 },
                        { text: 'Qty', fontWeight: 700 },
                        { text: 'Rate', fontWeight: 700 },
                        { text: 'Amount', fontWeight: 700 },
                    ],
                },
                { cells: [{ text: 'Consulting services' }, { text: '10', align: 'right' }, { text: '₹5,000', align: 'right' }, { text: '₹50,000', align: 'right' }] },
                { cells: [{ text: 'Travel expenses' }, { text: '1', align: 'right' }, { text: '₹12,000', align: 'right' }, { text: '₹12,000', align: 'right' }] },
                { cells: [{ text: 'Total', fontWeight: 700 }, { text: '' }, { text: '', align: 'right' }, { text: '₹62,000', align: 'right', fontWeight: 700 }] },
            ],
            headerBgColor: '#1a1a2e',
            borderColor: '#d8d8d8',
        },
    ]);
}
function reportShowcase() {
    return baseDoc([
        { type: 'heading', level: 1, text: 'Market Report Showcase' },
        { type: 'paragraph', text: 'A compact report corpus for multi-section pagination, TOC, and mixed content.' },
        { type: 'toc', title: 'Contents', showTitle: true, minLevel: 1, maxLevel: 2 },
        { type: 'page-break' },
        { type: 'heading', level: 1, text: 'Executive Summary' },
        { type: 'paragraph', text: 'The market expanded in the first quarter, with the strongest growth in the premium segment.' },
        { type: 'heading', level: 1, text: 'Market Drivers' },
        { type: 'paragraph', text: 'Infrastructure, financing, and buyer confidence all contributed to the upward trend.' },
        {
            type: 'callout',
            style: 'warning',
            content: 'A rate increase above the current corridor would likely slow demand growth.',
        },
    ], {
        header: { text: 'Benchmark Report', align: 'right', fontSize: 8, color: '#999999' },
        footer: { text: 'Page {{pageNumber}} of {{totalPages}}', align: 'center', fontSize: 8, color: '#999999' },
        bookmarks: { minLevel: 1, maxLevel: 2 },
    });
}
export const BENCHMARK_CORPORA = [
    {
        id: 'rich-text-mixed-spans',
        category: 'rich-text',
        title: 'Rich text mixed spans',
        description: 'Mixed formatting, repeated styled fragments, and inline links.',
        document: richTextMixedSpans,
    },
    {
        id: 'table-stress',
        category: 'tables',
        title: 'Table stress',
        description: 'Repeated headers, mixed alignment, and rows that push pagination.',
        document: tableStress,
    },
    {
        id: 'cjk-layout',
        category: 'hard-text',
        title: 'CJK layout',
        description: 'Chinese and Japanese text wrapping with width-sensitive line layout.',
        document: cjkLayout,
    },
    {
        id: 'rtl-layout',
        category: 'hard-text',
        title: 'RTL layout',
        description: 'Arabic and Hebrew layout with mixed script handling.',
        document: rtlLayout,
    },
    {
        id: 'punctuation-heavy',
        category: 'hard-text',
        title: 'Punctuation heavy',
        description: 'Long punctuation runs and repeated quoted phrases.',
        document: punctuationHeavy,
    },
    {
        id: 'invoice-showcase',
        category: 'documents',
        title: 'Invoice showcase',
        description: 'Compact business invoice shape with totals and a data table.',
        document: invoiceShowcase,
    },
    {
        id: 'report-showcase',
        category: 'documents',
        title: 'Report showcase',
        description: 'Multi-section report with TOC, headers, footer, and callout.',
        document: reportShowcase,
    },
];
export function getBenchmarkCorpora() {
    return BENCHMARK_CORPORA;
}
//# sourceMappingURL=corpora.js.map