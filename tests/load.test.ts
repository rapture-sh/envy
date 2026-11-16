import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { defineConfig } from "~/define";
import { load } from "~/load";
import { resetWarnings } from "~/ui/warn";
import { setStdin, typing } from "./helpers/input";
import { capture, setEnv, setInteractive } from "./helpers/output";
import { withTempDir } from "./helpers/temp";

const undo: Array<() => void> = [];

afterEach(() => {
  while (undo.length > 0) undo.pop()?.();

  resetWarnings();
});

/**
 * No terminal, every time. These tests prove the path a pipeline takes, which is the one
 * that must never hang, and the prompts have their own tests that do not run the loop.
 */
function plain(): void {
  undo.push(setEnv("NO_COLOR", "1"));
  undo.push(setEnv("ENVY_NO_WARN", undefined));
  undo.push(setInteractive(false));
}

const schema = defineConfig({
  stripe: {
    title: "Stripe",
    values: {
      secretKey: { required: true, secret: true, example: "sk_test_" },
      webhookSecret: { example: "whsec_" },
    },
  },
  session: {
    values: {
      sealKey: { generate: { bytes: 16 } },
    },
  },
  client: {
    values: {
      redirectUri: { default: "http://localhost:3000/callback" },
    },
  },
});

async function inRepo<T>(work: (directory: string) => Promise<T>): Promise<T> {
  return withTempDir(async (directory) => {
    await mkdir(join(directory, ".git"), { recursive: true });
    await writeFile(join(directory, ".gitignore"), "config.yml\n", "utf8");

    return work(directory);
  });
}

describe("load", () => {
  it("should write a config file where there was none", async () => {
    await inRepo(async (cwd) => {
      await capture(() => load(schema, { cwd }));

      expect(await readFile(join(cwd, "config.yml"), "utf8")).toContain("stripe:");
    });
  });

  it("should write the template beside it", async () => {
    await inRepo(async (cwd) => {
      await capture(() => load(schema, { cwd }));

      expect(await readFile(join(cwd, "config.template.yml"), "utf8")).toContain("sk_test_");
    });
  });

  it("should leave the template alone when told to", async () => {
    await inRepo(async (cwd) => {
      await capture(() => load(schema, { cwd, template: false }));

      await expect(readFile(join(cwd, "config.template.yml"), "utf8")).rejects.toThrow();
    });
  });

  it("should read a value that is already answered", async () => {
    await inRepo(async (cwd) => {
      await writeFile(join(cwd, "config.yml"), "stripe:\n  secret-key: sk_test_abc\n", "utf8");

      const cfg = await capture(() => load(schema, { cwd })).then(() =>
        load(schema, { cwd, warn: false }),
      );

      expect(cfg.get("stripe.secretKey")).toBe("sk_test_abc");
    });
  });

  it("should generate a declared value", async () => {
    await inRepo(async (cwd) => {
      let seal = "";

      await capture(async () => {
        seal = (await load(schema, { cwd })).get("session.sealKey");
      });

      expect(seal).toMatch(/^[\w-]{20,}$/u);
    });
  });

  it("should keep a generated value rather than rotating it on the next run", async () => {
    await inRepo(async (cwd) => {
      let first = "";
      let second = "";

      await capture(async () => {
        first = (await load(schema, { cwd })).get("session.sealKey");
        second = (await load(schema, { cwd })).get("session.sealKey");
      });

      expect(second).toBe(first);
    });
  });

  it("should produce the same file on a second run", async () => {
    await inRepo(async (cwd) => {
      await capture(() => load(schema, { cwd }));

      const first = await readFile(join(cwd, "config.yml"), "utf8");

      await capture(() => load(schema, { cwd }));

      expect(await readFile(join(cwd, "config.yml"), "utf8")).toBe(first);
    });
  });

  it("should apply a default for a value nobody answered", async () => {
    await inRepo(async (cwd) => {
      let uri = "";

      await capture(async () => {
        uri = (await load(schema, { cwd })).get("client.redirectUri");
      });

      expect(uri).toBe("http://localhost:3000/callback");
    });
  });

  it("should not overwrite an answer with the default", async () => {
    await inRepo(async (cwd) => {
      await writeFile(join(cwd, "config.yml"), "client:\n  redirect-uri: http://mine\n", "utf8");

      let uri = "";

      await capture(async () => {
        uri = (await load(schema, { cwd })).get("client.redirectUri");
      });

      expect(uri).toBe("http://mine");
    });
  });

  it("should report what is unanswered rather than hanging without a terminal", async () => {
    plain();

    await inRepo(async (cwd) => {
      const printed = await capture(() => load(schema, { cwd }));

      expect(printed).toContain("no terminal to ask in");
      expect(printed).toContain("stripe.secretKey");
    });
  });

  it("should warn about a required value with nothing in it", async () => {
    plain();

    await inRepo(async (cwd) => {
      const printed = await capture(() => load(schema, { cwd }));

      expect(printed).toContain("required value");
    });
  });

  it("should treat a value still holding the example as unanswered", async () => {
    plain();

    await inRepo(async (cwd) => {
      await writeFile(join(cwd, "config.yml"), "stripe:\n  secret-key: sk_test_\n", "utf8");

      const printed = await capture(() => load(schema, { cwd }));

      expect(printed).toContain("stripe.secretKey");
    });
  });

  it("should say so when there is nothing left to ask", async () => {
    plain();

    await inRepo(async (cwd) => {
      await writeFile(
        join(cwd, "config.yml"),
        "stripe:\n  secret-key: sk_test_abc\n  webhook-secret: whsec_abc\n",
        "utf8",
      );

      const printed = await capture(() => load(schema, { cwd }));

      expect(printed).toContain("every value is already answered");
    });
  });

  it("should ask nothing and say nothing when asking is off", async () => {
    plain();

    await inRepo(async (cwd) => {
      const printed = await capture(() => load(schema, { cwd, ask: "never", warn: false }));

      expect(printed).not.toContain("every value is already answered");
      expect(printed).not.toContain("no terminal");
    });
  });

  it("should warn when the config file is not gitignored", async () => {
    plain();

    await withTempDir(async (cwd) => {
      await mkdir(join(cwd, ".git"), { recursive: true });
      await writeFile(join(cwd, ".gitignore"), "node_modules\n", "utf8");

      const printed = await capture(() => load(schema, { cwd }));

      expect(printed).toContain("git is not ignoring it");
      expect(printed).toContain("Add this line to .gitignore");
    });
  });

  it("should say nothing about gitignore when the file is covered", async () => {
    plain();

    await inRepo(async (cwd) => {
      const printed = await capture(() => load(schema, { cwd }));

      expect(printed).not.toContain("git is not ignoring it");
    });
  });

  it("should say nothing about gitignore outside a repository", async () => {
    plain();

    await withTempDir(async (cwd) => {
      const printed = await capture(() => load(schema, { cwd }));

      expect(printed).not.toContain("git is not ignoring it");
    });
  });

  it("should let the call silence every warning", async () => {
    plain();

    await withTempDir(async (cwd) => {
      await mkdir(join(cwd, ".git"), { recursive: true });

      const printed = await capture(() => load(schema, { cwd, warn: false }));

      expect(printed).not.toContain("git is not ignoring it");
      expect(printed).not.toContain("required value");
    });
  });

  it("should never print a value it read", async () => {
    plain();

    await inRepo(async (cwd) => {
      await writeFile(
        join(cwd, "config.yml"),
        "stripe:\n  secret-key: sk_test_do_not_print_me\n",
        "utf8",
      );

      const printed = await capture(() => load(schema, { cwd }));

      expect(printed).not.toContain("sk_test_do_not_print_me");
    });
  });

  it("should never print a value it generated", async () => {
    plain();

    await inRepo(async (cwd) => {
      let seal = "";

      const printed = await capture(async () => {
        seal = (await load(schema, { cwd })).get("session.sealKey");
      });

      expect(printed).not.toContain(seal);
    });
  });
});

describe("load, with a terminal to ask in", () => {
  function withKeyboard(...lines: string[]): void {
    undo.push(setEnv("NO_COLOR", "1"));
    undo.push(setEnv("ENVY_NO_WARN", undefined));
    undo.push(setInteractive(true));
    undo.push(setStdin(typing(...lines)));
  }

  it("should keep what was answered", async () => {
    withKeyboard("sk_test_typed", "whsec_typed");

    await inRepo(async (cwd) => {
      let value = "";

      await capture(async () => {
        value = (await load(schema, { cwd })).get("stripe.secretKey");
      });

      expect(value).toBe("sk_test_typed");
    });
  });

  it("should write what was answered into the config file", async () => {
    withKeyboard("sk_test_typed", "whsec_typed");

    await inRepo(async (cwd) => {
      await capture(() => load(schema, { cwd }));

      expect(await readFile(join(cwd, "config.yml"), "utf8")).toContain("sk_test_typed");
    });
  });

  it("should ask nothing on the second run", async () => {
    withKeyboard("sk_test_typed", "whsec_typed");

    await inRepo(async (cwd) => {
      await capture(() => load(schema, { cwd }));

      const printed = await capture(() => load(schema, { cwd }));

      expect(printed).toContain("every value is already answered");
    });
  });

  it("should ask again for everything when told to", async () => {
    await inRepo(async (cwd) => {
      let value = "";

      // A keyboard each, because each run is its own prompt loop reading its own stream.
      withKeyboard("sk_test_first", "whsec_first");

      await capture(() => load(schema, { cwd }));

      withKeyboard("sk_test_second", "whsec_second", "");

      await capture(async () => {
        value = (await load(schema, { cwd, ask: "all" })).get("stripe.secretKey");
      });

      expect(value).toBe("sk_test_second");
    });
  });

  it("should never print what was answered", async () => {
    withKeyboard("sk_test_do_not_print_me", "whsec_typed");

    await inRepo(async (cwd) => {
      const printed = await capture(() => load(schema, { cwd }));

      expect(printed).not.toContain("sk_test_do_not_print_me");
    });
  });
});
