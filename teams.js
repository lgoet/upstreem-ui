/* upstreem teams.js — "Teams". Braucht core.js zuerst.

   Alle Teams, in denen der angemeldete Nutzer Mitglied ist, plus der Knopf, mit dem er in eines
   davon wechselt. SEITENKOPF UND TABELLE IN EINEM Element -- die Seite besteht aus dieser einen
   Komponente.

   ── Warum der Seitenkopf hier in JS gebaut wird und nicht in der Bubble-Vorlage ──────────────
   Dieselbe Begruendung wie in prompt-research: bubble/*.html ist eine Vorlage fuer
   NEUINSTALLATIONEN. Was dort steht, erreicht ein bereits eingebautes Element nie -- der Kopf
   waere also einmal richtig und danach nie wieder aenderbar. Aus JS gebaut kommt er mit dem
   CDN-Pin wie jeder andere Fix. Die Klassen sind die des Page-Header-Kits aus core (.up-ph-*),
   also derselbe Block wie auf jeder anderen Seite und kein Zwilling, der beim naechsten
   Feinschliff auseinanderlaeuft.

   ── Was diese Tabelle bewusst NICHT hat ─────────────────────────────────────
   Keine Sortierung, keine Filter, keinen Zeilenklick. Die Reihenfolge ist die Aussage des
   Servers (das eigene Team zuerst), und ein Teamwechsel laedt den ganzen Arbeitsbereich neu --
   das darf nicht durch einen Klick irgendwo in die Zeile passieren. Anklickbar sind genau zwei
   Dinge: der Wechselknopf und der Domainverweis.

   ── Suche und Seiten laufen LOKAL, ohne Bubble ──────────────────────────────
   Ein Nutzer ist in einer Handvoll Teams, und die ganze Liste liegt nach dem ersten Aufruf im
   Browser. Ein Suchereignis an Bubble waere eine Rundreise fuer eine Antwort, die schon da ist
   -- mit allem, was daran schiefgehen kann (fehlender Workflow, Antwort in falscher
   Reihenfolge, Skelett das haengt). Darum filtert und blaettert diese Tabelle selbst. Es gibt
   deshalb KEIN Such- und KEIN Seitenereignis, und auf der Bubble-Seite ist dafuer nichts zu
   bauen.

   ── Die beiden Ereignisse gibt es in der App schon ──────────────────────────
   Der Teamwaehler der Seitenleiste feuert seit je usnTeam {"team_id":"…"} und usnNewTeam
   {"action":"new_team"}. Diese Komponente feuert genau dieselben Nutzlasten und traegt diese
   Namen als Rueckfall -- wer data-switch-fn / data-newteam-fn auf bubble_fn_usnTeam /
   bubble_fn_usnNewTeam zeigt, braucht keinen einzigen neuen Workflow. Ein eigener Workflow geht
   genauso, dann steht ein anderer Name im Attribut.

   ── Was aus core kommt ──────────────────────────────────────────────────────
     Seitenkopf            .up-ph-* (Meta, Ueberschrift, Beschreibung, "+ Create"-Knopf)
     Tabellengeruest       .up-table / .up-thead / .up-row / .up-th / .up-td + UC.makeColumns
     Kopfzeile, Suche      .up-head / UC.makeSearch
     Fuss, Seiten          .up-foot / UC.makePager
     Tarif-Pille           .up-sent (Punkt + Wert)
     Wechselknopf          .up-export (derselbe gefuellte Knopf wie "Export")
     Teamlogo              .up-logo-box + .up-logo-ltr (wie der Teamwaehler der Seitenleiste)
     Skelett, Leerzustand  UC.skeletonRows / .up-empty / UC.leseFehlerHtml
     Tooltips              UC.makeTooltips / UC.makeClipTip
     Bubble-Klempnerei     UC.bootStubs / UC.makeMount / UC.makeFire / UC.makeLate */
(function () {
  "use strict";

  var API_NAMES = ["renderTeams", "setTeamsLoading", "resetTeams"];
  /* Stubs VOR core.js: Bubble ruft die Setter im Page-Load-Workflow, regelmaessig bevor diese
     Datei geladen ist. Ohne Stub ist der Aufruf weg und die Seite sieht aus wie eine ohne Daten,
     ohne dass irgendwo ein Fehler steht. */
  var Q = (window.__utsBootQueue = window.__utsBootQueue || []);
  if (!window.__utsBootStubbed) {
    window.__utsBootStubbed = true;
    API_NAMES.forEach(function (n) { window[n] = function () { Q.push([n, [].slice.call(arguments)]); }; });
  }

  /* Die abschaltbaren MITTELspalten, in der Form die UC.makeColumns erwartet. Die Teamspalte
     davor kommt ueber cfg.firstKey, die Aktionsspalte dahinter baut das Kit selbst
     (cfg.actionsMin).

     `min` MUSS die Untergrenze aus `w` sein und nicht kleiner: das Kit rechnet beim Abwerfen mit
     `min`, das Raster bodenet bei der Zahl aus `w`. Stehen da verschiedene Werte, glaubt die
     Rechnung es passe noch, waehrend die Spuren schon breiter sind als der Kasten (der Fehler ist
     in core.js bei minNarrow beschrieben und in discover-brands mit 5px Ueberlauf gemessen).

     `prio` ist die Abwurfreihenfolge: die KLEINSTE Zahl faellt zuerst. Erst das Datum -- es ist
     die einzige Spalte, die keine Entscheidung stuetzt. Dann die Marken, dann die Prompts. Der
     Tarif bleibt am laengsten: er sagt, warum die Kontingente so aussehen, wie sie aussehen.
     `dropAt: "narrow"` beim Datum ist der Boden fuer diese Absicht -- auf einem schmalen
     Bildschirm nie ein Datum, auch wenn es rechnerisch noch passen wuerde. */
  var COLUMNS = [
    { key: "prompts", label: "Active Prompts", w: "minmax(140px, 0.9fr)", min: 140, prio: 30 },
    { key: "brands",  label: "Active Brands",  w: "minmax(132px, 0.8fr)", min: 132, prio: 20 },
    /* minNarrow 100: mobil bleibt der Tarif die einzige Spalte neben dem Team, und mit 140
       reichte der Platz bei 320px nicht mehr fuer die Aktionsspalte. Die Pille kuerzt dort mit
       Auslassungspunkten (core.css .up-planpill). */
    { key: "plan",    label: "Plan",           w: "minmax(140px, 1fr)",   min: 140, minNarrow: 100, prio: 40 },
    { key: "created", label: "Created",        w: "minmax(120px, 0.8fr)", min: 120, prio: 10, dropAt: "narrow" }
  ];

  /* Breite der Aktionsspalte. Feste Zahlen, keine inhaltsabhaengige Spur: Kopf und Zeilen sind
     getrennte Grid-Container und wuerden ein `auto` verschieden aufloesen -- die Begruendung
     steht in core.js bei applyCols, gemessen wurde es in discover-brands (56 im Kopf, 106 in der
     Zeile, alle Kopfspalten um bis zu 50px verschoben). */
  /* Schmal 80 und nicht 56: in der Zeile des AKTUELLEN Teams steht dort keine Ikone, sondern die
     "Active"-Pille, und die ist gemessen 64px breit. Bei 56 (minus 2x6 Polsterung der Zelle
     bleiben 44) wurde sie um 5px abgeschnitten -- .up-td kappt, es sah also nach einem halben
     Wort aus. Der quadratische Wechselknopf steht in den 80px mittig, das kostet nichts. */
  var ACT_WIDE = 116, ACT_NARROW = 80;

  /* Sperrzeit des Wechselknopfes. Er sperrt beim Klick, weil Bubble danach die halbe Seite neu
     baut; er MUSS sich aber von selbst wieder loesen, sonst hinterlaesst ein Workflow, der nie
     antwortet, einen toten Knopf. 8s ist laenger als jeder gemessene Wechsel und kurz genug,
     dass ein Nutzer es nochmal versuchen kann, ohne neu zu laden. */
  var WECHSEL_FREI_MS = 8000;

  function utsBoot(n) {
    if (!window.UpstreemCore) {
      if (n > 0) { setTimeout(function () { utsBoot(n - 1); }, 100); return; }
      if (window.console) console.error("[teams] UpstreemCore (core.js) not loaded");
      return;
    }
    utsRun();
  }

  function utsRun() {
    var UC = window.UpstreemCore;
    var esc = UC.esc, fmtInt = UC.fmtInt, fmtDate = UC.fmtDate, toNum = UC.toNum;

    /* Laut sagen, WAS fehlt. Ein "undefined is not a function" schickt einen in die falsche
       Datei; der Name des fehlenden Kits zeigt direkt auf den veralteten Pin. */
    var MISSING = ["makeMount", "makeFire", "makeSearch", "makeColumns", "makePager", "makePopover",
                   "makeTooltips", "makeSticky", "makePageHeaderMeta", "widthTiers", "skeletonRows",
                   "leseFehlerHtml", "icon", "esc", "planPilleHtml"]
      .filter(function (k) { return typeof UC[k] !== "function"; });
    if (MISSING.length && window.console) {
      console.error("[teams] Die core.js auf dieser Seite ist AELTER als teams.js, es fehlen: " +
        MISSING.join(", ") + ". Alle Elemente der Seite auf denselben Commit pinnen.");
    }

    /* Tarif-Punkte: seit dem 28.09. in core (UC.planPilleHtml, UC.planFarbe), weil settings-billing
       dieselbe Pille vor dem aktuellen Tarif zeigt. Hier stand die Farbtabelle (Editorial, UGC,
       Knowledge-Base -- Teal, Blau, Indigo); zwei Kopien liefen beim naechsten Tarif auseinander. */

    /* Protokollrelative Adressen ("//cdn…") kommen aus Bubble wirklich vor -- in den Beispiel-
       daten traegt genau ein Team so eine Logo-URL. In einem https-Dokument laedt sie, in einem
       Harness ueber file:// nicht; der Store in core zieht sie darum auf https, und hier
       geschieht dasselbe. Bubble-Platzhalter (LOGO_URL) sind keine Adresse. */
    function bildUrl(v) {
      var s = String(v == null ? "" : v).trim();
      if (!s || /^[A-Z_]{3,}$/.test(s)) return "";
      return s.indexOf("//") === 0 ? "https:" + s : s;
    }
    /* Aus "www.lee-up.de" wird die Anzeige "lee-up.de" und das Ziel "https://lee-up.de". Der
       Server liefert die Domain ohne Schema; ein href ohne Schema waere ein relativer Pfad und
       landete auf der Bubble-Seite selbst. */
    function domainTeile(v) {
      var s = String(v == null ? "" : v).trim();
      if (!s || /^[A-Z_]{3,}$/.test(s)) return null;
      var text = s.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/+$/, "");
      if (!text) return null;
      return { text: text, ziel: /^https?:\/\//i.test(s) ? s : "https://" + text };
    }

    var spaet = UC.makeLate ? UC.makeLate("teams", ".uts-root") : null;
    var mount;

    /* ---- EIN NEU GEBAUTES ELEMENT MACHT WEITER (27.09. gemeldet) ----
       "Es ist gar nicht noetig, dass beim Theme-Wechsel was in den Loading-yes-State geht."
       Bubble baut ein HTML-Element NEU, sobald sich ein dynamischer Wert in seinem Markup
       aendert -- beim Themenwechsel ist das data-isdark, dasselbe gilt fuer data-team und
       data-brand-name/-logo. Die alte Wurzel fliegt weg, eine frische Kopie der Vorlage kommt
       mit derselben data-instance, und initRoot fing bei null an: busy true, keine Zeilen.
       Bubble schickt die Daten aber nicht noch einmal (sie haben sich ja nicht geaendert) --
       also stand das Skelett fuer immer da.
       Darum ein Speicher am window, je data-instance, wie in responses-table, urls-table und
       domains-table: er ueberlebt den Neuaufbau, und die neue Wurzel startet mit dem, was die
       alte zuletzt gezeigt hat. Geschrieben wird er am Ende von render() -- jede Aenderung in
       dieser Datei endet dort, also gibt es keine Stelle, an der man ihn vergessen kann. */
    var STORE = (window.__utsStore = window.__utsStore || {});

    function initRoot(root) {
      if (root.__utsController) return;

      var instanceId = root.getAttribute("data-instance") || "default";
      /* Der Stand, den die vorige Wurzel dieser Instanz zuletzt gezeigt hat -- leer beim
         allerersten Aufbau. Siehe STORE oben. */
      var saved = STORE[instanceId] || {};
      var state = {
        /* Die Zeilen liegen im Speicher schon normalisiert (normRows) und gehen unveraendert
           zurueck. currentTeamId mit, weil es aus demselben Payload stammt und staerker ist als
           data-team: ohne es stuende die "Active"-Pille nach dem Neuaufbau womoeglich nirgends. */
        rows: Array.isArray(saved.rows) ? saved.rows : [],
        serverTotal: saved.serverTotal != null ? saved.serverTotal : null,
        currentTeamId: saved.currentTeamId || "",
        /* Suche und Seite mit: sonst sprang die Liste bei jedem Themenwechsel auf Seite 1 und
           verlor den Suchtext. Das Feld selbst fuellt der Block hinter UC.makeSearch. */
        query: saved.query || "", page: saved.page || 1,
        pageSize: saved.pageSize || UC.DEFAULT_PAGE_SIZE,
        /* busy ist der ECHTE Ladezustand, nicht state.loading: UC.makeSearch schreibt
           state.loading bei jedem run() selbst auf true (dort ist das Flag fuer die Dimm-Mechanik
           der grossen Tabellen gedacht). Haenge das Skelett daran, laeuft es nach dem ersten
           Schliessen der Suche endlos. Also ein eigenes Feld, das nur diese Datei setzt.
           Beim allerersten Aufbau true (siehe "Ladezustand von Anfang an" unten). Bei einem
           Neuaufbau gilt der gemerkte Wert: stand die Liste, steht sie sofort wieder da; lief
           gerade ein Laden (setTeamsLoading "yes", Antwort noch unterwegs), laeuft es weiter,
           und renderTeams beendet es wie immer an der neuen Wurzel. Der Themenwechsel selbst
           setzt busy nie. */
        busy: saved.busy != null ? !!saved.busy : true,
        hasData: !!saved.hasData,
        /* Der Lesefehler mit: sonst hiesse ein Neuaufbau nach einem kaputten Payload "hasData,
           keine Zeilen" -- und das ist der Leerzustand, also der stille Ausfall (CLAUDE.md §2). */
        parseError: !!saved.parseError,
        loading: false,
        cols: {}, widths: {}
      };
      /* Nur eine Wurzel, die noch im Dokument steht, schreibt. Die alte lebt nach dem Neuaufbau
         als abgehaengter Knoten weiter, samt ihrer Uhren (die Entprellung der Suche); zeichnete
         sie danach noch einmal, ueberschriebe sie den Speicher mit ihrem veralteten Stand. */
      function persist() {
        if (!root.isConnected) return;
        STORE[instanceId] = {
          rows: state.rows, serverTotal: state.serverTotal, currentTeamId: state.currentTeamId,
          hasData: state.hasData, parseError: state.parseError, busy: state.busy,
          query: state.query, page: state.page, pageSize: state.pageSize
        };
      }

      /* ---------------- Seitenkopf ---------------- */
      var kopf =
        '<div class="up-ph-top uts-pagehead">' +
          '<div class="up-ph-left">' +
            '<div class="up-ph-meta">' +
              '<img class="up-ph-metalogo" alt="" style="display:none"/>' +
              /* .pph-metaname ist der Haken, an dem UC.makePageHeaderMeta den Teamnamen und das
                 Logo nachtraegt -- Bubble loest data-brand-name/-logo teils erst auf, wenn diese
                 Wurzel schon steht, und patcht dann das Attribut am Knoten. Ein einmaliges Lesen
                 beim Init wuerde das verpassen.
                 "Organisation" und nicht "Workspace" wie auf den Datenseiten: Teams sind Teil der
                 Organisationseinstellungen, und die Meta-Zeile sagt, wo man ist. */
              '<span class="up-ph-metatxt"><span class="pph-metaname"></span> Organisation</span>' +
            '</div>' +
            '<h1 class="up-ph-heading">' + esc(UC.t("Teams")) + '</h1>' +
            '<p class="up-ph-desc">Manage the teams you are a member of, and switch between them</p>' +
          '</div>' +
          /* Derselbe gefuellte Knopf wie "+ Add Brand" im Marken-Seitenkopf: .up-ph-addbtn
             positioniert, .up-export ist der Knopf. .up-ph-addbtn-full ist der Teil der
             Beschriftung, den core auf schmalen Komponenten selbst wegnimmt. */
          /* Nur "New Team". Kein .up-ph-addbtn-full darin: die Beschriftung ist schon so kurz,
             dass sie nicht in zwei Stufen abgebaut werden muss -- und "New" allein waere keine.
             Auf der schmalsten Stufe nimmt core dem .up-export ohnehin die ganze Beschriftung ab
             und laesst das Zeichen stehen. Gleicher Wortlaut wie der Eintrag unten im
             Teamwaehler der Seitenleiste. */
          '<button class="up-ph-addbtn up-export uts-newteam" type="button">' +
            UC.icon("plus", 1.8) + '<span>' + esc(UC.t("New Team")) + '</span>' +
          '</button>' +
        '</div>';

      /* ---------------- Kopfzeile, Tabelle, Fuss ----------------
         Suche und Zahnrad stehen DIREKT in .up-head-tools und nicht in einer einklappbaren
         Werkzeuggruppe (UC.makeToolGroup): auf dieser Seite gibt es genau zwei Werkzeuge, und
         ein Ausloeser davor waere ein dritter Knopf statt einer Ersparnis. */
      root.innerHTML = kopf +
        '<div class="up-head">' +
          '<span class="up-heading">' +
            '<span class="up-head-label">' + esc(UC.t("Teams")) + '</span>' +
            '<span class="up-head-sep"></span>' +
            '<span class="up-head-count"></span>' +
          '</span>' +
          '<div class="up-head-tools">' +
            '<div class="up-search">' +
              '<button type="button" class="up-iconbtn up-search-btn" aria-label="' + esc(UC.t("Search")) + '" data-tip="' + esc(UC.t("Search")) + '">' +
                UC.icon("search", 2) + '</button>' +
              '<div class="up-search-box">' +
                '<input class="up-search-input" type="text" placeholder="' + esc(UC.t("Search teams…")) + '" ' +
                  'autocomplete="off" spellcheck="false" aria-label="' + esc(UC.t("Search teams")) + '"/>' +
                '<button type="button" class="up-search-clear" aria-label="' + esc(UC.t("Clear search")) + '">' +
                  UC.icon("x", 2.2) + '</button>' +
              '</div>' +
            '</div>' +
            '<div class="up-cols">' +
              '<button type="button" class="up-iconbtn up-cols-btn" data-tip="' + esc(UC.t("Table Settings")) + '" ' +
                'aria-label="' + esc(UC.t("Table settings")) + '">' + UC.icon("settings", 2) +
                /* Das Abzeichen am Zahnrad, wenn Spalten abgeschaltet sind -- syncColsBadge()
                   aus dem Kit schaltet es. Ohne dieses Span lief der Aufruf ins Leere. */
                '<span class="up-badge uts-cols-badge"></span></button>' +
              '<div class="up-menu up-cols-menu" role="menu" aria-hidden="true"></div>' +
            '</div>' +
          '</div>' +
        '</div>' +

        '<div class="up-box uts-box">' +
          '<div class="up-table" data-table></div>' +
        '</div>' +

        '<div class="up-foot">' +
          '<div class="up-pagesize">' +
            '<span class="up-pagesize-lbl">' + esc(UC.t("Rows per page")) + '</span>' +
            '<div class="up-pagesize-seg" role="group" aria-label="' + esc(UC.t("Rows per page")) + '"></div>' +
          '</div>' +
          '<div class="up-pager"></div>' +
        '</div>';

      var elTable    = root.querySelector("[data-table]");
      var elHeading  = root.querySelector(".up-heading");
      var elCount    = root.querySelector(".up-head-count");
      var elColsMenu = root.querySelector(".up-cols-menu");
      var elSearch   = root.querySelector(".up-search");
      var elSearchIn = root.querySelector(".up-search-input");

      var fire = UC.makeFire(root, { label: "teams", eventPrefix: "uts" });
      /* UC.themeParam statt isYes: kennt core ein Thema, gewinnt core -- das Attribut ist nur die
         Momentaufnahme aus dem Lauf des Workflows. */
      function isDark() {
        return UC.themeParam(root.getAttribute("data-isdark")) || root.getAttribute("data-theme") === "dark";
      }
      var tips = UC.makeTooltips(root, isDark);
      /* Vollen Text zeigen, wenn er abgeschnitten ist -- fuer Name und Domain getrennt, weil
         beide unabhaengig voneinander clippen koennen. */
      if (UC.makeClipTip) {
        UC.makeClipTip(root, tips, ".uts-teamwrap", ".uts-name");
        UC.makeClipTip(root, tips, ".uts-dom", ".uts-dom-txt");
      }
      /* Meta-Zeile und data-isdark-Nachsynchronisierung, wie in jedem Seitenkopf der App. */
      if (UC.makePageHeaderMeta) UC.makePageHeaderMeta(root);
      /* Brotkrumen statt Ueberschrift (29.09.): Zeichen und Name wie in der Seitenleiste, ohne
         Unterseiten beide in der Primaerfarbe. Der Kopf steht IN dieser Komponente, also misst
         UC.makePageCrumbs die ganze Wurzel: sie bekommt den Randabstand der Seitenkoepfe (16 vom
         Rand der Bubble-Gruppe), und die Linie unter dem Kopf laeuft bis an deren Kante -- siehe
         core.css, "DER KOMPAKTE KOPF IN EINER KOMPONENTE". */
      /* komponente: die Tabelle bleibt bei 16 wie jeder Block, nur die Kopfzeile reicht rechts bis 8. */
      if (UC.makePageCrumbs) UC.makePageCrumbs(root, { icon: "folders", name: "Teams", komponente: true });
      /* Oben links auf der Seite steht diese Komponente, also traegt sie die Luft fuer den
         mobilen Seitenleisten-Schalter -- dieselbe Klasse wie ask-mira und prompt-research. */
      root.classList.add("up-sidebar-clear");
      /* data-head-top="0" (oder jede CSS-Laenge) nimmt die Luft ueber der Meta-Zeile weg, fuer
         eine Platzierung, deren Bubble-Container sein eigenes Polster mitbringt. */
      (function kopfLuft() {
        var v = String(root.getAttribute("data-head-top") || "").trim();
        if (!v || /^[A-Z_]{3,}$/.test(v)) return;
        root.style.setProperty("--uts-head-top", /^-?[0-9.]+$/.test(v) ? v + "px" : v);
      })();

      /* ---------------- Suche: lokal und sofort ----------------
         Von UC.makeSearch kommen nur Auf-/Zuklappen und die mobile Uebernahme der Kopfzeile. Das
         FILTERN laeuft absichtlich NICHT durch dessen entprellte run()/onFire()-Kette: die ist
         fuer eine Rundreise zum Server gedacht (400ms warten, Ladezustand setzen, Ereignis
         feuern) und hier waere jedes davon falsch. Gleiche Aufteilung wie im topics-manager.
         onFire feuert trotzdem einen Zweck: das Zuklappen der Suche loescht den Text, und dann
         muss die Tabelle neu gezeichnet werden. */
      /* onFire GEHT NACH BUBBLE, wie in jeder anderen Tabelle (uutSearch, udtSearch, uptSearch).
         Hier stand vorher nur render() -- die Suche filterte also ausschliesslich die Zeilen, die
         schon geladen waren. Bei einer Tabelle mit Seiten heisst das: gesucht wurde in der
         aktuellen SEITE und nicht in den Teams. Wer auf Seite 1 stand und ein Team von Seite 3
         suchte, bekam "keine Treffer".
         Der Name folgt dem Muster der anderen: <prefix>Search, hier utsSearch. */
      var search = UC.makeSearch({
        root: root, box: elSearch, input: elSearchIn, state: state,
        prefix: "uts", mobileMax: 560,
        onRender: function () { render(); },
        /* Kein state.page = 1 hier: das setzt makeSearch selbst, bevor es feuert. */
        onFire: function (payload) { fire("data-search-fn", "utsSearch", payload); },
        /* Der getippte Text in den Speicher, noch bevor die Entprellung laeuft -- ein Neuaufbau
           in diesen 400ms verloere ihn sonst. */
        persist: function () { persist(); }
      });
      /* Der eigene input-Zuhoerer ist WEG. Er lief neben dem Kit und rief render() nach 150ms --
         damit war die Suche schon fertig, bevor das Kit sein Ereignis feuern konnte, und es sah
         aus, als waere die Suche eine reine Anzeigesache. Das Kit macht beides: es zeichnet
         (onRender) und feuert entprellt (onFire). */
      elSearchIn.addEventListener("input", function () { search.onInput(); });
      elSearchIn.addEventListener("keydown", function (e) {
        if (e.key === "Escape") { e.stopPropagation(); search.toggle(); }
      });
      root.querySelector(".up-search-btn").addEventListener("click", function (e) {
        e.stopPropagation();
        colsPop.close(false);
        search.toggle();
      });
      root.querySelector(".up-search-clear").addEventListener("click", function (e) {
        e.stopPropagation();
        /* Schmal ist das offene Feld die ganze Werkzeugleiste -- dort schliesst das X die Suche,
           statt nur den Text zu loeschen. Sonst bliebe ein leeres Feld ueber der Tabelle stehen. */
        if (root.classList.contains("is-searchtakeover")) { search.toggle(); return; }
        elSearchIn.value = ""; state.query = ""; state.page = 1;
        elSearch.classList.remove("has-text");
        /* Hier stand noch clearTimeout(suchUhr). Die Variable gibt es seit dem 01.09. (753c0b3,
           eigener input-Zuhoerer entfernt) nicht mehr, und das Lesen eines nie deklarierten
           Namens wirft einen ReferenceError -- das X brach damit VOR render() ab, die Tabelle
           blieb gefiltert, obwohl das Feld leer war. Die Entprellung des Kits bricht cancel() ab. */
        search.cancel();
        render();
        try { elSearchIn.focus(); } catch (e2) {}
      });
      /* Ein Suchtext, der den Neuaufbau ueberlebt hat (siehe STORE), steht auch wieder im Feld --
         sonst filterte die Tabelle nach einem Wort, das niemand sieht. Dieselbe Zeile wie in
         responses-table und urls-table; syncTakeover dazu, weil ein offenes Feld auf einer
         schmalen Komponente die Kopfzeile uebernimmt und das sonst erst beim naechsten
         Aufklappen geschaehe. Gefeuert wird nichts: die Zeilen sind schon die zu diesem Text. */
      if (state.query) {
        elSearchIn.value = state.query;
        elSearch.classList.add("is-open", "has-text");
        search.syncTakeover();
      }

      /* ---------------- Spalten ----------------
         Rasterrechnung, Abwerfen bei Platzmangel, Ziehgriff an der Teamspalte und das
         Zahnrad-Menue kommen komplett aus UC.makeColumns. */
      var colsKit = UC.makeColumns({
        root: root, state: state, columns: COLUMNS,
        storePrefix: "uts", instanceId: instanceId,
        firstKey: "team", firstMin: 210,
        actionsMin: function () { return root.classList.contains("is-narrow") ? ACT_NARROW : ACT_WIDE; },
        badgeSel: ".uts-cols-badge", cellPrefixes: ["up", "uts"],
        onChange: function () { renderTable(); }
      });
      state.cols = colsKit.readCols();
      state.widths = colsKit.readWidths();
      var applyCols = colsKit.applyCols, startResize = colsKit.startResize;
      var populateCols = colsKit.populateCols, toggleCol = colsKit.toggleCol;
      var selectAllCols = colsKit.selectAllCols, syncColsBadge = colsKit.syncColsBadge;
      var visibleCols = colsKit.visibleCols;

      root.addEventListener("pointerdown", function (e) {
        var grip = e.target.closest(".up-grip");
        if (grip) startResize(e, grip);
      });

      var colsPop = UC.makePopover({
        wrap: root.querySelector(".up-cols"),
        menu: elColsMenu,
        opener: root.querySelector(".up-cols-btn"),
        group: "uts-" + instanceId
      });
      elColsMenu.addEventListener("click", function (e) {
        if (e.target.closest("[data-colsall]")) { selectAllCols(); populateCols(); return; }
        var row = e.target.closest("[data-col]");
        if (!row) return;
        toggleCol(row.getAttribute("data-col"));
        populateCols();
      });
      root.querySelector(".up-cols-btn").addEventListener("click", function (e) {
        e.stopPropagation();
        if (colsPop.isOpen()) { colsPop.close(false); return; }
        populateCols(); colsPop.open();
      });

      /* ---------------- Seiten: ebenfalls lokal ----------------
         Vom Kit kommen die Darstellung des Blaetterns und der Zeilenzahl-Schalter. cfg.total
         zeigt auf die GEFILTERTE Menge, damit die Seitenzahlen zur Suche passen und nicht zur
         Gesamtliste. goToPage()/setPageSize() setzen state.loading auf true, weil sie fuer eine
         Serverantwort gebaut sind -- hier ist die naechste Seite schon da, also wird sofort neu
         gezeichnet. */
      var pager = UC.makePager({
        root: root, state: state,
        total: function () { return gefiltert().length; },
        onChange: function () { render(); },
        onClamp: function () { render(); }
      });
      root.querySelector(".up-foot").addEventListener("click", function (e) {
        var ps = e.target.closest("[data-pagesize]");
        if (ps) { pager.setPageSize(Number(ps.getAttribute("data-pagesize"))); return; }
        if (e.target.closest(".up-page-prev")) { pager.goToPage(state.page - 1); return; }
        if (e.target.closest(".up-page-next")) { pager.goToPage(state.page + 1); return; }
        var p = e.target.closest("[data-page]");
        if (p) pager.goToPage(Number(p.getAttribute("data-page")));
      });

      /* ---------------- Breite und Sticky ----------------
         Die Stufenklassen is-narrow / is-vnarrow setzt UC.widthTiers, NICHT diese Datei: das Kit
         der Spalten liest sie in seiner eigenen Rasterrechnung, und eine selbst gesetzte Stufe
         schiebt der Spaltenlogik eine andere Breite unter als die, in der sie sich glaubt. */
      UC.widthTiers(root);
      UC.onResize(root, function () { applyCols(); });

      /* 16 statt der 171 aus der Vorlage (29.09.): die Komponente traegt seit heute den kompakten
         Seitenkopf (48 hoch), und der scrollt mit ihr weg -- eine schwebende Kopfgruppe ueber ihr,
         deren Unterkante die 171 einmal beschrieben, gibt es auf dieser Seite nicht. Mit 171
         drueckte das Kleben die Werkzeugleiste schon IN RUHE nach unten: gemessen 123px Luecke
         unter der Kopflinie (vorher, mit dem hohen Kopf, 55). Dieselbe Zahl und derselbe Grund wie
         in prompt-research.js. Ein ANDERER Wert in data-sticky-top bleibt stehen -- den hat jemand
         bewusst gesetzt; nur die alte Vorgabe wird ersetzt. */
      (function klebKante() {
        var st = String(root.getAttribute("data-sticky-top") || "").trim();
        if (!st || st === "171" || st === "171px") root.setAttribute("data-sticky-top", "16");
      })();
      var sticky = UC.makeSticky(root, root.querySelector(".up-head"));
      /* Nicht an jedem Bild: applySticky misst die Kopfzeile und laeuft die Vorfahrenkette hoch.
         Am Ende der Bewegung reicht -- die Leiste klebt waehrend des Ziehens ohnehin da, wo sie
         war. */
      if (UC.aufResize) UC.aufResize(sticky.applySticky);
      else window.addEventListener("resize", UC.rafThrottle(sticky.applySticky));
      sticky.applySticky();

      /* ---------------- welches Team ist das aktuelle ----------------
         Drei Quellen, in dieser Reihenfolge: der Payload (ausdruecklich und damit am staerksten),
         das Attribut data-team an dieser Wurzel, und zuletzt der Teamspeicher von core.
         Loest keine davon auf, traegt KEINE Zeile die "Active"-Pille und jede bekommt ihren
         Wechselknopf -- der Wechsel in das Team, in dem man schon steht, ist ein Neuladen und
         kein Schaden. Ein raten waere schlimmer: die Pille an der falschen Zeile behauptet, man
         sei woanders. */
      function aktuellesTeam() {
        if (state.currentTeamId) return state.currentTeamId;
        var a = String(root.getAttribute("data-team") || "").trim();
        if (a && !/^[A-Z_]{3,}$/.test(a)) return a;
        try { var g = UC.getTeam && UC.getTeam(); if (g) return String(g); } catch (e) {}
        return "";
      }

      /* ---------------- Daten ---------------- */
      function normRows(list) {
        if (!Array.isArray(list)) return [];
        return list.map(function (r, i) {
          r = r || {};
          var d = domainTeile(r.domain);
          return {
            id: String(r.team_id == null ? ("row" + i) : r.team_id),
            name: String(r.team_name == null ? "" : r.team_name),
            dom: d,
            logo: bildUrl(r.logo_url),
            plan: String(r.billing_plan == null ? "" : r.billing_plan),
            /* isYes deckt yes/true/1 ab. Fehlt das Feld ganz, gilt der Tarif als laufend: die
               Daempfung ist eine AUSSAGE ("kein laufender Tarif"), und die darf nicht aus einem
               fehlenden Feld entstehen. */
            planAktiv: r.active_billing_plan == null ? true : UC.isYes(r.active_billing_plan),
            promptsUsed: toNum(r.prompts_active), promptsLimit: toNum(r.prompts_limit),
            brandsUsed: toNum(r.competitors_tracked), brandsLimit: toNum(r.competitors_limit),
            created: r.created_at == null ? "" : String(r.created_at),
            total: toNum(r.total_count)
          };
        });
      }

      /* Suchen ueber Name, Domain und Tarif. foldDiacritics auf BEIDEN Seiten, sonst findet
         "sanitatscoach" den "Sanitaetscoach" nicht -- und genau so tippt man ihn, wenn man den
         Umlaut nicht trifft. Das ist derselbe Falter, mit dem die Tabellen ihre Serversuche
         vorbereiten. */
      function gefiltert() {
        var q = String(state.query || "").trim();
        if (!q) return state.rows;
        var n = UC.foldDiacritics(q);
        return state.rows.filter(function (r) {
          /* Der Tarif so, wie er DASTEHT: "Legacy Free" zeigt die Pille als "Developer Access"
             (UC.planAnzeige), also muss auch "developer" die Zeile finden. Der Rohname bleibt
             mit drin -- wer ihn aus der Datenbank kennt, sucht danach. */
          var planText = r.plan + (UC.planAnzeige ? " " + UC.planAnzeige(r.plan) : "");
          return UC.foldDiacritics(r.name).indexOf(n) !== -1 ||
                 UC.foldDiacritics(r.dom ? r.dom.text : "").indexOf(n) !== -1 ||
                 UC.foldDiacritics(planText).indexOf(n) !== -1;
        });
      }
      function seite() {
        var alle = gefiltert();
        var von = pager.offset();
        return alle.slice(von, von + state.pageSize);
      }

      /* ---------------- Zellen ---------------- */
      function logoHtml(name, url) {
        var ltr = '<span class="up-logo-ltr">' + esc(String(name || "?").trim().charAt(0) || "?") + '</span>';
        /* KEIN .up-fav: das ist der Globus-Rueckfall fuer eine Seite. Ein Team ist eine Marke,
           und dort ist der Anfangsbuchstabe eine Aussage. Faellt das Bild aus, nimmt der
           Zuhoerer in core has-img weg und der Buchstabe steht da -- ohne onerror-Attribut. */
        if (!url) return '<span class="up-logo-box">' + ltr + '</span>';
        return '<span class="up-logo-box has-img"><img src="' + esc(url) + '" alt="" ' +
               'loading="lazy" referrerpolicy="no-referrer"/>' + ltr + '</span>';
      }
      function quotaHtml(used, limit) {
        if (used == null && limit == null) return '<span class="up-num is-empty">–</span>';
        var ueber = used != null && limit != null && used > limit;
        return '<span class="uts-quota' + (ueber ? " is-over" : "") + '"' +
                 (ueber ? ' data-tip="' + esc(UC.t("Above the plan limit")) + '"' : "") + '>' +
                 '<span class="up-num">' + (used == null ? "–" : fmtInt(used)) + '</span>' +
                 (limit == null ? "" : '<span class="uts-quota-lim">/ ' + fmtInt(limit) + '</span>') +
               '</span>';
      }
      /* Die Pille aus core (UC.planPilleHtml): Farbe inline nur im laufenden Fall, sonst der
         Grundton aus core.css und der gedaempfte Name mit Hinweis. uts-plan bleibt als Klasse
         daran -- das schmale Bild und die Pruefstaende greifen sie. */
      function planHtml(r) {
        if (!r.plan) return '<span class="up-num is-empty">–</span>';
        return UC.planPilleHtml(r.plan, r.planAktiv, { klasse: "uts-plan" });
      }
      function cellHtml(key, r) {
        if (key === "prompts") return quotaHtml(r.promptsUsed, r.promptsLimit);
        if (key === "brands")  return quotaHtml(r.brandsUsed, r.brandsLimit);
        if (key === "plan")    return planHtml(r);
        if (key === "created") {
          var d = fmtDate(r.created);
          return d === "–" ? '<span class="up-num is-empty">–</span>'
                           : '<span class="uts-date">' + esc(d) + '</span>';
        }
        return "";
      }
      function aktionHtml(r, ist) {
        if (ist) {
          /* Das Team, in dem man steht. KEIN gesperrter Wechselknopf: ein Knopf, der aussieht
             wie einer und nichts tut, ist die schlechtere Auskunft. --vt-up ist die Farbe, die
             in dieser App "gut" heisst. */
          /* up-pille: eine Plakette mit Rahmen wie der Tarif daneben -- kein Messwert, also
             nicht der rahmenlose Sentiment-Balken (29.09.). */
          return '<span class="up-sent up-pille uts-active">' +
                   '<span class="up-sent-dot" style="background:var(--vt-up)"></span>' +
                   '<span class="up-sent-val">' + esc(UC.t("Active")) + '</span>' +
                 '</span>';
        }
        return '<button type="button" class="up-export uts-switch" data-switch="' + esc(r.id) + '" ' +
                 /* "Switch to" und der Name getrennt: ein zusammengesetzter Satz findet im
                    Katalog nie einen Eintrag -- er wuerde bei jedem Team anders lauten. */
                 'data-tip="' + esc(UC.t("Switch to") + " " + r.name) + '" ' +
                 'aria-label="' + esc(UC.t("Switch to") + " " + r.name) + '">' +
                 '<span class="uts-switch-label">' + esc(UC.t("Switch")) + '</span>' +
                 '<span class="uts-switch-chev">' + UC.icon("chevronRight", 2) + '</span>' +
               '</button>';
      }

      /* Jede Zelle traegt ihren Spaltenschluessel als Klasse (up-th-<key> / up-td-<key>) --
         danach blendet applyCols() aus dem Kit sie ein und aus.
         Gebaut wird aus visibleCols(), also aus der ABWAHL DES NUTZERS, nicht aus
         effectiveCols(): das misst zusaetzlich die Breite, und beim allerersten Render steht die
         Messung noch nicht. Alle Spalten bauen und applyCols() ausblenden lassen ist genau das,
         wofuer das Kit die Zellen mit ihrem Schluessel markiert. */
      function headHtml() {
        var h = '<div class="up-thead">' +
          '<div class="up-th up-th-team">' + esc(UC.t("Team")) + '</div>';
        visibleCols().forEach(function (c) {
          h += '<div class="up-th up-th-' + c.key + '">' + esc(c.label) + '</div>';
        });
        return h + '<div class="up-th up-th-act">' + esc(UC.t("Actions")) + '</div></div>';
      }

      function rowHtml(r) {
        var ist = !!aktuellesTeam() && String(r.id) === String(aktuellesTeam());
        var h = '<div class="up-row">' +
          '<div class="up-td up-td-team">' +
            logoHtml(r.name, r.logo) +
            '<span class="uts-teamwrap">' +
              '<span class="uts-name">' + esc(r.name || "–") + '</span>' +
              (r.dom
                ? '<a class="uts-dom" href="' + esc(r.dom.ziel) + '" target="_blank" ' +
                    'rel="noopener noreferrer">' +
                    '<span class="uts-dom-txt">' + esc(r.dom.text) + '</span>' +
                    '<span class="uts-dom-ic">' + UC.EXT_SVG + '</span>' +
                  '</a>'
                : '<span class="up-num is-empty">–</span>') +
            '</span>' +
          '</div>';
        visibleCols().forEach(function (c) {
          h += '<div class="up-td up-td-' + c.key + '">' + cellHtml(c.key, r) + '</div>';
        });
        return h + '<div class="up-td up-td-act">' + aktionHtml(r, ist) + '</div></div>';
      }

      function skelett(n) {
        return UC.skeletonRows({ count: n, cols: [
          { w: 120, jitter: 26, logo: true, cls: "up-td-team" },
          { w: 64,  cls: "up-td-prompts" },
          { w: 58,  cls: "up-td-brands" },
          { w: 86,  cls: "up-td-plan" },
          { w: 78,  cls: "up-td-created" },
          { w: 84,  cls: "up-td-act" }
        ]});
      }

      function leerHtml() {
        /* Vier verschiedene Gruende, nichts zu zeigen, und vier verschiedene Texte. Der
           wichtigste ist der letzte: solange NIE Daten ankamen, darf hier keine Aussage ueber
           das Ergebnis stehen -- ein ausgefallener Aufruf sah sonst genauso aus wie eine
           Antwort ohne Teams. */
        if (state.parseError) return UC.leseFehlerHtml("teams");
        var suche = !!String(state.query || "").trim();
        /* Symbol und Markup aus dem Baustein; die Wortwahl bleibt, weil sie hier drei Faelle
           unterscheidet, die nur diese Liste kennt. Kein Raeum-Knopf -- die Suche steht ueber
           der Liste und wird dort geleert. Die Strichstaerke des Symbols war hier 1.7 und ist
           jetzt die 1.6 des Bausteins, wie in jedem anderen Leerzustand. */
        return UC.leerHtml({
          gefiltert: suche, icon: "folders", knopf: "",
          titel: suche ? "No team matches your search"
               : (state.hasData ? "You are not a member of any team" : "No teams yet"),
          text: suche ? "Try a shorter search term."
              : (state.hasData
                   ? "Create a team to start tracking a brand."
                   : "The list has not arrived yet. Reload the page if this stays empty.")
        });
      }

      function renderTable() {
        var head = headHtml();
        /* Skelett bei JEDEM Ladezustand, nicht nur beim ersten: sonst stehen nach einem
           setTeamsLoading("yes") die alten Zeilen unveraendert da, waehrend frische Daten
           unterwegs sind -- und "nichts passiert" ist die falsche Auskunft. Gleiche Regel wie in
           den anderen Tabellen der App. */
        if (state.busy) {
          elTable.innerHTML = head + '<div class="up-tbody">' + skelett(5) + '</div>';
          applyCols(); syncColsBadge();
          return;
        }
        var rows = seite();
        if (!rows.length) {
          elTable.innerHTML = head + leerHtml();
          applyCols(); syncColsBadge();
          return;
        }
        elTable.innerHTML = head + '<div class="up-tbody">' + rows.map(rowHtml).join("") + '</div>';
        applyCols(); syncColsBadge();
      }

      function renderCount() {
        elHeading.classList.add("has-count");
        if (state.busy) { elCount.textContent = ""; elCount.classList.add("is-sk"); return; }
        /* Bei einem Lesefehler kommt keine Zahl mehr -- ein pulsender Balken behauptet dann, sie
           sei unterwegs. */
        if (state.parseError) { elCount.classList.remove("is-sk"); elCount.textContent = ""; return; }
        /* Die Zahl der Zeilen, die JETZT gelten: ohne Suche ist das die ganze Liste, mit Suche
           das Ergebnis. Eine Gesamtzahl neben einem gefilterten Ergebnis stehen zu lassen waere
           die falsche Auskunft. */
        elCount.classList.remove("is-sk");
        elCount.textContent = UC.fmtTotal(gefiltert().length);
      }

      function renderFoot() {
        /* Der Fuss steht IMMER da, sobald Daten da sind -- wie in jeder anderen Tabelle der App.
           Er war hier bis zum 31.08. versteckt, solange alles auf eine Seite passte; das war meine
           Entscheidung und die falsche: "Rows per page" und "1-15 of N" sind Auskunft und keine
           Zierde, und eine Tabelle, die ihren Fuss je nach Zeilenzahl weglaesst, verhaelt sich
           anders als ihre Nachbarn.
           NUR waehrend des Ladens bleibt er weg: die Zahl der Zeilen ist dann unbekannt, und ein
           Blaetterer ueber einer unbekannten Menge behauptet eine Auskunft, die es nicht gibt. */
        root.classList.toggle("is-onepage", state.busy);
        pager.renderPageSize();
        pager.renderPager();
      }

      function render() {
        renderCount(); renderFoot(); renderTable();
        /* Die Kopfzeile kann ihre Hoehe zwischen zwei Rendern aendern (Zaehler vom Skelett auf
           echten Text, Suchfeld auf- oder zugeklappt). Ohne das Nachmessen bleibt der
           Spaltenkopf am alten Versatz kleben. */
        if (root.classList.contains("up-sticky")) sticky.syncTheadOffset();
        /* Den gezeigten Stand fuer einen Neuaufbau merken (siehe STORE). Hier und nicht an jeder
           Aenderung einzeln: Payload, Laden, Reset, Suche, Seite und Seitengroesse enden alle in
           render(). */
        persist();
      }

      /* ---------------- Klicks ---------------- */
      root.addEventListener("click", function (e) {
        if (!e.target.closest) return;

        var neu = e.target.closest(".uts-newteam");
        if (neu) {
          /* action mitgeben, obwohl es nur einen Fall gibt: derselbe Payload wie usnNewTeam in
             der Seitenleiste, damit derselbe Workflow beide bedienen kann. */
          fire("data-newteam-fn", "usnNewTeam", { action: "new_team" });
          return;
        }

        var sw = e.target.closest("[data-switch]");
        if (sw) {
          var id = sw.getAttribute("data-switch");
          if (!id) return;
          /* Sofort sperren und sagen, was laeuft: Bubble baut die halbe Seite neu, und ein Knopf,
             der dabei noch klickbar aussieht, wird ein zweites Mal gedrueckt. */
          sw.disabled = true;
          var lbl = sw.querySelector(".uts-switch-label");
          if (lbl) lbl.textContent = UC.t("Switching…");
          /* Und wieder auf, wenn nichts passiert -- ein Workflow, der nie antwortet, darf keinen
             toten Knopf hinterlassen. */
          setTimeout(function () {
            if (!sw || !sw.parentNode) return;
            sw.disabled = false;
            if (lbl) lbl.textContent = UC.t("Switch");
          }, WECHSEL_FREI_MS);
          /* Genau die Nutzlast des Teamwaehlers in der Seitenleiste (usnTeam). Wer
             data-switch-fn auf bubble_fn_usnTeam zeigt, braucht keinen neuen Workflow. */
          fire("data-switch-fn", "usnTeam", { team_id: id });
          return;
        }
      });

      /* ---------------- Daten herein ---------------- */
      var ctrl = {
        render: function (p) {
          p = p || {};
          /* normParams in core hat den Text schon geparst; scheiterte das, liegt hier eine leere
             Liste UND ein __parseError-Vermerk. Ohne den sah ein zerrissener Payload genauso aus
             wie ein sauberes leeres Ergebnis. */
          state.parseError = !!p.__parseError;
          if (state.parseError) {
            state.rows = [];
            state.busy = false;
            if (window.console) console.error("[teams] Die Zeilen liessen sich nicht lesen. Die " +
              "Konsolenwarnung darueber zeigt, an welcher Stelle das JSON gerissen ist.");
            render();
            return;
          }
          var list = p.rows != null ? p.rows : (p.teams != null ? p.teams : null);
          state.rows = normRows(list);
          state.hasData = true;
          /* Das aktuelle Team darf im Payload stehen -- drei Schreibweisen, weil der Name auf der
             Bubble-Seite so oder so gewaehlt wird und ein stiller Fehlgriff hier die "Active"-
             Pille an der falschen Zeile zeigen wuerde. Ein LEERER Wert ueberschreibt nicht: dann
             gilt weiter data-team bzw. der Teamspeicher von core. */
          var cur = p.currentTeamId != null ? p.currentTeamId
                  : (p.current_team_id != null ? p.current_team_id : p.active_team_id);
          if (cur != null && String(cur).trim()) state.currentTeamId = String(cur).trim();
          /* total_count steht in jeder Zeile und ist ueberall gleich. Es wird gelesen, aber nicht
             fuer die Anzeige benutzt: geblaettert und gezaehlt wird lokal, also ist die Zahl der
             wirklich vorhandenen Zeilen die Wahrheit. Weicht sie ab, sagt es das in der Konsole
             -- dann liefert der Aufruf nur eine Seite, und dieser Bau waere der falsche. */
          var t = state.rows.length && state.rows[0].total != null ? state.rows[0].total : null;
          state.serverTotal = t;
          if (t != null && t !== state.rows.length && window.console) {
            console.warn("[teams] total_count ist " + t + ", angekommen sind aber " +
              state.rows.length + " Zeilen. Diese Komponente blaettert LOKAL und erwartet die " +
              "ganze Liste in einem Aufruf -- der RPC darf hier nicht seitenweise liefern.");
          }
          state.page = 1;
          state.busy = false;
          render();
        },
        setLoading: function (v) {
          var an = UC.isYes(v);
          /* Ein NEUER Ladeversuch raeumt den Lesefehler weg -- sonst ueberlebt er jeden weiteren
             Versuch und steht noch da, waehrend frische Daten unterwegs sind. */
          if (an) state.parseError = false;
          state.busy = an;
          render();
        },
        reset: function () {
          state.rows = []; state.serverTotal = null; state.hasData = false;
          state.parseError = false; state.page = 1;
          /* Auch das aktuelle Team vergessen. Es kostet nichts -- der naechste render() liefert es
             wieder mit, und ohne Payload greift die Kette data-team -> UC.getTeam(). Behalten
             waere die Gelegenheit fuer den einen Fehler, der hier weh tut: eine "Active"-Pille an
             der falschen Zeile behauptet, man sei in einem anderen Team. */
          state.currentTeamId = "";
          /* makeSearch hat KEIN reset() -- von Hand zuruecksetzen und die laufende Entprellung
             abbrechen, sonst zeichnet nach dem Reset noch der alte Suchtext.
             Ohne das clearTimeout(suchUhr), das hier stand: die Variable gibt es seit dem 01.09.
             nicht mehr, der ReferenceError liess resetTeams VOR render() abbrechen -- die alten
             Zeilen blieben stehen, obwohl der Zustand schon leer war. */
          state.query = "";
          if (elSearchIn) elSearchIn.value = "";
          if (elSearch) elSearch.classList.remove("is-open", "has-text");
          root.classList.remove("is-searchtakeover");
          search.cancel();
          state.busy = false;
          /* render() schreibt diesen LEEREN Stand in den Speicher (siehe STORE) -- ausdruecklich
             und nicht bloss geloescht: ein Neuaufbau nach dem Reset zeigt dann dasselbe wie die
             zurueckgesetzte Wurzel ("No teams yet"), statt die alten Zeilen zurueckzuholen oder
             ohne Anlass ins Skelett zu gehen. */
          render();
        },
        setTheme: function (t) { if (UC.setUpstreemTheme) UC.setUpstreemTheme(t); }
      };
      root.__utsController = ctrl;
      root.__utsResolveLocal = function (id) {
        return (root.getAttribute("data-instance") || "default") === id;
      };

      /* ---------------- DIREKTER DATENWEG (09.10., Vertrag E: teams_portfolio_v1) ----------------
         Mit data-direct="yes" holt die Tabelle ihre Zeilen selbst (UC.rpc, Login des Nutzers) statt
         ueber einen Bubble-Workflow mit renderTeams. Die beiden Ereignisse bleiben, wie sie sind:
         Wechseln und "Create" gehen weiter an die Workflows der Seitenleiste (usnTeam, usnNewTeam)
         -- die gibt es in der App schon, und ein Teamwechsel laedt dort den ganzen Arbeitsbereich.
         Angeheftet wird das aktive Team (p_pinned_team_id): es steht oben, wie bisher. Ein
         geloeschtes oder fremdes Team ignoriert die DB, statt die Tabelle mit einem Fehler zu
         leeren. Geladen wird beim Aufbau (sobald sichtbar) und bei jedem Teamwechsel; die ganze
         Liste in einem Aufruf (bis 100), darueber blaettert der Lader selbst nach. */
      if (UC.isYes(root.getAttribute("data-direct")) && UC.rpc) {
        var direktNr = 0;
        var direktLaden = function () {
          var sichtbar = function (el) { return el.isConnected !== false && (!UC.istSichtbar || UC.istSichtbar(el)); };
          if (!sichtbar(root)) { if (UC.beiSicht) UC.beiSicht(root, "teams_laden", direktLaden, sichtbar); return; }
          var nr = ++direktNr, tm = "";
          try { tm = (UC.getTeam && UC.getTeam()) || ""; } catch (e) {}
          if (!state.hasData) ctrl.setLoading("yes");
          var alle = [];
          var seite = function (offset) {
            var p = { p_limit: 100, p_offset: offset };
            if (/^[0-9a-f-]{36}$/i.test(tm)) p.p_pinned_team_id = tm;
            return UC.rpc("teams_portfolio_v1", p, { timeoutMs: 20000 }).then(function (erg) {
              if (nr !== direktNr) return null;
              var d = erg.ok ? erg.daten : null;
              var rows = d && Array.isArray(d.rows) ? d.rows : null;
              if (!rows) return false;
              alle = alle.concat(rows);
              var total = d.meta && Number(d.meta.total_count);
              /* Hoechstens zehn Seiten: tausend Teams hat niemand, und eine kaputte Zaehlung soll
                 keine Schleife werden. */
              if (total > alle.length && rows.length && offset < 900) return seite(offset + 100);
              return true;
            });
          };
          seite(0).then(function (ok) {
            if (ok === null || nr !== direktNr) return;
            if (ok) ctrl.render({ rows: alle, currentTeamId: tm });
            /* Unlesbar oder abgelehnt: der Lesefehler der Tabelle, nie eine leere Liste. */
            else ctrl.render({ __parseError: true });
          });
        };
        if (UC.onTeamChange) UC.onTeamChange(function () { direktLaden(); }, root);
        setTimeout(direktLaden, 0);
      }

      /* Ladezustand von Anfang an: bis zum ersten Aufruf gibt es nichts zu zeigen, und der
         Leerzustand waere die Behauptung, es sei schon geantwortet worden. Gilt nur beim
         allerersten Aufbau -- eine neu gebaute Wurzel zeichnet hier den gemerkten Stand
         (siehe STORE). */
      render();
      if (spaet) spaet.drain(instanceId, ctrl);
    }

    function each(id, fn) {
      var roots = mount.rootsWithId(id);
      /* Wurzel da, aber noch kein Controller -> JETZT einrichten.
         Der Grund, und er ist gemessen: makeMount arbeitet die Boot-Queue ab, BEVOR es initAll()
         ruft (core.js, das initAll() steht am Ende von makeMount). Steht das Markup der
         Komponente zu diesem Zeitpunkt schon im Dokument -- und auf einer Bubble-Seite steht es
         das, der Loader sitzt IM Element hinter dem div --, dann findet rootsWithId() die Wurzel,
         aber __utsController gibt es noch nicht. Die alte Fassung (nur "if (r.__utsController)")
         liess den Aufruf damit still fallen: gemessen im Harness _h_uts_frueh.html, 2 Aufrufe in
         der Queue, Queue danach leer, Tabelle trotzdem fuer immer im Skelett.
         initRoot ist idempotent (erste Zeile: schon initialisiert -> return), der Aufruf kostet
         also nichts, wenn alles in Ordnung ist. */
      roots.forEach(function (r) {
        if (r.__utsController) return;
        try { initRoot(r); }
        catch (e) { if (window.console) console.error("[teams] initRoot ist gescheitert:", e); }
      });
      var mit = roots.filter(function (r) { return !!r.__utsController; });
      /* Erst parken, wenn WIRKLICH niemand da ist. Sonst laeuft der Aufruf zweimal: einmal jetzt
         und einmal beim naechsten drain(). */
      if (!mit.length && spaet) { spaet.park(id, fn); return; }
      mit.forEach(function (r) { fn(r.__utsController); });
    }

    mount = UC.makeMount({
      onMount: function (m) { mount = m; },
      rootClass: "uts-root", notPortal: true,
      ctrlProp: "__utsController",
      resolveLocal: "__utsResolveLocal",
      queue: "__utsBootQueue",
      initRoot: initRoot,
      api: {
        renderTeams: function (p) {
          p = p || {};
          each(p.instanceId || "default", function (c) { c.render(p); });
        },
        setTeamsLoading: function (id, v) { each(id || "default", function (c) { c.setLoading(v); }); },
        resetTeams: function (id) { each(id || "default", function (c) { c.reset(); }); }
      },
      forwardShape: { renderTeams: "params", resetTeams: "id" }
    });
  }

  utsBoot(50);
})();
