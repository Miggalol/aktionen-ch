'use strict';

const SHOPS = {
  migros: { name: 'Migros', c: '#ff6600' },
  coop:   { name: 'Coop',   c: '#e2001a' },
  aldi:   { name: 'Aldi',   c: '#00205b' },
  lidl:   { name: 'Lidl',   c: '#0050aa', ci: '#ffe500' },
  denner: { name: 'Denner', c: '#a3001b' },
  spar:   { name: 'Spar',   c: '#00843d' },
  volg:   { name: 'Volg',   c: '#ffd400', ci: '#c4161c' },
};
const PAGE = 60;
const IMPORT_KEY = 'aktionen-imports-v1';
const IMPORT_MAX_AGE_DAYS = 10;

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const chf = (v) => (v == null ? '' : v.toFixed(2));
const today = new Date().toLocaleDateString('sv-SE');

/** Normalisiert für die Suche: Kleinschreibung, ohne Akzente, ä/ae -> a usw. */
function norm(s) {
  return String(s || '').toLowerCase()
    .replace(/ä|ae/g, 'a').replace(/ö|oe/g, 'o').replace(/ü|ue/g, 'u').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9%]+/g, ' ').trim();
}

const state = { q: '', shops: new Set(Object.keys(SHOPS)), sort: 'discount', min: 0, shown: PAGE };
let base = { deals: [], shops: [], updated: null };
let all = [];

/* ---------- Lokaler Speicher für Browser-Importe ---------- */
function loadImports() {
  try {
    const raw = JSON.parse(localStorage.getItem(IMPORT_KEY) || '{}');
    const cutoff = Date.now() - IMPORT_MAX_AGE_DAYS * 86400000;
    for (const k of Object.keys(raw)) if (!raw[k] || Date.parse(raw[k].at) < cutoff) delete raw[k];
    return raw;
  } catch { return {}; }
}
function saveImports(imp) {
  try { localStorage.setItem(IMPORT_KEY, JSON.stringify(imp)); return true; } catch { return false; }
}
let imports = loadImports();

const safeUrl = (u) => (typeof u === 'string' && /^https?:\/\//i.test(u) ? u.slice(0, 1000) : null);
const num = (v) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v < 100000 ? Math.round(v * 100) / 100 : null);
const str = (v, n) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, n) : '');

/** Prüft und bereinigt Daten aus dem Lesezeichen (kommen von einer fremden Seite). */
function acceptImport(payload) {
  if (!payload || payload.v !== 1 || !SHOPS[payload.shop] || !Array.isArray(payload.deals)) throw new Error('Ungültige Importdaten');
  const deals = payload.deals.slice(0, 2000).map((d) => {
    const price = num(d.price), oldPrice = num(d.oldPrice);
    let discount = Number.isInteger(d.discount) && d.discount > 0 && d.discount < 100 ? d.discount : null;
    if (discount == null && price != null && oldPrice > price) discount = Math.round((oldPrice - price) / oldPrice * 100);
    return {
      shop: payload.shop, name: str(d.name, 160), description: str(d.description, 300),
      price, oldPrice: oldPrice > (price ?? 0) ? oldPrice : null, discount, discountText: str(d.discountText, 30),
      validText: str(d.validText, 60), validTo: null, image: safeUrl(d.image), url: safeUrl(d.url),
      source: 'Import', imported: true,
    };
  }).filter((d) => d.name.length > 1);
  if (!deals.length) throw new Error('Keine Aktionen in den Importdaten gefunden');
  imports[payload.shop] = { at: new Date().toISOString(), url: safeUrl(payload.url), deals };
  saveImports(imports);
  return deals.length;
}

function handleHashImport() {
  const m = location.hash.match(/^#import=(.+)$/s);
  if (!m) return;
  history.replaceState(null, '', location.pathname + location.search);
  try {
    const payload = JSON.parse(decodeURIComponent(m[1]));
    const n = acceptImport(payload);
    toast(`${n} Aktionen von ${SHOPS[payload.shop].name} importiert`);
  } catch (e) { toast('Import fehlgeschlagen: ' + e.message); }
}

/* ---------- Daten zusammenführen ---------- */
function merge() {
  const map = new Map();
  const add = (d) => {
    if (d.validTo && d.validTo < today) return; // abgelaufen
    const key = d.shop + '|' + norm(d.name) + '|' + (d.price ?? '');
    if (map.has(key)) return; // automatische Daten haben Vorrang
    d._n = norm(d.name + ' ' + (SHOPS[d.shop]?.name || ''));
    // Beschreibung ohne Zutatenliste, nur Wortanfänge zählen (damit «Butter» nicht «Kakaobutter» findet)
    d._d = ' ' + norm(String(d.description || '').split(/zutaten|ingrédients|ingredienti/i)[0]);
    d._saving = d.price != null && d.oldPrice != null ? d.oldPrice - d.price : null;
    map.set(key, d);
  };
  base.deals.forEach(add);
  Object.values(imports).forEach((imp) => imp.deals.forEach(add));
  all = [...map.values()];
}

/* ---------- Filtern, Sortieren, Anzeigen ---------- */
function matches(d, words) {
  return words.every((w) => d._n.includes(w) || d._d.includes(' ' + w));
}

const sorters = {
  discount: (a, b) => (b.discount ?? -1) - (a.discount ?? -1) || (b._saving ?? -1) - (a._saving ?? -1),
  saving: (a, b) => (b._saving ?? -1) - (a._saving ?? -1) || (b.discount ?? -1) - (a.discount ?? -1),
  price: (a, b) => (a.price ?? 1e9) - (b.price ?? 1e9),
  name: (a, b) => a.name.localeCompare(b.name, 'de-CH'),
};

function render() {
  const words = norm(state.q).split(' ').filter(Boolean);
  const base1 = all.filter((d) => matches(d, words) && (state.min === 0 || (d.discount ?? 0) >= state.min));
  const counts = {};
  base1.forEach((d) => { counts[d.shop] = (counts[d.shop] || 0) + 1; });
  renderChips(counts);

  const list = base1.filter((d) => state.shops.has(d.shop)).sort(sorters[state.sort]);
  const shown = list.slice(0, state.shown);
  $('#grid').innerHTML = shown.map(card).join('');
  $('#count').textContent = list.length
    ? `${list.length.toLocaleString('de-CH')} Aktionen${state.q ? ` für «${state.q}»` : ''}`
    : '';
  $('#empty').hidden = list.length > 0;
  $('#moreBtn').hidden = list.length <= state.shown;
  $('#moreBtn').textContent = `Mehr anzeigen (${(list.length - state.shown).toLocaleString('de-CH')} weitere)`;
}

function card(d) {
  const s = SHOPS[d.shop] || { name: d.shop, c: '#666' };
  const badge = d.discount != null
    ? `<span class="badge">−${d.discount}%</span>`
    : `<span class="badge soft">${esc(d.discountText || 'Aktion')}</span>`;
  const img = d.image
    ? `<img src="${esc(d.image)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'ph',textContent:'🛒'}))">`
    : '<span class="ph" aria-hidden="true">🛒</span>';
  const valid = d.validTo
    ? `bis ${new Date(d.validTo + 'T12:00').toLocaleDateString('de-CH', { weekday: 'short', day: 'numeric', month: 'numeric' })}`
    : esc(d.validText);
  const tag = d.url ? 'a' : 'div';
  const href = d.url ? ` href="${esc(d.url)}" target="_blank" rel="noopener noreferrer"` : '';
  return `<${tag} class="card" style="--c:${s.c};--ci:${s.ci || '#fff'}"${href}>
    <div class="img">${img}</div>${badge}<span class="shop">${esc(s.name)}</span>
    <div class="body">
      <h3 class="name">${esc(d.name)}</h3>
      ${d.description ? `<p class="desc" title="${esc(d.description)}">${esc(d.description)}</p>` : ''}
      <div class="prices">
        ${d.price != null ? `<span class="price">${d.priceIsExample ? '<span class="ex">z.B.</span> ' : ''}${chf(d.price)}</span>` : ''}
        ${d.oldPrice != null ? `<span class="old">statt ${chf(d.oldPrice)}</span>` : ''}
      </div>
      <div class="meta"><span>${valid}</span><span class="src">${d.imported ? 'Import' : esc(d.source === 'direkt' ? '' : d.source)}</span></div>
    </div></${tag}>`;
}

function renderChips(counts) {
  const el = $('#shops');
  const allOn = state.shops.size === Object.keys(SHOPS).length;
  el.innerHTML = Object.entries(SHOPS).map(([id, s]) => {
    const n = counts[id] || 0;
    return `<button type="button" class="chip" data-shop="${id}" style="--c:${s.c}" aria-pressed="${state.shops.has(id)}">
      <span class="dot"></span>${esc(s.name)}<span class="n">${n}</span></button>`;
  }).join('') + (allOn ? '' : '<button type="button" class="chip" data-shop="*" style="--c:var(--ink)" aria-pressed="true">Alle</button>');
}

function renderStatus() {
  const items = base.shops.map((s) => {
    const imp = imports[s.id];
    if (s.count) return `<li>${esc(SHOPS[s.id]?.name || s.name)}: ${s.count} <span title="Quelle">(${esc(s.source)})</span></li>`;
    if (imp) return `<li>${esc(SHOPS[s.id]?.name)}: ${imp.deals.length} (Import vom ${new Date(imp.at).toLocaleDateString('de-CH')})</li>`;
    return `<li class="bad" title="${esc(s.errors.join(' | '))}">${esc(SHOPS[s.id]?.name || s.name)}: keine automatischen Daten – <button class="linkish" data-open-import>Browser-Import nutzen</button></li>`;
  });
  const upd = base.updated ? new Date(base.updated).toLocaleString('de-CH', { dateStyle: 'medium', timeStyle: 'short' }) : '–';
  $('#status').innerHTML = `<p>Stand der automatischen Daten: <strong>${upd}</strong></p><ul class="status-list">${items.join('')}</ul>`;
  const shopsWithData = new Set(all.map((d) => d.shop)).size;
  $('#subline').textContent = `${all.length.toLocaleString('de-CH')} Aktionen aus ${shopsWithData} Läden · Stand ${upd}`;
}

/* ---------- Import-Dialog & Lesezeichen ---------- */
let bookmarkletCode = '';
async function buildBookmarklet() {
  try {
    const src = await (await fetch('bookmarklet.js', { cache: 'no-cache' })).text();
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\n\s*\n/g, '\n').trim();
    const site = location.origin + location.pathname;
    bookmarkletCode = 'javascript:' + encodeURIComponent(`(${code})(${JSON.stringify(site)})`);
    $('#bookmarklet').href = bookmarkletCode;
  } catch { /* Lesezeichen nicht verfügbar, z.B. bei file:// */ }
}

function renderImportList() {
  const entries = Object.entries(imports);
  $('#importList').innerHTML = entries.length ? `<div class="imp"><strong>Importiert (bleibt ${IMPORT_MAX_AGE_DAYS} Tage gespeichert)</strong><ul>${
    entries.map(([id, imp]) => `<li><span>${esc(SHOPS[id]?.name || id)}: ${imp.deals.length} Aktionen · ${new Date(imp.at).toLocaleString('de-CH', { dateStyle: 'short', timeStyle: 'short' })}</span>
      <button type="button" class="linkish" data-del="${esc(id)}">entfernen</button></li>`).join('')
  }</ul></div>` : '';
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toast._t); toast._t = setTimeout(() => { t.hidden = true; }, 4500);
}

function refresh() { merge(); renderStatus(); render(); renderImportList(); }

function syncUrl() {
  const p = new URLSearchParams();
  if (state.q) p.set('q', state.q);
  if (state.sort !== 'discount') p.set('sort', state.sort);
  if (state.min) p.set('min', state.min);
  if (state.shops.size !== Object.keys(SHOPS).length) p.set('laden', [...state.shops].join(','));
  history.replaceState(null, '', location.pathname + (p.toString() ? '?' + p : ''));
}

function readUrl() {
  const p = new URLSearchParams(location.search);
  state.q = p.get('q') || '';
  if (sorters[p.get('sort')]) state.sort = p.get('sort');
  state.min = [0, 20, 30, 40, 50].includes(+p.get('min')) ? +p.get('min') : 0;
  const l = (p.get('laden') || '').split(',').filter((x) => SHOPS[x]);
  if (l.length) state.shops = new Set(l);
  $('#q').value = state.q; $('#sort').value = state.sort; $('#min').value = String(state.min);
}

/* ---------- Ereignisse ---------- */
let qTimer;
$('#q').addEventListener('input', (e) => {
  clearTimeout(qTimer);
  qTimer = setTimeout(() => { state.q = e.target.value.trim(); state.shown = PAGE; render(); syncUrl(); }, 120);
});
$('#sort').addEventListener('change', (e) => { state.sort = e.target.value; state.shown = PAGE; render(); syncUrl(); });
$('#min').addEventListener('change', (e) => { state.min = +e.target.value; state.shown = PAGE; render(); syncUrl(); });
$('#moreBtn').addEventListener('click', () => { state.shown += PAGE * 2; render(); });
$('#shops').addEventListener('click', (e) => {
  const b = e.target.closest('[data-shop]'); if (!b) return;
  const id = b.dataset.shop, ids = Object.keys(SHOPS);
  if (id === '*') state.shops = new Set(ids);
  else if (state.shops.size === ids.length) state.shops = new Set([id]);          // erster Klick: nur dieser Laden
  else if (state.shops.has(id) && state.shops.size === 1) state.shops = new Set(ids); // letzter abgewählt: alle
  else state.shops.has(id) ? state.shops.delete(id) : state.shops.add(id);
  state.shown = PAGE; render(); syncUrl();
});
const openImport = () => { renderImportList(); $('#importDlg').showModal(); };
$('#importBtn').addEventListener('click', openImport);
document.addEventListener('click', (e) => { if (e.target.closest('[data-open-import]')) openImport(); });
$('#importList').addEventListener('click', (e) => {
  const id = e.target.dataset.del; if (!id) return;
  delete imports[id]; saveImports(imports); refresh();
});
$('#copyBm').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(bookmarkletCode); toast('Lesezeichen-Code kopiert'); } catch { toast('Kopieren nicht möglich'); }
});
$('#pasteBtn').addEventListener('click', () => {
  try {
    const payload = JSON.parse($('#pasteBox').value);
    const n = acceptImport(payload); $('#pasteBox').value = '';
    toast(`${n} Aktionen von ${SHOPS[payload.shop].name} importiert`); refresh();
  } catch (e) { toast('Import fehlgeschlagen: ' + e.message); }
});
window.addEventListener('hashchange', () => { handleHashImport(); refresh(); });

/* ---------- Start ---------- */
(async function init() {
  readUrl();
  handleHashImport();
  buildBookmarklet();
  try {
    const res = await fetch('data/deals.json', { cache: 'no-cache' });
    base = await res.json();
  } catch {
    $('#subline').textContent = 'Automatische Daten konnten nicht geladen werden.';
  }
  refresh();
})();
