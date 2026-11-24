/**
 * Cross-package constants analysis for monorepos
 */

import * as path from 'path';
import { Project } from 'ts-morph';
import type {
  ConstantFinding,
  ConstantsConfig,
  ExtendedConstantsResult,
} from '../types/constantsTypes.js';
import { convertToFindings } from '../scanner/scanLiterals.js';
import { analyzeDuplicateDefinitions } from './analyzeDefinitions.js';
import { createSkippedResult, shouldSkipFile } from './analyzePackage.js';
import { DEFAULT_CONFIG } from './config.js';
import { findSourceFilePaths, scanSourceFiles } from './scanSourceFiles.js';
import { buildSourceGlobs } from './sourceGlobs.js';

const CROSS_PACKAGE_NAME = 'cross-package';
const CROSS_PACKAGE_DISPLAY_NAME = 'Cross-Package Analysis';

function packageNameFor(relativePath: string): string {
  const packageMatch = relativePath.match(/^packages\/([^/]+)\//);
  return packageMatch ? packageMatch[1] : CROSS_PACKAGE_NAME;
}

export interface AnalyzeCrossPackageOptions {
  config?: ConstantsConfig;
  definitionsOnly?: boolean;
  packagePriority?: string[];
  crossPackageDefinitionsOnly?: boolean;
  /** Glob patterns, relative to `projectRoot`, whose files are never collected */
  ignore?: readonly string[];
}

export async function analyzeCrossPackageConstants(
  projectRoot: string,
  options: AnalyzeCrossPackageOptions = {}
): Promise<ExtendedConstantsResult> {
  const {
    config = DEFAULT_CONFIG,
    definitionsOnly = false,
    packagePriority = [],
    crossPackageDefinitionsOnly = false,
    ignore = [],
  } = options;

  const packagesPath = path.join(projectRoot, 'packages');
  const tsconfigPath = path.join(projectRoot, 'tsconfig.json');

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
        [`${packagesPath}/**/src/**/*.ts`, `${packagesPath}/**/src/**/*.tsx`],
        projectRoot,
        ignore
      ),
      shouldSkipFile
    );
  } catch {
    return createSkippedResult(
      CROSS_PACKAGE_NAME,
      CROSS_PACKAGE_DISPLAY_NAME,
      'Could not initialize cross-package project'
    );
  }

  if (filePaths.length === 0) {
    return createSkippedResult(
      CROSS_PACKAGE_NAME,
      CROSS_PACKAGE_DISPLAY_NAME,
      'No source files found for cross-package analysis'
    );
  }

  const { numberConstants, numberCounts, stringConstants, stringCounts } = scanSourceFiles(
    project,
    filePaths,
    { config, definitionsOnly, packageNameFor, projectRoot }
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
