/* upstreem prompt-research-data.js -- der Datenteil der Prompt-Research-Seite (09.10.), OHNE DOM.

   Gleiche Bauart wie citations-data.js, performance-data.js, opportunities-data.js, teams-data.js:
   Anfragen und Umformung fuer Vertrag C (bubble/seiten_db_vorschlag_2.md, Abschnitte 7 und 14).
   Geht so wie es ist mit, wenn die App nach Next.js wechselt.

   Exportiert als window.UpstreemPromptResearchDaten. */
(function () {
  "use strict";
  if (window.UpstreemPromptResearchDaten) return;

  function isArr(v) { return Object.prototype.toString.call(v) === "[object Array]"; }
  function str(v) { return v == null || typeof v === "object" ? "" : String(v); }
  function obj(v) { return v && typeof v === "object" && !isArr(v) ? v : null; }
  function zahl(v) { var n = Number(v); return v == null || v === "" || !isFinite(n) ? null : n; }

  var FN = {
    jobs: "prompt_research_jobs_v1",
    ergebnis: "prompt_research_result_v1",
    entscheiden: "prompt_research_decide_v1",
    loeschen: "prompt_research_delete_v1",
    start: "start-job"
  };
  /* Die Liste: 25 ist der Hoechstwert und so viele fertige Recherchen behaelt das Team seit dem 22.10.
     (Lukas: 25 statt 5; prompt_research_22_10_v1.sql, prune und p_limit 1-25). Sie traegt laufende,
     fertige mit offenen Vorschlaegen und gescheiterte der letzten 24 h. Kennt die DB noch 1-20 (Datei
     nicht eingespielt), faellt die Seite einmal auf LISTE_ALT zurueck (jobsLaden). */
  var LISTE = 25, LISTE_ALT = 20;

  function anfrage(fn, p) { return { fn: fn, params: p, sig: fn + "|" + JSON.stringify(p) }; }
  function jobs(team, grenze) { return anfrage(FN.jobs, { p_team: str(team), p_limit: grenze || LISTE }); }
  function ergebnis(team, jobId) { return anfrage(FN.ergebnis, { p_team: str(team), p_job_id: str(jobId) }); }
  function entscheiden(team, aktion, ids, mitTags) {
    var p = { p_team: str(team), p_action: aktion === "accept" ? "accept" : "ignore", p_ids: (isArr(ids) ? ids : []).map(str).filter(Boolean) };
    if (p.p_action === "accept") p.p_with_tags = mitTags !== false;
    return anfrage(FN.entscheiden, p);
  }
  function loeschen(team, jobId) { return anfrage(FN.loeschen, { p_team: str(team), p_job_id: str(jobId) }); }

  /* Die Begriffe aus dem Eingabefeld: die Komponente schickt sie als Text mit Kommas. Getrimmt,
     leere weg, Dubletten ohne Ruecksicht auf Gross/Klein weg (die DB tut dasselbe, Fall 7). */
  function begriffe(roh) {
    var liste = isArr(roh) ? roh : str(roh).split(",");
    var gesehen = {}, aus = [];
    liste.forEach(function (x) {
      var b = str(x).replace(/\s+/g, " ").trim();
      var k = b.toLowerCase();
      if (b && !gesehen[k]) { gesehen[k] = 1; aus.push(b); }
    });
    return aus;
  }
  /* Der Body fuer start-job (Vertrag 3.2/14). persona leer -> null. */
  function startBody(team, d) {
    d = obj(d) || {};
    var persona = str(d.persona).trim();
    return {
      kind: "prompt_research", team_id: str(team),
      params: {
        keywords: begriffe(d.keywords),
        market: str(d.market_alpha2 || d.market).trim().toUpperCase(),
        business_model: str(d.business_model).trim() || "b2c",
        persona: persona || null,
        /* Ob Vorschlaege eine Marke nennen duerfen (14.10., Schalter in den Einstellungen):
           "non_branded" (Vorgabe, wie der Filter der App) oder "all". */
        branded: str(d.branded) === "all" ? "all" : "non_branded",
        /* Die gewaehlten Intents (14.10.): die Recherche teilt die Zahl der Prompts gleichmaessig
           auf sie auf. Leer -> null, dann wie bisher ohne Vorgabe. Nur die drei Stufen der
           Customer Journey -- "other" ist keine Richtung, nach der man recherchiert. */
        intents: (function () {
          var l = (isArr(d.intents) ? d.intents : []).map(function (x) { return str(x).trim().toLowerCase(); })
            .filter(function (x, i, a) { return INTENT_WAHL.indexOf(x) >= 0 && a.indexOf(x) === i; });
          return l.length ? l : null;
        })()
      }
    };
  }
  var INTENT_WAHL = ["informational", "recommendation", "transactional"];

  function istLauf(st) { st = str(st).toLowerCase(); return st === "queued" || st === "running"; }
  /* { rows, laufend } -- laufend ist der erste Job in queued/running (pro Team hoechstens einer). */
  function zuJobs(d) {
    var o = obj(d);
    if (!o || !isArr(o.rows)) return null;
    var rows = o.rows.filter(obj);
    var laufend = null;
    rows.forEach(function (r) { if (!laufend && istLauf(r.status)) laufend = r; });
    /* eigen (22.10., einer_je_nutzer_v1.sql): der eigene laufende Job, auch in einem anderen Team, oder null.
       eigenBekannt: die DB liefert das Feld schon -- vorher weiss die Seite nicht, wessen Lauf es ist. */
    var m = obj(o.meta) || {};
    var eigen = obj(m.own_running);
    return { rows: rows, laufend: laufend, eigen: eigen && str(eigen.job_id) ? eigen : null,
             eigenBekannt: Object.prototype.hasOwnProperty.call(m, "own_running") };
  }
  /* { rows, meta, status, fehlerCode } -- rows sind die offenen Vorschlaege, so wie die Tabelle
     sie liest (id, prompt_text, market, estimated_volume, tags). */
  function zuErgebnis(d) {
    var o = obj(d);
    if (!o || !isArr(o.rows) || !obj(o.meta)) return null;
    var m = o.meta;
    var fehler = obj(m.error);
    return { rows: o.rows.filter(obj), meta: m, status: str(m.status).toLowerCase(), fehlerCode: fehler ? str(fehler.code) : "" };
  }
  /* Das Kontingent aus result/decide: { used, total } fuer setUpstreemQuota, oder null. */
  function zuKontingent(m) {
    m = obj(m);
    if (!m) return null;
    var used = zahl(m.prompts_active), total = zahl(m.prompts_limit);
    return used == null || total == null ? null : { used: used, total: total };
  }

  /* Was der Nutzer liest, wenn etwas scheitert -- englisch, ohne interne Namen, nur was er tun
     kann (Vertrag 1 und 14.1). erg ist die Antwort von UC.rpc/UC.edge. */
  function fehlerArt(erg) {
    var f = (erg && erg.fehler) || {}, m = str(f.message), c = str(f.code), s = erg ? erg.status : 0;
    /* Vor "rate": beide Tagesgrenzen kommen ebenfalls als PT429 (missbrauch_14_10, G) und hiessen
       sonst "warte eine Minute" -- dabei geht es erst morgen weiter. Start: hint "team"|"user",
       Tracken (prompts_daily_limit_reached): hint = heute noch moegliche Prompts. */
    if (/_daily_limit_reached$/.test(m)) return "tag";
    if (/_rate_limited$/.test(m) || c === "PT429" || s === 429) return "rate";
    /* "zugang" (16.10.): team_access_* -- der Zugang des Teams (Tarif, Abo), nicht die
       Mitgliedschaft. Bis befunde_db_v1.sql P0403 = HTTP 500 (ueber den Code bei "rechte"),
       danach PT402 = 402 (ohne diese Zeile "sonst"). start-job reicht beides durch. */
    if (/^team_access_/.test(m) || c === "PT402" || s === 402) return "zugang";
    /* Vor "limit": auch PT409. Der Nutzer hat schon eine Recherche laufen, in einem anderen Team
       (einer_je_nutzer_v1.sql, 22.10.; im selben Team antwortet der Start mit reused). */
    if (m === "prompt_research_user_busy") return "besetzt";
    if (m === "prompt_research_limit_reached" || (c === "PT409" && /limit/.test(m))) return "limit";
    if (m === "prompt_research_not_found" || c === "PT404" || (s === 404 && /not_found/.test(m))) return "weg";
    if (m === "edge_not_configured" || m === "edge_not_implemented" || s === 503 || s === 501) return "nichtDa";
    if (m === "prompt_research_invalid_param" || m === "edge_invalid_body") return "eingabe";
    if (c === "42501" || s === 403) return "rechte";
    return "sonst";
  }
  /* hint bei limit_reached: freie Plaetze als Zahl im Text, bei rate_limited: Sekunden. */
  function hinweisZahl(erg) { var h = erg && erg.fehler ? str(erg.fehler.hint).trim() : ""; return /^\d+$/.test(h) ? Number(h) : null; }
  function jobFehlerSatz(code) {
    if (code === "n8n_unreachable") return "The research could not be started. Please try again.";
    if (code === "timeout") return "The research timed out. Please try again.";
    return "The research failed. Please try again.";
  }

  window.UpstreemPromptResearchDaten = {
    FN: FN, LISTE: LISTE, LISTE_ALT: LISTE_ALT,
    jobs: jobs, ergebnis: ergebnis, entscheiden: entscheiden, loeschen: loeschen,
    begriffe: begriffe, startBody: startBody, istLauf: istLauf,
    zuJobs: zuJobs, zuErgebnis: zuErgebnis, zuKontingent: zuKontingent,
    fehlerArt: fehlerArt, hinweisZahl: hinweisZahl, jobFehlerSatz: jobFehlerSatz
  };
})();
