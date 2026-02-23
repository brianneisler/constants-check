import { describe, it, expect } from 'vitest';
import {
  isScreamingSnakeCase,
  createLocationKey,
  createNumberKey,
} from '../../src/scanner/scanConstants.js';

describe('scanConstants', () => {
  describe('isScreamingSnakeCase', () => {
    it('accepts valid SCREAMING_SNAKE_CASE', () => {
      expect(isScreamingSnakeCase('MAX_RETRIES')).toBe(true);
      expect(isScreamingSnakeCase('API_BASE_URL')).toBe(true);
      expect(isScreamingSnakeCase('CONST')).toBe(true);
      expect(isScreamingSnakeCase('A')).toBe(true);
    });

    it('rejects invalid names', () => {
      expect(isScreamingSnakeCase('maxRetries')).toBe(false);
      expect(isScreamingSnakeCase('api_base_url')).toBe(false);
      expect(isScreamingSnakeCase('MaxRetries')).toBe(false);
    });
  });

  describe('createLocationKey', () => {
    it('creates file:line format', () => {
      expect(createLocationKey('src/foo.ts', 10)).toBe('src/foo.ts:10');
    });
  });

  describe('createNumberKey', () => {
    it('creates value:format format', () => {
      expect(createNumberKey(42, 'decimal')).toBe('42:decimal');
      expect(createNumberKey(255, 'hex')).toBe('255:hex');
    });
  });
});
