(function(){
  /* TEST A -- FRISCHE, dritter Anlauf. Zwei Lehren stecken drin:
     1. Nicht im minifizierten Text nach Quellcode suchen -- jsDelivr minifiziert auf Anfrage,
        benennt Namen um und dreht Bedingungen (aus "===" wurde "!=="). Geprueft wird die
        unminifizierte Schwesterdatei am SELBEN Pin.
     2. Die Rohdatei kann am CDN als 404 zwischengespeichert sein, WAEHREND die .min am selben
        Pin einwandfrei liefert (gemessen 02.09. an domains-table.js). Daraus darf nicht
        "alter Stand" werden. Ausweg: die .min-Fassung nennt in ihrem eigenen Kopf den Commit,
        aus dem sie erzeugt wurde ("Original file: /gh/user/repo@<commit>/<datei>"). Stimmt der
        mit dem Pin, ist der Inhalt belegt aus diesem Commit -- nur der Marker bleibt ungeprueft. */
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
  var zeilen = [], offen = [], pins = {}, purge = [];
  Object.keys(MARKE).forEach(function(name){
    var kurz = name.replace(".js", "");
    var treffer = skripte.filter(function(s){
      return s.src.indexOf("/" + kurz + ".js") >= 0 || s.src.indexOf("/" + kurz + ".min.js") >= 0; });
    if (!treffer.length){ zeilen.push({ datei:name, geladen:"NEIN", pin:"-", stand:"-", datei_heil:"-" }); return; }
    var s = treffer[0];
    var pin = (s.src.split("@")[1] || "").split("/")[0] || "(kein Pin)";
    pins[pin] = (pins[pin] || 0) + 1;
    var istMin = s.src.indexOf(".min.js") >= 0;
    var rohUrl = s.src.replace(".min.js", ".js");
    offen.push(Promise.all([
      fetch(rohUrl, {cache:"reload"}).then(function(r){ return r.text(); }).catch(function(e){ return "FEHLER:" + e.message; }),
      fetch(s.src,  {cache:"reload"}).then(function(r){ return r.text(); }).catch(function(e){ return "FEHLER:" + e.message; })
    ]).then(function(t){
      var roh = t[0], geliefert = t[1];
      function heil(x){ return x.length > 200 && x.indexOf("Failed to fetch") < 0 &&
                               x.indexOf("Couldn't find") < 0 && x.indexOf("FEHLER:") !== 0; }
      var stand;
      if (heil(roh)) stand = roh.indexOf(MARKE[name]) >= 0 ? "ja" : "NEIN -- ALTER STAND";
      else {
        /* Rueckfall auf den Kopf der .min-Fassung */
        var m = /Original file:\s*\/gh\/[^@]+@([0-9a-f]{7,40})\//.exec(geliefert || "");
        if (m && m[1] === pin){ stand = "aus Pin erzeugt (Marker ungeprueft)"; purge.push(name); }
        else if (m)          { stand = "!! .min stammt aus " + m[1].slice(0,10); }
        else                 { stand = "nicht pruefbar"; purge.push(name); }
      }
      zeilen.push({ datei:name, pin:pin.slice(0,10), stand:stand,
                    datei_heil: heil(geliefert) ? "ok" : "KAPUTT (" + geliefert.length + " Zeichen)",
                    ausgeliefert: istMin ? "min" : "roh", bytes: geliefert.length });
    }));
  });
  return Promise.all(offen).then(function(){
    zeilen.sort(function(a,b){ return String(a.datei).localeCompare(String(b.datei)); });
    console.log("PINS in den geladenen URLs: " + (Object.keys(pins).join(", ") || "(keine)"));
    if (Object.keys(pins).length > 1) console.log("!! MEHR ALS EIN PIN auf der Seite -- die Dateien passen nicht zueinander");
    console.table(zeilen);
    var alt    = zeilen.filter(function(z){ return String(z.stand).indexOf("NEIN") === 0 || String(z.stand).indexOf("!!") === 0; });
    var kaputt = zeilen.filter(function(z){ return String(z.datei_heil).indexOf("KAPUTT") === 0; });
    console.log(alt.length    ? "!! ALTER ODER FALSCHER STAND: " + alt.map(function(z){return z.datei;}).join(", ")
                              : "Kein Hinweis auf alten Code.");
    console.log(kaputt.length ? "!! LIEFERT NICHT: " + kaputt.map(function(z){return z.datei;}).join(", ") + "  -- Pin purgen, das trifft die App"
                              : "Alle ausgelieferten Dateien sind heil.");
    if (purge.length) console.log("Hinweis: Rohdatei am CDN als 404 gecacht bei " + purge.join(", ") +
      " -- die App laedt die .min und ist NICHT betroffen, aber diese Pfade beim naechsten Purge mitnehmen.");
    return zeilen;
  });
})()
