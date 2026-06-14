import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  analyzePackageConstants,
  createSkippedResult,
  shouldSkipFile,
} from '../../src/core/analyzePackage.js';

describe('createSkippedResult', () => {
  it('builds a skipped-but-successful result with empty findings', () => {
    expect(createSkippedResult('pkg', 'Pkg', 'why')).toEqual({
      packageName: 'pkg',
      displayName: 'Pkg',
      success: true,
      hasSourceFiles: false,
      skipped: true,
      skipReason: 'why',
      stringFindings: [],
      numberFindings: [],
    });
  });
});

describe('shouldSkipFile', () => {
  it('skips node_modules and declaration files', () => {
    expect(shouldSkipFile('/repo/node_modules/x/index.ts')).toBe(true);
    expect(shouldSkipFile('/repo/src/types.d.ts')).toBe(true);
  });

  it('keeps ordinary source files', () => {
    expect(shouldSkipFile('/repo/src/index.ts')).toBe(false);
  });
});

describe('analyzePackageConstants', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'constants-check-ap-'));
    await writeFile(join(dir, 'tsconfig.json'), JSON.stringify({ compilerOptions: {} }), 'utf8');
    await mkdir(join(dir, 'src'), { recursive: true });
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  async function src(name: string, contents: string): Promise<void> {
    await writeFile(join(dir, 'src', name), contents, 'utf8');
  }

  it('skips a package with no source files', async () => {
    const result = await analyzePackageConstants(dir, dir, 'pkg', 'Pkg');
    expect(result.skipped).toBe(true);
    expect(result.skipReason).toBe('No source files found');
  });

  it('reports a clean package as successful', async () => {
    await src('index.ts', `export const ONLY = 'unique-value-xyz';\n`);
    const result = await analyzePackageConstants(dir, dir, 'pkg', 'Pkg');
    expect(result.success).toBe(true);
    expect(result.hasSourceFiles).toBe(true);
    expect(result.stringFindings).toHaveLength(0);
  });

  it('detects duplicate string literals across files', async () => {
    await src('a.ts', `export function a() { return use('shared-literal-value'); }\n`);
    await src('b.ts', `export function b() { return use('shared-literal-value'); }\n`);

    const result = await analyzePackageConstants(dir, dir, 'pkg', 'Pkg');
    expect(result.success).toBe(false);
    expect(result.stringFindings.map((f) => f.value)).toContain('shared-literal-value');
  });

  it('detects duplicate magic numbers across files', async () => {
    await src('a.ts', `export function a() { return wait(98765); }\n`);
    await src('b.ts', `export function b() { return wait(98765); }\n`);

    const result = await analyzePackageConstants(dir, dir, 'pkg', 'Pkg');
    expect(result.success).toBe(false);
    expect(result.numberFindings.map((f) => f.value)).toContain(98765);
  });

  it('detects duplicate constant definitions with similar names', async () => {
    await src('a.ts', `export const MAX_SIZE = 4096;\n`);
    await src('b.ts', `export const MAX_SIZES = 4096;\n`);

    const result = await analyzePackageConstants(dir, dir, 'pkg', 'Pkg');
    expect(result.duplicateDefinitions?.totalDuplicates).toBeGreaterThan(0);
    expect(result.success).toBe(false);
  });

  it('skips literal scanning under definitionsOnly but still finds definitions', async () => {
    await src('a.ts', `export function a() { return use('shared-literal-value'); }\n`);
    await src('b.ts', `export function b() { return use('shared-literal-value'); }\n`);
    await src('c.ts', `export const MAX_SIZE = 4096;\nexport const MAX_SIZES = 4096;\n`);

    const result = await analyzePackageConstants(dir, dir, 'pkg', 'Pkg', {
      definitionsOnly: true,
    });
    expect(result.stringFindings).toHaveLength(0);
    expect(result.duplicateDefinitions?.totalDuplicates).toBeGreaterThan(0);
  });

  it('returns a skipped result when the tsconfig is missing', async () => {
    await rm(join(dir, 'tsconfig.json'));
    const result = await analyzePackageConstants(dir, dir, 'pkg', 'Pkg');
    expect(result.skipped).toBe(true);
    expect(result.skipReason).toBe('Could not initialize ts-morph project');
  });
});
