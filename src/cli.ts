/**
 * constants-check CLI
 * Detect duplicate constants in TypeScript/JavaScript projects
 */

import { createRequire } from 'module';
import { Command } from 'commander';

const require = createRequire(import.meta.url);
const { version } = require('../package.json') as { version: string };
import { runConstantsAnalyzer } from './core/analyzeProject.js';
import {
  printPackageResults,
  printConstantsSummary,
  printUsage,
} from './reporter/consoleReporter.js';
import { formatAsJson } from './reporter/jsonReporter.js';
import { discoverProjects, getSingleProjectInfo } from './core/projectDiscovery.js';

const program = new Command();

program
  .name('constants-check')
  .description(
    'Detect duplicate constants in TypeScript/JavaScript projects and highlight where they exist to drive refactoring'
  )
  .version(version)
  .option('-c, --check', 'Fail with exit code 1 when duplicates are found (CI mode)')
  .option('-j, --format <format>', 'Output format: console (default) or json', 'console')
  .option('-m, --monorepo', 'Analyze as monorepo (scan packages/ or workspaces)')
  .option(
    '--cross-package',
    'Cross-package analysis only (monorepo mode, skip per-package analysis)'
  )
  .option('-d, --definitions-only', 'Only check for duplicate constant definitions')
  .option('-v, --verbose', 'Verbose output')
  .option('-r, --root <path>', 'Root directory to analyze', process.cwd())
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
  );

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
}

async function main(): Promise<void> {
  const opts = program.opts<CliOptions>();

  const root = opts.root || process.cwd();
  const format = opts.format || 'console';
  const check = opts.check || false;

  if (opts.verbose) {
    console.log('[CONSTANTS] Root:', root);
    console.log('[CONSTANTS] Monorepo:', opts.monorepo ?? false);
  }

  if (opts.definitionsOnly) {
    console.log('[CONSTANTS] Starting duplicate constant definitions analysis...');
  } else {
    console.log('[CONSTANTS] Starting duplicate constants analysis...');
  }

  if (opts.files && opts.files.length > 0) {
    console.log('[CONSTANTS] Filtering results to files:', opts.files.join(', '));
  }
  console.log('');

  try {
    const result = await runConstantsAnalyzer({
      root,
      monorepo: opts.monorepo,
      paths: opts.paths && opts.paths.length > 0 ? opts.paths : undefined,
      crossPackageOnly: opts.crossPackage ?? false,
      definitionsOnly: opts.definitionsOnly ?? false,
      verbose: opts.verbose,
      files: opts.files && opts.files.length > 0 ? opts.files : undefined,
      packagePriority: opts.packagePriority,
    });

    const projects = opts.paths?.length
      ? opts.paths.map((p) => ({
          name: p,
          displayName: p,
          packageName: p,
          path: p,
          relativePath: p,
        }))
      : opts.monorepo
        ? await discoverProjects(root)
        : [getSingleProjectInfo(root)];

    if (format === 'json') {
      const jsonOutput = formatAsJson(result.results, result.analysisFailure, result.analysisMode);
      console.log(jsonOutput);
    } else {
      if (opts.verbose && projects.length > 0) {
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
      printUsage();
    }

    if (check && result.analysisFailure) {
      const errorMsg = opts.definitionsOnly
        ? 'Duplicate constant definitions found! Please consolidate to shared constants.'
        : 'Duplicate constants found! Please refactor to use shared constants.';
      console.error('[CONSTANTS]', errorMsg);
      process.exit(1);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[CONSTANTS] Fatal error:', errorMessage);
    process.exit(1);
  }
}

void main();
