(function(){
  /* TEST A -- FRISCHE. Steht der neue Code wirklich auf der Seite? jsDelivr merkt sich
     fehlgeschlagene Abrufe pro Datei und Commit, und ein alter Cache sieht aus wie ein Fix,
     der nichts bringt. Geprueft wird am INHALT, nicht am Dateinamen. */
  var MARKE = {
    "core.js":            ["pruefeBald"],
    "prompts-table.js":   ["html === letztesBody"],
    "urls-table.js":      ["letztesBody"],
    "domains-table.js":   ["letztesBody"],
    "responses-table.js": ["letzterTraeger"],
    "topics-filter.js":   ["var genau = id ?"],
    "models-filter.js":   ["var genau = id ?"],
    "markets-filter.js":  ["var genau = id ?"],
    "date-range.js":      ["var genau = id ?"],
    "filter-bar.js":      ["var genau = id ?"],
    "team-orga.js":       ["var genau = id !=="]
  };
  var skripte = [].slice.call(document.querySelectorAll("script[src]"));
  var pins = {};
  [].forEach.call(document.querySelectorAll("[data-cdn-pin]"), function(e){
    var p = e.getAttribute("data-cdn-pin"); if (p) pins[p] = (pins[p]||0)+1; });
  console.log("PINS im Markup: " + (Object.keys(pins).join(", ") || "(keine)"));
  var offen = [], zeilen = [];
  Object.keys(MARKE).forEach(function(name){
    var treffer = skripte.filter(function(s){
      return s.src.indexOf("/" + name) >= 0 || s.src.indexOf("/" + name.replace(".js",".min.js")) >= 0; });
    if (!treffer.length){ zeilen.push({ datei:name, geladen:"NEIN", fix_drin:"-", quelle:"-" }); return; }
    treffer.forEach(function(s){
      offen.push(fetch(s.src, {cache:"reload"}).then(function(r){ return r.text(); }).then(function(t){
        var drin = MARKE[name].every(function(m){ return t.indexOf(m) >= 0; });
        /* jsDelivr antwortet auf einen gescheiterten GitHub-Abruf mit Status 200 und 54 Zeichen
           Text -- das ist kein 404 und faellt sonst nicht auf. */
        var kaputt = t.length < 200 || t.indexOf("Failed to fetch") >= 0;
        zeilen.push({ datei:name, geladen:"ja", fix_drin: kaputt ? "DATEI KAPUTT" : (drin ? "ja" : "NEIN -- ALTER STAND"),
                      bytes: t.length, quelle: s.src.split("@")[1] || s.src.slice(-60) });
      }).catch(function(e){ zeilen.push({ datei:name, geladen:"ja", fix_drin:"ABRUF FEHLER: "+e.message, quelle:s.src.slice(-60) }); }));
    });
  });
  return Promise.all(offen).then(function(){
    zeilen.sort(function(a,b){ return String(a.datei).localeCompare(String(b.datei)); });
    console.table(zeilen);
    var schlecht = zeilen.filter(function(z){ return z.fix_drin !== "ja" && z.fix_drin !== "-"; });
    console.log(schlecht.length ? "!! " + schlecht.length + " DATEI(EN) NICHT AKTUELL -- alle weiteren Messungen sind wertlos, bis das steht"
                                : "Alle geladenen Dateien tragen den neuen Stand.");
    return zeilen;
  });
})()
