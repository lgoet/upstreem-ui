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
     "setSidebarOpen", "resetSidebar", "setSidebarReady", "setSidebarLoading"].forEach(function(n){
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

  /* Bubble baut das Traegerelement waehrend des Seitenaufbaus neu auf. Der neue Controller
     faengt bei null an -- Teamname und Konto standen also kurz richtig da und wurden dann wieder
     zu Skeletten, weil die Daten am ALTEN Controller hingen. Sie liegen deshalb hier, ausserhalb
     des Controllers, nach Instanz getrennt. Dasselbe Muster wie MODELS_STORE in settings-brand,
     wo die Modelle nach dem Speichern verschwanden. */
  var STORE = window.__usnStore = window.__usnStore || {};
  function speicher(id){ return STORE[id] || (STORE[id] = {}); }

  var BREIT = 900, MINI = 500;
  var W_WIDE = 250, W_MINI = 64;

  /* Die drei Bloecke. key ist der Wert, der im Event landet und den setSidebarActive erwartet. */
  var BLOECKE = [
    { head: "Database", items: [
      { key: "dashboard",  label: "Dashboard",       icon: "home" },
      { key: "prompts",    label: "Prompt Insights", icon: "zap", count: true },
      { key: "citations",  label: "Citations",       icon: "globe" },
      { key: "brands",     label: "Brands",          icon: "squareStack", brands: true }
    ]},
    { head: "Workspace", items: [
      { key: "performance",   label: "Performance",     icon: "chartColumnUp" },
      { key: "opportunities", label: "Opportunities",   icon: "listTodo" },
      /* Schluessel "research", nicht "prompt-research" -- siehe AKTIV_SYNONYM weiter unten. */
      { key: "research",      label: "Prompt Research", icon: "telescope" },
      /* blend statt der Bilddatei: Mira traegt jetzt dasselbe Zeichen wie ihre Wortmarke in der
         Komponente selbst, und es kommt wie jedes andere aus UC.icon. Damit faellt der Sonderweg
         ueber ein Bild von Bubbles CDN weg -- mit ihm die zwei Helligkeitsfilter, die noetig
         waren, weil ein fremdes SVG sich nicht einfaerben laesst. */
      { key: "mira",          label: "Mira",            icon: "blend" }
    ]},
    { head: "Organisation", items: [
      { key: "teams",    label: "Teams",    icon: "folders", chips: true },
      { key: "settings", label: "Settings", icon: "bolt" }
    ]},
    /* Die angehefteten Eintraege. Der Block hat keine festen Punkte -- er kommt aus dem
       localStorage und wird gar nicht gezeichnet, solange nichts angeheftet ist. */
    { head: "Pinned", pinned: true, items: [] }
  ];

  /* Hoechstens zehn. Wird ein elfter angeheftet, faellt der LETZTE der Liste heraus -- also
     der aelteste, weil Neues oben einsortiert wird. */
  var PIN_MAX = 10;

  /* "prompt-research" als Synonym auf "research".
     Warum in dieser Richtung: der Punkt hiess von Anfang an "research", und die Bubble-Workflows
     sind darauf gebaut. In 5081167 habe ich den Schluessel auf "prompt-research" umbenannt --
     gefragt war das Icon, nicht der Schluessel. Damit traf der eine Zweig im Navigations-Workflow
     nicht mehr, und nur dieser Punkt tat nichts. Der Versuch danach, das mit einem Synonym zu
     heilen, ging in die falsche Richtung: er half data-active, also dem Weg HINEIN. Das EVENT
     sendete weiter den neuen Namen. Jetzt steht der Schluessel wieder auf "research", und der
     neue Name wird auf dem Weg hinein weiter akzeptiert.
     Auf Modulebene und nicht im Controller: die Zustandsvorbelegung greift schon darauf zu, und
     eine var-Zuweisung weiter unten waere zu diesem Zeitpunkt noch undefined. */
  var AKTIV_SYNONYM = { "prompt-research": "research" };
  /* Was aus Bubble kommt, ist ein State-Wert -- und der heisst dort gern "Dashboard" oder
     "Prompt Research", nicht "dashboard" bzw. "prompt-research". Traf er nicht genau, wurde
     nichts hervorgehoben: bei einem Wechsel setzt die Leiste den Punkt selbst, beim Seitenaufbau
     kommt er aber nur aus dem Attribut -- genau deshalb war Dashboard nach dem Laden nicht aktiv.
     Also klein schreiben, Rand abschneiden, Leerzeichen zu Bindestrichen. */
  function aktivNorm(v){
    var t = String(v == null ? "" : v).trim().toLowerCase().replace(/\s+/g, "-");
    return AKTIV_SYNONYM[t] || t;
  }

  /* Genau die Schluessel, die usnNav.key ausgibt -- data-active nimmt dieselben. Ein Wert, der
     hier nicht vorkommt, hebt nichts hervor; das darf nicht stumm passieren. */
  var NAV_KEYS = BLOECKE.reduce(function(a, b){
    return a.concat(b.items.map(function(it){ return it.key; }));
  }, []);

  var KONTO = [
    { head: "Account Settings", items: [
      /* Schluessel bleibt "preferences". Das Etikett ist neu, der Schluessel nicht -- an dem
         haengt der Bubble-Workflow, und eine Umbenennung hat genau bei Prompt Research einen
         Zweig stumm gelegt (siehe AKTIV_SYNONYM). logo: statt icon: -- die Zeile zeigt das
         Markenlogo des Teams, dasselbe wie der Umschalter oben. */
      { key: "preferences", label: "Your Brand", logo: true },
      /* Dieselben Zeichen wie die Unterseiten-Navigation im Einstellungs-Seitenkopf: derselbe
         Ort, dieselbe Sache, dasselbe Zeichen. Vorher standen hier folder und creditCard. */
      { key: "team",        label: "Team Organisation",   icon: "users" },
      { key: "billing",     label: "Billing",             icon: "dollarSign" }
    ]},
    { head: "Theme", theme: true, items: [
      { key: "light",  label: "Light"  },
      { key: "dark",   label: "Dark"   },
      { key: "system", label: "System" }
    ]},
    { items: [{ key: "logout", label: "Log out", icon: "logOut" }] }
  ];

  /* Mira traegt jetzt ein normales Symbol aus demselben Satz wie jeder andere Punkt der Leiste:
     Lucide galaxy. Vorher stand hier die Wortmarke als BILD -- zwei Dateien auf Bubbles CDN, je
     eine pro Thema, dazu ein Helligkeitsfilter in der CSS und ein Rueckfall darunter, falls der
     Abruf scheitert. Ein Icon aus dem Satz braucht davon nichts und dreht sich mit der Farbe der
     Zeile mit.
     Die zwei Attribute bleiben der Sonderweg: wer data-mira-icon / data-mira-icon-dark setzt,
     bekommt sein Bild weiter ueber das Symbol gelegt. Sie stehen im Vertrag, also verschwinden
     sie nicht, nur weil die VORGABE eine andere ist.
     Deshalb auch keine festen Adressen mehr an dieser Stelle: ohne Attribut gibt es kein Bild. */

  /* Feather hat kein Sidebar-Symbol, hier stand deshalb eine handgezeichnete Form. Lucide hat
     eine: panel-left. Damit ist auch dieses Icon aus einem Satz und nicht mehr selbst gemalt. */
  var BAR_SVG = null;   /* gebaut in makeController, sobald UC da ist */

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
    /* Erst hier, nicht auf Modulebene: UC steht beim Laden dieser Datei noch nicht fest. */
    /* Der Umschalter oben rechts traegt jetzt das gefuellte Zeichen aus core (sidebarPanels):
       schmaler Balken, Luecke, groesseres Feld. Die Farben stehen an .usn-toggle -- Drittfarbe im
       Ruhezustand, Primaerfarbe beim Hover -- und ein gefuelltes SVG mit fill="currentColor" folgt
       ihnen von selbst. Der Knopf am Telefon (fab) bekommt dasselbe Zeichen: es ist derselbe
       Umschalter, nur an anderer Stelle. */
    if (!BAR_SVG) BAR_SVG = UC.icon("sidebarPanels");
    var fire = UC.makeFire(root, { label: "sidebar", eventPrefix: "" });

    function attr(n, f){
      var v = root.getAttribute(n);
      return (v == null || v === "" || /^[A-Z_]{3,}$/.test(v)) ? (f || "") : v;
    }
    /* Mira traegt jetzt ein Zeichen wie jeder andere Punkt (blend, siehe BLOECKE). Hier stand
       davor ein Sonderweg: ein Bild von Bubbles CDN ueber einem Symbol, dazu zwei Helligkeits-
       filter in der CSS, weil ein fremdes SVG sich weder faerben noch als Maske verwenden laesst
       (kein CORS-Header). Der ganze Weg ist mit dem Wechsel auf blend hinfaellig. */
    function ic(name){
      return UC.icon(name, 1.8);
    }
    /* .up-logo-box aus core: ein Element, Buchstabe darunter, Bild darueber. Faellt das Bild
       aus, verliert die Box has-img und der Buchstabe wird sichtbar. */
    /* extra: zusaetzliche Klasse am Kasten, wenn das 24er Bauteil auf eine andere Groesse
       gebracht wird (Pin-Zeile, Konto-Menue). */
    function logoHtml(name, u, extra){
      var q = url(u);
      var kl = "up-logo-box" + (extra ? " " + extra : "");
      var ltr = '<span class="up-logo-ltr">' + esc(String(name || "?").trim().charAt(0) || "?") + '</span>';
      if (!q) return '<span class="' + kl + '">' + ltr + '</span>';
      return '<span class="' + kl + ' has-img"><img src="' + esc(q) + '" alt="" referrerpolicy="no-referrer" ' +
        'onerror="this.remove();this.parentNode.classList.remove(\'has-img\')"/>' + ltr + '</span>';
    }

    /* Die manuelle Wahl ueberlebt den Seitenwechsel, aber nur innerhalb derselben
       Groessenklasse -- siehe Kopf der Datei. */
    var PREF = "usn_collapsed__" + instanceId;
    function prefLesen(){ try { return localStorage.getItem(PREF) === "yes"; } catch(e){ return false; } }
    function prefSchreiben(v){ try { localStorage.setItem(PREF, v ? "yes" : "no"); } catch(e){} }

    /* ── Was ins localStorage gehoert, und unter welchem Schluessel ────────────────
       Zwei verschiedene Dinge, zwei verschiedene Regeln -- die Begruendung steht in core bei
       storeKey():
       - Zugeklappte Gruppen und der Mini-Zustand sind ANSICHTSVORLIEBEN eines Geraets. Welche
         Gruppe jemand zugeklappt hat, ist dieselbe Entscheidung, egal in welchem Team er steht.
         Kein Team im Schluessel.
       - Angeheftete Eintraege sind ECHTE TEAMDATEN: Marken-, Prompt-, Domain- und URL-Kennungen
         gehoeren genau einem Team. Sie duerfen NIE ueber Teams hinweg auftauchen -- ein Pin aus
         Team A waere in Team B eine Kennung, die es dort nicht gibt.
       Und die Falle, in die core bei genau dieser Sache schon einmal gelaufen ist: die Team-Id ist
       beim Aufbau noch nicht immer bekannt. Wer dann unter "…@_" liest und spaeter unter
       "…@<team>" schreibt, hat zwei Schluessel und nie etwas zurueckbekommen. Deshalb wird hier
       gar nichts geladen, solange kein Team da ist -- und nachgeladen, sobald es eintrifft.
       Kaputter Inhalt (von Hand editiert, halb geschrieben) faellt still weg: ein Fehler im
       Speicher darf die Leiste nicht mitnehmen. */
    var ZU_KEY = "usn_closed__" + instanceId;
    /* Reihenfolge ist entscheidend: das ANGEZEIGTE Team gilt, nicht das Attribut. Beim Wechsel im
       Schalter stellt die Leiste sofort um, Bubble zieht data-team-id erst nach dem Neuladen nach --
       gemessen: mit dem Attribut zuerst blieben die Pins des alten Teams stehen und wurden im
       neuen Team weitergeschrieben. state.team stammt beim Aufbau ohnehin aus data-team-id, die
       Reihenfolge verliert also nichts. */
    function teamJetzt(){
      if (state && state.team && state.team.id) return String(state.team.id);
      var t = attr("data-team-id");
      if (t) return t;
      try { var g = UC.getUpstreemTeam && UC.getUpstreemTeam(); if (g) return String(g); } catch(e){}
      return "";
    }
    function pinKey(){
      var t = teamJetzt();
      return t ? ("usn_pins__" + instanceId + "@" + t) : null;
    }
    function pinsLesen(){
      var k = pinKey();
      if (!k) return [];
      try {
        var r = JSON.parse(localStorage.getItem(k) || "[]");
        return Array.isArray(r) ? r.filter(function(x){ return x && x.type && x.id != null; }) : [];
      } catch(e){ return []; }
    }
    /* Ein Topf ohne Team aus der ersten Fassung dieser Funktion. Er wird NICHT uebernommen: die
       Pins darin gehoeren zu einem Team, das niemand mehr kennt, und sie irgendeinem zuzuordnen
       waere genau die Vermischung, die hier nicht passieren darf. Also weg damit. */
    try { localStorage.removeItem("usn_pins__" + instanceId); } catch(e){}

    function pinsSchreiben(l){
      var k = pinKey();
      /* Ohne Team NICHT schreiben. Ein Schluessel ohne Team waere ein Topf, aus dem jedes Team
         liest -- genau das, was hier nicht passieren darf. */
      if (!k) return;
      try { localStorage.setItem(k, JSON.stringify(l)); } catch(e){}
    }
    function zuLesen(){
      try { var r = JSON.parse(localStorage.getItem(ZU_KEY) || "[]"); return Array.isArray(r) ? r : []; }
      catch(e){ return []; }
    }
    function zuSchreiben(l){ try { localStorage.setItem(ZU_KEY, JSON.stringify(l)); } catch(e){} }

    var vorrat = speicher(instanceId);
    var state = {
      klasse: "",            /* wide | mini | hint -- aus der Fensterbreite */
      eingeklappt: prefLesen(),
      offen: false,          /* nur im hint-Zustand: faehrt die Leiste ueber den Inhalt */
      aktiv: aktivNorm(attr("data-active", "dashboard")) || "dashboard",
      teams: vorrat.teams || [], team: vorrat.team || null,
      /* Getrennt vom Inhalt: "noch nichts angekommen" ist ein anderer Zustand als "angekommen
         und leer". Nur der erste zeigt Skelette -- der zweite zeigt, was da ist. */
      teamsDa: !!vorrat.teamsDa, userDa: !!vorrat.userDa,
      /* Der Marken-Zaehler kommt aus dem Store von core (setUpstreemBrands), nicht aus einem
         eigenen Setter -- die Liste liegt auf der Seite ohnehin. brandsDa trennt wieder
         "noch nichts da" von "da und leer". */
      brands: vorrat.brands == null ? null : vorrat.brands, brandsDa: !!vorrat.brandsDa,
      user: vorrat.user || { name: "", email: "", avatar: "" },
      /* Zwei Fragen, zwei Flaggen. Traegt das Element das Attribut ueberhaupt, will die Seite
         einen Zaehler -- dann steht bis zum ersten Wert ein Skelett. Fehlt das Attribut ganz,
         gibt es keinen Zaehler und auch kein Skelett. Sonst haette eine Seite, die bewusst ohne
         Zahl arbeitet, dort fuer immer einen laufenden Balken. */
      countErwartet: root.hasAttribute("data-prompt-count"),
      count: attr("data-prompt-count"),
      countDa: attr("data-prompt-count") !== "",
      suche: "",
      /* Angeheftete Eintraege und zugeklappte Gruppen -- beide aus dem localStorage, siehe oben.
         Die Pins koennen hier noch leer sein, wenn das Team erst spaeter eintrifft; pinsNachziehen
         holt sie dann nach. */
      pins: pinsLesen(), zu: zuLesen(),
      /* Alles auf einmal statt nacheinander. Die dynamischen Teile der Leiste kommen aus vier
         verschiedenen Quellen (Teams, Nutzer, Prompt-Zaehler, Marken-Store) und trafen beim
         Seitenaufbau in vier verschiedenen Momenten ein -- man sah vier Skelette einzeln
         umspringen. Bis zur Enthuellung zeigt jeder Teil sein Skelett, auch wenn seine Daten
         schon da sind; danach zeigt jeder, was er hat.
         Ausgeloest wird sie vom ersten Setter (Sammelfenster, siehe SAMMELFENSTER_MS), von
         setSidebarReady() oder spaetestens von der Notbremse -- eine Leiste, die auf einen
         Aufruf wartet, der nie kommt, darf nicht ewig im Skelett stehen. */
      enthuellt: !!vorrat.enthuellt,
      /* true zwischen dem Klick auf ein anderes Team und dem Neuaufbau der Seite. */
      laedt: false,
      /* {i, wert} waehrend eine angeheftete Zeile umbenannt wird, sonst null. Der Zwischenstand
         steht hier und nicht nur im Feld: die Leiste zeichnet sich aus vielen Gruenden neu, und
         ein Tippstand, der nur im DOM steht, waere dann weg. */
      umbenennen: null,
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

    /* Zustand VOR dem Einhaengen setzen. Sonst steht die Leiste einen Frame lang auf ihrer
       Grundbreite von 250px und faellt danach auf 64 -- sichtbar als kurzes Aufklappen bei jedem
       Neuaufbau des Elements, und Bubble baut es bei jeder Navigation neu.
       Ein Uebergang muss dafuer NICHT abgeschaltet werden: ein frisch eingefuegtes Element
       animiert nichts, es hat keinen Vorzustand. Genau das war der Fehler -- nicht der Uebergang,
       sondern die zweite Zustandsaenderung nach dem Einhaengen. */
    (function ersterZustand(){
      var w = window.innerWidth || document.documentElement.clientWidth || 0;
      var k = w >= BREIT ? "wide" : (w >= MINI ? "mini" : "hint");
      if (k === "hint") bar.classList.add("is-hidden");
      else if (k === "mini" || state.eingeklappt) bar.classList.add("is-mini");
    })();
    document.body.appendChild(scrim);
    document.body.appendChild(bar);
    document.body.appendChild(fab);
    /* Die Leiste haengt an <body>, also ausserhalb jeder Wurzel, die der Theme-Durchlauf beim
       Setzen schon gesehen hat. Einmal von Hand nachziehen, was gerade gilt.
       Gefragt wird UC.getUpstreemTheme(), NICHT der localStorage. Der ist bei der Wahl "System"
       naemlich absichtlich leer -- und dann blieb die Leiste hell, waehrend die ganze App dunkel
       war. Zu sehen war das an der Mira-Wortmarke: die haengt an data-theme der Leiste und stand
       im Dunkelmodus in der hellen Fassung. Der Rest der Leiste faerbt ueber dieselben Attribute,
       fiel aber weniger auf.
       Beide Zustaende setzen, nicht nur dunkel: die Elemente werden bei einem Neuaufbau erneut
       erzeugt, und ein stehengebliebenes data-theme waere derselbe Fehler in der anderen
       Richtung. Gleiche Bauart wie applyThemeTo in core. */
    try {
      var dunkelJetzt = (UC.getUpstreemTheme ? UC.getUpstreemTheme() : "light") === "dark";
      [bar, fab, scrim].forEach(function(el){
        if (dunkelJetzt) el.setAttribute("data-theme", "dark");
        else el.removeAttribute("data-theme");
        el.setAttribute("data-isdark", dunkelJetzt ? "yes" : "no");
      });
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

    bar.querySelector("[data-team-sw]").innerHTML = ic("chevronsUpDownWide");
    bar.querySelector("[data-acc-more]").innerHTML = ic("moreHorizontal");
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

      /* Eingeklappt gibt es keine Zeile, in der ein Textfeld Platz haette -- eine laufende
         Umbenennung wird darum beim Wechsel verworfen statt unsichtbar weiterzulaufen. */
      if (mini && state.umbenennen){ state.umbenennen = null; renderNav(); }
      bar.classList.toggle("is-mini", mini);
      bar.classList.toggle("is-hidden", hint && !state.offen);
      /* Der Knopf verschwindet, sobald die Leiste draussen ist: sonst laege er auf dem
         Team-Logo, und zum Schliessen gibt es den Schleier daneben. */
      fab.classList.toggle("is-on", hint && !state.offen);
      scrim.classList.toggle("is-on", hint && state.offen);

      /* Beim Wechsel zwischen wide und mini muessen die Gruppenhoehen neu gesetzt werden --
         im Mini-Zustand ohne Grenze, danach wieder mit der gemessenen. */
      if (typeof hoehenSetzen === "function") setTimeout(hoehenSetzen, 0);
      /* Im Mini-Zustand sind die Zeilen schmaler und stehen hoeher (keine Ueberschriften): die
         Marke muss beides uebernehmen. Zweimal, wie beim Zuklappen -- die Breite der Leiste
         faehrt 200ms. */
      if (typeof markeSetzen === "function"){
        setTimeout(function(){ markeSetzen(true); }, 0);
        setTimeout(function(){ markeSetzen(true); }, 260);
      }
      if (typeof tipsSchalten === "function") tipsSchalten();
      elToggle.hidden = hint;
      elToggle.setAttribute("aria-label", mini ? "Expand sidebar" : "Collapse sidebar");

      /* Im hint-Zustand belegt die Leiste keinen Platz -- sie liegt UEBER dem Inhalt. */
      var px = hint ? 0 : (mini ? W_MINI : W_WIDE);
      /* Die Breite als Variable an <html>: wer seinen Seitencontainer mit
         padding-left: var(--up-sidebar-w) versieht, braucht keinen Workflow und hat den
         Uebergang automatisch synchron zur Leiste. */
      try { document.documentElement.style.setProperty("--up-sidebar-w", px + "px"); } catch(e){}

      /* wide und hint sind fuer Bubble da: sie bilden die zwei States der App direkt ab, ohne dass
         ein Workflow erst aus mode etwas ableiten muss. visible bleibt, was es war -- "belegt die
         Leiste Platz im Layout" -- damit bestehende Verdrahtungen weiterlaufen. */
      var payload = { mode: hint ? "hint" : (mini ? "mini" : "wide"),
                      wide: (!hint && !mini) ? "yes" : "no",
                      hint: hint ? "yes" : "no",
                      visible: hint ? "no" : "yes", px: px };
      var schluessel = payload.mode + "|" + payload.visible + "|" + payload.px;
      /* Nur bei echter Aenderung feuern. anwenden() laeuft an jedem resize-Tick, und ein Event
         pro Frame waere ein Bubble-Workflow pro Frame. */
      if (melden === false){ state.gemeldet = schluessel; return; }
      if (schluessel === state.gemeldet) return;
      state.gemeldet = schluessel;
      stateMelden(payload);
    }

    /* Der Zustand ist der EINZIGE Aufruf, der beim Seitenaufbau zu FRUEH kommen kann: die Leiste
       steht nach 60ms, Bubble veroeffentlicht seine bubble_fn_* aber erst, wenn das Toolbox-Element
       fertig aufgebaut ist. Vorher lief der Aufruf ins Leere, und der State blieb auf seinem
       Anfangswert -- sichtbar daran, dass die Leiste nach einem Neuladen richtig eingeklappt war,
       der Bubble-State aber weiter "yes" sagte.
       Also nachfassen statt einmal versuchen: 20 Anlaeufe im Abstand von 150ms, dasselbe Muster wie
       upstreemSignal in core. Ist inzwischen ein neuerer Zustand faellig, wird der alte verworfen --
       ein veralteter Wert, der nachtraeglich ankommt, waere schlimmer als keiner. */
    var stateLauf = 0;
    function stateMelden(payload){
      var meineRunde = ++stateLauf;
      var name = attr("data-state-fn") || "bubble_fn_usnState";
      function versuch(uebrig){
        if (meineRunde !== stateLauf) return;          /* ueberholt, es gilt ein neuerer Zustand */
        var fn = null;
        try { fn = UC.resolveBubbleFn && UC.resolveBubbleFn(name); } catch(e){}
        if (typeof fn === "function"){ fire("data-state-fn", "usnState", payload); return; }
        if (uebrig > 0){ setTimeout(function(){ versuch(uebrig - 1); }, 150); return; }
        /* Nach 3s aufgeben -- und dann EINMAL ueber fire melden, damit die gewohnte Warnung samt
           Namensliste in der Konsole steht. */
        fire("data-state-fn", "usnState", payload);
      }
      versuch(20);
    }

    /* ---------------- Zeichnen ---------------- */
    function renderTeam(){
      var t = state.team || {};
      if (!state.enthuellt || (!state.teamsDa && !t.name)){
        elTeamLogo.innerHTML = '<span class="usn-sk"></span>';
        elTeamName.innerHTML = '<span class="usn-sk"></span>';
        elTeamBtn.removeAttribute("data-tiplabel"); elTeamBtn.removeAttribute("data-tip");
        if (typeof qaAufbauen === "function") qaAufbauen(0);
        return;
      }
      elTeamLogo.innerHTML = logoHtml(t.name, t.favicon_url);
      elTeamName.textContent = t.name || "";
      elTeamBtn.setAttribute("data-tiplabel", t.name || "");
      elTeamBtn.setAttribute("data-tip-place", "right");
      /* Die Palette speichert Favoriten pro Team -- ihr data-team muss also mitwandern. */
      if (typeof qaAufbauen === "function") qaAufbauen(0);
      /* Und die Pins gehoeren zum Team: beim ersten bekannten Team laden, bei jedem Wechsel
         umschalten. */
      pinsNachziehen();
    }
    /* Ein data-active, das keinem Nav-Schluessel entspricht, hebt nichts hervor -- und das sieht
       aus wie ein Fehler in der Leiste, obwohl der Wert daneben liegt. Einmal sagen, welche
       Schluessel es gibt. */
    var aktivGemeldet = "";
    function aktivPruefen(){
      if (!state.aktiv || NAV_KEYS.indexOf(state.aktiv) >= 0) return;
      if (aktivGemeldet === state.aktiv) return;
      aktivGemeldet = state.aktiv;
      if (window.console) console.warn("[sidebar] \"" + state.aktiv + "\" ist kein Menuepunkt. " +
        "Moeglich sind: " + NAV_KEYS.join(", "));
    }
    /* Ein angehefteter Eintrag: Bild vorne, einzeiliger Name, rechts das X zum Entfernen.
       Dieselbe Zeilenform wie ein Menuepunkt, damit die Gruppe kein Fremdkoerper ist. Das Bild
       ist .up-logo-box aus core -- beim Prompt die Flagge des Marktes, sonst Logo bzw. Favicon.
       Faellt es aus, bleibt der Anfangsbuchstabe. */
    function pinHtml(pin, i){
      /* Waehrend des Umbenennens ist die Zeile KEIN Knopf. Ein <input> in einem <button> ist
         verschachtelte Bedienung: der Browser haengt es aus dem Knopf heraus, und die Zeile
         faellt auseinander -- dieselbe Falle, aus der in quick-actions das <span role="button">
         entstanden ist. Also fuer die Dauer der Eingabe ein <div> mit denselben Klassen: gleiche
         Hoehe, gleiche Polsterung, gleicher Radius, nur ohne Knopfverhalten. Ohne data-pin, damit
         weder Navigation noch Ziehen anspringen. */
      if (state.umbenennen && state.umbenennen.i === i){
        return '<div class="usn-item usn-pin is-renaming" data-pinedit="' + i + '">' +
          '<span class="usn-pin-ic">' + logoHtml(state.umbenennen.wert, pin.logo) + '</span>' +
          '<input class="usn-pin-in" type="text" data-pinin maxlength="60" ' +
            'aria-label="Rename pinned item" value="' + esc(state.umbenennen.wert) + '" />' +
        '</div>';
      }
      /* Die zwei Skelett-Kaesten stehen im Markup und sind unsichtbar, bis die Zeile gezogen
         wird. Dann treten sie an die Stelle von Bild, Name und x -- dieselbe Bauart wie bei den
         Custom Groupings, wo die gezogene Zeile ebenfalls zum grauen Platzhalter wird. Sie
         werden NICHT beim Ziehen erzeugt: ein Element, das mitten in einer Zeigerbewegung
         entsteht, kostet einen Layoutdurchgang genau im falschen Moment. */
      return '<button class="usn-item usn-pin" type="button" data-pin="' + i + '" ' +
        'data-pinid="' + esc(pin.type + ":" + pin.id) + '" data-tip="' + esc(pin.label || "") + '" ' +
        'data-tip-place="right">' +
        '<span class="usn-pin-ic">' + logoHtml(pin.label, pin.logo) + '</span>' +
        '<span class="usn-txt">' + esc(pin.label || "") + '</span>' +
        '<span class="usn-pin-edit" data-rename="' + i + '" role="button" tabindex="-1" ' +
        'aria-label="Rename">' + ic("squarePen") + '</span>' +
        '<span class="usn-pin-x" data-unpin="' + i + '" role="button" tabindex="-1" ' +
        'aria-label="Remove from pinned">' + ic("x") + '</span>' +
        '<span class="usn-pin-sk-ic"></span><span class="usn-pin-sk-txt"></span>' +
      '</button>';
    }
    /* ---- Umbenennen -------------------------------------------------------------------------
       Der Name eines angehefteten Eintrags gehoert dem Nutzer: er steht nur im localStorage
       dieses Teams und geht nirgendwo nach Bubble. Deshalb braucht das Umbenennen keinen
       Workflow und keinen Event -- schreiben und neu zeichnen genuegt. */
    function umbenennenStart(i){
      var pin = state.pins[i];
      if (!pin) return;
      if (bar.classList.contains("is-mini")) return;   /* eingeklappt gibt es kein Textfeld */
      state.umbenennen = { i: i, wert: pin.label || "" };
      renderNav();
      var feld = elNav.querySelector("[data-pinin]");
      if (feld){ feld.focus(); try { feld.select(); } catch(e){} }
    }
    /* uebernehmen=false ist der Weg von Escape: der Wert wird verworfen, nicht geschrieben.
       Ein leerer Name wird ebenfalls verworfen -- eine Zeile ohne Beschriftung waere nicht mehr
       zuzuordnen, und der alte Name ist die einzige verbliebene Auskunft. */
    function umbenennenEnde(uebernehmen){
      var u = state.umbenennen;
      if (!u) return;
      state.umbenennen = null;
      var pin = state.pins[u.i];
      var wert = (u.wert || "").trim();
      if (uebernehmen && pin && wert && wert !== pin.label){
        pin.label = wert;
        pinsSchreiben(state.pins);
      }
      renderNav();
    }
    function navItemHtml(it){
      var extra = "";
      if (it.count) extra = '<span class="usn-count usn-fade" data-count>' +
        (state.countDa && state.enthuellt ? esc(state.count || "")
                       : (state.countErwartet ? '<span class="usn-sk"></span>' : "")) + '</span>';
      if (it.brands) extra = '<span class="usn-count usn-fade" data-brandcount>' +
        (state.brandsDa && state.enthuellt ? esc(state.brands == null ? "" : String(state.brands))
                        : '<span class="usn-sk"></span>') + '</span>';
      /* Teams zeigt jetzt die ZAHL, nicht die Logos. Dieselbe Klasse wie Prompts und Brands, also
         auch dieselbe Schrift, Farbe und Ziffernbreite -- drei Zaehler in einer Leiste sollen nicht
         in drei Bauarten dastehen. .usn-chips und die Logo-Vorschau sind damit heraus. */
      if (it.chips) extra = '<span class="usn-count usn-fade" data-teamcount>' +
        (state.teamsDa && state.enthuellt ? esc(String((state.teams || []).length))
                        : '<span class="usn-sk"></span>') + '</span>';
      /* data-tip statt title: der Browser-Tooltip erscheint verzoegert, an der Maus und in
         Systemoptik. data-tip ist der Chip des Hauses (.up-tip), und data-tip-place="right"
         setzt ihn neben den Punkt -- unter einem Icon steht in der eingeklappten Leiste schon
         das naechste. Im ausgeklappten Zustand nimmt die CSS den Chip weg: dort steht der Name
         ja daneben. */
      /* Markiert wird erst nach der Enthuellung. Vorher stand fuer einen Moment "Dashboard" da:
         data-active ist beim Bau noch leer, und der Rueckfall heisst dashboard -- das sah aus wie
         ein Sprung von Dashboard auf den richtigen Punkt. Solange die Leiste ihre Skelette zeigt,
         muss auch die Markierung nichts sagen; setSidebarReady() loest beides gemeinsam aus. */
      return '<button class="usn-item' + ((state.enthuellt && it.key === state.aktiv) ? " is-active" : "") + '" ' +
        'type="button" data-nav-key="' + esc(it.key) + '" data-tiplabel="' + esc(it.label) + '" ' +
        'data-tip-place="right">' +
        '<span class="usn-ic">' + ic(it.icon) + '</span>' +
        '<span class="usn-txt">' + esc(it.label) + '</span>' + extra + '</button>';
    }
    function renderNav(){
      aktivPruefen();
      elNav.innerHTML = BLOECKE.map(function(b){
        /* Die Pinned-Gruppe entsteht nur, wenn etwas angeheftet ist -- eine Ueberschrift ohne
           Inhalt ist kein Abschnitt, sondern ein Loch. */
        if (b.pinned && !state.pins.length) return "";
        var zu = state.zu.indexOf(b.head) >= 0;
        var inhalt = b.pinned ? state.pins.map(pinHtml).join("")
                              : b.items.map(navItemHtml).join("");
        /* Die Ueberschrift ist ein Knopf: ein Klick klappt die Gruppe zu. Der Chevron erscheint
           erst beim Hover, mit Verzoegerung -- im Ruhezustand soll die Leiste ruhig bleiben. */
        return '<div class="usn-block' + (zu ? " is-closed" : "") + '" data-block="' + esc(b.head) + '">' +
          '<button class="usn-head usn-fade" type="button" data-head="' + esc(b.head) + '" ' +
          'aria-expanded="' + (zu ? "false" : "true") + '">' +
            '<span class="usn-head-lbl">' + esc(b.head) + '</span>' +
            '<span class="usn-head-chev">' + ic("chevronDown") + '</span>' +
          '</button>' +
          '<div class="usn-block-body" data-body>' + inhalt + '</div>' +
        '</div>';
      }).join("");
      /* Die Marke wird NICHT mit innerHTML neu erzeugt: dasselbe Element wird wieder eingehaengt,
         behaelt seine Inline-Lage und faehrt von dort zur neuen Zeile. Ein frisches Element haette
         keine Ausgangslage und wuerde springen. Als erstes Kind, damit sie hinter den Zeilen liegt
         (die Reihenfolge entscheidet, z-index sichert es zusaetzlich). */
      if (!elMark){ elMark = document.createElement("span"); elMark.className = "usn-mark"; }
      elNav.insertBefore(elMark, elNav.firstChild);
      renderChips();
      hoehenSetzen();
      /* Beim ersten Mal OHNE Fahrt: eine Marke, die beim Aufbau der Seite von oben links
         herangleitet, behauptet einen Wechsel, den es nicht gab. */
      markeSetzen(!markeStand);
      markeBeobachten();
      if (typeof tipsSchalten === "function") tipsSchalten();
    }
    /* Nur die Markierung umsetzen -- KEIN Neuaufbau der Liste.
       Vorher lief bei jedem Klick renderNav(): innerHTML der ganzen Navigation neu, jede Zeile mit
       ihrem svg, dazu hoehenSetzen (liest je Gruppe scrollHeight und schreibt max-height, also ein
       erzwungenes Layout je Gruppe) und ein frischer ResizeObserver. Das lief VOR dem Event an
       Bubble, und genau so lange stand der Seitenwechsel. Hier bleibt: eine Klasse umsetzen und die
       Marke messen. Die Zeilen selbst aendern sich beim Wechsel des Punktes ja nicht. */
    function aktivMarkieren(){
      aktivPruefen();
      [].forEach.call(elNav.querySelectorAll(".usn-item"), function(b){
        var an = state.enthuellt && b.getAttribute("data-nav-key") === state.aktiv;
        b.classList.toggle("is-active", an);
      });
      markeSetzen(false);
    }
    /* ---- Die gleitende Marke ----
       Gemessen statt gerechnet, und zwar jedes Mal: die Zeilen sind unterschiedlich hoch, ihre
       Abstaende haengen an der Gruppe, und im Mini-Zustand sind sie schmaler. Eine Rechnung aus
       Zeilenzahl und Hoehe waere bei der ersten Aenderung falsch.
       offsetTop/offsetLeft und nicht getBoundingClientRect: die Leiste steht auf Seiten, die als
       Ganzes skaliert sein koennen (die Landingpage tut es), und das Rechteck liefert dort die
       verkleinerten Masse. Bezugsrahmen ist .usn-nav (position: relative in sidebar.css), also
       zaehlt die Scrollposition der Liste nicht mit. */
    var elMark = null, markeStand = false, markeRo = null, markeSchriftHaengt = false, markeSig = "";
    function markeSetzen(sofort){
      if (!elMark || !elMark.parentNode) return;
      var an = elNav.querySelector(".usn-item.is-active");
      if (!an || !an.offsetHeight){ elMark.classList.remove("is-bereit"); return; }
      /* Zugeklappte Gruppe: die ZEILE wird von der Gruppe beschnitten (overflow: hidden am
         Gruppenkoerper), die Marke NICHT -- sie liegt daneben in der Liste. Ohne diese Abfrage
         blieb der helle Balken an der Stelle stehen, an der die Zeile gerade verschwunden ist.
         Ihre offsetHeight bleibt dabei 36: Beschneiden aendert die Layoutgroesse nicht, deshalb
         faengt die Zeile darueber nichts ab. Ausgeblendet und nicht weggeraeumt -- die Marke
         faehrt mit derselben Zeit aus, in der die Gruppe zufaehrt. */
      var gruppe = an.closest ? an.closest(".usn-block") : null;
      if (gruppe && gruppe.classList.contains("is-closed")){
        elMark.classList.remove("is-bereit"); return;
      }
      /* Erst messen, dann vergleichen: der Beobachter feuert auch, wenn sich an der Zeile nichts
         geaendert hat (eine Gruppe darunter faehrt zu). Ein Schreiben ohne Aenderung macht das
         Layout trotzdem schmutzig. */
      var l = an.offsetLeft, w = an.offsetWidth, h = an.offsetHeight, y = an.offsetTop;
      var sig = l + ":" + w + ":" + h + ":" + y;
      if (sig === markeSig && elMark.classList.contains("is-bereit")) return;
      markeSig = sig;
      if (sofort) elMark.style.transition = "none";
      elMark.style.left = l + "px";
      elMark.style.width = w + "px";
      elMark.style.height = h + "px";
      elMark.style.transform = "translateY(" + y + "px)";
      if (sofort){ void elMark.offsetHeight; elMark.style.transition = ""; }
      elMark.classList.add("is-bereit");
      /* Erst JETZT geben die Zeilen ihre eigene Flaeche ab (sidebar.css: .has-marke). Vorher waere
         die aktive Zeile einen Augenblick ohne jede Flaeche. */
      bar.classList.add("has-marke");
      markeStand = true;
    }
    /* EINMAL messen reicht nicht -- dieselbe Lehre wie beim Switcher im Onboarding, hier aus zwei
       weiteren Gruenden: eine Gruppe klappt ueber eine gefahrene max-height zu, und dabei wandert
       jede Zeile darunter ueber 200ms an eine neue Stelle; und die Zaehler in den Zeilen kommen
       spaeter nach und koennen eine Zeile umbrechen lassen.
       Der Beobachter haengt an den GRUPPENKOERPERN: sie sind die Elemente, deren Hoehe sich
       aendert. Er feuert waehrend der Fahrt in jedem Bild, und die Marke wird dann OHNE eigenen
       Uebergang nachgesetzt -- sie folgt damit genau, statt der Bewegung nachzulaufen.
       Kreisen kann das nicht: die Marke liegt absolut und aendert keine Groesse ausser ihrer
       eigenen. */
    function markeBeobachten(){
      if (!markeSchriftHaengt && document.fonts && document.fonts.ready){
        markeSchriftHaengt = true;
        document.fonts.ready.then(function(){ markeSetzen(true); })["catch"](function(){});
      }
      if (!window.ResizeObserver) return;
      if (markeRo) markeRo.disconnect();
      /* Der Beobachter feuert waehrend jeder Fahrt in jedem Bild -- und markeSetzen LIEST dabei
         Layoutwerte (offsetTop/Left/Height). Ein Lesen im Beobachter-Rueckruf erzwingt einen
         weiteren Layoutdurchgang, und das mitten in dem Moment, in dem die neue Seite gezeichnet
         wird. Also je Bild hoechstens einmal, ueber requestAnimationFrame gebuendelt. */
      var warte = 0;
      markeRo = new ResizeObserver(function(){
        if (warte) return;
        warte = requestAnimationFrame(function(){ warte = 0; markeSetzen(true); });
      });
      try {
        markeRo.observe(elNav);
        [].forEach.call(elNav.querySelectorAll("[data-body]"), function(b){ markeRo.observe(b); });
      } catch(e){}
    }
    /* Die Hoehe wird GEMESSEN und als Zahl gesetzt: von auto auf 0 gibt es keinen Uebergang, und
       ein geschaetzter Maximalwert laesst die Gruppe erst spaet in Bewegung kommen. */
    function hoehenSetzen(){
      /* Im Mini-Zustand hat keine Gruppe eine Grenze: die Ueberschrift ist dort weg, es gaebe
         also keinen Weg zurueck aus dem zugeklappten Zustand. Den inline-Wert leeren statt ihn
         per CSS zu ueberschreiben -- dafuer braeuchte es !important. */
      var mini = bar.classList.contains("is-mini");
      [].forEach.call(elNav.querySelectorAll(".usn-block"), function(bl){
        var body = bl.querySelector("[data-body]");
        if (!body) return;
        if (mini){ body.style.maxHeight = ""; return; }
        body.style.maxHeight = bl.classList.contains("is-closed") ? "0px" : body.scrollHeight + "px";
      });
    }
    function gruppeSchalten(head){
      var i = state.zu.indexOf(head);
      if (i >= 0) state.zu.splice(i, 1); else state.zu.push(head);
      zuSchreiben(state.zu);
      var bl = null;
      [].forEach.call(elNav.querySelectorAll("[data-block]"), function(x){
        if (x.getAttribute("data-block") === head) bl = x;
      });
      if (!bl) return;
      var body = bl.querySelector("[data-body]");
      var zu = state.zu.indexOf(head) >= 0;
      /* Vor dem Zuklappen die gemessene Hoehe setzen, sonst faellt der Kasten von auto auf 0 und
         der Uebergang hat keinen Startwert. */
      if (zu){ body.style.maxHeight = body.scrollHeight + "px"; void body.offsetHeight; }
      bl.classList.toggle("is-closed", zu);
      bl.querySelector("[data-head]").setAttribute("aria-expanded", zu ? "false" : "true");
      body.style.maxHeight = zu ? "0px" : body.scrollHeight + "px";
      /* Die Marke zieht mit: einmal jetzt (sie faehrt dann mit derselben Zeit wie die Gruppe) und
         einmal danach, weil die Zeilen unter der Gruppe erst am Ende der Fahrt an ihrer neuen
         Stelle stehen. Der Beobachter faengt das im laufenden Betrieb auch -- aber nur, solange
         die Seite sichtbar ist: in einem verdeckten Tab liefert ein ResizeObserver nichts, und
         genau dort ist es aufgefallen. */
      markeSetzen(false);
      setTimeout(function(){ markeSetzen(true); }, 260);
    }
    /* Die Zahl neben "Teams". Vorher stand hier eine Logo-Vorschau (UC.brandStack, drei Logos plus
       "+N") -- die Zahl sagt dasselbe in der Sprache, die die Leiste schon spricht.
       Das Skelett ist das der anderen Zaehler (.usn-sk in .usn-count), nicht mehr das breite
       .usn-sk-chips: es soll die Groesse haben, die danach wirklich kommt. */
    function renderChips(){
      var el = elNav.querySelector("[data-teamcount]");
      if (!el) return;
      if (!state.teamsDa || !state.enthuellt){ el.innerHTML = '<span class="usn-sk"></span>'; return; }
      el.textContent = String((state.teams || []).length);
    }
    function renderAcc(){
      var u = state.user || {};
      if (!state.userDa || !state.enthuellt){
        elAv.innerHTML = '<span class="usn-sk"></span>';
        elAccName.innerHTML = '<span class="usn-sk"></span>';
        elAccMail.innerHTML = '<span class="usn-sk"></span>';
        elAcc.removeAttribute("data-tiplabel"); elAcc.removeAttribute("data-tip");
        return;
      }
      var q = url(u.avatar);
      /* Initialen als Grundlage, das Bild darueber -- faellt es aus, steht wieder der Buchstabe
         da statt eines leeren Kreises. Gleiche Bauart wie .up-logo-box. */
      elAv.innerHTML = esc(initialen(u.name, u.email)) +
        (q ? '<img src="' + esc(q) + '" alt="" referrerpolicy="no-referrer" onerror="this.remove()"/>' : "");
      elAccName.textContent = u.name || u.email || "";
      elAccMail.textContent = u.email || "";
      elAcc.setAttribute("data-tiplabel", u.email || u.name || "");
      elAcc.setAttribute("data-tip-place", "right");
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
              '<span class="up-pop-opt-l">' +
                (it.logo ? logoHtml((state.team || {}).name, (state.team || {}).favicon_url, "usn-acc-logo")
                         : (it.icon ? ic(it.icon) : "")) +
                esc(it.label) +
              '</span>' +
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
        /* Klick auf das Team, in dem man schon steht: Menue zu, sonst nichts. Kein Ereignis, kein
           Ladezustand -- es gibt nichts zu wechseln, und ein Ladebalken fuer einen Wechsel, der
           nicht stattfindet, ist eine Luege. */
        if (state.team && String(state.team.id) === String(id)){ menuZu(); return; }
        var neu = (state.teams || []).filter(function(x){ return String(x.id) === id; })[0];
        /* Sofort umstellen, nicht auf die Antwort warten: der Teamwechsel laedt die halbe Seite
           neu, und eine Leiste, die dabei den alten Namen zeigt, sieht aus wie ein Fehlklick. */
        if (neu){ state.team = neu; vorrat.team = neu; renderTeam(); }
        menuZu();
        /* Und ab hier laedt die Leiste: die Seite wird gleich neu gebaut, alle Zahlen und Listen
           daneben gehoeren dem alten Team. Statt sie stehen zu lassen, bis der Neuaufbau sie
           ersetzt, gehen sie in ihren Ladezustand zurueck. */
        ladenSetzen(true);
        fire("data-team-fn", "usnTeam", { team_id: id });
        return;
      }
      /* action mitgeben, obwohl es nur einen Fall gibt: ein Payload aus nichts als team_id
         laesst sich in Bubble schlecht auf einen Wert abbilden, und die Ereignisse, die beim
         Nutzer schon laufen, tragen alle einen. */
      if (t.closest("[data-newteam]")){ menuZu(); fire("data-newteam-fn", "usnNewTeam", { action: "new_team" }); return; }

      var ak = t.closest("[data-acc-key]");
      if (ak){
        var key = ak.getAttribute("data-acc-key");
        if (ak.getAttribute("data-theme-key")){
          /* Ueber setUpstreemTheme, nicht per Attribut: das schreibt den localStorage, faerbt
             JEDE .up-root der Seite und meldet sich ueber bubble_fn_theme_pref zurueck.
             Auch "system" geht direkt dorthin -- die Aufloesung nach der Systemeinstellung und das
             Loeschen der gespeicherten Wahl stehen seit dieser Runde in core. Hier stand beides
             ein zweites Mal, und eine Regel an zwei Orten laeuft irgendwann auseinander. */
          if (window.setUpstreemTheme) window.setUpstreemTheme(key);
          renderAccMenu(); renderNav();
          fire("data-theme-fn", "usnTheme", { value: key });
          return;
        }
        menuZu();
        /* Drei Wege statt einem: die drei Einstellungspunkte teilen ein Event mit action,
           Theme und Abmelden haben ihr eigenes. Vorher lief alles ueber usnProfile, und der
           Workflow musste erst per Bedingung auseinandersortieren, was gemeint war. */
        if (key === "logout") fire("data-logout-fn", "usnLogout", { action: "logout" });
        else fire("data-account-fn", "usnAccount", { action: key });
        return;
      }

      var hd = t.closest("[data-head]");
      if (hd){ gruppeSchalten(hd.getAttribute("data-head")); return; }

      /* Das X liegt IM Pin-Knopf -- also zuerst pruefen, sonst loest beides aus. */
      var ux = t.closest("[data-unpin]");
      if (ux){ pinEntfernen(parseInt(ux.getAttribute("data-unpin"), 10)); return; }
      /* Der Stift liegt wie das x IM Pin-Knopf -- also auch er zuerst. */
      var ur = t.closest("[data-rename]");
      if (ur){ umbenennenStart(parseInt(ur.getAttribute("data-rename"), 10)); return; }
      /* Ein Klick INS Textfeld ist kein Klick auf die Zeile. */
      if (t.closest("[data-pinin]")) return;
      var pb = t.closest("[data-pin]");
      if (pb){
        if (gezogen){ gezogen = false; return; }      /* der Klick gehoert zum Ziehen davor */
        var pin = state.pins[parseInt(pb.getAttribute("data-pin"), 10)];
        if (pin) fire("data-pinned-fn", "usnPinned", { type: pin.type, id: pin.id });
        if (state.klasse === "hint"){ state.offen = false; anwenden(); }
        return;
      }

      var nb = t.closest("[data-nav-key]");
      if (nb){
        var k = nb.getAttribute("data-nav-key");
        /* ZUERST das Event: daran haengt der Seitenwechsel in Bubble, und alles, was davor laeuft,
           verzoegert ihn um genau seine eigene Dauer. Das Bild danach ist billig (eine Klasse, eine
           Messung) und im selben Tick fertig -- der Nutzer sieht die Markierung trotzdem sofort. */
        fire("data-nav-fn", "usnNav", { key: k });
        state.aktiv = k;
        aktivMarkieren();
        menuZu();
        /* Auf dem Telefon faehrt die Leiste nach der Wahl wieder ein -- sonst steht der Nutzer
           vor der Seite, die er gerade geoeffnet hat, und sieht sie nicht. */
        if (state.klasse === "hint"){ state.offen = false; anwenden(); }
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

    /* ---- Der Stift kommt nach einer Verweildauer -------------------------------------------
       Dieselbe Uhr wie das Zeilenmenue in quick-actions (ROWMENU_HOVER_MS), gleicher Wert.
       Ueber eine Klasse und nicht ueber :hover mit transition-delay: wer die Liste nur
       ueberfaehrt, soll keine Reihe von Stiften hinter sich herziehen -- die Uhr wird beim
       Verlassen geloescht, eine CSS-Verzoegerung liesse sich nicht zurueckholen. */
    var STIFT_MS = 750, stiftUhr = null, stiftZeile = null;
    elNav.addEventListener("mouseover", function(e){
      if (!e.target.closest) return;
      var z = e.target.closest(".usn-pin");
      if (!z || z === stiftZeile) return;            /* mouseover feuert auch beim Wechsel der Kinder */
      clearTimeout(stiftUhr);
      if (stiftZeile) stiftZeile.classList.remove("is-editready");
      stiftZeile = z;
      stiftUhr = setTimeout(function(){ z.classList.add("is-editready"); }, STIFT_MS);
    });
    elNav.addEventListener("mouseout", function(e){
      if (!e.target.closest) return;
      var z = e.target.closest(".usn-pin");
      if (!z || z !== stiftZeile) return;
      if (e.relatedTarget && z.contains(e.relatedTarget)) return;   /* nur zu einem Kind gewandert */
      clearTimeout(stiftUhr);
      stiftZeile = null;
      z.classList.remove("is-editready");
    });

    /* Tippen: der Zwischenstand wandert in den state, damit ein Neuzeichnen ihn nicht verliert.
       KEIN renderNav hier -- das Feld verlaere bei jedem Zeichen den Fokus. */
    bar.addEventListener("input", function(e){
      if (!e.target.closest || !e.target.closest("[data-pinin]")) return;
      if (state.umbenennen) state.umbenennen.wert = e.target.value;
    });
    bar.addEventListener("keydown", function(e){
      if (!e.target.closest || !e.target.closest("[data-pinin]")) return;
      if (e.key === "Enter"){ e.preventDefault(); umbenennenEnde(true); }
      else if (e.key === "Escape"){ e.preventDefault(); umbenennenEnde(false); }
    });
    /* Klick daneben uebernimmt, wie in jedem Namensfeld der App. focusout und nicht blur:
       blur steigt nicht auf, ein delegierter Zuhoerer wuerde ihn nie sehen. */
    bar.addEventListener("focusout", function(e){
      if (!e.target.closest || !e.target.closest("[data-pinin]")) return;
      umbenennenEnde(true);
    });

    bar.addEventListener("pointerdown", function(e){
      if (!e.target.closest) return;
      if (e.target.closest("[data-unpin]")) return;          /* das x zieht nicht */
      if (e.target.closest("[data-rename]")) return;         /* der Stift auch nicht */
      var k = e.target.closest("[data-pin]");
      if (k) pinZiehStart(e, k);
    });
    bar.addEventListener("pointermove", pinZiehBewegt);
    bar.addEventListener("pointerup", pinZiehEnde);
    bar.addEventListener("pointercancel", pinZiehEnde);

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
    /* ── Attribute am Traegerelement live mitlesen ─────────────────────────────
       data-active, data-prompt-count und data-team-id sind dynamische Bubble-Werte. Bisher las
       die Komponente sie EINMAL beim Aufbau -- aendert Bubble den Wert danach (anderer Menuepunkt,
       neue Promptzahl), kam davon nichts an, und man brauchte fuer jede Aenderung einen
       Run-JS-Schritt. Ein Beobachter erspart genau den: was im Element steht, gilt.
       Die Setter bleiben trotzdem -- wer lieber aus einem Workflow schiebt, kann das weiter tun. */
    if (window.MutationObserver){
      new MutationObserver(function(muts){
        for (var i = 0; i < muts.length; i++){
          var n = muts[i].attributeName;
          if (n === "data-active"){
            var k = aktivNorm(attr("data-active", "dashboard")) || "dashboard";
            if (k !== state.aktiv){ state.aktiv = k; renderNav(); }
          } else if (n === "data-prompt-count"){
            var z = attr("data-prompt-count");
            if (z !== state.count || !state.countDa){
              state.count = z;
              state.countErwartet = true;
              if (z !== "") state.countDa = true;
              var el = elNav.querySelector("[data-count]");
              /* Auch hier die Enthuellung abfragen: dieser Schnellweg schreibt direkt in die
                 Zelle und ging sonst am gemeinsamen Reveal vorbei. */
              if (el) el.innerHTML = (state.countDa && state.enthuellt) ? esc(state.count)
                                                  : '<span class="usn-sk"></span>';
            }
          } else if (n === "data-team-id"){
            var t = attr("data-team-id");
            var neu = (state.teams || []).filter(function(x){ return String(x.id) === t; })[0];
            if (neu && (!state.team || String(state.team.id) !== t)){ state.team = neu; renderTeam(); renderTeamMenu(); }
          }
        }
      }).observe(root, { attributes: true,
        attributeFilter: ["data-active", "data-prompt-count", "data-team-id"] });
    }

    /* Der Tooltip-Chip des Hauses. Ein Aufruf, der Rest laeuft delegiert ueber [data-tip] --
       auch fuer Punkte, die es beim Aufbau noch nicht gab (Pins). */
    if (UC.makeTooltips) UC.makeTooltips(bar, function(){ return bar.getAttribute("data-theme") === "dark"; });
    /* Der Chip gilt in BEIDEN Zustaenden. Zuerst war er nur im eingeklappten gesetzt -- Gedanke
       war, dass ein Chip mit demselben Wort neben dem sichtbaren Namen Doppelung ist. In der
       Benutzung ist er auch ausgeklappt richtig: er steht rechts neben der Leiste, nicht auf ihr,
       und lange Namen sind dort ohnehin abgeschnitten. Die Beschriftung liegt weiter in
       data-tiplabel, weil sie im Markup entsteht und data-tip erst daraus gesetzt wird. */
    /* Tooltips NUR im Mini-Zustand. Dort steht neben dem Icon kein Text, der Tooltip ist also die
       einzige Beschriftung. In der breiten Leiste steht der Name in der Zeile -- ein Tooltip, der
       vorliest, was man liest, ist nur Bewegung.
       Die angehefteten Zeilen sind ausgenommen und behalten ihren Tooltip in JEDEM Zustand: ihr
       Text ist oft laenger als die Zeile (eine ganze URL, eine Prompt-Frage) und wird
       abgeschnitten. Sie tragen ihr data-tip direkt im Markup (siehe pinHtml) und kommen in dieser
       Schleife gar nicht vor -- die sieht nur data-tiplabel. Deshalb steht hier auch keine
       Ausnahme: es gibt nichts auszunehmen. */
    /* Der Auslöser ist setSidebarReady() am Ende des Pageload-Workflows. Alles andere ist
       Rueckfall, damit eine Installation ohne diesen Aufruf nicht im Skelett stehenbleibt:

         SAMMELFENSTER_MS  ab dem LETZTEN Setter, nicht ab dem ersten. Jeder Setter stellt die Uhr
                           zurueck. Ab dem ersten war es falsch: kam ein Aufruf spaeter als das
                           Fenster, enthuellte die Leiste ohne ihn, und genau das eine Feld stand
                           allein weiter im Skelett -- gemeldet fuer den Teams-Zaehler, dessen
                           Setter als letzter kommt. Die Regel ist, dass ALLES gleichzeitig
                           umspringt, und die haelt nur, wenn die Uhr am letzten Aufruf haengt.
         NOTBREMSE_MS      ab dem Bau der Leiste. Kommt gar kein Setter, steht dort "keine Daten"
                           statt eines ewigen Skeletts.

       Wer setSidebarReady() ruft, wartet auf keines von beidem. */
    var SAMMELFENSTER_MS = 1500, NOTBREMSE_MS = 4000;
    var sammelUhr = null;
    /* ---- Ladezustand der Leiste -------------------------------------------------------------
       Es gibt genau einen Weg hinein (Teamwechsel) und einen hinaus (die Seite wird neu gebaut
       und die Leiste entsteht mit ihr neu). Der Zustand ist die UMKEHRUNG der Enthuellung: was
       an Zahlen, Namen und Chips schon dastand, wird wieder zum Skelett. Zusaetzlich nimmt
       is-loading die Leiste aus der Bedienung -- ein zweiter Klick auf ein anderes Team,
       waehrend der erste Wechsel laeuft, waere ein Rennen zweier Seitenaufbauten.
       Dieselbe Funktion haengt als window.setSidebarLoading am Fenster: der Weg ueber Bubble ist
       nicht noetig (der Klick macht es selbst), aber ein Workflow, der aus einem anderen Grund
       neu laedt, soll die Leiste nicht als einziges Element wach zuruecklassen. */
    function ladenSetzen(an){
      state.laedt = !!an;
      bar.classList.toggle("is-loading", state.laedt);
      if (state.laedt){
        state.enthuellt = false; vorrat.enthuellt = false;
        renderTeam(); renderChips(); renderAcc(); renderNav();
      } else {
        enthuellen();
      }
    }

    /* Sind ALLE erwarteten Quellen da? Teams und Nutzer kommen ueber eigene Setter und sind in
       dieser App immer beide vorhanden -- die Zaehler haengen an Attributen, die beim Bau schon
       stehen. Fehlt eine der beiden, wird NICHT enthuellt: sonst springt ein Feld allein um, und
       genau das war der Bericht (der Teams-Setter kommt als letzter, und mit ihm der Zaehler). */
    /* ALLE veraenderlichen Felder, nicht nur Team und Nutzer. Vorher standen die drei Zaehler
       nicht in dieser Bedingung -- enthuellt wurde also schon, waehrend sie noch fehlten, und
       dann trudelte jeder Zaehler fuer sich in die fertige Leiste. Genau so gemeldet am 24.08.:
       "erst der prompt count, dann brands count, dann teams count, dann der Rest".
       countErwartet: die Prompt-Zahl haengt an einem Attribut, das nicht jede Installation setzt.
       Fehlt es, wird auf sie auch nicht gewartet -- sonst haenge die Leiste an einem Feld, das
       nie kommt. Marken und Teams kommen in dieser App immer. */
    function alleDa(){
      if (!state.teamsDa || !state.userDa) return false;
      if (state.countErwartet && !state.countDa) return false;
      if (!state.brandsDa) return false;
      return true;
    }
    /* fruehen: die Enthuellung ueber das Sammelfenster. Sie wartet auf alleDa().
       enthuellen(): die Enthuellung ohne Bedingung -- setSidebarReady() und die Notbremse. Beide
       sagen "jetzt ist Schluss mit Warten", und dann zeigt jedes Feld, was es hat. */
    function fruehen(){
      if (state.enthuellt) return;
      if (!alleDa()) return;
      enthuellen();
    }
    /* setSidebarReady(): warten, aber nicht endlos. Ist schon alles da, springt die Leiste sofort
       gemeinsam um. Fehlt noch etwas, bekommt es GEDULD_MS Zeit, sich der gemeinsamen Enthuellung
       anzuschliessen -- danach wird gezeigt, was da ist, damit eine stumme Quelle die Leiste nicht
       dauerhaft im Skelett haelt. */
    var BEREIT_GEDULD_MS = 2000, bereitUhr = null, bereitGemeldet = false;
    function bereitMelden(){
      bereitGemeldet = true;
      if (state.enthuellt) return;
      fruehen();
      if (state.enthuellt) return;
      if (bereitUhr) clearTimeout(bereitUhr);
      bereitUhr = setTimeout(function(){ bereitUhr = null; enthuellen(); }, BEREIT_GEDULD_MS);
    }
    function enthuellen(){
      if (sammelUhr){ clearTimeout(sammelUhr); sammelUhr = null; }
      if (bereitUhr){ clearTimeout(bereitUhr); bereitUhr = null; }
      if (state.enthuellt) return;
      state.enthuellt = true; vorrat.enthuellt = true;
      renderTeam(); renderChips(); renderAcc(); renderNav();
    }
    function enthuellenAnstossen(){
      if (state.enthuellt) return;
      /* Ist die Bereitmeldung schon da, kommt nichts Neues mehr dazu -- sobald mit DIESER Antwort
         alles beisammen ist, kann sofort gemeinsam enthuellt werden. Ohne diese Zeile laege
         zwischen der letzten Antwort und dem sichtbaren Umschalten noch das Sammelfenster bzw.
         der Rest der Geduldsfrist: gemessen 850ms, in denen alles fertig war und trotzdem
         Skelette standen. */
      if (bereitGemeldet){ fruehen(); if (state.enthuellt) return; }
      /* Zuruecksetzen statt stehenlassen: die Uhr laeuft ab dem LETZTEN Setter. Und am Ende wird
         fruehen() gerufen, nicht enthuellen() -- fehlt dann noch eine Quelle, bleibt ALLES im
         Skelett und die naechste Lieferung stoesst erneut an. Die Notbremse ab dem Bau der Leiste
         deckelt das Ganze, es kann also nicht endlos warten. */
      if (sammelUhr) clearTimeout(sammelUhr);
      sammelUhr = setTimeout(function(){ sammelUhr = null; fruehen(); }, SAMMELFENSTER_MS);
    }
    setTimeout(function(){ enthuellen(); }, NOTBREMSE_MS);

    function tipsSchalten(){
      var mini = bar.classList.contains("is-mini");
      var els = bar.querySelectorAll("[data-tiplabel]");
      for (var i = 0; i < els.length; i++){
        var e = els[i], t = e.getAttribute("data-tiplabel");
        if (mini && t) e.setAttribute("data-tip", t); else e.removeAttribute("data-tip");
      }
    }

    /* Nur am Fenster horchen, NICHT per ResizeObserver an der Leiste: die Leiste aendert ihre
       Breite selbst, ein Beobachter an ihr wuerde anwenden() waehrend des Uebergangs in jedem
       Frame erneut aufrufen. */
    window.addEventListener("resize", function(){ anwenden(); });
    /* Theme-Wechsel: das Mira-Symbol hat zwei Fassungen, und der Haken im Konto-Menue muss
       mitwandern. */
    UC.onTheme(function(){ renderNav(); qaAufbauen(0); if (popAcc.isOpen()) renderAccMenu(); });

    /* Welches Team gerade in state.pins steht. null heisst: noch nichts geladen. */
    var pinsFuerTeam = null;
    function pinsNachziehen(){
      var t = teamJetzt();
      if (!t || t === pinsFuerTeam) return;
      var erstesMal = pinsFuerTeam === null;
      pinsFuerTeam = t;
      /* Beim ERSTEN bekannten Team aus dem Speicher laden -- das ist der Seitenaufbau, und dort
         gehoeren die Pins hin. Bei jedem WECHSEL danach NICHT: der Wechsel-Workflow laedt die Seite
         am Ende neu, und bis dahin waere jede Anzeige hier eine Behauptung ueber ein Team, dessen
         uebrige Daten noch nicht da sind. Die alten Pins stehen zu lassen waere falsch (sie gehoeren
         dem vorigen Team), die neuen zu laden sieht aus wie ein fertiger Wechsel, der es nicht ist.
         Also leer, und der naechste Seitenaufbau bringt sie. */
      state.pins = erstesMal ? pinsLesen() : [];
      renderNav();
    }
    function pinHinzu(p){
      if (!p || !p.type || p.id == null) return false;
      var id = String(p.id);
      /* Schon angeheftet? Dann nach oben holen statt doppelt fuehren. */
      state.pins = state.pins.filter(function(x){ return !(x.type === p.type && String(x.id) === id); });
      state.pins.unshift({ type: p.type, id: id, label: String(p.label || id), logo: String(p.logo || "") });
      /* Ueber der Grenze faellt der LETZTE der Liste heraus -- also der aelteste, weil Neues oben
         einsortiert wird. */
      if (state.pins.length > PIN_MAX) state.pins = state.pins.slice(0, PIN_MAX);
      pinsSchreiben(state.pins);
      /* Die Gruppe aufklappen, wenn gerade etwas hineingelegt wurde: ein Anheften in eine
         zugeklappte Gruppe sieht aus, als haette es nicht gewirkt. */
      var iz = state.zu.indexOf("Pinned");
      if (iz >= 0){ state.zu.splice(iz, 1); zuSchreiben(state.zu); }
      renderNav();
      if (UC.toast) UC.toast("Pinned to sidebar", { icon: "check" });
      return true;
    }
    /* ---- Pins umsortieren ----
       Eigene Zeiger-Behandlung statt der HTML5-Drag-API: die braucht ein draggable-Attribut,
       zeichnet ein eigenes Geisterbild und laesst sich in einem position:fixed-Container nur mit
       Muehe an der richtigen Stelle halten. Hier reicht pointerdown/move/up -- dieselbe Bauart
       wie die Spaltenbreiten in den Tabellen.
       Erst nach 4px Bewegung wird es ein Ziehen: ein Klick soll ein Klick bleiben. */
    var zieh = null, gezogen = false;
    /* Die gezogene Zeile wird im DOM VERSCHOBEN, sobald der Zeiger die Mitte einer anderen Zeile
       passiert -- dieselbe Mechanik wie in der Gruppierungsliste. Damit steht die Liste immer
       schon so, wie sie nach dem Loslassen aussieht, und die gezogene Zeile selbst ist an genau
       dieser Stelle ein grauer Platzhalter. Kein Geisterbild, keine Einfuegelinie.
       Zeiger-Ereignisse statt der HTML5-Drag-API: die zeichnet ein eigenes Geisterbild und laesst
       sich in einem position:fixed-Container schlecht fuehren. */
    function pinZiehStart(e, knopf){
      zieh = { knopf: knopf, body: knopf.parentNode, y0: e.clientY, aktiv: false };
      try { knopf.setPointerCapture(e.pointerId); } catch(x){}
    }
    function pinZiehBewegt(e){
      if (!zieh) return;
      if (!zieh.aktiv){
        /* Erst nach 4px ist es ein Ziehen -- ein Klick soll ein Klick bleiben. */
        if (Math.abs(e.clientY - zieh.y0) < 4) return;
        zieh.aktiv = true;
        zieh.knopf.classList.add("is-dragging");
        bar.classList.add("is-pindrag");
      }
      var zeilen = [].slice.call(zieh.body.querySelectorAll(".usn-pin"));
      for (var i = 0; i < zeilen.length; i++){
        var z = zeilen[i];
        if (z === zieh.knopf) continue;
        var r = z.getBoundingClientRect();
        if (e.clientY < r.top || e.clientY > r.bottom) continue;
        var davor = (e.clientY - r.top) < r.height / 2;
        zieh.body.insertBefore(zieh.knopf, davor ? z : z.nextSibling);
        break;
      }
    }
    function pinZiehEnde(){
      if (!zieh) return;
      var z = zieh; zieh = null;
      bar.classList.remove("is-pindrag");
      z.knopf.classList.remove("is-dragging");
      if (!z.aktiv) return;                          /* war nur ein Klick */
      /* Nach einem Ziehen folgt ein click auf derselben Zeile. Der darf nichts ausloesen -- die
         Marke haelt genau diesen einen Klick auf. Sie kann nicht am Knopf haengen, weil
         renderNav() ihn gleich ersetzt. */
      gezogen = true;
      /* Die neue Reihenfolge steht im DOM, nicht in einem gemerkten Index. */
      var reihe = [].map.call(z.body.querySelectorAll(".usn-pin"), function(k){
        return k.getAttribute("data-pinid");
      });
      state.pins.sort(function(a, b){
        return reihe.indexOf(a.type + ":" + a.id) - reihe.indexOf(b.type + ":" + b.id);
      });
      pinsSchreiben(state.pins);
      renderNav();
    }
    function pinEntfernen(i){
      if (!(i >= 0) || !state.pins[i]) return;
      state.pins.splice(i, 1);
      pinsSchreiben(state.pins);
      renderNav();
    }
    /* Der Weg, den quick-actions ruft. Auf window, weil die Palette die Leiste nicht kennt und
       nicht kennen soll. */
    window.upstreemPinToSidebar = function(p){ return pinHinzu(p); };

    /* Der Marken-Store von core: Startwert holen, dann auf Aenderungen hoeren. onBrands nimmt
       den Root als Besitzer, damit das Abo mit dem Element verschwindet. */
    function brandsUebernehmen(liste){
      if (!Array.isArray(liste)) return;
      state.brands = liste.length; state.brandsDa = true;
      enthuellenAnstossen();
      vorrat.brands = state.brands; vorrat.brandsDa = true;
      var el = elNav.querySelector("[data-brandcount]");
      /* Wie beim Prompt-Zaehler: dieser Schnellweg schreibt direkt in die Zelle. Ohne die
         Abfrage der Enthuellung stand die Markenzahl vor allem anderen da -- der Marken-Store
         von core antwortet sofort, die Setter von Bubble brauchen laenger. */
      if (el) el.innerHTML = state.enthuellt ? esc(String(state.brands))
                                             : '<span class="usn-sk"></span>';
    }
    try {
      var jetztBrands = window.getUpstreemBrands && window.getUpstreemBrands();
      if (Array.isArray(jetztBrands) && jetztBrands.length) brandsUebernehmen(jetztBrands);
      if (UC.onBrands) UC.onBrands(brandsUebernehmen, root);
    } catch(e){}

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
        enthuellenAnstossen();
        vorrat.teams = l; vorrat.teamsDa = true;
        var cur = attr("data-team-id");
        var treffer = state.teams.filter(function(t){ return String(t.id) === cur; })[0];
        /* Ohne data-team-id das erste Team: eine Leiste ohne Namen oben sieht kaputt aus, und
           die Liste kommt ohnehin mit dem aktuellen Team zuerst. */
        state.team = treffer || state.teams[0] || null;
        vorrat.team = state.team;
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
        enthuellenAnstossen();
        state.user = {
          name: String(p.name || p.full_name || ""),
          email: String(p.email || ""),
          avatar: String(p.avatar_url || p.avatar || "")
        };
        vorrat.user = state.user; vorrat.userDa = true;
        renderAcc();
        return true;
      },
      /* Sagt: der Pageload-Workflow ist durch. Das heisst aber NICHT, dass seine Daten schon da
         sind -- Bubble hat die Schritte nur abgeschickt, die Setter antworten danach. Genau daran
         hing der Bericht vom 24.08. ("ich rufe doch extra am Ende setSidebarReady, warum reicht
         das nicht"): der Aufruf enthuellte sofort und bedingungslos, und ab da malte sich jeder
         nachtrudelnde Zaehler einzeln in die schon fertige Leiste.
         Jetzt heisst der Aufruf: von hier an kommt nichts NEUES mehr dazu -- enthuelle, sobald
         alles Erwartete beisammen ist, und dann alles zusammen. GEDULD_MS deckelt das, damit eine
         Quelle, die gar nicht antwortet, die Leiste nicht im Skelett stehen laesst. */
      setReady: function(){ bereitMelden(); return true; },
      /* Ladezustand von aussen. Der Teamwechsel im Schalter setzt ihn selbst -- diesen Weg gibt es
         fuer jeden anderen Grund, aus dem die Seite gleich neu gebaut wird. */
      setLoading: function(v){ ladenSetzen(isYes(v)); return true; },
      setActive: function(k){
        state.aktiv = aktivNorm(k) || "dashboard";
        /* Auch hier reicht die Markierung: die Liste selbst haengt nicht am aktiven Punkt. Beim
           allerersten Aufruf steht sie noch nicht -- dann baut renderNav sie. */
        if (elNav.querySelector(".usn-item")) aktivMarkieren(); else renderNav();
        return true;
      },
      setCount: function(n){
        state.count = (n == null || n === "") ? "" : String(n);
        /* Ein Setter-Aufruf ist eine Antwort -- auch eine leere. Danach kein Skelett mehr. */
        state.countDa = true;
        state.countErwartet = true;
        /* Erst NACH der Enthuellung schreiben. Ohne diese Abfrage sprang die Prompt-Zahl allein
           um, sobald ihr Setter eintraf -- gemessen am 24.08.: sie verlor ihr Skelett 850ms vor
           allen anderen Feldern. Der Weg ueber das data-prompt-count-Attribut fragt schon so ab,
           dieser Schnellweg tat es als einziger nicht.
           enthuellenAnstossen() steht jetzt DANACH: es kann selbst enthuellen (wenn mit diesem
           Wert alles beisammen ist), und dann muss der Wert schon im Zustand stehen. */
        var el = elNav.querySelector("[data-count]");
        if (el) el.innerHTML = state.enthuellt ? esc(state.count)
                                               : '<span class="usn-sk"></span>';
        enthuellenAnstossen();
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
        resetSidebar: doReset,
        setSidebarReady: doReady,
        setSidebarLoading: doLoading
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
  /* Ohne id: alle Leisten auf der Seite. Der Pageload-Workflow kennt die Instanz-ID nicht
     zwingend, und es gibt ohnehin nur eine Navigation. */
  function doReady(id){
    if (id){ var c = resolve(id); return c ? c.setReady() : fehlt(id); }
    var n = 0;
    [].forEach.call(document.querySelectorAll(".usn-root"), function(r){
      var ctrl = r.__usnController; if (ctrl && ctrl.setReady){ ctrl.setReady(); n++; }
    });
    return n > 0;
  }
  /* Wie doReady: ohne id gilt es fuer jede Leiste auf der Seite. Erstes Argument darf auch der
     Wert sein (setSidebarLoading("yes")), damit der Aufruf ohne Instanz-ID moeglich bleibt. */
  function doLoading(a, b){
    var id = (b === undefined) ? "" : a;
    var v  = (b === undefined) ? a : b;
    if (id){ var c = resolve(id); return c ? c.setLoading(v) : fehlt(id); }
    var n = 0;
    [].forEach.call(document.querySelectorAll(".usn-root"), function(r){
      var ctrl = r.__usnController; if (ctrl && ctrl.setLoading){ ctrl.setLoading(v); n++; }
    });
    return n > 0;
  }

  usnBoot(30);
})();
