/* upstreem citations-data.js -- der Datenteil der Citations-Seite (08.10.), OHNE DOM.

   WARUM EIN EIGENER TEIL: die Seite soll irgendwann aus Bubble in eine normale Web-App (Next.js)
   wechseln. Was hier steht, kennt weder Elemente noch Bubble -- nur den Filterstand, die vier RPCs
   des Vertrags und die Form, in der die eingebetteten Bausteine ihre Daten lesen. Es laesst sich so
   wie es ist mitnehmen; ersetzt wird dort nur der Teil, der zeichnet (citations-page.js).

   Vertrag: bubble/citations_v1_vertrag.md. Testdaten: testdaten/citations_v1/.

   Der Filterstand f (eine Seite, beide Reiter -- 08.10.: "Domain und URL teilen sich die
   Filterstates"):
     { team, von, bis, modelle[], maerkte[], topics[], tagmode, erwaehnt: "all"|"yes"|"no",
       marken[], citationTypen[], urlTypen[] }
   Eine Tabelle t: { suche, order, limit, offset }

   Exportiert als window.UpstreemCitationsDaten. */
(function () {
  "use strict";
  if (window.UpstreemCitationsDaten) return;

  function isArr(v) { return Object.prototype.toString.call(v) === "[object Array]"; }
  function str(v) { return v == null || typeof v === "object" ? "" : String(v); }
  function num(v) { if (v == null || v === "" || typeof v === "boolean") return null; var n = Number(v); return isFinite(n) ? n : null; }
  /* Leer heisst "alle" (Vertrag: null oder []). null statt [] -- dann steht der Parameter in der
     Signatur des Caches gleich, egal ob die Auswahl nie gesetzt oder geleert wurde. */
  function liste(a) { a = isArr(a) ? a.map(str).map(function (x) { return x.trim(); }).filter(Boolean) : []; return a.length ? a : null; }
  function sucheVon(s) { s = str(s).trim(); return s ? s.slice(0, 200) : null; }
  function ganz(v, vorgabe, min, max) { var n = num(v); n = n == null ? vorgabe : Math.round(n); return Math.max(min, Math.min(max, n)); }

  var FN = {
    overview: "cached_citations_overview_v1",
    domains: "cached_citations_domains_v1",
    urls: "cached_citations_urls_v1",
    domainUrls: "cached_citations_domain_urls_v1",
    clear: "clear_citations_cache_v1"
  };
  var ORDER = {
    domains: ["share_desc", "share_asc", "share_delta_desc", "share_delta_asc", "last_used_desc", "last_used_asc",
              "domain_asc", "domain_desc", "urls_count_desc", "urls_count_asc"],
    urls: ["share_desc", "share_asc", "share_delta_desc", "share_delta_asc", "last_used_desc", "last_used_asc", "domain_asc", "url_asc"],
    domainUrls: ["domainshare_desc", "domainshare_asc", "share_delta_desc", "share_delta_asc", "last_used_desc", "url_asc"]
  };
  function orderVon(art, o) { o = str(o); return ORDER[art].indexOf(o) >= 0 ? o : ORDER[art][0]; }

  /* ---- Anfragen bauen --------------------------------------------------------------------------
     Die Typ-Filter gehen nur dorthin, wo sie gelten: die Domains-Tabelle kennt keine URL-Typen
     (Vertrag: "bei domains immer ignoriert"). Schickte man sie trotzdem, stuende im Cache der DB
     fuer jede URL-Typ-Auswahl eine eigene Kopie derselben Domains-Liste. */
  function basis(f, art) {
    f = f || {};
    var b = {
      p_team: str(f.team), p_date_from: str(f.von) || null, p_date_to: str(f.bis) || null,
      p_models: liste(f.modelle), p_markets: liste(f.maerkte), p_tag_ids: liste(f.topics),
      p_tagmode: f.tagmode === "and" ? "and" : "or",
      p_mentioned: f.erwaehnt === "yes" || f.erwaehnt === "no" ? f.erwaehnt : "all",
      p_mentioned_brands: liste(f.marken),
      p_citation_types: liste(f.citationTypen)
    };
    if (art !== "domains") b.p_url_types = liste(f.urlTypen);
    return b;
  }
  function mit(o, x) { for (var k in x) if (Object.prototype.hasOwnProperty.call(x, k)) o[k] = x[k]; return o; }
  function anfrage(art, params) { return { art: art, fn: FN[art], params: params, sig: FN[art] + "|" + JSON.stringify(params) }; }

  function overview(f, o) {
    o = o || {};
    var modus = o.modus === "url" ? "url" : "domain";
    var gran = o.gran === "week" || o.gran === "month" ? o.gran : "day";
    /* Im Domain-Modus gilt die Tabelle der Domains -- also auch ihr Filterumfang (ohne URL-Typen). */
    return anfrage("overview", mit(basis(f, modus === "url" ? "urls" : "domains"),
      { p_mode: modus, p_granularity: gran, p_series_limit: 7 }));
  }
  function tabelle(art, f, t) {
    t = t || {};
    return anfrage(art, mit(basis(f, art), {
      p_search: sucheVon(t.suche), p_order: orderVon(art, t.order),
      p_limit: ganz(t.limit, 25, 1, 100), p_offset: ganz(t.offset, 0, 0, 1e9)
    }));
  }
  function domains(f, t) { return tabelle("domains", f, t); }
  function urls(f, t) { return tabelle("urls", f, t); }
  /* Der Drilldown einer Domain: eigene Suche und eigene URL-Typen (die Unterzeile der Tabelle),
     die uebrigen Filter wie die Seite. */
  function domainUrls(f, domain, s) {
    s = s || {};
    var b = basis(f, "domainUrls");
    b.p_url_types = liste(s.urlTypen);
    return anfrage("domainUrls", mit(b, {
      p_domain: str(domain).trim(), p_search: sucheVon(s.suche), p_order: orderVon("domainUrls", s.order),
      p_limit: ganz(s.limit, 10, 1, 100), p_offset: ganz(s.offset, 0, 0, 1e9)
    }));
  }
  function clear(team) { return { art: "clear", fn: FN.clear, params: { p_team: str(team) }, sig: "" }; }

  /* ---- Antworten in die Form der Bausteine -----------------------------------------------------
     Nichts wird nachgerechnet: was die DB null nennt, bleibt null (Strich in der Zelle). */
  function meta(d) { return d && d.meta && typeof d.meta === "object" ? d.meta : {}; }
  function zeilen(d) { return d && isArr(d.rows) ? d.rows.filter(function (r) { return r && typeof r === "object"; }) : null; }

  /* Combo-Chart (renderComboChart). Die Zeitreihe kommt je Bucket; der Chart liest "day" als
     x-Wert -- bei Woche und Monat ist das der Anfang des Buckets (Vertrag: bucket). Die Reihen
     sind genau die ersten sieben Zeilen der Tabelle (Vertrag: "identisch mit der Tabelle"), also
     global_share = share_pct der Reihe. */
  function zuCombo(d, modus) {
    if (!d || typeof d !== "object" || !isArr(d.series) || !isArr(d.timeseries)) return null;
    var m = meta(d), url = (modus || m.mode) === "url";
    var series = d.timeseries.filter(function (p) { return p && p.key != null; }).map(function (p) {
      var o = { day: str(p.bucket), share_pct: num(p.share_pct) == null ? 0 : num(p.share_pct),
                bucket_from: str(p.bucket_from), bucket_to: str(p.bucket_to), partial: !!p.partial };
      o[url ? "url" : "domain"] = str(p.key);
      return o;
    });
    var aus = {
      dataMode: url ? "url" : "domain",
      granularity: str(m.granularity) || "day",
      total: d.kpis && num(d.kpis.citations_total) != null ? num(d.kpis.citations_total) : 0,
      typeSplit: (isArr(d.types) ? d.types : []).filter(function (x) { return x && x.type != null; })
        .map(function (x) { return { type: str(x.type), share_pct: num(x.share_pct) == null ? 0 : num(x.share_pct), count: num(x.count) }; }),
      series: series
    };
    var reihen = d.series.filter(function (s) { return s && s.key != null; });
    if (url) {
      aus.urls = reihen.map(function (s) {
        return { url: str(s.url || s.key), title: str(s.title), url_type: str(s.url_type), favicon: str(s.favicon),
                 global_share: num(s.share_pct), domain: str(s.domain) };
      });
      aus.domains = [];
    } else {
      aus.domains = reihen.map(function (s) {
        return { domain: str(s.domain || s.key), citation_type: str(s.citation_type), favicon: str(s.favicon), global_share: num(s.share_pct) };
      });
      aus.urls = [];
    }
    return aus;
  }
  /* Domains-Tabelle (renderDomainsTable): die Felder heissen schon so, wie die Tabelle sie liest. */
  function zuDomains(d) {
    var r = zeilen(d);
    if (!r) return null;
    return { rows: r, totalCount: num(meta(d).total_count) == null ? r.length : num(meta(d).total_count) };
  }
  /* Marken an einer URL: die Tabelle liest name und favicon_url (UC.brandStack). */
  function marken(liste0) {
    return (isArr(liste0) ? liste0 : []).filter(function (x) { return x && typeof x === "object"; }).map(function (x) {
      return { name: str(x.name), favicon_url: str(x.logo_url), company_id: str(x.company_id), role: str(x.role) };
    });
  }
  function urlZeile(r) {
    var o = {}, k;
    for (k in r) if (Object.prototype.hasOwnProperty.call(r, k)) o[k] = r[k];
    o.last_seen = r.last_used_at;
    o.mentions = marken(r.mentions);
    o.mentions_totalcount = r.mentions_total;
    return o;
  }
  function zuUrls(d) {
    var r = zeilen(d);
    if (!r) return null;
    return { rows: r.map(urlZeile), totalCount: num(meta(d).total_count) == null ? r.length : num(meta(d).total_count) };
  }
  /* Drilldown (setDomainsTablePages): die Gesamtzahl liest die Tabelle am ersten Eintrag. */
  function zuDrilldown(d) {
    var r = zeilen(d);
    if (!r) return null;
    var total = num(meta(d).total_count);
    return r.map(function (x, i) {
      var o = { url: str(x.url), title: str(x.title), favicon: str(x.favicon), domain_share: num(x.domainshare_pct),
                url_type: str(x.url_type), last_seen: x.last_used_at };
      if (i === 0) o.total_count = total == null ? r.length : total;
      return o;
    });
  }

  /* Ein Fehler als Art -- die Seite waehlt danach ihren Satz. Gelesen wird message, nicht der
     Status: gegen Prod gemessen kommt citations_rate_limited als HTTP 500 (Vertrag 08.10.). */
  function fehlerArt(erg) {
    var f = (erg && erg.fehler) || {}, m = str(f.message).toLowerCase(), c = str(f.code);
    if (/rate_limited/.test(m)) return "rate";
    if (m === "forbidden" || c === "42501" || c === "P0403" || /team_access|not authenticated/.test(m) || erg.status === 401 || erg.status === 403) return "zugang";
    if (/invalid_param|invalid_date|domain_required/.test(m)) return "param";
    if (m === "network" || m === "timeout" || erg.status === 0) return "netz";
    return "x";
  }

  /* ---- Der Lader -------------------------------------------------------------------------------
     Je Kanal gewinnt die JUENGSTE Anfrage: eine neue bricht die alte ab (AbortController), und
     eine Antwort, die nach einer neueren ankommt, faellt weg. Antworten liegen je Signatur im
     Speicher (hoechstens 60): ein Zurueck auf Seite 1 oder auf den anderen Reiter laedt nichts.
     rufen(fn, params, opts) -> Promise<{ok, status, daten|fehler}> -- in der App UC.rpc. */
  function makeLader(o) {
    o = o || {};
    var rufen = o.rufen, MAX = o.max || 60;
    var cache = {}, reihe = [], laufend = {}, zaehler = 0;
    function merken(sig, d) {
      cache[sig] = d;
      var i = reihe.indexOf(sig);
      if (i >= 0) reihe.splice(i, 1);
      reihe.push(sig);
      while (reihe.length > MAX) delete cache[reihe.shift()];
    }
    function abbrechen(kanal) {
      var l = laufend[kanal];
      if (l) { laufend[kanal] = null; if (l.ctrl) { try { l.ctrl.abort(); } catch (e) {} } }
    }
    function laden(kanal, a, opts) {
      opts = opts || {};
      if (!opts.frisch && a.sig && Object.prototype.hasOwnProperty.call(cache, a.sig)) {
        abbrechen(kanal);
        return Promise.resolve({ ok: true, daten: cache[a.sig], ausSpeicher: true });
      }
      var l = laufend[kanal];
      if (l && l.sig === a.sig && !opts.frisch) return l.promise;
      abbrechen(kanal);
      var nr = ++zaehler, ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
      var eintrag = { sig: a.sig, nr: nr, ctrl: ctrl };
      laufend[kanal] = eintrag;
      eintrag.promise = Promise.resolve(rufen(a.fn, a.params, { signal: ctrl ? ctrl.signal : undefined })).then(function (erg) {
        var aktuell = laufend[kanal] === eintrag;
        if (aktuell) laufend[kanal] = null;
        if (!aktuell) return { ok: false, ueberholt: true };
        if (erg && erg.ok && a.sig) merken(a.sig, erg.daten);
        return erg || { ok: false, status: 0, fehler: { message: "network" } };
      }, function () {
        /* Abgebrochen, weil eine neuere Anfrage desselben Kanals kam: ueberholt, kein Fehler. */
        if (laufend[kanal] !== eintrag) return { ok: false, ueberholt: true };
        laufend[kanal] = null;
        return { ok: false, status: 0, fehler: { message: "network" } };
      });
      return eintrag.promise;
    }
    return {
      laden: laden, abbrechen: abbrechen,
      laeuft: function (kanal) { return !!laufend[kanal]; },
      leeren: function () { cache = {}; reihe = []; },
      ausSpeicher: function (a) { return a && a.sig && Object.prototype.hasOwnProperty.call(cache, a.sig) ? cache[a.sig] : undefined; }
    };
  }

  window.UpstreemCitationsDaten = {
    FN: FN, ORDER: ORDER,
    overview: overview, domains: domains, urls: urls, domainUrls: domainUrls, clear: clear,
    zuCombo: zuCombo, zuDomains: zuDomains, zuUrls: zuUrls, zuDrilldown: zuDrilldown,
    fehlerArt: fehlerArt, makeLader: makeLader
  };
})();
