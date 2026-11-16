import { vi } from "vitest";

/**
 * Everything envy prints goes through `process.stdout.write` and `process.stderr.write`,
 * so capturing both is capturing all of it. Tests assert on the result, including the
 * assertion that a known value never appears in it.
 */
export async function capture(work: () => unknown): Promise<string> {
  const chunks: string[] = [];

  const record = (chunk: unknown): boolean => {
    chunks.push(String(chunk));

    return true;
  };

  const out = vi.spyOn(process.stdout, "write").mockImplementation(record);
  const err = vi.spyOn(process.stderr, "write").mockImplementation(record);

  try {
    await work();
  } finally {
    out.mockRestore();
    err.mockRestore();
  }

  return chunks.join("");
}

/** Pretends there is, or is not, a terminal. Returns the undo. */
export function setInteractive(value: boolean): () => void {
  const descriptor = Object.getOwnPropertyDescriptor(process.stdout, "isTTY");

  Object.defineProperty(process.stdout, "isTTY", { value, configurable: true });

  return () => {
    if (descriptor === undefined) {
      Reflect.deleteProperty(process.stdout, "isTTY");
    } else {
      Object.defineProperty(process.stdout, "isTTY", descriptor);
    }
  };
}

/** Sets an environment variable for one test, including unsetting it. Returns the undo. */
export function setEnv(name: string, value: string | undefined): () => void {
  const before = process.env[name];

  if (value === undefined) {
    Reflect.deleteProperty(process.env, name);
  } else {
    process.env[name] = value;
  }

  return () => {
    if (before === undefined) {
      Reflect.deleteProperty(process.env, name);
    } else {
      process.env[name] = before;
    }
  };
}
