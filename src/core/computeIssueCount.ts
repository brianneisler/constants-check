/**
 * Aggregate issue counts across analyzed results.
 *
 * Each occurrence of a duplicate literal counts as one issue, plus every
 * duplicate constant definition.
 */

import type { ConstantsResult, ExtendedConstantsResult } from '../types/constantsTypes.js';

export interface IssueCount {
  stringIssues: number;
  numberIssues: number;
  definitionIssues: number;
  total: number;
}

export function computeIssueCount(
  results: (ConstantsResult | ExtendedConstantsResult)[]
): IssueCount {
  let stringIssues = 0;
  let numberIssues = 0;
  let definitionIssues = 0;

  for (const result of results) {
    if (result.skipped || !result.hasSourceFiles) continue;

    for (const finding of result.stringFindings) {
      stringIssues += finding.count;
    }
    for (const finding of result.numberFindings) {
      numberIssues += finding.count;
    }

    const ext = result as ExtendedConstantsResult;
    if (ext.duplicateDefinitions) {
      definitionIssues += ext.duplicateDefinitions.totalDuplicates;
    }
  }

  return {
    stringIssues,
    numberIssues,
    definitionIssues,
    total: stringIssues + numberIssues + definitionIssues,
  };
}
