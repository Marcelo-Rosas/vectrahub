import { describe, expect, it } from 'vitest';
import {
  AppError,
  isTransientError,
  mapToAppError,
  maybeTruncatedList,
  toUserMessage,
} from '@/lib/errors/AppError';

describe('AppError', () => {
  it('maps 401 to AUTH_EXPIRED', () => {
    const err = mapToAppError(new Error('JWT expired 401'));
    expect(err.code).toBe('AUTH_EXPIRED');
    expect(isTransientError(err)).toBe(false);
  });

  it('maps worker limit as transient retryable', () => {
    const err = mapToAppError(new Error('546 WORKER_RESOURCE_LIMIT'));
    expect(err.code).toBe('WORKER_LIMIT');
    expect(isTransientError(err)).toBe(true);
  });

  it('toUserMessage prefers AppError message', () => {
    expect(toUserMessage(new AppError('VALIDATION', 'Campo inválido'))).toBe('Campo inválido');
  });

  it('detects PostgREST silent truncation', () => {
    expect(maybeTruncatedList(999)).toBe(false);
    expect(maybeTruncatedList(1000)).toBe(true);
  });
});
