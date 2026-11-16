import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { compilePattern, ignoredBy, isIgnored, parseGitignore } from "~/gitignore";
import { withTempDir } from "./helpers/temp";

function ignores(patterns: string, path: string): boolean {
  return ignoredBy(parseGitignore(patterns), path);
}

async function repository(directory: string, files: Record<string, string>): Promise<void> {
  await mkdir(join(directory, ".git"), { recursive: true });

  for (const [path, content] of Object.entries(files)) {
    const full = join(directory, path);

    await mkdir(join(full, ".."), { recursive: true });
    await writeFile(full, content, "utf8");
  }
}

describe("parseGitignore", () => {
  it("should skip blank lines and comments", () => {
    expect(parseGitignore("\n# a comment\n\nconfig.yml\n")).toHaveLength(1);
  });

  it("should skip a line that is only a slash", () => {
    expect(parseGitignore("/\n")).toHaveLength(0);
  });

  it("should treat an escaped hash as a name rather than a comment", () => {
    expect(ignores("\\#odd", "#odd")).toBe(true);
  });
});

describe("compilePattern", () => {
  it("should give nothing back for a pattern with no body", () => {
    expect(compilePattern("/")).toBeUndefined();
  });

  it("should mark a negation", () => {
    expect(compilePattern("!config.yml")?.negated).toBe(true);
  });

  it("should mark a directory-only pattern", () => {
    expect(compilePattern("dist/")?.directoryOnly).toBe(true);
  });
});

describe("ignoredBy", () => {
  it("should match a plain name at the top", () => {
    expect(ignores("config.yml", "config.yml")).toBe(true);
  });

  it("should match a plain name at any depth", () => {
    expect(ignores("config.yml", "apps/web/config.yml")).toBe(true);
  });

  it("should not match a different name", () => {
    expect(ignores("config.yml", "config.template.yml")).toBe(false);
  });

  it("should anchor a pattern that has a slash in it", () => {
    expect(ignores("/config.yml", "config.yml")).toBe(true);
    expect(ignores("/config.yml", "apps/web/config.yml")).toBe(false);
  });

  it("should match a star that stops at a slash", () => {
    expect(ignores("*.yml", "config.yml")).toBe(true);
    expect(ignores("apps/*.yml", "apps/config.yml")).toBe(true);
    expect(ignores("apps/*.yml", "apps/web/config.yml")).toBe(false);
  });

  it("should match a double star across slashes", () => {
    expect(ignores("apps/**/config.yml", "apps/web/deep/config.yml")).toBe(true);
  });

  it("should let a leading double star match at the top too", () => {
    expect(ignores("**/config.yml", "config.yml")).toBe(true);
    expect(ignores("**/config.yml", "apps/web/config.yml")).toBe(true);
  });

  it("should match a single character wildcard", () => {
    expect(ignores("config.?ml", "config.yml")).toBe(true);
    expect(ignores("config.?ml", "config.yaml")).toBe(false);
  });

  it("should ignore a file inside an ignored directory", () => {
    expect(ignores("secrets/", "secrets/config.yml")).toBe(true);
  });

  it("should not let a directory-only pattern match a file of that name", () => {
    expect(ignores("config.yml/", "config.yml")).toBe(false);
  });

  it("should let a later negation take a file back out", () => {
    expect(ignores("*.yml\n!config.template.yml", "config.template.yml")).toBe(false);
  });

  it("should let a later pattern put a file back in", () => {
    expect(ignores("!config.yml\nconfig.yml", "config.yml")).toBe(true);
  });

  it("should escape a dot rather than treating it as any character", () => {
    expect(ignores("config.yml", "configXyml")).toBe(false);
  });
});

describe("isIgnored", () => {
  it("should say nothing is ignored outside a repository", async () => {
    await withTempDir(async (directory) => {
      const result = await isIgnored(join(directory, "config.yml"));

      expect(result.ignored).toBe(false);
      expect(result.root).toBeUndefined();
    });
  });

  it("should find the repository root", async () => {
    await withTempDir(async (directory) => {
      await repository(directory, { ".gitignore": "config.yml\n" });

      expect((await isIgnored(join(directory, "config.yml"))).root).toBeDefined();
    });
  });

  it("should see a file the root gitignore covers", async () => {
    await withTempDir(async (directory) => {
      await repository(directory, { ".gitignore": "config.yml\n" });

      expect((await isIgnored(join(directory, "config.yml"))).ignored).toBe(true);
    });
  });

  it("should see a file the root gitignore does not cover", async () => {
    await withTempDir(async (directory) => {
      await repository(directory, { ".gitignore": "node_modules\n" });

      expect((await isIgnored(join(directory, "config.yml"))).ignored).toBe(false);
    });
  });

  it("should see a file covered from a nested gitignore", async () => {
    await withTempDir(async (directory) => {
      await repository(directory, {
        ".gitignore": "node_modules\n",
        "apps/web/.gitignore": "config.yml\n",
      });

      expect((await isIgnored(join(directory, "apps", "web", "config.yml"))).ignored).toBe(true);
    });
  });

  it("should let a nested gitignore take a file back out", async () => {
    await withTempDir(async (directory) => {
      await repository(directory, {
        ".gitignore": "config.yml\n",
        "apps/web/.gitignore": "!config.yml\n",
      });

      expect((await isIgnored(join(directory, "apps", "web", "config.yml"))).ignored).toBe(false);
    });
  });

  it("should read the repository's own exclude file", async () => {
    await withTempDir(async (directory) => {
      await repository(directory, { ".git/info/exclude": "config.yml\n" });

      expect((await isIgnored(join(directory, "config.yml"))).ignored).toBe(true);
    });
  });

  it("should treat a missing gitignore as covering nothing", async () => {
    await withTempDir(async (directory) => {
      await repository(directory, {});

      expect((await isIgnored(join(directory, "config.yml"))).ignored).toBe(false);
    });
  });

  it("should take a relative path", async () => {
    expect((await isIgnored("config.yml")).ignored).toBe(true);
  });
});
