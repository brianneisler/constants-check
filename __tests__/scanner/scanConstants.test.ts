import { describe, it, expect } from 'vitest';
import { SyntaxKind } from 'ts-morph';
import {
  isScreamingSnakeCase,
  createLocationKey,
  createNumberKey,
  getNumberFormat,
  scanConstants,
} from '../../src/scanner/scanConstants.js';
import type { ConstantDefinition, LocationKey } from '../../src/types/constantsTypes.js';
import { createSourceFile, firstOfKind } from '../helpers/tsMorph.js';

describe('isScreamingSnakeCase', () => {
  it('accepts valid SCREAMING_SNAKE_CASE', () => {
    expect(isScreamingSnakeCase('MAX_RETRIES')).toBe(true);
    expect(isScreamingSnakeCase('API_BASE_URL')).toBe(true);
    expect(isScreamingSnakeCase('CONST')).toBe(true);
    expect(isScreamingSnakeCase('A')).toBe(true);
    expect(isScreamingSnakeCase('A1')).toBe(true);
    expect(isScreamingSnakeCase('A_')).toBe(true);
  });

  it('rejects invalid names', () => {
    expect(isScreamingSnakeCase('maxRetries')).toBe(false);
    expect(isScreamingSnakeCase('api_base_url')).toBe(false);
    expect(isScreamingSnakeCase('MaxRetries')).toBe(false);
    expect(isScreamingSnakeCase('1A')).toBe(false);
    expect(isScreamingSnakeCase('_A')).toBe(false);
    expect(isScreamingSnakeCase('')).toBe(false);
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

describe('getNumberFormat', () => {
  function numericNode(literal: string) {
    return firstOfKind(`const X = ${literal};`, SyntaxKind.NumericLiteral);
  }

  it('detects hex', () => {
    expect(getNumberFormat(numericNode('0xFF'))).toBe('hex');
  });

  it('detects octal', () => {
    expect(getNumberFormat(numericNode('0o17'))).toBe('octal');
  });

  it('detects binary', () => {
    expect(getNumberFormat(numericNode('0b1010'))).toBe('binary');
  });

  it('defaults to decimal', () => {
    expect(getNumberFormat(numericNode('42'))).toBe('decimal');
  });
});

describe('scanConstants', () => {
  function scan(code: string) {
    const file = createSourceFile(code);
    const stringConstants = new Map<string, ConstantDefinition[]>();
    const numberConstants = new Map<string, ConstantDefinition[]>();
    const constantLocations = new Set<LocationKey>();
    scanConstants(file, 'test.ts', 'pkg', stringConstants, numberConstants, constantLocations);
    return { stringConstants, numberConstants, constantLocations };
  }

  it('records a SCREAMING_SNAKE_CASE string constant', () => {
    const { stringConstants, constantLocations } = scan(`const MAX = 'hello';`);
    const defs = stringConstants.get('hello');
    expect(defs).toHaveLength(1);
    expect(defs![0]).toMatchObject({
      name: 'MAX',
      fullPath: 'MAX',
      value: 'hello',
      file: 'test.ts',
      packageName: 'pkg',
      line: 1,
    });
    expect(constantLocations.has('test.ts:1')).toBe(true);
  });

  it('records a numeric constant keyed by value and format', () => {
    const { numberConstants } = scan(`const MASK = 0xFF;`);
    const defs = numberConstants.get('255:hex');
    expect(defs).toHaveLength(1);
    expect(defs![0]).toMatchObject({ name: 'MASK', value: 255, numberFormat: 'hex' });
  });

  it('ignores constants that are not SCREAMING_SNAKE_CASE', () => {
    const { stringConstants } = scan(`const camelCase = 'skip';`);
    expect(stringConstants.has('skip')).toBe(false);
  });

  it('unwraps "as const" assertions', () => {
    const { stringConstants } = scan(`const X = 'wrapped' as const;`);
    expect(stringConstants.get('wrapped')).toHaveLength(1);
  });

  it('extracts nested object properties with a dotted fullPath', () => {
    const { stringConstants, numberConstants } = scan(
      `const CONFIG = { host: 'localhost', port: 5432 };`
    );
    expect(stringConstants.get('localhost')![0].fullPath).toBe('CONFIG.host');
    expect(numberConstants.get('5432:decimal')![0].fullPath).toBe('CONFIG.port');
  });

  it('records enum members with an Enum.Member fullPath', () => {
    const { stringConstants } = scan(`enum Color { RED = 'red', GREEN = 'green' }`);
    expect(stringConstants.get('red')![0]).toMatchObject({
      name: 'RED',
      fullPath: 'Color.RED',
    });
    expect(stringConstants.get('green')).toHaveLength(1);
  });

  it('records numeric enum members', () => {
    const { numberConstants } = scan(`enum Status { OK = 200, NOT_FOUND = 404 }`);
    expect(numberConstants.get('200:decimal')![0].fullPath).toBe('Status.OK');
    expect(numberConstants.get('404:decimal')![0].name).toBe('NOT_FOUND');
  });

  it('skips a constant with constants-ignore-next-line', () => {
    const { stringConstants } = scan(`// constants-ignore-next-line\nconst SECRET = 'xyz';`);
    expect(stringConstants.has('xyz')).toBe(false);
  });

  it('skips constants inside an ignore block', () => {
    const { stringConstants } = scan(
      `// constants-ignore-start\nconst A = 'blocked';\n// constants-ignore-end`
    );
    expect(stringConstants.has('blocked')).toBe(false);
  });

  it('skips enum members with constants-ignore-next-line', () => {
    const { stringConstants } = scan(
      `enum E {\n  // constants-ignore-next-line\n  HIDDEN = 'hidden',\n}`
    );
    expect(stringConstants.has('hidden')).toBe(false);
  });

  it('ignores const declarations without an initializer pattern it understands', () => {
    const { stringConstants, numberConstants } = scan(`const FLAG = true;`);
    expect(stringConstants.size).toBe(0);
    expect(numberConstants.size).toBe(0);
  });

  it('ignores let and var declarations (only const)', () => {
    expect(scan(`let MAX = 'letme';`).stringConstants.has('letme')).toBe(false);
    expect(scan(`var MIN = 'varme';`).stringConstants.has('varme')).toBe(false);
  });

  it('skips an enum annotated with constants-ignore-next-line', () => {
    const { stringConstants } = scan(`// constants-ignore-next-line\nenum E { A = 'aval' }`);
    expect(stringConstants.has('aval')).toBe(false);
  });

  it('skips enum members inside an ignore block', () => {
    const { stringConstants } = scan(
      `enum E {\n  // constants-ignore-start\n  A = 'blocked-enum',\n  // constants-ignore-end\n}`
    );
    expect(stringConstants.has('blocked-enum')).toBe(false);
  });
});
