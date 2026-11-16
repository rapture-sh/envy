import { describe, expectTypeOf, it } from "vitest";
import type { CheckOutcome } from "~/check";
import { envy } from "~/index";

describe("envy.check", () => {
  it("should answer with one outcome per check", () => {
    expectTypeOf(envy.check([{ name: "Docker", run: "docker info" }])).toEqualTypeOf<
      Promise<CheckOutcome[]>
    >();
  });

  it("should take a command as an array, for an argument with a space in it", () => {
    expectTypeOf(envy.check([{ name: "Postgres", run: ["psql", "-c", "select 1"] }])).toEqualTypeOf<
      Promise<CheckOutcome[]>
    >();
  });

  it("should hand the command's result to a check of your own", () => {
    envy.check([
      {
        name: "Postgres",
        run: "pg_isready",
        ok: (result) => {
          expectTypeOf(result.code).toEqualTypeOf<number>();
          expectTypeOf(result.out).toEqualTypeOf<string>();
          expectTypeOf(result.err).toEqualTypeOf<string>();

          return true;
        },
      },
    ]);
  });

  it("should require a name and a command", () => {
    // @ts-expect-error a check with no `run` decides nothing
    envy.check([{ name: "Docker" }]);
  });

  it("should reject a field that is not part of a check", () => {
    // @ts-expect-error the field is `fix`, not `hint`
    envy.check([{ name: "Docker", run: "docker info", hint: "start it" }]);
  });

  it("should reject a version range that is not a string", () => {
    // @ts-expect-error a range is written the way a person writes one
    envy.check([{ name: "Node", run: "node --version", version: 22 }]);
  });

  it("should reject an option that is not part of the call", () => {
    // @ts-expect-error there is no `stopOnFirst`: every check always runs
    envy.check([{ name: "Docker", run: "docker info" }], { stopOnFirst: true });
  });
});
