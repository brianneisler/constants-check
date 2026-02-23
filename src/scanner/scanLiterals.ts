/**
 * Constants Scanning Utilities
 *
 * Scans source files for duplicate string and numeric literal values.
 */

import { Node, SourceFile, SyntaxKind } from 'ts-morph';
import type {
  ConstantDefinition,
  ConstantFinding,
  ConstantLocation,
  ConstantOccurrence,
  ConstantsConfig,
  LocationKey,
} from '../types/constantsTypes.js';
import {
  hasIgnoreNextLineComment,
  buildIgnoreBlocks,
  isInIgnoreBlock,
} from './handleIgnoreComments.js';
import { getNumberFormat, createNumberKey } from './scanConstants.js';
import {
  isTypeLiteral,
  isTypeofSentinel,
  isImportOrExport,
  isPropertyKey,
  isLikelyArrayIndex,
} from './detectTypeContext.js';

function sortConstantSuggestions(suggestions: ConstantDefinition[]): ConstantDefinition[] {
  return suggestions.sort((a, b) => {
    if (a.packageName !== b.packageName) {
      return a.packageName.localeCompare(b.packageName);
    }
    return a.file.localeCompare(b.file);
  });
}

function getLocation(node: Node, relativePath: string): ConstantLocation {
  try {
    const line = node.getStartLineNumber();
    const sourceFile = node.getSourceFile();
    const lineContent = sourceFile.getFullText().split('\n')[line - 1] || '';
    return {
      code: lineContent.trim(),
      file: relativePath,
      line,
    };
  } catch {
    return {
      code: '...',
      file: relativePath,
      line: 0,
    };
  }
}

export function scanStrings(
  file: SourceFile,
  relativePath: string,
  stringCounts: Map<string, ConstantOccurrence>,
  config: ConstantsConfig,
  constantLocations: Set<LocationKey>
): void {
  const stringLiterals = file.getDescendantsOfKind(SyntaxKind.StringLiteral);
  const templateLiterals = file.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral);
  const ignoreBlocks = buildIgnoreBlocks(file.getFullText());

  [...stringLiterals, ...templateLiterals].forEach((node) => {
    const text = node.getLiteralText();

    if (text.length < config.minStringLength) return;
    if (isImportOrExport(node)) return;
    if (isPropertyKey(node)) return;
    if (isTypeLiteral(node)) return;
    if (isTypeofSentinel(node, text)) return;
    if (hasIgnoreNextLineComment(node)) return;

    const line = node.getStartLineNumber();
    if (isInIgnoreBlock(line, ignoreBlocks)) return;

    const locationKey = `${relativePath}:${line}`;
    if (constantLocations.has(locationKey)) return;

    if (!stringCounts.has(text)) {
      stringCounts.set(text, { count: 0, files: new Set(), locations: [] });
    }

    const entry = stringCounts.get(text)!;
    entry.count++;
    entry.files.add(relativePath);
    entry.locations.push(getLocation(node, relativePath));
  });
}

export function scanNumbers(
  file: SourceFile,
  relativePath: string,
  numberCounts: Map<string, ConstantOccurrence>,
  config: ConstantsConfig,
  constantLocations: Set<LocationKey>
): void {
  const numericLiterals = file.getDescendantsOfKind(SyntaxKind.NumericLiteral);
  const ignoreBlocks = buildIgnoreBlocks(file.getFullText());

  numericLiterals.forEach((node) => {
    const val = node.getLiteralValue();

    if (config.ignoreNumbers.includes(val)) return;
    if (isLikelyArrayIndex(node)) return;
    if (isTypeLiteral(node)) return;
    if (hasIgnoreNextLineComment(node)) return;

    const line = node.getStartLineNumber();
    if (isInIgnoreBlock(line, ignoreBlocks)) return;

    const locationKey = `${relativePath}:${line}`;
    if (constantLocations.has(locationKey)) return;

    const format = getNumberFormat(node);
    const key = createNumberKey(val, format);

    if (!numberCounts.has(key)) {
      numberCounts.set(key, { count: 0, files: new Set(), locations: [], numberFormat: format });
    }

    const entry = numberCounts.get(key)!;
    entry.count++;
    entry.files.add(relativePath);
    entry.locations.push(getLocation(node, relativePath));
  });
}

export function convertToFindings(
  counts: Map<string, ConstantOccurrence>,
  constants: Map<string, ConstantDefinition[]>,
  config: ConstantsConfig
): ConstantFinding[] {
  return [...counts.entries()]
    .filter(([, data]) => data.files.size >= config.minDuplication)
    .sort((a, b) => b[1].count - a[1].count)
    .map(([key, data]) => {
      const isNumber = data.numberFormat !== undefined;
      const value = isNumber ? parseFloat(key.split(':')[0]) : key;

      const finding: ConstantFinding = {
        count: data.count,
        fileCount: data.files.size,
        files: [...data.files],
        locations: data.locations,
        value,
      };

      if (data.numberFormat) {
        finding.numberFormat = data.numberFormat;
      }

      const matchingConstants = constants.get(key);
      if (matchingConstants && matchingConstants.length > 0) {
        finding.suggestedConstants = sortConstantSuggestions([...matchingConstants]);
      }

      return finding;
    });
}
