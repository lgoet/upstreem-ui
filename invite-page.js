/* upstreem invite-page.js — die Seite, auf der man mit einer Einladung landet (Praefix `uiv`).
   Braucht core.js.

   ── Wozu diese Seite da ist ─────────────────────────────────────────────
   Sie ist fuer viele das ERSTE, was sie von upstreem sehen: jemand aus ihrem Team hat sie
   eingeladen, und sie klicken auf einen Link. Die Seite hat genau eine Aufgabe -- sagen, WOZU
   man eingeladen ist, und EINEN Weg hinein anbieten. Aufgebaut wie die Einladungsseiten von
   Linear, Slack, Notion und Vercel (Recherche 25.09.):
     - eine zentrierte Spalte, und die Kennung des Teams ist der Held: Logo und Name, gross;
     - wer einlaedt und als was, wenn Bubble es mitschickt -- das schafft Vertrauen;
     - EIN Hauptknopf, kein Nebeneinander gleich lauter Wege;
     - wer angemeldet ist, sieht, mit welchem Konto, und hat einen leisen Ausweg ("Not you?");
     - ein Fehler sagt, was los ist, und bietet den naechsten Schritt an -- nie eine Sackgasse.

   ── Wer entscheidet was ─────────────────────────────────────────────────
   ALLE Pruefungen laufen in Bubble. Der Pageload-Workflow ruft den Einladungs-RPC und reicht
   dessen Antwort ROH an setInvitePage; diese Datei zeigt nur an und meldet Klicks zurueck. Ob
   jemand angemeldet ist, steht als Attribut am Element (data-logged-in, data-user-email) -- so
   muss kein Workflow ein JSON von Hand bauen (CLAUDE.md 2a).

   ── Die Zustaende ───────────────────────────────────────────────────────
     loading    bis die Antwort des RPC da ist: ein Skelett, das nach 15s aufgibt
     ready      die Einladung gilt: "Accept invite" (angemeldet) oder "Sign up" (nicht angemeldet)
     error      die Einladung gilt nicht: die Meldung des RPC im gewohnten Fehlerkasten und der
                Weg hinaus -- Dashboard und Log out bzw. zurueck zur Anmeldung
     accepting  Klick auf Accept: im Knopf zeichnet sich ein Haken
     welcome    "Welcome to upstreem" mit Kreisel, Bubble uebernimmt und navigiert

   ── Nach aussen ─────────────────────────────────────────────────────────
     setInvitePage(INSTANCE, "<RPC-Antwort, roh>")
     setInvitePageError(INSTANCE, "Meldung")    wenn das Annehmen in Bubble scheitert
     resetInvitePage(INSTANCE)
   Ereignisse (JavaScript to Bubble, je ein Element):
     uivAccept  uivSignup  uivLogout  uivDashboard  uivBack
   Einzelheiten und der Run-JS-Schritt: bubble/invite_page_bubble.html. */
(function(){
  "use strict";

  /* Bubble kann die Setter rufen, bevor diese Datei vom CDN da ist. Ohne Stubs wirft der Aufruf
     "is not a function" und reisst den ganzen Run-JavaScript-Schritt mit (wie auth-page.js). */
  var BOOTQ = window.__uivBootQueue = window.__uivBootQueue || [];
  if (!window.__uivBootStubbed){
    window.__uivBootStubbed = true;
    ["setInvitePage", "setInvitePageError", "resetInvitePage"].forEach(function(n){
      window[n] = function(){ BOOTQ.push([n, arguments]); };
    });
  }

  function uivBoot(triesLeft){
    if (!window.UpstreemCore){
      if (triesLeft > 0){ setTimeout(function(){ uivBoot(triesLeft - 1); }, 100); return; }
      if (window.console) console.error("UpstreemCore (core.js) not loaded");
      return;
    }
    uivRun();
  }

  /* Die Texte, englisch wie jede sichtbare Beschriftung der App. Die deutschen stehen im Katalog
     von core; der setzt sie ein, wo die Seite gezeichnet ist -- hier ruft niemand t(). */
  var T = {
    eyebrow:      "You’ve been invited to join",
    eyebrowAlt:   "Your invitation to join",
    ohneTeam:     "This invitation can’t be used",
    teamErsatz:   "Your team",
    invitedBy:    "Invited by",
    als:          "as",
    alsAllein:    "Joining as",
    accept:       "Accept invite",
    signup:       "Sign up",
    dashboard:    "Back to dashboard",
    back:         "Back to sign in",
    logout:       "Log out",
    signedInAs:   "Signed in as",
    notYou:       "Not you?",
    welcome:      "Welcome to",
    topDashboard: "Dashboard",
    laden:        "Loading",
    laedtNicht:   "We could not load your invitation. Please reload the page.",
    unlesbar:     "We could not read your invitation. Please reload the page.",
    allgemein:    "This invitation is not valid anymore. Please ask your team for a new one.",
    dauert:       "This is taking longer than expected. Please reload the page.",
    annehmenLos:  "We could not accept your invitation. Please reload the page.",
    klemmt:       "Something went wrong. Please reload the page."
  };

  /* Wie lange etwas dauern darf, bevor die Seite selbst etwas sagt. Ein Ladezustand muss IMMER
     enden (CLAUDE.md 2) -- ein Skelett, das nie aufgibt, sieht aus wie "gleich da". */
  var LADEN_MAX      = 15000;  /* bis die Antwort des RPC da sein muss */
  var KNOPF_MAX      = 15000;  /* ein Knopf, der wegnavigieren soll, und die Seite bleibt */
  var WILLKOMMEN_MAX = 25000;  /* der Willkommensbildschirm, wenn Bubble nicht weiternavigiert */
  /* Die Choreografie beim Annehmen, in Millisekunden ab dem Klick:
       0     die Beschriftung geht, der Haken beginnt zu zeichnen (CSS: 120ms Versatz, 420ms Lauf)
       780   der Haken steht einen Atemzug lang -- dann faehrt die Einladung aus
       780+  der Willkommensblock kommt (CSS: 120ms Versatz auf das Ausfahren)
     780 und nicht weniger: 120 + 420 = 540 ist das Ende des Hakens, und ein Haken, der im selben
     Moment verschwindet, in dem er fertig ist, wird nicht gesehen. */
  var HAKEN_STEHT = 780;
  /* Wie lange die Klasse is-entering steht: letzter Versatz (330ms) plus Dauer (420ms) plus
     Luft. Faellt sie zu frueh, bricht der letzte Block mitten im Einzug ab. */
  var EINZUG_MS = 1100;

  function makeController(root){
    var UC = window.UpstreemCore;
    var esc = UC.esc;
    var fire = UC.makeFire(root, { label: "invite-page", eventPrefix: "uiv" });

    function attr(n, f){
      var v = root.getAttribute(n);
      /* Ein nicht ersetzter Platzhalter aus der Vorlage (LOGO_URL, USER_EMAIL ...) zaehlt als leer. */
      return (v == null || v === "" || /^[A-Z_]{3,}$/.test(v)) ? (f || "") : v;
    }
    function ic(name, w){ return UC.icon ? UC.icon(name, w || 2) : ""; }
    function str(v){ return v == null ? "" : String(v).trim(); }

    var state = { phase: "loading", data: null, err: "", busy: false };
    var uhrLaden = null, uhrKnopf = null, uhrHaken = null, uhrWillkommen = null, uhrEinzug = null;
    var ersterAuftritt = true;

    /* ---------------- Thema ----------------
       Dieselbe Reihenfolge wie auf der Anmeldeseite (auth-page.js): ein ausdrueckliches
       data-theme, dann data-isdark aus Bubble, dann die gespeicherte Wahl, dann das System. */
    function istDunkel(){
      if (root.getAttribute("data-theme") === "dark") return true;
      var roh = root.getAttribute("data-isdark");
      if (roh != null && roh !== "" && !/^[A-Z_]{3,}$/.test(roh)) return UC.isYes(roh);
      try {
        var g = localStorage.getItem("pref_theme");
        if (g === "dark") return true;
        if (g === "light") return false;
      } catch(e){}
      try { return !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches); }
      catch(e){ return false; }
    }
    function logoAdresse(){ return (istDunkel() && attr("data-logo-dark")) || attr("data-logo"); }
    function syncTheme(){
      var d = istDunkel();
      if (d) root.setAttribute("data-theme", "dark"); else root.removeAttribute("data-theme");
      var b = root.querySelector("[data-theme-btn]");
      if (b){
        /* Das Zeichen zeigt, WOHIN der Klick fuehrt: im Hellen ein Mond. */
        b.innerHTML = d ? ic("sun", 2) : ic("moon", 2);
        b.setAttribute("aria-label", d ? "Switch to light mode" : "Switch to dark mode");
      }
      var neu = logoAdresse();
      root.querySelectorAll("img[data-upstreem-logo]").forEach(function(l){
        if (neu && l.getAttribute("src") !== neu) l.setAttribute("src", neu);
      });
    }

    /* ---------------- Aufbau ---------------- */
    /* Der upstreem-Schriftzug. Faellt die Adresse aus, bleibt oben die Stelle leer (wie im
       Onboarding: leer ist besser als das Bruchbild-Symbol) -- im Willkommenssatz dagegen steht
       dann das Wort, denn "Welcome to" ohne Ende liest sich wie ein Fehler. */
    function wortmarke(klasse, alsWort){
      var src = logoAdresse();
      var ersatz = alsWort ? '<span class="' + klasse + ' is-wort">upstreem</span>'
                           : '<span class="' + klasse + '"></span>';
      if (!src) return ersatz;
      var tausch = alsWort
        ? "this.replaceWith(Object.assign(document.createElement('span'),{className:'" + klasse + " is-wort',textContent:'upstreem'}))"
        : "this.replaceWith(Object.assign(document.createElement('span'),{className:'" + klasse + "'}))";
      return '<img class="' + klasse + '" data-upstreem-logo src="' + esc(src) + '" alt="upstreem" ' +
             'onerror="' + tausch + '"/>';
    }
    function shell(){
      /* KEIN Flimmerraster im Hintergrund (25.09. angefordert: "normale Hintergrundfarbe wie auf
         Signup"). Die Seite steht auf ihrer Grundfarbe, siehe invite-page.css. */
      return '' +
        '<header class="uiv-top">' +
          wortmarke("uiv-logo", false) +
          '<div class="uiv-topr">' +
            /* Die Ausgaenge wie im Onboarding: reine Icon-Knoepfe mit data-tip und aria-label.
               Nur fuer Angemeldete -- wer nicht angemeldet ist, hat hier kein Dashboard und nichts
               zum Abmelden, und ein "Zurueck" fuer jemanden, der gerade aus einer Mail kommt,
               fuehrte ins Leere. Sein Weg ist der Hauptknopf. */
            '<button class="up-iconbtn uiv-tb" type="button" data-act="dashboard" ' +
              'aria-label="' + T.topDashboard + '" data-tip="' + T.topDashboard + '">' + ic("home", 1.8) + '</button>' +
            '<button class="up-iconbtn uiv-tb" type="button" data-act="logout" ' +
              'aria-label="' + T.logout + '" data-tip="' + T.logout + '">' + ic("logOut", 1.8) + '</button>' +
            '<button class="up-iconbtn uiv-themebtn" type="button" data-theme-btn aria-label="Switch theme"></button>' +
          '</div>' +
        '</header>' +
        '<main class="uiv-mid">' +
          /* Alle drei Flaechen liegen im SELBEN Rasterfeld uebereinander. So blendet eine aus und
             die naechste ein, ohne dass die Spalte springt -- und ohne gemessene Hoehen. */
          '<div class="uiv-stage">' +

            /* 1. Skelett, solange die Antwort fehlt. Die Balken sind .up-tsk-bar/.up-tsk-logo aus
               core (wie das Tarifskelett im Onboarding), nur in den Massen der echten Einladung --
               damit beim Wechsel nichts an eine andere Stelle faehrt. */
            '<section class="uiv-pane uiv-skel" data-pane="loading" aria-hidden="true">' +
              '<span class="up-tsk-bar uiv-sk-eyebrow"></span>' +
              '<span class="up-tsk-logo uiv-sk-logo"></span>' +
              '<span class="up-tsk-bar uiv-sk-name"></span>' +
              '<span class="up-tsk-bar uiv-sk-cta"></span>' +
              '<span class="up-tsk-bar uiv-sk-who"></span>' +
            '</section>' +

            /* 2. Die Einladung -- auch im Fehlerfall, dann mit Kasten und anderem Knopf. */
            '<section class="uiv-pane uiv-invite" data-pane="invite">' +
              '<p class="uiv-eyebrow" data-eyebrow></p>' +
              '<div class="uiv-brand">' +
                '<span class="uiv-brand-logo" data-brand-logo></span>' +
                '<h1 class="uiv-brand-name" data-brand-name></h1>' +
              '</div>' +
              '<p class="uiv-ctx" data-ctx></p>' +
              '<div class="uiv-act">' +
                /* Der gewohnte Fehlerkasten, seit dem 25.09. in core. */
                '<div class="up-formerr" data-err><div><div class="up-formerr-in" data-err-txt role="alert"></div></div></div>' +
                '<div class="uiv-actions">' +
                  '<button class="up-btn-pri is-lg uiv-cta" type="button" data-cta>' +
                    '<span class="uiv-cta-t" data-cta-t></span>' +
                    '<span class="uiv-cta-spin" aria-hidden="true"></span>' +
                    /* EIN Pfad, damit er sich zeichnen laesst (stroke-dashoffset). Laenge 19.8 --
                       die CSS rechnet mit 24, dann ist er bei vollem Versatz sicher unsichtbar. */
                    '<svg class="uiv-cta-check" viewBox="0 0 24 24" aria-hidden="true">' +
                      '<path d="M5 12.5l4.5 4.5L19 7.5"/></svg>' +
                  '</button>' +
                  '<button class="up-btn-sec is-lg uiv-cta2" type="button" data-cta2 hidden></button>' +
                '</div>' +
              '</div>' +
              '<p class="uiv-who" data-who></p>' +
            '</section>' +

            /* 3. Willkommen. Der Schriftzug steht IN der Zeile, wie ein Wort. */
            '<section class="uiv-pane uiv-welcome" data-pane="welcome">' +
              '<h1 class="uiv-welcome-h"><span data-welcome-t>' + T.welcome + '</span> ' + wortmarke("uiv-welcome-logo", true) + '</h1>' +
              '<span class="uiv-welcome-spin" role="status" data-welcome-spin aria-label="' + T.laden + '"></span>' +
            '</section>' +

          '</div>' +
        '</main>';
    }

    root.innerHTML = shell();
    var elEyebrow = root.querySelector("[data-eyebrow]");
    var elLogo    = root.querySelector("[data-brand-logo]");
    var elName    = root.querySelector("[data-brand-name]");
    var elCtx     = root.querySelector("[data-ctx]");
    var elErr     = root.querySelector("[data-err]");
    var elErrTxt  = root.querySelector("[data-err-txt]");
    var elCta     = root.querySelector("[data-cta]");
    var elCtaT    = root.querySelector("[data-cta-t]");
    var elCta2    = root.querySelector("[data-cta2]");
    var elWho     = root.querySelector("[data-who]");
    var elWelT    = root.querySelector("[data-welcome-t]");
    var elWelSpin = root.querySelector("[data-welcome-spin]");

    function drin(){ return UC.isYes(attr("data-logged-in", "no")); }

    /* ---------------- Die Kachel ----------------
       Logo des Teams, sonst sein Anfangsbuchstabe, ohne Team das Team-Zeichen. Nur neu bauen,
       wenn sich etwas geaendert hat: render laeuft oft, und ein neu gesetztes Bild laedt neu und
       flackert. */
    function kachel(d){
      var name = d.brand || "", logo = d.logo || "";
      var schluessel = name + "\n" + logo;
      if (elLogo.__uivKey === schluessel) return;
      elLogo.__uivKey = schluessel;
      elLogo.classList.remove("has-img", "is-klein", "is-zeichen");
      if (!name){
        elLogo.classList.add("is-zeichen");
        elLogo.innerHTML = ic("users", 1.7);
        return;
      }
      var ltr = '<span class="uiv-brand-ltr">' + esc(name.charAt(0).toUpperCase()) + '</span>';
      if (!logo){ elLogo.innerHTML = ltr; return; }
      elLogo.classList.add("has-img");
      elLogo.innerHTML = ltr + '<img src="' + esc(logo) + '" alt="" referrerpolicy="no-referrer"/>';
      var img = elLogo.querySelector("img");
      function weg(){ elLogo.classList.remove("has-img", "is-klein"); if (img.parentNode) img.parentNode.removeChild(img); }
      function da(){
        var w = img.naturalWidth || 0;
        /* 16px und weniger ist ein Favicon in Briefmarkengroesse -- auf 56px gezogen wird es
           Matsch. Dann lieber der Buchstabe (dieselbe Schwelle wie im Onboarding). Bis zur
           Kachelgroesse steht es in seiner eigenen Groesse, statt hochgerechnet zu werden. */
        if (w && w <= 16){ weg(); return; }
        if (w && w < 56) elLogo.classList.add("is-klein");
      }
      /* Die Zuhoerer haengen im selben Durchlauf wie das Bild: load und error kommen als eigene
         Aufgabe, auch aus dem Zwischenspeicher, und werden deshalb nicht verpasst. KEIN Blick auf
         img.complete mit naturalWidth 0 als "kaputt" -- ein SVG ohne eigene Groesse meldet genau
         das und waere als gueltiges Logo verworfen worden. */
      img.addEventListener("error", weg);
      img.addEventListener("load", da);
    }

    /* Die Rolle mit grossem Anfangsbuchstaben IM TEXT und nicht per CSS: der RPC schickt sie
       klein ("member"), der Katalog von core kennt sie gross ("Member" -> "Mitglied"). Nur
       text-transform haette sie im Deutschen englisch stehen lassen. */
    function rolle(r){ r = str(r); return r ? r.charAt(0).toUpperCase() + r.slice(1).toLowerCase() : ""; }

    /* ---------------- Zeichnen ---------------- */
    function render(){
      var d = state.data || {};
      var angemeldet = drin();
      var fehler = state.phase === "error";
      var mail = str(attr("data-user-email"));
      root.setAttribute("data-phase", state.phase);
      /* Das Skelett zeigt die Kontozeile nur, wenn sie gleich auch kommt (siehe CSS). */
      root.classList.toggle("has-who", angemeldet && !!mail);

      /* Welche Flaeche steht. accepting ist noch die Einladung -- der Haken zeichnet sich IN ihr. */
      var flaeche = state.phase === "loading" ? "loading"
                  : state.phase === "welcome" ? "welcome" : "invite";
      root.querySelectorAll("[data-pane]").forEach(function(p){
        var an = p.getAttribute("data-pane") === flaeche;
        p.classList.toggle("is-an", an);
        if (an) p.removeAttribute("aria-hidden"); else p.setAttribute("aria-hidden", "true");
      });

      /* Kopfzeile: nur angemeldet, und nicht beim Hineingehen -- wer gerade eintritt, soll nicht
         an zwei Ausgaengen vorbei. */
      var ausgaenge = angemeldet && state.phase !== "accepting" && state.phase !== "welcome";
      root.querySelectorAll(".uiv-tb").forEach(function(b){ b.hidden = !ausgaenge; });

      /* Der Satz wird beim Wechsel NEU gesetzt, auch wenn er schon dasteht: core uebersetzt nur,
         was sichtbar ist oder sich aendert, und der Willkommensblock stand seit dem Aufbau
         unsichtbar da -- gemessen blieb "Welcome to" auf Deutsch englisch. Das Neusetzen ist die
         Aenderung, auf die der Katalog wartet. */
      if (flaeche === "welcome"){
        elWelT.textContent = T.welcome;
        /* Das Attribut uebersetzt der Katalog bei einer blossen Wiederholung NICHT (gemessen:
           blieb "Loading") -- hier also ausdruecklich. */
        elWelSpin.setAttribute("aria-label", UC.t ? UC.t(T.laden) : T.laden);
      }

      if (flaeche !== "invite") return;

      /* Kopf: im Fehlerfall zeigt er das Team nur, wenn der RPC es mitgeschickt hat -- "Deine
         Einladung zu Acme" sagt mehr als eine Meldung ohne Namen. Ohne Team steht dort, was los
         ist, in der Groesse eines Titels und mit dem Team-Zeichen in der Kachel. */
      var mitMarke = !!d.brand;
      kachel(d);
      if (fehler && !mitMarke){
        elEyebrow.hidden = true;
        elName.textContent = T.ohneTeam;
        elName.classList.add("is-klein");
      } else {
        elEyebrow.hidden = false;
        elEyebrow.textContent = fehler ? T.eyebrowAlt : T.eyebrow;
        elName.textContent = d.brand || T.teamErsatz;
        elName.classList.remove("is-klein");
      }

      /* Wer eingeladen hat, und als was -- beides freiwillig, beides nur im gueltigen Fall. Jeder
         Text in eigenem Element, sonst kann der Katalog von core ihn nicht uebersetzen. */
      var ctx = "";
      if (!fehler && d.inviter){
        ctx += '<span>' + T.invitedBy + '</span><b>' + esc(d.inviter) + '</b>';
      }
      if (!fehler && d.role){
        ctx += '<span>' + (d.inviter ? T.als : T.alsAllein) + '</span>' +
               '<span class="up-entchip is-static uiv-role"><span class="uiv-rolelbl">' + esc(rolle(d.role)) + '</span></span>';
      }
      if (elCtx.__uivHtml !== ctx){ elCtx.__uivHtml = ctx; elCtx.innerHTML = ctx; }
      elCtx.hidden = !ctx;

      elErrTxt.textContent = state.err || "";
      elErr.classList.toggle("is-on", !!state.err);

      /* EIN Hauptknopf. Im Fehlerfall ist er der Weg hinaus und kein zweiter Versuch: den Grund
         des Fehlers kann hier niemand beheben. */
      var was = fehler ? (angemeldet ? "dashboard" : "back") : (angemeldet ? "accept" : "signup");
      elCta.setAttribute("data-was", was);
      elCtaT.textContent = { accept: T.accept, signup: T.signup, dashboard: T.dashboard, back: T.back }[was];
      /* Der zweite Knopf nur im Fehlerfall und nur angemeldet: ein falsches Konto ist dort der
         haeufigste Grund, und der Ausweg dafuer ist das Abmelden. */
      var zweiter = fehler && angemeldet;
      elCta2.hidden = !zweiter;
      elCta2.textContent = T.logout;

      /* Mit welchem Konto. "Not you?" nur, wenn nicht schon der Log-out-Knopf daneben steht. */
      if (angemeldet && mail){
        var who = '<span>' + T.signedInAs + '</span><b>' + esc(mail) + '</b>' +
          (zweiter ? '' : '<span class="uiv-dot" aria-hidden="true">·</span>' +
                          '<button class="uiv-notyou" type="button" data-act="logout">' + T.notYou + '</button>');
        if (elWho.__uivHtml !== who){ elWho.__uivHtml = who; elWho.innerHTML = who; }
        elWho.hidden = false;
      } else {
        elWho.__uivHtml = ""; elWho.innerHTML = ""; elWho.hidden = true;
      }

      /* Gesperrt wird ueber aria-disabled und nicht ueber disabled: der Core-Knopf dimmt sich
         bei :disabled auf 40 Prozent, und ein Knopf, der gerade seinen Haken zeichnet, darf
         nicht grau werden. Doppelklicks faengt der Klick-Zuhoerer ab. */
      var gesperrt = state.busy || state.phase === "accepting";
      elCta.classList.toggle("is-busy", state.busy);
      elCta.classList.toggle("is-done", state.phase === "accepting");
      elCta.setAttribute("aria-disabled", gesperrt ? "true" : "false");
      elCta.setAttribute("aria-busy", gesperrt ? "true" : "false");
      elCta2.setAttribute("aria-disabled", gesperrt ? "true" : "false");
    }

    /* ---------------- Uhren ---------------- */
    function uhrenAus(){
      [uhrLaden, uhrKnopf, uhrHaken, uhrWillkommen].forEach(function(u){ if (u) clearTimeout(u); });
      uhrLaden = uhrKnopf = uhrHaken = uhrWillkommen = null;
    }
    function ladenStellen(){
      if (uhrLaden) clearTimeout(uhrLaden);
      uhrLaden = setTimeout(function(){
        uhrLaden = null;
        if (state.phase !== "loading") return;
        state.phase = "error"; state.err = T.laedtNicht;
        auftritt(); render();
      }, LADEN_MAX);
    }
    /* Der Einzug beim ERSTEN Erscheinen der Einladung -- nicht beim Aufbau: dann steht noch das
       Skelett, und die Staffelung liefe unsichtbar ab, waehrend der RPC unterwegs ist. */
    function auftritt(){
      if (!ersterAuftritt) return;
      ersterAuftritt = false;
      root.classList.add("is-entering");
      if (uhrEinzug) clearTimeout(uhrEinzug);
      uhrEinzug = setTimeout(function(){ uhrEinzug = null; root.classList.remove("is-entering"); }, EINZUG_MS);
    }

    /* ---------------- Handlungen ---------------- */
    var EREIGNIS = {
      accept:    ["data-accept-fn", "uivAccept"],
      signup:    ["data-signup-fn", "uivSignup"],
      logout:    ["data-logout-fn", "uivLogout"],
      dashboard: ["data-dashboard-fn", "uivDashboard"],
      back:      ["data-back-fn", "uivBack"]
    };
    /* Gibt zurueck, ob ein Empfaenger da war. Ohne Wert, wie die Ausgaenge des Onboardings: der
       Workflow braucht keinen -- das Token steht in der Adresse, das Konto in Bubble. */
    function melden(was){
      var m = EREIGNIS[was];
      return m ? fire(m[0], m[1], null) : false;
    }
    /* Ein Knopf, der wegnavigiert, dreht sich, bis die Seite geht. Tut sie es nicht, gibt er nach
       KNOPF_MAX wieder frei und sagt es -- ein Knopf, der sich fuer immer dreht, ist tot. */
    function busyStarten(){
      state.busy = true; render();
      if (uhrKnopf) clearTimeout(uhrKnopf);
      uhrKnopf = setTimeout(function(){
        uhrKnopf = null;
        if (!state.busy) return;
        state.busy = false; state.err = T.dauert;
        render();
      }, KNOPF_MAX);
    }

    /* ANNEHMEN. Die Bewegung laeuft SOFORT und wartet nicht auf Bubble: der Workflow startet im
       selben Augenblick und arbeitet, waehrend der Haken zeichnet und der Willkommensblock kommt
       -- genau diese Zeit deckt der Kreisel darunter ab. Geht das Annehmen schief, ruft Bubble
       setInvitePageError, und die Seite kehrt mit der Meldung zur Einladung zurueck. */
    function annehmen(){
      if (state.phase !== "ready") return;
      state.phase = "accepting"; state.err = "";
      var angekommen = melden("accept");
      /* Hat Bubble noch waehrend des Aufrufs geantwortet, gilt seine Antwort. */
      if (state.phase !== "accepting") return;
      if (!angekommen){
        /* Kein Empfaenger: das JavaScript-to-Bubble-Element fehlt. Nicht so tun, als liefe es --
           sonst dreht der Willkommensbildschirm 25 Sekunden ins Leere. */
        state.phase = "ready"; state.err = T.annehmenLos;
        render(); return;
      }
      render();
      uhrHaken = setTimeout(function(){
        uhrHaken = null;
        if (state.phase !== "accepting") return;
        state.phase = "welcome";
        render();
        uhrWillkommen = setTimeout(function(){
          uhrWillkommen = null;
          if (state.phase !== "welcome") return;
          state.phase = "error"; state.err = T.dauert;
          render();
        }, WILLKOMMEN_MAX);
      }, HAKEN_STEHT);
    }

    elCta.addEventListener("click", function(){
      if (state.busy || state.phase === "accepting") return;
      var was = elCta.getAttribute("data-was");
      if (was === "accept"){ annehmen(); return; }
      if (!melden(was)){ state.err = T.klemmt; render(); return; }
      busyStarten();
    });
    elCta2.addEventListener("click", function(){
      if (state.busy || state.phase === "accepting") return;
      if (!melden("logout")){ state.err = T.klemmt; render(); }
    });
    /* Kopfzeile und "Not you?" -- ein Zuhoerer fuer alle, auch fuer den Knopf, der erst beim
       Zeichnen entsteht. */
    root.addEventListener("click", function(e){
      var b = e.target && e.target.closest ? e.target.closest("[data-act]") : null;
      if (!b || !root.contains(b)) return;
      if (state.phase === "accepting" || state.phase === "welcome") return;
      if (!melden(b.getAttribute("data-act")) && state.phase !== "loading"){
        state.err = T.klemmt; render();
      }
    });
    root.querySelector("[data-theme-btn]").addEventListener("click", function(){
      var neuDunkel = !istDunkel();
      if (UC.setUpstreemTheme) UC.setUpstreemTheme(neuDunkel ? "dark" : "light");
      else if (neuDunkel) root.setAttribute("data-theme", "dark"); else root.removeAttribute("data-theme");
      syncTheme();
    });
    if (UC.onTheme) UC.onTheme(syncTheme);
    if (UC.makeTooltips) UC.makeTooltips(root, istDunkel);

    /* Bubble loest dynamische Ausdruecke manchmal erst NACH dem Aufbau auf und schreibt das
       Attribut dann an Ort und Stelle um. Ein einmaliges Lesen verpasste "angemeldet" und zeigte
       Sign up statt Accept -- also beobachten. */
    if (window.MutationObserver){
      new MutationObserver(function(){ syncTheme(); render(); }).observe(root, {
        attributes: true,
        attributeFilter: ["data-logged-in", "data-user-email", "data-isdark", "data-logo", "data-logo-dark"]
      });
    }

    /* Breite, an der Wurzel gemessen und nicht am Fenster -- in Bubble steckt die Seite in einem
       Element (wie im Onboarding). */
    function messeBreite(){
      var w = root.clientWidth;
      root.classList.toggle("is-narrow", w < 760);
      root.classList.toggle("is-vnarrow", w < 460);
    }
    messeBreite();
    if (UC.onResize) UC.onResize(root, messeBreite);
    else window.addEventListener("resize", messeBreite);

    syncTheme();
    render();
    ladenStellen();

    return {
      root: root,
      setData: function(raw){
        var p = UC.readBubble ? UC.readBubble(raw) : null;
        if (Array.isArray(p)) p = p[0];
        /* Verpackt geliefert ({"data": {...}}, so reichen manche Plugins die Antwort durch): dann
           gilt das Innere. Ohne das stuende eine gueltige Einladung als "nicht mehr gueltig" da. */
        if (p && typeof p === "object" && p.data && typeof p.data === "object" &&
            p.ok == null && p.valid == null && !p.brand_name && !p.team_name){
          p = Array.isArray(p.data) ? p.data[0] : p.data;
        }
        if (uhrLaden){ clearTimeout(uhrLaden); uhrLaden = null; }
        /* Waehrend des Annehmens aendert eine zweite Antwort nichts mehr: Bubble schickt den
           Pageload manchmal doppelt, und der Nutzer soll nicht aus seinem Haken gerissen werden.
           Geschoben wird nur vorwaerts (wie im Onboarding). */
        if (state.phase === "accepting" || state.phase === "welcome") return true;
        /* KAPUTT IST NICHT LEER (CLAUDE.md 2): eine Antwort, die sich nicht lesen laesst, zeigt den
           Fehlerkasten -- nie ein stehendes Skelett. */
        if (!p || typeof p !== "object"){
          state.phase = "error"; state.err = T.unlesbar; state.data = null; state.busy = false;
          auftritt(); render(); return false;
        }
        /* Die Felder unter mehreren Namen: welche der RPC benutzt, weiss diese Datei nicht, und
           ein Name, der nicht passt, darf nicht still ein leeres Logo ergeben. Eine verschachtelte
           Marke ({"brand": {"name": ...}}) geht auch. */
        var b = (p.brand && typeof p.brand === "object") ? p.brand
              : (p.team && typeof p.team === "object") ? p.team : {};
        state.data = {
          brand:   str(p.brand_name || p.team_name || b.name || (typeof p.brand === "string" ? p.brand : "") || p.name),
          logo:    str(p.brand_logo || p.brand_logo_url || p.logo_url || p.team_logo || b.logo || b.logo_url || p.logo),
          inviter: str(p.inviter_name || p.invited_by_name || p.invited_by || p.inviter),
          role:    str(p.role || p.invited_role)
        };
        /* error kann ein Objekt sein ({"message": ..., "code": ...}, so meldet Supabase) -- dann
           gilt seine Meldung. Sonst stuende "[object Object]" im Kasten. */
        var err = (p.error && typeof p.error === "object") ? p.error.message : p.error;
        var msg = str(p.message || p.error_message || err || p.reason || p.msg);
        var okRoh = p.ok != null ? p.ok : (p.valid != null ? p.valid : p.success);
        /* Gilt die Einladung? Steht ok da, entscheidet ok. Fehlt es, entscheidet die Meldung: ohne
           Meldung und mit einem Team ist es eine gueltige Einladung. */
        var gueltig = okRoh != null ? (okRoh === true || UC.isYes(okRoh)) : (!msg && !!state.data.brand);
        state.phase = gueltig ? "ready" : "error";
        state.err = gueltig ? "" : (msg || T.allgemein);
        state.busy = false;
        if (uhrKnopf){ clearTimeout(uhrKnopf); uhrKnopf = null; }
        auftritt();
        render();
        return true;
      },
      setError: function(text){
        uhrenAus();
        state.phase = "error"; state.err = str(text) || T.allgemein; state.busy = false;
        auftritt();
        render();
        return true;
      },
      reset: function(){
        uhrenAus();
        state = { phase: "loading", data: null, err: "", busy: false };
        ersterAuftritt = true;
        render(); ladenStellen();
        return true;
      }
    };
  }

  var mount = null;
  function uivRun(){
    var UCl = window.UpstreemCore;
    mount = UCl.makeMount({
      onMount: function(m){ mount = m; },
      rootClass: "uiv-root", notPortal: true,
      ctrlProp: "__uivController", resolveLocal: "__uivResolveLocal", queue: "__uivBootQueue",
      initRoot: initRootNow,
      api: {
        setInvitePage: doSet,
        setInvitePageError: doError,
        resetInvitePage: doReset
      },
      forwardShape: { resetInvitePage: "id" }
    });
  }
  function resolve(id){
    id = String(id || "").trim();
    var r = mount ? mount.rootsWithId(id) : rootsById(id);
    if (!r.length) return null;
    return r[0].__uivController || initRootNow(r[0]);
  }
  function rootsById(id){
    var out = [], all = document.querySelectorAll(".uiv-root");
    for (var i = 0; i < all.length; i++){
      if ((all[i].getAttribute("data-instance") || "default") === id) out.push(all[i]);
    }
    return out;
  }
  function initRootNow(root){
    if (root.__uivController) return root.__uivController;
    if ((root.getAttribute("data-instance") || "default") === "INSTANCE_ID") return null;
    var c = makeController(root);
    root.__uivController = c;
    return c;
  }
  function doSet(id, raw){ var c = resolve(id); return c ? c.setData(raw) : false; }
  function doError(id, text){ var c = resolve(id); return c ? c.setError(text) : false; }
  function doReset(id){ var c = resolve(id); return c ? c.reset() : false; }

  uivBoot(30);
})();
