@rapture-sh/envy
================

A toolchain for the one setup script every repository ends up writing. Declare what
`config.yml` holds, and envy writes the template a new colleague copies, asks only for the
values that are actually missing, generates the secrets, and renders every `.env`, YAML and
hand-rolled config file your apps read. Typed off that one declaration, byte identical on
the second run, and it never hangs in CI.

It is primitives rather than a framework: a library of functions your `scripts/setup.ts`
calls in whatever order suits it. No pipeline, no step registry, no lifecycle, and no
config format your repository has to restructure itself around.

```bash
pnpm add -D @rapture-sh/envy
```


The problem
-----------

Every repository with more than one moving part grows a setup script, and three things go
wrong with it every time.

**There is nothing to hand a new colleague.** The values end up spread across generated
`.env` files nobody is allowed to edit by hand, so onboarding is somebody reading a script
to work out which keys they need and where each one comes from. The same key is spelled out
in four places and drifts in three of them.

**It is almost all plumbing.** The last one we pulled apart was 727 lines, and about forty
of them were about that repository. The rest was a config store rolled by hand, a prompt
loop, `randomBytes` for a cookie secret, two env writers with their own header and grouping
logic, a `parseEnv`, a `spawnSync` wrapper with a Windows `.cmd` shim, an HTTP poller for
"is the backend up yet", docker compose calls and a deploy. Every repository writes that
again, slightly differently, with its own bugs.

**Nothing is typed, and nothing is safe to run twice.** The section is a string, the value
is a string, and the env name is a third string typed out by hand, so a rename leaves a
blank in a file somebody finds in production. Then a second run rotates the cookie secret
and signs everybody out, or asks nine questions that were answered last week, and the
script becomes something people run once and afterwards avoid.

envy is that plumbing, as a library, with the first and third problems treated as
guarantees rather than good intentions. Your setup script stays a script you can read top
to bottom. It just gets to be sixty lines.


What you get
------------

- **One file to hand over.** `config.template.yml` is written for you, grouped and
  commented out of the declaration, and committed. A colleague copies it to `config.yml`
  and fills in the blanks.
- **Prompts somebody can actually answer.** Each value carries what it is for, where to get
  it, the shape it has, and what stops working without it. A `secret` value is masked as it
  is typed.
- **Asking only for the gap.** There is no `ask()` in your script, because asking is not a
  step. `load` works out what the schema says should be there and is not, and asks for
  exactly that. The second run asks nothing at all.
- **Types off that one declaration.** A required value is `string`, an optional one is
  `string | undefined`, and a typo in a section, a value or an env name is a compile error.
- **Idempotence as a tested guarantee.** A generated value is never rotated, a captured
  value is never captured twice, a written file is byte identical.
- **Nothing secret printed, and nothing through a shell.** Both are tested, because both
  are the kind of thing that breaks quietly.
- **No runtime dependencies.** `yaml` is an optional peer, needed only for YAML.


Contents
--------

- [Install](#install)
- [The whole script](#the-whole-script)
- [1. Declare what config.yml holds](#1-declare-what-configyml-holds)
- [2. Load it](#2-load-it)
- [3. Write what your apps read](#3-write-what-your-apps-read)
- [Running commands](#running-commands)
- [Waiting for something to come up](#waiting-for-something-to-come-up)
- [Capturing a value something prints](#capturing-a-value-something-prints)
- [Adapters](#adapters)
- [What the compiler catches](#what-the-compiler-catches)
- [What envy guarantees](#what-envy-guarantees)
- [Timeouts](#timeouts)
- [Warnings](#warnings)
- [The pieces](#the-pieces)
- [Examples](#examples)
- [Compatibility](#compatibility)
- [Not in scope](#not-in-scope)
- [Where it came from](#where-it-came-from)
- [Extending it](#extending-it)
- [License](#license)


Install
-------

```bash
pnpm add -D @rapture-sh/envy
```

```bash
npm install --save-dev @rapture-sh/envy
```

Node 22 or newer, ESM only. One import line reaches everything:

```ts
import { envy } from "@rapture-sh/envy";
```

`envy` is the whole surface and the only runtime export. Type `envy.` and your editor lists
the toolchain. There are no subpaths and no second set of loose named exports beside it, so
there is exactly one way to reach everything and nothing to drift.


The whole script
----------------

This is the shape, end to end, before any of it is explained. One declaration, one `load`,
and then plain functions in the order this repository happens to need them.

```ts
#!/usr/bin/env node
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

await envy.ui.run("Bootstrap", async () => {
  const cfg = await envy.load(schema);

  const api = "http://127.0.0.1:8080";

  await envy.ui.step("Writing config", async () => {
    await envy.write(
      ".env",
      envy.env({
        Addresses: { NEXT_PUBLIC_API_URL: api },
        Stripe: cfg.env("stripe"),
        Secrets: { SESSION_SEAL_KEY: cfg.get("session.sealKey") },
      }),
    );
  });

  await envy.ui.step("Installing", () => envy.cmd("pnpm install"));
  await envy.ui.step("Starting the stack", () => envy.docker.compose.up());
  await envy.ui.step("Waiting for the backend", () =>
    envy.wait.http(`${api}/version`, { timeout: 120_000 }),
  );

  envy.ui.ready({ app: "http://localhost:3000", backend: api }, { next: "pnpm dev" });
});
```

Run it twice and the second run asks nothing, rotates nothing and rewrites nothing. Run it
in CI, where there is no terminal, and it reports what is unanswered and carries on with
what it has instead of waiting for a keypress that will never come.


1. Declare what config.yml holds
--------------------------------

One declaration, and it describes the config file and nothing else: no services, no
targets, no profiles, no pipeline. Everything else in envy is a plain function you call.

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

A value is described by what somebody filling it in needs to know:

| On a value | What it does |
| --- | --- |
| `describe` | what the value is for, shown above the prompt |
| `where` | how to get one, shown dim under it |
| `example` | the shape, shown in the input hint and written into the template |
| `without` | what stops working if it is left empty, shown for an optional value |
| `secret` | masks it as it is typed, and keeps it out of everything printed |
| `required` | `load` reports it when it is still empty |
| `default` | used when the answer is empty, so it is never asked twice |
| `generate` | produced once by envy, kept, and never asked for at all |
| `env` | the env name, for where the convention is not what you want |

That one declaration is doing five jobs:

- **`config.template.yml`**, written for you, grouped and commented out of `title`, `note`,
  `describe` and `where`, and committed. This is the file a colleague copies. It carries
  `example` and never an answer, so it is safe to commit by construction.
- **The prompts**, out of those same four fields. Somebody who has never seen the
  repository can answer every question without opening anything else.
- **The types.** `cfg.get("stripe.secretKey")` is `string` because it is required,
  `cfg.get("stripe.webhookSecret")` is `string | undefined`, and `cfg.get("stripe.typo")`
  does not compile.
- **The env names.** `env:` where the name deviates, section and value in screaming snake
  where it does not, so `cfg.env("stripe")` is `{ STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET }`
  and is typed that way. The name exists once, in the declaration.
- **Validation.** On load, envy says which required values are missing and which still hold
  the example out of the template.

`config.yml` itself stays human, grouped by thing, and gitignored:

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

`generate` is declared here because it is pure: a value envy can produce with no world
around it, written once and never rotated. Anything that needs the stack running stays in
the script, where the ordering is visible.


2. Load it
----------

```ts
const cfg = await envy.load(schema);
```

That reads `config.yml`, diffs it against the schema, asks for the gap, generates what is
declared, writes the file and the template back, and returns the values typed.

```ts
const cfg = await envy.load(schema, {
  cwd: here,                          // what a relative path is resolved against
  file: "config.yml",                 // where the answers live
  template: "config.template.yml",    // or `false` to write none
  ask: "missing",                     // "missing" | "all" | "never"
});
```

`ask` covers the three cases. `"missing"` is the default and the point of the package.
`"all"` is how somebody changes a key they already gave, which is what a `--reconfigure`
flag should run. `"never"` is CI.

**Without a terminal it never asks, whatever `ask` is set to.** It reports what is
unanswered, carries on with what it has, and returns. That is what makes one script work on
a laptop and in a pipeline without a branch in it.


3. Write what your apps read
----------------------------

`envy.write` is the only thing in the package that touches disk, and a format is just a
function that returns a string. `envy.env(...)`, `envy.yaml(...)`, `envy.json(...)` and
`envy.text(...)` render; `write` writes.

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

A group is a comment and a block; a flat object at the top level is written without one. A
value that is `undefined` is left out, an empty string is written, and quoting happens only
where leaving it bare would change the value, because shells, dotenv parsers and docker
compose disagree about almost everything else.

`write` earns being the only writer by owning three things at once. It **skips the write
when the file already holds exactly those bytes**, which is most of the idempotence
guarantee. It puts the generated header on, so nobody hand-edits a file by mistake. And it
**warns before replacing a file that does not carry that header**, so envy cannot quietly
eat a `.env` somebody wrote themselves.

Because a format is only a function, your own renderer is a first class citizen:

```ts
await envy.write("Caddyfile", renderCaddyfile(cfg));
await envy.write("apps/web/config.yml", await envy.yaml({ storage: cfg.section("storage") }));
```

`envy.yaml` is async because the `yaml` peer is loaded when it is first needed, and not
before. Everything else renders synchronously.

Reading one back is `envy.parseEnv(text)`, which is what the convex adapter uses to push an
env file into a deployment.


Running commands
----------------

```ts
await envy.cmd("pnpm install");
await envy.cmd(["pnpm", "exec", "convex", "dev", "--once"]);
```

**Nothing goes through a shell.** A string splits on whitespace and spawns directly; pass
an array when an argument has a space in it. No quoting bugs across platforms, and no way
for a value out of `config.yml` to become a command, an argument separator or a redirect.

The one platform wrinkle is faced rather than hidden. On Windows, `pnpm` and `npx` on
`PATH` are `.cmd` shims, which Node refuses to spawn outright since the batch argument
injection fix, and which are not executables to begin with. `cmd.ts` escapes every argument
and hands `cmd.exe` one verbatim command line. That is the only place `cmd.exe` appears in
this package, and nothing reaches it unescaped.

A failure names the program and its exit code and **never its arguments**, because an
argument is sometimes a credential. Pass `redact` and those values are blanked out of
captured output too:

```ts
await envy.cmd(["convex", "env", "set", "SEAL_KEY", seal], { redact: [seal] });
```


Waiting for something to come up
--------------------------------

```ts
await envy.wait.http(`${api}/version`, { what: "the backend", timeout: 120_000 });
await envy.wait.port(5432, { what: "postgres", timeout: 60_000 });
```

Polls until it answers. `what` is the name used in the failure, so a timeout says which
thing never came up and how long it waited rather than printing a URL and a stack.


Capturing a value something prints
----------------------------------

Some values cannot be declared, because they do not exist until the stack is running: a key
a container prints on first boot, for instance. Those stay in the script, where the
ordering is visible, and `capture` keeps the result:

```ts
const adminKey = await cfg.capture("backend.adminKey", () =>
  envy.docker.compose.exec("backend", "./generate_admin_key.sh"),
);
```

**It runs once.** On the second run the value is already in `config.yml`, the container is
never asked again, and the function is not called, which is what keeps a script with a
capture in it as idempotent as one without.


Adapters
--------

The pluggable thing that wraps an external CLI is called an **adapter**, and there are two.
Each one wraps `envy.cmd`, so an adapter spawns nothing itself and inherits the timeout,
the Windows shim and the no-shell rule for free.

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
await envy.convex.push("backend/.env");   // every name in the file, one env set each
await envy.convex.deploy();
await envy.convex.run("seed:all");
```

A failure is mapped to something that says what to look at: the command that failed, and
the thing a human would run next. `envy.convex.push` reads the file with `parseEnv`, sets
one value per name, and redacts every one of them from anything printed.


What the compiler catches
-------------------------

Every line below fails to compile, and each one is a test in `tests/types/` rather than a
claim in a README.

```ts
cfg.get("stripe.secret");
//       ~~~~~~~~~~~~~~  stripe has no value called `secret`

cfg.get("stripe.clientId");
//       ~~~~~~~~~~~~~~~~  `clientId` is on web-client-1, not on stripe

cfg.get("stripe.secret-key");
//       ~~~~~~~~~~~~~~~~~~  the schema says `secretKey`; the file spelling is the file's

cfg.get("stripe");
//       ~~~~~~~  a path is a section and a value

cfg.section("storage");
//           ~~~~~~~~~  there is no `storage` section

cfg.capture("stripe.nope", run);
//           ~~~~~~~~~~~~  there is no such value

envy.defineConfig({ stripe: { title: "Stripe" } });
//                            ~~~~~~~~~~~~~~~~  a section must declare `values`

envy.defineConfig({ stripe: { values: { key: { describes: "no" } } } });
//                                             ~~~~~~~~~  `describes` is not a thing

envy.setup;
//   ~~~~~  there is no such thing on the surface
```

And the inference that makes `cfg.get` worth using at all:

```ts
cfg.get("stripe.secretKey");            // string, because it is required
cfg.get("stripe.webhookSecret");        // string | undefined
cfg.get("session.sealKey");             // string, because envy generates it
cfg.get("web-client-1.redirectUri");    // string, because it has a default

cfg.env("stripe");                             // { STRIPE_SECRET_KEY: string, ... }
cfg.env("web-client-1", { prefix: "AUTH" });   // { AUTH_CLIENT_ID: string, ... }
```

A value is `string` rather than `string | undefined` when the schema makes it certain:
`required`, a `default`, or `generate`. That is the whole reason to declare the config file
in code, and it is why `defineConfig` refuses a value that is both generated and required.


What envy guarantees
--------------------

Each of these is a test, and the type-shaped ones also have a negative type test asserting
that the wrong code does not compile.

1. **Idempotent.** Running your script twice changes nothing. A generated value is never
   rotated, a captured value is never captured twice, a written file is byte identical.
2. **Asking is a consequence, never a step.** If `config.yml` answers it, nobody is asked.
3. **It never hangs.** No terminal means no question, whatever `ask` says. It reports what
   is unanswered and returns.
4. **Nothing secret is ever printed.** No value out of `config.yml`, no generated value and
   no captured value reaches stdout, stderr, a step label, an error message, a stack or the
   committed template. A prompt for a value that already exists echoes nine characters and
   an ellipsis, which is enough to recognise which key is in there and not enough to be
   worth reading off somebody's screen.
5. **`write` is the only thing that touches disk**, and everything it writes says it was
   generated. A format returns a string; a format that opens a file is a bug.
6. **Nothing goes through a shell**, with the single Windows `.cmd` exception described
   above, which escapes every argument.
7. **The schema is the only source of names.** A value exists once, in the declaration.
   `cfg.get`, `cfg.section`, `cfg.env` and the template all read it, and a typo in any of
   them is a compile error rather than a blank in a file.


Timeouts
--------

Anything that can wait forever takes an optional `timeout` in milliseconds. **Nothing has a
default.** envy does not know whether `pnpm install` on your machine takes four seconds or
four minutes, and a ceiling that is wrong kills a setup that was about to work, which is
worse than waiting:

```ts
await envy.cmd("pnpm install");                                // as long as it takes
await envy.wait.http(`${api}/version`, { timeout: 120_000 });  // give up after two minutes
```

`envy.defaults({ timeout: 60_000 })` is how a repository opts into a ceiling everywhere,
and any call overrides it. A timeout kills the child, and the failure names what timed out,
how long it waited and where to look.


Warnings
--------

envy warns rather than fails for anything that is a footgun but not an error. The one that
matters most: if your root `.gitignore` does not cover `config.yml`, it says so, because
that file holds secrets and is one `git add .` away from being public. It reads the real
`.gitignore` rather than guessing, and says nothing when any pattern already covers it.

Also warned: a value still holding the example out of the template, a required value left
unanswered, and a generated file that was hand edited since envy last wrote it.

A warning is never fatal and always silenceable, per call, per run, or from the
environment. Nothing warns twice for the same cause in one run.

```ts
await envy.write(path, content, { warn: false });        // this call
await envy.ui.run("Bootstrap", main, { warn: false });   // this run
```

```bash
ENVY_NO_WARN=1 pnpm setup
```


The pieces
----------

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
| `cfg.all()` | everything, typed, for a renderer of your own |
| `envy.write(path, content, options)` | the only writer. idempotent, and warns before replacing a file it did not write |
| `envy.env(input, options)` | render a dotenv file, with groups, comments and a header |
| `envy.yaml(value, options)` | render YAML. async, because the `yaml` peer loads on first use |
| `envy.json(value)` `envy.text(body, options)` | render the other shapes |
| `envy.parseEnv(text)` | read an existing env file back |
| `envy.cmd(command, options)` | spawn, never through a shell. `timeout`, `cwd`, `env`, `redact` |
| `envy.wait.http(url, options)` | poll until it answers |
| `envy.wait.port(port, options)` | poll until something is listening |
| `envy.docker.available()` | whether docker is answering at all |
| `envy.docker.compose` | `up`, `down`, `exec`, `logs`, `ps` |
| `envy.convex` | `push` an env file into a deployment, `deploy`, `run`, `set`, `list` |
| `envy.ui` | `run`, `step`, `ready`, `note`, `warn`, and the colours |
| `envy.fail(message)` | stop with a message the person running this is meant to read |
| `envy.defaults(options)` | a `timeout` and a `warn` setting for a whole script |

The output layer is a real part of the package rather than an afterthought, because it is
the only part of this anybody ever sees. `ui.run` frames a script with a header, a total
time, and a failure that prints a clean message and exits 1 instead of a stack trace;
`ui.step` prints a spinner and then a tick with the elapsed time; `ui.ready` is the closing
block of addresses and the one command to run next. It honours `NO_COLOR` and falls back to
plain lines without a terminal, so the same script stays readable in a CI log.


Examples
--------

Each one is a small fake repository showing one thing, in [`examples/`](./examples). The
four that need nothing running are run in CI, which is what keeps them honest.

| Example | What it shows |
| --- | --- |
| [`single-app`](./examples/single-app) | the smallest useful setup: a schema, one `.env`, done |
| [`monorepo`](./examples/monorepo) | a section per app, and each app getting its own file |
| [`two-addresses`](./examples/two-addresses) | one service reached from the host and from inside compose |
| [`custom-format`](./examples/custom-format) | `write()` with a renderer of your own |
| [`with-docker`](./examples/with-docker) | compose up, wait, exec, capture what a container prints |
| [`with-convex`](./examples/with-convex) | push an env file into a deployment and deploy |

The last two need docker and a deployment, so they are there to be read. They typecheck
with everything else, so they cannot rot quietly.

```bash
pnpm examples
```


Compatibility
-------------

- **Node 22 or newer.** ESM only, no CommonJS build.
- **Linux, macOS and Windows.** The Windows `.cmd` path is tested rather than assumed.
- **No runtime dependencies.** Adapters spawn CLIs rather than importing SDKs, which is
  what keeps it that way. `yaml` is an optional peer, needed only for the YAML store and
  the YAML format.
- **One export**, `.`, plus `./package.json`. The published types are verified with
  [publint](https://publint.dev) and
  [are-the-types-wrong](https://arethetypeswrong.github.io) on every change, because a
  package whose selling point is types has to prove its own resolve.


Not in scope
------------

- **No pipeline, no step registry and no lifecycle.** envy is functions your script calls
  in whatever order it likes. A step DSL is the one way to get this package wrong, and
  nothing else in it outranks that.
- **No profiles.** A profile is a variable in your script. `const port = e2e ? 8180 : 8080`
  needs no help from a library, and a profile system would be another config format your
  repository has to restructure itself around.
- **No secret manager.** envy fills in a local `config.yml` for local development. Pulling
  from Vault, 1Password or SSM is a function you pass, not a feature here.
- **No process supervision.** Bringing a stack up is `docker.compose.up`; keeping it up is
  your runtime's job.
- **No validation beyond presence.** A value is a string. If a port has to be a number
  between 1024 and 65535, that is your script's call to make, with your error message.


Where it came from
------------------

It began inside a product monorepo, as the 727-line setup script in
[The problem](#the-problem): a config store, a prompt loop, two env writers, a spawn
wrapper, a poller and a deploy, all hand written, all in one file nobody wanted to touch.
Other repositories needed the same thing and were busy growing their own slightly different
copy of it, so it was extracted here, rebuilt around one typed declaration, and extended
well past the original with the template, the gitignore check, the idempotence guarantee,
the adapters and the output layer.


Extending it
------------

It is shaped around what we needed at [Rapture](https://rapture.sh): a monorepo of apps and
services, a config file a colleague can fill in, secrets that are generated once, and a
script that runs the same on a laptop and in CI. That makes it opinionated in places.

**A new adapter is the most useful contribution** and a contained one: wrap `envy.cmd`,
take an optional `timeout` on every call that can wait, map the CLI's failures onto
something that says what to look at, and test it against a stubbed `cmd` rather than the
real thing. Supabase, Terraform, Prisma, Vercel and Fly are all missing.

Read [CONTRIBUTING.md](CONTRIBUTING.md), and [AGENTS.md](AGENTS.md) for the conventions
every change follows, whoever or whatever makes it. Open an issue first if you want to talk
something through.

```bash
pnpm install
```

```bash
pnpm check
```

That last one is lint, typecheck, both test tiers with the coverage floor, the examples, the
build and the published package checks, which is the same set CI runs.


License
-------

MIT. See [LICENSE](LICENSE). Part of [Rapture.sh](https://rapture.sh).
