/**
 * Main analysis orchestrator
 */

import type { ConstantsResult, ExtendedConstantsResult } from '../types/constantsTypes.js';
import { discoverProjects, getSingleProjectInfo, type ProjectInfo } from './projectDiscovery.js';
import { analyzePackageConstants } from './analyzePackage.js';
import { analyzeCrossPackageConstants } from './analyzeCrossPackage.js';
import type { ConstantsConfig } from '../types/constantsTypes.js';

export interface ConstantsAnalyzerOptions {
  /** Root directory to analyze (default: process.cwd()) */
  root?: string;
  /** Run in monorepo mode (scan packages/ or workspaces) */
  monorepo?: boolean;
  /** Custom paths to scan (overrides discovery) */
  paths?: string[];
  /** Cross-package analysis only (monorepo only) */
  crossPackageOnly?: boolean;
  /** Analyze duplicate definitions only (skip literal scanning) */
  definitionsOnly?: boolean;
  /** Verbose output */
  verbose?: boolean;
  /** Filter results to files matching these paths */
  files?: string[];
  /** Config overrides */
  config?: Partial<ConstantsConfig>;
  /** Package priority for consolidation recommendations */
  packagePriority?: string[];
  /** Only report duplicate definitions that span more than one package */
  crossPackageDefinitionsOnly?: boolean;
}

export interface ConstantsAnalyzerResult {
  results: (ConstantsResult | ExtendedConstantsResult)[];
  analysisFailure: boolean;
  analysisMode: 'all' | 'specific';
}

/**
 * Run constants analysis
 */
export async function runConstantsAnalyzer(
  options: ConstantsAnalyzerOptions = {}
): Promise<ConstantsAnalyzerResult> {
  const root = options.root || process.cwd();
  const crossPackageOnly = options.crossPackageOnly ?? false;
  const monorepo = (options.monorepo ?? false) || crossPackageOnly;
  const definitionsOnly = options.definitionsOnly ?? false;
  const paths = options.paths ?? [];
  const config = options.config ?? {};
  const packagePriority = options.packagePriority ?? [];
  const crossPackageDefinitionsOnly = options.crossPackageDefinitionsOnly ?? false;

  const mergedConfig = {
    ignoreNumbers: config.ignoreNumbers ?? [0, 1, 2, -1, 10, 100],
    minDuplication: config.minDuplication ?? 2,
    minStringLength: config.minStringLength ?? 3,
  };

  if (crossPackageOnly && monorepo) {
    const result = await analyzeCrossPackageConstants(root, {
      config: mergedConfig,
      definitionsOnly,
      packagePriority,
      crossPackageDefinitionsOnly,
    });
    return {
      results: [result],
      analysisFailure: !result.success,
      analysisMode: 'all',
    };
  }

  let projects: ProjectInfo[];

  if (paths.length > 0) {
    projects = paths.map((p) => ({
      name: p.split(/[/\\]/).pop() || p,
      displayName: p,
      packageName: p,
      path: p,
      relativePath: p,
    }));
  } else if (monorepo) {
    projects = await discoverProjects(root);
    if (projects.length === 0) {
      throw new Error(
        'No packages found in monorepo. Check packages/ or workspaces in package.json'
      );
    }
  } else {
    const singleProject = getSingleProjectInfo(root);
    projects = [singleProject];
  }

  const results: (ConstantsResult | ExtendedConstantsResult)[] = [];
  let analysisFailure = false;

  for (const project of projects) {
    try {
      const result = await analyzePackageConstants(
        project.path,
        root,
        project.packageName,
        project.displayName,
        {
          config: mergedConfig,
          definitionsOnly,
          packagePriority,
          crossPackageDefinitionsOnly,
        }
      );
      results.push(result);
      if (!result.success) analysisFailure = true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      results.push({
        displayName: project.displayName,
        hasSourceFiles: false,
        numberFindings: [],
        packageName: project.name,
        skipReason: `Error: ${errorMessage}`,
        skipped: true,
        stringFindings: [],
        success: false,
      });
      analysisFailure = true;
    }
  }

  if (monorepo && !crossPackageOnly && projects.length > 0) {
    const crossResult = await analyzeCrossPackageConstants(root, {
      config: mergedConfig,
      definitionsOnly,
      packagePriority,
      crossPackageDefinitionsOnly,
    });
    results.push(crossResult);
    if (!crossResult.success) analysisFailure = true;
  }

  const analysisMode = paths.length > 0 || crossPackageOnly ? 'specific' : 'all';

  let finalResults = results;
  if (options.files && options.files.length > 0) {
    finalResults = applyFileFiltering(results, options.files);
    analysisFailure = finalResults.some(
      (r) => r.stringFindings.length > 0 || r.numberFindings.length > 0
    );
  }

  return {
    results: finalResults,
    analysisFailure,
    analysisMode,
  };
}

function applyFileFiltering(
  results: (ConstantsResult | ExtendedConstantsResult)[],
  files: string[]
): (ConstantsResult | ExtendedConstantsResult)[] {
  const normalizedFiles = files.map((f) => f.replace(/\\/g, '/'));

  return results.map((result) => {
    const filteredStringFindings = result.stringFindings.filter((finding) =>
      finding.locations.some((loc) => {
        const normalizedPath = loc.file.replace(/\\/g, '/');
        return normalizedFiles.some((file) => normalizedPath.includes(file));
      })
    );
    const filteredNumberFindings = result.numberFindings.filter((finding) =>
      finding.locations.some((loc) => {
        const normalizedPath = loc.file.replace(/\\/g, '/');
        return normalizedFiles.some((file) => normalizedPath.includes(file));
      })
    );
    return {
      ...result,
      stringFindings: filteredStringFindings,
      numberFindings: filteredNumberFindings,
    };
  });
}
