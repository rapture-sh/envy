# Security Policy

## Reporting a vulnerability

Please do **not** open a public issue for a security problem.

Report it privately through GitHub:
[Security → Report a vulnerability](https://github.com/rapturedotsh/envy/security/advisories/new).

Include what you found, how to reproduce it, and what an attacker could do with it. Expect
an acknowledgement within a few days.

## Read this first

envy is a development-time tool that handles secrets on purpose. It asks for them, writes
them to disk, and hands them to other programs. That is its job, so it is worth being
precise about where they end up.

**What envy writes, and where:**

- `config.yml`, the answers for this machine. Every secret the setup asked for, and every
  value it generated, is in this file in plain text. It is not encrypted and it is not
  meant to be. It is gitignored, and envy warns on every load if your `.gitignore` does
  not cover it.
- `config.template.yml`, committed. It holds the shape, the descriptions and the
  `example` values from the declaration. **Never an answer.** A value that came from
  `config.yml` must not reach the template.
- Whatever your script passes to `envy.write`. Those files are generated and usually
  gitignored by the repository that uses envy. envy does not decide that for you, which is
  why `write` puts a header on them saying they are generated.

**What envy promises not to do:**

- No value is ever printed. A prompt for a value you already gave echoes a truncated hint
  of it and nothing else. No value reaches a log line, a step label, an error message or a
  stack trace.
- Nothing goes through a shell. `envy.cmd` splits a string on whitespace and spawns
  directly, so a value out of `config.yml` can never be interpreted as a command, an
  argument separator or a redirect.
- Nothing is sent anywhere. envy makes HTTP requests only where you call `envy.wait`, to
  the address you passed, and it reads the status line. There is no telemetry.
- Files are written with the current process umask and nothing more permissive.

## What does count

- **A secret reaching the template.** Anything that puts an answer from `config.yml` into
  `config.template.yml`, which is committed.
- **A secret reaching stdout, stderr, a step label, an error or a stack.** Including
  through a failing `cmd`, whose captured output is part of the error.
- **Command injection.** Any path by which a value out of `config.yml`, a schema, or a
  captured command's output becomes an executed command or an extra argument. `envy.cmd`
  must never reach a shell.
- **Path escape.** A section or value name, or a path passed to `write`, that writes
  outside the directory it was given.
- **The gitignore warning being wrong in the unsafe direction**, so envy stays quiet about
  a `config.yml` that git would actually track.
- **Reading a config file as code.** `config.yml` is data. A YAML feature or a parser
  option that lets it construct objects or execute anything is a vulnerability.
- **Supply chain.** envy has no runtime dependencies, and `yaml` is an optional peer, which
  is part of why.

## What does not

These are documented behaviour, and reports about them will be closed:

- **`config.yml` is plain text.** It is a local development file holding local development
  credentials. Encrypting it would mean a key to manage, which is the problem it exists to
  avoid. If a value is too sensitive to sit in a file on a developer's laptop, it does not
  belong in a local setup at all.
- **envy runs the commands your script tells it to.** `scripts/setup.mjs` is code in your
  repository, and it has the trust you already give the repository.
- **`cfg.capture` runs a command and keeps what it prints.** You chose the command.
- **A generated file is only as private as where you put it.** envy writes where you ask.
  Ignoring the output is the repository's job, and the header is the reminder.
- **No validation of what a credential means.** envy does not know a Stripe key from a
  random string, and does not call anyone to find out.

## Supported versions

The latest published version on npm and `main` are supported. There are no backported
fixes to older majors.

Published tarballs carry [npm provenance](https://docs.npmjs.com/generating-provenance-statements),
so you can verify which commit and which workflow built the version you installed.
