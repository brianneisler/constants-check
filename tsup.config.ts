import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: { index: 'src/index.ts' },
    format: ['esm'],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: true,
    target: 'node20',
    outDir: 'dist',
  },
  {
    entry: { cli: 'src/cli.ts' },
    format: ['esm'],
    splitting: false,
    sourcemap: true,
    target: 'node20',
    outDir: 'dist',
    banner: { js: '#!/usr/bin/env node' },
  },
]);
