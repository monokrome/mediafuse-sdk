#!/usr/bin/env node

import { parseArgs } from "node:util";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { resolveManifest } from "./resolve.js";
import { startServer } from "./server.js";

const USAGE = `Usage: mediafuse [-p path ...] [--port N] [manifest.json]

Serve a MediaFuse manifest and its plugins locally.

If no manifest is given, looks for mediafuse.manifest in package.json.

Options:
  -p, --plugin path   Plugin search path (repeatable)
                       Can be a directory or a single file
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

const manifestPath = positionals.length === 1
  ? resolve(positionals[0])
  : findManifestFromPackageJson();

if (!existsSync(manifestPath)) {
  console.error(`Manifest not found: ${manifestPath}`);
  process.exit(1);
}

const manifestDir = dirname(manifestPath);
const manifestData = JSON.parse(readFileSync(manifestPath, "utf-8"));
const port = parseInt(values.port as string, 10);
const searchPaths = (values.plugin as string[]).map((p) => resolve(p));

const resolved = resolveManifest(manifestData, manifestDir, searchPaths, port);
startServer(resolved, port);

function findManifestFromPackageJson(): string {
  const pkgPath = join(process.cwd(), "package.json");

  if (!existsSync(pkgPath)) {
    console.error("No manifest argument and no package.json in current directory");
    process.exit(1);
  }

  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
  const manifestRef = pkg.mediafuse?.manifest;

  if (!manifestRef) {
    console.error("No manifest argument and no mediafuse.manifest in package.json");
    process.exit(1);
  }

  return resolve(process.cwd(), manifestRef);
}
