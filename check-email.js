/* upstreem check-email.js — "Check your email" nach dem Signup (Praefix `uce`). Braucht core.js.

   ── Wozu ─────────────────────────────────────────────────────────────────
   Die Seite, auf der man nach dem Registrieren landet, wenn die Adresse erst bestaetigt werden
   muss. Sie hat genau eine Aufgabe: sagen, dass eine Mail unterwegs ist, und wohin. Aufgebaut
   wie die Bestaetigungsseiten von Linear, Vercel und Supabase: Zeichen, Satz, die Adresse als
   Wert darunter, EIN Weg zurueck zur Anmeldung (nicht zum Signup -- das Konto gibt es schon) und
   ein Hinweis auf den Spam-Ordner fuer den haeufigsten Grund, warum nichts ankommt.

   ── Was sie braucht ──────────────────────────────────────────────────────
   Nichts von Bubble: keine Events, keine Setter. Die Adresse liest sie aus ?email= (auch ?mail=),
   das Thema aus pref_theme, den Pin aus dem Seitenkopf. Rahmen, Wortmarke und Thema kommen aus
   core (UC.makeEinzelseite), wie bei forgot-password, reset-password und not-found.
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
    zurueck: "Back to sign in",
    hinweis: "Didn’t get it? Check your spam folder. It can take a minute to arrive."
  };

  /* Bubble baut ein Element neu, sobald sich ein dynamischer Wert daran aendert (Themenwechsel).
     Der zweite Aufbau zeigt die Seite schon -- ein zweiter Einzug waere ein Flackern. */
  var GESEHEN = window.__uceGesehen = window.__uceGesehen || {};

  function makeController(root){
    var UC = window.UpstreemCore, esc = UC.esc;
    var MISSING = ["makeEinzelseite", "esKopfHtml", "adressParameter", "esAttr", "mailOk", "icon"]
      .filter(function(k){ return typeof UC[k] !== "function"; });
    if (MISSING.length){
      if (window.console) console.error("[check-email] Die core.js auf dieser Seite ist AELTER als " +
        "check-email.js, es fehlen: " + MISSING.join(", ") + ". Alle Elemente auf denselben Commit pinnen.");
      return null;
    }
    var id = root.getAttribute("data-instance") || "default";
    var q = UC.adressParameter();
    var mail = String(q.email || q.mail || UC.esAttr(root, "data-email") || "").trim();
    /* Was nicht wie eine Adresse aussieht, steht nicht da -- lieber kein Wert als ein falscher. */
    if (!UC.mailOk(mail)) mail = "";
    var login = UC.esAttr(root, "data-login-url", "/signup?mode=login");

    UC.makeEinzelseite(root, {
      label: "check-email",
      einzug: !GESEHEN[id],
      inhalt:
        UC.esKopfHtml({ icon: "mail", titel: T.h1, text: T.sub,
          extra: mail ? '<div class="uce-mail"><span>' + esc(mail) + '</span></div>' : '' }) +
        '<a class="up-btn-sec is-lg up-es-weg" href="' + esc(login) + '" data-es-auf="3">' +
          UC.icon("arrowLeft", 2) + '<span>' + esc(T.zurueck) + '</span></a>' +
        '<p class="up-es-hinweis" data-es-auf="4">' + esc(T.hinweis) + '</p>'
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
