(function () {
  var ROH = `[
  { "id": "p1", "title": "Kunde "Nord" \u2013 Q3", "chat_count": 4 },
  { "id": "p2", "title": "Marken*Vergleich #2026", "chat_count": 2 },
  { "id": "p3", "title": "Akzente: caf\u00e9 r\u00e9sum\u00e9 \u00b4 und 100 % \u2018Test\u2019", "chat_count": 0 }
]`
    .replace(/:\s*([,}\]])/g, ": null$1")
    .replace(/:\s*(yes|no)\s*([,}\]])/g, function (_, v, t) { return ": " + (v === "yes") + t; });

  try { if (window.askMiraSetProjects) window.askMiraSetProjects(ROH); } catch (e) {}
})();
