import { describe, it, expect } from 'vitest';
import { SyntaxKind } from 'ts-morph';
import {
  addStringConstant,
  addNumberConstant,
  extractObjectProperties,
} from '../../src/scanner/scanObjects.js';
import type { ConstantDefinition, LocationKey } from '../../src/types/constantsTypes.js';
import { firstOfKind } from '../helpers/tsMorph.js';

function def(partial: Partial<ConstantDefinition> & { name: string }): ConstantDefinition {
  return { value: 'x', file: 'f.ts', line: 1, packageName: 'pkg', ...partial };
}

describe('addStringConstant', () => {
  it('creates a new bucket and records the location', () => {
    const map = new Map<string, ConstantDefinition[]>();
    const locs = new Set<LocationKey>();
    addStringConstant('val', def({ name: 'A', value: 'val', line: 3 }), map, locs);

    expect(map.get('val')).toHaveLength(1);
    expect(locs.has('f.ts:3')).toBe(true);
  });

  it('appends to an existing bucket rather than replacing it', () => {
    const map = new Map<string, ConstantDefinition[]>();
    const locs = new Set<LocationKey>();
    addStringConstant('val', def({ name: 'A', value: 'val' }), map, locs);
    addStringConstant('val', def({ name: 'B', value: 'val' }), map, locs);

    expect(map.get('val')!.map((d) => d.name)).toEqual(['A', 'B']);
  });
});

describe('addNumberConstant', () => {
  it('keys by value:format and stamps the format onto the definition', () => {
    const map = new Map<string, ConstantDefinition[]>();
    const locs = new Set<LocationKey>();
    const constant = def({ name: 'MASK', value: 255, line: 2 });
    addNumberConstant(255, 'hex', constant, map, locs);

    expect(map.get('255:hex')).toHaveLength(1);
    expect(constant.numberFormat).toBe('hex');
    expect(locs.has('f.ts:2')).toBe(true);
  });
});

describe('extractObjectProperties', () => {
  function extract(code: string) {
    const objectLiteral = firstOfKind(code, SyntaxKind.ObjectLiteralExpression);
    const stringConstants = new Map<string, ConstantDefinition[]>();
    const numberConstants = new Map<string, ConstantDefinition[]>();
    const constantLocations = new Set<LocationKey>();
    extractObjectProperties(
      objectLiteral,
      'ROOT',
      'test.ts',
      'pkg',
      stringConstants,
      numberConstants,
      constantLocations,
      []
    );
    return { stringConstants, numberConstants };
  }

  it('records string and number properties with dotted paths', () => {
    const { stringConstants, numberConstants } = extract(
      `const o = { host: 'localhost', port: 5432 };`
    );
    expect(stringConstants.get('localhost')![0].fullPath).toBe('ROOT.host');
    expect(numberConstants.get('5432:decimal')![0].fullPath).toBe('ROOT.port');
  });

  it('recurses into nested objects', () => {
    const { stringConstants } = extract(`const o = { db: { name: 'main' } };`);
    expect(stringConstants.get('main')![0].fullPath).toBe('ROOT.db.name');
  });

  it('skips a property marked with constants-ignore-next-line', () => {
    const { stringConstants } = extract(
      `const o = {\n  // constants-ignore-next-line\n  secret: 'shh',\n};`
    );
    expect(stringConstants.has('shh')).toBe(false);
  });

  it('skips properties inside an ignore block', () => {
    const objectLiteral = firstOfKind(
      `const o = {\n  visible: 'shown',\n  hidden: 'masked',\n};`,
      SyntaxKind.ObjectLiteralExpression
    );
    const stringConstants = new Map<string, ConstantDefinition[]>();
    // "hidden" is on line 3; mark lines 3-3 as an ignore block.
    extractObjectProperties(
      objectLiteral,
      'ROOT',
      'test.ts',
      'pkg',
      stringConstants,
      new Map(),
      new Set(),
      [{ start: 3, end: 3 }]
    );
    expect(stringConstants.has('shown')).toBe(true);
    expect(stringConstants.has('masked')).toBe(false);
  });

  it('does nothing for a non-object node', () => {
    const identifier = firstOfKind(`const x = 1;`, SyntaxKind.Identifier);
    const strings = new Map<string, ConstantDefinition[]>();
    extractObjectProperties(
      identifier,
      'ROOT',
      'test.ts',
      'pkg',
      strings,
      new Map(),
      new Set(),
      []
    );
    expect(strings.size).toBe(0);
  });
});
