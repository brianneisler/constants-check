import { describe, it, expect } from 'vitest';
import { calculateSimilarity, areNamesSimilar } from '../../src/comparison/fuzzyMatch.js';

describe('fuzzyMatch', () => {
  describe('calculateSimilarity', () => {
    it('returns 1 for identical strings', () => {
      expect(calculateSimilarity('FOO', 'FOO')).toBe(1);
    });

    it('is case-insensitive', () => {
      expect(calculateSimilarity('ABC', 'abc')).toBe(1);
      expect(calculateSimilarity('AbC', 'aBc')).toBe(1);
    });

    it('returns 1 when both strings are empty', () => {
      expect(calculateSimilarity('', '')).toBe(1);
    });

    it('returns 0 when exactly one string is empty', () => {
      expect(calculateSimilarity('', 'foo')).toBe(0);
      expect(calculateSimilarity('foo', '')).toBe(0);
    });

    it('computes 1 - distance/maxLength for a single substitution', () => {
      // distance 1 over max length 3
      expect(calculateSimilarity('abc', 'abd')).toBeCloseTo(2 / 3, 10);
    });

    it('computes the classic kitten/sitting distance of 3', () => {
      // distance 3 over max length 7
      expect(calculateSimilarity('kitten', 'sitting')).toBeCloseTo(1 - 3 / 7, 10);
    });

    it('accounts for pure deletions (asymmetric lengths)', () => {
      // "abcd" -> "a" requires deleting 3 characters
      expect(calculateSimilarity('abcd', 'a')).toBeCloseTo(0.25, 10);
      expect(calculateSimilarity('a', 'abcd')).toBeCloseTo(0.25, 10);
    });

    it('accounts for a single insertion', () => {
      expect(calculateSimilarity('ab', 'abc')).toBeCloseTo(2 / 3, 10);
    });
  });

  describe('areNamesSimilar', () => {
    it('returns true for identical names', () => {
      expect(areNamesSimilar('API_URL', 'API_URL')).toBe(true);
    });

    it('returns true for names above the threshold', () => {
      // similarity ~0.667 > 0.65
      expect(areNamesSimilar('abc', 'abd')).toBe(true);
    });

    it('returns false for names below the threshold', () => {
      // similarity ~0.571 < 0.65
      expect(areNamesSimilar('kitten', 'sitting')).toBe(false);
    });

    it('returns true at exactly the 0.65 threshold (inclusive bound)', () => {
      // 20 chars, 7 substitutions => similarity exactly 0.65
      const base = 'a'.repeat(20);
      const variant = 'a'.repeat(13) + 'b'.repeat(7);
      expect(calculateSimilarity(base, variant)).toBeCloseTo(0.65, 10);
      expect(areNamesSimilar(base, variant)).toBe(true);
    });

    it('returns false for completely different names', () => {
      expect(areNamesSimilar('FOO', 'BAR')).toBe(false);
    });
  });
});
