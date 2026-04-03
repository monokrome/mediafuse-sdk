import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { existsSync, rmSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";
import {
  parseRemoteRef,
  materializeRemote,
  resolveRef,
} from "../src/cli/remote.js";
import { findManifestEntry } from "../src/cli/resolve.js";

const execFile = promisify(execFileCb);

const clonedDirs: string[] = [];
const SDK_ROOT = join(__dirname, "..");

beforeAll(async () => {
  await execFile("pnpm", ["run", "build"], { cwd: SDK_ROOT });
}, 30_000);

afterAll(() => {
  for (const dir of clonedDirs) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  }
});

function track(dir: string): string {
  clonedDirs.push(dir);
  return dir;
}

// ---------------------------------------------------------------------------
// materializeRemote — actually clones from GitHub
// ---------------------------------------------------------------------------

describe("materializeRemote", () => {
  it("clones a public GitHub repo to a temp directory", async () => {
    const ref = parseRemoteRef("monokrome/mediafuse-overlay")!;
    expect(ref).not.toBeNull();

    const dir = track(await materializeRemote(ref));

    expect(existsSync(dir)).toBe(true);
    expect(existsSync(join(dir, ".git"))).toBe(true);
    expect(existsSync(join(dir, "manifest.json"))).toBe(true);
  }, 30_000);

  it("reuses cached clone for the same repo", async () => {
    const ref = parseRemoteRef("monokrome/mediafuse-overlay")!;
    const first = await materializeRemote(ref);
    const second = await materializeRemote(ref);
    expect(first).toBe(second);
  }, 5_000);

  it("throws on nonexistent repo", async () => {
    const ref = parseRemoteRef("monokrome/this-repo-does-not-exist-12345")!;
    await expect(materializeRemote(ref)).rejects.toThrow("Failed to clone");
  }, 60_000);
});

// ---------------------------------------------------------------------------
// resolveRef
// ---------------------------------------------------------------------------

describe("resolveRef", () => {
  it("returns local paths unchanged", async () => {
    const result = await resolveRef("./local/path");
    expect(result).toBe("./local/path");
  });

  it("clones remote refs and returns local path", async () => {
    const dir = await resolveRef("monokrome/mediafuse-overlay");
    track(dir);
    expect(existsSync(dir)).toBe(true);
    expect(existsSync(join(dir, "manifest.json"))).toBe(true);
  }, 30_000);
});

// ---------------------------------------------------------------------------
// findManifestInDir
// ---------------------------------------------------------------------------

describe("findManifestEntry", () => {
  it("finds manifest.json in a cloned repo", async () => {
    const dir = await resolveRef("monokrome/mediafuse-overlay");
    track(dir);
    const manifest = findManifestEntry(dir);
    expect(manifest).toBe(join(dir, "manifest.json"));
  }, 30_000);

  it("returns null for directory without manifest", async () => {
    const dir = await resolveRef("monokrome/mediafuse-sdk");
    track(dir);
    const manifest = findManifestEntry(dir);
    expect(manifest).toBeNull();
  }, 30_000);
});

// ---------------------------------------------------------------------------
// CLI end-to-end (starts server, checks manifest endpoint, shuts down)
// ---------------------------------------------------------------------------

describe("CLI end-to-end", () => {
  it("serves a manifest from a remote GitHub repo", async () => {
    const cliPath = join(SDK_ROOT, "dist", "cli", "index.js");

    const port = 18234 + Math.floor(Math.random() * 1000);
    const { spawn } = await import("node:child_process");
    const cliDataDir = mkdtempSync(join(tmpdir(), "mediafuse-cli-test-"));
    clonedDirs.push(cliDataDir);

    const child = spawn(
      "node",
      [cliPath, "--port", String(port), "--data", cliDataDir, "monokrome/mediafuse-overlay"],
      { stdio: ["ignore", "pipe", "pipe"] },
    );

    try {
      // Wait for server to start by watching stdout
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Server startup timeout")), 30_000);
        let output = "";

        child.stdout.on("data", (chunk: Buffer) => {
          output += chunk.toString();
          if (output.includes("mediafuse serving on")) {
            clearTimeout(timeout);
            resolve();
          }
        });

        child.stderr.on("data", (chunk: Buffer) => {
          output += chunk.toString();
        });

        child.on("exit", (code: number) => {
          clearTimeout(timeout);
          if (code !== 0) reject(new Error(`CLI exited with code ${code}: ${output}`));
        });
      });

      // Fetch the manifest
      const res = await fetch(`http://localhost:${port}/`);
      expect(res.ok).toBe(true);

      const manifest = await res.json();
      expect(manifest.v).toBe(1);
      expect(manifest.plugins).toBeDefined();
      expect(Array.isArray(manifest.plugins)).toBe(true);

      // All plugin URLs should be rewritten to localhost
      for (const plugin of manifest.plugins) {
        const src = typeof plugin === "string" ? plugin : plugin.src;
        expect(src).toContain(`http://localhost:${port}`);
      }
    } finally {
      child.kill();
    }
  }, 60_000);
});
