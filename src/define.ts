import type { EnvName, Kebab, Prefixed } from "./naming.js";

export type GenerateSpec = {
  /** How many random bytes to take. Defaults to 32. */
  bytes?: number;
  /** How to spell them. Defaults to `base64url`, which survives every file envy writes. */
  encoding?: "base64" | "base64url" | "hex";
};

export type ValueSpec = {
  /** The env name to write it under, where the convention would get it wrong. */
  env?: string;

  /** What the value is for. The first line of the prompt, and a comment in the template. */
  describe?: string;

  /** How to get it. Printed dim under the question. */
  where?: string;

  /**
   * What the value looks like, shown in the prompt and written into the template.
   *
   * It is also how envy knows a template was copied and never filled in: a config holding
   * the example is treated as unanswered rather than answered with a placeholder.
   */
  example?: string;

  /** What the developer loses by leaving it empty, so skipping it is an informed choice. */
  without?: string;

  /** Mask the input. A value is never echoed either way; this hides the typing too. */
  secret?: boolean;

  /** Nothing works without it. envy asks until it has one, and warns when it does not. */
  required?: boolean;

  /** Used when nobody answers. A value with a default is never missing. */
  default?: string;

  /** envy produces it once and keeps it. Never asked for, never rotated. */
  generate?: GenerateSpec;
};

export type SectionSpec = {
  /** What to call this group in a prompt and in the template. Defaults to the name. */
  title?: string;

  /** A line about the whole group, printed before its questions. */
  note?: string;

  values: Record<string, ValueSpec>;
};

export type ConfigSpec = Record<string, SectionSpec>;

/**
 * Whether a value is always there.
 *
 * Checked in this order on purpose. `generate` and `default` both mean envy can produce
 * one with nobody around, so the value is a `string` whatever happens; `required` means
 * envy will insist on one. Everything else may legitimately be empty, and the type says
 * so rather than making every caller remember.
 *
 * The checks are written as `extends { x: ... }` rather than `"x" in` because the specs
 * come through `defineConfig`'s `const` parameter, where an absent property is absent from
 * the type rather than present and optional.
 */
type IsCertain<TValue extends ValueSpec> = TValue extends { generate: GenerateSpec }
  ? true
  : TValue extends { default: string }
    ? true
    : TValue extends { required: true }
      ? true
      : false;

export type ValueType<TValue extends ValueSpec> =
  IsCertain<TValue> extends true ? string : string | undefined;

export type SectionNames<TSchema extends ConfigSpec> = keyof TSchema & string;

/** Every `section.value` the schema declares, as a union of literals. */
export type ValuePath<TSchema extends ConfigSpec> = {
  [TSection in SectionNames<TSchema>]: `${TSection}.${keyof TSchema[TSection]["values"] & string}`;
}[SectionNames<TSchema>];

export type ValueAtPath<
  TSchema extends ConfigSpec,
  TPath extends ValuePath<TSchema>,
> = TPath extends `${infer TSection}.${infer TKey}`
  ? TSection extends SectionNames<TSchema>
    ? TKey extends keyof TSchema[TSection]["values"]
      ? ValueType<TSchema[TSection]["values"][TKey] & ValueSpec>
      : never
    : never
  : never;

/**
 * `-readonly` because this mapping is homomorphic and would otherwise inherit the modifier
 * that `defineConfig`'s `const` parameter puts on every property of the schema. A caller
 * gets a plain object back at runtime, so the type says so.
 */
export type SectionValues<TSection extends SectionSpec> = {
  -readonly [TKey in keyof TSection["values"]]: ValueType<TSection["values"][TKey] & ValueSpec>;
};

/**
 * The env name one value ends up under: what the schema declared, else the convention,
 * with the prefix in front either way.
 *
 * `TValue extends { env: ... }` has to come first, because a declared name is the whole
 * answer and running it through the convention afterwards would mangle it.
 */
type EnvNameOf<
  TSection extends string,
  TKey extends string,
  TValue extends ValueSpec,
  TPrefix extends string,
> = TValue extends { env: infer TDeclared extends string }
  ? Prefixed<TPrefix, TDeclared>
  : Prefixed<TPrefix, EnvName<TSection, TKey>>;

/**
 * A section as the env names it writes.
 *
 * Mapped over the keys with `as`, so the result is keyed by the env name rather than by
 * the schema key. Values are `string`, not `string | undefined`: an env file has no way to
 * say "absent" other than leaving the line out, which is what the format does.
 */
export type SectionEnv<
  TSchema extends ConfigSpec,
  TSection extends SectionNames<TSchema>,
  TPrefix extends string = "",
> = {
  [TKey in keyof TSchema[TSection]["values"] & string as EnvNameOf<
    TSection,
    TKey,
    TSchema[TSection]["values"][TKey] & ValueSpec,
    TPrefix
  >]: string;
};

/** The key a value is written under in the config file. */
export type FileKey<TKey extends string> = Kebab<TKey>;

/**
 * Describe what `config.yml` holds.
 *
 * Returns the schema unchanged. It exists for the `const` type parameter, which is what
 * keeps `required: true` as `true` rather than widening it to `boolean`, and every literal
 * name as a literal. Without it nothing downstream could tell one value from another.
 */
export function defineConfig<const TSchema extends ConfigSpec>(schema: TSchema): TSchema {
  for (const [section, spec] of Object.entries(schema)) {
    if (Object.keys(spec.values).length === 0) {
      throw new TypeError(`The "${section}" section in the config schema declares no values.`);
    }

    for (const [key, value] of Object.entries(spec.values)) {
      if (value.generate !== undefined && value.required === true) {
        throw new TypeError(
          `"${section}.${key}" is both generated and required. A generated value is always there, so required says nothing.`,
        );
      }

      if (value.generate !== undefined && value.default !== undefined) {
        throw new TypeError(
          `"${section}.${key}" is both generated and has a default. Pick one: the default would only ever be used once and then be replaced.`,
        );
      }
    }
  }

  return schema;
}
