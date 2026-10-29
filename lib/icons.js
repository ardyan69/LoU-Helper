// Game icons for the dashboard. The content script caches the icons the game itself draws
// (Build bar + Guide) in chrome.storage.local as `gameIcons` { "English name": dataURI }.
// Here they are rasterised once to small PNGs and exposed as CSS classes, so a 21×21 map stays fast.
import { B, GAME_NAME_TO_CODE } from './city.js';

const SIZE = 64;
let ready = new Set();
let lastSig = '';

const slug = (code) => B[code]?.id || 'x';

// <i> with the game icon when we have it, otherwise the emoji fallback
export function ico(code, extra = '') {
  if (ready.has(code)) return `<i class="gi gi-${slug(code)} ${extra}" aria-hidden="true"></i>`;
  return `<span class="emo ${extra}">${B[code]?.ico || ''}</span>`;
}
export const hasIcon = (code) => ready.has(code);
export const iconCount = () => ready.size;
export const ICON_TOTAL = Object.keys(GAME_NAME_TO_CODE).length;
export const missingIcons = () => Object.entries(GAME_NAME_TO_CODE).filter(([, c]) => !ready.has(c)).map(([n]) => n);

function rasterise(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = c.height = SIZE;
        const g = c.getContext('2d');
        const w = img.naturalWidth || SIZE, h = img.naturalHeight || SIZE;
        const k = Math.min(SIZE / w, SIZE / h);
        g.drawImage(img, (SIZE - w * k) / 2, (SIZE - h * k) / 2, w * k, h * k);
        resolve(c.toDataURL('image/png'));
      } catch { resolve(src); }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// returns true when the icon set changed
export async function loadIcons() {
  const { gameIcons = {} } = await chrome.storage.local.get('gameIcons');
  const sig = Object.entries(gameIcons).map(([n, s]) => n + s.length).sort().join('|');
  if (sig === lastSig) return false;
  lastSig = sig;
  let css = '';
  const next = new Set();
  for (const [name, src] of Object.entries(gameIcons)) {
    const code = GAME_NAME_TO_CODE[name];
    if (!code) continue;
    const png = await rasterise(src);
    if (!png) continue;
    css += `.gi-${slug(code)}{background-image:url("${png}")}\n`;
    next.add(code);
  }
  let style = document.getElementById('game-icons');
  if (!style) { style = document.createElement('style'); style.id = 'game-icons'; document.head.appendChild(style); }
  style.textContent = css;
  ready = next;
  return true;
}
