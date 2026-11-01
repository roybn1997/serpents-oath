// Which game the page is: the campaign (the story, chapters) or online (Roy, v31b: "BETA ONLINE" in the launcher).
// In order: ?mode=online (tests, dev, the browser), the launcher's choice (window.soShell.mode from
// launcher/app/game-preload.js, 'online' when the player started BETA ONLINE), else the campaign.
// Read once per page: the launcher opens a fresh game window for each start, so the mode never changes while it runs.
export function gameMode(search) {
  let q = null;
  try { q = new URLSearchParams(search ?? (typeof location === 'undefined' ? '' : location.search)).get('mode'); } catch { q = null; }
  if (q === 'online') return 'online';
  if (q === 'campaign') return 'campaign';
  return globalThis.soShell?.mode === 'online' ? 'online' : 'campaign';
}
export const isOnline = () => gameMode() === 'online';
