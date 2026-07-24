import path from 'node:path'
import { PDFDocument } from '@cantoo/pdf-lib'
import type { PdfDocument } from '../types-public/index.js'
import { PretextPdfError } from '../errors.js'
import { assertPathAllowed } from '../assets.js'

/**
 * Apply PKCS#7 digital signature to pre-rendered PDF bytes.
 * Requires the @signpdf/signpdf peer dependency.
 */
export async function applySignature(
  pdfBytes: Uint8Array,
  sig: NonNullable<PdfDocument['signature']>,
  allowedFileDirs?: string[]
): Promise<Uint8Array> {
  /** Minimal interface for the @signpdf/signpdf SignPdf class. */
  type SignPdfInstance = { sign(pdfBuffer: Buffer, signer: object): Promise<Buffer> }
  type SignpdfModule = { SignPdf: new () => SignPdfInstance }
  type PlaceholderModule = {
    pdflibAddPlaceholder: (opts: { pdfDoc: import('pdf-lib').PDFDocument; reason?: string; location?: string; contactInfo?: string; name?: string }) => void
  }
  type SignerP12Module = {
    P12Signer: new (p12Buffer: Buffer | Uint8Array, options?: { passphrase?: string; asn1StrictParsing?: boolean }) => object
  }
  type PdfLibModule = {
    PDFDocument: typeof import('pdf-lib').PDFDocument
  }
  let signpdfMod: SignpdfModule
  let placeholderMod: PlaceholderModule
  let signerP12Mod: SignerP12Module
  let pdfLibMod: PdfLibModule
  // NOTE: upstream `pdf-lib` (not @cantoo/pdf-lib) is used here for the
  // placeholder hop only. @signpdf/placeholder-pdf-lib builds its placeholder
  // objects with upstream pdf-lib classes (see pdflibAddPlaceholder.js), so
  // the doc fed into it must be loaded with the matching pdf-lib variant to
  // produce a serializer-compatible /ByteRange dictionary. Encryption stays
  // on @cantoo/pdf-lib in applyEncryption — the two paths are mutually
  // exclusive via the SIGNATURE_CERT_AND_ENCRYPTION guard.
  const signpdfPackages = [
    { name: '@signpdf/signpdf', load: () => import('@signpdf/signpdf' as string) },
    { name: '@signpdf/placeholder-pdf-lib', load: () => import('@signpdf/placeholder-pdf-lib' as string) },
    { name: '@signpdf/signer-p12', load: () => import('@signpdf/signer-p12' as string) },
    { name: 'pdf-lib', load: () => import('pdf-lib' as string) },
  ] as const
  const missing: string[] = []
  const loaded: Record<string, unknown> = {}
  for (const pkg of signpdfPackages) {
    try {
      loaded[pkg.name] = await pkg.load()
    } catch {
      missing.push(pkg.name)
    }
  }
  if (missing.length > 0) {
    throw new PretextPdfError(
      'SIGNATURE_DEP_MISSING',
      `Cryptographic signing requires the @signpdf/signpdf, @signpdf/placeholder-pdf-lib, @signpdf/signer-p12, and pdf-lib packages. Missing: ${missing.join(', ')}. Install: npm install ${missing.join(' ')}.`
    )
  }
  signpdfMod = loaded['@signpdf/signpdf'] as SignpdfModule
  placeholderMod = loaded['@signpdf/placeholder-pdf-lib'] as PlaceholderModule
  signerP12Mod = loaded['@signpdf/signer-p12'] as SignerP12Module
  pdfLibMod = loaded['pdf-lib'] as PdfLibModule

  const { SignPdf }: { SignPdf: new () => SignPdfInstance } = signpdfMod
  const { pdflibAddPlaceholder } = placeholderMod
  const { P12Signer }: { P12Signer: new (p12Buffer: Buffer | Uint8Array, options?: { passphrase?: string; asn1StrictParsing?: boolean }) => object } = signerP12Mod

  let p12Buffer: Buffer
  try {
    if (sig.p12 instanceof Uint8Array) {
      p12Buffer = Buffer.from(sig.p12)
    } else {
      const p12Path = sig.p12 as string
      if (!path.isAbsolute(p12Path)) {
        throw new PretextPdfError('SIGNATURE_P12_LOAD_FAILED', 'P12 path must be absolute')
      }
      const resolvedPath = path.resolve(p12Path)
      assertPathAllowed(resolvedPath, allowedFileDirs, 'P12 certificate')
      const { promises: fs } = await import('node:fs')
      p12Buffer = await fs.readFile(resolvedPath)
    }
  } catch (e) {
    if (e instanceof PretextPdfError) throw e
    throw new PretextPdfError('SIGNATURE_P12_LOAD_FAILED', 'Failed to load P12 certificate')
  }

  // @signpdf/placeholder-pdf-lib writes these fields as PDF literal strings
  // (parenthesis-delimited). Escape backslashes and parens so user-controlled
  // values cannot break out of the literal string boundary (MEDIUM-1).
  const escapePdfLit = (s: string): string =>
    s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')

  // Load with upstream pdf-lib (not @cantoo/pdf-lib) so the doc instance
  // shares the exact same PDFArray/PDFNumber/PDFName classes that
  // placeholder-pdf-lib uses internally — otherwise the serializer emits a
  // /ByteRange dict the signpdf parser cannot find.
  const pdfDoc = await pdfLibMod.PDFDocument.load(pdfBytes)
  pdflibAddPlaceholder({
    pdfDoc,
    reason:      escapePdfLit(sig.reason      ?? 'Signed'),
    contactInfo: escapePdfLit(sig.contactInfo ?? ''),
    name:        escapePdfLit(sig.signerName  ?? ''),
    location:    escapePdfLit(sig.location    ?? ''),
  })

  const pdfWithPlaceholder = await pdfDoc.save({ useObjectStreams: false })
  const signer = new SignPdf()
  const p12Signer = new P12Signer(
    p12Buffer,
    sig.passphrase !== undefined ? { passphrase: sig.passphrase } : undefined
  )
  let signedBuffer: Buffer
  try {
    signedBuffer = await signer.sign(Buffer.from(pdfWithPlaceholder), p12Signer)
  } catch (e) {
    // Scrub the raw signpdf error message — it may contain certificate subject
    // names, internal file paths from ASN.1 parsing, or P12 structural details.
    // Forward only a stable category string; callers should not parse the message.
    const detail = e instanceof Error && e.message ? ` (${e.message.slice(0, 120)})` : ''
    throw new PretextPdfError('SIGNATURE_FAILED', `PDF signing failed${detail}`)
  }

  return new Uint8Array(signedBuffer)
}

/**
 * Cheap structural check for "these bytes already carry a digital signature."
 * `/ByteRange` is a PDF signature-dictionary key (ISO 32000 §12.8.1) that
 * appears in no other PDF structure — a reliable, low-cost marker without
 * fully parsing the document.
 */
function isAlreadySigned(pdfBytes: Uint8Array): boolean {
  return Buffer.from(pdfBytes).toString('latin1').includes('/ByteRange')
}

/**
 * Apply AES-128 or AES-256 encryption to pre-rendered PDF bytes.
 *
 * Refuses to encrypt bytes that already carry a digital signature (a
 * `/ByteRange` marker): encryption rewrites the PDF's bytes and object
 * offsets, so any pre-existing signature's `messageDigest` no longer matches
 * the file it's supposedly covering — a signature that silently stops
 * proving what it claims to. `render()`'s own pipeline already guards this
 * combination at the `doc.signature`+`doc.encryption` level (see
 * `validate/document.ts`'s `SIGNATURE_CERT_AND_ENCRYPTION` check), but this
 * function is also exported standalone from `pretext-pdf/signing` for manual
 * pipeline composition — callers there never go through `render()`'s
 * validation at all, and could chain `applySignature()` then
 * `applyEncryption()` directly with no guard in between. Check here too so
 * the guarantee holds regardless of entry point.
 */
export async function applyEncryption(
  pdfBytes: Uint8Array,
  enc: NonNullable<PdfDocument['encryption']>
): Promise<Uint8Array> {
  if (isAlreadySigned(pdfBytes)) {
    throw new PretextPdfError(
      'SIGNATURE_CERT_AND_ENCRYPTION',
      'Cannot encrypt a PDF that already carries a digital signature — encryption rewrites the file bytes, which would invalidate the signature\'s digest. Encrypt first, then sign the encrypted bytes, or use only one of the two.'
    )
  }
  const encDoc = await PDFDocument.load(pdfBytes)
  encDoc.encrypt({
    userPassword:  enc.userPassword  ?? '',
    ownerPassword: enc.ownerPassword ?? (await import('node:crypto')).randomUUID(),
    permissions: {
      printing:   enc.permissions?.printing   ?? true,
      copying:    enc.permissions?.copying    ?? true,
      modifying:  enc.permissions?.modifying  ?? false,
      annotating: enc.permissions?.annotating ?? true,
    },
  })
  return encDoc.save({ useObjectStreams: false })
}

/**
 * Apply signature and encryption post-processing to raw pipeline bytes.
 * Called by both render() in index.ts and PdfBuilder.build() in builder.ts,
 * and directly by callers composing `pretext-pdf/signing` without going
 * through render()'s validation — so this same guard from
 * validate/document.ts is re-checked here rather than assumed.
 */
export async function applyPostProcessing(
  rawBytes: Uint8Array,
  doc: PdfDocument
): Promise<Uint8Array> {
  if (doc.signature?.p12 !== undefined && doc.encryption !== undefined) {
    throw new PretextPdfError('SIGNATURE_CERT_AND_ENCRYPTION', 'Cannot use both signature.p12 (cryptographic signing) and encryption together — the encryption step would invalidate the cryptographic signature.')
  }
  const signedBytes = doc.signature?.p12 ? await applySignature(rawBytes, doc.signature, doc.allowedFileDirs) : rawBytes
  return doc.encryption ? await applyEncryption(signedBytes, doc.encryption) : signedBytes
}
