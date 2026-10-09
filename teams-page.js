/* upstreem teams-page.js -- die Teams-Seite als EINE Komponente (09.10.). Praefix utp.

   Wie Citations, Dashboard, Performance und Opportunities: die Seite laedt selbst (UC.rpc,
   Login des Nutzers) und fuellt die echte Teams-Tabelle (teams.js), die Kopf und Tabelle in einem
   Element baut. Vertrag E, teams_portfolio_v1; Anfrage und Umformung in teams-data.js.

   LADEN: beim Aufbau (sobald die Seite zu sehen ist) und bei jedem Teamwechsel. Waehrend des
   Ladens zeigt die Tabelle ihr Skelett (setTeamsLoading) -- derselbe kleine Lader wie in jeder
   Tabelle der App. Die ganze Liste in einem Aufruf (bis 100), darueber blaettert die Seite selbst
   nach. Fehler oder unlesbare Antwort: der Lesefehler der Tabelle, nie eine leere Liste.

   WECHSELN und "+ New Team" bleiben bei den Workflows der Seitenleiste (usnTeam, usnNewTeam):
   ein Teamwechsel laedt dort den ganzen Arbeitsbereich. Darum traegt die Tabelle hier KEIN
   data-local -- ihre zwei Ereignisse gehen weiter an Bubble. */
(function () {
  "use strict";

  var API_NAMES = ["resetTeamsPage"];
  var Q = (window.__utpBootQueue = window.__utpBootQueue || []);
  API_NAMES.forEach(function (n) {
    if (!window[n]) window[n] = function () { Q.push([n, [].slice.call(arguments)]); };
  });

  function utpBoot(triesLeft) {
    if (!window.UpstreemCore || !window.UpstreemTeamsDaten || !window.UpstreemCitationsDaten) {
      if (triesLeft > 0) { setTimeout(function () { utpBoot(triesLeft - 1); }, 100); return; }
      if (window.console) console.error("[teams-page] core.js, teams-data.js oder citations-data.js nicht geladen");
      return;
    }
    utpStart();
  }

  function utpStart() {
  var UC = window.UpstreemCore, D = window.UpstreemTeamsDaten, C = window.UpstreemCitationsDaten;
  var esc = UC.esc;
  var STORE = (window.__utpStore = window.__utpStore || {});

  function str(v) { return v == null || typeof v === "object" ? "" : String(v); }
  function team() { try { return (UC.getTeam && UC.getTeam()) || ""; } catch (e) { return ""; } }
  function beiSicht(el, schluessel, fn, test, o) { if (UC.beiSicht) UC.beiSicht(el, schluessel, fn, test, o); else fn(); }
  function messbar(el) { return !UC.messbar || UC.messbar(el); }

  function initRoot(root) {
    if (root.__utpCtrl) return root.__utpCtrl;
    var instanceId = str(root.getAttribute("data-instance")).trim() || "teams_page";
    if (instanceId === "INSTANCE_ID") return null;
    var gem = STORE[instanceId] || (STORE[instanceId] = {});
    /* Der Lader aus citations-data.js: juengste Anfrage gewinnt, Serverfehler (auch XX000) zwei
       Mal wiederholt, Speicher je Signatur -- ueber einen Neuaufbau hinweg (Themenwechsel). */
    var lader = gem.lader || (gem.lader = C.makeLader({
      rufen: function (fn, params, o) { return UC.rpc(fn, params, { signal: o && o.signal, timeoutMs: 20000 }); }
    }));
    var idUts = instanceId + "_table";
    root.innerHTML = '<div class="up-root uts-root" data-instance="' + esc(idUts) + '" data-sticky-top="16"' +
      ' data-switch-fn="bubble_fn_usnTeam" data-newteam-fn="bubble_fn_usnNewTeam"></div>';

    function sichtbarTest(el) { return el.isConnected !== false && (!UC.istSichtbar || UC.istSichtbar(el)); }
    var ladeNr = 0;
    function laden(frisch) {
      if (!sichtbarTest(root)) { beiSicht(root, "laden", function () { laden(frisch); }, sichtbarTest); return; }
      var nr = ++ladeNr, tm = team(), alle = [];
      var ersteAnfrage = D.teams(tm, 0);
      /* Das Skelett nur, wenn die Antwort nicht schon im Speicher liegt -- sonst blitzte es bei
         jedem Neuaufbau kurz auf. */
      if (frisch || lader.ausSpeicher(ersteAnfrage) === undefined) {
        try { window.setTeamsLoading(idUts, "yes"); } catch (e) {}
      }
      function seite(offset) {
        return lader.laden("teams_" + offset, D.teams(tm, offset), { frisch: !!frisch }).then(function (erg) {
          if (nr !== ladeNr || erg.ueberholt) return null;
          var s = erg.ok ? D.zuSeite(erg.daten) : null;
          if (!s) return false;
          alle = alle.concat(s.rows);
          /* Hoechstens zehn Seiten: eine kaputte Zaehlung soll keine Schleife werden. */
          if (s.total > alle.length && s.rows.length && offset < 900) return seite(offset + 100);
          return true;
        });
      }
      seite(0).then(function (ok) {
        if (ok === null || nr !== ladeNr) return;
        try {
          if (ok) window.renderTeams({ instanceId: idUts, rows: alle, currentTeamId: tm });
          else window.renderTeams({ instanceId: idUts, __parseError: true });
        } catch (e) {}
      });
    }
    /* Teamwechsel: FRISCH, nicht aus dem Speicher -- zwischen zwei Wechseln koennen sich die
       Zaehlerstaende (Prompts, Brands) geaendert haben. Nur der Neuaufbau (Themenwechsel) nimmt
       den Speicher. */
    if (UC.onTeamChange) UC.onTeamChange(function () { if (gem.team !== team()) { gem.team = team(); laden(true); } }, root);

    var ctrl = {
      root: root,
      neuLaden: function () { lader.leeren(); laden(true); },
      reset: function () { lader.leeren(); try { window.resetTeams(idUts); } catch (e) {} laden(true); return true; }
    };
    root.__utpCtrl = ctrl;
    /* Erst nach dem Aufbau der Tabelle: teams.js richtet sich ueber watchRoots ein. */
    setTimeout(function () { gem.team = team(); laden(false); }, 0);
    return ctrl;
  }

  function alle() { return [].slice.call(document.querySelectorAll(".utp-root")); }
  window.resetTeamsPage = function (id) {
    alle().filter(function (x) { return id == null || str(x.getAttribute("data-instance")) === String(id); })
      .forEach(function (x) { var c = initRoot(x); if (c) c.reset(); });
  };
  function einrichten() {
    alle().forEach(function (r) {
      if (r.__utpCtrl) return;
      if (messbar(r)) { initRoot(r); return; }
      var neu = !(UC.wartetAufSicht && UC.wartetAufSicht(r));
      beiSicht(r, "einrichten", function () { initRoot(r); }, messbar, { lang: neu });
    });
  }
  if (UC.watchRoots) UC.watchRoots("utp-root", einrichten);
  einrichten();
  Q.splice(0).forEach(function (q) { try { window[q[0]].apply(null, q[1]); } catch (e) {} });
  }

  utpBoot(30);
})();
