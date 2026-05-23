/**
 * JSON output formatter for constants analysis
 */

import type {
  ConstantsResult,
  ConstantFinding,
  DuplicateDefinitionGroup,
  ExtendedConstantsResult,
} from '../types/constantsTypes.js';
import { computeIssueCount } from '../core/computeIssueCount.js';

export type ThresholdStatus = 'under' | 'at' | 'over' | 'not-configured';

export function resolveThresholdStatus(total: number, threshold?: number): ThresholdStatus {
  if (threshold == null) return 'not-configured';
  if (total > threshold) return 'over';
  if (total < threshold) return 'under';
  return 'at';
}

interface JsonFinding {
  count: number;
  fileCount: number;
  files: string[];
  locations: Array<{ code: string; file: string; line: number }>;
  value: string | number;
  numberFormat?: string;
  suggestedConstants?: Array<{
    name: string;
    fullPath?: string;
    file: string;
    line: number;
    packageName: string;
  }>;
}

interface JsonDuplicateGroup {
  name: string;
  valueType: string;
  value: string | number | object;
  definitions: Array<{
    name: string;
    fullPath?: string;
    file: string;
    line: number;
    packageName: string;
  }>;
  packages: string[];
  recommendedPackage: string;
}

interface JsonPackageResult {
  packageName: string;
  displayName: string;
  success: boolean;
  hasSourceFiles: boolean;
  skipped: boolean;
  skipReason?: string;
  stringFindings: JsonFinding[];
  numberFindings: JsonFinding[];
  duplicateDefinitions?: {
    totalDuplicates: number;
    affectedPackages: string[];
    duplicateDefinitions: JsonDuplicateGroup[];
  };
}

interface JsonOutput {
  success: boolean;
  analysisMode: string;
  results: JsonPackageResult[];
  summary: {
    totalPackages: number;
    packagesWithDuplicates: number;
    totalDuplicateStrings: number;
    totalDuplicateNumbers: number;
    totalDuplicateDefinitions: number;
    totalIssues: number;
    threshold?: number;
    thresholdStatus?: ThresholdStatus;
  };
}

function findingToJson(finding: ConstantFinding): JsonFinding {
  const json: JsonFinding = {
    count: finding.count,
    fileCount: finding.fileCount,
    files: finding.files,
    locations: finding.locations,
    value: finding.value,
  };
  if (finding.numberFormat) json.numberFormat = finding.numberFormat;
  if (finding.suggestedConstants) {
    json.suggestedConstants = finding.suggestedConstants.map((c) => ({
      name: c.name,
      fullPath: c.fullPath,
      file: c.file,
      line: c.line,
      packageName: c.packageName,
    }));
  }
  return json;
}

function groupToJson(group: DuplicateDefinitionGroup): JsonDuplicateGroup {
  return {
    name: group.name,
    valueType: group.valueType,
    value: group.value,
    definitions: group.definitions.map((d) => ({
      name: d.name,
      fullPath: d.fullPath,
      file: d.file,
      line: d.line,
      packageName: d.packageName,
    })),
    packages: group.packages,
    recommendedPackage: group.recommendedPackage,
  };
}

function resultToJson(result: ConstantsResult | ExtendedConstantsResult): JsonPackageResult {
  const json: JsonPackageResult = {
    packageName: result.packageName,
    displayName: result.displayName,
    success: result.success,
    hasSourceFiles: result.hasSourceFiles,
    skipped: result.skipped,
    stringFindings: result.stringFindings.map(findingToJson),
    numberFindings: result.numberFindings.map(findingToJson),
  };
  if (result.skipReason) json.skipReason = result.skipReason;
  const extended = result as ExtendedConstantsResult;
  if (extended.duplicateDefinitions) {
    json.duplicateDefinitions = {
      totalDuplicates: extended.duplicateDefinitions.totalDuplicates,
      affectedPackages: extended.duplicateDefinitions.affectedPackages,
      duplicateDefinitions: extended.duplicateDefinitions.duplicateDefinitions.map(groupToJson),
    };
  }
  return json;
}

export function formatAsJson(
  results: (ConstantsResult | ExtendedConstantsResult)[],
  analysisFailure: boolean,
  analysisMode: string,
  threshold?: number
): string {
  const analyzedResults = results.filter((r) => !r.skipped && r.hasSourceFiles);
  const packagesWithDuplicates = analyzedResults.filter((r) => !r.success);

  const counts = computeIssueCount(analyzedResults);

  const summary: JsonOutput['summary'] = {
    totalPackages: analyzedResults.length,
    packagesWithDuplicates: packagesWithDuplicates.length,
    totalDuplicateStrings: counts.stringIssues,
    totalDuplicateNumbers: counts.numberIssues,
    totalDuplicateDefinitions: counts.definitionIssues,
    totalIssues: counts.total,
  };

  if (threshold != null) {
    summary.threshold = threshold;
    summary.thresholdStatus = resolveThresholdStatus(counts.total, threshold);
  }

  const output: JsonOutput = {
    success: !analysisFailure,
    analysisMode,
    results: results.map(resultToJson),
    summary,
  };

  return JSON.stringify(output, null, 2);
}
