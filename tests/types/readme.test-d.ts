import { describe, expectTypeOf, it } from "vitest";
import { envy } from "~/index";

/**
 * The quick start from the README, transcribed.
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
        webhookSecret: {
          describe: "Signs the events Stripe posts back to us.",
          where: "stripe listen --forward-to localhost:3000/ingest",
          example: "whsec_...",
          without: "webhook handling stays off",
        },
      },
    },

    storage: {
      values: {
        bucket: { default: "uploads" },
      },
    },

    session: {
      values: {
        sealKey: { generate: { bytes: 32 }, describe: "Seals the session cookie." },
      },
    },

    backend: {
      values: {
        adminKey: { describe: "Printed by the backend once it is up. Captured, not asked for." },
      },
    },
  });

  await envy.ui.run("Bootstrap", async () => {
    const cfg = await envy.load(schema);

    const api = "http://127.0.0.1:8080";
    const s3 = { host: "http://127.0.0.1:9090", internal: "http://s3mock:9090" };

    await envy.ui.step("Writing config", async () => {
      await envy.write(
        ".env",
        envy.env({
          Addresses: { NEXT_PUBLIC_API_URL: api, S3_ENDPOINT: s3.host },
          Stripe: cfg.env("stripe"),
        }),
      );

      await envy.write(
        "backend/.env",
        envy.env({
          Addresses: { S3_ENDPOINT: s3.internal },
          Secrets: { SECRET_SEAL_KEY: cfg.get("session.sealKey") },
        }),
      );

      await envy.write("apps/web/config.yml", await envy.yaml({ storage: cfg.section("storage") }));
    });

    await envy.ui.step("Installing", () => envy.cmd("pnpm install"));
    await envy.ui.step("Starting the stack", () => envy.docker.compose.up());
    await envy.ui.step("Waiting for the backend", () =>
      envy.wait.http(`${api}/version`, { timeout: 120_000 }),
    );

    await cfg.capture("backend.adminKey", () =>
      envy.docker.compose.exec("backend", "./generate_admin_key.sh"),
    );

    envy.ui.ready({ app: "http://localhost:3000", backend: api });
  });
}

describe("the readme quick start", () => {
  it("should still typecheck against the surface it documents", () => {
    expectTypeOf(readme).toEqualTypeOf<() => Promise<void>>();
  });
});
