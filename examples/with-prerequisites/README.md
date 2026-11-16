# with-prerequisites

Check the machine before asking anybody for anything.

```bash
pnpm example:prereq
```

Three checks run before the config is touched: Node at a version, pnpm at a version, and
docker as an optional extra. The report prints all of them, then the setup carries on or
stops with everything it found.

What is worth looking at:

- **Every check runs, always.** There is no stopping at the first failure. A setup that
  gives up on the first missing tool makes somebody install it, run again, and meet the
  next one, which turns a five minute job into four rounds of it. One pass, one list.
- **`fix` is the whole value of a failed check.** "Docker is not running" tells somebody
  what you already know. Saying what to run next is the part that saves them a search.
- **`optional: true` reports without failing.** Docker is missing on plenty of machines
  that can still run the app against something hosted, so the run continues and says so.
  That is a different thing from a check nobody wrote.
- **`version` is a range, not a number.** `">=22"` and `">=3.11 <4"` both work. A missing
  part is zero, so `">=3.11"` is satisfied by `3.11.5`.
- **The version is read out of both streams**, because `java -version` writes to stderr
  while most tools write to stdout, and a prerequisite check should not have to care.
- **Checks come first in the script.** There is no point asking for an API key and
  generating a session secret if the stack cannot start afterwards.

A check that needs more than an exit code takes a predicate:

```ts
{
  name: "Postgres",
  run: ["psql", "-tAc", "select 1"],
  ok: (result) => result.out.trim() === "1",
  fix: "docker compose up -d postgres",
}
```

And one whose output puts the wrong number first takes a `match`, whose first capture
group is read as the version:

```ts
{ name: "Weird", run: "weird --version", version: ">=9", match: /toolchain (\d+\.\d+\.\d+)/u }
```

Nothing here goes through a shell. A command written as a string splits on whitespace, and
an argument with a space in it goes in the array form.
