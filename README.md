# @rapture-sh/envy

One `config.yml` at the root of your TypeScript monorepo, and a short script that turns it
into every `.env` your apps actually read.

```bash
pnpm add -D @rapture-sh/envy
```

## Why

Environment config in a monorepo is miserable to share. The web app needs a `.env`, the
admin app needs a different one, the API needs both plus the secrets neither of them should
ever see, and compose needs a fourth at the root. Onboarding somebody means pasting four
files into a DM and hoping none of them have gone stale. Add an app and you are editing all
of them again.

envy puts one file at the root instead. A new colleague copies `config.template.yml` to
`config.yml`, fills in the blanks, runs `pnpm setup`, and every generated file downstream
comes out of that. The keys are declared once, in TypeScript, so `cfg.get` and `cfg.env`
are typed off the declaration and a rename is a compile error instead of a blank in a file
somebody finds in production.

It is a library, not a framework. There is no pipeline, no step registry and no config
format your repository has to reshape itself around. You write a `scripts/setup.ts` and
call the functions you need.

## Contents

- [Install](#install)
- [A setup script, start to finish](#a-setup-script-start-to-finish)
- [Declaring the config](#declaring-the-config)
- [Loading it](#loading-it)
- [Writing the files your apps read](#writing-the-files-your-apps-read)
- [Running commands](#running-commands)
- [Waiting for a service](#waiting-for-a-service)
- [Capturing a value something prints](#capturing-a-value-something-prints)
- [Adapters](#adapters)
- [What the compiler catches](#what-the-compiler-catches)
- [Guarantees](#guarantees)
- [Timeouts](#timeouts)
- [Warnings](#warnings)
- [API](#api)
- [Examples](#examples)
- [Requirements](#requirements)
- [Contributing](#contributing)
- [License](#license)

## Install

```bash
pnpm add -D @rapture-sh/envy
```

```bash
npm install --save-dev @rapture-sh/envy
```

One import reaches everything:

```ts
import { envy } from "@rapture-sh/envy";
```

`envy` is the only runtime export. Type `envy.` and your editor lists the toolchain.

## A setup script, start to finish

This is a whole `scripts/setup.ts` for a repository with a web app, an API and compose.
Point `"setup": "tsx scripts/setup.ts"` at it and `pnpm setup` is the one command a new
colleague runs.

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
    },
  },

  session: {
    values: {
      sealKey: { generate: { bytes: 32 }, describe: "Seals the session cookie." },
    },
  },
});

await envy.ui.run("Setup", async () => {
  const cfg = await envy.load(schema);

  const api = "http://127.0.0.1:8080";

  await envy.ui.step("Writing env files", async () => {
    // Only what reaches the browser.
    await envy.write(
      "apps/web/.env",
      envy.env({ Addresses: { NEXT_PUBLIC_API_URL: api } }),
    );

    // The API gets the secrets, and nothing that ships to a browser does.
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
```

Run it twice and the second run asks nothing, rotates nothing and rewrites nothing. Run it
in CI, where there is no terminal, and it reports what is unanswered and carries on rather
than waiting for a keypress that is never coming.

## Declaring the config

`defineConfig` describes `config.yml` and nothing else. No services, no targets, no
profiles.

```ts
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

  "web-client-1": {
    title: "Web client",
    values: {
      clientId: { required: true, where: "your identity provider's console" },
      redirectUri: { default: "http://localhost:3000/callback" },
    },
  },

  session: {
    values: {
      sealKey: { generate: { bytes: 32 }, describe: "Seals the session cookie." },
    },
  },
});
```

Each field is there for somebody filling the file in for the first time:

| On a value | What it does |
| --- | --- |
| `describe` | what the value is for, shown above the prompt |
| `where` | how to get one, shown under it |
| `example` | the shape, shown in the prompt and written into the template |
| `without` | what stops working if it is skipped, shown for optional values |
| `secret` | masks it while typing and keeps it out of everything printed |
| `required` | reported by `load` when it is still empty |
| `default` | used when the answer is empty |
| `generate` | produced once by envy and kept, never asked for |
| `env` | the env name, where the convention is not what you want |

You get four things out of it.

**`config.template.yml`**, written for you and committed. This is the file your colleague
copies. It carries `example` values and never an answer, so it is safe to commit.

**The prompts**, built from `describe`, `where`, `example` and `without`. Somebody who has
never seen the repository can answer them without opening anything else.

**The types.** `cfg.get("stripe.secretKey")` is `string` because it is required,
`cfg.get("stripe.webhookSecret")` is `string | undefined`, and `cfg.get("stripe.typo")`
does not compile.

**The env names.** `env:` where you override it, section and value in screaming snake where
you do not, so `cfg.env("stripe")` gives `{ STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET }`,
typed.

`config.yml` stays readable, grouped by thing, and gitignored:

```yaml
stripe:
  secret-key: sk_test_51Ab...
  webhook-secret: whsec_...

web-client-1:
  client-id: abc
  redirect-uri: http://localhost:3000/callback

session:
  seal-key: UqN0d...
```

## Loading it

```ts
const cfg = await envy.load(schema);
```

That reads `config.yml`, works out what the schema says should be there and is not, asks
for the gap, generates the declared values, writes the file and template back, and returns
everything typed.

```ts
const cfg = await envy.load(schema, {
  cwd: here,                          // what relative paths resolve against
  file: "config.yml",
  template: "config.template.yml",    // or false for none
  ask: "missing",                     // "missing" | "all" | "never"
});
```

There is no `ask()` in your script. Asking is what happens when a value is missing, so the
second run is silent. `"all"` is for a `--reconfigure` flag, `"never"` is for CI.

Without a terminal it never asks, whatever `ask` says. It prints what is unanswered and
returns, so the same script works on a laptop and in a pipeline.

## Writing the files your apps read

`envy.write` is the only thing that touches disk. Formats are functions that return a
string: `envy.env`, `envy.yaml`, `envy.json`, `envy.text`, or your own.

```ts
await envy.write(
  "apps/web/.env",
  envy.env({
    Addresses: { NEXT_PUBLIC_API_URL: api },
    Stripe: cfg.env("stripe"),
    Auth: cfg.env("web-client-1", { prefix: "AUTH" }),
  }),
);
```

```ini
# Generated by envy. Run the setup again rather than editing this file.

# Addresses
NEXT_PUBLIC_API_URL=http://127.0.0.1:8080

# Stripe
STRIPE_SECRET_KEY=sk_test_51Ab...
STRIPE_WEBHOOK_SECRET=whsec_...

# Auth
AUTH_CLIENT_ID=abc
AUTH_REDIRECT_URI=http://localhost:3000/callback
```

`prefix` stands in for the section name, so a section called `web-client-1` can still
write `AUTH_CLIENT_ID`. A value with its own `env` name keeps it either way.

A group becomes a comment and a block. `undefined` values are left out, empty strings are
written, and values are quoted only where leaving them bare would change them.

`write` skips the write when the file already holds those exact bytes, adds the generated
header, and warns before replacing a file that does not have one, so it will not silently
eat a `.env` somebody wrote by hand.

Your own renderer works the same way:

```ts
await envy.write("Caddyfile", renderCaddyfile(cfg));
await envy.write("apps/web/config.yml", await envy.yaml({ storage: cfg.section("storage") }));
```

`envy.yaml` is async because the `yaml` peer is loaded on first use. The others are sync.
`envy.parseEnv(text)` reads a file back.

## Running commands

```ts
await envy.cmd("pnpm install");
await envy.cmd(["pnpm", "exec", "convex", "dev", "--once"]);
```

Nothing goes through a shell. A string splits on whitespace and spawns directly, and an
array is passed as it is, so pass an array when an argument has a space in it. That also
means nothing out of `config.yml` can turn into a command or a redirect.

On Windows, `pnpm` and `npx` on `PATH` are `.cmd` shims, which Node refuses to spawn since
the batch argument injection fix. envy escapes every argument and hands `cmd.exe` one
verbatim command line, which is the only place `cmd.exe` is involved.

Failures name the program and the exit code, never the arguments, since an argument is
sometimes a credential. `redact` blanks values out of captured output too:

```ts
await envy.cmd(["convex", "env", "set", "SEAL_KEY", seal], { redact: [seal] });
```

## Waiting for a service

```ts
await envy.wait.http(`${api}/health`, { what: "the API", timeout: 120_000 });
await envy.wait.port(5432, { what: "postgres", timeout: 60_000 });
```

`what` is the name used in the failure, so a timeout tells you which thing never came up.

## Capturing a value something prints

Some values do not exist until the stack is running, like a key a container prints on first
boot. Those stay in your script:

```ts
const adminKey = await cfg.capture("backend.adminKey", () =>
  envy.docker.compose.exec("backend", "./generate_admin_key.sh"),
);
```

It runs once. On the second run the value is already in `config.yml` and the function is
not called.

## Adapters

An adapter wraps an external CLI. Each one goes through `envy.cmd`, so it inherits the
timeout, the Windows handling and the no-shell rule.

```ts
if (!(await envy.docker.available())) {
  envy.fail("Docker is not answering. Start Docker Desktop, then run this again.");
}

await envy.docker.compose.up({ file: "docker-compose.yml", timeout: 600_000 });
await envy.docker.compose.exec("backend", "./seed.sh");
await envy.docker.compose.logs("backend", { tail: 50 });
await envy.docker.compose.down();
```

```ts
await envy.convex.push("backend/.env");   // one env set per name in the file
await envy.convex.deploy();
await envy.convex.run("seed:all");
```

Failures say what to look at rather than dumping stderr at you.

## What the compiler catches

Every line below fails to compile, and each one is a test in `tests/types/`.

```ts
cfg.get("stripe.secret");
//       ~~~~~~~~~~~~~~  stripe has no value called `secret`

cfg.get("stripe.clientId");
//       ~~~~~~~~~~~~~~~~  `clientId` is on web-client-1, not on stripe

cfg.get("stripe.secret-key");
//       ~~~~~~~~~~~~~~~~~~  the schema spelling is `secretKey`

cfg.get("stripe");
//       ~~~~~~~  a path is a section and a value

cfg.section("storage");
//           ~~~~~~~~~  there is no `storage` section

cfg.capture("stripe.nope", run);
//           ~~~~~~~~~~~~  there is no such value

envy.defineConfig({ stripe: { title: "Stripe" } });
//                            ~~~~~~~~~~~~~~~~  a section must declare `values`
```

And what the inference gives you:

```ts
cfg.get("stripe.secretKey");            // string, it is required
cfg.get("stripe.webhookSecret");        // string | undefined
cfg.get("session.sealKey");             // string, envy generates it
cfg.get("web-client-1.redirectUri");    // string, it has a default

cfg.env("stripe");          // { STRIPE_SECRET_KEY?: string, STRIPE_WEBHOOK_SECRET?: string }
cfg.env("web-client-1");    // { WEB_CLIENT_1_CLIENT_ID?: string, ... }

cfg.env("web-client-1", { prefix: "AUTH" });   // { AUTH_CLIENT_ID?: string, ... }
```

A value is `string` rather than `string | undefined` when the schema makes it certain:
`required`, a `default`, or `generate`. `cfg.env` is the exception: it is shaped for
spreading into a file, so every name on it is optional.

## Guarantees

- **Running it twice changes nothing.** Generated values are not rotated, captured values
  are not captured again, written files come out byte identical.
- **It never hangs.** No terminal means no prompt, whatever `ask` is set to.
- **Nothing secret is printed.** No value from `config.yml`, generated or captured, reaches
  stdout, an error message, a stack or the committed template. A prompt for a value you
  already gave shows a short truncated hint and nothing more.
- **`write` is the only thing that touches disk**, and everything it writes says it was
  generated.
- **Nothing goes through a shell**, apart from the Windows `.cmd` handling above, which
  escapes every argument.
- **Names exist once.** `cfg.get`, `cfg.section`, `cfg.env` and the template all read the
  same declaration.

## Timeouts

Anything that can wait forever takes an optional `timeout` in milliseconds, and nothing has
a default. envy has no idea whether `pnpm install` takes four seconds or four minutes here,
and a wrong ceiling kills a setup that was about to work.

```ts
await envy.cmd("pnpm install");                                // as long as it takes
await envy.wait.http(`${api}/health`, { timeout: 120_000 });   // give up after two minutes
```

`envy.defaults({ timeout: 60_000 })` sets one for a whole script, and any call overrides it.

## Warnings

envy warns for things that are a footgun but not an error. The main one: if your root
`.gitignore` does not cover `config.yml`, it says so, because that file holds secrets and is
one `git add .` from being public.

Also warned: a value still holding the example from the template, a required value left
empty, and a generated file edited by hand since envy wrote it.

All of it can be turned off, per call, per run, or from the environment:

```ts
await envy.write(path, content, { warn: false });
await envy.ui.run("Setup", main, { warn: false });
```

```bash
ENVY_NO_WARN=1 pnpm setup
```

## API

| | |
| --- | --- |
| `envy.defineConfig(schema)` | describe `config.yml`: sections, values, prompts, env names |
| `envy.load(schema, options)` | read it, ask for the gap, write it back, return it typed |
| `cfg.get("section.value")` | one value, typed |
| `cfg.has("section.value")` | whether it has something in it |
| `cfg.section("name")` | a whole section, typed |
| `cfg.env("name", options)` | a section as env names. `prefix` stands in for the section |
| `cfg.capture("path", fn)` | run something that prints a value, keep it, skip it next time |
| `cfg.missing()` | required values that are still empty |
| `cfg.all()` | everything, typed |
| `envy.write(path, content, options)` | the only writer, idempotent |
| `envy.env(input, options)` | render a dotenv file with groups and comments |
| `envy.yaml(value, options)` | render YAML, async |
| `envy.json(value)` `envy.text(body, options)` | render the other shapes |
| `envy.parseEnv(text)` | read an env file back |
| `envy.cmd(command, options)` | spawn, never through a shell |
| `envy.wait.http(url, options)` | poll until it answers |
| `envy.wait.port(port, options)` | poll until something is listening |
| `envy.docker.available()` | whether docker is answering |
| `envy.docker.compose` | `up`, `down`, `exec`, `logs`, `ps` |
| `envy.convex` | `push`, `deploy`, `run`, `set`, `list` |
| `envy.ui` | `run`, `step`, `ready`, `note`, `warn`, colours |
| `envy.fail(message)` | stop with a message meant to be read |
| `envy.defaults(options)` | `timeout` and `warn` for a whole script |

`ui.run` frames the script with a header, a total time and a clean failure instead of a
stack trace. `ui.step` prints a spinner then a tick with the elapsed time. `ui.ready` is the
closing block of addresses and the command to run next. It respects `NO_COLOR` and drops to
plain lines without a terminal, so CI logs stay readable.

## Examples

Each one is a small fake repository showing one thing, in [`examples/`](./examples). The
four that need nothing running are run in CI.

| Example | What it shows |
| --- | --- |
| [`single-app`](./examples/single-app) | the smallest useful setup: a schema, one `.env` |
| [`monorepo`](./examples/monorepo) | a section per app, each app getting its own file |
| [`two-addresses`](./examples/two-addresses) | one service reached from the host and from inside compose |
| [`custom-format`](./examples/custom-format) | `write()` with your own renderer |
| [`with-docker`](./examples/with-docker) | compose up, wait, exec, capture what a container prints |
| [`with-convex`](./examples/with-convex) | push an env file into a deployment and deploy |

```bash
pnpm examples
```

## Requirements

Node 22 or newer, ESM only, no runtime dependencies. `yaml` is an optional peer, needed
only for the YAML store and the YAML format. Works on Linux, macOS and Windows.

## Contributing

A new adapter is the most useful thing to add and the most contained: wrap `envy.cmd`, take
an optional `timeout`, map the CLI's failures onto something readable, and test it against a
stubbed `cmd`. Supabase, Terraform, Prisma, Vercel and Fly are all missing.

[`CONTRIBUTING.md`](./CONTRIBUTING.md) has the workflow and [`AGENTS.md`](./AGENTS.md) has
the conventions.

```bash
pnpm install
pnpm check
```

## License

MIT. See [LICENSE](LICENSE). Part of [Rapture.sh](https://rapture.sh).
