/* upstreem brands-data.js -- der Datenteil der Seite Brands (11.10.), OHNE DOM.

   WARUM EIN EIGENER TEIL: wie citations-data.js, dashboard-data.js und prompts-data.js. Was hier
   steht, kennt weder Elemente noch Bubble -- nur den Filterstand, die RPCs und die Form, in der die
   eingebetteten Bausteine (brands-overview, discover-brands) ihre Daten lesen. Das ist der Teil, der
   bei einem Umzug fast unveraendert mitgeht.

   VERTRAGSSTAND (11.10.):
     Tracked, Chart und Tabelle: LIVE. cached_dashboard_visibility_v1 und cached_dashboard_overview_v1
       aus dem Dashboard-Vertrag v1 -- dieselben Zahlen wie auf dem Dashboard, gebaut ueber
       window.UpstreemDashboardDaten (eine Quelle, keine zweite Rechnung). Laut DB-Chat in allen
       Feldern gleich der heutigen Ansicht (BRANDS_V1_VORSCHLAG.md 3.1).
     Alles andere: Vertrag Brands v1, GEBAUT am 11.10. (bubble/brands_v1_vertrag.md, Abschnitt 11
       ist der endgueltige Stand und geht vor). Geprueft gegen die echten Antworten
       (testdaten/brands_v1/antworten.json, Team 877c, Schreibaufrufe zurueckgerollt).
       Die Namen und Feldnamen stehen NUR hier (FN, zuMeta, zuDiscover, zuAnlage). Weicht der
       Vertrag ab, wird hier nachgezogen; Seite und Bausteine sehen dieselbe Form.
       VORSCHLAG = true sagt der Seite, dass diese Wege noch nicht da sind: sie fragt dann gar
       nicht erst (ein 404 je Seitenaufruf waere Laerm) und zeigt den Leerzustand der Bausteine.

   Der Filterstand f: { team, von, bis, modelle[], maerkte[], topics[], tagmode } wie im Dashboard.

   Exportiert als window.UpstreemBrandsDaten. Braucht window.UpstreemCitationsDaten (Lader,
   Fehlerart) und window.UpstreemDashboardDaten (Overview, Visibility). */
(function () {
  "use strict";
  if (window.UpstreemBrandsDaten) return;

  function isArr(v) { return Object.prototype.toString.call(v) === "[object Array]"; }
  function str(v) { return v == null || typeof v === "object" ? "" : String(v); }
  function num(v) { if (v == null || v === "" || typeof v === "boolean") return null; var n = Number(v); return isFinite(n) ? n : null; }
  /* Eine uuid und nichts anderes (dieselbe Regel wie dashboard-data.js): was nicht so aussieht,
     lehnt die DB mit 22P02 ab -- und damit den ganzen Aufruf. */
  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  function C() { return window.UpstreemCitationsDaten; }
  function DD() { return window.UpstreemDashboardDaten; }
  function absolut(u) { u = str(u).trim(); if (/^\/\//.test(u)) u = "https:" + u; return /^https?:\/\//i.test(u) ? u : ""; }
  function meta(d) { return d && d.meta && typeof d.meta === "object" ? d.meta : {}; }
  function istObjekt(d) { return !!d && typeof d === "object" && !isArr(d); }

  function liste(a) { a = isArr(a) ? a.map(str).map(function (x) { return x.trim(); }).filter(Boolean) : []; return a.length ? a : null; }
  function uuids(a, max) {
    var l = (liste(a) || []).filter(function (x) { return UUID.test(x); }), gesehen = {};
    l = l.filter(function (x) { var k = x.toLowerCase(); if (gesehen[k]) return false; gesehen[k] = true; return true; });
    if (max) l = l.slice(0, max);
    return l.length ? l : null;
  }

  var FN = {
    meta: "brands_page_meta_v1",
    status: "brands_set_status_v1",
    anlegen: "brand_add_v1",
    loeschen: "brands_delete_v1",
    discover: "cached_discover_brands_v1",
    discoverNeu: "discover_brands_refresh_v1",
    clear: "clear_dashboard_cache_v1"
  };
  /* Der Vertrag ist gebaut (11.10.). Bleibt als Schalter fuer den Fall, dass eine Funktion
     zurueckgerollt werden muss: true heisst, die Seite fragt dort nicht und sagt es sichtbar. */
  var VORSCHLAG = false;

  /* Grenzen, die die Oberflaeche vorab einhaelt -- die Datenbank prueft sie trotzdem selbst
     (Vertrag 6.5). Tabelle: alle aktiven Marken auf einmal (hoechstens 16 laut Vertrag 5); das
     Blaettern ueber 100 bleibt als Netz, still zu kappen waere eine falsche Zahl. */
  var GRENZE = { tabelle: 100, tabelleSeiten: 5, ids: 50, name: 75, domain: 253, suche: 100, discover: 30 };

  function anfrage(art, params) { return { art: art, fn: FN[art], params: params, sig: FN[art] + "|" + JSON.stringify(params) }; }
  /* Intent-Filter der App (13.10., core: UC.intentFilterParams). Leer, solange die Intents nicht
     freigegeben sind -- dann geht kein neuer Parameter hinaus. */
  function intentDazu(o) {
    var U = window.UpstreemCore, x = U && U.intentFilterParams ? U.intentFilterParams() : {};
    for (var k in x) if (Object.prototype.hasOwnProperty.call(x, k)) o[k] = x[k];
    return o;
  }
  /* Die gemeinsamen Filter (Vertrag 6.1) -- dieselbe Form wie Dashboard v1, auch fuer Discover. */
  function basis(f) {
    f = f || {};
    return intentDazu({
      p_team: str(f.team), p_date_from: str(f.von) || null, p_date_to: str(f.bis) || null,
      p_models: liste(f.modelle), p_markets: liste(f.maerkte), p_tag_ids: uuids(f.topics),
      p_tagmode: f.tagmode === "and" ? "and" : "or"
    });
  }

  /* ---- Tracked (live, Dashboard v1) ----------------------------------------------------------- */
  /* Chart: ohne eigene Auswahl die Top 7 (eigene Marke immer dabei), mit Auswahl hoechstens 10. */
  function chart(f, gran, firmen) { return DD().visibility(f, { gran: gran, firmen: firmen }); }
  /* Tabelle: alle aktiven Marken, Seite fuer Seite zu je 100 (offset). Mit eigener Auswahl im Fader
     (firmen, hoechstens 10) nur diese Marken -- wie auf dem Dashboard (17.10., FLT-06): nur die
     Auswahl im Chart schraenkt Chart UND Tabelle ein, ohne sie sortiert die Tabelle ueber alle. */
  function tabelle(f, order, offset, firmen) {
    return DD().overview(f, { order: order, limit: GRENZE.tabelle, offset: offset || 0, firmen: firmen });
  }
  /* Die Form von renderBrandsOverview: series/companies aus visibility_v1, table aus overview_v1.
     Mehrere Seiten der Tabelle werden VOR der Umformung zusammengelegt. */
  function zuTracked(vis, seiten, o) {
    if (!isArr(seiten) || !seiten.length || !istObjekt(seiten[0])) return null;
    var alle = { meta: meta(seiten[0]), rows: [] };
    for (var i = 0; i < seiten.length; i++) {
      if (!istObjekt(seiten[i]) || !isArr(seiten[i].rows)) return null;
      alle.rows = alle.rows.concat(seiten[i].rows);
    }
    return DD().zuVisibility(vis, alle, o);
  }
  /* Wie viele Seiten die Tabelle braucht -- aus total_count der ersten. */
  function weitereSeiten(erste) {
    var n = num(meta(erste).total_count);
    if (n == null || n <= GRENZE.tabelle) return 0;
    return Math.min(GRENZE.tabelleSeiten, Math.ceil(n / GRENZE.tabelle)) - 1;
  }

  /* ---- Vertrag Brands v1 (Vorschlag des DB-Chats vom 11.10., Abschnitt 10 geht vor) ------------- */
  function seite(team) { return anfrage("meta", { p_team: str(team) }); }
  function ids(l) { return uuids(isArr(l) ? l : [l], GRENZE.ids) || []; }
  function status(team, l, ziel) {
    return anfrage("status", { p_team: str(team), p_company_ids: ids(l), p_status: ziel === "active" ? "active" : "inactive" });
  }
  function loeschen(team, l) { return anfrage("loeschen", { p_team: str(team), p_company_ids: ids(l) }); }
  function anlegen(team, p) {
    p = p || {};
    return anfrage("anlegen", { p_team: str(team), p_name: str(p.name).trim().slice(0, GRENZE.name),
                                p_domain: str(p.domain).trim().slice(0, GRENZE.domain) });
  }
  /* Discover: die gemeinsamen Filter (Vertrag 6.1 -- die Funktion kennt sie alle), Matched als
     Text yes/no, Suche ueber ALLE Kandidaten (nicht nur die 30 gezeigten). */
  function discover(f, o) {
    o = o || {};
    var p = basis(f);
    p.p_matched = o.matched === false ? "no" : "yes";
    p.p_search = str(o.suche).trim().slice(0, GRENZE.suche) || null;
    p.p_limit = GRENZE.discover;
    return anfrage("discover", p);
  }
  function discoverNeu(team) { return anfrage("discoverNeu", { p_team: str(team) }); }

  function kontingent(q) {
    if (!istObjekt(q)) return null;
    return { used: num(q.used), total: num(q.total), remaining: num(q.remaining), plan: str(q.plan) };
  }
  /* Seiten-Meta (6.2): Rolle, Zaehler, Kontingent, Tageskontingent, alle aktiven Marken (fuer die
     Ablage der App, mit role) und die inaktiven -- diese in der Form, die setBrandsOverviewInactive
     liest (company_id, name, favicon_url, deactivated_at). Logos laut 10.6: Wettbewerber immer ihr
     Favicon, die eigene Marke ihr Logo -- das liefert die DB schon so. */
  function zuMeta(d) {
    if (!istObjekt(d) || !isArr(d.inactive)) return null;
    var m = meta(d);
    return {
      rolle: str(m.role).toLowerCase(),
      aktivZahl: num(m.total_count),
      inaktivZahl: num(m.total_count_inactive),
      kontingent: kontingent(m.quota),
      tag: istObjekt(m.daily) ? { neu: num(m.daily.tracked_left), aus: num(m.daily.deactivations_left) } : null,
      marken: (isArr(d.brands) ? d.brands : []).filter(function (r) { return r && r.company_id != null; }).map(function (r) {
        return { company_id: str(r.company_id), name: str(r.name), logo_url: absolut(r.logo_url),
                 role: str(r.role) === "own" ? "own" : "competitor", domain: str(r.domain) };
      }),
      inaktive: d.inactive.filter(function (r) { return r && r.company_id != null; }).map(function (r) {
        return { company_id: str(r.company_id), name: str(r.name), favicon_url: absolut(r.logo_url || r.favicon_url),
                 domain: str(r.domain), deactivated_at: str(r.deactivated_at) };
      })
    };
  }
  /* Explore Brands (6.2 mit 10.3): die Form, die renderDiscoverBrands liest -- rows mit status
     ("untracked"/"inactive") und company_id der inaktiven, dazu total_responses und ob der heutige
     Tag schon drin ist (10.2). */
  function zuDiscover(d) {
    if (!istObjekt(d) || !isArr(d.rows)) return null;
    var m = meta(d);
    return {
      rows: d.rows.filter(function (r) { return r && typeof r === "object" && str(r.name).trim(); }).map(function (r) {
        return {
          name: str(r.name), visibility_pct: num(r.visibility_pct), mentioned_count: num(r.mentioned_count),
          runs_total: num(r.runs_total), status: str(r.status) === "inactive" ? "inactive" : "untracked",
          company_id: r.company_id == null ? null : str(r.company_id),
          recognized_urls: (isArr(r.recognized_urls) ? r.recognized_urls : []).filter(function (u) { return u && typeof u === "object"; })
            .map(function (u) { return { domain: str(u.domain), root_url: absolut(u.root_url), favicon_url: absolut(u.favicon_url) }; })
        };
      }),
      total_responses: num(m.total_responses),
      today_included: m.today_included === false ? false : (m.today_included === true ? true : null),
      /* Vergangene Tage im Zeitraum, die der Hintergrundjob noch nicht gerechnet hat (11.2) -- nach
         dem Einspielen holt er 366 Tage nach, die letzten 30 in etwa 15 Minuten. Solange fehlt
         etwas in den Zahlen, und das soll man sehen. */
      missing_days: num(m.missing_days),
      data_as_of: str(m.data_as_of),
      gesamt: num(m.total_count)
    };
  }
  /* Anlage (6.3): was passiert ist (created/linked/reactivated), ob umgeschrieben wurde, die neue
     Marke, das neue Kontingent. */
  function zuAnlage(d) {
    if (!istObjekt(d)) return null;
    var m = meta(d), r = istObjekt(d.row) ? d.row : {};
    return { aktion: str(m.action), umgeschrieben: m.rewritten === true, company_id: str(r.company_id),
             name: str(r.name), kontingent: kontingent(m.quota) };
  }
  /* Status (6.3) und Loeschen (10.5): wie viele geaendert bzw. geloescht, wie viele uebersprungen. */
  function zuSchreiben(d) {
    if (!istObjekt(d)) return null;
    var m = meta(d);
    return { geaendert: num(m.changed != null ? m.changed : m.deleted), uebersprungen: num(m.skipped), kontingent: kontingent(m.quota) };
  }

  function fehlerArt(erg) { return C() && C().fehlerArt ? C().fehlerArt(erg) : "x"; }
  function meldung(erg) { return erg && erg.fehler ? str(erg.fehler.message) : ""; }
  function hinweis(erg) { return erg && erg.fehler ? str(erg.fehler.hint) : ""; }
  function hinweisZahl(erg) { var m = /-?\d+/.exec(hinweis(erg)); return m ? Number(m[0]) : null; }
  function makeLader(o) { return C().makeLader(o); }

  window.UpstreemBrandsDaten = {
    FN: FN, GRENZE: GRENZE, VORSCHLAG: VORSCHLAG,
    chart: chart, tabelle: tabelle, zuTracked: zuTracked, weitereSeiten: weitereSeiten,
    seite: seite, status: status, loeschen: loeschen, anlegen: anlegen, discover: discover, discoverNeu: discoverNeu,
    zuMeta: zuMeta, zuDiscover: zuDiscover, zuAnlage: zuAnlage, zuSchreiben: zuSchreiben,
    fehlerArt: fehlerArt, meldung: meldung, hinweis: hinweis, hinweisZahl: hinweisZahl,
    makeLader: makeLader
  };
})();
