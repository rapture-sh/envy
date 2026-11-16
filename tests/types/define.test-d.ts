import { describe, expectTypeOf, it } from "vitest";
import type { SectionEnv, SectionValues, ValueAtPath, ValuePath, ValueType } from "~/define";
import { defineConfig } from "~/define";

const schema = defineConfig({
  stripe: {
    title: "Stripe",
    values: {
      secretKey: { required: true, example: "sk_test_" },
      webhookSecret: { where: "stripe listen" },
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
    values: {
      sealKey: { generate: { bytes: 32 } },
    },
  },
});

type Schema = typeof schema;

describe("defineConfig", () => {
  it("should keep required as a literal rather than widening it to boolean", () => {
    expectTypeOf<Schema["stripe"]["values"]["secretKey"]["required"]>().toEqualTypeOf<true>();
  });

  it("should keep the section names as literals", () => {
    expectTypeOf<keyof Schema>().toEqualTypeOf<"stripe" | "web-client-1" | "session">();
  });

  it("should reject a section with no values", () => {
    // @ts-expect-error a section must declare `values`
    defineConfig({ stripe: { title: "Stripe" } });
  });

  it("should reject a value spec with a property that is not in the schema", () => {
    // @ts-expect-error `describes` is not a thing, `describe` is
    defineConfig({ stripe: { values: { key: { describes: "no" } } } });
  });
});

describe("ValueType", () => {
  it("should be a string when the value is required", () => {
    expectTypeOf<ValueType<{ required: true }>>().toEqualTypeOf<string>();
  });

  it("should be a string when the value is generated", () => {
    expectTypeOf<ValueType<{ generate: { bytes: 32 } }>>().toEqualTypeOf<string>();
  });

  it("should be a string when the value has a default", () => {
    expectTypeOf<ValueType<{ default: "x" }>>().toEqualTypeOf<string>();
  });

  it("should include undefined when the value is optional", () => {
    expectTypeOf<ValueType<{ where: "somewhere" }>>().toEqualTypeOf<string | undefined>();
  });

  it("should include undefined when required is explicitly false", () => {
    expectTypeOf<ValueType<{ required: false }>>().toEqualTypeOf<string | undefined>();
  });
});

describe("ValuePath", () => {
  it("should be every section and value the schema declares", () => {
    expectTypeOf<ValuePath<Schema>>().toEqualTypeOf<
      | "stripe.secretKey"
      | "stripe.webhookSecret"
      | "stripe.publishableKey"
      | "web-client-1.clientId"
      | "web-client-1.redirectUri"
      | "session.sealKey"
    >();
  });

  it("should not include a value from another section", () => {
    expectTypeOf<"stripe.clientId">().not.toExtend<ValuePath<Schema>>();
  });
});

describe("ValueAtPath", () => {
  it("should be a string for a required value", () => {
    expectTypeOf<ValueAtPath<Schema, "stripe.secretKey">>().toEqualTypeOf<string>();
  });

  it("should include undefined for an optional value", () => {
    expectTypeOf<ValueAtPath<Schema, "stripe.webhookSecret">>().toEqualTypeOf<string | undefined>();
  });

  it("should be a string for a value with a default", () => {
    expectTypeOf<ValueAtPath<Schema, "web-client-1.redirectUri">>().toEqualTypeOf<string>();
  });

  it("should be a string for a generated value", () => {
    expectTypeOf<ValueAtPath<Schema, "session.sealKey">>().toEqualTypeOf<string>();
  });
});

describe("SectionValues", () => {
  it("should key a section by its schema names", () => {
    expectTypeOf<SectionValues<Schema["web-client-1"]>>().toEqualTypeOf<{
      clientId: string;
      redirectUri: string;
    }>();
  });

  it("should carry the optionality of each value", () => {
    expectTypeOf<SectionValues<Schema["stripe"]>>().toEqualTypeOf<{
      secretKey: string;
      webhookSecret: string | undefined;
      publishableKey: string | undefined;
    }>();
  });
});

describe("SectionEnv", () => {
  it("should key a section by the env names it writes", () => {
    expectTypeOf<SectionEnv<Schema, "web-client-1">>().toEqualTypeOf<{
      WEB_CLIENT_1_CLIENT_ID: string;
      WEB_CLIENT_1_REDIRECT_URI: string;
    }>();
  });

  it("should use a declared env name rather than the convention", () => {
    expectTypeOf<SectionEnv<Schema, "stripe">>().toEqualTypeOf<{
      STRIPE_SECRET_KEY: string;
      STRIPE_WEBHOOK_SECRET: string;
      NEXT_PUBLIC_STRIPE_KEY: string;
    }>();
  });

  it("should put a prefix in front of every name, declared or not", () => {
    expectTypeOf<SectionEnv<Schema, "stripe", "AUTH">>().toEqualTypeOf<{
      AUTH_STRIPE_SECRET_KEY: string;
      AUTH_STRIPE_WEBHOOK_SECRET: string;
      AUTH_NEXT_PUBLIC_STRIPE_KEY: string;
    }>();
  });
});
