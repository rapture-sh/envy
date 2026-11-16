import { describe, expect, it } from "vitest";
import { defineConfig } from "~/define";

describe("defineConfig", () => {
  it("should hand the schema straight back", () => {
    const schema = { stripe: { values: { secretKey: {} } } };

    expect(defineConfig(schema)).toBe(schema);
  });

  it("should refuse a section that declares no values", () => {
    expect(() => defineConfig({ stripe: { values: {} } })).toThrow(/declares no values/u);
  });

  it("should name the section it refused", () => {
    expect(() => defineConfig({ storage: { values: {} } })).toThrow(/"storage"/u);
  });

  it("should refuse a value that is both generated and required", () => {
    expect(() =>
      defineConfig({ session: { values: { sealKey: { generate: {}, required: true } } } }),
    ).toThrow(/both generated and required/u);
  });

  it("should refuse a value that is both generated and has a default", () => {
    expect(() =>
      defineConfig({ session: { values: { sealKey: { generate: {}, default: "x" } } } }),
    ).toThrow(/both generated and has a default/u);
  });

  it("should name the value it refused", () => {
    expect(() =>
      defineConfig({ session: { values: { sealKey: { generate: {}, required: true } } } }),
    ).toThrow(/"session\.sealKey"/u);
  });

  it("should accept a generated value on its own", () => {
    expect(() =>
      defineConfig({ session: { values: { sealKey: { generate: { bytes: 32 } } } } }),
    ).not.toThrow();
  });

  it("should accept a required value with an example", () => {
    expect(() =>
      defineConfig({ stripe: { values: { secretKey: { required: true, example: "sk_" } } } }),
    ).not.toThrow();
  });
});
