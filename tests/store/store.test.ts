import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { defineConfig } from "~/define";
import { readConfig, writeConfig, writeTemplate } from "~/store";
import { withTempDir } from "../helpers/temp";

const schema = defineConfig({
  stripe: {
    title: "Stripe",
    note: "Test mode only.",
    values: {
      secretKey: {
        describe: "Server side key.",
        where: "dashboard.stripe.com/test/apikeys",
        example: "sk_test_",
        required: true,
      },
      webhookSecret: { example: "whsec_", without: "webhooks stay off" },
    },
  },
  session: {
    values: {
      sealKey: { generate: { bytes: 32 } },
    },
  },
});

describe("readConfig", () => {
  it("should give nothing back when the file is not there", async () => {
    await withTempDir(async (directory) => {
      expect(await readConfig(join(directory, "config.yml"))).toEqual({});
    });
  });

  it("should read a section into its values", async () => {
    await withTempDir(async (directory) => {
      const path = join(directory, "config.yml");

      await writeFile(path, "stripe:\n  secret-key: sk_test_abc\n", "utf8");

      expect(await readConfig(path)).toEqual({ stripe: { "secret-key": "sk_test_abc" } });
    });
  });

  it("should read a value with nothing after the colon as empty", async () => {
    await withTempDir(async (directory) => {
      const path = join(directory, "config.yml");

      await writeFile(path, "stripe:\n  secret-key:\n", "utf8");

      expect(await readConfig(path)).toEqual({ stripe: { "secret-key": "" } });
    });
  });

  it("should read a number or a boolean as text", async () => {
    await withTempDir(async (directory) => {
      const path = join(directory, "config.yml");

      await writeFile(path, "ports:\n  web: 3000\n  tls: true\n", "utf8");

      expect(await readConfig(path)).toEqual({ ports: { web: "3000", tls: "true" } });
    });
  });

  it("should ignore a section that is not a map of scalars", async () => {
    await withTempDir(async (directory) => {
      const path = join(directory, "config.yml");

      await writeFile(path, "hosts:\n  - one\n  - two\nstripe:\n  secret-key: a\n", "utf8");

      expect(await readConfig(path)).toEqual({ stripe: { "secret-key": "a" } });
    });
  });

  it("should ignore a nested value rather than refusing the whole file", async () => {
    await withTempDir(async (directory) => {
      const path = join(directory, "config.yml");

      await writeFile(path, "stripe:\n  secret-key: a\n  nested:\n    deep: b\n", "utf8");

      expect(await readConfig(path)).toEqual({ stripe: { "secret-key": "a" } });
    });
  });

  it("should fail with the path when the file is not valid YAML", async () => {
    await withTempDir(async (directory) => {
      const path = join(directory, "config.yml");

      await writeFile(path, "stripe:\n  - a\n  b: c\n", "utf8");

      await expect(readConfig(path)).rejects.toThrow(/config\.yml/u);
    });
  });

  it("should give nothing back for a file holding only a comment", async () => {
    await withTempDir(async (directory) => {
      const path = join(directory, "config.yml");

      await writeFile(path, "# nothing here yet\n", "utf8");

      expect(await readConfig(path)).toEqual({});
    });
  });
});

describe("writeConfig", () => {
  it("should write what it was given and read it back the same", async () => {
    await withTempDir(async (directory) => {
      const path = join(directory, "config.yml");
      const values = { stripe: { "secret-key": "sk_test_abc", "webhook-secret": "" }, session: {} };

      await writeConfig(path, schema, values);

      expect((await readConfig(path)).stripe?.["secret-key"]).toBe("sk_test_abc");
    });
  });

  it("should produce the same bytes when it writes the same values again", async () => {
    await withTempDir(async (directory) => {
      const path = join(directory, "config.yml");
      const values = { stripe: { "secret-key": "a" } };

      await writeConfig(path, schema, values);

      const first = await readFile(path, "utf8");

      await writeConfig(path, schema, values);

      expect(await readFile(path, "utf8")).toBe(first);
    });
  });

  it("should keep a value the schema does not know about", async () => {
    await withTempDir(async (directory) => {
      const path = join(directory, "config.yml");

      await writeConfig(path, schema, { stripe: { "secret-key": "a", "extra-key": "kept" } });

      expect((await readConfig(path)).stripe?.["extra-key"]).toBe("kept");
    });
  });

  it("should keep a section the schema does not know about", async () => {
    await withTempDir(async (directory) => {
      const path = join(directory, "config.yml");

      await writeConfig(path, schema, { mine: { note: "kept" } });

      expect((await readConfig(path)).mine?.note).toBe("kept");
    });
  });

  it("should write a generated value, since it is kept rather than asked for", async () => {
    await withTempDir(async (directory) => {
      const path = join(directory, "config.yml");

      await writeConfig(path, schema, { session: { "seal-key": "abc" } });

      expect((await readConfig(path)).session?.["seal-key"]).toBe("abc");
    });
  });

  it("should create the directory when it is not there", async () => {
    await withTempDir(async (directory) => {
      const path = join(directory, "nested", "deeper", "config.yml");

      await writeConfig(path, schema, { stripe: { "secret-key": "a" } });

      expect((await readConfig(path)).stripe?.["secret-key"]).toBe("a");
    });
  });
});

describe("writeTemplate", () => {
  it("should write the example rather than any answer", async () => {
    await withTempDir(async (directory) => {
      const path = join(directory, "config.template.yml");

      await writeTemplate(path, schema);

      const text = await readFile(path, "utf8");

      expect(text).toContain("secret-key: sk_test_");
      expect(text).not.toContain("sk_test_abc");
    });
  });

  it("should carry the describe and where lines as comments", async () => {
    await withTempDir(async (directory) => {
      const path = join(directory, "config.template.yml");

      await writeTemplate(path, schema);

      const text = await readFile(path, "utf8");

      expect(text).toContain("# Server side key.");
      expect(text).toContain("# dashboard.stripe.com/test/apikeys");
    });
  });

  it("should say which values are required", async () => {
    await withTempDir(async (directory) => {
      const path = join(directory, "config.template.yml");

      await writeTemplate(path, schema);

      expect(await readFile(path, "utf8")).toContain("# Required.");
    });
  });

  it("should say what is lost by skipping an optional value", async () => {
    await withTempDir(async (directory) => {
      const path = join(directory, "config.template.yml");

      await writeTemplate(path, schema);

      expect(await readFile(path, "utf8")).toContain("Empty and webhooks stay off.");
    });
  });

  it("should leave generated values out, since nobody answers them", async () => {
    await withTempDir(async (directory) => {
      const path = join(directory, "config.template.yml");

      await writeTemplate(path, schema);

      expect(await readFile(path, "utf8")).not.toContain("seal-key");
    });
  });

  it("should carry the section title and note", async () => {
    await withTempDir(async (directory) => {
      const path = join(directory, "config.template.yml");

      await writeTemplate(path, schema);

      const text = await readFile(path, "utf8");

      expect(text).toContain("# Stripe");
      expect(text).toContain("# Test mode only.");
    });
  });

  it("should produce the same bytes every time", async () => {
    await withTempDir(async (directory) => {
      const path = join(directory, "config.template.yml");

      await writeTemplate(path, schema);

      const first = await readFile(path, "utf8");

      await writeTemplate(path, schema);

      expect(await readFile(path, "utf8")).toBe(first);
    });
  });
});
