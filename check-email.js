/* upstreem check-email.js — "Check your email" nach dem Signup (Praefix `uce`). Braucht core.js.

   ── Wozu ─────────────────────────────────────────────────────────────────
   Die Seite, auf der man nach dem Registrieren landet, wenn die Adresse erst bestaetigt werden
   muss. Das Zeichen (Hugeicons Mail01, ohne Kachel), die Ueberschrift, EIN Satz in der Drittfarbe
   und leise der Weg zurueck zur Anmeldung -- nicht zum Signup, das Konto gibt es schon. Mehr
   nicht (07.10.: Adress-Chip und Spam-Hinweis gestrichen, "da steht zu viel Text").

   ── Was sie braucht ──────────────────────────────────────────────────────
   Nichts von Bubble: keine Events, keine Setter, keine eigene CSS. Thema aus pref_theme, Pin aus
   dem Seitenkopf; Rahmen, Wortmarke und Thema kommen aus core (UC.makeEinzelseite).
   Einzelheiten: bubble/check_email_bubble.html. */
(function(){
  "use strict";

  function uceBoot(triesLeft){
    if (!window.UpstreemCore){
      if (triesLeft > 0){ setTimeout(function(){ uceBoot(triesLeft - 1); }, 100); return; }
      if (window.console) console.error("UpstreemCore (core.js) not loaded");
      return;
    }
    uceRun();
  }

  var T = {
    h1:      "Check your email",
    sub:     "We sent you a confirmation link. Please confirm your email to continue.",
    zurueck: "Back to sign in"
  };

  /* Bubble baut ein Element neu, sobald sich ein dynamischer Wert daran aendert (Themenwechsel).
     Der zweite Aufbau zeigt die Seite schon -- ein zweiter Einzug waere ein Flackern. */
  var GESEHEN = window.__uceGesehen = window.__uceGesehen || {};

  function makeController(root){
    var UC = window.UpstreemCore;
    var MISSING = ["makeEinzelseite", "esKopfHtml", "esZurueckHtml", "esAttr"]
      .filter(function(k){ return typeof UC[k] !== "function"; });
    if (MISSING.length){
      if (window.console) console.error("[check-email] Die core.js auf dieser Seite ist AELTER als " +
        "check-email.js, es fehlen: " + MISSING.join(", ") + ". Alle Elemente auf denselben Commit pinnen.");
      return null;
    }
    var id = root.getAttribute("data-instance") || "default";
    UC.makeEinzelseite(root, {
      label: "check-email",
      einzug: !GESEHEN[id],
      inhalt:
        UC.esKopfHtml({ icon: "mail01", titel: T.h1, text: T.sub }) +
        UC.esZurueckHtml({ href: UC.esAttr(root, "data-login-url", "/signup?mode=login"), text: T.zurueck, auf: 2 })
    });
    GESEHEN[id] = true;
    return { root: root };
  }

  var mount = null;
  function uceRun(){
    mount = window.UpstreemCore.makeMount({
      onMount: function(m){ mount = m; },
      rootClass: "uce-root", notPortal: true,
      ctrlProp: "__uceController", resolveLocal: "__uceResolveLocal", queue: "__uceBootQueue",
      initRoot: initRootNow,
      api: {}
    });
  }
  function initRootNow(root){
    if (root.__uceController) return root.__uceController;
    /* KEIN Abbruch bei data-instance="INSTANCE_ID" wie in den Komponenten mit Settern: hier spricht
       niemand die Seite ueber ihre ID an, und eine nicht ersetzte Vorlage soll trotzdem stehen. */
    var c = makeController(root);
    root.__uceController = c;
    return c;
  }

  uceBoot(30);
})();
