import { readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resetWarnings } from "~/ui/warn";
import { GENERATED, write } from "~/write";
import { capture, setEnv } from "./helpers/output";
import { withTempDir } from "./helpers/temp";

const undo: Array<() => void> = [];

afterEach(() => {
  while (undo.length > 0) undo.pop()?.();

  resetWarnings();
});

function plain(): void {
  undo.push(setEnv("NO_COLOR", "1"));
  undo.push(setEnv("ENVY_NO_WARN", undefined));
}

const generated = `# ${GENERATED}.\nA=1\n`;

describe("write", () => {
  it("should write the content", async () => {
    await withTempDir(async (cwd) => {
      await write(join(cwd, ".env"), "A=1\n");

      expect(await readFile(join(cwd, ".env"), "utf8")).toBe("A=1\n");
    });
  });

  it("should say it changed the file", async () => {
    await withTempDir(async (cwd) => {
      expect((await write(join(cwd, ".env"), "A=1\n")).changed).toBe(true);
    });
  });

  it("should leave a file that already holds exactly this alone", async () => {
    await withTempDir(async (cwd) => {
      const path = join(cwd, ".env");

      await write(path, "A=1\n");

      const before = (await stat(path)).mtimeMs;

      await new Promise((wake) => setTimeout(wake, 20));

      expect((await write(path, "A=1\n")).changed).toBe(false);
      expect((await stat(path)).mtimeMs).toBe(before);
    });
  });

  it("should rewrite a file whose content changed", async () => {
    await withTempDir(async (cwd) => {
      const path = join(cwd, ".env");

      await write(path, "A=1\n");

      expect((await write(path, "A=2\n")).changed).toBe(true);
      expect(await readFile(path, "utf8")).toBe("A=2\n");
    });
  });

  it("should create the directory when it is not there", async () => {
    await withTempDir(async (cwd) => {
      await write(join(cwd, "deep", "nested", ".env"), "A=1\n");

      expect(await readFile(join(cwd, "deep", "nested", ".env"), "utf8")).toBe("A=1\n");
    });
  });

  it("should resolve a relative path against cwd", async () => {
    await withTempDir(async (cwd) => {
      await write(".env", "A=1\n", { cwd });

      expect(await readFile(join(cwd, ".env"), "utf8")).toBe("A=1\n");
    });
  });

  it("should give the absolute path back", async () => {
    await withTempDir(async (cwd) => {
      expect((await write(".env", "A=1\n", { cwd })).path).toBe(join(cwd, ".env"));
    });
  });

  it("should warn before replacing a file envy did not write", async () => {
    plain();

    await withTempDir(async (cwd) => {
      const path = join(cwd, ".env");

      await writeFile(path, "MINE=1\n", "utf8");

      const printed = await capture(() => write(path, generated, { cwd }));

      expect(printed).toContain("was not written by envy");
    });
  });

  it("should still replace it", async () => {
    plain();

    await withTempDir(async (cwd) => {
      const path = join(cwd, ".env");

      await writeFile(path, "MINE=1\n", "utf8");
      await capture(() => write(path, generated, { cwd }));

      expect(await readFile(path, "utf8")).toBe(generated);
    });
  });

  it("should not warn the second time, once the file says it is generated", async () => {
    plain();

    await withTempDir(async (cwd) => {
      const path = join(cwd, ".env");

      await writeFile(path, "MINE=1\n", "utf8");
      await capture(() => write(path, generated, { cwd }));
      resetWarnings();

      const printed = await capture(() => write(path, `${generated}B=2\n`, { cwd }));

      expect(printed).not.toContain("was not written by envy");
    });
  });

  it("should not warn when there was no file there", async () => {
    plain();

    await withTempDir(async (cwd) => {
      const printed = await capture(() => write(join(cwd, ".env"), generated, { cwd }));

      expect(printed).toBe("");
    });
  });

  it("should not warn about content that does not claim to be generated", async () => {
    plain();

    await withTempDir(async (cwd) => {
      const path = join(cwd, "notes.txt");

      await writeFile(path, "mine\n", "utf8");

      const printed = await capture(() => write(path, "theirs\n", { cwd }));

      expect(printed).toBe("");
    });
  });

  it("should let the call silence the warning", async () => {
    plain();

    await withTempDir(async (cwd) => {
      const path = join(cwd, ".env");

      await writeFile(path, "MINE=1\n", "utf8");

      const printed = await capture(() => write(path, generated, { cwd, warn: false }));

      expect(printed).toBe("");
    });
  });

  it("should fail with the path when it cannot write", async () => {
    await withTempDir(async (cwd) => {
      // A directory where the file should be, so the write cannot succeed.
      await write(join(cwd, "blocked", "inside.txt"), "x\n");

      await expect(write(join(cwd, "blocked"), "x\n")).rejects.toThrow(/blocked/u);
    });
  });
});
