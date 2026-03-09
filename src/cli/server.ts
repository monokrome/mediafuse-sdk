import { createServer } from "node:http";
import { createReadStream, existsSync } from "node:fs";
import { join, extname, resolve, sep } from "node:path";
import type { ResolvedManifest } from "./resolve.js";

const MIME: Record<string, string> = {
  ".js": "application/javascript",
  ".mjs": "application/javascript",
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

export function startServer(resolved: ResolvedManifest, port: number): void {
  const { manifest, plugins, staticRoot } = resolved;
  const manifestJson = JSON.stringify(manifest, null, 2);

  const server = createServer((req, res) => {
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
      serveFile(filePath, res);
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
    serveFile(filePath, res);
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

function serveFile(
  filePath: string,
  res: import("node:http").ServerResponse,
): void {
  if (!existsSync(filePath)) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  const ext = extname(filePath);
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
