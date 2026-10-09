/* upstreem teams-data.js -- der Datenteil der Teams-Seite (09.10.), OHNE DOM.

   Gleiche Bauart wie citations-data.js, performance-data.js, opportunities-data.js: Anfrage und
   Umformung fuer Vertrag E (bubble/seiten_db_vorschlag_2.md, Abschnitt 6.1, teams_portfolio_v1).
   Geht so wie es ist mit, wenn die App nach Next.js wechselt.

   Exportiert als window.UpstreemTeamsDaten. */
(function () {
  "use strict";
  if (window.UpstreemTeamsDaten) return;

  function isArr(v) { return Object.prototype.toString.call(v) === "[object Array]"; }
  function str(v) { return v == null || typeof v === "object" ? "" : String(v); }
  function obj(v) { return v && typeof v === "object" && !isArr(v) ? v : null; }
  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  var FN = { teams: "teams_portfolio_v1" };
  /* Eine Seite zu 100 (Hoechstwert), angeheftet das aktive Team: es steht oben, wie bisher. Ein
     geloeschtes oder fremdes Team ignoriert die DB, statt zu scheitern (Vertrag 6.1). Kein
     p_search: die Tabelle sucht im Browser, auch ueber den Tarif -- das kann die DB nicht. */
  function teams(aktivesTeam, offset) {
    var p = { p_limit: 100, p_offset: Math.max(0, Math.round(Number(offset) || 0)) };
    if (UUID.test(str(aktivesTeam))) p.p_pinned_team_id = str(aktivesTeam);
    return { art: "teams", fn: FN.teams, params: p, sig: FN.teams + "|" + JSON.stringify(p) };
  }
  /* { rows, total } -- rows unveraendert (die Felder heissen schon so, wie die Tabelle sie liest),
     total aus meta, damit der Lader weiss, ob er nachblaettern muss. */
  function zuSeite(d) {
    var o = obj(d);
    if (!o || !isArr(o.rows)) return null;
    var m = obj(o.meta) || {};
    var total = Number(m.total_count);
    return { rows: o.rows.filter(obj), total: isFinite(total) ? total : null };
  }

  window.UpstreemTeamsDaten = { FN: FN, teams: teams, zuSeite: zuSeite };
})();
