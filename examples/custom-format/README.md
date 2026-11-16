# custom-format

`write()` with a renderer of your own.

```bash
pnpm example:custom
```

`envy.env`, `envy.yaml` and `envy.json` are functions that take a value and return a
string. There is nothing else to them. A format envy has never heard of is a function you
write in your own script and hand to the same `write`, and it gets the same idempotence and
the same generated header as anything that ships here.

This one writes a Caddyfile, plus the same values as YAML and JSON for comparison, into
[`generated/`](generated).

What is worth looking at:

- **`caddyfile()` is eleven lines and takes a typed section.** `cfg.section("site")` is
  `{ domain: string; upstream: string; email: string }` because the schema said so, so the
  renderer needs no validation of its own.
- **`envy.text` adds the header.** That is the only reason it exists: the file says it is
  generated, in the comment syntax you tell it, so nobody edits it and loses the change.
- **JSON gets no header**, because JSON has no comments. It is the one kind of file
  `write` cannot warn you about before replacing.
