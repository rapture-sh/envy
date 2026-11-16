# with-docker

Bring a stack up, wait for it, and keep a value one of its containers prints.

```bash
pnpm tsx examples/with-docker/scripts/setup.ts
```

Needs docker, so it is not in `pnpm examples`. It still typechecks with everything else,
so it cannot rot quietly.

What is worth looking at:

- **The ordering is the lesson.** A generated value is declared in the schema and produced
  before anything starts. A captured value cannot be: the container has to exist first.
  That is why `cfg.capture` sits in the script, where you can see what has to happen before
  it, rather than in the schema where it would look like the same kind of thing.
- **`capture` runs once.** On the second run the value is already in `config.yml` and the
  container is never asked again. An admin key that changed on every run would invalidate
  the one in your `.env` every time you ran the setup.
- **`docker.available()` first.** "Docker is not running" is the most common reason a
  setup script fails, and the error docker gives for it reads like a networking problem.
  One check up front turns that into a sentence.
- **No default timeout, and a big explicit one.** A fresh clone pulls images, so the first
  `up` is minutes. A ceiling envy picked for you would kill a setup that was about to work,
  which is why there is none and this script sets its own.
- **`exec` always passes `-T`.** Without it docker allocates a TTY and the output comes
  back with control characters in it, which is a fun afternoon the first time.
