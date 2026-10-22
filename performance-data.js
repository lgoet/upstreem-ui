/* upstreem performance-data.js -- der Datenteil der Performance-Seite (09.10.), OHNE DOM.

   Gleiche Bauart wie citations-data.js und dashboard-data.js: was hier steht, kennt weder Elemente
   noch Bubble -- nur die Anfragen der drei RPCs aus Vertrag A (bubble/seiten_db_vorschlag_2.md,
   Abschnitt 4 und 11) und die Form, in der Radar und Detailbereich ihre Daten lesen. Es geht so wie
   es ist mit, wenn die App nach Next.js wechselt.

   Die URL-Tabelle im Detailbereich ist cached_citations_urls_v1 (Vertrag 4.4) -- Anfrage, Umformung
   und Lader kommen darum aus UpstreemCitationsDaten, nicht noch einmal von hier.

   Exportiert als window.UpstreemPerformanceDaten. */
(function () {
  "use strict";
  if (window.UpstreemPerformanceDaten) return;

  function isArr(v) { return Object.prototype.toString.call(v) === "[object Array]"; }
  function str(v) { return v == null || typeof v === "object" ? "" : String(v); }
  function num(v) { if (v == null || v === "" || typeof v === "boolean") return null; var n = Number(v); return isFinite(n) ? n : null; }
  function obj(v) { return v && typeof v === "object" && !isArr(v) ? v : null; }
  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  /* Kennungen nur als uuid und ohne Dubletten: ein einziger anderer Eintrag liesse die DB den
     ganzen Aufruf ablehnen (22P02) -- dieselbe Regel wie citations-data.js. */
  function uuids(a, max) {
    var gesehen = {}, aus = [];
    (isArr(a) ? a : []).forEach(function (x) {
      x = str(x).trim();
      var k = x.toLowerCase();
      if (UUID.test(x) && !gesehen[k]) { gesehen[k] = true; aus.push(x); }
    });
    return aus.length ? aus.slice(0, max || 25) : null;
  }
  function uuid(x) { x = str(x).trim(); return UUID.test(x) ? x : ""; }
  function datum(x) { x = str(x).trim(); return /^\d{4}-\d{2}-\d{2}$/.test(x) ? x : null; }
  /* Logos nur als http(s) oder protokollrelativ (Bubble-CDN: "//…"), alles andere faellt weg --
     die Adresse landet in einem img-src. Wie absolut() in dashboard-data.js. */
  function bild(u) {
    u = str(u).trim();
    if (/^\/\//.test(u)) return "https:" + u;
    return /^https?:\/\//i.test(u) ? u : "";
  }

  var FN = {
    radar: "performance_radar_v1",
    kurve: "performance_company_chart_v1",
    varianten: "performance_brand_variations_v1",
    /* Vertrag 4.5: leert auch Radar und Varianten (und den Citations-Cache). */
    clear: "clear_dashboard_cache_v1"
  };
  function anfrage(art, params) { return { art: art, fn: FN[art], params: params, sig: FN[art] + "|" + JSON.stringify(params) }; }

  /* ---- Anfragen ---------------------------------------------------------------------------------
     a: { team, firmen[] | null, topics[] | null, f }. Ohne Liste nimmt die DB die Top 12 je Achse
     (Vorgabe 12/12, Vertrag 4.1) -- dieselbe Obergrenze, die das Auswahlfenster des Radars hat.
     Mit Liste gelten genau diese, in dieser Reihenfolge.
     FILTERSTAND (15.10. abends, Kalender und Filterleiste auf der Seite): a.f wie in
     dashboard-data.js, { von, bis, modelle[], maerkte[], topics[], tagmode } -- Vertrag 4.1 kennt
     p_date_from/p_date_to, p_models, p_markets, p_tag_ids, p_tagmode. Ohne Zeitraum rechnet die DB
     die letzten 30 Tage nach Berliner Kalender (der Rueckfall, wenn date-range.js fehlt). */
  function radar(a) {
    a = a || {};
    var p = { p_team: str(a.team) };
    var f = uuids(a.firmen), t = uuids(a.topics);
    if (f) p.p_companies = f; else p.p_company_limit = 12;
    if (t) p.p_topics = t; else p.p_topic_limit = 12;
    return anfrage("radar", filterDazu(p, a.f));
  }
  /* Nur was gesetzt ist, geht hinaus: der Radar liegt im Cache der DB, und ein leerer Filter soll
     dieselbe Signatur ergeben wie vorher. Der Intent-Filter der App kommt mit (Vertrag
     intents_13_10: performance_radar_v1 kennt p_intents/p_branded) -- die Seite zeigt ihn jetzt in
     ihrer Leiste, er veraendert ihre Zahlen also nicht mehr still. */
  function filterDazu(p, f) {
    f = f || {};
    if (datum(f.von) && datum(f.bis)) { p.p_date_from = datum(f.von); p.p_date_to = datum(f.bis); }
    var m = texte(f.modelle), k = texte(f.maerkte), t = uuids(f.topics);
    if (m) p.p_models = m;
    if (k) p.p_markets = k;
    if (t) { p.p_tag_ids = t; p.p_tagmode = f.tagmode === "and" ? "and" : "or"; }
    return intentDazu(p, f);
  }
  /* Die Topics einer ZELLE: ihr eigenes, und bei "and" dazu alle der Filterleiste -- dann zaehlt
     der Radar nur Laeufe, die jedes gewaehlte Topic tragen, und das Detail derselben Zelle soll
     dieselben Laeufe zaehlen. Bei "or" bleibt es das eine Topic der Zelle. */
  function zellTopics(topic, f) {
    var eigen = uuid(topic) ? [uuid(topic)] : null, t = f ? uuids(f.topics) : null;
    if (!eigen) return { ids: null, modus: "or" };
    if (t && f.tagmode === "and") return { ids: uuids(t.concat(eigen)), modus: "and" };
    return { ids: eigen, modus: "or" };
  }
  /* Kurve und Varianten einer Zelle: Marke auf EINEM Topic (Vertrag 4.2/4.3: p_tag_ids =
     [topic_id]). Der Zeitraum kommt aus dem meta des Radars -- so zeigt das Detail dieselben Tage
     wie die Zelle, auch wenn Mitternacht zwischen beiden Aufrufen lag. Modelle, Maerkte und der
     Intent-Filter kommen aus a.f, dem Stand der Filterleiste (15.10. abends; bis dahin hatte die
     Seite keine Leiste, und die Zelle nahm bewusst keinen Filter mit). */
  function zelle(art, a, z) {
    a = a || {}; z = z || {};
    var f = a.f || {}, zt = zellTopics(a.topic, f);
    var p = { p_team: str(a.team), p_company: uuid(a.firma), p_tag_ids: zt.ids };
    if (zt.modus === "and") p.p_tagmode = "and";
    if (datum(z.von) && datum(z.bis)) { p.p_date_from = datum(z.von); p.p_date_to = datum(z.bis); }
    var m = texte(f.modelle), k = texte(f.maerkte);
    if (m) p.p_models = m;
    if (k) p.p_markets = k;
    intentDazu(p, f);
    /* Die Stufe kommt seit dem 14.10. mit (z.gran, D/W/M-Schalter im Radar-Detail); ohne Angabe Day. */
    if (art === "kurve") { p.p_mode = "visibility"; p.p_granularity = z.gran === "week" || z.gran === "month" ? z.gran : "day"; }
    /* Die ganze Liste in einem Aufruf: das Detail blaettert und sucht im Browser (Vertrag 4.3). */
    else { p.p_limit = 1000; p.p_offset = 0; }
    return anfrage(art, p);
  }
  function kurve(a, z) { return zelle("kurve", a, z); }
  function varianten(a, z) { return zelle("varianten", a, z); }

  /* EINE MARKE UEBER ALLE TOPICS, MIT DEM VOLLEN FILTERSTAND (12.10., Marken-Drawer): dieselben
     zwei RPCs wie die Zelle des Radars, aber mit Kalender, Modellen, Maerkten und Topics der
     Filterzeile (Vertrag 4.2/4.3: "Zeitraum und Filter wie 4.1") und mit allen drei Kennzahlen der
     Kurve -- Vertrag 4.2 kennt visibility, rank und sentiment, das Radar braucht nur die erste.
     f wie in dashboard-data.js: { team, von, bis, modelle[], maerkte[], topics[], tagmode }. */
  function texte(a) {
    var l = (isArr(a) ? a : []).map(function (x) { return str(x).trim(); }).filter(Boolean);
    return l.length ? l : null;
  }
  /* Intent-Filter der App (13.10., core: UC.intentFilterParams). Leer, solange die Intents nicht
     freigegeben sind -- dann geht kein neuer Parameter hinaus. */
  /* f.intent (22.10.): die Parameter des eigenen Stands eines Drawers (UC.drawerIntent(...).params()) --
     dort gilt SEIN Intent, nicht die Brille der App. */
  function intentDazu(o, f) {
    var U = window.UpstreemCore, x = f && f.intent && typeof f.intent === "object" ? f.intent
      : (U && U.intentFilterParams ? U.intentFilterParams() : {});
    for (var k in x) if (Object.prototype.hasOwnProperty.call(x, k)) o[k] = x[k];
    return o;
  }
  function markeBasis(f, firma) {
    f = f || {};
    return intentDazu({ p_team: str(f.team), p_company: uuid(firma), p_date_from: datum(f.von), p_date_to: datum(f.bis),
             p_models: texte(f.modelle), p_markets: texte(f.maerkte), p_tag_ids: uuids(f.topics),
             p_tagmode: f.tagmode === "and" ? "and" : "or" }, f);
  }
  function markenKurve(f, firma, o) {
    o = o || {};
    var p = markeBasis(f, firma);
    p.p_mode = o.modus === "rank" || o.modus === "sentiment" ? o.modus : "visibility";
    p.p_granularity = o.gran === "week" || o.gran === "month" ? o.gran : "day";
    return anfrage("kurve", p);
  }
  function markenVarianten(f, firma) {
    var p = markeBasis(f, firma);
    p.p_limit = 1000; p.p_offset = 0;
    return anfrage("varianten", p);
  }
  function clear(team) { return { art: "clear", fn: FN.clear, params: { p_team: str(team) }, sig: "" }; }

  /* Die URL-Tabelle einer Zelle als Filterstand fuer UpstreemCitationsDaten.urls: Topic und Marke
     fest, dazu, was die Tabelle selbst einstellt, und Modelle und Maerkte der Filterleiste (a.f).
     Der Zeitraum MUSS mit: ohne ihn rechnet cached_citations_urls_v1 seine eigene Vorgabe, und die
     ist nicht die des Radars. Den Intent-Filter haengt citations-data.js selbst an. */
  function urlFilter(a, z, t) {
    a = a || {}; z = z || {}; t = t || {};
    var f = a.f || {}, zt = zellTopics(a.topic, f);
    return {
      team: str(a.team), von: datum(z.von) || "", bis: datum(z.bis) || "",
      topics: zt.ids, tagmode: zt.modus,
      marken: uuid(a.firma) ? [uuid(a.firma)] : null,
      erwaehnt: t.erwaehnt === "yes" || t.erwaehnt === "no" ? t.erwaehnt : "all",
      citationTypen: isArr(t.citationTypen) && t.citationTypen.length ? t.citationTypen : null,
      urlTypen: isArr(t.urlTypen) && t.urlTypen.length ? t.urlTypen : null,
      modelle: texte(f.modelle), maerkte: texte(f.maerkte)
    };
  }

  /* ---- Antworten in die Form der Bausteine ----------------------------------------------------- */
  function meta(d) { return obj(d) && obj(d.meta) ? d.meta : {}; }
  function zeilen(d) { return obj(d) && isArr(d.rows) ? d.rows.filter(obj) : null; }
  function liste(x) { return isArr(x) ? x.filter(obj) : []; }

  /* Radar (renderPerformanceRadar). Er liest cells, ranges und selection oben, und die gewaehlten
     Achsen als selected_topics/selected_companies -- der Vertrag liefert rows, meta.ranges,
     meta.selection und companies/topics mit is_selected. Werte werden NICHT nachgerechnet.
     Zeitraum: fuer das Detail darunter (zelle(), urlFilter()). */
  function zuRadar(d) {
    var r = zeilen(d);
    if (!r) return null;
    var m = meta(d), sel = obj(m.selection) || {};
    var cells = r.map(function (c) {
      var o = {}, k;
      for (k in c) if (Object.prototype.hasOwnProperty.call(c, k)) o[k] = c[k];
      o.logo_url = bild(c.logo_url);
      return o;
    });
    function firma(c) {
      return { company_id: str(c.company_id), name: str(c.name), logo_url: bild(c.logo_url), role: str(c.role),
               position: num(c.position), selected_position: num(c.selected_position) };
    }
    function topic(t) {
      return { topic_id: str(t.topic_id), name: str(t.name), emoji: t.emoji == null ? null : str(t.emoji),
               hex_light: str(t.hex_light), hex_dark: str(t.hex_dark), position: num(t.position),
               selected_position: num(t.selected_position), topic_share_pct: num(t.topic_share_pct) };
    }
    function gewaehlt(x) { return x.is_selected === true || x.is_selected === "true" || x.is_selected === "yes"; }
    var firmen = liste(d.companies), topics = liste(d.topics);
    return {
      cells: cells,
      ranges: obj(m.ranges) || undefined,
      selection: { company_limit: num(sel.company_limit) || 12, topic_limit: num(sel.topic_limit) || 12 },
      selected_companies: firmen.filter(gewaehlt).map(firma),
      selected_topics: topics.filter(gewaehlt).map(topic),
      available_companies: liste(d.available_companies).map(firma),
      available_topics: liste(d.available_topics).map(topic),
      zeitraum: { von: datum(m.date_from), bis: datum(m.date_to) },
      /* Die eigene Marke aus der Antwort (role "own"), nicht nur aus dem Store -- dort fehlt die
         Rolle oft (Dashboard, 09.10.). Die URL-Tabelle braucht Name und Logo fuer ihren Schalter. */
      eigene: firmen.filter(function (c) { return str(c.role).toLowerCase() === "own"; }).map(firma)[0] || null
    };
  }
  /* Kurve (setPerformanceDetailSeries): { scope, company_id, series:[{day, value}] }.
     Tage ohne Laeufe (value null, Vertrag 4.2) fallen weg -- die Linie laeuft ueber sie hinweg wie
     jede Linie der App (dashboard-data.js macht es genauso). Eine 0 dort waere falsch: der
     Linienchart in core macht aus null eine 0 (buildLineDatasets). */
  function zuKurve(d, firmaId) {
    var r = zeilen(d);
    if (!r) return null;
    var m = meta(d);
    return {
      scope: "topic",
      company_id: str(m.company_id) || str(firmaId),
      granularity: str(m.granularity) || "day",
      series: r.filter(function (p) { return datum(p.day) && num(p.value) != null; })
               .map(function (p) { return { day: datum(p.day), value: num(p.value) }; })
    };
  }
  /* Varianten (setPerformanceDetailVariations): ein Array; "X of N" liest mentions_total an JEDER
     Zeile (core variationRows) -- der Vertrag fuehrt es einmal in meta. */
  function zuVarianten(d) {
    var r = zeilen(d);
    if (!r) return null;
    var gesamt = num(meta(d).mentions_total);
    return r.map(function (v) {
      return { name: str(v.name), mentioned_count: num(v.mentioned_count), mentioned_runs: num(v.mentioned_runs),
               share_of_voice_pct: num(v.share_of_voice_pct), mentions_total: gesamt };
    });
  }

  window.UpstreemPerformanceDaten = {
    FN: FN,
    radar: radar, kurve: kurve, varianten: varianten, clear: clear, urlFilter: urlFilter,
    markenKurve: markenKurve, markenVarianten: markenVarianten,
    zuRadar: zuRadar, zuKurve: zuKurve, zuVarianten: zuVarianten,
    uuids: uuids
  };
})();
