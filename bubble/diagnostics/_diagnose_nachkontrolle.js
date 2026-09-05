/* UPSTREEM -- DIE NACHKONTROLLE NACH DEM DEPLOY

   WOHIN: Konsole der laufenden Seite, 10-15s nach dem Aufbau. Nichts in den Header, nichts
   einbauen, es aendert nichts -- es liest nur, was schon dasteht.

   WARUM ES DIESE DATEI GIBT, obwohl es _diagnose_core_doppelt.js schon gibt: die alte Diagnose
   BEOBACHTET das Einhaengen und muss darum ganz oben im Header stehen. Nach dem Aufbau in die
   Konsole geworfen sieht sie nichts mehr und meldet 0 Einhaengungen -- eine Null, die nach einem
   guten Ergebnis aussieht und keines ist. Diese hier rekonstruiert dieselbe Frage aus drei
   Spuren, die der Aufbau hinterlassen HAT:
       die Script- und Link-Tags im Dokument, das Resource-Timing des Browsers,
       und window.__upDoppel -- die Liste, die der Waechter im Kopf-Snippet selbst fuehrt.

   SIE BEANTWORTET DREI FRAGEN, IN DIESER REIHENFOLGE:
     A) Laeuft ueberhaupt die neue Fassung? Ohne diesen Beweis ist jede weitere Zahl wertlos --
        eine gecachte alte core.js hat in dieser Sitzung schon dreimal eine Diagnose entwertet.
        Gelesen wird UpstreemCore.BUILD, also der ausgefuehrte Zustand, nicht ein Dateitext.
     B) Wird noch etwas doppelt geholt, und WER tut es?
     C) Was steht an DOM in Ansichten, die der Browser gar nicht rendert? (Lazy-Mount)

   AUFRUFEN:  upNachkontrolle()          alles drei
              upLazyReport()             nur C, falls schon geladen aus der anderen Datei */
(function(){
  var ERWARTET_BUILD = 20260910;   /* Lazy-Mount. Mit jeder core-Fassung hier mitziehen. */
  var ERWARTET_PRELOAD = 3;        /* Sperre greift in Teilbaeume. Siehe page_header_preload.html. */

  function dateiname(u){
    u = String(u || "").split("?")[0].split("#")[0];
    return u.slice(u.lastIndexOf("/") + 1);
  }
  function pinAus(u){ return (/upstreem-ui@([^\/]+)\//.exec(String(u || "")) || [])[1] || "?"; }
  function kopf(t, farbe){
    console.log("%c" + t, "color:#fff;background:" + farbe + ";padding:2px 6px;border-radius:3px");
  }

  /* ---- A) FRISCHE ------------------------------------------------------------------------- */
  function teilA(){
    var uc = window.UpstreemCore, b = uc && uc.BUILD;
    var ok = typeof b === "number" && b >= ERWARTET_BUILD;
    kopf("A) LAEUFT DIE NEUE FASSUNG?  BUILD " + (b == null ? "(kein UpstreemCore)" : b) +
         "   erwartet >= " + ERWARTET_BUILD + "   " + (ok ? "JA" : "NEIN"),
         ok ? "#1a7f37" : "#b0200c");
    if (!ok){
      console.log("   Alles Weitere ist damit nur der Zustand der ALTEN Fassung. Erst den Pin im " +
                  "Kopf-Snippet pruefen und den Cache leeren, dann erneut messen.");
    }
    /* Der Weckruf des Lazy-Mount haengt am Fenster. Fehlt er, ist core zwar neu, aber ein
       Ansichtswechsel mountet nichts nach -- eine Ansicht bliebe leer. */
    console.log("   Weckruf vorhanden: __upWecken " + (typeof window.__upWecken === "function" ? "ja" : "NEIN") +
                "   Nachzuegler-Liste: " + ((window.__upNachholen || []).length) + " Komponenten");
    /* Das Kopf-Snippet kommt NICHT ueber den Pin -- es steht in Bubble und muss von Hand ersetzt
       werden. Ohne diese Zahl sieht ein alter Kopf genauso aus wie ein Fix, der nicht wirkt. */
    var f = window.__upPreloadFassung || 0;
    var fOk = f >= ERWARTET_PRELOAD;
    console.log("   Kopf-Snippet: Fassung " + (f || "(aelter als 3, kennt den Marker nicht)") +
                "   erwartet >= " + ERWARTET_PRELOAD + "   " + (fOk ? "JA" : "NEIN -- das alte " +
                "Snippet steht noch im Kopf, es muss im Ganzen ersetzt werden (der Pin allein " +
                "reicht nicht)"));
    return { build: b || 0, frisch: ok, preload: f, preloadOk: fOk };
  }

  /* ---- B) DOPPELT GEHOLT? ------------------------------------------------------------------ */
  function teilB(){
    var tags = [].slice.call(document.querySelectorAll(
      'script[src*="upstreem-ui@"], link[href*="upstreem-ui@"]'));
    var nach2 = {}, pins = {};
    tags.forEach(function(t){
      var u = t.getAttribute("src") || t.getAttribute("href");
      var n = dateiname(u), p = pinAus(u);
      pins[p] = (pins[p] || 0) + 1;
      var e = nach2[n] || (nach2[n] = { anzahl:0, ausKopf:0, fremd:[] });
      e.anzahl++;
      if (t.getAttribute("data-up-preload")) e.ausKopf++;
      else e.fremd.push(p.slice(0, 7));
    });
    /* Was der Waechter im Kopf-Snippet ABGEWEHRT hat. Diese Anforderungen stehen nicht mehr im
       Dokument -- ohne diese Liste zaehlt man sie also faelschlich als "gibt es nicht". Der
       Waechter schreibt zwei Formen hinein: Objekte mit Stapelspur (verweigertes Einhaengen) und
       blosse Dateinamen (nachtraeglich entfernter Tag). */
    /* DIE EIGENTLICHE FRAGE, und die erste Fassung dieses Berichts hat sie nicht gestellt: ein
       Doppel, das VOR der Einhaengung verhindert wurde, spart den Parse -- eines, das erst danach
       aus dem Dokument genommen wurde, ist trotzdem gelaufen und geparst (ein eingehaengtes
       Script laesst sich durch Entfernen nicht mehr anhalten). Am 05.09. meldete der Bericht 64
       Abwehrfaelle, darunter core.js 17x, und liess dabei offen, dass KEINER davon einen Parse
       gespart hat. Ohne diese Trennung sieht die Zahl nach einem Erfolg aus.
       Drei Formen liegen in der Liste: die neue mit "wann", die vorige Objektform (die gab es nur
       fuer den frueh verweigerten Fall) und blosse Namen aus dem Beobachter, also der spaete. */
    var abgewehrt = {}, vor = 0, nachZahl = 0;
    (window.__upDoppel || []).forEach(function(d){
      var n = typeof d === "string" ? d : (d && d.datei) || "?";
      var wann = (d && d.wann) || (d && d.spur ? "vor" : "nach");
      if (wann === "vor") vor++; else nachZahl++;
      var e = abgewehrt[n] || (abgewehrt[n] = { anzahl:0, vor:0, nach:0, wo:{}, spuren:[] });
      e.anzahl++; e[wann === "vor" ? "vor" : "nach"]++;
      if (d && d.wo) e.wo[d.wo] = 1;
      if (d && d.spur && e.spuren.length < 2) e.spuren.push(d.spur.join(" | "));
    });
    var mehrfach = Object.keys(nach2).filter(function(n){ return nach2[n].anzahl > 1; });
    var pinListe = Object.keys(pins);
    var sauber = mehrfach.length === 0 && pinListe.length <= 1 && nachZahl === 0;
    kopf("B) WIRD ETWAS DOPPELT GEHOLT?  " + tags.length + " Tags im Dokument, " +
         Object.keys(nach2).length + " Dateien   " + (sauber ? "SAUBER" : "NEIN"),
         sauber ? "#1a7f37" : "#b0200c");
    console.log("   Doppelanforderungen: " + vor + " VOR der Einhaengung verhindert (nie geladen, " +
                "kein Parse)  |  " + nachZahl + " erst DANACH entfernt (gelaufen und geparst" +
                (nachZahl ? " -- diese kosten weiter Zeit)" : ")"));
    console.log("   Pins auf der Seite: " + pinListe.map(function(p){
      return p.slice(0,7) + " (" + pins[p] + ")"; }).join(",  ") +
      (pinListe.length > 1 ? "   ZWEI PINS = jede Datei wird zweimal geholt, das ist die Ursache" : ""));
    mehrfach.sort(function(a,b){ return nach2[b].anzahl - nach2[a].anzahl; }).forEach(function(n){
      var e = nach2[n];
      console.log("   " + n + "  x" + e.anzahl + "   davon aus dem Kopf-Snippet: " + e.ausKopf +
                  "   von Element-Loadern: " + e.fremd.length +
                  (e.fremd.length ? "  Pins " + e.fremd.join(",") : ""));
    });
    Object.keys(abgewehrt).forEach(function(n){
      var e = abgewehrt[n];
      console.log("   [doppelt angefordert] " + n + "  x" + e.anzahl +
                  "   verhindert: " + e.vor + "   zu spaet: " + e.nach +
                  "   Weg: " + Object.keys(e.wo).join(",") +
                  (e.spuren.length ? "\n        " + e.spuren.join("\n        ") : ""));
    });
    /* Die zweite Spur, unabhaengig vom DOM: der Browser zaehlt jede Anforderung mit. Ein Tag, den
       jemand nach dem Laden wieder entfernt hat, steht hier trotzdem -- und das Skript ist
       trotzdem gelaufen (ein eingehaengtes Script laesst sich durch Entfernen nicht mehr
       anhalten, im Prueftand gemessen). */
    var res = {}; 
    try {
      performance.getEntriesByType("resource").forEach(function(r){
        if (String(r.name).indexOf("upstreem-ui@") < 0) return;
        var n = dateiname(r.name);
        res[n] = (res[n] || 0) + 1;
      });
    } catch(e){}
    var resMehr = Object.keys(res).filter(function(n){ return res[n] > 1; });
    console.log("   Resource-Timing: " + Object.keys(res).length + " upstreem-Dateien geladen" +
      (resMehr.length ? ",  mehrfach angefordert: " + resMehr.map(function(n){
        return n + " x" + res[n]; }).join(", ") : ",  keine doppelt angefordert"));
    return { tags: tags.length, dateien: Object.keys(nach2).length,
             mehrfach: mehrfach.length, verhindert: vor, zuSpaet: nachZahl,
             pins: pinListe.length };
  }

  /* ---- C) LAZY-MOUNT ----------------------------------------------------------------------
     Dieselbe Messung wie in _diagnose_lazy_potenzial.js -- hier mit drin, damit EIN Einfuegen in
     die Konsole reicht. Die Wurzel selbst zu fragen taugt nicht: ein Container mit
     content-visibility:hidden meldet sich SELBST weiter als sichtbar, nur seine Nachkommen sind
     nicht gerendert. Also wird ein Kind gefragt. */
  function geparkt(root){
    var probe = root.firstElementChild || root;
    if (typeof probe.checkVisibility !== "function") return false;
    return !probe.checkVisibility({ contentVisibilityAuto: true, visibilityProperty: true });
  }
  function gemountet(root){
    var keys = Object.keys(root);
    for (var i = 0; i < keys.length; i++){
      if (keys[i].indexOf("__") !== 0) continue;
      var v = root[keys[i]];
      if (v && typeof v === "object") return keys[i];
    }
    return null;
  }
  function teilC(){
    var wurzeln = [].slice.call(document.querySelectorAll(".up-root"));
    var s = { offen:0, geparkt:0, geparktGemountet:0,
              knotenOffen:0, knotenGeparkt:0, knotenGeparktGemountet:0 };
    wurzeln.forEach(function(r){
      var g = geparkt(r), m = gemountet(r), n = r.querySelectorAll("*").length;
      if (g){
        s.geparkt++; s.knotenGeparkt += n;
        if (m){ s.geparktGemountet++; s.knotenGeparktGemountet += n; }
      } else { s.offen++; s.knotenOffen += n; }
    });
    var anteil = s.knotenGeparkt ? Math.round(100 * s.knotenGeparktGemountet / s.knotenGeparkt) : 0;
    kopf("C) LAZY-MOUNT  " + wurzeln.length + " Wurzeln, " +
         document.querySelectorAll("*").length + " Knoten im Dokument", "#1b6eda");
    console.log("   offen:   " + s.offen + " Wurzeln / " + s.knotenOffen + " Knoten");
    console.log("   geparkt: " + s.geparkt + " Wurzeln / " + s.knotenGeparkt + " Knoten" +
                "   davon gemountet: " + s.geparktGemountet + " / " + s.knotenGeparktGemountet +
                " Knoten (" + anteil + "%)");
    /* Der Vergleichswert vom 05.09., vor dem Lazy-Mount: 123 von 136 geparkten Wurzeln waren
       gemountet und trugen 21210 Knoten. Faellt der Anteil deutlich, wirkt es. */
    console.log("   VORHER (05.09., ohne Lazy-Mount): 123 von 136 geparkten Wurzeln gemountet, " +
                "21210 Knoten");
    return s;
  }

  window.upLazyReport = window.upLazyReport || teilC;
  window.upNachkontrolle = function(){
    var a = teilA(), b = teilB(), c = teilC();
    return { frische: a, einhaengen: b, lazy: c };
  };
  kopf("[upstreem] upNachkontrolle() aufrufen", "#1b6eda");
})();
