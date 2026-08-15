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
     "setAuthPageDone", "resetAuthPage"].forEach(function(n){
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
      check: "Remember me", side: "Forgot password?",
      cta: "Sign in", ctaBusy: "Signing in",
      footTxt: "Don’t have an account?", footLink: "Sign up"
    },
    signup: {
      hallo: "Hey there,", h1: "Let’s get you set up",
      sub: "Sign up to win AI Search.",
      check: "Send me product updates", side: "",
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

  var CHECK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" ' +
    'stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
  var MIC_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>' +
    '<path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></svg>';
  var UP_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/>' +
    '<polyline points="5 12 12 5 19 12"/></svg>';

  /* ── Pruefungen ────────────────────────────────────────────────────────────
     Die E-Mail-Regel ist bewusst grob. Ein Muster, das RFC 5322 nachbildet, weist echte Adressen
     ab (Pluszeichen, Umlaute, lange Endungen) -- und eine Anmeldeseite, die eine gueltige Adresse
     ablehnt, kostet einen Nutzer. Was wirklich zustellbar ist, weiss ohnehin nur der Server. */
  function mailOk(v){ return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || "").trim()); }

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
    return Math.max(1, Math.min(4, p - 1));
  }

  function makeController(root){
    var UC = window.UpstreemCore;
    var esc = UC.esc;
    var fire = UC.makeFire(root, { label: "auth-page", eventPrefix: "uau" });

    var state = { mode: "login", busy: false, done: false, errs: {}, formErr: "" };
    var busyTimer = null;

    function attr(n, f){ var v = root.getAttribute(n); return (v == null || v === "" || /^[A-Z_]{3,}$/.test(v)) ? (f || "") : v; }

    root.innerHTML = shell();

    var elCard    = root.querySelector(".uau-card");
    var elH1      = root.querySelector("[data-h1]");
    var elSub     = root.querySelector("[data-sub]");
    var elName    = root.querySelector("[data-f-name]");
    var elMail    = root.querySelector("[data-f-mail]");
    var elPw      = root.querySelector("[data-f-pw]");
    var elNameWrap= root.querySelector("[data-w-name]");
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
    var elPaneForm= root.querySelector("[data-pane-form]");
    var elPaneDone= root.querySelector("[data-pane-done]");
    var elDoneH   = root.querySelector("[data-done-h]");
    var elDoneB   = root.querySelector("[data-done-b]");

    function feld(el){ return el.closest(".uau-field"); }

    function shell(){
      var logo = attr("data-logo");
      var bg   = attr("data-bg");
      return '' +
      '<div class="uau-card"' + (bg ? ' data-hasbg="1"' : '') + '>' +
        '<div class="uau-form">' +
          (logo ? '<img class="uau-logo" src="' + esc(logo) + '" alt="upstreem"/>' : '<div class="uau-logo"></div>') +
          '<div class="uau-mid">' +
            '<div class="uau-block uau-stack">' +
              /* Formular und Erfolg liegen uebereinander im selben Raster -- so behaelt die Karte
                 beim Wechsel ihre Hoehe und nichts springt. */
              '<div class="uau-pane" data-pane-form>' +
                '<h1 class="uau-h1"><span data-hallo></span><br><span data-h1></span></h1>' +
                '<div class="uau-sub" data-sub></div>' +
                '<div class="uau-formerr" data-formerr><div><div class="uau-formerr-in" data-formerr-txt></div></div></div>' +
                '<div class="uau-fields">' +
                  '<label class="uau-field uau-collapse" data-w-name>' +
                    '<span class="uau-collapse-in">' +
                      '<span class="uau-label">Full name</span>' +
                      '<input class="up-field uau-input" type="text" name="name" autocomplete="name" ' +
                        'placeholder="Alex Meier" data-f-name/>' +
                      '<span class="uau-err"><span data-e-name></span></span>' +
                    '</span>' +
                  '</label>' +
                  '<label class="uau-field">' +
                    '<span class="uau-label">Work email</span>' +
                    '<input class="up-field uau-input" type="email" name="email" autocomplete="email" ' +
                      'placeholder="alex@company.com" data-f-mail/>' +
                    '<span class="uau-err"><span data-e-mail></span></span>' +
                  '</label>' +
                  '<label class="uau-field">' +
                    '<span class="uau-label">Password</span>' +
                    '<input class="up-field uau-input" type="password" name="password" ' +
                      'placeholder="At least 8 characters" data-f-pw/>' +
                    '<span class="uau-err"><span data-e-pw></span></span>' +
                    '<span class="uau-strength" data-strength><div><span class="uau-strength-in">' +
                      '<span class="uau-bars">' +
                        '<span class="uau-bar"></span><span class="uau-bar"></span>' +
                        '<span class="uau-bar"></span><span class="uau-bar"></span>' +
                      '</span>' +
                      '<span class="uau-strength-txt" data-strength-txt></span>' +
                    '</span></div></span>' +
                  '</label>' +
                '</div>' +
                '<div class="uau-opts">' +
                  '<label class="uau-check"><input type="checkbox" checked data-check/>' +
                    '<span data-check-txt></span></label>' +
                  '<button class="uau-side" type="button" data-side></button>' +
                '</div>' +
                '<button class="uau-primary" type="button" data-primary>' +
                  '<span class="uau-spin"></span><span data-primary-txt></span></button>' +
                '<div class="uau-or"><span>or</span></div>' +
                '<button class="uau-google" type="button" data-google>' + G_SVG +
                  '<span>Continue with Google</span></button>' +
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
        '<div class="uau-panel"' + (bg ? ' style="background-image: linear-gradient(180deg, rgba(255,255,255,.5), rgba(255,255,255,.16) 60%), url(' + esc(bg).replace(/[()]/g, "") + ')"' : '') + '>' +
          '<h2 class="uau-panel-h">AI Search Analytics.<br>Made simple.</h2>' +
          '<p class="uau-panel-b">See in seconds how often AI Search recommends your brand.</p>' +
          '<div class="uau-prompt">' +
            '<span class="uau-prompt-t"><span data-ph></span></span>' +
            '<span class="uau-prompt-c">' +
              '<span class="uau-mic">' + MIC_SVG + '</span>' +
              '<span class="uau-send">' + UP_SVG + '</span>' +
            '</span>' +
          '</div>' +
          '<div class="uau-panel-f">upstreem · your AI visibility analyst</div>' +
        '</div>' +
      '</div>';
    }

    /* ---------------- Zeichnen ---------------- */
    function renderTexte(){
      var t = TEXTE[state.mode] || TEXTE.login;
      root.querySelector("[data-hallo]").textContent = t.hallo;
      elH1.textContent = t.h1;
      elSub.textContent = t.sub;
      elCheckTxt.textContent = t.check;
      /* Ein leerer side-Text heisst: es gibt hier nichts anzubieten. Der Knopf verschwindet dann
         ganz, statt als unsichtbare Klickflaeche stehen zu bleiben. */
      elSide.textContent = t.side;
      elSide.hidden = !t.side;
      elPrimTxt.textContent = state.busy ? t.ctaBusy : t.cta;
      elFootTxt.textContent = t.footTxt;
      elFootBtn.textContent = t.footLink;
      elNameWrap.classList.toggle("is-on", state.mode === "signup");
      /* Ein ausgeblendetes Feld darf nicht per Tabulator erreichbar bleiben. */
      elName.disabled = state.mode !== "signup";
    }

    function zeigeFehler(){
      [["name", elName], ["mail", elMail], ["pw", elPw]].forEach(function(p){
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

    function render(){ renderTexte(); zeigeFehler(); renderStaerke(); }

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

      state.errs = e;
      state.formErr = "";
      zeigeFehler();
      var erste = e.name ? elName : (e.mail ? elMail : (e.pw ? elPw : null));
      if (erste){ try { erste.focus(); } catch(x){} return false; }
      return true;
    }

    function absenden(){
      if (state.busy || state.done) return;
      if (!pruefe()) return;
      fire("data-submit-fn", "uauSubmit", {
        mode: state.mode,
        full_name: state.mode === "signup" ? String(elName.value || "").trim() : "",
        email: String(elMail.value || "").trim(),
        password: String(elPw.value || ""),
        opt_in: elCheck.checked ? "yes" : "no"
      });
      setBusy(true);
    }

    function setMode(m){
      m = (String(m || "").toLowerCase() === "signup") ? "signup" : "login";
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
      fire("data-mode-fn", "uauMode", { mode: neu });
    });
    elSide.addEventListener("click", function(){
      fire("data-side-fn", "uauSide", { mode: state.mode, email: String(elMail.value || "").trim() });
    });
    elPrimary.addEventListener("click", absenden);
    elGoogle.addEventListener("click", function(){
      if (state.busy || state.done) return;
      fire("data-google-fn", "uauGoogle", { mode: state.mode });
    });
    elPw.addEventListener("input", function(){
      renderStaerke();
      /* Einen angezeigten Fehler beim Tippen wieder wegnehmen: er bezieht sich auf den Stand von
         vorhin, und ihn stehen zu lassen, waehrend der Nutzer ihn gerade behebt, ist Meckern. */
      if (state.errs.pw){ delete state.errs.pw; zeigeFehler(); }
    });
    elMail.addEventListener("input", function(){ if (state.errs.mail){ delete state.errs.mail; zeigeFehler(); } });
    elName.addEventListener("input", function(){ if (state.errs.name){ delete state.errs.name; zeigeFehler(); } });
    /* Enter im Formular sendet ab -- der Standard bei jeder Anmeldemaske. */
    root.addEventListener("keydown", function(e){
      if (e.key !== "Enter") return;
      if (!e.target.closest || !e.target.closest(".uau-input")) return;
      e.preventDefault(); absenden();
    });

    /* Unter 900px stapeln die Spalten (siehe CSS). Ueber den Beobachter statt einer
       Media-Query, weil dieses Element in Bubble auch in einem schmalen Container liegen kann --
       dann sagt die Fensterbreite das Falsche. */
    function messeBreite(){ root.classList.toggle("is-narrow", root.clientWidth < 900); }
    messeBreite();
    if (UC.onResize) UC.onResize(root, messeBreite);
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

    setMode(attr("data-mode", "login") === "signup" ? "signup" : "login");
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
       460ms = 200ms Dauer + 180ms Versatz der letzten Stufe + Luft. */
    setTimeout(function(){ root.classList.remove("is-entering"); }, 460);

    return {
      root: root,
      setMode: function(m){ setMode(m); },
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
        else state.formErr = t || "Something went wrong. Please try again.";
        zeigeFehler();
        return true;
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
        elName.value = elMail.value = elPw.value = "";
        elCheck.checked = true;
        elPaneDone.classList.add("is-off");
        elPaneDone.setAttribute("aria-hidden", "true");
        elPaneForm.classList.remove("is-off");
        elPaneForm.removeAttribute("aria-hidden");
        render();
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
    var c = makeController(root);
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
  function doReset(id){ var c = resolve(id); return c ? c.reset() : false; }

  uauBoot(30);
})();
