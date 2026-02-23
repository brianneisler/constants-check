import { describe, it, expect } from 'vitest';
import { calculateSimilarity, areNamesSimilar } from '../../src/comparison/fuzzyMatch.js';

describe('fuzzyMatch', () => {
  describe('calculateSimilarity', () => {
    it('returns 1 for identical strings', () => {
      expect(calculateSimilarity('FOO', 'FOO')).toBe(1);
    });

    it('returns 0 for empty vs non-empty', () => {
      expect(calculateSimilarity('', 'foo')).toBe(0);
    });

    it('returns value between 0 and 1 for similar strings', () => {
      const sim = calculateSimilarity('MAX_RETRIES', 'MAX_RETRY');
      expect(sim).toBeGreaterThan(0);
      expect(sim).toBeLessThanOrEqual(1);
    });
  });

  describe('areNamesSimilar', () => {
    it('returns true for identical names', () => {
      expect(areNamesSimilar('API_URL', 'API_URL')).toBe(true);
    });

    it('returns true for similar names', () => {
      expect(areNamesSimilar('MAX_RETRIES', 'MAX_RETRY')).toBe(true);
    });

    it('returns false for very different names', () => {
      expect(areNamesSimilar('FOO', 'BAR')).toBe(false);
    });
  });
});
