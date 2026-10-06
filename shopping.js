/* upstreem shopping.js -- Shopping (Beta): wie Marken, Produkte und Haendler in den Shopping-
   Ergebnissen der KI-Antworten erscheinen (04.10.). Praefix ush.

   VIER SEITEN UND EIN DETAIL in EINER Komponente, wie Events: Kopf mit Krumen und Reitern,
   Kalender und Filter stehen IN der Komponente (lokale Instanzen, data-local) -- ihre Auswahl
   verlaesst die Seite nicht, sie kommt als DOM-Ereignis hierher.
     ?view=shopping                                  Overview
     ?view=shopping&shop=products|brands|merchants   die Reiter
     ?view=shopping&shop=products&product=<id>       Product Detail (der Reiter Products bleibt an)
   Die Adresse fuehrt (pushState), Zurueck im Browser fuehrt zurueck.

   DATENWEGE: vier RPCs (bubble/shopping_runjs.md). Jede Anfrage geht als Ereignis an Bubble und
   traegt den FERTIGEN RPC-Body als Text; die Antwort kommt als json-Feld des Umschlags plus
   Fehler-Body zurueck:
     shopOverview       cached_shopping_overview_v1        setShoppingOverview(id, json, fehler)
                        Overview UND Brands (Brands blaettert ueber p_brand_*)
     shopProducts       cached_shopping_products_v1        setShoppingProducts(id, json, fehler)
     shopProductDetail  cached_shopping_product_detail_v1  setShoppingProductDetail(id, json, fehler)
     shopMerchants      cached_shopping_merchants_v1       setShoppingMerchants(id, json, fehler)
   Die Antworten nennen ihre Parameter nicht. Darum laeuft je RPC hoechstens EINE Anfrage; was
   sich waehrenddessen aendert, geht hinaus, sobald sie da ist -- so gehoert jede Antwort sicher
   zu der Anfrage, fuer die sie kam (dieselbe Bauart wie der Zaehler im Events-Popup).
   Geladen wird nur, was die offene Seite braucht, und nur, solange die Komponente zu sehen ist.

   NICHTS WIRD HIER NACHGERECHNET (Uebergabe: "bitte nichts davon nachbauen"). Was fehlt, ist ein
   Strich; ein Wert, den das Backend null nennt, wird nie 0. Unlesbar, leer und noch nicht da
   sehen nie gleich aus: Fehlerzustand, Leerzustand, Skelett. */
(function () {
  "use strict";

  /* ---- Boot-Stubs (STYLEGUIDE §25), VOR der core-Pruefung ---------------------------------- */
  var API_NAMES = ["setShoppingOverview", "setShoppingProducts", "setShoppingProductDetail",
                   "setShoppingMerchants", "resetShopping"];
  var Q = (window.__ushBootQueue = window.__ushBootQueue || []);
  API_NAMES.forEach(function (n) {
    if (!window[n]) window[n] = function () { Q.push([n, [].slice.call(arguments)]); };
  });

  function ushBoot(triesLeft) {
    if (!window.UpstreemCore) {
      if (triesLeft > 0) { setTimeout(function () { ushBoot(triesLeft - 1); }, 100); return; }
      if (window.console) console.error("UpstreemCore (core.js) not loaded");
      return;
    }
    ushStart();
  }

  function ushStart() {
  var UC = window.UpstreemCore;
  var esc = UC.esc, t = UC.t || function (x) { return x; };
  var STORE = (window.__ushStore = window.__ushStore || {});

  /* ---- Kleine Helfer ------------------------------------------------------------------------ */
  function isArr(v) { return Object.prototype.toString.call(v) === "[object Array]"; }
  function num(v) { if (v == null || v === "" || typeof v === "boolean") return null; var n = Number(v); return isFinite(n) ? n : null; }
  /* Ein Objekt oder eine Liste ist kein Text: ohne das stuende "[object Object]" als Titel da, wenn
     eine Zeile statt eines Namens ein Objekt traegt. */
  function str(v) { return v == null || typeof v === "object" ? "" : String(v); }
  function ersetze(s, o) { return String(s).replace(/\{(\w+)\}/g, function (_, k) { return o[k] != null ? o[k] : ""; }); }
  /* Die Produkt-Ids sind groesser als Number.MAX_SAFE_INTEGER (Uebergabe 4) -- als Zahl
     verloeren sie ihre letzten Stellen. Das Backend schickt sie als Text; kaeme eine doch einmal
     ohne Anfuehrungszeichen, wird sie VOR dem Lesen zu Text, statt still eine andere Id zu werden. */
  function idsQuoten(raw) {
    return String(raw).replace(/("source_product_id"\s*:\s*)(-?\d{12,})(?=\s*[,}\]])/g, '$1"$2"');
  }
  /* Ein Objekt aus Bubble-Text, mit UC.readBubble wie jede Komponente. readBubble gibt fuer Text
     eine Liste -- ein Objekt kommt als ihr erstes Element. Der Umschlag {"json": "..."} wird
     ausgepackt, falls jemand "Result of step 1" statt seines Feldes json einsetzt (Events, 04.10.). */
  function objekt(raw) {
    if (raw == null) return null;
    var v = typeof raw === "string" ? (UC.readBubble ? UC.readBubble(idsQuoten(raw)) : null) : raw;
    if (isArr(v)) v = v.length ? v[0] : null;
    if (v && typeof v === "object" && !isArr(v) && v.json != null && Object.keys(v).length === 1) {
      return typeof v.json === "object" ? v.json : objekt(v.json);
    }
    return v && typeof v === "object" && !isArr(v) ? v : null;
  }
  /* Der dritte Wert der Setter: Bubbles "error body". Er zaehlt NUR, wenn keine lesbare Antwort da
     ist -- eine gelungene RPC braucht keinen Fehler-Wert, und was Bubble bei Erfolg dort hinschreibt
     (oder ein vergessener Platzhalter), darf eine richtige Antwort nie verdraengen (Events, 04.10.). */
  function fehlerDa(f) {
    var s = String(f == null ? "" : f).trim().toLowerCase();
    return s !== "" && s !== "null" && s !== "undefined" && s !== "no" && s !== "false";
  }
  /* Der stabile Code aus dem Fehler-Body ({"code":"P0001","message":"shopping_..."}) oder der
     nackte Code. */
  function fehlerCode(f) {
    var roh = String(f == null ? "" : f).trim();
    if (roh.charAt(0) === "{") { var o = objekt(roh); if (o && o.message != null) return String(o.message); }
    return roh;
  }
  function team() { try { return (UC.getTeam && UC.getTeam()) || ""; } catch (e) { return ""; } }
  /* Nur http(s): ein Bild oder Logo aus den Daten darf nie javascript: oder data: sein. Protokoll-
     relativ wird https, wie in core (brandStack). */
  function sichereUrl(u) {
    var s = str(u).trim();
    if (!s) return "";
    if (s.indexOf("//") === 0) s = "https:" + s;
    return /^https?:\/\/[^\s"'<>]+$/i.test(s) ? s : "";
  }
  /* Ein MARKEN-LOGO darf auch ein eingebettetes Bild sein (data:image/...), wie in core seit dem
     06.10. (barLogoHtml, markenChip). Gemeldet auf der Landingpage: dort traegt Acme ihr Zeichen
     als eingebettetes SVG, und sichereUrl liess nur http(s) durch -- im Product Detail stand statt
     des Zeichens der Ersatzbuchstabe "A". Nur fuer <img src>, nie fuer einen Link. */
  function logoUrl(u) {
    var s = str(u).trim();
    return /^data:image\/(png|jpe?g|gif|webp|svg\+xml)[;,]/i.test(s) ? s : sichereUrl(s);
  }

  /* ---- Zahlen, wie sie die Uebergabe festlegt (Abschnitt 4) --------------------------------
     Prozent mit einer Stelle, Position mit einer Stelle hinter der Raute, Anzahlen ganz. */
  /* PLAUSIBEL ODER GAR NICHT (04.10.). Eine kaputte Zeile darf weder die Tabelle sprengen noch
     etwas Falsches behaupten: ein Anteil von 250 %, Position 0, Bewertung 99 oder 1e21
     Beobachtungen sind kein Messwert, sondern ein Datenfehler -- sie werden "–". Ein kleiner
     Rundungsueberhang (100,0004 %) bleibt ein Wert und wird auf den Rand gesetzt. Gemessen mit
     manipulierten Zeilen: vorher "1,000,000,000.0%", "1e+308%", "-5.0%", "# 0.0", "1e+21". */
  function anteilWert(v) { v = num(v); return v == null || v < -0.5 || v > 100.5 ? null : Math.max(0, Math.min(100, v)); }
  function anzahlWert(v) { v = num(v); return v == null || v < 0 || v >= 1e15 ? null : v; }
  function posWert(v) { v = num(v); return v == null || v < 0.95 || v > 1000 ? null : Math.max(1, v); }
  function noteWert(v) { v = num(v); return v == null || v < 0 || v > 5.05 ? null : Math.min(5, v); }
  function preisWert(v) { v = num(v); return v == null || v < 0 || v >= 1e12 ? null : v; }
  function deltaWert(art, d) { d = num(d); var g = art === "pos" ? 1000 : art === "anzahl" ? 1e15 : 100.5; return d == null || Math.abs(d) > g ? null : d; }
  /* Die Kennzahl einer Chart-Reihe nach ihrem Feldnamen. */
  function metrikWert(feld, v) { return /position/.test(feld) ? posWert(v) : feld === "observations" ? anzahlWert(v) : anteilWert(v); }
  function pct(v) { v = anteilWert(v); return v == null ? "–" : (UC.fmtPct ? UC.fmtPct(v, 1) : v.toFixed(1) + "%"); }
  function ganz(v) { v = anzahlWert(v); return v == null ? "–" : (UC.fmtInt ? UC.fmtInt(v) : String(Math.round(v))); }
  function stelle(v) { v = num(v); return v == null ? "–" : (UC.fmtNum ? UC.fmtNum(v, 1) : v.toFixed(1)); }
  /* Ein Kennzahl-Objekt {value, previous, delta}. Kommt statt des Objekts eine nackte Zahl, ist sie
     der Wert -- ohne Vergleich. */
  function kz(o) {
    if (o == null) return { v: null, p: null, d: null };
    if (typeof o !== "object") return { v: num(o), p: null, d: null };
    return { v: num(o.value), p: num(o.previous), d: num(o.delta) };
  }
  var WAEHRUNG = { EUR: "€", USD: "$", GBP: "£", JPY: "¥" };
  function geld(v, c) {
    v = preisWert(v);
    if (v == null) return "";
    var code = str(c).trim().toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3);
    var z = UC.fmtNum ? UC.fmtNum(v, 2) : v.toFixed(2);
    if (WAEHRUNG[code]) return WAEHRUNG[code] + z;
    return code ? code + " " + z : z;
  }
  /* price_ranges: je Waehrung {currency, min, max}; min = max ist EIN Preis (Uebergabe 4). */
  function preisSpanne(ranges) {
    if (!isArr(ranges)) return "";
    return ranges.map(function (r) {
      if (!r || typeof r !== "object") return "";
      var a = geld(r.min, r.currency), b = geld(r.max, r.currency);
      if (!a && !b) return "";
      if (!a || !b || num(r.min) === num(r.max)) return a || b;
      return a + "–" + b;
    }).filter(Boolean).join(", ");
  }
  function letzterPreis(lp) {
    if (!lp || typeof lp !== "object") return "";
    /* price_str ist der Text der Quelle -- nur als Ersatz und gekuerzt, eine Zeile Preis. */
    return geld(lp.price, lp.currency) || str(lp.price_str).trim().slice(0, 40);
  }
  function datum(v) { return v ? (UC.fmtDate ? UC.fmtDate(v) : str(v).slice(0, 10)) : "–"; }
  /* "20. Sep – 26. Sep 2026": das Jahr nur einmal, wenn beide im selben stehen. */
  function zeitraum(a, b) {
    if (!a || !b) return "";
    var x = datum(a), y = datum(b);
    if (x === "–" || y === "–") return "";
    var ja = /^(\d{4})/.exec(str(a)), jb = /^(\d{4})/.exec(str(b));
    if (ja && jb && ja[1] === jb[1] && / \d{4}$/.test(x)) x = x.replace(/ \d{4}$/, "");
    return x + " – " + y;
  }

  /* ---- Katalog (Deutsch) ----------------------------------------------------------------------
     DER KATALOG IST EINER FUER DIE GANZE APP (feedback Katalog-Kollision): kein Schluessel, den
     core oder eine andere Komponente schon mit anderer Bedeutung fuehrt, und keiner, den core
     selbst fuehrt -- auch nicht mit gleichem Text. Am 04.10. per Abgleich aller Kataloge (core,
     Komponenten, Filter) gemessen: 0 Kollisionen; "Change" und der Zeitueberschreitungs-Satz
     stehen gleichlautend auch in events.js und bleiben hier, weil events keine Grundlage ist. */
  if (UC.addMessages) UC.addMessages("de", {
    "Shopping": "Shopping", "Beta": "Beta", "Merchant": "Händler",
    "Shopping Performance": "Shopping-Performance", "How your brand and competitors appear in AI shopping results": "Wie deine Marke und Wettbewerber in KI-Shopping-Ergebnissen erscheinen",
    "Brand Landscape": "Markenlandschaft", "Top brands by Share of Shelf": "Die stärksten Marken nach Share of Shelf",
    "Top Products": "Top-Produkte", "Most visible products across all brands": "Die sichtbarsten Produkte über alle Marken",
    "Product Movement": "Produktbewegung", "Largest Visibility changes vs. {period}": "Größte Visibility-Änderungen ggü. {period}",
    "Merchant Distribution": "Händlerverteilung", "Merchants listed with observed products": "Händler, die mit beobachteten Produkten gelistet waren",
    "View all brands": "Alle Marken", "View all products": "Alle Produkte", "View all merchants": "Alle Händler",
    "Shopping Rate": "Shopping Rate", "Brand Presence": "Brand Presence", "Share of Shelf": "Share of Shelf",
    "First Position Rate": "First Position Rate", "Avg. Position": "Ø Position", "Observations": "Beobachtungen",
    "Presence": "Presence", "Product": "Produkt", "Price": "Preis", "Rating": "Bewertung",
    "First Seen": "Zuerst gesehen", "Change": "Veränderung",
    "Top Product": "Top-Produkt", "Rising": "Steigend", "Declining": "Fallend", "New": "Neu", "Gone": "Nicht mehr gesehen",
    "Not enough history yet": "Noch zu wenig Verlauf", "Product Movement needs a comparison period. It appears once there is data from before this range.":
      "Die Produktbewegung braucht einen Vergleichszeitraum. Sie erscheint, sobald es Daten von vor diesem Zeitraum gibt.",
    "No comparison period available": "Kein Vergleichszeitraum verfügbar", "vs. {period}": "ggü. {period}",
    "No products matched your brand": "Kein Produkt ließ sich deiner Marke zuordnen",
    "Products without a tracked brand": "Produkte ohne getrackte Marke",
    "{n} merchant": "{n} Händler", "{n} merchants": "{n} Händler", "{n} other merchants": "{n} weitere Händler",
    "Unknown": "Unbekannt", "Search products…": "Produkte durchsuchen…",
    "Search products": "Produkte durchsuchen",
    "Search merchants": "Händler durchsuchen", "Previous images": "Vorherige Bilder", "Next images": "Nächste Bilder",
    "No matching products": "Keine passenden Produkte", "No matching brands": "Keine passenden Marken", "No matching merchants": "Keine passenden Händler",
    "Clear search and filters": "Suche und Filter zurücksetzen",
    "Brands observed": "Beobachtete Marken", "Tracked brands. Unassigned products are not counted.": "Getrackte Marken. Nicht zugeordnete Produkte zählen nicht.",
    "Your rank": "Dein Rang", "of {n} by Share of Shelf": "von {n} nach Share of Shelf", "Your Share of Shelf": "Dein Share of Shelf",
    "Top competitor": "Stärkster Wettbewerber", "Share of Shelf of {brand}": "Share of Shelf von {brand}",
    "Brand Performance": "Markenperformance", "How the top brands develop in AI shopping results": "Wie sich die stärksten Marken in KI-Shopping-Ergebnissen entwickeln",
    "Merchants observed": "Beobachtete Händler", "Across {n} products": "Über {n} Produkte", "Top merchant": "Stärkster Händler",
    "Most listed with observed products": "Am häufigsten mit beobachteten Produkten gelistet", "Top merchant share": "Anteil des stärksten Händlers",
    "{n} of {total} merchant mentions": "{n} von {total} Händlernennungen", "Merchant Share": "Händleranteil",
    "Share of all merchant mentions on observed products": "Anteil an allen Händlernennungen bei beobachteten Produkten",
    "Avg. Product Position": "Ø Produktposition",
    "Listed in AI results as {title}": "In KI-Ergebnissen gelistet als {title}", "Observed price": "Beobachteter Preis",
    "Product Performance": "Produktperformance", "How this product appears in AI shopping results over time": "Wie dieses Produkt über die Zeit in KI-Shopping-Ergebnissen erscheint",
    "Where this product appears": "Wo dieses Produkt erscheint", "Top Topics": "Top-Topics",
    "{n} response": "{n} Antwort", "{n} responses": "{n} Antworten",
    "Recent Appearances": "Letzte Auftritte", "Topic": "Topic",
    "View Response": "Antwort ansehen", "Single card": "Einzelkarte",
    "No merchants were listed with this product.": "Mit diesem Produkt war kein Händler gelistet.",
    "No appearances in this range.": "Keine Auftritte in diesem Zeitraum.",
    "Lower is better: position 1 sits at the top of the chart.": "Kleiner ist besser: Position 1 steht oben im Diagramm.",
    "{brand} presence": "Presence von {brand}", "{brand} avg. position": "Ø Position von {brand}",
    "Image": "Bild",
    "No brands yet": "Noch keine Marken", "No products yet": "Noch keine Produkte",
    "Largest Visibility changes": "Größte Visibility-Änderungen",
    "No product title, listing or brand contains \u201c{q}\u201d.": "Kein Produkttitel, Listing oder Markenname enthält \u201e{q}\u201c.",
    "No observed products match these filters.": "Keine beobachteten Produkte passen zu diesen Filtern.",
    "No AI Shopping products observed": "Keine KI-Shopping-Produkte beobachtet",
    "None of the AI responses in this range showed shopping products.": "Keine KI-Antwort in diesem Zeitraum hat Shopping-Produkte gezeigt.",
    "Shopping results aren't available for these models": "Für diese Modelle gibt es keine Shopping-Ergebnisse",
    "AI shopping results are currently only observed in ChatGPT. Choose ChatGPT in the model filter.":
      "KI-Shopping-Ergebnisse werden derzeit nur in ChatGPT beobachtet. Wähle ChatGPT im Modell-Filter.",
    "Clear all filters": "Alle Filter zurücksetzen",
    "Set up your own brand to see your brand metrics.": "Lege deine eigene Marke an, um deine Markenkennzahlen zu sehen.",
    "Shopping data could not be loaded": "Shopping-Daten konnten nicht geladen werden",
    "This product could not be loaded": "Dieses Produkt konnte nicht geladen werden",
    "This product was not found.": "Dieses Produkt wurde nicht gefunden.",
    "The date range is not valid.": "Der Zeitraum ist ungültig.",
    "Too many requests. Please wait a moment.": "Zu viele Anfragen. Bitte warte einen Moment.",
    "This is taking longer than expected. Please try again.": "Das dauert länger als erwartet. Bitte erneut versuchen.",
    "Try again": "Erneut versuchen",
    /* Die Saetze der Zusammenfassung -- Muster, deren Platzhalter erst NACH dem Uebersetzen gefuellt
       werden (die Reihenfolge im Deutschen ist eine andere). */
    "{brand} holds {sos} Share of Shelf, up from {prev}.": "{brand} hält {sos} Share of Shelf, nach {prev} davor.",
    "{brand} holds {sos} Share of Shelf, down from {prev}.": "{brand} hält {sos} Share of Shelf, nach {prev} davor.",
    "{brand} holds {sos} Share of Shelf.": "{brand} hält {sos} Share of Shelf.",
    "{brand} leads the shelf.": "{brand} führt das Regal an.",
    "{brand} leads with {sos}.": "{brand} führt mit {sos}.",
    "{brand} leads with {sos}, followed by {brand2} at {sos2}.": "{brand} führt mit {sos}, vor {brand2} mit {sos2}.",
    "{product} gained the most Visibility ({delta}).": "{product} hat am meisten Visibility gewonnen ({delta}).",
    "{product} lost the most Visibility ({delta}).": "{product} hat am meisten Visibility verloren ({delta}).",
    "{rate} of AI responses showed shopping products.": "{rate} der KI-Antworten haben Shopping-Produkte gezeigt.",
    "Your products appeared in {presence} of these results.": "Deine Produkte erschienen in {presence} dieser Ergebnisse."
  });

  /* Die Erklaerkarten (UC.makeExplain), Texte aus dem Entwurf (TIPS) mit den zwei First Position
     Rates der Uebergabe (Abschnitt 4): Marke gegen Produkt sind verschiedene Nenner. */
  var ERKLAER = {
    shoppingRate: { h: "Shopping Rate", f: "Shopping responses ÷ valid responses",
      t: "How often AI responses in this scope showed at least one shopping product." },
    presence: { h: "Brand Presence", f: "Responses with at least one of your products ÷ shopping responses",
      t: "How often at least one of your products appeared when an AI response showed shopping products." },
    share: { h: "Share of Shelf", f: "Your product observations ÷ all product observations",
      t: "Your part of all product placements observed in shopping results. A product shown twice in one response counts once." },
    firstBrand: { h: "First Position Rate", f: "Responses with the brand at position 1 ÷ responses with a product list",
      t: "How often the first product in a shopping result belonged to the brand." },
    firstProd: { h: "First Position Rate", f: "Responses with this product at position 1 ÷ responses with this product",
      t: "How often this product took position 1 in the shopping results it appeared in." },
    pos: { h: "Avg. Position", f: "Average of observed positions (1 = first)",
      t: "The average place of the product or brand in shopping results, counting from 1. Lower is better." },
    vis: { h: "Visibility", f: "Shopping responses with this product ÷ all shopping responses",
      t: "How often this product appeared in shopping responses for the selected filters." },
    obs: { h: "Observations", f: "Count of response-level observations",
      t: "The number of individual AI responses in which the product was seen. A count, not a rate." },
    price: { h: "Observed price", f: "Lowest – highest observed price",
      t: "Price shown next to the product in AI shopping results during the selected period. Not a live shop price." },
    merchant: { h: "Merchant Share", f: "Mentions of this merchant ÷ all merchant mentions",
      t: "How often a merchant was listed with observed products. This shows presence in AI results, not sales or conversions." },
    /* Die Kacheln von Brands und Merchants (05.10.: jede Kachel der Reihe bekommt ihre Erklaerung). */
    brandsObserved: { h: "Brands observed", f: "Tracked brands with at least one observed product",
      t: "How many of your tracked brands appeared in shopping results in this period. Products without a tracked brand are not counted." },
    ownRank: { h: "Your rank", f: "Rank by Share of Shelf, 1 is the highest",
      t: "Where your brand stands among all tracked brands, ranked by Share of Shelf." },
    topCompetitor: { h: "Top competitor", f: "Highest Share of Shelf among tracked competitors",
      t: "The tracked competitor with the largest part of all product placements in this period." },
    merchantsObserved: { h: "Merchants observed", f: "Distinct merchant names on observed products",
      t: "How many different merchants were listed with the observed products. Merchant names are shown as they appear in the results." },
    topMerchant: { h: "Top merchant", f: "Most merchant mentions",
      t: "The merchant listed most often with the observed products in this period." },
    topMerchantShare: { h: "Top merchant share", f: "Mentions of the top merchant ÷ all merchant mentions",
      t: "The top merchant's part of all merchant mentions on observed products." }
  };
  if (UC.addMessages) UC.addMessages("de", {
    "Shopping responses ÷ valid responses": "Shopping-Antworten ÷ gültige Antworten",
    "How often AI responses in this scope showed at least one shopping product.": "Wie oft KI-Antworten in diesem Umfang mindestens ein Shopping-Produkt gezeigt haben.",
    "Responses with at least one of your products ÷ shopping responses": "Antworten mit mindestens einem deiner Produkte ÷ Shopping-Antworten",
    "How often at least one of your products appeared when an AI response showed shopping products.": "Wie oft mindestens eines deiner Produkte erschien, wenn eine KI-Antwort Shopping-Produkte zeigte.",
    "Your product observations ÷ all product observations": "Deine Produktbeobachtungen ÷ alle Produktbeobachtungen",
    "Your part of all product placements observed in shopping results. A product shown twice in one response counts once.": "Dein Anteil an allen beobachteten Produktplatzierungen in Shopping-Ergebnissen. Ein Produkt, das in einer Antwort zweimal erscheint, zählt einmal.",
    "Responses with the brand at position 1 ÷ responses with a product list": "Antworten mit der Marke auf Platz 1 ÷ Antworten mit Produktliste",
    "How often the first product in a shopping result belonged to the brand.": "Wie oft das erste Produkt in einem Shopping-Ergebnis zur Marke gehörte.",
    "Responses with this product at position 1 ÷ responses with this product": "Antworten mit diesem Produkt auf Platz 1 ÷ Antworten mit diesem Produkt",
    "How often this product took position 1 in the shopping results it appeared in.": "Wie oft dieses Produkt in den Shopping-Ergebnissen, in denen es erschien, auf Platz 1 stand.",
    "Average of observed positions (1 = first)": "Durchschnitt der beobachteten Positionen (1 = erste)",
    "The average place of the product or brand in shopping results, counting from 1. Lower is better.": "Der durchschnittliche Platz des Produkts oder der Marke in Shopping-Ergebnissen, gezählt ab 1. Kleiner ist besser.",
    "Shopping responses with this product ÷ all shopping responses": "Shopping-Antworten mit diesem Produkt ÷ alle Shopping-Antworten",
    "How often this product appeared in shopping responses for the selected filters.": "Wie oft dieses Produkt in Shopping-Antworten zu den gewählten Filtern erschien.",
    "Count of response-level observations": "Anzahl der Beobachtungen je Antwort",
    "The number of individual AI responses in which the product was seen. A count, not a rate.": "Die Zahl einzelner KI-Antworten, in denen das Produkt gesehen wurde. Eine Anzahl, keine Rate.",
    "Lowest – highest observed price": "Niedrigster – höchster beobachteter Preis",
    "Price shown next to the product in AI shopping results during the selected period. Not a live shop price.": "Der Preis, der in KI-Shopping-Ergebnissen im gewählten Zeitraum neben dem Produkt stand. Kein aktueller Shop-Preis.",
    "Mentions of this merchant ÷ all merchant mentions": "Nennungen dieses Händlers ÷ alle Händlernennungen",
    "How often a merchant was listed with observed products. This shows presence in AI results, not sales or conversions.": "Wie oft ein Händler mit beobachteten Produkten gelistet war. Das zeigt Präsenz in KI-Ergebnissen, keine Verkäufe oder Conversions.",
    "Tracked brands with at least one observed product": "Getrackte Marken mit mindestens einem beobachteten Produkt",
    "How many of your tracked brands appeared in shopping results in this period. Products without a tracked brand are not counted.": "Wie viele deiner getrackten Marken in diesem Zeitraum in Shopping-Ergebnissen erschienen. Produkte ohne getrackte Marke zählen nicht.",
    "Rank by Share of Shelf, 1 is the highest": "Rang nach Share of Shelf, 1 ist der höchste",
    "Where your brand stands among all tracked brands, ranked by Share of Shelf.": "Wo deine Marke unter allen getrackten Marken steht, gereiht nach Share of Shelf.",
    "Highest Share of Shelf among tracked competitors": "Höchster Share of Shelf unter den getrackten Wettbewerbern",
    "The tracked competitor with the largest part of all product placements in this period.": "Der getrackte Wettbewerber mit dem größten Anteil an allen Produktplatzierungen in diesem Zeitraum.",
    "Distinct merchant names on observed products": "Verschiedene Händlernamen bei beobachteten Produkten",
    "How many different merchants were listed with the observed products. Merchant names are shown as they appear in the results.": "Wie viele verschiedene Händler mit den beobachteten Produkten gelistet waren. Die Händlernamen stehen so da, wie sie in den Ergebnissen erscheinen.",
    "Most merchant mentions": "Die meisten Händlernennungen",
    "The merchant listed most often with the observed products in this period.": "Der Händler, der in diesem Zeitraum am häufigsten mit den beobachteten Produkten gelistet war.",
    "Mentions of the top merchant ÷ all merchant mentions": "Nennungen des stärksten Händlers ÷ alle Händlernennungen",
    "The top merchant's part of all merchant mentions on observed products.": "Der Anteil des stärksten Händlers an allen Händlernennungen bei beobachteten Produkten."
  });

  /* Stabile Fehlercodes (Uebergabe 9) -> was der Nutzer tun kann. Alles andere: der allgemeine Satz. */
  var FEHLER = {
    shopping_invalid_date: "The date range is not valid.",
    shopping_product_not_found: "This product was not found.",
    shopping_rate_limited: "Too many requests. Please wait a moment.",
    zeit: "This is taking longer than expected. Please try again."
  };
  function fehlerText(code) {
    var c = str(code).trim();
    if (/^team_access_/.test(c) || c === "forbidden" || c === "not authenticated") return t("Your team doesn't have access right now.");
    return t(FEHLER[c] || "Something went wrong. Please try again.");
  }

  var SEITEN = [
    { value: "overview", label: "Overview", icon: "dashboardSquare" },
    { value: "products", label: "Products", icon: "stackStar" },
    { value: "brands", label: "Brands", icon: "squareStack" },
    { value: "merchants", label: "Merchants", icon: "store" }
  ];
  var SEITE_OK = { overview: 1, products: 1, brands: 1, merchants: 1, detail: 1 };
  /* Die erlaubten Sortierungen je Tabelle -- genau die Werte der Uebergabe (Abschnitt 7). Ein Wert
     ausserhalb waere shopping_invalid_param. */
  var ORDER = {
    products: ["visibility_desc", "visibility_asc", "observations_desc", "avg_position_asc", "avg_position_desc",
               "first_position_rate_desc", "last_seen_desc", "price_asc", "price_desc", "title_asc", "rating_desc"],
    brands: ["share_of_shelf_desc", "share_of_shelf_asc", "share_of_shelf_delta_desc", "presence_desc", "avg_position_asc",
             "first_position_rate_desc", "observations_desc", "products_desc", "name_asc"],
    merchants: ["observations_desc", "observations_asc", "observations_delta_desc", "products_desc", "tracked_brands_desc",
                "avg_position_asc", "first_seen_asc", "last_seen_desc", "name_asc"]
  };
  var ORDER_VORGABE = { products: "visibility_desc", brands: "share_of_shelf_desc", merchants: "observations_desc" };
  /* Die Klickfolge je Spaltenkopf (UC.makeHeadSort): die erste Stufe ist die sinnvolle Richtung,
     nach dem letzten Glied zurueck zur Vorgabe der Tabelle. */
  var ZYKLEN = {
    products: { visibility: ["visibility:desc", "visibility:asc"], observations: ["observations:desc"],
                avg_position: ["avg_position:asc", "avg_position:desc"], first_position_rate: ["first_position_rate:desc"],
                price: ["price:asc", "price:desc"], rating: ["rating:desc"], last_seen: ["last_seen:desc"], title: ["title:asc"] },
    brands: { share_of_shelf: ["share_of_shelf:desc", "share_of_shelf:asc"], presence: ["presence:desc"],
              avg_position: ["avg_position:asc"], first_position_rate: ["first_position_rate:desc"],
              observations: ["observations:desc"], products: ["products:desc"], share_of_shelf_delta: ["share_of_shelf_delta:desc"],
              name: ["name:asc"] },
    merchants: { observations: ["observations:desc", "observations:asc"],
                 products: ["products:desc"], avg_position: ["avg_position:asc"], first_seen: ["first_seen:asc"],
                 last_seen: ["last_seen:desc"], name: ["name:asc"] }
  };
  /* Die Graurampe der Balken (Haendler, "Wo"-Spalten) kommt seit dem 05.10. aus core
     (UC.balkenGrau) -- Ads braucht dieselbe. Dort steht auch, warum sie im Dunkeln gegenlaeufig ist. */
  var WARTE_MS = 25000;
  var CACHE_MAX = 16;

  /* ============================================================================================
     Eine Wurzel
     ============================================================================================ */
  function initRoot(root) {
    if (root.__ushController) return root.__ushController;
    var instanceId = root.getAttribute("data-instance") || "default";
    if (/^[A-Z_]{4,}$/.test(instanceId)) return null;   /* Platzhalter noch nicht ersetzt */
    var fire = UC.makeFire(root, { label: "shopping", eventPrefix: "ush" });
    /* data-adresse="aus" (06.10., Landingpage): die Seite steht in einer fremden Seite -- deren
       Adresse gehoert nicht uns. Dann liest und schreibt die Komponente keine ?shop/?product, und
       Zurueck im Browser bleibt bei der fremden Seite. In der App steht das Attribut nicht. */
    var ohneAdresse = root.getAttribute("data-adresse") === "aus";

    /* Der Stand je Instanz im window-Speicher: Bubble baut das Element bei einem Themenwechsel neu
       (feedback Themenwechsel = Neuaufbau), dann geht es mit Seite, Filtern und Daten weiter --
       kein Skelett, kein Sprung auf die Overview. */
    var saved = STORE[instanceId] || null;
    function gemerkt(k, sonst) { return saved && saved[k] != null ? saved[k] : sonst; }
    function tabelle(name) {
      return gemerkt(name, { suche: "", order: ORDER_VORGABE[name], page: 1, pageSize: UC.DEFAULT_PAGE_SIZE || 15 });
    }
    var state = {
      seite: "overview", produktId: null,
      filter: gemerkt("filter", { von: null, bis: null, preset: "", modelle: null, maerkte: null, topics: null, tagmode: "or" }),
      ovMetrik: gemerkt("ovMetrik", "presence"), brMetrik: gemerkt("brMetrik", "share_of_shelf"), dMetrik: gemerkt("dMetrik", "visibility"),
      products: gemerkt("products", { seg: "all", suche: "", order: "visibility_desc", page: 1, pageSize: UC.DEFAULT_PAGE_SIZE || 15, marke: null, haendler: null }),
      brands: tabelle("brands"), merchants: tabelle("merchants"),
      auftritte: gemerkt("auftritte", { page: 1, pageSize: UC.DEFAULT_PAGE_SIZE || 15 }),
      cache: gemerkt("cache", { overview: {}, products: {}, detail: {}, merchants: {} }),
      reihe: gemerkt("reihe", { overview: [], products: [], detail: [], merchants: [] }),
      fehler: {}, kalenderDa: false
    };
    function persist() {
      if (root.isConnected === false) return;
      STORE[instanceId] = { filter: state.filter, ovMetrik: state.ovMetrik, brMetrik: state.brMetrik, dMetrik: state.dMetrik,
        products: state.products, brands: state.brands, merchants: state.merchants, auftritte: state.auftritte,
        cache: state.cache, reihe: state.reihe };
    }
    function isDark() { return (UC.themeParam && UC.themeParam(root.getAttribute("data-isdark"))) || root.getAttribute("data-theme") === "dark"; }
    function grau(i) { return UC.balkenGrau ? UC.balkenGrau(i, isDark()) : (isDark() ? "#e0e0e0" : "#1f1f1b"); }
    if (isDark()) root.setAttribute("data-theme", "dark"); else root.removeAttribute("data-theme");
    if (UC.makeTooltips) UC.makeTooltips(root, isDark);

    /* Die Erklaerkarte aus core, an jedem Info-Zeichen der Seite, im Format der Spaltenkoepfe
       (brands-overview, 05.10. angefordert: "im gewohnten Format"): oben auf der hellen Platte ein
       Wert, so wie ihn die Zelle zeigt, darunter Titel und Satz. Die Formel der Uebergabe steht als
       zweiter Satz darunter -- sie sagt, wovon der Anteil ein Anteil ist. */
    var HASH_ERKL = UC.HASH_ICON || "";
    function erklaerVorschau(key) {
      var hoch = '<span class="up-explain-up">' + (UC.TREND_UP || "") + '</span>';
      var bsp = { shoppingRate: ["36.7%", "1.0%"], presence: ["84.7%", "2.6%"], share: ["31.9%", "6.4%"],
                  firstBrand: ["65.6%", "2.9%"], firstProd: ["66.8%", "4.1%"], vis: ["37.8%", "6.5%"],
                  obs: ["49", "8"], merchant: ["25.7%", ""], price: ["€13.49–€14.99", ""], brandsObserved: ["31", ""],
                  ownRank: ["#1", ""], topCompetitor: ["12.0%", ""], merchantsObserved: ["32", ""],
                  topMerchant: ["Amazon.de", ""], topMerchantShare: ["25.7%", ""] }[key];
      if (key === "pos") return '<span class="up-explain-row">' + HASH_ERKL + '<span>2.0</span></span>';
      if (!bsp) return "";
      return '<span class="up-explain-row">' + esc(bsp[0]) + (bsp[1] ? hoch + '<span class="up-explain-up">' + esc(bsp[1]) + '</span>' : '') + '</span>';
    }
    if (UC.makeExplain) UC.makeExplain({ root: root, triggerSel: ".ush-erklaer", getIsDark: isDark,
      html: function (key) {
        var e = ERKLAER[key];
        if (!e) return "";
        var vis = erklaerVorschau(key);
        return (vis ? '<div class="up-explain-vis">' + vis + '</div>' : '') +
          '<div class="up-explain-h">' + esc(t(e.h)) + '</div><div class="up-explain-t">' + esc(t(e.t)) + '</div>' +
          '<div class="up-explain-t">' + esc(t(e.f)) + '</div>';
      } });
    function info(key) {
      return '<span class="up-th-info ush-erklaer" data-explain="' + esc(key) + '">' + UC.icon("info", 2) + '</span>';
    }

    /* ---- Gerueste: Kopf, Reiter, Filterzeile, Inhalt ----------------------------------------- */
    root.classList.add("up-sidebar-clear");
    var idDaten = instanceId + "_dates", idFilter = instanceId + "_filters", idModelle = instanceId + "_models",
        idMaerkte = instanceId + "_markets", idTopics = instanceId + "_topics";
    root.innerHTML =
      '<div class="up-ph-top ush-pagehead">' +
        '<div class="up-ph-left"><h1 class="up-ph-heading">' + esc(t("Shopping")) + '</h1>' +
          '<p class="up-ph-desc">' + esc(t("How your brand and competitors appear in AI shopping results")) + '</p></div>' +
      '</div>' +
      '<div class="up-ph-nav ush-nav" role="tablist"></div>' +
      '<div class="ush-filterzeile">' +
        '<div class="up-root udr-root ush-daten" data-instance="' + esc(idDaten) + '" data-local="yes" data-isdark="' + (isDark() ? "yes" : "no") + '"></div>' +
        '<div class="up-root ufb-root ush-filterleiste" data-instance="' + esc(idFilter) + '" data-topics-instance="' + esc(idTopics) + '"' +
          ' data-models-instance="' + esc(idModelle) + '" data-markets-instance="' + esc(idMaerkte) + '" data-isdark="' + (isDark() ? "yes" : "no") + '"></div>' +
        '<div class="up-root utf-root" data-instance="' + esc(idTopics) + '" data-local="yes" data-isdark="' + (isDark() ? "yes" : "no") + '"></div>' +
        '<div class="up-root umf-root" data-instance="' + esc(idModelle) + '" data-local="yes" data-isdark="' + (isDark() ? "yes" : "no") + '"></div>' +
        '<div class="up-root umk-root" data-instance="' + esc(idMaerkte) + '" data-local="yes" data-isdark="' + (isDark() ? "yes" : "no") + '"></div>' +
      '</div>' +
      '<div class="ush-main"></div>';
    var elMain = root.querySelector(".ush-main"), elNav = root.querySelector(".ush-nav");
    var nav = UC.makePageNav ? UC.makePageNav(root, {
      nav: elNav, storeKey: instanceId + "|ush-nav",
      selected: "overview",
      pages: SEITEN.map(function (p) { return { value: p.value, label: p.label, icon: UC.icon(p.icon, 2) }; }),
      onSelect: function (v) { seiteOeffnen(v, true); }
    }) : null;
    var krumen = UC.makePageCrumbs ? UC.makePageCrumbs(root, {
      icon: "shoppingBag", name: "Shopping", komponente: true, quelle: elNav,
      klick: function () { seiteOeffnen("overview", true); },
      klickWenn: function () { return state.seite === "detail"; },
      stufen: function () {
        if (state.seite !== "detail") {
          var p = SEITEN.filter(function (x) { return x.value === state.seite; })[0];
          return p ? [{ name: p.label, uebersetzen: true }] : [];
        }
        var d = dasDetail(), titel = d && d.product ? str(d.product.title).trim() || str(d.product.listing_title).trim() : "";
        /* "…" heisst "kommt gleich" -- bei einem Ladefehler kommt nichts mehr, dann steht dort
           schlicht "Product". */
        var fe = !d && fehlerVon(detailAnfrage());
        return [{ name: "Products", uebersetzen: true, klick: function () { seiteOeffnen("products", true); } },
                titel ? { name: titel } : fe ? { name: "Product", uebersetzen: true } : { name: "…" }];
      }
    }) : null;
    function krumenNeu() { if (krumen && krumen.zeichnen) krumen.zeichnen(); }

    /* ---- Adresse ------------------------------------------------------------------------------ */
    function adresseLesen() {
      if (ohneAdresse) return { seite: SEITE_OK[state.seite] ? state.seite : "overview", produktId: state.produktId || null };
      var q;
      try { q = new URLSearchParams(window.location.search); } catch (e) { q = null; }
      var s = q ? str(q.get("shop")).trim() : "", p = q ? str(q.get("product")).trim() : "";
      /* Eine Produkt-Id ist eine Ziffernfolge (als Text); alles andere in der Adresse ist keine. */
      if (p && !/^[0-9A-Za-z_-]{1,64}$/.test(p)) p = "";
      if (p) return { seite: "detail", produktId: p };
      return { seite: SEITE_OK[s] && s !== "detail" ? s : "overview", produktId: null };
    }
    function adresseSetzen(neuerEintrag) {
      if (ohneAdresse) return;
      try {
        var u = new URL(window.location.href);
        var s = state.seite === "detail" ? "products" : state.seite;
        if (s === "overview") u.searchParams.delete("shop"); else u.searchParams.set("shop", s);
        if (state.seite === "detail" && state.produktId) u.searchParams.set("product", state.produktId);
        else u.searchParams.delete("product");
        var neu = u.pathname + u.search + u.hash;
        if (neu === window.location.pathname + window.location.search + window.location.hash) return;
        if (neuerEintrag) window.history.pushState(window.history.state, "", neu);
        else window.history.replaceState(window.history.state, "", neu);
      } catch (e) {}
    }

    /* ---- Filter -------------------------------------------------------------------------------
       Der Kalender und die drei Filter sind lokale Instanzen (data-local): sie senden nichts an
       Bubble, sie melden sich als DOM-Ereignis an dieser Wurzel. */
    function filterSig() {
      var f = state.filter;
      return [f.von || "", f.bis || "", (f.modelle || []).join(","), (f.maerkte || []).join(","),
              (f.topics || []).join(","), f.topics && f.topics.length ? f.tagmode : ""].join("|");
    }
    function filterAktiv() {
      var f = state.filter;
      return !!((f.modelle && f.modelle.length) || (f.maerkte && f.maerkte.length) || (f.topics && f.topics.length));
    }
    function liste(s) { return String(s || "").split(",").map(function (x) { return x.trim(); }).filter(Boolean); }
    /* include/exclude wie in events (filterUebernehmen): exclude heisst "alle ausser", also die
       uebrigen Schluessel des Stores. Leer heisst alle = null. */
    function auswahl(feld, d, schluessel) {
      var gew = liste(d && d[schluessel]);
      if (!gew.length) return null;
      if (d.select_mode !== "exclude") return gew;
      var alle = feld === "modelle"
        ? (UC.getModels ? UC.getModels() : []).map(function (m) { return str(m.key || m.model); })
        : (UC.getAllMarkets ? toArr(UC.getAllMarkets()) : []).map(function (m) { return str(m.alpha2 || m.alpha3 || m.code || m.market).toUpperCase(); });
      return alle.filter(function (k) { return k && gew.indexOf(k) < 0; });
    }
    function toArr(x) {
      if (isArr(x)) return x;
      if (x && typeof x === "object") return Object.keys(x).map(function (k) { var v = x[k]; return v && typeof v === "object" ? v : { code: k }; });
      return [];
    }
    function filterSetzen(feld, wert) {
      var alt = JSON.stringify(state.filter[feld] == null ? null : state.filter[feld]);
      if (alt === JSON.stringify(wert == null ? null : wert)) return false;
      state.filter[feld] = wert;
      return true;
    }
    function filterGeaendert() {
      /* Neue Filter sind ein neuer Ergebnissatz: jede Tabelle zurueck auf Seite 1. */
      state.products.page = 1; state.brands.page = 1; state.merchants.page = 1; state.auftritte.page = 1;
      persist();
      zeichnen();
      bedarf();
    }
    root.addEventListener("umf-models", function (e) { if (filterSetzen("modelle", auswahl("modelle", e.detail, "model_keys"))) filterGeaendert(); });
    root.addEventListener("umk-markets", function (e) { if (filterSetzen("maerkte", auswahl("maerkte", e.detail, "market_codes"))) filterGeaendert(); });
    root.addEventListener("utf-topics", function (e) {
      var d = e.detail || {}, ids = liste(d.topic_ids);
      var a = filterSetzen("topics", ids.length ? ids : null);
      var b = filterSetzen("tagmode", d.tag_mode === "and" ? "and" : "or");
      if (a || (b && ids.length)) filterGeaendert();
    });
    /* Der Kalender meldet jede Auswahl als "change" (bubbles), auch "Apply everywhere" aus einer
       anderen Ansicht -- dann mit reason "sync". Gleich ist gleich: ein Ereignis mit demselben
       Zeitraum laedt nichts. */
    function kalender() { var k = root.querySelector(".ush-daten"); return k && k.__udrCtrl ? k.__udrCtrl : null; }
    function kalenderLesen() {
      var c = kalender(), r = null;
      try { r = c && c.getRange ? c.getRange() : null; } catch (e) { r = null; }
      if (!r || !r.from || !r.to) return false;
      var a = filterSetzen("von", r.from), b = filterSetzen("bis", r.to);
      state.filter.preset = r.preset || "";
      state.kalenderDa = true;
      return a || b;
    }
    root.addEventListener("change", function (e) {
      if (!e.target || !e.target.classList || !e.target.classList.contains("ush-daten")) return;
      var d = e.detail || {};
      if (!d.date_from || !d.date_to) return;
      state.kalenderDa = true;
      var a = filterSetzen("von", d.date_from), b = filterSetzen("bis", d.date_to);
      state.filter.preset = d.preset || "";
      if (a || b) filterGeaendert();
    });
    /* Beim Aufbau und beim Wiederkommen: was zeigen die Filter WIRKLICH? Ihr Stand ueberlebt einen
       Neuaufbau in ihren eigenen Speichern -- diese Wurzel uebernimmt ihn, statt zu raten. */
    function filterAbgleichen() {
      var g = false;
      g = kalenderLesen() || g;
      var m = root.querySelector(".umf-root"), k = root.querySelector(".umk-root"), tp = root.querySelector(".utf-root");
      try { if (m && m.__umfCtrl) g = filterSetzen("modelle", auswahl("modelle", m.__umfCtrl.getSelected(), "model_keys")) || g; } catch (e) {}
      try { if (k && k.__umkCtrl) g = filterSetzen("maerkte", auswahl("maerkte", k.__umkCtrl.getSelected(), "market_codes")) || g; } catch (e) {}
      try {
        if (tp && tp.__utfCtrl) {
          var s = tp.__utfCtrl.getSelected(), ids = liste(s.topic_ids);
          g = filterSetzen("topics", ids.length ? ids : null) || g;
          g = filterSetzen("tagmode", s.tag_mode === "and" ? "and" : "or") || g;
        }
      } catch (e) {}
      return g;
    }
    function alleFilterZuruecksetzen() {
      /* Ueber die eigenen Wege der Filter, wie "Clear All" der Filterleiste: jeder raeumt seine
         Auswahl auf und meldet sich -- die Ereignisse oben laden dann neu. */
      var fb = root.querySelector(".ush-filterleiste");
      var knopf = fb && fb.querySelector(".ufb-clear, [data-clearall], .ufb-clearall");
      if (knopf) { try { knopf.click(); } catch (e) {} }
      else {
        ["umf-root", "umk-root", "utf-root"].forEach(function (c) {
          var el = root.querySelector("." + c), ctrl = el && (el.__umfCtrl || el.__umkCtrl || el.__utfCtrl);
          try { if (ctrl && ctrl.reset) ctrl.reset(true); } catch (e) {}
        });
      }
      state.products.suche = ""; state.products.seg = "all"; state.products.marke = null; state.products.haendler = null;
      persist();
    }

    /* ---- Anfragen an Bubble -------------------------------------------------------------------
       Je RPC ein Kanal: hoechstens EINE Anfrage unterwegs, eine Uhr, die das Warten beendet. Die
       Antwort gehoert der Anfrage, die unterwegs war (sig). */
    var KANAL = {
      overview: { attr: "data-overview-fn", name: "shopOverview", setter: "setShoppingOverview", rpc: "cached_shopping_overview_v1" },
      products: { attr: "data-products-fn", name: "shopProducts", setter: "setShoppingProducts", rpc: "cached_shopping_products_v1" },
      detail: { attr: "data-detail-fn", name: "shopProductDetail", setter: "setShoppingProductDetail", rpc: "cached_shopping_product_detail_v1" },
      merchants: { attr: "data-merchants-fn", name: "shopMerchants", setter: "setShoppingMerchants", rpc: "cached_shopping_merchants_v1" }
    };
    var unterwegs = { overview: null, products: null, detail: null, merchants: null };
    function grundBody() {
      var f = state.filter;
      return { p_team: team(), p_date_from: f.von || null, p_date_to: f.bis || null,
               p_models: f.modelle && f.modelle.length ? f.modelle.slice() : null,
               p_markets: f.maerkte && f.maerkte.length ? f.maerkte.slice() : null,
               p_tag_ids: f.topics && f.topics.length ? f.topics.slice() : null,
               p_tagmode: f.tagmode === "and" ? "and" : "or" };
    }
    function mit(o, extra) { for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) o[k] = extra[k]; return o; }
    function limitOf(tb) { var n = num(tb.pageSize) || 15; return Math.max(1, Math.min(100, Math.round(n))); }
    function offsetOf(tb) { return Math.max(0, ((num(tb.page) || 1) - 1) * limitOf(tb)); }
    function orderOf(name, tb) { return ORDER[name].indexOf(tb.order) >= 0 ? tb.order : ORDER_VORGABE[name]; }
    function suchText(s) { s = str(s).trim(); return s ? s.slice(0, 200) : null; }
    /* Die Anfragen, die eine Seite braucht -- je { kanal, sig, body }. */
    var OV_VORGABE = { suche: "", order: "share_of_shelf_desc", page: 1, pageSize: 25 };
    function ovAnfrage(tb) {
      var b = mit(grundBody(), { p_brand_search: suchText(tb.suche), p_brand_order: orderOf("brands", tb),
                                 p_brand_limit: limitOf(tb), p_brand_offset: offsetOf(tb) });
      return { kanal: "overview", body: b, sig: sigVon(b) };
    }
    function prodAnfrage() {
      var tb = state.products;
      var b = mit(grundBody(), { p_segment: { all: 1, you: 1, competition: 1, other: 1 }[tb.seg] ? tb.seg : "all",
        p_search: suchText(tb.suche), p_merchant: tb.haendler ? str(tb.haendler) : null,
        p_company_id: tb.marke && tb.marke.id ? str(tb.marke.id) : null,
        p_order: orderOf("products", tb), p_limit: limitOf(tb), p_offset: offsetOf(tb) });
      return { kanal: "products", body: b, sig: sigVon(b) };
    }
    function detailAnfrage() {
      var b = mit(grundBody(), { p_source_product_id: str(state.produktId), p_limit: limitOf(state.auftritte), p_offset: offsetOf(state.auftritte) });
      return { kanal: "detail", body: b, sig: sigVon(b) };
    }
    var ME_VORGABE = { suche: "", order: "observations_desc", page: 1, pageSize: 15 };
    function meAnfrage(tb) {
      var b = mit(grundBody(), { p_search: suchText(tb.suche), p_order: orderOf("merchants", tb), p_limit: limitOf(tb), p_offset: offsetOf(tb) });
      return { kanal: "merchants", body: b, sig: sigVon(b) };
    }
    /* Die Signatur ist der Body ohne p_team -- das Team wechselt nur mit einem Seitenaufbau. */
    function sigVon(b) {
      var o = {}, k;
      for (k in b) if (k !== "p_team" && Object.prototype.hasOwnProperty.call(b, k)) o[k] = b[k];
      return JSON.stringify(o);
    }
    function bedarfListe() {
      switch (state.seite) {
        case "overview": return [ovAnfrage(OV_VORGABE)];
        case "brands": return [ovAnfrage(state.brands)];
        case "products": return [prodAnfrage()];
        case "detail": return state.produktId ? [detailAnfrage()] : [];
        /* Die Balken zeigen die ERSTE Seite in der Vorgabe-Sortierung (Uebergabe 7.4) -- sortiert
           oder blaettert die Tabelle, braucht es beide Antworten. */
        case "merchants": return [meAnfrage(ME_VORGABE), meAnfrage(state.merchants)];
      }
      return [];
    }
    function sichtbar() {
      if (root.isConnected === false) return false;
      return UC.istSichtbar ? UC.istSichtbar(root) : true;
    }
    function bedarf() {
      if (!sichtbar()) { verdecktPruefen(); return; }
      /* Ohne Kalender keine erste Anfrage: er zeigt einen Zeitraum, und die Zahlen muessen genau
         diesen haben (sonst "Last 7 Days" ueber 30 Tagen Daten). Er steht nach spaetestens 3s;
         fehlt date-range.js ganz, laedt es ohne Zeitraum (Backend: die letzten 30 Tage). */
      if (!state.kalenderDa && !kalenderLesen() && kalenderWarten()) return;
      bedarfListe().forEach(function (a) {
        if (state.cache[a.kanal][a.sig] || unterwegs[a.kanal]) return;
        if (state.fehler[a.kanal + a.sig]) return;
        senden(a);
      });
    }
    var kalenderVersuche = 0, kalenderUhr = null;
    function kalenderWarten() {
      if (kalenderVersuche >= 20) return false;
      if (!kalenderUhr) kalenderUhr = setTimeout(function () { kalenderUhr = null; kalenderVersuche++; bedarf(); }, 150);
      return true;
    }
    var verdecktUhr = null;
    function verdecktPruefen() {
      if (verdecktUhr || root.isConnected === false) return;
      verdecktUhr = setTimeout(function () { verdecktUhr = null; if (sichtbar()) { filterAbgleichen(); zeichnen(); bedarf(); } else verdecktPruefen(); }, 1000);
    }
    function senden(a) {
      var k = KANAL[a.kanal];
      var u = unterwegs[a.kanal] = { sig: a.sig, body: a.body, uhr: null };
      u.uhr = setTimeout(function () {
        if (unterwegs[a.kanal] !== u) return;
        unterwegs[a.kanal] = null;
        nachzuegler[a.kanal]++;
        state.fehler[a.kanal + a.sig] = "zeit";
        melden("zeit" + a.kanal, "Keine Antwort auf " + k.name + " nach " + (WARTE_MS / 1000) + " s. Ruft der Workflow von " +
          k.name + " am Ende " + KANAL[a.kanal].setter + '("' + instanceId + '", ...) auf?');
        zeichnen();
        bedarf();
      }, WARTE_MS);
      var text = "";
      try { text = JSON.stringify(a.body); } catch (e) { text = ""; }
      fire(k.attr, k.name, text);
    }
    /* WELCHER RPC GEHOERT DIE ANTWORT? (05.10.) Gemeldet: Products, Merchants und Detail blieben
       im Skelett, obwohl die RPCs liefen und die Konsole still war -- genau das Bild, wenn ein
       kopierter Workflow noch den Setter des Originals ruft: die Antwort kommt im falschen Kanal an,
       dort wartet keine Anfrage, und sie faellt weg. Die vier Antworten sind am Inhalt eindeutig
       (Produkt, Produktliste, Haendlerliste, Uebersicht); die Komponente legt sie dorthin, wo sie
       hingehoert, und sagt die Fehlverdrahtung einmal in der Konsole. */
    function kanalVon(d) {
      if (!d || typeof d !== "object") return null;
      if (d.product && typeof d.product === "object") return "detail";
      if (isArr(d.rows) || (d.segment_counts && typeof d.segment_counts === "object")) return "products";
      if (isArr(d.merchants) && !d.kpis && !isArr(d.brands)) return "merchants";
      if (d.kpis || isArr(d.brands) || d.brands_page || d.brands_summary || d.chart) return "overview";
      return null;
    }
    var gemeldet = {};
    function melden(schluessel, text) {
      if (gemeldet[schluessel]) return;
      gemeldet[schluessel] = true;
      if (window.console) console.warn("[shopping] " + text);
    }
    /* Eine Antwort. Ohne Anfrage unterwegs (Bubble hat von sich aus neu geladen) gehoert sie der
       ersten Anfrage, die die offene Seite fuer diesen Kanal braucht -- die einzige, fuer die sie
       ueberhaupt gemeint sein kann. */
    function antwort(kanal, raw, f) {
      var d = objekt(raw), echt = kanalVon(d);
      if (echt && echt !== kanal) {
        melden("kanal" + kanal + echt, KANAL[kanal].setter + " bekam die Antwort von " + KANAL[echt].rpc + ". Im Workflow von " +
          KANAL[echt].name + " muss der Run-JS-Schritt " + KANAL[echt].setter + " rufen. Die Antwort ist trotzdem richtig zugeordnet.");
        kanal = echt;
      }
      var u = unterwegs[kanal], ziel = u;
      if (!ziel) {
        var l = bedarfListe().filter(function (a) { return a.kanal === kanal; });
        ziel = l.length ? l[0] : null;
        if (!ziel && d) melden("ohne" + kanal, KANAL[kanal].setter + " bekam eine Antwort, ohne dass die offene Seite sie braucht -- sie wird nicht angezeigt.");
      }
      var ok = d && pruefen(kanal, d);
      if (ok && ziel && nachzuegler[kanal] > 0 && !passtZu(kanal, d, ziel.body)) {
        /* Ein Nachzuegler: die Anfrage, der er zugeordnet wuerde, bleibt unterwegs, ihre Uhr
           laeuft weiter. */
        nachzuegler[kanal]--;
        return false;
      }
      if (u) { clearTimeout(u.uhr); unterwegs[kanal] = null; }
      var sig = ziel ? ziel.sig : null;
      if (sig) {
        if (ok) {
          delete state.fehler[kanal + sig];
          merken(kanal, sig, d);
        } else {
          state.fehler[kanal + sig] = fehlerDa(f) ? (fehlerCode(f) || "x") : (str(raw).trim() ? "x" : "leer");
        }
      }
      persist();
      zeichnen();
      bedarf();
      return !!ok;
    }
    /* NACHZUEGLER (04.10.). Nach Ablauf der Uhr kann die alte Antwort noch kommen -- waehrend schon
       die naechste Anfrage unterwegs ist, deren Platz sie sonst einnaehme: kurz die Zahlen eines
       anderen Zeitraums oder einer anderen Seite, ohne dass es jemand merkt. Je Kanal zaehlt
       nachzuegler, wie viele solche Antworten noch moeglich sind; NUR dann wird gegen die Anfrage
       geprueft, sonst nie -- eine statische Run-JS-Fassung mit den Beispieldaten muss immer
       ankommen. Geprueft wird, was die Antwort selbst mitbringt: der angefragte Starttag und
       Seite und Groesse. Fehlt eines davon, gilt sie als passend. */
    var nachzuegler = { overview: 0, products: 0, detail: 0, merchants: 0 };
    function passtZu(kanal, d, body) {
      if (!body) return true;
      var per = d.meta && typeof d.meta === "object" ? d.meta.period : null;
      if (per && per.requested_from && body.p_date_from && str(per.requested_from).slice(0, 10) !== str(body.p_date_from).slice(0, 10)) return false;
      var seite = kanal === "overview" ? d.brands_page : kanal === "detail" ? d.appearances : d;
      var lim = kanal === "overview" ? body.p_brand_limit : body.p_limit, off = kanal === "overview" ? body.p_brand_offset : body.p_offset;
      if (seite && typeof seite === "object") {
        if (num(seite.limit) != null && num(lim) != null && num(seite.limit) !== num(lim)) return false;
        if (num(seite.offset) != null && num(off) != null && num(seite.offset) !== num(off)) return false;
      }
      return true;
    }
    /* Was eine Antwort mindestens tragen muss, um als gelesen zu gelten. */
    function pruefen(kanal, d) {
      if (kanal === "detail") return !!(d.product && typeof d.product === "object");
      if (kanal === "products") return isArr(d.rows) || d.meta != null;
      if (kanal === "merchants") return isArr(d.merchants) || d.meta != null;
      return d.meta != null || d.kpis != null || isArr(d.brands);
    }
    /* Der Zwischenspeicher je Kanal, die juengsten CACHE_MAX Antworten -- ein Reiterwechsel zurueck
       zeigt sofort, ein Filterwechsel zurueck auch. */
    function merken(kanal, sig, d) {
      var c = state.cache[kanal], r = state.reihe[kanal];
      c[sig] = d;
      var i = r.indexOf(sig);
      if (i >= 0) r.splice(i, 1);
      r.push(sig);
      while (r.length > CACHE_MAX) { var alt = r.shift(); delete c[alt]; }
    }
    function nochmal(kanal) {
      bedarfListe().forEach(function (a) { if (a.kanal === kanal) delete state.fehler[a.kanal + a.sig]; });
      zeichnen(); bedarf();
    }

    /* ---- Was die offene Seite gerade hat ------------------------------------------------------ */
    function daten(a) { return a ? state.cache[a.kanal][a.sig] || null : null; }
    function fehlerVon(a) { return a ? state.fehler[a.kanal + a.sig] || null : null; }
    function dieOverview() { return daten(ovAnfrage(state.seite === "brands" ? state.brands : OV_VORGABE)); }
    /* Fuer Kopf und Kennzahlen der Brands-Seite reicht JEDE Overview-Antwort mit denselben
       Filtern -- die haengen nicht an der Markentabelle (Uebergabe 6). */
    function gleicherFilter(kanal, extra) {
      var gs = JSON.parse(sigVon(mit(grundBody(), extra || {}))), c = state.cache[kanal], r = state.reihe[kanal];
      for (var i = r.length - 1; i >= 0; i--) {
        var d = c[r[i]];
        if (!d) continue;
        try {
          var o = JSON.parse(r[i]), gleich = true;
          for (var k in gs) if (JSON.stringify(gs[k]) !== JSON.stringify(o[k])) { gleich = false; break; }
          if (gleich) return d;
        } catch (e) {}
      }
      return null;
    }
    function overviewGleicherFilter() { return gleicherFilter("overview"); }
    /* Kopf, Kennzahlen, Diagramm und Verteilungen eines Produkts haengen nicht an der Seite der
       Auftritte -- beim Blaettern dort bleiben sie stehen (jede Antwort traegt alles). */
    function dasDetail() { return state.seite === "detail" && state.produktId ? (daten(detailAnfrage()) || gleicherFilter("detail", { p_source_product_id: str(state.produktId) })) : null; }

    /* ---- Navigation ---------------------------------------------------------------------------- */
    function seiteOeffnen(s, neuerEintrag, extra) {
      if (!SEITE_OK[s]) s = "overview";
      state.seite = s;
      if (s !== "detail") state.produktId = null;
      if (extra) {
        if (extra.produktId != null) state.produktId = str(extra.produktId);
        if (extra.marke !== undefined) { state.products.marke = extra.marke; state.products.page = 1; }
        if (extra.haendler !== undefined) { state.products.haendler = extra.haendler; state.products.page = 1; }
        if (extra.seg) state.products.seg = extra.seg;
      }
      if (s === "detail") state.auftritte.page = 1;
      persist();
      adresseSetzen(neuerEintrag);
      if (nav && nav.selectPage) nav.selectPage(s === "detail" ? "products" : s, false);
      geruest = null;
      zeichnen();
      krumenNeu();
      try { var m = document.getElementById("main"); if (neuerEintrag && m) m.scrollTop = 0; } catch (e) {}
      bedarf();
    }
    /* Eine Produktzeile ist nur mit Id ein Link: ohne fuehrt der Klick nirgendwohin, also auch
       keine Hand und kein Tabulator-Halt. */
    function produktZeile(p) {
      var id = str(p && p.source_product_id).trim();
      return id ? 'class="up-row ush-zeile" data-produkt="' + esc(id) + '" role="link" tabindex="0"' : 'class="up-row ush-zeile is-statisch"';
    }
    function produktOeffnen(id) {
      id = str(id).trim();
      if (!id) return;
      seiteOeffnen("detail", true, { produktId: id });
    }
    function adresseAnwenden() {
      var a = adresseLesen();
      if (a.seite === state.seite && a.produktId === state.produktId) return;
      state.seite = a.seite; state.produktId = a.produktId;
      if (nav && nav.selectPage) nav.selectPage(a.seite === "detail" ? "products" : a.seite, false);
      geruest = null;
      zeichnen(); krumenNeu(); bedarf();
    }
    window.addEventListener("popstate", function () { if (root.isConnected) adresseAnwenden(); });

    /* ============================================================================================
       Zeichnen
       ============================================================================================ */
    var geruest = null, linie = null, pager = {}, sucheKit = {}, sortKit = {}, balken = {}, markenFilter = null, haendlerFilter = null;
    function zeichnen() {
      if (root.isConnected === false) return;
      var s = state.seite;
      /* Der ganze-Seite-Zustand: keine Shopping-Ergebnisse oder Shopping fuer diese Modelle gar
         nicht verfuegbar (Uebergabe 5). Er steht ueber allem anderen, auch ueber dem Detail. */
      var meta = metaJetzt();
      var leer = meta ? leerZustand(meta) : null;
      if (leer && s !== "detail") {
        if (geruest !== "leer") { aufraeumen(); elMain.innerHTML = ""; geruest = "leer"; }
        elMain.innerHTML = '<div class="ush-seite">' + leer + '</div>';
        return;
      }
      if (geruest !== s) baueGeruest(s);
      if (s === "overview") zeichneOverview();
      else if (s === "products") zeichneProducts();
      else if (s === "brands") zeichneBrands();
      else if (s === "merchants") zeichneMerchants();
      else if (s === "detail") zeichneDetail();
    }
    /* meta der offenen Seite: sie ist in jeder Antwort gleich (Uebergabe 5). */
    function metaJetzt() {
      var d = null;
      if (state.seite === "overview") d = dieOverview();
      else if (state.seite === "brands") d = overviewGleicherFilter();
      else if (state.seite === "products") d = daten(prodAnfrage());
      else if (state.seite === "merchants") d = daten(meAnfrage(ME_VORGABE)) || daten(meAnfrage(state.merchants));
      else if (state.seite === "detail") d = dasDetail();
      return d && d.meta && typeof d.meta === "object" ? d.meta : null;
    }
    function totals(meta) { return meta && meta.totals && typeof meta.totals === "object" ? meta.totals : {}; }
    function leerZustand(meta) {
      var tt = totals(meta);
      if (num(tt.runs_with_known_state) === 0) {
        return UC.leerHtml({ icon: "shoppingBag", titel: "Shopping results aren't available for these models",
          text: "AI shopping results are currently only observed in ChatGPT. Choose ChatGPT in the model filter.",
          knopf: filterAktiv() ? "Clear all filters" : "", knopfAttr: "data-ush-alleweg" });
      }
      if (num(tt.shopping_responses) === 0) {
        return UC.leerHtml({ icon: "shoppingBag", titel: "No AI Shopping products observed",
          text: "None of the AI responses in this range showed shopping products.",
          knopf: filterAktiv() ? "Clear all filters" : "", knopfAttr: "data-ush-alleweg" });
      }
      return null;
    }
    /* Die Hinweise ueber dem Inhalt: Zeichen + Text, leise (feedback keine Punkt-Pillen). */
    function eigeneOhneTreffer(meta) { return !!meta && meta.own_company_set === true && num(meta.own_observations) === 0; }
    function eigenName(meta) {
      var o = meta && meta.own_company && typeof meta.own_company === "object" ? meta.own_company : null;
      return o && str(o.name).trim() ? str(o.name).trim() : t("your brand");
    }
    function vergleich(meta) { return !!meta && meta.comparison_available === true; }
    function vergleichFuss(meta) {
      if (!vergleich(meta)) return esc(t("No comparison period available"));
      var pp = meta.previous_period;
      var z = pp ? zeitraum(pp.from, pp.to) : "";
      return z ? esc(ersetze(t("vs. {period}"), { period: z })) : "";
    }

    function aufraeumen() {
      if (linie && linie.destroy) { try { linie.destroy(); } catch (e) {} }
      linie = null; pager = {}; sucheKit = {}; sortKit = {}; balken = {}; markenFilter = null; haendlerFilter = null; spalten = {};
    }
    function sek(name) { return elMain.querySelector('[data-sek="' + name + '"]'); }
    /* Abschnittskopf aus core (.up-sec-head), wie im Event-Detail. */
    function sekKopf(titel, desc, rechts, erklaerung) {
      return '<div class="up-sec-head ush-sec-head"><div class="up-sec-titles">' +
          '<span class="up-heading up-sec-h">' + esc(t(titel)) + (erklaerung ? info(erklaerung) : '') + '</span>' +
          (desc ? '<span class="up-sec-sub">' + esc(desc) + '</span>' : '') +
        '</div>' + (rechts || '') + '</div>';
    }
    /* "Alle Marken" und Geschwister (05.10.: "ohne Container, einfach nur Text, Abstand, Chevron
       rechts"): ein Textverweis, kein .up-btn-sec. */
    function mehrKnopf(text, ziel) {
      return '<button type="button" class="ush-mehr" data-ush-ziel="' + esc(ziel) + '">' +
        '<span>' + esc(t(text)) + '</span>' + UC.icon("chevronRight", 2) + '</button>';
    }
    function segHtml(klasse, werte, aktiv) {
      return '<div class="up-seg ' + klasse + '" role="group">' + werte.map(function (w) {
        return '<button type="button" class="up-seg-btn' + (w[0] === aktiv ? " is-active" : "") + '" data-wert="' + esc(w[0]) + '">' +
          esc(t(w[1])) + (w[2] != null ? '<span class="ush-seg-zahl">' + esc(w[2]) + '</span>' : '') + '</button>';
      }).join("") + '</div>';
    }
    function segSetzen(el, aktiv) {
      if (!el) return;
      var b = el.querySelectorAll(".up-seg-btn");
      for (var i = 0; i < b.length; i++) b[i].classList.toggle("is-active", b[i].getAttribute("data-wert") === aktiv);
      if (UC.segJetzt) { try { UC.segJetzt(el); } catch (e) {} }
    }

    /* ---- Gerueste der Seiten: einmal je Seitenwechsel, die Abschnitte zeichnen sich darin neu.
       So bleiben Diagramm, Suche und Pager dieselben Knoten -- ein Neuaufbau je Antwort haette ihre
       Zuhoerer und den Stand der Suche verloren. */
    function chartHtml(segKlasse, segWerte, aktiv) {
      return '<div class="up-box ush-chartbox">' +
        '<p class="ush-chartnote" hidden>' + esc(t("Lower is better: position 1 sits at the top of the chart.")) + '</p>' +
        '<div class="ush-linewrap"><canvas></canvas></div><div class="up-legend ush-legende"></div></div>';
    }
    function tabSek(name, titel, suchePlatz) {
      /* Der Abschnitt ist eine eigene .up-root: die Suchuebernahme aus core (offene Suche nimmt auf
         schmaler Breite die ganze Kopfzeile, is-searchtakeover) haengt an ".up-root" -- ohne die
         Klasse stand bei 400px die offene Suche neben den Segmenten und ragte 44px hinaus. */
      return '<section class="up-root ush-sek ush-tab" data-sek="' + name + '">' +
        '<div class="up-head ush-head">' +
          '<span class="up-heading ush-heading"><span class="up-head-label">' + esc(t(titel)) + '</span>' +
            '<span class="up-head-sep"></span><span class="up-head-count"></span></span>' +
          '<div class="up-head-tools ush-tools">' + (suchePlatz || '') + spaltenKnopf() + '</div>' +
        '</div>' +
        '<div class="ush-scope" hidden></div>' +
        '<div class="up-root ush-tabwurzel"><div class="ush-tabelle"></div></div>' +
        '<div class="up-foot ush-foot">' +
          '<div class="up-pagesize"><span class="up-pagesize-lbl">' + esc(t("Rows per page")) + '</span>' +
            '<div class="up-pagesize-seg" role="group" aria-label="' + esc(t("Rows per page")) + '"></div></div>' +
          '<div class="up-pager"></div>' +
        '</div>' +
      '</section>';
    }
    /* Das Zahnrad der Tabellen (Table Settings): Spalten und Zeilenhoehe, Menue aus
       UC.makeColumns. Dasselbe Markup wie in teams.js. */
    function spaltenKnopf() {
      return '<div class="up-cols">' +
        '<button type="button" class="up-iconbtn up-cols-btn" data-tip="' + esc(t("Table Settings")) + '" aria-label="' + esc(t("Table settings")) + '">' +
          UC.icon("settings", 2) + '<span class="up-badge ush-cols-badge"></span></button>' +
        '<div class="up-menu up-cols-menu" role="menu" aria-hidden="true"></div></div>';
    }
    function sucheHtml(platzhalter, label) {
      return '<div class="up-search ush-suche">' +
        '<button type="button" class="up-iconbtn up-search-btn" aria-label="' + esc(t("Search")) + '" data-tip="' + esc(t("Search")) + '">' + UC.icon("search", 2) + '</button>' +
        '<div class="up-search-box">' +
          '<input class="up-search-input" type="text" placeholder="' + esc(t(platzhalter)) + '" autocomplete="off" spellcheck="false" aria-label="' + esc(t(label)) + '" maxlength="200"/>' +
          '<button type="button" class="up-search-clear" aria-label="' + esc(t("Clear search")) + '">' + UC.icon("x", 2.2) + '</button>' +
        '</div></div>';
    }
    function baueGeruest(s) {
      aufraeumen();
      var html = "";
      if (s === "overview") {
        html = '<div class="ush-seite" data-seite="overview">' +
          '<div class="ush-gruppe">' +
            '<div data-sek="summary"></div>' +
            '<div class="up-box up-kpiband is-4 ush-kpis" data-sek="kpis"></div>' +
            '<section class="ush-sek" data-sek="chart">' +
              sekKopf("Shopping Performance", t("How your brand and competitors appear in AI shopping results"),
                segHtml("ush-metrik", [["presence", "Brand Presence"], ["share_of_shelf", "Share of Shelf"], ["avg_position", "Avg. Position"], ["first_position_rate", "First Position Rate"]], state.ovMetrik)) +
              chartHtml() +
            '</section>' +
          '</div>' +
          '<section class="ush-sek" data-sek="landscape"></section>' +
          '<section class="ush-sek" data-sek="topprodukte"></section>' +
          '<div class="ush-zwei">' +
            '<section class="ush-sek" data-sek="bewegung"></section>' +
            '<section class="ush-sek" data-sek="verteilung"></section>' +
          '</div>' +
        '</div>';
      } else if (s === "brands") {
        html = '<div class="ush-seite" data-seite="brands">' +
          '<div class="ush-gruppe">' +
            '<div class="up-box up-kpiband is-4 ush-kpis" data-sek="kpis"></div>' +
            '<section class="ush-sek" data-sek="chart">' +
              sekKopf("Brand Performance", t("How the top brands develop in AI shopping results"),
                segHtml("ush-metrik", [["share_of_shelf", "Share of Shelf"], ["presence", "Presence"], ["avg_position", "Avg. Position"], ["first_position_rate", "First Position Rate"]], state.brMetrik)) +
              chartHtml() +
            '</section>' +
          '</div>' +
          tabSek("tabelle", "Brands", sucheHtml("Search brands…", "Search brands")) +
        '</div>';
      } else if (s === "products") {
        html = '<div class="ush-seite" data-seite="products">' +
          tabSek("tabelle", "Products", '<span class="ush-markenplatz"></span><span class="ush-haendlerplatz"></span><span class="ush-segplatz"></span>' + sucheHtml("Search products…", "Search products")) +
        '</div>';
      } else if (s === "merchants") {
        html = '<div class="ush-seite" data-seite="merchants">' +
          '<div class="ush-gruppe">' +
            '<div class="up-box up-kpiband ush-kpis" data-sek="kpis"></div>' +
            '<section class="ush-sek" data-sek="balken"></section>' +
          '</div>' +
          tabSek("tabelle", "Merchants", sucheHtml("Search merchants…", "Search merchants")) +
        '</div>';
      } else if (s === "detail") {
        html = '<div class="ush-seite" data-seite="detail">' +
          '<div data-sek="hero"></div>' +
          '<section class="ush-sek" data-sek="chart">' +
            sekKopf("Product Performance", t("How this product appears in AI shopping results over time"),
              segHtml("ush-metrik", [["visibility", "Visibility"], ["avg_position", "Avg. Position"], ["observations", "Observations"]], state.dMetrik)) +
            chartHtml() +
          '</section>' +
          '<section class="ush-sek" data-sek="wo"></section>' +
          '<section class="ush-sek" data-sek="dhaendler"></section>' +
          tabSek("tabelle", "Recent Appearances", "") +
        '</div>';
      }
      elMain.innerHTML = html;
      geruest = s;
      var lw = elMain.querySelector(".ush-linewrap");
      if (lw && UC.makeLine) {
        linie = UC.makeLine({
          wrap: lw, canvas: lw.querySelector("canvas"), legend: elMain.querySelector(".ush-legende"),
          isDark: isDark, gran: function () { return "day"; },
          unit: function () { return metrikEinheit(); },
          decimals: function () { return metrikJetzt() === "observations" ? 0 : 1; },
          reverse: function () { return metrikJetzt() === "avg_position"; },
          yOhneDeckel: function () { return metrikJetzt() === "observations" || metrikJetzt() === "avg_position"; },
          tipLabel: function () { return t(metrikLabel()) + ":"; },
          /* Die Legende folgt "Legende zeigen" (05.10.). Nur im Produkt-Detail IMMER, wie im
             Event-Detail: dort sagt erst sie, welche Linie das Produkt und welche die gestrichelte
             Vergleichslinie der Marke ist. */
          legendeImmer: s === "detail",
          markers: false
        });
      }
      var seg = elMain.querySelector(".ush-metrik");
      if (seg) seg.addEventListener("click", function (e) {
        var b = e.target.closest && e.target.closest("[data-wert]");
        if (!b) return;
        var w = b.getAttribute("data-wert");
        if (s === "overview") state.ovMetrik = w; else if (s === "brands") state.brMetrik = w; else state.dMetrik = w;
        persist(); segSetzen(seg, w); zeichneChart();
      });
      var tab = sek("tabelle");
      if (tab) tabelleVerdrahten(s, tab);
      var kb = sek("verteilung") || sek("balken");
      if (kb && UC.makeBarList) {
        /* Die Balkenliste aus core (Domain Detail, Model Breakdown) -- dieselbe CSS, dasselbe
           Markup. Ein Klick auf einen Haendler oeffnet die Produkte, die er fuehrt. */
        kb.addEventListener("click", function (e) {
          var r = e.target.closest && e.target.closest(".up-bar-row[data-bar-key]");
          if (!r) return;
          var key = r.getAttribute("data-bar-key");
          if (key && key.indexOf("__rest") !== 0) seiteOeffnen("products", true, { haendler: key, marke: null });
        });
      }
    }
    function metrikJetzt() { return state.seite === "overview" ? state.ovMetrik : state.seite === "brands" ? state.brMetrik : state.dMetrik; }
    function metrikEinheit() { var m = metrikJetzt(); return m === "avg_position" || m === "observations" ? "" : "%"; }
    function metrikLabel() {
      return { presence: state.seite === "brands" ? "Presence" : "Brand Presence", share_of_shelf: "Share of Shelf", avg_position: "Avg. Position",
               first_position_rate: "First Position Rate", visibility: "Visibility", observations: "Observations" }[metrikJetzt()] || "";
    }

    /* ---- Bauteile der Zeilen ------------------------------------------------------------------ */
    function markeLogo(m) {
      m = m || {};
      if (m.type === "other") return '<span class="up-logo-box ush-andere-logo"><span class="up-logo-ltr">–</span></span>';
      var n = str(m.name).trim();
      var ltr = '<span class="up-logo-ltr">' + esc(n.charAt(0).toUpperCase() || "?") + '</span>';
      var u = logoUrl(m.logo_url);
      return u ? '<span class="up-logo-box has-img"><img src="' + esc(u) + '" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentNode.classList.remove(\'has-img\');this.remove()"/>' + ltr + '</span>'
               : '<span class="up-logo-box">' + ltr + '</span>';
    }
    /* Suchtreffer markiert wie in jeder Tabelle der App (UC.highlight, .up-hl) -- 05.10. gemeldet:
       "bei den Suchfunktionen fehlen ueberall die Highlights". q leer: nur escapen. */
    function hl(text, q) { return q && UC.highlight ? UC.highlight(text, q) : esc(text); }
    function markeName(m, q) {
      m = m || {};
      if (m.type === "other" || !str(m.name).trim()) return '<span class="up-varname ush-andere">' + esc(t("Other (unassigned)")) + '</span>';
      return '<span class="up-varname">' + hl(str(m.name).trim(), q) + '</span>';
    }
    /* Die Marke als Chip (05.10.: "unsere gewohnten Chips fuer die Logos, der Name dahinter
       kleiner"): UC.markenChip, 18px-Logo und 13px-Name wie der Modell-Chip. "You" dahinter. */
    function markeChip(m, meta, q) {
      m = m || {};
      var andere = m.type === "other" || !str(m.name).trim();
      if (andere) return UC.markenChip({ name: t("Other (unassigned)") }, { ltr: "–", nameHtml: '<span class="ush-andere">' + esc(t("Other (unassigned)")) + '</span>' });
      return UC.markenChip(m, { nameHtml: hl(str(m.name).trim(), q), nach: duMarke(m, meta) });
    }
    function duMarke(m, meta) {
      return m && m.type === "own" && !eigeneOhneTreffer(meta) ? '<span class="up-marke up-you">' + esc(t("You")) + '</span>' : '';
    }
    function haendlerName(n) { return str(n).trim(); }
    function haendlerHtml(n, q) {
      var name = haendlerName(n);
      /* Nur das Zeichen, ohne Platte (06.10. angefordert: "einfach nur ein Icon"). Haendler haben
         kein Logo, die Platte versprach eines. Zeichen und Name in einer eigenen Gruppe mit 6px
         statt den 10px der Zelle -- sie gehoeren zusammen wie Logo und Name im Marken-Chip. */
      if (!name) return '<span class="ush-haendlerpaar"><span class="ush-haendler-ic is-leise">' + UC.icon("store", 2) + '</span><span class="up-varname ush-andere">' + esc(t("Unknown")) + '</span></span>';
      return '<span class="ush-haendlerpaar"><span class="ush-haendler-ic">' + UC.icon("store", 2) + '</span><span class="up-varname" title="' + esc(name) + '">' + hl(name, q) + '</span></span>';
    }
    function bildHtml(url, klasse) {
      var u = sichereUrl(url);
      return '<span class="ush-bild' + (klasse ? " " + klasse : "") + (u ? " has-img" : "") + '">' +
        '<span class="ush-bild-ph">' + UC.icon("image", 1.8) + '</span>' +
        (u ? '<img src="' + esc(u) + '" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentNode.classList.remove(\'has-img\');this.remove()"/>' : '') + '</span>';
    }
    var HASH = UC.HASH_ICON ? UC.HASH_ICON.replace("<svg ", '<svg class="up-hash" ') : "";
    function posHtml(v) {
      v = posWert(v);
      if (v == null) return '<span class="up-num is-empty">–</span>';
      return '<span class="up-rank-group">' + HASH + '<span class="up-num">' + esc(stelle(v)) + '</span></span>';
    }
    function pctHtml(v) { v = anteilWert(v); return v == null ? '<span class="up-num is-empty">–</span>' : '<span class="up-num">' + esc(pct(v)) + '</span>'; }
    function ganzHtml(v) { v = anzahlWert(v); return v == null ? '<span class="up-num is-empty">–</span>' : '<span class="up-num">' + esc(ganz(v)) + '</span>'; }
    function ringHtml(v) {
      v = anteilWert(v);
      if (v == null) return '<span class="up-num is-empty">–</span>';
      return '<span class="up-num">' + esc(pct(v)) + '</span>' + (UC.variationRing ? UC.variationRing(v) : '');
    }
    /* Trend wie ueberall: "%" beim Prozentwert, umgekehrt bei der Position (kleiner ist besser),
       ganze Zahl bei Anzahlen. Ohne Vergleich steht nichts (Uebergabe 4). */
    function trend(art, d, meta) {
      d = deltaWert(art, d);
      if (!vergleich(meta) || d == null || !UC.trendChip) return "";
      if (art === "pos") return UC.trendChip(d, { decimals: true, inverted: true, suffix: "" });
      if (art === "anzahl") return UC.trendChip(d, { decimals: false, suffix: "" });
      return UC.trendChip(d, { decimals: true, suffix: "%" });
    }
    function sterne(v) {
      v = noteWert(v);
      if (v == null) return '<span class="up-num is-empty">–</span>';
      return '<span class="ush-rating"><span class="up-num">' + esc(stelle(v)) + '</span>' + UC.icon("star", 2) + '</span>';
    }
    function th(text, o) {
      o = o || {};
      return '<div class="up-th' + (o.sort ? " is-sortable" : "") + (o.k ? " " + o.k : "") + '"' + (o.sort ? ' data-sort="' + esc(o.sort) + '"' : '') + '>' +
        '<span class="up-th-txt">' + esc(t(text)) + '</span>' + (o.info ? info(o.info) : '') +
        (o.sort ? '<span class="up-thsort" data-for="' + esc(o.sort) + '">' +
          '<svg class="up-thsort-up" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 15C18 15 13.5811 9.00001 12 9C10.4188 8.99999 6 15 6 15"/></svg>' +
          '<svg class="up-thsort-down" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9"/></svg></span>' : '') +
        '</div>';
    }
    /* Das Raster setzt UC.makeColumns als --up-cols an der Wurzel der Tabelle (spaltenFuer), die
       Mindestbreite als --up-cols-min: darunter scrollt der Kasten waagerecht (.up-colscroll aus core). */
    function tabelleHtml(kopf, zeilen, klasse) {
      return '<div class="up-box ush-box' + (klasse ? " " + klasse : "") + '">' +
        '<div class="up-colscroll"><div class="up-colscroll-innen">' +
          '<div class="up-thead">' + kopf + '</div>' +
          '<div class="up-tbody">' + zeilen + '</div>' +
        '</div></div></div>';
    }

    /* ---- DIE SPALTEN JEDER TABELLE (05.10.: "in allen Tabellen die erste Spalte resizen",
       "Table Settings ueberall in die Toolbars") --------------------------------------------------
       Jede Tabelle laeuft ueber UC.makeColumns wie die anderen der App: Ziehgriff an der ersten
       Spalte, in den Tabellen mit Werkzeugleiste dazu das Zahnrad mit Spalten und Zeilenhoehe.
       ANDERS als dort faellt keine Spalte der Breite wegen weg (cfg.scrollen, 05.10.: "vorher
       konnte man immer die gesamte Tabelle sehen, ggf. mit horizontalem Scroll -- ich will
       beides"): ist es zu eng, scrollt der Kasten, und die erste Spalte bleibt dabei stehen.
       min ist die Untergrenze der Spur UND die Zahl, mit der das Kit den Abwurf rechnet -- beide
       muessen gleich sein (teams.js). Die Werte sind die gemessenen Minima der festen Raster von
       vorher (04.10.: Kopf mit Erklaer- und Sortierzeichen ohne Ellipse).
       prio: die KLEINSTE faellt zuerst. sk: der Balken der Skelettzeile. */
    function sp(key, label, min, fr, prio, sk, o) {
      o = o || {};
      return { key: key, label: label, w: "minmax(" + min + "px," + fr + "fr)", min: min, prio: prio, sk: sk, sort: o.sort, info: o.info };
    }
    var TABELLEN = {
      landscape: { erste: { label: "Brand", min: 220, sk: { w: 110, logo: true } }, spalten: [
        sp("share", "Share of Shelf", 154, 1.2, 90, 60, { info: "share" }),
        sp("presence", "Presence", 120, 1, 80, 44, { info: "presence" }),
        sp("products", "Products", 104, 0.8, 50, 30),
        sp("pos", "Avg. Position", 124, 1, 70, 36, { info: "pos" }),
        sp("first", "First Position Rate", 156, 1.1, 40, 44, { info: "firstBrand" }),
        sp("change", "Change", 110, 0.9, 60, 40)] },
      topprodukte: { erste: { label: "Product", min: 260, sk: { w: 160, logo: true } }, spalten: [
        sp("vis", "Visibility", 130, 1.1, 90, 60, { info: "vis" }),
        sp("pos", "Avg. Position", 126, 0.9, 80, 36, { info: "pos" }),
        sp("obs", "Observations", 128, 0.9, 70, 30, { info: "obs" }),
        sp("first", "First Position Rate", 156, 1.1, 50, 44, { info: "firstProd" }),
        sp("rating", "Rating", 92, 0.7, 40, 30),
        /* 148: eine Preisspanne ("€19.62–€21.62") braucht 105px Text plus 28 Polster; mit 128/130
           lief sie 4,5px in das rechte Polster (06.10. gemessen). Was laenger ist, kuerzt core. */
        sp("price", "Price", 148, 1, 60, 50, { info: "price" })] },
      products: { erste: { label: "Product", min: 280, sort: "title", sk: { w: 170, logo: true } }, spalten: [
        sp("brand", "Brand", 160, 1.2, 85, { w: 70, logo: true }),
        sp("vis", "Visibility", 124, 1, 90, 60, { sort: "visibility", info: "vis" }),
        sp("obs", "Observations", 148, 1, 70, 30, { sort: "observations", info: "obs" }),
        sp("pos", "Avg. Position", 144, 1, 80, 36, { sort: "avg_position", info: "pos" }),
        sp("first", "First Position Rate", 176, 1.1, 50, 44, { sort: "first_position_rate", info: "firstProd" }),
        sp("price", "Price", 148, 1.1, 60, 60, { sort: "price", info: "price" }),
        sp("rating", "Rating", 92, 0.7, 30, 30, { sort: "rating" }),
        sp("merchants", "Merchants", 128, 1.1, 40, 70),
        sp("seen", "Last Seen", 120, 0.9, 20, 60, { sort: "last_seen" })] },
      brands: { erste: { label: "Brand", min: 220, sort: "name", sk: { w: 110, logo: true } }, spalten: [
        sp("share", "Share of Shelf", 154, 1.2, 90, 60, { sort: "share_of_shelf", info: "share" }),
        sp("presence", "Presence", 126, 0.9, 80, 44, { sort: "presence", info: "presence" }),
        sp("products", "Products", 104, 0.8, 60, 30, { sort: "products" }),
        sp("obs", "Observations", 148, 0.9, 50, 36, { sort: "observations", info: "obs" }),
        sp("pos", "Avg. Position", 144, 1, 70, 36, { sort: "avg_position", info: "pos" }),
        sp("first", "First Position Rate", 176, 1.1, 40, 44, { sort: "first_position_rate", info: "firstBrand" }),
        sp("change", "Change", 110, 0.9, 65, 40, { sort: "share_of_shelf_delta" }),
        sp("top", "Top Product", 240, 1.8, 30, { w: 140, logo: true })] },
      merchants: { erste: { label: "Merchant", min: 240, sort: "name", sk: { w: 120, logo: true } }, spalten: [
        sp("share", "Share", 150, 1.2, 90, 60, { sort: "observations", info: "merchant" }),
        sp("products", "Products", 104, 0.8, 80, 30, { sort: "products" }),
        sp("obs", "Observations", 148, 1.1, 70, 50, { sort: "observations", info: "obs" }),
        sp("pos", "Avg. Product Position", 192, 1.1, 60, 36, { sort: "avg_position", info: "pos" }),
        sp("firstseen", "First Seen", 120, 1, 30, 60, { sort: "first_seen" }),
        sp("seen", "Last Seen", 120, 1, 40, 60, { sort: "last_seen" })] },
      dhaendler: { erste: { label: "Merchant", min: 220, sk: { w: 120, logo: true } }, spalten: [
        sp("share", "Share", 124, 1, 90, 40, { info: "merchant" }),
        sp("obs", "Observations", 128, 1, 80, 30, { info: "obs" }),
        sp("price", "Price", 160, 1.2, 70, 60, { info: "price" })] },
      /* Recent Appearances: die erste Spalte ist ein Datum (120 Untergrenze). Dahinter die
         Knopfspalte "View Response", gemessen (UC.makeAktionsSpur) statt geschaetzt. */
      detail: { erste: { label: "Date", min: 120, sk: 60 }, aktion: true, spalten: [
        sp("model", "Model", 150, 1.2, 90, { w: 70, logo: true }),
        sp("market", "Market", 90, 0.7, 50, 30),
        sp("topic", "Topic", 160, 1.4, 40, 80),
        sp("position", "Position", 100, 0.8, 70, 30, { info: "pos" }),
        sp("price", "Price", 110, 0.9, 60, 40, { info: "price" }),
        sp("merchant", "Merchant", 180, 1.4, 80, { w: 90, logo: true })] }
    };
    function kopfAus(name) {
      var d = TABELLEN[name];
      return th(d.erste.label, { sort: d.erste.sort }) + d.spalten.map(function (c) {
        return th(c.label, { k: "up-th-" + c.key, sort: c.sort, info: c.info });
      }).join("") + (d.aktion ? '<div class="up-th ush-th-aktion"></div>' : '');
    }
    /* Die Skelettzellen tragen dieselben Spaltenklassen -- sonst blendet das Kit sie nicht aus,
       und eine Zeile mit mehr Zellen als Spuren bricht in eine zweite Rasterzeile um. */
    function skelettAus(name, n) {
      var d = TABELLEN[name];
      return skelettZeilen(n, [d.erste.sk].concat(d.spalten.map(function (c) {
        var o = c.sk && typeof c.sk === "object" ? mit({}, c.sk) : { w: c.sk };
        o.cls = "up-td-" + c.key;
        return o;
      }), d.aktion ? [{ w: 90, cls: "ush-td-aktion" }] : []));
    }
    function td(key, html) { return '<div class="up-td up-td-' + key + '">' + html + '</div>'; }

    /* Ein Kit je Tabelle, gebunden an die Wurzel, in der Kopf, Kasten und -- bei den Tabellen mit
       Werkzeugleiste -- das Zahnrad stehen. Neu nur mit einer neuen Wurzel (ein Seitenwechsel baut
       das Geruest neu). Die Zeilenhoehe je Tabelle im Browser wie in urls-table. */
    var spalten = {};
    function dichteSchluessel(name) { return "ush_dense__" + instanceId + "__" + name; }
    function spaltenFuer(name, wurzel) {
      var e = spalten[name];
      if (e && e.wurzel === wurzel) return e;
      if (!UC.makeColumns || !wurzel) return null;
      var d = TABELLEN[name], st = { cols: {}, widths: {}, dense: false }, aktPx = 0;
      var mitMenue = !!wurzel.querySelector(".up-cols-menu");
      var kit = UC.makeColumns({
        root: wurzel, state: st, columns: d.spalten, storePrefix: "ush", instanceId: instanceId + "__" + name,
        firstKey: "erste", firstMin: d.erste.min, firstFloor: d.floor, noActions: !d.aktion, scrollen: true,
        actionsMin: function () { return aktPx || 150; },
        dense: mitMenue, badgeSel: ".ush-cols-badge", cellPrefixes: ["up"]
      });
      st.cols = kit.readCols(); st.widths = kit.readWidths();
      if (mitMenue) {
        try { st.dense = window.localStorage.getItem(dichteSchluessel(name)) === "1"; } catch (x) {}
        wurzel.classList.toggle("is-dense", st.dense);
      }
      e = spalten[name] = { wurzel: wurzel, kit: kit, st: st, spur: null };
      if (d.aktion && UC.makeAktionsSpur) {
        e.spur = UC.makeAktionsSpur({ root: wurzel, zellen: ".up-row:not(.up-tsk) .ush-td-aktion", anwenden: function (px) { aktPx = px; kit.applyCols(); } });
      }
      wurzel.__ushSpalten = e;
      return e;
    }
    function dichteSetzen(name, an) {
      var e = spalten[name];
      if (!e) return;
      e.st.dense = !!an;
      try { window.localStorage.setItem(dichteSchluessel(name), an ? "1" : "0"); } catch (x) {}
      e.wurzel.classList.toggle("is-dense", !!an);
      if (e.spur) { try { e.spur.messen(); } catch (x2) {} }
    }
    /* Nach jedem Zeichnen: frische Zeilen tragen noch keine Spaltenauswahl. */
    function spaltenAnwenden(name) {
      var e = spalten[name];
      if (!e) return;
      try { e.kit.applyCols(); e.kit.syncColsBadge(); } catch (x) {}
      if (e.spur) { try { e.spur.messen(); } catch (x2) {} }
    }
    /* Die Tabellen der Uebersicht und des Details ohne Werkzeugleiste: Kopf einmal, darunter eine
       eigene Wurzel fuer das Kit. Dicht (55) wie bisher -- sie sind Vorschauen, und ohne Zahnrad
       gibt es keinen Schalter, der sie aufziehen koennte. */
    function vorschauPlatz(el, name, kopf) {
      if (!el.querySelector(".ush-vorschau")) el.innerHTML = kopf + '<div class="up-root ush-vorschau is-dense"><div class="ush-tabelle"></div></div>';
      var w = el.querySelector(".ush-vorschau");
      spaltenFuer(name, w);
      return w.querySelector(".ush-tabelle");
    }
    function skelettZeilen(n, spalten) {
      return UC.skeletonRows ? UC.skeletonRows({ count: n, rowClass: "up-row", cellClass: "up-td", cols: spalten }) : "";
    }
    function fehlerKasten(a, was) {
      var code = fehlerVon(a);
      var titel = was === "detail" ? "This product could not be loaded" : "Shopping data could not be loaded";
      var text = code === "leer" || code === "x" ? "The data could not be read. Please reload the page." : fehlerText(code);
      return UC.leerHtml({ icon: "info", titel: titel, text: text, knopf: "Try again", knopfAttr: 'data-ush-nochmal="' + esc(a.kanal) + '"' });
    }
    function kpiHtml(o) {
      o.klasse = (o.klasse ? o.klasse + " " : "") + "ush-kpi";
      return UC.kpiKarte ? UC.kpiKarte(o) : "";
    }
    /* Die Kacheln zaehlen hoch: UC.zaehlHtml zeichnet die Zahl, UC.hochzaehlen zaehlt nach dem
       Zeichnen (seit 05.10. in core, Events zaehlt genauso). EINMAL JE WERT (05.10. gemeldet: "die
       triggern doppelt"): core merkt sich je Ort und Kachel den zuletzt gezaehlten Wert -- der Ort
       ist hier Instanz und Seite. Ein zweites Zeichnen mit denselben Werten (Kalender und Filter
       gleichen ab, ein Reiter kommt zurueck, Bubbles Neuaufbau) zaehlt nicht noch einmal. */
    function hochzaehlen(el) {
      if (UC.hochzaehlen) UC.hochzaehlen(el, "shopping|" + instanceId + "|" + state.seite);
    }
    /* Die Plausibilitaetsgrenzen bleiben hier (anteilWert, posWert, anzahlWert): was ausserhalb
       liegt, ist ein Strich und zaehlt nicht. */
    function zaehlWert(art, v) {
      v = art === "pct" ? anteilWert(v) : art === "pos" ? posWert(v) : anzahlWert(v);
      if (v == null) return '<span class="up-num is-empty">–</span>';
      var inner = UC.zaehlHtml ? UC.zaehlHtml(v, art === "pct" ? "pct1" : art === "pos" ? "num1" : "int")
        : '<span class="up-num">' + esc(art === "pct" ? pct(v) : art === "pos" ? stelle(v) : ganz(v)) + '</span>';
      return art === "pos" ? '<span class="up-rank-group">' + HASH + inner + '</span>' : inner;
    }
    /* Das Kennzahlen-Label mit seiner Erklaerung: kpiKarte schreibt das Label als Text, die
       Erklaerung kommt danach ins Label. */
    function erklaerAnLabels(el, keys) {
      if (!el) return;
      var l = el.querySelectorAll(".up-kpi-label");
      for (var i = 0; i < l.length && i < keys.length; i++) if (keys[i]) l[i].insertAdjacentHTML("beforeend", info(keys[i]));
    }

    /* ============================================================================================
       Overview
       ============================================================================================ */
    function zeichneOverview() {
      var a = ovAnfrage(OV_VORGABE), d = daten(a), meta = d && d.meta;
      var fe = !d && fehlerVon(a);
      if (fe) {
        /* Ein Fehler steht EINMAL, an der Stelle der Kennzahlen; der Rest der Seite traegt dann
           nichts, was wie Daten aussieht. */
        sek("summary").innerHTML = "";
        sek("kpis").innerHTML = '<div class="ush-kpifehler">' + fehlerKasten(a) + '</div>';
        ["landscape", "topprodukte", "bewegung", "verteilung"].forEach(function (n) { sek(n).innerHTML = ""; });
        if (linie) linie.empty(t("Shopping data could not be loaded"));
        return;
      }
      zeichneSummary(d);
      zeichneKpis(d);
      zeichneChart();
      zeichneLandscape(d);
      zeichneTopProdukte(d);
      zeichneBewegung(d);
      zeichneVerteilung(d);
    }
    function zeichneSummary(d) {
      var el = sek("summary");
      if (!el) return;
      if (!d) { el.innerHTML = '<div class="ush-summary is-sk"><span class="up-tsk-bar" style="width:60%"></span><span class="up-tsk-bar" style="width:40%"></span></div>'; return; }
      var txt = summaryText(d);
      var per = d.meta && d.meta.period ? zeitraum(d.meta.period.from, d.meta.period.to) : "";
      el.innerHTML = txt ? '<div class="ush-summary">' +
        '<span class="ush-summary-ic">' + UC.icon("aiSearchLines", 2) + '</span>' +
        '<div class="ush-summary-txt"><div class="ush-summary-kopf"><span>' + esc(t("Summary")) + '</span>' +
          (per ? '<span>' + esc(per) + '</span>' : '') + '</div>' +
          '<p>' + esc(txt) + '</p></div></div>' : "";
    }
    /* Der Satz der Zusammenfassung, aus kpis, meta, brands und movement (Uebergabe 4: "Textvorlage,
       es gibt dafuer kein Feld"). Drei Faelle wie im Entwurf: normal, ohne Vergleich, ohne Treffer
       der eigenen Marke -- dort nur die Wettbewerber, ohne Satz ueber die eigene Marke (05.10.: das
       sagt der Platzhalter der Kennzahlen schon). Nur Werte, die geliefert wurden. */
    function summaryText(d) {
      var meta = d.meta || {}, k = d.kpis || {}, saetze = [];
      var own = meta.own_company && typeof meta.own_company === "object" ? meta.own_company : null;
      var ownName = own && str(own.name).trim();
      var brands = isArr(d.brands) ? d.brands.filter(function (b) { return b && b.type !== "other" && str(b.name).trim(); }) : [];
      var fremde = brands.filter(function (b) { return b.type !== "own"; });
      fremde.sort(function (x, y) { return (num(kz(y.share_of_shelf).v) || 0) - (num(kz(x.share_of_shelf).v) || 0); });
      var sos = kz(k.share_of_shelf), rate = kz(k.shopping_rate), pres = kz(k.brand_presence);
      var eigenOk = meta.own_company_set === true && !eigeneOhneTreffer(meta) && ownName && sos.v != null;
      if (eigenOk) {
        if (vergleich(meta) && sos.p != null && sos.d != null && Math.abs(sos.d) >= 0.05) {
          saetze.push(ersetze(t(sos.d > 0 ? "{brand} holds {sos} Share of Shelf, up from {prev}." : "{brand} holds {sos} Share of Shelf, down from {prev}."),
            { brand: ownName, sos: pct(sos.v), prev: pct(sos.p) }));
        } else saetze.push(ersetze(t("{brand} holds {sos} Share of Shelf."), { brand: ownName, sos: pct(sos.v) }));
        var erster = fremde[0];
        if (erster && num(kz(erster.share_of_shelf).v) != null) {
          if (num(kz(erster.share_of_shelf).v) > sos.v) saetze.push(ersetze(t("{brand} leads with {sos}."), { brand: str(erster.name).trim(), sos: pct(kz(erster.share_of_shelf).v) }));
          else saetze.push(ersetze(t("{brand} leads the shelf."), { brand: ownName }));
        }
        if (pres.v != null) saetze.push(ersetze(t("Your products appeared in {presence} of these results."), { presence: pct(pres.v) }));
      } else {
        var a = fremde[0], b = fremde[1];
        if (a && num(kz(a.share_of_shelf).v) != null) {
          saetze.push(b && num(kz(b.share_of_shelf).v) != null
            ? ersetze(t("{brand} leads with {sos}, followed by {brand2} at {sos2}."), { brand: str(a.name).trim(), sos: pct(kz(a.share_of_shelf).v), brand2: str(b.name).trim(), sos2: pct(kz(b.share_of_shelf).v) })
            : ersetze(t("{brand} leads with {sos}."), { brand: str(a.name).trim(), sos: pct(kz(a.share_of_shelf).v) }));
        }
      }
      if (vergleich(meta) && d.movement) {
        var r = isArr(d.movement.rising) ? d.movement.rising[0] : null, f = isArr(d.movement.declining) ? d.movement.declining[0] : null;
        var rd = r ? kz(r.visibility).d : null, fd = f ? kz(f.visibility).d : null;
        if (r && rd != null && rd > 0 && str(r.title).trim()) saetze.push(ersetze(t("{product} gained the most Visibility ({delta})."), { product: str(r.title).trim(), delta: "+" + pct(rd) }));
        if (f && fd != null && fd < 0 && str(f.title).trim()) saetze.push(ersetze(t("{product} lost the most Visibility ({delta})."), { product: str(f.title).trim(), delta: "−" + pct(Math.abs(fd)) }));
      }
      if (rate.v != null) saetze.push(ersetze(t("{rate} of AI responses showed shopping products."), { rate: pct(rate.v) }));
      return saetze.join(" ");
    }
    function zeichneKpis(d) {
      var el = sek("kpis");
      if (!el) return;
      if (!d) { el.innerHTML = [0, 1, 2, 3].map(function () { return UC.kpiKarteSkelett ? UC.kpiKarteSkelett("ush-kpi") : ""; }).join(""); return; }
      var meta = d.meta || {}, k = d.kpis || {}, ohneEigene = meta.own_company_set !== true || eigeneOhneTreffer(meta);
      var fuss = vergleichFuss(meta);
      var reihen = [
        ["Shopping Rate", "shoppingRate", kz(k.shopping_rate), false],
        ["Brand Presence", "presence", kz(k.brand_presence), true],
        ["Share of Shelf", "share", kz(k.share_of_shelf), true],
        ["First Position Rate", "firstBrand", kz(k.first_position_rate), true]
      ];
      el.innerHTML = reihen.map(function (r) {
        var leer = r[3] && ohneEigene;
        return kpiHtml({ label: r[0], wertHtml: leer ? '<span class="up-num is-empty">–</span>' : zaehlWert("pct", r[2].v),
          trendHtml: leer ? "" : trend("pct", r[2].d, meta),
          fussHtml: leer ? esc(t(meta.own_company_set === true ? "No products matched your brand" : "Set up your own brand to see your brand metrics.")) : fuss });
      }).join("");
      erklaerAnLabels(el, reihen.map(function (r) { return r[1]; }));
      hochzaehlen(el);
    }

    /* ---- Diagramme ----------------------------------------------------------------------------- */
    function zeichneChart() {
      if (!linie) return;
      var note = elMain.querySelector(".ush-chartnote");
      if (note) note.hidden = metrikJetzt() !== "avg_position";
      var s = state.seite;
      if (s === "detail") { zeichneDetailChart(); return; }
      var d = s === "brands" ? overviewGleicherFilter() : dieOverview();
      if (!d) {
        var a = s === "brands" ? ovAnfrage(state.brands) : ovAnfrage(OV_VORGABE);
        if (fehlerVon(a)) linie.empty(t("Shopping data could not be loaded")); else linie.skeleton();
        return;
      }
      var ch = d.chart && typeof d.chart === "object" ? d.chart : {};
      var tage = isArr(ch.days) ? ch.days.map(function (x) { return str(x).slice(0, 10); }).filter(function (x) { return /^\d{4}-\d{2}-\d{2}$/.test(x); }) : [];
      var reihen = isArr(ch.series) ? ch.series.filter(function (x) { return x && typeof x === "object"; }) : [];
      /* Overview: die Top 5 (in_top5, die eigene immer dabei); Brands: alle (hoechstens 6). Die
         eigene ohne Treffer faellt heraus (Entwurf: "own brand hidden from charts"). */
      if (s === "overview") reihen = reihen.filter(function (x) { return x.in_top5 === true; });
      if (eigeneOhneTreffer(d.meta)) reihen = reihen.filter(function (x) { return x.is_own !== true; });
      var feld = metrikJetzt(), istPos = feld === "avg_position";
      if (!tage.length || !reihen.length) { linie.empty(); return; }
      /* WIE JEDES LINIENCHART DER APP (05.10. gemeldet: Farben und Legende folgten den
         Einstellungen nicht, und ein Tag ohne Wert brach die Linie ab):
         - die Datensaetze baut UC.buildLineDatasets wie in Visibility- und Brands-Chart, mit der
           Farbskala aus den Einstellungen; "Brand Colors" nimmt die Farbe der Marke aus der Antwort.
           Die Reihenfolge der Antwort bleibt (visibility_window_pct absteigend), damit eine Marke
           beim Wechsel der Kennzahl ihre Farbe behaelt;
         - die Legende folgt "Legende zeigen" (legendeImmer nur im Detail, siehe makeLine oben);
         - ein Tag ohne Wert steht auf 0 wie dort. Ausnahme die Position: 0 waere ein Platz vor dem
           ersten -- dort fehlt der Punkt, und die Linie laeuft ueber den Tag hinweg. */
      var punkte = [], firmen = [];
      reihen.forEach(function (r, i) {
        var id = str(r.company_id).trim() || ("r" + i), proTag = {};
        (isArr(r.points) ? r.points : []).forEach(function (p) { if (p && p.day) proTag[str(p.day).slice(0, 10)] = metrikWert(feld, p[feld]); });
        tage.forEach(function (tg) {
          var v = proTag[tg];
          if (v == null) { if (istPos) return; v = 0; }
          punkte.push({ company_id: id, day: tg, visibility_pct: v });
        });
        firmen.push({ company_id: id, name: str(r.name).trim() || t("Other"), favicon_url: logoUrl(r.logo_url),
                      color: /^#[0-9a-f]{3,8}$/i.test(str(r.color).trim()) ? str(r.color).trim() : null,
                      visibility_window_pct: reihen.length - i });
      });
      var bau = UC.buildLineDatasets(punkte, firmen, UC.getColorScalePref ? UC.getColorScalePref() : null);
      /* buildLineDatasets kennt nur die Tage, an denen es Punkte gab -- die Achse sind aber alle
         Tage des Zeitraums. Also auf chart.days zurueckgelegt. */
      var stelleVon = {};
      bau.labels.forEach(function (l, i) { stelleVon[l] = i; });
      bau.datasets.forEach(function (ds) {
        var alt = ds.data;
        ds.data = tage.map(function (tg) { return stelleVon[tg] != null ? alt[stelleVon[tg]] : null; });
      });
      linie.render({ labels: tage, datasets: bau.datasets });
    }
    function token(name, sonst) {
      var v = "";
      try { v = getComputedStyle(root).getPropertyValue(name).trim(); } catch (e) {}
      return v || sonst;
    }

    /* ---- Brand Landscape: die Top 6 nach Share of Shelf ---------------------------------------- */
    function zeichneLandscape(d) {
      var el = sek("landscape");
      if (!el) return;
      var platz = vorschauPlatz(el, "landscape", sekKopf("Brand Landscape", t("Top brands by Share of Shelf"), mehrKnopf("View all brands", "brands")));
      if (!d) { platz.innerHTML = tabelleHtml(kopfAus("landscape"), skelettAus("landscape", 5)); spaltenAnwenden("landscape"); return; }
      var meta = d.meta;
      var l = (isArr(d.brands) ? d.brands : []).filter(function (b) { return b && typeof b === "object" && !(b.type === "own" && eigeneOhneTreffer(meta)); }).slice(0, 6);
      if (!l.length) { platz.innerHTML = '<div class="up-box">' + UC.leerHtml({ mini: true, titel: "No brands yet" }) + '</div>'; return; }
      platz.innerHTML = tabelleHtml(kopfAus("landscape"), l.map(function (b) { return markeZeileOv(b, meta); }).join(""), "ush-klickbar");
      spaltenAnwenden("landscape");
    }
    function markeZeileOv(b, meta) {
      var sos = kz(b.share_of_shelf), andere = b.type === "other" || !b.company_id;
      return '<div class="up-row ush-zeile' + (andere ? " is-andere" : "") + '"' + (andere ? '' : ' data-marke="' + esc(b.company_id) + '" data-marke-name="' + esc(str(b.name).trim()) + '" role="link" tabindex="0"') + '>' +
        '<div class="up-td">' + markeLogo(b) + markeName(b) + duMarke(b, meta) + '</div>' +
        '<div class="up-td up-td-share up-var-sov">' + ringHtml(sos.v) + '</div>' +
        td("presence", pctHtml(kz(b.presence).v)) +
        td("products", ganzHtml(b.products)) +
        td("pos", posHtml(kz(b.avg_position).v)) +
        td("first", pctHtml(kz(b.first_position_rate).v)) +
        td("change", trend("pct", sos.d, meta) || '<span class="up-num is-empty">–</span>') +
      '</div>';
    }

    /* ---- Top Products ---------------------------------------------------------------------------- */
    function zeichneTopProdukte(d) {
      var el = sek("topprodukte");
      if (!el) return;
      var platz = vorschauPlatz(el, "topprodukte", sekKopf("Top Products", t("Most visible products across all brands"), mehrKnopf("View all products", "products")));
      if (!d) { platz.innerHTML = tabelleHtml(kopfAus("topprodukte"), skelettAus("topprodukte", 5)); spaltenAnwenden("topprodukte"); return; }
      var l = (isArr(d.top_products) ? d.top_products : []).filter(function (p) { return p && typeof p === "object" && str(p.source_product_id).trim(); }).slice(0, 10);
      if (!l.length) { platz.innerHTML = '<div class="up-box">' + UC.leerHtml({ mini: true, titel: "No products yet" }) + '</div>'; return; }
      platz.innerHTML = tabelleHtml(kopfAus("topprodukte"), l.map(function (p) {
        return '<div ' + produktZeile(p) + '>' +
          '<div class="up-td">' + produktZelle(p, d.meta) + '</div>' +
          '<div class="up-td up-td-vis up-var-sov">' + ringHtml(kz(p.visibility).v) + '</div>' +
          td("pos", posHtml(kz(p.avg_position).v)) +
          td("obs", ganzHtml(kz(p.observations).v)) +
          td("first", pctHtml(kz(p.first_position_rate).v)) +
          td("rating", sterne(p.rating)) +
          td("price", preisZelle(p.price_ranges)) +
        '</div>';
      }).join(""), "ush-klickbar");
      spaltenAnwenden("topprodukte");
    }
    function produktZelle(p, meta, mitListing, q) {
      var b = p.brand && typeof p.brand === "object" ? p.brand : { type: "other" };
      var titel = str(p.title).trim() || str(p.listing_title).trim() || "–";
      var unter = mitListing && str(p.listing_title).trim() && str(p.listing_title).trim() !== titel
        ? '<span class="ush-unter" title="' + esc(str(p.listing_title).trim()) + '">' + hl(str(p.listing_title).trim(), q) + '</span>'
        : '<span class="ush-unter">' + (b.type === "other" || !str(b.name).trim() ? esc(t("Other (unassigned)")) : hl(str(b.name).trim(), q)) + duMarke(b, meta) + '</span>';
      return bildHtml(p.image_url) + '<span class="ush-zweizeilig"><span class="ush-titel" title="' + esc(titel) + '">' + hl(titel, q) + '</span>' + unter + '</span>';
    }
    function preisZelle(r) {
      var p = preisSpanne(r);
      return p ? '<span class="up-num">' + esc(p) + '</span>' : '<span class="up-num is-empty">–</span>';
    }

    /* ---- Product Movement ------------------------------------------------------------------------ */
    function zeichneBewegung(d) {
      var el = sek("bewegung");
      if (!el) return;
      var meta = d && d.meta;
      var pp = meta && meta.previous_period ? zeitraum(meta.previous_period.from, meta.previous_period.to) : "";
      var kopf = sekKopf("Product Movement", pp ? ersetze(t("Largest Visibility changes vs. {period}"), { period: pp }) : t("Largest Visibility changes"));
      if (!d) { el.innerHTML = kopf + '<div class="up-box">' + skelettZeilen(4, [{ w: 160, logo: true }, 60]) + '</div>'; return; }
      var mv = d.movement && typeof d.movement === "object" ? d.movement : {};
      var steigt = (isArr(mv.rising) ? mv.rising : []).filter(function (x) { return x && str(x.source_product_id).trim(); }).slice(0, 5);
      var faellt = (isArr(mv.declining) ? mv.declining : []).filter(function (x) { return x && str(x.source_product_id).trim(); }).slice(0, 5);
      if (!vergleich(meta) || (!steigt.length && !faellt.length)) {
        el.innerHTML = kopf + '<div class="up-box">' + UC.leerHtml({ icon: "chartSpline", titel: "Not enough history yet",
          text: "Product Movement needs a comparison period. It appears once there is data from before this range." }) + '</div>';
        return;
      }
      function gruppe(titel, ic, l) {
        if (!l.length) return "";
        return '<div class="up-thead ush-gruppenkopf"><div class="up-th"><span class="ush-gruppen-ic">' + UC.icon(ic, 2) + '</span>' + esc(t(titel)) + '</div></div>' +
          '<div class="up-tbody">' + l.map(function (p) { return bewegungZeile(p, meta); }).join("") + '</div>';
      }
      el.innerHTML = kopf + '<div class="up-box ush-bewegung ush-klickbar" style="--up-cols: minmax(0,1fr) auto">' +
        gruppe("Rising", "arrowUpRight", steigt) + gruppe("Declining", "arrowDownRight", faellt) + '</div>';
    }
    function bewegungZeile(p, meta) {
      var v = kz(p.visibility), pos = kz(p.avg_position), st = str(p.status);
      pos.v = posWert(pos.v); pos.p = posWert(pos.p);
      var rechts;
      if (st === "new") rechts = '<span class="up-marke is-leise">' + esc(t("New")) + '</span>';
      else if (st === "gone") rechts = '<span class="up-marke is-leise">' + esc(t("Gone")) + '</span>';
      else rechts = '<span class="ush-bew-zeile"><span class="ush-bew-lbl">' + esc(t("Visibility")) + '</span>' + (trend("pct", v.d, meta) || '<span class="up-num is-empty">–</span>') + '</span>';
      var posTxt = pos.p != null && pos.v != null
        ? '<span class="ush-bew-zeile ush-bew-pos"><span class="ush-bew-lbl">' + esc(t("Position")) + '</span><span class="up-num">' + esc(stelle(pos.p)) + '</span>' +
          UC.icon("arrowRight", 2) + '<span class="up-num">' + esc(stelle(pos.v)) + '</span></span>' : '';
      return '<div ' + produktZeile(p) + '>' +
        '<div class="up-td">' + produktZelle(p, meta) + '</div>' +
        '<div class="up-td ush-bew-rechts">' + rechts + posTxt + '</div></div>';
    }

    /* ---- Merchant Distribution: die Balkenliste aus core ----------------------------------------- */
    function zeichneVerteilung(d) {
      var el = sek("verteilung");
      if (!el) return;
      if (!el.querySelector(".ush-balkenplatz")) el.innerHTML = sekKopf("Merchant Distribution", t("Merchants listed with observed products"), mehrKnopf("View all merchants", "merchants"), "merchant") +
        '<div class="up-box ush-balkenbox"><div class="ush-balkenplatz"></div></div>';
      var platz = el.querySelector(".ush-balkenplatz");
      if (!balken.ov) balken.ov = UC.makeBarList({ mount: platz, isDark: isDark, fmt: function (v) { return pct(v); } });
      if (!d) { balken.ov.skeleton(5); return; }
      var md = d.merchant_distribution && typeof d.merchant_distribution === "object" ? d.merchant_distribution : {};
      var top = (isArr(md.top) ? md.top : []).filter(function (m) { return m && anteilWert(m.share) != null; });
      var items = top.map(function (m, i) {
        var n = haendlerName(m.merchant_name);
        return { key: n || "", name: n || t("Unknown"), share: anteilWert(m.share), color: grau(i), zeichen: UC.icon("store", 2) };
      });
      var rest = md.rest && typeof md.rest === "object" ? md.rest : null;
      if (rest && anteilWert(rest.share) > 0) {
        var n = num(rest.merchants);
        items.push({ key: "__rest", name: n != null ? ersetze(t(n === 1 ? "{n} merchant" : "{n} other merchants"), { n: ganz(n) }) : t("Other"),
                     share: anteilWert(rest.share), color: grau(99) });
      }
      if (!items.length) { platz.innerHTML = UC.leerHtml({ mini: true, titel: "No merchants yet" }); return; }
      balken.ov.render(items);
    }

    /* ============================================================================================
       Tabellen mit Suche, Sortierung und Pager (Products, Brands, Merchants, Recent Appearances)
       ============================================================================================ */
    function tbState(s) { return s === "products" ? state.products : s === "brands" ? state.brands : s === "merchants" ? state.merchants : state.auftritte; }
    function tabelleVerdrahten(s, tab) {
      var tb = tbState(s);
      /* Der Pager aus core: page, pageSize, totalCount im Zustand der Tabelle. */
      var pst = { page: tb.page || 1, pageSize: tb.pageSize || 15, totalCount: null, loading: false };
      if (UC.makePager) pager[s] = { st: pst, kit: UC.makePager({ root: tab, state: pst, onChange: function () {
        tb.page = pst.page; tb.pageSize = pst.pageSize; persist(); zeichneTabelle(); bedarf();
      } }) };
      /* DIE MARKEN-AUSWAHL (05.10. angefordert: "kein Selected Brands Dropdown"). Der Marken-Filter
         der anderen Tabellen aus core (UC.makeAuswahlFilter), als Einzelauswahl: die RPC kennt genau
         eine Marke (p_company_id). Er ersetzt den Chip "Brand: ..." -- ein Klick auf eine Marke in
         Brands oder in der Landscape setzt dieselbe Auswahl, und hier ist sie zu sehen und zu aendern. */
      if (s === "products" && UC.makeAuswahlFilter) {
        var mp = tab.querySelector(".ush-markenplatz");
        markenFilter = UC.makeAuswahlFilter({
          einzeln: true, klasse: "ush-markenfilter", titel: "Brands", alle: "All Brands", suche: "Search brands…", leer: "No brands yet",
          items: markenListe, gewaehlt: tb.marke && tb.marke.id ? [str(tb.marke.id)] : [],
          onChange: function (keys) {
            var k = keys && keys.length ? str(keys[0]) : "";
            var hit = markenListe().filter(function (x) { return x.key === k; })[0];
            tb.marke = k ? { id: k, name: hit ? hit.label : "" } : null;
            tb.page = 1; pst.page = 1; persist(); zeichneTabelle(); bedarf();
          }
        });
        if (mp) mp.appendChild(markenFilter.el);
      }
      /* DIE HAENDLER-AUSWAHL (05.10.: "es gibt auch einen Merchant-Filter, mach ein Selected
         Merchants Dropdown, leg das in den Core"): UC.makeHaendlerFilter, Einzelauswahl wie die
         RPC (p_merchant). Ersetzt den Chip "Merchant: ...". Die Namen kommen aus allem, was schon
         geladen ist; beim ersten Aufklappen holt er die ersten 100 Haendler nach (haendlerHolen). */
      if (s === "products" && UC.makeHaendlerFilter) {
        var hp = tab.querySelector(".ush-haendlerplatz");
        haendlerFilter = UC.makeHaendlerFilter({
          klasse: "ush-haendlerfilter", namen: haendlerListe, gewaehlt: tb.haendler ? [str(tb.haendler)] : [],
          onOpen: haendlerHolen,
          onChange: function (namen) {
            tb.haendler = namen && namen.length ? str(namen[0]) : null;
            tb.page = 1; pst.page = 1; persist(); zeichneTabelle(); bedarf();
          }
        });
        if (hp) hp.appendChild(haendlerFilter.el);
      }
      /* Das Zahnrad: Spalten und Zeilenhoehe aus UC.makeColumns, bedient wie in teams.js. */
      var spe = spaltenFuer(s, tab), cw = tab.querySelector(".up-cols");
      if (spe && cw && UC.makePopover) {
        var cm = cw.querySelector(".up-cols-menu"), cb = cw.querySelector(".up-cols-btn");
        var cpop = UC.makePopover({ wrap: cw, menu: cm, opener: cb, group: "ush-" + instanceId });
        cb.addEventListener("click", function (e) {
          e.stopPropagation();
          if (cpop.isOpen()) { cpop.close(false); return; }
          spe.kit.populateCols(); cpop.open();
        });
        cm.addEventListener("click", function (e) {
          if (e.target.closest("[data-colsall]")) { spe.kit.selectAllCols(); return; }
          var dn = e.target.closest("[data-dense]");
          if (dn) { dichteSetzen(s, dn.getAttribute("data-dense") === "1"); spe.kit.populateCols(); return; }
          var cr = e.target.closest("[data-col]");
          if (cr) spe.kit.toggleCol(cr.getAttribute("data-col"));
        });
        spe.kit.syncColsBadge();
      }
      tab.addEventListener("click", function (e) {
        /* Ein Zug am Spaltengriff endet mit einem Klick auf den Kopf -- der darf nicht sortieren. */
        if (ziehtNoch || (e.target.closest && e.target.closest(".up-grip"))) return;
        var ps = e.target.closest && e.target.closest("[data-pagesize]");
        var k = pager[s] && pager[s].kit;
        if (ps && k) { k.setPageSize(Number(ps.getAttribute("data-pagesize"))); return; }
        if (e.target.closest(".up-page-prev") && k) { k.goToPage(pst.page - 1); return; }
        if (e.target.closest(".up-page-next") && k) { k.goToPage(pst.page + 1); return; }
        var pg = e.target.closest(".up-page[data-page]");
        if (pg && k) { k.goToPage(Number(pg.getAttribute("data-page"))); return; }
        var so = e.target.closest(".up-th.is-sortable[data-sort]");
        if (so && sortKit[s]) { sortKit[s].headSortClick(so.getAttribute("data-sort")); return; }
        var sg = e.target.closest(".ush-segplatz [data-wert]");
        if (sg) {
          var w = sg.getAttribute("data-wert");
          if (w !== state.products.seg) { state.products.seg = w; state.products.page = 1; pst.page = 1; persist(); zeichneTabelle(); bedarf(); }
          return;
        }
        var sc = e.target.closest("[data-ush-scopeweg]");
        if (sc) {
          if (sc.getAttribute("data-ush-scopeweg") === "marke") state.products.marke = null; else state.products.haendler = null;
          state.products.page = 1; pst.page = 1; persist(); zeichneTabelle(); bedarf();
        }
      });
      /* Sortierung ueber die Spaltenkoepfe (UC.makeHeadSort): das Feld und die Richtung ergeben
         zusammen genau einen Wert der Uebergabe. */
      if (s !== "detail" && UC.makeHeadSort) {
        var sst = { sortField: "", sortDir: "" };
        var teile = /^(.*)_(asc|desc)$/.exec(tb.order || ORDER_VORGABE[s]) || [];
        sst.sortField = teile[1] || ""; sst.sortDir = teile[2] || "desc";
        var vorg = /^(.*)_(asc|desc)$/.exec(ORDER_VORGABE[s]);
        sortKit[s] = UC.makeHeadSort({ root: tab, state: sst, cycles: ZYKLEN[s], defaultSort: { field: vorg[1], dir: vorg[2] },
          onSort: function (feld, dir) {
            var o = feld + "_" + dir;
            if (ORDER[s].indexOf(o) < 0) o = ORDER_VORGABE[s];
            var m = /^(.*)_(asc|desc)$/.exec(o);
            sst.sortField = m[1]; sst.sortDir = m[2];
            tb.order = o; tb.page = 1; pst.page = 1; persist(); zeichneTabelle(); bedarf();
          } });
        sortKit[s].st = sst;
      }
      /* Die ausklappbare Suche aus core (UC.makeSearch). Sie sendet nichts selbst -- onFire setzt
         den Suchtext in die Anfrage dieser Tabelle; die Entprellung macht das Kit. */
      var box = tab.querySelector(".ush-suche");
      if (box && UC.makeSearch) {
        var input = box.querySelector(".up-search-input");
        var sst2 = { query: tb.suche || "", page: 1, loading: false };
        if (tb.suche) { input.value = tb.suche; box.classList.add("is-open", "has-text"); }
        var kit = sucheKit[s] = UC.makeSearch({ root: tab, box: box, input: input, state: sst2, prefix: "ush", minChars: 2, debounceMs: 300,
          onRender: function () {},
          onFire: function (p) {
            var q = str(p.query).trim();
            if (q === str(tb.suche)) return;
            tb.suche = q; tb.page = 1; pst.page = 1; persist(); zeichneTabelle(); bedarf();
          } });
        box.querySelector(".up-search-btn").addEventListener("click", function () { kit.toggle(); });
        /* Steht die Suche aus dem gemerkten Stand schon offen da, gilt die Uebernahme sofort --
           sonst erst nach dem naechsten Auf- und Zuklappen. */
        if (kit.syncTakeover) kit.syncTakeover();
        input.addEventListener("input", function () { kit.onInput(); });
        input.addEventListener("keydown", function (e) { if (e.key === "Escape" && box.classList.contains("is-open")) kit.toggle(); });
        box.querySelector(".up-search-clear").addEventListener("click", function () {
          input.value = ""; kit.onInput();
          try { input.focus(); } catch (e2) {}
        });
      }
    }
    function pagerSetzen(s, total, laedt) {
      var p = pager[s];
      if (!p) return;
      var tb = tbState(s);
      p.st.page = tb.page || 1; p.st.pageSize = tb.pageSize || 15; p.st.totalCount = total; p.st.loading = !!laedt;
      try { p.kit.renderPageSize(); p.kit.renderPager(); } catch (e) {}
      var foot = sek("tabelle") && sek("tabelle").querySelector(".ush-foot");
      if (foot) foot.hidden = !(num(total) > 0);
    }
    /* Die Gesamtzahl einer Tabelle: total_count, und ist der kaputt oder fehlt, das, was sicher da
       ist -- Versatz plus gelieferte Zeilen. Zaehler im Kopf und Pager zeigen dieselbe Zahl (vorher
       stand im Pager "11" und im Kopf nichts). */
    function gesamt(roh, tb, n) { var g = anzahlWert(roh); return g != null ? Math.round(g) : offsetOf(tb) + n; }
    function zaehlerSetzen(n) {
      var tab = sek("tabelle"), h = tab && tab.querySelector(".ush-heading"), z = tab && tab.querySelector(".up-head-count");
      if (!h || !z) return;
      h.classList.toggle("has-count", num(n) != null);
      z.textContent = num(n) != null ? ganz(n) : "";
    }
    function sortSync(s) { if (sortKit[s]) { try { sortKit[s].syncHeadSorters(); } catch (e) {} } }
    function zeichneTabelle() {
      var s = state.seite;
      if (s === "products") zeichneProdTabelle();
      else if (s === "brands") zeichneMarkenTabelle();
      else if (s === "merchants") zeichneHaendlerTabelle();
      else if (s === "detail") zeichneAuftritte();
    }
    /* Laeuft eine neue Seite derselben Tabelle (Blaettern, Sortieren, Suchen), bleiben die alten
       Zeilen stehen und werden gedimmt (UC.makeSoftReload-Klasse is-reloading an der eigenen
       .up-root der Tabelle). Ohne alte Zeilen steht das Skelett. */
    var vorige = {};
    function tabWurzel() { var tab = sek("tabelle"); return tab && tab.querySelector(".ush-tabwurzel"); }
    function tabInhalt(html, dimmen) {
      var w = tabWurzel();
      if (!w) return;
      w.classList.toggle("is-reloading", !!dimmen);
      w.querySelector(".ush-tabelle").innerHTML = html;
    }

    /* ---- Products --------------------------------------------------------------------------------- */
    function zeichneProducts() {
      var a = prodAnfrage(), d = daten(a);
      zeichneProdTabelle();
    }
    function zeichneProdTabelle() {
      var tab = sek("tabelle");
      if (!tab) return;
      var tb = state.products, a = prodAnfrage(), d = daten(a), meta = d && d.meta;
      /* Die Segmente mit ihren Zaehlern (segment_counts: Suche, Haendler und Marke beruecksichtigt,
         das gewaehlte Segment nicht). */
      var sc = d && d.segment_counts && typeof d.segment_counts === "object" ? d.segment_counts : (vorige.segCounts || null);
      if (d && d.segment_counts) vorige.segCounts = d.segment_counts;
      var segPlatz = tab.querySelector(".ush-segplatz");
      if (segPlatz) {
        segPlatz.innerHTML = segHtml("ush-segmente", [["all", "All", sc ? ganz(sc.all) : null], ["you", "You", sc ? ganz(sc.you) : null],
          ["competition", "Competition", sc ? ganz(sc.competition) : null], ["other", "Other", sc ? ganz(sc.other) : null]], tb.seg);
      }
      if (markenFilter) {
        var soll = tb.marke && tb.marke.id ? [str(tb.marke.id)] : [];
        if (soll.join() !== markenFilter.gewaehlt().join()) markenFilter.setGewaehlt(soll);
      }
      if (haendlerFilter) {
        var sollH = tb.haendler ? [str(tb.haendler)] : [];
        if (sollH.join() !== haendlerFilter.gewaehlt().join()) haendlerFilter.setGewaehlt(sollH);
        else haendlerFilter.neu();
      }
      scopeZeigen(tab);
      zaehlerSetzen(d ? anzahlWert(d.total_count) : null);
      var kopf = kopfAus("products");
      if (!d) {
        if (fehlerVon(a)) { tabInhalt('<div class="up-box">' + fehlerKasten(a) + '</div>'); pagerSetzen("products", null); return; }
        if (vorige.prod && vorige.prodFilter === filterSig()) { tabInhalt(vorige.prod, true); spaltenAnwenden("products"); pagerSetzen("products", vorige.prodTotal, true); sortSync("products"); return; }
        tabInhalt(tabelleHtml(kopf, skelettAus("products", 6), "ush-produkte"));
        spaltenAnwenden("products"); pagerSetzen("products", null, true); sortSync("products");
        return;
      }
      var rows = (isArr(d.rows) ? d.rows : []).filter(function (p) { return p && typeof p === "object" && str(p.source_product_id).trim(); });
      if (!rows.length) {
        var gef = !!(tb.suche || tb.marke || tb.haendler || tb.seg !== "all" || filterAktiv());
        tabInhalt('<div class="up-box">' + UC.leerHtml({ gefiltert: gef, was: "products", icon: "stackStar",
          titel: gef ? "No matching products" : "No products yet",
          text: gef ? (tb.suche ? ersetze(t("No product title, listing or brand contains “{q}”."), { q: tb.suche }) : "No observed products match these filters.") : "",
          knopf: gef ? "Clear search and filters" : "", knopfAttr: "data-ush-prodweg" }) + '</div>');
        pagerSetzen("products", 0); sortSync("products");
        return;
      }
      var html = tabelleHtml(kopf, rows.map(function (p) { return prodZeile(p, meta, tb.suche); }).join(""), "ush-produkte ush-klickbar");
      vorige.prod = html; vorige.prodTotal = gesamt(d.total_count, tb, rows.length); vorige.prodFilter = filterSig();
      zaehlerSetzen(vorige.prodTotal);
      tabInhalt(html);
      spaltenAnwenden("products");
      pagerSetzen("products", vorige.prodTotal);
      sortSync("products");
    }
    function prodZeile(p, meta, q) {
      var b = p.brand && typeof p.brand === "object" ? p.brand : { type: "other" };
      var vis = kz(p.visibility), obs = kz(p.observations), pos = kz(p.avg_position), fp = kz(p.first_position_rate);
      var mh = (isArr(p.merchants) ? p.merchants : []).map(haendlerName).filter(Boolean);
      var mz = anzahlWert(p.merchant_count) != null ? anzahlWert(p.merchant_count) : mh.length;
      var haendler = mz > 0
        ? '<span class="ush-haendlerzahl" title="' + esc(mh.join(", ")) + '"><span class="ush-haendler-ic">' + UC.icon("store", 2) + '</span>' +
          '<span class="ush-haendlerzahl-txt">' + esc(ersetze(t(mz === 1 ? "{n} merchant" : "{n} merchants"), { n: ganz(mz) })) + '</span></span>'
        : '<span class="up-num is-empty">–</span>';
      return '<div ' + produktZeile(p) + '>' +
        '<div class="up-td">' + produktZelle(p, meta, true, q) + '</div>' +
        td("brand", markeChip(b, meta, q)) +
        '<div class="up-td up-td-vis up-var-sov">' + ringHtml(vis.v) + '</div>' +
        td("obs", ganzHtml(obs.v)) +
        td("pos", posHtml(pos.v)) +
        td("first", pctHtml(fp.v)) +
        td("price", preisZelle(p.price_ranges)) +
        td("rating", sterne(p.rating)) +
        td("merchants", haendler) +
        td("seen", '<span class="up-num">' + esc(datum(p.last_seen)) + '</span>') +
      '</div>';
    }
    /* Der Bezug aus einem Klick (Marke oder Haendler) als Chip, wie die Chips der Filterleiste. */
    /* Die Marken fuer die Auswahl: die getrackten Marken der App (Markenspeicher), dazu jede Marke
       aus einer schon geladenen Uebersicht und die gerade gewaehlte -- so steht nie eine Id statt
       eines Namens im Knopf. Alphabetisch. */
    /* Mit Logo (05.10.: "im Selected Brands Dropdown fehlen die Logos"): logo_url aus dem
       Markenspeicher, sonst aus der Uebersicht; ein Eintrag ohne Bild zeigt den Anfangsbuchstaben. */
    function markenListe() {
      var l = [], da = {};
      function rein(id, name, logo) {
        id = str(id).trim(); name = str(name).trim();
        if (!id || !name) return;
        if (da[id]) { if (!da[id].logo && logoUrl(logo)) da[id].logo = logoUrl(logo); return; }
        da[id] = { key: id, label: name, logo: logoUrl(logo) || "" };
        l.push(da[id]);
      }
      (UC.getBrands ? UC.getBrands() : []).forEach(function (b) { if (b) rein(b.company_id, b.name, b.logo_url || b.favicon_url); });
      Object.keys(state.cache.overview).forEach(function (sig) {
        var d = state.cache.overview[sig];
        (isArr(d && d.brands) ? d.brands : []).forEach(function (b) { if (b && typeof b === "object" && b.type !== "other") rein(b.company_id, b.name, b.logo_url); });
      });
      Object.keys(state.cache.products).forEach(function (sig) {
        var d = state.cache.products[sig];
        (isArr(d && d.rows) ? d.rows : []).forEach(function (p) { var b = p && p.brand; if (b && typeof b === "object" && b.type !== "other") rein(b.company_id, b.name, b.logo_url); });
      });
      var m = state.products.marke;
      if (m && m.id) rein(m.id, m.name || m.id);
      return l.sort(function (a, b) { return a.label.localeCompare(b.label); });
    }
    /* Alle Haendlernamen, die schon geladen sind: die Haendler-Antworten, die Verteilung der
       Uebersicht, die Haendler der geladenen Produktzeilen und der gewaehlte. */
    function haendlerListe() {
      var l = [];
      function rein(n) { n = haendlerName(n); if (n) l.push(n); }
      Object.keys(state.cache.merchants).forEach(function (sig) {
        var d = state.cache.merchants[sig];
        (isArr(d && d.merchants) ? d.merchants : []).forEach(function (m) { if (m && typeof m === "object") rein(m.merchant_name); });
      });
      Object.keys(state.cache.overview).forEach(function (sig) {
        var md = state.cache.overview[sig] && state.cache.overview[sig].merchant_distribution;
        (isArr(md && md.top) ? md.top : []).forEach(function (m) { if (m && typeof m === "object") rein(m.merchant_name); });
      });
      Object.keys(state.cache.products).forEach(function (sig) {
        var d = state.cache.products[sig];
        (isArr(d && d.rows) ? d.rows : []).forEach(function (p) { (isArr(p && p.merchants) ? p.merchants : []).forEach(rein); });
      });
      if (state.products.haendler) rein(state.products.haendler);
      return l;
    }
    /* Die Liste beim ersten Aufklappen: die 100 meistgenannten Haendler im selben Zeitraum und mit
       denselben Filtern -- dieselbe Anfrage wie die Merchants-Tabelle mit 100 Zeilen, also auch
       derselbe Workflow (shopMerchants). Liegt sie schon vor oder laeuft sie, passiert nichts. */
    var HAENDLER_LISTE = { suche: "", order: "observations_desc", page: 1, pageSize: 100 };
    function haendlerHolen() {
      var a = meAnfrage(HAENDLER_LISTE);
      if (state.cache.merchants[a.sig] || unterwegs.merchants || state.fehler[a.kanal + a.sig]) return;
      senden(a);
    }
    function scopeZeigen(tab) {
      var el = tab.querySelector(".ush-scope"), tb = state.products, teile = [];
      /* Die Marke zeigt die Marken-Auswahl in der Werkzeugleiste; nur ohne sie (core zu alt) ein Chip. */
      if (tb.marke && tb.marke.id && !markenFilter) teile.push(["marke", "Brand", str(tb.marke.name) || "–", "squareStack"]);
      if (tb.haendler && !haendlerFilter) teile.push(["haendler", "Merchant", str(tb.haendler), "store"]);
      el.hidden = !teile.length;
      el.innerHTML = teile.map(function (x) {
        return '<span class="up-entchip is-static ufb-chip ush-scopechip">' +
          '<span class="ufb-chip-ic">' + UC.icon(x[3], 2) + '</span>' +
          '<span class="ufb-chip-lbl"><span class="ufb-chip-key">' + esc(t(x[1])) + ': </span>' + esc(x[2]) + '</span>' +
          '<button class="ufb-chip-x" type="button" data-ush-scopeweg="' + x[0] + '" aria-label="' + esc(t("Clear")) + '" data-tip="' + esc(t("Clear")) + '">' + UC.icon("x", 2.6) + '</button></span>';
      }).join("");
    }

    /* ---- Brands ----------------------------------------------------------------------------------- */
    function zeichneBrands() {
      var d = overviewGleicherFilter();
      zeichneMarkenKpis(d);
      zeichneChart();
      zeichneMarkenTabelle();
    }
    function zeichneMarkenKpis(d) {
      var el = sek("kpis");
      if (!el) return;
      if (!d) {
        var a = ovAnfrage(state.brands);
        el.innerHTML = fehlerVon(a) ? '<div class="ush-kpifehler">' + fehlerKasten(a) + '</div>'
          : [0, 1, 2, 3].map(function () { return UC.kpiKarteSkelett ? UC.kpiKarteSkelett("ush-kpi") : ""; }).join("");
        return;
      }
      var meta = d.meta || {}, bs = d.brands_summary && typeof d.brands_summary === "object" ? d.brands_summary : {};
      var ohneEigene = meta.own_company_set !== true || eigeneOhneTreffer(meta);
      var tc = bs.top_competitor && typeof bs.top_competitor === "object" ? bs.top_competitor : null;
      var n = num(bs.tracked_brands_observed), sos = kz(bs.own_share_of_shelf);
      var leerFuss = esc(t(meta.own_company_set === true ? "No products matched your brand" : "Set up your own brand to see your brand metrics."));
      el.innerHTML =
        kpiHtml({ label: "Brands observed", wertHtml: zaehlWert("ganz", n), fussHtml: esc(t("Tracked brands. Unassigned products are not counted.")) }) +
        kpiHtml({ label: "Your rank", wertHtml: ohneEigene || posWert(bs.own_rank) == null ? '<span class="up-num is-empty">–</span>' : '<span class="up-num">#' + esc(ganz(bs.own_rank)) + '</span>',
          fussHtml: ohneEigene ? leerFuss : (n != null ? esc(ersetze(t("of {n} by Share of Shelf"), { n: ganz(n) })) : "") }) +
        kpiHtml({ label: "Your Share of Shelf", wertHtml: ohneEigene ? '<span class="up-num is-empty">–</span>' : zaehlWert("pct", sos.v),
          trendHtml: ohneEigene ? "" : trend("pct", sos.d, meta), fussHtml: ohneEigene ? leerFuss : vergleichFuss(meta) }) +
        kpiHtml({ label: "Top competitor", wertHtml: tc && anteilWert(tc.share_of_shelf) != null ? '<span class="ush-kpi-marke">' + markeLogo(tc) + zaehlWert("pct", tc.share_of_shelf) + '</span>' : '<span class="up-num is-empty">–</span>',
          fussHtml: tc && str(tc.name).trim() ? esc(ersetze(t("Share of Shelf of {brand}"), { brand: str(tc.name).trim() })) : "" });
      erklaerAnLabels(el, ["brandsObserved", "ownRank", "share", "topCompetitor"]);
      hochzaehlen(el);
    }
    function zeichneMarkenTabelle() {
      var tab = sek("tabelle");
      if (!tab) return;
      var a = ovAnfrage(state.brands), d = daten(a), meta = d && d.meta;
      var bp = d && d.brands_page && typeof d.brands_page === "object" ? d.brands_page : null;
      zaehlerSetzen(bp ? anzahlWert(bp.total_count) : null);
      var kopf = kopfAus("brands");
      if (!d) {
        if (fehlerVon(a)) { tabInhalt('<div class="up-box">' + fehlerKasten(a) + '</div>'); pagerSetzen("brands", null); return; }
        if (vorige.marke && vorige.markeFilter === filterSig()) { tabInhalt(vorige.marke, true); spaltenAnwenden("brands"); pagerSetzen("brands", vorige.markeTotal, true); sortSync("brands"); return; }
        tabInhalt(tabelleHtml(kopf, skelettAus("brands", 6)));
        spaltenAnwenden("brands"); pagerSetzen("brands", null, true); sortSync("brands");
        return;
      }
      var l = (isArr(d.brands) ? d.brands : []).filter(function (b) { return b && typeof b === "object"; });
      /* "Andere" steht UNTER der Tabelle angepinnt, nicht im Blaettern (Uebergabe 7.1) -- und nur,
         wenn die Suche nicht gerade nach etwas anderem fragt. */
      var andere = d.brands_other && typeof d.brands_other === "object" && !state.brands.suche ? d.brands_other : null;
      if (!l.length && !andere) {
        var gef = !!(state.brands.suche || filterAktiv());
        tabInhalt('<div class="up-box">' + UC.leerHtml({ gefiltert: gef, was: "brands", icon: "squareStack", titel: gef ? "No matching brands" : "No brands yet",
          knopf: gef ? "Clear search and filters" : "", knopfAttr: "data-ush-markeweg" }) + '</div>');
        pagerSetzen("brands", 0); sortSync("brands");
        return;
      }
      var zeilen = l.map(function (b) { return markenZeile(b, meta, false, state.brands.suche); }).join("");
      var html = tabelleHtml(kopf, zeilen + (andere ? markenZeile(mit({}, mit(andere, { type: "other" })), meta, true) : ""), "ush-marken ush-klickbar");
      vorige.marke = html; vorige.markeTotal = gesamt(bp && bp.total_count, state.brands, l.length); vorige.markeFilter = filterSig();
      zaehlerSetzen(vorige.markeTotal);
      tabInhalt(html);
      spaltenAnwenden("brands");
      pagerSetzen("brands", vorige.markeTotal);
      sortSync("brands");
    }
    function markenZeile(b, meta, angepinnt, q) {
      var sos = kz(b.share_of_shelf), andere = b.type === "other" || !b.company_id;
      var tp = b.top_product && typeof b.top_product === "object" && str(b.top_product.source_product_id).trim() ? b.top_product : null;
      return '<div class="up-row ush-zeile' + (andere ? " is-andere" : "") + (angepinnt ? " is-angepinnt" : "") + '"' +
          (andere ? '' : ' data-marke="' + esc(b.company_id) + '" data-marke-name="' + esc(str(b.name).trim()) + '" role="link" tabindex="0"') + '>' +
        '<div class="up-td">' + markeLogo(b) + markeName(b, q) + duMarke(b, meta) + '</div>' +
        '<div class="up-td up-td-share up-var-sov">' + ringHtml(sos.v) + '</div>' +
        td("presence", pctHtml(kz(b.presence).v)) +
        td("products", ganzHtml(b.products)) +
        td("obs", ganzHtml(kz(b.observations).v)) +
        td("pos", posHtml(kz(b.avg_position).v)) +
        td("first", pctHtml(kz(b.first_position_rate).v)) +
        td("change", trend("pct", sos.d, meta) || '<span class="up-num is-empty">–</span>') +
        '<div class="up-td up-td-top">' + (tp ? '<span class="ush-topprodukt"' + (str(tp.source_product_id).trim() ? ' data-produkt="' + esc(str(tp.source_product_id).trim()) + '"' : '') + '>' + bildHtml(tp.image_url, "is-klein") +
          '<span class="ush-titel" title="' + esc(str(tp.title)) + '">' + esc(str(tp.title).trim() || "–") + '</span></span>' : '<span class="up-num is-empty">–</span>') + '</div>' +
      '</div>';
    }

    /* ---- Merchants --------------------------------------------------------------------------------- */
    function zeichneMerchants() {
      var a0 = meAnfrage(ME_VORGABE), d0 = daten(a0), d = daten(meAnfrage(state.merchants)) || d0;
      zeichneHaendlerKpis(d0 || d, a0);
      zeichneHaendlerBalken(d0, a0);
      zeichneHaendlerTabelle();
    }
    function zeichneHaendlerKpis(d, a) {
      var el = sek("kpis");
      if (!el) return;
      if (!d) {
        el.innerHTML = fehlerVon(a) ? '<div class="ush-kpifehler">' + fehlerKasten(a) + '</div>'
          : [0, 1, 2].map(function () { return UC.kpiKarteSkelett ? UC.kpiKarteSkelett("ush-kpi") : ""; }).join("");
        return;
      }
      var s = d.summary && typeof d.summary === "object" ? d.summary : {};
      var tm = s.top_merchant && typeof s.top_merchant === "object" ? s.top_merchant : null;
      var name = tm ? haendlerName(tm.merchant_name) : "";
      el.innerHTML =
        kpiHtml({ label: "Merchants observed", wertHtml: zaehlWert("ganz", s.merchants), fussHtml: num(s.products) != null ? esc(ersetze(t("Across {n} products"), { n: ganz(s.products) })) : "" }) +
        kpiHtml({ label: "Top merchant", wertHtml: tm ? '<span class="ush-kpi-text" title="' + esc(name || t("Unknown")) + '">' + esc(name || t("Unknown")) + '</span>' : '<span class="up-num is-empty">–</span>',
          fussHtml: esc(t("Most listed with observed products")) }) +
        kpiHtml({ label: "Top merchant share", wertHtml: tm ? zaehlWert("pct", tm.share) : '<span class="up-num is-empty">–</span>',
          fussHtml: tm && num(tm.observations) != null && num(s.observations) != null ? esc(ersetze(t("{n} of {total} merchant mentions"), { n: ganz(tm.observations), total: ganz(s.observations) })) : "" });
      erklaerAnLabels(el, ["merchantsObserved", "topMerchant", "topMerchantShare"]);
      hochzaehlen(el);
    }
    function zeichneHaendlerBalken(d, a) {
      var el = sek("balken");
      if (!el) return;
      if (!el.querySelector(".ush-balkenplatz")) el.innerHTML = sekKopf("Merchant Share", t("Share of all merchant mentions on observed products"), "", "merchant") +
        '<div class="up-box ush-balkenbox"><div class="ush-balkenplatz"></div></div>';
      var platz = el.querySelector(".ush-balkenplatz");
      if (!balken.me) balken.me = UC.makeBarList({ mount: platz, isDark: isDark, fmt: function (v) { return pct(v); } });
      if (!d) { if (fehlerVon(a)) platz.innerHTML = fehlerKasten(a); else balken.me.skeleton(6); return; }
      /* Ein Balken ohne lesbaren Anteil haette keine Laenge -- er faellt weg, die Tabelle darunter
         zeigt den Haendler trotzdem. */
      var l = (isArr(d.merchants) ? d.merchants : []).filter(function (m) { return m && typeof m === "object" && anteilWert(kz(m.share).v) != null; });
      if (!l.length) { platz.innerHTML = UC.leerHtml({ mini: true, titel: "No merchants yet" }); return; }
      var items = l.map(function (m, i) {
        var n = haendlerName(m.merchant_name);
        return { key: n, name: n || t("Unknown"), share: anteilWert(kz(m.share).v), color: grau(i), zeichen: UC.icon("store", 2) };
      });
      /* DER REST ALS EIN BALKEN (05.10. gefragt: "wird das gruppiert, damit es nicht unendlich
         gross wird?"). Gross werden kann es nicht: die Balken sind die erste Seite der
         Vorgabe-Anfrage, also hoechstens 15. Was darueber hinaus geht, steht jetzt wie in der
         Verteilung der Uebersicht als "{n} weitere Haendler" darunter -- in der Oberflaeche
         gerechnet, ohne die RPC: der Anteil ist einer an ALLEN Nennungen, der Rest ist also
         100 minus die gezeigten, und die Zahl der uebrigen summary.merchants minus die gezeigten. */
      var su = d.summary && typeof d.summary === "object" ? d.summary : {}, gesamtN = anzahlWert(su.merchants);
      var summe = items.reduce(function (a, x) { return a + x.share; }, 0), restN = gesamtN != null ? gesamtN - items.length : null;
      if (restN != null && restN > 0 && 100 - summe >= 0.05) {
        items.push({ key: "__rest", name: ersetze(t(restN === 1 ? "{n} merchant" : "{n} other merchants"), { n: ganz(restN) }), share: Math.min(100, 100 - summe), color: grau(99) });
      }
      balken.me.render(items);
    }
    function zeichneHaendlerTabelle() {
      var tab = sek("tabelle");
      if (!tab) return;
      var a = meAnfrage(state.merchants), d = daten(a), meta = d && d.meta;
      zaehlerSetzen(d ? anzahlWert(d.total_count) : null);
      var kopf = kopfAus("merchants");
      if (!d) {
        if (fehlerVon(a)) { tabInhalt('<div class="up-box">' + fehlerKasten(a) + '</div>'); pagerSetzen("merchants", null); return; }
        if (vorige.me && vorige.meFilter === filterSig()) { tabInhalt(vorige.me, true); spaltenAnwenden("merchants"); pagerSetzen("merchants", vorige.meTotal, true); sortSync("merchants"); return; }
        tabInhalt(tabelleHtml(kopf, skelettAus("merchants", 6)));
        spaltenAnwenden("merchants"); pagerSetzen("merchants", null, true); sortSync("merchants");
        return;
      }
      var l = (isArr(d.merchants) ? d.merchants : []).filter(function (m) { return m && typeof m === "object"; });
      if (!l.length) {
        var gef = !!(state.merchants.suche || filterAktiv());
        tabInhalt('<div class="up-box">' + UC.leerHtml({ gefiltert: gef, was: "merchants", icon: "store", titel: gef ? "No matching merchants" : "No merchants yet",
          knopf: gef ? "Clear search and filters" : "", knopfAttr: "data-ush-meweg" }) + '</div>');
        pagerSetzen("merchants", 0); sortSync("merchants");
        return;
      }
      var q = state.merchants.suche;
      var html = tabelleHtml(kopf, l.map(function (m) {
        var n = haendlerName(m.merchant_name), sh = kz(m.share), ob = kz(m.observations);
        return '<div class="up-row ush-zeile"' + (n ? ' data-haendler="' + esc(n) + '" role="link" tabindex="0"' : '') + '>' +
          '<div class="up-td">' + haendlerHtml(n, q) + '</div>' +
          td("share", pctHtml(sh.v) + trend("pct", sh.d, meta)) +
          td("products", ganzHtml(m.products)) +
          td("obs", ganzHtml(ob.v) + trend("anzahl", ob.d, meta)) +
          td("pos", posHtml(m.avg_position)) +
          td("firstseen", '<span class="up-num">' + esc(datum(m.first_seen)) + '</span>') +
          td("seen", '<span class="up-num">' + esc(datum(m.last_seen)) + '</span>') +
        '</div>';
      }).join(""), "ush-haendler ush-klickbar");
      vorige.me = html; vorige.meTotal = gesamt(d.total_count, state.merchants, l.length); vorige.meFilter = filterSig();
      zaehlerSetzen(vorige.meTotal);
      tabInhalt(html);
      spaltenAnwenden("merchants");
      pagerSetzen("merchants", vorige.meTotal);
      sortSync("merchants");
    }

    /* ============================================================================================
       Product Detail
       ============================================================================================ */
    function zeichneDetail() {
      var a = detailAnfrage(), d = dasDetail();
      krumenNeu();
      var fe = !d && fehlerVon(a);
      /* Ist das Produkt nicht ladbar, steht nur der eine Fehlerkasten da -- kein zweiter im Chart,
         kein leerer Tabellenkopf mit Pager darunter. */
      ["chart", "wo", "dhaendler", "tabelle"].forEach(function (n) { var s = sek(n); if (s) s.hidden = !!fe; });
      if (fe) {
        sek("hero").innerHTML = '<div class="up-box">' + fehlerKasten(a, "detail") + '</div>';
        ["wo", "dhaendler"].forEach(function (n) { sek(n).innerHTML = ""; });
        if (linie) linie.empty(t("This product could not be loaded"));
        tabInhalt(""); pagerSetzen("detail", null); zaehlerSetzen(null);
        return;
      }
      zeichneHero(d);
      zeichneDetailChart();
      zeichneWo(d);
      zeichneDetailHaendler(d);
      zeichneAuftritte();
    }
    function zeichneHero(d) {
      var el = sek("hero");
      if (!el) return;
      if (!d) {
        el.innerHTML = '<div class="up-box ush-hero"><div class="ush-hero-oben"><span class="ush-hero-bild is-sk"></span>' +
          '<div class="ush-hero-info"><span class="up-tsk-bar" style="width:120px"></span><span class="up-tsk-bar" style="width:60%"></span><span class="up-tsk-bar" style="width:40%"></span></div></div>' +
          '<div class="up-kpiband is-4 ush-kpis">' + [0, 1, 2, 3].map(function () { return UC.kpiKarteSkelett ? UC.kpiKarteSkelett("ush-kpi") : ""; }).join("") + '</div></div>';
        return;
      }
      var p = d.product || {}, meta = d.meta || {}, b = p.brand && typeof p.brand === "object" ? p.brand : { type: "other" };
      var titel = str(p.title).trim() || str(p.listing_title).trim() || "–";
      var listing = str(p.listing_title).trim();
      /* DOPPELTE BILDER (05.10.: "oft dieselben Bilder 2-4 mal"): nach der Adresse, nicht nach dem
         Inhalt -- kein zweites Laden und Vergleichen bei jedem Produktaufruf. Zwoelf statt sechs:
         die Leiste blaettert jetzt, statt umzubrechen. */
      var bilder = bilderEinmal([p.image_url].concat(isArr(p.images) ? p.images : [])).slice(0, 12);
      var haupt = bilder[0] || "";
      var preis = letzterPreis(p.latest_price) || preisSpanne(p.price_ranges);
      var mz = anzahlWert(p.merchant_count);
      var k = d.kpis || {}, tr = isArr(d.trend) ? d.trend.filter(function (x) { return x && typeof x === "object"; }) : [];
      /* Wie im Chart darunter: ein Tag ohne Wert ist 0, nur die Position bleibt eine Luecke. */
      function reihe(f) { return tr.map(function (x) { var v = metrikWert(f, x[f]); return v == null && !/position/.test(f) ? 0 : v; }); }
      var kv = kz(k.visibility), ko = kz(k.observations), kp = kz(k.avg_position), kf = kz(k.first_position_rate);
      var fuss = vergleichFuss(meta);
      function kachel(label, wert, trendH, spark) {
        /* Die Sparkline steht rechts in der Zeile des Werts, hinter dem Trend (Entwurf: 72 x 24). */
        return kpiHtml({ label: label, wertHtml: wert, trendHtml: (trendH || "") + (spark ? '<span class="ush-spark">' + spark + '</span>' : ''), fussHtml: fuss });
      }
      el.innerHTML = '<div class="up-box ush-hero">' +
        '<div class="ush-hero-oben">' +
          '<div class="ush-galerie">' +
            '<span class="ush-hero-bild' + (haupt ? " has-img" : "") + '">' +
              '<span class="ush-bild-ph">' + UC.icon("image", 1.6) + '</span>' +
              (haupt ? '<img src="' + esc(haupt) + '" alt="" referrerpolicy="no-referrer" onerror="this.parentNode.classList.remove(\'has-img\');this.remove()"/>' : '') +
            '</span>' +
            /* EINE REIHE, DIE BLAETTERT (05.10.: "max. eine Reihe Vorschaubilder, eher wie ein
               Karussell"). Passen nicht alle hinein, stehen links und rechts die Pfeile. */
            (bilder.length > 1 ? '<div class="ush-karussell">' +
              '<button type="button" class="up-iconbtn is-20 ush-kar-pfeil" data-kar="-1" aria-label="' + esc(t("Previous images")) + '">' + UC.icon("chevronLeft", 2) + '</button>' +
              '<div class="ush-galerie-leiste">' + bilder.map(function (u, i) {
                return '<button type="button" class="ush-galerie-knopf' + (u === haupt ? " is-on" : "") + '" data-bild="' + esc(u) + '" aria-label="' + esc(t("Image") + " " + (i + 1)) + '">' +
                  /* Ein Vorschaubild, das nicht laedt, geht mit seinem Knopf; bleibt nur eins uebrig,
                     geht die Leiste -- ein einzelnes Kaestchen unter dem Hauptbild zeigt nichts Neues. */
                  '<img src="' + esc(u) + '" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="var k=this.closest(\'.ush-karussell\');this.parentNode.remove();if(k&amp;&amp;k.querySelectorAll(\'.ush-galerie-knopf\').length&lt;2)k.remove()"/></button>';
              }).join("") + '</div>' +
              '<button type="button" class="up-iconbtn is-20 ush-kar-pfeil" data-kar="1" aria-label="' + esc(t("Next images")) + '">' + UC.icon("chevronRight", 2) + '</button>' +
            '</div>' : '') +
          '</div>' +
          '<div class="ush-hero-info">' +
            '<div class="ush-hero-marke">' + markeLogo(b) + markeName(b) + duMarke(b, meta) + '</div>' +
            '<h2 class="ush-hero-titel">' + esc(titel) + '</h2>' +
            (listing && listing !== titel ? '<p class="ush-hero-listing">' + esc(ersetze(t("Listed in AI results as {title}"), { title: listing })) + '</p>' : '') +
            '<dl class="ush-hero-fakten">' +
              '<div><dt>' + esc(t("Observed price")) + info("price") + '</dt><dd>' + (preis ? esc(preis) : '<span class="is-empty">–</span>') + '</dd></div>' +
              '<div><dt>' + esc(t("Rating")) + '</dt><dd>' + sterne(p.rating) + (anzahlWert(p.num_reviews) != null ? '<span class="ush-reviews">(' + esc(ganz(p.num_reviews)) + ')</span>' : '') + '</dd></div>' +
              '<div><dt>' + esc(t("Merchants")) + '</dt><dd>' + (mz != null && mz > 0 ? esc(ersetze(t(mz === 1 ? "{n} merchant" : "{n} merchants"), { n: ganz(mz) })) : '<span class="is-empty">–</span>') + '</dd></div>' +
              '<div><dt>' + esc(t("Last Seen")) + '</dt><dd>' + esc(datum(p.last_seen)) + '</dd></div>' +
            '</dl>' +
          '</div>' +
        '</div>' +
        '<div class="up-kpiband is-4 ush-kpis">' +
          kachel("Visibility", zaehlWert("pct", kv.v), trend("pct", kv.d, meta), UC.sparkHtml ? UC.sparkHtml(reihe("visibility")) : "") +
          kachel("Observations", zaehlWert("ganz", ko.v), trend("anzahl", ko.d, meta), UC.sparkHtml ? UC.sparkHtml(reihe("observations")) : "") +
          kachel("Avg. Position", zaehlWert("pos", kp.v), trend("pos", kp.d, meta), UC.sparkHtml ? UC.sparkHtml(reihe("avg_position"), { umgekehrt: true }) : "") +
          kachel("First Position Rate", zaehlWert("pct", kf.v), trend("pct", kf.d, meta), "") +
        '</div></div>';
      erklaerAnLabels(el.querySelector(".ush-kpis"), ["vis", "obs", "pos", "firstProd"]);
      hochzaehlen(el);
      var leiste = el.querySelector(".ush-galerie-leiste");
      if (leiste) leiste.addEventListener("scroll", function () { karussellPruefen(el); }, { passive: true });
      karussellPruefen(el);
    }
    /* ---- Doppelte Bilder: dieselbe Adresse --------------------------------------------------------
       Ohne Protokoll und Anker, Host klein -- dieselbe Datei zweimal verlinkt zaehlt einmal. */
    function bilderEinmal(l) {
      var da = {}, out = [];
      l.forEach(function (u) {
        u = sichereUrl(u);
        if (!u) return;
        var k = u.replace(/^https?:\/\//i, "").replace(/#.*$/, "").replace(/\/+$/, "");
        k = k.replace(/^[^\/]+/, function (h) { return h.toLowerCase(); });
        if (da[k]) return;
        da[k] = 1; out.push(u);
      });
      return out;
    }
    /* Pfeile nur, wenn die Reihe ueberlaeuft; am Anfang und am Ende gedimmt. Bleibt nur ein Bild,
       geht die Reihe ganz. */
    /* ziel: die Stelle, zu der ein Pfeil gerade blaettert. Die Pfeile stellen sich danach sofort ein
       -- das scroll-Ereignis kommt erst mit gemalten Bildern, und ein verdeckter Tab malt keine. */
    function karussellPruefen(el, ziel) {
      var k = el.querySelector(".ush-karussell"), l = k && k.querySelector(".ush-galerie-leiste");
      if (!k) return;
      if (!l || l.querySelectorAll(".ush-galerie-knopf").length < 2) { k.remove(); return; }
      var mehr = l.scrollWidth > l.clientWidth + 1, pos = ziel != null ? ziel : l.scrollLeft;
      k.classList.toggle("hat-mehr", mehr);
      var pf = k.querySelectorAll(".ush-kar-pfeil");
      var amAnfang = pos <= 1, amEnde = pos + l.clientWidth >= l.scrollWidth - 1;
      if (pf[0]) { pf[0].classList.toggle("is-disabled", amAnfang); pf[0].disabled = amAnfang; }
      if (pf[1]) { pf[1].classList.toggle("is-disabled", amEnde); pf[1].disabled = amEnde; }
    }
    function zeichneDetailChart() {
      if (!linie) return;
      var note = elMain.querySelector(".ush-chartnote");
      if (note) note.hidden = state.dMetrik !== "avg_position";
      var a = detailAnfrage(), d = dasDetail();
      if (!d) { if (fehlerVon(a)) linie.empty(t("This product could not be loaded")); else linie.skeleton(); return; }
      var tr = (isArr(d.trend) ? d.trend : []).filter(function (x) { return x && /^\d{4}-\d{2}-\d{2}/.test(str(x.day)); });
      if (!tr.length) { linie.empty(); return; }
      var p = d.product || {}, b = p.brand && typeof p.brand === "object" ? p.brand : { type: "other" };
      var feld = state.dMetrik;
      var tinte = UC.chartInk ? UC.chartInk(root) : UC.accentInk ? UC.accentInk(root) : token("--vc-text", "#1f1f1b");
      var grau = token("--vc-fourth", "#80858e");
      /* Ein Tag ohne Wert steht auf 0 wie in jedem Chart der App -- ausser der Position, dort
         laeuft die Linie ueber den Tag (siehe zeichneChart). */
      function wert(f, x) { var v = metrikWert(f, x[f]); return v == null && !/position/.test(f) ? 0 : v; }
      var ds = [{ label: str(p.title).trim() || t("Product"), __id: "produkt", __baseColor: tinte, borderColor: tinte,
                  data: tr.map(function (x) { return wert(feld, x); }) }];
      /* Die Vergleichslinie der Marke (Uebergabe 7.3): brand_presence neben Visibility,
         brand_avg_position neben Avg. Position. Bei "Andere" null -- dann keine. */
      var vf = feld === "visibility" ? "brand_presence" : feld === "avg_position" ? "brand_avg_position" : "";
      if (vf && b.type !== "other" && str(b.name).trim()) {
        var gemessen = tr.some(function (x) { return metrikWert(vf, x[vf]) != null; });
        if (gemessen) {
          ds.push({ label: ersetze(t(vf === "brand_presence" ? "{brand} presence" : "{brand} avg. position"), { brand: str(b.name).trim() }),
                    __id: "marke", __baseColor: grau, borderColor: grau, __dash: true, data: tr.map(function (x) { return wert(vf, x); }) });
        }
      }
      linie.render({ labels: tr.map(function (x) { return str(x.day).slice(0, 10); }), datasets: ds });
    }
    /* Wo das Produkt erscheint: Topics, Modelle, Maerkte -- je eine Balkenliste aus core in einem
       Kasten mit Trennern. Topics zeigen absolute Antworten (Uebergabe 7.3: "keine Torte", die
       Summe kann ueber 100 % liegen), Modelle und Maerkte den Anteil. */
    function zeichneWo(d) {
      var el = sek("wo");
      if (!el) return;
      if (!el.querySelector(".ush-wo")) {
        el.innerHTML = sekKopf("Where this product appears", "") +
          '<div class="up-box ush-wo">' +
            '<div class="ush-wo-spalte"><div class="ush-wo-kopf">' + UC.icon("tags", 2) + '<span>' + esc(t("Top Topics")) + '</span></div><div class="ush-wo-platz" data-wo="topics"></div></div>' +
            '<div class="ush-wo-spalte"><div class="ush-wo-kopf">' + UC.icon("layers", 2) + '<span>' + esc(t("Models")) + '</span></div><div class="ush-wo-platz" data-wo="models"></div></div>' +
            '<div class="ush-wo-spalte"><div class="ush-wo-kopf">' + UC.icon("mapPin", 2) + '<span>' + esc(t("Markets")) + '</span></div><div class="ush-wo-platz" data-wo="markets"></div></div>' +
          '</div>';
      }
      ["topics", "models", "markets"].forEach(function (w) {
        var platz = el.querySelector('[data-wo="' + w + '"]');
        if (!balken["wo_" + w]) balken["wo_" + w] = UC.makeBarList({ mount: platz, isDark: isDark, fmt: function (v) { return pct(v); } });
        var bl = balken["wo_" + w];
        if (!d) { bl.skeleton(3); return; }
        var l = (isArr(d[w]) ? d[w] : []).filter(function (x) { return x && typeof x === "object" && anteilWert(x.share) != null; }).slice(0, 6);
        if (!l.length) { platz.innerHTML = UC.leerHtml({ mini: true, titel: "No data" }); return; }
        bl.render(l.map(function (x, i) {
          var name, logo = "";
          if (w === "topics") name = str(x.name).trim() || t("Unknown");
          else if (w === "models") {
            var mi = modellInfo(x.model);
            name = mi.name; logo = mi.logo;
          } else { var code = marktCode(x.market); name = code ? marktName(code) : t("Unknown"); }
          var r = num(x.responses);
          /* Maerkte tragen das Flaggenplaettchen aus core (flagge: Code) statt einer PNG im Logo-
             Kaestchen; ohne Code zeigt das Plaettchen "?" und die Namen bleiben buendig. */
          return { key: w + i, name: name, share: anteilWert(x.share), color: grau(i + 1), logo: logo,
                   flagge: w === "markets" ? (/^[A-Z]{2}$/.test(code) ? code : "?") : undefined,
                   wert: w === "topics" && r != null ? ersetze(t(r === 1 ? "{n} response" : "{n} responses"), { n: ganz(r) }) : undefined };
        }));
      });
    }
    function modellInfo(key) {
      var k = str(key).trim(), l = UC.getModels ? UC.getModels() : [];
      /* Fuer die Balkenliste: deren Platte ist in beiden Themen hell, also das schwarze OpenAI-Logo. */
      for (var i = 0; i < l.length; i++) if (str(l[i].key || l[i].model) === k) {
        return { name: str(l[i].display_name || k), logo: sichereUrl(UC.modelLogoUrl ? UC.modelLogoUrl(k, l[i].logo_url, false, l[i].provider) : l[i].logo_url) };
      }
      return { name: k ? k.charAt(0).toUpperCase() + k.slice(1) : t("Unknown"), logo: "" };
    }
    /* "Germany (DE)" wie im Entwurf, der Name aus dem Markt-Speicher (Feld alpha2); kennt der ihn
       nicht, bleibt der Code allein stehen. */
    /* Ein Marktcode ist kurz und ohne Sonderzeichen (DE, AT, US); was anders aussieht, ist kein
       Code, sondern ein Datenfehler und wird "Unknown" bzw. "–". */
    function marktCode(v) { var c = str(v).trim().toUpperCase(); return /^[A-Z0-9_-]{1,12}$/.test(c) ? c : ""; }
    function marktName(code) {
      var l = UC.getAllMarkets ? UC.getAllMarkets() : [];
      for (var i = 0; i < (l || []).length; i++) {
        var m = l[i];
        if (m && str(m.alpha2 || m.code).toUpperCase() === code && str(m.name).trim()) return str(m.name).trim() + " (" + code + ")";
      }
      return code;
    }
    function zeichneDetailHaendler(d) {
      var el = sek("dhaendler");
      if (!el) return;
      var platz = vorschauPlatz(el, "dhaendler", sekKopf("Merchants", "", "", "merchant"));
      if (!d) { platz.innerHTML = tabelleHtml(kopfAus("dhaendler"), skelettAus("dhaendler", 3)); spaltenAnwenden("dhaendler"); return; }
      var l = (isArr(d.merchants) ? d.merchants : []).filter(function (m) { return m && typeof m === "object"; });
      if (!l.length) { platz.innerHTML = '<div class="up-box">' + UC.leerHtml({ mini: true, titel: "No merchants were listed with this product." }) + '</div>'; return; }
      platz.innerHTML = tabelleHtml(kopfAus("dhaendler"), l.map(function (m) {
        var n = haendlerName(m.merchant_name), p = letzterPreis(m.latest_price), sp = preisSpanne(m.price_ranges);
        return '<div class="up-row ush-zeile"' + (n ? ' data-haendler="' + esc(n) + '" role="link" tabindex="0"' : '') + '>' +
          '<div class="up-td">' + haendlerHtml(n) + '</div>' +
          td("share", pctHtml(m.share)) +
          td("obs", ganzHtml(m.observations)) +
          td("price", p || sp ? '<span class="ush-zweizeilig"><span class="up-num">' + esc(p || sp) + '</span>' + (p && sp && sp !== p ? '<span class="ush-unter">' + esc(sp) + '</span>' : '') + '</span>' : '<span class="up-num is-empty">–</span>') +
        '</div>';
      }).join(""), "ush-klickbar");
      spaltenAnwenden("dhaendler");
    }
    function zeichneAuftritte() {
      var tab = sek("tabelle");
      if (!tab) return;
      var a = detailAnfrage(), d = daten(a);
      var ap = d && d.appearances && typeof d.appearances === "object" ? d.appearances : null;
      zaehlerSetzen(ap ? anzahlWert(ap.total_count) : null);
      var kopf = kopfAus("detail");
      if (!d) {
        if (fehlerVon(a)) { tabInhalt(""); pagerSetzen("detail", null); return; }
        if (vorige.auf && vorige.aufProdukt === state.produktId && vorige.aufFilter === filterSig()) { tabInhalt(vorige.auf, true); spaltenAnwenden("detail"); pagerSetzen("detail", vorige.aufTotal, true); return; }
        tabInhalt(tabelleHtml(kopf, skelettAus("detail", 5)));
        spaltenAnwenden("detail"); pagerSetzen("detail", null, true);
        return;
      }
      var rows = ap && isArr(ap.rows) ? ap.rows.filter(function (r) { return r && typeof r === "object"; }) : [];
      if (!rows.length) { tabInhalt('<div class="up-box">' + UC.leerHtml({ mini: true, titel: "No appearances in this range." }) + '</div>'); pagerSetzen("detail", 0); return; }
      var html = tabelleHtml(kopf, rows.map(function (r) {
        var topics = (isArr(r.topics) ? r.topics : []).map(function (x) { return str(x).trim(); }).filter(Boolean);
        /* null heisst Einzelkarte (Uebergabe 7.3); ein Wert, der keine Platzierung sein kann, ist
           keine Einzelkarte, sondern unbekannt. */
        var pos = posWert(r.position), posLeer = r.position == null || r.position === "";
        var preis = geld(r.price, r.currency) || str(r.price_str).trim().slice(0, 40);
        /* Nur eine Id, die eine sein kann, oeffnet den Drawer -- sonst fragt er mit Muell an und
           zeigt danach einen Fehler, den der Nutzer nicht verursacht hat. */
        var pr = str(r.prompt_run_id).trim();
        if (!/^[A-Za-z0-9_-]{6,80}$/.test(pr)) pr = "";
        return '<div class="up-row ush-zeile is-statisch">' +
          '<div class="up-td"><span class="up-num">' + esc(datum(r.run_at || r.day)) + '</span></div>' +
          td("model", r.model ? (UC.modelChip ? UC.modelChip(str(r.model)) : esc(str(r.model))) : '<span class="up-num is-empty">–</span>') +
          td("market", /^[A-Za-z]{2}$/.test(str(r.market).trim()) && UC.marketChip ? UC.marketChip(str(r.market).trim()) : (marktCode(r.market) ? esc(marktCode(r.market)) : '<span class="up-num is-empty">–</span>')) +
          /* Topics als der Chip aus core (06.10.: "ueberall die uebliche Topic-Darstellung"), Farbe und
             Emoji ueber den Namen aus dem Topic-Store; "+N" als der Chip ohne Punkt, die uebrigen
             Namen im Tooltip. */
          '<div class="up-td up-td-topic">' + (topics.length ? '<span class="ush-topics">' +
            (UC.topicChipHtml ? UC.topicChipHtml({ name: topics[0] }, { dunkel: isDark() }) : '<span class="ush-titel">' + esc(topics[0]) + '</span>') +
            (topics.length > 1 ? '<span class="up-topicchip is-static is-mehr" data-tip="' + esc(topics.slice(1).join(", ")) + '">+' + (topics.length - 1) + '</span>' : '') + '</span>' : '<span class="up-num is-empty">–</span>') + '</div>' +
          /* Die Platzierung EINER Antwort ist eine ganze Zahl (Platz 2 im Karussell), kein
             Durchschnitt -- "2.0" laese sich wie ein Mittelwert. Die Raute bleibt wie beim Rang. */
          td("position", pos != null ? '<span class="up-rank-group">' + HASH + '<span class="up-num">' + esc(ganz(pos)) + '</span></span>' : posLeer ? '<span class="ush-unter">' + esc(t("Single card")) + '</span>' : '<span class="up-num is-empty">–</span>') +
          td("price", preis ? '<span class="up-num">' + esc(preis) + '</span>' : '<span class="up-num is-empty">–</span>') +
          td("merchant", haendlerHtml(r.merchant_name)) +
          '<div class="up-td ush-td-aktion">' + (pr ? '<button type="button" class="up-btn-sec ush-antwort" data-antwort="' + esc(pr) + '" aria-label="' + esc(t("View Response")) + '"><span>' + esc(t("View Response")) + '</span>' + UC.icon("arrowUpRight", 2) + '</button>' : '') + '</div>' +
        '</div>';
      }).join(""), "ush-auftritte");
      vorige.auf = html; vorige.aufTotal = gesamt(ap.total_count, state.auftritte, rows.length); vorige.aufProdukt = state.produktId; vorige.aufFilter = filterSig();
      zaehlerSetzen(vorige.aufTotal);
      tabInhalt(html);
      spaltenAnwenden("detail");
      pagerSetzen("detail", vorige.aufTotal);
    }

    /* ---- Klicks ---------------------------------------------------------------------------------- */
    root.addEventListener("click", function (e) {
      var z = e.target.closest && e.target;
      if (!z) return;
      if (z.closest(".ush-filterzeile, .up-ph-nav, .up-ph-top")) return;
      var nm = z.closest("[data-ush-nochmal]");
      if (nm) { nochmal(nm.getAttribute("data-ush-nochmal")); return; }
      if (z.closest("[data-ush-alleweg]")) { alleFilterZuruecksetzen(); return; }
      if (z.closest("[data-ush-prodweg]")) {
        state.products.suche = ""; state.products.seg = "all"; state.products.marke = null; state.products.haendler = null; state.products.page = 1;
        var inp = elMain.querySelector(".ush-suche .up-search-input"); if (inp) inp.value = "";
        if (filterAktiv()) alleFilterZuruecksetzen();
        persist(); geruest = null; zeichnen(); bedarf(); return;
      }
      if (z.closest("[data-ush-markeweg]") || z.closest("[data-ush-meweg]")) {
        var tb = state.seite === "brands" ? state.brands : state.merchants;
        tb.suche = ""; tb.page = 1;
        if (filterAktiv()) alleFilterZuruecksetzen();
        persist(); geruest = null; zeichnen(); bedarf(); return;
      }
      var gb = z.closest(".ush-galerie-knopf[data-bild]");
      if (gb) {
        /* Ist das Hauptbild nicht geladen (onerror hat es entfernt), bekommt die Flaeche ein neues --
           sonst taete der Klick auf ein funktionierendes Vorschaubild nichts. */
        var hf = elMain.querySelector(".ush-hero-bild"), hb = hf && hf.querySelector("img");
        if (hf && !hb) {
          hb = document.createElement("img");
          hb.alt = ""; hb.referrerPolicy = "no-referrer";
          hb.onerror = function () { hf.classList.remove("has-img"); hb.remove(); };
          hf.appendChild(hb);
        }
        if (hb) { hb.src = gb.getAttribute("data-bild"); hf.classList.add("has-img"); }
        var alle = elMain.querySelectorAll(".ush-galerie-knopf");
        for (var i = 0; i < alle.length; i++) alle[i].classList.toggle("is-on", alle[i] === gb);
        return;
      }
      var kp = z.closest(".ush-kar-pfeil[data-kar]");
      if (kp) {
        var lst = kp.parentNode.querySelector(".ush-galerie-leiste");
        /* Vier Vorschaubilder je Schritt (40 breit, 8 Abstand) -- so viele stehen ganz in der Reihe. */
        if (lst) {
          var ziel = Math.max(0, Math.min(lst.scrollWidth - lst.clientWidth, lst.scrollLeft + Number(kp.getAttribute("data-kar")) * 192));
          try { lst.scrollTo({ left: ziel, behavior: "smooth" }); } catch (e2) { lst.scrollLeft = ziel; }
          karussellPruefen(kp.closest('[data-sek="hero"]') || elMain, ziel);
        }
        return;
      }
      var mk = z.closest("[data-ush-ziel]");
      if (mk) { seiteOeffnen(mk.getAttribute("data-ush-ziel"), true, mk.getAttribute("data-ush-ziel") === "products" ? { marke: null, haendler: null } : null); return; }
      var an = z.closest("[data-antwort]");
      if (an) { if (UC.drawerOeffnen) UC.drawerOeffnen("response", an.getAttribute("data-antwort"), "shopping"); return; }
      var tp = z.closest(".ush-topprodukt[data-produkt]");
      if (tp) { produktOeffnen(tp.getAttribute("data-produkt")); return; }
      var zeile = z.closest(".up-row.ush-zeile");
      if (zeile) zeileOeffnen(zeile);
    });
    root.addEventListener("keydown", function (e) {
      if (e.key !== "Enter" && e.key !== " ") return;
      var zeile = e.target && e.target.closest && e.target.closest(".up-row.ush-zeile[role='link']");
      if (zeile && e.target === zeile) { e.preventDefault(); zeileOeffnen(zeile); }
    });
    /* Eine Zeile oeffnet, was sie zeigt: ein Produkt sein Detail, eine Marke ihre Produkte, ein
       Haendler die Produkte, die er fuehrt (Entwurf). "Andere" ist nicht klickbar. */
    function zeileOeffnen(zeile) {
      if (zeile.hasAttribute("data-produkt")) { produktOeffnen(zeile.getAttribute("data-produkt")); return; }
      if (zeile.hasAttribute("data-marke")) {
        seiteOeffnen("products", true, { marke: { id: zeile.getAttribute("data-marke"), name: zeile.getAttribute("data-marke-name") || "" }, haendler: null, seg: "all" });
        return;
      }
      if (zeile.hasAttribute("data-haendler")) seiteOeffnen("products", true, { haendler: zeile.getAttribute("data-haendler"), marke: null, seg: "all" });
    }

    /* ---- Spaltengriff ------------------------------------------------------------------------
       Der Griff gehoert zu dem Kit, an dessen Wurzel er steht (spaltenFuer haengt es dort an). */
    var ziehtNoch = false;
    root.addEventListener("pointerdown", function (e) {
      var g = e.target && e.target.closest && e.target.closest(".up-grip");
      if (!g) return;
      for (var n = g; n && n !== root.parentNode; n = n.parentNode) {
        if (n.__ushSpalten) {
          e.stopPropagation();
          ziehtNoch = true;
          document.addEventListener("pointerup", function () { setTimeout(function () { ziehtNoch = false; }, 0); }, { once: true });
          n.__ushSpalten.kit.startResize(e);
          return;
        }
      }
    });

    /* ---- Sichtbarkeit, Groesse, Format -------------------------------------------------------- */
    if (UC.onViewChange) UC.onViewChange(function (name) {
      if (name === "shopping" && root.isConnected) setTimeout(function () { adresseAnwenden(); if (filterAbgleichen()) filterGeaendert(); else { zeichnen(); bedarf(); } }, 0);
    });
    /* Die Farbskala wechselt im Einstellungsfenster -- jedes Linienchart der App zeichnet dann neu
       (brands-overview, visibility-chart), dieses auch. */
    window.addEventListener("up-colorscale-change", function () {
      if (root.isConnected === false || !linie || state.seite === "detail") return;
      zeichneChart();
    });
    if (UC.onResize) UC.onResize(root, function () {
      Object.keys(sucheKit).forEach(function (k) { try { if (sucheKit[k] && sucheKit[k].syncTakeover) sucheKit[k].syncTakeover(); } catch (e) {} });
      Object.keys(spalten).forEach(function (k) { try { spalten[k].kit.applyCols(); } catch (e) {} });
      if (sichtbar()) bedarf();
    });

    /* ---- Setter -------------------------------------------------------------------------------- */
    var ctrl = {
      setOverview: function (raw, f) { return antwort("overview", raw, f); },
      setProducts: function (raw, f) { return antwort("products", raw, f); },
      setDetail: function (raw, f) { return antwort("detail", raw, f); },
      setMerchants: function (raw, f) { return antwort("merchants", raw, f); },
      reset: function () {
        state.cache = { overview: {}, products: {}, detail: {}, merchants: {} };
        state.reihe = { overview: [], products: [], detail: [], merchants: [] };
        state.fehler = {};
        Object.keys(unterwegs).forEach(function (k) { if (unterwegs[k]) clearTimeout(unterwegs[k].uhr); unterwegs[k] = null; });
        vorige = {};
        persist(); geruest = null; zeichnen(); bedarf();
        return true;
      },
      redraw: function () { geruest = null; zeichnen(); },
      state: state, root: root, oeffnen: produktOeffnen, seite: seiteOeffnen
    };
    root.__ushController = ctrl;

    /* ?shop und ?product gehoeren der Shopping-Ansicht (06.10., wie ?event in den Events):
       ausserhalb nicht in der Adresse, zurueck wieder da, nach einem Teamwechsel die Overview. */
    if (UC.ansichtsParameter && !ohneAdresse) UC.ansichtsParameter({ ansicht: "shopping", schluessel: ["shop", "product"], owner: root,
      onTeamWechsel: function () { if (state.seite !== "overview") seiteOeffnen("overview", false); } });
    /* Erster Stand: die Adresse entscheidet. */
    var a0 = adresseLesen();
    state.seite = a0.seite; state.produktId = a0.produktId;
    if (nav && nav.selectPage) nav.selectPage(a0.seite === "detail" ? "products" : a0.seite, false);
    zeichnen();
    krumenNeu();
    setTimeout(function () { filterAbgleichen(); zeichnen(); bedarf(); }, 0);
    return ctrl;
  }

  /* ---- Mount und oeffentliche Setter ------------------------------------------------------------ */
  var mount;
  mount = UC.makeMount({
    onMount: function (m) { mount = m; },
    rootClass: "ush-root", notPortal: true,
    ctrlProp: "__ushController",
    resolveLocal: "__ushResolveLocal",
    queue: "__ushBootQueue",
    initRoot: initRoot,
    redraw: function (c) { if (c && c.redraw) c.redraw(); },
    api: {
      /* (instanz, json, fehler): json ist das Feld json des Umschlags, fehler Bubbles "error body".
         Mit zwei Werten wie bisher. */
      setShoppingOverview:      function (id, p, f) { return jede(id, function (c) { c.setOverview(p, f); }, "setShoppingOverview"); },
      setShoppingProducts:      function (id, p, f) { return jede(id, function (c) { c.setProducts(p, f); }, "setShoppingProducts"); },
      setShoppingProductDetail: function (id, p, f) { return jede(id, function (c) { c.setDetail(p, f); }, "setShoppingProductDetail"); },
      setShoppingMerchants:     function (id, p, f) { return jede(id, function (c) { c.setMerchants(p, f); }, "setShoppingMerchants"); },
      resetShopping:            function (id) { return jede(id, function (c) { c.reset(); }, "resetShopping"); }
    }
  });
  /* Ein Setter ohne passende Wurzel sagt es einmal in der Konsole: sonst faellt die Antwort
     still weg (falsche Instanz im Run-JS-Schritt, Element nicht auf der Seite). */
  var ohneWurzel = {};
  function jede(id, fn, wer) {
    var roots = mount.rootsWithId(String(id == null ? "default" : id).trim());
    if (!roots.length) {
      var k = String(wer) + "|" + String(id);
      if (!ohneWurzel[k] && window.console) { ohneWurzel[k] = true; console.warn("[shopping] " + wer + '("' + id + '"): kein Shopping-Element mit dieser data-instance auf der Seite.'); }
      return false;
    }
    roots.forEach(function (r) { var c = initRoot(r); if (c) fn(c); });
    return true;
  }
  if (UC.watchRoots) UC.watchRoots("ush-root", function () {
    [].forEach.call(document.querySelectorAll(".ush-root"), function (r) { if (!UC.messbar || UC.messbar(r)) initRoot(r); });
  });
  }

  ushBoot(30);
})();
