function (SITE) {
  /* Läuft als Lesezeichen im eigenen Browser auf der Aktionsseite eines Ladens.
     Erkennt Produktkarten allgemein (Bild + Preis + Aktionshinweis), da sich die
     Seiten von Migros, Coop und Aldi oft ändern. Schickt die Daten an die Aktionen-Website. */
  var host = location.hostname;
  var shop = /migros/.test(host) ? 'migros' : /coop/.test(host) ? 'coop' : /aldi/.test(host) ? 'aldi'
    : /lidl/.test(host) ? 'lidl' : /denner/.test(host) ? 'denner' : /spar/.test(host) ? 'spar' : /volg/.test(host) ? 'volg' : null;
  if (!shop) { alert('Bitte auf der Aktionsseite von Migros, Coop, Aldi, Lidl, Denner, Spar oder Volg ausführen.'); return; }

  /* Fenster sofort öffnen (sonst blockiert der Browser das Popup nach dem Scrollen) */
  var win = window.open('about:blank', 'aktionen_ch');
  var box = document.createElement('div');
  box.style.cssText = 'position:fixed;z-index:2147483647;top:16px;right:16px;background:#1c1b19;color:#fff;font:600 15px system-ui,sans-serif;padding:14px 18px;border-radius:12px;box-shadow:0 6px 24px rgba(0,0,0,.35)';
  box.textContent = 'Aktionen werden gesammelt …';
  document.body.appendChild(box);

  var PRICE = /(\d{1,4}|[-–])[.,](\d{2}|[-–]{1,2})(?![\d%])/g;
  var PROMO = /statt|anstatt|vorher|au lieu|invece|%|½|\d\s*für\s*\d|aktion|rabatt|reduziert|sale|prix|preis/i;
  function txt(el) { return (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim(); }
  function price(s) {
    var m = /(\d{1,4}|[-–])[.,](\d{2}|[-–]{1,2})/.exec(s || '');
    if (!m) return null;
    return parseFloat((/\d/.test(m[1]) ? m[1] : '0') + '.' + (/\d/.test(m[2]) ? m[2] : '00'));
  }
  function struck(el) {
    for (var e = el; e && e !== document.body; e = e.parentElement) {
      if (/^(S|DEL|STRIKE)$/.test(e.tagName)) return true;
      var cs = getComputedStyle(e);
      if ((cs.textDecorationLine || cs.textDecoration || '').indexOf('line-through') >= 0) return true;
      if (/old|before|strike|instead|regular|original|statt/i.test(e.className && e.className.baseVal === undefined ? e.className : '')) return true;
    }
    return false;
  }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  async function loadAll() {
    /* Scrollt durch die Seite und klickt "Mehr anzeigen"-Knöpfe, damit nachgeladene Aktionen erscheinen */
    var lastH = 0, same = 0;
    for (var i = 0; i < 40 && same < 3; i++) {
      window.scrollTo(0, document.documentElement.scrollHeight);
      await sleep(700);
      var btns = Array.prototype.filter.call(document.querySelectorAll('button'), function (b) {
        var bt = txt(b);
        return b.offsetParent && bt.length < 40 && !/akzeptier|cookie|zustimm|accept/i.test(bt) &&
          /^(mehr|weitere)\s+(anzeigen|laden|produkte|artikel|aktionen|angebote)|^load more|^show more|^afficher plus|^voir plus/i.test(bt);
      });
      if (btns.length) { btns[0].click(); await sleep(1200); }
      var h = document.documentElement.scrollHeight;
      same = h === lastH && !btns.length ? same + 1 : 0; lastH = h;
      box.textContent = 'Aktionen werden gesammelt … (' + (i + 1) + ')';
    }
    window.scrollTo(0, 0);
  }

  function findCards() {
    var els = document.body.querySelectorAll('article, li, a, div, section');
    var cands = [];
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (!el.querySelector('img') || !el.offsetParent && el.getClientRects().length === 0) continue;
      var t = txt(el);
      if (t.length < 6 || t.length > 600) continue;
      var p = t.match(PRICE);
      if (!p || p.length > 6) continue;
      if (!PROMO.test(t) && !el.querySelector('s,del,strike')) continue;
      cands.push(el);
    }
    /* kleinste Elemente behalten, die nicht ein anderes enthalten */
    var minimal = cands.filter(function (el) {
      for (var j = 0; j < cands.length; j++) if (cands[j] !== el && el.contains(cands[j])) return false;
      return true;
    });
    /* bis zum grössten Container erweitern, der genau eine Karte enthält (damit Titel dabei sind) */
    return minimal.map(function (el) {
      var c = el;
      while (c.parentElement && c.parentElement !== document.body) {
        var p = c.parentElement, n = 0;
        for (var k = 0; k < minimal.length && n < 2; k++) if (p.contains(minimal[k])) n++;
        if (n > 1 || txt(p).length > 700) break;
        c = p;
      }
      return c;
    });
  }

  function extract(card) {
    var t = txt(card);
    var nameEl = card.querySelector('h1,h2,h3,h4,h5,[class*="title" i],[class*="name" i],[data-testid*="name" i],[data-testid*="title" i]');
    var name = nameEl ? txt(nameEl) : '';
    var imgs = card.querySelectorAll('img'), img = null, best = 0;
    for (var i = 0; i < imgs.length; i++) {
      var a = (imgs[i].naturalWidth || imgs[i].width) * (imgs[i].naturalHeight || imgs[i].height);
      if (a >= best) { best = a; img = imgs[i]; }
    }
    if ((!name || PRICE.test(name) || name.length < 3) && img && img.alt) name = img.alt.trim();
    PRICE.lastIndex = 0;
    if (!name) name = t.replace(PRICE, ' ').replace(/[-–]?\s?\d{1,2}\s?%/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);

    var nw = null, old = null, m = /((?:\d{1,4}|[-–])[.,](?:\d{2}|[-–]{1,2}))\s*(?:statt|anstatt|vorher|au lieu de|invece di|instead of)\s*((?:\d{1,4}|[-–])[.,](?:\d{2}|[-–]{1,2}))/i.exec(t);
    if (m) { nw = price(m[1]); old = price(m[2]); }
    else {
      /* Durchgestrichene Preise = alter Preis */
      var walker = document.createTreeWalker(card, NodeFilter.SHOW_TEXT), node, plain = [], strike = [];
      while ((node = walker.nextNode())) {
        var s = node.nodeValue.trim(); if (!s) continue;
        var v = price(s); if (v == null || /%/.test(s)) continue;
        if (/\b(100\s?g|1\s?kg|1\s?l|100\s?ml|pro|per|=)\b/i.test(node.parentElement ? txt(node.parentElement) : '') && plain.length) continue;
        (struck(node.parentElement) ? strike : plain).push(v);
      }
      if (!plain.length) { var all = t.match(PRICE) || []; if (all.length) plain.push(price(all[0])); }
      nw = plain.length ? plain[0] : null;
      old = strike.length ? strike[0] : null;
    }
    if (old != null && nw != null && old <= nw) old = null;
    var dm = /[-–]?\s?(\d{1,2})\s?%/.exec(t), disc = dm ? parseInt(dm[1], 10) : null;
    if (disc == null && /½|halber preis/i.test(t)) disc = 50;
    var fm = /(\d+)\s*für\s*(\d+)/i.exec(t);
    if (disc == null && fm && +fm[1] > +fm[2]) disc = Math.round((fm[1] - fm[2]) / fm[1] * 100);
    var vm = /(?:gültig|bis|ab)\s[^|]{0,30}?\d{1,2}\.\d{1,2}\.(?:\d{2,4})?/i.exec(t);
    var link = card.closest('a[href]') || (card.tagName === 'A' ? card : card.querySelector('a[href]'));
    var desc = t.replace(name, '').replace(PRICE, ' ')
      .replace(/[-–]?\s?\d{1,2}\s?%|\b(statt|anstatt|CHF|Fr\.)\*?|½\s*preis|\d+\s*für\s*\d+|\(\s*[\d.,]*\s*(g|kg|ml|l|cl|stk)\s*=\s*\)/gi, ' ')
      .replace(/(^|\s)[*.,:;–-](?=\s|$)/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200);
    PRICE.lastIndex = 0;
    return {
      name: name.slice(0, 160), description: desc, price: nw, oldPrice: old, discount: disc,
      discountText: dm ? dm[0].trim() : (fm ? fm[0] : ''), validText: vm ? vm[0] : '',
      image: img ? (img.currentSrc || img.src || '').slice(0, 800) : null,
      url: link ? link.href : location.href,
    };
  }

  (async function () {
    try {
      await loadAll();
      var seen = {}, deals = [];
      findCards().forEach(function (c) {
        var d = extract(c);
        var key = d.name.toLowerCase() + '|' + d.price;
        if (!d.name || seen[key] || (d.price == null && d.discount == null)) return;
        seen[key] = 1; deals.push(d);
      });
      if (!deals.length) { box.textContent = 'Keine Aktionen erkannt. Bitte auf der Aktionsseite ausführen.'; if (win) win.close(); setTimeout(function () { box.remove(); }, 5000); return; }
      var payload = JSON.stringify({ v: 1, shop: shop, url: location.href, at: new Date().toISOString(), deals: deals });
      box.textContent = deals.length + ' Aktionen gefunden – werden übertragen …';
      if (win && !win.closed) {
        win.location.href = SITE + '#import=' + encodeURIComponent(payload);
      } else {
        try { await navigator.clipboard.writeText(payload); alert(deals.length + ' Aktionen in die Zwischenablage kopiert. Auf der Aktionen-Website unter «Import aus Browser» einfügen.'); }
        catch (e) { prompt('Diesen Text kopieren und auf der Aktionen-Website einfügen:', payload); }
      }
      setTimeout(function () { box.remove(); }, 3000);
    } catch (e) {
      box.textContent = 'Fehler: ' + e.message; setTimeout(function () { box.remove(); }, 6000);
    }
  })();
}
