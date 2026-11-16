import { describe, expect, it } from "vitest";
import { Fail, fail, isFail } from "~/errors";

describe("Fail", () => {
  it("should carry the message it was given", () => {
    expect(new Fail("docker is not answering").message).toBe("docker is not answering");
  });

  it("should be an Error", () => {
    expect(new Fail("no")).toBeInstanceOf(Error);
  });

  it("should name itself", () => {
    expect(new Fail("no").name).toBe("Fail");
  });
});

describe("fail", () => {
  it("should throw a Fail", () => {
    expect(() => fail("no")).toThrow(Fail);
  });
});

describe("isFail", () => {
  it("should recognise a Fail", () => {
    expect(isFail(new Fail("no"))).toBe(true);
  });

  it("should not recognise another error", () => {
    expect(isFail(new TypeError("a bug"))).toBe(false);
  });

  it("should not recognise something that is not an error", () => {
    expect(isFail("no")).toBe(false);
  });
});
