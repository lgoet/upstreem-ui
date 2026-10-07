/* upstreem forgot-password.js — Passwort vergessen: Adresse eingeben, Ruecksetzlink anfordern
   (Praefix `ufp`). Braucht core.js.

   ── Wozu ─────────────────────────────────────────────────────────────────
   Aufgebaut wie die Seiten von Linear, Vercel und Notion: eine Ueberschrift, ein Satz, EIN Feld,
   EIN Knopf, darunter leise der Weg zurueck. Danach an derselben Stelle die Bestaetigung mit
   "Resend link" -- und die ist NEUTRAL, ob es das Konto gibt oder nicht. Sonst liesse sich mit
   dieser Seite pruefen, welche Adressen bei upstreem ein Konto haben (Account Enumeration).
   Supabase verschickt ohnehin nur an bestehende Konten.

   ── Nach aussen ─────────────────────────────────────────────────────────
     Ereignis   ufpSubmit (data-submit-fn) -- ROHER Wert: die Adresse, geprueft und getrimmt.
                Feuert beim Absenden und bei "Resend link".
     setForgotPasswordDone(INSTANCE[, titel, text])   der Link ist verschickt
     setForgotPasswordError(INSTANCE, "<Fehler roh>")  der Fehler, wie Supabase ihn liefert
   Die Adresse kann aus ?email= kommen (der Link "Forgot password?" der Anmeldeseite reicht sie
   weiter). Rahmen, Feld, Knopf, Fehlerkasten und Thema kommen aus core (UC.makeEinzelseite).
   Einzelheiten und die Run-JS-Schritte: bubble/forgot_password_bubble.html. */
(function(){
  "use strict";

  /* Bubble kann die Setter rufen, bevor diese Datei vom CDN da ist. Ohne Stubs wirft der Aufruf
     "is not a function" und reisst den ganzen Run-JavaScript-Schritt mit. */
  var BOOTQ = window.__ufpBootQueue = window.__ufpBootQueue || [];
  if (!window.__ufpBootStubbed){
    window.__ufpBootStubbed = true;
    ["setForgotPasswordDone", "setForgotPasswordError"].forEach(function(n){
      window[n] = function(){ BOOTQ.push([n, arguments]); };
    });
  }

  function ufpBoot(triesLeft){
    if (!window.UpstreemCore){
      if (triesLeft > 0){ setTimeout(function(){ ufpBoot(triesLeft - 1); }, 100); return; }
      if (window.console) console.error("UpstreemCore (core.js) not loaded");
      return;
    }
    ufpRun();
  }

  var T = {
    h1:       "Forgot your password?",
    sub:      "Enter your email and we’ll send you a link to reset your password.",
    label:    "Work email",
    ph:       "alex@company.com",
    cta:      "Send reset link",
    ctaBusy:  "Sending link",
    zurueck:  "Back to sign in",
    leer:     "Please enter your email address.",
    form:     "That does not look like an email address.",
    doneH:    "Check your email",
    doneMit:  "If an account exists for {mail}, you’ll get a link to reset your password.",
    doneOhne: "If an account exists for this email, you’ll get a link to reset your password.",
    nicht:    "Didn’t get it?",
    wieder:   "Resend link",
    wiederIn: "Resend in {s}s",
    sendet:   "Sending…"
  };
  /* Supabase schickt denselben Link hoechstens einmal je Minute an dieselbe Adresse. Der Knopf
     wartet genau so lange -- ein frueherer Klick waere einer, den der Server abweist. */
  var WIEDER_S = 60;

  /* Je Instanz, was einen Neuaufbau ueberleben muss (Bubble baut ein Element beim Themenwechsel
     neu, wenn ein dynamischer Wert daran haengt): verschickt oder nicht, an wen, und bis wann
     "Resend" wartet. Ohne das stuende nach dem Umschalten wieder das leere Formular da. */
  var STORE = window.__ufpStore = window.__ufpStore || {};

  function makeController(root){
    var UC = window.UpstreemCore, esc = UC.esc;
    var MISSING = ["makeEinzelseite", "esKopfHtml", "esFeldHtml", "esKnopfHtml", "esFehlerHtml",
                   "esZurueckHtml", "esAttr", "adressParameter", "authFehler", "feuerRoh", "mailOk"]
      .filter(function(k){ return typeof UC[k] !== "function"; });
    if (MISSING.length){
      if (window.console) console.error("[forgot-password] Die core.js auf dieser Seite ist AELTER als " +
        "forgot-password.js, es fehlen: " + MISSING.join(", ") + ". Alle Elemente auf denselben Commit pinnen.");
      return null;
    }
    var id = root.getAttribute("data-instance") || "default";
    var alt = STORE[id];
    var state = alt ? { mail: alt.mail, fertig: alt.fertig, wiederBis: alt.wiederBis }
                    : { mail: "", fertig: false, wiederBis: 0 };
    function merken(){ STORE[id] = { mail: state.mail, fertig: state.fertig, wiederBis: state.wiederBis }; }
    if (!alt){
      var q = UC.adressParameter();
      var vor = String(q.email || q.mail || UC.esAttr(root, "data-email") || "").trim();
      state.mail = UC.mailOk(vor) ? vor : "";
    }
    var login = UC.esAttr(root, "data-login-url", "/signup?mode=login");
    var wiederUhr = null;

    var seite = UC.makeEinzelseite(root, {
      label: "forgot-password",
      einzug: !alt,
      inhalt:
        UC.esKopfHtml({ icon: "lock", titel: T.h1, text: T.sub }) +
        UC.esFehlerHtml() +
        /* Ein echtes <form>: Enter loest aus, und der Passwortverwalter erkennt das Feld. */
        '<form class="up-es-form" novalidate data-es-form>' +
          '<div class="up-es-felder" data-es-auf="2">' +
            UC.esFeldHtml({ name: "email", label: T.label, typ: "email", auto: "email", ph: T.ph }) +
          '</div>' +
          UC.esKnopfHtml({ text: T.cta, textBusy: T.ctaBusy }) +
        '</form>' +
        UC.esZurueckHtml({ href: login, text: T.zurueck }),
      fertig:
        UC.esKopfHtml({ icon: "mail", titel: T.doneH, text: "", auf: 1 }) +
        '<p class="up-es-hinweis ufp-wieder"><span>' + esc(T.nicht) + '</span>' +
          '<button type="button" class="ufp-wiederknopf" data-ufp-wieder></button></p>' +
        UC.esZurueckHtml({ href: login, text: T.zurueck }),
      onSenden: absenden,
      /* Die Notbremse nach einem "Resend": ihr Satz steht im Fehlerkasten des FORMULARS, und das
         liegt dann verdeckt unter der Bestaetigung. Also zurueck dorthin, wo er zu lesen ist. */
      onBremse: zurueckInsFormular
    });
    var feld = seite.q('[data-es-input="email"]');
    var knopfWieder = seite.q("[data-ufp-wieder]");
    if (state.mail) feld.value = state.mail;

    /* ---------------- Pruefen und Absenden ---------------- */
    function absenden(){
      var m = String(feld.value || "").trim();
      var fehlt = !m ? T.leer : (!UC.mailOk(m) ? T.form : "");
      seite.fehler(fehlt ? { email: fehlt } : null, "");
      if (fehlt){ try { feld.focus(); } catch(e){} return; }
      state.mail = m; merken();
      /* Die Adresse als ROHER Wert: in Bubble ist "This JavaScriptToBubble's value" dann schon die
         Adresse, ohne Auslesen. */
      UC.feuerRoh(root, "data-submit-fn", "bubble_fn_ufpSubmit", m, "forgot-password");
      seite.busy(true);
      wiederZeigen();
    }
    feld.addEventListener("input", function(){
      if (seite.q('[data-es-feld="email"]').classList.contains("is-err")) seite.fehler(null, "");
    });

    /* ---------------- Erneut senden ---------------- */
    function wiederZeigen(){
      var rest = Math.ceil((state.wiederBis - Date.now()) / 1000);
      if (seite.istBusy() && seite.istFertig()){ knopfWieder.textContent = T.sendet; knopfWieder.disabled = true; return; }
      if (rest > 0){ knopfWieder.textContent = T.wiederIn.replace("{s}", rest); knopfWieder.disabled = true; return; }
      knopfWieder.textContent = T.wieder; knopfWieder.disabled = false;
      if (wiederUhr){ clearInterval(wiederUhr); wiederUhr = null; }
    }
    function wiederStarten(){
      if (wiederUhr) clearInterval(wiederUhr);
      wiederUhr = setInterval(wiederZeigen, 1000);
      wiederZeigen();
    }
    knopfWieder.addEventListener("click", function(){
      if (knopfWieder.disabled || !state.mail) return;
      UC.feuerRoh(root, "data-submit-fn", "bubble_fn_ufpSubmit", state.mail, "forgot-password");
      seite.busy(true);
      wiederZeigen();
    });

    function zeigeFertig(titel, text){
      seite.busy(false);
      var erstesMal = !state.fertig;
      state.fertig = true;
      /* Die Wartezeit laeuft ab dem Verschicken -- auch nach einem "Resend". */
      state.wiederBis = Date.now() + WIEDER_S * 1000;
      merken();
      var p = seite.q('[data-es-pane="fertig"]');
      p.querySelector("[data-es-h1]").textContent = titel || T.doneH;
      p.querySelector("[data-es-sub]").textContent = text ||
        (state.mail ? T.doneMit.replace("{mail}", state.mail) : T.doneOhne);
      if (erstesMal) seite.fertig(true);
      wiederStarten();
    }

    function zurueckInsFormular(){
      if (!state.fertig) return;
      state.fertig = false; merken();
      seite.fertig(false);
      if (wiederUhr){ clearInterval(wiederUhr); wiederUhr = null; }
    }

    /* Der Neuaufbau eines schon verschickten Zustands: gleich die Bestaetigung, mit der Uhr, wo sie
       stand. */
    if (state.fertig){
      var bis = state.wiederBis;
      state.fertig = false;
      zeigeFertig();
      state.wiederBis = bis; merken(); wiederZeigen();
    }

    return {
      root: root,
      setDone: function(titel, text){
        zeigeFertig(titel ? String(titel) : "", text ? String(text) : "");
        return true;
      },
      setError: function(roh){
        var f = UC.authFehler(roh, "forgot");
        /* NIE verraten, ob es das Konto gibt: "user not found" wird dieselbe Bestaetigung wie ein
           Erfolg. */
        if (f.unbekannt){ zeigeFertig(); return true; }
        seite.busy(false);
        /* Kam der Fehler nach einem "Resend", steht die Bestaetigung noch da. Der Satz gehoert dann
           dorthin, wo jemand hinsieht: zurueck ins Formular, mit der Adresse im Feld. */
        zurueckInsFormular();
        if (f.feld === "email") seite.fehler({ email: f.text }, "");
        else seite.fehler(null, f.text);
        return true;
      }
    };
  }

  var mount = null;
  function ufpRun(){
    mount = window.UpstreemCore.makeMount({
      onMount: function(m){ mount = m; },
      rootClass: "ufp-root", notPortal: true,
      ctrlProp: "__ufpController", resolveLocal: "__ufpResolveLocal", queue: "__ufpBootQueue",
      initRoot: initRootNow,
      api: {
        setForgotPasswordDone: doDone,
        setForgotPasswordError: doError
      }
    });
  }
  function resolve(id){
    id = String(id || "").trim();
    var r = mount ? mount.rootsWithId(id) : rootsById(id);
    if (!r.length) return null;
    return r[0].__ufpController || initRootNow(r[0]);
  }
  function rootsById(id){
    var out = [], all = document.querySelectorAll(".ufp-root");
    for (var i = 0; i < all.length; i++){
      if ((all[i].getAttribute("data-instance") || "default") === id) out.push(all[i]);
    }
    return out;
  }
  function initRootNow(root){
    if (root.__ufpController) return root.__ufpController;
    if ((root.getAttribute("data-instance") || "default") === "INSTANCE_ID") return null;
    var c = makeController(root);
    root.__ufpController = c;
    return c;
  }
  function doDone(id, titel, text){ var c = resolve(id); return c ? c.setDone(titel, text) : false; }
  function doError(id, roh){ var c = resolve(id); return c ? c.setError(roh) : false; }

  ufpBoot(30);
})();
