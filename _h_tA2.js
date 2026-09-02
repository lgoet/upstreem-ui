(function(){
  /* TEST A -- FRISCHE, zweiter Anlauf. Die erste Fassung pruefte den Text der GELADENEN Datei,
     und jsDelivr minifiziert auf Anfrage: lokale Namen werden umbenannt, Kommentare fallen weg,
     und der Minifier dreht sogar Bedingungen um (aus "===" wurde "!=="). Vier korrekt
     ausgelieferte Dateien standen deshalb als "alter Stand" da.
     Jetzt wird die UNMINIFIZIERTE Schwesterdatei am selben Pin geprueft -- aus der erzeugt
     jsDelivr die .min-Fassung, sie beantwortet also genau die Frage "liefert dieser Pin den
     neuen Code". Die geladene Datei selbst wird nur noch darauf geprueft, dass sie ueberhaupt
     heil ist: ein gescheiterter GitHub-Abruf kommt mit Status 200 und 54 Zeichen Text. */
  var MARKE = {
    "core.js":            "pruefeBald",
    "prompts-table.js":   "html === letztesBody",
    "urls-table.js":      "letztesBody",
    "domains-table.js":   "letztesBody",
    "responses-table.js": "letzterTraeger",
    "topics-filter.js":   "var genau = id ?",
    "models-filter.js":   "var genau = id ?",
    "markets-filter.js":  "var genau = id ?",
    "date-range.js":      "var genau = id ?",
    "filter-bar.js":      "var genau = id ?",
    "team-orga.js":       "var genau = id !=="
  };
  var skripte = [].slice.call(document.querySelectorAll("script[src]"));
  var zeilen = [], offen = [], pins = {};
  Object.keys(MARKE).forEach(function(name){
    var kurz = name.replace(".js", "");
    var treffer = skripte.filter(function(s){
      return s.src.indexOf("/" + kurz + ".js") >= 0 || s.src.indexOf("/" + kurz + ".min.js") >= 0; });
    if (!treffer.length){ zeilen.push({ datei:name, geladen:"NEIN", pin:"-", pin_aktuell:"-", datei_heil:"-" }); return; }
    var s = treffer[0];
    var pin = (s.src.split("@")[1] || "").split("/")[0] || "(kein Pin)";
    pins[pin] = (pins[pin] || 0) + 1;
    var rohUrl = s.src.replace(".min.js", ".js");
    offen.push(Promise.all([
      fetch(rohUrl, {cache:"reload"}).then(function(r){ return r.text(); }).catch(function(e){ return "FEHLER:" + e.message; }),
      fetch(s.src,  {cache:"reload"}).then(function(r){ return r.text(); }).catch(function(e){ return "FEHLER:" + e.message; })
    ]).then(function(t){
      var roh = t[0], geliefert = t[1];
      function heil(x){ return x.length > 200 && x.indexOf("Failed to fetch") < 0 && x.indexOf("FEHLER:") !== 0; }
      zeilen.push({
        datei: name,
        pin: pin.slice(0, 10),
        pin_aktuell: !heil(roh) ? "QUELLE KAPUTT" : (roh.indexOf(MARKE[name]) >= 0 ? "ja" : "NEIN -- ALTER STAND"),
        datei_heil: heil(geliefert) ? "ok" : "KAPUTT (" + geliefert.length + " Zeichen)",
        ausgeliefert: s.src.indexOf(".min.js") >= 0 ? "min" : "roh",
        bytes: geliefert.length
      });
    }));
  });
  return Promise.all(offen).then(function(){
    zeilen.sort(function(a,b){ return String(a.datei).localeCompare(String(b.datei)); });
    console.log("PINS in den geladenen URLs: " + (Object.keys(pins).join(", ") || "(keine)"));
    if (Object.keys(pins).length > 1) console.log("!! MEHR ALS EIN PIN auf der Seite -- die Dateien passen nicht zueinander");
    console.table(zeilen);
    var alt = zeilen.filter(function(z){ return z.pin_aktuell === "NEIN -- ALTER STAND" || z.pin_aktuell === "QUELLE KAPUTT"; });
    var kaputt = zeilen.filter(function(z){ return String(z.datei_heil).indexOf("KAPUTT") === 0; });
    console.log(alt.length    ? "!! " + alt.length + " Datei(en) mit ALTEM Stand: " + alt.map(function(z){return z.datei;}).join(", ")
                              : "Alle geladenen Dateien tragen den neuen Stand.");
    console.log(kaputt.length ? "!! " + kaputt.length + " Datei(en) liefern die jsDelivr-Fehlantwort: " + kaputt.map(function(z){return z.datei;}).join(", ") + " -- Pin purgen"
                              : "Alle ausgelieferten Dateien sind heil.");
    return zeilen;
  });
})()
