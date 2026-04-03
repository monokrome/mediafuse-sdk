import { execFile as execFileCb } from "node:child_process";
import { mkdirSync, existsSync, statSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, basename } from "node:path";
import { promisify } from "node:util";

const execFile = promisify(execFileCb);

let cacheDir = tmpdir();

export function setCacheDir(dir: string): void {
  cacheDir = dir;
}

const HOSTS: Record<string, string> = {
  "github.com": "https://github.com",
  "codeberg.org": "https://codeberg.org",
  "gitlab.com": "https://gitlab.com",
  "bitbucket.org": "https://bitbucket.org",
};

const PREFIXES: Record<string, string> = {
  github: "github.com",
  codeberg: "codeberg.org",
  gitlab: "gitlab.com",
  bitbucket: "bitbucket.org",
};

export interface RemoteRef {
  host: string;
  owner: string;
  repo: string;
  url: string;
}

export interface RemoteFileRef {
  ref: RemoteRef;
  filePath: string;
}

export function parseJsdelivrUrl(url: string): RemoteFileRef | null {
  const match = url.match(/^https?:\/\/cdn\.jsdelivr\.net\/gh\/([^/]+)\/([^@]+)@[^/]*\/(.+)$/);
  if (!match) return null;
  const [, owner, repo, filePath] = match;
  const ref: RemoteRef = {
    host: "github.com",
    owner,
    repo,
    url: `https://github.com/${owner}/${repo}.git`,
  };
  return { ref, filePath };
}

export function parseRemoteRef(input: string): RemoteRef | null {
  if (input.startsWith("https://")) {
    return parseUrl(input);
  }

  const colonIdx = input.indexOf(":");
  if (colonIdx > 0 && !input.includes("/", 0) || colonIdx > 0 && colonIdx < input.indexOf("/")) {
    const prefix = input.slice(0, colonIdx);
    const host = PREFIXES[prefix];
    if (host) {
      return parseOwnerRepo(host, input.slice(colonIdx + 1));
    }
  }

  if (isLocalPath(input)) return null;

  if (isBareShorthand(input)) {
    return parseOwnerRepo("github.com", input);
  }

  return null;
}

function parseUrl(url: string): RemoteRef | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const segments = parsed.pathname.replace(/^\//, "").replace(/\.git$/, "").split("/");
  if (segments.length < 2) return null;

  const host = parsed.hostname;
  const base = HOSTS[host] ?? `https://${host}`;

  // Only treat as a git repo if the path looks like owner/repo (2 segments)
  // not a deep file path like /gh/user/repo@v/plugins/file.js
  if (segments.length !== 2) return null;

  const [owner, repo] = segments;
  return { host, owner, repo, url: `${base}/${owner}/${repo}.git` };
}

function parseOwnerRepo(host: string, ref: string): RemoteRef | null {
  const cleaned = ref.replace(/\.git$/, "");
  const parts = cleaned.split("/");
  if (parts.length < 2) return null;

  const [owner, repo] = parts;
  if (!owner || !repo) return null;

  const base = HOSTS[host] ?? `https://${host}`;
  return { host, owner, repo, url: `${base}/${owner}/${repo}.git` };
}

function isLocalPath(input: string): boolean {
  if (input.startsWith("./") || input.startsWith("../") || input.startsWith("/")) return true;
  if (/^[a-zA-Z]:[/\\]/.test(input)) return true;
  if (input.includes("\\")) return true;
  if (!input.includes("/")) return true;
  return false;
}

function isBareShorthand(input: string): boolean {
  const slashes = input.split("/").length - 1;
  if (slashes !== 1) return false;
  if (input.includes("..") || input.includes(".")) return false;
  return true;
}

const REFRESH_INTERVAL = 30_000;
const lastChecked = new Map<string, number>();

function repoDir(ref: RemoteRef): string {
  return join(cacheDir, "repos", ref.host, ref.owner, ref.repo);
}

export async function materializeRemote(ref: RemoteRef): Promise<string> {
  const dir = repoDir(ref);
  const now = Date.now();
  const last = lastChecked.get(ref.url);

  if (last && now - last < REFRESH_INTERVAL) {
    return dir;
  }

  const gitEnv = { ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_ASKPASS: "" };

  if (existsSync(join(dir, ".git"))) {
    try {
      await execFile("git", ["rev-parse", "--git-dir"], { cwd: dir, env: gitEnv, timeout: 5_000 });
    } catch {
      try { rmSync(dir, { recursive: true, force: true }); } catch { /* locked — fall through to clone error */ }
    }
  }

  if (existsSync(join(dir, ".git"))) {
    lastChecked.set(ref.url, now);
    try {
      await execFile("git", ["pull", "--ff-only"], {
        cwd: dir,
        env: gitEnv,
        timeout: 30_000,
      });
    } catch {
      try {
        await execFile("git", ["fetch", "origin"], { cwd: dir, env: gitEnv, timeout: 30_000 });
        await execFile("git", ["reset", "--hard", "origin/HEAD"], { cwd: dir, env: gitEnv, timeout: 10_000 });
      } catch {
        // offline — use what we have
      }
    }
    return dir;
  }

  mkdirSync(join(dir, ".."), { recursive: true });
  if (existsSync(dir)) {
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* locked — clone will fail with clear error */ }
  }

  try {
    await execFile("git", ["clone", "--depth", "1", ref.url, dir], {
      env: gitEnv,
      timeout: 30_000,
    });
  } catch (err) {
    const msg = err instanceof Error ? (err as Error & { stderr?: string }).stderr || err.message : String(err);
    throw new Error(`Failed to clone ${ref.url}: ${msg}`);
  }

  lastChecked.set(ref.url, now);
  return dir;
}

export type EntryFinder = (dir: string) => string | null;

/**
 * Resolve any input reference to a local file path.
 *
 * Handles: remote refs (owner/repo, github:owner/repo, full git URLs),
 * plain URLs (CDN links), and local paths.
 *
 * When findEntry is provided and the result is a directory,
 * it's called to locate the relevant file within it.
 */
export async function resolveRef(
  input: string,
  findEntry?: EntryFinder,
): Promise<string> {
  const ref = parseRemoteRef(input);
  if (ref) {
    const dir = await materializeRemote(ref);
    return findEntry ? requireEntry(findEntry, dir, ref.url) : dir;
  }

  const cdnRef = parseJsdelivrUrl(input);
  if (cdnRef) {
    const dir = await materializeRemote(cdnRef.ref);
    return join(dir, cdnRef.filePath);
  }

  if (input.startsWith("https://") || input.startsWith("http://")) {
    return fetchRemoteFile(input);
  }

  if (findEntry && existsSync(input) && statSync(input).isDirectory()) {
    return requireEntry(findEntry, input, input);
  }

  return input;
}

function requireEntry(findEntry: EntryFinder, dir: string, source: string): string {
  const entry = findEntry(dir);
  if (!entry) throw new Error(`No entry found in ${source}`);
  return entry;
}

// Back-compat aliases — these are thin wrappers around resolveRef
export async function resolveSource(input: string): Promise<string> {
  return resolveRef(input);
}

export function findManifestInDir(dir: string): string | null {
  const manifestJson = join(dir, "manifest.json");
  if (existsSync(manifestJson)) return manifestJson;
  return null;
}

function fetchDir(url: string): string {
  const parsed = new URL(url);
  const pathPart = parsed.pathname.replace(/^\//, "").replace(/\//g, "_");
  return join(cacheDir, "fetch", parsed.hostname, pathPart);
}

export async function fetchRemoteFile(url: string): Promise<string> {
  const dir = fetchDir(url);
  const filename = basename(new URL(url).pathname) || "index.js";
  const filePath = join(dir, filename);

  const now = Date.now();
  const last = lastChecked.get(url);

  if (last && now - last < REFRESH_INTERVAL && existsSync(filePath)) {
    return filePath;
  }

  mkdirSync(dir, { recursive: true });

  const response = await fetch(url);
  if (!response.ok) {
    if (existsSync(filePath)) {
      lastChecked.set(url, now);
      return filePath;
    }
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  writeFileSync(filePath, await response.text());
  lastChecked.set(url, now);
  return filePath;
}
