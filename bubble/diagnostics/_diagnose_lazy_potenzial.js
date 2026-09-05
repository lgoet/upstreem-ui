/* UPSTREEM -- WAS WUERDE LAZY-MOUNT WIRKLICH SPAREN?

   WOHIN: Konsole der laufenden Seite, nach dem Seitenaufbau (10-15s warten). Kein Header noetig,
   es aendert nichts -- es liest nur.

   DIE FRAGE: die Komponenten bauen ihr DOM beim Mounten. Wer in einer geparkten Ansicht mountet,
   baut es fuer niemanden. Bevor dafuer 33 Dateien angefasst werden, muss die Zahl auf dem Tisch
   liegen: WIE VIELE Wurzeln stehen in geparkten Ansichten, wie viele davon sind schon gemountet,
   und wie viele Knoten haengen daran?

   Gemessen wird an drei Dingen, die alle ohne Layoutzugriff zu haben sind:
     - geparkt oder offen: checkVisibility (der Container selbst luegt hier, also wird ein KIND
       gefragt -- ein Container mit content-visibility:hidden gilt selbst weiter als sichtbar)
     - gemountet: die Komponenten haengen ihren Controller als __xyzController an die Wurzel
     - Groesse: die Knotenzahl im Teilbaum der Wurzel

   AUSWERTEN: upLazyReport() */
(function(){
  function geparkt(root){
    /* Ein Kind fragen, nicht die Wurzel: eine Wurzel, die SELBST der content-visibility-Container
       ist, meldet sich als sichtbar. Das erste Element-Kind reicht; hat die Wurzel keins, ist sie
       ohnehin leer und die Frage egal. */
    var probe = root.firstElementChild || root;
    if (typeof probe.checkVisibility !== "function") return false;
    return !probe.checkVisibility({ contentVisibilityAuto: true, visibilityProperty: true });
  }
  /* "Gemountet" ist nur SCHAETZBAR: die Komponenten aus makeMount haengen ihren Controller als
     __xyzController an die Wurzel, aber nicht alle benutzen makeMount (ask-mira und opportunities
     mounten selbst und haengen nichts an). Erkannt wird darum jede eigene __-Eigenschaft, die ein
     Objekt haelt -- Controller sind Objekte, Zaehler wie __upSeq sind Zahlen und fallen heraus.
     Wer trotzdem durchs Netz faellt, wird als "nicht gemountet" gefuehrt: die Zahl ist damit die
     UNTERGRENZE. Die belastbare Zahl steht daneben und ist die eigentliche Aussage -- die Knoten
     in geparkten Wurzeln, denn die sind da, ganz gleich wie sie dorthin kamen. */
  function gemountet(root){
    var keys = Object.keys(root);
    for (var i = 0; i < keys.length; i++){
      var k = keys[i];
      if (k.indexOf("__") !== 0) continue;
      var v = root[k];
      if (v && typeof v === "object") return k;
    }
    return null;
  }
  function ansicht(root){
    var v = root.closest && root.closest('[id^="view-"], [id^="drawer-"]');
    return v ? v.id : "(ausserhalb)";
  }

  window.upLazyReport = function(){
    var wurzeln = [].slice.call(document.querySelectorAll(".up-root"));
    var nachAnsicht = {}, summe = { offen:0, geparkt:0, geparktGemountet:0,
                                    knotenOffen:0, knotenGeparkt:0, knotenGeparktGemountet:0 };
    wurzeln.forEach(function(r){
      var g = geparkt(r), m = gemountet(r), n = r.querySelectorAll("*").length, v = ansicht(r);
      var e = nachAnsicht[v] || (nachAnsicht[v] = { geparkt:g, wurzeln:0, gemountet:0, knoten:0 });
      e.wurzeln++; e.knoten += n; if (m) e.gemountet++;
      if (g){
        summe.geparkt++; summe.knotenGeparkt += n;
        if (m){ summe.geparktGemountet++; summe.knotenGeparktGemountet += n; }
      } else { summe.offen++; summe.knotenOffen += n; }
    });
    console.log("%c[upstreem] " + wurzeln.length + " Wurzeln, " +
      document.querySelectorAll("*").length + " Knoten im Dokument",
      "color:#fff;background:#1b6eda;padding:2px 6px;border-radius:3px");
    Object.keys(nachAnsicht).sort().forEach(function(v){
      var e = nachAnsicht[v];
      console.log("  " + (e.geparkt ? "[geparkt]" : "[offen]  ") + " " + v.padEnd(24," ") +
        " Wurzeln " + String(e.wurzeln).padStart(3," ") +
        "  gemountet " + String(e.gemountet).padStart(3," ") +
        "  Knoten " + String(e.knoten).padStart(6," "));
    });
    console.log("%c  DIE OBERGRENZE: " + summe.geparkt + " Wurzeln in geparkten Ansichten tragen " +
      summe.knotenGeparkt + " Knoten -- mehr als das kann ein Lazy-Mount nicht sparen",
      "color:#fff;background:" + (summe.knotenGeparkt ? "#b0200c" : "#1a7f37") + ";padding:2px 6px");
    console.log("  davon erkennbar gemountet: " + summe.geparktGemountet + " Wurzeln / " +
      summe.knotenGeparktGemountet + " Knoten (Untergrenze, siehe Kommentar zu gemountet)");
    console.log("  offen: " + summe.offen + " Wurzeln / " + summe.knotenOffen + " Knoten" +
                "   geparkt: " + summe.geparkt + " Wurzeln / " + summe.knotenGeparkt + " Knoten");
    return summe;
  };
  console.log("%c[upstreem] upLazyReport() aufrufen","color:#fff;background:#1b6eda;padding:2px 6px;border-radius:3px");
})();
