import { randomBytes } from "node:crypto";
import type { GenerateSpec } from "./define.js";

const DEFAULT_BYTES = 32;

/**
 * Produce a value nobody has to be asked for.
 *
 * `base64url` by default because the result goes into a `.env`, a YAML file and sometimes
 * a shell environment, and it is the only common encoding that needs no quoting in any of
 * them. The bytes are the strength; the encoding is just how they are spelled.
 */
export function generateValue(spec: GenerateSpec = {}): string {
  const bytes = spec.bytes ?? DEFAULT_BYTES;

  if (!Number.isInteger(bytes) || bytes < 1) {
    throw new TypeError(`A generated value needs a whole number of bytes, not ${bytes}.`);
  }

  return randomBytes(bytes).toString(spec.encoding ?? "base64url");
}
