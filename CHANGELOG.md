# @rapture-sh/envy

## 0.1.0

### Minor Changes

- 2a75fe4: First release. A toolchain for the setup script every repository ends up writing:
  `defineConfig` describes what `config.yml` holds, `load` asks only for what is missing,
  and `write` puts it into every env, YAML, JSON or hand rendered file that needs it, with
  `cmd`, `wait` and the docker and convex adapters for the rest of the script.
