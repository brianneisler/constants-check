/**
 * Constants Check Configuration
 */

export const DEFAULT_CONFIG = {
  ignoreNumbers: [0, 1, 2, -1, 10, 100] as number[],
  minDuplication: 2,
  minStringLength: 3,
};

export const MIN_DEFINITION_DUPLICATION = 2;
export const ENABLE_DEEP_OBJECT_COMPARISON = true;
export const CROSS_PACKAGE_ONLY = false;

/** Default package priority for consolidation (empty = use alphabetical) */
export const DEFAULT_PACKAGE_PRIORITY: string[] = [];
