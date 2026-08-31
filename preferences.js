/* upstreem preferences.js — das Einstellungsfenster (Praefix ums). Braucht core.js.

   ── Was es ist ──────────────────────────────────────────────────────────────
   EIN Fenster fuer die ganze Seite, aufgerufen aus dem Konto-Menue der Seitenleiste. Es heisst
   "Preferences" und nicht "Settings": diese App hat schon eine Einstellungsseite (settings-brand),
   und zwei Dinge mit demselben Namen sind eines zu viel.

   Drei Seiten, links waehlbar:
     My Preferences   Sprache, Zahlenformat, Datumsformat        <- die Vorgabe beim Oeffnen
     Profile          Name, Bild, Nutzerkennung zum Kopieren
     Charts           Linienstaerke und Legende

   ── Wo die Werte leben ──────────────────────────────────────────────────────
   In core, nicht hier: UC.getPref / UC.setPref schreiben in den localStorage, teambezogen, und
   melden jede Aenderung mit einem Fensterereignis. Dieses Fenster ist nur die Oberflaeche davor.
   Der Grund ist der Ort, an dem die Werte gebraucht werden -- in jeder Tabelle, jedem Chart und
   jedem Tooltip, und keiner davon kennt dieses Fenster.

   Die Chart-Einstellungen haben ihre EIGENEN Schluessel in core (getLineWidthPref / getLegendPref)
   und behalten sie. Sie gab es vor diesem Fenster, sie funktionieren, und ein Umzug haette nur die
   gespeicherte Wahl jedes Nutzers weggeworfen. Hier stehen dieselben Setter, die auch das
   Zahnradmenue eines Charts benutzt.

   ── Wie es geoeffnet wird ───────────────────────────────────────────────────
     window.openUpstreemPreferences()            oeffnet auf der Vorgabeseite
     window.openUpstreemPreferences("profile")   oeffnet auf einer bestimmten Seite
     window.closeUpstreemPreferences()

   Die Seitenleiste ruft das erste selbst -- kein Bubble-Workflow noetig. Sie feuert ihr Ereignis
   trotzdem weiter, damit ein Workflow zusaetzlich reagieren kann.

   ── Ereignisse heraus (nur das Profil) ──────────────────────────────────────
     umsName    { team_id, display_name }   Name gespeichert
     umsAvatar  { team_id, action }         "change" -- Bubble oeffnet seinen eigenen Uploader

   Sprache, Zahlen- und Datumsformat feuern NICHTS: sie stehen im localStorage, so wie das Thema.
   Wer sie am Nutzer speichern will, haengt in setzen() eine Zeile an -- die Stelle ist benannt. */
(function () {
  "use strict";

  function umsBoot(n) {
    if (!window.UpstreemCore) {
      if (n > 0) { setTimeout(function () { umsBoot(n - 1); }, 100); return; }
      if (window.console) console.error("[preferences] UpstreemCore (core.js) not loaded");
      return;
    }
    umsRun();
  }

  function umsRun() {
    var UC = window.UpstreemCore;
    var esc = UC.esc;
    var t = UC.t || function (x) { return x; };

    var MISSING = ["getPref", "setPref", "makePopover", "icon", "esc", "fmtNum", "fmtDate"]
      .filter(function (k) { return typeof UC[k] !== "function"; });
    if (MISSING.length && window.console) {
      console.error("[preferences] Die core.js auf dieser Seite ist AELTER als preferences.js, es " +
        "fehlen: " + MISSING.join(", ") + ". Alle Elemente der Seite auf denselben Commit pinnen.");
    }

    /* Die eigenen Texte dieses Fensters auf Deutsch. Es ist der Ort, AN dem man die Sprache
       umstellt -- ein Fenster, das danach als einziges englisch bleibt, sieht aus, als haette die
       Einstellung nicht gewirkt.
       Nicht uebersetzt: "Charts" (steht in der App durchgehend so, auch in den Menuenamen),
       "User ID" (ein Feldname, den der Support so nennt) und "Default" (der Name der Farbskala,
       der in den Chart-Menues ebenfalls so steht). Die Regel ist dieselbe wie in der Seitenleiste:
       Oberflaeche ja, Eigennamen und Fachbegriffe der Ausgabe nein. */
    if (UC.addMessages) UC.addMessages("de", {
      "My Preferences": "Meine Einstellungen",
      "Choose how upstreem looks and formats your data": "Wie upstreem aussieht und deine Daten darstellt",
      "Profile": "Profil",
      "Your name and picture, as your team sees them": "Dein Name und Bild, so wie dein Team sie sieht",
      "How lines and legends are drawn across every chart": "Wie Linien und Legenden in allen Charts gezeichnet werden",
      "Account": "Konto",
      "Display": "Darstellung",
      "Close": "Schließen",
      "Language and formats": "Sprache und Formate",
      "Language": "Sprache",
      "The language of the interface. Your own data — prompts, brands, domains — is never translated.":
        "Die Sprache der Oberfläche. Deine eigenen Daten – Prompts, Marken, Domains – werden nie übersetzt.",
      "Number format": "Zahlenformat",
      "How numbers and percentages are written across tables, charts and tooltips.":
        "Wie Zahlen und Prozentwerte in Tabellen, Charts und Tooltips geschrieben werden.",
      "Date format": "Datumsformat",
      "Used everywhere a date appears, including chart axes.":
        "Gilt überall, wo ein Datum steht, auch an den Chart-Achsen.",
      "Chart appearance": "Aussehen der Charts",
      "Line width": "Linienstärke",
      "The stroke of every line chart.": "Die Strichstärke aller Liniencharts.",
      "Colors": "Farben",
      "The palette for the lines in Visibility Chart. Brand colours from your own data are used when this is set to Default.":
        "Die Farben der Linien im Visibility Chart. Bei Default gelten die Markenfarben aus deinen eigenen Daten.",
      "Show legend": "Legende zeigen",
      "The legend under a line chart, with one entry per brand.":
        "Die Legende unter einem Linienchart, ein Eintrag je Marke.",
      "Preferred name": "Bevorzugter Name",
      "Your name": "Dein Name",
      "Change your picture": "Bild wechseln",
      "Upload a picture — square images look best": "Bild hochladen – quadratische Bilder wirken am besten",
      "Theme": "Design",
      "System follows the setting of your operating system.":
        "System übernimmt die Einstellung deines Betriebssystems.",
      "Light": "Hell",
      "Dark": "Dunkel",
      "System": "System"
    });

    /* ---- Die Wahlmöglichkeiten ----
       Ein Eintrag je Wert, mit dem Namen und -- wo es hilft -- einem BEISPIEL. Das Beispiel ist der
       eigentliche Trick dieser Seite: "Numeric" sagt niemandem etwas, "12.12.2025" sofort alles.
       Die Beispiele werden GERECHNET und nicht geschrieben, damit sie nicht von dem abweichen
       koennen, was die App danach wirklich zeigt. */
    var BEISPIEL_DATUM = "2025-12-12T10:30:00Z";
    var BEISPIEL_ZAHL = 1234.56;

    /* land: der Laendercode fuer das Flaggenplaettchen aus core (UC.flagHtml, dasselbe Bauteil wie
       im Markets-Filter). GB und nicht US fuer Englisch -- die App schreibt britisches Englisch. */
    var SPRACHEN = [
      { wert: "en", name: "English", land: "gb" },
      { wert: "de", name: "Deutsch", land: "de" }
    ];
    var ZAHLEN = [
      { wert: "en", name: "1,234.56" },
      { wert: "de", name: "1.234,56" }
    ];
    /* Das Thema gehoert in dieselbe Liste wie Sprache und Formate: es ist dieselbe Art
       Entscheidung. Es liegt NICHT im Vorrat von core (PREF_KEY), sondern in localStorage
       pref_theme -- dort lag es schon, bevor es dieses Fenster gab, und das Konto-Menue der
       Seitenleiste schreibt in denselben Schluessel. Zwei Speicherorte fuer eine Einstellung
       waeren zwei Wahrheiten. */
    var THEMEN = [
      { wert: "light",  name: "Light" },
      { wert: "dark",   name: "Dark" },
      { wert: "system", name: "System" }
    ];
    var DATEN = [
      { wert: "d-mon-y", name: "12. Dec 2025" },
      { wert: "mon-d-y", name: "Dec 12, 2025" },
      { wert: "d-m-y",   name: "12.12.2025" },
      { wert: "iso",     name: "2025-12-12" }
    ];

    function zahlBeispiel(wert) {
      /* Der NAME der Zeile ist bei den Zahlen schon das Beispiel ("1,234.56"). Das Beispiel rechts
         zeigt darum nur, was der Wert an der ANDEREN Stelle bedeutet: die kompakte Schreibweise,
         die in jeder Kopfzeile und jedem Tooltip steht.
         fmtTotal nimmt das Format als zweiten Wert -- die Einstellung wird dafuer NICHT angefasst.
         Hier stand vorher genau das: umschalten, messen, zuruecksetzen. Das hat zweimal setPref
         gerufen, also zweimal up-prefs-change gefeuert (jeder Chart der Seite lud neu), und der
         onPrefs-Zuhoerer dieses Fensters hat dabei das gerade im Aufbau befindliche Auswahlmenue
         aus dem Dokument geworfen -- gemeldet als "der Klick auf Number Format oeffnet kein
         Dropdown, im Hintergrund laden nur die Charts neu". */
      return UC.fmtTotal(1240, wert);
    }
    function datumBeispiel(wert) {
      /* Hier geht es ohne Umschalten: core rechnet das Muster auf Zuruf. */
      return UC.fmtDateMuster(UC.datumsTeile(BEISPIEL_DATUM), wert);
    }

    /* ---- Zustand des Fensters ---- */
    var M = null;                 /* die gebauten Knoten */
    var seite = "prefs";          /* prefs | profile | charts */
    var offen = false, opener = null;
    /* userId wird weiter angenommen (setUpstreemProfile nimmt user_id, die Seitenleiste gibt es
       weiter) und NICHT mehr gezeigt -- die Zeile "User ID" ist auf Wunsch entfallen. Der Wert
       bleibt im Zustand, damit der Payload derselbe bleibt und die Zeile ohne Umbau zurueckkann. */
    var profil = { name: "", avatar: "", userId: "" };
    var popovers = [];

    var SEITEN = [
      { key: "prefs",   kopf: "Account", label: "My Preferences", icon: "settings2",
        titel: "My Preferences", sub: "Choose how upstreem looks and formats your data" },
      { key: "profile", label: "Profile", icon: "users",
        titel: "Profile", sub: "Your name and picture, as your team sees them" },
      { key: "charts",  kopf: "Display", label: "Charts", icon: "chartColumnUp",
        titel: "Charts", sub: "How lines and legends are drawn across every chart" }
    ];

    /* ---- Bauen ---- */
    function bauen() {
      var back = document.createElement("div");
      /* up-root, damit core's Theme-Sweep ihn findet; up-portal, weil er ausserhalb jeder
         Komponentenwurzel im <body> lebt -- setUpstreemTheme() sucht genau diese beiden. */
      back.className = "up-root up-portal up-topicmodal-backdrop ums-backdrop";
      back.setAttribute("role", "dialog");
      back.setAttribute("aria-modal", "true");
      back.setAttribute("aria-label", "Preferences");
      back.innerHTML =
        '<div class="up-topicmodal-card ums-card">' +
          '<div class="ums-aside" data-ums-aside></div>' +
          '<div class="ums-main" data-ums-main></div>' +
        '</div>';
      document.body.appendChild(back);
      M = { back: back, aside: back.querySelector("[data-ums-aside]"),
            main: back.querySelector("[data-ums-main]") };

      back.addEventListener("click", function (e) {
        if (e.target === back) { schliessen(); return; }
        if (!e.target.closest) return;
        if (e.target.closest("[data-ums-close]")) { schliessen(); return; }
        var nav = e.target.closest("[data-ums-page]");
        if (nav) { seite = nav.getAttribute("data-ums-page"); zeichnen(); return; }
        var sel = e.target.closest("[data-ums-selbtn]");
        if (sel) { e.stopPropagation(); menueOeffnen(sel); return; }
        var opt = e.target.closest("[data-ums-set]");
        if (opt) { setzen(opt.getAttribute("data-ums-set"), opt.getAttribute("data-ums-val")); return; }
        var sc = e.target.closest("[data-scale]");
        if (sc) { schemaSetzen(sc.getAttribute("data-scale")); return; }
        /* Der Zwei-Wege-Schalter aus core traegt data-linewidth, nicht data-ums-toggle -- es ist
           SEIN Markup, also auch sein Attribut. */
        var lw = e.target.closest("[data-linewidth]");
        if (lw) { if (UC.setLineWidthPref) UC.setLineWidthPref(lw.getAttribute("data-linewidth")); zeichnen(); return; }
        var sw = e.target.closest("[data-ums-toggle]");
        if (sw) { schalten(sw.getAttribute("data-ums-toggle")); return; }
        if (e.target.closest("[data-ums-avatar]")) { fire("data-avatar-fn", "umsAvatar", { action: "change" }); return; }

      });
      /* Gespeichert wird beim Verlassen des Feldes und bei Enter. blur mit CAPTURE, weil blur
         nicht aufsteigt -- ohne capture:true kommt hier nichts an. */
      back.addEventListener("blur", function (e) {
        if (e.target && e.target.hasAttribute && e.target.hasAttribute("data-ums-name")) namenSpeichern();
      }, true);
      back.addEventListener("keydown", function (e) {
        if (e.key !== "Enter") return;
        if (!e.target || !e.target.hasAttribute || !e.target.hasAttribute("data-ums-name")) return;
        e.preventDefault();
        namenSpeichern();
      });
      if (UC.makeTooltips) UC.makeTooltips(back, function () {
        return back.getAttribute("data-theme") === "dark";
      });
    }

    /* Das Ereignis gehoert dem Fenster, nicht einer Komponentenwurzel -- also ein eigener Sender
       auf dem Rueckgrat von core. team_id haengt UC.makeFire von selbst an. */
    var fire = null;
    function fireBauen() {
      if (fire || !M) return;
      fire = UC.makeFire(M.back, { label: "preferences", eventPrefix: "ums" });
    }

    /* ---- Navigation ---- */
    function asideHtml() {
      var out = "";
      SEITEN.forEach(function (s) {
        if (s.kopf) out += '<div class="ums-navhead">' + esc(t(s.kopf)) + '</div>';
        out += '<button class="up-optrow ums-nav' + (seite === s.key ? " is-on" : "") + '"' +
          ' type="button" data-ums-page="' + esc(s.key) + '"' +
          ' aria-current="' + (seite === s.key ? "page" : "false") + '">' +
          UC.icon(s.icon, 2) + '<span>' + esc(t(s.label)) + '</span></button>';
      });
      return out;
    }

    /* ---- Bausteine der rechten Seite ---- */
    function kopfHtml(s) {
      return '<div class="ums-head">' +
        '<div class="ums-headtext">' +
          '<div class="ums-title">' + esc(t(s.titel)) + '</div>' +
          '<div class="ums-sub">' + esc(t(s.sub)) + '</div>' +
        '</div>' +
        '<button type="button" class="up-popup-close" data-ums-close aria-label="' +
          esc(t("Close")) + '">' + UC.icon("x", 2) + '</button>' +
      '</div>';
    }
    function zeileHtml(titel, beschreibung, regler) {
      return '<div class="ums-row">' +
        '<div class="ums-rowtext">' +
          '<div class="ums-rowtitle">' + esc(t(titel)) + '</div>' +
          (beschreibung ? '<div class="ums-rowdesc">' + esc(t(beschreibung)) + '</div>' : "") +
        '</div>' +
        '<div class="ums-rowctl">' + regler + '</div>' +
      '</div>';
    }
    /* Die Flagge steht am Knopf UND in der Liste -- wie der Markets-Filter es tut: sein Trigger
       tauscht das Zeichen gegen die Flagge des gewaehlten Landes. */
    function flagge(o, cls) {
      return o && o.land ? UC.flagHtml(o.land, cls) : "";
    }
    function selHtml(name, liste, jetzt) {
      var akt = null;
      liste.forEach(function (o) { if (o.wert === jetzt) akt = o; });
      return '<span class="ums-selwrap" data-ums-wrap>' +
        '<button class="ums-sel" type="button" aria-haspopup="menu" aria-expanded="false"' +
          ' data-ums-selbtn="' + esc(name) + '">' +
          flagge(akt, "ums-flag") +
          '<span class="ums-sel-val">' + esc(akt ? t(akt.name) : jetzt) + '</span>' +
          UC.icon("chevronDown", 2.2) +
        '</button>' +
        '<div class="up-menu ums-menu" role="menu" aria-hidden="true"></div>' +
      '</span>';
    }
    function schalterHtml(name, an) {
      return '<span class="up-switch' + (an ? " is-on" : "") + '" role="button" tabindex="0"' +
        ' aria-pressed="' + (an ? "true" : "false") + '" data-ums-toggle="' + esc(name) + '"></span>';
    }

    /* ---- Die drei Seiten ---- */
    function prefsHtml() {
      return '<div class="ums-sec">' +
        '<h3 class="ums-sectitle">' + esc(t("Language and formats")) + '</h3>' +
        '<div class="ums-secline"></div>' +
        zeileHtml("Language", "The language of the interface. Your own data — prompts, brands, " +
          "domains — is never translated.", selHtml("locale", SPRACHEN, UC.getPref("locale"))) +
        zeileHtml("Number format", "How numbers and percentages are written across tables, " +
          "charts and tooltips.", selHtml("num", ZAHLEN, UC.getPref("num"))) +
        zeileHtml("Date format", "Used everywhere a date appears, including chart axes.",
          selHtml("date", DATEN, UC.getPref("date"))) +
        zeileHtml("Theme", "System follows the setting of your operating system.",
          selHtml("theme", THEMEN, themaJetzt())) +
      '</div>';
    }

    function profileHtml() {
      var buchst = (profil.name || "?").trim().charAt(0).toUpperCase() || "?";
      return '<div class="ums-sec">' +
        '<h3 class="ums-sectitle">' + esc(t("Profile")) + '</h3>' +
        '<div class="ums-secline"></div>' +
        /* Bild links, daneben die beschriftete Eingabe -- die Anordnung aus der Vorlage. Das Bild
           ist SELBST der Knopf: ein zweiter daneben waere ein zweiter Weg zur gleichen Sache. */
        '<div class="ums-profile">' +
          '<button class="ums-avatar" type="button" data-ums-avatar ' +
            'aria-label="' + esc(t("Change your picture")) + '" ' +
            'data-tip="' + esc(t("Change your picture")) + '">' +
            (profil.avatar ? '<img src="' + esc(profil.avatar) + '" alt="" referrerpolicy="no-referrer"' +
              ' onerror="this.remove()"/>' : '<span class="ums-avatar-ltr">' + esc(buchst) + '</span>') +
            '<span class="ums-avatar-ov">' + UC.icon("camera", 2) + '</span>' +
          '</button>' +
          '<div class="ums-field">' +
            '<label class="ums-flabel" for="ums-name">' + esc(t("Preferred name")) + '</label>' +
            /* Kein Speichern-Knopf: gespeichert wird beim Verlassen des Feldes und bei Enter --
               wie in der Vorlage. Ein Knopf, der nur bei Aenderung etwas tut, ist die Haelfte der
               Zeit ein Knopf, der nichts tut. */
            '<input class="ums-in ums-in-name" id="ums-name" type="text" maxlength="80" ' +
              'data-ums-name value="' + esc(profil.name) + '" ' +
              'placeholder="' + esc(t("Your name")) + '" autocomplete="off">' +
          '</div>' +
        '</div>' +
        /* Ein span und kein Knopf: der Satz erklaert das Bild darueber, er ist keine zweite
           Bedienung dafuer. Ein Knopf, der aussieht wie ein Verweis und nichts sichtbar tut, ist
           genau das, was gemeldet wurde. */
        '<span class="ums-hint">' +
          esc(t("Upload a picture — square images look best")) + '</span>' +
      '</div>';
    }

    function chartsHtml() {
      /* Alle drei Werte kommen aus core und werden dort auch gesetzt -- dieselben Setter, die das
         Zahnradmenue eines Charts benutzt. Ein zweiter Speicherort waere ein zweiter Zustand.
         Auch das MARKUP kommt aus core: der Zwei-Wege-Schalter und die Farbzeilen sind woertlich
         die des Zahnrads (UC.lineWidthSwitchHtml, UC.colorScaleOptionsHtml). Ein Nachbau waere ein
         zweites Aussehen fuer dieselbe Wahl. */
      var legende = UC.getLegendPref ? UC.getLegendPref() === "on" : true;
      var schema = UC.getColorScalePref ? UC.getColorScalePref() : "default";
      var name = schemaName(schema);
      return '<div class="ums-sec">' +
        '<h3 class="ums-sectitle">' + esc(t("Chart appearance")) + '</h3>' +
        '<div class="ums-secline"></div>' +
        zeileHtml("Line width", "The stroke of every line chart.",
          UC.lineWidthSwitchHtml ? UC.lineWidthSwitchHtml() : "") +
        /* Die Farbskala wirkt nur dort, wo sie auch heute schon waehlbar ist: an den
           Linien-Charts, also am Visibility Chart. Das steht in der Beschreibung, damit niemand
           sie an einem Doughnut sucht. */
        zeileHtml("Colors", "The palette for the lines in Visibility Chart. Brand colours from " +
          "your own data are used when this is set to Default.",
          '<span class="ums-selwrap" data-ums-wrap>' +
            '<button class="ums-sel ums-sel-scale" type="button" aria-haspopup="menu"' +
              ' aria-expanded="false" data-ums-selbtn="scale">' +
              '<span class="ums-sel-val">' + esc(t(name)) + '</span>' +
              UC.icon("chevronDown", 2.2) +
            '</button>' +
            '<div class="up-menu ums-menu ums-menu-scale" role="menu" aria-hidden="true"></div>' +
          '</span>') +
        zeileHtml("Show legend", "The legend under a line chart, with one entry per brand.",
          schalterHtml("legend", legende)) +
      '</div>';
    }
    function themaJetzt() {
      return UC.getUpstreemThemeChoice ? UC.getUpstreemThemeChoice() : "system";
    }
    function schemaName(key) {
      if (key === "default") return "Default";
      var sc = UC.COLOR_SCALES && UC.COLOR_SCALES[key];
      return sc ? sc.label : "Default";
    }

    function zeichnen() {
      if (!M) return;
      popovers.forEach(function (p) { try { p.close(false); } catch (e) {} });
      popovers = [];
      M.aside.innerHTML = asideHtml();
      var s = SEITEN.filter(function (x) { return x.key === seite; })[0] || SEITEN[0];
      M.main.innerHTML = kopfHtml(s) +
        (seite === "profile" ? profileHtml() : (seite === "charts" ? chartsHtml() : prefsHtml()));
    }

    /* ---- Auswahlmenue ---- */
    function menueOeffnen(btn) {
      var name = btn.getAttribute("data-ums-selbtn");
      var wrap = btn.closest("[data-ums-wrap]");
      var menu = wrap && wrap.querySelector(".ums-menu");
      if (!menu) return;
      if (name === "scale") {
        menu.innerHTML = UC.colorScaleOptionsHtml(
          UC.getColorScalePref ? UC.getColorScalePref() : "default", null);
        var popS = UC.makePopover({
          wrap: wrap, menu: menu, opener: btn, group: "ums",
          onClose: function () { btn.setAttribute("aria-expanded", "false"); }
        });
        popovers.push(popS);
        popS.open();
        btn.setAttribute("aria-expanded", "true");
        return;
      }
      var liste = name === "locale" ? SPRACHEN
                : name === "num"    ? ZAHLEN
                : name === "theme"  ? THEMEN : DATEN;
      var jetzt = name === "theme" ? themaJetzt() : UC.getPref(name);
      menu.innerHTML = liste.map(function (o) {
        var bsp = name === "num" ? zahlBeispiel(o.wert)
                : (name === "date" ? datumBeispiel(o.wert) : "");
        return '<button class="up-optrow' + (o.wert === jetzt ? " is-on" : "") + '" type="button"' +
          ' data-ums-set="' + esc(name) + '" data-ums-val="' + esc(o.wert) + '">' +
          flagge(o, "ums-flag") +
          '<span>' + esc(t(o.name)) + '</span>' +
          (bsp && bsp !== o.name ? '<span class="ums-opt-bsp">' + esc(bsp) + '</span>' : "") +
          '<span class="ums-opt-check">' + UC.icon("check", 2.6) + '</span>' +
        '</button>';
      }).join("");
      var pop = UC.makePopover({
        wrap: wrap, menu: menu, opener: btn, group: "ums",
        onClose: function () { btn.setAttribute("aria-expanded", "false"); }
      });
      popovers.push(pop);
      pop.open();
      /* Ohne das bleibt das Plaettchen auf dem Laendercode stehen, bis das Bild geladen ist --
         derselbe Aufruf, den der Markets-Filter nach jedem Neubau seiner Liste macht. */
      if (UC.wireFlags) UC.wireFlags(menu);
      btn.setAttribute("aria-expanded", "true");
    }

    function setzen(name, wert) {
      popovers.forEach(function (p) { try { p.close(true); } catch (e) {} });
      if (name === "theme") {
        /* Der Weg von core, derselbe, den das Konto-Menue der Seitenleiste geht: er faerbt jede
           Wurzel der Seite um, merkt die Wahl und loest "System" nach der Systemeinstellung auf. */
        if (window.setUpstreemTheme) window.setUpstreemTheme(wert);
      } else {
        UC.setPref(name, wert);
      }
      nachBubble(name, wert);
      zeichnen();
    }
    /* Jede Aenderung geht ZUSAETZLICH nach Bubble -- aber nur, wenn es dort einen Empfaenger gibt.
       Der Vorrat liegt im Browser (wie das Thema seit immer), das genuegt fuer ein Geraet. Wer die
       Einstellung am NUTZER speichern will, damit sie auf dem naechsten Rechner wieder da ist,
       legt ein JavaScript-to-Bubble-Element namens umsPrefs an -- und ab dann kommt sie.
       Vorher geprueft statt einfach gefeuert: makeFire klagt in der Konsole ueber jeden Namen, den
       es nicht auflosen kann, und eine Warnung fuer eine Sache, die niemand bestellt hat, ist
       Laerm. */
    function nachBubble(name, wert) {
      var da = false;
      try {
        da = typeof UC.resolveBubbleFn("umsPrefs") === "function" ||
             typeof UC.resolveBubbleFn("bubble_fn_umsPrefs") === "function";
      } catch (e) {}
      if (!da) return;
      fireBauen();
      fire("data-prefs-fn", "umsPrefs", { name: name, value: wert });
    }
    function schemaSetzen(key) {
      popovers.forEach(function (p) { try { p.close(true); } catch (e) {} });
      if (UC.setColorScalePref) UC.setColorScalePref(key);
      zeichnen();
    }
    function schalten(name) {
      if (name === "legend" && UC.setLegendPref) {
        UC.setLegendPref(UC.getLegendPref() === "on" ? "off" : "on");
      }
      zeichnen();
    }

    /* ---- Profil ---- */
    function namenSpeichern() {
      var feld = M.main.querySelector("[data-ums-name]");
      var v = String((feld && feld.value) || "").trim();
      if (!v || v === profil.name) return;
      profil.name = v;
      fireBauen();
      fire("data-name-fn", "umsName", { display_name: v });
      /* NICHT neu zeichnen: der Wert steht schon im Feld, und ein Neubau waehrend des Verlassens
         nimmt dem naechsten Element den Fokus. Nur die Initiale im Bild wird nachgezogen. */
      var av = M.main.querySelector(".ums-avatar-ltr");
      if (av) av.textContent = (v.charAt(0) || "?").toUpperCase();
    }

    /* ---- Oeffnen und Schliessen ---- */
    function oeffnen(welche) {
      if (!M) bauen();
      fireBauen();
      if (welche && SEITEN.some(function (s) { return s.key === welche; })) seite = welche;
      /* Profil-Angaben aus der Seitenleiste uebernehmen, wenn sie dort schon stehen -- sie ist das
         einzige Element, das Name, Bild und Kennung des Nutzers ohnehin kennt. Ohne sie bleibt das
         Feld leer und die Kennung "–"; erfunden wird nichts. */
      profilLesen();
      offen = true;
      M.back.classList.remove("is-closing");
      M.back.classList.add("is-shown");
      opener = document.activeElement;
      document.addEventListener("keydown", aufTaste);
      zeichnen();
    }
    function schliessen() {
      if (!M || !offen) return;
      offen = false;
      popovers.forEach(function (p) { try { p.close(false); } catch (e) {} });
      popovers = [];
      document.removeEventListener("keydown", aufTaste);
      M.back.classList.add("is-closing");
      M.back.classList.remove("is-shown");
      setTimeout(function () { if (M) M.back.classList.remove("is-closing"); }, 160);
      try { if (opener && opener.focus) opener.focus(); } catch (e) {}
    }
    function aufTaste(e) {
      if (e.key !== "Escape" || !offen) return;
      /* Ist ein Auswahlmenue offen, gehoert Escape ihm -- core schliesst es ueber seine eigene
         Registry. Erst der zweite Druck schliesst das Fenster. */
      var einsOffen = popovers.some(function (p) { try { return p.isOpen(); } catch (er) { return false; } });
      if (einsOffen) return;
      schliessen();
    }

    /* Name und Bild stehen in der Seitenleiste am Konto-Knopf. Gesucht wird im DOKUMENT und NICHT
       in .usn-root: die Leiste haengt ihren .usn-bar aus der eigenen Wurzel heraus (sie muss am
       Bildschirmrand kleben, nicht im Kasten des Bubble-Elements). Genau daran lag der leere
       Namen -- .usn-root gab es, aber [data-acc-name] lag nicht darin. Gemessen:
       usnRootDa true, barInRoot FALSE, accNameGefunden FALSE.
       Der verlaesslichere Weg ist trotzdem der andere: sidebar.js ruft beim Oeffnen
       setUpstreemProfile() mit dem Payload, den es von Bubble ohnehin hat -- inklusive Kennung,
       die im Markup gar nicht steht. Das hier ist der Rueckfall, wenn das Fenster von woanders
       geoeffnet wird. */
    function profilLesen() {
      var sn = document.querySelector(".usn-bar") || document;
      var n = sn.querySelector("[data-acc-name]");
      if (n && !profil.name) profil.name = String(n.textContent || "").trim();
      var wurzel = document.querySelector(".usn-root");
      if (wurzel) profil.userId = profil.userId ||
        String(wurzel.getAttribute("data-user") || wurzel.getAttribute("data-user-id") || "").trim();
      /* .usn-av ist die Kachel am Konto-Knopf der Leiste (data-av im Markup). Die alte Fassung
         suchte .usn-acc-logo -- das ist die TEAM-Kachel, also war hier das falsche Bild gemeint
         und meistens gar keines. */
      var img = sn.querySelector(".usn-av img");
      if (img && img.getAttribute("src")) profil.avatar = profil.avatar || img.getAttribute("src");
      /* Die E-Mail traegt der Knopf ebenfalls -- als Rueckfall fuer den Namen, genau wie es die
         Leiste selbst macht (u.name || u.email). */
      if (!profil.name) {
        var m = sn.querySelector("[data-acc-mail]");
        if (m) profil.name = String(m.textContent || "").trim();
      }
    }

    /* ---- Der oeffentliche Weg ---- */
    window.openUpstreemPreferences = function (welche) { oeffnen(welche); };
    window.closeUpstreemPreferences = function () { schliessen(); };
    /* Damit Bubble Name, Bild und Kennung setzen kann, wenn die Seitenleiste sie nicht traegt. */
    window.setUpstreemProfile = function (p) {
      p = (p && typeof p === "object") ? p : (UC.readBubble ? UC.readBubble(p) : null);
      if (!p) return;
      if (typeof p.display_name === "string") profil.name = p.display_name.trim();
      if (typeof p.avatar_url === "string") profil.avatar = p.avatar_url.trim();
      if (typeof p.user_id === "string") profil.userId = p.user_id.trim();
      if (offen) zeichnen();
    };

    /* Das Fenster selbst muss auf einen Sprachwechsel reagieren -- er passiert IN ihm. */
    /* Nicht zeichnen, solange ein Auswahlmenue offen steht: der Neubau wirft es aus dem Dokument,
       und der Nutzer klickt danach auf ein Menue, das nicht mehr im Baum haengt. setzen() zeichnet
       ohnehin selbst, nachdem es die Menues geschlossen hat. */
    if (UC.onPrefs) UC.onPrefs(function () {
      if (!offen) return;
      var offenesMenue = popovers.some(function (p) {
        try { return p.isOpen && p.isOpen(); } catch (e) { return false; }
      });
      if (!offenesMenue) zeichnen();
    });
  }

  umsBoot(50);
})();
