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
   UC.icon                          die fuenf Typ-Symbole plus das x
   .up-iconbtn / .up-btn / .up-btn-sec   die drei Knopfarten

   Neu ist hier nur die Karte selbst: ihre Groesse, die drei Zeilen und die Einblendung. */
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
        /* Drei Zierschichten unter dem Inhalt, alle ohne Mauszeiger-Ereignisse: der weiche
           Verlauf oben rechts, die feinen senkrechten Linien und die Lichtkante an der
           Oberkante. Sie stehen im Markup und nicht als Pseudo-Elemente, weil drei Schichten
           mit ::before/::after nicht gehen. */
        '<span class="unc-wash" aria-hidden="true"></span>' +
        /* Sieben geschwungene Haarlinien, je 55px auf x versetzt, von unten links nach oben
           rechts. preserveAspectRatio="none" laesst sie mit der Karte mitziehen, statt bei einer
           anderen Breite abzuschneiden -- die Karte ist 424 breit, die viewBox 384. */
        '<svg class="unc-rules" aria-hidden="true" width="100%" height="100%" ' +
              'viewBox="0 0 384 200" preserveAspectRatio="none">' +
          [-40, 15, 70, 125, 180, 235, 290].map(function (x) {
            return '<path d="M' + x + ' 215 C ' + (x + 110) + ' 175, ' + (x + 182) + ' 102, ' +
                   (x + 230) + ' -20"/>';
          }).join("") +
        '</svg>' +
        '<span class="unc-hair" aria-hidden="true"></span>' +

        '<div class="unc-head">' +
          '<img class="unc-logo" alt="upstreem" onerror="this.style.display=&quot;none&quot;"/>' +
          '<button class="up-iconbtn unc-x" type="button" aria-label="Dismiss">' +
            (UC.icon ? UC.icon("x", 1.6) : "") +
          '</button>' +
        '</div>' +

        '<div class="unc-body">' +
          '<span class="unc-tile" aria-hidden="true"></span>' +
          '<div class="unc-txt">' +
            '<span class="unc-type"></span>' +
            '<span class="unc-title"></span>' +
            '<span class="unc-desc"></span>' +
          '</div>' +
        '</div>' +

        '<div class="unc-foot">' +
          '<button class="up-btn-sec unc-second" type="button"></button>' +
          '<a class="unc-primary" target="_blank" rel="noopener noreferrer"></a>' +
        '</div>' +
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
       Dark-Mode-Regeln nicht erben. Also spiegeln, und zwar bei jedem Render: Bubble schaltet das
       Attribut zur Laufzeit um. */
    function syncTheme() {
      /* UC.themeParam statt isYes: kennt core ein Thema, gewinnt core. */
      var dunkel = root.getAttribute("data-theme") === "dark" || UC.themeParam(root.getAttribute("data-isdark"));
      /* Das Thema gehoert an den Traeger: dort sitzt up-root, von dort erben die --vc-Variablen
         nach innen. An der Karte selbst hat up-root ihre Geometrie zerstoert. */
      traeger.setAttribute("data-theme", dunkel ? "dark" : "light");
      /* Dasselbe Attribut zusaetzlich an der Karte. Der Traeger traegt up-root und damit die
         --vc-Variablen; die Karte braucht es fuer ihre eigenen Dark-Regeln. Mit dem Selektor ueber
         den Traeger (.up-root[data-theme="dark"] .unc-primary) gewann in der App die schwaechere
         Regel, obwohl der Selektor nachweislich passte und spaeter stand -- warum, habe ich nicht
         geklaert. Am Element selbst gibt es keine Kette, die schiefgehen kann. */
      elCard.setAttribute("data-theme", dunkel ? "dark" : "light");
    }
    var elLogo   = karte.querySelector(".unc-logo");
    var elTile   = karte.querySelector(".unc-tile");
    var elType   = karte.querySelector(".unc-type");
    var elTitle  = karte.querySelector(".unc-title");
    var elDesc   = karte.querySelector(".unc-desc");
    var elSecond = karte.querySelector(".unc-second");
    var elPrim   = karte.querySelector(".unc-primary");

    var state = { list: [], aktuell: null, weg: {}, weckerId: 0 };

    var fire = UC.makeFire ? UC.makeFire(root, instanceId) : function () {};

    function logoQuelle() {
      return root.getAttribute("data-logo") || "";
    }

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

      if (!n) { root.classList.remove("is-open"); elCard.classList.remove("is-shown"); return; }

      var t = typOf(n.notification_type);
      elTile.innerHTML = UC.icon ? UC.icon(t.icon, 1.5) : "";
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
      /* Zwei getrennte Klassen statt einer, die im Dark Mode ueberschrieben wird: eine
         .unc-card[data-theme="dark"] .unc-primary.is-dark-Regel hat in der App nachweislich NICHT
         gewonnen, obwohl sie spaeter stand, staerker war und der Selektor laut matches() passte.
         Woran das lag, konnte ich nicht klaeren. Ohne konkurrierende Regeln kann es nicht mehr
         schiefgehen: welche Klasse gilt, entscheidet hier das JS. */
      /* Die drei Farben des gefuellten Knopfs stehen hier und nicht in der CSS. Grund, gemessen
         und nicht vermutet: eine Regel .unc-primary.is-solid-inv mit rgb(224,224,224) war im
         Stylesheet, matchte das Element laut matches(), stand spaeter und war spezifischer -- und
         getComputedStyle gab trotzdem den Wert der schwaecheren Regel zurueck. Dasselbe zuvor mit
         [data-theme="dark"] als Vorfahre und mit var(--vc-text). Woran es liegt, habe ich nicht
         gefunden; ein Inline-Wert schlaegt jede Regel und laesst der Kaskade keine Gelegenheit.
         Nur der gefuellte Knopf ist betroffen -- der umrandete kommt weiter aus der CSS. */
      var dunkelJetzt = root.getAttribute("data-theme") === "dark" || UC.themeParam(root.getAttribute("data-isdark"));
      if (t.dunkel) {
        var flaeche = dunkelJetzt ? "#e0e0e0" : "#1f1f1f";
        elPrim.style.background = flaeche;
        elPrim.style.borderColor = flaeche;
        elPrim.style.color = dunkelJetzt ? "#1f1f1b" : "#ffffff";
        elPrim.style.boxShadow = dunkelJetzt ? "none" : "inset 0 1px 0 rgba(255,255,255,0.16)";
      } else {
        elPrim.style.background = "";
        elPrim.style.borderColor = "";
        elPrim.style.color = "";
        elPrim.style.boxShadow = "";
      }

      var lg = logoQuelle();
      if (lg) { elLogo.setAttribute("src", lg); elLogo.style.display = ""; }
      else { elLogo.style.display = "none"; }

      syncTheme();
      root.classList.add("is-open");
      /* Die Karte haengt nicht mehr unter der Wurzel, also traegt sie die Sichtbarkeit selbst. */
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
      fire("data-dismiss-fn", "bubble_fn_uncDismiss", { id: n.id, reason: grund });
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
        var p = UC.parseLoose ? UC.parseLoose(payload, "notifications") : payload;
        /* Eine Liste, eine einzelne Zeile oder nichts -- alle drei kommen aus Bubble vor. Was
           nicht lesbar war, leert die Liste statt eine alte Karte stehen zu lassen: eine
           Benachrichtigung, die es nicht mehr gibt, darf nicht weiterleuchten. */
        state.list = isArr(p) ? p : (p && typeof p === "object" && p.id != null ? [p] : []);
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
      destroy: function () { if (traeger && traeger.parentNode) traeger.parentNode.removeChild(traeger); }
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
