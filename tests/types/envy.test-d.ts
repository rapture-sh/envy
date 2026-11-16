import { describe, expectTypeOf, it } from "vitest";
import { envy } from "~/index";

/**
 * The surface is one object, so this file is where its shape is pinned down. Changing what
 * `envy` carries fails here until the change is deliberate, which is the point: a module
 * that quietly stops being reachable, or a name that quietly changes, is otherwise
 * invisible until somebody's script breaks.
 */
describe("the envy surface", () => {
  it("should carry exactly the public modules", () => {
    expectTypeOf<keyof typeof envy>().toEqualTypeOf<
      | "check"
      | "cmd"
      | "convex"
      | "docker"
      | "defaults"
      | "defineConfig"
      | "env"
      | "json"
      | "text"
      | "yaml"
      | "fail"
      | "Fail"
      | "load"
      | "parseEnv"
      | "ui"
      | "wait"
      | "write"
    >();
  });

  it("should expose the output helpers under ui", () => {
    expectTypeOf<keyof typeof envy.ui>().toEqualTypeOf<
      | "run"
      | "step"
      | "ready"
      | "note"
      | "warn"
      | "bold"
      | "dim"
      | "red"
      | "green"
      | "yellow"
      | "cyan"
    >();
  });

  it("should reject a name that is not on the surface", () => {
    // @ts-expect-error there is no `envy.setup`
    envy.setup;
  });
});

describe("ui.step", () => {
  it("should return what the work returned", () => {
    expectTypeOf(envy.ui.step("Working", () => 42)).toEqualTypeOf<Promise<number>>();
  });

  it("should unwrap a promise the work returned", () => {
    expectTypeOf(envy.ui.step("Working", async () => "done")).toEqualTypeOf<Promise<string>>();
  });
});

describe("ui.run", () => {
  it("should reject work that returns a value", () => {
    // @ts-expect-error the frame is for a whole script, so it returns nothing
    envy.ui.run("Bootstrap", () => 42);
  });
});
