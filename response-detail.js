/* upstreem response-detail.js — die Detailseite einer einzelnen Modellantwort.
   Braucht core.js (window.UpstreemCore).

   Vier Abschnitte in einer Wurzel, von oben (v2, 05.10., Design-Uebergabe "Response Detail v2 +
   Products"):
     1. Kopf: der Prompt-Text als Titel, vollstaendig. Darunter Modell und Laufzeit links, Market
        und Themen rechts, und die Zeile "Mentioned" mit den Marken dieser Antwort.
     2. "Products": die Shopping-Produkte der Antwort als Karten in ihrer Reihenfolge -- NUR wenn
        die Antwort welche hat (get_mention_detail_v8: shopping_products).
     3. "Full Response": der Antworttext, die Produkte darin ausgezeichnet und mit ihrer Karte
        verbunden.
     4. "Citations": die Quellen, nummeriert, als Kacheln oder als Liste.

   Was aus core kommt und hier NICHT noch einmal entsteht:
     UC.respBody          der Antworttext samt Tabellen, Zitat-Chips und Markenauszeichnung
     UC.modelChip         Logo plus Anzeigename des Modells
     UC.marketChip        Flagge plus Laendercode
     UC.relativeTime      "2 minutes ago" / Datum
     UC.brandStack        die Marken-Chips einer URL, wie in jeder Tabelle
     UC.icon              jedes Icon
     UC.makeMount / makeFire / makeLate / parseLoose / widthTiers / onTheme / themeParam
     UC.makeTooltips      die Tooltips an allem, was data-tip traegt
     UC.bubbleObjekt      die Nutzlast lesen (Umschlag {"json"}, grosse Produkt-Ids als Text)
     UC.bubbleFehler      Bubbles "error body" als dritter Wert des Setters
     UC.markenChip        Logo und Name der Marke an der Produktkarte
     UC.fmtGeld           der Preis

   Neu ist hier nur, was es genau einmal gibt: der Aufbau der Seite, die zwei Ansichten der
   Quellen und das Menue, das ein Zitat-Chip oeffnet.

   Zu den drei Modellen: chatgpt, google-aio und perplexity schreiben ihre Zitate unterschiedlich
   ([Label](url), [0](url) mit Fussnotenliste, [(url)]). Diese Komponente kennt den Unterschied
   NICHT -- UC.respBody erkennt alle drei Formen am Text. Das Feld `model` fliesst nur in den
   Modell-Chip. Damit gibt es eine Fassung statt drei, und ein viertes Modell braucht keine neue. */
(function () {
  "use strict";

  /* ---- Boot-Stubs (STYLEGUIDE §25), VOR der core-Pruefung -----------------------------------
     Bubble ruft die Setter aus einem Workflow, der neben dem Laden dieser Datei laeuft. Ohne
     Stubs wirft der erste Aufruf und reisst den ganzen Run-JS-Step mit. */
  var API_NAMES = ["setResponseDetail", "setResponseDetailFrom", "setResponseDetailLoading",
                   "resetResponseDetail"];
  var Q = (window.__urdBootQueue = window.__urdBootQueue || []);
  API_NAMES.forEach(function (n) {
    if (!window[n]) window[n] = function () { Q.push([n, [].slice.call(arguments)]); };
  });

  function urdBoot(triesLeft) {
    if (!window.UpstreemCore) {
      if (triesLeft > 0) { setTimeout(function () { urdBoot(triesLeft - 1); }, 100); return; }
      if (window.console) console.error("UpstreemCore (core.js) not loaded");
      return;
    }
    urdStart();
  }

  function urdStart() {
  var UC = window.UpstreemCore;
  var esc = UC.esc, isYes = UC.isYes;

  var VIEWS = [
    /* card und listIcon -- dieselben zwei Zeichen wie der Umschalter der Responses Table und
       der der Opportunities (22.09. so angesagt). Vorher layoutGrid, das ist das Raster aus
       vier Kacheln und sagt "Galerie", nicht "Karten". */
    { key: "grid", label: "Grid", icon: "card" },
    { key: "list", label: "List", icon: "listIcon" }
  ];
  /* Die Ansicht ueberlebt das Neueinspritzen des Markups durch Bubble -- sonst springt sie beim
     ersten Datenwechsel zurueck auf Grid. Der Speicher im Fenster ist nur der schnelle Weg;
     darunter liegt localStorage, damit die Wahl auch das Neuladen der Seite ueberlebt. Ohne den
     stand nach jedem Reload wieder Grid da, egal was der Nutzer eingestellt hatte. */
  var VIEW_STORE = (window.__urdView = window.__urdView || {});
  var VIEW_KEY = "urdView__";
  function viewLesen(id) {
    if (VIEW_STORE[id]) return VIEW_STORE[id];
    var v = null;
    try { v = UC.prefGet ? UC.prefGet(UC.prefKey ? UC.prefKey(VIEW_KEY + id) : VIEW_KEY + id) : null; }
    catch (e) {}
    return (v === "grid" || v === "list") ? v : null;
  }
  function viewSchreiben(id, k) {
    VIEW_STORE[id] = k;
    try { if (UC.prefSet) UC.prefSet(UC.prefKey ? UC.prefKey(VIEW_KEY + id) : VIEW_KEY + id, k); }
    catch (e) {}
  }

  /* ---- EIN NEU GEBAUTES ELEMENT MACHT WEITER (27.09. gemeldet) ----
     "Es ist gar nicht noetig, dass beim Theme-Wechsel was in den Loading-yes-State geht."
     Themenwechsel -> Bubble baut das Element neu (data-isdark ist ein dynamischer Wert im
     Markup) -> neue Wurzel mit derselben data-instance, initRoot von vorn -> loading true,
     Skelett, und nach 25s "No data". Bubble schickt die Daten nicht noch einmal, sie haben sich
     ja nicht geaendert. Die Ansicht kam ueber VIEW_STORE zurueck, die Antwort darunter nicht.
     Jetzt liegt auch der zuletzt gelieferte Stand hier, je Instanz, und eine neue Wurzel startet
     von dort. Dasselbe Muster wie responses-table und urls-table; geschrieben wird er von
     persist() in initRoot. */
  var STORE = (window.__urdStore = window.__urdStore || {});

  function isArr(v) { return Object.prototype.toString.call(v) === "[object Array]"; }

  /* Spaltenzahl der Kachelansicht: nach dem PLATZ, gedeckelt auf die Zahl der Kacheln.
     responses-table waehlt hier nur Zahlen, die die Kachelmenge glatt teilen, damit keine kurze
     letzte Reihe stehen bleibt. Diese Regel ist hier falsch, und zwar messbar: bei 1180px Breite
     ergaben 11 Kacheln 4 Spalten und 10 Kacheln 2 -- ein einziger weggefilterter Eintrag halbierte
     die Spaltenzahl und verdoppelte die Kachelbreite. In responses-table steht die Kachelmenge
     fest (die Seitengroesse), hier aendert sie der Marken-Filter bei jedem Klick.
     Eine kurze letzte Reihe ist der guenstigere Preis: sie sieht ruhig aus, ein springendes Raster
     nicht. */
  /* Die Schwellen sind die Mindestbreite einer Karte, mal Spaltenzahl, plus die Luecken (14px).
     Eine Karte war damit rund 284px breit; +32px heisst +32 JE SPALTE, also 1180 -> 1308 (4),
     880 -> 976 (3), 600 -> 664 (2). Gerechnet und danach gemessen, nicht geschaetzt. */
  function spalten(breite, anzahl) {
    if (anzahl <= 1) return 1;
    var max = breite >= 1308 ? 4 : breite >= 976 ? 3 : breite >= 664 ? 2 : 1;
    return Math.max(1, Math.min(max, anzahl));
  }

  /* ============================================================================================
     Markup. Die Komponente baut ihren Innenaufbau selbst -- im Bubble-Element gibt es keine
     Stelle, an der jemand von Hand etwas einsetzen soll.
     ============================================================================================ */
  function shell() {
    return '' +
      '<div class="urd-head">' +
        /* role=button und tabindex, weil der Klick ein Ereignis feuert: ohne die zwei kann man den
           Titel mit der Tastatur nicht erreichen. */
        '<h2 class="urd-prompt" role="button" tabindex="0"></h2>' +
        '<div class="urd-kpis"></div>' +
        /* DIE MARKEN IM KOPF (v2): eine Zeile unter einer Linie statt eines eigenen Abschnitts.
           Was nicht in die Zeile passt, steht hinter "+N more" (mentionsZeile). Bei zwanzig Marken
           bleibt es so eine Zeile, bis man sie alle haben will. */
        '<div class="urd-mrow" hidden>' +
          /* Das Wort im eigenen Element: der Sprachlauf von core uebersetzt Elemente, deren Text
             ein Katalogschluessel ist -- "Mentioned" plus Zaehler in einem waere "Mentioned2". */
          '<span class="urd-mrow-lbl"><span>Mentioned</span><span class="urd-mrow-n"></span></span>' +
          '<div class="urd-mrow-box">' +
            '<div class="urd-ments up-mentlist"></div>' +
            '<button type="button" class="urd-mrow-more" hidden></button>' +
          '</div>' +
        '</div>' +
      '</div>' +

      /* PRODUKTE (05.10., get_mention_detail_v8): ueber "Full Response", und nur wenn die Antwort
         welche gezeigt hat. Bei den meisten Antworten gibt es keine -- ein leerer Abschnitt waere
         dort keine Auskunft, sondern Rauschen. */
      '<div class="urd-sect urd-sect-shop" hidden>' +
        '<div class="urd-sec">' +
          '<div class="urd-sec-txt">' +
            '<span class="urd-sec-title">Products</span>' +
            '<span class="urd-sec-desc">Shopping products the model showed in this response</span>' +
          '</div>' +
          '<div class="urd-shop-nav" hidden>' +
            '<button type="button" class="up-iconbtn urd-shop-prev" aria-label="Previous products">' + UC.icon("chevronLeft", 2) + '</button>' +
            '<button type="button" class="up-iconbtn urd-shop-next" aria-label="More products">' + UC.icon("chevronRight", 2) + '</button>' +
          '</div>' +
        '</div>' +
        '<div class="urd-shop-wrap"><div class="urd-shop-row"></div></div>' +
      '</div>' +

      '<div class="urd-sect urd-sect-body">' +
        '<div class="urd-sec">' +
          '<div class="urd-sec-txt">' +
            '<span class="urd-sec-title">Full Response</span>' +
            '<span class="urd-sec-desc">The complete answer as the model returned it</span>' +
          '</div>' +
          /* Der Knopf sitzt in der Zeile der Ueberschrift, nicht darunter -- .urd-sec ist schon
             eine Zeile mit space-between, der Platz rechts war frei.
             wrap + menu, wie UC.makePopover es erwartet: der Wrap traegt is-open, das Menue haengt
             darin und wird von core positioniert und geschlossen. */
          /* v2: ein beschrifteter Textknopf statt des Zahnrads allein -- das Zeichen sagte nicht,
             was dahinter liegt. KEIN .up-iconbtn mehr: der waere hier in Breite, Polster und
             Hover ueberschrieben worden, also ein gesprengtes Bauteil (CLAUDE.md 1). */
          '<span class="urd-hlwrap">' +
            '<button class="urd-hlbtn" type="button" aria-label="Highlight settings"></button>' +
            '<div class="urd-hlpop up-pop"></div>' +
          '</span>' +
        '</div>' +
        /* Der Antworttext liest sich wie eine Nachricht -- also bekommt er auch den Absender:
           links das Modell-Logo, daneben sein Name. Die Idee stammt aus den alten Elementen, dort
           war es ein loses Bild neben dem Kasten. */
        /* Logo und Karte auf einer Linie: das Logo steht neben der Karte wie ein Profilbild neben
           einer Nachricht, seine Oberkante auf der Oberkante der Karte. Der Modellname stand
           vorher darueber -- er steht schon in der KPI-Zeile oben, zweimal derselbe Name auf
           einer Seite. */
        '<div class="urd-msg">' +
          '<div class="urd-msg-av"></div>' +
          '<div class="urd-card urd-body"><div class="up-rb"></div></div>' +
        '</div>' +
      '</div>' +

      '<div class="urd-sect urd-sect-cites">' +
        '<div class="urd-sec">' +
          '<div class="urd-sec-txt">' +
            '<span class="urd-sec-title">Citations</span>' +
            '<span class="urd-sec-desc">What citations were used for this answer</span>' +
          '</div>' +
          '<div class="urd-cites-tools">' +
          /* Der Schalter steht links neben dem Umschalter -- dieselbe Reihenfolge wie in den
             Tabellen: erst filtern, dann die Ansicht waehlen. */
          '<span class="urd-brandwrap"></span>' +
          '<div class="up-seg urd-viewseg" role="group" aria-label="Citations view">' +
            VIEWS.map(function (v) {
              return '<button class="up-seg-btn" type="button" data-view="' + v.key + '"' +
                       ' data-tip="' + esc(v.label) + '" aria-label="' + esc(v.label) + '">' +
                       UC.icon(v.icon, 2) + '</button>';
            }).join("") +
          '</div>' +
          '</div>' +
        '</div>' +
        '<div class="urd-cites-grid"></div>' +
        '<div class="urd-cites-list"></div>' +
      '</div>';
  }

  function initRoot(root) {
    if (root.__urdController) return root.__urdController;
    var instanceId = root.getAttribute("data-instance") || "default";
    if (instanceId === "INSTANCE_ID") return null;   /* Platzhalter noch nicht ersetzt */

    /* Einen mitgelieferten JSON-Block AUSLESEN, bevor shell() den Inhalt der Wurzel ersetzt --
       danach ist er weg. Genau daran ist der erste Versuch gescheitert. */
    var mitgeliefert = "";
    var elJson0 = root.querySelector('script[type="application/json"]');
    if (elJson0) mitgeliefert = String(elJson0.textContent || "");
    var eigenerPayload = !!(mitgeliefert.trim() && mitgeliefert.indexOf("PAYLOAD" + "_JSON") < 0);

    root.innerHTML = shell();
    var fire = UC.makeFire(root, { label: "response-detail", eventPrefix: "urd" });
    if (UC.widthTiers) UC.widthTiers(root, { narrowAt: 640, vnarrowAt: 480 });
    /* Der zweite Parameter ist die Themenabfrage -- ohne ihn steht der Tooltip im Dunkeln hell. */
    if (UC.makeTooltips) UC.makeTooltips(root, function () { return isDark; });

    var elPrompt = root.querySelector(".urd-prompt");
    var elKpis   = root.querySelector(".urd-kpis");
    var elMents  = root.querySelector(".urd-ments");
    var elMRow   = root.querySelector(".urd-mrow");
    var elMN     = root.querySelector(".urd-mrow-n");
    var elMMore  = root.querySelector(".urd-mrow-more");
    var elShop   = root.querySelector(".urd-sect-shop");
    var elShopRow = root.querySelector(".urd-shop-row");
    var elShopWrap = root.querySelector(".urd-shop-wrap");
    var elShopNav = root.querySelector(".urd-shop-nav");
    var elBody   = root.querySelector(".up-rb");
    var elAv     = root.querySelector(".urd-msg-av");
    var elHlBtn  = root.querySelector(".urd-hlbtn");
    var elHlWrap = root.querySelector(".urd-hlwrap");
    var elHlPop  = root.querySelector(".urd-hlpop");
    var elGrid   = root.querySelector(".urd-cites-grid");
    var elList   = root.querySelector(".urd-cites-list");
    var elSeg    = root.querySelector(".urd-viewseg");
    var elBrandWrap = root.querySelector(".urd-brandwrap");

    var isDark = UC.themeParam(root.getAttribute("data-isdark"));
    if (isDark) root.setAttribute("data-theme", "dark"); else root.removeAttribute("data-theme");

    /* Die Einstellungen der Hervorhebungen. Sie gelten fuer den Nutzer, nicht fuer die Instanz,
       also liegen sie in den Einstellungen (localStorage ueber UC.prefGet/prefSet, teambezogen) --
       wer sie einmal setzt, findet sie auf der naechsten Antwort wieder. */
    var HL_KEY = "urdHighlights";
    var HL_MODES = [
      { key: "all",   label: "All mentions",         desc: "Every time a brand appears" },
      { key: "first", label: "First mention only",   desc: "Once per brand" },
      { key: "own",   label: "Your brand only",      desc: "Competitors stay plain" },
      { key: "none",  label: "Off",                  desc: "No brand highlighting" }
    ];
    function hlLesen() {
      var v = null;
      try { v = UC.prefGet ? UC.prefGet(UC.prefKey ? UC.prefKey(HL_KEY) : HL_KEY) : null; } catch (e) {}
      var o = null;
      try { o = v ? JSON.parse(v) : null; } catch (e) { o = null; }
      var modus = o && o.brands;
      var gueltig = HL_MODES.some(function (m) { return m.key === modus; });
      /* group wie cites: standardmaessig AN, und nur eine ausdrueckliche Abwahl (group === false)
         schaltet es aus. Vorher stand hier !!o.group -- damit war ein fehlender Eintrag dasselbe
         wie "abgewaehlt", und der Standard war aus. */
      return { brands: gueltig ? modus : "first", cites: !(o && o.cites === false),
               group: !(o && o.group === false) };
    }
    function hlSchreiben() {
      try {
        if (UC.prefSet) UC.prefSet(UC.prefKey ? UC.prefKey(HL_KEY) : HL_KEY,
          JSON.stringify({ brands: state.hl.brands, cites: state.hl.cites, group: state.hl.group }));
      } catch (e) {}
    }

    /* Der gemerkte Stand dieser Instanz, wenn es ihn gibt -- dann ist diese Wurzel ein Neuaufbau
       und macht dort weiter, wo die alte stand (siehe STORE). Ohne ihn gelten genau die
       Anfangswerte von vorher; gemerkt() liefert dann den zweiten Wert.
       NICHT bei einem mitgelieferten JSON-Block: der ist dann die Quelle und wird unten ohnehin
       gesetzt. Baut Bubble das Element neu, WEIL darin eine andere Antwort steht, zeigte ein
       gemerkter Stand fuer einen Moment die vorige -- genau das, was setLoading unten verhindert. */
    var saved = (!eigenerPayload && STORE[instanceId]) || null;
    function gemerkt(k, sonst) { return saved && saved[k] != null ? saved[k] : sonst; }

    /* Der Marken-Filter ist Ansichtssache und gilt nur fuer diese Antwort -- er wird NICHT in den
       Einstellungen gespeichert. Wer eine Antwort oeffnet, will erst alle Quellen sehen. Einen
       Neuaufbau DERSELBEN Antwort ueberlebt er aber (STORE): ein Themenwechsel ist kein Grund,
       ihn wegzunehmen. reset() leert ihn wie bisher. */
    var state = {
      view: viewLesen(instanceId) || "grid",
      brandFilter: gemerkt("brandFilter", ""),
      hl: hlLesen(),
      /* loading startet auf true: die Komponente steht auf der Seite, bevor der Pageload-Workflow
         gelaufen ist, und in dieser Zeit LAEDT sie -- sie ist nicht leer. Ohne das zeigte jeder
         Abschnitt, der nur auf state.loading sieht, seinen Leerzustand, und die Seite las sich
         beim ersten Aufschlagen als "keine Daten" statt als "kommt gleich". Beendet wird der
         Zustand durch die Daten oder nach WARTE_MS durch die Warte-Uhr, nie durch nichts.
         Ein NEUAUFBAU dagegen laedt nicht: er uebernimmt den Ladezustand der alten Wurzel, und
         der war nach den Daten false. */
      data: gemerkt("data", null), loading: gemerkt("loading", true),
      hasData: gemerkt("hasData", false), fehler: gemerkt("fehler", null)
    };

    /* ---- Ein Wartezustand, der endet -------------------------------------------------------
       Das Skelett laeuft, solange keine Daten da sind. Ohne Ende ist "kommt gleich" nicht von
       "kommt nie" zu unterscheiden -- dieselbe Uhr und dieselbe Dauer wie in brand-detail und
       domain-detail. Im UI steht dann "No data"; warum, sagt die Konsole. */
    var WARTE_MS = 25000, warteUhr = null;
    function warteStarten() {
      if (warteUhr) clearTimeout(warteUhr);
      warteUhr = setTimeout(function () {
        warteUhr = null;
        /* Eine abgehaengte Wurzel wartet fuer niemanden mehr: Bubble hat das Element neu gebaut,
           und die neue Wurzel fuehrt ihre eigene Uhr (saved.wartet, unten). Ohne diese Zeile
           stellte sich die alte Uhr alle 25s neu -- ausserhalb des Dokuments wird sie nie
           sichtbar. */
        if (root.isConnected === false) return;
        if (state.hasData || state.fehler) return;
        /* Unsichtbar heisst: diese Seite ist gar nicht offen, Bubble haelt sie nur im DOM. Dann
           wartet niemand, und "No data" jetzt zu setzen hiesse, es steht beim spaeteren Oeffnen
           der Seite schon da, bevor der Pageload-Workflow ueberhaupt laufen konnte. Also weiter
           warten statt melden. */
        if (!UC.istSichtbar(root)) { verdecktWarten(); return; }
        state.fehler = "No data";
        state.loading = false;
        render();
        persist();
      }, WARTE_MS);
    }
    /* Verdeckt: jede Sekunde nachsehen, statt die volle Frist neu zu stellen -- und sobald die
       Wurzel wieder zu sehen ist, beginnt die Frist von vorn (01.10.). Mit der vollen Frist konnte
       der Ablauf kurz nach dem Oeffnen fallen, noch vor dem Lade-Schritt des Workflows, und dann
       stand "No data" im eben geoeffneten Drawer. Die Sekunde haengt an derselben Uhr: beenden
       und Neuaufbau-Merker (wartet) gelten auch fuer sie. */
    function verdecktWarten() {
      warteUhr = setTimeout(function () {
        warteUhr = null;
        if (root.isConnected === false) return;
        if (state.hasData || state.fehler) return;
        if (UC.istSichtbar(root)) warteStarten(); else verdecktWarten();
      }, 1000);
    }
    function warteBeenden() { if (warteUhr) { clearTimeout(warteUhr); warteUhr = null; } }

    /* Den Stand dieser Instanz fuer einen Neuaufbau festhalten (siehe STORE). Aufgerufen NACH dem
       Zeichnen: wirft render() an einem Payload, landet dieser nicht im Speicher -- sonst wuerfe
       jeder spaetere Neuaufbau schon in initRoot, und die Komponente kaeme nie wieder hoch.
       Danach auch deshalb, weil renderBrandFilter den Filter selbst leert, wenn es fuer die
       Antwort nichts zu filtern gibt -- der Speicher soll den Stand nach dieser Entscheidung
       tragen. wartet haelt fest, ob die Warte-Uhr lief: die der alten Wurzel ist mit ihr verloren.
       Nur eine Wurzel im Dokument schreibt: eine abgehaengte lebt in Uhren und Abonnements noch
       eine Weile weiter und wuerde den Stand der neuen sonst mit ihrem alten ueberschreiben. */
    function persist() {
      if (root.isConnected === false) return;
      STORE[instanceId] = {
        data: state.data, hasData: !!state.hasData, fehler: state.fehler || null,
        loading: !!state.loading, brandFilter: state.brandFilter || "",
        wartet: warteUhr != null,
        /* In welchem Drawer die Wurzel sass -- fuer das Oeffnen unten, falls Bubble sie beim
           Aufgehen neu baut und die neue noch nicht im Dokument steht. */
        drawer: drawerVon(root)
      };
    }
    function drawerVon(el) {
      var d = el.closest ? el.closest('[id^="drawer-"], [id^="content-"]') : null;
      return d ? String(d.id).replace(/^(drawer|content)-/, "") : "";
    }

    /* Beim ersten Aufbau laeuft die Uhr sofort (siehe loading oben). Ein Neuaufbau startet sie
       nur, wenn sie in der alten Wurzel lief -- einer mit Daten wartet auf nichts, und einer, bei
       dem die Geduld schon zu Ende war, zeigt weiter "No data" statt noch einmal 25s Skelett. */
    if (saved ? saved.wartet : true) warteStarten();

    /* ---- Der Kasten, der die Quellen einer Gruppe auflistet ---------------------------------
       Auf Hover, nicht auf Klick: die Gruppe ist eine Zusammenfassung, und wer sie ueberfliegt,
       will wissen was drin ist, ohne etwas zu oeffnen. Ein Klick auf eine Zeile darin verhaelt sich
       wie der Klick auf einen einzelnen Chip. */
    var glist = document.createElement("div");
    glist.className = "up-rb-glist";
    root.appendChild(glist);
    var glistFuer = null, glistZu = null;

    function glistSchliessen() {
      if (glistZu) { clearTimeout(glistZu); glistZu = null; }
      glist.classList.remove("is-open");
      glistFuer = null;
    }
    function glistOeffnen(g) {
      var daten;
      try { daten = JSON.parse(g.getAttribute("data-rb-group") || "[]"); } catch (e) { daten = []; }
      if (!daten.length) return;
      glist.innerHTML = daten.map(function (d, i) {
        return '<button type="button" data-gi="' + i + '">' +
          (d.fav ? '<img src="' + esc(d.fav) + '" alt="" loading="lazy" referrerpolicy="no-referrer"' +
                   ' onerror="this.style.visibility=\'hidden\'"/>' : '<img alt=""/>') +
          "<span>" + esc(d.title || UC.rbShowUrl(d.url)) + "</span></button>";
      }).join("");
      glist.__daten = daten;
      glistFuer = g;
      glist.classList.add("is-open");
      var r = g.getBoundingClientRect(), rr = root.getBoundingClientRect();
      glist.style.top = (r.bottom - rr.top + 6) + "px";
      glist.style.left = (r.left - rr.left) + "px";
      /* Erst nach dem Einfuegen messen: die Breite haengt am laengsten Titel. */
      requestAnimationFrame(function () {
        var maxLeft = root.clientWidth - glist.offsetWidth - 8;
        var left = r.left - rr.left;
        if (left > maxLeft) glist.style.left = Math.max(8, maxLeft) + "px";
      });
    }
    /* Verzoegertes Schliessen, damit der Weg von der Gruppe in den Kasten nicht abreisst. */
    function glistSpaeterSchliessen() {
      if (glistZu) clearTimeout(glistZu);
      glistZu = setTimeout(glistSchliessen, 180);
    }
    elBody.addEventListener("mouseover", function (e) {
      var g = e.target.closest ? e.target.closest(".up-rb-cgroup") : null;
      if (!g) return;
      if (glistZu) { clearTimeout(glistZu); glistZu = null; }
      if (glistFuer !== g) glistOeffnen(g);
    });
    elBody.addEventListener("mouseout", function (e) {
      var g = e.target.closest ? e.target.closest(".up-rb-cgroup") : null;
      if (g) glistSpaeterSchliessen();
    });
    glist.addEventListener("mouseover", function () { if (glistZu) { clearTimeout(glistZu); glistZu = null; } });
    glist.addEventListener("mouseout", glistSpaeterSchliessen);
    glist.addEventListener("click", function (e) {
      var b = e.target.closest ? e.target.closest("button[data-gi]") : null;
      if (!b || !glist.__daten) return;
      var d = glist.__daten[parseInt(b.getAttribute("data-gi"), 10)];
      glistSchliessen();
      if (!d) return;
      /* Dieselben Zitate wie einzeln, nur gebuendelt -- also auch derselbe Weg. */
      urlOeffnen(d.url);
    });
    window.addEventListener("scroll", glistSchliessen, true);

    /* ---- Kopfzeile ------------------------------------------------------------------------- */
    function renderHead() {
      if (state.fehler) { elPrompt.textContent = ""; elKpis.innerHTML = ""; return; }
      if (istLaden() || !state.data) {
        elPrompt.innerHTML = '<span class="urd-sk urd-sk-prompt"></span>' +
                             '<span class="urd-sk urd-sk-prompt2"></span>';
        elKpis.innerHTML = '<span class="urd-sk urd-sk-kpi"></span>' +
                           '<span class="urd-sk urd-sk-kpi"></span>';
        return;
      }
      var d = state.data;
      /* textContent und nicht innerHTML: der Prompt ist Nutzertext und darf kein Markup tragen. */
      elPrompt.textContent = String(d.prompt_text || "");
      elPrompt.setAttribute("data-id", String(d.prompt_id || ""));

      /* v2: zwei Gruppen statt Trennstrichen. Links der Absender (Modell, Zeit), rechts wo und
         worueber (Market, Themen). Der Abstand zwischen den Gruppen trennt staerker als ein Strich. */
      var links = [], rechts = [];
      if (d.model) links.push(UC.modelChip(d.model, { full: true }));
      var zeit = UC.relativeTime(d.run_at);
      if (zeit) links.push('<span class="urd-kpi-time" data-tip="' +
        esc(String(d.run_at || "")) + '">' + esc(zeit) + "</span>");
      if (d.market) rechts.push(UC.marketChip(d.market));
      /* Erst bauen, dann pruefen: topicChip laesst ein Thema ohne Namen weg, und eine Liste, in
         der keines einen Namen hat, ergab eine leere Huelle. */
      var themen = isArr(d.tags) ? d.tags.map(topicChip).join("") : "";
      if (themen) rechts.push('<span class="urd-tags">' + themen + "</span>");
      elKpis.innerHTML = links.join("") + (rechts.length ? '<span class="urd-kpi-push">' + rechts.join("") + "</span>" : "");
    }

    /* Ein Thema als .up-topicchip aus core -- dasselbe Bauteil und dieselbe Farbe wie in der
       Prompts-Tabelle, im Radar und im Topics-Manager. Die Farbe steht NICHT im Payload: sie kommt
       aus dem seitenweiten Themen-Store, nachgeschlagen ueber die id. Fehlt der Store, bleibt der
       Chip beim Grau aus dem Bauteil -- lesbar, nur ohne Zuordnung.
       is-static, weil ein Thema hier reine Anzeige ist und keinen Klick traegt. */
    /* Die Farbe kommt jetzt im Payload mit: hex_light und hex_dark je Thema. Sie gewinnt, weil sie
       zu DIESER Antwort gehoert -- der Themen-Store kann veraltet sein oder auf der Seite fehlen.
       Nur wenn beide Felder fehlen, wird im Store nachgeschlagen; erst dann bleibt es beim Grau
       des Bauteils. */
    function topicFarbe(t) {
      if (!t) return "";
      var eigen = isDark ? t.hex_dark : t.hex_light;
      if (eigen) return String(eigen);
      /* Nur eine Farbe geliefert: die nehmen, statt in beiden Themen grau zu bleiben. */
      if (t.hex_light || t.hex_dark) return String(t.hex_light || t.hex_dark);
      var liste = UC.getTopics ? UC.getTopics() : null;
      if (!liste || !t.id) return "";
      for (var i = 0; i < liste.length; i++) {
        var x = liste[i];
        if (x && String(x.id) === String(t.id)) return String(x.color || "");
      }
      return "";
    }
    function topicChip(t) {
      if (!t || !t.name) return "";
      var farbe = topicFarbe(t);
      return '<span class="up-topicchip is-static"' +
               (farbe ? ' style="--ust-tag-color:' + esc(farbe) + '"' : "") + ">" +
               (t.emoji ? '<span class="up-topicchip-e">' + esc(t.emoji) + "</span>" : "") +
               '<span class="up-topicchip-lbl">' + esc(t.name) + "</span>" +
             "</span>";
    }

    /* ---- Mentions ------------------------------------------------------------------------- */
    function renderMents() {
      /* Der Fehler steht im Antworttext, nicht noch einmal hier: der Kopf traegt dann keine Zeile. */
      if (state.fehler) { elMents.innerHTML = ""; elMN.textContent = ""; elMRow.hidden = true; return; }
      if (istLaden() || !state.data) {
        elMents.innerHTML = new Array(4).join("x").split("x")
          .map(function () { return '<span class="urd-sk urd-sk-ment"></span>'; }).join("");
        elMN.textContent = "";
        elMRow.hidden = false;
        mentionsZeile();
        return;
      }
      var liste = isArr(state.data.companies) ? state.data.companies : [];
      /* Ohne Marken keine Zeile: "Mentioned" ohne etwas dahinter waere eine leere Ueberschrift. */
      elMRow.hidden = !liste.length;
      elMN.textContent = liste.length ? String(liste.length) : "";
      if (!liste.length) {
        elMents.innerHTML = "";
        return;
      }
      elMents.innerHTML = liste.map(function (c) {
        /* brand_name_raw und nicht name: das ist die Schreibweise, mit der die Marke im Antworttext
           steht und mit der sie dort auch ausgezeichnet wird ("LeeUP Media", nicht "LeeUp Media").
           Zwei Schreibweisen derselben Marke auf einer Seite lesen sich wie zwei Marken. */
        var name = String((c && (c.brand_name_raw || c.name)) || "");
        var logo = String((c && c.favicon_url) || "");
        var buchst = (name.charAt(0) || "?").toUpperCase();
        /* Kein Chip und keine Karte: Logo und Name, wie in der Mentioned-Liste der Tabellen.
           Der Rahmen um jede Marke machte aus einer Aufzaehlung eine Reihe von Knoepfen -- hier
           steht aber einfach, wer vorkommt. Anklickbar bleibt es (der Zeiger und der Hover sagen
           es), nur ohne eigenen Kasten. */
        /* up-chiphover ist der geteilte Hover fuer anklickbare Chips: er faellt auf die neutrale
           Flaeche mit dem Haus-Rahmen, damit "das ist ein Bedienelement" ueberall gleich liest. */
        return '<span class="up-entchip is-soft up-chiphover urd-ment" role="button" tabindex="0"' +
                 ' data-brand="' + esc(String((c && c.company_id) || "")) + '">' +
                 '<span class="up-ment-logo' + (logo ? " has-img" : "") + '">' +
                   '<span class="up-model-ltr">' + esc(buchst) + "</span>" +
                   (logo ? '<img src="' + esc(logo) + '" alt="" loading="lazy"' +
                           ' referrerpolicy="no-referrer"' +
                           ' onerror="this.parentNode.classList.remove(\'has-img\'); this.remove()"/>' : "") +
                 "</span>" +
                 '<span class="up-ment-name">' + esc(name) + "</span>" +
               "</span>";
      }).join("");
      mentionsZeile();
    }

    /* "+N more": wie viele Chips NICHT in der ersten Zeile stehen -- alles, was tiefer beginnt als
       der erste (offsetTop, das ist eine Layoutgroesse und braucht kein gemaltes Bild). Aufgeklappt
       bricht die Zeile um, und der Knopf heisst "Show less". */
    var mentionsOffen = false;
    function mentionsZeile() {
      elMRow.classList.toggle("is-open", mentionsOffen);
      var chips = elMents.querySelectorAll(".urd-ment");
      if (!chips.length) { elMMore.hidden = true; return; }
      /* Bis zu drei Runden: der Knopf selbst nimmt der Zeile Platz, und mit "+11 more" daneben
         rutschte ein zwoelfter Chip in die zweite Zeile (gemessen: 11 gezaehlt, 12 verdeckt). Also
         nach dem Setzen noch einmal zaehlen, bis die Zahl steht. */
      for (var runde = 0; runde < 3; runde++) {
        var oben = chips[0].offsetTop, weg = 0;
        for (var i = 0; i < chips.length; i++) if (chips[i].offsetTop > oben + 4) weg++;
        var txt = mentionsOffen ? UC.t("Show less") : UC.t("+{n} more").replace("{n}", String(weg));
        var versteckt = !mentionsOffen && weg === 0;
        if (elMMore.hidden === versteckt && elMMore.textContent === txt) break;
        elMMore.hidden = versteckt;
        elMMore.textContent = txt;
      }
    }
    elMMore.addEventListener("click", function () { mentionsOffen = !mentionsOffen; mentionsZeile(); });

    /* ---- Products (05.10.) -----------------------------------------------------------------
       shopping_products aus get_mention_detail_v8, je Produkt: ordinal (Reihenfolge in der Antwort),
       position (Platz in der Produktliste, null bei Einzelkarte), source_product_id (Text, fuehrt
       zum Product Detail), title / listing_title, brand {company_id, name, logo_url, type},
       image_url / image_urls, price / price_str / currency, rating / num_reviews, merchant_name.
       Gezeigt wird in der Reihenfolge der Antwort (ordinal) -- so hat das Modell sie gezeigt. */
    function zahl(v) {
      if (v == null || v === "" || typeof v === "boolean") return null;
      var n = Number(v);
      return isFinite(n) ? n : null;
    }
    /* Nur http(s): ein Bild aus den Daten darf nie javascript: oder data: sein. */
    function sichereUrl(u) {
      var x = String(u == null ? "" : u).trim();
      if (x.indexOf("//") === 0) x = "https:" + x;
      return /^https?:\/\//i.test(x) ? x : "";
    }
    function produkte(d) {
      var l = d && isArr(d.shopping_products) ? d.shopping_products : [];
      return l.filter(function (p) {
        return p && typeof p === "object" && String(p.title || p.listing_title || "").trim();
      }).map(function (p, i) { return { p: p, i: i }; }).sort(function (a, b) {
        var x = zahl(a.p.ordinal), y = zahl(b.p.ordinal);
        if (x == null) x = 1e9 + a.i;
        if (y == null) y = 1e9 + b.i;
        return x - y;
      }).map(function (o) { return o.p; });
    }
    function produktKarte(p, k) {
      var b = p.brand && typeof p.brand === "object" ? p.brand : { type: "other" };
      var andere = b.type === "other" || !String(b.name || "").trim();
      var titel = String(p.title || p.listing_title || "").trim();
      var listing = String(p.listing_title || "").trim();
      var id = String(p.source_product_id == null ? "" : p.source_product_id).trim();
      var pos = zahl(p.position);
      var bild = sichereUrl(p.image_url) || sichereUrl(isArr(p.image_urls) ? p.image_urls[0] : "");
      /* Erst der Preis im Format der App, sonst was die Antwort schrieb (price_str), sonst der
         Hinweis -- nie eine geratene Zahl. */
      var preis = (UC.fmtGeld ? UC.fmtGeld(p.price, p.currency) : "") || String(p.price_str || "").trim().slice(0, 40);
      var note = zahl(p.rating);
      if (note != null && (note < 0 || note > 5.05)) note = null;
      var stimmen = zahl(p.num_reviews);
      var haendler = String(p.merchant_name || "").trim();
      var marke = andere
        ? UC.markenChip({ name: UC.t("Other (unassigned)") }, { ltr: "\u2013", cls: "urd-pc-brand is-none" })
        : UC.markenChip(b, { cls: "urd-pc-brand" });
      /* Ohne Produkt-Id kein Ziel -- dann ist die Karte nur Anzeige, kein Knopf. */
      var tag = id ? 'button type="button"' : "div";
      return "<" + tag + ' class="urd-pc' + (id ? "" : " is-static") + '" data-pkey="' + k + '"' +
          (id ? ' data-product="' + esc(id) + '"' : "") + ">" +
        '<span class="urd-pc-media' + (bild ? " has-img" : "") + '">' +
          (bild ? '<img src="' + esc(bild) + '" alt="" loading="lazy" referrerpolicy="no-referrer"' +
                  ' onerror="this.parentNode.classList.remove(\'has-img\');this.remove()"/>' : "") +
          '<span class="urd-pc-noimg">' + UC.icon("image", 1.5) + "</span>" +
          (pos != null && pos >= 1 ? '<span class="urd-pc-pos" data-tip="' +
            esc(UC.t("Position {n} in this response").replace("{n}", String(Math.round(pos)))) + '">' + Math.round(pos) + "</span>" : "") +
          (b.type === "own" && !andere ? '<span class="up-marke up-you urd-pc-you">' + esc(UC.t("You")) + "</span>" : "") +
        "</span>" +
        '<span class="urd-pc-body">' +
          '<span class="urd-pc-top">' + marke +
            (note != null ? '<span class="urd-pc-rate">' + UC.icon("star", 2) +
              '<span class="up-num">' + esc(UC.fmtNum ? UC.fmtNum(note, 1) : note.toFixed(1)) + "</span>" +
              (stimmen != null && stimmen >= 0 ? '<span class="urd-pc-revs">(' + esc(UC.fmtNum ? UC.fmtNum(Math.round(stimmen), 0, true) : String(Math.round(stimmen))) + ")</span>" : "") +
            "</span>" : "") +
          "</span>" +
          '<span class="urd-pc-title"' + (listing && listing !== titel ? ' data-tip="' + esc(listing) + '"' : "") + ">" + esc(titel) + "</span>" +
          '<span class="urd-pc-foot">' +
            '<span class="urd-pc-price' + (preis ? "" : " is-none") + '">' + esc(preis || UC.t("No price shown")) + "</span>" +
            '<span class="urd-pc-merch' + (haendler ? "" : " is-none") + '">' + UC.icon("store", 2) +
              '<span class="urd-pc-mname"' + (haendler ? ' data-tip="' + esc(haendler) + '"' : "") + ">" + esc(haendler || UC.t("No merchant shown")) + "</span>" +
            "</span>" +
          "</span>" +
        "</span>" +
      "</" + (id ? "button" : "div") + ">";
    }
    /* KEIN Skelett fuer die Produkte, solange die Antwort laedt: bei den meisten Antworten gibt es
       keine, und ein Skelett, das danach verschwindet, liesse die Seite springen und behauptete
       vorher etwas, das nicht stimmt. Der Abschnitt kommt mit den Daten oder gar nicht. */
    var produktListe = [];
    function renderShop() {
      produktListe = (!istLaden() && !state.fehler && state.data) ? produkte(state.data) : [];
      elShop.hidden = !produktListe.length;
      if (!produktListe.length) { elShopRow.innerHTML = ""; return; }
      elShopRow.innerHTML = produktListe.map(produktKarte).join("");
      elShopRow.scrollLeft = 0;
      shopRand();
    }
    /* Pfeile nur, wenn es etwas zu blaettern gibt; jeder aus, wenn seine Seite am Ende ist. Die Blende
       rechts (is-more) sagt "da kommt noch was" und verschwindet am Ende, sonst laege die letzte
       Karte halb im Nebel. ziel: wohin ein Pfeil gerade faehrt -- das scroll-Ereignis kommt erst
       mit gemalten Bildern, ein verdeckter Tab malt keine. */
    function shopRand(ziel) {
      var max = elShopRow.scrollWidth - elShopRow.clientWidth;
      var pos = ziel != null ? ziel : elShopRow.scrollLeft;
      elShopNav.hidden = max <= 2;
      var prev = elShopNav.querySelector(".urd-shop-prev"), next = elShopNav.querySelector(".urd-shop-next");
      prev.disabled = pos <= 2; prev.classList.toggle("is-disabled", pos <= 2);
      next.disabled = pos >= max - 2; next.classList.toggle("is-disabled", pos >= max - 2);
      elShopWrap.classList.toggle("is-more", max > 2 && pos < max - 2);
    }
    function shopBlaettern(r) {
      /* Eine Seite weniger eine Kartenbreite Ueberlapp: die letzte Karte der alten Seite steht
         dann vorn auf der neuen, der Blick verliert den Faden nicht. */
      var max = elShopRow.scrollWidth - elShopRow.clientWidth;
      var ziel = Math.max(0, Math.min(max, elShopRow.scrollLeft + r * Math.max(220, elShopRow.clientWidth - 80)));
      try { elShopRow.scrollTo({ left: ziel, behavior: "smooth" }); } catch (e) { elShopRow.scrollLeft = ziel; }
      shopRand(ziel);
    }
    elShopNav.querySelector(".urd-shop-prev").addEventListener("click", function () { shopBlaettern(-1); });
    elShopNav.querySelector(".urd-shop-next").addEventListener("click", function () { shopBlaettern(1); });
    elShopRow.addEventListener("scroll", function () { shopRand(); }, { passive: true });

    /* ---- Produkte im Text ------------------------------------------------------------------
       Der Produktname vor dem ersten Komma ("Raab Vitalfood Elektrolyt"), weil das Modell
       Packungsangaben fast nie mitschreibt. Nur reine Textknoten, nicht in Zitat-, Marken- oder
       Gruppen-Chips. Schreibt das Modell den Namen anders, wird nichts markiert -- verlaesslich
       ginge es nur mit Textstellen aus der RPC. */
    function rxEsc(x) { return x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
    function produkteImText() {
      if (!produktListe.length || !elBody) return 0;
      var keys = produktListe.map(function (p, k) {
        return { k: k, n: String(p.title || p.listing_title || "").split(",")[0].trim() };
      }).filter(function (x) { return x.n.length >= 6; }).sort(function (a, b) { return b.n.length - a.n.length; });
      if (!keys.length) return 0;
      var muster = keys.map(function (x) { return rxEsc(x.n); }).join("|");
      var treffe = new RegExp("(" + muster + ")", "i");
      var w = document.createTreeWalker(elBody, NodeFilter.SHOW_TEXT, {
        acceptNode: function (n) {
          if (!n.nodeValue || !treffe.test(n.nodeValue)) return NodeFilter.FILTER_REJECT;
          if (n.parentNode.closest(".up-rb-cite, .up-rb-cgroup, .up-rb-brand, .urd-pmark")) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      });
      var knoten = [];
      while (w.nextNode()) knoten.push(w.currentNode);
      var zahlMarken = 0;
      knoten.forEach(function (n) {
        var teile = n.nodeValue.split(new RegExp("(" + muster + ")", "i"));
        if (teile.length < 2) return;
        var frag = document.createDocumentFragment();
        teile.forEach(function (t, i) {
          if (!t) return;
          if (i % 2 === 1) {
            var hit = keys.filter(function (x) { return x.n.toLowerCase() === t.toLowerCase(); })[0];
            var m = document.createElement("span");
            m.className = "urd-pmark";
            m.setAttribute("data-pkey", hit ? String(hit.k) : "");
            m.setAttribute("role", "button");
            m.setAttribute("tabindex", "0");
            m.textContent = t;
            frag.appendChild(m);
            zahlMarken++;
          } else frag.appendChild(document.createTextNode(t));
        });
        n.parentNode.replaceChild(frag, n);
      });
      return zahlMarken;
    }
    /* Wort und Karte gehoeren zusammen: Hover auf das eine hebt das andere an, und die Karte rollt
       dabei in den sichtbaren Teil ihrer Reihe. */
    function produktHervor(k, an) {
      if (k == null || k === "") return;
      [].forEach.call(root.querySelectorAll('.urd-pmark[data-pkey="' + k + '"], .urd-pc[data-pkey="' + k + '"]'), function (e) {
        e.classList.toggle("is-hl", an);
      });
      if (!an) return;
      var karte = elShopRow.querySelector('.urd-pc[data-pkey="' + k + '"]');
      if (!karte) return;
      var l = karte.offsetLeft, r = l + karte.offsetWidth;
      if (l < elShopRow.scrollLeft || r > elShopRow.scrollLeft + elShopRow.clientWidth) {
        var ziel = Math.max(0, l - 2);
        try { elShopRow.scrollTo({ left: ziel, behavior: "smooth" }); } catch (e) { elShopRow.scrollLeft = ziel; }
        shopRand(ziel);
      }
    }
    root.addEventListener("mouseover", function (e) {
      var t = e.target.closest ? e.target.closest(".urd-pmark, .urd-pc[data-pkey]") : null;
      if (!t || (e.relatedTarget && t.contains(e.relatedTarget))) return;
      produktHervor(t.getAttribute("data-pkey"), true);
    });
    root.addEventListener("mouseout", function (e) {
      var t = e.target.closest ? e.target.closest(".urd-pmark, .urd-pc[data-pkey]") : null;
      if (!t || (e.relatedTarget && t.contains(e.relatedTarget))) return;
      produktHervor(t.getAttribute("data-pkey"), false);
    });
    /* Der Klick auf ein Wort rollt die Seite zum Abschnitt Products -- in ihrem eigenen Scrollkasten
       (Drawer oder #main), nicht im Fenster. */
    function zuDenProdukten() {
      var p = elShop.parentElement;
      for (; p && p !== document.body; p = p.parentElement) {
        var o = getComputedStyle(p).overflowY;
        if ((o === "auto" || o === "scroll") && p.scrollHeight > p.clientHeight) break;
      }
      var top;
      if (p && p !== document.body) {
        top = elShop.getBoundingClientRect().top - p.getBoundingClientRect().top + p.scrollTop - 24;
        try { p.scrollTo({ top: top, behavior: "smooth" }); } catch (e) { p.scrollTop = top; }
      } else {
        top = elShop.getBoundingClientRect().top + window.pageYOffset - 24;
        try { window.scrollTo({ top: top, behavior: "smooth" }); } catch (e2) { window.scrollTo(0, top); }
      }
    }
    /* Ein Produkt oeffnen: ist in Bubble ein Empfaenger fuer urdProduct verdrahtet, entscheidet er.
       Sonst direkt: den Drawer schliessen, in den Shopping-Bereich wechseln (ueber die Seitenleiste,
       damit Bubble seinen View-State setzt) und dort das Produkt oeffnen. Ohne Shopping-Element auf
       der Seite bleibt das Ereignis -- dann sagt makeFire in der Konsole, dass niemand zuhoert. */
    function produktOeffnen(id) {
      id = String(id || "").trim();
      if (!id) return;
      var fnName = root.getAttribute("data-product-fn") || "bubble_fn_urdProduct";
      var sh = document.querySelector(".ush-root");
      var sc = sh && sh.__ushController;
      if (typeof window[fnName] === "function" || !sc || typeof sc.oeffnen !== "function") {
        fire("data-product-fn", "urdProduct", id);
        return;
      }
      var dr = root.closest ? root.closest('[id^="drawer-"]') : null;
      if (dr && typeof window.closeDrawer === "function") {
        try { window.closeDrawer(dr.id.replace(/^drawer-/, "")); } catch (e) {}
      }
      if (typeof window.usnNavigieren === "function") window.usnNavigieren("shopping");
      else if (typeof window.showView === "function") window.showView("shopping");
      sc.oeffnen(id);
    }

    /* ---- Full Response -------------------------------------------------------------------- */
    /* Der Aufbau des Skeletts, einmal als Daten: h ist eine Ueberschrift (Breite in Prozent), p ein
       Absatz (eine Breite je Zeile).
       Weniger Balken, dafuer breiter und mit mehr Luft: 17 Zeilen waren eine Wand, drei je Absatz
       sind eine Andeutung. Die Breiten liegen jetzt bei 92 bis 99 statt 52 bis 96 -- ein Absatz
       fuellt seine Zeile fast ganz, nur die letzte bricht kurz, und genau daran erkennt man einen
       Absatz. Die Hoehe bleibt aehnlich, weil die Abstaende wachsen, was ausfaellt. */
    var ABSCHNITTE = [
      { p: [98, 94, 63] },
      { h: 34 },
      { p: [96, 99, 71] },
      { h: 28 },
      { p: [97, 93, 58] },
      { h: 41 },
      { p: [95, 68] }
    ];
    var letzteMessung = null;
    function renderBody() {
      if (state.fehler) { elBody.innerHTML = '<span class="urd-empty">' + esc(state.fehler) + "</span>"; return; }
      if (istLaden() || !state.data) {
        /* Das Skelett hat jetzt die FORM einer Antwort, nicht nur ihre Masse: Absatz, Ueberschrift,
           Absatz, Ueberschrift, Absatz, Schluss. Eine Wand aus gleich langen Balken sieht aus wie
           ein Ladefehler; eine Gliederung sieht aus wie ein Text, der gleich da ist.
           Die Ueberschriften sind kuerzer und etwas hoeher als die Textzeilen (18 zu 14) und tragen
           mehr Luft ueber sich -- dasselbe Verhaeltnis, das der fertige Text hat. Die Zeilenbreiten
           sind ungleich, und jeder Absatz endet kurz: so bricht Text wirklich. */
        elBody.innerHTML = ABSCHNITTE.map(function (a) {
          if (a.h) return '<span class="urd-sk urd-sk-h" style="width:' + a.h + '%"></span>';
          return '<div class="urd-sk-para">' + a.p.map(function (w) {
            return '<span class="urd-sk urd-sk-line" style="width:' + w + '%"></span>';
          }).join("") + "</div>";
        }).join("");
        return;
      }
      var d = state.data;
      var text = d.response_json && d.response_json.text != null ? d.response_json.text : d.text;
      if (text == null || String(text).trim() === "") {
        elBody.innerHTML = '<span class="urd-empty">No response text.</span>';
        letzteMessung = null;
        return;
      }
      /* Der ganze Weg liegt in core: Bloecke, Tabellen, Zitat-Chips, Markenauszeichnung. Was
         gesetzt wurde, kommt zurueck -- damit ist es messbar statt geraten. */
      letzteMessung = UC.respBody(elBody, {
        text: text,
        citations: d.citations,
        companies: d.companies,
        model: d.model,
        brandMode: state.hl.brands,
        cites: state.hl.cites,
        groupCites: state.hl.group,
        ownIds: eigeneIds(d),
        /* v2: dieselbe Nummer am Zitat wie an der Quelle im Abschnitt "Citations". */
        nummern: true
      });
      produkteImText();
    }

    /* Welche Marke ist die eigene? Das companies-Array sagt es nicht -- die Rolle steht nur an
       den Erwaehnungen der Zitationen (role: "own"). Von dort kommt die Menge der eigenen ids, und
       das ist der einzige Ort in den Daten, der es hergibt. */
    function eigeneIds(d) {
      var out = null;
      (isArr(d && d.citations) ? d.citations : []).forEach(function (c) {
        (isArr(c && c.mentions) ? c.mentions : []).forEach(function (m) {
          if (m && m.role === "own" && m.company_id) {
            if (!out) out = {};
            out[String(m.company_id)] = true;
          }
        });
      });
      return out;
    }

    /* Die eigene Marke, wie sie in den Daten steht: Name und Logo aus der ersten Erwaehnung mit
       role "own". Das ist derselbe Ort, aus dem auch der Modus "Your brand only" seine ids nimmt --
       eine Quelle, keine zweite Wahrheit. data-brand am Element ist der Rueckfall fuer den Namen. */
    function eigeneMarke(d) {
      var treffer = null;
      (isArr(d && d.citations) ? d.citations : []).forEach(function (c) {
        (isArr(c && c.mentions) ? c.mentions : []).forEach(function (m) {
          if (!treffer && m && m.role === "own") treffer = m;
        });
      });
      if (treffer) return { name: String(treffer.name || ""), logo: String(treffer.favicon_url || "") };
      var attr = (root.getAttribute("data-brand") || "").trim();
      if (attr && attr !== "BRAND_NAME") return { name: attr, logo: "" };
      return null;
    }

    /* Zaehlt, wie viele Quellen die eigene Marke nennen -- der Schalter erscheint nur, wenn es
       ueberhaupt etwas zu filtern gibt. Ein Filter, der nichts aendert, ist ein toter Knopf. */
    function mitEigener(d) {
      return (isArr(d && d.citations) ? d.citations : []).filter(function (c) {
        return (isArr(c && c.mentions) ? c.mentions : []).some(function (m) { return m && m.role === "own"; });
      }).length;
    }

    /* Der Knopf wird EINMAL gebaut und danach nur noch umgeklassifiziert. Ihn bei jedem Klick per
       innerHTML neu zu setzen kostete den Tastaturfokus: wer mit Enter schaltet, verliert das
       Element unter dem Finger und muss sich neu hinnavigieren. Ausserdem laedt das Logo dabei
       jedes Mal neu. */
    var brandGebaut = "";
    function syncBrandKlassen() {
      var b = elBrandWrap ? elBrandWrap.querySelector(".urd-brandtoggle") : null;
      if (!b) return;
      b.classList.toggle("is-yes", state.brandFilter === "yes");
      b.classList.toggle("is-no", state.brandFilter === "no");
      b.setAttribute("aria-pressed", state.brandFilter ? "true" : "false");
    }
    function renderBrandFilter() {
      if (!elBrandWrap) return;
      var d = state.data;
      var marke = d ? eigeneMarke(d) : null;
      var treffer = d ? mitEigener(d) : 0;
      var gesamt = d && isArr(d.citations) ? d.citations.length : 0;
      /* Sichtbar nur, wenn es eine eigene Marke gibt UND der Filter etwas aendern kann: bei 0
         Treffern oder wenn ALLE Quellen sie nennen, gibt es nichts zu filtern. */
      var zeigen = !!marke && !istLaden() && !state.fehler && treffer > 0 && treffer < gesamt;
      if (!zeigen) {
        if (brandGebaut) { elBrandWrap.innerHTML = ""; brandGebaut = ""; }
        if (state.brandFilter) state.brandFilter = "";
        return;
      }
      /* Neu bauen nur, wenn sich die Marke selbst geaendert hat -- der Zustand kommt ueber die
         Klassen. */
      var kennung = marke.name + "|" + marke.logo;
      if (brandGebaut !== kennung) {
        elBrandWrap.innerHTML = UC.brandToggleHtml({ name: marke.name, logo: marke.logo,
          cls: "urd-brandtoggle is-visible" });
        brandGebaut = kennung;
      }
      syncBrandKlassen();
    }

    /* Absender der Nachricht: Logo und Name des Modells, beides aus dem Modell-Store (UC.modelChip
       liefert genau das Paar). Der Chip wird auseinandergenommen, weil das Logo hier gross links
       neben der Karte steht und der Name darueber. */
    function renderAbsender() {
      /* Bei einem Fehler KEIN Skelett: ein pulsierendes Logo neben der Fehlermeldung sagte "kommt
         gleich", wo nichts mehr kommt (leer und kaputt duerfen nie gleich aussehen). */
      if (state.fehler) { elAv.innerHTML = ""; elHlBtn.hidden = true; return; }
      if (istLaden() || !state.data) {
        elAv.innerHTML = '<span class="urd-sk urd-sk-av"></span>';
        elHlBtn.hidden = true;
        return;
      }
      elHlBtn.hidden = false;
      /* Der Pfeil zeigt nur, dass ein Menue folgt -- er dreht sich beim Oeffnen nicht. */
      if (!elHlBtn.innerHTML) elHlBtn.innerHTML = UC.icon("settings", 2) +
        '<span class="urd-hllbl">Highlights</span><span class="urd-hlchev">' + UC.icon("chevronDown", 2) + "</span>";
      /* Nur das Logo aus dem Modell-Chip -- den Namen traegt die KPI-Zeile oben. Der Tooltip
         nennt ihn trotzdem, damit das Bild allein nicht raten laesst. */
      var chip = document.createElement("div");
      chip.innerHTML = UC.modelChip(state.data.model, { full: true });
      var logo = chip.querySelector(".up-ment-logo");
      var name = chip.querySelector(".up-ment-name");
      elAv.innerHTML = logo ? logo.outerHTML : "";
      if (name) elAv.setAttribute("data-tip", name.textContent);
    }

    /* ---- Das Menue der Hervorhebungen (10) --------------------------------------------------
       Ein kleines Menue an der Kopfzeile der Antwort. UC.makePopover uebernimmt Positionierung,
       Schliessen bei Klick daneben und Escape -- dasselbe Verhalten wie jedes andere Menue der App. */
    function hlMenuHtml() {
      return '<div class="urd-hlgrp">' +
          '<div class="urd-hlhead">Brand highlights</div>' +
          HL_MODES.map(function (m) {
            return '<button type="button" class="urd-hlopt' +
              (state.hl.brands === m.key ? " is-on" : "") + '" data-hl="' + m.key + '">' +
              '<span class="urd-hlradio"></span>' +
              '<span class="urd-hltxt"><span class="urd-hllbl">' + esc(m.label) + "</span>" +
              '<span class="urd-hldesc">' + esc(m.desc) + "</span></span></button>";
          }).join("") +
        "</div>" +
        '<div class="urd-hlsep"></div>' +
        '<div class="urd-hlgrp">' +
          '<div class="urd-hlhead">Citations</div>' +
          '<button type="button" class="urd-hlopt" data-cites="1">' +
            '<span class="urd-hlcheck' + (state.hl.cites ? " is-on" : "") + '">' +
              UC.icon("check", 3) + "</span>" +
            '<span class="urd-hltxt"><span class="urd-hllbl">Show citation chips</span>' +
            '<span class="urd-hldesc">Sources stay listed below either way</span></span></button>' +
          /* Das Gruppieren hat nur einen Sinn, wenn die Chips ueberhaupt da sind. */
          '<button type="button" class="urd-hlopt' + (state.hl.cites ? "" : " is-off") +
            '" data-group="1"' + (state.hl.cites ? "" : " disabled") + ">" +
            '<span class="urd-hlcheck' + (state.hl.group && state.hl.cites ? " is-on" : "") + '">' +
              UC.icon("check", 3) + "</span>" +
            '<span class="urd-hltxt"><span class="urd-hllbl">Group adjacent sources</span>' +
            '<span class="urd-hldesc">Several in a row become one chip</span></span></button>' +
        "</div>";
    }
    var hlPop = UC.makePopover ? UC.makePopover({
      wrap: elHlWrap, menu: elHlPop, opener: elHlBtn
    }) : null;
    if (hlPop) {
      elHlBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        elHlPop.innerHTML = hlMenuHtml();
        hlPop.toggle();
      });
      elHlPop.addEventListener("click", function (e) {
        var opt = e.target.closest ? e.target.closest("[data-hl]") : null;
        if (opt) {
          state.hl.brands = opt.getAttribute("data-hl");
          hlSchreiben();
          elHlPop.innerHTML = hlMenuHtml();
          renderBody();
          return;
        }
        var cb = e.target.closest ? e.target.closest("[data-cites]") : null;
        if (cb) {
          state.hl.cites = !state.hl.cites;
          hlSchreiben();
          elHlPop.innerHTML = hlMenuHtml();
          renderBody();
          return;
        }
        var gb = e.target.closest ? e.target.closest("[data-group]") : null;
        if (gb && !gb.disabled) {
          state.hl.group = !state.hl.group;
          hlSchreiben();
          elHlPop.innerHTML = hlMenuHtml();
          renderBody();
        }
      });
    }

    /* ---- Citations ------------------------------------------------------------------------ */
    function favOf(c) {
      if (c && c.favicon) return String(c.favicon);
      try { return "https://www.google.com/s2/favicons?domain=" + new URL(c.url).hostname + "&sz=128"; }
      catch (e) { return ""; }
    }
    function domainOf(c) {
      if (c && c.domain) return String(c.domain);
      try { return new URL(c.url).hostname.replace(/^www\./i, ""); } catch (e) { return ""; }
    }
    /* Ein Titel, der nur die URL wiederholt, ist kein Titel -- dann steht die Anzeigeform der URL
       da, die wenigstens lesbar ist. Kommt bei google.com/searchviewer-Quellen vor. */
    function titelOf(c) {
      var t = String((c && c.title) || "").trim();
      var u = String((c && c.url) || "").trim();
      if (!t || t === u) return UC.rbShowUrl(u);
      return t;
    }
    /* Die Beschreibungen der RPC tragen teils den Titel und angehaengte Rohdaten ("— title: ...").
       Der Teil ab dem Gedankenstrich mit "title:" dahinter ist Schrott und wird abgeschnitten. */
    function descOf(c) {
      var d = String((c && c.description) || "").trim();
      var i = d.indexOf("— title:");
      if (i > 0) d = d.slice(0, i).trim();
      return d;
    }

    function nenntEigene(c) {
      return (isArr(c && c.mentions) ? c.mentions : []).some(function (m) { return m && m.role === "own"; });
    }

    /* Der Wert, den ein Klick auf eine Quelle nach Bubble traegt: die URL, unveraendert wie sie
       in den Daten steht. Sie ist der Primaerschluessel -- eine eigene id fuer eine URL gibt es
       nicht, und citations fuehrt auch kein Feld id.
       Hier stand vorher c.id mit Vorrang. Das war als Vorsorge gemeint fuer den Tag, an dem die
       RPC eine id liefert, war aber eine Falle: taucht dort irgendwann ein Feld id auf, das
       etwas anderes bezeichnet als die URL, feuert die Komponente still den falschen Schluessel
       und niemand sieht warum. Ein Schluessel, kein Vielleicht. */
    function quellWert(c) {
      return String((c && c.url) || "");
    }

    function renderCites() {
      var leer = state.fehler ? esc(state.fehler) : null;
      if (leer) { elGrid.innerHTML = '<span class="urd-empty">' + leer + "</span>"; elList.innerHTML = ""; return; }
      if (istLaden() || !state.data) {
        elGrid.innerHTML = "xxxx".split("").map(function () {
          return '<span class="urd-sk urd-sk-card"></span>';
        }).join("");
        elList.innerHTML = "";
        spaltenSetzen(4);
        return;
      }
      var alle = (isArr(state.data.citations) ? state.data.citations : []).filter(function (c) {
        return c && c.url;
      });
      /* Die Nummer ist die Stelle in der UNgefilterten Liste: sie bleibt dieselbe, wenn der
         Marken-Filter Quellen ausblendet, und ist dieselbe wie am Zitat im Text (respBody nummern). */
      function nr(c) { return '<span class="urd-nr">' + (alle.indexOf(c) + 1) + "</span>"; }
      /* Der Filter arbeitet nur hier, auf den Daten, die schon da sind -- kein neuer Aufruf, kein
         Ereignis nach Bubble. "ja" zeigt die Quellen, die die eigene Marke nennen, "nein" die
         anderen, leer alle. */
      var liste = state.brandFilter === "yes"
        ? alle.filter(function (c) { return nenntEigene(c); })
        : state.brandFilter === "no"
          ? alle.filter(function (c) { return !nenntEigene(c); })
          : alle;
      if (!liste.length) {
        /* Mit aktivem Filter ist "keine Quellen" die falsche Aussage: es gibt welche, sie passen
           nur nicht. Sonst sucht man den Fehler in den Daten statt im Schalter. */
        var txt = state.brandFilter
          ? "No citations match this filter."
          : "No citations for this response.";
        elGrid.innerHTML = '<span class="urd-empty">' + txt + "</span>";
        elList.innerHTML = '<span class="urd-empty">' + txt + "</span>";
        spaltenSetzen(1);
        return;
      }

      elGrid.innerHTML = liste.map(function (c) {
        var fav = favOf(c), dom = domainOf(c), desc = descOf(c);
        return '<div class="urd-cite-card" role="button" tabindex="0" data-url="' +
                 esc(quellWert(c)) + '" data-href="' + esc(String(c.url)) + '">' +
                 '<div class="urd-cc-head">' + nr(c) +
                   (fav ? '<img class="urd-cc-fav" src="' + esc(fav) + '" alt="" loading="lazy"' +
                          ' referrerpolicy="no-referrer" onerror="this.remove()"/>' : "") +
                   /* Die Domain ist ein eigenes Ziel: sie fuehrt zur Domain-Detailseite, die
                      Karte zur URL. Der Klick darf also nicht bis zur Karte durchlaufen. */
                   '<span class="urd-cc-domain" role="button" tabindex="0" data-domain="' +
                     esc(dom) + '">' + esc(dom) + "</span>" +
                 "</div>" +
                 '<div class="urd-cc-title">' + esc(titelOf(c)) + "</div>" +
                 (desc ? '<div class="urd-cc-desc">' + esc(desc) + "</div>" : '<div class="urd-cc-desc"></div>') +
                 '<div class="urd-cc-foot">' + UC.brandStack(c.mentions, null, { max: 12 }) + "</div>" +
               "</div>";
      }).join("");

      elList.innerHTML = liste.map(function (c) {
        var fav = favOf(c);
        return '<div class="urd-cite-row" role="button" tabindex="0" data-url="' +
                 esc(quellWert(c)) + '" data-href="' + esc(String(c.url)) + '">' + nr(c) +
                 (fav ? '<img class="urd-cr-fav" src="' + esc(fav) + '" alt="" loading="lazy"' +
                        ' referrerpolicy="no-referrer" onerror="this.remove()"/>' : "") +
                 '<span class="urd-cr-txt">' +
                   '<span class="urd-cr-title">' + esc(titelOf(c)) + "</span>" +
                   '<span class="urd-cr-domain" role="button" tabindex="0" data-domain="' +
                     esc(domainOf(c)) + '">' + esc(domainOf(c)) + "</span>" +
                 "</span>" +
                 /* max 12 wie im Gitter: wie viele davon wirklich stehen, entscheidet stackFit
                    am Platz -- der Vorrat muss nur gross genug sein. */
                 '<span class="urd-cr-ments">' + UC.brandStack(c.mentions, null, { max: 12 }) + "</span>" +
               "</div>";
      }).join("");

      spaltenSetzen(liste.length);
      markenPassen();
    }

    /* Die Marken im Fuss einer Kachel: so viele, wie neben dem freien Rand Platz haben, der Rest
       als "+N". UC.stackFit misst das nach dem Einfuegen -- vorher stehen die echten Breiten nicht
       fest, und sie haengen an der Spaltenzahl, die selbst an der Breite haengt.
       32px bleiben links frei (Vorgabe), damit die Chips nicht bis an die Kante des Titels
       darueber heranlaufen. */
    var MARKEN_RESERVE = 32;
    /* 8px: der Rand rechts an .urd-cr-ments, der den Strich fuer "keine Marke" mittig unter die
       Logospalte setzt. Er gehoert nicht zum Platz der Chips. */
    var LISTE_RESERVE = 8;
    function markenPassen() {
      if (!UC.stackFit) return;
      [].forEach.call(elGrid.querySelectorAll(".urd-cc-foot .up-stack"), function (st) {
        UC.stackFit(st, { reserve: MARKEN_RESERVE });
      });
      /* Auch in der Liste: so viele Chips wie Platz ist. Die 64px Luft zum Titel stehen NICHT
         hier, sondern als Rand in der CSS -- strukturell, damit sie auch dann gilt, wenn stackFit
         gar nicht laeuft. Der Behaelter ist auf die Haelfte der Zeile begrenzt, also misst
         stackFit gegen diese Grenze und kuerzt von hinten, bis es passt. */
      [].forEach.call(elList.querySelectorAll(".urd-cite-row"), function (zeile) {
        var st = zeile.querySelector(".urd-cr-ments .up-stack");
        if (!st) return;
        /* Die Haelfte der Zeile ist die Obergrenze aus der CSS (max-width: 50%). Ausdruecklich
           mitgegeben, weil der Behaelter seine Breite vom Inhalt nimmt und clientWidth dort den
           letzten Stand misst statt den Platz. */
        UC.stackFit(st, { space: Math.floor(zeile.clientWidth / 2), reserve: LISTE_RESERVE });
      });
    }

    function spaltenSetzen(anzahl) {
      /* Eine abgehaengte Wurzel (Bubble hat das Element neu gebaut) bekommt nie wieder eine
         Breite -- ohne diese Zeile liefe der Nachversuch darunter fuer sie alle 100ms, fuer immer. */
      if (root.isConnected === false) return;
      var b = root.clientWidth || 0;
      if (!b) { setTimeout(function () { spaltenSetzen(anzahl); }, 100); return; }
      elGrid.style.setProperty("--urd-cols", String(spalten(b, anzahl)));
    }

    function syncSeg() {
      [].forEach.call(elSeg.querySelectorAll("[data-view]"), function (b) {
        b.classList.toggle("is-active", b.getAttribute("data-view") === state.view);
      });
      root.classList.toggle("is-listview", state.view === "list");
    }

    function istLaden() { return !!state.loading; }

    /* Was im UI steht, wenn die RPC nicht antworten konnte (get_mention_detail_v8 meldet
       mention_not_found, wenn es den Lauf nicht gibt oder er nicht zum Team gehoert). Ohne Code:
       die Nutzlast liess sich nicht lesen. */
    function fehlerText(code) {
      var c = String(code || "").trim();
      if (!c) return "The response data could not be read.";
      if (c === "mention_not_found") return "This response could not be found.";
      if (/^team_access_/.test(c) || c === "forbidden" || c === "not authenticated") return "Your team doesn't have access right now.";
      return "This response could not be loaded. Please try again.";
    }

    /* EINBLENDEN (v2): einmal je neuer Antwort, nicht bei jedem Neuzeichnen -- die Abschnitte
       kommen nacheinander herein (CSS .is-einblenden). Nach dem Ende wieder weg, sonst liefe die
       Animation bei jedem Wechsel einer Klasse am Root erneut an. */
    var einblendUhr = null;
    function einblenden() {
      root.classList.remove("is-einblenden");
      void root.offsetWidth;
      root.classList.add("is-einblenden");
      if (einblendUhr) clearTimeout(einblendUhr);
      einblendUhr = setTimeout(function () { root.classList.remove("is-einblenden"); }, 700);
    }

    function render() {
      syncSeg();
      renderBrandFilter();
      renderHead();
      renderAbsender();
      renderMents();
      renderShop();
      renderBody();
      renderCites();
    }

    /* ---- Klicks --------------------------------------------------------------------------- */
    root.addEventListener("click", function (e) {
      if (!e.target.closest) return;

      /* aus -> ja -> nein -> aus, dieselbe Reihenfolge wie in urls-table. Kein Ereignis nach
         Bubble: der Filter braucht keine neuen Daten. */
      var bt = e.target.closest(".urd-brandtoggle");
      if (bt) {
        state.brandFilter = state.brandFilter === "" ? "yes" : (state.brandFilter === "yes" ? "no" : "");
        syncBrandKlassen();
        renderCites();
        persist();
        return;
      }

      var v = e.target.closest("[data-view]");
      if (v && elSeg.contains(v)) {
        var k = v.getAttribute("data-view");
        if (k === state.view) return;
        state.view = k; viewSchreiben(instanceId, k);
        syncSeg();
        /* Die Spaltenzahl haengt an der Kachelmenge und muss nach dem Umschalten neu stehen:
           im Listenmodus ist das Raster verborgen und meldet Breite 0. */
        if (k === "grid" && state.data) { spaltenSetzen((state.data.citations || []).length); markenPassen(); }
        /* Ein Wert, also roh: "grid" oder "list". Vorher { view: "grid" } -- eine Huelle um einen
           einzigen Wert, die in Bubble eine Extraktion kostete, die nichts extrahiert. */
        fire("data-view-fn", "urdView", k);
        return;
      }

      /* Ein Zitat-Chip im Antworttext feuert direkt -- wie eine Quellenkachel unten. Vorher stand
         hier ein Menue mit "Open detail page" und der URL; zwei Klicks fuer eine Sache, und die
         Wahl war keine: die Detailseite kann alles, was das externe Fenster kann. */
      var chip = e.target.closest(".up-rb-cite");
      if (chip && elBody.contains(chip)) {
        /* Direkt aufmachen, kein Ereignis. data-rb-url traegt die Adresse unveraendert --
           data-rb-cite waere die bereinigte Form ohne utm-Parameter und ohne Raute, und die
           fuehrt unter Umstaenden auf eine andere Seite als die, auf die das Modell zeigt. */
        urlOeffnen(chip.getAttribute("data-rb-url") || chip.getAttribute("data-rb-cite") || "");
        return;
      }
      /* Eine Gruppe mehrerer Quellen: Klick oeffnet ihre Liste (auf dem Telefon gibt es kein
         Hover, dort ist der Klick der einzige Weg hinein). */
      var g = e.target.closest(".up-rb-cgroup");
      if (g && elBody.contains(g)) {
        if (glistFuer === g) glistSchliessen(); else glistOeffnen(g);
        return;
      }
      /* Eine Markenauszeichnung im Antworttext. */
      var bchip = e.target.closest(".up-rb-brand");
      if (bchip && elBody.contains(bchip)) {
        markeFeuern(bchip.getAttribute("data-rb-brand"));
        return;
      }
      /* Ein Produkt im Text: zu seiner Karte. */
      var pm = e.target.closest(".urd-pmark");
      if (pm) { zuDenProdukten(); return; }
      /* Eine Produktkarte. */
      var pc = e.target.closest(".urd-pc[data-product]");
      if (pc) { produktOeffnen(pc.getAttribute("data-product")); return; }
      /* Eine Marke in der Zeile "Mentioned". */
      var m = e.target.closest(".urd-ment");
      if (m) { markeFeuern(m.getAttribute("data-brand")); return; }
      /* Die Domain ZUERST pruefen -- sie liegt in der Kachel, und der Klick auf sie meint die
         Domain, nicht die URL. */
      var dm = e.target.closest("[data-domain]");
      if (dm) {
        fireOderDrawer("data-domain-fn", "urdDomain", "domain", dm.getAttribute("data-domain") || "");
        return;
      }
      /* Eine Quelle, als Kachel oder als Zeile. */
      var q = e.target.closest(".urd-cite-card, .urd-cite-row");
      if (q) { quelleFeuern(q); return; }
      /* Der Prompt-Titel. */
      if (e.target.closest(".urd-prompt")) {
        fireOderDrawer("data-prompt-fn", "urdPrompt", "prompt", elPrompt.getAttribute("data-id") || "");
        return;
      }
    });

    /* Tastatur: was mit der Maus geht, muss auch mit Enter und Leertaste gehen -- role=button
       allein macht ein span noch nicht bedienbar. */
    root.addEventListener("keydown", function (e) {
      /* .urd-brandtoggle steht absichtlich NICHT in der Liste: es ist ein echtes <button>, dort
         loest der Browser den Klick selbst aus -- ein zweiter von hier wuerde den Filter um zwei
         Stufen weiterdrehen. */
      if (e.key !== "Enter" && e.key !== " " && e.key !== "Spacebar") return;
      var z = e.target.closest ? e.target.closest(
        ".urd-prompt, .urd-ment, .urd-cite-card, .urd-cite-row, .up-rb-cite, .up-rb-brand, " +
        ".up-rb-cgroup, .urd-pmark, [data-domain]") : null;
      if (!z) return;
      e.preventDefault();
      z.click();
    });

    /* ---- ZIELE OEFFNEN IHREN DRAWER SELBST (05.10.) ------------------------------------------
       Gemeldet: "kann die Komponente alle Drawer-Oeffnungen selber machen? brand, domain, prompt,
       url -- damit ich dafuer keine JS-Events mehr in Bubble brauche". Ja: UC.drawerOeffnen ruft
       openDrawer(art, id) wie die Host-App, und die meldet das Oeffnen selbst an
       bubble_fn_drawer_<art> -- dort laedt der Workflow des Ziel-Drawers seine Daten wie immer.
       Die Kennungen sind die der anderen Komponenten: brand = company_id, domain = Name,
       url = Adresse, prompt = prompt_id.
       IST IN BUBBLE NOCH EIN EMPFAENGER DA (urdBrand, urdUrl, ...), entscheidet weiter er: sonst
       liefe beim Umstellen beides, und der Drawer ginge zweimal auf. Wer das JavaScriptToBubble-
       Element loescht, bekommt den direkten Weg. Ohne openDrawer auf der Seite bleibt das Ereignis
       -- dann sagt makeFire in der Konsole, dass niemand zuhoert.
       Der Name beginnt mit "fire", und die Aufrufe tragen Attribut und Ereignis woertlich: so
       findet .contract_snapshot.py die vier Ereignisse weiter (es sucht Aufrufe, deren Name mit
       fire beginnt, mit Attribut und Ereignis als erste zwei Zeichenketten). */
    function fireOderDrawer(attrName, ereignis, art, wert) {
      wert = String(wert == null ? "" : wert).trim();
      if (!wert) return;
      var fnName = (root.getAttribute(attrName) || "").trim() || ("bubble_fn_" + ereignis);
      if (typeof window[fnName] !== "function" && typeof window.openDrawer === "function" && UC.drawerOeffnen) {
        UC.drawerOeffnen(art, wert, "response-detail");
        return;
      }
      fire(attrName, ereignis, wert);
    }
    function markeFeuern(id) {
      if (id) fireOderDrawer("data-brand-fn", "urdBrand", "brand", id);
      else if (window.console) console.warn("[response-detail] Marke ohne company_id -- " +
        "kein Ziel. Liefert die RPC company_id in companies mit?");
    }
    function quelleFeuern(el) {
      fireOderDrawer("data-url-fn", "urdUrl", "url", el.getAttribute("data-url") || "");
    }
    /* Die Zitate IM FLIESSTEXT sind etwas anderes als der Abschnitt "Citations" darunter: sie
       stehen nur im Antworttext des Modells und haben keine Zeile in der Datenbank. Ein Ereignis
       nach Bubble zielte dort ins Leere -- also oeffnet der Klick die Adresse direkt. Der
       Abschnitt "Citations" bleibt unberuehrt und feuert weiter urdUrl.
       noopener,noreferrer wie ueberall sonst im Haus: das neue Fenster darf weder an
       window.opener noch an den Verweis auf die Herkunft. */
    function urlOeffnen(u) {
      var wert = String(u || "").trim();
      if (!wert) return;
      /* Ohne Schema loeste der Browser die Adresse relativ zur Bubble-Seite auf. */
      if (!/^https?:\/\//i.test(wert)) wert = "https://" + wert;
      try { window.open(wert, "_blank", "noopener,noreferrer"); } catch (e) {}
    }

    /* ---- Thema ---------------------------------------------------------------------------- */
    if (UC.onTheme) UC.onTheme(function (dunkel) {
      isDark = !!dunkel;
      if (isDark) root.setAttribute("data-theme", "dark"); else root.removeAttribute("data-theme");
      /* Die Themen-Chips tragen ihre Farbe als Inline-Wert (hex_light gegen hex_dark) -- die kann
         die Kaskade nicht umschalten, also muss die Zeile neu gebaut werden. */
      if (state.data) renderHead();
    });

    /* Der Modell-Store kann NACH den Antwortdaten gefuellt werden -- die Reihenfolge zweier
       Workflow-Schritte ist nicht garantiert. Ohne dieses Abonnement blieb im Chip dann der rohe
       Schluessel ("google-aio") ohne Logo stehen, obwohl der Store eine Sekunde spaeter alles
       hatte. Jetzt kommt Logo und Anzeigename nach, sobald sie da sind, und die Reihenfolge ist
       gleichgueltig. owner=root, damit das Abonnement mit dem Element verschwindet. */
    if (UC.onModels) UC.onModels(function () {
      if (!state.data) return;
      renderHead();
      renderAbsender();
      /* Der Name in der Leiste traegt den Modellnamen -- der kommt erst mit dem Store. */
      topbarFuellen();
    }, root);

    /* ---- DIE LEISTE UEBER DEM DRAWER (05.10.) ------------------------------------------------
       Gemeldet: "der selbe Step soll automatisch noch die Topbar fuellen, ich kann ja jetzt nicht
       mehr einzelne Dinger referenzieren" -- get_mention_detail_v8 kommt als EIN Text, Bubble hat
       keine Felder mehr fuer "name" oder "item_id". Diese Komponente hat sie aber, also fuellt sie
       die Leiste selbst: Typ response, Name "<Modell>, <Datum>" (wie in der Vorlage der Leiste),
       Kennung prompt_run_id.
       WELCHE Leiste: data-topbar am Element nennt ihre Instanz; ohne Angabe die drawer-topbar
       (.utb-root) im selben Drawer. Gefuellt wird ueber ihren oeffentlichen Setter -- die Leiste
       bleibt Herrin ihres Zustands. Steht sie noch nicht im Dokument (Bubble baut sie spaeter),
       wird ein paar Mal nachgesehen. */
    function topbarInstanz() {
      var eigen = (root.getAttribute("data-topbar") || "").trim();
      if (eigen) return document.querySelector('.utb-root[data-instance="' + eigen.replace(/"/g, "") + '"]') ? eigen : "";
      var drawer = root.closest ? root.closest('[id^="drawer-"], [id^="content-"]') : null;
      var leiste = drawer ? drawer.querySelector(".utb-root[data-instance]") : null;
      if (!leiste && drawer && drawer.id.indexOf("content-") === 0) {
        var aussen = document.getElementById("drawer-" + drawer.id.slice(8));
        leiste = aussen ? aussen.querySelector(".utb-root[data-instance]") : null;
      }
      return leiste ? leiste.getAttribute("data-instance") : "";
    }
    function modellName(key) {
      var chip = document.createElement("div");
      chip.innerHTML = UC.modelChip(key, { full: true });
      var n = chip.querySelector(".up-ment-name");
      return n ? n.textContent : String(key || "");
    }
    var topbarUhr = null;
    function topbarFuellen(versuch) {
      if (topbarUhr) { clearTimeout(topbarUhr); topbarUhr = null; }
      if (root.isConnected === false || typeof window.setDrawerTopbar !== "function") return;
      var id = topbarInstanz();
      if (!id) {
        /* Zehnmal im Abstand von 200ms: die Leiste kann nach den Daten erst entstehen. */
        if ((versuch || 0) < 10) topbarUhr = setTimeout(function () { topbarFuellen((versuch || 0) + 1); }, 200);
        return;
      }
      if (istLaden()) { if (window.resetDrawerTopbar) window.resetDrawerTopbar(id); return; }
      var d = state.data;
      if (!d) {
        /* Fehler: die Leiste soll nicht im Skelett haengen bleiben -- ein Strich statt eines Namens. */
        window.setDrawerTopbar(id, { type: "response", name: "\u2013" });
        return;
      }
      var name = [d.model ? modellName(d.model) : "", d.run_at && UC.fmtDate ? UC.fmtDate(d.run_at) : ""]
        .filter(Boolean).join(", ");
      /* prompt_id: damit das Zap der Leiste ("zum Prompt") den Prompt-Drawer selbst oeffnen kann. */
      window.setDrawerTopbar(id, { type: "response", name: name || "\u2013",
        item_id: String(d.prompt_run_id || d.id || ""), market: String(d.market || ""),
        prompt_id: String(d.prompt_id || "") });
    }

    /* Die Spaltenzahl haengt an der Breite der eigenen Box. */
    if (UC.onResize) UC.onResize(root, function () {
      if (state.data && state.view === "grid") { spaltenSetzen((state.data.citations || []).length); markenPassen(); }
      glistSchliessen();
      mentionsZeile();
      if (produktListe.length) shopRand();
    });

    render();

    /* Trug das Element einen JSON-Block, wird er jetzt verwendet -- dann braucht es fuer den
       ersten Aufbau ueberhaupt keinen Run-JS-Schritt. Bubble setzt den dynamischen Ausdruck
       einfach als Inhalt des Blocks; dort ist jedes Zeichen erlaubt. */
    if (eigenerPayload) {
      setTimeout(function () { ctrl.set(mitgeliefert); }, 0);
    }

    var ctrl = {
      set: function (payload, fehler) {
        /* get_mention_detail_v8 (05.10.): EIN Objekt im Umschlag {"json": "<Text>"}; v7 lieferte
           eine Liste mit einem Eintrag. UC.bubbleObjekt nimmt beides, packt den Umschlag aus und
           liest mit readBubble -- dem einen Leseweg der App (parseLoose scheitert an Emoji).
           source_product_id kann groesser sein als Number.MAX_SAFE_INTEGER und wird VOR dem Lesen
           zu Text, falls sie doch einmal ohne Anfuehrungszeichen kommt. */
        var p = UC.bubbleObjekt ? UC.bubbleObjekt(payload, { grosseIds: ["source_product_id"] })
          : (UC.readBubble ? UC.readBubble(payload) : payload);
        if (isArr(p)) p = p.length ? p[0] : null;
        var ok = p && typeof p === "object" && (p.prompt_text != null || p.response_json || p.id);
        /* Der dritte Wert ist Bubbles "error body". Er zaehlt NUR ohne lesbare Antwort -- was
           Bubble bei Erfolg dort hinschreibt, darf eine richtige Antwort nie verdraengen. */
        var code = !ok && UC.bubbleFehler ? UC.bubbleFehler(fehler) : "";
        var neu = !!ok && (state.loading || !state.data || String(state.data.id || "") !== String(p.id || ""));
        state.fehler = ok ? null : fehlerText(code);
        state.data = ok ? p : null;
        state.hasData = !!ok;
        state.loading = false;
        mentionsOffen = false;
        warteBeenden();
        render();
        if (neu) einblenden();
        topbarFuellen();
        persist();
        return true;
      },
      setLoading: function (v) {
        state.loading = isYes(v);
        /* Dieselbe Regel wie in domain-detail: loading = yes heisst KEINE Daten zeigen, also
           werden die alten weggeworfen. Sonst kann ein verzoegertes Neuzeichnen sie zurueckholen,
           und dann stand die Antwort der vorigen Ausfuehrung unter dem neuen Prompt. */
        if (state.loading) {
          state.data = null; state.hasData = false; state.fehler = null;
          warteStarten();
          /* Mit dem Inhalt geht auch die Leiste ins Skelett -- sonst stuende dort der Name der
             vorigen Antwort ueber dem Skelett der neuen. */
          topbarFuellen();
        } else warteBeenden();
        render();
        /* Auch im Speicher weggeworfen -- ein Neuaufbau ist genau so ein spaeteres Neuzeichnen. */
        persist();
        return true;
      },
      reset: function () {
        /* WARTEN, NICHT "LEER" (05.10.). Gemeldet: "oeffnet beim ersten Aufruf mit 'Keine Daten'
           und ohne Skelett". Ein Reset kommt im Drawer-Workflow VOR den neuen Daten -- und mit
           loading = false stand bis zu ihrer Ankunft in jedem Abschnitt der Leerzustand. Nach
           einem Reset kommt die naechste Antwort; bis dahin das Skelett, und die Warte-Uhr sorgt
           dafuer, dass "kommt gleich" nach 25s endet. */
        state.data = null; state.hasData = false; state.fehler = null; state.loading = true;
        /* Die Ansicht bleibt, wie der Nutzer sie gestellt hat -- sie ist eine Einstellung, keine
           Daten. Sie hier auf Grid zu zwingen hiesse, sie bei jedem Reset zu ueberschreiben und
           die Speicherung damit wieder aufzuheben. */
        state.brandFilter = "";
        warteStarten();
        glistSchliessen();
        render();
        /* Der geleerte Stand ersetzt den gemerkten, Marken-Filter eingeschlossen. */
        persist();
        return true;
      }
    };
    root.__urdController = ctrl;
    if (spaet && spaet.drain) spaet.drain(instanceId, ctrl);
    return ctrl;
  }

  /* Aufrufe, deren Instanz noch nicht im Dokument steht, warten hier und werden nachgeholt --
     ohne das verpuffte ein Setter, der eine Sekunde zu frueh kam, still. */
  var spaet = UC.makeLate ? UC.makeLate("response-detail", ".urd-root") : null;

  var mount;
  mount = UC.makeMount({
    onMount: function (m) { mount = m; },
    rootClass: "urd-root", notPortal: true,
    /* IM LADEZUSTAND AUF DIE WELT KOMMEN (02.10.). Gemeldet: "oft ist das allererste Oeffnen ohne
       Ladestate -- die Komponente soll bei Pageload im Ladestate spawnen". makeMount baut eine
       Wurzel, die der Browser nicht zeichnet, sonst absichtlich NICHT (das Parken in core). Im
       geschlossenen Drawer stand diese hier darum leer, bis der Drawer aufging oder der erste
       Setter kam -- kamen die Daten schnell, sah man nie ein Skelett. Gemessen im Pruefstand
       urd01: HEAD ungebaut bis zum Setter, jetzt gebaut mit 27 Skelett-Teilen vor dem Oeffnen,
       ob die Wurzel vor dem Skript steht oder 500ms danach kommt. Die Warte-Uhr laeuft verdeckt
       nur im Sekundentakt (verdecktWarten) und meldet erst bei offenem Drawer. */
    auchVerdeckt: true,
    ctrlProp: "__urdController",
    resolveLocal: "__urdResolveLocal",
    queue: "__urdBootQueue",
    initRoot: initRoot,
    api: {
      /* (instanz, json, fehler): json ist das Feld json des Umschlags, fehler Bubbles "error body"
         (get_mention_detail_v8). Mit zwei Werten wie bisher. */
      setResponseDetail:        function (id, p, f) { return each(id, function (c) { c.set(p, f); }); },
      /* Den Payload aus einem DOM-Element lesen statt ihn in JS-Quelltext zu setzen. Das ist der
         Weg fuer alles, was echte Zeilenumbrueche, Anfuehrungszeichen oder Backticks enthaelt --
         also fuer jeden Antworttext. Im Quelltext eines Run-JS-Schritts ist so ein Text nicht
         unterzubringen: "..." vertraegt keinen Umbruch, `...` keine Backticks. Im Inhalt eines
         Elements ist jedes Zeichen erlaubt.
         Bubble fuellt dazu ein Textelement oder ein <script type="application/json"> mit dem
         dynamischen Ausdruck; dieser Setter bekommt nur den Selektor. */
      setResponseDetailFrom:    function (id, sel) {
        var el = null;
        try { el = sel ? document.querySelector(String(sel)) : null; } catch (e) { el = null; }
        if (!el) {
          if (window.console) console.warn('[response-detail] setResponseDetailFrom: kein Element ' +
            'zu "' + sel + '" gefunden. Steht es auf der Seite und ist der Selektor richtig?');
          return false;
        }
        var roh = el.textContent == null ? "" : String(el.textContent);
        if (!roh.trim()) {
          if (window.console) console.warn('[response-detail] setResponseDetailFrom: "' + sel +
            '" ist leer. Traegt es den dynamischen Ausdruck?');
          return false;
        }
        return each(id, function (c) { c.set(roh); });
      },
      setResponseDetailLoading: function (id, v) { return each(id, function (c) { c.setLoading(v); }); },
      resetResponseDetail:      function (id)    { return each(id, function (c) { c.reset(); }); }
    }
  });

  function each(id, fn) {
    var roots = mount.rootsWithId(String(id == null ? "default" : id).trim());
    if (!roots.length) {
      if (spaet) return spaet.park(id == null ? "default" : id, fn);
      return false;
    }
    roots.forEach(function (r) { var c = initRoot(r); if (c) fn(c); });
    return true;
  }

  /* ---- ZU HEISST: DAS NAECHSTE OEFFNEN BEGINNT MIT DEM SKELETT (01.10.) ---------------------
     Gemeldet: "manchmal gibt es keinen Loading-State, nur 'Keine Daten' und kein einziges
     Skelett". Der Lade-Schritt haengt am Oeffnen-Ereignis des Drawers, und das ruft die Host-App
     erst NACH ihrer Einblendung -- in der Zeitleiste vom 30.09. 200 bis 450ms nach openDrawer,
     beim ersten Oeffnen eines Drawers ohne Kalender 700ms. Bis dahin zeigte der Drawer, was beim
     letzten Schliessen darin stand: die vorige Antwort, oder das "No data" einer Warte-Uhr, die
     im geschlossenen Drawer abgelaufen war.
     Also wechselt die Komponente schon beim SCHLIESSEN ihres Drawers in den Ladezustand -- so vom
     Nutzer vorgeschlagen. Es ist dasselbe, was der Lade-Schritt beim Oeffnen ohnehin tut, nur
     frueher: die Daten kommen bei jedem Oeffnen neu.
     WELCHER Drawer zugeht, steht nicht sicher im Aufruf (closeDrawer() ohne Namen schliesst den
     obersten), und die Ids der Host-App gehoeren nicht in eine Komponente. Also gemessen: eine
     Wurzel, die beim Schliessen zu sehen war und danach nicht mehr, sass in dem Drawer, der
     zuging. core meldet das Schliessen VOR dem Original, die Wurzel ist in dem Moment also noch zu
     sehen. Eine Wurzel in einer Ansicht bleibt zu sehen oder war es gar nicht -- beides laesst sie
     in Ruhe. 450ms: visibility:hidden steht nach rund 200ms (Zeitleiste vom 30.09.). Geht der
     Drawer in der Zeit wieder auf, ist die Wurzel wieder zu sehen und bleibt, wie sie ist. */
  if (UC.onDrawerClose && !window.__urdZuAngemeldet) {
    window.__urdZuAngemeldet = true;
    UC.onDrawerClose(function () {
      var offen = [].filter.call(document.getElementsByClassName("urd-root"), function (r) {
        return !!r.__urdController && UC.istSichtbar(r);
      });
      if (!offen.length) return;
      setTimeout(function () {
        offen.forEach(function (r) {
          if (r.isConnected === false || !r.__urdController || UC.istSichtbar(r)) return;
          r.__urdController.setLoading("yes");
        });
      }, 450);
    });
  }

  /* ---- AUF HEISST: SKELETT, BIS DIE ANTWORT DA IST (05.10.) ------------------------------------
     Das Gegenstueck zum Schliessen oben. Vor dem ERSTEN Oeffnen gab es kein Schliessen, das den
     Ladezustand haette setzen koennen -- stand in der Zwischenzeit etwas anderes im Zustand (ein
     Reset, ein "no" an setResponseDetailLoading aus dem Seitenaufbau), oeffnete der Drawer mit
     dem Leerzustand. Die Antwort kommt nach jedem Oeffnen neu (bubble_fn_drawer_<art> laeuft erst
     240ms NACH openDrawer), also ist alles, was beim Oeffnen darin steht, ohnehin veraltet.
     Betroffen sind nur Wurzeln IN dem Drawer, der aufgeht (#drawer-<art> / #content-<art>). */
  if (UC.onDrawerOpen && !window.__urdAufAngemeldet) {
    window.__urdAufAngemeldet = true;
    UC.onDrawerOpen(function (art, id) {
      art = String(art == null ? "" : art).trim();
      /* Ohne Kennung meldet die Host-App das Oeffnen nicht an Bubble -- dann kommen auch keine
         neuen Daten, und was drinsteht, muss stehen bleiben. */
      if (!art || id == null || String(id) === "") return;
      [].forEach.call(document.getElementsByClassName("urd-root"), function (r) {
        if (!r.__urdController || r.isConnected === false) return;
        if (!r.closest('[id="drawer-' + art + '"], [id="content-' + art + '"]')) return;
        r.__urdController.setLoading("yes");
      });
      /* Baut Bubble das Element beim Aufgehen neu, startet die neue Wurzel aus dem Speicher --
         und dort stand womoeglich das "No data" einer abgelaufenen Uhr, ohne neue Uhr dazu.
         Also auch der Speicher wartet ab jetzt. */
      Object.keys(STORE).forEach(function (k) {
        var e = STORE[k];
        if (!e || e.drawer !== art) return;
        e.data = null; e.hasData = false; e.fehler = null; e.loading = true; e.wartet = true;
      });
    });
  }

  /* Bubble spritzt das Markup neu ein -- ohne das findet ein Setter nach dem Neuaufbau keine
     Wurzel mehr, weil die alte aus dem Dokument verschwunden ist. */
  if (UC.watchRoots) UC.watchRoots("urd-root", function () {
    [].forEach.call(document.querySelectorAll(".urd-root"), initRoot);
  });
  }

  urdBoot(30);
})();
