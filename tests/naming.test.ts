import { describe, expect, it } from "vitest";
import { envNameFor, toEnvName, toKebab } from "~/naming";

describe("toKebab", () => {
  it("should split a camel hump", () => {
    expect(toKebab("secretKey")).toBe("secret-key");
  });

  it("should leave a single word alone", () => {
    expect(toKebab("bucket")).toBe("bucket");
  });

  it("should leave a name that is already kebab alone", () => {
    expect(toKebab("web-client-1")).toBe("web-client-1");
  });

  it("should keep a digit attached to the word before it", () => {
    expect(toKebab("oauth2Id")).toBe("oauth2-id");
  });

  it("should split a run of capitals before the last one", () => {
    expect(toKebab("s3Endpoint")).toBe("s3-endpoint");
  });

  it("should keep an acronym together", () => {
    expect(toKebab("apiURL")).toBe("api-url");
  });

  it("should split an acronym from the word after it", () => {
    expect(toKebab("awsSDKRegion")).toBe("aws-sdk-region");
  });

  it("should not leave a leading dash on a name that starts with a capital", () => {
    expect(toKebab("SecretKey")).toBe("secret-key");
  });
});

describe("toEnvName", () => {
  it("should join the section and the value", () => {
    expect(toEnvName("stripe", "secretKey")).toBe("STRIPE_SECRET_KEY");
  });

  it("should turn a kebab section into underscores", () => {
    expect(toEnvName("web-client-1", "clientId")).toBe("WEB_CLIENT_1_CLIENT_ID");
  });

  it("should handle a one word section and value", () => {
    expect(toEnvName("storage", "bucket")).toBe("STORAGE_BUCKET");
  });
});

describe("envNameFor", () => {
  it("should use the convention when the schema declared nothing", () => {
    expect(envNameFor("stripe", "secretKey", undefined, undefined)).toBe("STRIPE_SECRET_KEY");
  });

  it("should use the declared name when there is one", () => {
    expect(envNameFor("stripe", "secretKey", "SK", undefined)).toBe("SK");
  });

  it("should put a prefix in front of the convention", () => {
    expect(envNameFor("web-client-1", "clientId", undefined, "AUTH")).toBe(
      "AUTH_WEB_CLIENT_1_CLIENT_ID",
    );
  });

  it("should put a prefix in front of a declared name too", () => {
    expect(envNameFor("stripe", "secretKey", "SK", "AUTH")).toBe("AUTH_SK");
  });

  it("should ignore an empty prefix", () => {
    expect(envNameFor("stripe", "secretKey", undefined, "")).toBe("STRIPE_SECRET_KEY");
  });

  it("should normalise a prefix that was written in another shape", () => {
    expect(envNameFor("stripe", "secretKey", undefined, "myApp")).toBe("MY_APP_STRIPE_SECRET_KEY");
  });
});
