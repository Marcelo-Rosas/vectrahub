/** Natural SKU order: letters then numbers. `DBSIX90` before `DBSIX100`. */
export function compareSkuNatural(a: string, b: string): number {
  return String(a).localeCompare(String(b), 'en', { numeric: true, sensitivity: 'base' });
}
