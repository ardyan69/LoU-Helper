// Tiny SVG charts for the dashboard (dark theme). Line chart with crosshair tooltip, stacked bar chart with
// per-bar tooltip. Series colors: validated categorical palette (dark surface), assigned in fixed order.
export const SERIES = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'];

let W = 760;
const H = 220, PAD = { l: 52, r: 12, t: 10, b: 26 };
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function niceMax(v) {
  if (!(v > 0)) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const m = v / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
}
function axisY(max, fmt) {
  let s = '';
  for (let i = 0; i <= 4; i++) {
    const v = (max * i) / 4, y = PAD.t + (H - PAD.t - PAD.b) * (1 - i / 4);
    s += `<line x1="${PAD.l}" x2="${W - PAD.r}" y1="${y}" y2="${y}" class="ch-grid"/><text x="${PAD.l - 6}" y="${y + 4}" class="ch-ax" text-anchor="end">${esc(fmt(v))}</text>`;
  }
  return s;
}
function legend(series) {
  if (series.length < 2) return '';
  return `<div class="ch-legend">${series.map((s) => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('')}</div>`;
}

// series: [{name, color, points: [[x(ms), y], …]}]
/**
 * @param {HTMLElement} el
 * @param {{ series: any[], yFmt?: (v: number) => any, xFmt?: (v: number, long?: boolean) => any, title?: string }} opts
 */
export function lineChart(el, { series, yFmt = (v) => v, xFmt = (v, _long) => v, title = '' }) {
  W = Math.max(360, Math.round(el.clientWidth || 760)); // draw at real pixel width so text stays small
  const pts = series.flatMap((s) => s.points);
  if (!pts.length) { el.innerHTML = '<div class="small muted">—</div>'; return; }
  const x0 = Math.min(...pts.map((p) => p[0])), x1 = Math.max(...pts.map((p) => p[0]));
  const ymax = niceMax(Math.max(...pts.map((p) => p[1] || 0)));
  const X = (x) => PAD.l + (x1 === x0 ? 0.5 : (x - x0) / (x1 - x0)) * (W - PAD.l - PAD.r);
  const Y = (y) => PAD.t + (1 - (y || 0) / ymax) * (H - PAD.t - PAD.b);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => x0 + (x1 - x0) * f);
  const xs = ticks.map((x, i) => `<text x="${X(x)}" y="${H - 6}" class="ch-ax" text-anchor="${i === 0 ? 'start' : i === 4 ? 'end' : 'middle'}">${esc(xFmt(x))}</text>`).join('');
  const paths = series.map((s) => s.points.length > 1
    ? `<path d="${s.points.map((p, i) => `${i ? 'L' : 'M'}${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join('')}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`
    : s.points.map((p) => `<circle cx="${X(p[0])}" cy="${Y(p[1])}" r="4" fill="${s.color}"/>`).join('')).join('');
  el.innerHTML = `${title ? `<div class="ch-title">${esc(title)}</div>` : ''}${legend(series)}
    <div class="ch-wrap"><svg viewBox="0 0 ${W} ${H}" class="ch" role="img" aria-label="${esc(title)}">${axisY(ymax, yFmt)}${xs}${paths}
      <line class="ch-cross" y1="${PAD.t}" y2="${H - PAD.b}" x1="-10" x2="-10"/><g class="ch-dots"></g>
      <rect x="${PAD.l}" y="${PAD.t}" width="${W - PAD.l - PAD.r}" height="${H - PAD.t - PAD.b}" fill="transparent" class="ch-hit"/></svg>
    <div class="ch-tip hide"></div></div>`;
  const CW = W;
  const svg = el.querySelector('svg'), tip = /** @type {HTMLElement} */ (el.querySelector('.ch-tip')), cross = el.querySelector('.ch-cross'), dots = el.querySelector('.ch-dots');
  const allX = [...new Set(pts.map((p) => p[0]))].sort((a, b) => a - b);
  const move = (ev) => {
    const r = svg.getBoundingClientRect();
    const sx = ((ev.clientX - r.left) / r.width) * CW;
    let best = allX[0];
    for (const x of allX) if (Math.abs(X(x) - sx) < Math.abs(X(best) - sx)) best = x;
    cross.setAttribute('x1', String(X(best))); cross.setAttribute('x2', String(X(best)));
    const rows = series.map((s) => { const p = s.points.find((q) => q[0] === best) || nearest(s.points, best); return p ? { s, p } : null; }).filter(Boolean);
    dots.innerHTML = rows.map(({ s, p }) => `<circle cx="${X(p[0])}" cy="${Y(p[1])}" r="4.5" fill="${s.color}" stroke="#1f1912" stroke-width="2"/>`).join('');
    tip.textContent = '';
    const h = document.createElement('b'); h.textContent = xFmt(best, true); tip.appendChild(h);
    for (const { s, p } of rows) { const d = document.createElement('div'); const i = document.createElement('i'); i.style.background = s.color; d.appendChild(i); d.appendChild(document.createTextNode(`${s.name}: ${yFmt(p[1])}`)); tip.appendChild(d); }
    tip.classList.remove('hide');
    const px = (X(best) / CW) * r.width;
    tip.style.left = `${Math.min(r.width - tip.offsetWidth - 4, Math.max(4, px + 12))}px`;
  };
  svg.addEventListener('pointermove', move);
  svg.addEventListener('pointerleave', () => { tip.classList.add('hide'); cross.setAttribute('x1', '-10'); cross.setAttribute('x2', '-10'); dots.innerHTML = ''; });
}
function nearest(points, x) {
  let b = null;
  for (const p of points) if (!b || Math.abs(p[0] - x) < Math.abs(b[0] - x)) b = p;
  return b && Math.abs(b[0] - x) < 3 * 3.6e6 ? b : null;
}

// bars: [{label, parts: [{name, color, v}]}] — stacked, 2px surface gaps
export function barChart(el, { bars, yFmt = (v) => v, title = '' }) {
  W = Math.max(360, Math.round(el.clientWidth || 760));
  if (!bars.length) { el.innerHTML = '<div class="small muted">—</div>'; return; }
  const ymax = niceMax(Math.max(...bars.map((b) => b.parts.reduce((s, p) => s + p.v, 0))));
  const iw = W - PAD.l - PAD.r, bw = Math.max(4, Math.min(28, iw / bars.length - 4));
  const Y = (v) => (v / ymax) * (H - PAD.t - PAD.b);
  let g = '';
  bars.forEach((b, i) => {
    const cx = PAD.l + (i + 0.5) * (iw / bars.length);
    let y = H - PAD.b;
    b.parts.forEach((p, j) => {
      const h = Y(p.v);
      if (h <= 0) return;
      const top = j === b.parts.length - 1 || b.parts.slice(j + 1).every((q) => !q.v);
      g += `<rect x="${cx - bw / 2}" y="${y - h + (j ? 0 : 0)}" width="${bw}" height="${Math.max(0, h - 2)}" fill="${p.color}" rx="${top ? 3 : 0}"/>`;
      y -= h;
    });
    g += `<rect x="${cx - iw / bars.length / 2}" y="${PAD.t}" width="${iw / bars.length}" height="${H - PAD.t - PAD.b}" fill="transparent" data-i="${i}" class="ch-bar"/>`;
    if (bars.length <= 16 || i % Math.ceil(bars.length / 10) === 0) g += `<text x="${cx}" y="${H - 6}" class="ch-ax" text-anchor="middle">${esc(b.label)}</text>`;
  });
  const names = bars[0].parts.map((p) => ({ name: p.name, color: p.color }));
  el.innerHTML = `${title ? `<div class="ch-title">${esc(title)}</div>` : ''}${legend(names)}
    <div class="ch-wrap"><svg viewBox="0 0 ${W} ${H}" class="ch" role="img" aria-label="${esc(title)}">${axisY(ymax, yFmt)}${g}</svg><div class="ch-tip hide"></div></div>`;
  const CW = W;
  const svg = el.querySelector('svg'), tip = el.querySelector('.ch-tip');
  svg.querySelectorAll('.ch-bar').forEach((r) => {
    r.addEventListener('pointerenter', () => {
      const b = bars[+r.dataset.i];
      tip.textContent = '';
      const h = document.createElement('b'); h.textContent = `${b.full || b.label} · ${yFmt(b.parts.reduce((s, p) => s + p.v, 0))}`; tip.appendChild(h);
      for (const p of b.parts) { const d = document.createElement('div'); const i = document.createElement('i'); i.style.background = p.color; d.appendChild(i); d.appendChild(document.createTextNode(`${p.name}: ${yFmt(p.v)}`)); tip.appendChild(d); }
      tip.classList.remove('hide');
      const rr = svg.getBoundingClientRect(), x = (+r.getAttribute('x') / CW) * rr.width;
      tip.style.left = `${Math.min(rr.width - tip.offsetWidth - 4, Math.max(4, x + 14))}px`;
    });
    r.addEventListener('pointerleave', () => tip.classList.add('hide'));
  });
}
