import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { envy } from "@rapture-sh/envy";

/**
 * Push an env file into a deployment, then deploy.
 *
 *   pnpm tsx examples/with-convex/scripts/setup.ts
 *
 * Not in `pnpm examples`, because it needs a real deployment. It is here to be read, and
 * it typechecks with everything else, so it cannot rot quietly.
 *
 * The problem it shows: a backend deployment cannot see the repository's files. Anything
 * running inside it has to be told, one value at a time, and the file it is told from is a
 * second env file with the same names and different addresses. That second file is where a
 * hand written setup usually starts repeating itself.
 */
const here = join(dirname(fileURLToPath(import.meta.url)), "..");
const cli = { cwd: here, timeout: 120_000 };

const schema = envy.defineConfig({
  app: {
    title: "The app",
    values: {
      url: { describe: "Where the browser reaches the app.", default: "http://localhost:3000" },
    },
  },

  mail: {
    title: "Mail",
    values: {
      apiKey: {
        env: "RESEND_API_KEY",
        describe: "Sends the sign-in letters. Only the backend uses it.",
        where: "resend.com/api-keys",
        example: "re_",
        secret: true,
      },
      from: { describe: "Who the letters come from.", default: "auth@example.test" },
    },
  },

  session: {
    title: "Session",
    values: {
      sealKey: { describe: "Only the backend ever sees this.", generate: { bytes: 32 } },
    },
  },
});

await envy.ui.run("With convex", async () => {
  const cfg = await envy.load(schema, { cwd: here });

  const backendEnv = join(here, "convex", ".env");

  await envy.ui.step("Writing config", async () => {
    // What the browser and the CLI read.
    await envy.write(
      join(here, ".env"),
      envy.env({
        App: { NEXT_PUBLIC_APP_URL: cfg.get("app.url") },
      }),
    );

    // What runs inside the deployment, which cannot see the file above. Every secret lives
    // here and nowhere else.
    await envy.write(
      backendEnv,
      envy.env({
        App: { APP_URL: cfg.get("app.url") },
        Mail: cfg.env("mail"),
        Session: cfg.env("session"),
      }),
    );
  });

  await envy.ui.step("Pushing the backend env", async () => {
    const pushed = await envy.convex.push(backendEnv, cli);

    // The names, never the values. Printing what was pushed is useful; printing what is in
    // it would put every secret in a CI log.
    envy.ui.note(`  ${pushed.length} values: ${pushed.join(", ")}`);
  });

  await envy.ui.step("Deploying the functions", () => envy.convex.deploy(cli));

  await envy.ui.step("Minting a signing key if there is none", () =>
    // Idempotent on the deployment's side, so running the setup again is a query rather
    // than a second key.
    envy.convex.run("keys:rotate", {}, { ...cli, component: "auth" }),
  );

  envy.ui.ready({ app: cfg.get("app.url") }, { next: "pnpm dev" });
});
