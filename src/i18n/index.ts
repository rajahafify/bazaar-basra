// BM and EN strings, written together (style guide 7.1). One JSON file per language (gdd 12).

import en from './en.json';
import ms from './ms.json';

export type Lang = 'ms' | 'en';
export type Strings = typeof en;

const TABLES: Record<Lang, Strings> = { en, ms };

let current: Lang = 'ms';

export function setLang(lang: Lang) {
  current = lang;
}

export function lang(): Lang {
  return current;
}

/** The current language's strings. */
export function L(): Strings {
  return TABLES[current];
}

/** Fills {name} placeholders. */
export function fmt(s: string, vars: Record<string, string | number> = {}): string {
  return s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`));
}

/** Formats dirham amounts: whole numbers stay whole, fractions keep one decimal. */
export function money(n: number): string {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}
