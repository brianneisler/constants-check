import { describe, it, expect } from 'vitest';
import { DEFAULT_CONFIG, MIN_DEFINITION_DUPLICATION } from '../../src/core/config.js';

describe('config defaults', () => {
  it('exposes the default ignored numbers', () => {
    expect(DEFAULT_CONFIG.ignoreNumbers).toEqual([0, 1, 2, -1, 10, 100]);
  });

  it('requires at least two duplicates by default', () => {
    expect(DEFAULT_CONFIG.minDuplication).toBe(2);
  });

  it('uses a minimum string length of three', () => {
    expect(DEFAULT_CONFIG.minStringLength).toBe(3);
  });

  it('requires at least two definitions to flag a duplicate', () => {
    expect(MIN_DEFINITION_DUPLICATION).toBe(2);
  });
});
