import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { envy } from "@rapture-sh/envy";

/**
 * A section per app, and each app getting its own file.
 *
 *   pnpm example:monorepo
 *
 * This is the shape envy exists for. Three apps, one shared service, and each of them
 * needs a different subset of the same values. The names are written once, in the schema,
 * and `cfg.env` turns a section into env names so nothing is spelled out twice.
 *
 * Run it with no terminal, as CI does, and it reports what is unanswered instead of
 * hanging. That is why the same script works in a pipeline.
 */
const here = join(dirname(fileURLToPath(import.meta.url)), "..");

const schema = envy.defineConfig({
  shared: {
    title: "Shared",
    note: "Everything every app needs.",
    values: {
      environment: { describe: "Which stack this is.", default: "development" },
      sealKey: { describe: "Seals every session cookie.", generate: { bytes: 32 } },
    },
  },

  storage: {
    title: "Storage",
    note: "The local S3 stand-in. Nothing here is secret.",
    values: {
      bucket: { default: "uploads" },
      accessKeyId: { default: "local" },
      secretAccessKey: { default: "local-secret" },
    },
  },

  web: {
    title: "Web app",
    values: {
      port: { default: "3000" },
      analyticsToken: {
        env: "NEXT_PUBLIC_ANALYTICS_TOKEN",
        describe: "Reaches the browser, so it is public by design.",
        where: "your analytics dashboard",
        example: "phc_",
        without: "analytics stays off",
      },
    },
  },

  admin: {
    title: "Admin app",
    values: {
      port: { default: "3001" },
      allowedEmail: {
        describe: "Who gets in locally.",
        default: "admin@example.test",
      },
    },
  },

  api: {
    title: "API service",
    values: {
      port: { default: "8080" },
      paymentsKey: {
        env: "STRIPE_SECRET_KEY",
        describe: "Server side key for the checkout endpoints.",
        where: "dashboard.stripe.com/test/apikeys",
        example: "sk_test_",
        secret: true,
        required: true,
      },
    },
  },
});

await envy.ui.run("Monorepo", async () => {
  const cfg = await envy.load(schema, { cwd: here });

  const api = `http://localhost:${cfg.get("api.port")}`;
  const web = `http://localhost:${cfg.get("web.port")}`;
  const admin = `http://localhost:${cfg.get("admin.port")}`;

  const shared = {
    NODE_ENV: cfg.get("shared.environment"),
    SESSION_SEAL_KEY: cfg.get("shared.sealKey"),
  };

  await envy.ui.step("Writing every app's env", async () => {
    await envy.write(
      join(here, "apps", "web", ".env"),
      envy.env({
        Shared: shared,
        Addresses: { NEXT_PUBLIC_API_URL: api, PORT: cfg.get("web.port") },
        Web: cfg.env("web"),
      }),
    );

    await envy.write(
      join(here, "apps", "admin", ".env"),
      envy.env({
        Shared: shared,
        Addresses: { API_URL: api, PORT: cfg.get("admin.port") },
        Admin: cfg.env("admin"),
      }),
    );

    await envy.write(
      join(here, "services", "api", ".env"),
      envy.env({
        Shared: shared,
        Addresses: { PORT: cfg.get("api.port"), WEB_ORIGIN: web },
        // The API is the only thing that gets the payments key. Nothing that reaches a
        // browser is written a secret, which is the whole reason these are separate files.
        Payments: cfg.env("api"),
        Storage: cfg.env("storage"),
      }),
    );

    // Compose reads the root one, and needs only what the containers themselves use.
    await envy.write(
      join(here, ".env"),
      envy.env({
        Ports: {
          WEB_PORT: cfg.get("web.port"),
          ADMIN_PORT: cfg.get("admin.port"),
          API_PORT: cfg.get("api.port"),
        },
        Storage: cfg.env("storage"),
      }),
    );
  });

  envy.ui.ready({ web, admin, api }, { next: "pnpm dev" });
});
