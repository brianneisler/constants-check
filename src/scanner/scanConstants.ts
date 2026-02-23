/**
 * Constants Scanner
 *
 * Scans source files for constant definitions (SCREAMING_SNAKE_CASE const variables and enums)
 */

import { Node, SourceFile } from 'ts-morph';
import type { ConstantDefinition, LocationKey, NumberFormat } from '../types/constantsTypes.js';
import {
  hasIgnoreNextLineComment,
  buildIgnoreBlocks,
  isInIgnoreBlock,
} from './handleIgnoreComments.js';
import { extractObjectProperties, addStringConstant, addNumberConstant } from './scanObjects.js';

const CONST_DECLARATION_KIND = 'const';

export function createLocationKey(file: string, line: number): LocationKey {
  return `${file}:${line}`;
}

export function getNumberFormat(numericNode: Node): NumberFormat {
  const text = numericNode.getText().toLowerCase();
  if (text.startsWith('0x')) return 'hex';
  if (text.startsWith('0o')) return 'octal';
  if (text.startsWith('0b')) return 'binary';
  return 'decimal';
}

export function createNumberKey(value: number, format: NumberFormat): string {
  return `${value}:${format}`;
}

export function isScreamingSnakeCase(name: string): boolean {
  return /^[A-Z][A-Z0-9_]*$/.test(name);
}

function handleConstInitializer(
  initializer: Node,
  name: string,
  relativePath: string,
  packageName: string,
  stringConstants: Map<string, ConstantDefinition[]>,
  numberConstants: Map<string, ConstantDefinition[]>,
  constantLocations: Set<LocationKey>,
  ignoreBlocks: Array<{ start: number; end: number }>
): void {
  let actualInit = initializer;
  if (Node.isAsExpression(initializer) || Node.isTypeAssertion(initializer)) {
    actualInit = initializer.getExpression();
  }

  if (Node.isStringLiteral(actualInit) || Node.isNoSubstitutionTemplateLiteral(actualInit)) {
    const value = actualInit.getLiteralText();
    const line = actualInit.getStartLineNumber();
    addStringConstant(
      value,
      { file: relativePath, fullPath: name, line, name, packageName, value },
      stringConstants,
      constantLocations
    );
  } else if (Node.isNumericLiteral(actualInit)) {
    const value = actualInit.getLiteralValue();
    const format = getNumberFormat(actualInit);
    const line = actualInit.getStartLineNumber();
    addNumberConstant(
      value,
      format,
      { file: relativePath, fullPath: name, line, name, packageName, value },
      numberConstants,
      constantLocations
    );
  } else if (Node.isObjectLiteralExpression(actualInit)) {
    extractObjectProperties(
      actualInit,
      name,
      relativePath,
      packageName,
      stringConstants,
      numberConstants,
      constantLocations,
      ignoreBlocks
    );
  }
}

function scanConstVariables(
  file: SourceFile,
  relativePath: string,
  packageName: string,
  stringConstants: Map<string, ConstantDefinition[]>,
  numberConstants: Map<string, ConstantDefinition[]>,
  constantLocations: Set<LocationKey>
): void {
  const variableStatements = file.getVariableStatements();
  const ignoreBlocks = buildIgnoreBlocks(file.getFullText());

  for (const statement of variableStatements) {
    if (
      statement.getDeclarationKind() !== CONST_DECLARATION_KIND ||
      hasIgnoreNextLineComment(statement) ||
      isInIgnoreBlock(statement.getStartLineNumber(), ignoreBlocks)
    ) {
      continue;
    }

    for (const declaration of statement.getDeclarations()) {
      const name = declaration.getName();
      const initializer = declaration.getInitializer();
      if (!isScreamingSnakeCase(name) || !initializer) {
        continue;
      }

      handleConstInitializer(
        initializer,
        name,
        relativePath,
        packageName,
        stringConstants,
        numberConstants,
        constantLocations,
        ignoreBlocks
      );
    }
  }
}

function processEnumMember(
  member: Node,
  enumName: string,
  relativePath: string,
  packageName: string,
  stringConstants: Map<string, ConstantDefinition[]>,
  numberConstants: Map<string, ConstantDefinition[]>,
  constantLocations: Set<LocationKey>,
  ignoreBlocks: Array<{ start: number; end: number }>
): void {
  if (!Node.isEnumMember(member)) return;

  const memberName = member.getName();
  const fullPath = `${enumName}.${memberName}`;
  const initializer = member.getInitializer();
  if (!initializer) return;

  if (hasIgnoreNextLineComment(member)) return;

  const memberLine = member.getStartLineNumber();
  if (isInIgnoreBlock(memberLine, ignoreBlocks)) return;

  if (Node.isStringLiteral(initializer) || Node.isNoSubstitutionTemplateLiteral(initializer)) {
    const value = initializer.getLiteralText();
    const line = initializer.getStartLineNumber();
    addStringConstant(
      value,
      { file: relativePath, fullPath, line, name: memberName, packageName, value },
      stringConstants,
      constantLocations
    );
  } else if (Node.isNumericLiteral(initializer)) {
    const value = initializer.getLiteralValue();
    const format = getNumberFormat(initializer);
    const line = initializer.getStartLineNumber();
    addNumberConstant(
      value,
      format,
      { file: relativePath, fullPath, line, name: memberName, packageName, value },
      numberConstants,
      constantLocations
    );
  }
}

function scanEnumConstants(
  file: SourceFile,
  relativePath: string,
  packageName: string,
  stringConstants: Map<string, ConstantDefinition[]>,
  numberConstants: Map<string, ConstantDefinition[]>,
  constantLocations: Set<LocationKey>
): void {
  const enums = file.getEnums();
  const ignoreBlocks = buildIgnoreBlocks(file.getFullText());

  for (const enumDecl of enums) {
    const enumName = enumDecl.getName();
    const enumLine = enumDecl.getStartLineNumber();

    if (
      !enumName ||
      hasIgnoreNextLineComment(enumDecl) ||
      isInIgnoreBlock(enumLine, ignoreBlocks)
    ) {
      continue;
    }

    for (const member of enumDecl.getMembers()) {
      processEnumMember(
        member,
        enumName,
        relativePath,
        packageName,
        stringConstants,
        numberConstants,
        constantLocations,
        ignoreBlocks
      );
    }
  }
}

export function scanConstants(
  file: SourceFile,
  relativePath: string,
  packageName: string,
  stringConstants: Map<string, ConstantDefinition[]>,
  numberConstants: Map<string, ConstantDefinition[]>,
  constantLocations: Set<LocationKey>
): void {
  scanConstVariables(
    file,
    relativePath,
    packageName,
    stringConstants,
    numberConstants,
    constantLocations
  );
  scanEnumConstants(
    file,
    relativePath,
    packageName,
    stringConstants,
    numberConstants,
    constantLocations
  );
}
