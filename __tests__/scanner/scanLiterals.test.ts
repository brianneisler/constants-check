import { describe, it, expect } from 'vitest';
import { Project } from 'ts-morph';
import { scanStrings } from '../../src/scanner/scanLiterals.js';
import type { ConstantOccurrence, ConstantsConfig } from '../../src/types/constantsTypes.js';

const config: ConstantsConfig = {
  ignoreNumbers: [],
  minDuplication: 1,
  minStringLength: 2,
};

function scanStringLiterals(code: string): Map<string, ConstantOccurrence> {
  const project = new Project({ useInMemoryFileSystem: true });
  const file = project.createSourceFile('test.ts', code);
  const counts = new Map<string, ConstantOccurrence>();
  scanStrings(file, 'test.ts', counts, config, new Set());
  return counts;
}

describe('scanStrings', () => {
  describe('import literals are not counted as constants', () => {
    it('ignores static import module specifiers', () => {
      const counts = scanStringLiterals(
        `import foo from 'my-module';\nimport { bar } from 'my-module';`
      );
      expect(counts.has('my-module')).toBe(false);
    });

    it('ignores re-export module specifiers', () => {
      const counts = scanStringLiterals(
        `export { a } from 'my-module';\nexport * from 'my-module';`
      );
      expect(counts.has('my-module')).toBe(false);
    });

    it('ignores import-equals require module specifiers', () => {
      const counts = scanStringLiterals(
        `import a = require('my-module');\nimport b = require('my-module');`
      );
      expect(counts.has('my-module')).toBe(false);
    });

    it('ignores dynamic import() module specifiers', () => {
      const counts = scanStringLiterals(
        `const a = import('my-module');\nconst b = import('my-module');`
      );
      expect(counts.has('my-module')).toBe(false);
    });

    it('ignores require() call module specifiers', () => {
      const counts = scanStringLiterals(
        `const a = require('my-module');\nconst b = require('my-module');`
      );
      expect(counts.has('my-module')).toBe(false);
    });
  });

  describe('genuine duplicate string literals are still counted', () => {
    it('counts repeated string values used as data', () => {
      const counts = scanStringLiterals(
        `const a = 'duplicate-value';\nconst b = 'duplicate-value';`
      );
      expect(counts.get('duplicate-value')?.count).toBe(2);
    });

    it('counts a string that only coincidentally shares a module name', () => {
      // The literal here is a plain string argument, not a module specifier,
      // so it should still be reported even though it equals a dynamic import.
      const counts = scanStringLiterals(
        `const a = import('my-module');\nconst b = 'my-module';\nconst c = 'my-module';`
      );
      expect(counts.get('my-module')?.count).toBe(2);
    });
  });
});
