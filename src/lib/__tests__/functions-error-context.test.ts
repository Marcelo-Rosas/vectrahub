import { describe, expect, it } from 'vitest';
import { contentTypeFromFunctionsErrorContext } from '@/lib/functions-error-context';

describe('contentTypeFromFunctionsErrorContext', () => {
  it('context sem headers não explode', () => {
    expect(contentTypeFromFunctionsErrorContext(undefined)).toBe('');
    expect(contentTypeFromFunctionsErrorContext({})).toBe('');
    expect(contentTypeFromFunctionsErrorContext({ headers: {} })).toBe('');
  });

  it('Response-like devolve content-type', () => {
    expect(
      contentTypeFromFunctionsErrorContext({
        headers: { get: (n: string) => (n === 'content-type' ? 'application/json' : null) },
      })
    ).toBe('application/json');
  });
});
