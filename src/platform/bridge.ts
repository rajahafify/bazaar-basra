// Talks to the ikhlas.com app around the game (gdd 12.1, 12.2). Inside the app's web view the
// Flutter package adds a JavaScript channel named IkhlasGames; in a plain browser the calls are logged.
// Play events carry no names, phone numbers or anything personal.

interface Channel {
  postMessage(message: string): void;
}

declare global {
  interface Window {
    IkhlasGames?: Channel;
  }
}

export type PlayEvent =
  | 'game_start' | 'day_end' | 'week_end' | 'trip_start' | 'trip_event' | 'trip_end' | 'upgrade_buy' | 'went_broke'
  | 'zakat_paid' | 'sadaqah_given' | 'game_finish' | 'zakat_cta_tap' | 'share_tap';

function send(message: Record<string, unknown>) {
  const json = JSON.stringify(message);
  try {
    if (window.IkhlasGames) window.IkhlasGames.postMessage(json);
    else if (import.meta.env.DEV) console.debug('[bridge]', json);
  } catch {
    // The host going away must never break the game.
  }
}

export function emit(name: PlayEvent, params: Record<string, string | number> = {}) {
  send({ type: 'event', name, params });
}

/** Opens the ikhlas.com zakat page through the app's own router (gdd 6.5). */
export function openZakatPage() {
  emit('zakat_cta_tap');
  send({ type: 'open_zakat' });
}

/** Shares the year card: the app's share sheet, else the browser's, else nothing. */
export async function share(text: string) {
  emit('share_tap');
  if (window.IkhlasGames) { send({ type: 'share', text }); return; }
  try {
    if (navigator.share) await navigator.share({ text });
  } catch {
    // Cancelled by the player.
  }
}
