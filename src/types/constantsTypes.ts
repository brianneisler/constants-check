/**
 * Constants Detection Type Definitions
 *
 * TypeScript interfaces and types used throughout the constants detection analysis system.
 */

/**
 * Represents a single location where a constant appears.
 */
export interface ConstantLocation {
  code: string;
  file: string;
  line: number;
}

/**
 * Number format for distinguishing between semantically different numeric representations
 */
export type NumberFormat = 'decimal' | 'hex' | 'octal' | 'binary';

/**
 * Represents a defined constant in the codebase (SCREAMING_SNAKE_CASE const variables).
 */
export interface ConstantDefinition {
  name: string;
  value: string | number;
  file: string;
  line: number;
  packageName: string;
  fullPath?: string;
  numberFormat?: NumberFormat;
}

/**
 * Represents a single occurrence of a constant value in the codebase.
 */
export interface ConstantOccurrence {
  count: number;
  files: Set<string>;
  locations: ConstantLocation[];
  numberFormat?: NumberFormat;
}

/**
 * Key to identify a constant definition location (for exclusion from duplicates)
 */
export type LocationKey = string;

/**
 * Configuration options for the constants detection analysis.
 */
export interface ConstantsConfig {
  minDuplication: number;
  minStringLength: number;
  ignoreNumbers: number[];
}

/**
 * Result of constants detection analysis for a single package/project.
 */
export interface ConstantsResult {
  packageName: string;
  displayName: string;
  success: boolean;
  hasSourceFiles: boolean;
  skipped: boolean;
  skipReason?: string;
  stringFindings: ConstantFinding[];
  numberFindings: ConstantFinding[];
}

/**
 * A single finding of a duplicated constant.
 */
export interface ConstantFinding {
  count: number;
  fileCount: number;
  files: string[];
  locations: ConstantLocation[];
  value: string | number;
  numberFormat?: NumberFormat;
  suggestedConstants?: ConstantDefinition[];
}

/**
 * Aggregated findings across all packages.
 */
export interface AggregatedFindings {
  strings: Map<string, ConstantOccurrence>;
  numbers: Map<number, ConstantOccurrence>;
}

/**
 * Summary statistics for the constants detection report.
 */
export interface ConstantsSummary {
  totalPackagesAnalyzed: number;
  totalFilesScanned: number;
  duplicateStringsFound: number;
  duplicateNumbersFound: number;
}

/**
 * Represents a group of duplicate constant definitions with the same name/value.
 */
export interface DuplicateDefinitionGroup {
  name: string;
  value: string | number | object;
  valueType: 'string' | 'number' | 'object';
  definitions: ConstantDefinition[];
  packages: string[];
  recommendedPackage: string;
  structureHash?: string;
}

/**
 * Result of duplicate definition analysis.
 */
export interface DuplicateDefinitionsResult {
  duplicateDefinitions: DuplicateDefinitionGroup[];
  totalDuplicates: number;
  affectedPackages: string[];
}

/**
 * Extended results including duplicate definitions.
 */
export interface ExtendedConstantsResult extends ConstantsResult {
  duplicateDefinitions?: DuplicateDefinitionsResult;
}
