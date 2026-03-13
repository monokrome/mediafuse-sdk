import type { LoadFn, LoadType } from "./types.js";

const SOURCE_EXTENSIONS = new Set([".js", ".mjs", ".ts", ".tsx"]);
const JSON_EXTENSIONS = new Set([".json"]);
const CSS_EXTENSIONS = new Set([".css"]);

function inferType(url: string): LoadType {
  const pathname = new URL(url).pathname;
  const dot = pathname.lastIndexOf(".");
  if (dot < 0) return "source";

  const ext = pathname.slice(dot);
  if (SOURCE_EXTENSIONS.has(ext)) return "source";
  if (JSON_EXTENSIONS.has(ext)) return "json";
  if (CSS_EXTENSIONS.has(ext)) return "css";
  return "url";
}

export function createLoader(serverBase: string): LoadFn {
  return async (specifier, type) => {
    const res = await fetch(`${serverBase}/_resolve?src=${encodeURIComponent(specifier)}`);
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: "Resolution failed" }));
      throw new Error(body.error || `Failed to resolve: ${specifier}`);
    }

    const { url } = await res.json();
    const resolved = type || inferType(url);

    switch (resolved) {
      case "source":
        return await import(/* @vite-ignore */ url);
      case "json": {
        const jsonRes = await fetch(url);
        return await jsonRes.json();
      }
      case "css": {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = url;
        document.head.appendChild(link);
        return url;
      }
      case "url":
        return url;
    }
  };
}
