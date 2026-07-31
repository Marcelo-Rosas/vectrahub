import assert from 'node:assert/strict';

// Pure JS mirror of resolveCallPlan in aiClient.ts — keep in sync
function resolveCallPlan(modelHint) {
  if (modelHint === 'kimi') return { primary: 'kimi' };
  if (modelHint === 'fugu') return { primary: 'fugu' };
  if (modelHint === 'gemini') return { primary: 'gemini' };
  if (modelHint === 'anthropic' || modelHint === 'openai') return { primary: modelHint };
  return { primary: 'fugu', fallback: 'gemini' };
}

assert.deepEqual(resolveCallPlan(undefined), { primary: 'fugu', fallback: 'gemini' });
assert.deepEqual(resolveCallPlan('kimi'), { primary: 'kimi' });
assert.deepEqual(resolveCallPlan('fugu'), { primary: 'fugu' });
assert.deepEqual(resolveCallPlan('gemini'), { primary: 'gemini' });
console.log('route contract OK');
