/* Prueffolge fuer _h_am_v2.html -- der Aufwand-Slider und der Entitaets-Picker im Composer.
   Jede Zeile ist ein Sollwert, und wo eine Messung anschlagen KOENNTE, ohne dass es etwas
   bedeutet, steht eine Gegenprobe daneben. */
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
  function v_(cs){ return cs.borderTopWidth + " " + cs.borderTopStyle; }
  /* Eine Farbe SAUBER lesen. Der Browser gibt eine halbdurchsichtige Fuellung als
     color(srgb r g b / a) mit Anteilen von 0..1 zurueck, nicht als rgba mit 0..255 -- ein
     Muster, das nur Zahlen sammelt, liest daraus Unsinn (gemessen: rgb(9,9,9) statt
     rgb(23,23,25)). */
  function farbe(c){
    c = String(c);
    var m = c.match(/^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\)/);
    if (m) return { r: +m[1]*255, g: +m[2]*255, b: +m[3]*255, a: m[4] === undefined ? 1 : +m[4] };
    m = c.match(/rgba?\(([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s\/]+([\d.]+))?\)/);
    if (m) return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] };
    return { r: 0, g: 0, b: 0, a: 1 };
  }
  function ueber(v, b){ return { r: v.r*v.a + b.r*(1-v.a), g: v.g*v.a + b.g*(1-v.a),
                                 b: v.b*v.a + b.b*(1-v.a), a: 1 }; }
  function stufen(x, y){ return Math.round(Math.max(Math.abs(x.r-y.r),
                                Math.abs(x.g-y.g), Math.abs(x.b-y.b))); }
  function kopf(t){ Z.push('<span class="kopf">' + t + '</span>'); }
  function malen(){ document.getElementById("raus").innerHTML =
    Z.join("\n") + "\n\n" + (ok === n ? '<span class="ja">' : '<span class="nein">') +
    ok + " von " + n + "</span>"; }
  function warte(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
  /* Im verdeckten Fenster ist setTimeout auf >=1000ms gedrosselt -- eine Uhr von 400ms braucht
     dort echte 1100ms. Deshalb wird hier immer grosszuegig gewartet. */
  var UHR = 1100;

  var root, comp, UC;
  /* Den Grund der Pruefseite auf den der App setzen -- Mira malt selbst keinen, das tut die
     Bubble-Seite dahinter. Und das THEMA wird nicht geraten, sondern am fertigen Baum gelesen:
     ohne pref_theme folgt core dem System, und ein hell geratener Grund unter einer dunklen
     Komponente ergab beim ersten Anlauf einen Abstand von 227 Kanalstufen. */
  function grundSetzen(){
    var t = (root && root.getAttribute("data-theme")) === "dark" ? "#121212" : "#ffffff";
    document.documentElement.style.background = t;
    document.body.style.background = t;
  }
  /* Uebergaenge aus, dauerhaft: sonst haelt ein haengender Uebergang jeden berechneten Wert auf
     dem Startwert, und eine greifende Regel sieht wie eine nicht greifende aus. */
  function uebergaengeAus(){
    var st = document.createElement("style");
    st.id = "ohne-uebergang";
    st.textContent = '#ask-mira *, #ask-mira *::before, #ask-mira *::after {' +
      'transition-duration: 0s !important; animation-duration: 0s !important; }';
    document.head.appendChild(st);
  }
  function uebergaengeAn(){ var e = document.getElementById("ohne-uebergang"); if (e) e.remove(); }

  function g(id){ return document.getElementById(id); }
  function breite(el){ return el ? Math.round(el.getBoundingClientRect().width) : 0; }

  async function los(){
    root = g("ask-mira"); comp = g("am-composer"); UC = window.UpstreemCore;
    grundSetzen();

    kopf("0  UMGEBUNG UND FRISCHE  (ohne das ist jeder Messwert darunter wertlos)");
    pruef("Fensterbreite", window.innerWidth, function(v){ return v >= 900; },
      "unter 900 ist alles 0 und nichts davon bedeutet etwas");
    pruef("Komponente breit", breite(root), function(v){ return v >= 800; });
    pruef("core BUILD", UC && UC.BUILD, function(v){ return v >= 20261026; });
    pruef("neue Kits in core", UC && [ "makeEntitySearch","entityRow","entityHl","entityId",
      "searchAttach","makeFlickerPill" ].every(function(k){ return typeof UC[k] === "function"; }), true);
    var cssDa = function(t){ return [].some.call(document.styleSheets, function(ss){
      try { return [].some.call(ss.cssRules, function(r){
        return (r.cssText || "").indexOf(t) >= 0; }); } catch(e){ return false; } }); };
    pruef("CSS: am-eff-track geladen", cssDa("am-eff-track"), true);
    pruef("CSS: am-pick-panel geladen", cssDa("am-pick-panel"), true);
    pruef("Farbtoken --up-blau", getComputedStyle(root).getPropertyValue("--up-blau").trim(), "#3b82f6");
    pruef("Farbtoken --up-lila", getComputedStyle(root).getPropertyValue("--up-lila").trim(), "#9a65e6");

    kopf("1  DER UMBAU -- er laeuft auf dem ALTEN Markup, das in Bubble eingebaut ist");
    /* Der Stempel ist eine VERSION. Er wird hier nicht auf einen festen Text geprueft, sondern
       darauf, dass er der aktuelle ist -- sonst muss diese Zeile bei jeder Fassung mitwandern
       und faellt genau dann durch, wenn sonst alles richtig ist. */
    pruef("Composer-Fassung ist die aktuelle", comp.getAttribute("data-am-composer"),
      function(v){ return /^v\d+$/.test(v || ""); }, "gestempelt: " +
      comp.getAttribute("data-am-composer"));
    pruef("Fader-Knopf weg", !g("am-settings-toggle"), true);
    pruef("Einstellungs-Fach weg", !g("am-settings-panel"), true);
    pruef("Plus da", !!g("am-pick-btn"), true);
    pruef("Aufwand-Schaltflaeche da", !!g("am-eff"), true);
    /* Die Modell-Schaltflaeche steht RECHTS, links neben dem Mikrofon (08.09. angefordert):
       links gehoert das Hinzufuegen, rechts das Absenden samt allem, was es naeher bestimmt. */
    pruef("links: nur das Plus", [].map.call(document.querySelector(".am-act-l").children,
      function(e){ return e.id || e.className; }).join(","), "am-pick-btn");
    pruef("rechts: Aufwand, Mikrofon, Senden", [].map.call(document.querySelector(".am-act-r").children,
      function(e){ return e.id; }).join(","), "am-eff,am-mic,am-send");
    /* DER TOTALAUSFALL, der vorher nur nicht ausgeloest wurde: der Klick-Zuhoerer auf
       #am-settings-toggle stand ohne Null-Wache, und amInit haette dort geworfen -- ohne
       zweiten Anlauf. Der Beweis, dass der Init BIS ZUM ENDE lief, ist alles, was nach
       jener Zeile kommt. */
    pruef("Init lief bis zum Ende: Modellname", g("am-eff-name").textContent, "Mira Pro 1.0");
    pruef("Init lief bis zum Ende: Ask-Mira-Knopf", !!g("am-ask-sel"), true);
    pruef("Init lief bis zum Ende: Chatpanel", !!g("am-prev-panel"), true);
    /* DIE KATEGORIEKARTEN SIND DER BESTE ZEUGE dafuer, dass amInit BIS ZUM ENDE lief:
       renderSuggested steht weit hinten, und alles, was davor wirft, laesst sie verschwinden.
       Am 08.09. hat genau das eine Regression gefangen -- ein Aufruf von L() VOR der
       Deklaration von STR (var, also noch undefined) warf, und die Folge war eine leere
       Galerie bei sonst unauffaelligem Bild. Ohne diese Zeile haette es niemand gemerkt. */
    pruef("Init lief bis zum Ende: die Kategoriekarten stehen",
      document.querySelectorAll(".am-cat-card").length, function(v){ return v >= 4; },
      "renderSuggested steht weit hinten -- keine Karten heisst: irgendwo davor hat es geworfen");
    pruef("Init lief bis zum Ende: die Galerie-Ueberschrift",
      (g("am-suggested-label") || {}).textContent, "Explore categories",
      "steht dort 'Try asking', ist galleryLabel leer -- also L() kaputt");
    pruef("negativer Rand am Mikrofon aufgehoben",
      getComputedStyle(g("am-mic")).marginLeft, "0px");

    uebergaengeAus();

    /* DIESER ABSCHNITT STEHT HIER UND NICHT WEITER UNTEN. Abschnitt 6 schickt eine Nachricht
       ab, und damit traegt die Wurzel has-messages: der Startschirm samt Kategoriekarten geht
       auf display: none. In einem nicht gerenderten Baum verweigert der Browser jedes
       transform -- gemessen sogar bei einem inline gesetzten -- und das sah aus, als greife die
       Hover-Regel nicht. */
    kopf("10  DIE KATEGORIEKARTEN UND \"ALLE CHATS\"  (08.09., zweite Runde)");
    (function(){
      /* Der Hover ueber eine Klasse GLEICHER Spezifitaet: :hover laesst sich im verdeckten
         Fenster nicht ausloesen, und ein inline-Stil waere eine andere Kaskadenstufe. */
      var st = document.createElement("style");
      /* Der Ersatz fuer :hover muss die ECHTEN Regeln nachstellen, BEIDE Themen. Zuerst stand
         hier nur der helle Wert; im Dunkeln sprang die Karte damit auf --up-sel-bg statt auf
         --vc-heading-bg, und die gemeldete Stufenzahl war 13 statt der wirklichen 7. Eine
         Messung, die eine andere Regel prueft als die ausgelieferte, ist keine. */
      st.textContent = '#ask-mira .am-cat-card.pruefhover { background: var(--up-sel-bg); }' +
        '#ask-mira[data-theme="dark"] .am-cat-card.pruefhover { background: var(--vc-heading-bg); }' +
        '#ask-mira .am-cat-card.pruefhover .am-cat-chev { transform: translateX(4px); }';
      document.head.appendChild(st);
      var karte = document.querySelectorAll(".am-cat-card")[1];
      var chev = karte.querySelector(".am-cat-chev");
      var cs = getComputedStyle(karte);
      pruef("Karte ohne Rahmen", cs.borderTopWidth + "/" + cs.borderTopStyle,
        function(v){ return v.indexOf("0px") === 0 || v.indexOf("none") >= 0; }, v_(cs));
      var ruhe = cs.backgroundColor;
      /* Gegen den Grund, den die SEITE malt -- Mira malt keinen. Ein Vergleich gegen den Grund
         der Pruefseite meldete beim ersten Anlauf 3 statt 7 Stufen. */
      var grund = getComputedStyle(document.body).backgroundColor;
      /* Ueber farbe/ueber/stufen und NICHT ueber ein Zahlenmuster: seit die dunkle Fuellung
         halbdurchsichtig ist, kommt sie als color(srgb ...) zurueck, und ein Muster, das nur
         Zahlen sammelt, meldete 109786 statt 7. */
      pruef("Karte hebt sich leise vom Seitengrund ab",
        stufen(ueber(farbe(ruhe), farbe(grund)), farbe(grund)),
        function(v){ return v >= 5 && v <= 16; },
        "Karte " + ruhe + " auf " + grund);
      karte.classList.add("pruefhover");
      var hov = getComputedStyle(karte).backgroundColor;
      var chevHov = getComputedStyle(chev).transform;
      karte.classList.remove("pruefhover");
      pruef("der Hover ist noch da, eine Sprosse hoeher",
        stufen(ueber(farbe(hov), farbe(grund)), ueber(farbe(ruhe), farbe(grund))),
        function(v){ return v >= 5; }, ruhe + " -> " + hov);
      pruef("das Chevron rueckt 4px", chevHov, "matrix(1, 0, 0, 1, 4, 0)");
      pruef("und zwar mit 200ms ease", (function(){
        var t = null;
        [].forEach.call(document.styleSheets, function(ss){
          try { [].forEach.call(ss.cssRules, function(r){
            if ((r.selectorText || "") === ".am-cat-chev") t = r.style.transition; }); } catch(e){}
        });
        return t;
      })(), "transform 200ms, color 200ms",
        "das CSSOM laesst 'ease' weg -- es ist der Vorgabewert");
    })();
    pruef("\"All Chats\" kommt aus dem Katalog",
      (g("am-open-prev").querySelector(".am-prev-label-full") || {}).textContent, "All Chats",
      "hier englisch; die deutsche Fassung wird getrennt geprueft");

    kopf("11  DRITTE RUNDE  (Polster, Kartentoene, der Umschalter, der Hinweis)");
    (function(){
      /* Das Polster oben MUSS so gross sein wie nach links. Der leere Bezugsstreifen ist eine
         Gitterzeile -- 0px hoch, aber der Abstand dahinter zaehlte trotzdem (gemessen 26 gegen
         16). Ein negativer Rand half nicht: das Gitter klemmt die Spur auf 0. */
      var cs = getComputedStyle(comp);
      var wrap = comp.querySelector(".am-input-wrap");
      var iOben = comp.getBoundingClientRect().top + parseFloat(cs.borderTopWidth);
      var iLinks = comp.getBoundingClientRect().left + parseFloat(cs.borderLeftWidth);
      pruef("Polster oben = Polster links",
        Math.round(wrap.getBoundingClientRect().top - iOben) + "/" +
        Math.round(wrap.getBoundingClientRect().left - iLinks), "16/16");
      pruef("kein Zeilenabstand im Gitter", getComputedStyle(comp).rowGap, "0px",
        "die Abstaende tragen die Elemente, damit ein leeres keinen kostet");
    })();
    (function(){
      /* Die Kartentoene haengen am Thema, und das folgt hier dem System -- also erst lesen,
         dann pruefen, statt einen Wert zu erwarten. */
      var dunkel = root.getAttribute("data-theme") === "dark";
      var grund = farbe(getComputedStyle(document.body).backgroundColor);
      var st = document.createElement("style");
      st.textContent = '#ask-mira .am-cat-card.h3 { background: var(--vc-sk) }' +
        '#ask-mira[data-theme="dark"] .am-cat-card.h3 { background: var(--vc-bg) }';
      document.head.appendChild(st);
      var k = document.querySelectorAll(".am-cat-card")[1];
      var ruhe = farbe(getComputedStyle(k).backgroundColor);
      k.classList.add("h3");
      var hov = farbe(getComputedStyle(k).backgroundColor);
      k.classList.remove("h3");
      pruef("Kategoriekarte ohne Rahmen", getComputedStyle(k).borderTopWidth, "0px");
      pruef(dunkel ? "dunkel: die Fuellung ist HALB durchsichtig" : "hell: die Fuellung ist deckend",
        ruhe.a, dunkel ? 0.5 : 1, "das war die Ansage: dunkel halbe Deckkraft, hell eine Sprosse hoeher");
      var sG = stufen(ueber(ruhe, grund), grund);
      pruef("Karte hebt sich vom Seitengrund ab", sG,
        dunkel ? 7 : 13, "dunkel war es vorher 13, jetzt halb so praesent");
      pruef("der Hover ist ein klarer Schritt", stufen(ueber(hov, grund), ueber(ruhe, grund)), 6);
    })();
    (function(){
      /* Die Reporting-Karten waren beim ersten Umbau uebersehen worden. Sie liegen in der
         Reporting-Kategorie, also erst dorthin klicken. */
      var rep = [].filter.call(document.querySelectorAll(".am-cat-card"), function(c){
        return c.classList.contains("am-cat-card-report"); })[0];
      if (!rep){ pruef("Reporting-Kategorie gefunden", false, true); return; }
      rep.click();
    })();
    await warte(900);
    (function(){
      var reps = document.querySelectorAll(".am-rep-card");
      pruef("die Reporting-Karten sind da", reps.length, function(v){ return v >= 3; });
      if (!reps.length) return;
      var dunkel = root.getAttribute("data-theme") === "dark";
      var grund = farbe(getComputedStyle(document.body).backgroundColor);
      var k = reps[0], ruhe = farbe(getComputedStyle(k).backgroundColor);
      pruef("Reporting-Karte ohne Rahmen", getComputedStyle(k).borderTopWidth, "0px",
        "sie standen als einzige Kartenfamilie noch mit Rahmen da");
      pruef("Reporting-Karte hat denselben Ton wie die Kategoriekarte",
        stufen(ueber(ruhe, grund), grund), dunkel ? 7 : 13);
      var st = document.createElement("style");
      st.textContent = '#ask-mira .am-rep-card.h3 .am-rep-go { transform: translateX(4px) }';
      document.head.appendChild(st);
      k.classList.add("h3");
      pruef("und ihr Pfeil rueckt auch 4px",
        getComputedStyle(k.querySelector(".am-rep-go")).transform, "matrix(1, 0, 0, 1, 4, 0)");
      k.classList.remove("h3");
    })();
    /* Zurueck auf die Kategorieuebersicht, damit die Abschnitte danach ihren Ausgangszustand
       vorfinden. */
    (function(){ var b = document.querySelector("[data-gallery-back]"); if (b) b.click(); })();
    await warte(700);

    kopf("2  DER SLIDER  (die Stufe SELBST ist der Wert: answer_detail = Mid | High | Ultra)");
    var btn = g("am-eff-btn"), tr = g("am-eff-track"), th = g("am-eff-thumb"), fl = g("am-eff-fill");
    var eff = g("am-eff");
    btn.click();
    var schiene = breite(tr), daumen = breite(th), weg = schiene - daumen - 5;
    pruef("Schiene breit", schiene, function(v){ return v > 180; });
    pruef("Daumen breit", daumen, 23, "aus .up-switch mit Faktor 28/22 abgeleitet");
    var halte = [];
    ["Mid","High","Ultra"].forEach(function(w, i){
      document.querySelectorAll(".am-eff-lbl")[i].click();
      halte.push({ stufe: i, daumen: Math.round(parseFloat((th.style.transform.match(/([\d.]+)px/) || [0,0])[1])),
        fuellung: +(parseFloat((fl.style.transform.match(/scaleX\(([\d.]+)\)/) || [0,0])[1])).toFixed(3),
        aria: tr.getAttribute("aria-valuenow") + "/" + tr.getAttribute("aria-valuetext"),
        ultra: root.classList.contains("is-ultra") });
    });
    pruef("Halt 0 Daumen", halte[0].daumen, 0);
    pruef("Halt 1 Daumen", halte[1].daumen, function(v){ return Math.abs(v - weg / 2) <= 1; },
      "Soll " + Math.round(weg / 2) + " (halber Weg von " + weg + ")");
    pruef("Halt 2 Daumen", halte[2].daumen, function(v){ return Math.abs(v - weg) <= 1; },
      "Soll " + weg);
    pruef("Fuellung waechst", halte[0].fuellung < halte[1].fuellung &&
      halte[1].fuellung < halte[2].fuellung, true,
      halte.map(function(h){ return h.fuellung; }).join(" < "));
    pruef("aria Halt 0", halte[0].aria, "0/Mid");
    pruef("aria Halt 1", halte[1].aria, "1/High");
    pruef("aria Halt 2", halte[2].aria, "2/Ultra");
    pruef("is-ultra NUR auf Halt 2",
      [halte[0].ultra, halte[1].ultra, halte[2].ultra].join(","), "false,false,true");
    pruef("Verlauf nur auf Ultra sichtbar", getComputedStyle(g("am-eff-ultra")).opacity, "1");
    document.querySelectorAll(".am-eff-lbl")[1].click();
    pruef("GEGENPROBE Verlauf auf High unsichtbar", getComputedStyle(g("am-eff-ultra")).opacity, "0");
    pruef("200ms ease am Daumen", getComputedStyle(th).transitionDuration.indexOf("0.2s") >= 0 ||
      document.getElementById("ohne-uebergang") ? "gemessen an der Regel" : "?", "gemessen an der Regel");

    kopf("3  DIE 200ms  (an der Regel gemessen, nicht am Endwert -- Uebergaenge sind hier aus)");
    uebergaengeAn();
    [["am-eff-thumb","transform"],["am-eff-fill","transform"],["am-eff-ultra","opacity"],
     ["am-eff-menu","opacity"],["am-pick-panel","opacity"],["am-picks","max-height"]].forEach(function(p){
      var el = g(p[0]); if (!el) { pruef("200ms " + p[0], "FEHLT", "0.2s"); return; }
      var cs = getComputedStyle(el);
      var i = cs.transitionProperty.split(", ").indexOf(p[1]);
      var d = cs.transitionDuration.split(", ")[i < 0 ? 0 : i];
      var f = cs.transitionTimingFunction.split(", ")[i < 0 ? 0 : i];
      pruef("200ms ease: " + p[0] + " / " + p[1], d + " " + f, "0.2s ease");
    });
    uebergaengeAus();

    kopf("4  FLASH  (die Sperre liegt auf der SCHIENE, nicht auf der Schaltflaeche)");
    g("am-eff-head").click();
    var flash = [].filter.call(document.querySelectorAll(".am-eff-opt"),
      function(o){ return o.getAttribute("data-model") === "flash"; })[0];
    flash.click();
    pruef("Flash: Stufe", g("am-eff-lvl").textContent, "Mid");
    pruef("Flash: Schiene gesperrt", getComputedStyle(tr).pointerEvents, "none");
    pruef("Flash: Schaltflaeche NICHT gesperrt", getComputedStyle(btn).pointerEvents, "auto",
      "sonst kaeme man aus Flash nicht mehr heraus");
    pruef("Flash: Kopfzeile NICHT gesperrt", getComputedStyle(g("am-eff-head")).pointerEvents, "auto");
    /* Der Hinweis haengt nicht mehr an max-height -- die Hoehe macht der Rumpf. Gemessen wird
       jetzt, was ihn sichtbar macht. */
    pruef("Flash: Hinweis sichtbar", getComputedStyle(g("am-eff-note")).visibility, "visible");
    pruef("Flash: KEIN Slider mehr", g("am-eff-slider").classList.contains("is-an"), false,
      "vorher stand er gedimmt da und sagte nichts, was der Hinweis nicht schon sagt");
    pruef("Flash: der Rumpf traegt nur den Hinweis",
      parseInt(g("am-eff-body").style.height, 10), function(v){ return v > 0 && v < 40; },
      "gesetzt: " + g("am-eff-body").style.height);
    document.querySelectorAll(".am-eff-lbl")[2].click();
    pruef("Flash: Klick auf Ultra tut nichts", g("am-eff-lvl").textContent, "Mid");
    g("am-eff-head").click();
    var pro = [].filter.call(document.querySelectorAll(".am-eff-opt"),
      function(o){ return o.getAttribute("data-model") === "pro"; })[0];
    pro.click();
    pruef("zurueck auf Pro moeglich", g("am-eff-name").textContent, "Mira Pro 1.0");
    pruef("Pro: der Slider ist wieder da", g("am-eff-slider").classList.contains("is-an"), true);
    pruef("Pro: Stufe wieder die Mitte", g("am-eff-lvl").textContent, "High");
    pruef("GEGENPROBE Hinweis wieder weg", getComputedStyle(g("am-eff-note")).visibility, "hidden");
    btn.click();

    kopf("5  DER PICKER  (dieselbe Maschine wie Quick Actions, ueber core)");
    window.__gefeuert = [];
    window.bubble_fn_quick_actions_search = function(a){ window.__gefeuert.push(JSON.parse(a)); };
    g("am-pick-btn").click();
    pruef("Panel offen", root.classList.contains("is-pick-open"), true);
    pruef("Panel auf ganzer Breite des Feldes",
      Math.abs(breite(g("am-pick-panel")) - breite(comp)) <= 2, true,
      breite(g("am-pick-panel")) + " gegen " + breite(comp));
    pruef("kein Umschalter mehr im Markup", document.querySelectorAll(".am-pick-scope").length, 0,
      "an seine Stelle sind die Befehls-Chips getreten");
    pruef("vier Erstbefehle als Chips", [].map.call(
      document.querySelectorAll("#am-pick-cmds .am-pick-cmd"),
      function(b){ return b.getAttribute("data-cmd"); }).join(","),
      "brands,prompts,domains,urls");
    pruef("die Chips tragen den Schraegstrich", [].every.call(
      document.querySelectorAll("#am-pick-cmds .am-pick-cmd"), function(b){
        return b.querySelector(".am-pick-cmd-slash"); }), true,
      "sie sagen damit, dass sie dasselbe tun wie das Tippen von /");
    pruef("kein Reference-Abschnitt", !document.querySelector(".am-pick-panel .mqa-refgroup"), true);
    pruef("keine Actions", document.querySelectorAll(".am-pick-panel .mqa-action").length, 0);
    var inp = g("am-pick-input");
    inp.value = "n"; inp.dispatchEvent(new Event("input", { bubbles: true }));
    await warte(UHR);
    pruef("ein Buchstabe feuert nicht", window.__gefeuert.length, 0, "Mindestlaenge ist 2");
    inp.value = "nike"; inp.dispatchEvent(new Event("input", { bubbles: true }));
    pruef("Skelett waehrend der Uhr laeuft", document.querySelectorAll(".am-pick-sk").length, 0,
      "die Uhr laeuft noch, das Skelett kommt mit dem Abschicken");
    await warte(UHR);
    pruef("nach der Uhr genau EINE Anfrage", window.__gefeuert.length, 1);
    var p = window.__gefeuert[0];
    pruef("alle neun Filterfelder plus limit und requestId",
      ["query","query_folded","query_de","scope","rank","citation_type","url_type","market",
       "mentioning","limit","requestId"].every(function(k){ return k in p; }), true);
    pruef("limit ist 8", p.limit, 8);
    pruef("requestId traegt das Praefix am_", /^am_/.test(p.requestId), true);
    pruef("Skelett steht", document.querySelectorAll(".am-pick-sk").length, function(v){ return v > 0; });

    /* 25 Treffer -- die Achtergrenze wird ZWEIMAL gezogen: limit im Payload und Schnitt im
       Kern. Was der Bubble-RPC mit limit tut, ist von hier aus nicht pruefbar. */
    /* 25 Treffer EINES Typs. Gemischt waere es hier falsch: die Anzeige laesst seit dem 08.09.
       nur den gewaehlten Typ durch (nie vermischt, ausdrueckliche Ansage), und ein Test mit vier
       Typen haette also nicht die Achtergrenze gemessen, sondern die Filterung. */
    var viele = [];
    for (var i = 0; i < 25; i++) viele.push({ type: "brand", id: "X" + i, name: "Marke " + i });
    viele.push({ type: "brnad", id: "kaputt" });   /* ein Tippfehler im Typ */
    window.MiraQuickActions.setResults({ requestId: p.requestId, items: viele });
    await warte(60);
    pruef("hoechstens acht Treffer", document.querySelectorAll(".am-pick-row").length, 8);
    pruef("Ergebnisliste rollt", getComputedStyle(g("am-pick-scroll")).overflowY, "auto");

    kopf("6  UEBERNEHMEN, ENTFERNEN, DAS FORMAT FUER DEN AGENTEN");
    /* JE TYP EINE SUCHE. Steht ein Bereich, laesst die Anzeige nur diesen Typ durch -- drei
       verschiedene Bezuege kommen also nicht aus EINER Trefferliste. Der Weg dorthin ist jetzt
       der Befehls-Chip, und genau den geht die Messung. */
    var CMD_ZU = { brand: "brands", domain: "domains", url: "urls", prompt: "prompts" };
    async function bereichSetzen(scope){
      /* Erst den gesetzten Bereich abraeumen: der Filtersatz kennt nur EINEN, und ohne das
         Kreuz bliebe der alte stehen und der neue Befehl faende keinen Chip mehr vor. */
      var x = document.querySelector('#am-pick-chips .am-pick-chip[data-fach="scope"] .am-pick-chip-x');
      if (x) x.click();
      var c = document.querySelector('#am-pick-cmds .am-pick-cmd[data-cmd="' + CMD_ZU[scope] + '"]');
      if (c) c.click();
      await warte(60);
    }
    async function holen(scope, items){
      await bereichSetzen(scope);
      inp.value = "such" + scope; inp.dispatchEvent(new Event("input", { bubbles: true }));
      await warte(UHR);
      window.MiraQuickActions.setResults({
        requestId: window.__gefeuert[window.__gefeuert.length - 1].requestId, items: items });
      await warte(80);
    }
    await holen("brand", [
      { type: "brand", id: "B-77", name: "Nike" },
      { type: "brand", id: "B-78", name: "Nike Running" }
    ]);
    pruef("nur der gewaehlte Typ, nie gemischt",
      [].map.call(document.querySelectorAll(".am-pick-type"),
        function(e){ return e.textContent; }).join(",") , "Brand,Brand");
    pruef("Trefferliste bleibt nach der Uebernahme stehen (erst nach dem Klick pruefen)",
      document.querySelectorAll(".am-pick-row").length, 2);
    document.querySelectorAll(".am-pick-row")[0].click();
    pruef("die Liste steht noch", document.querySelectorAll(".am-pick-row").length, 2,
      "sonst muesste man fuer den zweiten Bezug neu tippen");
    pruef("uebernommene Zeile wird grau",
      document.querySelectorAll(".am-pick-row.is-taken").length, 1);
    await holen("url", [{ type: "url", url: "https://nike.com/de/air-max",
      title: "Air Max \u2014 Der komplette Ueberblick ueber alle Modelle und ihre Geschichte" }]);
    document.querySelectorAll(".am-pick-row")[0].click();
    await holen("prompt", [{ type: "prompt", id: "P-12",
      prompt_text: "Beste Laufschuhe fuer Anfaenger", market: "de" }]);
    pruef("Prompt-Zeile traegt die Flaggenkachel",
      !!document.querySelectorAll(".am-pick-row")[0].querySelector(".am-pick-av.is-flag"), true,
      "eine Flagge ist quer -- im Quadrat bleibt von den USA nur das Sternenfeld");
    document.querySelectorAll(".am-pick-row")[0].click();
    pruef("drei Bezuege", document.querySelectorAll(".am-pick-tag").length, 3);
    pruef("bei drei macht das Feld zu", root.classList.contains("is-pick-open"), false);
    /* Die Pille mit dem langen URL-Titel heraussuchen -- die Reihenfolge der drei haengt
       daran, in welcher Runde sie aufgegriffen wurden. */
    var lbl = [].filter.call(document.querySelectorAll(".am-pick-tag-lbl"),
      function(e){ return e.textContent.indexOf("Air Max") === 0; })[0] ||
      document.querySelectorAll(".am-pick-tag-lbl")[1];
    pruef("langer URL-Titel bleibt EINE Reihe",
      lbl.getBoundingClientRect().height <= 22, true,
      Math.round(lbl.getBoundingClientRect().height) + "px hoch");
    pruef("langer URL-Titel wird gekuerzt", lbl.scrollWidth > lbl.clientWidth, true,
      lbl.scrollWidth + " in " + lbl.clientWidth);
    /* Ein vierter Bezug darf nicht gehen. Feld wieder auf und noch einmal versuchen. */
    g("am-pick-btn").click();
    await holen("brand", [{ type: "brand", id: "B-99", name: "Zu viel" }]);
    document.querySelectorAll(".am-pick-row")[0].click();
    pruef("ein vierter Bezug wird abgelehnt", document.querySelectorAll(".am-pick-tag").length, 3);
    g("am-pick-btn").click();

    window.__gesendet = null;
    window.bubble_fn_ask_mira_send = function(a){ window.__gesendet = a; };
    var ta = g("am-textarea");
    pruef("nur Bezuege: Senden ist moeglich", !g("am-send").disabled, true);
    ta.value = "Woran liegt das?"; ta.dispatchEvent(new Event("input", { bubbles: true }));
    document.querySelectorAll(".am-eff-lbl").length && (function(){
      btn.click(); document.querySelectorAll(".am-eff-lbl")[2].click(); btn.click();
    })();
    g("am-send").click();
    await warte(60);
    var gs = JSON.parse(window.__gesendet);
    pruef("Payload-Schluessel unveraendert", Object.keys(gs).join(","),
      "chat_id,message,answer_detail,model");
    pruef("answer_detail bei Ultra", gs.answer_detail, "Ultra",
      "die Stufe SELBST ist der Wert -- der Feldname bleibt answer_detail");
    pruef("Bezugsblock steht oben", gs.message.indexOf("Context:"), 0);
    pruef("Marke mit UID", gs.message.indexOf("- Brand: Nike (uid: B-77)") > 0, true);
    pruef("Prompt mit UID", gs.message.indexOf("(uid: P-12)") > 0, true);
    pruef("URL als Wert", gs.message.indexOf("- URL: https://nike.com/de/air-max") > 0, true);
    pruef("Frage steht unter dem Bezug",
      gs.message.indexOf("Woran liegt das?") > gs.message.indexOf("Context:"), true);
    pruef("nach dem Senden sind die Bezuege weg", document.querySelectorAll(".am-pick-tag").length, 0);
    /* DIE ALTEN DREI WERTE muessen auf IHRER Stufe landen und nicht stillschweigend in der
       Mitte. Sie koennen in window.askMiraState vorbelegt sein oder in einem gespeicherten
       Chat ueberlebt haben.
       Geprueft wird der ECHTE Weg: den Zustand setzen und das Menue oeffnen -- das ruft
       effZeichnen, und das liest die Stufe ueber effIndex. Ein Test, der die Stufe erst
       anklickt und dann nachsieht, ob sie steht, koennte nicht fehlschlagen. */
    [["short", "Mid"], ["balanced", "High"], ["detailed", "Ultra"],
     ["quatsch", "High"]].forEach(function(paar){
      if (eff.classList.contains("is-open")) btn.click();
      window.askMiraState.answerDetail = paar[0];
      btn.click();                                  /* oeffnen -> effZeichnen liest neu */
      pruef("alter Wert \"" + paar[0] + "\" landet auf " + paar[1],
        g("am-eff-lvl").textContent, paar[1],
        paar[0] === "quatsch" ? "Unbekanntes faellt auf die Mitte" : "");
      btn.click();
    });

    kopf("7  KAPUTTE UND LEERE ANTWORTEN  (leer und kaputt sind zwei Dinge)");
    var faelle = [
      ["leere Liste", []],
      ["unlesbarer Text", "{kaputt"],
      ["alle Typen falsch", [{type:"brnad",id:"a"},{type:"brnad",id:"b"}]],
      /* Als BRAND und nicht als URL: der Fall prueft, ob ein nacktes Emoji den Parser
         ueberlebt, nicht die Filterung nach Typ. */
      ["Emoji im Text", '[{"type":"brand","id":"e1","name":"A 🎉"}]'],
      ["nacktes yes", '[{"type":"brand","id":"b","name":"X","aktiv":yes}]']
    ];
    /* AUF BRAND STELLEN. Die Anzeige laesst nur den gewaehlten Typ durch, und die Faelle unten
       schicken teils URL- und teils Brand-Items -- ohne festen Bereich haette der Emoji-Fall
       0 Zeilen gemeldet, obwohl der Payload sauber gelesen wurde. Genau so passiert. */
    await bereichSetzen("brand");
    for (var fi = 0; fi < faelle.length; fi++){
      if (!root.classList.contains("is-pick-open")) g("am-pick-btn").click();
      inp.value = "test" + fi; inp.dispatchEvent(new Event("input", { bubbles: true }));
      await warte(UHR);
      var rq = window.__gefeuert[window.__gefeuert.length - 1].requestId;
      window.MiraQuickActions.setResults({ requestId: rq, items: faelle[fi][1] });
      await warte(60);
      var txt = g("am-pick-list").textContent;
      var skelett = document.querySelectorAll(".am-pick-sk").length;
      pruef(faelle[fi][0] + ": Ladezustand beendet", skelett, 0,
        "ein Skelett, das ewig laeuft, ist die schlechteste aller Meldungen");
      if (fi === 0) pruef("leer sagt 'keine Treffer'", txt.indexOf("No results") >= 0, true);
      if (fi === 1 || fi === 2) pruef(faelle[fi][0] + " sagt NICHT 'keine Treffer'",
        txt.indexOf("No results") < 0 && txt.length > 0, true);
      if (fi === 3) pruef("Emoji ueberlebt", document.querySelectorAll(".am-pick-row").length, 1);
      if (fi === 4) pruef("nacktes yes ueberlebt", document.querySelectorAll(".am-pick-row").length, 1);
    }
    if (root.classList.contains("is-pick-open")) g("am-pick-btn").click();

    kopf("7b  DIE BEFEHLE  (der Umschalter ist fort, die /-Logik von Quick Actions tut es)");
    /* ZWEI GEMESSENE FEHLER, beide aus dem Leeren des Suchfeldes. Die Palette leert es beim
       Anwenden eines Befehls -- dort kommt man an einen Befehl auch nur ueber "/", das Feld ist
       also ohnehin verbraucht. Hier gibt es Chips, und ein Klick darauf traf eine echte Suche:
       gemessen ging "nike" verloren und citation_type hinaus als "". Beides wird jetzt gehalten.
       Gezaehlt wird die ZAHL der Anfragen, nicht der letzte Payload -- der Fehlschluss davor war,
       denselben alten Payload zweimal zu lesen und den Stand fuer richtig zu halten. */
    if (!root.classList.contains("is-pick-open")) g("am-pick-btn").click();
    (function(){ var x = document.querySelector("#am-pick-chips .am-pick-chip-x");
      while (x){ x.click(); x = document.querySelector("#am-pick-chips .am-pick-chip-x"); } })();
    inp.value = "nike"; inp.dispatchEvent(new Event("input", { bubbles: true }));
    await warte(UHR);
    var vor7b = window.__gefeuert.length;
    document.querySelector('#am-pick-cmds .am-pick-cmd[data-cmd="urls"]').click();
    await warte(UHR);
    pruef("7b ein Chip-Klick loest eine NEUE Anfrage aus",
      window.__gefeuert.length - vor7b, 1);
    pruef("die getippte Suche ueberlebt den Chip-Klick", inp.value, "nike");
    pruef("und geht mit dem Bereich zusammen hinaus", (function(){
      var p = window.__gefeuert[window.__gefeuert.length - 1];
      return p.query + "/" + p.scope;
    })(), "nike/url");
    var vor7c = window.__gefeuert.length;
    document.querySelector('#am-pick-cmds .am-pick-cmd[data-cmd="citation-type"]').click();
    await warte(120);
    pruef("ein Unterbefehl sucht NICHT, er geht nur tiefer",
      window.__gefeuert.length - vor7c, 0);
    pruef("das Feld traegt den Befehlspfad", inp.value, "/citation-type ");
    pruef("die Unterliste steht", document.querySelectorAll(
      "#am-pick-list .am-pick-row[data-cmd-val]").length, 7, "sieben Zitationstypen");
    document.querySelector('#am-pick-list .am-pick-row[data-cmd-val="Editorial"]').click();
    await warte(UHR);
    pruef("der gewaehlte Wert geht wirklich hinaus", (function(){
      var p = window.__gefeuert[window.__gefeuert.length - 1];
      return p.citation_type + "/" + p.scope + "/" + p.query;
    })(), "Editorial/url/nike",
      "gemessen war hier citation_type leer -- das Feld war geleert, also wurde nie neu gesucht");
    pruef("die beiseitegelegte Suche kommt zurueck", inp.value, "nike");
    pruef("ein gesetzter Befehl verschwindet aus dem Angebot",
      [].map.call(document.querySelectorAll("#am-pick-cmds .am-pick-cmd"), function(b){
        return b.getAttribute("data-cmd"); }).indexOf("citation-type"), -1);
    pruef("zwei Chips stehen im Feld", [].map.call(
      document.querySelectorAll("#am-pick-chips .am-pick-chip"), function(c){
        return c.getAttribute("data-fach"); }).join(","), "scope,type",
      "das Fach heisst type, das Payload-Feld citation_type -- die Namen sind getrennt");
    /* Die Ruecktaste im leeren Feld nimmt den letzten Chip -- ohne sie kommt die Tastatur an
       einen gesetzten Filter nur ueber ein 19px kleines Kreuz. */
    inp.value = ""; inp.dispatchEvent(new Event("input", { bubbles: true }));
    inp.dispatchEvent(new KeyboardEvent("keydown", { key: "Backspace", bubbles: true }));
    await warte(80);
    pruef("die Ruecktaste nimmt den letzten Chip", document.querySelectorAll(
      "#am-pick-chips .am-pick-chip").length, 1);
    (function(){ var x = document.querySelector("#am-pick-chips .am-pick-chip-x");
      while (x){ x.click(); x = document.querySelector("#am-pick-chips .am-pick-chip-x"); } })();
    if (root.classList.contains("is-pick-open")) g("am-pick-btn").click();

    kopf("8  DER VERTEILER  (deshalb braucht die Suche KEINEN Eingriff in Bubble)");
    /* ZUSTELLUNGEN zaehlen und nicht DOM-Zeilen. Der Fehlschluss davor: die Trefferliste trug
       noch das Ergebnis des vorigen Falls, und eine Zeile darin sah wie eine falsch geroutete
       Antwort aus. Hier meldet sich ein eigener Kunde am Verteiler an und zaehlt selbst. */
    var anMira = 0, anPalette = 0;
    var eigen = UC.makeEntitySearch({ prefix: "am", limit: 8,
      onResults: function(){ anMira++; }, onLoading: function(){}, onError: function(){},
      onIdle: function(){} });
    /* Eine Palette nachstellen: sie ist der Standardkanal und bekommt alles Fremde. */
    window.MiraQuickActions = UC.searchAttach("qa", {
      setResults: function(){ anPalette++; }, setLoading: function(){}, setError: function(){} });
    window.MiraQuickActions.setResults({ items: [{ type:"brand", id:"b", name:"ohne Id" }] });
    pruef("Antwort OHNE requestId geht an die Palette", anPalette + "/" + anMira, "1/0",
      "das ist die heutige Notluke und sie bleibt so");
    window.MiraQuickActions.setResults({ requestId: "qa_1_x", items: [{ type:"brand", id:"b", name:"fremd" }] });
    pruef("Antwort mit fremder Id geht an die Palette", anPalette + "/" + anMira, "2/0");
    eigen.tippen("nike", "");
    await warte(UHR);
    var eigenId = window.__gefeuert[window.__gefeuert.length - 1].requestId;
    window.MiraQuickActions.setResults({ requestId: eigenId, items: [{ type:"brand", id:"b", name:"eigen" }] });
    pruef("Antwort mit eigener Id geht an Mira", anPalette + "/" + anMira, "2/1",
      "und NICHT an die Palette -- das ist der ganze Sinn des Verteilers");
    /* Doppelt geschickt: einer der fuenf Wege, auf denen ein Bubble-Payload beschaedigt
       ankommt. Er darf nicht lautlos verschwinden. */
    window.MiraQuickActions.setResults({ requestId: eigenId, items: [{ type:"brand", id:"b", name:"eigen" }] });
    pruef("doppelt geschickte Antwort kommt an", anMira, 2,
      "lautlos wegwerfen ist genau das Verbotene");

    kopf("9  DIE NACHBESSERUNGEN VOM 08.09.  (dreizehn Punkte, je eine Pruefung)");
    /* 1 */
    pruef("1 Modellknopf ohne Rahmen", getComputedStyle(g("am-eff-btn")).borderTopColor,
      function(v){ return /rgba\(0, 0, 0, 0\)|transparent/.test(v); },
      "1px transparent bleibt stehen, sonst springt die Zeile um 2px");
    pruef("1 Menue rechts verankert", getComputedStyle(g("am-eff-menu")).right, "0px");
    /* 2 */
    pruef("2 keine Zeichen an Knopf und Kopf", !g("am-eff-ic") && !g("am-eff-hic"), true);
    pruef("2 keine Zeichen in der Modellliste",
      document.querySelectorAll(".am-eff-opt .am-eff-ic").length, 0);
    /* 3 */
    pruef("3 Namen", [].map.call(document.querySelectorAll(".am-eff-opt-name"),
      function(e){ return e.textContent; }).join(" / "), "Mira Pro 1.0 / Mira Flash");
    /* 4 */
    pruef("4 Punkte in eigener Schicht", !!g("am-eff-dots") &&
      g("am-eff-dots").parentElement === g("am-eff-ultra"), true);
    pruef("4 Ausblender NUR auf den Punkten", (function(){
      var d = getComputedStyle(g("am-eff-dots")), u = getComputedStyle(g("am-eff-ultra"));
      var dm = (d.maskImage && d.maskImage !== "none") ? d.maskImage : d.webkitMaskImage;
      var um = (u.maskImage && u.maskImage !== "none") ? u.maskImage : u.webkitMaskImage;
      return (/linear-gradient/.test(dm || "")) && !(/linear-gradient/.test(um || ""));
    })(), true, "der Verlauf steht auf ganzer Breite, nur die Punkte faden nach links");
    pruef("4 die Punkte sind weiss", getComputedStyle(g("am-eff-dots")).color, "rgb(255, 255, 255)");
    /* 5 */
    pruef("5 Menuepolster", getComputedStyle(g("am-eff-menu")).padding, "8px");
    /* An der REGEL und nicht am berechneten Wert: die Uebergaenge sind in diesem Abschnitt
       abgeschaltet (siehe oben, sonst haengen sie und halten jeden Wert auf dem Startwert),
       und der berechnete Wert waere damit immer 0s. */
    pruef("5 EIN Wert faehrt die Hoehe", (function(){
      var t = null;
      [].forEach.call(document.styleSheets, function(ss){
        try { [].forEach.call(ss.cssRules, function(r){
          if ((r.selectorText || "") === ".am-eff-body") t = r.style.transition;
        }); } catch(e){}
      });
      return t;
    })(), "height 200ms",
      "das CSSOM laesst 'ease' weg -- es ist der Vorgabewert. In der Datei steht es.");
    (function(){
      /* Die drei Hoehen muessen sich unterscheiden UND gesetzt sein -- ein leerer Wert heisst,
         effRumpf hat nie gemessen, und dann springt es wieder. */
      var h = {};
      btn.click();                       h.slider = g("am-eff-body").style.height;
      g("am-eff-head").click();          h.modelle = g("am-eff-body").style.height;
      g("am-eff-head").click();          h.zurueck = g("am-eff-body").style.height;
      btn.click();
      pruef("5 drei gemessene Hoehen, keine geraten",
        !!h.slider && !!h.modelle && h.slider !== h.modelle && h.zurueck === h.slider, true,
        "Slider " + h.slider + ", Modelle " + h.modelle + ", zurueck " + h.zurueck);
    })();
    /* 6 */
    g("am-pick-btn").click();
    pruef("6 Ueberschrift steht", g("am-pick-h").textContent, "What are you looking for?");
    pruef("6 Befehls-Chip 28px", Math.round(
      document.querySelector("#am-pick-cmds .am-pick-cmd").getBoundingClientRect().height), 28);
    pruef("kein Rahmen um die Chip-Zeile", getComputedStyle(g("am-pick-cmds")).borderTopWidth,
      "0px", "der Kontrast kommt vom Chip selbst, nicht von einem Kasten darum");
    pruef("Ueberschrift ohne Versal", getComputedStyle(g("am-pick-h")).textTransform, "none");
    pruef("Abstand zum Suchfeld verdoppelt", Math.round(
      g("am-pick-h").getBoundingClientRect().top -
      g("am-pick-input").closest(".am-pick-search").getBoundingClientRect().bottom), 4,
      "vorher 2");
    /* DER KONTRAST KOMMT VOM CHIP, nicht von einem Kasten -- dieselbe Rechnung wie vorher beim
       Umschalter, nur ist der gemessene Koerper jetzt der Chip. Gemessen wird Chip gegen Panel,
       auf der Flaechen-Skala (1.4.11), nicht auf der Text-Skala. */
    pruef("der Befehls-Chip hebt sich vom Panel ab", (function(){
      var c = document.querySelector("#am-pick-cmds .am-pick-cmd");
      var panel = farbe(getComputedStyle(g("am-pick-panel")).backgroundColor);
      var chip = ueber(farbe(getComputedStyle(c).backgroundColor), panel);
      return stufen(chip, panel);
    })(), function(v){ return v >= 4; },
      "die Flaeche des Chips traegt den Unterschied allein");
    /* 7 */
    pruef("7 Feld 16px Ecken", getComputedStyle(comp).borderRadius, "16px");
    /* 11 */
    pruef("11 Hover-Flaeche 32x32", (function(){
      var v = getComputedStyle(g("am-pick-btn"), "::before");
      return v.width + "/" + v.height + "/" + getComputedStyle(g("am-pick-btn")).width;
    })(), "32px/32px/40px", "Klickziel bleibt 40, die Farbe ist 32");
    /* 12 -- ZUERST in den Ruhezustand bringen. Die Liste trug hier noch das Ergebnis der
       Suche aus Abschnitt 5; gemessen wurde dann eine Trefferzeile und nicht der Hinweis. */
    inp.value = ""; inp.dispatchEvent(new Event("input", { bubbles: true }));
    await warte(200);
    pruef("12 Ruhehinweis: Titel und Erklaersatz",
      (document.querySelector(".am-pick-note-t") || {}).textContent, "Search your workspace");
    pruef("der Erklaersatz sagt, WOFUER der Picker da ist",
      ((document.querySelector(".am-pick-note-sub") || {}).textContent || "").indexOf("attach") > 0,
      true);
    pruef("Titel in der Sekundaerfarbe, Satz in der Drittfarbe", (function(){
      var t = getComputedStyle(document.querySelector(".am-pick-note-t")).color;
      var u = getComputedStyle(document.querySelector(".am-pick-note-sub")).color;
      var m = getComputedStyle(root).getPropertyValue("--vc-muted").trim();
      var d = getComputedStyle(root).getPropertyValue("--vc-third").trim();
      var hex = function(c){ var f = farbe(c); return "#" + [f.r,f.g,f.b].map(function(v){
        return ("0" + Math.round(v).toString(16)).slice(-2); }).join(""); };
      return (hex(t) === m.toLowerCase()) + "/" + (hex(u) === d.toLowerCase());
    })(), "true/true");
    pruef("beide mittig", (function(){
      var p = g("am-pick-panel").getBoundingClientRect();
      var mitte = function(e){ var b = e.getBoundingClientRect();
        return Math.round(Math.abs((b.left + b.width/2) - (p.left + p.width/2))); };
      return mitte(document.querySelector(".am-pick-note-t")) + "/" +
             mitte(document.querySelector(".am-pick-note-sub"));
    })(), function(v){ return /^[01]\/[01]$/.test(v); });
    pruef("12 mit Datenbank-Zeichen darueber",
      !!document.querySelector(".am-pick-note-ic svg"), true);
    /* 13 -- auf Deutsch geprueft, denn nur dort war es falsch */
    pruef("13 der Befehl sagt Brands (hier englisch, DE getrennt geprueft)",
      (document.querySelector('#am-pick-cmds .am-pick-cmd[data-cmd="brands"] .am-pick-cmd-lbl')
        || {}).textContent, "Brands");
    g("am-pick-btn").click();
    /* 8 und 9 -- an ECHTEN Pillen, mit Bild und ohne. Eine Pruefung, die nur nachsieht, ob
       eine Funktion existiert, kann nicht fehlschlagen und ist damit keine. */
    var pixel = "data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 " +
      "viewBox=%220 0 10 10%22%3E%3Crect width=%2210%22 height=%2210%22 fill=%22%23e11%22/%3E%3C/svg%3E";
    /* Wieder je Typ eine Suche: die zwei Brands aus dem Brand-Bereich, die Flagge aus dem
       Prompt-Bereich. Gemischt kaeme der Prompt gar nicht in die Liste -- und das ist richtig
       so, also muss die Messung den Weg gehen und nicht die Regel umgehen. */
    g("am-pick-btn").click();
    await holen("brand", [
      { type: "brand", id: "L1", name: "MitLogo", logo: pixel },
      { type: "brand", id: "L3", name: "OhneLogo", logo: "" }
    ]);
    document.querySelectorAll(".am-pick-row")[0].click();
    document.querySelectorAll(".am-pick-row")[1].click();
    await holen("prompt", [{ type: "prompt", id: "L2", prompt_text: "MitFlagge", market: "de" }]);
    document.querySelectorAll(".am-pick-row")[0].click();
    await warte(120);
    var pillen = [].map.call(document.querySelectorAll(".am-pick-tag"), function(t){
      var av = t.querySelector("[class*=am-pick-tag-av]");
      var fb = t.querySelector(".am-pick-tag-av-fb");
      var im = t.querySelector(".am-pick-tag-av img");
      return { text: t.querySelector(".am-pick-tag-lbl").textContent,
               bild: !!im, fbSichtbar: fb ? getComputedStyle(fb).display !== "none" : null,
               fbText: fb ? fb.textContent.trim() : "",
               bildBreite: im ? Math.round(im.getBoundingClientRect().width) : 0,
               kachel: Math.round(av.getBoundingClientRect().width) };
    });
    /* Nach Namen greifen und nicht nach Reihenfolge -- die haengt daran, in welcher Runde eine
       Pille aufgegriffen wurde. */
    var mitLogo  = pillen.filter(function(x){ return x.text === "MitLogo"; })[0];
    var ohneLogo = pillen.filter(function(x){ return x.text === "OhneLogo"; })[0];
    var mitFlagge = pillen.filter(function(x){ return x.text === "MitFlagge"; })[0];
    pruef("8 mit Logo: KEIN Buchstabe daneben",
      !!mitLogo && mitLogo.bild && !mitLogo.fbSichtbar, true,
      "vorher stand neben dem Logo noch ein N");
    pruef("9 mit Flagge: KEIN Marktkuerzel daneben",
      !!mitFlagge && mitFlagge.bild && !mitFlagge.fbSichtbar, true,
      "vorher stand neben der Flagge noch ein D");
    pruef("9 das Bild fuellt die Kachel, ist also nicht gequetscht",
      !!mitLogo && mitLogo.bildBreite === mitLogo.kachel, true,
      mitLogo ? mitLogo.bildBreite + " in " + mitLogo.kachel : "?");
    pruef("GEGENPROBE ohne Logo ist der Buchstabe DA",
      !!ohneLogo && !ohneLogo.bild && ohneLogo.fbSichtbar && ohneLogo.fbText === "O", true,
      "sonst pruefte die Messung nur, dass nie etwas zu sehen ist");

    malen();
    if (location.search.indexOf("zeigen") >= 0){
      uebergaengeAn();
      document.getElementById("buehne").className = "zeigen";
    }
  }
  /* EIN WURF DARF DEN PRUEFTAND NICHT STUMM MACHEN. malen() lief bisher nur am Ende; starb
     die Folge unterwegs, stand auf der Seite fuer immer "laeuft..." und nichts sagte, wo.
     Genau das ist am 08.09. passiert (ein fehlendes #am-eff-body auf altem Markup), und die
     Ursache war eine Minute lang unsichtbar. Jetzt wird gemalt, was bis dahin da war, und der
     Wurf steht als letzte Zeile darunter. */
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
