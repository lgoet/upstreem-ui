/* upstreem core.js — geteilte Daten + Utilities fuer alle Tabellen-/Chart-Komponenten.
   Vor jeder Komponente laden; stellt window.UpstreemCore bereit. Event-Namen bleiben pro Komponente. */
(function(){
  "use strict";

  /* ── Nur EINE core.js pro Seite ────────────────────────────────────────────────────────────
     BUILD: Datum dieser Fassung als Zahl, Format JJJJMMTT (zweistellig zaehlend). Bei jeder
     Aenderung an core.js mit hochziehen.

     Warum die Sperre GANZ oben steht und nicht erst bei der Zuweisung von window.UpstreemCore:
     der Loader jeder Komponente entdoppelt nach URL. Zwei Elemente mit verschiedenen data-cdn-pin
     ergeben zwei verschiedene URLs -- also laeuft core.js ZWEIMAL, und beide Male vollstaendig.
     Die Verdraengungssperre weiter unten schuetzt nur window.UpstreemCore. Alles andere lief
     doppelt: window.setUpstreemTheme wurde von der zweiten Fassung ueberschrieben, und die haelt
     ihren EIGENEN THEME-Zustand mit einer eigenen Abonnentenliste. Komponenten, die sich bei der
     ersten Fassung angemeldet hatten, hoerten einen Themenwechsel danach nie wieder -- die
     Flaechen wechselten trotzdem, weil der Durchlauf ueber die Attribute alle Wurzeln erfasst.
     Genau das Bild: die Karte wechselt, das Chart darin nicht. Dasselbe gilt fuer den
     Marken-Store, die Toast-Bruecke und jeden Beobachter, den core installiert.
     Ab hier: ist schon eine Fassung da, die nicht aelter ist, tut diese hier gar nichts. */
  var BUILD = 20260817;
  try {
    var schonDa = window.UpstreemCore;
    if (schonDa && typeof schonDa.BUILD === "number" && schonDa.BUILD >= BUILD) return;
  } catch(e){}

  var CITE_COLOR = {
    "Editorial":"#27a79b", "UGC / Community":"#34a1d1", "Knowledge-Base":"#797ad8",
    "Brand Platforms":"#bc69c9", "Institutional":"#5e7eac", "Competition":"#dd7e3e", "You":"#d35f73"
  };
  var CITE_ALIAS = {
    "Brand_Platform":"Brand Platforms", "Brand Platform":"Brand Platforms",
    "Knowledge_Base":"Knowledge-Base", "Knowledge Base":"Knowledge-Base",
    "UGC_Community":"UGC / Community", "UGC Community":"UGC / Community"
  };
  var ALL_CITATION_TYPES = ["Editorial","UGC_Community","Knowledge_Base","Brand_Platform","Institutional","Competition","You"];
  /* URL types: canonical palette, copied 1:1 from the standalone URL Type chip component.
     Unlike citation types these DO have a real dark variant. */
  var URL_TYPE = {
    homepage:        { label:"Homepage",         c:"#b45309", cDark:"#fbbf24" },
    product_service: { label:"Product / Service", c:"#c2683b", cDark:"#fdba74" },
    marketplace:     { label:"Marketplace",      c:"#9a5b2e", cDark:"#fcae6f" },
    company_info:    { label:"Company Info",     c:"#a16207", cDark:"#facc15" },
    article:         { label:"Article",          c:"#047857", cDark:"#6ee7b7" },
    listicle:        { label:"Listicle",         c:"#0e7490", cDark:"#67e8f9" },
    guide:           { label:"Guide",            c:"#2563eb", cDark:"#93c5fd" },
    comparison:      { label:"Comparison",       c:"#4f46e5", cDark:"#a5b4fc" },
    review:          { label:"Review",           c:"#6d28d9", cDark:"#c4b5fd" },
    documentation:   { label:"Documentation",    c:"#6d28d9", cDark:"#c4b5fd" },
    forum:           { label:"Forum",            c:"#9333ea", cDark:"#d8b4fe" },
    directory:       { label:"Directory",        c:"#a21caf", cDark:"#f0abfc" },
    video:           { label:"Video",            c:"#7c3aed", cDark:"#c4b5fd" },
    social_post:     { label:"Social Post",      c:"#8b5cf6", cDark:"#ddd6fe" }
  };
  var ALL_URL_TYPES = Object.keys(URL_TYPE);
  /* Was ein Typ BEDEUTET, in einem Satz. Bisher lag das nur im freistehenden URL-Type-Element und
     damit ausserhalb dieses Repos -- die Palette war hier, die Erklaerung dort, und beide waren
     bereits auseinandergelaufen. Hier stehen sie nebeneinander, weil jede Erklaerkarte, die einen
     Typ zeigt, denselben Satz zeigen soll.
     Der Schluessel der Zitationstypen ist der KANONISCHE Name aus CITE_COLOR, nicht die
     Bubble-Schreibweise -- citeName() uebersetzt Brand_Platform und Freunde vorher. */
  var CITE_DESC = {
    "You":              "This is one of your own pages. You control it directly, so it is the fastest content to improve or expand.",
    "Competition":      "A competitor's page. You cannot edit it, but it shows what the AI rewards in your space.",
    "Brand Platforms":  "A brand-owned platform that is not a competitor: a partner, marketplace, or vendor page.",
    "Editorial":        "Journalist- or editor-written coverage. You influence it by earning a mention, not by editing.",
    "Institutional":    "An official or authoritative body: government, standards, or academic. High trust, hard to sway.",
    "Knowledge-Base":   "Reference material the AI leans on as ground truth, like an encyclopedia or a docs entry.",
    "UGC / Community":  "Community-generated content: forums, reviews, threads. Shaped by real users, not by you."
  };
  var URL_TYPE_DESC = {
    homepage:        "The root or landing page of a site: its front door, usually the domain itself.",
    product_service: "A single product or service page, one concrete offering described in detail.",
    marketplace:     "A large sales platform hosting many third-party sellers, where visitors buy or book directly.",
    company_info:    "About, team, contact, or legal pages: background on the company rather than what it sells.",
    article:         "An authored blog post, opinion piece, or dated news story.",
    listicle:        "A ranked or numbered best-of list. These punch far above their weight in AI answers.",
    guide:           "A how-to, tutorial, or long-form explainer that teaches the reader something.",
    comparison:      "An X versus Y or alternatives piece, weighing options head to head.",
    review:          "A hands-on test, review, testimonial, or case study of a product or service.",
    documentation:   "Technical docs, API references, help centers, or encyclopedic entries: reference material.",
    forum:           "A community thread, Q&A, or discussion, such as Reddit or Quora.",
    directory:       "An aggregator listing or profile: review sites, business directories, marketplaces.",
    video:           "A video watch or player page, such as a YouTube result.",
    social_post:     "A social media post or profile, such as a LinkedIn update or an X profile."
  };
  /* Label und Satz zu einem Typ, in einer Funktion fuer beide Achsen. Ohne Treffer ein leerer
     Satz und der Rohwert als Label -- ein erfundener Text waere hier schlimmer als keiner. */
  function typeLabel(raw, mode){
    var k = String(raw == null ? "" : raw).trim();
    if (mode === "url") return (URL_TYPE[k] && URL_TYPE[k].label) || (k ? k.replace(/_/g, " ") : "");
    return citeName(k);
  }
  function typeDesc(raw, mode){
    var k = String(raw == null ? "" : raw).trim();
    if (mode === "url") return URL_TYPE_DESC[k] || "";
    return CITE_DESC[citeName(k)] || "";
  }
  var OTHER_LIGHT = "#8c8f96", OTHER_DARK = "#a8abb2", CHIP_BG_DARK = "#242424";
  var MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  /* Search behaviour lifted verbatim from quick_actions.html so both feel identical. */
  var DEBOUNCE = 400, MIN = 2;
  /* Sort coalescing window. Shorter than search: a click is a deliberate act, so the result
     has to feel immediate, but it is long enough to swallow a burst of clicks. */
  var SORT_DEBOUNCE = 250;
  var PAGE_SIZES = [15, 25, 50, 100];

  var DEFAULT_PAGE_SIZE = 15;
  /* Compact count format shared with the other components: 1.23k / 12.3k / 1.2m
     Das Trennzeichen kommt aus den Einstellungen des Nutzers (getPref("num")) -- in der deutschen
     Schreibweise steht dort 1,24k statt 1.24k. Die Stufen und das Abschneiden der Nullen bleiben
     unveraendert; nur das eine Zeichen wird getauscht, und zwar ZULETZT, damit die Rechnung mit
     toFixed weiter auf dem Punkt arbeitet. */
  function fmtTotal(n, muster){
    n = Number(n) || 0;
    var dez = trennzeichen(muster).dez;
    function um(s){ return dez === "." ? s : s.replace(".", dez); }
    if (n < 1000) return String(Math.round(n));
    var k = n / 1000;
    if (n < 10000) return um((Math.round(k * 100) / 100).toFixed(2).replace(/0+$/,"").replace(/\.$/,"")) + "k";
    if (n < 1000000) return um((Math.round(k * 10) / 10).toFixed(1).replace(/\.0$/,"")) + "k";
    return um((Math.round((n/1000000) * 10) / 10).toFixed(1).replace(/\.0$/,"")) + "m";
  }

  function isYes(v){ return /^(1|true|yes|y)$/i.test(String(v == null ? "" : v).trim()); }

  /* ---- Flaggenplaettchen -----------------------------------------------------------------------
     Woertlich aus filters/markets-filter.js hierher gezogen, weil es dort einen zweiten Abnehmer
     bekommen hat (die Sprachauswahl im Einstellungsfenster). Der Aufbau bleibt genau derselbe: der
     Laendercode liegt UNTEN und die Flagge darueber, damit eine Flagge, die 404 liefert, "DE"
     zeigt statt eines kaputten Bildes.
     FLAG_OK behaelt, welche Adressen schon einmal geladen haben -- sonst blitzt bei jedem Neubau
     einer Liste erst der Code auf und danach das Bild. */
  var FLAG_OK = (window.__upFlagOk = window.__upFlagOk || {});
  function flagUrl(alpha2){
    var k = String(alpha2 || "").trim().toLowerCase();
    /* flagcdn ist die Flaggenquelle der ganzen App (prompts-table, prompt-research, der
       Markets-Filter) -- eine zweite Quelle waere ein zweiter Stil. */
    return k.length === 2 ? "https://flagcdn.com/" + k + ".svg" : "";
  }
  function flagHtml(alpha2, cls){
    var url = flagUrl(alpha2);
    var initial = esc(String(alpha2 || "?").trim().toUpperCase() || "?");
    var c = "up-flag" + (cls ? " " + cls : "") + (url && FLAG_OK[url] ? " has-img" : "");
    return '<span class="' + c + '">' +
             '<span class="up-flag-fb">' + initial + '</span>' +
             (url ? '<img class="up-flag-img" src="' + esc(url) + '" alt="" loading="lazy">' : '') +
           '</span>';
  }
  function wireFlags(scope){
    if (!scope) return;
    var imgs = scope.querySelectorAll(".up-flag-img");
    for (var i = 0; i < imgs.length; i++) (function(img){
      if (img.__upFlagWired) return;
      img.__upFlagWired = true;
      function ok(){ var p = img.parentNode; if (p) p.classList.add("has-img"); FLAG_OK[img.src] = 1; }
      function bad(){ img.style.display = "none"; var p = img.parentNode; if (p) p.classList.remove("has-img"); }
      if (img.complete) { if (img.naturalWidth > 0) ok(); else bad(); return; }
      img.addEventListener("load", ok);
      img.addEventListener("error", bad);
    })(imgs[i]);
  }

  /* ══ Die Einstellungen des Nutzers ═══════════════════════════════════════════════════════════
     EINE Ablage fuer alles, was im Einstellungsfenster (preferences.js) gewaehlt wird: Sprache,
     Zahlenformat und Datumsformat. Gebaut nach dem Muster, das das Thema hier schon geht
     (setUpstreemTheme): im localStorage, TEAMBEZOGEN ueber storeKey, und jede Aenderung meldet
     sich mit einem Fensterereignis -- damit jede Komponente der Seite neu zeichnen kann, ohne dass
     eine von der anderen wissen muss.

     Warum in core und nicht im Fenster selbst: die Werte werden nicht dort gebraucht, wo sie
     gewaehlt werden, sondern in jeder Tabelle, jedem Chart und jedem Tooltip. Die Formatierer
     darunter (fmtInt, fmtTotal, fmtPct, fmtDate, chartDateFmt) lesen sie, und damit wirkt eine
     Aenderung ueberall, wo diese App schon durch core formatiert -- gemessen sind das alle bis auf
     acht Stellen in sechs Dateien, und die sind mitgezogen.

     Die VORGABEN sind ausdruecklich der heutige Stand: Englisch, 1,234.56 / 1.24k, 12. Dec 2025.
     Wer nichts einstellt, sieht nichts Neues.

     Die Chart-Einstellungen (Linienstaerke, Legende) haben ihre eigenen Schluessel weiter unten und
     bleiben dort -- sie gab es vorher, sie funktionieren, und ein Umzug haette nur die gespeicherte
     Wahl jedes Nutzers weggeworfen. Das Fenster stellt sie ueber ihre vorhandenen Setter. */
  var PREF_KEY = "prefs";
  var PREF_DEFAULT = { locale: "en", num: "en", date: "d-mon-y" };
  var PREF_ERLAUBT = {
    locale: { en: 1, de: 1 },
    /* "en": 1,234.56 und 1.24k -- Punkt trennt die Nachkommastellen.
       "de": 1.234,56 und 1,24k -- Komma trennt sie. Mehr braucht es nicht: die zwei Sprachen
       decken beide Schreibweisen ab, und eine dritte waere eine Kombination, die niemand liest. */
    num:    { en: 1, de: 1 },
    date:   { "d-mon-y": 1, "mon-d-y": 1, "d-m-y": 1, iso: 1 }
  };
  var _prefs = null;
  /* OHNE Team-Suffix, und das ist eine Korrektur. Diese Werte liefen ueber storeKey, und storeKey
     haengt die Team-Id an -- die beim BOOT noch nicht bekannt ist. Gelesen wurde also unter
     "prefs@_", geschrieben spaeter unter "prefs@<team>": zwei Schluessel, und nach einem Neuladen
     kam nichts zurueck. Gemeldet als "wenn man auf deutsch stellt, haelt das nur bis zum reload".
     Genau derselbe Fehler stand hier schon einmal fuer die Ansichts-Einstellungen, mit derselben
     Begruendung im Kommentar bei storeKey -- ich habe ihn beim Bau des Vorrats wiederholt.
     Team-Bindung ist auch inhaltlich falsch: Sprache, Zahlen- und Datumsformat sind Vorlieben
     eines GERAETS, keine Teamdaten. Welche Sprache jemand liest, ist dieselbe Entscheidung, egal
     in welchem Team er steht.
     Der Rueckfall holt einmalig, was unter dem alten Suffix liegengeblieben ist, und schreibt es
     nach vorn -- sonst verliert jeder, der die Sprache schon einmal umgestellt hat, seine Wahl. */
  var PREF_STORE = "up_prefs";
  function prefsLesen(){
    if (_prefs) return _prefs;
    var o = {};
    try {
      var roh = window.localStorage.getItem(PREF_STORE);
      if (!roh){
        var alt = window.localStorage.getItem(storeKey(PREF_KEY));
        if (alt){ roh = alt; try { window.localStorage.setItem(PREF_STORE, alt); } catch(e2){} }
      }
      if (roh) o = JSON.parse(roh) || {};
    } catch(e){ o = {}; }
    _prefs = {};
    /* Nur bekannte Werte uebernehmen. Ein fremder Eintrag in der Ablage -- eine aeltere Fassung,
       ein zweiter Tab, ein Tippfehler von Hand -- darf die App nicht in einen Zustand bringen, den
       kein Formatierer kennt. */
    Object.keys(PREF_DEFAULT).forEach(function(k){
      var v = o && typeof o[k] === "string" ? o[k] : "";
      _prefs[k] = (PREF_ERLAUBT[k] && PREF_ERLAUBT[k][v]) ? v : PREF_DEFAULT[k];
    });
    return _prefs;
  }
  function getPref(name){ var p = prefsLesen(); return p[name] != null ? p[name] : PREF_DEFAULT[name]; }
  function setPref(name, value){
    if (!PREF_ERLAUBT[name]) return getPref(name);
    var v = PREF_ERLAUBT[name][value] ? value : PREF_DEFAULT[name];
    var p = prefsLesen();
    if (p[name] === v) return v;
    p[name] = v;
    try { window.localStorage.setItem(PREF_STORE, JSON.stringify(p)); } catch(e){}
    /* Ein Ereignis am FENSTER und nicht an einer Wurzel: die Empfaenger sind alle Komponenten der
       Seite, und keine davon kennt das Einstellungsfenster. Dasselbe Muster wie
       up-linewidth-change weiter unten. */
    try { window.dispatchEvent(new CustomEvent("up-prefs-change", { detail: { name: name, value: v } })); } catch(e){}
    return v;
  }
  /* Anmelden, ohne das Ereignis selbst zu kennen. Gibt eine Abmeldefunktion zurueck. */
  /* Ein Sprachwechsel aendert kein DOM von sich aus -- der Lauf oben haengt am Beobachter fuer
     NEUE Knoten. Also hier ausdruecklich, sobald die Einstellung sich aendert. */
  try {
    window.addEventListener("up-prefs-change", function(e){
      if (e && e.detail && e.detail.name !== "locale") return;
      try { spracheLauf(); } catch(err){}
    });
  } catch(e){}
  function onPrefs(fn){
    if (typeof fn !== "function") return function(){};
    function h(e){ try { fn((e && e.detail) || {}); } catch(err){} }
    window.addEventListener("up-prefs-change", h);
    return function(){ window.removeEventListener("up-prefs-change", h); };
  }

  /* ---- Sprache ----
     Der SCHLUESSEL ist der englische Text selbst. Das ist die Entscheidung, an der alles andere
     haengt, und sie ist bewusst so:

       - Eine Komponente, die noch nicht uebersetzt ist, zeigt weiter richtiges Englisch. Es gibt
         keinen Zustand "Schluessel nicht gefunden", der als kryptisches Kuerzel im UI landet.
       - Es gibt keinen zweiten Namensraum, den man mit dem Markup synchron halten muesste. Bei
         gemessen ~1076 sichtbaren Texten in 40 Dateien waere genau das die Stelle, an der es
         auseinanderlaeuft.
       - Die Extraktion kann Datei fuer Datei laufen: UC.addMessages("de", {...}) je Komponente,
         und was noch fehlt, faellt still auf Englisch zurueck.

     WAS UEBERSETZT WIRD und was nicht -- die Linie, die Notion, Linear, Stripe und Figma ziehen:
       JA    die Oberflaeche: Menues, Knoepfe, Spaltenkoepfe, Leerzustaende, Fehlermeldungen,
             Tooltips, Beschreibungen.
       NEIN  Nutzerdaten (Prompts, Markennamen, Domains, Themennamen).
       NEIN  Eigennamen (ChatGPT, Perplexity, Google AI Overviews).
       NEIN  die FACHTAXONOMIE, die auch in Exporten und ueber die API erscheint: die
             Zitationstypen (Brand_Platform, Editorial, ...), die Rollen (owner/admin/member) und
             die URL-Typen. Grund: ein Wert, der exportiert, gefiltert oder von aussen gelesen
             wird, muss in jeder Sprache derselbe sein. Uebersetzt wird dort die SPALTE, nicht der
             Wert.

     DAS GLOSSAR -- diese Woerter bleiben AUCH IN DEUTSCHEN SAETZEN englisch:

       Domain, Domains, URL, URLs, Brand, Brands, Prompt, Prompts, Citation, Citations,
       Topic, Topics, Mira, Team, Teams, Dashboard,
       Visibility, Ranking, Sentiment, Share of Voice, Mention Count, Trend

     Die erste Gruppe sind die OBJEKTE dieser App -- so heissen sie in der Navigation, in den
     Exporten und in jedem Gespraech darueber. "Marken" neben einer Spalte "Brand" zu schreiben
     macht aus einem Ding zwei.
     Die zweite Gruppe sind die KENNZAHLEN. Sie stehen als Spaltenkoepfe in jedem CSV-Export und
     sind der Wortschatz des Produkts; "Sichtbarkeit" waere eine zweite Sprache fuer dieselbe
     Zahl. Dazu kommt: die SEITENLEISTE bleibt komplett englisch (Ansage vom 31.08.) -- sie ist
     die Landkarte der App. Ein Menuepunkt "Brands" und darunter eine Tabelle "Marken" waere
     genau der Bruch, den das Glossar verhindert.

     Was das praktisch heisst: uebersetzt werden SAETZE und Bedienung -- "Keine Ergebnisse",
     "Zeilen pro Seite", "Suche loeschen", "Diese Auswahl zuruecksetzen" --, und darin stehen die
     Glossarwoerter unveraendert: "Keine Prompts gefunden", "3 Brands ausgewaehlt". */
  var MSG = {};
  /* Der deutsche Katalog von core. Er gilt fuer alles, was aus den geteilten Bauteilen kommt --
     Werkzeugknoepfe, Leerzustaende, die beiden Modale, das Variations-Kit -- also fuer jede
     Tabelle und jeden Chart der App auf einmal.
     Das GLOSSAR oben ist hier durchgehalten: Topics, Brands, Prompts, Domains, URLs und die
     Kennzahlen stehen auch mitten im deutschen Satz englisch. */
  var MSG_DE = {
    /* Werkzeugknoepfe (TOOLBAR_TIPS) */
    "Sort": "Sortieren",
    "Search": "Suchen",
    "Table Settings": "Tabelle einstellen",
    "Chart Settings": "Chart einstellen",
    "Board Settings": "Board einstellen",
    "Settings": "Einstellungen",
    "Filter brands": "Brands filtern",
    "Filter": "Filtern",
    "Research settings": "Recherche einstellen",
    "Show tools": "Werkzeuge zeigen",
    "Hide tools": "Werkzeuge ausblenden",
    "Filters and settings": "Filter und Einstellungen",
    /* Tabelle einstellen, Sortiermenue, Reiter -- die Menues, die JEDE Tabelle aus core baut */
    "Columns": "Spalten",
    "Select all": "Alle auswählen",
    "Row height": "Zeilenhöhe",
    "Comfortable": "Komfortabel",
    "Compact": "Kompakt",
    "Sort by": "Sortieren nach",
    /* Lesefehler. {was} ist der Name dessen, was nicht geladen werden konnte. */
    "Could not load {was}": "{was} konnte nicht geladen werden",
    "The data could not be read. Please reload the page.":
      "Die Daten konnten nicht gelesen werden. Bitte lade die Seite neu.",
    "data": "Die Daten",

    /* ── Spaltenkoepfe, die in mehreren Tabellen vorkommen ─────────────────────────────────────
       Nach dem Glossar bleiben Prompt, Visibility, Ranking, Sentiment, Brand(s), Domain(s),
       URL(s), Topics, Citations und Share of Voice ENGLISCH -- sie stehen so in den Exporten und
       in der Navigation. Uebersetzt wird der Rest. */
    "Rank": "Rang",
    "Created": "Erstellt",
    "Created At": "Erstellt am",
    "Last Seen": "Zuletzt gesehen",
    "Date": "Datum",
    "Name": "Name",
    "Type": "Typ",
    "Position": "Position",
    "Status": "Status",
    "Market": "Markt",
    "Markets": "Märkte",
    "Model": "Modell",
    "Models": "Modelle",
    "Share": "Anteil",
    "Domain Share": "Domain-Anteil",
    "Mentioned?": "Erwähnt?",
    "Brand Mentions": "Brand-Erwähnungen",
    "Citation Type": "Citation-Typ",
    "Citation Types": "Citation-Typen",
    "URL Types": "URL-Typen",
    "Lanes": "Spuren",

    /* ── Fusszeile und Auswahl ─────────────────────────────────────────────────────────────── */
    "Rows per page": "Zeilen pro Seite",
    "{from}–{to} of {total}": "{from}–{to} von {total}",
    "Descending": "Absteigend",
    "Ascending": "Aufsteigend",
    "Deselect all": "Auswahl aufheben",
    "Clear selection": "Auswahl leeren",
    "Apply": "Übernehmen",
    "Reset": "Zurücksetzen",
    /* "Zitiert" und nicht "Verwendet": die Spalte zaehlt, wie oft die URL als Citation auftrat --
       das ist im Deutschen zitiert, und es haelt die Naehe zum Wort Citation, das stehen bleibt. */
    "Used": "Zitiert",
    "Top Domains": "Top-Domains",
    "Top URLs": "Top-URLs",
    "Top Brands": "Top-Brands",
    "Responses": "Antworten",
    "Yes": "Ja",
    "No": "Nein",

    /* ── Explainer an den Spaltenkoepfen (UC.explainCopy) ──────────────────────────────────────
       Der Satz steht MIT seinen Platzhaltern im Katalog; gefuellt wird erst danach. */
    /* {scope} steht im Deutschen VOR dem Verb -- "wenn sie für diesen Prompt erwähnt wird" und
       nicht "wenn sie erwähnt wird für diesen Prompt". Genau dafuer wird das Muster uebersetzt und
       nicht der fertige Satz. Mit leerem scope liest es sich unveraendert richtig. */
    "How positively the brand is described when it's mentioned{scope}{trend}.":
      "Wie positiv über die Brand gesprochen wird, wenn sie{scope} erwähnt wird{trend}.",
    "The brand's average position among all brands mentioned{scope}{trend}. A lower number is better.":
      "Die durchschnittliche Position der Brand unter allen{scope} erwähnten Brands{trend}. Kleiner ist besser.",
    "How often the brand appears in AI answers{scope}{trend}.":
      "Wie oft die Brand{scope} in KI-Antworten vorkommt{trend}.",
    "Which of your tracked brands are mentioned{scope}. Hover a logo to see its name.":
      "Welche deiner beobachteten Brands{scope} erwähnt werden. Fahre über ein Logo, um den Namen zu sehen.",
    "How much of all citations in the period went to this {subject}, plus the change against the previous period.":
      "Wie viel aller Citations im Zeitraum auf diese {subject} entfielen, dazu die Veränderung zum Zeitraum davor.",
    /* Die Stuecke, die die Komponenten einsetzen -- eigene Eintraege, weil sie eigene Texte sind.
       Das fuehrende Leerzeichen gehoert dazu: der Satz klebt sie direkt an. */
    " for this prompt": " für diesen Prompt",
    " in AI answers for this prompt": " in KI-Antworten auf diesen Prompt",
    " for the tracked prompts": " für die beobachteten Prompts",
    " for this domain": " für diese Domain",
    " for this URL": " für diese URL",
    "domain": "Domain",
    "URL": "URL",

    /* ── Beschreibungen der Seitenkoepfe (stehen im Bubble-Markup) ───────────────────────────── */
    "Monitor your AI visibility, performance, and latest developments":
      "Beobachte deine KI-Sichtbarkeit, die Performance und die letzten Entwicklungen",
    "Manage Prompts, Topics and monitor latest Responses":
      "Prompts und Topics verwalten, neueste Responses ansehen",
    "Manage tasks, prioritize opportunities, and track progress":
      "Aufgaben verwalten, Opportunities priorisieren, Fortschritt verfolgen",
    "Manage the teams you are a member of, and switch between them":
      "Verwalte die Teams, in denen du Mitglied bist, und wechsle zwischen ihnen",
    "Manage your brand, your team and your plan.":
      "Verwalte deine Brand, dein Team und deinen Tarif.",
    "Find the prompts your audience actually asks AI, and turn the ones worth owning into tracked prompts.":
      "Finde die Prompts, die dein Publikum der KI wirklich stellt, und mache aus den lohnenden beobachtete Prompts.",

    /* ── Datumsfilter ─────────────────────────────────────────────────────────────────────────
       "Letzte 7 Tage" und Geschwister. Die Voreinstellungen stehen in filters/date-range.js. */
    "Last 7 Days": "Letzte 7 Tage",
    "Last 30 Days": "Letzte 30 Tage",
    "Last 3 Months": "Letzte 3 Monate",
    "Last 6 Months": "Letzte 6 Monate",
    "Last 12 Months": "Letzte 12 Monate",
    "This Month": "Dieser Monat",
    "Last Month": "Letzter Monat",
    "Custom Range": "Eigener Zeitraum",
    /* Klein geschriebenes "range" -- so steht es im Markup von date-range.js. Ich hatte hier
       zuerst "Date Range" mit grossem R, und dann traf der Schluessel nicht. Gemessen: der Kopf
       blieb englisch. */
    "Date range": "Zeitraum",
    "Cancel": "Abbrechen",
    "Done": "Fertig",
    "Continue": "Weiter",
    "Edit": "Bearbeiten",
    "Copy": "Kopieren",
    "Dismiss": "Ausblenden",
    "Show": "Zeigen",
    "Hide": "Ausblenden",
    "Maximize": "Vergrößern",
    "Open in new tab": "In neuem Tab öffnen",

    /* ── Filter auf Brand-Erwähnungen (vier Tabellen teilen diese Texte) ───────────────────── */
    "All Brands": "Alle Brands",
    "All Types": "Alle Typen",
    "Mentioned brands": "Erwähnte Brands",
    "Filter for your brand mentions": "Nach Erwähnungen deiner Brand filtern",
    "Filter for brand mentions": "Nach Brand-Erwähnungen filtern",
    "Search brands...": "Brands suchen...",
    "Clear brand search": "Brand-Suche löschen",
    "Search markets": "Märkte suchen",
    "Select a market": "Markt wählen",
    "No brands available": "Keine Brands vorhanden",
    "No matches": "Keine Treffer",
    "Search, filters and settings": "Suche, Filter und Einstellungen",
    "Nothing matches the current search and filters.":
      "Zu dieser Suche und diesen Filtern gibt es nichts.",
    "The data could not be read.": "Die Daten konnten nicht gelesen werden.",

    /* ── Zustaende ─────────────────────────────────────────────────────────────────────────── */
    "Active": "Aktiv",
    "Inactive": "Inaktiv",
    "(Inactive)": "(Inaktiv)",
    "In Progress": "In Arbeit",
    "Ignored": "Ignoriert",
    "Group": "Gruppe",
    "Groups": "Gruppen",
    "External only": "Nur extern",
    "Competitors": "Wettbewerber",
    "Performance Chart": "Performance-Chart",
    "Why this matters": "Warum das zählt",
    "How to choose": "Wie du wählst",
    "No suggested prompts found": "Keine vorgeschlagenen Prompts gefunden",
    "Start a new prompt research to generate suggestions.":
      "Starte eine neue Prompt-Recherche, um Vorschläge zu erzeugen.",
    /* Diese drei stehen im Markup der Komponenten, nicht in TOOLBAR_TIPS -- sie werden ueber den
       Weg "vorhandene Beschriftung uebersetzen" erreicht. */
    "Export": "Exportieren",
    "Minimize": "Verkleinern",
    "Maximize": "Vergrößern",
    "Open": "Öffnen",
    /* Zeitraster an den Charts */
    "Day": "Tag",
    "Week": "Woche",
    "Month": "Monat",
    /* Leerzustaende */
    "No data": "Keine Daten",
    /* Themen-Modal */
    "New Topic": "Neues Topic",
    "Edit Topic": "Topic bearbeiten",
    "Confirm delete?": "Wirklich löschen?",
    "Close": "Schließen",
    /* Gruppierungs-Modal */
    "New Grouping": "Neue Gruppierung",
    "Edit Grouping": "Gruppierung bearbeiten",
    "Create grouping": "Gruppierung anlegen",
    "Save": "Speichern",
    "Group color": "Farbe der Gruppe",
    "Group name…": "Name der Gruppe…",
    "Search topics": "Topics suchen",
    "Search topics…": "Topics suchen…",
    "Clear search": "Suche löschen",
    "Show all {n} topics": "Alle {n} Topics zeigen",
    "Show grouping": "Gruppierung zeigen",
    "Hide grouping": "Gruppierung ausblenden",
    /* Variations-Kit */
    "Variations": "Variationen",
    "Variation Name": "Variation",
    "Search variations": "Variationen suchen",
    "No variations recorded.": "Noch keine Variationen erfasst.",
    "No variation matches this search.": "Keine Variation passt zu dieser Suche."
  };
  function addMessages(locale, obj){
    var l = String(locale || "").trim().toLowerCase();
    if (!l || !obj || typeof obj !== "object") return;
    _rueckIndex = null;   /* der umgekehrte Index ist veraltet, sobald der Katalog waechst */
    var ziel = MSG[l] || (MSG[l] = {});
    Object.keys(obj).forEach(function(k){ if (typeof obj[k] === "string") ziel[k] = obj[k]; });
  }
  /* t_ ist derselbe Aufruf unter einem Namen, der in dieser Datei nirgends verschattet ist. "t"
     ist hier mehrfach belegt: var t = trennzeichen(...) in fmtNum, for (var t = 0; ...) im
     Themenwechsel, und in der Werkzeugleiste ist t die Laufvariable ueber die Knoepfe. Wer dort
     t("...") schreibt, ruft ein Objekt auf. Darum ein zweiter Name statt Umbenennen der drei
     Laufvariablen -- die haben mit Sprache nichts zu tun. */
  function t_(text){ return t(text); }
  /* Sofort eintragen: addMessages steht als Deklaration schon fest (hochgezogen), und der Katalog
     muss stehen, bevor die erste Komponente ihren ersten Text zeichnet. */
  addMessages("de", MSG_DE);
  /* ── Zweiter Teil des Katalogs: die Texte der KOMPONENTEN ────────────────────────────────────
     Sie stehen hier und nicht je Datei, weil der breite Lauf oben nach dem TEXT sucht und nicht
     nach der Datei -- ein Eintrag wirkt damit an jeder Stelle, an der derselbe Satz steht, und die
     vier Tabellen teilen die meisten davon woertlich.
     Das Glossar gilt weiter: Prompt(s), Brand(s), Domain(s), URL(s), Topic(s), Citation(s) und die
     Kennzahlen bleiben englisch, auch mitten im deutschen Satz. */
  addMessages("de", {
    /* ── Monate. Sie stehen an jeder Chart-Achse und im Kalender. ───────────────────────────── */
    "Jan": "Jan", "Feb": "Feb", "Mar": "Mär", "Apr": "Apr", "May": "Mai", "Jun": "Jun",
    "Jul": "Jul", "Aug": "Aug", "Sep": "Sep", "Oct": "Okt", "Nov": "Nov", "Dec": "Dez",
    "January": "Januar", "February": "Februar", "March": "März", "April": "April", "June": "Juni",
    "July": "Juli", "August": "August", "September": "September", "October": "Oktober",
    "November": "November", "December": "Dezember",

    /* ── Zustaende und Knoepfe ──────────────────────────────────────────────────────────────── */
    "Actions": "Aktionen",
    "Activate": "Aktivieren",
    "Deactivated": "Deaktiviert",
    "Set Active": "Auf aktiv setzen",
    "Set Inactive": "Auf inaktiv setzen",
    "Active Brands": "Aktive Brands",
    "Active Prompts": "Aktive Prompts",
    "Add New Brand": "Neue Brand",
    "Add New Prompt": "Neuer Prompt",
    "Bulk actions": "Sammelaktionen",
    "Delete": "Löschen",
    "Edit Your Brand": "Deine Brand bearbeiten",
    "More options": "Weitere Optionen",
    "Switch": "Wechseln",
    "Switching…": "Wird gewechselt…",
    "Exporting…": "Wird exportiert…",
    "Export data": "Daten exportieren",
    "Export Your Data": "Deine Daten exportieren",
    "Copy URL": "URL kopieren",
    "Copy domain": "Domain kopieren",
    "Copied to clipboard": "In die Zwischenablage kopiert",
    "Save as Favorite": "Als Favorit speichern",
    "Remove Favorite": "Favorit entfernen",
    "Favorites": "Favoriten",
    "Recent": "Zuletzt",
    "Recent Searches": "Zuletzt gesucht",
    "Something went wrong": "Da ist etwas schiefgegangen",
    "Plan": "Tarif",
    "Metrics": "Kennzahlen",
    "Performance": "Performance",
    "Grouping": "Gruppierung",
    "New grouping": "Neue Gruppierung",
    "Sort Groups": "Gruppen sortieren",
    "Sort groups": "Gruppen sortieren",
    "Search groups": "Gruppen suchen",
    "Search groups…": "Gruppen suchen…",
    "Only show custom groupings": "Nur eigene Gruppierungen zeigen",
    "No group data available.": "Keine Gruppendaten vorhanden.",
    "No topic group matches the current search.": "Keine Topic-Gruppe passt zu dieser Suche.",
    "No topic": "Kein Topic",
    "Search or create topics...": "Topics suchen oder anlegen...",

    /* ── Ansichten und Umschalter ───────────────────────────────────────────────────────────── */
    "List view": "Listenansicht",
    "Wide view": "Breite Ansicht",
    "Switch to list view": "Zur Listenansicht",
    "Switch to wide view": "Zur breiten Ansicht",
    "Show Pages": "Seiten zeigen",
    "Hide Pages": "Seiten ausblenden",
    "Show pages": "Seiten zeigen",
    "Hide pages": "Seiten ausblenden",
    "Close pages": "Seiten schließen",
    "Close search": "Suche schließen",
    "Reset search": "Suche zurücksetzen",
    "Y axis": "Y-Achse",
    "Top": "Top",
    "Trending": "Im Trend",
    "Prompts vs Responses": "Prompts gegen Responses",
    "Total Responses analyzed:": "Ausgewertete Responses:",
    "Next page": "Nächste Seite",
    "Previous page": "Vorige Seite",

    /* ── Sortierung ─────────────────────────────────────────────────────────────────────────── */
    "Name A–Z": "Name A–Z",
    "Best performing first": "Beste zuerst",
    "Biggest risers first": "Stärkster Anstieg zuerst",
    "Custom range": "Eigener Zeitraum",
    "Custom range is unavailable. Please reload the page.":
      "Eigener Zeitraum ist nicht verfügbar. Bitte lade die Seite neu.",

    /* ── Filter ─────────────────────────────────────────────────────────────────────────────── */
    "Filter Citation Types": "Citation-Typen filtern",
    "Filter Citation and URL Types": "Citation- und URL-Typen filtern",
    "Filter by URL type": "Nach URL-Typ filtern",
    "Filter by citation type": "Nach Citation-Typ filtern",
    "Filter by market": "Nach Markt filtern",
    "Brands mentioned": "Erwähnte Brands",
    "Mentioning": "Erwähnt",
    "Mentions a brand": "Erwähnt eine Brand",
    "Mentioned Count": "Anzahl Erwähnungen",
    "Only URLs": "Nur URLs",
    "Only brands": "Nur Brands",
    "Only domains": "Nur Domains",
    "Only prompts": "Nur Prompts",
    "All URL Types": "Alle URL-Typen",
    "Citation type": "Citation-Typ",
    "URL Type": "URL-Typ",
    "URL type": "URL-Typ",
    "Types": "Typen",
    "Share Trend": "Anteil-Trend",

    /* ── Leerzustaende. Sie sind das, was man am haeufigsten sieht, wenn etwas fehlt. ───────── */
    "No URLs yet": "Noch keine URLs",
    "No domains yet": "Noch keine Domains",
    "No prompts yet": "Noch keine Prompts",
    "No responses yet": "Noch keine Responses",
    "No teams yet": "Noch keine Teams",
    "No results yet": "Noch keine Ergebnisse",
    "No matching URLs": "Keine passenden URLs",
    "No matching domains": "Keine passenden Domains",
    "No matching prompts": "Keine passenden Prompts",
    "No matching responses": "Keine passenden Responses",
    "No match": "Kein Treffer",
    "No command": "Kein Befehl",
    "No brand matches your search": "Keine Brand passt zu deiner Suche",
    "No team matches your search": "Kein Team passt zu deiner Suche",
    "No untracked brands found": "Keine unbeobachteten Brands gefunden",
    "No pages found for this domain": "Keine Seiten zu dieser Domain gefunden",
    "No pages match those filters": "Keine Seiten passen zu diesen Filtern",
    "No brands set on this page": "Auf dieser Seite sind keine Brands gesetzt",
    "No brand names were found in your AI answers for this period.":
      "In deinen KI-Antworten wurden für diesen Zeitraum keine Brand-Namen gefunden.",
    "Try a shorter search term.": "Versuche einen kürzeren Suchbegriff.",
    "You are not a member of any team": "Du bist in keinem Team",
    "Create a team to start tracking a brand.":
      "Lege ein Team an, um eine Brand zu beobachten.",
    "Domains appear here once your prompts have been run.":
      "Domains erscheinen hier, sobald deine Prompts gelaufen sind.",
    "URLs appear here once your prompts have been run.":
      "URLs erscheinen hier, sobald deine Prompts gelaufen sind.",
    "Responses appear here once your prompts have been run.":
      "Responses erscheinen hier, sobald deine Prompts gelaufen sind.",
    "Prompts appear here once your team has added them.":
      "Prompts erscheinen hier, sobald dein Team sie angelegt hat.",
    "The list has not arrived yet. Reload the page if this stays empty.":
      "Die Liste ist noch nicht da. Lade die Seite neu, wenn das leer bleibt.",
    "The scan has not returned anything yet. Refresh the page if this stays empty.":
      "Der Suchlauf hat noch nichts geliefert. Lade die Seite neu, wenn das leer bleibt.",
    "Could not load brands": "Brands konnten nicht geladen werden",
    "Brand list could not be read": "Die Brand-Liste konnte nicht gelesen werden",
    "The page-wide store is empty": "Der seitenweite Vorrat ist leer",

    /* ── Ladezustaende des Brand-Suchlaufs ──────────────────────────────────────────────────── */
    "Reading your AI answers…": "Deine KI-Antworten werden gelesen…",
    "Collecting mentioned brand names…": "Erwähnte Brand-Namen werden gesammelt…",
    "Matching names against cited domains…": "Namen werden mit zitierten Domains abgeglichen…",
    "Removing brands you already track…": "Bereits beobachtete Brands werden entfernt…",
    "Ranking by visibility…": "Wird nach Visibility sortiert…",

    /* ── Stufen im Performance-Raster ───────────────────────────────────────────────────────── */
    "At Risk": "Gefährdet",
    "Broad but Unranked": "Breit, aber ohne Rang",
    "Category Leaders": "Kategorieführer",
    "Controversial": "Umstritten",
    "Dominant & Trusted": "Dominant und vertraut",
    "High-Potential Players": "Mit hohem Potenzial",
    "Low Presence": "Kaum präsent",
    "Rising Challengers": "Aufsteiger",
    "Brands not reaching the palette": "Brands, die die Palette nicht erreichen",

    /* ── Erklaerungen an den Spaltenkoepfen ─────────────────────────────────────────────────── */
    "How many of this domain's pages were cited across all responses in the period.":
      "Wie viele Seiten dieser Domain im Zeitraum über alle Responses zitiert wurden.",
    "What kind of page this is: an article, a comparison, a product page, and so on.":
      "Um welche Art Seite es sich handelt: ein Artikel, ein Vergleich, eine Produktseite und so weiter.",
    "What kind of source this domain is: editorial, UGC, institutional, and so on.":
      "Um welche Art Quelle diese Domain ist: redaktionell, UGC, institutionell und so weiter.",
    "The market this prompt is tracked in.": "Der Markt, in dem dieser Prompt beobachtet wird.",
    "The model that produced this response.": "Das Modell, das diese Response erzeugt hat.",
    "The sources the model cited for this response.":
      "Die Quellen, die das Modell für diese Response zitiert hat.",
    "Which of your tracked brands are mentioned in this response. Hover a logo to see its name.":
      "Welche deiner beobachteten Brands in dieser Response erwähnt werden. Fahre über ein Logo, um den Namen zu sehen.",
    "Which of your tracked brands are mentioned on this page. Hover a logo to see its name.":
      "Welche deiner beobachteten Brands auf dieser Seite erwähnt werden. Fahre über ein Logo, um den Namen zu sehen.",
    "How positively the brand is described when it's mentioned for this response.":
      "Wie positiv über die Brand gesprochen wird, wenn sie in dieser Response erwähnt wird."
  });
  /* ── Dritter Teil: Drawer, Einstellungen, Opportunities, Recherche, Anmeldung ─────────────────
     NICHT dabei und mit Absicht:
       - die BRANCHENLISTE (Agriculture & Food, SaaS & Software, ...). Das ist ein Wert, der in der
         Datenbank landet; wer ihn nur in der Anzeige uebersetzt, riskiert, dass ein Abgleich auf
         den englischen Text nicht mehr trifft. Das gehoert am Datenmodell entschieden, nicht hier.
       - LAENDERNAMEN (Germany, United States, ...). Sie kommen aus den Marktdaten, sind also
         Nutzerdaten.
       - PLATTFORMNAMEN (LinkedIn, Reddit, YouTube, ...) und Modellnamen -- Eigennamen. */
  addMessages("de", {
    /* ── Kennzahlen und Erklaerungen in den Drawern ─────────────────────────────────────────── */
    "Avg. Rank": "Ø Rang",
    "Avg. Competitor Conv.": "Ø Wettbewerber-Konv.",
    "Your Conversion": "Deine Konversion",
    "Citation Share": "Citation-Anteil",
    "Citation Type Split": "Citation-Typen im Vergleich",
    "URL Type Split": "URL-Typen im Vergleich",
    "URL Share": "URL-Anteil",
    "URL Rank": "URL-Rang",
    "URL Share over Time": "URL-Anteil über Zeit",
    "Citations Share over Time": "Citation-Anteil über Zeit",
    "Global Share": "Globaler Anteil",
    "Competitor Gap": "Abstand zum Wettbewerb",
    "Mentioned competitors": "Erwähnte Wettbewerber",
    "Mentions": "Erwähnungen",
    "All mentions": "Alle Erwähnungen",
    "First mention only": "Nur erste Erwähnung",
    "Once per brand": "Einmal je Brand",
    "Every time a brand appears": "Jedes Mal, wenn eine Brand vorkommt",
    "Supporting URLs": "Stützende URLs",
    "URLs mentioning tracked brands": "URLs, die beobachtete Brands erwähnen",
    "Across all tracked prompts": "Über alle beobachteten Prompts",
    "Average across all topics in the radar": "Durchschnitt über alle Topics im Radar",
    "Average position among the brands named in a response.":
      "Die durchschnittliche Position unter den Brands, die in einer Response genannt werden.",
    "Share of responses this brand appears in.":
      "Anteil der Responses, in denen diese Brand vorkommt.",
    "How positively the brand is described, 0 to 100.":
      "Wie positiv über die Brand gesprochen wird, 0 bis 100.",
    "How many times the brand was named. Higher means the other numbers rest on more data.":
      "Wie oft die Brand genannt wurde. Mehr heißt: die anderen Zahlen stehen auf breiterer Grundlage.",
    "How many tracked competitors are mentioned alongside this source.":
      "Wie viele beobachtete Wettbewerber neben dieser Quelle erwähnt werden.",
    "How often a citation of this source turns into a mention of your brand.":
      "Wie oft aus einer Citation dieser Quelle eine Erwähnung deiner Brand wird.",
    "The same conversion rate, averaged across the competitors mentioned for this source.":
      "Dieselbe Rate, gemittelt über die Wettbewerber, die zu dieser Quelle erwähnt werden.",
    "Pick a cell in the Performance Radar to see the details for that brand and topic.":
      "Wähle eine Zelle im Performance Radar, um die Details zu dieser Brand und diesem Topic zu sehen.",
    "No cell selected": "Keine Zelle gewählt",
    "Could not load this cell": "Diese Zelle konnte nicht geladen werden",

    /* ── Leerzustaende der Drawer und Charts ────────────────────────────────────────────────── */
    "No data for this domain.": "Keine Daten zu dieser Domain.",
    "No URL data for this period.": "Keine URL-Daten für diesen Zeitraum.",
    "No URL types for this period.": "Keine URL-Typen für diesen Zeitraum.",
    "No model data for this period.": "Keine Modelldaten für diesen Zeitraum.",
    "No citation share for this period.": "Kein Citation-Anteil für diesen Zeitraum.",
    "No citations for this response.": "Keine Citations zu dieser Response.",
    "No citations match this filter.": "Keine Citations passen zu diesem Filter.",
    "No topics match your search.": "Keine Topics passen zu deiner Suche.",
    "No topics yet.": "Noch keine Topics.",
    "No variations recorded for this combination.":
      "Für diese Kombination sind noch keine Variationen erfasst.",
    "No keywords": "Keine Keywords",
    "No persona": "Keine Persona",
    "No industries found": "Keine Branchen gefunden",
    "No markets found": "Keine Märkte gefunden",
    "No file selected": "Keine Datei gewählt",
    "No usable rows found.": "Keine verwertbaren Zeilen gefunden.",
    "That file has no rows.": "Diese Datei hat keine Zeilen.",
    "That file could not be read.": "Diese Datei konnte nicht gelesen werden.",
    "The file could not be read.": "Die Datei konnte nicht gelesen werden.",
    "The rows could not be loaded.": "Die Zeilen konnten nicht geladen werden.",
    "The domain data could not be read.": "Die Domain-Daten konnten nicht gelesen werden.",
    "The response data could not be read.": "Die Response-Daten konnten nicht gelesen werden.",
    "The conversion data could not be read.": "Die Konversionsdaten konnten nicht gelesen werden.",
    "No header row recognised, first column read as the prompt.":
      "Keine Kopfzeile erkannt, die erste Spalte wird als Prompt gelesen.",

    /* ── Details, Drawer, Bedienung ─────────────────────────────────────────────────────────── */
    "Details": "Details",
    "Close details": "Details schließen",
    "Summary": "Zusammenfassung",
    "Source": "Quelle",
    "Pages": "Seiten",
    "Open": "Öffnen",
    "Open URL": "URL öffnen",
    "All Domains": "Alle Domains",
    "All URLs": "Alle URLs",
    "Top Domains": "Top-Domains",
    "Top URLs": "Top-URLs",
    "Newest": "Neueste",
    "Later": "Später",
    "Add": "Hinzufügen",
    "Set": "Setzen",
    "Off": "Aus",
    "Copied": "Kopiert",
    "Unsaved changes": "Nicht gespeicherte Änderungen",
    "Usage": "Nutzung",
    "Security": "Sicherheit",
    "What's new": "Neu",
    "Announcement": "Ankündigung",
    "Notice": "Hinweis",
    "Tip": "Tipp",
    "Feature": "Funktion",
    "Maintenance": "Wartung",
    "That was me": "Das war ich",
    "Switch theme": "Design wechseln",
    "Switch to dark mode": "Zu dunkel wechseln",
    "Switch to light mode": "Zu hell wechseln",
    "Brands, topics and settings": "Brands, Topics und Einstellungen",

    /* ── Opportunities ──────────────────────────────────────────────────────────────────────── */
    "Opportunity": "Opportunity",
    "Pending": "Offen",
    "Priority": "Priorität",
    "Top priority": "Höchste Priorität",
    "Potential": "Potenzial",
    "Quick win": "Schneller Gewinn",
    "Strong": "Stark",
    "Ignore": "Ignorieren",
    "Ignore opportunity": "Opportunity ignorieren",
    "Grid": "Raster",
    "List": "Liste",

    /* ── Prompt Research ────────────────────────────────────────────────────────────────────── */
    "Prompt research": "Prompt-Recherche",
    "Start Research": "Recherche starten",
    "Delete research": "Recherche löschen",
    "Previous Researches": "Frühere Recherchen",
    "Untitled research": "Recherche ohne Namen",
    "Researching": "Recherchiert",
    "Running": "Läuft",
    "Discovery": "Entdeckung",
    "Buying intent": "Kaufabsicht",
    "Alternatives": "Alternativen",
    "Best-of": "Best-of",
    "How-to": "Anleitung",
    "Reviews": "Bewertungen",
    "Open research settings": "Recherche-Einstellungen öffnen",
    "Close research settings": "Recherche-Einstellungen schließen",
    "Understanding your intent…": "Deine Absicht wird verstanden…",
    "Building prompt variations…": "Prompt-Varianten werden gebaut…",
    "Matching intent patterns…": "Absichtsmuster werden abgeglichen…",
    "Estimating search volume…": "Suchvolumen wird geschätzt…",
    "Scoring & tagging prompts…": "Prompts werden bewertet und getaggt…",
    "That took longer than expected. Please try again.":
      "Das hat länger gedauert als erwartet. Bitte versuche es noch einmal.",

    /* ── Prompts und Brands hinzufuegen ─────────────────────────────────────────────────────── */
    "Add prompts": "Prompts hinzufügen",
    "Add this prompt": "Diesen Prompt hinzufügen",
    "Adding…": "Wird hinzugefügt…",
    "Add Brand": "Brand hinzufügen",
    "Add brand": "Brand hinzufügen",
    "Could not add this brand. Please try again.":
      "Diese Brand konnte nicht hinzugefügt werden. Bitte versuche es noch einmal.",
    "This brand could not be loaded. Please open it again.":
      "Diese Brand konnte nicht geladen werden. Bitte öffne sie noch einmal.",
    "Enter a domain.": "Gib eine Domain ein.",
    "This domain is too long.": "Diese Domain ist zu lang.",
    "Search companies...": "Firmen suchen...",
    "Search industries": "Branchen suchen",
    "Select an industry": "Branche wählen",
    "Brand industry": "Branche der Brand",
    "Brand Summary": "Beschreibung der Brand",
    "Brand summary": "Beschreibung der Brand",
    "Describe what your company does…": "Beschreibe, was dein Unternehmen tut…",
    "Business model": "Geschäftsmodell",
    "Hybrid (B2B & B2C)": "Gemischt (B2B und B2C)",
    "Default market": "Standardmarkt",
    "Market for all new prompts": "Markt für alle neuen Prompts",
    "Topics for all new prompts": "Topics für alle neuen Prompts",

    /* ── Einstellungen: Marke, Logo, Modelle, Team ──────────────────────────────────────────── */
    "Paste a direct link to your image file.": "Füge einen direkten Link zu deiner Bilddatei ein.",
    "Square images work best.": "Quadratische Bilder wirken am besten.",
    "PNG or SVG, up to 1 MB.": "PNG oder SVG, bis 1 MB.",
    "Only PNG and SVG files are supported.": "Es werden nur PNG- und SVG-Dateien unterstützt.",
    "Select the AI models you want to track. Your plan currently":
      "Wähle die KI-Modelle, die du beobachten willst. Dein Tarif erlaubt derzeit",
    "Only admins can change the tracked models.":
      "Nur Admins können die beobachteten Modelle ändern.",
    "At least one model has to stay active. Turn on another one first.":
      "Mindestens ein Modell muss aktiv bleiben. Schalte zuerst ein anderes ein.",
    "This model cannot be changed right now.":
      "Dieses Modell kann gerade nicht geändert werden.",
    "This model is not available yet.": "Dieses Modell gibt es noch nicht.",
    "Your plan does not include this model.": "Dein Tarif enthält dieses Modell nicht.",
    "Your plan allows": "Dein Tarif erlaubt",
    "Invite new members": "Neue Mitglieder einladen",
    "Remove from team": "Aus dem Team entfernen",
    "Leave": "Verlassen",
    "Leave team": "Team verlassen",
    "Delete team": "Team löschen",
    "Click again to delete": "Zum Löschen noch einmal klicken",
    "You lose access to this workspace. Other members keep theirs.":
      "Du verlierst den Zugang zu diesem Arbeitsbereich. Die anderen Mitglieder behalten ihren.",
    "This deletes the workspace and everything in it, for every member. It cannot be undone.":
      "Das löscht den Arbeitsbereich und alles darin, für jedes Mitglied. Es lässt sich nicht zurückholen.",
    "The last owner cannot be changed or removed.":
      "Der letzte Besitzer kann nicht geändert oder entfernt werden.",
    "You cannot manage this member.": "Dieses Mitglied kannst du nicht verwalten.",
    "This element is not connected yet. Please reload the page.":
      "Dieses Element ist noch nicht verbunden. Bitte lade die Seite neu.",

    /* ── Anmeldung ──────────────────────────────────────────────────────────────────────────── */
    "Sign in": "Anmelden",
    "Sign up": "Registrieren",
    "Signing in": "Wird angemeldet",
    "Create account": "Konto anlegen",
    "Creating account": "Konto wird angelegt",
    "Sign in to win AI Search.": "Melde dich an und gewinne die KI-Suche.",
    "Sign up to win AI Search.": "Registriere dich und gewinne die KI-Suche.",
    "Welcome Back": "Willkommen zurück",
    "Let’s get you set up": "Richten wir dich ein",
    "You’re all set": "Alles fertig",
    "Already have an account?": "Du hast schon ein Konto?",
    "Don’t have an account?": "Du hast noch kein Konto?",
    "Your password": "Dein Passwort",
    "At least 8 characters": "Mindestens 8 Zeichen",
    "At least 8 characters.": "Mindestens 8 Zeichen.",
    "Please enter a password.": "Bitte gib ein Passwort ein.",
    "Please enter an email address.": "Bitte gib eine E-Mail-Adresse ein.",
    "Please enter your email address.": "Bitte gib deine E-Mail-Adresse ein.",
    "Please enter your name.": "Bitte gib deinen Namen ein.",
    "That does not look like an email address.": "Das sieht nicht wie eine E-Mail-Adresse aus.",
    "Check your inbox to confirm your email address.":
      "Sieh in dein Postfach, um deine E-Mail-Adresse zu bestätigen.",
    "Send me product updates": "Schick mir Produktneuigkeiten",
    "Something went wrong. Please try again.":
      "Da ist etwas schiefgegangen. Bitte versuche es noch einmal.",

    /* ── Brand-Hervorhebung in den Charts ───────────────────────────────────────────────────── */
    "Your brand only": "Nur deine Brand",
    "No brand highlighting": "Keine Hervorhebung",
    "Competitors stay plain": "Wettbewerber bleiben neutral",
    "Monochrome": "Einfarbig",
    "Solid": "Durchgezogen",
    "Brand Colors": "Brand-Farben",
    "Use logo color": "Farbe aus dem Logo",
    "Reading logo…": "Logo wird gelesen…",
    "This brand has no logo yet.": "Diese Brand hat noch kein Logo.",
    "No clear color found in this logo. Pick one by hand.":
      "In diesem Logo ist keine klare Farbe zu finden. Wähle eine von Hand.",
    "Please reload the page and try again.": "Bitte lade die Seite neu und versuche es noch einmal.",
    "What are Brand Colors?": "Was sind Brand-Farben?",
    "Every brand is drawn in its own color instead of a fixed palette. You set that color per brand in Settings under Your Brand, in the Brand Color section. Brands without one fall back to a neutral color.":
      "Jede Brand wird in ihrer eigenen Farbe gezeichnet statt in einer festen Palette. Diese Farbe " +
      "setzt du je Brand in den Einstellungen unter Your Brand, im Abschnitt Brand Color. Brands " +
      "ohne eigene Farbe bekommen eine neutrale."
  });
  /* ── Prompts Table und Prompts-Seitenkopf, VOLLSTAENDIG ───────────────────────────────────────
     Gesammelt wurde nicht aus dem Quelltext, sondern aus allem, was diese zwei Dateien und ihre
     Bubble-Vorlage an Text enthalten -- Tabelle, Kopfzeile, Werkzeuge, alle Menues, die
     Gruppierung, die Sammelleiste, die Topic-Verwaltung, jeder Leerzustand.
     Das GLOSSAR gilt: Prompt(s), Brand(s), Topic(s), Visibility, Sentiment bleiben englisch, auch
     mitten im deutschen Satz. Darum "Keine passenden Prompts" und nicht "Keine passenden Eingaben".
     Saetze mit Zahlen tragen {n} -- sie werden in prompts-table gebaut und dort eingesetzt. */
  addMessages("de", {
    /* Kopfzeile und Zustand */
    "All Prompts": "Alle Prompts",
    "Prompt status": "Status des Prompts",
    "Search prompts": "Prompts suchen",
    "Search prompts...": "Prompts suchen...",
    "Search, filters and settings": "Suche, Filter und Einstellungen",

    /* Auswahl und Sammelleiste */
    "1 selected": "1 ausgewählt",
    /* Wortwoertlich, zusaetzlich zum Muster: dieser Text steht im Bubble-Markup als Startwert der
       Sammelleiste. Sichtbar ist er nie (die Leiste erscheint erst ab einer Auswahl), aber solange
       er dasteht, ist er englischer Text auf einer deutschen Seite. */
    "0 selected": "0 ausgewählt",
    "{n} selected": "{n} ausgewählt",
    "Select all {n} prompts": "Alle {n} Prompts auswählen",
    "Clear selection": "Auswahl aufheben",
    "Bulk actions": "Sammelaktionen",
    "Set Active": "Auf aktiv setzen",
    "Set Inactive": "Auf inaktiv setzen",

    /* Gruppierung */
    "Grouping": "Gruppierung",
    "Group by topics": "Nach Topics gruppieren",
    "Custom groupings": "Eigene Gruppierungen",
    "Only show custom groupings": "Nur eigene Gruppierungen zeigen",
    "No custom grouping yet.": "Noch keine eigene Gruppierung.",
    "Sort groups by": "Gruppen sortieren nach",
    "Sort Groups": "Gruppen sortieren",
    "Sort groups": "Gruppen sortieren",
    "Search groups": "Gruppen suchen",
    "Search groups…": "Gruppen suchen…",
    "No groups": "Keine Gruppen",
    "No prompts in this group": "Keine Prompts in dieser Gruppe",
    "No group data available.": "Keine Gruppendaten vorhanden.",
    "No topic group matches the current search.": "Keine Topic-Gruppe passt zu dieser Suche.",
    "Active view only – inactive prompts stay ungrouped.":
      "Gilt nur für die aktive Ansicht – inaktive Prompts bleiben ungruppiert.",
    "Group Open": "Gruppe offen",

    /* Topics am Prompt */
    "Edit Topics": "Topics bearbeiten",
    "Add Topic": "Topic hinzufügen",
    "Search or create topics...": "Topics suchen oder anlegen...",
    "No topics available": "Keine Topics vorhanden",
    "No topics on this prompt yet": "Noch keine Topics an diesem Prompt",
    "No more topics to add": "Keine weiteren Topics zum Hinzufügen",
    "No topic": "Kein Topic",
    "Generate More": "Mehr erzeugen",

    /* Filter auf Brand-Erwähnungen */
    "Mentioned brands": "Erwähnte Brands",
    "No brands available": "Keine Brands vorhanden",
    "Clear filters": "Filter zurücksetzen",

    /* Leerzustaende der Tabelle */
    "No prompts yet": "Noch keine Prompts",
    "No matching prompts": "Keine passenden Prompts",
    "Prompts appear here once your team has added them.":
      "Prompts erscheinen hier, sobald dein Team sie angelegt hat.",
    "Nothing matches the current search and filters.":
      "Zu dieser Suche und diesen Filtern gibt es nichts.",

    /* Ansicht und Zeilen */
    "Rows": "Zeilen",
    /* Die Zeilenhoehen dieser Tabelle (data-tip an den drei Knoepfen). "Default" heisst hier
       Standardhoehe -- nicht zu verwechseln mit der Farbskala, die inzwischen "Brand Colors"
       heisst. */
    "Default": "Standard",
    "Dynamic": "Dynamisch",
    /* Kleingeschrieben, wie es im Markup steht -- der Schluessel ist der Text, nicht seine
       Bedeutung. Beide Schreibweisen kommen vor. */
    "Table settings": "Tabelle einstellen",
    "Sort, search and table settings": "Sortieren, suchen und Tabelle einstellen",
    "List view": "Listenansicht",
    "Wide view": "Breite Ansicht",
    "Switch to list view": "Zur Listenansicht",
    "Switch to wide view": "Zur breiten Ansicht",

    /* Seitenkopf */
    "Manage Prompts, Topics and monitor latest Responses":
      "Prompts und Topics verwalten, neueste Responses ansehen"
  });
  /* ── Vierter Teil: GANZE Absaetze, so wie sie auf dem Schirm stehen ───────────────────────────
     Diese Liste ist nicht aus dem Quelltext gegriffen, sondern von der laufenden Seite gelesen:
     ein Durchlauf ueber die Textknoten, der ausgibt, was NICHT im Katalog steht. Das war noetig,
     weil mehrere Saetze im Markup zu EINEM Textknoten zusammenstehen -- "Change your logo to
     personalize your workspace. Square images work best. Paste a direct link to your image file."
     ist ein Knoten, und drei einzelne Schluessel dafuer treffen nie.
     Nicht dabei: Eigennamen (ChatGPT, OpenAI, Google AI Overviews, Perplexity, Gemini, DeepSeek),
     die Reiter des Seitenkopfs (siehe Seitenleiste) und die Branchenliste. */
  addMessages("de", {
    "Brand Settings": "Brand-Einstellungen",
    "Your brand identity as it appears across the workspace.":
      "Wie deine Brand im ganzen Arbeitsbereich erscheint.",
    "Brand Name & Matching Aliases": "Brand-Name und passende Aliase",
    "To edit your primary tracking and display name, or to add matching aliases, use the button on the right.":
      "Um den Namen zu ändern, unter dem beobachtet und angezeigt wird, oder um Aliase zu ergänzen, " +
      "benutze den Knopf rechts.",
    "Brand Logo": "Brand-Logo",
    "Change your logo to personalize your workspace. Square images work best. Paste a direct link to your image file.":
      "Ändere dein Logo, um den Arbeitsbereich persönlicher zu machen. Quadratische Bilder wirken " +
      "am besten. Füge einen direkten Link zu deiner Bilddatei ein.",
    "Upload": "Hochladen",
    "Use an image link instead": "Stattdessen einen Bildlink verwenden",
    "Use link": "Link verwenden",
    "Model Settings": "Modell-Einstellungen",
    "Which AI models your prompts run against.": "Gegen welche KI-Modelle deine Prompts laufen.",
    "Manage AI Models": "KI-Modelle verwalten",
    "Select the AI models you want to track. Your plan currently supports up to 3 active models.":
      "Wähle die KI-Modelle, die du beobachten willst. Dein Tarif erlaubt derzeit bis zu 3 aktive Modelle.",
    "Save models": "Modelle speichern",
    "Meta Settings": "Grundeinstellungen",
    "Context the system uses when it generates prompts and analyses.":
      "Der Kontext, den das System beim Erzeugen von Prompts und Analysen verwendet.",
    "Default Market": "Standardmarkt",
    "Your preset primary market focus. New prompts start here unless you pick a different one.":
      "Dein voreingestellter Hauptmarkt. Neue Prompts starten hier, wenn du keinen anderen wählst.",
    "Business Model": "Geschäftsmodell",
    "Your target audience.": "Deine Zielgruppe.",
    "Brand Industry": "Branche der Brand",
    "Your preset primary brand industry.": "Die voreingestellte Hauptbranche deiner Brand.",
    "Not listed? Add your own": "Nicht dabei? Eigene ergänzen",
    "Save settings": "Einstellungen speichern",
    "Danger Zone": "Kritischer Bereich",
    "These actions affect the whole team and cannot be undone.":
      "Diese Aktionen betreffen das ganze Team und lassen sich nicht zurückholen.",
    "Leave Team": "Team verlassen",
    "Delete Team": "Team löschen",
    "Deletes the workspace and every brand, prompt and report in it, for everyone. This cannot be undone.":
      "Löscht den Arbeitsbereich und jede Brand, jeden Prompt und jeden Report darin, für alle. " +
      "Das lässt sich nicht zurückholen.",

    /* ── team-orga: die drei Abschnitte und ihre Spalten ─────────────────────────────────────── */
    "Team Members": "Teammitglieder",
    "Manage who has access to this team and what they can do":
      "Verwalte, wer Zugang zu diesem Team hat und was er darf",
    "Invite new Members": "Neue Mitglieder einladen",
    "E Mail": "E-Mail",
    "Email": "E-Mail",
    "Joined At": "Beigetreten",
    "Role": "Rolle",
    "Pending Invites": "Offene Einladungen",
    "Invitations that have been sent but not accepted yet":
      "Einladungen, die verschickt, aber noch nicht angenommen wurden",
    "Expires": "Läuft ab",
    "Invited by": "Eingeladen von",
    "Activity Log": "Verlauf",
    "Every change to this team, newest first": "Jede Änderung an diesem Team, neueste zuerst",
    "Event": "Ereignis",
    "Actor": "Wer",
    "Target": "Wen",
    "Resend": "Erneut senden",
    "Revoke": "Zurückziehen"
  });
  function t(text){
    var l = getPref("locale");
    if (l === "en") return text;
    var tab = MSG[l];
    var v = tab && tab[text];
    return typeof v === "string" && v ? v : text;
  }

  /* ---- Zahlen ----
     EIN Ort fuer die zwei Trennzeichen. Wer eine Zahl formatiert, ruft nicht toLocaleString: das
     haengt an der Spracheinstellung des BROWSERS, und genau die soll hier nicht entscheiden. */
  /* muster (optional) ueberschreibt die Einstellung -- fuer eine VORSCHAU: "so wuerde es mit dem
     anderen Format aussehen". Ohne diesen Weg musste der Aufrufer die Einstellung kurz umschalten
     und zuruecksetzen, und das ist teuer und falsch: setPref schreibt in die Ablage und feuert
     up-prefs-change, also zeichnet die ganze Seite neu. Im Einstellungsfenster hat genau das die
     Beispieltexte zum Problem gemacht -- beim Aufbau des Auswahlmenues lief zweimal setPref, jeder
     Chart der Seite lud neu, und der onPrefs-Zuhoerer des Fensters hat dabei das gerade gebaute
     Menue aus dem Dokument geworfen. Dieselbe Bauart wie fmtDateMuster, das den Wert schon immer
     mitnimmt. */
  function trennzeichen(muster){
    var m = muster || getPref("num");
    return m === "de" ? { dez: ",", tsd: "." } : { dez: ".", tsd: "," };
  }
  /* Tausenderpunkte in eine bereits fertige Ganzzahl-Zeichenkette setzen. */
  function tausender(ganz, tsd){
    return String(ganz).replace(/\B(?=(\d{3})+(?!\d))/g, tsd);
  }
  /* Die eine Stelle, durch die JEDE Zahl dieser App geht. nachkomma == null heisst: so viele
     Stellen, wie die Zahl schon hat (also keine erzwungene Genauigkeit). */
  function fmtNum(v, nachkomma, mitTausender, muster){
    var n = Number(v);
    if (!isFinite(n)) return "–";
    var t = trennzeichen(muster);
    var s = (nachkomma == null) ? String(n) : n.toFixed(nachkomma);
    var teile = s.split(".");
    if (mitTausender !== false) teile[0] = tausender(teile[0], t.tsd);
    return teile.length > 1 ? teile[0] + t.dez + teile[1] : teile[0];
  }

  /* ---------------------------------------------------------------------------------------------
     parseLoose(raw, label) -- parse a string Bubble built, not a string a JSON encoder built.

     Every payload that arrives as text from a Bubble expression has been damaged in one of five
     ways, and FOUR of them fail with the byte-identical message at the byte-identical position
     ("Expected property name or '}' at line 2 column 5"), so the error alone can never tell them
     apart. That cost several wrong diagnoses on the topics seed before a code-point dump settled
     it. The five, in the order they are undone here:

       1. BOM / NBSP / zero-width -- Bubble pretty-prints its indent with U+00A0, and JSON.parse
          accepts only space, tab, CR, LF as whitespace.
       2. Curly quotes -- Bubble's editor turns " into a typographic pair.
       3. HTML entities -- a dynamic value dropped into markup arrives with &quot; and friends, and
          the content of a <script> block is raw text the browser never decodes on its own.
          Decoded through a textarea, i.e. the browser's own entity table, not a hand-written list.
       4. Bare keys -- Bubble emits a JS OBJECT LITERAL: [{ id: "0e62", name: "SHK" }].
       5. EMPTY VALUES -- an unfilled dynamic expression leaves nothing at all behind:
          {"avg_rank_prev": , "x": 3}. This one is not even a repair of JSON, it is a repair of a
          JS syntax error, and it is the reason a Run-JavaScript step can blow up before a single
          line of component code runs. Filled with null.

     Repairs 4 and 5 only ever run AFTER a strict parse has already failed, and the result is only
     kept if the repaired text parses -- so well-formed JSON is never touched, and a genuinely
     broken payload still reports its ORIGINAL error rather than a confusing second one. Returns
     null and warns (with the code-point dump) when nothing works. Arrays/objects pass straight
     through, so a caller can accept both shapes without branching. */
  function parseLoose(raw, label){
    if (raw == null) return null;
    if (typeof raw === "object") return raw;               // already a value, nothing to parse
    var s = String(raw)
      /* Written as \u escapes on purpose: these characters are INVISIBLE, and a literal NBSP
         or BOM sitting in this source file is one careless editor save away from disappearing
         and taking the repair with it. */
      .replace(/^\uFEFF/, "")
      .replace(/[\u00A0\u2000-\u200D\u202F\u205F\u3000]/g, " ")
      .trim();
    /* Typographic quotes are deliberately NOT normalised here. \u201Eso ist das", said by a German
       prompt, is a perfectly legal sequence of characters inside a JSON string -- rewriting it to
       "so ist das" injects two structural-looking quotes into a text value, and the one before the
       comma then ends the string 400 characters early. They are only ever worth repairing where
       they stand in for STRUCTURE, which repair() below can tell and a blanket .replace() cannot. */
    if (!s) return null;
    /* Doppelt verpackt: ein Run-JS-Step, der JSON.stringify UM einen Payload legt, der schon Text
       ist. Das Ergebnis ist ein String, dessen erstes Zeichen ein Anfuehrungszeichen ist und der
       escapte Anfuehrungszeichen enthaelt -- gueltiges JSON, aber ein String statt eines Objekts.
       Einmal auspacken, statt es als "kein JSON" abzulehnen: der Aufrufer hat einen Fehler
       gemacht, nicht die Daten. Nur bei genau diesem Muster, damit ein Textwert nicht zerlegt wird. */
    if (s.charAt(0) === '"' && s.charAt(s.length - 1) === '"' && s.indexOf('\\"') >= 0){
      try {
        var innen = JSON.parse(s);
        if (typeof innen === "string" && /^\s*[\[{]/.test(innen)) s = innen.trim();
      } catch (e) {}
    }
    if (s.indexOf("&") >= 0){
      var dec = document.createElement("textarea");
      dec.innerHTML = s;
      s = String(dec.value || s).trim();
    }
    /* Repairs 4 and 5 rewrite STRUCTURE, so they must never look inside a string VALUE -- a topic
       named "Heating: , Solar" or a prompt text that ends in a colon would otherwise be silently
       corrupted by the empty-value rule, and silently is the worst way for that to go wrong. So
       walk the text once and split it into string literals (copied verbatim, backslash escapes
       respected) and everything else; the regexes only ever see the everything-else. A plain
       global .replace() cannot make that distinction. */
    function fixCode(t){
      return t
        /* Bare keys -> quoted keys. */
        .replace(/([{,]\s*)([A-Za-z_$][A-Za-z0-9_$]*)\s*:/g, '$1"$2":')
        /* Bubble's yes/no as a bare word -> true/false. Ein "yes" ohne Anfuehrungszeichen ist
           JSON-fremd und war bisher das Ende: die Doku traegt die Ersetzung als Zeile im Schritt,
           aber wer sie vergisst, verlor den ganzen Payload. Hier gemessen als "The domain data
           could not be read." bei einem Payload, dem nur diese Zeile fehlte. Nur in WERT-Position,
           erkennbar am : davor -- ein Feld, das "yes" heisst, bleibt ein Feldname. */
        .replace(/:(\s*)(yes|no)\s*(?=[,}\]]|$)/gi, function(_, w, v){
          return ":" + w + (String(v).toLowerCase() === "yes" ? "true" : "false");
        })
        /* Empty value before the next comma or the closing brace/bracket -> null. */
        .replace(/:\s*(?=[,}\]])/g, ": null")
        /* Ein LEERES Listenelement: [a, , b] und [ , a]. Das entsteht, wenn Bubble eine Liste
           Zeile fuer Zeile mit einem Komma dazwischen einsetzt und eine Zeile leer bleibt -- in
           JS-Quellposition ist das der "Unexpected token ','", den Toolbox meldet, und als Text
           war es bis hier das Ende des ganzen Payloads.
           Das leere Element wird ENTFERNT, nicht zu null: es ist kein Datensatz, sondern ein
           verirrtes Komma, und ein null an seiner Stelle ist schlimmer als der alte Fehlerzustand
           -- gemessen riss es die Komponente mit ("Cannot read properties of null (reading 'day')"
           aus renderChart), und ein Wurf im Setter nimmt den ganzen Run-JS-Schritt mit, also auch
           die Setter der Komponenten darunter.
           Wirkt auch im Objekt ({"a":1, ,"b":2}), und dort ist das Entfernen ebenso richtig.
           Zweimal, weil sich ueberlappende Vorkommen ([a, , , b]) sonst nur halb treffen. */
        .replace(/,\s*,/g, ",")
        .replace(/,\s*,/g, ",")
        .replace(/([[{])\s*,/g, "$1")
        /* Trailing comma left behind when the LAST value was the empty one. */
        .replace(/,\s*(?=[}\]])/g, "");
    }
    /* Repair 6: an UNESCAPED double quote inside a string value.

       Bubble hands the RPC result over as text, and a quote that the source data carried lands
       in the payload raw -- these are real titles that killed a whole page load:

         "title":       mITSM x it-sa 2025 "KI sicher und effektiv einsetzen: …"
         "description": Top 10 Audit Management Software 2026 — title: "Ju…

       Naively scanning to "the next quote" ends the string at the inner one, so everything after
       it parses as code and the payload is rejected. Nothing in the console says so, because the
       Run-JS step's own toArr() catches the throw and returns [] -- an empty table with no error.

       Tell the two apart by what FOLLOWS the quote: a real closing quote is followed (ignoring
       whitespace) by a structural character -- , : } ] -- or by end of input. Anything else means
       the quote was part of the text, so escape it and keep going.

       Known limit, and it cannot be resolved without guessing: a value that genuinely ends a
       quoted phrase right before a comma -- he said "hi", then left -- closes early here. That is
       ambiguous even by eye. This heuristic gets every real payload seen so far and, unlike the
       old behaviour, degrades to a partial parse instead of dropping the whole table. */
    /* Repair 7: a RAW control character inside a string value -- almost always a newline.

       Bubble hands the payload to a Run-JavaScript step inside BACKTICKS. A template literal is
       parsed by the JS engine before the component ever sees it, and the engine resolves escape
       sequences: a \n that the RPC wrote as two characters arrives here as one real line break,
       sitting inside a quoted value. JSON forbids that, so the strict parse fails -- and the
       repair used to fail too, because it copied the break through verbatim.

       Same story for a lone backslash: `C:\Users` loses its escape meaning in the literal, and
       whatever survives has to be re-escaped or JSON.parse rejects it.

       This is why responses-table was the first component to break on it: response_preview is
       the first field in this app that carries multi-line text. */
    var CTRL = { "\n": "\\n", "\r": "\\r", "\t": "\\t", "\b": "\\b", "\f": "\\f" };
    var DQUOTE = '"“”„‟″';
    /* curly tells scanString the literal was OPENED by a typographic quote, which is the only case
       where a typographic quote may also CLOSE it. Opened by a plain ", every „ and " inside is
       ordinary text and gets copied through untouched. */
    /* istWert sagt, ob der Literal an einer WERT-Stelle steht (also direkt hinter einem : ) oder an
       einer Schluessel-Stelle. Der Unterschied entscheidet, ob ein : nach dem Anfuehrungszeichen
       ein String-Ende sein darf: ein SCHLUESSEL wird von : gefolgt, ein WERT niemals.
       Ohne diese Unterscheidung brach genau diese echte Beschreibung:
         "description": "... — title: "LeeUP Media ..." meta: "og:title": "LeeUP Media ..."
       Beim inneren "og:title" folgte ein : , das galt als Ende, und ab da war die Struktur hin.
       Der Fehler in der Konsole zeigte auf Position 9557 -- vierhundert Zeichen hinter der
       eigentlichen Stelle, weil der Parser bis dahin munter weiterlief. */
    /* Was in gueltigem JSON nach einem Komma stehen DARF: ein Schluessel oder ein String (beides
       beginnt mit "), ein Objekt, eine Liste, eine Zahl oder true/false/null. Alles andere heisst:
       dieses Komma steht im Text. */
    function fortsetzungOk(t, k){
      var n = t.length;
      while (k < n && /\s/.test(t.charAt(k))) k++;
      if (k >= n) return true;                       /* Ende der Eingabe -- abgeschnittener Payload */
      var c = t.charAt(k);
      if (c === '"' || DQUOTE.indexOf(c) >= 0) return true;
      if (c === "{" || c === "[" || c === "-" || (c >= "0" && c <= "9")) return true;
      if (t.substr(k, 4) === "true" || t.substr(k, 4) === "null") return true;
      if (t.substr(k, 5) === "false") return true;
      /* Ein unquotierter Schluessel, den repair() selbst noch reparieren wuerde:
         Buchstabe/Unterstrich, gefolgt von Wortzeichen und einem Doppelpunkt. */
      if (/^[A-Za-z_$][\w$]*\s*:/.test(t.substr(k, 64))) return true;
      return false;
    }
    function scanString(t, i, curly, istWert){
      var n = t.length, j = i + 1, body = "";
      while (j < n){
        var c = t.charAt(j);
        if (c === "\\"){
          var esc = t.charAt(j + 1);
          /* A valid JSON escape survives byte for byte; a stray backslash becomes a literal one. */
          if (esc !== "" && '"\\/bfnrtu'.indexOf(esc) >= 0){ body += t.substr(j, 2); j += 2; }
          else { body += "\\\\"; j++; }
          continue;
        }
        if (c < " "){
          body += CTRL[c] || ("\\u" + ("000" + c.charCodeAt(0).toString(16)).slice(-4));
          j++; continue;
        }
        if (c === '"' || (curly && DQUOTE.indexOf(c) >= 0)){
          var k = j + 1;
          while (k < n && /\s/.test(t.charAt(k))) k++;
          var nxt = t.charAt(k);
          /* Bei einem KOMMA reicht das Komma allein nicht. Genau daran ist der Payload der
             URLs-Tabelle am 01.09. gescheitert:

                 "description": "In dieser Folge von \"Würth Connect", füh",

             Der Wert enthaelt ein escaptes UND ein nacktes Anfuehrungszeichen (die Quelle kuerzt
             den Text auf 50 Zeichen und escapt dabei nicht mehr sauber). Am nackten stand ein
             Komma dahinter, also galt es als Ende des Wertes -- der Rest ", füh" landete in
             Code-Position und riss die ganze Liste mit. Gemeldet als "position 10052".

             Also einen Schritt weiter schauen: NACH einem echten Komma folgt in gueltigem JSON
             immer ein Schluessel oder ein Wert. "füh" ist keins von beiden, das Komma steht also
             im Text und das Anfuehrungszeichen davor gehoert dazu.
             Bei } und ] bleibt es beim einfachen Test: dort ist die Lage eindeutig genug, und ein
             Text, der auf "} endet, ist selten genug, um ihn nicht gegen Schaerfe zu tauschen. */
          var strukturell;
          if (k >= n || nxt === "}" || nxt === "]" || (nxt === ":" && !istWert)) strukturell = true;
          else if (nxt === ",") strukturell = fortsetzungOk(t, k + 1);
          else strukturell = false;
          if (strukturell){
            return { end: j + 1, text: '"' + body + '"' };
          }
          if (c === '"'){ body += '\\"'; }          // literal quote inside the value
          else { body += c; }                       // typographic quote: plain text, keep as is
          j++; continue;
        }
        body += c; j++;
      }
      return { end: n, text: '"' + body + '"' };
    }
    function repair(t){
      var out = "", buf = "", i = 0, n = t.length;
      while (i < n){
        var ch = t.charAt(i);
        /* A typographic quote out here, in CODE position, cannot be prose -- it is standing in for
           a structural quote, so open a literal on it. Inside a literal it is just a character. */
        if (DQUOTE.indexOf(ch) >= 0){
          /* Wert oder Schluessel? Was vor dem Literal steht, sagt es: ein : (nach Leerraum)
             heisst Wert, ein { oder , heisst Schluessel. */
          var v = buf.length - 1;
          while (v >= 0 && /\s/.test(buf.charAt(v))) v--;
          var davor = v >= 0 ? buf.charAt(v) : "";
          var lit = scanString(t, i, ch !== '"', davor === ":");
          out += fixCode(buf); buf = "";
          out += lit.text;
          i = lit.end;
        } else { buf += t.charAt(i); i++; }
      }
      return out + fixCode(buf);
    }
    var strictMsg = "", repairMsg = "", fixed = "";
    try { return JSON.parse(s); }
    catch (strictErr){
      strictMsg = strictErr.message;
      try { fixed = repair(s); return JSON.parse(fixed); }
      catch (repairErr){ repairMsg = repairErr.message; }
    }
    /* Report the REPAIR failure, not the strict one. The strict error is always about whatever
       Bubble mangled first -- an empty value, an unquoted key -- and every one of those has a
       repair. Printing it sends you hunting for a bug that is already fixed; the only message
       that says anything is why the repaired text STILL does not parse. Print the neighbourhood
       of that position too: "unexpected token" without the surrounding 60 characters is a riddle,
       and a riddle in a console warning is the same as no warning at all. */
    if (window.console){
      var at = /position (\d+)/.exec(repairMsg), near = "";
      if (at){
        var p = +at[1];
        near = "\n  around it:   …" + JSON.stringify(fixed.slice(Math.max(0, p - 60), p + 60)) + "…";
      }
      console.warn("[" + (label || "upstreem") + "] payload is not valid JSON — ignored." +
        "\n  after repair: " + repairMsg + near +
        "\n  strict parse: " + strictMsg + "  (repairable, not the cause)" +
        "\n  first chars:  " + JSON.stringify(s.slice(0, 48)));
    }
    return null;
  }

  /* Repairs a render payload that Bubble handed over as TEXT instead of as code.

     Why this has to exist: Bubble builds a "Run JavaScript" step by pasting the RPC result into
     the step's source as plain text. Any DOUBLE QUOTE inside a value then ends the surrounding JS
     string early and the rest of the array becomes garbage — the step dies with
     "SyntaxError: Unexpected token ']'" BEFORE any component code runs, so the table just stays
     empty with nothing in the console pointing at it. Real, measured examples that killed a whole
     page load:

       "title":       mITSM x it-sa 2025 "KI sicher und effektiv einsetzen: …"
       "description": Top 10 Audit Management Software 2026 — title: "Ju…

     The same payload without a quote anywhere renders fine, which is exactly why this looks like
     a random per-team failure until you diff the two payloads character by character.

     The cure is on Bubble's side -- wrap the array in BACKTICKS so it is inert text rather than
     code (see any bubble/*.html render section) -- but that only helps if this side then accepts
     a string, which is what this function is for. parseLoose additionally repairs the four other
     things Bubble does to such a string: empty values, NBSP indentation, curly quotes, HTML
     entities, unquoted keys.

     Returns a SHALLOW COPY when it changes anything -- the caller's object is left alone, since
     components hold on to params and a surprise mutation there is its own class of bug. */
  function normParams(params, label){
    if (typeof params === "string"){
      var roh = params, parsed = parseLoose(params, label);
      /* A bare array is the other easy mistake: renderFoo(`[ … ]`) instead of
         renderFoo(`{"instanceId": …, "rows": [ … ]}`). Treat it as the rows list. */
      /* Zweiter Versuch mit readBubble, BEVOR etwas als unlesbar gilt. parseLoose und
         parseBubbleJson koennen verschiedene Dinge: gemessen am 24.08. an denselben sechs
         Payloads scheitert parseLoose an einem nackten Emoji ("note": 💎), waehrend der Scanner
         in parseBubbleJson es sauber liest. Ohne diesen zweiten Versuch meldete die Komponente
         "The data could not be read." fuer Daten, die lesbar sind -- und ein Fehlalarm ist hier
         schlimmer als die alte stille Leere, weil der Nutzer daraufhin neu laedt und wieder
         dasselbe sieht. */
      if (!isArr(parsed) && !(parsed && typeof parsed === "object")){
        var zweit = readBubble(roh);
        if (zweit && typeof zweit === "object") parsed = zweit;
      }
      if (isArr(parsed)) params = { rows: parsed };
      else if (parsed && typeof parsed === "object") params = parsed;
      else {
        /* Bisher wurde daraus schlicht {} -- und damit sah ein zerrissener Payload fuer JEDE
           Komponente aus wie "es kam gar nichts". Gemessen am 24.08. an vier Tabellen und
           discover-brands: nach einem abgeschnittenen Payload lief das Skelett endlos weiter,
           weil der Aufruf zwar ankam, aber keinen einzigen Schluessel trug, an dem eine
           Komponente den Ladezustand haette beenden koennen.

           Leer und kaputt sind zwei Dinge (§46): ein WIRKLICH leerer Text bleibt {} und
           verhaelt sich wie bisher, alles andere traegt ab jetzt den Vermerk.

           Die instanceId wird aus dem ROHTEXT gefischt, nicht aus dem Ergebnis -- das gibt es
           ja nicht. Ohne sie faellt doRender auf die erste Wurzel der Seite zurueck, und auf
           einer Seite mit zwei Platzierungen meldete die falsche den Fehler. */
        params = {};
        if (String(roh).trim()){
          params.__parseError = true;
          var mId = String(roh).match(/"instance_?[Ii]d"\s*:\s*"([^"]{1,120})"/);
          if (mId) params.instanceId = mId[1];
        }
      }
    }
    if (!params || typeof params !== "object") return params;
    /* rows and brands are the two list fields that carry free text from the server, so they are
       the two that can arrive damaged. Everything else in a render payload is an id or a number. */
    var LISTS = ["rows", "brands"], needs = false, i;
    for (i = 0; i < LISTS.length; i++) if (typeof params[LISTS[i]] === "string") needs = true;
    if (!needs) return params;
    var out = {}, k;
    for (k in params) if (Object.prototype.hasOwnProperty.call(params, k)) out[k] = params[k];
    for (i = 0; i < LISTS.length; i++){
      var key = LISTS[i];
      if (typeof out[key] !== "string") continue;
      var v = parseLoose(out[key], (label || "upstreem") + " " + key);
      /* Scheitert das Parsen, wurde daraus bisher schlicht [] -- und damit sah ein zerrissener
         Payload fuer JEDE Komponente exakt aus wie ein leeres Ergebnis. parseLoose warnt zwar in
         der Konsole, aber die Komponente bekommt nur die leere Liste zu sehen und meldet
         zufrieden "keine Daten". Das leere Array bleibt (sonst muesste jeder Aufrufer mit null
         rechnen), aber ab jetzt liegt ein Vermerk daneben: wer __parseError prueft, kann
         "kaputt" von "leer" unterscheiden. Rein additiv -- wer es nicht prueft, verhaelt sich
         Zeile fuer Zeile wie vorher. */
      if (v == null && String(out[key]).trim()) out.__parseError = true;
      out[key] = isArr(v) ? v : (v ? [v] : []);
    }
    return out;
  }
  function isArr(v){ return Object.prototype.toString.call(v) === "[object Array]"; }

  /* Wraps every occurrence of the active query in <mark>. Escapes FIRST, then inserts the
     markup — doing it the other way round would let a crafted domain inject HTML. */
  function highlight(text, q){
    var safe = esc(text);
    q = String(q == null ? "" : q).trim();
    if (!q) return safe;
    var needle = esc(q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    try { return safe.replace(new RegExp("(" + needle + ")", "ig"), '<mark class="up-hl">$1</mark>'); }
    catch(e){ return safe; }
  }
  /* ---------- Reddit URL → readable title ----------
     RPC-supplied titles for Reddit results are usually just the scraped page <title>, which for
     Reddit is almost always the literal string "reddit.com" — useless as a row label. The comment
     ID in the URL's own path is more informative than that: r/<subreddit> always exists, and the
     slug segment right after the ID (when Reddit's own link included one — it doesn't always,
     e.g. a bare .../comments/1k1eu6a with no trailing words) is the post's own title with spaces
     swapped for underscores and non-ASCII percent-encoded. Old/new/mobile/no-participation
     subdomains (old./m./np.) all share this same path shape. A REAL scraped title (anything other
     than the bare domain) always wins over this — parsing is only the fallback for the common
     "reddit.com" case. */
  var REDDIT_URL_RE = /^https?:\/\/(?:[a-z0-9-]+\.)?reddit\.com\/r\/([A-Za-z0-9_]+)\/comments\/[a-z0-9]+(?:\/([^\/?#]+))?/i;
  function parseRedditUrl(url){
    var m = REDDIT_URL_RE.exec(String(url == null ? "" : url));
    if (!m) return null;
    var slug = null;
    if (m[2]){
      var raw = m[2];
      try { raw = decodeURIComponent(raw); } catch(e){}
      raw = raw.replace(/_/g, " ").trim();
      if (raw) slug = raw.charAt(0).toUpperCase() + raw.slice(1);
    }
    return { sub: m[1], slug: slug };
  }
  /* "No real title" means empty, or exactly the URL's own hostname — the scraped-<title> sentinel
     Reddit produces for the vast majority of links (also covers a title that's literally the raw
     URL, which some callers already fall back to when the RPC sends nothing at all). */
  function isGenericUrlTitle(title, url){
    var t = String(title == null ? "" : title).trim().toLowerCase();
    if (!t || t === String(url == null ? "" : url).trim().toLowerCase()) return true;
    try { return t === new URL(String(url)).hostname.replace(/^www\./, "").toLowerCase(); }
    catch(e){ return false; }
  }
  /* Returns HTML (r/sub, then a muted "/", then the parsed slug when Reddit's own link had one)
     or null when this isn't a Reddit URL / a real title already exists — null means "render your
     normal title the usual way", not "render nothing". `q` is the caller's active search query,
     highlighted exactly like every other title cell so a Reddit result found via search still
     shows its match. */
  function redditTitleHtml(url, title, q){
    if (!isGenericUrlTitle(title, url)) return null;
    var parsed = parseRedditUrl(url);
    if (!parsed) return null;
    var out = '<span class="up-reddit-sub">' + highlight("r/" + parsed.sub, q) + '</span>';
    if (parsed.slug){
      out += ' <span class="up-reddit-sep">/</span> ' + highlight(parsed.slug, q);
    }
    return out;
  }
  /* ---------- readBubble ----------
     parseBubbleJson mit drei Ergaenzungen, die jeder Konsument sonst selbst schreibt -- und die
     onboarding-page bereits einmal selbst geschrieben hatte:

     1. Ein Objekt geht unveraendert durch. parseBubbleJson liest TEXT; ein Objekt wuerde es zu
        "[object Object]" verstringen.
     2. Doppelt verpackt: ein Run-JS-Schritt, der JSON.stringify UM einen Payload legt, der schon
        Text ist. parseBubbleJson liest das als leere Liste -- gemessen: array:0, Payload still
        weg. Einmal auspacken, nur bei genau diesem Muster.
     3. Leer und unlesbar sind zwei Dinge (§46). parseBubbleJson gibt fuer beides []. Eine WIRKLICH
        leere Lieferung ist am leeren Klammerpaar zu erkennen; alles andere, das nichts ergibt,
        ist ein Lesefehler und kommt als null zurueck, damit der Aufrufer ihn ins UI schreiben
        kann statt eine leere Liste zu zeigen.

     Rueckgabe: Array oder Objekt, oder null wenn nichts zu lesen war. */
  function readBubble(raw){
    if (raw && typeof raw === "object") return raw;
    var t = String(raw == null ? "" : raw).trim();
    if (!t) return null;
    if (t.charAt(0) === '"' && t.charAt(t.length - 1) === '"' && t.indexOf('\\"') >= 0){
      try {
        var innen = JSON.parse(t);
        if (typeof innen === "string" && /^\s*[\[{]/.test(innen)) t = innen.trim();
      } catch(e){}
    }
    var a = null;
    try { a = parseBubbleJson(t); } catch(e){}
    if (!Array.isArray(a)){ try { var q = JSON.parse(t); if (q && typeof q === "object") a = q; } catch(e){ a = null; } }
    if (Array.isArray(a) && !a.length && !/^\[\s*\]$/.test(t)) return null;
    return a;
  }

  /* ---------- parseBubbleJson ----------
     Bubble's ":formatted as text" output is JSON-SHAPED but not valid JSON: several field types
     come through unquoted — booleans as the bare words yes/no ("yes is not defined") and emoji as
     a bare glyph ("emoji": 💎 -> "Invalid or unexpected token"). This walks the text once,
     tracking whether it is inside a quoted string, and quotes every bare value found outside one.

     Deliberately a scanner and not a regex: a timestamp like "May 9, 2026 12:23 pm" contains BOTH
     a comma and a colon inside its own quotes, and a regex has no way to know it must keep its
     hands off. An earlier regex version broke exactly that case.

     Lives in core because more than one caller needs it — every Run-JS step that feeds a
     component the raw RPC text. Two copies of this is how the emoji bug survived a round of
     fixes: only one of them got repaired. */
  function parseBubbleJson(raw){
    var src = String(raw == null ? "" : raw).trim();
    if (!src) return [];
    /* Ist der Text bereits GUELTIGES JSON, wird er nicht repariert. Jede Reparatur unten ist fuer
       kaputte Eingaben gebaut, und auf einer heilen richtet sie Schaden an: ein Feld, das selbst
       JSON enthaelt -- markdown_summary traegt {"summary": "..."} als Text --, endet auf \" vor
       der schliessenden Klammer, und die Truncation-Regel haelt genau das fuer ein abgeschnittenes
       Feld und wirft den Backslash weg. Gemessen am 23.08.: der url-detail-Payload kam als
       array:0 an, obwohl JSON.parse ihn anstandslos liest.
       Die Regeln gelten also nur noch dort, wo sie gebraucht werden -- bei Text, den kein
       JSON-Erzeuger geschrieben hat. */
    try {
      var heil = JSON.parse(src);
      if (Array.isArray(heil)) return heil;
      if (heil && typeof heil === "object") return [heil];
    } catch(e){}
    if (src.charAt(0) === "{") src = "[" + src + "]";
    var out = "", i = 0, n = src.length, inStr = false, esc2 = false, ch, c, start, v;
    /* Schluessel oder Wert -- und das entscheidet, was einen String beenden kann.
       Nach einem SCHLUESSEL kommt ein Doppelpunkt, nach einem WERT ein Komma, eine schliessende
       Klammer oder das Ende. Frueher stand der Doppelpunkt fuer beide in der Liste, und genau
       daran ist ein realer Payload zerbrochen: eine Beschreibung enthielt den Text
         ... — title: "LeeUP Media GmbH ..." meta: "og:title": "LeeUP Me...
       Das Anfuehrungszeichen hinter og:title steht MITTEN in einem Wert, und weil ein Doppelpunkt
       folgte, galt es als Ende des Wertes. Danach war jede Klammer verschoben --
       "Unexpected token ':'", die Seite blieb leer.
       Der Stapel unten merkt sich nur, ob wir in einem Objekt oder in einer Liste stehen: nach
       einem Komma folgt im Objekt ein Schluessel, in der Liste ein Wert. */
    var stapel = [], letztes = "", istWert = false;
    function terminates(from, wert){
      var p = from;
      while (p < n && /\s/.test(src.charAt(p))) p++;
      var a = p < n ? src.charAt(p) : "";
      if (a === "" || a === "," || a === "}" || a === "]") return true;
      /* Ein Doppelpunkt beendet nur einen SCHLUESSEL. In einem Wert gehoert er zum Text. */
      return a === ":" && !wert;
    }
    /* Raw control characters are fine in Bubble's output but ILLEGAL inside a JS string literal.
       An LLM answer in response_preview contains line breaks as a matter of course, and copying
       one through produced an unterminated literal — "Invalid or unexpected token", the whole
       payload lost. U+2028/U+2029 break a literal the same way even though they are not
       <0x20 — written as escapes below on purpose, since a literal one in THIS file would
       be a line terminator in core.js itself. */
    function escCtrl(c2){
      if (c2 === "\n") return "\\n";
      if (c2 === "\r") return "\\r";
      if (c2 === "\t") return "\\t";
      var h = c2.charCodeAt(0).toString(16);
      return "\\u" + "0000".slice(h.length) + h;
    }
    function isCtrl(c2){ return c2 < " " || c2 === "\u2028" || c2 === "\u2029"; }
    while (i < n){
      ch = src.charAt(i);
      if (inStr){
        if (esc2){ out += ch; esc2 = false; i++; continue; }
        if (ch === "\\"){
          /* Bubble truncates long text fields at a fixed length. When the cut lands on a
             backslash the result is `…text\"` — that stray backslash escapes the closing quote
             and swallows the rest of the payload. A backslash sitting directly before what is
             unambiguously a terminating quote is that truncation artefact, never a real escape. */
          if (src.charAt(i + 1) === '"' && terminates(i + 2, istWert)){ i++; continue; }
          out += ch; esc2 = true; i++; continue;
        }
        if (ch === '"'){
          /* Bubble's text fields (titles, descriptions) sometimes carry a literal, un-escaped
             quote of their own — e.g. a description containing von "Meine Top 3" geht. Blindly
             toggling inStr off at THAT quote corrupts every field after it. */
          out += ch;
          if (terminates(i + 1, istWert)){ inStr = false; letztes = '"'; }
          else out = out.slice(0, -1) + '\\"';
          i++; continue;
        }
        out += (isCtrl(ch) ? escCtrl(ch) : ch);
        i++; continue;
      }
      if (ch === '"'){
        /* Ein String, der auf einen Doppelpunkt folgt, ist ein WERT; einer direkt in einer Liste
           auch. Alles andere ist ein Schluessel. */
        istWert = (letztes === ":") || (stapel[stapel.length - 1] === "arr");
        inStr = true; out += ch; i++; continue;
      }
      if (ch === "{"){ stapel.push("obj"); letztes = ch; out += ch; i++; continue; }
      if (ch === "["){ stapel.push("arr"); letztes = ch; out += ch; i++; continue; }
      if (ch === "}" || ch === "]"){ stapel.pop(); letztes = ch; out += ch; i++; continue; }
      if (ch !== ":"){ if (!/\s/.test(ch)) letztes = ch; out += ch; i++; continue; }
      letztes = ":";

      out += ch; i++;                                     // the colon itself
      while (i < n && /\s/.test(src.charAt(i))){ out += src.charAt(i); i++; }
      if (i >= n) break;
      c = src.charAt(i);
      if (c === '"' || c === "[" || c === "{") continue;   // already quoted or structured

      start = i;
      while (i < n && src.charAt(i) !== "," && src.charAt(i) !== "}" && src.charAt(i) !== "]") i++;
      v = src.slice(start, i).replace(/^\s+|\s+$/g, "");
      if (v === ""){ out += "null"; continue; }
      if (v === "true" || v === "false" || v === "null"){ out += v; continue; }
      if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(v)){ out += v; continue; }
      if (/^yes$/i.test(v)){ out += "true"; continue; }
      if (/^no$/i.test(v)){ out += "false"; continue; }
      out += '"' + v.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
    }
    out = out.replace(/,\s*([}\]])/g, "$1");              // trailing comma before a closer
    var parsed;
    try { parsed = eval("(" + out + ")"); }
    catch(e){
      if (window.console) console.warn("[UpstreemCore] parseBubbleJson failed:", e.message, raw);
      return [];
    }
    if (typeof parsed === "string"){                      // Bubble sometimes double-encodes
      try { return parseBubbleJson(parsed); } catch(e2){ return []; }
    }
    if (parsed && !Array.isArray(parsed) && typeof parsed === "object") return [parsed];
    /* An empty item in a Bubble list emits `,,`, which eval turns into an ARRAY HOLE — the entry
       reads back as undefined and every consumer here does `row.something` on it. Callers all
       expect a list of records, so a hole is never meaningful data; drop it rather than hand out
       a list that blows up on the first property access. */
    return Array.isArray(parsed) ? parsed.filter(function(x){ return x != null; }) : [];
  }

  function esc(s){
    return String(s == null ? "" : s).replace(/[&<>"]/g, function(c){
      return { "&":"&amp;", "<":"&lt;", ">":"&gt;", "\"":"&quot;" }[c];
    });
  }
  function citeName(raw){
    if (!raw) return "";
    var s = String(raw).trim();
    if (CITE_ALIAS[s]) return CITE_ALIAS[s];
    if (/^Brand\s+Platforms?$/i.test(s)) return "Brand Platforms";
    if (/^Knowledge[-\s_]?Base$/i.test(s)) return "Knowledge-Base";
    if (/^UGC(\s*[\/_]?\s*Community)?$/i.test(s)) return "UGC / Community";
    return s;
  }
  function tint(hex, a){
    var h = String(hex).replace("#","");
    if (h.length === 3) h = h.split("").map(function(x){ return x + x; }).join("");
    var n = parseInt(h, 16);
    return "rgba(" + ((n>>16)&255) + "," + ((n>>8)&255) + "," + (n&255) + "," + a + ")";
  }
  /* Blends a hex colour toward white by `amt` (0-1) — the doughnut's hover state (see
     makeTypeChart's hoverBackgroundColor). Bars get the visually equivalent effect via a CSS
     `filter: brightness()` on their own fill instead (their colour is an inline style, not a
     canvas fill core can intercept), so the two chart types read as the same hover language
     without sharing implementation. */
  function brighten(hex, amt){
    var h = String(hex).replace("#","");
    if (h.length === 3) h = h.split("").map(function(x){ return x + x; }).join("");
    var n = parseInt(h, 16);
    var r = (n>>16)&255, g = (n>>8)&255, b = n&255;
    r = Math.round(r + (255-r)*amt); g = Math.round(g + (255-g)*amt); b = Math.round(b + (255-b)*amt);
    return "rgb(" + r + "," + g + "," + b + ")";
  }
  /* Same idea as brighten(), toward black instead — the DIM/grey slices' own hover state (see
     makeTypeChart). A dim slice's colour is already a light neutral grey; blending IT toward
     white on hover made the hovered slice read as nearly-white instead of "a bit darker than
     resting", which is what a hover on an already-muted element should look like. */
  function darken(hex, amt){
    var h = String(hex).replace("#","");
    if (h.length === 3) h = h.split("").map(function(x){ return x + x; }).join("");
    var n = parseInt(h, 16);
    var r = (n>>16)&255, g = (n>>8)&255, b = n&255;
    r = Math.round(r * (1-amt)); g = Math.round(g * (1-amt)); b = Math.round(b * (1-amt));
    return "rgb(" + r + "," + g + "," + b + ")";
  }
  /* Number(null) is 0 and Number("") is 0 — both would otherwise sail through as valid numbers
     here, turning "no value" into a fake zero everywhere toNum feeds fmt1/fmtInt (found via a
     null avg_rank rendering "0.0" instead of "–" in prompts-table; the same bug was latent
     wherever else a nullable numeric field went through this path). */
  function toNum(v){
    if (v == null || v === "") return null;
    var n = Number(v);
    return isFinite(n) ? n : null;
  }
  function fmt1(v){ var n = toNum(v); return n == null ? "–" : (Math.round(n * 10) / 10).toFixed(1); }
  /* Ganze Zahlen MIT Tausendertrennung nach der Einstellung des Nutzers -- 12.345 statt 12345.
     Vorher stand hier String(Math.round(n)) ohne jede Trennung; bei vierstelligen Mention Counts
     ist das der Unterschied zwischen einer Zahl und einer Ziffernfolge. */
  function fmtInt(v){ var n = toNum(v); return n == null ? "–" : fmtNum(Math.round(n), 0); }
  /* App-wide date format: "24. Jul 2026". Parses the RPC's ISO timestamps; anything
     unparseable renders as an em dash rather than "Invalid Date". */
  /* Das Datumsformat des Nutzers. Die VORGABE ist der heutige Stand ("12. Dec 2025"), die drei
     anderen sind die Schreibweisen, nach denen in einer solchen App wirklich gefragt wird:
     amerikanisch, deutsch-numerisch und ISO. Mehr nicht -- jede weitere Variante ist eine Zeile
     hier und eine Zeile im Fenster, aber auch ein Format mehr, das in Tabellen unterschiedlich
     breit ist.
     EIN Ort fuer alle vier, damit Tabellen, Charts und Tooltips nicht auseinanderlaufen. */
  function datumsTeile(v){
    if (v == null || v === "") return null;
    var d = new Date(String(v));
    if (isNaN(d.getTime())) return null;
    function z(n){ return String(n).padStart(2, "0"); }
    return { t: d.getDate(), tt: z(d.getDate()), m: d.getMonth(), mm: z(d.getMonth() + 1),
             j: d.getFullYear(), mon: MONTHS[d.getMonth()] };
  }
  function fmtDateMuster(p, muster){
    if (!p) return "–";
    switch (muster){
      case "mon-d-y": return p.mon + " " + p.t + ", " + p.j;
      /* Punkt und keine Schraegstriche: die deutsche Schreibweise ist 12.12.2025. */
      case "d-m-y":   return p.tt + "." + p.mm + "." + p.j;
      case "iso":     return p.j + "-" + p.mm + "-" + p.tt;
      default:        return p.tt + ". " + p.mon + " " + p.j;
    }
  }
  function fmtDate(v){ return fmtDateMuster(datumsTeile(v), getPref("date")); }
  function foldDiacritics(s){
    var t = String(s == null ? "" : s);
    try { t = t.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); } catch(e){}
    return t.replace(/ß/g, "ss").toLowerCase();
  }
  function germanExpand(s){
    return String(s == null ? "" : s)
      .replace(/Ä/g,"Ae").replace(/Ö/g,"Oe").replace(/Ü/g,"Ue")
      .replace(/ä/g,"ae").replace(/ö/g,"oe").replace(/ü/g,"ue").replace(/ß/g,"ss")
      .toLowerCase();
  }
  /* Once a bubble_fn_* is actually found, its window/property reference stays valid for the rest
     of the page's life (Bubble never relocates an already-defined workflow function) — caching it
     turns every fire() AFTER THE FIRST for that name into a plain property read instead of
     re-walking window/parent/top and then, on a miss, a full BFS over every iframe on the page.
     That BFS is the one genuinely slow path here: a page with several embedded components/iframes
     re-walks all of them on EVERY click if the direct window/parent/top check doesn't hit — which
     is exactly what made a row click (fired constantly, expected to feel instant) noticeably
     laggy despite there being no actual delay/debounce anywhere in the click handling itself. */
  var __resolvedFnCache = {};
  /* The cache used to be authoritative: resolve once, return that same function forever. That is
     wrong for Bubble, and it is the reason events "stopped arriving" after a while and why a
     workflow could die with "Cannot read properties of null (reading 'element')".

     A JavaScript-to-Bubble element publishes its function when it renders -- and Bubble DESTROYS
     and re-renders elements constantly. The old function object survives as a closure over an
     element that no longer exists; calling it reaches into a null element inside Bubble's own
     workflow engine. From the outside it looks like the event was swallowed, and it never recovers,
     because the cache kept handing back the same corpse.

     So: a direct lookup ALWAYS wins, and the cache is only consulted when the name is not visible
     directly -- and dropped as soon as it disagrees with what is live. The expensive part was never
     the property read, it was the iframe walk below; that is still cached. */
  function resolveBubbleFn(fnName){
    var live = window[fnName] || (window.parent && window.parent[fnName]) || (window.top && window.top[fnName]);
    if (typeof live === "function"){
      if (__resolvedFnCache[fnName] !== live) __resolvedFnCache[fnName] = live;
      return live;
    }
    var cached = __resolvedFnCache[fnName];
    if (typeof cached === "function"){
      /* Still reachable from the window it was found on? If its home frame is gone the reference
         is a corpse -- drop it and fall through to a fresh walk rather than calling into it. */
      try {
        var home = cached.__upHome;
        if (home && home.closed) { delete __resolvedFnCache[fnName]; }
        else return cached;
      } catch(e){ delete __resolvedFnCache[fnName]; }
    }
    var start; try { start = window.top || window.parent || window; } catch(e){ start = window; }
    var queue = [start], seen = [];
    while (queue.length){
      var win = queue.shift();
      if (seen.indexOf(win) !== -1) continue;
      seen.push(win);
      try {
        if (typeof win[fnName] === "function"){
          try { win[fnName].__upHome = win; } catch(e2){}
          __resolvedFnCache[fnName] = win[fnName];
          return win[fnName];
        }
      } catch(e){}
      var frames; try { frames = win.document.querySelectorAll("iframe"); } catch(e){ continue; }
      for (var i = 0; i < frames.length; i++){
        var cw; try { cw = frames[i].contentWindow; } catch(e){ cw = null; }
        if (cw && seen.indexOf(cw) === -1) queue.push(cw);
      }
    }
    return null;
  }

  var TREND_UP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7h10v10" /> <path d="M7 17 17 7" /></svg>';
  var TREND_DOWN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m7 7 10 10" /> <path d="M17 7v10H7" /></svg>';
  var CHECK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg>';
  /* Der Haken der Farbschema-Zeilen. Stand in der Huelle des Chart-Zahnrads -- dort konnte
     colorScaleOptionsHtml() ihn nicht sehen, und der Aufruf aus dem Einstellungsfenster lief in
     einen ReferenceError: das Menue kam leer heraus. Gemessen als "0 Zeilen, 18px hoch". */
  var SCALE_CHECK = CHECK_SVG.replace('<svg ', '<svg class="up-check" ');
  var COPY_SVG = '<svg class="up-ic-copy" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2" /> <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></svg>';
  var GOTO_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7h10v10" /> <path d="M7 17 17 7" /></svg>';
  var HASH_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" x2="20" y1="9" y2="9" /> <line x1="4" x2="20" y1="15" y2="15" /> <line x1="10" x2="8" y1="3" y2="21" /> <line x1="16" x2="14" y1="3" y2="21" /></svg>';

  /* Column-header explainer copy (the popover UC.makeExplain opens from a .up-th-info icon) — ONE
     canonical sentence per metric, shared by every table that has that column. This used to be
     five independently-worded EXPLAIN_TEXT objects (urls-table/domains-table/prompts-table/
     visibility-chart/responses-table) for the exact same concepts — Sentiment, Rank, Brand
     Mentions, Share all read differently table to table, which is what every "the tooltips don't
     match" report has actually been about. {tokens} fill in the handful of words that genuinely
     differ per caller (what to call the row, whether a trend clause applies) via explainCopy();
     the sentence structure and the concept it explains stay identical everywhere. */
  var EXPLAIN_TEXT = {
    sentiment:  { h: "Sentiment", t: "How positively the brand is described when it's mentioned{scope}{trend}." },
    rank:       { h: "Rank", t: "The brand's average position among all brands mentioned{scope}{trend}. A lower number is better." },
    visibility: { h: "Visibility", t: "How often the brand appears in AI answers{scope}{trend}." },
    brands:     { h: "Brand Mentions", t: "Which of your tracked brands are mentioned{scope}. Hover a logo to see its name." },
    share:      { h: "Share", t: "How much of all citations in the period went to this {subject}, plus the change against the previous period." },
    /* Die Zeile "Brand Colors" in der Farbauswahl. Sie steht hier und nicht im Einstellungsfenster,
       weil die Auswahl aus core kommt (colorScaleOptionsHtml) und der Erklaerkasten derselbe ist,
       den die Spaltenkoepfe benutzen -- eine Quelle fuer beide. */
    brandcolors: { h: "Brand Colors",
                   t: "Every brand is drawn in its own color instead of a fixed palette. You set that color per brand in Settings under Your Brand, in the Brand Color section. Brands without one fall back to a neutral color." }
  };
  function explainCopy(key, vars){
    var e = EXPLAIN_TEXT[key];
    if (!e) return null;
    /* Uebersetzt wird der SATZ ALS GANZES, mit seinen Platzhaltern drin, und erst danach werden
       sie gefuellt. Andersherum waere der fertige Satz kein Katalogschluessel mehr -- und die
       Reihenfolge im Deutschen ist ohnehin eine andere, das gibt nur ein Satzmuster her.
       Die eingesetzten Stuecke ({scope}, {trend}, {subject}) kommen aus den Komponenten und gehen
       ebenfalls durch t_: sie sind eigene Katalogeintraege. */
    var muster = t_(e.t);
    var txt = muster.replace(/\{(\w+)\}/g, function(_, k){
      var v = (vars && vars[k] != null) ? vars[k] : "";
      return v ? t_(v) : "";
    });
    return { h: t_(e.h), t: txt };
  }

  /* "<brand> mentioned?" cell — one implementation for every table that has the column. Both
     urls-table and responses-table carried their own byte-identical copy; keeping two is exactly
     how they drift. Renders a filled colour badge with a knocked-out glyph plus a neutral label
     (see .up-ment-cell in core.css). */
  /* y 6.5→17.5 rather than feather's 6→17: the stock check's ink sits 0.5 units above the
     viewBox centre, which reads as "the tick is too high in its badge" once the badge is a
     filled square around it. */
  var MENT_YES_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
  var MENT_NO_SVG  = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18" /> <path d="m6 6 12 12" /></svg>';
  function mentCell(v){
    var yes = isYes(v);
    return '<span class="up-ment-cell ' + (yes ? "is-yes" : "is-no") + '">' +
             '<span class="up-ment-badge">' + (yes ? MENT_YES_SVG : MENT_NO_SVG) + '</span>' +
             esc(t_(yes ? "Yes" : "No")) +
           '</span>';
  }
  var DONE_SVG = '<svg class="up-ic-done" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg>';
  var EXT_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6" /> <path d="M10 14 21 3" /> <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></svg>';

  /* ==========================================================================================
     RESPONSE PRIMITIVES -- geteilt zwischen responses-table, prompts-table und response-detail
     ==========================================================================================
     Diese drei lagen als Kopie in je einer Komponente. Sie stehen hier, weil die Detailseite
     dieselbe Zeitangabe, denselben Modell-Chip und denselben Market-Chip zeigen muss wie die
     Tabelle, aus der man sie aufruft -- zwei Fassungen davon waeren zwei Wahrheiten. */

  /* "2 minutes ago" fuer Frisches, ab einem Tag das Datum. Aus responses-table uebernommen,
     Wortlaut unveraendert. */
  function relativeTime(iso){
    var d = iso ? new Date(iso) : null;
    if (!d || isNaN(d.getTime())) return "";
    var diffMs = Date.now() - d.getTime();
    if (diffMs < 0) diffMs = 0;
    var mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return mins + (mins === 1 ? " minute ago" : " minutes ago");
    var hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + (hrs === 1 ? " hour ago" : " hours ago");
    return fmtDate(iso);
  }

  /* Modell-Chip: Logo plus Anzeigename, beides aus dem seitenweiten Modell-Store (setModels).
     "Google AI Overviews" ist breiter als eine Tabellenspalte, deshalb die Kurzform -- der volle
     Name bleibt als Tooltip. cfg.full erzwingt den langen Namen (Detailseiten haben den Platz). */
  var MODEL_SHORT = { "google-aio": "Google AIO" };
  /* getModels() liefert eine LISTE, und jeder Eintrag traegt seinen Schluessel als `key` --
     nicht ein Objekt nach Schluessel. Verglichen wird nachsichtig, weil Bubble denselben Wert
     je Quelle mal mit Bindestrich und mal mit Unterstrich schreibt (google-aio / google_aio). */
  function modelKeyGleich(a, b){
    if (a == null || b == null) return false;
    return String(a).toLowerCase().replace(/[_\s]+/g, "-") ===
           String(b).toLowerCase().replace(/[_\s]+/g, "-");
  }
  function modelInfoOf(key){
    var list = getModels ? getModels() : null;
    if (!list || !key || !isArray(list)) return null;
    for (var i = 0; i < list.length; i++){
      var m = list[i];
      if (m && (modelKeyGleich(m.key, key) || modelKeyGleich(m.model, key))) return m;
    }
    return null;
  }
  function modelLabelOf(m, key, lang){
    if (lang) return String(lang);
    if (m && m.short_name) return String(m.short_name);
    if (MODEL_SHORT[key]) return MODEL_SHORT[key];
    return m ? String(m.display_name || key) : String(key || "");
  }
  function modelChip(key, cfg){
    cfg = cfg || {};
    var m = modelInfoOf(key);
    var full = m ? String(m.display_name || key) : String(key || "");
    var name = cfg.full ? full : modelLabelOf(m, key, null);
    var logo = m && m.logo_url ? String(m.logo_url) : "";
    if (logo.indexOf("//") === 0) logo = "https:" + logo;
    var initial = (name.charAt(0) || "?");
    return '<span class="up-model-chip' + (cfg.cls ? " " + cfg.cls : "") + '"' +
             (full !== name ? ' data-tip="' + esc(full) + '"' : "") + '>' +
             '<span class="up-ment-logo' + (logo ? " has-img" : "") + '">' +
               '<span class="up-model-ltr">' + esc(initial) + '</span>' +
               (logo ? '<img src="' + esc(logo) + '" alt="" loading="lazy" referrerpolicy="no-referrer"' +
                       ' onerror="this.parentNode.classList.remove(\'has-img\'); this.remove()"/>' : "") +
             '</span>' +
             '<span class="up-ment-name">' + esc(name) + '</span>' +
           '</span>';
  }

  /* Market-Chip: Flagge als liegende Kachel plus Laendercode. Rund wuerde jede Flagge auf ihre
     Mitte beschneiden, und genau da tragen DE, FR und IT nichts Unterscheidbares. */
  /* Das Markup des Marken-Schalters. Dreistufig: aus, ja, nein -- dieselbe Reihenfolge wie in
     urls-table, damit ein Klick ueberall dasselbe bedeutet. Der Haken und das Kreuz liegen beide
     im Kaestchen, die Klasse entscheidet, welches sichtbar ist. */
  function brandToggleHtml(cfg){
    cfg = cfg || {};
    var name = String(cfg.name || "").trim();
    var logo = String(cfg.logo || "").trim();
    /* Aufbau wie im Vorbild (urls_table_bubble.html): Logo und Beschriftung links im -lbl, das
       Kaestchen DANACH als Geschwister -- justify-content: space-between schiebt es nach rechts.
       Vorher stand es als erstes Kind IM Label, also ganz links.
       Und die Zustandsklassen sitzen AM SVG, nicht an einem Span darum: die Regel
       ".up-brandcheck svg { display: none }" versteckt jedes svg im Kaestchen, ein display:block
       am Wrapper kommt dagegen nicht an -- der Haken blieb unsichtbar. */
    var svgJa = CHECK_SVG.replace("<svg ", '<svg class="up-brandcheck-yes" ');
    /* Minus statt Kreuz fuer "nicht erwaehnt" -- dasselbe Zeichen wie im Vorbild. */
    var svgNein = '<svg class="up-brandcheck-no" viewBox="0 0 24 24" fill="none" stroke="currentColor"' +
                  ' stroke-width="3" stroke-linecap="round" stroke-linejoin="round">' +
                  '<path d="M5 12h14" /></svg>';
    return '<button type="button" class="up-brandtoggle' + (cfg.cls ? " " + cfg.cls : "") + '"' +
             ' aria-label="' + esc(name ? name + " mentioned" : "Own brand mentioned") + '">' +
             '<span class="up-brandtoggle-lbl">' +
               (logo ? '<img class="up-brandlogo" src="' + esc(logo) + '" alt="" loading="lazy"' +
                       ' referrerpolicy="no-referrer" onerror="this.remove()"/>' : "") +
               '<span class="up-brandlabel">' + esc(name || "Own brand") + " mentioned?</span>" +
             "</span>" +
             '<span class="up-brandcheck">' + svgJa + svgNein + "</span>" +
           "</button>";
  }

  function marketChip(code, cfg){
    cfg = cfg || {};
    var c = String(code == null ? "" : code).trim().toUpperCase();
    if (!c) return "";
    var all = getAllMarkets ? getAllMarkets() : null;
    var rec = all && (all[c] || all[c.toLowerCase()]);
    var flag = rec && (rec.flag_url || rec.flag) ? String(rec.flag_url || rec.flag) : "";
    if (!flag) flag = "https://flagcdn.com/w40/" + c.toLowerCase() + ".png";
    return '<span class="up-market' + (cfg.cls ? " " + cfg.cls : "") + '">' +
             '<span class="up-flag"><img src="' + esc(flag) + '" alt="" loading="lazy"' +
               ' referrerpolicy="no-referrer" onerror="this.remove()"/></span>' +
             '<span class="up-market-code">' + esc(c) + '</span>' +
           '</span>';
  }

  /* ==========================================================================================
     RESPONSE BODY -- der Text einer Modellantwort als HTML
     ==========================================================================================
     Ersetzt die drei zenith-Elemente (chatgpt / google-aio / perplexity), die als eigenstaendige
     Bubble-HTML-Bloecke lebten. Ein Parser fuer alle drei, weil die Unterschiede genau drei
     Zitatschreibweisen sind und sonst nichts:

       google-aio    [0](url) im Text, am Ende eine Fussnotenliste [[0] - Titel](url)
                     dazu SearchAPI-Muell der Form 0;2a1;0;582; mitten im Wort
       chatgpt       [Label](url) im Text, Markdown-Tabellen
       perplexity    [(url)] -- die Klammerform

     Was aus den alten Elementen NICHT uebernommen wurde und warum:
     - Die 12 Normalisierungsregeln (A bis L) fuer einzeilige Eingaben. Sie rieten anhand von
       Bindestrichketten und Sternchen, wo Absaetze sein muessten, und zerlegten dabei auch
       gueltigen Text. Die Beispieldaten aller drei Modelle tragen echte Zeilenumbrueche.
     - Der gestrichelte Rahmen als eingebettetes SVG samt ResizeObserver und MutationObserver.
       Er existierte nur, weil ein CSS-Rahmen am umbrechenden Inline-Element abgeschnitten wurde;
       ein Chip, der nicht umbricht, braucht das nicht.
     - Die ueber 40 !important-Regeln. Sie kaempften gegen Bubbles Vorfahren; eine Komponente
       mit eigenem Praefix hat den Kampf nicht.

     cfg: { text, citations, companies, model, onCite, onBrand }
     Rueckgabe: HTML-Text. Die Klicks haengt die Komponente an -- hier entstehen nur die Haken
     (data-urd-cite, data-urd-brand). */

  /* SearchAPI schiebt Laufmarken der Form 0;2a1;0;582; mitten in den Text, teils in ein Wort
     hinein. Ohne das steht im Absatz "Anbieter0;5cf;fuer". */
  function rbStripRunTokens(t){
    return String(t == null ? "" : t)
      .replace(/0;[0-9a-f]{1,6};0;[0-9a-f]{1,6};/gi, "")
      .replace(/0;[0-9a-f]{1,6};/gi, "")
      /* unsichtbare Zeichen erzeugen Umbrueche an Stellen, an denen keine sind */
      .replace(/[ ­​-‍⁠﻿]/g, " ")
      .replace(/[ \t]+\n/g, "\n").replace(/\n[ \t]+/g, "\n")
      .replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  }

  /* Die Fussnotenliste am Ende von google-aio wiederholt nur, was der Abschnitt "Citations"
     darunter schon als Karten zeigt. Zwei Listen derselben Quellen auf einer Seite. */
  function rbStripFooter(t){
    return String(t == null ? "" : t).replace(/\n\s*\[\[\d+\][\s\S]*$/m, "").trim();
  }

  function rbCleanUrl(url){
    try {
      var u = new URL(String(url).trim());
      u.hash = "";
      var drop = { gclid:1, fbclid:1, ref:1, igshid:1, mc_cid:1, mc_eid:1 };
      Object.keys(drop).forEach(function (k) { u.searchParams.delete(k); });
      Array.prototype.slice.call(u.searchParams.keys()).forEach(function (k) {
        if (k.toLowerCase().indexOf("utm_") === 0) u.searchParams.delete(k);
      });
      return u.toString();
    } catch (e) {
      return String(url || "").replace(/[?&]utm_[^=]+=[^&#]*/gi, "").replace(/#.*$/, "");
    }
  }
  /* Anzeigeform einer URL: Host ohne www plus Pfad, ohne Schraegstrich am Ende. */
  function rbShowUrl(url){
    try {
      var u = new URL(url);
      var out = u.hostname.replace(/^www\./i, "") + u.pathname;
      return out.length > 1 && out.charAt(out.length - 1) === "/" ? out.slice(0, -1) : out;
    } catch (e) {
      return String(url || "").replace(/^https?:\/\//i, "").replace(/^www\./i, "");
    }
  }
  function rbFavicon(url, karte){
    if (karte && karte.favicon) return String(karte.favicon);
    try { return "https://www.google.com/s2/favicons?domain=" + new URL(url).hostname + "&sz=64"; }
    catch (e) { return ""; }
  }

  /* Die eigene Zitationsliste ist die bessere Quelle als die URL im Text: sie kennt Titel und
     Favicon, und ihre id ist es, die das Ereignis nach Bubble tragen muss. Verglichen wird nach
     der bereinigten URL ohne Schraegstrich am Ende -- der Text schreibt sie mal mit, mal ohne. */
  function rbCiteIndex(citations){
    var idx = {};
    (isArr(citations) ? citations : []).forEach(function (c) {
      if (!c || !c.url) return;
      var k = rbCleanUrl(c.url).replace(/\/+$/, "");
      idx[k] = c;
      idx[k.replace(/^https?:\/\//, "").replace(/^www\./, "")] = c;
    });
    return idx;
  }
  function rbLookup(idx, url){
    var k = rbCleanUrl(url).replace(/\/+$/, "");
    return idx[k] || idx[k.replace(/^https?:\/\//, "").replace(/^www\./, "")] || null;
  }

  /* Die Gegenrichtung zu esc(). An dieser Stelle der Kette ist der Antworttext schon HTML, ein
     "&" in der Adresse steht also als "&amp;". Ohne diese Umkehr traegt der Chip eine Adresse,
     die es in der Datenbank so nie gab -- und der Abgleich mit der Zitationsliste scheitert
     genau bei den Adressen mit Parametern. Nur die vier Entitaeten, die esc() erzeugt, und
     "&amp;" zuletzt, damit aus "&amp;lt;" nicht faelschlich "<" wird. */
  function rbUnesc(s){
    return String(s == null ? "" : s)
      .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
      .replace(/&amp;/g, "&");
  }

  var RB_CITE_MAX = 30;
  function rbChip(url, idx){
    /* roh = nur die Markdown-Maskierung zurueckgenommen, sonst NICHTS. Dieser Wert geht als
       Schluessel nach Bubble, und dort ist die URL selbst der Primaerschluessel -- eine eigene
       id gibt es nicht. rbCleanUrl waere dafuer falsch: es wirft utm-Parameter und die Raute weg
       und schickt alles durch new URL(), was Host kleinschreibt und Zeichen umkodiert. Zum
       Abgleichen und Anzeigen ist das richtig, als Schluessel nicht. */
    var roh = rbUnesc(String(url).replace(/\\([()])/g, "$1"));
    var clean = rbCleanUrl(roh);
    var karte = rbLookup(idx, clean);
    var voll = rbShowUrl(clean);
    var kurz = voll.length > RB_CITE_MAX ? voll.slice(0, RB_CITE_MAX) + "..." : voll;
    var fav = rbFavicon(clean, karte);
    /* Der Chip ist ein Knopf, kein Link: der Klick oeffnet die Wahl zwischen Detailseite und
       externem Fenster. Ein <a href> wuerde beim ersten Klick schon navigieren. */
    return '<span class="up-rb-cite" role="button" tabindex="0"' +
             ' data-rb-cite="' + esc(clean) + '"' +
             /* Die Adresse Zeichen fuer Zeichen wie in den Daten: aus der Zitationsliste, wenn
                der Chip dort eine Karte hat -- das IST die Zeile aus der Datenbank -- sonst so,
                wie sie im Antworttext steht. data-rb-cite bleibt daneben stehen, es traegt die
                bereinigte Form fuer Abgleich und Gruppierung. */
             ' data-rb-url="' + esc(karte && karte.url ? String(karte.url) : roh) + '"' +
             ' data-rb-id="' + esc(karte && karte.id ? karte.id : "") + '"' +
             ' data-tip="' + esc(karte && karte.title ? karte.title : voll) + '">' +
             (fav ? '<img class="up-rb-cite-fav" src="' + esc(fav) + '" alt="" loading="lazy"' +
                    ' referrerpolicy="no-referrer" onerror="this.remove()"/>' : "") +
             '<span class="up-rb-cite-txt">' + esc(kurz) + '</span>' +
           '</span>';
  }

  /* Zitate ersetzen. Reihenfolge von spezifisch nach allgemein -- die letzte Regel frisst sonst
     die Klammerformen der ersten. */
  function rbCites(html, idx){
    var out = String(html == null ? "" : html);
    /* google-aio Fussnote, falls doch inline: [[0] - Titel](url) */
    out = out.replace(/\[\[\s*[^\]]*?\s*\]\s*-\s*[^\]]*?\s*\]\((https?:\/\/[^)\s]+)\)/g,
      function (_m, u) { return rbChip(u, idx); });
    /* perplexity: [(url)] */
    out = out.replace(/\[\(\s*(https?:\/\/[^)\s]+)\s*\)\]/g, function (_m, u) { return rbChip(u, idx); });
    /* in Klammern: ([Label](url)) */
    out = out.replace(/\(\s*\[[^\]]*\]\((https?:\/\/[^)\s]+)\)\s*\)/g, function (_m, u) { return rbChip(u, idx); });
    /* allgemein: [Label](url) */
    out = out.replace(/\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/g, function (_m, u) { return rbChip(u, idx); });
    return out;
  }

  /* Fett und kursiv. Der Sonderfall **text* mit nur einem Stern am Ende kommt aus google-aio und
     stand schon im alten Element -- ohne ihn bleibt der Rest des Absatzes fett. */
  function rbInline(t){
    var out = String(t == null ? "" : t);
    out = out.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
    out = out.replace(/\*\*([^*\n]+)\*/g, "<strong>$1</strong>");
    out = out.replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s.,;:!?)]|$)/g, "$1<em>$2</em>");
    return out;
  }

  /* Aus einem fertigen .up-stack so viele Chips zeigen, wie in die verfuegbare Breite passen --
     der Rest wird zu "+N". brandStack kann nur eine feste Zahl (max 4); im Fuss einer Kachel
     haengt die Zahl aber an der Kachelbreite, und die haengt an der Spaltenzahl.
     Gemessen wird nach dem Einfuegen, weil erst dann die echten Breiten feststehen. cfg.reserve
     haelt links Platz frei (in der Kachel 32px, damit der Titel darueber nicht bis an die Chips
     heranlaeuft). */
  function stackFit(stack, cfg){
    if (!stack) return 0;
    cfg = cfg || {};
    var items = [].slice.call(stack.querySelectorAll(".up-stack-item"));
    var more = stack.querySelector(".up-stack-more");
    if (!items.length) return 0;
    /* Das "+N" anlegen, wenn es keines gibt. brandStack schreibt es nur, wenn schon beim Rendern
       etwas uebrig war (rest > 0) -- passen alle Chips in den Vorrat und kuerzt erst stackFit am
       Platz, gab es kein Element, in das die Zahl haette gehen koennen: gemessen 10 Chips, 6
       sichtbar, kein "+4". Vier verschwundene Marken ohne einen Hinweis darauf. */
    if (!more){
      more = document.createElement("span");
      more.className = "up-stack-more";
      more.style.display = "none";
      stack.appendChild(more);
    }
    /* cfg.space: der Platz in Pixeln, ausdruecklich vorgegeben. Gebraucht, wenn der Behaelter
       seine Breite vom INHALT nimmt (flex: 0 0 auto). Dann ist clientWidth die Breite des schon
       gekuerzten Stapels, und was einmal weg ist, kommt nie zurueck -- gemessen blieb der Stapel
       bei 3 Chips, auch als die Zeile wieder 1184px breit war. */
    var platz = (cfg.space != null ? cfg.space : (stack.parentNode ? stack.parentNode.clientWidth : 0)) -
                (cfg.reserve || 0);
    if (platz <= 0) return items.length;
    /* Alle erst zeigen, sonst messe ich die Breite eines schon gekuerzten Stapels. */
    items.forEach(function (it) { it.style.display = ""; });
    /* Die Gesamtzahl steht NICHT an den Chips: brandStack rendert hoechstens seine max und schreibt
       den Rest schon als "+N". Ohne diese Zahl haette stackFit ein vorhandenes "+4" fuer ueberzaehlig
       gehalten und ausgeblendet -- gemessen: 8 Erwaehnungen, 4 Chips, "+4" verschwand. */
    if (more) more.style.display = "none";
    /* Die Gesamtzahl EINMAL merken. Sie steht beim ersten Lauf im "+N", das brandStack geschrieben
       hat -- danach steht darin, was stackFit selbst zuletzt geschrieben hat, und wer sie dann
       erneut daraus liest, addiert seine eigene Ausgabe dazu. Gemessen: 10 Marken wurden ueber
       drei Laeufe (jede Breitenaenderung ist einer) zu "+15" bei 3 Chips, also 18.
       Der Stapel wird bei neuen Daten neu gebaut, also faellt der Merker von selbst weg. */
    var gesamt = cfg.total ? Math.max(cfg.total, items.length) : 0;
    if (!gesamt){
      if (stack.__upStackTotal == null){
        var mm = more ? /(\d+)/.exec(more.textContent || "") : null;
        stack.__upStackTotal = items.length + (mm ? parseInt(mm[1], 10) : 0);
      }
      gesamt = stack.__upStackTotal;
    }
    var sichtbar = items.length;
    /* Von hinten wegnehmen, bis es passt. Ein Chip ueberlappt den vorigen um 4px (up-stack-item
       + up-stack-item hat margin-left -4), deshalb wird gemessen und nicht gerechnet. */
    while (sichtbar > 1 && stack.scrollWidth > platz){
      sichtbar--;
      items[sichtbar].style.display = "none";
      if (more){
        more.style.display = "";
        more.textContent = "+" + (gesamt - sichtbar);
      }
    }
    if (more && gesamt - sichtbar > 0){
      more.style.display = "";
      more.textContent = "+" + (gesamt - sichtbar);
    } else if (more){
      more.style.display = "none";
    }
    return sichtbar;
  }

  function rbSplitRow(line){
    var s = String(line || "").trim();
    if (s.charAt(0) === "|") s = s.slice(1);
    if (s.charAt(s.length - 1) === "|") s = s.slice(0, -1);
    return s.split("|").map(function (c) { return c.trim(); });
  }
  function rbIsSep(line){
    var s = String(line || "").trim();
    if (s.indexOf("|") < 0) return false;
    var p = rbSplitRow(s);
    return p.length >= 2 && p.every(function (x) { return /^:?-{3,}:?$/.test(x); });
  }
  function rbIsTable(lines, i){
    var a = String(lines[i] || "").trim(), b = String(lines[i + 1] || "").trim();
    if (a.indexOf("|") < 0 || b.indexOf("|") < 0) return false;
    if (a.charAt(0) !== "|" && a.charAt(a.length - 1) !== "|" && rbSplitRow(a).length < 2) return false;
    return rbIsSep(b);
  }

  /* Ausrichtung aus der Trennzeile: :--- links, ---: rechts, :---: mittig. Die alten Elemente
     erkannten die Schreibweise, warfen sie aber weg und setzten alles linksbuendig -- eine
     Spalte mit Zahlen liest sich rechtsbuendig deutlich besser. */
  function rbAligns(sepLine){
    return rbSplitRow(sepLine).map(function (p) {
      var l = p.charAt(0) === ":", r = p.charAt(p.length - 1) === ":";
      return l && r ? "center" : (r ? "right" : "");
    });
  }

  function rbTable(headerLine, sepLine, bodyLines, idx){
    var kopf = rbSplitRow(headerLine);
    var aus = rbAligns(sepLine);
    var zeilen = bodyLines.map(rbSplitRow).filter(function (r) {
      return r.length > 1 && r.some(function (x) { return x !== ""; });
    });
    var spalten = kopf.length;
    zeilen.forEach(function (r) { if (r.length > spalten) spalten = r.length; });
    while (kopf.length < spalten) kopf.push("");

    /* Eine Zelle, die NUR aus einem Link besteht, wird zu ihrem Text -- kein Chip. In der
       Anbieter-Spalte einer Vergleichstabelle steht der Markenname als Link; als Chip verliert
       die Spalte ihren Namen und wird zu einer Reihe URLs. Stand schon im chatgpt-Element. */
    var NUR_LINK = /^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/;
    function zelle(roh){
      var t = String(roh || "").trim();
      var m = t.match(NUR_LINK);
      if (m) return rbInline(esc(m[1]));
      return rbCites(rbInline(esc(t)), idx);
    }
    function attr(i){ return aus[i] ? ' style="text-align:' + aus[i] + '"' : ""; }

    return '<div class="up-rb-tablewrap"><table class="up-rb-table"><thead><tr>' +
        kopf.map(function (h, i) { return "<th" + attr(i) + ">" + zelle(h) + "</th>"; }).join("") +
      "</tr></thead><tbody>" +
        zeilen.map(function (r) {
          while (r.length < spalten) r.push("");
          return "<tr>" + r.map(function (c, i) { return "<td" + attr(i) + ">" + zelle(c) + "</td>"; }).join("") + "</tr>";
        }).join("") +
      "</tbody></table></div>";
  }

  function rbBlocks(text, idx){
    var lines = String(text == null ? "" : text).replace(/\r\n?/g, "\n").split("\n");
    var raus = [], i = 0, liste = null;

    function listeAbschliessen(){
      if (!liste) return;
      raus.push("<" + liste.tag + ' class="up-rb-list">' +
        liste.items.map(function (x) { return "<li>" + x + "</li>"; }).join("") + "</" + liste.tag + ">");
      liste = null;
    }

    while (i < lines.length){
      var z = lines[i], t = z.trim();

      if (!t || /^\*+$/.test(t)){ listeAbschliessen(); i++; continue; }

      /* Ueberschriften: ## und ### werden dieselbe Stufe -- eine Modellantwort hat keine
         Dokumenthierarchie, nur Zwischentitel. */
      if (/^#{1,6}\s/.test(t)){
        listeAbschliessen();
        raus.push('<h3 class="up-rb-h">' + rbCites(rbInline(esc(t.replace(/^#+\s*/, ""))), idx) + "</h3>");
        i++; continue;
      }
      if (/^(-{3,}|_{3,}|\*{3,})$/.test(t)){ listeAbschliessen(); raus.push('<hr class="up-rb-hr">'); i++; continue; }

      if (rbIsTable(lines, i)){
        listeAbschliessen();
        var kopfZ = lines[i], sepZ = lines[i + 1];
        i += 2;
        var koerper = [];
        while (i < lines.length && lines[i].trim() && lines[i].indexOf("|") >= 0){ koerper.push(lines[i]); i++; }
        raus.push(rbTable(kopfZ, sepZ, koerper, idx));
        continue;
      }

      /* Listenpunkte: - / * / 1. -- aber nicht **fett** am Zeilenanfang. */
      var mb = t.match(/^([*-]|\d+[.)])\s+(.+)$/);
      if (mb && t.indexOf("**") !== 0){
        var tag = /^\d/.test(mb[1]) ? "ol" : "ul";
        if (!liste || liste.tag !== tag){ listeAbschliessen(); liste = { tag: tag, items: [] }; }
        liste.items.push(rbCites(rbInline(esc(mb[2])), idx));
        i++; continue;
      }

      listeAbschliessen();
      var absatz = [];
      while (i < lines.length && lines[i].trim()){
        if (rbIsTable(lines, i)) break;
        if (/^#{1,6}\s/.test(lines[i].trim())) break;
        if (/^(-{3,}|_{3,}|\*{3,})$/.test(lines[i].trim())) break;
        var m2 = lines[i].trim().match(/^([*-]|\d+[.)])\s+(.+)$/);
        if (m2 && lines[i].trim().indexOf("**") !== 0) break;
        absatz.push(lines[i]); i++;
      }
      if (absatz.length){
        raus.push('<p class="up-rb-p">' +
          rbCites(rbInline(esc(absatz.join("\n"))), idx).replace(/\n/g, "<br>") + "</p>");
      }
    }
    listeAbschliessen();
    return raus.join("");
  }

  /* Markennamen im fertigen Baum auszeichnen. Nach dem Einfuegen und nicht vorher, weil ein
     Markenname auch in einer Tabellenzelle oder in einer Ueberschrift stehen kann -- und weil er
     NICHT in einem Zitat-Chip stehen darf, dessen Text eine URL ist.
     Regeln aus den alten Elementen uebernommen: laengste Marke zuerst (sonst gewinnt "Solar"
     gegen "Aurora Solar"), Wortgrenzen ueber Unicode-Klassen statt \b (\b kennt kein "ü"),
     und je Marke nur das ERSTE Vorkommen -- ein Text, der eine Marke zwanzigmal nennt, waere
     sonst zwanzigmal unterbrochen. */
  function rbBrands(rootEl, companies, cfg){
    cfg = cfg || {};
    /* Modus aus den Einstellungen: "all" jede Erwaehnung, "first" nur die erste je Marke,
       "own" nur die eigene Marke, "none" keine. Ohne Angabe bleibt es bei "first" -- so haben es
       die alten Elemente gemacht, und ein Text, der eine Marke zwanzigmal nennt, waere sonst
       zwanzigmal unterbrochen. */
    var modus = cfg.mode === "all" || cfg.mode === "own" || cfg.mode === "none" ? cfg.mode : "first";
    if (modus === "none") return 0;
    /* Welche ist die eigene? Das companies-Array sagt es nicht -- die Rolle steht nur an den
       Erwaehnungen der Zitationen (role: "own"). Von dort kommt die Menge der eigenen ids. */
    var eigene = cfg.ownIds && typeof cfg.ownIds === "object" ? cfg.ownIds : null;
    var items = (isArr(companies) ? companies : []).map(function (c) {
      return {
        roh: String((c && (c.brand_name_raw || c.name)) || "").trim(),
        name: String((c && c.name) || "").trim(),
        id: String((c && c.company_id) || ""),
        icon: String((c && c.favicon_url) || "")
      };
    }).filter(function (x) {
      if (!x.roh) return false;
      if (modus !== "own") return true;
      /* Ohne bekannte eigene id waere "nur die eigene" gleichbedeutend mit "keine" -- dann lieber
         alle zeigen als stumm nichts, und einmal sagen warum. */
      if (!eigene) return true;
      return !!eigene[x.id];
    });
    if (!rootEl || !items.length) return 0;

    items.sort(function (a, b) { return b.roh.length - a.roh.length; });
    var nachKlein = {}, muster = [];
    items.forEach(function (it) {
      var k = it.roh.toLowerCase();
      if (!nachKlein[k]){ nachKlein[k] = it; muster.push(it.roh.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")); }
    });
    if (!muster.length) return 0;

    var re;
    try { re = new RegExp("(?<![\\p{L}\\p{N}])(" + muster.join("|") + ")(?![\\p{L}\\p{N}])", "giu"); }
    catch (e) { re = new RegExp("\\b(" + muster.join("|") + ")\\b", "gi"); }

    var gesehen = {}, gesetzt = 0;
    var walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        var p = node.parentElement;
        if (!p) return NodeFilter.FILTER_REJECT;
        if (p.closest(".up-rb-cite") || p.closest(".up-rb-brand")) return NodeFilter.FILTER_REJECT;
        if (p.tagName === "SCRIPT" || p.tagName === "STYLE") return NodeFilter.FILTER_REJECT;
        if (!String(node.nodeValue || "").trim()) return NodeFilter.FILTER_REJECT;
        re.lastIndex = 0;
        return re.test(node.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    var knoten = [], n;
    while ((n = walker.nextNode())) knoten.push(n);

    knoten.forEach(function (tn) {
      var text = tn.nodeValue || "";
      re.lastIndex = 0;
      var m, letzte = 0, frag = document.createDocumentFragment(), geaendert = false;
      while ((m = re.exec(text)) !== null){
        var gefunden = m[1], k = gefunden.toLowerCase();
        if (m.index > letzte) frag.appendChild(document.createTextNode(text.slice(letzte, m.index)));
        if (modus === "first" && gesehen[k]){
          frag.appendChild(document.createTextNode(gefunden));
        } else {
          gesehen[k] = true;
          var e = nachKlein[k] || {};
          var chip = document.createElement("span");
          chip.className = "up-rb-brand";
          chip.setAttribute("role", "button");
          chip.setAttribute("tabindex", "0");
          chip.setAttribute("data-rb-brand", e.id || "");
          /* Tooltip an JEDER Marke. Vorher stand er nur dort, wo sich der Anzeigename von der
             Schreibweise im Text unterschied -- bei "LeeUp Media" gegen "LeeUP Media" also
             zufaellig ja, bei "Anfragenfluss" gegen "Anfragenfluss" zufaellig nein. Von aussen
             sah das aus, als haette nur die eigene Marke einen. */
          chip.setAttribute("data-tip", e.name || gefunden);
          if (e.icon){
            var img = document.createElement("img");
            img.className = "up-rb-brand-ic"; img.alt = ""; img.loading = "lazy";
            img.referrerPolicy = "no-referrer"; img.src = e.icon;
            img.onerror = function(){ if (img.parentNode) img.parentNode.removeChild(img); };
            chip.appendChild(img);
          }
          var txt = document.createElement("strong");
          txt.className = "up-rb-brand-txt"; txt.textContent = gefunden;
          chip.appendChild(txt);
          frag.appendChild(chip);
          geaendert = true; gesetzt++;
        }
        letzte = m.index + m[0].length;
      }
      if (letzte < text.length) frag.appendChild(document.createTextNode(text.slice(letzte)));
      if (geaendert && tn.parentNode) tn.parentNode.replaceChild(frag, tn);
    });
    return gesetzt;
  }

  /* Stehen mehrere Zitate direkt hintereinander -- "[0](url) [3](url) [4](url)", die Regel bei
     google-aio --, ergibt das drei Chips in einer Reihe und der Satz davor verschwindet dahinter.
     Zusammengefasst werden sie zu EINEM Chip: die Favicons ineinandergeschoben, dahinter
     "N Sources". Was dazugehoert, steht als JSON am Chip, damit der Hover-Kasten es ohne zweite
     Datenquelle auflisten kann.
     "Direkt hintereinander" heisst: zwischen zwei Chips steht nichts oder nur Leerraum. Ein Komma
     oder ein Wort dazwischen trennt sie -- dann gehoeren sie zu verschiedenen Aussagen. */
  function rbGroupCites(hostEl){
    if (!hostEl) return 0;
    var chips = [].slice.call(hostEl.querySelectorAll(".up-rb-cite"));
    var gruppen = 0, i = 0;
    while (i < chips.length){
      var reihe = [chips[i]], j = i + 1;
      while (j < chips.length){
        /* Alles zwischen dem letzten Chip der Reihe und dem naechsten Kandidaten ansehen. */
        var vorher = reihe[reihe.length - 1], naechst = chips[j], nur = true, k = vorher.nextSibling;
        while (k && k !== naechst){
          if (k.nodeType === 3){ if (String(k.nodeValue).trim() !== ""){ nur = false; break; } }
          else { nur = false; break; }
          k = k.nextSibling;
        }
        if (!nur || vorher.parentNode !== naechst.parentNode) break;
        reihe.push(naechst); j++;
      }
      if (reihe.length >= 2){
        var daten = reihe.map(function (c) {
          var img = c.querySelector(".up-rb-cite-fav");
          /* url ist die EXAKTE Adresse (data-rb-url), nicht die bereinigte: aus dieser Liste
             heraus wird geklickt, und der Klick traegt den Schluessel nach Bubble. */
          return { url: c.getAttribute("data-rb-url") || c.getAttribute("data-rb-cite") || "",
                   id: c.getAttribute("data-rb-id") || "",
                   title: c.getAttribute("data-tip") || "",
                   fav: img ? img.getAttribute("src") : "" };
        });
        var g = document.createElement("span");
        g.className = "up-rb-cgroup";
        g.setAttribute("role", "button");
        g.setAttribute("tabindex", "0");
        g.setAttribute("data-rb-group", JSON.stringify(daten));
        g.innerHTML = '<span class="up-rb-cg-favs">' +
            daten.map(function (d) {
              return d.fav ? '<img class="up-rb-cg-fav" src="' + esc(d.fav) + '" alt="" loading="lazy"' +
                             ' referrerpolicy="no-referrer" onerror="this.remove()"/>'
                           : '<span class="up-rb-cg-fav"></span>';
            }).join("") +
          "</span>" +
          '<span class="up-rb-cg-txt">' + daten.length + " Sources</span>";
        reihe[0].parentNode.insertBefore(g, reihe[0]);
        /* Den Leerraum zwischen den alten Chips mitnehmen, sonst bleibt eine Luecke stehen. */
        reihe.forEach(function (c, n) {
          if (n > 0){
            var vor = c.previousSibling;
            while (vor && vor.nodeType === 3 && String(vor.nodeValue).trim() === ""){
              var weg = vor; vor = vor.previousSibling; weg.parentNode.removeChild(weg);
            }
          }
          c.parentNode.removeChild(c);
        });
        gruppen++;
      }
      i = j > i ? j : i + 1;
    }
    return gruppen;
  }

  /* Der ganze Weg: Text bereinigen, Bloecke bauen, Marken auszeichnen.
     Gibt zurueck, was gesetzt wurde -- die Komponente kann so messen statt raten. */
  function respBody(hostEl, cfg){
    cfg = cfg || {};
    var roh = String(cfg.text == null ? "" : cfg.text);
    var modell = String(cfg.model || "").toLowerCase();
    /* Die Laufmarken hat nur SearchAPI, also nur google-aio -- der Filter laeuft trotzdem
       ueberall, weil er auf ein Muster prueft, das in echtem Text nicht vorkommt. */
    var text = rbStripFooter(rbStripRunTokens(roh));
    if (!hostEl) return { html: "", brands: 0, cites: 0, tables: 0 };
    var idx = rbCiteIndex(cfg.citations);
    hostEl.innerHTML = rbBlocks(text, idx);
    /* Zitat-Chips abschalten heisst: WEG, nicht "als Text stehen lassen". Vorher wurde der Chip zu
       seinem Text, also blieb die nackte Adresse mitten im Satz -- schlechter lesbar als der Chip.
       Die Quellen bleiben im Abschnitt "Citations" vollstaendig sichtbar. */
    var gruppen = 0;
    if (cfg.cites === false){
      [].forEach.call(hostEl.querySelectorAll(".up-rb-cite"), function (c) {
        /* Auch den Leerraum davor, sonst stehen zwei Luecken hintereinander. */
        var vor = c.previousSibling;
        if (vor && vor.nodeType === 3 && /\s$/.test(vor.nodeValue) && !String(vor.nodeValue).trim()){
          vor.parentNode.removeChild(vor);
        }
        c.parentNode.removeChild(c);
      });
      /* Was nach dem Entfernen als leerer Absatz uebrig bleibt, ist keiner mehr. */
      [].forEach.call(hostEl.querySelectorAll(".up-rb-p"), function (pp) {
        if (!pp.textContent.trim() && !pp.querySelector("img")) pp.parentNode.removeChild(pp);
      });
    } else if (cfg.groupCites){
      gruppen = rbGroupCites(hostEl);
    }
    var marken = rbBrands(hostEl, cfg.companies, { mode: cfg.brandMode, ownIds: cfg.ownIds });
    return {
      html: hostEl.innerHTML,
      brands: marken,
      cites: hostEl.querySelectorAll(".up-rb-cite").length,
      groups: gruppen,
      tables: hostEl.querySelectorAll(".up-rb-table").length,
      modell: modell
    };
  }

  /* ==========================================================================================
     TABLE PRIMITIVES
     ==========================================================================================
     The four tables in this library legitimately differ in their columns, heights and row
     content — that stays per component. What did NOT need to differ, but was copy-pasted anyway,
     is everything below: the trend chip (4 copies), the loading skeleton rows (4), the 600ms
     empty-state grace timer (5), and the column-explainer popover logic (3). */

  /* Delta chip: an arrow plus the absolute value, coloured by whether the change is GOOD, which
     is not the same as whether it went up — for a ranking, down is good. Hence `inverted`.
     Returns "" for null/NaN/rounds-to-zero, so callers can concatenate it unconditionally.
     opts: { decimals, inverted, suffix, cls } */
  function trendChip(delta, opts){
    opts = opts || {};
    if (delta == null || delta === "") return "";
    var d = Number(delta);
    if (!isFinite(d)) return "";
    var shown = opts.decimals ? Math.round(Math.abs(d) * 10) / 10 : Math.round(Math.abs(d));
    if (shown === 0) return "";                       // "+0%" is noise, not information
    var goingUp = d > 0;
    var positive = opts.inverted ? !goingUp : goingUp;
    var txt = (opts.decimals ? shown.toFixed(1) : String(shown)) + (opts.suffix || "");
    return '<span class="' + (opts.cls || "up-trend") + " " + (positive ? "pos" : "neg") + '">' +
      (goingUp ? TREND_UP : TREND_DOWN) + txt + '</span>';
  }

  /* Colour for a 0-100 sentiment score: red -> orange -> grey -> light green -> green.
     Shared by visibility-chart's Top Brands table and prompts-table's Sentiment column —
     both need the exact same thresholds, not just a similar-looking scale. */
  function sentColor(v){
    v = Number(v);
    if (v <= 25) return "#D25D5D";
    if (v <= 40) return "#D2865D";
    if (v <= 60) return "#9E9E9E";
    if (v <= 75) return "#9FD25D";
    return "#60D25D";
  }

  /* Brand-mention chip stack: overlapping favicon circles + "+N" overflow. Shared by urls-table
     and prompts-table's Brand Mentions column — same chips, same hover-lift, same overflow math.
     mentions: [{name, favicon_url|favicon}, ...] — the RPC sends only a preview; totalCount
     carries the real count so "+N" is correct even when the preview happens to be exactly full.
     opts: { max } (default 4) */
  function brandStack(mentions, totalCount, opts){
    opts = opts || {};
    var MAX = opts.max || 4;
    /* tipKey lets a caller show a different field in the hover tooltip than the one driving the
       chip's own initial-letter fallback (still always m.name) — responses-table's Brand Mentions
       column wants the untouched brand_name_raw the RPC sends alongside name, not the (possibly
       normalized) display name. Defaults to "name" so every other consumer is unaffected. */
    var tipKey = opts.tipKey || "name";
    /* opts.fav: dieser Stapel zeigt SEITEN und keine Marken. Faellt dann ein Favicon aus, steht
       ein Globus statt des Anfangsbuchstabens da -- bei einer Domain sagt der Buchstabe nichts.
       Die Regel dazu steht in core.css (.up-fav). */
    var favGlobus = !!opts.fav;
    var list = Array.isArray(mentions) ? mentions : [];
    /* Ein Minus-Icon statt eines Bindestrichs: derselbe Strich, aber als Zeichen und nicht als
       Schriftzeichen, das je nach Schriftart anders lang ist. Lucide minus, wie ueberall. */
    if (!list.length) return '<span class="up-stack-empty">' + icon("minus", 2.5) + "</span>";
    /* Eine Erwaehnung ohne Namen und ohne Logo ist ein leerer Chip -- der sah mit dem alten
       "?"-Rueckfall aus wie eine unbekannte Marke. Sie wird nicht gezeigt, zaehlt aber weiter zur
       Gesamtzahl, damit "+N" die Wahrheit sagt. */
    list = list.filter(function(m){
      var nm = m && m.name != null ? String(m.name).trim() : "";
      var lg = m && (m.favicon_url || m.favicon) ? String(m.favicon_url || m.favicon).trim() : "";
      return !!(nm || lg);
    });
    if (!list.length) return '<span class="up-stack-empty">' + icon("minus", 2.5) + "</span>";
    var shown = list.slice(0, MAX);
    var total = toNum(totalCount);
    if (total == null || total < list.length) total = list.length;
    var rest = total - shown.length;
    var last = shown.length - 1;
    var html = shown.map(function(m, mi){
      var nm = String(m && m.name != null ? m.name : "");
      var tip = String(m && m[tipKey] != null ? m[tipKey] : nm);
      var logo = String(m && (m.favicon_url != null ? m.favicon_url : (m.favicon != null ? m.favicon : "")) || "");
      // protocol-relative urls ("//cdn...") break inside some Bubble contexts
      if (logo.indexOf("//") === 0) logo = "https:" + logo;
      /* Kein "?" mehr als Rueckfall. Ein Fragezeichen behauptet "hier ist etwas, das ich nicht
         kenne" -- richtig ist: hier ist nichts. Traegt eine Erwaehnung weder Namen noch Logo, hat
         sie im Stapel nichts zu suchen (siehe Filter oben). Bleibt sie ohne Namen, aber MIT Logo,
         steht das Logo fuer sich. */
      var initial = nm.charAt(0) || "";
      /* is-last marks the final CHIP (a "+N" badge may follow it, so :last-child will not do).
         The left-spread hover rules need to target it, and CSS forbids :has() inside :has() —
         which is what an inline "item not followed by another item" selector would require. */
      return '<span class="up-stack-item' + (favGlobus ? " up-fav" : "") + (logo ? " has-img" : "") + (mi === last ? " is-last" : "") +
             '" data-brandtip="' + esc(tip) + '">' +
               '<span class="up-stack-vis">' +
                 '<span class="up-stack-ltr">' + esc(initial) + '</span>' +
                 (logo ? '<img src="' + esc(logo) + '" alt="" loading="lazy" referrerpolicy="no-referrer"' +
                         ' onerror="this.closest(\'.up-stack-item\').classList.remove(\'has-img\'); this.remove()"/>' : "") +
               '</span>' +
             '</span>';
    }).join("");
    if (rest > 0) html += '<span class="up-stack-more">+' + rest + '</span>';
    /* opts.spread:"left" — for a stack pinned to the right edge of its cell/card, where the
       default rightward hover spread would push chips outside the container. */
    return '<span class="up-stack' + (opts.spread === "left" ? " is-spread-left" : "") + '">' + html + '</span>';
  }

  /* Loading skeleton rows for a grid table.
     spec: { count, cols:[width|{w, jitter, logo, logoStyle, cls}], rowClass, cellClass, headHtml }
     A number is a bar width in px. `cls` is appended to the cell — the tables need it because
     their column show/hide toggles target per-column classes, and the skeleton has to hide the
     same columns as the real rows. `logo` prepends the square placeholder, `logoStyle` lets the
     brand-stack column make it round instead. */
  function skeletonRows(spec){
    spec = spec || {};
    var count = spec.count || 7;
    var cols = spec.cols || [];
    var rowClass = spec.rowClass || "up-row";
    var cellClass = spec.cellClass || "up-td";
    var out = "";
    for (var i = 0; i < count; i++){
      var cells = "";
      for (var c = 0; c < cols.length; c++){
        var col = cols[c];
        var isObj = col && typeof col === "object";
        var w = (typeof col === "number") ? col : (isObj && col.w) || 0;
        /* jitter the width per row so the block doesn't read as a rigid grid */
        if (isObj && col.jitter) w = w + (i % 3) * col.jitter;
        var logo = isObj && col.logo
          ? '<span class="up-tsk-logo"' + (col.logoStyle ? ' style="' + col.logoStyle + '"' : "") + '></span>'
          : "";
        var bar = w ? '<span class="up-tsk-bar" style="width:' + w + 'px"></span>' : "";
        cells += '<div class="' + cellClass + (isObj && col.cls ? " " + col.cls : "") + '">' + logo + bar + '</div>';
      }
      out += '<div class="' + rowClass + ' up-tsk">' + cells + '</div>';
    }
    return (spec.headHtml || "") + out;
  }

  /* Empty-state grace timer.
     An empty delivery is often an interim "clearing" step a beat before the real data lands;
     committing to "No data" immediately flashes a placeholder that is gone again a moment later.
     This shows the skeleton first and only commits after the window if the state still says
     empty. 600ms is short enough that it doesn't read as "stuck" once loading is genuinely done,
     while still catching a same-tick clearing flash — every consumer across the app (this one and
     each table/chart's own hand-rolled copy of the same pattern) uses the same window, so nothing
     next to something else ever disagrees about whether there is data.
     cfg: { showSkeleton(), commitEmpty(), stillEmpty(), ms } */
  function makeEmptyGrace(cfg){
    var t = null;
    function clear(){ if (t){ clearTimeout(t); t = null; } }
    return {
      /* call when a render finds no rows; returns true if it handled the render (grace running) */
      hold: function(){
        if (t) return true;
        cfg.showSkeleton();
        t = setTimeout(function(){
          t = null;
          if (cfg.stillEmpty && !cfg.stillEmpty()) return;   // data arrived meanwhile
          cfg.commitEmpty();
        }, cfg.ms || 600);
        return true;
      },
      clear: clear
    };
  }

  /* Column explainer popover (the "i" next to a metric header).
     Body-appended so it can't be clipped by the table's overflow, flips above the trigger when
     there isn't room below, and clamps its caret to stay under the icon after that clamp.
     cfg: { root, triggerSel, html(key), getIsDark } */
  function makeExplain(cfg){
    var root = cfg.root;
    var el = document.createElement("div");
    /* cfg.cls haengt eine Marker-Klasse an die Karte. Sie liegt im <body>, ausserhalb jeder
       .up-root -- ohne eine eigene Klasse kann ein Konsument sie also gar nicht ansprechen, und
       wer eine breitere Karte braucht (create-with-ai zeigt ein dreizeiliges Codebeispiel, das in
       248px nicht lesbar umbricht) muesste die Breite fuer ALLE sieben Konsumenten aendern.
       Weglassen ergibt exakt das bisherige Markup. */
    el.className = "up-explain" + (cfg.cls ? " " + cfg.cls : "");
    /* cfg.mount — wohin die Karte gehaengt wird, Standard <body>.
       Noetig geworden, sobald ein Konsument im TOP LAYER liegt: der wird nach dem gesamten
       Dokument gezeichnet, und eine Karte am body verschwindet dahinter, egal welchen z-index sie
       traegt (create-with-ai, nachdem sein Popup wegen des Opportunity-Drawers dorthin musste).
       Die Karte gehoert dann IN das Element, das befoerdert wurde. position:fixed meint darin
       weiterhin den Viewport, solange auf dem Weg dorthin kein transform steht -- die Positions-
       rechnung unten bleibt also unveraendert. */
    (cfg.mount || document.body).appendChild(el);
    var openFor = null, aufraeumT = null;
    /* Beim Verschwinden bleibt die Karte stehen, wo sie war, und blendet aus (140ms, siehe
       .up-explain). is-flipped darf dabei NICHT sofort fallen: die Klasse setzt die Spitze von oben
       nach unten um, und waehrend die Karte noch sichtbar ist, sieht man diesen Wechsel als
       Aufblitzen an der falschen Kante. Also erst nach dem Ausblenden aufraeumen -- und der Timer
       wird beim naechsten Zeigen abgebrochen, sonst raeumt er in eine schon wieder offene Karte. */
    /* Aus der obersten Ebene wieder heraus -- sonst faengt die Karte, auch unsichtbar, Klicks ab
       und liegt ueber allem. */
    function obenRaus(){
      if (!el.hasAttribute("popover")) return;
      try { el.hidePopover(); } catch(e){}
      el.removeAttribute("popover");
    }
    function hide(){
      el.classList.remove("is-on");
      obenRaus();
      openFor = null;
      clearTimeout(aufraeumT);
      aufraeumT = setTimeout(function(){
        if (el.classList.contains("is-on")) return;
        el.classList.remove("is-flipped");
      }, 200);
    }
    function show(trigger){
      var key = trigger.getAttribute("data-explain");
      /* the trigger goes along as a second argument so a consumer can build a preview from THIS
         row's values instead of a fixed sample (opportunities' potential bars mirror the level
         you're hovering). Purely additive -- every other consumer takes one argument and ignores
         it. */
      var html = cfg.html ? cfg.html(key, trigger) : "";
      if (!html) return;
      clearTimeout(aufraeumT);
      el.innerHTML = html;
      el.setAttribute("data-theme", (cfg.getIsDark && cfg.getIsDark()) ? "dark" : "light");
      /* Waehrend des Messens unsichtbar. Die Karte wird zum Messen kurz auf 0,0 gesetzt, und wenn
         der Browser dazwischen einen Frame zeichnet -- was er tut, sobald eine Ueberblendung von
         einem vorigen Verschwinden noch laeuft -- blitzt sie an der falschen Stelle auf. visibility
         nimmt sie fuer diesen Augenblick vollstaendig aus dem Bild, ohne die Masse zu aendern. */
      el.style.visibility = "hidden";
      /* IN DIE OBERSTE EBENE. Der z-index der Karte ist 2147483001, und das reicht trotzdem nicht:
         die Menues dieser App liegen im TOP LAYER (makePopover ruft showPopover), und der schlaegt
         jeden z-index. Ein Erklaerkasten, der aus einem Menue heraus geoeffnet wird -- das
         Info-Zeichen an "Brand Colors" in der Farbauswahl -- lag deshalb HINTER dem Menue.
         Gemessen: Karte sichtbar, Text richtig, aber im Bild nur eine dunkle Ecke unter dem Menue.
         Eine spaeter gezeigte popover-Ebene liegt ueber einer frueheren, also genuegt es, die Karte
         beim Zeigen dorthin zu heben. Wo es popover nicht gibt, bleibt es beim alten Verhalten. */
      if (!el.hasAttribute("popover") && typeof el.showPopover === "function"){
        try {
          el.setAttribute("popover", "manual");
          el.showPopover();
          /* Der UA-Stylesheet gibt jedem [popover] margin:auto und inset:0 -- ohne das
             Zuruecksetzen landet die Karte zentriert in der Mitte des Bildschirms. Dieselbe Stelle
             steht in core schon einmal, beim Panel-Ausbruch. */
          el.style.margin = "0";
          el.style.right = "auto";
          el.style.bottom = "auto";
        } catch(e){ el.removeAttribute("popover"); }
      }
      el.classList.add("is-on");
      el.classList.remove("is-flipped");
      el.style.left = "0px"; el.style.top = "0px";
      var r = trigger.getBoundingClientRect();
      var box = el.getBoundingClientRect();
      var vw = window.innerWidth || document.documentElement.clientWidth;
      var vh = window.innerHeight || document.documentElement.clientHeight;
      var left = r.left + r.width / 2 - box.width / 2;
      left = Math.max(8, Math.min(left, vw - box.width - 8));
      var top = r.bottom + 10;
      if (top + box.height > vh - 8){          // no room below → flip above the trigger
        top = r.top - box.height - 10;
        el.classList.add("is-flipped");
      }
      el.style.left = left + "px";
      el.style.top = top + "px";
      /* the caret follows the icon, not the box, because the box was clamped to the viewport */
      el.style.setProperty("--up-caret", Math.round(r.left + r.width / 2 - left) + "px");
      el.style.visibility = "";
      openFor = trigger;
    }
    root.addEventListener("mouseover", function(e){
      var t = e.target.closest(cfg.triggerSel || "[data-explain]");
      if (t && root.contains(t) && t !== openFor) show(t);
    });
    root.addEventListener("mouseout", function(e){
      var t = e.target.closest(cfg.triggerSel || "[data-explain]");
      if (!t) return;
      if (e.relatedTarget && t.contains(e.relatedTarget)) return;
      if (t === openFor) hide();
    });
    window.addEventListener("scroll", hide, { capture: true, passive: true });
    return { show: show, hide: hide, el: el };
  }

  /* ==========================================================================================
     TABLE CHROME — columns, pagination, header sorting
     ==========================================================================================
     urls-table and domains-table carried byte-identical copies of all of this (~300 lines each).
     The two tables genuinely differ in their COLUMNS, their row markup and their filters — that
     stays in the components. The machinery around it does not differ at all: the only things that
     were ever component-specific here are the per-column minimum width, which columns drop at
     which breakpoint, and whether the Columns menu offers the row-height switch. Those are now
     config, not forked code. */

  /* ---------- makeColumns ----------
     cfg: { root, state, columns, storePrefix, instanceId, firstKey, firstMin, actionsMin,
            dense, badgeSel, cellPrefixes, onChange }
       columns    — [{key, label, w, min, dropAt}]; `w` is the responsive track, `dropAt` is
                    "narrow" | "vnarrow" (the breakpoint at which the column stops being shown)
       firstKey   — the leading column that becomes a fixed px track once dragged ("domain")
       dense      — show the Comfortable/Compact switch in the menu
       cellPrefixes — class prefixes to toggle per column, e.g. ["up","uut"]
     state is the component's own object; this mutates state.cols / state.widths / state.dense. */
  function makeColumns(cfg){
    var root = cfg.root, state = cfg.state, COLUMNS = cfg.columns;
    var FIRST = cfg.firstKey || "domain";
    var FIRST_MIN = cfg.firstMin || 220;
    /* cfg.actionsMin darf wie cfg.leadWidth eine FUNKTION sein, damit eine Tabelle die Breite der
       Aktionsspalte pro Stufe aendern kann (discover-brands: der Track-Knopf traegt breit eine
       Beschriftung und wird schmal quadratisch). */
    function ACTIONS_MIN_F(){
      var v = (typeof cfg.actionsMin === "function") ? cfg.actionsMin() : cfg.actionsMin;
      return v || 100;
    }
    /* cfg.leadWidth — a fixed, never-hidden, never-resized track BEFORE the resizable lead column
       (brands-overview's "#" rank cell). Without it such a table could not use this kit at all and
       had to hand-roll its own grid template, which is how it ended up with no column resizing.
       Every width calculation below works on the space LEFT OVER after it. */
    function LEAD(){
      var v = (typeof cfg.leadWidth === "function") ? cfg.leadWidth() : cfg.leadWidth;
      return v || 0;
    }
    var prefixes = cfg.cellPrefixes || ["up"];
    /* Key format is deliberately "<pfx>_cols__<instanceId>", matching what the tables wrote
       before this machinery moved into core — changing it would silently throw away every user's
       saved column choices and drag widths on first load. */
    function colsKey(){ return prefKey(cfg.storePrefix + "_cols__" + cfg.instanceId); }
    function widthsKey(){ return prefKey(cfg.storePrefix + "_widths__" + cfg.instanceId); }

    function readCols(){
      var out = {};
      COLUMNS.forEach(function(c){ out[c.key] = true; });
      try {
        var raw = prefGet(colsKey());
        if (raw){
          var parsed = JSON.parse(raw);
          COLUMNS.forEach(function(c){ if (parsed[c.key] === false) out[c.key] = false; });
        }
      } catch(e){}
      return out;
    }
    function writeCols(){ try { window.localStorage.setItem(colsKey(), JSON.stringify(state.cols)); } catch(e){} }
    function readWidths(){
      try { var raw = prefGet(widthsKey()); return raw ? JSON.parse(raw) : {}; }
      catch(e){ return {}; }
    }
    function writeWidths(){ try { window.localStorage.setItem(widthsKey(), JSON.stringify(state.widths)); } catch(e){} }

    function visibleCols(){ return COLUMNS.filter(function(c){ return state.cols[c.key] !== false; }); }
    /* Drop order when the table is too narrow for every column: lowest `prio` goes first.
       Columns without an explicit prio fall back to their declaration order (leftmost = most
       important), which is the convention every table here already follows. */
    function prioOf(c){ return c.prio != null ? c.prio : (COLUMNS.length - COLUMNS.indexOf(c)); }
    /* The width the lead column will actually occupy BEFORE the user ever drags it: its track is
       `minmax(30%, 1.6fr)`, so on a wide container the 30% is what really applies and it is far
       larger than FIRST_MIN. Budgeting against FIRST_MIN alone was the bug that let 8 columns
       claim ~1150px of minimums inside a 1100px table and silently overflow.
       Deliberately ignores state.widths[FIRST] (the user's manual drag pin) even once one exists:
       dropping a column is a width-driven decision that must only ever react to the CONTAINER
       shrinking, never to the user choosing to spend more of the existing space on the lead
       column. A pinned lead column instead squeezes every other track down toward its own
       minimum (applyCols' own clamp handles that) — it does not make columns disappear. */
    /* Der Anteil, den die FUEHRENDE Spalte von der Tabellenbreite nimmt. 0.30 ist die Vorgabe und
       bleibt fuer jede Tabelle, die nichts anderes sagt.
       Warum es den Schalter gibt: dieser Anteil ist bei breiten Tabellen der GRUND, warum die
       rechte Spalte wegfaellt -- nicht die Mindestbreiten. In der Responses-Tabelle summieren sich
       die anderen sieben Spalten auf 1000px; mit 30 Prozent fuer Prompt braucht die Tabelle 1473px,
       damit "Date" ueberhaupt erscheint, und so breit ist ein 15-Zoll-Bildschirm hinter der
       250px-Seitenleiste nie. Gerechnet, nicht geschaetzt (dieselbe Formel wie autoFit unten).
       FIRST_MIN bleibt die harte Untergrenze: ein kleiner Anteil kann die fuehrende Spalte nicht
       unbrauchbar schmal machen. */
    function firstShare(){
      var v = cfg.firstShare;
      return (typeof v === "number" && v > 0 && v < 1) ? v : 0.30;
    }
    function firstWidth(cw){
      return Math.max(FIRST_MIN, (cw - LEAD()) * firstShare());
    }
    /* Measurement-driven column dropping. The hardcoded is-narrow/is-vnarrow breakpoints below
       only ever knew the ROOT's width, never what the columns actually need — so any table whose
       minimums outgrew its first breakpoint (prompts-table: ~1150px of minimums, first drop at
       860px) overflowed its own box across that whole range, pushing the rightmost columns off
       screen. This drops the least important columns until the remaining minimums genuinely fit,
       so the tiers act as a floor for intent ("never show Last Seen on mobile") while the fit
       itself is computed, not guessed. Adding a column to any table can no longer silently break
       a width range. */
    function autoFit(cols, cw){
      if (!cw) return cols;
      /* Reserve beyond the declared minimums: one separator border per column plus the table
         frame and sub-pixel track rounding. Measured, not guessed — without it an 8-column
         prompts-table still overflowed by ~20px at 1300px, because the sum of `min` values is
         not the whole story once borders and the box's own frame are laid out. Erring
         conservative here costs at most one column near a threshold; erring the other way puts
         columns off-screen, which is the bug this exists to prevent. */
      var reserve = 24 + cols.length;
      var budget = cw - LEAD() - firstWidth(cw) - reserve;
      if (!cfg.noActions && !root.classList.contains("is-t2")) budget -= ACTIONS_MIN_F();
      var need = 0;
      cols.forEach(function(c){ need += colMin(c.key); });
      if (need <= budget) return cols;
      /* `keep` columns are never dropped by width — they are the ones a table declares as its
         irreducible core (responses-table: Model, which has to survive even in mobile mode). They
         still count toward `need`, so they squeeze the droppable ones instead of being squeezed.
         Filtered out of the candidate list rather than skipped inside the loop so the loop can
         never spin on a column it refuses to drop. */
      var byPrio = cols.filter(function(c){ return !c.keep; })
                       .sort(function(a, b){ return prioOf(a) - prioOf(b); });
      var dropped = {}, kept = cols.length;
      for (var i = 0; i < byPrio.length && need > budget && kept > 1; i++){
        dropped[byPrio[i].key] = true;
        need -= colMin(byPrio[i].key);
        kept--;
      }
      return cols.filter(function(c){ return !dropped[c.key]; });
    }
    /* The space actually available to the GRID, not root's own outer width -- prompts-table's
       groups wide view puts a side panel next to .up-box inside root (see .upt-grp-widewrap):
       root's own width never changes when that panel opens, only how root's existing width is
       split between panel and box. Budgeting against root there would keep columns that no longer
       fit the now-narrower box, running the row content past the box's real right edge. Every
       other table has no such sibling, so .up-box's width there already equals root's. */
    function boxWidth(){
      var box = root.querySelector(".up-box");
      return (box || root).getBoundingClientRect().width || 0;
    }
    /* what is actually on screen right now: user-hidden columns minus the ones this width drops */
    function effectiveCols(){
      var narrow = root.classList.contains("is-narrow");
      var vnarrow = root.classList.contains("is-vnarrow");
      var cols = visibleCols().filter(function(c){
        /* cfg.isHidden — a column the current VIEW removes entirely (not the user, not the
           width). Kept separate from state.cols on purpose: writing the user's saved column
           prefs to hide it would silently clobber their choice when the view switches back. */
        if (cfg.isHidden && cfg.isHidden(c)) return false;
        if (vnarrow && c.dropAt === "vnarrow") return false;
        if ((narrow || vnarrow) && c.dropAt === "narrow") return false;
        return true;
      });
      return autoFit(cols, boxWidth());
    }
    /* cfg.noActions: tables without a row-actions column (e.g. prompts-table) skip the fixed
       trailing track entirely instead of reserving space for a column that has no cells. */
    function layoutKeys(){
      return [FIRST].concat(effectiveCols().map(function(c){ return c.key; }))
             .concat((cfg.noActions || root.classList.contains("is-t2")) ? [] : ["actions"]);
    }
    /* `minNarrow` — a column whose CELL renders differently in mobile mode (responses-table's Model
       chip collapses to a bare 32px logo) has a genuinely smaller floor there. Without this the
       two widths had to share one number, and picking the mobile one (44) made autoFit believe on
       DESKTOP that the column fit in 44px while the grid track still floored at its real 140px —
       so the budget was wrong by ~100px and the rightmost column dropped a breakpoint too early.
       Both colMin() and the unpinned track in applyCols() read through here, so the two can no
       longer disagree. */
    function colMin(key){
      if (key === FIRST) return FIRST_MIN;
      if (key === "actions") return ACTIONS_MIN_F();
      var c = COLUMNS.filter(function(x){ return x.key === key; })[0];
      if (c && c.minNarrow != null && root.classList.contains("is-vnarrow")) return c.minNarrow;
      return (c && c.min) || 100;
    }
    /* the unpinned grid track: c.w verbatim, except where minNarrow overrides the floor */
    function colTrack(c){
      if (c.minNarrow != null && root.classList.contains("is-vnarrow")) {
        return "minmax(" + c.minNarrow + "px, 1fr)";
      }
      return c.w;
    }
    /* see applyCols(): the two halves are guarded separately because they change at different
       rates — the track template on every width change, the visible column set only when a
       column actually drops in or out. */
    /* The lead column's drag handle is markup that every table has to remember to include, and a
       table that forgets it is simply not resizable with no visible clue why. The handle carries
       no content and no per-table config, so create it here when it is missing: the resize
       behaviour now ships with the kit instead of with a copy-pasted <span>. Idempotent — a
       markup-provided grip is left exactly as it is. */
    function ensureFirstGrip(){
      /* With a lead track the resizable column is the SECOND cell, not the first. */
      var ths = root.querySelectorAll(".up-thead .up-th");
      var th = ths[LEAD() ? 1 : 0];
      if (!th || th.querySelector(".up-grip")) return;
      var g = document.createElement("span");
      g.className = "up-grip";
      g.setAttribute("data-grip", FIRST);
      th.appendChild(g);
    }
    ensureFirstGrip();

    var lastTpl = null, lastSigCols = null;
    function applyCols(){
      /* Tables that render their own <thead> markup (brands-overview swaps between two different
         head layouts) throw the grip away on every render, so re-ensure it here instead of only
         once at construction. Idempotent: one querySelector when it is already there. */
      ensureFirstGrip();
      /* The grid template is rebuilt from the shown columns rather than just hiding cells: with
         CSS grid a hidden cell would leave its track behind and knock the whole row out of line.
         effectiveCols() and the container width are read ONCE up front and reused: every call
         measures layout, and interleaving those reads with the style writes below is a textbook
         read-write-read thrash — the thing that makes a resize drag feel like it is running at a
         fraction of the frame rate. */
      var cw = boxWidth();
      var cols = effectiveCols();
      var shown = {};
      cols.forEach(function(c){ shown[c.key] = true; });
      /* Bail out before touching the DOM when nothing about the layout actually changed. This is
         now the hot path: applyCols() runs on EVERY resize frame (it has to — column dropping is
         width-driven, not breakpoint-driven), and a 25-row table means ~200 style writes per
         frame. Most frames of a drag change no columns at all, so the signature check turns those
         into one rect read plus one querySelector. The per-row marker attribute is what makes it
         safe: a fresh renderTable() creates rows without it, so re-rendered rows always get the
         template written even when the signature itself is unchanged. */
      var sigCols = cols.map(function(c){ return c.key; }).join(",");
      var W = state.widths || {};
      var pinned = !!W[FIRST];
      var firstPx = W[FIRST];
      if (pinned){
        /* Once the lead column is pinned to a pixel width, every other track has to switch from
           its percentage minimum to its PIXEL minimum: the percentages are relative to the whole
           grid, not to the space left over, so keeping them made the tracks add up to more than
           the container and the table overflowed. Clamping against the available width stops a
           pinned lead column plus the other minimums from pushing Actions outside the box. */
        var othersMin = 0;
        cols.forEach(function(c){ othersMin += colMin(c.key); });
        if (!cfg.noActions && !root.classList.contains("is-t2")) othersMin += ACTIONS_MIN_F();
        if (cw) firstPx = Math.max(FIRST_MIN, Math.min(W[FIRST], cw - LEAD() - othersMin));
      }
      var lw = LEAD();
      var parts = lw ? [lw + "px"] : [];
      parts.push(pinned ? firstPx + "px" : "minmax(30%, 1.6fr)");
      cols.forEach(function(c){
        parts.push(pinned ? "minmax(" + colMin(c.key) + "px, 1fr)" : colTrack(c));
      });
      if (!cfg.noActions && !root.classList.contains("is-t2")){
        /* FESTE Spur, kein minmax(...,auto). `auto` heisst "so breit wie der Inhalt", und .up-thead
           und jede .up-row sind EIGENE Grid-Container: jeder loest sein `auto` aus dem eigenen
           Inhalt auf. Die Kopfzelle der Aktionsspalte ist leer, die Zellen darunter enthalten den
           Knopf -- die beiden Raster koennen damit gar nicht uebereinstimmen. Gemessen in
           discover-brands: Aktionsspur im Kopf 56px, in der Zeile 106px, und weil die Differenz
           sich auf die fr-Spuren verteilt, wanderten alle Kopfspalten nach rechts (bis 50px
           Versatz an der letzten). Den anderen Tabellen ist es nur nie aufgefallen, weil ihre
           Aktionszelle ein Icon-Knopf ist, der SCHMALER als actionsMin bleibt -- dort gewinnt
           ohnehin immer die Untergrenze, und beide Raster kommen zufaellig auf dieselbe Zahl.
           Fuer die faellt sich hier nichts, die Zahl ist dieselbe. */
        parts.push(ACTIONS_MIN_F() + "px");
      }
      var tpl = parts.join(" ");
      /* The track list goes on the ROOT as --up-cols; core.css has .up-thead/.up-row read it via
         var(). One style write instead of one per row — during a column drag that is the
         difference between ~100 writes per frame and 1, and it costs nothing to keep in sync
         because freshly rendered rows inherit it automatically. */
      if (tpl !== lastTpl){
        root.style.setProperty("--up-cols", tpl);
        lastTpl = tpl;
      }
      /* Per-cell show/hide has to touch cells, so it gets its own guard — but the guard CANNOT be
         "the column set is unchanged" alone. Hiding a cell is an inline style, and renderTable()
         replaces every .up-row with brand-new nodes that carry no inline styles at all. So after
         any re-render (sort, search, page, new data) the fresh rows show every cell again while
         --up-cols still lists only the visible tracks — the surplus cells then wrap onto a second
         implicit grid row, which is the "two rows rendered inside one row" breakage.
         Hence the stamp: rows carry the column signature they were styled for, and a row without
         the current one is by definition un-styled and needs the write. */
      /* Checking only the first .up-row in the root missed this: a partial DOM patch (prompts-table's
         grouped drilldown inserts fresh rows into ONE group's block via renderGroupBlockOnly, not a
         full renderTable()) can leave brand-new, un-stamped rows sitting AFTER an already-stamped row
         elsewhere in the same root. "First row is current" then wrongly implied every row was, so the
         new rows kept every cell visible while --up-cols had already dropped a track for them --
         exactly the wrap-onto-a-second-implicit-row breakage above, just on a delayed/intermittent
         trigger (only after some other row had already been stamped with the current signature). The
         query below finds ANY row missing the current signature, wherever it sits. */
      var rowsStale = !!root.querySelector('.up-row:not([data-up-colsig="' + sigCols + '"])');
      if (sigCols === lastSigCols && !rowsStale) return;
      lastSigCols = sigCols;
      COLUMNS.forEach(function(c){
        var sel = [];
        for (var p = 0; p < prefixes.length; p++){
          sel.push("." + prefixes[p] + "-th-" + c.key, "." + prefixes[p] + "-td-" + c.key);
        }
        Array.prototype.forEach.call(root.querySelectorAll(sel.join(", ")), function(el){
          el.style.display = shown[c.key] ? "" : "none";
        });
      });
      Array.prototype.forEach.call(root.querySelectorAll(".up-row"), function(r){
        r.setAttribute("data-up-colsig", sigCols);
      });
    }
    /* drag the lead column's right edge; everything else keeps its responsive track */
    function startResize(e){
      var thead = root.querySelector(".up-thead");
      if (!thead) return;
      var startX = e.clientX;
      var first = thead.children[LEAD() ? 1 : 0];
      if (!first) return;
      var wA = first.getBoundingClientRect().width;
      var total = thead.getBoundingClientRect().width;
      var others = layoutKeys().slice(1).reduce(function(sum, k){ return sum + colMin(k); }, 0);
      /* Has to subtract the same `reserve` fudge autoFit's own budget does (see autoFit above) —
         without it this let the drag go `reserve` px further than autoFit actually tolerates, so
         dragging the lead column anywhere near this max caused autoFit to drop the lowest-prio
         column mid-drag even though every other column was still sitting right at its own
         minimum. Two independently-computed "how far can the lead column grow" limits that
         disagreed by exactly one fudge factor. */
      var reserve = 24 + effectiveCols().length;
      var maxA = Math.max(FIRST_MIN, total - LEAD() - others - reserve);
      var grip = e.target.closest(".up-grip");
      if (grip) grip.classList.add("is-active");
      root.classList.add("is-resizing");
      /* pointermove fires up to 120 Hz on a trackpad — several times per frame — and each event
         used to run a full applyCols(). Coalesce to one apply per animation frame: the extra
         events carried no information the last one didn't already supersede. */
      var moveRaf = null, pendingX = null;
      function commitMove(){
        if (pendingX == null) return;
        state.widths[FIRST] = Math.round(Math.max(FIRST_MIN, Math.min(maxA, wA + (pendingX - startX))));
        applyCols();
      }
      function move(ev){
        pendingX = ev.clientX;
        if (moveRaf) return;
        moveRaf = requestAnimationFrame(function(){ moveRaf = null; commitMove(); });
      }
      function up(){
        /* Flush the last pointer position synchronously rather than dropping it — cancelling a
           pending frame without committing would leave the column a few px off wherever the user
           actually released. */
        if (moveRaf){ cancelAnimationFrame(moveRaf); moveRaf = null; commitMove(); }
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", up);
        root.classList.remove("is-resizing");
        if (grip) grip.classList.remove("is-active");
        writeWidths();
      }
      document.addEventListener("pointermove", move);
      document.addEventListener("pointerup", up);
      e.preventDefault();
    }
    /* Zwei Striche gegen drei -- geraeumig gegen dicht. Als <path> geschrieben wie sein
       Gegenstueck darunter: dieselbe Form zweimal verschieden zu notieren, laedt dazu ein, nur
       eine der beiden nachzuziehen. */
    var COMFY_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 8h16"/><path d="M4 16h16"/></svg>';
    var COMPACT_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 5h16"/><path d="M4 12h16"/><path d="M4 19h16"/></svg>';
    function populateCols(){
      var menu = root.querySelector(".up-cols-menu");
      if (!menu) return;   // a stale/incomplete root copy may be missing this markup
      var listed = COLUMNS.filter(function(c){ return !(cfg.isHidden && cfg.isHidden(c)); });
      var vis = visibleCols().filter(function(c){ return !(cfg.isHidden && cfg.isHidden(c)); });
      var off = listed.length - vis.length;
      var head = '<div class="up-pop-head up-pop-head-row">' +
        '<span>' + esc(t_("Columns")) + '</span>' +
        '<button class="up-pop-action' + (off >= 2 ? "" : " is-hidden") + '" type="button" data-colsall>' +
          esc(t_("Select all")) + '</button>' +
      '</div>';
      var rows = listed.map(function(c){
        var on = state.cols[c.key] !== false;
        var locked = on && vis.length === 1;   // the last visible column can't be turned off
        return '<div class="up-pop-row' + (locked ? " is-locked" : "") + '" data-col="' + c.key + '">' +
                 /* c.label kommt aus der Komponente. Uebersetzt wird HIER, damit die
                    Spaltenliste jeder Tabelle der App auf einmal mitgeht. */
                 '<span class="up-pop-label">' + esc(t_(c.label)) + '</span>' +
                 '<span class="up-switch' + (on ? " is-on" : "") + '" role="switch"></span>' +
               '</div>';
      }).join("");
      var densePart = cfg.dense
        ? '<div class="up-pop-div"></div>' +
          '<div class="up-pop-sub">' + esc(t_("Row height")) + '</div>' +
          '<div class="up-dense">' +
            '<button class="up-dense-btn' + (!state.dense ? " is-active" : "") + '" type="button" data-dense="0">' + COMFY_SVG + esc(t_("Comfortable")) + '</button>' +
            '<button class="up-dense-btn' + (state.dense ? " is-active" : "") + '" type="button" data-dense="1">' + COMPACT_SVG + esc(t_("Compact")) + '</button>' +
          '</div>'
        : "";
      /* cfg.rowHeightSwitch: [{key,label,icon}, ...] — a 3(+)-way row-height picker instead of
         the 2-way Comfortable/Compact above, for tables with a genuine third (e.g. dynamic)
         height mode. Wired against state.rowHeight (a string), not state.dense (a bool). Click
         handling stays local to the component, same as data-dense today. */
      var rowHeightPart = cfg.rowHeightSwitch
        ? '<div class="up-pop-div"></div>' +
          '<div class="up-pop-sub">' + esc(t_("Row height")) + '</div>' +
          '<div class="up-dense up-dense-3">' +
            cfg.rowHeightSwitch.map(function(o){
              return '<button class="up-dense-btn up-dense-btn-icon' + (state.rowHeight === o.key ? " is-active" : "") +
                     '" type="button" data-rowheight="' + o.key + '" data-tip="' + esc(t_(o.label)) + '">' + o.icon + '</button>';
            }).join("") +
          '</div>'
        : "";
      menu.innerHTML = head + rows + densePart + rowHeightPart;
    }
    function syncColsBadge(){
      var badge = cfg.badgeSel ? root.querySelector(cfg.badgeSel) : null;
      if (!badge) return;
      var all = COLUMNS.length, active = visibleCols().length;
      var show = all > 0 && active > 0 && active < all;
      badge.textContent = show ? String(active) : "";
      badge.classList.toggle("is-visible", show);
    }
    function refresh(){ writeCols(); populateCols(); applyCols(); syncColsBadge(); }
    function toggleCol(key){
      var on = state.cols[key] !== false;
      if (on && visibleCols().length === 1) return;   // never hide the last one
      state.cols[key] = !on;
      refresh();
      if (cfg.onChange) cfg.onChange();
    }
    function selectAllCols(){
      COLUMNS.forEach(function(c){ state.cols[c.key] = true; });
      refresh();
      if (cfg.onChange) cfg.onChange();
    }
    return {
      readCols: readCols, writeCols: writeCols, readWidths: readWidths, writeWidths: writeWidths,
      visibleCols: visibleCols, effectiveCols: effectiveCols, layoutKeys: layoutKeys, colMin: colMin,
      applyCols: applyCols, startResize: startResize, populateCols: populateCols,
      toggleCol: toggleCol, selectAllCols: selectAllCols, syncColsBadge: syncColsBadge
    };
  }

  /* ---------- makePager ----------
     cfg: { root, state, onChange } — onChange(reason) fires after page/size changes so the
     component can persist, re-render and tell Bubble. */
  function makePager(cfg){
    var root = cfg.root, state = cfg.state;
    var elFoot = root.querySelector(".up-foot");
    /* .up-foot is space-between by default (page size left, page nav right via margin-left:auto)
       — fine on one line, but once there's no room and it wraps to two lines that layout leaves
       each row hugging its own edge instead of reading as one centred block. Detected by
       comparing the two groups' own top offsets (same top -> one line, different top -> wrapped)
       rather than a fixed width breakpoint, because what wraps depends on how many page-number
       buttons are actually showing, not just the container's width. Shared here so it applies to
       every table that uses this pager, not just whichever one asked for it first. */
    function syncFootWrap(){
      if (!elFoot) return;
      var pagesize = elFoot.querySelector(".up-pagesize");
      var pager = elFoot.querySelector(".up-pager");
      if (!pagesize || !pager) return;
      /* Self-locking bug: .is-wrapped forces both children to flex:1 1 100%, which by itself
         puts them on two separate lines — so once this class is set (even wrongly, e.g. from a
         transient skeleton-width measurement before real data settled), every future measurement
         "confirms" wrapped is still true regardless of how much room is actually available, and
         the footer can never recover back to one line even at full desktop width. Dropping the
         class before measuring forces a synchronous reflow back to natural (non-forced-100%)
         widths, so the check reflects whether the content genuinely needs two lines right now. */
      elFoot.classList.remove("is-wrapped");
      var wrapped = Math.round(pagesize.getBoundingClientRect().top) !== Math.round(pager.getBoundingClientRect().top);
      elFoot.classList.toggle("is-wrapped", wrapped);
    }
    if (elFoot && window.ResizeObserver){
      var footRaf = null;
      new ResizeObserver(function(){
        if (footRaf) return;
        footRaf = requestAnimationFrame(function(){ footRaf = null; syncFootWrap(); });
      }).observe(elFoot);
    }
    /* state.totalCount is the generic field every table using this pager has — prompts-table is
       the one exception with a second, status-scoped total (state.totalCountInactive). cfg.total()
       lets it hand over "whichever total actually applies right now" without this shared kit
       having to know that field exists; every other table just doesn't pass it and keeps reading
       state.totalCount directly. */
    function totalOf(){ return cfg.total ? toNum(cfg.total()) : toNum(state.totalCount); }
    function pageCount(){
      var t = totalOf();
      if (t == null || t <= 0) return 1;
      return Math.max(1, Math.ceil(t / state.pageSize));
    }
    function offset(){ return (state.page - 1) * state.pageSize; }
    /* 1 … 4 5 6 … 12 — always the ends, a window around the current page, gaps elsewhere */
    function pageWindow(cur, total){
      if (total <= 7){
        var all = [];
        for (var i = 1; i <= total; i++) all.push(i);
        return all;
      }
      var out = [1];
      var from = Math.max(2, cur - 1), to = Math.min(total - 1, cur + 1);
      if (from > 2) out.push("gap");
      for (var p = from; p <= to; p++) out.push(p);
      if (to < total - 1) out.push("gap");
      out.push(total);
      return out;
    }
    function renderPager(){
      /* elFoot.querySelector, NOT root.querySelector: prompts-table's grouped drilldown builds
         its OWN pager with the identical class ".up-pager" (see grpFootHtml() there), nested
         inside the currently-open group's block -- which sits earlier in the DOM than .up-foot.
         root.querySelector(".up-pager") returns the FIRST match in document order, so while a
         group was open this silently found and overwrote the GROUP's own pager with the FLAT
         table's page/total instead (found live: the group's pagination showed the flat table's
         page-size options and "of <overall total>", not its own). Scoping to elFoot is the fix --
         this kit only ever owns the ONE pager inside its own .up-foot, never anyone else's. */
      var el = elFoot ? elFoot.querySelector(".up-pager") : null;
      if (!el) return;
      var total = pageCount();
      var cur = Math.min(state.page, total);
      if (cur !== state.page){ state.page = cur; if (cfg.onClamp) cfg.onClamp(); }
      var t = totalOf();
      var info = "";
      if (t != null && t > 0){
        var from = offset() + 1;
        var to = Math.min(offset() + state.pageSize, t);
        /* "1-2 of 2" wird GEBAUT, also braucht der Satz Platzhalter -- im Deutschen steht "von"
           an derselben Stelle, aber das ist Zufall und gilt nicht fuer jede Sprache. */
        info = '<span class="up-pager-info">' +
          esc(t_("{from}–{to} of {total}")
                .replace("{from}", fmtInt(from)).replace("{to}", fmtInt(to))
                .replace("{total}", fmtTotal(t))) + '</span>';
      }
      var pages = pageWindow(cur, total).map(function(p){
        if (p === "gap") return '<span class="up-page-gap">…</span>';
        return '<button class="up-page' + (p === cur ? " is-active" : "") + '" type="button" data-page="' + p + '">' + p + '</button>';
      }).join("");
      el.innerHTML = info +
        '<button class="up-page up-page-prev" type="button" aria-label="Previous page"' + (cur <= 1 ? " disabled" : "") + '>' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6" /></svg></button>' +
        pages +
        '<button class="up-page up-page-next" type="button" aria-label="Next page"' + (cur >= total ? " disabled" : "") + '>' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6" /></svg></button>';
      syncFootWrap();   // page count just changed -> the row may have gained/lost a line
    }
    /* cfg.pageSizes: optional fn returning the size list for THIS render — lets a component run
       different page-size sets depending on its own state (e.g. a table/cards view switch with
       differently-sized grids per mode), without this shared kit knowing why. Omitted by every
       existing caller, which keeps reading the plain module-level PAGE_SIZES exactly as before —
       purely additive, no behavior change for urls-table/domains-table/prompts-table. */
    function sizesOf(){ return cfg.pageSizes ? cfg.pageSizes() : PAGE_SIZES; }
    function renderPageSize(){
      /* .up-pagesize-seg, NOT .up-pagesize: the outer element also holds the "Rows per page"
         label, and the grey switcher background lives on the -seg wrapper. Writing into the outer
         one wiped both.
         elFoot.querySelector, NOT root.querySelector: same reasoning as renderPager() above --
         prompts-table's grouped drilldown has its own identically-classed .up-pagesize-seg (see
         grpFootHtml()), and an unscoped query silently overwrote THAT one with the flat table's
         page-size options while a group was open. */
      var el = elFoot ? elFoot.querySelector(".up-pagesize-seg") : null;
      if (!el) return;
      el.innerHTML = sizesOf().map(function(n){
        return '<button class="up-pagesize-btn' + (n === state.pageSize ? " is-active" : "") +
               '" type="button" data-pagesize="' + n + '">' + n + '</button>';
      }).join("");
      syncFootWrap();
    }
    function goToPage(p){
      var total = pageCount();
      p = Math.max(1, Math.min(total, p));
      if (p === state.page) return;
      state.page = p;
      state.loading = true;   // show a skeleton until the new page's rows arrive
      renderPageSize(); renderPager();
      if (cfg.onChange) cfg.onChange("page");
    }
    function setPageSize(n){
      if (n === state.pageSize) return;
      state.pageSize = n;
      state.page = 1;          // a different window size invalidates the current page index
      state.loading = true;    // show a skeleton until the resized page arrives
      renderPageSize(); renderPager();
      if (cfg.onChange) cfg.onChange("size");
    }
    return { pageCount: pageCount, offset: offset, pageWindow: pageWindow,
             renderPager: renderPager, renderPageSize: renderPageSize,
             goToPage: goToPage, setPageSize: setPageSize };
  }

  /* ---------- makeSoftReload ----------
     Sort re-orders the SAME result set — the rows on screen are still truthful, so a sort dims
     them in place instead of blanking to a skeleton (which reads as "the table broke" on every
     header click). Started here first for prompts-table, now shared once urls-table and
     domains-table needed the identical thing for their own sort.
     Deliberately driven by explicit begin()/end() calls at the exact user-action moment rather
     than derived from a loading flag: the derivation was the original bug — whether a loading
     flag is ever set depends on how the Bubble workflow is wired, and any render() call arriving
     in between resets whatever the derivation depended on, so the dim silently never appeared.
     cfg: { delay (ms before it shows, default 0), killAfter (hard timeout, default 20000) } */
  function makeSoftReload(root, cfg){
    cfg = cfg || {};
    var delay = cfg.delay != null ? cfg.delay : 0;
    var killAfter = cfg.killAfter != null ? cfg.killAfter : 20000;
    var dimTimer = null, dimKill = null;
    function begin(hasContent){
      clearTimeout(dimTimer); clearTimeout(dimKill);
      if (!hasContent) return;   // nothing on screen to dim
      if (delay <= 0) root.classList.add("is-reloading");
      else dimTimer = setTimeout(function(){ dimTimer = null; root.classList.add("is-reloading"); }, delay);
      /* Never let it stick: if the answer never arrives, a permanently greyed-out table is worse
         than no feedback at all. */
      dimKill = setTimeout(end, killAfter);
    }
    function end(){
      clearTimeout(dimTimer); clearTimeout(dimKill);
      dimTimer = dimKill = null;
      root.classList.remove("is-reloading");
    }
    return { begin: begin, end: end };
  }

  /* ---------- makeHeadSort ----------
     Clicking a column header walks that column's cycle (e.g. share:desc -> share:asc ->
     share_trend:desc …) and falls back to the table's default once the cycle is exhausted.
     cfg: { root, state, cycles, defaultSort, trendField, onSort } */
  function makeHeadSort(cfg){
    var root = cfg.root, state = cfg.state;
    var TREND = cfg.trendField || null;   // a second sort key that shares the Share column
    function syncHeadSorters(){
      Array.prototype.forEach.call(root.querySelectorAll(".up-thsort"), function(el){
        var col = el.getAttribute("data-for");
        el.classList.remove("is-asc","is-desc");
        /* the Share header lights up for its trend key too — they share one column */
        var owns = (TREND && col === "share")
          ? (state.sortField === "share" || state.sortField === TREND)
          : (state.sortField === col);
        if (owns) el.classList.add(state.sortDir === "asc" ? "is-asc" : "is-desc");
        var th = el.closest(".up-th");
        if (th) th.setAttribute("aria-sort", owns ? (state.sortDir === "asc" ? "ascending" : "descending") : "none");
      });
      if (!TREND) return;
      /* show "Trend" next to the Share label while the trend key is the active sort */
      var shareTh = root.querySelector(".up-th-share");
      if (!shareTh) return;
      var sub = shareTh.querySelector(".up-th-sub");
      if (state.sortField === TREND){
        if (!sub){
          sub = document.createElement("span");
          sub.className = "up-th-sub";
          sub.textContent = "Trend";
          shareTh.insertBefore(sub, shareTh.querySelector(".up-thsort"));
        }
      } else if (sub && sub.parentNode){ sub.parentNode.removeChild(sub); }
    }
    function headSortClick(col){
      var cycle = cfg.cycles[col];
      if (!cycle) return;
      var idx = cycle.indexOf(state.sortField + ":" + state.sortDir);   // -1 = another column owns the sort
      var pos = idx + 1;                                                // -1 -> 0: start this cycle at the top
      if (pos >= cycle.length){                                         // past the end -> back to the default
        cfg.onSort(cfg.defaultSort.field, cfg.defaultSort.dir);
        return;
      }
      var parts = cycle[pos].split(":");
      cfg.onSort(parts[0], parts[1]);
    }
    return { syncHeadSorters: syncHeadSorters, headSortClick: headSortClick };
  }

  /* Clipboard fallback for browsers/iframes where navigator.clipboard is unavailable. */
  function legacyCopy(text){
    try {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      return true;
    } catch(e){ return false; }
  }

  /* ---------- makeSearch ----------
     The slide-out search in the toolbar. urls-table and domains-table carried copies that were
     identical apart from comments, so there is nothing component-specific left here except the
     wiring: which elements, what to re-render, and what to send.

     cfg: { root, box, input, state, minChars, debounceMs, mobileMax, prefix,
            onRender(), onFire(payload), onTakeoverEnd(), persist() }
     Returns { toggle, run, onInput, syncTakeover, latestReqId(), setLatest(id) }.
     latestReqId is exposed because the component's update() drops responses whose requestId is
     not the newest one — that guard is what stops a slow early query from overwriting a fast
     later one. */
  function makeSearch(cfg){
    var root = cfg.root, box = cfg.box, input = cfg.input, state = cfg.state;
    var MINC = cfg.minChars != null ? cfg.minChars : MIN;
    var DEB = cfg.debounceMs != null ? cfg.debounceMs : DEBOUNCE;
    var MOBILE_MAX = cfg.mobileMax || 640;
    var debTimer = null, latestReqId = null;

    function newReqId(){ return cfg.prefix + "_" + (+new Date()) + "_" + Math.random().toString(36).slice(2,8); }
    function run(){
      var reqId = newReqId(); latestReqId = reqId;
      state.page = 1;                 // a new query is a new result set
      state.loading = true;
      if (cfg.onRender) cfg.onRender();
      cfg.onFire({
        query: state.query,
        query_folded: foldDiacritics(state.query),
        query_de: germanExpand(state.query),
        requestId: reqId
      });
    }
    function onInput(){
      state.query = String(input.value || "").trim();
      box.classList.toggle("has-text", !!input.value.length);
      if (cfg.persist) cfg.persist();
      clearTimeout(debTimer);
      /* Below the minimum an EMPTY query still has to go out — that is how the table gets its
         unfiltered list back once the user clears the box. */
      if (state.query.length && state.query.length < MINC){ latestReqId = null; return; }
      debTimer = setTimeout(run, DEB);
    }
    function toggle(){
      var open = !box.classList.contains("is-open");
      box.classList.toggle("is-open", open);
      syncTakeover();   // mobile: take over the row when opening, release it when closing
      /* Deliberately no toolbar re-fit here: the open search's width is already reserved by the
         component's own gap calculation, so the tier decision is the same open or closed.
         Re-measuring mid-transition would read too much room and wrongly un-hide toolbar items. */
      if (open){ setTimeout(function(){ try { input.focus(); } catch(e){} }, 60); }
      else if (state.query){
        state.query = ""; input.value = "";       // closing clears the search
        box.classList.remove("has-text");
        if (cfg.persist) cfg.persist();
        clearTimeout(debTimer);
        run();
      }
    }
    /* On a narrow component an open search takes over the whole toolbar row. */
    function syncTakeover(){
      var w = root.getBoundingClientRect().width || 0;
      var on = !!box && box.classList.contains("is-open") && w > 0 && w < MOBILE_MAX;
      if (on === root.classList.contains("is-searchtakeover")) return;
      root.classList.toggle("is-searchtakeover", on);
      if (!on && cfg.onTakeoverEnd) cfg.onTakeoverEnd();
    }
    return {
      toggle: toggle, run: run, onInput: onInput, syncTakeover: syncTakeover,
      latestReqId: function(){ return latestReqId; },
      setLatest: function(id){ latestReqId = id; },
      cancel: function(){ clearTimeout(debTimer); }
    };
  }

  /* ==========================================================================================
     MOUNT — the Bubble plumbing every component needs
     ==========================================================================================
     Each component carried ~200 lines of this: the boot retry, the stub queue, the root registry,
     the iframe forwarder, the wheel forwarding and the init cascade. None of it is about what the
     component DOES; all of it is about surviving how Bubble injects and re-renders markup.

     Deliberately NOT included: doRender / doLoading / initRoot. Those genuinely differ — some
     components broadcast an update to every root sharing an instanceId, topcitations resolves the
     single visible one. That is a real decision per component, not drift, so it stays local.

     Usage is two calls. Before anything else, while core.js may still be loading:
       UC.bootStubs({ names: ["renderFoo","setFooLoading","resetFoo"], flag: "__fooBootStubbed",
                      queue: "__fooBootQueue" });
     then, once the component's own run() executes:
       var mount = UC.makeMount({ rootClass:"foo-root", ctrlProp:"__fooController",
                                  resolveLocal:"__fooResolveLocal", initRoot:initRoot,
                                  api:{ renderFoo:doRender, setFooLoading:doLoading },
                                  queue:"__fooBootQueue" }); */
  function bootStubs(cfg){
    var q = window[cfg.queue] = window[cfg.queue] || [];
    if (window[cfg.flag]) return q;
    window[cfg.flag] = true;
    /* Bubble's "Run Javascript" steps poll for these by name and call whichever is callable
       first. Without stubs a "data has arrived" call could beat a "start loading" call issued
       earlier, because each poll wins independently. Queuing here keeps Bubble's original order. */
    cfg.names.forEach(function(n){
      window[n] = function(){ q.push([n, arguments]); };
    });
    return q;
  }

  /* ---- Aufrufe an eine Komponente, die es (noch) nicht gibt ---------------------------------
     Der Fehler, den das behebt: jede Komponente beantwortet einen Setter mit
     "kein Root mit dieser id -> return false". Der Aufruf ist damit WEG. Auf einer Bubble-Seite
     ist das kein Ausnahmefall: das Element wird zwischen zwei Renderdurchlaeufen neu gebaut, und
     der Workflow feuert genau in dieses Fenster. Sichtbar wird das als Komponente, die ewig im
     Skelett steht -- gemeldet fuer brand-detail, und "haeufiger, wenn die Konsole offen ist",
     was genau zu einem Zeitfenster passt, das unter Last groesser wird.

     Die drei Filter hatten dafuer laengst je eine eigene Kopie (PENDING). Hier steht sie einmal,
     mit zwei Unterschieden zu jenen Kopien:
       - eine LISTE je id statt eines einzelnen Eintrags. Bei brand-detail treffen vier Setter
         nacheinander ein; mit einem Platz je id ueberschrieben sie sich gegenseitig.
       - ein Verfallsdatum. Eine id, die nie erscheint (Tippfehler im Workflow, geloeschtes
         Element), haelt sonst ihre Aufrufe fuer immer fest und meldet nie, dass etwas fehlt.

     Benutzung:
       var spaet = UC.makeLate("brand-detail", ".ubd-root");
       ... im Setter, wenn nichts passt:  spaet.park(id, function(ctrl){ ... });
       ... am Ende von initRoot:          spaet.drain(instanceId, ctrl);
     Der Abgleich der id ist derselbe wie in den Filtern: exakt oder als Praefix. */
  var LATE_TTL_MS = 60000;
  /* ---- Verweildauer auf einer Zeile ---------------------------------------------------------
     Setzt cls auf die Zeile, ueber der der Zeiger ms lang steht, und nimmt sie beim Verlassen
     wieder weg. Damit wird aus einem Hover ein "und zwar wirklich diese Zeile" -- CSS kann das
     ohne Keyframes an einer festen Gesamtdauer nicht ausdruecken.
     Stand in domains-table; brands-overview braucht dieselbe Uhr fuer seinen Edit-Knopf. */
  function rowDwell(root, cls, ms, rowSel){
    if (!root || root.__upDwell) return;
    root.__upDwell = true;
    var sel = rowSel || ".up-row", uhr = null, zeile = null;
    root.addEventListener("mouseover", function(e){
      if (!e.target.closest) return;
      var r = e.target.closest(sel);
      /* Skelettzeilen nicht: dort gibt es nichts zu bedienen. */
      if (!r || !root.contains(r) || r.classList.contains("up-tsk")) return;
      if (r === zeile) return;
      if (zeile) zeile.classList.remove(cls);
      zeile = r;
      clearTimeout(uhr);
      uhr = setTimeout(function(){ r.classList.add(cls); }, ms == null ? 1000 : ms);
    });
    root.addEventListener("mouseout", function(e){
      if (!e.target.closest) return;
      var r = e.target.closest(sel);
      if (!r || r !== zeile) return;
      var zu = e.relatedTarget;
      if (zu && zu.closest && zu.closest(sel) === r) return;   /* nur zu einem Kind gewandert */
      zeile = null; clearTimeout(uhr);
      r.classList.remove(cls);
    });
  }

  /* Steht das Element ueberhaupt auf dem Schirm? Bubble haelt die Elemente ALLER Seiten im
     Dokument und blendet die inaktiven nur aus -- eine Komponente im DOM heisst also nicht, dass
     jemand auf ihre Daten wartet. Wer das verwechselt, laesst Warte-Uhren fuer Seiten ablaufen,
     die gar nicht offen sind: gemeldet am 24.08., weil response-detail und domain-detail im
     SELBEN Pageload meldeten -- auf beiden Seiten zugleich kann niemand sein.
     getClientRects() ist der Test dafuer: bei display:none am Element ODER an einem Vorfahren
     kommt eine leere Liste zurueck. Kennt ein Browser die Methode nicht, gilt sichtbar -- lieber
     einmal zu viel gemeldet als eine echte Fehlmeldung verschluckt. */
  function istSichtbar(el){
    if (!el || !el.getClientRects) return true;
    return el.getClientRects().length > 0;
  }

  function makeLate(name, rootSel){
    var wartend = {};
    function park(id, fn){
      id = String(id == null ? "" : id).trim();
      if (!id) return false;
      var l = wartend[id] || (wartend[id] = []);
      l.push({ fn: fn, seit: nowMs() });
      if (window.console){
        var da = rootSel ? document.querySelectorAll(rootSel) : [];
        var ids = [];
        for (var i = 0; i < da.length; i++) ids.push(da[i].getAttribute("data-instance") || "(ohne data-instance)");
        console.warn("[" + name + "] \"" + id + "\" ist noch nicht da -- der Aufruf wartet und " +
          "laeuft, sobald die Komponente erscheint. Im Dokument: " + da.length +
          (ids.length ? " (" + ids.join(", ") + ")" : ""));
      }
      return true;
    }
    /* Beim Mount aufrufen: alles ausfuehren, was auf genau diese id (oder ihren Praefix) wartet. */
    function drain(id, ctrl){
      id = String(id == null ? "" : id).trim();
      var jetzt = nowMs();
      for (var pid in wartend){
        if (!Object.prototype.hasOwnProperty.call(wartend, pid)) continue;
        var liste = wartend[pid];
        /* Zu alt: verfallen lassen und EINMAL sagen, dass etwas verloren ging -- stilles
           Verschwinden ist genau das, was hier nicht mehr passieren soll. */
        var frisch = liste.filter(function(e){ return jetzt - e.seit < LATE_TTL_MS; });
        if (frisch.length !== liste.length && window.console){
          console.warn("[" + name + "] " + (liste.length - frisch.length) + " wartende(r) Aufruf(e) " +
            "fuer \"" + pid + "\" sind verfallen -- diese Instanz ist nie erschienen.");
        }
        if (!frisch.length){ delete wartend[pid]; continue; }
        /* "default" ist der Rueckfall der Setter-APIs fuer "ohne id" -- und der meint: die
           Komponente, die da ist. Also passt er auf jede Instanz. */
        if (pid !== "default" && id !== pid && id.indexOf(pid) !== 0){ wartend[pid] = frisch; continue; }
        delete wartend[pid];
        frisch.forEach(function(e){
          try { e.fn(ctrl); }
          catch(err){ if (window.console) console.error("[" + name + "] wartender Aufruf fuer \"" +
            pid + "\" ist gescheitert:", err); }
        });
      }
    }
    function offen(){ var n = 0; for (var k in wartend) if (Object.prototype.hasOwnProperty.call(wartend, k)) n += wartend[k].length; return n; }
    return { park: park, drain: drain, offen: offen };
  }

  function makeMount(cfg){
    var rootSel = "." + cfg.rootClass + (cfg.notPortal ? ":not(.up-portal)" : "");

    function roots(){ return document.querySelectorAll(rootSel); }
    function rootsWithId(id){
      id = id || "default";
      var out = [], all = roots();
      for (var i = 0; i < all.length; i++){
        if ((all[i].getAttribute("data-instance") || "default") === id) out.push(all[i]);
      }
      return out;
    }
    function initAll(){ var all = roots(); for (var i = 0; i < all.length; i++) cfg.initRoot(all[i]); }

    /* ---- Neuzeichnen, wenn der Nutzer sein Zahlen- oder Datumsformat aendert ----
       cfg.redraw ist eine Funktion, die die Komponente AUS IHREM VORHANDENEN ZUSTAND neu zeichnet.
       Sie ist freiwillig: eine Komponente ohne sie zeigt das neue Format beim naechsten Zeichnen,
       eine mit ihr sofort.
       Warum nicht einfach ctrl.render() rufen: dessen Form ist je Komponente verschieden -- in
       teams.js und team-orga.js nimmt render(p) die NUTZLAST entgegen, ein Aufruf ohne Argument
       wuerde die Daten loeschen. Ein eigener, gleich benannter Weg ist die einzige Art, das von
       aussen sicher zu tun. */
    if (typeof cfg.redraw === "function"){
      window.addEventListener("up-prefs-change", function(){
        var all = roots();
        for (var i = 0; i < all.length; i++){
          var c = cfg.ctrlProp ? all[i][cfg.ctrlProp] : null;
          if (!c) continue;
          try { cfg.redraw(c, all[i]); } catch(e){}
        }
      });
    }

    /* Expose the real implementations, then replay whatever Bubble queued against the stubs —
       in the order Bubble called them. */
    /* normParams sits on BOTH install paths, and it has to: this local install and the
       parent/top forwarder further down are alternatives, not a chain -- whichever runs last owns
       window[name]. Putting the repair only on the forwarder (the first attempt at this fix) meant
       it never ran on a normal single-window page, which is every page that was actually broken. */
    Object.keys(cfg.api).forEach(function(name){
      var impl = cfg.api[name];
      if ((cfg.forwardShape && cfg.forwardShape[name]) !== "params"){ window[name] = impl; return; }
      window[name] = function(params){ return impl(normParams(params, cfg.rootClass)); };
    });
    /* Nur setzen, wenn ein Name da ist. Ohne cfg.resolveLocal war das window[undefined] -- und
       window.undefined ist unbeschreibbar, der TypeError riss makeMount MITTEN im Aufbau ab.
       Die Komponente mountete dann nie, ohne dass die Meldung darauf hinwies. */
    if (cfg.resolveLocal) {
      window[cfg.resolveLocal] = function(id){ return rootsWithId(id).length > 0; };
    }
    /* cfg.onMount — hand the mount object to the component BEFORE the replay below.
       Every component writes `var mount = UC.makeMount({...})` and reads `mount.rootsWithId(...)`
       inside the very api functions passed in here. The replay runs while makeMount is still
       constructing, i.e. while that assignment has not happened yet, so a queued first render read
       `mount` as undefined, threw, and the catch below swallowed it — Bubble's first render was
       silently dropped and the component just stayed empty. Passing the object through a callback
       keeps the replay fully synchronous (deferring it to a timeout would let a direct render that
       arrives later in the same tick be overwritten by the older queued one). */
    var self = { roots: roots, rootsWithId: rootsWithId, initAll: initAll };
    if (typeof cfg.onMount === "function") cfg.onMount(self);
    var q = window[cfg.queue];
    if (q && q.length){
      q.splice(0, q.length).forEach(function(entry){
        try { window[entry[0]].apply(null, entry[1]); }
        catch(e){ if (window.console) console.error("[upstreem] queued " + entry[0] + " failed:", e); }
      });
    }

    /* ---- forwarder on parent AND top ----
       A component often lives inside a Bubble reusable, i.e. its own iframe, while the workflow
       calling render* runs in the parent page. Walk every reachable frame and hand the call to
       whichever one actually owns that instanceId; fall back to any frame that has the function
       so a mismatched id still lands somewhere rather than silently doing nothing. */
    (function exposeUpward(){
      var targets = [];
      try { if (window.parent && window.parent !== window) targets.push(window.parent); } catch(e){}
      try { if (window.top && window.top !== window && targets.indexOf(window.top) === -1) targets.push(window.top); } catch(e){}
      if (!targets.length) return;
      /* arg3 exists because a setter can genuinely need three: setPromptsTableGroupPrompts takes
         (id, rows, requestId), and dropping the request id across a frame boundary silently
         re-enabled the stale-response bug the id is there to prevent. */
      function makeDeliver(w){
        return function(fnName, id, arg1, arg2, arg3){
          var queue = [w], seen = [];
          while (queue.length){
            var win = queue.shift(), ifr;
            try { ifr = win.document.querySelectorAll("iframe"); } catch(e){ continue; }
            for (var i = 0; i < ifr.length; i++){
              var cw; try { cw = ifr[i].contentWindow; } catch(e){ cw = null; }
              if (!cw || seen.indexOf(cw) !== -1) continue;
              seen.push(cw); queue.push(cw);
            }
          }
          var delivered = false;
          for (var a = 0; a < seen.length; a++){
            try {
              var c = seen[a];
              if (c && typeof c[fnName] === "function" && c[cfg.resolveLocal] && c[cfg.resolveLocal](id)){
                c[fnName](arg1, arg2, arg3); delivered = true;
              }
            } catch(e){}
          }
          if (delivered) return true;
          for (var b = 0; b < seen.length; b++){
            try { var c2 = seen[b]; if (c2 && typeof c2[fnName] === "function") return c2[fnName](arg1, arg2, arg3); } catch(e){}
          }
          return false;
        };
      }
      for (var t = 0; t < targets.length; t++){
        (function(w){
          try {
            var deliver = makeDeliver(w);
            Object.keys(cfg.api).forEach(function(name){
              var shape = cfg.forwardShape && cfg.forwardShape[name];
              if (shape === "params"){
                w[name] = function(params){ params = normParams(params, cfg.rootClass) || {}; return deliver(name, params.instanceId || "default", params); };
              } else if (shape === "id"){
                w[name] = function(id){ return deliver(name, id || "default", id); };
              } else {
                w[name] = function(id, v, v2){ return deliver(name, id || "default", id, v, v2); };
              }
            });
          } catch(e){}
        })(targets[t]);
      }
    })();

    /* ---- wheel forwarding: ENTFERNT (und darf nicht zurückkommen) ----
       Hier stand ein `cfg.wheelSel`, das einen `wheel`-Listener anhängte, `preventDefault()` rief
       und Scrollen von Hand nachbaute (`scrollTarget(e.target).scrollTop += e.deltaY`). Es war eine
       Krücke um ein CSS-Problem herum, das jetzt an der Wurzel behoben ist (siehe STYLEGUIDE §38):
       fremdes Seiten-CSS legte `overscroll-behavior: contain` per `*` auf alles, wodurch jedes
       Element mit `overflow:hidden` (also auch reine Optik-Container wie `.tcd-box`) das
       Scroll-Chaining zur Seite blockierte. core.css stellt für `.up-root` jetzt wieder
       `overscroll-behavior: auto` her — damit funktioniert natives Scrollen überall von selbst.
       Der Preis der Krücke war real: `preventDefault` + synchroner `scrollTop`-Schreibzugriff heißt
       kein Compositor-Scrolling, keine Trägheit, kein Rubber-Banding — genau das "fühlt sich weird
       an, kein iOS-Bounce" auf den Chart-Flächen.
       Die Begründung im alten Kommentar ("Chart.js sets touch-action:none on its canvas") ist
       übrigens auf Chart.js 4 messbar falsch: das Canvas hat `touch-action: auto`, das Wheel-Event
       blubbert normal bis window, nichts ruft preventDefault. Falls ein Chart doch mal echt den
       Wheel abfängt (`chartjs-plugin-zoom` tut das), gehört das in dessen eigene Config — nicht in
       einen globalen handgeschriebenen Scroller. */

    /* ---- init cascade ----
       Bubble can insert the markup well after this script runs, and again on every re-render.
       watchRoots covers the long tail; the short cascade catches the common early cases, and the
       pointerdown fallback rescues a root that somehow escaped both the moment it is touched. */
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initAll);
    else initAll();
    [30, 100, 250, 500, 1000, 1800].forEach(function(ms){ setTimeout(initAll, ms); });
    document.addEventListener("pointerdown", function(e){
      var r = e.target && e.target.closest ? e.target.closest(rootSel) : null;
      if (r && !r[cfg.ctrlProp]) cfg.initRoot(r);
    }, true);
    if (watchRoots) watchRoots(cfg.rootClass, initAll);

    return self;
  }

  /* Survives Bubble rebuilding the element, keyed by instanceId. */
  var STORE = (window.__uutStore = window.__uutStore || {});
  var LOADING_EXPLICIT = (window.__uutLoadingExplicit = window.__uutLoadingExplicit || {});

  /* Shared button/brand tooltip — the ONE implementation for the whole library.
     Before this, four near-identical copies existed (.up-tip here, plus .vot-tip, .tcd-tip and
     .cc-tip inside three components). They drifted: the multi-instance fix landed in two of them,
     the hover delay in three, the mousemove safety net in two. This is the union of all four.

     The element AND its state live on window, not per root. That is the actual multi-instance
     fix: every root binds to the same singleton chip, so per-root state meant an idle second
     instance — whose own btn is almost always null — kept winning the mousemove/scroll safety-net
     race and hid the tooltip out from under whichever instance you were really hovering. That
     read as "tooltips barely ever show, they bug out."

     getIsDark() is only the fallback: the theme is read from the hovered button's own .up-root
     first, so two roots on one page in different themes each get the right chip.
     Signature and return shape are unchanged, so existing call sites keep working as-is. */
  /* Das Filter-/Fader-Zeichen der App. Komponenten mit einem Filter-Trigger sollen es aus dem
     JS in den Knopf SCHREIBEN und sich nicht auf das Markup verlassen: der CDN-Pin liefert
     JS/CSS, das Bubble-Markup ist eine handgemachte Kopie -- ein Icon, das nur im Markup steht,
     bleibt stumm auf dem Stand, den jemand zuletzt eingefuegt hat.
     Lucide settings-2 (zwei Regler mit Knoepfen) statt sliders-vertical: die neun Striche des
     Faders wirkten bei 15px wie ein Gitter. */
  var SLIDERS_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 17H5"/><path d="M19 7h-9"/><circle cx="17" cy="17" r="3"/><circle cx="7" cy="7" r="3"/></svg>';

  /* ---- Icon-Knoepfe der Tabellen-Toolbar ----------------------------------------------------
     Sorter, Tabelleneinstellungen und Fader sitzen als Markup IM Bubble-Element. Der CDN-Pin
     liefert JS und CSS, das Markup ist eine handgemachte Kopie -- ein Icon, das nur dort steht,
     bleibt fuer immer auf dem Stand, den jemand zuletzt eingefuegt hat. Deshalb schreibt core sie
     zur LAUFZEIT hinein, wie SLIDERS_ICON es fuer den Fader schon vorgemacht hat.
     Der Gruppierungsknopf (.upt-group-btn) ist ausdruecklich NICHT dabei: sein Zeichen bleibt.
     data-up-ic merkt sich, was schon steht -- ohne die Marke schriebe jeder Durchlauf erneut. */
  /* Zwei Formen werden an zwei Stellen gebraucht: hier beim Stempeln ins fremde Markup und
     unten in ICON_PATHS fuer UC.icon. Deshalb stehen sie als Konstante -- zwei Kopien liefen
     auseinander, sobald eine davon nachgezogen wird. */
  var PFAD_SORT = '<path d="m3 16 4 4 4-4"/><path d="M7 20V4"/><path d="m21 8-4-4-4 4"/><path d="M17 4v16"/>';
  var PFAD_SCAN = '<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/>' +
                  '<path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/>' +
                  '<circle cx="12" cy="12" r="3"/><path d="m16 16-1.9-1.9"/>';
  /* text-search: Prompt Research, in der Leiste und als grosses Zeichen auf der Seite. */
  var PFAD_SQDASH = '<path d="M21 5H3"/><path d="M10 12H3"/><path d="M10 19H3"/>' +
                    '<circle cx="17" cy="15" r="3"/><path d="m21 19-1.9-1.9"/>';
  var TOOLBAR_ICONS = {
    /* Sortieren: arrow-down-up. Vorher stand hier der Trichter mit drei Linien -- der ist die
       Filterform und stand am Sortierknopf falsch. */
    "up-sort-btn":  PFAD_SORT,
    /* Tabelleneinstellungen: Lucide settings. Das alte Zahnrad war das von Feather, mit mehr
       Zacken -- daran hat man den Unterschied gesehen. */
    "up-cols-btn":  '<path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/><circle cx="12" cy="12" r="3"/>',
    /* Fader: settings-2, zwei Regler mit Knoepfen. */
    "urt-fader-btn":'<path d="M14 17H5"/><path d="M19 7h-9"/><circle cx="17" cy="17" r="3"/><circle cx="7" cy="7" r="3"/>',
    /* Suche und Schliessen im Suchfeld -- dieselbe Begruendung, dieselbe Stelle. */
    "up-search-btn":'<path d="m21 21-4.34-4.34"/><circle cx="11" cy="11" r="8"/>',
    "up-search-clear":'<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'
  };
  /* Dieselben drei Formen tragen in den anderen Komponenten eigene Klassennamen. Sie stehen hier
     und nicht je Komponente, weil sie dieselbe Sache bedeuten: sortieren, einstellen, filtern.
     Wer eine neue Toolbar baut, haengt seinen Knopf an eine dieser drei Listen. */
  ["ubo-sort-btn", "uo-sort-btn", "vot-sort-btn"].forEach(function(k){
    TOOLBAR_ICONS[k] = TOOLBAR_ICONS["up-sort-btn"];
  });
  /* ubo-cols-btn und uo-settings-btn standen nicht in dieser Liste -- deshalb trug brands-overview
     am Tabellen-Zahnrad noch die alte Feather-Form, waehrend das Zahnrad daneben (Chart Settings)
     laengst das neue war. */
  ["ccl-settings-btn", "ubo-scale-btn", "vot-scale-btn", "uhm-set-btn",
   "ubo-cols-btn", "uo-settings-btn"].forEach(function(k){
    TOOLBAR_ICONS[k] = TOOLBAR_ICONS["up-cols-btn"];
  });
  ["combo-filter-btn", "tcd-filter-btn", "ubo-filter-btn", "vot-filter-btn",
   "upr-settings-toggle"].forEach(function(k){
    TOOLBAR_ICONS[k] = TOOLBAR_ICONS["urt-fader-btn"];
  });
  /* Knoepfe, die sich nicht ueber die Klasse allein ansprechen lassen: der Umschalter
     Doughnut/Balken traegt beide Male dieselbe Klasse und unterscheidet sich nur am
     data-chart. Deshalb ein zweiter Satz mit vollen Selektoren. */
  var TOOLBAR_SEL = {
    /* chart-bar-decreasing: Achse plus drei kuerzer werdende Balken. Vorher chart-bar-big mit
       zwei Balken als Rechtecke -- dasselbe Zeichen, aber ohne die Aussage "sortiert". */
    '.cc-seg-btn[data-chart="bar"], .tcl-seg-btn[data-chart="bar"]':
      '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M7 11h8"/><path d="M7 16h3"/><path d="M7 6h12"/>',
    /* Der Sortierknopf in der Gruppierungsliste -- dieselbe Form wie in der Topbar. */
    ".upt-grp-sidesort-btn": PFAD_SORT,
    /* Mira: die beiden Zeichen im Eingabefeld. Der Regler war von Hand gezeichnet (zwei Linien
       mit gefuellten Kreisen), das Mikrofon eine aeltere Fassung. Beide stehen im Bubble-Markup,
       kommen also nur ueber diesen Weg auf den neuen Stand. */
    "#am-mic": '<path d="M12 19v3"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/>' +
               '<rect x="9" y="2" width="6" height="13" rx="3"/>',
    /* Das grosse Zeichen ueber der Ueberschrift in Prompt Research: dieselbe Form wie der
       Menuepunkt in der Leiste, damit Seite und Navigation dasselbe Zeichen tragen. */
    ".upr-research-orb": PFAD_SQDASH
  };
  /* settings-2, dieselbe Form wie der Fader der Tabellen. */
  TOOLBAR_SEL["#am-settings-toggle"] = TOOLBAR_ICONS["urt-fader-btn"];

  /* ---- Beschriftung derselben Knoepfe -------------------------------------------------------
     Aus demselben Grund wie die Icons: das data-tip steht im handgemachten Bubble-Markup, und ein
     Element, das vor dem Attribut gebaut wurde, bekommt es nie nach. Genau das war im
     topics-manager zu sehen -- die Vorlage trug "Sort" und "Search", das eingebaute Element nicht.
     GESETZT WIRD NUR, WAS FEHLT: wo eine Komponente eine genauere Beschriftung mitbringt
     ("Chart Settings" neben "Table Settings"), bleibt ihre stehen. */
  var TOOLBAR_TIPS = {
    "up-sort-btn": "Sort", "ubo-sort-btn": "Sort", "uo-sort-btn": "Sort", "vot-sort-btn": "Sort",
    "up-search-btn": "Search",
    "up-cols-btn": "Table Settings", "ubo-cols-btn": "Table Settings",
    "ubo-scale-btn": "Chart Settings", "vot-scale-btn": "Chart Settings",
    "ccl-settings-btn": "Chart Settings", "uhm-set-btn": "Settings",
    "uo-settings-btn": "Board Settings",
    "combo-filter-btn": "Filter brands", "ubo-filter-btn": "Filter brands",
    "vot-filter-btn": "Filter brands", "tcd-filter-btn": "Filter",
    "upr-settings-toggle": "Research settings"
  };
  /* Das x im Suchfeld bekommt ausdruecklich keins: es sitzt im Feld, sein Zweck steht daneben,
     und ein Chip ueber einem gerade getippten Text ist im Weg. */
  /* EIN Selektor fuer alles, nicht einer pro Knopfklasse. Vorher lief pro Durchlauf ein
     querySelectorAll je Eintrag -- bei 19 Eintraegen also 19 Durchsuchungen des ganzen Dokuments.
     Jetzt eine, danach wird am Element entschieden, welcher Eintrag gilt. */
  var TOOLBAR_ALLE = null;
  function toolbarSelektor(){
    if (TOOLBAR_ALLE) return TOOLBAR_ALLE;
    var teile = [], k;
    for (k in TOOLBAR_ICONS) if (Object.prototype.hasOwnProperty.call(TOOLBAR_ICONS, k)) teile.push("." + k);
    for (k in TOOLBAR_SEL) if (Object.prototype.hasOwnProperty.call(TOOLBAR_SEL, k)) teile.push(k);
    TOOLBAR_ALLE = teile.join(",");
    return TOOLBAR_ALLE;
  }
  function toolbarSchluessel(el){
    /* Die Selektor-Eintraege gehen VOR den Klassen-Eintraegen: der Balken-Umschalter traegt beide
       Male dieselbe Klasse, nur der Selektor trifft die richtige Haelfte. */
    var k;
    for (k in TOOLBAR_SEL){
      if (!Object.prototype.hasOwnProperty.call(TOOLBAR_SEL, k)) continue;
      try { if (el.matches(k)) return { key: k, pfad: TOOLBAR_SEL[k] }; } catch(e){}
    }
    for (k in TOOLBAR_ICONS){
      if (!Object.prototype.hasOwnProperty.call(TOOLBAR_ICONS, k)) continue;
      if (el.classList.contains(k)) return { key: k, pfad: TOOLBAR_ICONS[k] };
    }
    return null;
  }
  function stampToolbarIcons(wurzel){
    var ziel = wurzel || document, els;
    try { els = ziel.querySelectorAll(toolbarSelektor()); } catch(e){ return; }
    for (var i = 0; i < els.length; i++){
      var b = els[i];
      var t = toolbarSchluessel(b);
      if (!t || b.getAttribute("data-up-ic") === t.key) continue;
      var alt = b.querySelector("svg");
      /* Die Strichstaerke aus dem vorhandenen SVG uebernehmen: das X im Suchfeld traegt 2.2,
         die anderen 2, und das ist Absicht -- ein einheitlicher Wert wuerde ein halbes Dutzend
         Knoepfe anders aussehen lassen. */
      var strich = (alt && alt.getAttribute("stroke-width")) || "2";
      /* Die Klasse des alten SVG mitnehmen. In Mira haengt die Groesse an .am-ic -- ohne die
         Klasse kam das getauschte Zeichen in Standardgroesse heraus und sprengte den Knopf. */
      var klasse = (alt && alt.getAttribute("class")) || "";
      var neu = '<svg viewBox="0 0 24 24"' + (klasse ? ' class="' + klasse + '"' : "") +
        ' fill="none" stroke="currentColor" stroke-width="' + strich +
        '" stroke-linecap="round" stroke-linejoin="round">' + t.pfad + '</svg>';
      /* Nur das SVG tauschen, alles andere im Knopf bleibt (Badges, Punkte, Beschriftungen). */
      if (alt){ alt.outerHTML = neu; } else { b.insertAdjacentHTML("afterbegin", neu); }
      b.setAttribute("data-up-ic", t.key);
      /* Beschriftung nachtragen, falls keine da ist -- siehe TOOLBAR_TIPS. aria-label bekommt
         denselben Text, wenn auch das fehlt: ein Knopf, der nur aus einem Zeichen besteht, hat
         sonst fuer einen Screenreader keinen Namen. */
      /* t_ am Ort der VERWENDUNG und nicht in der Tabelle: die Tabelle ist die Schluesselliste,
         und ein Schluessel, der schon uebersetzt ist, findet sich im Katalog nicht wieder. */
      var tip = TOOLBAR_TIPS[t.key];
      if (tip) tip = t_(tip);
      var vorhanden = b.getAttribute("data-tip");
      if (tip && !vorhanden){
        b.setAttribute("data-tip", tip);
        if (!b.getAttribute("aria-label")) b.setAttribute("aria-label", tip);
      } else if (vorhanden){
        /* Und der Fall, der die Uebersetzung erst wirksam macht: die Komponente bringt ihre eigene
           Beschriftung mit, und die gewinnt (so soll es sein -- "Chart Settings" ist genauer als
           "Table Settings"). Steht sie im Katalog, wird sie hier UEBERSETZT statt ersetzt.
           Das ist der Hebel: die elf Kopfzeilen der App tragen ihre Tooltips im handgemachten
           Bubble-Markup, das vom Pin aus nicht erreichbar ist. Ohne diese Zeilen bliebe jeder
           Werkzeugknopf der App englisch, egal was im Katalog steht.
           Nur wer im Katalog steht, wird angefasst: t_ gibt unbekannten Text unveraendert
           zurueck, also ist das Setzen dann ein No-op und eine eigene Beschriftung wie
           "Look for new Opportunities" bleibt, wie die Komponente sie wollte. */
        var uebersetzt = t_(vorhanden);
        if (uebersetzt !== vorhanden){
          b.setAttribute("data-tip", uebersetzt);
          var al = b.getAttribute("aria-label");
          if (!al || al === vorhanden) b.setAttribute("aria-label", uebersetzt);
        }
      }
    }
  }
  /* ---- Reihenfolge der Toolbar-Knoepfe -------------------------------------------------------
     Dieselbe Lage wie bei den Icons: die Reihenfolge steht im handgemachten Bubble-Markup und
     weicht dort je Komponente ab. Also ordnet core sie zur Laufzeit, sonst muesste jede der elf
     Kopfzeilen von Hand nachgezogen werden -- und die naechste Kopie faengt wieder von vorn an.
     Von links: sortieren, filtern (Fader), suchen, einstellen. Von rechts gelesen ist das die
     abgesprochene Regel -- der Fader steht vor dem Sorter, der Einstellungsknopf ganz rechts.
     Rang bekommen NUR diese vier Rollen. Markenschalter, Granularitaet, Segment-Umschalter,
     Export, Maximieren und Oeffnen behalten ihren Platz: die Rollen werden auf genau die Plaetze
     zurueckgeschrieben, die sie vorher gemeinsam belegt haben. Deshalb bleiben Visibility Chart,
     Prompts, Domains und URLs unangetastet -- dort stimmt es schon. */
  var TOOLBAR_ORDNUNG = [
    { rang: 10, sel: ".up-sort, .ubo-sort, .vot-sort, .uo-sort-btn" },
    /* Fader und Markenfilter mit Reglerzeichen. .uhm-pick ("Brands & Topics") gehoert hier hin:
       im Performance Radar ist er der Filter, und der Einstellungsknopf muss rechts von ihm. */
    { rang: 20, sel: ".urt-fader, .vot-filter, .ubo-filter, .tcd-filter, .combo-filter, .uhm-pick" },
    { rang: 30, sel: ".up-search" },
    /* Nicht dabei: .vot-scale-btn, .ubo-scale-btn und .ccl-settings-btn. Die tragen dasselbe
       Zahnrad, sitzen aber IM Diagrammfeld und nicht in der Kopfzeile -- ein Rang waere hier
       eine Regel, die nie greift und beim naechsten Lesen in die Irre fuehrt. */
    { rang: 40, sel: ".up-cols, .ubo-cols, .uhm-set, .uo-settings-btn" }
  ];
  /* .up-toolgroup-in gehoert dazu, seit es die einklappbare Werkzeuggruppe gibt: die Werkzeuge
     liegen dann eine Ebene tiefer, und orderToolbars sieht nur direkte Kinder. Ohne diesen
     Eintrag faellt die Rangordnung fuer jede Tabelle mit eingeklappter Leiste STILL aus --
     rollen.length bleibt unter 2, die Schleife geht weiter, und niemand merkt es. Gemessen am
     24.08. an prompts-table: dort stand die Reihenfolge schon richtig, der Ausfall waere also
     erst beim naechsten neuen Knopf aufgefallen. */
  var TOOLBAR_LEISTEN = ".up-head-tools, .vot-head-tools, .ubo-head-tools, .tcd-head-tools, .combo-head-tools, .up-toolgroup-in";
  function toolbarRang(el){
    var i;
    for (i = 0; i < TOOLBAR_ORDNUNG.length; i++){
      try { if (el.matches(TOOLBAR_ORDNUNG[i].sel)) return TOOLBAR_ORDNUNG[i].rang; } catch(e){}
    }
    /* Opportunities steckt den Sorter in ein neutrales .uo-popwrap -- die Rolle steht erst am
       Knopf darin. Nur das ERSTE Kind ansehen, nie den Teilbaum: in den Menues stecken Suchfelder
       und Einstellungszeilen, die sonst den Rang der Huelle verfaelschen wuerden. */
    var k = el.firstElementChild;
    if (k) for (i = 0; i < TOOLBAR_ORDNUNG.length; i++){
      try { if (k.matches(TOOLBAR_ORDNUNG[i].sel)) return TOOLBAR_ORDNUNG[i].rang; } catch(e){}
    }
    return 0;
  }
  function orderToolbars(wurzel){
    var ziel = wurzel || document, leisten;
    try { leisten = ziel.querySelectorAll(TOOLBAR_LEISTEN); } catch(e){ return; }
    for (var i = 0; i < leisten.length; i++){
      var box = leisten[i], kinder = box.children;
      var plaetze = [], rollen = [], j;
      for (j = 0; j < kinder.length; j++){
        var r = toolbarRang(kinder[j]);
        if (!r) continue;
        plaetze.push(j);
        rollen.push({ el: kinder[j], rang: r, j: j });
      }
      if (rollen.length < 2) continue;
      /* Gleicher Rang: alte Reihenfolge behalten, damit zwei Knoepfe derselben Rolle nicht
         hin und her springen. */
      rollen.sort(function(a, b){ return a.rang - b.rang || a.j - b.j; });
      var stimmt = true;
      for (j = 0; j < rollen.length; j++){
        if (rollen[j].j !== plaetze[j]){ stimmt = false; break; }
      }
      /* Stimmt es schon, nichts anfassen: jedes Verschieben ist eine childList-Mutation, und der
         Beobachter unten haengt daran. Ohne diese Bremse triebe sich der Lauf selbst an. */
      if (stimmt) continue;
      var soll = [].slice.call(kinder);
      for (j = 0; j < rollen.length; j++) soll[plaetze[j]] = rollen[j].el;
      /* appendChild verschiebt, es kopiert nicht -- Listener, offene Menues und Zustandsklassen
         bleiben am Knopf. Nach dem Durchlauf steht genau die Sollreihenfolge. */
      for (j = 0; j < soll.length; j++) box.appendChild(soll[j]);
    }
  }
  /* Die Breite der KLASSISCHEN Bildlaufleiste, einmal gemessen und als --up-sbw an <html>.
     Auf macOS ist sie 0 -- die Leiste liegt ueber dem Inhalt und nimmt keinen Platz. Unter Windows
     sind es rund 15px, und genau die sind das Problem: eine Tabelle, deren Kopf AUSSERHALB der
     scrollenden Flaeche steht, verliert im Koerper 15px Breite, der Kopf nicht. Die Spalten passen
     dann nicht mehr zueinander -- gemeldet aus Performance Detail, Abschnitt Variations.
     Gemessen und nicht geraten: eine CSS-Konstante dafuer gibt es nicht. Der Wert steht an <html>
     und nicht an einer .up-root, damit ihn jede Komponente und jedes Portal sieht.
     Beim Zoomen aendert sich der Wert, deshalb noch einmal bei resize. */
  function stampScrollbarWidth(){
    try {
      var probe = document.createElement("div");
      probe.style.cssText = "position:absolute;top:-9999px;left:-9999px;width:100px;height:100px;" +
                            "overflow-y:scroll;visibility:hidden";
      document.body.appendChild(probe);
      var w = probe.offsetWidth - probe.clientWidth;
      probe.parentNode.removeChild(probe);
      document.documentElement.style.setProperty("--up-sbw", (w > 0 ? w : 0) + "px");
    } catch (e){}
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", stampScrollbarWidth);
  else stampScrollbarWidth();
  /* Gedrosselt: die Funktion haengt ein Probe-Element ein, misst es und nimmt es wieder heraus.
     An jedem Bild einer Ziehbewegung ist das ein DOM-Eingriff plus Messung -- und der Eingriff
     weckt zusaetzlich die Beobachter, die auf neue Knoten warten. Die Breite der Scrollleiste
     aendert sich beim Ziehen ohnehin nicht. */
  if (typeof aufResize === "function") aufResize(stampScrollbarWidth, { ms: 250 });
  else window.addEventListener("resize", stampScrollbarWidth);

  /* Beim Laden und danach: Bubble baut Elemente in Schueben und spaeter erneut auf. */
  /* ---- Der Umschalter Tag/Woche/Monat --------------------------------------------------------
     Gekuerzt auf D, W und M; der ganze Name steht im Tooltip. Er sitzt in Kopfzeilen neben
     Filtern, Suche und Export, und drei ausgeschriebene Woerter sind dort das breiteste Element
     der Zeile -- auf schmalen Breiten schiebt es die Werkzeuge um.
     Warum in core und nicht in den Komponenten: die Knoepfe stehen im handgemachten Bubble-Markup
     (visibility-chart, brands-overview), und ein bereits eingebautes Element bekommt eine
     Aenderung an der Vorlage nie. Dieselbe Lage wie bei den Icons, also derselbe Weg.
     Die Komponenten, die ihre Knoepfe selbst bauen, tragen die kurze Form direkt ein -- sonst
     blitzte beim ersten Bild kurz das lange Wort auf. */
  var GRAN_KURZ = { day: "D", week: "W", month: "M" };
  var GRAN_LANG = { day: "Day", week: "Week", month: "Month" };
  function stampGran(wurzel){
    var ziel = wurzel || document, els;
    /* JEDER Knopf mit data-gran, nicht nur eine Klasse: der Combo-Chart nennt seine cc-gran-btn,
       und genau der stand deshalb noch auf "Day/Week/Month", waehrend alle anderen schon kurz
       waren. Ueber das Attribut trifft es auch jede kuenftige Variante. */
    try { els = ziel.querySelectorAll("button[data-gran]"); } catch(e){ return; }
    els = Array.prototype.slice.call(els);
    /* Die Wurzel selbst zaehlt mit: der Beobachter uebergibt den hinzugekommenen Knoten, und der
       KANN der Knopf sein. querySelectorAll findet nur Nachfahren. */
    if (ziel.matches && ziel.matches("button[data-gran]")) els.push(ziel);
    for (var i = 0; i < els.length; i++){
      var b = els[i], kurz = GRAN_KURZ[b.getAttribute("data-gran")], lang = GRAN_LANG[b.getAttribute("data-gran")];
      if (!kurz) continue;
      /* Nur schreiben, wenn es anders steht: jedes Schreiben ist selbst eine Mutation, und der
         Beobachter oben laeuft auf Mutationen. */
      if ((b.textContent || "").trim() !== kurz) b.textContent = kurz;
      if (!b.getAttribute("data-tip")) b.setAttribute("data-tip", t_(lang));
      if (!b.getAttribute("aria-label")) b.setAttribute("aria-label", t_(lang));
    }
  }

  /* ---- Der gleitende Umschalter --------------------------------------------------------------
     Jeder Umschalter der App bekommt einen Streifen, der unter den Knoepfen an die aktive Stufe
     faehrt (CSS: das ::before der Umschalter). Hier steht nur das Messen: wo steht die aktive Stufe, wie breit
     und wie hoch ist sie.
     Die Stufen werden ueber "button" gefunden und nicht ueber ihre Klassen: die zehn Umschalter
     der App nennen ihre Knoepfe zehnmal anders (.up-seg-btn, .vc-gran-btn, .up-pagesize-btn,
     .tcd-mode-btn ...), und eine Liste davon waere beim naechsten neuen Umschalter wieder
     unvollstaendig. Der Streifen selbst ist ein span und faellt deshalb nicht mit hinein. */
  /* Die Liste ist nicht geraten, sondern aus den Stilen gezogen: es sind genau die Kaesten, die
     .vc-switch-bg oder .vc-switch-soft als Flaeche tragen und Knoepfe enthalten -- also alles, was
     in dieser App wie ein Umschalter aussieht. Wer einen neuen baut, traegt ihn hier ein.
     .upt-status (Active/Inactive in der Prompt-Tabelle), .udt-sub-dispseg und .uap-tabs haben
     zuerst gefehlt: sie heissen nicht "seg" und sind mir deshalb durchgegangen. */
  var SEG_BOXEN = ".up-seg, .cc-seg, .ubo-seg, .tcl-seg, .vc-gran, .cc-gran, .up-pagesize-seg," +
                  " .up-filter-dim, .up-dense, .tcd-mode, .uca-format-seg, .ubo-yaxis," +
                  " .upt-status, .udt-sub-dispseg, .uap-tabs";

  /* ZWEI Durchgaenge, und das ist der Punkt: erst wird an ALLEN Umschaltern gelesen, dann an
     allen geschrieben. Vorher lag beides ineinander -- lesen an Kasten A, schreiben an A, lesen
     an B -- und jedes Lesen nach einem Schreiben zwingt den Browser, das Layout neu zu rechnen.
     Bei zehn Umschaltern sind das zehn erzwungene Umbrueche je Lauf, und der Lauf haengt an jedem
     Klick und an jeder Mutation. Genau diese Meldung stand reihenweise in der Konsole eines
     Nutzers ("Forced reflow while executing JavaScript took 186ms"). Getrennt bleibt EIN Umbruch
     je Lauf uebrig. */
  /* ZWEI Durchgaenge, und das ist der Punkt: erst wird an ALLEN Umschaltern gelesen, dann an
     allen geschrieben. Vorher lag beides ineinander -- lesen an Kasten A, schreiben an A, lesen
     an B -- und jedes Lesen nach einem Schreiben zwingt den Browser, das Layout neu zu rechnen.
     Bei zehn Umschaltern sind das zehn erzwungene Umbrueche je Lauf, und der Lauf haengt an jedem
     Klick und an jeder Mutation. Getrennt bleibt EIN Umbruch je Lauf uebrig. */
  function segLesen(box){
    if (!box.isConnected) return null;
    var aktiv = box.querySelector("button.is-active");
    if (!aktiv) return null;
    var b = aktiv.offsetWidth, h = aktiv.offsetHeight;
    /* Breite 0 heisst: der Umschalter ist gerade nicht sichtbar (ein Popover, das noch zu ist).
       Dann NICHT messen -- eine 0 wuerde den Streifen auf null ziehen, und beim Oeffnen faehrt er
       aus dem Nichts. Der naechste Lauf misst ihn, sobald er wirklich da ist. */
    if (!b) return null;
    return { box: box, x: aktiv.offsetLeft + "px", y: aktiv.offsetTop + "px",
             w: b + "px", h: h + "px",
             idx: Array.prototype.indexOf.call(box.children, aktiv),
             key: segSchluessel(box) };
  }

  /* Der Streifen muss einen NEUAUFBAU ueberleben. Mehrere Menues zeichnen sich bei jedem Klick
     komplett neu (das Filtermenue etwa); der Umschalter darin ist danach ein anderes Element,
     und ein Zustand am Element waere weg. Deshalb ein Schluessel, der den Neuaufbau uebersteht:
     Komponente, Klassen, Zahl der Knoepfe und die Marke des ersten Knopfes. Datenattribute
     zuerst, Text nur als Rueckfall -- der Text der Granularitaet wechselt von "Day" auf "D",
     ein Schluessel daraus waere nach dem Kuerzen ein anderer. */
  var SEG_STAND = {};
  function segSchluessel(box){
    var w = box.closest ? box.closest("[data-instance]") : null;
    var id = w ? (w.getAttribute("data-instance") || "") : "";
    var kl = (box.className || "").split(/\s+/).filter(function(c){
      return c && c !== "is-gleitend" && c !== "is-sofort";
    }).sort().join(".");
    var e = box.children[0];
    var marke = e ? (e.getAttribute("data-metric") || e.getAttribute("data-dim") ||
                     e.getAttribute("data-gran") || e.getAttribute("data-chart") ||
                     e.getAttribute("data-mode") || (e.textContent || "").slice(0, 12)) : "";
    return id + "|" + kl + "|" + box.children.length + "|" + marke;
  }

  function segWerte(box, m){
    var st = box.style;
    if (st.getPropertyValue("--up-seg-x") !== m.x) st.setProperty("--up-seg-x", m.x);
    if (st.getPropertyValue("--up-seg-y") !== m.y) st.setProperty("--up-seg-y", m.y);
    if (st.getPropertyValue("--up-seg-w") !== m.w) st.setProperty("--up-seg-w", m.w);
    if (st.getPropertyValue("--up-seg-h") !== m.h) st.setProperty("--up-seg-h", m.h);
  }

  /* Drei Faelle, und nur einer davon faehrt:
       kein Wechsel          -> springen. Erste Messung, engere Werkzeugleiste, aufgehendes Menue.
       Wechsel, gleiches El. -> fahren, wie bisher.
       Wechsel, neues El.    -> erst OHNE Fahrt an die alte Stelle, dann nach EINEM Umbruch mit
                                Fahrt an die neue. Ohne diesen Umweg faehrt der Streifen aus der
                                linken Ecke mit Breite 0 auf -- ein neues Element hat keine Werte,
                                und ein Uebergang startet nach dem Zustand NACH der Aenderung.
                                Genau das war das Aufblitzen im Filtermenue.
     VIER ZAHLEN, sonst nichts. Kein Element, kein Einhaengen, kein Umbau -- der Streifen ist ein
     ::before und existiert im DOM gar nicht. */
  function segSchreiben(m){
    var box = m.box;
    var alt = SEG_STAND[m.key];
    var stand = box.classList.contains("is-gleitend");
    var wechsel = !!alt && alt.idx !== m.idx;
    SEG_STAND[m.key] = { idx: m.idx, x: m.x, y: m.y, w: m.w, h: m.h };

    if (wechsel && stand){                 /* dasselbe Element: einfach fahren */
      segWerte(box, m);
      return null;
    }
    if (wechsel){                          /* neues Element: erst zurueck, dann fahren */
      box.classList.add("is-sofort");
      segWerte(box, alt);
      box.classList.add("is-gleitend");
      return { box: box, ziel: m };
    }
    box.classList.add("is-sofort");        /* kein Wechsel: springen */
    segWerte(box, m);
    if (!stand) box.classList.add("is-gleitend");
    return { box: box, ziel: null };
  }

  function segSchriftUhr(){
    if (SEG_SCHRIFT || !document.fonts || !document.fonts.ready) return;
    SEG_SCHRIFT = true;
    document.fonts.ready.then(function(){ segLauf(); })["catch"](function(){});
  }

  /* ---- Die Notbremse ---------------------------------------------------------------------------
     Der Streifen ist eine Verzierung. Er darf eine Seite niemals aufhalten -- und am 29.08. hat
     genau das eine ganze App stillgelegt: auf einer Bubble-Seite mit zehn Views und 23604 Knoten
     lief der Hauptstrang voll, und sie wurde nie fertig gezeichnet. Kein Fehler, nur Stillstand.
     Deshalb ein Zeitkonto ueber alle Laeufe zusammen. Ist es aufgebraucht, schaltet sich der
     Streifen ab und meldet das einmal. Was dann fehlt, ist eine Bewegung; was bleibt, ist eine
     benutzbare Seite. Die Grenze ist grosszuegig: ein Lauf kostet auf einer normalen Seite
     Bruchteile einer Millisekunde, 1500ms sind also nur erreichbar, wenn etwas grundlegend
     falsch laeuft. */
  var SEG_KONTO = 0, SEG_AUS = false, SEG_GRENZE = 1500;
  /* Die Schriften kommen SPAETER als das erste Bild, und mit ihnen werden alle Beschriftungen
     anders breit -- der Streifen stuende dann hinter dem falschen Knopf. Genau so gemeldet am
     24.08. am Umschalter im Onboarding. Einmal fuer die ganze Seite, nicht je Umschalter. */
  var SEG_SCHRIFT = false;

  function segLauf(wurzel){
    if (SEG_AUS || window.__upOhneToolbar || window.__upOhneStreifen) return;
    /* Nicht waehrend einer Ziehbewegung. Der Streifen sitzt dann ohnehin kurz falsch, und niemand
       sieht ihn dabei an -- gemessen war er mit 26 Prozent aller Lesezugriffe weiterhin der
       groesste Posten, weil waehrend des Ziehens dauernd Kopfzeilen und Legenden neu entstehen
       und jede davon einen Umschalter mitbringt. Der Zuhoerer weiter unten laeuft 150ms nach dem
       letzten Ereignis und holt es dann nach. */
    if (typeof zieht === "function" && zieht()) return;
    var ziel = wurzel || document, els;
    var t0 = (window.performance && performance.now) ? performance.now() : 0;
    try {
      els = ziel.querySelectorAll(SEG_BOXEN);
      /* querySelectorAll findet nur NACHFAHREN. Wenn der Beobachter einen Umschalter selbst
         meldet -- und genau das tut er, wenn eine Komponente ihre Kopfzeile neu baut --, waere er
         sonst uebersehen worden. */
      if (ziel !== document && ziel.matches && ziel.matches(SEG_BOXEN)){
        els = [].slice.call(els); els.push(ziel);
      }
    } catch(e){ return; }
    segSchriftUhr();
    var messwerte = [], i;
    for (i = 0; i < els.length; i++){                    /* 1. nur lesen */
      var m = segLesen(els[i]);
      if (m) messwerte.push(m);
    }
    var wartend = [];
    for (i = 0; i < messwerte.length; i++){               /* 2. nur schreiben */
      var auftrag = segSchreiben(messwerte[i]);
      if (auftrag) wartend.push(auftrag);
    }
    /* 3. EIN erzwungener Umbruch fuer alle zusammen: er legt fest, was ohne Fahrt gelten soll.
       Erst danach faellt die Sperre -- und wer auf die alte Stelle gesetzt wurde, bekommt jetzt
       seine neue und faehrt dorthin. Ohne diesen Umbruch nimmt der Browser beide Aenderungen
       zusammen, und es gibt keine Fahrt. */
    if (wartend.length){
      void document.body.offsetWidth;
      for (i = 0; i < wartend.length; i++){
        wartend[i].box.classList.remove("is-sofort");
        if (wartend[i].ziel) segWerte(wartend[i].box, wartend[i].ziel);
      }
    }
    if (t0){
      SEG_KONTO += performance.now() - t0;
      if (SEG_KONTO > SEG_GRENZE){
        SEG_AUS = true;
        if (window.console) console.warn("[UpstreemCore] Der gleitende Streifen der Umschalter ist " +
          "abgeschaltet: er hat zusammen mehr als " + SEG_GRENZE + "ms gebraucht. Die Seite laeuft " +
          "weiter, die Umschalter springen nur statt zu fahren.");
      }
    }
  }

  /* Zwei Anlaesse ausser dem Lauf der Toolbar: eine andere Fensterbreite aendert die Breite der
     Stufen, und ein Klick irgendwo kann einen Umschalter erst sichtbar machen (Popover, Drawer,
     Tab). Beides ist billig -- ein querySelectorAll und eine Messung je Umschalter. */
  /* GEBUENDELT, nicht bei jedem Ereignis. Gemessen in der echten App: segLesen war mit 7206 von
     12888 Layout-Lesezugriffen der groesste Posten beim Ziehen am Fensterrand -- 56 Prozent. Der
     Grund stand hier: ein resize-Ereignis feuert waehrend des Ziehens mit jedem Bild, und JEDER
     Lauf misst SAEMTLICHE Umschalter der Seite mit vier Werten je Stueck (offsetWidth, -Height,
     -Left, -Top). Bei zwanzig Komponenten sind das ueber hundert Messungen pro Mausbewegung --
     fuer einen Streifen, den in diesem Moment niemand ansieht.
     Jetzt laeuft er 150ms NACH der letzten Aenderung, also einmal am Ende der Bewegung. Der
     Streifen traegt seinen eigenen Uebergang und faehrt dann weich an seine Stelle.
     Zusaetzlich der Breiten-Waechter: aendert sich die Fensterbreite gar nicht (Hoehe, Tastatur,
     Adressleiste auf dem Telefon), gibt es fuer den Streifen nichts zu tun. */
  var _segUhr = null, _segBreite = -1;
  window.addEventListener("resize", function(){
    var w = window.innerWidth;
    if (w === _segBreite) return;
    _segBreite = w;
    if (_segUhr) clearTimeout(_segUhr);
    _segUhr = setTimeout(function(){ _segUhr = null; sicher("segLauf", segLauf); }, 150);
  }, { passive: true });
  document.addEventListener("click", function(){ setTimeout(function(){ sicher("segLauf", segLauf); }, 0); }, true);

  /* ---- Globus statt Loch: EIN Zuhoerer fuer alle Favicons der App -----------------------------
     Favicons kommen von fremden Diensten, und die antworten regelmaessig mit 404 oder ohne
     CORS-Kopf -- im Log eines Nutzers gleich reihenweise (gstatic faviconV2, google.com/s2).
     Bisher trug jede Aufrufstelle ihren eigenen Rueckfall im onerror-Attribut, und die zwei
     Bauarten liefen auseinander: die einen nahmen has-img ab, dann zeigte der Kasten seinen
     Buchstaben oder (bei .up-fav) den Globus; die anderen setzten visibility auf hidden und
     liessen ein Loch in der Groesse des Bildes stehen.

     Ein Zuhoerer am Dokument statt eines Attributs je Stelle: neue Komponenten bekommen den
     Rueckfall damit von selbst, und keine kann ihn vergessen. In der EINFANGPHASE, weil das
     error-Ereignis eines Bildes nicht aufsteigt.

     Die Arbeit liegt in einem setTimeout(0) und nicht direkt im Zuhoerer: die alten
     onerror-Attribute laufen in der Zielphase, also NACH diesem Zuhoerer. Wer das Bild vorher
     aus dem DOM nimmt, laesst dort ein this.parentNode auf null laufen -- eine neue Fehlerzeile
     in der Konsole, statt einer weniger. Nach dem Zug ist das Feld frei, und ein von dort
     gesetztes visibility:hidden wird gleich mit zurueckgenommen. */
  var FAV_DIENST = /gstatic\.com\/faviconV2|google\.com\/s2\/favicons|wsrv\.nl\/\?url=/i;
  var FAV_KASTEN = ".up-fav, .up-logo-box, .up-stack-item, .up-ment-logo, .uhm-logo, .uab-fav";
  var FAV_KLASSE = { "up-company-favicon": 1, "combo-filter-favicon": 1, "up-ment-logo": 1,
                     "usn-fav": 1, "uca-src-fav": 1 };
  /* Ein Kasten zeigt schon von sich aus etwas, wenn er einen Buchstaben traegt oder wenn er ein
     .up-fav ist (dessen ::after IST der Globus). Nur wer beides nicht hat, braucht die Marke. */
  var FAV_BUCHSTABE = ".up-logo-ltr, .up-stack-ltr, .udt-logo-ltr, .udt-sub-ltr, .uut-logo-ltr";

  function istFavicon(img){
    var src = img.getAttribute("src") || "";
    if (FAV_DIENST.test(src)) return true;
    var k = img.className;
    if (typeof k === "string"){
      var teile = k.split(/\s+/);
      for (var i = 0; i < teile.length; i++) if (FAV_KLASSE[teile[i]]) return true;
    }
    return !!(img.parentNode && img.closest && img.closest(FAV_KASTEN));
  }

  /* kastenVorher: Komponenten tragen an ihren Bildern ein eigenes onerror, das das Bild sofort
     aus dem Dokument nimmt. Lief das zuerst, fand der Rueckfall hier nur noch ein elternloses
     Bild und stieg aus -- kein Globus, obwohl genau dafuer alles da ist. Deshalb merkt sich der
     Zuhoerer den Kasten, solange das Bild noch haengt, und gibt ihn mit. */
  function faviconRueckfall(img, kastenVorher){
    var kasten = kastenVorher || (img && img.closest ? img.closest(FAV_KASTEN) : null);
    if (!img && !kasten) return;
    if (kasten){
      /* Der Weg, den die Tabellen schon gehen: has-img ab, Bild weg. Danach steht dort der
         Buchstabe der Marke -- oder, an einem .up-fav, der Globus aus der CSS. */
      kasten.classList.remove("has-img");
      if (kasten.style && kasten.style.visibility === "hidden") kasten.style.visibility = "";
      if (img && img.parentNode) img.parentNode.removeChild(img);
      var zeigtSchon = kasten.classList.contains("up-fav") || kasten.querySelector(FAV_BUCHSTABE);
      if (!zeigtSchon) kasten.classList.add("up-globus-an");
      return;
    }
    /* Ohne Kasten: der Globus tritt AN DIE STELLE des Bildes und in seiner Groesse -- sonst
       rutscht die Zeile, in der er stand, beim Fehlschlag zusammen. Dafuer muss das Bild aber
       noch da sein; hat es sich selbst schon entfernt, gibt es keine Stelle mehr. */
    if (!img || !img.parentNode) return;
    var b = parseFloat(img.getAttribute("width")) || img.clientWidth || 16;
    var h = parseFloat(img.getAttribute("height")) || img.clientHeight || b;
    var span = document.createElement("span");
    span.className = "up-globus-frei";
    span.style.width = b + "px";
    span.style.height = h + "px";
    if (img.style && img.style.borderRadius) span.style.borderRadius = img.style.borderRadius;
    img.parentNode.replaceChild(span, img);
  }

  /* Google antwortet fuer eine Domain OHNE Favicon nicht mit einem Fehler, sondern mit Status 200
     und seinem eigenen Globus -- 16x16, in der App auf 20 bis 40px hochgezogen, und genau das ist
     das verpixelte Bild, das statt unseres Globus dastand. Gemessen an y-im.de, odv.de,
     derprozessmeister.de, sac-hub.com und leeup.de: alle fuenf liefern auf sz=128 sechzehn Pixel,
     waehrend github 32 und stripe 128 liefert. Wer also 128 anfragt und 16 bekommt, hat den
     Platzhalter bekommen. Die Regel greift nur dann: fragt eine Stelle 16 an, sind 16 richtig. */
  function favPlatzhalter(img){
    var m = /[?&](?:sz|size)=(\d+)/.exec(img.getAttribute("src") || "");
    var wunsch = m ? parseInt(m[1], 10) : 0;
    return wunsch >= 32 && img.naturalWidth > 0 && img.naturalWidth <= 16;
  }

  document.addEventListener("error", function(e){
    var el = e && e.target;
    if (!el || el.tagName !== "IMG" || el.__upFavWeg) return;
    if (!istFavicon(el)) return;
    el.__upFavWeg = 1;                       /* ein Bild, ein Rueckfall */
    var kasten = el.closest ? el.closest(FAV_KASTEN) : null;   /* jetzt merken: gleich ist es weg */
    setTimeout(function(){ sicher("faviconRueckfall", function(){ faviconRueckfall(el, kasten); }); }, 0);
  }, true);

  document.addEventListener("load", function(e){
    var el = e && e.target;
    if (!el || el.tagName !== "IMG" || el.__upFavWeg) return;
    if (!istFavicon(el) || !favPlatzhalter(el)) return;
    el.__upFavWeg = 1;
    var kasten = el.closest ? el.closest(FAV_KASTEN) : null;
    sicher("faviconPlatzhalter", function(){ faviconRueckfall(el, kasten); });
  }, true);

  /* Und einmal nachsehen, was schon vorbei war. Ein Bild, das scheitert, BEVOR core geladen ist,
     hat sein error-Ereignis nie an diesen Zuhoerer geschickt -- gemessen an einer Seite, deren
     Markup vor dem Skript stand: kein einziger Rueckfall. In Bubble zeichnen die Komponenten zwar
     erst nach core, aber genau darauf will man sich nicht verlassen.
     complete && naturalWidth === 0 ist der fertig gescheiterte Ladeversuch: waehrend des Ladens
     ist complete false, bei Erfolg ist naturalWidth groesser null. */
  function faviconNachsehen(){
    var bilder = document.images || [];
    for (var i = bilder.length - 1; i >= 0; i--){
      var b = bilder[i];
      if (!b || b.__upFavWeg || !b.complete) continue;
      if (b.naturalWidth !== 0 && !favPlatzhalter(b)) continue;
      if (!b.getAttribute("src") || !istFavicon(b)) continue;
      b.__upFavWeg = 1;
      var kn = b.closest ? b.closest(FAV_KASTEN) : null;
      sicher("faviconNachsehen", (function(bild, kk){ return function(){ faviconRueckfall(bild, kk); }; })(b, kn));
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", faviconNachsehen);
  else faviconNachsehen();
  window.addEventListener("load", faviconNachsehen);

  /* Jeder Teil fuer sich. Vorher lag alles in einem Zug: stolperte einer, liefen die uebrigen
     nicht mehr -- und weil dieser Lauf auch aus dem Beobachter kommt, waere danach jeder weitere
     Lauf betroffen gewesen. Ein Stolperer darf nie mehr mitreissen als sich selbst. */
  function sicher(name, fn){
    try { fn(); }
    catch(e){ if (window.console) console.warn("[UpstreemCore] " + name + " uebersprungen:", e && e.message); }
  }
  /* ---- Zwei Notschalter fuer die Fehlersuche ---------------------------------------------------
     Sie stehen hier, weil eine Bubble-Seite sich nicht nachbauen laesst: zehn Views, hundertfuenf
     Komponenten, dreiundzwanzigtausend Knoten, dazu Bubbles eigenes Zeichnen ueber jQuery.html().
     Wenn dort etwas haengt, ist die einzige verlaessliche Eingrenzung, EINEN Teil auszuschalten
     und dieselbe Seite noch einmal zu laden -- ohne neuen Pin, ohne neues Ausrollen.

       window.__upOhneToolbar  = true;   der ganze Lauf bleibt aus (Icons, Reihenfolge, D/W/M,
                                         Streifen)
       window.__upOhneStreifen = true;   nur der gleitende Streifen der Umschalter bleibt aus

     Beide werden VOR core.js gesetzt, also im Seitenkopf ueber dem Vorrats-Schnipsel. Steht keiner
     davon, aendert sich nichts -- das ist der Normalfall. */
  /* ---- Sprachlauf ueber das MARKUP -------------------------------------------------------------
     Die Spaltenkoepfe der Tabellen stehen nicht im JavaScript, sondern im handgemachten
     Bubble-Markup jedes Elements (<span class="up-th-txt">Prompt</span>). Vom Pin aus ist das
     nicht erreichbar -- genau der Grund, aus dem in dieser Datei schon TOOLBAR_ICONS und
     TOOLBAR_TIPS stehen: was im Markup steht, zieht core zur Laufzeit nach. Dasselbe hier fuer
     die Sprache.

     Sicher ist das durch EINE Eigenschaft: angefasst wird nur, was WOERTLICH im Katalog steht.
     Ein Markenname, eine Domain, ein Prompt und jeder andere Nutzertext ist kein Katalogschluessel
     und geht darum unveraendert durch -- es braucht keine Liste von Ausnahmen.

     data-i18n haelt das englische Original. Ohne es waere der Weg eine Einbahnstrasse: nach dem
     Umschalten auf Deutsch stuende dort deutscher Text, der kein Schluessel mehr ist, und der
     Rueckweg auf Englisch waere verloren.

     Elemente mit KINDERN werden uebersprungen. textContent zu setzen wuerde deren Markup
     wegwerfen -- ein Kopf mit Sortierpfeil und Info-Zeichen bestuende danach nur noch aus Text. */
  /* Die Liste ist AUS DEM REPO erzeugt und nicht geraten: ein Durchlauf ueber alle .js/.css und
     bubble/*.html hat die Spaltenkopf-Klassen ergeben (up-th, vt-th, tct-th, ubo-th) und die
     Kopfzeilen (up-head-label, vot-head-label, tcd-head-label). Die Muster mit [class*=...] decken
     dazu jede kuenftige Komponente ab, die sich an dieselbe Namensform haelt -- die Konvention ist
     in diesem Repo durchgehend, gepruefte Beispiele: prompts-table, responses-table,
     topcitations-dashboard, visibility-chart. */
  var SPRACHE_SEL = [
    ".up-th-txt", "[class*='-th-txt']",           /* Spaltenkopf mit eigenem Textknoten */
    ".up-th", ".vt-th", ".tct-th", ".ubo-th",     /* Spaltenkopf ohne inneres span */
    "[class*='head-label']",                      /* Ueberschrift einer Kopfzeile */
    "[class*='pagesize-lbl']",                    /* "Rows per page" */
    "[class*='filter-title']", "[class*='filter-submit']", "[class*='filter-reset']",
    "[class*='mode-btn']",                        /* Domains/URLs-Umschalter */
    ".up-ment-lbl", ".up-ment-empty", ".up-ment-noresult",
    /* Datumsfilter. Sein Markup wird EINMAL beim Start gebaut -- ohne diese Zeile wechselt es
       beim Umschalten der Sprache nicht mit, sondern erst beim naechsten Laden der Seite.
       .udr-label traegt bei einem eigenen Zeitraum ein Datum ("12 Dec – 18 Dec"); das ist kein
       Katalogschluessel und geht unveraendert durch. */
    ".udr-preset", ".udr-presets-head", ".udr-reset", ".udr-label",
    ".upt-status-btn", ".upt-status-tag", ".upt-grp-sidehead-lbl",
    ".up-pop-head",         /* Kopf eines Menues */
    ".up-pop-sub",          /* Zwischentitel darin */
    ".up-pop-label",        /* Zeile darin */
    ".up-pop-action",       /* "Select all" und Geschwister */
    ".up-heading",          /* Ueberschrift einer Komponente */
    ".up-sec-h",            /* Ueberschrift eines Abschnitts */
    ".up-ph-title", ".up-ph-desc",   /* Seitenkopf */
    ".up-empty-h", ".up-empty-t",    /* Leerzustand */
    ".up-btn-sec", ".up-export"      /* Knopfbeschriftungen */
  ].join(",");
  /* Genau EIN eigener Textknoten mit Inhalt? Dann ist er der Text dieses Elements. Sonst null.
     Hier stand vorher "Elemente mit Kindern ueberspringen", und das war zu grob: der Kopf
     "Brand Mentions" ist ein nackter Textknoten NEBEN dem Info-Zeichen (<div class="up-th
     up-th-brands">Brand Mentions<span class="up-th-info">...</span></div>), genauso "Market".
     Beide blieben damit englisch. Am Textknoten zu arbeiten statt an textContent laesst die
     Kinder unangetastet -- ein Kopf mit Sortierpfeil verliert seinen Pfeil nicht. */
  function eigenerText(el){
    var gefunden = null, n;
    var kinder = el.childNodes;
    for (var i = 0; i < kinder.length; i++){
      n = kinder[i];
      if (n.nodeType === 1){
        /* EIN KIND MIT TEXT heisst: der eigene Textknoten ist nur ein STUECK eines Satzes, und ein
           Stueck darf nie einzeln uebersetzt werden. Genau daran ist "Hinzufügen Prompts"
           entstanden: der Knopf traegt den Textknoten "Add" und daneben ein <span>Prompts</span>.
           "Add" allein wird zu "Hinzufügen", das Glossarwort bleibt -- und im Deutschen steht das
           Verb hinten, also ist die Reihenfolge falsch. Ein Satz, der aus zwei Knoten besteht,
           laesst sich nicht Knoten fuer Knoten uebersetzen; er braucht einen Eintrag fuer das
           GANZE, und den kann nur die Komponente setzen.
           Zeichen ohne Text (ein SVG, ein Haken, ein Info-Zeichen) stoeren nicht -- die haben
           keinen Textinhalt. */
        if ((n.textContent || "").trim()) return null;
        continue;
      }
      if (n.nodeType !== 3) continue;
      if (!(n.nodeValue || "").trim()) continue;
      if (gefunden) return null;          /* zwei Textstuecke: nicht anfassen */
      gefunden = n;
    }
    return gefunden;
  }
  /* Die Selektorliste oben BLEIBT als schneller Weg fuer die Faelle, die sicher zaehlen. Darunter
     laeuft ein zweiter, BREITER Durchgang: ein TreeWalker ueber die Textknoten der Seite.

     Warum breit und nicht Datei fuer Datei: die sichtbaren Texte stehen zu einem grossen Teil im
     handgemachten Bubble-Markup der Elemente, und das ist vom Pin aus nicht erreichbar. Eine
     Uebersetzung, die nur im JavaScript ansetzt, laesst genau die Stellen englisch, die der Nutzer
     zaehlt -- Spaltenkoepfe, Knoepfe, Beschreibungen in den Seitenkoepfen.

     Sicher ist der Durchgang durch DREI Dinge, nicht durch eine Ausnahmeliste:
       1. Angefasst wird nur, was WOERTLICH im Katalog steht. Ein Markenname, eine Domain, ein
          Prompt, ein Topicname ist kein Schluessel und geht unveraendert durch.
       2. DATENZELLEN werden uebersprungen. Dort steht Nutzertext, und ein Markenname, der zufaellig
          "Share" heisst, soll nicht zu "Anteil" werden. Die Klassenformen dieser App sind dafuer
          eindeutig (-td, -cell, -chip, -tag), dazu Eingabefelder und alles mit
          contenteditable.
       3. Bei locale "en" laeuft er GAR NICHT. Das ist der Normalfall, und dort gibt es nichts zu
          tun -- t() gibt englischen Text unveraendert zurueck.

     data-i18n am ELTERNELEMENT haelt das englische Original, damit der Weg zurueck auf Englisch
     nicht verloren ist. Genau dafuer gibt es die zwei Durchgaenge: der schnelle setzt es an den
     bekannten Stellen, der breite an allen uebrigen. */
  /* Zwei Listen, weil es zwei Gruende gibt.
     HART: hier steht NIE Oberflaeche -- Eingabefelder, Chips, Tags, Skript. Nicht anfassen, Punkt.
     ZELLE: dort steht Nutzertext, ABER auch Bedienung. Die Aktionsspalte einer Tabelle enthaelt
     Knoepfe ("Resend", "Revoke"), und die sind Oberflaeche. Gemessen in team-orga: mit einer
     einzigen Liste blieben genau diese zwei Knoepfe englisch, waehrend alles um sie herum
     uebersetzt war. Ein Knopf in einer Zelle wird darum durchgelassen -- ein Markenname steht nie
     in einem Knopf, und wo er es doch tut (ein Chip), greift die HART-Liste. */
  var SPRACHE_HART = "[class*='-chip'], [class*='-tag'], input, textarea, [contenteditable]," +
                     "script, style, code, pre";
  var SPRACHE_ZELLE = ".up-td, [class*='-td'], [class*='-cell']";
  var SPRACHE_KNOPF = "button, [role='button']";
  function spracheDarf(el){
    try {
      if (el.closest(SPRACHE_HART)) return false;
      if (el.closest(SPRACHE_ZELLE) && !el.closest(SPRACHE_KNOPF)) return false;
    } catch(e){ return false; }
    return true;
  }
  /* ---- Beschriftungen, die in ATTRIBUTEN stehen ------------------------------------------------
     aria-label, placeholder, title und data-tip sind Text, den der Nutzer liest (oder hoert), und
     der Lauf ueber die Textknoten kommt nicht an sie heran. Gemessen an der prompts-table: nach
     dem Umstellen standen dort noch ein Dutzend englische Beschriftungen -- "Switch to list view",
     "Clear selection", "Search prompts", "Rows per page", "Previous page" und so weiter.

     KEIN zweites data-Attribut zum Merken. Der Rueckweg laeuft ueber einen umgekehrten Index des
     Katalogs: aus {englisch: deutsch} wird {deutsch: englisch}, und damit ist zu jedem Wert die
     Vorlage bekannt, ohne sie irgendwo abzulegen. Bei zwei Eintraegen mit derselben Uebersetzung
     gewinnt der erste -- das ist harmlos, beide fuehren auf denselben deutschen Text zurueck. */
  var I18N_ATTR = ["aria-label", "placeholder", "title", "data-tip", "data-tiplabel"];
  var _rueckIndex = null;
  function rueckIndex(){
    if (_rueckIndex) return _rueckIndex;
    var r = {};
    Object.keys(MSG).forEach(function(l){
      var m = MSG[l] || {};
      Object.keys(m).forEach(function(k){ if (r[m[k]] == null) r[m[k]] = k; });
    });
    _rueckIndex = r;
    return r;
  }
  /* Der englische Schluessel zu einem beliebigen Wert: entweder ist er selbst einer, oder er ist
     eine Uebersetzung und der umgekehrte Index kennt seine Vorlage. */
  function englischVon(v){
    if (t(v) !== v) return v;
    var r = rueckIndex();
    return r[v] != null ? r[v] : v;
  }
  function attributeStellen(wurzel){
    var sel = I18N_ATTR.map(function(a){ return "[" + a + "]"; }).join(",");
    var els;
    try { els = wurzel.querySelectorAll(sel); } catch(e){ return; }
    for (var i = 0; i < els.length; i++){
      var el = els[i];
      for (var a = 0; a < I18N_ATTR.length; a++){
        var name = I18N_ATTR[a], v = el.getAttribute(name);
        if (!v) continue;
        v = String(v);
        if (v.length > 200) continue;
        var neu = t(englischVon(v));
        if (neu !== v) el.setAttribute(name, neu);
      }
    }
  }
  function spracheLauf(scope){
    var wurzel = (scope && scope.querySelectorAll) ? scope : document;
    var els;
    try { els = wurzel.querySelectorAll(SPRACHE_SEL); } catch(e){ els = []; }
    for (var i = 0; i < els.length; i++) knotenStellen(els[i]);
    /* Alles, was SCHON EINMAL angefasst wurde, in JEDER Sprache erneut pruefen -- nicht nur beim
       Zurueckschalten auf Englisch. Der breite Lauf unten ueberspringt diese Elemente ausdruecklich
       (er nimmt an, der schnelle Weg habe sie), und der schnelle Weg kennt nur seine Selektoren.
       Ein Knopf ausserhalb beider Listen blieb dadurch in der Sprache stehen, in die er zuletzt
       geraten war: gemessen "Hide pages" nach de -> en -> de. Eine Abfrage auf [data-i18n] ist
       billig, weil das Attribut nur dort steht, wo wirklich uebersetzt wurde. */
    var schon;
    try { schon = wurzel.querySelectorAll("[data-i18n]"); } catch(e){ schon = []; }
    for (var z = 0; z < schon.length; z++) knotenStellen(schon[z]);
    attributeStellen(wurzel === document ? document.body || document : wurzel);
    if (getPref("locale") === "en") return;
    breiterLauf(wurzel);
  }
  /* data-i18n haelt den englischen Text, aus dem der aktuelle entstanden ist. Der Knackpunkt ist
     der WECHSEL: eine Komponente schreibt "Hide pages" in einen Knopf, an dem noch
     data-i18n="Show pages" haengt. Wer dann stumpf t("Show pages") schreibt, macht aus "Hide"
     wieder "Show" -- die Beschriftung waere falsch, nicht nur englisch.
     Also drei Faelle, in dieser Reihenfolge:
       - der Text ist die Uebersetzung der Vorlage -> nichts zu tun,
       - der Text ist die Vorlage selbst           -> uebersetzen,
       - der Text ist etwas DRITTES                -> er ist neu, also neu schluesseln.
     Damit stimmt es auch beim Zurueckschalten auf Englisch: dort ist t(basis) === basis, und ein
     Text, den die Komponente inzwischen ersetzt hat, wird nicht mit dem alten ueberschrieben. */
  /* Stammt der aktuelle Text von dieser Vorlage ab -- in IRGENDEINER Sprache?
     Gefragt wird der Katalog und nicht t(): t() antwortet nur fuer die GERADE eingestellte
     Sprache, und genau daran ist der Rueckweg gescheitert. Gemessen: nach dem Umschalten auf
     Englisch stand am Knopf "Seiten zeigen"; t("Show pages") gab dann "Show pages" zurueck, also
     galt der deutsche Text als etwas Drittes, wurde neu geschluesselt -- und blieb deutsch. */
  function istAbleitung(basis, jetzt){
    if (jetzt === basis) return true;
    for (var l in MSG){
      if (MSG[l] && MSG[l][basis] === jetzt) return true;
    }
    return false;
  }
  function knotenStellen(el){
    var kn = eigenerText(el);
    if (!kn) return;
    var roh = kn.nodeValue;
    var jetzt = roh.trim();
    if (!jetzt) return;
    var basis = el.getAttribute("data-i18n");
    if (basis == null || !istAbleitung(basis, jetzt)) basis = jetzt;
    var neu = t(basis);
    if (jetzt === neu){
      /* Schon richtig. Den Schluessel nur nachziehen, wenn er ueberhaupt schon dransteht -- sonst
         bekaeme jedes Element der Seite ein Attribut, nur weil der Beobachter es gestreift hat. */
      if (el.getAttribute("data-i18n") != null && el.getAttribute("data-i18n") !== basis)
        el.setAttribute("data-i18n", basis);
      return;
    }
    /* Die umgebenden Leerzeichen bleiben, wie sie sind: im Markup steht der Text oft eingerueckt
       auf eigener Zeile, und sie wegzunehmen aendert den Abstand zum Nachbarn. */
    el.setAttribute("data-i18n", basis);
    kn.nodeValue = roh.match(/^\s*/)[0] + neu + roh.match(/\s*$/)[0];
  }
  /* EIN Element pruefen -- fuer den characterData-Zweig des Beobachters. Dieselben Regeln wie im
     breiten Lauf, nur ohne den Durchlauf: das ist der billige Fall und er muss billig bleiben. */
  /* EIN Element, fuer den Beobachter. Traegt es schon einen Schluessel, wird es immer geprueft --
     auch bei englischer Sprache, denn dort muss der englische Text zurueck. */
  function spracheEinen(el){
    if (!el || !el.getAttribute) return;
    if (el.getAttribute("data-i18n") != null){ knotenStellen(el); return; }
    if (getPref("locale") === "en") return;
    if (!spracheDarf(el)) return;
    var kn = eigenerText(el);
    if (!kn) return;
    var text = (kn.nodeValue || "").trim();
    if (!text || text.length > 200 || t(text) === text) return;
    knotenStellen(el);
  }
  function breiterLauf(wurzel){
    var start = (wurzel === document) ? document.body : wurzel;
    if (!start || !window.NodeFilter || !document.createTreeWalker) return;
    var w;
    try { w = document.createTreeWalker(start, NodeFilter.SHOW_TEXT, null); } catch(e){ return; }
    var kn;
    while ((kn = w.nextNode())){
      var roh = kn.nodeValue;
      if (!roh) continue;
      var text = roh.trim();
      /* Erst der billige Test: steht der Text ueberhaupt im Katalog? Er ist ein Zugriff auf ein
         Objekt und faellt fuer die ueberwaeltigende Mehrheit der Knoten sofort durch. Alles
         Teurere -- closest() den Baum hinauf -- kommt erst danach. */
      if (!text || text.length > 200) continue;
      var neu = t(text);
      if (neu === text) continue;
      var el = kn.parentElement;
      if (!el) continue;
      if (el.getAttribute("data-i18n") != null) continue;   /* macht schon der schnelle Weg */
      if (!spracheDarf(el)) continue;
      if (!eigenerText(el)) continue;                       /* zwei Textstuecke: nicht anfassen */
      el.setAttribute("data-i18n", text);
      kn.nodeValue = roh.match(/^\s*/)[0] + neu + roh.match(/\s*$/)[0];
    }
  }

  /* ---- Filter, der NUR als Funktion auf der Seite liegt ---------------------------------------
     Die drei Filter-Dropdowns werden von der Filterleiste eingezogen; auf der Seite selbst muessen
     sie nur noch DA sein, damit es sie gibt. Wer sie als 1x1-Element platziert, will ihren
     Trigger nicht sehen und nicht anklicken koennen.

     Erkannt wird das am WIRT und nicht an einer Einstellung: ist der Elternknoten 1 bis 4 Pixel
     gross, ist das Absicht. Unter 1 wird ausdruecklich NICHT gegriffen -- ein Container, der noch
     nicht ausgelegt ist, misst 0x0, und ein Filter, der deswegen fuer einen Augenblick
     verschwindet, blinkt sichtbar.

     Ein Filter, den eine Leiste eingezogen hat, ist nie gemeint: __ufbHost steht dann an ihm, und
     sein Trigger ist dort ohnehin ausgeblendet (die Zeile der Leiste IST der Trigger). Damit
     bleibt auch der Topics-Filter in Mira unberuehrt -- er sitzt in einem normal grossen Kasten. */
  var NURFUNKTION_SEL = ".utf-root, .umf-root, .umk-root";
  function nurFunktionLauf(){
    var els;
    try { els = document.querySelectorAll(NURFUNKTION_SEL); } catch(e){ return; }
    for (var i = 0; i < els.length; i++){
      var el = els[i], wirt = el.parentElement, winzig = false;
      if (!el.__ufbHost){
        /* ZUERST der ausdrueckliche Weg. Die Groessenerkennung darunter hat auf der echten Seite
           nicht gegriffen (gemeldet am 01.09.: "noch seh ich die und die sind anklickbar"), und
           das ist auch kein Wunder -- was Bubble um ein Element herum baut, ist eine Gruppe mit
           eigenem Polster, und die ist selten wirklich 1x1. Ein Attribut raet nicht.
               <div class="up-root utf-root" data-nurfunktion="yes" …>
           isYes nimmt yes/true/1, also auch einen Bubble-Ja/Nein-Ausdruck als Text. */
        if (isYes(el.getAttribute("data-nurfunktion"))) winzig = true;
        else {
          /* Der Rueckfall, jetzt ueber die GANZE Kette nach oben und nicht nur ueber den direkten
             Elternknoten. Genau daran ist er gescheitert: Bubble legt um den Inhalt eines
             HTML-Elements mehrere Huellen, und die eine, die wirklich 1x1 ist, sitzt zwei oder drei
             Ebenen darueber. Gemeldet als "die liegen 1x1 auf der Seite, SICHTBAR, und ein Klick in
             dem Bereich setzt den Filter" -- der Trigger laeuft aus dem kleinen Kasten heraus, weil
             der overflow nicht klemmt.
             Sechs Ebenen reichen: mehr Huellen legt Bubble um ein Element nicht.
             Bis 12px, weil eine solche Huelle Polster tragen kann. Unter 1 wird weiter NICHT
             gegriffen -- ein Container, der noch nicht ausgelegt ist, misst 0x0, und ein Filter, der
             deswegen kurz verschwindet, blinkt sichtbar.
             offsetWidth/offsetHeight und nicht getBoundingClientRect: Layoutwerte, unabhaengig von
             einem transform an einem Vorfahren. */
          var v = el.parentElement, tiefe = 0;
          while (v && tiefe < 6 && v !== document.body && v !== document.documentElement){
            var w = v.offsetWidth, h = v.offsetHeight;
            if (w >= 1 && w <= 12 && h >= 1 && h <= 12){ winzig = true; break; }
            v = v.parentElement; tiefe++;
          }
        }
      }
      if (el.classList.contains("up-nurfunktion") !== winzig) el.classList.toggle("up-nurfunktion", winzig);
    }
  }

  function toolbarLauf(knoten){
    if (window.__upOhneToolbar) return;
    sicher("spracheLauf", function(){ spracheLauf(); });
    sicher("nurFunktionLauf", nurFunktionLauf);
    sicher("stampToolbarIcons", stampToolbarIcons);
    sicher("stampGran", stampGran);
    sicher("orderToolbars", orderToolbars);
    /* segLauf haengt Elemente EIN und liest Layoutwerte. Beides gehoert nicht in denselben
       Augenblick, in dem die Seite gerade gezeichnet wird -- Bubble baut seine Gruppen ueber
       jQuery.html(), und ein fremder Knoten, der mitten in diesem Durchgang dazukommt, trifft auf
       eine Buchfuehrung, die gerade laeuft. Deshalb erst im naechsten Zug.
       NUR die neu dazugekommenen Teilbaeume, wenn welche genannt sind. Der Beobachter feuert
       waehrend einer Ziehbewegung dauernd -- Legenden, Tooltips und Charts haengen Knoten ein --,
       und jeder Lauf mass bis hierher SAEMTLICHE Umschalter der Seite mit vier Werten je Stueck.
       In der Messung des Nutzers war das nach der Resize-Drossel immer noch der groesste Posten:
       3378 von 6913 Lesezugriffen. Ein frisch eingehaengter Teilbaum enthaelt fast nie einen
       Umschalter, also kostet der Lauf dann auch nichts. */
    setTimeout(function(){
      if (knoten && knoten.length){
        for (var i = 0; i < knoten.length; i++){
          (function(k){
            if (!k || !k.isConnected) return;
            sicher("segLauf", function(){ segLauf(k); });
          })(knoten[i]);
        }
        return;
      }
      sicher("segLauf", segLauf);
    }, 0);
  }
  /* Die Aufrufe, die kamen, bevor es die Funktionen gab. Der Kopf der Seite legt sie in
     window.__upFrueh (siehe bubble/page_header_preload.html); hier werden sie abgearbeitet, sobald
     die echte Funktion steht. Mehrfach, weil die Komponenten zu verschiedenen Zeiten ankommen --
     was bis zuletzt keine echte Funktion hat, faellt still weg: eine Fehlermeldung dafuer waere
     eine ueber eine Komponente, die auf dieser Seite gar nicht steht. */
  function frueheNachholen(){
    var q = window.__upFrueh;
    if (!q || !q.length) return;
    var rest = [];
    for (var i = 0; i < q.length; i++){
      var name = q[i][0], args = q[i][1], fn = window[name];
      if (typeof fn === "function" && !fn.__upShim){
        (function(f, a, n){ sicher(n, function(){ f.apply(window, a); }); })(fn, args, name);
      } else rest.push(q[i]);
    }
    window.__upFrueh = rest;
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function(){ toolbarLauf(); });
  else toolbarLauf();
  frueheNachholen();
  [60, 250, 700, 1500, 3000].forEach(function(ms){ setTimeout(frueheNachholen, ms); });
  [60, 250, 700, 1500, 3000].forEach(function(ms){ setTimeout(function(){ toolbarLauf(); }, ms); });
  /* ── Der Beobachter, und warum er so aussieht ─────────────────────────────────────────────
     Hier stand ein MutationObserver auf document.documentElement mit childList+subtree, der bei
     JEDER Mutation sofort stampToolbarIcons() rief. Das war eine echte Bremse fuer die ganze App,
     und zwar aus drei Gruenden zugleich:
       1. Er feuerte bei jeder DOM-Aenderung irgendwo auf der Seite -- und eine Bubble-Seite
          aendert dauernd etwas.
       2. Jeder Lauf durchsuchte das Dokument 19 Mal (ein querySelectorAll pro Knopfklasse).
       3. Er trieb sich selbst an: das Ersetzen des SVG ist selbst eine childList-Mutation.
     Am schlimmsten traf es die Chart-Tooltips. Deren external-Handler schreibt bei JEDER
     Mausbewegung el.innerHTML neu -- also 19 dokumentweite Suchen pro Mausbewegung, waehrend
     gleichzeitig eine rAF-Schleife das Tooltip bewegen soll. Genau das war das Ruckeln.
     Jetzt: nur auf HINZUGEKOMMENE Elemente reagieren (ein Attribut- oder Textwechsel bringt keine
     neuen Knoepfe), gebuendelt auf einen Lauf je 250ms, und die eigenen Mutationen mit
     takeRecords() wegwerfen, damit der Lauf sich nicht selbst nachtriggert. */
  if (window.MutationObserver){
    var stampGeplant = false;
    /* Die Teilbaeume, die seit dem letzten Lauf dazugekommen sind. null heisst "zu viele, lauf
       ueber alles" -- siehe die Deckelung unten. */
    var segKnoten = [];
    var stampObs = new MutationObserver(function(muts){
      /* TEXTaenderungen zuerst, und getrennt von allem anderen. Eine Komponente, die nur ihren
         Knopftext tauscht ("Show pages" -> "Hide pages"), haengt keinen Knoten ein -- das ist eine
         characterData-Mutation. Ohne diesen Zweig lief der Sprachlauf erst beim naechsten
         beliebigen Umbau, und der Knopf stand solange englisch da. Genau so gemeldet.
         Keine Schleife: der Lauf schreibt nur, wenn der Text noch nicht uebersetzt ist -- die
         Mutation aus seinem eigenen Schreiben findet nichts mehr zu tun. */
      for (var c = 0; c < muts.length; c++){
        var mz = null;
        if (muts[c].type === "characterData"){
          mz = muts[c].target && muts[c].target.parentElement;
        } else {
          /* UND der Fall, der wirklich vorkommt: textContent = "…" ERSETZT den Textknoten, das ist
             also keine characterData-Mutation, sondern eine childList mit einem neuen TEXTknoten.
             Gemessen am Show/Hide-Knopf: mit dem characterData-Zweig allein blieb er englisch. */
          var neuT = muts[c].addedNodes;
          for (var nt = 0; nt < neuT.length; nt++){
            if (neuT[nt].nodeType !== 3) continue;
            var p3 = neuT[nt].parentElement;
            if (p3) sicher("spracheKnoten", (function(el){ return function(){ spracheEinen(el); }; })(p3));
          }
        }
        if (mz) sicher("spracheKnoten", (function(el){ return function(){ spracheEinen(el); }; })(mz));
      }
      var neueElemente = false;
      for (var i = 0; i < muts.length && !neueElemente; i++){
        var an = muts[i].addedNodes;
        for (var j = 0; j < an.length; j++){
          if (an[j].nodeType === 1){ neueElemente = true; break; }
        }
      }
      if (!neueElemente) return;
      /* Die KURZEN Beschriftungen sofort, noch in diesem Rueckruf. Ein Beobachter-Rueckruf ist ein
         Microtask: er laeuft vor dem naechsten Bild. Alles andere darf warten, das hier nicht --
         eine Komponente, die ihre Werkzeugleiste neu zeichnet, schreibt "Day Week Month" hinein,
         und wer erst 250ms spaeter kuerzt, laesst genau das einmal aufblitzen. Gemeldet beim
         Wechsel zwischen Domain- und URL-Modus auf der Citations-Seite.
         Nur die betroffenen Aeste und nicht das ganze Dokument: stampGran nimmt eine Wurzel, und
         teurer als ein querySelectorAll auf einem frischen Knoten ist das nicht. */
      for (var m = 0; m < muts.length; m++){
        var zu = muts[m].addedNodes;
        for (var n = 0; n < zu.length; n++){
          if (zu[n].nodeType !== 1) continue;
          sicher("stampGran", (function(el){ return function(){ stampGran(el); }; })(zu[n]));
          /* Die SPRACHE aus demselben Grund sofort und nicht in 250ms. Genau das war gemeldet:
             "alle englischen Texte stehen beim Laden noch drin und wechseln kurz danach zu
             deutsch". Der Rueckruf eines Beobachters ist ein Microtask und laeuft VOR dem
             naechsten Bild -- wer hier uebersetzt, laesst nichts aufblitzen. Nur der frische Ast,
             nicht das ganze Dokument. */
          sicher("spracheLauf", (function(el){ return function(){ spracheLauf(el); }; })(zu[n]));
          /* Fuer den Streifen merken, WAS dazugekommen ist -- gemessen wird gleich nur das,
             nicht die ganze Seite. Nach oben gedeckelt: wer hundert Knoten auf einmal einhaengt,
             baut die Seite neu, und dann ist ein Lauf ueber alles billiger als hundert kleine. */
          if (segKnoten && segKnoten.length < 40) segKnoten.push(zu[n]);
          else segKnoten = null;
        }
      }
      if (stampGeplant) return;
      stampGeplant = true;
      setTimeout(function(){
        stampGeplant = false;
        /* Der GANZE Lauf und nicht nur die zwei Toolbar-Teile: hier standen stampToolbarIcons und
           orderToolbars einzeln, und alles, was spaeter dazukam, fehlte -- die kurzen
           Beschriftungen D/W/M und der gleitende Streifen der Umschalter erreichten damit jeden
           Umschalter nicht, der erst nach dem Seitenaufbau entsteht (Drawer, View, ein Schritt im
           Onboarding). Genau so gemessen: im Onboarding hatte der Umschalter des
           Geschaeftsmodells keinen Streifen, bis irgendwo geklickt wurde. */
        var k = segKnoten; segKnoten = [];   /* null = Deckelung erreicht -> Lauf ueber alles */
        toolbarLauf(k);
        /* Die Mutationen, die der Lauf selbst erzeugt hat, verwerfen -- sonst haengt an jedem
           getauschten Icon sofort der naechste Lauf. */
        try { stampObs.takeRecords(); } catch(e){}
      }, 250);
    });
    stampObs.observe(document.documentElement,
                     { childList: true, subtree: true, characterData: true });
  }

  /* Tooltip for text that is clamped/ellipsised — shows the full string only when it actually
     does not fit. prompts-table grew this first; responses-table needs the identical behaviour
     for its Prompt column, so it lives here instead of being copied.
       tips    — the object makeTooltips() returned
       wrapSel — the hover target (the cell/wrapper)
       textSel — the clamped element inside it (defaults to wrapSel)  */
  function makeClipTip(root, tips, wrapSel, textSel, delay){
    var timer = null, current = null;
    var wait = delay == null ? 400 : delay;
    root.addEventListener("mouseover", function(e){
      var wrap = e.target.closest(wrapSel);
      if (!wrap || wrap === current) return;
      current = wrap;
      /* Same unsuppress the delegated [data-tip] path does: entering a new trigger clears the
         suppression a previous click left behind. These wrappers carry no data-tip of their own,
         so nothing else would ever lift it. */
      if (tips.unsuppress) tips.unsuppress();
      clearTimeout(timer);
      timer = setTimeout(function(){
        var el = textSel ? wrap.querySelector(textSel) : wrap;
        if (!el) return;
        var clipped = el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1;
        if (clipped) tips.showTipWide(el, el.textContent);
      }, wait);
    });
    root.addEventListener("mouseout", function(e){
      var wrap = e.target.closest(wrapSel);
      if (!wrap || wrap !== current) return;
      var to = e.relatedTarget;
      if (to && to.closest && to.closest(wrapSel) === wrap) return;
      current = null; clearTimeout(timer); tips.hideTip();
    });
  }

  function makeTooltips(root, getIsDark){
    var tip = window.__upTipEl;
    if (!tip || !document.body.contains(tip)){
      tip = document.createElement("div");
      tip.className = "up-tip";
      document.body.appendChild(tip);
      window.__upTipEl = tip;
    }
    var S = window.__upTipState || (window.__upTipState = {
      timer: null, btn: null, placedRect: null, lastScrollAt: 0, wide: false, suppressed: false
    });

    function placeTip(){
      if (!S.btn) return;
      tip.style.transform = "";
      var r = S.btn.getBoundingClientRect();
      /* Die Masse ueber offsetWidth/offsetHeight, NICHT indem der Tooltip zum Messen nach 0,0
         geschoben wird. Das alte Vorgehen setzte left und top auf 0, las die Groesse und setzte
         danach die echte Position -- zeichnete der Browser dazwischen einen Frame, blitzte der
         Tooltip in der linken oberen Ecke auf. Beim Scrollen lief das alle 150ms, und genau das
         war das "Springen nach oben". offsetWidth/offsetHeight brauchen keine Verschiebung. */
      var tr = { width: tip.offsetWidth, height: tip.offsetHeight };
      var vw = window.innerWidth || document.documentElement.clientWidth;
      var vh = window.innerHeight || document.documentElement.clientHeight;
      /* data-tip-place="right": rechts NEBEN dem Ausloeser statt darunter. Gebraucht von der
         eingeklappten Sidebar -- dort ist unterhalb eines Icons schon das naechste Icon, ein
         Tooltip darunter wuerde es verdecken und beim Weiterfahren flackern. Reicht der Platz
         rechts nicht, kippt er nach links; passt beides nicht, bleibt es beim Platz darunter. */
      if (S.btn.getAttribute("data-tip-place") === "right"){
        /* offsetWidth/offsetHeight statt der Rechtecke: die Einblendung laeuft ueber transform,
           und ein Rechteck mitten in dieser Bewegung ist um die halbe Verschiebung falsch --
           gemessen sass der Chip dadurch 4px zu tief. Layoutwerte kennen keinen transform. */
        var tw = tip.offsetWidth, th = tip.offsetHeight;
        var lx = r.right + 8;
        if (lx + tw + 6 > vw){
          var links = r.left - 8 - tw;
          lx = links >= 6 ? links : Math.max(6, vw - tw - 6);
        }
        tip.style.left = lx + "px";
        tip.style.top = Math.max(6, Math.min(r.top + r.height / 2 - th / 2, vh - th - 6)) + "px";
        /* Die Grundregel von .up-tip schiebt den Chip um 4px nach unten und faehrt ihn von dort
           ein. Rechts angesetzt ist das falsch: er soll auf der Mitte des Ausloesers sitzen, und
           gemessen sass er dadurch 4px zu tief. Also keine Verschiebung -- und den Uebergang auf
           transform gleich mit weg, sonst ruckt der Chip die 4px noch sichtbar zurueck, statt
           gleich richtig zu stehen. Eingeblendet wird allein ueber die Deckkraft.
           Inline und nicht per Klasse: eine Regel mit .up-tip.is-right verlor gegen die
           Grundregel, gemessen blieb translateY(4px) aktiv. */
        tip.style.transitionProperty = "opacity";
        tip.style.transform = "none";
        S.placedRect = r;
        return;
      }
      /* the wide variant left-aligns to the trigger (long text, centring looks arbitrary),
         the normal chip centres under it */
      var left = S.wide ? r.left : (r.left + r.width / 2 - tr.width / 2);
      tip.style.left = Math.max(6, Math.min(left, vw - tr.width - 6)) + "px";
      /* Unter dem Ausloeser, solange dort Platz ist -- sonst darueber. Vorher stand er immer
         darunter und lief am unteren Rand aus dem Bild: der Tooltip war dann da, aber nicht zu
         sehen, was von "springt weg" nicht zu unterscheiden ist. */
      var untenNoetig = r.bottom + 8 + tr.height + 6;
      tip.style.top = (untenNoetig <= vh || r.top - 8 - tr.height < 6)
        ? (r.bottom + 8) + "px"
        : (r.top - 8 - tr.height) + "px";
      S.placedRect = r;
    }
    function hideTip(){
      clearTimeout(S.timer); S.timer = null; S.btn = null; S.placedRect = null;
      /* clear any leftover inline transform from the scroll nudge, otherwise it would beat the
         CSS translateY fade-out and the chip would just blink off */
      tip.style.transform = "";
      /* Die Sonderbehandlung der rechten Platzierung zuruecknehmen -- der naechste Chip kann
         wieder unter seinem Ausloeser sitzen und soll dann normal einfahren. */
      tip.style.transitionProperty = "";
      tip.classList.remove("is-on"); tip.classList.remove("is-wide");
    }
    function paint(el, text, wide){
      if (!text || !el || !document.contains(el)) return;
      /* Belt-and-suspenders for hover-reveal buttons (chart settings gears and anything else that
         fades in on its own delay): if the browser somehow still delivers a mouseover for an
         element sitting at opacity:0 — a stale CDN pin still on the old timing, or a browser that
         doesn't recompute :hover the instant a CSS transition-delay elapses under an already-
         stationary cursor — this is the one choke point every tip-showing path (showTip/
         showTipText/showTipWide) funnels through, so it's the one place that needs the check. */
      if (getComputedStyle(el).opacity === "0") return;
      var host = el.closest ? el.closest(".up-root") : null;
      var dark = host ? host.getAttribute("data-theme") === "dark" : !!(getIsDark && getIsDark());
      /* Uebersetzt wird HIER, an der einen Stelle, durch die jeder Tooltip der App laeuft
         (showTip, showTipText, showTipWide muenden alle in paint). Das ist der Grund fuer diese
         Wahl und nicht Bequemlichkeit: die data-tip-Texte stehen im handgemachten Bubble-Markup
         der elf Kopfzeilen, und das ist vom Pin aus nicht erreichbar. Wer nicht im Katalog steht,
         geht unveraendert durch -- t_ gibt unbekannten Text zurueck, wie er kam. */
      tip.textContent = t_(text);
      tip.classList.toggle("is-wide", !!wide);

      S.wide = !!wide;
      tip.setAttribute("data-theme", dark ? "dark" : "light");
      tip.classList.add("is-on");
      S.btn = el;
      placeTip();
    }
    /* showTip/showTipText/showTipWide are immediate (a component asking explicitly already
       decided); only the delegated hover path below applies the 60ms delay. */
    function showTip(el){ if (!S.suppressed) paint(el, el.getAttribute("data-tip"), false); }
    function showTipText(el, t){ if (!S.suppressed) paint(el, t, false); }
    function showTipWide(el, text){ if (!S.suppressed) paint(el, text, true); }

    if (!root.__upTipBound){
      root.__upTipBound = true;
      /* S.lastScrollAt guards these: scrolling moves content under a completely stationary
         cursor and the browser recomputes hover as different elements pass under it. Without
         suppressing that, a mid-scroll phantom mouseout on the tipped button (or mouseover on
         some other [data-tip] scrolling past) fought the transform-nudge below — which is what
         read as the tooltip "jumping wildly" while scrolling instead of tracking one target. */
      root.addEventListener("mouseover", function(e){
        if (Date.now() - S.lastScrollAt < 200) return;
        var el = e.target.closest("[data-tip]");
        if (el && root.contains(el)){
          if (el === S.btn) return;                       // already showing for this button
          S.suppressed = false; S.btn = el;
          clearTimeout(S.timer);
          S.timer = setTimeout(function(){ showTip(el); }, 60);
          return;
        }
        var bt = e.target.closest("[data-brandtip]");
        if (bt && root.contains(bt)){
          if (bt === S.btn) return;
          S.suppressed = false; S.btn = bt;
          clearTimeout(S.timer);
          S.timer = setTimeout(function(){ showTipText(bt, bt.getAttribute("data-brandtip")); }, 60);
        }
      });
      root.addEventListener("mouseout", function(e){
        if (Date.now() - S.lastScrollAt < 200) return;
        var el = e.target.closest("[data-tip],[data-brandtip]");
        if (!el) return;
        if (e.relatedTarget && el.contains(e.relatedTarget)) return;   // still inside the trigger
        if (el === S.btn){ S.suppressed = false; hideTip(); }
      });
      /* A click means the user acted — keep the tip down until they leave and come back, rather
         than having it pop up again over whatever the click just opened. */
      root.addEventListener("mousedown", function(){ S.suppressed = true; hideTip(); });
      root.addEventListener("click", function(){ S.suppressed = true; hideTip(); });
    }

    /* One global safety net for the whole page — it operates on the shared state, so it does not
       matter which root's call installed it. */
    if (!window.__upTipGlobalBound){
      window.__upTipGlobalBound = true;
      /* if a button is removed or replaced mid-hover its mouseout never fires, so verify on each
         move that the anchor still exists and is still hovered */
      document.addEventListener("mousemove", function(){
        if (!tip.classList.contains("is-on") && !S.timer) return;
        if (!S.btn || !document.contains(S.btn)){ hideTip(); return; }
        var still = false;
        try { still = S.btn.matches(":hover"); } catch(err){ still = true; }
        if (!still) hideTip();
      });
      /* Keep an open tooltip glued to its trigger while the page scrolls: a cheap
         compositor-only transform nudge per frame, then one full reposition once scrolling
         settles. Just hiding on scroll reads as "the tooltip vanished", not "it is attached". */
      var repositionRaf = null, settleTimer = null;
      window.addEventListener("scroll", function(){
        S.lastScrollAt = Date.now();
        if (!S.btn) return;
        if (repositionRaf) return;
        repositionRaf = requestAnimationFrame(function(){
          repositionRaf = null;
          if (!S.btn || !S.placedRect) return;
          var r = S.btn.getBoundingClientRect();
          /* Ist der Ausloeser aus dem Bild gescrollt, hat ein Tooltip an seiner Stelle keinen
             Sinn mehr -- er stand vorher irgendwo am Rand und zeigte auf nichts. */
          var vh = window.innerHeight || document.documentElement.clientHeight;
          if (r.bottom < 0 || r.top > vh){ hideTip(); return; }
          tip.style.transform = "translate(" + Math.round(r.left - S.placedRect.left) + "px," + Math.round(r.top - S.placedRect.top) + "px)";
          clearTimeout(settleTimer);
          /* Das Nachsetzen erst, wenn das Scrollen WIRKLICH ruht. Vorher lief es stur 150ms nach
             dem letzten Frame -- bei laufendem Scrollen also mitten in der Bewegung, und dann
             kaempften zwei Positionen um dasselbe Element: das Transform folgte der alten
             Verankerung, placeTip setzte eine neue. Das war das Springen. */
          settleTimer = setTimeout(function(){
            if (!S.btn) return;
            if (Date.now() - S.lastScrollAt < 140){ return; }
            placeTip();
          }, 160);
        });
      }, { capture: true, passive: true });
      window.addEventListener("blur", hideTip);
    }
    /* Lifts the post-click suppression above. A component that drives its own hover-tooltip (the
       "show the full title only when it is actually clipped" pattern in the tables) has to call
       this from its own mouseover handler, because the delegated [data-tip] path — the only place
       that clears `suppressed` — never runs for those elements: they carry no data-tip, since the
       decision to show anything at all depends on a measurement. Without it, one click anywhere in
       the component (opening a drilldown, sorting, paging) silenced every truncation tooltip until
       the user happened to hover some unrelated icon button. */
    function unsuppress(){ S.suppressed = false; }
    return { showTip: showTip, showTipText: showTipText, showTipWide: showTipWide,
             hideTip: hideTip, unsuppress: unsuppress, el: tip };
  }

  /* ---- topic color palette + emoji library ----
     Extracted from topics-manager.js/prompts-table.js, which each carried a byte-identical copy
     (per STYLEGUIDE §25: duplicate first, extract once a SECOND consumer needs the exact same
     thing — prompts-table's own "Add Topic" button opening this same modal is that second
     consumer). Rows are tone bands (vibrant/muted/deep), columns are hues — scanning down picks a
     mood, across picks a color. Only hex_light is ever rendered anywhere in the app, so these are
     tuned to read acceptably in BOTH themes at once rather than getting a per-theme pass. */
  var TOPIC_COLOR_PALETTE = [
    /* vibrant */ "#de1b22", "#b65616", "#8d6a11", "#108440", "#107c84", "#1b6eda", "#9145e8", "#d51a8b", "#666666", "#7d7d7d",
    /* muted   */ "#b47476", "#a87b5d", "#988552", "#4f926b", "#509195", "#6a88af", "#977ab8", "#b27098", "#787878", "#949494",
    /* deep    */ "#ab2b2f", "#8b4c23", "#725a1d", "#1b6a3c", "#1b656a", "#295ea3", "#7a33cc", "#a32972", "#575757", "#6f6f6f"
  ];
  function swatchInk(hex){
    var h = String(hex).replace("#", "");
    function lin(c){ c = parseInt(c, 16) / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
    var y = 0.2126 * lin(h.slice(0,2)) + 0.7152 * lin(h.slice(2,4)) + 0.0722 * lin(h.slice(4,6));
    return y > 0.179 ? "#151515" : "#ffffff";
  }
  var EMOJI_LIB_URL = "https://cdn.jsdelivr.net/npm/emoji-picker-element@^1/index.js";
  var emojiLibPromise = null;
  function ensureEmojiLib(){
    if (window.customElements && window.customElements.get("emoji-picker")) return;
    if (emojiLibPromise) return;
    emojiLibPromise = true;
    var s = document.createElement("script");
    s.type = "module";
    s.textContent = 'import "' + EMOJI_LIB_URL + '";';
    document.head.appendChild(s);
  }

  var CLOSE_SVG_TM = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18" /> <path d="m6 6 12 12" /></svg>';
  var SMILE_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 10V9" /> <path d="M16.472 15a6 6 0 01-8.943 0" /> <path d="M9 10V9" /> <circle cx="12" cy="12" r="10" /></svg>';

  /* ---- shared topic create/edit modal ----
     One modal, two consumers: topics-manager (create + edit + delete, its own page) and
     prompts-table's "Add Topic" button (create only, no delete — the caller simply never passes
     onDelete). Deliberately does NOT fire any Bubble event itself and does NOT know the word
     "selection" — it only ever hands the caller a clean draft {name, emoji, hex_light, hex_dark}
     (+ id when editing) via cfg.onSave, and lets the caller decide what event name / extra fields
     (a bulk selection payload, in prompts-table's case) to wrap it in. This is exactly why it
     can't hardcode data-add-fn/data-edit-fn the way it used to when it only lived in
     topics-manager.js — the two callers fire completely different events with different payload
     shapes for what is, from the modal's point of view, the identical "user finished a draft" action.
     Body-mounted (position:fixed backdrop) for the same reason the bulk-bar and every other
     document.body-mounted surface in this library is: it must never be clipped by whatever
     Bubble container happens to hold the component that opened it. Not routed through
     UC.makePopover — that primitive's open() closes every OTHER popover on the page, which is
     right for a corner dropdown but wrong for a true modal (opening a dropdown elsewhere must not
     silently close this). Hand-rolled instead: blur focus before hiding (aria-hidden-on-ancestor-
     of-focused-element is a Chrome accessibility trap), plus its own Escape listener scoped to
     just this modal instance. */
  function makeTopicModal(cfg){
    cfg = cfg || {};
    var getIsDark = cfg.getIsDark || function(){ return false; };
    var palette = cfg.palette || TOPIC_COLOR_PALETTE;
    var onSave = cfg.onSave || function(){};
    var onDelete = cfg.onDelete || null;

    var modalBackdrop = null, modalOpenerEl = null;
    var modalMode = null;        // null | "create" | "edit"
    var modalTopic = null;
    var draftName = "", draftEmoji = "", draftColor = null;
    var pickOpen = null;         // null | "emoji" | "color"
    var modalSaving = false, modalSaveTimer = null;

    function pickerRowHtml(){
      var color = draftColor || palette[0];
      var emojiOpen = pickOpen === "emoji";
      var colorOpen = pickOpen === "color";
      var panel = "";
      if (emojiOpen){
        panel = '<div class="up-topicmodal-pickpanel"><emoji-picker class="up-topicmodal-emojipicker ' + (getIsDark() ? "dark" : "light") + '"></emoji-picker></div>';
      } else if (colorOpen){
        panel = '<div class="up-topicmodal-pickpanel"><div class="up-topicmodal-colorgrid">' +
          palette.map(function(hx){
            var on = hx === color;
            return '<button type="button" class="up-topicmodal-colorcell" data-color="' + esc(hx) + '"' +
              ' aria-label="' + esc(hx) + '" aria-pressed="' + (on ? "true" : "false") + '">' +
              '<span class="up-topicmodal-colorblob" style="background:' + esc(hx) + '">' +
                (on ? CHECK_SVG : "") + '</span>' +
            '</button>';
          }).join("") +
        '</div></div>';
      }
      return '<div class="up-topicmodal-approw">' +
          '<button type="button" class="up-topicmodal-pickbtn' + (emojiOpen ? " is-open" : "") +
            '" data-pick="emoji" data-tip="Topic Emoji" aria-label="Topic emoji" aria-expanded="' + (emojiOpen ? "true" : "false") + '">' +
            (draftEmoji ? esc(draftEmoji) : SMILE_SVG) +
          '</button>' +
          '<button type="button" class="up-topicmodal-pickbtn' + (colorOpen ? " is-open" : "") +
            '" data-pick="color" data-tip="Topic Color" aria-label="Topic color" aria-expanded="' + (colorOpen ? "true" : "false") + '">' +
            '<span class="up-topicmodal-pickswatch" style="background:' + esc(color) + '"></span>' +
          '</button>' +
        '</div>' + panel;
    }
    function renderAppearance(){
      var wrap = modalBackdrop && modalBackdrop.querySelector(".up-topicmodal-approw-wrap");
      if (wrap) wrap.innerHTML = pickerRowHtml();
    }
    function syncSaveEnabled(){
      var saveBtn = modalBackdrop && modalBackdrop.querySelector(".up-topicmodal-save");
      if (saveBtn) saveBtn.disabled = !draftName.trim();
    }
    function deleteArmed(){
      var b = modalBackdrop && modalBackdrop.querySelector(".up-topicmodal-delete");
      return !!(b && b.classList.contains("is-armed"));
    }
    function ensureModal(){
      if (modalBackdrop && document.body.contains(modalBackdrop)) return modalBackdrop;
      modalBackdrop = document.createElement("div");
      modalBackdrop.className = "up-topicmodal-backdrop";
      modalBackdrop.setAttribute("aria-hidden", "true");
      modalBackdrop.innerHTML =
        '<div class="up-topicmodal-card" role="dialog" aria-modal="true" aria-labelledby="up-topicmodal-title-' + Math.random().toString(36).slice(2) + '">' +
          '<div class="up-topicmodal-head">' +
            '<div class="up-topicmodal-heading">' +
              '<h2 class="up-topicmodal-title"></h2>' +
            '</div>' +
            '<button type="button" class="up-topicmodal-close" data-modal-close aria-label="' + esc(t_("Close")) + '">' + CLOSE_SVG_TM + '</button>' +
          '</div>' +
          '<div class="up-topicmodal-body">' +
            '<div class="up-topicmodal-field">' +
              '<label class="up-topicmodal-label">Name</label>' +
              '<input type="text" class="up-topicmodal-name" maxlength="60" autocomplete="off" spellcheck="false"/>' +
            '</div>' +
            '<div class="up-topicmodal-field">' +
              '<label class="up-topicmodal-label">Appearance</label>' +
              '<div class="up-topicmodal-approw-wrap"></div>' +
            '</div>' +
          '</div>' +
          '<div class="up-topicmodal-foot"></div>' +
        '</div>';

      var nameInput = modalBackdrop.querySelector(".up-topicmodal-name");
      nameInput.addEventListener("input", function(){ draftName = nameInput.value; syncSaveEnabled(); });

      modalBackdrop.addEventListener("click", function(e){
        if (e.target === modalBackdrop){ closeModal(); return; }
        if (e.target.closest("[data-modal-close]")){ closeModal(); return; }
        if (e.target.closest("[data-modal-save]")){ saveModal(); return; }
        var delBtn = e.target.closest("[data-modal-delete]");
        if (delBtn){
          if (!deleteArmed()){
            modalBackdrop.querySelector(".up-topicmodal-delete").classList.add("is-armed");
            modalBackdrop.querySelector(".up-topicmodal-delete").textContent = t_("Confirm delete?");
            return;
          }
          fireDelete();
          return;
        }
        var pickBtn = e.target.closest("[data-pick]");
        if (pickBtn){
          var kind = pickBtn.getAttribute("data-pick");
          pickOpen = pickOpen === kind ? null : kind;
          if (pickOpen === "emoji") ensureEmojiLib();
          renderAppearance();
          return;
        }
        var colorBtn = e.target.closest("[data-color]");
        if (colorBtn){ draftColor = colorBtn.getAttribute("data-color"); renderAppearance(); return; }
      });
      /* emoji-picker-element dispatches this (bubbling, composed) from inside its shadow root. */
      modalBackdrop.addEventListener("emoji-click", function(e){
        var unicode = e.detail && e.detail.unicode;
        if (!unicode) return;
        draftEmoji = unicode;
        renderAppearance();   // deliberately does not close the picker
      });
      /* Scoped to just this modal, not a page-global Escape (which would close every open
         popover) — this modal's Escape must not, say, also close an unrelated sort menu open
         elsewhere on the page, nor should some other component's Escape reach in and close it. */
      document.addEventListener("keydown", function(e){
        if (!modalMode) return;
        if (e.key !== "Escape" && e.key !== "Esc") return;
        closeModal();
      });
      makeTooltips(modalBackdrop, getIsDark);
      document.body.appendChild(modalBackdrop);
      return modalBackdrop;
    }
    function openModal(mode, topic){
      ensureModal();
      modalMode = mode; modalTopic = topic || null;
      draftName = topic ? String(topic.name || "") : "";
      draftEmoji = topic ? String(topic.emoji || "") : "";
      draftColor = topic ? String(topic.hex_light || topic.hex_dark || palette[0]) : palette[0];
      if (draftColor.charAt(0) !== "#") draftColor = "#" + draftColor;
      pickOpen = null; modalSaving = false;
      clearTimeout(modalSaveTimer);
      modalBackdrop.setAttribute("data-theme", getIsDark() ? "dark" : "light");
      var titleEl = modalBackdrop.querySelector(".up-topicmodal-title");
      if (titleEl) titleEl.textContent = t_(mode === "create" ? "New Topic" : "Edit Topic");
      var nameInput = modalBackdrop.querySelector(".up-topicmodal-name");
      if (nameInput) nameInput.value = draftName;
      var foot = modalBackdrop.querySelector(".up-topicmodal-foot");
      if (foot){
        foot.innerHTML = (mode === "edit" && onDelete
          ? '<button type="button" class="up-topicmodal-delete" data-modal-delete>Delete</button>'
          : "") +
          '<button type="button" class="up-topicmodal-save" data-modal-save' + (draftName.trim() ? "" : " disabled") + '>Save</button>';
      }
      renderAppearance();
      modalOpenerEl = document.activeElement;
      modalBackdrop.setAttribute("aria-hidden", "false");
      void modalBackdrop.offsetWidth;   // force layout flush so the appear transition actually runs
      modalBackdrop.classList.add("is-shown");
      setTimeout(function(){ try { nameInput.focus(); nameInput.select(); } catch(e){} }, 60);
    }
    function closeModal(){
      if (!modalBackdrop || !modalMode) return;
      /* Blur focus BEFORE hiding: aria-hidden on an ancestor of the focused element is an
         accessibility trap, and Chrome refuses it outright with a console error. */
      if (modalBackdrop.contains(document.activeElement)){
        try { document.activeElement.blur(); } catch(e){}
      }
      modalBackdrop.classList.remove("is-shown");
      modalBackdrop.setAttribute("aria-hidden", "true");
      modalMode = null; modalTopic = null;
      clearTimeout(modalSaveTimer); modalSaving = false;
      try { if (modalOpenerEl && modalOpenerEl.focus) modalOpenerEl.focus(); } catch(e){}
      modalOpenerEl = null;
    }
    function saveModal(){
      var name = draftName.trim();
      if (!name || modalSaving) return;
      var payload = { name: name, emoji: draftEmoji || "", hex_light: draftColor || palette[0], hex_dark: draftColor || palette[0] };
      if (modalMode === "edit" && modalTopic) payload.id = String(modalTopic.id);
      modalSaving = true;
      var saveBtn = modalBackdrop.querySelector(".up-topicmodal-save");
      if (saveBtn){ saveBtn.disabled = true; saveBtn.style.opacity = ".6"; }
      onSave(payload, modalMode, modalTopic);
      /* Nothing else in this library waits mid-interaction on a round trip — every table's
         search/sort/filter updates the local view optimistically and never blocks a control on
         the response. A mutation genuinely has to wait for Bubble's RPC before the modal can
         close (there's no optimistic id to show yet on create), so this is the one place with a
         "saving" state — with a generous timeout so a dropped/failed RPC can't trap the user in
         a stuck modal forever. The caller is expected to call .close() itself once its RPC
         answers (by re-rendering, same as everywhere else); this timer is only the fallback. */
      clearTimeout(modalSaveTimer);
      modalSaveTimer = setTimeout(function(){
        modalSaving = false;
        if (saveBtn){ saveBtn.disabled = !draftName.trim(); saveBtn.style.opacity = ""; }
      }, 8000);
    }
    function fireDelete(){
      if (!modalTopic || !onDelete) return;
      onDelete(modalTopic);
      closeModal();
    }
    return {
      open: openModal, close: closeModal,
      isOpen: function(){ return !!modalMode; },
      /* The render/update path needs to tell "modal is open because the user is mid-edit" apart
         from "modal is open AND its save is in flight, so THIS incoming re-render is very likely
         the RPC answer — close it" without reaching into the closure. */
      isSaving: function(){ return modalSaving; },
      /* The modal is parented to document.body, so it does NOT go away with the component's own
         markup when Bubble rebuilds the element — the caller's own destroy() must remove it
         explicitly or it lingers as an orphan over the next instance. */
      destroy: function(){
        if (modalBackdrop && modalBackdrop.parentNode) modalBackdrop.parentNode.removeChild(modalBackdrop);
        modalBackdrop = null;
      }
    };
  }

  /* How much room is left between the heading and the toolbar -- the number every table's
     fitToolbar() decides its responsive tiers from. Five components measured it identically.

     Two things in here are easy to get wrong and were right in all five, so they are worth keeping
     in one place: a toolbar that has not been laid out yet reports width 0, and returning 0 there
     would collapse the toolbar on a phantom measurement, hence Infinity. And the search field is
     measured as if it were already open, so opening it does not shift the tier underneath the
     user's cursor. */
  function headGap(elHeading, elHeadTools, elSearch, searchOpenWidth){
    var h = elHeading && elHeading.getBoundingClientRect();
    var tl = elHeadTools && elHeadTools.getBoundingClientRect();
    if (!h || !tl || !tl.width) return Infinity;
    var gap = tl.left - h.right;
    if (elSearch && !elSearch.classList.contains("is-open")) gap -= (searchOpenWidth || 0);
    return gap;
  }

  /* The "Sort by" popover's markup. Four components emitted this string character for character,
     data-sortfield / data-sortdir hooks included -- and those hooks are what each component's own
     click handler matches on, so the markup and the handlers had to stay in step across four
     files by hand. One of them silently getting a different attribute name is a click that stops
     working with nothing in the console.

     fields is [{key, label}]. Nothing here reads component state; the caller passes the two values
     that vary, which is what keeps this usable from a component with a different state shape. */
  function sortMenuHtml(fields, sortField, sortDir){
    var html = '<div class="up-pop-head">' + esc(t_("Sort by")) + '</div>';
    html += (fields || []).map(function(f){
      return '<div class="up-pop-opt' + (f.key === sortField ? " is-active" : "") + '" data-sortfield="' + f.key + '">' +
               '<span>' + esc(t_(f.label)) + '</span>' +
               '<span class="up-check">' + CHECK_SVG + '</span>' +
             '</div>';
    }).join("");
    html += '<div class="up-pop-div"></div>' +
      '<div class="up-pop-row"><span class="up-pop-label">Descending</span>' +
        '<span class="up-switch' + (sortDir === "desc" ? " is-on" : "") + '" role="switch" data-sortdir></span>' +
      '</div>';
    return html;
  }

  /* data-isdark (what Bubble sets) -> data-theme (what the CSS reads), plus "did it actually
     change" so the caller can skip the repaint work when it did not. Five components carried these
     seven lines character for character; the shape of the answer is what forced the duplication --
     it both mutates a local and reports a boolean, which is why it never got extracted before.
     Returning the pair instead of mutating settles that. */
  function syncTheme(root, wasDark){
    var wantDark = isYes(root.getAttribute("data-isdark"));
    if (wantDark === wasDark) return { isDark: wasDark, changed: false };
    if (wantDark) root.setAttribute("data-theme", "dark"); else root.removeAttribute("data-theme");
    return { isDark: wantDark, changed: true };
  }

  /* "War das eine reine Theme-Aenderung?" -- fuer die Observer, die Theme und Ladezustand am
     selben Attributfilter haengen haben.

     Diese Observer laufen bei JEDER beobachteten Aenderung und lesen dann data-processing frisch
     aus dem DOM. Bei einem Datenwechsel ist das genau richtig. Bei einem Theme-Wechsel ist es ein
     Fehler: setUpstreemTheme schreibt data-isdark auf jede Wurzel der Seite, der Observer wacht
     auf und wendet nebenbei einen Ladezustand an, den niemand angefordert hat. Steht Bubbles
     data-processing in dem Moment noch auf yes -- und das ist der Normalfall, solange kein
     Workflow es zurueckgesetzt hat --, geht die Komponente beim Themewechsel in den Ladezustand
     und bleibt dort, bis Bubble das Attribut zufaellig wieder anfasst. Genau das Bild: nach dem
     Umschalten haengen mehrere Komponenten im Skeleton.

     Die Mutationsliste weiss, was passiert ist. Waren es ausschliesslich Theme-Attribute, hat der
     Ladezustand in diesem Durchlauf nichts verloren. */
  function themeOnly(muts){
    if (!muts || !muts.length) return false;
    for (var i = 0; i < muts.length; i++){
      var n = muts[i] && muts[i].attributeName;
      if (n !== "data-isdark" && n !== "data-theme") return false;
    }
    return true;
  }

  /* The page header's brand meta: theme, brand name, brand logo. Six page headers had this
     character for character -- the third-largest duplicate in the repo, and the kind that drifts
     silently, because a fix applied to one of six looks done.

     Bubble sets these attributes on the root LATER and edits them in place rather than replacing
     the node, so a one-shot read at init leaves the header showing nothing. The MutationObserver
     is what makes it survive that, and it is exactly the guard the tables already use. */
  function makePageHeaderMeta(root){
    var nameEl = root.querySelector(".pph-metaname");
    var logoEl = root.querySelector(".up-ph-metalogo");
    function syncFromAttrs(){
      var wantDark = isYes(root.getAttribute("data-isdark"));
      if (wantDark) root.setAttribute("data-theme", "dark"); else root.removeAttribute("data-theme");

      var name = root.getAttribute("data-brand-name") || "";
      if (name === "BRAND_NAME") name = "";           // unreplaced Bubble placeholder, not a brand
      if (nameEl) nameEl.textContent = name;

      var logo = root.getAttribute("data-brand-logo") || "";
      if (logo === "BRAND_LOGO_URL") logo = "";
      if (logoEl){
        /* display:none rather than just an unset src: src="" resolves to the page's own URL, fails
           to load, and shows the browser's broken-image icon while the logo is still unresolved. */
        if (logo){ logoEl.src = logo; logoEl.style.display = ""; }
        else { logoEl.removeAttribute("src"); logoEl.style.display = "none"; }
      }
    }
    syncFromAttrs();
    try {
      new MutationObserver(syncFromAttrs).observe(root, {
        attributes: true, attributeFilter: ["data-isdark", "data-brand-name", "data-brand-logo"]
      });
    } catch(e){}
    return { sync: syncFromAttrs };
  }

  /* Page-header subpage nav: builds the sliding-tab row (see the Page Header Kit in core.css for
     the full markup contract) and wires click/keydown selection plus the width-driven is-narrow/
     is-vnarrow responsive tiers. Shared because every page-headers/* component needs the exact
     same nav, not because it's generic UI -- the PAGES list, labels and icons stay per-component.
     cfg: { nav (element) OR navSelector (default ".up-ph-nav", resolved against root), pages:
     [{value,label,icon}], selected (default pages[0].value), onSelect(value) -- called on a real
     user selection, not the initial render, narrowAt (default 768), vnarrowAt (default 500) }.
     Returns { selectPage(value, fireEvent), positionUnderline(item, animate) } so a caller can
     drive the same tab switch programmatically (e.g. a data-nav-fn response echoed back). */
  /* is-narrow / is-vnarrow on a component root, measured off the ROOT's own box via ResizeObserver
     rather than a CSS media query -- consistent with every other responsive decision in this repo,
     and correct if a component ever sits in a narrower Bubble container than the full page.

     This used to live INSIDE makePageNav, which is why the mobile clearance kept disappearing:
     only three of the six page headers have a nav and therefore call it at all, and the two
     components that draw their own header (ask-mira, prompt-research) never did. Everything else
     silently never got the classes, so `.up-root.is-vnarrow` never matched and the 32px top
     clearance for the sidebar toggle was simply absent. Standalone now, called by every one of
     them. */
  function widthTiers(root, cfg){
    cfg = cfg || {};
    if (!root || root.__upWidthTiers) return;
    root.__upWidthTiers = true;
    function apply(w){
      root.classList.toggle("is-narrow",  w < (cfg.narrowAt  || 768));
      root.classList.toggle("is-vnarrow", w < (cfg.vnarrowAt || 500));
      /* Dritte Stufe, und nur wenn eine Komponente sie ausdruecklich anfordert: wer zwei Karten
         nebeneinander stellt, muss frueher untereinander gehen als seine Kopfzeilen schmal
         werden -- zwei Haelften von 900px sind je 440, und da passt eine Kopfzeile noch, ein
         Doughnut neben einer Legende aber nicht mehr. Ohne stackAt wird die Klasse nie gesetzt,
         fuer alle bestehenden Aufrufer aendert sich also nichts. */
      if (cfg.stackAt) root.classList.toggle("is-stack", w < cfg.stackAt);
    }
    /* Only measure if there IS a measurement. A root that has no layout yet -- booted inside a
       Bubble group that is still hidden, or measured before the first paint -- reports width 0,
       and 0 is smaller than every breakpoint, so a naive initial call would stamp BOTH narrow
       classes onto a component that may well be full width. It then sits wrong until something
       resizes it. The ResizeObserver below delivers the first real width on its own; letting it
       do that is both simpler and correct. */
    var w0 = root.getBoundingClientRect().width;
    if (w0 > 0) apply(w0);
    if (onResize) onResize(root, apply);
  }

  /* Die gewaehlte Unterseite je Kopfzeile, modulweit. Sie muss ein Neueinspritzen des Markups
     ueberleben, und genau daran hing ein gemeldeter Fehler: bei einem Themenwechsel baut Bubble die
     Kopfzeile neu, makePageNav lief wieder und rendert mit pages[0] -- die Navigation sprang also
     auf "All Prompts" zurueck, waehrend Bubbles eigener Zustand weiter auf "Responses" stand und
     die Responses-Tabelle darunter stehen blieb. Die Kopfzeile log ueber den Zustand der Seite.
     Ein Modul-Speicher und nicht der localStorage: die Wahl gilt fuer diesen Seitenbesuch, nicht
     fuer den naechsten. */
  var NAV_STORE = {};
  function makePageNav(root, cfg){
    cfg = cfg || {};
    var nav = cfg.nav || root.querySelector(cfg.navSelector || ".up-ph-nav");
    if (!nav) return null;
    var pages = cfg.pages || [];
    var navKey = cfg.storeKey ||
      ((root.getAttribute && root.getAttribute("data-instance")) || "") + "|" +
      (cfg.navSelector || ".up-ph-nav") + "|" + pages.map(function(p){ return p.value; }).join(",");
    var gemerkt = NAV_STORE[navKey];
    var gueltig = gemerkt != null && pages.some(function(p){ return p.value === gemerkt; });
    /* cfg.selected gewinnt weiter: gibt eine Komponente die Seite ausdruecklich vor, ist das die
       Wahrheit und nicht der Merker. */
    var selected = cfg.selected != null ? cfg.selected
                 : gueltig ? gemerkt
                 : (pages[0] && pages[0].value);

    function esc(v){ var d = document.createElement("div"); d.textContent = String(v == null ? "" : v); return d.innerHTML; }

    nav.innerHTML = pages.map(function(p){
      var on = p.value === selected;
      return '<div class="up-ph-navitem' + (on ? " is-selected" : "") + '" role="tab" tabindex="0" ' +
        'aria-selected="' + (on ? "true" : "false") + '" data-page="' + esc(p.value) + '">' +
        '<span class="up-ph-navicon">' + p.icon + '</span>' +
        '<span class="up-ph-navlabel">' + esc(t_(p.label)) + '</span>' +
      '</div>';
    }).join("") + '<div class="up-ph-navunderline"></div>';

    var underline = nav.querySelector(".up-ph-navunderline");

    /* transition:none for the initial placement only -- without it the indicator would visibly
       grow in from a 0-width sliver at (0,0) on first paint, since it starts with no inline
       left/width at all. Every later call (an actual click, or a resize re-placement) leaves the
       CSS transition (200ms ease, up-ph-navunderline in core.css) alone. */
    function positionUnderline(item, animate){
      if (!item) return;
      var navRect = nav.getBoundingClientRect();
      var itemRect = item.getBoundingClientRect();
      if (!animate) underline.style.transition = "none";
      underline.style.left = (itemRect.left - navRect.left) + "px";
      underline.style.width = itemRect.width + "px";
      if (!animate){ void underline.offsetWidth; underline.style.transition = ""; }
    }

    function selectPage(value, fireEvent){
      var items = nav.querySelectorAll(".up-ph-navitem");
      var target = null;
      Array.prototype.forEach.call(items, function(el){
        var on = el.getAttribute("data-page") === value;
        el.classList.toggle("is-selected", on);
        el.setAttribute("aria-selected", on ? "true" : "false");
        if (on) target = el;
      });
      positionUnderline(target, true);
      /* Auch ohne Ereignis merken: die Wiederherstellung nach einem Neuaufbau ruft selectPage ohne
         fireEvent, und dann darf der Merker nicht verloren gehen. */
      if (target) NAV_STORE[navKey] = value;
      /* Beim Wiederherstellen wird NICHT gefeuert. Bubbles Zustand ist in diesem Moment schon
         richtig -- ein Ereignis waere eine zweite Quelle der Wahrheit und wuerde die Seite
         umschalten, obwohl niemand geklickt hat. */
      if (fireEvent && cfg.onSelect) cfg.onSelect(value);
    }

    nav.addEventListener("click", function(e){
      var item = e.target.closest(".up-ph-navitem");
      if (!item) return;
      selectPage(item.getAttribute("data-page"), true);
    });
    nav.addEventListener("keydown", function(e){
      if (e.key !== "Enter" && e.key !== " ") return;
      var item = e.target.closest(".up-ph-navitem");
      if (!item) return;
      e.preventDefault();
      selectPage(item.getAttribute("data-page"), true);
    });

    positionUnderline(nav.querySelector(".up-ph-navitem.is-selected"), false);
    /* is-narrow/is-vnarrow: measured off the ROOT's own box width via ResizeObserver, not a CSS
       media query -- consistent with every other component in this repo, and correct if a page
       header ever ends up in a narrower Bubble container than the full page (it doesn't today,
       but this kit isn't specific to that). */
    if (onResize){
      widthTiers(root, cfg);
      onResize(root, function(){ positionUnderline(nav.querySelector(".up-ph-navitem.is-selected"), false); });
    }

    return { selectPage: selectPage, positionUnderline: positionUnderline };
  }

  /* Plays the .up-ph-iconbtn spin (core.css: 1s ease-in-out, one turn) on a button, re-triggerable
     mid-spin. A plain classList.add("is-spinning") is a no-op on a button already mid-animation --
     the class name doesn't change, so nothing tells the browser to restart it. Removing the class,
     forcing a layout read (void el.offsetWidth), then re-adding it makes the browser treat it as a
     fresh animation start every time, even if the previous spin from a rapid re-click hasn't
     finished. Used by both prompts-page-header.js and dashboard-page-header.js's Refresh buttons. */
  function spinOnce(el){
    if (!el) return;
    el.classList.remove("is-spinning");
    void el.offsetWidth;
    el.classList.add("is-spinning");
  }

  /* Shared event dispatch: resolves the Bubble function (via the data-*-fn attr or a fallback
     name) across window/parent/top/iframes and calls it with the JSON payload. label + eventPrefix
     stay per component so warnings and the DOM side-channel event read correctly. */
  function makeFire(root, opts){
    opts = opts || {};
    var label = opts.label || "component";
    var evtPrefix = opts.eventPrefix || "";
    return function fire(attr, fallbackName, payload){
      /* team_id rides along on every event, so a Bubble workflow can check that what came back
         belongs to the team currently on screen instead of trusting arrival order. Added here,
         once, rather than in each component's payload -- and only when a team is actually known,
         so nothing gains an empty field it has to ignore.

         PREPENDED, not appended, and that is not cosmetic. JSON.stringify writes keys in insertion
         order, so appending moved every existing field one position up from the END of the string.
         prompts-table's uptGroups payload carries `groups` as a JSON string nested inside the JSON
         -- its value is full of escaped quotes, so the usual (?<="key":")[^"]* cannot read it and a
         Bubble workflow has to grab it by reaching to the end of the payload instead. Appending
         team_id put itself behind that and silently broke the extraction: custom groupings were
         still written and still shown in the pickers, but the table's group list came back empty.
         Prepending keeps the tail of every payload byte-identical to what it was before team
         scoping existed. */
      try {
        var tid = getTeam();
        if (tid && payload && typeof payload === "object" && payload.team_id == null) {
          var withTeam = { team_id: tid }, pk;
          for (pk in payload) if (Object.prototype.hasOwnProperty.call(payload, pk)) withTeam[pk] = payload[pk];
          payload = withTeam;
        }
      } catch(e){}
      var fnName = root.getAttribute(attr) || fallbackName;
      var fn = resolveBubbleFn(fnName);
      /* Der Rueckfall ohne Praefix findet nichts: Bubble veroeffentlicht bubble_fn_<name>, der
         Rueckfallname hier ist aber der nackte Ereignisname (usnLogout). Fehlt das Attribut am
         Element -- und es fehlt regelmaessig, weil bubble/*.html nur eine Vorlage ist und ein
         bestehendes Element neue Attribute nicht von selbst bekommt --, lief der Aufruf ins
         Leere, obwohl der Workflow da war. Also einmal mit Praefix nachfassen, bevor gewarnt
         wird. Der gemeldete Name in der Warnung ist dann der, der wirklich gesucht wurde. */
      if (typeof fn !== "function" && fnName.indexOf("bubble_fn_") !== 0){
        var mitPraefix = "bubble_fn_" + fnName;
        var fn2 = resolveBubbleFn(mitPraefix);
        if (typeof fn2 === "function"){ fn = fn2; fnName = mitPraefix; }
      }
      /* Ein einzelner Wert geht ROH raus, nicht als JSON. JSON.stringify("abc") ergibt "abc" MIT
         Anfuehrungszeichen, und ein Workflow, der nur eine Id braucht, musste sie erst wieder
         abschneiden -- eine Extraktion fuer einen Wert, der schon der Wert war. Objekte bleiben
         JSON, dort ist die Struktur der Sinn.
         Zahlen und Wahrheitswerte ebenso roh: "3" und "true" liest Bubble direkt als Zahl bzw. als
         yes/no, "\"3\"" nicht. null und undefined werden zum leeren Text -- ein Event ohne Wert
         soll nichts senden, nicht das Wort "null". */
      var json;
      if (payload == null) json = "";
      else if (typeof payload === "string") json = payload;
      else if (typeof payload === "number" || typeof payload === "boolean") json = String(payload);
      else { try { json = JSON.stringify(payload); } catch(e){ json = ""; } }
      /* Der Wurf der Bubble-Funktion darf NICHT still verschwinden. Der Nicht-gefunden-Zweig
         darunter warnt ausfuehrlich, dieser hier schwieg -- und das ist der teurere Fall: eine
         Komponente, die vor dem Feuern einen Ladezustand setzt und auf ein Erfolgsereignis
         wartet, dreht dann endlos, ohne Meldung im UI und ohne Meldung in der Konsole. Die
         Ausfuehrung laeuft weiter wie bisher, es kommt nur die Zeile dazu. */
      /* ── Diagnose auf Zuruf ────────────────────────────────────────────────────────────────
         window.upstreemTrace(true) in der Konsole oder in einem Run-JS-Schritt, danach meldet
         JEDES Event dieser App, was es sendet und ob es einen Empfaenger gefunden hat. Aus
         geschaltet steht nichts in der Konsole -- die ausgelieferte App bleibt still.
         Der Grund fuer den Schalter: bei "der Menuepunkt tut nichts" ist die entscheidende Frage,
         ob das Event ueberhaupt rausgeht und mit welchem Wert. Ohne ihn kostet das jedes Mal eine
         Runde Raten. */
      if (window.__upTrace && window.console){
        console.log("[trace] " + label + " -> " + fnName +
          (typeof fn === "function" ? " (Empfaenger da)" : " (KEIN EMPFAENGER)") + " " + json);
      }
      if (typeof fn === "function"){
        try { fn(json); }
        catch(e){
          if (window.console) console.warn("[" + label + "] " + fnName + " hat geworfen. Das Event " +
            "wurde ausgeloest, der Bubble-Workflow ist aber nicht durchgelaufen. Fehler:", e);
        }
      }
      else if (window.console) {
        console.warn("[" + label + "] " + fnName + " not found on window/parent/top or any reachable " +
          "iframe — this action reached no Bubble workflow. Check the Toolbox element's name.");
      }
      try { root.dispatchEvent(new CustomEvent(evtPrefix + fallbackName, { detail: payload, bubbles: true })); } catch(e){}
    };
  }

  /* ── Toast ───────────────────────────────────────────────────────────────────────────────────
     showMacToast liegt NICHT in diesem Repo, sondern im Seitenkopf der Bubble-App. Genau deshalb
     steht der Aufruf hier und nicht viermal einzeln: er muss defensiv sein (Seite ohne die
     Funktion, Funktion wirft), und eine kaputte Rueckmeldung darf niemals die Aktion mitreissen,
     die sie bestaetigen soll. domains-table und urls-table haben dieselbe Zeile bisher je selbst
     getragen; sie duerfen so bleiben, neue Aufrufer nehmen diesen Weg.

     Rueckgabe sagt, ob der Toast wirklich rausging -- ein Aufrufer, der eine Rueckmeldung
     garantieren muss, kann daran erkennen, dass die Seite keine hat. */
  function toast(text, opts){
    opts = opts || {};
    var t = String(text == null ? "" : text).trim();
    if (!t) return false;
    try {
      if (typeof window.showMacToast === "function"){
        window.showMacToast(t, { icon: opts.icon || "check",
                                 timeout: opts.timeout == null ? 2000 : opts.timeout });
        return true;
      }
    } catch(e){
      if (window.console) console.warn("[toast] showMacToast hat geworfen:", e);
      return false;
    }
    if (window.console) console.warn("[toast] Auf dieser Seite gibt es kein showMacToast — die " +
      "Meldung \"" + t + "\" wurde nirgends angezeigt.");
    return false;
  }

  /* ── Signalbruecke: ein Workflow sagt der Seite Bescheid ─────────────────────────────────────
     Der Fall: In den Einstellungen wird gespeichert, und der Team-Header oben auf der Seite zeigt
     danach noch die alten Daten. Der Speichern-Workflow haengt aber am Element in den
     Einstellungen -- von dort erreicht kein Bubble-Workflow ein Custom Event der Seite.

     Diese Funktion ist der Umweg dorthin, und sie gehoert bewusst NICHT in eine Komponente:

       1. Sie wird aus einem Run-JavaScript-Schritt gerufen, NACHDEM der Speicher-Schritt
          durchgelaufen ist. Wuerde die Komponente das Signal selbst beim Klick feuern, liefen
          Speichern und Neuladen des Headers gleichzeitig -- und der Header holte mit guter
          Wahrscheinlichkeit noch den alten Stand.
       2. Sie liegt in core, damit `upstreemSignal` auf JEDER Seite existiert. Eine eigene
          Komponente waere ein zweites Element mit eigenem Pin, und wo es fehlt, stirbt der
          Run-JavaScript-Schritt an "is not a function" -- samt aller Schritte dahinter.

     Auf Bubble-Seite steht dem EIN JavaScriptToBubble-Element gegenueber (bubble_fn_upSignal),
     dessen Workflow ueber `channel` verzweigt. Ein Kanal pro Anlass, ein Element fuer alle. */
  var SIGNAL_FN = "bubble_fn_upSignal";
  function upstreemSignal(channel, detail){
    channel = String(channel == null ? "" : channel).trim();
    if (!channel){
      if (window.console) console.warn("[signal] ohne Kanal gerufen — nichts gesendet.");
      return false;
    }
    var payload = { team_id: getTeam() || "", channel: channel,
                    detail: detail == null ? "" : String(detail) };
    var json; try { json = JSON.stringify(payload); } catch(e){ json = ""; }

    /* Beim Seitenaufbau kann der Schritt laufen, bevor Bubble das Toolbox-Element gebaut hat.
       Ohne diese Wiederholung ginge genau das erste Signal verloren -- und ausgerechnet das ist
       der Fall "Seite oeffnen, Daten holen". 20 x 150ms = 3s, danach eine deutliche Meldung
       statt stillem Verschwinden. */
    var versuche = 20;
    (function versuch(){
      var fn = resolveBubbleFn(SIGNAL_FN);
      if (typeof fn === "function"){
        try { fn(json); }
        catch(e){
          if (window.console) console.warn("[signal] " + SIGNAL_FN + " hat geworfen. Das Signal '" +
            channel + "' wurde ausgeloest, der Bubble-Workflow ist aber nicht durchgelaufen:", e);
        }
        return;
      }
      if (--versuche > 0){ setTimeout(versuch, 150); return; }
      if (window.console) console.warn("[signal] " + SIGNAL_FN + " gibt es auf dieser Seite nicht — " +
        "das Signal '" + channel + "' hat keinen Workflow erreicht. Fehlt das JavaScriptToBubble-" +
        "Element mit diesem Namen?");
    })();
    return true;
  }
  /* Global, nicht nur auf UC: der Aufruf steht in einem Bubble-Run-JavaScript-Schritt, und dort
     ist die kurze Form die, die man beim Lesen des Workflows noch versteht. */
  window.upstreemSignal = upstreemSignal;

  /* Dropdown menus stay exactly where they are in the markup: a plain position:absolute child of a
     position:relative wrapper (.up-sort / .up-filter / .up-cols / .up-ment, etc. — all already
     position:relative in core.css, all with the menu positioned via `top:calc(100% + Npx); right:0`).
     That's pure CSS layout, so the menu moves in the SAME paint as its trigger when the page
     scrolls — glued, by construction, with zero JavaScript and therefore zero possibility of
     lag or jitter.

     Earlier versions moved every menu into a <body>-level layer and switched it to position:fixed
     so it could escape an ancestor's overflow:hidden clipping, then re-ran a JS reposition on every
     scroll event to chase the trigger. No matter how that reposition was optimized (rAF-throttled,
     then compositor-only transform nudges), a JS scroll-follow is inherently one step behind the
     scroll it reacts to, so the menu visibly drifted / sprang against its trigger while scrolling.
     Not worth it: a menu that tracks its trigger perfectly beats one that's robust against a
     clipping failure mode we haven't actually hit here (the pre-migration components used plain
     position:absolute and were never clipped in practice).

     Kept as a no-op shell — the menus already live inside the root, so there is nothing to move.
     Existing call sites keep working unchanged, including their syncPortalTheme() calls; the theme
     now reaches the menus through the normal cascade (.up-root[data-theme="dark"] .xxx-menu),
     because the menus are still inside the themed root. */
  function makePortal(root, menuEls, instanceId){
    return { portalLayer: null, syncPortalTheme: function(){} };
  }

  /* No-op: dropdown menus are positioned entirely by CSS now (position:absolute against their
     position:relative wrapper — see makePortal). Kept as a callable shell so the components that
     call it on open don't need to change; the CSS rest-state already places the menu correctly. */
  function placeMenu(menu, btn, opts){}

  /* ---------- makeToolGroup ----------
     Die einklappbare Werkzeugleiste. Eingeklappt steht nur der Ausloeser da, ausgeklappt alles
     wie vorher -- die Leiste nimmt nichts weg, sie schiebt es zusammen.

     Steht hier und nicht sechsmal in den Komponenten: die Zustandsmaschine ist der ganze Aufwand,
     und sechs Kopien davon sind die Stelle, an der spaeter vier repariert werden. Jede Komponente
     gibt nur mit, WAS bei ihr einklappt und WAS sie offen haelt.

     DREI ZUSTAENDE, und der mittlere ist der Grund, warum es drei sind:
       eingeklappt   nur Ausloeser (und was cfg.keep verschont) steht da
       Vorschau      Zeiger auf dem Ausloeser: alles da, ABER der Ausloeser bleibt stehen
       festgestellt  angeklickt oder ein Filter ist aktiv: Ausloeser weg, links der Einklapper
     Ohne die Vorschau entsteht ein Flackerkreis: der Ausloeser liegt unter dem Zeiger,
     verschwindet beim Aufziehen, damit verlaesst der Zeiger ihn, die Leiste klappt zu.

     AUFZIEHEN tut nur der Ausloeser, offen HALTEN die ganze Leiste -- sonst zoege sie auch dann
     auf, wenn der Zeiger bloss auf dem Weg zum Export-Knopf durch die Ecke faehrt.

     UNTER cfg.minWidth ist der Kit AUS und die Leiste verhaelt sich wie vorher: alles sichtbar,
     kein Ausloeser, kein Einklapper. Auf einer schmalen Komponente ist die Kopfzeile ohnehin schon
     zusammengestrichen; ein Ausloeser waere dort ein weiterer Knopf statt einer Ersparnis.
     Abgeschaltet wird ueber eine KLASSE, nicht durch Umbauen des DOM: bei jedem Ueberschreiten der
     Grenze Kinder hin- und herzuschieben wuerde Fokus, offene Menues und Zeigerzustand mitnehmen.

     cfg:
       root         Wurzel der Komponente (traegt die is-tools-*-Klassen)
       tools        die Werkzeugleiste selbst
       keep         Selektor: direkte Kinder, die NIE einklappen. Vorgabe: alles, was die aktuelle
                    ANSICHT benennt (Segmentschalter, Reiter) plus der Export-Knopf. Was man
                    einstellt, klappt ein; was sagt, worauf man gerade sieht, bleibt stehen.
       filterActive Funktion -> true, solange ein Filter aktiv ist. Dann bleibt die Leiste offen
                    und der Einklapper verschwindet: eine verborgene Ursache fuer eine halbe
                    Tabelle ist die schlimmste Art von stillem Ausfall.
       minWidth     Grenze in px (Vorgabe 620). Darunter ist der Kit aus.
       prefKey      localStorage-Schluessel fuer "festgestellt". Ohne ihn wird nichts gemerkt.
       tip          Tooltip des Ausloesers.
     Rueckgabe: { sync, refit(breite), destroy }. */
  function makeToolGroup(cfg){
    var root = cfg && cfg.root, tools = cfg && cfg.tools;
    var leer = { sync: function(){}, refit: function(){}, destroy: function(){}, gepinnt: function(){ return false; } };
    if (!root || !tools) return leer;

    /* Die Vorgabe faengt ALLES, was die aktuelle Ansicht benennt, und den Export-Knopf. Sie ist
       bewusst breit: die Alternative waere, dass jede Komponente ihre eigene Liste mitgibt -- und
       genau daran ist es beim ersten Anlauf gescheitert. responses-table traegt seinen
       Ansichtsschalter im Markup als "up-dense urt-viewswitch" mit role="group", ZUR LAUFZEIT baut
       die Komponente ihn aber als "urt-viewswitch up-seg" neu. Eine Liste, die nur das Markup
       kennt, laesst ihn einklappen -- gemessen, bevor es jemand gesehen haette. */
    var KEEP    = cfg.keep || '[role="tablist"], .up-seg, .up-dense, .up-export';
    var AUF_MS  = cfg.openDelay  == null ? 120 : cfg.openDelay;
    var ZU_MS   = cfg.closeDelay == null ? 500 : cfg.closeDelay;
    var ANIM_MS = 200;
    var MIN_W   = cfg.minWidth == null ? 620 : cfg.minWidth;
    var filterAktiv = typeof cfg.filterActive === "function" ? cfg.filterActive : function(){ return false; };

    var elGroup = null, elIn = null, elTrig = null, elCol = null;
    /* VIER Merker, und die Trennung ist der Kern der Sache -- ein gemeinsamer hat zweimal versagt.

         drin      Der Zeiger ist irgendwo IN der Leiste. HAELT offen, oeffnet aber nicht: sonst
                   zoege sie auch dann auf, wenn der Zeiger bloss zum Export-Knopf unterwegs ist.
         aufTrig   Der Zeiger lag lang genug auf dem Ausloeser. OEFFNET.
         fokus     Der Tastaturfokus ist in der Leiste. Haelt offen und oeffnet.
         vorschau  Der Riegel. Einmal offen, bleibt es offen, solange IRGENDETWAS haelt.

       Warum ein Riegel und nicht eine Rechnung aus den drei anderen: der gemeldete Fall vom
       24.08. Leiste per Hover auf, Dropdown auf, Dropdown mit demselben Knopf wieder zu -- und
       sie war weg. Zwei Ursachen lagen uebereinander. Erst makePopover.close(), das den Fokus auf
       den Ausloeser zurueckholt und ihn dann BLURRT; mit einem gemeinsamen Merker fuer Zeiger und
       Fokus las die Leiste dieses focusout als "der Zeiger ist weg". Und danach immer noch die
       Ersatzfrage tools.matches(":hover") im Schliess-Zuhoerer -- die ist in jeder Umgebung ohne
       echten Zeiger falsch, also auch in jedem Testaufbau, und sie beantwortet eine Frage, die
       pointerenter/pointerleave laengst beantworten. Jetzt wird der Zeiger verfolgt statt
       abgefragt. */
    var gepinnt = false, drin = false, aufTrig = false, fokus = false, vorschau = false, aus = false;
    var uhrAuf = null, uhrZu = null, uhrFertig = null, zuletztSichtbar = null;

    if (cfg.prefKey){ try { gepinnt = prefGet(cfg.prefKey) === "1"; } catch(e){} }
    function pinMerken(){ if (cfg.prefKey){ try { prefSet(cfg.prefKey, gepinnt ? "1" : "0"); } catch(e){} } }

    /* Mit Absicht wiederholbar: mehrere Komponenten haengen Werkzeuge erst im Laufe des Aufbaus
       ein, und manche sortieren sie bei jedem Durchgang neu. Ein einmaliger Aufbau haette die
       Nachzuegler draussen stehen lassen. */
    function bauen(){
      if (!elGroup){
        elGroup = document.createElement("div");
        elGroup.className = "up-toolgroup";
        elIn = document.createElement("div");
        elIn.className = "up-toolgroup-in";
        elGroup.appendChild(elIn);
        tools.insertBefore(elGroup, tools.firstChild);

        elCol = document.createElement("button");
        elCol.type = "button";
        elCol.className = "up-iconbtn up-tbcol";
        elCol.setAttribute("data-tip", t_("Hide tools"));
        elCol.setAttribute("aria-label", t_("Hide tools"));
        /* Lucide "x". Vorher stand hier ein Chevron nach rechts, als Hinweis auf die Richtung,
           in die die Leiste zusammenfaehrt -- aber die Richtung ist nicht die Aussage. Die
           Aussage ist "weg damit", und dafuer gibt es im ganzen Haus genau ein Zeichen. */
        elCol.innerHTML = icon("x", 2.2);
        elIn.appendChild(elCol);

        elTrig = document.createElement("button");
        elTrig.type = "button";
        elTrig.className = "up-iconbtn up-tbtrig";
        elTrig.setAttribute("data-tip", cfg.tip || t_("Filters and settings"));
        elTrig.setAttribute("aria-label", cfg.tip || t_("Show tools"));
        elTrig.setAttribute("aria-expanded", "false");
        elTrig.innerHTML = icon("listFilterPlus", 2);
      }
      /* Ueber eine AUSSCHLUSSliste, nicht ueber eine Aufzaehlung: ein spaeter dazukommendes
         Werkzeug ist damit von sich aus drin und nicht aus Versehen draussen. */
      var kinder = Array.prototype.slice.call(tools.children), i, k;
      for (i = 0; i < kinder.length; i++){
        k = kinder[i];
        if (k === elGroup || k === elTrig) continue;
        try { if (k.matches(KEEP)) continue; } catch(e){}
        elIn.appendChild(k);
      }
      /* Der Ausloeser steht unmittelbar links von dem, was nicht einklappt -- aber nur verschieben,
         wenn er nicht schon dort steht: insertBefore auf einen Knoten, der bereits an dieser Stelle
         haengt, ist trotzdem ein Ausbauen und Wiedereinbauen, und der Knopf haette unter dem Zeiger
         den Hover verloren. bauen() laeuft bei jedem render(). */
      var nachbar = null;
      for (i = 0; i < tools.children.length; i++){
        k = tools.children[i];
        if (k === elGroup || k === elTrig) continue;
        try { if (k.matches(KEEP)){ nachbar = k; break; } } catch(e){}
      }
      if (nachbar){ if (elTrig.nextElementSibling !== nachbar || elTrig.parentNode !== tools) tools.insertBefore(elTrig, nachbar); }
      else if (elTrig.parentNode !== tools) tools.appendChild(elTrig);

      if (!elTrig.__upTgBound){
        elTrig.__upTgBound = true;
        elTrig.addEventListener("click", function(e){
          e.preventDefault(); e.stopPropagation();
          gepinnt = true; pinMerken(); sync();
        });
        elTrig.addEventListener("pointerenter", function(){
          window.clearTimeout(uhrZu); uhrZu = null;
          drin = true;
          if (uhrAuf) return;
          uhrAuf = window.setTimeout(function(){ uhrAuf = null; aufTrig = true; sync(); }, AUF_MS);
        });
        /* Fokus ohne Verzoegerung: wer mit der Tastatur hierher kommt, hat sich schon entschieden. */
        elTrig.addEventListener("focus", function(){
          window.clearTimeout(uhrZu); uhrZu = null; fokus = true; sync();
        });
      }
      if (!elCol.__upTgBound){
        elCol.__upTgBound = true;
        elCol.addEventListener("click", function(e){
          e.preventDefault(); e.stopPropagation();
          gepinnt = false; drin = false; aufTrig = false; fokus = false; vorschau = false; pinMerken();
          window.clearTimeout(uhrAuf); uhrAuf = null;
          window.clearTimeout(uhrZu);  uhrZu  = null;
          sync();
        });
      }
      if (!elIn.__upTgPop){
        elIn.__upTgPop = true;
        /* Ein Menue in der Gruppe haelt sie offen. Vom SCHLIESSEN erfaehrt sie ueber das
           aufsteigende up-popover-close aus makePopover -- EIN Zuhoerer fuer alle Menues, kein
           Beobachter und kein Nachfragen im Takt. */
        elIn.addEventListener("up-popover-close", function(){
          /* Haelt noch etwas -- Zeiger in der Leiste oder Tastaturfokus --, bleibt alles wie es
             ist und der Riegel haelt. Nur wenn NICHTS haelt, laeuft die Nachfrist los: der
             Zeiger stand dann ausserhalb, als das Menue zuging. */
          if (drin || fokus){ sync(); return; }
          window.clearTimeout(uhrZu);
          uhrZu = window.setTimeout(function(){ uhrZu = null; aufTrig = false; sync(); }, ZU_MS);
        });
      }
      if (!tools.__upTgBound){
        tools.__upTgBound = true;
        tools.addEventListener("pointerenter", function(){
          window.clearTimeout(uhrZu); uhrZu = null;
          drin = true; sync();
        });
        tools.addEventListener("pointerleave", function(){
          window.clearTimeout(uhrAuf); uhrAuf = null;
          window.clearTimeout(uhrZu);
          uhrZu = window.setTimeout(function(){ uhrZu = null; drin = false; aufTrig = false; sync(); }, ZU_MS);
        });
        /* focusin/focusout statt focus/blur: die beiden ersten steigen auf, die beiden anderen
           nicht -- damit haette die Leiste jeden Tabulatorsprung IN sie hinein verpasst. */
        tools.addEventListener("focusin", function(e){
          window.clearTimeout(uhrZu); uhrZu = null;
          /* NUR bei Tastaturfokus. Ein KLICK fokussiert den Knopf ebenfalls, und der Fokus bleibt
             danach auf ihm liegen -- focusout kommt also nie. Damit stand fokus dauerhaft auf true,
             pointerleave allein konnte die Leiste nicht mehr schliessen, und sie blieb offen stehen:
             der Ausloeser sichtbar, die Werkzeuge sichtbar, kein x. Genau so gemeldet fuer den
             Active/Inactive-Umschalter.
             :focus-visible unterscheidet die beiden Faelle -- es steht nach einem Mausklick nicht
             am Knopf. Wo es das nicht gibt, bleibt es beim alten Verhalten: eine offene Leiste ist
             besser als eine, die einem beim Tabulator unter den Fingern zufaellt. */
          var perTastatur = true;
          try { perTastatur = !e.target || !e.target.matches || e.target.matches(":focus-visible"); }
          catch(err){ perTastatur = true; }
          if (perTastatur) fokus = true;
          sync();
        });
        tools.addEventListener("focusout", function(e){
          if (e.relatedTarget && tools.contains(e.relatedTarget)) return;
          /* NUR den Fokus-Merker. Der Zeiger haengt an pointerenter/pointerleave und hat mit dem
             Fokus nichts zu tun -- siehe die Begruendung an der Deklaration. */
          fokus = false; sync();
        });
      }
    }

    /* Ein offenes Menue aus der Gruppe haelt sie offen -- sonst klappt die Leiste unter einem
       aufgeklappten Dropdown weg und das Menue haengt in der Luft. */
    function menueOffen(){
      if (!elIn) return false;
      return !!elIn.querySelector('[aria-expanded="true"], .is-open');
    }

    function sync(){
      if (!elGroup) return;
      if (aus){
        root.classList.add("is-tools-off");
        root.classList.remove("is-tools-peek");
        root.classList.add("is-tools-open", "is-tools-shown");
        root.classList.remove("is-tools-locked");
        zuletztSichtbar = true;
        return;
      }
      root.classList.remove("is-tools-off");
      var gesperrt = false;
      try { gesperrt = !!filterAktiv(); } catch(e){}
      var offen  = gepinnt || gesperrt;
      var menue  = menueOffen();
      /* Der Riegel: was OEFFNET, setzt ihn; erst wenn NICHTS mehr haelt, faellt er. Ohne diese
         Trennung schloss ein zugehendes Dropdown die Leiste, obwohl der Zeiger noch drauflag. */
      if (aufTrig || menue) vorschau = true;
      else if (!(drin || fokus)) vorschau = false;
      var sichtbar = offen || (!offen && vorschau);

      root.classList.toggle("is-tools-locked", gesperrt);
      root.classList.toggle("is-tools-open", offen);
      root.classList.toggle("is-tools-peek", !offen && vorschau);
      if (elTrig) elTrig.setAttribute("aria-expanded", sichtbar ? "true" : "false");

      /* is-tools-shown nimmt die Kappung weg, aber erst NACH der Bewegung -- sonst haengt beim
         Aufziehen ein Menue heraus. Und sie MUSS fallen, sonst schneidet sie jedes Dropdown ab.
         Eine Uhr mit benanntem Ende, NICHT transitionend: in einem Bubble-Tab, der gerade nicht
         gemalt wird, laeuft der Uebergang nicht und das Ereignis kommt nie an.
         Nur bei einem WECHSEL neu stellen: sync() laeuft bei jeder Zustandsaenderung, und ein
         Neustellen bei jedem Aufruf schoebe das Ende der Kappung immer weiter hinaus. */
      if (sichtbar !== zuletztSichtbar){
        zuletztSichtbar = sichtbar;
        window.clearTimeout(uhrFertig); uhrFertig = null;
        if (sichtbar){
          uhrFertig = window.setTimeout(function(){
            uhrFertig = null; root.classList.add("is-tools-shown");
          }, ANIM_MS + 20);
        } else {
          root.classList.remove("is-tools-shown");
        }
      }
    }

    /* Von der Breitenlogik der Komponente aufgerufen. Ohne Argument misst er selbst -- EIN
       Lesezugriff, und nur wenn der Aufrufer die Breite nicht ohnehin schon hat. */
    function refit(breite){
      var w = breite;
      if (w == null){ try { w = root.getBoundingClientRect().width || 0; } catch(e){ w = 0; } }
      var neuAus = w > 0 && w < MIN_W;
      if (neuAus === aus){ if (!aus) sync(); return; }
      aus = neuAus;
      if (aus){
        window.clearTimeout(uhrAuf); uhrAuf = null;
        window.clearTimeout(uhrZu);  uhrZu  = null;
        window.clearTimeout(uhrFertig); uhrFertig = null;
        drin = false; aufTrig = false; fokus = false; vorschau = false;
      }
      sync();
    }

    function destroy(){
      window.clearTimeout(uhrAuf); window.clearTimeout(uhrZu); window.clearTimeout(uhrFertig);
      root.classList.remove("is-tools-open", "is-tools-peek", "is-tools-shown",
                            "is-tools-locked", "is-tools-off");
    }

    bauen(); sync();
    return {
      sync: function(){ bauen(); sync(); },
      refit: refit,
      destroy: destroy,
      gepinnt: function(){ return gepinnt; }
    };
  }

  /* ---------- makePopover ----------
     Open/close mechanics for every dropdown in the library. There were four different versions of
     this (each table's, visibility-chart's, topcitations', and citations-combo-chart's), which is
     why one of them ended up hard-toggling `display` — breaking the "menu always stays in the
     layout" rule in STYLEGUIDE §6 — and why only some of them restore focus or revert drafts.

     Registration is page-global so ONE document click listener serves every popover on the page,
     instead of one listener per menu per instance as before.

     cfg: { wrap, menu, opener?, onClose?(committed), group?, canOpen?() }
       wrap   — the position:relative element that gets .is-open
       menu   — the position:absolute child that gets .is-shown + aria-hidden
       opener — the trigger button (focus is moved off it before hiding, so the menu can't be
                re-opened by a stray Enter on a now-hidden control)
       onClose(committed) — called on every close; `committed` is false unless close(true) was
                used, which is how a component reverts unapplied draft state.
       group  — only scopes an explicit UC.closePopovers(except, group) call. Opening a popover
                always closes every other one on the page regardless of group: two open dropdowns
                is never a state we want. */
  var POPOVERS = (window.__upPopovers = window.__upPopovers || []);
  /* ---------- makeSubmenu ----------
     Ein Dropdown NEBEN einem Dropdown: eine Zeile im Panel, aus der ein zweites Panel
     herausfaehrt. Die Geometrie steht in core.css (.up-subwrap / .up-submenu), hier steht das
     Verhalten -- und das ist der Teil, der sich nicht in CSS ausdruecken laesst:

       - Zeigen OEFFNET nach einer kurzen Verweildauer, aber es SCHLIESST erst nach einer
         Nachlaufzeit. Ohne die Nachlaufzeit reisst der Weg vom Panel ins Untermenue ab, sobald
         der Zeiger die Luecke zwischen beiden ueberquert (die CSS-Bruecke deckt sie, die
         Nachlaufzeit ist der Guertel dazu).
       - KLICKEN stellt fest: das Untermenue bleibt offen, bis eine andere Zeile geklickt wird,
         bis es nach draussen geht oder bis Escape kommt. Mit :hover allein waere das nicht
         ausdrueckbar, und genau das wollte der Fall hier.
       - Auf einer schmalen Seite gibt es kein "daneben" und keinen Zeiger, der stehen bleibt.
         Dort wird aus dem Herausfahren ein HINEINGEHEN: .is-drill am Panel, .is-inside solange
         eine Zeile offen ist, und die erste Ebene tritt zurueck. Die Regeln dafuer stehen in
         core.css; hier fallen nur die Klassen und der Hover-Weg weg.
       - Nach LINKS, und nach rechts nur wenn links kein Platz ist. Gemessen am Fenster, nicht
         geraten.

     cfg:
       panel      das Panel, in dem die Zeilen stehen (traegt is-drill / is-inside)
       rowSel     Selektor der Zeilen MIT Untermenue (Vorgabe ".up-subwrap")
       keyAttr    Attribut, aus dem der Schluessel der Zeile kommt (Vorgabe "data-sub")
       openDelay  Verweildauer bis zum Oeffnen (Vorgabe 90)
       closeDelay Nachlaufzeit bis zum Schliessen (Vorgabe 260)
       drillAt    Seitenbreite, unter der hineingegangen statt herausgefahren wird (Vorgabe 768)
       drill      Funktion -> true, wenn hineingegangen werden soll. Ueberschreibt drillAt.
                  Der Grund fuer diesen Haken: die Komponente entscheidet dasselbe oft noch ein
                  zweites Mal (die Leiste bricht um, das Panel wird breiter). Zwei Rechnungen aus
                  derselben Zahl laufen auseinander -- also gibt es EINE, und die gehoert dem
                  Aufrufer, wenn er sie ohnehin braucht.
       onOpen(key, row) / onClose(key, row)
     Rueckgabe: { open(key), close(), current(), gepinnt(), sync(), drill() } */
  function makeSubmenu(cfg){
    cfg = cfg || {};
    var panel = cfg.panel;
    if (!panel) return { open: function(){}, close: function(){}, current: function(){ return null; },
                         gepinnt: function(){ return false; }, sync: function(){}, drill: function(){ return false; } };
    var ROW = cfg.rowSel || ".up-subwrap";
    var KEY = cfg.keyAttr || "data-sub";
    var AUF = cfg.openDelay == null ? 90 : cfg.openDelay;
    var ZU  = cfg.closeDelay == null ? 260 : cfg.closeDelay;
    var DRILL_AT = cfg.drillAt == null ? 768 : cfg.drillAt;

    var offen = null, gepinnt = false, uhrAuf = null, uhrZu = null;

    /* ---- EINE Schale fuer alle Zeilen (cfg.shell) ----------------------------------------
       Ohne cfg.shell bleibt es beim alten Bau: ein Kasten JE Zeile, im .up-subwrap. Der
       Nachteil ist sichtbar, sobald man von einer Zeile zur naechsten faehrt -- der eine
       Kasten blendet aus, der andere ein. Das ist ein Sprung, kein Rutschen, und genau so
       wurde es gemeldet.
       Mit cfg.shell gibt es EINEN Kasten. Er sitzt im Panel (nicht in einer Zeile), rueckt an
       die offene Zeile und nimmt die Hoehe ihres Inhalts an -- beides mit Uebergang. Der
       Inhalt liegt in Huellen darin, eine je Zeile, und nur die offene ist sichtbar. Es wird
       NICHTS umgehaengt: die Huellen bleiben, wo sie sind, und wechseln nur ihre Klasse. Das
       ist der Grund fuer diesen Bau -- ein Umhaengen des Inhalts (der naheliegende Weg) haette
       in der Filterleiste die eingezogenen Filterwurzeln bewegt, und die sind genau das, was
       dort nicht wandern darf. */
    var SHELL = cfg.shell || null;
    var HOST_ATTR = cfg.hostAttr || "data-sub-host";
    /* Muss zur CSS passen (.up-submenu: top/height 200ms). Wird nur zum Aufraeumen der
       Pixelhoehe gebraucht, darum mit Reserve. */
    var ZUG_MS = cfg.moveMs == null ? 100 : cfg.moveMs;
    var zugUhr = null;

    function huellen(){
      return SHELL ? Array.prototype.slice.call(SHELL.querySelectorAll("[" + HOST_ATTR + "]")) : [];
    }
    function polster(){
      var v = 0;
      try { v = parseFloat(getComputedStyle(panel).getPropertyValue("--up-dd-pad")); } catch(e){}
      return isFinite(v) && v > 0 ? v : 8;
    }
    /* Die Schale an die offene Zeile setzen. Die Hoehe MUSS in Pixeln stehen, sonst gibt es
       nichts zu animieren: alte einfrieren, neue messen, neue setzen -- und nach dem Zug
       zurueck auf auto, damit die Schale einer Liste folgt, die sich beim Suchen verkuerzt.
       row.offsetTop und die Schale beziehen sich auf dasselbe Elternteil (das Panel ist das
       naechste positionierte), also ist die Rechnung dieselbe wie das frueher feste
       top: calc(-1 * var(--up-dd-pad)) an der Zeile. */
    function schaleStellen(key, animieren){
      if (!SHELL) return;
      var row = zeileVon(key);
      if (!row) return;
      clearTimeout(zugUhr);
      var altH = SHELL.offsetHeight;
      huellen().forEach(function(h){ h.classList.toggle("is-on", h.getAttribute(HOST_ATTR) === key); });
      if (drill()){ SHELL.style.top = ""; SHELL.style.height = ""; return; }
      /* OHNE Zug: den Platz SOFORT einnehmen, ohne Uebergang. Das ist der gemeldete Fall --
         Markets oeffnen, weghovern, dann Topics: die Schale stand noch unten (die letzte
         Position bleibt beim Zugehen stehen, damit der Inhalt nicht vorher leer wird), und beim
         Einblenden rutschte sie nach oben. Rutschen soll sie nur beim WECHSEL, nicht beim
         Aufgehen -- und die CSS-Regel kennt den Unterschied nicht, sie animiert jedes top.
         Also den Uebergang fuer diesen einen Wechsel abschalten. Der Reflow dazwischen ist
         Pflicht: ohne ihn fasst der Browser Abschalten, Setzen und Wiederanschalten zusammen,
         und der Uebergang laeuft doch. */
      if (!animieren || !altH){
        SHELL.style.height = "";
        /* NUR top und height stillstellen, nicht den ganzen Uebergang: is-shown ist eine Zeile
           vorher gesetzt worden, das Einblenden von opacity und transform laeuft also schon.
           Ein transition: none haette es mitgerissen, und die Schale waere ohne Ueberblenden
           da gewesen. Die Dauern aus der CSS bleiben ueber die Reihenfolge zugeordnet:
           opacity und transform stehen dort als erste zwei. */
        SHELL.style.transitionProperty = "opacity, transform";
        SHELL.style.top = (row.offsetTop - polster()) + "px";
        void SHELL.offsetHeight;
        SHELL.style.transitionProperty = "";
        return;
      }
      SHELL.style.top = (row.offsetTop - polster()) + "px";
      SHELL.style.height = "auto";
      var neuH = SHELL.offsetHeight;
      if (neuH === altH){ SHELL.style.height = ""; return; }
      SHELL.style.height = altH + "px";
      /* Reflow erzwingen: ohne das fasst der Browser beide Zuweisungen zusammen und der
         Uebergang faellt aus. */
      void SHELL.offsetHeight;
      SHELL.style.height = neuH + "px";
      zugUhr = setTimeout(function(){ SHELL.style.height = ""; }, ZUG_MS + 60);
    }

    var DRILL_FN = typeof cfg.drill === "function" ? cfg.drill : null;
    function drill(){ return DRILL_FN ? !!DRILL_FN() : (getPageWidth() < DRILL_AT); }
    function zeilen(){ return Array.prototype.slice.call(panel.querySelectorAll(ROW)); }
    function zeileVon(key){
      var l = zeilen();
      for (var i = 0; i < l.length; i++) if (l[i].getAttribute(KEY) === key) return l[i];
      return null;
    }
    /* Nach RECHTS, ausser rechts ist kein Platz -- dann nach links (.is-flipleft). Der Winkel in
       der Zeile zeigt nach rechts, also gehoert das Panel dorthin; links ist der Ausweg.
       Gemessen am Panel und an der Fensterbreite. min-width aus der CSS als Untergrenze: eine
       Messung an einem Element, dessen Inhalt erst beim Oeffnen kommt, liefert sonst eine Breite,
       die gleich nicht mehr gilt. */
    function seiteWaehlen(row){
      /* Im Schalen-Modus traegt die Schale die Klasse, sonst die Zeile -- gemessen wird in
         beiden Faellen der Kasten, der wirklich herausfaehrt. */
      var sub = SHELL || (row && row.querySelector(".up-submenu"));
      var ziel = SHELL || row;
      if (!sub || !ziel) return;
      var breite = Math.max(sub.offsetWidth || 0, 220);
      var r = panel.getBoundingClientRect();
      var vw = window.innerWidth || document.documentElement.clientWidth || 0;
      var luecke = 24;   /* Polster + Abstand + Rahmen, grosszuegig gerundet */
      var passtRechts = (r.right + luecke + breite) <= (vw - 8);
      var passtLinks = (r.left - luecke - breite) >= 8;
      /* Passt keine Seite, bleibt es bei rechts: dort schneidet das Fenster ab, links waere es
         dasselbe -- und rechts ist die Richtung, die der Winkel ansagt. */
      ziel.classList.toggle("is-flipleft", !passtRechts && passtLinks);
    }
    function anwenden(animieren){
      panel.classList.toggle("is-drill", drill());
      panel.classList.toggle("is-inside", !!offen && drill());
      zeilen().forEach(function(r){
        var an = !!offen && r.getAttribute(KEY) === offen;
        r.classList.toggle("is-subopen", an);
        var b = r.querySelector("[aria-expanded]");
        if (b) b.setAttribute("aria-expanded", an ? "true" : "false");
        if (an && !drill() && !SHELL) seiteWaehlen(r);
        if (!an && !SHELL) r.classList.remove("is-flipleft");
      });
      if (!SHELL) return;
      SHELL.classList.toggle("is-shown", !!offen);
      if (!offen){
        /* Beim Zugehen bleibt der letzte Inhalt STEHEN. Ihn hier zu verstecken hiesse: der
           Kasten wird leer und blendet dann aus -- man sieht ein leeres Kaestchen verschwinden.
           Sichtbar ist er ohnehin nicht mehr (opacity 0, pointer-events none). */
        clearTimeout(zugUhr);
        SHELL.style.height = "";
        SHELL.classList.remove("is-flipleft");
        return;
      }
      if (!drill()) seiteWaehlen(zeileVon(offen));
      schaleStellen(offen, !!animieren);
    }
    function open(key, pin){
      clearTimeout(uhrAuf); clearTimeout(uhrZu);
      if (offen === key){ if (pin) gepinnt = true; return; }
      var alt = offen, altRow = alt ? zeileVon(alt) : null;
      offen = key; if (pin) gepinnt = true;
      /* Animiert wird nur der WECHSEL von einer offenen Zeile zur naechsten. Beim ersten
         Oeffnen gibt es keinen Weg zurueckzulegen -- da blendet die Schale ein, wie jedes
         andere Dropdown der App. */
      anwenden(!!alt);
      if (alt && cfg.onClose) { try { cfg.onClose(alt, altRow); } catch(e){} }
      if (cfg.onOpen) { try { cfg.onOpen(key, zeileVon(key)); } catch(e){} }
    }
    function close(){
      clearTimeout(uhrAuf); clearTimeout(uhrZu);
      if (!offen) { gepinnt = false; anwenden(); return; }
      var alt = offen, altRow = zeileVon(alt);
      offen = null; gepinnt = false;
      anwenden();
      if (cfg.onClose) { try { cfg.onClose(alt, altRow); } catch(e){} }
    }

    /* Zeigen: nur wenn es einen Zeiger gibt UND nicht hineingegangen wird. pointerenter statt
       mouseenter, damit ein Stift dieselbe Behandlung bekommt; ein Finger meldet sich als "touch"
       und wird uebergangen -- dort entscheidet der Klick. */
    panel.addEventListener("pointerover", function(e){
      if (drill()) return;
      if (e.pointerType === "touch") return;
      /* Die Schale liegt im Panel, aber NICHT in einer Zeile -- ohne diese Zeile waere ein
         Zeiger in der Schale ein Zeiger "irgendwo im Panel", und das offene Untermenue ginge
         nach ZU ms unter der Hand zu. Genau daran ist der Bau mit einer Schale zu erkennen:
         beim Kasten je Zeile fand closest(ROW) noch die Zeile. */
      if (SHELL && e.target.closest && e.target.closest(".up-submenu")){
        clearTimeout(uhrZu); clearTimeout(uhrAuf);
        return;
      }
      var row = e.target.closest ? e.target.closest(ROW) : null;
      clearTimeout(uhrZu);
      if (!row){
        /* Innerhalb des Panels, aber nicht auf einer Zeile mit Untermenue: das offene stehen
           lassen, solange es festgestellt ist -- sonst ginge es zu, waehrend man nur zum
           Reset-Knopf darunter faehrt. */
        if (!gepinnt && offen) uhrZu = setTimeout(close, ZU);
        return;
      }
      var key = row.getAttribute(KEY);
      if (key === offen) return;
      clearTimeout(uhrAuf);
      uhrAuf = setTimeout(function(){ open(key, false); }, AUF);
    });
    panel.addEventListener("pointerleave", function(e){
      if (drill()) return;
      if (e.pointerType === "touch") return;
      clearTimeout(uhrAuf);
      if (gepinnt) return;
      uhrZu = setTimeout(close, ZU);
    });
    /* Klick: feststellen. Ein zweiter Klick auf dieselbe Zeile geht wieder zu -- das ist die
       Erwartung an einen Aufklapper, und im Hineingehen ist es der Weg zurueck. */
    panel.addEventListener("click", function(e){
      if (!e.target.closest) return;
      if (e.target.closest(".up-subback")){ close(); return; }
      /* Ein Klick IM Untermenue gehoert dem Untermenue -- er darf die Zeile nicht umschalten. */
      if (e.target.closest(".up-submenu")) return;
      var row = e.target.closest(ROW);
      if (!row) return;
      var key = row.getAttribute(KEY);
      if (offen === key && gepinnt){ close(); return; }
      open(key, true);
    });

    /* Die Stufe kann sich aendern, ohne dass jemand klickt (Drehen des Telefons, Fenster ziehen).
       Ueber aufResize, also entprellt und mit Breitenwaechter. */
    if (typeof aufResize === "function") aufResize(function(){ anwenden(); });
    anwenden();

    return { open: open, close: close, current: function(){ return offen; },
             gepinnt: function(){ return gepinnt; }, sync: anwenden, drill: drill };
  }

  function makePopover(cfg){
    var wrap = cfg.wrap, menu = cfg.menu;
    if (!wrap || !menu) return { open: function(){}, close: function(){}, toggle: function(){}, isOpen: function(){ return false; } };
    var opener = cfg.opener || null;
    var rec = { wrap: wrap, menu: menu, opener: opener, onClose: cfg.onClose || null, group: cfg.group || null };
    for (var i = 0; i < POPOVERS.length; i++){ if (POPOVERS[i].wrap === wrap){ POPOVERS.splice(i, 1); break; } }
    POPOVERS.push(rec);

    var unreg = null;
    function isOpen(){ return wrap.classList.contains("is-open"); }
    function close(committed){
      if (!isOpen()) return;
      if (unreg){ unreg(); unreg = null; }
      /* move focus off anything inside the menu BEFORE hiding it — a focused element inside a
         hidden subtree is an accessibility trap and keeps swallowing keystrokes */
      try {
        var a = document.activeElement;
        if (a && menu.contains(a)){ if (rec.opener && rec.opener.focus) rec.opener.focus(); else a.blur(); }
        if (rec.opener && document.activeElement === rec.opener && rec.opener.blur) rec.opener.blur();
      } catch(e){}
      dropEscape(menu);
      wrap.classList.remove("is-open");
      menu.classList.remove("is-shown");
      menu.setAttribute("aria-hidden", "true");
      if (rec.onClose) { try { rec.onClose(!!committed); } catch(e){} }
      /* Ein Ereignis am Wrapper, das aufsteigt -- damit ein Aufrufer auf das Schliessen reagieren
         kann, OHNE dafuer einen Beobachter laufen zu lassen. Gebraucht von der einklappbaren
         Werkzeugleiste in prompts-table: die haelt sich offen, solange ein Menue darin offen ist,
         und erfuhr vom Schliessen bisher gar nichts -- sie blieb danach stehen (gemeldet am
         24.08.). Ein Zustands-Callback pro Popover haette dasselbe geleistet, aber jeder Aufrufer
         haette seinen eigenen schreiben muessen; ein aufsteigendes Ereignis kostet einen
         Zuhoerer fuer beliebig viele Menues. */
      try { wrap.dispatchEvent(new CustomEvent("up-popover-close", { bubbles: true })); } catch(e){}
    }
    /* Ein Dropdown, dessen Inhalt noch unterwegs ist, darf sich nicht oeffnen lassen. Sonst
       klappt ein 8px hoher, leerer Kasten auf, und das sieht nach kaputt aus, obwohl nur die
       Daten fehlen. cfg.canOpen() beantwortet genau diese Frage; fehlt sie, aendert sich nichts.
       WICHTIG: leer und ladend sind zwei verschiedene Zustaende. Ein Dropdown, das legitim leer
       ist, soll sich weiterhin oeffnen lassen und "keine Eintraege" zeigen -- die Entscheidung
       trifft die Komponente, nicht diese Funktion. */
    function canOpen(){
      if (typeof cfg.canOpen !== "function") return true;
      try { return cfg.canOpen() !== false; } catch(e){ return true; }
    }
    /* Den Knopf mitfuehren, damit der Grund sichtbar ist statt nur spuerbar: wer klickt und
       nichts passiert, haelt das fuer einen Fehler. */
    function syncOpener(){
      if (!opener) return;
      var zu = !canOpen();
      opener.classList.toggle("is-disabled", zu);
      opener.setAttribute("aria-disabled", zu ? "true" : "false");
    }
    function open(){
      if (isOpen()) return;
      if (!canOpen()){ syncOpener(); return; }
      /* Closes EVERY other popover on the page, not just this component's. Two dropdowns open at
         once is never wanted, and scoping this by group meant a menu in one component stayed open
         while you opened one in another. Relying on the outside-click listener for that is not
         enough either: several openers call stopPropagation(), so that click never reaches the
         document handler — closing here is the reliable path. */
      closeAll(wrap, null);
      /* ...and the OTHER registry too. Popovers close each other through closeAll above, but
         dropdowns built without makePopover (the date range picker's twin, the topics filter)
         register with UC.dropdownOpened instead -- two lists that did not know about each other,
         so opening a calendar left a topics panel standing. Registering here puts every dropdown
         in the app into ONE list regardless of how it was built: dropdownOpened closes the others
         and hands back an unregister, which close() below calls. */
      /* Zur LAUFZEIT aufloesen, nicht die lokale Funktion nehmen. Eine Seite mit gemischten
         data-cdn-pin-Werten traegt mehrere core.js-Kopien; jede Komponente haengt an der, die zu
         ihrem Boot-Zeitpunkt da war. Genau daran ist der Kalender haengengeblieben, waehrend die
         drei Filter -- die dropdownOpened selbst und frisch aufloesen -- laengst richtig liefen.
         Die Registries liegen auf window und werden geteilt, es zaehlt also nur, welche
         AUFRUFENDE Funktion gewinnt. */
      var ddOpen = (window.UpstreemCore && window.UpstreemCore.dropdownOpened) ||
                   (typeof dropdownOpened === "function" ? dropdownOpened : null);
      if (ddOpen){
        unreg = ddOpen(menu, function(){ close(false); }, wrap);
      }
      wrap.classList.add("is-open");
      menu.classList.add("is-shown");
      menu.setAttribute("aria-hidden", "false");
    }
    function toggle(){ if (isOpen()) close(false); else open(); }
    syncOpener();
    return { open: open, close: close, toggle: toggle, isOpen: isOpen,
             syncOpener: syncOpener, el: wrap };
  }
  function closeAll(exceptWrap, group){
    for (var i = 0; i < POPOVERS.length; i++){
      var p = POPOVERS[i];
      if (p.wrap === exceptWrap) continue;
      if (group && p.group && p.group !== group) continue;
      if (!p.wrap.classList.contains("is-open")) continue;
      if (!document.contains(p.wrap)){ POPOVERS.splice(i--, 1); continue; }   // stale after a rebuild
      dropEscape(p.menu);
      p.wrap.classList.remove("is-open");
      p.menu.classList.remove("is-shown");
      p.menu.setAttribute("aria-hidden", "true");
      if (p.onClose) { try { p.onClose(false); } catch(e){} }
    }
  }
  if (!window.__upPopoverGlobalBound){
    window.__upPopoverGlobalBound = true;
    /* pointerdown, not click: a click event fires wherever the pointer physically RELEASES, which
       for anything you can drag inside a popover (a range slider, most notably) is wherever the
       drag happened to end — often nowhere near the menu, sometimes outside the whole component.
       That stray click used to read as "clicked outside" and closed the popover mid-drag, no
       matter how carefully the drag itself was handled (pointer-capture on the slider inputs
       still couldn't save it, because the mis-targeted event was never really about the drag
       target at all — it was this listener reacting to release position). Deciding on pointerDOWN
       instead makes the call once, at gesture START, using where the user actually put their
       finger/cursor down — which is always correct: down inside the menu never closes it,
       wherever the matching up/click eventually lands. */
    document.addEventListener("pointerdown", function(e){
      for (var i = 0; i < POPOVERS.length; i++){
        var p = POPOVERS[i];
        if (!document.contains(p.wrap)){ POPOVERS.splice(i--, 1); continue; }
        if (!p.wrap.classList.contains("is-open")) continue;
        /* p.menu ausdruecklich mit: liegt das Menue in der obersten Ebene (popover) oder in einem
           Portal, ist es KEIN Nachfahre von wrap mehr, und ein Klick auf einen seiner eigenen
           Eintraege zaehlte sonst als Klick nach draussen -- das Menue schloesse sich unter der
           Hand des Nutzers. Solange das Menue wie ueblich im wrap steckt, aendert die Zeile
           nichts: der erste Test greift dann schon. */
        if (p.wrap.contains(e.target)) continue;   // press inside the trigger or the menu itself
        if (p.menu && p.menu.contains(e.target)) continue;
        dropEscape(p.menu);
        p.wrap.classList.remove("is-open");
        p.menu.classList.remove("is-shown");
        p.menu.setAttribute("aria-hidden", "true");
        if (p.onClose) { try { p.onClose(false); } catch(err){} }
      }
    });
    document.addEventListener("keydown", function(e){
      if (e.key !== "Escape" && e.keyCode !== 27) return;
      closeAll(null, null);
    });
  }

  /* Walks a root's ancestors and neutralizes any overflow:hidden/clip it finds (stopping at the
     first real scroll container, or body/html) — Bubble frequently wraps a component in a plain
     group div that clips overflow with no scrolling of its own, which cuts off anything the
     component tries to render OUTSIDE its own box: a position:sticky header trying to escape, or
     — just as often — a plain position:absolute dropdown menu that needs to hang below a short
     component. Marks what it touches via a data-up-unclipped attribute (storing the prior inline
     value) so restore(true) can put it back. Originally private to makeSticky (only useful when
     sticky was ACTUALLY engaged); pulled out standalone because dropdown clipping has nothing to
     do with whether the header happens to be sticky — a component with no sticky header at all
     (topics-manager, no data-sticky-top concept) still needs its sort/filter menus to escape a
     short host container, and shouldn't have to fake-enable sticky positioning just to get the
     side effect. */
  /* On window: two data-cdn-pin values load core.js twice, and both copies must agree on which
     boxes are scroll regions -- disagreeing is how one of them unclips what the other protects. */
  var SCROLL_REGIONS = window.__upScrollRegions ||
    (window.__upScrollRegions = (typeof WeakSet === "function" ? new WeakSet() : null));

  function unclipAncestors(root, restore){
    /* Beim Ziehen am Fensterrand ruft applySticky() diese Funktion mit jedem Bild -- und sie
       laeuft die ganze Vorfahrenkette hoch und fragt je Ebene getComputedStyle. Gemessen in der
       echten App: 1198 von 12888 Layout-Lesezugriffen (9 Prozent), und zwar fuer eine Antwort,
       die sich waehrend einer Mausbewegung nicht aendert -- die Kette ueber der Wurzel bleibt
       dieselbe, und was einmal entklemmt ist, bleibt es.
       Also hoechstens alle drei Sekunden erneut (erst 500ms -- in der Messung standen davon immer
       noch 613 Lesezugriffe, 13 Prozent), und nur solange die Wurzel am selben Elternteil haengt.
       Haengt Bubble sie woanders ein, faellt der Vergleich und der Lauf kommt sofort wieder.
       Der Rueckbau (restore) laeuft immer, der ist selten und muss greifen. */
    /* Waehrend einer Ziehbewegung gar nicht: die Kette ueber der Wurzel aendert sich dabei nicht,
       und getComputedStyle je Ebene ist teuer. */
    if (!restore && typeof zieht === "function" && zieht()) return;
    if (!restore && root && root.__upUnclipEltern === root.parentElement){
      var jetzt = (window.performance && performance.now) ? performance.now() : +new Date();
      if (jetzt - (root.__upUnclipZeit || 0) < 3000) return;
      root.__upUnclipZeit = jetzt;
    } else if (!restore && root){
      root.__upUnclipEltern = root.parentElement;
      root.__upUnclipZeit = (window.performance && performance.now) ? performance.now() : +new Date();
    }
    /* Seitenweiter Ruecknahme-Sweep fuer data-up-lifted -- siehe die lange Begruendung weiter
       unten in der Schleife. Der Lift ist raus; dieser Sweep raeumt weg, was eine aeltere
       core.js aus einem anderen data-cdn-pin auf derselben Seite noch schreibt. Er laeuft
       ueber das GANZE Dokument und nicht nur ueber die Vorfahren dieses Roots, weil der Lift
       von jedem beliebigen Component-Mount stammen kann -- auch von einem, dessen Root
       inzwischen weg ist. */
    try {
      var lifted = document.querySelectorAll("[data-up-lifted]");
      for (var li = 0; li < lifted.length; li++){
        lifted[li].style.zIndex = lifted[li].getAttribute("data-up-lifted") || "";
        lifted[li].removeAttribute("data-up-lifted");
      }
    } catch(e){}
    var el = root.parentElement, guard = 0;
    /* Dieselbe Vorfahrenkette wird pro Bild von JEDER Komponente einmal durchgemessen -- und die
       Kette ist geteilt: #main misst auf einer Seite mit acht Tabellen achtmal, mit demselben
       Ergebnis. Gemessen auf der echten Seite (40 Resize-Schritte): 2993 Lesezugriffe allein
       hier, 25% aller Zugriffe, davon 2247 auf getComputedStyle. Der zweite bis achte Durchlauf
       findet ohnehin nichts mehr zu tun (data-up-unclipped steht schon), er zahlt nur die
       Messung.
       Der Speicher liegt auf WINDOW, nicht in diesem Modul: core.js laeuft einmal pro Komponente
       (siehe watchRoots), jede Kopie haette sonst ihren eigenen -- und genau die Dopplung
       ueber Komponenten hinweg ist der Punkt.
       16ms, also ein Bild. Der bewusst hingenommene Preis: kippt die App #main innerhalb
       desselben Bildes auf overflow:hidden (Drawer), sieht ein zweiter Aufruf das erst beim
       naechsten -- der Rueckbau passiert dann einen Aufruf spaeter, nicht nie. Der RESTORE-Weg
       ist ausgenommen und laeuft immer: er nimmt zurueck, was wir geschrieben haben, und das
       darf nie an einem Zeitfenster haengen. */
    var UNCLIP_GESEHEN = window.WeakMap
      ? (window.__upUnclipGesehen = window.__upUnclipGesehen || new WeakMap()) : null;
    var jetzt = new Date().getTime();
    while (el && el !== document.body && el !== document.documentElement && guard++ < 40){
      if (!restore && UNCLIP_GESEHEN){
        var zuletzt = UNCLIP_GESEHEN.get(el);
        if (zuletzt && (jetzt - zuletzt) < 16){ el = el.parentElement; continue; }
        UNCLIP_GESEHEN.set(el, jetzt);
      }
      /* data-up-keepclip: DIESER Zuschnitt ist gewollt und bleibt, und darueber wird auch nichts
         mehr angefasst.
         Diesen Durchlauf gibt es, um die Gruppencontainer von Bubble zu entklammern: die
         beschneiden ohne eigenen Grund und schneiden Sticky-Koepfe und Dropdowns ab. Es gibt aber
         Hosts, deren Beschnitt die AUSSAGE ist -- die Hero-Sektion der Landingpage zeigt die App in
         einem Fenster, und die Kante dieses Fensters ist der ganze Sinn. Dort hat dieser Durchlauf
         den Beschnitt weggenommen, und die Tabelle lief unter dem Fenster weiter ins Nichts.
         Ein Attribut und keine Heuristik: ob ein Beschnitt gewollt ist, laesst sich nicht messen.
         Wer es setzt, sagt zu, dass in diesem Kasten genug Platz fuer Menues und Koepfe ist -- in
         einem Fenster, das die App in Originalgroesse zeigt, ist er das. */
      if (el.hasAttribute("data-up-keepclip")) break;
      var cs; try { cs = window.getComputedStyle(el); } catch(e){ break; }
      var oy = cs.overflowY;
      /* The real scroll container: leave it alone, everything above it is none of our business.
         "Real" means it actually scrolls, not just that overflow-y computes to auto -- and those
         two come apart constantly: per spec, a box with overflow-x:hidden and overflow-y:visible
         computes overflow-y to AUTO. Host wrappers set overflow-x:hidden all the time for
         responsive reasons, and such a wrapper is content-height, so it never scrolls -- but the
         browser still treats it as the nearest scrollport, which means a sticky header inside it
         has nothing to stick to and simply scrolls away. Bailing out here also left it clipping.
         So: only stop at a box that genuinely has scrollable overflow; anything else counts as a
         clipper and gets unclipped, which removes it as a scrollport too. */
      var canScrollY = (oy === "auto" || oy === "scroll" || oy === "overlay");
      var scrolls = canScrollY && el.scrollHeight > el.clientHeight + 1;
      /* "It does not overflow right now" is NOT the same as "it is not the scroll container".
         Components boot before the page's data arrives, so the app's own scroll region is
         routinely still empty at this moment -- and then this walked straight into it and wrote an
         inline overflow:visible, which never comes back. The page loses its scroll container for
         good: content spills into the document, which becomes the scroller instead, and the page
         can be scrolled far past the end of the app's own content into empty space.
         Reproduced: #main with overflow-y:auto, 800px tall, 500px of content at boot -> unclipped
         -> still overflow:visible once 2300px of real content arrived, never scrolled again.
         So also refuse to touch anything that CAN scroll vertically and is about as tall as the
         viewport: that shape is an app scroll region, empty or not. The wrappers this function
         exists for are short (a short component means a short Bubble wrapper), so this costs
         nothing -- they stay unclipped exactly as before. */
      /* WHICH ancestor is the page's scroll region, and which is just a clipper.

         This used to be decided by HEIGHT: anything at least 80% of the viewport tall was assumed
         to be a page region and left alone. That assumption was "a short component means a short
         host wrapper" -- true until prompt-research was converted to page scrolling, at which
         point its Bubble HTML wrapper became 1561px tall with overflow:hidden, got skipped as a
         supposed page region, and kept clipping. Measured on the real page: the sticky toolbar had
         position:sticky and top:16px and still scrolled away, because sticky is bounded by that
         wrapper. Height never was the distinction.

         The distinction is whether the box SCROLLS. #main computes overflow-y:auto; the HTML
         wrapper computes hidden and always did. The one complication is that the app sets #main to
         overflow:hidden while a drawer is open, so a snapshot taken at that moment would misread
         it as a plain clipper -- which is what the height rule was really protecting against. So
         the answer is remembered instead of re-derived: an element seen with scrollable overflow
         even once is a scroll region for the life of the page, drawer or no drawer. */
      var canScrollY2 = canScrollY;
      if (canScrollY2 && SCROLL_REGIONS) { try { SCROLL_REGIONS.add(el); } catch(e){} }
      var knownScroller = false;
      if (SCROLL_REGIONS) { try { knownScroller = SCROLL_REGIONS.has(el); } catch(e){} }
      if (canScrollY2 || knownScroller){
        /* Repair a scroll region this function wrote onto before it knew better -- either under
           the old height rule, or on a tick where a drawer had it locked to hidden. */
        if (el.hasAttribute("data-up-unclipped")){
          el.style.overflow = el.getAttribute("data-up-unclipped") || "";
          el.removeAttribute("data-up-unclipped");
        }
        break;
      }
      var clips = (cs.overflow === "hidden" || cs.overflow === "clip" ||
                   cs.overflowX === "hidden" || cs.overflowX === "clip" ||
                   oy === "hidden" || oy === "clip");
      /* ---- data-up-lifted: ZURUECKGENOMMEN, und darf nicht wiederkommen ----
         Hier stand ein Block, der jedem Vorfahren mit explizitem z-index eine 99997 verpasst hat,
         damit ein Dropdown im Drawer nicht mehr von Nachbargruppen ueberdeckt wird. Das hat die
         gesamte App zerlegt: unclipAncestors laeuft beim MOUNT jeder Komponente, nicht erst beim
         Oeffnen eines Menues. Also bekam der Bubble-Container, in dem die Komponente steckt,
         dauerhaft 99997 -- und damit lag er ueber allem, was die App selbst noch aufmacht.
         Drawer (z 9905-9930) und jede Focus-Group oeffneten weiterhin korrekt, wurden aber
         HINTER diesem gehobenen Container gezeichnet und waren unsichtbar. Genau das Bild:
         "die URL wird gesetzt, die Daten laden, aber der Drawer geht nicht auf".

         Ein Dropdown-Problem rechtfertigt nie, fremde Stapelung dauerhaft umzuschreiben: dieses
         Modul weiss nichts ueber die Ebenen der Host-App und kann darum nicht entscheiden, was
         ueber was gehoert. Clipping aufzuheben ist lokal und reversibel, Stapelung zu heben ist
         es nicht.

         Aktiv aufraeumen statt nur weglassen: liegt auf der Seite noch eine aeltere core.js aus
         einem anderen data-cdn-pin, setzt DIE den Lift weiter. Jeder Durchlauf hier nimmt darum
         zurueck, was er an data-up-lifted findet -- egal wer es geschrieben hat. */
      if (el.hasAttribute("data-up-lifted")){
        el.style.zIndex = el.getAttribute("data-up-lifted") || "";
        el.removeAttribute("data-up-lifted");
      }
      if (restore){
        if (el.hasAttribute("data-up-unclipped")){ el.style.overflow = el.getAttribute("data-up-unclipped") || ""; el.removeAttribute("data-up-unclipped"); }
      } else if (clips && !el.hasAttribute("data-up-unclipped")){
        el.setAttribute("data-up-unclipped", el.style.overflow || "");
        el.style.overflow = "visible";
      }
      el = el.parentElement;
    }
  }

  /* Collapses a burst of calls into one per animation frame, keeping the LAST call's arguments.
     Resize and pointermove both fire faster than the screen refreshes, so anything that measures
     or writes layout in response wants this — otherwise the same work runs several times to
     produce one visible frame, which is exactly how a resize starts feeling like it runs at a
     fraction of the real frame rate. Deliberately trailing-edge: the final event of a burst is
     the one whose state is correct. */
  /* One responsive hook per component, coalesced to one call per frame.
     Replaces the "ResizeObserver + window.resize(rafThrottle(fn))" pair the tables were using:
     during a window drag BOTH fire every frame, so the layout pass ran TWICE per frame — and
     each pass forces several synchronous reflows (fitToolbar measures, writes a class, measures
     again). Measured 9 forced layouts per frame with the pair, ~4 with this.
     A ResizeObserver on the root is sufficient on its own: if the window changes but the root's
     box does not, there is by definition nothing to re-fit.
     The width guard drops the frames where the observer fires for a height-only change (row
     render, popover open) — those cannot affect a horizontal fit. */
  /* EIN Takt fuer ALLE Komponenten, und darin erst messen, dann schreiben.
     Vorher hatte jede Komponente ihren eigenen rAF: A misst, A schreibt, B misst, B schreibt --
     und jede Messung NACH einem Schreibvorgang zwingt den Browser, das Layout sofort neu zu
     rechnen. Bei zwoelf Komponenten auf einer Seite sind das zwoelf erzwungene Layouts je Bild,
     und genau die meldet die Konsole als "Forced reflow while executing JavaScript".
     Jetzt sammelt eine Schlange alle Wurzeln, die der Beobachter gemeldet hat. Der Lauf liest
     zuerst JEDE Breite -- das kostet ein einziges Layout fuer alle zusammen -- und ruft danach
     die Rueckmeldungen auf. Was die schreiben, faellt in dieselbe Runde und wird einmal am Ende
     gerechnet.
     einmalProBild statt rAF: rAF feuert in einem Hintergrund-Tab und in einem nicht gemalten
     Rahmen gar nicht, und dann bliebe die Anpassung liegen (derselbe Grund wie ueberall sonst in
     dieser Datei). */
  var _resSchlange = [], _resGeplant = null;
  /* ZEITSCHEIBEN. Gemessen in der App des Nutzers: dieser Lauf war mit 696ms in 27 Aufrufen der
     teuerste Rueckruf ueberhaupt, der laengste einzelne 92ms. Kein Wunder -- er arbeitet die
     Anpassung SAEMTLICHER Komponenten in einem Stueck ab, und ein Block ueber 50ms ist genau das,
     was die Konsole als "Forced reflow" meldet.
     Jetzt bekommt jeder Durchgang ein Budget von 12ms. Was nicht mehr hineinpasst, bleibt in der
     Schlange und kommt im naechsten Bild dran. Optisch ist das dasselbe -- nach drei, vier Bildern
     sind alle Komponenten nachgezogen --, aber keine einzelne Aufgabe wird mehr lang genug, um zu
     ruckeln. */
  var _RES_BUDGET = 12;
  function _resLauf(){
    var liste = _resSchlange; _resSchlange = [];
    var i, e;
    /* 1. Lesen -- aber nur, wenn der Beobachter die Breite nicht schon mitgeliefert hat.
       ResizeObserver gibt sie in entry.contentRect mit, und die ist zum Zeitpunkt des Aufrufs
       frisch gemessen: ein eigener getBoundingClientRect-Aufruf holt dieselbe Zahl noch einmal
       und kostet ein Layout. Bei zwanzig Komponenten und sechzig Bildern in der Sekunde war
       genau das ein Posten von 1138 Lesezugriffen in der Messung des Nutzers. */
    for (i = 0; i < liste.length; i++){
      e = liste[i]; e.q = 0;
      if (e.wRO >= 0){ e.w = e.wRO; e.wRO = -1; }
      else e.w = e.root.getBoundingClientRect().width;
    }
    /* 2. Nur schreiben, und nur solange das Budget reicht.
       Die Schaetzung je Eintrag ist der Kern: eine Komponente, die erfahrungsgemaess lange
       braucht, wird NICHT mehr an das Ende eines schon halb verbrauchten Durchgangs gehaengt.
       Gemessen in der App: der Sammellauf hatte Spitzen von 65ms, und 55 davon kamen aus EINER
       Tabelle -- das Budget half nicht, weil es erst NACH einem Eintrag prueft. Jetzt laeuft ein
       teurer Eintrag allein in seinem Bild, und der Rest folgt im naechsten. */
    var t0 = (window.performance && performance.now) ? performance.now() : 0;
    var verbraucht = 0;
    for (i = 0; i < liste.length; i++){
      e = liste[i];
      if (e.w === e.lastW && !e.immer) continue;
      /* Passt der naechste Eintrag nach Erfahrung nicht mehr ins Budget? Dann ins naechste Bild
         -- aber nur, wenn ueberhaupt schon etwas gelaufen ist: der erste Eintrag muss immer
         drankommen, sonst steht die Anpassung. */
      if (t0 && verbraucht > 0 && (verbraucht + (e.avg || 0)) > _RES_BUDGET){
        for (var v = i; v < liste.length; v++){
          if (liste[v].q) continue;
          liste[v].q = 1; _resSchlange.push(liste[v]);
        }
        _resGeplant();
        return;
      }
      if (t0 && i > 0 && (performance.now() - t0) > _RES_BUDGET){
        /* Rest zurueck in die Schlange -- die Breite ist gemessen und bleibt gueltig, es fehlt
           nur noch die Reaktion darauf. */
        for (var r = i; r < liste.length; r++){
          if (liste[r].q) continue;
          liste[r].q = 1; _resSchlange.push(liste[r]);
        }
        /* Direkt das naechste Bild, nicht ueber _resPlanen: das haelt einen Mindestabstand von
           100ms ein, und der gilt fuer NEUE Meldungen -- der Rest einer angefangenen Runde soll
           dagegen sofort weiter. */
        _resGeplant();
        return;
      }
      e.lastW = e.w;
      /* Die Zeit JE KOMPONENTE. Ohne sie steht in der Konsole nur "dieser Rueckruf brauchte
         431ms" -- und darin steckt die Anpassung von einem Dutzend Komponenten. Der Name kommt
         von der Wurzel (data-instance), also genau die Bezeichnung, unter der die Komponente auch
         in der Sonde auftaucht. Kostet einen Zeitstempel je Aufruf. */
      var _t = (window.performance && performance.now) ? performance.now() : 0;
      try { e.fn(e.w); } catch (err){ if (window.console) console.warn("[upstreem] onResize:", err); }
      if (_t){
        var _d = performance.now() - _t;
        verbraucht += _d;
        /* Gleitender Durchschnitt, damit ein einzelner Ausreisser die Schaetzung nicht auf Dauer
           verzerrt und ein langsamer gewordener Eintrag trotzdem nachzieht. */
        e.avg = e.avg ? (e.avg * 0.7 + _d * 0.3) : _d;
        var _nm = "onResize: " + ((e.root.getAttribute && e.root.getAttribute("data-instance")) ||
                                  (e.root.className || "").split(" ").slice(0, 2).join(".") || "?");
        var _p = _profil[_nm] || (_profil[_nm] = { n: 0, ms: 0, max: 0 });
        _p.n++; _p.ms += _d; if (_d > _p.max) _p.max = _d;
      }
    }
  }
  /* Waehrend einer Ziehbewegung reicht ein Lauf je 100ms. An dieser Rueckmeldung haengt die
     ganze Anpassung der Werkzeugleisten und Tabellen -- fitToolbar misst die Ueberschrift, die
     Werkzeuge, die Suche und die Fusszeile und schreibt danach Klassen. Bei sechzig Bildern in
     der Sekunde und einem Dutzend Tabellen war das in der Messung des Nutzers der groesste
     verbliebene Block: headGap, boxWidth, syncTakeover und die Fusszeilenpruefung zusammen ueber
     ein Viertel aller Lesezugriffe.
     100ms ist der Kompromiss: schnell genug, dass eine wegfallende Spalte dem Rand folgt, und
     langsam genug, dass zwischen zwei Laeufen echte Bilder liegen. Am ENDE der Bewegung laeuft es
     ohnehin noch einmal, weil der Beobachter dann ein letztes Mal meldet. */
  /* "Das Fenster wird gerade gezogen." Zwei Pfade duerfen waehrenddessen komplett pausieren --
     der gleitende Streifen und der Entklemm-Lauf: beide beantworten Fragen, deren Antwort waehrend
     der Bewegung niemanden interessiert, und beide messen dabei viel. Nach 220ms ohne weiteres
     Ereignis gilt die Bewegung als beendet, und wer pausiert hat, laeuft dann einmal.
     Der Zuhoerer steht frueh und passiv: er darf nichts kosten. */
  /* -Infinity und NICHT 0. Mit 0 hiess zieht() "es wird gerade gezogen" fuer die ersten 220ms
     JEDER Seite: performance.now() zaehlt ab dem Seitenaufruf, ist in dieser Zeit also selbst
     kleiner als 220, und 0 als "noch nie gezogen" war damit nicht von "vor einem Augenblick
     gezogen" zu unterscheiden.
     Was das gekostet hat, und warum es nicht auffiel: die drei Stellen, die waehrend einer
     Ziehbewegung pausieren (segLauf, runAll, unclipAncestors), pausierten damit auch beim Laden.
     Zwei davon holen es selbst nach -- runAll plant sich in 250ms neu, segLauf haengt am
     MutationObserver. unclipAncestors NICHT: es laeuft nur aus applySticky(), und das rufen die
     Komponenten beim Init und danach nur noch bei einem Fenster-Resize. Auf einer Seite, die
     niemand in der Groesse zieht, blieb der zu kurze Bubble-Wrapper darum FUER IMMER geklemmt --
     und damit klebte der Spaltenkopf am falschen Scrollcontainer (gemessen im Harness: Tabelle
     ab 220px, Spaltenkopf bei 390px, also mitten in den Zeilen) und Dropdowns der Kopfzeile
     wurden abgeschnitten. Gegentest: derselbe Aufbau mit unclipAncestors von Hand gerufen
     setzte den Kopf sofort auf 358, also genau an die Oberkante der Tabelle.
     Eingeschleppt mit cceae74, der Runde, die diese drei Pausen eingebaut hat. */
  var _zieht = -Infinity;
  function zieht(){ return (((window.performance && performance.now) ? performance.now() : +new Date()) - _zieht) < 220; }
  window.addEventListener("resize", function(){
    _zieht = (window.performance && performance.now) ? performance.now() : +new Date();
  }, { passive: true });

  var _resZuletzt = 0, _RES_ABSTAND = 100;
  function _resPlanen(){
    var jetzt = (window.performance && performance.now) ? performance.now() : +new Date();
    var warte = Math.max(0, _RES_ABSTAND - (jetzt - _resZuletzt));
    if (warte <= 0){ _resZuletzt = jetzt; _resGeplant(); return; }
    if (_resWarteUhr) return;
    _resWarteUhr = setTimeout(function(){
      _resWarteUhr = null;
      _resZuletzt = (window.performance && performance.now) ? performance.now() : +new Date();
      _resGeplant();
    }, warte);
  }
  var _resWarteUhr = null;
  function onResize(root, fn){
    if (!root || typeof fn !== "function") return;
    if (!_resGeplant) _resGeplant = einmalProBild(_resLauf, "onResize-Sammellauf");
    var e = { root: root, fn: fn, lastW: -1, w: 0, q: 0, wRO: -1, avg: 0 };
    function planen(){
      if (e.q) return;
      e.q = 1; _resSchlange.push(e);
      _resPlanen();
    }
    if (window.ResizeObserver){
      new ResizeObserver(function(eintraege){
        /* Die Breite aus dem Eintrag mitnehmen -- siehe _resLauf. borderBoxSize gibt es nicht in
           jedem Browser, contentRect ueberall. */
        try {
          var r = eintraege && eintraege[0] && eintraege[0].contentRect;
          if (r && typeof r.width === "number") e.wRO = r.width;
        } catch (err){}
        planen();
      }).observe(root);
    } else {
      window.addEventListener("resize", planen);
    }
  }

  /* Einmal pro Bild, aber GARANTIERT. rafThrottle daneben nimmt nur rAF -- und rAF feuert nicht
     immer: in einem Hintergrund-Tab und in einem nicht gemalten Rahmen gar nicht (gemessen am
     24.08.: in der Testumgebung feuerte es nirgends). Was daran haengt, bliebe dann liegen, und
     pruefen kann man es auch nicht. Deshalb laufen rAF und ein kurzer Timer gemeinsam los; wer
     zuerst kommt, macht die Arbeit und raeumt den anderen ab. Im sichtbaren Tab gewinnt immer
     rAF, die Arbeit liegt also weiter am Bild -- der Timer ist nur das Netz darunter.
     Ohne Argumente, im Unterschied zu rafThrottle: die Aufrufer hier messen selbst, sie bekommen
     nichts uebergeben. */
  /* Wer wie lange braucht -- auf Abruf, nicht im Betrieb. Alles, was ueber einmalProBild laeuft,
     meldet sich in der Konsole des Nutzers unter DERSELBEN Zeile an (der setTimeout hier drin),
     und das waren zuletzt zwei voellig verschiedene Dinge: der Sammellauf der Groessenanpassung
     und die Trendspalten-Pruefung des Visibility-Charts. Eine Messung, die beide zusammenwirft,
     kann die Frage "was dauert 431ms" nicht beantworten.
     Deshalb traegt jeder Nutzer jetzt einen Namen, und die verbrauchte Zeit wird je Name
     gezaehlt. Abrufbar mit window.upstreemProfil(); ohne Aufruf kostet es einen Zeitstempel. */
  var _profil = {};
  window.upstreemProfil = function(){
    var out = Object.keys(_profil).map(function(k){
      var p = _profil[k];
      return { Name: k, "Summe ms": Math.round(p.ms), Aufrufe: p.n, "laengster ms": Math.round(p.max) };
    }).sort(function(a, b){ return b["Summe ms"] - a["Summe ms"]; });
    if (window.console && console.table) console.table(out);
    return out;
  };
  window.upstreemProfilReset = function(){ _profil = {}; return true; };
  function einmalProBild(fn, name){
    var raf = 0, t = 0;
    name = name || "(ohne Namen)";
    function lauf(){
      if (raf){ try { cancelAnimationFrame(raf); } catch(e){} raf = 0; }
      if (t){ clearTimeout(t); t = 0; }
      var t0 = (window.performance && performance.now) ? performance.now() : 0;
      try { fn(); }
      finally {
        if (t0){
          var d = performance.now() - t0;
          var p = _profil[name] || (_profil[name] = { n: 0, ms: 0, max: 0 });
          p.n++; p.ms += d; if (d > p.max) p.max = d;
        }
      }
    }
    return function(){
      if (raf || t) return;
      if (window.requestAnimationFrame) raf = requestAnimationFrame(lauf);
      t = setTimeout(lauf, 32);
    };
  }

  /* Ein Resize-Zuhoerer, der waehrend des Ziehens NICHT bei jedem Bild laeuft.
     rafThrottle ist die falsche Drossel dafuer: sie laesst genau ein Mal je BILD durch, also 60
     Mal in der Sekunde -- und wer darin misst und schreibt, erzwingt 60 Layouts. Fuer alles, was
     eine Klasse setzt oder eine Groesse nachzieht, reicht das Ende der Bewegung.
     Der Breiten-Waechter haelt zusaetzlich die Faelle heraus, in denen sich nur die Hoehe aendert
     (Adressleiste auf dem Telefon, aufgehende Tastatur): dort gibt es fuer eine Breitenlogik
     nichts zu tun. Wer auch auf Hoehe reagieren muss, gibt hoehe: true mit. */
  function aufResize(fn, cfg){
    cfg = cfg || {};
    var ms = cfg.ms || 150, uhr = null, letzteB = -1, letzteH = -1;
    window.addEventListener("resize", function(){
      var b = window.innerWidth, h = window.innerHeight;
      if (b === letzteB && (!cfg.hoehe || h === letzteH)) return;
      letzteB = b; letzteH = h;
      if (uhr) clearTimeout(uhr);
      uhr = setTimeout(function(){ uhr = null; try { fn(); } catch(e){ if (window.console) console.warn("[upstreem] aufResize:", e); } }, ms);
    }, { passive: true });
  }

  /* Ein ResizeObserver, der NICHT an jedem Bild ausloest. Fuer alles, was auf eine
     Groessenaenderung mit Messen und Schreiben antwortet: der rohe Beobachter feuert waehrend
     einer Ziehbewegung mit jedem Bild, und drei davon in einer Komponente (Tabelle, Rahmen,
     Legende) sind dann drei erzwungene Layouts je Bild.
     Die Breite kommt aus dem Eintrag, nicht aus einer eigenen Messung -- und bleibt sie gleich,
     passiert gar nichts. */
  function beobachteGroesse(el, fn, cfg){
    if (!el || typeof fn !== "function" || !window.ResizeObserver) return;
    cfg = cfg || {};
    var ms = cfg.ms || 120, uhr = null, letzte = -1;
    if (!_resGeplant) _resGeplant = einmalProBild(_resLauf, "onResize-Sammellauf");
    /* Der Rueckruf laeuft im GEMEINSAMEN Sammellauf und nicht in einem eigenen Timer. Sonst
       stehen drei Charts mit je einem eigenen setTimeout nebeneinander, jeder ohne Zeitbudget --
       in der Konsole des Nutzers meldete sich genau dieser Timer (core.js:5326) mit 72ms.
       In der Schlange gelten dieselben Regeln wie fuer onResize: erst alle messen, dann schreiben,
       und wer zu lange braucht, bekommt sein eigenes Bild.
       immer: true, weil hier auch Hoehenaenderungen zaehlen koennen -- die Breitenpruefung des
       Sammellaufs wuerde solche Eintraege sonst verschlucken. */
    var e = { root: el, fn: function(){ fn(letzte); }, lastW: -1, w: 0, q: 0, wRO: -1, avg: 0, immer: true };
    new ResizeObserver(function(eintraege){
      var b = -1;
      try {
        var r = eintraege && eintraege[0] && eintraege[0].contentRect;
        if (r && typeof r.width === "number") b = r.width;
      } catch (err){}
      if (b >= 0 && b === letzte && !cfg.hoehe) return;
      if (b >= 0) letzte = b;
      if (uhr) clearTimeout(uhr);
      uhr = setTimeout(function(){
        uhr = null;
        if (e.q) return;
        e.q = 1; _resSchlange.push(e);
        _resPlanen();
      }, ms);
    }).observe(el);
  }

  function rafThrottle(fn){
    var pending = null, lastArgs = null, lastThis = null;
    return function(){
      lastArgs = arguments; lastThis = this;
      if (pending) return;
      pending = requestAnimationFrame(function(){
        pending = null;
        fn.apply(lastThis, lastArgs);
      });
    };
  }

  /* Sticky header machinery: pins the toolbar + column header at data-sticky-top on wide screens,
     un-clips overflow:hidden ancestors (Bubble wrappers) so position:sticky isn't trapped, and
     keeps --up-thead-off in sync with the toolbar height. Returns applySticky (wire to resize) and
     syncTheadOffset (call after the header height can change). */

  /* ---------- flipReplace ----------
     Swap a container's innerHTML and slide every item that MOVED from its old position to its new
     one. This is what makes a chip list feel like the checkbox "grows in": the checkbox itself
     cannot transition (it is a brand-new node), but every chip after it shifts, and animating that
     shift is the motion people actually see. It existed only inside prompts-table's topic popover
     as inline code; the grouping popup in the same component needed the identical thing and got a
     hard innerHTML swap instead, which is why one felt smooth and the other snapped. */
  function flipReplace(el, html, sel, ms){
    if (!el) return;
    sel = sel || "[data-flip]";
    ms = ms || 200;
    var before = {};
    Array.prototype.forEach.call(el.querySelectorAll(sel), function(c){
      var k = c.getAttribute("data-flip") || c.getAttribute("data-topic") || c.getAttribute("data-gm-topic");
      if (k != null) before[k] = c.getBoundingClientRect();
    });
    el.innerHTML = html;
    Array.prototype.forEach.call(el.querySelectorAll(sel), function(c){
      var k = c.getAttribute("data-flip") || c.getAttribute("data-topic") || c.getAttribute("data-gm-topic");
      var b = k != null && before[k];
      if (!b) return;
      var a = c.getBoundingClientRect();
      var dx = b.left - a.left, dy = b.top - a.top;
      if (!dx && !dy) return;
      c.style.transition = "none";
      c.style.transform = "translate(" + dx + "px," + dy + "px)";
      void c.offsetWidth;
      c.style.transition = "transform " + ms + "ms cubic-bezier(.2,0,.38,.9)";
      c.style.transform = "";
      c.addEventListener("transitionend", function te(){ c.style.transition = ""; c.removeEventListener("transitionend", te); });
    });
  }

  function makeSticky(root, headEl){
    function syncTheadOffset(){ if (headEl) root.style.setProperty("--up-thead-off", headEl.offsetHeight + "px"); }
    function applySticky(){
      var pageW = window.innerWidth || document.documentElement.clientWidth || 0;
      var on = root.getAttribute("data-sticky") !== "no" && pageW >= 1000;
      var v = root.getAttribute("data-sticky-top"); if (v) root.style.setProperty("--up-sticky-top", /^[0-9]+$/.test(v) ? v + "px" : v);
      root.classList.toggle("up-sticky", on);
      /* Always unclip, regardless of "on" -- sticky positioning is the reason this call exists
         here, but topbar dropdowns (position:absolute, not sticky) need the same escape from a
         too-short Bubble wrapper whether or not sticky happens to be engaged (data-sticky="no",
         or pageW < 1000). Re-clipping the external ancestor when sticky turns off served no
         purpose (.up-box's own corner-rounding clip is separate and untouched by this) and was
         the actual cause of "few rows -> topbar dropdown gets cut off": a short component means
         a short Bubble wrapper, and re-clipping it left no room for a menu taller than the empty
         state. Mirrors topics-manager.js's own unconditional call for the same reason. */
      unclipAncestors(root, false);
      if (on) syncTheadOffset();
    }
    /* The intermittent "only the toolbar sticks, the column header scrolls away with the table"
       bug: every syncTheadOffset() call above only fires from explicit call sites (component
       init, resize, and each render()) — none of which fire again if the toolbar's real height
       changes for a reason that ISN'T one of those triggers. Two real ones: Geist (core.css's own
       @import, ...&display=swap) loads asynchronously and can swap in — changing glyph metrics —
       after the first measurement already ran; a brand logo <img> in the toolbar (data-brand-name)
       finishes loading and un-collapses its box on the same kind of delay. Either way
       --up-thead-off is left stuck at whatever the toolbar measured BEFORE it settled — .up-root's
       own 32px fallback (set once, before any JS runs) if that first measurement was early enough
       — and for a toolbar this tall, sticking that many px too high lands the thead UNDERNEATH the
       (correctly positioned) toolbar rather than below it: exactly "the heading isn't there, only
       the toolbar is" while scrolling. Switching tabs or reloading "fixes" it purely because
       whatever was still loading has finished by then, so THAT render's own remeasure happens to
       land on the right number — not because anything was actually fixed. A ResizeObserver on the
       toolbar itself re-measures the instant its real height changes for ANY reason, removing the
       race instead of relying on it resolving by coincidence on some later render. */
    if (headEl && window.ResizeObserver){
      var lastTheadOffH = null;
      new ResizeObserver(function(){
        if (!root.classList.contains("up-sticky")) return;
        var h = headEl.offsetHeight;
        if (h === lastTheadOffH) return;
        lastTheadOffH = h;
        syncTheadOffset();
      }).observe(headEl);
    }
    return { applySticky: applySticky, syncTheadOffset: syncTheadOffset };
  }

  /* Bubble re-injects a component's whole markup block (script tags included) whenever the
     reusable it lives in re-renders, so every component needs some way to notice "my root just
     reappeared in the DOM" and re-run its init. Each of the four components used to set this up
     independently: its own document.body MutationObserver (childList+subtree — i.e. "wake up on
     ANY DOM change anywhere on the page") plus its own setInterval(initAll, 1500) heartbeat. On a
     page that places two or more of these components that's 2-4 separate whole-page observers and
     timers all doing redundant work forever, and every one of them re-fires on totally unrelated
     DOM churn elsewhere on the page (another reusable's appear animation, a repeating group
     re-rendering, Mira's own UI) — exactly the kind of background tax that shows up as animations
     feeling slightly less smooth than a plain standalone HTML embed had.

     The shared registry/observer/interval live on WINDOW, not in this module's closure — because
     each component loads its own copy of core.js, so this IIFE runs once PER component (and again
     on every Bubble re-render of a component). Keeping the state module-scoped meant each core.js
     execution built its OWN whole-page observer + interval, quietly re-creating the exact 2-4
     redundant observers this consolidation exists to prevent. On window there is provably ONE
     observer + ONE interval + ONE watcher list for the whole page, no matter how many times
     core.js is evaluated.

     The observer's per-mutation work is also coalesced: any relevant DOM change schedules a SINGLE
     rAF-batched pass over the watchers instead of running each watcher's init synchronously inside
     every mutation callback — so a burst of mutations during a drawer/slide-in open (Bubble
     rendering a whole subtree at once) collapses to one cheap pass per frame. */
  function watchRoots(rootSelector, onRootsFound){
    var G = window.__upRootWatch;
    if (!G) G = window.__upRootWatch = { watchers: [], obs: null, iv: null, pending: false };
    for (var e = 0; e < G.watchers.length; e++){
      if (G.watchers[e].selector === rootSelector) return;   // already registered by some core.js execution
    }
    /* Der Stand beim Anmelden wird gleich mitgeschrieben: sonst sieht der erste Lauf des
       Auffangnetzes bei jeder Wurzel eine "Aenderung" gegen undefined und weckt einmal alle. */
    var da = document.getElementsByClassName(rootSelector);
    G.watchers.push({ selector: rootSelector, onFound: onRootsFound,
                      _n: da.length, _erste: da.length ? da[0] : null,
                      _letzte: da.length ? da[da.length - 1] : null });

    /* Frueher lief bei JEDER Aenderung im Dokument JEDE Komponente an: eine Zeile, die in der
       Sidebar aufklappt, liess Ask Mira, alle Tabellen und alle Charts ihr initAll fahren. Auf
       einer Seite mit 19 Komponenten sind das 19 Durchgaenge pro Bild -- genau die 120-180ms,
       die Chrome als "requestAnimationFrame handler took" und "Forced reflow" meldet.
       Jetzt merkt sich der Beobachter, WELCHE Wurzel aufgetaucht ist, und weckt nur die. */
    function runAll(){
      /* NICHT waehrend einer Ziehbewegung. onFound() sucht die Wurzel jeder Komponente und laesst
         sie sich neu einrichten -- in der Konsole des Nutzers stand genau dieser Handler mit 384ms
         und 305ms als laengste Aufgabe. Waehrend des Ziehens entstehen dauernd Knoten (Legenden,
         Tooltips, Chart-Flaechen), also lief er Bild um Bild. Eine Komponente, die in diesem
         Augenblick dazukommt, darf 250ms auf ihre Einrichtung warten; niemand kann sie in dieser
         Zeit bedienen. G.pending bleibt gesetzt, damit die Anmeldung nicht verlorengeht. */
      if (typeof zieht === "function" && zieht()){
        setTimeout(runAll, 250);
        return;
      }
      var heiss = G.hot; G.hot = null; G.pending = false;
      for (var k = 0; k < G.watchers.length; k++){
        var w = G.watchers[k];
        if (heiss && !heiss[w.selector]) continue;
        try { w.onFound(); } catch(e){}
      }
    }
    function scheduleAll(sel){
      if (sel){ (G.hot || (G.hot = {}))[sel] = true; }
      else G.hot = null;                       /* ohne Angabe: alle, wie bisher */
      if (G.pending) return;
      G.pending = true;
      if (window.requestAnimationFrame) window.requestAnimationFrame(runAll); else setTimeout(runAll, 16);
    }

    if (!G.obs && window.MutationObserver){
      G.obs = new MutationObserver(function(muts){
        for (var i = 0; i < muts.length; i++){
          var added = muts[i].addedNodes;
          for (var j = 0; j < added.length; j++){
            var n = added[j];
            if (n.nodeType !== 1) continue;
            for (var w = 0; w < G.watchers.length; w++){
              var sel = G.watchers[w].selector;
              /* Schon vorgemerkt? Dann kostet dieser Knoten fuer diese Wurzel nichts mehr -- das
                 querySelector darunter ist der teure Teil, und in einem Schwung (Bubble zeichnet
                 einen ganzen Teilbaum) faellt es damit nach dem ersten Treffer weg. */
              if (G.hot && G.hot[sel]) continue;
              if ((n.classList && n.classList.contains(sel)) ||
                  (n.querySelector && n.querySelector("." + sel))) scheduleAll(sel);
            }
          }
        }
      });
      G.obs.observe(document.body, { childList: true, subtree: true });
    }
    /* Das Auffangnetz fuer alles, was der Beobachter nicht sieht. Es lief bisher alle 1,5s ueber
       ALLE Komponenten -- dauerhaft, auch auf einer Seite, auf der sich nichts mehr ruehrt.
       Jetzt schaut es erst nach, ob sich fuer eine Wurzel ueberhaupt etwas geaendert hat: Anzahl,
       erstes und letztes Element. Ein Neuaufbau durch Bubble tauscht die Knoten aus, also faellt
       er hier auf, auch wenn die Anzahl gleich bleibt. Nur wer sich geaendert hat, laeuft an. */
    if (!G.iv){
      G.iv = setInterval(function(){
        var heiss = null;
        for (var k = 0; k < G.watchers.length; k++){
          var w = G.watchers[k];
          var els = document.getElementsByClassName(w.selector);
          var n = els.length, erste = n ? els[0] : null, letzte = n ? els[n - 1] : null;
          if (n !== w._n || erste !== w._erste || letzte !== w._letzte){
            w._n = n; w._erste = erste; w._letzte = letzte;
            (heiss || (heiss = {}))[w.selector] = true;
          }
        }
        /* NICHT synchron: runAll richtet Komponenten ein, und das dauert -- in der Konsole des
           Nutzers stand dieser Intervall-Rueckruf mit 58ms. Ueber scheduleAll landet die Arbeit
           im naechsten Bild und faellt damit auch unter die Pause waehrend einer Ziehbewegung. */
        if (heiss){
          for (var hk in heiss){ if (Object.prototype.hasOwnProperty.call(heiss, hk)) scheduleAll(hk); }
        }
      }, 1500);
    }
  }

  /* ==========================================================================================
     BEOBACHTER, DIE NIEMAND MEHR BRAUCHT
     ==========================================================================================
     Die Komponenten legen ihre ResizeObserver und MutationObserver beim Anlegen an und geben sie
     nie zurueck. Bei jedem Ansichtswechsel baut Bubble ihr Markup neu -- die alten Beobachter
     bleiben auf den abgehaengten Knoten sitzen und halten sie am Leben. Gemessen an EINER
     Komponente ueber fuenf Wechsel: 15 Groessen- und 9 Dokumentbeobachter angelegt, kein einziger
     abgeraeumt. Auf einer Seite mit 19 Komponenten waechst damit die Arbeit bei jeder DOM-Aenderung
     mit der Zahl der Wechsel -- genau die "Forced reflow"- und "requestAnimationFrame handler"-
     Meldungen, die nach jedem Wechsel mehr wurden.

     Das hier einzeln in 19 Dateien nachzutragen hiesse, es beim naechsten Beobachter wieder zu
     vergessen. Also einmal zentral: jeder Beobachter merkt sich, WAS er beobachtet, und wer nur
     noch auf abgehaengten Knoten sitzt, wird abgeraeumt. Erst beim zweiten Mal hintereinander --
     Bubble haengt einen Knoten auch mal kurz aus und wieder ein, und ein Beobachter, den wir dabei
     abschalten, waere ein stiller Ausfall.
     Der Umbau passiert genau einmal pro Seite (nicht pro core.js-Ausfuehrung) und laesst die
     Schnittstelle unveraendert: observe/unobserve/disconnect/takeRecords verhalten sich wie zuvor. */
  (function(){
    if (window.__upBeobachter) return;
    var reg = window.__upBeobachter = [];
    function umbauen(name){
      var Orig = window[name];
      if (!Orig || Orig.__upWrap) return;
      function Neu(cb){
        var o = new Orig(cb);
        var eintrag = { o: o, ziele: [], tot: 0, weg: false };
        var obs = o.observe.bind(o), dis = o.disconnect.bind(o);
        var unobs = o.unobserve ? o.unobserve.bind(o) : null;
        o.observe = function(ziel){
          if (ziel && eintrag.ziele.indexOf(ziel) < 0) eintrag.ziele.push(ziel);
          eintrag.tot = 0;
          return obs.apply(null, arguments);
        };
        if (unobs) o.unobserve = function(ziel){
          var i = eintrag.ziele.indexOf(ziel); if (i >= 0) eintrag.ziele.splice(i, 1);
          return unobs.apply(null, arguments);
        };
        o.disconnect = function(){ eintrag.ziele.length = 0; eintrag.weg = true; return dis(); };
        reg.push(eintrag);
        return o;
      }
      Neu.prototype = Orig.prototype;
      Neu.__upWrap = 1;
      try { window[name] = Neu; } catch(e){}
    }
    umbauen("ResizeObserver");
    umbauen("MutationObserver");

    setInterval(function(){
      var rest = [];
      for (var i = 0; i < reg.length; i++){
        var e = reg[i];
        if (e.weg) continue;
        if (!e.ziele.length){ rest.push(e); continue; }      /* angelegt, aber noch nichts im Blick */
        var lebt = false;
        for (var k = 0; k < e.ziele.length; k++){
          var t = e.ziele[k];
          /* document und documentElement tragen kein isConnected im ueblichen Sinn -- sie sind
             per Definition da und duerfen nie abgeraeumt werden. */
          if (!t || t === document || t === document.documentElement || t.isConnected){ lebt = true; break; }
        }
        if (lebt){ e.tot = 0; rest.push(e); continue; }
        if (++e.tot < 2){ rest.push(e); continue; }
        try { e.o.disconnect(); } catch(err){}
      }
      window.__upBeobachter = reg = rest;
    }, 5000);
  })();

  /* ==========================================================================================
     CHART KITS
     ==========================================================================================
     Every chart in this library is one of exactly three shapes: a multi-series line chart, a
     doughnut, or a horizontal bar list. Before these kits existed, each shape was copy-pasted
     into every component that needed it — visibility-chart and citations-combo-chart carried two
     near-identical ~376-line line charts, topcitations-dashboard and citations-combo-chart two
     near-identical ~200-line doughnut/bar charts. That duplication is what let the same bug get
     fixed in one component and stay broken in another (the multi-instance tooltip bug, the
     theme-sticky doughnut tooltip, the missing highlight easing — all found the hard way).

     What lives HERE: everything that is presentation or interaction — Chart.js plugins, the
     external tooltips, skeletons, the container-size poll, the render-verify retry, the legend
     layout algorithm, animation curves, the watermark.
     What stays in the COMPONENT: only the data mapping — turning a Bubble payload into
     {labels, datasets} or into [{name, share, color}]. That genuinely differs per component
     (visibility-chart keys on company_id with a fixed palette, citations-combo-chart keys on
     domain/url with a generated shade ramp), so it is passed in, not guessed at here. */

  /* Loads Chart.js once per PAGE, shared across every upstreem component. Loading it twice
     breaks existing chart instances (each load replaces window.Chart with a fresh registry), so
     if another component already injected it we wait for that copy instead of adding a second. */
  function loadChartJs(){
    if (window.Chart) return Promise.resolve();
    if (window.__upstreemChartJs) return window.__upstreemChartJs;
    window.__upstreemChartJs = new Promise(function(res, rej){
      var existing = document.querySelector('script[data-upstreem-chartjs], script[data-ccchart], script[src*="chart.umd"], script[src*="chart.js@"], script[src*="chart.local"]');
      if (existing){
        var iv = setInterval(function(){ if (window.Chart){ clearInterval(iv); res(); } }, 40);
        setTimeout(function(){ clearInterval(iv); if (window.Chart) res(); else rej(new Error("chartjs timeout")); }, 10000);
        return;
      }
      var s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js";
      s.setAttribute("data-upstreem-chartjs", "1");
      s.onload = function(){ res(); };
      s.onerror = rej;
      document.head.appendChild(s);
    });
    return window.__upstreemChartJs;
  }

  /* ---------- chart colour system ----------
     Citation types have a genuine dark accent, not the same hex reused on both themes. This was
     previously local to topcitations-dashboard, which meant citations-combo-chart rendered
     light-mode citation hexes in dark mode. Shared now so that cannot drift again.
     CHART_OTHER_* are deliberately NOT the same values as OTHER_LIGHT/OTHER_DARK above:
     the chart palette's neutral is #a0a0a0, the chip palette's is #a8abb2. Same idea, different
     tuning; keeping both avoids silently shifting a colour nobody asked to change. */
  var CITE_COLOR_DARK = {
    "Editorial":"#5cd7c8", "UGC / Community":"#62b4da", "Knowledge-Base":"#8082db",
    "Brand Platforms":"#c377cf", "Institutional":"#7693bb", "Competition":"#de8c54", "You":"#d76f82"
  };
  var URL_LABEL = {
    homepage:"Homepage", product_service:"Product / Service", marketplace:"Marketplace", company_info:"Company Info",
    article:"Article", listicle:"Listicle", guide:"Guide", comparison:"Comparison", review:"Review",
    documentation:"Documentation", forum:"Forum", directory:"Directory", video:"Video", social_post:"Social Post", other:"Uncategorized"
  };
  /* bright chart-fill palette, tuned for large area fills — deliberately separate from URL_TYPE
     above, which is tuned for small text-on-tint chips. */
  var URL_COLOR_CHART = {
    homepage:"#c3753a", product_service:"#ce8662", marketplace:"#ae7c58", company_info:"#b48139",
    article:"#369379", listicle:"#3e90a6", guide:"#5182ef", comparison:"#726bea", review:"#8a53e1",
    documentation:"#8a53e1", forum:"#a95cee", directory:"#b549bf", video:"#9661f1", social_post:"#a27df8", other:"#8c8f96"
  };
  var URL_COLOR_DARK = {
    homepage:"#fbbf24", product_service:"#fdba74", marketplace:"#fcae6f", company_info:"#facc15",
    article:"#6ee7b7", listicle:"#67e8f9", guide:"#93c5fd", comparison:"#a5b4fc", review:"#c4b5fd",
    documentation:"#c4b5fd", forum:"#d8b4fe", directory:"#f0abfc", video:"#c4b5fd", social_post:"#ddd6fe", other:"#a0a0a0"
  };
  var CHART_OTHER_LIGHT = "#8c8f96", CHART_OTHER_DARK = "#a0a0a0";
  var MAX_URL_SLICES = 8;

  /* Slice/line colour for a raw type key. mode: "url" | anything else (= citation type). */
  function typeColor(raw, mode, isDark){
    if (mode === "url"){
      var map = isDark ? URL_COLOR_DARK : URL_COLOR_CHART;
      return map[String(raw || "").trim()] || (isDark ? CHART_OTHER_DARK : CHART_OTHER_LIGHT);
    }
    var name = citeName(raw);
    return isDark ? (CITE_COLOR_DARK[name] || CHART_OTHER_DARK) : (CITE_COLOR[name] || CHART_OTHER_LIGHT);
  }
  /* ---- Dominierende Farbe eines Favicons -------------------------------------------------------
     Warum ein Proxy dazwischen steht, und zwar gemessen und nicht vermutet: eine Leinwand, auf die
     ein fremdes Bild gezeichnet wurde, ist "getaint", und getImageData wirft SecurityError, solange
     der Host kein Access-Control-Allow-Origin sendet. Mit crossOrigin="anonymous" laedt das Bild
     dann gar nicht erst. Das trifft auch Color Thief -- dessen Median-Cut liest dieselben Pixel.
       google.com/s2/favicons (die Quelle dieser App), youtube.com, adac.de, reddit.com  -> nein
       wikipedia.org, github.githubassets.com                                            -> ja
     Zwei von sieben. wsrv.nl holt dieselbe Google-URL und liefert sie MIT dem Header; damit sind es
     alle. Gemessen: youtube #ff0a39, adac #deb300, spiegel #e8552b, lee-up.de #4ed3e9.

     Und warum nicht Color Thief selbst: sein Median-Cut liefert den HAEUFIGSTEN Ton, und der ist
     bei einem Favicon fast immer der Hintergrund -- bei YouTube also Weiss. Gesucht ist die
     dominierende FARBE. Deshalb 24 Eimer im Farbkreis, jedes Pixel mit seiner Saettigung im
     Quadrat gewichtet, und Grau/Weiss/Schwarz zaehlen nicht mit. Ein grosses blasses Feld kann
     einen kleinen satten Fleck damit nicht ueberstimmen. */
  var FAV_PROXY = "https://wsrv.nl/?url=";
  var favCache = {};      /* host -> hex | null (fertig) */
  var favWarten = {};     /* host -> [cb] (laeuft noch) */
  /* Die Registrierungsebene reicht als Schluessel: www.shop.example.de und example.de tragen
     dasselbe Favicon. Zwei Ebenen genuegen nicht (co.uk waere der Treffer), daher die kurze Liste. */
  var MEHRTEILIGE_TLD = { "co.uk":1, "com.au":1, "co.jp":1, "com.br":1, "co.nz":1, "com.tr":1 };
  function favHost(s){
    var t = String(s == null ? "" : s).trim();
    if (!t) return "";
    if (t.indexOf("//") >= 0) { try { t = new URL(t).hostname; } catch (e) { t = t.split("/")[0]; } }
    else t = t.split("/")[0];
    t = t.replace(/^www\./i, "").toLowerCase().split(":")[0];
    var p = t.split(".");
    if (p.length <= 2) return t;
    var zwei = p.slice(-2).join(".");
    return MEHRTEILIGE_TLD[zwei] ? p.slice(-3).join(".") : zwei;
  }
  function favUrl(host){
    return FAV_PROXY + encodeURIComponent("www.google.com/s2/favicons?domain=" + host + "%26sz=128") +
           "&w=64&h=64&output=png";
  }
  function rgb2hsl(r, g, b){
    r /= 255; g /= 255; b /= 255;
    var mx = Math.max(r,g,b), mn = Math.min(r,g,b), h = 0, s = 0, l = (mx+mn)/2, d = mx-mn;
    if (d){ s = l > 0.5 ? d/(2-mx-mn) : d/(mx+mn);
      h = mx === r ? ((g-b)/d + (g<b?6:0)) : mx === g ? ((b-r)/d + 2) : ((r-g)/d + 4); h /= 6; }
    return [h, s, l];
  }
  function hex2(n){ n = Math.max(0, Math.min(255, Math.round(n))); var s = n.toString(16); return s.length < 2 ? "0"+s : s; }
  function dominantVon(img){
    var c = document.createElement("canvas"); c.width = 64; c.height = 64;
    var ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, 64, 64);
    var d;
    try { d = ctx.getImageData(0, 0, 64, 64).data; } catch (e) { return null; }
    var eimer = {};
    for (var i = 0; i < d.length; i += 4){
      if (d[i+3] < 128) continue;                       /* zu durchsichtig */
      var hsl = rgb2hsl(d[i], d[i+1], d[i+2]);
      if (hsl[1] < 0.18) continue;                      /* grau, weiss, schwarz */
      if (hsl[2] < 0.10 || hsl[2] > 0.94) continue;
      var k = Math.floor(hsl[0] * 24) % 24;
      var w = hsl[1] * hsl[1];
      var e = eimer[k] = eimer[k] || { w:0, r:0, g:0, b:0 };
      e.w += w; e.r += d[i]*w; e.g += d[i+1]*w; e.b += d[i+2]*w;
    }
    var best = null;
    Object.keys(eimer).forEach(function(k){ if (!best || eimer[k].w > best.w) best = eimer[k]; });
    if (!best) return null;                             /* rein monochrom, z.B. x.com */
    return "#" + hex2(best.r/best.w) + hex2(best.g/best.w) + hex2(best.b/best.w);
  }
  /* Aus dem Zwischenspeicher, ohne Netz. undefined heisst "noch nie gefragt", null heisst "gefragt
     und es gibt keine". Der Unterschied zaehlt: sonst wird jedes Mal neu geladen. */
  function faviconColorCached(domainOderUrl){
    var h = favHost(domainOderUrl);
    return h ? favCache[h] : null;
  }
  /* Dieselbe Ermittlung fuer ein BELIEBIGES Bild statt fuer ein Favicon: der Company Editor braucht
     die Hausfarbe aus dem Logo der Marke, und das ist eine Adresse und keine Domain.
     Gerechnet wird mit demselben dominantVon() -- also derselbe Mechanismus, dieselben Schwellen,
     dieselben Ergebnisse wie bei den Domains im Citations-Chart. Neu ist nur, WOHER das Bild kommt.

     UEBER DENSELBEN PROXY, und das ist nicht Bequemlichkeit: getImageData wirft SecurityError,
     sobald ein fremdes Bild ohne CORS-Kopf auf der Leinwand liegt. wsrv.nl liefert den Kopf mit,
     verkleinert auf 64x64 und wandelt nach PNG -- ohne ihn waere die Farbe bei den meisten
     Logo-Adressen gar nicht zu lesen.

     Eigener Zwischenspeicher, mit der ADRESSE als Schluessel (nicht mit dem Host wie beim
     Favicon): zwei Marken koennen Logos auf demselben Host haben. */
  var bildCache = {}, bildWarten = {};
  function bildFarbe(url, cb){
    var u = String(url == null ? "" : url).trim();
    if (!u){ if (cb) cb(null); return; }
    if (bildCache.hasOwnProperty(u)){ if (cb) cb(bildCache[u]); return; }
    if (bildWarten[u]){ if (cb) bildWarten[u].push(cb); return; }
    bildWarten[u] = cb ? [cb] : [];
    function fertig(hex){
      bildCache[u] = hex || null;
      var liste = bildWarten[u] || []; delete bildWarten[u];
      liste.forEach(function(f){ try { f(bildCache[u]); } catch (e) {} });
    }
    var img = new Image();
    img.crossOrigin = "anonymous";
    var erledigt = false;
    img.onload = function(){ if (erledigt) return; erledigt = true; fertig(dominantVon(img)); };
    img.onerror = function(){ if (erledigt) return; erledigt = true; fertig(null); };
    setTimeout(function(){ if (!erledigt){ erledigt = true; fertig(null); } }, 8000);
    /* Das Protokoll muss weg, bevor es in den Proxy geht -- wsrv.nl erwartet die Adresse ohne
       "https://". Eine Adresse ohne Protokoll laeuft unveraendert durch. */
    img.src = FAV_PROXY + encodeURIComponent(u.replace(/^https?:\/\//i, "")) +
              "&w=64&h=64&output=png";
  }
  function faviconColor(domainOderUrl, cb){
    var h = favHost(domainOderUrl);
    if (!h){ if (cb) cb(null); return; }
    if (favCache.hasOwnProperty(h)){ if (cb) cb(favCache[h]); return; }
    if (favWarten[h]){ if (cb) favWarten[h].push(cb); return; }
    favWarten[h] = cb ? [cb] : [];
    function fertig(hex){
      favCache[h] = hex || null;
      var liste = favWarten[h] || []; delete favWarten[h];
      liste.forEach(function(f){ try { f(favCache[h]); } catch (e) {} });
    }
    var img = new Image();
    img.crossOrigin = "anonymous";
    var erledigt = false;
    img.onload = function(){ if (erledigt) return; erledigt = true; fertig(dominantVon(img)); };
    img.onerror = function(){ if (erledigt) return; erledigt = true; fertig(null); };
    /* Ohne Frist bleibt ein Aufrufer, der auf alle wartet, bei einem haengenden Bild fuer immer
       stehen. Acht Sekunden, danach gilt: keine Farbe. */
    setTimeout(function(){ if (!erledigt){ erledigt = true; fertig(null); } }, 8000);
    img.src = favUrl(h);
  }
  /* Eine Farbe, die im jeweiligen Thema unsichtbar waere, wird angehoben oder abgesenkt -- nicht
     ersetzt. Fastschwarz (github #24292f) verschwindet auf #1b1b1b, und im Hellen gilt dasselbe
     fuer sehr helle Marken (ADAC-Gelb auf Weiss). Gemischt gegen Weiss bzw. Schwarz in Schritten,
     bis die relative Helligkeit im lesbaren Bereich liegt; die Farbe bleibt Farbe. */
  function relLum(rgb){
    function lin(v){ v /= 255; return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); }
    return 0.2126*lin(rgb[0]) + 0.7152*lin(rgb[1]) + 0.0722*lin(rgb[2]);
  }
  function mischen(rgb, ziel, anteil){
    return "#" + hex2(rgb[0] + (ziel-rgb[0])*anteil) + hex2(rgb[1] + (ziel-rgb[1])*anteil) +
                 hex2(rgb[2] + (ziel-rgb[2])*anteil);
  }
  function readableHex(hex, isDark){
    var rgb = hexToRgb(hex);
    if (!rgb) return hex;
    var L = relLum(rgb), i = 0;
    /* 0.06 und 0.62: die Grenzen, ab denen eine Linie gegen #1b1b1b bzw. #ffffff verschwindet. */
    while (isDark && L < 0.06 && i++ < 5){ hex = mischen(hexToRgb(hex), 255, 0.12*i); L = relLum(hexToRgb(hex)); }
    i = 0;
    while (!isDark && L > 0.62 && i++ < 5){ hex = mischen(hexToRgb(hex), 0, 0.12*i); L = relLum(hexToRgb(hex)); }
    return hex;
  }

  function capitalize(s){ s = String(s || ""); return s.charAt(0).toUpperCase() + s.slice(1); }
  /* Share formatter with the <1% case fmtTotal doesn't have. */
  /* THE percent formatter for this app — every share/visibility figure goes through it.
     The rule: a value that is genuinely above zero but ROUNDS to zero must never print "0%",
     because "0%" and "not mentioned at all" are different facts and the reader cannot tell them
     apart. It prints "<1%" instead. Threshold is Math.round(v) === 0, i.e. below 0.5 — 0.7 still
     rounds to 1 and prints "1%". (Was `v < 1`, which wrongly swallowed 0.5-0.99 into "<1%".)
     Axis TICKS are the one exception and stay plain: a tick labelled 0 is a scale position, not
     a measurement. */
  /* nachkomma ist OPTIONAL und standardmaessig 0 -- so bleibt jeder bestehende Aufrufer, wie er
     ist. Wer eine Stelle braucht (Visibility in der Brands-Tabelle und im Landscape-Tooltip),
     gibt sie mit. Die "<1%"-Regel gilt nur ohne Nachkommastellen: mit einer Stelle steht dort
     ohnehin 0.4% statt einer irreleitenden 0. */
  /* Prozentwerte: die Genauigkeit entscheidet der Aufrufer (CLAUDE.md 2b), das TRENNZEICHEN der
     Nutzer. Ohne Nachkommastellen gibt es nichts zu trennen -- dann bleibt es bei Math.round. */
  function fmtPct(v, nachkomma){
    v = Number(v) || 0;
    var n = nachkomma > 0 ? nachkomma : 0;
    if (!n){
      if (v > 0 && Math.round(v) === 0) return "<1%";
      return fmtNum(Math.round(v), 0) + "%";
    }
    return fmtNum(v, n) + "%";
  }

  /* Turns a raw [{type, share_pct}] breakdown into the [{name, share, color}] the doughnut/bar
     renderers take. In url mode the tail past MAX_URL_SLICES is folded into one "Other" slice. */
  function prepTypeData(mode, rows, isDark){
    rows = Array.isArray(rows) ? rows : [];
    var items = rows
      .filter(function(r){ return r && (r.type != null) && isFinite(Number(r.share_pct)); })
      .map(function(r){ return { key: String(r.type).trim(), share: Math.max(0, Number(r.share_pct)) }; });
    if (mode === "url"){
      items.sort(function(a, b){ return b.share - a.share; });
      if (items.length > MAX_URL_SLICES){
        var head = items.slice(0, MAX_URL_SLICES);
        var otherShare = items.slice(MAX_URL_SLICES).reduce(function(a, b){ return a + b.share; }, 0);
        head.push({ key: "other", share: otherShare, _other: true });
        items = head;
      }
      return items.map(function(it){
        return {
          key: it.key,
          name: it._other ? "Other" : (URL_LABEL[it.key] || capitalize(String(it.key).replace(/_/g, " "))),
          share: it.share,
          color: it._other ? (isDark ? CHART_OTHER_DARK : CHART_OTHER_LIGHT) : typeColor(it.key, "url", isDark)
        };
      });
    }
    return items.map(function(it){
      return { key: it.key, name: citeName(it.key), share: it.share, color: typeColor(it.key, "citation", isDark) };
    });
  }
  /* Grey out every slice/bar whose key isn't in `sel` — the shared half of "click a type chart
     segment to filter by it" (topcitations-dashboard's filter-menu checkboxes AND its chart-click
     shortcut both funnel through this). `__dimmed`/`__realColor` ride along on every greyed item
     so a hover state (makeTypeChart) or a tooltip (makeDonutTooltip) can tell "this is currently
     filtered out" from "this is its real, always-was-grey color" and react differently — a
     tooltip name and a hover state both still need the REAL colour even while the paint itself
     is dimmed. */
  function applyTypeDim(prepped, sel, isDark){
    var selectedKeys = Object.keys(sel || {}).filter(function(k){ return sel[k]; });
    if (!selectedKeys.length) return prepped;
    var selSet = {};
    selectedKeys.forEach(function(k){ selSet[k] = true; });
    var grey = isDark ? "#3a3a3a" : "#e0e2e6";
    return prepped.map(function(it){
      return (it.key != null && selSet[it.key]) ? it : { key: it.key, name: it.name, share: it.share, color: grey, __dimmed: true, __realColor: it.color };
    });
  }

  /* Would white label text be hard to read on this fill? WCAG relative luminance, so it judges by
     hue too (a light yellow reads bright, a light blue less so). Threshold sits high on purpose:
     only genuinely light bars flip to dark text, mid-tone citation fills keep white. */
  function barIsLight(col){
    if (typeof col !== "string") return false;
    var c = col.charAt(0) === "#" ? col.slice(1) : col;
    if (c.length === 3) c = c.charAt(0)+c.charAt(0)+c.charAt(1)+c.charAt(1)+c.charAt(2)+c.charAt(2);
    if (!/^[0-9a-fA-F]{6}$/.test(c)) return false;
    function lin(v){ v /= 255; return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); }
    var L = 0.2126*lin(parseInt(c.substr(0,2),16)) + 0.7152*lin(parseInt(c.substr(2,2),16)) + 0.0722*lin(parseInt(c.substr(4,2),16));
    /* 0.4 statt 0.55. Die Schwelle entscheidet zwischen weisser und dunkler Beschriftung, und bei
       0.55 bekamen Pastelltoene weissen Text: #8AB4F8 (Googles Dunkelmodus-Blau, L=0.45) traegt
       Weiss mit Kontrast 2.1 -- unlesbar --, dunkler Text darauf schafft 7.9. Gemeldet am Model
       Breakdown, betroffen waren auch die hellen Dunkel-Paletten der URL-Typen (#93c5fd, #a5b4fc,
       #c4b5fd u.a.), also stand in den Balken-Charts im Dunkeln teils Weiss auf Pastell.
       0.4 laesst die satten Farben unangetastet (die App-Paletten liegen um 0.30) und kippt genau
       die Pastellfaelle auf dunklen Text. */
    return L > 0.4;
  }
  /* Intrinsic text width via an off-DOM probe. Deliberately NOT getBoundingClientRect(): the bar
     labels are measured while still opacity:0 inside a 0%-wide flex fill, so their box width is
     the clipped width, not the width the text actually needs. */
  function measureText(el){
    if (!el) return 0;
    var cs = window.getComputedStyle(el);
    var probe = document.createElement("span");
    probe.textContent = el.textContent;
    probe.style.cssText = "position:absolute;left:-9999px;top:-9999px;white-space:nowrap;visibility:hidden;" +
      "font-family:" + cs.fontFamily + ";font-size:" + cs.fontSize + ";font-weight:" + cs.fontWeight + ";letter-spacing:" + cs.letterSpacing + ";";
    document.body.appendChild(probe);
    var w = probe.offsetWidth;
    document.body.removeChild(probe);
    return w;
  }
  function truncate(s, n){ s = String(s == null ? "" : s); return s.length > n ? s.slice(0, n-1) + "…" : s; }
  var MONTHS_LONG = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  /* Bringt alles, was als Tagesangabe hereinkommt, auf YYYY-MM-DD. Der RPC liefert ISO, aber ein
     Bubble-Ausdruck kann ein formatiertes Datum schicken ("Aug 8, 2026 12:00 am"). Vorher gab
     chartDateFmt so einen String ROH zurueck -- dann stand in einer Achse ein Datum mit Uhrzeit,
     waehrend alle anderen Charts "8 Aug 2026" zeigten. Der Date-Rueckfall greift nur dort, wo
     vorher der rohe String stand; ein bereits gueltiges ISO-Datum laeuft unveraendert durch. */
  function dayKey(day){
    var t = String(day == null ? "" : day).trim();
    if (!t) return "";
    var m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return m[1] + "-" + m[2] + "-" + m[3];
    var d = new Date(t);
    if (isNaN(d.getTime())) return t;
    function zwei(n){ return (n < 10 ? "0" : "") + n; }
    return d.getFullYear() + "-" + zwei(d.getMonth() + 1) + "-" + zwei(d.getDate());
  }

  /* Die Achsen- und Tooltipbeschriftung der Charts folgt demselben Format wie die Tabellen -- sonst
     steht auf einer Seite zweimal dasselbe Datum verschieden. Die Achse laesst dabei die fuehrende
     Null weg (Platz), das Muster bestimmt aber der Nutzer. */
  function chartDateFmt(day){
    var m = dayKey(day).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return String(day || "");
    var p = { t: parseInt(m[3],10), tt: m[3], m: parseInt(m[2],10)-1, mm: m[2],
              j: m[1], mon: MONTHS[parseInt(m[2],10)-1] };
    var muster = getPref("date");
    /* Die Vorgabe der Achse bleibt "12 Dec 2025" OHNE Punkt hinter dem Tag -- so stand es hier
       schon, und in einer Achse zaehlt jeder Buchstabe. Die anderen drei Muster sind dieselben
       wie in fmtDate. */
    if (muster === "d-mon-y") return p.t + " " + p.mon + " " + p.j;
    return fmtDateMuster(p, muster);
  }
  /* Tooltip header date. At month granularity a full "1 Jul 2026" reads wrong for what is really
     a whole-month bucket, so it collapses to just the month name. */
  function chartDateTitle(day, gran){
    var m = dayKey(day).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return String(day || "");
    if (gran === "month") return MONTHS_LONG[parseInt(m[2],10)-1] || chartDateFmt(day);
    return chartDateFmt(day);
  }
  function getPageWidth(){
    try { if (window.top && window.top.innerWidth) return window.top.innerWidth; } catch(e){}
    return window.innerWidth || document.documentElement.clientWidth || 0;
  }

  /* ---------- watermark ----------
     Injected by the line kit into its own wrap. Used to be a separate per-component script file
     with its own whole-page MutationObserver + 300ms interval hunting for wraps by class; the kit
     owns its wrap element directly, so none of that scanning is needed. Idempotent. */
  /* Das Zeichen selbst liegt jetzt als Datei auf Supabase, je Thema eine (1f1f1f / e0e0e0), und
     wird in core.css als background-image gesetzt -- Groesse, Lage, Deckkraft und der
     Themenwechsel stehen dort. Hier bleibt nur das leere Div.
     Warum nicht mehr inline: die beiden Pfade waren eine Kopie der Wortmarke im Quelltext. Wer die
     Marke aendert, aendert eine Datei und nicht zwei SVG-Pfade in einer JS-Variable. Und der
     Themenwechsel kostet so keine Zeile JS: die Datei haengt an .up-root[data-theme="dark"],
     also wechselt sie mit, wenn setUpstreemTheme das Attribut umstellt. Vorher lief hier eine
     Helligkeitsrechnung ueber die Vorfahren, um zwischen Schwarz und Weiss zu waehlen -- ein
     Umweg, der ohnehin nur das Thema nachbaute. */
  function injectWatermark(wrap){
    if (!wrap || wrap.querySelector(".upstreem-watermark")) return;
    try { if (getComputedStyle(wrap).position === "static") wrap.style.position = "relative"; } catch(e){}
    var wm = document.createElement("div");
    wm.className = "upstreem-watermark";
    wrap.appendChild(wm);
  }

  /* ---------- line chart ---------- */
  /* LINE_POINT_BORDER gibt es nicht mehr: der Rand eines Punktes ist jetzt genau so stark wie die
     Linie, an der er haengt (siehe build()) -- eine feste 1.4 stand neben einer 2.125 dicken Linie
     und sah aus wie ein anderer Strich. */
  var LINE_TENSION = 0.3, LINE_POINT_HOVER = 4, LINE_POINT_HIT = 6;
  var X_MAX_TICKS = 7, Y_PAD = 1.15;
  /* Welche x-Beschriftungen stehen? Entschieden aus der ANZAHL der Werte und nicht aus der Breite
     -- siehe die Begruendung an ticks.autoSkip in makeLine.
     Erste und letzte immer, dazwischen gleichmaessig verteilt. Die Rundung kann zwei Indizes auf
     denselben Platz legen; das ist harmlos, es stehen dann eben weniger als X_MAX_TICKS. */
  var _xTickCache = { n: -1, set: null };
  function xTickZeigen(i, n){
    if (!n || n <= X_MAX_TICKS) return true;
    if (_xTickCache.n !== n){
      var set = {}, k = X_MAX_TICKS - 1;
      for (var j = 0; j <= k; j++) set[Math.round(j * (n - 1) / k)] = 1;
      _xTickCache = { n: n, set: set };
    }
    return !!_xTickCache.set[i];
  }
  /* Line width is a page-wide preference, not per-component/per-instance — one localStorage key
     read by every makeLine() chart, changeable from any of their own Chart Settings dropdowns.
     "thick" is the default (explicit user request) — the stored key only ever needs to hold "thin"
     as an opt-out, so an unset/unreadable key falls through to "thick" here. "thick" itself was the
     midpoint between thin (1.5px, the original) and the first version's 2.75px — 2.75 read as too
     heavy in practice.
     Am 27.08. waren beide um 15 Prozent zurueckgenommen (1.5 -> 1.275, 2.125 -> 1.80625) und sind
     am 29.08. wieder auf ihren alten Werten: die Linien wirkten zu duenn. Beide Stufen zusammen,
     nie nur die Vorgabe -- sonst waere "thin" dicker als vorher "thick" gewirkt hat, und das
     Verhaeltnis der zwei Stufen zueinander ist die eigentliche Aussage der Einstellung.
     Der Rand der Hoverpunkte zieht von selbst mit: er IST diese Breite (siehe build()). */
  var LINE_WIDTH_VALUES = { thin: 1.5, thick: 2.125 };
  var LINE_WIDTH_KEY = "up_line_width_pref";
  function getLineWidthPref(){
    try { return window.localStorage.getItem(LINE_WIDTH_KEY) === "thin" ? "thin" : "thick"; }
    catch(e){ return "thick"; }
  }
  function setLineWidthPref(v){
    v = v === "thick" ? "thick" : "thin";
    try { window.localStorage.setItem(LINE_WIDTH_KEY, v); } catch(e){}
    /* Every currently-mounted makeLine() chart on the page — including ones belonging to OTHER
       component instances — listens for this and redraws immediately with its last-built data,
       so changing it from one chart's settings menu is felt everywhere without a page reload. */
    try { window.dispatchEvent(new CustomEvent("up-linewidth-change", { detail: { value: v } })); } catch(e){}
  }
  /* Legende unter dem Chart: an oder aus, seitenweit, nach demselben Muster wie die Linienstaerke
     darueber -- ein Schluessel in der Ablage, den jedes makeLine() liest, umschaltbar aus jedem
     Chart-Settings-Menue. Die Vorgabe ist AN, in der Ablage steht deshalb nur das Abwaehlen: ein
     fehlender oder unlesbarer Schluessel faellt hier auf "an" zurueck. */
  var LEGEND_KEY = "up_legend_pref";
  function getLegendPref(){
    try { return window.localStorage.getItem(LEGEND_KEY) === "off" ? "off" : "on"; }
    catch(e){ return "on"; }
  }
  function setLegendPref(v){
    v = v === "off" ? "off" : "on";
    try { window.localStorage.setItem(LEGEND_KEY, v); } catch(e){}
    try { window.dispatchEvent(new CustomEvent("up-legend-change", { detail: { value: v } })); } catch(e){}
  }

  /* Colour scale — page-wide, exactly like the line width above and for the same reason: the
     Chart Settings menu is one setting the user thinks of as "how MY charts look", not as a
     property of the one chart whose gear they happened to click. It used to be per instanceId in
     localStorage, so visibility-chart and brands-overview on the same page could sit there in two
     different palettes. Same broadcast shape, so any chart mounted anywhere repaints at once. */
  var COLOR_SCALE_KEY = "up_color_scale_pref";
  function getColorScalePref(){
    try {
      var v = window.localStorage.getItem(COLOR_SCALE_KEY);
      return (SCALE_ORDER.indexOf(v) > -1) ? v : SCALE_VORGABE;
    } catch(e){ return SCALE_VORGABE; }
  }
  function setColorScalePref(v){
    if (SCALE_ORDER.indexOf(v) < 0) v = SCALE_VORGABE;
    try { window.localStorage.setItem(COLOR_SCALE_KEY, v); } catch(e){}
    try { window.dispatchEvent(new CustomEvent("up-colorscale-change", { detail: { value: v } })); } catch(e){}
  }
  var LW_THIN_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M5 12h14"/></svg>';
  var LW_THICK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"><path d="M5 12h14"/></svg>';
  /* Same visual family as UC.makeColumns's row-height switch (.up-pop-div/.up-pop-sub/.up-dense/
     .up-dense-btn) — a settings dropdown that already has ITS OWN row-height 2-way switch and one
     that has a Line Width switch should look like the same kind of control, not two different
     idioms for "pick one of two". Every line-chart component's settings menu gets this same
     section appended; only visibility-chart's menu additionally offers Colors above it. */
  /* Nur der Schalter, ohne Trennlinie und Ueberschrift: das Einstellungsfenster setzt ihn in seine
     eigene Zeile (die hat den Titel schon links), das Zahnradmenue eines Charts in seinen
     Abschnitt darunter. EIN Markup fuer beide -- ein zweites waere ein zweites Aussehen. */
  function lineWidthSwitchHtml(){
    var pref = getLineWidthPref();
    return '<div class="up-dense">' +
        '<button class="up-dense-btn' + (pref === "thin" ? " is-active" : "") + '" type="button" data-linewidth="thin">' + LW_THIN_SVG + 'Thin</button>' +
        '<button class="up-dense-btn' + (pref === "thick" ? " is-active" : "") + '" type="button" data-linewidth="thick">' + LW_THICK_SVG + 'Thick</button>' +
      '</div>';
  }
  function lineWidthSectionHtml(){
    return '<div class="up-pop-div"></div>' +
      '<div class="up-pop-sub">Line Width</div>' +
      lineWidthSwitchHtml();
  }
  /* Die Farbschema-Zeilen des Chart-Zahnrads, damit das Einstellungsfenster GENAU dieselbe Auswahl
     zeigen kann -- gleiche Reihenfolge, gleiche Punkte, gleicher Haken.
     defs sind die Farben, die "Default" gerade wirklich malt. Im Chart weiss das nur der Chart
     selbst (er leitet sie aus buildLineDatasets ab); wo es keinen gibt, ist LINE_PALETTE die
     ehrliche Antwort, denn genau daraus fuellt Default die Luecken. */
  function colorScaleOptionsHtml(cur, defs){
    var d = (defs && defs.length) ? defs : LINE_PALETTE;
    return SCALE_ORDER.map(function(key){
      var def = key === "default" ? { label: "Brand Colors", colors: d } : COLOR_SCALES[key];
      /* Nur an "Brand Colors" ein Info-Zeichen: die drei anderen sind fertige Paletten und
         erklaeren sich mit ihren Punkten selbst. Diese eine Zeile bedeutet etwas anderes -- sie
         malt KEINE Palette, sondern nimmt die Farbe, die jede Marke selbst hat -- und dazu gehoert,
         WO man die setzt. data-explain ist der Aufhaenger, den UC.makeExplain ueberall benutzt. */
      var info = key === "default"
        ? '<span class="up-th-info up-scale-opt-info" data-explain="brandcolors" role="button" tabindex="0"' +
          ' aria-label="' + esc(t_("What are Brand Colors?")) + '">' + icon("info", 2) + '</span>'
        : "";
      return '<div class="up-scale-opt' + (cur === key ? " is-active" : "") + '" data-scale="' + key + '">' +
          '<span class="up-scale-opt-head"><span class="up-scale-opt-lbl">' + esc(def.label) + '</span>' +
            info + SCALE_CHECK + '</span>' +
          '<span class="up-scale-dots">' + (def.colors || []).map(function(hx){
            return '<span class="up-scale-dot" style="background:' + esc(hx) + '"></span>';
          }).join("") + '</span>' +
        '</div>';
    }).join("");
  }

  /* Die Zeile im Chart-Settings-Menue. .up-pop-row / .up-pop-label / .up-switch sind die
     Haus-Bauteile fuer genau so eine Zeile (dieselben wie im Einstellungsmenue der Matrix) --
     hier steht kein eigenes Aussehen, nur der Zustand. */
  function legendSectionHtml(){
    var an = getLegendPref() === "on";
    return '<div class="up-pop-div"></div>' +
      '<div class="up-pop-row" data-legend role="button" tabindex="0" aria-pressed="' + (an ? "true" : "false") + '">' +
        '<span class="up-pop-label">Show Legend</span>' +
        '<span class="up-switch' + (an ? " is-on" : "") + '"></span>' +
      '</div>';
  }

  var hoverLinePlugin = {
    id: "upHoverLine",
    /* beforeDatasetsDraw und nicht afterDatasetsDraw: die Fuehrungslinie gehoert HINTER die
       Hoverpunkte. Davor zog ein grauer Strich mitten durch den weissen Kern jedes Punktes, und
       damit war der Kern nicht mehr weiss, sondern grau durchgestrichen.
       x auf die halbe Pixelgrenze gerundet -- dieselbe Rechnung wie im Rasterplugin darunter, und
       aus demselben Grund: eine 1px-Linie auf einer gebrochenen Koordinate wird ueber zwei Pixel
       weichgezeichnet und SIEHT 2px breit aus, obwohl lineWidth 1 ist. */
    beforeDatasetsDraw: function(chart){
      var act = chart.tooltip && chart.tooltip.getActiveElements ? chart.tooltip.getActiveElements() : [];
      if (!act || !act.length) return;
      var ca = chart.chartArea, ctx = chart.ctx;
      var x = Math.round(act[0].element.x) + 0.5;
      ctx.save();
      ctx.beginPath(); ctx.moveTo(x, ca.top); ctx.lineTo(x, ca.bottom);
      ctx.lineWidth = 1; ctx.strokeStyle = chart.$upHoverLineColor || "rgba(0,0,0,0.12)";
      ctx.stroke(); ctx.restore();
    }
  };
  /* dashed horizontal grid at every y tick, drawn behind the lines (Chart.js's own grid can't do
     the zero-line exception this design wants) */
  var dashedYGridPlugin = {
    id: "upDashedYGrid",
    beforeDatasetsDraw: function(chart){
      var y = chart.scales.y, ca = chart.chartArea, ctx = chart.ctx;
      if (!y || !ca) return;
      var ticks = (y.getTicks && y.getTicks()) || y.ticks || [];
      if (!ticks.length) return;
      ctx.save();
      ctx.setLineDash([6,6]); ctx.lineWidth = 1; ctx.strokeStyle = chart.$upGridColor || "rgba(0,0,0,0.08)";
      ticks.forEach(function(t){
        if (t.value <= 0) return;   // no gridline on the zero line
        var yp = y.getPixelForValue(t.value);
        if (yp == null || isNaN(yp)) return;
        if (yp < ca.top - 0.5 || yp > ca.bottom + 0.5) return;
        ctx.beginPath(); ctx.moveTo(ca.left, Math.round(yp) + 0.5); ctx.lineTo(ca.right, Math.round(yp) + 0.5); ctx.stroke();
      });
      ctx.restore();
    }
  };

  /* index-mode tooltip: every series at the hovered day, sorted desc, with a date header and
     favicon rows. Eases toward its target instead of snapping, so sweeping across the chart reads
     as one object following the cursor rather than a box teleporting per data point. */
  /* einheitFn/labelFn kommen als Parameter herein: diese Funktion liegt NEBEN makeLine, nicht
     darin -- ein Zugriff auf dessen cfg waere hier nicht sichtbar. Genau daran hing, dass die
     Achse schon ohne Prozentzeichen auskam und der Tooltip trotzdem eines schrieb. */
  function makeLineTooltip(wrap, getIsDark, getGran, einheitFn, labelFn, nachkommaFn){
    function ttEinheit(){ var u = einheitFn && einheitFn(); return typeof u === "string" ? u : "%"; }
    function ttLabel(){ var l = labelFn && labelFn(); return typeof l === "string" ? l : "Share:"; }
    /* Nachkommastellen sagt der Aufrufer. Ohne Angabe zwei -- so war es, als der Tooltip nur
       Prozentwerte kannte. Ein Rang zeigt IMMER eine Stelle, auch bei glatt 3: "3" und "3.0"
       nebeneinander in derselben Spalte liest sich wie zwei verschiedene Genauigkeiten. */
    /* Zahl ODER Funktion. Vorher nur Funktion -- eine mitgegebene Zahl warf beim ersten Hover,
       und das ist genau die Form, die man beim Verdrahten zuerst probiert. */
    function ttNachkomma(){
      if (typeof nachkommaFn === "number") return nachkommaFn;
      var n = nachkommaFn && nachkommaFn();
      return typeof n === "number" ? n : 2;
    }
    var pos = { x:null, y:null }, target = { x:0, y:0 }, running = false, visible = false;
    var FOLLOW = 0.18;
    /* Das Tooltip-Element GEMERKT, nicht pro Frame gesucht. Die Schleife lief mit einem
       querySelector pro Frame -- 60 Suchen je Sekunde, in denen sich nichts aendert. */
    var ttEl = null;
    /* Kennung des zuletzt gezeichneten Inhalts. Chart.js ruft diesen Handler bei JEDER
       Mausbewegung ueber dem Chart, auch wenn derselbe Punkt aktiv bleibt. Vorher wurde dabei
       jedes Mal el.innerHTML neu geschrieben (samt aller <img> im Tooltip) und unmittelbar danach
       getBoundingClientRect gelesen -- ein erzwungener Layoutdurchgang pro Mausbewegung. Mit der
       Kennung passiert das nur noch, wenn sich der Inhalt wirklich aendert, also beim Wechsel auf
       einen anderen Punkt. Die gemessene Groesse wird gleich mitgemerkt. */
    var letzteKennung = null, letzteBreite = 0, letzteHoehe = 0;
    function loop(){
      if (pos.x == null){ pos.x = target.x; pos.y = target.y; }
      pos.x += (target.x - pos.x) * FOLLOW;
      pos.y += (target.y - pos.y) * FOLLOW;
      if (ttEl) ttEl.style.transform = "translate3d(" + pos.x + "px," + pos.y + "px,0)";
      var dx = Math.abs(target.x - pos.x), dy = Math.abs(target.y - pos.y);
      if (visible || dx > 0.4 || dy > 0.4){ requestAnimationFrame(loop); }
      else { running = false; }
    }
    return function(context){
      var chart = context.chart, tooltip = context.tooltip;
      var el = ttEl && ttEl.parentNode === wrap ? ttEl : wrap.querySelector(".up-line-tt");
      if (!el){
        el = document.createElement("div");
        el.className = "up-line-tt";
        el.style.cssText = "position:absolute;left:0;top:0;pointer-events:none;z-index:9999;opacity:0;transform:translate3d(0,0,0);transition:opacity 120ms ease;";
        wrap.appendChild(el);
        letzteKennung = null;         /* neues Element, alte Kennung gilt nicht mehr */
      }
      ttEl = el;
      if (tooltip.opacity === 0){ el.style.opacity = "0"; visible = false; pos.x = null; pos.y = null; return; }
      var dps = (tooltip.dataPoints || []).filter(function(dp){ return dp && dp.parsed && dp.parsed.y != null; });
      if (!dps.length){ el.style.opacity = "0"; visible = false; pos.x = null; pos.y = null; return; }
      var dark = !!getIsDark();
      /* Aendert sich der Inhalt ueberhaupt? Punktindex, Theme und die Menge der sichtbaren Reihen
         bestimmen ihn vollstaendig. Ist alles gleich, wird nur noch die Zielposition gesetzt --
         kein innerHTML, kein Layout, kein Neuaufbau der Bilder. */
      var kennung = dps[0].dataIndex + "|" + (dark ? "d" : "l") + "|" +
        dps.map(function(dp){ return dp.datasetIndex + ":" + dp.parsed.y; }).join(",");
      var boxBg = dark ? "#121212" : "#ffffff";
      var boxBorder = dark ? "" : "border:1px solid #e0e2e6;";
      var boxShadow = dark ? "box-shadow:0 4px 14px rgba(0,0,0,.25);" : "box-shadow:0 4px 14px rgba(0,0,0,.10);";
      var textColor = dark ? "#e6e6e6" : "#1f1f1b";
      var mutedColor = dark ? "#8a8a8a" : "#6f737c";
      var dayLabel = chart.data.labels[dps[0].dataIndex];
      dps = dps.slice().sort(function(a, b){ return b.parsed.y - a.parsed.y; });
      var ff = "Geist,system-ui,-apple-system,Segoe UI,Roboto,Arial";
      var neuGezeichnet = kennung !== letzteKennung;
      var rows = !neuGezeichnet ? "" : dps.map(function(dp){
        var ds = dp.dataset;
        var icon = ds.__favicon
          ? '<img src="' + esc(ds.__favicon) + '" width="16" height="16" style="border-radius:4px;display:block;object-fit:cover"/>'
          : '<span style="width:16px;height:16px;border-radius:4px;background:' + ds.__baseColor + ';display:block"></span>';
        /* HIER steht der Wert des Linechart-Tooltips -- nicht in makeDonutTooltip, wo ich ihn
           zuerst gesucht habe. fmtPct haengt fest ein Prozentzeichen an; Rang und Sentiment
           sind keine Prozentwerte. Ohne Angabe bleibt es bei fmtPct, damit sich fuer die
           bestehenden Charts nichts aendert. */
        var val = (einheitFn || nachkommaFn)
          ? Number(dp.parsed.y).toFixed(ttNachkomma()) + ttEinheit()
          : fmtPct(dp.parsed.y);
        /* Klassen und data-id an den Zeilen. Keine CSS haengt daran -- die Formatierung steht
           weiter inline. Sie sind da, damit ein Aufrufer die Zeilen von aussen ANSPRECHEN kann:
           die Hero-Sektion der Landingpage laesst sie beim Filterwechsel wandern und ihre Zahlen
           zaehlen, und dafuer braucht sie einen Griff, der nicht auf der Reihenfolge von
           <span>-Kindern beruht. */
        return '<div class="up-line-tt-row" data-id="' + esc(String(ds.__id == null ? "" : ds.__id)) + '" style="display:flex;align-items:center;gap:8px;margin-top:8px">' +
            '<span style="flex:0 0 16px;display:flex">' + icon + '</span>' +
            '<span class="up-line-tt-name" style="flex:1 1 auto;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:' + textColor + '">' + esc(truncate(ds.label, 32)) + '</span>' +
            '<span class="up-line-tt-val" style="flex:0 0 auto;margin-left:77px;color:' + textColor + ';font-weight:500">' + val + '</span>' +
          '</div>';
      }).join("");
      if (neuGezeichnet){
        el.innerHTML =
          '<div style="background:' + boxBg + ';color:' + textColor + ';' + boxBorder + 'border-radius:16px;padding:10px 12px;font-family:' + ff + ';font-size:13px;line-height:1.35;' + boxShadow + 'white-space:nowrap;min-width:220px;">' +
            '<div style="color:' + mutedColor + ';font-size:11px">' + esc(chartDateTitle(dayLabel, getGran ? getGran() : "day")) + '</div>' +
            rows +
          '</div>';
        letzteKennung = kennung;
        /* Genau EINMAL messen, direkt nach dem Neuaufbau -- und das Ergebnis behalten. Vorher lief
           diese Messung bei jeder Mausbewegung, jedes Mal als erzwungener Layoutdurchgang.
           EIN getBoundingClientRect fuer beide Maasse, nicht offsetWidth plus offsetHeight: das
           waeren zwei Zugriffe fuer denselben Layoutdurchgang. Der laufende translate3d faelscht
           die Maasse nicht -- verschieben veraendert keine Groesse. */
        var mass = el.getBoundingClientRect();
        letzteBreite = mass.width; letzteHoehe = mass.height;
      }
      var cx = chart.canvas.offsetLeft, cy = chart.canvas.offsetTop, ca = chart.chartArea;
      var caretX = cx + (tooltip.caretX != null ? tooltip.caretX : dps[0].element.x), m = 16;
      var tx = (caretX + letzteBreite + m > cx + ca.right) ? (caretX - letzteBreite - m) : (caretX + m);
      tx = Math.max(cx + ca.left, Math.min(tx, cx + ca.right - letzteBreite));
      var ty = Math.max(cy + ca.top, Math.min(cy + ca.top + 8, cy + ca.bottom - letzteHoehe));
      target.x = tx; target.y = ty;
      if (pos.x == null){ pos.x = tx; pos.y = ty; el.style.transform = "translate3d(" + tx + "px," + ty + "px,0)"; }
      el.style.opacity = "1"; visible = true;
      if (!running){ running = true; requestAnimationFrame(loop); }
    };
  }

  function lineSkeletonHtml(){
    var hlines = "", xlabels = "", i;
    for (i = 0; i < 4; i++) hlines += '<div class="sk-lc-hline"></div>';
    for (i = 0; i < 6; i++) xlabels += '<div class="sk-lc-xlabel"></div>';
    var d = "M0,125 C60,115 100,70 150,58 C200,46 230,90 280,74 C330,58 390,22 460,14";
    var agId = "up-sk-ag-" + Math.random().toString(36).slice(2);
    return '<div class="up-line-sk"><div class="sk-linechart">' +
      '<div class="sk-lc-grid">' + hlines +
        '<svg class="sk-lc-svg" viewBox="0 0 460 160" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">' +
          '<defs><linearGradient id="' + agId + '" x1="0" y1="0" x2="0" y2="1"><stop class="sk-lc-astop0" offset="0%"/><stop class="sk-lc-astop1" offset="100%"/></linearGradient></defs>' +
          '<path d="' + d + ' L460,160 L0,160 Z" fill="url(#' + agId + ')"/>' +
          '<path class="sk-lc-stroke" d="' + d + '"/>' +
          '<path class="sk-lc-shimmer-path" d="' + d + '"/>' +
        '</svg>' +
      '</div>' +
      '<div class="sk-lc-xaxis">' + xlabels + '</div>' +
    '</div></div>';
  }

  /* ---------- line legend: balanced rows ----------
     Greedy wrapping leaves an ugly widow row (5 items, then 1). This packs the items into at most
     two rows minimising the WIDEST row, via a small DP over the break positions. */
  var LEG_MIN_GAP = 8, LEG_MAX_GAP = 16;
  function legGetColumnGap(w){ return Math.max(LEG_MIN_GAP, Math.min(LEG_MAX_GAP, Math.floor(w * 0.025))); }
  function legNormalizeUrl(url){ if (!url) return ""; if (url.indexOf("//") === 0) return "https:" + url; return url; }
  function legItemHtml(c, measure){
    /* OHNE favicon_url gibt es weder das Bild noch seinen Platz. Vorher stand hier ein
       unsichtbarer 16px-Platzhalter plus ein zweiter 8px-Abstand -- zwischen Punkt und Name
       klaffte damit ein 32px-Loch, das aussah, als fehle ein Bild. Eine Legende, die von
       vornherein ohne Bilder gebaut wird, braucht ihn nicht.
       Der Fall "Bild bricht beim LADEN weg" gehoert nicht mehr hierher: der Zuhoerer in core
       setzt dort einen Globus in derselben Groesse an die Stelle des Bildes, die Breite bleibt
       also ohne einen eigenen Platzhalter erhalten. */
    var fav = c.favicon_url
      ? '<img class="up-company-favicon" src="' + esc(legNormalizeUrl(c.favicon_url)) + '" alt="">' +
        '<span class="up-company-inner-gap"></span>'
      : '';
    return '<div class="up-company-item' + (measure ? " up-measure-item" : "") + '" data-company-id="' + esc(c.company_id) + '">' +
        '<span class="up-company-color" style="background:' + esc(c.color || "#999999") + '"></span>' +
        '<span class="up-company-inner-gap"></span>' +
        fav +
        '<span class="up-company-name">' + esc(c.name) + '</span>' +
      '</div>';
  }
  function legRowWidth(widths, start, end, gap){
    var total = 0;
    for (var i = start; i < end; i++){ total += widths[i]; if (i > start) total += gap; }
    return total;
  }
  function legGreedyRowCount(widths, cw, gap){
    var rows = 1, cur = 0;
    for (var i = 0; i < widths.length; i++){
      var next = cur === 0 ? widths[i] : cur + gap + widths[i];
      if (cur > 0 && next > cw){ rows++; cur = widths[i]; } else { cur = next; }
    }
    return rows;
  }
  function legBalancedBreaks(widths, rowCount, cw, gap){
    var n = widths.length;
    if (rowCount <= 1 || n <= 1) return [];
    var dp = [], prev = [], r, i, k;
    for (r = 0; r <= rowCount; r++){
      dp.push(new Array(n + 1)); prev.push(new Array(n + 1));
      for (i = 0; i <= n; i++){ dp[r][i] = Infinity; prev[r][i] = -1; }
    }
    dp[0][0] = 0;
    for (r = 1; r <= rowCount; r++){
      for (i = 1; i <= n; i++){
        for (k = r - 1; k < i; k++){
          var w = legRowWidth(widths, k, i, gap);
          if (w > cw) continue;
          var score = Math.max(dp[r-1][k], w);
          if (score < dp[r][i]){ dp[r][i] = score; prev[r][i] = k; }
        }
      }
    }
    if (!isFinite(dp[rowCount][n])) return [];
    var breaks = [], ii = n;
    for (r = rowCount; r > 1; r--){ var kk = prev[r][ii]; if (kk <= 0) break; breaks.unshift(kk); ii = kk; }
    return breaks;
  }

  /* ---------- shared line-chart data prep + colour scales ----------
     visibility-chart and brands-overview are fed by the SAME RPC and draw the same "top 7
     companies over time" line from it. This mapping, the fallback palette and the four colour
     scales all lived in visibility-chart.js; the second consumer is exactly the trigger §25 names
     for extracting instead of copy-pasting. Behaviour is byte-identical to what visibility-chart
     did before — the only change is where it lives.

     LINE_PALETTE backfills companies that arrive with NO colour of their own, and is unrelated to
     the COLOR_SCALES below (a scale overrides every company's colour; the palette only fills gaps).
     Every scale hex is a real, sourced palette (see STYLEGUIDE), not invented:
       tableau     — Tableau 10's softened/professional-BI variant
       colorblind  — Okabe/Ito (2008), the de-facto colourblind-safe qualitative palette (the 8th
                     colour, black, is dropped — it doesn't read as a distinct "brand" line and
                     disappears against a dark chart background)
       vivid       — D3/matplotlib "tab10"/Category10
     All three are mid-toned by design, which is what lets them work unchanged on a white AND a
     dark chart background — no separate light/dark variant needed. */
  var LINE_PALETTE = ["#14b8a6","#0ea5e9","#6366f1","#d946ef","#f97316","#f43f5e","#64748b"];
  var COLOR_SCALES = {
    tableau:    { label: "Tableau",         colors: ["#5778a4","#e49444","#d1615d","#85b6b2","#6a9f58","#e7ca60","#a87c9f"] },
    colorblind: { label: "Colorblind Safe", colors: ["#e69f00","#56b4e9","#009e73","#f0e442","#0072b2","#d55e00","#cc79a7"] },
    vivid:      { label: "Vivid",           colors: ["#1f77b4","#ff7f0e","#2ca02c","#d62728","#9467bd","#8c564b","#e377c2"] }
  };
  /* "default" is not in COLOR_SCALES on purpose — it means "each company's own colour, backfilled
     from LINE_PALETTE", which is what a null colorScale already produces below. */
  /* TABLEAU steht vorn und ist die Vorgabe. "default" bleibt als SCHLUESSEL, damit gespeicherte
     Werte weiter gelten -- umbenannt ist nur die Beschriftung: "Brand Colors", denn genau das ist
     es, jede Marke in ihrer eigenen Farbe. "Default" war irrefuehrend, sobald es nicht mehr die
     Vorgabe ist. */
  var SCALE_ORDER = ["tableau", "default", "vivid", "colorblind"];
  var SCALE_VORGABE = "tableau";
  var MAX_LINE_SERIES = 7;
  function buildLineDatasets(series, companies, colorScale){
    series = Array.isArray(series) ? series : [];
    companies = Array.isArray(companies) ? companies : [];
    var metaMap = {};
    companies.forEach(function(c){
      if (!c || c.company_id == null) return;
      metaMap[String(c.company_id)] = {
        color: c.color || null,
        favicon: c.favicon_url || c.favicon || "",
        name: c.name != null ? String(c.name) : String(c.company_id),
        global_share: (c.visibility_window_pct != null ? Number(c.visibility_window_pct) : null)
      };
    });
    var byId = {}, daySet = {};
    series.forEach(function(p){
      if (!p) return;
      var raw = (p.company_id != null) ? p.company_id : (p.id != null) ? p.id : "";
      var id = String(raw);
      if (!id) return;
      /* dayKey und NICHT der Rohwert. Der Schluessel wird gleich SORTIERT, und sortiert wird als
         Text -- bei ISO ist das die Zeitachse, bei allem anderen das Alphabet. Ein Bubble-Ausdruck
         schickt regelmaessig "Aug 6, 2026 12:00 am" oder "August 1, 2026", und daraus wurde in der
         Monatsansicht April, August, February, July, June, March, May: die Werte richtig, die
         Reihenfolge alphabetisch. Genau so gemeldet am 26.08. fuer Citations Share Over Time.
         Zweiter Gewinn: zwei Schreibweisen desselben Tages fallen jetzt auf EINEN Punkt zusammen.
         Vorher waren sie zwei Labels, also zwei Spalten fuer denselben Tag. */
      var day = dayKey(p.day);
      if (!day) return;
      daySet[day] = true;
      var v = (p.visibility_pct != null) ? Number(p.visibility_pct) : (p.share_pct != null ? Number(p.share_pct) : 0);
      (byId[id] = byId[id] || {})[day] = v || 0;
    });
    /* Sortieren als Text ist ab hier richtig: die Schluessel sind YYYY-MM-DD, und dort ist die
       alphabetische Reihenfolge die zeitliche. */
    var labels = Object.keys(daySet).sort();
    var ids = Object.keys(byId);
    ids.forEach(function(id){
      if (!metaMap[id]) metaMap[id] = { color:null, favicon:"", name:id, global_share:null };
      if (metaMap[id].global_share == null){
        var vals = labels.map(function(d){ return byId[id][d]; }).filter(function(v){ return v != null; });
        metaMap[id].global_share = vals.length ? (vals.reduce(function(a,b){ return a+b; },0)/vals.length) : 0;
      }
    });
    ids.sort(function(a,b){ return (metaMap[b].global_share||0) - (metaMap[a].global_share||0); });
    ids = ids.slice(0, MAX_LINE_SERIES);
    var scale = colorScale && COLOR_SCALES[colorScale] ? COLOR_SCALES[colorScale].colors : null;
    var globalMax = 0;
    var datasets = ids.map(function(id, i){
      var data = labels.map(function(d){ var v = byId[id][d]; if (v != null && v > globalMax) globalMax = v; return v != null ? v : null; });
      var col = scale ? scale[i % scale.length] : (metaMap[id].color || LINE_PALETTE[i % LINE_PALETTE.length]);
      return {
        label: metaMap[id].name,
        __id: id,
        __globalShare: metaMap[id].global_share,
        __favicon: metaMap[id].favicon,
        __baseColor: col,
        data: data,
        borderColor: col
      };
    });
    return { labels: labels, datasets: datasets, globalMax: globalMax };
  }

  /* ---------- makeBarList ---------------------------------------------------------------------
     Die Balkenliste als eigenstaendiges Bauteil. Markup und CSS sind DIESELBEN wie im Balkenmodus
     von makeTypeChart (.up-bars/.up-bar-row/.up-bar-track/.up-bar-fill/.up-bar-outside) -- es ist
     dasselbe Bauteil, nur ohne den Doughnut daneben.

     Warum nicht makeTypeChart benutzt: dessen renderBars haengt an seinem Umfeld -- Slice-Klicks,
     Dimmen, und ein fitBars, das die Zeilen auf eine feste Chart-Hoehe beschneidet. Eine Liste,
     die vollstaendig sein muss und ihre Hoehe selbst mitbringt, kann das nicht gebrauchen.
     Warum renderBars nicht umgebaut wurde: es steckt mitten im Umschalter Doughnut/Balken, und ein
     Umbau dort trifft vier Komponenten auf einmal. Die gemeinsame Sprache ist die CSS.

     Neu gegenueber renderBars ist die BESCHRIFTUNGSSPALTE links: ist genug Platz, stehen die Namen
     in einer eigenen Spalte vor den Balken, und im Balken bleibt nur der Prozentwert. Wird es eng,
     faellt die Spalte weg und alles verhaelt sich wie bisher (Beschriftung im Balken, bei zu
     schmalem Balken daneben).

     cfg: { mount, isDark(), labelCol() -> bool, minLabel, fmt(v) }
     items: [{ key, name, share, color, logo }]                                                */
  function makeBarList(cfg){
    cfg = cfg || {};
    var mount = cfg.mount;
    var isDark = cfg.isDark || function(){ return false; };
    var fmt = cfg.fmt || function(v){ return fmtPct(v); };
    var letzte = null;

    function zeichnen(items){
      if (!mount) return;
      letzte = items;
      var d = (items || []).slice().filter(Boolean);
      if (!d.length){ mount.innerHTML = '<div class="up-chart-empty">No data</div>'; return; }
      var spalte = cfg.labelCol ? !!cfg.labelCol() : false;
      var maxName = 0;
      var html = '<div class="up-bars' + (spalte ? " has-labelcol" : "") + '">' + d.map(function(it){
        var hell = barIsLight(it.color);
        var txt = hell ? "rgba(31,31,27,0.96)" : "rgba(255,255,255,0.95)";
        var txtPct = hell ? "rgba(31,31,27,0.62)" : "rgba(255,255,255,0.75)";
        var ausFarbe = isDark() ? "rgba(255,255,255,0.85)" : "var(--vc-text)";
        var ausPct = isDark() ? "rgba(255,255,255,0.55)" : "var(--vc-muted)";
        if (String(it.name || "").length > maxName) maxName = String(it.name).length;
        return '<div class="up-bar-row" data-bar-key="' + esc(String(it.key == null ? it.name : it.key)) + '">' +
          (spalte ? '<span class="up-bar-label">' +
              (it.logo ? '<img class="up-bar-logo" src="' + esc(it.logo) + '" alt="" loading="lazy" ' +
                         'onerror="this.style.display=&quot;none&quot;"/>' : '') +
              '<span class="up-bar-labeltxt">' + esc(it.name) + '</span></span>' : '') +
          '<div class="up-bar-track">' +
            '<div class="up-bar-fill" style="background:' + esc(it.color) + ';width:0%">' +
              (spalte ? '' : '<span class="up-bar-name" style="color:' + txt + ';opacity:0">' + esc(it.name) + '</span>') +
              '<span class="up-bar-pct up-bar-pct-in" style="color:' + txtPct + ';opacity:0">' + esc(fmt(it.share)) + '</span>' +
            '</div>' +
            '<span class="up-bar-outside" style="opacity:0">' +
              (spalte ? '' : '<span class="up-bar-name-out" style="color:' + ausFarbe + '">' + esc(it.name) + '</span>') +
              '<span class="up-bar-pct-out" style="color:' + ausPct + '">' + esc(fmt(it.share)) + '</span>' +
            '</span>' +
          '</div></div>';
      }).join("") + '</div>';
      mount.innerHTML = html;

      var rows = [].slice.call(mount.querySelectorAll(".up-bar-row"));
      var masse = rows.map(function(row){
        return { nameW: measureText(row.querySelector(".up-bar-name")),
                 pctW:  measureText(row.querySelector(".up-bar-pct-in")) };
      });
      /* Passt die Beschriftung in den Balken, steht sie drin; sonst rueckt sie daneben. Dieselbe
         Rechnung wie in renderBars -- Text plus Innenabstand plus etwas Luft. */
      function setzen(row, m){
        var fill = row.querySelector(".up-bar-fill"),
            name = row.querySelector(".up-bar-name"),
            pin  = row.querySelector(".up-bar-pct-in"),
            aus  = row.querySelector(".up-bar-outside");
        if (!fill || !aus) return;
        var breit = fill.offsetWidth, noetig = m.nameW + m.pctW + 12 + 20;
        if (breit >= noetig){
          if (name) name.style.opacity = "1";
          pin.style.opacity = "1"; aus.style.opacity = "0";
        } else {
          if (name) name.style.opacity = "0";
          pin.style.opacity = "0";
          aus.style.left = Math.round(breit + 8) + "px";
          aus.style.opacity = "1";
        }
      }
      function alle(){ rows.forEach(function(row, i){ setzen(row, masse[i]); }); }
      /* Zwei rAF: die 0%-Breite muss einmal gemalt worden sein, sonst fasst der Browser beide
         Breiten zusammen und die Balken wachsen nicht, sondern stehen sofort. */
      function breitenSetzen(){
        rows.forEach(function(row, i){
          var fill = row.querySelector(".up-bar-fill");
          if (fill) fill.style.width = Math.max(Number(d[i].share) || 0, 0) + "%";
        });
      }
      requestAnimationFrame(function(){ requestAnimationFrame(function(){ breitenSetzen(); }); });
      /* Notbremse: in einem verdeckten Tab laeuft requestAnimationFrame nicht. Ohne diese Zeile
         blieben die Balken dort auf 0% stehen -- und stuenden auch dann noch leer da, wenn der
         Nutzer zurueckwechselt, weil der Rueckruf nur EINMAL vorgesehen war. */
      setTimeout(function(){ if (rows[0] && rows[0].querySelector(".up-bar-fill").style.width === "0%") breitenSetzen(); }, 300);
      setTimeout(alle, 640);
      if (window.ResizeObserver){
        var ro = new ResizeObserver(function(){ alle(); });
        ro.observe(mount);
      }
    }
    function skelett(n){
      if (!mount) return;
      var zeilen = "";
      for (var i = 0; i < (n || 4); i++) zeilen += '<div class="up-bar-sk-row"><span class="up-bar-sk-track" style="width:' + (92 - i * 14) + '%"></span></div>';
      mount.innerHTML = '<div class="up-bars-sk">' + zeilen + '</div>';
    }
    return { render: zeichnen, skeleton: skelett, redraw: function(){ if (letzte) zeichnen(letzte); } };
  }

  /* ---------- makeScaleMenu ----------
     The gear-button "Chart Settings" dropdown shared by every line chart: colour scale + the
     app-wide Line Width section. Deliberately NOT built on makePopover — that primitive's
     outside-click test is `wrap.contains(e.target)`, which assumes the menu is a DOM descendant of
     its trigger. This menu is body-mounted instead, because the chart panel it sits in clips
     overflow and would otherwise cut it off. Hand-rolled open/close with its own outside-click,
     Escape and focus-blur (aria-hidden-on-an-ancestor-of-the-focused-element is a real a11y trap).

     cfg: { btn, getIsDark(), getScale(), setScale(key), defaultColors() -> [hex],
            onChange(), closeOthers() }
     Returns { open, close, isOpen, populate, reposition }. */
  /* Das Chart-Settings-Menue am Chart selbst ist AUSSER BETRIEB. Dieselbe Wahl -- Farben,
     Linienstaerke, Legende -- steht jetzt im Einstellungsfenster (preferences.js, Seite "Charts"),
     und dort gehoert sie hin: es sind seitenweite Vorlieben und keine Eigenschaft des einen
     Charts, dessen Zahnrad man gerade erwischt hat. Zwei Orte fuer dieselbe Einstellung waren der
     Grund, sie hier wegzunehmen.
     Die FABRIK bleibt stehen und gibt eine leere Huelle zurueck: die vier Charts rufen sie, geben
     ihr einen Knopf und binden ihre eigenen Klicks daran. Ein Ausbau in vier Dateien haette
     denselben Effekt und viermal so viel Fehlerflaeche. Der Knopf selbst wird in core.css
     ausgeblendet -- er steht im handgemachten Bubble-Markup und ist von hier aus nicht erreichbar.
     Wer sie zurueckholen will: diesen Riegel entfernen und die Regel in core.css. */
  var CHART_SETTINGS_AUS = true;
  function makeScaleMenu(cfg){
    var btn = cfg.btn;
    if (CHART_SETTINGS_AUS || !btn) return { open: function(){}, close: function(){}, isOpen: function(){ return false; },
                       populate: function(){}, reposition: function(){} };
    var menu = null, open = false;
    function ensure(){
      if (menu && document.body.contains(menu)) return menu;
      menu = document.createElement("div");
      menu.className = "up-scale-menu";
      menu.setAttribute("role", "menu");
      menu.setAttribute("aria-hidden", "true");
      menu.addEventListener("click", function(e){
        var opt = e.target.closest("[data-scale]");
        if (opt){
          cfg.setScale(opt.getAttribute("data-scale"));
          populate();
          if (cfg.onChange) cfg.onChange();
          close();
          return;
        }
        var lw = e.target.closest("[data-linewidth]");
        if (lw){
          /* Global and immediate, not staged: every mounted line chart on the page redraws itself
             through the up-linewidth-change listener in makeLine. No Apply step here by design. */
          setLineWidthPref(lw.getAttribute("data-linewidth"));
          populate();
          return;
        }
        /* Genauso global und genauso sofort wie die Linienstaerke: jedes gezeichnete Linienchart
           auf der Seite hoert auf up-legend-change und blendet seine Legende mit. */
        if (e.target.closest("[data-legend]")){
          setLegendPref(getLegendPref() === "on" ? "off" : "on");
          populate();
          return;
        }
      });
      document.body.appendChild(menu);
      return menu;
    }
    function populate(){
      if (!menu) return;
      /* "Default" previews the colours that would ACTUALLY render right now (each company's own
         RPC colour, in the same top-7 order the chart picks), never a hardcoded stand-in — the
         caller derives them from buildLineDatasets itself so this cannot drift from the chart. */
      var defs = (cfg.defaultColors && cfg.defaultColors()) || [];
      if (!defs.length) defs = LINE_PALETTE;
      var rows = colorScaleOptionsHtml(cfg.getScale(), defs);
      menu.innerHTML = '<div class="up-pop-head">Chart Settings</div>' + rows +
                       lineWidthSectionHtml() + legendSectionHtml();
    }
    function reposition(){
      if (!menu) return;
      var r = btn.getBoundingClientRect();
      menu.style.top = (r.bottom + 8) + "px";
      menu.style.right = (window.innerWidth - r.right) + "px";
    }
    function doOpen(){
      if (open) return;
      ensure();
      if (cfg.closeOthers) cfg.closeOthers();
      populate();
      open = true;
      btn.classList.add("is-open");
      menu.setAttribute("data-theme", cfg.getIsDark && cfg.getIsDark() ? "dark" : "light");
      reposition();
      menu.setAttribute("aria-hidden", "false");
      void menu.offsetWidth;   // force a layout flush so the appear transition actually runs
      menu.classList.add("is-shown");
    }
    function close(){
      if (!open) return;
      if (menu && menu.contains(document.activeElement)){ try { document.activeElement.blur(); } catch(e){} }
      open = false;
      btn.classList.remove("is-open");
      if (menu){ menu.classList.remove("is-shown"); menu.setAttribute("aria-hidden", "true"); }
    }
    if (!btn.__upScaleBound){
      btn.__upScaleBound = true;
      btn.addEventListener("click", function(e){ e.stopPropagation(); if (open) close(); else doOpen(); });
      document.addEventListener("click", function(e){
        if (!open) return;
        if (btn.contains(e.target)) return;
        if (menu && menu.contains(e.target)) return;
        close();
      });
      document.addEventListener("keydown", function(e){
        if (!open) return;
        if (e.key !== "Escape" && e.key !== "Esc") return;
        close();
      });
      window.addEventListener("resize", function(){ if (open) reposition(); });
    }
    return { open: doOpen, close: close, isOpen: function(){ return open; }, populate: populate, reposition: reposition };
  }

  /* ---------- makeLine ----------
     cfg: { wrap, canvas, legend, isDark(), isOwner(), gran(), watermark:bool }
     The component builds {labels, datasets}; datasets must carry __id / __baseColor / __favicon.
     Returns { render, skeleton, empty, destroy, resize, relayoutLegend, chart }. */
  function makeLine(cfg){
    /* Standard bleibt Prozent -- alle bestehenden Aufrufer erwarten das. Als Funktion, weil
       der Modus in brand-detail zwischen zwei Renders wechselt. */
    function einheit(){
      var u = cfg && cfg.unit;
      if (typeof u === "function") u = u();
      return typeof u === "string" ? u : "%";
    }
    var wrap = cfg.wrap, canvas = cfg.canvas, legendEl = cfg.legend || null;
    var isDark = cfg.isDark || function(){ return false; };
    var isOwner = cfg.isOwner || function(){ return true; };
    var chart = null, legendCompanies = [], verifyT = null, sizeIv = null, lastBuilt = null, lastSig = null;
    /* Der Waechter fuer "der View wird eingeblendet". Angelegt EINMAL je makeLine und nicht je
       Zeichnung -- er haengt am Kasten, nicht am Chart, und den Kasten gibt es hier schon. */
    chartBeiSichtbarwerden(wrap, function(){ return chart; });
    /* Ein Zaehler fuer den Stand. Jeder Aufruf von render/skeleton/empty erhoeht ihn, und jede
       verzoegerte Zeichnung prueft, ob ihr Stand noch der aktuelle ist.
       Ohne ihn zeichnete ein alter Datensatz UEBER das Skelett: render() haengt seine Zeichnung an
       loadChartJs().then(...), und wenn Chart.js noch vom CDN kommt, laeuft dieser Rueckruf erst,
       nachdem skeleton() schon gelaufen ist. destroy() bricht Wartetakt und Nachpruefung ab, aber
       nicht ein Versprechen, das noch nicht erfuellt ist. Genau das war der Bericht: beim Laden
       einer neuen Domain erschien hier und da die Linie der vorigen. */
    var stand = 0;

    /* Fingerprint of everything a rebuild would actually change: the drawn values, the colours,
       the line width and the theme. Its whole job is to let render() recognise "you are asking
       for exactly the chart that is already on the canvas" and do nothing.
       This matters because render() is not called once per data load. A component's render() runs
       on the data arriving, on loading flipping back off, on a theme sync, on a sort or filter
       change — and every one of those used to destroy the Chart instance and construct a new one,
       which replays the 600ms entrance animation from zero. Two of those landing back-to-back is
       what "the chart appears, stutters, and appears again" looks like from the outside.
       Cost is a few hundred string joins against a ~70ms rebuild — worth it, but keep it flat:
       no JSON.stringify over the full dataset objects, those carry Chart.js internals. */
    function builtSig(built){
      if (!built || !built.datasets) return null;
      try {
        var parts = [isDark() ? "d" : "l", getLineWidthPref(), (built.labels || []).join(",")];
        for (var i = 0; i < built.datasets.length; i++){
          var d = built.datasets[i];
          parts.push(String(d.label) + "|" + String(d.__baseColor || d.borderColor || "") + "|" + (d.data || []).join(","));
        }
        return parts.join(";");
      } catch(e){ return null; }
    }
    function canvasHasLiveChart(){
      try { return !!(window.Chart && window.Chart.getChart && canvas && window.Chart.getChart(canvas)); }
      catch(e){ return false; }
    }
    /* Redraw with whatever data is already on screen — no refetch — the moment ANY chart on the
       page (this instance's own dropdown or another component's) changes the shared line-width
       preference. Bound once per instance, not per render: this closure lives as long as the
       component does, same as the resize/click listeners the color-scale dropdown binds below. */
    window.addEventListener("up-linewidth-change", function(){
      if (!isOwner() || !chart || !lastBuilt) return;
      build(lastBuilt);
    });
    /* Und dasselbe beim Wechsel von Zahlen- oder Datumsformat: Achsenbeschriftung und Tooltip
       entstehen in build() aus chartDateFmt und fmtNum, also aus den Einstellungen des Nutzers.
       Ohne einen Anlass zum Neuzeichnen stuende der Chart in der alten Schreibweise da, waehrend
       die Tabelle darunter schon in der neuen steht -- und ZWEI Schreibweisen auf einer Seite sind
       schlimmer als die falsche.
       EIN Zuhoerer fuer jeden Chart der Seite: makeLine laeuft je Chart, das Ereignis kommt vom
       Fenster. Die Sprache steht ausdruecklich mit drin, weil die Monatsnamen daran haengen. */
    window.addEventListener("up-prefs-change", function(){
      if (!isOwner() || !chart || !lastBuilt) return;
      build(lastBuilt);
    });
    /* Die Legende braucht KEIN Neuzeichnen des Charts -- sie ist ein eigenes Element unter dem
       Canvas. legendLayout() reicht: es blendet aus oder rechnet die Zeilen neu. */
    window.addEventListener("up-legend-change", function(){
      if (!isOwner()) return;
      legendLayout();
    });
    /* Dasselbe beim Themenwechsel, und aus demselben Grund: die Farben von Linie, Punkten, Achsen
       und Raster entstehen in build() aus themeColors(), also aus isDark() -- ohne einen Anlass
       zum Neuzeichnen bleiben sie stehen, waehrend die Karte ringsum ueber CSS laengst gewechselt
       hat. Ein Chart in der falschen Farbe in einer richtig gefaerbten Karte.
       Hier im Kit und nicht in den fuenf Komponenten: jede haette denselben Beobachter gebraucht,
       und eine haette ihn irgendwann nicht bekommen. Genau das war der Fall -- brand-detail hatte
       data-isdark nicht einmal im Filter. */
    onTheme(function(){
      if (!isOwner() || !chart || !lastBuilt) return;
      build(lastBuilt);
    });

    function themeColors(){
      return isDark()
        ? { text:"#e0e0e0", muted:"#a0a0a0", border:"#353535", bg:"#1b1b1b" }
        : { text:"#1f1f1b", muted:"#6f737c", border:"#e0e2e6", bg:"#ffffff" };
    }
    function clearExtras(){
      var sk = wrap.querySelector(".up-line-sk"); if (sk) sk.remove();
      var em = wrap.querySelector(".up-line-empty"); if (em) em.remove();
    }
    function destroy(){
      if (sizeIv){ clearInterval(sizeIv); sizeIv = null; }
      clearTimeout(verifyT);
      if (chart){ try { chart.destroy(); } catch(e){} chart = null; }
      lastSig = null;   // nothing is drawn any more, so the next render must actually build
      if (window.Chart && window.Chart.getChart){ var ex = window.Chart.getChart(canvas); if (ex) try { ex.destroy(); } catch(e){} }
      /* The external tooltip is a plain DOM element outside Chart.js's lifecycle — destroying the
         chart stops the callback that would set its opacity back to 0, so a tooltip left visible
         from a hover right before a reload would stay stuck on screen. */
      var tt = wrap.querySelector(".up-line-tt");
      if (tt) tt.style.opacity = "0";
    }
    function clearLegend(){ if (legendEl){ legendCompanies = []; legendEl.innerHTML = ""; } }

    function legendLayout(){
      if (!legendEl) return;
      /* Abgewaehlt: nur verstecken, NICHT leeren. Das Geruest (die Messkopien) bleibt stehen,
         damit das Wiedereinschalten ohne neuen Datensatz auskommt -- sonst braeuchte es einen
         render() aus Bubble, nur weil jemand einen Schalter umgelegt hat. */
      if (getLegendPref() === "off"){ legendEl.classList.add("is-hidden"); return; }
      if (getPageWidth() < 500){ legendEl.classList.add("is-hidden"); return; }
      legendEl.classList.remove("is-hidden");
      var rowsC = legendEl.querySelector(".up-company-rows");
      var measure = Array.prototype.slice.call(legendEl.querySelectorAll(".up-measure-item"));
      if (!rowsC || !measure.length) return;
      var cw = legendEl.clientWidth;
      if (!cw){ setTimeout(legendLayout, 100); return; }
      var gap = legGetColumnGap(cw);
      legendEl.style.setProperty("--up-column-gap", gap + "px");
      var widths = measure.map(function(it){ return it.getBoundingClientRect().width; });
      var rowCount = legGreedyRowCount(widths, cw, gap);
      rowCount = Math.max(1, Math.min(rowCount, legendCompanies.length, 2));   // never more than 2 rows
      var breaks = legBalancedBreaks(widths, rowCount, cw, gap);
      /* if 2 balanced rows don't fit (items too wide even truncated), split at the midpoint */
      if (rowCount === 2 && !breaks.length) breaks = [Math.ceil(legendCompanies.length / 2)];
      var rows = [], start = 0, b;
      for (b = 0; b < breaks.length; b++){ rows.push(legendCompanies.slice(start, breaks[b])); start = breaks[b]; }
      rows.push(legendCompanies.slice(start));
      rowsC.innerHTML = rows.map(function(row){
        return '<div class="up-company-row">' + row.map(function(c){ return legItemHtml(c, false); }).join("") + '</div>';
      }).join("");
    }
    function renderLegend(datasets){
      if (!legendEl) return;
      legendCompanies = (datasets || []).map(function(ds){
        return { company_id: ds.__id, name: ds.label, color: ds.__baseColor, favicon_url: ds.__favicon };
      });
      if (!legendCompanies.length){ legendEl.innerHTML = ""; return; }
      legendEl.innerHTML =
        '<div class="up-company-measure">' + legendCompanies.map(function(c){ return legItemHtml(c, true); }).join("") + '</div>' +
        '<div class="up-company-rows"></div>';
      legendLayout();
    }
    /* highlight one series on legend hover: active keeps its colour, everything else dims */
    function applyHighlight(id){
      if (chart && chart.__activeId !== id){
        chart.__activeId = id;
        var dim = isDark() ? "rgba(160,160,160,0.20)" : "rgba(120,123,124,0.22)";
        chart.data.datasets.forEach(function(ds){
          ds.borderColor = (id == null || ds.__id === id) ? ds.__baseColor : dim;
        });
        chart.update("highlight");   // named transition, see options.transitions below
      }
      if (legendEl){
        var items = legendEl.querySelectorAll(".up-company-item");
        for (var i = 0; i < items.length; i++){
          items[i].style.opacity = (id == null || items[i].getAttribute("data-company-id") === id) ? "1" : "0.35";
        }
      }
    }
    /* bound once via delegation — rows are re-rendered on every resize */
    if (legendEl && legendEl.getAttribute("data-up-hoverbound") !== "1"){
      legendEl.setAttribute("data-up-hoverbound", "1");
      legendEl.addEventListener("mouseover", function(e){
        var it = e.target && e.target.closest ? e.target.closest(".up-company-item") : null;
        if (it) applyHighlight(it.getAttribute("data-company-id"));
      });
      legendEl.addEventListener("mouseleave", function(){ applyHighlight(null); });
    }

    function skeleton(){
      stand++;
      destroy(); clearExtras(); clearLegend();
      wrap.insertAdjacentHTML("beforeend", lineSkeletonHtml());
      if (cfg.watermark !== false) injectWatermark(wrap);
    }
    function empty(msg){
      stand++;
      destroy(); clearExtras(); clearLegend();
      wrap.insertAdjacentHTML("beforeend", '<div class="up-line-empty">' + esc(msg || t_("No data")) + '</div>');
      if (cfg.watermark !== false) injectWatermark(wrap);
    }

    /* Die eigentliche Antwort auf "warum fehlt beim Viewwechsel ein Punkt der Zeitachse":
       die x-Achse laeuft mit autoSkip. Chart.js entscheidet aus der VERFUEGBAREN BREITE, wie viele
       Beschriftungen es unterbringt, und verwirft dabei welche -- auch die letzte. Wird das Chart
       gezeichnet, waehrend sein Kasten noch nicht seine endgueltige Breite hat, rechnet es mit der
       falschen und muss danach noch einmal ran. Das ist das Nachrutschen.

       Auf 0 Breite zu warten reicht NICHT, und genau das tat buildWhenSized schon: es prueft
       clientWidth > 0. Ein View, der gerade eingeblendet wird, hat aber oft schon eine Breite --
       nur noch nicht die endgueltige. Deshalb hier keine zweite Warteschleife (mein erster Versuch
       war genau das, ein Nachbau von buildWhenSized), sondern eine NACHKONTROLLE hinter dem
       Zeichnen: hat sich die Breite danach noch geaendert, wird einmal still nachgerechnet.
       "still" heisst update("none") -- ohne das liefe die 600ms-Einblendanimation ein zweites Mal,
       und das war das Rumruckeln, wenn die Legende an ist. */
    var nachUhr = null;
    function nachkontrolle(){
      if (nachUhr) { window.clearTimeout(nachUhr); nachUhr = null; }
      var breiteBeimZeichnen = wrap ? (wrap.clientWidth || 0) : 0;
      var meinStand = stand, versuche = 0;
      function pruef(){
        nachUhr = null;
        if (meinStand !== stand || !chart) return;
        var jetzt = wrap ? (wrap.clientWidth || 0) : 0;
        if (jetzt !== breiteBeimZeichnen && jetzt > 0){
          breiteBeimZeichnen = jetzt;
          try { chart.resize(); chart.update("none"); } catch(e){}
        }
        /* Drei Blicke ueber eine halbe Sekunde: das deckt das Einblenden eines Views ab, ohne
           danach noch eine Uhr laufen zu lassen. */
        if (++versuche < 3) nachUhr = window.setTimeout(pruef, 160);
      }
      nachUhr = window.setTimeout(pruef, 60);
    }
    function build(built){
      destroy();
      lastSig = builtSig(built);   // after destroy(), which clears it
      var tc = themeColors();
      var ctx = canvas.getContext("2d");
      window.Chart.defaults.color = tc.muted;
      window.Chart.defaults.font = { family: "Geist, system-ui, -apple-system, Segoe UI, Roboto, Arial", size: 12 };
      var labels = built.labels, ds = built.datasets;
      var single = labels.length <= 1;   // single-day range → show the values as points
      ds.forEach(function(d){
        d.borderWidth = LINE_WIDTH_VALUES[getLineWidthPref()]; d.fill = false; d.cubicInterpolationMode = "monotone"; d.tension = LINE_TENSION;
        d.pointRadius = single ? 4 : 0; d.pointHoverRadius = LINE_POINT_HOVER; d.pointHitRadius = LINE_POINT_HIT;
        d.pointBorderWidth = d.borderWidth; d.pointHoverBorderWidth = d.borderWidth;
        d.pointBackgroundColor = single ? d.__baseColor : tc.bg;
        d.pointBorderColor = d.__baseColor; d.pointHoverBackgroundColor = tc.bg; d.pointHoverBorderColor = d.__baseColor;
        d.spanGaps = true; d.clip = 8;
      });
      var visMax = 0;
      ds.forEach(function(d){ (d.data || []).forEach(function(v){ if (v != null && v > visMax) visMax = v; }); });
      var yMax = visMax * Y_PAD; if (yMax <= 0) yMax = 1; if (yMax > 100) yMax = 100;
      try {
        chart = new window.Chart(ctx, {
          type: "line",
          data: { labels: labels, datasets: ds },
          /* Raster ZUERST. Beide zeichnen in beforeDatasetsDraw, und dort entscheidet die
             Reihenfolge in dieser Liste: so liegt die Fuehrungslinie ueber dem gestrichelten
             Raster und beide unter den Linien und Punkten. */
          plugins: [dashedYGridPlugin, hoverLinePlugin],
          options: {
            responsive: true, maintainAspectRatio: false,
            /* Chart.js haengt bei responsive: true einen eigenen Beobachter an den Kasten und
               zeichnet bei JEDER Aenderung sofort neu -- beim Ziehen am Fensterrand also 60 Mal
               je Sekunde ein volles Chart-Layout. resizeDelay sammelt das: gezeichnet wird erst
               120ms nach der letzten Aenderung. Waehrend des Ziehens skaliert der Browser die
               Leinwand, danach steht sie scharf. */
            resizeDelay: 120,
            animation: { duration: 600, easing: "easeOutQuart" },
            /* separate, faster curve for the legend-hover cross-highlight than the initial draw */
            transitions: { highlight: { animation: { duration: 200, easing: "easeOutQuad" } } },
            interaction: { mode: "index", intersect: false },
            layout: { padding: { top: 8, right: 2, bottom: 0, left: 0 } },
            plugins: { legend: { display: false }, tooltip: { enabled: false, external: makeLineTooltip(wrap, isDark, cfg.gran, einheit, cfg.tipLabel, cfg.decimals) } },
            scales: {
              x: { grid: { display:false }, offset: single, border: { display:true, color: tc.border, width:1 },
                   /* autoSkip AUS. Das ist die Ursache des Nachrutschens, und sie ist gemessen:
                      autoSkip laesst Chart.js aus der VERFUEGBAREN BREITE entscheiden, welche
                      Beschriftungen es zeigt -- also aendert sich bei jeder Breitenaenderung, WELCHE
                      dastehen. Beim Einblenden eines Views (die Seite wird hoeher, ein Scrollbalken
                      kommt dazu, der Kasten wird um dessen Breite schmaler) hat es damit die Achse
                      neu geordnet, und weil die letzte Beschriftung Platz braucht, ruckte das Chart
                      von rechts nach innen. Gemessen an derselben Datenreihe:
                          Kasten 1100px -> Achse 449px, 7 Ticks, letzte "08-03"
                          Kasten  560px -> Achse 197px, 5 Ticks, letzte "08-02"
                      Auf die Reihenfolge zu warten oder danach nachzurechnen behandelt nur den
                      Zeitpunkt, nicht den Grund -- das waren meine zwei ersten Anlaeufe.

                      Jetzt entscheidet die DATENLAENGE, welche Beschriftungen stehen, und die
                      aendert sich mit der Breite nicht. Gewaehlt werden hoechstens X_MAX_TICKS
                      gleichmaessig verteilte, und die ERSTE und die LETZTE sind immer dabei -- der
                      fehlende rechte Punkt kann damit nicht mehr vorkommen.
                      Die uebrigen geben "" zurueck: sie bleiben als Gitterposition erhalten (das
                      Raster und die Fuehrungslinie haengen daran), messen aber keine Breite. */
                   ticks: { autoSkip:false, maxRotation:0, color: tc.muted,
                            callback: function(v, i){
                              if (!xTickZeigen(i, labels.length)) return "";
                              /* dayKey ZUERST. Der Rohwert ist nicht immer ISO: ein Bubble-Ausdruck
                                 schickt auch "Aug 6, 2026 12:00 am", und slice(5) machte daraus
                                 "6, 2026 12:00 am" -- genau so stand es in der Achse. dayKey bringt
                                 jede Schreibweise auf YYYY-MM-DD, ein ISO-Datum laeuft unveraendert
                                 durch. Bleibt der Wert unlesbar, steht er roh da statt verstuemmelt. */
                              var lab = dayKey(labels[i]);
                              var iso = lab.match(/^(\d{4})-(\d{2})-(\d{2})$/);
                              if (!iso) return String(labels[i] || "");
                              if (cfg.gran && cfg.gran() === "month"){
                                return MONTHS_LONG[parseInt(iso[2],10) - 1] || lab;
                              }
                              return lab.slice(5);   // day / week → "MM-DD"
                            } } },
              y: { min:0, max:yMax, beginAtZero:true,
                   afterBuildTicks: function(scale){ var m = scale.max || 1; scale.ticks = [{value:0},{value:m/3},{value:2*m/3},{value:m}]; },
                   /* Die Einheit kommt vom Aufrufer. Rang und Sentiment sind KEINE Prozente --
                      ein hart verdrahtetes "%" schrieb an jede Achse ein Zeichen, das dort nicht
                      hingehoert. Ohne Angabe bleibt es Prozent, das ist der haeufigste Fall. */
                   ticks: { color: tc.muted, callback: function(v){ return Math.round(v) + einheit(); } },
                   grid: { display:false }, border: { display:false } }
            },
            elements: { point: { radius: 0 } }
          }
        });
        chart.$upGridColor = tc.border;
        chart.$upHoverLineColor = tc.border;
        /* Und die Nachkontrolle anwerfen: setzt sich die Breite erst NACH dem Zeichnen (ein View,
           der gerade eingeblendet wird), wird einmal still nachgerechnet. Siehe oben. */
        nachkontrolle();
      } catch(err){}
    }

    /* Chart.js reads the canvas's live layout to compute where the entrance animation starts, so
       it needs a container with real, settled dimensions at creation time — not just "attached".
       Two situations defeat that: (1) Chart.js was already cached so this .then() runs as an
       immediate microtask before the browser laid out a freshly re-inserted widget; (2) the root
       sits inside a Bubble element hidden via display:none, which reports 0x0 forever until shown.
       Building against that collapsed geometry replays as points flying in from the (0,0) corner.
       Deliberately setInterval, not rAF/ResizeObserver: both of those are tied to the rendering
       pipeline, which browsers pause for a backgrounded or hidden tab — exactly when a Bubble
       popup sits unopened. setInterval keeps ticking (throttled, not paused). */
    function buildWhenSized(built, meinStand){
      if (meinStand != null && meinStand !== stand) return;
      if (wrap.clientWidth > 0 && wrap.clientHeight > 0){ build(built); return; }
      var ticks = 0;
      if (sizeIv) clearInterval(sizeIv);
      sizeIv = setInterval(function(){
        if (meinStand != null && meinStand !== stand){ clearInterval(sizeIv); sizeIv = null; return; }
        if (!isOwner() || !canvas || !canvas.isConnected){ clearInterval(sizeIv); sizeIv = null; return; }
        if ((wrap.clientWidth > 0 && wrap.clientHeight > 0) || ++ticks > 600){   // ~2 min cap
          clearInterval(sizeIv); sizeIv = null;
          build(built);
        }
      }, 200);
    }
    /* Chart.js's internals occasionally fail to attach silently (a race in its own resize
       observer). Re-check a few times and rebuild if the canvas ends up with no live instance. */
    function verify(built, meinStand){
      clearTimeout(verifyT);
      var attempts = 0;
      function check(){
        /* Auch die Nachpruefung braucht den Stand: nach skeleton() lebt kein Chart und es steht
           keine Leerflaeche da (sondern ein Skelett), also hielt sie das fuer einen verlorenen
           Chart und baute den ALTEN Datensatz erneut -- ueber das Skelett. */
        if (meinStand != null && meinStand !== stand) return;
        if (!isOwner()) return;
        var alive = false;
        try { alive = !!(window.Chart && window.Chart.getChart && canvas && window.Chart.getChart(canvas)); } catch(e){}
        if (alive || wrap.querySelector(".up-line-empty")) return;
        if (attempts++ >= 12) return;
        buildWhenSized(built, meinStand);
        verifyT = setTimeout(check, 250);
      }
      verifyT = setTimeout(check, 400);
    }

    function render(built){
      if (!isOwner()) return;
      clearExtras();
      if (!built || !built.datasets || !built.datasets.length){ empty(); return; }
      /* Same chart already on the canvas → leave it alone. Not just a saved rebuild: rebuilding
         restarts the entrance animation, so a second render() arriving 200ms after the first
         (data, then loading=no) made the lines wipe in twice. Both halves of the check matter —
         a matching signature with no live Chart instance means Chart.js dropped it and we DO
         need to build. */
      var sig = builtSig(built);
      if (sig && sig === lastSig && chart && canvasHasLiveChart()){ lastBuilt = built; return; }
      lastBuilt = built;
      var meinStand = ++stand;
      renderLegend(built.datasets);
      if (cfg.watermark !== false) injectWatermark(wrap);
      loadChartJs().then(function(){
        /* Inzwischen laeuft ein anderer Stand -- Skelett, Leerflaeche oder ein neuer Datensatz.
           Dann ist diese Zeichnung ueberholt und darf nichts mehr anfassen. */
        if (meinStand !== stand) return;
        if (!isOwner() || !canvas) return;
        buildWhenSized(built, meinStand);
        verify(built, meinStand);
      })["catch"](function(err){
        /* Nicht still. clearExtras() hat Skelett und Leerflaeche vorher entfernt, die Legende
           steht schon -- bei einer Ablehnung bliebe eine Legende ueber einem blanken Canvas
           stehen, und das sieht aus wie ein leerer Datensatz statt wie ein Ladefehler. */
        if (window.console) console.error("[chart] Chart.js konnte nicht geladen werden. Das " +
          "Diagramm bleibt leer -- das ist KEIN fehlender Datensatz. Fehler:", err);
      });
    }

    /* Faerbt die schon gezeichneten Linien an Ort und Stelle um -- kein destroy, keine erneute
       Eingangsanimation. Fuer den einen Fall, in dem sich NUR die Farben aendern: die Favicon-
       Farben des Markenschemas liegen beim ersten Zeichnen noch nicht im Zwischenspeicher, die
       Reihen stehen so lange in ihrer Typfarbe und werden nachtraeglich umgefaerbt. Ueber
       render() lief das auf zwei sichtbare Eingangsanimationen hinaus -- erst in Standardfarben,
       dann in Markenfarben, genau so gemeldet am 24.08.
       Faellt auf ein volles render() zurueck, sobald sich mehr als die Farben geaendert hat
       (andere Reihen, andere Reihenfolge, andere Werte): updateColors flickt nur, es fuegt nie
       eine Reihe hinzu und entfernt nie eine. Dieselbe Bauart wie updateColors an makeTypeChart. */
    function updateColors(built){
      if (!built || !built.datasets) return;
      if (!chart || !canvasHasLiveChart()){ render(built); return; }
      var alt = chart.data.datasets || [], neu = built.datasets;
      if (alt.length !== neu.length){ render(built); return; }
      /* Nur die Farben duerfen sich unterscheiden. Weicht irgendetwas anderes ab, ist es keine
         Umfaerbung mehr, sondern ein neuer Datensatz -- dann gehoert die Animation auch dazu. */
      for (var i = 0; i < neu.length; i++){
        if (String(alt[i].__id) !== String(neu[i].__id) ||
            String(alt[i].label) !== String(neu[i].label) ||
            (alt[i].data || []).join(",") !== (neu[i].data || []).join(",")){ render(built); return; }
      }
      if ((built.labels || []).join(",") !== (chart.data.labels || []).join(",")){ render(built); return; }
      var tc = themeColors();
      var single = (built.labels || []).length <= 1;
      for (var j = 0; j < neu.length; j++){
        var a = alt[j], n = neu[j];
        a.__baseColor = n.__baseColor;
        a.__favicon = n.__favicon;
        a.borderColor = n.__baseColor;
        a.pointBackgroundColor = single ? n.__baseColor : tc.bg;
        a.pointBorderColor = n.__baseColor;
        a.pointHoverBorderColor = n.__baseColor;
      }
      /* Die Hervorhebung neu setzen zu lassen, waere hier falsch: __activeId zeigt noch auf den
         Stand von vorher, und applyHighlight vergleicht genau darauf. Zuruecksetzen, damit ein
         spaeterer Legenden-Hover wieder greift. */
      if (chart.__activeId != null) chart.__activeId = undefined;
      lastSig = builtSig(built);
      lastBuilt = built;
      renderLegend(built.datasets);
      chart.update("none");   // "none" = ohne Animation, wie bei makeTypeChart
    }

    return {
      render: render,
      updateColors: updateColors,
      skeleton: skeleton,
      empty: empty,
      destroy: destroy,
      relayoutLegend: legendLayout,
      /* exposed because a component can drive the same highlight from outside the legend —
         visibility-chart cross-highlights the line when you hover the matching table row.
         Pass null to clear. */
      highlight: applyHighlight,
      resize: function(){ try { if (chart) chart.resize(); } catch(e){} },
      chart: function(){ return chart; }
    };
  }

  /* ---------- Ein Chart, das SICHTBAR wird ------------------------------------------------------
     Wird ein View eingeblendet, war sein Kasten vorher 0 breit. Chart.js merkt die neue Breite
     ueber seinen eigenen Beobachter, zeichnet aber erst resizeDelay (120ms) spaeter -- bis dahin
     steht das Chart in der ALTEN Groesse, und weil die zu klein ist, fehlt rechts der letzte
     Punkt der Zeitachse. Danach springt es. Genau so gemeldet: "beim Viewwechsel fehlt der ganz
     rechte x-Achsen-Punkt und kommt erst nach 200-300ms rein, dadurch verschiebt sich das Chart".

     resizeDelay bleibt -- er ist fuer das ZIEHEN am Fensterrand richtig und dort gemessen. Was
     fehlte, ist der Sonderfall "von 0 auf sichtbar": dort gibt es nichts zu sammeln, es ist ein
     einmaliger Sprung, und er gehoert in denselben Augenblick.
     update("none") dahinter, damit die 600ms-Einblendanimation nicht ein zweites Mal laeuft --
     genau die war das "2, 3 Mal rumruckeln", wenn die Legende an ist.
     Der Waechter gegen die Rekursion ist nicht Vorsicht, sondern noetig: chart.resize() aendert
     die Leinwand, und die liegt IM beobachteten Kasten. */
  function chartBeiSichtbarwerden(wrap, holChart){
    if (!wrap || !window.ResizeObserver) return null;
    var warBreit = wrap.clientWidth || 0, laeuft = false;
    var ro = new ResizeObserver(function(){
      var b = wrap.clientWidth || 0;
      var vorher = warBreit;
      warBreit = b;
      if (laeuft || b <= 0 || vorher > 0) return;
      var c = holChart && holChart();
      if (!c) return;
      laeuft = true;
      try { c.resize(); c.update("none"); } catch(e){}
      laeuft = false;
    });
    try { ro.observe(wrap); } catch(e){ return null; }
    return ro;
  }

  /* ---------- doughnut + bars ---------- */
  var RING_PX = 12, SEG_GAP = 6, CORNER = 4, HOVER = 12;
  var ringWidthPlugin = {
    id: "upRingWidth",
    beforeDatasetDraw: function(chart, args){
      var meta = chart.getDatasetMeta(args.index);
      meta.data.forEach(function(arc){ arc.innerRadius = Math.max(1, arc.outerRadius - RING_PX); });
    }
  };
  /* Chart.js spaces slices proportionally, so a 1% slice gets a hairline gap and a 40% slice a
     wide one. This redistributes the angles so every gap is the same number of pixels. */
  var constantGapPlugin = {
    id: "upConstantGap",
    beforeDatasetDraw: function(chart, args){
      var meta = chart.getDatasetMeta(args.index);
      if (!meta || !meta.data || !meta.data.length) return;
      var r = (meta.data[0] && meta.data[0].outerRadius) || 100;
      var gap = SEG_GAP / r, N = meta.data.length;
      var available = (Math.PI*2) - gap*N;
      var total = meta.total || chart.data.datasets[args.index].data.reduce(function(a,b){ return a + Number(b||0); }, 0);
      var cur = -Math.PI/2;
      meta.data.forEach(function(arc, i){
        var value = chart.data.datasets[args.index].data[i];
        var frac = total > 0 ? (value/total) : 0;
        var span = frac * available;
        arc.startAngle = cur + gap/2;
        arc.endAngle = cur + span + gap/2;
        arc.circumference = span;
        cur += span + gap;
      });
    }
  };

  /* nachkomma: Zahl oder Funktion. Ohne Angabe zwei -- so war es, als der Tooltip nur
     Prozentwerte in einer Genauigkeit kannte. */
  function makeDonutTooltip(container, getIsDark, getMode, nachkomma){
    function ttNachkomma(){
      if (typeof nachkomma === "number") return nachkomma;
      var n = nachkomma && nachkomma();
      return typeof n === "number" ? n : 2;
    }
    var state = { x:0, y:0, raf:null };
    function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }
    function lerp(a, b, t){ return a + (b-a)*t; }
    /* Element und Kinder GEMERKT statt bei jedem Aufruf gesucht, und die Themefarben nur neu
       geschrieben, wenn sich das Theme wirklich geaendert hat. Dieser Handler laeuft bei JEDER
       Mausbewegung ueber dem Doughnut; vorher waren das acht querySelector, vier vollstaendige
       cssText-Schreibzugriffe und ein erzwungener Layoutdurchgang pro Bewegung. */
    var el = null, kBox = null, kTitle = null, kSub = null, kVal = null, kDot = null, kLbl = null;
    var letztesTheme = null, letzteKennung = null, letzteBreite = 0, letzteHoehe = 0;
    return function(context){
      var chart = context.chart, tooltip = context.tooltip;
      var dark = !!getIsDark();
      if (!el || !el.parentNode){
        el = container.querySelector(".up-donut-tt");
      }
      if (!el){
        el = document.createElement("div");
        el.className = "up-donut-tt";
        /* KEINE transition auf transform: die Bewegung macht die rAF-Schleife unten selbst. Beides
           zugleich heisst, dass der Browser zu jedem neuen Wert eine eigene Interpolation startet,
           waehrend die Schleife schon interpoliert -- zwei Bewegungen gegeneinander, und genau so
           sah es auch aus. Die Deckkraft bleibt bei der CSS-Transition, die animiert niemand sonst. */
        el.style.cssText = "position:absolute;left:0;top:0;pointer-events:none;z-index:9999;opacity:0;transform:translate3d(0,0,0);transition:opacity 120ms ease;";
        el.innerHTML = '<div class="up-tt-box"><div class="up-tt-title"><span class="up-tt-dot"></span><span class="up-tt-lbl"></span></div><div class="up-tt-sub">Share:</div><div class="up-tt-val"></div></div>';
        chart.canvas.parentNode.appendChild(el);
        kBox = null; letztesTheme = null; letzteKennung = null;
      }
      if (!kBox){
        kBox = el.querySelector(".up-tt-box"); kTitle = el.querySelector(".up-tt-title");
        kSub = el.querySelector(".up-tt-sub"); kVal = el.querySelector(".up-tt-val");
        kDot = el.querySelector(".up-tt-dot"); kLbl = el.querySelector(".up-tt-lbl");
      }
      var textColor = dark ? "#e6e6e6" : "#1f1f1b";
      /* Die Farben MUESSEN nachgezogen werden -- einmalig beim Anlegen liess den Tooltip auf dem
         Theme haengen, das beim ersten Zeigen gerade galt. Nur eben nicht bei jeder Bewegung,
         sondern beim Wechsel. */
      if (letztesTheme !== (dark ? "d" : "l")){
        letztesTheme = dark ? "d" : "l";
        var boxBg = dark ? "#121212" : "#ffffff";
        var boxBorder = dark ? "" : "border:1px solid #e0e2e6;";
        var boxShadow = dark ? "box-shadow:0 4px 14px rgba(0,0,0,.25);" : "box-shadow:0 4px 14px rgba(0,0,0,.10);";
        var mutedColor = dark ? "#8a8a8a" : "#6f737c";
        kBox.style.cssText = "background:" + boxBg + ";color:" + textColor + ";" + boxBorder + "border-radius:16px;padding:12px 14px;font-family:Geist,system-ui,-apple-system,Segoe UI,Roboto,Arial;font-size:13px;line-height:1.35;" + boxShadow + "white-space:nowrap;";
        kTitle.style.cssText = "display:flex;align-items:center;gap:6px;font-weight:600;margin-bottom:6px;";
        kSub.style.cssText = "color:" + mutedColor + ";font-size:11px;";
        kVal.style.cssText = "color:" + textColor + ";";
        letzteKennung = null;         /* Groesse kann sich mit dem Rahmen geaendert haben */
      }
      if (tooltip.opacity === 0){ el.style.opacity = "0"; return; }
      var i = (tooltip.dataPoints && tooltip.dataPoints[0] && tooltip.dataPoints[0].dataIndex) || 0;
      var od = chart.data.datasets[0].originalData;
      var val = (od && od[i] != null) ? od[i] : (chart.data.datasets[0].data[i] || 0);
      var sliceColor = (chart.data.datasets[0].backgroundColor && chart.data.datasets[0].backgroundColor[i]) || textColor;
      /* The dot mirrors what's actually painted on the ring right now (dimmed grey included — it's
         a legend swatch, "this is this slice's current colour"). The NAME stays legible even while
         dimmed, so it reads off __realColors instead — a hovered, filtered-out slice's name should
         never itself look greyed out just because the ring paint is. */
      var realColors = chart.data.datasets[0].__realColors;
      var nameColor = (realColors && realColors[i]) || sliceColor;
      var isUrlMode = getMode && getMode() === "url";
      /* Inhalt nur neu schreiben, wenn er sich aendert. Solange der Zeiger im selben Segment
         bleibt, feuert Chart.js weiter -- der Text ist dann aber derselbe. */
      var kennung = i + "|" + (isUrlMode ? "u" : "n") + "|" + sliceColor + "|" + nameColor + "|" + val;
      if (kennung !== letzteKennung){
        letzteKennung = kennung;
        kDot.style.cssText = isUrlMode
          ? "width:6px;height:6px;border-radius:999px;flex:0 0 auto;background:" + sliceColor + ";display:inline-block;"
          : "display:none;";
        kLbl.style.color = nameColor;
        kLbl.textContent = chart.data.labels[i] || "";
        kVal.textContent = Number(val).toFixed(ttNachkomma()) + "%";
        /* Genau EINMAL messen, direkt nach der Aenderung -- ein Aufruf fuer beide Maasse. Der
           laufende translate3d faelscht sie nicht: verschieben veraendert keine Groesse, das
           Zuruecksetzen von left/top vorher ist damit ueberfluessig. */
        var dmass = el.getBoundingClientRect();
        letzteBreite = dmass.width; letzteHoehe = dmass.height;
      }
      var cx = chart.canvas.offsetLeft, cy = chart.canvas.offsetTop, ca = chart.chartArea;
      var caretX = cx + tooltip.caretX, caretY = cy + tooltip.caretY, m = 12;
      var tx = (caretX + letzteBreite + m > cx + ca.right) ? (caretX - letzteBreite - m) : (caretX + m);
      tx = clamp(tx, cx + ca.left + m, cx + ca.right - letzteBreite - m);
      var ty = caretY - letzteHoehe - m;
      if (ty < cy + ca.top + m) ty = caretY + m;
      ty = clamp(ty, cy + ca.top + m, cy + ca.bottom - letzteHoehe - m);
      if (state.raf) cancelAnimationFrame(state.raf);
      var sx = state.x || tx, sy = state.y || ty, st = performance.now(), d = 120;
      function stepFn(now){
        var t = Math.min(1, (now-st)/d), k = t < .5 ? 2*t*t : -1 + (4-2*t)*t;
        var nx = lerp(sx, tx, k), ny = lerp(sy, ty, k);
        el.style.transform = "translate3d(" + nx + "px," + ny + "px,0)"; el.style.opacity = "1";
        state.x = nx; state.y = ny;
        if (t < 1) state.raf = requestAnimationFrame(stepFn);
      }
      state.raf = requestAnimationFrame(stepFn);
    };
  }

  function donutSkeletonHtml(){
    var rows = [[110,34],[72,22],[90,22],[120,18],[80,18]];
    var legend = rows.map(function(r){
      return '<div class="up-sk-row"><span class="up-sk-dot"></span><span class="up-sk-lbl" style="width:' + r[0] + 'px"></span><span class="up-sk-pct" style="width:' + r[1] + 'px"></span></div>';
    }).join("");
    /* unique ids per call — fixed ids collide when two instances share a page and the mask
       silently fails, painting an unmasked grey box on every instance but the first */
    var u = Math.random().toString(36).slice(2);
    var mId = "up-sk-mask-" + u, gId = "up-sk-grad-" + u;
    return '<div class="up-donut-sk">' +
      '<div class="up-sk-chart"><svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">' +
        '<defs><mask id="' + mId + '"><circle cx="50" cy="50" r="38" fill="none" stroke="white" stroke-width="7"/></mask>' +
        '<linearGradient id="' + gId + '" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" class="up-sk-g0"/><stop offset="50%" class="up-sk-g1"/><stop offset="100%" class="up-sk-g0"/></linearGradient></defs>' +
        '<circle cx="50" cy="50" r="38" fill="none" class="up-sk-ring" stroke-width="7"/>' +
        '<rect x="-60" y="0" width="50" height="100" fill="url(#' + gId + ')" mask="url(#' + mId + ')"><animateTransform attributeName="transform" type="translate" from="-60 0" to="160 0" dur="1.2s" repeatCount="indefinite"/></rect>' +
      '</svg></div>' +
      '<div class="up-sk-legend">' + legend + '</div>' +
    '</div>';
  }

  /* Bar-mode counterpart to donutSkeletonHtml() — same shimmer treatment (.up-sk-* CSS), shaped
     like descending-width .up-bar-track rows instead of a ring + legend. */
  function barSkeletonHtml(){
    var widths = [92, 76, 61, 47, 34];
    var rows = widths.map(function(w){
      return '<div class="up-bar-sk-row"><span class="up-bar-sk-track" style="width:' + w + '%"></span></div>';
    }).join("");
    return '<div class="up-bars-sk">' + rows + '</div>';
  }

  /* ---------- makeTypeChart ----------
     One controller for both the doughnut and the bar view of the same [{name, share, color}] data,
     because a component always has both behind one switcher.
     cfg: { body, isDark(), isOwner(), mode(), total(), centerLabel, collapseAt, availHeight(),
            decimals }   -- decimals sind die Nachkommastellen im Tooltip, Zahl oder Funktion;
            ohne Angabe zwei, und das ist nirgends erwuenscht, also immer mitgeben
     Returns { renderDonut, renderBars, skeleton, empty, destroy, applyCollapse, resize, chart }. */
  function makeTypeChart(cfg){
    var body = cfg.body;
    var isDark = cfg.isDark || function(){ return false; };
    var isOwner = cfg.isOwner || function(){ return true; };
    var total = cfg.total || function(){ return 0; };
    var collapseAt = cfg.collapseAt != null ? cfg.collapseAt : 420;
    var chart = null;
    var donutTooltip = makeDonutTooltip(body, isDark, cfg.mode, cfg.decimals);
    /* Tracks what the LAST full render actually drew, so updateColors() (a dim-only re-colour, see
       below) can tell "same slices/bars, just different selection" from "genuinely new data" —
       only the former is safe to patch in place. */
    var lastKeys = null, lastMode = null;
    /* Was zuletzt gezeichnet wurde, damit ein Themenwechsel es wiederholen kann. Die Farben von
       Ringsegmenten, Balken, Beschriftung und Rahmen entstehen beim Zeichnen aus isDark() -- ohne
       Wiederholung bleiben sie stehen, waehrend die Karte ringsum ueber CSS laengst wechselt.
       Dieselbe Ueberlegung wie in makeLine, nur braucht der Doughnut seine Daten zurueck: er hat
       kein lastBuilt wie die Linie. */
    var letzteZeichnung = null;
    onTheme(function(){
      if (!isOwner() || !letzteZeichnung) return;
      if (letzteZeichnung.art === "donut") renderDonut(letzteZeichnung.daten);
      else renderBars(letzteZeichnung.daten);
    });
    function keysOf(d){ return (d || []).map(function(it){ return it.key; }).join(""); }

    function destroy(){
      if (chart){ try { chart.destroy(); } catch(e){} chart = null; }
      var cv = body.querySelector("canvas");
      if (cv && window.Chart && window.Chart.getChart){ var ex = window.Chart.getChart(cv); if (ex) try { ex.destroy(); } catch(e){} }
    }
    /* below collapseAt the legend drops under the doughnut instead of sitting beside it — mirrored
       onto .up-donut-sk too (when the skeleton is what's currently showing) so the loading circle
       is never a different size/layout than the real chart it's about to be replaced by. Both
       consumers already call this unconditionally on every resize, skeleton or not. */
    function applyCollapse(){
      var host = cfg.collapseHost || body;
      var collapsed = host.getBoundingClientRect().width < collapseAt;
      var layout = body.querySelector(".up-donut-layout");
      if (layout) layout.classList.toggle("is-collapsed", collapsed);
      var sk = body.querySelector(".up-donut-sk");
      if (sk) sk.classList.toggle("is-collapsed", collapsed);
    }
    function skeleton(){ destroy(); body.innerHTML = (cfg.chartMode && cfg.chartMode() === "bar") ? barSkeletonHtml() : donutSkeletonHtml(); }
    function empty(msg){ destroy(); body.innerHTML = '<div class="up-chart-empty">' + esc(msg || t_("No data")) + '</div>'; }
    function isEmpty(d){ return !d.length || d.every(function(x){ return !(Number(x.share) > 0); }); }

    function renderDonut(d){
      if (!isOwner()) return;
      destroy();
      d = d || [];
      letzteZeichnung = { art: "donut", daten: d };
      lastKeys = keysOf(d); lastMode = "donut";
      if (isEmpty(d)){ empty(); return; }
      body.innerHTML =
        '<div class="up-donut-layout">' +
          '<div class="up-donut-wrap"><canvas></canvas>' +
            '<div class="up-donut-center"><span class="n">' + esc(fmtTotal(total())) + '</span><span class="lbl">' + esc(cfg.centerLabel || "Citations") + '</span></div>' +
          '</div><div class="up-donut-legend"></div>' +
        '</div>';
      var clickable = !!cfg.onSliceClick;
      body.querySelector(".up-donut-legend").innerHTML = d.map(function(it){
        /* Bringt ein Eintrag ein Logo mit (it.logo), steht es zwischen Farbfleck und Name:
           Fleck, Luecke, Logo, Luecke, Name. Gebraucht vom Model Breakdown -- ein Modell erkennt
           man am Zeichen schneller als am Namen. Ohne logo bleibt die Zeile wie bisher. */
        var lg = it.logo ? String(it.logo) : "";
        if (lg.indexOf("//") === 0) lg = "https:" + lg;
        return '<div class="up-donut-legend-row' + (clickable && it.key !== "other" ? " is-clickable" : "") + '" data-type-key="' + esc(it.key || "") + '"><span class="up-donut-legend-chip" style="background:' + it.color + '"></span>' +
          (lg ? '<img class="up-donut-legend-logo" src="' + esc(lg) + '" alt="" loading="lazy"' +
                ' referrerpolicy="no-referrer" onerror="this.remove()"/>' : "") +
          '<span class="up-donut-legend-name">' + esc(it.name) + '</span>' +
          '<span class="up-donut-legend-pct">' + esc(fmtPct(it.share)) + '</span></div>';
      }).join("");
      if (clickable){
        Array.prototype.forEach.call(body.querySelectorAll(".up-donut-legend-row.is-clickable"), function(row){
          row.addEventListener("click", function(){ cfg.onSliceClick(row.getAttribute("data-type-key")); });
        });
      }
      applyCollapse();
      loadChartJs().then(function(){
        if (!isOwner()) return;
        var canvas = body.querySelector("canvas");
        if (!canvas) return;
        var ctx = canvas.getContext("2d");
        var origData = d.map(function(x){ return x.share; });
        /* floor the drawn value so a near-zero slice still gets a visible sliver; the tooltip
           reads originalData so the number stays truthful */
        var display = origData.map(function(v){ return Math.max(v, 1.0); });
        var allZero = origData.every(function(v){ return v <= 0; });
        window.Chart.defaults.color = isDark() ? "#a0a0a0" : "#6f737c";
        window.Chart.defaults.font = { family: "Geist, system-ui, -apple-system, Segoe UI, Roboto, Arial", size: 12 };
        try {
          chart = new window.Chart(ctx, {
            type: "doughnut",
            data: { labels: allZero ? ["—"] : d.map(function(x){ return x.name; }),
              datasets: [{ data: allZero ? [1] : display, originalData: allZero ? [0] : origData,
                backgroundColor: allZero ? [isDark() ? "rgba(255,255,255,0.06)" : "#eeeeee"] : d.map(function(x){ return x.color; }),
                /* Darken a dimmed (filtered-out) slice on hover instead of brightening it — it's
                   already a light neutral grey, so brightening read as "this slice turns nearly
                   white," not "this slice is being hovered." Real-colour slices still brighten. */
                hoverBackgroundColor: allZero ? [isDark() ? "rgba(255,255,255,0.06)" : "#eeeeee"] : d.map(function(x){ return x.__dimmed ? darken(x.color, 0.08) : brighten(x.color, 0.15); }),
                __realColors: allZero ? [] : d.map(function(x){ return x.__realColor || x.color; }),
                spacing: 0, borderWidth: 0, borderRadius: CORNER, hoverOffset: HOVER }] },
            plugins: [constantGapPlugin, ringWidthPlugin],
            /* resizeDelay: derselbe Grund wie beim Linienchart -- ohne ihn zeichnet Chart.js
               waehrend des Ziehens bei jeder Bildaenderung neu. */
            options: { responsive: true, maintainAspectRatio: false, resizeDelay: 120, layout: { padding: 8 },
              animation: { duration: 200, easing: "easeOutQuad" },
              plugins: { legend: { display:false }, tooltip: { enabled:false, external: donutTooltip } },
              onClick: (clickable && !allZero) ? function(evt, elements){
                if (!elements || !elements.length) return;
                var it = d[elements[0].index];
                if (it && it.key && it.key !== "other") cfg.onSliceClick(it.key);
              } : undefined,
              onHover: (clickable && !allZero) ? function(evt, elements){
                evt.native.target.style.cursor = (elements && elements.length) ? "pointer" : "default";
              } : undefined }
          });
        } catch(err){}
      })["catch"](function(err){
        /* Nicht still. clearExtras() hat Skelett und Leerflaeche vorher entfernt, die Legende
           steht schon -- bei einer Ablehnung bliebe eine Legende ueber einem blanken Canvas
           stehen, und das sieht aus wie ein leerer Datensatz statt wie ein Ladefehler. */
        if (window.console) console.error("[chart] Chart.js konnte nicht geladen werden. Das " +
          "Diagramm bleibt leer -- das ist KEIN fehlender Datensatz. Fehler:", err);
      });
    }

    function renderBars(d){
      if (!isOwner()) return;
      destroy();
      letzteZeichnung = { art: "bars", daten: d };
      d = (d || []).slice().sort(function(a, b){ return b.share - a.share; });
      if (isEmpty(d)){ empty(); return; }
      lastKeys = keysOf(d); lastMode = "bar";
      body.innerHTML = '<div class="up-bars">' + d.map(function(it){
        /* Label colour follows the fill's luminance so it stays readable: white on dark/mid fills,
           dark on genuinely light ones. Bar colours are identical in both themes, so this is
           per-bar, not per-theme. */
        var light = barIsLight(it.color);
        var txt = light ? "rgba(31,31,27,0.96)" : "rgba(255,255,255,0.95)";
        var txtPct = light ? "rgba(31,31,27,0.62)" : "rgba(255,255,255,0.75)";
        var outColor = isDark() ? "rgba(255,255,255,0.85)" : "var(--vc-text)";
        var outPctColor = isDark() ? "rgba(255,255,255,0.55)" : "var(--vc-muted)";
        /* Ein Logo vor dem Namen, wenn der Eintrag eines mitbringt -- dieselbe Regel wie in der
           Legende des Rings. Damit kann diese Balkenliste die des Model Breakdowns ersetzen, und
           beide Charts der Zeile animieren identisch (Balken waechst, dann faden die Texte ein). */
        var blg = it.logo ? String(it.logo) : "";
        if (blg.indexOf("//") === 0) blg = "https:" + blg;
        var logoHtml = blg ? '<img class="up-bar-logo" src="' + esc(blg) + '" alt="" loading="lazy"' +
                             ' referrerpolicy="no-referrer" onerror="this.remove()"/>' : "";
        return '<div class="up-bar-row' + (cfg.onSliceClick && it.key !== "other" ? " is-clickable" : "") + (it.__dimmed ? " is-dimmed" : "") + '" data-type-key="' + esc(it.key || "") + '"><div class="up-bar-track">' +
            '<div class="up-bar-fill" style="background:' + it.color + ';width:0%">' +
              '<span class="up-bar-name" style="color:' + txt + ';opacity:0">' + logoHtml + esc(it.name) + '</span>' +
              '<span class="up-bar-pct up-bar-pct-in" style="color:' + txtPct + ';opacity:0">' + esc(fmtPct(it.share)) + '</span>' +
            '</div>' +
            '<span class="up-bar-outside" style="opacity:0">' +
              '<span class="up-bar-name-out" style="color:' + outColor + '">' + logoHtml + esc(it.name) + '</span>' +
              '<span class="up-bar-pct-out" style="color:' + outPctColor + '">' + esc(fmtPct(it.share)) + '</span>' +
            '</span></div></div>';
      }).join("") + '</div>';

      var rows = Array.prototype.slice.call(body.querySelectorAll(".up-bar-row"));
      if (cfg.onSliceClick){
        rows.forEach(function(row){
          if (!row.classList.contains("is-clickable")) return;
          row.addEventListener("click", function(){ cfg.onSliceClick(row.getAttribute("data-type-key")); });
        });
      }
      var metrics = rows.map(function(row){
        return { nameW: measureText(row.querySelector(".up-bar-name")), pctW: measureText(row.querySelector(".up-bar-pct-in")) };
      });
      /* labels sit inside the bar when it's wide enough, otherwise they move outside next to it */
      function placeRow(row, m){
        var fill = row.querySelector(".up-bar-fill"), name = row.querySelector(".up-bar-name"),
            pin = row.querySelector(".up-bar-pct-in"), outside = row.querySelector(".up-bar-outside");
        if (!fill || !outside) return;
        var fillPx = fill.offsetWidth, needed = m.nameW + m.pctW + 12 + 20;
        if (fillPx >= needed){ if (name) name.style.opacity = "1"; if (pin) pin.style.opacity = "1"; outside.style.opacity = "0"; }
        else { if (name) name.style.opacity = "0"; if (pin) pin.style.opacity = "0"; outside.style.left = Math.round(fillPx + 8) + "px"; outside.style.opacity = "1"; }
      }
      function placeAll(){ rows.forEach(function(row, i){ placeRow(row, metrics[i]); }); }
      function fitBars(){
        if (!rows.length) return;
        var avail = cfg.availHeight ? cfg.availHeight() : body.clientHeight;
        if (!avail || avail <= 0) return;
        var rowH = rows[0].offsetHeight || 42;
        var maxVisible = Math.max(1, Math.floor(avail / rowH));
        for (var i = 0; i < rows.length; i++) rows[i].style.display = (i < maxVisible) ? "" : "none";
      }
      /* double rAF so the 0% width lands in a painted frame first — otherwise the browser
         coalesces both widths and the grow animation never runs */
      function wachsen(){
        requestAnimationFrame(function(){ requestAnimationFrame(function(){
          rows.forEach(function(row, i){ var fill = row.querySelector(".up-bar-fill"); if (fill) fill.style.width = Math.max(d[i].share, 0) + "%"; });
          fitBars();
        }); });
      }
      /* cfg.growGate: der Aufrufer bekommt den Starter und entscheidet, WANN die Balken wachsen.
         Gebraucht, wo das Umschalten von Ring auf Balken die Hoehe der Karte aendert: dort laufen
         sonst die Hoehenanimation und das Wachsen gleichzeitig, und fitBars() misst die Hoehe,
         waehrend sie noch die alte ist -- es blendet also Zeilen aus, die gleich Platz haetten, und
         der Umbruch passiert zweimal. Genau das war als "stockig" gemeldet.
         Ohne growGate bleibt es beim alten Verhalten: sofort. */
      if (typeof cfg.growGate === "function") cfg.growGate(wachsen); else wachsen();
      var placed = false;
      rows.forEach(function(row){
        var fill = row.querySelector(".up-bar-fill"); if (!fill) return;
        var done = false;
        fill.addEventListener("transitionend", function onEnd(e){
          if (e.propertyName !== "width" || done) return;
          done = true; fill.removeEventListener("transitionend", onEnd);
          var i = rows.indexOf(row); if (i >= 0) placeRow(row, metrics[i]);
        });
      });
      setTimeout(function(){ placed = true; fitBars(); placeAll(); }, 640);
      if (window.ResizeObserver){
        var ro = new ResizeObserver(function(){ fitBars(); if (placed) placeAll(); });
        ro.observe(body);
        rows.forEach(function(row){ var t = row.querySelector(".up-bar-track"); if (t) ro.observe(t); });
      }
    }

    /* Re-colours an already-rendered donut/bars in place — no destroy, no replayed entrance
       animation, no DOM node replacement — for when only WHICH items are dimmed changed (a type-
       filter toggle), not the underlying data. A full renderDonut()/renderBars() call replays the
       entrance animation every time it runs (donut: a fresh 200ms fade-in; bars: width resets to
       0% and regrows, core.css .up-bar-fill transition) — correct for genuinely new data, but on
       every single filter click it read as the whole chart flashing/highlighting before settling.
       Falls back to a full render if the item SET actually changed (different keys or order, not
       just which of the same items are selected) — updateColors only ever patches, never adds or
       removes bars/slices. */
    function updateColors(d){
      d = d || [];
      var normalized = (lastMode === "bar") ? d.slice().sort(function(a, b){ return b.share - a.share; }) : d;
      if (keysOf(normalized) !== lastKeys){
        if (lastMode === "bar") renderBars(d); else renderDonut(d);
        return;
      }
      if (lastMode === "bar"){
        var rows = Array.prototype.slice.call(body.querySelectorAll(".up-bar-row"));
        rows.forEach(function(row, i){
          var it = normalized[i]; if (!it) return;
          var fill = row.querySelector(".up-bar-fill");
          if (fill) fill.style.background = it.color;
          row.classList.toggle("is-dimmed", !!it.__dimmed);
        });
      } else if (chart){
        chart.data.datasets[0].backgroundColor = normalized.map(function(x){ return x.color; });
        chart.data.datasets[0].hoverBackgroundColor = normalized.map(function(x){ return x.__dimmed ? darken(x.color, 0.08) : brighten(x.color, 0.15); });
        chart.data.datasets[0].__realColors = normalized.map(function(x){ return x.__realColor || x.color; });
        chart.update("none");
      }
    }

    return {
      renderDonut: renderDonut,
      renderBars: renderBars,
      updateColors: updateColors,
      skeleton: skeleton,
      empty: empty,
      destroy: destroy,
      applyCollapse: applyCollapse,
      resize: function(){ try { if (chart) chart.resize(); } catch(e){} },
      chart: function(){ return chart; }
    };
  }

  /* Suppresses :hover-driven repaints on table rows while the page is actively scrolling — one
     page-global listener, install-once like the tooltip's own scroll listener above, so it works
     no matter how many components/roots share the page (and however many times core.js itself
     gets re-evaluated by them).
     Content sliding under a stationary cursor still fires real mouseenter/mouseleave in every
     browser, and .up-row:hover changes `background`, a paint-triggering property, not a cheap
     compositor-only one (transform/opacity) — with the cursor parked over a tall table during a
     scroll that's a full-width paint on every row that crosses it, which is what "scrolling isn't
     smooth" actually was. pointer-events:none on the tbody during a scroll (removed ~150ms after
     the last scroll event) blocks hover-matching entirely for the duration, taking every
     hover-driven style with it (row background, chip hover, the goto arrow) without having to
     enumerate and override each one — and without touching click handling, since a genuine row
     click can't land mid-scroll anyway. */
  if (!window.__upScrollHoverBound){
    window.__upScrollHoverBound = true;
    var scrollHoverRaf = null, scrollHoverSettle = null;
    window.addEventListener("scroll", function(){
      if (!scrollHoverRaf){
        scrollHoverRaf = requestAnimationFrame(function(){
          scrollHoverRaf = null;
          document.documentElement.classList.add("up-is-scrolling");
        });
      }
      clearTimeout(scrollHoverSettle);
      scrollHoverSettle = setTimeout(function(){
        document.documentElement.classList.remove("up-is-scrolling");
      }, 150);
    }, { capture: true, passive: true });
  }

  /* Theme-Umschalter fuer ALLE Komponenten auf der Seite, per JS statt per Bubble-Attribut.
     Warum das existiert: `data-isdark` als dynamischer Bubble-Ausdruck im Markup zwingt Bubble,
     das ganze HTML-Element bei jeder Aenderung neu zu rendern ($.fn.html) — und das reisst die
     Komponente komplett ab und baut sie neu auf, mitten in einer eventuell laufenden Animation.
     Dasselbe gilt fuer data-processing (dafuer gibt es die set*Loading-Funktionen). Setzt man das
     Attribut stattdessen von hier aus per JS, sieht Bubble davon nichts, aber der ohnehin schon
     vorhandene MutationObserver jeder Komponente (attributeFilter: data-isdark) reagiert normal.
     Das Markup kann damit vollstaendig statisch bleiben. Siehe STYLEGUIDE 43. */
  function upstreemSetTheme(isDarkVal){
    var v = isYes(isDarkVal) ? "yes" : "no";
    var roots = document.querySelectorAll(".up-root");
    for (var i = 0; i < roots.length; i++){
      if (roots[i].getAttribute("data-isdark") !== v) roots[i].setAttribute("data-isdark", v);
    }
    return roots.length;
  }
  window.upstreemSetTheme = upstreemSetTheme;

  /* ---------------- theme guard (global, no per-component wiring) ----------------
     Every component derives data-theme from the data-isdark attribute Bubble writes. The moment
     Bubble re-renders an element, that attribute is briefly absent or empty -- and the usual
     "if (isDark) set else REMOVE" then strips data-theme and the component paints its light
     palette for a frame or two. That is the white flash: not a theme change, a theme momentarily
     going missing.
     localStorage.pref_theme is the app's own record of what the user actually chose, so it can
     answer the question the attribute cannot at that instant. Two jobs:
       - at load, stamp the stored theme on every .up-root, so a page opens dark instead of
         opening light and correcting itself once Bubble's attributes arrive
       - afterwards, whenever a root LOSES data-theme while the stored preference is dark, put it
         back on the same frame the observer sees it go
     Deliberately one-directional: it only ever restores what pref_theme says. A genuine switch to
     light writes "light" to that key, and then this does nothing -- it cannot pin a page dark
     against the user's own choice. A component that sets data-theme itself always wins; this only
     fills the gap where the attribute is absent. */
  function readPrefTheme(){
    try { var v = String(window.localStorage.getItem("pref_theme") || "").trim().toLowerCase();
          return (v === "dark" || v === "light") ? v : ""; } catch(e){ return ""; }
  }
  function stampTheme(el){
    if (!el || !el.classList || !el.classList.contains("up-root")) return;
    if (readPrefTheme() !== "dark") return;
    /* Nur wo das Attribut FEHLT. Genau das behauptet der Kommentar oben schon ("this only fills the
       gap where the attribute is absent", "a component that sets data-theme itself always wins") --
       der Code tat es aber nicht: er schrieb dark ueber jeden Wert, der nicht dark war, also auch
       ueber ein ausdrueckliches light. Aufgefallen an der Landingpage: die setzt ihren Komponenten
       data-theme="light", weil sie immer hell ist, und der Waechter drehte sie im Sekundentakt
       zurueck auf dunkel.
       Fuer die App aendert sich nichts: eine frisch von Bubble eingesetzte Wurzel hat gar kein
       data-theme, und genau die Luecke fuellt der Waechter weiter. Steht dort ausdruecklich light,
       hat das jemand so gewollt. */
    var jetzt = el.getAttribute("data-theme");
    if (jetzt == null || jetzt === "") el.setAttribute("data-theme", "dark");
  }
  function themeGuard(){
    if (window.__upThemeGuard) return;
    window.__upThemeGuard = true;
    function sweep(){
      var all = document.querySelectorAll(".up-root");
      for (var i = 0; i < all.length; i++) stampTheme(all[i]);
    }
    sweep();
    try {
      new MutationObserver(function(recs){
        if (readPrefTheme() !== "dark") return;
        for (var i = 0; i < recs.length; i++){
          var r = recs[i];
          if (r.type === "attributes"){ stampTheme(r.target); continue; }
          for (var j = 0; j < r.addedNodes.length; j++){
            var n = r.addedNodes[j];
            if (n.nodeType !== 1) continue;
            stampTheme(n);
            if (n.querySelectorAll){
              var kids = n.querySelectorAll(".up-root");
              for (var k = 0; k < kids.length; k++) stampTheme(kids[k]);
            }
          }
        }
      }).observe(document.documentElement, {
        subtree: true, childList: true, attributes: true, attributeFilter: ["data-theme"]
      });
    } catch(e){}
  }
  themeGuard();

  /* ---------------- one dropdown open at a time, app-wide ----------------
     Each open dropdown registers its panel element and a close callback. Opening a new one closes
     every other open panel EXCEPT its own ancestors -- a menu opened from inside another menu is a
     child and both have to stay up. Ancestry is read from the live DOM (panel.contains), not from
     a declared parent, so nothing has to be wired up between components that know nothing about
     each other.
     Panels that live outside their trigger's DOM subtree (body-portaled ones) would look like
     unrelated siblings here, so a caller can pass ownerEl -- the element the panel logically hangs
     off -- and containment is tested against that instead. */
  /* Auf window, NICHT in dieser IIFE. Der Asset-Loader dedupliziert nach URL -- stehen auf einer
     Seite zwei Elemente mit unterschiedlichem data-cdn-pin, laedt core.js ZWEIMAL, und jede Kopie
     haette ihre eigene Liste. Genau daher blieb ein Topics-Panel offen waehrend der Kalender
     aufging: die beiden Komponenten hingen an verschiedenen Registries. Auf window teilen sich
     alle Kopien dieselbe. */
  var OPEN_DD = (window.__upOpenDropdowns = window.__upOpenDropdowns || []);
  /* ================================================================
     menuEscape — ein Dropdown im Drawer sichtbar halten, OHNE die Stapelung der Host-App
     anzufassen.

     Vorgeschichte, damit das nicht ein viertes Mal falsch angegangen wird: das Panel stand
     zuletzt auf z-index 99998 und wurde trotzdem ab halber Hoehe von Nachbargruppen des Drawers
     mit z-index 9 und 18 ueberdeckt. Neun schlaegt 99998, wenn das Panel in einem
     Stacking-Context sitzt, der als GANZES darunter rangiert -- innerhalb eines Kontexts ist die
     Zahl des Panels gegenueber allem AUSSERHALB bedeutungslos. Drei Runden am Panel zu drehen
     konnte darum nie wirken. Der naechste Versuch, den Vorfahren zu heben, hat die ganze App
     lahmgelegt (siehe unclipAncestors) -- core.js kennt die Ebenen des Hosts nicht und darf sie
     nicht umschreiben.

     Der Ausweg ist der TOP LAYER: popover="manual" + showPopover() zeichnet das Element ueber
     allem, komplett ausserhalb jeder z-index-Rechnung, und es bleibt dabei an seiner Stelle im
     DOM -- also erbt es Theme und CSS-Variablen weiter aus .up-root, ohne Portal und ohne
     Theme-Sync. Es wird NICHTS am Host geschrieben.

     Bewusst nur dort, wo es gebraucht wird: nur wenn ein Vorfahr position:fixed ist oder einen
     z-index ab 1000 traegt -- die Signatur eines Drawers / einer FloatingGroup. Auf einer
     normalen Seite passiert gar nichts und die Menues bleiben, was sie sind: position:absolute
     Kinder ihres Triggers, die beim Scrollen im selben Frame mitwandern, ohne eine Zeile JS.
     Nur im Top Layer muss die Position nachgefuehrt werden, und nur dort ist das der Preis wert.
     ================================================================ */
  var OVERLAY_Z = 1000;
  function inOverlay(el){
    var guard = 0;
    while (el && el !== document.body && el !== document.documentElement && guard++ < 60){
      var cs; try { cs = window.getComputedStyle(el); } catch(e){ return false; }
      if (cs.position === "fixed") return true;
      var z = parseInt(cs.zIndex, 10);
      if (!isNaN(z) && z >= OVERLAY_Z) return true;
      el = el.parentElement;
    }
    return false;
  }

  /* Die Freigabe haengt am PANEL, nicht am Aufrufer: ein Menue wird an fuenf Stellen geschlossen
     (makePopover.close, closeAll, der globale pointerdown-Handler, die POPOVERS-Schleife in
     dropdownOpened, ddClose), und vier davon setzen nur Klassen. Wuerde die Freigabe nur an einer
     davon haengen, bliebe das Panel unsichtbar im Top Layer stehen und wuerde Klicks fressen.
     Eine Funktion, die JEDER Schliesspfad ruft, und die nichts tut wenn es nichts zu tun gibt. */
  function dropEscape(panel){
    if (!panel || !panel.__upEscapeRelease) return;
    var fn = panel.__upEscapeRelease;
    panel.__upEscapeRelease = null;
    try { fn(); } catch(e){}
  }

  /* Die Quick-Actions-Palette muss GANZ vorne bleiben. Sie steht auf z-index 2147483647, und der
     Top Layer schlaegt jede Zahl -- ein eskaliertes Dropdown lag damit vor der Palette. Statt die
     Palette selbst in den Top Layer zu heben (ihr Overlay ist ein gewachsenes Vollbild-Layout, das
     die UA-Regeln fuer [popover] -- margin:auto, width:fit-content, eigener Rahmen -- zerlegen
     wuerden): waehrend sie offen ist, wird gar nicht erst eskaliert. Sie deckt ohnehin alles ab,
     also gibt es dahinter nichts zu retten. Beim Oeffnen schliesst die Palette zusaetzlich alle
     Dropdowns (quick-actions.js), damit kein bereits eskaliertes Panel in ihre Sitzung ueberlebt. */
  function paletteOpen(){
    try { return !!document.querySelector(".mqa-overlay.is-open"); } catch(e){ return false; }
  }

  function menuEscape(panel, owner){
    if (!panel || !owner || typeof panel.showPopover !== "function") return null;
    if (panel.__upEscapeRelease) return null;
    if (paletteOpen()) return null;
    /* Ausdrueckliche Abwahl fuer Panels, die selbst schon in einer Overlay-Flaeche haengen und
       dort nichts zu befreien haben. inOverlay() sagt nur "ein Vorfahre ist position:fixed" --
       fuer die Sidebar trifft das zu (die Leiste IST fixed), aber sie schneidet nichts ab und
       ihre Menues liegen ohnehin ueber allem. Die Eskalation friert die Position dagegen auf den
       Messwert beim Oeffnen ein; bei einer Leiste, die ihre Breite animiert, landet das Panel
       dann sichtbar daneben (gemessen: 246px statt 72px neben der eingeklappten Leiste). */
    if (panel.getAttribute("data-up-noescape") != null) return null;
    if (!inOverlay(owner.parentElement || owner)) return null;

    /* ---- Ausrichtung MESSEN, nicht annehmen ----
       Die Panels der App liegen NICHT alle auf derselben Seite: .up-ment-menu und .up-filter-menu
       stehen auf right:0, die drei Filter-Dropdowns, add-prompts und der Kalender auf left:0 --
       und der Kalender kippt ueber .udr-menu.is-right situativ sogar um. Eine fest verdrahtete
       Seite (der erste Versuch war "immer rechtsbuendig") reisst genau die left:0-Panels auf die
       falsche Seite; sichtbar als "kurz richtig, dann springt es nach links".
       Also wird die Ruhelage abgegriffen, bevor irgendetwas umgestellt wird: der Abstand der
       Panel-Kanten zu den Trigger-Kanten. Die kleinere der beiden Distanzen ist die Kante, an der
       das Panel per CSS haengt -- an der wird es auch im Top Layer gehalten. Damit stimmt jedes
       Panel von selbst, auch ein zukuenftiges mit einer dritten Idee.
       Gemessen wird OHNE jeden Schreibzugriff auf transform. Der erste Ansatz war, transform zum
       Messen kurz auf "none" zu setzen -- das ist hier besonders heikel, weil die drei
       Filter-Dropdowns .is-shown BEREITS gesetzt haben, wenn sie dropdownOpened rufen: die
       Einblend-Transition auf transform laeuft dann schon, und ein Schreibzugriff bricht sie ab.
       Stattdessen offsetLeft/offsetTop/offsetWidth/offsetHeight gegen den offsetParent: das sind
       Layoutwerte, per Definition transform-frei, und fuer ein absolut positioniertes Kind eines
       position:relative-Wrappers ist offsetLeft exakt der benutzte left-Wert ab dessen Padding-
       Kante. clientLeft/clientTop des offsetParent steuern dessen Rahmenbreite bei. */
    function restBox(){
      var op = panel.offsetParent;
      if (!op) return panel.getBoundingClientRect();          // Notnagel, sollte nie greifen
      var opr = op.getBoundingClientRect();
      var l = opr.left + op.clientLeft + panel.offsetLeft;
      var t = opr.top  + op.clientTop  + panel.offsetTop;
      return { left: l, top: t, right: l + panel.offsetWidth, bottom: t + panel.offsetHeight };
    }
    var r0 = owner.getBoundingClientRect();
    var p0 = restBox();
    var offLeft  = p0.left  - r0.left;
    var offRight = p0.right - r0.right;
    var offTop   = p0.top   - r0.top;
    var anchorRight = Math.abs(offRight) <= Math.abs(offLeft);

    var prevPopover = panel.getAttribute("popover");
    var prev = { position: panel.style.position, left: panel.style.left, top: panel.style.top,
                 right: panel.style.right, bottom: panel.style.bottom, margin: panel.style.margin,
                 width: panel.style.width, maxHeight: panel.style.maxHeight };
    panel.setAttribute("popover", "manual");
    try { panel.showPopover(); } catch(e){
      if (prevPopover == null) panel.removeAttribute("popover"); else panel.setAttribute("popover", prevPopover);
      return null;
    }
    /* Der UA-Stylesheet gibt jedem [popover] margin:auto und inset:0 mit -- ohne das
       Zuruecksetzen landet das Panel zentriert in der Mitte des Bildschirms. */
    panel.style.margin = "0";
    panel.style.position = "fixed";
    panel.style.right = "auto";
    panel.style.bottom = "auto";

    /* Die Groesse kommt aus offsetWidth/offsetHeight, NICHT aus getBoundingClientRect -- und das
       ist der Kern der Sache: das Panel traegt beim Oeffnen translateY(-4px) scale(0.985) und
       faehrt das in 140ms auf die Identitaet. getBoundingClientRect rechnet den Transform mit,
       eine damit gemessene Breite ist um 1.5% zu klein und die daraus berechnete Kante landet
       2-3px daneben -- je nachdem, in welchem Moment der Animation gemessen wurde.
       Der erste Reparaturversuch war, den Transform zum Messen kurz auf "none" zu setzen. Das
       macht es schlimmer: transform IST die animierte Eigenschaft, ein Schreibzugriff darauf
       bricht die laufende Transition ab. Gemessen: das Panel blieb dauerhaft auf scale(0.985)
       stehen, obwohl .is-shown gesetzt war und die Regel gewann.
       offsetWidth/offsetHeight sind Layoutwerte und per Definition transform-unabhaengig -- kein
       Schreibzugriff noetig, keine Transition in Gefahr. Preis ist die Rundung auf ganze Pixel,
       also maximal 1px, unsichtbar. */
    var pw = 0, ph = 0;
    function measure(){ pw = panel.offsetWidth; ph = panel.offsetHeight; }
    measure();

    var raf = null;
    function place(){
      raf = null;
      if (!document.contains(owner)){ return; }
      var r = owner.getBoundingClientRect();
      var vw = window.innerWidth || document.documentElement.clientWidth;
      var vh = window.innerHeight || document.documentElement.clientHeight;
      /* An der gemessenen Kante halten. Bei einem rechts verankerten Panel aus der rechten Kante
         rechnen, sonst waechst es bei nachtraeglich eingefuelltem Inhalt in die falsche Richtung
         (die drei Filter-Panels und der Kalender bauen ihre Liste erst NACH dem Oeffnen). */
      var left = anchorRight ? (r.right + offRight - pw) : (r.left + offLeft);
      left = Math.max(8, Math.min(left, vw - pw - 8));
      var top = r.top + offTop;
      if (top + ph > vh - 8){
        /* Nach oben spiegeln, mit demselben Abstand zum Trigger. offTop ist der Abstand von der
           Trigger-OBERkante, der reine Spalt darunter ist also offTop minus Triggerhoehe. */
        var gap = offTop - r.height;
        var above = r.top - gap - ph;
        top = above >= 8 ? above : Math.max(8, vh - ph - 8);
      }
      panel.style.left = Math.round(left) + "px";
      panel.style.top = Math.round(top) + "px";
    }
    function schedule(){ if (raf) return; raf = requestAnimationFrame(place); }
    place();

    /* capture:true faengt das Scrollen JEDES Vorfahren -- Drawer, #main, Fenster -- ohne dass
       hier bekannt sein muesste, welcher davon tatsaechlich scrollt. */
    window.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    /* Und auf Groessenaenderungen des Panels selbst: die drei Filter-Dropdowns, der Kalender und
       add-prompts fuellen ihre Liste erst NACH dem Oeffnen, ein Suchfeld filtert sie danach weiter.
       Ohne das bliebe die Position auf dem Mass des leeren Panels stehen. */
    var ro = null;
    if (window.ResizeObserver){
      ro = new ResizeObserver(function(){ measure(); schedule(); });
      try { ro.observe(panel); } catch(e){ ro = null; }
    }

    panel.__upEscapeRelease = function release(){
      if (raf){ cancelAnimationFrame(raf); raf = null; }
      if (ro){ try { ro.disconnect(); } catch(e){} ro = null; }
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
      try { if (panel.matches(":popover-open")) panel.hidePopover(); } catch(e){}
      if (prevPopover == null) panel.removeAttribute("popover"); else panel.setAttribute("popover", prevPopover);
      panel.style.position = prev.position; panel.style.left = prev.left; panel.style.top = prev.top;
      panel.style.right = prev.right; panel.style.bottom = prev.bottom; panel.style.margin = prev.margin;
    };
    return panel.__upEscapeRelease;
  }

  function ddClose(entry){
    var i = OPEN_DD.indexOf(entry);
    if (i >= 0) OPEN_DD.splice(i, 1);
    if (entry) dropEscape(entry.panel);
  }
  function dropdownOpened(panel, close, ownerEl){
    var self = { panel: panel, close: close, owner: ownerEl || panel };
    for (var i = OPEN_DD.length - 1; i >= 0; i--){
      var o = OPEN_DD[i];
      if (o === self) continue;
      /* keep it open if it is an ANCESTOR of the one being opened */
      var isAncestor = false;
      try { isAncestor = !!(o.panel && (o.panel.contains(self.owner) || o.panel.contains(panel))); } catch(e){}
      if (isAncestor) continue;
      OPEN_DD.splice(i, 1);
      try { o.close(); } catch(e){}
    }
    /* ...and the popover list too. POPOVERS lives on window, so this reaches popovers built by a
       DIFFERENT core.js copy -- the case where a page carries two data-cdn-pin values and the
       other copy's makePopover has no idea this registry exists. Same ancestor rule: a popover
       whose menu CONTAINS the thing being opened is a parent and stays up. */
    for (var k = 0; k < POPOVERS.length; k++){
      var p = POPOVERS[k];
      if (!p.wrap || !document.contains(p.wrap)){ POPOVERS.splice(k--, 1); continue; }
      if (!p.wrap.classList.contains("is-open")) continue;
      if (p.wrap === self.owner) continue;
      var parent = false;
      try { parent = !!(p.menu && (p.menu.contains(self.owner) || p.menu.contains(panel))); } catch(e){}
      if (parent) continue;
      dropEscape(p.menu);
      p.wrap.classList.remove("is-open");
      p.menu.classList.remove("is-shown");
      p.menu.setAttribute("aria-hidden", "true");
      if (p.onClose) { try { p.onClose(false); } catch(e){} }
    }
    OPEN_DD.push(self);
    /* Einen Frame spaeter eskalieren, nicht sofort -- und das ist die Lehre aus einer ganzen
       Fehlerrunde. Die Komponenten sind mit dem Oeffnen noch nicht fertig, wenn sie hier
       ankommen: die drei Filter-Dropdowns und der Kalender entscheiden ERST DANACH, ob das Panel
       an die rechte Kante kippt (.is-right), und mehrere fuellen ihre Liste ebenfalls erst
       danach. Eine Messung in dieser Sekunde erwischt eine Ruhelage, die es gleich nicht mehr
       gibt -- gemessen: der Kalender landete 366px daneben, weil .is-right nach der Messung kam.
       Ein rAF spaeter steht der Zustand. Sichtbar ist die Verzoegerung nicht: das Panel blendet
       ohnehin ueber 140ms ein.
       setTimeout(0) und NICHT requestAnimationFrame: rAF laeuft nur, wenn das Dokument
       tatsaechlich gezeichnet wird. In einem Hintergrund-Tab -- oder in einem Bubble-Reusable,
       das gerade nicht sichtbar ist -- tickt es nicht, und das Panel wuerde nie eskalieren.
       setTimeout reicht auch voellig: die Komponenten erledigen ihre Oeffnungsarbeit synchron im
       selben Task, ein Makrotask danach ist der Zustand fertig.
       Der Wiedereintritt wird geprueft -- bis dahin kann das Dropdown laengst wieder zu sein
       (Doppelklick, oder ein anderes Dropdown das dieses schliesst). */
    setTimeout(function(){
      if (OPEN_DD.indexOf(self) === -1) return;      // inzwischen geschlossen
      menuEscape(self.panel, self.owner);
    }, 0);
    return function(){ ddClose(self); };
  }
  /* ---------- Ansichtswechsel der Host-App ----------
     Die App wechselt die Ansicht mit showView("brands"). Fuer eine Komponente ist das unsichtbar:
     Bubble blendet eine Gruppe aus, und was am document.body haengt -- Popover, Bulk-Bars,
     Dialoge -- bleibt einfach stehen, weil es gar nicht in der ausgeblendeten Gruppe liegt.
     Der Beobachter, der versteckte Wurzeln erkennt, greift nicht zuverlaessig: je nachdem,
     welchen Vorfahren Bubble umschaltet, entsteht im beobachteten Teilbaum keine Mutation.

     Darum hier der direkte Weg: showView wird umschlossen, sobald es existiert. Der Wrapper
     ruft das Original unveraendert auf und meldet den Wechsel vorher an alle Angemeldeten.
     Kein Poll im Betrieb, kein Umschreiben fremder Logik, kein veraendertes Verhalten von
     showView selbst.

     Kommt showView erst spaeter (die Host-App definiert es in einem eigenen Skript), wird es
     kurz gesucht und danach aufgegeben -- ohne showView gibt es auch nichts zu melden. */
  var VIEW_SUBS = [];
  function onViewChange(fn){
    if (typeof fn === "function") VIEW_SUBS.push(fn);
    return function(){ var i = VIEW_SUBS.indexOf(fn); if (i >= 0) VIEW_SUBS.splice(i, 1); };
  }
  function fireViewChange(name){
    closeAllDropdowns();
    for (var i = VIEW_SUBS.length - 1; i >= 0; i--){
      try { VIEW_SUBS[i](name); }
      catch(e){ if (window.console) console.warn("[view] ein Aufraeumer hat geworfen:", e); }
    }
  }
  function wrapShowView(){
    var orig = window.showView;
    if (typeof orig !== "function") return false;
    if (orig.__upWrapped) return true;
    var wrapped = function(){
      try { fireViewChange(arguments.length ? String(arguments[0]) : ""); } catch(e){}
      return orig.apply(this, arguments);
    };
    wrapped.__upWrapped = true;
    wrapped.__upOriginal = orig;
    try { window.showView = wrapped; } catch(e){ return false; }
    return true;
  }
  (function watchForShowView(triesLeft){
    if (wrapShowView()) return;
    if (triesLeft <= 0) return;
    setTimeout(function(){ watchForShowView(triesLeft - 1); }, 200);
  })(50);

  function closeAllDropdowns(){
    var list = OPEN_DD.slice();
    OPEN_DD.length = 0;
    for (var i = 0; i < list.length; i++){ try { list[i].close(); } catch(e){} }
  }

  /* The registry's OWN outside-press handler -- and the reason the topics panel stayed open while
     the calendar opened, through three rounds of looking in the wrong place.

     Until now this list had no outside-press handling at all: each component brought its own
     document listener, and every one of them is bubble-phase. But openers all over this library
     call e.stopPropagation() on their trigger (date-range.js:371 does, so does the topics trigger
     itself), and a stopped event never reaches ANY of those listeners. So pressing the calendar
     trigger was simply invisible to the topics panel, while the reverse worked -- makePopover
     listens on pointerdown, which those triggers do not stop. Exactly the asymmetry that was
     reported: topics -> calendar closed, calendar -> topics did not.

     CAPTURE phase is the whole point. Capture runs on the way DOWN, before any target handler
     exists to call stopPropagation, so no component can hide a press from this no matter what it
     does with the event. pointerdown, not click, for the same reason makePopover uses it: the
     decision belongs at gesture start, not wherever a drag happens to release.

     A press INSIDE a dropdown's own panel or on its own trigger is not "outside" -- that is what
     keeps a click on a topic row, or a second click on the trigger to toggle it shut, working. */
  if (!window.__upDdOutsideBound){
    window.__upDdOutsideBound = true;
    document.addEventListener("pointerdown", function(e){
      if (!OPEN_DD.length) return;
      /* A press inside a body-mounted overlay is not "outside" anything. These layers are opened
         BY a dropdown and live outside its DOM subtree by construction -- the topic modal opened
         from the topics filter's New Topic button is the case that broke: pressing Save in the
         modal read as a press outside the panel, so the panel shut behind it. Checked once for
         the whole loop rather than per entry: an overlay is above everything, so it is outside
         nothing. */
      var inOverlay = false;
      try {
        inOverlay = !!(e.target.closest && e.target.closest(
          ".up-topicmodal-backdrop, .up-modal, .up-portal, .uo-portal, .upr-portal, [popover]"));
      } catch(err){}
      if (inOverlay) return;
      for (var i = OPEN_DD.length - 1; i >= 0; i--){
        var o = OPEN_DD[i], inside = false;
        try {
          inside = !!((o.panel && o.panel.contains(e.target)) ||
                      (o.owner && o.owner.contains(e.target)));
        } catch(err){}
        if (inside) continue;
        OPEN_DD.splice(i, 1);
        try { o.close(); } catch(err){}
      }
    }, true);
  }

  /* ---------------------------------------------------------------------------------------------
     Topic store -- ONE list of topics per page, shared by every picker on it.

     Before this, each topics dropdown was fed individually: setTopicsFilterTopics(instanceId, ...)
     once per instance, which meant the Bubble workflow had to name every placement and had to be
     edited again whenever a new one appeared. Worse, it could only reach instances that already
     existed: Bubble re-renders its HTML elements repeatedly while dynamic expressions resolve
     (measured: three boots across ~8s), and anything inside a drawer is not built until the drawer
     opens -- those placements simply missed the call and stayed empty.

     A store fixes both. Bubble calls setUpstreemTopics(list) ONCE, no instance id. Consumers read
     getTopics() when they mount -- whenever that happens to be -- and subscribe for later updates.

     Lives on window, not in this closure: two elements with different data-cdn-pin values load
     core.js twice, and two stores would put half the page's dropdowns on stale data. Same lesson
     the dropdown registry above already cost.

     Invalidation runs the other way: topicsChanged() calls a single well-known Bubble function,
     bubble_fn_upTopicsChanged, which the page answers by re-running its RPC and calling
     setUpstreemTopics again. Every component that creates, edits, deletes or reassigns a topic
     calls it, so no mutation site needs to know which pickers exist -- one fan-in, one fan-out.
     Resolved through resolveBubbleFn, i.e. across window.top and every reachable iframe, so it
     works from inside a Bubble reusable element or popup where a page-level custom event cannot
     be triggered directly. */
  var TOPICS = (window.__upTopics = window.__upTopics || { list: [], at: 0, seq: 0, subs: [] });

  function getTopics(){ return TOPICS.list.slice(); }
  function topicsAge(){ return TOPICS.at ? (nowMs() - TOPICS.at) : Infinity; }
  function nowMs(){ return (window.Date && Date.now) ? Date.now() : +new Date(); }

  /* owner is the component root. A subscriber whose root has left the document is dropped on the
     next publish -- Bubble discards and rebuilds these roots constantly, and without this the list
     would grow one dead entry per rebuild for the life of the page. */
  function onTopics(fn, owner){
    var sub = { fn: fn, owner: owner || null };
    TOPICS.subs.push(sub);
    return function(){
      var i = TOPICS.subs.indexOf(sub);
      if (i >= 0) TOPICS.subs.splice(i, 1);
    };
  }

  /* Ein Array, das nur ein Array (oder einen JSON-String) enthaelt, ist immer ein Verpackungsfehler
     an der Aufrufstelle: setUpstreemBrands([RESPONSE]) statt setUpstreemBrands(RESPONSE). Das Ergebnis
     war besonders unangenehm: bei brands wurde jede Zeile reihum zu null gefiltert, der Store blieb
     leer, und weder Aufruf- noch Ablehnungszaehler schlugen aus. Aufruf da, Daten weg, keine Spur.
     Hier wird eine Ebene ausgepackt und laut protokolliert, statt still nichts zu tun.
     Nur bei GENAU einem Element und nur wenn das Element wirklich eine Liste ist: eine echte
     einelementige Zeilenliste ([{...}]) und ein einzelner Markt (["de"]) bleiben unangetastet. */
  /* Was kam wirklich an? Ohne diese Notiz ist ein leerer Store nicht von einem falsch geformten
     zu unterscheiden -- beide Male stehen 1 Aufruf, 0 Ablehnungen und 0 Zeilen da, und die
     Fehlersuche faellt auf Raten zurueck. Kurz gehalten und rein beschreibend: nichts davon
     landet im UI, es ist ausschliesslich fuer die Konsole gedacht. */
  function shapeOf(raw){
    try {
      if (raw == null) return String(raw);
      if (typeof raw === "string") return "string(" + raw.length + ") " + JSON.stringify(raw.slice(0, 160));
      if (isArray(raw)){
        var first = raw.length ? raw[0] : null;
        var fd = first && typeof first === "object" && !isArray(first)
          ? "keys=" + Object.keys(first).slice(0, 12).join(",")
          : JSON.stringify(first);
        return "array(" + raw.length + ") first: " + fd;
      }
      if (typeof raw === "object") return "object keys=" + Object.keys(raw).slice(0, 12).join(",");
      return typeof raw + " " + String(raw).slice(0, 80);
    } catch(e){ return "unreadable"; }
  }

  function unwrapOnce(list, label){
    if (!isArray(list) || list.length !== 1) return list;
    var only = list[0], inner = null;
    if (isArray(only)) inner = only;
    else if (typeof only === "string"){
      try { var pp = parseLoose(only, label); if (isArray(pp)) inner = pp; } catch(e){}
    }
    if (!inner) return list;
    if (window.console) console.warn("[" + label + "] the argument was a list wrapped in another " +
      "list — unwrapped " + inner.length + " row(s). Fix the Run-JS step: setUpstreem" +
      label.charAt(0).toUpperCase() + label.slice(1) + "(RESPONSE), not ([RESPONSE]).");
    return inner;
  }
  /* Und der allgemeine Fall: es kam etwas an, uebrig blieb nichts. Das ist nie ein normaler
     Zustand -- entweder stimmen die Feldnamen nicht oder die Struktur. Ohne diese Zeile sieht es
     im UI aus wie "es gibt einfach keine Daten". */
  function warnDropped(label, before, after){
    if (before && !after && window.console){
      console.warn("[" + label + "] " + before + " row(s) came in, 0 were usable — every row was " +
        "dropped. A row needs at least an id/company_id or a name. Check the field names in the " +
        "Run-JS payload.");
    }
  }

  function setTopics(rows, label){
    TOPICS.calls = (TOPICS.calls || 0) + 1;
    TOPICS.lastShape = shapeOf(rows);
    var list = parseLoose(rows, label || "topics");
    if (!list){ TOPICS.rejected = (TOPICS.rejected || 0) + 1; return false; }
    if (!isArray(list)) list = [list];
    list = unwrapOnce(list, "topics");
    TOPICS.lastIn = isArray(list) ? list.length : -1;
    TOPICS.list = list;
    TOPICS.at = nowMs();
    TOPICS.seq++;
    for (var i = TOPICS.subs.length - 1; i >= 0; i--){
      var sub = TOPICS.subs[i];
      if (sub.owner && !document.contains(sub.owner)){ TOPICS.subs.splice(i, 1); continue; }
      try { sub.fn(list.slice()); } catch(e){
        if (window.console) console.warn("[topics] a subscriber threw while updating:", e);
      }
    }
    return true;
  }

  function topicsChanged(){
    var fn = resolveBubbleFn("bubble_fn_upTopicsChanged");
    if (typeof fn === "function"){ try { fn(""); } catch(e){} return true; }
    if (window.console) {
      console.info("[topics] bubble_fn_upTopicsChanged not found — the topic lists on this page " +
        "will not refresh by themselves. Add a Toolbox \"JavaScript to Bubble\" element named " +
        "upTopicsChanged (Trigger event checked) whose workflow re-runs the topics RPC and calls " +
        "setUpstreemTopics(). See bubble/topics_filter_bubble.html.");
    }
    return false;
  }

  function isArray(v){ return Object.prototype.toString.call(v) === "[object Array]"; }

  /* The global Bubble calls. Defined here rather than in a component, because the whole point is
     that it belongs to no single one of them. A call that arrives before this file finished
     loading lands in __upTopicsQueue (any component's boot stub can fill it) and is replayed now. */
  window.setUpstreemTopics = function(rows){ return setTopics(rows, "setUpstreemTopics"); };
  window.getUpstreemTopics = getTopics;
  /* Global, wie upstreemMarketsChanged und upstreemBrandsChanged. Hier fehlte es als einziges der
     drei, und das ist beim Verdrahten sofort aufgefallen: in einem Bubble-Run-JavaScript steht die
     kurze Form, nicht der Umweg ueber UpstreemCore. Drei Geschwister, die verschieden zu rufen
     sind, sind drei Gelegenheiten fuer einen Tippfehler, der still nichts tut. */
  window.upstreemTopicsChanged = topicsChanged;
  (function drainTopicsQueue(){
    var q = window.__upTopicsQueue;
    if (!q || !q.length) return;
    window.__upTopicsQueue = [];
    for (var i = 0; i < q.length; i++){ try { setTopics(q[i], "setUpstreemTopics (queued)"); } catch(e){} }
  })();

  /* ---------------------------------------------------------------------------------------------
     Model store -- the same shape as the topic store above, for the LLM model list.

     Deliberately a second store rather than a generic one keyed by name: the two lists have
     different shapes, different Bubble refresh workflows and different lifetimes (topics are user
     data that changes all day, models are near-static config), and a shared bucket would make an
     invalidation on one of them republish the other. The duplication is ~30 lines; the coupling
     would be permanent. Everything else -- window scope against a double core.js load, subscriber
     pruning by detached owner, the pre-load queue -- is identical for identical reasons, so read
     the topic store's comment for the why. */
  var MODELS = (window.__upModels = window.__upModels || { list: [], at: 0, seq: 0, subs: [] });

  function getModels(){ return MODELS.list.slice(); }
  function onModels(fn, owner){
    var sub = { fn: fn, owner: owner || null };
    MODELS.subs.push(sub);
    return function(){
      var i = MODELS.subs.indexOf(sub);
      if (i >= 0) MODELS.subs.splice(i, 1);
    };
  }
  function setModels(rows, label){
    var list = parseLoose(rows, label || "models");
    if (!list) return false;
    if (!isArray(list)) list = [list];
    MODELS.list = list;
    MODELS.at = nowMs();
    MODELS.seq++;
    for (var i = MODELS.subs.length - 1; i >= 0; i--){
      var sub = MODELS.subs[i];
      if (sub.owner && !document.contains(sub.owner)){ MODELS.subs.splice(i, 1); continue; }
      try { sub.fn(list.slice()); } catch(e){
        if (window.console) console.warn("[models] a subscriber threw while updating:", e);
      }
    }
    return true;
  }
  window.setUpstreemModels = function(rows){ return setModels(rows, "setUpstreemModels"); };
  window.getUpstreemModels = getModels;
  (function drainModelsQueue(){
    var q = window.__upModelsQueue;
    if (!q || !q.length) return;
    window.__upModelsQueue = [];
    for (var i = 0; i < q.length; i++){ try { setModels(q[i], "setUpstreemModels (queued)"); } catch(e){} }
  })();

  /* ---------------------------------------------------------------------------------------------
     Market store. Third store of the same shape, and it needs BOTH halves of the topic store's
     design, not just the fan-out: a market row carries prompt_count, and the list only ever holds
     markets the team has actually assigned prompts to. Adding or deleting a prompt therefore
     changes this list, exactly the way creating a topic changes that one. marketsChanged() is the
     fan-in for that -- one well-known Bubble function, answered by re-running the RPC and calling
     setUpstreemMarkets again, so no mutation site has to know which pickers exist.
     The model store deliberately has no such counterpart: models are near-static config that
     nothing in the app creates. */
  var MARKETS = (window.__upMarkets = window.__upMarkets || { list: [], at: 0, seq: 0, subs: [] });

  function getMarkets(){ return MARKETS.list.slice(); }
  function onMarkets(fn, owner){
    var sub = { fn: fn, owner: owner || null };
    MARKETS.subs.push(sub);
    return function(){
      var i = MARKETS.subs.indexOf(sub);
      if (i >= 0) MARKETS.subs.splice(i, 1);
    };
  }
  function setMarkets(rows, label){
    MARKETS.calls = (MARKETS.calls || 0) + 1;
    MARKETS.lastShape = shapeOf(rows);
    var list = parseLoose(rows, label || "markets");
    if (!list){ MARKETS.rejected = (MARKETS.rejected || 0) + 1; return false; }
    if (!isArray(list)) list = [list];
    list = unwrapOnce(list, "markets");
    MARKETS.lastIn = isArray(list) ? list.length : -1;
    MARKETS.list = list;
    MARKETS.at = nowMs();
    MARKETS.seq++;
    for (var i = MARKETS.subs.length - 1; i >= 0; i--){
      var sub = MARKETS.subs[i];
      if (sub.owner && !document.contains(sub.owner)){ MARKETS.subs.splice(i, 1); continue; }
      try { sub.fn(list.slice()); } catch(e){
        if (window.console) console.warn("[markets] a subscriber threw while updating:", e);
      }
    }
    return true;
  }
  /* ---------- zweiter Markt-Store: die VOLLE Liste ----------
     MARKETS oben ist die Liste, die in den Filter-Dropdowns ueber den Tabellen steht: nur Maerkte,
     zu denen es ueberhaupt Prompts gibt, mit prompt_count. Das ist richtig fuer einen Filter --
     ein Markt ohne Daten waere dort eine Zeile, die garantiert nichts findet.
     Beim ANLEGEN ist es falsch: im Add-Prompts-Dialog und in den Einstellungen soll der Nutzer
     jeden Markt waehlen koennen, auch einen, in dem er noch nichts hat. Sonst kann er nie einen
     neuen anfangen.
     Darum zwei Stores statt eines Flags: ALL_MARKETS wird von setUpstreemAllMarkets gefuellt und
     faellt auf MARKETS zurueck, solange niemand ihn gesetzt hat. Eine Seite, die den neuen Setter
     noch nicht ruft, verhaelt sich damit exakt wie vorher. */
  /* Am window, nicht in dieser Closure -- genau wie MARKETS eine Zeile weiter oben. Laedt eine
     Seite core.js mehr als einmal (ein Element mit leerem data-cdn-pin holt @main, ein anderes
     seinen Pin), gibt es zwei Closures. Mit einem Store IN der Closure fuellt der Aufruf den einen
     und die Komponente liest den anderen: "Aufrufe 0", volle Liste nirgends, waehrend die
     GEFILTERTE Liste funktioniert -- die lag von Anfang an am window. Genau dieses Bild hatten
     wir, und es hat mich vier Runden gekostet. */
  var ALL_MARKETS = (window.__upAllMarkets = window.__upAllMarkets ||
    { list: [], at: 0, seq: 0, subs: [], calls: 0, rejected: 0 });
  function setAllMarkets(rows, label){
    ALL_MARKETS.calls = (ALL_MARKETS.calls || 0) + 1;
    var list = parseLoose(rows, label || "all-markets");
    if (!list){
      ALL_MARKETS.rejected = (ALL_MARKETS.rejected || 0) + 1;
      /* Stiller Ausfall ist hier besonders teuer: der Store bleibt leer, getAllMarkets faellt auf
         die GEFILTERTE Liste zurueck, und die Auswahl zeigt kommentarlos zu wenige Maerkte. Ohne
         diese Zeile sieht das aus wie ein Fehler in der Komponente. */
      if (window.console) console.warn("[all-markets] Payload unlesbar, Store bleibt leer -- die " +
        "volle Marktliste kommt nirgends an. Erhalten: " + shapeOf(rows));
      return false;
    }
    if (!isArray(list)) list = [list];
    list = unwrapOnce(list, "all-markets");
    ALL_MARKETS.list = list;
    ALL_MARKETS.at = nowMs();
    ALL_MARKETS.seq++;
    for (var i = ALL_MARKETS.subs.length - 1; i >= 0; i--){
      var sub = ALL_MARKETS.subs[i];
      if (sub.owner && !document.contains(sub.owner)){ ALL_MARKETS.subs.splice(i, 1); continue; }
      try { sub.fn(list.slice()); } catch(e){
        if (window.console) console.warn("[all-markets] a subscriber threw while updating:", e);
      }
    }
    return true;
  }
  function getAllMarkets(){ return (ALL_MARKETS.list.length ? ALL_MARKETS.list : MARKETS.list).slice(); }
  function onAllMarkets(fn, owner){
    ALL_MARKETS.subs.push({ fn: fn, owner: owner || null });
    MARKETS.subs.push({ fn: function(){ try { fn(getAllMarkets()); } catch(e){} }, owner: owner || null });
    return function(){
      for (var i = 0; i < ALL_MARKETS.subs.length; i++) if (ALL_MARKETS.subs[i].fn === fn){ ALL_MARKETS.subs.splice(i, 1); break; }
    };
  }

  function marketsChanged(){
    var fn = resolveBubbleFn("bubble_fn_upMarketsChanged");
    if (typeof fn === "function"){ try { fn(""); } catch(e){} return true; }
    if (window.console) {
      console.info("[markets] bubble_fn_upMarketsChanged not found. The market lists on this page " +
        "will not refresh by themselves, so their prompt counts go stale as soon as a prompt is " +
        "added or deleted. Add a Toolbox \"JavaScript to Bubble\" element named upMarketsChanged " +
        "(Trigger event checked) whose workflow re-runs the markets RPC and calls " +
        "setUpstreemMarkets(). See bubble/markets_filter_bubble.html.");
    }
    return false;
  }
  window.setUpstreemMarkets = function(rows){ return setMarkets(rows, "setUpstreemMarkets"); };
  /* Die VOLLE Marktliste, unabhaengig davon, ob es dort schon Prompts gibt. Wer sie nicht setzt,
     bekommt ueberall weiter die gefilterte Liste -- getAllMarkets faellt darauf zurueck. */
  window.setUpstreemAllMarkets = function(rows){ return setAllMarkets(rows, "setUpstreemAllMarkets"); };
  /* Vorgemerkte Aufrufe nachholen. Ein Run-JS-Schritt beim Seitenaufbau kann laufen, BEVOR core.js
     fertig geladen ist -- dann gibt es window.setUpstreemAllMarkets noch nicht, der Aufruf wirft,
     und der Store bleibt fuer den Rest der Sitzung leer. Genau dieser Fall sah aus wie "die
     Komponente zeigt die falsche Liste": Aufrufe 0, abgelehnt 0, und der Rueckfall lieferte
     kommentarlos die gefilterte Liste.
     Der Loader in bubble/settings_brand_bubble.html legt darum VOR core.js einen Stub an, der
     Aufrufe in diese Warteschlange schiebt. Hier werden sie eingeloest, in der Reihenfolge, in der
     sie kamen. Dieselbe Bauart wie die Boot-Stubs der Komponenten (UC.makeMount). */
  (function(){
    var q = window.__upstreemMarketQueue;
    if (!q || !q.length) return;
    /* Die Warteschlange wird NICHT geleert. Laedt eine Seite core.js zweimal -- zwei Komponenten
       mit verschiedenem data-cdn-pin -- dann bekommt die zweite Fassung einen frischen, leeren
       Store, waehrend die erste die Aufrufe schon verbraucht hatte. Der Store, den die Komponenten
       danach lesen, meldet "Aufrufe 0", und die volle Marktliste ist nirgends mehr zu finden.
       Bleiben die Eintraege liegen, kann jede spaetere Fassung sie noch abholen; ein doppeltes
       Setzen derselben Liste kostet nichts. */
    for (var i = 0; i < q.length; i++){
      try {
        if (q[i] && q[i].all) setAllMarkets(q[i].rows, "setUpstreemAllMarkets (nachgeholt)");
        else setMarkets(q[i].rows, "setUpstreemMarkets (nachgeholt)");
      } catch(e){}
    }
    if (window.console) console.info("[markets] " + q.length + " vorgemerkte Aufruf(e) nachgeholt.");
  })();
  /* Zum Nachsehen in der Konsole: UpstreemCore.dumpMarkets() zeigt beide Listen nebeneinander.
     Ohne das ist "zu wenige Maerkte" nicht von "falsche Liste" zu unterscheiden. */
  function dumpMarkets(){
    var voll = ALL_MARKETS.list, gef = MARKETS.list;
    if (window.console){
      console.info("VOLL (setUpstreemAllMarkets): " + voll.length + " Eintraege, " +
        ALL_MARKETS.calls + " Aufruf(e), " + ALL_MARKETS.rejected + " abgelehnt");
      if (console.table && voll.length) console.table(voll.slice(0, 400));
      console.info("GEFILTERT (setUpstreemMarkets): " + gef.length + " Eintraege");
      if (console.table && gef.length) console.table(gef.slice(0, 400));
      console.info("Warteschlange: " + ((window.__upstreemMarketQueue || []).length) + " Eintrag/Eintraege");
    }
    return { voll: voll.slice(), gefiltert: gef.slice() };
  }
  window.getUpstreemMarkets = getMarkets;
  window.upstreemMarketsChanged = marketsChanged;
  (function drainMarketsQueue(){
    var q = window.__upMarketsQueue;
    if (!q || !q.length) return;
    window.__upMarketsQueue = [];
    for (var i = 0; i < q.length; i++){ try { setMarkets(q[i], "setUpstreemMarkets (queued)"); } catch(e){} }
  })();

  /* ---------------------------------------------------------------------------------------------
     Brand store. Vierter Store derselben Bauart wie Topics und Markets, und aus demselben Grund:
     mehrere Komponenten brauchen dieselbe Markenliste, und ohne Store haengt jede an ihrem eigenen
     Bubble-Ausdruck -- eine neu angelegte oder deaktivierte Marke erreicht dann genau die
     Placements, an die jemand gedacht hat.

     Wie bei Markets gibt es BEIDE Richtungen: setUpstreemBrands(list) fuellt, brandsChanged() ist
     die Gegenrichtung fuer jede Stelle, die Marken anlegt, umbenennt oder deaktiviert -- ein
     bekannter Bubble-Funktionsname, beantwortet mit "RPC neu laufen lassen und setUpstreemBrands
     rufen". Kein Mutationsort muss wissen, welche Picker es auf der Seite gibt.

     Zeilenform (dieselbe, die renderPerformanceRadar in available_companies erwartet):
       { company_id, name, logo_url, role: "own"|"competitor", position } */
  var BRANDS = (window.__upBrands = window.__upBrands || { list: [], at: 0, seq: 0, subs: [] });

  function getBrands(){ return BRANDS.list.slice(); }
  function onBrands(fn, owner){
    var sub = { fn: fn, owner: owner || null };
    BRANDS.subs.push(sub);
    return function(){
      var i = BRANDS.subs.indexOf(sub);
      if (i >= 0) BRANDS.subs.splice(i, 1);
    };
  }
  /* Eine Marke, viele Feldnamen. Quick Actions hiess sie immer id/name/logo, die Tabellen und
     Charts lesen company_id/name/logo_url oder favicon_url, brandStack faellt auf favicon
     zurueck. Wer den Store fuellt, kann das nicht wissen und soll es auch nicht muessen -- also
     wird HIER einmal normalisiert und jede Zeile traegt danach ALLE gebraeuchlichen Namen mit
     demselben Wert. Ohne das haette dieselbe Liste in einer Komponente funktioniert und in der
     naechsten leere Logos oder gar keine Eintraege ergeben, ohne dass irgendwo etwas gemeldet
     wird -- genau die Sorte stiller Ausfall, die hier nicht mehr vorkommen soll.
     Zusatzfelder (role, position, was auch immer) bleiben unangetastet. */
  function normBrandRow(b){
    if (!b || typeof b !== "object") return null;
    var id   = b.company_id != null ? b.company_id : (b.id != null ? b.id : "");
    var name = b.name != null ? b.name : (b.label != null ? b.label : "");
    var logo = b.logo_url || b.logo || b.favicon_url || b.favicon || "";
    /* Protokoll-relativ ("//cdn...") bricht in manchen Bubble-Kontexten -- derselbe Fix, den
       brandStack in core schon fuer seine Chips macht. Bubble liefert Datei-URLs genau so. */
    if (String(logo).indexOf("//") === 0) logo = "https:" + logo;
    var out = {}, k;
    for (k in b) if (Object.prototype.hasOwnProperty.call(b, k)) out[k] = b[k];
    out.company_id = String(id); out.id = out.company_id;
    out.name = String(name);
    out.logo_url = logo; out.logo = logo; out.favicon_url = logo; out.favicon = logo;
    return (out.company_id || out.name) ? out : null;
  }

  function setBrands(rows, label){
    BRANDS.calls = (BRANDS.calls || 0) + 1;
    BRANDS.lastShape = shapeOf(rows);
    var list = parseLoose(rows, label || "brands");
    if (!list){ BRANDS.rejected = (BRANDS.rejected || 0) + 1; return false; }
    if (!isArray(list)) list = [list];
    list = unwrapOnce(list, "brands");
    BRANDS.lastIn = isArray(list) ? list.length : -1;
    var camein = list.length;
    list = list.map(normBrandRow).filter(Boolean);
    warnDropped("brands", camein, list.length);
    BRANDS.list = list;
    BRANDS.at = nowMs();
    BRANDS.seq++;
    for (var i = BRANDS.subs.length - 1; i >= 0; i--){
      var sub = BRANDS.subs[i];
      if (sub.owner && !document.contains(sub.owner)){ BRANDS.subs.splice(i, 1); continue; }
      try { sub.fn(list.slice()); } catch(e){
        if (window.console) console.warn("[brands] a subscriber threw while updating:", e);
      }
    }
    return true;
  }
  function brandsChanged(){
    var fn = resolveBubbleFn("bubble_fn_upBrandsChanged");
    if (typeof fn === "function"){ try { fn(""); } catch(e){} return true; }
    if (window.console) {
      console.info("[brands] bubble_fn_upBrandsChanged not found. The brand pickers on this page " +
        "will not refresh by themselves, so a newly added or deactivated brand only shows up after " +
        "a reload. Add a Toolbox \"JavaScript to Bubble\" element named upBrandsChanged (Trigger " +
        "event checked) whose workflow re-runs the brands RPC and calls setUpstreemBrands().");
    }
    return false;
  }
  /* Verteil-Kit. Eine Komponente sagt nur, WAS sie mit der Liste tut -- den Rest (sofort den
     aktuellen Stand liefern, danach jede Aenderung, Abmeldung wenn der Root verschwindet) macht
     das hier. Ohne das stuende in sieben Dateien dieselbe Schleife.

     Rueckgabewert sagt, ob der Store schon etwas hatte. Wer den eigenen Run-JS-Setter als
     Rueckfall behalten will, braucht ihn nicht abzufragen: der Store gewinnt einfach dadurch,
     dass er spaeter oder gleich danach liefert. Ein leerer Store ueberschreibt NIE -- sonst
     wuerde eine Seite ohne setUpstreemBrands() die per Run-JS gefuetterte Liste loeschen. */
  function brandsInto(root, apply){
    if (typeof apply !== "function") return false;
    var had = false;
    if (BRANDS.list.length){
      try { apply(BRANDS.list.slice()); had = true; } catch(e){
        if (window.console) console.warn("[brands] consumer threw on the initial list:", e);
      }
    }
    onBrands(function(list){ if (list && list.length) apply(list); }, root);
    return had;
  }

  window.setUpstreemBrands = function(rows){ return setBrands(rows, "setUpstreemBrands"); };
  window.getUpstreemBrands = getBrands;
  window.upstreemBrandsChanged = brandsChanged;
  (function drainBrandsQueue(){
    var q = window.__upBrandsQueue;
    if (!q || !q.length) return;
    window.__upBrandsQueue = [];
    for (var i = 0; i < q.length; i++){ try { setBrands(q[i], "setUpstreemBrands (queued)"); } catch(e){} }
  })();

  /* ---------------------------------------------------------------------------------------------
     Page-wide theme. Same shape as the topic store above, for the same reason: one call, every
     component follows, including ones that mount later.

     Until now each component had its own way in -- a data-isdark attribute Bubble had to patch on
     every single element, plus a handful of per-component setters (setVisibilityChartTheme,
     opportunitiesSetTheme, setTopicsFilterTheme, ...). Miss one and that component keeps the old
     theme while the rest of the page has already switched, which is exactly the "some components
     keep the old theme" symptom. There is no list to keep in sync here: every .up-root on the page
     gets stamped, and a MutationObserver stamps any that appear afterwards.

     Attributes still win where they are set -- a component deliberately pinned to one theme keeps
     working -- so this is additive. localStorage.pref_theme is written too, which is what
     themeGuard already reads, so a Bubble re-render that repaints a root cannot undo it. */
  var THEME = (window.__upTheme = window.__upTheme || { value: null, bound: false, subs: [] });
  /* For components that need to do more than have an attribute stamped on them. */
  function onTheme(fn){ THEME.subs.push(fn); return function(){ var i = THEME.subs.indexOf(fn); if (i >= 0) THEME.subs.splice(i, 1); }; }

  function applyThemeTo(el, dark){
    if (!el || !el.classList || !el.classList.contains("up-root")) return;
    if (dark) el.setAttribute("data-theme", "dark");
    else el.removeAttribute("data-theme");
    /* Components read data-isdark in their own MutationObservers; keeping it in step means every
       existing per-component sync path fires too, without touching any of them. */
    el.setAttribute("data-isdark", dark ? "yes" : "no");
  }

  function setUpstreemTheme(t){
    /* "dark"/"light" UND die Bubble-Form "yes"/"no". Bisher galt nur /^dark$/i, also machte
       setUpstreemTheme("yes") -- die Form, die jeder Bubble-Workflow liefert -- daraus HELL.
       Aufgefallen an add-prompts: setAddPromptsTheme("yes") schaltete den Dialog auf die helle
       Palette, bis der Theme-Waechter das kurz darauf zurueckdrehte. Genau der helle Feldrahmen,
       der beim Oeffnen im Dark Mode fuer einen Moment zu sehen war. */
    var roh = String(t == null ? "" : t).trim();
    /* "system"/"auto" ist die dritte Wahl im Konto-Menue und stand bisher NICHT hier -- alles, was
       nicht dark/yes/true/1 traf, wurde still HELL. setUpstreemTheme("system") schaltete also auf
       hell, und ein Workflow, der die gespeicherte Wahl des Nutzers durchreicht, kippte damit jedes
       Mal die ganze App. Genau der Weg, auf dem "ich stelle das Theme um und alles wird komisch"
       entsteht: die Wahl heisst system, angewendet wird hell, der Rueckkanal meldet hell, und das
       schreibt die Wahl in der Datenbank kaputt.
       Jetzt wird system aufgeloest wie im Konto-Menue: nach der Einstellung des Betriebssystems,
       und die gespeicherte Wahl wird danach GELOESCHT -- sonst haette der naechste Seitenaufbau
       eine feste Farbe statt der Systemfarbe. Leerer Wert bleibt absichtlich hell: den liefert ein
       nicht gesetztes Bubble-Feld, und daraus darf nicht plotzlich Dunkel werden. */
    var systemWahl = /^(system|auto)$/i.test(roh);
    var dark;
    if (systemWahl){
      try { dark = !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches); }
      catch(e){ dark = false; }
    } else {
      dark = /^dark$/i.test(roh) || /^(yes|y|true|1)$/i.test(roh);
    }
    THEME.value = dark ? "dark" : "light";
    try {
      if (systemWahl) localStorage.removeItem("pref_theme");
      else localStorage.setItem("pref_theme", THEME.value);
    } catch(e){}
    var roots = document.querySelectorAll(".up-root");
    for (var i = 0; i < roots.length; i++) applyThemeTo(roots[i], dark);
    /* Portalled surfaces (opportunities' drawer, the topic modal) live in <body>, outside any
       root, and carry the class themselves. */
    var portals = document.querySelectorAll(".uo-portal, .up-portal, .upr-portal");
    for (var p = 0; p < portals.length; p++) applyThemeTo(portals[p], dark);

    /* Quick Actions predates the .up-root convention: its root is #mira-quick-actions and it does
       not load core.js at all, so it can neither be found by the sweep above nor subscribe here.
       Named explicitly, and its own setTheme is called too -- that is the API it exposes and it
       also themes its overlay. This is the whole reason a page still had to call
       MiraQuickActions.setTheme() by hand; it does not any more. */
    var mqa = document.getElementById("mira-quick-actions");
    if (mqa){
      mqa.setAttribute("data-theme", THEME.value);
      var mqaOv = mqa.querySelector(".mqa-overlay");
      if (mqaOv) mqaOv.setAttribute("data-theme", THEME.value);
    }
    try {
      if (window.MiraQuickActions && typeof window.MiraQuickActions.setTheme === "function")
        window.MiraQuickActions.setTheme(THEME.value);
    } catch(e){}

    /* Der Abonnent bekommt einen WAHRHEITSWERT, nicht den Text. Bisher ging THEME.value hinaus
       ("dark"/"light"), und jeder Abonnent, der ihn als Wahrheitswert las, bekam bei HELL ein
       truthy "light" -- also dunkel. Gemessen am 23.08.: domain-detail, response-detail und
       url-detail blieben beim Zurueckschalten auf hell alle drei dunkel, obwohl core das Attribut
       zuvor korrekt entfernt hatte; die Abonnenten setzten es danach wieder.
       Kein Abonnent im Repo braucht den Text -- die uebrigen ignorieren das Argument und lesen
       den Zustand selbst. Wer ihn doch braucht, hat getUpstreemTheme(). */
    for (var t = 0; t < THEME.subs.length; t++){ try { THEME.subs[t](dark); } catch(e){} }

    /* Rueckkanal nach Bubble. Ohne ihn kennt die App den Zustand nicht: der Schalter auf der
       Anmeldeseite schreibt den localStorage, aber ein Bubble-State oder ein Feld in der
       Datenbank erfaehrt davon nichts.
       NICHT beim Start: dort stellt core nur wieder her, was ohnehin gespeichert war, und ein
       Event wuerde den Wert aus der Datenbank ueberschreiben, bevor der Pageload-Workflow ihn
       ueberhaupt gesetzt hat. Nur echte Wechsel melden. */
    if (!THEME.booting){
      try {
        var meld = resolveBubbleFn("bubble_fn_theme_pref");
        if (typeof meld === "function") meld(THEME.value);
      } catch(e){}
    }

    /* Anything Bubble builds AFTER the switch -- a re-rendered element, a drawer opening -- would
       otherwise come up in the old theme. One observer for the whole page, installed once. */
    if (!THEME.bound){
      THEME.bound = true;
      new MutationObserver(function(muts){
        if (THEME.value == null) return;
        var isDark = THEME.value === "dark";
        for (var m = 0; m < muts.length; m++){
          var added = muts[m].addedNodes;
          for (var n = 0; n < added.length; n++){
            var el = added[n];
            if (!el || el.nodeType !== 1) continue;
            applyThemeTo(el, isDark);
            var inner = el.querySelectorAll ? el.querySelectorAll(".up-root") : [];
            for (var q = 0; q < inner.length; q++) applyThemeTo(inner[q], isDark);
          }
        }
      }).observe(document.documentElement, { childList: true, subtree: true });
    }
    return THEME.value;
  }

  /* Das Theme beim Laden von core SELBST herstellen, ohne auf einen Aufruf zu warten.
     Der Waechter darueber ist gut, hing aber INNERHALB von setUpstreemTheme: er wurde erst
     installiert, wenn jemand die Funktion rief, und er tut nichts, solange THEME.value null ist.
     Auf einer Seite, die den Aufruf nicht oder erst spaet macht, kam damit jede spaeter gebaute
     Komponente im falschen Theme hoch -- und weil Bubble staendig Elemente neu baut, sah das
     nach Zufall aus: hier hell, da dunkel.
     Die Wahl steht ohnehin im localStorage, geschrieben von setUpstreemTheme. Sie hier zu lesen
     ist kein neuer Zustand, sondern derselbe, nur frueher. Ohne gespeicherte Wahl entscheidet
     die Einstellung des Betriebssystems -- und wer beides nicht hat, bleibt hell wie bisher. */
  (function themeBeimStart(){
    if (window.__upThemeBooted) return;
    window.__upThemeBooted = true;
    var wahl = null;
    try { wahl = localStorage.getItem("pref_theme"); } catch(e){}
    if (wahl !== "dark" && wahl !== "light"){
      try {
        if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) wahl = "dark";
      } catch(e){}
    }
    /* Ohne jede Angabe NICHT eingreifen: dann bleibt es beim Verhalten von vorher, und eine
       Seite, die ihr Theme selbst per Attribut setzt, wird nicht ueberschrieben. */
    if (wahl !== "dark" && wahl !== "light") return;
    THEME.booting = true;
    try { setUpstreemTheme(wahl); } catch(e){}
    THEME.booting = false;
  })();
  /* Der isDark-Parameter eines Render-Aufrufs ist eine MOMENTAUFNAHME: Bubble hat ihn in dem
     Moment in den Payload geschrieben, in dem der Workflow lief. Steht die App inzwischen auf einer
     anderen Farbe, ist er falsch -- und weil jede Komponente ihn direkt in ihr data-theme schreibt,
     dreht sie sich damit selbst zurueck, waehrend der Rest der Seite richtig steht.
     Genau das war das gemeldete Bild im brands-overview: beim Wechsel auf Hell blitzt die Karte
     kurz weiss auf (core faerbt sie), und der naechste Render-Aufruf mit dem alten is_dark macht
     sie sofort wieder dunkel.
     Regel: kennt core ein Thema, gewinnt core. Der Parameter zaehlt nur, solange keins gesetzt ist
     -- also beim ganz fruehen Seitenaufbau, wo er die einzige Quelle ist. */
  function themeParam(v){
    var t = THEME.value;
    if (t === "dark" || t === "light") return t === "dark";
    return isYes(v);
  }

  function getUpstreemTheme(){ return THEME.value || readPrefTheme() || "light"; }
  /* Die WAHL des Nutzers, nicht das aufgeloeste Thema. getUpstreemTheme() gibt zurueck, was
     gerade gemalt wird ("light" oder "dark") -- eine Einstellungszeile muss aber "System" zeigen
     koennen, und das ist genau der Fall, in dem nichts gespeichert ist.
     Zwei Abnehmer: das Konto-Menue der Seitenleiste und die Zeile im Einstellungsfenster. Die
     Seitenleiste hatte diese fuenf Zeilen als eigene Kopie -- eine Regel an zwei Orten laeuft
     irgendwann auseinander. */
  function getUpstreemThemeChoice(){
    try {
      var v = String(window.localStorage.getItem("pref_theme") || "").trim().toLowerCase();
      if (v === "dark" || v === "light") return v;
    } catch(e){}
    return "system";
  }

  window.setUpstreemTheme = setUpstreemTheme;
  window.getUpstreemTheme = getUpstreemTheme;
  window.getUpstreemThemeChoice = getUpstreemThemeChoice;

  /* Schalter fuer die Event-Diagnose in makeFire. Global, weil er aus der Konsole und aus einem
     Run-JS-Schritt erreichbar sein muss; standardmaessig aus. Rueckgabe ist der neue Zustand,
     damit man in Bubble sieht, dass der Aufruf angekommen ist. */
  window.upstreemTrace = function(an){
    window.__upTrace = (an === undefined) ? true : !!an;
    if (window.console) console.log("[trace] " + (window.__upTrace ? "an" : "aus"));
    return window.__upTrace;
  };

  /* Adopt the stored theme at LOAD, not only when a page calls setUpstreemTheme. Bubble rebuilds
     an HTML element whenever a workflow touches its data -- selecting a topic rebuilds the date
     picker sitting next to it -- and for the frame between insertion and Bubble resolving
     data-isdark, the fresh root has no theme at all and paints light. In dark mode that is a white
     flash on every single click. Binding here means the observer is already watching, so a root
     that appears is stamped in the same task it is inserted, before it can be painted. */
  try {
    if (readPrefTheme() === "dark" && THEME.value == null) setUpstreemTheme("dark");
  } catch(e){}

  /* ---------------------------------------------------------------------------------------------
     Team scope for everything this library stores locally.

     localStorage is shared across every team the same browser ever opens, so an unscoped key means
     one team's saved state shows up for the next. The worst of these was prompts-table's
     "promptGroups": custom groupings are lists of TAG IDS, and a tag id from team A resolves to
     nothing in team B -- so the grouping did not just look wrong, it silently produced empty
     groups. Column choices, drag widths, chart modes and sort preferences had the same leak, just
     less visibly.

     Every key now runs through storeKey(), which appends "@<team>". A page with no team yet gets
     "@_" rather than the bare key, so an unscoped value can never be read back by accident once a
     team IS known. Values written before this exist under the old names and are simply not found
     any more -- which is the correct outcome, not a migration problem: they were the leak.

     The team comes from setUpstreemTeam(id) or from a data-team attribute on any root, whichever
     lands first. Changing it re-keys everything from the next read on. */
  var TEAM = (window.__upTeam = window.__upTeam || { id: "" });
  function getTeam(){
    if (TEAM.id) return TEAM.id;
    /* Declarative fallback: any component root may carry data-team, so a page that binds it in
       the Property Editor needs no Run-JavaScript step at all. */
    try {
      var el = document.querySelector("[data-team]");
      var v = el && String(el.getAttribute("data-team") || "").trim();
      if (v && v !== "TEAM_ID") TEAM.id = v;
    } catch(e){}
    return TEAM.id;
  }
  function setUpstreemTeam(id){
    var v = String(id == null ? "" : id).trim();
    if (v === "TEAM_ID") v = "";
    TEAM.id = v;
    return v;
  }
  /* ---------- Heat-Rampe ----------
     Die fuenf Stufen stehen als --uhm-h0..--uhm-h4 in core.css, eine Reihe pro Theme. heatAt liest
     sie aus der lebenden Kaskade des uebergebenen Elements und interpoliert linear -- so bekommt
     jeder Verbraucher denselben Farbwert fuer denselben Anteil, ohne dass irgendwo eine zweite
     Palette oder eine zweite Rechnung steht. Der Radar faerbt damit seine Zellen, der Detailbereich
     seine Kurve mit dem Wert bei 0.65. */
  var HEAT_FALLBACK = [[240,243,248],[200,212,229],[138,164,196],[74,110,150],[30,58,95]];
  /* Streng, im Gegensatz zu tint/brighten/darken weiter oben: die kriegen ihre Farbe aus einer
     Konstante und duerfen von gueltigem Hex ausgehen. Hier kommt der Wert aus getComputedStyle und
     kann leer sein, wenn das Stylesheet noch nicht da ist -- dann muss null zurueck, damit der
     Rueckfall greift statt NaN in die Interpolation zu laufen. */
  function hexToRgb(h){
    h = String(h == null ? "" : h).trim().replace("#", "");
    if (h.length === 3) h = h.charAt(0)+h.charAt(0)+h.charAt(1)+h.charAt(1)+h.charAt(2)+h.charAt(2);
    if (!/^[0-9a-f]{6}$/i.test(h)) return null;
    var n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function heatRamp(el){
    var cs = null;
    try { cs = getComputedStyle(el || document.documentElement); } catch(e){}
    var out = [];
    for (var i = 0; i < 5; i++){
      var v = cs ? String(cs.getPropertyValue("--uhm-h" + i) || "").trim() : "";
      out.push(hexToRgb(v) || HEAT_FALLBACK[i]);
    }
    return out;
  }
  function heatAt(el, t){
    var s = heatRamp(el);
    t = Math.max(0, Math.min(1, Number(t) || 0));
    var i = t * (s.length - 1), lo = Math.floor(i), hi = Math.min(s.length - 1, lo + 1), f = i - lo;
    return [
      Math.round(s[lo][0] + (s[hi][0] - s[lo][0]) * f),
      Math.round(s[lo][1] + (s[hi][1] - s[lo][1]) * f),
      Math.round(s[lo][2] + (s[hi][2] - s[lo][2]) * f)
    ];
  }

  function storeKey(base){ return String(base) + "@" + (getTeam() || "_"); }

  /* Ansichts-Einstellungen bekommen KEIN Team-Suffix. Das war der Fehler: storeKey haengt die
     Team-Id an, und die ist beim Boot noch nicht bekannt. Gelesen wurde also unter "…@_",
     geschrieben spaeter unter "…@<team>" -- zwei Schluessel, nichts kam zurueck. Betroffen war
     alles Gespeicherte auf einmal: Spaltensichtbarkeit, Spaltenbreiten, Gruppierung, Wide-Modus,
     Zeilenhoehe, Seitengroesse, Diagrammtyp.

     Team-Bindung ist fuer diese Werte auch inhaltlich falsch. Es sind Ansichtsvorlieben eines
     Geraets, keine Teamdaten -- welche Spalten jemand sieht, ist dieselbe Entscheidung, egal in
     welchem Team er gerade steht. Team-gebunden bleibt, was echte Fremddaten enthaelt: die
     eigenen Gruppierungen in prompts-table (eine Liste von Tag-Ids), die weiterhin ueber
     storeKey laufen.

     Der Rueckfall holt einmalig, was unter einem Team-Suffix liegengeblieben ist. Ohne ihn waeren
     die Einstellungen zwar wieder stabil, aber alles vor diesem Stand Gespeicherte einmal weg. */
  function prefKey(base){ return String(base); }
  function prefGet(base){
    try {
      var ls = window.localStorage; if (!ls) return null;
      var v = ls.getItem(base);
      if (v != null) return v;
      var pre = base + "@";
      for (var i = 0; i < ls.length; i++){
        var n = ls.key(i);
        if (n && n.length > pre.length && n.slice(0, pre.length) === pre){
          var alt2 = ls.getItem(n);
          if (alt2 != null){ try { ls.setItem(base, alt2); } catch(e){} return alt2; }
        }
      }
    } catch(e){}
    return null;
  }
  function prefSet(base, value){
    try { window.localStorage.setItem(String(base), String(value)); } catch(e){}
  }
  window.setUpstreemTeam = setUpstreemTeam;
  window.getUpstreemTeam = getTeam;

  /* BUILD steht ganz oben in dieser Datei, zusammen mit der Sperre, die eine zweite Ausfuehrung
     verhindert. Hier stand die Zuweisung frueher -- an dieser Stelle ist es zu spaet, da haben die
     Beobachter und Boot-Laeufe schon gearbeitet. */

  /* Wartezeit, bevor eine Komponente "keine Daten" zeigt. Verhindert, dass ein noch laufender
     Ladevorgang fuer einen Moment als leeres Ergebnis aufblitzt. Stand in fuenf Dateien einzeln
     -- zufaellig ueberall auf demselben Wert, aber ohne gemeinsamen Ort waere die naechste
     Aenderung wieder eine Wanderung durch fuenf Dateien. */
  var EMPTY_GRACE_MS = 500;

  /* ---- icon(name, strokeWidth) --------------------------------------------------------------
     Lucide-Geometrie an einer Stelle, Strichstaerke am Aufrufort. Die Trennung ist der Punkt:
     dieselben Icons stehen heute in zehn Dateien, aber NICHT als blosse Kopien -- ein X in einem
     16px-Knopf traegt 2.2, eines in einem 32px-Knopf 2.6, und das ist Absicht, kein Wildwuchs.
     Eine Vereinheitlichung auf einen Wert wuerde ein Dutzend Stellen anders aussehen lassen.

     Was hier zusammenlaeuft, ist die FORM. Wer ein Icon korrigiert oder ein neues aufnimmt,
     trifft damit alle Verbraucher, ohne dass jemand seine Strichstaerke verliert.

     Bestehende Komponenten bleiben unangetastet -- das Kit steht bereit, es zwingt niemanden. */
  var ICON_PATHS = {
    /* ── Lucide 1.31.0 ─────────────────────────────────────────────────────────
       Umgestellt von Feather auf Lucide. Beide Saetze teilen Raster 24, runde Enden und die
       Strichlogik, deshalb passt jeder Pfad ohne Umrechnung in dieselbe Huelle -- Aufrufer mit
       eigener Strichstaerke bleiben unveraendert.
       Die SCHLUESSEL bleiben, wo Lucide anders heisst: home (house), barChart2
       (chart-no-axes-column), moreHorizontal (ellipsis), sparkle (sparkles), broadcast
       (radio-tower), bulb (lightbulb). Ein Schluesselwechsel haette jeden Aufrufer gebrochen,
       ohne dass sich am Bild etwas aendert.
       Die Pfade sind woertlich aus lucide-static uebernommen, nicht nachgezeichnet. */
    x:        '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    /* camera: woertlich aus lucide-static. Fuer die Ueberblendung auf dem Profilbild -- die
       Bildmaschine ist das Zeichen fuer "Bild wechseln", ein Stift waere "Text bearbeiten". */
    camera:   '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>' +
              '<circle cx="12" cy="13" r="3"/>',
    /* tags und libraryBig: woertlich aus lucide-static wie alle anderen. tags stand bisher als
       Inline-SVG im Prompts-Seitenkopf und wird jetzt auch vom Onboarding gebraucht -- zweiter
       Verbraucher, also hierher. libraryBig ist das Zeichen des Begleitkastens im Onboarding. */
    tags:     '<path d="m15 5 6.3 6.3a2.4 2.4 0 0 1 0 3.4L17 19"/>' +
              '<path d="M9.586 5.586A2 2 0 0 0 8.172 5H3a1 1 0 0 0-1 1v5.172a2 2 0 0 0 .586 1.414L8.29 18.29a2.426 2.426 0 0 0 3.42 0l3.58-3.58a2.426 2.426 0 0 0 0-3.42z"/>' +
              '<circle cx="6.5" cy="9.5" r=".5" fill="currentColor"/>',
    libraryBig: '<rect width="8" height="18" x="3" y="3" rx="1"/><path d="M7 3v18"/>' +
              '<path d="M20.4 18.9c.2.5-.1 1.1-.6 1.3l-1.9.7c-.5.2-1.1-.1-1.3-.6L11.1 5.1c-.2-.5.1-1.1.6-1.3l1.9-.7c.5-.2 1.1.1 1.3.6Z"/>',
    /* Lucide scan-square. Zeichen des Knopfes "Look for new Opportunities" im
       Opportunities-Seitenkopf -- vier Ecken und ein Feld darin, also "durchsuchen", und nicht
       das Zielkreuz, das dort vorher stand (drei Kreise, gelesen als "zielen"). Woertlich aus
       lucide-static wie jedes andere Zeichen hier. */
    scanSquare: '<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/>' +
              '<path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/>' +
              '<rect width="8" height="8" x="8" y="8" rx="1"/>',
    /* Vier Zeichen fuer die Teamverwaltung (team-orga): einladen, aufklappen, entfernen und die
       Besitzerrolle. Woertlich aus lucide-static wie jedes andere hier.
       chevronUp gehoert dazu, weil der Winkel am Protokoll sein ZEICHEN wechselt und sich nicht
       dreht -- Drehen ist in dieser App mehrfach ausgeschlossen worden. */
    userPlus: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>' +
              '<line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/>',
    userMinus: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>' +
              '<line x1="22" x2="16" y1="11" y2="11"/>',
    chevronUp: '<path d="m18 15-6-6-6 6"/>',
    /* Lucide send. Zeichen fuer "Einladung erneut schicken" in der Teamverwaltung -- ein Pfeil,
       der abgeht, und nicht refresh-cw: das liest sich als "neu laden". */
    send:     '<path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/>' +
              '<path d="m21.854 2.147-10.94 10.939"/>',
    crown:    '<path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z"/>' +
              '<path d="M5 21h14"/>',
    check:    '<path d="M20 6 9 17l-5-5"/>',
    chevronDown:  '<path d="m6 9 6 6 6-6"/>',
    chevronRight: '<path d="m9 18 6-6-6-6"/>',
    /* Lucide chevron-left. Bisher gab es ihn nicht und onboarding-page dreht den rechten per CSS
       -- das ist ein anderer Fall als "der Chevron dreht sich beim Oeffnen" (das tut hier keiner),
       aber ein gedrehtes Zeichen ist eine Form, die man nicht suchen kann. Erster Verbraucher ist
       die Zurueck-Zeile im hineingegangenen Untermenue der Filterleiste. */
    chevronLeft: '<path d="m15 18-6-6 6-6"/>',
    search:   '<path d="m21 21-4.34-4.34"/><circle cx="11" cy="11" r="8"/>',
    plus:     '<path d="M5 12h14"/><path d="M12 5v14"/>',
    minus:    '<path d="M5 12h14"/>',
    /* Lucide trash-2 und save. Beide kamen mit brand-editor dazu und stehen deshalb hier und
       nicht dort: ein Papierkorb und ein Speichern-Zeichen sind Vokabular der ganzen App, und
       zwei selbst gezeichnete Fassungen davon waeren zwei verschiedene Papierkoerbe. */
    trash:    '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>' +
              '<path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>' +
              '<path d="M10 11v6"/><path d="M14 11v6"/>',
    save:     '<path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/>' +
              '<path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/>' +
              '<path d="M7 3v4a1 1 0 0 0 1 1h7"/>',
    /* Lucide galaxy. Der gefuellte Kern traegt sein fill selbst: die Huelle von icon() setzt
       fill: none am svg, und ohne die Angabe am Kreis blieb der Kern ein leerer Ring.
       Die Flaggen des letzten Bogens im ersten Pfad sind 01 und nicht 00 -- zwei Abrufe der Datei
       lasen die Stelle verschieden, und mit 00 beult der Arm zur falschen Seite: die Zeichnung
       liegt dann von 6.6 bis 17.3 statt von 2.3 bis 21.7 und ist im Kasten nicht mehr mittig.
       Nachgesehen in _h_galaxy.html, beide Fassungen nebeneinander gemalt. */
    galaxy:   '<path d="M16.005 15.108a5.041 6.52 28.25 00-8.008-6.217 5.041 6.52 28.25 008.008 ' +
              '6.217A11.884 7.288-60.76 014.029 7.001"/><path d="M17 21h.01"/><path d="M7 3h.01"/>' +
              '<path d="M7.997 8.891a11.885 7.288-60.756 0111.977 8.107"/>' +
              '<circle cx="12" cy="12" r="1" fill="currentColor"/>',
    /* ── Navigation ──────────────────────────────────────────────────────────── */
    home:     '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/>' +
              '<path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    zap:      '<path d="M15.914 4a1.5 1.5 0 0 0-2.474-1.561l-9 9A1.5 1.5 0 0 0 5.5 14h4.002a.5.5 0 0 1 .471.666L8.086 20a1.5 1.5 0 0 0 2.475 1.56l9-9A1.5 1.5 0 0 0 18.5 10h-3.997a.5.5 0 0 1-.472-.667z"/>',
    globe:    '<circle cx="12" cy="12" r="10"/>' +
              '<path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
    /* blend und telescope, beide aus Lucide wie alles hier: blend traegt Mira (Seitenleiste und
       Wortmarke), telescope die Prompt Research. */
    /* lucide "scan": vier Ecken eines Rahmens. Dasselbe Zeichen fuehrt der Prompts-Seitenkopf
       fuer den Abschnitt Responses -- Miras Arbeitsprotokoll benutzt es fuer denselben Schritt. */
    scan: '<path d="M8 3H5a2 2 0 0 0-2 2v3"/> <path d="M21 8V5a2 2 0 0 0-2-2h-3"/> <path d="M3 16v3a2 2 0 0 0 2 2h3"/> <path d="M16 21h3a2 2 0 0 0 2-2v-3"/>',
    blend:    '<circle cx="9" cy="9" r="7"/><circle cx="15" cy="15" r="7"/>',
    telescope: '<path d="m10.065 12.493-6.18 1.318a.934.934 0 0 1-1.108-.702l-.537-2.15a1.07 1.07 0 0 1 .691-1.265l13.504-4.44"/>' +
              '<path d="m13.56 11.747 4.332-.924"/><path d="m16 21-3.105-6.21"/>' +
              '<path d="M16.485 5.94a2 2 0 0 1 1.455-2.425l1.09-.272a1 1 0 0 1 1.212.727l1.515 6.06a1 1 0 0 1-.727 1.213l-1.09.272a2 2 0 0 1-2.425-1.455z"/>' +
              '<path d="m6.158 8.633 1.114 4.456"/><path d="m8 21 3.105-6.21"/>' +
              '<circle cx="12" cy="13" r="2"/>',
    copy:     '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>' +
              '<path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
    /* Lucide chart-pie: der Doughnut-Knopf des Umschalters. Stand bisher als rohes SVG im
       Bubble-Markup des Combo-Charts -- jetzt im Kit, damit domain-detail denselben Knopf hat. */
    donut:    '<path d="M21 12c.552 0 1.005-.449.95-.998a10 10 0 0 0-8.953-8.951c-.55-.055-.998.398-.998.95v8a1 1 0 0 0 1 1z"/>' +
              '<path d="M21.21 15.89A10 10 0 1 1 8 2.83"/>',
    /* chart-bar-decreasing, dieselbe Form, die TOOLBAR_SEL auf die Combo-Knoepfe stempelt. */
    chartBarDec: '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M7 11h8"/><path d="M7 16h3"/><path d="M7 6h12"/>',
    barChart2:'<path d="M5 21v-6"/><path d="M12 21V3"/><path d="M19 21V9"/>',
    clipboard:'<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/>' +
              '<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>',
    folder:   '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
    settings: '<path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/>' +
              '<circle cx="12" cy="12" r="3"/>',
    /* creditCard und nicht "dollar": Lucide hat kein Dollar-Symbol, und credit-card ist das
       Zeichen, das jede App fuer Abrechnung nimmt. */
    creditCard:'<rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/>',
    logOut:   '<path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>' +
              '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>',
    moreHorizontal: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>' +
              '<circle cx="5" cy="12" r="1"/>',
    /* Zwei Chevrons uebereinander -- das Zeichen fuer einen Kontextwechsler. */
    chevronsUpDown: '<path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/>',
    /* Alter Name, gleiche Form. chevronUpDown hiess das hier, bevor Lucide den Satz stellte;
       der Schluessel bleibt, damit kein Aufrufer bricht. */
    chevronUpDown: '<path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/>',
    /* Wie chevronsUpDown, aber die beiden Haelften stehen 3 Rastereinheiten weiter auseinander
       (je 0.75 nach aussen; bei 16px Darstellung 1px insgesamt). Bewusst KEINE Lucide-Geometrie, sondern eine Variante davon: im
       Team-Schalter der Sidebar standen die Pfeile zu dicht beieinander. Woanders nicht
       benutzen -- wer den Standard will, nimmt chevronsUpDown. */
    chevronsUpDownWide: '<path d="m7 15.75 5 5 5-5"/><path d="m7 8.25 5-5 5 5"/>',
    /* Rahmen mit senkrechter Trennlinie -- das Sidebar-Symbol. */
    panelLeft:'<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/>',
    /* Dasselbe Zeichen gespiegelt: die Leiste rechts. Es steht fuer "oeffnet die Schublade an der
       rechten Seite" -- genau das tut der Edit-Knopf in der Markentabelle. */
    panelRight:'<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M15 3v18"/>',
    squareStack:'<path d="M4 10c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h4c1.1 0 2 .9 2 2"/>' +
              '<path d="M10 16c-1.1 0-2-.9-2-2v-4c0-1.1.9-2 2-2h4c1.1 0 2 .9 2 2"/>' +
              '<rect width="8" height="8" x="14" y="14" rx="2"/>',
    bolt:     '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>' +
              '<circle cx="12" cy="12" r="4"/>',
    /* folders: zwei Ordner hintereinander -- das Team-Symbol der Leiste. */
    folders:  '<path d="M20 5a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h2.5a1.5 1.5 0 0 1 1.2.6l.6.8a1.5 1.5 0 0 0 1.2.6z"/>' +
              '<path d="M3 8.268a2 2 0 0 0-1 1.738V19a2 2 0 0 0 2 2h11a2 2 0 0 0 1.732-1"/>',
    listTodo: '<path d="M13 5h8"/><path d="M13 12h8"/><path d="M13 19h8"/>' +
              '<path d="m3 17 2 2 4-4"/><rect x="3" y="4" width="6" height="6" rx="1"/>',
    scanSearch: PFAD_SCAN,
    textSearch: PFAD_SQDASH,
    /* arrow-down-up: das Sortierzeichen der Toolbars, jetzt auch fuer die Sortierknoepfe in den
       Filter-Menues abrufbar. Die trugen bis hierher den Trichter mit drei Linien. */
    /* Lucide file-text / external-link: die zwei Wahlmoeglichkeiten im URL-Menue (aus Mira
       uebernommen, dort noch als rohes SVG im JS). layoutGrid / listIcon: der Grid-/Listen-
       Umschalter der Citations. */
    fileText: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/>' +
              '<path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/>' +
              '<path d="M16 13H8"/><path d="M16 17H8"/>',
    externalLink: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/>' +
              '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    layoutGrid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>' +
              '<rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
    listIcon: '<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/>' +
              '<path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>',
    /* list-chevrons-up-down / -down-up: das Paar fuer eine Liste, die sich aufklappen bzw.
       zuklappen laesst -- "Show Pages" / "Hide Pages" in der Domains-Tabelle. Die Chevrons zeigen
       nach AUSSEN, solange zu ist (hier geht etwas auf), und nach INNEN, solange offen ist (hier
       geht etwas zu). Wortgleich aus dem Lucide-Bestand geholt, nicht nachgezeichnet. */
    /* Lucide list-filter: der Trichter mit drei Linien, OHNE Plus. listFilterPlus daneben ist der
       Ausloeser der einklappbaren Werkzeugleiste ("Filter hinzufuegen"); dieser hier sagt nur
       "Filter" und steht am "More Filters"-Knopf der Filterleiste. Wortgleich aus Lucide. */
    listFilter: '<path d="M2 5h20"/><path d="M6 12h12"/><path d="M9 19h6"/>',
    /* settings-2: zwei Schieber. Das Zeichen des "More Filters"-Knopfes -- es sagt "hier wird
       eingestellt", waehrend settings (das Zahnrad) in dieser App den Tabelleneinstellungen
       gehoert und listFilter dem Trichter. Wortgleich aus Lucide. */
    settings2: '<path d="M14 17H5"/><path d="M19 7h-9"/><circle cx="17" cy="17" r="3"/>' +
              '<circle cx="7" cy="7" r="3"/>',
    /* layers und mapPin: die Trigger-Zeichen des Modell- und des Markt-Filters. Sie standen dort
       je als rohes SVG in der Komponente; die Filterleiste braucht dieselben in ihren Zeilen, und
       zwei Kopien einer Form sind genau der Weg, auf dem sie auseinanderlaufen. */
    layers:   '<path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z"/>' +
              '<path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12"/>' +
              '<path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17"/>',
    mapPin:   '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/>' +
              '<circle cx="12" cy="10" r="3"/>',
    /* graduation-cap: der Docs-Knopf im Dashboard-Seitenkopf. Wortgleich aus Lucide. */
    graduationCap: '<path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/>' +
              '<path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>',
    listChevronsUpDown: '<path d="M3 5h8"/><path d="M3 12h8"/><path d="M3 19h8"/>' +
              '<path d="m15 8 3-3 3 3"/><path d="m15 16 3 3 3-3"/>',
    listChevronsDownUp: '<path d="M3 5h8"/><path d="M3 12h8"/><path d="M3 19h8"/>' +
              '<path d="m15 5 3 3 3-3"/><path d="m15 19 3-3 3 3"/>',
    arrowUpDown: PFAD_SORT,
    chartColumnUp:'<path d="M13 17V9"/><path d="M18 17V5"/>' +
              '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M8 17v-3"/>',
    /* Die Erklaer-Raute in Tabellenkoepfen. */
    info:     '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
    /* users und dollarSign: die beiden Unterseiten der Einstellungen -- in der Kopfzeile und im
       Konto-Menue der Leiste dasselbe Zeichen. Standen bisher nur als Konstante im Seitenkopf. */
    users:    '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><path d="M16 3.128a4 4 0 0 1 0 7.744"/>' +
              '<path d="M22 21v-2a4 4 0 0 0-3-3.87"/><circle cx="9" cy="7" r="4"/>',
    dollarSign: '<line x1="12" x2="12" y1="2" y2="22"/>' +
              '<path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
    /* megaphone: der Typ "What's new" in der Benachrichtigungskarte. */
    megaphone: '<path d="M11 6a13 13 0 0 0 8.4-2.8A1 1 0 0 1 21 4v12a1 1 0 0 1-1.6.8A13 13 0 0 0 11 14H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z"/>' +
              '<path d="M6 14a12 12 0 0 0 2.4 7.2 2 2 0 0 0 3.2-2.4A8 8 0 0 1 10 14"/><path d="M8 6v8"/>',
    /* Fuenf Symbole fuer die Benachrichtigungstypen. sparkle heisst in Lucide sparkles und ist
       dort eine Strichform, keine gefuellte -- der Schluessel bleibt, das Bild aendert sich. */
    sparkle:  '<path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"/>' +
              '<path d="M20 2v4"/><path d="M22 4h-4"/><circle cx="4" cy="20" r="2"/>',
    broadcast:'<path d="M4.9 16.1C1 12.2 1 5.8 4.9 1.9"/>' +
              '<path d="M7.8 4.7a6.14 6.14 0 0 0-.8 7.5"/><circle cx="12" cy="9" r="2"/>' +
              '<path d="M16.2 4.8c2 2 2.26 5.11.8 7.47"/><path d="M19.1 1.9a9.96 9.96 0 0 1 0 14.1"/>' +
              '<path d="M9.5 18h5"/><path d="m8 22 4-11 4 11"/>',
    clock:    '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    shieldCheck:'<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>' +
              '<path d="m9 12 2 2 4-4"/>',
    /* Aus prompts-table hierher: die Verwaltung der Gruppierungen braucht sie an zwei Orten, und
       "nie selbst gezeichnet" heisst auch "nicht zweimal als Konstante in zwei Dateien". Alle vier
       sind Lucide auf dem 24er Raster, unveraendert uebernommen. */
    eye: '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>',
    eyeOff: '<path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"/><path d="m2 2 20 20"/>',
    /* square-pen: Rahmen plus Stift. Dasselbe Zeichen, das das Zeilenmenue der Tabelle traegt. */
    /* Lucide astroid -- das Zeichen fuer "Create with AI". Ersetzt eine PNG-Maske von
       img.icons8.com: ein fremder Server im Ladepfad eines Knopfes, der in jeder Tabelle steht. */
    astroid: '<path d="M12.983 21.186a1 1 0 0 1-1.966 0 10 10 0 0 0-8.203-8.203 1 1 0 0 1 0-1.966 10 10 0 0 0 8.203-8.203 1 1 0 0 1 1.966 0 10 10 0 0 0 8.203 8.203 1 1 0 0 1 0 1.966 10 10 0 0 0-8.203 8.203"/>',
    squarePen: '<path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z"/>',
    /* refresh-cw, fuer "Generate More" in der Gruppenzeile. */
    refreshCw: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
    bulb:     '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/>' +
              '<path d="M9 18h6"/><path d="M10 22h4"/>',
    /* funnel-plus, wortgleich aus lucide-static 1.34.0 uebernommen -- nicht nachgezeichnet. Der
       Trichter ist unten offen und traegt rechts oben das Plus; genau daran erkennt man ihn vom
       schlichten funnel. Ausloeser der einklappbaren Werkzeugleiste in prompts-table. */
    /* list-filter-plus, wortgleich aus lucide-static 1.34.0 uebernommen -- nicht nachgezeichnet.
       Drei nach unten kuerzer werdende Striche (die Filterliste) plus ein Kreuz rechts oben.
       Ausloeser der einklappbaren Werkzeugleiste in prompts-table.
       Hier stand einen Commit lang funnelPlus, fuer denselben Knopf. Es ist mit raus statt liegen
       zu bleiben: ein unbenutztes Icon im Satz ist genau die Art Rest, die sich ansammelt und beim
       naechsten Lesen die Frage aufwirft, wer es braucht. */
    listFilterPlus: '<path d="M12 5H2"/><path d="M6 12h12"/><path d="M9 19h6"/>' +
                    '<path d="M16 5h6"/><path d="M19 8V2"/>'
  };
  /* ---- Mentioned-Brands-Dropdown: die zwei Teile, die in allen vier Tabellen gleich sind ------
     mentFilter(menu, query)  blendet die Eintraege aus, die nicht zur Suche passen, und schaltet
                              die "keine Treffer"-Zeile. Gibt die uebernommene Suche zurueck, damit
                              der Aufrufer sie in seinem eigenen mentQuery halten kann.
     mentHead(menu, brands, selected)  baut die Kopfzeile mit Titel und Reset/Select-all.

     Beide standen in urls-, domains-, prompts- und responses-table Zeichen fuer Zeichen gleich --
     mit EINEM Unterschied: domains-table fehlte die Null-Pruefung auf das Menue. Ein unvollstaendig
     eingehaengter Root (Bubble ersetzt Markup mitten im Rendern) haette dort geworfen, in den
     anderen drei nicht. Die Pruefung ist hier drin, also gilt sie jetzt fuer alle.

     Was NICHT hierher kommt: die Zustandsfelder (mentionSel/mentionApplied), das Feuern und die
     Beschriftung des Knopfes. Die haengen an den Event-Vertraegen der jeweiligen Tabelle und
     unterscheiden sich echt -- prompts-table nennt sein Event anders als urls-table. Ein Kit, das
     die auch noch verschluckt, waere vier Sonderfaelle unter einem Namen. */
  /* ---- variationRows(list, opts) -------------------------------------------------------------
     Die Variantentabelle: eine Zeile je Schreibweise, mit Anteil (Ring plus Prozent) und Anzahl.
     Steht im Radar-Detail seit jeher und wird jetzt auch auf der Marken-Detailseite gebraucht --
     zwei Verbraucher, also nach core (§25).

     Gibt HTML zurueck und nimmt nichts an, was mit Zustand zu tun hat: die Suche filtert der
     Aufrufer, weil sie an SEINEM Suchfeld haengt. Das Kit kennt nur Zeilen und die Frage, ob
     gerade gesucht wird -- davon haengt nur der Leertext ab.

     opts.query      aktuelle Suche; nur fuer die Hervorhebung und den Leertext
     opts.rowClass   zusaetzliche Klasse an der Zeile (upd-vrow bzw. ubd-vrow), damit jede Seite
                     ihr eigenes Spaltenraster behaelt
     opts.emptyText  Leertext ohne Suche. Mit Suche steht immer derselbe Satz da.

     mentions_total ist die Bezugsgroesse fuer "3 of 12", NICHT total_count -- das zaehlt die
     verschiedenen Varianten, nicht die Erwaehnungen. Zwei Groessen mit aehnlichem Namen, und die
     falsche stand hier einmal im Nenner. */
  /* Prozent kurz: ganze Zahl wenn der Nachkommateil unter 0.05 liegt, sonst eine Stelle. "<1%"
     statt "0%", wenn ein echter Anteil unter ein halbes Prozent faellt -- eine 0 waere dort die
     falsche Aussage. Stand lokal in performance-detail und wird vom Variations-Kit gebraucht. */
  function fmtPctShort(v, absolut){
    if (v == null || isNaN(v)) return "-";
    var n = Number(v);
    if (absolut && n > 0 && Math.round(n) === 0) return "<1%";
    return (Math.abs(n - Math.round(n)) < 0.05 ? fmtNum(Math.round(n), 0) : fmtNum(n, 1)) + "%";
  }

  var VAR_RING_R = 6, VAR_RING_C = 2 * Math.PI * VAR_RING_R;
  function variationRing(pct){
    var p = pct == null || isNaN(pct) ? 0 : Math.max(0, Math.min(100, Number(pct)));
    var an = (p / 100) * VAR_RING_C;
    /* Ring statt Balken: ein Balken laeuft ueber die ganze Spaltenbreite und macht die Zeile
       unruhig. Die -90-Grad-Drehung steckt im SVG, nicht in einer CSS-Transform, damit der Bogen
       in beiden Themes und bei jeder Schriftgroesse an derselben Stelle beginnt. */
    return '<span class="up-varring" aria-hidden="true">' +
      '<svg viewBox="0 0 16 16" width="16" height="16">' +
        '<circle class="up-varring-track" cx="8" cy="8" r="' + VAR_RING_R + '" fill="none" stroke-width="2.4"/>' +
        '<circle class="up-varring-fill" cx="8" cy="8" r="' + VAR_RING_R + '" fill="none" stroke-width="2.4"' +
          ' stroke-dasharray="' + an.toFixed(2) + ' ' + (VAR_RING_C - an).toFixed(2) + '"' +
          ' transform="rotate(-90 8 8)" stroke-linecap="round"/>' +
      '</svg></span>';
  }
  /* ---- Variations-Abschnitt (Kopf + Suche + Tabellenkopf) ------------------------------------
     Bisher stand dieser Block wortgleich in performance-detail.js. Zweiter Verbraucher ist
     brand-detail, also gehoert er nach §25 hierher -- sonst haben zwei Seiten dieselbe Tabelle mit
     verschiedenen Ueberschriften, Erklaertexten und Spaltenbreiten.

     `pfx` haengt an jede Klasse zusaetzlich eine komponenteneigene an (upd-/ubd-), damit jede Seite
     die Spaltenbreiten ihres Rasters selbst setzen kann -- im Radar-Detail steht die Tabelle in
     einer schmaleren Spalte als auf der Markenseite. Aussehen, Texte und Aufbau kommen von hier.
     `scope` faellt in die Erklaertexte ein: im Radar-Detail geht es um EIN Thema, auf der
     Markenseite um alle. */
  /* ---- Granularitaets-Verfuegbarkeit --------------------------------------------------------
     Welche Stufe waehlbar ist, haengt an der Spanne der gelieferten Serie: unter acht Tagen ist
     eine Wochenkurve ein einziger Punkt, unter einem Monat eine Monatskurve genauso. Beide
     Schwellen kommen aus visibility-chart, wo sie zuerst standen -- sie stehen jetzt hier, damit
     brand-detail nicht mit anderen Zahlen sperrt als das Chart daneben.

     Rueckgabe: die Stufe, die danach aktiv sein soll. War die bisherige gesperrt, ist das "day". */
  /* Nimmt entgegen, was ein Bubble-Ausdruck liefert: "Day", "weekly", "M", "month" -- alles
     landet auf day/week/month. null, wenn nichts Erkennbares kommt; dann behaelt der Aufrufer
     seinen Stand, statt auf einen Standard zu springen. Stand als normGran in visibility-chart. */
  function normGran(v){
    v = String(v == null ? "" : v).toLowerCase().trim();
    if (v.indexOf("month") === 0 || v === "mon" || v === "m") return "month";
    if (v.indexOf("week") === 0 || v === "w") return "week";
    if (v.indexOf("day") === 0 || v === "daily" || v === "d") return "day";
    return null;
  }

  function granRangeDays(series){
    var tage = [];
    (series || []).forEach(function(p){ if (p && p.day != null) tage.push(dayKey(p.day)); });
    if (!tage.length) return 0;
    tage.sort();
    var a = Date.parse(tage[0]), b = Date.parse(tage[tage.length - 1]);
    if (isNaN(a) || isNaN(b)) return tage.length;
    return Math.round((b - a) / 86400000) + 1;
  }

  /* Ueber drei Monaten ist eine Tageskurve unlesbar: 90 und mehr Punkte auf einer Chartbreite,
     die Achse beschriftet ohnehin nur vier Stellen. 92 Tage, damit drei Monate selbst noch als
     Tageskurve gehen und erst DARUEBER gesperrt wird. */
  var GRAN_DAY_MAX = 92;

  function granAvailability(root, series, aktuell){
    var spanne = granRangeDays(series);
    var btns = root ? [].slice.call(root.querySelectorAll(".vc-gran-btn")) : [];
    var erlaubt = {};
    btns.forEach(function(bn){
      var g = bn.getAttribute("data-gran");
      /* Nur sperren, wenn ueberhaupt Daten da sind (spanne > 0) -- sonst waeren beim ersten
         Rendern alle Stufen ausser Day gesperrt, bevor die Serie ankommt. */
      var aus = (g === "day"   && spanne > GRAN_DAY_MAX) ||
                (g === "week"  && spanne > 0 && spanne < 8) ||
                (g === "month" && spanne > 0 && spanne < 31);
      bn.classList.toggle("is-disabled", aus);
      if (aus) bn.setAttribute("aria-disabled", "true"); else bn.removeAttribute("aria-disabled");
      erlaubt[g] = !aus;
    });
    /* Faellt die aktive Stufe weg, die naechste erlaubte nehmen -- nicht blind "day". Bei einer
       Spanne ueber drei Monaten ist day selbst gesperrt, und ein Rueckfall dorthin haette den
       Schalter auf einen ausgegrauten Knopf gesetzt. */
    var neu = aktuell || "day";
    if (erlaubt[neu] === false) {
      neu = ["week", "month", "day"].filter(function(g){ return erlaubt[g]; })[0] || "day";
    }
    return neu;
  }

  function variationsExplain(scope){
    var wo = scope || "on this topic";
    return {
      name: { h: "Variation Name",
              t: "The exact wording an AI response used for this brand. Models rarely stick to one " +
                 "spelling \u2014 every variation here counts as the same brand, and a name that " +
                 "never appears is a name the models do not associate with you." },
      sov:  { h: "Share of Voice",
              t: "How much of this brand's mentions " + wo + " used this exact wording. High " +
                 "numbers on one variation mean the models have settled on a name; a flat spread " +
                 "across many means they have not." },
      cnt:  { h: "Mention Count",
              t: "How many times this wording appeared, out of all mentions of the brand " + wo +
                 ". The smaller the count, the less the share above rests on." }
    };
  }

  function variationsSection(opts){
    opts = opts || {};
    var pfx = opts.prefix || "up";
    var sub = opts.subtitle == null ? "Different brand names used in AI responses" : opts.subtitle;
    var search = opts.search === false ? "" :
      '<div class="up-search ' + pfx + '-search">' +
        '<button class="up-iconbtn up-search-btn" type="button" data-tip="' + esc(t_("Search variations")) + '" ' +
                'aria-label="' + esc(t_("Search variations")) + '">' + icon("search", 2) + '</button>' +
        '<div class="up-search-box">' +
          '<input class="up-search-input" type="text" autocomplete="off" spellcheck="false" ' +
                 'placeholder="' + esc(t_("Search variations")) + '">' +
          '<button class="up-search-clear" type="button" aria-label="' + esc(t_("Clear search")) + '">' +
            icon("x", 2) + '</button>' +
        '</div>' +
      '</div>';
    function th(key, label, cls){
      return '<div class="up-th ' + cls + '">' + esc(label) +
               '<span class="up-th-info" data-explain="' + key + '">' + icon("info", 2) + '</span>' +
             '</div>';
    }
    return '' +
      '<div class="up-varsec ' + pfx + '-varsec">' +
        '<div class="up-sec-head ' + pfx + '-sec-head">' +
          '<div class="up-sec-titles">' +
            '<span class="up-heading up-sec-h">' + esc(opts.title || t_("Variations")) + '</span>' +
            (sub ? '<span class="up-sec-sub">' + esc(sub) + '</span>' : "") +
          '</div>' + search +
        '</div>' +
        '<div class="up-vartable ' + pfx + '-vartable">' +
          '<div class="up-thead up-vrow ' + pfx + '-vrow">' +
            th("name", "Variation Name", "up-th-vname") +
            th("sov",  "Share of Voice",  "up-th-vsov") +
            th("cnt",  "Mention Count",   "up-th-vcnt") +
          '</div>' +
          '<div class="up-tbody up-vbody ' + pfx + '-vbody"></div>' +
        '</div>' +
      '</div>';
  }

  function variationRows(list, opts){
    opts = opts || {};
    var rows = list || [];
    var q = String(opts.query || "");
    var rowCls = "up-row" + (opts.rowClass ? " " + opts.rowClass : "");
    if (rows === null || list == null){
      /* Die Skelettzellen tragen DIESELBEN Zellklassen wie die echten Zeilen. Ohne sie haetten
         sie nur .up-td und damit keine Spaltenbreiten -- das Skelett stand dann breiter und
         versetzt zu der Tabelle, die es ankuendigt. Die Balken sitzen rechtsbuendig, wo die
         Zahlen spaeter stehen. */
      return skeletonRows({ count: 6, rowClass: rowCls, cellClass: "up-td",
                            cols: [{ w: 120, jitter: 40, cls: "up-var-name" },
                                   { w: 44,  cls: "up-var-sov" },
                                   { w: 28,  cls: "up-var-cnt" }] });
    }
    if (!rows.length){
      return '<div class="up-empty-mini">' +
        (q ? t_("No variation matches this search.")
           : (opts.emptyText || t_("No variations recorded."))) + '</div>';
    }
    return rows.map(function(v){
      var sov = toNum(v.share_of_voice_pct);
      var cnt = toNum(v.mentioned_count);
      var tot = toNum(v.mentions_total);
      return '<div class="' + rowCls + '">' +
               '<div class="up-td up-var-name"><span class="up-varname">' +
                 (q ? highlight(String(v.name || ""), q) : esc(String(v.name || ""))) + '</span></div>' +
               '<div class="up-td up-var-sov">' +
                 '<span class="up-num">' + (sov == null ? "-" : fmtPctShort(sov, true)) + '</span>' +
                 variationRing(sov) +
               '</div>' +
               '<div class="up-td up-var-cnt">' +
                 '<span class="up-num">' + (cnt == null ? "-" : Math.round(cnt)) + '</span>' +
                 (tot != null ? '<span class="up-var-of">of ' + Math.round(tot) + '</span>' : "") +
               '</div>' +
             '</div>';
    }).join("");
  }

  function mentFilter(menu, query){
    if (!menu) return query || "";
    var inp = menu.querySelector(".up-ment-search");
    var q = inp ? inp.value : (query || "");
    var needle = String(q || "").trim().toLowerCase();
    var items = menu.querySelectorAll(".up-filter-item[data-brand]");
    var shown = 0;
    Array.prototype.forEach.call(items, function(it){
      var match = !needle || (it.getAttribute("data-name") || "").indexOf(needle) > -1;
      it.style.display = match ? "" : "none";
      if (match) shown++;
    });
    var nr = menu.querySelector(".up-ment-noresult");
    if (nr) nr.style.display = (items.length && shown === 0) ? "" : "none";
    return q;
  }
  function mentHead(menu, brands, selected){
    if (!menu) return;
    var head = menu.querySelector(".up-filter-head");
    if (!head) return;
    var list = brands || [];
    var sel = selected || {};
    var selCount = Object.keys(sel).filter(function(k){ return sel[k]; }).length;
    head.innerHTML = '<span class="up-filter-title">Mentioned brands</span>' +
      (selCount
         ? '<button class="up-pop-action" type="button" data-mentreset>Reset</button>'
         : (list.length ? '<button class="up-pop-action" type="button" data-mentall>Select all</button>' : ""));
  }

  /* ---- Gefuellte Zeichen -----------------------------------------------------------------
     Alles in ICON_PATHS ist eine Strichzeichnung (fill:none, stroke:currentColor). Ein gefuelltes
     Zeichen ist eine andere Sache und braucht keinen Strich -- deshalb eine eigene Tabelle statt
     eines Parameters, den man an der Aufrufstelle vergessen kann. Der Name kommt in beide Faelle
     ueber dieselbe Funktion herein: UC.icon("name") entscheidet selbst, welche Sorte es ist.

     sidebarPanels: der Umschalter der Leiste. Das ist "layout-sidebar-inset" aus Bootstrap Icons
     (MIT), unveraendert uebernommen -- vorher stand hier eine selbst gezeichnete Form, die
     verworfen wurde. Zwei gefuellte Pfade: der Rahmen (als Ring aus zwei gegenlaeufigen Teilpfaden,
     deshalb ohne fill-rule) und das Feld links darin.
     Der viewBox bleibt der des Originals (16x16), die Groesse steht an der Stelle, wo das Zeichen
     sitzt: 14px in der Leiste, siehe .usn-toggle in sidebar.css. Ebenso die Deckkraft. */
  var ICON_FILLED = {
    sidebarPanels: '<svg viewBox="0 0 16 16" fill="currentColor" stroke="none">' +
      '<path d="M14 2a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1h12zM2 1a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2H2z"/>' +
      '<path d="M3 4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4z"/></svg>'
  };
  function icon(name, strokeWidth){
    var f = ICON_FILLED[name];
    /* Ein Eintrag darf sein eigenes svg mitbringen, wenn er einen anderen viewBox braucht als den
       24er-Kasten -- sonst nur die Formen, und der Kasten kommt von hier. */
    if (f) return f.charAt(0) === "<" && f.indexOf("<svg") === 0
      ? f
      : '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none">' + f + '</svg>';
    var d = ICON_PATHS[name];
    if (!d){
      if (window.console) console.error("upstreem: kein Icon namens \"" + name + "\" -- " +
        "vorhanden sind: " + Object.keys(ICON_PATHS).concat(Object.keys(ICON_FILLED)).join(", "));
      return "";
    }
    var w = (strokeWidth == null) ? 2 : strokeWidth;
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + w +
           '" stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>';
  }

  /* ---------- leseFehlerHtml ----------
     Der Zustand "es kam etwas an, aber es war nicht lesbar" -- die dritte Moeglichkeit neben
     "laedt" und "ist leer". Vorher hatte ihn keine Tabelle, also sah ein zerrissener Payload
     entweder aus wie endloses Laden oder wie ein sauberes leeres Ergebnis (§46).

     Steht in core, weil vier Tabellen und die Charts denselben Zustand brauchen -- vier Kopien
     desselben Kastens sind genau die Stelle, an der spaeter drei davon repariert werden.

     `was` ist der Plural des Dings, das fehlt ("URLs", "domains", "prompts"). Der zweite Satz
     nennt bewusst KEIN Substantiv, damit er zu jedem passt, und er sagt, was der Nutzer tun
     kann. Keine Diagnose, keine internen Namen, kein Verweis auf die Konsole -- das liest hier
     niemand, den es angeht. */
  function leseFehlerHtml(was){
    return '<div class="up-empty">' +
      '<div class="up-empty-ic">' + icon("info", 1.6) + '</div>' +
      '<div class="up-empty-h">' + esc(t_("Could not load {was}").replace("{was}", t_(was || "data"))) + '</div>' +
      '<div class="up-empty-t">' + esc(t_("The data could not be read. Please reload the page.")) + '</div>' +
    '</div>';
  }

  /* ══ Custom Groupings ═══════════════════════════════════════════════════════════════════════
     Eine Gruppierung ist eine benannte Kombination aus bis zu drei Themen: ein Prompt zaehlt zur
     Gruppe, wenn er ALLE davon traegt. Sie lebt im localStorage, teambezogen, ohne Backend --
     genau wie bisher in prompts-table, wo dieses Stueck entstanden ist.

     Warum es hier steht: es gibt die Verwaltung an ZWEI Orten (das Dropdown der prompts-table und
     der Abschnitt im topics-manager), und "1:1 dasselbe" ist nur zu halten, wenn es EIN Stueck Code
     ist. Eine Kopie waere schon beim naechsten Feinschliff auseinandergelaufen.
     Der Speicherschluessel ist derselbe wie vorher (storeKey("promptGroups")) -- eine Gruppierung,
     die im topics-manager entsteht, steht damit sofort im Dropdown der Tabelle und umgekehrt. */
  function cgKey(){ return storeKey("promptGroups"); }
  function cgRead(){
    try {
      var raw = window.localStorage.getItem(cgKey());
      if (!raw) return [];
      var arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return [];
      /* Dieselbe Pruefung wie bisher: ein Eintrag ohne Namen oder ohne Themen ist keiner. */
      return arr.filter(function(g){
        return g && typeof g.key === "string" && g.key && isArr(g.tag_ids) && g.tag_ids.length;
      });
    } catch(e){ return []; }
  }
  function cgWrite(list){
    try { window.localStorage.setItem(cgKey(), JSON.stringify(list || [])); } catch(e){}
  }
  /* Kanalweiser Mittelwert der Themenfarben. Eine Gruppe aus einem blauen und einem gruenen Thema
     liest sich als das Blaugruen dazwischen -- das ist, wie "die gehoeren zusammen" aussehen soll.
     Ueberschreiben kann man es in der Farbwahl weiterhin. */
  function cgMixHex(list){
    var cols = (list || []).map(function(h){
      h = String(h || "").replace("#", "");
      if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
      return /^[0-9a-fA-F]{6}$/.test(h) ? h : null;
    }).filter(Boolean);
    if (!cols.length) return TOPIC_COLOR_PALETTE[0];
    var r=0, g=0, b=0;
    cols.forEach(function(h){
      r += parseInt(h.slice(0,2),16); g += parseInt(h.slice(2,4),16); b += parseInt(h.slice(4,6),16);
    });
    function two(n){ n = Math.round(n / cols.length).toString(16); return n.length < 2 ? "0"+n : n; }
    return "#" + two(r) + two(g) + two(b);
  }

  var CG_MAX_TOPICS = 3;
  var CG_TOPICS_COLLAPSED = 10;   /* soviele zeigen, dann ein "Show all"-Knopf */

  /* Das Anlegen-/Bearbeiten-Fenster. Aufruf:
       var m = UC.makeGroupingModal({
         getIsDark:  fn -> bool,
         getTopics:  fn -> [ {name, emoji, hex_light, hex_dark, ...} ],
         topicId:    fn(t) -> string        (optional; Standard sucht die ueblichen Felder ab)
         onSave:     fn({ key, tag_ids, color })   -- Speichern liegt beim Aufrufer, weil beide
                     Orte danach etwas anderes tun (die Tabelle holt Gruppen nachladen, der
                     Manager zeichnet nur seine Liste neu)
       });
       m.open();            neu anlegen
       m.open(eintrag);     bearbeiten
     Die Klassen tragen doppelte Namen (.up-cgm-* UND .upt-gm-*): die Regeln dazu standen in
     prompts-table.css und liegen jetzt in core.css, mit beiden Selektoren in derselben Regel. So
     bleibt die Tabelle pixelgleich, der Manager bekommt dasselbe Aussehen, und kein Klassenname
     verschwindet aus dem Vertrag. */
  function makeGroupingModal(cfg){
    cfg = cfg || {};
    var getIsDark = cfg.getIsDark || function(){ return false; };
    var getTopics = cfg.getTopics || function(){ return []; };
    var idOf = cfg.topicId || function(t){
      return String((t && (t.topic_id || t.tag_id || t.id || t.name)) || "");
    };
    var onSave = cfg.onSave || function(){};
    var SEARCH_SVG = icon("search", 2);

    var modal = null, picked = {}, farbe = null, farbOffen = false,
        nameBeruehrt = false, suche = "", sucheOffen = false, alleZeigen = false,
        bearbeitet = null;   /* der Eintrag, der bearbeitet wird, oder null */

    function pickedIds(){
      return getTopics().map(idOf).filter(function(id){ return picked[id]; });
    }
    function topicById(id){
      return getTopics().filter(function(t){ return idOf(t) === id; })[0];
    }
    function autoColor(){
      return cgMixHex(pickedIds().map(function(id){
        var t = topicById(id); return t && (t.hex_light || t.hex_dark);
      }));
    }
    function autoName(){
      return pickedIds().map(function(id){
        var t = topicById(id); return t ? String(t.name == null ? "" : t.name) : "";
      }).filter(Boolean).join(" & ");
    }
    /* Der Platzhalter im Namensfeld ist ein ZUFAELLIGES Paar echter Themennamen dieser Seite --
       "Sedans & SUVs" waere erfunden und saehe wie ein Vorschlag aus, den es gar nicht gibt.
       Unter zwei Themen gibt es kein Paar, dann der neutrale Text. Exakt die Fassung, die in
       prompts-table stand. */
    function platzhalter(){
      var names = getTopics().map(function(t){ return String(t.name == null ? "" : t.name); })
                             .filter(Boolean);
      if (names.length < 2) return t_("Group name…");
      var i = Math.floor(Math.random() * names.length);
      var j = Math.floor(Math.random() * (names.length - 1));
      if (j >= i) j += 1;
      return names[i] + " & " + names[j];
    }

    function chipHtml(t){
      var id = idOf(t), on = !!picked[id];
      var color = String(t.hex_light || t.hex_dark || "#6b7280");
      if (color.charAt(0) !== "#") color = "#" + color;
      return '<button type="button" class="up-topicchip up-chiphover' + (on ? " is-on" : "") +
        '" data-gm-topic="' + esc(id) + '" style="--ust-tag-color:' + esc(color) + '">' +
        (t.emoji ? '<span class="up-topicchip-e">' + esc(t.emoji) + '</span>' : "") +
        '<span class="up-topicchip-lbl">' + esc(t.name == null ? "" : t.name) + '</span>' +
        '<span class="up-topicchip-check' + (on ? " is-on" : "") + '">' + CHECK_SVG + '</span>' +
      '</button>';
    }

    function renderBody(animateList){
      if (!modal) return;
      var n = pickedIds().length, voll = n >= CG_MAX_TOPICS;
      var q = suche.trim().toLowerCase();
      var gefunden = getTopics().filter(function(t){
        return !q || String(t.name || "").toLowerCase().indexOf(q) > -1;
      });
      /* Eingeklappt, damit zehn Themen keine Wand werden; ausgeklappt wird die Liste ein
         Scrollbereich, statt hundert Themen aus dem Fenster zu schieben. */
      var verborgen = Math.max(0, gefunden.length - CG_TOPICS_COLLAPSED);
      var sichtbar = (alleZeigen || !verborgen) ? gefunden : gefunden.slice(0, CG_TOPICS_COLLAPSED);
      var list = modal.querySelector(".up-cgm-list");
      if (list){
        list.className = "up-cgm-list upt-gm-list up-topiclist" + (voll ? " is-full" : "") +
                         (alleZeigen ? " is-scroll" : "");
        var html = sichtbar.length ? sichtbar.map(chipHtml).join("")
                                   : '<div class="up-cgm-empty upt-topicmenu-empty">No topics match</div>';
        /* Dieselbe Mechanik wie im Popover: Chips, die verrutschen, weil ein Haken erscheint,
           gleiten an ihren neuen Platz statt zu springen. */
        if (animateList && typeof flipReplace === "function") flipReplace(list, html, "[data-gm-topic]");
        else list.innerHTML = html;
      }
      var moreBtn = modal.querySelector(".up-cgm-more");
      if (moreBtn){
        var zeigen = verborgen > 0 && !alleZeigen;
        moreBtn.style.display = zeigen ? "" : "none";
        /* Der Satz wird GEBAUT und nicht zusammengeklebt: im Deutschen steht die Zahl an
           anderer Stelle. {n} ist der Platzhalter, den der Katalog mitnimmt. */
        moreBtn.textContent = zeigen
          ? t_("Show all {n} topics").replace("{n}", gefunden.length) : "";
      }
      var sw = modal.querySelector(".up-cgm-search");
      if (sw) sw.classList.toggle("is-open", sucheOffen);
      var sbtn = modal.querySelector(".up-cgm-searchbtn");
      if (sbtn) sbtn.classList.toggle("is-open", sucheOffen);
      var cnt = modal.querySelector(".up-cgm-count");
      if (cnt) cnt.textContent = n + "/" + CG_MAX_TOPICS;

      var nameEl = modal.querySelector(".up-cgm-name-in");
      /* Vorbelegt aus den gewaehlten Themen ("Sedans & SUVs"), bis der Nutzer selbst tippt. */
      if (nameEl && !nameBeruehrt) nameEl.value = autoName();
      if (nameEl && bearbeitet && !nameEl.value) nameEl.value = bearbeitet.key;
      var col = farbe || autoColor();
      var dot = modal.querySelector(".up-cgm-dot");
      if (dot) dot.style.background = col;

      var wrap = modal.querySelector(".up-cgm-colorwrap");
      if (wrap) wrap.classList.toggle("is-open", farbOffen);
      /* Das Panel selbst wird nie neu erzeugt (nur sein innerHTML), damit ein nach dem Einhaengen
         gesetztes .is-open jeden Neuaufbau ueberlebt -- eine Farbwahl frischt nur den Haken auf und
         spielt die Eingangsbewegung nicht erneut. */
      var panel = modal.querySelector(".up-cgm-colorpanel");
      if (panel){
        if (farbOffen){
          panel.innerHTML = '<div class="up-cgm-colorgrid upt-colorgrid">' + TOPIC_COLOR_PALETTE.map(function(hx){
              var on = hx === col;
              return '<button type="button" class="up-cgm-colorcell upt-colorcell" data-gm-color="' + esc(hx) + '"' +
                ' aria-label="' + esc(hx) + '" aria-pressed="' + (on ? "true" : "false") + '">' +
                '<span class="up-cgm-colorblob upt-colorblob" style="background:' + esc(hx) + '">' +
                  (on ? CHECK_SVG : "") + '</span>' +
              '</button>';
            }).join("") + '</div>';
        } else { panel.innerHTML = ""; panel.classList.remove("is-open"); }
      }
      var sub = modal.querySelector(".up-cgm-submit");
      if (sub) sub.disabled = !(nameEl && nameEl.value.trim() && n);
    }

    function zu(){
      if (!modal) return;
      modal.classList.remove("is-shown");
      var m = modal;
      setTimeout(function(){ if (m && m.parentNode) m.parentNode.removeChild(m); }, 160);
      modal = null;
      document.removeEventListener("keydown", taste, true);
    }
    function taste(e){ if (e.key === "Escape"){ e.stopPropagation(); zu(); } }

    function auf(eintrag){
      zu();
      bearbeitet = eintrag || null;
      picked = {}; farbe = bearbeitet ? (bearbeitet.color || null) : null;
      farbOffen = false; nameBeruehrt = !!bearbeitet;
      suche = ""; sucheOffen = false; alleZeigen = false;
      if (bearbeitet) (bearbeitet.tag_ids || []).forEach(function(id){ picked[String(id)] = true; });
      modal = document.createElement("div");
      modal.className = "up-topicmodal-backdrop up-cgm-backdrop upt-gm-backdrop";
      if (getIsDark()) modal.setAttribute("data-theme", "dark");
      modal.innerHTML =
        '<div class="up-topicmodal-card" role="dialog" aria-modal="true" aria-label="' +
            esc(t_(bearbeitet ? "Edit Grouping" : "New Grouping")) + '">' +
          '<div class="up-topicmodal-head">' +
            '<div class="up-topicmodal-heading">' +
              '<h3 class="up-topicmodal-title">' + esc(t_(bearbeitet ? "Edit Grouping" : "New Grouping")) + '</h3>' +
              '<p class="up-topicmodal-sub">Combine several topics into one group. A prompt counts ' +
                'towards the group only if it carries <strong>all</strong> of the topics.</p>' +
            '</div>' +
            '<button class="up-topicmodal-close" type="button" data-gm-close aria-label="' + esc(t_("Close")) + '">' + CLOSE_SVG_TM + '</button>' +
          '</div>' +
          '<div class="up-topicmodal-body">' +
            '<div class="up-topicmodal-field">' +
              '<div class="up-cgm-labelrow upt-gm-labelrow">' +
                '<span class="up-topicmodal-label">Topics</span>' +
                '<span class="up-cgm-right upt-gm-right">' +
                  '<button class="up-cgm-searchbtn upt-gm-searchbtn" type="button" data-gm-searchtoggle aria-label="' + esc(t_("Search topics")) + '">' +
                    SEARCH_SVG + '</button>' +
                  '<span class="up-cgm-count upt-gm-count">0/' + CG_MAX_TOPICS + '</span>' +
                '</span>' +
              '</div>' +
              '<div class="up-cgm-search upt-gm-search">' +
                '<input class="up-cgm-search-in upt-gm-search-in" type="text" placeholder="' + esc(t_("Search topics…")) + '" autocomplete="off" spellcheck="false"/>' +
                '<button class="up-cgm-clear upt-gm-clear" type="button" data-gm-clear aria-label="' + esc(t_("Clear search")) + '">' + CLOSE_SVG_TM + '</button>' +
              '</div>' +
              '<div class="up-cgm-list upt-gm-list up-topiclist"></div>' +
              '<button class="up-cgm-more upt-gm-more" type="button" data-gm-more></button>' +
            '</div>' +
            '<div class="up-topicmodal-field">' +
              '<span class="up-topicmodal-label">Group name</span>' +
              '<div class="up-cgm-namerow upt-gm-namerow">' +
                '<div class="up-cgm-colorwrap upt-gm-colorwrap">' +
                  '<button class="up-cgm-dotbtn upt-gm-dotbtn" type="button" data-gm-colorbtn aria-label="' + esc(t_("Group color")) + '">' +
                    '<span class="up-cgm-dot upt-gm-dot"></span></button>' +
                '</div>' +
                '<input class="up-topicmodal-name up-cgm-name-in upt-gm-name-in" type="text" placeholder="' +
                  esc(platzhalter()) + '" autocomplete="off" spellcheck="false"/>' +
              '</div>' +
              '<div class="up-cgm-colorpanel upt-gm-colorpanel"></div>' +
            '</div>' +
          '</div>' +
          '<div class="up-topicmodal-foot">' +
            '<button class="up-topicmodal-save up-cgm-submit upt-gm-submit" type="button" data-gm-submit disabled>' +
              esc(t_(bearbeitet ? "Save" : "Create grouping")) + '</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(modal);
      renderBody();
      requestAnimationFrame(function(){ if (modal) modal.classList.add("is-shown"); });
      document.addEventListener("keydown", taste, true);

      modal.addEventListener("input", function(e){
        if (e.target.classList.contains("up-cgm-name-in")){ nameBeruehrt = true; renderBody(); return; }
        if (e.target.classList.contains("up-cgm-search-in")){ suche = e.target.value; renderBody(); return; }
      });
      modal.addEventListener("click", function(e){
        if (e.target === modal){ zu(); return; }
        if (e.target.closest("[data-gm-close]")){ zu(); return; }
        if (e.target.closest("[data-gm-more]")){ alleZeigen = true; renderBody(); return; }
        if (e.target.closest("[data-gm-searchtoggle]")){
          sucheOffen = !sucheOffen;
          if (!sucheOffen) suche = "";
          renderBody();
          if (sucheOffen){
            var si2 = modal.querySelector(".up-cgm-search-in");
            if (si2) setTimeout(function(){ try { si2.focus(); } catch(x){} }, 60);
          }
          return;
        }
        if (e.target.closest("[data-gm-clear]")){
          suche = "";
          var si = modal.querySelector(".up-cgm-search-in");
          if (si){ si.value = ""; si.focus(); }
          renderBody(); return;
        }
        if (e.target.closest("[data-gm-colorbtn]")){
          var warOffen = farbOffen;
          farbOffen = !farbOffen;
          renderBody();
          /* Aufgehen wird animiert, in zwei Schritten: erst eingeklappt einhaengen, dann im
             naechsten Bild .is-open -- sonst hat der Browser kein "davor" zum Ueberblenden.
             Derselbe Trick wie beim Fenster selbst mit .is-shown. Zugehen ist ohne Bewegung. */
          if (!warOffen && farbOffen){
            var p0 = modal.querySelector(".up-cgm-colorpanel");
            if (p0) requestAnimationFrame(function(){ p0.classList.add("is-open"); });
          }
          return;
        }
        var cc = e.target.closest("[data-gm-color]");
        /* Bleibt beim Waehlen offen -- wie die Emoji- und Farbwahl ueberall sonst. */
        if (cc){ farbe = cc.getAttribute("data-gm-color"); renderBody(); return; }
        var chip = e.target.closest("[data-gm-topic]");
        if (chip){
          var tid = chip.getAttribute("data-gm-topic");
          if (picked[tid]) delete picked[tid];
          else if (pickedIds().length < CG_MAX_TOPICS) picked[tid] = true;
          else return;                       /* an der Grenze; .is-full sagt es schon optisch */
          renderBody(true);
          return;
        }
        if (e.target.closest("[data-gm-submit]")){
          var nameEl = modal.querySelector(".up-cgm-name-in");
          var name = nameEl ? nameEl.value.trim() : "";
          var ids = pickedIds();
          if (!name || !ids.length) return;
          var eintragNeu = { key: name, tag_ids: ids, color: farbe || autoColor() };
          /* Beim Umbenennen ersetzt der neue Eintrag den alten -- und ein bestehender gleichen
             Namens wird ueberschrieben, nicht verdoppelt. Die Reihenfolge bleibt sonst erhalten:
             wer bearbeitet, will seine Gruppe nicht ans Ende geschoben sehen. */
          var altKey = bearbeitet ? bearbeitet.key : null;
          var liste = cgRead();
          var pos = -1, i;
          for (i = 0; i < liste.length; i++) if (liste[i].key === altKey){ pos = i; break; }
          var ohne = liste.filter(function(g){ return g.key !== name && g.key !== altKey; });
          if (pos >= 0 && pos <= ohne.length) ohne.splice(pos, 0, eintragNeu);
          else ohne.push(eintragNeu);
          /* Ein verstecktes bleibt versteckt. */
          if (bearbeitet && bearbeitet.hidden) eintragNeu.hidden = true;
          cgWrite(ohne);
          zu();
          try { onSave(eintragNeu); } catch(x){}
          return;
        }
      });
    }

    return { open: auf, close: zu, isOpen: function(){ return !!modal; } };
  }

  /* ---- Bausteine einer Gruppierungs-Zeile ---------------------------------------------------
     Punkt, Auge und Dreipunktmenue sehen an beiden Orten gleich aus, also stehen sie hier. Die
     Klassen sind doppelt (Kit-Name plus der alte .upt-group-*-Name), damit die Regeln der
     prompts-table weiter greifen und kein Name aus dem Vertrag faellt. */
  function cgDotHtml(color){
    return '<span class="up-cg-dot upt-grp-cdot" style="background:' + esc(color || "#6b7280") + '"></span>';
  }
  function cgEyeHtml(g){
    var aus = !!(g && g.hidden);
    return '<button class="up-cg-eye upt-group-eye' + (aus ? " is-off" : "") + '" type="button" ' +
      'data-grp-eye="' + esc(g.key) + '" aria-label="' + esc(t_(aus ? "Show grouping" : "Hide grouping")) +
      '" aria-pressed="' + (aus ? "true" : "false") + '">' + icon(aus ? "eyeOff" : "eye", 2) + '</button>';
  }
  /* offen: der Schluessel, dessen Zeilenmenue steht -- oder null. Das Menue oeffnet nach LINKS,
     weil die Zeile am rechten Rand ihres Behaelters sitzt. */
  function cgMoreHtml(g, offen){
    var auf = offen === g.key;
    return '<button class="up-cg-more upt-group-more" type="button" data-grp-rowmenu="' + esc(g.key) +
        '" aria-label="Group actions" aria-haspopup="menu">' + icon("moreHorizontal", 2) + '</button>' +
      (auf ? '<div class="up-menu up-cg-rowmenu upt-group-rowmenu is-shown" role="menu">' +
          '<div class="up-pop-opt" data-grp-edit="' + esc(g.key) + '">Edit</div>' +
          '<div class="up-pop-opt is-danger" data-grp-del="' + esc(g.key) + '">Delete</div>' +
        '</div>' : "");
  }

  /* ---- Umsortieren per Zeiger --------------------------------------------------------------
     Nicht die HTML5-Drag-API: die zeichnet ein eigenes Geisterbild, meldet dragover nur in
     Intervallen und nur ueber gueltigen Zielen, und jeder Schritt braucht ein preventDefault --
     im Ergebnis hakelig. pointerdown/move/up laeuft so fluessig wie die angehefteten Eintraege der
     Sidebar, und es ist dieselbe Mechanik.
     Delegiert am BEHAELTER, nicht an den Zeilen: der ueberlebt jedes Neuzeichnen, weil nur sein
     innerHTML ersetzt wird. Die gezogene Zeile wird im DOM verschoben, sobald der Zeiger die Mitte
     einer anderen passiert -- die Liste steht also immer schon so, wie sie nach dem Loslassen
     aussieht. Erst nach 4px Bewegung wird es ein Ziehen, sonst bliebe kein Klick uebrig.
     cfg: { rowSel, noDragSel, onOrder(keys), onDrop() } */
  function cgDragList(container, cfg){
    if (!container || container.__upCgDrag) return;
    container.__upCgDrag = true;
    cfg = cfg || {};
    var rowSel = cfg.rowSel || "[data-grp-drag]";
    var attr = rowSel.replace(/^\[|\]$/g, "");
    var noDrag = cfg.noDragSel || ".up-cg-eye, .up-cg-more, .up-cg-rowmenu";
    var zieh = null, gezogen = false;
    function klassenWeg(){
      [].forEach.call(container.querySelectorAll(rowSel), function(r){ r.classList.remove("is-dragging"); });
    }
    container.addEventListener("pointerdown", function(e){
      if (!e.target.closest) return;
      if (e.target.closest(noDrag)) return;          /* Auge, Kebab und Menue ziehen nicht */
      var row = e.target.closest(rowSel);
      if (!row) return;
      zieh = { row: row, body: row.parentNode, y0: e.clientY, aktiv: false };
      try { row.setPointerCapture(e.pointerId); } catch(err){}
    });
    container.addEventListener("pointermove", function(e){
      if (!zieh) return;
      if (!zieh.aktiv){
        if (Math.abs(e.clientY - zieh.y0) < 4) return;
        zieh.aktiv = true;
        zieh.row.classList.add("is-dragging");
      }
      var zeilen = [].slice.call(zieh.body.querySelectorAll(rowSel));
      for (var i = 0; i < zeilen.length; i++){
        var z = zeilen[i];
        if (z === zieh.row) continue;
        var r = z.getBoundingClientRect();
        if (e.clientY < r.top || e.clientY > r.bottom) continue;
        var davor = (e.clientY - r.top) < r.height / 2;
        zieh.body.insertBefore(zieh.row, davor ? z : z.nextSibling);
        break;
      }
    });
    function ende(){
      if (!zieh) return;
      var z = zieh; zieh = null;
      z.row.classList.remove("is-dragging");
      if (!z.aktiv) return;                          /* war nur ein Klick */
      /* Nach dem Ziehen folgt ein click auf derselben Zeile -- der darf nicht auch noch etwas
         auswaehlen. Die Marke haelt genau diesen einen Klick auf; am Knoten kann sie nicht haengen,
         weil das Neuzeichnen ihn gleich ersetzt. */
      gezogen = true;
      var keys = [].map.call(container.querySelectorAll(rowSel), function(el){
        return el.getAttribute(attr.split("=")[0]);
      });
      klassenWeg();
      if (cfg.onOrder) cfg.onOrder(keys);
      if (cfg.onDrop) cfg.onDrop();
    }
    container.addEventListener("pointerup", ende);
    container.addEventListener("pointercancel", ende);
    /* Im capture, damit der Klick vor allen anderen Zuhoerern aufgehalten wird. */
    container.addEventListener("click", function(e){
      if (!gezogen) return;
      gezogen = false;
      if (e.target.closest && e.target.closest(rowSel)){ e.stopPropagation(); e.preventDefault(); }
    }, true);
  }
  /* ---- Die drei Schreiboperationen ----------------------------------------------------------
     Sie standen als vier gleiche filter()-Zeilen in prompts-table und waeren im topics-manager ein
     zweites Mal entstanden. Jede schreibt selbst und gibt die neue Liste zurueck, damit der
     Aufrufer nicht erneut lesen muss. */
  function cgFind(key){
    var l = cgRead();
    for (var i = 0; i < l.length; i++) if (l[i].key === key) return l[i];
    return null;
  }
  /* hidden: true versteckt, false LOESCHT das Feld statt es auf false zu setzen -- der Eintrag
     bleibt damit so schmal wie der, den das Fenster schreibt, und ein Vergleich der beiden Formen
     faellt nicht auf. Ohne Argument wird umgeschaltet. */
  function cgSetHidden(key, hidden){
    var liste = cgRead().map(function(g){
      if (g.key !== key) return g;
      var soll = (hidden == null) ? !g.hidden : !!hidden;
      if (soll) g.hidden = true; else delete g.hidden;
      return g;
    });
    cgWrite(liste);
    return liste;
  }
  function cgDelete(key){
    var liste = cgRead().filter(function(g){ return g.key !== key; });
    cgWrite(liste);
    return liste;
  }

  /* Die neue Reihenfolge festschreiben: sichtbare in der uebergebenen Ordnung, verborgene
     dahinter in ihrer bisherigen relativen Ordnung -- sie sind nie Teil des Ziehens. */
  function cgApplyOrder(keys){
    var alle = cgRead(), nach = {};
    alle.forEach(function(g){ nach[g.key] = g; });
    var verborgen = alle.filter(function(g){ return g.hidden; });
    cgWrite((keys || []).map(function(k){ return nach[k]; })
              .filter(function(g){ return g && !g.hidden; }).concat(verborgen));
  }


  var API = {
    BUILD: BUILD,
    EMPTY_GRACE_MS: EMPTY_GRACE_MS,
    icon: icon,
    fmtPctShort: fmtPctShort,
    variationRows: variationRows,
    variationRing: variationRing,
    granAvailability: granAvailability,
    normGran: normGran,
    granRangeDays: granRangeDays,
    dayKey: dayKey,
    variationsSection: variationsSection,
    variationsExplain: variationsExplain,
    mentFilter: mentFilter,
    mentHead: mentHead,
    upstreemSetTheme: upstreemSetTheme,
    readPrefTheme: readPrefTheme,
    themeGuard: themeGuard,
    dropdownOpened: dropdownOpened,
    closeAllDropdowns: closeAllDropdowns,
    onViewChange: onViewChange,
    fireViewChange: fireViewChange,
    CITE_COLOR: CITE_COLOR,
    CITE_ALIAS: CITE_ALIAS,
    ALL_CITATION_TYPES: ALL_CITATION_TYPES,
    URL_TYPE: URL_TYPE,
    ALL_URL_TYPES: ALL_URL_TYPES,
    CITE_DESC: CITE_DESC,
    URL_TYPE_DESC: URL_TYPE_DESC,
    typeLabel: typeLabel,
    typeDesc: typeDesc,
    OTHER_LIGHT: OTHER_LIGHT,
    OTHER_DARK: OTHER_DARK,
    CHIP_BG_DARK: CHIP_BG_DARK,
    MONTHS: MONTHS,
    DEBOUNCE: DEBOUNCE,
    MIN: MIN,
    SORT_DEBOUNCE: SORT_DEBOUNCE,
    PAGE_SIZES: PAGE_SIZES,
    DEFAULT_PAGE_SIZE: DEFAULT_PAGE_SIZE,
    fmtTotal: fmtTotal,
    isYes: isYes,
    parseLoose: parseLoose,
    normParams: normParams,
    makeToolGroup: makeToolGroup,
    leseFehlerHtml: leseFehlerHtml,
    getTeam: getTeam,
    setUpstreemTeam: setUpstreemTeam,
    storeKey: storeKey,
    prefKey: prefKey,
    prefGet: prefGet,
    prefSet: prefSet,
    heatRamp: heatRamp,
    heatAt: heatAt,
    getTopics: getTopics,
    setTopics: setTopics,
    onTopics: onTopics,
    topicsAge: topicsAge,
    topicsChanged: topicsChanged,
    getModels: getModels,
    setModels: setModels,
    onModels: onModels,
    getMarkets: getMarkets,
    setMarkets: setMarkets,
    setAllMarkets: setAllMarkets,
    getAllMarkets: getAllMarkets,
    onAllMarkets: onAllMarkets,
    onMarkets: onMarkets,
    marketsChanged: marketsChanged,
    getBrands: getBrands,
    /* Diagnose fuer leere Zustaende: wie oft wurde der Setter gerufen, wie oft war die
       Payload unlesbar. Damit kann ein leerer Store sagen, WARUM er leer ist. */
    dumpMarkets: dumpMarkets,
    storeStats: function(){
      function one(S){
        return { calls: S.calls || 0, rejected: S.rejected || 0, n: S.list.length,
                 rowsIn: S.lastIn == null ? null : S.lastIn, shape: S.lastShape || null };
      }
      return { topics: one(TOPICS), markets: one(MARKETS),
               allMarkets: one(ALL_MARKETS), brands: one(BRANDS) };
    },
    setBrands: setBrands,
    onBrands: onBrands,
    brandsChanged: brandsChanged,
    brandsInto: brandsInto,
    setUpstreemTheme: setUpstreemTheme,
    onTheme: onTheme,
    getUpstreemTheme: getUpstreemTheme,
    themeParam: themeParam,
    highlight: highlight,
    redditTitleHtml: redditTitleHtml,
    esc: esc,
    parseBubbleJson: parseBubbleJson,
    readBubble: readBubble,
    citeName: citeName,
    tint: tint,
    brighten: brighten,
    darken: darken,
    toNum: toNum,
    fmt1: fmt1,
    fmtInt: fmtInt,
    fmtDate: fmtDate,
    foldDiacritics: foldDiacritics,
    germanExpand: germanExpand,
    resolveBubbleFn: resolveBubbleFn,
    TREND_UP: TREND_UP,
    TREND_DOWN: TREND_DOWN,
    CHECK_SVG: CHECK_SVG,
    COPY_SVG: COPY_SVG,
    GOTO_SVG: GOTO_SVG,
    HASH_ICON: HASH_ICON,
    EXPLAIN_TEXT: EXPLAIN_TEXT,
    explainCopy: explainCopy,
    mentCell: mentCell,
    MENT_CHECK_SVG: MENT_YES_SVG,
    DONE_SVG: DONE_SVG,
    EXT_SVG: EXT_SVG,

    /* ---- table primitives ---- */
    trendChip: trendChip,
    sentColor: sentColor,
    brandStack: brandStack,
    relativeTime: relativeTime,
    modelChip: modelChip,
    marketChip: marketChip,
    aufResize: aufResize,
    beobachteGroesse: beobachteGroesse,
    zieht: zieht,
    brandToggleHtml: brandToggleHtml,
    respBody: respBody,
    rbShowUrl: rbShowUrl,
    rbCleanUrl: rbCleanUrl,
    stackFit: stackFit,
    skeletonRows: skeletonRows,
    makeColumns: makeColumns,
    makeSearch: makeSearch,
    bootStubs: bootStubs,
    makeMount: makeMount,
    makeLate: makeLate,
    istSichtbar: istSichtbar,
    makeBarList: makeBarList,
    rowDwell: rowDwell,
    makePager: makePager,
    makeHeadSort: makeHeadSort,
    makeSoftReload: makeSoftReload,
    legacyCopy: legacyCopy,
    makeEmptyGrace: makeEmptyGrace,
    makeExplain: makeExplain,
    STORE: STORE,
    LOADING_EXPLICIT: LOADING_EXPLICIT,
    makeTooltips: makeTooltips,
    makeClipTip: makeClipTip,
    SLIDERS_ICON: SLIDERS_ICON,
    makeFire: makeFire,
    toast: toast,
    upstreemSignal: upstreemSignal,
    makePortal: makePortal,
    placeMenu: placeMenu,
    makePopover: makePopover,
    makeSubmenu: makeSubmenu,
    closePopovers: closeAll,
    menuEscape: menuEscape,
    dropEscape: dropEscape,
    makeSticky: makeSticky,
    rafThrottle: rafThrottle,
    einmalProBild: einmalProBild,
    onResize: onResize,
    unclipAncestors: unclipAncestors,
    watchRoots: watchRoots,
    TOPIC_COLOR_PALETTE: TOPIC_COLOR_PALETTE,
    swatchInk: swatchInk,
    ensureEmojiLib: ensureEmojiLib,
    makeTopicModal: makeTopicModal,
    /* Custom Groupings: ein Speicher, ein Fenster, zwei Orte. */
    cgRead: cgRead,
    cgWrite: cgWrite,
    cgMixHex: cgMixHex,
    CG_MAX_TOPICS: CG_MAX_TOPICS,
    makeGroupingModal: makeGroupingModal,
    cgDotHtml: cgDotHtml,
    cgEyeHtml: cgEyeHtml,
    cgMoreHtml: cgMoreHtml,
    cgDragList: cgDragList,
    cgApplyOrder: cgApplyOrder,
    cgFind: cgFind,
    cgSetHidden: cgSetHidden,
    cgDelete: cgDelete,
    makePageNav: makePageNav,
    makePageHeaderMeta: makePageHeaderMeta,
    syncTheme: syncTheme,
    themeOnly: themeOnly,
    sortMenuHtml: sortMenuHtml,
    headGap: headGap,
    widthTiers: widthTiers,
    spinOnce: spinOnce,

    /* ---- chart kits (see the big comment block above) ---- */
    loadChartJs: loadChartJs,
    CITE_COLOR_DARK: CITE_COLOR_DARK,
    URL_LABEL: URL_LABEL,
    URL_COLOR_CHART: URL_COLOR_CHART,
    URL_COLOR_DARK: URL_COLOR_DARK,
    CHART_OTHER_LIGHT: CHART_OTHER_LIGHT,
    CHART_OTHER_DARK: CHART_OTHER_DARK,
    MAX_URL_SLICES: MAX_URL_SLICES,
    typeColor: typeColor,
    faviconColor: faviconColor,
    bildFarbe: bildFarbe,
    faviconColorCached: faviconColorCached,
    readableHex: readableHex,
    prepTypeData: prepTypeData,
    applyTypeDim: applyTypeDim,
    barIsLight: barIsLight,
    measureText: measureText,
    fmtPct: fmtPct, flipReplace: flipReplace,
    capitalize: capitalize,
    truncate: truncate,
    chartDateFmt: chartDateFmt,
    chartDateTitle: chartDateTitle,
    getPageWidth: getPageWidth,
    injectWatermark: injectWatermark,
    makeLine: makeLine,
    makeTypeChart: makeTypeChart,
    LINE_PALETTE: LINE_PALETTE,
    COLOR_SCALES: COLOR_SCALES,
    SCALE_ORDER: SCALE_ORDER,
    MAX_LINE_SERIES: MAX_LINE_SERIES,
    buildLineDatasets: buildLineDatasets,
    makeScaleMenu: makeScaleMenu,
    getLineWidthPref: getLineWidthPref,
    setLineWidthPref: setLineWidthPref,
    getLegendPref: getLegendPref,
    setLegendPref: setLegendPref,
    legendSectionHtml: legendSectionHtml,
    /* Die Einstellungen des Nutzers und ihre Werkzeuge. getPref/setPref sind der ganze Zugang --
       die Ablage selbst bleibt privat, damit niemand einen Wert hineinschreibt, den kein
       Formatierer kennt. */
    getPref: getPref, setPref: setPref, onPrefs: onPrefs, getUpstreemThemeChoice: getUpstreemThemeChoice,
    PREF_DEFAULT: PREF_DEFAULT, PREF_ERLAUBT: PREF_ERLAUBT,
    fmtNum: fmtNum, fmtDateMuster: fmtDateMuster, datumsTeile: datumsTeile,
    addMessages: addMessages, t: t,
    lineWidthSectionHtml: lineWidthSectionHtml,
    getColorScalePref: getColorScalePref, setColorScalePref: setColorScalePref,
    lineWidthSwitchHtml: lineWidthSwitchHtml, colorScaleOptionsHtml: colorScaleOptionsHtml,
    flagHtml: flagHtml, flagUrl: flagUrl, wireFlags: wireFlags
  };

  /* ---- Verdraengungssperre -------------------------------------------------------------------
     Eine Bubble-Seite kann core.js MEHRFACH laden: jede Komponente hat ihren eigenen
     data-cdn-pin, und ein leer gelassener Pin zieht "@main" -- was jsDelivr und der Browser aus
     einem tagealten Cache liefern duerfen. Bisher gewann schlicht die zuletzt eingetroffene
     Kopie, also je nach Netzlaufzeit auch mal die aelteste. Auf dem einen Rechner lief damit die
     neue Fassung, auf dem naechsten eine von vor einer Woche -- und Komponenten mit korrektem
     Pin starben an Kits, die es in DIESER core.js noch nicht gab ("UC.makePageHeaderMeta is not
     a function" im Dashboard, obwohl der Pin des Seitenkopfs stimmte).

     Ab hier gilt: die hoechste BUILD-Nummer gewinnt, unabhaengig von der Ankunftsreihenfolge.
     Zwei Richtungen, weil aeltere Fassungen diese Regel selbst nicht kennen:
       - Kommt diese Datei NACH einer neueren an, tritt sie zurueck.
       - Kommt sie davor, schuetzt ein Setter den Platz gegen spaeter eintreffende aeltere Kopien.
     Der Setter laesst jede NEUERE Zuweisung durch; er blockiert nichts ausser Rueckschritten. */
  var vorhanden = window.UpstreemCore;
  var vorhandenBuild = (vorhanden && typeof vorhanden.BUILD === "number") ? vorhanden.BUILD : -1;

  if (vorhandenBuild > BUILD){
    if (window.console) console.warn("upstreem: core.js " + BUILD + " tritt hinter die bereits " +
      "geladene Fassung " + vorhandenBuild + " zurueck (mehrere data-cdn-pins auf dieser Seite).");
    return;
  }

  /* Nicht nur MELDEN, dass ein Pin haengt, sondern sagen WELCHER. Zwei Quellen: die URL der
     Datei, die gerade zurueckgewiesen wurde (document.currentScript zeigt beim Zuweisen auf die
     alte core.js selbst), und alle Wurzeln, deren data-cdn-pin leer ist -- das sind die
     Bubble-Elemente, die "@main" ziehen. Ohne das heisst die Warnung nur "irgendwo auf dieser
     Seite", und man sucht sie einzeln durch. */
  function schuldiger(){
    var teile = [];
    try {
      var cs = document.currentScript;
      if (cs && cs.src) teile.push("Abgewiesen: " + cs.src);
    } catch(e){}
    try {
      var leer = [];
      var roots = document.querySelectorAll("[data-cdn-pin]");
      for (var i = 0; i < roots.length; i++){
        if (!String(roots[i].getAttribute("data-cdn-pin") || "").trim()){
          /* up-root traegt jede Wurzel, es benennt nichts. Die Komponentenklasse (dph-root, upt-root,
             ...) ist die, mit der man das Element in Bubble wiederfindet. */
          var kl = String(roots[i].className || "").split(/\s+/).filter(function(c){
            return /-root$/.test(c) && c !== "up-root"; })[0];
          leer.push(kl || roots[i].id || "?");
        }
      }
      if (leer.length) teile.push("Leerer data-cdn-pin an: " + leer.join(", "));
    } catch(e){}
    if (!teile.length) teile.push("Ein data-cdn-pin auf dieser Seite ist veraltet oder leer.");
    return " " + teile.join(" | ");
  }

  var aktuell = API;
  try {
    Object.defineProperty(window, "UpstreemCore", {
      configurable: true,
      get: function(){ return aktuell; },
      set: function(wert){
        var b = (wert && typeof wert.BUILD === "number") ? wert.BUILD : -1;
        if (b < aktuell.BUILD){
          if (window.console) console.warn("upstreem: eine aeltere core.js (" +
            (b < 0 ? "ohne BUILD" : b) + ") wollte die geladene Fassung " + aktuell.BUILD +
            " ersetzen und wurde abgewiesen." + schuldiger());
          return;
        }
        aktuell = wert;
      }
    });
  } catch(e){
    /* defineProperty kann an einer bereits nicht-konfigurierbaren Eigenschaft scheitern. Dann
       eben ohne Schutz zuweisen -- lieber eine ungeschuetzte core.js als gar keine. */
    window.UpstreemCore = API;
  }
})();
