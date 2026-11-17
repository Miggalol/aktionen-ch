// Lidl: Die Aktionsseiten enthalten pro Produkt ein JSON im Attribut data-grid-data.
import * as cheerio from 'cheerio';
import { fetchText, makeDeal, absUrl, clean } from '../util.js';

const BASE = 'https://www.lidl.ch';

const fmtDate = (unix) => {
  if (!unix) return null;
  const d = new Date(unix * 1000);
  return d.toLocaleDateString('de-CH', { timeZone: 'Europe/Zurich', day: '2-digit', month: '2-digit' });
};
const isoDate = (unix) => (unix ? new Date(unix * 1000).toLocaleDateString('sv-SE', { timeZone: 'Europe/Zurich' }) : null);

/** Findet die Aktionsseiten (Wochenaktion, Lidl Plus …) über die Startseite. */
async function findOfferPages() {
  const $ = cheerio.load(await fetchText(BASE + '/'));
  const urls = new Set();
  $('a[href]').each((_, a) => {
    const href = $(a).attr('href');
    if (/^\/c\/de-CH\/store\/[^/]+\/a\d+/.test(href) || /^\/c\/de-CH\/[^/]*(aktion|angebot)[^/]*\/a\d+/.test(href)) {
      urls.add(absUrl(BASE, href.split('#')[0]));
    }
  });
  return [...urls];
}

export async function scrapeLidl() {
  const pages = await findOfferPages();
  if (!pages.length) throw new Error('Keine Lidl-Aktionsseiten auf der Startseite gefunden');
  const deals = [];
  const seen = new Set();
  for (const url of pages) {
    const $ = cheerio.load(await fetchText(url));
    $('[data-grid-data]').each((_, el) => {
      let d;
      try { d = JSON.parse($(el).attr('data-grid-data')); } catch { return; }
      const p = d.price || {};
      const disc = p.discount || {};
      const oldPrice = disc.deletedPrice ?? p.oldPrice ?? null;
      if (p.price == null || (!disc.showDiscount && !oldPrice)) return; // nur echte Rabatte
      const key = d.productId ?? d.fullTitle;
      if (seen.has(key)) return;
      seen.add(key);
      const desc = cheerio.load(d.keyfacts?.description || '').text();
      const from = fmtDate(d.storeStartDate), to = fmtDate(d.storeEndDate);
      deals.push(makeDeal({
        shop: 'lidl',
        name: d.fullTitle || d.title,
        description: clean(desc.replace(/\s*\n\s*/g, ', ')),
        price: p.price,
        oldPrice,
        discountText: disc.discountText || (disc.percentageDiscount ? `-${disc.percentageDiscount}%` : ''),
        validText: from && to ? `${from} – ${to}` : (d.stockAvailability?.badgeInfo?.badges?.[0]?.text || ''),
        validTo: isoDate(d.storeEndDate),
        image: d.image_V1?.image || d.image || d.imageList_V1?.[0]?.image || null,
        url: absUrl(BASE, d.canonicalUrl || d.canonicalPath),
        source: 'direkt',
        category: d.category,
      }));
    });
  }
  return deals;
}
