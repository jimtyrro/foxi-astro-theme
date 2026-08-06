#!/usr/bin/env node
// Scans source files for imports that aren't declared in package.json.
// These are "phantom dependencies" — they only work because npm/yarn hoist
// everything into one flat node_modules/. A strict installer (nub, pnpm)
// refuses to resolve them, so they surface as build failures one at a time.
//
// Framework-agnostic: by default scans the whole project (minus generated/
// vendor dirs) and understands JS/TS plus SFC formats (.astro, .svelte,
// .vue, .mdx) whose frontmatter/script blocks hold imports.
//
// Usage:
//   node scripts/find-phantom-deps.mjs              # report only
//   node scripts/find-phantom-deps.mjs --fix         # add missing deps to package.json
//   node scripts/find-phantom-deps.mjs --dir src app # scan specific dirs only
//
// No dependencies beyond Node's stdlib — safe to drop into any project.

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { builtinModules } from 'node:module';
import { fileURLToPath } from 'node:url';

const SELF = fileURLToPath(import.meta.url); // don't scan this script (its docs match IMPORT_RE)

const args = process.argv.slice(2);
const fix = args.includes('--fix');
const dirFlagIdx = args.indexOf('--dir');
// Default: scan the whole project root. --dir restricts to specific dirs.
const scanDirs = dirFlagIdx === -1
  ? ['.']
  : args.slice(dirFlagIdx + 1).filter((a) => !a.startsWith('--'));

// JS/TS plus single-file-component / frontmatter formats that carry imports.
const CODE_EXT = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.mts', '.cts',
  '.astro', '.svelte', '.vue', '.mdx',
]);

// Vendor/build-output/cache dirs — never source.
const SKIP_DIRS = new Set([
  'node_modules', 'dist', 'build', 'out', 'release', 'coverage',
  '.git', '.store', '.astro', '.next', '.nuxt', '.svelte-kit', '.output',
  '.vercel', '.netlify', '.cache', '.turbo', '.idea', '.vscode',
]);

// Specifier prefixes that are never package deps: bundler virtual modules,
// runtime namespaces, tsconfig path aliases.
const SKIP_PREFIX = ['astro:', 'virtual:', 'node:', '#', '~/', '@/'];

const BUILTINS = new Set([...builtinModules, ...builtinModules.map((m) => `node:${m}`)]);

const root = process.cwd();
const pkgPath = join(root, 'package.json');
if (!existsSync(pkgPath)) {
  console.error('No package.json in', root);
  process.exit(1);
}
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
const declared = new Set([
  ...Object.keys(pkg.dependencies || {}),
  ...Object.keys(pkg.devDependencies || {}),
  ...Object.keys(pkg.peerDependencies || {}),
  ...Object.keys(pkg.optionalDependencies || {}),
]);

function walk(dir, files = []) {
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, files);
    else if (CODE_EXT.has(entry.slice(entry.lastIndexOf('.'))) && full !== SELF) files.push(full);
  }
  return files;
}

// import ... from 'x' / import 'x' / import('x') / require('x')
const IMPORT_RE =
  /(?:import\s+(?:[\w*${}\s,]+\s+from\s+)?|export\s+(?:[\w*${}\s,]+\s+from\s+)?|require\(\s*|import\(\s*)['"]([^'"]+)['"]/g;

// bare specifier -> package name ('@scope/pkg/sub' -> '@scope/pkg', 'pkg/sub' -> 'pkg')
function packageName(spec) {
  if (spec.startsWith('.') || spec.startsWith('/')) return null; // relative/absolute — not a dep
  if (SKIP_PREFIX.some((p) => spec.startsWith(p))) return null; // virtual/alias — not a dep
  if (spec.startsWith('@')) {
    const parts = spec.split('/');
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : null;
  }
  return spec.split('/')[0];
}

const files = scanDirs.flatMap((d) => walk(join(root, d)));
if (files.length === 0) {
  console.error(`No source files found under: ${scanDirs.join(', ')}`);
  process.exit(1);
}
console.error(`Scanning ${files.length} files...`);

const usedBy = new Map(); // pkgName -> Set(relative file paths)
for (const file of files) {
  const src = readFileSync(file, 'utf8');
  for (const m of src.matchAll(IMPORT_RE)) {
    const name = packageName(m[1]);
    if (!name || BUILTINS.has(name) || name === pkg.name) continue;
    if (!usedBy.has(name)) usedBy.set(name, new Set());
    usedBy.get(name).add(relative(root, file));
  }
}

// Resolve an installed version for an undeclared package, checking both a
// flat node_modules/ (npm/bun/yarn) and nub/pnpm's content-addressable
// node_modules/.store/ layout.
function resolveInstalledVersion(name) {
  const flat = join(root, 'node_modules', name, 'package.json');
  if (existsSync(flat)) {
    try {
      return JSON.parse(readFileSync(flat, 'utf8')).version;
    } catch {}
  }
  const storeDir = join(root, 'node_modules', '.store');
  if (existsSync(storeDir)) {
    const prefix = name.replace('/', '+') + '@';
    const hit = readdirSync(storeDir).find((e) => e.startsWith(prefix));
    if (hit) return hit.slice(prefix.length).split('_')[0];
  }
  return null;
}

const missing = [...usedBy.keys()]
  .filter((name) => !declared.has(name))
  .sort()
  .map((name) => ({
    name,
    version: resolveInstalledVersion(name),
    usedBy: [...usedBy.get(name)].sort(),
  }));

if (missing.length === 0) {
  console.log('No phantom dependencies found.');
  process.exit(0);
}

console.log(`Found ${missing.length} phantom dependenc${missing.length === 1 ? 'y' : 'ies'}:\n`);
for (const m of missing) {
  const ver = m.version ? `^${m.version}` : '(not installed — check the import)';
  console.log(`  ${m.name}  ${ver}`);
  for (const f of m.usedBy) console.log(`    used in ${f}`);
}

if (!fix) {
  console.log('\nRun with --fix to add resolved ones to package.json#dependencies.');
  process.exit(1);
}

const resolvable = missing.filter((m) => m.version);
const unresolvable = missing.filter((m) => !m.version);
if (resolvable.length > 0) {
  pkg.dependencies = pkg.dependencies || {};
  for (const m of resolvable) pkg.dependencies[m.name] = `^${m.version}`;
  pkg.dependencies = Object.fromEntries(
    Object.entries(pkg.dependencies).sort(([a], [b]) => a.localeCompare(b)),
  );
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  console.log(`\nAdded ${resolvable.length} package(s) to package.json#dependencies.`);
  console.log('Now run your installer with lockfile updates allowed, e.g.:');
  console.log('  nub install --no-frozen-lockfile');
}
if (unresolvable.length > 0) {
  console.log(
    `\n${unresolvable.length} import(s) have no resolved version on disk (not installed, or a path alias like '@/...') — fix these manually:`,
  );
  for (const m of unresolvable) console.log(`  ${m.name}`);
  process.exit(1);
}
