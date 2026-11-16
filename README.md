# @rapture-sh/envy

A toolchain for the setup script every repository ends up writing.

[![npm](https://img.shields.io/npm/v/@rapture-sh/envy.svg)](https://www.npmjs.com/package/@rapture-sh/envy)
[![license](https://img.shields.io/npm/l/@rapture-sh/envy.svg)](./LICENSE)

```bash
pnpm add -D @rapture-sh/envy
```

## The problem

Every repository with more than one moving part grows a `scripts/setup.mjs`. The last one
I measured was 727 lines, and about forty of them were about that repository. The rest was
plumbing: a config store rolled by hand, a prompt loop, `randomBytes` for a cookie secret,
two env file writers with their own header and grouping logic, a `parseEnv`, a `spawnSync`
wrapper with a Windows `.cmd` shim, an HTTP poller for "is the backend up yet", docker
compose calls, and a deploy.

Every repository writes that again, slightly differently, with its own bugs. And none of
it leaves a new colleague with a single file to fill in, because the values are spread
across generated `.env` files nobody is allowed to edit by hand.

envy is that plumbing, as a library. Your setup script stays a script you can read top to
bottom. It just gets to be sixty lines.

## How it works

Three things, in this order.

### 1. Declare what `config.yml` contains

One declaration. It describes the config file and nothing else: no services, no targets,
no profiles, no pipeline. Everything else in envy is a plain function you call.

```ts
import { envy } from "@rapture-sh/envy";

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

  session: {
    values: {
      sealKey: { generate: { bytes: 32 }, describe: "Seals the session cookie." },
    },
  },
});
```

That one declaration gives you five things:

- **`config.template.yml`**, written for you, committed, grouped and commented out of
  `title`, `note`, `describe` and `where`. This is the file a colleague copies.
- **The prompts.** `describe` says what the value is for, `where` says how to get it,
  `example` shows the shape, `without` says what they lose by skipping it, and `secret`
  masks the input. Somebody who has never seen the repository can answer every question
  without opening anything else.
- **The types.** `cfg.get("stripe.secretKey")` is `string` because it is required,
  `cfg.get("stripe.webhookSecret")` is `string | undefined`, and `cfg.get("stripe.typo")`
  does not compile.
- **The env names.** `env:` where the name deviates, section and key in screaming snake
  where it does not, so `cfg.env("stripe")` is
  `{ STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET }`.
- **Validation.** On load, envy tells you which required values are missing or still hold
  the example out of the template.

`config.yml` itself stays human, grouped by thing, and gitignored:

```yaml
stripe:
  secret-key: sk_test_51Ab...
  webhook-secret: whsec_...

session:
  seal-key: UqN0d...
```

### 2. Load it

```ts
const cfg = await envy.load(schema, { file: "config.yml", template: "config.template.yml" });
```

There is no `ask()` in your script, because asking is not a step. `load` reads
`config.yml`, works out what the schema says should be there and is not, and asks only for
that. Everything already answered is silent, so the second run asks nothing.

`{ ask: "missing" | "all" | "never" }` covers the rest. `"all"` is how somebody changes a
key they already gave, `"never"` is CI. Without a TTY it never asks whatever the setting
says: it reports what is unanswered and carries on with what it has, so the same script
runs in a pipeline.

### 3. Compose the rest out of plain functions

```js
#!/usr/bin/env node
import { envy } from "@rapture-sh/envy";

await envy.ui.run("Bootstrap", async () => {
  const cfg = await envy.load(schema);

  const api = "http://127.0.0.1:8080";
  const s3 = { host: "http://127.0.0.1:9090", internal: "http://s3mock:9090" };

  await envy.ui.step("Writing config", async () => {
    await envy.write(".env", envy.env({
      Addresses: { NEXT_PUBLIC_API_URL: api, S3_ENDPOINT: s3.host },
      Stripe: cfg.env("stripe"),
    }));

    await envy.write("backend/.env", envy.env({
      Addresses: { S3_ENDPOINT: s3.internal },
      Secrets: { SECRET_SEAL_KEY: cfg.get("session.sealKey") },
    }));

    await envy.write("apps/web/config.yml", await envy.yaml({ storage: cfg.section("storage") }));
  });

  await envy.ui.step("Installing", () => envy.cmd("pnpm install"));
  await envy.ui.step("Starting the stack", () => envy.docker.compose.up());
  await envy.ui.step("Waiting for the backend", () =>
    envy.wait.http(`${api}/version`, { timeout: 120_000 }));

  await cfg.capture("backend.adminKey", () =>
    envy.docker.compose.exec("backend", "./generate_admin_key.sh"));

  envy.ui.ready({ app: "http://localhost:3000", backend: api });
});
```

`envy.write` is the only thing that touches disk, and a format is just a function that
returns a string. `envy.env(...)`, `envy.yaml(...)`, `envy.json(...)` render; `write`
writes. If you need a Caddyfile, an nginx conf or a `.tfvars`, pass your own function and
you lose nothing:

```js
await envy.write("Caddyfile", renderCaddyfile(cfg));
```

A profile is a variable. `const port = e2e ? 8180 : 8080`. envy has no opinion about it.

## One import

```js
import { envy } from "@rapture-sh/envy";
```

`envy` is the whole surface and the only runtime export. Type `envy.` and your editor
lists the toolchain. Types come out separately, since they are not reachable through a
value:

```ts
import type { Config, Loaded, Section } from "@rapture-sh/envy";
```

## The pieces

| | |
| --- | --- |
| `envy.defineConfig(schema)` | describe `config.yml`: sections, values, prompts, env names |
| `envy.load(schema, options)` | read it, ask for the gap, write it back, return it typed |
| `cfg.get("section.value")` | one value, typed from the schema |
| `cfg.has("section.value")` | whether it actually has something in it |
| `cfg.section("name")` | a whole section, typed |
| `cfg.env("name", options)` | a section as env names, with `prefix` and per-value overrides |
| `cfg.capture("path", fn)` | run something that prints a value, keep it, skip it next time |
| `cfg.missing()` | every required value that is still empty |
| `envy.write(path, content, options)` | the only writer. idempotent, warns before replacing a file it did not write |
| `envy.env(groups, options)` | render a dotenv file, with groups and comments |
| `envy.yaml(value, options)` | render YAML. async, because the `yaml` peer is loaded when it is needed |
| `envy.json(value)` `envy.text(body, options)` | render the other shapes |
| `envy.parseEnv(text)` | read an existing env file back |
| `envy.cmd(command, options)` | spawn, never through a shell |
| `envy.wait.http(url, options)` | poll until it answers |
| `envy.wait.port(port, options)` | poll until something is listening |
| `envy.docker.available()` | whether docker is answering at all |
| `envy.docker.compose` | `up`, `down`, `exec`, `logs`, `ps` |
| `envy.convex` | `push` an env file into a deployment, `deploy`, `run`, `set`, `list` |
| `envy.ui` | `run`, `step`, `ready`, `note`, `warn`, and the colours |
| `envy.fail(message)` | stop with a message the person running this is meant to read |
| `envy.defaults(options)` | a `timeout` and a `warn` setting for the whole script |

## Timeouts

Anything that can wait forever takes an optional `timeout` in milliseconds. **Nothing has
a default.** envy does not know whether `pnpm install` on your machine takes four seconds
or four minutes, and a wrong default kills a working setup halfway through:

```js
await envy.cmd("pnpm install");                               // as long as it takes
await envy.wait.http(`${api}/version`, { timeout: 120_000 }); // give up after two minutes
```

`envy.defaults({ timeout: 60_000 })` sets a ceiling for a whole script, and any call
overrides it. A timeout kills the child and tells you what timed out, how long it waited
and where to look.

## Warnings

envy warns rather than fails for things that are a footgun but not an error. The one that
matters most: if your root `.gitignore` does not cover `config.yml`, it says so, because
that file holds secrets and is one `git add .` away from being public.

Also warned: a value still holding the example out of the template, a required value left
unanswered, and a generated file that was hand edited since envy last wrote it.

All of it is silenceable, per call, per run, or from the environment:

```js
await envy.ui.run("Bootstrap", main, { warn: false });
```

```bash
ENVY_NO_WARN=1 pnpm setup
```

## What envy promises

1. **Idempotent.** Run it twice and nothing changes. A generated value is never rotated, a
   captured value is never captured twice, a written file is byte identical.
2. **Asking is a consequence, never a step.** If `config.yml` answers it, nobody is asked.
3. **It never hangs.** No TTY means no question, whatever the setting says.
4. **Nothing secret is printed.** A prompt echoes a truncated hint of a value you already
   gave and nothing else. No value reaches a log line, an error message or a stack.
5. **`write` is the only thing that touches disk**, and everything it writes says it is
   generated.
6. **Nothing goes through a shell.** A single string splits on whitespace and spawns
   directly; pass an array when an argument has a space in it. No quoting bugs on Windows,
   and no way for a value out of `config.yml` to become a command.

## Examples

Runnable, in [`examples/`](./examples):

| | |
| --- | --- |
| [`single-app`](./examples/single-app) | the smallest useful setup: a schema, one `.env`, done |
| [`monorepo`](./examples/monorepo) | a section per app, each app getting its own file |
| [`two-addresses`](./examples/two-addresses) | one service reached from the host and from inside compose |
| [`custom-format`](./examples/custom-format) | `write()` with a renderer of your own |
| [`with-docker`](./examples/with-docker) | compose up, wait, exec, capture what a container prints |
| [`with-convex`](./examples/with-convex) | push an env file into a deployment and deploy |

## Requirements

Node 22 or newer, ESM only. `yaml` is an optional peer dependency, needed only if you use
the YAML store or the YAML format, which the default setup does.

## Contributing

[`CONTRIBUTING.md`](./CONTRIBUTING.md) has the workflow, and
[`AGENTS.md`](./AGENTS.md) is the real contract: the guarantees, the layout and the
conventions this repository holds itself to.

## License

MIT. Part of [Rapture.sh](https://rapture.sh).
