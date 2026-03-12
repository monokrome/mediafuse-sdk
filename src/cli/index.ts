#!/usr/bin/env node

import { parseArgs } from "node:util";
import { readFileSync, existsSync, statSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { resolveManifest } from "./resolve.js";
import { startServer } from "./server.js";
import { resolveSource, findManifestInDir } from "./remote.js";

const USAGE = `Usage: mediafuse [-p path ...] [--port N] [source]

Serve a MediaFuse manifest and its plugins locally.

Source can be:
  manifest.json               Local manifest file
  ./path/to/dir               Local directory containing manifest.json
  owner/repo                  GitHub repo (shorthand)
  github:owner/repo           GitHub repo
  codeberg:owner/repo         Codeberg repo
  gitlab:owner/repo           GitLab repo
  https://github.com/o/r      Full URL to any Git repo

If no source is given, checks mediafuse.manifest in package.json,
then falls back to manifest.json in the current directory.

Options:
  -p, --plugin path   Plugin search path (repeatable)
                       Can be a directory, file, or remote repo
      --port N        Port to listen on (default: 8000)
  -h, --help          Show this help`;

const { values, positionals } = parseArgs({
  options: {
    plugin: { type: "string", short: "p", multiple: true, default: [] },
    port: { type: "string", default: "8000" },
    help: { type: "boolean", short: "h", default: false },
  },
  allowPositionals: true,
});

if (values.help) {
  console.log(USAGE);
  process.exit(0);
}

if (positionals.length > 1) {
  console.error(USAGE);
  process.exit(1);
}

async function main(): Promise<void> {
  const manifestPath = positionals.length === 1
    ? await resolveManifestSource(positionals[0])
    : findManifestLocal();

  if (!existsSync(manifestPath)) {
    console.error(`Manifest not found: ${manifestPath}`);
    process.exit(1);
  }

  const manifestDir = dirname(manifestPath);
  const manifestData = JSON.parse(readFileSync(manifestPath, "utf-8"));
  const port = parseInt(values.port as string, 10);

  const searchPaths = await Promise.all(
    (values.plugin as string[]).map(async (p) => resolve(await resolveSource(p))),
  );

  const resolved = resolveManifest(manifestData, manifestDir, searchPaths, port);
  startServer(resolved, port);
}

async function resolveManifestSource(input: string): Promise<string> {
  const localPath = await resolveSource(input);
  const resolved = resolve(localPath);

  if (existsSync(resolved) && statSync(resolved).isDirectory()) {
    const manifest = findManifestInDir(resolved);
    if (!manifest) {
      console.error(`No manifest.json found in ${resolved}`);
      process.exit(1);
    }
    return manifest;
  }

  return resolved;
}

function findManifestLocal(): string {
  const pkgPath = join(process.cwd(), "package.json");
  if (existsSync(pkgPath)) {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    const manifestRef = pkg.mediafuse?.manifest;
    if (manifestRef) return resolve(process.cwd(), manifestRef);
  }

  const defaultPath = join(process.cwd(), "manifest.json");
  if (existsSync(defaultPath)) return defaultPath;

  console.error("No manifest found. Provide a path, set mediafuse.manifest in package.json, or add a manifest.json");
  process.exit(1);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
