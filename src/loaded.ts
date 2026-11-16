import type {
  ConfigSpec,
  SectionEnv,
  SectionNames,
  SectionValues,
  ValueAtPath,
  ValuePath,
} from "./define.js";
import { Fail } from "./errors.js";
import { envNameFor, toKebab } from "./naming.js";
import type { StoreData } from "./store/index.js";

export type EnvOptions<TPrefix extends string = string> = {
  /** Put this in front of every name in the section, declared or conventional. */
  prefix?: TPrefix;
};

export type Loaded<TSchema extends ConfigSpec> = {
  /** One value, typed from the schema: `string` where it is certain to be there. */
  get<TPath extends ValuePath<TSchema>>(path: TPath): ValueAtPath<TSchema, TPath>;

  /** Whether a value actually has something in it, whatever its type says. */
  has(path: ValuePath<TSchema>): boolean;

  /** A whole section, keyed by the schema's names. */
  section<TSection extends SectionNames<TSchema>>(name: TSection): SectionValues<TSchema[TSection]>;

  /**
   * A whole section, keyed by the env names it writes, with anything empty left out so an
   * env file does not grow a line that says nothing.
   */
  env<TSection extends SectionNames<TSchema>, const TPrefix extends string = "">(
    name: TSection,
    options?: EnvOptions<TPrefix>,
  ): Partial<SectionEnv<TSchema, TSection, TPrefix>>;

  /**
   * Run something that prints a value, keep what it printed, and never run it again.
   *
   * For the values that need the world to exist first: an admin key a container prints
   * once it is up, a token a CLI mints. Declared values are generated before anything
   * starts; these cannot be, which is why they sit in the script where the order is
   * visible.
   */
  capture(path: ValuePath<TSchema>, produce: () => string | Promise<string>): Promise<string>;

  /** Every required value the config still has nothing for, as `section.value`. */
  missing(): string[];

  /** Everything held, in file spelling. For writing a file envy knows nothing about. */
  all(): StoreData;
};

type Internals = {
  schema: ConfigSpec;
  values: StoreData;
  save: (values: StoreData) => Promise<void>;
};

function split(path: string): [string, string] {
  const at = path.indexOf(".");

  if (at < 1) throw new Fail(`"${path}" is not a section and a value, like "stripe.secretKey".`);

  return [path.slice(0, at), path.slice(at + 1)];
}

function read(values: StoreData, section: string, key: string): string | undefined {
  const stored = values[toKebab(section)]?.[toKebab(key)];

  return stored === undefined || stored === "" ? undefined : stored;
}

/**
 * Build the object `load` hands back.
 *
 * This is the one place in the package where `as` is allowed, and the reason is here: the
 * body works in `string | undefined` because that is what a config file holds, while the
 * public type says which values are certain to be there, worked out from the schema. There
 * is no way to write a body that is generic over an arbitrary schema, so the boundary is
 * drawn once, here, and `tests/types/loaded.test-d.ts` is what proves the public side of
 * it. Do not add a second one.
 */
export function createLoaded<TSchema extends ConfigSpec>(internals: Internals): Loaded<TSchema> {
  const { schema, save } = internals;

  let values = internals.values;

  function specFor(section: string, key: string): { env?: string } | undefined {
    return schema[section]?.values[key];
  }

  const loaded = {
    get(path: string): string | undefined {
      const [section, key] = split(path);

      if (specFor(section, key) === undefined) {
        throw new Fail(`"${path}" is not in the config schema.`);
      }

      return read(values, section, key);
    },

    has(path: string): boolean {
      return loaded.get(path) !== undefined;
    },

    section(name: string): Record<string, string | undefined> {
      const spec = schema[name];

      if (spec === undefined) throw new Fail(`"${name}" is not a section in the config schema.`);

      return Object.fromEntries(
        Object.keys(spec.values).map((key) => [key, read(values, name, key)]),
      );
    },

    env(name: string, options: EnvOptions = {}): Record<string, string> {
      const spec = schema[name];

      if (spec === undefined) throw new Fail(`"${name}" is not a section in the config schema.`);

      const entries: [string, string][] = [];

      for (const [key, value] of Object.entries(spec.values)) {
        const held = read(values, name, key);

        if (held === undefined) continue;

        entries.push([envNameFor(name, key, value.env, options.prefix), held]);
      }

      return Object.fromEntries(entries);
    },

    async capture(path: string, produce: () => string | Promise<string>): Promise<string> {
      const [section, key] = split(path);

      if (specFor(section, key) === undefined) {
        throw new Fail(`"${path}" is not in the config schema.`);
      }

      const held = read(values, section, key);

      if (held !== undefined) return held;

      const produced = (await produce()).trim();

      if (produced === "") throw new Fail(`Nothing was produced for "${path}".`);

      values = {
        ...values,
        [toKebab(section)]: { ...values[toKebab(section)], [toKebab(key)]: produced },
      };

      await save(values);

      return produced;
    },

    missing(): string[] {
      const absent: string[] = [];

      for (const [section, spec] of Object.entries(schema)) {
        for (const [key, value] of Object.entries(spec.values)) {
          if (value.required === true && read(values, section, key) === undefined) {
            absent.push(`${section}.${key}`);
          }
        }
      }

      return absent;
    },

    all(): StoreData {
      return values;
    },
  };

  return loaded as Loaded<TSchema>;
}
