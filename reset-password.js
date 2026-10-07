/* upstreem reset-password.js — das Ziel des Ruecksetzlinks: neues Passwort setzen (Praefix `urp`).
   Braucht core.js.

   ── Wozu ─────────────────────────────────────────────────────────────────
   Wer dem Link aus der Mail folgt, landet hier. Die Ueberschrift, zwei Felder (neues Passwort,
   bestaetigen), die Staerkeanzeige der Anmeldeseite, EIN Knopf -- kein Zeichen, kein Untertitel
   (07.10.: "subtil professionell"). Danach an derselben Stelle "Password updated" mit dem Knopf
   zur Anmeldung.

   ── Fehler ───────────────────────────────────────────────────────────────
   Was Supabase beim Setzen zurueckgibt, kommt ROH ueber setResetPasswordError und wird in core
   (UC.authFehler) zum Satz fuer den Nutzer, am richtigen Feld: gleiches Passwort wie vorher, zu
   schwach, in einem Datenleck bekannt, Link abgelaufen, Sitzung fehlt, zu viele Versuche, kein
   Netz -- und alles Unbekannte als allgemeiner Satz. Ein abgelaufener oder schon benutzter Link
   kommt von Supabase schon beim LADEN mit #error_code=otp_expired zurueck; dann steht der Weg zu
   einem neuen Link sofort da, nicht erst, nachdem jemand zweimal ein Passwort getippt hat.

   ── Nach aussen ─────────────────────────────────────────────────────────
     Ereignis   urpSubmit (data-submit-fn) -- ROHER Wert: das neue Passwort. Geprueft sind:
                vorhanden, mindestens 8 Zeichen, beide Felder gleich.
     setResetPasswordDone(INSTANCE[, titel, text])
     setResetPasswordError(INSTANCE, "<Fehler roh>")
   Rahmen, Felder, Knopf, Fehlerkasten und Thema kommen aus core (UC.makeEinzelseite).
   Einzelheiten und die Run-JS-Schritte: bubble/reset_password_bubble.html. */
(function(){
  "use strict";

  var BOOTQ = window.__urpBootQueue = window.__urpBootQueue || [];
  if (!window.__urpBootStubbed){
    window.__urpBootStubbed = true;
    ["setResetPasswordDone", "setResetPasswordError"].forEach(function(n){
      window[n] = function(){ BOOTQ.push([n, arguments]); };
    });
  }

  function urpBoot(triesLeft){
    if (!window.UpstreemCore){
      if (triesLeft > 0){ setTimeout(function(){ urpBoot(triesLeft - 1); }, 100); return; }
      if (window.console) console.error("UpstreemCore (core.js) not loaded");
      return;
    }
    urpRun();
  }

  var T = {
    h1:       "Set a new password",
    pw:       "New password",
    pwPh:     "At least 8 characters",
    pw2:      "Confirm password",
    cta:      "Reset password",
    ctaBusy:  "Resetting password",
    zurueck:  "Back to sign in",
    pwLeer:   "Please enter a new password.",
    pwKurz:   "At least 8 characters.",
    pw2Leer:  "Please repeat your new password.",
    pw2Ungl:  "The passwords do not match.",
    neuerLink: "Request a new link",
    doneH:    "Password updated",
    doneSub:  "Sign in with your new password.",
    doneCta:  "Sign in"
  };
  /* Dieselbe Regel wie beim Anlegen auf der Anmeldeseite: ein neues Passwort ist ein neues Passwort. */
  var MIN_LAENGE = 8;

  /* Je Instanz, was einen Neuaufbau ueberleben muss: ob das Passwort schon gesetzt ist. Die
     Passwoerter selbst NICHT -- die gehoeren in kein Fenster-Objekt. */
  var STORE = window.__urpStore = window.__urpStore || {};

  function makeController(root){
    var UC = window.UpstreemCore, esc = UC.esc;
    var MISSING = ["makeEinzelseite", "esKopfHtml", "esFeldHtml", "esKnopfHtml", "esFehlerHtml",
                   "esZurueckHtml", "esAttr", "adressParameter", "adressFehlerWeg", "authFehler",
                   "feuerRoh", "mailOk", "pwStaerkeHtml", "pwStaerkeZeigen"]
      .filter(function(k){ return typeof UC[k] !== "function"; });
    if (MISSING.length){
      if (window.console) console.error("[reset-password] Die core.js auf dieser Seite ist AELTER als " +
        "reset-password.js, es fehlen: " + MISSING.join(", ") + ". Alle Elemente auf denselben Commit pinnen.");
      return null;
    }
    var id = root.getAttribute("data-instance") || "default";
    var alt = STORE[id];
    var state = { fertig: !!(alt && alt.fertig) };
    function merken(){ STORE[id] = { fertig: state.fertig }; }

    var q = UC.adressParameter();
    var mail = String(q.email || q.mail || UC.esAttr(root, "data-email") || "").trim();
    if (!UC.mailOk(mail)) mail = "";
    var login  = UC.esAttr(root, "data-login-url", "/signup?mode=login");
    var forgot = UC.esAttr(root, "data-forgot-url", "/forgot-password");
    /* Der Weg zu einem neuen Link nimmt die Adresse mit, wenn die Seite sie kennt -- dann ist das
       Feld dort schon gefuellt. */
    var neuerLinkHref = forgot + (mail ? (forgot.indexOf("?") >= 0 ? "&" : "?") + "email=" + encodeURIComponent(mail) : "");

    var seite = UC.makeEinzelseite(root, {
      label: "reset-password",
      einzug: !alt,
      inhalt:
        UC.esKopfHtml({ titel: T.h1 }) +
        UC.esFehlerHtml() +
        '<form class="up-es-form" novalidate data-es-form>' +
          /* Ein verstecktes Benutzerfeld: ohne es weiss der Passwortverwalter nicht, ZU WELCHEM
             Konto das neue Passwort gehoert, und speichert es nicht oder beim falschen. Chrome
             warnt sonst "Password forms should have (optionally hidden) username fields". */
          '<input class="urp-user" type="email" name="username" autocomplete="username" tabindex="-1"' +
            ' aria-hidden="true" readonly value="' + esc(mail) + '"/>' +
          '<div class="up-es-felder" data-es-auf="2">' +
            UC.esFeldHtml({ name: "password", label: T.pw, typ: "password", auto: "new-password", ph: T.pwPh,
                            mehr: UC.pwStaerkeHtml() }) +
            UC.esFeldHtml({ name: "confirm", label: T.pw2, typ: "password", auto: "new-password" }) +
          '</div>' +
          UC.esKnopfHtml({ text: T.cta, textBusy: T.ctaBusy }) +
        '</form>' +
        UC.esZurueckHtml({ href: login, text: T.zurueck }),
      fertig:
        UC.esKopfHtml({ titel: T.doneH, text: T.doneSub }) +
        '<a class="up-btn-pri is-lg up-es-cta" href="' + esc(login) + '">' + esc(T.doneCta) + '</a>',
      onSenden: absenden
    });
    var pw = seite.q('[data-es-input="password"]'), pw2 = seite.q('[data-es-input="confirm"]');
    var staerke = seite.q("[data-es-staerke]");
    var errs = {};

    function zeige(formText, link){ seite.fehler(errs, formText || "", link || null); }

    /* ---------------- Pruefen und Absenden ---------------- */
    function absenden(){
      var p1 = String(pw.value || ""), p2 = String(pw2.value || "");
      errs = {};
      if (!p1) errs.password = T.pwLeer;
      else if (p1.length < MIN_LAENGE) errs.password = T.pwKurz;
      if (!p2) errs.confirm = T.pw2Leer;
      else if (p1 && p2 !== p1) errs.confirm = T.pw2Ungl;
      zeige();
      var erste = errs.password ? pw : (errs.confirm ? pw2 : null);
      if (erste){ try { erste.focus(); } catch(e){} return; }
      /* Das Passwort als ROHER Wert -- es darf jedes Zeichen enthalten, auch Anfuehrungszeichen,
         und die schnitten eine Regex-Extraktion aus einem JSON in Bubble mittendrin ab. */
      UC.feuerRoh(root, "data-submit-fn", "bubble_fn_urpSubmit", p1, "reset-password");
      seite.busy(true);
    }
    pw.addEventListener("input", function(){
      UC.pwStaerkeZeigen(staerke, pw.value);
      var vorher = !!(errs.password || errs.confirm);
      if (errs.password) delete errs.password;
      /* "Passt nicht" verschwindet, sobald beide wieder gleich sind -- egal, in welchem Feld
         korrigiert wird. */
      if (errs.confirm && pw2.value === pw.value) delete errs.confirm;
      if (vorher) zeige();
    });
    pw2.addEventListener("input", function(){
      if (errs.confirm && (!pw2.value || pw2.value === pw.value)){ delete errs.confirm; zeige(); }
    });

    function zeigeFertig(titel, text){
      seite.busy(false);
      state.fertig = true; merken();
      var p = seite.q('[data-es-pane="fertig"]');
      p.querySelector("[data-es-h1]").textContent = titel || T.doneH;
      p.querySelector("[data-es-sub]").textContent = text || T.doneSub;
      /* Die Passwoerter verlassen das Dokument, sobald sie gesetzt sind. */
      pw.value = ""; pw2.value = ""; UC.pwStaerkeZeigen(staerke, "");
      seite.fertig(true);
    }

    if (state.fertig) zeigeFertig();
    else {
      /* Ein abgelaufener oder schon benutzter Link: Supabase schickt den Browser mit den
         Fehlerangaben in der Adresse zurueck. Sofort zeigen, dann die Adresse bereinigen, damit
         ein Neuladen ihn nicht noch einmal zeigt. */
      if (q.error || q.error_code || q.error_description){
        var f0 = UC.authFehler(String(q.error_code || "") + " " + String(q.error_description || q.error || ""), "reset");
        zeige(f0.text, f0.aktion === "neuerLink" ? { text: T.neuerLink, href: neuerLinkHref } : null);
        UC.adressFehlerWeg();
      }
    }

    return {
      root: root,
      setDone: function(titel, text){
        zeigeFertig(titel ? String(titel) : "", text ? String(text) : "");
        return true;
      },
      setError: function(roh){
        seite.busy(false);
        if (state.fertig){ state.fertig = false; merken(); seite.fertig(false); }
        var f = UC.authFehler(roh, "reset");
        /* Eine Serverantwort ersetzt die vorige ganz: ein Feldfehler vom letzten Versuch stuende
           sonst neben dem neuen Satz und widerspraeche ihm. */
        errs = {};
        if (f.feld === "password"){ errs.password = f.text; zeige(); try { pw.focus(); } catch(e){} }
        else zeige(f.text, f.aktion === "neuerLink" ? { text: T.neuerLink, href: neuerLinkHref } : null);
        return true;
      }
    };
  }

  var mount = null;
  function urpRun(){
    mount = window.UpstreemCore.makeMount({
      onMount: function(m){ mount = m; },
      rootClass: "urp-root", notPortal: true,
      ctrlProp: "__urpController", resolveLocal: "__urpResolveLocal", queue: "__urpBootQueue",
      initRoot: initRootNow,
      api: {
        setResetPasswordDone: doDone,
        setResetPasswordError: doError
      }
    });
  }
  function resolve(id){
    id = String(id || "").trim();
    var r = mount ? mount.rootsWithId(id) : rootsById(id);
    if (!r.length) return null;
    return r[0].__urpController || initRootNow(r[0]);
  }
  function rootsById(id){
    var out = [], all = document.querySelectorAll(".urp-root");
    for (var i = 0; i < all.length; i++){
      if ((all[i].getAttribute("data-instance") || "default") === id) out.push(all[i]);
    }
    return out;
  }
  function initRootNow(root){
    if (root.__urpController) return root.__urpController;
    if ((root.getAttribute("data-instance") || "default") === "INSTANCE_ID") return null;
    var c = makeController(root);
    root.__urpController = c;
    return c;
  }
  function doDone(id, titel, text){ var c = resolve(id); return c ? c.setDone(titel, text) : false; }
  function doError(id, roh){ var c = resolve(id); return c ? c.setError(roh) : false; }

  urpBoot(30);
})();
