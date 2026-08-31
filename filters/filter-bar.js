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

   ── Das einzige Ereignis dieser Komponente ──────────────────────────────────
     ufbReset   Reset Filters im Panel ODER Clear All in der Leiste. Beide leeren vorher die
                Auswahl JEDES eingezogenen Filters ueber dessen setSelected("") -- das ist der
                stille Weg (die Filter schicken dann nichts), damit nicht drei Ereignisse und
                dieses vierte gleichzeitig dieselbe Abfrage neu anstossen.

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
       rootSel   Klasse der Filterwurzel
       ctrl      Eigenschaft, unter der der Filter seinen Controller ablegt
       selKey    Feld in getSelected(), das die Auswahl als CSV traegt
       optSel    die angehakte Zeile seiner Liste
       nameSel   der Name darin
       evt       sein aufsteigendes DOM-Ereignis
       chip      Beschriftung des Chips, Einzahl -- "Topic: Leadgen" liest sich als eine Aussage
                 ueber diesen einen Filter, "Topics: Leadgen" als eine Liste, die zufaellig eins
                 lang ist */
  var FILTERS = [
    { key: "topics",  label: "Topics",  attr: "data-topics-instance",  rootSel: ".utf-root",
      ctrl: "__utfCtrl", selKey: "topic_ids",    opt: ".utf-opt", keyAttr: "data-id",
      nameSel: ".utf-opt-name", evt: "utf-topics",  chip: "Topic",  icon: "tags" },
    { key: "models",  label: "Models",  attr: "data-models-instance",  rootSel: ".umf-root",
      ctrl: "__umfCtrl", selKey: "model_keys",   opt: ".umf-opt", keyAttr: "data-key",
      nameSel: ".umf-opt-name", evt: "umf-models",  chip: "Model",  icon: "layers" },
    { key: "markets", label: "Markets", attr: "data-markets-instance", rootSel: ".umk-root",
      ctrl: "__umkCtrl", selKey: "market_codes", opt: ".umk-opt", keyAttr: "data-key",
      nameSel: ".umk-opt-name", evt: "umk-markets", chip: "Market", icon: "mapPin" }
  ];
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

    function initRoot(root) {
      if (root.__ufbCtrl) return root.__ufbCtrl;
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
      function idVon(f) { return String(root.getAttribute(f.attr) || "").trim(); }
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
      function findeWurzel(f) {
        var id = idVon(f);
        var alle = Array.prototype.slice.call(document.querySelectorAll(f.rootSel));
        if (!alle.length) return null;
        var i, rid;
        if (id) {
          for (i = 0; i < alle.length; i++) {
            rid = String(alle[i].getAttribute("data-instance") || "");
            if (rid === id) return alle[i];
          }
          for (i = 0; i < alle.length; i++) {
            rid = String(alle[i].getAttribute("data-instance") || "");
            if (rid && rid.indexOf(id) === 0) return alle[i];
          }
        }
        var frei = alle.filter(function (w) {
          return !(w.__ufbHost && w.__ufbHost !== root && document.contains(w.__ufbHost));
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

      var liste = gewuenscht();

      /* Alles Eingezogene dorthin zurueck, wo es hergekommen ist. Ist der alte Elternteil selbst
         weg (Bubble hat ihn ersetzt), geht es an den Koerper: irgendwo im Dokument ist besser als
         nirgends -- dort findet die naechste Leiste es wieder, und der Filter selbst lebt weiter.
         Ausdruecklich OHNE Beobachter und ohne Automatik hier: gerufen wird das von genau einer
         Stelle, dem Waechter unten, und zwar nur fuer eine Wurzel, die nicht mehr im Dokument
         steht. Mein erster Anlauf hatte daraus einen Mechanismus mit zwei Beobachtern gemacht --
         das Ergebnis war eine stehende Seite. */
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
              '<span class="ufb-btn-lbl">More Filters</span>' +
              '<span class="ufb-btn-chev">' + UC.icon("chevronDown", 2.2) + '</span>' +
            '</button>' +
            '<div class="up-menu ufb-menu" role="menu" aria-hidden="true">' +
              /* Die Zurueck-Zeile gehoert nach OBEN und gibt es nur im Hineingehen -- core
                 blendet sie ueber .is-drill.is-inside ein. */
              '<button class="up-optrow up-subback ufb-row" type="button">' +
                UC.icon("chevronLeft", 2) + '<span class="ufb-back-lbl">Back</span>' +
              '</button>' +
              '<div class="ufb-rows"></div>' +
              '<div class="ufb-div"></div>' +
              '<button class="up-optrow ufb-reset" type="button" data-ufb-reset>' +
                '<span>Reset Filters</span>' +
                '<span class="ufb-reset-x">' + UC.icon("x", 2.2) + '</span>' +
              '</button>' +
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
                     '<span class="ufb-caret">' + UC.icon("chevronRight", 2) + '</span>' +
                   '</button>' +
                   '<div class="up-submenu ufb-sub" data-sub-host="' + esc(f.key) + '"></div>' +
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
          var host = elRows.querySelector('[data-sub-host="' + f.key + '"]');
          if (!host) return;
          var da = eingezogen[f.key];
          if (da && document.contains(da) && da.parentNode === host) return;   /* steht schon */
          var w = findeWurzel(f);
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
        });
        var sichtbar = 0;
        liste.forEach(function (f) {
          var wrap = elRows.querySelector('.up-subwrap[data-sub="' + f.key + '"]');
          if (!wrap) return;
          var leer = !eingezogen[f.key];
          wrap.classList.toggle("is-leer", leer);
          if (!leer) sichtbar++;
        });
        elRows.classList.toggle("is-empty", sichtbar === 0);
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

      /* Der Spiegel: das Innere des Triggers, ohne dessen Chevron. Woertlich uebernommen und nicht
         nachgebaut -- der Filter rendert dort schon "Punkt + Name" bei einer Auswahl und
         "Beschriftung + Zaehler" ab zwei, und das soll in der Zeile genauso stehen. */
      function spiegeln(f) {
        var w = eingezogen[f.key];
        var wrap = elRows.querySelector('.up-subwrap[data-sub="' + f.key + '"]');
        var ziel = wrap && wrap.querySelector("[data-mirror]");
        if (!ziel) return;
        var trig = w && w.querySelector(".utf-trigger, .umf-trigger, .umk-trigger");
        if (!trig) { ziel.innerHTML = '<span class="ufb-mirror-fallback">' + esc(f.label) + "</span>"; return; }
        var teile = [];
        Array.prototype.forEach.call(trig.children, function (c) {
          /* Ihr eigener Chevron bleibt draussen: die Zeile hat ihren eigenen, und der zeigt nach
             rechts (dort kommt das Untermenue heraus) und nicht nach unten.
             Und ihr ZEICHEN ebenso: die Zeile bringt ihr eigenes mit (siehe ufb-row-ic). Der
             Trigger tauscht das Zeichen gegen Logo bzw. Flagge des gewaehlten Eintrags -- in der
             Zeile stand damit ein Modell-Logo statt des Zeichens fuer "Models". Ein SVG als
             direktes Kind ist bei topics das Zeichen, bei models/markets steckt es in
             .umf-trigger-ic / .umk-trigger-ic. */
          if (c.classList && (c.classList.contains("utf-chev") || c.classList.contains("umf-chev") ||
                              c.classList.contains("umk-chev"))) return;
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
        if (!teile.length) { ziel.innerHTML = '<span class="ufb-mirror-fallback">' + esc(f.label) + "</span>"; return; }
        teile.forEach(function (t) { ziel.appendChild(t); });
      }
      function spiegelnAlle() { liste.forEach(spiegeln); }

      /* Der Trigger aendert sich, wenn der Nutzer im Filter etwas anhakt -- der Filter rendert ihn
         dann neu. Ein Beobachter je Filter statt eines Pollings. */
      function spiegelBeobachten(f, w) {
        if (!window.MutationObserver || w.__ufbObs) return;
        var trig = w.querySelector(".utf-trigger, .umf-trigger, .umk-trigger");
        if (!trig) return;
        w.__ufbObs = new MutationObserver(function () { spiegeln(f); render(); });
        w.__ufbObs.observe(trig, { childList: true, subtree: true, characterData: true,
                                   attributes: true, attributeFilter: ["class", "style"] });
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
      function aktiv() { return liste.filter(function (f) { return auswahl(f).length > 0; }); }

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
      function renderChips() {
        var teile = [];
        liste.forEach(function (f) {
          var c = chipText(f);
          if (!c) return;
          teile.push('<span class="ufb-chip" data-chip="' + esc(f.key) + '">' +
            '<span class="ufb-chip-lbl"><span class="ufb-chip-key">' + esc(c.key) + ': </span>' +
            esc(c.wert) + '</span>' +
            '<button class="ufb-chip-x" type="button" data-chip-clear="' + esc(f.key) + '" ' +
              'aria-label="Clear ' + esc(f.label) + ' filter" data-tip="Clear ' + esc(f.label) + '">' +
              UC.icon("x", 2.6) + '</button>' +
          '</span>');
        });
        elChips.innerHTML = teile.join("");
      }

      /* EINE Entscheidung fuer beide Dinge, die von der Seitenbreite abhaengen: bricht die Leiste
         um, und geht das Untermenue hinein statt heraus. Sie steht hier und wird an
         UC.makeSubmenu durchgegeben (cfg.drill) -- zwei Rechnungen aus derselben Zahl laufen
         auseinander, und beim Messen war genau das der Fall: der Kit rechnete mit seiner eigenen
         Kopie von getPageWidth und blieb im Herausfahren, waehrend die Leiste schon umgebrochen
         war. Gemessen an der SEITENbreite und nicht an der eigenen: dieses Element ist in einer
         Werkzeugzeile ohnehin schmal, die Frage ist, wie viel Platz die Seite hat. */
      function schmal() { return UC.getPageWidth() < SCHMAL; }

      /* ---------------- render ---------------- */
      function render() {
        var an = aktiv().length > 0;
        root.classList.toggle("has-filters", an);
        renderChips();
        var eng = schmal();
        root.classList.toggle("is-wrap", eng);
        /* is-drill setzt auch UC.makeSubmenu -- hier noch einmal, damit die Klasse auch dann
           stimmt, wenn das Panel noch nie offen war. Derselbe Wert aus derselben Funktion. */
        elMenu.classList.toggle("is-drill", eng);
        if (sub) sub.sync();
      }

      /* ---------------- Panel ---------------- */
      var pop = UC.makePopover({
        wrap: elMore, menu: elMenu, opener: elBtn, group: "ufb-" + instanceId,
        /* makePopover setzt aria-hidden am Menue, aber nicht aria-expanded am Knopf -- das
           gehoert dem Aufrufer, weil nur er weiss, welches Element der Ausloeser ist. */
        onClose: function () { sub.close(); elBtn.setAttribute("aria-expanded", "false"); }
      });
      elBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        if (pop.isOpen()) { pop.close(false); return; }
        einziehen();
        spiegelnAlle();
        render();
        pop.open();
        /* Kippt an der rechten Fensterkante auf rechts ausgerichtet. Einmal beim Oeffnen, nicht
           beim Scrollen: das Panel ist absolut und wandert mit seinem Knopf mit. */
        elMenu.classList.remove("is-right");
        var r = elMenu.getBoundingClientRect();
        var vw = window.innerWidth || document.documentElement.clientWidth || 0;
        if (r.right > vw - 8) elMenu.classList.add("is-right");
        elBtn.setAttribute("aria-expanded", "true");
      });

      /* ---------------- Untermenue ----------------
         Verweildauer, Feststellen per Klick, Umklappen und das Hineingehen auf schmalen Seiten
         kommen komplett aus UC.makeSubmenu. */
      var sub = UC.makeSubmenu({
        panel: elMenu, rowSel: ".up-subwrap", keyAttr: "data-sub", drill: schmal,
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
          var x = w.querySelector(".utf-search-x, .umf-search-x, .umk-search-x");
          var feld = w.querySelector(".utf-search-in, .umf-search-in, .umk-search-in");
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
      function einenLeeren(key) {
        var f = byKey(key);
        if (!f) return;
        var w = eingezogen[f.key];
        var c = w && w[f.ctrl];
        if (c && typeof c.setSelected === "function") { try { c.setSelected(""); } catch (e) {} }
        spiegeln(f);
        render();
        fire("data-reset-fn", "ufbReset", { action: "clear_one", filter: f.key });
      }
      function alleLeeren() {
        /* Still: jeder Filter bekommt setSelected("") -- das raeumt die Auswahl auf und laesst die
           LISTE stehen (resetXFilter wuerde auch die Liste wegwerfen, das ist der Weg fuer einen
           Team- oder Projektwechsel und hier falsch). Und es schickt nichts: drei Filter-Ereignisse
           plus dieses eine wuerden dieselbe Abfrage viermal anstossen. */
        liste.forEach(function (f) {
          var w = eingezogen[f.key];
          var c = w && w[f.ctrl];
          if (c && typeof c.setSelected === "function") { try { c.setSelected(""); } catch (e) {} }
        });
        spiegelnAlle();
        render();
        fire("data-reset-fn", "ufbReset", { action: "clear_all" });
      }
      root.addEventListener("click", function (e) {
        if (!e.target.closest) return;
        if (e.target.closest("[data-ufb-reset]")) { e.stopPropagation(); alleLeeren(); pop.close(true); return; }
        if (e.target.closest("[data-ufb-clear]")) { alleLeeren(); return; }
        var cx = e.target.closest("[data-chip-clear]");
        if (cx) { einenLeeren(cx.getAttribute("data-chip-clear")); return; }
      });

      /* ---------------- auf Aenderungen der Filter hoeren ----------------
         Ihre eigenen aufsteigenden Ereignisse. Am DOKUMENT und nicht an der Wurzel: die Wurzel
         wandert beim Einziehen, und ein Zuhoerer daran ginge beim naechsten Bubble-Rerender
         verloren. */
      FILTERS.forEach(function (f) {
        document.addEventListener(f.evt, function () { spiegeln(f); render(); }, false);
      });

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

      var ctrl = {
        reset: function () { alleLeeren(); },
        setTheme: function (t) { if (UC.setUpstreemTheme) UC.setUpstreemTheme(t); },
        render: render
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
      var ziel = roots.filter(function (r) {
        var rid = String(r.getAttribute("data-instance") || "default");
        return !id || rid === id || rid.indexOf(String(id)) === 0;
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
          out.push('  Leiste "' + (r.getAttribute("data-instance") || "default") + '": ' +
            f.attr + '="' + id + '"' +
            (!id || /^[A-Z_]{3,}$/.test(id) ? "  -> leer/Platzhalter, also keine Zeile" :
             drin ? "  -> eingezogen" : "  -> NICHT gefunden"));
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
    setInterval(function () { waechter(); initAll(); }, WAECHTER_MS);
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
