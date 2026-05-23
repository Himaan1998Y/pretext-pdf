/**
 * validate/elements/structural.ts — Re-export shim.
 *
 * The structural validators were split in v1.5.0 (B) into structural-simple.ts
 * (spacer, hr, toc, toc-entry, comment) and forms-floats.ts (form-field,
 * footnote-def, float-group). This file remains briefly as a compatibility
 * shim for any out-of-tree consumer; the in-tree dispatcher imports the new
 * modules directly. To be removed in B step 3.
 */
export * from './structural-simple.js'
export * from './forms-floats.js'
