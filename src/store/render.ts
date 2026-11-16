import type { ConfigSpec } from "../define.js";
import { toKebab } from "../naming.js";
import type { StoreData } from "./data.js";
import { quoteValue } from "./yaml.js";

const CONFIG_HEADER = [
  "Your answers for this machine. Never committed: it holds credentials.",
  "`pnpm setup` writes this file and asks for whatever it is missing.",
];

const TEMPLATE_HEADER = [
  "Every value the setup can ask for, with the credentials blank.",
  "Copy it to config.yml and fill in what you have, or just run the setup and answer.",
  "",
  "Generated. Run the setup to rewrite it rather than editing it by hand.",
];

function comment(lines: string[], indent = ""): string[] {
  return lines.map((text) => (text === "" ? `${indent}#` : `${indent}# ${text}`));
}

function entry(key: string, value: string): string {
  return `  ${key}: ${value === "" ? "" : quoteValue(value)}`.trimEnd();
}

/**
 * What a value shows in the template: the example if the schema gave one, the default if
 * it did not, and nothing otherwise.
 *
 * Never an answer. The template is committed, so anything that came out of `config.yml`
 * reaching it would publish a credential, which is the one thing this file must not do.
 */
function templateValue(example: string | undefined, fallback: string | undefined): string {
  return example ?? fallback ?? "";
}

export type RenderOptions = {
  /**
   * Render the committed template rather than the answers: examples instead of values,
   * every comment the schema carries, and no generated values, which are produced rather
   * than answered.
   */
  template: boolean;
};

/**
 * Turn a schema and a set of values into the text of a config file.
 *
 * Written by hand rather than through the YAML library because the comments, the ordering
 * and the grouping are the whole point of this file, and a serialiser that reorders keys
 * or drops a comment would make every run produce a different diff.
 *
 * Sections and values come out in schema order, so the file reads the way the schema does.
 * Anything already in the file that the schema does not know about is kept, after the
 * values that it does, because a person may have put it there on purpose.
 */
export function renderConfig(
  schema: ConfigSpec,
  values: StoreData,
  options: RenderOptions,
): string {
  const lines: string[] = comment(options.template ? TEMPLATE_HEADER : CONFIG_HEADER);
  const known = new Set<string>();

  for (const [section, spec] of Object.entries(schema)) {
    const fileSection = toKebab(section);
    const stored = values[fileSection] ?? {};
    const body: string[] = [];
    const seen = new Set<string>();

    known.add(fileSection);

    for (const [key, value] of Object.entries(spec.values)) {
      const fileKey = toKebab(key);

      seen.add(fileKey);

      if (options.template) {
        if (value.generate !== undefined) continue;

        body.push(...comment(describeValue(value), "  "));
        body.push(entry(fileKey, templateValue(value.example, value.default)));

        continue;
      }

      body.push(entry(fileKey, stored[fileKey] ?? ""));
    }

    if (!options.template) {
      for (const [fileKey, value] of Object.entries(stored)) {
        if (!seen.has(fileKey)) body.push(entry(fileKey, value));
      }
    }

    if (body.length === 0) continue;

    lines.push("");
    lines.push(...comment(sectionHeading(section, spec.title, spec.note)));
    lines.push(`${fileSection}:`);
    lines.push(...body);
  }

  if (!options.template) {
    for (const [section, stored] of Object.entries(values)) {
      if (known.has(section)) continue;

      lines.push("");
      lines.push(`${section}:`);

      for (const [key, value] of Object.entries(stored)) lines.push(entry(key, value));
    }
  }

  return `${lines.join("\n")}\n`;
}

function sectionHeading(
  name: string,
  title: string | undefined,
  note: string | undefined,
): string[] {
  const heading = [title ?? name];

  if (note !== undefined) heading.push(note);

  return heading;
}

function describeValue(value: {
  describe?: string;
  where?: string;
  without?: string;
  required?: boolean;
}): string[] {
  const lines: string[] = [];

  if (value.describe !== undefined) lines.push(value.describe);
  if (value.where !== undefined) lines.push(value.where);

  if (value.required === true) {
    lines.push("Required.");
  } else if (value.without !== undefined) {
    lines.push(`Optional. Empty and ${value.without}.`);
  }

  return lines;
}
