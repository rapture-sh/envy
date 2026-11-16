/** A config file as envy holds it: section, then value, both already in file spelling. */
export type StoreData = Record<string, Record<string, string>>;

function asText(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);

  // `key:` with nothing after it parses as null, and that is how an unanswered value is
  // written, so it is an empty answer rather than something to complain about.
  if (value === null || value === undefined) return "";

  return undefined;
}

/**
 * Narrow whatever the YAML parser produced into the two-level map of strings envy works
 * in.
 *
 * Anything that is not a section of scalars is dropped rather than refused. A config file
 * is hand edited, and failing the whole setup because somebody left a list in it would be
 * a worse answer than ignoring the list.
 */
export function toStoreData(parsed: unknown): StoreData {
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};

  const data: StoreData = {};

  for (const [section, values] of Object.entries(parsed)) {
    if (typeof values !== "object" || values === null || Array.isArray(values)) continue;

    const entries: Record<string, string> = {};

    for (const [key, value] of Object.entries(values)) {
      const text = asText(value);

      if (text !== undefined) entries[key] = text;
    }

    data[section] = entries;
  }

  return data;
}

export function valueAt(data: StoreData, section: string, key: string): string | undefined {
  const value = data[section]?.[key];

  return value === undefined || value === "" ? undefined : value;
}

export function withValue(data: StoreData, section: string, key: string, value: string): StoreData {
  return { ...data, [section]: { ...data[section], [key]: value } };
}
