import { describe, expect, it } from 'vitest';
import en from '../en.json';
import ms from '../ms.json';
import { fmt, money } from '../index';

function shape(v: unknown): unknown {
  if (Array.isArray(v)) return `list of ${v.length}`;
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shape(x)]));
  return 'text';
}

function texts(v: unknown): string[] {
  if (typeof v === 'string') return [v];
  if (Array.isArray(v)) return v.flatMap(texts);
  if (v && typeof v === 'object') return Object.values(v).flatMap(texts);
  return [];
}

describe('strings', () => {
  it('has the same keys in BM and EN', () => {
    expect(shape(ms)).toEqual(shape(en));
  });

  it('keeps every text box under 30 words (style guide 7.1)', () => {
    for (const s of [...texts(en), ...texts(ms)]) expect(s.split(/\s+/).length, s).toBeLessThanOrEqual(30);
  });

  it('fills placeholders and formats money', () => {
    expect(fmt('Rent {n}', { n: 10 })).toBe('Rent 10');
    expect(money(12.5)).toBe('12.5');
    expect(money(7)).toBe('7');
  });
});
