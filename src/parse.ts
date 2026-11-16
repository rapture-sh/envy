/**
 * Read a dotenv file back.
 *
 * Deliberately small: `KEY=value`, with `#` comments, an optional `export ` in front, and
 * single or double quotes around a value that needs them. It does not expand `$VAR`, does
 * not run anything, and does not try to be a shell, because the files envy reads are the
 * ones envy wrote.
 */
export function parseEnv(text: string): Record<string, string> {
  const values: Record<string, string> = {};
  const lines = text.split(/\r?\n/u);

  for (let at = 0; at < lines.length; at += 1) {
    const line = (lines[at] ?? "").trim();

    if (line === "" || line.startsWith("#")) continue;

    const body = line.startsWith("export ") ? line.slice(7).trim() : line;
    const divide = body.indexOf("=");

    if (divide < 1) continue;

    const name = body.slice(0, divide).trim();

    if (!/^[A-Za-z_][A-Za-z0-9_.]*$/u.test(name)) continue;

    values[name] = unquote(body.slice(divide + 1).trim());
  }

  return values;
}

function unquote(raw: string): string {
  if (raw.length > 1 && raw.startsWith('"') && raw.endsWith('"')) {
    return raw
      .slice(1, -1)
      .replace(/\\n/gu, "\n")
      .replace(/\\r/gu, "\r")
      .replace(/\\"/gu, '"')
      .replace(/\\\\/gu, "\\");
  }

  if (raw.length > 1 && raw.startsWith("'") && raw.endsWith("'")) return raw.slice(1, -1);

  // An unquoted value runs to the first comment marker, which is how every dotenv reader
  // treats one, and is why a value with a `#` in it is written quoted.
  const comment = raw.indexOf(" #");

  return (comment === -1 ? raw : raw.slice(0, comment)).trim();
}
