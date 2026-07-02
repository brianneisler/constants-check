import { describe, it, expect } from 'vitest';
import { hashObjectStructure } from '../../src/core/hashUtils.js';

describe('hashObjectStructure', () => {
  it('returns a 16-character hex string', () => {
    expect(hashObjectStructure({ a: 1 })).toMatch(/^[0-9a-f]{16}$/);
  });

  it('is deterministic for the same value', () => {
    expect(hashObjectStructure({ a: 1, b: 2 })).toBe(hashObjectStructure({ a: 1, b: 2 }));
  });

  it('is independent of object key order', () => {
    expect(hashObjectStructure({ a: 1, b: 2 })).toBe(hashObjectStructure({ b: 2, a: 1 }));
  });

  it('distinguishes objects with different values', () => {
    expect(hashObjectStructure({ a: 1 })).not.toBe(hashObjectStructure({ a: 2 }));
  });

  it('distinguishes objects with different keys', () => {
    expect(hashObjectStructure({ a: 1 })).not.toBe(hashObjectStructure({ b: 1 }));
  });

  it('distinguishes a string from a numeric value', () => {
    expect(hashObjectStructure('1')).not.toBe(hashObjectStructure(1));
  });

  it('distinguishes null from undefined', () => {
    expect(hashObjectStructure(null)).not.toBe(hashObjectStructure(undefined));
  });

  it('distinguishes booleans from numbers', () => {
    expect(hashObjectStructure(true)).not.toBe(hashObjectStructure(1));
    expect(hashObjectStructure(false)).not.toBe(hashObjectStructure(0));
  });

  it('is order-sensitive for arrays', () => {
    expect(hashObjectStructure([1, 2])).not.toBe(hashObjectStructure([2, 1]));
  });

  it('distinguishes an array from an object', () => {
    expect(hashObjectStructure([1])).not.toBe(hashObjectStructure({ 0: 1 }));
  });

  // Pinned reference hashes. Any change to the normalization format (quoting,
  // separators, sort, type sentinels) changes these, so they lock the encoding
  // of every value kind down precisely.
  it('matches reference hashes for each value kind', () => {
    expect(hashObjectStructure(null)).toBe('74234e98afe7498f');
    expect(hashObjectStructure(undefined)).toBe('eb045d78d2731073');
    expect(hashObjectStructure('x')).toBe('ba2df4903a2c14e8');
    expect(hashObjectStructure(5)).toBe('ef2d127de37b942b');
    expect(hashObjectStructure(true)).toBe('b5bea41b6c623f7c');
    expect(hashObjectStructure([1, 2])).toBe('49a64717d5d4cb19');
    expect(hashObjectStructure({ a: 1, b: 2 })).toBe('43258cff783fe703');
    expect(hashObjectStructure({ a: { b: [1, 2] } })).toBe('df54656ce9ea4120');
  });

  it('hashes unsupported value kinds via a type sentinel', () => {
    expect(hashObjectStructure((() => {}) as unknown)).toBe('3ba4c64b07589361');
  });

  it('hashes nested structures consistently', () => {
    expect(hashObjectStructure({ a: { b: [1, 2] } })).toBe(
      hashObjectStructure({ a: { b: [1, 2] } })
    );
    expect(hashObjectStructure({ a: { b: [1, 2] } })).not.toBe(
      hashObjectStructure({ a: { b: [1, 3] } })
    );
  });
});
