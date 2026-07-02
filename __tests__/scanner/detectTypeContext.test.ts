import { describe, it, expect } from 'vitest';
import { SyntaxKind, StringLiteral } from 'ts-morph';
import {
  isTypeLiteral,
  isTypeofSentinel,
  isImportOrExport,
  isPropertyKey,
  isLikelyArrayIndex,
  isTestBlockLabel,
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

describe('isTestBlockLabel', () => {
  it('is true for an it() label', () => {
    expect(isTestBlockLabel(stringLiteral(`it('adds numbers', () => {});`))).toBe(true);
  });

  it('is true for a describe() label', () => {
    expect(isTestBlockLabel(stringLiteral(`describe('a suite', () => {});`))).toBe(true);
  });

  it('is true for a test() label', () => {
    expect(isTestBlockLabel(stringLiteral(`test('does a thing', () => {});`))).toBe(true);
  });

  it('is true for a modifier form like test.only()', () => {
    expect(isTestBlockLabel(stringLiteral(`test.only('focused', () => {});`))).toBe(true);
  });

  it('is true for a skip modifier like it.skip()', () => {
    expect(isTestBlockLabel(stringLiteral(`it.skip('later', () => {});`))).toBe(true);
  });

  it('is true for an each table form like it.each(cases)()', () => {
    expect(isTestBlockLabel(stringLiteral(`it.each(cases)('case %s', () => {});`))).toBe(true);
  });

  it('is true for x/f prefixed aliases', () => {
    expect(isTestBlockLabel(stringLiteral(`xit('pending', () => {});`))).toBe(true);
    expect(isTestBlockLabel(stringLiteral(`fdescribe('focused', () => {});`))).toBe(true);
  });

  it('is false for a string that is not the first argument', () => {
    // The label is the second string here; only the first argument is a label.
    expect(isTestBlockLabel(stringLiteral(`it(names[0], 'not a label');`))).toBe(false);
  });

  it('is false for a call to an unrelated function', () => {
    expect(isTestBlockLabel(stringLiteral(`log('a message');`))).toBe(false);
  });

  it('is false for a method call on an unrelated receiver', () => {
    expect(isTestBlockLabel(stringLiteral(`router.describe('a route');`))).toBe(false);
  });

  it('is false for a plain string literal', () => {
    expect(isTestBlockLabel(stringLiteral(`const x = 'value';`))).toBe(false);
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
