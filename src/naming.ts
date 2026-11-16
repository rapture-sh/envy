/**
 * Three spellings of the same name, and the rules for getting between them.
 *
 * A schema writes `secretKey`, because that is what reads well in TypeScript. The config
 * file writes `secret-key`, because that is what reads well in YAML. An env file writes
 * `STRIPE_SECRET_KEY`, because that is what reads well in a `.env`. A name exists once, in
 * the schema, and these are what stop it being written out three times by hand.
 *
 * Every rule here has a type-level twin below it, and `tests/naming.test.ts` asserts the
 * two agree. They have to: the type is what a caller sees and the function is what
 * actually runs.
 */

/**
 * `secretKey` to `secret-key`.
 *
 * A capital starts a new word when the character before it was not a capital, or when the
 * character after it is lowercase. That second half is what keeps an acronym together
 * (`apiURL` is `api-url`) while still splitting the word that follows one (`awsSDKRegion`
 * is `aws-sdk-region`). A digit is not a capital, so `oauth2Id` is `oauth2-id`.
 */
export function toKebab(name: string): string {
  return name
    .replace(/([^A-Z])([A-Z])/gu, "$1-$2")
    .replace(/([A-Z])([A-Z][a-z])/gu, "$1-$2")
    .toLowerCase();
}

/** `stripe` and `secretKey` to `STRIPE_SECRET_KEY`. */
export function toEnvName(section: string, key: string): string {
  return `${toKebab(section)}-${toKebab(key)}`.replace(/-/gu, "_").toUpperCase();
}

/**
 * The env name a value is written under: whatever the schema said, else the convention,
 * with `prefix` standing in for the section name where the caller gave one.
 *
 * A prefix replaces the section rather than stacking on top of it, so a section called
 * `web-client-1` read with `{ prefix: "AUTH" }` writes `AUTH_CLIENT_ID` and not
 * `AUTH_WEB_CLIENT_1_CLIENT_ID`. A declared name is left exactly as it was declared,
 * because `env:` has already said what the name is.
 */
export function envNameFor(
  section: string,
  key: string,
  declared: string | undefined,
  prefix: string | undefined,
): string {
  if (declared !== undefined) return declared;

  return toEnvName(prefix === undefined || prefix === "" ? section : prefix, key);
}

type IsCapital<TChar extends string> = TChar extends Lowercase<TChar> ? false : true;

type StartsLower<TName extends string> = TName extends `${infer TFirst}${string}`
  ? IsCapital<TFirst> extends true
    ? false
    : true
  : false;

/**
 * The type-level twin of `toKebab`, walking the name a character at a time because a type
 * has no regular expressions.
 *
 * It carries the previous character and peeks at the next one, which is the only way to
 * express the acronym rule the function implements with two passes. The two have to agree
 * exactly: the type is what a caller sees and the function is what actually runs.
 */
type KebabFrom<
  TName extends string,
  TPrevious extends string = "",
  TAcc extends string = "",
> = TName extends `${infer THead}${infer TRest}`
  ? IsCapital<THead> extends true
    ? TAcc extends ""
      ? KebabFrom<TRest, THead, Lowercase<THead>>
      : IsCapital<TPrevious> extends true
        ? StartsLower<TRest> extends true
          ? KebabFrom<TRest, THead, `${TAcc}-${Lowercase<THead>}`>
          : KebabFrom<TRest, THead, `${TAcc}${Lowercase<THead>}`>
        : KebabFrom<TRest, THead, `${TAcc}-${Lowercase<THead>}`>
    : KebabFrom<TRest, THead, `${TAcc}${THead}`>
  : TAcc;

export type Kebab<TName extends string> = KebabFrom<TName>;

type DashToUnderscore<TName extends string> = TName extends `${infer THead}-${infer TRest}`
  ? `${THead}_${DashToUnderscore<TRest>}`
  : TName;

/**
 * The type-level twin of `toEnvName`.
 *
 * It is also the twin of the prefix rule, since a prefix stands in for the section: pass
 * the prefix as `TSection` and the same conversion produces the same name.
 */
export type EnvName<TSection extends string, TKey extends string> = Uppercase<
  DashToUnderscore<`${Kebab<TSection>}-${Kebab<TKey>}`>
>;
