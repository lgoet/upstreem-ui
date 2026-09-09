/* Prueffolge fuer _h_usk.html -- das Ladeskelett als eigene Komponente.
   Gemessen wird, was die Anforderung war: es passt sich der Gruppe an. Also NICHT "die Regel
   steht da", sondern: in einer 240px hohen Gruppe stehen mehr Zeilen als in einer 40px hohen,
   und in einer 800px breiten ist die Flaeche 800px breit. */
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
  var UHR = 1100;   /* im verdeckten Fenster ist setTimeout auf >=1000ms gedrosselt */
  function g(id){ return document.getElementById(id); }
  function zeilen(id){ return g(id).querySelectorAll(".usk-line").length; }

  async function los(){
    document.getElementById("buehne").className = "zeigen";
    await warte(UHR);   /* dem ResizeObserver Zeit geben: beim ersten Lauf ist die Gruppe 0px */

    kopf("0  UMGEBUNG UND FRISCHE");
    /* Die BUEHNE messen und nicht innerWidth: das Fenster meldete beim ersten Lauf 0,
       waehrend die Kaesten darin ihre richtige Groesse hatten. Ein Instrument, das 0 sagt und
       daneben 800 misst, misst sich selbst. */
    pruef("Buehne breit", Math.round(
      document.getElementById("buehne").getBoundingClientRect().width),
      function(v){ return v > 900; }, "bei 0 ist jeder Messwert darunter wertlos");
    pruef("core geladen", !!window.UpstreemCore, true);
    pruef("skeleton.css geladen", (function(){
      return [].some.call(document.styleSheets, function(ss){
        try { return [].some.call(ss.cssRules, function(r){
          return (r.selectorText || "").indexOf(".usk-block") >= 0; }); } catch(e){ return false; }
      });
    })(), true, "ohne sie ist jeder Messwert darunter wertlos");
    pruef("der Setter ist da", typeof window.setSkeleton, "function");

    kopf("1  ES PASST SICH DER GRUPPE AN  (das war die Anforderung)");
    var hoch = g("s-hoch").getBoundingClientRect();
    var gruppeHoch = g("s-hoch").parentElement.getBoundingClientRect();
    pruef("volle Breite der Gruppe", Math.round(hoch.width), Math.round(gruppeHoch.width) - 2,
      "minus die 2px Rahmen der Gruppe");
    pruef("volle Hoehe der Gruppe", Math.round(hoch.height), Math.round(gruppeHoch.height) - 2);
    /* DER KERN: mehr Hoehe = mehr Zeilen. 240px tragen (240+10)/22 = 11 Zeilen, 40px zwei. */
    pruef("240px hoch -> viele Zeilen", zeilen("s-hoch"),
      function(v){ return v >= 9 && v <= 11; }, "gerechnet (h+10)/22");
    pruef("40px hoch -> wenige Zeilen", zeilen("s-flach"),
      function(v){ return v === 1 || v === 2; });
    pruef("GEGENPROBE die Zahlen unterscheiden sich wirklich",
      zeilen("s-hoch") > zeilen("s-flach"), true,
      "sonst zeigte die Zeile darueber nur, dass irgendeine Zahl herauskommt: " +
      zeilen("s-hoch") + " gegen " + zeilen("s-flach"));
    /* Eine Gruppe OHNE Hoehe ist in Bubble der Normalfall beim Aufbau. */
    pruef("Gruppe ohne Hoehe: mindestens eine Zeile", zeilen("s-null"),
      function(v){ return v >= 1; },
      "0 Zeilen waeren ein leerer Kasten, den niemand mehr fuellt");
    pruef("und der Kasten ist nicht 0px hoch",
      Math.round(g("s-null").getBoundingClientRect().height),
      function(v){ return v >= 12; }, "min-height an der Wurzel");
    /* Die Flaeche: volle Breite, und der Radius kommt aus dem Attribut. */
    var bl = g("s-block").querySelector(".usk-block");
    /* Gegen den INHALTSKASTEN des Elters und nicht gegen eine gemerkte Zahl: ob der Rahmen
       der Gruppe innen oder aussen liegt, haengt an box-sizing, und das ist nicht die Sache
       dieser Komponente. Gemessen wurde 800 gegen meine erwarteten 798 -- die Erwartung war
       falsch, nicht die Breite. */
    pruef("block fuellt die Breite der Gruppe", (function(){
      var el = g("s-block").parentElement, cs = getComputedStyle(el);
      var innen = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      return Math.round(bl.getBoundingClientRect().width) === Math.round(innen);
    })(), true, Math.round(bl.getBoundingClientRect().width) + "px");
    pruef("block nimmt den Radius aus data-radius",
      getComputedStyle(bl).borderRadius, "20px");

    kopf("2  DIE DREI FASSUNGEN");
    pruef("block zeichnet eine Flaeche und keine Zeilen",
      g("s-block").querySelectorAll(".usk-block").length + "/" + zeilen("s-block"), "1/0");
    pruef("card zeichnet eine Kachel UND Zeilen",
      g("s-card").querySelectorAll(".usk-tile").length + "/" +
      (zeilen("s-card") >= 2), "1/true");
    pruef("die Kachel ist quadratisch und 34px", (function(){
      var t = g("s-card").querySelector(".usk-tile").getBoundingClientRect();
      return Math.round(t.width) + "x" + Math.round(t.height);
    })(), "34x34", "zwei Zeilen plus ihr Abstand -- sie schliesst mit dem Text ab");
    pruef("die letzte Zeile ist kuerzer", (function(){
      var l = g("s-hoch").querySelectorAll(".usk-line");
      var a = l[0].getBoundingClientRect().width, b = l[l.length-1].getBoundingClientRect().width;
      return b < a;
    })(), true, "ein Textblock endet mitten in der Zeile");
    pruef("eine EINZELNE Zeile ist nicht gekuerzt", (function(){
      var l = g("s-flach").querySelectorAll(".usk-line");
      if (l.length !== 1) return "n=" + l.length;
      return Math.round(l[0].getBoundingClientRect().width) ===
             Math.round(g("s-flach").getBoundingClientRect().width);
    })(), function(v){ return v === true || String(v).indexOf("n=") === 0; },
      "bei mehreren Zeilen ist die Kuerzung richtig, bei einer waere sie eine Behauptung");

    kopf("3  FARBE UND BEWEGUNG KOMMEN AUS CORE  (nicht nachgebaut)");
    var linie = g("s-hoch").querySelector(".usk-line");
    var cs = getComputedStyle(linie);
    pruef("die Fuellung ist --vc-sk", cs.backgroundColor,
      (function(){ var d = document.createElement("div");
        d.style.background = "var(--vc-sk)"; g("s-hoch").appendChild(d);
        var v = getComputedStyle(d).backgroundColor; d.remove(); return v; })());
    pruef("die Bewegung ist uutpulse aus core", cs.animationName, "uutpulse");
    pruef("und die Zeile ist 12px hoch wie .up-tsk-bar in core", Math.round(
      linie.getBoundingClientRect().height), 12);
    /* Dass die Rechnung im JS und die Werte in der CSS zusammenpassen, ist keine Meinung:
       zwei Zeilen plus ihr Abstand MUESSEN die Kachelhoehe ergeben, sonst ragt die Kachel
       heraus. Wer einen der drei Werte aendert, faellt hier durch. */
    pruef("JS und CSS rechnen mit denselben Zahlen", (function(){
      var l = g("s-card").querySelectorAll(".usk-line");
      if (l.length < 2) return "n=" + l.length;
      var a = l[0].getBoundingClientRect(), b = l[1].getBoundingClientRect();
      var zeile = Math.round(a.height), abstand = Math.round(b.top - a.bottom);
      var kachel = Math.round(g("s-card").querySelector(".usk-tile").getBoundingClientRect().height);
      return zeile + "+" + abstand + "+" + zeile + "=" + kachel;
    })(), "12+10+12=34");

    kopf("4  DAS DUNKLE THEMA  (das Thema der APP gewinnt, nicht das Attribut)");
    /* HIER LAG MEINE ERSTE PRUEFUNG FALSCH. Sie stellte zwei Wurzeln nebeneinander, eine mit
       data-isdark="no" und eine mit "yes", und erwartete zwei Farben. Das gibt die App nicht
       her: UC.themeParam laesst ein gesetztes App-Thema GEWINNEN, und core schreibt data-isdark
       auf allen .up-root auf diesen Wert um (core.js, "if (roots[i].getAttribute(...) !== v)").
       Gemessen trug die angeblich helle Wurzel danach yes. Das ist richtig so -- eine Seite mit
       zwei Themen gleichzeitig gaebe es nicht. Geprueft wird deshalb DASSELBE Element, waehrend
       das Thema der App umgestellt wird. */
    var wieVorher = window.getUpstreemTheme ? window.getUpstreemTheme() : "light";
    var linieFarbe = function(){
      return getComputedStyle(g("s-hoch").querySelector(".usk-line")).backgroundColor; };
    window.setUpstreemTheme("light"); await warte(150);
    var fHell = linieFarbe(), tHell = g("s-hoch").getAttribute("data-theme");
    window.setUpstreemTheme("dark"); await warte(150);
    var fDunkel = linieFarbe(), tDunkel = g("s-hoch").getAttribute("data-theme");
    window.setUpstreemTheme(wieVorher); await warte(150);
    pruef("das Thema der App landet am Element", tHell + "/" + tDunkel, "light/dark");
    pruef("und die Fuellung wechselt mit", fHell !== fDunkel, true,
      fHell + " -> " + fDunkel);

    kopf("5  KAPUTT UND LEER SIND ZWEI DINGE");
    pruef("eine unbekannte Fassung verschluckt das Skelett NICHT",
      g("s-kaputt").querySelectorAll(".usk-block").length, 1,
      "sie faellt auf block zurueck -- ein leerer Kasten sah aus wie 'nichts unterwegs'");
    var vorher = g("s-setter").innerHTML;
    window.setSkeleton("A", "das ist kein JSON {");
    pruef("ein kaputter Payload laesst das Skelett STEHEN",
      g("s-setter").innerHTML, vorher,
      "ein verschwundenes Skelett sieht aus wie 'fertig geladen'");
    window.setSkeleton("A", '{"variant":"rows","rows":3}');
    pruef("ein guter Payload wirkt", zeilen("s-setter"), 3);
    window.setSkeleton("A", '{"radius": 4}');
    pruef("ein Teil-Payload laesst den Rest stehen", zeilen("s-setter"), 3,
      "variant blieb rows, obwohl nur radius kam");
    window.resetSkeleton("A");
    pruef("reset geht zurueck auf die Attribute",
      g("s-setter").querySelectorAll(".usk-block").length + "/" + zeilen("s-setter"), "1/0",
      "data-variant steht auf block");

    kopf("6  DIE ATTRIBUTE WERDEN LIVE MITGELESEN");
    g("s-setter").setAttribute("data-variant", "rows");
    g("s-setter").setAttribute("data-rows", "5");
    await warte(120);
    pruef("data-variant und data-rows ziehen nach", zeilen("s-setter"), 5);
    /* UND DIE VORFAHRT, festgenagelt. Meine erste Fassung setzte hier data-isdark="yes" und
       erwartete dark -- das kam nicht, und richtig so: UC.themeParam laesst ein gesetztes
       App-Thema GEWINNEN (core.js, "if (t === 'dark' || t === 'light') return t === 'dark'").
       Ein Element, das sich gegen das Thema der Seite stellt, gaebe es in der App nicht.
       Der Weg ueber das App-Thema ist in Abschnitt 4 gemessen; hier steht, dass das Attribut
       ihn NICHT ueberstimmt -- damit niemand das spaeter "repariert". */
    var themaVorher = g("s-setter").getAttribute("data-theme");
    g("s-setter").setAttribute("data-isdark", "yes");
    await warte(120);
    pruef("data-isdark ueberstimmt das App-Thema NICHT",
      g("s-setter").getAttribute("data-theme"), themaVorher,
      "die Vorfahrt liegt beim Thema der Seite -- siehe Abschnitt 4");

    kopf("7  MEHR HOEHE, MEHR ZEILEN  (das 'fit height' im Betrieb)");
    /* WAS HIER MESSBAR IST UND WAS NICHT, offen benannt: die Zustellung des ResizeObservers
       haengt an der Bildpipeline des Browsers, und die laeuft in einem verdeckten Fenster
       nicht. Gemessen blieb die Zahl bei 11, waehrend die Rechnung 22 ergab -- das ist eine
       Eigenheit dieses Fensters und kein Fehler der Komponente.
       Geprueft wird deshalb, was sich pruefen LAESST: dass die Rechnung der neuen Hoehe folgt,
       und dass der zweite Weg (window.resize) sie ausloest. Der ResizeObserver ist der
       Hauptweg im Betrieb; genau weil er hier nicht messbar ist, steht der zweite daneben. */
    var karton = g("s-hoch").parentElement;
    var vorZahl = zeilen("s-hoch");
    karton.style.height = "480px";
    g("s-hoch").__uskController.refresh();
    var nachZahl = zeilen("s-hoch");
    pruef("doppelte Hoehe -> etwa doppelt so viele Zeilen",
      vorZahl + " -> " + nachZahl,
      function(){ return nachZahl >= vorZahl * 1.7; }, "die Rechnung folgt der Hoehe");
    /* Der Rueckweg ueber das Fensterereignis -- der einzige, der hier ankommt. */
    karton.style.height = "";
    window.dispatchEvent(new Event("resize"));
    await warte(UHR);
    pruef("window.resize rechnet nach", zeilen("s-hoch"), vorZahl,
      "der Rueckfall neben dem ResizeObserver, und der einzige hier messbare Weg");

    malen();
  }
  /* EIN WURF DARF DEN PRUEFTAND NICHT STUMM MACHEN: sonst stand auf der Seite fuer immer
     "laeuft..." und nichts sagte, wo. */
  function losMitNetz(){
    los().catch(function(e){
      Z.push('<span class="nein">ABGEBROCHEN</span> ' + (e && e.message ? e.message : e) +
        '\n' + ((e && e.stack) ? String(e.stack).split("\n").slice(0,3).join("\n") : ""));
      malen();
    });
  }
  if (document.readyState === "complete") setTimeout(losMitNetz, 400);
  else window.addEventListener("load", function(){ setTimeout(losMitNetz, 400); });
})();
