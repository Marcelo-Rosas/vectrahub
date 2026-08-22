/** Labels de exibição compartilhados na rota /feira. */

/** Nome comercial em CAPS; remove tradução entre parênteses. */
export function formatFairProductName(name: string): string {
  return name
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .toUpperCase();
}
