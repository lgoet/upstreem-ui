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
  /* Kennungen (Topics, Marken) nur, wenn sie wie eine uuid aussehen, ohne Dubletten. Ein einziger
     anderer Eintrag liesse die DB den GANZEN Aufruf ablehnen (22P02, uuid[]) -- gefunden am 08.10.
     im Test mit einem manipulierten Topic-Ereignis ("'; drop"). */
  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  function uuids(a) {
    var gesehen = {};
    var l = (liste(a) || []).filter(function (x) { var k = x.toLowerCase(); if (!UUID.test(x) || gesehen[k]) return false; gesehen[k] = true; return true; });
    return l.length ? l : null;
  }
  function sucheVon(s) { s = str(s).trim(); return s ? s.slice(0, 200) : null; }
  function ganz(v, vorgabe, min, max) { var n = num(v); n = n == null ? vorgabe : Math.round(n); return Math.max(min, Math.min(max, n)); }

  var FN = {
    overview: "cached_citations_overview_v1",
    domains: "cached_citations_domains_v1",
    urls: "cached_citations_urls_v1",
    domainUrls: "cached_citations_domain_urls_v1",
    clear: "clear_citations_cache_v1",
    /* Die Berechnungen der Gesamtzeilen (15.10. spaet, Auftrag bubble/summen_db_auftrag_15_10.md,
       3 und 4): je Tabelle eine EIGENE Abfrage neben der Liste. */
    domainsSumme: "cached_citations_domains_summary_v1",
    urlsSumme: "cached_citations_urls_summary_v1"
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
  /* Intent-Filter der App (13.10., core: UC.intentFilterParams). Leer, solange die Intents nicht
     freigegeben sind -- dann geht kein neuer Parameter hinaus. */
  function intentDazu(o) {
    var U = window.UpstreemCore, x = U && U.intentFilterParams ? U.intentFilterParams() : {};
    for (var k in x) if (Object.prototype.hasOwnProperty.call(x, k)) o[k] = x[k];
    return o;
  }
  function basis(f, art) {
    f = f || {};
    var b = {
      p_team: str(f.team), p_date_from: str(f.von) || null, p_date_to: str(f.bis) || null,
      p_models: liste(f.modelle), p_markets: liste(f.maerkte), p_tag_ids: uuids(f.topics),
      p_tagmode: f.tagmode === "and" ? "and" : "or",
      p_mentioned: f.erwaehnt === "yes" || f.erwaehnt === "no" ? f.erwaehnt : "all",
      p_mentioned_brands: uuids(f.marken),
      p_citation_types: liste(f.citationTypen)
    };
    if (art !== "domains") b.p_url_types = liste(f.urlTypen);
    return f.ohneIntent ? b : intentDazu(b);
  }
  function mit(o, x) { for (var k in x) if (Object.prototype.hasOwnProperty.call(x, k)) o[k] = x[k]; return o; }
  function anfrage(art, params) { return { art: art, fn: FN[art], params: params, sig: FN[art] + "|" + JSON.stringify(params) }; }
  /* DATENSTAND EINER TABELLE (18.10., Versionsbindung der DB, g3_features_cache): hinter Offset 100
     rechnet die DB den Listeneintrag neu, wenn er veraltet ist; meta.generated_at und total_count
     kommen immer aus dem Eintrag. Aendert sich beides beim Blaettern, zeigt Seite 8 einen anderen
     Stand als Seite 1 (Dublette, Luecke). Der Schluessel ist die Anfrage OHNE Seite, Seitengroesse
     und Sortierung: dort ist ein neuer Stand normal, ein Filter oder eine Suche ist ein anderer
     Schluessel. Eigene Funktion, damit auch dashboard-data.js (Responses) dieselbe Regel nimmt. */
  function bindung(fn, params) {
    var rest = {}, k;
    for (k in params) if (Object.prototype.hasOwnProperty.call(params, k) && k !== "p_offset" && k !== "p_limit" && k !== "p_order") rest[k] = params[k];
    return { schluessel: fn + "|" + JSON.stringify(rest), seite: (params.p_offset || 0) > 0 };
  }
  function listenAnfrage(art, params) { var a = anfrage(art, params); a.bindung = bindung(a.fn, params); return a; }

  function overview(f, o) {
    o = o || {};
    var modus = o.modus === "url" ? "url" : "domain";
    var gran = o.gran === "week" || o.gran === "month" ? o.gran : "day";
    /* o.serien: 0 fuer Top Citations im Dashboard (Vertrag Dashboard v1: nur kpis und types, ohne
       Zeitreihe -- dieselben Zahlen, ein Drittel der Zeit). Ohne Angabe 7 wie die Citations-Seite. */
    var serien = o.serien == null ? 7 : ganz(o.serien, 7, 0, 10);
    /* Im Domain-Modus gilt die Tabelle der Domains -- also auch ihr Filterumfang (ohne URL-Typen). */
    return anfrage("overview", mit(basis(f, modus === "url" ? "urls" : "domains"),
      { p_mode: modus, p_granularity: gran, p_series_limit: serien }));
  }
  function tabelle(art, f, t) {
    t = t || {};
    return listenAnfrage(art, mit(basis(f, art), {
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
    return listenAnfrage("domainUrls", mit(b, {
      p_domain: str(domain).trim(), p_search: sucheVon(s.suche), p_order: orderVon("domainUrls", s.order),
      p_limit: ganz(s.limit, 10, 1, 100), p_offset: ganz(s.offset, 0, 0, 1e9)
    }));
  }
  function clear(team) { return { art: "clear", fn: FN.clear, params: { p_team: str(team) }, sig: "" }; }

  /* ---- Die Berechnungen der Gesamtzeile (15.10. spaet) -------------------------------------------
     Dieselben Filter wie die Liste derselben Tabelle, aber OHNE Sortierung und Seite: Blaettern und
     Sortieren aendern keine Summe (Auftrag 3 und 4: "wie die Liste ohne p_order, p_limit,
     p_offset"). p_fields: nur, was die Tabelle gerade zeigt -- bekannte Namen, einmal, sortiert,
     damit dieselbe Wahl dieselbe Signatur hat und den Speicher des Laders trifft.
     summeFelder und summeLesen sind allgemein: die Responses (dashboard-data.js) lesen ihre Summe
     ueber dieselben zwei Wege. */
  var SUMME_FELDER = {
    domains: ["own_share_pct", "top10_share_pct", "citations_total", "avg_citations_per_domain",
              "top_type", "top_type_share", "types_used", "active_last_7d", "new_in_period"],
    urls: ["own_share_pct", "top10_share_pct", "top_url_type", "top_url_type_share", "mention_rate_pct",
           "avg_brands_per_url", "brands_seen", "active_last_7d", "new_in_period"]
  };
  var SUMME_TEXT = ["top_type", "top_url_type"];
  function summeFelder(felder, erlaubt) {
    var l = (isArr(felder) ? felder : []).map(str).filter(function (x) { return isArr(erlaubt) && erlaubt.indexOf(x) >= 0; });
    return l.filter(function (x, i) { return l.indexOf(x) === i; }).sort();
  }
  function summe(art, f, t, felder) {
    art = art === "urls" ? "urls" : "domains";
    t = t || {};
    return anfrage(art + "Summe", mit(basis(f, art), { p_search: sucheVon(t.suche), p_fields: summeFelder(felder, SUMME_FELDER[art]) }));
  }
  /* Die Antwort (Auftrag 0.8): EIN Objekt mit genau den bestellten Feldern. Zahlen als Zahl oder
     null, Namen und Tage als Text oder null -- ein fehlendes oder unlesbares Feld bleibt weg und wird
     in der Zeile "–", nie 0. Nimmt auch { summary: {...} } und eine Liste mit einem Objekt (eine
     RPC, die eine Tabelle zurueckgibt). Unlesbar: null, die gewaehlten Zellen zeigen "–". */
  function summeLesen(d, felder, text) {
    var s = d && typeof d === "object" && !isArr(d) && d.summary && typeof d.summary === "object" ? d.summary : d;
    if (isArr(s) && s.length === 1 && s[0] && typeof s[0] === "object") s = s[0];
    if (!s || typeof s !== "object" || isArr(s)) return null;
    var o = {};
    (isArr(felder) ? felder : []).forEach(function (k) {
      if (!Object.prototype.hasOwnProperty.call(s, k)) return;
      o[k] = isArr(text) && text.indexOf(k) >= 0 ? (str(s[k]).trim() ? str(s[k]).trim() : null) : num(s[k]);
    });
    return o;
  }
  function zuSumme(art, d) { return summeLesen(d, SUMME_FELDER[art === "urls" ? "urls" : "domains"], SUMME_TEXT); }

  /* ---- Antworten in die Form der Bausteine -----------------------------------------------------
     Nichts wird nachgerechnet: was die DB null nennt, bleibt null (Strich in der Zelle). */
  function meta(d) { return d && d.meta && typeof d.meta === "object" ? d.meta : {}; }
  function zeilen(d) { return d && isArr(d.rows) ? d.rows.filter(function (r) { return r && typeof r === "object"; }) : null; }

  /* Combo-Chart (renderComboChart). Die Zeitreihe kommt je Bucket; der Chart liest "day" als
     x-Wert -- bei Woche und Monat ist das der Anfang des Buckets (Vertrag: bucket). Die Reihen
     sind genau die ersten sieben Zeilen der Tabelle (Vertrag: "identisch mit der Tabelle"), also
     global_share = share_pct der Reihe.
     Ein Bucket OHNE Messung faellt weg, wie in zuVisibility (dashboard-data.js): die Linie laeuft
     ueber ihn hinweg, und ist es der juengste (heute, noch keine Runs), steht der Tag gar nicht erst
     auf der Achse. Anders als visibility_v1, das dort null schickt, liefert die Citations-RPC ein
     DICHTES Raster -- jeder Tag jeder Reihe, ohne Runs mit share_pct 0 und runs_with_any 0
     (gemessen an testdaten/citations_v1/lauf1: 203 von 210 Punkten). Die 0 dort ist 0 durch 0,
     keine Messung; als Wert gezeichnet fiel jede Linie heute auf 0 (gemeldet 13.10.). Fehlt
     runs_with_any in der Antwort, bleibt der Punkt -- nur eine ausdrueckliche 0 ist "nichts
     gemessen". Ein share_pct von 0 bei runs_with_any > 0 ist dagegen echt und bleibt. */
  function gemessen(p) { return num(p.share_pct) != null && num(p.runs_with_any) !== 0; }
  function zuCombo(d, modus) {
    if (!d || typeof d !== "object" || !isArr(d.series) || !isArr(d.timeseries)) return null;
    var m = meta(d), url = (modus || m.mode) === "url";
    var series = d.timeseries.filter(function (p) { return p && p.key != null && gemessen(p); }).map(function (p) {
      var o = { day: str(p.bucket), share_pct: num(p.share_pct),
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
     Status: bis befunde_db_v1.sql kommen citations_rate_limited (P0429) und team_access_*
     (P0403, require_team_access) als HTTP 500, danach als 429 (PT429) und 402 (PT402). message
     und hint bleiben gleich, also traegt message beide Fassungen. Der Status zaehlt nur
     zusaetzlich (429/402 ohne die gewohnte message). */
  function fehlerArt(erg) {
    var f = (erg && erg.fehler) || {}, m = str(f.message).toLowerCase(), c = str(f.code), s = erg ? erg.status : 0;
    if (/rate_limited/.test(m) || c === "PT429" || s === 429) return "rate";
    if (m === "forbidden" || c === "42501" || /^team_access_|not authenticated/.test(m) || s === 401 || s === 402 || s === 403) return "zugang";
    if (/invalid_param|invalid_date|domain_required|team_required/.test(m)) return "param";
    if (m === "network" || m === "timeout" || erg.status === 0) return "netz";
    return "x";
  }

  /* ---- Der Lader -------------------------------------------------------------------------------
     Je Kanal gewinnt die JUENGSTE Anfrage: eine neue bricht die alte ab (AbortController), und
     eine Antwort, die nach einer neueren ankommt, faellt weg. Antworten liegen je Signatur im
     Speicher (hoechstens 60): ein Zurueck auf Seite 1 oder auf den anderen Reiter laedt nichts.
     rufen(fn, params, opts) -> Promise<{ok, status, daten|fehler}> -- in der App UC.rpc. */
  /* EIN SERVERFEHLER WIRD ZWEIMAL WIEDERHOLT (09.10.). Gemeldet: cached_citations_urls_v1 kam
     beim Seitenaufbau mit XX000 "cannot find parent statement on pldbgapi2 call stack" zurueck,
     zweimal hintereinander, der dritte Aufruf ein paar Sekunden spaeter lief durch. Ein Lesen ist
     gefahrlos zu wiederholen; nach 0,8s und 2s, dann gilt der Fehler. NUR Serverfehler (5xx,
     XX000, Netz) -- ein Rate-Limit, ein Rechte- oder ein Parameterfehler wird durch Wiederholen
     nicht besser, und ein Rate-Limit sogar schlimmer. Abgebrochen oder ueberholt: kein Versuch. */
  var WIEDERHOLEN = [800, 2000];
  /* Ratengrenze und Zugang zuerst und an message (16.10.): beide kamen bis befunde_db_v1.sql als
     HTTP 500 (P0429, P0403) -- ein team_access_* wurde so zweimal wiederholt, die Seite stand
     knapp 3 s laenger im Skelett, und jeder Versuch kostete einen Aufruf. Seitdem 429 und 402. */
  function serverFehler(erg) {
    if (!erg || erg.ok || erg.ueberholt) return false;
    var f = erg.fehler || {}, m = str(f.message).toLowerCase(), c = str(f.code);
    var art = fehlerArt(erg);
    if (art === "rate" || art === "zugang") return false;
    if (m === "aborted" || m === "timeout") return false;
    /* core.rpc hat diesen Aufruf schon ein zweites Mal gestellt (Abbruch nach 30 s, volle
       Warteschlange): ein dritter und vierter Versuch hier machten aus 30 s zwei Minuten. */
    if (erg.wiederholt) return false;
    return c === "XX000" || erg.status >= 500 || m === "network";
  }
  function makeLader(o) {
    o = o || {};
    var rufen = o.rufen, MAX = o.max || 60, wieder = o.wiederholen || WIEDERHOLEN;
    /* o.bereinigen(erg, a) -> true: die Seite hat einen Filter mit unbekannten Ids geraeumt und laedt
       selbst neu (UC.filterBereinigen, 22023). Diese Antwort ist dann ueberholt, kein Fehler und
       nichts zum Zeichnen: das Skelett bleibt bis zur neuen Antwort. */
    var bereinigen = typeof o.bereinigen === "function" ? o.bereinigen : null;
    var cache = {}, reihe = [], laufend = {}, zaehler = 0;
    /* stand zaehlt das Leeren (15.10. spaet). Die Gesamtzeilen merken ihre Summen selbst je
       Filterstand (core, makeZaehlZeile); nach einem Aktualisieren ist der Filterstand derselbe, die
       Zahlen sind es nicht. Die Seiten nehmen stand in die Signatur ihrer Summe -- ein Leeren ist so
       auch fuer die Gesamtzeile ein neuer Stand, und sie holt frisch. */
    var stand = 0;
    /* Datenstand je Tabelle und Filter (a.bindung.schluessel): "generated_at|total_count" der zuletzt
       gezeigten Seite. versionFn legt die Seite fest (versionMit); ohne sie prueft der Lader nichts. */
    var datenstand = {}, sigSchluessel = {}, versionFn = null;
    function standVon(d) {
      var m = meta(d), ga = str(m.generated_at), tc = num(m.total_count);
      return ga ? ga + "|" + (tc == null ? "" : tc) : null;
    }
    function schluesselLeeren(schl) {
      Object.keys(sigSchluessel).forEach(function (s) {
        if (sigSchluessel[s] === schl) { delete cache[s]; delete sigSchluessel[s]; var i = reihe.indexOf(s); if (i >= 0) reihe.splice(i, 1); }
      });
    }
    /* "ok", "veraltet" (Seite 1: Eintrag verwerfen, neu holen, ohne Hinweis) oder "gewechselt"
       (Seite hinter 1: die Seite springt auf 1). Der neue Stand wird SOFORT gemerkt: das Neuladen
       von Seite 1 trifft dann auf denselben Wert, es gibt keine Schleife. */
    function standPruefen(a, d) {
      var b = a && a.bindung;
      if (!b || !versionFn || !b.schluessel) return "ok";
      var neu = standVon(d);
      if (neu == null) return "ok";
      var alt = datenstand[b.schluessel];
      if (alt == null || alt === neu) { datenstand[b.schluessel] = neu; return "ok"; }
      if (!b.seite) return "veraltet";
      datenstand[b.schluessel] = neu;
      schluesselLeeren(b.schluessel);
      return "gewechselt";
    }
    function gewechselt(a, erg) {
      var ok = false;
      try { ok = !!versionFn(a, erg); } catch (e) { ok = false; }
      return ok;
    }
    function merken(sig, d) {
      cache[sig] = d;
      var i = reihe.indexOf(sig);
      if (i >= 0) reihe.splice(i, 1);
      reihe.push(sig);
      while (reihe.length > MAX) delete cache[reihe.shift()];
    }
    /* Eine Antwort aus dem Speicher ist jetzt die gezeigte Seite: ihr Stand ist der gemerkte. */
    function datenstandSetzen(a, d) {
      var n = standVon(d);
      if (a && a.bindung && n != null && versionFn) datenstand[a.bindung.schluessel] = n;
    }
    function abbrechen(kanal) {
      var l = laufend[kanal];
      if (l) { laufend[kanal] = null; if (l.ctrl) { try { l.ctrl.abort(); } catch (e) {} } }
    }
    function laden(kanal, a, opts) {
      opts = opts || {};
      if (!opts.frisch && a.sig && Object.prototype.hasOwnProperty.call(cache, a.sig)) {
        var sp = standPruefen(a, cache[a.sig]);
        if (sp === "veraltet") { delete cache[a.sig]; var iv = reihe.indexOf(a.sig); if (iv >= 0) reihe.splice(iv, 1); }
        else if (sp === "gewechselt" && gewechselt(a, null)) { abbrechen(kanal); return Promise.resolve({ ok: false, ueberholt: true, versionGewechselt: true }); }
        else { abbrechen(kanal); datenstandSetzen(a, cache[a.sig]); return Promise.resolve({ ok: true, daten: cache[a.sig], ausSpeicher: true }); }
      }
      var l = laufend[kanal];
      if (l && l.sig === a.sig && !opts.frisch) return l.promise;
      abbrechen(kanal);
      var nr = ++zaehler, ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
      var eintrag = { sig: a.sig, nr: nr, ctrl: ctrl };
      laufend[kanal] = eintrag;
      function versuch(i) {
        return Promise.resolve(rufen(a.fn, a.params, { signal: ctrl ? ctrl.signal : undefined })).then(function (erg) {
          if (laufend[kanal] !== eintrag) return { ok: false, ueberholt: true };
          erg = erg || { ok: false, status: 0, fehler: { message: "network" } };
          if (i < wieder.length && serverFehler(erg)) {
            eintrag.versuche = i + 1;
            return new Promise(function (weiter) { setTimeout(weiter, wieder[i]); }).then(function () {
              if (laufend[kanal] !== eintrag) return { ok: false, ueberholt: true };
              return versuch(i + 1);
            });
          }
          laufend[kanal] = null;
          if (!erg.ok && bereinigen) {
            var bereinigt = false;
            try { bereinigt = !!bereinigen(erg, a); } catch (e) { bereinigt = false; }
            if (bereinigt) return { ok: false, ueberholt: true, bereinigt: true };
          }
          if (erg.ok) {
            var st = standPruefen(a, erg.daten);
            if (st === "gewechselt" && gewechselt(a, erg)) return { ok: false, ueberholt: true, versionGewechselt: true };
            if (st === "veraltet" && a.bindung) datenstand[a.bindung.schluessel] = standVon(erg.daten);
          }
          if (erg.ok && a.sig) { merken(a.sig, erg.daten); if (a.bindung) sigSchluessel[a.sig] = a.bindung.schluessel; }
          return erg;
        }, function () {
          /* Abgebrochen, weil eine neuere Anfrage desselben Kanals kam: ueberholt, kein Fehler. */
          if (laufend[kanal] !== eintrag) return { ok: false, ueberholt: true };
          if (i < wieder.length) {
            return new Promise(function (weiter) { setTimeout(weiter, wieder[i]); }).then(function () {
              if (laufend[kanal] !== eintrag) return { ok: false, ueberholt: true };
              return versuch(i + 1);
            });
          }
          laufend[kanal] = null;
          return { ok: false, status: 0, fehler: { message: "network" } };
        });
      }
      eintrag.promise = versuch(0);
      return eintrag.promise;
    }
    return {
      laden: laden, abbrechen: abbrechen,
      /* Der Lader lebt am Fenster, die Seite kann neu gebaut werden (Themenwechsel): jede neue Seite
         haengt ihre Bereinigung hier ein und ersetzt die der alten. */
      bereinigenMit: function (fn) { bereinigen = typeof fn === "function" ? fn : null; },
      laeuft: function (kanal) { return !!laufend[kanal]; },
      /* fn(a, erg) -> true: die Seite springt selbst auf Seite 1 (Stand wechselte beim Blaettern). */
      versionMit: function (fn) { versionFn = typeof fn === "function" ? fn : null; },
      leeren: function () { cache = {}; reihe = []; sigSchluessel = {}; datenstand = {}; stand++; },
      stand: function () { return stand; },
      ausSpeicher: function (a) { return a && a.sig && Object.prototype.hasOwnProperty.call(cache, a.sig) ? cache[a.sig] : undefined; }
    };
  }

  window.UpstreemCitationsDaten = {
    FN: FN, ORDER: ORDER,
    overview: overview, domains: domains, urls: urls, domainUrls: domainUrls, clear: clear,
    summe: summe, zuSumme: zuSumme, summeFelder: summeFelder, summeLesen: summeLesen,
    zuCombo: zuCombo, zuDomains: zuDomains, zuUrls: zuUrls, zuDrilldown: zuDrilldown,
    fehlerArt: fehlerArt, makeLader: makeLader, listenAnfrage: listenAnfrage, bindung: bindung
  };
})();
