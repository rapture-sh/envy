import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { envy } from "@rapturedotsh/envy";

/**
 * `write()` with a renderer of your own.
 *
 *   pnpm example:custom
 *
 * `envy.env`, `envy.yaml` and `envy.json` are functions that take a value and return a
 * string. There is nothing else to them, which means a format envy has never heard of is
 * a function you write in your own script and pass to the same `write`. Here that is a
 * Caddyfile.
 *
 * `envy.text` puts the generated header on it, so the file says not to edit it by hand the
 * same way every other generated file does.
 */
const here = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = (name: string): string => join(here, "generated", name);

const schema = envy.defineConfig({
  site: {
    title: "The site",
    values: {
      domain: { describe: "What the proxy answers on.", default: "app.localhost" },
      upstream: { describe: "Where it sends the traffic.", default: "127.0.0.1:3000" },
      email: { describe: "For the certificate.", default: "dev@example.test" },
    },
  },

  storage: {
    title: "Storage",
    values: {
      bucket: { default: "uploads" },
      region: { default: "us-east-1" },
    },
  },
});

type Site = { domain: string; upstream: string; email: string };

/** A renderer of your own is a function that returns a string. That is the whole contract. */
function caddyfile(site: Site): string {
  return [
    `{`,
    `  email ${site.email}`,
    `}`,
    ``,
    `${site.domain} {`,
    `  encode gzip`,
    `  reverse_proxy ${site.upstream}`,
    `}`,
  ].join("\n");
}

await envy.ui.run("Custom format", async () => {
  const cfg = await envy.load(schema, { cwd: here });

  const site = cfg.section("site");

  await envy.ui.step("Writing the proxy config", () =>
    envy.write(out("Caddyfile"), envy.text(caddyfile(site))),
  );

  await envy.ui.step("Writing the app config", async () => {
    // Shipped formats, for comparison. Same `write`, same header, same idempotence.
    await envy.write(out("app.yml"), await envy.yaml({ site, storage: cfg.section("storage") }));

    await envy.write(out("app.json"), envy.json({ site }));
  });

  envy.ui.ready({ site: `https://${site.domain}` }, { next: "caddy run" });
});
