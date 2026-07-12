import { describe, it, expect } from 'vitest';
import { isBlankNoteBody } from './notes';

describe('isBlankNoteBody', () => {
  it('returns true for an empty string', () => {
    expect(isBlankNoteBody('')).toBe(true);
  });

  it('returns true for a string with only spaces', () => {
    expect(isBlankNoteBody('   ')).toBe(true);
  });

  it('returns true for a string with only whitespace characters', () => {
    expect(isBlankNoteBody('\n\t  \n')).toBe(true);
  });

  it('returns false for text surrounded by whitespace', () => {
    expect(isBlankNoteBody('  Ideia interessante  ')).toBe(false);
  });
});
