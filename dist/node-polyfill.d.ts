/**
 * Installs @napi-rs/canvas as OffscreenCanvas for Node.js environments.
 * Must be called before any Pretext import resolves its canvas context.
 * Safe to call multiple times — only installs once.
 */
export declare function installNodePolyfill(): Promise<void>;
//# sourceMappingURL=node-polyfill.d.ts.map