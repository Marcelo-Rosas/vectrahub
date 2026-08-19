/** supabase.functions.invoke error.context nem sempre é Fetch Response. */
export function contentTypeFromFunctionsErrorContext(context: unknown): string {
  if (!context || typeof context !== 'object') return '';
  const headers = (context as { headers?: { get?: (n: string) => string | null } }).headers;
  if (typeof headers?.get !== 'function') return '';
  return headers.get('content-type') || '';
}
