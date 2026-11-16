import { describe, expectTypeOf, it } from "vitest";
import { envy } from "~/index";

/**
 * The setup script from the README, transcribed.
 *
 * It is never run: it is here so that the most read piece of code in the repository cannot
 * drift from the API without failing the build. It has already caught the README calling
 * `cfg.capture` on a section its own schema did not declare, and `cfg.section` on another
 * one.
 *
 * If you change the README's script, change this one to match, and the other way round.
 */
async function readme(): Promise<void> {
  const schema = envy.defineConfig({
    stripe: {
      title: "Stripe",
      note: "Test mode only. Nothing here can move real money.",
      values: {
        secretKey: {
          env: "STRIPE_SECRET_KEY",
          describe: "Server side key, used by the checkout endpoints.",
          where: "dashboard.stripe.com/test/apikeys",
          example: "sk_test_51Ab...",
          secret: true,
          required: true,
        },
      },
    },

    session: {
      values: {
        sealKey: { generate: { bytes: 32 }, describe: "Seals the session cookie." },
      },
    },
  });

  await envy.ui.run("Setup", async () => {
    await envy.check([
      { name: "Node", run: "node --version", version: ">=22", fix: "nvm install 22" },
      { name: "Docker", run: "docker info", fix: "Start Docker Desktop" },
    ]);

    const cfg = await envy.load(schema);

    const api = "http://127.0.0.1:8080";

    await envy.ui.step("Writing env files", async () => {
      await envy.write("apps/web/.env", envy.env({ Addresses: { NEXT_PUBLIC_API_URL: api } }));

      await envy.write(
        "services/api/.env",
        envy.env({
          Addresses: { PORT: "8080" },
          Stripe: cfg.env("stripe"),
          Session: { SESSION_SEAL_KEY: cfg.get("session.sealKey") },
        }),
      );
    });

    await envy.ui.step("Installing", () => envy.cmd("pnpm install"));
    await envy.ui.step("Starting the stack", () => envy.docker.compose.up());
    await envy.ui.step("Waiting for the API", () =>
      envy.wait.http(`${api}/health`, { timeout: 120_000 }),
    );

    envy.ui.ready({ web: "http://localhost:3000", api }, { next: "pnpm dev" });
  });
}

/**
 * The fuller schema the README uses to explain the declaration, and the inference it
 * claims for it right underneath.
 */
const documented = envy.defineConfig({
  stripe: {
    title: "Stripe",
    values: {
      secretKey: { env: "STRIPE_SECRET_KEY", secret: true, required: true },
      webhookSecret: { without: "webhook handling stays off" },
    },
  },
  "web-client-1": {
    title: "Web client",
    values: {
      clientId: { required: true },
      redirectUri: { default: "http://localhost:3000/callback" },
    },
  },
  session: {
    values: { sealKey: { generate: { bytes: 32 } } },
  },
});

declare const cfg: Awaited<ReturnType<typeof envy.load<typeof documented>>>;

describe("the readme setup script", () => {
  it("should still typecheck against the surface it documents", () => {
    expectTypeOf(readme).toEqualTypeOf<() => Promise<void>>();
  });
});

describe("the inference the readme promises", () => {
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

  it("should name a section's values in screaming snake", () => {
    expectTypeOf(cfg.env("stripe")).toEqualTypeOf<{
      STRIPE_SECRET_KEY?: string;
      STRIPE_WEBHOOK_SECRET?: string;
    }>();
  });

  it("should use a prefix in place of the section name", () => {
    expectTypeOf(cfg.env("web-client-1", { prefix: "AUTH" })).toEqualTypeOf<{
      AUTH_CLIENT_ID?: string;
      AUTH_REDIRECT_URI?: string;
    }>();
  });
});

describe("the compile errors the readme lists", () => {
  it("should reject a value that is not in the schema", () => {
    // @ts-expect-error stripe has no value called `secret`
    cfg.get("stripe.secret");
  });

  it("should reject a value belonging to another section", () => {
    // @ts-expect-error `clientId` is on web-client-1, not on stripe
    cfg.get("stripe.clientId");
  });

  it("should reject the file spelling of a value", () => {
    // @ts-expect-error the schema spelling is `secretKey`
    cfg.get("stripe.secret-key");
  });

  it("should reject a section on its own", () => {
    // @ts-expect-error a path is a section and a value
    cfg.get("stripe");
  });

  it("should reject a section that is not in the schema", () => {
    // @ts-expect-error there is no `storage` section
    cfg.section("storage");
  });

  it("should reject capturing a value that is not in the schema", () => {
    // @ts-expect-error there is no such value
    cfg.capture("stripe.nope", () => "x");
  });

  it("should reject a section that declares no values", () => {
    // @ts-expect-error a section must declare `values`
    envy.defineConfig({ stripe: { title: "Stripe" } });
  });
});
