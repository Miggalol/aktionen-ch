// Aktionis.ch: öffentliches Schweizer Aktionsportal. Wird für Läden genutzt, deren eigene
// Websites automatische Abrufe blockieren (Migros, Coop) und als Ersatz, falls eine Direktquelle ausfällt.
// robots.txt von aktionis.ch erlaubt /vendors/…; wir rufen max. 1 Seite pro Sekunde ab.
import * as cheerio from 'cheerio';
import { fetchText, makeDeal, parsePrice, absUrl } from '../util.js';

const BASE = 'https://www.aktionis.ch';
const MAX_PAGES = 40;

export function aktionisSource(shop, vendorSlug = shop) {
  return async function scrapeAktionis() {
    const deals = [];
    let maxPage = 1;
    for (let page = 1; page <= Math.min(maxPage, MAX_PAGES); page++) {
      const url = `${BASE}/vendors/${vendorSlug}${page > 1 ? '/' + page : ''}`;
      const $ = cheerio.load(await fetchText(url));
      if (page === 1) {
        // Anbieter ohne aktuelle Aktionen werden auf die Anbieterübersicht umgeleitet
        if (!$('.card.dealtype-deal, .card[class*="dealtype"]').length) return deals;
        maxPage = parseInt($('input[name="max_page"]').attr('value'), 10) || 1;
      }
      $('.card[data-upox-id]').each((_, el) => {
        const card = $(el);
        const name = card.find('.card-title').first().text();
        if (!name.trim()) return;
        deals.push(makeDeal({
          shop,
          name,
          description: card.find('.card-description').first().text(),
          price: parsePrice(card.find('.price-new').first().text()),
          oldPrice: parsePrice(card.find('.price-old').first().text()),
          discountText: card.find('.price-discount').first().text(),
          image: card.find('.card-image img').first().attr('src') || null,
          url: absUrl(BASE, card.find('a[href^="/deals/"]').first().attr('href')),
          source: 'aktionis.ch',
        }));
      });
    }
    return deals;
  };
}
