(function () {
  /* Listen werden hier NICHT mehr geparst. Der Grund steht in zwei Zeichen: den Backticks.
     Bubble setzt den RPC-Text zwischen ` `, und ein Template-Literal loest Backslash-Escapes
     auf, BEVOR eine Zeile dieses Steps laeuft. Aus \" im Titel wird ", aus \n ein echter
     Zeilenumbruch -- das JSON ist danach kaputt, eval wirft, und catch machte daraus still ein
     leeres Array. Gemessen am 22.08.: 7 URLs im RPC, array:0 im Step, "No data" in der Tabelle.
     parseLoose in der Komponente repariert genau das (core.js, Repair 6 und 7). Also Text
     durchreichen -- und wenn er dort unlesbar ist, steht der Fehler sichtbar in der Tabelle. */
  function alsText(raw) {
    var s = String(raw == null ? "" : raw).trim();
    return s ? s : [];   // wirklich leer bleibt ein leeres Array, sonst meldet die Komponente einen Fehler, wo keiner ist
  }

  /* brand ist ein Objekt, kein Listenfeld -- das parst die Komponente nicht. Also hier, aber auf
     String.raw: ohne das frisst der Backtick auch hier die Escapes eines Markennamens mit ". */
  function toObj(raw) {
    var s = String(raw == null ? "" : raw).trim();
    if (!s) return null;
    s = s.replace(/:\s*([,}\]])/g, ": null$1")
         .replace(/:\s*(yes|no)\s*([,}\]])/g, function (_, v, t) { return ": " + (v === "yes") + t; })
         .replace(/,\s*([}\]])/g, "$1");
    try { return eval("(" + s + ")"); }
    catch (e) { console.error("[tcd] brand nicht lesbar: " + e.message, s.slice(0, 200)); return null; }
  }

  function toNum(raw) {
    var s = String(raw == null ? "" : raw).trim();
    if (s === "") return null;
    var n = Number(s);
    return isFinite(n) ? n : null;
  }

  var payload = {
    instanceId: "overview_v2_",
    isDark: "",
    mode: "",                 // "domain" | "url"
    totalCountDomain:    toNum(String.raw``),
    totalCountUrl:       toNum(String.raw``),
    citations_total:     toNum(String.raw``),
    brand:               toObj(String.raw`{"id": "", "name": "", "logo": ""}`),
    top_domains:         alsText(String.raw`[]`),
    top_urls:            alsText(String.raw`[]`),
    types_breakdown:     alsText(String.raw`[]`),
    url_types_breakdown: alsText(String.raw`[]`)
  };

  var t = 0;
  (function go () {
    var fn = window.renderTopCitations
          || (window.parent && window.parent.renderTopCitations)
          || (window.top && window.top.renderTopCitations);
    if (typeof fn === "function") { fn(payload); return; }
    if (t++ < 60) setTimeout(go, 100);
  })();
})();
