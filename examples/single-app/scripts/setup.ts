import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { envy } from "@rapture-sh/envy";

/**
 * The smallest useful setup: a schema, one `.env`, done.
 *
 *   pnpm example:single
 *
 * Nothing here is required and nothing has to be asked for, so this runs start to finish
 * on a machine that has never seen it, which is the point. Run it twice and the second run
 * writes nothing: the session key is kept, not rotated.
 */
const here = join(dirname(fileURLToPath(import.meta.url)), "..");

const schema = envy.defineConfig({
  app: {
    title: "The app",
    values: {
      name: { describe: "Shown in the page title.", default: "My app" },
      port: { describe: "What the dev server listens on.", default: "3000" },
    },
  },

  session: {
    title: "Session",
    values: {
      sealKey: {
        describe: "Seals the session cookie. Generated once and kept.",
        generate: { bytes: 32 },
      },
    },
  },

  analytics: {
    title: "Analytics",
    values: {
      projectToken: {
        describe: "Sends page views to your analytics project.",
        where: "your analytics dashboard, Settings, Project",
        example: "phc_",
        without: "analytics stays off",
      },
    },
  },
});

await envy.ui.run("Single app", async () => {
  const cfg = await envy.load(schema, { cwd: here });

  const port = cfg.get("app.port");

  await envy.ui.step("Writing .env", () =>
    envy.write(
      join(here, ".env"),
      envy.env({
        App: {
          APP_NAME: cfg.get("app.name"),
          APP_URL: `http://localhost:${port}`,
          PORT: port,
        },
        Session: cfg.env("session"),
        Analytics: cfg.env("analytics"),
      }),
    ),
  );

  envy.ui.ready({ app: `http://localhost:${port}` }, { next: "pnpm dev" });
});
