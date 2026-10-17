import { describe, it, expect } from 'vitest';
import { BUILT_IN_IGNORE, buildSourceGlobs } from '../../src/core/sourceGlobs.js';

describe('buildSourceGlobs', () => {
  it('keeps the includes first and always excludes node_modules and declarations', () => {
    expect(buildSourceGlobs(['/repo/packages/**/src/**/*.ts'], '/repo')).toEqual([
      '/repo/packages/**/src/**/*.ts',
      '!/repo/**/node_modules/**',
      '!/repo/**/*.d.ts',
    ]);
  });

  it('resolves user patterns against the root, after the built-in ones', () => {
    const globs = buildSourceGlobs(['/repo/src/**/*.ts'], '/repo', ['**/cdk.out/**', 'dist/**']);
    expect(globs.slice(1 + BUILT_IN_IGNORE.length)).toEqual([
      '!/repo/**/cdk.out/**',
      '!/repo/dist/**',
    ]);
  });

  it('keeps an absolute pattern as written', () => {
    const globs = buildSourceGlobs([], '/repo', ['/elsewhere/**']);
    expect(globs.at(-1)).toBe('!/elsewhere/**');
  });

  it('normalizes Windows separators so the glob matcher reads them', () => {
    const globs = buildSourceGlobs(['C:\\repo\\src\\**\\*.ts'], 'C:\\repo', ['build\\**']);
    expect(globs[0]).toBe('C:/repo/src/**/*.ts');
    expect(globs.at(-1)).toBe('!C:/repo/build/**');
  });
});
