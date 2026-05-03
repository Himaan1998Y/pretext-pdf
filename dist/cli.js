#!/usr/bin/env node
/**
 * pretext-pdf CLI — JSON in, PDF out.
 *
 *   pretext-pdf doc.json out.pdf
 *   pretext-pdf doc.json > out.pdf
 *   cat doc.json | pretext-pdf > out.pdf
 *   echo '{"content":[...]}' | pretext-pdf -o out.pdf
 *
 * Optional flags:
 *   -o, --output <path>     Write PDF to path instead of stdout
 *   -i, --input <path>      Read JSON from path instead of first positional
 *   --markdown              Treat input as Markdown (requires `marked` peer dep)
 *       --code-font <name>  Pair with --markdown to enable styled code blocks
 *   -v, --version           Print pretext-pdf version
 *   -h, --help              Print this help
 *
 * Exit codes:
 *   0  success
 *   1  user error (bad arguments, file not found, invalid JSON)
 *   2  render error (validation, font, image, pagination etc.)
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const pkg = require('../package.json');
const HELP = `pretext-pdf v${pkg.version} — JSON → PDF

Usage:
  pretext-pdf [<input.json>] [<output.pdf>]
  pretext-pdf -i <input> -o <output>
  cat doc.json | pretext-pdf > out.pdf

Options:
  -i, --input <path>     Read JSON (or Markdown with --markdown) from path
  -o, --output <path>    Write PDF to path (default: stdout)
      --markdown         Treat input as Markdown — converts via pretext-pdf/markdown
      --code-font <name> With --markdown, font family for fenced code blocks
  -v, --version          Print pretext-pdf version
  -h, --help             Print this help

Examples:
  pretext-pdf doc.json invoice.pdf
  echo '{"content":[{"type":"heading","level":1,"text":"Hi"}]}' | pretext-pdf > out.pdf
  pretext-pdf --markdown --code-font 'Courier New' README.md docs.pdf
`;
function parseArgs(argv) {
    const args = { markdown: false };
    const positional = [];
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '-h' || a === '--help')
            return { exit: 0, message: HELP };
        if (a === '-v' || a === '--version')
            return { exit: 0, message: pkg.version };
        if (a === '-i' || a === '--input') {
            const next = argv[++i];
            if (!next)
                return { error: `${a} requires a path argument` };
            args.inputPath = next;
            continue;
        }
        if (a === '-o' || a === '--output') {
            const next = argv[++i];
            if (!next)
                return { error: `${a} requires a path argument` };
            args.outputPath = next;
            continue;
        }
        if (a === '--markdown') {
            args.markdown = true;
            continue;
        }
        if (a === '--code-font') {
            const next = argv[++i];
            if (!next)
                return { error: `${a} requires a font family argument` };
            args.codeFont = next;
            continue;
        }
        if (a.startsWith('-'))
            return { error: `unknown option: ${a}` };
        positional.push(a);
    }
    // Positional fallback: first positional is input, second is output
    if (!args.inputPath && positional[0])
        args.inputPath = positional[0];
    if (!args.outputPath && positional[1])
        args.outputPath = positional[1];
    if (positional.length > 2)
        return { error: `too many positional arguments (got ${positional.length}, max 2)` };
    return args;
}
async function readInput(inputPath) {
    if (inputPath) {
        const abs = path.resolve(inputPath);
        try {
            return await fs.readFile(abs, 'utf-8');
        }
        catch (err) {
            throw new CliError(`failed to read ${inputPath}: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
    // stdin
    if (process.stdin.isTTY) {
        throw new CliError('no input — pass a file path or pipe JSON to stdin. Run with -h for help.');
    }
    const chunks = [];
    for await (const chunk of process.stdin) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString('utf-8');
}
async function writeOutput(outputPath, bytes) {
    if (outputPath) {
        const abs = path.resolve(outputPath);
        await fs.writeFile(abs, bytes);
        return;
    }
    // stdout
    if (process.stdout.isTTY) {
        throw new CliError('refusing to write binary PDF to a TTY. Pass an output path or redirect (> out.pdf).');
    }
    await new Promise((resolve, reject) => {
        process.stdout.write(Buffer.from(bytes), (err) => (err ? reject(err) : resolve()));
    });
}
class CliError extends Error {
}
async function main() {
    const parsed = parseArgs(process.argv.slice(2));
    if ('exit' in parsed) {
        process.stdout.write(parsed.message + '\n');
        return parsed.exit;
    }
    if ('error' in parsed) {
        process.stderr.write(`pretext-pdf: ${parsed.error}\n\n${HELP}`);
        return 1;
    }
    let raw;
    try {
        raw = await readInput(parsed.inputPath);
    }
    catch (err) {
        process.stderr.write(`pretext-pdf: ${err instanceof Error ? err.message : String(err)}\n`);
        return 1;
    }
    // Build the PdfDocument. Either parse as JSON, or convert Markdown.
    const { render } = await import('./index.js');
    let doc;
    if (parsed.markdown) {
        let markdownToContent;
        try {
            ({ markdownToContent } = await import('./markdown.js'));
        }
        catch (err) {
            process.stderr.write(`pretext-pdf: failed to load markdown converter: ${err instanceof Error ? err.message : String(err)}\n`);
            return 2;
        }
        const opts = {};
        if (parsed.codeFont)
            opts.codeFontFamily = parsed.codeFont;
        try {
            const content = await markdownToContent(raw, opts);
            doc = { content };
        }
        catch (err) {
            process.stderr.write(`pretext-pdf: markdown conversion failed: ${err instanceof Error ? err.message : String(err)}\n`);
            return 2;
        }
    }
    else {
        try {
            doc = JSON.parse(raw);
        }
        catch (err) {
            process.stderr.write(`pretext-pdf: invalid JSON in input: ${err instanceof Error ? err.message : String(err)}\n`);
            return 1;
        }
    }
    let pdf;
    try {
        pdf = await render(doc);
    }
    catch (err) {
        const code = err?.code ?? 'RENDER_ERROR';
        process.stderr.write(`pretext-pdf: ${code}: ${err instanceof Error ? err.message : String(err)}\n`);
        return 2;
    }
    try {
        await writeOutput(parsed.outputPath, pdf);
    }
    catch (err) {
        process.stderr.write(`pretext-pdf: failed to write output: ${err instanceof Error ? err.message : String(err)}\n`);
        return 1;
    }
    // Success: only print a confirmation when writing to a real file (not stdout).
    if (parsed.outputPath && !process.env.PRETEXT_PDF_QUIET) {
        process.stderr.write(`pretext-pdf: wrote ${pdf.byteLength} bytes to ${parsed.outputPath}\n`);
    }
    return 0;
}
main()
    .then((code) => process.exit(code))
    .catch((err) => {
    process.stderr.write(`pretext-pdf: unexpected error: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
    process.exit(2);
});
//# sourceMappingURL=cli.js.map