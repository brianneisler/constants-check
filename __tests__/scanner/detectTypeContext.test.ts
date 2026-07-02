import { describe, it, expect } from 'vitest';
import { SyntaxKind, StringLiteral } from 'ts-morph';
import {
  isTypeLiteral,
  isTypeofSentinel,
  isImportOrExport,
  isPropertyKey,
  isLikelyArrayIndex,
} from '../../src/scanner/detectTypeContext.js';
import { firstOfKind } from '../helpers/tsMorph.js';

function stringLiteral(code: string): StringLiteral {
  return firstOfKind(code, SyntaxKind.StringLiteral) as StringLiteral;
}

describe('isTypeLiteral', () => {
  it('is true for a literal inside a type alias', () => {
    expect(isTypeLiteral(stringLiteral(`type T = 'foo';`))).toBe(true);
  });

  it('is true for a literal in an interface property signature', () => {
    expect(isTypeLiteral(stringLiteral(`interface I { x: 'foo'; }`))).toBe(true);
  });

  it('is true for a literal in a union type', () => {
    expect(isTypeLiteral(stringLiteral(`type T = 'a' | 'b';`))).toBe(true);
  });

  it('is true for an enum member value', () => {
    expect(isTypeLiteral(stringLiteral(`enum E { A = 'x' }`))).toBe(true);
  });

  it('is false for a literal in a value position', () => {
    expect(isTypeLiteral(stringLiteral(`const x = 'foo';`))).toBe(false);
  });
});

describe('isTypeofSentinel', () => {
  function sentinel(code: string): boolean {
    const node = stringLiteral(code);
    return isTypeofSentinel(node, node.getLiteralText());
  }

  it('is true when comparing typeof against a sentinel (typeof on the left)', () => {
    expect(sentinel(`if (typeof x === 'string') {}`)).toBe(true);
  });

  it('is true when typeof is on the right side', () => {
    expect(sentinel(`if ('number' === typeof x) {}`)).toBe(true);
  });

  it('is false for a sentinel word outside a typeof comparison', () => {
    expect(sentinel(`const s = 'string';`)).toBe(false);
  });

  it('is false for a non-sentinel word even next to typeof', () => {
    expect(sentinel(`if (typeof x === 'banana') {}`)).toBe(false);
  });

  it('recognizes every typeof sentinel word', () => {
    for (const word of [
      'string',
      'number',
      'boolean',
      'object',
      'undefined',
      'function',
      'symbol',
      'bigint',
    ]) {
      expect(sentinel(`if (typeof x === '${word}') {}`)).toBe(true);
    }
  });

  it('is false for a sentinel compared to a non-typeof operand', () => {
    // Binary expression, but neither side is a typeof expression.
    expect(sentinel(`const a = ('string' === y);`)).toBe(false);
  });
});

describe('isImportOrExport', () => {
  it('is true for an import module specifier', () => {
    expect(isImportOrExport(stringLiteral(`import x from 'mod';`))).toBe(true);
  });

  it('is true for a re-export module specifier', () => {
    expect(isImportOrExport(stringLiteral(`export { y } from 'mod';`))).toBe(true);
  });

  it('is false for a plain string value', () => {
    expect(isImportOrExport(stringLiteral(`const a = 'mod';`))).toBe(false);
  });
});

describe('isPropertyKey', () => {
  it('is true for a quoted property name', () => {
    expect(isPropertyKey(stringLiteral(`const o = { 'key': 1 };`))).toBe(true);
  });

  it('is false for a property value', () => {
    expect(isPropertyKey(stringLiteral(`const o = { k: 'value' };`))).toBe(false);
  });
});

describe('isLikelyArrayIndex', () => {
  function numeric(code: string) {
    return firstOfKind(code, SyntaxKind.NumericLiteral);
  }

  it('is true for a direct numeric index', () => {
    expect(isLikelyArrayIndex(numeric(`arr[0];`))).toBe(true);
  });

  it('is false for a numeric literal that is not an index argument', () => {
    expect(isLikelyArrayIndex(numeric(`const n = 5;`))).toBe(false);
  });

  it('is false for a number nested inside a computed index expression', () => {
    expect(isLikelyArrayIndex(numeric(`arr[1 + 2];`))).toBe(false);
  });
});
