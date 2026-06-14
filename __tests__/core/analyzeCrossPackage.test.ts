import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { analyzeCrossPackageConstants } from '../../src/core/analyzeCrossPackage.js';

describe('analyzeCrossPackageConstants', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'constants-check-cp-'));
    await writeFile(join(root, 'tsconfig.json'), JSON.stringify({ compilerOptions: {} }), 'utf8');
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  async function pkgFile(pkg: string, name: string, contents: string): Promise<void> {
    const dir = join(root, 'packages', pkg, 'src');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, name), contents, 'utf8');
  }

  it('skips when there are no package source files', async () => {
    const result = await analyzeCrossPackageConstants(root);
    expect(result.skipped).toBe(true);
    expect(result.skipReason).toBe('No source files found for cross-package analysis');
  });

  it('detects a literal duplicated across packages', async () => {
    await pkgFile('pkg-a', 'a.ts', `export function a() { return use('cross-shared-value'); }\n`);
    await pkgFile('pkg-b', 'b.ts', `export function b() { return use('cross-shared-value'); }\n`);

    const result = await analyzeCrossPackageConstants(root);
    expect(result.success).toBe(false);
    expect(result.packageName).toBe('cross-package');
    expect(result.stringFindings.map((f) => f.value)).toContain('cross-shared-value');
  });

  it('detects duplicate definitions across packages under definitionsOnly', async () => {
    await pkgFile('pkg-a', 'a.ts', `export const API_TIMEOUT = 30000;\n`);
    await pkgFile('pkg-b', 'b.ts', `export const API_TIMEOUTS = 30000;\n`);

    const result = await analyzeCrossPackageConstants(root, { definitionsOnly: true });
    expect(result.stringFindings).toHaveLength(0);
    expect(result.duplicateDefinitions?.totalDuplicates).toBeGreaterThan(0);
    expect(result.success).toBe(false);
  });

  it('returns success for a clean cross-package set', async () => {
    await pkgFile('pkg-a', 'a.ts', `export const UNIQUE_A = 'value-a-unique';\n`);
    await pkgFile('pkg-b', 'b.ts', `export const UNIQUE_B = 'value-b-unique';\n`);

    const result = await analyzeCrossPackageConstants(root);
    expect(result.success).toBe(true);
  });

  it('fails on a number duplicated across packages', async () => {
    await pkgFile('pkg-a', 'a.ts', `export function a() { return wait(54321); }\n`);
    await pkgFile('pkg-b', 'b.ts', `export function b() { return wait(54321); }\n`);

    const result = await analyzeCrossPackageConstants(root);
    expect(result.success).toBe(false);
    expect(result.numberFindings.map((f) => f.value)).toContain(54321);
  });

  it('labels definitions with the owning package name parsed from the path', async () => {
    await pkgFile('pkg-a', 'a.ts', `export const API_TIMEOUT = 30000;\n`);
    await pkgFile('pkg-b', 'b.ts', `export const API_TIMEOUTS = 30000;\n`);

    const result = await analyzeCrossPackageConstants(root);
    // Non-definitionsOnly run still fails because the definitions are duplicated.
    expect(result.success).toBe(false);
    const group = result.duplicateDefinitions!.duplicateDefinitions[0];
    expect(group.packages.sort()).toEqual(['pkg-a', 'pkg-b']);
  });
});
