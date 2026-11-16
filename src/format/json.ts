export type JsonOptions = {
  /** Spaces per level. Two by default, which is what most tools write. */
  indent?: number;
};

/**
 * Render JSON.
 *
 * No header: JSON has no comments, so there is nowhere to say the file is generated. A
 * file written this way is the one kind `write` cannot warn about before replacing.
 */
export function json(value: unknown, options: JsonOptions = {}): string {
  return `${JSON.stringify(value, null, options.indent ?? 2)}\n`;
}
