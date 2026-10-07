/* upstreem not-found.js — die 404-Seite (Praefix `unf`). Braucht core.js.

   ── Wozu ─────────────────────────────────────────────────────────────────
   Aufgebaut wie die 404-Seiten von Linear, Vercel und Stripe: die Zahl als Bild, ein kurzer Satz
   ohne Schuldzuweisung, und ZWEI Wege hinaus -- zum Dashboard (der Hauptweg) und zurueck. Keine
   Illustration: die Zahl traegt das Linienmuster der Anmeldeseite und der Landingpage, die Marke
   steckt im Muster, und die Seite bleibt so ruhig wie der Rest der App.

   ── Was sie braucht ──────────────────────────────────────────────────────
   Nichts von Bubble: keine Events, keine Setter. "Go back" geht im Verlauf zurueck, wenn man von
   einer Seite der App kam -- sonst zum Dashboard. Ein direkt geoeffneter toter Link hat keinen
   Verlauf, und ein Knopf, der nichts tut, ist schlimmer als einer, der woanders hinfuehrt.
   Rahmen, Wortmarke und Thema kommen aus core (UC.makeEinzelseite).
   Einzelheiten: bubble/not_found_bubble.html. */
(function(){
  "use strict";

  function unfBoot(triesLeft){
    if (!window.UpstreemCore){
      if (triesLeft > 0){ setTimeout(function(){ unfBoot(triesLeft - 1); }, 100); return; }
      if (window.console) console.error("UpstreemCore (core.js) not loaded");
      return;
    }
    unfRun();
  }

  var T = {
    h1:      "Page not found",
    sub:     "The page you’re looking for doesn’t exist or has been moved.",
    home:    "Go to dashboard",
    zurueck: "Go back"
  };

  var GESEHEN = window.__unfGesehen = window.__unfGesehen || {};

  function makeController(root){
    var UC = window.UpstreemCore, esc = UC.esc;
    var MISSING = ["makeEinzelseite", "esKopfHtml", "esAttr", "icon"]
      .filter(function(k){ return typeof UC[k] !== "function"; });
    if (MISSING.length){
      if (window.console) console.error("[not-found] Die core.js auf dieser Seite ist AELTER als " +
        "not-found.js, es fehlen: " + MISSING.join(", ") + ". Alle Elemente auf denselben Commit pinnen.");
      return null;
    }
    var id = root.getAttribute("data-instance") || "default";
    var home = UC.esAttr(root, "data-home-url", "/");

    var seite = UC.makeEinzelseite(root, {
      label: "not-found",
      einzug: !GESEHEN[id],
      inhalt:
        '<div class="unf-zahl" aria-hidden="true" data-es-auf="1">404</div>' +
        UC.esKopfHtml({ titel: T.h1, text: T.sub, auf: 2 }) +
        '<div class="unf-reihe" data-es-auf="3">' +
          '<a class="up-btn-pri is-lg" href="' + esc(home) + '">' + esc(T.home) + '</a>' +
          '<button class="up-btn-sec is-lg" type="button" data-unf-zurueck>' +
            UC.icon("arrowLeft", 2) + '<span>' + esc(T.zurueck) + '</span></button>' +
        '</div>'
    });
    GESEHEN[id] = true;

    seite.q("[data-unf-zurueck]").addEventListener("click", function(){
      var vonHier = false;
      try { vonHier = !!document.referrer && new URL(document.referrer).origin === window.location.origin; } catch(e){}
      if (vonHier && window.history.length > 1) window.history.back();
      else window.location.href = home;
    });
    return { root: root };
  }

  var mount = null;
  function unfRun(){
    mount = window.UpstreemCore.makeMount({
      onMount: function(m){ mount = m; },
      rootClass: "unf-root", notPortal: true,
      ctrlProp: "__unfController", resolveLocal: "__unfResolveLocal", queue: "__unfBootQueue",
      initRoot: initRootNow,
      api: {}
    });
  }
  function initRootNow(root){
    if (root.__unfController) return root.__unfController;
    /* KEIN Abbruch bei data-instance="INSTANCE_ID": niemand spricht die Seite ueber ihre ID an. */
    var c = makeController(root);
    root.__unfController = c;
    return c;
  }

  unfBoot(30);
})();
