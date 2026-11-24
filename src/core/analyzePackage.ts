/**
 * Single project/package constants analysis
 */

import * as path from 'path';
import { Project } from 'ts-morph';
import type {
  ConstantFinding,
  ConstantsConfig,
  ConstantsResult,
  ExtendedConstantsResult,
} from '../types/constantsTypes.js';
import { convertToFindings } from '../scanner/scanLiterals.js';
import { analyzeDuplicateDefinitions } from './analyzeDefinitions.js';
import { DEFAULT_CONFIG } from './config.js';
import { findSourceFilePaths, scanSourceFiles } from './scanSourceFiles.js';
import { buildSourceGlobs } from './sourceGlobs.js';

const NODE_MODULES = 'node_modules';
const TYPE_DEFINITION_EXT = '.d.ts';

export function createSkippedResult(
  packageName: string,
  displayName: string,
  skipReason: string
): ConstantsResult {
  return {
    displayName,
    hasSourceFiles: false,
    numberFindings: [],
    packageName,
    skipReason,
    skipped: true,
    stringFindings: [],
    success: true,
  };
}

export function shouldSkipFile(filePath: string): boolean {
  return filePath.includes(NODE_MODULES) || filePath.endsWith(TYPE_DEFINITION_EXT);
}

export interface AnalyzePackageOptions {
  config?: ConstantsConfig;
  definitionsOnly?: boolean;
  packagePriority?: string[];
  crossPackageDefinitionsOnly?: boolean;
  /** Glob patterns, relative to `projectRoot`, whose files are never collected */
  ignore?: readonly string[];
}

export async function analyzePackageConstants(
  projectPath: string,
  projectRoot: string,
  packageName: string,
  displayName: string,
  options: AnalyzePackageOptions = {}
): Promise<ExtendedConstantsResult> {
  const {
    config = DEFAULT_CONFIG,
    definitionsOnly = false,
    packagePriority = [],
    crossPackageDefinitionsOnly = false,
    ignore = [],
  } = options;

  const srcPath = path.join(projectPath, 'src');
  const tsconfigPath = path.join(projectPath, 'tsconfig.json');

  let project: Project;
  let filePaths: string[];
  try {
    project = new Project({
      skipAddingFilesFromTsConfig: true,
      tsConfigFilePath: tsconfigPath,
    });
    filePaths = findSourceFilePaths(
      project,
      buildSourceGlobs(
        [
          `${srcPath}/**/*.ts`,
          `${srcPath}/**/*.tsx`,
          `${projectPath}/**/*.ts`,
          `${projectPath}/**/*.tsx`,
        ],
        projectRoot,
        ignore
      ),
      shouldSkipFile
    );
  } catch {
    return createSkippedResult(packageName, displayName, 'Could not initialize ts-morph project');
  }

  if (filePaths.length === 0) {
    return createSkippedResult(packageName, displayName, 'No source files found');
  }

  const { numberConstants, numberCounts, stringConstants, stringCounts } = scanSourceFiles(
    project,
    filePaths,
    { config, definitionsOnly, packageNameFor: () => packageName, projectRoot }
  );

  let stringFindings: ConstantFinding[] = [];
  let numberFindings: ConstantFinding[] = [];

  if (!definitionsOnly) {
    stringFindings = convertToFindings(stringCounts, stringConstants, config);
    numberFindings = convertToFindings(numberCounts, numberConstants, config);
  }

  const duplicateDefinitions = analyzeDuplicateDefinitions(stringConstants, numberConstants, {
    packagePriority,
    crossPackageOnly: crossPackageDefinitionsOnly,
  });

  const hasDuplicates =
    stringFindings.length > 0 ||
    numberFindings.length > 0 ||
    duplicateDefinitions.totalDuplicates > 0;

  return {
    packageName,
    displayName,
    success: !hasDuplicates,
    hasSourceFiles: true,
    skipped: false,
    stringFindings,
    numberFindings,
    duplicateDefinitions,
  };
}
