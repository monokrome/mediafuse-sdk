import { readFileSync, existsSync, statSync, readdirSync, type Dirent } from "node:fs";
import { resolve, dirname, basename, join, relative, sep } from "node:path";
import type { PluginEntry, PluginManifest } from "../types.js";

export interface ResolvedPlugin {
  entry: PluginEntry;
  localDir: string;
  filename: string;
  index: number;
}

export interface ResolvedManifest {
  manifest: PluginManifest;
  plugins: ResolvedPlugin[];
  staticRoot: string;
}

interface DiscoveredPlugin {
  name: string;
  src: string;
}

export function resolveManifest(
  raw: PluginManifest,
  manifestDir: string,
  searchPaths: string[],
  port: number,
): ResolvedManifest {
  const baseUrl = `http://localhost:${port}`;
  const discovered = discoverPlugins(searchPaths);
  const entries = normalizeEntries(raw.plugins);

  const plugins = entries.map((entry, i) => {
    const filePath = resolvePluginSrc(entry, manifestDir, discovered);
    const localDir = dirname(filePath);
    const filename = basename(filePath);

    const mergedEntry = mergeMetadata(entry, filePath, discovered);
    mergedEntry.src = `${baseUrl}/p/${i}/${filename}`;

    return { entry: mergedEntry, localDir, filename, index: i };
  });

  const config = rewriteConfigPaths(raw.config || {}, manifestDir, baseUrl);

  return {
    manifest: { ...raw, plugins: plugins.map((p) => p.entry), config },
    plugins,
    staticRoot: manifestDir,
  };
}

const SKIP_DIRS = new Set([
  "node_modules", ".git", ".hg", ".svn", "dist", "build", "coverage",
]);

/**
 * Walk search paths and discover plugins.
 *
 * For each -p path:
 *   - If it's a file, register it directly
 *   - If it's a directory with a package.json that has a mediafuse field, register it
 *   - Otherwise, scan subdirectories (skipping node_modules etc.) until
 *     package.jsons with mediafuse fields are found
 */
function discoverPlugins(searchPaths: string[]): Map<string, DiscoveredPlugin> {
  const found = new Map<string, DiscoveredPlugin>();

  for (const searchPath of searchPaths) {
    if (!existsSync(searchPath)) continue;

    const stat = statSync(searchPath);

    if (!stat.isDirectory()) {
      const name = basename(searchPath).replace(/\.[^.]+$/, "");
      found.set(name, { name, src: resolve(searchPath) });
      continue;
    }

    for (const plugin of scanDir(searchPath)) {
      found.set(plugin.name, plugin);
    }
  }

  return found;
}

function scanDir(dir: string): DiscoveredPlugin[] {
  const pkgPath = join(dir, "package.json");

  if (existsSync(pkgPath)) {
    const plugins = readPluginsFromPackage(dir, pkgPath);
    if (plugins.length > 0) return plugins;
  }

  const results: DiscoveredPlugin[] = [];
  let entries: Dirent[];

  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || SKIP_DIRS.has(entry.name)) continue;
    results.push(...scanDir(join(dir, entry.name)));
  }

  return results;
}

function readPluginsFromPackage(
  dir: string,
  pkgPath: string,
): DiscoveredPlugin[] {
  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
  const plugins = pkg.mediafuse?.plugins;

  if (!plugins) return [];

  const pkgName = pkg.name || basename(dir);

  // String shorthand: mediafuse.plugins: "./src/index.ts"
  if (typeof plugins === "string") {
    return [{ name: pkgName, src: resolve(dir, plugins) }];
  }

  // List: mediafuse.plugins: ["./src/index.ts", "./src/other.ts"]
  if (Array.isArray(plugins)) {
    return plugins.map((p: string, i: number) => ({
      name: i === 0 ? pkgName : `${pkgName}/${basename(p, ".ts").replace(/\.js$/, "")}`,
      src: resolve(dir, p),
    }));
  }

  return [];
}

function normalizeEntries(plugins: (string | PluginEntry)[]): PluginEntry[] {
  return plugins.map((p) => (typeof p === "string" ? { src: p } : { ...p }));
}

function resolvePluginSrc(
  entry: PluginEntry,
  manifestDir: string,
  discovered: Map<string, DiscoveredPlugin>,
): string {
  const src = entry.src;

  // Relative or absolute path
  if (src.startsWith("./") || src.startsWith("../") || src.startsWith("/")) {
    const resolved = resolve(manifestDir, src);
    if (!existsSync(resolved)) {
      throw new Error(
        `Plugin file not found: ${src} (resolved to ${resolved})`,
      );
    }
    return resolved;
  }

  // Check discovered plugins from search paths
  const match = findDiscovered(src, entry, discovered);
  if (match) return match.src;

  // File in manifest dir
  if (existsSync(resolve(manifestDir, src))) {
    return resolve(manifestDir, src);
  }

  // node_modules
  return resolveFromNodeModules(src, manifestDir);
}

function findDiscovered(
  src: string,
  entry: PluginEntry,
  discovered: Map<string, DiscoveredPlugin>,
): DiscoveredPlugin | null {
  // Exact name match
  if (entry.name && discovered.has(entry.name)) {
    return discovered.get(entry.name)!;
  }

  // Package/subplugin reference: "mediafuse-plugins/p5" → look up "p5"
  const slash = src.lastIndexOf("/");
  if (slash >= 0) {
    const subName = src.slice(slash + 1);
    if (discovered.has(subName)) return discovered.get(subName)!;
  }

  // Full src as key
  if (discovered.has(src)) return discovered.get(src)!;

  // Package name match (e.g., "@mediafuse/p5")
  for (const plugin of discovered.values()) {
    if (plugin.name === src) return plugin;
    // Match scoped package short name: "@mediafuse/p5" matches "p5"
    const scopedSlash = plugin.name.lastIndexOf("/");
    if (scopedSlash >= 0) {
      const shortName = plugin.name.slice(scopedSlash + 1);
      const srcTail = slash >= 0 ? src.slice(slash + 1) : src;
      if (shortName === srcTail) return plugin;
    }
  }

  return null;
}

function resolveFromNodeModules(ref: string, from: string): string {
  const parts = ref.split("/");
  const pkgName = parts[0].startsWith("@")
    ? parts.slice(0, 2).join("/")
    : parts[0];
  const subPlugin = parts.slice(pkgName.split("/").length).join("/") || null;

  const pkgDir = findPackageDir(pkgName, from);
  const pkg = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf-8"));
  const mediafuse = pkg.mediafuse;

  const plugins = mediafuse?.plugins;

  if (plugins) {
    if (typeof plugins === "string") {
      return resolve(pkgDir, plugins);
    }
    if (Array.isArray(plugins) && plugins.length > 0) {
      return resolve(pkgDir, plugins[0]);
    }
  }

  const main = pkg.main || "index.js";
  return resolve(pkgDir, main);
}

function findPackageDir(name: string, from: string): string {
  let dir = resolve(from);
  const root = resolve("/");

  while (dir !== root) {
    const candidate = join(dir, "node_modules", name);
    if (existsSync(join(candidate, "package.json"))) return candidate;
    dir = dirname(dir);
  }

  throw new Error(`Package not found in node_modules: ${name}`);
}

function mergeMetadata(
  entry: PluginEntry,
  _resolvedPath: string,
  discovered: Map<string, DiscoveredPlugin>,
): PluginEntry {
  const match = entry.name
    ? discovered.get(entry.name)
    : findDiscovered(entry.src, entry, discovered);

  const merged = { ...entry };

  if (match && !merged.name) {
    merged.name = match.name;
  }

  return merged;
}

function rewriteConfigPaths(
  config: Record<string, unknown>,
  manifestDir: string,
  baseUrl: string,
): Record<string, unknown> {
  return walkValues(config, (value) => {
    if (typeof value !== "string") return value;
    if (!value.startsWith("./") && !value.startsWith("../")) return value;

    const abs = resolve(manifestDir, value);
    const rel = relative(manifestDir, abs).split(sep).join("/");
    return `${baseUrl}/${rel}`;
  });
}

function walkValues(
  obj: Record<string, unknown>,
  transform: (v: unknown) => unknown,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        item && typeof item === "object" && !Array.isArray(item)
          ? walkValues(item as Record<string, unknown>, transform)
          : transform(item),
      );
    } else if (value && typeof value === "object") {
      result[key] = walkValues(value as Record<string, unknown>, transform);
    } else {
      result[key] = transform(value);
    }
  }

  return result;
}
