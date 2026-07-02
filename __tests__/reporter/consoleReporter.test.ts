import { describe, it, expect, vi } from 'vitest';
import {
  printPackageResults,
  printConstantsSummary,
  printThresholdSummary,
  printUsage,
} from '../../src/reporter/consoleReporter.js';
import type { ConstantFinding, ExtendedConstantsResult } from '../../src/types/constantsTypes.js';

// eslint-disable-next-line no-control-regex
const ANSI = /\x1b\[[0-9;]*m/g;

function capture(fn: () => void): string {
  const lines: string[] = [];
  const spy = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    lines.push(args.map(String).join(' '));
  });
  try {
    fn();
  } finally {
    spy.mockRestore();
  }
  return lines.join('\n').replace(ANSI, '');
}

const SEP = '=========================================';
const SUB = '-----------------------------------------';
const HEAVY = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';

function result(over: Partial<ExtendedConstantsResult> = {}): ExtendedConstantsResult {
  return {
    packageName: 'pkg',
    displayName: 'Pkg',
    success: true,
    hasSourceFiles: true,
    skipped: false,
    stringFindings: [],
    numberFindings: [],
    ...over,
  };
}

function stringFinding(value: string, over: Partial<ConstantFinding> = {}): ConstantFinding {
  return {
    count: 2,
    fileCount: 2,
    files: ['a.ts', 'b.ts'],
    locations: [{ code: `const X = "${value}"`, file: 'a.ts', line: 1 }],
    value,
    ...over,
  };
}

const header = `\n${SEP}\n  Pkg - Constants Report\n${SEP}`;

describe('printPackageResults', () => {
  it('renders a skipped package exactly', () => {
    expect(
      capture(() =>
        printPackageResults(result({ skipped: true, skipReason: 'No source files found' }))
      )
    ).toBe(`${header}\n[CONSTANTS] Skipped: No source files found`);
  });

  it('renders a no-source package exactly', () => {
    expect(capture(() => printPackageResults(result({ hasSourceFiles: false })))).toBe(
      `${header}\n[CONSTANTS] No source files to analyze`
    );
  });

  it('renders a clean package exactly', () => {
    expect(capture(() => printPackageResults(result()))).toBe(
      `${header}\n[CONSTANTS] ✅ No duplicate constants found`
    );
  });

  it('renders repeated strings exactly', () => {
    const out = capture(() =>
      printPackageResults(result({ success: false, stringFindings: [stringFinding('hello')] }))
    );
    expect(out).toBe(
      `${header}\n\nFound 1 Repeated Strings (across multiple files):\n\n` +
        `String: "hello"\n  - Count: 2 occurrences in 2 files\n  - Locations:\n` +
        `      a.ts:1\n        const X = "hello"\n${SUB}`
    );
  });

  it('renders repeated numbers without quoting the value', () => {
    const finding: ConstantFinding = {
      count: 3,
      fileCount: 2,
      files: ['a.ts', 'b.ts'],
      locations: [{ code: 'const X = 42', file: 'a.ts', line: 1 }],
      value: 42,
    };
    const out = capture(() =>
      printPackageResults(result({ success: false, numberFindings: [finding] }))
    );
    expect(out).toBe(
      `${header}\n\nFound 1 Repeated Magic Numbers (across multiple files):\n\n` +
        `Number: 42\n  - Count: 3 occurrences in 2 files\n  - Locations:\n` +
        `      a.ts:1\n        const X = 42\n${SUB}`
    );
  });

  it('lists suggested constants', () => {
    const finding = stringFinding('hello', {
      locations: [{ code: 'x', file: 'a.ts', line: 1 }],
      suggestedConstants: [
        { name: 'GREETING', fullPath: 'GREETING', file: 'c.ts', line: 1, packageName: 'pkg' },
      ],
    });
    const out = capture(() =>
      printPackageResults(result({ success: false, stringFindings: [finding] }))
    );
    expect(out).toContain('  ⚠️  Did you mean to use one of these constants?');
    expect(out).toContain('      • GREETING (c.ts:1)');
  });

  it('truncates long finding lists', () => {
    const findings = Array.from({ length: 21 }, (_, i) => stringFinding(`value-${i}`));
    const out = capture(() =>
      printPackageResults(result({ success: false, stringFindings: findings }))
    );
    expect(out).toContain('Found 21 Repeated Strings (across multiple files):');
    expect(out).toContain('... and 1 more strings');
  });

  it('renders a numeric duplicate definition group exactly', () => {
    const out = capture(() =>
      printPackageResults(
        result({
          success: false,
          duplicateDefinitions: {
            totalDuplicates: 1,
            affectedPackages: ['pkg'],
            duplicateDefinitions: [
              {
                name: 'TIMEOUT',
                value: 5000,
                valueType: 'number',
                definitions: [
                  { name: 'TIMEOUT', value: 5000, file: 'a.ts', line: 1, packageName: 'pkg' },
                ],
                packages: ['pkg'],
                recommendedPackage: 'pkg',
              },
            ],
          },
        })
      )
    );
    expect(out).toBe(
      `${header}\n\n${HEAVY}\n📦 DUPLICATE CONSTANT DEFINITIONS\n${HEAVY}\n\n` +
        `⚠️  Found 1 duplicate constant definitions (similar names + exact values):\n\n` +
        `⚠️ TIMEOUT\n  - Type: number\n  - Value: 5000\n  - Defined in 1 packages: pkg\n` +
        `  - Total definitions: 1\n\n  Locations:\n    • TIMEOUT in pkg\n      a.ts:1\n\n` +
        `💡 Recommendation: Move to pkg\n      Target: pkg/src/constants/\n${SUB}\n\n` +
        `Summary:\n  - Total duplicate constant definitions: 1\n  - Affected packages: pkg\n`
    );
  });

  it('formats object-valued definitions as indented JSON', () => {
    const out = capture(() =>
      printPackageResults(
        result({
          success: false,
          duplicateDefinitions: {
            totalDuplicates: 1,
            affectedPackages: ['pkg'],
            duplicateDefinitions: [
              {
                name: 'CFG',
                value: { a: 1, b: 2 },
                valueType: 'object',
                definitions: [
                  {
                    name: 'CFG',
                    value: 'x',
                    file: 'a.ts',
                    line: 1,
                    packageName: 'pkg',
                    fullPath: 'CFG',
                  },
                ],
                packages: ['pkg'],
                recommendedPackage: 'pkg',
              },
            ],
          },
        })
      )
    );
    expect(out).toContain('  - Value: {\n        "a": 1,\n        "b": 2\n      }');
  });
});

describe('printConstantsSummary', () => {
  it('summarizes packages with duplicates exactly', () => {
    const withDupes = result({
      success: false,
      stringFindings: [stringFinding('hello')],
      duplicateDefinitions: {
        totalDuplicates: 2,
        affectedPackages: ['pkg'],
        duplicateDefinitions: [],
      },
    });
    const out = capture(() => printConstantsSummary([withDupes], 'all'));
    expect(out).toBe(
      `\n${SEP}\n      DUPLICATE CONSTANTS SUMMARY\n${SEP}\n\n` +
        `Packages analyzed: 1\nPackages with duplicates: 1\nTotal duplicate strings: 1\n` +
        `Total duplicate numbers: 0\nTotal duplicate definitions: 2\n\n` +
        `[CONSTANTS] Packages with duplicate constants:\n  Pkg: 1 strings, 0 numbers, 2 definitions\n\n` +
        `Recommended Actions:\n  1. Create a shared constants file: src/constants/shared.ts\n` +
        `  2. Start with the most frequently duplicated values\n` +
        `  3. Use IDE refactoring tools to replace raw values\n` +
        `  4. Rerun this analysis to verify improvements\n\n` +
        `[CONSTANTS] Analysis complete for all packages`
    );
  });

  it('omits the definitions fragment when a package has none', () => {
    const noDefs = result({
      success: false,
      stringFindings: [stringFinding('hello')],
      duplicateDefinitions: { totalDuplicates: 0, affectedPackages: [], duplicateDefinitions: [] },
    });
    const out = capture(() => printConstantsSummary([noDefs], 'all'));
    expect(out).toContain('  Pkg: 1 strings, 0 numbers\n');
  });

  it('celebrates a clean run and notes selective mode exactly', () => {
    const out = capture(() => printConstantsSummary([result()], 'specific'));
    expect(out).toBe(
      `\n${SEP}\n      DUPLICATE CONSTANTS SUMMARY\n${SEP}\n\n` +
        `Packages analyzed: 1\nPackages with duplicates: 0\nTotal duplicate strings: 0\n` +
        `Total duplicate numbers: 0\nTotal duplicate definitions: 0\n\n` +
        `[CONSTANTS] ✅ No duplicate constants found across packages!\n` +
        `[CONSTANTS] Analysis complete for selected packages`
    );
  });
});

describe('printThresholdSummary', () => {
  it('renders the over-threshold message exactly', () => {
    expect(capture(() => printThresholdSummary(10, 5))).toBe(
      `\n[CONSTANTS] Issue count 10 exceeds threshold 5. Fix issues to get the count to 5 or below.`
    );
  });

  it('renders the under-threshold message exactly', () => {
    expect(capture(() => printThresholdSummary(3, 5))).toBe(
      `\n[CONSTANTS] Issue count 3 is below threshold 5. Consider lowering the threshold to 3 to lock in progress.`
    );
  });

  it('renders the at-threshold message exactly', () => {
    expect(capture(() => printThresholdSummary(5, 5))).toBe(
      `\n[CONSTANTS] Issue count 5 is at the configured threshold.`
    );
  });
});

describe('printUsage', () => {
  it('prints CLI usage examples exactly', () => {
    expect(capture(() => printUsage())).toBe(
      `\nUsage:\n` +
        `  npx constants-check                    # Analyze current directory\n` +
        `  npx constants-check --check            # Fail on duplicates (CI mode)\n` +
        `  npx constants-check --monorepo        # Analyze monorepo packages\n` +
        `  npx constants-check --cross-package   # Cross-package analysis only\n` +
        `  npx constants-check --definitions-only # Check definitions only\n`
    );
  });
});
