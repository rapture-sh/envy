import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { envy } from "@rapture-sh/envy";

/**
 * Check what the machine needs before asking anybody for anything.
 *
 *   pnpm example:prereq
 *
 * Every check runs, including the ones after a failure, and the report lists all of them
 * at once. That ordering is the whole point: a setup that stops at the first missing tool
 * sends somebody off to install it, only to meet the next one on the next run.
 *
 * Checks come first in this script for the same reason. There is no sense asking for a
 * Stripe key and generating a session secret if the stack cannot start afterwards.
 */
const here = join(dirname(fileURLToPath(import.meta.url)), "..");

const schema = envy.defineConfig({
  app: {
    title: "App",
    values: {
      port: { default: "3000" },
    },
  },

  session: {
    values: {
      sealKey: { describe: "Seals the session cookie.", generate: { bytes: 32 } },
    },
  },
});

await envy.ui.run("With prerequisites", async () => {
  await envy.check([
    {
      name: "Node",
      run: "node --version",
      version: ">=22",
      fix: "nodejs.org, or `nvm install 22` if you keep several around",
    },
    {
      name: "pnpm",
      run: "pnpm --version",
      version: ">=10",
      fix: "corepack enable, then corepack prepare pnpm@latest --activate",
    },
    {
      // Optional, so a machine without docker still gets a working .env out of this run.
      // It is reported either way, which is the difference between "not installed" and
      // "nobody told me".
      name: "Docker",
      run: "docker info",
      optional: true,
      timeout: 10_000,
      fix: "Start Docker Desktop. Without it, run the app against a hosted database.",
    },
  ]);

  const cfg = await envy.load(schema, { cwd: here });

  await envy.ui.step("Writing .env", () =>
    envy.write(
      join(here, ".env"),
      envy.env({
        App: { PORT: cfg.get("app.port") },
        Session: { SESSION_SEAL_KEY: cfg.get("session.sealKey") },
      }),
    ),
  );

  envy.ui.ready({ app: `http://localhost:${cfg.get("app.port")}` }, { next: "pnpm dev" });
});
