import path from 'node:path';
import { PDFDocument } from '@cantoo/pdf-lib';
import { PretextPdfError } from './errors.js';
import { assertPathAllowed } from './assets.js';
/**
 * Apply PKCS#7 digital signature to pre-rendered PDF bytes.
 * Requires the @signpdf/signpdf peer dependency.
 */
export async function applySignature(pdfBytes, sig, allowedFileDirs) {
    let signpdfMod;
    try {
        signpdfMod = await import('@signpdf/signpdf');
    }
    catch {
        throw new PretextPdfError('SIGNATURE_DEP_MISSING', 'Cryptographic signing requires the @signpdf/signpdf package. Install it: npm install @signpdf/signpdf');
    }
    const { SignPdf, pdflibAddPlaceholder } = signpdfMod;
    let p12Buffer;
    try {
        if (sig.p12 instanceof Uint8Array) {
            p12Buffer = Buffer.from(sig.p12);
        }
        else {
            const p12Path = sig.p12;
            if (!path.isAbsolute(p12Path)) {
                throw new PretextPdfError('SIGNATURE_P12_LOAD_FAILED', 'P12 path must be absolute');
            }
            const resolvedPath = path.resolve(p12Path);
            assertPathAllowed(resolvedPath, allowedFileDirs, 'P12 certificate');
            const { promises: fs } = await import('node:fs');
            p12Buffer = await fs.readFile(resolvedPath);
        }
    }
    catch (e) {
        if (e instanceof PretextPdfError)
            throw e;
        throw new PretextPdfError('SIGNATURE_P12_LOAD_FAILED', 'Failed to load P12 certificate');
    }
    const pdfDoc = await PDFDocument.load(pdfBytes);
    pdflibAddPlaceholder({
        pdfDoc,
        reason: sig.reason ?? 'Signed',
        contactInfo: sig.contactInfo ?? '',
        name: sig.signerName ?? '',
        location: sig.location ?? '',
    });
    const pdfWithPlaceholder = await pdfDoc.save({ useObjectStreams: false });
    const signer = new SignPdf();
    let signedBuffer;
    try {
        signedBuffer = await signer.sign(Buffer.from(pdfWithPlaceholder), p12Buffer, sig.passphrase !== undefined ? { passphrase: sig.passphrase } : undefined);
    }
    catch (e) {
        throw new PretextPdfError('SIGNATURE_FAILED', `PDF signing failed: ${e instanceof Error ? e.message : String(e)}`);
    }
    return new Uint8Array(signedBuffer);
}
/**
 * Apply AES-128 or AES-256 encryption to pre-rendered PDF bytes.
 */
export async function applyEncryption(pdfBytes, enc) {
    const encDoc = await PDFDocument.load(pdfBytes);
    encDoc.encrypt({
        userPassword: enc.userPassword ?? '',
        ownerPassword: enc.ownerPassword ?? (await import('node:crypto')).randomUUID(),
        permissions: {
            printing: enc.permissions?.printing ?? true,
            copying: enc.permissions?.copying ?? true,
            modifying: enc.permissions?.modifying ?? false,
            annotating: enc.permissions?.annotating ?? true,
        },
    });
    return encDoc.save({ useObjectStreams: false });
}
/**
 * Apply signature and encryption post-processing to raw pipeline bytes.
 * Called by both render() in index.ts and PdfBuilder.build() in builder.ts.
 */
export async function applyPostProcessing(rawBytes, doc) {
    const signedBytes = doc.signature?.p12 ? await applySignature(rawBytes, doc.signature, doc.allowedFileDirs) : rawBytes;
    return doc.encryption ? await applyEncryption(signedBytes, doc.encryption) : signedBytes;
}
//# sourceMappingURL=post-process.js.map