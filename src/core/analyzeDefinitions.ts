/**
 * Duplicate constant definition analysis
 */

import type {
  ConstantDefinition,
  DuplicateDefinitionGroup,
  DuplicateDefinitionsResult,
} from '../types/constantsTypes.js';
import { deepEqual } from '../comparison/deepEqual.js';
import { areNamesSimilar } from '../comparison/fuzzyMatch.js';
import { hashObjectStructure } from './hashUtils.js';
import { MIN_DEFINITION_DUPLICATION, CROSS_PACKAGE_ONLY } from './config.js';

function getPropertyName(fullPath: string): string {
  const parts = fullPath.split('.');
  return parts[parts.length - 1];
}

function getBaseName(definition: ConstantDefinition): string {
  if (definition.fullPath) {
    const parts = definition.fullPath.split('.');
    return parts[0];
  }
  return definition.name;
}

function getRecommendedPackage(packages: string[], priorityList: string[] = []): string {
  for (const priorityPkg of priorityList) {
    if (packages.includes(priorityPkg)) {
      return priorityPkg;
    }
  }
  return packages.sort()[0];
}

function shouldReportDefinitions(definitions: ConstantDefinition[]): boolean {
  if (definitions.length < MIN_DEFINITION_DUPLICATION) return false;

  if (CROSS_PACKAGE_ONLY) {
    const packages = new Set(definitions.map((def) => def.packageName));
    return packages.size > 1;
  }

  return true;
}

function isObjectProperty(def: ConstantDefinition): boolean {
  return Boolean(def.fullPath && def.fullPath.includes('.'));
}

function matchObjectProperties(def1: ConstantDefinition, def2: ConstantDefinition): boolean {
  const baseName1 = getBaseName(def1);
  const baseName2 = getBaseName(def2);
  if (!areNamesSimilar(baseName1, baseName2)) return false;

  const propName1 = getPropertyName(def1.fullPath!);
  const propName2 = getPropertyName(def2.fullPath!);
  return areNamesSimilar(propName1, propName2);
}

function matchObjectWithStandalone(
  objectDef: ConstantDefinition,
  standaloneDef: ConstantDefinition
): boolean {
  const propName = getPropertyName(objectDef.fullPath!);
  return areNamesSimilar(propName, standaloneDef.name);
}

function doDefinitionsMatch(def1: ConstantDefinition, def2: ConstantDefinition): boolean {
  if (!deepEqual(def1.value, def2.value)) return false;

  const isObject1 = isObjectProperty(def1);
  const isObject2 = isObjectProperty(def2);

  if (isObject1 && isObject2) {
    return matchObjectProperties(def1, def2);
  }

  if (isObject1 || isObject2) {
    const objectDef = isObject1 ? def1 : def2;
    const standaloneDef = isObject1 ? def2 : def1;
    return matchObjectWithStandalone(objectDef, standaloneDef);
  }

  return areNamesSimilar(def1.name, def2.name);
}

function findMatchingGroup(
  def: ConstantDefinition,
  groups: ConstantDefinition[][]
): ConstantDefinition[] | null {
  for (const group of groups) {
    if (doDefinitionsMatch(def, group[0])) {
      return group;
    }
  }
  return null;
}

function groupByFuzzyNameAndValue(
  definitions: ConstantDefinition[]
): Map<string, ConstantDefinition[]> {
  const groups: ConstantDefinition[][] = [];

  for (const def of definitions) {
    const matchingGroup = findMatchingGroup(def, groups);

    if (matchingGroup) {
      matchingGroup.push(def);
    } else {
      groups.push([def]);
    }
  }

  const result = new Map<string, ConstantDefinition[]>();
  for (const group of groups) {
    if (group.length > 0) {
      result.set(getBaseName(group[0]), group);
    }
  }

  return result;
}

function createDuplicateGroup(
  name: string,
  definitions: ConstantDefinition[],
  packagePriority: string[]
): DuplicateDefinitionGroup {
  const packages = [...new Set(definitions.map((def) => def.packageName))];
  const firstDef = definitions[0];
  const value = firstDef.value;

  let valueType: 'string' | 'number' | 'object';
  if (typeof value === 'string') {
    valueType = 'string';
  } else if (typeof value === 'number') {
    valueType = 'number';
  } else {
    valueType = 'object';
  }

  const group: DuplicateDefinitionGroup = {
    definitions,
    name,
    packages,
    recommendedPackage: getRecommendedPackage(packages, packagePriority),
    value,
    valueType,
  };

  if (valueType === 'object') {
    group.structureHash = hashObjectStructure(value);
  }

  return group;
}

function combineAllDefinitions(
  stringConstants: Map<string, ConstantDefinition[]>,
  numberConstants: Map<string, ConstantDefinition[]>
): ConstantDefinition[] {
  const allDefinitions: ConstantDefinition[] = [];

  for (const defs of stringConstants.values()) {
    allDefinitions.push(...defs);
  }

  for (const defs of numberConstants.values()) {
    allDefinitions.push(...defs);
  }

  return allDefinitions;
}

function findDuplicateNames(
  allDefinitions: ConstantDefinition[],
  packagePriority: string[] = []
): DuplicateDefinitionGroup[] {
  const fuzzyGroups = groupByFuzzyNameAndValue(allDefinitions);
  const duplicateNames: DuplicateDefinitionGroup[] = [];

  for (const [name, definitions] of fuzzyGroups.entries()) {
    if (shouldReportDefinitions(definitions)) {
      duplicateNames.push(createDuplicateGroup(name, definitions, packagePriority));
    }
  }

  return duplicateNames;
}

function collectAffectedPackages(groups: DuplicateDefinitionGroup[]): string[] {
  const affectedPackagesSet = new Set<string>();
  for (const group of groups) {
    for (const pkg of group.packages) {
      affectedPackagesSet.add(pkg);
    }
  }
  return [...affectedPackagesSet].sort();
}

export interface AnalyzeDefinitionsOptions {
  packagePriority?: string[];
}

export function analyzeDuplicateDefinitions(
  stringConstants: Map<string, ConstantDefinition[]>,
  numberConstants: Map<string, ConstantDefinition[]>,
  options: AnalyzeDefinitionsOptions = {}
): DuplicateDefinitionsResult {
  const { packagePriority = [] } = options;
  const allDefinitions = combineAllDefinitions(stringConstants, numberConstants);
  const duplicateDefinitions = findDuplicateNames(allDefinitions, packagePriority);

  return {
    affectedPackages: collectAffectedPackages(duplicateDefinitions),
    duplicateDefinitions,
    totalDuplicates: duplicateDefinitions.length,
  };
}
