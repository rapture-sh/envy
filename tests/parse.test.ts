import { describe, expect, it } from "vitest";
import { env } from "~/format/env";
import { parseEnv } from "~/parse";

describe("parseEnv", () => {
  it("should read a plain assignment", () => {
    expect(parseEnv("A=1\n")).toEqual({ A: "1" });
  });

  it("should read several", () => {
    expect(parseEnv("A=1\nB=2\n")).toEqual({ A: "1", B: "2" });
  });

  it("should skip comments and blank lines", () => {
    expect(parseEnv("# a comment\n\nA=1\n")).toEqual({ A: "1" });
  });

  it("should accept an export in front", () => {
    expect(parseEnv("export A=1\n")).toEqual({ A: "1" });
  });

  it("should read a double quoted value", () => {
    expect(parseEnv('A="two words"\n')).toEqual({ A: "two words" });
  });

  it("should read a single quoted value without unescaping it", () => {
    expect(parseEnv("A='a\\nb'\n")).toEqual({ A: "a\\nb" });
  });

  it("should unescape a newline inside double quotes", () => {
    expect(parseEnv('A="a\\nb"\n')).toEqual({ A: "a\nb" });
  });

  it("should unescape a quote inside double quotes", () => {
    expect(parseEnv('A="a\\"b"\n')).toEqual({ A: 'a"b' });
  });

  it("should unescape a backslash inside double quotes", () => {
    expect(parseEnv('A="a\\\\b"\n')).toEqual({ A: "a\\b" });
  });

  it("should stop an unquoted value at a trailing comment", () => {
    expect(parseEnv("A=1 # why\n")).toEqual({ A: "1" });
  });

  it("should keep a hash inside a quoted value", () => {
    expect(parseEnv('A="a # b"\n')).toEqual({ A: "a # b" });
  });

  it("should keep a value with an equals sign in it", () => {
    expect(parseEnv("A=a=b\n")).toEqual({ A: "a=b" });
  });

  it("should read an empty value", () => {
    expect(parseEnv("A=\n")).toEqual({ A: "" });
  });

  it("should skip a line with no equals sign", () => {
    expect(parseEnv("nonsense\nA=1\n")).toEqual({ A: "1" });
  });

  it("should skip a name that is not a name", () => {
    expect(parseEnv("1BAD=x\nA=1\n")).toEqual({ A: "1" });
  });

  it("should skip a line that starts with an equals sign", () => {
    expect(parseEnv("=x\nA=1\n")).toEqual({ A: "1" });
  });

  it("should read a file with carriage returns", () => {
    expect(parseEnv("A=1\r\nB=2\r\n")).toEqual({ A: "1", B: "2" });
  });

  it("should keep an empty quoted value empty", () => {
    expect(parseEnv('A=""\n')).toEqual({ A: "" });
  });

  it("should not treat a lone quote as quoting", () => {
    expect(parseEnv('A="\n')).toEqual({ A: '"' });
  });
});

/**
 * The two have to agree. A value that survives being written and read back is the only
 * thing that makes `convex.push` of an envy-written file safe.
 */
describe("parseEnv, against what the env format writes", () => {
  const cases: Record<string, string> = {
    plain: "sk_test_abc",
    spaced: "two words",
    quoted: 'a"b',
    backslashed: "a\\b",
    hashed: "a # b",
    newlined: "a\nb",
    empty: "",
    url: "http://127.0.0.1:9090",
  };

  for (const [name, value] of Object.entries(cases)) {
    it(`should read back a ${name} value unchanged`, () => {
      expect(parseEnv(env({ A: value }, { header: false })).A).toBe(value);
    });
  }
});
