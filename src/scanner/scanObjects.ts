/**
 * Object Constants Scanner
 */

import { Node } from 'ts-morph';
import type { ConstantDefinition, LocationKey, NumberFormat } from '../types/constantsTypes.js';
import { hasIgnoreNextLineComment, isInIgnoreBlock } from './handleIgnoreComments.js';
import { getNumberFormat, createNumberKey, createLocationKey } from './scanConstants.js';

export function addStringConstant(
  value: string,
  constantDef: ConstantDefinition,
  stringConstants: Map<string, ConstantDefinition[]>,
  constantLocations: Set<LocationKey>
): void {
  if (!stringConstants.has(value)) {
    stringConstants.set(value, []);
  }
  stringConstants.get(value)!.push(constantDef);
  constantLocations.add(createLocationKey(constantDef.file, constantDef.line));
}

export function addNumberConstant(
  value: number,
  format: NumberFormat,
  constantDef: ConstantDefinition,
  numberConstants: Map<string, ConstantDefinition[]>,
  constantLocations: Set<LocationKey>
): void {
  const key = createNumberKey(value, format);
  if (!numberConstants.has(key)) {
    numberConstants.set(key, []);
  }
  constantDef.numberFormat = format;
  numberConstants.get(key)!.push(constantDef);
  constantLocations.add(createLocationKey(constantDef.file, constantDef.line));
}

function handleObjectProperty(
  property: Node,
  parentPath: string,
  relativePath: string,
  packageName: string,
  stringConstants: Map<string, ConstantDefinition[]>,
  numberConstants: Map<string, ConstantDefinition[]>,
  constantLocations: Set<LocationKey>,
  ignoreBlocks: Array<{ start: number; end: number }>
): void {
  if (!Node.isPropertyAssignment(property)) return;

  if (hasIgnoreNextLineComment(property)) return;

  const propertyLine = property.getStartLineNumber();
  if (isInIgnoreBlock(propertyLine, ignoreBlocks)) return;

  const propertyName = property.getName();
  const fullPath = `${parentPath}.${propertyName}`;
  const initializer = property.getInitializer();

  if (Node.isStringLiteral(initializer) || Node.isNoSubstitutionTemplateLiteral(initializer)) {
    const value = initializer.getLiteralText();
    const line = initializer.getStartLineNumber();
    addStringConstant(
      value,
      { file: relativePath, fullPath, line, name: propertyName, packageName, value },
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
      { file: relativePath, fullPath, line, name: propertyName, packageName, value },
      numberConstants,
      constantLocations
    );
  } else if (Node.isObjectLiteralExpression(initializer)) {
    extractObjectProperties(
      initializer,
      fullPath,
      relativePath,
      packageName,
      stringConstants,
      numberConstants,
      constantLocations,
      ignoreBlocks
    );
  }
}

export function extractObjectProperties(
  objectLiteral: Node,
  parentPath: string,
  relativePath: string,
  packageName: string,
  stringConstants: Map<string, ConstantDefinition[]>,
  numberConstants: Map<string, ConstantDefinition[]>,
  constantLocations: Set<LocationKey>,
  ignoreBlocks: Array<{ start: number; end: number }>
): void {
  if (!Node.isObjectLiteralExpression(objectLiteral)) return;

  for (const property of objectLiteral.getProperties()) {
    handleObjectProperty(
      property,
      parentPath,
      relativePath,
      packageName,
      stringConstants,
      numberConstants,
      constantLocations,
      ignoreBlocks
    );
  }
}
