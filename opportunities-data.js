/* upstreem opportunities-data.js -- der Datenteil der Opportunities-Seite (09.10.), OHNE DOM.

   Gleiche Bauart wie citations-data.js und performance-data.js: Anfragen und Umformung fuer
   Vertrag B (bubble/seiten_db_vorschlag_2.md, Abschnitt 3.2, 3.5 und 5) -- die Liste aus
   dashboard_opportunities_v1, Statuswechsel, die eigenen URLs fuer "Create with AI" und die Suche
   nach neuen Opportunities als Job ueber die Edge Function start-job. Geht so wie es ist mit,
   wenn die App nach Next.js wechselt.

   Exportiert als window.UpstreemOpportunitiesDaten. */
(function () {
  "use strict";
  if (window.UpstreemOpportunitiesDaten) return;

  function isArr(v) { return Object.prototype.toString.call(v) === "[object Array]"; }
  function str(v) { return v == null || typeof v === "object" ? "" : String(v); }
  function obj(v) { return v && typeof v === "object" && !isArr(v) ? v : null; }
  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  /* Kennungen nur als uuid, ohne Dubletten, hoechstens 500 (Vertrag 5.2). */
  function uuids(a) {
    var gesehen = {}, aus = [];
    (isArr(a) ? a : [a]).forEach(function (x) {
      x = str(x).trim();
      if (UUID.test(x) && !gesehen[x.toLowerCase()]) { gesehen[x.toLowerCase()] = true; aus.push(x); }
    });
    return aus.slice(0, 500);
  }
  /* Die vier Werte, die die DB kennt -- dieselben, die das Brett in seinen Ereignissen traegt
     (opportunities.js COLUMNS). Alles andere geht nicht hinaus. */
  var STATUS = ["Created", "In Progress", "Done", "Ignored"];
  function status(s) { s = str(s); return STATUS.indexOf(s) >= 0 ? s : ""; }

  var FN = {
    liste: "dashboard_opportunities_v1",
    status: "opportunities_set_status_v1",
    urls: "opportunities_own_urls_v1",
    stand: "opportunities_search_status_v1"
  };
  function anfrage(art, params) { return { art: art, fn: FN[art], params: params, sig: FN[art] + "|" + JSON.stringify(params) }; }

  function liste(team) { return anfrage("liste", { p_team: str(team) }); }
  /* null, wenn nichts Gueltiges zu schreiben ist -- dann geht kein Aufruf hinaus. */
  function statusSetzen(team, ids, s) {
    var l = uuids(ids), st = status(s);
    if (!l.length || !st) return null;
    return { art: "status", fn: FN.status, params: { p_team: str(team), p_ids: l, p_status: st }, sig: "" };
  }
  /* Eine Seite mit 200 in einem Aufruf: die Liste in "Create with AI" sucht im Browser
     (Vertrag 5.3; 877c hat 69). */
  function eigeneUrls(team) { return anfrage("urls", { p_team: str(team), p_limit: 200, p_offset: 0 }); }
  /* Ohne job_id: der laufende Job des Teams, sonst der zuletzt beendete (Vertrag 5.5). So findet
     die Seite nach einem Neuladen eine Suche wieder, die noch laeuft. */
  function sucheStand(team, jobId) {
    var p = { p_team: str(team) };
    if (UUID.test(str(jobId))) p.p_job_id = str(jobId);
    return { art: "stand", fn: FN.stand, params: p, sig: "" };
  }
  /* Der Body fuer die Edge Function start-job (Vertrag 3.2). */
  function sucheStartBody(team) { return { kind: "opportunities_search", team_id: str(team), params: {} }; }

  /* ---- Antworten ------------------------------------------------------------------------------ */
  function zeilen(d) { return obj(d) && isArr(d.rows) ? d.rows.filter(obj) : null; }
  /* Die Karten gehen unveraendert an opportunitiesSetItems: die Felder heissen schon so, wie das
     Brett sie liest (Vertrag 5.1, vom DB-Chat an 100 Karten geprueft). */
  function zuListe(d) { return zeilen(d); }
  /* "Create with AI" liest url, title, favicon (createWithAiSetYouUrls). Nur http(s). */
  function zuUrls(d) {
    var r = zeilen(d);
    if (!r) return null;
    return r.filter(function (x) { return /^https?:\/\//i.test(str(x.url)); }).map(function (x) {
      var f = str(x.favicon);
      return { url: str(x.url), title: str(x.title), favicon: /^https?:\/\//i.test(f) ? f : "" };
    });
  }
  /* Antwort von opportunities_set_status_v1: was geaendert wurde, was uebersprungen. */
  function zuStatus(d) {
    var m = obj(d) && obj(d.meta);
    if (!m) return null;
    return { geaendert: Number(m.changed) || 0, uebersprungen: isArr(m.skipped_ids) ? m.skipped_ids.map(str) : [] };
  }
  /* Stand eines Jobs: queued | running | success | error, oder null (es gab noch keinen). */
  function zuStand(d) {
    var m = obj(d) && obj(d.meta);
    if (!m) return null;
    var s = str(m.status);
    return {
      jobId: str(m.job_id), status: ["queued", "running", "success", "error"].indexOf(s) >= 0 ? s : null,
      meldung: str(m.status_message), fehler: obj(m.error) ? { code: str(m.error.code), message: str(m.error.message) } : null
    };
  }
  /* Antwort von start-job (202): { job_id, kind, status, reused }. */
  function zuStart(d) {
    var o = obj(d);
    if (!o || !UUID.test(str(o.job_id))) return null;
    return { jobId: str(o.job_id), reused: o.reused === true };
  }

  window.UpstreemOpportunitiesDaten = {
    FN: FN, STATUS: STATUS,
    liste: liste, statusSetzen: statusSetzen, eigeneUrls: eigeneUrls, sucheStand: sucheStand, sucheStartBody: sucheStartBody,
    zuListe: zuListe, zuUrls: zuUrls, zuStatus: zuStatus, zuStand: zuStand, zuStart: zuStart
  };
})();
