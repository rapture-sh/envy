import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { envy } from "@rapturedotsh/envy";

/**
 * One service, reached from the host and from inside compose.
 *
 *   pnpm example:addresses
 *
 * This is the duplication that bites hardest in a setup script. The same storage service
 * is `127.0.0.1:9090` to the app running on your machine and `s3mock:9090` to anything
 * inside the compose network, and a hand written script ends up with two tables of
 * addresses that drift apart silently.
 *
 * envy has no opinion about services, so this is just a variable with two fields and a
 * `.env` per side. The point of the example is that you can see both, next to each other,
 * in the file that writes them.
 */
const here = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * `host` is where your machine reaches it, `internal` is where a container does. A profile
 * is a variable too: `PORT_OFFSET=100 pnpm example:addresses` moves the host side out of
 * the way of a stack that is already up, and the container side does not move, because
 * inside the network nothing collided in the first place.
 */
const offset = Number(process.env.PORT_OFFSET ?? 0);

const services = {
  storage: { host: `http://127.0.0.1:${9090 + offset}`, internal: "http://s3mock:9090" },
  search: { host: `http://127.0.0.1:${9200 + offset}`, internal: "http://opensearch:9200" },
  backend: { host: `http://127.0.0.1:${8080 + offset}`, internal: "http://backend:3210" },
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
      sealKey: { describe: "Only the backend ever sees this.", generate: { bytes: 32 } },
    },
  },
});

await envy.ui.run("Two addresses", async () => {
  const cfg = await envy.load(schema, { cwd: here });

  await envy.ui.step("Writing both sides", async () => {
    // What runs on your machine.
    await envy.write(
      join(here, ".env"),
      envy.env(
        {
          Addresses: {
            BACKEND_URL: services.backend.host,
            S3_ENDPOINT: services.storage.host,
            SEARCH_URL: services.search.host,
          },
          Storage: cfg.env("storage"),
        },
        {
          header: [
            "Read by the app running on this machine.",
            "Every address here is the published one.",
          ],
        },
      ),
    );

    // What runs inside the compose network, which cannot see the file above.
    await envy.write(
      join(here, "backend", ".env"),
      envy.env(
        {
          Addresses: {
            S3_ENDPOINT: services.storage.internal,
            SEARCH_URL: services.search.internal,
          },
          Storage: cfg.env("storage"),
          Secrets: cfg.env("backend"),
        },
        {
          header: [
            "Read inside the compose network.",
            "The same services, resolved by service name rather than by published port.",
          ],
        },
      ),
    );
  });

  envy.ui.ready(
    { backend: services.backend.host, storage: services.storage.host },
    { next: "docker compose up -d" },
  );
});
