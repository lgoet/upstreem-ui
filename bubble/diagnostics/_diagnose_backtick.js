/* WELCHES FELD TRAEGT EINEN BACKTICK? -- in die Konsole kleben, RPC-Antwort als Text uebergeben.
   Dafuer gedacht, dass ein Run-JS-Schritt beim Einlesen stirbt ("Unexpected identifier ..." oder
   "missing ) after argument list") und man wissen will, WO. Der Schritt selbst kann es nicht
   melden: er kommt nie zur Ausfuehrung. */
window.upDiagBacktick = function (roh) {
  var text = typeof roh === "string" ? roh : JSON.stringify(roh);
  var GEFAHR = [["Backtick", /`/g], ["Dollar-Klammer", /\$\{/g]];
  var treffer = [];
  GEFAHR.forEach(function (g) {
    var name = g[0], re = g[1], m;
    while ((m = re.exec(text))) {
      /* Der Feldname davor: das letzte "..." vor einem Doppelpunkt links von der Fundstelle. */
      var davor = text.slice(Math.max(0, m.index - 400), m.index);
      var feld = /"([^"]+)"\s*:\s*"[^"]*$/.exec(davor);
      treffer.push({
        zeichen: name,
        feld: feld ? feld[1] : "(unbekannt)",
        stelle: m.index,
        umgebung: text.slice(Math.max(0, m.index - 45), m.index + 45).replace(/\n/g, "\\n")
      });
    }
  });
  if (!treffer.length) { console.log("%cKein Backtick, kein ${ -- der Payload ist als Literal sicher.", "color:green"); return []; }
  console.log("%c" + treffer.length + " gefaehrliche Stelle(n):", "color:red;font-weight:bold");
  console.table(treffer);
  var felder = {};
  treffer.forEach(function (t) { felder[t.feld] = (felder[t.feld] || 0) + 1; });
  console.log("Betroffene Felder:", felder);
  console.log("Abhilfe: an DIESEN Bubble-Ausdruck zwei find & replace mit Use RegEx --\n" +
              "  1)  [`]   ->  '\n  2)  \\$\\{  ->  $ {");
  return treffer;
};
