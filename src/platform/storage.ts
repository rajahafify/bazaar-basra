// One save slot in web view local storage (gdd 10). Storage can be blocked or cleared,
// so every call is guarded and the game simply starts from the prologue.

import { deserialize, serialize, type GameState } from '../sim';
import type { Lang } from '../i18n';

const SAVE_KEY = 'bazaar-basra.save.v1';
const LANG_KEY = 'bazaar-basra.lang';

export function loadGame(): GameState | null {
  try { return deserialize(localStorage.getItem(SAVE_KEY)); } catch { return null; }
}

export function saveGame(s: GameState) {
  try { localStorage.setItem(SAVE_KEY, serialize(s)); } catch { /* storage blocked */ }
}

export function clearGame() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* storage blocked */ }
}

export function loadLang(): Lang | null {
  try { const v = localStorage.getItem(LANG_KEY); return v === 'en' || v === 'ms' ? v : null; } catch { return null; }
}

export function saveLang(lang: Lang) {
  try { localStorage.setItem(LANG_KEY, lang); } catch { /* storage blocked */ }
}
