import { describe, it, expect } from 'vitest';
import { formatAsJson, resolveThresholdStatus } from '../../src/reporter/jsonReporter.js';
import type { ExtendedConstantsResult } from '../../src/types/constantsTypes.js';

describe('resolveThresholdStatus', () => {
  it("is 'not-configured' when threshold is undefined", () => {
    expect(resolveThresholdStatus(5)).toBe('not-configured');
  });

  it("is 'over' when total exceeds the threshold", () => {
    expect(resolveThresholdStatus(6, 5)).toBe('over');
  });

  it("is 'under' when total is below the threshold", () => {
    expect(resolveThresholdStatus(4, 5)).toBe('under');
  });

  it("is 'at' when total equals the threshold", () => {
    expect(resolveThresholdStatus(5, 5)).toBe('at');
  });

  it('treats threshold of 0 as configured', () => {
    expect(resolveThresholdStatus(0, 0)).toBe('at');
    expect(resolveThresholdStatus(1, 0)).toBe('over');
  });
});

describe('formatAsJson', () => {
  function analyzedResult(): ExtendedConstantsResult {
    return {
      packageName: 'pkg',
      displayName: 'Pkg',
      success: false,
      hasSourceFiles: true,
      skipped: false,
      stringFindings: [
        {
          count: 3,
          fileCount: 2,
          files: ['a.ts', 'b.ts'],
          locations: [{ code: "'hello'", file: 'a.ts', line: 4 }],
          value: 'hello',
          suggestedConstants: [
            { name: 'GREETING', fullPath: 'GREETING', file: 'c.ts', line: 1, packageName: 'pkg' },
          ],
        },
      ],
      numberFindings: [
        {
          count: 2,
          fileCount: 1,
          files: ['a.ts'],
          locations: [{ code: '0xff', file: 'a.ts', line: 7 }],
          value: 255,
          numberFormat: 'hex',
        },
      ],
      duplicateDefinitions: {
        totalDuplicates: 1,
        affectedPackages: ['pkg'],
        duplicateDefinitions: [
          {
            name: 'GREETING',
            value: 'hello',
            valueType: 'string',
            definitions: [
              { name: 'GREETING', fullPath: 'GREETING', file: 'c.ts', line: 1, packageName: 'pkg' },
            ],
            packages: ['pkg'],
            recommendedPackage: 'pkg',
          },
        ],
      },
    };
  }

  it('produces valid, pretty-printed JSON', () => {
    const output = formatAsJson([analyzedResult()], false, 'all');
    expect(output).toContain('\n  '); // two-space indentation
    expect(() => JSON.parse(output)).not.toThrow();
  });

  it('sets success to the negation of analysisFailure', () => {
    expect(JSON.parse(formatAsJson([], false, 'all')).success).toBe(true);
    expect(JSON.parse(formatAsJson([], true, 'all')).success).toBe(false);
  });

  it('passes through the analysis mode', () => {
    expect(JSON.parse(formatAsJson([], false, 'specific')).analysisMode).toBe('specific');
  });

  it('summarizes issue counts from analyzed results', () => {
    const summary = JSON.parse(formatAsJson([analyzedResult()], false, 'all')).summary;
    expect(summary.totalPackages).toBe(1);
    expect(summary.packagesWithDuplicates).toBe(1);
    expect(summary.totalDuplicateStrings).toBe(3);
    expect(summary.totalDuplicateNumbers).toBe(2);
    expect(summary.totalDuplicateDefinitions).toBe(1);
    expect(summary.totalIssues).toBe(6);
  });

  it('omits threshold fields when no threshold is given', () => {
    const summary = JSON.parse(formatAsJson([analyzedResult()], false, 'all')).summary;
    expect(summary.threshold).toBeUndefined();
    expect(summary.thresholdStatus).toBeUndefined();
  });

  it('includes threshold and status when a threshold is given', () => {
    const summary = JSON.parse(formatAsJson([analyzedResult()], false, 'all', 10)).summary;
    expect(summary.threshold).toBe(10);
    expect(summary.thresholdStatus).toBe('under');
  });

  it('serializes finding details including numberFormat and suggestedConstants', () => {
    const result = JSON.parse(formatAsJson([analyzedResult()], false, 'all')).results[0];
    expect(result.stringFindings[0].suggestedConstants[0].name).toBe('GREETING');
    expect(result.numberFindings[0].numberFormat).toBe('hex');
    expect(result.duplicateDefinitions.duplicateDefinitions[0].recommendedPackage).toBe('pkg');
  });

  it('omits optional finding/result fields when absent', () => {
    const result = JSON.parse(formatAsJson([analyzedResult()], false, 'all')).results[0];
    // analyzedResult has no skipReason and its string finding has no numberFormat
    expect('skipReason' in result).toBe(false);
    expect('numberFormat' in result.stringFindings[0]).toBe(false);
  });

  it('excludes non-skipped results that have no source files from the summary', () => {
    const noSource: ExtendedConstantsResult = {
      packageName: 'empty',
      displayName: 'Empty',
      success: true,
      hasSourceFiles: false,
      skipped: false,
      stringFindings: [],
      numberFindings: [],
    };
    const summary = JSON.parse(formatAsJson([analyzedResult(), noSource], false, 'all')).summary;
    expect(summary.totalPackages).toBe(1);
  });

  it('counts only unsuccessful analyzed packages as having duplicates', () => {
    const clean: ExtendedConstantsResult = {
      packageName: 'clean',
      displayName: 'Clean',
      success: true,
      hasSourceFiles: true,
      skipped: false,
      stringFindings: [],
      numberFindings: [],
    };
    const summary = JSON.parse(formatAsJson([analyzedResult(), clean], false, 'all')).summary;
    expect(summary.totalPackages).toBe(2);
    expect(summary.packagesWithDuplicates).toBe(1);
  });

  it('excludes skipped results from the summary but keeps them in results', () => {
    const skipped: ExtendedConstantsResult = {
      packageName: 'skip',
      displayName: 'Skip',
      success: true,
      hasSourceFiles: false,
      skipped: true,
      skipReason: 'No source files found',
      stringFindings: [],
      numberFindings: [],
    };
    const output = JSON.parse(formatAsJson([analyzedResult(), skipped], false, 'all'));
    expect(output.summary.totalPackages).toBe(1);
    expect(output.results).toHaveLength(2);
    expect(output.results[1].skipReason).toBe('No source files found');
  });
});
