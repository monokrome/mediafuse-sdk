import { describe, it, expect } from "vitest";
import { parseRemoteRef, parseJsdelivrUrl } from "../src/cli/remote.js";

describe("parseRemoteRef", () => {
  it("parses full GitHub HTTPS URL", () => {
    const ref = parseRemoteRef("https://github.com/monokrome/mediafuse-overlay");
    expect(ref).toEqual({
      host: "github.com",
      owner: "monokrome",
      repo: "mediafuse-overlay",
      url: "https://github.com/monokrome/mediafuse-overlay.git",
    });
  });

  it("strips .git suffix from URL", () => {
    const ref = parseRemoteRef("https://github.com/monokrome/mediafuse-overlay.git");
    expect(ref?.repo).toBe("mediafuse-overlay");
    expect(ref?.url).toBe("https://github.com/monokrome/mediafuse-overlay.git");
  });

  it("parses Codeberg URL", () => {
    const ref = parseRemoteRef("https://codeberg.org/user/repo");
    expect(ref?.host).toBe("codeberg.org");
    expect(ref?.url).toBe("https://codeberg.org/user/repo.git");
  });

  it("parses GitLab URL", () => {
    const ref = parseRemoteRef("https://gitlab.com/user/repo");
    expect(ref?.host).toBe("gitlab.com");
  });

  it("parses unknown host URL", () => {
    const ref = parseRemoteRef("https://git.sr.ht/~user/repo");
    expect(ref?.host).toBe("git.sr.ht");
    expect(ref?.owner).toBe("~user");
    expect(ref?.repo).toBe("repo");
  });

  it("parses github: prefix shorthand", () => {
    const ref = parseRemoteRef("github:monokrome/mediafuse-overlay");
    expect(ref).toEqual({
      host: "github.com",
      owner: "monokrome",
      repo: "mediafuse-overlay",
      url: "https://github.com/monokrome/mediafuse-overlay.git",
    });
  });

  it("parses codeberg: prefix shorthand", () => {
    const ref = parseRemoteRef("codeberg:monokrome/mediafuse-overlay");
    expect(ref?.host).toBe("codeberg.org");
  });

  it("parses gitlab: prefix shorthand", () => {
    const ref = parseRemoteRef("gitlab:user/repo");
    expect(ref?.host).toBe("gitlab.com");
    expect(ref?.url).toBe("https://gitlab.com/user/repo.git");
  });

  it("parses bitbucket: prefix shorthand", () => {
    const ref = parseRemoteRef("bitbucket:user/repo");
    expect(ref?.host).toBe("bitbucket.org");
  });

  it("parses bare owner/repo as GitHub shorthand", () => {
    const ref = parseRemoteRef("monokrome/mediafuse-overlay");
    expect(ref).toEqual({
      host: "github.com",
      owner: "monokrome",
      repo: "mediafuse-overlay",
      url: "https://github.com/monokrome/mediafuse-overlay.git",
    });
  });

  it("returns null for relative path with ./", () => {
    expect(parseRemoteRef("./local/path")).toBeNull();
  });

  it("returns null for relative path with ../", () => {
    expect(parseRemoteRef("../relative")).toBeNull();
  });

  it("returns null for absolute path", () => {
    expect(parseRemoteRef("/absolute/path")).toBeNull();
  });

  it("returns null for Windows absolute path", () => {
    expect(parseRemoteRef("C:\\Users\\test")).toBeNull();
  });

  it("returns null for bare filename", () => {
    expect(parseRemoteRef("manifest.json")).toBeNull();
  });

  it("returns null for bare directory name", () => {
    expect(parseRemoteRef("plugins")).toBeNull();
  });

  it("returns null for path with backslashes", () => {
    expect(parseRemoteRef("some\\windows\\path")).toBeNull();
  });

  it("returns null for jsdelivr deep path (not a 2-segment repo URL)", () => {
    expect(parseRemoteRef("https://cdn.jsdelivr.net/gh/monokrome/mediafuse-plugins@main/plugins/debug/dist/debug.js")).toBeNull();
  });
});

describe("parseJsdelivrUrl", () => {
  it("parses jsdelivr GitHub URL with @main ref", () => {
    const result = parseJsdelivrUrl("https://cdn.jsdelivr.net/gh/monokrome/mediafuse-plugins@main/plugins/debug/dist/debug.js");
    expect(result).toEqual({
      ref: {
        host: "github.com",
        owner: "monokrome",
        repo: "mediafuse-plugins",
        url: "https://github.com/monokrome/mediafuse-plugins.git",
      },
      filePath: "plugins/debug/dist/debug.js",
    });
  });

  it("parses jsdelivr URL with version ref", () => {
    const result = parseJsdelivrUrl("https://cdn.jsdelivr.net/gh/user/repo@v1.2.3/dist/index.js");
    expect(result).toEqual({
      ref: {
        host: "github.com",
        owner: "user",
        repo: "repo",
        url: "https://github.com/user/repo.git",
      },
      filePath: "dist/index.js",
    });
  });

  it("parses jsdelivr URL with single file path", () => {
    const result = parseJsdelivrUrl("https://cdn.jsdelivr.net/gh/owner/repo@latest/file.js");
    expect(result?.filePath).toBe("file.js");
  });

  it("returns null for non-jsdelivr URL", () => {
    expect(parseJsdelivrUrl("https://example.com/some/file.js")).toBeNull();
  });

  it("returns null for jsdelivr npm URL (not /gh/)", () => {
    expect(parseJsdelivrUrl("https://cdn.jsdelivr.net/npm/p5@1/lib/p5.min.js")).toBeNull();
  });

  it("returns null for plain GitHub URL", () => {
    expect(parseJsdelivrUrl("https://github.com/user/repo")).toBeNull();
  });
});
