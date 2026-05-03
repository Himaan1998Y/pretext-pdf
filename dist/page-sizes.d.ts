/**
 * Shared page size resolution — single source of truth.
 * Used by both index.ts (render) and validate.ts (margin validation).
 * Adding a new size here automatically works in both places.
 */
/** @public */
export type NamedPageSize = 'A4' | 'Letter' | 'Legal' | 'A3' | 'A5' | 'Tabloid';
export type PageSizeInput = NamedPageSize | [number, number] | undefined;
/**
 * Resolve any page size input to [width, height] in points.
 * Default: A4 (595 × 842 pt)
 */
export declare function resolvePageDimensions(pageSize: PageSizeInput): [number, number];
//# sourceMappingURL=page-sizes.d.ts.map