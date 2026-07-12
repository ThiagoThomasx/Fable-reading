import { describe, it, expect } from 'vitest';
import { hasExtractableText } from './text-content';

describe('hasExtractableText', () => {
  it('returns true when at least one item has non-blank text', () => {
    expect(hasExtractableText([{ str: '  ' }, { str: 'Hello' }])).toBe(true);
  });

  it('returns false for an empty items array (scanned page)', () => {
    expect(hasExtractableText([])).toBe(false);
  });

  it('returns false when all items are blank/whitespace', () => {
    expect(hasExtractableText([{ str: '' }, { str: '   ' }, { str: undefined }])).toBe(false);
  });
});
