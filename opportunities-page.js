/* upstreem opportunities-page.js -- die Opportunities-Seite als EINE Komponente (09.10.). Praefix uop.

   Kopf (Krume "Opportunities", Knopf "Look for new Opportunities") und das Brett
   (opportunities.js) im lokalen Modus. Das Brett laedt und schreibt nicht mehr ueber Bubble: die
   Seite holt die Liste, schreibt Statuswechsel, beantwortet "Create with AI" mit den eigenen URLs
   und fuehrt die Suche nach neuen Opportunities als Job. Vertrag B in
   bubble/seiten_db_vorschlag_2.md (Abschnitt 3.2, 3.5, 5); Anfragen und Umformung in
   opportunities-data.js.

   DAS BRETT IST EIN EINZELSTUECK (opportunities.js, Launcher): das Agentic Dashboard leiht es sich
   aus und haengt es in sein eigenes DOM. Deshalb hoert diese Seite die Ereignisse des Bretts am
   window (upstreem:opportunity:*), nicht an ihrer Wurzel -- ein Statuswechsel im Dashboard wird
   genauso geschrieben wie einer hier. Bedingung: das Brett traegt data-local="yes", sonst gehen
   seine Ereignisse wie bisher an Bubble und diese Seite tut nichts.

   SCHREIBEN: das Brett legt eine Karte sofort um. Lehnt der Server ab, legt die Seite sie still
   zurueck (opportunitiesSetStatus mit silent) und sagt es in einem Satz. Schreiben laeuft
   nacheinander, damit zwei schnelle Wechsel derselben Karte in ihrer Reihenfolge ankommen.

   SUCHE: start-job legt einen Job an, die Seite hoert auf dessen Realtime-Kanal (view_job:<id>,
   seit 10.10. statt Abfragen im Takt), bei success laedt sie die Liste neu (die neue Liste beendet die Suche im Brett), bei error sagt sie es. Nach einem
   Neuladen der Seite findet sie einen laufenden Job ueber den Stand ohne job_id wieder. */
(function () {
  "use strict";

  var API_NAMES = ["resetOpportunitiesPage"];
  var Q = (window.__uopBootQueue = window.__uopBootQueue || []);
  API_NAMES.forEach(function (n) {
    if (!window[n]) window[n] = function () { Q.push([n, [].slice.call(arguments)]); };
  });

  function uopBoot(triesLeft) {
    if (!window.UpstreemCore || !window.UpstreemOpportunitiesDaten || !window.UpstreemCitationsDaten) {
      if (triesLeft > 0) { setTimeout(function () { uopBoot(triesLeft - 1); }, 100); return; }
      if (window.console) console.error("[opportunities-page] core.js, opportunities-data.js oder citations-data.js nicht geladen");
      return;
    }
    uopStart();
  }

  /* ---- MARKUP ANFANG (erzeugt von .opportunities_markup.py -- nicht von Hand aendern) ---- */
  var MARKUP = {
    uo: "<div class=\"up-root uo-root\" data-local=\"yes\" data-instance=\"__UOP_UO__\" data-cdn-pin=\"\" data-isdark=\"__UOP_DARK__\" data-sticky-top=\"16\"><div class=\"up-head uo-head\"><div class=\"up-heading has-count\"><span class=\"up-head-label\">Active Opportunities</span><span class=\"up-head-sep\"></span><span class=\"up-head-count uo-total\">0</span></div><div class=\"up-head-tools\"><!-- Sorter vor der Suche: dieselbe Reihenfolge wie in allen anderen Kopfzeilen. core.js ordnet die Leiste zur Laufzeit ohnehin (orderToolbars). --><div class=\"uo-popwrap\"><button class=\"uo-sort-btn up-iconbtn\" type=\"button\" data-tip=\"Sort\" aria-label=\"Sort\" aria-haspopup=\"menu\" aria-expanded=\"false\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m3 16 4 4 4-4\"/><path d=\"M7 20V4\"/><path d=\"m21 8-4-4-4 4\"/><path d=\"M17 4v16\"/></svg></button><div class=\"up-menu uo-sort-pop\" role=\"menu\" aria-hidden=\"true\"><div class=\"up-pop-head\">Sort by</div><div class=\"up-pop-opt is-active\" role=\"menuitem\" data-sort=\"priority\">Priority<svg class=\"up-check\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M5 13.2592L7.58583 15.9568C8.2525 16.6523 8.58583 17 9.00004 17C9.41425 17 9.74759 16.6523 10.4143 15.9568L19 7\"/></svg></div><div class=\"up-pop-opt\" role=\"menuitem\" data-sort=\"newest\">Newest<svg class=\"up-check\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M5 13.2592L7.58583 15.9568C8.2525 16.6523 8.58583 17 9.00004 17C9.41425 17 9.74759 16.6523 10.4143 15.9568L19 7\"/></svg></div><div class=\"up-pop-div\"></div><div class=\"up-pop-row uo-toggle-external\"><span class=\"up-pop-label\">External only</span><span class=\"up-switch uo-switch-external\" role=\"switch\"></span></div></div></div><div class=\"up-search\"><button class=\"up-search-btn up-iconbtn\" type=\"button\" data-tip=\"Search\" aria-label=\"Search\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M17 17L21 21\"/><path d=\"M19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19C15.4183 19 19 15.4183 19 11Z\"/></svg></button><div class=\"up-search-box\"><input class=\"up-search-input\" type=\"text\" placeholder=\"Search opportunities...\" autocomplete=\"off\" spellcheck=\"false\" aria-label=\"Search opportunities\"/><button class=\"up-search-clear\" type=\"button\" aria-label=\"Clear search\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 6L6.00081 17.9992M17.9992 18L6 6.00085\"/></svg></button></div></div><div class=\"up-seg uo-mode\" role=\"tablist\" aria-label=\"View\"><button class=\"up-seg-btn is-active\" type=\"button\" role=\"tab\" data-mode=\"board\" data-tip=\"Board view\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"3\" y=\"3\" width=\"7\" height=\"18\" rx=\"1.5\"></rect><rect x=\"14\" y=\"3\" width=\"7\" height=\"11\" rx=\"1.5\"></rect></svg>Board</button><button class=\"up-seg-btn\" type=\"button\" role=\"tab\" data-mode=\"list\" data-tip=\"List view\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M3 5h.01\" /><path d=\"M3 12h.01\" /><path d=\"M3 19h.01\" /><path d=\"M8 5h13\" /><path d=\"M8 12h13\" /><path d=\"M8 19h13\" /></svg>List</button></div><div class=\"uo-popwrap\"><button class=\"uo-settings-btn up-iconbtn\" type=\"button\" data-tip=\"Board settings\" aria-label=\"Board settings\" aria-haspopup=\"menu\" aria-expanded=\"false\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M2.5 12C2.5 7.52166 2.5 5.28249 3.89124 3.89124C5.28249 2.5 7.52166 2.5 12 2.5C16.4783 2.5 18.7175 2.5 20.1088 3.89124C21.5 5.28249 21.5 7.52166 21.5 12C21.5 16.4783 21.5 18.7175 20.1088 20.1088C18.7175 21.5 16.4783 21.5 12 21.5C7.52166 21.5 5.28249 21.5 3.89124 20.1088C2.5 18.7175 2.5 16.4783 2.5 12Z\"/><path d=\"M8.5 10C7.67157 10 7 9.32843 7 8.5C7 7.67157 7.67157 7 8.5 7C9.32843 7 10 7.67157 10 8.5C10 9.32843 9.32843 10 8.5 10Z\"/><path d=\"M15.5 17C16.3284 17 17 16.3284 17 15.5C17 14.6716 16.3284 14 15.5 14C14.6716 14 14 14.6716 14 15.5C14 16.3284 14.6716 17 15.5 17Z\"/><path d=\"M10 8.5L17 8.5\"/><path d=\"M14 15.5L7 15.5\"/></svg></button><div class=\"up-menu uo-settings-pop\" role=\"menu\" aria-hidden=\"true\"><div class=\"up-pop-head\">Lanes</div><div class=\"up-pop-row\" data-board=\"pending\"><span class=\"up-pop-label\"><span class=\"uo-col-dot\" style=\"background:#9ca3af;\"></span>Pending</span><span class=\"up-switch is-on\" role=\"switch\"></span></div><div class=\"up-pop-row\" data-board=\"in_progress\"><span class=\"up-pop-label\"><span class=\"uo-col-dot\" style=\"background:#2384E2;\"></span>In Progress</span><span class=\"up-switch is-on\" role=\"switch\"></span></div><div class=\"up-pop-row\" data-board=\"done\"><span class=\"up-pop-label\"><span class=\"uo-col-dot\" style=\"background:#15803d;\"></span>Done</span><span class=\"up-switch\" role=\"switch\"></span></div><div class=\"up-pop-row\" data-board=\"ignored\"><span class=\"up-pop-label\"><span class=\"uo-col-dot\" style=\"background:#b4451f;\"></span>Ignored</span><span class=\"up-switch\" role=\"switch\"></span></div></div></div></div></div><!-- opportunities.js renders the lanes / list into this. --><div class=\"uo-stage\"></div><div class=\"uo-scrim\"></div><div class=\"uo-modal\" role=\"dialog\" aria-modal=\"true\"></div><!-- Optional: paste a JSON array here to render without a Run-JS step (useful while designing). --><script class=\"uo-data-json\" type=\"application/json\">[]</script></div>"
  };
  /* ---- MARKUP ENDE ---- */

  function uopStart() {
  var UC = window.UpstreemCore, D = window.UpstreemOpportunitiesDaten, C = window.UpstreemCitationsDaten;
  var esc = UC.esc, t = UC.t || function (x) { return x; };
  /* Je Instanz ueber einen Neuaufbau hinweg: der Lader samt Speicher, das Team, dessen Liste schon
     da ist, und eine laufende Suche (deren Abfrage laeuft weiter und gehoert nicht der Wurzel). */
  var STORE = (window.__uopStore = window.__uopStore || {});

  function str(v) { return v == null || typeof v === "object" ? "" : String(v); }
  function team() { try { return (UC.getTeam && UC.getTeam()) || ""; } catch (e) { return ""; } }
  function setter(n) { return typeof window[n] === "function" ? window[n] : function () {}; }
  function satz(txt) { if (UC.toast) UC.toast(t(txt)); }
  function beiSicht(el, schluessel, fn, test, o) { if (UC.beiSicht) UC.beiSicht(el, schluessel, fn, test, o); else fn(); }
  function messbar(el) { return !UC.messbar || UC.messbar(el); }
  function brettLokal() { return !!document.querySelector('.uo-root[data-local="yes"]'); }

  /* Die Ereignisse des Bretts und von "Create with AI" gehen an window bzw. document -- EINMAL je
     Seite verdrahtet, nicht je Wurzel; sie landen beim aktuellen Steuerteil. */
  var aktiv = null;

  function initRoot(root) {
    if (root.__uopCtrl) return root.__uopCtrl;
    var instanceId = str(root.getAttribute("data-instance")).trim() || "opportunities_page";
    if (instanceId === "INSTANCE_ID") return null;
    var gem = STORE[instanceId] || (STORE[instanceId] = {});
    var lader = gem.lader || (gem.lader = C.makeLader({
      rufen: function (fn, params, o) { return UC.rpc(fn, params, { signal: o && o.signal, timeoutMs: 30000 }); }
    }));

    function isDark() { return (UC.themeParam && UC.themeParam(root.getAttribute("data-isdark"))) || root.getAttribute("data-theme") === "dark"; }
    var idUo = instanceId + "_board";
    var brett = String(MARKUP.uo || "").split("__UOP_UO__").join(esc(idUo)).split("__UOP_DARK__").join(isDark() ? "yes" : "no");
    root.classList.add("up-sidebar-clear");
    root.innerHTML =
      '<div class="up-ph-top uop-pagehead">' +
        '<div class="up-ph-left"><h1 class="up-ph-heading">' + esc(t("Opportunities")) + '</h1>' +
          '<p class="up-ph-desc">' + esc(t("Manage tasks, prioritize opportunities, and track progress")) + '</p></div>' +
        /* Derselbe Knopf wie im bisherigen Kopf (opportunities-page-header.js): Zeichen
           searchVisual, kurz "Look for", breit "Look for new Opportunities". */
        '<button class="up-ph-addbtn up-export uop-suche" type="button">' + (UC.icon ? UC.icon("searchVisual", 2) : "") +
          '<span>' + esc(t("Look for")) + '<span class="up-ph-addbtn-full"> ' + esc(t("new Opportunities")) + '</span></span></button>' +
      '</div>' +
      '<div class="uop-main">' + brett + '</div>';
    if (UC.makePageCrumbs) UC.makePageCrumbs(root, { icon: "listTodo", name: "Opportunities", komponente: true });
    if (UC.makeTooltips) UC.makeTooltips(root, isDark);
    if (isDark()) root.setAttribute("data-theme", "dark"); else root.removeAttribute("data-theme");

    /* ---- Knopf: belegt, solange gesucht wird (Stand meldet das Brett) ------------------------ */
    var elSuche = root.querySelector(".uop-suche");
    function belegt(an) {
      an = !!an;
      elSuche.classList.toggle("is-busy", an);
      elSuche.setAttribute("aria-busy", an ? "true" : "false");
      elSuche.disabled = an;
    }
    belegt(window.__uoSucheLaeuft);
    window.addEventListener("upstreem-opportunities-sucht", function (e) {
      if (root.isConnected === false) return;
      belegt(e && e.detail && e.detail.laeuft);
    });
    elSuche.addEventListener("click", function () { sucheStarten(); });

    /* ---- Liste ------------------------------------------------------------------------------- */
    function sichtbarTest(el) { return el.isConnected !== false && (!UC.istSichtbar || UC.istSichtbar(el)); }
    function bereit() {
      if (!sichtbarTest(root)) { beiSicht(root, "laden", function () { bedarf(); }, sichtbarTest); return false; }
      return !!team();
    }
    /* frisch: am Speicher vorbei (nach einer Suche, bei Teamwechsel). Ein Lesefehler wird zum
       Lesefehler im Brett ("{"), nie zu einer leeren Liste -- leer und kaputt sehen verschieden aus. */
    function listeLaden(frisch) {
      var tm = team();
      if (!tm) return Promise.resolve(null);
      var a = D.liste(tm);
      if (frisch || lader.ausSpeicher(a) === undefined) setter("opportunitiesSetLoading")("yes");
      return lader.laden("liste", a, { frisch: !!frisch }).then(function (erg) {
        if (erg.ueberholt) return null;
        var l = erg.ok ? D.zuListe(erg.daten) : null;
        if (l) { gem.listeFuer = tm; setter("opportunitiesSetItems")(l); }
        else setter("opportunitiesSetItems")("{");
        setter("opportunitiesSetLoading")("no");
        return l;
      });
    }

    /* ---- Suche als Job ----------------------------------------------------------------------- */
    /* KEIN ABFRAGEN IM TAKT MEHR (10.10., DB: opportunities_realtime_v1.sql). Die DB meldet jeden
       Wechsel als Broadcast auf view_job:<job_id>, Ereignis view_job_status, Nutzlast = meta von
       opportunities_search_status_v1. Den Stand fragt die Seite nur noch EINZELN ab: beim Oeffnen
       (laufendeSucheFinden), nach dem ersten Beitritt zum Kanal (ein Wechsel zwischen start-job und
       Beitritt ginge sonst verloren), nach jedem Wiederverbinden, wenn der Beitritt scheitert, und
       einmal nach der Frist des Aufraeumers -- bleibt dann jede Meldung aus, haengt die Suche nicht
       fuer immer. */
    var NOTFRIST = 3.5 * 60 * 1000;   /* der Aufraeumer der DB beendet einen Job nach 3 min */
    function abfrageStop() {
      if (gem.kanal) { gem.kanal.stop(); gem.kanal = null; }
      if (gem.notfrist) { clearTimeout(gem.notfrist); gem.notfrist = null; }
    }
    function sucheEnde(fehlerSatz) {
      abfrageStop();
      gem.job = null;
      setter("opportunitiesSetSearching")("no");
      if (fehlerSatz) satz(fehlerSatz);
    }
    /* Ein Stand, egal woher (Broadcast oder Einzelabfrage). */
    function standVerarbeiten(job, s, endgueltig) {
      if (gem.job !== job || !s) return;
      if (s.status === "queued" || s.status === "running" || !s.status) {
        if (endgueltig) sucheEnde("The search for new opportunities is taking too long. Please try again later.");
        return;
      }
      if (s.status === "success") {
        abfrageStop();
        gem.job = null;
        /* Die neue Liste beendet die Suche im Brett (opportunitiesSetItems). Scheitert sie, endet
           die Suche trotzdem. */
        if (job.team === team()) listeLaden(true).then(function (l) { if (!l) sucheEnde(); });
        else sucheEnde();
        return;
      }
      sucheEnde(s.fehler && s.fehler.code === "timeout"
        ? "The search for new opportunities took too long. Please try again."
        : "The search for new opportunities failed. Please try again.");
    }
    function standAbfragen(job, endgueltig) {
      var a = D.sucheStand(job.team, job.id);
      UC.rpc(a.fn, a.params, { timeoutMs: 15000 }).then(function (erg) {
        if (gem.job !== job) return;
        standVerarbeiten(job, erg.ok ? D.zuStand(erg.daten) : null, endgueltig);
      });
    }
    function beobachten() {
      abfrageStop();
      var job = gem.job;
      if (!job || !job.id) return;
      if (UC.kanal) gem.kanal = UC.kanal("view_job:" + job.id, {
        on: { view_job_status: function (p) { standVerarbeiten(job, D.zuStand({ meta: p, rows: [] }), false); } },
        status: function (art) {
          if (gem.job !== job) return;
          if (art === "verbunden" || art === "fehler") standAbfragen(job, false);
        }
      });
      else standAbfragen(job, false);
      gem.notfrist = setTimeout(function () {
        gem.notfrist = null;
        if (gem.job === job) standAbfragen(job, true);
      }, NOTFRIST);
    }
    function sucheStarten() {
      var tm = team();
      if (!tm || gem.job || window.__uoSucheLaeuft) return;
      if (!UC.edge) { satz("Looking for new opportunities is not available right now."); return; }
      gem.job = { id: "", team: tm, seit: Date.now() };
      var job = gem.job;
      setter("opportunitiesSetSearching")("yes");
      UC.edge("start-job", D.sucheStartBody(tm), { timeoutMs: 20000 }).then(function (erg) {
        if (gem.job !== job) return;
        var st = erg.ok ? D.zuStart(erg.daten) : null;
        if (!st) {
          var f = (erg.fehler && erg.fehler.message) || "";
          sucheEnde(/rate_limited/.test(f) ? "Too many searches in a short time. Please wait a minute."
                                           : "The search could not be started. Please try again.");
          return;
        }
        job.id = st.jobId;
        beobachten();
      });
    }
    /* Laeuft fuer dieses Team schon eine Suche (anderer Tab, Neuladen)? Dann zeigt das Brett sie. */
    function laufendeSucheFinden() {
      var tm = team();
      if (!tm || gem.job) return;
      var a = D.sucheStand(tm);
      UC.rpc(a.fn, a.params, { timeoutMs: 15000 }).then(function (erg) {
        var s = erg.ok ? D.zuStand(erg.daten) : null;
        if (!s || (s.status !== "queued" && s.status !== "running") || gem.job || tm !== team()) return;
        gem.job = { id: s.jobId, team: tm, seit: Date.now() };
        setter("opportunitiesSetSearching")("yes");
        beobachten();
      });
    }

    function bedarf() {
      if (!bereit()) return;
      if (gem.team && gem.team !== team()) teamGewechselt();
      gem.team = team();
      if (gem.listeFuer !== team()) listeLaden(false);
      laufendeSucheFinden();
    }
    function teamGewechselt() {
      lader.leeren();
      gem.listeFuer = null;
      if (gem.job) sucheEnde();
      gem.team = team();
    }
    if (UC.onTeamChange) UC.onTeamChange(function () { if (gem.team && gem.team !== team()) bedarf(); }, root);

    var ctrl = {
      root: root, gem: gem,
      neuLaden: function () { lader.leeren(); gem.listeFuer = null; bedarf(); },
      reset: function () { lader.leeren(); gem.listeFuer = null; if (gem.job) sucheEnde(); bedarf(); return true; }
    };
    root.__uopCtrl = ctrl;
    aktiv = ctrl;
    /* Neuaufbau mitten in einer Suche: der Kanal gehoert dem Store, er bleibt offen. */
    if (gem.job && !gem.kanal && gem.job.id) beobachten();
    setTimeout(function () { bedarf(); }, 0);
    return ctrl;
  }

  /* ---- Statuswechsel aus dem Brett ------------------------------------------------------------ */
  /* vorher: der Stand einer Karte vor dem ERSTEN noch nicht gesendeten Wechsel -- dorthin geht sie
     zurueck, wenn der Server ablehnt (die uebersprungenen Zwischenschritte hat er nie gesehen). */
  var kette = Promise.resolve(), letzteFuer = {}, vorher = {}, nr = 0;
  function zuruecklegen(alt, meinNr) {
    Object.keys(alt).forEach(function (id) {
      /* Nur, wenn danach kein neuerer Wechsel derselben Karte kam -- der gilt. */
      if (letzteFuer[id] !== meinNr) return;
      try { window.opportunitiesSetStatus(id, alt[id], { silent: true }); } catch (e) {}
    });
  }
  /* NUR DER LETZTE STAND GEHT HINAUS (Schreiben ist auf 30 je Minute begrenzt): wartet ein
     Wechsel noch in der Kette, waehrend dieselbe Karte schon wieder umgelegt wurde, faellt er weg --
     der neuere traegt den Stand. Wer eine Karte fuenfmal hin und her zieht, schreibt so einmal. */
  function schreiben(ids, statusWert, alt) {
    var tm = team();
    if (!D.statusSetzen(tm, ids, statusWert)) return;
    var meinNr = ++nr;
    Object.keys(alt).forEach(function (id) {
      if (!Object.prototype.hasOwnProperty.call(vorher, id)) vorher[id] = alt[id];
      letzteFuer[id] = meinNr;
    });
    kette = kette.then(function () {
      var aktuell = Object.keys(alt).filter(function (id) { return letzteFuer[id] === meinNr; });
      var a = aktuell.length ? D.statusSetzen(tm, aktuell, statusWert) : null;
      if (!a) return null;
      var zurueck = {};
      aktuell.forEach(function (id) { zurueck[id] = vorher[id]; delete vorher[id]; });
      return UC.rpc(a.fn, a.params, { timeoutMs: 20000 }).then(function (erg) {
        if (!erg.ok) {
          zuruecklegen(zurueck, meinNr);
          var f = (erg.fehler && erg.fehler.message) || "";
          if (UC.toast) UC.toast(t(/rate_limited/.test(f) ? "Too many changes in a short time. Please wait a minute and try again."
                                                          : "The change could not be saved. Please try again."));
          return;
        }
        /* Uebersprungene Karten gibt es nicht mehr (oder nicht in diesem Team): die Liste im
           Brett ist veraltet, also neu laden statt eine Karte stehen zu lassen, die es nicht gibt. */
        var r = D.zuStatus(erg.daten);
        if (r && r.uebersprungen.length && aktiv) aktiv.neuLaden();
      });
    });
  }
  window.addEventListener("upstreem:opportunity:change_status", function (e) {
    if (!aktiv || !brettLokal()) return;
    var d = (e && e.detail) || {}, alt = {};
    alt[str(d.opportunity_id)] = str(d.previous_status_key) || "pending";
    schreiben([d.opportunity_id], d.status, alt);
  });
  window.addEventListener("upstreem:opportunity:move_all", function (e) {
    if (!aktiv || !brettLokal()) return;
    var d = (e && e.detail) || {}, alt = {};
    (Array.isArray(d.opportunity_ids) ? d.opportunity_ids : []).forEach(function (id) { alt[str(id)] = str(d.from_status_key) || "pending"; });
    schreiben(d.opportunity_ids, d.status, alt);
  });
  /* ignore_opportunity ist nur eine Meldung: das Brett schickt danach change_status, und DAS
     schreibt. Hoerte die Seite auf beide, ginge jedes Ignorieren zweimal an den Server. */
  window.addEventListener("upstreem:opportunity:open_url", function (e) {
    if (!aktiv || !brettLokal()) return;
    var d = (e && e.detail) || {};
    if (d.lead_url && UC.drawerOeffnen) UC.drawerOeffnen("url", str(d.lead_url), "opportunities");
  });
  window.addEventListener("upstreem:opportunity:competitor_click", function (e) {
    if (!aktiv || !brettLokal()) return;
    var d = (e && e.detail) || {};
    if (d.company_id && UC.drawerOeffnen) UC.drawerOeffnen("brand", str(d.company_id), "opportunities");
  });
  /* "Create with AI" fragt beim Oeffnen nach den eigenen URLs (create-with-ai.js, DOM-Ereignis
     get_you_urls mit der Kennung der Instanz). Kommt keine Antwort, steht dort ein Skelett --
     also antwortet die Seite auch im Fehlerfall, mit einer leeren Liste. */
  document.addEventListener("get_you_urls", function (e) {
    if (!aktiv || !brettLokal()) return;
    var uid = str(e && e.detail && e.detail.uid), tm = team();
    if (!tm) return;
    var a = D.eigeneUrls(tm);
    aktiv.gem.lader.laden("urls", a).then(function (erg) {
      if (erg.ueberholt) return;
      var l = erg.ok ? D.zuUrls(erg.daten) : null;
      try { if (window.createWithAiSetYouUrls) window.createWithAiSetYouUrls(uid, l || []); } catch (err) {}
    });
  });

  /* ---- Mount ---------------------------------------------------------------------------------- */
  function alle() { return [].slice.call(document.querySelectorAll(".uop-root")); }
  window.resetOpportunitiesPage = function (id) {
    alle().filter(function (x) { return id == null || str(x.getAttribute("data-instance")) === String(id); })
      .forEach(function (x) { var c = initRoot(x); if (c) c.reset(); });
  };
  function einrichten() {
    alle().forEach(function (r) {
      if (r.__uopCtrl) return;
      if (messbar(r)) { initRoot(r); return; }
      var neu = !(UC.wartetAufSicht && UC.wartetAufSicht(r));
      beiSicht(r, "einrichten", function () { initRoot(r); }, messbar, { lang: neu });
    });
  }
  if (UC.watchRoots) UC.watchRoots("uop-root", einrichten);
  einrichten();
  Q.splice(0).forEach(function (q) { try { window[q[0]].apply(null, q[1]); } catch (e) {} });
  }

  uopBoot(30);
})();
