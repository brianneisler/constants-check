/**
 * Console output formatter for constants analysis
 */

import chalk from 'chalk';
import type {
  ConstantFinding,
  ConstantsResult,
  DuplicateDefinitionGroup,
  ExtendedConstantsResult,
} from '../types/constantsTypes.js';

const MAX_FINDINGS_TO_DISPLAY = 20;
const REPORT_SEPARATOR = '=========================================';
const SECTION_SEPARATOR = '-----------------------------------------';

function printFinding(finding: ConstantFinding, type: 'string' | 'number'): void {
  const valueDisplay = type === 'string' ? `"${finding.value}"` : String(finding.value);
  console.log(`${type === 'string' ? 'String' : 'Number'}: ${valueDisplay}`);
  console.log(`  - Count: ${finding.count} occurrences in ${finding.fileCount} files`);

  if (finding.suggestedConstants && finding.suggestedConstants.length > 0) {
    console.log(chalk.yellow('  ⚠️  Did you mean to use one of these constants?'));
    finding.suggestedConstants.forEach((constant) => {
      const constantName = constant.fullPath || constant.name;
      console.log(
        chalk.gray('      •'),
        chalk.cyan(constantName),
        chalk.blue(`(${constant.file}:${constant.line})`)
      );
    });
  }

  console.log('  - Locations:');
  finding.locations.forEach((loc) => {
    console.log(chalk.blue(`      ${loc.file}:${loc.line}`));
    console.log(`        ${loc.code}`);
  });
  console.log(SECTION_SEPARATOR);
}

function printFindings(
  findings: ConstantFinding[],
  type: 'string' | 'number',
  limit = MAX_FINDINGS_TO_DISPLAY
): void {
  const typeLabel = type === 'string' ? 'Repeated Strings' : 'Repeated Magic Numbers';
  const displayFindings = findings.slice(0, limit);

  console.log('');
  console.log(`Found ${findings.length} ${typeLabel} (across multiple files):`);
  console.log('');

  displayFindings.forEach((finding) => printFinding(finding, type));

  if (findings.length > limit) {
    console.log(`... and ${findings.length - limit} more ${type}s`);
  }
}

function formatValue(value: string | number | object): string {
  if (typeof value === 'string') return `"${value}"`;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'object') {
    const json = JSON.stringify(value, null, 2);
    return json
      .split('\n')
      .map((line, idx) => (idx === 0 ? line : `      ${line}`))
      .join('\n');
  }
  return String(value);
}

function printDuplicateDefinitionGroup(group: DuplicateDefinitionGroup): void {
  console.log(chalk.yellow('⚠️'), chalk.cyan(group.name));
  console.log(`  - Type: ${group.valueType}`);
  console.log(`  - Value: ${formatValue(group.value)}`);
  console.log(`  - Defined in ${group.packages.length} packages: ${group.packages.join(', ')}`);
  console.log(`  - Total definitions: ${group.definitions.length}`);
  console.log('');
  console.log(chalk.yellow('  Locations:'));
  group.definitions.forEach((def) => {
    const constantName = def.fullPath || def.name;
    console.log(
      chalk.gray('    •'),
      chalk.cyan(constantName),
      'in',
      chalk.magenta(def.packageName)
    );
    console.log(chalk.blue(`      ${def.file}:${def.line}`));
  });
  console.log('');
  console.log(
    chalk.green('💡 Recommendation:'),
    'Move to',
    chalk.magenta(group.recommendedPackage)
  );
  console.log(chalk.gray(`      Target: ${group.recommendedPackage}/src/constants/`));
  console.log(SECTION_SEPARATOR);
}

function printDuplicateDefinitions(result: ExtendedConstantsResult): void {
  if (!result.duplicateDefinitions) return;

  const { duplicateDefinitions, totalDuplicates } = result.duplicateDefinitions;

  if (totalDuplicates === 0) return;

  console.log('');
  console.log(chalk.yellow('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(chalk.yellow('📦 DUPLICATE CONSTANT DEFINITIONS'));
  console.log(chalk.yellow('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log('');
  console.log(
    chalk.yellow(
      `⚠️  Found ${totalDuplicates} duplicate constant definitions (similar names + exact values):`
    )
  );
  console.log('');

  duplicateDefinitions.forEach((group) => printDuplicateDefinitionGroup(group));

  console.log('');
  console.log(chalk.yellow('Summary:'));
  console.log(`  - Total duplicate constant definitions: ${totalDuplicates}`);
  console.log(`  - Affected packages: ${result.duplicateDefinitions.affectedPackages.join(', ')}`);
  console.log('');
}

export function printPackageResults(result: ConstantsResult | ExtendedConstantsResult): void {
  console.log('');
  console.log(REPORT_SEPARATOR);
  console.log(`  ${result.displayName} - Constants Report`);
  console.log(REPORT_SEPARATOR);

  if (result.skipped) {
    console.log(chalk.blue('[CONSTANTS]'), `Skipped: ${result.skipReason}`);
    return;
  }

  if (!result.hasSourceFiles) {
    console.log(chalk.blue('[CONSTANTS]'), 'No source files to analyze');
    return;
  }

  const extendedResult = result as ExtendedConstantsResult;
  const hasDuplicateDefinitions =
    extendedResult.duplicateDefinitions && extendedResult.duplicateDefinitions.totalDuplicates > 0;

  if (
    result.stringFindings.length === 0 &&
    result.numberFindings.length === 0 &&
    !hasDuplicateDefinitions
  ) {
    console.log(chalk.green('[CONSTANTS]'), '✅ No duplicate constants found');
    return;
  }

  if (hasDuplicateDefinitions) {
    printDuplicateDefinitions(extendedResult);
  }

  if (result.stringFindings.length > 0) {
    printFindings(result.stringFindings, 'string');
  }

  if (result.numberFindings.length > 0) {
    printFindings(result.numberFindings, 'number');
  }
}

export function printConstantsSummary(
  results: (ConstantsResult | ExtendedConstantsResult)[],
  analysisMode: 'all' | 'specific'
): void {
  console.log('');
  console.log(REPORT_SEPARATOR);
  console.log('      DUPLICATE CONSTANTS SUMMARY');
  console.log(REPORT_SEPARATOR);
  console.log('');

  const analyzedResults = results.filter((r) => !r.skipped && r.hasSourceFiles);
  const packagesWithDuplicates = analyzedResults.filter((r) => !r.success);

  const totalStrings = analyzedResults.reduce((sum, r) => sum + r.stringFindings.length, 0);
  const totalNumbers = analyzedResults.reduce((sum, r) => sum + r.numberFindings.length, 0);

  let totalDuplicateDefinitions = 0;
  for (const result of analyzedResults) {
    const extendedResult = result as ExtendedConstantsResult;
    if (extendedResult.duplicateDefinitions) {
      totalDuplicateDefinitions += extendedResult.duplicateDefinitions.totalDuplicates;
    }
  }

  console.log(`Packages analyzed: ${analyzedResults.length}`);
  console.log(`Packages with duplicates: ${packagesWithDuplicates.length}`);
  console.log(`Total duplicate strings: ${totalStrings}`);
  console.log(`Total duplicate numbers: ${totalNumbers}`);
  console.log(`Total duplicate definitions: ${totalDuplicateDefinitions}`);
  console.log('');

  if (packagesWithDuplicates.length > 0) {
    console.log(chalk.yellow('[CONSTANTS]'), 'Packages with duplicate constants:');
    packagesWithDuplicates.forEach((r) => {
      const extendedResult = r as ExtendedConstantsResult;
      const definitionsCount = extendedResult.duplicateDefinitions
        ? extendedResult.duplicateDefinitions.totalDuplicates
        : 0;
      const parts = [`${r.stringFindings.length} strings`, `${r.numberFindings.length} numbers`];
      if (definitionsCount > 0) parts.push(`${definitionsCount} definitions`);
      console.log(chalk.yellow(`  ${r.displayName}:`), parts.join(', '));
    });
    console.log('');
    console.log('Recommended Actions:');
    console.log('  1. Create a shared constants file: src/constants/shared.ts');
    console.log('  2. Start with the most frequently duplicated values');
    console.log('  3. Use IDE refactoring tools to replace raw values');
    console.log('  4. Rerun this analysis to verify improvements');
    console.log('');
  } else {
    console.log(chalk.green('[CONSTANTS]'), '✅ No duplicate constants found across packages!');
  }

  if (analysisMode === 'all') {
    console.log(chalk.blue('[CONSTANTS]'), 'Analysis complete for all packages');
  } else {
    console.log(chalk.blue('[CONSTANTS]'), 'Analysis complete for selected packages');
  }
}

export function printThresholdSummary(total: number, threshold: number): void {
  console.log('');
  if (total > threshold) {
    console.log(
      chalk.red('[CONSTANTS]'),
      `Issue count ${total} exceeds threshold ${threshold}. Fix issues to get the count to ${threshold} or below.`
    );
  } else if (total < threshold) {
    console.log(
      chalk.green('[CONSTANTS]'),
      `Issue count ${total} is below threshold ${threshold}. Consider lowering the threshold to ${total} to lock in progress.`
    );
  } else {
    console.log(chalk.green('[CONSTANTS]'), `Issue count ${total} is at the configured threshold.`);
  }
}

export function printUsage(): void {
  console.log('');
  console.log('Usage:');
  console.log('  npx constants-check                    # Analyze current directory');
  console.log('  npx constants-check --check            # Fail on duplicates (CI mode)');
  console.log('  npx constants-check --monorepo        # Analyze monorepo packages');
  console.log('  npx constants-check --cross-package   # Cross-package analysis only');
  console.log('  npx constants-check --definitions-only # Check definitions only');
  console.log('');
}
