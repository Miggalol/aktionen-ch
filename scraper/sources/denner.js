// Denner: Aktionsseiten werden serverseitig gerendert (Nuxt) – Produktkarten direkt im HTML.
import * as cheerio from 'cheerio';
import { fetchText, makeDeal, parsePrice, absUrl } from '../util.js';

const BASE = 'https://www.denner.ch';
const PAGES = [
  { path: '/de/aktionen/aktuelle-aktionen', label: 'Aktuelle Aktionen' },
  { path: '/de/aktionen/aktionen-ab-donnerstag', label: 'Aktionen ab Donnerstag' },
];

export async function scrapeDenner() {
  const deals = [];
  for (const page of PAGES) {
    const html = await fetchText(BASE + page.path);
    const $ = cheerio.load(html);
    $('.product-item').each((_, el) => {
      const card = $(el);
      const name = card.find('.product-item__title').first().text();
      if (!name.trim()) return;
      const img = card.find('img.product-item__image').first();
      deals.push(makeDeal({
        shop: 'denner',
        name,
        description: card.find('.product-item__subline').first().text(),
        price: parsePrice(card.find('.price-tag__final-price').first().text()),
        oldPrice: parsePrice(card.find('.price-tag__instead').first().text()),
        discountText: card.find('.price-tag__discount').first().text(),
        validText: page.label,
        image: img.attr('src') || null,
        url: absUrl(BASE, card.find('a.stretch-link__link').attr('href')),
        source: 'direkt',
      }));
    });
  }
  return deals;
}
