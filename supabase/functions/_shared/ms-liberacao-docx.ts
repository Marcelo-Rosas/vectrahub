/**
 * Gera o DOCX oficial MS "Liberação de embarque excepcional" preenchido (Deno / edge).
 */
import { strFromU8, strToU8, unzipSync, zipSync } from 'https://esm.sh/fflate@0.8.2';
import { fillMsLiberacaoXml, type MsLiberacaoForm } from './ms-liberacao-form.ts';
import { MS_LIBERACAO_TEMPLATE_DOCX_B64 } from './ms-liberacao-template.ts';

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function bytesToB64(bytes: Uint8Array): string {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

export function buildMsLiberacaoDocx(form: MsLiberacaoForm): Uint8Array {
  const files = unzipSync(b64ToBytes(MS_LIBERACAO_TEMPLATE_DOCX_B64));
  const xml = strFromU8(files['word/document.xml']);
  files['word/document.xml'] = strToU8(fillMsLiberacaoXml(xml, form));
  return zipSync(files, { level: 6 });
}
