import { relative, resolve } from "node:path";
import { type Answers, ask, type Question } from "./ask.js";
import type { ConfigSpec } from "./define.js";
import { generateValue } from "./generate.js";
import { isIgnored } from "./gitignore.js";
import { createLoaded, type Loaded } from "./loaded.js";
import { toKebab } from "./naming.js";
import { readConfig, type StoreData, writeConfig, writeTemplate } from "./store/index.js";
import { isInteractive } from "./ui/out.js";
import { note } from "./ui/report.js";
import { type WarnOptions, warn } from "./ui/warn.js";

export type AskMode = "missing" | "all" | "never";

export type LoadOptions = WarnOptions & {
  /** Where the answers live. Defaults to `config.yml` beside the script's working directory. */
  file?: string;

  /**
   * Where the committed template goes, rewritten on every load so it cannot drift from the
   * schema. `false` leaves it alone.
   */
  template?: string | false;

  /**
   * `missing` asks only for what the file does not answer, which is the point of all this.
   * `all` asks again for everything, which is how somebody changes a key they already gave.
   * `never` asks for nothing. Without a terminal, every one of them behaves like `never`.
   */
  ask?: AskMode;

  /** What relative paths are resolved against. Defaults to the current directory. */
  cwd?: string;
};

function pathsIn(schema: ConfigSpec): Array<{ section: string; key: string }> {
  return Object.entries(schema).flatMap(([section, spec]) =>
    Object.keys(spec.values).map((key) => ({ section, key })),
  );
}

function held(values: StoreData, section: string, key: string): string | undefined {
  const stored = values[toKebab(section)]?.[toKebab(key)];

  return stored === undefined || stored === "" ? undefined : stored;
}

function set(values: StoreData, section: string, key: string, value: string): StoreData {
  const name = toKebab(section);

  return { ...values, [name]: { ...values[name], [toKebab(key)]: value } };
}

function merge(values: StoreData, answers: Answers): StoreData {
  const merged: StoreData = { ...values };

  for (const [section, entries] of Object.entries(answers)) {
    merged[section] = { ...merged[section], ...entries };
  }

  return merged;
}

/**
 * Produce every value the schema says envy can make for itself, once.
 *
 * A value that is already there is left exactly as it is. Rotating a session key on a
 * rerun would sign everybody out of their own development environment, which is the kind
 * of thing that gets blamed on anything but the setup script.
 */
function generateMissing(schema: ConfigSpec, values: StoreData): StoreData {
  let next = values;

  for (const { section, key } of pathsIn(schema)) {
    const spec = schema[section]?.values[key];

    if (spec?.generate === undefined) continue;
    if (held(next, section, key) !== undefined) continue;

    next = set(next, section, key, generateValue(spec.generate));
  }

  return next;
}

/**
 * Apply the defaults for anything still empty.
 *
 * After asking rather than before, so an empty answer to a question with a default falls
 * back to the default rather than being stored as nothing.
 */
function applyDefaults(schema: ConfigSpec, values: StoreData): StoreData {
  let next = values;

  for (const { section, key } of pathsIn(schema)) {
    const spec = schema[section]?.values[key];

    if (spec?.default === undefined) continue;
    if (held(next, section, key) !== undefined) continue;

    next = set(next, section, key, spec.default);
  }

  return next;
}

/**
 * What still needs asking.
 *
 * A value sitting at exactly the `example` from the template counts as unanswered: it
 * means the template was copied and that line was never touched. Generated values are
 * never asked for, and neither is anything a default already covers unless `all` is on.
 */
function questionsFor(schema: ConfigSpec, values: StoreData, mode: AskMode): Question[] {
  const questions: Question[] = [];

  for (const [section, spec] of Object.entries(schema)) {
    for (const [key, value] of Object.entries(spec.values)) {
      if (value.generate !== undefined) continue;

      const current = held(values, section, key);
      const untouched = current !== undefined && current === value.example;

      if (mode !== "all" && current !== undefined && !untouched) continue;
      if (mode !== "all" && current === undefined && value.default !== undefined) continue;

      questions.push({
        section,
        ...(spec.title === undefined ? {} : { title: spec.title }),
        ...(spec.note === undefined ? {} : { note: spec.note }),
        key,
        spec: value,
        ...(untouched || current === undefined ? {} : { current }),
      });
    }
  }

  return questions;
}

function warnAboutGitignore(file: string, options: WarnOptions): Promise<void> {
  return isIgnored(file).then(({ ignored, root }) => {
    if (ignored || root === undefined) return;

    const pattern = relative(root, file).split(/[\\/]/u).pop() ?? "config.yml";

    warn(
      {
        title: `${pattern} holds your credentials and git is not ignoring it.`,
        detail: [
          `Add this line to .gitignore, then run this again:`,
          `  ${pattern}`,
          "Until you do, one `git add .` publishes everything in it.",
        ],
        key: "gitignore",
      },
      options,
    );
  });
}

/**
 * Read the config file, ask for whatever it does not answer, write it back, and hand it
 * over typed.
 *
 * There is no `ask` step in a setup script because asking is not a step: it is what
 * happens when a value is missing. A second run finds nothing missing and says so in one
 * line.
 */
export async function load<const TSchema extends ConfigSpec>(
  schema: TSchema,
  options: LoadOptions = {},
): Promise<Loaded<TSchema>> {
  const root = options.cwd ?? process.cwd();
  const file = resolve(root, options.file ?? "config.yml");
  const template =
    options.template === false
      ? undefined
      : resolve(root, options.template ?? "config.template.yml");
  const mode = options.ask ?? "missing";

  await warnAboutGitignore(file, options);

  let values = generateMissing(schema, await readConfig(file));

  const questions = questionsFor(schema, values, mode);

  if (questions.length === 0) {
    if (mode !== "never") note("every value is already answered");
  } else if (!isInteractive() || mode === "never") {
    // A question nobody can answer would hang a pipeline forever, so it is never asked.
    // Whatever is in the file is what this run gets, and the warning below says what that
    // left out.
    warn(
      {
        title: `${questions.length} value${questions.length === 1 ? " is" : "s are"} unanswered and there is no terminal to ask in.`,
        detail: [
          ...questions.map(({ section, key }) => `  ${section}.${key}`),
          `Fill them into ${relative(root, file) || file}, or run this again from a terminal.`,
        ],
        key: "no-tty",
      },
      options,
    );
  } else {
    values = merge(values, await ask(questions));
  }

  values = applyDefaults(schema, values);

  await writeConfig(file, schema, values);

  if (template !== undefined) await writeTemplate(template, schema);

  const loaded = createLoaded<TSchema>({
    schema,
    values,
    save: (next) => writeConfig(file, schema, next),
  });

  const absent = loaded.missing();

  if (absent.length > 0) {
    warn(
      {
        title: `${absent.length} required value${absent.length === 1 ? " has" : "s have"} nothing in them.`,
        detail: [...absent.map((path) => `  ${path}`), "Things that need them will not work."],
        key: "missing-required",
      },
      options,
    );
  }

  return loaded;
}
