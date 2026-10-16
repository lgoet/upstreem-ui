/* upstreem filter-bar.js — die Filterleiste "More Filters" (Praefix ufb). Braucht core.js zuerst.

   ── Was sie ist ─────────────────────────────────────────────────────────────
   EIN Knopf statt vier dauerhaft sichtbarer Filter-Dropdowns. Der Datumsfilter bleibt daneben
   stehen (eigenes Element, wird hier nicht angefasst); Topics, Models und Markets ziehen in ein
   Dropdown, dessen Zeilen die BESTEHENDEN Filter-Dropdowns seitlich herausfahren lassen.

   ── Was sie NICHT ist ───────────────────────────────────────────────────────
   Sie baut keinen Filter nach. Kein Auswaehlen, kein Abwaehlen, keine Liste, kein Suchfeld, keine
   Sortierung, kein Match-Modus, kein einziges Bubble-Ereignis eines Filters. Das alles steht in
   filters/topics-filter.js, models-filter.js und markets-filter.js und bleibt dort.
   Diese Komponente ZIEHT die vorhandenen Wurzeln in ihr Untermenue ein und liest ihren Zustand.

   ── Wie das Einziehen funktioniert ──────────────────────────────────────────
   Die drei Filter sind eigene Bubble-Elemente irgendwo auf der Seite. Hier werden ihre Wurzeln
   per appendChild in das jeweilige Untermenue verschoben. Danach gilt:

     - Ihr eigener Trigger ist weg (CSS). Meine Zeile IST der Trigger.
     - Ihr Panel steht im Fluss statt absolut an einem Trigger, den es nicht mehr gibt (CSS).
     - Ihr innerer Zustand `open` bleibt auf false und wird NICHT angefasst. Das ist Absicht:
       ihr document-Zuhoerer, ihr Escape-Weg, ihr .is-right-Umklappen und ihre Anmeldung bei
       UC.dropdownOpened haengen alle daran, und jede davon wuerde hier gegen mein Panel arbeiten.
       Sichtbar ist ihr Panel, weil MEIN Untermenue offen ist -- eine Sichtbarkeit, nicht zwei.
     - Ihre Suche wird beim Verlassen ueber ihren EIGENEN Clear-Knopf geleert. Kein Zugriff auf
       ihren Zustand, nur ein Klick auf ein Bedienelement, das der Nutzer auch selbst treffen kann.

   ── Woher der Zustand kommt ─────────────────────────────────────────────────
   Nichts davon wird geraten oder nachgerechnet:

     Zeile im Panel   das INNERE ihres Triggers, woertlich gespiegelt (ohne dessen Chevron). Damit
                      steht dort genau das, was am Trigger stuende -- ein Themenname mit seinem
                      farbigen Punkt bei genau einer Auswahl, die Beschriftung mit dem
                      Zaehler-Badge ab zwei. Kein zweiter Renderer, der abweichen koennte.
     Auswahl          root.__utfCtrl.getSelected() (bzw. __umfCtrl / __umkCtrl) -- die oeffentliche
                      Auskunft der Filter.
     Namen fuer Chips die angehakten Zeilen ihrer eigenen Liste (.up-filter-item.is-checked).
                      Sie tragen die Namen bereits in der Sprache, in der sie auf dem Bildschirm
                      stehen; eine zweite Aufloesung ueber die Stores waere eine zweite Wahrheit.
     Wann neu lesen   ihre eigenen DOM-Ereignisse. Alle drei Filter senden schon eines mit dem
                      vollen Zustand: utf-topics, umf-models, umk-markets, aufsteigend am Root.
                      Dafuer musste an den Filtern nichts geaendert werden.

   ── Diese Komponente sendet NICHTS ──────────────────────────────────────────
   Reset Filters im Panel und Clear All in der Leiste gehen ueber die eigenen Wege der Filter:
   jeder raeumt seine Auswahl auf und feuert sein eigenes Ereignis, genau wie beim Abwaehlen von
   Hand. Es braucht also keinen Workflow fuer diese Leiste.
   Hier stand ein Ereignis "ufbReset", das aus drei Filter-Ereignissen eines machen sollte. Es ist
   RAUS, auf Ansage: es lief auf keiner Seite ein Workflow darauf, der Weg ueber die Filter hat
   ohnehin alles richtig gemacht, und uebrig blieben nur Warnungen in der Konsole -- eine von hier
   und je eine von makeFire ueber den Namen, den es nicht auflosen konnte.

   ── Was aus core kommt ──────────────────────────────────────────────────────
     Panel-Schale      .up-menu + UC.makePopover
     Untermenue        .up-subwrap / .up-submenu + UC.makeSubmenu (Bruecke, Umklappen, Hineingehen)
     Zeilenform        .up-optrow
     leiser Trigger    .up-quietbtn
     Hinweispunkt      .up-badge.is-dot
     Chip              .up-entchip.is-static
     Zeichen           UC.icon
     Bubble-Klempnerei UC.makeFire / UC.makeLate */
(function () {
  "use strict";

  var API_NAMES = ["resetFilterBar", "setFilterBarTheme"];
  var Q = (window.__ufbBootQueue = window.__ufbBootQueue || []);
  if (!window.__ufbBootStubbed) {
    window.__ufbBootStubbed = true;
    API_NAMES.forEach(function (n) {
      if (typeof window[n] !== "function") window[n] = function () { Q.push([n, [].slice.call(arguments)]); };
    });
  }

  /* Die drei Filter, in der vorgegebenen Reihenfolge. Alles, was diese Komponente ueber einen
     Filter wissen muss, steht in EINER Zeile -- ein vierter Filter ist damit ein Eintrag hier und
     sonst nichts.
       attr      Attribut am Root dieser Komponente, in dem die Instanz-Id des Filters steht
       visAttr   Attribut, mit dem die Seite ihn AUSBLENDEN kann: "no"/"false"/"0" versteckt ihn.
                 Fehlt das Attribut oder ist es leer, ist er sichtbar -- ein Element ohne dieses
                 Attribut verhaelt sich also genau wie vorher. Das ist die sichere Richtung: ein
                 Bubble-Ausdruck, der beim ersten Rendern noch leer ist, darf keinen Filter
                 verschlucken.
       rootSel   Klasse der Filterwurzel
       ctrl      Eigenschaft, unter der der Filter seinen Controller ablegt
       selKey    Feld in getSelected(), das die Auswahl als CSV traegt
       optSel    die angehakte Zeile seiner Liste
       nameSel   der Name darin
       clearSel  SEIN eigenes X am Trigger -- das Bedienelement, das seine Auswahl leert und
                 danach sein Ereignis feuert. Das X am Chip klickt genau dieses an.
       evt       sein aufsteigendes DOM-Ereignis
       fnAttrs   seine EIGENEN Bubble-Kanaele [Attribut, Rueckfallname] -- nur fuer die Diagnose
                 unten gebraucht. Diese Komponente ruft davon NICHTS: die Filter feuern selbst,
                 genau wie vorher, und ihre Workflows bleiben unberuehrt.
       fnMarke   Namensteil, an dem die Diagnose die passenden bubble_fn_* der Seite erkennt
       chip      Beschriftung des Chips, Einzahl -- "Topic: Leadgen" liest sich als eine Aussage
                 ueber diesen einen Filter, "Topics: Leadgen" als eine Liste, die zufaellig eins
                 lang ist */
  var FILTERS = [
    { key: "topics",  label: "Topics",  attr: "data-topics-instance", visAttr: "data-topics-visible",  rootSel: ".utf-root",
      ctrl: "__utfCtrl", selKey: "topic_ids",    opt: ".utf-opt", keyAttr: "data-id",
      nameSel: ".utf-opt-name", clearSel: ".utf-chev-x", evt: "utf-topics",  chip: "Topic",  icon: "tags",
      fnAttrs: [["data-topics-fn", "bubble_fn_utfTopics"], ["data-topics-apply-fn", null]],
      fnMarke: "utf" },
    { key: "models",  label: "Models",  attr: "data-models-instance", visAttr: "data-models-visible",  rootSel: ".umf-root",
      ctrl: "__umfCtrl", selKey: "model_keys",   opt: ".umf-opt", keyAttr: "data-key",
      nameSel: ".umf-opt-name", clearSel: ".umf-chev-x", evt: "umf-models",  chip: "Model",  icon: "layers",
      fnAttrs: [["data-models-fn", "bubble_fn_umfModels"], ["data-models-apply-fn", null]],
      fnMarke: "umf" },
    { key: "markets", label: "Markets", attr: "data-markets-instance", visAttr: "data-markets-visible", rootSel: ".umk-root",
      ctrl: "__umkCtrl", selKey: "market_codes", opt: ".umk-opt", keyAttr: "data-key",
      nameSel: ".umk-opt-name", clearSel: ".umk-chev-x", evt: "umk-markets", chip: "Market", icon: "mapPin",
      fnAttrs: [["data-markets-fn", "bubble_fn_umkMarkets"], ["data-markets-apply-fn", null]],
      fnMarke: "umk" },
    /* Intent (13.10.): der einzige Filter, den diese Leiste SELBST mitbringt (uifEinrichten unten).
       Er hat keine Bubble-Vergangenheit und keine eigene Platzierung -- er gehoert zur Leiste, und
       ein eigenes Element auf elf Seiten waere elfmal dieselbe Verdrahtung gewesen. Sein Stand
       liegt in core (UC.intentFilterGet/Set), gemeinsam fuer alle Seiten. Es gibt ihn nur, wenn
       der Gastgeber die Intents freigegeben hat (UC.intentsLive). */
    { key: "intents", label: "Intent", attr: "data-intents-instance", visAttr: "data-intents-visible", rootSel: ".uif-root",
      ctrl: "__uifCtrl", selKey: "intent_keys", opt: ".uif-opt", keyAttr: "data-key",
      nameSel: ".uif-opt-name", clearSel: ".uif-chev-x", evt: "uif-intents", chip: "Intent", icon: "signpost",
      fnAttrs: [], fnMarke: "uif" },
    /* DIE FILTER DER PROMPT-TABELLE (15.10.): Prompt type, "<Marke> mentioned" und Mentioned brands.
       Sie standen bisher als eigene Knoepfe in der Werkzeugleiste der Tabelle -- dort, wo nur
       Ansicht stehen soll. Jetzt ziehen sie wie die vier oben in dieses Menue. Gebaut werden sie
       von prompts-table.js (dort liegt ihr Zustand und ihr Ereignis), in derselben Form wie der
       Intent-Filter: Wurzel, Trigger mit Beschriftung und X, Panel mit .up-filter-item-Zeilen,
       Controller mit getSelected, aufsteigendes Ereignis.
       Eingetragen sind sie NUR, wo eine Seite ihr Attribut setzt (gewuenscht() unten) -- heute
       allein die Seite Prompt Insights. Jede andere Leiste der App sieht davon nichts.
         behalten  ausgeblendet heisst hier NICHT geleert: die Seite blendet sie auf dem Reiter
                   Responses aus, wo sie nicht gelten, und beim Zurueckwechseln muss die Auswahl
                   noch stehen. Topics dagegen wird beim Ausblenden geleert (Gruppierung, siehe
                   verstecktGeleert). */
    { key: "ptype", label: "Prompt type", attr: "data-ptype-instance", visAttr: "data-ptype-visible", rootSel: ".up-ff-ptype",
      ctrl: "__upffCtrl", selKey: "sel", opt: ".up-ff-opt", keyAttr: "data-key",
      nameSel: ".up-ff-name", clearSel: ".up-ff-x", evt: "up-ff", chip: "Prompt type", icon: "flag",
      behalten: true, fnAttrs: [], fnMarke: "upt" },
    { key: "mention", label: "Brand mentioned", attr: "data-mention-instance", visAttr: "data-mention-visible", rootSel: ".up-ff-mention",
      ctrl: "__upffCtrl", selKey: "sel", opt: ".up-ff-opt", keyAttr: "data-key",
      nameSel: ".up-ff-name", clearSel: ".up-ff-x", evt: "up-ff", chip: "Brand", icon: "megaphone",
      behalten: true, fnAttrs: [], fnMarke: "upt" },
    { key: "brands", label: "Mentioned brands", attr: "data-brands-instance", visAttr: "data-brands-visible", rootSel: ".up-ff-brands",
      ctrl: "__upffCtrl", selKey: "sel", opt: ".up-ff-opt", keyAttr: "data-key",
      nameSel: ".up-ff-name", clearSel: ".up-ff-x", evt: "up-ff", chip: "Brands", icon: "squareStack",
      behalten: true, fnAttrs: [], fnMarke: "upt" },
    /* DIE FILTER DER RESPONSES-TABELLE (15.10. abends, gleiche eine Leiste): "<Marke> mentioned",
       Mentioned brands, Rank und Sentiment -- bisher Markenschalter, "All Brands" und der Regler
       in ihrer Werkzeugleiste. Gebaut von responses-table.js ueber UC.makeLeistenFilter (core),
       eigene Eintraege statt derselben wie oben: beide Tabellen stehen auf derselben Seite, und
       ihre Auswahl ist je Reiter eine andere. Rank und Sentiment tragen statt einer Liste ihren
       Regler im Panel (panel in makeLeistenFilter), der Chip zeigt den Bereich ("1–3"). */
    { key: "rmention", label: "Brand mentioned", attr: "data-rmention-instance", visAttr: "data-rmention-visible", rootSel: ".up-ff-rmention",
      ctrl: "__upffCtrl", selKey: "sel", opt: ".up-ff-opt", keyAttr: "data-key",
      nameSel: ".up-ff-name", clearSel: ".up-ff-x", evt: "up-ff", chip: "Brand", icon: "megaphone",
      behalten: true, fnAttrs: [], fnMarke: "urt" },
    { key: "rbrands", label: "Mentioned brands", attr: "data-rbrands-instance", visAttr: "data-rbrands-visible", rootSel: ".up-ff-rbrands",
      ctrl: "__upffCtrl", selKey: "sel", opt: ".up-ff-opt", keyAttr: "data-key",
      nameSel: ".up-ff-name", clearSel: ".up-ff-x", evt: "up-ff", chip: "Brands", icon: "squareStack",
      behalten: true, fnAttrs: [], fnMarke: "urt" },
    { key: "rrank", label: "Rank", attr: "data-rrank-instance", visAttr: "data-rrank-visible", rootSel: ".up-ff-rrank",
      ctrl: "__upffCtrl", selKey: "sel", opt: ".up-ff-opt", keyAttr: "data-key",
      nameSel: ".up-ff-name", clearSel: ".up-ff-x", evt: "up-ff", chip: "Rank", icon: "hash",
      behalten: true, fnAttrs: [], fnMarke: "urt" },
    { key: "rsent", label: "Sentiment", attr: "data-rsent-instance", visAttr: "data-rsent-visible", rootSel: ".up-ff-rsent",
      ctrl: "__upffCtrl", selKey: "sel", opt: ".up-ff-opt", keyAttr: "data-key",
      nameSel: ".up-ff-name", clearSel: ".up-ff-x", evt: "up-ff", chip: "Sentiment", icon: "smile",
      behalten: true, fnAttrs: [], fnMarke: "urt" },
    /* DIE FILTER DER CITATIONS-TABELLEN (15.10., dieselbe eine Leiste): "<Marke> mentioned",
       Mentioned brands und die Typen -- bisher Markenschalter, "All Brands" und das Typen-Menue in
       den Werkzeugleisten von Domains und URLs. Gebaut von domains-table.js bzw. urls-table.js ueber
       UC.makeLeistenFilter. Je Tabelle eigene Eintraege: beide stehen auf derselben Seite, die
       Seite blendet je Reiter die des anderen aus (behalten: die Auswahl bleibt stehen). Die
       URL-Tabelle hat zwei Typ-Filter, wo vorher ein Menue mit Umschalter stand -- beide melden wie
       vorher beide Listen. */
    { key: "dmention", label: "Brand mentioned", attr: "data-dmention-instance", visAttr: "data-dmention-visible", rootSel: ".up-ff-dmention",
      ctrl: "__upffCtrl", selKey: "sel", opt: ".up-ff-opt", keyAttr: "data-key",
      nameSel: ".up-ff-name", clearSel: ".up-ff-x", evt: "up-ff", chip: "Brand", icon: "megaphone",
      behalten: true, fnAttrs: [], fnMarke: "udt" },
    { key: "dbrands", label: "Mentioned brands", attr: "data-dbrands-instance", visAttr: "data-dbrands-visible", rootSel: ".up-ff-dbrands",
      ctrl: "__upffCtrl", selKey: "sel", opt: ".up-ff-opt", keyAttr: "data-key",
      nameSel: ".up-ff-name", clearSel: ".up-ff-x", evt: "up-ff", chip: "Brands", icon: "squareStack",
      behalten: true, fnAttrs: [], fnMarke: "udt" },
    { key: "dtypes", label: "Citation type", attr: "data-dtypes-instance", visAttr: "data-dtypes-visible", rootSel: ".up-ff-dtypes",
      ctrl: "__upffCtrl", selKey: "sel", opt: ".up-ff-opt", keyAttr: "data-key",
      nameSel: ".up-ff-name", clearSel: ".up-ff-x", evt: "up-ff", chip: "Citation type", icon: "newspaper",
      behalten: true, fnAttrs: [], fnMarke: "udt" },
    { key: "umention", label: "Brand mentioned", attr: "data-umention-instance", visAttr: "data-umention-visible", rootSel: ".up-ff-umention",
      ctrl: "__upffCtrl", selKey: "sel", opt: ".up-ff-opt", keyAttr: "data-key",
      nameSel: ".up-ff-name", clearSel: ".up-ff-x", evt: "up-ff", chip: "Brand", icon: "megaphone",
      behalten: true, fnAttrs: [], fnMarke: "uut" },
    { key: "ubrands", label: "Mentioned brands", attr: "data-ubrands-instance", visAttr: "data-ubrands-visible", rootSel: ".up-ff-ubrands",
      ctrl: "__upffCtrl", selKey: "sel", opt: ".up-ff-opt", keyAttr: "data-key",
      nameSel: ".up-ff-name", clearSel: ".up-ff-x", evt: "up-ff", chip: "Brands", icon: "squareStack",
      behalten: true, fnAttrs: [], fnMarke: "uut" },
    { key: "ucittypes", label: "Citation type", attr: "data-ucittypes-instance", visAttr: "data-ucittypes-visible", rootSel: ".up-ff-ucittypes",
      ctrl: "__upffCtrl", selKey: "sel", opt: ".up-ff-opt", keyAttr: "data-key",
      nameSel: ".up-ff-name", clearSel: ".up-ff-x", evt: "up-ff", chip: "Citation type", icon: "newspaper",
      behalten: true, fnAttrs: [], fnMarke: "uut" },
    { key: "uurltypes", label: "URL type", attr: "data-uurltypes-instance", visAttr: "data-uurltypes-visible", rootSel: ".up-ff-uurltypes",
      ctrl: "__upffCtrl", selKey: "sel", opt: ".up-ff-opt", keyAttr: "data-key",
      nameSel: ".up-ff-name", clearSel: ".up-ff-x", evt: "up-ff", chip: "URL type", icon: "linkFeather",
      behalten: true, fnAttrs: [], fnMarke: "uut" },
    /* DIE FILTER VON SHOPPING UND ADS (15.10., dieselbe eine Leiste): was dort die DATEN aendert und
       bisher als Knopf in der Werkzeugleiste einer Tabelle stand, steht jetzt als Zeile hier. Gebaut
       von shopping.js bzw. ads.js ueber UC.makeLeistenFilter (core); der Zustand und die Anfrage
       bleiben in der Komponente. Eigene Schluessel, weil jede Seite ihre eigene Auswahl hat.
         shsegment/shbrand/shmerchant  Products: Segment (You, Competition, Other), Marke, Haendler --
                                       je eine Wahl, wie die RPC sie kennt (p_segment, p_company_id,
                                       p_merchant); sichtbar nur auf dem Reiter Products
         adadv/adformat                Ads: Advertisers und Ad Format, mehrere Wahlen (p_advertisers,
                                       p_ad_formats); sie gelten fuer jede Seite der Ads und stehen
                                       darum auf jeder (Advertisers nicht im Detail eines Advertisers,
                                       die RPC uebergeht ihn dort)
       behalten wie oben: ausgeblendet heisst nicht geleert. */
    { key: "shsegment", label: "Segment", attr: "data-shsegment-instance", visAttr: "data-shsegment-visible", rootSel: ".up-ff-shsegment",
      ctrl: "__upffCtrl", selKey: "sel", opt: ".up-ff-opt", keyAttr: "data-key",
      nameSel: ".up-ff-name", clearSel: ".up-ff-x", evt: "up-ff", chip: "Segment", icon: "swords",
      behalten: true, fnAttrs: [], fnMarke: "ush" },
    { key: "shbrand", label: "Brand", attr: "data-shbrand-instance", visAttr: "data-shbrand-visible", rootSel: ".up-ff-shbrand",
      ctrl: "__upffCtrl", selKey: "sel", opt: ".up-ff-opt", keyAttr: "data-key",
      nameSel: ".up-ff-name", clearSel: ".up-ff-x", evt: "up-ff", chip: "Brand", icon: "squareStack",
      behalten: true, fnAttrs: [], fnMarke: "ush" },
    { key: "shmerchant", label: "Merchant", attr: "data-shmerchant-instance", visAttr: "data-shmerchant-visible", rootSel: ".up-ff-shmerchant",
      ctrl: "__upffCtrl", selKey: "sel", opt: ".up-ff-opt", keyAttr: "data-key",
      nameSel: ".up-ff-name", clearSel: ".up-ff-x", evt: "up-ff", chip: "Merchant", icon: "store",
      behalten: true, fnAttrs: [], fnMarke: "ush" },
    { key: "adadv", label: "Advertisers", attr: "data-adadv-instance", visAttr: "data-adadv-visible", rootSel: ".up-ff-adadv",
      ctrl: "__upffCtrl", selKey: "sel", opt: ".up-ff-opt", keyAttr: "data-key",
      nameSel: ".up-ff-name", clearSel: ".up-ff-x", evt: "up-ff", chip: "Advertiser", icon: "bank",
      behalten: true, fnAttrs: [], fnMarke: "uad" },
    { key: "adformat", label: "Ad Format", attr: "data-adformat-instance", visAttr: "data-adformat-visible", rootSel: ".up-ff-adformat",
      ctrl: "__upffCtrl", selKey: "sel", opt: ".up-ff-opt", keyAttr: "data-key",
      nameSel: ".up-ff-name", clearSel: ".up-ff-x", evt: "up-ff", chip: "Format", icon: "image",
      behalten: true, fnAttrs: [], fnMarke: "uad" }
  ];
  /* Trigger und Chevron je Filter. Bisher standen die vier Klassen woertlich an drei Stellen
     (Spiegel, Beobachter, Chevron-Ausnahme); mit den Filtern der Prompt-Tabelle waeren es sieben
     gewesen. Abgeleitet aus dem Praefix der Wurzel: .utf-root -> .utf-trigger / utf-chev. */
  /* Die Filter der einen Leiste (.up-ff-<key>, core makeLeistenFilter) teilen EINEN Praefix. */
  function praefixVon(f) { return f.rootSel.indexOf(".up-ff") === 0 ? "up-ff" : f.rootSel.replace(/^\./, "").replace(/-root$/, ""); }
  var TRIG_SEL = FILTERS.map(function (f) { return "." + praefixVon(f) + "-trigger"; })
    .filter(function (s, i, a) { return a.indexOf(s) === i; }).join(", ");
  var CHEV_KLASSEN = FILTERS.map(function (f) { return praefixVon(f) + "-chev"; })
    .filter(function (s, i, a) { return a.indexOf(s) === i; });
  var SUCHE_X = FILTERS.map(function (f) { return "." + praefixVon(f) + "-search-x"; })
    .filter(function (s, i, a) { return a.indexOf(s) === i; }).join(", ");
  var SUCHE_IN = FILTERS.map(function (f) { return "." + praefixVon(f) + "-search-in"; })
    .filter(function (s, i, a) { return a.indexOf(s) === i; }).join(", ");
  /* Wie viele Namen ein Chip zeigt, bevor er auf "+N" zusammenfasst. Zwei: bei drei Namen ist der
     Chip breiter als der Knopf davor, und dann liest man die Leiste nicht mehr, sondern buchstabiert
     sie. */
  var CHIP_NAMEN = 2;
  /* Unter dieser SEITENbreite bricht die Leiste um und das Untermenue geht hinein statt heraus.
     768 ist die Grenze, die core in widthTiers ebenfalls als "schmal" benutzt. */
  var SCHMAL = 768;

  function ufbBoot(n) {
    if (!window.UpstreemCore) {
      if (n > 0) { setTimeout(function () { ufbBoot(n - 1); }, 100); return; }
      if (window.console) console.error("[filter-bar] UpstreemCore (core.js) not loaded");
      return;
    }
    ufbRun();
  }

  function ufbRun() {
    var UC = window.UpstreemCore;
    var esc = UC.esc;

    var MISSING = ["makeSubmenu", "makePopover", "makeFire", "icon", "esc", "aufResize", "getPageWidth"]
      .filter(function (k) { return typeof UC[k] !== "function"; });
    if (MISSING.length && window.console) {
      console.error("[filter-bar] Die core.js auf dieser Seite ist AELTER als filter-bar.js, es " +
        "fehlen: " + MISSING.join(", ") + ". Alle Elemente der Seite auf denselben Commit pinnen.");
    }

    var spaet = UC.makeLate ? UC.makeLate("filter-bar", ".ufb-root") : null;
    var CTRLS = [];
    /* Alle Wurzeln, die je eingerichtet wurden -- auch die, die Bubble inzwischen weggeworfen hat.
       Genau die sind der Grund fuer die Liste. */
    var WURZELN = [];
    /* Der Waechter laeuft auf einer UHR und nicht an einem MutationObserver, und das ist die Lehre
       aus einem Fehlversuch: ein Beobachter, der auf Knotenbewegungen reagiert und dabei selbst
       Knoten bewegt, weckt sich wieder -- mit drei Filtern und zwei Leisten reichte das, um den
       Hauptfaden nicht mehr loszulassen (gemessene stehende Seite). Eine Uhr kann das nicht: sie
       laeuft alle 700ms, egal was passiert, und tut in der Regel nichts.
       700ms sind unauffaellig (ein Rerender ist ohnehin nicht schneller sichtbar) und billig: eine
       Schleife ueber selten mehr als eine Wurzel. */
    var WAECHTER_MS = 700;
    function waechter() {
      for (var i = WURZELN.length - 1; i >= 0; i--) {
        var w = WURZELN[i];
        if (document.contains(w)) continue;
        /* Bubble hat diese Leiste weggeworfen. Die eingezogenen Filter duerfen nicht mit ihr
           verschwinden -- sie gehen nach Hause, und die naechste Leiste zieht sie erneut ein. */
        if (typeof w.__ufbHeim === "function") { try { w.__ufbHeim(); } catch (e) {} }
        WURZELN.splice(i, 1);
      }
    }

    /* DER RUF EINER FRISCHEN FILTERWURZEL (28.09.). Die drei Filter rufen das am Ende ihres
       Einrichtens, wenn eine NEUE Wurzel steht (nicht beim Wiederaufnehmen). Baut Bubble nur die
       Filter neu, laeuft sonst kein Einziehen mehr: die Anlaufstaffel ist vorbei, und die Uhr
       unten prueft nur die Sichtbarkeit. Ohne diesen Ruf bliebe die frische Wurzel neben der
       Leiste stehen, bis jemand das Fenster zieht.
       Kein Beobachter und keine Suche auf der Uhr -- der Ruf kommt genau dann, wenn es etwas zu
       tun gibt. Gebuendelt auf EINEN Lauf: baut Bubble drei Filter auf einmal neu, rufen drei. */
    var neuUhr = null;
    window.__ufbWurzelNeu = function () {
      if (neuUhr) return;
      neuUhr = setTimeout(function () {
        neuUhr = null;
        for (var i = 0; i < CTRLS.length; i++) { if (CTRLS[i].einziehen) CTRLS[i].einziehen(); }
      }, 0);
    };

    /* ---- Der Intent-Filter (13.10.) ----------------------------------------------------------
       Dieselbe Form wie die drei anderen, damit Einziehen, Spiegel, Chips und Reset ohne
       Sonderweg laufen: Wurzel, Trigger mit Beschriftung und X, Panel mit .up-filter-item-Zeilen,
       Controller mit getSelected, aufsteigendes Ereignis. Der Trigger ist im Untermenue
       ausgeblendet wie bei den anderen (filter-bar.css) -- die Zeile der Leiste ist der Ausloeser.
       Die Auswahl schreibt core; jede Wurzel hoert auf "up-intentfilter" und zieht nach, auch die
       einer zweiten Leiste auf derselben Seite (Drawer ueber einer Seite). */
    function uifEinrichten(w) {
      if (w.__uifCtrl) { w.__uifCtrl.sync(); return w.__uifCtrl; }
      w.classList.add("uif-root");
      w.innerHTML =
        '<div class="uif-wrap">' +
          '<button class="uif-trigger" type="button" tabindex="-1" aria-hidden="true">' +
            '<span class="uif-label">Intent</span>' +
            '<span class="uif-chev"><span class="uif-chev-x" role="button" tabindex="-1" aria-label="Clear selection">' + UC.icon("x", 2.2) + '</span></span>' +
          '</button>' +
          '<div class="uif-menu" role="dialog">' +
            '<div class="uif-list" role="listbox" aria-multiselectable="true">' +
              (UC.INTENTE || []).map(function (a) {
                return '<div class="up-filter-item uif-opt" role="option" tabindex="0" aria-selected="false" data-key="' + esc(a.key) + '">' +
                  '<span class="up-filter-check">' + UC.icon("check", 3) + '</span>' +
                  '<span class="uif-opt-main">' + UC.icon(a.icon, 2) +
                    '<span class="uif-opt-name">' + esc(UC.intentName ? UC.intentName(a) : a.label) + '</span></span>' +
                '</div>';
              }).join("") +
            '</div>' +
          '</div>' +
        '</div>';
      var elTrig = w.querySelector(".uif-trigger"), elLbl = w.querySelector(".uif-label");
      function sync() {
        var f = UC.intentFilterGet(), n = f.intents.length;
        Array.prototype.forEach.call(w.querySelectorAll(".uif-opt"), function (r) {
          var an = f.intents.indexOf(r.getAttribute("data-key")) >= 0;
          r.classList.toggle("is-checked", an);
          r.setAttribute("aria-selected", an ? "true" : "false");
        });
        w.classList.toggle("has-sel", n > 0);
        var a = n === 1 && UC.intentArt ? UC.intentArt(f.intents[0]) : null;
        elLbl.textContent = a ? (UC.intentName ? UC.intentName(a) : a.label) : "Intent";
        var alt = elTrig.querySelector(".uif-count");
        if (alt) alt.parentNode.removeChild(alt);
        if (n > 1) {
          var b = document.createElement("span");
          b.className = "uif-count"; b.textContent = String(n);
          elTrig.insertBefore(b, elTrig.querySelector(".uif-chev"));
        }
      }
      function setzen(liste) {
        if (!UC.intentFilterSet(liste)) return;
      }
      w.addEventListener("click", function (e) {
        if (e.target.closest(".uif-chev-x")) { e.stopPropagation(); setzen({ intents: [] }); return; }
        var r = e.target.closest(".uif-opt");
        if (!r) return;
        var k = r.getAttribute("data-key"), l = UC.intentFilterGet().intents.slice(), i = l.indexOf(k);
        if (i >= 0) l.splice(i, 1); else l.push(k);
        setzen({ intents: l });
      });
      w.addEventListener("keydown", function (e) {
        if (e.key !== "Enter" && e.key !== " ") return;
        var r = e.target.closest && e.target.closest(".uif-opt");
        if (!r) return;
        e.preventDefault(); r.click();
      });
      window.addEventListener("up-intentfilter", function () {
        if (!document.contains(w)) return;
        sync();
        try { w.dispatchEvent(new CustomEvent("uif-intents", { bubbles: true,
          detail: { intent_keys: UC.intentFilterGet().intents.join(",") } })); } catch (e) {}
      });
      var ctrl = {
        getSelected: function () { return { intent_keys: UC.intentFilterGet().intents.join(",") }; },
        setSelected: function (csv) {
          setzen({ intents: String(csv == null ? "" : csv).split(",").map(function (x) { return x.trim(); }).filter(Boolean) });
        },
        sync: sync
      };
      w.__uifCtrl = ctrl;
      sync();
      return ctrl;
    }
    /* Fuer eine Leiste die Intent-Wurzel bereitstellen: Attribut setzen (dann findet gewuenscht()
       den Filter) und die Wurzel neben die Leiste stellen, von wo einziehen() sie holt. */
    /* data-intents-visible="no": eine Leiste, in der der Filter keinen Sinn hat (Prompt-Detail: EIN
       Prompt). Dann weder Intent-Zeile noch Branded-Schalter. */
    function intentsHier(root) {
      var v = String(root.getAttribute("data-intents-visible") || "").trim().toLowerCase();
      return !!(UC.intentsLive && UC.intentsLive()) && !(v === "no" || v === "false" || v === "0");
    }
    function uifBereitstellen(root) {
      if (!intentsHier(root) || !UC.intentFilterGet) return;
      var iid = String(root.getAttribute("data-intents-instance") || "").trim();
      if (!iid) { iid = String(root.getAttribute("data-instance") || "ufb") + "_intents"; root.setAttribute("data-intents-instance", iid); }
      var da = Array.prototype.some.call(document.querySelectorAll(".uif-root"), function (x) {
        return String(x.getAttribute("data-instance") || "") === iid;
      });
      if (da) return;
      var w = document.createElement("div");
      w.className = "up-root uif-root";
      w.setAttribute("data-instance", iid);
      w.setAttribute("data-local", "yes");
      if (root.getAttribute("data-isdark") != null) w.setAttribute("data-isdark", root.getAttribute("data-isdark"));
      if (root.getAttribute("data-theme") != null) w.setAttribute("data-theme", root.getAttribute("data-theme"));
      (root.parentNode || document.body).insertBefore(w, root.nextSibling);
      uifEinrichten(w);
    }

    function initRoot(root) {
      if (root.__ufbCtrl) return root.__ufbCtrl;
      uifBereitstellen(root);
      root.classList.add("ufb-root");
      var instanceId = String(root.getAttribute("data-instance") || "").trim() || "default";

      /* Welche Filter sind auf dieser Seite ueberhaupt vorgesehen? Die Id steht im Attribut. Ein
         leeres Attribut oder ein stehengebliebener Platzhalter heisst: diesen Filter gibt es hier
         nicht -- dann gibt es auch keine Zeile dafuer. Genau das meinte die Vorgabe mit
         "erkennt automatisch, was an Filtern da ist". */
      function gewuenscht() {
        return FILTERS.filter(function (f) {
          var v = String(root.getAttribute(f.attr) || "").trim();
          return !!v && !/^[A-Z_]{3,}$/.test(v);
        });
      }
      /* ZWEITE Frage, unabhaengig von der ersten: der Filter ist eingetragen, soll aber GERADE
         nicht angeboten werden -- im Prompts-Table etwa der Topics-Filter, solange die Gruppierung
         nach Topics laeuft. Dafuer traegt die Seite data-<filter>-visible.
         Nur ein ausdrueckliches Nein blendet aus. Alles andere -- Attribut fehlt, Attribut leer,
         ein Bubble-Ausdruck, der noch nicht aufgeloest ist -- heisst sichtbar. Andersherum waere
         es gefaehrlich: ein Ausdruck, der beim ersten Rendern leer ankommt, wuerde den Filter
         verschlucken, und niemand saehe warum. */
      function sichtbarLaut(f) {
        var v = String(root.getAttribute(f.visAttr) || "").trim().toLowerCase();
        return !(v === "no" || v === "false" || v === "0" || v === "off" || v === "hidden");
      }
      /* Eingetragen, aber ausgeblendet -- der Unterschied zu "gar nicht vorgesehen" zaehlt: nur
         SEINE Auswahl darf diese Leiste raeumen. Einen Filter, der ihr nie gehoerte, fasst sie
         nicht an. */
      function nurAusgeblendet(f) { return gewuenscht().indexOf(f) >= 0 && !sichtbarLaut(f); }
      function idVon(f) { return String(root.getAttribute(f.attr) || "").trim(); }
      /* DIE GROSSE FORM (15.10., Seite Prompt Insights): jede Zeile "Name ........ Wert" statt des
         Spiegels, und die Chips oeffnen beim Klick ihr Untermenue. Eingeschaltet ueber
         data-form="gross" an dieser Wurzel -- ohne das Attribut bleibt alles wie bisher. */
      function gross() { return root.getAttribute("data-form") === "gross"; }
      /* Beschriftung, Chip-Bezug und Leerwert darf die WURZEL des Filters mitbringen: "Mercedes
         Benz mentioned" kennt nur die Tabelle, nicht diese Leiste. */
      function attrVon(f, name) {
        var w = eingezogen[f.key];
        var v = w ? String(w.getAttribute(name) || "").trim() : "";
        return v;
      }
      function labelVon(f) { return attrVon(f, "data-ufb-label") || f.label; }
      function chipVon(f) { return attrVon(f, "data-ufb-chip") || f.chip; }
      function leerVon(f) { return attrVon(f, "data-ufb-leer") || "All"; }
      /* Das Zeichen einer Zeile bzw. eines Chips: ein Bild, wenn die Wurzel eins mitbringt
         (data-ufb-bild -- das Logo der eigenen Marke bei "<Marke> mentioned?", 15.10.), sonst das
         feste Zeichen des Filters. Faellt das Bild aus, bleibt die Kachel leer statt zu zerbrechen. */
      function zeichenVon(f) {
        var bild = attrVon(f, "data-ufb-bild");
        if (bild && /^(https?:\/\/|\/)/i.test(bild)) {
          return '<span class="ufb-bild"><img src="' + esc(bild) + '" alt="" loading="lazy" referrerpolicy="no-referrer"' +
            ' onerror="this.remove()"/></span>';
        }
        return UC.icon(f.icon, 2);
      }
      /* Ein Filter kann sich selbst abmelden (data-ufb-aus="yes"), ohne ausgeblendet zu sein: die
         Tabelle tut das fuer Prompt type und die Markenfilter in der Inactive-Ansicht, wo sie
         keine Spalte haben. Keine Zeile, kein Chip -- und die Auswahl bleibt stehen. */
      function ausGemeldet(f) { return attrVon(f, "data-ufb-aus") === "yes"; }
      /* Der Branded-Schalter des Intent-Filters gilt fuer die Liste der Prompt-Tabelle nicht (sie
         hat ihren eigenen, Prompt type). Die Seite blendet ihn dort aus. */
      function brandedHier() {
        var v = String(root.getAttribute("data-branded-visible") || "").trim().toLowerCase();
        return !(v === "no" || v === "false" || v === "0");
      }
      /* Was schon geklagt bzw. gemeldet wurde -- je Filter einmal, damit die Konsole nicht bei
         jedem Lauf dasselbe wiederholt. */
      var gemeldet = {};
      /* Die Wurzel eines Filters auf der Seite finden. Drei Stufen:

           1. data-instance EXAKT gleich.
           2. data-instance beginnt mit der eingetragenen Id -- dieselbe Regel, nach der die Filter
              selbst ihre Instanzen aufloesen (mehrere Platzierungen tragen dort "topics_dash",
              "topics_dash_2", ...).
           3. Kein Treffer, aber auf der ganzen Seite gibt es GENAU EINEN freien Filter dieser Art:
              dann ist er es. Es gibt keinen falschen, wenn es nur einen gibt.
              Warum das dazugekommen ist: gemeldet als "Dropdown sagt nur 'These filters are not on
              this page yet', keine Filter sichtbar". Eine Id, die um ein Zeichen abweicht -- oder
              ein data-instance, in dem noch ein Bubble-Ausdruck steckt --, liess die Leiste leer
              aufgehen, und niemand konnte sehen warum.
         Der Rueckfall passiert NICHT still: sonst ist er beim naechsten Mal eine falsche Zuordnung,
         die keiner sucht. */
      /* streng = ohne den Rueckfall unten. Fuer einen AUSGEBLENDETEN Filter wird nur nach der
         eingetragenen Id gesucht: "es gibt genau einen freien auf der Seite" ist eine Vermutung,
         und auf eine Vermutung hin die Auswahl eines fremden Filters zu leeren waere Schaden. */
      /* Gehoert eine Filterwurzel einer ANDEREN Leiste? Ja, wenn die sie schon haelt -- oder wenn
         eine andere Leiste sie mit GENAU diesem Namen verlangt, auch bevor sie sie eingezogen hat.
         Der zweite Fall ist der gemeldete (28.09.): "models_v1_prompts" ist ein Praefix von
         "models_v1_promptspotlight". Stand das eigene Element beim Start noch nicht im Dokument,
         griff filterbar_prompts ueber den Praefix nach dem Filter der Spotlight-Leiste und
         klagte ueber einen Diebstahl, den es nicht gab -- oder nahm ihn, wenn die Spotlight-Leiste
         noch nicht gestartet war, und DANN klagte die. Die Ids in Bubble waren richtig. */
      function fremdeWurzel(w, rid) {
        if (w.__ufbHost && w.__ufbHost !== root && document.contains(w.__ufbHost)) return true;
        if (!rid) return false;
        var leisten = document.querySelectorAll(".ufb-root");
        for (var j = 0; j < leisten.length; j++) {
          if (leisten[j] === root) continue;
          var will = "";
          for (var k = 0; k < FILTERS.length; k++) {
            will = String(leisten[j].getAttribute(FILTERS[k].attr) || "").trim();
            if (will === rid) return true;
          }
        }
        return false;
      }
      function findeWurzel(f, streng) {
        var id = idVon(f);
        var alle = Array.prototype.slice.call(document.querySelectorAll(f.rootSel));
        if (!alle.length) return null;
        var i, rid;
        if (id) {
          for (i = 0; i < alle.length; i++) {
            rid = String(alle[i].getAttribute("data-instance") || "");
            if (rid === id) return alle[i];
          }
          /* Der Praefix nur als Rueckfall, und nie auf eine Wurzel, die einer anderen Leiste
             gehoert (siehe fremdeWurzel). Findet sich keine freie, kommt die eigene beim
             naechsten Durchlauf ueber den genauen Namen. */
          for (i = 0; i < alle.length; i++) {
            rid = String(alle[i].getAttribute("data-instance") || "");
            if (rid && rid.indexOf(id) === 0 && !fremdeWurzel(alle[i], rid)) return alle[i];
          }
        }
        if (streng) return null;
        var frei = alle.filter(function (w) {
          return !fremdeWurzel(w, String(w.getAttribute("data-instance") || ""));
        });
        if (frei.length === 1) {
          if (!gemeldet[f.key]) {
            gemeldet[f.key] = true;
            if (window.console) console.info("[filter-bar] " + instanceId + ": " + f.attr +
              ' ist "' + id + '", so heisst hier aber kein ' + f.label + '-Filter. Auf der Seite ' +
              'gibt es genau EINEN (data-instance="' +
              (frei[0].getAttribute("data-instance") || "") + '") -- der wird genommen. ' +
              'Trage die Id ein, dann ist es keine Vermutung mehr.');
          }
          return frei[0];
        }
        return null;
      }

      /* Kein const: die Liste wird neu bestimmt, sobald sich data-<filter>-visible aendert.
         Alle Stellen unten lesen die Variable zur Laufzeit, keine hat eine Kopie. */
      var liste = gewuenscht().filter(sichtbarLaut);

      /* Alles Eingezogene dorthin zurueck, wo es hergekommen ist. Ist der alte Elternteil selbst
         weg (Bubble hat ihn ersetzt), geht es an den Koerper: irgendwo im Dokument ist besser als
         nirgends -- dort findet die naechste Leiste es wieder, und der Filter selbst lebt weiter.
         Ausdruecklich OHNE Beobachter und ohne Automatik hier: gerufen wird das von genau einer
         Stelle, dem Waechter unten, und zwar nur fuer eine Wurzel, die nicht mehr im Dokument
         steht. Mein erster Anlauf hatte daraus einen Mechanismus mit zwei Beobachtern gemacht --
         das Ergebnis war eine stehende Seite. */
      /* ABGELOESTE WURZELN (28.09.). Baut Bubble ein FILTER-Element neu, entsteht eine frische
         Wurzel mit derselben data-instance. Sie traegt die aktuellen Attribute (data-isdark,
         data-isprocessing), und Auswahl und Liste hat sie aus der Ablage ihres Filters
         wiederhergestellt -- die alte ist ab da eine Leiche von Bubble. Bis hierhin kam sie
         trotzdem zurueck: beim Themenwechsel (Leiste UND Filter neu) setzte der Heimweg der alten
         Leiste sie neben die frische, und beim Neubau nur der Filter blieb sie in der Leiste,
         waehrend die frische daneben stand. Beides sichtbar als zweiter Topics-, Models- und
         Markets-Knopf neben More Filters (_h_flt.html, dup1..dup3: "im Dok 2", eine daneben und
         sichtbar), und die alte blieb bei ihrer Ablage angemeldet und zeichnete jede Liste mit.
         Erkannt wird die Abloesung an der GLEICHEN data-instance, wortgleich und nicht am
         Praefix: "topics_dash_2" ist eine zweite Platzierung, keine Abloesung von "topics_dash".
         Ohne Kennung wird nichts verglichen.
           frei    nur eine Wurzel, die keine ANDERE lebende Leiste haelt (Diebstahl-Riegel in
                   einziehen)
           gebaut  nur eine Wurzel, die ihr Filter schon eingerichtet hat. Eine frische Wurzel in
                   einer geparkten, unsichtbaren Gruppe ist noch leer (Lazy-Mount in core); gegen
                   sie wird nicht getauscht. Sie meldet sich selbst, sobald sie eingerichtet ist
                   (window.__ufbWurzelNeu). */
      function abloeser(f, alt, frei, gebaut) {
        var id = String(alt.getAttribute("data-instance") || "").trim();
        if (!id) return null;
        var alle = document.querySelectorAll(f.rootSel);
        for (var i = 0; i < alle.length; i++) {
          var k = alle[i];
          if (k === alt) continue;
          if (String(k.getAttribute("data-instance") || "").trim() !== id) continue;
          if (frei && k.__ufbHost && k.__ufbHost !== root && document.contains(k.__ufbHost)) continue;
          if (gebaut && !k[f.ctrl]) continue;
          return k;
        }
        return null;
      }
      /* Die abgeloeste Wurzel wegwerfen: ihr Spiegel-Beobachter ab, aus dem Baum. Mehr braucht es
         nicht -- ihre Ablage streicht sie beim naechsten Setzen selbst (ein Abonnent, dessen Wurzel
         nicht im Dokument steht, faellt raus), und ihren Zustand traegt die frische. Das ist kein
         Stilllegen: der Filter lebt weiter, nur in EINER Wurzel statt in zweien. */
      function verwerfen(alt) {
        if (alt.__ufbObs) { try { alt.__ufbObs.disconnect(); } catch (e) {} alt.__ufbObs = null; }
        if (alt.__ufbHost === root) alt.__ufbHost = null;
        if (alt.parentNode) { try { alt.parentNode.removeChild(alt); } catch (e) {} }
      }

      function heimschicken() {
        /* Ueber die LISTE und nicht ueber die gemerkten Heimatadressen: der Heimweg darf nicht
           daran haengen, dass die Buchfuehrung stimmt. Gemessen, warum das noetig ist -- beim
           ZWEITEN Ersetzen der Wurzel hintereinander war heim leer, und die Filter verschwanden
           trotz Heimweg aus dem Dokument ("im Dokument: ---").
           Und der Koerper als Rueckfall: irgendwo im Dokument ist immer besser als nirgends. Von
           dort holt die naechste Leiste sie wieder, und der Filter selbst laeuft weiter. Ein
           Element, das aus dem Dokument fliegt, ist unwiederbringlich -- ein Element an der
           falschen Stelle ist ein Schoenheitsfehler fuer 700ms. */
        liste.forEach(function (f) {
          var w = eingezogen[f.key];
          if (!w) return;
          /* Hat Bubble den Filter inzwischen neu gebaut, geht die alte Wurzel NICHT heim: die frische
             steht schon im Dokument (in ihrem Behaelter oder in der neuen Leiste), und die alte
             waere daneben ein zweiter Knopf. Nur wenn es keine frische gibt, gilt der Satz oben --
             dann ist der Heimweg das Einzige, was den Filter im Dokument haelt. */
          if (abloeser(f, w, false, false)) { verwerfen(w); delete eingezogen[f.key]; return; }
          var h = heim[f.key];
          var ziel = (h && h.eltern && document.contains(h.eltern)) ? h.eltern : document.body;
          try {
            if (ziel === document.body) ziel.appendChild(w);
            else ziel.insertBefore(w, (h.nachbar && h.nachbar.parentNode === ziel) ? h.nachbar : null);
          } catch (e) {
            try { document.body.appendChild(w); } catch (e2) {}
          }
          if (w.__ufbHost === root) w.__ufbHost = null;
          delete eingezogen[f.key];
        });
      }
      root.__ufbHeim = heimschicken;

      root.innerHTML =
        '<div class="ufb-bar">' +
          '<span class="ufb-more">' +
            /* settings-2 vorne, Beschriftung, dann der Chevron nach unten -- er sagt, dass hier
               ein Menue aufgeht, und er dreht sich NICHT beim Oeffnen (mehrfach so vorgegeben).
               KEIN Hinweispunkt: er stand hier und ist wieder raus. Dass Filter laufen, sagen die
               Chips daneben, und die sagen es genauer als ein Punkt. */
            '<button class="up-quietbtn ufb-btn" type="button" aria-haspopup="menu" aria-expanded="false">' +
              '<span class="ufb-btn-ic">' + UC.icon("settings2", 2) + '</span>' +
              /* "Filters", nicht mehr "More Filters" (03.10. angefordert, ueberall in der UI). */
              '<span class="ufb-btn-lbl">Filters</span>' +
              '<span class="ufb-btn-chev">' + UC.icon("chevronDown", 2.2) + '</span>' +
            '</button>' +
            '<div class="up-menu ufb-menu" role="menu" aria-hidden="true">' +
              /* Die Zurueck-Zeile gehoert nach OBEN und gibt es nur im Hineingehen -- core
                 blendet sie ueber .is-drill.is-inside ein. */
              '<button class="up-optrow up-subback ufb-row" type="button">' +
                UC.icon("chevronLeft", 2) + '<span class="ufb-back-lbl">Back</span>' +
              '</button>' +
              '<div class="ufb-rows"></div>' +
              /* Branded (13.10.): ein Schalter direkt im Panel, kein Untermenue -- es gibt nur
                 an/aus. Vorgabe aus: Prompts, die eine Marke nennen, zaehlen nicht mit (sie
                 bringen die Marke fast sicher in die Antwort). Nur mit freigegebenen Intents. */
              (intentsHier(root)
                ? '<div class="ufb-div ufb-branded-div"></div>' +
                  '<div class="up-pop-row ufb-branded" role="menuitemcheckbox" tabindex="0" aria-checked="false" data-ufb-branded>' +
                    /* "Branded prompts" -- so heisst die Achse bei Peec/Scrunch ("Branding",
                       "Branded Query"); kurz genug fuer eine Zeile. */
                    '<span class="up-pop-label">Branded prompts</span>' +
                    '<span class="up-switch"></span>' +
                  '</div>'
                : '') +
              /* Reset in einer Huelle, die von 0 auf ihre Hoehe faehrt (200ms). Vorher stand hier
                 display: none -- und daran gibt es nichts zu animieren, die Zeile war einfach
                 ploetzlich da. */
              '<div class="ufb-resetbox">' +
                '<div class="ufb-resetin">' +
                  '<div class="ufb-div"></div>' +
                  '<button class="up-optrow ufb-reset" type="button" data-ufb-reset>' +
                    '<span>Reset Filters</span>' +
                    '<span class="ufb-reset-x">' + UC.icon("x", 2.2) + '</span>' +
                  '</button>' +
                '</div>' +
              '</div>' +
              /* GESPEICHERTE FILTER (15.10., nur in der grossen Form -- filter-bar.css blendet den
                 Abschnitt sonst aus): die Auswahl aller Filter dieses Menues unter einem Namen, im
                 localStorage dieses Nutzers, keine Datenbank. Siehe gesp* unten. */
              '<div class="ufb-gesp">' +
                '<div class="ufb-div"></div>' +
                '<div class="ufb-gesp-kopf">Saved filters</div>' +
                '<div class="ufb-gesp-liste"></div>' +
                '<button class="up-optrow ufb-gesp-neu" type="button" data-gesp-neu>' +
                  '<span class="ufb-gesp-ic">' + UC.icon("bookmarkPlus", 2) + '</span><span>Save current filters</span></button>' +
                '<div class="ufb-gesp-feld" hidden>' +
                  '<input class="up-ment-search ufb-gesp-name" type="text" maxlength="40" placeholder="Name" aria-label="Name for these filters" autocomplete="off" spellcheck="false"/>' +
                  '<button class="up-btn-sec ufb-gesp-sichern" type="button" data-gesp-sichern>Save</button>' +
                '</div>' +
              '</div>' +
              /* EINE Schale fuer alle drei Filter, nicht eine je Zeile. Sie rueckt an die offene
                 Zeile und nimmt deren Hoehe an -- der weisse Kasten bleibt beim Wechsel sichtbar
                 und rutscht, statt aus- und wieder einzublenden. Das Verhalten steht in
                 UC.makeSubmenu (cfg.shell), die Huellen bleiben, wo sie sind: umgehaengt wird
                 NICHTS, denn darin liegen die eingezogenen Filterwurzeln. */
              '<div class="up-submenu ufb-sub">' +
                liste.map(function (f) {
                  return '<div class="up-subhost ufb-host" data-sub-host="' + esc(f.key) + '"></div>';
                }).join("") +
              '</div>' +
            '</div>' +
          '</span>' +
          '<span class="ufb-sep" aria-hidden="true"></span>' +
          '<span class="ufb-chips"></span>' +
          '<button class="ufb-clear" type="button" data-ufb-clear>Clear All</button>' +
        '</div>';

      var elBtn   = root.querySelector(".ufb-btn");
      var elMenu  = root.querySelector(".ufb-menu");
      var elMore  = root.querySelector(".ufb-more");
      var elRows  = root.querySelector(".ufb-rows");
      var elSub   = root.querySelector(".ufb-sub");
      var elChips = root.querySelector(".ufb-chips");

      var fire = UC.makeFire(root, { label: "filter-bar", eventPrefix: "ufb" });
      function isDark() {
        return UC.themeParam(root.getAttribute("data-isdark")) || root.getAttribute("data-theme") === "dark";
      }
      if (UC.makeTooltips) UC.makeTooltips(root, isDark);

      /* ---------------- die Vorfahren aufmachen ----------------
         Bubble legt um jedes HTML-Element eine Gruppe, und steht dort eine Hoehe -- der Normalfall
         fuer eine 32px hohe Werkzeugzeile --, schneidet sie mit overflow: hidden alles ab, was aus
         ihrer Box heraus will. Ein absolut positioniertes Panel von 248x118 unter einem 32px hohen
         Knopf ist genau das.
         Das ist der Grund, warum diese Leiste im alten Harness aufging und auf der echten Seite
         nicht: dort steht kein klemmender Container. Gemeldet als "kein Dropdown sichtbar, der
         Knopf ist aber im offenen Zustand, kein Fehler in der Konsole" -- und so gemessen in
         _h_ufb_clip.html, der die Form einer Bubble-Seite nachbaut:

             ohne diese Zeile   is-shown: true, Punkt im Menue trifft "bubble-element", overflow
                                der beiden Gruppen: hidden / hidden
             mit dieser Zeile   Punkt im Menue trifft das Menue, overflow: visible / visible

         Es fehlte NUR hier: topics-, models-, markets- und date-range-Filter rufen dieselbe Zeile
         alle vier (gemessen: drei aufgemachte Gruppen im Dokument, keine davon die der Leiste).
         Dieselbe Form wie dort -- ein Argument, also restore = false. Angefasst wird ausschliesslich
         overflow, NIEMALS z-index eines fremden Vorfahren (das hat am 11.08. die App lahmgelegt). */
      if (UC.unclipAncestors) UC.unclipAncestors(root);

      /* ---------------- die Zeilen ----------------
         Eine Zeile je vorgesehenem Filter, in der Reihenfolge von FILTERS. Der Spiegel ist leer
         und wird aus dem Trigger des Filters gefuellt, sobald er eingezogen ist. */
      function zeilenBauen() {
        elRows.innerHTML = liste.map(function (f) {
          return '<div class="up-subwrap ufb-wrap" data-sub="' + esc(f.key) + '">' +
                   '<button class="up-optrow ufb-row up-subrow" type="button" aria-expanded="false" ' +
                     'aria-haspopup="menu">' +
                     /* Das Zeichen der Zeile ist FEST und gehoert dieser Komponente: es sind die
                        Trigger-Zeichen der drei Filter (tags / layers / map-pin), jetzt aus core
                        statt als Kopie. Gespiegelt wird es NICHT -- der Trigger tauscht sein
                        Zeichen gegen das Logo bzw. die Flagge des gewaehlten Eintrags, sobald
                        genau einer gewaehlt ist. Das ist am Trigger richtig (dort ersetzt es die
                        ganze Beschriftung) und in einer Menuezeile falsch: dort stand dann ein
                        Modell-Logo, wo das Zeichen fuer "Models" hingehoert. */
                     '<span class="ufb-row-ic">' + UC.icon(f.icon, 2) + '</span>' +
                     '<span class="ufb-mirror" data-mirror>' +
                       '<span class="ufb-mirror-fallback">' + esc(f.label) + '</span>' +
                     '</span>' +
                     /* Die grosse Form (gross() oben): Name links, Wert rechts. Gefuellt in
                        spiegeln(), gezeigt nur mit data-form="gross" (filter-bar.css). */
                     '<span class="ufb-row-lbl">' + esc(f.label) + '</span>' +
                     '<span class="ufb-row-wert"></span>' +
                     '<span class="ufb-caret">' + UC.icon("chevronRight", 2) + '</span>' +
                   '</button>' +
                 '</div>';
        }).join("");
        /* Der Hinweis steht IMMER im Markup und wird ueber eine Klasse gezeigt: er greift nicht nur
           bei "kein Filter eingetragen", sondern auch bei "eingetragen, aber keiner erreichbar"
           (Element noch nicht da, oder es haengt schon in einer anderen Leiste). Ein Panel, das
           ohne Grund leer aufgeht, ist der Zustand, den es hier nicht geben soll. */
        elRows.insertAdjacentHTML("beforeend",
          '<div class="up-empty-mini ufb-empty"><span data-empty-txt>' +
            (liste.length ? "These filters are not on this page yet" : "No filters on this page") +
          '</span></div>');
      }
      zeilenBauen();

      /* ---------------- Einziehen ----------------
         Wiederholbar mit Absicht: Bubble baut die Filterelemente nach einem Rerender neu auf, und
         dann steht die alte Wurzel nicht mehr im Dokument. Der Lauf holt sie dann erneut.
         Ein Filter, der (noch) nicht da ist, bekommt keine Zeile -- eine Zeile, die auf ein leeres
         Untermenue fuehrt, ist die schlechtere Auskunft. */
      var eingezogen = {};
      var geklagt = {};
      /* Wo der Filter HERKAM. Ohne das ist das Einziehen eine Einbahnstrasse, und die endet in
         echtem Schaden: nimmt Bubble das Element dieser Leiste aus dem Dokument, gehen die
         eingezogenen Filter MIT -- sie sind dann nicht bloss nicht eingezogen, sie sind weg.
         Gemessen im Harness (_h_ufb_neu.html): nach dem Ersetzen der Wurzel stand dort
         "im Dokument: ---", also kein einziger Filter mehr. Danach sagt das Panel "These filters
         are not on this page yet", und genau so wurde es gemeldet. */
      var heim = {};
      function einziehen() {
        /* Steht DIESE Wurzel nicht mehr im Dokument, ist sie eine Leiche -- und eine Leiche darf
           keine Filterelemente an sich ziehen. Genau daran haben die Filter zweimal das Dokument
           verlassen: nach einem Rerender lebt der Abschluss der alten Wurzel weiter (seine Uhren
           und sein aufResize-Zuhoerer laufen), und sein `host` liegt in einem abgehaengten Baum.
           Ein appendChild dorthin nimmt den Filter aus dem Dokument, und danach findet ihn
           niemand mehr -- auch die neue Leiste nicht, denn die sucht mit querySelectorAll.
           Gemessen: ohne diese Zeile "im Dokument: ---" nach dem Ersetzen der Wurzel, mit ihr
           "tmk". Der Heimweg allein reicht nicht; er raeumt nur auf, was diese Zeile verhindert. */
        if (!document.contains(root)) return;
        var etwasNeu = false;
        liste.forEach(function (f) {
          var host = elSub && elSub.querySelector('[data-sub-host="' + f.key + '"]');
          /* Die Huellen entstehen beim Aufbau, aus der DAMALIGEN Liste. Ein Filter, der erst
             spaeter sichtbar wird (data-<filter>-visible kippt auf ja), hatte keine -- und wurde
             nie eingezogen. Fiel auf mit den Filtern der Prompt-Tabelle, die auf dem Reiter
             Responses ausgeblendet starten. */
          if (!host && elSub) {
            host = document.createElement("div");
            host.className = "up-subhost ufb-host";
            host.setAttribute("data-sub-host", f.key);
            elSub.appendChild(host);
          }
          if (!host) return;
          var da = eingezogen[f.key];
          var w = null;
          if (da && document.contains(da) && da.parentNode === host) {
            /* Steht schon -- es sei denn, Bubble hat den Filter inzwischen neu gebaut: dann steht
               die frische Wurzel daneben, und die hier traegt veraltete Attribute. Getauscht wird
               gegen die frische, die alte fliegt raus (siehe abloeser). */
            w = abloeser(f, da, true, true);
            if (!w) return;   /* steht schon, und niemand loest sie ab */
            verwerfen(da);
            delete eingezogen[f.key];
          }
          if (!w) w = findeWurzel(f);
          if (!w) return;
          /* Eine Filterwurzel ist EIN Knoten und kann nur an einer Stelle stehen. Liegt sie schon
             in der Leiste eines anderen Elements, wird sie NICHT weggenommen -- gemessen, als ich
             eine zweite Leiste auf dieselben Instanz-Ids zeigen liess: die zweite zog Topics und
             Markets zu sich, und in der ersten standen die Zeilen danach leer. Ein stiller
             Diebstahl ist der schlechteste Ausgang, also wird er verweigert und benannt. */
          /* Ein Filter gehoert genau EINER Leiste. Liegt er schon in der eines anderen Elements,
             wird er NICHT weggenommen -- ein stiller Diebstahl ist der schlechteste Ausgang.
             Der Vergleich laeuft ueber die KNOTENGLEICHHEIT und nicht ueber data-instance. Das ist
             gemessen und nicht Geschmack: der Versuch, die eigene vorige Ausgabe an der gleichen
             data-instance zu erkennen und durchzulassen, hat den Heimweg gebrochen -- nach dem
             Ersetzen der Wurzel standen die Filter wieder ausserhalb des Dokuments. Der Preis
             dafuer ist eine Warnung, die nach einem Rerender einmal ueber die eigene Vorgaengerin
             klagt. Laerm in der Konsole gegen verlorene Elemente: der Laerm gewinnt. */
          if (w.__ufbHost && w.__ufbHost !== root && document.contains(w.__ufbHost)){
            if (!geklagt[f.key]){
              geklagt[f.key] = true;
              if (window.console) console.warn("[filter-bar] " + instanceId + ": der " + f.label +
                "-Filter \"" + idVon(f) + "\" liegt schon in der Leiste \"" +
                (w.__ufbHost.getAttribute("data-instance") || "?") + "\". Ein Filter-Dropdown kann " +
                "nur in EINER Leiste stehen. Gib dieser Leiste eine eigene Instanz-Id oder lass " +
                "das Attribut hier leer.");
            }
            return;
          }
          /* Heimatadresse EINMAL merken, beim ersten Einziehen. Danach nicht mehr ueberschreiben:
             die "Heimat" waere sonst mein eigenes Untermenue. */
          if (!heim[f.key] && w.parentNode && w.parentNode !== host) {
            heim[f.key] = { eltern: w.parentNode, nachbar: w.nextSibling };
          }
          w.__ufbHost = root;
          host.appendChild(w);
          eingezogen[f.key] = w;
          etwasNeu = true;
          spiegelBeobachten(f, w);
          /* Ein Filter, der hier ankommt, war womoeglich draussen -- siehe nachziehen. */
          nachziehen(f);
        });
        zeilenStand();
        /* Der Hinweis BENENNT, was fehlt. "These filters are not on this page yet" allein liess
           den Nutzer im Dunkeln -- und die Antwort ist immer eine von zwei: die Id passt nicht,
           oder das Filterelement ist in Bubble ausgeblendet und darum gar nicht im Dokument. */
        var txtEl = elRows.querySelector("[data-empty-txt]");
        if (txtEl && liste.length){
          var fehlen = liste.filter(function (f) { return !eingezogen[f.key]; })
                            .map(function (f) { return f.label; });
          txtEl.textContent = fehlen.length
            ? fehlen.join(", ") + (fehlen.length === 1 ? " is" : " are") + " not on this page yet"
            : "These filters are not on this page yet";
        }
        if (etwasNeu) { spiegelnAlle(); render(); }
      }
      /* Welche Zeilen stehen: eingezogen und nicht selbst abgemeldet (ausGemeldet). Auch aus
         render() gerufen, weil sich die Abmeldung ohne Einziehen aendert (Active/Inactive). */
      function zeilenStand() {
        var sichtbar = 0;
        liste.forEach(function (f) {
          var wrap = elRows.querySelector('.up-subwrap[data-sub="' + f.key + '"]');
          if (!wrap) return;
          var leer = !eingezogen[f.key] || ausGemeldet(f);
          wrap.classList.toggle("is-leer", leer);
          if (!leer) sichtbar++;
        });
        elRows.classList.toggle("is-empty", sichtbar === 0);
      }

      /* Der Spiegel: das Innere des Triggers, ohne dessen Chevron. Woertlich uebernommen und nicht
         nachgebaut -- der Filter rendert dort schon "Punkt + Name" bei einer Auswahl und
         "Beschriftung + Zaehler" ab zwei, und das soll in der Zeile genauso stehen. */
      function spiegeln(f) {
        var w = eingezogen[f.key];
        var wrap = elRows.querySelector('.up-subwrap[data-sub="' + f.key + '"]');
        var ziel = wrap && wrap.querySelector("[data-mirror]");
        if (!ziel) return;
        /* Beschriftung und Wert der grossen Form (data-form="gross", 15.10.) -- dort steht die Zeile
           als "Name ........ Wert" statt als Spiegel. Beide immer mitschreiben; welche Form zu
           sehen ist, entscheidet die CSS. */
        var lblEl = wrap.querySelector(".ufb-row-lbl"), wertEl = wrap.querySelector(".ufb-row-wert");
        var icEl = wrap.querySelector(".ufb-row-ic");
        if (icEl) { var zh = zeichenVon(f); if (icEl.__ufbZeichen !== zh) { icEl.__ufbZeichen = zh; icEl.innerHTML = zh; } }
        if (lblEl) lblEl.textContent = tr(labelVon(f));
        if (wertEl) {
          var cw = chipText(f);
          wertEl.textContent = cw ? cw.wert : tr(leerVon(f));
          wertEl.classList.toggle("is-gesetzt", !!cw);
        }
        var trig = w && w.querySelector(TRIG_SEL);
        if (!trig) { ziel.innerHTML = '<span class="ufb-mirror-fallback">' + esc(labelVon(f)) + "</span>"; return; }
        var teile = [];
        Array.prototype.forEach.call(trig.children, function (c) {
          /* Ihr eigener Chevron bleibt draussen: die Zeile hat ihren eigenen, und der zeigt nach
             rechts (dort kommt das Untermenue heraus) und nicht nach unten.
             Und ihr ZEICHEN ebenso: die Zeile bringt ihr eigenes mit (siehe ufb-row-ic). Der
             Trigger tauscht das Zeichen gegen Logo bzw. Flagge des gewaehlten Eintrags -- in der
             Zeile stand damit ein Modell-Logo statt des Zeichens fuer "Models". Ein SVG als
             direktes Kind ist bei topics das Zeichen, bei models/markets steckt es in
             .umf-trigger-ic / .umk-trigger-ic. */
          if (c.classList && CHEV_KLASSEN.some(function (k) { return c.classList.contains(k); })) return;
          /* Der Zeichenhalter der Filter (.umf-trigger-ic / .umk-trigger-ic) traegt ZWEI Dinge,
             je nach Zustand: ohne oder mit mehreren Auswahlen das Zeichen des Filters, bei genau
             einer das LOGO des Modells bzw. die FLAGGE des Marktes. Das Zeichen waere hier
             doppelt (die Zeile bringt ihr eigenes mit) -- das Logo und die Flagge sind dagegen
             genau das, was in der Zeile stehen soll.
             Unterschieden wird am INHALT und nicht am Zustand: enthaelt er ein Bild (oder den
             Buchstaben-Rueckfall dazu), bleibt er; ist es nur ein SVG, faellt er weg. Ein
             blosses <svg> als direktes Kind ist bei topics dasselbe. */
          var nurZeichen = c.tagName && c.tagName.toLowerCase() === "svg";
          if (!nurZeichen && c.classList &&
              (c.classList.contains("umf-trigger-ic") || c.classList.contains("umk-trigger-ic"))){
            nurZeichen = !c.querySelector("img") && !!c.querySelector("svg");
          }
          if (nurZeichen) return;
          teile.push(c.cloneNode(true));
        });
        ziel.innerHTML = "";
        if (!teile.length) { ziel.innerHTML = '<span class="ufb-mirror-fallback">' + esc(labelVon(f)) + "</span>"; return; }
        teile.forEach(function (t) { ziel.appendChild(t); });
      }
      function spiegelnAlle() { liste.forEach(spiegeln); }

      /* Der Trigger aendert sich, wenn der Nutzer im Filter etwas anhakt -- der Filter rendert ihn
         dann neu. Ein Beobachter je Filter statt eines Pollings. */
      function spiegelBeobachten(f, w) {
        if (!window.MutationObserver || w.__ufbObs) return;
        var trig = w.querySelector(TRIG_SEL);
        if (!trig) return;
        w.__ufbObs = new MutationObserver(function () { spiegeln(f); render(); });
        w.__ufbObs.observe(trig, { childList: true, subtree: true, characterData: true,
                                   attributes: true, attributeFilter: ["class", "style"] });
      }

      /* ---------------- den Filter auf Stand bringen (27.09.) ----------------
         Diese Leiste ist der Grund, warum eine Filterwurzel ueberhaupt aus dem Dokument faellt:
         baut Bubble die Leiste neu, haengen die eingezogenen Filter bis zum Heimweg (Waechter,
         bis 700ms) im abgehaengten Baum der alten. Setzt die Seite GENAU DANN eine Ablage
         (setUpstreemModels/Markets beim Seitenaufbau), streicht core ihr Abo -- und der Filter
         zeigt fuer die ganze Sitzung "No models yet". Gemeldet 27.09. im Gruppierungsmodus: dort
         kippt data-topics-visible beim Seitenaufbau, und Bubble baut die Leiste genau in dem
         Augenblick neu, in dem der Page-Load-Workflow laeuft (_h_flt.html, Szenario s6).
         Wer die Knoten bewegt, sagt es ihnen: beim Einziehen und beim Aufgehen ruft die Leiste
         sync() des Filters. Das ist SEINE oeffentliche Auskunft, wie getSelected -- der Filter
         entscheidet selbst, ob er etwas verpasst hat (ein Zahlenvergleich), und holt es dann
         nach. Kein Beobachter, keine Uhr. Ein Filter aus einer aelteren Datei ohne sync() wird
         einfach uebergangen. */
      function nachziehen(f) {
        var w = eingezogen[f.key];
        var c = w && w[f.ctrl];
        if (c && typeof c.sync === "function") { try { c.sync(); } catch (e) {} }
      }

      /* ---------------- Zustand lesen ----------------
         Ausschliesslich ueber die oeffentliche Auskunft der Filter. Kein Nachrechnen, kein
         Nachhalten -- was der Filter sagt, gilt. */
      function auswahl(f) {
        var w = eingezogen[f.key];
        var c = w && w[f.ctrl];
        if (!c || typeof c.getSelected !== "function") return [];
        var s = null;
        try { s = c.getSelected(); } catch (e) { return []; }
        var csv = s && s[f.selKey] != null ? String(s[f.selKey]) : "";
        return csv.split(",").map(function (x) { return x.trim(); }).filter(Boolean);
      }
      /* Die Namen: je gewaehlter Schluessel die passende Zeile seiner eigenen Liste nachschlagen.
         Ueber den SCHLUESSEL und nicht ueber die Klasse is-checked -- die Reihenfolge folgt damit
         der Auswahl des Nutzers, und eine Liste, die gerade neu gerendert wird, kann nicht
         dazwischenfunken.
         Findet sich keine Zeile (Daten noch unterwegs, oder ein gespeicherter Filter zeigt auf
         einen Eintrag, den es nicht mehr gibt), bleibt der ROHE Schluessel stehen. Der sagt
         immer noch, WAS gefiltert wird -- "Model: gpt-4o" ist eine Auskunft, eine Zahl waere
         keine. Leer und unbekannt sind zwei Dinge. */
      function namen(f) {
        var w = eingezogen[f.key];
        var ids = auswahl(f);
        if (!w) return ids;
        return ids.map(function (id) {
          var sel = f.opt + '[' + f.keyAttr + '="' + cssEsc(id) + '"]';
          var row = null;
          try { row = w.querySelector(sel); } catch (e) {}
          var n = row && row.querySelector(f.nameSel);
          var t = n ? String(n.textContent || "").trim() : "";
          return t || id;
        });
      }
      /* Schluessel koennen Zeichen enthalten, die in einem Attributselektor Syntax sind. */
      function cssEsc(v) {
        var t = String(v == null ? "" : v);
        if (window.CSS && CSS.escape) return CSS.escape(t);
        return t.replace(/["\\]/g, "\\$&");
      }
      function aktiv() { return liste.filter(function (f) { return !ausGemeldet(f) && auswahl(f).length > 0; }); }
      /* Branded mitgezaehlt (13.10.)? Das ist die Abweichung von der Vorgabe und damit ein Filter,
         der sichtbar sein muss: als Chip und fuer Reset/Clear All. */
      function brandedAn() {
        return !!(intentsHier(root) && brandedHier() && UC.intentFilterGet && UC.intentFilterGet().branded === "all");
      }
      function brandedSyncen() {
        var z = root.querySelector("[data-ufb-branded]");
        if (!z) return;
        var an = brandedAn();
        z.setAttribute("aria-checked", an ? "true" : "false");
        var sw = z.querySelector(".up-switch");
        if (sw) sw.classList.toggle("is-on", an);
      }

      /* ---------------- Chips ---------------- */
      function chipText(f) {
        var ids = auswahl(f);
        if (!ids.length) return null;
        var nm = namen(f).filter(Boolean);
        var wert;
        if (!nm.length) {
          /* Kann eigentlich nicht mehr vorkommen -- namen() faellt auf den rohen Schluessel
             zurueck. Bleibt als Netz: eine Zahl ist besser als ein leerer Chip. */
          wert = String(ids.length);
        } else if (nm.length <= CHIP_NAMEN) {
          wert = nm.join(", ");
        } else {
          wert = nm.slice(0, CHIP_NAMEN).join(", ") + ", +" + (nm.length - CHIP_NAMEN);
        }
        return { key: f.chip, wert: wert };
      }
      /* Die Bedingung im Chip der grossen Form: ein Wert "is", mehrere "is any of" -- ausser bei
         Topics im Modus "and" (Prompts, die ALLE gewaehlten Topics tragen): "is all of". */
      /* DAS BILD VOR JEDEM WERT im Chip der grossen Form (15.10., wie Entwurf B): bei Topics der
         farbige Strich (oder das Emoji des Topics), bei Models das Logo, bei Markets die Flagge, bei
         Intent das Zeichen, bei den Marken das Logo. Genommen wird es aus der Zeile des Filters
         selbst -- dieselbe Quelle wie der Name (namen()), also kein zweiter Renderer. */
      var WERT_BILD = { models: ".umf-opt-logo", markets: ".umk-opt-flag", intents: ".uif-opt-main > svg", brands: ".up-ment-logo", rbrands: ".up-ment-logo",
                        dbrands: ".up-ment-logo", ubrands: ".up-ment-logo" };
      function wertBild(f, id) {
        var w = eingezogen[f.key];
        if (!w) return "";
        var row = null;
        try { row = w.querySelector(f.opt + '[' + f.keyAttr + '="' + cssEsc(id) + '"]'); } catch (e) { row = null; }
        if (!row) return "";
        if (f.key === "topics") {
          var em = row.querySelector(".utf-opt-emoji");
          if (em) return '<span class="ufb-wert-emoji">' + esc(em.textContent) + '</span>';
          var farbe = String(row.style.getPropertyValue("--utf-tc") || "").trim();
          return /^#[0-9a-f]{3,8}$/i.test(farbe) ? '<span class="ufb-wert-farbe" style="background:' + farbe + '"></span>' : "";
        }
        var sel = WERT_BILD[f.key];
        var b = sel ? row.querySelector(sel) : null;
        if (!b) return "";
        var k = b.cloneNode(true);
        k.classList.add("ufb-wert-bild");
        return k.outerHTML;
      }
      function wertHtml(f) {
        var ids = auswahl(f), nm = namen(f);
        var teile = ids.slice(0, CHIP_NAMEN).map(function (id, i) {
          return '<span class="ufb-wert-eins">' + wertBild(f, id) + '<span class="ufb-wert-name">' + esc(nm[i] || id) + '</span></span>';
        });
        if (ids.length > CHIP_NAMEN) teile.push('<span class="ufb-wert-mehr">+' + (ids.length - CHIP_NAMEN) + '</span>');
        return teile.join("");
      }
      function bedingung(f) {
        if (auswahl(f).length <= 1) return "is";
        if (f.key === "topics") {
          var w = eingezogen[f.key], c = w && w[f.ctrl], sel = null;
          try { sel = c && typeof c.getSelected === "function" ? c.getSelected() : null; } catch (e) { sel = null; }
          if (sel && sel.tag_mode === "and") return "is all of";
        }
        return "is any of";
      }
      /* UC.t, wo es das gibt -- eine aeltere core.js ohne Katalog laesst die englischen Worte stehen,
         statt die Leiste zu zerlegen. */
      function tr(s) { return UC.t ? UC.t(s) : s; }
      function renderChips() {
        var teile = [];
        /* In der grossen Form ist der Chip selbst ein Knopf: ein Klick oeffnet SEIN Untermenue
           direkt darunter (oeffnen() unten), das X leert wie bisher. */
        var klick = gross();
        liste.forEach(function (f) {
          if (ausGemeldet(f)) return;
          var c = chipText(f);
          if (!c) return;
          /* DAS ZEICHEN DES FILTERS VORNE (24.09. angefordert, mit dem Sortier-Chip als Vorbild:
             Zeichen, leiser Bezug, lauter Wert, X). Es ist dasselbe, das die Zeile im Panel
             traegt (ufb-row-ic) und das der Filter an seinem Trigger fuehrt -- ein Chip mit
             einem ANDEREN Zeichen waere ein zweiter Name fuer dieselbe Sache. */
          /* Die Worte laufen durch den Katalog (28.09. gemeldet: im deutschen Setting stand am X
             "Clear Models"). Der Sprachlauf von core erreicht einen zusammengesetzten Satz nie --
             "Clear Models" steht in keinem Katalog, nur "Clear {filter}". Also hier uebersetzen
             und den Namen DANACH einsetzen, selbst schon uebersetzt. Der Bezug vorne ("Model: ")
             aus demselben Grund. */
          var name = tr(labelVon(f));
          var tip = tr("Clear {filter}").split("{filter}").join(name);
          var aria = tr("Clear {filter} filter").split("{filter}").join(name);
          var innen = '<span class="ufb-chip-ic">' + zeichenVon(f) + '</span>' +
            '<span class="ufb-chip-lbl"><span class="ufb-chip-key">' + esc(tr(chipVon(f))) + ': </span>' +
            esc(c.wert) + '</span>';
          /* Klickbar: Zeichen und Text stecken in einem EIGENEN Knopf neben dem X -- ein Knopf im
             Knopf waere fuer Tastatur und Vorleser eine Sache statt zwei.
             Und in der Form aus Entwurf B (15.10. gewaehlt): Name, Bedingung, Wert als drei Teile mit
             feinem Strich dazwischen -- "Topic | is any of | SUV, EV". Die Bedingung sagt, wie mehrere
             Werte zusammenwirken (Topics im Modus "and": "is all of"). */
          if (klick) innen = '<button class="ufb-chip-auf" type="button" data-chip-open="' + esc(f.key) + '" aria-haspopup="menu">' +
            '<span class="ufb-chip-teil ufb-chip-name"><span class="ufb-chip-ic">' + zeichenVon(f) + '</span>' + esc(tr(chipVon(f))) + '</span>' +
            '<span class="ufb-chip-teil ufb-chip-op">' + esc(tr(bedingung(f))) + '</span>' +
            '<span class="ufb-chip-teil ufb-chip-wert">' + wertHtml(f) + '</span>' +
          '</button>';
          teile.push('<span class="up-entchip is-static ufb-chip' + (klick ? " is-klick is-teile" : "") + '" data-chip="' + esc(f.key) + '">' +
            innen +
            '<button class="ufb-chip-x" type="button" data-chip-clear="' + esc(f.key) + '" ' +
              'aria-label="' + esc(aria) + '" data-tip="' + esc(tip) + '">' +
              UC.icon("x", 2.6) + '</button>' +
          '</span>');
        });
        if (brandedAn()) {
          var bn = tr("Branded"), btip = tr("Clear {filter}").split("{filter}").join(bn);
          teile.push('<span class="up-entchip is-static ufb-chip" data-chip="branded">' +
            '<span class="ufb-chip-ic">' + UC.icon("flag", 2) + '</span>' +
            '<span class="ufb-chip-lbl"><span class="ufb-chip-key">' + esc(bn) + ': </span>' + esc(tr("Included")) + '</span>' +
            '<button class="ufb-chip-x" type="button" data-chip-clear="branded" aria-label="' +
              esc(tr("Clear {filter} filter").split("{filter}").join(bn)) + '" data-tip="' + esc(btip) + '">' +
              UC.icon("x", 2.6) + '</button>' +
          '</span>');
        }
        elChips.innerHTML = teile.join("");
        chipZustand();
      }

      /* EINE Entscheidung fuer beide Dinge, die von der Seitenbreite abhaengen: bricht die Leiste
         um, und geht das Untermenue hinein statt heraus. Sie steht hier und wird an
         UC.makeSubmenu durchgegeben (cfg.drill) -- zwei Rechnungen aus derselben Zahl laufen
         auseinander, und beim Messen war genau das der Fall: der Kit rechnete mit seiner eigenen
         Kopie von getPageWidth und blieb im Herausfahren, waehrend die Leiste schon umgebrochen
         war. Gemessen an der SEITENbreite und nicht an der eigenen: dieses Element ist in einer
         Werkzeugzeile ohnehin schmal, die Frage ist, wie viel Platz die Seite hat. */
      function schmal() { return UC.getPageWidth() < SCHMAL; }
      /* Vom Chip geoeffnet (grosse Form): das Untermenue geht HINEIN statt seitlich heraus, direkt
         unter dem Chip -- wie ein Dropdown dieses einen Filters. "Back" fuehrt zu allen Filtern.
         Zurueck auf false beim Schliessen (onClose des Panels). */
      var vomChip = false;
      function hinein() { return schmal() || vomChip; }

      /* ---------------- gespeicherte Filter (15.10.) ----------------
         "bitte eine Moeglichkeit, die Filterauswahl zu speichern -- im localStorage reicht, keine
         DB-Aktion". Gespeichert wird die Auswahl JEDES Filters dieses Menues (bei Topics auch der
         Modus and/or), unter dem Schluessel dieser Leiste und des Nutzers (UC.prefKey). Laden
         setzt jeden Filter ueber seinen eigenen Weg: still setzen, dann dasselbe Ereignis, das ein
         Klick im Filter ausloest (Vorbild ads.js topicWaehlen) -- Intent und die Filter der
         Prompt-Tabelle melden sich beim Setzen selbst. Die Seite laedt danach einmal (sie buendelt). */
      var GESP_KEY = UC.prefKey ? UC.prefKey("ufb_gespeichert__" + instanceId) : "ufb_gespeichert__" + instanceId;
      var GESP_MAX = 20;
      function gespLesen() {
        var roh = UC.prefGet ? UC.prefGet(GESP_KEY) : null, l = null;
        try { l = JSON.parse(roh || "[]"); } catch (e) { l = []; }
        return Array.isArray(l) ? l.filter(function (x) { return x && typeof x.name === "string" && x.werte && typeof x.werte === "object"; }) : [];
      }
      function gespSchreiben(l) { if (UC.prefSet) UC.prefSet(GESP_KEY, JSON.stringify(l)); }
      function normCsv(v) { return String(v || "").split(",").map(function (x) { return x.trim(); }).filter(Boolean).sort().join(","); }
      function topicsModus() {
        var w = eingezogen.topics, c = w && w.__utfCtrl, sel = null;
        try { sel = c && typeof c.getSelected === "function" ? c.getSelected() : null; } catch (e) { sel = null; }
        return sel && sel.tag_mode === "and" ? "and" : "or";
      }
      function aktuelleWerte() {
        var w = {};
        liste.forEach(function (f) { w[f.key] = auswahl(f).join(","); });
        if (w.topics) w.topics_mode = topicsModus();
        return w;
      }
      function gespGleich(a) {
        var jetzt = aktuelleWerte();
        return liste.every(function (f) { return normCsv(a[f.key]) === normCsv(jetzt[f.key]); }) &&
          (!jetzt.topics || (a.topics_mode || "or") === jetzt.topics_mode);
      }
      function setzenMitEreignis(f, csv, modus) {
        var w = eingezogen[f.key], c = w && w[f.ctrl];
        if (!c || typeof c.setSelected !== "function") return;
        if (f.key === "topics" && modus && typeof c.setMode === "function") { try { c.setMode(modus); } catch (e) {} }
        try { c.setSelected(csv); } catch (e) {}
        if (f.key !== "topics" && f.key !== "models" && f.key !== "markets") return;
        var sel = {};
        try { sel = c.getSelected() || {}; } catch (e) { sel = {}; }
        var d = { instance_id: String(w.getAttribute("data-instance") || ""), count: normCsv(csv) ? normCsv(csv).split(",").length : 0 };
        Object.keys(sel).forEach(function (k) { d[k] = sel[k]; });
        try { w.dispatchEvent(new CustomEvent(f.evt, { bubbles: true, detail: d })); } catch (e) {}
      }
      function gespLaden(i) {
        var e = gespLesen()[i];
        if (!e) return;
        liste.forEach(function (f) {
          var soll = String(e.werte[f.key] || "");
          var modus = f.key === "topics" ? (e.werte.topics_mode === "and" ? "and" : "or") : null;
          var gleich = normCsv(soll) === normCsv(auswahl(f).join(","));
          if (gleich && (f.key !== "topics" || !soll || modus === topicsModus())) return;
          setzenMitEreignis(f, soll, modus);
        });
        spiegelnAlle();
        render();
      }
      function gespWeg(i) {
        var l = gespLesen();
        if (!l[i]) return;
        l.splice(i, 1);
        gespSchreiben(l);
        gespZeichnen();
      }
      function gespFeld(an) {
        var feld = root.querySelector(".ufb-gesp-feld"), neu = root.querySelector(".ufb-gesp-neu");
        if (!feld) return;
        feld.hidden = !an;
        if (neu) neu.hidden = !!an;
        if (an) { var inp = feld.querySelector(".ufb-gesp-name"); if (inp) { inp.value = ""; try { inp.focus(); } catch (e) {} } }
      }
      function gespSichern() {
        var inp = root.querySelector(".ufb-gesp-name");
        var l = gespLesen();
        var name = String(inp && inp.value || "").trim() || (tr("Filters") + " " + (l.length + 1));
        l = l.filter(function (x) { return x.name !== name; });
        l.push({ name: name, werte: aktuelleWerte() });
        if (l.length > GESP_MAX) l = l.slice(l.length - GESP_MAX);
        gespSchreiben(l);
        gespFeld(false);
        gespZeichnen();
      }
      function gespZeichnen() {
        var box = root.querySelector(".ufb-gesp");
        if (!box) return;
        var l = gespLesen(), an = aktiv().length > 0;
        var el = box.querySelector(".ufb-gesp-liste");
        el.innerHTML = l.map(function (x, i) {
          var akt = gespGleich(x.werte);
          return '<div class="ufb-gesp-zeile' + (akt ? " is-aktiv" : "") + '">' +
            '<button class="up-optrow ufb-gesp-laden" type="button" data-gesp-laden="' + i + '">' +
              '<span class="ufb-gesp-ic">' + (akt ? UC.icon("check", 2.4) : "") + '</span>' +
              '<span class="ufb-gesp-nm">' + esc(x.name) + '</span></button>' +
            '<button class="ufb-chip-x ufb-gesp-weg" type="button" data-gesp-weg="' + i + '" aria-label="' +
              esc(tr("Delete {name}").split("{name}").join(x.name)) + '">' + UC.icon("x", 2.6) + '</button>' +
          '</div>';
        }).join("");
        /* Speichern nur, wenn etwas gesetzt ist; der ganze Abschnitt nur, wenn es etwas zu zeigen gibt. */
        var neu = box.querySelector(".ufb-gesp-neu"), feld = box.querySelector(".ufb-gesp-feld");
        if (neu && feld && feld.hidden) neu.hidden = !an;
        box.classList.toggle("is-leer", !l.length && !an);
      }

      /* ---------------- render ---------------- */
      function render() {
        var an = aktiv().length > 0 || brandedAn();
        root.classList.toggle("has-filters", an);
        root.classList.toggle("ohne-branded", !brandedHier());
        zeilenStand();
        gespZeichnen();
        brandedSyncen();
        renderChips();
        /* Umbrechen haengt NUR an der Seitenbreite; das Hineingehen auch am Oeffnen vom Chip. Beides
           an einem Wert liess die Leiste beim Klick auf einen Chip umbrechen -- der Chip sprang eine
           Zeile tiefer, und das Panel stand an seiner alten Stelle (gemessen 15.10.). */
        root.classList.toggle("is-wrap", schmal());
        /* is-drill setzt auch UC.makeSubmenu -- hier noch einmal, damit die Klasse auch dann
           stimmt, wenn das Panel noch nie offen war. Derselbe Wert aus derselben Funktion. */
        elMenu.classList.toggle("is-drill", hinein());
        if (sub) sub.sync();
      }
      /* Welcher Chip sein Dropdown offen hat (Schluessel des Filters), sonst null. Der Zustand steht
         am Chip, solange das Panel vom Chip aus offen ist, und wird bei jedem Neuschreiben der
         Chips wieder gesetzt (renderChips). */
      var chipOffen = null;
      /* Welcher Chip zuletzt zuging und wann -- fuer den zweiten Klick (pointerdown unten). */
      var zuVomChip = null, zuZeit = 0;
      function chipZustand() {
        [].forEach.call(elChips.querySelectorAll(".ufb-chip[data-chip]"), function (c) {
          var an = chipOffen !== null && c.getAttribute("data-chip") === chipOffen;
          c.classList.toggle("is-open", an);
          var auf = c.querySelector("[data-chip-open]");
          if (auf) auf.setAttribute("aria-expanded", an ? "true" : "false");
        });
      }

      /* ---------------- Panel ---------------- */
      var pop = UC.makePopover({
        wrap: elMore, menu: elMenu, opener: elBtn, group: "ufb-" + instanceId,
        /* makePopover setzt aria-hidden am Menue, aber nicht aria-expanded am Knopf -- das
           gehoert dem Aufrufer, weil nur er weiss, welches Element der Ausloeser ist. */
        onClose: function () {
          var warChip = chipOffen;
          sub.close(); vomChip = false; elBtn.setAttribute("aria-expanded", "false"); lageSpaeterLoesen();
          chipOffen = null;
          zuVomChip = warChip; zuZeit = performance.now();
          elMore.classList.remove("is-vomchip");
          chipZustand();
          /* Fokus zurueck an den Chip, wenn er im Panel stand oder verloren ist (render() hat den
             angeklickten Chip neu geschrieben, der Fokus fiel dabei auf body) -- sonst bliebe er
             nach Escape in einem unsichtbaren Panel. Ein Klick daneben setzt seinen eigenen Fokus
             danach selbst (mousedown kommt nach pointerdown). */
          var a = document.activeElement;
          if (warChip && (!a || a === document.body || elMenu.contains(a))) {
            var auf = elChips.querySelector('[data-chip-open="' + cssEsc(warChip) + '"]');
            if (auf) { try { auf.focus({ preventScroll: true }); } catch (e) {} }
          }
        }
      });
      elBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        /* Offen vom Chip: der Knopf ist dann nicht der Ausloeser, ein Klick darauf wechselt zur
           Liste aller Filter (statt nur zu schliessen) -- der Zustand wandert mit. */
        if (pop.isOpen() && !vomChip) { pop.close(false); return; }
        /* chipOffen vorher leeren: der Fokus soll beim Knopf bleiben, nicht an den Chip zurueck. */
        if (pop.isOpen()) { chipOffen = null; pop.close(false); }
        elMenu.classList.remove("is-vomchip");
        /* Nach einem Oeffnen vom Chip steht noch is-drill am Panel, bis render() laeuft -- und die
           Messung unten nimmt die Breite des Panels. Nur dann einmal vorher richtigstellen. */
        if (elMenu.classList.contains("is-drill") !== hinein()) elMenu.classList.toggle("is-drill", hinein());
        /* Kippt an der rechten Fensterkante auf rechts ausgerichtet. Einmal beim Oeffnen, nicht
           beim Scrollen: das Panel ist absolut und wandert mit seinem Knopf mit.
           GEMESSEN am 03.09.: diese Entscheidung stand in der DevTools-Aufnahme des Nutzers mit
           718ms unter getBoundingClientRect. Sie lief vorher NACH render() und begann mit
           classList.remove -- also schreiben, dann lesen, und das erzwingt auf einer Seite mit
           23604 Knoten eine komplette Style-Neuberechnung.
           Jetzt zuerst und ohne Schreiben davor: die ungekippte rechte Kante ist die linke Kante
           der Schale (plus deren Rahmen, denn "left: 0" zaehlt ab der Polsterkante) plus die
           Breite des Panels. Die Breite haengt NICHT an is-right -- die Klasse setzt nur left und
           right. Im Harness gegen die alte Messung geprueft: 256 gegen 256, null Abweichung.
           (Am GESCHLOSSENEN Panel weichen die Werte um 2px ab, weil core.css es mit
           transform: scale(0.985) kleiner haelt; offsetWidth ist davon unberuehrt, die Rechnung
           also trotzdem richtig.) */
        var lage = lageMessen();
        einziehen();
        /* Auch die Filter, die schon hier standen: der Moment, in dem ihre Liste sichtbar wird. */
        liste.forEach(nachziehen);
        spiegelnAlle();
        render();
        pop.open();
        lageSetzen(lage);
        elBtn.setAttribute("aria-expanded", "true");
      });

      /* DAS PANEL BLEIBT IM FENSTER (08.10., gemessen auf 375px Breite). Bisher gab es nur zwei
         Lagen: unter dem Knopf nach rechts, oder -- passte das nicht -- nach links gekippt
         (is-right). Auf dem Telefon passt keine von beiden: das Panel ist dort bis 320px breit,
         der Knopf steht neben dem Kalender in der Mitte, und gekippt lag es 49px (Dashboard)
         bzw. 65px (Citations) LINKS ausserhalb des Bildes. Jetzt wird nach dem Kippen noch ins
         Fenster geschoben, mit dem Rand der App: 16 auf dem Telefon, sonst 8 wie die Panels in
         core. Auf breiten Seiten aendert sich nichts -- dort passt eine der zwei Lagen immer.
         Gelesen wird VOR jedem Schreiben (siehe oben, 718ms am 03.09.), geschrieben danach;
         die Lage steht inline (left), damit sie die Regeln der zwei Klassen schlaegt. */
      /* anker (15.10.): ein Chip statt des Knopfs -- das Panel steht dann unter dem Chip, links an
         seiner Kante (oder rechts an seiner, wenn links kein Platz ist), und bei umbrochener Leiste
         unter SEINER Zeile statt unter der des Knopfs. */
      function lageMessen(anker) {
        var vw = window.innerWidth || document.documentElement.clientWidth || 0;
        var r = elMore.getBoundingClientRect();
        if (!vw || !r.width) return null;
        var a = anker ? anker.getBoundingClientRect() : null;
        var breite = elMenu.offsetWidth, rand = vw < 500 ? 16 : 8;
        /* Nicht das Fenster, sondern die Flaeche rechts der Seitenleiste und innerhalb von #main
           (16.10.) -- dieselbe Grenze, an der UC.makeSubmenu das Untermenue misst. Am Fenster
           gerechnet, konnte das Panel bei knapper Breite unter die feste Seitenleiste geschoben
           werden. Unter 500px ist die Leiste 0 breit, dort bleibt alles wie zuvor. */
        var f = UC.inhaltsFlaeche ? UC.inhaltsFlaeche(elMenu) : { links: 0, rechts: vw };
        /* "left: 0" zaehlt ab der Polsterkante der Schale, also plus ihr Rahmen. */
        var start = r.left + elMore.clientLeft, links = a ? a.left : start;
        if (links + breite > f.rechts - rand) links = (a ? a.right : r.right - elMore.clientLeft) - breite;
        links = Math.max(f.links + rand, Math.min(links, f.rechts - rand - breite));
        /* Senkrecht nur fuer den Chip: steht er tiefer als der Knopf (umbrochene Leiste), rueckt
           das Panel um genau diesen Abstand nach unten. top der CSS bleibt sonst unberuehrt. */
        var tiefer = a ? Math.round(a.bottom - r.bottom) : 0;
        return { versatz: Math.round(links - start), kippen: !a && links < start, tiefer: tiefer > 0 ? tiefer : 0 };
      }
      var lageUhr = null;
      function lageSetzen(l) {
        clearTimeout(lageUhr); lageUhr = null;
        if (!l) return;
        elMenu.style.left = l.versatz + "px";
        elMenu.style.right = "auto";
        elMenu.style.marginTop = l.tiefer ? l.tiefer + "px" : "";
        elMenu.classList.toggle("is-right", l.kippen);
      }
      /* EINEN Filter direkt oeffnen: das Panel auf, dessen Untermenue festgestellt. Vom Chip aus
         (anker) im Hineingehen und unter dem Chip, sonst wie der Klick auf "Filters". */
      function oeffnen(key, anker) {
        var f = byKey(key);
        if (!f) return;
        if (pop.isOpen()) pop.close(false);
        clearTimeout(lageUhr); lageUhr = null;
        vomChip = !!anker;
        /* ERST MESSEN, DANN SCHREIBEN -- wie beim Knopf "Filters" (16.10., gemeldet: "vor dem
           Aufgehen ist ein kleiner Delay, bei jedem Klick auf einen Chip"). Hier stand die Messung
           NACH render(): render() schreibt die Chips neu und stellt Klassen an der Wurzel, und das
           Lesen danach erzwang ein ganzes Layout der Seite, bevor das Panel aufging (gemessen auf
           24671 Knoten: 13.9 von 30.6ms des Klicks; beim Knopf 0). Vorher gelesen liegt alles,
           was die Messung braucht, schon fest:
             - die Breite des Panels haengt nur an is-drill. Die Klasse wird hier vorab gestellt,
               aus derselben Funktion wie in render() -- dasselbe Vorgehen wie im Klick auf
               "Filters" oben;
             - der angeklickte Chip haengt noch im Dokument und steht dort, wo ihn render() gleich
               wieder hinschreibt (gleiche Filter, gleicher Text). Danach misst er 0. */
        if (elMenu.classList.contains("is-drill") !== hinein()) elMenu.classList.toggle("is-drill", hinein());
        var lage = lageMessen(anker);
        /* Der Chip zeigt sein offenes Dropdown, nicht der Knopf "Filters" (16.10. gemeldet).
           renderChips() setzt den Zustand beim Neuschreiben gleich mit. */
        chipOffen = anker ? key : null;
        elMore.classList.toggle("is-vomchip", vomChip);
        einziehen();
        liste.forEach(nachziehen);
        spiegelnAlle();
        render();
        /* Vom Chip: KEIN "Back" oben (15.10. abgelehnt -- der Chip ist der Weg hinein, das Menue zeigt
           nur diesen einen Filter). Die Klasse nimmt onClose wieder weg. */
        elMenu.classList.toggle("is-vomchip", vomChip);
        /* Die Lage VOR dem Oeffnen: makePopover hebt das Panel beim Oeffnen in die oberste Ebene
           (position: fixed) und rechnet seine Stelle EINMAL aus der Ruhelage. Danach gesetzt,
           landete das Panel am linken Fensterrand statt unter dem Chip (gemessen: left 8). */
        lageSetzen(lage);
        pop.open();
        /* Vom Chip ist der CHIP der Ausloeser (aria-expanded traegt renderChips), der Knopf bleibt zu. */
        elBtn.setAttribute("aria-expanded", anker ? "false" : "true");
        sub.open(key, true);
      }
      /* Nach dem Schliessen gilt die gemessene Lage nicht mehr: rueckt der Knopf spaeter (ein
         laengerer Kalendertext, eine andere Breite), stand das unsichtbare Panel mit der alten
         Lage ueber dem Rand -- gemessen 523px seitlicher Ueberlauf. Also weg damit, sobald die
         Ausblendung vorbei ist (vorher waere ein Sprung waehrend des Ausblendens zu sehen); dann
         gilt die Regel fuer das geschlossene Panel in der CSS. */
      function lageSpaeterLoesen() {
        clearTimeout(lageUhr);
        lageUhr = setTimeout(function () {
          lageUhr = null;
          if (pop.isOpen()) return;
          elMenu.style.left = ""; elMenu.style.right = ""; elMenu.style.marginTop = "";
          elMenu.classList.remove("is-right");
          /* Erst nach dem Ausblenden: sonst stuende "Back" waehrend des Zugehens kurz da. */
          elMenu.classList.remove("is-vomchip");
        }, 300);
      }

      /* ---------------- Untermenue ----------------
         Verweildauer, Feststellen per Klick, Umklappen und das Hineingehen auf schmalen Seiten
         kommen komplett aus UC.makeSubmenu. */
      var sub = UC.makeSubmenu({
        panel: elMenu, rowSel: ".up-subwrap", keyAttr: "data-sub", drill: hinein,
        /* EINE SEKUNDE NACHLAUF STATT DER 260ms DES KITS (24.09. angefordert: "wenn man ueber Topics hovert,
           das Dropdown daneben aufgeht und man dann rueberhovert, soll es offen bleiben, auch
           wenn der Nutzer mal ein paar hundert Millisekunden nicht darauf hovert").
           Die Vorgabe des Kits deckt die Luecke zwischen Zeile und Kasten -- gemeint ist hier
           mehr: eine Liste, in der jemand mit dem Zeiger sucht, darf nicht zugehen, weil er
           kurz daneben liegt. Gilt fuer alle drei Zeilen, weil es am Kit haengt und nicht an
           einer davon. */
        /* 1000 -> 500 (25.09.), nachdem der eigentliche Fehler behoben war: eine verwaiste Uhr
           im Kit schloss das Menue auch dann, wenn der Zeiger darauf stand -- die lange
           Nachlaufzeit hatte das nur verdeckt. */
        closeDelay: 500,
        /* EIN Kasten fuer alle Zeilen -- siehe die Schale im Markup oben. */
        shell: elSub, hostAttr: "data-sub-host",
        onOpen: function (key) {
          var f = byKey(key);
          if (f) spiegeln(f);
        },
        onClose: function (key) {
          /* Die Suche des Filters beim Verlassen leeren -- ueber SEINEN eigenen Clear-Knopf, nicht
             ueber seinen Zustand. Ein Suchtext, der beim naechsten Oeffnen noch drinsteht, sieht
             aus wie eine Liste, in der Eintraege fehlen. */
          var f = byKey(key);
          var w = f && eingezogen[f.key];
          if (!w) return;
          var x = w.querySelector(SUCHE_X);
          var feld = w.querySelector(SUCHE_IN);
          if (x && feld && String(feld.value || "")) { try { x.click(); } catch (e) {} }
        }
      });
      function byKey(k) { for (var i = 0; i < liste.length; i++) if (liste[i].key === k) return liste[i]; return null; }

      /* KEIN eigener Escape-Zuhoerer. core hat einen seitenweiten: die Popover-Registry schliesst
         bei Escape ALLES (core.js, closeAll im keydown der Registry). Ich hatte hier erst zwei
         Stufen gebaut -- erst das Untermenue, dann das Panel -- und gemessen, dass das nicht
         geht: core ist zuerst angemeldet, laeuft also zuerst, und ein stopPropagation aus der
         Blasenphase erreicht ihn nicht mehr. Es waere auch die falsche Sache: Escape bedeutet in
         dieser App "das Dropdown zu", und diese Leiste waere der einzige Ort mit einer eigenen
         Bedeutung. Das Untermenue geht beim Schliessen des Panels ohnehin mit (onClose oben). */

      /* ---------------- Reset ---------------- */
      /* EINEN Filter leeren -- das X am Chip. Derselbe stille Weg wie bei Clear All, und dasselbe
         Ereignis: der Workflow dahinter laedt neu, und ihn nach action zu verzweigen ist die
         Entscheidung der Bubble-Seite. Der Name des Filters steht mit drin, damit sie es kann. */
      /* Erreicht dieser Name auf DIESER Seite einen Workflow? Dieselbe Aufloesung wie in
         UC.makeFire, nur ohne zu senden.
         Hier standen erreichbar() und resetName(): sie haben geprueft, ob ein Workflow namens
         ufbReset auf der Seite liegt. Das Ereignis ist raus, damit haben beide keinen Abnehmer
         mehr -- und Funktionen ohne Abnehmer sind Ballast, den der Naechste zu verstehen versucht.
         Die Diagnose unten prueft die Kanaele der FILTER, und die gibt es weiter. */

      /* EINEN Filter ueber SEINEN eigenen Weg leeren: das X am Chip klickt das X am Trigger des
         Filters an -- dasselbe Bedienelement, das der Nutzer sonst selbst trifft. Der Filter
         raeumt seine Auswahl auf und feuert danach SEIN Ereignis, also laedt die Seite genau so
         neu wie bei jedem anderen Abwaehlen. Damit braucht das X am Chip KEINEN eigenen
         Workflow -- gefragt wurde genau das ("kann das nicht out of the box laufen").
         Dass der Trigger hier display: none ist (meine Zeile IST der Trigger), stoert nicht: ein
         Klick per JS haengt nicht an der Sichtbarkeit. Und es ist derselbe Griff, mit dem diese
         Komponente schon das Suchfeld des Filters leert.
         has-sel wird mitgeprueft, weil der Filter selbst darauf prueft -- ohne die Klasse waere
         der Klick ein Klick auf den Trigger und wuerde sein Panel umschalten. */
      function einenLeeren(key) {
        if (key === "branded") { if (UC.intentFilterSet) UC.intentFilterSet({ branded: "non_branded" }); render(); return; }
        var f = byKey(key);
        if (!f) return;
        var w = eingezogen[f.key];
        var x = w && f.clearSel && w.querySelector(f.clearSel);
        if (x && w.classList.contains("has-sel")) {
          try { x.click(); } catch (e) {}
          spiegeln(f);
          render();
          return;
        }
        /* Kein X erreichbar (der Filter steckt gar nicht in dieser Leiste): dann der stille Weg
           ueber seinen Controller. KEIN eigenes Ereignis mehr -- siehe alleLeeren() darunter. */
        var c = w && w[f.ctrl];
        if (c && typeof c.setSelected === "function") { try { c.setSelected(""); } catch (e) {} }
        spiegeln(f);
        render();
      }
      /* Clear All geht ausschliesslich ueber die EIGENEN Wege der Filter -- jeder raeumt seine
         Auswahl auf und feuert sein eigenes Ereignis, genau wie beim Abwaehlen von Hand.

         Hier stand davor ein zweiter Weg ueber ein Ereignis "ufbReset": es sollte aus drei
         Filter-Ereignissen eines machen, damit die Seite einmal statt dreimal neu laedt. Das ist
         RAUS, auf Ansage: es lief auf keiner Seite ein Workflow darauf, und der Rueckfall hat
         ohnehin alles richtig gemacht. Uebrig blieben nur Meldungen in der Konsole -- eine von
         hier und je eine von makeFire, das ueber jeden Namen klagt, den es nicht auflosen kann.
         Eine Warnung fuer eine Sache, die niemand bestellt hat, ist Laerm. */
      function alleLeeren() {
        liste.forEach(function (f) { einenLeeren(f.key); });
        if (brandedAn()) einenLeeren("branded");
        spiegelnAlle();
        render();
      }
      root.addEventListener("click", function (e) {
        if (!e.target.closest) return;
        if (e.target.closest("[data-ufb-reset]")) { e.stopPropagation(); alleLeeren(); pop.close(true); return; }
        if (e.target.closest("[data-ufb-clear]")) { alleLeeren(); return; }
        if (e.target.closest("[data-ufb-branded]")) {
          e.stopPropagation();
          if (UC.intentFilterSet) UC.intentFilterSet({ branded: brandedAn() ? "non_branded" : "all" });
          render();
          return;
        }
        var cx = e.target.closest("[data-chip-clear]");
        if (cx) { einenLeeren(cx.getAttribute("data-chip-clear")); return; }
        if (e.target.closest("[data-gesp-neu]")) { e.stopPropagation(); gespFeld(true); return; }
        if (e.target.closest("[data-gesp-sichern]")) { e.stopPropagation(); gespSichern(); return; }
        var gw = e.target.closest("[data-gesp-weg]");
        if (gw) { e.stopPropagation(); gespWeg(+gw.getAttribute("data-gesp-weg")); return; }
        var gl = e.target.closest("[data-gesp-laden]");
        if (gl) { e.stopPropagation(); gespLaden(+gl.getAttribute("data-gesp-laden")); pop.close(true); return; }
        var co = e.target.closest("[data-chip-open]");
        if (co) {
          var k = co.getAttribute("data-chip-open");
          /* Zweiter Klick auf denselben Chip schliesst nur -- das Panel ist zu diesem Zeitpunkt
             schon zu (die Popover-Registry schliesst bei pointerdown ausserhalb), darum gemerkt. */
          if (chipZu === k) { chipZu = null; return; }
          oeffnen(k, co.closest(".ufb-chip") || co);
        }
      });
      var chipZu = null;
      root.addEventListener("pointerdown", function (e) {
        var co = e.target.closest && e.target.closest("[data-chip-open]");
        var k = co ? co.getAttribute("data-chip-open") : null;
        /* Meist ist das Panel HIER schon zu: core schliesst jedes Dropdown in der Capture-Phase
           (Draussen-Zuhoerer an document), also vor diesem Zuhoerer. Dann zaehlt, ob DIESER Druck
           es eben geschlossen hat -- onClose merkt sich Chip und Zeit (16.10.: der zweite Klick
           oeffnete sonst sofort wieder). */
        var ebenZu = zuVomChip !== null && zuVomChip === k && zuZeit >= e.timeStamp;
        chipZu = k && ((pop.isOpen() && vomChip && sub.current() === k) || ebenZu) ? k : null;
      });

      /* ---------------- auf Aenderungen der Filter hoeren ----------------
         Ihre eigenen aufsteigenden Ereignisse. Am DOKUMENT und nicht an der Wurzel: die Wurzel
         wandert beim Einziehen, und ein Zuhoerer daran ginge beim naechsten Bubble-Rerender
         verloren. */
      FILTERS.forEach(function (f) {
        document.addEventListener(f.evt, function () { spiegeln(f); render(); }, false);
      });
      /* Branded aendert sich auch von einer ANDEREN Leiste aus (gemeinsamer Stand in core). */
      window.addEventListener("up-intentfilter", function () { if (document.contains(root)) render(); });
      root.addEventListener("keydown", function (e) {
        if (e.key === "Enter" && e.target && e.target.classList && e.target.classList.contains("ufb-gesp-name")) {
          e.preventDefault(); gespSichern(); return;
        }
        if (e.key !== "Enter" && e.key !== " ") return;
        var z = e.target.closest && e.target.closest("[data-ufb-branded]");
        if (!z) return;
        e.preventDefault(); z.click();
      });

      /* ---------------- Ausblenden zur Laufzeit ----------------
         Die Gruppierung im Prompts-Table wird UMGESCHALTET, waehrend die Leiste steht. Also wird
         data-<filter>-visible nicht nur beim Start gelesen.

         Zwei Wege, und der zweite ist der wichtige:
           - ein Beobachter mit attributeFilter auf GENAU diesen Attributen. Eng gefasst mit
             Absicht: mit attributes:true ohne Filter wuerde jede Klassenaenderung aus render()
             ihn wecken und render() wieder ausloesen. subtree bleibt aus, damit das Verschieben
             der Filterknoten in einziehen() ihn nicht weckt -- an genau dieser Stelle hat ein
             Beobachter in dieser Datei schon einmal die Seite zum Stehen gebracht.
           - die Uhr unten (700ms). Sie faengt den Fall, den der Beobachter nicht sehen kann:
             Bubble rendert das HTML-Element bei einer Aenderung oft komplett neu, dann ist es
             eine NEUE Wurzel mit einem neuen Attribut und keine Aenderung an der alten.

         Beim Ausblenden wird die Auswahl des Filters GELEERT, ueber sein eigenes X -- also mit
         seinem Ereignis, wie beim Klick auf das X am Chip. Ein Filter, der nicht mehr angeboten
         wird, darf nicht weiterfiltern: sonst zeigt die Tabelle eine Teilmenge, und in der Leiste
         steht nichts mehr, was das erklaert. Das ist der Grund, warum es hier nicht reicht, nur
         die Zeile zu verstecken. */
      function verstecktGeleert() {
        FILTERS.forEach(function (f) {
          if (!nurAusgeblendet(f) || f.behalten) return;
          /* Streng suchen: lieber nichts leeren als das Falsche. */
          var w = eingezogen[f.key] || findeWurzel(f, true);
          if (!w || !w.classList.contains("has-sel")) return;
          /* Ein Filter, der in einer ANDEREN Leiste haengt, gehoert nicht hierher. */
          if (w.__ufbHost && w.__ufbHost !== root && document.contains(w.__ufbHost)) return;
          var x = f.clearSel && w.querySelector(f.clearSel);
          if (x) { try { x.click(); } catch (e) {} return; }
          var c = w[f.ctrl];
          /* Nur setSelected. Der Filter feuert danach SEIN eigenes Ereignis, und das genuegt --
             das frueher hier zusaetzlich gesendete ufbReset ist raus (siehe alleLeeren). */
          if (c && typeof c.setSelected === "function"){ try { c.setSelected(""); } catch (e) {} }
        });
      }
      function sichtStellen() {
        var neu = gewuenscht().filter(sichtbarLaut);
        var gleich = neu.length === liste.length && neu.every(function (f, i) { return f === liste[i]; });
        /* Auch wenn sich nichts geaendert hat: eine Auswahl kann ERST DANACH entstanden sein
           (Bubble stellt einen gespeicherten Filter wieder her). Darum immer pruefen -- die
           Funktion tut nichts, wenn nichts gewaehlt ist. */
        verstecktGeleert();
        if (gleich) return;
        liste = neu;
        /* Ein Untermenue, dessen Zeile es gleich nicht mehr gibt, muss zu sein, bevor die Zeilen
           neu gebaut werden -- sonst bleibt eine offene Huelle ueber einer Zeile stehen, die
           verschwunden ist. */
        if (sub) sub.close();
        if (elSub) {
          Array.prototype.forEach.call(elSub.querySelectorAll("[data-sub-host]"), function (h) {
            var drin = neu.some(function (f) { return f.key === h.getAttribute("data-sub-host"); });
            if (!drin) h.classList.remove("is-on");
          });
        }
        zeilenBauen();
        einziehen();
        spiegelnAlle();
        render();
      }
      if (window.MutationObserver) {
        /* data-form und data-branded-visible (15.10.) schaltet die Seite Prompt Insights je Reiter
           um -- danach Zeilen und Chips in der passenden Form. */
        var sichtBeob = new MutationObserver(function () { sichtStellen(); spiegelnAlle(); render(); });
        try {
          sichtBeob.observe(root, { attributes: true, subtree: false,
            attributeFilter: FILTERS.map(function (f) { return f.visAttr; }).concat(["data-form", "data-branded-visible"]) });
        } catch (e) {}
      }

      /* Die Filterelemente koennen SPAETER erscheinen -- Bubble baut sie unabhaengig von diesem
         Element. Ein kurzer Anlauf plus der Beobachter aus core holt sie nach. */
      [0, 150, 500, 1200, 2500].forEach(function (ms) { setTimeout(einziehen, ms); });
      /* Hier stand ein MutationObserver auf document.body, der einziehen() rief, sobald ein
         eingezogener Filter aus dem Dokument verschwand. Er ist raus, und das ist der Kern der
         Lehre aus dieser Runde: einziehen() BEWEGT Knoten, und der Beobachter hoerte auf genau
         das. Mit zwei Leisten (oder einer ersetzten Wurzel und ihrem noch lebenden Abschluss)
         zogen zwei solche Beobachter dasselbe Element abwechselnd zu sich -- die Seite stand, und
         zwar so gruendlich, dass selbst die Vorschau nicht mehr antwortete.
         Dieselbe Arbeit macht jetzt die Uhr unten (WAECHTER_MS, alle 700ms): sie kann sich nicht
         selbst wecken. Ein Filter, den Bubble spaeter nachliefert, kommt also bis zu 700ms
         spaeter in die Leiste -- das ist der Preis, und er ist unsichtbar. */
      if (UC.aufResize) UC.aufResize(function () { einziehen(); });
      if (UC.aufResize) UC.aufResize(render);
      /* Nach render(): das setzt is-drill, und daran haengt die Breite des Panels. Nur das
         OFFENE Panel -- das geschlossene steht ohne gemessene Lage rechts am Knopf (CSS) und
         ragt damit nicht ueber den rechten Rand (gemessen vorher 105px seitlicher Ueberlauf). */
      if (UC.aufResize) UC.aufResize(function () { if (pop.isOpen()) lageSetzen(lageMessen()); });

      var ctrl = {
        reset: function () { alleLeeren(); },
        /* Fuer den Ruf einer frischen Filterwurzel (window.__ufbWurzelNeu, siehe unten). */
        einziehen: function () { try { einziehen(); } catch (e) {} },
        /* Die Uhr unten ruft das je Leiste -- der Rueckhalt fuer den Fall, dass Bubble das
           Element neu rendert statt nur das Attribut zu setzen. */
        pruefeSicht: function () { try { sichtStellen(); } catch (e) {} },
        setTheme: function (t) { if (UC.setUpstreemTheme) UC.setUpstreemTheme(t); },
        render: render,
        /* Einen Filter von aussen oeffnen (Panel auf, sein Untermenue festgestellt). */
        oeffnen: function (key) { try { oeffnen(key, null); } catch (e) {} }
      };
      root.__ufbCtrl = ctrl;
      if (WURZELN.indexOf(root) < 0) WURZELN.push(root);
      /* Ein ATTRIBUT und nicht nur die Eigenschaft: der Beobachter oben prueft mit einem
         Selektor, und das ist eine Abfrage statt einer Schleife ueber alle Wurzeln. */
      root.setAttribute("data-ufb-init", "1");
      CTRLS.push(ctrl);
      render();
      if (spaet) spaet.drain(instanceId, ctrl);
      return ctrl;
    }

    function initAll() {
      Array.prototype.forEach.call(document.querySelectorAll(".ufb-root, [data-ufb-root]"), initRoot);
    }
    function forEachInstance(id, fn) {
      initAll();
      var roots = Array.prototype.slice.call(document.querySelectorAll(".ufb-root"));
      /* Genauer Name schlaegt Praefix. Auf der echten Seite heisst ein Filter "..._prompts" und
         ein zweiter "..._promptspotlight" -- der erste Name ist ein Praefix des zweiten, und der
         Aufruf fuer die Prompts-Seite bediente damit STILL auch das Prompt-Spotlight (gemessen
         02.09. auf der laufenden App). Die dokumentierte Praefix-Form (etwa "dates_v2_") bleibt
         erhalten: sie greift weiter, sobald es keinen genauen Treffer gibt. */
      var genau = id ? roots.some(function (r) {
        return String(r.getAttribute("data-instance") || "default") === String(id); }) : false;
      var ziel = roots.filter(function (r) {
        var rid = String(r.getAttribute("data-instance") || "default");
        return !id || (genau ? rid === String(id) : rid.indexOf(String(id)) === 0);
      });
      if (!ziel.length) {
        if (spaet) spaet.park(id || "default", fn);
        return false;
      }
      ziel.forEach(function (r) { if (r.__ufbCtrl) fn(r.__ufbCtrl); });
      return true;
    }

    window.resetFilterBar = function (id) { return forEachInstance(id, function (c) { c.reset(); }); };
    window.setFilterBarTheme = function (id, t) { return forEachInstance(id, function (c) { c.setTheme(t); }); };

    /* ---- Diagnose auf Zuruf ---------------------------------------------------------------
       window.upstreemFilterBarDiag() in der Konsole. Sie beantwortet die EINE Frage, die bei
       "das Dropdown ist leer" gestellt wird: was hat die Leiste gesucht, und was liegt wirklich
       auf der Seite. Beides nebeneinander, dann sieht man den Unterschied in einer Zeile.
       Zwei Gruende, und die Ausgabe unterscheidet sie:
         "im Dokument: 0"    -> das Filterelement ist in Bubble AUSGEBLENDET. Ein ausgeblendetes
                                Element rendert Bubble gar nicht ins Dokument, dann gibt es nichts
                                einzuziehen. Die Filter muessen sichtbar bleiben -- unsichtbar
                                macht sie die Leiste selbst, indem sie sie zu sich holt.
         "-> NICHT gefunden" -> die Id passt nicht (oder in data-instance steckt noch ein
                                unaufgeloester Bubble-Ausdruck).
       Dieselbe Bauart wie upstreemScrollDiag und upstreemFarbDiag in core. */
    window.upstreemFilterBarDiag = function () {
      var out = [];
      var leisten = Array.prototype.slice.call(document.querySelectorAll(".ufb-root"));
      out.push("Filterleisten auf der Seite: " + leisten.length);
      FILTERS.forEach(function (f) {
        var alle = Array.prototype.slice.call(document.querySelectorAll(f.rootSel));
        out.push("");
        out.push(f.label + "  (" + f.rootSel + ")");
        out.push("  im Dokument: " + alle.length +
          (alle.length ? "  ids: " + alle.map(function (w) {
            return '"' + (w.getAttribute("data-instance") || "") + '"' +
                   (w.__ufbHost ? " [belegt]" : ""); }).join(", ")
                       : "  -> KEINE. Das Element ist in Bubble ausgeblendet oder nicht auf dieser Seite."));
        leisten.forEach(function (r) {
          var id = String(r.getAttribute(f.attr) || "").trim();
          var host = r.querySelector('[data-sub-host="' + f.key + '"]');
          var drin = host && host.querySelector(f.rootSel);
          /* Die dritte Antwort auf "warum sehe ich den Filter nicht": nicht die Id und nicht das
             fehlende Element, sondern die Seite hat ihn ausdruecklich ausgeblendet. Ohne diese
             Zeile sucht man an den ersten beiden. */
          var vis = String(r.getAttribute(f.visAttr) || "").trim();
          var aus = /^(no|false|0|off|hidden)$/i.test(vis);
          out.push('  Leiste "' + (r.getAttribute("data-instance") || "default") + '": ' +
            f.attr + '="' + id + '"' +
            (vis ? "  " + f.visAttr + '="' + vis + '"' : "") +
            (!id || /^[A-Z_]{3,}$/.test(id) ? "  -> leer/Platzhalter, also keine Zeile" :
             aus ? "  -> von der Seite AUSGEBLENDET (" + f.visAttr + "), Auswahl wird geleert" :
             drin ? "  -> eingezogen" : "  -> NICHT gefunden"));
        });
      });

      /* ---- Verdrahtung ---------------------------------------------------------------------
         Die zweite Frage, die diese Leiste bekommt: "muss ich jetzt alles neu verdrahten?"
         Nein -- und diese Liste beweist es in beide Richtungen. Sie sagt fuer JEDEN Filter auf
         der Seite, welchen bubble_fn_* er beim Aendern ruft und ob es den gibt. Die Leiste ruft
         davon nichts und aendert davon nichts: die Filter feuern selbst, wie vorher.
         Fehlt einer, steht daneben, welche bubble_fn_* mit demselben Namensteil es auf der Seite
         WIRKLICH gibt -- daran sieht man einen Tippfehler oder einen falschen Namenszusatz sofort,
         ohne die Bubble-Seite zu durchsuchen. */
      out.push("");
      out.push("Verdrahtung der Filter (gehoert IHNEN, nicht der Leiste)");
      var vorhanden = [];
      try {
        for (var k in window) {
          if (k.indexOf("bubble_fn_") === 0 && typeof window[k] === "function") vorhanden.push(k);
        }
      } catch (e) {}
      FILTERS.forEach(function (f) {
        Array.prototype.forEach.call(document.querySelectorAll(f.rootSel), function (w) {
          out.push("  " + f.label + ' "' + (w.getAttribute("data-instance") || "") + '"');
          f.fnAttrs.forEach(function (paar) {
            var attr = paar[0], rueck = paar[1];
            var gesetzt = String(w.getAttribute(attr) || "").trim();
            var name = gesetzt || rueck;
            if (!name) { out.push("    " + attr + ': leer -> kein Aufruf (in Ordnung)'); return; }
            var da = false;
            try { da = typeof UC.resolveBubbleFn(name) === "function"; } catch (e) {}
            out.push("    " + attr + ': "' + name + '"' + (gesetzt ? "" : " (Rueckfall)") +
              (da ? "  -> DA" : "  -> FEHLT auf dieser Seite"));
          });
          var aehnlich = vorhanden.filter(function (n) { return n.toLowerCase().indexOf(f.fnMarke) >= 0; });
          out.push("    auf der Seite vorhanden: " + (aehnlich.length ? aehnlich.join(", ") : "keine mit \"" + f.fnMarke + "\""));
        });
      });

      var txt = out.join("\n");
      if (window.console) console.log(txt);
      return txt;
    };

    initAll();
    if (UC.watchRoots) UC.watchRoots("ufb-root", initAll);
    [100, 300, 800, 1800].forEach(function (ms) { setTimeout(initAll, ms); });
    /* Eine Uhr fuer beides: weggeworfene Leisten aufraeumen und eine neue einrichten, die spaeter
       dazukommt (UC.watchRoots hat im Gegentest nicht angeschlagen, siehe die Runde davor).
       initAll richtet nur ein, was noch keinen Controller hat -- der Lauf kostet ein
       querySelectorAll. */
    setInterval(function () {
      waechter(); initAll();
      /* Und einmal je Leiste die Sichtbarkeitsfrage: kostet drei getAttribute und faengt den Fall,
         den kein Beobachter sehen kann -- eine von Bubble neu gerenderte Wurzel. */
      for (var i = 0; i < WURZELN.length; i++) {
        var c = WURZELN[i].__ufbCtrl;
        if (c && c.pruefeSicht) c.pruefeSicht();
      }
    }, WAECHTER_MS);
    /* Eigenes Netz fuer eine Leiste, die SPAETER erscheint. UC.watchRoots ist dafuer gedacht, hat
       im Gegentest aber nicht angeschlagen (eine frisch eingehaengte Wurzel blieb 2,2s
       uneingerichtet, Zaehler 0). Die Zeitstaffel oben faengt den Normalfall -- Bubble baut das
       Element innerhalb der ersten zwei Sekunden --, dieser Beobachter den Rest: einen Rerender
       nach einem Ansichtswechsel, ein Drawer, der erst spaeter aufgeht.
       Gebuendelt auf einen Lauf je 200ms, und nur wenn wirklich eine Wurzel ohne Controller
       dasteht: sonst laeuft er bei jeder Mutation der Seite durch ein querySelectorAll. */
    /* Hier stand ein zweiter Modul-Beobachter, der auf neue Leisten wartete. Die Uhr oben tut
       dasselbe und kann sich nicht selbst wecken -- ein Beobachter weniger auf document.body. */

    /* Die Warteschlange abarbeiten, in der Reihenfolge, in der Bubble gerufen hat. */
    var q = window.__ufbBootQueue;
    if (q && q.length) {
      q.splice(0, q.length).forEach(function (e) {
        try { window[e[0]].apply(null, e[1]); }
        catch (err) { if (window.console) console.error("[filter-bar] queued " + e[0] + " failed:", err); }
      });
    }
  }

  ufbBoot(50);
})();
