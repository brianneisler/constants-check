/**
 * Cross-package constants analysis for monorepos
 */

import * as path from 'path';
import { Project } from 'ts-morph';
import type {
  ConstantDefinition,
  ConstantFinding,
  ConstantOccurrence,
  ConstantsConfig,
  ExtendedConstantsResult,
  LocationKey,
} from '../types/constantsTypes.js';
import { scanConstants } from '../scanner/scanConstants.js';
import { scanStrings, scanNumbers, convertToFindings } from '../scanner/scanLiterals.js';
import { analyzeDuplicateDefinitions } from './analyzeDefinitions.js';
import { createSkippedResult, shouldSkipFile } from './analyzePackage.js';
import { DEFAULT_CONFIG } from './config.js';

const CROSS_PACKAGE_NAME = 'cross-package';
const CROSS_PACKAGE_DISPLAY_NAME = 'Cross-Package Analysis';

function collectCrossPackageConstants(
  sourceFiles: import('ts-morph').SourceFile[],
  projectRoot: string,
  stringConstants: Map<string, ConstantDefinition[]>,
  numberConstants: Map<string, ConstantDefinition[]>,
  constantLocations: Set<LocationKey>
): void {
  for (const file of sourceFiles) {
    const filePath = file.getFilePath();
    if (shouldSkipFile(filePath)) continue;

    const relativePath = path.relative(projectRoot, filePath);
    const packageMatch = relativePath.match(/^packages\/([^/]+)\//);
    const packageName = packageMatch ? packageMatch[1] : CROSS_PACKAGE_NAME;

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

export interface AnalyzeCrossPackageOptions {
  config?: ConstantsConfig;
  definitionsOnly?: boolean;
  packagePriority?: string[];
}

export async function analyzeCrossPackageConstants(
  projectRoot: string,
  options: AnalyzeCrossPackageOptions = {}
): Promise<ExtendedConstantsResult> {
  const { config = DEFAULT_CONFIG, definitionsOnly = false, packagePriority = [] } = options;

  const packagesPath = path.join(projectRoot, 'packages');
  const tsconfigPath = path.join(projectRoot, 'tsconfig.json');

  let project: Project;
  try {
    project = new Project({
      skipAddingFilesFromTsConfig: true,
      tsConfigFilePath: tsconfigPath,
    });
    project.addSourceFilesAtPaths([
      `${packagesPath}/**/src/**/*.ts`,
      `${packagesPath}/**/src/**/*.tsx`,
    ]);
  } catch {
    return createSkippedResult(
      CROSS_PACKAGE_NAME,
      CROSS_PACKAGE_DISPLAY_NAME,
      'Could not initialize cross-package project'
    );
  }

  const sourceFiles = project.getSourceFiles();

  if (sourceFiles.length === 0) {
    return createSkippedResult(
      CROSS_PACKAGE_NAME,
      CROSS_PACKAGE_DISPLAY_NAME,
      'No source files found for cross-package analysis'
    );
  }

  const stringConstants = new Map<string, ConstantDefinition[]>();
  const numberConstants = new Map<string, ConstantDefinition[]>();
  const constantLocations = new Set<LocationKey>();

  collectCrossPackageConstants(
    sourceFiles,
    projectRoot,
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

  const success = definitionsOnly
    ? duplicateDefinitions.totalDuplicates === 0
    : stringFindings.length === 0 &&
      numberFindings.length === 0 &&
      duplicateDefinitions.totalDuplicates === 0;

  return {
    displayName: CROSS_PACKAGE_DISPLAY_NAME,
    duplicateDefinitions,
    hasSourceFiles: true,
    numberFindings,
    packageName: CROSS_PACKAGE_NAME,
    skipped: false,
    stringFindings,
    success,
  };
}
