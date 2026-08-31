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

    /* ---- Die Wahlmöglichkeiten ----
       Ein Eintrag je Wert, mit dem Namen und -- wo es hilft -- einem BEISPIEL. Das Beispiel ist der
       eigentliche Trick dieser Seite: "Numeric" sagt niemandem etwas, "12.12.2025" sofort alles.
       Die Beispiele werden GERECHNET und nicht geschrieben, damit sie nicht von dem abweichen
       koennen, was die App danach wirklich zeigt. */
    var BEISPIEL_DATUM = "2025-12-12T10:30:00Z";
    var BEISPIEL_ZAHL = 1234.56;

    var SPRACHEN = [
      { wert: "en", name: "English" },
      { wert: "de", name: "Deutsch" }
    ];
    var ZAHLEN = [
      { wert: "en", name: "1,234.56" },
      { wert: "de", name: "1.234,56" }
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
         Es muss mit DEM Wert der Zeile rechnen und nicht mit dem eingestellten -- also kurz
         umschalten, messen, zuruecksetzen. Das schreibt in den localStorage, deshalb nur beim
         Aufbau des Menues und nicht bei jedem Zeichnen. */
      var alt = UC.getPref("num");
      if (alt === wert) return UC.fmtTotal(1240);
      UC.setPref("num", wert);
      var s = UC.fmtTotal(1240);
      UC.setPref("num", alt);
      return s;
    }
    function datumBeispiel(wert) {
      /* Hier geht es ohne Umschalten: core rechnet das Muster auf Zuruf. */
      return UC.fmtDateMuster(UC.datumsTeile(BEISPIEL_DATUM), wert);
    }

    /* ---- Zustand des Fensters ---- */
    var M = null;                 /* die gebauten Knoten */
    var seite = "prefs";          /* prefs | profile | charts */
    var offen = false, opener = null;
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
        var sw = e.target.closest("[data-ums-toggle]");
        if (sw) { schalten(sw.getAttribute("data-ums-toggle")); return; }
        if (e.target.closest("[data-ums-copyid]")) { kennungKopieren(e.target.closest("[data-ums-copyid]")); return; }
        if (e.target.closest("[data-ums-avatar]")) { fire("data-avatar-fn", "umsAvatar", { action: "change" }); return; }
        if (e.target.closest("[data-ums-savename]")) { namenSpeichern(); return; }
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
    function selHtml(name, liste, jetzt) {
      var akt = null;
      liste.forEach(function (o) { if (o.wert === jetzt) akt = o; });
      return '<span class="ums-selwrap" data-ums-wrap>' +
        '<button class="ums-sel" type="button" aria-haspopup="menu" aria-expanded="false"' +
          ' data-ums-selbtn="' + esc(name) + '">' +
          '<span class="ums-sel-val">' + esc(akt ? akt.name : jetzt) + '</span>' +
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
      '</div>';
    }

    function profileHtml() {
      var buchst = (profil.name || "?").trim().charAt(0).toUpperCase() || "?";
      return '<div class="ums-sec">' +
        '<h3 class="ums-sectitle">' + esc(t("Your account")) + '</h3>' +
        '<div class="ums-secline"></div>' +
        '<div class="ums-row"><div class="ums-rowtext"><div class="ums-prof">' +
          '<span class="ums-avatar">' +
            (profil.avatar ? '<img src="' + esc(profil.avatar) + '" alt="" referrerpolicy="no-referrer"' +
              ' onerror="this.remove()"/>' : esc(buchst)) +
          '</span>' +
          '<span class="ums-profbtns">' +
            '<button class="up-btn-sec" type="button" data-ums-avatar>' +
              esc(t("Change picture")) + '</button>' +
            '<span class="ums-profhint">' + esc(t("Square images look best.")) + '</span>' +
          '</span>' +
        '</div></div><div class="ums-rowctl"></div></div>' +
        zeileHtml("Name", "The name your team sees next to your activity.",
          '<input class="ums-in" type="text" maxlength="80" data-ums-name value="' +
            esc(profil.name) + '" placeholder="' + esc(t("Your name")) + '">' +
          '<button class="up-export" type="button" data-ums-savename>' + esc(t("Save")) + '</button>') +
        zeileHtml("User ID", "You may be asked for this when contacting support.",
          '<span class="ums-id">' +
            '<span class="ums-idtxt">' + esc(profil.userId || "–") + '</span>' +
            '<button class="up-btn-sec" type="button" data-ums-copyid' +
              (profil.userId ? "" : " disabled") + '>' + esc(t("Copy")) + '</button>' +
          '</span>') +
      '</div>';
    }

    function chartsHtml() {
      /* Beide Werte kommen aus core und werden dort auch gesetzt -- dieselben Setter, die das
         Zahnradmenue eines Charts benutzt. Ein zweiter Speicherort waere ein zweiter Zustand. */
      var duenn = UC.getLineWidthPref ? UC.getLineWidthPref() === "thin" : false;
      var legende = UC.getLegendPref ? UC.getLegendPref() === "on" : true;
      return '<div class="ums-sec">' +
        '<h3 class="ums-sectitle">' + esc(t("Chart appearance")) + '</h3>' +
        '<div class="ums-secline"></div>' +
        zeileHtml("Thin lines", "Draws every line chart with a thinner stroke.",
          schalterHtml("linewidth", duenn)) +
        zeileHtml("Show legend", "The legend under a line chart, with one entry per brand.",
          schalterHtml("legend", legende)) +
      '</div>';
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
      var liste = name === "locale" ? SPRACHEN : (name === "num" ? ZAHLEN : DATEN);
      var jetzt = UC.getPref(name);
      menu.innerHTML = liste.map(function (o) {
        var bsp = name === "num" ? zahlBeispiel(o.wert)
                : (name === "date" ? datumBeispiel(o.wert) : "");
        return '<button class="up-optrow' + (o.wert === jetzt ? " is-on" : "") + '" type="button"' +
          ' data-ums-set="' + esc(name) + '" data-ums-val="' + esc(o.wert) + '">' +
          '<span>' + esc(o.name) + '</span>' +
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
      btn.setAttribute("aria-expanded", "true");
    }

    function setzen(name, wert) {
      popovers.forEach(function (p) { try { p.close(true); } catch (e) {} });
      UC.setPref(name, wert);
      /* HIER waere die Zeile, die den Wert zusaetzlich nach Bubble meldet, wenn er einmal am
         Nutzer gespeichert werden soll:
             fire("data-prefs-fn", "umsPrefs", { name: name, value: wert });
         Sie steht bewusst nicht drin -- gewaehlt wurde "im Browser, wie das Thema", und ein
         Ereignis, das kein Workflow hoert, ist nur eine Warnung in der Konsole. */
      zeichnen();
    }
    function schalten(name) {
      if (name === "linewidth" && UC.setLineWidthPref) {
        UC.setLineWidthPref(UC.getLineWidthPref() === "thin" ? "thick" : "thin");
      } else if (name === "legend" && UC.setLegendPref) {
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
      zeichnen();
    }
    function kennungKopieren(btn) {
      if (!profil.userId) return;
      var fertig = function () {
        var alt = btn.textContent;
        btn.textContent = t("Copied");
        setTimeout(function () { btn.textContent = alt; }, 1400);
      };
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(profil.userId).then(fertig, ersatz);
          return;
        }
      } catch (e) {}
      ersatz();
      /* Rueckfall fuer Browser ohne Zwischenablage-API und fuer Seiten ohne https: ein unsichtbares
         Feld, markieren, kopieren. Das ist der Weg, der ueberall funktioniert. */
      function ersatz() {
        try {
          var ta = document.createElement("textarea");
          ta.value = profil.userId;
          ta.style.cssText = "position:fixed;left:-9999px;top:0";
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          document.body.removeChild(ta);
          fertig();
        } catch (e) {}
      }
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

    /* Name, Bild und Kennung stehen in der Seitenleiste am Konto-Knopf bzw. an ihrer Wurzel. */
    function profilLesen() {
      var sn = document.querySelector(".usn-root");
      if (!sn) return;
      var n = sn.querySelector("[data-acc-name]");
      if (n && !profil.name) profil.name = String(n.textContent || "").trim();
      profil.userId = profil.userId ||
        String(sn.getAttribute("data-user") || sn.getAttribute("data-user-id") || "").trim();
      var img = sn.querySelector(".usn-acc-logo img, .usn-acc img");
      if (img && img.getAttribute("src")) profil.avatar = profil.avatar || img.getAttribute("src");
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
    if (UC.onPrefs) UC.onPrefs(function () { if (offen) zeichnen(); });
  }

  umsBoot(50);
})();
