/* Prueffolge fuer _h_usn_logo.html. Jede Zeile ein Sollwert; wo eine Messung anschlagen koennte,
   ohne dass es etwas bedeutet, steht eine Gegenprobe daneben. */
(function(){
  var Z = [], n = 0, ok = 0;
  function pruef(name, ist, soll, extra){
    n++;
    var gut = (typeof soll === "function") ? soll(ist) : (String(ist) === String(soll));
    if (gut) ok++;
    Z.push('<span class="' + (gut ? "ja" : "nein") + '">' + (gut ? "OK  " : "FALSCH ") + '</span>' +
      name + '  =  ' + JSON.stringify(ist) +
      (gut ? "" : '   SOLL ' + (typeof soll === "function" ? "(Bedingung)" : JSON.stringify(soll))) +
      (extra ? "   " + extra : ""));
  }
  function kopf(t){ Z.push('<span class="kopf">' + t + '</span>'); }
  function malen(){ document.getElementById("raus").innerHTML =
    Z.join("\n") + "\n\n" + (ok === n ? '<span class="ja">' : '<span class="nein">') +
    ok + " von " + n + "</span>"; }
  function warte(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }

  /* root ist nur der KONFIGURATIONSTRAEGER -- die Leiste selbst haengt sidebar.js an
     document.body (sie ist fest positioniert und darf von keinem Vorfahren beschnitten
     werden). Alles, was gemessen wird, sucht deshalb an der LEISTE und nicht an der Wurzel. */
  var root, bar;
  function bild(){ return bar.querySelector(".usn-brand-img"); }
  function mark(){ return bar.querySelector(".usn-brand-mark"); }
  function wort(){ return bar.querySelector(".usn-brand-word"); }
  /* Die Farbe des Rechtecks verraet, WELCHE der vier Quellen genommen wurde: schwarz = breit
     hell, weiss = breit dunkel, rot = klein hell, gruen = klein dunkel. Sicherer als ein
     Vergleich der ganzen Adresse, und es liest sich im Bericht. */
  function quelle(){
    var i = bild(); if (!i) return "kein Bild";
    var s = decodeURIComponent(i.getAttribute("src") || "");
    if (s.indexOf("%23222") >= 0 || s.indexOf("#222") >= 0) return "breit hell";
    if (s.indexOf("#eee") >= 0) return "breit dunkel";
    if (s.indexOf("#c00") >= 0) return "klein hell";
    if (s.indexOf("#0c0") >= 0) return "klein dunkel";
    return "unbekannt";
  }
  function masse(){
    var i = bild(); if (!i) return null;
    var r = i.getBoundingClientRect();
    return { b: Math.round(r.width), h: Math.round(r.height) };
  }
  /* DER ECHTE WEG: der Einklappknopf. Er laeuft ueber anwenden(), und dort haengt auch der
     Aufruf von renderBrand -- eine Messung, die stattdessen nur die Klasse setzt und
     renderBrand selbst ruft, wuerde genau den Draht ueberspringen, der geprueft werden soll.
     NICHT ueber die Fensterbreite: der ResizeObserver feuert im verdeckten Browser-Fenster
     nicht, eine Messung darueber waere dort nie ausgeloest worden. */
  function knopf(){ return bar.querySelector("[data-toggle]"); }
  function mini(an){
    var ist = bar.classList.contains("is-mini");
    if (ist === !!an) return;
    knopf().click();
  }

  async function los(){
    root = document.getElementById("upstreem-sidebar");
    /* AUF DIE LEISTE WARTEN statt eine Wartezeit zu raten. sidebar.js baut in einer Kaskade
       ([30,100,250,500,1000,1800]ms), weil Bubble die Seite in Schueben aufbaut -- eine feste
       Zahl trifft das mal und mal nicht, und dann sieht ein Zeitproblem wie ein Fehler aus.
       Genau das ist beim ersten Lauf passiert: "Leiste gebaut = false", obwohl sie kurz danach
       da war. */
    for (var w = 0; w < 60; w++){
      bar = document.querySelector(".usn-bar");
      if (bar && bar.querySelector(".usn-brand")) break;
      await warte(100);
    }

    kopf("0  UMGEBUNG UND FRISCHE");
    pruef("Fensterbreite", window.innerWidth, function(v){ return v >= 600; },
      "unter 600 ist alles 0 und nichts davon bedeutet etwas");
    pruef("core geladen", !!window.UpstreemCore, true);
    pruef("Leiste gebaut", !!bar && !!bar.querySelector(".usn-brand"), true,
      "sie haengt an document.body, nicht im Wurzelelement");
    var cssDa = function(t){ return [].some.call(document.styleSheets, function(ss){
      try { return [].some.call(ss.cssRules, function(r){
        return (r.cssText || "").indexOf(t) >= 0; }); } catch(e){ return false; } }); };
    pruef("CSS: is-square geladen", cssDa("usn-brand-mark.is-square"), true,
      "ohne das ist jeder Messwert darunter wertlos");

    kopf("1  AUSGEKLAPPT -- der breite Schriftzug, je Thema");
    /* Das Thema ueber core setzen, nicht das Attribut von Hand: core schreibt data-theme auf
       jede .up-root UND stoesst onTheme an, und daran haengt renderBrand. */
    function thema(t){
      var k = window.UpstreemCore;
      if (k && k.setUpstreemTheme) k.setUpstreemTheme(t);
      else bar.setAttribute("data-theme", t);
    }
    thema("light"); mini(false);
    await warte(60);
    pruef("hell: die breite helle Quelle", quelle(), "breit hell");
    pruef("hell: kein Quadrat", mark().classList.contains("is-square"), false);
    pruef("hell: 16.5px hoch, breiter als hoch", (function(){
      var m = masse(); return m && m.h === 17 && m.b > m.h; })(), true,
      JSON.stringify(masse()) + " (16.5 rundet auf 17)");
    thema("dark"); mini(false);
    await warte(60);
    pruef("dunkel: die breite dunkle Quelle", quelle(), "breit dunkel");

    kopf("2  EINGEKLAPPT -- das Quadrat, je Thema");
    thema("light"); mini(true);
    await warte(60);
    pruef("hell: die kleine helle Quelle", quelle(), "klein hell");
    pruef("hell: der Kasten traegt is-square", mark().classList.contains("is-square"), true);
    pruef("hell: 22x22, also QUADRATISCH", (function(){
      var m = masse(); return m && m.b === 22 && m.h === 22; })(), true, JSON.stringify(masse()));
    thema("dark"); mini(true);
    await warte(60);
    pruef("dunkel: die kleine dunkle Quelle", quelle(), "klein dunkel");
    pruef("dunkel: 22x22", (function(){
      var m = masse(); return m && m.b === 22 && m.h === 22; })(), true, JSON.stringify(masse()));

    kopf("3  DER WECHSEL -- das Bild darf nicht stehenbleiben");
    mini(false); await warte(60);
    var a = quelle();
    mini(true);  await warte(60);
    var b = quelle();
    mini(false); await warte(60);
    var c = quelle();
    pruef("aus -> ein -> aus tauscht jedes Mal", a + " / " + b + " / " + c,
      "breit dunkel / klein dunkel / breit dunkel",
      "ohne den Aufruf in der Zustandsumschaltung blieb das alte Bild stehen");

    kopf("4  WENN EINE QUELLE FEHLT  (die Gegenproben)");
    root.removeAttribute("data-upstreem-logo-small-dark");
    mini(true); await warte(60);
    pruef("kleine dunkle fehlt -> die kleine HELLE", quelle(), "klein hell",
      "ein Logo in der falschen Fassung ist besser als keines");
    root.removeAttribute("data-upstreem-logo-small");
    mini(true); await warte(60);
    pruef("beide kleinen fehlen -> das BREITE", quelle(), "breit dunkel",
      "eine fehlende Marke waere schlimmer als eine schmale");
    pruef("und dann kein Quadrat mehr", mark().classList.contains("is-square"), false);
    var vorher = root.getAttribute("data-upstreem-logo");
    root.removeAttribute("data-upstreem-logo");
    root.removeAttribute("data-upstreem-logo-dark");
    mini(true); await warte(60);
    pruef("alle vier fehlen -> der Schriftzug als Text", !!wort(), true);
    pruef("und kein Bild mehr", !bild(), true);

    kopf("5  DER PLATZHALTER GILT ALS LEER");
    root.setAttribute("data-upstreem-logo-small", "UPSTREEM_LOGO_SMALL");
    root.setAttribute("data-upstreem-logo", vorher);
    mini(true); await warte(60);
    pruef("nicht ersetzter Platzhalter -> das breite Logo", quelle(), "breit hell",
      "sonst stuende dort ein Bild mit der Adresse UPSTREEM_LOGO, das nie laedt");

    malen();
  }
  function losMitNetz(){
    los().catch(function(e){
      Z.push('<span class="nein">ABGEBROCHEN</span> ' + (e && e.message ? e.message : e) +
        "\n" + ((e && e.stack) ? String(e.stack).split("\n").slice(0,3).join("\n") : ""));
      malen();
    });
  }
  if (document.readyState === "complete") setTimeout(losMitNetz, 600);
  else window.addEventListener("load", function(){ setTimeout(losMitNetz, 600); });
})();
