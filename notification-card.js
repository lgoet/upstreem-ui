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
    tip:          { icon: "bulb",        label: "Tip",          zweit: "Dismiss",      dunkel: false }
  };
  /* Ein unbekannter Typ darf die Karte nicht verschlucken: die Nachricht ist wichtiger als ihr
     Symbol. Also das neutrale Info-Zeichen und der Typ als Bezeichnung, so wie er kam. */
  function typOf(t) {
    var k = String(t == null ? "" : t).toLowerCase().trim();
    return TYPEN[k] || { icon: "info", label: k || "Notice", zweit: "Dismiss", dunkel: true };
  }

  function num(v) { var n = Number(v); return isFinite(n) ? n : null; }
  function isArr(v) { return Object.prototype.toString.call(v) === "[object Array]"; }

  /* Die neueste, wichtigste Nachricht zuerst. priority schlaegt created_at -- so kann ein
     Sicherheitshinweis eine aeltere Ankuendigung ueberholen, ohne dass Bubble sortieren muss. */
  function waehle(liste) {
    var arr = (liste || []).filter(function (n) { return n && n.id != null; });
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
        '<span class="unc-rules" aria-hidden="true"></span>' +
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

    root.innerHTML = shell();

    var elCard   = root.querySelector(".unc-card");
    var elLogo   = root.querySelector(".unc-logo");
    var elTile   = root.querySelector(".unc-tile");
    var elType   = root.querySelector(".unc-type");
    var elTitle  = root.querySelector(".unc-title");
    var elDesc   = root.querySelector(".unc-desc");
    var elSecond = root.querySelector(".unc-second");
    var elPrim   = root.querySelector(".unc-primary");

    var state = { list: [], aktuell: null, weg: {} };

    var fire = UC.makeFire ? UC.makeFire(root, instanceId) : function () {};

    function logoQuelle() {
      return root.getAttribute("data-logo") || "";
    }

    /* Zeigt die naechste Nachricht, die noch nicht weggeklickt wurde. Das `weg`-Verzeichnis lebt
       nur in dieser Sitzung: die dauerhafte Ablage macht der Workflow serverseitig, sonst kaeme
       eine geloeschte Nachricht nach einem Seitenwechsel wieder. */
    function render() {
      var n = waehle((state.list || []).filter(function (x) { return !state.weg[x.id]; }));
      state.aktuell = n;
      if (!n) { root.classList.remove("is-open"); return; }

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
      /* Ohne Ziel kein Knopf: ein Link, der nirgends hinfuehrt, ist schlimmer als keiner. */
      if (url) { elPrim.setAttribute("href", url); elPrim.style.display = ""; }
      else { elPrim.removeAttribute("href"); elPrim.style.display = "none"; }
      elPrim.classList.toggle("is-dark", !!t.dunkel);

      var lg = logoQuelle();
      if (lg) { elLogo.setAttribute("src", lg); elLogo.style.display = ""; }
      else { elLogo.style.display = "none"; }

      root.classList.add("is-open");
    }

    /* Ein Grund pro Weg hinaus, damit der Workflow unterscheiden kann: das X ist ein Wegklicken,
       der zweite Knopf ein bewusstes "spaeter" oder "war ich", der Hauptknopf ein Handeln. */
    function schliessen(grund) {
      var n = state.aktuell;
      if (!n) return;
      state.weg[n.id] = 1;
      /* Erst die Rueckwaerts-Animation, dann neu rendern: ein Sprung waere hier das Einzige an
         der Karte, das nicht weich ist. 180ms wie in der Vorlage. */
      root.classList.add("is-closing");
      setTimeout(function () {
        root.classList.remove("is-closing");
        render();
      }, 180);
      fire("data-dismiss-fn", "bubble_fn_uncDismiss", { id: n.id, reason: grund });
    }

    root.querySelector(".unc-x").addEventListener("click", function () { schliessen("close"); });
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
      destroy: function () {}
    };

    root.__uncController = ctrl;
    render();
    return ctrl;
  }

  var mount = UC.makeMount ? UC.makeMount({
    rootClass: "unc-root",
    init: initRoot,
    api: {
      setUpstreemNotifications:    function (id, payload) { return each(id, function (c) { c.set(payload); }); },
      dismissUpstreemNotification: function (id, notifId) { return each(id, function (c) { c.dismiss(notifId); }); },
      resetUpstreemNotifications:  function (id)          { return each(id, function (c) { c.reset(); }); }
    }
  }) : null;

  function each(id, fn) {
    var roots = document.getElementsByClassName("unc-root");
    for (var i = 0; i < roots.length; i++) {
      var r = roots[i];
      if (id != null && r.getAttribute("data-instance") !== String(id)) continue;
      var c = r.__uncController || initRoot(r);
      if (c) fn(c);
    }
  }

  API_NAMES.forEach(function (n) {
    window[n] = function () {
      var a = [].slice.call(arguments);
      if (n === "setUpstreemNotifications")    return each(a[0], function (c) { c.set(a[1]); });
      if (n === "dismissUpstreemNotification") return each(a[0], function (c) { c.dismiss(a[1]); });
      return each(a[0], function (c) { c.reset(); });
    };
  });

  /* Die Aufrufe, die vor dem Laden dieser Datei kamen, jetzt abarbeiten. */
  while (Q.length) { var q = Q.shift(); try { window[q[0]].apply(null, q[1]); } catch (e) {} }

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
