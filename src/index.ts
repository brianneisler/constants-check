/**
 * constants-check - Programmatic API
 *
 * Detect duplicate constants in TypeScript/JavaScript projects
 */

export { runConstantsAnalyzer } from './core/analyzeProject.js';
export type { ConstantsAnalyzerOptions, ConstantsAnalyzerResult } from './core/analyzeProject.js';
export { analyzePackageConstants } from './core/analyzePackage.js';
export { analyzeCrossPackageConstants } from './core/analyzeCrossPackage.js';
export { formatAsJson } from './reporter/jsonReporter.js';
export type {
  ConstantDefinition,
  ConstantFinding,
  ConstantLocation,
  ConstantsConfig,
  ConstantsResult,
  ExtendedConstantsResult,
  DuplicateDefinitionGroup,
  DuplicateDefinitionsResult,
  NumberFormat,
} from './types/constantsTypes.js';
