import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Every screen has to be reachable from somewhere.
 *
 * This is not a style rule. A screen nothing links to is a screen that was
 * built, wired up, and then orphaned by a later edit — it still compiles, its
 * tests still pass, and no one will ever see it again. Reorganising navigation
 * is exactly when that happens, and it happens silently, which is why it needs
 * a test rather than a habit.
 *
 * The four tabs are the exception: the tab bar is their link.
 */

const ROOT = join(__dirname, '..');
const TABS = ['/today', '/plan', '/learn', '/profile'];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

/** Every route the app defines, as expo-router would name it. */
function routes(): string[] {
  return walk(join(ROOT, 'app'))
    .filter((path) => path.endsWith('.tsx'))
    .map((path) => path.slice(join(ROOT, 'app').length).replace(/\.tsx$/, ''))
    .filter((route) => !route.endsWith('_layout') && route !== '/index')
    .map((route) => route.replace('/(tabs)', ''));
}

/** Every route string that appears anywhere in the source. */
function linked(): Set<string> {
  const files = [...walk(join(ROOT, 'app')), ...walk(join(ROOT, 'src'))].filter(
    (path) => path.endsWith('.tsx') || path.endsWith('.ts'),
  );

  const found = new Set<string>();
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(/['"](\/[a-z0-9][a-z0-9/-]*(?:\/\[id\])?)['"]/g)) {
      found.add(match[1]);
    }
  }
  return found;
}

describe('the app is navigable', () => {
  it('links to every screen it defines', () => {
    const reachable = linked();
    const orphans = routes().filter((route) => !TABS.includes(route) && !reachable.has(route));

    expect(orphans).toEqual([]);
  });

  it('only links to screens that exist', () => {
    const defined = new Set(routes());
    const broken = [...linked()].filter(
      (route) => route.startsWith('/') && route.split('/').length <= 3 && !defined.has(route) && !isNonRoute(route),
    );

    expect(broken).toEqual([]);
  });

  it('has exactly the four tabs the tab bar declares', () => {
    const layout = readFileSync(join(ROOT, 'app/(tabs)/_layout.tsx'), 'utf8');
    const declared = [...layout.matchAll(/name: '([a-z]+)'/g)].map((match) => `/${match[1]}`);

    expect(declared.sort()).toEqual([...TABS].sort());
  });
});

/**
 * Strings that look like routes and are not: asset paths, storage keys and the
 * like. Kept as an explicit list so a genuinely broken link cannot hide in a
 * loose regex.
 */
const NOT_ROUTES = ['/assets', '/images'];

function isNonRoute(value: string): boolean {
  return NOT_ROUTES.some((prefix) => value.startsWith(prefix));
}
