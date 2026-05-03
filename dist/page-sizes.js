/**
 * Shared page size resolution — single source of truth.
 * Used by both index.ts (render) and validate.ts (margin validation).
 * Adding a new size here automatically works in both places.
 */
/** All named page sizes in [width, height] points (72pt = 1 inch) */
const PAGE_SIZES = {
    'A4': [595, 842], // 210 × 297 mm
    'Letter': [612, 792], // 8.5 × 11 in
    'Legal': [612, 1008], // 8.5 × 14 in
    'A3': [842, 1191], // 297 × 420 mm
    'A5': [420, 595], // 148 × 210 mm
    'Tabloid': [792, 1224], // 11 × 17 in
};
/**
 * Resolve any page size input to [width, height] in points.
 * Default: A4 (595 × 842 pt)
 */
export function resolvePageDimensions(pageSize) {
    if (Array.isArray(pageSize))
        return [pageSize[0], pageSize[1]];
    return PAGE_SIZES[pageSize ?? 'A4'] ?? PAGE_SIZES['A4'];
}
//# sourceMappingURL=page-sizes.js.map