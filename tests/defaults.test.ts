import { afterEach, describe, expect, it } from "vitest";
import { currentDefaults, defaults, resetDefaults, resolveTimeout } from "~/defaults";

afterEach(() => {
  resetDefaults();
});

describe("defaults", () => {
  it("should start with nothing set", () => {
    expect(currentDefaults()).toEqual({});
  });

  it("should keep what it was given", () => {
    defaults({ timeout: 1000 });

    expect(currentDefaults().timeout).toBe(1000);
  });

  it("should merge rather than replace", () => {
    defaults({ timeout: 1000 });
    defaults({ warn: false });

    expect(currentDefaults()).toEqual({ timeout: 1000, warn: false });
  });
});

describe("resolveTimeout", () => {
  it("should have no timeout when nothing set one", () => {
    expect(resolveTimeout(undefined)).toBeUndefined();
  });

  it("should prefer the one the call was given", () => {
    defaults({ timeout: 1000 });

    expect(resolveTimeout(50)).toBe(50);
  });

  it("should fall back to the process-wide one", () => {
    defaults({ timeout: 1000 });

    expect(resolveTimeout(undefined)).toBe(1000);
  });

  it("should take a zero from the call rather than treating it as absent", () => {
    defaults({ timeout: 1000 });

    expect(resolveTimeout(0)).toBe(0);
  });
});
