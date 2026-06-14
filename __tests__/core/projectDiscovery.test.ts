import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  discoverProjects,
  getSingleProjectInfo,
} from '../../src/core/projectDiscovery.js';

async function writePackage(pkgDir: string, contents: object | null): Promise<void> {
  await mkdir(pkgDir, { recursive: true });
  if (contents !== null) {
    await writeFile(join(pkgDir, 'package.json'), JSON.stringify(contents), 'utf8');
  }
}

describe('getSingleProjectInfo', () => {
  it('describes a single project rooted at the given path', () => {
    expect(getSingleProjectInfo('/repo')).toEqual({
      name: 'project',
      displayName: 'Project',
      packageName: 'project',
      path: '/repo',
      relativePath: '.',
    });
  });
});

describe('discoverProjects', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'constants-check-pd-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('discovers packages under a packages/ directory, sorted by display name', async () => {
    await writePackage(join(dir, 'packages', 'foo'), { name: '@scope/foo' });
    await writePackage(join(dir, 'packages', 'bar'), {});

    const projects = await discoverProjects(dir);

    expect(projects.map((p) => p.displayName)).toEqual(['bar', 'foo']);
    expect(projects[0]).toMatchObject({
      name: 'bar',
      packageName: 'bar', // falls back to the directory name when name is absent
      relativePath: 'packages/bar',
    });
    expect(projects[1].packageName).toBe('@scope/foo');
  });

  it('skips packages/ entries without a package.json', async () => {
    await writePackage(join(dir, 'packages', 'real'), { name: 'real' });
    await mkdir(join(dir, 'packages', 'not-a-package'), { recursive: true });

    const projects = await discoverProjects(dir);
    expect(projects.map((p) => p.name)).toEqual(['real']);
  });

  it('discovers workspaces declared as an array', async () => {
    await writeFile(
      join(dir, 'package.json'),
      JSON.stringify({ workspaces: ['apps/*'] }),
      'utf8'
    );
    await writePackage(join(dir, 'apps', 'web'), { name: 'web-app' });

    const projects = await discoverProjects(dir);
    expect(projects).toHaveLength(1);
    expect(projects[0]).toMatchObject({
      name: 'web',
      packageName: 'web-app',
      relativePath: join('apps', 'web'),
    });
  });

  it('discovers workspaces declared as an object with packages', async () => {
    await writeFile(
      join(dir, 'package.json'),
      JSON.stringify({ workspaces: { packages: ['libs/*'] } }),
      'utf8'
    );
    await writePackage(join(dir, 'libs', 'core'), { name: 'core-lib' });

    const projects = await discoverProjects(dir);
    expect(projects.map((p) => p.packageName)).toEqual(['core-lib']);
  });

  it('returns an empty list when there are no packages or workspaces', async () => {
    await writeFile(join(dir, 'package.json'), JSON.stringify({ name: 'solo' }), 'utf8');
    expect(await discoverProjects(dir)).toEqual([]);
  });
});
