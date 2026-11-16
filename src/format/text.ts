import { GENERATED } from "../write.js";

export type TextOptions = {
  /** Lines above the content, as comments. `false` writes no header. */
  header?: string | string[] | false;
  /** What starts a comment line. `#` suits most config files; use `//` for the rest. */
  comment?: string;
};

const DEFAULT_HEADER = `${GENERATED}. Run the setup again rather than editing this file.`;

/**
 * Put a header on some text and leave the rest alone.
 *
 * For a file envy knows nothing about: a Caddyfile, an nginx conf, a tfvars. The caller
 * renders the body however it likes and this only adds the line saying the file is
 * generated, which is what stops somebody editing it and losing the change.
 */
export function text(content: string, options: TextOptions = {}): string {
  const { header = DEFAULT_HEADER, comment = "#" } = options;
  const body = content.endsWith("\n") ? content : `${content}\n`;

  if (header === false) return body;

  const lines = [header].flat().map((line) => (line === "" ? comment : `${comment} ${line}`));

  return `${lines.join("\n")}\n\n${body}`;
}
