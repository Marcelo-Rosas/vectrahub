/**
 * Extrai anexos dos .eml em docs/homolog/_mails-extract → docs/homolog/_mails-attachments
 *
 *   npx tsx scripts/_extract-buckler-mail-attachments.ts
 */

import {
  createWriteStream,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'fs';
import { basename, join } from 'path';

const root = process.cwd();
const emlDir = join(root, 'docs/homolog/_mails-extract');
const outDir = join(root, 'docs/homolog/_mails-attachments');
const manifestPath = join(outDir, '_manifest.json');

mkdirSync(outDir, { recursive: true });

type AttachmentMeta = {
  sourceEml: string;
  filename: string;
  contentType: string;
  bytes: number;
  savedAs: string;
};

function decodeQuotedPrintable(input: string): Buffer {
  const cleaned = input.replace(/=\r?\n/g, '');
  const bytes: number[] = [];
  for (let i = 0; i < cleaned.length; i++) {
    if (cleaned[i] === '=' && i + 2 < cleaned.length) {
      bytes.push(parseInt(cleaned.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      bytes.push(cleaned.charCodeAt(i));
    }
  }
  return Buffer.from(bytes);
}

function parseHeaders(block: string): Record<string, string> {
  const headers: Record<string, string> = {};
  const lines = block.split(/\r?\n/);
  let current = '';
  for (const line of lines) {
    if (/^\s/.test(line) && current) {
      headers[current] += ' ' + line.trim();
    } else {
      const idx = line.indexOf(':');
      if (idx > 0) {
        current = line.slice(0, idx).trim().toLowerCase();
        headers[current] = line.slice(idx + 1).trim();
      }
    }
  }
  return headers;
}

function decodeFilename(raw: string): string {
  const joined = raw.replace(/\r?\n\s+/g, '');
  const parts = joined.match(/=\?utf-8\?[bq]\?[^?]+\?=/gi) ?? [joined];
  let out = '';
  for (const part of parts) {
    const b = part.match(/=\?utf-8\?b\?([^?]+)\?=/i);
    if (b) {
      out += Buffer.from(b[1], 'base64').toString('utf8');
      continue;
    }
    const q = part.match(/=\?utf-8\?q\?([^?]+)\?=/i);
    if (q) {
      out += q[1]
        .replace(/_/g, ' ')
        .replace(/=([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
      continue;
    }
    out += part;
  }
  return out.replace(/^["']|["']$/g, '').trim();
}

function filenameFromPart(headers: Record<string, string>): string | null {
  const disp = headers['content-disposition'] ?? '';
  const ct = headers['content-type'] ?? '';
  const raw =
    disp.match(/filename\*?=(?:UTF-8''|"?)([\s\S]+?)(?:;|$)/i)?.[1] ??
    ct.match(/name="([\s\S]+?)"/i)?.[1] ??
    ct.match(/name=([\s\S]+?)(?:;|$)/i)?.[1];
  if (!raw) return null;
  return decodeFilename(raw.trim());
}

function extractParts(
  body: string,
  boundary: string
): { headers: Record<string, string>; body: string }[] {
  const parts: { headers: Record<string, string>; body: string }[] = [];
  const chunks = body.split(`--${boundary}`);
  for (const chunk of chunks) {
    const trimmed = chunk.trim();
    if (!trimmed || trimmed === '--') continue;
    const sep = trimmed.search(/\r?\n\r?\n/);
    if (sep < 0) continue;
    const headerBlock = trimmed.slice(0, sep);
    const partBody = trimmed.slice(sep).replace(/^\r?\n/, '');
    parts.push({ headers: parseHeaders(headerBlock), body: partBody });
  }
  return parts;
}

function walkParts(
  part: { headers: Record<string, string>; body: string },
  sourceEml: string,
  out: AttachmentMeta[]
): void {
  const ct = part.headers['content-type'] ?? '';
  const disp = part.headers['content-disposition'] ?? '';
  const encoding = (part.headers['content-transfer-encoding'] ?? '').toLowerCase();
  const boundaryMatch = ct.match(/boundary="?([^";\s]+)"?/i);

  if (boundaryMatch) {
    for (const child of extractParts(part.body, boundaryMatch[1])) {
      walkParts(child, sourceEml, out);
    }
    return;
  }

  const fnMatch = disp.match(/filename\*?=(?:UTF-8''|"?)([^";\r\n]+)/i);
  const filename = filenameFromPart(part.headers);
  if (!filename) return;
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  if (!['xlsx', 'xls', 'pdf', 'csv', 'zip'].includes(ext)) return;

  let buf: Buffer;
  if (encoding === 'base64') {
    buf = Buffer.from(part.body.replace(/\s/g, ''), 'base64');
  } else if (encoding === 'quoted-printable') {
    buf = decodeQuotedPrintable(part.body);
  } else {
    buf = Buffer.from(part.body, 'binary');
  }

  const safeEml = basename(sourceEml, '.eml')
    .replace(/[^\w.-]+/g, '_')
    .slice(0, 60);
  const safeFn = filename.replace(/[^\w.\-() ]+/g, '_');
  const savedAs = `${safeEml}__${safeFn}`;
  const fullPath = join(outDir, savedAs);
  writeFileSync(fullPath, buf);

  out.push({
    sourceEml: basename(sourceEml),
    filename,
    contentType: ct.split(';')[0].trim(),
    bytes: buf.length,
    savedAs,
  });
}

const manifest: AttachmentMeta[] = [];
for (const eml of readdirSync(emlDir).filter((f) => f.endsWith('.eml'))) {
  const raw = readFileSync(join(emlDir, eml), 'utf8');
  const headerEnd = raw.search(/\r?\n\r?\n/);
  const headers = parseHeaders(raw.slice(0, headerEnd));
  const body = raw.slice(headerEnd).replace(/^\r?\n/, '');
  const ct = headers['content-type'] ?? '';
  const boundaryMatch = ct.match(/boundary="?([^";\s]+)"?/i);
  if (!boundaryMatch) continue;
  for (const part of extractParts(body, boundaryMatch[1])) {
    walkParts(part, eml, manifest);
  }
}

writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

console.log('[mail-extract] attachments', manifest.length);
for (const m of manifest.sort((a, b) => b.bytes - a.bytes)) {
  console.log(`  ${m.bytes.toLocaleString('pt-BR')} B  ${m.filename}  ← ${m.sourceEml}`);
}
console.log('[mail-extract] manifest', manifestPath);
