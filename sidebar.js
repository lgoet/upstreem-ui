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
     wo die Modelle nach dem Speichern verschwanden.
     access-gate.js LIEST hier mit (28.09.): .teams und .teamsDa je Instanz, fuer "Switch team" im
     Fenster der Sperre -- dort sitzt sonst fest, wer in mehreren Teams ist. Wer die Form aendert,
     zieht leistenTeams() in access-gate.js mit; sonst faellt dort der Teamwechsel still weg. */
  var STORE = window.__usnStore = window.__usnStore || {};
  function speicher(id){ return STORE[id] || (STORE[id] = {}); }

  /* WECHSEL-MARKE (23.09., dritter Anlauf). Zwischen dem Klick auf ein anderes Team und dem
     Neuaufbau der Seite duerfen die Pins des neuen Teams nicht erscheinen -- sie liegen im
     Speicher unter dem neuen Schluessel und waeren sofort lesbar, waehrend alles daneben noch
     dem alten Team gehoert.
     Zwei Anlaeufe davor haben das ueber state.laedt geloest. Das hilft nicht, wenn Bubble die
     Leiste beim Wechsel NEU AUFBAUT: der Zustand ist dann frisch und laedt wieder false.
     Diese Marke liegt im sessionStorage und ueberlebt genau das. Geloescht wird sie hier, im
     Modulkopf -- der laeuft einmal je SEITENAUFBAU (der Loader entdoppelt die Datei). Ab da ist
     ein Wechsel wieder echt und die Pins gehoeren wieder angezeigt. */
  var WECHSEL_KEY = "usn_teamwechsel";
  try { sessionStorage.removeItem(WECHSEL_KEY); } catch(e){}
  function wechselMarke(){ try { return sessionStorage.getItem(WECHSEL_KEY) || ""; } catch(e){ return ""; } }
  function wechselMarkeSetzen(id){ try { sessionStorage.setItem(WECHSEL_KEY, String(id)); } catch(e){} }

  var BREIT = 900, MINI = 500;
  var W_WIDE = 250, W_MINI = 64;
  /* Die Logos der Marke als Vorgabe (siehe renderBrand): breit der Schriftzug, eingeklappt das
     Quadrat; je eine Fassung fuer hellen und dunklen Grund. */
  var LOGO_BASIS = "https://tgdossbsevnonssyuewp.supabase.co/storage/v1/object/public/BRANDSTYLES/";
  var LOGO_VORGABE = {
    breitHell: LOGO_BASIS + "upstreem-lockup-1f1f1f.svg", breitDunkel: LOGO_BASIS + "upstreem-lockup-e0e0e0.svg",
    kleinHell: LOGO_BASIS + "upstreem-mark-square-1f1f1f.svg", kleinDunkel: LOGO_BASIS + "upstreem-mark-square-e0e0e0.svg"
  };

  /* Die drei Bloecke. key ist der Wert, der im Event landet und den setSidebarActive erwartet. */
  var BLOECKE = [
    { head: "Database", items: [
      { key: "dashboard",  label: "Dashboard",       icon: "home" },
      { key: "prompts",    label: "Prompt Insights", icon: "zap", count: true },
      { key: "citations",  label: "Citations",       icon: "globe" },
      { key: "brands",     label: "Brands",          icon: "squareStack", brands: true },
      /* Shopping (04.10. angefordert: nach Brands). ShoppingBag01 aus Hugeicons, dasselbe Zeichen
         wie in der Krume der Komponente. Schluessel "shopping" = ?view=shopping. Die Beta-Marke ist
         seit dem 05.10. abends weg (angefordert), Ads traegt sie weiter. */
      { key: "shopping",   label: "Shopping",        icon: "shoppingBag" },
      /* Ads (05.10. angefordert: direkt unter Shopping, mit Beta). MarketingIcon aus Hugeicons,
         dasselbe Zeichen wie in der Krume der Komponente. Schluessel "ads" = ?view=ads.
         beta: das Kennzeichen aus core in der Akzentfarbe (.up-marke.is-akzent). */
      { key: "ads",        label: "Ads",             icon: "marketing", beta: true }
    ]},
    { head: "Workspace", items: [
      { key: "performance",   label: "Performance",     icon: "chartColumnUp" },
      { key: "opportunities", label: "Opportunities",   icon: "listTodo" },
      /* Impact Events (03.10. angefordert: zwischen Opportunities und Prompt Research). Tickets
         (Hugeicons, 03.10. angefordert) ist das Zeichen der Events-Komponente selbst (Krume im
         Seitenkopf), derselbe Ort, dasselbe Zeichen. Schluessel "events" = ?view=events. */
      { key: "events",        label: "Events",          icon: "tickets" },
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
  /* DER AKTIVE PUNKT AUS DER ADRESSE (13.10.): seit die Leiste ein einzeiliges Element ohne
     dynamisches data-active ist, zeigte sie nach jedem Neuladen "Dashboard", auch auf ?view=prompts.
     Die Adresse ist die Wahrheit ueber die offene Ansicht (das View-System schreibt sie); ohne
     ?view= ist es die Startansicht dashboard. Nur ein Schluessel der Leiste zaehlt -- eine Ansicht,
     die keinen Menuepunkt hat, laesst die Markierung, wo sie ist ("" = kein Wert). */
  function aktivAusAdresse(){
    var v = "";
    try { v = new URL(window.location.href).searchParams.get("view") || "dashboard"; } catch(e){ return ""; }
    var k = aktivNorm(v);
    return NAV_KEYS.indexOf(k) >= 0 ? k : "";
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
    /* Das Einstellungsfenster (preferences.js) steht in einem EIGENEN Abschnitt -- also mit einer
       Trennlinie ueber und unter sich (.usn-sec + .usn-sec in sidebar.css zieht sie). Es gehoert
       nicht zu den drei Punkten darueber: die fuehren auf SEITEN, dieses oeffnet ein Fenster.
       Der Schluessel heisst "prefswin" und NICHT "prefs": "Your Brand" oben traegt seit immer den
       Schluessel "preferences", und "prefs" ist ein Praefix davon -- eine Bubble-Bedingung mit
       "contains" trifft dann beide, und genau so ging beim Klick auf Preferences "Your Brand" auf.
       Umgekehrt gilt es auch: "prefswin" steckt nicht in "preferences" und "preferences" nicht in
       "prefswin", die zwei koennen sich in keiner Richtung mehr verwechseln.
       Es heisst "Preferences" und nicht "Settings" -- "Your Brand" darueber IST die
       Einstellungsseite dieser App, und zwei Dinge mit demselben Namen sind eines zu viel. */
    /* DER FADER, NICHT DIE WAAGERECHTEN REGLER (23.09. angefordert). Bis heute stand hier
       "preference" (PreferenceHorizontal) und im Einstellungsfenster selbst bei "My
       Preferences" der Fader "settings2" (FilterVertical) -- also zwei Zeichen fuer
       denselben Ort. Der Knopf und das Fenster, das er oeffnet, tragen jetzt dasselbe.
       Die Begruendung in core.js an "preference" (Fader = filtern, Regler = einstellen)
       gilt fuer den Satz weiter; hier wiegt schwerer, dass Knopf und Ziel zusammengehoeren. */
    { items: [{ key: "prefswin", label: "Preferences", icon: "settings2" }] },
    /* DAS THEMA ALS GEIST-SCHALTER (15.10. abends: "bitte den Theme Switcher uebernehmen. Das Hell
       klassisch faellt weg"). Eine Zeile "Theme" mit dem kleinen Schalter rechts (UC.themeSchalterHtml,
       24px -- Geist: "small for dense chrome ... dropdowns"), statt der Liste mit Haken. Die drei
       Eintraege bleiben als Daten stehen -- der Rueckfall fuer eine aeltere core ohne Schalter zeichnet
       sie wie bisher als Zeilen. "Legacy Light" ist weg. */
    { head: "Theme", theme: true, items: [
      { key: "system", label: "System" },
      { key: "light",  label: "Light"  },
      { key: "dark",   label: "Dark"   }
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
    /* NACHTRAG 07.09.: das KONTO-MENUE wird jetzt doch uebersetzt -- ausdruecklich angefordert
       ("das Account Dropdown; Preferences ist wieder englisch, account settings und die drei
       Einstellungen auch"). Es steht damit anders da als die Navigation darueber, und das ist
       gewollt: die Navigation nennt OBJEKTE der App (Domains, URLs, Brands, Prompts), das
       Konto-Menue nennt HANDLUNGEN und Einstellungen. Die Theme-Zeilen kommen ueber denselben
       Weg mit -- "Hell/Dunkel/System" ist hier richtig, weil das Einstellungsfenster daneben
       genauso schreibt.

       Der urspruengliche Beschluss, und warum er nur fuer die Navigation gilt: die Seitenleiste
       bleibt englisch (Ansage vom 31.08.). Sie ist die Landkarte der App -- wer "Prompt Insights" gelernt hat, sucht das, und
       "Domains", "URLs", "Brands", "Prompts" sind ohnehin die Namen der Objekte.
       Hart englisch und nicht "durch t(), aber ohne Katalog": der Katalog ist GETEILT. Das
       Einstellungsfenster uebersetzt "Light"/"Dark"/"System" fuer seine eigene Zeile, und ueber t()
       waere das Theme-Untermenue hier mit uebersetzt worden -- gemessen: "Hell/Dunkel/System" im
       Konto-Menue, obwohl die Leiste englisch bleiben soll.
       Hier stand ein deutscher Katalog fuer die Navigation. Er ist WEG, auf Ansage: die Seitenleiste
       bleibt englisch. Der Grund ist gut -- die Punkte sind die Landkarte der App, und wer sie
       einmal gelernt hat, sucht "Prompt Insights" und nicht "Prompt-Auswertung". Dazu waren zwei
       Uebersetzungen ohnehin falsch: "Domains", "URLs", "Brands" und "Prompts" sind die Namen der
       Objekte in dieser App und bleiben ueberall englisch, auch in uebersetzten Saetzen.
       t() bleibt trotzdem um jede Beschriftung: ohne Katalogeintrag gibt es den englischen Text
       unveraendert zurueck, und wenn hier je etwas uebersetzt werden soll, ist es ein Eintrag und
       keine Umbaustelle. */
    var esc = UC.esc;
    var instanceId = root.getAttribute("data-instance") || "default";
    /* Erst hier, nicht auf Modulebene: UC steht beim Laden dieser Datei noch nicht fest. */
    /* Der Umschalter oben rechts traegt panelLeft, weil DIESE Leiste links steht. Bis zum
       22.09. lag hier das gefuellte sidebarPanels (Bootstrap Icons, eigener 16er Kasten) --
       das einzige Zeichen der App, das nicht aus dem Satz kam. Der Satz fuehrt beide Seiten;
       gespiegelt wird nirgends mehr. Die Farben
       stehen an .usn-toggle (Drittfarbe in Ruhe, Primaerfarbe beim Hover); ein Strichzeichen
       mit stroke="currentColor" folgt ihnen genauso wie das gefuellte davor.
       1.5 wie bei jedem anderen Hugeicon hier: die CSS zwingt das Zeichen auf 16px, aus dem
       24er Kasten wird damit ein Faktor 0,667 und der Strich landet auf einem Pixel.
       Der Knopf am Telefon (fab) bekommt dasselbe Zeichen: derselbe Umschalter, andere Stelle.
       SIDEBARPANELS LEBT WEITER: es ist der Schalter des Seitenpanels in der Prompts-Tabelle.
       Die beiden waren bis heute dasselbe Zeichen -- wer sie wieder zusammenfuehren will, zieht
       prompts-table nach (SIDEBAR_ICON dort). */
    if (!BAR_SVG) BAR_SVG = UC.icon("panelLeft", 1.5);
    var fire = UC.makeFire(root, { label: "sidebar", eventPrefix: "" });

    function attr(n, f){
      var v = root.getAttribute(n);
      return (v == null || v === "" || /^[A-Z_]{3,}$/.test(v)) ? (f || "") : v;
    }
    /* Mira traegt jetzt ein Zeichen wie jeder andere Punkt (blend, siehe BLOECKE). Hier stand
       davor ein Sonderweg: ein Bild von Bubbles CDN ueber einem Symbol, dazu zwei Helligkeits-
       filter in der CSS, weil ein fremdes SVG sich weder faerben noch als Maske verwenden laesst
       (kein CORS-Header). Der ganze Weg ist mit dem Wechsel auf blend hinfaellig. */
    /* 1.5 und nicht 2: der Satz ist fuer diese Strichstaerke gezeichnet, und die Zeichen der
       Leiste sind mit 17px die kleinsten der App -- mit 2 laufen sie an den engen Stellen zu.
       Hier stand bis zum 22.09. eine Umschalttabelle (HG_SATZ), solange nur die Leiste auf dem
       neuen Satz lief. Jetzt laeuft die ganze App darauf, und die Tabelle ist ersatzlos weg. */
    function ic(name){
      return UC.icon(name, 1.5);
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
        /* Erst die Klasse, dann das Bild -- nach remove() ist parentNode null, und der Buchstabe
           blieb unter has-img versteckt (27.09., derselbe Fehler wie in opportunities.js). */
        'onerror="this.parentNode.classList.remove(\'has-img\');this.remove()"/>' + ltr + '</span>';
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
      pinsMelden();
    }
    /* Wer einen Pin-Knopf zeigt (Kopf des Event-Details), muss sehen, wenn sich die Liste
       anderswo aendert: x in der Leiste, der elfte Pin draengt den aeltesten hinaus, Teamwechsel.
       Ein Ereignis am window statt eines Abos -- die Leiste kennt ihre Leser nicht und soll sie
       nicht kennen (wie bei upstreemPinToSidebar). */
    function pinsMelden(){
      try { window.dispatchEvent(new CustomEvent("up-pins-change")); } catch(e){}
    }
    /* Event-Pins, deren Event die Liste noch nicht gezeigt hat (siehe eventPinsAbgleichen). Hier
       oben und nicht dort: pinsNachziehen kann schon waehrend des Aufbaus laufen (renderTeam),
       bevor die Zeilen weiter unten ausgefuehrt sind. */
    var eventUngesehen = {};
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
      /* Das Attribut gewinnt, wenn es einen Wert traegt -- es ist der dokumentierte Weg und kommt
         bei einem Neuaufbau frisch aus Bubble. Traegt es keinen, gilt der zuletzt gesetzte Punkt
         aus dem Speicher (Setter oder Klick) statt blind "dashboard": sonst sprang die Markierung
         bei jedem Neuaufbau (27.09.: Themenwechsel -> Bubble baut das Element neu) auf Dashboard
         zurueck, auf einer Seite, die den Punkt ueber setSidebarActive setzt. */
      aktiv: aktivNorm(attr("data-active", "")) || aktivAusAdresse() || vorrat.aktiv || "dashboard",
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
      /* Dazu der Wert aus setSidebarCount, wenn das Attribut leer ist (27.09.: Themenwechsel ->
         Bubble baut das Element neu). Das Attribut steht in der Vorlage als data-prompt-count="",
         und eine Seite, die die Zahl ueber den Setter schickt, bekam nach dem Neuaufbau ein
         Skelett fuer immer -- countErwartet war wahr, countDa falsch, und der Setter kommt nicht
         noch einmal. Ein Attribut MIT Wert gewinnt weiter. */
      countErwartet: root.hasAttribute("data-prompt-count") || !!vorrat.countDa,
      count: attr("data-prompt-count") || (vorrat.countDa ? String(vorrat.count == null ? "" : vorrat.count) : ""),
      countDa: attr("data-prompt-count") !== "" || !!vorrat.countDa,
      suche: "",
      /* Angeheftete Eintraege und zugeklappte Gruppen -- beide aus dem localStorage, siehe oben.
         Die Pins koennen hier noch leer sein, wenn das Team erst spaeter eintrifft; pinsNachziehen
         holt sie dann nach.
         NICHT waehrend eines Teamwechsels (28.09., vierter Anlauf, gemeldet: "Klick auf ein anderes
         Team -> Dropdown zu -> die Pins des neuen Teams erscheinen sofort -> erst dann der Reload").
         Baut Bubble die Leiste nach dem Klick neu auf, steht die NEUE Team-Id schon am Element,
         und hier wurden ihre Pins gelesen, bevor irgendeine Marke gefragt wurde -- die Marke
         pruefte bisher nur pinsNachziehen, und das kommt spaeter. */
      pins: wechselMarke() ? [] : pinsLesen(), zu: zuLesen(),
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
      /* ---- Markenzeile, die oberste Zeile der Leiste (07.09.) ----
         Das Logo und der Einklappknopf. Der Knopf gehoert in die OBERSTE Zeile, rechts in die
         Ecke -- eine Seitenleiste, deren Einklappknopf in der zweiten Reihe sitzt, gibt es nicht.
         Und weil die oberste Zeile je nach Einstellung eine andere ist, WANDERT er: ist die Marke
         da, sitzt er hier; ist sie aus, haengt renderBrand ihn in die Teamzeile, die dann selbst
         die oberste ist. Ein zweiter Knopf zum Ein- und Ausblenden waere ein zweiter Weg zur
         gleichen Sache, und der Klick haengt ohnehin delegiert am Balken -- ein Umzug im DOM
         kostet ihn nichts.
         Im Markup steht er bei der Marke, weil das der Vorgabezustand ist (Branding an).
         Zwei Bildquellen: data-upstreem-logo fuers Helle, data-upstreem-logo-dark fuers Dunkle --
         ein Logo, das auf beiden Gruenden traegt, gibt es selten. Fehlt die passende, wird die
         andere genommen; fehlen beide, steht der Schriftzug als TEXT da. Kein SVG im Code: die
         Bilddateien liegen in Bubble, und ein nachgebauter Schriftzug waere ein zweites Logo, das
         beim naechsten Rebrand uebrig bleibt. Der Text ist derselbe Kunstgriff wie .am-wordmark
         in ask-mira. */
      '<div class="usn-brand" data-brand>' +
        '<span class="usn-brand-mark" data-brand-mark></span>' +
        '<button class="up-iconbtn usn-toggle" type="button" data-toggle aria-label="Collapse sidebar"></button>' +
      '</div>' +
      '<div class="usn-top usn-pop" data-top>' +
        '<button class="usn-team" type="button" data-team-btn aria-haspopup="menu" aria-expanded="false">' +
          '<span class="usn-teamlogo" data-team-logo></span>' +
          '<span class="usn-teamname usn-txt" data-team-name></span>' +
          '<span class="usn-sw usn-txt" data-team-sw></span>' +
        '</button>' +
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

    /* ---- Der Umschalter im Seitenkopf (16.10. angefordert) ----
       "Sidebar-Button im Mobile: in die richtige Topbar, ganz links, nicht floaten." Den Knopf
       baut core in jeden Seitenkopf (UC.seitenleistenKnopfEinsetzen, core.css "DER UMSCHALTER
       DER SEITENLEISTE"); diese Leiste sagt nur, wann er zu sehen ist, und hoert auf seinen Klick.
       modusMelden schreibt den Modus an <html> -- dieselben Namen wie mode im usnState-Payload.
       An <html> und nicht an der Leiste: der Knopf steht in den Seiten, nicht in ihr. */
    function modusMelden(m){
      try {
        var html = document.documentElement;
        if (html.getAttribute("data-usn-modus") !== m) html.setAttribute("data-usn-modus", m);
      } catch(e){}
    }
    /* Der schwebende Knopf (.usn-fab) bleibt als RUECKFALL: er erscheint nur noch, wenn die offene
       Ansicht keinen Umschalter im Kopf zeigt -- eine Seite ohne Seitenkopf haette auf dem Telefon
       sonst keinen Weg zur Navigation. Heute hat jede Ansicht einen; gezaehlt wird trotzdem, weil
       eine neue Ansicht ohne Kopf sonst still in der Sackgasse endet.
       Gesucht in der offenen Ansicht (.view-on, Kopf-Skript): die geparkten stehen mit Deckkraft 0
       weiter im Layout, ihre Knoepfe haetten Rechtecke. getClientRects und nicht istSichtbar --
       die Ansicht blendet mit Deckkraft 0 ein, und in genau dem Moment stuende sonst kurz der
       schwebende Knopf da. Rechnet nur im hint-Zustand, also nur auf dem Telefon. */
    function kopfKnopfDa(){
      var v = document.querySelector('[id^="view-"].view-on');
      var l = (v || document).querySelectorAll(".up-ph-seitenleiste");
      for (var i = 0; i < l.length; i++) if (l[i].getClientRects().length) return true;
      return false;
    }
    function fabPruefen(){
      var an = state.klasse === "hint" && !state.offen && !kopfKnopfDa();
      fab.classList.toggle("is-on", an);
    }

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
      /* Der Modus an <html> schon hier (16.10., siehe modusMelden): der Umschalter im Seitenkopf
         haengt daran und soll im selben Bild wie die Leiste stehen, nicht erst nach anwenden(). */
      modusMelden(k === "wide" && state.eingeklappt ? "mini" : k);
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
    var elBrand    = bar.querySelector("[data-brand]");
    var elBrandMk  = bar.querySelector("[data-brand-mark]");
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

    /* Die Breite an <html>. BEIM ERSTEN MAL OHNE FAHRT: die Ansichten standen bis hierher bei
       0 (die Variable gab es noch nicht), und ihr Uebergang aus sidebar.css liess den Inhalt beim
       Seitenaufbau 200ms lang von links hereingleiten (gemessen am Stand davor: padding-left der
       Ansicht "running" von 0 auf 250 im Moment des ersten Setzens). Das Attribut schaltet den
       Uebergang ab, der Stil der Ansichten wird einmal gelesen -- damit gilt der neue Wert als
       schon erreicht --, danach ist es wieder weg. Gelesen wird getComputedStyle, kein Layout. */
    var breiteErstmals = true;
    function breiteSetzen(px){
      var html = document.documentElement;
      var neu = px + "px";
      if (!breiteErstmals || html.style.getPropertyValue("--up-sidebar-w") === neu){
        breiteErstmals = false;
        html.style.setProperty("--up-sidebar-w", neu);
        return;
      }
      breiteErstmals = false;
      html.setAttribute("data-usn-still", "");
      html.style.setProperty("--up-sidebar-w", neu);
      [].forEach.call(document.querySelectorAll('[id^="view-"]'), function(v){ void getComputedStyle(v).paddingLeft; });
      html.removeAttribute("data-usn-still");
    }
    /* is-faehrt an der Leiste, solange Breite und Zeilen fahren: sidebar.css schneidet den Text
       dann hart ab statt mit "…" (die Auslassung sass sonst in jedem Bild woanders). */
    var fahrtUhr = null;
    function fahrtMarkieren(){
      bar.classList.add("is-faehrt");
      if (fahrtUhr) clearTimeout(fahrtUhr);
      fahrtUhr = setTimeout(function(){ fahrtUhr = null; bar.classList.remove("is-faehrt"); }, dauerMs(bar) + 60);
    }

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
      /* Der Zustand VOR diesem Aufruf -- nur ein echter Wechsel startet die Fahrt der Gruppen. */
      var warMini = bar.classList.contains("is-mini");

      /* Eingeklappt gibt es keine Zeile, in der ein Textfeld Platz haette -- eine laufende
         Umbenennung wird darum beim Wechsel verworfen statt unsichtbar weiterzulaufen. */
      if (mini && state.umbenennen){ state.umbenennen = null; renderNav(); }
      bar.classList.toggle("is-mini", mini);
      bar.classList.toggle("is-hidden", hint && !state.offen);
      /* Der Modus an <html> fuer den Umschalter im Seitenkopf (modusMelden oben) -- VOR
         fabPruefen, das ihn ueber die Sichtbarkeit dieser Knoepfe mitliest. */
      modusMelden(hint ? "hint" : (mini ? "mini" : "wide"));
      /* Der Knopf verschwindet, sobald die Leiste draussen ist: sonst laege er auf dem
         Team-Logo, und zum Schliessen gibt es den Schleier daneben. Und er erscheint nur noch,
         wo der Seitenkopf keinen Umschalter hat (fabPruefen). */
      fabPruefen();
      scrim.classList.toggle("is-on", hint && state.offen);

      /* Beim Wechsel zwischen wide und mini fahren die zugeklappten Gruppen auf (eingeklappt ist
         jede offen) bzw. wieder zu -- IM SELBEN AUFRUF wie die Klasse, damit sie im selben Bild
         starten wie die Breite der Leiste. Hier stand ein setTimeout(hoehenSetzen, 0): er lief
         einen Takt NACH dem Start der Fahrt und setzte die Hoehe hart (von "keine Grenze" auf 0
         gibt es keinen Uebergang). Gemessen (usn13): die letzte Zeile sprang im zweiten Bild
         176px nach unten bzw. oben. */
      if (warMini !== mini){ fahrtMarkieren(); gruppenAngleichen(mini); }
      /* Im Mini-Zustand sind die Zeilen schmaler und stehen hoeher (keine Ueberschriften): die
         Marke muss beides uebernehmen. Zweimal, wie beim Zuklappen -- die Breite der Leiste
         faehrt 200ms. */
      if (typeof tipsSchalten === "function") tipsSchalten();
      /* Hier stand renderBrand(): die Marke tauschte beim Umschalten ihr Bild. Seit dem 13.10.
         stehen beide Fassungen im Kasten und sidebar.css blendet um (siehe renderBrand) -- beim
         Umschalten gibt es an der Marke nichts mehr zu tun. */
      elToggle.hidden = hint;
      elToggle.setAttribute("aria-label", mini ? "Expand sidebar" : "Collapse sidebar");

      /* Im hint-Zustand belegt die Leiste keinen Platz -- sie liegt UEBER dem Inhalt. */
      var px = hint ? 0 : (mini ? W_MINI : W_WIDE);
      /* Die Breite als Variable an <html>: wer seinen Seitencontainer mit
         padding-left: var(--up-sidebar-w) versieht, braucht keinen Workflow und hat den
         Uebergang automatisch synchron zur Leiste. */
      try { breiteSetzen(px); } catch(e){}

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
      /* Das Logo des Teams fuer andere Bausteine (18.10., Branded-Zeile der Filterleiste): kein eigener Abruf, dieselbe Quelle wie das
         Zeichen oben. Nur melden, wenn sich etwas aendert. */
      try {
        var tl = { name: String(t.name || ""), url: url(t.favicon_url) || "" };
        var alt = window.__upTeamLogo;
        if (!alt || alt.url !== tl.url || alt.name !== tl.name) {
          window.__upTeamLogo = tl;
          window.dispatchEvent(new CustomEvent("up-team-logo", { detail: tl }));
        }
      } catch (e) {}
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
    /* Das Bild vorne in der Zeile. Ein Event hat kein Logo (16.10. angefordert: "einfach mit
       ihrem Icon, in der Farbe des Events"): sein Zeichen in der Groesse und Strichstaerke der
       Menuepunkte, gefaerbt wie ueberall, wo das Event steht (Karte, Kopf des Details). Ohne Farbe
       bleibt es leise wie die Zeichen der Menuepunkte. Ein unbekannter Name faellt auf das Zeichen
       von "Other" zurueck -- UC.icon schriebe sonst ein leeres Zeichen und einen Fehler. */
    function pinBild(pin, name){
      if (pin.type !== "event") return logoHtml(name, pin.logo);
      var z = pin.icon && UC.iconFormen && UC.iconFormen(pin.icon) ? pin.icon : "pin";
      var f = /^#[0-9a-f]{6}$/i.test(String(pin.color || "")) ? String(pin.color) : "";
      return '<span class="usn-pin-ev"' + (f ? ' style="--usn-ev-ton:' + esc(f) + '"' : '') + '>' + ic(z) + '</span>';
    }
    function pinHtml(pin, i){
      /* Waehrend des Umbenennens ist die Zeile KEIN Knopf. Ein <input> in einem <button> ist
         verschachtelte Bedienung: der Browser haengt es aus dem Knopf heraus, und die Zeile
         faellt auseinander -- dieselbe Falle, aus der in quick-actions das <span role="button">
         entstanden ist. Also fuer die Dauer der Eingabe ein <div> mit denselben Klassen: gleiche
         Hoehe, gleiche Polsterung, gleicher Radius, nur ohne Knopfverhalten. Ohne data-pin, damit
         weder Navigation noch Ziehen anspringen. */
      if (state.umbenennen && state.umbenennen.i === i){
        return '<div class="usn-item usn-pin is-renaming" data-pinedit="' + i + '">' +
          '<span class="usn-pin-ic">' + pinBild(pin, state.umbenennen.wert) + '</span>' +
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
        '<span class="usn-pin-ic">' + pinBild(pin, pin.label) + '</span>' +
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
        /* Der eigene Name gewinnt (16.10.): ein Event-Pin folgt sonst dem Namen des Events
           (eventPinsAbgleichen) -- nach dem Umbenennen hier nicht mehr. */
        pin.eigen = true;
        pinsSchreiben(state.pins);
      }
      renderNav();
    }
    /* DIE ANSICHT AUCH SELBST ZEIGEN (04.10.). Gemeldet: in der mobilen Leiste oeffnet "Events"
       nichts. Die Leiste feuert dort dasselbe usnNav wie breit -- den Wechsel macht danach ein
       Zweig im Bubble-Workflow, und fehlt der (oder greift er nur breit), passiert nichts.
       Dieselbe Bauart wie das Power Dashboard und die Event-Pins (UC.eventOeffnen): gibt es die
       Ansicht #view-<key> und showView der App, zeigt die Leiste sie selbst. Nach dem Ereignis,
       damit Bubbles Workflow nicht wartet; showView tut nichts, wenn die Ansicht schon offen ist,
       also bleibt ein Zweig in Bubble, der dasselbe tut, folgenlos. Ohne die Ansicht (eine eigene
       Seite statt einer Gruppe) bleibt es beim Ereignis allein. */
    function ansichtZeigen(k){
      try {
        if (typeof window.showView !== "function") return;
        if (!document.getElementById("view-" + k)) return;
        window.showView(k);
        /* Bubble blendet das Reusable erst NACH showView ein (State "Current View"); verliert es
           dabei view-on, setzt core es zurueck (UC.ansichtHalten, 05.10.). */
        if (UC.ansichtHalten) UC.ansichtHalten(k);
      } catch(e){}
    }
    /* EIN WEG FUER JEDEN WECHSEL (05.10.): der Klick in die Leiste und jeder andere Ort, der eine
       Ansicht oeffnen will (die Event-Pins in den Diagrammen ueber UC.eventOeffnen), gehen ueber
       dasselbe usnNav -- nur dort setzt Bubble den State "Current View". Als window.usnNavigieren
       nach aussen gegeben. */
    function navigieren(k){
      k = String(k == null ? "" : k).trim();
      if (!k) return;
      /* ZUERST das Event: daran haengt der Seitenwechsel in Bubble, und alles, was davor laeuft,
         verzoegert ihn um genau seine eigene Dauer. Das Bild danach ist billig (eine Klasse, eine
         Messung) und im selben Tick fertig -- der Nutzer sieht die Markierung trotzdem sofort. */
      fire("data-nav-fn", "usnNav", { key: k });
      ansichtZeigen(k);
      state.aktiv = k;
      vorrat.aktiv = k;   /* fuer einen Neuaufbau, siehe aktiv im Zustand */
      aktivMarkieren();
      menuZu();
      /* Auf dem Telefon faehrt die Leiste nach der Wahl wieder ein -- sonst steht der Nutzer
         vor der Seite, die er gerade geoeffnet hat, und sieht sie nicht. */
      if (state.klasse === "hint"){ state.offen = false; anwenden(); }
    }
    window.usnNavigieren = navigieren;
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
      /* "Beta" hinter dem Namen (04.10., Shopping): .up-marke.is-akzent aus core (seit 05.10. in der
         Akzentfarbe), dieselbe Marke wie in der Krume der Seite. usn-fade: eingeklappt
         verschwindet sie mit dem Namen. */
      if (it.beta) extra = '<span class="up-marke is-akzent usn-beta usn-fade" data-i18n="Beta">' + esc(UC.t ? UC.t("Beta") : "Beta") + '</span>';
      /* data-tip statt title: der Browser-Tooltip erscheint verzoegert, an der Maus und in
         Systemoptik. data-tip ist der Chip des Hauses (.up-tip), und data-tip-place="right"
         setzt ihn neben den Punkt -- unter einem Icon steht in der eingeklappten Leiste schon
         das naechste. Im ausgeklappten Zustand nimmt die CSS den Chip weg: dort steht der Name
         ja daneben. */
      /* Markiert wird erst nach der Enthuellung. Vorher stand fuer einen Moment "Dashboard" da:
         data-active ist beim Bau noch leer, und der Rueckfall heisst dashboard -- das sah aus wie
         ein Sprung von Dashboard auf den richtigen Punkt. Solange die Leiste ihre Skelette zeigt,
         muss auch die Markierung nichts sagen; setSidebarReady() loest beides gemeinsam aus. */
      /* GLEICH UEBERSETZT schreiben, nicht englisch und dann von core nachziehen lassen. Das
         war die Ursache des Flimmerns beim Seitenaufbau ("die Sidebar-Texte springen drei- bis
         sechsmal zwischen DE und US"): renderNav laeuft im Aufbau mehrfach, schrieb jedes Mal
         die englische Beschriftung, und JEDE Luecke bis zum Sprachlauf ist sichtbar -- egal wie
         kurz sie ist. Ein Takt laesst sich verkuerzen, eine Luecke nicht auf null bringen.
         data-i18n haelt weiter das englische Original: daran erkennt der Sprachlauf das Element
         und kann beim Umschalten auf Englisch zurueck. Genau die Form, die er selbst erzeugt --
         der Knopf steht damit sofort in seinem Endzustand, und der naechste Lauf findet nichts
         mehr zu tun. Dieselbe Loesung wie im Kontomenue dieser Datei (UC.t dort seit jeher). */
      var lbl = (UC.t ? UC.t(it.label) : it.label);
      return '<button class="usn-item' + (it.beta ? " has-beta" : "") + ((state.enthuellt && it.key === state.aktiv) ? " is-active" : "") + '" ' +
        'type="button" data-nav-key="' + esc(it.key) + '" data-tiplabel="' + esc(lbl) + '" ' +
        'data-tip-place="right">' +
        '<span class="usn-ic">' + ic(it.icon) + '</span>' +
        '<span class="usn-txt" data-i18n="' + esc(it.label) + '">' + esc(lbl) + '</span>' + extra + '</button>';
    }
    /* ---- Die Markenzeile ----
       Bild, wenn data-upstreem-logo eine Quelle nennt, sonst der Schriftzug als Text. Das Attribut
       darf sich nachtraeglich aendern (Bubble setzt es aus einer Datenbank), darum wird es hier
       jedes Mal gelesen und nicht beim Bau eingefroren.
       Die Zeile bleibt IMMER im Layout und wird nur unsichtbar: sie ist die oberste, und ein
       display:none darauf wuerde beim Umschalten die ganze Leiste um ihre Hoehe verschieben. */
    function renderBrand(){
      if (!elBrand || !elBrandMk) return;
      var an = !UC.getPref || UC.getPref("branding") !== "off";
      /* is-off nimmt die ganze Zeile aus dem Fluss (siehe sidebar.css) -- nicht nur unsichtbar:
         sonst bliebe oben ein leerer Streifen stehen und der Teamschalter saesse weiter in der
         zweiten Zeile. */
      elBrand.classList.toggle("is-off", !an);
      /* Und der Einklappknopf zieht mit in die Zeile, die dann die OBERSTE ist. Nur wenn er nicht
         schon dort haengt: ein appendChild auf denselben Vater nimmt ihn aus dem DOM und setzt ihn
         wieder ein, und das kostet bei einem Knopf mit Fokus den Fokus. */
      var ziel = an ? elBrand : elTop;
      if (elToggle && elToggle.parentNode !== ziel) ziel.appendChild(elToggle);
      /* Die Attributnamen stehen als LITERALE in getAttribute und nicht als Variable. Das ist
         keine Umstaendlichkeit: .contract_snapshot.py findet gelesene Attribute genau an diesem
         Muster, und mit einer Variablen sah es aus, als waere data-upstreem-logo aus dem Vertrag
         verschwunden -- der Diff hat es beim Commit als ENTFERNT gemeldet. Ein Werkzeug, das
         stille Brueche findet, darf man nicht blind machen. */
      /* Ein nicht ersetzter Platzhalter gilt als LEER. Sonst stuende in der Leiste ein Bild mit
         der Adresse "UPSTREEM_LOGO", das nie laedt -- und der Rueckfall auf den Schriftzug
         griffe erst nach dem gescheiterten Abruf, also sichtbar spaeter. */
      function quelle(w){
        w = String(w || "").trim();
        if (!w) return "";
        return (w === "UPSTREEM_LOGO" || w === "UPSTREEM_LOGO_DARK" ||
                w === "UPSTREEM_LOGO_SMALL" || w === "UPSTREEM_LOGO_SMALL_DARK") ? "" : w;
      }
      /* Ohne Attribut die Logos der Marke (13.10.: das Element ist eine Zeile ohne Attribute, und
         die Leiste zeigte nur den Schriftzug als Text). Ein Attribut geht weiter vor. Hell = die
         dunkle Tinte (1f1f1f), dunkel = die helle (e0e0e0). */
      var hell = quelle(root.getAttribute("data-upstreem-logo")) || LOGO_VORGABE.breitHell;
      var dunkel = quelle(root.getAttribute("data-upstreem-logo-dark")) || LOGO_VORGABE.breitDunkel;
      /* EINGEKLAPPT DAS QUADRAT. Der breite Schriftzug ist auf 64px kein Logo mehr, sondern ein
         zusammengedrueckter Streifen -- deshalb zwei weitere Eingaenge fuer die 1:1-Fassung,
         hell und dunkel. Fehlt sie, bleibt es beim breiten Logo: eine fehlende Marke ist
         schlimmer als eine schmale. */
      var kleinHell = quelle(root.getAttribute("data-upstreem-logo-small")) || LOGO_VORGABE.kleinHell;
      var kleinDunkel = quelle(root.getAttribute("data-upstreem-logo-small-dark")) || LOGO_VORGABE.kleinDunkel;
      /* Das Thema steht am Balken selbst -- dieselbe Quelle, die auch die Tooltips lesen. Fehlt
         die Fassung fuer das laufende Thema, wird die andere genommen: ein Logo in der falschen
         Fassung ist immer noch besser als keines. */
      var istDunkel = bar.getAttribute("data-theme") === "dark";
      var klein = istDunkel ? (kleinDunkel || kleinHell) : (kleinHell || kleinDunkel);
      var breit = istDunkel ? (dunkel || hell) : (hell || dunkel);
      /* BEIDE FASSUNGEN STEHEN IM KASTEN (13.10.), welche zu sehen ist, entscheidet sidebar.css
         ueber .is-mini -- per Deckkraft, im Takt der Fahrt. Vorher wurde hier beim Umschalten das
         Bild getauscht: im ersten Bild der Fahrt, mit einem frischen <img>, das erst laden musste.
         Das Markup haengt damit nicht mehr am Zustand der Leiste, nur noch am Thema. */
      var neu = (!breit
        ? '<span class="usn-brand-word">upstreem</span>'
        : '<img class="usn-brand-img is-breit" alt="upstreem" src="' + esc(breit) + '"' +
          /* Bricht das Bild, faellt der Schriftzug ein -- eine leere Zeile oben in der Leiste
             saehe wie ein Ladefehler der ganzen App aus. */
          ' onerror="this.outerHTML=&quot;<span class=\'usn-brand-word\'>upstreem</span>&quot;"/>') +
        (klein
          /* alt leer: dasselbe Logo steht schon als breite Fassung mit alt="upstreem" da. Bricht
             das Quadrat, geht es weg -- eingeklappt stand im Fehlerfall auch vorher nichts. */
          ? '<img class="usn-brand-img is-square" alt="" src="' + esc(klein) + '" onerror="this.remove()"/>'
          : '');
      /* has-square sagt sidebar.css, ob es eingeklappt etwas zum Einblenden gibt -- ohne Quadrat
         bleibt die breite Fassung stehen (verkleinert, wie bisher). */
      elBrandMk.classList.toggle("has-square", !!klein);
      /* Am zuletzt GESCHRIEBENEN Text vergleichen, nicht an innerHTML: der Browser gibt das
         onerror-Attribut anders zurueck, als es hier steht, und dann waere jeder Aufruf ein
         Neuaufbau -- anwenden() ruft renderBrand bei jedem Umschalten. */
      if (elBrandMk.__usnHtml !== neu){ elBrandMk.__usnHtml = neu; elBrandMk.innerHTML = neu; }
    }

    function renderNav(){
      aktivPruefen();
      elNav.innerHTML = BLOECKE.map(function(b){
        /* Die Pinned-Gruppe entsteht nur, wenn etwas angeheftet ist -- eine Ueberschrift ohne
           Inhalt ist kein Abschnitt, sondern ein Loch. */
        /* WAEHREND DES WECHSELS GAR NICHT (23.09. erneut gemeldet). state.laedt steht zwischen
           dem Klick auf ein anderes Team und dem Neuaufbau der Seite. In diesem Fenster sind die
           Pins des NEUEN Teams schon lesbar (der Speicherschluessel haengt am Team, siehe
           pinKey), die uebrigen Daten daneben aber noch die des alten -- eine Gruppe, die dann
           schon das neue Team zeigt, behauptet einen Wechsel, der noch laeuft.
           pinsNachziehen leert die Liste bei einem Wechsel bereits; das hier ist der Riegel fuer
           den Fall, dass die Leiste dabei NEU aufgebaut wird -- dann ist pinsFuerTeam wieder
           null, "erstes Mal" ist wahr, und die neuen Pins kaemen doch herein. */
        /* Und die Marke selbst: eine neu gebaute Leiste hat laedt === false, weiss also vom Wechsel
           nichts -- die Marke im sessionStorage schon. Sie verschwindet erst mit dem Neuladen
           (geloescht im Modulkopf), also genau dann, wenn die Pins wieder dazugehoeren. */
        if (b.pinned && (state.laedt || !state.pins.length || wechselMarke())) return "";
        var zu = state.zu.indexOf(b.head) >= 0;
        var inhalt = b.pinned ? state.pins.map(pinHtml).join("")
                              : b.items.map(navItemHtml).join("");
        /* Die Ueberschrift ist ein Knopf: ein Klick klappt die Gruppe zu. Der Chevron erscheint
           erst beim Hover, mit Verzoegerung -- im Ruhezustand soll die Leiste ruhig bleiben. */
        return '<div class="usn-block' + (zu ? " is-closed" : "") + '" data-block="' + esc(b.head) + '">' +
          '<button class="usn-head up-blockhead usn-fade" type="button" data-head="' + esc(b.head) + '" ' +
          'aria-expanded="' + (zu ? "false" : "true") + '">' +
            /* Siehe navItemHtml: sofort uebersetzt, data-i18n haelt das Original. */
            '<span class="usn-head-lbl" data-i18n="' + esc(b.head) + '">' +
              esc(UC.t ? UC.t(b.head) : b.head) + '</span>' +
            '<span class="usn-head-chev">' + ic("chevronDown") + '</span>' +
          '</button>' +
          '<div class="usn-block-body" data-body>' + inhalt + '</div>' +
        '</div>';
      }).join("");
      renderChips();
      hoehenSetzen();
      if (typeof tipsSchalten === "function") tipsSchalten();
    }
    /* Nur die Markierung umsetzen -- KEIN Neuaufbau der Liste.
       Vorher lief bei jedem Klick renderNav(): innerHTML der ganzen Navigation neu, jede Zeile mit
       ihrem svg, dazu hoehenSetzen (liest je Gruppe scrollHeight und schreibt max-height, also ein
       erzwungenes Layout je Gruppe) und ein frischer ResizeObserver. Das lief VOR dem Event an
       Bubble, und genau so lange stand der Seitenwechsel. Hier bleibt: eine Klasse umsetzen und die
       Klasse umsetzen. Die Zeilen selbst aendern sich beim Wechsel des Punktes ja nicht. */
    function aktivMarkieren(){
      aktivPruefen();
      [].forEach.call(elNav.querySelectorAll(".usn-item"), function(b){
        var an = state.enthuellt && b.getAttribute("data-nav-key") === state.aktiv;
        b.classList.toggle("is-active", an);
      });
    }
    /* Hier stand eine gleitende Marke: ein heller Balken, der beim Wechsel des Menuepunktes an
       die neue Zeile fuhr. Sie ist samt Beobachter und Messung entfallen -- gefragt war eine
       Leiste, in der die aktive Zeile einfach die aktive Zeile ist. Die Flaeche traegt die Zeile
       wieder selbst (sidebar.css: .usn-item.is-active). */

    /* Der Ruhezustand der Gruppen, ohne Fahrt (nach jedem Neuaufbau der Liste): zu = 0, offen =
       ohne Grenze. Offen stand hier frueher die gemessene Hoehe in px -- sie wurde beim naechsten
       Aufbau neu gemessen, war aber dazwischen eine Grenze, die eine laengere Liste (ein neuer
       Pin, eine Umbenennung) abgeschnitten haette. Gemessen wird jetzt nur noch fuer die Fahrt
       selbst (fahren). */
    function hoehenSetzen(){
      /* Im Mini-Zustand hat keine Gruppe eine Grenze: die Ueberschrift ist dort weg, es gaebe
         also keinen Weg zurueck aus dem zugeklappten Zustand. Den inline-Wert leeren statt ihn
         per CSS zu ueberschreiben -- dafuer braeuchte es !important. */
      var mini = bar.classList.contains("is-mini");
      [].forEach.call(elNav.querySelectorAll(".usn-block"), function(bl){
        var body = bl.querySelector("[data-body]");
        if (!body) return;
        body.style.maxHeight = (!mini && bl.classList.contains("is-closed")) ? "0px" : "";
      });
    }
    /* Laengste Dauer plus Verzoegerung der Uebergaenge eines Elements, in ms -- die Uhr, nach der
       eine Fahrt spaetestens als beendet gilt. Aus dem berechneten Stil und nicht als Zahl hier:
       unter "weniger Bewegung" ist es 1ms, und die Dauer steht nur an einer Stelle (sidebar.css,
       --usn-fahrt). */
    function dauerMs(el){
      var cs = getComputedStyle(el);
      var d = String(cs.transitionDuration || "").split(","), v = String(cs.transitionDelay || "").split(",");
      var ms = function(x){ x = String(x || "").trim(); var n = parseFloat(x); if (!isFinite(n)) return 0; return /ms$/.test(x) ? n : n * 1000; };
      var max = 0;
      for (var i = 0; i < d.length; i++) max = Math.max(max, ms(d[i]) + ms(v[i % v.length]));
      return max;
    }
    /* EINE GRUPPE AUF- ODER ZUFAHREN (13.10.). Von auto auf 0 gibt es keinen Uebergang, also wird
       die Hoehe fuer die Dauer der Fahrt als Zahl gesetzt:
         1. Start = die Hoehe, die JETZT zu sehen ist (getBoundingClientRect, nicht scrollHeight) --
            so faehrt ein zweiter Klick mitten in der Fahrt von der aktuellen Lage zurueck, statt
            erst auf die volle Hoehe zu springen.
         2. is-faehrt: der Kasten schneidet ab, solange er faehrt (sidebar.css). DAS fehlte beim
            Aufklappen -- is-closed ging weg, und mit ihm das Abschneiden, im selben Moment.
         3. umschalten() (Klassen, aria) erst NACH dem festgeschriebenen Startwert.
         4. Ziel: offen = scrollHeight, zu = 0. Am Ende offen wieder ohne Grenze.
       Das Ende kommt ueber transitionend ODER die Uhr (der Tab kann verdeckt sein, dann feuert
       transitionend spaet oder nie). Die laufende Nummer sorgt dafuer, dass eine abgeloeste Fahrt
       nichts mehr anfasst. */
    var fahrtNr = 0;
    function fahren(body, offen, umschalten){
      var start = body.getBoundingClientRect().height;
      body.style.maxHeight = start + "px";
      body.classList.add("is-faehrt");
      void body.offsetHeight;
      if (umschalten) umschalten();
      body.style.maxHeight = (offen ? body.scrollHeight : 0) + "px";
      var nr = ++fahrtNr;
      body.__usnFahrt = nr;
      function fertig(){
        if (body.__usnFahrt !== nr) return;
        body.__usnFahrt = 0;
        body.removeEventListener("transitionend", amEnde);
        body.classList.remove("is-faehrt");
        if (offen) body.style.maxHeight = "";
      }
      function amEnde(e){ if (e.target === body && e.propertyName === "max-height") fertig(); }
      body.addEventListener("transitionend", amEnde);
      setTimeout(fertig, dauerMs(body) + 60);
    }
    /* Wechsel zwischen wide und mini: eingeklappt ist jede Gruppe offen (dort gibt es keine
       Ueberschrift, also keinen Weg zurueck), ausgeklappt gilt wieder die Wahl. Gefahren werden
       nur die zugeklappten -- die offenen haben in beiden Zustaenden dieselbe Hoehe. */
    function gruppenAngleichen(mini){
      [].forEach.call(elNav.querySelectorAll(".usn-block.is-closed"), function(bl){
        var body = bl.querySelector("[data-body]");
        if (body) fahren(body, mini);
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
      var hd = bl.querySelector("[data-head]");
      function umschalten(){
        bl.classList.toggle("is-closed", zu);
        hd.setAttribute("aria-expanded", zu ? "false" : "true");
      }
      /* Eingeklappt ist die Gruppe ohnehin offen (die Ueberschrift ist dort weg) -- nur die Wahl
         merken, nichts fahren. */
      if (!body || bar.classList.contains("is-mini")){ umschalten(); return; }
      fahren(body, !zu, umschalten);
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
    /* Aus core, seit das Einstellungsfenster dieselbe Frage stellt. Hier standen dieselben
       fuenf Zeilen ein zweites Mal. */
    function themaJetzt(){
      /* light / dark / system -- seit dem 15.10. abends gibt es nur noch ein Hell. */
      if (UC.getUpstreemThemeOption) return UC.getUpstreemThemeOption();
      return UC.getUpstreemThemeChoice ? UC.getUpstreemThemeChoice() : "system";
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
          '<button class="usn-newteam" type="button" data-newteam>' + ic("plus") + 'New Team</button>' +
        '</div>';
    }
    function renderAccMenu(){
      var th = themaJetzt();
      elAccMenu.innerHTML = KONTO.map(function(s){
        /* Der Themenschalter aus core: eine Zeile, Beschriftung links wie jede Menuezeile, der
           Schalter rechts. Ohne UC.themeSchalterHtml (aeltere core) die Liste wie bisher. */
        if (s.theme && UC.themeSchalterHtml){
          return '<div class="usn-sec">' +
            '<div class="up-pop-opt usn-themezeile">' +
              '<span class="up-pop-opt-l">' + esc(UC.t(s.head)) + '</span>' +
              UC.themeSchalterHtml({ klein: true, wahl: th }) +
            '</div>' +
          '</div>';
        }
        return '<div class="usn-sec">' +
          (s.head ? '<span class="up-pop-head">' + esc(UC.t(s.head)) + '</span>' : "") +
          s.items.map(function(it){
            var an = s.theme && it.key === th;
            return '<div class="up-pop-opt' + (an ? " is-active" : "") + '" ' +
              'data-acc-key="' + esc(it.key) + '"' + (s.theme ? ' data-theme-key="1"' : "") + '>' +
              '<span class="up-pop-opt-l">' +
                (it.logo ? logoHtml((state.team || {}).name, (state.team || {}).favicon_url, "usn-acc-logo")
                         : (it.icon ? ic(it.icon) : "")) +
                esc(UC.t(it.label)) +
              '</span>' +
              (s.theme ? '<span class="up-check">' + ic("check") + '</span>' : "") +
            '</div>';
          }).join("") +
        '</div>';
      }).join("");
      /* Impressum, Datenschutz, AGB stehen seit dem 14.10. abends im Preferences-Fenster (links
         unter der Navigation, preferences.js) -- nicht mehr hier. */
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
      /* ---- Das Einstellungsfenster bei Bedarf nachladen ----------------------------------------
       Es soll KEINE Zeile in Bubble kosten. Der Loader eines Elements steht als Markup IN Bubble
       und ist von hier unerreichbar -- diese Datei aber kommt vom Pin. Also holt sie sich das
       Fenster selbst, und zwar erst beim ersten Klick: wer es nie oeffnet, laedt es nie.

       Die Adresse wird NICHT geraten. window.__upAssetsLoaded haelt die volle URL jeder schon
       geladenen Datei samt Pin (der Loader jedes Elements schreibt sie dort ein), und die Basis
       kommt ausdruecklich von core.js oder core.css: die liegen im Wurzelverzeichnis des Repos.
       Aus einer beliebigen Datei zu rechnen waere falsch -- date-range.js liegt in filters/, und
       daraus entstuende .../filters/preferences.js.
       Damit laedt das Fenster garantiert vom SELBEN Commit wie core.js. Eine Seite, die zur
       Haelfte auf einem anderen Stand laeuft, ist genau der Fehler, den der Pin verhindern soll.

       Steht in der Ablage nichts (ein Harness mit direkten script-Tags), passiert nichts: dann ist
       preferences.js entweder schon da oder auf dieser Seite nicht vorgesehen. Geraten wird nie. */
    var fensterLaedt = false;
    /* Gibt true zurueck, wenn dieser Klick hier erledigt ist -- der Aufrufer feuert dann KEIN
       Bubble-Ereignis. false heisst: konnte nichts tun, bitte den Workflow fragen. */
    /* Das Fenster kennt den Nutzer nicht -- die Leiste kennt ihn. Also gibt sie ihn weiter, bevor
       sie oeffnet. Damit stehen Name, Bild UND Kennung im Profil-Tab ohne einen einzigen
       Bubble-Schritt: es ist derselbe Payload, den setSidebarUser ohnehin bekommt.
       Das Fenster liest den Namen zwar auch aus dem Markup der Leiste -- aber nur den. Die
       Kennung steht dort nirgends, die kann nur dieser Weg liefern. */
    function profilUebergeben(){
      if (typeof window.setUpstreemProfile !== "function") return;
      var u = state.user || {};
      if (!u.name && !u.email && !u.avatar && !u.id) return;
      try {
        window.setUpstreemProfile({
          display_name: u.name || "",
          email: u.email || "",
          avatar_url: u.avatar || "",
          user_id: u.id || ""
        });
      } catch (e) {}
    }
    /* stillLaden = nur holen, nicht oeffnen. Als PARAMETER und nicht als Merker: fertig() laeuft
       im onload, also asynchron -- ein Merker, den der Aufrufer danach zuruecksetzt, ist dort
       schon wieder false, und das Vorabholen haette das Fenster von selbst aufgemacht. */
    function fensterOeffnen(stillLaden){
      if (typeof window.openUpstreemPreferences === "function"){
        if (stillLaden) return true;                 /* schon da, nichts zu holen */
        profilUebergeben();
        try { window.openUpstreemPreferences(); } catch (e) {}
        return true;
      }
      if (fensterLaedt) return true;
      var L = window.__upAssetsLoaded;
      var quelle = L && (L["core.js"] || L["core.css"]);
      var m = String(quelle || "").match(/^(https?:\/\/.*\/)[^\/]+$/);
      if (!m){
        if (window.console) console.info("[sidebar] Preferences: preferences.js ist nicht geladen " +
          "und die Basis-Adresse steht nicht in __upAssetsLoaded -- es wird nichts nachgeladen. " +
          "Auf einer Bubble-Seite kommt sie vom Loader; in einem Harness bitte das Skript selbst " +
          "einsetzen.");
        return false;
      }
      var basis = m[1];
      fensterLaedt = true;

      /* BEIDE Dateien, und geoeffnet wird erst, wenn BEIDE da sind. Vorher wurde die CSS nur
         eingehaengt und niemand hat auf sie gewartet: das Skript war oft zuerst fertig, das Fenster
         ging unformatiert auf, und man sah eine Sekunde lang riesige Zeichen und Buchstaben.
         Genau so gemeldet am 01.09. Ein <link> feuert onload/onerror, also ist das messbar und
         nicht geraten.
         Auch bei FEHLER wird geoeffnet: ein Fenster ohne sein Stylesheet ist haesslich, aber ein
         Klick, der gar nichts tut, ist schlimmer -- und die Konsole sagt, was fehlt. */
      var offenCss = false, offenJs = false, schonGeoeffnet = false;
      function fertig(){
        if (!offenCss || !offenJs || schonGeoeffnet) return;
        schonGeoeffnet = true;
        fensterLaedt = false;
        profilUebergeben();
        if (stillLaden) return;                     /* Vorabholen: nichts oeffnen */
        if (typeof window.openUpstreemPreferences === "function"){
          try { window.openUpstreemPreferences(); } catch (e) {}
        }
      }

      /* Ueber DIESELBE Ablage entdoppeln, die der Loader benutzt: traegt eine Vorlage die beiden
         Dateien schon in ihrer Liste, wird hier nichts ein zweites Mal geholt. */
      if (L["preferences.css"]){
        offenCss = true;
      } else {
        L["preferences.css"] = basis + "preferences.css";
        var l = document.createElement("link");
        l.rel = "stylesheet"; l.href = L["preferences.css"];
        l.onload = function(){ offenCss = true; fertig(); };
        l.onerror = function(){
          offenCss = true;
          if (window.console) console.warn("[sidebar] Preferences: " + l.href + " liess sich nicht " +
            "laden -- das Fenster geht ohne sein Stylesheet auf. Pin purgen (CLAUDE.md 4).");
          fertig();
        };
        document.head.appendChild(l);
      }

      if (typeof window.openUpstreemPreferences === "function"){
        offenJs = true;
      } else if (L["preferences.js"]){
        /* Schon unterwegs, nur noch nicht fertig. Der laufende Abruf bringt es; dieser Klick
           wartet nicht darauf, sonst haengen zwei Warteschlangen am selben Skript. */
        fensterLaedt = false;
        return true;
      } else {
        L["preferences.js"] = basis + "preferences.js";
        var sc = document.createElement("script");
        sc.src = L["preferences.js"]; sc.async = false;
        sc.onload = function(){ offenJs = true; fertig(); };
        sc.onerror = function(){
          fensterLaedt = false;
          /* Der Eintrag muss WEG, sonst gilt die Datei fuer immer als geladen und ein zweiter
             Klick versucht es nie wieder. */
          try { delete L["preferences.js"]; } catch (e) {}
          if (window.console) console.warn("[sidebar] Preferences: " + sc.src + " liess sich nicht " +
            "laden. Pin purgen (siehe CLAUDE.md 4) und noch einmal versuchen.");
        };
        document.head.appendChild(sc);
      }
      fertig();
      return true;
    }

    /* VORABHOLEN, damit der erste Klick nicht auf zwei Abrufe warten muss. Auf einem kalten Windows
       ohne Cache waren das 1-2 Sekunden (gemeldet am 01.09.). Nicht beim Mounten, sondern wenn die
       Seite zur Ruhe gekommen ist: waehrend des Aufbaus konkurriert der Abruf mit allem, was die
       Seite wirklich braucht.
       requestIdleCallback, wo es das gibt, sonst eine Uhr -- und in beiden Faellen mit Abstand. */
    function fensterVorabholen(){
      if (typeof window.openUpstreemPreferences === "function") return;
      fensterOeffnen(true);
    }
    if (window.requestIdleCallback) window.requestIdleCallback(fensterVorabholen, { timeout: 6000 });
    else setTimeout(fensterVorabholen, 3000);

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
        /* LADEZUSTAND VOR dem Neuzeichnen. Er stand bis zum 23.09. drei Zeilen weiter unten --
           renderTeam() lief also noch mit laedt === false und zeichnete die Pin-Gruppe ein
           letztes Mal, und zwar schon mit dem neuen Team. Genau das eine Bild war gemeldet. */
        /* Die Marke VOR allem anderen: ab hier ist jede Pin-Anzeige eine Behauptung ueber ein
           Team, dessen uebrige Daten noch nicht da sind. */
        wechselMarkeSetzen(id);
        ladenSetzen(true);
        if (neu){ state.team = neu; vorrat.team = neu; renderTeam(); }
        menuZu();
        /* Der Ladezustand steht schon oben -- die Seite wird gleich neu gebaut, alle Zahlen und
           Listen daneben gehoeren dem alten Team. */
        /* APP-START (13.10.): kommt der Start von core, wechselt core das Team selbst
           (team_switch_v1, dann neu laden) -- kein Bubble-Workflow mehr. */
        if (UC.appStartAktiv && UC.appStartAktiv() && UC.appTeamWechseln){
          UC.appTeamWechseln(id).then(function(ok){ if (!ok) ladenSetzen(false); });
          return;
        }
        fire("data-team-fn", "usnTeam", { team_id: id });
        return;
      }
      /* action mitgeben, obwohl es nur einen Fall gibt: ein Payload aus nichts als team_id
         laesst sich in Bubble schlecht auf einen Wert abbilden, und die Ereignisse, die beim
         Nutzer schon laufen, tragen alle einen. */
      if (t.closest("[data-newteam]")){ menuZu(); fire("data-newteam-fn", "usnNewTeam", { action: "new_team" }); return; }

      /* Der Themenschalter im Konto-Menue (15.10. abends, Geist): derselbe Weg wie die Zeilen davor --
         core setzt Thema und Stil, das Menue zeichnet sich neu (die Flaeche faehrt an die neue
         Stelle, segLauf kennt den Schalter am Schluessel), und usnTheme geht unveraendert hinaus:
         value light|dark|system, option dasselbe (es gibt keine zweite helle Zeile mehr). */
      var tw = t.closest("[data-up-themawahl]");
      if (tw && elAccMenu.contains(tw)){
        var wahl = tw.getAttribute("data-up-themawahl");
        if (wahl !== themaJetzt()){
          if (UC.setUpstreemThemeOption) UC.setUpstreemThemeOption(wahl);
          else if (window.setUpstreemTheme) window.setUpstreemTheme(wahl);
          renderAccMenu(); renderNav();
          fire("data-theme-fn", "usnTheme", { value: wahl, option: wahl });
        }
        return;
      }
      var ak = t.closest("[data-acc-key]");
      if (ak){
        var key = ak.getAttribute("data-acc-key");
        if (ak.getAttribute("data-theme-key")){
          /* Ueber setUpstreemTheme, nicht per Attribut: das schreibt den localStorage, faerbt
             JEDE .up-root der Seite und meldet sich ueber bubble_fn_theme_pref zurueck.
             Auch "system" geht direkt dorthin -- die Aufloesung nach der Systemeinstellung und das
             Loeschen der gespeicherten Wahl stehen seit dieser Runde in core. Hier stand beides
             ein zweites Mal, und eine Regel an zwei Orten laeuft irgendwann auseinander. */
          /* Die zwei hellen Zeilen gehen ueber setUpstreemThemeOption (Thema UND heller Stil). Im
             Ereignis bleibt value das Thema (light/dark/system), wie es ein Workflow seit jeher
             liest; welche helle Zeile es war, steht daneben in option. */
          if (UC.setUpstreemThemeOption) UC.setUpstreemThemeOption(key);
          else if (window.setUpstreemTheme) window.setUpstreemTheme(key === "legacy-light" ? "light" : key);
          renderAccMenu(); renderNav();
          fire("data-theme-fn", "usnTheme", { value: key === "legacy-light" ? "light" : key, option: key });
          return;
        }
        menuZu();
        /* Drei Wege statt einem: die drei Einstellungspunkte teilen ein Event mit action,
           Theme und Abmelden haben ihr eigenes. Vorher lief alles ueber usnProfile, und der
           Workflow musste erst per Bedingung auseinandersortieren, was gemeint war. */
        if (key === "logout") fire("data-logout-fn", "usnLogout", { action: "logout" });
        else {
          /* Preferences oeffnet ein FENSTER und schickt darum NICHTS. Genau daran lag der
             gemeldete Fehler: der Klick feuerte zusaetzlich usnAccount, und der Workflow dahinter
             wechselt bei jedem usnAccount die Seite -- also ging hinter dem Fenster auch noch
             "Your Brand" auf. Ein Ereignis, das eine Navigation ausloest, darf nicht mitlaufen,
             wenn die Aktion gar keine Navigation ist.
             Gefeuert wird nur, wenn das Fenster NICHT uebernehmen konnte (preferences.js fehlt und
             laesst sich nicht nachladen) -- dann ist der Klick sonst wirkungslos, und die
             Bubble-Seite ist die letzte Hoffnung. */
          if (key === "prefswin"){ if (!fensterOeffnen()) fire("data-account-fn", "usnAccount", { action: key }); }
          else fire("data-account-fn", "usnAccount", { action: key });
        }
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
        /* Ein Event ist kein Drawer, sondern das Detail in der Ansicht "events" (16.10.):
           UC.eventOeffnen ist derselbe Weg wie ein Marker im Chart -- Adresse, Ansichtswechsel
           ueber usnNavigieren, Ereignis an eine offene Events-Komponente. Bubble kennt diese Art
           nicht, also kein usnPinned. */
        if (pin && pin.type === "event" && UC.eventOeffnen){
          UC.eventOeffnen(pin.id);
          if (state.klasse === "hint"){ state.offen = false; anwenden(); }
          return;
        }
        /* Alle vier Pin-Arten (prompt, brand, domain, url) sind core-Drawer: direkt oeffnen
           (13.10.). Der Bubble-Workflow usnPinned nur noch, wenn es kein openDrawer gibt --
           beides zugleich oeffnete den Drawer zweimal. */
        var direkt = pin && typeof window.openDrawer === "function" && UC.drawerOeffnen &&
          /^(prompt|brand|domain|url)$/.test(String(pin.type)) && UC.drawerOeffnen(String(pin.type), pin.id, "sidebar") === true;
        if (pin && !direkt) fire("data-pinned-fn", "usnPinned", { type: pin.type, id: pin.id });
        if (state.klasse === "hint"){ state.offen = false; anwenden(); }
        return;
      }

      var nb = t.closest("[data-nav-key]");
      if (nb){ navigieren(nb.getAttribute("data-nav-key")); return; }
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
    /* Der Umschalter im Seitenkopf (core, seitenleistenKnopf) meldet seinen Klick an window.
       Dasselbe wie der Klick auf den schwebenden Knopf -- nur im hint-Zustand, sonst ist er nicht
       zu sehen. Eine Leiste, die nicht mehr im Dokument steht (Bubble hat sie neu gebaut, die
       neue hoert selbst zu), tut nichts. */
    function kopfKlick(){
      if (!bar.isConnected || state.klasse !== "hint") return;
      state.offen = !state.offen;
      anwenden();
    }
    /* Ein Kopf ist dazugekommen (core meldet es) oder die Ansicht wechselt: schwebenden Knopf
       neu entscheiden. Nach dem Wechsel und nicht davor -- onViewChange meldet, bevor showView
       die Ansicht umschaltet; Zurueck/Vor schaltet ohne showView (popstate). Gesammelt in EINEN
       Lauf: beim Seitenaufbau melden sich bis zu 14 Koepfe im selben Takt, und fabPruefen misst
       (im hint-Zustand) ein Layout. */
    var kopfUhr = null;
    function kopfNeu(){
      if (kopfUhr) return;
      kopfUhr = setTimeout(function(){ kopfUhr = null; if (bar.isConnected) fabPruefen(); }, 0);
    }
    window.addEventListener("up-seitenleiste", kopfKlick);
    window.addEventListener("up-seitenleiste-knopf", kopfNeu);
    window.addEventListener("popstate", kopfNeu);
    var ansichtAus = UC.onViewChange ? UC.onViewChange(kopfNeu) : null;
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
          } else if (n === "data-upstreem-logo" || n === "data-upstreem-logo-dark" ||
                     n === "data-upstreem-logo-small" || n === "data-upstreem-logo-small-dark"){
            /* Mit in den Beobachter, damit es sich wie die drei anderen verhaelt: setzt Bubble die
               Quelle erst nach dem Pageload (aus einer Datenbank), soll die Zeile nicht bis zum
               naechsten Neuladen den Schriftzug zeigen. */
            renderBrand();
          }
        }
      }).observe(root, { attributes: true,
        attributeFilter: ["data-active", "data-prompt-count", "data-team-id",
                          "data-upstreem-logo", "data-upstreem-logo-dark",
                          "data-upstreem-logo-small", "data-upstreem-logo-small-dark"] });
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
    /* Gedrosselt: anwenden() misst und schreibt, und die Leiste steht auf JEDER Seite -- an
       jedem Bild einer Ziehbewegung war das ein erzwungenes Layout mehr. */
    if (UC.aufResize) UC.aufResize(function(){ anwenden(); });
    else window.addEventListener("resize", function(){ anwenden(); });
    /* Theme-Wechsel: das Mira-Symbol hat zwei Fassungen, und der Haken im Konto-Menue muss
       mitwandern. */
    /* renderBrand mit dabei: die Marke hat zwei Fassungen, und welche gilt, entscheidet das
       Thema. Ohne das bliebe nach einem Wechsel das Logo des anderen Themas stehen. */
    UC.onTheme(function(){ renderBrand(); renderNav(); qaAufbauen(0); if (popAcc.isOpen()) renderAccMenu(); });
    /* Und dasselbe beim Sprachwechsel -- die Beschriftungen entstehen in renderNav und
       renderAccMenu, also braucht es genau dort einen Anlass. Ohne das stuende die Leiste in der
       alten Sprache, bis der Nutzer etwas anderes anklickt. Derselbe Weg wie beim Thema, nur ein
       anderes Ereignis. */
    /* Der Zuhoerer auf die Spracheinstellung ist weg: diese Datei uebersetzt nichts, also gibt es
       auch nichts neu zu zeichnen, wenn die Sprache wechselt. */

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
      /* Die Marke schlaegt "erstes Mal": nach einem Klick auf DIESES Team sind die Pins bis zum
         naechsten Seitenaufbau tabu, auch wenn die Leiste inzwischen neu gebaut wurde. */
      var frischGewechselt = wechselMarke() && wechselMarke() === String(t);
      state.pins = (erstesMal && !frischGewechselt) ? pinsLesen() : [];
      if (!eventPinsAbgleichen()) renderNav();
      pinsMelden();
    }
    function pinHinzu(p){
      if (!p || !p.type || p.id == null) return false;
      var id = String(p.id);
      /* Schon angeheftet? Dann nach oben holen statt doppelt fuehren. */
      state.pins = state.pins.filter(function(x){ return !(x.type === p.type && String(x.id) === id); });
      var neu = { type: p.type, id: id, label: String(p.label || id), logo: String(p.logo || "") };
      /* Ein Event traegt Zeichen und Farbe statt eines Logos (16.10., siehe pinBild). */
      if (p.type === "event"){
        neu.icon = String(p.icon || ""); neu.color = String(p.color || "");
        /* Steht es noch nicht im Event-Store (gerade angelegt, die frische Liste ist unterwegs),
           darf der naechste Abgleich es nicht als geloescht werten. */
        if (!eventAusStore(id)) eventUngesehen[id] = true;
      }
      state.pins.unshift(neu);
      /* Ueber der Grenze faellt der LETZTE der Liste heraus -- also der aelteste, weil Neues oben
         einsortiert wird. */
      if (state.pins.length > PIN_MAX) state.pins = state.pins.slice(0, PIN_MAX);
      pinsSchreiben(state.pins);
      /* Die Gruppe aufklappen, wenn gerade etwas hineingelegt wurde: ein Anheften in eine
         zugeklappte Gruppe sieht aus, als haette es nicht gewirkt. */
      var iz = state.zu.indexOf("Pinned");
      if (iz >= 0){ state.zu.splice(iz, 1); zuSchreiben(state.zu); }
      renderNav();
      /* still: der Aufrufer sagt es selbst (das Anlegen eines Events nennt das Anheften in seiner
         eigenen Meldung -- zwei Toasts fuer einen Klick waeren einer zu viel). */
      if (UC.toast && !p.still) UC.toast("Pinned to sidebar", { icon: "check" });
      return true;
    }
    function pinIndex(p){
      if (!p || !p.type || p.id == null) return -1;
      var id = String(p.id);
      for (var i = 0; i < state.pins.length; i++) if (state.pins[i].type === p.type && String(state.pins[i].id) === id) return i;
      return -1;
    }

    /* ---- Event-Pins folgen dem Event (16.10.) --------------------------------------------------
       Name, Zeichen und Farbe kommen aus dem Event-Store von core (UC.getEvents), nicht aus dem
       Stand beim Anheften: wer ein Event umbenennt, umfaerbt oder ihm ein anderes Zeichen gibt,
       sieht das auch hier. Der Speicher fuehrt den letzten bekannten Stand nur, damit die Zeile
       nach einem Neuladen sofort richtig dasteht, bevor die Liste kommt.
       Ein Event, das in einer GELIEFERTEN Liste fehlt, ist geloescht (oder gehoert nicht mehr
       zum Team) -- sein Pin geht. Eine leere gelieferte Liste ist laut core wirklich leer; eine
       unlesbare (fehler) entscheidet nichts. Ausgenommen sind Pins, deren Event die Liste noch nie
       gezeigt hat (eventUngesehen, oben bei pinsMelden angelegt): das gerade angelegte Event
       steht erst in der naechsten. */
    function eventAusStore(id){
      var l = UC.getEvents ? UC.getEvents() : [];
      for (var i = 0; i < l.length; i++) if (l[i] && String(l[i].id) === String(id)) return l[i];
      return null;
    }
    /* Dieselbe Aufloesung wie events.js (zeichen): p_icon kommt als file-text aus der Datenbank,
       die Namen von UC.icon sind camelCase; ein fremder Wert (aeltere Events tragen Emojis) faellt
       auf das Zeichen des Typs zurueck. */
    function eventZeichen(ev){
      var v = String(ev.icon || "").replace(/-([a-z0-9])/g, function(_, z){ return z.toUpperCase(); });
      if (v && UC.iconFormen && UC.iconFormen(v)) return v;
      var ty = UC.eventTyp ? UC.eventTyp(ev.event_type) : null;
      return (ty && ty.icon) || "pin";
    }
    /* true, wenn neu gezeichnet wurde. */
    function eventPinsAbgleichen(){
      var st = UC.eventsStand ? UC.eventsStand() : null;
      if (!st || !st.geladen || st.fehler) return false;
      var geaendert = false;
      state.pins = state.pins.filter(function(pin){
        if (pin.type !== "event") return true;
        var ev = eventAusStore(pin.id);
        if (!ev){ if (eventUngesehen[pin.id]) return true; geaendert = true; return false; }
        delete eventUngesehen[pin.id];
        var name = String(ev.name || "").trim(), z = eventZeichen(ev);
        var f = /^#[0-9a-f]{6}$/i.test(String(ev.color || "")) ? String(ev.color) : "";
        if (!pin.eigen && name && pin.label !== name){ pin.label = name; geaendert = true; }
        if (pin.icon !== z){ pin.icon = z; geaendert = true; }
        if (pin.color !== f){ pin.color = f; geaendert = true; }
        return true;
      });
      if (!geaendert) return false;
      /* Ein offenes Umbenennen zeigt auf einen Index -- faellt davor ein Pin weg, stimmt er nicht
         mehr. Dann lieber abbrechen als den Namen an die falsche Zeile schreiben. */
      if (state.umbenennen) state.umbenennen = null;
      pinsSchreiben(state.pins);
      renderNav();
      return true;
    }
    try { if (UC.onEvents) UC.onEvents(function(){ eventPinsAbgleichen(); }, root); } catch(e){}
    /* Steht die Liste schon (Neuaufbau der Leiste), gleich einmal: sonst zeigten die Pins bis zur
       naechsten Lieferung den gespeicherten Stand. */
    try { eventPinsAbgleichen(); } catch(e){}
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
    /* Dazu Abfrage und Abnehmen (16.10., Pin-Knopf im Kopf des Event-Details): derselbe Schluessel
       aus Art und Kennung wie beim Anheften. */
    window.upstreemIsPinned = function(p){ return pinIndex(p) >= 0; };
    window.upstreemUnpinFromSidebar = function(p){
      var i = pinIndex(p);
      if (i < 0) return false;
      if (state.umbenennen) state.umbenennen = null;
      pinEntfernen(i);
      return true;
    };

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

    renderBrand();
    /* Die Einstellung kann sich waehrend der Sitzung aendern (das Einstellungsfenster schreibt
       sie), und die Leiste ist nicht dessen Kind -- also ueber das Ereignis am Fenster, so wie
       jede andere Komponente auch. Nur bei DIESEM Schluessel: ein Sprachwechsel geht die
       Markenzeile nichts an. */
    try {
      if (UC.onPrefs) UC.onPrefs(function(d){ if (!d || d.name === "branding") renderBrand(); });
    } catch(e){}
    renderTeam(); renderNav(); renderAcc();
    /* Waehrend eines Teamwechsels neu gebaut? Dann in denselben Ladezustand wie die Leiste, auf
       die geklickt wurde: alles daneben gehoert noch dem alten Team, und die Bedienung bleibt
       gesperrt, bis die Seite neu laedt (siehe ladenSetzen). */
    if (wechselMarke()) ladenSetzen(true);
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
          avatar: String(p.avatar_url || p.avatar || ""),
          /* Die Kennung wird hier nicht gebraucht, nur weitergegeben: das Einstellungsfenster
             zeigt sie unter "User ID" zum Kopieren. Schickt der Workflow sie nicht mit, bleibt
             das Feld dort leer -- ein Grund weniger, dafuer einen zweiten Setter zu bauen. */
          id: String(p.id || p.user_id || p.unique_id || "")
        };
        vorrat.user = state.user; vorrat.userDa = true;
        /* Den Nutzer auch fuer andere melden (29.09.): der Gruss im Agentic Dashboard braucht den
           Vornamen, und die Leiste ist die einzige Stelle, an der er ankommt. Kein zweiter Setter
           in Bubble -- derselbe Payload, nur weitergereicht. Am Fenster, weil die Leiste bei einem
           Themenwechsel neu gebaut wird; das Ereignis, damit ein schon stehender Gruss nachzieht. */
        try {
          window.__upNutzer = state.user;
          window.dispatchEvent(new CustomEvent("up-nutzer", { detail: state.user }));
        } catch (e) {}
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
      aktivNachziehen: function(k){
        k = aktivNorm(k);
        if (!k || NAV_KEYS.indexOf(k) < 0 || k === state.aktiv) return false;
        state.aktiv = k; vorrat.aktiv = k;
        if (elNav.querySelector(".usn-item")) aktivMarkieren(); else renderNav();
        return true;
      },
      setActive: function(k){
        state.aktiv = aktivNorm(k) || "dashboard";
        vorrat.aktiv = state.aktiv;   /* fuer einen Neuaufbau, siehe aktiv im Zustand */
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
        /* Fuer einen Neuaufbau, siehe count im Zustand. */
        vorrat.count = state.count; vorrat.countDa = true;
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
        /* Ohne Leiste hat der Umschalter im Seitenkopf nichts mehr zu oeffnen. */
        window.removeEventListener("up-seitenleiste", kopfKlick);
        window.removeEventListener("up-seitenleiste-knopf", kopfNeu);
        window.removeEventListener("popstate", kopfNeu);
        if (kopfUhr){ clearTimeout(kopfUhr); kopfUhr = null; }
        if (typeof ansichtAus === "function") ansichtAus();
        try { document.documentElement.removeAttribute("data-usn-modus"); } catch(e){}
        root.__usnController = null;
      }
    };
  }

  var mount = null;
  /* Der aktive Punkt folgt der offenen Ansicht: jeder Wechsel ueber showView (core meldet ihn,
     onViewChange) und Zurueck/Vor im Browser (das View-System schaltet dort ohne showView). */
  function alleAktivNachziehen(k){
    [].forEach.call(document.querySelectorAll(".usn-root"), function(r){
      var c = r.__usnController; if (c && c.aktivNachziehen) c.aktivNachziehen(k);
    });
  }
  function usnRun(){
    var UCl = window.UpstreemCore;
    if (UCl.onViewChange) UCl.onViewChange(function(name){ alleAktivNachziehen(name); });
    window.addEventListener("popstate", function(){ var k = aktivAusAdresse(); if (k) alleAktivNachziehen(k); });
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
