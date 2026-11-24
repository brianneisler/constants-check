/**
 * Scans source files one at a time: each file is parsed, read, and released
 * before the next one is opened.
 *
 * A project that parses every file up front holds every syntax tree for the
 * whole run. ts-morph also caches the children of every compiler node it walks
 * in one WeakMap keyed by the node, and a parsed file keeps its nodes alive for
 * as long as the project holds it — so that cache grows with the node count of
 * the whole tree until V8 refuses to grow the table any further ("invalid table
 * size") and the process aborts. Opening one file at a time keeps memory
 * proportional to the largest file rather than to the repository.
 *
 * Definitions and duplicates are read in the same visit. That is equivalent to
 * scanning every file for definitions first: a definition only hides a literal
 * on its own line of its own file, so nothing a later file defines can change
 * what an earlier file reports.
 */

import * as path from 'path';
import type { Project } from 'ts-morph';
import type {
  ConstantDefinition,
  ConstantOccurrence,
  ConstantsConfig,
  LocationKey,
} from '../types/constantsTypes.js';
import { scanConstants } from '../scanner/scanConstants.js';
import { scanStrings, scanNumbers } from '../scanner/scanLiterals.js';

export interface SourceFileScan {
  numberConstants: Map<string, ConstantDefinition[]>;
  numberCounts: Map<string, ConstantOccurrence>;
  stringConstants: Map<string, ConstantDefinition[]>;
  stringCounts: Map<string, ConstantOccurrence>;
}

export interface ScanSourceFilesOptions {
  config: ConstantsConfig;
  /** Skip the duplicate-literal scan and collect definitions only */
  definitionsOnly: boolean;
  /** The package a file's definitions are attributed to */
  packageNameFor: (relativePath: string) => string;
  projectRoot: string;
}

/**
 * The files `globs` match, without the ones `shouldSkip` rejects, in the order
 * ts-morph lists a project's files. No file's contents are read.
 *
 * The order decides the order of every finding's locations and which
 * definition leads a group, so it has to be the one a project that had added
 * every file would give: by directory depth, then by name under ts-morph's own
 * comparer. Rather than restate that rule, each path is registered as an empty
 * placeholder, ts-morph is asked for its order, and the placeholders are
 * released again.
 */
export function findSourceFilePaths(
  project: Project,
  globs: readonly string[],
  shouldSkip: (filePath: string) => boolean
): string[] {
  for (const filePath of project.getFileSystem().globSync(globs)) {
    if (!shouldSkip(filePath)) project.createSourceFile(filePath, '', { overwrite: true });
  }

  return project.getSourceFiles().map((placeholder) => {
    const filePath = placeholder.getFilePath();
    project.removeSourceFile(placeholder);
    return filePath;
  });
}

export function scanSourceFiles(
  project: Project,
  filePaths: readonly string[],
  options: ScanSourceFilesOptions
): SourceFileScan {
  const { config, definitionsOnly, packageNameFor, projectRoot } = options;
  const scan: SourceFileScan = {
    numberConstants: new Map(),
    numberCounts: new Map(),
    stringConstants: new Map(),
    stringCounts: new Map(),
  };
  const constantLocations = new Set<LocationKey>();

  for (const filePath of filePaths) {
    const file = project.addSourceFileAtPath(filePath);
    try {
      const relativePath = path.relative(projectRoot, file.getFilePath());
      scanConstants(
        file,
        relativePath,
        packageNameFor(relativePath),
        scan.stringConstants,
        scan.numberConstants,
        constantLocations
      );
      if (!definitionsOnly) {
        scanStrings(file, relativePath, scan.stringCounts, config, constantLocations);
        scanNumbers(file, relativePath, scan.numberCounts, config, constantLocations);
      }
    } finally {
      project.removeSourceFile(file);
    }
  }

  return scan;
}
