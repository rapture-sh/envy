import { defineConfig } from "tsdown";

/**
 * One entry, because a setup script wants one import line and the whole surface hangs off
 * the `envy` object.
 *
 * Nothing is bundled in: there are no runtime dependencies, and `yaml` is an optional peer
 * that stays external so a repository which never writes YAML installs nothing.
 */
export default defineConfig({
  entry: ["src/index.ts"],
  format: "esm",
  platform: "node",
  target: "node22",
  external: [/^node:/, "yaml"],
  dts: true,
  clean: true,
  treeshake: true,
  sourcemap: true,
});
