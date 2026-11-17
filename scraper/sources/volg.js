// Volg: Wochenaktionen als statisches HTML, gruppiert nach Abschnitten mit Gültigkeitsdatum.
import * as cheerio from 'cheerio';
import { fetchText, makeDeal, parsePrice, absUrl, clean } from '../util.js';

const BASE = 'https://www.volg.ch';
const URL_ = BASE + '/sortiment/wochenaktionen/';

export async function scrapeVolg() {
  const $ = cheerio.load(await fetchText(URL_));
  const deals = [];
  $('.c-section').each((_, section) => {
    const sec = $(section);
    const validText = clean(sec.find('.c-section__subtitle span').first().text());
    sec.find('.c-product').each((_, el) => {
      const card = $(el);
      const name = card.find('.c-product__title').first().text();
      if (!name.trim()) return;
      const desc = card.find('.c-product__description').first();
      deals.push(makeDeal({
        shop: 'volg',
        name,
        description: clean(desc.text()),
        price: parsePrice(card.find('.c-product__price-main').first().text()),
        oldPrice: parsePrice((card.find('.c-product__price').text().match(/statt\s*([\d.,'–-]+)/) || [])[1]),
        discountText: card.find('.c-product__reduction').first().text(),
        validText,
        image: absUrl(BASE, card.find('img').first().attr('src')),
        url: URL_,
        source: 'direkt',
      }));
    });
  });
  return deals;
}
