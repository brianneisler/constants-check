/**
 * constants-check CLI
 * Detect duplicate constants in TypeScript/JavaScript projects
 */

import { createRequire } from 'module';
import { Command, InvalidArgumentError } from 'commander';

const require = createRequire(import.meta.url);
const { version } = require('../package.json') as { version: string };
import { runConstantsAnalyzer } from './core/analyzeProject.js';
import {
  printPackageResults,
  printConstantsSummary,
  printThresholdSummary,
  printUsage,
} from './reporter/consoleReporter.js';
import { formatAsJson } from './reporter/jsonReporter.js';
import { discoverProjects, getSingleProjectInfo } from './core/projectDiscovery.js';
import { loadConfigFile } from './core/loadConfigFile.js';
import { computeIssueCount } from './core/computeIssueCount.js';

function parseThresholdArg(value: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) {
    throw new InvalidArgumentError(`Invalid threshold "${value}": must be a non-negative integer.`);
  }
  return n;
}

const program = new Command();

program
  .name('constants-check')
  .description(
    'Detect duplicate constants in TypeScript/JavaScript projects and highlight where they exist to drive refactoring'
  )
  .version(version)
  .option('-c, --check', 'Fail with exit code 1 when duplicates are found (CI mode)')
  .option('-j, --format <format>', 'Output format: console (default) or json')
  .option('-m, --monorepo', 'Analyze as monorepo (scan packages/ or workspaces)')
  .option(
    '--cross-package',
    'Cross-package analysis only (monorepo mode, skip per-package analysis)'
  )
  .option('-d, --definitions-only', 'Only check for duplicate constant definitions')
  .option('-v, --verbose', 'Verbose output')
  .option('-r, --root <path>', 'Root directory to analyze')
  .option('-p, --paths <paths>', 'Comma-separated directories to analyze', (v: string) =>
    v.split(',').map((s) => s.trim())
  )
  .option('-f, --files <files>', 'Comma-separated file paths to filter results', (v: string) =>
    v.split(',').map((s) => s.trim())
  )
  .option(
    '--package-priority <packages>',
    'Comma-separated package priority for consolidation (first = highest)',
    (v: string) => v.split(',').map((s) => s.trim())
  )
  .option('--threshold <n>', 'Max allowed issue count under --check', parseThresholdArg);

program.parse();

interface CliOptions {
  check?: boolean;
  format?: string;
  monorepo?: boolean;
  crossPackage?: boolean;
  definitionsOnly?: boolean;
  verbose?: boolean;
  root?: string;
  paths?: string[];
  files?: string[];
  packagePriority?: string[];
  threshold?: number;
}

async function main(): Promise<void> {
  const cliOpts = program.opts<CliOptions>();

  const root = cliOpts.root ?? process.cwd();
  const fileCfg = await loadConfigFile(root);

  const format = cliOpts.format ?? fileCfg?.format ?? 'console';
  const check = cliOpts.check ?? false;
  const monorepo = cliOpts.monorepo ?? fileCfg?.monorepo ?? false;
  const crossPackage = cliOpts.crossPackage ?? fileCfg?.crossPackage ?? false;
  const definitionsOnly = cliOpts.definitionsOnly ?? fileCfg?.definitionsOnly ?? false;
  const verbose = cliOpts.verbose ?? fileCfg?.verbose ?? false;
  const paths = cliOpts.paths ?? fileCfg?.paths;
  const files = cliOpts.files ?? fileCfg?.files;
  const packagePriority = cliOpts.packagePriority ?? fileCfg?.packagePriority;
  const threshold = cliOpts.threshold ?? fileCfg?.threshold;

  const analysisConfig = {
    ignoreNumbers: fileCfg?.ignoreNumbers,
    minDuplication: fileCfg?.minDuplication,
    minStringLength: fileCfg?.minStringLength,
  };

  if (verbose) {
    console.log('[CONSTANTS] Root:', root);
    console.log('[CONSTANTS] Monorepo:', monorepo);
    if (fileCfg) console.log('[CONSTANTS] Loaded constants.config.json');
    if (threshold != null) console.log('[CONSTANTS] Threshold:', threshold);
  }

  if (definitionsOnly) {
    console.log('[CONSTANTS] Starting duplicate constant definitions analysis...');
  } else {
    console.log('[CONSTANTS] Starting duplicate constants analysis...');
  }

  if (files && files.length > 0) {
    console.log('[CONSTANTS] Filtering results to files:', files.join(', '));
  }
  console.log('');

  try {
    const result = await runConstantsAnalyzer({
      root,
      monorepo,
      paths: paths && paths.length > 0 ? paths : undefined,
      crossPackageOnly: crossPackage,
      definitionsOnly,
      verbose,
      files: files && files.length > 0 ? files : undefined,
      packagePriority,
      config: analysisConfig,
    });

    const issueCount = computeIssueCount(result.results);

    const projects = paths?.length
      ? paths.map((p) => ({
          name: p,
          displayName: p,
          packageName: p,
          path: p,
          relativePath: p,
        }))
      : monorepo
        ? await discoverProjects(root)
        : [getSingleProjectInfo(root)];

    if (format === 'json') {
      const jsonOutput = formatAsJson(
        result.results,
        result.analysisFailure,
        result.analysisMode,
        threshold
      );
      console.log(jsonOutput);
    } else {
      if (verbose && projects.length > 0) {
        console.log(
          '[CONSTANTS] Discovered',
          projects.length,
          'project(s):',
          projects.map((p) => p.displayName).join(', ')
        );
        console.log('');
      }

      for (const packageResult of result.results) {
        printPackageResults(packageResult);
      }

      printConstantsSummary(result.results, result.analysisMode);
      if (threshold != null && !check) {
        printThresholdSummary(issueCount.total, threshold);
      }
      printUsage();
    }

    if (check) {
      if (threshold != null) {
        if (issueCount.total > threshold) {
          console.error(
            '[CONSTANTS]',
            `Issue count ${issueCount.total} exceeds threshold ${threshold}. Fix issues to get the count to ${threshold} or below.`
          );
          process.exit(1);
        } else if (issueCount.total < threshold && format !== 'json') {
          console.log(
            '[CONSTANTS]',
            `Issue count ${issueCount.total} is below threshold ${threshold}. Consider lowering the threshold to ${issueCount.total} to lock in progress.`
          );
        }
      } else if (result.analysisFailure) {
        const errorMsg = definitionsOnly
          ? 'Duplicate constant definitions found! Please consolidate to shared constants.'
          : 'Duplicate constants found! Please refactor to use shared constants.';
        console.error('[CONSTANTS]', errorMsg);
        process.exit(1);
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[CONSTANTS] Fatal error:', errorMessage);
    process.exit(1);
  }
}

void main();
