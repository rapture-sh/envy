import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { envy } from "@rapturedotsh/envy";

/**
 * Bring a stack up, wait for it, and keep a value one of its containers prints.
 *
 *   pnpm tsx examples/with-docker/scripts/setup.ts
 *
 * Not in `pnpm examples`, because it needs docker. It is here to be read, and it does
 * typecheck with everything else, so it cannot rot quietly.
 *
 * The shape to take from this: the stack comes up, something waits for it, and only then
 * can a value be captured. That ordering is why `cfg.capture` sits in the script rather
 * than in the schema, while a generated value is declared in the schema and produced
 * before anything starts.
 */
const here = join(dirname(fileURLToPath(import.meta.url)), "..");
const compose = { file: join(here, "docker-compose.yml"), cwd: here };

const services = {
  backend: { host: "http://127.0.0.1:8080", internal: "http://backend:3210" },
  storage: { host: "http://127.0.0.1:9090", internal: "http://s3mock:9090" },
};

const schema = envy.defineConfig({
  storage: {
    title: "Storage",
    values: {
      bucket: { default: "uploads" },
      accessKeyId: { default: "local" },
      secretAccessKey: { default: "local-secret" },
    },
  },

  backend: {
    title: "Backend",
    values: {
      sealKey: { describe: "Seals the session cookie.", generate: { bytes: 32 } },
      adminKey: {
        describe: "Printed by the backend once it is up. Captured, not asked for.",
      },
    },
  },
});

await envy.ui.run("With docker", async () => {
  if (!(await envy.docker.available(compose))) {
    envy.fail("Docker is not answering. Start Docker Desktop, then run this again.");
  }

  const cfg = await envy.load(schema, { cwd: here });

  await envy.ui.step("Writing config", async () => {
    await envy.write(
      join(here, ".env"),
      envy.env({
        Addresses: { BACKEND_URL: services.backend.host, S3_ENDPOINT: services.storage.host },
        Storage: cfg.env("storage"),
      }),
    );

    await envy.write(
      join(here, "backend", ".env"),
      envy.env({
        Addresses: { S3_ENDPOINT: services.storage.internal },
        Storage: cfg.env("storage"),
        Secrets: { SESSION_SEAL_KEY: cfg.get("backend.sealKey") },
      }),
    );
  });

  await envy.ui.step("Starting the stack", () =>
    // A fresh clone pulls images, so the first run is minutes rather than seconds. That is
    // why there is no default timeout: a ceiling that is wrong kills a setup that was
    // about to work.
    envy.docker.compose.up({ ...compose, timeout: 600_000 }),
  );

  await envy.ui.step("Waiting for the backend", () =>
    envy.wait.http(`${services.backend.host}/version`, {
      what: "the backend",
      timeout: 120_000,
    }),
  );

  await envy.ui.step("Generating the admin key", async () => {
    // Runs once. On the second run the value is already in config.yml and the container is
    // never asked again, which is what keeps the whole script idempotent.
    const key = await cfg.capture("backend.adminKey", () =>
      envy.docker.compose.exec("backend", "./generate_admin_key.sh", {
        ...compose,
        timeout: 60_000,
      }),
    );

    await envy.write(join(here, "backend", "admin.env"), envy.env({ Admin: { ADMIN_KEY: key } }));
  });

  envy.ui.ready(
    { backend: services.backend.host, storage: services.storage.host },
    { next: "pnpm dev" },
  );
});
