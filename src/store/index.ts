import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { ConfigSpec } from "../define.js";
import { Fail } from "../errors.js";
import { type StoreData, toStoreData } from "./data.js";
import { renderConfig } from "./render.js";
import { yamlModule } from "./yaml.js";

export type { StoreData } from "./data.js";

/**
 * Read a config file. A file that is not there is not an error: it is a machine that has
 * not been set up yet, which is the ordinary case on a fresh clone.
 */
export async function readConfig(path: string): Promise<StoreData> {
  let text: string;

  try {
    text = await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};

    throw new Fail(`${path} could not be read: ${(error as Error).message}`);
  }

  const { parse } = await yamlModule();

  try {
    return toStoreData(parse(text));
  } catch (error) {
    throw new Fail(`${path} is not valid YAML: ${(error as Error).message}`);
  }
}

async function writeText(path: string, text: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, text, "utf8");
}

/**
 * Write the answers back.
 *
 * Rewritten in full from the schema rather than patched, so the file stays in schema order
 * and a run produces the same bytes as the one before it. Values the schema does not know
 * about are carried through rather than dropped.
 */
export async function writeConfig(
  path: string,
  schema: ConfigSpec,
  values: StoreData,
): Promise<void> {
  await writeText(path, renderConfig(schema, values, { template: false }));
}

/**
 * Write the committed template: the shape and the comments, with every credential blank.
 *
 * It is rendered from the schema alone. Nothing in `values` reaches it, which is what
 * keeps a credential out of a file that is committed.
 */
export async function writeTemplate(path: string, schema: ConfigSpec): Promise<void> {
  await writeText(path, renderConfig(schema, {}, { template: true }));
}

export { toStoreData, valueAt, withValue } from "./data.js";
export { renderConfig } from "./render.js";
export { quoteValue } from "./yaml.js";
