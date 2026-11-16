import { describe, expect, it } from "vitest";
import { env, escapeEnvValue } from "~/format/env";
import { json } from "~/format/json";
import { text } from "~/format/text";
import { yaml } from "~/format/yaml";
import { GENERATED } from "~/write";

describe("escapeEnvValue", () => {
  it("should leave an ordinary value bare", () => {
    expect(escapeEnvValue("sk_test_abc")).toBe("sk_test_abc");
  });

  it("should leave a url bare", () => {
    expect(escapeEnvValue("http://127.0.0.1:9090")).toBe("http://127.0.0.1:9090");
  });

  it("should leave base64url bare, which is what generated values are", () => {
    expect(escapeEnvValue("a-b_c123")).toBe("a-b_c123");
  });

  it("should quote a value with a space", () => {
    expect(escapeEnvValue("two words")).toBe('"two words"');
  });

  it("should quote a value with a comment marker", () => {
    expect(escapeEnvValue("a#b")).toBe('"a#b"');
  });

  it("should escape a quote and a backslash", () => {
    expect(escapeEnvValue('a"b\\c')).toBe('"a\\"b\\\\c"');
  });

  it("should escape a newline rather than writing a second line", () => {
    expect(escapeEnvValue("a\nb")).toBe('"a\\nb"');
  });

  it("should leave an empty value bare", () => {
    expect(escapeEnvValue("")).toBe("");
  });
});

describe("env", () => {
  it("should write a flat set of variables", () => {
    expect(env({ A: "1", B: "2" }, { header: false })).toBe("A=1\nB=2\n");
  });

  it("should put a default header on saying the file is generated", () => {
    expect(env({ A: "1" })).toContain(`# ${GENERATED}`);
  });

  it("should take a header of its own", () => {
    expect(env({ A: "1" }, { header: "mine" }).startsWith("# mine\n")).toBe(true);
  });

  it("should take several header lines", () => {
    expect(env({ A: "1" }, { header: ["one", "", "two"] }).startsWith("# one\n#\n# two\n")).toBe(
      true,
    );
  });

  it("should write a group under its name", () => {
    expect(env({ Stripe: { A: "1" } }, { header: false })).toBe("\n# Stripe\nA=1\n");
  });

  it("should keep the order the groups were given in", () => {
    const rendered = env({ First: { A: "1" }, Second: { B: "2" } }, { header: false });

    expect(rendered.indexOf("First")).toBeLessThan(rendered.indexOf("Second"));
  });

  it("should write bare variables above the groups", () => {
    const rendered = env({ A: "1", Stripe: { B: "2" } }, { header: false });

    expect(rendered.indexOf("A=1")).toBeLessThan(rendered.indexOf("# Stripe"));
  });

  it("should leave out a value that is undefined", () => {
    expect(env({ A: "1", B: undefined }, { header: false })).toBe("A=1\n");
  });

  it("should write an empty string, which is not the same as absent", () => {
    expect(env({ A: "" }, { header: false })).toBe("A=\n");
  });

  it("should leave out a group with nothing in it", () => {
    expect(env({ Empty: {}, Stripe: { A: "1" } }, { header: false })).toBe("\n# Stripe\nA=1\n");
  });

  it("should produce the same text for the same input", () => {
    expect(env({ A: "1", Stripe: { B: "2" } })).toBe(env({ A: "1", Stripe: { B: "2" } }));
  });

  it("should end with a newline", () => {
    expect(env({ A: "1" }, { header: false }).endsWith("\n")).toBe(true);
  });
});

describe("json", () => {
  it("should render a value", () => {
    expect(json({ a: 1 })).toBe('{\n  "a": 1\n}\n');
  });

  it("should take an indent", () => {
    expect(json({ a: 1 }, { indent: 4 })).toBe('{\n    "a": 1\n}\n');
  });

  it("should end with a newline", () => {
    expect(json([1, 2]).endsWith("\n")).toBe(true);
  });
});

describe("text", () => {
  it("should put a default header on", () => {
    expect(text("body")).toContain(`# ${GENERATED}`);
  });

  it("should keep the body as it was given", () => {
    expect(text("a\nb", { header: false })).toBe("a\nb\n");
  });

  it("should not add a second newline to a body that has one", () => {
    expect(text("a\n", { header: false })).toBe("a\n");
  });

  it("should take a comment marker of its own", () => {
    expect(text("body", { header: "mine", comment: "//" }).startsWith("// mine\n")).toBe(true);
  });

  it("should take several header lines", () => {
    expect(text("body", { header: ["one", "two"] }).startsWith("# one\n# two\n")).toBe(true);
  });
});

describe("yaml", () => {
  it("should render a value", async () => {
    expect(await yaml({ a: 1 }, { header: false })).toBe("a: 1\n");
  });

  it("should render something nested", async () => {
    expect(await yaml({ s3: { bucket: "uploads" } }, { header: false })).toBe(
      "s3:\n  bucket: uploads\n",
    );
  });

  it("should put a default header on saying the file is generated", async () => {
    expect(await yaml({ a: 1 })).toContain(`# ${GENERATED}`);
  });

  it("should take a header of its own", async () => {
    const rendered = await yaml({ a: 1 }, { header: ["one", "two"] });

    expect(rendered.startsWith("# one\n# two\n")).toBe(true);
  });

  it("should produce the same text for the same value", async () => {
    expect(await yaml({ a: 1, b: [2, 3] })).toBe(await yaml({ a: 1, b: [2, 3] }));
  });
});
