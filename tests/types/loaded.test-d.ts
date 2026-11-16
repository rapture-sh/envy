import { describe, expectTypeOf, it } from "vitest";
import { defineConfig } from "~/define";
import type { Loaded } from "~/loaded";

const schema = defineConfig({
  stripe: {
    values: {
      secretKey: { required: true },
      webhookSecret: {},
      publishableKey: { env: "NEXT_PUBLIC_STRIPE_KEY" },
    },
  },
  "web-client-1": {
    values: {
      clientId: { required: true },
      redirectUri: { default: "http://localhost:3000/callback" },
    },
  },
  session: {
    values: { sealKey: { generate: { bytes: 32 } } },
  },
});

declare const cfg: Loaded<typeof schema>;

describe("get", () => {
  it("should be a string for a required value", () => {
    expectTypeOf(cfg.get("stripe.secretKey")).toEqualTypeOf<string>();
  });

  it("should include undefined for an optional value", () => {
    expectTypeOf(cfg.get("stripe.webhookSecret")).toEqualTypeOf<string | undefined>();
  });

  it("should be a string for a generated value", () => {
    expectTypeOf(cfg.get("session.sealKey")).toEqualTypeOf<string>();
  });

  it("should be a string for a value with a default", () => {
    expectTypeOf(cfg.get("web-client-1.redirectUri")).toEqualTypeOf<string>();
  });

  it("should reject a value that is not in the schema", () => {
    // @ts-expect-error stripe has no value called `secret`
    cfg.get("stripe.secret");
  });

  it("should reject a value from another section", () => {
    // @ts-expect-error `clientId` is on web-client-1, not on stripe
    cfg.get("stripe.clientId");
  });

  it("should reject a section on its own", () => {
    // @ts-expect-error a path is a section and a value
    cfg.get("stripe");
  });

  it("should reject a value written in file spelling", () => {
    // @ts-expect-error the schema says `secretKey`, the file says `secret-key`
    cfg.get("stripe.secret-key");
  });
});

describe("section", () => {
  it("should carry the optionality of every value", () => {
    expectTypeOf(cfg.section("stripe")).toEqualTypeOf<{
      secretKey: string;
      webhookSecret: string | undefined;
      publishableKey: string | undefined;
    }>();
  });

  it("should reject a section that is not in the schema", () => {
    // @ts-expect-error there is no `storage` section
    cfg.section("storage");
  });
});

describe("env", () => {
  it("should key the section by the env names it writes", () => {
    expectTypeOf(cfg.env("web-client-1")).toEqualTypeOf<{
      WEB_CLIENT_1_CLIENT_ID?: string;
      WEB_CLIENT_1_REDIRECT_URI?: string;
    }>();
  });

  it("should use a declared env name rather than the convention", () => {
    expectTypeOf(cfg.env("stripe")).toEqualTypeOf<{
      STRIPE_SECRET_KEY?: string;
      STRIPE_WEBHOOK_SECRET?: string;
      NEXT_PUBLIC_STRIPE_KEY?: string;
    }>();
  });

  it("should put a prefix in front of every name", () => {
    expectTypeOf(cfg.env("web-client-1", { prefix: "AUTH" })).toEqualTypeOf<{
      AUTH_WEB_CLIENT_1_CLIENT_ID?: string;
      AUTH_WEB_CLIENT_1_REDIRECT_URI?: string;
    }>();
  });

  it("should reject a section that is not in the schema", () => {
    // @ts-expect-error there is no `storage` section
    cfg.env("storage");
  });
});

describe("capture", () => {
  it("should give a string back", () => {
    expectTypeOf(cfg.capture("stripe.webhookSecret", () => "x")).toEqualTypeOf<Promise<string>>();
  });

  it("should accept work that returns a promise", () => {
    expectTypeOf(cfg.capture("stripe.webhookSecret", async () => "x")).toEqualTypeOf<
      Promise<string>
    >();
  });

  it("should reject a value that is not in the schema", () => {
    // @ts-expect-error there is no such value
    cfg.capture("stripe.nope", () => "x");
  });
});
