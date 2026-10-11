/* upstreem settings-page.js -- die Seite Settings als EINE Komponente (11.10.). Praefix uss.

   Kopf mit Krumen und drei Reitern (Your Brand, Team Organisation, Billing), darunter der Baustein
   des Reiters. Die Bausteine sind die ECHTEN der App im lokalen Modus (settings-brand.js,
   team-orga.js, settings-billing.js): ihre Ereignisse kommen als DOM-Ereignis hierher statt an
   Bubble, und diese Seite fuellt sie ueber ihre eigenen Setter. Dieselben Bausteine ohne
   data-local arbeiten unveraendert weiter ueber Bubble.

   DATEN: direkt ueber UC.rpc und UC.edge (Nutzer-JWT). Namen, Anfragen und Antwortformen in
   settings-data.js (ohne DOM). VERLINKT WIRD SCHRITT FUER SCHRITT (Auftrag
   bubble/settings_db_auftrag.md, Abschnitt 7): jede Funktion hat dort ihren eigenen Schalter.
   Was noch nicht verlinkt ist, sagt es sichtbar -- nie ein Knopf, der still nichts tut.

   SORGFALT BEIM SCHREIBEN (der Bereich, in dem nichts zurueckzuholen ist):
   - Erfolg erst nach der Antwort der Datenbank, Fehler als Satz, nie still.
   - Je Bereich EIN Schreibvorgang zur Zeit; ein zweiter Klick waehrenddessen sagt es.
   - Geschrieben wird nur fuer das Team, dessen Daten auf dem Schirm stehen. Wechselt das Team
     dazwischen, wird nichts geschrieben (sonst landete der Entwurf von Team A in Team B).
   - Rueckfragen fuer alles Unumkehrbare stehen in den Bausteinen (team-orga: Entfernen, Owner,
     Zurueckziehen; settings-brand: Verlassen und Loeschen mit getipptem Teamnamen).
   - Weitergeleitet wird nur zu Stripe (settings-data.js, stripeUrl) und nach dem Verlassen bzw.
     Loeschen auf eine Seite der App selbst.
   - Edge-Aufrufe werden nie von selbst wiederholt (eine E-Mail koennte schon hinaus sein).

   ADRESSE: ?st=team bzw. ?st=billing (Your Brand ist die Vorgabe und steht nicht drin). Bubble
   kann den Reiter ausserdem ueber data-page oder setSettingsPageTab(tab) setzen (Kontomenue der
   Seitenleiste: preferences, team, billing). */
(function () {
  "use strict";

  var API_NAMES = ["resetSettingsPage", "setSettingsPageTab"];
  var Q = (window.__ussBootQueue = window.__ussBootQueue || []);
  API_NAMES.forEach(function (n) {
    if (!window[n]) window[n] = function () { Q.push([n, [].slice.call(arguments)]); };
  });

  function ussBoot(triesLeft) {
    if (!window.UpstreemCore || !window.UpstreemSettingsDaten || !window.UpstreemCitationsDaten) {
      if (triesLeft > 0) { setTimeout(function () { ussBoot(triesLeft - 1); }, 100); return; }
      if (window.console) console.error("[settings-page] core.js, settings-data.js oder citations-data.js nicht geladen");
      return;
    }
    ussStart();
  }

  function ussStart() {
  var UC = window.UpstreemCore, D = window.UpstreemSettingsDaten;
  var esc = UC.esc, t = UC.t || function (x) { return x; };
  var STORE = (window.__ussStore = window.__ussStore || {});
  var LADER = (window.__ussLader = window.__ussLader || {});

  function str(v) { return v == null || typeof v === "object" ? "" : String(v); }
  function team() { try { return (UC.getTeam && UC.getTeam()) || ""; } catch (e) { return ""; } }
  function beiSicht(el, schluessel, fn, test, o) { if (UC.beiSicht) UC.beiSicht(el, schluessel, fn, test, o); else fn(); }
  function messbar(el) { return !UC.messbar || UC.messbar(el); }
  function setter(name) { return typeof window[name] === "function" ? window[name] : function () {}; }
  function toast(text, art, desc) { if (UC.toast) UC.toast(text, { kind: art || "success", desc: desc || "" }); }

  var REITER_WERTE = ["preferences", "team", "billing"];
  function reiterWert(v) {
    v = str(v).trim().toLowerCase();
    if (v === "brand") v = "preferences";
    return REITER_WERTE.indexOf(v) >= 0 ? v : "";
  }
  /* Dasselbe Ersatzzeichen wie der bisherige Kopf (settings-page-header.js), solange die Marke
     kein Logo hat; Team und Billing wie dort und in der Seitenleiste. */
  var ICON_MARKE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /> <path d="m3.3 7 8.7 5 8.7-5" /> <path d="M12 22V12" /></svg>';

  /* ---- Fehler als Satz fuer den Nutzer -------------------------------------------------------
     Je stabiler message des Vorschlags (Auftrag 1.6, 4.x) ein Satz, der sagt, was passiert ist und
     was man tun kann. Keine internen Namen (Regel der App). Was der Vertrag anders nennt, wird hier
     nachgezogen. Reihenfolge: die genauen Faelle zuerst, die allgemeinen zuletzt. */
  function fehlerSatz(erg, wobei) {
    var m = D.meldung(erg), h = D.hinweis(erg), n = D.hinweisZahl(erg);
    if (/team_deleted/.test(m)) return { text: t("This team has been deleted"), desc: t("Switch to another team to continue.") };
    if (/cannot_remove_self|cannot kick self/.test(m)) return { text: t("You can't remove yourself"), desc: t("Use Leave team instead.") };
    if (/invite_send_unknown/.test(m)) return { text: t("We couldn't confirm that the email went out"), desc: t("Check the pending invites and resend if needed.") };
    if (/billing_plan_not_found/.test(m)) return { text: t("This plan is no longer available"), desc: t("Refresh the page to see the current plans.") };
    if (/models_min_one/.test(m)) return { text: t("At least one model has to stay active"), desc: "" };
    if (/models_invalid/.test(m)) return { text: t("One of these models can't be used"), desc: t("Refresh the page and try again.") };
    if (/too_long/.test(m)) return { text: /summary/.test(h) ? t("The summary is too long") : t("This text is too long"), desc: n ? t("Use at most {n} characters.").replace("{n}", String(n)) : "" };
    if (/invalid_market/.test(m)) return { text: t("Please choose a market from the list"), desc: "" };
    if (/invalid_business_model/.test(m)) return { text: t("Please choose a business model"), desc: "" };
    if (/invalid[_ ]email/.test(m)) return { text: t("Please check the email address"), desc: "" };
    if (/reauth_required/.test(m)) return { text: t("Please sign in again"), desc: t("For your security, this needs a fresh sign-in.") };
    if (/last_owner/.test(m)) return { text: t("This team needs another owner first"), desc: t("Make someone else owner, or delete the team.") };
    if (/confirm/.test(m)) return { text: t("The team name didn't match"), desc: t("Type the team name exactly as shown.") };
    if (/already[_ ]member/.test(m)) return { text: t("This person is already in the team"), desc: "" };
    /* "duplicate key value": so meldet create_team_invite heute eine zweite offene Einladung an
       dieselbe Adresse (roh aus Postgres, Bubble-Workflow utoInvite Schritt 10). */
    if (/invite_(pending|duplicate)|already_invited|duplicate key/.test(m)) return { text: t("This address already has a pending invite"), desc: t("Use Resend in the list of pending invites.") };
    if (/invite_(not_pending|expired|revoked|accepted)/.test(m)) return { text: t("This invite is no longer open"), desc: t("Refresh the page to see the current list.") };
    /* Erneut senden zu frueh: der hint traegt die Sekunden bis frei (Vorschlag 6.3). */
    if (/invite_rate_limited/.test(m)) return { text: t("Too many invites right now"), desc: n ? t("Please try again in {n} minutes.").replace("{n}", String(Math.max(1, Math.ceil(n / 60)))) : t("Please wait a moment and try again.") };
    if (/resend_too_soon|cooldown/.test(m)) return { text: t("The invite was sent just now"), desc: n ? t("You can send it again in {n} minutes.").replace("{n}", String(n)) : t("Please wait a few minutes before sending it again.") };
    if (/daily_limit/.test(m) || /daily_invites/.test(h)) return { text: t("Daily limit reached"), desc: t("Please try again tomorrow.") };
    if (/open_invites/.test(h)) return { text: t("Too many pending invites"), desc: t("Revoke invites that are no longer needed, then try again.") };
    if (/seat|members_limit/.test(m)) return { text: t("Your plan has no free seats"), desc: t("Upgrade your plan or remove a member first.") };
    if (/models?_limit|limit_reached/.test(m) && !/rate/.test(m)) return { text: t("Not enough room in your plan"), desc: n ? t("Your plan allows {n} models.").replace("{n}", String(n)) : t("Turn off another model or upgrade your plan.") };
    if (/min(imum)?_one_model/.test(m)) return { text: t("At least one model has to stay active"), desc: "" };
    if (/logo/.test(m) || /^p_logo_url/.test(h)) return { text: t("This logo link can't be used"), desc: t("Use an image link that starts with https://") };
    if (/invalid_param/.test(m) && /^p_summary/.test(h)) return { text: t("The summary is too long"), desc: n ? t("Use at most {n} characters.").replace("{n}", String(n)) : "" };
    if (/invalid_param/.test(m) && /^p_industry/.test(h)) return { text: t("Please check the industry"), desc: t("Use at most 48 characters.") };
    if (/invalid_param/.test(m) && /^p_email/.test(h)) return { text: t("Please check the email address"), desc: "" };
    if (/invalid_param/.test(m) && /^p_role/.test(h)) return { text: t("This role can't be given here"), desc: "" };
    if (/no_access|team_access_/.test(m)) return { text: t("This team has no active plan"), desc: t("Choose a plan in Billing to continue.") };
    if (/protected|support_member/.test(m)) return { text: t("This member can't be changed"), desc: "" };
    if (/_forbidden$|^forbidden_role/.test(m) || (erg && erg.fehler && erg.fehler.code === "PT403")) return { text: t("Your role doesn't allow this"), desc: t("Ask an owner of this team.") };
    if (/forbidden/.test(m) || (erg && erg.status === 403)) return { text: t("You don't have permission for this"), desc: t("Refresh the page and try again.") };
    if (/rate_limited/.test(m) || (erg && erg.status === 429)) return { text: t("Too many requests"), desc: t("Please wait a moment and try again.") };
    if (/not_found/.test(m)) return { text: t("This no longer exists"), desc: t("Refresh the page to see the current state.") };
    if (/timeout|network/.test(m)) return { text: wobei || t("That didn't work"), desc: t("Check your connection and try again.") };
    return { text: wobei || t("That didn't work"), desc: t("Please try again.") };
  }
  function fehlerToast(erg, wobei) { var f = fehlerSatz(erg, wobei); toast(f.text, "error", f.desc); }
  /* Was noch nicht verlinkt ist (settings-data.js, LIVE), sagt es -- nie ein stiller Knopf. */
  function nochNicht() { toast(t("This isn't available yet"), "neutral", t("It comes with the next update of this page.")); }

  /* Nach dem Verlassen oder Loeschen: auf eine Seite der APP, nie auf eine Adresse aus einer
     Antwort. Bubble legt Testfassungen unter /version-test/ ab -- der Praefix bleibt. */
  function zurAppSeite(ziel) {
    ziel = /^[a-z0-9_-]{1,40}$/i.test(ziel) ? ziel : "signup";
    var basis = /^\/version-[a-z0-9_-]+\//i.test(window.location.pathname) ? window.location.pathname.split("/").slice(0, 2).join("/") + "/" : "/";
    window.location.assign(basis + ziel);
  }

  function initRoot(root) {
    if (root.__ussCtrl) return root.__ussCtrl;
    var instanceId = str(root.getAttribute("data-instance")).trim() || "settings_page";
    if (instanceId === "INSTANCE_ID") return null;
    var gem = STORE[instanceId] || {};
    var ohneAdresse = root.getAttribute("data-adresse") === "aus";

    var ids = { usb: instanceId + "_brand", uto: instanceId + "_team", ubl: instanceId + "_billing" };
    var state = {
      tab: "preferences",
      meta: gem.meta || null,
      markeDaten: gem.markeDaten || null,
      /* Das Team, fuer das die Daten auf dem Schirm geladen wurden (Schreibschutz, siehe oben). */
      datenTeam: gem.datenTeam || "",
      logo: gem.logo || ""
    };
    state.tab = adresseLesen() || reiterWert(root.getAttribute("data-page")) || gem.tab || "preferences";
    function persist() {
      STORE[instanceId] = { tab: state.tab, meta: state.meta, markeDaten: state.markeDaten, datenTeam: state.datenTeam, logo: state.logo };
    }
    var lader = LADER[instanceId] || (LADER[instanceId] = D.makeLader({ rufen: function (fn, params, o) { return UC.rpc(fn, params, { signal: o && o.signal, timeoutMs: 30000 }); } }));
    /* Schreiben: XX000 einmal wiederholen (Regel der Seiten-Vertraege) -- sicher, weil ein Fehler
       die Transaktion zurueckrollt (Auftrag 6.2). Nur diesen Code: ein Grenzen- oder Rechtefehler
       bleibt, was er ist. */
    function schreiben(a) {
      if (!D.live(a.art)) return Promise.resolve({ ok: false, nichtLive: true });
      function ruf() { return UC.rpc(a.fn, a.params, { timeoutMs: 30000 }); }
      return ruf().then(function (erg) {
        var c = erg && erg.fehler ? str(erg.fehler.code) : "";
        if (erg && !erg.ok && c === "XX000") return new Promise(function (w) { setTimeout(w, 800); }).then(ruf);
        return erg;
      }).then(D.antwortPruefen);
    }
    /* Edge: EIN Versuch. Kein XX000-Wiederholen -- eine E-Mail oder eine Stripe-Sitzung koennte
       beim ersten Mal schon entstanden sein. (Ein abgelaufenes Token wiederholt UC.edge selbst;
       dann hat die Funktion gar nicht erst begonnen.) */
    function edge(art, e) {
      if (!D.live(art) || !e.name) return Promise.resolve({ ok: false, nichtLive: true });
      return UC.edge(e.name, e.body, { timeoutMs: 30000 }).then(D.antwortPruefen);
    }
    /* JE BEREICH EIN SCHREIBVORGANG ZUR ZEIT. Der zweite Klick wartet nicht in einer Schlange --
       er sagt, dass noch einer laeuft. Eine Schlange schriebe Aenderungen gegen einen Stand, den
       der Nutzer nie gesehen hat. */
    var laeuft = {};
    function einmal(bereich, fn) {
      if (laeuft[bereich]) { toast(t("Please wait a moment"), "neutral", t("The last change is still being saved.")); return null; }
      laeuft[bereich] = true;
      var fertig = function () { laeuft[bereich] = false; };
      return Promise.resolve().then(fn).then(fertig, function (e) { fertig(); if (window.console) console.error("[settings-page] " + bereich + ":", e); });
    }
    /* Stimmt das Team auf dem Schirm noch mit dem der Seite ueberein? Sonst NICHT schreiben. */
    function teamGleich(ausEreignis) {
      var tm = team();
      if (!tm) return false;
      if (ausEreignis && ausEreignis !== tm) return false;
      if (state.datenTeam && state.datenTeam !== tm) return false;
      return true;
    }
    function teamGewechselt() {
      toast(t("The team was switched"), "neutral", t("Nothing was saved. Please check the values and try again."));
      neuLaden();
    }

    function isDark() { return (UC.themeParam && UC.themeParam(root.getAttribute("data-isdark"))) || root.getAttribute("data-theme") === "dark"; }
    var dk = isDark() ? "yes" : "no";
    root.innerHTML =
      '<div class="up-ph-top uss-pagehead">' +
        '<div class="up-ph-left"><h1 class="up-ph-heading">' + esc(t("Settings")) + '</h1>' +
          '<p class="up-ph-desc">' + esc(t("Manage your brand, your team and your plan.")) + '</p></div>' +
      '</div>' +
      '<div class="up-ph-nav uss-nav" role="tablist"></div>' +
      '<div class="uss-main">' +
        '<div class="uss-tab" data-uss-tab="preferences"><div class="up-root usb-root" data-local="yes" data-instance="' + esc(ids.usb) + '" data-isdark="' + dk + '"></div></div>' +
        '<div class="uss-tab" data-uss-tab="team"><div class="up-root uto-root" data-local="yes" data-instance="' + esc(ids.uto) + '" data-isdark="' + dk + '" data-team="' + esc(team()) + '"></div></div>' +
        '<div class="uss-tab" data-uss-tab="billing"><div class="up-root ubl-root" data-local="yes" data-instance="' + esc(ids.ubl) + '" data-isdark="' + dk + '" data-team="' + esc(team()) + '"></div></div>' +
      '</div>';

    var elNav = root.querySelector(".uss-nav");
    function el(sel) { return root.querySelector(sel); }
    /* Der erste Reiter zeigt das Logo der eigenen Marke (wie der bisherige Kopf). Woher: zuerst
       aus settings_brand_v1, sonst aus der Marken-Ablage der App (eigene Marke). */
    function logoUrl() {
      if (state.logo) return state.logo;
      var l = UC.getBrands ? UC.getBrands() : [];
      for (var i = 0; i < l.length; i++) if (l[i] && l[i].role === "own" && l[i].logo_url) return str(l[i].logo_url);
      return "";
    }
    function reiter() {
      var u = logoUrl();
      return [
        { value: "preferences", label: "Your Brand",
          icon: u ? '<img class="uss-navlogo" src="' + esc(u) + '" alt="" onerror="this.style.display=&quot;none&quot;"/>' : ICON_MARKE },
        { value: "team", label: "Team Organisation", icon: UC.icon ? UC.icon("users", 2) : "" },
        { value: "billing", label: "Billing", icon: UC.icon ? UC.icon("dollarSign", 2) : "" }
      ];
    }
    var nav = null, navLogo = null;
    function navBauen() {
      if (!UC.makePageNav) return;
      navLogo = logoUrl();
      nav = UC.makePageNav(root, {
        nav: elNav, storeKey: instanceId + "|uss-nav", selected: state.tab,
        pages: reiter(), onSelect: function (v) { reiterOeffnen(v, true); }
      });
    }
    navBauen();
    var krumen = UC.makePageCrumbs ? UC.makePageCrumbs(root, { icon: "bolt", name: "Settings", quelle: elNav, komponente: true }) : null;
    function logoNachziehen() {
      if (logoUrl() === navLogo) return;
      navBauen();
      if (krumen && krumen.zeichnen) krumen.zeichnen();
    }
    var auftritt = UC.makeAuftritt ? UC.makeAuftritt(root, { kopf: ".uss-pagehead, .uss-nav", inhalt: ".uss-main > .uss-tab" }) : null;
    if (UC.makeTooltips) UC.makeTooltips(root, isDark);
    if (isDark()) root.setAttribute("data-theme", "dark"); else root.removeAttribute("data-theme");

    /* ---- Reiter und Adresse ------------------------------------------------------------------- */
    function adresseLesen() {
      if (ohneAdresse) return null;
      try { var v = new URL(window.location.href).searchParams.get("st"); return v === "team" || v === "billing" ? v : null; }
      catch (e) { return null; }
    }
    function adresseSetzen(neuerEintrag) {
      if (ohneAdresse) return;
      try {
        var u = new URL(window.location.href);
        if (state.tab === "preferences") u.searchParams.delete("st"); else u.searchParams.set("st", state.tab);
        var neu = u.pathname + u.search + u.hash;
        if (neu === window.location.pathname + window.location.search + window.location.hash) return;
        if (neuerEintrag) window.history.pushState(window.history.state, "", neu);
        else window.history.replaceState(window.history.state, "", neu);
      } catch (e) {}
    }
    function reiterZeigen() {
      root.querySelectorAll(".uss-tab").forEach(function (x) { x.hidden = x.getAttribute("data-uss-tab") !== state.tab; });
      root.setAttribute("data-uss-reiter", state.tab);
      if (krumen && krumen.zeichnen) krumen.zeichnen();
    }
    function reiterOeffnen(v, neuerEintrag) {
      v = reiterWert(v) || "preferences";
      if (v === state.tab) return;
      state.tab = v;
      if (nav && nav.selectPage) { try { nav.selectPage(v, false); } catch (e) {} }
      persist(); adresseSetzen(neuerEintrag); reiterZeigen();
      bedarf();
    }
    window.addEventListener("popstate", function () {
      if (root.isConnected === false) return;
      var a = adresseLesen() || "preferences";
      if (a !== state.tab) reiterOeffnen(a, false);
    });
    /* data-page: Bubble setzt den Reiter (Kontomenue der Seitenleiste). Beobachtet, weil Bubble das
       Attribut am stehenden Knoten aendert. */
    if (window.MutationObserver) {
      new MutationObserver(function () {
        var v = reiterWert(root.getAttribute("data-page"));
        if (v) reiterOeffnen(v, false);
      }).observe(root, { attributes: true, attributeFilter: ["data-page"] });
    }

    /* ---- Laden ---------------------------------------------------------------------------------- */
    function sichtbarTest(x) { return x.isConnected !== false && (!UC.istSichtbar || UC.istSichtbar(x)); }
    function bereit() {
      if (!sichtbarTest(root)) { beiSicht(root, "laden", function () { bedarf(); }, sichtbarTest); return false; }
      return !!team();
    }
    /* Lesen ueber den Lader, oder -- wenn der Schritt noch nicht verlinkt ist -- sofort eine
       Antwort "nicht da", ohne Anfrage. */
    function lesen(kanal, a, frisch) {
      if (!D.live(a.art)) return Promise.resolve({ ok: false, nichtLive: true });
      return lader.laden(kanal, a, { frisch: !!frisch });
    }
    function imSpeicher(a) { return D.live(a.art) && lader.ausSpeicher(a) !== undefined; }
    /* Die Meta (Rolle, Rechte, Teamname) brauchen alle drei Reiter. Einmal je Besuch und nach
       Aenderungen an Mitgliedern. */
    function metaLaden(frisch) {
      var a = D.seite(team());
      return lesen("uss_meta", a, frisch || !state.meta).then(function (erg) {
        if (erg.ueberholt) return state.meta;
        var m = erg.ok ? D.zuMeta(erg.daten) : null;
        /* Ohne lesbare Meta bleibt die Rolle UNBEKANNT -- die Bausteine zeigen dann nichts, was
           eine Rolle braucht (Loeschen nur fuer owner, Rechte nie "ja" geraten). */
        state.meta = m; persist();
        return m;
      });
    }
    var gruppeNr = 0, juengsteJe = {};
    function gemeinsam(auftraege, o) {
      o = o || {};
      var nr = ++gruppeNr, tm = team();
      auftraege.forEach(function (a) { juengsteJe[a.kanal] = nr; });
      auftraege.forEach(function (a) { if (o.frisch || !a.imSpeicher) a.ladenAn(); });
      /* Meta und Daten GLEICHZEITIG (nicht nacheinander): gezeichnet wird erst, wenn beide da sind,
         denn die Bausteine brauchen die Rolle zum Zeichnen. */
      return Promise.all([metaLaden(o.frisch || o.meta)].concat(auftraege.map(function (a) { return a.laden(o.frisch); }))).then(function (r) {
        var m = r[0], zeigen = r.slice(1);
        /* Ein Teamwechsel waehrend des Ladens: diese Antworten gehoeren zum alten Team. */
        if (tm !== team()) return;
        state.datenTeam = tm; persist();
        zeigen.forEach(function (z, i) {
          if (z && juengsteJe[auftraege[i].kanal] === nr) { try { z(m); } catch (e) { if (window.console) console.error("[settings-page] " + auftraege[i].kanal + ":", e); } }
        });
        if (auftritt) auftritt.bereit();
      });
    }
    function bedarf(o) {
      if (!bereit()) return null;
      o = o || {};
      if (state.tab === "team") return gemeinsam([teamAuftrag()], o);
      if (state.tab === "billing") return gemeinsam([aboAuftrag()], o);
      return gemeinsam([markeAuftrag()], o);
    }

    /* YOUR BRAND: Marke, Einstellungen und Modelle in einem Aufruf (settings_brand_v1). */
    function markeZeigen(daten, m) {
      var z = daten ? D.zuMarke(daten, m) : null;
      if (!z) { try { setter("renderSettingsBrand")({ instanceId: ids.usb, __parseError: true }); } catch (e) {} return false; }
      /* Flach gemerkt (die Zeile, nicht der Umschlag): Schreibantworten werden darauf gelegt. */
      state.markeDaten = flach(daten);
      if (z.brand.logo !== state.logo) { state.logo = z.brand.logo; logoNachziehen(); }
      persist();
      z.instanceId = ids.usb;
      try { setter("renderSettingsBrand")(z); } catch (e) {}
      return true;
    }
    function markeAuftrag() {
      var a = D.marke(team());
      return {
        kanal: "marke", imSpeicher: imSpeicher(a),
        ladenAn: function () { try { setter("setSettingsBrandLoading")(ids.usb, "yes"); } catch (e) {} },
        laden: function (frisch) {
          return lesen("uss_marke", a, frisch).then(function (erg) {
            if (erg.ueberholt) return null;
            return function (m) { markeZeigen(erg.ok ? erg.daten : null, m); };
          });
        }
      };
    }
    /* TEAM: Mitglieder, Einladungen, Protokoll. Einem member liefert die DB Einladungen und
       Protokoll ohnehin nicht (Auftrag 4.3) -- dann gar nicht erst fragen. */
    function uto() { var r = el(".uto-root"); return r && r.__utoController ? r.__utoController : null; }
    function teamAuftrag() {
      var tm = team();
      var am = D.mitglieder(tm), ae = D.einladungen(tm), ap = D.protokoll(tm);
      var uroot = el(".uto-root");
      if (uroot && uroot.getAttribute("data-team") !== tm) uroot.setAttribute("data-team", tm);
      return {
        kanal: "team", imSpeicher: imSpeicher(am) && imSpeicher(ae) && imSpeicher(ap),
        ladenAn: function () { try { setter("setTeamOrgaLoading")(ids.uto, "yes"); } catch (e) {} },
        laden: function (frisch) {
          /* Die Rolle aus der LETZTEN Meta: ist sie unbekannt, wird gefragt -- einem member gibt
             die DB ohnehin leere Listen. */
          var r = state.meta && state.meta.rechte;
          var nurLesen = !!(r && r.einladungenSehen && !r.einladungenSehen.darf && r.protokollSehen && !r.protokollSehen.darf);
          return Promise.all([
            lesen("uss_mitglieder", am, frisch),
            nurLesen ? Promise.resolve(null) : lesen("uss_einladungen", ae, frisch),
            nurLesen ? Promise.resolve(null) : lesen("uss_protokoll", ap, frisch)
          ]).then(function (e) {
            if (e.some(function (x) { return x && x.ueberholt; })) return null;
            return function () { teamZeigen(e[0], nurLesen ? null : e[1], nurLesen ? null : e[2]); };
          });
        }
      };
    }
    function teamZeigen(em, ee, ep) {
      if (em) {
        var mm = em.ok ? D.zuMitglieder(em.daten) : null;
        /* Ein Objekt OHNE members zeigt team-orga als Lesefehler der ganzen Seite. */
        try { setter("renderTeamOrga")(mm ? Object.assign({ instanceId: ids.uto }, mm) : { instanceId: ids.uto, __parseError: true }); } catch (e) {}
      }
      if (ee) {
        var ii = ee.ok ? D.zuEinladungen(ee.daten) : null;
        try { setter("setTeamOrgaInvites")(ids.uto, ii || { __parseError: true }); } catch (e) {}
      }
      if (ep) {
        var ll = ep.ok ? D.zuProtokoll(ep.daten) : null;
        try { setter("setTeamOrgaLog")(ids.uto, ll || { __parseError: true }); } catch (e) {}
      }
    }
    /* BILLING: das Abo. Die Tarife erst, wenn das Fenster aufgeht (ublPlans). */
    function aboAuftrag() {
      var tm = team(), a = D.abo(tm);
      var broot = el(".ubl-root");
      if (broot && broot.getAttribute("data-team") !== tm) broot.setAttribute("data-team", tm);
      return {
        kanal: "abo", imSpeicher: imSpeicher(a),
        ladenAn: function () {},
        laden: function (frisch) {
          return lesen("uss_abo", a, frisch).then(function (erg) {
            if (erg.ueberholt) return null;
            return function () {
              var z = erg.ok ? D.zuAbo(erg.daten) : null;
              /* {ok:false} liest settings-billing als Fehler (UC.aboLesen) -- er steht dann vor
                 dem Skelett, nicht nach 25 s Warten. */
              try { setter("setBillingSubscription")(ids.ubl, z || { ok: false }); } catch (e) {}
            };
          });
        }
      };
    }
    function neuLaden() { lader.leeren(); state.meta = null; persist(); bedarf({ frisch: true }); }

    /* ---- Ereignisse von Your Brand (lokal: "usb" plus Name, makeFire) -------------------------- */
    function an(name, fn) { root.addEventListener(name, function (e) { fn(e.detail || {}); }); }
    function usb() { var r = el(".usb-root"); return r && r.__usbController ? r.__usbController : null; }
    function usbLaden(an_) { try { setter("setSettingsBrandLoading")(ids.usb, an_ ? "yes" : "no"); } catch (e) {} }
    /* Ein gescheitertes Speichern: der Baustein stellt den Stand davor her und BEHAELT den Entwurf
       (speichernZurueck). Ohne die Methode (alter Pin) frisch vom Server -- der Entwurf ist dann
       zwar weg, aber nichts behauptet, gespeichert zu sein. */
    function usbZurueck(block) {
      var c = usb();
      if (c && c.speichernZurueck) { c.speichernZurueck(block); return; }
      lader.leeren(); bedarf({ frisch: true });
    }
    /* Nach jeder Aenderung an Marke und Modellen: der Team-Kopf der App (Seitenleiste) kommt noch
       aus Bubble und laedt auf dieses Signal neu -- derselbe Schritt wie im bisherigen Workflow. */
    function kontoSignal() { try { if (typeof window.upstreemSignal === "function") window.upstreemSignal("account_updated", "meta"); } catch (e) {} }
    function markeName() { var z = state.markeDaten ? D.zuMarke(state.markeDaten) : null; return z && z.brand.name ? z.brand.name : ""; }
    /* Die Antwort einer Schreibfunktion ist der neue Stand (Auftrag 6.2). Gezeichnet wird NUR der
       Block, der gespeichert wurde: renderSettingsBrand setzt Entwurf UND Stand jedes Feldes, das
       es bekommt -- eine ungespeicherte Aenderung im anderen Block (Modelle umgestellt, dann die
       Einstellungen gespeichert) waere sonst still weg. Ohne lesbare Antwort: frisch laden. */
    /* Die Zeile einer Antwort (Vorschlag 6.1: {meta, row}); team_models_set_v1 liefert die Modelle
       als rows. */
    function flach(d) {
      if (!d || typeof d !== "object" || Array.isArray(d)) return null;
      var z = d.row && typeof d.row === "object" ? Object.assign({}, d.row) : Object.assign({}, d);
      if (Array.isArray(d.rows) && !Array.isArray(z.models)) z.models = d.rows;
      delete z.meta; delete z.rows;
      return z;
    }
    var BLOCK = { meta: ["brand", "team", "user_role", "market", "business_model", "industry", "summary"], models: ["models", "model_limit"] };
    function nachSchreibenMarke(daten, block) {
      var f = flach(daten), neu = f ? Object.assign({}, state.markeDaten || {}, f) : null;
      if (neu && !Array.isArray(neu.models) && state.markeDaten) neu.models = state.markeDaten.models;
      lader.leeren();
      var z = neu ? D.zuMarke(neu, state.meta) : null;
      if (!z) { bedarf({ frisch: true }); return; }
      state.markeDaten = neu; persist();
      var teil = { instanceId: ids.usb };
      (BLOCK[block] || []).forEach(function (k) { if (z[k] !== undefined) teil[k] = z[k]; });
      try { setter("renderSettingsBrand")(teil); } catch (e) {}
    }
    an("usbusbMeta", function (d) {
      if (!teamGleich(str(d.team_id))) { usbZurueck("meta"); teamGewechselt(); return; }
      if (!D.live("markeSpeichern")) { usbZurueck("meta"); nochNicht(); return; }
      if (D.zusammenfassungZuLang(d.summary)) {
        usbZurueck("meta");
        toast(t("The summary is too long"), "error", t("Use at most {n} characters.").replace("{n}", String(D.GRENZE.zusammenfassung)));
        return;
      }
      einmal("marke", function () {
        return schreiben(D.markeSpeichern(team(), d)).then(function (erg) {
          if (!erg.ok) { usbZurueck("meta"); fehlerToast(erg, t("The settings could not be saved")); return; }
          var name = markeName();
          toast(name ? name + " " + t("settings updated") : t("Settings updated"), "success",
                erg.daten && erg.daten.meta && erg.daten.meta.rewritten === true ? t("Special characters were removed.") : "");
          nachSchreibenMarke(erg.daten, "meta");
          kontoSignal();
        });
      });
    });
    an("usbusbModels", function (d) {
      if (!teamGleich(str(d.team_id))) { usbZurueck("models"); teamGewechselt(); return; }
      if (!D.live("modelle")) { usbZurueck("models"); nochNicht(); return; }
      var a = D.modelle(team(), d.model_keys);
      if (!a.params.p_model_keys.length) { usbZurueck("models"); toast(t("At least one model has to stay active"), "error"); return; }
      einmal("marke", function () {
        return schreiben(a).then(function (erg) {
          if (!erg.ok) { usbZurueck("models"); fehlerToast(erg, t("The models could not be saved")); return; }
          var name = markeName();
          toast(name ? name + " " + t("models updated") : t("Models updated"), "success");
          nachSchreibenMarke(erg.daten, "models");
          kontoSignal();
        });
      });
    });
    an("usbusbLogoUrl", function (d) {
      var url = str(d.url).trim();
      /* Der Baustein hat das neue Logo schon gezeigt. Jeder Ausgang, der NICHT speichert, holt das
         gespeicherte zurueck -- sonst stuende ein Logo da, das es nicht gibt. */
      function zurueck() { try { setter("setSettingsBrandLogo")(ids.usb, state.logo || "", ""); } catch (e) {} }
      if (!teamGleich(str(d.team_id))) { zurueck(); teamGewechselt(); return; }
      if (D.logoPruefen(url)) { zurueck(); toast(t("This logo link can't be used"), "error", t("Use an image link that starts with https://")); return; }
      if (!D.live("logo")) { zurueck(); nochNicht(); return; }
      einmal("marke", function () {
        usbLaden(true);
        return schreiben(D.logo(team(), url)).then(function (erg) {
          if (!erg.ok) { usbLaden(false); zurueck(); fehlerToast(erg, t("The logo could not be saved")); return; }
          /* Nur das Logo nachziehen (siehe nachSchreibenMarke): Entwuerfe darunter bleiben. */
          var f = flach(erg.daten), neu = f ? D.zuMarke(Object.assign({}, state.markeDaten || {}, f)) : null;
          var logo = neu ? neu.brand.logo : url;
          if (state.markeDaten) {
            state.markeDaten = Object.assign({}, state.markeDaten, { logo_url: logo });
            if (state.markeDaten.brand) state.markeDaten.brand = Object.assign({}, state.markeDaten.brand, { logo_url: logo });
          }
          state.logo = logo; persist(); logoNachziehen(); lader.leeren();
          try { setter("setSettingsBrandLogo")(ids.usb, logo, ""); } catch (e) {}
          usbLaden(false);
          toast(t("Logo updated"), "success");
          kontoSignal();
        });
      });
    });
    an("usbusbLogoFile", function () { toast(t("Uploading a file isn't available yet"), "neutral", t("Use a link to the image instead.")); });
    /* "Edit brand": der Marken-Editor der App (#drawer-companysettings) fuer die EIGENE Marke. */
    an("usbusbEditBrand", function () {
      var z = state.markeDaten ? D.zuMarke(state.markeDaten) : null, id = z ? z.company_id : "";
      if (!id) { var l = UC.getBrands ? UC.getBrands() : []; for (var i = 0; i < l.length; i++) if (l[i] && l[i].role === "own") { id = str(l[i].company_id); break; } }
      if (D.UUID.test(id) && document.getElementById("drawer-companysettings") && UC.drawerOeffnen) { UC.drawerOeffnen("companysettings", id, "settings"); return; }
      toast(t("Editing isn't available on this page"), "neutral");
    });
    /* VERLASSEN UND LOESCHEN. Die Rueckfrage (getippter Teamname, beim Loeschen zweiter Klick)
       steht in settings-brand; der getippte Name geht als Bestaetigung an die DB mit, die ihn
       selbst vergleicht (Auftrag 4.5.2). Danach auf eine Seite der App. */
    function austritt(art, d) {
      var loeschen = art === "loeschen";
      if (!teamGleich(str(d.team_id))) { teamGewechselt(); return; }
      if (!D.live(art)) { nochNicht(); return; }
      einmal("konto", function () {
        usbLaden(true);
        return schreiben(loeschen ? D.loeschen(team(), str(d.team_name)) : D.verlassen(team(), str(d.team_name))).then(function (erg) {
          if (!erg.ok) { usbLaden(false); fehlerToast(erg, loeschen ? t("The team could not be deleted") : t("You could not leave the team")); return; }
          toast(loeschen ? t("Team deleted") : t("You left the team"), "success");
          lader.leeren();
          var ziel = str(root.getAttribute("data-nach-austritt")).trim() || "signup";
          setTimeout(function () { zurAppSeite(ziel); }, 600);
        });
      });
    }
    an("usbusbLeaveTeam", function (d) { austritt("verlassen", d); });
    an("usbusbDeleteTeam", function (d) { austritt("loeschen", d); });

    /* ---- Ereignisse von Team Organisation (lokal: "uto" plus Name) ----------------------------- */
    function teamNeu(mitMeta) { lader.leeren(); bedarf({ frisch: true, meta: !!mitMeta }); }
    function einladungAntwort(ok, text) { var c = uto(); if (c && c.einladungErgebnis) c.einladungErgebnis(ok, text); }
    var MAIL_SATZ = { leer: "Please enter an email address.", lang: "This email address is too long.",
                      zeichen: "This email address contains characters we can't use.", form: "That does not look like an email address." };
    /* EINLADEN UND ERNEUT SENDEN ueber EINE Edge Function (team-invite-send, Vorschlag 3.2/6.4):
       sie legt an, versendet und fuehrt den Versandstand an der Einladung. Die Seite zieht nach
       einem Fehlschlag nichts mehr zurueck -- das hinterliess ein falsches "invite_revoked" und
       konnte eine Mail mit totem Link erzeugen. Kein automatisches Wiederholen: eine Mail koennte
       schon hinaus sein (die Funktion versendet mit Idempotenzschluessel, aber ein zweiter Klick
       ist eine bewusste Entscheidung des Nutzers).
       Unklarer Versand (502 team_invite_send_unknown): die Einladung steht, der Versand ist offen
       -- der Dialog geht zu, der Satz nennt den Ausweg (erneut senden). */
    function einladungAus(daten) {
      var dd = Array.isArray(daten) ? (daten[0] || {}) : (daten && typeof daten === "object" ? daten : {});
      var z = dd.row && typeof dd.row === "object" ? dd.row : dd;
      return { id: str(z.invite_id || z.id), unveraendert: !!((dd.meta && dd.meta.unchanged === true) || dd.unchanged === true) };
    }
    function versandUnklar(erg) { return /invite_send_unknown/.test(D.meldung(erg)); }
    an("utoutoInvite", function (d) {
      if (!teamGleich(str(d.team_id))) { einladungAntwort(false, t("The team was switched. Please try again.")); neuLaden(); return; }
      var grund = D.mailPruefen(d.email, UC.mailOk);
      if (grund) { einladungAntwort(false, t(MAIL_SATZ[grund] || MAIL_SATZ.form)); return; }
      if (!D.live("einladen")) { einladungAntwort(false, t("Inviting isn't available here yet.")); return; }
      var e = D.einladen(team(), d.email, d.role), adresse = e.body.email;
      if (einmal("team", function () {
        return edge("einladen", e).then(function (erg) {
          if (!erg.ok && versandUnklar(erg)) {
            einladungAntwort(true);
            var fu = fehlerSatz(erg, "");
            toast(fu.text, "neutral", fu.desc);
            teamNeu(true);
            return;
          }
          if (!erg.ok) { var f = fehlerSatz(erg, t("The invite could not be sent")); einladungAntwort(false, f.text + (f.desc ? ". " + f.desc : "")); return; }
          var z = einladungAus(erg.daten);
          einladungAntwort(true);
          if (z.unveraendert) toast(t("This address already has a pending invite"), "neutral", t("Use Resend in the list of pending invites."));
          else toast(t("Invite sent"), "success", adresse);
          teamNeu(true);
        });
      }) === null) einladungAntwort(false, t("The last change is still being saved. Please try again in a moment."));
    });
    an("utoutoResend", function (d) {
      var id = str(d.invite_id);
      if (!D.UUID.test(id)) return;
      if (!teamGleich(str(d.team_id))) { teamGewechselt(); return; }
      if (!D.live("erneut")) { nochNicht(); return; }
      einmal("team", function () {
        return edge("erneut", D.erneut(team(), id)).then(function (erg) {
          if (!erg.ok) {
            var f = fehlerSatz(erg, t("The invite could not be sent again"));
            toast(f.text, versandUnklar(erg) ? "neutral" : "error", f.desc);
          } else toast(t("Invite sent again"), "success", str(d.email));
          teamNeu(false);
        });
      });
    });
    /* Entfernen, Rolle, Zurueckziehen: die Rueckfrage war schon im Baustein. Die Antwort ist die
       neue Liste (Auftrag 6.2); sicherheitshalber wird trotzdem frisch geladen (Protokoll, Meta). */
    function teamSchreiben(a, ok, wobei, mitMeta) {
      if (!D.live(a.art)) { nochNicht(); return; }
      einmal("team", function () {
        return schreiben(a).then(function (erg) {
          if (!erg.ok) { fehlerToast(erg, wobei); teamNeu(false); return; }
          toast(ok, "success");
          teamNeu(mitMeta);
        });
      });
    }
    an("utoutoRevoke", function (d) {
      var id = str(d.invite_id);
      if (!D.UUID.test(id)) return;
      if (!teamGleich(str(d.team_id))) { teamGewechselt(); return; }
      teamSchreiben(D.zurueckziehen(team(), id), t("Invite revoked"), t("The invite could not be revoked"), false);
    });
    an("utoutoRemove", function (d) {
      var uid = str(d.user_id);
      if (!D.UUID.test(uid)) return;
      if (!teamGleich(str(d.team_id))) { teamGewechselt(); return; }
      teamSchreiben(D.entfernen(team(), uid), t("Member removed"), t("The member could not be removed"), true);
    });
    an("utoutoRole", function (d) {
      var uid = str(d.user_id), r = str(d.role).toLowerCase();
      if (!D.UUID.test(uid) || ["member", "admin", "owner"].indexOf(r) < 0) return;
      if (!teamGleich(str(d.team_id))) { teamGewechselt(); return; }
      /* Mit Meta: aendert sich die EIGENE Rolle (ein owner gibt ab), aendern sich die Rechte. */
      teamSchreiben(D.rolle(team(), uid, r), t("Role changed"), t("The role could not be changed"), true);
    });

    /* ---- Ereignisse von Billing (lokal: "ubl" plus Name) -------------------------------------- */
    /* Ins Stripe-Portal bzw. an die Kasse: im SELBEN Tab (wie bisher in Bubble), nur zu Stripe.
       weiche(erg): ein Fehler, der einen anderen Weg nennt, statt eines Satzes (Kasse -> Portal). */
    function zuStripe(art, e, wobei, weiche) {
      if (!D.live(art) || !e.name) { nochNicht(); return; }
      einmal("billing", function () {
        return edge(art, e).then(function (erg) {
          if (!erg.ok && weiche && weiche(erg)) return;
          var url = erg.ok ? D.stripeUrl(erg.daten, art) : "";
          if (!url) { fehlerToast(erg.ok ? null : erg, wobei); return; }
          window.location.assign(url);
        });
      });
    }
    function zumPortal() { zuStripe("portal", D.portal(team()), t("Billing could not be opened")); }
    an("ublublManage", function (d) {
      if (!teamGleich(str(d.team_id))) { teamGewechselt(); return; }
      zumPortal();
    });
    /* Der Pfad, auf den Stripe nach der Kasse zurueckkehrt (create-team-checkout setzt APP_URL davor):
       genau diese Ansicht, Reiter Billing, ohne alte checkout-Angaben. */
    function rueckweg() {
      try {
        var u = new URL(window.location.href);
        u.searchParams.delete("checkout"); u.searchParams.delete("session_id");
        if (!ohneAdresse) u.searchParams.set("st", "billing");
        /* Die Ansicht, in der die Seite steht (#view-<name>, Kopf-Skript): fehlt ?view in der
           Adresse (Ansicht ohne Klick geoeffnet), kaeme Stripe sonst auf die Startansicht zurueck.
           Der Pfad selbst bleibt, wie er ist -- auf der Testfassung also mit /version-test/. */
        var v = root.closest ? root.closest('[id^="view-"]') : null, name = v ? String(v.id).slice(5) : "";
        if (name && /^[a-z0-9_-]+$/i.test(name)) u.searchParams.set("view", name);
        u.hash = "";
        return u.pathname + u.search;
      } catch (e) { return ""; }
    }
    /* TARIF WAEHLEN (Vorschlag 9.2): die Kasse fuer Teams ohne laufendes Abo. Laeuft schon eins,
       antwortet sie 409 billing_subscription_exists (hint portal) -- dann das Portal, dort wird
       gewechselt. Ob ein Abo laeuft, entscheidet die Kasse selbst, nicht der Stand auf dem Schirm. */
    an("ublublSelectPlan", function (d) {
      if (!teamGleich(str(d.team_id))) { teamGewechselt(); return; }
      if (!str(d.plan_id)) return;
      if (!D.EDGE.kasse) { zumPortal(); return; }
      zuStripe("kasse", D.kasse(team(), d.plan_id, d.billing_interval, rueckweg()), t("Checkout could not be opened"), function (erg) {
        if (!/subscription_exists/.test(D.meldung(erg))) return false;
        if (!D.live("portal")) { toast(t("Your team already has a plan"), "neutral", t("Use Manage Billing to change it.")); return true; }
        /* einmal() sperrt "billing" noch fuer diesen Lauf -- das Portal danach, nicht darin. */
        setTimeout(zumPortal, 0);
        return true;
      });
    });
    /* ZURUECK VON DER KASSE (?checkout=success|cancelled). Den neuen Stand liefert der Webhook,
       meist binnen Sekunden: EINMAL frisch lesen, kurz verzoegert -- kein Abfragen im Kreis
       (Vorschlag 9.2). Danach die Angaben aus der Adresse, sonst kaeme die Meldung bei jedem
       Neuladen wieder. */
    (function () {
      var w = "";
      try { w = new URL(window.location.href).searchParams.get("checkout") || ""; } catch (e) { w = ""; }
      if (w !== "success" && w !== "cancelled") return;
      try {
        var u = new URL(window.location.href);
        u.searchParams.delete("checkout"); u.searchParams.delete("session_id");
        window.history.replaceState(window.history.state, "", u.pathname + u.search + u.hash);
      } catch (e) {}
      if (w === "cancelled") { toast(t("Checkout cancelled"), "neutral", t("Your plan hasn't changed.")); return; }
      toast(t("Thanks, your payment went through"), "success", t("Your plan updates in a moment."));
      setTimeout(function () { lader.leeren(); state.meta = null; persist(); bedarf({ frisch: true }); }, 3000);
    })();
    an("ublublPlans", function () {
      var a = D.tarife(team());
      lesen("uss_tarife", a, false).then(function (erg) {
        if (erg.ueberholt) return;
        var z = erg.ok ? D.zuTarife(erg.daten) : null;
        /* Unlesbar oder nicht verlinkt: das Fenster zeigt seinen Fehler statt 8 s Skelett. */
        try { setter("setBillingPlans")(ids.ubl, z || { __parseError: true }); } catch (e) {}
      });
    });

    /* Teamwechsel ohne Neuladen: andere Daten, also nichts aus dem Speicher weiterzeigen und keine
       Schreibvorgaenge mehr fuer das alte Team. */
    if (UC.onTeamChange) UC.onTeamChange(function () {
      lader.leeren(); state.meta = null; state.markeDaten = null; state.datenTeam = ""; state.logo = "";
      persist(); logoNachziehen();
      try { setter("resetSettingsBrand")(ids.usb); } catch (e) {}
      try { setter("resetTeamOrga")(ids.uto); } catch (e) {}
      bedarf({ frisch: true });
    }, root);

    var ctrl = {
      root: root, state: state, ids: ids,
      reset: function () { neuLaden(); return true; },
      reiter: function (v) { reiterOeffnen(v, false); return true; },
      neuLaden: neuLaden
    };
    root.__ussCtrl = ctrl;
    reiterZeigen();
    adresseSetzen(false);
    /* Erst nach dem Aufbau der eingebetteten Bausteine: deren Skripte richten sich ueber
       watchRoots ein und kennen ihre Setter einen Takt spaeter. */
    setTimeout(function () { persist(); bedarf(); }, 0);
    return ctrl;
  }

  /* ---- Mount (wie brands-page.js) ------------------------------------------------------------- */
  function alle() { return [].slice.call(document.querySelectorAll(".uss-root")); }
  function jede(id, fn) {
    var r = alle().filter(function (x) { return id == null || str(x.getAttribute("data-instance")) === String(id); });
    r.forEach(function (x) { var c = initRoot(x); if (c) fn(c); });
    return r.length > 0;
  }
  window.resetSettingsPage = function (id) { return jede(id, function (c) { c.reset(); }); };
  /* setSettingsPageTab(tab) oder (id, tab). */
  window.setSettingsPageTab = function (a, b) {
    var tab = b === undefined ? a : b, id = b === undefined ? null : a;
    if (!reiterWert(tab)) return false;
    return jede(id, function (c) { c.reiter(tab); });
  };
  function einrichten() {
    alle().forEach(function (r) {
      if (r.__ussCtrl) return;
      if (messbar(r)) { initRoot(r); return; }
      var neu = !(UC.wartetAufSicht && UC.wartetAufSicht(r));
      beiSicht(r, "einrichten", function () { initRoot(r); }, messbar, { lang: neu });
    });
  }
  if (UC.watchRoots) UC.watchRoots("uss-root", einrichten);
  einrichten();
  Q.splice(0).forEach(function (q) { try { window[q[0]].apply(null, q[1]); } catch (e) {} });
  }
  ussBoot(30);
})();
