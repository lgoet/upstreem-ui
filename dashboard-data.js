/* upstreem dashboard-data.js -- der Datenteil der Dashboard-Seite (08.10.), OHNE DOM.

   WARUM EIN EIGENER TEIL: wie citations-data.js. Die Seite soll spaeter ohne Bubble laufen
   koennen (Next.js); was hier steht, kennt weder Elemente noch Bubble -- nur den Filterstand, die
   RPCs des Vertrags und die Form, in der die eingebetteten Bausteine ihre Daten lesen.

   Vertrag: bubble/dashboard_v1_vertrag.md. Testdaten: testdaten/dashboard_v1/beispiele.json.
   Top Citations und die Trending-Listen im Agentic kommen aus Citations v1 (Vertrag: "Gleiche
   Zahl, eine Quelle") -- die Anfragen dafuer baut citations-data.js, hier wird nur gesagt, welche.

   Der Filterstand f: { team, von, bis, modelle[], maerkte[], topics[], tagmode }.

   Exportiert als window.UpstreemDashboardDaten. Braucht window.UpstreemCitationsDaten. */
(function () {
  "use strict";
  if (window.UpstreemDashboardDaten) return;

  function isArr(v) { return Object.prototype.toString.call(v) === "[object Array]"; }
  function str(v) { return v == null || typeof v === "object" ? "" : String(v); }
  function num(v) { if (v == null || v === "" || typeof v === "boolean") return null; var n = Number(v); return isFinite(n) ? n : null; }
  /* Leer heisst "alle" (Vertrag: null oder []). null statt [] -- dann steht der Parameter in der
     Signatur des Caches gleich, egal ob die Auswahl nie gesetzt oder geleert wurde. */
  function liste(a) { a = isArr(a) ? a.map(str).map(function (x) { return x.trim(); }).filter(Boolean) : []; return a.length ? a : null; }
  function sucheVon(s) { s = str(s).trim(); return s ? s.slice(0, 200) : null; }
  function ganz(v, vorgabe, min, max) { var n = num(v); n = n == null ? vorgabe : Math.round(n); return Math.max(min, Math.min(max, n)); }
  /* Eine uuid und nichts anderes: eine Firmen-Kennung kommt aus einem Klick in der Oberflaeche,
     und was dort nicht wie eine uuid aussieht, wuerde die DB mit 22P02 ablehnen -- und damit den
     ganzen Aufruf statt nur den einen Eintrag. */
  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  function uuids(a, max) {
    var l = (liste(a) || []).filter(function (x) { return UUID.test(x); });
    var gesehen = {};
    l = l.filter(function (x) { var k = x.toLowerCase(); if (gesehen[k]) return false; gesehen[k] = true; return true; });
    if (max) l = l.slice(0, max);
    return l.length ? l : null;
  }
  function mit(o, x) { for (var k in x) if (Object.prototype.hasOwnProperty.call(x, k)) o[k] = x[k]; return o; }
  function C() { return window.UpstreemCitationsDaten; }

  var FN = {
    overview: "cached_dashboard_overview_v1",
    visibility: "cached_dashboard_visibility_v1",
    responses: "cached_dashboard_responses_v1",
    chats: "dashboard_chats_v1",
    opportunities: "dashboard_opportunities_v1",
    clear: "clear_dashboard_cache_v1"
  };
  var ORDER = {
    overview: ["visibility_desc", "visibility_asc", "rank_asc", "rank_desc", "sentiment_desc", "sentiment_asc",
               "mentions_desc", "mentions_asc", "name_asc", "name_desc"],
    responses: ["run_at_desc", "run_at_asc", "rank_asc", "rank_desc", "sentiment_asc", "sentiment_desc"]
  };
  function orderVon(art, o) { o = str(o); return ORDER[art].indexOf(o) >= 0 ? o : ORDER[art][0]; }
  /* Vertrag: p_limit der Responses 1-100 (Nachtrag 09.10., vorher 1-50 und die 100er-Seite in zwei
     Haelften). responsesTeile bleibt, liefert jetzt aber genau einen Teil. */
  var RESPONSES_MAX = 100;

  /* ---- Zeitraum ---------------------------------------------------------------------------------
     Das Agentic-Dashboard zeigt immer die letzten 30 Tage (wie bisher: range last_30_days, "Last
     30 days"). Gerechnet als BERLINER Kalendertag, wie die DB rechnet -- sonst bekommt jemand
     zwischen Mitternacht Berlin und Mitternacht UTC einen Tag zu wenig. */
  function berlinHeute(jetzt) {
    var d = jetzt || new Date();
    try {
      return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
    } catch (e) { return d.toISOString().slice(0, 10); }
  }
  function tageZurueck(iso, n) {
    var t = Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) - n * 86400000;
    return new Date(t).toISOString().slice(0, 10);
  }
  function letzte30(jetzt) { var bis = berlinHeute(jetzt); return { von: tageZurueck(bis, 29), bis: bis }; }

  /* ---- Anfragen bauen -------------------------------------------------------------------------- */
  function basis(f) {
    f = f || {};
    return {
      p_team: str(f.team), p_date_from: str(f.von) || null, p_date_to: str(f.bis) || null,
      p_models: liste(f.modelle), p_markets: liste(f.maerkte), p_tag_ids: uuids(f.topics),
      p_tagmode: f.tagmode === "and" ? "and" : "or"
    };
  }
  function anfrage(art, params) { return { art: art, fn: FN[art], params: params, sig: FN[art] + "|" + JSON.stringify(params) }; }

  /* Overview: own, field und die Markenliste. o: { order, limit, offset, suche, firmen } */
  function overview(f, o) {
    o = o || {};
    return anfrage("overview", mit(basis(f), {
      p_order: orderVon("overview", o.order), p_limit: ganz(o.limit, 25, 1, 100), p_offset: ganz(o.offset, 0, 0, 1e9),
      p_search: sucheVon(o.suche), p_companies: uuids(o.firmen, 100)
    }));
  }
  /* Visibility-Chart. o: { gran, firmen } -- ohne Auswahl die Top 7 (eigene Marke immer dabei). */
  function visibility(f, o) {
    o = o || {};
    var gran = o.gran === "week" || o.gran === "month" ? o.gran : "day";
    var firmen = uuids(o.firmen, 10);
    var p = mit(basis(f), { p_granularity: gran, p_companies: firmen });
    if (!firmen) p.p_series_limit = ganz(o.serien, 7, 1, 10);
    return anfrage("visibility", p);
  }
  /* Responses. r: { order, limit, offset, suche, erwaehnt, firmen, sentMin, sentMax, rankMin, rankMax } */
  function responses(f, r) {
    r = r || {};
    var sMin = num(r.sentMin), sMax = num(r.sentMax), rMin = num(r.rankMin), rMax = num(r.rankMax);
    if (sMin != null) sMin = Math.max(0, Math.min(100, Math.round(sMin)));
    if (sMax != null) sMax = Math.max(0, Math.min(100, Math.round(sMax)));
    if (sMin != null && sMax != null && sMin > sMax) { var s = sMin; sMin = sMax; sMax = s; }
    if (rMin != null) rMin = Math.max(1, Math.round(rMin));
    if (rMax != null) rMax = Math.max(1, Math.round(rMax));
    if (rMin != null && rMax != null && rMin > rMax) { var x = rMin; rMin = rMax; rMax = x; }
    return anfrage("responses", mit(basis(f), {
      p_order: orderVon("responses", r.order), p_limit: ganz(r.limit, 15, 1, RESPONSES_MAX), p_offset: ganz(r.offset, 0, 0, 1e9),
      p_search: sucheVon(r.suche),
      p_mentioned: r.erwaehnt === "yes" || r.erwaehnt === "no" ? r.erwaehnt : "all",
      p_company_ids: uuids(r.firmen, 100),
      p_sentiment_min: sMin, p_sentiment_max: sMax, p_rank_min: rMin, p_rank_max: rMax
    }));
  }
  /* Mehr als 50 Zeilen (die Tabelle bietet 100 an): in Teilen zu 50, die Seite legt sie zusammen. */
  function responsesTeile(f, r) {
    r = r || {};
    var limit = ganz(r.limit, 15, 1, 100), offset = ganz(r.offset, 0, 0, 1e9), teile = [];
    for (var o = 0; o < limit; o += RESPONSES_MAX) {
      teile.push(responses(f, mit(mit({}, r), { limit: Math.min(RESPONSES_MAX, limit - o), offset: offset + o })));
    }
    return teile;
  }
  function clear(team) { return { art: "clear", fn: FN.clear, params: { p_team: str(team) }, sig: "" }; }
  /* Agentic, Nachtrag 09.10.: die Chats des angemeldeten Nutzers (Recent chats, Miras Liste) und
     alle Opportunities des Teams (das geliehene Brett). Vorher kamen beide aus
     get_power_dashboard_v1 ueber einen Bubble-Schritt. */
  function chats(team, o) {
    o = o || {};
    return anfrage("chats", { p_team: str(team), p_limit: ganz(o.limit, 15, 1, 50), p_offset: ganz(o.offset, 0, 0, 1e9) });
  }
  function opportunities(team) { return anfrage("opportunities", { p_team: str(team) }); }

  /* Citations v1 fuer Top Citations und die Trending-Listen. Der Chart (Typ-Verteilung) bekommt
     KEINE Typ-Filter: der Ring zeigt alle Typen und dimmt die nicht gewaehlten -- mit dem Filter
     im Aufruf stuende dort nur noch der gewaehlte Typ, als ein voller Kreis. Die Liste dagegen
     ist gefiltert. "Brand mentioned" gilt fuer beide. */
  function citFilter(f, t) {
    t = t || {};
    return { team: f.team, von: f.von, bis: f.bis, modelle: f.modelle, maerkte: f.maerkte, topics: f.topics, tagmode: f.tagmode,
             erwaehnt: t.erwaehnt, marken: null, citationTypen: t.citationTypen || null, urlTypen: t.urlTypen || null };
  }
  function topTypen(f, modus, t) {
    t = t || {};
    return C().overview(citFilter(f, { erwaehnt: t.erwaehnt }), { modus: modus === "url" ? "url" : "domain", gran: "day", serien: 0 });
  }
  function topListe(f, modus, t) {
    t = t || {};
    var cf = citFilter(f, t), tab = { order: t.order || "share_desc", limit: t.limit || 7, offset: 0, suche: "" };
    return modus === "url" ? C().urls(cf, tab) : C().domains(cf, tab);
  }

  /* ---- Antworten in die Form der Bausteine -----------------------------------------------------
     Nichts wird nachgerechnet: was die DB null nennt, bleibt null (Strich in der Zelle). */
  function meta(d) { return d && d.meta && typeof d.meta === "object" ? d.meta : {}; }
  function zeilen(d) { return d && isArr(d.rows) ? d.rows.filter(function (r) { return r && typeof r === "object"; }) : null; }
  function istObjekt(d) { return !!d && typeof d === "object" && !isArr(d); }
  function absolut(u) { u = str(u).trim(); if (/^\/\//.test(u)) u = "https:" + u; return /^https?:\/\//i.test(u) ? u : ""; }
  /* "Used" wie in der Domains-Tabelle (domains-table.js): Runs mit der Domain, sonst used_total. */
  function benutzt(x) { var n = num(x.runs_with_domain); return n != null ? n : num(x.used_total); }
  function marke(r) {
    return {
      company_id: str(r.company_id), position: num(r.position), name: str(r.name), logo_url: absolut(r.logo_url),
      is_own: r.is_own === true, visibility_pct: num(r.visibility_pct), visibility_delta_pct: num(r.visibility_delta_pct),
      avg_rank: num(r.avg_rank), avg_rank_delta: num(r.avg_rank_delta), sentiment: num(r.sentiment), sentiment_delta: num(r.sentiment_delta),
      mentions: num(r.mentions)
    };
  }

  /* Visibility-Chart (renderVisibilityChart): Kurve aus visibility_v1, Tabelle aus overview_v1.
     Ein Punkt OHNE Wert (keine Runs, oder ausserhalb des Tracking-Fensters) faellt weg: die Linie
     laeuft dann ueber den Tag hinweg, wie bei jedem Linienchart der App, statt auf 0 zu fallen --
     0 waere eine Messung, die es nicht gab. */
  /* o.nurImChart: die Tabelle zeigt nur die Marken, die auch im Chart stehen -- die Seite setzt das
     nur bei einer eigenen Auswahl im Fader (dieselbe Menge wie p_companies). Ohne Auswahl sortiert
     die Tabelle ueber alle Marken (dashboard-page.js, visAuftrag). */
  function zuVisibility(vis, ov, o) {
    o = o || {};
    if (!istObjekt(vis) || !isArr(vis.series) || !isArr(vis.companies)) return null;
    if (!istObjekt(ov) || !isArr(ov.rows)) return null;
    var series = vis.series.filter(function (p) { return p && p.company_id != null && p.bucket && num(p.visibility_pct) != null; })
      .map(function (p) { return { company_id: str(p.company_id), day: str(p.bucket).slice(0, 10), visibility_pct: num(p.visibility_pct) }; });
    var companies = vis.companies.filter(function (c) { return c && c.company_id != null; }).map(function (c) {
      var col = str(c.color).trim();
      return { company_id: str(c.company_id), name: str(c.name), favicon_url: absolut(c.logo_url),
               color: /^#[0-9a-f]{3,8}$/i.test(col) ? col : null, visibility_window_pct: num(c.visibility_pct) };
    });
    var m = meta(ov), tabelle = zeilen(ov);
    if (o.nurImChart && companies.length) {
      var imChart = {};
      companies.forEach(function (c) { imChart[c.company_id] = true; });
      tabelle = tabelle.filter(function (r) { return imChart[str(r.company_id)]; });
    }
    return {
      series: series, companies: companies,
      table: tabelle.map(marke),
      totalCount: num(m.total_count) == null ? zeilen(ov).length : num(m.total_count),
      granularity: str(meta(vis).granularity) || "day"
    };
  }
  /* Nur die Tabelle (Sortierung): dieselbe Form, ohne Kurve. */
  function zuMarkentabelle(ov) {
    if (!istObjekt(ov) || !isArr(ov.rows)) return null;
    var m = meta(ov);
    return { table: zeilen(ov).map(marke), totalCount: num(m.total_count) == null ? zeilen(ov).length : num(m.total_count) };
  }

  /* Top Citations (renderTopCitations). types_breakdown traegt im Domain-Modus die Citation Types,
     im URL-Modus die URL Types -- genau das liefert cached_citations_overview_v1 mit p_mode. */
  function zuTop(typen, list, modus) {
    if (!istObjekt(typen) || !isArr(typen.types)) return null;
    var r = zeilen(list);
    if (!r) return null;
    var url = modus === "url", total = num(meta(list).total_count);
    var aus = {
      mode: url ? "url" : "domain",
      citations_total: typen.kpis && num(typen.kpis.citations_total) != null ? num(typen.kpis.citations_total) : 0,
      types_breakdown: typen.types.filter(function (x) { return x && x.type != null; })
        .map(function (x) { return { type: str(x.type), share_pct: num(x.share_pct) == null ? 0 : num(x.share_pct) }; })
    };
    if (url) {
      aus.top_urls = r.map(function (x) {
        return { url: str(x.url), title: str(x.title), favicon: absolut(x.favicon), url_type: str(x.url_type),
                 global_share_pct: num(x.global_share_pct), share_delta_pct: num(x.share_delta_pct), used_total: num(x.runs_with_url) };
      });
      aus.totalCountUrl = total == null ? r.length : total;
    } else {
      aus.top_domains = r.map(function (x) {
        return { domain: str(x.domain), favicon: absolut(x.favicon), citation_type: str(x.citation_type),
                 share_pct: num(x.share_pct), share_delta_pct: num(x.share_delta_pct), used_total: benutzt(x) };
      });
      aus.totalCountDomain = total == null ? r.length : total;
    }
    return aus;
  }

  /* Agentic (renderPowerDashboard). Die eigene Marke steht nur in own (Vertrag); die Liste zeigt
     fuenf Zeilen und haengt sie selbst an, wenn sie weiter hinten steht -- dafuer kommt sie hier mit
     ihrer echten Position dazu. Ohne eigene Marke (own null) bleibt es bei den fuenf. */
  function zuPowerUeberblick(ov) {
    if (!istObjekt(ov) || !isArr(ov.rows) || !istObjekt(ov.field || {})) return null;
    var own = istObjekt(ov.own) ? ov.own : null, fld = istObjekt(ov.field) ? ov.field : {};
    var brands = zeilen(ov).map(marke);
    if (own && !brands.some(function (b) { return b.company_id === str(own.company_id); })) {
      var o = marke(own); o.is_own = true; brands.push(o);
    }
    return {
      overview: {
        range_label: "Last 30 days",
        visibility_pct: own ? num(own.visibility_pct) : null, visibility_delta_pct: own ? num(own.visibility_delta_pct) : null,
        visibility_position: own ? num(own.position) : null, brand_count: num(fld.brand_count),
        avg_rank: own ? num(own.avg_rank) : null, avg_rank_delta: own ? num(own.avg_rank_delta) : null, best_rank: num(fld.best_rank),
        sentiment: own ? num(own.sentiment) : null, sentiment_delta: own ? num(own.sentiment_delta) : null,
        field_avg_sentiment: num(fld.avg_sentiment)
      },
      brands: brands
    };
  }
  function zuPowerDomains(d) {
    var r = zeilen(d);
    if (!r) return null;
    return {
      top_domains: r.map(function (x) { return { domain: str(x.domain), favicon: absolut(x.favicon), citation_type: str(x.citation_type),
        share_pct: num(x.share_pct), share_delta_pct: num(x.share_delta_pct), used_total: benutzt(x) }; }),
      totalCountDomain: num(meta(d).total_count)
    };
  }
  function zuPowerUrls(d) {
    var r = zeilen(d);
    if (!r) return null;
    return {
      top_urls: r.map(function (x) { return { url: str(x.url), title: str(x.title), favicon: absolut(x.favicon), url_type: str(x.url_type),
        global_share_pct: num(x.global_share_pct), share_delta_pct: num(x.share_delta_pct), used_total: num(x.runs_with_url) }; }),
      totalCountUrl: num(meta(d).total_count)
    };
  }

  /* Responses (renderResponsesTable): die Zeilen haben die Felder von v21, also genau die, die die
     Tabelle liest. Die Gesamtzahl steht nur in meta. Mehrere Teile (100 je Seite) werden in ihrer
     Reihenfolge aneinandergehaengt. */
  /* Bilder nur von http(s): die Tabelle setzt favicon_url/favicon als <img src>, und was dort aus
     der DB kaeme (javascript:, data:, ein abgeschnittenes Attribut), gehoert nicht ins Dokument --
     gefunden im Test mit manipulierten Antworten (08.10.). Der Rest der Zeile bleibt wie geliefert. */
  function zeileSauber(r) {
    var o = {}, k;
    for (k in r) if (Object.prototype.hasOwnProperty.call(r, k)) o[k] = r[k];
    if (isArr(r.companies_preview)) o.companies_preview = r.companies_preview.filter(function (c) { return c && typeof c === "object"; })
      .map(function (c) { var x = mit({}, c); x.favicon_url = absolut(c.favicon_url); return x; });
    if (isArr(r.sources_preview)) o.sources_preview = r.sources_preview.filter(function (c) { return c && typeof c === "object"; })
      .map(function (c) { var x = mit({}, c); x.favicon = absolut(c.favicon); return x; });
    return o;
  }
  function zuResponses(teile) {
    if (!isArr(teile)) teile = [teile];
    var rows = [], total = null;
    for (var i = 0; i < teile.length; i++) {
      var r = zeilen(teile[i]);
      if (!r) return null;
      if (total == null) total = num(meta(teile[i]).total_count);
      rows = rows.concat(r.map(zeileSauber));
    }
    return { rows: rows, totalCount: total == null ? rows.length : total };
  }

  /* Miras Liste liest id, title, updated_at -- mehr soll nicht hinein (Vertrag: keine Vorschau). */
  function zuChats(d) {
    var r = zeilen(d);
    if (!r) return null;
    return r.filter(function (x) { return x.id != null; })
      .map(function (x) {
        /* Nur was da ist: ein fehlender Zeitstempel soll in Miras Liste den bekannten nicht
           ueberschreiben (askMiraSetPreviousChats behaelt, was eine Zeile nicht traegt). */
        var o = { id: str(x.id), title: str(x.title) };
        if (x.updated_at != null) o.updated_at = str(x.updated_at);
        return o;
      });
  }
  /* Die Zeilen gehen unveraendert an opportunitiesSetItems (dieselben Felder wie bisher). */
  function zuOpportunities(d) { return zeilen(d); }

  function fehlerArt(erg) { return C() && C().fehlerArt ? C().fehlerArt(erg) : "x"; }
  function makeLader(o) { return C().makeLader(o); }

  window.UpstreemDashboardDaten = {
    FN: FN, ORDER: ORDER, RESPONSES_MAX: RESPONSES_MAX,
    letzte30: letzte30, berlinHeute: berlinHeute,
    overview: overview, visibility: visibility, responses: responses, responsesTeile: responsesTeile, clear: clear,
    chats: chats, opportunities: opportunities, zuChats: zuChats, zuOpportunities: zuOpportunities,
    topTypen: topTypen, topListe: topListe,
    zuVisibility: zuVisibility, zuMarkentabelle: zuMarkentabelle, zuTop: zuTop,
    zuPowerUeberblick: zuPowerUeberblick, zuPowerDomains: zuPowerDomains, zuPowerUrls: zuPowerUrls,
    zuResponses: zuResponses, fehlerArt: fehlerArt, makeLader: makeLader
  };
})();
