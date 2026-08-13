import { PDFDocument } from 'pdf-lib';

/** Concatena PDFs na ordem recebida (ex.: DACTEs nº 2, 3 e 4 no mesmo arquivo). */
export async function mergePdfBlobs(blobs: Blob[]): Promise<Blob> {
  if (blobs.length === 0) throw new Error('Nenhum PDF para unir');
  if (blobs.length === 1) return blobs[0];

  const out = await PDFDocument.create();
  for (const blob of blobs) {
    const src = await PDFDocument.load(await blob.arrayBuffer(), { ignoreEncryption: true });
    const pages = await out.copyPages(src, src.getPageIndices());
    for (const page of pages) out.addPage(page);
  }
  const bytes = await out.save();
  return new Blob([bytes], { type: 'application/pdf' });
}
