// Sammelt alle Aktionen und schreibt site/data/deals.json.
// Pro Laden wird die erste funktionierende Quelle verwendet (Direktquelle vor Aktionsportal).
import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { scrapeDenner } from './sources/denner.js';
import { scrapeLidl } from './sources/lidl.js';
import { scrapeVolg } from './sources/volg.js';
import { aktionisSource } from './sources/aktionis.js';

const SHOPS = [
  { id: 'migros', name: 'Migros', sources: [['aktionis.ch', aktionisSource('migros')]] },
  { id: 'coop', name: 'Coop', sources: [['aktionis.ch', aktionisSource('coop')]] },
  { id: 'aldi', name: 'Aldi Suisse', sources: [['aktionis.ch', aktionisSource('aldi', 'aldi-suisse')]] },
  { id: 'lidl', name: 'Lidl', sources: [['lidl.ch', scrapeLidl], ['aktionis.ch', aktionisSource('lidl')]] },
  { id: 'denner', name: 'Denner', sources: [['denner.ch', scrapeDenner], ['aktionis.ch', aktionisSource('denner')]] },
  { id: 'spar', name: 'Spar', sources: [['aktionis.ch', aktionisSource('spar')]] },
  { id: 'volg', name: 'Volg', sources: [['volg.ch', scrapeVolg], ['aktionis.ch', aktionisSource('volg')]] },
];

const only = process.argv.slice(2);
const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'site', 'data', 'deals.json');

const status = [];
const all = [];
for (const shop of SHOPS) {
  if (only.length && !only.includes(shop.id)) continue;
  const entry = { id: shop.id, name: shop.name, count: 0, source: null, errors: [] };
  for (const [label, fn] of shop.sources) {
    try {
      const deals = await fn();
      if (deals.length) {
        entry.count = deals.length;
        entry.source = label;
        all.push(...deals);
        break;
      }
      entry.errors.push(`${label}: keine Aktionen gefunden`);
    } catch (err) {
      entry.errors.push(`${label}: ${err.message}`);
    }
  }
  status.push(entry);
  console.log(`${shop.name.padEnd(12)} ${String(entry.count).padStart(4)} Aktionen  ${entry.source ? 'via ' + entry.source : ''}${entry.errors.length ? '  [' + entry.errors.join('; ') + ']' : ''}`);
}

// Doppelte Einträge (gleicher Laden, Name, Preis) entfernen
const unique = [...new Map(all.map((d) => [d.id, d])).values()];
unique.sort((a, b) => (b.discount ?? -1) - (a.discount ?? -1));

await mkdir(dirname(out), { recursive: true });
await writeFile(out, JSON.stringify({ updated: new Date().toISOString(), shops: status, deals: unique }, null, 1));
console.log(`\n${unique.length} Aktionen gespeichert in ${out}`);
