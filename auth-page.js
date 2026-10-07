/* upstreem auth-page.js — Login und Signup als GANZE Seite (Praefix `uau`). Braucht core.js.

   ── Eine Komponente, zwei Modi ───────────────────────────────────────────────
   login und signup unterscheiden sich in sieben Texten und einem Feld. Zwei Komponenten daraus
   zu machen hiesse, jede Aenderung an Feldern, Pruefungen und Fehlerzustaenden doppelt zu pflegen
   -- und die beiden liefen genau so lange auseinander, bis es jemandem auffaellt.

   ── Warum die Pruefung hier UND auf dem Server gehoert ───────────────────────
   Was hier geprueft wird, ist Bequemlichkeit: der Nutzer soll nicht auf eine Serverantwort warten,
   um zu erfahren, dass er das @ vergessen hat. Sicherheit ist es nicht -- diese Datei laeuft im
   Browser des Nutzers. Jede Regel hier muss serverseitig ein zweites Mal stehen.

   ── Der Ablauf ──────────────────────────────────────────────────────────────
   Klick auf den Hauptknopf -> pruefen -> bei Fehlern anzeigen und HIER aufhoeren -> sonst Event an
   Bubble und in den Ladezustand. Aus dem Ladezustand kommt die Seite nur durch eine Antwort:
   setAuthPageError (Fehler zeigen, Knopf wieder frei) oder setAuthPageDone (Erfolgsblock).
   Bleibt beides aus, greift nach 20s die Notbremse -- ohne sie waere ein fehlgeschlagener
   Workflow ein Knopf, der sich fuer immer dreht, ohne ein Wort dazu. */
(function(){
  "use strict";

  /* Bubble kann seine Setter aufrufen, bevor diese Datei vom CDN da ist. Ohne Stubs wirft der
     Aufruf "is not a function" und reisst den ganzen Run-JavaScript-Schritt mit. */
  var BOOTQ = window.__uauBootQueue = window.__uauBootQueue || [];
  if (!window.__uauBootStubbed){
    window.__uauBootStubbed = true;
    ["renderAuthPage", "setAuthPageMode", "setAuthPageLoading", "setAuthPageError",
     "setAuthPageDone", "setAuthPageInvite", "setAuthPageServerError", "resetAuthPage"].forEach(function(n){
      window[n] = function(){ BOOTQ.push([n, arguments]); };
    });
  }

  function uauBoot(triesLeft){
    if (!window.UpstreemCore){
      if (triesLeft > 0){ setTimeout(function(){ uauBoot(triesLeft - 1); }, 100); return; }
      if (window.console) console.error("UpstreemCore (core.js) not loaded");
      return;
    }
    uauRun();
  }

  /* Ohne Rueckmeldung faellt der Ladezustand nach dieser Zeit von selbst -- 20s sind grosszuegig
     fuer eine Anmeldung samt Serverrunde und kurz genug, dass es nicht wie ein Absturz wirkt. */
  var BUSY_MAX = 20000;

  var TEXTE = {
    login: {
      hallo: "Hi,", h1: "Welcome Back",
      sub: "Sign in to win AI Search.",
      check: "", side: "Forgot password?",
      pwHint: "Your password",
      cta: "Sign in", ctaBusy: "Signing in",
      footTxt: "Don’t have an account?", footLink: "Sign up",
      /* OHNE EINLADUNG GIBT ES KEINEN SIGNUP (25.09. entschieden: "du musst zu einem Team
         eingeladen werden, dann kannst du dich registrieren, sonst nicht, Punkt"). Der Link
         waere eine Tuer, hinter der eine Wand steht -- also statt seiner ein Satz, der sagt, wie
         man hineinkommt. */
      footOhne: "No account yet? Ask your team for an invite."
    },
    signup: {
      hallo: "Hey there,", h1: "Let’s get you set up",
      sub: "Sign up to win AI Search.",
      check: "Send me product updates", side: "",
      pwHint: "At least 8 characters",
      cta: "Create account", ctaBusy: "Creating account",
      footTxt: "Already have an account?", footLink: "Sign in"
    }
  };

  var STAERKE = ["", "Weak", "Fair", "Good", "Strong"];

  /* Die Vorschlaege im Werbeblock rechts. Fuenf, weil vier zu schnell wiederkehren und sechs bei
     4s Takt eine halbe Minute bis zur Wiederholung brauchen -- laenger, als jemand auf einer
     Anmeldeseite steht. */
  var VORSCHLAEGE = [
    "How visible is my brand in ChatGPT?",
    "What can I do right now to improve?",
    "Build an AI visibility report for my marketing team",
    "Which competitors outrank me in AI Search?",
    "Where does Perplexity get its sources from?"
  ];

  /* Die Google-Marke, vier Farben, wie vorgegeben. Nicht ueber UC.icon: das ist ein Feather-Satz
     aus einfarbigen Strichzeichnungen, und ein Markenzeichen gehoert nicht hineingemischt. */
  var G_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true">' +
    '<path fill="#4285F4" d="M23.5 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47a5.54 5.54 0 0 1-2.4 3.63v3.02h3.88c2.27-2.09 3.55-5.17 3.55-8.89z"/>' +
    '<path fill="#34A853" d="M12 24c3.24 0 5.96-1.08 7.95-2.91l-3.88-3.01c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.29v3.11A12 12 0 0 0 12 24z"/>' +
    '<path fill="#FBBC05" d="M5.27 14.27a7.2 7.2 0 0 1 0-4.54V6.62H1.29a12 12 0 0 0 0 10.76l3.98-3.11z"/>' +
    '<path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.29 6.62l3.98 3.11C6.22 6.86 8.87 4.75 12 4.75z"/></svg>';

  /* Woertlich aus dem Zeichensatz in core.js (Hugeicons stroke-rounded, seit dem 22.09.) --
     am 23.09. Pfad fuer Pfad gegengeprueft: SUN/MOON/LOCK/CHECK/MIC sind buchstabengleich
     mit sun/moon/lock/check/mic (UP nicht mehr, siehe dort). Nicht ueber UC.icon geholt, und das bleibt so: diese
     Seite laeuft VOR der Anmeldung, core ist dort nicht garantiert da, und ein leerer Knopf auf
     der Anmeldeseite waere schlechter als ein paar Pfade hier.
     WER HIER ETWAS AENDERT, aendert es auch in core -- sonst laufen Anmeldeseite und App
     auseinander, und das faellt niemandem auf, weil die beiden nie nebeneinander stehen. */
  var SUN_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round"><path d="M17 12C17 14.7614 14.7614 17 12 17C9.23858 17 7 14.7614 7 12C7 9.23858 9.23858 7 12 7C14.7614 7 17 9.23858 17 12Z"/><path d="M12 2V3.5M12 20.5V22M19.0708 19.0713L18.0101 18.0106M5.98926 5.98926L4.9286 4.9286M22 12H20.5M3.5 12H2M19.0713 4.92871L18.0106 5.98937M5.98975 18.0107L4.92909 19.0714"/></svg>';
  var MOON_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 14.0784C20.3003 14.7189 18.9301 15.0821 17.4751 15.0821C12.7491 15.0821 8.91792 11.2509 8.91792 6.52485C8.91792 5.06986 9.28105 3.69968 9.92163 2.5C5.66765 3.49698 2.5 7.31513 2.5 11.8731C2.5 17.1899 6.8101 21.5 12.1269 21.5C16.6849 21.5 20.503 18.3324 21.5 14.0784Z"/></svg>';
  var LOCK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round"><path d="M12 14V17.0023"/><path d="M16.5 9V6.5C16.5 4.01472 14.4853 2 12 2C9.51472 2 7.5 4.01472 7.5 6.5V9"/><path d="M4.26781 18.8447C4.49269 20.515 5.87613 21.8235 7.55966 21.9009C8.97627 21.966 10.4153 22 12 22C13.5847 22 15.0237 21.966 16.4403 21.9009C18.1239 21.8235 19.5073 20.515 19.7322 18.8447C19.879 17.7547 20 16.6376 20 15.5C20 14.3624 19.879 13.2453 19.7322 12.1553C19.5073 10.485 18.1239 9.17649 16.4403 9.09909C15.0237 9.03397 13.5847 9 12 9C10.4153 9 8.97627 9.03397 7.55966 9.09909C5.87613 9.17649 4.49269 10.485 4.26781 12.1553C4.12104 13.2453 4 14.3624 4 15.5C4 16.6376 4.12104 17.7547 4.26781 18.8447Z"/></svg>';
  var CHECK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" ' +
    'stroke-linecap="round" stroke-linejoin="round"><path d="M5 13.2592L7.58583 15.9568C8.2525 16.6523 8.58583 17 9.00004 17C9.41425 17 9.74759 16.6523 10.4143 15.9568L19 7"/></svg>';
  var MIC_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round"><path d="M7 6.5C7 4.01472 9.01472 2 11.5 2C13.9853 2 16 4.01472 16 6.5V11.5C16 13.9853 13.9853 16 11.5 16C9.01472 16 7 13.9853 7 11.5V6.5Z"/><path d="M11.5 19H11.0828C7.57267 19 4.57706 16.4623 4 13M11.5 19H11.9172C15.4273 19 18.4229 16.4623 19 13M11.5 19V22"/></svg>';
  /* DIE AUSNAHME: der Sendeknopf traegt einen ECHTEN PFEIL, Schaft plus Spitze, und NICHT core
     arrowUp (28.09. gemeldet: "das Icon im Mira-Send-Button ist noch falsch"). core arrowUp ist
     ein Chevron ohne Schaft; Miras eingebautes Element in der App traegt aber einen Pfeil, und
     diese Grafik soll zeigen, was der Nutzer dort sieht. Dieselbe Meldung kam am 24.09. fuer die
     Landingpage -- dort steht dieselbe Form (landing-hero.js, SENDE_PFEIL). Beide Stellen
     gleich halten. */
  var UP_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5"/><path d="M5 12L12 5L19 12"/></svg>';

  /* ── Pruefungen ────────────────────────────────────────────────────────────
     Die E-Mail-Regel ist bewusst grob (Begruendung an UC.mailOk). Sie steht seit dem 07.10. in
     core: hier, in team-orga.js und auf den neuen Seiten unten war es dieselbe Zeile. Core ist
     an dieser Stelle immer da -- uauBoot startet erst, wenn es geladen ist. */
  function mailOk(v){ return window.UpstreemCore.mailOk(v); }

  /* Vier Stufen. Laenge zaehlt doppelt, weil sie mehr bringt als jede Zeichenklasse: aus acht
     Zeichen mit Sonderzeichen wird schneller ein Treffer als aus sechzehn Kleinbuchstaben. */
  function staerke(pw){
    pw = String(pw || "");
    if (!pw) return 0;
    var p = 0;
    if (pw.length >= 8) p++;
    if (pw.length >= 12) p++;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) p++;
    if (/\d/.test(pw)) p++;
    if (/[^A-Za-z0-9]/.test(pw)) p++;
    if (pw.length < 8) return 1;                 /* zu kurz bleibt schwach, egal wie bunt */
    /* Ohne Abzug. Mit p-1 landete "Abcdefgh1" -- acht Zeichen, Gross, Klein, Ziffer -- auf
       "Fair", und das ist zu streng: ein Balken, der solide Passwoerter tadelt, erzieht nur
       dazu, ihn zu ignorieren. Jetzt: 8 Zeichen allein "Weak", plus Gross/Klein oder Ziffer
       "Fair", beides "Good", dazu Laenge oder Sonderzeichen "Strong". */
    return Math.max(1, Math.min(4, p));
  }

  /* ── URL ──────────────────────────────────────────────────────────────────
     Die Seite liest ihren Modus aus der Adresse und schreibt ihn zurueck, wenn keiner dasteht.
     Damit ist ein Link auf /?mode=signup teilbar und der Zurueck-Knopf tut, was er soll.
     Gelesen wird auch der PFAD: endet er auf /signup oder /login, gilt das, ohne dass ein
     Parameter noetig waere. So kann dieselbe Bubble-Seite unter beiden Adressen liegen. */
  function urlParam(name){
    try {
      var m = new RegExp("[?&]" + name + "=([^&#]*)").exec(window.location.search);
      return m ? decodeURIComponent(m[1].replace(/\+/g, " ")) : "";
    } catch(e){ return ""; }
  }
  function modeAusUrl(){
    var p = String(urlParam("mode") || "").toLowerCase();
    if (p === "signup" || p === "login") return p;
    try {
      var pfad = String(window.location.pathname || "").toLowerCase().replace(/\/+$/, "");
      if (/\/signup$/.test(pfad)) return "signup";
      if (/\/login$/.test(pfad) || /\/signin$/.test(pfad)) return "login";
    } catch(e){}
    return "";
  }
  /* replaceState und nicht pushState beim ERSTEN Setzen: der Nutzer hat den Modus nicht gewaehlt,
     also gehoert dafuer kein Eintrag in den Verlauf -- ein Zurueck-Klick landete sonst auf
     derselben Seite. Beim Wechsel per Klick ist es umgekehrt, siehe unten. */
  function urlSetzen(m, neuerEintrag){
    try {
      if (!window.history || !window.history.replaceState) return;
      var u = new URL(window.location.href);
      var pfad = String(u.pathname || "").toLowerCase().replace(/\/+$/, "");
      var pfadModus = /\/signup$/.test(pfad) ? "signup"
                    : (/\/(login|signin)$/.test(pfad) ? "login" : "");

      if (pfadModus === m){
        /* Der Pfad sagt schon das Richtige. Ein Parameter daneben waere eine zweite Angabe
           derselben Sache -- und ein ?mode=signup auf /signup sieht nach einem Fehler aus. Ein
           frueher gesetzter Parameter muss aber weg, sonst bleibt er als Widerspruch stehen. */
        if (u.searchParams.get("mode") == null) return;
        u.searchParams.delete("mode");
      } else {
        /* Der Modus weicht vom Pfad ab -- oder der Pfad sagt gar nichts. Dann MUSS er in die
           Adresse. Ohne das ueberlebt der Wechsel kein Neuladen: wer auf /signup in den Login
           geht und F5 drueckt, landete wieder im Signup, und die Adresse log ueber das, was zu
           sehen ist. /signup?mode=login liest sich sperrig, ist aber ehrlich.
           Wenn dir die saubere Adresse wichtiger ist: lege eine zweite Bubble-Seite /login an
           und lass den uauMode-Workflow dorthin navigieren. Dann greift dieser Zweig nie. */
        if (u.searchParams.get("mode") === m) return;
        u.searchParams.set("mode", m);
      }
      window.history[neuerEintrag ? "pushState" : "replaceState"]({}, "", u.toString());
    } catch(e){}
  }

  /* ── ABSAGE AUS DEM GOOGLE-WEG (28.09.) ─────────────────────────────────────
     Ein neues Konto entsteht nur noch mit Einladung. Ohne sie lehnt Supabase die Anmeldung per
     Google ab (Auth-Hook "Before User Created", bubble/datenbank_auftrag.md Abschnitt 2) und
     schickt den Browser mit error, error_code und error_description zurueck, in der Suchzeile
     UND im Anker. Liest die Seite das nicht, steht danach das leere Login da, als waere nichts
     passiert, und der naechste Klick endet genauso.
     Gezeigt wird nie der Servertext, sondern einer von zwei festen Saetzen. Welcher, entscheidet
     das Wort "invite": der Hook traegt es in seiner Absage, und "Signups not allowed" (falls die
     Registrierung einmal ganz aus ist) meint dasselbe. Jeder andere Fehler bekommt den
     allgemeinen Satz -- auch einer, den GoTrue anders formuliert als erwartet, damit NIE nichts
     dasteht.
     Einmal je Seitenaufruf gelesen und hier gemerkt, danach die Adresse bereinigt: Bubble baut
     das Element nach dem ersten Zeichnen oft neu auf, und die neue Wurzel faende in der
     bereinigten Adresse nichts mehr. Ein Neuladen zeigt die Meldung dagegen nicht erneut. */
  var _absage = null;
  /* Suchzeile UND Anker als EINE Tabelle (07.10. herausgezogen: die Seite "Neues Passwort" liest
     denselben Weg -- Supabase schickt einen abgelaufenen Ruecksetzlink mit error_code=otp_expired
     im Anker zurueck). Der erste Fund eines Schluessels gilt. null, wenn nichts zu lesen war. */
  function adressQ(){
    var q = {};
    try {
      [String(window.location.search || "").replace(/^\?/, ""),
       String(window.location.hash || "").replace(/^#/, "")].forEach(function(s){
        s.split("&").forEach(function(kv){
          var i = kv.indexOf("=");
          if (i < 1) return;
          var k = kv.slice(0, i), v = kv.slice(i + 1);
          try { v = decodeURIComponent(v.replace(/\+/g, " ")); } catch(e){}
          if (!(k in q)) q[k] = v;
        });
      });
    } catch(e){ return null; }
    return q;
  }
  /* Die Fehlerangaben aus der Adresse nehmen, damit ein Neuladen sie nicht noch einmal zeigt. */
  function adressFehlerWeg(){
    try {
      if (window.history && window.history.replaceState){
        var u = new URL(window.location.href);
        ["error", "error_code", "error_description", "sb"].forEach(function(k){ u.searchParams.delete(k); });
        if (/(^|&)error(_code|_description)?=/.test(String(u.hash || "").replace(/^#/, ""))) u.hash = "";
        window.history.replaceState(window.history.state, "", u.toString());
      }
    } catch(e){}
  }
  function oauthAbsage(){
    if (_absage != null) return _absage;
    _absage = "";
    var q = adressQ();
    if (!q) return _absage;
    if (!q.error && !q.error_code && !q.error_description) return _absage;
    var worte = (String(q.error_description || "") + " " + String(q.error_code || "")).toLowerCase();
    _absage = /invite|signup_disabled|signups? not allowed/.test(worte)
      ? "No invite found for this email address. Ask your team to invite you, then use the link in the invite email."
      : "Google sign-in did not work. Please try again. New accounts need an invite from your team.";
    adressFehlerWeg();
    return _absage;
  }

  /* ── Das Logo ohne Attribut (07.10.) ─────────────────────────────────────────────────────────
     Die Wortmarke liegt seit langem als Datei auf Supabase, je Thema eine (core.css nimmt
     dieselben zwei fuer das Wasserzeichen der Charts). Die Seiten ohne Anmeldeformular brauchen
     deshalb kein data-logo mehr -- und die Anmeldeseite faellt auf sie zurueck, wenn ihr Element
     keines traegt, statt die Ecke leer zu lassen. Ein gesetztes data-logo gewinnt weiter. */
  var LOGO_HELL = "https://tgdossbsevnonssyuewp.supabase.co/storage/v1/object/public/BRANDSTYLES/upstreem-lockup-1f1f1f.svg";
  var LOGO_DUNKEL = "https://tgdossbsevnonssyuewp.supabase.co/storage/v1/object/public/BRANDSTYLES/upstreem-lockup-e0e0e0.svg";
  /* Ein Attribut, das nur den Platzhalter der Vorlage traegt (LOGO_URL, IS_DARK), gilt als leer. */
  function attrVon(root, n, f){
    var v = root.getAttribute(n);
    return (v == null || v === "" || /^[A-Z_]{3,}$/.test(v)) ? (f || "") : v;
  }
  function logoFuer(root, dunkel){
    return (dunkel && attrVon(root, "data-logo-dark")) || attrVon(root, "data-logo") ||
           (dunkel ? LOGO_DUNKEL : LOGO_HELL);
  }
  /* ── Theme ────────────────────────────────────────────────────────────────────────────────────
     Die Seite bestimmt es selbst, in dieser Reihenfolge:
       1. was schon am Element steht (core hat es beim Laden gesetzt)
       2. data-isdark, falls es jemand setzt
       3. die gemerkte Wahl aus localStorage -- derselbe Schluessel wie im Rest der App
       4. die Einstellung des Betriebssystems
     Der Schluessel heisst pref_theme und gehoert core (setUpstreemTheme schreibt ihn). Einen
     eigenen zu fuehren hiesse, dass diese Seiten eine andere Wahl merken als die App dahinter --
     der Nutzer stellte dunkel ein und saehe beim naechsten Login wieder hell. Deshalb braucht
     keine der Seiten ein data-isdark: die Wahl kommt aus derselben Ablage wie in der App. */
  function dunkelFuer(root){
    if (root.getAttribute("data-theme") === "dark") return true;
    var roh = root.getAttribute("data-isdark");
    if (roh != null && roh !== "" && !/^[A-Z_]{3,}$/.test(roh)) return window.UpstreemCore.isYes(roh);
    try {
      var g = localStorage.getItem("pref_theme");
      if (g === "dark") return true;
      if (g === "light") return false;
    } catch(e){}
    try { return !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches); }
    catch(e){ return false; }
  }
  /* Ein Event, dessen Wert der Wert IST -- kein JSON drumherum (Begruendung an absenden in
     makeController: Passwoerter duerfen jedes Zeichen enthalten). Nicht still scheitern: wer den
     Namen nicht findet, bekommt eine deutliche Meldung in der Konsole. */
  function feuerRoh(root, attr, fallback, wert){
    var UC = window.UpstreemCore;
    var fnName = root.getAttribute(attr) || fallback;
    function finde(n){ var f = UC.resolveBubbleFn ? UC.resolveBubbleFn(n) : window[n]; return typeof f === "function" ? f : null; }
    /* Beide Schreibweisen: Bubble legt das JavaScriptToBubble-Element als bubble_fn_<name> an.
       Ohne Attribut am Element kommt hier der nackte Vorgabename an -- gemessen am 07.10. auf der
       Seite "Passwort vergessen": das Event erreichte nichts, weil nur "uauForgot" gesucht wurde. */
    var fn = finde(fnName) || (fnName.indexOf("bubble_fn_") === 0 ? null : finde("bubble_fn_" + fnName));
    if (typeof fn !== "function"){
      if (window.console) console.warn("[auth-page] " + fnName + " nicht gefunden — dieser Wert " +
        "hat keinen Bubble-Workflow erreicht. Fehlt das JavaScriptToBubble-Element?");
      return false;
    }
    try { fn(String(wert == null ? "" : wert)); return true; }
    catch(e){
      if (window.console) console.warn("[auth-page] " + fnName + " hat geworfen:", e);
      return false;
    }
  }

  /* ── WAS SUPABASE ZURUECKGIBT, IN SAETZEN FUER MENSCHEN (07.10.) ───────────────────────────────
     setAuthPageServerError nimmt den ROHEN Fehler aus Bubble -- den Text, den das Supabase-Plugin
     liefert, oder dessen JSON ({"code":"weak_password","message":"..."}) -- und macht daraus Feld
     und Satz. Gezeigt wird NIE der Servertext selbst: "Auth session missing!" oder "AuthApiError"
     sagt dem Nutzer nichts, was er tun kann.
     Erkannt wird am Code (neuere GoTrue-Fassungen schicken ihn mit) und am Wortlaut (aeltere nicht).
     Was nichts davon trifft, bekommt den allgemeinen Satz -- auch ein Fehler, den es heute noch
     nicht gibt, steht also nie leer da.
     Ruecksetzlinks: ein abgelaufener oder schon benutzter Link kommt je nach Fluss als otp_expired,
     als "Token has expired or is invalid" oder -- wenn die Seite ohne gueltige Sitzung aufgerufen
     wird -- als "Auth session missing!". Alle drei heissen fuer den Nutzer dasselbe: neuen Link
     holen. aktion "neuerLink" haengt dafuer den Weg zur Seite "Passwort vergessen" an. */
  function serverFehler(roh, art){
    var UC = window.UpstreemCore;
    var r = String(roh == null ? "" : roh).trim(), code = "";
    if (r.charAt(0) === "{"){
      var o = UC.bubbleObjekt ? UC.bubbleObjekt(r) : null;
      if (o){ code = String(o.code || o.error_code || o.error || ""); }
    }
    var text = UC.bubbleFehler ? UC.bubbleFehler(r) : r;
    var w = (code + " " + text).toLowerCase();
    var reset = art === "reset-password";
    var sek = /after (\d+) seconds?/.exec(w);
    if (/same_password|different from the old/.test(w))
      return { feld: "password", text: "Choose a password you have not used before." };
    if (/pwned|known to be weak|easy to guess|data breach/.test(w))
      return { feld: "password", text: "This password appeared in a data breach. Please choose a different one." };
    if (/weak_password|at least \d+ characters|should contain at least|password is too short/.test(w))
      return { feld: "password", text: "That password is too weak. Use at least 8 characters with letters and numbers." };
    if (/otp_expired|flow_state_expired|bad_code_verifier|link is invalid|has expired|expired or is invalid|invalid or has expired/.test(w))
      return { feld: "", text: reset ? "This reset link has expired or was already used." : "This link has expired or was already used.",
               aktion: reset ? "neuerLink" : "" };
    if (/session_not_found|auth session missing|session missing|not authenticated|invalid jwt|jwt expired/.test(w))
      return reset ? { feld: "", text: "This reset link has expired or was already used.", aktion: "neuerLink" }
                   : { feld: "", text: "Your session has expired. Please sign in again." };
    if (/reauthentication_needed|reauthenticat/.test(w))
      return { feld: "", text: "Please sign in again to change your password." };
    /* Die Sekunden VOR der allgemeinen Mail-Sperre: GoTrue schickt die Minutensperre je Adresse
       ("you can only request this after 47 seconds") mit demselben Code over_email_send_rate_limit
       wie die Sperre des ganzen Projekts. Die genauere Angabe gewinnt. */
    if (sek)
      return { feld: "", text: "Please wait " + sek[1] + " seconds before trying again." };
    if (/over_email_send_rate_limit|email rate limit/.test(w))
      return { feld: "", text: "Too many emails were sent. Please wait a few minutes and try again." };
    if (/over_request_rate_limit|rate limit|too many requests|429/.test(w))
      return { feld: "", text: "Too many attempts. Please wait a moment and try again." };
    if (/email_address_invalid|invalid format|unable to validate email/.test(w))
      return { feld: "email", text: "That does not look like an email address." };
    if (/invalid_credentials|invalid login credentials/.test(w))
      return { feld: "", text: "Email or password is not correct." };
    if (/email_not_confirmed|not confirmed/.test(w))
      return { feld: "", text: "Please confirm your email first. Check your inbox for the link." };
    if (/user_already_exists|email_exists|already registered|already been registered/.test(w))
      return { feld: "email", text: "An account with this email already exists. Sign in instead." };
    if (/signup_disabled|signups? not allowed|invite/.test(w))
      return { feld: "", text: "New accounts need an invite from your team." };
    if (/user_not_found/.test(w))
      return { feld: "email", text: "We could not find an account with this email." };
    if (/failed to fetch|networkerror|network request|timed? ?out|timeout/.test(w))
      return { feld: "", text: "We could not reach the server. Check your connection and try again." };
    return { feld: "", text: "Something went wrong. Please try again." };
  }


  function makeController(root){
    var UC = window.UpstreemCore;
    var esc = UC.esc;
    var fire = UC.makeFire(root, { label: "auth-page", eventPrefix: "uau" });

    /* Ein Event, dessen Wert der Wert IST -- kein JSON drumherum, keine Extraktion noetig.
       makeFire kann das nicht: es verpackt immer als JSON und haengt team_id davor. Fuer
       Passwort und Name ist genau diese Verpackung das Problem, also hier der direkte Weg.
       Nicht still scheitern: wer den Namen nicht findet, bekommt dieselbe deutliche Meldung
       wie bei makeFire -- ein Passwort, das nirgends ankommt, sieht sonst aus wie ein
       fehlgeschlagener Login. */
    function fireRoh(attr, fallback, wert){ return feuerRoh(root, attr, fallback, wert); }

    var state = { mode: "login", busy: false, done: false, errs: {}, formErr: "",
                  token: "", mailFest: false };
    var busyTimer = null;

    function attr(n, f){ return attrVon(root, n, f); }
    /* Das Theme bestimmt dunkelFuer (oben, mit Begruendung) -- seit dem 07.10. fuer alle Seiten
       dieser Datei an einer Stelle. */
    function istDunkel(){ return dunkelFuer(root); }
    /* data-theme ist der Schalter, an dem die --vc-*-Tokens in core haengen.
       NUR anfassen, wenn data-isdark ueberhaupt gesetzt ist. Ohne diese Bedingung raeumte die
       Funktion ein von aussen gesetztes data-theme weg und die Seite waere schlagartig hell --
       genau der Fall, der hier vorlag. */
    function syncTheme(){
      var d = istDunkel();
      if (d) root.setAttribute("data-theme", "dark"); else root.removeAttribute("data-theme");
      var b = root.querySelector("[data-theme-btn]");
      if (b){
        /* Das Icon zeigt, WOHIN der Klick fuehrt, nicht wo man ist: im Hellen ein Mond
           ("dunkel machen"). Andersherum haetten Nutzer den Zustand gelesen und geklickt, um ihn
           zu behalten. */
        b.innerHTML = d ? SUN_SVG : MOON_SVG;
        b.setAttribute("aria-label", d ? "Switch to light mode" : "Switch to dark mode");
      }
      var l = root.querySelector(".uau-logo");
      if (l && l.tagName === "IMG"){
        var neu = logoFuer(root, d);
        if (neu && l.getAttribute("src") !== neu) l.setAttribute("src", neu);
      }
    }

    root.innerHTML = shell();

    var elCard    = root.querySelector(".uau-card");
    var elH1      = root.querySelector("[data-h1]");
    var elSub     = root.querySelector("[data-sub]");
    var elName    = root.querySelector("[data-f-name]");
    var elMail    = root.querySelector("[data-f-mail]");
    var elPw      = root.querySelector("[data-f-pw]");
    var elNameWrap= root.querySelector("[data-w-name]");
    var elCode    = root.querySelector("[data-f-code]");
    var elCodeWrap= root.querySelector("[data-w-code]");
    var elSepWrap = root.querySelector("[data-w-sep]");
    var elCheck   = root.querySelector("[data-check]");
    var elCheckTxt= root.querySelector("[data-check-txt]");
    var elSide    = root.querySelector("[data-side]");
    var elPrimary = root.querySelector("[data-primary]");
    var elPrimTxt = root.querySelector("[data-primary-txt]");
    var elGoogle  = root.querySelector("[data-google]");
    var elFootTxt = root.querySelector("[data-foot-txt]");
    var elFootBtn = root.querySelector("[data-foot-btn]");
    var elFormErr = root.querySelector("[data-formerr]");
    var elFormErrT= root.querySelector("[data-formerr-txt]");
    var elStrength= root.querySelector("[data-strength]");
    var elStrTxt  = root.querySelector("[data-strength-txt]");
    var elMailWrap= root.querySelector("[data-w-mail]");
    var elMailFix = root.querySelector("[data-mailfix]");
    var elPaneForm= root.querySelector("[data-pane-form]");
    var elPaneDone= root.querySelector("[data-pane-done]");
    var elDoneH   = root.querySelector("[data-done-h]");
    var elDoneB   = root.querySelector("[data-done-b]");

    function feld(el){ return el.closest(".uau-field"); }

    function shell(){
      /* Im Dunkeln ein eigenes Logo, wenn eines hinterlegt ist. Ohne Rueckfall auf die helle
         Fassung waere die Ecke leer -- ein fehlendes Dark-Logo darf nicht heissen, dass gar
         keines dasteht. */
      var logo = logoFuer(root, istDunkel());
      var bg   = attr("data-bg");
      return '' +
      '<div class="uau-card"' + (bg ? ' data-hasbg="1"' : '') + '>' +
        '<div class="uau-form">' +
          '<div class="uau-top">' +
            (logo ? '<img class="uau-logo" src="' + esc(logo) + '" alt="upstreem"/>' : '<span class="uau-logo"></span>') +
            '<button class="uau-themebtn" type="button" data-theme-btn aria-label="Switch theme"></button>' +
          '</div>' +
          '<div class="uau-mid">' +
            '<div class="uau-block uau-stack">' +
              /* Formular und Erfolg liegen uebereinander im selben Raster -- so behaelt die Karte
                 beim Wechsel ihre Hoehe und nichts springt. */
              '<div class="uau-pane" data-pane-form>' +
                '<h1 class="uau-h1"><span data-hallo></span><br><span data-h1></span></h1>' +
                '<div class="uau-sub" data-sub></div>' +
                '<div class="uau-formerr" data-formerr><div><div class="uau-formerr-in" data-formerr-txt></div></div></div>' +
                /* Ein echtes <form> um Felder und Hauptknopf. Chrome warnt sonst "Password field
                   is not contained in a form", und das ist keine Formalie: Passwortverwalter
                   erkennen Anmeldemasken ueber genau diese Struktur. Ohne sie bieten sie das
                   Speichern nach dem Signup nicht an und fuellen beim Login nicht aus.
                   action und method bleiben leer, novalidate schaltet die Browser-Blasen ab --
                   die Pruefung steht hier, mit eigenen Meldungen an den Feldern. */
                '<form class="uau-form-el" novalidate data-form>' +
                '<div class="uau-fields">' +
                  '<label class="uau-field uau-collapse" data-w-name>' +
                    '<span class="uau-collapse-in">' +
                      '<span class="uau-label">Full name</span>' +
                      '<input class="up-field uau-input" type="text" name="name" autocomplete="name" ' +
                        'placeholder="Alex Meier" data-f-name/>' +
                      '<span class="uau-err"><span data-e-name></span></span>' +
                    '</span>' +
                  '</label>' +
                  '<label class="uau-field" data-w-mail>' +
                    '<span class="uau-label">Work email</span>' +
                    '<span class="uau-inwrap">' +
                      '<input class="up-field uau-input" type="email" name="email" autocomplete="email" ' +
                        'placeholder="alex@company.com" data-f-mail/>' +
                      '<span class="uau-lock" data-lock aria-hidden="true">' + LOCK_SVG + '</span>' +
                    '</span>' +
                    '<span class="uau-err"><span data-e-mail></span></span>' +
                    '<span class="uau-fixed" data-mailfix><span>' +
                      'This invitation is tied to this address.</span></span>' +
                  '</label>' +
                  '<label class="uau-field">' +
                    '<span class="uau-label">Password</span>' +
                    '<input class="up-field uau-input" type="password" name="password" ' +
                      'autocomplete="current-password" placeholder="At least 8 characters" data-f-pw/>' +
                    '<span class="uau-err"><span data-e-pw></span></span>' +
                    '<span class="uau-strength" data-strength><div><span class="uau-strength-in">' +
                      '<span class="uau-bars">' +
                        '<span class="uau-bar"></span><span class="uau-bar"></span>' +
                        '<span class="uau-bar"></span><span class="uau-bar"></span>' +
                      '</span>' +
                      '<span class="uau-strength-txt" data-strength-txt></span>' +
                    '</span></div></span>' +
                  '</label>' +
                  /* DER REGISTRIERUNGSCODE (21.09. angefordert: "der klassische Signup soll nur
                     noch moeglich sein, wenn man eine Art Key hat"). Er steht ZULETZT und nicht
                     zwischen Adresse und Passwort: die beiden gehoeren zusammen, ein
                     Passwortverwalter liest sie als Paar, und ein Feld dazwischen hat dort
                     schon Vorschlaege verdorben.
                     Dieselbe Einklapp-Mechanik wie das Namensfeld (.uau-collapse) -- es gilt
                     nur im Signup UND nur ohne Einladung: wer ueber einen Einladungslink kommt,
                     hat seine Berechtigung schon dabei, und ihn zusaetzlich nach einem Code zu
                     fragen waere eine Huerde ohne Zweck.
                     autocomplete="off" und spellcheck="false": ein Code ist kein Wort, und der
                     Verwalter soll hier nichts anbieten. */
                  /* Die Trennlinie davor (21.09. angefordert: "nach Passwort: gap, Separator,
                     gleiches gap, Registration code"). Sie ist ein eigenes Kind des Stapels und
                     kein Rand am Feld: so gibt der gap des Stapels die 12px oben UND unten von
                     selbst her, an einer Stelle gepflegt. Und sie klappt mit demselben Griff ein
                     und aus wie das Feld -- eine Linie ohne etwas darunter waere im Login eine
                     Trennung zwischen nichts und nichts. */
                  '<span class="uau-sep" data-w-sep aria-hidden="true"><span><i></i></span></span>' +
                  '<label class="uau-field uau-collapse" data-w-code>' +
                    '<span class="uau-collapse-in">' +
                      '<span class="uau-label">Registration code</span>' +
                      '<input class="up-field uau-input uau-code" type="text" name="registration-code" ' +
                        'autocomplete="off" autocapitalize="characters" autocorrect="off" spellcheck="false" ' +
                        'placeholder="Enter your code" data-f-code/>' +
                      '<span class="uau-err"><span data-e-code></span></span>' +
                    '</span>' +
                  '</label>' +
                '</div>' +
                '<div class="uau-opts">' +
                  /* Ungehakt. Eine vorangekreuzte Box ist als Einwilligung fuer Produkt-Mails nach DSGVO
                     nicht gueltig -- die muss aktiv erfolgen. Der Design-Handoff sah "checked by
                     default" vor, das gilt fuer ein "Remember me", nicht fuer eine Einwilligung. */
                  '<label class="uau-check"><input type="checkbox" data-check/>' +
                    '<span data-check-txt></span></label>' +
                  '<button class="uau-side" type="button" data-side></button>' +
                '</div>' +
                '<button class="uau-primary" type="submit" data-primary>' +
                  '<span class="uau-spin"></span><span data-primary-txt></span></button>' +
                '<div class="uau-or"><span>or</span></div>' +
                '<button class="uau-google" type="button" data-google>' + G_SVG +
                  '<span>Continue with Google</span></button>' +
                '</form>' +
              '</div>' +
              '<div class="uau-pane is-off" data-pane-done aria-hidden="true">' +
                '<span class="uau-done-ic">' + CHECK_SVG + '</span>' +
                '<h1 class="uau-h1" data-done-h></h1>' +
                '<div class="uau-sub" data-done-b></div>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="uau-foot"><span data-foot-txt></span>' +
            '<button type="button" data-foot-btn></button></div>' +
        '</div>' +
        /* Das Bild kommt als CSS-Variable, nicht als fertiger background-image-Wert: der Verlauf
           darueber unterscheidet sich zwischen hell und dunkel, und ein Inline-Stil haette jede
           Dark-Mode-Regel geschlagen. So bleibt die Bildquelle hier und die Tonung in der CSS. */
        '<div class="uau-panel"' + (bg ? ' style="--uau-bgimg: url(&quot;' + esc(bg) + '&quot;)"' : '') + '>' +
          '<h2 class="uau-panel-h">AI Search Analytics.<br>Made simple.</h2>' +
          '<p class="uau-panel-b">See in seconds how often AI Search recommends your brand.</p>' +
          '<div class="uau-prompt">' +
            '<span class="uau-prompt-t"><span data-ph></span></span>' +
            '<span class="uau-prompt-c">' +
              '<span class="uau-mic">' + MIC_SVG + '</span>' +
              '<span class="uau-send">' + UP_SVG + '</span>' +
            '</span>' +
          '</div>' +
          '<div class="uau-panel-f">upstreem – your AI visibility analyst</div>' +
        '</div>' +
      '</div>';
    }

    /* ---------------- Zeichnen ---------------- */
    function renderTexte(){
      var t = TEXTE[state.mode] || TEXTE.login;
      root.querySelector("[data-hallo]").textContent = t.hallo;
      elH1.textContent = t.h1;
      elSub.textContent = t.sub;
      /* Ein leerer side-Text heisst: es gibt hier nichts anzubieten. Der Knopf verschwindet dann
         ganz, statt als unsichtbare Klickflaeche stehen zu bleiben. */
      elSide.textContent = t.side;
      elSide.hidden = !t.side;
      /* Kein Haken im Login: das Supabase-Plugin bietet keine Session-Dauer an, und ein Schalter,
         der nichts tut, ist schlimmer als keiner. Im Signup bleibt er -- dort steuert er die
         Einwilligung fuer Produkt-Mails. */
      elCheck.closest(".uau-check").hidden = !t.check;
      elCheckTxt.textContent = t.check;
      root.querySelector(".uau-opts").classList.toggle("is-solo", !t.check);
      elPrimTxt.textContent = state.busy ? t.ctaBusy : t.cta;
      /* Ohne Einladung gibt es nichts, wohin der Link fuehren koennte: nur der Satz, kein
         Knopf. Mit Einladung bleibt der Wechsel -- wer schon ein Konto hat, tritt dem Team damit
         bei, statt ein zweites anzulegen. */
      var ohneWeg = state.mode === "login" && !state.token;
      elFootTxt.textContent = ohneWeg ? TEXTE.login.footOhne : t.footTxt;
      elFootBtn.textContent = t.footLink;
      elFootBtn.hidden = ohneWeg;
      /* GOOGLE NUR ZUM ANMELDEN (25.09. entschieden). Wer eingeladen ist, legt sein Konto mit
         Adresse und Passwort an; danach meldet er sich mit Google an derselben Adresse an
         (Supabase verknuepft die Identitaeten, wenn die Adresse bestaetigt ist).
         Der Riegel dahinter ist seit dem 28.09. der Auth-Hook "Before User Created": die
         Registrierung bleibt in Supabase AN, damit der Signup-Weg unveraendert bleibt, und der
         Hook lehnt jedes neue Konto ohne offene Einladung ab -- auch eines, das ein Klick auf
         diesen Knopf mit einem fremden Google-Konto anlegen wuerde. Seine Absage zeigt
         oauthAbsage(). */
      var mitGoogle = state.mode === "login";
      elGoogle.hidden = !mitGoogle;
      var oder = root.querySelector(".uau-or");
      if (oder) oder.hidden = !mitGoogle;
      /* current-password beim Anmelden, new-password beim Anlegen. Ohne den Unterschied schlaegt
         der Passwortverwalter im Signup ein BESTEHENDES Passwort vor statt ein neues zu
         erzeugen -- und der Nutzer legt ein Konto mit einem Passwort an, das er anderswo schon
         benutzt. */
      elPw.setAttribute("autocomplete", state.mode === "signup" ? "new-password" : "current-password");
      /* "At least 8 characters" ist eine Anforderung an ein NEUES Passwort. Im Login steht sie
         wie eine Bedingung fuers Anmelden da -- wer ein aelteres, kuerzeres Passwort hat, liest
         dort, dass er sich nicht anmelden kann. */
      elPw.setAttribute("placeholder", t.pwHint);
      elNameWrap.classList.toggle("is-on", state.mode === "signup");
      /* Ein ausgeblendetes Feld darf nicht per Tabulator erreichbar bleiben. */
      elName.disabled = state.mode !== "signup";
    }

    function zeigeFehler(){
      [["name", elName], ["mail", elMail], ["pw", elPw], ["code", elCode]].forEach(function(p){
        var msg = state.errs[p[0]] || "";
        var f = feld(p[1]);
        if (f) f.classList.toggle("is-err", !!msg);
        var slot = root.querySelector("[data-e-" + p[0] + "]");
        if (slot) slot.textContent = msg;
      });
      elFormErrT.textContent = state.formErr || "";
      elFormErr.classList.toggle("is-on", !!state.formErr);
    }

    function renderStaerke(){
      /* Nur im Signup und nur, wenn schon etwas getippt wurde. Im Login sagt die Staerke des
         bestehenden Passworts nichts, was der Nutzer jetzt noch aendern koennte. */
      var an = state.mode === "signup" && !!elPw.value;
      elStrength.classList.toggle("is-on", an);
      if (!an){ elStrength.removeAttribute("data-level"); return; }
      var lv = staerke(elPw.value);
      elStrength.setAttribute("data-level", String(lv));
      var bars = elStrength.querySelectorAll(".uau-bar");
      for (var i = 0; i < bars.length; i++) bars[i].classList.toggle("is-on", i < lv);
      elStrTxt.textContent = STAERKE[lv] || "";
    }

    function setBusy(on){
      state.busy = !!on;
      elPrimary.classList.toggle("is-busy", state.busy);
      elPrimary.disabled = state.busy;
      elGoogle.disabled = state.busy;
      elName.disabled = state.busy || state.mode !== "signup";
      elMail.disabled = elPw.disabled = state.busy;
      renderCode();
      elFootBtn.disabled = elSide.disabled = state.busy;
      renderTexte();

      if (busyTimer){ clearTimeout(busyTimer); busyTimer = null; }
      if (state.busy){
        busyTimer = setTimeout(function(){
          busyTimer = null;
          state.formErr = "That took longer than expected. Please try again.";
          setBusy(false);
          zeigeFehler();
        }, BUSY_MAX);
      }
    }

    /* Eine Einladung gilt genau einer Adresse. Das Feld bleibt sichtbar und lesbar -- der
       Nutzer soll ja pruefen koennen, WELCHE Adresse gemeint ist -- aber es ist festgesetzt.
       readonly und nicht disabled: ein disabled-Feld wird beim Absenden nicht mitgeschickt, ist
       nicht fokussierbar und wird von Bildschirmlesern uebersprungen. readonly laesst all das
       zu und verhindert nur das Aendern. */
    function renderMailFest(){
      elMail.readOnly = state.mailFest;
      elMailWrap.classList.toggle("is-fixed", state.mailFest);
      elMailFix.classList.toggle("is-on", state.mailFest);
    }

    /* ---------------- Registrierungscode ----------------
       WAS HIER PASSIERT, IST BEQUEMLICHKEIT -- NICHT SICHERHEIT. Und zwar aus einem schaerferen
       Grund als dem ueblichen "laeuft im Browser": der Publishable Key steht in jedem Client,
       und damit kann jeder ohne diese Seite direkt POST /auth/v1/signup an Supabase schicken.
       Eine Sperre in dieser Datei -- oder in einem Bubble-Workflow -- ist deshalb ein Schild,
       kein Riegel. Der Riegel sitzt in Supabase: seit dem 28.09. der Auth-Hook "Before User
       Created" (bubble/datenbank_auftrag.md, Abschnitt 2).
       Hier steht nur, dass der Nutzer nicht erst auf eine Serverrunde warten muss, um zu
       erfahren, dass er nichts eingetippt hat.
       VORGABE IST "yes" (21.09. korrigiert). Erst stand hier "no" -- mit der Begruendung, ein
       bestehendes Element solle nicht ploetzlich einen Code verlangen. Das war die falsche
       Richtung: gemeldet wurde "im Signup ist kein Codefeld", und zwar genau deshalb -- das
       Element trug das Attribut nicht, und ein Sicherheitsriegel, den man erst einschalten muss,
       ist im Zweifel aus. Ein Schalter dieser Art gehoert fail-closed.
       Wer ihn braucht, schreibt data-code-required="no" ausdruecklich hin.
       Ohne Wirkung bleibt er im Login und bei einer Einladung: ein Token ist selbst die
       Berechtigung. */
    /* VORGABE WIEDER "no" (25.09.): der Registrierungscode ist gestrichen -- ein Konto entsteht
       NUR noch ueber eine Einladung. Ohne Token gibt es gar keinen Signup mehr (setMode), und mit
       Token wurde der Code ohnehin nie verlangt; die Frage stellt sich also nicht mehr. Der
       Schalter bleibt stehen, damit ein Element, das ihn ausdruecklich traegt, nicht bricht. */
    function codeVerlangt(){ return UC.isYes(attr("data-code-required", "no")); }
    function codeAn(){ return state.mode === "signup" && codeVerlangt() && !state.token; }
    /* GROSS UND OHNE LEERZEICHEN -- das ist der VERTRAG mit Bubble (dort :uppercase vergleichen).
       Ein aus einer Mail kopierter Code bringt regelmaessig ein fuehrendes Leerzeichen oder einen
       Umbruch mit, und "Code ungueltig" fuer einen richtigen Code ist die schlechteste Sorte
       Fehlermeldung. \s deckt auch geschuetzte Leerzeichen und Tabulatoren ab. */
    function codeWert(){ return String(elCode.value || "").replace(/\s+/g, "").toUpperCase(); }
    function renderCode(){
      var an = codeAn();
      elCodeWrap.classList.toggle("is-on", an);
      elSepWrap.classList.toggle("is-on", an);
      /* Ein ausgeblendetes Feld darf nicht per Tabulator erreichbar bleiben -- dieselbe Regel
         wie beim Namensfeld. */
      elCode.disabled = !an || state.busy;
      /* Der WERT bleibt stehen, auch wenn das Feld zu ist. Erst hatte das Zumachen ihn geleert --
         und damit den Fall zerschossen, fuer den die Vorbelegung ueberhaupt da ist: /login?code=..
         startet im Login-Modus, das Feld ist zu, der Code waere weg gewesen, bevor der Nutzer
         unten auf "Sign up" klickt.
         Dass im Login trotzdem kein Code mitfaehrt, entscheidet die NUTZLAST (codeAn() in
         sendeJetzt), nicht das Eingabefeld -- eine Wahrheit, an einer Stelle. */
    }

    function setToken(tok, mail){
      state.token = String(tok == null ? "" : tok).trim();
      var m = String(mail == null ? "" : mail).trim();
      if (m){ elMail.value = m; state.mailFest = true; }
      /* Ohne Adresse keine Festsetzung: ein Token allein sagt nicht, WELCHE Adresse gemeint ist,
         und ein leeres Feld zu sperren waere eine Sackgasse. */
      else state.mailFest = false;
      renderMailFest();
      /* Eine Einladung nimmt die Codefrage weg -- sie ist selbst die Berechtigung. */
      renderCode();
      /* Kommt das Token nach dem Modus, gilt jetzt, was verlangt war -- und faellt es weg, darf
         kein Signup ohne Einladung stehen bleiben. */
      var soll = (gewuenscht === "signup" && state.token) ? "signup" : "login";
      if (soll !== state.mode){ state.mode = soll; state.errs = {}; state.formErr = ""; render(); }
    }

    function render(){ renderTexte(); zeigeFehler(); renderStaerke(); renderMailFest(); renderCode(); }

    /* ---------------- Pruefen ---------------- */
    function pruefe(){
      var e = {};
      if (state.mode === "signup" && !String(elName.value || "").trim()){
        e.name = "Please enter your name.";
      }
      var mail = String(elMail.value || "").trim();
      if (!mail) e.mail = "Please enter your email address.";
      else if (!mailOk(mail)) e.mail = "That does not look like an email address.";

      var pw = String(elPw.value || "");
      if (!pw) e.pw = "Please enter a password.";
      /* Die Laengenregel gilt nur beim Anlegen. Im Login waere sie falsch: ein bestehendes Konto
         kann ein kuerzeres Passwort haben, und dann verweigert die Seite die Anmeldung fuer etwas,
         das der Nutzer gar nicht mehr aendern kann. */
      else if (state.mode === "signup" && pw.length < 8) e.pw = "At least 8 characters.";

      if (codeAn() && !codeWert()) e.code = "Please enter your registration code.";

      state.errs = e;
      state.formErr = "";
      /* Der Nutzer versucht es neu: eine Google-Absage von vorhin gehoert dann nicht mehr auf
         eine neu aufgebaute Wurzel. */
      _absage = "";
      zeigeFehler();
      var erste = e.name ? elName : (e.mail ? elMail : (e.pw ? elPw : (e.code ? elCode : null)));
      if (erste){ try { erste.focus(); } catch(x){} return false; }
      return true;
    }

    function absenden(){
      if (state.busy || state.done) return;
      if (!pruefe()) return;
      /* ── Warum Passwort und Name NICHT im JSON stehen ─────────────────────────
         Beide duerfen jedes Zeichen enthalten, auch Anfuehrungszeichen. In einem JSON-Text
         werden die zu \" -- und eine Bubble-Extraktion mit "password":"([^\"]*)" schneidet
         dann mittendrin ab. Der Nutzer bekaeme "falsches Passwort" fuer ein richtiges, und zwar
         nur manchmal, was die schlimmste Sorte Fehler ist.
         Ein Text-Parameter mit serverseitigem Parsen loeste das auch, steht hier aber nicht zur
         Verfuegung. Also gehen die beiden als ROHER Wert durch je ein eigenes Event: dort IST
         der Wert die ganze Nachricht, es gibt nichts zu suchen und nichts abzuschneiden.

         Reihenfolge ist Absicht: erst die Rohwerte, dann der Submit. Bubble arbeitet diese
         Aufrufe nacheinander ab, die beiden States stehen also, bevor der Submit-Workflow
         laeuft. Andersherum laese er sie leer. */
      fireRoh("data-name-fn", "uauName",
              state.mode === "signup" ? String(elName.value || "").trim() : "");
      fireRoh("data-password-fn", "uauPassword", String(elPw.value || ""));

      /* Der Ladezustand kommt SOFORT, unabhaengig von einer etwaigen Verzoegerung darunter:
         zwischen Klick und Reaktion darf nichts liegen, sonst klickt der Nutzer ein zweites Mal. */
      setBusy(true);

      /* Verzoegerung vor dem Submit, per data-submit-delay einstellbar, Standard 0.
         Die drei Aufrufe laufen synchron im selben Schritt durch, und Bubble startet den
         Workflow danach -- die States sollten also stehen. Sollte. Nachgewiesen ist das nicht,
         und ein sporadisch leeres Passwort sieht aus wie falsche Zugangsdaten, nicht wie ein
         Zeitproblem. Wer das beobachtet, setzt hier 300 und hat Ruhe; der Nutzer merkt es nicht,
         weil der Ladezustand schon laeuft. */
      var verzug = UC.toNum ? (UC.toNum(attr("data-submit-delay")) || 0) : 0;
      if (verzug > 0){ setTimeout(sendeJetzt, verzug); } else { sendeJetzt(); }
    }

    function sendeJetzt(){
      fire("data-submit-fn", "uauSubmit", {
        mode: state.mode,
        /* Immer dabei, auch leer. Ein Feld, das mal da ist und mal nicht, zwingt jeden
           Bubble-Workflow zu einer Fallunterscheidung beim Auslesen -- leer heisst schlicht
           "normale Anmeldung ohne Einladung". */
        token: state.token,
        /* Auch hier IMMER dabei, auch leer -- aus demselben Grund wie token. Leer heisst
           entweder "Einladung" oder "diese Installation verlangt keinen Code" oder "Login";
           welches davon, sagt der Workflow anhand von mode und token, nicht die Seite.
           codeAn() und nicht der nackte Feldwert: im Login und bei einer Einladung steht im Feld
           vielleicht noch etwas aus einem frueheren Versuch, und das hat in dieser Nutzlast
           nichts zu suchen. */
        code: codeAn() ? codeWert() : "",
        /* email steht hier weiter drin: eine Adresse kann kein Anfuehrungszeichen enthalten,
           die Extraktion ist also sicher. Sie faehrt zusaetzlich in uauPassword-Naehe nirgends
           mit -- ein Feld, zwei Quellen waere eine zu viel. */
        email: String(elMail.value || "").trim(),
        opt_in: elCheck.checked ? "yes" : "no"
      });
    }

    /* Der Modus, der VERLANGT war -- aus Adresse, Attribut oder Klick. Er bleibt gemerkt, weil
       die Einladung spaeter kommen kann als der Modus (setInvite aus Bubble): /signup?token=...
       liest beides beim Start, ein Bubble-Workflow reicht das Token aber womoeglich erst nach. */
    var gewuenscht = "login";
    function setMode(m){
      m = (String(m || "").toLowerCase() === "signup") ? "signup" : "login";
      gewuenscht = m;
      /* SIGNUP NUR MIT EINLADUNG (25.09.). Ohne Token faellt jede Bitte um den Signup auf den
         Login zurueck -- auch ein geteilter Link auf /signup. Das ist BEQUEMLICHKEIT, keine
         Sicherheit: der Riegel sitzt in Supabase (Auth-Hook, bubble/datenbank_auftrag.md
         Abschnitt 2). Hier steht
         nur, dass niemand ein Formular ausfuellt, das ohnehin abgewiesen wuerde. */
      if (m === "signup" && !state.token) m = "login";
      if (m === state.mode) return;
      state.mode = m;
      /* Fehler des anderen Modus mitnehmen waere falsch -- "At least 8 characters" gilt im Login
         nicht, und ein roter Rahmen ohne Anlass ist eine Fehlermeldung ohne Fehler. */
      state.errs = {}; state.formErr = "";
      render();
    }

    /* ---------------- Ereignisse ---------------- */
    elFootBtn.addEventListener("click", function(){
      var neu = state.mode === "login" ? "signup" : "login";
      setMode(neu);
      /* Hier MIT Verlaufseintrag: der Nutzer hat den Wechsel ausgeloest, also soll der
         Zurueck-Knopf ihn zuruecknehmen. Geschrieben wird, was TATSAECHLICH gilt -- ohne
         Einladung bleibt es beim Login, und die Adresse darf dann nicht "signup" behaupten. */
      urlSetzen(state.mode, true);
      fire("data-mode-fn", "uauMode", { mode: state.mode, token: state.token });
    });
    elSide.addEventListener("click", function(){
      fire("data-side-fn", "uauSide", { mode: state.mode, token: state.token,
                                        email: String(elMail.value || "").trim() });
    });
    /* Das Formular ist ab jetzt der Weg: Klick auf den Knopf UND Enter im Feld loesen beide ein
       submit aus. Der eigene Enter-Handler von frueher ist damit weg -- er haette jetzt doppelt
       gefeuert. preventDefault, weil hier nichts an einen Server geschickt wird. */
    root.querySelector("[data-form]").addEventListener("submit", function(e){
      e.preventDefault();
      absenden();
    });
    elGoogle.addEventListener("click", function(){
      if (state.busy || state.done) return;
      /* GOOGLE LEGT AUCH KONTEN AN -- ohne diesen Riegel waere die Codepflicht ein Knopf weiter
         umgangen. Geprueft wird nur im Signup: im Login gibt es nichts zu berechtigen, und ein
         bestehendes Konto nach einem Code zu fragen waere Unsinn.
         Den Fall "im Login-Modus auf Google geklickt, ohne Konto" faengt diese Pruefung NICHT
         ab -- dort gibt es nichts zu pruefen. Dafuer sitzt der Auth-Hook in Supabase
         (bubble/datenbank_auftrag.md, Abschnitt 2); seine Absage zeigt oauthAbsage(). */
      _absage = "";
      if (codeAn() && !codeWert()){
        state.errs.code = "Please enter your registration code.";
        zeigeFehler();
        try { elCode.focus(); } catch(x){}
        return;
      }
      fire("data-google-fn", "uauGoogle", { mode: state.mode, token: state.token,
                                            code: codeAn() ? codeWert() : "",
                                            email: String(elMail.value || "").trim() });
    });
    elPw.addEventListener("input", function(){
      renderStaerke();
      /* Einen angezeigten Fehler beim Tippen wieder wegnehmen: er bezieht sich auf den Stand von
         vorhin, und ihn stehen zu lassen, waehrend der Nutzer ihn gerade behebt, ist Meckern. */
      if (state.errs.pw){ delete state.errs.pw; zeigeFehler(); }
    });
    elMail.addEventListener("input", function(){ if (state.errs.mail){ delete state.errs.mail; zeigeFehler(); } });
    elName.addEventListener("input", function(){ if (state.errs.name){ delete state.errs.name; zeigeFehler(); } });
    elCode.addEventListener("input", function(){ if (state.errs.code){ delete state.errs.code; zeigeFehler(); } });


    /* Unter 900px stapeln die Spalten (siehe CSS). Ueber den Beobachter statt einer
       Media-Query, weil dieses Element in Bubble auch in einem schmalen Container liegen kann --
       dann sagt die Fensterbreite das Falsche. */
    /* 1100 und nicht 900. Gerechnet, nicht geraten: der Formularblock ist 440px breit, dazu bis
       zu 2x64px Polster -- die linke Spalte braucht also rund 570px, um nicht zu quetschen. Zwei
       gleiche Spalten plus die 32px Kartenpolster sind damit rund 1170px. Bei 900 war die linke
       Spalte laengst auf 450px zusammengedrueckt, waehrend rechts noch ein Bild stand. */
    function messeBreite(){ root.classList.toggle("is-narrow", root.clientWidth < 1100); }
    messeBreite();
    /* Drei Wege, weil einer allein gemessen NICHT gereicht hat: bei einem Viewport-Wechsel von
       1440 auf 1000 blieb is-narrow aus, obwohl clientWidth 1000 war und UC.onResize existiert.
       Woran das liegt, habe ich nicht aufgeklaert -- ein eigener ResizeObserver auf dem Element
       tut es zuverlaessig, und window.resize deckt den Fall ab, dass es keinen gibt.
       Mehrfache Aufrufe schaden nicht: messeBreite setzt nur eine Klasse anhand einer Zahl. */
    if (UC.onResize) UC.onResize(root, messeBreite);
    if (window.ResizeObserver){
      try { new ResizeObserver(messeBreite).observe(root); } catch(e){}
    }
    if (UC.aufResize) UC.aufResize(messeBreite);
    else window.addEventListener("resize", messeBreite);

    /* ── Durchlaufende Vorschlaege, Mechanik 1:1 aus ask-mira (phStart/phTick) ──
       4000ms Takt, 240ms bis zum Textwechsel -- das ist der Punkt, an dem die alte Zeile oben
       aus dem Bild ist. Dann springt das Element ohne Uebergang nach unten, bekommt den neuen
       Text, und erst der erzwungene Reflow (offsetWidth) macht die Rueckfahrt wieder animierbar.
       Ohne diesen Reflow fasst der Browser Wegnehmen und Zuruecksetzen der Klasse zu einem
       Schritt zusammen und es bewegt sich nichts. */
    var phEl = root.querySelector("[data-ph]"), phIdx = 0, phTimer = null;
    function phTick(){
      phEl.classList.add("is-out");
      setTimeout(function(){
        phIdx = (phIdx + 1) % VORSCHLAEGE.length;
        phEl.style.transition = "none";
        phEl.classList.remove("is-out"); phEl.classList.add("is-in");
        phEl.textContent = VORSCHLAEGE[phIdx];
        void phEl.offsetWidth;
        phEl.style.transition = "";
        phEl.classList.remove("is-in");
      }, 240);
    }
    if (phEl){
      phEl.textContent = VORSCHLAEGE[0];
      phTimer = setInterval(phTick, 4000);
      /* Im Hintergrund weiterlaufen zu lassen kostet Rechenzeit fuer etwas, das niemand sieht --
         und auf einem Telefon heisst das Akku. */
      document.addEventListener("visibilitychange", function(){
        if (document.hidden){ if (phTimer){ clearInterval(phTimer); phTimer = null; } }
        else if (!phTimer) phTimer = setInterval(phTick, 4000);
      });
    }

    /* Reihenfolge mit Absicht: das Attribut ist der Vorgabewert aus Bubble, die Adresse schlaegt
       ihn. Ein geteilter Link auf ?mode=signup soll gewinnen, egal was im Element steht. */
    setMode(modeAusUrl() || (attr("data-mode", "login") === "signup" ? "signup" : "login"));
    /* Steht nichts in der Adresse, traegt die Seite ihren Modus nach -- ohne Verlaufseintrag,
       der Nutzer hat ihn ja nicht gewaehlt. */
    if (!modeAusUrl()) urlSetzen(state.mode, false);

    /* Einladung. Beide Schreibweisen werden gelesen: die Doku nennt mail, email ist die Form,
       die im Rest der App steht -- an einem Einladungslink soll das nicht scheitern. */
    setToken(urlParam("token") || attr("data-token"),
             urlParam("mail") || urlParam("email") || attr("data-email"));

    /* Der Code darf aus der Adresse kommen: ein Link wie /signup?code=ABC123 fuellt das Feld
       vor, und der Empfaenger muss nichts abtippen. Das ist kein Geheimnisverlust -- der Code
       IST der Zettel, den man weitergibt.
       Sichtbar bleibt er trotzdem, und aenderbar: der Nutzer soll sehen, womit er sich anmeldet,
       und einen falsch kopierten Code selbst richtigstellen koennen. */
    var codeVor = urlParam("code") || urlParam("invite_code") || attr("data-code");
    if (codeVor) elCode.value = String(codeVor).replace(/\s+/g, "").toUpperCase();
    renderCode();

    /* NACH Modus und Einladung: setMode und setToken leeren die Formularzeile, wenn sie den
       Modus wechseln -- eine vorher gesetzte Absage waere damit gleich wieder weg. */
    var absage = oauthAbsage();
    if (absage){ state.formErr = absage; zeigeFehler(); }

    /* Zurueck- und Vorwaerts-Knopf des Browsers. Ohne das zeigt die Seite nach einem Zurueck
       weiter den alten Modus, waehrend die Adresse schon den anderen nennt. */
    window.addEventListener("popstate", function(){
      var m = modeAusUrl();
      if (m) setMode(m);
    });

    root.querySelector("[data-theme-btn]").addEventListener("click", function(){
      var neuDunkel = !istDunkel();
      /* Ueber core, nicht per Attribut: setUpstreemTheme schreibt den localStorage, faerbt JEDE
         .up-root der Seite und benachrichtigt die Abonnenten. Nur dieses Element umzustellen
         hiesse, dass ein anderer Baustein daneben hell bliebe. */
      if (UC.setUpstreemTheme) UC.setUpstreemTheme(neuDunkel ? "dark" : "light");
      else if (window.setUpstreemTheme) window.setUpstreemTheme(neuDunkel ? "dark" : "light");
      else { if (neuDunkel) root.setAttribute("data-theme", "dark"); else root.removeAttribute("data-theme"); }
      syncTheme();
    });
    /* Stellt jemand anders das Theme um, zieht das Logo und das Icon hier mit. */
    if (UC.onTheme) UC.onTheme(syncTheme);

    syncTheme();
    if (window.MutationObserver){
      new MutationObserver(syncTheme).observe(root, {
        attributes: true, attributeFilter: ["data-isdark", "data-logo", "data-logo-dark"]
      });
    }

    render();

    /* Einzug beim Aufbau, blockweise (Regeln in der CSS). Erst im naechsten Frame, sonst faellt
       der Klassenwechsel mit dem ersten Zeichnen zusammen und der Browser fasst beides zu einem
       Schritt zusammen -- die Animation liefe dann gar nicht.
       Die Klasse faellt nach dem letzten Durchlauf wieder ab: 200ms Dauer plus 180ms Versatz,
       plus etwas Luft. Ein fester Wecker und nicht animationend, weil das Ereignis fuer JEDEN
       der acht Bloecke einzeln kommt und man dann mitzaehlen muesste. */
    root.classList.add("is-entering");
    /* Der Wecker laeuft SOFORT los, nicht hinter requestAnimationFrame. rAF feuert nicht, solange
       der Tab im Hintergrund liegt -- die Klasse waere dann nie wieder abgefallen und die
       Animationsregeln blieben dauerhaft ueber den spaeteren Uebergaengen dieser Seite liegen.
       Gemessen: mit rAF davor stand is-entering nach einer halben Sekunde noch.
       760ms = 420ms Dauer + 260ms Versatz der letzten Stufe + Luft. Steht der Wert zu niedrig,
       schneidet das Entfernen der Klasse die letzte Stufe mitten in der Bewegung ab. */
    setTimeout(function(){ root.classList.remove("is-entering"); }, 760);

    return {
      root: root,
      setMode: function(m){ setMode(m); urlSetzen(state.mode, false); },
      setInvite: function(tok, mail){ setToken(tok, mail); return true; },
      setLoading: function(on){ setBusy(UC.isYes(on)); },
      setError: function(feldName, text){
        /* Ein Fehler beendet den Ladezustand IMMER. Sonst haette eine Antwort, die einen Fehler
           meldet, den Knopf weiterdrehen lassen -- die Seite waere nach einem Tippfehler im
           Passwort tot. */
        setBusy(false);
        var f = String(feldName || "").toLowerCase();
        var t = String(text == null ? "" : text);
        if (f === "name" || f === "full_name") state.errs.name = t;
        else if (f === "email" || f === "mail") state.errs.mail = t;
        else if (f === "password" || f === "pw") state.errs.pw = t;
        /* Der Fehler des Servers gehoert AN DAS FELD, nicht in die Zeile ueber dem Formular:
           "Diesen Code gibt es nicht" neben dem Code ist eine Anweisung, dieselbe Meldung oben
           ist eine Verlautbarung. */
        else if (f === "code" || f === "registration_code") state.errs.code = t;
        else state.formErr = t || "Something went wrong. Please try again.";
        zeigeFehler();
        return true;
      },
      /* Der rohe Fehler aus Bubble (07.10.): serverFehler macht Feld und Satz daraus. */
      setServerError: function(roh){
        var f = serverFehler(roh, state.mode);
        return this.setError(f.feld, f.text);
      },
      setDone: function(titel, text){
        setBusy(false);
        state.done = true;
        elDoneH.textContent = String(titel || "You’re all set");
        elDoneB.textContent = String(text || "Check your inbox to confirm your email address.");
        elPaneForm.classList.add("is-off");
        elPaneForm.setAttribute("aria-hidden", "true");
        elPaneDone.classList.remove("is-off");
        elPaneDone.removeAttribute("aria-hidden");
        return true;
      },
      reset: function(){
        setBusy(false);
        state.done = false; state.errs = {}; state.formErr = "";
        elName.value = elMail.value = elPw.value = elCode.value = "";
        elCheck.checked = false;
        elPaneDone.classList.add("is-off");
        elPaneDone.setAttribute("aria-hidden", "true");
        elPaneForm.classList.remove("is-off");
        elPaneForm.removeAttribute("aria-hidden");
        render();
        return true;
      }
    };
  }

  /* ══ DIE SEITEN OHNE ANMELDEFORMULAR (07.10.) ════════════════════════════════════════════════
     Vier kleine Seiten, die bis dahin reine Bubble-Seiten waren: "Check your email" nach dem
     Signup, "Passwort vergessen", "Neues Passwort" (das Ziel des Ruecksetzlinks) und die 404.
     Sie stehen HIER und nicht in einer eigenen Datei, weil sie aus denselben Teilen bestehen wie
     die Anmeldeseite -- Logo und Theme-Knopf oben, Feld, Hauptknopf, Fehlerkasten, Staerkeanzeige,
     Ladezustand mit Notbremse, Erfolgsblock. Eine zweite Datei haette jedes davon nachgebaut, und
     die beiden liefen auseinander, sobald eine Seite geaendert wird und die andere nicht.
     Welche Seite, sagt data-page. Ohne das Attribut bleibt es die Anmeldeseite (login/signup).
     DAS RASTER: wie die Anmeldeseite -- dieselbe Karte mit 16px Polster, oben links das Logo, oben
     rechts der Theme-Knopf, in denselben Abstaenden. Der Inhalt steht in der Mitte der Seite, nicht
     in der linken Spalte: es gibt keine rechte. Die blaue Flaeche der rechten Spalte steht dafuer
     als Grund unten auf der Seite (.uau-solo-bg), mit demselben Linienmuster.
     KEINE Bubble-Events ausser den zwei, ohne die es nicht geht: der Ruecksetzlink muss verschickt
     und das neue Passwort gesetzt werden -- beides kann nur Supabase. Alle Wege zurueck sind Links. */
  var SEITEN = {
    "check-email": {
      ic: "mail", h1: "Check your email",
      sub: "We sent you a confirmation link. Please confirm your email to continue.",
      hinweis: "Didn’t get it? Check your spam folder. It can take a minute to arrive."
    },
    "forgot-password": {
      ic: "lock", h1: "Forgot your password?",
      sub: "Enter your email and we’ll send you a link to reset your password.",
      cta: "Send reset link", ctaBusy: "Sending link",
      /* NEUTRAL, ob es das Konto gibt oder nicht: sonst liesse sich mit dieser Seite pruefen,
         welche Adressen bei upstreem ein Konto haben (Account Enumeration). Supabase verschickt
         ohnehin nur an bestehende Konten und meldet fuer fremde Adressen keinen Fehler. */
      doneH: "Check your email",
      doneSub: "If an account exists for {mail}, you’ll get a link to reset your password.",
      doneSubOhne: "If an account exists for this email, you’ll get a link to reset your password."
    },
    "reset-password": {
      ic: "lock", h1: "Set a new password",
      sub: "Choose a strong password you don’t use anywhere else.",
      cta: "Reset password", ctaBusy: "Resetting password",
      doneH: "Password updated", doneSub: "You can now sign in with your new password.",
      doneCta: "Continue to sign in"
    },
    "not-found": {
      h1: "Page not found",
      sub: "The page you’re looking for doesn’t exist or has been moved.",
      cta: "Go to dashboard", zurueck: "Go back"
    }
  };
  /* "404" als Schreibweise zugelassen: so heisst die Seite in Bubble. */
  function seiteVon(root){
    var p = String(root.getAttribute("data-page") || "").trim().toLowerCase();
    if (p === "404") p = "not-found";
    return SEITEN[p] ? p : "";
  }
  /* Ruecksetzen schickt Supabase hoechstens einmal je Minute an dieselbe Adresse. Der Knopf
     "Resend link" wartet genau so lange -- frueher waere ein Klick, den der Server abweist. */
  var NEU_SENDEN_S = 60;

  function makeSeite(root, art){
    var UC = window.UpstreemCore;
    var esc = UC.esc, T = SEITEN[art];
    var state = { busy: false, done: false, errs: {}, formErr: "", aktion: "", mail: "" };
    var busyTimer = null, wiederUhr = null, wiederBis = 0;

    /* Wohin die Wege fuehren. Vorgaben sind die Adressen der App: der Login liegt auf der
       Signup-Seite (die Landingpage verlinkt app.upstreem.ai/signup?mode=login). Jede ist per
       Attribut ueberschreibbar, falls die Bubble-Seiten anders heissen. */
    var URL_LOGIN  = attrVon(root, "data-login-url", "/signup?mode=login");
    var URL_FORGOT = attrVon(root, "data-forgot-url", "/forgot-password");
    var URL_HOME   = attrVon(root, "data-home-url", "/");

    /* Die Adresse kann aus der Seitenadresse kommen (?email=) oder vom Element. Auf "Check your
       email" steht sie dann im Text, auf "Passwort vergessen" ist das Feld vorbelegt (der Link
       "Forgot password?" der Anmeldeseite reicht die eingetippte Adresse weiter). */
    var q = adressQ() || {};
    state.mail = String(q.email || q.mail || attrVon(root, "data-email") || "").trim();
    if (!mailOk(state.mail)) state.mail = "";

    function ic(n, w){ return UC.icon ? UC.icon(n, w || 2) : ""; }
    function kopf(icon, h1, sub, extra){
      return '<div class="uau-solo-kopf">' +
        (icon ? '<span class="uau-solo-ic">' + ic(icon, 1.8) + '</span>' : '') +
        '<h1 class="uau-h1 uau-solo-h1">' + esc(h1) + '</h1>' +
        '<div class="uau-sub" data-sub>' + sub + '</div>' + (extra || '') +
      '</div>';
    }
    function zurueckLink(text){
      return '<a class="uau-back" href="' + esc(URL_LOGIN) + '">' + ic("arrowLeft", 2) +
        '<span>' + esc(text || "Back to sign in") + '</span></a>';
    }
    function feld(name, label, typ, auto, ph, mehr){
      return '<label class="uau-field" data-w-' + name + '>' +
        '<span class="uau-label">' + esc(label) + '</span>' +
        '<input class="up-field uau-input" type="' + typ + '" name="' + name + '" autocomplete="' + auto + '"' +
          ' placeholder="' + esc(ph) + '" data-f-' + name + '/>' +
        '<span class="uau-err"><span data-e-' + name + '></span></span>' + (mehr || '') +
      '</label>';
    }
    var STAERKE_HTML = '<span class="uau-strength" data-strength><div><span class="uau-strength-in">' +
      '<span class="uau-bars"><span class="uau-bar"></span><span class="uau-bar"></span>' +
      '<span class="uau-bar"></span><span class="uau-bar"></span></span>' +
      '<span class="uau-strength-txt" data-strength-txt></span></span></div></span>';
    var FEHLER_HTML = '<div class="uau-formerr" data-formerr><div><div class="uau-formerr-in">' +
      '<span data-formerr-txt></span><a class="uau-formerr-link" data-formerr-link hidden></a></div></div></div>';

    function inhalt(){
      if (art === "check-email"){
        return kopf(T.ic, T.h1, esc(T.sub),
            state.mail ? '<div class="uau-solo-mail"><span>' + esc(state.mail) + '</span></div>' : '') +
          '<a class="uau-sek uau-solo-weg" href="' + esc(URL_LOGIN) + '">' + ic("arrowLeft", 2) + '<span>Back to sign in</span></a>' +
          '<p class="uau-solo-hinweis">' + esc(T.hinweis) + '</p>';
      }
      if (art === "forgot-password"){
        return kopf(T.ic, T.h1, esc(T.sub)) + FEHLER_HTML +
          /* Ein echtes <form>, wie auf der Anmeldeseite: Enter loest aus, und der Passwortverwalter
             erkennt das Feld als Adresse. */
          '<form class="uau-form-el" novalidate data-form>' +
            '<div class="uau-fields">' + feld("mail", "Work email", "email", "email", "alex@company.com") + '</div>' +
            '<button class="uau-primary" type="submit" data-primary><span class="uau-spin"></span>' +
              '<span data-primary-txt>' + esc(T.cta) + '</span></button>' +
          '</form>' + zurueckLink();
      }
      if (art === "reset-password"){
        return kopf(T.ic, T.h1, esc(T.sub)) + FEHLER_HTML +
          '<form class="uau-form-el" novalidate data-form>' +
            /* Ein verstecktes Benutzerfeld: ohne es weiss der Passwortverwalter nicht, ZU WELCHEM
               Konto das neue Passwort gehoert, und speichert es nicht oder beim falschen. Chrome
               warnt sonst "Password forms should have (optionally hidden) username fields". */
            '<input class="uau-solo-user" type="email" name="username" autocomplete="username" tabindex="-1"' +
              ' aria-hidden="true" readonly value="' + esc(state.mail) + '"/>' +
            '<div class="uau-fields">' +
              feld("pw", "New password", "password", "new-password", "At least 8 characters", STAERKE_HTML) +
              feld("pw2", "Confirm password", "password", "new-password", "Repeat your new password") +
            '</div>' +
            '<button class="uau-primary" type="submit" data-primary><span class="uau-spin"></span>' +
              '<span data-primary-txt>' + esc(T.cta) + '</span></button>' +
          '</form>' + zurueckLink();
      }
      /* not-found */
      return '<div class="uau-404" aria-hidden="true">404</div>' +
        kopf("", T.h1, esc(T.sub)) +
        '<div class="uau-solo-reihe">' +
          '<a class="uau-primary" href="' + esc(URL_HOME) + '">' + esc(T.cta) + '</a>' +
          '<button class="uau-sek" type="button" data-zurueck>' + ic("arrowLeft", 2) + '<span>' + esc(T.zurueck) + '</span></button>' +
        '</div>';
    }
    function fertig(){
      if (art === "forgot-password"){
        return kopf("mail", T.doneH, "", "") +
          '<p class="uau-solo-hinweis uau-solo-wieder"><span>Didn’t get it?</span>' +
            '<button type="button" class="uau-side" data-wieder></button></p>' + zurueckLink();
      }
      if (art === "reset-password"){
        return '<div class="uau-solo-kopf"><span class="uau-done-ic">' + ic("check", 2.4) + '</span>' +
            '<h1 class="uau-h1 uau-solo-h1" data-done-h>' + esc(T.doneH) + '</h1>' +
            '<div class="uau-sub" data-done-b>' + esc(T.doneSub) + '</div></div>' +
          '<a class="uau-primary" href="' + esc(URL_LOGIN) + '">' + esc(T.doneCta) + '</a>';
      }
      return "";
    }

    root.classList.add("is-solo");
    root.setAttribute("data-uau-page", art);
    var bg = attrVon(root, "data-bg");
    root.innerHTML = '<div class="uau-card is-solo">' +
      '<div class="uau-form">' +
        '<div class="uau-top">' +
          '<img class="uau-logo" src="' + esc(logoFuer(root, dunkelFuer(root))) + '" alt="upstreem"/>' +
          '<button class="uau-themebtn" type="button" data-theme-btn aria-label="Switch theme"></button>' +
        '</div>' +
        '<div class="uau-mid">' +
          '<div class="uau-block uau-stack">' +
            '<div class="uau-pane" data-pane-form>' + inhalt() + '</div>' +
            (fertig() ? '<div class="uau-pane is-off" data-pane-done aria-hidden="true">' + fertig() + '</div>' : '') +
          '</div>' +
        '</div>' +
      '</div>' +
      /* Der Grund: die Flaeche der rechten Spalte der Anmeldeseite, hier unten ueber die ganze
         Breite. Das Bild dazu wie dort aus data-bg; ohne bleibt der Verlauf allein. */
      '<div class="uau-solo-bg" aria-hidden="true"' + (bg ? ' style="--uau-bgimg: url(&quot;' + esc(bg) + '&quot;)"' : '') + '></div>' +
    '</div>';

    var el = {
      form: root.querySelector("[data-form]"),
      primary: root.querySelector("[data-primary]"),
      primTxt: root.querySelector("[data-primary-txt]"),
      mail: root.querySelector("[data-f-mail]"),
      pw: root.querySelector("[data-f-pw]"),
      pw2: root.querySelector("[data-f-pw2]"),
      formErr: root.querySelector("[data-formerr]"),
      formErrT: root.querySelector("[data-formerr-txt]"),
      formErrL: root.querySelector("[data-formerr-link]"),
      strength: root.querySelector("[data-strength]"),
      strTxt: root.querySelector("[data-strength-txt]"),
      paneForm: root.querySelector("[data-pane-form]"),
      paneDone: root.querySelector("[data-pane-done]"),
      wieder: root.querySelector("[data-wieder]")
    };
    if (el.mail && state.mail) el.mail.value = state.mail;

    /* ---------------- Theme ---------------- */
    function syncTheme(){
      var d = dunkelFuer(root);
      if (d) root.setAttribute("data-theme", "dark"); else root.removeAttribute("data-theme");
      var b = root.querySelector("[data-theme-btn]");
      if (b){
        b.innerHTML = d ? SUN_SVG : MOON_SVG;
        b.setAttribute("aria-label", d ? "Switch to light mode" : "Switch to dark mode");
      }
      var l = root.querySelector(".uau-logo");
      var neu = logoFuer(root, d);
      if (l && l.getAttribute("src") !== neu) l.setAttribute("src", neu);
    }
    root.querySelector("[data-theme-btn]").addEventListener("click", function(){
      var neuDunkel = !dunkelFuer(root);
      /* Ueber core: setUpstreemTheme schreibt pref_theme -- die Wahl gilt danach auch in der App. */
      if (UC.setUpstreemTheme) UC.setUpstreemTheme(neuDunkel ? "dark" : "light");
      else { if (neuDunkel) root.setAttribute("data-theme", "dark"); else root.removeAttribute("data-theme"); }
      syncTheme();
    });
    if (UC.onTheme) UC.onTheme(syncTheme);

    /* ---------------- Fehler, Staerke, Ladezustand ---------------- */
    function zeigeFehler(){
      ["mail", "pw", "pw2"].forEach(function(k){
        var f = root.querySelector("[data-w-" + k + "]");
        if (!f) return;
        var msg = state.errs[k] || "";
        f.classList.toggle("is-err", !!msg);
        var slot = root.querySelector("[data-e-" + k + "]");
        if (slot) slot.textContent = msg;
      });
      if (!el.formErr) return;
      el.formErrT.textContent = state.formErr || "";
      el.formErr.classList.toggle("is-on", !!state.formErr);
      /* Der Weg aus einem abgelaufenen Link: gleich daneben ein neuer -- nicht nur der Satz, dass
         es nicht ging. */
      var mitLink = state.aktion === "neuerLink";
      el.formErrL.hidden = !mitLink;
      if (mitLink){
        el.formErrL.textContent = "Request a new link";
        el.formErrL.setAttribute("href", URL_FORGOT + (state.mail ? (URL_FORGOT.indexOf("?") >= 0 ? "&" : "?") +
          "email=" + encodeURIComponent(state.mail) : ""));
      }
    }
    function renderStaerke(){
      if (!el.strength) return;
      var an = !!el.pw.value;
      el.strength.classList.toggle("is-on", an);
      if (!an){ el.strength.removeAttribute("data-level"); return; }
      var lv = staerke(el.pw.value);
      el.strength.setAttribute("data-level", String(lv));
      var bars = el.strength.querySelectorAll(".uau-bar");
      for (var i = 0; i < bars.length; i++) bars[i].classList.toggle("is-on", i < lv);
      el.strTxt.textContent = STAERKE[lv] || "";
    }
    function setBusy(on){
      state.busy = !!on;
      if (el.primary){
        el.primary.classList.toggle("is-busy", state.busy);
        el.primary.disabled = state.busy;
        el.primTxt.textContent = state.busy ? T.ctaBusy : T.cta;
      }
      [el.mail, el.pw, el.pw2].forEach(function(f){ if (f) f.disabled = state.busy; });
      if (busyTimer){ clearTimeout(busyTimer); busyTimer = null; }
      if (state.busy){
        /* Die Notbremse der Anmeldeseite, dieselben 20 Sekunden (BUSY_MAX). */
        busyTimer = setTimeout(function(){
          busyTimer = null;
          state.formErr = "That took longer than expected. Please try again.";
          state.aktion = "";
          setBusy(false);
          zeigeFehler();
        }, BUSY_MAX);
      }
    }

    /* ---------------- Pruefen und Absenden ---------------- */
    function pruefe(){
      var e = {};
      if (art === "forgot-password"){
        var m = String(el.mail.value || "").trim();
        if (!m) e.mail = "Please enter your email address.";
        else if (!mailOk(m)) e.mail = "That does not look like an email address.";
      }
      if (art === "reset-password"){
        var p1 = String(el.pw.value || ""), p2 = String(el.pw2.value || "");
        /* Dieselbe Regel wie beim Anlegen (8 Zeichen): ein neues Passwort ist ein neues Passwort. */
        if (!p1) e.pw = "Please enter a new password.";
        else if (p1.length < 8) e.pw = "At least 8 characters.";
        if (!p2) e.pw2 = "Please repeat your new password.";
        else if (p1 && p2 !== p1) e.pw2 = "The passwords do not match.";
      }
      state.errs = e; state.formErr = ""; state.aktion = "";
      zeigeFehler();
      var erste = e.mail ? el.mail : (e.pw ? el.pw : (e.pw2 ? el.pw2 : null));
      if (erste){ try { erste.focus(); } catch(x){} return false; }
      return true;
    }
    function absenden(){
      if (state.busy || state.done) return;
      if (!pruefe()) return;
      if (art === "forgot-password"){
        state.mail = String(el.mail.value || "").trim();
        /* Die Adresse als ROHER Wert, wie das Passwort auf der Anmeldeseite: in Bubble ist
           "This JavaScriptToBubble's value" dann schon die Adresse, ohne Auslesen. */
        feuerRoh(root, "data-forgot-fn", "uauForgot", state.mail);
      } else {
        feuerRoh(root, "data-newpw-fn", "uauNewPassword", String(el.pw.value || ""));
      }
      setBusy(true);
    }
    if (el.form) el.form.addEventListener("submit", function(e){ e.preventDefault(); absenden(); });
    if (el.mail) el.mail.addEventListener("input", function(){ if (state.errs.mail){ delete state.errs.mail; zeigeFehler(); } });
    if (el.pw) el.pw.addEventListener("input", function(){
      renderStaerke();
      if (state.errs.pw){ delete state.errs.pw; zeigeFehler(); }
      /* "Passt nicht" verschwindet, sobald beide wieder gleich sind -- egal, in welchem Feld
         der Nutzer korrigiert. */
      if (state.errs.pw2 && el.pw2.value === el.pw.value){ delete state.errs.pw2; zeigeFehler(); }
    });
    if (el.pw2) el.pw2.addEventListener("input", function(){
      if (state.errs.pw2 && (!el.pw2.value || el.pw2.value === el.pw.value)){ delete state.errs.pw2; zeigeFehler(); }
    });

    /* "Go back" auf der 404: zurueck, wenn es ein Zurueck gibt -- sonst zum Dashboard. Ein
       direkt geoeffneter toter Link hat keinen Verlauf, und ein Knopf, der nichts tut, ist
       schlimmer als einer, der woanders hinfuehrt. */
    var zurueckKnopf = root.querySelector("[data-zurueck]");
    if (zurueckKnopf) zurueckKnopf.addEventListener("click", function(){
      var vonHier = false;
      try { vonHier = !!document.referrer && new URL(document.referrer).origin === window.location.origin; } catch(e){}
      if (vonHier && window.history.length > 1) window.history.back();
      else window.location.href = URL_HOME;
    });

    /* ---------------- Erneut senden (Passwort vergessen) ---------------- */
    function wiederRender(){
      if (!el.wieder) return;
      var rest = Math.ceil((wiederBis - Date.now()) / 1000);
      if (state.busy){ el.wieder.textContent = "Sending…"; el.wieder.disabled = true; return; }
      if (rest > 0){ el.wieder.textContent = "Resend in " + rest + "s"; el.wieder.disabled = true; return; }
      el.wieder.textContent = "Resend link"; el.wieder.disabled = false;
      if (wiederUhr){ clearInterval(wiederUhr); wiederUhr = null; }
    }
    function wiederStarten(){
      wiederBis = Date.now() + NEU_SENDEN_S * 1000;
      if (wiederUhr) clearInterval(wiederUhr);
      wiederUhr = setInterval(wiederRender, 1000);
      wiederRender();
    }
    if (el.wieder) el.wieder.addEventListener("click", function(){
      if (el.wieder.disabled || !state.mail) return;
      feuerRoh(root, "data-forgot-fn", "uauForgot", state.mail);
      setBusy(true);
      wiederRender();
    });

    function zeigeFertig(titel, text){
      setBusy(false);
      state.done = true;
      var h = el.paneDone.querySelector(".uau-h1"), b = el.paneDone.querySelector(".uau-sub");
      if (art === "forgot-password"){
        if (h) h.textContent = titel || T.doneH;
        if (b) b.textContent = text || (state.mail ? T.doneSub.replace("{mail}", state.mail) : T.doneSubOhne);
        wiederStarten();
      } else {
        if (h) h.textContent = titel || T.doneH;
        if (b) b.textContent = text || T.doneSub;
      }
      el.paneForm.classList.add("is-off");
      el.paneForm.setAttribute("aria-hidden", "true");
      el.paneDone.classList.remove("is-off");
      el.paneDone.removeAttribute("aria-hidden");
    }
    function zeigeFormular(){
      state.done = false;
      if (wiederUhr){ clearInterval(wiederUhr); wiederUhr = null; }
      if (!el.paneDone) return;
      el.paneDone.classList.add("is-off");
      el.paneDone.setAttribute("aria-hidden", "true");
      el.paneForm.classList.remove("is-off");
      el.paneForm.removeAttribute("aria-hidden");
    }

    /* Ein abgelaufener oder schon benutzter Ruecksetzlink kommt von Supabase mit error_code in der
       Adresse zurueck (#error=access_denied&error_code=otp_expired&...). Dann steht der Weg zu
       einem neuen Link sofort da -- nicht erst, nachdem jemand zweimal ein Passwort getippt hat. */
    if (art === "reset-password" && (q.error || q.error_code || q.error_description)){
      var f0 = serverFehler(String(q.error_code || "") + " " + String(q.error_description || q.error || ""), art);
      state.formErr = f0.text; state.aktion = f0.aktion || "";
      adressFehlerWeg();
    }

    syncTheme();
    if (window.MutationObserver){
      new MutationObserver(syncTheme).observe(root, { attributes: true, attributeFilter: ["data-isdark", "data-logo", "data-logo-dark"] });
    }
    /* Schmal wie auf der Anmeldeseite (messeBreite dort, mit Begruendung der drei Wege): erst das
       schmale Polster, dann rueckt der Inhalt an die Raender. Fehlte hier zuerst -- gemessen stand
       der Block auf 375px mit 44px Rand je Seite statt mit dem schmalen Polster. */
    function messeBreite(){ root.classList.toggle("is-narrow", root.clientWidth < 1100); }
    messeBreite();
    if (window.ResizeObserver){ try { new ResizeObserver(messeBreite).observe(root); } catch(e){} }
    if (UC.aufResize) UC.aufResize(messeBreite); else window.addEventListener("resize", messeBreite);
    zeigeFehler();
    /* Einzug wie auf der Anmeldeseite: Kopf, dann der Bedienteil (Klassen in der CSS). */
    root.classList.add("is-entering");
    setTimeout(function(){ root.classList.remove("is-entering"); }, 760);

    return {
      root: root,
      setMode: function(){ return true; },
      setInvite: function(){ return true; },
      setLoading: function(on){ setBusy(UC.isYes(on)); return true; },
      /* Dieselbe Form wie auf der Anmeldeseite: (feld, text). "email", "password", "confirm"
         gehoeren an ihr Feld, alles andere in den Kasten ueber dem Formular. */
      setError: function(feldName, text){
        setBusy(false);
        if (state.done) zeigeFormular();
        var f = String(feldName || "").toLowerCase(), t = String(text == null ? "" : text);
        state.aktion = "";
        if (f === "email" || f === "mail") state.errs.mail = t;
        else if (f === "password" || f === "pw") state.errs.pw = t;
        else if (f === "confirm" || f === "password_confirm" || f === "pw2") state.errs.pw2 = t;
        else state.formErr = t || "Something went wrong. Please try again.";
        zeigeFehler();
        return true;
      },
      setServerError: function(roh){
        var f = serverFehler(roh, art);
        /* Auf "Passwort vergessen" verraet die Seite NIE, ob es ein Konto gibt: "user not found"
           wird zur selben Bestaetigung wie ein Erfolg. */
        if (art === "forgot-password" && /user_not_found|user not found/i.test(String(roh || ""))){
          zeigeFertig(); return true;
        }
        /* Eine Serverantwort ersetzt die vorige ganz: ein Feldfehler vom letzten Versuch stuende
           sonst neben dem neuen Satz und widerspraeche ihm. */
        state.errs = {}; state.formErr = "";
        this.setError(f.feld, f.text);
        state.aktion = f.aktion || "";
        zeigeFehler();
        return true;
      },
      setDone: function(titel, text){
        if (!el.paneDone){ setBusy(false); return true; }
        zeigeFertig(titel ? String(titel) : "", text ? String(text) : "");
        return true;
      },
      reset: function(){
        setBusy(false);
        zeigeFormular();
        state.errs = {}; state.formErr = ""; state.aktion = "";
        [el.mail, el.pw, el.pw2].forEach(function(f){ if (f) f.value = ""; });
        if (el.mail && state.mail) el.mail.value = state.mail;
        renderStaerke(); zeigeFehler();
        return true;
      }
    };
  }

  var mount = null;
  function uauRun(){
    var UCl = window.UpstreemCore;
    mount = UCl.makeMount({
      onMount: function(m){ mount = m; },
      rootClass: "uau-root", notPortal: true,
      ctrlProp: "__uauController", resolveLocal: "__uauResolveLocal", queue: "__uauBootQueue",
      initRoot: initRootNow,
      api: {
        renderAuthPage: doRender,
        setAuthPageMode: doMode,
        setAuthPageLoading: doLoading,
        setAuthPageError: doError,
        setAuthPageDone: doDone,
        setAuthPageInvite: doInvite,
        setAuthPageServerError: doServerError,
        resetAuthPage: doReset
      },
      forwardShape: { renderAuthPage: "params", resetAuthPage: "id" }
    });
  }
  function resolve(id){
    id = String(id || "").trim();
    var r = mount ? mount.rootsWithId(id) : rootsById(id);
    if (!r.length) return null;
    return r[0].__uauController || initRootNow(r[0]);
  }
  function rootsById(id){
    var out = [], all = document.querySelectorAll(".uau-root");
    for (var i = 0; i < all.length; i++){
      if ((all[i].getAttribute("data-instance") || "default") === id) out.push(all[i]);
    }
    return out;
  }
  function initRootNow(root){
    if (root.__uauController) return root.__uauController;
    if ((root.getAttribute("data-instance") || "default") === "INSTANCE_ID") return null;
    /* data-page waehlt eine der Seiten ohne Anmeldeformular (07.10.), sonst die Anmeldeseite. */
    var art = seiteVon(root);
    var c = art ? makeSeite(root, art) : makeController(root);
    root.__uauController = c;
    return c;
  }
  function doRender(params){
    var UCl = window.UpstreemCore;
    var p = UCl.normParams ? UCl.normParams(params) : params;
    if (typeof p === "string") p = UCl.parseBubbleJson(p) || {};
    p = p || {};
    var c = resolve(p.instanceId);
    if (!c){ if (window.console) console.warn("[auth-page] no instance for id " + p.instanceId); return false; }
    if (p.mode != null) c.setMode(p.mode);
    return true;
  }
  function doMode(id, m){ var c = resolve(id); return c ? (c.setMode(m), true) : false; }
  function doLoading(id, on){ var c = resolve(id); return c ? (c.setLoading(on), true) : false; }
  function doError(id, feld, text){ var c = resolve(id); return c ? c.setError(feld, text) : false; }
  function doDone(id, titel, text){ var c = resolve(id); return c ? c.setDone(titel, text) : false; }
  function doInvite(id, token, mail){ var c = resolve(id); return c ? c.setInvite(token, mail) : false; }
  function doReset(id){ var c = resolve(id); return c ? c.reset() : false; }
  function doServerError(id, roh){ var c = resolve(id); return c ? c.setServerError(roh) : false; }

  uauBoot(30);
})();
