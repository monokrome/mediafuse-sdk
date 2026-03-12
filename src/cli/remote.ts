import { execFile as execFileCb } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFile = promisify(execFileCb);

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

  const [owner, repo] = segments;
  const host = parsed.hostname;
  const base = HOSTS[host] ?? `https://${host}`;

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

const cloneCache = new Map<string, string>();

export async function materializeRemote(ref: RemoteRef): Promise<string> {
  const cached = cloneCache.get(ref.url);
  if (cached) return cached;

  const tmpDir = await mkdtemp(join(tmpdir(), "mediafuse-"));

  try {
    await execFile("git", ["clone", "--depth", "1", ref.url, tmpDir]);
  } catch (err) {
    const msg = err instanceof Error ? (err as Error & { stderr?: string }).stderr || err.message : String(err);
    throw new Error(`Failed to clone ${ref.url}: ${msg}`);
  }

  cloneCache.set(ref.url, tmpDir);
  return tmpDir;
}

export async function resolveSource(input: string): Promise<string> {
  const ref = parseRemoteRef(input);
  if (!ref) return input;
  return materializeRemote(ref);
}

export function findManifestInDir(dir: string): string | null {
  const manifestJson = join(dir, "manifest.json");
  if (existsSync(manifestJson)) return manifestJson;
  return null;
}
