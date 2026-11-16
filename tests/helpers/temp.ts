import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * A directory of its own per test, removed afterwards. Nothing in this suite writes
 * anywhere else.
 */
export async function withTempDir<T>(work: (directory: string) => Promise<T>): Promise<T> {
  const directory = await mkdtemp(join(tmpdir(), "envy-test-"));

  try {
    return await work(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
