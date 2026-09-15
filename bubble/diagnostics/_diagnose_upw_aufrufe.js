/* WER SCHREIBT DEM DASHBOARD WAS? -- in die Konsole kleben, dann normal bedienen.
   Legt sich VOR renderPowerDashboard und setPowerDashboardLoading und protokolliert jeden
   Aufruf: woher er kam, welche Abschnitte er trug und -- fuer jeden Abschnitt -- ob er lesbar
   war. Damit ist beantwortbar, was der Bildschirm nicht sagen kann: "Could not load citations"
   nennt den Abschnitt, aber nicht den Aufruf, der ihn kaputtgemacht hat.
   upwAufrufe() zeigt die Liste, upwAufrufeAus() haengt sich wieder aus. */
(function () {
  if (window.__upwSpion) { console.log("[spion] laeuft schon. upwAufrufe() zeigt die Liste."); return; }
  var log = [];
  var ABSCHNITTE = ["overview", "brands", "top_domains", "top_urls", "errors"];

  function lesbar(v){
    if (v == null) return "(nicht dabei)";
    if (typeof v === "object") return Array.isArray(v) ? ("Liste, " + v.length + " Eintraege") : "Objekt";
    var UC = window.UpstreemCore;
    var w = UC && UC.readBubble ? UC.readBubble(v) : null;
    if (w == null && String(v).trim() !== "") return "UNLESBAR -> " + String(v).slice(0, 60);
    return Array.isArray(w) ? ("Text, lesbar als Liste mit " + w.length + " Eintraegen") : "Text, lesbar";
  }
  function woher(){
    try { return (new Error().stack || "").split("\n").slice(3, 5).map(function(x){ return x.trim(); }).join(" | "); }
    catch(e){ return ""; }
  }
  function zerlegen(p){
    var UC = window.UpstreemCore, o = p;
    if (typeof p === "string"){ o = UC && UC.readBubble ? UC.readBubble(p) : null; if (Array.isArray(o)) o = o[0]; }
    if (!o || typeof o !== "object") return { "GANZER PAYLOAD": "UNLESBAR -> " + String(p).slice(0, 80) };
    var aus = {};
    ABSCHNITTE.forEach(function(k){ aus[k] = lesbar(o[k]); });
    return aus;
  }

  var origRender = window.renderPowerDashboard;
  var origLoad = window.setPowerDashboardLoading;
  window.renderPowerDashboard = function (p) {
    var e = { nr: log.length + 1, was: "renderPowerDashboard", zeit: Math.round(performance.now()),
              abschnitte: zerlegen(p), woher: woher() };
    log.push(e);
    console.log("%c[spion] #" + e.nr + " renderPowerDashboard", "color:#2563eb", e.abschnitte, e.woher);
    return origRender.apply(this, arguments);
  };
  if (typeof origLoad === "function") window.setPowerDashboardLoading = function (id, v) {
    var e = { nr: log.length + 1, was: "setPowerDashboardLoading(" + v + ")", zeit: Math.round(performance.now()), woher: woher() };
    log.push(e);
    console.log("%c[spion] #" + e.nr + " " + e.was, "color:#a16207", e.woher);
    return origLoad.apply(this, arguments);
  };

  window.upwAufrufe = function(){ console.table(log.map(function(e){
    return { nr: e.nr, was: e.was, ms: e.zeit,
             top_urls: e.abschnitte ? e.abschnitte.top_urls : "",
             errors: e.abschnitte ? e.abschnitte.errors : "" }; })); return log; };
  window.upwAufrufeAus = function(){
    window.renderPowerDashboard = origRender;
    if (typeof origLoad === "function") window.setPowerDashboardLoading = origLoad;
    window.__upwSpion = false;
    console.log("[spion] aus.");
  };
  window.__upwSpion = true;
  console.log("%c[spion] an. Jetzt auf URLs umschalten, danach upwAufrufe() aufrufen.", "font-weight:bold");
})();
