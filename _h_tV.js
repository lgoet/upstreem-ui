(function(){
  /* EXPERIMENT: was WUERDE es bringen, die inaktiven Views aus dem DOM zu nehmen.
     Es baut nichts um -- es haengt die inaktiven Views vorübergehend aus und legt sie beiseite,
     damit eine DevTools-Aufnahme danach zeigt, ob die Style-Neuberechnung wirklich faellt.
     upViewsZurueck() haengt alles wieder ein. Nach dem Experiment die Seite NEU LADEN: Bubble
     fuehrt fuer seine Elemente Buch, und ein Element, das zwischenzeitlich nicht im Dokument
     war, kann danach Meldungen werfen. Fuer eine Messung ist das in Ordnung, fuer Weiterarbeiten
     nicht. */
  function zaehle(){ return document.getElementsByTagName("*").length; }
  var SEL = '[id^="viewbody-"], [id^="view-"]';
  var alle = [].slice.call(document.querySelectorAll(SEL));
  /* Verschachtelte weglassen: liegt ein Kandidat in einem anderen, ist nur der aeussere gemeint. */
  alle = alle.filter(function(e){
    return !alle.some(function(o){ return o !== e && o.contains(e); });
  });
  function sichtbar(e){ return !!(e.offsetParent || e.getClientRects().length); }
  var aktiv = alle.filter(sichtbar), inaktiv = alle.filter(function(e){ return !sichtbar(e); });
  var vorher = zaehle();
  var beiseite = [];
  inaktiv.forEach(function(e){
    beiseite.push({ el: e, eltern: e.parentNode, danach: e.nextSibling, knoten: e.getElementsByTagName("*").length });
    try { e.parentNode.removeChild(e); } catch(err){}
  });
  var nachher = zaehle();
  console.log("VIEWS GEFUNDEN: " + alle.length + "   aktiv: " + aktiv.length + "   ausgehaengt: " + beiseite.length);
  console.table(aktiv.map(function(e){ return { view: e.id || e.className.slice(0,40), zustand: "AKTIV, bleibt",
                                                knoten: e.getElementsByTagName("*").length }; })
    .concat(beiseite.map(function(b){ return { view: b.el.id || b.el.className.slice(0,40),
                                               zustand: "ausgehaengt", knoten: b.knoten }; })));
  console.log("KNOTEN IM DOKUMENT: " + vorher + "  ->  " + nachher +
              "   (" + Math.round((1 - nachher / vorher) * 100) + " Prozent weniger)");
  console.log("Jetzt eine DevTools-Aufnahme mit denselben Filterklicks machen und 'Recalculate style'\n" +
              "vergleichen. Danach upViewsZurueck() und die Seite NEU LADEN.");
  window.upViewsZurueck = function(){
    for (var i = beiseite.length - 1; i >= 0; i--){
      var b = beiseite[i];
      try { b.eltern.insertBefore(b.el, b.danach); } catch(err){}
    }
    console.log("wieder eingehaengt. Knoten jetzt: " + zaehle() + "   Seite bitte neu laden.");
    return zaehle();
  };
  return { views: alle.length, ausgehaengt: beiseite.length, knoten_vorher: vorher, knoten_nachher: nachher };
})()
