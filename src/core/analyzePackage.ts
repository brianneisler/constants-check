/**
 * Single project/package constants analysis
 */

import * as path from 'path';
import { Project } from 'ts-morph';
import type {
  ConstantDefinition,
  ConstantFinding,
  ConstantOccurrence,
  ConstantsConfig,
  ConstantsResult,
  ExtendedConstantsResult,
  LocationKey,
} from '../types/constantsTypes.js';
import { scanConstants } from '../scanner/scanConstants.js';
import { scanStrings, scanNumbers, convertToFindings } from '../scanner/scanLiterals.js';
import { analyzeDuplicateDefinitions } from './analyzeDefinitions.js';
import { DEFAULT_CONFIG } from './config.js';

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

function collectConstants(
  sourceFiles: import('ts-morph').SourceFile[],
  projectRoot: string,
  packageName: string,
  stringConstants: Map<string, ConstantDefinition[]>,
  numberConstants: Map<string, ConstantDefinition[]>,
  constantLocations: Set<LocationKey>
): void {
  for (const file of sourceFiles) {
    const filePath = file.getFilePath();
    if (shouldSkipFile(filePath)) continue;

    const relativePath = path.relative(projectRoot, filePath);
    scanConstants(
      file,
      relativePath,
      packageName,
      stringConstants,
      numberConstants,
      constantLocations
    );
  }
}

function collectDuplicates(
  sourceFiles: import('ts-morph').SourceFile[],
  projectRoot: string,
  stringCounts: Map<string, ConstantOccurrence>,
  numberCounts: Map<string, ConstantOccurrence>,
  config: ConstantsConfig,
  constantLocations: Set<LocationKey>
): void {
  for (const file of sourceFiles) {
    const filePath = file.getFilePath();
    if (shouldSkipFile(filePath)) continue;

    const relativePath = path.relative(projectRoot, filePath);
    scanStrings(file, relativePath, stringCounts, config, constantLocations);
    scanNumbers(file, relativePath, numberCounts, config, constantLocations);
  }
}

export interface AnalyzePackageOptions {
  config?: ConstantsConfig;
  definitionsOnly?: boolean;
  packagePriority?: string[];
}

export async function analyzePackageConstants(
  projectPath: string,
  projectRoot: string,
  packageName: string,
  displayName: string,
  options: AnalyzePackageOptions = {}
): Promise<ExtendedConstantsResult> {
  const { config = DEFAULT_CONFIG, definitionsOnly = false, packagePriority = [] } = options;

  const srcPath = path.join(projectPath, 'src');
  const tsconfigPath = path.join(projectPath, 'tsconfig.json');

  let project: Project;
  try {
    project = new Project({
      skipAddingFilesFromTsConfig: true,
      tsConfigFilePath: tsconfigPath,
    });
    project.addSourceFilesAtPaths([
      `${srcPath}/**/*.ts`,
      `${srcPath}/**/*.tsx`,
      `${projectPath}/**/*.ts`,
      `${projectPath}/**/*.tsx`,
    ]);
  } catch {
    return createSkippedResult(packageName, displayName, 'Could not initialize ts-morph project');
  }

  const sourceFiles = project.getSourceFiles().filter((f) => {
    const filePath = f.getFilePath();
    return !filePath.includes('node_modules') && !filePath.endsWith('.d.ts');
  });

  if (sourceFiles.length === 0) {
    return createSkippedResult(packageName, displayName, 'No source files found');
  }

  const stringConstants = new Map<string, ConstantDefinition[]>();
  const numberConstants = new Map<string, ConstantDefinition[]>();
  const constantLocations = new Set<LocationKey>();

  collectConstants(
    sourceFiles,
    projectRoot,
    packageName,
    stringConstants,
    numberConstants,
    constantLocations
  );

  let stringFindings: ConstantFinding[] = [];
  let numberFindings: ConstantFinding[] = [];

  if (!definitionsOnly) {
    const stringCounts = new Map<string, ConstantOccurrence>();
    const numberCounts = new Map<string, ConstantOccurrence>();
    collectDuplicates(
      sourceFiles,
      projectRoot,
      stringCounts,
      numberCounts,
      config,
      constantLocations
    );

    stringFindings = convertToFindings(stringCounts, stringConstants, config);
    numberFindings = convertToFindings(numberCounts, numberConstants, config);
  }

  const duplicateDefinitions = analyzeDuplicateDefinitions(stringConstants, numberConstants, {
    packagePriority,
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
