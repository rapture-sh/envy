# @rapturedotsh/envy

## 0.1.0

### Minor Changes

- 914bd32: First release. A toolchain for the setup script every repository ends up writing:
  `defineConfig` describes what `config.yml` holds, `load` asks only for what is missing, and
  `write` puts it into every env, YAML, JSON or hand rendered file that needs it, with `cmd`,
  `wait`, `check` and the docker and convex adapters for the rest of the script.
