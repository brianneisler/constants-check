/**
 * Deep comparison utilities for constant values
 */

function areSameType(value1: unknown, value2: unknown): boolean {
  return typeof value1 === typeof value2;
}

function areArraysEqual(arr1: unknown[], arr2: unknown[]): boolean {
  if (arr1.length !== arr2.length) return false;
  return arr1.every((item, index) => deepEqual(item, arr2[index]));
}

function haveSameKeys(keys1: string[], keys2: string[]): boolean {
  if (keys1.length !== keys2.length) return false;
  return keys1.every((key, index) => key === keys2[index]);
}

function areObjectsEqual(obj1: object, obj2: object): boolean {
  const keys1 = Object.keys(obj1).sort();
  const keys2 = Object.keys(obj2).sort();

  if (!haveSameKeys(keys1, keys2)) return false;

  return keys1.every((key) =>
    deepEqual((obj1 as Record<string, unknown>)[key], (obj2 as Record<string, unknown>)[key])
  );
}

function comparePrimitives(value1: unknown, value2: unknown): boolean | null {
  if (value1 === value2) return true;
  if (value1 === null || value2 === null) return false;
  if (value1 === undefined || value2 === undefined) return false;
  if (!areSameType(value1, value2)) return false;
  return null;
}

export function deepEqual(value1: unknown, value2: unknown): boolean {
  const primitiveResult = comparePrimitives(value1, value2);
  if (primitiveResult !== null) return primitiveResult;

  if (Array.isArray(value1) && Array.isArray(value2)) {
    return areArraysEqual(value1, value2);
  }

  if (typeof value1 === 'object' && typeof value2 === 'object') {
    return areObjectsEqual(value1 as object, value2 as object);
  }

  return false;
}
