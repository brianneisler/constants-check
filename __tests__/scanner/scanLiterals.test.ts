import { describe, it, expect } from 'vitest';
import { scanStrings, scanNumbers, convertToFindings } from '../../src/scanner/scanLiterals.js';
import type {
  ConstantDefinition,
  ConstantOccurrence,
  ConstantsConfig,
  LocationKey,
} from '../../src/types/constantsTypes.js';
import { createSourceFile } from '../helpers/tsMorph.js';

const config: ConstantsConfig = { minDuplication: 2, minStringLength: 3, ignoreNumbers: [] };

describe('scanStrings', () => {
  function scan(code: string, opts: Partial<ConstantsConfig> = {}, seedLocations: string[] = []) {
    const file = createSourceFile(code);
    const counts = new Map<string, ConstantOccurrence>();
    const locs = new Set<LocationKey>(seedLocations);
    scanStrings(file, 'test.ts', counts, { ...config, ...opts }, locs);
    return counts;
  }

  it('counts repeated string literals', () => {
    const counts = scan(`const a = 'hello'; let b = 'hello';`);
    expect(counts.get('hello')!.count).toBe(2);
    expect(counts.get('hello')!.files.has('test.ts')).toBe(true);
  });

  it('counts no-substitution template literals', () => {
    const counts = scan('const a = `hello`;');
    expect(counts.get('hello')!.count).toBe(1);
  });

  it('skips strings shorter than minStringLength', () => {
    expect(scan(`const a = 'ab';`).has('ab')).toBe(false);
  });

  it('skips import module specifiers', () => {
    const counts = scan(`import x from 'hello';\nconst a = 'hello';`);
    expect(counts.get('hello')!.count).toBe(1);
  });

  it('skips quoted property keys but counts values', () => {
    const counts = scan(`const o = { 'hello': 'world' };`);
    expect(counts.has('hello')).toBe(false);
    expect(counts.get('world')!.count).toBe(1);
  });

  it('skips literals used as types', () => {
    expect(scan(`type T = 'hello';`).has('hello')).toBe(false);
  });

  it('skips literals on a constants-ignore-next-line', () => {
    expect(scan(`// constants-ignore-next-line\nconst a = 'hello';`).has('hello')).toBe(false);
  });

  it('skips literals whose location is already a known constant', () => {
    expect(scan(`const a = 'hello';`, {}, ['test.ts:1']).has('hello')).toBe(false);
  });

  it('includes strings exactly at minStringLength (boundary)', () => {
    // length 3 with minStringLength 3 must be kept (strictly-less-than cutoff)
    const counts = scan(`const a = 'abc'; let b = 'abc';`);
    expect(counts.get('abc')!.count).toBe(2);
  });

  it('captures the trimmed source line as the location code', () => {
    const counts = scan(`  const a = 'hello'; let b = 'hello';`);
    expect(counts.get('hello')!.locations[0].code).toBe(`const a = 'hello'; let b = 'hello';`);
  });

  describe('module specifier literals are not counted as constants', () => {
    it('skips re-export module specifiers', () => {
      const counts = scan(`export { a } from 'my-module';\nexport * from 'my-module';`);
      expect(counts.has('my-module')).toBe(false);
    });

    it('skips import-equals require module specifiers', () => {
      const counts = scan(`import a = require('my-module');\nimport b = require('my-module');`);
      expect(counts.has('my-module')).toBe(false);
    });

    it('skips dynamic import() module specifiers', () => {
      const counts = scan(`const a = import('my-module');\nconst b = import('my-module');`);
      expect(counts.has('my-module')).toBe(false);
    });

    it('skips require() call module specifiers', () => {
      const counts = scan(`const a = require('my-module');\nconst b = require('my-module');`);
      expect(counts.has('my-module')).toBe(false);
    });

    it('skips vi.mock() module specifiers', () => {
      const counts = scan(`vi.mock('my-module');\nvi.mock('my-module', () => ({}));`);
      expect(counts.has('my-module')).toBe(false);
    });

    it('skips jest.mock() module specifiers', () => {
      const counts = scan(`jest.mock('my-module');\njest.mock('my-module', () => ({}));`);
      expect(counts.has('my-module')).toBe(false);
    });

    it('skips other vi/jest module-path helpers', () => {
      const counts = scan(
        [
          `vi.importActual('my-module');`,
          `vi.unmock('my-module');`,
          `jest.requireActual('my-module');`,
          `jest.setMock('my-module', {});`,
        ].join('\n')
      );
      expect(counts.has('my-module')).toBe(false);
    });
  });

  describe('test framework labels are not counted as constants', () => {
    it('skips duplicate it() labels', () => {
      const counts = scan(`it('shared label', () => {});\nit('shared label', () => {});`);
      expect(counts.has('shared label')).toBe(false);
    });

    it('skips duplicate describe() labels', () => {
      const counts = scan(
        `describe('shared label', () => {});\ndescribe('shared label', () => {});`
      );
      expect(counts.has('shared label')).toBe(false);
    });

    it('skips modifier and each-table label forms', () => {
      const counts = scan(
        [
          `test.only('shared label', () => {});`,
          `it.skip('shared label', () => {});`,
          `it.each(cases)('shared label', () => {});`,
        ].join('\n')
      );
      expect(counts.has('shared label')).toBe(false);
    });

    it('still counts duplicate strings inside a test body', () => {
      // The label is skipped, but a genuine duplicate value in the callback body
      // is still a real finding.
      const counts = scan(
        `it('label', () => {\n  const a = 'shared-value';\n  const b = 'shared-value';\n});`
      );
      expect(counts.has('label')).toBe(false);
      expect(counts.get('shared-value')!.count).toBe(2);
    });
  });

  describe('genuine duplicate strings are still counted', () => {
    it('still counts string args to non-module vi/jest methods', () => {
      // vi.setConfig / jest.setTimeout are not module-path helpers, so a literal
      // here is a genuine value and should still be reported.
      const counts = scan(`vi.setConfig('shared-value');\njest.setTimeout('shared-value');`);
      expect(counts.get('shared-value')!.count).toBe(2);
    });

    it('still counts .mock() calls on unrelated receivers', () => {
      // Only vi/jest receivers are module-path helpers; other objects are not.
      const counts = scan(`service.mock('shared-value');\nother.mock('shared-value');`);
      expect(counts.get('shared-value')!.count).toBe(2);
    });

    it('counts a string that only coincidentally shares a module name', () => {
      // The literal here is a plain string argument, not a module specifier,
      // so it should still be reported even though it equals a dynamic import.
      const counts = scan(
        `const a = import('my-module');\nconst b = 'my-module';\nconst c = 'my-module';`
      );
      expect(counts.get('my-module')!.count).toBe(2);
    });
  });
});

describe('scanNumbers', () => {
  function scan(code: string, opts: Partial<ConstantsConfig> = {}) {
    const file = createSourceFile(code);
    const counts = new Map<string, ConstantOccurrence>();
    const locs = new Set<LocationKey>();
    scanNumbers(file, 'test.ts', counts, { ...config, ...opts }, locs);
    return counts;
  }

  it('counts repeated numbers keyed by value and format', () => {
    const counts = scan(`const a = 7; let b = 7;`);
    expect(counts.get('7:decimal')!.count).toBe(2);
  });

  it('preserves numeric format in the key', () => {
    const counts = scan(`const a = 0xFF; let b = 0xFF;`);
    expect(counts.get('255:hex')!.numberFormat).toBe('hex');
  });

  it('skips numbers listed in ignoreNumbers', () => {
    expect(scan(`const a = 7;`, { ignoreNumbers: [7] }).has('7:decimal')).toBe(false);
  });

  it('skips array index positions', () => {
    expect(scan(`arr[7];`).has('7:decimal')).toBe(false);
  });

  it('skips numbers used as types', () => {
    expect(scan(`type T = 7;`).has('7:decimal')).toBe(false);
  });

  it('skips numbers whose location is already a known constant', () => {
    const file = createSourceFile(`const a = 7;`);
    const counts = new Map<string, ConstantOccurrence>();
    scanNumbers(file, 'test.ts', counts, config, new Set(['test.ts:1']));
    expect(counts.has('7:decimal')).toBe(false);
  });

  it('skips numbers inside an ignore block', () => {
    expect(
      scan(`// constants-ignore-start\nconst a = 7;\n// constants-ignore-end`).has('7:decimal')
    ).toBe(false);
  });
});

describe('convertToFindings', () => {
  function occurrence(over: Partial<ConstantOccurrence> = {}): ConstantOccurrence {
    return { count: 1, files: new Set(['a.ts']), locations: [], ...over };
  }

  it('keeps only values duplicated across at least minDuplication files', () => {
    const counts = new Map<string, ConstantOccurrence>([
      ['kept', occurrence({ count: 3, files: new Set(['a.ts', 'b.ts']) })],
      ['dropped', occurrence({ count: 9, files: new Set(['a.ts']) })],
    ]);
    const findings = convertToFindings(counts, new Map(), config);
    expect(findings.map((f) => f.value)).toEqual(['kept']);
  });

  it('sorts findings by descending occurrence count', () => {
    const counts = new Map<string, ConstantOccurrence>([
      ['low', occurrence({ count: 3, files: new Set(['a.ts', 'b.ts']) })],
      ['high', occurrence({ count: 8, files: new Set(['a.ts', 'b.ts']) })],
    ]);
    const findings = convertToFindings(counts, new Map(), config);
    expect(findings.map((f) => f.value)).toEqual(['high', 'low']);
  });

  it('parses numeric values and carries the number format', () => {
    const counts = new Map<string, ConstantOccurrence>([
      ['255:hex', occurrence({ count: 2, files: new Set(['a.ts', 'b.ts']), numberFormat: 'hex' })],
    ]);
    const findings = convertToFindings(counts, new Map(), config);
    expect(findings[0].value).toBe(255);
    expect(findings[0].numberFormat).toBe('hex');
  });

  it('attaches suggested constants sorted by package then file', () => {
    const counts = new Map<string, ConstantOccurrence>([
      ['hello', occurrence({ count: 2, files: new Set(['a.ts', 'b.ts']) })],
    ]);
    const constants = new Map<string, ConstantDefinition[]>([
      [
        'hello',
        [
          { name: 'B', value: 'hello', file: 'z.ts', line: 1, packageName: 'zeta' },
          { name: 'A', value: 'hello', file: 'a.ts', line: 1, packageName: 'alpha' },
        ],
      ],
    ]);
    const findings = convertToFindings(counts, constants, config);
    expect(findings[0].suggestedConstants!.map((c) => c.packageName)).toEqual(['alpha', 'zeta']);
  });

  it('omits suggested constants when there is no match', () => {
    const counts = new Map<string, ConstantOccurrence>([
      ['hello', occurrence({ count: 2, files: new Set(['a.ts', 'b.ts']) })],
    ]);
    expect(convertToFindings(counts, new Map(), config)[0].suggestedConstants).toBeUndefined();
  });

  it('omits suggested constants when the matching bucket is empty', () => {
    const counts = new Map<string, ConstantOccurrence>([
      ['hello', occurrence({ count: 2, files: new Set(['a.ts', 'b.ts']) })],
    ]);
    const constants = new Map<string, ConstantDefinition[]>([['hello', []]]);
    expect(convertToFindings(counts, constants, config)[0].suggestedConstants).toBeUndefined();
  });

  it('breaks suggestion ties within a package by file name', () => {
    const counts = new Map<string, ConstantOccurrence>([
      ['hello', occurrence({ count: 2, files: new Set(['a.ts', 'b.ts']) })],
    ]);
    const constants = new Map<string, ConstantDefinition[]>([
      [
        'hello',
        [
          { name: 'B', value: 'hello', file: 'z.ts', line: 1, packageName: 'same' },
          { name: 'A', value: 'hello', file: 'a.ts', line: 1, packageName: 'same' },
        ],
      ],
    ]);
    const findings = convertToFindings(counts, constants, config);
    expect(findings[0].suggestedConstants!.map((c) => c.file)).toEqual(['a.ts', 'z.ts']);
  });

  it('exposes the deduplicated files array and no numberFormat for strings', () => {
    const counts = new Map<string, ConstantOccurrence>([
      ['hello', occurrence({ count: 2, files: new Set(['a.ts', 'b.ts']) })],
    ]);
    const finding = convertToFindings(counts, new Map(), config)[0];
    expect(finding.files.sort()).toEqual(['a.ts', 'b.ts']);
    expect('numberFormat' in finding).toBe(false);
  });
});
