/** One locale: flat map from key to text. Keys use dots, for example `dlg.ba_nghiem.greet`. */
export type Dictionary = Readonly<Record<string, string>>;

export interface Translator {
  /** Returns the text for `key`, with `{name}`-style params filled in. Never throws. */
  t(key: string, params?: Readonly<Record<string, string>>): string;
}

function lookup(dictionary: Dictionary | undefined, key: string): string | undefined {
  // Own properties only, so keys like "constructor" cannot resolve to Object.prototype members.
  if (!dictionary || !Object.hasOwn(dictionary, key)) {
    return undefined;
  }
  return dictionary[key];
}

function interpolate(text: string, params: Readonly<Record<string, string>> | undefined): string {
  if (!params) {
    return text;
  }
  return text.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
    Object.hasOwn(params, name) ? (params[name] ?? placeholder) : placeholder,
  );
}

/**
 * Builds a translator with a primary locale and an optional fallback. A missing key returns `[key]`
 * so the gap is visible on screen, and it is logged once. The game keeps running either way.
 */
export function createTranslator(
  dictionaries: Readonly<Record<string, Dictionary>>,
  primaryLocale: string,
  fallbackLocale?: string,
): Translator {
  const warned = new Set<string>();
  return {
    t(key, params) {
      const text =
        lookup(dictionaries[primaryLocale], key) ??
        (fallbackLocale ? lookup(dictionaries[fallbackLocale], key) : undefined);
      if (text === undefined) {
        if (!warned.has(key)) {
          warned.add(key);
          console.warn(`[i18n] Missing text for key "${key}" in locale "${primaryLocale}"`);
        }
        return `[${key}]`;
      }
      return interpolate(text, params);
    },
  };
}
