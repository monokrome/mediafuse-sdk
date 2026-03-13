import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync, createReadStream, existsSync } from "node:fs";
import { join, extname, resolve, dirname, basename, sep } from "node:path";
import { createHash } from "node:crypto";
import { transform } from "esbuild";
import type { ResolvedManifest } from "./resolve.js";
import { resolveRef } from "./remote.js";

const MIME: Record<string, string> = {
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".ts": "application/javascript",
  ".tsx": "application/javascript",
  ".json": "application/json",
  ".html": "text/html",
  ".css": "text/css",
  ".wasm": "application/wasm",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".gif": "image/gif",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".ogg": "audio/ogg",
  ".webm": "video/webm",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".txt": "text/plain",
};

const TS_EXTENSIONS = new Set([".ts", ".tsx"]);

type RouteHandler = (req: IncomingMessage, res: ServerResponse, match: RegExpExecArray) => Promise<void> | void;

function baseUrl(req: IncomingMessage, port: number): string {
  const host = req.headers.host || `localhost:${port}`;
  const proto = req.headers["x-forwarded-proto"] || "http";
  return `${proto}://${host}`;
}

export interface ServerOptions {
  cache?: boolean;
}

export function startServer(resolved: ResolvedManifest, port: number, options: ServerOptions = {}): void {
  const cacheControl = options.cache ? "public, max-age=300" : "no-store";
  const { manifest, plugins, staticRoot } = resolved;

  // Dynamic resolution: maps hash IDs to local directories
  const dynMap = new Map<string, { localDir: string; filename: string }>();

  function dynId(specifier: string): string {
    return createHash("sha256").update(specifier).digest("hex").slice(0, 12);
  }

  const routes: [RegExp, RouteHandler][] = [
    [/^\/$/, (req, res) => {
      const base = baseUrl(req, port);
      const rewritten = rewriteManifestUrls(manifest, base);
      res.setHeader("Content-Type", "application/json");
      res.writeHead(200);
      res.end(JSON.stringify(rewritten, null, 2));
    }],
    [/^\/_resolve$/, async (req, res) => {
      const url = new URL(req.url || "/", `http://localhost:${port}`);
      const src = url.searchParams.get("src");
      if (!src) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: "Missing src parameter" }));
        return;
      }

      try {
        const filePath = await resolveRef(src);
        const id = dynId(src);
        const localDir = dirname(filePath);
        const filename = basename(filePath);
        dynMap.set(id, { localDir, filename });

        const base = baseUrl(req, port);
        const resolvedUrl = `${base}/_dyn/${id}/${filename}`;

        res.setHeader("Content-Type", "application/json");
        res.writeHead(200);
        res.end(JSON.stringify({ url: resolvedUrl }));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        res.writeHead(500);
        res.end(JSON.stringify({ error: msg }));
      }
    }],
    [/^\/_dyn\/([a-f0-9]+)\/(.+)$/, async (_req, res, match) => {
      const entry = dynMap.get(match[1]);
      if (!entry) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      const filePath = safePath(entry.localDir, match[2]);
      if (!filePath) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
      }
      await serveFile(filePath, res);
    }],
    [/^\/(\d+)\/(.+)$/, async (_req, res, match) => {
      const idx = parseInt(match[1], 10);
      const plugin = plugins[idx];
      if (!plugin) {
        res.writeHead(404);
        res.end("Plugin not found");
        return;
      }
      const filePath = safePath(plugin.localDir, match[2]);
      if (!filePath) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
      }
      await serveFile(filePath, res);
    }],
    [/^\/(.+)$/, async (_req, res, match) => {
      const filePath = safePath(staticRoot, match[1]);
      if (!filePath) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
      }
      await serveFile(filePath, res);
    }],
  ];

  const server = createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "*");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method !== "GET") {
      res.writeHead(405);
      res.end("Method not allowed");
      return;
    }

    res.setHeader("Cache-Control", cacheControl);

    const url = new URL(req.url || "/", `http://localhost:${port}`);
    const pathname = decodeURIComponent(url.pathname);

    for (const [pattern, handler] of routes) {
      const match = pattern.exec(pathname);
      if (match) {
        await handler(req, res, match);
        return;
      }
    }

    res.writeHead(404);
    res.end("Not found");
  });

  server.listen(port, () => {
    console.log(`mediafuse serving on http://localhost:${port}`);
    for (const plugin of plugins) {
      const name = plugin.entry.name || `plugin-${plugin.index}`;
      console.log(`${name}: ${plugin.entry.src}`);
    }
  });
}

function rewriteManifestUrls(
  manifest: ResolvedManifest["manifest"],
  base: string,
): ResolvedManifest["manifest"] {
  return {
    ...manifest,
    plugins: manifest.plugins.map((p) => ({
      ...p,
      src: `${base}${p.src}`,
    })),
  };
}

function safePath(root: string, requested: string): string | null {
  const resolved = resolve(root, requested);
  const normalizedRoot = resolve(root) + sep;

  if (resolved !== resolve(root) && !resolved.startsWith(normalizedRoot)) {
    return null;
  }

  return resolved;
}

async function serveFile(
  filePath: string,
  res: ServerResponse,
): Promise<void> {
  if (!existsSync(filePath)) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  const ext = extname(filePath);

  if (TS_EXTENSIONS.has(ext)) {
    await serveTranspiled(filePath, ext, res);
    return;
  }

  const contentType = MIME[ext] || "application/octet-stream";
  res.setHeader("Content-Type", contentType);
  res.writeHead(200);

  const stream = createReadStream(filePath);
  stream.pipe(res);
  stream.on("error", () => {
    res.writeHead(500);
    res.end("Read error");
  });
}

async function serveTranspiled(
  filePath: string,
  ext: string,
  res: ServerResponse,
): Promise<void> {
  try {
    const source = readFileSync(filePath, "utf-8");
    const result = await transform(source, {
      loader: ext === ".tsx" ? "tsx" : "ts",
      format: "esm",
      sourcemap: "inline",
      sourcefile: filePath,
    });

    res.setHeader("Content-Type", "application/javascript");
    res.writeHead(200);
    res.end(result.code);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Transform failed";
    console.error(`esbuild transform error: ${filePath}\n${msg}`);
    res.writeHead(500);
    res.end(`// Transform error:\n// ${msg}`);
  }
}
