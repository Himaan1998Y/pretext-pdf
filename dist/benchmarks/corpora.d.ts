import type { PdfDocument } from '../types.js';
export interface BenchmarkCorpus {
    id: string;
    category: 'rich-text' | 'tables' | 'hard-text' | 'documents';
    title: string;
    description: string;
    document: () => PdfDocument;
}
export declare const BENCHMARK_CORPORA: BenchmarkCorpus[];
export declare function getBenchmarkCorpora(): BenchmarkCorpus[];
//# sourceMappingURL=corpora.d.ts.map