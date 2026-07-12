import { describe, it, expect } from 'vitest';
import { blobToBase64, base64ToBlob, isLikelyBase64 } from './base64';

describe('blobToBase64 / base64ToBlob', () => {
  it('round-trips small binary content', async () => {
    const bytes = new Uint8Array([0, 1, 2, 254, 255, 128, 64]);
    const blob = new Blob([bytes], { type: 'application/pdf' });

    const base64 = await blobToBase64(blob);
    const restored = base64ToBlob(base64, 'application/pdf');

    expect(restored.type).toBe('application/pdf');
    expect(restored.size).toBe(bytes.length);
    const restoredBytes = new Uint8Array(await restored.arrayBuffer());
    expect(Array.from(restoredBytes)).toEqual(Array.from(bytes));
  });

  it('round-trips content larger than one chunk (32KB)', async () => {
    const size = 32 * 1024 + 137; // atravessa o limite de chunk
    const bytes = new Uint8Array(size);
    for (let i = 0; i < size; i += 1) bytes[i] = i % 256;
    const blob = new Blob([bytes]);

    const base64 = await blobToBase64(blob);
    const restored = base64ToBlob(base64, 'application/octet-stream');
    const restoredBytes = new Uint8Array(await restored.arrayBuffer());

    expect(restoredBytes.length).toBe(size);
    expect(Array.from(restoredBytes)).toEqual(Array.from(bytes));
  });

  it('round-trips an empty blob', async () => {
    const blob = new Blob([]);
    const base64 = await blobToBase64(blob);
    // btoa('') === '' — vazio é um caso legítimo, tratado à parte na validação de restore.
    expect(base64).toBe('');
  });
});

describe('isLikelyBase64', () => {
  it('accepts valid base64 strings', () => {
    expect(isLikelyBase64('SGVsbG8=')).toBe(true);
    expect(isLikelyBase64('AAAA')).toBe(true);
  });

  it('rejects empty strings', () => {
    expect(isLikelyBase64('')).toBe(false);
  });

  it('rejects strings with invalid characters', () => {
    expect(isLikelyBase64('not-base64!!')).toBe(false);
  });

  it('rejects strings with invalid length padding', () => {
    expect(isLikelyBase64('AAAAA')).toBe(false);
  });
});
