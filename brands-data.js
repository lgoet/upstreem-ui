/* upstreem brands-data.js -- der Datenteil der Seite Brands (11.10.), OHNE DOM.

   WARUM EIN EIGENER TEIL: wie citations-data.js, dashboard-data.js und prompts-data.js. Was hier
   steht, kennt weder Elemente noch Bubble -- nur den Filterstand, die RPCs und die Form, in der die
   eingebetteten Bausteine (brands-overview, discover-brands) ihre Daten lesen. Das ist der Teil, der
   bei einem Umzug fast unveraendert mitgeht.

   VERTRAGSSTAND (11.10.):
     Tracked, Chart und Tabelle: LIVE. cached_dashboard_visibility_v1 und cached_dashboard_overview_v1
       aus dem Dashboard-Vertrag v1 -- dieselben Zahlen wie auf dem Dashboard, gebaut ueber
       window.UpstreemDashboardDaten (eine Quelle, keine zweite Rechnung).
     Alles andere: VORSCHLAG aus bubble/brands_db_auftrag.md, Abschnitt 6 -- noch nicht gebaut.
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

  var FN = {
    meta: "brands_page_meta_v1",
    status: "brands_set_status_v1",
    anlegen: "brand_add_v1",
    discover: "cached_discover_brands_v1",
    clear: "clear_dashboard_cache_v1"
  };
  /* Bis der DB-Chat den Vertrag gebaut hat (siehe oben). Danach false. */
  var VORSCHLAG = true;

  /* Grenzen, die die Oberflaeche vorab einhaelt -- die Datenbank prueft sie trotzdem selbst (Auftrag
     4.3). Tabelle: alle aktiven Marken auf einmal, die Suche filtert im Browser. Ueber 100 blaettert
     die Seite (hoechstens 5 Seiten), statt still bei 100 zu kappen. */
  var GRENZE = { tabelle: 100, tabelleSeiten: 5, statusIds: 50, name: 75, domain: 300, suche: 100 };

  function anfrage(art, params) { return { art: art, fn: FN[art], params: params, sig: FN[art] + "|" + JSON.stringify(params) }; }

  /* ---- Tracked (live, Dashboard v1) ----------------------------------------------------------- */
  /* Chart: ohne eigene Auswahl die Top 7 (eigene Marke immer dabei), mit Auswahl hoechstens 10. */
  function chart(f, gran, firmen) { return DD().visibility(f, { gran: gran, firmen: firmen }); }
  /* Tabelle: alle aktiven Marken, Seite fuer Seite zu je 100 (offset). */
  function tabelle(f, order, offset) { return DD().overview(f, { order: order, limit: GRENZE.tabelle, offset: offset || 0 }); }
  /* Die Form von renderBrandsOverview: series/companies aus visibility_v1, table aus overview_v1.
     Mehrere Seiten der Tabelle werden VOR der Umformung zusammengelegt. */
  function zuTracked(vis, seiten) {
    if (!isArr(seiten) || !seiten.length || !istObjekt(seiten[0])) return null;
    var alle = { meta: meta(seiten[0]), rows: [] };
    for (var i = 0; i < seiten.length; i++) {
      if (!istObjekt(seiten[i]) || !isArr(seiten[i].rows)) return null;
      alle.rows = alle.rows.concat(seiten[i].rows);
    }
    return DD().zuVisibility(vis, alle);
  }
  /* Wie viele Seiten die Tabelle braucht -- aus total_count der ersten. */
  function weitereSeiten(erste) {
    var n = num(meta(erste).total_count);
    if (n == null || n <= GRENZE.tabelle) return 0;
    return Math.min(GRENZE.tabelleSeiten, Math.ceil(n / GRENZE.tabelle)) - 1;
  }

  /* ---- Vorschlag (bubble/brands_db_auftrag.md, Abschnitt 6) ------------------------------------ */
  function seite(team) { return anfrage("meta", { p_team: str(team) }); }
  function status(team, ids, ziel) {
    var l = (isArr(ids) ? ids : [ids]).map(str).filter(function (x) { return UUID.test(x); }).slice(0, GRENZE.statusIds);
    return anfrage("status", { p_team: str(team), p_company_ids: l, p_status: ziel === "active" ? "active" : "inactive" });
  }
  function anlegen(team, p) {
    p = p || {};
    return anfrage("anlegen", { p_team: str(team), p_name: str(p.name).trim().slice(0, GRENZE.name),
                                p_domain: str(p.domain).trim().slice(0, GRENZE.domain) || null });
  }
  function discover(team, o) {
    o = o || {};
    return anfrage("discover", { p_team: str(team), p_matched: o.matched !== false,
                                 p_search: str(o.suche).trim().slice(0, GRENZE.suche) || null });
  }

  /* Seiten-Meta: Rolle, Zaehler, Kontingent, inaktive Marken. Die inaktiven in der Form, die
     setBrandsOverviewInactive liest: company_id, name, favicon_url, deactivated_at. */
  function zuMeta(d) {
    if (!istObjekt(d)) return null;
    var m = meta(d), q = istObjekt(d.quota) ? d.quota : (istObjekt(m.quota) ? m.quota : null);
    var inaktiv = isArr(d.inactive) ? d.inactive : (isArr(d.rows) ? d.rows : null);
    if (!inaktiv) return null;
    return {
      rolle: str(m.role || d.role).toLowerCase(),
      aktiv: num(m.total_count != null ? m.total_count : (d.counts && d.counts.active)),
      inaktivZahl: num(m.total_count_inactive != null ? m.total_count_inactive : (d.counts && d.counts.inactive)),
      kontingent: q ? { used: num(q.used != null ? q.used : q.brands_active), total: num(q.total != null ? q.total : q.brands_limit), plan: str(q.plan) } : null,
      inaktive: inaktiv.filter(function (r) { return r && r.company_id != null; }).map(function (r) {
        return { company_id: str(r.company_id), name: str(r.name), favicon_url: absolut(r.logo_url || r.favicon_url),
                 domain: str(r.domain), deactivated_at: str(r.deactivated_at) };
      })
    };
  }
  /* Explore Brands: die Form, die renderDiscoverBrands liest (rows + total_responses). */
  function zuDiscover(d) {
    if (!istObjekt(d)) return null;
    var rows = isArr(d.rows) ? d.rows : null;
    if (!rows) return null;
    return {
      rows: rows.filter(function (r) { return r && typeof r === "object" && str(r.name).trim(); }).map(function (r) {
        return {
          name: str(r.name), visibility_pct: num(r.visibility_pct), mentioned_count: num(r.mentioned_count),
          runs_total: num(r.runs_total),
          recognized_urls: (isArr(r.recognized_urls) ? r.recognized_urls : []).filter(function (u) { return u && typeof u === "object"; })
            .map(function (u) { return { domain: str(u.domain), root_url: absolut(u.root_url), favicon_url: absolut(u.favicon_url) }; })
        };
      }),
      total_responses: num(meta(d).total_responses != null ? meta(d).total_responses : d.total_responses)
    };
  }
  /* Anlage: neue company_id, ob umgeschrieben wurde (Sonderzeichen), neues Kontingent. */
  function zuAnlage(d) {
    if (!istObjekt(d)) return null;
    var m = meta(d), r = istObjekt(d.row) ? d.row : d;
    return { company_id: str(r.company_id || m.company_id), umgeschrieben: (r.rewritten || m.rewritten) === true,
             kontingent: istObjekt(m.quota) ? { used: num(m.quota.used), total: num(m.quota.total) } : null };
  }

  function fehlerArt(erg) { return C() && C().fehlerArt ? C().fehlerArt(erg) : "x"; }
  function meldung(erg) { return erg && erg.fehler ? str(erg.fehler.message) : ""; }
  function hinweis(erg) { return erg && erg.fehler ? str(erg.fehler.hint) : ""; }
  function hinweisZahl(erg) { var m = /-?\d+/.exec(hinweis(erg)); return m ? Number(m[0]) : null; }
  function makeLader(o) { return C().makeLader(o); }

  window.UpstreemBrandsDaten = {
    FN: FN, GRENZE: GRENZE, VORSCHLAG: VORSCHLAG,
    chart: chart, tabelle: tabelle, zuTracked: zuTracked, weitereSeiten: weitereSeiten,
    seite: seite, status: status, anlegen: anlegen, discover: discover,
    zuMeta: zuMeta, zuDiscover: zuDiscover, zuAnlage: zuAnlage,
    fehlerArt: fehlerArt, meldung: meldung, hinweis: hinweis, hinweisZahl: hinweisZahl,
    makeLader: makeLader
  };
})();
