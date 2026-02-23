/**
 * Project discovery for single projects and monorepos
 */

import { constants } from 'fs';
import { access, readdir } from 'fs/promises';
import { join } from 'path';
import { readJsonFile } from '../utils/fileUtils.js';

interface MinimalPackageJson {
  name?: string;
  workspaces?: string[] | { packages: string[] };
}

export interface ProjectInfo {
  name: string;
  displayName: string;
  packageName: string;
  path: string;
  relativePath: string;
}

/**
 * Discover projects in a monorepo (packages/ directory or workspaces)
 */
export async function discoverProjects(repoRoot: string): Promise<ProjectInfo[]> {
  const packageJson = await readJsonFile<MinimalPackageJson>(join(repoRoot, 'package.json'));

  const packagesDir = join(repoRoot, 'packages');
  const hasPackagesDir = await access(packagesDir, constants.F_OK)
    .then(() => true)
    .catch(() => false);

  if (hasPackagesDir) {
    const entries = await readdir(packagesDir);
    const projects: ProjectInfo[] = [];

    for (const entry of entries) {
      const entryPath = join(packagesDir, entry);
      const packageJsonPath = join(entryPath, 'package.json');

      try {
        await access(packageJsonPath, constants.F_OK);
        const pkgJson = await readJsonFile<MinimalPackageJson>(packageJsonPath);
        const packageName = pkgJson?.name || entry;

        projects.push({
          name: entry,
          displayName: entry,
          packageName,
          path: entryPath,
          relativePath: `packages/${entry}`,
        });
      } catch {
        // Skip directories without package.json
      }
    }

    return projects.sort((a, b) => a.displayName.localeCompare(b.displayName));
  }

  const workspaces = packageJson?.workspaces;
  if (workspaces) {
    const patterns = Array.isArray(workspaces) ? workspaces : workspaces.packages || [];
    const projects: ProjectInfo[] = [];

    for (const pattern of patterns) {
      const baseDir = pattern.replace('/*', '');
      const fullPath = join(repoRoot, baseDir);

      try {
        const entries = await readdir(fullPath);
        for (const entry of entries) {
          const entryPath = join(fullPath, entry);
          const packageJsonPath = join(entryPath, 'package.json');

          try {
            await access(packageJsonPath, constants.F_OK);
            const pkgJson = await readJsonFile<MinimalPackageJson>(packageJsonPath);
            const packageName = pkgJson?.name || entry;
            const relativePath = join(baseDir, entry);

            projects.push({
              name: entry,
              displayName: entry,
              packageName,
              path: entryPath,
              relativePath,
            });
          } catch {
            // Skip
          }
        }
      } catch {
        // Skip if workspace directory doesn't exist
      }
    }

    return projects.sort((a, b) => a.displayName.localeCompare(b.displayName));
  }

  return [];
}

/**
 * Get project info for a single-project (non-monorepo) setup
 */
export function getSingleProjectInfo(rootPath: string): ProjectInfo {
  return {
    name: 'project',
    displayName: 'Project',
    packageName: 'project',
    path: rootPath,
    relativePath: '.',
  };
}
