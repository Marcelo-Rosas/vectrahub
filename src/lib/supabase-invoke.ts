/**
 * @deprecated Use `@/lib/edgeFunctions` with `{ body }` options.
 * Compat shim: 2º arg = body (legado dos hooks financeiros/seguro).
 */
import { invokeEdgeFunction as invoke } from '@/lib/edgeFunctions';

export async function invokeEdgeFunction<T>(
  functionName: string,
  body: Record<string, unknown> = {}
): Promise<T> {
  return invoke<T>(functionName, { body });
}
