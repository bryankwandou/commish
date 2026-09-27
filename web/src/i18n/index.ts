import en, { type Dictionary } from "./en";
import id from "./id";
import es from "./es";
import zh from "./zh";

export const locales = ["en", "id", "es", "zh"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";

export const localeNames: Record<Locale, string> = {
  en: "English",
  id: "Bahasa Indonesia",
  es: "Español",
  zh: "中文",
};

const dictionaries: Record<Locale, Dictionary> = { en, id, es, zh };

export const hasLocale = (l: string): l is Locale => (locales as readonly string[]).includes(l);
export const getDictionary = (l: Locale): Dictionary => dictionaries[l];

/** Replace `{name}` placeholders. */
export function fmt(s: string, vars: Record<string, string | number>): string {
  return s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}

export type { Dictionary };
