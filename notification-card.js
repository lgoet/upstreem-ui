/* upstreem notification-card.js — die schwebende Benachrichtigung unten rechts (Praefix `unc`).
   Braucht core.js.

   Eine Karte zur Zeit. Liefert Bubble mehrere, gewinnt die hoechste `priority`; bei Gleichstand
   die neuere `created_at`. Ein Stapel ist bewusst nicht gebaut -- die Design-Vorlage sagt dazu
   ausdruecklich "not designed yet, ask before inventing it".

   ── Woher die Daten kommen ──────────────────────────────────────────────────────
   setUpstreemNotifications(id, payload)   Liste oder eine einzelne Zeile. Gelesen werden:
                                           id, title, body, cta_label, cta_url,
                                           notification_type, priority, created_at.
                                           `color` wird ignoriert -- der Typ bestimmt das Aussehen.
   dismissUpstreemNotification(id, notifId) Karte von aussen schliessen (nach einem Workflow, der
                                           serverseitig als gelesen markiert hat).
   resetUpstreemNotifications(id)          alles verwerfen, Karte weg.

   ── Was aus core kommt ──────────────────────────────────────────────────────────
   UC.makeMount, UC.makeFire, UC.parseLoose, UC.esc, UC.isYes   das uebliche Geruest
   UC.icon                          die Typ-Symbole plus das x (Strich, nie gefuellt)
   UC.onTheme                       das Thema zur Laufzeit (siehe syncTheme)
   .up-iconbtn.is-24 / .up-btn-sec  das X und die Geometrie beider Knoepfe

   ── Das Aussehen (16.10., Variante C "Invers" der Leinwand "Notification Varianten") ──
   Die schmale Karte (360) in der Sprache von UC.toast: umgekehrt zum Thema, im Hellen dunkel,
   im Dunkeln hell -- die Seite dahinter behaelt ihr Thema. Links eine Spalte fuer das Zeichen,
   rechts Bezeichnung, Titel, Text und darunter linksbuendig die Knoepfe; das X oben rechts.
   Kein Kopf mehr und damit KEIN LOGO: data-logo wird weiter angenommen (Vertrag, eine bestehende
   Verdrahtung darf nicht brechen), aber nicht mehr gezeichnet -- in allen vier Entwuerfen hat die
   Karte kein Logo, und auf der umgekehrten Flaeche haette der dunkle Schriftzug im Hellen eine
   zweite Fassung gebraucht. Neu ist hier nur die Karte selbst: Masse, Glanz und Einblendung. */
(function () {
  "use strict";

  /* ---- Boot-Stubs (STYLEGUIDE §25), VOR der core-Pruefung -----------------------------------
     Bubble ruft die Setter aus einem Workflow, der neben dem Laden dieser Datei laeuft. Ohne
     Stubs wirft der erste Aufruf und reisst den ganzen Run-JS-Step mit. */
  var API_NAMES = ["setUpstreemNotifications", "dismissUpstreemNotification",
                   "resetUpstreemNotifications"];
  var Q = (window.__uncBootQueue = window.__uncBootQueue || []);
  API_NAMES.forEach(function (n) {
    if (!window[n]) window[n] = function () { Q.push([n, [].slice.call(arguments)]); };
  });

  function uncBoot(triesLeft) {
    if (!window.UpstreemCore) {
      if (triesLeft > 0) { setTimeout(function () { uncBoot(triesLeft - 1); }, 100); return; }
      if (window.console) console.error("UpstreemCore (core.js) not loaded");
      return;
    }
    uncStart();
  }

  function uncStart() {
  var UC = window.UpstreemCore;
  var esc = UC.esc, isYes = UC.isYes;

  /* Was der Typ bestimmt: Symbol, Bezeichnung, Beschriftung des zweiten Knopfs und ob der
     Hauptknopf dunkel oder umrandet ist. Bei maintenance und tip ist die Nachricht nicht
     dringend -- dort waere ein dunkler Knopf ein Drangeln. */
  var TYPEN = {
    feature:      { icon: "sparkle",     label: "Feature",      zweit: "Later",        dunkel: true },
    announcement: { icon: "broadcast",   label: "Announcement", zweit: "Dismiss",      dunkel: true },
    maintenance:  { icon: "clock",       label: "Maintenance",  zweit: "Dismiss",      dunkel: false },
    security:     { icon: "shieldCheck", label: "Security",     zweit: "That was me",  dunkel: true },
    tip:          { icon: "bulb",        label: "Tip",          zweit: "Dismiss",      dunkel: false },
    /* Neu, mit dem Megafon aus Lucide. Drei Schreibweisen, weil der Typ aus einem Bubble-Feld
       kommt und dort mal mit Unterstrich, mal mit Bindestrich, mal zusammen geschrieben steht --
       ein Tippfehler im Datensatz soll nicht das neutrale Info-Zeichen erzwingen. */
    whats_new:    { icon: "megaphone",   label: "What's new",   zweit: "Dismiss",      dunkel: true }
  };
  TYPEN["whatsnew"] = TYPEN["whats_new"];
  TYPEN["whats-new"] = TYPEN["whats_new"];
  /* Ein unbekannter Typ darf die Karte nicht verschlucken: die Nachricht ist wichtiger als ihr
     Symbol. Also das neutrale Info-Zeichen und der Typ als Bezeichnung, so wie er kam. */
  /* Die Karte fuer einen Payload, der ANKAM, sich aber nicht lesen liess. notification_type
     bleibt leer: typOf faellt dann auf "Notice" mit dem Info-Zeichen und "Dismiss" zurueck, also
     die neutrale Form -- eine Stoerung soll nicht wie eine Ankuendigung aussehen. cta_label leer,
     damit der Hauptknopf verschwindet; wegklicken laesst sie sich ueber den Zweitknopf wie jede
     andere. */
  var LESEFEHLER = {
    id: "__unc_lesefehler", notification_type: "",
    title: "A notification could not be displayed",
    body: "Please reload the page and try again.",
    cta_label: ""
  };

  function typOf(t) {
    var k = String(t == null ? "" : t).toLowerCase().trim();
    return TYPEN[k] || { icon: "info", label: k || "Notice", zweit: "Dismiss", dunkel: true };
  }

  function num(v) { var n = Number(v); return isFinite(n) ? n : null; }
  function isArr(v) { return Object.prototype.toString.call(v) === "[object Array]"; }

  /* Ein Zeitpunkt aus Bubble kann als ISO-Text, als Sekunden- oder als Millisekunden-Stempel
     kommen -- je nachdem, ob der Ausdruck :formatted as, unix oder das rohe Feld liefert. Alle
     drei werden angenommen, damit die Verdrahtung nicht an einer Formatierung haengt. */
  function zeit(v) {
    if (v == null || v === "") return null;
    var n = Number(v);
    if (isFinite(n) && n > 0) return n > 1e11 ? n : n * 1000;   /* > 1e11 sind Millisekunden */
    var t = Date.parse(String(v));
    return isFinite(t) ? t : null;
  }
  /* Geplante Nachrichten bleiben bis zu ihrem Termin unsichtbar.
     Ein Wert, den zeit() NICHT lesen kann, gilt als faellig. Andersherum waere schlimmer: ein
     Datum in einem unerwarteten Format wuerde die Nachricht dauerhaft unterdruecken, ohne dass
     irgendwo etwas davon zu sehen ist -- und eine Ankuendigung, die niemand je erhaelt, faellt
     erst auf, wenn jemand danach fragt. */
  function faellig(n, jetzt) {
    var s = zeit(n && n.starts_at);
    return s == null || s <= jetzt;
  }
  /* Wann die naechste noch nicht faellige Nachricht dran waere -- null, wenn keine wartet. */
  function naechsterTermin(liste, jetzt) {
    var min = null;
    (liste || []).forEach(function (n) {
      var s = zeit(n && n.starts_at);
      if (s != null && s > jetzt && (min == null || s < min)) min = s;
    });
    return min;
  }

  /* Die neueste, wichtigste Nachricht zuerst. priority schlaegt created_at -- so kann ein
     Sicherheitshinweis eine aeltere Ankuendigung ueberholen, ohne dass Bubble sortieren muss. */
  function waehle(liste) {
    var jetzt = new Date().getTime();
    var arr = (liste || []).filter(function (n) {
      /* id != null reichte nicht: ein Bubble-Ausdruck ohne Treffer liefert keine leere Liste,
         sondern eine Zeile mit lauter leeren Feldern -- {"id":"","title":"", ...}. Ein leerer
         String ist nicht null, also kam die als gueltige Karte durch und stand als leerer Kasten
         auf dem Bildschirm.
         Ebenso raus: Zeilen ohne jeden Text. Eine Karte, die weder Ueberschrift noch Beschreibung
         hat, kann nichts mitteilen -- sie ist ein Rahmen mit einem Schliessen-Knopf. */
      if (!n) return false;
      if (!String(n.id == null ? "" : n.id).trim()) return false;
      var text = String(n.title == null ? "" : n.title).trim() ||
                 String(n.body  == null ? "" : n.body ).trim();
      if (!text) return false;
      return faellig(n, jetzt);
    });
    arr.sort(function (a, b) {
      var pa = num(a.priority) || 0, pb = num(b.priority) || 0;
      if (pa !== pb) return pb - pa;
      return String(b.created_at || "").localeCompare(String(a.created_at || ""));
    });
    return arr[0] || null;
  }

  function shell() {
    return '' +
      '<div class="unc-card" role="status" aria-live="polite" tabindex="-1">' +
        /* Der Glanz: ein Lichtstreifen, der einmal schraeg ueber die Karte wandert. Eine eigene
           Lage unter dem Inhalt (die Teile danach stehen mit position:relative darueber), ohne
           Mauszeiger-Ereignisse; der Streifen selbst ist ihr ::before. */
        '<span class="unc-glanz" aria-hidden="true"></span>' +
        /* Die Zeichenspalte: 18 breit, 20 hoch -- die Hoehe einer Textzeile, damit das Zeichen
           mittig auf der Bezeichnung daneben sitzt. */
        '<span class="unc-ic" aria-hidden="true"></span>' +
        '<div class="unc-txt">' +
          '<span class="unc-type"></span>' +
          '<div class="unc-copy">' +
            '<span class="unc-title"></span>' +
            '<span class="unc-desc"></span>' +
          '</div>' +
          /* Hauptknopf zuerst: die Knoepfe stehen linksbuendig unter dem Text, also liest man von
             links -- die Handlung vor dem Wegklicken. Beide tragen die Geometrie von .up-btn-sec. */
          '<div class="unc-foot">' +
            '<a class="up-btn-sec unc-primary" target="_blank" rel="noopener noreferrer"></a>' +
            '<button class="up-btn-sec unc-second" type="button"></button>' +
          '</div>' +
        '</div>' +
        '<button class="up-iconbtn is-24 unc-x" type="button" aria-label="Dismiss">' +
          (UC.icon ? UC.icon("x", 1.6) : "") +
        '</button>' +
      '</div>';
  }

  function initRoot(root) {
    if (root.__uncController) return root.__uncController;

    var instanceId = root.getAttribute("data-instance") || "default";
    if (instanceId === "INSTANCE_ID") return null;   /* Platzhalter noch nicht ersetzt */

    /* Die Karte entsteht direkt am body, nicht im Wurzel-Element. Vorher stand sie erst dort und
       wanderte danach -- beim zweiten initRoot-Lauf (watchRoots und die Nachzuender rufen es
       mehrfach) fand der Aufruf seine Elemente dann nicht mehr und lief auf null.
       Am body, weil position:fixed sich auf das Fenster bezieht -- ausser ein Vorfahre hat
       transform, filter oder contain. Bubble setzt transform auf animierte Gruppen; dann wird
       dieser Vorfahre der Bezugsrahmen UND sein overflow:hidden schneidet die Karte auf die
       Groesse des 1x1-Hosts. Genau das war der Fall, in dem die Karte im DOM stand, offen war und
       trotzdem nicht zu sehen. */
    /* Erst aufraeumen: Bubble haengt das Wurzel-Element bei jedem Filter- oder Seitenwechsel neu
       ein. Dabei ist __uncController weg, initRoot laeuft von vorn -- und die Karte des vorigen
       Laufs haengt weiter am body, ohne Controller und ohne Inhalt. Genau das war der schmale
       Strich am unteren Rand: eine verwaiste Karte, deren drei Zeilen leer geblieben sind.
       data-unc-instance am Element, damit hier nur die eigene entfernt wird und nicht die einer
       zweiten Platzierung auf derselben Seite. */
    var alt = document.querySelectorAll('.up-portal[data-unc-instance="' + instanceId + '"]');
    for (var a = 0; a < alt.length; a++) {
      if (alt[a].parentNode) alt[a].parentNode.removeChild(alt[a]);
    }

    /* Zwei Ebenen: aussen ein Traeger mit up-root UND up-portal, innen die Karte.
       up-root bringt die --vc-Variablen und das Thema mit -- die Karte haengt am body und wuerde
       sonst nichts davon erben. up-root bringt aber AUCH eine eigene Positionierung mit, und die
       hat die Karte plattgedrueckt: gemessen 1695x2px ueber die ganze Breite, weil left und top
       damit auf -32px standen. up-portal setzt display:contents -- der Traeger bildet also keine
       Box, gibt Thema und Variablen aber nach innen weiter. Genau dafuer steht die Klasse in core
       ("carries the theme + CSS vars to the portaled menus"). */
    var traeger = document.createElement("div");
    traeger.className = "up-root up-portal";
    traeger.setAttribute("data-unc-instance", instanceId);
    traeger.innerHTML = shell();
    var karte = traeger.querySelector(".unc-card");
    (document.body || document.documentElement).appendChild(traeger);

    var elCard   = karte;


    /* Das Thema steht als data-theme auf der Wurzel; die Karte haengt jetzt daneben und wuerde die
       Dark-Mode-Regeln nicht erben. Also spiegeln. */
    function syncTheme() {
      /* UC.themeParam statt isYes: kennt core ein Thema, gewinnt core. */
      var dunkel = root.getAttribute("data-theme") === "dark" || UC.themeParam(root.getAttribute("data-isdark"));
      var soll = dunkel ? "dark" : "light";
      /* Das Thema gehoert an den Traeger: dort sitzt up-root, von dort erben die --vc-Variablen
         nach innen. An der Karte selbst hat up-root ihre Geometrie zerstoert. */
      if (traeger.getAttribute("data-theme") !== soll) traeger.setAttribute("data-theme", soll);
      /* Dasselbe Attribut zusaetzlich an der Karte: an ihr loesen die umgekehrten Token
         (--vc-inverse-*, --vc-toast-*) auf, core fuehrt sie an [data-theme="light"] und
         [data-theme="dark"]. Steht es dort, gewinnt es gegen alles, was der Traeger vererbt. */
      if (elCard.getAttribute("data-theme") !== soll) elCard.setAttribute("data-theme", soll);
    }
    /* DAS THEMA ZUR LAUFZEIT (16.10.). Bis heute lief syncTheme nur in render(), also nur, wenn
       neue Daten kamen. Gemessen: nach setUpstreemTheme("dark") stand der Traeger auf dark (core
       stempelt jedes .up-portal), die Karte selbst aber weiter auf light -- und weil sie das
       Attribut selbst traegt, loeste sie gegen den Traeger hell auf. Eine halb gedrehte Karte:
       Grund aus dem Traeger dunkel, Hauptknopf hell.
       Zwei Wege hinein, wie bei den Seiten in core (es-Seite): UC.onTheme fuer den Wechsel ueber
       core, ein Beobachter an der Wurzel fuer Bubble, das data-isdark direkt umschreibt. Haengt
       der Traeger nicht mehr im Dokument (die Wurzel wurde neu eingehaengt, siehe oben), meldet
       sich das Abo selbst ab -- sonst sammelte jeder Seitenwechsel ein totes Abo an. */
    var themaAb = null, themaWache = null;
    function themaAbbauen() {
      if (themaAb) { themaAb(); themaAb = null; }
      if (themaWache) { themaWache.disconnect(); themaWache = null; }
    }
    function aufThema() {
      if (!traeger.isConnected) { themaAbbauen(); return; }
      syncTheme();
    }
    if (typeof UC.onTheme === "function") themaAb = UC.onTheme(aufThema);
    if (window.MutationObserver) {
      themaWache = new MutationObserver(aufThema);
      themaWache.observe(root, { attributes: true, attributeFilter: ["data-theme", "data-isdark"] });
    }
    var elIc     = karte.querySelector(".unc-ic");
    var elType   = karte.querySelector(".unc-type");
    var elTitle  = karte.querySelector(".unc-title");
    var elDesc   = karte.querySelector(".unc-desc");
    var elSecond = karte.querySelector(".unc-second");
    var elPrim   = karte.querySelector(".unc-primary");

    /* gezeigt: die id der Karte, deren Einblendung zuletzt lief (siehe render). */
    var state = { list: [], aktuell: null, weg: {}, weckerId: 0, gezeigt: null };

    var fire = UC.makeFire ? UC.makeFire(root, instanceId) : function () {};

    /* Zeigt die naechste Nachricht, die noch nicht weggeklickt wurde. Das `weg`-Verzeichnis lebt
       nur in dieser Sitzung: die dauerhafte Ablage macht der Workflow serverseitig, sonst kaeme
       eine geloeschte Nachricht nach einem Seitenwechsel wieder. */
    function render() {
      var offen = (state.list || []).filter(function (x) { return !state.weg[x.id]; });
      var n = waehle(offen);
      state.aktuell = n;

      /* Eine geplante Nachricht soll auch auf einer Seite erscheinen, die schon offen steht --
         ohne diesen Wecker waere sie erst nach dem naechsten Seitenaufbau da, und bei einer App,
         die man den ganzen Tag offen laesst, hiesse das: gar nicht.
         Nur EIN Wecker, auf den naechsten faelligen Termin. Auf 24h gedeckelt, weil setTimeout
         oberhalb von rund 24,8 Tagen ueberlaeuft und dann SOFORT feuert -- ein Termin in drei
         Wochen wuerde die Karte also augenblicklich zeigen. Nach 24h wird schlicht neu gerechnet. */
      if (state.weckerId) { clearTimeout(state.weckerId); state.weckerId = 0; }
      var next = naechsterTermin(offen, new Date().getTime());
      if (next != null) {
        var wartet = Math.max(1000, Math.min(next - new Date().getTime(), 24 * 3600 * 1000));
        state.weckerId = setTimeout(function () { state.weckerId = 0; render(); }, wartet);
      }

      if (!n) {
        root.classList.remove("is-open"); elCard.classList.remove("is-shown");
        state.gezeigt = null;
        return;
      }

      var t = typOf(n.notification_type);
      /* 1.5 wie in der Vorlage: das Zeichen steht mit 18px groesser als die 16 der Knoepfe, mit
         dem Standardstrich 2 wirkte es neben der 12px-Bezeichnung zu schwer. */
      elIc.innerHTML = UC.icon ? UC.icon(t.icon, 1.5) : "";
      elType.textContent = t.label;
      elTitle.textContent = String(n.title == null ? "" : n.title);
      /* body kommt mit \n aus dem RPC. textContent macht daraus kein <br>, also die Zeilen
         einzeln setzen -- innerHTML mit fremdem Text waere eine offene Tuer. */
      elDesc.innerHTML = String(n.body == null ? "" : n.body)
        .split(/\r?\n+/).map(function (z) { return esc(z); }).join("<br>");

      elSecond.textContent = t.zweit;
      elPrim.textContent = String(n.cta_label == null ? "Open" : n.cta_label);
      var url = String(n.cta_url == null ? "" : n.cta_url).trim();
      /* Ohne Ziel bleibt der Knopf da und schliesst nur -- "Got It!" ist genau das: eine
         Bestaetigung ohne Ziel. Ein href wird dann nicht gesetzt, damit der Browser keinen leeren
         Tab oeffnet; das Klick-Ereignis raeumt die Karte trotzdem weg.
         Erst wenn AUCH die Beschriftung fehlt, verschwindet er: dann gibt es nichts zu sagen. */
      if (url) { elPrim.setAttribute("href", url); elPrim.setAttribute("target", "_blank"); }
      else { elPrim.removeAttribute("href"); elPrim.removeAttribute("target"); }
      elPrim.style.display = String(n.cta_label == null ? "" : n.cta_label).trim() ? "" : "none";
      /* Gefuellt oder umrandet, je Typ wie bisher (TYPEN.dunkel). Die Farben kommen jetzt ganz
         aus der CSS, aus den umgekehrten Token -- sie drehen mit dem data-theme der Karte und
         damit auch beim Wechsel zur Laufzeit. Bis heute standen sie fuer den gefuellten Knopf
         inline hier, mit der Begruendung, eine Klassenregel habe laut getComputedStyle nicht
         gewonnen. Das war sehr wahrscheinlich die Messfalle mit der haengenden Transition im
         verdeckten Fenster (der Knopf trug transition: background 140ms): der berechnete Wert
         bleibt dort auf dem Startwert stehen. Inline-Farben haetten den Laufzeitwechsel des
         Themas wieder nicht mitgemacht. */
      elPrim.classList.toggle("is-solid", !!t.dunkel);
      elPrim.classList.toggle("is-line", !t.dunkel);

      syncTheme();
      root.classList.add("is-open");
      /* Die Karte haengt nicht mehr unter der Wurzel, also traegt sie die Sichtbarkeit selbst.
         Eine NEUE Nachricht (andere id) bekommt die Einblendung neu: die Animationen der Teile
         starten nur, wenn das Element aus display:none zurueckkommt. Ohne das kaeme die zweite
         Karte nach dem Wegklicken der ersten ohne Staffel und ohne Glanz. Dieselbe Nachricht
         noch einmal (ein Refresh mit denselben Daten) spielt nichts ab -- die Karte steht schon. */
      if (state.gezeigt !== n.id && elCard.classList.contains("is-shown")) {
        elCard.classList.remove("is-shown");
        void elCard.offsetWidth;   /* den Zustand ohne Karte einmal berechnen lassen */
      }
      state.gezeigt = n.id;
      elCard.classList.add("is-shown");
    }

    /* Ein Grund pro Weg hinaus, damit der Workflow unterscheiden kann: das X ist ein Wegklicken,
       der zweite Knopf ein bewusstes "spaeter" oder "war ich", der Hauptknopf ein Handeln. */
    function schliessen(grund) {
      var n = state.aktuell;
      if (!n) return;
      state.weg[n.id] = 1;
      /* Erst die Rueckwaerts-Animation, dann neu rendern: ein Sprung waere hier das Einzige an
         der Karte, das nicht weich ist. 180ms wie in der Vorlage. */
      elCard.classList.add("is-closing");
      setTimeout(function () {
        elCard.classList.remove("is-closing");
        render();
      }, 180);
      /* APP-START (13.10.): wegklicken direkt in der Datenbank (user_notification_dismiss_v1). */
      if (UC.appStartAktiv && UC.appStartAktiv() && UC.rpc) {
        UC.rpc("user_notification_dismiss_v1", { p_id: n.id, p_reason: grund === "primary" || grund === "secondary" ? grund : "close" });
      } else {
        fire("data-dismiss-fn", "bubble_fn_uncDismiss", { id: n.id, reason: grund });
      }
    }

    karte.querySelector(".unc-x").addEventListener("click", function () { schliessen("close"); });
    elSecond.addEventListener("click", function () { schliessen("secondary"); });
    /* Der Hauptknopf ist ein echter Link mit target=_blank -- kein preventDefault, damit der
       Browser ihn oeffnet (und der Nutzer ihn mit der Mitteltaste in einem eigenen Tab kann).
       Das Wegraeumen laeuft danach, sonst schliesst die Karte, bevor der Klick durch ist. */
    elPrim.addEventListener("click", function () {
      var n = state.aktuell;
      if (!n) return;
      setTimeout(function () { schliessen("primary"); }, 0);
    });

    /* Escape schliesst, solange die Karte den Fokus hat -- Vorgabe aus der Design-Datei. */
    elCard.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { e.stopPropagation(); schliessen("close"); }
    });

    var ctrl = {
      root: root,
      set: function (payload) {
        /* Kam ueberhaupt TEXT an? Das entscheidet unten zwischen leer und kaputt, und es muss
           VOR dem Lesen stehen -- danach sind beide Faelle nicht mehr zu unterscheiden. */
        var kamText = !(payload && typeof payload === "object") &&
                      !!String(payload == null ? "" : payload).trim();
        /* readBubble und NICHT parseLoose (CLAUDE.md §2a: der EINE geteilte Leseweg). Der
           Unterschied ist hier keiner auf dem Papier -- gemessen am 22.09.: ein NACKTER Emoji
           als Wert ("note": 💎, wie ihn ein Bubble-Ausdruck ohne Anfuehrungszeichen liefert)
           gibt bei parseLoose null, bei readBubble die Zeile. Ein zitierter Emoji im Titel
           traegt beides -- deshalb faellt es erst auf, wenn ein Feld GANZ aus einem Emoji
           besteht. Und genau hier steht Text, den Menschen schreiben. */
        var p = UC.readBubble ? UC.readBubble(payload)
              : (UC.parseLoose ? UC.parseLoose(payload, "notifications") : payload);
        /* Eine Liste, eine einzelne Zeile oder nichts -- alle drei kommen aus Bubble vor. Was
           nicht lesbar war, leert die Liste statt eine alte Karte stehen zu lassen: eine
           Benachrichtigung, die es nicht mehr gibt, darf nicht weiterleuchten. */
        var gelesen = isArr(p) ? p : (p && typeof p === "object" && p.id != null ? [p] : null);
        /* LEER und KAPUTT sind zwei Dinge, und hier sahen sie gleich aus. Gemessen an zehn
           Nutzlasten: ein ABGESCHNITTENER Payload, einer aus reinem Text und ein LEERER liefern
           alle drei nichts -- die Karte blieb in allen drei Faellen einfach aus, und eine
           Nachricht, die das Team geschickt hat, war spurlos weg. Kam Text an, der sich nicht
           lesen liess, ist das ein Fehler und bekommt seine eigene, wegklickbare Karte. Kam gar
           nichts an, bleibt es still wie bisher -- dann gibt es auch nichts zu melden. */
        if (gelesen) state.list = gelesen;
        else if (kamText) state.list = [LESEFEHLER];
        else state.list = [];
        render();
      },
      dismiss: function (notifId) {
        if (notifId == null) { state.weg = {}; state.list = []; render(); return; }
        state.weg[notifId] = 1;
        render();
      },
      reset: function () { state.list = []; state.weg = {}; render(); },
      /* Beim Abbau die Karte mitnehmen -- sie haengt am body und bliebe sonst stehen, wenn
         Bubble die Wurzel entfernt. */
      destroy: function () {
        themaAbbauen();
        if (traeger && traeger.parentNode) traeger.parentNode.removeChild(traeger);
      }
    };

    root.__uncController = ctrl;
    render();
    return ctrl;
  }

  function each(id, fn) {
    var roots = document.getElementsByClassName("unc-root");
    for (var i = 0; i < roots.length; i++) {
      var r = roots[i];
      if (id != null && (r.getAttribute("data-instance") || "default") !== String(id)) continue;
      var c = r.__uncController || initRoot(r);
      if (c) fn(c);
    }
  }

  /* Der vollstaendige makeMount-Aufruf, wie in den anderen acht Komponenten. Beim ersten Versuch
     hatte ich die Haelfte weggelassen -- init statt initRoot, kein ctrlProp, kein queue, kein
     resolveLocal. makeMount uebernimmt damit das Einhaengen, das Abspielen der Boot-Warteschlange
     und die Setter auf window; ein eigener Nachbau davon waere ein zweiter Weg fuer dasselbe. */
  var mount;
  mount = UC.makeMount({
    onMount: function (m) { mount = m; },
    rootClass: "unc-root", notPortal: true,
    ctrlProp: "__uncController",
    resolveLocal: "__uncResolveLocal",
    queue: "__uncBootQueue",
    initRoot: initRoot,
    api: {
      setUpstreemNotifications:    function (id, p)  { return each(id, function (c) { c.set(p); }); },
      dismissUpstreemNotification: function (id, nid){ return each(id, function (c) { c.dismiss(nid); }); },
      resetUpstreemNotifications:  function (id)     { return each(id, function (c) { c.reset(); }); }
    }
  });

  if (UC.watchRoots) UC.watchRoots("unc-root", function () {
    var roots = document.getElementsByClassName("unc-root");
    for (var i = 0; i < roots.length; i++) initRoot(roots[i]);
  });
  [0, 100, 400, 1200].forEach(function (ms) {
    setTimeout(function () {
      var roots = document.getElementsByClassName("unc-root");
      for (var i = 0; i < roots.length; i++) initRoot(roots[i]);
    }, ms);
  });
  }

  uncBoot(50);
})();
