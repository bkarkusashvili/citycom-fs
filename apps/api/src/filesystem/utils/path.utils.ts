import * as path from 'path';

export function normalizePath(inputPath: string): string {
  let normalized = inputPath.replace(/\\/g, '/').replace(/\/+/g, '/');
  if (!normalized.startsWith('/')) {
    normalized = '/' + normalized;
  }
  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

export function getParentPath(filePath: string): string | null {
  const normalized = normalizePath(filePath);
  if (normalized === '/') return null;
  const parent = normalized.substring(0, normalized.lastIndexOf('/')) || '/';
  return parent;
}

export function getBasename(filePath: string): string {
  return path.basename(normalizePath(filePath));
}

export function isDescendantOf(childPath: string, parentPath: string): boolean {
  const normalizedChild = normalizePath(childPath);
  const normalizedParent = normalizePath(parentPath);
  return normalizedChild.startsWith(normalizedParent + '/');
}
