import { describe, it, expect } from 'vitest';
import { computeIssueCount } from '../../src/core/computeIssueCount.js';
import type { ConstantsResult, ExtendedConstantsResult } from '../../src/types/constantsTypes.js';

function makeResult(overrides: Partial<ConstantsResult> = {}): ConstantsResult {
  return {
    packageName: 'pkg',
    displayName: 'pkg',
    success: true,
    hasSourceFiles: true,
    skipped: false,
    stringFindings: [],
    numberFindings: [],
    ...overrides,
  };
}

describe('computeIssueCount', () => {
  it('returns zeros for empty input', () => {
    expect(computeIssueCount([])).toEqual({
      stringIssues: 0,
      numberIssues: 0,
      definitionIssues: 0,
      total: 0,
    });
  });

  it('sums finding.count (not length) across string and number findings', () => {
    const result = makeResult({
      stringFindings: [
        { count: 5, fileCount: 2, files: [], locations: [], value: 'a' },
        { count: 3, fileCount: 1, files: [], locations: [], value: 'b' },
      ],
      numberFindings: [{ count: 7, fileCount: 3, files: [], locations: [], value: 42 }],
    });

    const counts = computeIssueCount([result]);
    expect(counts.stringIssues).toBe(8);
    expect(counts.numberIssues).toBe(7);
    expect(counts.definitionIssues).toBe(0);
    expect(counts.total).toBe(15);
  });

  it('includes duplicateDefinitions.totalDuplicates from extended results', () => {
    const extended: ExtendedConstantsResult = {
      ...makeResult({
        stringFindings: [{ count: 2, fileCount: 1, files: [], locations: [], value: 'x' }],
      }),
      duplicateDefinitions: {
        totalDuplicates: 4,
        affectedPackages: ['pkg-a', 'pkg-b'],
        duplicateDefinitions: [],
      },
    };

    const counts = computeIssueCount([extended]);
    expect(counts.stringIssues).toBe(2);
    expect(counts.definitionIssues).toBe(4);
    expect(counts.total).toBe(6);
  });

  it('handles a mix of ConstantsResult and ExtendedConstantsResult', () => {
    const plain = makeResult({
      stringFindings: [{ count: 1, fileCount: 1, files: [], locations: [], value: 'a' }],
    });
    const extended: ExtendedConstantsResult = {
      ...makeResult(),
      duplicateDefinitions: {
        totalDuplicates: 3,
        affectedPackages: [],
        duplicateDefinitions: [],
      },
    };

    const counts = computeIssueCount([plain, extended]);
    expect(counts.total).toBe(4);
  });

  it('skips results that were skipped or have no source files', () => {
    const skipped = makeResult({
      skipped: true,
      stringFindings: [{ count: 99, fileCount: 1, files: [], locations: [], value: 'a' }],
    });
    const noSource = makeResult({
      hasSourceFiles: false,
      numberFindings: [{ count: 99, fileCount: 1, files: [], locations: [], value: 1 }],
    });

    expect(computeIssueCount([skipped, noSource]).total).toBe(0);
  });
});
