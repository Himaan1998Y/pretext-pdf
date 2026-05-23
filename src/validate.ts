/**
 * src/validate.ts — legacy shim, re-exports the new validate/ module.
 *
 * Original (1834L) was split into validate/{index,helpers,fonts,errors}.ts +
 * validate/elements/* in v1.4.0 #11a. This shim exists for one release so
 * external callers importing from 'pretext-pdf/dist/validate.js' (or the
 * source path) continue to work; it will be deleted in step 3 of the split.
 */
export * from './validate/index.js'
