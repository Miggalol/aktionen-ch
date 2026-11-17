# Aktionen Schweiz

Eine Website, die die aktuellen Aktionen der grossen Schweizer Supermärkte an einem Ort zusammenführt.
Du kannst nach Produkten suchen, nach Laden filtern, und die Liste ist standardmässig nach dem **besten Rabatt** sortiert.

## Woher kommen die Daten?

| Laden  | Quelle                                   | Automatisch |
|--------|------------------------------------------|-------------|
| Migros | aktionis.ch (öffentliches Aktionsportal) | ja          |
| Coop   | aktionis.ch                              | ja          |
| Spar   | aktionis.ch                              | ja          |
| Lidl   | lidl.ch direkt                           | ja          |
| Denner | denner.ch direkt                         | ja          |
| Volg   | volg.ch direkt                           | ja          |
| Aldi   | Browser-Import (siehe unten)             | nein*       |

\* Migros, Coop und Aldi blockieren automatische Abrufe auf ihren eigenen Websites (Bot-Schutz).
Dieses Projekt umgeht diesen Schutz **nicht**. Migros und Coop kommen deshalb über aktionis.ch.
Aldi Suisse ist dort momentan nicht gelistet. Sobald es wieder auftaucht, wird es automatisch übernommen.
Fällt eine Direktquelle (Lidl, Denner, Volg) aus, springt aktionis.ch als Ersatz ein.

### Browser-Import (für Aldi und als Ersatz für Migros/Coop)

Auf der Website auf **«Import aus Browser»** klicken und den Knopf «➕ Aktionen sammeln» in die Lesezeichenleiste ziehen.
Danach die Aktionsseite von Aldi, Migros oder Coop ganz normal öffnen und auf das Lesezeichen klicken.
Die Seite wird kurz durchgescrollt, die erkannten Aktionen öffnen sich auf deiner Website.
Importierte Aktionen werden nur in deinem Browser gespeichert und nach 10 Tagen automatisch gelöscht.

Das Lesezeichen erkennt Produktkarten allgemein (Bild + Preis + Aktionshinweis wie «statt», «%»).
Getestet ist es auf den Seiten von Denner und Volg. Auf Migros, Coop und Aldi konnte es nicht getestet werden, weil diese Seiten automatisierte Browser blockieren.
Falls dort etwas nicht oder falsch erkannt wird, muss die Erkennung in `site/bookmarklet.js` angepasst werden.

## Lokal starten

Voraussetzung: [Node.js](https://nodejs.org) ab Version 20.

```bash
npm install
```

```bash
npm run scrape
```

```bash
npm run serve
```

Dann http://localhost:8080 öffnen. `npm run scrape migros coop` aktualisiert nur einzelne Läden.

## Online stellen (kostenlos, mit täglicher Aktualisierung)

1. Neues Repository auf GitHub anlegen und diesen Ordner hochladen.
2. Im Repository unter **Settings → Pages** bei «Source» **GitHub Actions** wählen.
3. Unter **Actions → Aktionen aktualisieren → Run workflow** einmal manuell starten.

Danach holt GitHub jeden Morgen die neuen Aktionen und veröffentlicht die Website unter `https://<dein-name>.github.io/<repo>/`.

## Aufbau

```
scraper/index.js          Ablauf: pro Laden die erste funktionierende Quelle nutzen
scraper/sources/*.js      Eine Datei pro Quelle (denner, lidl, volg, aktionis)
scraper/util.js           Preis-/Rabatt-Erkennung, höfliches Abrufen (max. 1 Anfrage/Sekunde)
site/                     Die Website (reines HTML/CSS/JS, kein Build nötig)
site/data/deals.json      Vom Scraper erzeugte Daten
site/bookmarklet.js       Lesezeichen für den Browser-Import
```

**Hinweis:** Die Websites der Läden ändern sich gelegentlich. Wenn ein Laden plötzlich 0 Aktionen liefert, steht der Grund unten auf der Website (Maus über den roten Eintrag halten) und in der Ausgabe von `npm run scrape`.
