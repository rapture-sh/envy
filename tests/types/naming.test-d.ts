import { describe, expectTypeOf, it } from "vitest";
import type { EnvName, Kebab } from "~/naming";

/**
 * These assert the type-level rules match the functions in `tests/naming.test.ts` case for
 * case. If the two ever disagree, a caller gets a type that says one env name and a file
 * that holds another, which is the worst possible way for this to break.
 */
describe("Kebab", () => {
  it("should split a camel hump", () => {
    expectTypeOf<Kebab<"secretKey">>().toEqualTypeOf<"secret-key">();
  });

  it("should leave a single word alone", () => {
    expectTypeOf<Kebab<"bucket">>().toEqualTypeOf<"bucket">();
  });

  it("should leave a name that is already kebab alone", () => {
    expectTypeOf<Kebab<"web-client-1">>().toEqualTypeOf<"web-client-1">();
  });

  it("should keep a digit attached to the word before it", () => {
    expectTypeOf<Kebab<"oauth2Id">>().toEqualTypeOf<"oauth2-id">();
  });

  it("should split a digit from the word after it", () => {
    expectTypeOf<Kebab<"s3Endpoint">>().toEqualTypeOf<"s3-endpoint">();
  });

  it("should keep an acronym together", () => {
    expectTypeOf<Kebab<"apiURL">>().toEqualTypeOf<"api-url">();
  });

  it("should split an acronym from the word after it", () => {
    expectTypeOf<Kebab<"awsSDKRegion">>().toEqualTypeOf<"aws-sdk-region">();
  });

  it("should not leave a leading dash on a name that starts with a capital", () => {
    expectTypeOf<Kebab<"SecretKey">>().toEqualTypeOf<"secret-key">();
  });
});

describe("EnvName", () => {
  it("should join the section and the value", () => {
    expectTypeOf<EnvName<"stripe", "secretKey">>().toEqualTypeOf<"STRIPE_SECRET_KEY">();
  });

  it("should turn a kebab section into underscores", () => {
    expectTypeOf<EnvName<"web-client-1", "clientId">>().toEqualTypeOf<"WEB_CLIENT_1_CLIENT_ID">();
  });

  it("should handle a one word section and value", () => {
    expectTypeOf<EnvName<"storage", "bucket">>().toEqualTypeOf<"STORAGE_BUCKET">();
  });

  it("should produce the prefixed name when a prefix stands in for the section", () => {
    expectTypeOf<EnvName<"AUTH", "clientId">>().toEqualTypeOf<"AUTH_CLIENT_ID">();
  });

  it("should normalise a prefix that was written in another shape", () => {
    expectTypeOf<EnvName<"myApp", "secretKey">>().toEqualTypeOf<"MY_APP_SECRET_KEY">();
  });
});
