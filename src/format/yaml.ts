import { yamlStringify } from "../store/yaml.js";
import { GENERATED } from "../write.js";

export type YamlOptions = {
  /** Lines above the document, as comments. `false` writes no header. */
  header?: string | string[] | false;
};

const DEFAULT_HEADER = `${GENERATED}. Run the setup again rather than editing this file.`;

/**
 * Render a YAML document.
 *
 * Through the `yaml` peer rather than by hand, because this takes whatever shape a caller
 * passes it: nested maps, lists, numbers. The config file is written by hand instead,
 * since its comments and ordering are the point of it and this is not.
 */
export async function yaml(value: unknown, options: YamlOptions = {}): Promise<string> {
  const { header = DEFAULT_HEADER } = options;
  const body = await yamlStringify(value);

  if (header === false) return body;

  const lines = [header].flat().map((line) => (line === "" ? "#" : `# ${line}`));

  return `${lines.join("\n")}\n\n${body}`;
}
