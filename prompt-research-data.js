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
  /* Die Liste rechts: 20 ist der Hoechstwert (Vorgabe der DB waeren 5). Sie traegt laufende,
     fertige mit offenen Vorschlaegen und gescheiterte der letzten 24 h -- fuenf waeren nach
     zwei Recherchen am Tag schon voll. */
  var LISTE = 20;

  function anfrage(fn, p) { return { fn: fn, params: p, sig: fn + "|" + JSON.stringify(p) }; }
  function jobs(team) { return anfrage(FN.jobs, { p_team: str(team), p_limit: LISTE }); }
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
        persona: persona || null
      }
    };
  }

  function istLauf(st) { st = str(st).toLowerCase(); return st === "queued" || st === "running"; }
  /* { rows, laufend } -- laufend ist der erste Job in queued/running (pro Team hoechstens einer). */
  function zuJobs(d) {
    var o = obj(d);
    if (!o || !isArr(o.rows)) return null;
    var rows = o.rows.filter(obj);
    var laufend = null;
    rows.forEach(function (r) { if (!laufend && istLauf(r.status)) laufend = r; });
    return { rows: rows, laufend: laufend };
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
    if (/_rate_limited$/.test(m) || c === "PT429" || s === 429) return "rate";
    if (m === "prompt_research_limit_reached" || (c === "PT409" && /limit/.test(m))) return "limit";
    if (m === "prompt_research_not_found" || c === "PT404" || (s === 404 && /not_found/.test(m))) return "weg";
    if (m === "edge_not_configured" || m === "edge_not_implemented" || s === 503 || s === 501) return "nichtDa";
    if (m === "prompt_research_invalid_param" || m === "edge_invalid_body") return "eingabe";
    if (c === "42501" || c === "P0403" || s === 403) return "rechte";
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
    FN: FN, LISTE: LISTE,
    jobs: jobs, ergebnis: ergebnis, entscheiden: entscheiden, loeschen: loeschen,
    begriffe: begriffe, startBody: startBody, istLauf: istLauf,
    zuJobs: zuJobs, zuErgebnis: zuErgebnis, zuKontingent: zuKontingent,
    fehlerArt: fehlerArt, hinweisZahl: hinweisZahl, jobFehlerSatz: jobFehlerSatz
  };
})();
