import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { runConstantsAnalyzer } from '../../src/core/analyzeProject.js';
import type { ExtendedConstantsResult } from '../../src/types/constantsTypes.js';

async function tsProject(dir: string): Promise<void> {
  await writeFile(join(dir, 'tsconfig.json'), JSON.stringify({ compilerOptions: {} }), 'utf8');
  await mkdir(join(dir, 'src'), { recursive: true });
}

describe('runConstantsAnalyzer', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'constants-check-proj-'));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('analyzes a single project and reports analysisMode "all"', async () => {
    await tsProject(root);
    await writeFile(
      join(root, 'src', 'a.ts'),
      `export function a() { return use('single-shared-value'); }\n`,
      'utf8'
    );
    await writeFile(
      join(root, 'src', 'b.ts'),
      `export function b() { return use('single-shared-value'); }\n`,
      'utf8'
    );

    const { results, analysisFailure, analysisMode } = await runConstantsAnalyzer({ root });

    expect(analysisMode).toBe('all');
    expect(analysisFailure).toBe(true);
    expect(results).toHaveLength(1);
    expect(results[0].stringFindings.map((f) => f.value)).toContain('single-shared-value');
  });

  it('reports no failure for a clean single project', async () => {
    await tsProject(root);
    await writeFile(join(root, 'src', 'a.ts'), `export const UNIQUE = 'just-one-value';\n`, 'utf8');

    const { analysisFailure } = await runConstantsAnalyzer({ root });
    expect(analysisFailure).toBe(false);
  });

  it('uses "specific" analysis mode when explicit paths are given', async () => {
    await tsProject(root);
    await writeFile(join(root, 'src', 'a.ts'), `export const A = 'x-unique-value';\n`, 'utf8');

    const { analysisMode } = await runConstantsAnalyzer({ root, paths: [root] });
    expect(analysisMode).toBe('specific');
  });

  it('filters results to the requested files', async () => {
    await tsProject(root);
    await writeFile(
      join(root, 'src', 'a.ts'),
      `export function a() { return use('filtered-shared-value'); }\n`,
      'utf8'
    );
    await writeFile(
      join(root, 'src', 'b.ts'),
      `export function b() { return use('filtered-shared-value'); }\n`,
      'utf8'
    );

    // Duplicates live in a.ts and b.ts; filtering to a non-matching file removes them.
    const { results, analysisFailure } = await runConstantsAnalyzer({
      root,
      files: ['does-not-exist.ts'],
    });
    expect(results[0].stringFindings).toHaveLength(0);
    expect(analysisFailure).toBe(false);
  });

  it('analyzes a monorepo and appends a cross-package result', async () => {
    await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'mono' }), 'utf8');
    await writeFile(join(root, 'tsconfig.json'), JSON.stringify({ compilerOptions: {} }), 'utf8');

    const pkgA = join(root, 'packages', 'pkg-a');
    await mkdir(join(pkgA, 'src'), { recursive: true });
    await writeFile(join(pkgA, 'package.json'), JSON.stringify({ name: 'pkg-a' }), 'utf8');
    await writeFile(join(pkgA, 'tsconfig.json'), JSON.stringify({ compilerOptions: {} }), 'utf8');
    await writeFile(join(pkgA, 'src', 'a.ts'), `export const ONLY_A = 'aaa-unique-value';\n`, 'utf8');

    const { results } = await runConstantsAnalyzer({ root, monorepo: true });

    // One per-package result plus the appended cross-package analysis.
    expect(results.some((r) => r.packageName === 'cross-package')).toBe(true);
    expect(results.length).toBeGreaterThanOrEqual(2);
  });

  it('keeps findings when the file filter matches their location', async () => {
    await tsProject(root);
    await writeFile(
      join(root, 'src', 'a.ts'),
      `export function a() { return use('kept-shared-value'); }\n`,
      'utf8'
    );
    await writeFile(
      join(root, 'src', 'b.ts'),
      `export function b() { return use('kept-shared-value'); }\n`,
      'utf8'
    );

    const { results, analysisFailure } = await runConstantsAnalyzer({ root, files: ['a.ts'] });
    expect(results[0].stringFindings.map((f) => f.value)).toContain('kept-shared-value');
    expect(analysisFailure).toBe(true);
  });

  it('skips literal scanning under definitionsOnly', async () => {
    await tsProject(root);
    await writeFile(
      join(root, 'src', 'a.ts'),
      `export function a() { return use('def-only-shared'); }\n`,
      'utf8'
    );
    await writeFile(
      join(root, 'src', 'b.ts'),
      `export function b() { return use('def-only-shared'); }\n`,
      'utf8'
    );

    const { results } = await runConstantsAnalyzer({ root, definitionsOnly: true });
    expect(results[0].stringFindings).toHaveLength(0);
  });

  it('passes crossPackageDefinitionsOnly through to suppress single-package duplicates', async () => {
    await tsProject(root);
    await writeFile(
      join(root, 'src', 'a.ts'),
      `export const MAX_SIZE = 4096;\nexport const MAX_SIZES = 4096;\n`,
      'utf8'
    );

    const flagged = await runConstantsAnalyzer({ root, crossPackageDefinitionsOnly: true });
    const flaggedResult = flagged.results[0] as ExtendedConstantsResult;
    expect(flaggedResult.duplicateDefinitions?.totalDuplicates).toBe(0);

    const baseline = await runConstantsAnalyzer({ root });
    const baselineResult = baseline.results[0] as ExtendedConstantsResult;
    expect(baselineResult.duplicateDefinitions!.totalDuplicates).toBeGreaterThan(0);
  });

  it('runs cross-package-only analysis and reports a single cross-package result', async () => {
    await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'mono' }), 'utf8');
    await writeFile(join(root, 'tsconfig.json'), JSON.stringify({ compilerOptions: {} }), 'utf8');
    for (const pkg of ['pkg-a', 'pkg-b']) {
      const dir = join(root, 'packages', pkg, 'src');
      await mkdir(dir, { recursive: true });
      await writeFile(
        join(dir, 'f.ts'),
        `export function f() { return use('xpkg-shared-value'); }\n`,
        'utf8'
      );
    }

    const { results, analysisMode } = await runConstantsAnalyzer({
      root,
      crossPackageOnly: true,
    });
    expect(results).toHaveLength(1);
    expect(results[0].packageName).toBe('cross-package');
    expect(analysisMode).toBe('all');
  });

  it('throws when monorepo mode finds no packages', async () => {
    await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'empty' }), 'utf8');
    await expect(runConstantsAnalyzer({ root, monorepo: true })).rejects.toThrow(
      /No packages found/
    );
  });
});
