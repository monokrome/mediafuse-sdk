import { createServer } from "node:http";
import { readFileSync, createReadStream, existsSync } from "node:fs";
import { join, extname, resolve, sep } from "node:path";
import { transform } from "esbuild";
import type { ResolvedManifest } from "./resolve.js";

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

export function startServer(resolved: ResolvedManifest, port: number): void {
  const { manifest, plugins, staticRoot } = resolved;
  const manifestJson = JSON.stringify(manifest, null, 2);

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

    res.setHeader("Cache-Control", "no-store");

    const url = new URL(req.url || "/", `http://localhost:${port}`);
    const pathname = decodeURIComponent(url.pathname);

    if (pathname === "/manifest.json") {
      res.setHeader("Content-Type", "application/json");
      res.writeHead(200);
      res.end(manifestJson);
      return;
    }

    const pluginMatch = pathname.match(/^\/p\/(\d+)\/(.+)$/);
    if (pluginMatch) {
      const idx = parseInt(pluginMatch[1], 10);
      const plugin = plugins[idx];
      if (!plugin) {
        res.writeHead(404);
        res.end("Plugin not found");
        return;
      }
      const filePath = safePath(plugin.localDir, pluginMatch[2]);
      if (!filePath) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
      }
      await serveFile(filePath, res);
      return;
    }

    if (pathname === "/") {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    const filePath = safePath(staticRoot, pathname.slice(1));
    if (!filePath) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }
    await serveFile(filePath, res);
  });

  server.listen(port, () => {
    console.log(`mediafuse serving on http://localhost:${port}`);
    console.log(`manifest: http://localhost:${port}/manifest.json`);
    for (const plugin of plugins) {
      const name = plugin.entry.name || `plugin-${plugin.index}`;
      console.log(`${name}: ${plugin.entry.src}`);
    }
  });
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
  res: import("node:http").ServerResponse,
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
  res: import("node:http").ServerResponse,
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
