// Gemeinsame Hilfsfunktionen für alle Quellen.

export const USER_AGENT = 'AktionenCH/1.0 (privater Aktionsvergleich; Node.js)';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let lastRequest = 0;
/** Höflicher Abruf: max. 1 Anfrage pro Sekunde, 3 Versuche bei Netzwerkfehlern. */
export async function fetchText(url, { retries = 3 } = {}) {
  for (let attempt = 1; ; attempt++) {
    const wait = lastRequest + 1000 - Date.now();
    if (wait > 0) await sleep(wait);
    lastRequest = Date.now();
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'de-CH,de;q=0.9' },
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} für ${url}`);
      return await res.text();
    } catch (err) {
      if (attempt >= retries || /HTTP 4\d\d/.test(err.message)) throw err;
      await sleep(2000 * attempt);
    }
  }
}

/** "12.95", "1'299.–", "2,50", "-.79" -> Zahl */
export function parsePrice(text) {
  if (text == null) return null;
  const t = String(text).replace(/['’\s]/g, '');
  const m = t.match(/(\d+|[-–])[.,](\d{2}|[-–]+)/) || t.match(/(\d+)/);
  if (!m) return null;
  const francs = /\d/.test(m[1]) ? m[1] : '0';
  const cents = m[2] && /\d/.test(m[2]) ? m[2] : '00';
  const v = parseFloat(`${francs}.${cents}`);
  return Number.isFinite(v) ? v : null;
}

/** Rabatt aus Text wie "-30%", "½ PREIS", "3 für 2", "2 für 1". */
export function parseDiscountText(text) {
  if (!text) return null;
  const t = String(text).toLowerCase();
  let m = t.match(/(\d{1,2})\s*%/);
  if (m) return parseInt(m[1], 10);
  if (/½|1\/2|halber preis|halbe?r? preis/.test(t)) return 50;
  m = t.match(/(\d+)\s*für\s*(\d+)/);
  if (m) {
    const get = +m[1], pay = +m[2];
    if (get > pay && get > 0) return Math.round(((get - pay) / get) * 100);
  }
  return null;
}

/** Rabatt in Prozent: Angabe des Ladens, sonst aus Preisen berechnet. */
export function computeDiscount(price, oldPrice, discountText) {
  const stated = parseDiscountText(discountText);
  if (stated != null) return stated;
  if (price != null && oldPrice != null && oldPrice > price && price >= 0) {
    return Math.round(((oldPrice - price) / oldPrice) * 100);
  }
  return null;
}

export function clean(text) {
  return text == null ? '' : String(text).replace(/\s+/g, ' ').trim();
}

/** Liest "bis 24.12.2026" / "vom 12.11. bis 18.11." und gibt ISO-Datum des Endes zurück. */
export function parseValidTo(text, now = new Date()) {
  if (!text) return null;
  const m = String(text).match(/bis\s*(?:\w{2}\.?\s*)?(\d{1,2})\.(\d{1,2})\.(\d{2,4})?/i);
  if (!m) return null;
  let year = m[3] ? +m[3] : now.getFullYear();
  if (year < 100) year += 2000;
  const d = new Date(Date.UTC(year, +m[2] - 1, +m[1]));
  // Ohne Jahresangabe: Ende im Januar, wir sind im Dezember -> nächstes Jahr
  if (!m[3] && d < new Date(now.getTime() - 60 * 86400000)) d.setUTCFullYear(year + 1);
  return d.toISOString().slice(0, 10);
}

export function makeDeal(fields) {
  const deal = {
    shop: fields.shop,
    name: clean(fields.name),
    description: clean(fields.description),
    price: fields.price ?? null,
    oldPrice: fields.oldPrice ?? null,
    discountText: clean(fields.discountText),
    discount: null,
    validText: clean(fields.validText),
    validTo: fields.validTo ?? null,
    image: fields.image || null,
    url: fields.url || null,
    source: fields.source,
    category: clean(fields.category) || null,
  };
  // Beispielpreis aus der Beschreibung ("z.B. … 4.05 statt 5.85")
  if (deal.price == null || deal.oldPrice == null) {
    const m = deal.description.match(/(\d+\.\d{2}|[-–]\.\d{2})\s*statt\s*(\d+\.\d{2}|[-–]\.\d{2})/);
    if (m) {
      const [p, o] = [parsePrice(m[1]), parsePrice(m[2])];
      if (deal.price == null || deal.price === p) { deal.price = p; deal.oldPrice = o; deal.priceIsExample = /z\.\s?B\./i.test(deal.description); }
    }
  }
  deal.discount = computeDiscount(deal.price, deal.oldPrice, deal.discountText);
  if (!deal.validTo) deal.validTo = parseValidTo(deal.validText || deal.description);
  deal.id = `${deal.shop}:${deal.name}:${deal.price ?? ''}`.toLowerCase();
  return deal;
}

export const absUrl = (base, href) => {
  if (!href) return null;
  try { return new URL(href, base).href; } catch { return null; }
};
