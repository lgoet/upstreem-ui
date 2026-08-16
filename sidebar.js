/* upstreem sidebar.js — die App-Navigation (Praefix `usn`). Braucht core.js.

   ── Ein Traeger, die Leiste haengt an <body> ─────────────────────────────────
   Das Element auf der Bubble-Seite ist 0x0 und zeigt nichts. Die Leiste selbst wird an <body>
   gehaengt und ist position:fixed -- wie der Export-Dialog und das Topic-Modal. Damit entfaellt
   die Floating Group, und kein Bubble-Container mit overflow:hidden kann etwas abschneiden.
   Das Element muss in Bubble trotzdem SICHTBAR sein: unsichtbare Elemente veroeffentlichen ihre
   bubble_fn_*-Funktionen nicht, und dann erreicht kein Klick einen Workflow.

   ── Zwei Ausbaustufen, drei Zustaende ────────────────────────────────────────
   >= 900px  wide   250px, Text, Ueberschriften, Zaehler, Team-Chips
   >= 500px  mini    64px, nur Icons
   <  500px  hint   Leiste weg, schwebender Knopf oben links faehrt sie ueber den Inhalt

   Der Klick auf das Symbol oben rechts schaltet zwischen wide und mini und merkt sich das pro
   Instanz. Beim Wechsel in eine andere Groessenklasse faellt die Wahl weg -- sonst haette jemand
   auf dem Telefon eine 250px-Leiste, weil er sie am Schreibtisch aufgeklappt hatte.

   ── Menuepunkte stehen im Code ───────────────────────────────────────────────
   Beschriftung, Reihenfolge und Icons aendern sich selten; eine Liste, die bei jedem
   Seitenaufbau durch ein Event muss, waere eine Fehlerquelle mehr. Von aussen kommen nur
   Zustand und Zahlen: aktiver Punkt, Prompt-Zaehler, Teams, Nutzer.

   ── Was aus core kommt ───────────────────────────────────────────────────────
   Die Panels sind .up-filter-menu mit .up-ddsearch, die Zeilen .up-pop-opt mit .up-pop-head und
   .up-check, die Logos .up-logo-box, die Team-Chips UC.brandStack, die Icons UC.icon. */
(function(){
  "use strict";

  var BOOTQ = window.__usnBootQueue = window.__usnBootQueue || [];
  if (!window.__usnBootStubbed){
    window.__usnBootStubbed = true;
    /* Bubble ruft diese Namen im Pageload, moeglicherweise bevor core.js und diese Datei da
       sind. Ohne Stubs geht der erste Aufruf verloren -- und das ist genau der, der die Teams
       liefert. */
    ["setSidebarTeams", "setSidebarUser", "setSidebarActive", "setSidebarCount",
     "setSidebarOpen", "resetSidebar"].forEach(function(n){
      window[n] = function(){ BOOTQ.push([n, arguments]); };
    });
  }
  function usnBoot(triesLeft){
    if (!window.UpstreemCore){
      if (triesLeft > 0){ setTimeout(function(){ usnBoot(triesLeft - 1); }, 100); return; }
      if (window.console) console.error("[sidebar] UpstreemCore (core.js) not loaded");
      return;
    }
    usnRun();
  }

  var BREIT = 900, MINI = 500;
  var W_WIDE = 250, W_MINI = 64;

  /* Die drei Bloecke. key ist der Wert, der im Event landet und den setSidebarActive erwartet. */
  var BLOECKE = [
    { head: "Database", items: [
      { key: "dashboard",  label: "Dashboard",       icon: "house" },
      { key: "prompts",    label: "Prompt Insights", icon: "zap", count: true },
      { key: "citations",  label: "Citations",       icon: "globe" },
      { key: "brands",     label: "Brands",          icon: "squareStack" }
    ]},
    { head: "Workspace", items: [
      { key: "performance",   label: "Performance",     icon: "chartColumnUp" },
      { key: "opportunities", label: "Opportunities",   icon: "listTodo" },
      { key: "research",      label: "Prompt Research", icon: "scanSearch" },
      { key: "mira",          label: "Mira",            icon: "mira" }
    ]},
    { head: "Organisation", items: [
      { key: "teams",    label: "Teams",    icon: "folder", chips: true },
      { key: "settings", label: "Settings", icon: "bolt" }
    ]}
  ];

  var KONTO = [
    { head: "Account Settings", items: [
      { key: "preferences", label: "Account Preferences", icon: "bolt" },
      { key: "team",        label: "Team Organisation",   icon: "folder" },
      { key: "billing",     label: "Billing",             icon: "creditCard" }
    ]},
    { head: "Theme", theme: true, items: [
      { key: "light",  label: "Light"  },
      { key: "dark",   label: "Dark"   },
      { key: "system", label: "System" }
    ]},
    { items: [{ key: "logout", label: "Log out", icon: "logOut" }] }
  ];

  /* ── Lucide statt Feather, nur in dieser Komponente ──────────────────────────
     Die Hausregel sagt Feather ueber UC.icon; das hier ist eine ausdrueckliche Ausnahme auf
     Wunsch, zum Ansehen. Die Pfade sind woertlich aus lucide-static 1.31.0 uebernommen (nicht
     nachgezeichnet) -- Lucide teilt Rasterbreite 24, runde Enden und die Strichlogik mit
     Feather, deshalb passen sie ohne Umrechnung in dieselbe Huelle wie UC.icon sie baut.
     Bewusst NICHT in core: dort steht der Feather-Satz, den alle anderen Komponenten benutzen.
     Zwei Saetze in einer Datei waeren ein Bruch, zwei Saetze in einer App sind eine Entscheidung
     -- faellt sie fuer Lucide, wandert dieser Block nach core und die anderen Komponenten
     ziehen mit. Bis dahin bleibt er hier, wo er niemanden sonst trifft. */
  var LUCIDE = {
    house:     '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/>' +
               '<path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    zap:       '<path d="M15.914 4a1.5 1.5 0 0 0-2.474-1.561l-9 9A1.5 1.5 0 0 0 5.5 14h4.002a.5.5 0 0 1 .471.666L8.086 20a1.5 1.5 0 0 0 2.475 1.56l9-9A1.5 1.5 0 0 0 18.5 10h-3.997a.5.5 0 0 1-.472-.667z"/>',
    globe:     '<circle cx="12" cy="12" r="10"/>' +
               '<path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
    squareStack:'<path d="M4 10c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h4c1.1 0 2 .9 2 2"/>' +
               '<path d="M10 16c-1.1 0-2-.9-2-2v-4c0-1.1.9-2 2-2h4c1.1 0 2 .9 2 2"/>' +
               '<rect width="8" height="8" x="14" y="14" rx="2"/>',
    chartColumnUp:'<path d="M13 17V9"/><path d="M18 17V5"/>' +
               '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M8 17v-3"/>',
    listTodo:  '<path d="M13 5h8"/><path d="M13 12h8"/><path d="M13 19h8"/>' +
               '<path d="m3 17 2 2 4-4"/><rect x="3" y="4" width="6" height="6" rx="1"/>',
    scanSearch:'<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/>' +
               '<path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/>' +
               '<circle cx="12" cy="12" r="3"/><path d="m16 16-1.9-1.9"/>',
    folder:    '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
    bolt:      '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>' +
               '<circle cx="12" cy="12" r="4"/>',
    creditCard:'<rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/>',
    logOut:    '<path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>' +
               '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>',
    ellipsis:  '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
    chevronsUpDown:'<path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/>',
    search:    '<path d="m21 21-4.34-4.34"/><circle cx="11" cy="11" r="8"/>',
    x:         '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    check:     '<path d="M20 6 9 17l-5-5"/>',
    plus:      '<path d="M5 12h14"/><path d="M12 5v14"/>',
    sparkles:  '<path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"/>' +
               '<path d="M20 2v4"/><path d="M22 4h-4"/><circle cx="4" cy="20" r="2"/>',
    panelLeft: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/>'
  };
  /* Dieselbe Huelle, die UC.icon baut -- gleiche viewBox, gleiche Enden, gleiche Strichstaerke.
     Nur die Pfade kommen aus einem anderen Satz. */
  function lucide(name, strichstaerke){
    var d = LUCIDE[name];
    if (!d){
      if (window.console) console.error("[sidebar] kein Lucide-Icon namens \"" + name + "\" -- " +
        "vorhanden sind: " + Object.keys(LUCIDE).join(", "));
      return "";
    }
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' +
      (strichstaerke == null ? 1.8 : strichstaerke) +
      '" stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>';
  }

  /* Mira ist eine Wortmarke, kein Feather-Symbol -- deshalb zwei Bilddateien statt eines Pfades.
     Fest im Code und nicht ueber ein Bubble-Attribut: die Marke aendert sich nicht pro
     Platzierung, und ein leeres Attribut haette hier ein leeres Icon bedeutet. Ueberschreibbar
     bleibt es trotzdem (data-mira-icon / data-mira-icon-dark), falls doch mal etwas anderes
     dort stehen soll. */
  var MIRA_HELL = "//49eaeb540a500f6e4ee0dfc1266fad7e.cdn.bubble.io/f1782122277820x302350779276307400/Group.svg";
  var MIRA_DUNKEL = "//49eaeb540a500f6e4ee0dfc1266fad7e.cdn.bubble.io/f1782132391699x758155530670363800/mira-logo-dark.svg";

  /* Feather hat kein Sidebar-Symbol, hier stand deshalb eine handgezeichnete Form. Lucide hat
     eine: panel-left. Damit ist auch dieses Icon aus einem Satz und nicht mehr selbst gemalt. */
  var BAR_SVG = lucide("panelLeft", 1.8);

  /* Bubble liefert Bild-URLs oft ohne Protokoll (//49eae...). Auf einer https-Seite laeuft das,
     im lokalen Harness nicht -- und ein fehlendes Logo sieht aus wie ein Fehler, obwohl nur zwei
     Zeichen fehlen. Dieselbe Behandlung wie in UC.brandStack. */
  function url(v){
    var s = String(v == null ? "" : v).trim();
    if (!s || /^[A-Z_]{3,}$/.test(s)) return "";
    return s.indexOf("//") === 0 ? "https:" + s : s;
  }
  function initialen(name, mail){
    var n = String(name || "").trim();
    if (n){
      var t = n.split(/\s+/).filter(Boolean);
      /* Zwei Buchstaben nur bei Vor- UND Nachname. Bei einem einzelnen Wort waere der zweite
         Buchstabe desselben Wortes keine Initiale, sondern Zufall. */
      if (t.length >= 2) return (t[0].charAt(0) + t[t.length - 1].charAt(0)).toUpperCase();
      return t[0].charAt(0).toUpperCase();
    }
    var m = String(mail || "").trim();
    return m ? m.charAt(0).toUpperCase() : "?";
  }

  function makeController(root){
    var UC = window.UpstreemCore;
    var esc = UC.esc;
    var instanceId = root.getAttribute("data-instance") || "default";
    var fire = UC.makeFire(root, { label: "sidebar", eventPrefix: "" });

    function attr(n, f){
      var v = root.getAttribute(n);
      return (v == null || v === "" || /^[A-Z_]{3,}$/.test(v)) ? (f || "") : v;
    }
    function ic(name){
      if (name === "mira"){
        var dunkel = bar.getAttribute("data-theme") === "dark";
        var q = url(attr(dunkel ? "data-mira-icon-dark" : "data-mira-icon", dunkel ? MIRA_DUNKEL : MIRA_HELL));
        /* Der Funkelstern aus core liegt darunter, das Bild darueber und blendet ihn aus.
           Faellt das Bild aus, nimmt es sich samt der Klasse weg und der Stern wird sichtbar --
           ein leerer Platz neben einem Menuepunkt sieht aus, als fehle etwas. Gleiche Bauart
           wie .up-logo-box mit has-img. */
        return lucide("sparkles", 1.8) +
          '<img class="usn-mira" src="' + esc(q) + '" alt="" ' +
          'onerror="this.parentNode.classList.remove(\'has-mira\');this.remove()"/>';
      }
      return lucide(name, 1.8);
    }
    /* .up-logo-box aus core: ein Element, Buchstabe darunter, Bild darueber. Faellt das Bild
       aus, verliert die Box has-img und der Buchstabe wird sichtbar. */
    function logoHtml(name, u){
      var q = url(u);
      var ltr = '<span class="up-logo-ltr">' + esc(String(name || "?").trim().charAt(0) || "?") + '</span>';
      if (!q) return '<span class="up-logo-box">' + ltr + '</span>';
      return '<span class="up-logo-box has-img"><img src="' + esc(q) + '" alt="" referrerpolicy="no-referrer" ' +
        'onerror="this.remove();this.parentNode.classList.remove(\'has-img\')"/>' + ltr + '</span>';
    }

    /* Die manuelle Wahl ueberlebt den Seitenwechsel, aber nur innerhalb derselben
       Groessenklasse -- siehe Kopf der Datei. */
    var PREF = "usn_collapsed__" + instanceId;
    function prefLesen(){ try { return localStorage.getItem(PREF) === "yes"; } catch(e){ return false; } }
    function prefSchreiben(v){ try { localStorage.setItem(PREF, v ? "yes" : "no"); } catch(e){} }

    var state = {
      klasse: "",            /* wide | mini | hint -- aus der Fensterbreite */
      eingeklappt: prefLesen(),
      offen: false,          /* nur im hint-Zustand: faehrt die Leiste ueber den Inhalt */
      aktiv: attr("data-active", "dashboard"),
      teams: [], team: null,
      /* Getrennt vom Inhalt: "noch nichts angekommen" ist ein anderer Zustand als "angekommen
         und leer". Nur der erste zeigt Skelette -- der zweite zeigt, was da ist. */
      teamsDa: false, userDa: false,
      user: { name: "", email: "", avatar: "" },
      count: attr("data-prompt-count"),
      suche: "",
      gemeldet: ""           /* zuletzt gefeuerter usnState-Payload, siehe anwenden() */
    };

    /* ---------------- Aufbau ---------------- */
    /* Reste einer frueheren Fassung derselben Instanz wegraeumen. Bubble baut diese Elemente
       staendig neu auf; ohne das haengen nach ein paar Wechseln mehrere Leisten uebereinander,
       jede mit eigenen Zuhoerern. */
    ["usn-bar", "usn-fab", "usn-scrim"].forEach(function(k){
      var alt = document.querySelectorAll("." + k + "[data-usn-instance=\"" + instanceId + "\"]");
      for (var i = 0; i < alt.length; i++){
        /* Quick Actions ZUERST herausholen. Die Palette wurde in die alte Leiste umgehaengt und
           waere mit ihr geloescht worden -- genau das sah man beim Seitenaufbau: kurz da, dann
           weg, sobald Bubble das Traegerelement neu injizierte. Sie wandert an <body> und wird
           gleich darauf in die neue Leiste geholt. */
        var pal = alt[i].querySelector && alt[i].querySelector("#mira-quick-actions");
        if (pal) document.body.appendChild(pal);
        if (alt[i].parentNode) alt[i].parentNode.removeChild(alt[i]);
      }
    });

    var bar = document.createElement("div");
    bar.className = "up-root up-portal usn-bar";
    var fab = document.createElement("button");
    fab.className = "up-root up-portal up-iconbtn usn-fab";
    fab.type = "button";
    fab.setAttribute("aria-label", "Open navigation");
    fab.innerHTML = BAR_SVG;
    var scrim = document.createElement("div");
    scrim.className = "up-root up-portal usn-scrim";
    [bar, fab, scrim].forEach(function(el){ el.setAttribute("data-usn-instance", instanceId); });

    bar.innerHTML =
      '<div class="usn-top usn-pop" data-top>' +
        '<button class="usn-team" type="button" data-team-btn aria-haspopup="menu" aria-expanded="false">' +
          '<span class="usn-teamlogo" data-team-logo></span>' +
          '<span class="usn-teamname usn-txt" data-team-name></span>' +
          '<span class="usn-sw usn-txt" data-team-sw></span>' +
        '</button>' +
        '<button class="up-iconbtn usn-toggle" type="button" data-toggle aria-label="Collapse sidebar"></button>' +
        /* Die Panels bleiben IMMER im Layout (STYLEGUIDE 6) -- sichtbar wird nur .is-shown.
           Ein Panel, das per hidden erst beim Oeffnen erscheint, kann seinen Uebergang nicht
           laufen lassen. */
        '<div class="up-filter-menu usn-menu is-team" data-team-menu aria-hidden="true" data-up-noescape></div>' +
      '</div>' +
      '<div class="usn-qa" data-qa></div>' +
      '<nav class="usn-nav up-scroll" data-nav></nav>' +
      '<div class="usn-pop usn-accwrap" data-accwrap>' +
        '<button class="usn-acc" type="button" data-acc aria-haspopup="menu" aria-expanded="false">' +
          '<span class="usn-av" data-av></span>' +
          '<span class="usn-acc-txt usn-txt">' +
            '<span class="usn-acc-name" data-acc-name></span>' +
            '<span class="usn-acc-mail" data-acc-mail></span>' +
          '</span>' +
          '<span class="usn-acc-more usn-txt" data-acc-more></span>' +
        '</button>' +
        '<div class="up-filter-menu usn-menu is-acc" data-acc-menu aria-hidden="true" data-up-noescape></div>' +
      '</div>';

    document.body.appendChild(scrim);
    document.body.appendChild(bar);
    document.body.appendChild(fab);
    /* Die Leiste haengt an <body>, also ausserhalb jeder Wurzel, die der Theme-Durchlauf beim
       Setzen schon gesehen hat. Einmal von Hand nachziehen, was gerade gilt. */
    try {
      var jetzt = null;
      try { jetzt = localStorage.getItem("pref_theme"); } catch(e){}
      if (jetzt === "dark"){
        [bar, fab, scrim].forEach(function(el){
          el.setAttribute("data-theme", "dark"); el.setAttribute("data-isdark", "yes");
        });
      }
    } catch(e){}

    var elTop      = bar.querySelector("[data-top]");
    var elAccWrap  = bar.querySelector("[data-accwrap]");
    var elTeamBtn  = bar.querySelector("[data-team-btn]");
    var elTeamLogo = bar.querySelector("[data-team-logo]");
    var elTeamName = bar.querySelector("[data-team-name]");
    var elTeamMenu = bar.querySelector("[data-team-menu]");
    var elToggle   = bar.querySelector("[data-toggle]");
    var elNav      = bar.querySelector("[data-nav]");
    var elAcc      = bar.querySelector("[data-acc]");
    var elAccMenu  = bar.querySelector("[data-acc-menu]");
    var elAv       = bar.querySelector("[data-av]");
    var elAccName  = bar.querySelector("[data-acc-name]");
    var elAccMail  = bar.querySelector("[data-acc-mail]");

    bar.querySelector("[data-team-sw]").innerHTML = ic("chevronsUpDown");
    bar.querySelector("[data-acc-more]").innerHTML = ic("ellipsis");
    elToggle.innerHTML = BAR_SVG;

    /* ---------------- Breite ---------------- */
    function klasseAusBreite(){
      var w = window.innerWidth || document.documentElement.clientWidth || 0;
      return w >= BREIT ? "wide" : (w >= MINI ? "mini" : "hint");
    }
    function istMini(){ return state.klasse === "mini" || (state.klasse === "wide" && state.eingeklappt); }

    function anwenden(melden){
      var k = klasseAusBreite();
      if (k !== state.klasse){
        /* Klassenwechsel verwirft die Handwahl: sie galt fuer eine andere Bildschirmgroesse. */
        state.klasse = k;
        state.offen = false;
        if (k !== "wide") state.eingeklappt = false;
      }
      var hint = state.klasse === "hint";
      var mini = !hint && istMini();

      bar.classList.toggle("is-mini", mini);
      bar.classList.toggle("is-hidden", hint && !state.offen);
      /* Der Knopf verschwindet, sobald die Leiste draussen ist: sonst laege er auf dem
         Team-Logo, und zum Schliessen gibt es den Schleier daneben. */
      fab.classList.toggle("is-on", hint && !state.offen);
      scrim.classList.toggle("is-on", hint && state.offen);

      elToggle.hidden = hint;
      elToggle.setAttribute("aria-label", mini ? "Expand sidebar" : "Collapse sidebar");

      /* Im hint-Zustand belegt die Leiste keinen Platz -- sie liegt UEBER dem Inhalt. */
      var px = hint ? 0 : (mini ? W_MINI : W_WIDE);
      /* Die Breite als Variable an <html>: wer seinen Seitencontainer mit
         padding-left: var(--up-sidebar-w) versieht, braucht keinen Workflow und hat den
         Uebergang automatisch synchron zur Leiste. */
      try { document.documentElement.style.setProperty("--up-sidebar-w", px + "px"); } catch(e){}

      var payload = { mode: hint ? "hint" : (mini ? "mini" : "wide"),
                      visible: hint ? "no" : "yes", px: px };
      var schluessel = payload.mode + "|" + payload.visible + "|" + payload.px;
      /* Nur bei echter Aenderung feuern. anwenden() laeuft an jedem resize-Tick, und ein Event
         pro Frame waere ein Bubble-Workflow pro Frame. */
      if (melden === false){ state.gemeldet = schluessel; return; }
      if (schluessel === state.gemeldet) return;
      state.gemeldet = schluessel;
      fire("data-state-fn", "usnState", payload);
    }

    /* ---------------- Zeichnen ---------------- */
    function renderTeam(){
      var t = state.team || {};
      if (!state.teamsDa && !t.name){
        elTeamLogo.innerHTML = '<span class="usn-sk"></span>';
        elTeamName.innerHTML = '<span class="usn-sk"></span>';
        elTeamBtn.removeAttribute("title");
        if (typeof qaAufbauen === "function") qaAufbauen(0);
        return;
      }
      elTeamLogo.innerHTML = logoHtml(t.name, t.favicon_url);
      elTeamName.textContent = t.name || "";
      elTeamBtn.setAttribute("title", t.name || "");
      /* Die Palette speichert Favoriten pro Team -- ihr data-team muss also mitwandern. */
      if (typeof qaAufbauen === "function") qaAufbauen(0);
    }
    function renderNav(){
      elNav.innerHTML = BLOECKE.map(function(b){
        return '<div class="usn-block">' +
          '<span class="usn-head">' + esc(b.head) + '</span>' +
          b.items.map(function(it){
            var extra = "";
            if (it.count) extra = '<span class="usn-count usn-fade" data-count>' + esc(state.count || "") + '</span>';
            if (it.chips) extra = '<span class="usn-chips usn-fade" data-chips></span>';
            return '<button class="usn-item' + (it.key === state.aktiv ? " is-active" : "") + '" ' +
              'type="button" data-nav-key="' + esc(it.key) + '" title="' + esc(it.label) + '">' +
              '<span class="usn-ic' + (it.icon === "mira" ? " has-mira" : "") + '">' + ic(it.icon) + '</span>' +
              '<span class="usn-txt">' + esc(it.label) + '</span>' + extra + '</button>';
          }).join("") +
        '</div>';
      }).join("");
      renderChips();
    }
    /* Die Team-Vorschau neben "Teams": UC.brandStack, dieselben Chips wie die erwaehnten Marken
       in den Tabellen. Drei Logos, der Rest als "+N". */
    function renderChips(){
      var el = elNav.querySelector("[data-chips]");
      if (!el) return;
      var liste = state.teams || [];
      if (!state.teamsDa){ el.innerHTML = '<span class="usn-sk usn-sk-chips"></span>'; return; }
      el.innerHTML = liste.length ? UC.brandStack(liste, liste.length, { max: 3 }) : "";
    }
    function renderAcc(){
      var u = state.user || {};
      if (!state.userDa){
        elAv.innerHTML = '<span class="usn-sk"></span>';
        elAccName.innerHTML = '<span class="usn-sk"></span>';
        elAccMail.innerHTML = '<span class="usn-sk"></span>';
        elAcc.removeAttribute("title");
        return;
      }
      var q = url(u.avatar);
      /* Initialen als Grundlage, das Bild darueber -- faellt es aus, steht wieder der Buchstabe
         da statt eines leeren Kreises. Gleiche Bauart wie .up-logo-box. */
      elAv.innerHTML = esc(initialen(u.name, u.email)) +
        (q ? '<img src="' + esc(q) + '" alt="" referrerpolicy="no-referrer" onerror="this.remove()"/>' : "");
      elAccName.textContent = u.name || u.email || "";
      elAccMail.textContent = u.email || "";
      elAcc.setAttribute("title", u.email || u.name || "");
    }

    /* ---------------- Menues ---------------- */
    function themaJetzt(){
      try {
        var g = localStorage.getItem("pref_theme");
        if (g === "dark" || g === "light") return g;
      } catch(e){}
      return "system";
    }
    function renderTeamMenu(){
      var such = state.suche.toLowerCase();
      var liste = (state.teams || []).filter(function(t){
        if (!such) return true;
        return String(t.name || "").toLowerCase().indexOf(such) >= 0 ||
               String(t.domain || "").toLowerCase().indexOf(such) >= 0;
      });
      elTeamMenu.innerHTML =
        '<div class="up-ddsearch usn-ddsearch' + (state.suche ? " has-text" : "") + '">' +
          '<span class="up-ddsearch-ic">' + ic("search") + '</span>' +
          '<input class="up-ddsearch-in" type="text" placeholder="Search teams" ' +
            'value="' + esc(state.suche) + '" data-search/>' +
          '<button class="up-ddsearch-x" type="button" data-search-x aria-label="Clear">' + ic("x") + '</button>' +
        '</div>' +
        '<div class="usn-teamlist up-scroll">' +
          (liste.length ? liste.map(function(t){
            var an = state.team && String(state.team.id) === String(t.id);
            return '<div class="up-pop-opt usn-teamrow' + (an ? " is-active" : "") + '" ' +
              'data-team-id="' + esc(t.id) + '">' +
              logoHtml(t.name, t.favicon_url) +
              '<span class="usn-teamrow-txt">' +
                '<span class="usn-teamrow-name">' + esc(t.name || "") + '</span>' +
                '<span class="usn-teamrow-dom">' + esc(t.domain || "") + '</span>' +
              '</span>' +
              '<span class="up-check">' + ic("check") + '</span>' +
            '</div>';
          }).join("") : '<div class="usn-none">No teams found</div>') +
        '</div>' +
        '<div class="usn-menu-foot">' +
          '<button class="usn-newteam" type="button" data-newteam>' + ic("plus") + 'Create a new team</button>' +
        '</div>';
    }
    function renderAccMenu(){
      var th = themaJetzt();
      elAccMenu.innerHTML = KONTO.map(function(s){
        return '<div class="usn-sec">' +
          (s.head ? '<span class="up-pop-head">' + esc(s.head) + '</span>' : "") +
          s.items.map(function(it){
            var an = s.theme && it.key === th;
            return '<div class="up-pop-opt' + (an ? " is-active" : "") + '" ' +
              'data-acc-key="' + esc(it.key) + '"' + (s.theme ? ' data-theme-key="1"' : "") + '>' +
              '<span class="up-pop-opt-l">' + (it.icon ? ic(it.icon) : "") + esc(it.label) + '</span>' +
              (s.theme ? '<span class="up-check">' + ic("check") + '</span>' : "") +
            '</div>';
          }).join("") +
        '</div>';
      }).join("");
    }
    /* UC.makePopover aus core: EIN Klick-Zuhoerer fuer die ganze Seite, schliesst jedes andere
       offene Dropdown der App mit, Escape und Fokus inklusive. Selbst gebaut hatte das hier
       einen eigenen pointerdown-Zuhoerer -- und ein rAF, das in einem verdeckten Tab nicht
       laeuft, so dass das Panel offen, aber unsichtbar stehenblieb. */
    var popTeam = UC.makePopover({
      wrap: elTop, menu: elTeamMenu, opener: elTeamBtn, group: "usn",
      onClose: function(){ elTeamBtn.setAttribute("aria-expanded", "false"); }
    });
    var popAcc = UC.makePopover({
      wrap: elAccWrap, menu: elAccMenu, opener: elAcc, group: "usn",
      onClose: function(){ elAcc.setAttribute("aria-expanded", "false"); }
    });
    function teamAuf(){
      state.suche = ""; renderTeamMenu();
      popTeam.open();
      elTeamBtn.setAttribute("aria-expanded", "true");
      var s = elTeamMenu.querySelector("[data-search]");
      if (s) setTimeout(function(){ try { s.focus(); } catch(e){} }, 30);
    }
    function accAuf(){
      renderAccMenu();
      popAcc.open();
      elAcc.setAttribute("aria-expanded", "true");
    }
    function menuZu(){ popTeam.close(); popAcc.close(); }

    /* ---------------- Klicks ---------------- */
    bar.addEventListener("click", function(e){
      var t = e.target;
      if (!t || !t.closest) return;

      if (t.closest("[data-toggle]")){
        state.eingeklappt = !istMini();
        prefSchreiben(state.eingeklappt);
        menuZu(); anwenden();
        return;
      }
      if (t.closest("[data-team-btn]")){ if (popTeam.isOpen()) popTeam.close(); else teamAuf(); return; }
      if (t.closest("[data-acc]")){ if (popAcc.isOpen()) popAcc.close(); else accAuf(); return; }
      if (t.closest("[data-search-x]")){ state.suche = ""; renderTeamMenu(); return; }
      if (t.closest("[data-search]")) return;

      var tr = t.closest("[data-team-id]");
      if (tr){
        var id = tr.getAttribute("data-team-id");
        var neu = (state.teams || []).filter(function(x){ return String(x.id) === id; })[0];
        /* Sofort umstellen, nicht auf die Antwort warten: der Teamwechsel laedt die halbe Seite
           neu, und eine Leiste, die dabei den alten Namen zeigt, sieht aus wie ein Fehlklick. */
        if (neu){ state.team = neu; renderTeam(); }
        menuZu();
        fire("data-team-fn", "usnTeam", { team_id: id });
        return;
      }
      if (t.closest("[data-newteam]")){ menuZu(); fire("data-profile-fn", "usnProfile", { action: "new_team" }); return; }

      var ak = t.closest("[data-acc-key]");
      if (ak){
        var key = ak.getAttribute("data-acc-key");
        if (ak.getAttribute("data-theme-key")){
          /* Ueber setUpstreemTheme, nicht per Attribut: das schreibt den localStorage, faerbt
             JEDE .up-root der Seite und meldet sich ueber bubble_fn_theme_pref zurueck.
             "System" heisst: der Einstellung des Betriebssystems folgen -- deshalb setzen und
             die gespeicherte Wahl danach wieder loeschen, sonst haette der naechste
             Seitenaufbau eine feste Wahl statt der Systemfarbe. */
          if (key === "system"){
            var sysDunkel = false;
            try { sysDunkel = !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches); } catch(e){}
            if (window.setUpstreemTheme) window.setUpstreemTheme(sysDunkel ? "dark" : "light");
            try { localStorage.removeItem("pref_theme"); } catch(e){}
          } else if (window.setUpstreemTheme) window.setUpstreemTheme(key);
          renderAccMenu(); renderNav();
          fire("data-profile-fn", "usnProfile", { action: "theme", value: key });
          return;
        }
        menuZu();
        fire("data-profile-fn", "usnProfile", { action: key });
        return;
      }

      var nb = t.closest("[data-nav-key]");
      if (nb){
        var k = nb.getAttribute("data-nav-key");
        state.aktiv = k; renderNav();
        menuZu();
        /* Auf dem Telefon faehrt die Leiste nach der Wahl wieder ein -- sonst steht der Nutzer
           vor der Seite, die er gerade geoeffnet hat, und sieht sie nicht. */
        if (state.klasse === "hint"){ state.offen = false; anwenden(); }
        fire("data-nav-fn", "usnNav", { key: k });
        return;
      }
    });
    elTeamMenu.addEventListener("input", function(e){
      if (!e.target.closest || !e.target.closest("[data-search]")) return;
      state.suche = e.target.value;
      var pos = e.target.selectionStart;
      renderTeamMenu();
      var s = elTeamMenu.querySelector("[data-search]");
      if (s){ s.focus(); try { s.setSelectionRange(pos, pos); } catch(x){} }
    });

    fab.addEventListener("click", function(){ state.offen = !state.offen; anwenden(); });
    scrim.addEventListener("click", function(){ state.offen = false; anwenden(); });
    /* Klick daneben und Escape fuer die Menues macht makePopover. Hier bleibt nur die
       ausgefahrene Leiste auf dem Telefon -- und die erst, wenn kein Menue mehr offen ist,
       sonst raeumt ein Escape beides auf einmal weg. */
    document.addEventListener("keydown", function(e){
      if (e.key !== "Escape" && e.keyCode !== 27) return;
      if (popTeam.isOpen() || popAcc.isOpen()) return;
      if (state.klasse === "hint" && state.offen){ state.offen = false; anwenden(); }
    });
    /* Nur am Fenster horchen, NICHT per ResizeObserver an der Leiste: die Leiste aendert ihre
       Breite selbst, ein Beobachter an ihr wuerde anwenden() waehrend des Uebergangs in jedem
       Frame erneut aufrufen. */
    window.addEventListener("resize", function(){ anwenden(); });
    /* Theme-Wechsel: das Mira-Symbol hat zwei Fassungen, und der Haken im Konto-Menue muss
       mitwandern. */
    UC.onTheme(function(){ renderNav(); qaAufbauen(0); if (popAcc.isOpen()) renderAccMenu(); });

    /* Quick Actions steht als eigenes Element auf der Seite. Es wird hierher UMGEHAENGT, nicht
       nachgebaut -- ein Umzug laesst seinen Controller, seine Zuhoerer und sein Overlay
       unangetastet. Bubble baut die Seite in Schueben auf, deshalb 25 Versuche ueber 5s. */
    /* Erst kurz warten, ob die Seite ein eigenes Quick-Actions-Element mitbringt (Bubble baut in
       Schueben auf), dann selbst eines anlegen. Ohne das Warten stuenden auf einer Seite, die
       ihres nur spaeter einhaengt, am Ende zwei Elemente mit derselben id. */
    function qaAufbauen(wartenNoch){
      /* Eine abgehaengte Leiste ist tot und fasst nichts mehr an. Ohne diese Zeile holte der
         Wachposten der ALTEN Leiste die Palette in seinen laengst entfernten Container zurueck --
         und damit aus dem Dokument heraus. Gemessen nach einer Neu-Injektion: null Paletten im
         Dokument, obwohl die neue Leiste sie gerade uebernommen hatte. */
      if (!document.contains(bar)) return;
      var ziel = bar.querySelector("[data-qa]");
      if (!ziel) return;
      var qa = document.getElementById("mira-quick-actions");
      if (!qa && wartenNoch > 0){ setTimeout(function(){ qaAufbauen(wartenNoch - 1); }, 150); return; }
      if (!qa){
        /* Keins auf der Seite: dann legt die Sidebar den Rahmen an. Gefuellt wird er von
           quick-actions.js -- das Markup steht dort, nicht hier. Zwei Kopien derselben 39 Zeilen
           waeren genau der Nachbau, den die Hausregel verbietet. */
        qa = document.createElement("div");
        qa.id = "mira-quick-actions";
        ziel.appendChild(qa);
      } else if (qa.parentNode !== ziel) ziel.appendChild(qa);
      /* Theme, Team und Export-Kennung durchreichen: die Palette liest sie von ihrem eigenen
         Element, und wenn die Sidebar sie anlegt, kennt sie sie sonst nicht. */
      qa.setAttribute("data-theme", bar.getAttribute("data-theme") === "dark" ? "dark" : "light");
      var team = (state.team && state.team.id) || attr("data-team-id");
      if (team) qa.setAttribute("data-team", team);
      var exp = attr("data-export-instance");
      if (exp) qa.setAttribute("data-export-instance", exp);
    }
    qaAufbauen(10);
    /* Und ein Wachposten darauf. Die Palette kann ihren Platz auf zwei Wegen verlieren: die
       Leiste wird neu gebaut (oben abgefangen), oder Bubble baut SEIN Element neu, in dem sie
       urspruenglich lag. Ein leerer Platz an dieser Stelle sieht aus wie ein Layoutfehler --
       also nachfassen, sobald er leer wird. */
    try {
      var qaSlot = bar.querySelector("[data-qa]");
      if (qaSlot && window.MutationObserver){
        new MutationObserver(function(){
          if (!qaSlot.firstElementChild) qaAufbauen(6);
        }).observe(qaSlot, { childList: true });
      }
    } catch(e){}

    renderTeam(); renderNav(); renderAcc();
    /* Die Panels stehen von Anfang an im Layout, also auch von Anfang an gefuellt -- sonst
       klappte beim ersten Oeffnen ein leerer Kasten auf und fuellte sich erst danach. */
    renderTeamMenu(); renderAccMenu();
    anwenden(false);
    /* Der erste Zustandsbericht erst, wenn die Seite steht: ein Event mitten im Aufbau kaeme in
       Bubble an, bevor der Pageload-Workflow seine States ueberhaupt angelegt hat. */
    setTimeout(function(){ state.gemeldet = ""; anwenden(); }, 60);

    return {
      root: root,
      setTeams: function(rows){
        var l = rows, roh = typeof rows === "string" ? rows.replace(/^\s+|\s+$/g, "") : null;
        if (roh != null) l = UC.parseBubbleJson(l);
        /* Kaputt und leer sind zwei Dinge. Eine leere Liste ist ein gueltiger Zustand (ein Team,
           keine weiteren) und darf die Chips loeschen. Ein Payload, den parseBubbleJson nicht
           lesen konnte, darf das NICHT -- parseBubbleJson gibt im Fehlerfall ebenfalls ein
           leeres Array zurueck, die beiden Faelle sind also nur am ROHTEXT zu unterscheiden.
           Sonst stuende ploetzlich kein Team mehr da, obwohl nur der Bubble-Ausdruck kaputt war. */
        if (!Array.isArray(l) || (roh && roh !== "[]" && roh !== "" && !l.length)){
          if (window.console) console.warn("[sidebar] setSidebarTeams: der Payload war nicht lesbar. " +
            "Die bisherige Teamliste bleibt stehen. Payload:", rows);
          return false;
        }
        state.teams = l;
        state.teamsDa = true;
        var cur = attr("data-team-id");
        var treffer = state.teams.filter(function(t){ return String(t.id) === cur; })[0];
        /* Ohne data-team-id das erste Team: eine Leiste ohne Namen oben sieht kaputt aus, und
           die Liste kommt ohnehin mit dem aktuellen Team zuerst. */
        state.team = treffer || state.teams[0] || null;
        renderTeam(); renderChips();
        /* Immer neu zeichnen, nicht nur wenn offen: sonst steht im Panel noch "No teams found"
           aus dem Moment vor den Daten, bis es einmal geoeffnet wurde. */
        renderTeamMenu();
        return true;
      },
      setUser: function(u){
        var p = u;
        /* parseBubbleJson gibt IMMER eine Liste zurueck, auch fuer ein einzelnes Objekt. Ohne
           das Auspacken hier las jedes Feld undefined, und der Kopf unten blieb leer. */
        if (typeof p === "string") p = UC.parseBubbleJson(p);
        if (Array.isArray(p)) p = p[0];
        if (!p || typeof p !== "object"){
          if (window.console) console.warn("[sidebar] setSidebarUser: der Payload war nicht lesbar. " +
            "Der bisherige Kopf bleibt stehen. Payload:", u);
          return false;
        }
        state.userDa = true;
        state.user = {
          name: String(p.name || p.full_name || ""),
          email: String(p.email || ""),
          avatar: String(p.avatar_url || p.avatar || "")
        };
        renderAcc();
        return true;
      },
      setActive: function(k){ state.aktiv = String(k || ""); renderNav(); return true; },
      setCount: function(n){
        state.count = (n == null || n === "") ? "" : String(n);
        var el = elNav.querySelector("[data-count]");
        if (el) el.textContent = state.count;
        return true;
      },
      setOpen: function(v){
        var auf = UC.isYes(v);
        if (state.klasse === "hint") state.offen = auf;
        else { state.eingeklappt = !auf; prefSchreiben(state.eingeklappt); }
        anwenden();
        return true;
      },
      reset: function(){
        menuZu();
        state.offen = false; state.eingeklappt = false; prefSchreiben(false);
        anwenden();
        return true;
      },
      destroy: function(){
        [bar, fab, scrim].forEach(function(el){ if (el.parentNode) el.parentNode.removeChild(el); });
        root.__usnController = null;
      }
    };
  }

  var mount = null;
  function usnRun(){
    var UCl = window.UpstreemCore;
    mount = UCl.makeMount({
      onMount: function(m){ mount = m; },
      rootClass: "usn-root", notPortal: true,
      ctrlProp: "__usnController", resolveLocal: "__usnResolveLocal", queue: "__usnBootQueue",
      initRoot: initRootNow,
      api: {
        setSidebarTeams: doTeams,
        setSidebarUser: doUser,
        setSidebarActive: doActive,
        setSidebarCount: doCount,
        setSidebarOpen: doOpen,
        resetSidebar: doReset
      },
      forwardShape: { resetSidebar: "id" }
    });
  }
  /* Ohne mount NICHT aufgeben: die Warteschlange wird abgearbeitet, waehrend makeMount noch
     laeuft -- die Zuweisung an `mount` passiert erst danach. */
  function resolve(id){
    id = String(id || "").trim();
    var r = mount ? mount.rootsWithId(id) : rootsById(id);
    if (!r.length) return null;
    return r[0].__usnController || initRootNow(r[0]);
  }
  function rootsById(id){
    id = id || "default";
    var out = [], all = document.querySelectorAll(".usn-root:not(.up-portal)");
    for (var i = 0; i < all.length; i++){
      if ((all[i].getAttribute("data-instance") || "default") === id) out.push(all[i]);
    }
    return out;
  }
  function initRootNow(root){
    if (root.__usnController) return root.__usnController;
    /* Der Platzhalter aus der Vorlage ist kein Element, das gebaut werden will. */
    if ((root.getAttribute("data-instance") || "default") === "INSTANCE_ID") return null;
    var c = makeController(root);
    root.__usnController = c;
    return c;
  }
  function fehlt(id){
    if (window.console) console.warn("[sidebar] no instance for id " + id);
    return false;
  }
  function doTeams(id, rows){ var c = resolve(id); return c ? c.setTeams(rows) : fehlt(id); }
  function doUser(id, u){ var c = resolve(id); return c ? c.setUser(u) : fehlt(id); }
  function doActive(id, k){ var c = resolve(id); return c ? c.setActive(k) : fehlt(id); }
  function doCount(id, n){ var c = resolve(id); return c ? c.setCount(n) : fehlt(id); }
  function doOpen(id, v){ var c = resolve(id); return c ? c.setOpen(v) : fehlt(id); }
  function doReset(id){ var c = resolve(id); return c ? c.reset() : fehlt(id); }

  usnBoot(30);
})();
