#!/usr/bin/env node

import { parseArgs } from "node:util";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { resolveManifest, findManifestEntry } from "./resolve.js";
import { startServer } from "./server.js";
import { resolveRef, setCacheDir } from "./remote.js";

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
      --data D   Directory for cloned repos and fetched files (default: system temp)
      --cache         Enable browser caching (sends Cache-Control: public, max-age=300)
  -h, --help          Show this help`;

const { values, positionals } = parseArgs({
  options: {
    plugin: { type: "string", short: "p", multiple: true, default: [] },
    port: { type: "string", default: "8000" },
    "data": { type: "string" },
    cache: { type: "boolean", default: false },
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
  if (values["data"]) {
    setCacheDir(values["data"]);
  }

  const manifestPath = positionals.length === 1
    ? await resolveRef(positionals[0], findManifestEntry)
    : findManifestLocal();

  if (!existsSync(manifestPath)) {
    console.error(`Manifest not found: ${manifestPath}`);
    process.exit(1);
  }

  const manifestDir = dirname(manifestPath);
  const manifestData = JSON.parse(readFileSync(manifestPath, "utf-8"));
  const port = parseInt(values.port as string, 10);

  const searchPaths = await Promise.all(
    (values.plugin as string[]).map(async (p) => resolve(await resolveRef(p))),
  );

  const resolved = await resolveManifest(manifestData, manifestDir, searchPaths);
  startServer(resolved, port, { cache: values.cache as boolean });
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
