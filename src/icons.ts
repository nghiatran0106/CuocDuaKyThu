const paths: Record<string, string> = {
  flag: '<path d="M4 22V3m0 1c6-4 10 4 16 0v11c-6 4-10-4-16 0"/><path d="M9 3v11m6-9v11M4 9c6-4 10 4 16 0"/>',
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
  users:
    '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M16 3a4 4 0 0 1 0 8"/><circle cx="9" cy="7" r="4"/>',
  map: '<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15m6-12v15"/>',
  bolt: '<path d="m13 2-9 12h7l-1 8 10-12h-7z"/>',
  trophy:
    '<path d="M8 3h8v5a4 4 0 0 1-8 0zm0 1H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4m-4 1v7m-5 2h10m-8-3h6"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  sound:
    '<path d="m11 5-6 4H2v6h3l6 4zM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  mute: '<path d="m11 5-6 4H2v6h3l6 4zM16 9l5 6m0-6-5 6"/>',
  gear: '<path d="m10 3 4 0 1 3 3-1 2 3-2 3 2 3-2 3-3-1-1 3h-4l-1-3-3 1-2-3 2-3-2-3 2-3 3 1z"/><circle cx="12" cy="11" r="3"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 5 2c-2 1-2 2-2 3m0 3h.01"/>',
  coin: '<circle cx="12" cy="12" r="9"/><path d="M14 8h-3a2 2 0 0 0 0 4h2a2 2 0 0 1 0 4h-3m2-10v2m0 8v2"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  play: '<path d="m8 4 13 8-13 8z" fill="currentColor" stroke="none"/>',
  pause: '<path d="M8 5v14m8-14v14" stroke-width="4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  spark: '<path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3zM20 2v4m-2-2h4"/>',
  gamepad:
    '<path d="M7 7h10a4 4 0 0 1 4 3l2 8a2 2 0 0 1-3 2l-4-3H8l-4 3a2 2 0 0 1-3-2l2-8a4 4 0 0 1 4-3zM7 10v4m-2-2h4m7-1h.01m3 3h.01"/>',
  fullscreen: '<path d="M3 9V3h6m6 0h6v6m0 6v6h-6M9 21H3v-6"/>',
  copy: '<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
  leaf: '<path d="M20 3C5 1 1 10 6 16s17 1 14-13zM4 21l11-12"/>',
  heart:
    '<path d="M20 5a5 5 0 0 0-8 1 5 5 0 0 0-8-1c-6 6 8 15 8 15S26 11 20 5z"/>',
  medal:
    '<circle cx="12" cy="9" r="6"/><path d="m8 14-2 8 6-3 6 3-2-8m-4-8v6m-3-3h6"/>',
  return: '<path d="m9 5-6 6 6 6m-6-6h11a6 6 0 0 1 6 6v3"/>',
  wifi: '<path d="M2 8a16 16 0 0 1 20 0M5 12a11 11 0 0 1 14 0m-10 4a5 5 0 0 1 6 0m-3 4h.01"/>',
};
export function icon(name: string, size = 20) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.spark}</svg>`;
}
