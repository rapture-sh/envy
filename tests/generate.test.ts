import { describe, expect, it } from "vitest";
import { generateValue } from "~/generate";

describe("generateValue", () => {
  it("should produce something", () => {
    expect(generateValue()).not.toBe("");
  });

  it("should produce a different value each time", () => {
    expect(generateValue()).not.toBe(generateValue());
  });

  it("should default to something that needs no quoting anywhere", () => {
    expect(generateValue()).toMatch(/^[A-Za-z0-9_-]+$/u);
  });

  it("should take the number of bytes it was given", () => {
    expect(generateValue({ bytes: 8, encoding: "hex" })).toHaveLength(16);
  });

  it("should take the encoding it was given", () => {
    expect(generateValue({ bytes: 16, encoding: "hex" })).toMatch(/^[0-9a-f]{32}$/u);
  });

  it("should refuse a byte count that is not a whole number", () => {
    expect(() => generateValue({ bytes: 1.5 })).toThrow(/whole number of bytes/u);
  });

  it("should refuse a byte count of zero", () => {
    expect(() => generateValue({ bytes: 0 })).toThrow(/whole number of bytes/u);
  });
});
