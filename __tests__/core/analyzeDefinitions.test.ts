import { describe, it, expect } from 'vitest';
import { analyzeDuplicateDefinitions } from '../../src/core/analyzeDefinitions.js';
import type { ConstantDefinition } from '../../src/types/constantsTypes.js';

function def(partial: Partial<ConstantDefinition> & { name: string }): ConstantDefinition {
  return {
    value: 'x',
    file: 'file.ts',
    line: 1,
    packageName: 'pkg',
    ...partial,
  };
}

function stringMap(...defs: ConstantDefinition[]): Map<string, ConstantDefinition[]> {
  return new Map([['key', defs]]);
}

const empty = new Map<string, ConstantDefinition[]>();

describe('analyzeDuplicateDefinitions', () => {
  it('groups standalone constants with similar names and equal values', () => {
    const result = analyzeDuplicateDefinitions(
      stringMap(
        def({ name: 'MAX_RETRIES', value: 'v', packageName: 'beta' }),
        def({ name: 'MAX_RETRY', value: 'v', packageName: 'alpha' })
      ),
      empty
    );

    expect(result.totalDuplicates).toBe(1);
    expect(result.duplicateDefinitions[0].definitions).toHaveLength(2);
    expect(result.affectedPackages).toEqual(['alpha', 'beta']);
  });

  it('does not group constants with different values', () => {
    const result = analyzeDuplicateDefinitions(
      stringMap(def({ name: 'TIMEOUT', value: 'a' }), def({ name: 'TIMEOUT', value: 'b' })),
      empty
    );
    expect(result.totalDuplicates).toBe(0);
    expect(result.affectedPackages).toEqual([]);
  });

  it('does not group dissimilar names even with equal values', () => {
    const result = analyzeDuplicateDefinitions(
      stringMap(
        def({ name: 'ALPHA_CONSTANT', value: 'v' }),
        def({ name: 'ZULU_FLAG', value: 'v' })
      ),
      empty
    );
    expect(result.totalDuplicates).toBe(0);
  });

  it('requires at least two definitions to report a duplicate', () => {
    const result = analyzeDuplicateDefinitions(
      stringMap(def({ name: 'ONLY_ONE', value: 'v' })),
      empty
    );
    expect(result.totalDuplicates).toBe(0);
  });

  it('recommends the alphabetically first package by default', () => {
    const result = analyzeDuplicateDefinitions(
      stringMap(
        def({ name: 'API_URL', value: 'v', packageName: 'zoo' }),
        def({ name: 'API_URL', value: 'v', packageName: 'ant' })
      ),
      empty
    );
    expect(result.duplicateDefinitions[0].recommendedPackage).toBe('ant');
  });

  it('honors an explicit package priority over alphabetical order', () => {
    const result = analyzeDuplicateDefinitions(
      stringMap(
        def({ name: 'API_URL', value: 'v', packageName: 'zoo' }),
        def({ name: 'API_URL', value: 'v', packageName: 'ant' })
      ),
      empty,
      { packagePriority: ['zoo'] }
    );
    expect(result.duplicateDefinitions[0].recommendedPackage).toBe('zoo');
  });

  it('skips priority packages that are not present, choosing the first that is', () => {
    const result = analyzeDuplicateDefinitions(
      stringMap(
        def({ name: 'API_URL', value: 'v', packageName: 'zoo' }),
        def({ name: 'API_URL', value: 'v', packageName: 'ant' })
      ),
      empty,
      { packagePriority: ['absent-pkg', 'zoo'] }
    );
    expect(result.duplicateDefinitions[0].recommendedPackage).toBe('zoo');
  });

  it('does not match object properties with dissimilar base names', () => {
    const result = analyzeDuplicateDefinitions(
      stringMap(
        def({ name: 'timeout', fullPath: 'ALPHA.timeout', value: 'v' }),
        def({ name: 'timeout', fullPath: 'ZULU.timeout', value: 'v' })
      ),
      empty
    );
    expect(result.totalDuplicates).toBe(0);
  });

  it('matches an object property to a standalone by property name, not member name', () => {
    // The object property's declared name differs from its path segment, so the
    // match must use the path's property name ("timeout"), not the member name.
    const result = analyzeDuplicateDefinitions(
      stringMap(
        def({ name: 'zzz_different', fullPath: 'XYZ.timeout', value: 'v' }),
        def({ name: 'timeout', value: 'v' })
      ),
      empty
    );
    expect(result.totalDuplicates).toBe(1);
  });

  describe('crossPackageOnly', () => {
    it('reports a single-package duplicate by default', () => {
      const result = analyzeDuplicateDefinitions(
        stringMap(
          def({ name: 'API_URL', value: 'v', packageName: 'solo' }),
          def({ name: 'API_URL', value: 'v', packageName: 'solo' })
        ),
        empty
      );
      expect(result.totalDuplicates).toBe(1);
    });

    it('suppresses a single-package duplicate when crossPackageOnly is set', () => {
      const result = analyzeDuplicateDefinitions(
        stringMap(
          def({ name: 'API_URL', value: 'v', packageName: 'solo' }),
          def({ name: 'API_URL', value: 'v', packageName: 'solo' })
        ),
        empty,
        { crossPackageOnly: true }
      );
      expect(result.totalDuplicates).toBe(0);
    });

    it('still reports a multi-package duplicate when crossPackageOnly is set', () => {
      const result = analyzeDuplicateDefinitions(
        stringMap(
          def({ name: 'API_URL', value: 'v', packageName: 'alpha' }),
          def({ name: 'API_URL', value: 'v', packageName: 'beta' })
        ),
        empty,
        { crossPackageOnly: true }
      );
      expect(result.totalDuplicates).toBe(1);
      expect(result.affectedPackages).toEqual(['alpha', 'beta']);
    });
  });

  it('classifies string-valued groups', () => {
    const result = analyzeDuplicateDefinitions(
      stringMap(def({ name: 'GREETING', value: 'hi' }), def({ name: 'GREETINGS', value: 'hi' })),
      empty
    );
    expect(result.duplicateDefinitions[0].valueType).toBe('string');
    expect(result.duplicateDefinitions[0].structureHash).toBeUndefined();
  });

  it('classifies number-valued groups', () => {
    const result = analyzeDuplicateDefinitions(
      empty,
      stringMap(def({ name: 'PORT_NUMBER', value: 8080 }), def({ name: 'PORT_NUM', value: 8080 }))
    );
    expect(result.duplicateDefinitions[0].valueType).toBe('number');
  });

  it('classifies object-valued groups and attaches a structure hash', () => {
    const objectValue = { a: 1 } as unknown as string;
    const result = analyzeDuplicateDefinitions(
      stringMap(
        def({ name: 'CONFIG_OBJ', value: objectValue }),
        def({ name: 'CONFIG_OBJECT', value: objectValue })
      ),
      empty
    );
    const group = result.duplicateDefinitions[0];
    expect(group.valueType).toBe('object');
    expect(group.structureHash).toMatch(/^[0-9a-f]{16}$/);
  });

  it('matches object properties by base name and property name', () => {
    const result = analyzeDuplicateDefinitions(
      stringMap(
        def({ name: 'timeout', fullPath: 'CONFIG.timeout', value: 'v' }),
        def({ name: 'timeout', fullPath: 'CONFIGS.timeout', value: 'v' })
      ),
      empty
    );
    expect(result.totalDuplicates).toBe(1);
  });

  it('does not match object properties with dissimilar property names', () => {
    const result = analyzeDuplicateDefinitions(
      stringMap(
        def({ name: 'timeout', fullPath: 'CONFIG.timeout', value: 'v' }),
        def({ name: 'hostname', fullPath: 'CONFIG.hostname', value: 'v' })
      ),
      empty
    );
    expect(result.totalDuplicates).toBe(0);
  });

  it('matches an object property against a similarly named standalone constant', () => {
    const result = analyzeDuplicateDefinitions(
      stringMap(
        def({ name: 'timeout', fullPath: 'CONFIG.timeout', value: 'v' }),
        def({ name: 'timeout', value: 'v' })
      ),
      empty
    );
    expect(result.totalDuplicates).toBe(1);
  });
});
