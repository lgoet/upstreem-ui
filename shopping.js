/* upstreem shopping.js -- Shopping (Beta): wie Marken, Produkte und Haendler in den Shopping-
   Ergebnissen der KI-Antworten erscheinen (04.10.). Praefix ush.

   VIER SEITEN UND EIN DETAIL in EINER Komponente, wie Events: Kopf mit Krumen und Reitern,
   Kalender und Filter stehen IN der Komponente (lokale Instanzen, data-local) -- ihre Auswahl
   verlaesst die Seite nicht, sie kommt als DOM-Ereignis hierher.
     ?view=shopping                                  Overview
     ?view=shopping&shop=products|brands|merchants   die Reiter
     ?view=shopping&shop=products&product=<id>       Product Detail (der Reiter Products bleibt an)
   Die Adresse fuehrt (pushState), Zurueck im Browser fuehrt zurueck.

   DATENWEGE (seit 13.10., Vertrag bubble/vor_nextjs_13_10/VOR_NEXTJS_V1_VERTRAG.md, Abschnitt 1):
   die Komponente laedt SELBST ueber UC.rpc (PostgREST, Login des Nutzers) -- kein Bubble-Workflow,
   kein Run-JS-Schritt, kein Umschlag {json}. Vier RPCs, Parameter wie v1, Antwort reines JSON:
     cached_shopping_overview_v2        Overview UND Brands (Brands blaettert ueber p_brand_*)
     cached_shopping_products_v2
     cached_shopping_product_detail_v2  (p_source_product_id als Text)
     cached_shopping_merchants_v2
   Fehler kommen als HTTP-Fehler mit dem Code in message (shopping_invalid_param,
   shopping_invalid_date, shopping_product_not_found, shopping_rate_limited, forbidden,
   team_access_*); jeder beendet das Laden und steht als Fehlerzustand im Inhalt. Ein 402
   team_access_* zeigt core selbst als Gate.
   RUECKWEG: Gibt es eine v2 noch nicht (404 PGRST202, SQL nicht eingespielt), laedt DIESER Kanal
   bis zum Neuladen wie vorher ueber Bubble: Ereignis mit dem fertigen v1-Body als Text, Antwort
   ueber den Setter (json des Umschlags, Fehler-Body):
     shopOverview       cached_shopping_overview_v1        setShoppingOverview(id, json, fehler)
     shopProducts       cached_shopping_products_v1        setShoppingProducts(id, json, fehler)
     shopProductDetail  cached_shopping_product_detail_v1  setShoppingProductDetail(id, json, fehler)
     shopMerchants      cached_shopping_merchants_v1       setShoppingMerchants(id, json, fehler)
   Die Setter bleiben auch sonst (Vertrag: nie entfernen) -- die Landingpage fuellt ueber sie, und
   dort (data-adresse="aus") geht nie eine direkte Anfrage hinaus: die fremde Seite hat kein Login.
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
  /* Intent-Filter der App (13.10., core: UC.intentFilterParams). Leer, solange die Intents nicht
     freigegeben sind -- dann geht kein neuer Parameter hinaus. */
  function intentDazu(o) {
    var U = window.UpstreemCore, x = U && U.intentFilterParams ? U.intentFilterParams() : {};
    for (var k in x) if (Object.prototype.hasOwnProperty.call(x, k)) o[k] = x[k];
    return o;
  }
  var UC = window.UpstreemCore;
  var esc = UC.esc, t = UC.t || function (x) { return x; };
  var STORE = (window.__ushStore = window.__ushStore || {});
  /* Kanaele, deren v2 es nicht gibt (13.10., 404 PGRST202): fuer das ganze Seitenleben, ueber
     Bubbles Neuaufbau hinweg -- sonst ginge jede Anfrage erst gegen die fehlende Funktion, und
     jede Seite laedt einen Umweg langsamer. Neu versucht wird erst nach einem Neuladen. */
  var OHNE_V2 = (window.__ushOhneV2 = window.__ushOhneV2 || {});

  /* ---- Kleine Helfer ------------------------------------------------------------------------ */
  function isArr(v) { return Object.prototype.toString.call(v) === "[object Array]"; }
  function num(v) { if (v == null || v === "" || typeof v === "boolean") return null; var n = Number(v); return isFinite(n) ? n : null; }
  /* Ein Objekt oder eine Liste ist kein Text: ohne das stuende "[object Object]" als Titel da, wenn
     eine Zeile statt eines Namens ein Objekt traegt. */
  function str(v) { return v == null || typeof v === "object" ? "" : String(v); }
  function ersetze(s, o) { return String(s).replace(/\{(\w+)\}/g, function (_, k) { return o[k] != null ? o[k] : ""; }); }
  /* Ein Objekt aus Bubble-Text: UC.bubbleObjekt (core, seit 05.10. -- hier stand bis zum 06.10. eine
     Kopie davon). Es packt den Umschlag {"json": "..."} aus, nimmt aus einer Liste das erste
     Element, und die Produkt-Ids (groesser als Number.MAX_SAFE_INTEGER, Uebergabe 4) werden VOR
     dem Lesen zu Text -- sonst waeren sie still eine andere Id. */
  function objekt(raw) { return UC.bubbleObjekt ? UC.bubbleObjekt(raw, { grosseIds: ["source_product_id"] }) : null; }
  /* Der dritte Wert der Setter: Bubbles "error body" -- UC.bubbleFehler gibt den Code daraus oder ""
     fuer KEIN Fehler. Er zaehlt NUR, wenn keine lesbare Antwort da ist: eine gelungene RPC braucht
     keinen Fehler-Wert, und was Bubble bei Erfolg dort hinschreibt (oder ein vergessener
     Platzhalter), darf eine richtige Antwort nie verdraengen (Events, 04.10.). */
  function fehlerCode(f) { return UC.bubbleFehler ? UC.bubbleFehler(f) : str(f).trim(); }
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
  /* Der Export-Knopf der Leisten: dasselbe Markup wie in Prompt Insights und den Tabellen
     (.up-export aus core, Feather "download"). Nicht UC.icon("download") -- das ist ein anderes
     Zeichen, und der Knopf soll auf jeder Seite gleich aussehen. */
  function exportKnopfHtml() {
    return '<button class="up-export ush-export" type="button" aria-label="' + esc(t("Export")) + '"><svg viewBox="0 0 24 24" aria-hidden="true">' +
      '<path d="M12 15V3" /><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 10 5 5 5-5" /></svg>' +
      '<span>' + esc(t("Export")) + '</span></button>';
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
  function deltaWert(art, d) { d = num(d); var g = art === "pos" ? 1000 : art === "anzahl" ? 1e15 : 100.5; return d == null || Math.abs(d) > g ? null : d; }
  /* Die Kennzahl einer Chart-Reihe nach ihrem Feldnamen. */
  /* Nur avg_position und brand_avg_position sind Plaetze. Hier stand /position/ -- das traf auch
     first_position_rate, einen ANTEIL: dessen 0 Prozent fiel unter die Platzgrenze (0,95) und
     wurde "kein Wert". Solange das Chart null als 0 zeichnete, fiel das nicht auf; seit null null
     bleibt (13.10.), verschwanden damit alle Marken ohne ersten Platz aus dem Chart. */
  function metrikWert(feld, v) { return /avg_position$/.test(feld) ? posWert(v) : feld === "observations" ? anzahlWert(v) : anteilWert(v); }
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
  /* Ein Preis: UC.fmtGeld (core, aus dieser Datei dorthin gezogen, 05.10.) -- mit denselben Grenzen
     wie die Kopie, die hier stand: "" fuer alles, was kein Preis sein kann (negativ, ab einer
     Billion), dann zeigt der Aufrufer price_str. */
  function geld(v, c) { return UC.fmtGeld ? UC.fmtGeld(v, c) : ""; }
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
    "Shopping": "Shopping", "Beta": "Beta", "Merchant": "Händler", "Segment": "Segment",
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
    /* Die Saetze in den Erklaerkarten der Kacheln (22.10. abends, vorher Fusszeilen darunter, siehe kachelKarte). */
    "No comparison period available.": "Kein Vergleichszeitraum verfügbar.", "Change compared with {period}.": "Veränderung im Vergleich zu {period}.",
    "No products matched your brand": "Kein Produkt ließ sich deiner Marke zuordnen",
    "Products without a tracked brand": "Produkte ohne getrackte Marke",
    "{n} merchant": "{n} Händler", "{n} merchants": "{n} Händler", "{n} other merchants": "{n} weitere Händler",
    "Unknown": "Unbekannt", "Search products…": "Produkte durchsuchen…",
    "Search products": "Produkte durchsuchen",
    "Search merchants": "Händler durchsuchen", "Filter by {brand}": "Nach {brand} filtern", "Previous images": "Vorherige Bilder", "Next images": "Nächste Bilder",
    "No matching products": "Keine passenden Produkte", "No matching brands": "Keine passenden Marken", "No matching merchants": "Keine passenden Händler",
    "Clear search and filters": "Suche und Filter zurücksetzen",
    "Brands observed": "Beobachtete Marken",
    "Your rank": "Dein Rang", "#{rank} of {n} by Share of Shelf.": "#{rank} von {n} nach Share of Shelf.", "Your Share of Shelf": "Dein Share of Shelf",
    "Top competitor": "Stärkster Wettbewerber",
    "Brand Performance": "Markenperformance", "How the top brands develop in AI shopping results": "Wie sich die stärksten Marken in KI-Shopping-Ergebnissen entwickeln",
    "Merchants observed": "Beobachtete Händler", "Across {n} products.": "Über {n} Produkte.", "Top merchant": "Stärkster Händler",
    "Top merchant share": "Anteil des stärksten Händlers",
    "{n} of {total} merchant mentions.": "{n} von {total} Händlernennungen.", "Merchant Share": "Händleranteil",
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
    "Position 1 sits at the top of the chart.": "Position 1 steht oben im Diagramm.",
    "{brand} presence": "Presence von {brand}", "{brand} avg. position": "Ø Position von {brand}",
    "Image": "Bild",
    "No brands yet": "Noch keine Marken", "No products yet": "Noch keine Produkte",
    "Largest Visibility changes": "Größte Visibility-Änderungen",
    "No product title, listing or brand contains \u201c{q}\u201d.": "Kein Produkttitel, Listing oder Markenname enthält \u201e{q}\u201c.",
    "No observed products match these filters.": "Keine beobachteten Produkte passen zu diesen Filtern.",
    "No observed products of {brand} match these filters.": "Keine beobachteten Produkte von {brand} passen zu diesen Filtern.",
    "No observed products were listed with {merchant} in these filters.": "In diesen Filtern war kein beobachtetes Produkt bei {merchant} gelistet.",
    "No observed products of {brand} were listed with {merchant} in these filters.": "In diesen Filtern war kein beobachtetes Produkt von {brand} bei {merchant} gelistet.",
    "No AI Shopping products observed": "Keine KI-Shopping-Produkte beobachtet",
    "None of the AI responses in this range showed shopping products.": "Keine KI-Antwort in diesem Zeitraum hat Shopping-Produkte gezeigt.",
    "No tracked brand appeared in AI shopping results in this range.": "In diesem Zeitraum kam keine getrackte Marke in KI-Shopping-Ergebnissen vor.",
    "No {metric} values in this range.": "Keine Werte für {metric} in diesem Zeitraum.",
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
    "Your products appeared in {presence} of these results.": "Deine Produkte erschienen in {presence} dieser Ergebnisse.",
    /* Die Berechnungen der Gesamtzeilen (15.10. spaet). "Average", "Total", "Median" und ihre
       kurzen Formen stehen in core. "Range"/"range" gleichlautend in responses-table.js, "yours" in
       urls-table.js, "Top 3 share"/"top 3" in ads.js -- die laden in anderen Ansichten, ohne diese
       Datei; gehoeren nach core. */
    "Range": "Spanne", "range": "Spanne", "Merchants used": "Genutzte Händler", "merchants": "Händler",
    "Your share": "Eigener Anteil", "yours": "eigene", "Top 3 share": "Anteil der Top 3", "top 3": "Top 3",
    "Rising / falling": "Steigend / fallend", "rising / falling": "steigend / fallend"
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
    /* JE ORT DER RICHTIGE SATZ (22.10., Pruefung aller Erklaerkarten nach Lukas' Meldung zu Merchants im Detail): in den
       Tabellen der Marken (Brand Landscape, Brands) ist jede Zeile EINE Marke -- dort sagten Share of Shelf und Presence
       "your products", Observations "the product". In den Haendlertabellen ist jede Zeile ein Haendler, in Recent
       Appearances ein einzelner Auftritt (eine Position, ein Preis, kein Durchschnitt und keine Spanne). Die Werte selbst
       sind dieselben Felder wie vorher; anders ist nur, wovon der Satz spricht. */
    shareBrand: { h: "Share of Shelf", f: "Product observations of the brand ÷ all product observations",
      t: "The brand's part of all product placements observed in shopping results. A product shown twice in one response counts once." },
    presenceBrand: { h: "Presence", f: "Responses with at least one product of the brand ÷ shopping responses",
      t: "How often at least one of the brand's products appeared when an AI response showed shopping products." },
    obsBrand: { h: "Observations", f: "Count of product observations of the brand",
      t: "The number of times a product of the brand was seen, each product counted once per AI response. A count, not a rate." },
    obsMerchant: { h: "Observations", f: "Count of product observations with this merchant",
      t: "The number of times a product was seen listed with this merchant, each product counted once per AI response. A count, not a rate." },
    posMerchant: { h: "Avg. Product Position", f: "Average of observed positions (1 = first)",
      t: "The average place of the products listed with this merchant in shopping results, counting from 1. Lower is better." },
    merchantProd: { h: "Share", f: "Mentions of this merchant ÷ all merchant mentions of this product",
      t: "How often this merchant was listed with this product. This shows presence in AI results, not sales or conversions." },
    obsMerchantProd: { h: "Observations", f: "Count of observations of this product with this merchant",
      t: "The number of AI responses in which this product was listed with this merchant. A count, not a rate." },
    posTreffer: { h: "Position", f: "1 = first. Single card: the product was shown on its own",
      t: "The place of the product in this shopping result, counting from 1. Lower is better." },
    priceTreffer: { h: "Price", f: "As shown in this response",
      t: "The price shown next to the product in this AI response. Not a live shop price." },
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
    "The top merchant's part of all merchant mentions on observed products.": "Der Anteil des stärksten Händlers an allen Händlernennungen bei beobachteten Produkten.",
    "Product observations of the brand ÷ all product observations": "Produktbeobachtungen der Marke ÷ alle Produktbeobachtungen",
    "The brand's part of all product placements observed in shopping results. A product shown twice in one response counts once.": "Der Anteil der Marke an allen beobachteten Produktplatzierungen in Shopping-Ergebnissen. Ein Produkt, das in einer Antwort zweimal erscheint, zählt einmal.",
    "Responses with at least one product of the brand ÷ shopping responses": "Antworten mit mindestens einem Produkt der Marke ÷ Shopping-Antworten",
    "How often at least one of the brand's products appeared when an AI response showed shopping products.": "Wie oft mindestens ein Produkt der Marke erschien, wenn eine KI-Antwort Shopping-Produkte zeigte.",
    "Count of product observations of the brand": "Anzahl der Produktbeobachtungen der Marke",
    "The number of times a product of the brand was seen, each product counted once per AI response. A count, not a rate.": "Wie oft ein Produkt der Marke gesehen wurde, jedes Produkt einmal je KI-Antwort. Eine Anzahl, keine Rate.",
    "Count of product observations with this merchant": "Anzahl der Produktbeobachtungen mit diesem Händler",
    "The number of times a product was seen listed with this merchant, each product counted once per AI response. A count, not a rate.": "Wie oft ein Produkt mit diesem Händler gelistet gesehen wurde, jedes Produkt einmal je KI-Antwort. Eine Anzahl, keine Rate.",
    "The average place of the products listed with this merchant in shopping results, counting from 1. Lower is better.": "Der durchschnittliche Platz der Produkte, die mit diesem Händler gelistet waren, gezählt ab 1. Kleiner ist besser.",
    "Mentions of this merchant ÷ all merchant mentions of this product": "Nennungen dieses Händlers ÷ alle Händlernennungen dieses Produkts",
    "How often this merchant was listed with this product. This shows presence in AI results, not sales or conversions.": "Wie oft dieser Händler mit diesem Produkt gelistet war. Das zeigt Präsenz in KI-Ergebnissen, keine Verkäufe oder Conversions.",
    "Count of observations of this product with this merchant": "Anzahl der Beobachtungen dieses Produkts mit diesem Händler",
    "The number of AI responses in which this product was listed with this merchant. A count, not a rate.": "Die Zahl der KI-Antworten, in denen dieses Produkt mit diesem Händler gelistet war. Eine Anzahl, keine Rate.",
    "1 = first. Single card: the product was shown on its own": "1 = erste. Einzelkarte: das Produkt stand allein",
    "The place of the product in this shopping result, counting from 1. Lower is better.": "Der Platz des Produkts in diesem Shopping-Ergebnis, gezählt ab 1. Kleiner ist besser.",
    "As shown in this response": "So, wie er in dieser Antwort stand",
    "The price shown next to the product in this AI response. Not a live shop price.": "Der Preis, der in dieser KI-Antwort neben dem Produkt stand. Kein aktueller Shop-Preis."
  });

  /* Stabile Fehlercodes (Uebergabe 9) -> was der Nutzer tun kann. Alles andere: der allgemeine Satz. */
  var FEHLER = {
    shopping_invalid_date: "The date range is not valid.",
    shopping_product_not_found: "This product was not found.",
    shopping_rate_limited: "Too many requests. Please wait a moment.",
    zeit: "This is taking longer than expected. Please try again.",
    range_13m: "The date range is too long. Choose a range of up to 13 months.",
    filter_gone: "A selected filter no longer exists. Clear the filters and try again."
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
    /* Ohne balkenGrau (nur ein aelteres core; das heutige fuehrt es immer) die Schrift der Wurzel aus
       core statt eines festen Werts (17.10.). */
    function grau(i) { return UC.balkenGrau ? UC.balkenGrau(i, isDark()) : getComputedStyle(root).getPropertyValue("--vc-text").trim(); }
    if (isDark()) root.setAttribute("data-theme", "dark"); else root.removeAttribute("data-theme");
    var tooltips = UC.makeTooltips ? UC.makeTooltips(root, isDark) : null;
    /* Der gekuerzte Prompt zeigt nach kurzer Verweildauer seinen ganzen Text, wie in der Responses-Tabelle. */
    if (tooltips && UC.makeClipTip) UC.makeClipTip(root, tooltips, ".ush-td-prompt", ".ush-prompt-text");

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
                  topMerchant: ["Amazon.de", ""], topMerchantShare: ["25.7%", ""],
                  shareBrand: ["31.9%", ""], presenceBrand: ["84.7%", ""], obsBrand: ["77", ""], obsMerchant: ["62", ""],
                  merchantProd: ["63.0%", ""], obsMerchantProd: ["17", ""], priceTreffer: ["€14.99", ""] }[key];
      if (key === "pos" || key === "posMerchant") return '<span class="up-explain-row">' + HASH_ERKL + '<span>2.0</span></span>';
      /* Ein einzelner Auftritt steht ganzzahlig in der Zelle ("# 2"), nicht als Durchschnitt. */
      if (key === "posTreffer") return '<span class="up-explain-row">' + HASH_ERKL + '<span>2</span></span>';
      if (!bsp) return "";
      return '<span class="up-explain-row">' + esc(bsp[0]) + (bsp[1] ? hoch + '<span class="up-explain-up">' + esc(bsp[1]) + '</span>' : '') + '</span>';
    }
    /* TITEL = DAS ETIKETT AM ORT (22.10.; Format der Erklaerkarten: "Titel = das Label der Kachel/Spalte"). Gemessen
       standen sechs Karten unter einem anderen Namen als ihr Ort: "Observed price" an der Spalte Price, "Brand Presence"
       an Presence, "Avg. Position" an Avg. Product Position und Position, "Merchant Share" an Share und an Merchant
       Distribution, "Share of Shelf" an Your Share of Shelf. Der Titel kommt darum aus dem Etikett, an dem das Zeichen
       steht (Spaltenkopf, Kachel, Abschnitt, Faktenzeile) -- eine Regel aus dem Aufbau statt einer Liste je Ort. h im
       Eintrag bleibt der Rueckfall fuer ein Zeichen ohne Etikett. */
    function ortEtikett(z) {
      if (!z || !z.closest) return "";
      var th = z.closest(".up-th"), el = th ? th.querySelector(".up-th-txt") : z.closest(".up-kpi-label, .up-sec-h, dt");
      return el ? str(el.textContent).trim() : "";
    }
    /* DIE ZEILE UNTER DER KACHEL STEHT IN IHRER KARTE (22.10. abends, Lukas: "tooltips wie ueberall: nicht einfach on hover auf
       die card sondern in einem i icon"). Was als Fusszeile unter einer Kachel erklaerte, wovon die Zahl spricht ("of 31 by Share
       of Shelf", "vs. 9 Oct - 15 Oct", "Across 120 products"), steht jetzt als letzter Satz in der Erklaerkarte hinter ihrem
       Info-Zeichen -- wie "92.9% of tracked prompts" an "Prompts with Ads" in ads.js. Die Kacheln tragen das Zeichen aus core
       (kpiKarte explain: oben rechts, sichtbar beim Ueberfahren der Kachel), nicht mehr hinter dem Wort. kpiHtml legt dafuer je
       Schluessel ab, was die Karte DIESER Kachel zusaetzlich zeigt: satz (eine Funktion, uebersetzt erst beim Oeffnen) und wert
       (die Zahl der Kachel fuer die Platte, nur wo der Satz sie wiederholt oder aus ihr rechnet -- eine Beispielzahl neben dem
       echten "#3 of 31" saehe aus wie ein Widerspruch, dieselbe Ueberlegung wie in ads.js). Je Reiter steht nur eine Reihe
       Kacheln; jede zeichnende Funktion faengt mit kachelnNeu() an. Nur an Zeichen IN einer Kachel: dieselben Schluessel an
       Spaltenkoepfen ("share") bleiben ohne Zusatz. */
    var kachelKarte = {};
    function kachelnNeu() { kachelKarte = {}; }
    /* DAS DIAGRAMM ERKLAERT SEINE GEWAEHLTE KENNZAHL (22.10. abends): "Lower is better: position 1 sits at the top of the
       chart." stand als Zeile ueber dem Diagramm (.ush-chartnote), nur bei Avg. Position -- sie sprang beim Umschalten herein
       und heraus. Jetzt traegt der Kopf mit dem Umschalter das Info-Zeichen (sekKopf, Schluessel "chart"), und die Karte
       erklaert die Kennzahl, die das Diagramm gerade zeigt: Platte, Titel = Etikett des gewaehlten Knopfs, Satz und Formel aus
       ERKLAER; bei Avg. Position dazu der Satz ueber die umgedrehte Achse (ohne "Lower is better:" davor -- das sagt der Satz der
       Kennzahl schon, die Karte sagte es sonst zweimal). Alles beim Oeffnen gebaut, also immer die Kennzahl
       von jetzt. Overview und Brands zeigen je Marke eine Linie, darum dort die Marken-Fassung der Saetze. */
    var DIAGRAMM_ERKL = {
      overview: { presence: "presenceBrand", share_of_shelf: "shareBrand", avg_position: "pos", first_position_rate: "firstBrand" },
      brands: { presence: "presenceBrand", share_of_shelf: "shareBrand", avg_position: "pos", first_position_rate: "firstBrand" },
      detail: { visibility: "vis", avg_position: "pos", observations: "obs" }
    };
    function diagrammKarte() {
      var m = metrikJetzt(), key = (DIAGRAMM_ERKL[state.seite] || {})[m], e = key && ERKLAER[key];
      if (!e) return "";
      var vis = erklaerVorschau(key);
      return (vis ? '<div class="up-explain-vis">' + vis + '</div>' : '') +
        '<div class="up-explain-h">' + esc(t(metrikLabel()) || t(e.h)) + '</div><div class="up-explain-t">' + esc(t(e.t)) + '</div>' +
        '<div class="up-explain-t">' + esc(t(e.f)) + '</div>' +
        (m === "avg_position" ? '<div class="up-explain-t">' + esc(t("Position 1 sits at the top of the chart.")) + '</div>' : '');
    }
    if (UC.makeExplain) UC.makeExplain({ root: root, triggerSel: ".ush-erklaer, .ush-kpi .up-th-info[data-explain]", getIsDark: isDark,
      html: function (key, ausloeser) {
        if (key === "chart") return diagrammKarte();
        var e = ERKLAER[key];
        if (!e) return "";
        var kk = ausloeser && ausloeser.closest && ausloeser.closest(".ush-kpi") ? kachelKarte[key] : null;
        var vis = kk && kk.wert ? '<span class="up-explain-row">' + esc(kk.wert) + '</span>' : erklaerVorschau(key);
        var satz = kk && kk.satz ? kk.satz() : "";
        return (vis ? '<div class="up-explain-vis">' + vis + '</div>' : '') +
          '<div class="up-explain-h">' + esc(ortEtikett(ausloeser) || t(e.h)) + '</div><div class="up-explain-t">' + esc(t(e.t)) + '</div>' +
          '<div class="up-explain-t">' + esc(t(e.f)) + '</div>' + (satz ? '<div class="up-explain-t">' + esc(satz) + '</div>' : '');
      } });
    function info(key) {
      return '<span class="up-th-info ush-erklaer" data-explain="' + esc(key) + '">' + UC.icon("info", 2) + '</span>';
    }

    /* ---- Gerueste: Kopf, Reiter, Filterzeile, Inhalt ----------------------------------------- */
    root.classList.add("up-sidebar-clear");
    var idDaten = instanceId + "_dates", idFilter = instanceId + "_filters", idModelle = instanceId + "_models",
        idMaerkte = instanceId + "_markets", idTopics = instanceId + "_topics";
    /* DIE FILTER DER PRODUKTTABELLE IM MENUE "Filters" (15.10., wie Prompt Insights): Segment, Marke
       und Haendler aendern die DATEN der Tabelle und stehen darum nicht mehr als Knoepfe in ihrer
       Werkzeugleiste, sondern als Zeilen im Menue der Filterzeile -- gebaut weiter unten ueber
       UC.makeLeistenFilter (Eintraege shsegment/shbrand/shmerchant in filters/filter-bar.js). Die
       grosse Form (data-form="gross"): Name und Wert je Zeile, die Chips oeffnen ihr Untermenue.
       Sichtbar nur auf dem Reiter Products (leisteStellen), ausgeblendet heisst NICHT geleert. */
    var ID_FF = { shsegment: instanceId + "_shsegment", shbrand: instanceId + "_shbrand", shmerchant: instanceId + "_shmerchant" };
    root.innerHTML =
      '<div class="up-ph-top ush-pagehead">' +
        '<div class="up-ph-left"><h1 class="up-ph-heading">' + esc(t("Shopping")) + '</h1>' +
          '<p class="up-ph-desc">' + esc(t("How your brand and competitors appear in AI shopping results")) + '</p></div>' +
      '</div>' +
      '<div class="up-ph-nav ush-nav" role="tablist"></div>' +
      /* up-leiste-fluss (core): Filters, jeder Chip und Clear All stehen einzeln in der Zeile neben dem
         Kalender und brechen dort um -- dieselbe Filterzeile ueber einem Band wie auf Citations. */
      '<div class="ush-filterzeile up-leiste-fluss">' +
        '<div class="up-root udr-root ush-daten" data-instance="' + esc(idDaten) + '" data-local="yes" data-isdark="' + (isDark() ? "yes" : "no") + '"></div>' +
        '<div class="up-root ufb-root ush-filterleiste" data-instance="' + esc(idFilter) + '" data-topics-instance="' + esc(idTopics) + '"' +
          ' data-models-instance="' + esc(idModelle) + '" data-markets-instance="' + esc(idMaerkte) + '" data-form="gross"' +
          Object.keys(ID_FF).map(function (k) { return ' data-' + k + '-instance="' + esc(ID_FF[k]) + '" data-' + k + '-visible="no"'; }).join("") +
          ' data-isdark="' + (isDark() ? "yes" : "no") + '"></div>' +
        '<div class="up-root utf-root" data-instance="' + esc(idTopics) + '" data-local="yes" data-isdark="' + (isDark() ? "yes" : "no") + '"></div>' +
        '<div class="up-root umf-root" data-instance="' + esc(idModelle) + '" data-local="yes" data-isdark="' + (isDark() ? "yes" : "no") + '"></div>' +
        '<div class="up-root umk-root" data-instance="' + esc(idMaerkte) + '" data-local="yes" data-isdark="' + (isDark() ? "yes" : "no") + '"></div>' +
        /* EXPORT rechts in der Filterzeile (16.10.), Form wie in Prompt Insights (.up-export aus
           core). Nicht auf der Landingpage (ohneAdresse): dort gibt es keinen Export-Dialog. */
        (ohneAdresse ? '' : exportKnopfHtml()) +
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
    /* Intent-Filter der App (13.10.): gemeinsamer Stand in core, Ereignis am window. */
    window.addEventListener("up-intentfilter", function () { if (document.contains(root)) filterGeaendert(); });
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
      ffSync();
    }

    /* TOPICS UND MARKE, DIE ES NICHT MEHR GIBT (17.10., 22023): core (UC.filterBereinigen) liest die Ids
       aus der Antwort, hier steht nur, wo die Seite sie haelt: p_tag_ids im Topic-Filter und in
       state.filter, p_company_id als Marke der Produkttabelle (state.products.marke, Chip in der
       Filterzeile). Aufgerufen aus der Fehlerantwort des direkten Wegs VOR dem Fehlerzustand. Geht sie auf,
       fallen alle uebrigen Anfragen mit dem alten Filter weg, danach laedt filterGeaendert einmal neu.
       Geht sie nicht auf (Wert nicht im Seitenfilter, Grenze erreicht), bleibt der Fehlerzustand mit
       dem Knopf "Clear filters". */
    function filterRaeumen(erg) {
      if (!UC.filterBereinigen) return false;
      return UC.filterBereinigen(erg, {
        schluessel: "ush|" + instanceId, wurzel: root,
        topics: {
          lesen: function () { return isArr(state.filter.topics) ? state.filter.topics : []; },
          setzen: function (rest) {
            filterSetzen("topics", rest.length ? rest : null);
            var tp = root.querySelector(".utf-root"), c = tp && tp.__utfCtrl;
            if (c && typeof c.setSelected === "function") { try { c.setSelected(rest.join(",")); } catch (e) {} }
          }
        },
        felder: {
          p_company_id: {
            lesen: function () { var m = state.products.marke; return m && m.id ? [str(m.id)] : []; },
            setzen: function (rest) {
              state.products.marke = null;
              if (pager.products) pager.products.st.page = 1;
              ffSync();
            }
          }
        },
        danach: function () {
          Object.keys(unterwegs).forEach(function (k) {
            var w = unterwegs[k];
            if (!w) return;
            clearTimeout(w.uhr);
            if (w.ctrl) { try { w.ctrl.abort(); } catch (e) {} }
            unterwegs[k] = null;
          });
          filterGeaendert();
        }
      });
    }

    /* ---- Die Filter der Produkttabelle in der Filterzeile (15.10.) -----------------------------
       Bauart wie responses-table.js ("die Filter der einen Leiste"): core baut je Filter die Wurzel,
       die filter-bar einzieht (UC.makeLeistenFilter), der ZUSTAND bleibt hier in state.products --
       derselbe, den vorher die Knoepfe der Werkzeugleiste setzten, also dieselbe Anfrage
       (p_segment, p_company_id, p_merchant). Die Wurzeln haengen an DIESER Wurzel und nicht am
       Abschnitt der Tabelle: der wird bei jedem Reiterwechsel neu gebaut, die Filterzeile nicht.
       Jede Wahl gilt sofort wie alle anderen Filter der Leiste. */
    var ladeUhr = null;
    /* Mehrere Wahlen in einem Zug ("Clear All" leert jeden Filter einzeln) sind EINE Anfrage: ohne
       die Buendelung ginge je Filter eine hinaus, und jede wartete auf die vorige. */
    function bedarfBald() {
      if (ladeUhr) return;
      ladeUhr = setTimeout(function () { ladeUhr = null; bedarf(); }, 0);
    }
    function prodFilter(feld, wert) {
      var tb = state.products;
      if (JSON.stringify(tb[feld] == null ? null : tb[feld]) === JSON.stringify(wert == null ? null : wert)) { ffSync(); return; }
      tb[feld] = wert; tb.page = 1;
      if (pager.products) pager.products.st.page = 1;
      persist(); zeichnen(); bedarfBald();
    }
    function einmal(l) { var da = {}; return l.filter(function (x) { if (da[x]) return false; da[x] = 1; return true; }); }
    var FF_ARTEN = {
      shsegment: {
        label: function () { return t("Segment"); }, chip: function () { return t("Segment"); }, leer: "All", einzeln: true,
        optionen: function () { return [{ key: "you", name: t("You") }, { key: "competition", name: t("Competition") }, { key: "other", name: t("Other") }]; },
        auswahl: function () { var s = state.products.seg; return s && s !== "all" ? [s] : []; },
        setzen: function (l) { var k = l.length ? str(l[l.length - 1]) : "all"; prodFilter("seg", { you: 1, competition: 1, other: 1 }[k] ? k : "all"); }
      },
      shbrand: {
        label: function () { return t("Brand"); }, chip: function () { return t("Brand"); }, leer: "All", einzeln: true, suche: true, titel: "Brands",
        optionen: function () { return markenListe().map(function (x) { return { key: x.key, name: x.label, logo: x.logo }; }); },
        auswahl: function () { var m = state.products.marke; return m && m.id ? [str(m.id)] : []; },
        setzen: function (l) {
          var k = l.length ? str(l[l.length - 1]) : "";
          var hit = k ? markenListe().filter(function (x) { return x.key === k; })[0] : null;
          prodFilter("marke", k ? { id: k, name: hit ? hit.label : "" } : null);
        }
      },
      shmerchant: {
        label: function () { return t("Merchant"); }, chip: function () { return t("Merchant"); }, leer: "All", einzeln: true, suche: true, titel: "Merchants",
        optionen: function () { return einmal(haendlerListe()).map(function (n) { return { key: n, name: n }; }); },
        auswahl: function () { return state.products.haendler ? [str(state.products.haendler)] : []; },
        setzen: function (l) { prodFilter("haendler", l.length ? str(l[l.length - 1]) : null); }
      }
    };
    var ffKit = UC.makeLeistenFilter ? UC.makeLeistenFilter(root, { instanceId: instanceId, arten: FF_ARTEN }) : null;
    function ffSync() { if (ffKit) { try { ffKit.sync(); } catch (e) {} } }
    /* Die Suche der Haendlerliste sucht Haendler, nicht Marken: core schreibt "Search brands..."
       in jede durchsuchbare Liste (makeLeistenFilter kennt noch keinen eigenen Platzhalter). */
    (function () {
      var si = root.querySelector(".up-ff-shmerchant .up-ff-search-in");
      if (!si) return;
      si.setAttribute("placeholder", t("Search merchants…"));
      si.setAttribute("aria-label", t("Search merchants"));
    })();
    ffSync();
    /* Die Haendlerliste kommt wie bisher beim ersten Aufklappen (haendlerHolen): ein Klick in die
       Filterzeile auf dem Reiter Products holt die 100 meistgenannten -- dieselbe Anfrage wie
       vorher am Haendler-Knopf, nur einmal je Filterstand. */
    root.querySelector(".ush-filterleiste").addEventListener("click", function () {
      if (state.seite === "products") haendlerHolen();
    }, true);
    /* Welche Filter die Filterzeile je Reiter zeigt: die drei der Produkttabelle nur auf Products.
       EIGENER NAME (22.10.): die Funktion hiess wie "die eine Leiste" weiter unten (leisteStellen, 20.10.). Zwei
       Funktionsdeklarationen mit einem Namen in einem Geltungsbereich -- es gilt die letzte, diese hier lief also nie.
       Gemessen: data-shbrand-visible blieb auf Products "no", Segment, Brand und Merchant fehlten im Menue Filters,
       und eine Marke aus einem Klick in Brands filterte die Tabelle ohne Chip (Lukas: "die sichtbaren Filter"). */
    function filterSichtbarStellen() {
      var fb = root.querySelector(".ush-filterleiste"), an = state.seite === "products" ? "yes" : "no";
      if (!fb) return;
      Object.keys(ID_FF).forEach(function (k) {
        var a = "data-" + k + "-visible";
        if (fb.getAttribute(a) !== an) fb.setAttribute(a, an);
      });
    }

    /* ---- Anfragen ------------------------------------------------------------------------------
       Je RPC ein Kanal: hoechstens EINE Anfrage unterwegs, eine Uhr, die das Warten beendet. Die
       Antwort gehoert der Anfrage, die unterwegs war (sig).
       Seit dem 13.10. geht sie direkt an v2 (direkt); attr, name, setter und rpc (v1) tragen nur
       noch den Rueckweg ueber Bubble (ueberBubble), falls eine v2 noch fehlt. */
    var KANAL = {
      overview: { v2: "cached_shopping_overview_v2", attr: "data-overview-fn", name: "shopOverview", setter: "setShoppingOverview", rpc: "cached_shopping_overview_v1" },
      products: { v2: "cached_shopping_products_v2", attr: "data-products-fn", name: "shopProducts", setter: "setShoppingProducts", rpc: "cached_shopping_products_v1" },
      detail: { v2: "cached_shopping_product_detail_v2", attr: "data-detail-fn", name: "shopProductDetail", setter: "setShoppingProductDetail", rpc: "cached_shopping_product_detail_v1" },
      merchants: { v2: "cached_shopping_merchants_v2", attr: "data-merchants-fn", name: "shopMerchants", setter: "setShoppingMerchants", rpc: "cached_shopping_merchants_v1" }
    };
    /* Direkt laedt nur die App. Auf der Landingpage (data-adresse="aus", einzig dort gesetzt, aus
       .landing_markup.py) steht die Komponente in einer fremden Seite ohne Login: eine direkte
       Anfrage kaeme dort als "not authenticated" zurueck und legte einen Fehlerzustand ueber die
       Vorfuehrung, die ihre Daten ueber die Setter bringt. Dort bleibt der alte Weg, dessen
       Ereignisse landing-boot.js stummschaltet. */
    function direktWeg() { return !ohneAdresse && typeof UC.rpc === "function"; }
    var unterwegs = { overview: null, products: null, detail: null, merchants: null };
    function grundBody() {
      var f = state.filter;
      return intentDazu({ p_team: team(), p_date_from: f.von || null, p_date_to: f.bis || null,
               p_models: f.modelle && f.modelle.length ? f.modelle.slice() : null,
               p_markets: f.maerkte && f.maerkte.length ? f.maerkte.slice() : null,
               p_tag_ids: f.topics && f.topics.length ? f.topics.slice() : null,
               p_tagmode: f.tagmode === "and" ? "and" : "or" });
    }
    function mit(o, extra) { for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) o[k] = extra[k]; return o; }
    function limitOf(tb) { var n = num(tb.pageSize) || 15; return Math.max(1, Math.min(100, Math.round(n))); }
    function offsetOf(tb) { return Math.max(0, ((num(tb.page) || 1) - 1) * limitOf(tb)); }
    function orderOf(name, tb) { return ORDER[name].indexOf(tb.order) >= 0 ? tb.order : ORDER_VORGABE[name]; }
    function suchText(s) { s = str(s).trim(); return s ? s.slice(0, 200) : null; }
    /* p_company_id geht nur als Id hinaus (DB seit a_ads_shopping_v1: unbekannt oder fremd ist 22023, und ein
       leerer oder kaputter Wert ist es erst recht): fehlt die Id oder ist sie keine, bleibt es "kein Filter". */
    var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    function markeId(tb) { var v = tb && tb.marke && tb.marke.id ? str(tb.marke.id).trim() : ""; return UUID_RE.test(v) ? v : null; }
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
        p_company_id: markeId(tb),
        p_order: orderOf("products", tb), p_limit: limitOf(tb), p_offset: offsetOf(tb) });
      return { kanal: "products", body: b, sig: sigVon(b) };
    }
    function detailAnfrage() {
      var b = mit(grundBody(), { p_source_product_id: str(state.produktId), p_limit: limitOf(state.auftritte), p_offset: offsetOf(state.auftritte) });
      return { kanal: "detail", body: b, sig: sigVon(b) };
    }
    var ME_VORGABE = { suche: "", order: "observations_desc", page: 1, pageSize: 15 };
    var ME_BALKEN = 10;
    function meAnfrage(tb) {
      var b = mit(grundBody(), { p_search: suchText(tb.suche), p_order: orderOf("merchants", tb), p_limit: limitOf(tb), p_offset: offsetOf(tb) });
      return { kanal: "merchants", body: b, sig: sigVon(b) };
    }
    /* ---- Die Berechnungen der Gesamtzeilen (15.10. spaet) ---------------------------------------
       Je Tabelle eine EIGENE Abfrage neben der Liste (Auftrag bubble/summen_db_auftrag_15_10.md, 5),
       geholt von der Gesamtzeile selbst (core, makeZaehlZeile): nur, was gewaehlt ist, je
       Filterstand einmal, mit eigenem Skelett in der Zelle -- die Zeilen warten nie darauf. Der Body
       ist der der Liste OHNE Sortierung und Seite, also aendern Blaettern und Sortieren die
       Signatur nicht. summenStand zaehlt reset(): danach gilt dieselbe Signatur als neu, und die
       Summe kommt frisch wie die Liste. Kein Rueckweg ueber Bubble -- die Summen gibt es nur in der
       App; fehlt die Funktion, steht "–" (core), und es wird nicht wiederholt. */
    var SUMME_FN = { products: "cached_shopping_products_summary_v2", brands: "cached_shopping_brands_summary_v2",
                     merchants: "cached_shopping_merchants_summary_v2" };
    var SUMME_FELDER = {
      products: ["avg_visibility_pct", "observations_total", "avg_position", "avg_first_position_rate_pct",
                 "price_median", "price_min", "price_max", "price_currency", "avg_rating", "merchants_used"],
      brands: ["own_share_pct", "top3_share_pct", "products_total", "observations_total", "avg_position",
               "rising_count", "falling_count"],
      merchants: ["top3_share_pct", "products_total", "observations_total", "avg_position"]
    };
    var summenStand = 0;
    function summeBody(s) {
      if (s === "products") {
        var b = mit({}, prodAnfrage().body);
        delete b.p_order; delete b.p_limit; delete b.p_offset;
        return b;
      }
      if (s === "brands") return mit(grundBody(), { p_brand_search: suchText(state.brands.suche) });
      return mit(grundBody(), { p_search: suchText(state.merchants.suche) });
    }
    /* Die Antwort: ein Objekt mit genau den bestellten Feldern (Auftrag 0.8), Zahlen als Zahl oder
       null, die Waehrung als Code -- nie 0 fuer "nichts". Auch { summary: {...} } und eine Liste mit
       einem Objekt. Unlesbar: null, die gewaehlten Zellen zeigen "–". */
    function summeLesen(d, felder) {
      var x = d && typeof d === "object" && !isArr(d) && d.summary && typeof d.summary === "object" ? d.summary : d;
      if (isArr(x) && x.length === 1 && x[0] && typeof x[0] === "object") x = x[0];
      if (!x || typeof x !== "object" || isArr(x)) return null;
      var o = {};
      felder.forEach(function (k) {
        if (!Object.prototype.hasOwnProperty.call(x, k)) return;
        o[k] = k === "price_currency" ? (str(x[k]).trim() || null) : num(x[k]);
      });
      return o;
    }
    /* Gelesene Summen je Anfrage (Funktion + ganzer Body samt p_fields und summenStand): die
       Gesamtzeile merkt sich ihre Werte nur, solange es SIE gibt, und zeichnen() baut den Abschnitt
       bei jedem Reiterwechsel und jedem Theme neu -- gemessen holte ein redraw() dieselbe Summe
       sonst ein zweites Mal. Nur Gelesenes; ein Fehler wird beim naechsten Aufbau einmal neu
       versucht, nicht in einer Schleife. Die juengsten 30. */
    var summenSpeicher = {}, summenReihe = [];
    function summenQuelle(s) {
      return {
        sig: function () { return summenStand + "|" + sigVon(summeBody(s)); },
        holen: function (felder) {
          if (!direktWeg() || !team() || !SUMME_FN[s]) return null;
          var fl = (isArr(felder) ? felder : []).filter(function (f, i, l) { return SUMME_FELDER[s].indexOf(f) >= 0 && l.indexOf(f) === i; }).sort();
          if (!fl.length) return null;
          var body = mit(summeBody(s), { p_fields: fl }), k = summenStand + "|" + SUMME_FN[s] + "|" + sigVon(body);
          if (summenSpeicher[k]) return Promise.resolve(summenSpeicher[k]);
          return Promise.resolve(UC.rpc(SUMME_FN[s], body, { timeoutMs: WARTE_MS })).then(function (erg) {
            var d = erg && erg.ok ? summeLesen(erg.daten, SUMME_FELDER[s]) : null;
            if (d) {
              summenSpeicher[k] = d; summenReihe.push(k);
              while (summenReihe.length > 30) delete summenSpeicher[summenReihe.shift()];
            }
            return d;
          }, function () { return null; });
        }
      };
    }
    /* Die Signatur ist der ganze Body, MIT p_team (13.10.). Bis dahin fehlte das Team darin ("es
       wechselt nur mit einem Seitenaufbau") -- seit die App das Team ohne Neuladen wechselt
       (UC.onTeamChange) und die Komponente selbst laedt, zeigte ein Teamwechsel sonst die
       gemerkten Zahlen des alten Teams als Antwort fuer das neue. */
    function sigVon(b) { return JSON.stringify(b); }
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
      var direktJetzt = direktWeg() && !OHNE_V2[a.kanal];
      /* Ohne Team keine direkte Anfrage: p_team "" waere ein Fehler der RPC, der als Fehlerzustand
         stehen bliebe. Das erste setUpstreemTeam meldet sich ueber UC.onTeamChange (unten) und
         laedt dann -- wie in citations-page. */
      if (direktJetzt && !team()) return;
      var u = unterwegs[a.kanal] = { sig: a.sig, body: a.body, uhr: null, ctrl: null, direkt: direktJetzt };
      if (direktJetzt) direkt(a, u); else ueberBubble(a, u);
    }
    /* DER DIREKTE WEG (13.10.). Die Antwort ist an IHRE Anfrage gebunden (u im Abschluss) -- nicht
       an "was gerade unterwegs ist" wie beim Setter. Darum braucht er weder kanalVon noch die
       Nachzuegler-Pruefung: was nicht mehr unterwegs ist (reset, Teamwechsel, Notbremse), wird
       verworfen, sonst nichts. */
    function direkt(a, u) {
      var k = KANAL[a.kanal];
      u.ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
      /* Die Uhr ist hier die Notbremse: UC.rpc bricht selbst nach WARTE_MS ab, wartet davor aber
         bis zu 4 s auf ein frisches Token und versucht nach "JWT expired" einmal neu. Ohne sie
         koennte das Skelett fast eine Minute stehen. */
      u.uhr = setTimeout(function () {
        if (unterwegs[a.kanal] !== u) return;
        unterwegs[a.kanal] = null;
        if (u.ctrl) { try { u.ctrl.abort(); } catch (e) {} }
        ablegen(a.kanal, a.sig, null, "zeit");
      }, WARTE_MS + 5000);
      UC.rpc(k.v2, a.body, { timeoutMs: WARTE_MS, signal: u.ctrl ? u.ctrl.signal : undefined }).then(function (erg) {
        if (unterwegs[a.kanal] !== u) return;
        erg = erg || { ok: false, status: 0, fehler: { message: "network" } };
        if (!erg.ok && v2Fehlt(erg)) {
          /* Die Funktion gibt es noch nicht: ein Pin, der vor dem SQL ausgeliefert wird, darf
             nichts kaputt machen. Dieselbe Anfrage geht ueber Bubble, und der Kanal bleibt dort. */
          OHNE_V2[a.kanal] = true;
          melden("ohneV2" + a.kanal, k.v2 + " fehlt in der Datenbank -- " + k.name + " laedt bis zum Neuladen ueber den Bubble-Workflow.");
          clearTimeout(u.uhr);
          u.direkt = false; u.ctrl = null;
          ueberBubble(a, u);
          return;
        }
        clearTimeout(u.uhr);
        unterwegs[a.kanal] = null;
        /* Die Antwort ist reines JSON (kein Umschlag); objekt nimmt sie trotzdem durch denselben
           Weg wie den Setter-Text -- eine Liste mit einem Element wird ihr erstes, alles andere als
           ein Objekt ist unlesbar ("x"). */
        if (erg.ok) ablegen(a.kanal, a.sig, objekt(erg.daten), "x");
        else if (filterRaeumen(erg)) return;
        else ablegen(a.kanal, a.sig, null, rpcFehlerCode(erg));
      });
    }
    /* 404 mit PGRST202 heisst "Funktion nicht im Schema" -- NICHT jedes 404: PT404 ist ein
       fachliches "nicht gefunden" und bleibt ein Fehlerzustand. */
    /* Ohne Bubble (die App, UC.ohneBubble): kein Rueckweg, sondern der Fehler, den der Aufrufer schon zeigt (14.10.). */
    function v2Fehlt(erg) {
      if (UC.ohneBubble && UC.ohneBubble()) return false;
      var f = erg.fehler || {};
      return erg.status === 404 && (f.code === "PGRST202" || /could not find the function/i.test(str(f.message)));
    }
    /* Der Code aus einem UC.rpc-Fehler fuer fehlerText: message IST der Code (Vertrag). Die
       Zustaende von UC.rpc selbst werden zu denen, die der Fehlerzustand schon kennt. */
    function rpcFehlerCode(erg) {
      var m = str(erg.fehler && erg.fehler.message).trim();
      /* 22023 (17.10., a_ads_shopping_v1): Zeitraum ueber 13 Monate und eine Id oder ein Name, den es
         nicht gibt (p_tag_ids, p_advertisers, p_company_id), sind Fehler, die der Nutzer beheben kann --
         nicht "could not be read". message ist bei 22023 der Code der Komponente (ads_invalid_param),
         der Grund steht im hint. <bereich>_busy (PT429, schwere Abfragen belegt) ist eine Ratengrenze. */
      var fh = str(erg.fehler && erg.fehler.hint), fc = str(erg.fehler && erg.fehler.code);
      if (fc === "22023" && /13 months/i.test(fh)) return "range_13m";
      if (fc === "22023" && /^\s*p_(tag_ids|advertisers|company_id|company_ids)\b/i.test(fh)) return "filter_gone";
      if (str(erg.fehler && erg.fehler.code) === "PT429" && /_busy$/.test(m)) return "shopping_rate_limited";
      if (m === "timeout") return "zeit";
      if (m === "unreadable_response") return "x";
      if (erg.status === 429 && !/rate_limited/.test(m)) return "shopping_rate_limited";
      return m || "http_" + (erg.status || 0);
    }
    /* DER RUECKWEG UEBER BUBBLE -- bis zum 13.10. der einzige Weg, unveraendert. */
    function ueberBubble(a, u) {
      var k = KANAL[a.kanal];
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
      var u = unterwegs[kanal];
      /* Eine DIREKTE Anfrage bekommt ihre Antwort selbst (direkt). Ein Setter, der waehrenddessen
         kommt, nimmt ihr den Platz nicht weg -- er gilt wie eine Antwort ohne Anfrage. */
      if (u && u.direkt) u = null;
      var ziel = u;
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
      return ablegen(kanal, ziel ? ziel.sig : null, ok ? d : null, fehlerCode(f) || (str(raw).trim() ? "x" : "leer"));
    }
    /* Eine Antwort ablegen -- derselbe Schluss fuer Setter und direkten Weg (13.10. aus antwort
       herausgezogen): lesbar in den Speicher, sonst der Fehlercode an ihre Anfrage. Danach wird
       IMMER gezeichnet, das beendet den Ladezustand auch im Fehlerfall. */
    function ablegen(kanal, sig, d, code) {
      var ok = !!(d && pruefen(kanal, d));
      if (sig) {
        if (ok) {
          delete state.fehler[kanal + sig];
          merken(kanal, sig, d);
        } else {
          state.fehler[kanal + sig] = code || "x";
        }
      }
      persist();
      zeichnen();
      bedarf();
      return ok;
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
    var geruest = null, linie = null, pager = {}, sucheKit = {}, sortKit = {}, balken = {};
    function zeichnen() {
      if (root.isConnected === false) return;
      var s = state.seite;
      /* Die Filter der Produkttabelle: sichtbar je Reiter, Liste und Haken auf Stand (die Marken-
         und Haendlernamen kommen mit den Antworten). sync meldet nur, was sich geaendert hat. */
      filterSichtbarStellen();
      ffSync();
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
    /* Der Vergleichszeitraum einer Kachel mit Trend -- seit 22.10. abends als Satz in ihrer Erklaerkarte (kachelKarte), nicht
       mehr als Fusszeile. Text, kein HTML: die Karte escaped. */
    function vergleichSatz(meta) {
      if (!vergleich(meta)) return t("No comparison period available.");
      var pp = meta.previous_period;
      var z = pp ? zeitraum(pp.from, pp.to) : "";
      return z ? ersetze(t("Change compared with {period}."), { period: z }) : "";
    }

    function aufraeumen() {
      filterzeileZurueck();
      tabKleber = null;
      if (linie && linie.destroy) { try { linie.destroy(); } catch (e) {} }
      linie = null; pager = {}; sucheKit = {}; sortKit = {}; balken = {}; spalten = {}; zaehl = null;
    }
    function sek(name) { return elMain.querySelector('[data-sek="' + name + '"]'); }
    /* DIE EINE LEISTE (20.10., Vorbild: Brands und Citations, Variante A): auf Products, Brands und Merchants ist der Kopf der Tabelle die
       Leiste der Seite. Links, was die Daten aendert (die Filterzeile mit Kalender und Filtern wandert in .up-leiste-scope), rechts die
       Ansicht: Suche, Table Settings und Export, in dieser Reihenfolge und in EINER Zeile. Sie klebt (core makeSticky, ab 1000 breit),
       der Spaltenkopf direkt darunter, Gesamtzeile und Pagination unten (data-kleb-fuss). Brands und Merchants tragen Kennzahlen und
       Chart darunter, zwischen Leiste und Tabelle (core bandUnterLeiste). Bewegt werden die vorhandenen Elemente: Kalender, Filter und
       Export behalten Zustand und Handler. Das Geruest wird je Reiter neu gebaut: vorher kommt die Filterzeile zurueck an ihren Platz
       (filterzeileZurueck), sonst ginge sie mit dem alten Abschnitt unter. Overview und Detail haben keine solche Tabelle und behalten
       die Filterzeile ueber dem Inhalt. */
    var elFilterzeile = root.querySelector(".ush-filterzeile"), tabKleber = null;
    function filterzeileZurueck() {
      if (!elFilterzeile) return;
      var ex = root.querySelector(".ush-export");
      if (ex && ex.parentNode !== elFilterzeile) elFilterzeile.appendChild(ex);
      elFilterzeile.classList.remove("is-in-tabelle");
      if (elFilterzeile.parentNode !== root || elFilterzeile.nextElementSibling !== elMain) root.insertBefore(elFilterzeile, elMain);
    }
    function leisteStellen(name) {
      var tabEl = sek("tabelle"), kopf = tabEl && tabEl.querySelector(":scope > .up-head");
      if (!elFilterzeile || !kopf || tabEl.getAttribute("data-leiste") !== "yes") return;
      var scope = kopf.querySelector(":scope > .up-leiste-scope");
      if (!scope) {
        scope = document.createElement("div");
        scope.className = "ush-scope-leiste up-leiste-scope";
        kopf.insertBefore(scope, kopf.firstChild);
      }
      scope.appendChild(elFilterzeile);
      elFilterzeile.classList.add("is-in-tabelle");
      var werkz = kopf.querySelector(".up-head-tools"), ex = elFilterzeile.querySelector(".ush-export");
      if (werkz && ex) werkz.appendChild(ex);
      tabEl.setAttribute("data-kleb-fuss", "yes");
      if (!tabEl.getAttribute("data-sticky-top")) tabEl.setAttribute("data-sticky-top", "16");
      var gruppe = name === "products" ? null : elMain.querySelector(":scope > .ush-seite > .ush-gruppe");
      if (gruppe && UC.bandUnterLeiste) UC.bandUnterLeiste(tabEl, gruppe, { kopf: kopf });
      var kleber = UC.makeSticky ? UC.makeSticky(tabEl, kopf) : null;
      tabKleber = kleber;
      if (kleber) {
        if (UC.aufResize) UC.aufResize(kleber.applySticky);
        else window.addEventListener("resize", UC.rafThrottle ? UC.rafThrottle(kleber.applySticky) : kleber.applySticky);
        kleber.applySticky();
      }
    }
    /* DER UMSCHALTER IM SEITENKOPF (20.10., wie Brands und Citations): "Chart and table" / "Table only" blendet die Charts der Seite aus (die
       Linie der Overview und der Brands, die Balken der Merchants) und wieder ein. Kennzahlen und Tabellen bleiben. Gemerkt im Browser
       (UC.bandAusMerken), ein Schalter fuer die ganze Seite.
       AUF JEDEM REITER DA UND WIRKSAM (22.10., Lukas: auf Products tat "Table only" nichts, der Schalter blieb stehen und sprang
       erst auf Brands um). Ursache hier, nicht in core: ohne Chart setzte diese Funktion nur hidden an den Schalter und kehrte
       zurueck. hidden wirkt dort nicht (.up-seg in core setzt display, und jede Autorenregel schlaegt das hidden des Browsers;
       gemessen display flex, 80 breit), und der Klick lief in den Rueckruf des letzten Reiters: er merkte "aus", rief diese
       Funktion, und die kehrte wieder vor UC.bandAus zurueck -- der Schalter wurde nie neu gestellt. Jetzt geht jeder Reiter
       durch UC.bandAus: mit Chart ist das Band der Chart (Overview, Brands, Merchants und seit dem 22.10. das Produkt-Detail,
       sonst sagte der Schalter dort "Table only" ueber einem sichtbaren Chart), ohne Chart (Products) die Seite selbst als
       Anker -- sie traegt kein .up-band, die Regel "ausgeblendet ist das Band ganz weg" trifft sie also nicht. */
    function bandSchalten(name) {
      var band = name === "overview" || name === "brands" || name === "detail" ? sek("chart") : name === "merchants" ? sek("balken") : null;
      var anker = band || elMain.querySelector(":scope > .ush-seite");
      if (!anker || !UC.bandAus) return;
      var aus = !!(UC.bandAusGemerkt && UC.bandAusGemerkt(instanceId)), war = !!band && band.classList.contains("is-band-aus");
      UC.bandAus(anker, aus, { id: instanceId, setzen: function (neu) {
        if (UC.bandAusMerken) UC.bandAusMerken(instanceId, !!neu);
        bandSchalten(state.seite);
      } });
      var sw = root.querySelector('.up-bandsw[data-band="' + instanceId + '"]');
      if (sw) sw.hidden = false;
      /* Wieder eingeblendet: ein Canvas, das ausgeblendet gemessen wurde, hat Breite 0. */
      if (war && !aus && linie && linie.resize) setTimeout(function () { try { linie.resize(); linie.relayoutLegend && linie.relayoutLegend(); } catch (e) {} }, 60);
    }
    /* Abschnittskopf aus core (.up-sec-head), wie im Event-Detail. */
    /* .up-band-head: im offenen Band die Ueberschriftzeile aus core (core.css "DAS OFFENE BAND";
       mit Unterzeile zweizeilig, 16 ueber der Schrift). Ausserhalb eines Bandes greift die Klasse
       nicht. */
    function sekKopf(titel, desc, rechts, erklaerung) {
      return '<div class="up-sec-head ush-sec-head up-band-head"><div class="up-sec-titles">' +
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
      return '<div class="up-box ush-chartbox up-band-inhalt">' +
        '<div class="ush-linewrap"><canvas></canvas></div><div class="up-legend ush-legende"></div></div>';
    }
    /* DAS OFFENE BAND (15.10., Variante A wie der Chart der Citations-Seite, citations-combo-chart.css
       "DAS OFFENE BAND"): Diagramm, Balken und Held stehen nicht mehr im Kasten, sondern in einem
       Band bis an die Kanten, oben und unten eine Linie, die Ueberschrift samt Werkzeugen als
       erste Zeile IM Band. Dasselbe Attribut wie die flache Tabelle (data-flach an einer .up-root):
       die Masse --up-flach-aus und --up-flach-h setzt core dort, fuer jede Komponente gleich.
       Seit dem 15.10. abends der Baustein aus core (.up-band, core.css "DAS OFFENE BAND"); in
       shopping.css steht nur noch, was Held und "Where this product appears" eigen haben. */
    function bandAuf(name, klasse) {
      return '<section class="up-root ush-sek ush-band up-band' + (klasse ? " " + klasse : "") + '" data-flach="yes"' +
        (isDark() ? ' data-theme="dark"' : '') + (name ? ' data-sek="' + name + '"' : '') + '>';
    }
    /* o.leiste: DIE EINE LEISTE (core.css, data-leiste) -- die Ueberschrift faellt weg, rechts stehen
       Suche und Display, der Kopf bricht um statt Knoepfe wegzunehmen. Nur, wo die Tabelle das
       Einzige auf ihrem Reiter ist (Products) oder unter Diagramm und Kennzahlen steht, deren
       Reiter sie benennt (Brands, Merchants); Recent Appearances im Produkt-Detail behaelt ihre
       Ueberschrift -- dort steht sie unter Merchants und "Where this product appears", und ohne
       sie hiesse die Tabelle nichts. Die Zahl steht in beiden Faellen in der Gesamtzeile. */
    function tabSek(name, titel, suchePlatz, o) {
      o = o || {};
      /* Der Abschnitt ist eine eigene .up-root: die Suchuebernahme aus core (offene Suche nimmt auf
         schmaler Breite die ganze Kopfzeile, is-searchtakeover) haengt an ".up-root" -- ohne die
         Klasse stand bei 400px die offene Suche neben den Segmenten und ragte 44px hinaus. */
      /* data-flach (15.10., core.css "DIE FLACHE TABELLE"): ohne Kasten, Linien bis an die Kanten,
         Kopf und Fuss 48. Am Abschnitt und nicht an der Seite: dort tragen auch Diagramm, Balken,
         Held und Kennzahlen-Fehler .up-box und blieben sonst nicht mehr Kasten. Der Abschnitt ist
         zugleich die Wurzel von UC.makeColumns (spaltenFuer) -- dort liest das Kit den Abzug fuer
         das Auslauf-Polster -- und traegt den Fuss. */
      return '<section class="up-root ush-sek ush-tab" data-flach="yes"' + (o.leiste ? ' data-leiste="yes"' : '') +
          (isDark() ? ' data-theme="dark"' : '') + ' data-sek="' + name + '">' +
        '<div class="up-head ush-head">' +
          '<span class="up-heading ush-heading"><span class="up-head-label">' + esc(t(titel)) + '</span>' +
            '<span class="up-head-sep"></span><span class="up-head-count"></span></span>' +
          '<div class="up-head-tools ush-tools">' + (suchePlatz || '') + spaltenKnopf() + '</div>' +
        '</div>' +
        '<div class="ush-scope" hidden></div>' +
        '<div class="up-root ush-tabwurzel"' + (isDark() ? ' data-theme="dark"' : '') + '><div class="ush-tabelle"></div></div>' +
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
            '<div class="up-kpiband is-4 is-offen ush-kpis" data-sek="kpis"></div>' +
            bandAuf("chart") +
              sekKopf("Shopping Performance", t("How your brand and competitors appear in AI shopping results"),
                segHtml("ush-metrik", [["presence", "Brand Presence"], ["share_of_shelf", "Share of Shelf"], ["avg_position", "Avg. Position"], ["first_position_rate", "First Position Rate"]], state.ovMetrik), "chart") +
              chartHtml() +
            '</section>' +
          '</div>' +
          '<section class="ush-sek" data-sek="landscape"></section>' +
          '<section class="ush-sek" data-sek="topprodukte"></section>' +
          /* Product Movement und Merchant Distribution als EIN Band mit zwei Einheiten und einer
             senkrechten Linie dazwischen (gestapelt waagerecht, shopping.css "DAS OFFENE BAND").
             Product Movement ist eine Liste im Raster der Tabellen und bleibt flach: die flache
             Tabelle braucht eine .up-root mit data-flach ueber ihrem Kasten. */
          '<div class="up-root ush-zwei ush-band up-band up-band-zwei up-band-raster" data-flach="yes"' + (isDark() ? ' data-theme="dark"' : '') + ' data-sek="zwei">' +
            '<section class="up-root ush-sek up-band-einheit" data-flach="yes"' + (isDark() ? ' data-theme="dark"' : '') + ' data-sek="bewegung"></section>' +
            '<section class="ush-sek up-band-einheit" data-sek="verteilung"></section>' +
          '</div>' +
        '</div>';
      } else if (s === "brands") {
        html = '<div class="ush-seite" data-seite="brands">' +
          '<div class="ush-gruppe">' +
            '<div class="up-kpiband is-4 is-offen ush-kpis" data-sek="kpis"></div>' +
            bandAuf("chart") +
              sekKopf("Brand Performance", t("How the top brands develop in AI shopping results"),
                segHtml("ush-metrik", [["share_of_shelf", "Share of Shelf"], ["presence", "Presence"], ["avg_position", "Avg. Position"], ["first_position_rate", "First Position Rate"]], state.brMetrik), "chart") +
              chartHtml() +
            '</section>' +
          '</div>' +
          tabSek("tabelle", "Brands", sucheHtml("Search brands…", "Search brands"), { leiste: true }) +
        '</div>';
      } else if (s === "products") {
        /* Segment, Marke und Haendler stehen seit dem 15.10. im Menue "Filters" (FF_ARTEN oben). */
        html = '<div class="ush-seite" data-seite="products">' +
          tabSek("tabelle", "Products", sucheHtml("Search products…", "Search products"), { leiste: true }) +
        '</div>';
      } else if (s === "merchants") {
        html = '<div class="ush-seite" data-seite="merchants">' +
          '<div class="ush-gruppe">' +
            '<div class="up-kpiband is-offen ush-kpis" data-sek="kpis"></div>' +
            bandAuf("balken") + '</section>' +
          '</div>' +
          tabSek("tabelle", "Merchants", sucheHtml("Search merchants…", "Search merchants"), { leiste: true }) +
        '</div>';
      } else if (s === "detail") {
        /* Der Held (Bild, Fakten, Kennzahlen) ist ein Band ohne Ueberschriftzeile: sein Name ist
           der Produkttitel darin. */
        html = '<div class="ush-seite" data-seite="detail">' +
          bandAuf("hero", "ush-heroband") + '</section>' +
          bandAuf("chart") +
            sekKopf("Product Performance", t("How this product appears in AI shopping results over time"),
              segHtml("ush-metrik", [["visibility", "Visibility"], ["avg_position", "Avg. Position"], ["observations", "Observations"]], state.dMetrik), "chart") +
            chartHtml() +
          '</section>' +
          bandAuf("wo") + '</section>' +
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
      if (s === "products" || s === "brands" || s === "merchants") leisteStellen(s);
      bandSchalten(s);
      var kb = sek("verteilung") || sek("balken");
      if (kb && UC.makeBarList) {
        /* Die Balkenliste aus core (Domain Detail, Model Breakdown) -- dieselbe CSS, dasselbe
           Markup. Ein Klick auf einen Haendler oeffnet die Produkte, die er fuehrt. */
        kb.addEventListener("click", function (e) {
          var r = e.target.closest && e.target.closest(".up-bar-row[data-bar-key]");
          if (!r) return;
          var key = r.getAttribute("data-bar-key");
          /* Wie die Zeile eines Haendlers (zeileOeffnen): genau dieser Filter, Marke und Segment zurueck auf alle (22.10.,
             Klickrouten: der Balken liess ein gewaehltes Segment stehen, die Zeile nicht). */
          if (key && key.indexOf("__rest") !== 0) seiteOeffnen("products", true, { haendler: key, marke: null, seg: "all" });
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
    /* zelle: der Name steht in der ersten Zelle einer Tabelle -- dann der Kern-Stil .up-zeilenname (14/500 wie in der Brands Overview), sonst wie bisher. */
    function markeName(m, q, zelle) {
      m = m || {};
      var kl = "up-varname" + (zelle ? " up-zeilenname" : "");
      if (m.type === "other" || !str(m.name).trim()) return '<span class="' + kl + ' ush-andere">' + esc(t("Other (unassigned)")) + '</span>';
      return '<span class="' + kl + '">' + hl(str(m.name).trim(), q) + '</span>';
    }
    /* Die Marke als Chip (05.10.: "unsere gewohnten Chips fuer die Logos, der Name dahinter
       kleiner"): UC.markenChip, 18px-Logo und 13px-Name wie der Modell-Chip. "You" dahinter. */
    function markeChip(m, meta, q) {
      m = m || {};
      var andere = m.type === "other" || !str(m.name).trim();
      if (andere) return UC.markenChip({ name: t("Other (unassigned)") }, { ltr: "–", nameHtml: '<span class="ush-andere">' + esc(t("Other (unassigned)")) + '</span>' });
      return UC.markenChip(m, { nameHtml: hl(str(m.name).trim(), q), nach: duMarke(m, meta) });
    }
    /* DER MARKEN-CHIP FILTERT (22.10., Lukas: "ja"): in der Products-Tabelle setzt ein Klick auf den Chip die Marke als Filter der
       Tabelle -- derselbe Zustand wie der Klick auf eine Zeile im Reiter Brands (state.products.marke, Chip "Brand" in der Leiste),
       nur ueber den Weg der Leiste (prodFilter): Haendler, Segment und Suche bleiben stehen, der Klick grenzt ein, statt den
       Umfang zu wechseln. Der Rest der Zeile oeffnet weiter das Produkt. Ein Knopf, damit Tabulator und Enter ihn erreichen;
       das title des Chips faellt weg, der Tooltip nennt den Namen schon (sonst stuenden zwei Hinweise uebereinander).
       Kein Knopf ohne Id ("Other", nicht zugeordnet) und nicht fuer die Marke, nach der schon gefiltert ist: dort taete der
       Klick nichts, der Chip bleibt Teil der Zeile. */
    function markeFilterChip(m, meta, q) {
      var chip = markeChip(m, meta, q);
      m = m || {};
      var id = str(m.company_id).trim(), name = str(m.name).trim(), akt = state.products.marke;
      if (!id || m.type === "other" || !name || (akt && str(akt.id) === id)) return chip;
      var tip = ersetze(t("Filter by {brand}"), { brand: name });
      return '<button type="button" class="ush-markefilter" data-ush-markefilter="' + esc(id) + '" data-ush-markefilter-name="' + esc(name) + '"' +
        ' aria-label="' + esc(tip) + '" data-tip="' + esc(tip) + '">' + chip.replace(' title="' + esc(name) + '"', '') + '</button>';
    }
    /* immer: die Zeile der eigenen Marke in der Tabelle Brands (22.10., Lukas: "keep it", als eigene Marke kennzeichnen).
       Ohne Treffer liefert die DB sie dort trotzdem (mit 0 und ohne Produkte) -- ohne die Marke "You" stand sie wie ein
       fremder Eintrag mit lauter Nullen da. Sonst bleibt die Marke ohne Treffer weg wie bisher (Kennzahlen, Charts). */
    function duMarke(m, meta, immer) {
      return m && m.type === "own" && (immer || !eigeneOhneTreffer(meta)) ? '<span class="up-marke up-you">' + esc(t("You")) + '</span>' : '';
    }
    function haendlerName(n) { return str(n).trim(); }
    function haendlerHtml(n, q) {
      var name = haendlerName(n);
      /* Nur das Zeichen, ohne Platte (06.10. angefordert: "einfach nur ein Icon"). Haendler haben
         kein Logo, die Platte versprach eines. Zeichen und Name in einer eigenen Gruppe mit 6px
         statt den 10px der Zelle -- sie gehoeren zusammen wie Logo und Name im Marken-Chip. */
      if (!name) return '<span class="ush-haendlerpaar"><span class="ush-haendler-ic is-leise">' + UC.icon("store", 2) + '</span><span class="up-varname up-zeilenname ush-andere">' + esc(t("Unknown")) + '</span></span>';
      return '<span class="ush-haendlerpaar"><span class="ush-haendler-ic">' + UC.icon("store", 2) + '</span><span class="up-varname up-zeilenname" title="' + esc(name) + '">' + hl(name, q) + '</span></span>';
    }
    function bildHtml(url, klasse) {
      /* Gesperrte Hosts ueber die eigene Adresse (core, bildUrl). */
      var u = sichereUrl(url);
      if (u && UC.bildUrl) u = UC.bildUrl(u);
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
       prio: die KLEINSTE faellt zuerst. sk: der Balken der Skelettzeile.
       o.flach: Untergrenze in der flachen Tabelle (UC.makeColumns minFlach/wFlach, 15.10.). Ihre
       Kopfschrift ist 13/500 statt 12/400, und so brauchten mehrere Koepfe mehr als ihr min
       (gemessen bei 1100 mit dem Klon des Kopfs, Erklaer- und Sortierzeichen mitgezaehlt, z. B.
       "First Position Rate" mit Sortierung 179,8 bei 176). Der Wert liegt 2 bis 4 darueber.
       Nachgemessen mit der Kopfschrift 14/500 und Info/Sortierpfeil 15 (15.10. spaet, Klon des
       Kopfs, samt Zellrand): z. B. "First Position Rate" mit Sortierung 190.4, ohne 169.4,
       "Avg. Product Position" 209.9, "Observations" 158.0 / 137.0. Wieder 3 darueber. */
    function sp(key, label, min, fr, prio, sk, o) {
      o = o || {};
      return { key: key, label: label, w: "minmax(" + min + "px," + fr + "fr)", min: min, prio: prio, sk: sk, sort: o.sort, info: o.info,
               minFlach: o.flach, wFlach: o.flach ? "minmax(" + o.flach + "px," + fr + "fr)" : null };
    }
    var TABELLEN = {
      landscape: { erste: { label: "Brand", min: 220, sk: { w: 110, logo: true } }, spalten: [
        sp("share", "Share of Shelf", 154, 1.2, 90, 60, { info: "shareBrand" }),
        sp("presence", "Presence", 120, 1, 80, 44, { info: "presenceBrand" }),
        sp("products", "Products", 104, 0.8, 50, 30),
        sp("pos", "Avg. Position", 124, 1, 70, 36, { info: "pos", flach: 137 }),
        sp("first", "First Position Rate", 156, 1.1, 40, 44, { info: "firstBrand", flach: 173 }),
        sp("change", "Change", 110, 0.9, 60, 40)] },
      topprodukte: { erste: { label: "Product", min: 260, sk: { w: 160, logo: true } }, spalten: [
        sp("vis", "Visibility", 130, 1.1, 90, 60, { info: "vis" }),
        sp("pos", "Avg. Position", 126, 0.9, 80, 36, { info: "pos", flach: 137 }),
        sp("obs", "Observations", 128, 0.9, 70, 30, { info: "obs", flach: 140 }),
        sp("first", "First Position Rate", 156, 1.1, 50, 44, { info: "firstProd", flach: 173 }),
        sp("rating", "Rating", 92, 0.7, 40, 30),
        /* 148: eine Preisspanne ("€19.62–€21.62") braucht 105px Text plus 28 Polster; mit 128/130
           lief sie 4,5px in das rechte Polster (06.10. gemessen). Was laenger ist, kuerzt core. */
        sp("price", "Price", 148, 1, 60, 50, { info: "price" })] },
      products: { erste: { label: "Product", min: 280, sort: "title", sk: { w: 170, logo: true } }, spalten: [
        sp("brand", "Brand", 160, 1.2, 85, { w: 70, logo: true }),
        sp("vis", "Visibility", 124, 1, 90, 60, { sort: "visibility", info: "vis", flach: 130 }),
        sp("obs", "Observations", 148, 1, 70, 30, { sort: "observations", info: "obs", flach: 161 }),
        sp("pos", "Avg. Position", 144, 1, 80, 36, { sort: "avg_position", info: "pos", flach: 158 }),
        sp("first", "First Position Rate", 176, 1.1, 50, 44, { sort: "first_position_rate", info: "firstProd", flach: 194 }),
        sp("price", "Price", 148, 1.1, 60, 60, { sort: "price", info: "price" }),
        sp("rating", "Rating", 92, 0.7, 30, 30, { sort: "rating", flach: 96 }),
        sp("merchants", "Merchants", 128, 1.1, 40, 70),
        sp("seen", "Last Seen", 120, 0.9, 20, 60, { sort: "last_seen" })] },
      brands: { erste: { label: "Brand", min: 220, sort: "name", sk: { w: 110, logo: true } }, spalten: [
        sp("share", "Share of Shelf", 154, 1.2, 90, 60, { sort: "share_of_shelf", info: "shareBrand", flach: 168 }),
        sp("presence", "Presence", 126, 0.9, 80, 44, { sort: "presence", info: "presenceBrand", flach: 136 }),
        sp("products", "Products", 104, 0.8, 60, 30, { sort: "products", flach: 112 }),
        sp("obs", "Observations", 148, 0.9, 50, 36, { sort: "observations", info: "obsBrand", flach: 161 }),
        sp("pos", "Avg. Position", 144, 1, 70, 36, { sort: "avg_position", info: "pos", flach: 158 }),
        sp("first", "First Position Rate", 176, 1.1, 40, 44, { sort: "first_position_rate", info: "firstBrand", flach: 194 }),
        sp("change", "Change", 110, 0.9, 65, 40, { sort: "share_of_shelf_delta" }),
        sp("top", "Top Product", 240, 1.8, 30, { w: 140, logo: true })] },
      merchants: { erste: { label: "Merchant", min: 240, sort: "name", sk: { w: 120, logo: true } }, spalten: [
        sp("share", "Share", 150, 1.2, 90, 60, { sort: "observations", info: "merchant" }),
        sp("products", "Products", 104, 0.8, 80, 30, { sort: "products", flach: 112 }),
        sp("obs", "Observations", 148, 1.1, 70, 50, { sort: "observations", info: "obsMerchant", flach: 161 }),
        sp("pos", "Avg. Product Position", 192, 1.1, 60, 36, { sort: "avg_position", info: "posMerchant", flach: 213 }),
        sp("firstseen", "First Seen", 120, 1, 30, 60, { sort: "first_seen" }),
        sp("seen", "Last Seen", 120, 1, 40, 60, { sort: "last_seen" })] },
      dhaendler: { erste: { label: "Merchant", min: 220, sk: { w: 120, logo: true } }, spalten: [
        sp("share", "Share", 124, 1, 90, 40, { info: "merchantProd" }),
        sp("obs", "Observations", 128, 1, 80, 30, { info: "obsMerchantProd", flach: 140 }),
        sp("price", "Price", 160, 1.2, 70, 60, { info: "price" })] },
      /* Recent Appearances: die erste Spalte ist ein Datum (120 Untergrenze). Dahinter die
         Knopfspalte "View Response", gemessen (UC.makeAktionsSpur) statt geschaetzt. */
      /* Recent Appearances (20.10.): wie die Responses-Tabelle -- vorn der Prompt, hinten das Datum, die Zeile oeffnet die Antwort (kein Knopf mehr). */
      detail: { erste: { label: "Prompt", min: 280, sk: { w: 220 } }, spalten: [
        sp("model", "Model", 150, 1.2, 90, { w: 70, logo: true }),
        sp("market", "Market", 90, 0.7, 50, 30),
        sp("topic", "Topic", 160, 1.4, 40, 80),
        sp("position", "Position", 100, 0.8, 70, 30, { info: "posTreffer", flach: 106 }),
        sp("price", "Price", 110, 0.9, 60, 40, { info: "priceTreffer" }),
        sp("merchant", "Merchant", 180, 1.4, 80, { w: 90, logo: true }),
        sp("date", "Date", 120, 0.9, 20, 60)] }
    };
    function kopfAus(name) {
      var d = TABELLEN[name];
      return th(d.erste.label, { sort: d.erste.sort }) + d.spalten.map(function (c) {
        return th(c.label, { k: "up-th-" + c.key, sort: c.sort, info: c.info });
      }).join("") + (d.aktion ? '<div class="up-th ush-th-aktion"></div>' : '');
    }
    /* Die Skelettzellen tragen dieselben Spaltenklassen -- sonst blendet das Kit sie nicht aus,
       und eine Zeile mit mehr Zellen als Spuren bricht in eine zweite Rasterzeile um. */
    /* Die Zahlenspalten je Tabelle, gemessen am geladenen Kopf (.up-th-zahl, 17.10.): ihr Skelettbalken
       steht rechts und ihr Kopf schon beim Laden (skeletonRows, zahl: true). "change" (nur Trend), Daten,
       Marken und Haendlernamen sind keine. */
    var ZAHL_SPALTEN = {
      landscape: " share presence products pos first ", topprodukte: " vis pos obs first rating price ",
      products: " vis obs pos first price rating ", brands: " share presence products obs pos first ",
      merchants: " share products obs pos ", dhaendler: " share obs price ", detail: " position price "
    };
    function skelettAus(name, n) {
      var d = TABELLEN[name];
      return skelettZeilen(n, [d.erste.sk].concat(d.spalten.map(function (c) {
        var o = c.sk && typeof c.sk === "object" ? mit({}, c.sk) : { w: c.sk };
        o.cls = "up-td-" + c.key;
        if ((ZAHL_SPALTEN[name] || "").indexOf(" " + c.key + " ") >= 0) o.zahl = true;
        return o;
      }), d.aktion ? [{ w: 90, cls: "ush-td-aktion" }] : []));
    }
    function td(key, html) { return '<div class="up-td up-td-' + key + '">' + html + '</div>'; }

    /* Ein Kit je Tabelle, gebunden an die Wurzel, in der Kopf, Kasten und -- bei den Tabellen mit
       Werkzeugleiste -- das Zahnrad stehen. Neu nur mit einer neuen Wurzel (ein Seitenwechsel baut
       das Geruest neu). Die Zeilenhoehe je Tabelle im Browser wie in urls-table. */
    var spalten = {};
    var HOEHEN = [{ key: "default", label: "Default" }, { key: "compact", label: "Compact" }];
    function dichteSchluessel(name) { return "ush_dense__" + instanceId + "__" + name; }
    function spaltenFuer(name, wurzel) {
      var e = spalten[name];
      if (e && e.wurzel === wurzel) return e;
      if (!UC.makeColumns || !wurzel) return null;
      var d = TABELLEN[name], st = { cols: {}, widths: {}, dense: false, rowHeight: "default" }, aktPx = 0;
      var mitMenue = !!wurzel.querySelector(".up-cols-menu");
      /* Brands und Merchants: Default 55, Compact 34 (shopping.css, ush-rh) statt 72/55. */
      if (name === "brands" || name === "merchants") wurzel.classList.add("ush-rh");
      /* DAS MENUE AM ZAHNRAD IST "Display" (15.10., wie Prompt- und Responses-Tabelle): oben die
         Zeilenhoehe als beschriftete Knoepfe, darunter die Spalten als Chips (makeColumns
         cfg.form "chips"), unten der Schalter der Gesamtzeile. Die Zeilenhoehe kommt dort nur ueber
         rowHeightSwitch -- Default (72) und Compact (55) sind dieselben zwei Stufen wie bisher
         Comfortable/Compact, gemerkt unter demselben Schluessel (dichteSchluessel). */
      var kit = UC.makeColumns({
        root: wurzel, state: st, columns: d.spalten, storePrefix: "ush", instanceId: instanceId + "__" + name,
        firstKey: "erste", firstMin: d.erste.min, firstFloor: d.floor, noActions: !d.aktion, scrollen: true,
        actionsMin: function () { return aktPx || 150; },
        form: mitMenue ? "chips" : null, rowHeightSwitch: mitMenue ? HOEHEN : null,
        /* Zur Laufzeit gelesen: die Gesamtzeile entsteht erst mit dem ersten Koerper (zaehlEinhaengen). */
        nachspann: mitMenue ? function () { return zaehl && zaehl.tab === wurzel ? zaehl.kit.schalter() : null; } : null,
        /* "up-sum": die Zellen der Gesamtzeile gehen mit ihren Spalten. */
        badgeSel: ".ush-cols-badge", cellPrefixes: ["up", "up-sum"]
      });
      st.cols = kit.readCols(); st.widths = kit.readWidths();
      if (mitMenue) {
        try { st.dense = window.localStorage.getItem(dichteSchluessel(name)) === "1"; } catch (x) {}
        st.rowHeight = st.dense ? "compact" : "default";
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
      e.st.dense = !!an; e.st.rowHeight = an ? "compact" : "default";
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
       gibt es keinen Schalter, der sie aufziehen koennte. Flach wie die ganzen Tabellen (tabSek):
       die Wurzel des Kits traegt data-flach, also auch ihr Leer- und Skelettkasten. */
    function vorschauPlatz(el, name, kopf) {
      if (!el.querySelector(".ush-vorschau")) el.innerHTML = kopf + '<div class="up-root ush-vorschau is-dense" data-flach="yes"' + (isDark() ? ' data-theme="dark"' : '') + '><div class="ush-tabelle"></div></div>';
      var w = el.querySelector(".ush-vorschau");
      spaltenFuer(name, w);
      return w.querySelector(".ush-tabelle");
    }
    function skelettZeilen(n, spalten) {
      return UC.skeletonRows ? UC.skeletonRows({ count: n, rowClass: "up-row", cellClass: "up-td", cols: spalten }) : "";
    }
    /* EINE LEERE TABELLE NEBEN DEN CHARTS (15.10., "Empty State: JA"): Kopf wie beim Skelett, darunter
       der Leerzustand der Charts aus core (UC.tabelleLeerHtml) in der Flaeche der n Skelettzeilen --
       zwischen Laden und Leer springt nichts. Vorher ein Kasten ohne Kopf mit einem Satz (70 hoch).
       Der Zustand steht NEBEN dem Spaltenscroller, nicht in ihm: ist die Tabelle breiter als ihr
       Kasten, saesse er sonst mittig ueber der ganzen Scrollbreite statt ueber dem Sichtbaren.
       Gefiltert wie die Charts der Seite (filterAktiv). */
    function tabelleLeer(name, n, o) {
      if (!UC.tabelleLeerHtml) return '<div class="up-box">' + UC.leerHtml({ mini: true, titel: o.alt }) + '</div>';
      return '<div class="up-box ush-box"><div class="up-colscroll"><div class="up-colscroll-innen">' +
          '<div class="up-thead">' + kopfAus(name) + '</div></div></div>' +
        UC.tabelleLeerHtml({ icon: o.icon, text: o.text, gefiltert: filterAktiv(), zeilen: n }) + '</div>';
    }
    function fehlerKasten(a, was) {
      var code = fehlerVon(a);
      var titel = was === "detail" ? "This product could not be loaded" : "Shopping data could not be loaded";
      var text = code === "leer" || code === "x" ? "The data could not be read. Please reload the page." : fehlerText(code);
      /* Ein Filter, den es nicht mehr gibt: erneut laden aendert nichts, also der Knopf, der ihn raeumt. */
      if (code === "filter_gone") return UC.leerHtml({ icon: "info", titel: titel, text: text, knopf: "Clear filters", knopfAttr: "data-ush-filterweg" });
      return UC.leerHtml({ icon: "info", titel: titel, text: text, knopf: "Try again", knopfAttr: 'data-ush-nochmal="' + esc(a.kanal) + '"' });
    }
    /* o.explain: der Schluessel aus ERKLAER, kpiKarte setzt damit das Info-Zeichen. o.satz / o.wert: was die Karte dieser Kachel
       zusaetzlich zeigt (kachelKarte oben). o.fussHtml nur noch fuer einen ZUSTAND (eigene Marke fehlt) oder den Namen des
       Wettbewerbers, nie fuer eine Erklaerung. */
    function kpiHtml(o) {
      o.klasse = (o.klasse ? o.klasse + " " : "") + "ush-kpi";
      if (o.explain) kachelKarte[o.explain] = { satz: o.satz || null, wert: o.wert || "" };
      return UC.kpiKarte ? UC.kpiKarte(o) : "";
    }
    /* Das Skelett einer Reihe ohne Fusszeilen, in den Faechern der Kachel (core kpiKarteSkelett fuss): so hoch wie die fertige
       Kachel. fuss: je Kachel die Zahl ihrer Fusszeilen, wo eine stehen bleibt (Name des Wettbewerbers). */
    function kpiSkelett(n, fuss) {
      var h = "";
      for (var i = 0; i < n; i++) h += UC.kpiKarteSkelett ? UC.kpiKarteSkelett("ush-kpi", { fuss: (fuss && fuss[i]) || 0 }) : "";
      return h;
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
        /* Das Band von Movement und Distribution hat ohne Inhalt nur noch seine Linien -- es geht
           ganz weg, statt als leerer Streifen dazustehen. */
        sek("zwei").hidden = true;
        if (linie) linie.meldung(t("Shopping data could not be loaded"));
        return;
      }
      sek("zwei").hidden = false;
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
      if (!d) { el.innerHTML = kpiSkelett(4); return; }
      kachelnNeu();
      var meta = d.meta || {}, k = d.kpis || {}, ohneEigene = meta.own_company_set !== true || eigeneOhneTreffer(meta);
      var reihen = [
        ["Shopping Rate", "shoppingRate", kz(k.shopping_rate), false],
        ["Brand Presence", "presence", kz(k.brand_presence), true],
        ["Share of Shelf", "share", kz(k.share_of_shelf), true],
        ["First Position Rate", "firstBrand", kz(k.first_position_rate), true]
      ];
      /* Der Vergleichszeitraum ("vs. ...") steht in der Karte (vergleichSatz). Unter der Kachel bleibt nur der ZUSTAND ohne
         eigene Marke: er sagt, warum dort ein Strich steht und was zu tun ist. */
      el.innerHTML = reihen.map(function (r) {
        var leer = r[3] && ohneEigene;
        return kpiHtml({ label: r[0], explain: r[1], wertHtml: leer ? '<span class="up-num is-empty">–</span>' : zaehlWert("pct", r[2].v),
          trendHtml: leer ? "" : trend("pct", r[2].d, meta),
          satz: leer ? null : function () { return vergleichSatz(meta); },
          fussHtml: leer ? esc(t(meta.own_company_set === true ? "No products matched your brand" : "Set up your own brand to see your brand metrics.")) : "" });
      }).join("");
      hochzaehlen(el);
    }

    /* ---- Diagramme ----------------------------------------------------------------------------- */
    function zeichneChart() {
      if (!linie) return;
      var s = state.seite;
      if (s === "detail") { zeichneDetailChart(); return; }
      var d = s === "brands" ? overviewGleicherFilter() : dieOverview();
      if (!d) {
        var a = s === "brands" ? ovAnfrage(state.brands) : ovAnfrage(OV_VORGABE);
        if (fehlerVon(a)) linie.meldung(t("Shopping data could not be loaded")); else linie.skeleton();
        return;
      }
      var ch = d.chart && typeof d.chart === "object" ? d.chart : {};
      var tage = isArr(ch.days) ? ch.days.map(function (x) { return str(x).slice(0, 10); }).filter(function (x) { return /^\d{4}-\d{2}-\d{2}$/.test(x); }) : [];
      var reihen = isArr(ch.series) ? ch.series.filter(function (x) { return x && typeof x === "object"; }) : [];
      /* Overview: die Top 5 (in_top5, die eigene immer dabei); Brands: alle (hoechstens 6). Die
         eigene ohne Treffer faellt heraus (Entwurf: "own brand hidden from charts"). */
      if (s === "overview") reihen = reihen.filter(function (x) { return x.in_top5 === true; });
      if (eigeneOhneTreffer(d.meta)) reihen = reihen.filter(function (x) { return x.is_own !== true; });
      var feld = metrikJetzt();
      /* LEER IST NICHT GLEICH LEER (13.10. gemeldet: "Shopping Rate von 0.1%, aber das Linechart
         sagt 'Keine Daten'"). Die Kachel zaehlt ALLE Runs mit Shopping-Ergebnis, das Chart nur die
         getrackten Marken darin -- kam in den Ergebnissen keine vor, ist das Chart zu Recht leer,
         aber das nackte "No data" las sich wie ein Widerspruch zur Kachel. Darum sagt jeder Fall,
         WAS fehlt: ohne Tage ist die Antwort kaputt (Lesefehler, nicht "leer"), ohne Reihe kam
         keine Marke vor, und ohne einen einzigen Wert fehlt genau diese Kennzahl. Dass es gar keine
         Shopping-Ergebnisse gab, faengt schon leerZustand fuer die ganze Seite ab. */
      if (!tage.length) { linie.meldung(t("The chart data could not be read.")); return; }
      /* Ohne Reihe und ohne Wert ist das Chart LEER, nicht kaputt: der Leerzustand der Charts aus
         core (15.10.) mit dem Satz, was fehlt -- und "No matching data", wenn ein Filter steht. */
      var markeFehlt = "No tracked brand appeared in AI shopping results in this range.";
      if (!reihen.length) { linie.empty({ text: markeFehlt, gefiltert: filterAktiv() }); return; }
      /* WIE JEDES LINIENCHART DER APP (05.10. gemeldet: Farben und Legende folgten den
         Einstellungen nicht):
         - die Datensaetze baut UC.buildLineDatasets wie in Visibility- und Brands-Chart, mit der
           Farbskala aus den Einstellungen; "Brand Colors" nimmt die Farbe der Marke aus der Antwort.
           Die Reihenfolge der Antwort bleibt (visibility_window_pct absteigend), damit eine Marke
           beim Wechsel der Kennzahl ihre Farbe behaelt;
         - die Legende folgt "Legende zeigen" (legendeImmer nur im Detail, siehe makeLine oben);
         - KEINE DATEN SIND KEINE 0 (13.10., dieselbe Regel wie buildLineDatasets in core): hier
           stand "ein Tag ohne Wert steht auf 0". Die Uebergabe sagt das Gegenteil -- null heisst
           "an dem Tag gar keine Shopping-Antwort, die Linie dort unterbrechen", 0 heisst "Antwort
           da, Marke nicht drin" --, und in der echten Antwort vom 13.10. waren 7 von 11 Tagen null:
           alle Linien fielen dort auf 0 Prozent, als haette jede Marke an dem Tag verloren. null
           bleibt jetzt null, __luecken bricht die Linie dort ab. Die Position kannte das schon. */
      var punkte = [], firmen = [], irgendeinWert = false;
      reihen.forEach(function (r, i) {
        var id = str(r.company_id).trim() || ("r" + i), proTag = {};
        (isArr(r.points) ? r.points : []).forEach(function (p) { if (p && p.day) proTag[str(p.day).slice(0, 10)] = metrikWert(feld, p[feld]); });
        var werte = tage.map(function (tg) { return proTag[tg] == null ? null : proTag[tg]; });
        /* Eine Marke ganz ohne Wert (Position: kam nie vor) bleibt aus Linie UND Legende -- wie
           bisher, als ihre Punkte gar nicht erst entstanden. 0 ist ein Wert und bleibt drin. */
        if (!werte.some(function (v) { return v != null; })) return;
        irgendeinWert = true;
        tage.forEach(function (tg, j) { punkte.push({ company_id: id, day: tg, visibility_pct: werte[j] }); });
        firmen.push({ company_id: id, name: str(r.name).trim() || t("Other"), favicon_url: logoUrl(r.logo_url),
                      color: /^#[0-9a-f]{3,8}$/i.test(str(r.color).trim()) ? str(r.color).trim() : null,
                      visibility_window_pct: reihen.length - i });
      });
      /* Kein einziger Wert fuer diese Kennzahl: die Position ist null, wo die Marke nicht vorkommt
         (Uebergabe), also heisst das dasselbe wie "keine Reihe". Jede andere Kennzahl nennt sich
         selbst -- die Achse mit null Linien sahe sonst wie ein Ladefehler aus. */
      if (!irgendeinWert) {
        linie.empty({ text: feld === "avg_position" ? markeFehlt : ersetze(t("No {metric} values in this range."), { metric: t(metrikLabel()) }),
                      gefiltert: filterAktiv() });
        return;
      }
      var bau = UC.buildLineDatasets(punkte, firmen, UC.getColorScalePref ? UC.getColorScalePref() : null);
      /* buildLineDatasets laesst leere Randtage weg (13.10.) -- die Achse hier sind aber alle Tage
         des Zeitraums (Uebergabe: "X-Achse: chart.days"), also auf chart.days zurueckgelegt. Bei
         Shopping ist ein leerer Tag Information: an sechs Tagen ohne ein einziges Shopping-Ergebnis
         endet die Linie sichtbar, statt dass die Achse den Zeitraum still verkuerzt.
         __luecken: null unterbricht die Linie (makeLine), ein einzelner Tag zwischen zwei Luecken
         bekommt dort seinen Punkt -- sonst waere er ohne Nachbarn unsichtbar. */
      var stelleVon = {};
      bau.labels.forEach(function (l, i) { stelleVon[l] = i; });
      bau.datasets.forEach(function (ds) {
        var alt = ds.data;
        ds.data = tage.map(function (tg) { return stelleVon[tg] != null ? alt[stelleVon[tg]] : null; });
        ds.__luecken = true;
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
      if (!l.length) { platz.innerHTML = tabelleLeer("landscape", 5, { icon: "squareStack", alt: "No brands yet" }); spaltenAnwenden("landscape"); return; }
      platz.innerHTML = tabelleHtml(kopfAus("landscape"), l.map(function (b) { return markeZeileOv(b, meta); }).join(""), "ush-klickbar");
      spaltenAnwenden("landscape");
    }
    function markeZeileOv(b, meta) {
      var sos = kz(b.share_of_shelf), andere = b.type === "other" || !b.company_id;
      return '<div class="up-row ush-zeile' + (andere ? " is-andere" : "") + '"' + (andere ? '' : ' data-marke="' + esc(b.company_id) + '" data-marke-name="' + esc(str(b.name).trim()) + '" role="link" tabindex="0"') + '>' +
        '<div class="up-td">' + markeLogo(b) + markeName(b, "", true) + duMarke(b, meta) + '</div>' +
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
      if (!l.length) { platz.innerHTML = tabelleLeer("topprodukte", 5, { icon: "stackStar", alt: "No products yet" }); spaltenAnwenden("topprodukte"); return; }
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
      /* Leer: der Zustand der Tabellen neben den Charts (15.10. spaet, UC.tabelleLeerHtml) in der
         Flaeche der vier Skelettzeilen oben -- vorher UC.leerHtml im Fluss (246 hoch gegen 288 im
         Skelett, das Band sprang beim Laden um 42). Im Band liegt er wie der Leerzustand von
         Merchant Distribution daneben ueber dem ganzen Kasten, gleiche Mitte und gleiche Stufe. */
      if (!vergleich(meta) || (!steigt.length && !faellt.length)) {
        var lo = { icon: "chartSpline", titel: "Not enough history yet",
          text: "Product Movement needs a comparison period. It appears once there is data from before this range." };
        el.innerHTML = kopf + '<div class="up-box">' + (UC.tabelleLeerHtml ? UC.tabelleLeerHtml({ icon: lo.icon, titel: lo.titel, text: lo.text, zeilen: 4 }) : UC.leerHtml(lo)) + '</div>';
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
        '<div class="up-box ush-balkenbox up-band-flaeche up-band-inhalt"><div class="ush-balkenplatz"></div></div>';
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
      /* Leer: der Leerzustand der Balkenliste aus core (15.10., kompakt: Zeichen und Titel). */
      if (!items.length) { balken.ov.render([], { leer: { titel: "No merchants yet" } }); return; }
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
      /* Marke, Haendler und Segment der Produkte (05.10. als Knoepfe hier gebaut) stehen seit dem
         15.10. als Zeilen im Menue "Filters" der Filterzeile (FF_ARTEN oben) -- sie aendern die
         Daten, und in die Werkzeugleiste gehoert nur, was die Ansicht aendert. */
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
          var rh = e.target.closest("[data-rowheight]");
          if (rh) { dichteSetzen(s, rh.getAttribute("data-rowheight") === "compact"); spe.kit.populateCols(); return; }
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
        /* Das X eines Chips im Rueckfall ohne die Filter der Leiste (scopeZeigen). */
        var sc = e.target.closest("[data-ush-scopeweg]");
        if (sc) prodFilter(sc.getAttribute("data-ush-scopeweg") === "marke" ? "marke" : "haendler", null);
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
      /* Seit dem 15.10. steht die Zahl in der Gesamtzeile unter der Tabelle (zaehlEinhaengen) und im
         Pager ("1-15 of 440"); eine dritte im Kopf von Recent Appearances wiederholte sie nur. */
      if (UC.makeZaehlZeile) n = null;
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
    /* zahl: die Gesamtzahl fuer die Gesamtzeile -- eine Zahl, null (unlesbar, unbekannt) oder
       "laedt" (Skelett). */
    function tabInhalt(html, dimmen, zahl) {
      var w = tabWurzel();
      if (!w) return;
      w.classList.toggle("is-reloading", !!dimmen);
      w.querySelector(".ush-tabelle").innerHTML = html;
      zaehlStand = zahl === undefined ? null : zahl;
      zaehlEinhaengen(w);
      /* Kopf und Gesamtzeile aus dem Scrollkasten in ihre Halter, damit sie an der Seite kleben (core colscrollTeilen). */
      if (UC.colscrollTeilen) UC.colscrollTeilen(w.querySelector(".up-box"));
      /* Der klebende Fuss braucht den Kasten der Tabelle (core klebFuss sucht ihn beim Einrichten): er kommt erst mit den Daten, also danach noch einmal. */
      if (tabKleber) tabKleber.applySticky();
    }
    /* DIE GESAMTZEILE (15.10. abends, core UC.makeZaehlZeile): unter den Zeilen jeder ganzen
       Tabelle (Products, Brands, Merchants, Recent Appearances) vorerst nur die Anzahl links --
       die Gesamtzahl des Servers (total_count), nicht die Zeilen der Seite; ein Lesefehler ist
       "–". Ausblendbar ueber Display ("Summary row"), gemerkt je Tabelle. Die Vorschauen der
       Uebersicht und des Details bekommen keine: sie zeigen die ersten Eintraege, und "View all"
       fuehrt zur ganzen Tabelle mit ihrer Zahl.
       DIE ZEILE STEHT IM SCROLLKASTEN, hinter .up-tbody in .up-colscroll-innen: so scrollt sie mit
       den Spalten waagerecht mit. Weil tabInhalt den Kasten bei jedem Zeichnen neu schreibt
       (innerHTML), wird DIESELBE Zeile danach wieder hinter den neuen Koerper gehaengt -- ein
       Neubau je Zeichnen haette jedes Mal ein neues Popover angelegt. Ohne Koerper (Leer- und
       Fehlerzustand) bleibt sie draussen; der Zustand sagt dann selbst, was ist. */
    /* DIE BERECHNUNGEN JE SPALTE (15.10. spaet, vom Nutzer abgenommen: "exakt so umsetzen"; Median
       nur beim Preis). feld: Schluessel der Antwort (SUMME_FELDER oben), art: Format nach CLAUDE.md
       2b, kurz: Bezeichnung in der Zelle (klein wie in der Prompt-Tabelle), label: im Menue und im
       Tooltip. Der Preis steht wie in seiner Zelle (geld, preisSpanne: "€19.62–€21.62"), die
       Waehrung kommt mit (price_currency). Nie ueber die sichtbare Seite gerechnet. */
    function preisText(v, c) { return geld(v, c) || null; }
    var SUM_RECHNEN = {
      products: {
        vis: [{ key: "avg", label: "Overall average", kurz: "avg", feld: "avg_visibility_pct", art: "pct" }],
        obs: [{ key: "summe", label: "Total", kurz: "total", feld: "observations_total", art: "anzahl" }],
        pos: [{ key: "avg", label: "Overall average", kurz: "avg", feld: "avg_position", art: "rang" }],
        first: [{ key: "avg", label: "Overall average", kurz: "avg", feld: "avg_first_position_rate_pct", art: "pct" }],
        price: [
          { key: "median", label: "Median", kurz: "median", feld: "price_median", felder: ["price_currency"], art: "text",
            wert: function (d) { return preisText(d.price_median, d.price_currency); } },
          { key: "spanne", label: "Range", kurz: "range", felder: ["price_min", "price_max", "price_currency"], art: "text",
            wert: function (d) {
              var a = preisText(d.price_min, d.price_currency), b = preisText(d.price_max, d.price_currency);
              if (!a || !b || num(d.price_min) === num(d.price_max)) return a || b;
              return a + "–" + b;
            } }
        ],
        rating: [{ key: "avg", label: "Overall average", kurz: "avg", feld: "avg_rating", art: "rang" }],
        merchants: [{ key: "genutzt", label: "Merchants used", kurz: "merchants", feld: "merchants_used", art: "anzahl" }]
      },
      brands: {
        share: [
          { key: "eigen", label: "Your share", kurz: "yours", feld: "own_share_pct", art: "pct" },
          { key: "top3", label: "Top 3 share", kurz: "top 3", feld: "top3_share_pct", art: "pct" }
        ],
        products: [{ key: "summe", label: "Total", kurz: "total", feld: "products_total", art: "anzahl" }],
        obs: [{ key: "summe", label: "Total", kurz: "total", feld: "observations_total", art: "anzahl" }],
        pos: [{ key: "avg", label: "Overall average", kurz: "avg", feld: "avg_position", art: "rang" }],
        /* "4 / 2": Marken mit steigendem und mit fallendem Share gegenueber dem Vorzeitraum. */
        change: [{ key: "richtung", label: "Rising / falling", kurz: "rising / falling", felder: ["rising_count", "falling_count"], art: "text",
          wert: function (d) {
            var a = anzahlWert(d.rising_count), b = anzahlWert(d.falling_count);
            return a == null || b == null ? null : ganz(a) + " / " + ganz(b);
          } }]
      },
      merchants: {
        share: [{ key: "top3", label: "Top 3 share", kurz: "top 3", feld: "top3_share_pct", art: "pct" }],
        products: [{ key: "summe", label: "Total", kurz: "total", feld: "products_total", art: "anzahl" }],
        obs: [{ key: "summe", label: "Total", kurz: "total", feld: "observations_total", art: "anzahl" }],
        pos: [{ key: "avg", label: "Overall average", kurz: "avg", feld: "avg_position", art: "rang" }]
      }
    };
    var zaehl = null, zaehlStand = null;
    function zaehlEinhaengen(w) {
      var tab = sek("tabelle"), tbody = w.querySelector(".up-tbody"), s = state.seite;
      if (!tab || !tbody || !UC.makeZaehlZeile) return;
      if (!zaehl || zaehl.tab !== tab) {
        var kit = UC.makeZaehlZeile({
          root: tab, nach: tbody, instanceId: instanceId + "__" + s, praefix: "ush",
          cols: function () { var e = spalten[s]; return e ? e.kit : null; },
          spalten: function () { return TABELLEN[s].spalten.map(function (c) { return c.key; }); },
          anzahl: function () { return typeof zaehlStand === "number" ? zaehlStand : null; },
          laedt: function () { return zaehlStand === "laedt"; },
          /* Recent Appearances (detail) hat keine Berechnungen: dort nur die Anzahl. */
          rechnen: SUM_RECHNEN[s] || null,
          quelle: SUM_RECHNEN[s] ? summenQuelle(s) : null
        });
        zaehl = { tab: tab, kit: kit, el: tbody.parentNode.querySelector(":scope > .up-sumrow") };
      } else if (zaehl.el && zaehl.el.previousElementSibling !== tbody) {
        tbody.parentNode.insertBefore(zaehl.el, tbody.nextSibling);
      }
      zaehl.kit.zeichnen();
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
      scopeZeigen(tab);
      zaehlerSetzen(d ? anzahlWert(d.total_count) : null);
      var kopf = kopfAus("products");
      if (!d) {
        if (fehlerVon(a)) { tabInhalt('<div class="up-box">' + fehlerKasten(a) + '</div>'); pagerSetzen("products", null); return; }
        if (vorige.prod && vorige.prodFilter === filterSig()) { tabInhalt(vorige.prod, true, vorige.prodTotal); spaltenAnwenden("products"); pagerSetzen("products", vorige.prodTotal, true); sortSync("products"); return; }
        tabInhalt(tabelleHtml(kopf, skelettAus("products", 6), "ush-produkte"), false, "laedt");
        spaltenAnwenden("products"); pagerSetzen("products", null, true); sortSync("products");
        return;
      }
      var rows = (isArr(d.rows) ? d.rows : []).filter(function (p) { return p && typeof p === "object" && str(p.source_product_id).trim(); });
      if (!rows.length) {
        var gef = !!(tb.suche || tb.marke || tb.haendler || tb.seg !== "all" || filterAktiv());
        tabInhalt('<div class="up-box">' + UC.leerHtml({ gefiltert: gef, was: "products", icon: "stackStar",
          titel: gef ? "No matching products" : "No products yet",
          text: gef ? (tb.suche ? ersetze(t("No product title, listing or brand contains “{q}”."), { q: tb.suche }) : leerSatzFilter(tb)) : "",
          knopf: gef ? "Clear search and filters" : "", knopfAttr: "data-ush-prodweg" }) + '</div>');
        pagerSetzen("products", 0); sortSync("products");
        return;
      }
      var html = tabelleHtml(kopf, rows.map(function (p) { return prodZeile(p, meta, tb.suche); }).join(""), "ush-produkte ush-klickbar");
      vorige.prod = html; vorige.prodTotal = gesamt(d.total_count, tb, rows.length); vorige.prodFilter = filterSig();
      zaehlerSetzen(vorige.prodTotal);
      tabInhalt(html, false, vorige.prodTotal);
      spaltenAnwenden("products");
      pagerSetzen("products", vorige.prodTotal);
      sortSync("products");
    }
    /* DER LEERZUSTAND NENNT DEN FILTER (22.10., Lukas: Marke und Haendler als Filter, "wie immer"): kommt die Tabelle mit
       einer Marke oder einem Haendler aus einem Klick leer zurueck (die eigene Marke ohne Treffer in Brands), sagt der Satz,
       welcher Filter es ist -- der Chip steht oben in der Leiste, der Knopf darunter raeumt ihn. */
    function leerSatzFilter(tb) {
      var mk = tb.marke && tb.marke.id ? (str(tb.marke.name).trim() || (markenListe().filter(function (x) { return x.key === str(tb.marke.id); })[0] || {}).label || "") : "";
      var hd = str(tb.haendler).trim();
      if (mk && hd) return ersetze(t("No observed products of {brand} were listed with {merchant} in these filters."), { brand: mk, merchant: hd });
      if (mk) return ersetze(t("No observed products of {brand} match these filters."), { brand: mk });
      if (hd) return ersetze(t("No observed products were listed with {merchant} in these filters."), { merchant: hd });
      return "No observed products match these filters.";
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
        td("brand", markeFilterChip(b, meta, q)) +
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
    /* RUECKFALL OHNE DIE FILTER DER LEISTE (core zu alt, ohne UC.makeLeistenFilter): dann gibt es
       keine Zeilen im Menue "Filters", und eine Wahl aus einem Klick (Marke in Brands, Haendler in
       den Balken) waere unsichtbar und nicht mehr aufzuheben. Dann steht sie als Chip ueber der
       Tabelle, mit X -- wie vor dem 05.10. Mit den Filtern der Leiste bleibt der Platz leer. */
    function scopeZeigen(tab) {
      var el = tab.querySelector(".ush-scope"), tb = state.products, teile = [];
      if (!el) return;
      if (!ffKit) {
        if (tb.marke && tb.marke.id) teile.push(["marke", "Brand", str(tb.marke.name) || "–", "squareStack"]);
        if (tb.haendler) teile.push(["haendler", "Merchant", str(tb.haendler), "store"]);
      }
      el.hidden = !teile.length;
      el.innerHTML = teile.map(function (x) {
        return '<span class="up-entchip is-static ufb-chip ush-scopechip">' +
          '<span class="ufb-chip-ic">' + UC.icon(x[3], 2) + '</span>' +
          '<span class="ufb-chip-lbl"><span class="ufb-chip-key">' + esc(t(x[1])) + ': </span>' + esc(x[2]) + '</span>' +
          '<button class="ufb-chip-x" type="button" data-ush-scopeweg="' + x[0] + '" aria-label="' + esc(t("Clear")) + '" data-tip="' + esc(t("Clear")) + '">' + UC.icon("x", 2.6) + '</button></span>';
      }).join("");
    }
    function haendlerHolen() {
      var a = meAnfrage(HAENDLER_LISTE);
      if (state.cache.merchants[a.sig] || unterwegs.merchants || state.fehler[a.kanal + a.sig]) return;
      senden(a);
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
        /* Die vierte Kachel behaelt ihre Fusszeile (der Name des Wettbewerbers), das Skelett traegt dort eine. */
        el.innerHTML = fehlerVon(a) ? '<div class="ush-kpifehler">' + fehlerKasten(a) + '</div>' : kpiSkelett(4, [0, 0, 0, 1]);
        return;
      }
      kachelnNeu();
      var meta = d.meta || {}, bs = d.brands_summary && typeof d.brands_summary === "object" ? d.brands_summary : {};
      var ohneEigene = meta.own_company_set !== true || eigeneOhneTreffer(meta);
      var tc = bs.top_competitor && typeof bs.top_competitor === "object" ? bs.top_competitor : null;
      var n = num(bs.tracked_brands_observed), sos = kz(bs.own_share_of_shelf);
      var rang = ohneEigene ? null : posWert(bs.own_rank);
      var leerFuss = esc(t(meta.own_company_set === true ? "No products matched your brand" : "Set up your own brand to see your brand metrics."));
      /* ERKLAERUNGEN IN DIE KARTE (22.10. abends): "Tracked brands. Unassigned products are not counted." sagte der Satz der
         Karte schon ("Products without a tracked brand are not counted.") -- er faellt ersatzlos weg. "of 31 by Share of Shelf"
         wird "#3 of 31 by Share of Shelf." in der Karte, mit dem echten Rang auf der Platte; "vs. ..." wird vergleichSatz.
         Unter der Kachel bleiben der Zustand ohne eigene Marke und der NAME des Wettbewerbers: die Kachel zeigt sonst nur sein
         Logo, und wer der staerkste Wettbewerber ist, ist ein Messwert, keine Erklaerung ("Share of Shelf of" faellt weg, das
         sagt die Karte). */
      el.innerHTML =
        kpiHtml({ label: "Brands observed", explain: "brandsObserved", wertHtml: zaehlWert("ganz", n) }) +
        kpiHtml({ label: "Your rank", explain: "ownRank", wertHtml: rang == null ? '<span class="up-num is-empty">–</span>' : '<span class="up-num">#' + esc(ganz(rang)) + '</span>',
          wert: rang != null && anzahlWert(n) != null ? "#" + ganz(rang) : "",
          satz: rang != null && anzahlWert(n) != null ? function () { return ersetze(t("#{rank} of {n} by Share of Shelf."), { rank: ganz(rang), n: ganz(n) }); } : null,
          fussHtml: ohneEigene ? leerFuss : "" }) +
        kpiHtml({ label: "Your Share of Shelf", explain: "share", wertHtml: ohneEigene ? '<span class="up-num is-empty">–</span>' : zaehlWert("pct", sos.v),
          trendHtml: ohneEigene ? "" : trend("pct", sos.d, meta),
          satz: ohneEigene ? null : function () { return vergleichSatz(meta); }, fussHtml: ohneEigene ? leerFuss : "" }) +
        kpiHtml({ label: "Top competitor", explain: "topCompetitor", wertHtml: tc && anteilWert(tc.share_of_shelf) != null ? '<span class="ush-kpi-marke">' + markeLogo(tc) + zaehlWert("pct", tc.share_of_shelf) + '</span>' : '<span class="up-num is-empty">–</span>',
          fussHtml: tc && str(tc.name).trim() ? esc(str(tc.name).trim()) : "" });
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
        if (vorige.marke && vorige.markeFilter === filterSig()) { tabInhalt(vorige.marke, true, vorige.markeTotal); spaltenAnwenden("brands"); pagerSetzen("brands", vorige.markeTotal, true); sortSync("brands"); return; }
        tabInhalt(tabelleHtml(kopf, skelettAus("brands", 6)), false, "laedt");
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
      tabInhalt(html, false, vorige.markeTotal);
      spaltenAnwenden("brands");
      pagerSetzen("brands", vorige.markeTotal);
      sortSync("brands");
    }
    function markenZeile(b, meta, angepinnt, q) {
      var sos = kz(b.share_of_shelf), andere = b.type === "other" || !b.company_id;
      var tp = b.top_product && typeof b.top_product === "object" && str(b.top_product.source_product_id).trim() ? b.top_product : null;
      return '<div class="up-row ush-zeile' + (andere ? " is-andere" : "") + (angepinnt ? " is-angepinnt" : "") + '"' +
          (andere ? '' : ' data-marke="' + esc(b.company_id) + '" data-marke-name="' + esc(str(b.name).trim()) + '" role="link" tabindex="0"') + '>' +
        '<div class="up-td">' + markeLogo(b) + markeName(b, q, true) + duMarke(b, meta, true) + '</div>' +
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
        el.innerHTML = fehlerVon(a) ? '<div class="ush-kpifehler">' + fehlerKasten(a) + '</div>' : kpiSkelett(3);
        return;
      }
      kachelnNeu();
      var s = d.summary && typeof d.summary === "object" ? d.summary : {};
      var tm = s.top_merchant && typeof s.top_merchant === "object" ? s.top_merchant : null;
      var name = tm ? haendlerName(tm.merchant_name) : "";
      /* ERKLAERUNGEN IN DIE KARTE (22.10. abends): "Across 120 products" und "412 of 1,603 merchant mentions" als Satz der
         Karte, mit dem Wert der Kachel auf der Platte. "Most listed with observed products" sagte der Satz der Karte von Top
         merchant schon ("The merchant listed most often with the observed products") -- er faellt ersatzlos weg. */
      var mz = anzahlWert(s.merchants), pz = anzahlWert(s.products), ts = tm ? anteilWert(tm.share) : null;
      var tmN = tm ? anzahlWert(tm.observations) : null, alleN = anzahlWert(s.observations);
      el.innerHTML =
        kpiHtml({ label: "Merchants observed", explain: "merchantsObserved", wertHtml: zaehlWert("ganz", s.merchants),
          wert: pz != null && mz != null ? ganz(mz) : "",
          satz: pz != null ? function () { return ersetze(t("Across {n} products."), { n: ganz(pz) }); } : null }) +
        kpiHtml({ label: "Top merchant", explain: "topMerchant", wertHtml: tm ? '<span class="ush-kpi-text" title="' + esc(name || t("Unknown")) + '">' + esc(name || t("Unknown")) + '</span>' : '<span class="up-num is-empty">–</span>' }) +
        kpiHtml({ label: "Top merchant share", explain: "topMerchantShare", wertHtml: tm ? zaehlWert("pct", tm.share) : '<span class="up-num is-empty">–</span>',
          wert: tmN != null && alleN != null && ts != null ? pct(ts) : "",
          satz: tmN != null && alleN != null ? function () { return ersetze(t("{n} of {total} merchant mentions."), { n: ganz(tmN), total: ganz(alleN) }); } : null });
      hochzaehlen(el);
    }
    function zeichneHaendlerBalken(d, a) {
      var el = sek("balken");
      if (!el) return;
      if (!el.querySelector(".ush-balkenplatz")) el.innerHTML = sekKopf("Merchant Share", t("Share of all merchant mentions on observed products"), "", "merchant") +
        '<div class="up-box ush-balkenbox up-band-inhalt"><div class="ush-balkenplatz"></div></div>';
      var platz = el.querySelector(".ush-balkenplatz");
      if (!balken.me) balken.me = UC.makeBarList({ mount: platz, isDark: isDark, fmt: function (v) { return pct(v); } });
      if (!d) { if (fehlerVon(a)) platz.innerHTML = fehlerKasten(a); else balken.me.skeleton(6); return; }
      /* Ein Balken ohne lesbaren Anteil haette keine Laenge -- er faellt weg, die Tabelle darunter
         zeigt den Haendler trotzdem. */
      var l = (isArr(d.merchants) ? d.merchants : []).filter(function (m) { return m && typeof m === "object" && anteilWert(kz(m.share).v) != null; });
      if (!l.length) { balken.me.render([], { leer: { titel: "No merchants yet" } }); return; }
      /* Hoechstens ME_BALKEN Balken (20.10., Nutzer: der Chart "bedeckt fast die ganze Seite", er soll "so 10 Eintraege" zeigen): die Haendler
         danach stehen in der Tabelle darunter und als Rest-Balken ("{n} weitere Haendler", unten gerechnet aus den gezeigten). */
      l = l.slice(0, ME_BALKEN);
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
        if (vorige.me && vorige.meFilter === filterSig()) { tabInhalt(vorige.me, true, vorige.meTotal); spaltenAnwenden("merchants"); pagerSetzen("merchants", vorige.meTotal, true); sortSync("merchants"); return; }
        tabInhalt(tabelleHtml(kopf, skelettAus("merchants", 6)), false, "laedt");
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
      tabInhalt(html, false, vorige.meTotal);
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
        if (linie) linie.meldung(t("This product could not be loaded"));
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
          '<div class="up-kpiband is-4 ush-kpis">' + kpiSkelett(4) + '</div></div>';
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
      /* OHNE FUSSZEILE (22.10., Lukas zu "vs. 09. Oct – 15. Oct 2026": "weg damit"): die Kacheln des Produkts nennen
         den Vergleichszeitraum nicht mehr (seit 22.10. abends auch Overview und Brands nicht: er steht dort in der Karte,
         vergleichSatz). Das Skelett oben steht dafuer ohne Fusszeile (kpiSkelett): 82 wie die Kachel, gemessen; bis zur
         eigenen Etikettregel in shopping.css (inline-flex, weg seit 22.10. abends) waren es 77, das Etikett des Skeletts
         wurde so hoch wie sein 12er-Balken statt wie eine Textzeile (17). */
      kachelnNeu();
      function kachel(label, key, wert, trendH, spark) {
        /* Die Sparkline steht rechts in der Zeile des Werts, hinter dem Trend (Entwurf: 72 x 24). */
        return kpiHtml({ label: label, explain: key, wertHtml: wert, trendHtml: (trendH || "") + (spark ? '<span class="ush-spark">' + spark + '</span>' : '') });
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
          kachel("Visibility", "vis", zaehlWert("pct", kv.v), trend("pct", kv.d, meta), UC.sparkHtml ? UC.sparkHtml(reihe("visibility")) : "") +
          kachel("Observations", "obs", zaehlWert("ganz", ko.v), trend("anzahl", ko.d, meta), UC.sparkHtml ? UC.sparkHtml(reihe("observations")) : "") +
          kachel("Avg. Position", "pos", zaehlWert("pos", kp.v), trend("pos", kp.d, meta), UC.sparkHtml ? UC.sparkHtml(reihe("avg_position"), { umgekehrt: true }) : "") +
          kachel("First Position Rate", "firstProd", zaehlWert("pct", kf.v), trend("pct", kf.d, meta), "") +
        '</div></div>';
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
      var a = detailAnfrage(), d = dasDetail();
      if (!d) { if (fehlerVon(a)) linie.meldung(t("This product could not be loaded")); else linie.skeleton(); return; }
      var tr = (isArr(d.trend) ? d.trend : []).filter(function (x) { return x && /^\d{4}-\d{2}-\d{2}/.test(str(x.day)); });
      if (!tr.length) { linie.empty(); return; }
      var p = d.product || {}, b = p.brand && typeof p.brand === "object" ? p.brand : { type: "other" };
      var feld = state.dMetrik;
      var tinte = UC.chartInk ? UC.chartInk(root) : UC.accentInk ? UC.accentInk(root) : token("--vc-text");
      var grau = token("--vc-fourth");
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
        if (!l.length) { bl.render([]); return; }
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
          return { key: w + i, name: name, share: anteilWert(x.share), color: grau(i + 1), logo: logo, modell: w === "models",
                   flagge: w === "markets" ? (/^[A-Z]{2}$/.test(code) ? code : "?") : undefined,
                   wert: w === "topics" && r != null ? ersetze(t(r === 1 ? "{n} response" : "{n} responses"), { n: ganz(r) }) : undefined };
        }));
      });
    }
    function modellInfo(key) {
      var k = str(key).trim(), l = UC.getModels ? UC.getModels() : [];
      /* Fuer die Balkenliste (modell: true, core is-modell): im Dunkeln ohne helle Platte (23.10.), also OpenAI nach dem Thema. */
      for (var i = 0; i < l.length; i++) if (str(l[i].key || l[i].model) === k) {
        return { name: str(l[i].display_name || k), logo: sichereUrl(UC.modelLogoUrl ? UC.modelLogoUrl(k, l[i].logo_url, isDark(), l[i].provider) : l[i].logo_url) };
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
      /* Ohne Erklaerkarte (22.10., Lukas: "an die Stelle muss ueberhaupt kein Tooltip"): am Titel stand die Karte Merchant
         Share -- die Kennzahl einer Spalte, nicht der Abschnitt. Die Spalten darunter tragen ihre eigenen Karten. */
      var platz = vorschauPlatz(el, "dhaendler", sekKopf("Merchants", ""));
      if (!d) { platz.innerHTML = tabelleHtml(kopfAus("dhaendler"), skelettAus("dhaendler", 3)); spaltenAnwenden("dhaendler"); return; }
      var l = (isArr(d.merchants) ? d.merchants : []).filter(function (m) { return m && typeof m === "object"; });
      if (!l.length) {
        platz.innerHTML = tabelleLeer("dhaendler", 3, { icon: "store", text: "No merchants were listed with this product.",
                                                        alt: "No merchants were listed with this product." });
        spaltenAnwenden("dhaendler");
        return;
      }
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
        if (vorige.auf && vorige.aufProdukt === state.produktId && vorige.aufFilter === filterSig()) { tabInhalt(vorige.auf, true, vorige.aufTotal); spaltenAnwenden("detail"); pagerSetzen("detail", vorige.aufTotal, true); return; }
        tabInhalt(tabelleHtml(kopf, skelettAus("detail", 5)), false, "laedt");
        spaltenAnwenden("detail"); pagerSetzen("detail", null, true);
        return;
      }
      var rows = ap && isArr(ap.rows) ? ap.rows.filter(function (r) { return r && typeof r === "object"; }) : [];
      if (!rows.length) {
        tabInhalt(tabelleLeer("detail", 5, { icon: "messageCircle", text: "No appearances in this range.", alt: "No appearances in this range." }));
        spaltenAnwenden("detail"); pagerSetzen("detail", 0);
        return;
      }
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
        var promptText = str(r.prompt_text).trim();
        /* Die ganze Zeile oeffnet die Antwort (Drawer wie in der Responses-Tabelle); ohne gueltige Id steht sie still. */
        return '<div class="up-row ush-zeile' + (pr ? '' : ' is-statisch') + '"' + (pr ? ' data-antwort="' + esc(pr) + '" role="link" tabindex="0"' : '') + '>' +
          '<div class="up-td ush-td-prompt">' + (promptText ? '<span class="ush-prompt-text">' + esc(promptText) + '</span>' : '<span class="up-num is-empty">–</span>') + '</div>' +
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
          td("date", '<span class="up-num">' + esc(datum(r.run_at || r.day)) + '</span>') +
        '</div>';
      }).join(""), "ush-auftritte ush-klickbar");
      vorige.auf = html; vorige.aufTotal = gesamt(ap.total_count, state.auftritte, rows.length); vorige.aufProdukt = state.produktId; vorige.aufFilter = filterSig();
      zaehlerSetzen(vorige.aufTotal);
      tabInhalt(html, false, vorige.aufTotal);
      spaltenAnwenden("detail");
      pagerSetzen("detail", vorige.aufTotal);
    }

    /* ---- Export (16.10.) ---------------------------------------------------------------------
       Der Knopf oeffnet den Export-Dialog der App (export-data.js) mit den Datensaetzen von
       Shopping, vorgewaehlt nach Reiter, und gibt ihm Zeitraum und Filter der Seite mit. Die
       Parameter je Datensatz sind die der Liste (Auftrag bubble/shopping_ads_export_db_auftrag_16_10.md)
       ohne Team und Zeitraum -- die setzt der Dialog aus seiner eigenen Auswahl. Was die Filterzeile
       gerade NICHT zeigt, geht nicht mit: die Filter der Produkttabelle und jede Suche nur auf ihrem
       Reiter, wie die Chips. Ob es die Funktionen schon gibt, prueft der Dialog selbst. */
    function exportKennung() {
      var k = str(root.getAttribute("data-export-instance")).trim();
      if (k && !/^[A-Z_]{3,}$/.test(k)) return k;
      var e = document.querySelector(".uex-root[data-instance]");
      k = e ? str(e.getAttribute("data-instance")).trim() : "";
      return k && !/^[A-Z_]{3,}$/.test(k) ? k : "";
    }
    function exportKontext() {
      var s = state.seite, f = state.filter, tb = state.products, aufProd = s === "products";
      var grund = grundBody();
      delete grund.p_team; delete grund.p_date_from; delete grund.p_date_to;
      function neu(extra) { return mit(mit({}, grund), extra || {}); }
      var prod = aufProd ? {
        p_segment: { you: 1, competition: 1, other: 1 }[tb.seg] ? tb.seg : null,
        p_search: suchText(tb.suche), p_merchant: tb.haendler ? str(tb.haendler) : null,
        p_company_id: markeId(tb) } : {};
      var detail = s === "detail" && state.produktId;
      /* Die lesbaren Werte, die der Dialog nicht selbst findet (16.10.): der Titel des Produkts
         (wie in den Krumen) und der Name der Marke, auf die die Produkttabelle gefiltert ist. Jeder
         Filter steht im Dialog als eigener Chip und laesst sich abwaehlen (export-data.js, SEITE). */
      var d = detail ? dasDetail() : null, titel = d && d.product ? str(d.product.title).trim() || str(d.product.listing_title).trim() : "";
      var namen = {};
      if (titel) namen.product = titel;
      if (prod.p_company_id && tb.marke && str(tb.marke.name).trim()) namen.company = str(tb.marke.name).trim();
      return {
        export_type: { products: "shop_products", brands: "shop_brands", merchants: "shop_merchants", detail: "shop_appearances" }[s] || "shop_products",
        date_from: f.von || "", date_to: f.bis || "", preset: f.preset || "",
        params: {
          shop_products: neu(mit(mit({}, prod), { p_order: orderOf("products", tb) })),
          shop_brands: neu({ p_search: s === "brands" ? suchText(state.brands.suche) : null, p_order: orderOf("brands", state.brands) }),
          shop_merchants: neu({ p_search: s === "merchants" ? suchText(state.merchants.suche) : null, p_order: orderOf("merchants", state.merchants) }),
          /* Im Product Detail die Auftritte DIESES Produkts (die Tabelle Recent Appearances). */
          shop_appearances: neu(detail ? { p_source_product_id: str(state.produktId) } : prod)
        },
        namen: namen
      };
    }
    function exportOeffnen() {
      var k = exportKennung(), auf = false;
      if (k && typeof window.upstreemExportOpen === "function") {
        try { auf = window.upstreemExportOpen(k, exportKontext()) !== false; } catch (e) { auf = false; }
      }
      /* Kein stilles Nichts: ohne Dialog auf der Seite sagt es der Knopf. */
      if (!auf && UC.toast) UC.toast(t("Export isn't available on this page"), { kind: "neutral" });
    }
    var elExport = root.querySelector(".ush-export");
    if (elExport) elExport.addEventListener("click", function (e) { e.preventDefault(); exportOeffnen(); });

    /* ---- Klicks ---------------------------------------------------------------------------------- */
    root.addEventListener("click", function (e) {
      var z = e.target.closest && e.target;
      if (!z) return;
      if (z.closest(".ush-filterzeile, .up-ph-nav, .up-ph-top")) return;
      var nm = z.closest("[data-ush-nochmal]");
      if (nm) { nochmal(nm.getAttribute("data-ush-nochmal")); return; }
      if (z.closest("[data-ush-filterweg]")) {
        /* Wie "Clear All" der Leiste, dazu der Fehlerzustand ausdruecklich verworfen: bleibt die Signatur gleich
           (Wert stand nur im Speicher), laedt sonst nichts neu und der Kasten bliebe stehen. */
        alleFilterZuruecksetzen();
        Object.keys(state.fehler).forEach(function (k) { if (state.fehler[k] === "filter_gone") delete state.fehler[k]; });
        state.products.page = 1; state.brands.page = 1; state.merchants.page = 1; state.auftritte.page = 1;
        persist(); geruest = null; zeichnen(); bedarf(); return;
      }
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
      /* Vor der Zeile: der Marken-Chip in der Produktzeile filtert, statt das Produkt zu oeffnen (markeFilterChip). */
      var mf = z.closest("[data-ush-markefilter]");
      if (mf) { prodFilter("marke", { id: mf.getAttribute("data-ush-markefilter"), name: mf.getAttribute("data-ush-markefilter-name") || "" }); return; }
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
      if (zeile.hasAttribute("data-antwort")) { if (UC.drawerOeffnen) UC.drawerOeffnen("response", zeile.getAttribute("data-antwort"), "shopping"); return; }
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

    /* Alle offenen Anfragen abschreiben: Uhr aus, direkte Anfragen abbrechen. Was danach noch
       ankommt, findet seine Anfrage nicht mehr unterwegs und wird verworfen. */
    function abschreiben(nurDirekt) {
      Object.keys(unterwegs).forEach(function (k) {
        var u = unterwegs[k];
        if (!u || (nurDirekt && !u.direkt)) return;
        unterwegs[k] = null;
        clearTimeout(u.uhr);
        if (u.ctrl) { try { u.ctrl.abort(); } catch (e) {} }
      });
    }
    /* Teamwechsel ohne Neuladen (13.10.): die Anfrage des alten Teams haelt sonst ihren Kanal, bis
       sie zurueck ist, und die Seite des neuen wartet so lange. Das neue Team hat andere
       Signaturen (sigVon mit p_team), der Speicher des alten zeigt sich also nicht. Das erste
       Setzen in einem Seitenleben ist ebenfalls ein Wechsel ("" -> Id) und startet das Laden. */
    if (UC.onTeamChange) UC.onTeamChange(function () {
      if (!direktWeg()) return;
      /* Nur die direkten: eine Anfrage ueber Bubble (Rueckweg) behaelt ihren Platz -- ihre Antwort
         kommt ueber den Setter und landet so unter der Signatur des alten Teams, wohin sie gehoert. */
      abschreiben(true);
      bedarf();
    }, root);

    /* ---- Setter -------------------------------------------------------------------------------- */
    var ctrl = {
      setOverview: function (raw, f) { return antwort("overview", raw, f); },
      setProducts: function (raw, f) { return antwort("products", raw, f); },
      setDetail: function (raw, f) { return antwort("detail", raw, f); },
      setMerchants: function (raw, f) { return antwort("merchants", raw, f); },
      reset: function () {
        summenStand++;
        state.cache = { overview: {}, products: {}, detail: {}, merchants: {} };
        state.reihe = { overview: [], products: [], detail: [], merchants: [] };
        state.fehler = {};
        abschreiben();
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
    /* Der Auftritt (core, makeAuftritt) wie auf den anderen Seiten (12.10. nachgeruestet): Kopf,
       Reiter und Filterzeile, dann der Inhalt in derselben Staffel -- er wartet wie ueberall nur auf
       die Stylesheets, nicht auf Daten. Verdeckt wird die Huelle .ush-main, denn das Geruest darin
       baut zeichnen() je Reiter neu: ein Teil, das erst nach dem Start entsteht, truege die
       Warteklasse nicht. Gestaffelt wird fein ueber die Abschnitte der Seite -- darum erst NACH dem ersten
       Zeichnen: liegen die Stylesheets schon da, startet core im selben Takt, und vorher gaebe es
       keine Abschnitte, nur die ganze Huelle als ein Stueck. */
    UC.makeAuftritt && UC.makeAuftritt(root, { kopf: ".ush-pagehead, .ush-nav, .ush-filterzeile",
      inhalt: ".ush-main", fein: ".ush-main > .ush-seite > *" });
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
