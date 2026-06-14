import { describe, it, expect } from 'vitest';
import { deepEqual } from '../../src/comparison/deepEqual.js';

describe('deepEqual', () => {
  describe('primitives', () => {
    it('matches equal primitives', () => {
      expect(deepEqual(1, 1)).toBe(true);
      expect(deepEqual('a', 'a')).toBe(true);
      expect(deepEqual(true, true)).toBe(true);
      expect(deepEqual(false, false)).toBe(true);
    });

    it('distinguishes unequal same-type primitives', () => {
      expect(deepEqual(1, 2)).toBe(false);
      expect(deepEqual('a', 'b')).toBe(false);
      expect(deepEqual(true, false)).toBe(false);
    });

    it('distinguishes different types with equal-looking values', () => {
      expect(deepEqual(1, '1')).toBe(false);
      expect(deepEqual(0, false)).toBe(false);
      expect(deepEqual(1, true)).toBe(false);
      expect(deepEqual('', false)).toBe(false);
    });
  });

  describe('null and undefined', () => {
    it('treats null/null and undefined/undefined as equal', () => {
      expect(deepEqual(null, null)).toBe(true);
      expect(deepEqual(undefined, undefined)).toBe(true);
    });

    it('treats a single null as not equal to anything else', () => {
      expect(deepEqual(null, 1)).toBe(false);
      expect(deepEqual(1, null)).toBe(false);
      expect(deepEqual(null, undefined)).toBe(false);
      expect(deepEqual(null, {})).toBe(false);
      expect(deepEqual({}, null)).toBe(false);
    });

    it('treats a single undefined as not equal to anything else', () => {
      expect(deepEqual(undefined, 1)).toBe(false);
      expect(deepEqual(1, undefined)).toBe(false);
      expect(deepEqual(undefined, null)).toBe(false);
    });
  });

  describe('arrays', () => {
    it('matches arrays with equal elements in order', () => {
      expect(deepEqual([1, 2], [1, 2])).toBe(true);
      expect(deepEqual([], [])).toBe(true);
    });

    it('rejects arrays of different length', () => {
      expect(deepEqual([1, 2], [1, 2, 3])).toBe(false);
      expect(deepEqual([1, 2, 3], [1, 2])).toBe(false);
      expect(deepEqual([1], [])).toBe(false);
    });

    it('rejects same-length arrays differing by element', () => {
      expect(deepEqual([1, 2], [1, 3])).toBe(false);
    });

    it('is order sensitive', () => {
      expect(deepEqual([1, 2], [2, 1])).toBe(false);
    });

    it('compares nested arrays element-by-element', () => {
      expect(deepEqual([[1], [2]], [[1], [2]])).toBe(true);
      expect(deepEqual([[1], [2]], [[1], [3]])).toBe(false);
    });
  });

  describe('objects', () => {
    it('matches objects regardless of key order', () => {
      expect(deepEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
    });

    it('rejects objects with a differing value', () => {
      expect(deepEqual({ a: 1 }, { a: 2 })).toBe(false);
    });

    it('rejects objects with a different number of keys', () => {
      expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
      expect(deepEqual({ a: 1, b: 2 }, { a: 1 })).toBe(false);
    });

    it('rejects objects with the same number of keys but different names', () => {
      expect(deepEqual({ a: 1 }, { b: 1 })).toBe(false);
    });

    it('compares nested object structures', () => {
      expect(deepEqual({ a: { b: 1 } }, { a: { b: 1 } })).toBe(true);
      expect(deepEqual({ a: { b: 1 } }, { a: { b: 2 } })).toBe(false);
    });

    it('compares mixed nested arrays and objects', () => {
      expect(deepEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })).toBe(true);
      expect(deepEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 3 }] })).toBe(false);
    });
  });

  describe('cross-type structures', () => {
    it('does not treat an array as equal to a number', () => {
      expect(deepEqual([1], 1)).toBe(false);
      expect(deepEqual(1, [1])).toBe(false);
    });
  });
});
