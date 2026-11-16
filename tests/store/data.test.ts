import { describe, expect, it } from "vitest";
import { toStoreData, valueAt, withValue } from "~/store";
import { quoteValue, resetYamlModule, yamlModule } from "~/store/yaml";

describe("toStoreData", () => {
  it("should give nothing back for something that is not a map", () => {
    expect(toStoreData("hello")).toEqual({});
    expect(toStoreData(null)).toEqual({});
    expect(toStoreData(["a"])).toEqual({});
    expect(toStoreData(undefined)).toEqual({});
  });

  it("should keep a section that is a map of scalars", () => {
    expect(toStoreData({ stripe: { key: "a", port: 1, on: false } })).toEqual({
      stripe: { key: "a", port: "1", on: "false" },
    });
  });

  it("should read a null value as empty", () => {
    expect(toStoreData({ stripe: { key: null } })).toEqual({ stripe: { key: "" } });
  });

  it("should drop a value that is not a scalar", () => {
    expect(toStoreData({ stripe: { key: "a", nested: { deep: 1 } } })).toEqual({
      stripe: { key: "a" },
    });
  });
});

describe("valueAt", () => {
  const data = { stripe: { "secret-key": "a", "webhook-secret": "" } };

  it("should give the value back", () => {
    expect(valueAt(data, "stripe", "secret-key")).toBe("a");
  });

  it("should treat an empty value as absent", () => {
    expect(valueAt(data, "stripe", "webhook-secret")).toBeUndefined();
  });

  it("should give nothing back for a value that is not there", () => {
    expect(valueAt(data, "stripe", "missing")).toBeUndefined();
  });

  it("should give nothing back for a section that is not there", () => {
    expect(valueAt(data, "missing", "secret-key")).toBeUndefined();
  });
});

describe("withValue", () => {
  it("should add a value to an existing section", () => {
    expect(withValue({ stripe: { a: "1" } }, "stripe", "b", "2")).toEqual({
      stripe: { a: "1", b: "2" },
    });
  });

  it("should add a section that is not there yet", () => {
    expect(withValue({}, "session", "seal-key", "abc")).toEqual({
      session: { "seal-key": "abc" },
    });
  });

  it("should not change what it was given", () => {
    const before = { stripe: { a: "1" } };

    withValue(before, "stripe", "b", "2");

    expect(before).toEqual({ stripe: { a: "1" } });
  });
});

describe("quoteValue", () => {
  it("should leave an ordinary value bare", () => {
    expect(quoteValue("sk_test_abc")).toBe("sk_test_abc");
  });

  it("should leave a url bare, since a colon only groups with a space after it", () => {
    expect(quoteValue("http://localhost:3000")).toBe("http://localhost:3000");
  });

  it("should quote something that would read back as a number", () => {
    expect(quoteValue("3000")).toBe('"3000"');
  });

  it("should quote something that would read back as a boolean", () => {
    expect(quoteValue("true")).toBe('"true"');
    expect(quoteValue("no")).toBe('"no"');
  });

  it("should quote a value that starts with a character YAML gives meaning to", () => {
    expect(quoteValue("*star")).toBe('"*star"');
    expect(quoteValue("#hash")).toBe('"#hash"');
  });

  it("should quote a value with a comment marker in it", () => {
    expect(quoteValue("a # b")).toBe('"a # b"');
  });

  it("should quote a value with trailing whitespace, which would otherwise be lost", () => {
    expect(quoteValue("a ")).toBe('"a "');
  });

  it("should escape a quote and a backslash inside a quoted value", () => {
    expect(quoteValue('a"b\\c ')).toBe('"a\\"b\\\\c "');
  });

  it("should quote an empty value", () => {
    expect(quoteValue("")).toBe('""');
  });
});

describe("yamlModule", () => {
  it("should load the parser", async () => {
    resetYamlModule();

    expect(typeof (await yamlModule()).parse).toBe("function");
  });

  it("should give the same module back on a second call", async () => {
    expect(await yamlModule()).toBe(await yamlModule());
  });
});
