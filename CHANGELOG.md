# @rapture-sh/envy

## 0.2.0

### Minor Changes

- 6b61fe2: Add `envy.check`, for the prerequisites a setup script needs before it asks anybody for
  anything. Every check runs and the report lists all of them at once, with a version range,
  an optional flag and a `fix` line saying what to do, so one pass tells somebody everything
  their machine is missing.

## 0.1.0

### Minor Changes

- 2a75fe4: First release. A toolchain for the setup script every repository ends up writing:
  `defineConfig` describes what `config.yml` holds, `load` asks only for what is missing,
  and `write` puts it into every env, YAML, JSON or hand rendered file that needs it, with
  `cmd`, `wait` and the docker and convex adapters for the rest of the script.
