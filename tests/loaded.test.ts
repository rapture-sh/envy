import { describe, expect, it, vi } from "vitest";
import { defineConfig } from "~/define";
import { Fail } from "~/errors";
import { createLoaded } from "~/loaded";
import type { StoreData } from "~/store/index";

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
  backend: {
    values: {
      adminKey: {},
    },
  },
});

function loadedWith(values: StoreData, save = vi.fn().mockResolvedValue(undefined)) {
  return { loaded: createLoaded<typeof schema>({ schema, values, save }), save };
}

const filled: StoreData = {
  stripe: { "secret-key": "sk_abc", "publishable-key": "pk_abc" },
  "web-client-1": { "client-id": "cid", "redirect-uri": "http://localhost:3000/callback" },
  backend: {},
};

describe("get", () => {
  it("should give a value back", () => {
    expect(loadedWith(filled).loaded.get("stripe.secretKey")).toBe("sk_abc");
  });

  it("should give nothing back for a value with nothing in it", () => {
    expect(loadedWith(filled).loaded.get("stripe.webhookSecret")).toBeUndefined();
  });

  it("should read a kebab section and a camel value", () => {
    expect(loadedWith(filled).loaded.get("web-client-1.clientId")).toBe("cid");
  });

  it("should fail for a value that is not in the schema", () => {
    // @ts-expect-error there is no such value, which is the point of the test
    expect(() => loadedWith(filled).loaded.get("stripe.nope")).toThrow(Fail);
  });

  it("should fail for something that is not a path", () => {
    // @ts-expect-error "stripe" is a section, not a value
    expect(() => loadedWith(filled).loaded.get("stripe")).toThrow(/section and a value/u);
  });
});

describe("has", () => {
  it("should be true for a value that has something in it", () => {
    expect(loadedWith(filled).loaded.has("stripe.secretKey")).toBe(true);
  });

  it("should be false for a value that does not", () => {
    expect(loadedWith(filled).loaded.has("stripe.webhookSecret")).toBe(false);
  });
});

describe("section", () => {
  it("should give the whole section back under its schema names", () => {
    expect(loadedWith(filled).loaded.section("stripe")).toEqual({
      secretKey: "sk_abc",
      webhookSecret: undefined,
      publishableKey: "pk_abc",
    });
  });

  it("should fail for a section that is not in the schema", () => {
    // @ts-expect-error there is no such section
    expect(() => loadedWith(filled).loaded.section("nope")).toThrow(Fail);
  });
});

describe("env", () => {
  it("should key the section by the conventional env names", () => {
    expect(loadedWith(filled).loaded.env("web-client-1")).toEqual({
      WEB_CLIENT_1_CLIENT_ID: "cid",
      WEB_CLIENT_1_REDIRECT_URI: "http://localhost:3000/callback",
    });
  });

  it("should use a declared env name rather than the convention", () => {
    expect(loadedWith(filled).loaded.env("stripe")).toEqual({
      STRIPE_SECRET_KEY: "sk_abc",
      NEXT_PUBLIC_STRIPE_KEY: "pk_abc",
    });
  });

  it("should leave out a value with nothing in it", () => {
    expect(loadedWith(filled).loaded.env("stripe")).not.toHaveProperty("STRIPE_WEBHOOK_SECRET");
  });

  it("should put a prefix in front of every name", () => {
    expect(loadedWith(filled).loaded.env("stripe", { prefix: "AUTH" })).toEqual({
      AUTH_STRIPE_SECRET_KEY: "sk_abc",
      AUTH_NEXT_PUBLIC_STRIPE_KEY: "pk_abc",
    });
  });

  it("should fail for a section that is not in the schema", () => {
    // @ts-expect-error there is no such section
    expect(() => loadedWith(filled).loaded.env("nope")).toThrow(Fail);
  });
});

describe("capture", () => {
  it("should run the work and keep what it printed", async () => {
    const { loaded, save } = loadedWith(filled);

    expect(await loaded.capture("backend.adminKey", () => "key|abc")).toBe("key|abc");
    expect(loaded.get("backend.adminKey")).toBe("key|abc");
    expect(save).toHaveBeenCalledOnce();
  });

  it("should trim what the work printed, since a CLI adds a newline", async () => {
    const { loaded } = loadedWith(filled);

    expect(await loaded.capture("backend.adminKey", () => "key|abc\n")).toBe("key|abc");
  });

  it("should not run the work again when the value is already there", async () => {
    const { loaded, save } = loadedWith({ ...filled, backend: { "admin-key": "kept" } });
    const produce = vi.fn(() => "fresh");

    expect(await loaded.capture("backend.adminKey", produce)).toBe("kept");
    expect(produce).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it("should await work that returns a promise", async () => {
    const { loaded } = loadedWith(filled);

    expect(await loaded.capture("backend.adminKey", async () => "key|abc")).toBe("key|abc");
  });

  it("should fail when the work produced nothing", async () => {
    const { loaded } = loadedWith(filled);

    await expect(loaded.capture("backend.adminKey", () => "  ")).rejects.toThrow(
      /Nothing was produced/u,
    );
  });

  it("should fail for a value that is not in the schema", async () => {
    const { loaded } = loadedWith(filled);

    // @ts-expect-error there is no such value
    await expect(loaded.capture("backend.nope", () => "x")).rejects.toThrow(Fail);
  });

  it("should not name the captured value in the failure", async () => {
    const { loaded } = loadedWith(filled);

    await expect(loaded.capture("backend.adminKey", () => "")).rejects.toThrow(
      expect.objectContaining({ message: expect.not.stringContaining("sk_abc") }),
    );
  });
});

describe("missing", () => {
  it("should name every required value with nothing in it", () => {
    const { loaded } = loadedWith({ stripe: {}, "web-client-1": { "client-id": "cid" } });

    expect(loaded.missing()).toEqual(["stripe.secretKey"]);
  });

  it("should be empty when every required value is answered", () => {
    expect(loadedWith(filled).loaded.missing()).toEqual([]);
  });
});

describe("all", () => {
  it("should give back everything it holds, in file spelling", () => {
    expect(loadedWith(filled).loaded.all()).toEqual(filled);
  });

  it("should include a captured value", async () => {
    const { loaded } = loadedWith(filled);

    await loaded.capture("backend.adminKey", () => "key|abc");

    expect(loaded.all().backend?.["admin-key"]).toBe("key|abc");
  });
});
