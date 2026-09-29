/* upstreem view-switch.js — der Umschalter "Pages / URLs" | "Responses" als eigene Komponente
   (Praefix `uvw`). Braucht core.js und view-switch.css.

   Bestellt am 28.09.: "nur einen 32px height switcher 'Pages / URLs' und 'Responses', DE
   'Unterseiten / URLs' und 'KI-Antworten', im Switcher-Design, das wir ueberall haben. Minimales
   JS-Event beim Switch, klassische Inputs wie dark."

   Der Umschalter IST .up-seg.is-lg aus core -- dieselbe Schiene, dieselbe gleitende Pille,
   dieselben 32px wie Domains/URLs in Top Citations. Hier steht nur, was es genau einmal gibt:
   die zwei Werte, das Ereignis und der Merker.

   ── Die Attribute ───────────────────────────────────────────────────────────────
       data-instance   Kennung. Ein Setter mit einem PRAEFIX trifft jede Kopie, deren Kennung
                       damit beginnt (Bubble haengt [dynamic id] an).
       data-isdark     "yes" / "no". Ueber UC.themeParam gelesen: kennt core ein Thema, gewinnt
                       core.
       data-value      "pages" (Vorgabe) | "responses" -- die Stufe beim ERSTEN Aufbau. Wird
                       live mitgelesen: aendert Bubble den Wert, zieht der Umschalter nach.
       data-switch-fn  die Bubble-Funktion fuer den Wechsel.

   ── Das Ereignis ────────────────────────────────────────────────────────────────
   Beim Klick auf die ANDERE Stufe: data-switch-fn bekommt den Wert als reinen Text, "pages"
   oder "responses". Kein JSON -- ein Workflow, der nur einen Wert braucht, soll nichts
   herausschneiden muessen (makeFire schickt Texte roh). Ein Klick auf die schon aktive Stufe
   meldet nichts, ein Setter-Aufruf auch nicht: der spiegelt nur, was Bubble schon weiss.

   ── Die Setter (optional) ───────────────────────────────────────────────────────
   setViewSwitch("[dynamic id]", "responses")   stumm umstellen
   resetViewSwitch("[dynamic id]")              zurueck auf data-value

   ── Themenwechsel = Neuaufbau ───────────────────────────────────────────────────
   Bubble baut das Element beim Themenwechsel neu, und data-value steht dann wieder auf seiner
   Vorgabe. Die gewaehlte Stufe steht deshalb in window.__uvwStore je data-instance und gewinnt
   beim Neuaufbau -- sonst spraenge der Umschalter bei jedem Themenwechsel auf "Pages / URLs"
   zurueck, waehrend die Seite darunter noch die Antworten zeigt.

   ── Verwendet aus core ──────────────────────────────────────────────────────────
   UC.makeMount, UC.makeFire, UC.makeLate, UC.themeParam, UC.t, UC.esc, UC.watchRoots.
   Aussehen: .up-seg / .up-seg-btn / .is-lg (core.css), Pille: segMessen (core.js).
   Deutsch: der Katalog in core ("Pages / URLs", "Responses"). */
(function () {
  "use strict";

  /* Boot-Stubs VOR der core-Pruefung, wie in skeleton.js: ein Workflow kann setViewSwitch rufen,
     bevor diese Datei steht. Ohne Stub wirft der Aufruf und reisst den Run-JS-Schritt mit. */
  var API_NAMES = ["setViewSwitch", "resetViewSwitch"];
  var Q = (window.__uvwBootQueue = window.__uvwBootQueue || []);
  API_NAMES.forEach(function (n) {
    if (!window[n]) window[n] = function () { Q.push([n, [].slice.call(arguments)]); };
  });

  /* Auf window, nicht im Modul: core.js und diese Datei koennen auf einer Seite mehrfach laufen
     (ein Loader je Element), und ein Merker im Modul-Scope waere dann je Lauf ein eigener. */
  var STORE = (window.__uvwStore = window.__uvwStore || {});

  var WERTE = { pages: "Pages / URLs", responses: "Responses" };
  /* Die Zeichen, die die App fuer genau diese Dinge schon traegt (29.09. angefordert: "die
     korrekten"): linkFeather wie der URLs-Reiter im Citations-Seitenkopf, response wie die
     KI-Antworten im Seitenkopf der Prompts-Seite (core, NAV_ZEICHEN). Strich 2, Hausstandard. */
  var ZEICHEN = { pages: "linkFeather", responses: "response" };
  var VORGABE = "pages";

  function uvwBoot(triesLeft) {
    if (!window.UpstreemCore) {
      if (triesLeft > 0) { setTimeout(function () { uvwBoot(triesLeft - 1); }, 100); return; }
      if (window.console) console.error("UpstreemCore (core.js) not loaded");
      return;
    }
    uvwStart();
  }

  function uvwStart() {
    var UC = window.UpstreemCore;
    var t = UC.t || function (s) { return s; };
    var esc = UC.esc || function (s) { return String(s); };
    var spaet = UC.makeLate ? UC.makeLate("view-switch", ".uvw-root") : null;

    function gueltig(v) {
      v = String(v == null ? "" : v).trim().toLowerCase();
      return Object.prototype.hasOwnProperty.call(WERTE, v) ? v : null;
    }

    function initRoot(root) {
      if (!root || root.__uvwCtrl) return root && root.__uvwCtrl;
      var id = String(root.getAttribute("data-instance") || "default").trim() || "default";
      var fire = UC.makeFire(root, { label: "view-switch", eventPrefix: "uvw" });

      /* Merker vor Attribut: nach einem Neuaufbau gilt, was der Nutzer zuletzt gewaehlt hat. */
      var attrAlt = root.getAttribute("data-value");
      var wert = gueltig(STORE[id]) || gueltig(attrAlt) || VORGABE;

      function knopf(v) {
        /* data-i18n traegt das englische Original: wechselt die Sprache spaeter, uebersetzt core
           von dort aus neu (derselbe Weg wie in power-dashboard). Die Beschriftung steht in einem
           eigenen span, das Zeichen davor: Groesse und Farbe kommen aus core (.up-seg-btn svg). */
        return '<button type="button" class="up-seg-btn uvw-btn" role="tab" data-uvw="' + v + '">' +
               (UC.icon ? UC.icon(ZEICHEN[v], 2) : "") +
               '<span data-i18n="' + esc(WERTE[v]) + '">' + esc(t(WERTE[v])) + '</span></button>';
      }
      /* EINMAL gebaut, danach nur Klassen umgestellt. Ein innerHTML je Wechsel wuerde die Pille
         von vorn messen lassen und die Uebersetzung wegwerfen -- und in einem Bubble-Element
         weckt jedes Neusetzen die Beobachter der Seite (siehe skeleton.js, "idempotent"). */
      root.innerHTML = '<div class="up-seg is-lg uvw-seg" role="tablist" aria-label="View">' +
                         knopf("pages") + knopf("responses") + '</div>';
      var knoepfe = root.querySelectorAll("[data-uvw]");

      function thema() {
        var dunkel = UC.themeParam ? UC.themeParam(root.getAttribute("data-isdark"))
                                   : /^(yes|true|1)$/i.test(String(root.getAttribute("data-isdark") || ""));
        /* Dieselbe Form wie core (applyThemeTo): dunkel = data-theme="dark", hell = kein Attribut.
           Ein "light" daneben liesse core das Element bei jedem Themenlauf neu schreiben. */
        if (dunkel && root.getAttribute("data-theme") !== "dark") root.setAttribute("data-theme", "dark");
        else if (!dunkel && root.hasAttribute("data-theme")) root.removeAttribute("data-theme");
      }

      function zeigen() {
        for (var i = 0; i < knoepfe.length; i++) {
          var an = knoepfe[i].getAttribute("data-uvw") === wert;
          knoepfe[i].classList.toggle("is-active", an);
          knoepfe[i].setAttribute("aria-selected", an ? "true" : "false");
        }
      }

      function merken() {
        /* Nur eine Wurzel im Dokument schreibt: eine abgehaengte alte darf den Merker nicht mit
           ihrem Stand ueberschreiben, waehrend Bubble schon die neue zeigt. */
        if (root.isConnected) STORE[id] = wert;
      }

      /* quelle: "klick" meldet, alles andere ist stumm. */
      function setzen(v, quelle) {
        var neu = gueltig(v);
        if (!neu) {
          /* Ein Tippfehler im Workflow soll auffindbar sein -- der Umschalter bleibt, wie er war. */
          if (v != null && String(v).trim() !== "" && window.console)
            console.warn('upstreem view-switch: unbekannter Wert "' + v + '" -- moeglich sind ' +
              Object.keys(WERTE).join(", ") + ". Der Umschalter bleibt auf \"" + wert + "\".");
          return;
        }
        if (neu === wert) return;
        wert = neu;
        zeigen();
        merken();
        if (quelle === "klick") fire("data-switch-fn", "uvwSwitch", wert);
      }

      root.addEventListener("click", function (e) {
        var b = e.target && e.target.closest ? e.target.closest("[data-uvw]") : null;
        if (!b || !root.contains(b)) return;
        setzen(b.getAttribute("data-uvw"), "klick");
      });

      /* data-isdark und data-value LIVE. data-value nur bei einer ECHTEN Aenderung: Bubble setzt
         Attribute beim Aufloesen der Ausdruecke gern ein zweites Mal mit demselben Wert, und das
         wuerde die Wahl des Nutzers auf die Vorgabe zuruecksetzen. */
      if (window.MutationObserver) {
        new MutationObserver(function (muts) {
          for (var i = 0; i < muts.length; i++) {
            var n = muts[i].attributeName;
            if (n === "data-isdark") thema();
            else if (n === "data-value") {
              var a = root.getAttribute("data-value");
              if (a !== attrAlt) { attrAlt = a; setzen(a, "attribut"); }
            }
          }
        }).observe(root, { attributes: true, attributeFilter: ["data-isdark", "data-value"] });
      }

      var ctrl = {
        instanceId: id,
        set: function (v) { setzen(v, "setter"); },
        reset: function () {
          delete STORE[id];
          setzen(gueltig(root.getAttribute("data-value")) || VORGABE, "reset");
        },
        get: function () { return wert; }
      };

      thema();
      zeigen();
      merken();
      /* Den Streifen JETZT setzen, nicht beim naechsten Lauf. Bubble baut dieses Element nach
         jedem Klick neu (data-value haengt an einem State) -- und bis der naechste Lauf kam, stand
         die neue Box ohne Streifen da ("aufflashen"). Ist die Fahrt der alten Box noch unterwegs,
         uebernimmt core sie hier und faehrt weiter (segSchreiben). */
      if (UC.segJetzt) UC.segJetzt(root);
      root.__uvwCtrl = ctrl;
      if (spaet) spaet.drain(id, ctrl);
      return ctrl;
    }

    /* Praefix wie in makeLate: "VIEWSWITCH" trifft jede Kopie "VIEWSWITCH_<dynamic id>". Ohne
       Kennung ("default") jede Instanz. Steht noch keine passende Wurzel, wartet der Aufruf. */
    function each(id, fn) {
      var soll = String(id == null ? "default" : id).trim() || "default";
      var roots = document.getElementsByClassName("uvw-root"), n = 0;
      for (var i = 0; i < roots.length; i++) {
        var r = roots[i];
        var ist = String(r.getAttribute("data-instance") || "default").trim() || "default";
        if (soll !== "default" && ist !== soll && ist.indexOf(soll) !== 0) continue;
        var c = r.__uvwCtrl || initRoot(r);
        if (c) { fn(c); n++; }
      }
      if (!n && spaet) spaet.park(soll, fn);
      return n;
    }

    UC.makeMount({
      rootClass: "uvw-root", notPortal: true,
      ctrlProp: "__uvwCtrl",
      resolveLocal: "__uvwResolveLocal",
      initRoot: initRoot,
      queue: "__uvwBootQueue",
      api: {
        setViewSwitch: function (id, v) { return each(id, function (c) { c.set(v); }); },
        resetViewSwitch: function (id) { return each(id, function (c) { c.reset(); }); }
      }
    });

    /* Bubble ersetzt den Block, sobald seine Ausdruecke aufloesen -- ohne watchRoots bliebe eine
       frisch eingehaengte Wurzel leer (in citations- und prompts-page-header zweimal passiert). */
    function alle() {
      var roots = document.getElementsByClassName("uvw-root");
      for (var i = 0; i < roots.length; i++) initRoot(roots[i]);
    }
    if (UC.watchRoots) UC.watchRoots("uvw-root", alle);
    [0, 100, 400, 1200].forEach(function (ms) { setTimeout(alle, ms); });
  }

  uvwBoot(50);
})();
