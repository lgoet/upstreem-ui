/* upstreem oauth-consent.js — die Zustimmungsseite fuer MCP-Clients (Praefix `uoc`). Braucht core.js.

   ── Wozu diese Seite da ist ─────────────────────────────────────────────
   Wer upstreem in Claude, ChatGPT oder Cursor verbindet, landet hier (Supabase-OAuth-Server: Site URL +
   /oauth/consent?authorization_id=...). Die Seite hat genau eine Aufgabe: sagen, WER Zugriff will, WAS er
   damit darf und WOHIN es danach geht -- und erst dann um Zustimmung bitten. Anforderungen aus der
   Sicherheitspruefung 22.10. (MCP-Spezifikation "Security Best Practices", RFC 7591 5, ASVS 10.7):
     - der Name des Clients ist selbst angegeben (dynamische Registrierung) und steht darum als
       "Unverified app" da; KEIN Logo des Clients -- ein frei gewaehltes Bild waere die einfachste
       Faelschung ("Claude" mit Claude-Logo),
     - der Host der Ruecksprungadresse steht gross, bei localhost/127.0.0.1 als "an app on this computer",
     - in Klartext, was der Zugriff kann (lesen) und was nicht (nichts aendern),
     - das angemeldete Konto mit "Not you?", Cancel gleichrangig sichtbar.
   Aufbau und Masse WORTGLEICH zur Einladungsseite (invite-page.css): dieselbe Spalte, Kachel, Ueberschrift,
   Knoepfe und Kontozeile -- wer von der Anmeldung kommt, soll keinen Pixel springen sehen.

   ── Wer entscheidet was ─────────────────────────────────────────────────
   Die Seite der App (upstreem-app, app/oauth/consent) holt die Anfrage bei Supabase Auth
   (getAuthorizationDetails), reicht sie an setOAuthConsent und fuehrt die Klicks aus (approve/deny,
   dann Weiterleitung). Diese Datei zeigt nur an und meldet Klicks.

   ── Die Zustaende ───────────────────────────────────────────────────────
     loading   bis die Anfrage da ist: ein Skelett, das nach 15s aufgibt
     ready     die Anfrage gilt: Allow access / Cancel
     error     die Anfrage gilt nicht: der Satz und der Weg hinaus ("Back to upstreem")
   Ein Klick setzt busy ("allow"/"deny"): der Ring aus core im Knopf, beide Knoepfe gesperrt, bis die App
   weiterleitet; nach 15s ohne Weiterleitung der Fehlerzustand.

   ── Nach aussen ─────────────────────────────────────────────────────────
     setOAuthConsent(INSTANCE, {client_name, redirect_uri, email} | {error})
     setOAuthConsentError(INSTANCE, "Meldung")
     resetOAuthConsent(INSTANCE)
   Ereignisse (je ein Element, bubble_fn_*): uocAllow  uocDeny  uocSwitch  uocHome */
(function(){
  "use strict";

  /* Die App kann die Setter rufen, bevor diese Datei da ist (wie invite-page.js). */
  var BOOTQ = window.__uocBootQueue = window.__uocBootQueue || [];
  if (!window.__uocBootStubbed){
    window.__uocBootStubbed = true;
    ["setOAuthConsent", "setOAuthConsentError", "resetOAuthConsent"].forEach(function(n){
      window[n] = function(){ BOOTQ.push([n, arguments]); };
    });
  }

  function uocBoot(triesLeft){
    if (!window.UpstreemCore){
      if (triesLeft > 0){ setTimeout(function(){ uocBoot(triesLeft - 1); }, 100); return; }
      if (window.console) console.error("UpstreemCore (core.js) not loaded");
      return;
    }
    uocRun();
  }

  /* Englisch wie jede sichtbare Beschriftung; Deutsch setzt der Katalog von core ein. */
  var T = {
    eyebrow:     "Authorize access",
    unverified:  "Unverified app",
    wants:       "wants to access your upstreem account",
    can:         "Read your brands, prompts, sources, AI responses and Opportunities in all teams you belong to",
    cannot:      "Create, change or delete anything",
    weiter:      "After you allow access, you will be sent to",
    lokal:       "an app on this computer",
    allow:       "Allow access",
    deny:        "Cancel",
    signedInAs:  "Signed in as",
    notYou:      "Not you?",
    home:        "Back to upstreem",
    ohneAntrag:  "This request can’t be used",
    laden:       "Loading",
    laedtNicht:  "We could not load this request. Please connect again from your app.",
    unlesbar:    "We could not read this request. Please connect again from your app.",
    dauert:      "This is taking longer than expected. Please connect again from your app.",
    ersatzName:  "An app"
  };

  /* Ein Ladezustand muss IMMER enden (CLAUDE.md 2). Werte wie auf der Einladungsseite. */
  var LADEN_MAX = 15000;
  var KNOPF_MAX = 15000;
  var EINZUG_MS = 1100;

  var STORE = (window.__uocStore = window.__uocStore || {});

  function makeController(root){
    var UC = window.UpstreemCore;
    var esc = UC.esc;
    var fire = UC.makeFire(root, { label: "oauth-consent", eventPrefix: "uoc" });
    function ic(name, w){ return UC.icon ? UC.icon(name, w || 2) : ""; }
    function str(v){ return v == null ? "" : String(v).trim(); }

    var instanceId = String(root.getAttribute("data-instance") || "default");
    var gemerkt = STORE[instanceId] || {};
    var state = {
      phase: (gemerkt.phase === "ready" || gemerkt.phase === "error") ? gemerkt.phase : "loading",
      data: gemerkt.data || null,
      err: gemerkt.err || "",
      busy: ""
    };
    function merken(){ STORE[instanceId] = { phase: state.phase, data: state.data, err: state.err }; }
    var uhrLaden = null, uhrKnopf = null, uhrEinzug = null;
    var ersterAuftritt = state.phase === "loading";

    /* ---------------- Thema (wie invite-page.js) ---------------- */
    function istDunkel(){
      if (root.getAttribute("data-theme") === "dark") return true;
      try {
        var g = localStorage.getItem("pref_theme");
        if (g === "dark") return true;
        if (g === "light") return false;
      } catch(e){}
      try { return !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches); }
      catch(e){ return false; }
    }
    function logoAdresse(){
      var d = istDunkel();
      return (d && root.getAttribute("data-logo-dark")) || root.getAttribute("data-logo") || (UC.wortmarke ? UC.wortmarke(d) : "");
    }
    function syncTheme(){
      var d = istDunkel();
      if (d) root.setAttribute("data-theme", "dark"); else root.removeAttribute("data-theme");
      var b = root.querySelector("[data-theme-btn]");
      if (b){
        b.innerHTML = d ? ic("sun", 2) : ic("moon", 2);
        b.setAttribute("aria-label", d ? "Switch to light mode" : "Switch to dark mode");
      }
      var neu = logoAdresse();
      root.querySelectorAll("img[data-upstreem-logo]").forEach(function(l){
        if (neu && l.getAttribute("src") !== neu) l.setAttribute("src", neu);
      });
    }

    /* ---------------- Aufbau ---------------- */
    function shell(){
      var src = logoAdresse();
      return '' +
        '<header class="uoc-top">' +
          (src ? '<img class="uoc-logo" data-upstreem-logo src="' + esc(src) + '" alt="upstreem" ' +
                 'onerror="this.replaceWith(Object.assign(document.createElement(\'span\'),{className:\'uoc-logo\'}))"/>'
               : '<span class="uoc-logo"></span>') +
          '<button class="up-iconbtn uoc-themebtn" type="button" data-theme-btn aria-label="Switch theme"></button>' +
        '</header>' +
        '<main class="uoc-mid">' +
          '<div class="uoc-stage">' +
            '<section class="uoc-pane uoc-skel" data-pane="loading" aria-hidden="true">' +
              '<span class="up-tsk-bar uoc-sk-eyebrow"></span>' +
              '<span class="up-tsk-logo uoc-sk-logo"></span>' +
              '<span class="up-tsk-bar uoc-sk-name"></span>' +
              '<span class="up-tsk-bar uoc-sk-list"></span>' +
              '<span class="up-tsk-bar uoc-sk-cta"></span>' +
            '</section>' +
            '<section class="uoc-pane uoc-main" data-pane="consent">' +
              '<p class="uoc-eyebrow" data-eyebrow></p>' +
              '<div class="uoc-brand">' +
                '<span class="uoc-brand-logo" data-brand-logo></span>' +
                '<h1 class="uoc-brand-name" data-brand-name></h1>' +
              '</div>' +
              '<p class="uoc-ctx" data-ctx></p>' +
              '<ul class="uoc-list" data-list></ul>' +
              '<p class="uoc-dest" data-dest></p>' +
              '<div class="uoc-act">' +
                '<p class="uoc-errmsg" data-err role="alert" hidden></p>' +
                '<div class="uoc-actions">' +
                  '<button class="up-btn-pri is-lg uoc-cta" type="button" data-cta>' +
                    '<span class="uoc-cta-t" data-cta-t></span><span class="uoc-ring" data-ring="allow"></span>' +
                  '</button>' +
                  '<button class="up-btn-sec is-lg uoc-cta2" type="button" data-cta2>' +
                    '<span data-cta2-t></span><span class="uoc-ring" data-ring="deny"></span>' +
                  '</button>' +
                '</div>' +
              '</div>' +
              '<p class="uoc-who" data-who></p>' +
            '</section>' +
          '</div>' +
        '</main>';
    }

    root.innerHTML = shell();
    var elEyebrow = root.querySelector("[data-eyebrow]");
    var elLogo    = root.querySelector("[data-brand-logo]");
    var elName    = root.querySelector("[data-brand-name]");
    var elCtx     = root.querySelector("[data-ctx]");
    var elList    = root.querySelector("[data-list]");
    var elDest    = root.querySelector("[data-dest]");
    var elErr     = root.querySelector("[data-err]");
    var elCta     = root.querySelector("[data-cta]");
    var elCtaT    = root.querySelector("[data-cta-t]");
    var elCta2    = root.querySelector("[data-cta2]");
    var elCta2T   = root.querySelector("[data-cta2-t]");
    var elWho     = root.querySelector("[data-who]");
    /* Der Ring aus core, im Knopf neben der Beschriftung (22.10.: nie ein eigener Spinner). */
    root.querySelectorAll("[data-ring]").forEach(function(r){ r.innerHTML = UC.ringHtml ? UC.ringHtml(14) : ""; });

    /* Wohin es nach der Zustimmung geht: der Host, nie die ganze Adresse (Pfad und Abfrage sagen dem Nutzer
       nichts). localhost/127.0.0.1/[::1] heisst: eine Anwendung auf diesem Rechner (Claude Code, Cursor). */
    function ziel(uri){
      try {
        var u = new URL(uri);
        var lokal = /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(u.hostname);
        return { host: u.host, lokal: lokal };
      } catch (e) { return { host: "", lokal: false }; }
    }

    function render(){
      merken();
      var d = state.data || {};
      var fehler = state.phase === "error";
      root.setAttribute("data-phase", state.phase);
      var flaeche = state.phase === "loading" ? "loading" : "consent";
      root.querySelectorAll("[data-pane]").forEach(function(p){
        var an = p.getAttribute("data-pane") === flaeche;
        p.classList.toggle("is-an", an);
        if (an) p.removeAttribute("aria-hidden"); else p.setAttribute("aria-hidden", "true");
      });
      if (flaeche !== "consent") return;

      var name = str(d.client_name);
      /* Kachel: der Anfangsbuchstabe des Clients, nie sein Bild (siehe oben). */
      var buchstabe = (name || T.ersatzName).charAt(0).toUpperCase();
      if (elLogo.__uocKey !== buchstabe){
        elLogo.__uocKey = buchstabe;
        elLogo.innerHTML = '<span class="uoc-brand-ltr">' + esc(buchstabe) + '</span>';
      }
      elLogo.hidden = fehler;
      if (fehler && !name){
        elEyebrow.hidden = true;
        elName.textContent = T.ohneAntrag;
        elName.classList.add("is-klein");
      } else {
        elEyebrow.hidden = false;
        elEyebrow.textContent = T.eyebrow;
        elName.textContent = name || T.ersatzName;
        elName.classList.remove("is-klein");
      }

      /* "Unverified app" als Chip, dahinter der Satz -- je ein Element, damit der Katalog uebersetzt. */
      var ctx = fehler ? "" :
        '<span class="up-entchip is-static uoc-chip"><span class="uoc-chiplbl">' + T.unverified + '</span></span>' +
        '<span>' + T.wants + '</span>';
      if (elCtx.__uocHtml !== ctx){ elCtx.__uocHtml = ctx; elCtx.innerHTML = ctx; }
      elCtx.hidden = !ctx;

      var liste = fehler ? "" :
        '<li class="uoc-li is-ja"><span class="uoc-li-ic">' + ic("check", 2) + '</span><span>' + T.can + '</span></li>' +
        '<li class="uoc-li is-nein"><span class="uoc-li-ic">' + ic("x", 2) + '</span><span>' + T.cannot + '</span></li>';
      if (elList.__uocHtml !== liste){ elList.__uocHtml = liste; elList.innerHTML = liste; }
      elList.hidden = !liste;

      var z = ziel(d.redirect_uri);
      var dest = (fehler || !z.host) ? "" :
        '<span>' + T.weiter + '</span><b>' + (z.lokal ? '<span>' + T.lokal + '</span> (' + esc(z.host) + ')' : esc(z.host)) + '</b>';
      if (elDest.__uocHtml !== dest){ elDest.__uocHtml = dest; elDest.innerHTML = dest; }
      elDest.hidden = !dest;

      elErr.textContent = state.err || "";
      elErr.hidden = !state.err;

      /* Gueltig: Allow access und Cancel. Fehler: EIN Weg hinaus. */
      elCta.setAttribute("data-was", fehler ? "home" : "allow");
      elCtaT.textContent = fehler ? T.home : T.allow;
      elCta2.hidden = fehler;
      elCta2T.textContent = T.deny;

      var mail = str(d.email) || str(UC.sitzungInfo && UC.sitzungInfo() && UC.sitzungInfo().email);
      if (mail){
        var who = '<span>' + T.signedInAs + '</span><b>' + esc(mail) + '</b>' +
          '<button class="uoc-notyou" type="button" data-act="switch">' + T.notYou + '</button>';
        if (elWho.__uocHtml !== who){ elWho.__uocHtml = who; elWho.innerHTML = who; }
        elWho.hidden = false;
      } else {
        elWho.__uocHtml = ""; elWho.innerHTML = ""; elWho.hidden = true;
      }

      /* aria-disabled statt disabled, wie auf der Einladungsseite: der Core-Knopf dimmt bei :disabled. */
      var gesperrt = !!state.busy;
      elCta.classList.toggle("is-busy", state.busy === "allow");
      elCta2.classList.toggle("is-busy", state.busy === "deny");
      [elCta, elCta2].forEach(function(b){
        b.setAttribute("aria-disabled", gesperrt ? "true" : "false");
        b.setAttribute("aria-busy", gesperrt ? "true" : "false");
      });
    }

    function auftritt(){
      if (!ersterAuftritt) return;
      ersterAuftritt = false;
      root.classList.add("is-entering");
      if (uhrEinzug) clearTimeout(uhrEinzug);
      uhrEinzug = setTimeout(function(){ uhrEinzug = null; root.classList.remove("is-entering"); }, EINZUG_MS);
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
    function knopfUhr(){
      if (uhrKnopf) clearTimeout(uhrKnopf);
      uhrKnopf = setTimeout(function(){
        uhrKnopf = null;
        if (!state.busy) return;
        state.busy = ""; state.phase = "error"; state.err = T.dauert;
        render();
      }, KNOPF_MAX);
    }

    /* ---------------- Handlungen ---------------- */
    var EREIGNIS = { allow: "uocAllow", deny: "uocDeny", "switch": "uocSwitch", home: "uocHome" };
    function melden(was){ return fire("data-" + was + "-fn", EREIGNIS[was], { action: was }); }

    elCta.addEventListener("click", function(){
      if (state.busy) return;
      var was = elCta.getAttribute("data-was");
      if (was === "allow"){ state.busy = "allow"; render(); knopfUhr(); }
      melden(was);
    });
    elCta2.addEventListener("click", function(){
      if (state.busy || state.phase !== "ready") return;
      state.busy = "deny"; render(); knopfUhr();
      melden("deny");
    });
    root.addEventListener("click", function(e){
      var b = e.target && e.target.closest ? e.target.closest("[data-act]") : null;
      if (!b || !root.contains(b) || state.busy) return;
      melden(b.getAttribute("data-act"));
    });
    root.querySelector("[data-theme-btn]").addEventListener("click", function(){
      var neuDunkel = !istDunkel();
      if (UC.setUpstreemTheme) UC.setUpstreemTheme(neuDunkel ? "dark" : "light");
      else if (neuDunkel) root.setAttribute("data-theme", "dark"); else root.removeAttribute("data-theme");
      syncTheme();
    });
    if (UC.onTheme) UC.onTheme(syncTheme);

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
    if (state.phase === "loading") ladenStellen();

    return {
      root: root,
      setData: function(raw){
        var p = (raw && typeof raw === "object") ? raw : (UC.readBubble ? UC.readBubble(raw) : null);
        if (Array.isArray(p)) p = p[0];
        if (uhrLaden){ clearTimeout(uhrLaden); uhrLaden = null; }
        if (uhrKnopf){ clearTimeout(uhrKnopf); uhrKnopf = null; }
        state.busy = "";
        if (!p || typeof p !== "object"){
          state.phase = "error"; state.err = T.unlesbar; state.data = null;
        } else if (str(p.error)){
          state.phase = "error"; state.err = str(p.error);
          state.data = { client_name: str(p.client_name), redirect_uri: "", email: str(p.email) };
        } else {
          state.phase = "ready"; state.err = "";
          state.data = { client_name: str(p.client_name), redirect_uri: str(p.redirect_uri), email: str(p.email) };
        }
        auftritt(); render();
        return true;
      },
      setError: function(text){
        if (uhrLaden){ clearTimeout(uhrLaden); uhrLaden = null; }
        if (uhrKnopf){ clearTimeout(uhrKnopf); uhrKnopf = null; }
        state.busy = ""; state.phase = "error"; state.err = str(text) || T.laedtNicht;
        auftritt(); render();
        return true;
      },
      reset: function(){
        if (uhrKnopf){ clearTimeout(uhrKnopf); uhrKnopf = null; }
        state = { phase: "loading", data: null, err: "", busy: "" };
        ersterAuftritt = true;
        render(); ladenStellen();
        return true;
      }
    };
  }

  /* ---------------- Instanzen: makeMount aus core, wie invite-page.js ---------------- */
  var mount = null;
  function uocRun(){
    mount = window.UpstreemCore.makeMount({
      onMount: function(m){ mount = m; },
      rootClass: "uoc-root", notPortal: true,
      ctrlProp: "__uocController", resolveLocal: "__uocResolveLocal", queue: "__uocBootQueue",
      initRoot: initRootNow,
      api: {
        setOAuthConsent: function(id, raw){ var c = resolve(id); return c ? c.setData(raw) : false; },
        setOAuthConsentError: function(id, text){ var c = resolve(id); return c ? c.setError(text) : false; },
        resetOAuthConsent: function(id){ var c = resolve(id); return c ? c.reset() : false; }
      },
      forwardShape: { resetOAuthConsent: "id" }
    });
  }
  function resolve(id){
    id = String(id || "").trim();
    var r = mount ? mount.rootsWithId(id) : [];
    if (!r.length) return null;
    return r[0].__uocController || initRootNow(r[0]);
  }
  function initRootNow(root){
    if (root.__uocController) return root.__uocController;
    if ((root.getAttribute("data-instance") || "default") === "INSTANCE_ID") return null;
    var c = makeController(root);
    root.__uocController = c;
    return c;
  }

  uocBoot(30);
})();
