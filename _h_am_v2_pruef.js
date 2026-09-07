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
      var zahl = function(c){ return (String(c).match(/\d+/g) || []).slice(0,3).map(Number); };
      var stufen = function(a, b){ var A = zahl(a), B = zahl(b);
        return Math.max.apply(null, A.map(function(v, i){ return Math.abs(v - B[i]); })); };
      var cs = getComputedStyle(karte);
      pruef("Karte ohne Rahmen", cs.borderTopWidth + "/" + cs.borderTopStyle,
        function(v){ return v.indexOf("0px") === 0 || v.indexOf("none") >= 0; }, v_(cs));
      var ruhe = cs.backgroundColor;
      /* Gegen den Grund, den die SEITE malt -- Mira malt keinen. Ein Vergleich gegen den Grund
         der Pruefseite meldete beim ersten Anlauf 3 statt 7 Stufen. */
      var grund = getComputedStyle(document.body).backgroundColor;
      pruef("Karte hebt sich leise vom Seitengrund ab", stufen(ruhe, grund),
        function(v){ return v >= 5 && v <= 16; },
        "Karte " + ruhe + " auf " + grund);
      karte.classList.add("pruefhover");
      var hov = getComputedStyle(karte).backgroundColor;
      var chevHov = getComputedStyle(chev).transform;
      karte.classList.remove("pruefhover");
      pruef("der Hover ist noch da, eine Sprosse hoeher", stufen(hov, ruhe),
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

    kopf("2  DER SLIDER  (Medium/High/Ultra -> short/balanced/detailed, Werte unveraendert)");
    var btn = g("am-eff-btn"), tr = g("am-eff-track"), th = g("am-eff-thumb"), fl = g("am-eff-fill");
    btn.click();
    var schiene = breite(tr), daumen = breite(th), weg = schiene - daumen - 5;
    pruef("Schiene breit", schiene, function(v){ return v > 180; });
    pruef("Daumen breit", daumen, 23, "aus .up-switch mit Faktor 28/22 abgeleitet");
    var halte = [];
    ["short","balanced","detailed"].forEach(function(w, i){
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
    pruef("aria Halt 0", halte[0].aria, "0/Medium");
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
    pruef("Flash: Stufe", g("am-eff-lvl").textContent, "Medium");
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
    pruef("Flash: Klick auf Ultra tut nichts", g("am-eff-lvl").textContent, "Medium");
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
    pruef("vier Typ-Knoepfe", [].map.call(document.querySelectorAll(".am-pick-scope"),
      function(b){ return b.textContent; }).join(","), "Brands,Domains,URLs,Prompts");
    pruef("Typ-Knoepfe sind .up-seg aus core", !!g("am-pick-scopes").querySelector(".up-seg"), true,
      "der gleitende Streifen kommt damit von core, mit 200ms ease");
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
    var viele = [];
    for (var i = 0; i < 25; i++) viele.push({ type: ["brand","domain","url","prompt"][i % 4],
      id: "X" + i, name: "Marke " + i, domain: "d" + i + ".de", url: "https://u" + i + ".de/x",
      title: "Titel " + i, prompt_text: "Prompt " + i, market: "de" });
    viele.push({ type: "brnad", id: "kaputt" });   /* ein Tippfehler im Typ */
    window.MiraQuickActions.setResults({ requestId: p.requestId, items: viele });
    await warte(60);
    pruef("hoechstens acht Treffer", document.querySelectorAll(".am-pick-row").length, 8);
    pruef("Ergebnisliste rollt", getComputedStyle(g("am-pick-scroll")).overflowY, "auto");

    kopf("6  UEBERNEHMEN, ENTFERNEN, DAS FORMAT FUER DEN AGENTEN");
    /* EINE FRISCHE ANFRAGE. Der Fehlschluss davor: hier wurde noch einmal auf p.requestId
       geantwortet, und der Achtergrenzen-Fall hatte bereits acht Zeilen dort stehen -- gemessen
       wurden dann dessen Zeilen ("Marke 0" statt "Nike"), und der Formattest prueft am Ende
       Zeichenketten, die nie im Bild waren. Eine Suche, eine Antwort. */
    inp.value = "nike2"; inp.dispatchEvent(new Event("input", { bubbles: true }));
    await warte(UHR);
    var p6 = window.__gefeuert[window.__gefeuert.length - 1];
    window.MiraQuickActions.setResults({ requestId: p6.requestId, items: [
      { type:"brand",  id:"B-77", name:"Nike" },
      { type:"domain", domain:"nike.com" },
      { type:"url",    url:"https://nike.com/de/air-max",
        title:"Air Max — Der komplette Ueberblick ueber alle Modelle und ihre Geschichte" },
      { type:"prompt", id:"P-12", prompt_text:"Beste Laufschuhe fuer Anfaenger", market:"de" }
    ]});
    await warte(60);
    pruef("Prompt-Zeile traegt die Flaggenkachel",
      !!document.querySelectorAll(".am-pick-row")[3].querySelector(".am-pick-av.is-flag"), true,
      "eine Flagge ist quer -- im Quadrat bleibt von den USA nur das Sternenfeld");
    document.querySelectorAll(".am-pick-row")[0].click();
    pruef("Trefferliste bleibt nach der Uebernahme stehen",
      document.querySelectorAll(".am-pick-row").length, 4,
      "sonst muesste man fuer den zweiten Bezug neu tippen");
    pruef("uebernommene Zeile wird grau", document.querySelectorAll(".am-pick-row.is-taken").length, 1);
    document.querySelectorAll(".am-pick-row")[2].click();
    document.querySelectorAll(".am-pick-row")[3].click();
    pruef("drei Bezuege", document.querySelectorAll(".am-pick-tag").length, 3);
    pruef("bei drei macht das Feld zu", root.classList.contains("is-pick-open"), false);
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
    inp.value = "nike"; inp.dispatchEvent(new Event("input", { bubbles: true }));
    await warte(UHR);
    window.MiraQuickActions.setResults({ requestId: window.__gefeuert[window.__gefeuert.length-1].requestId,
      items: [{ type:"brand", id:"B-99", name:"Zu viel" }] });
    await warte(60);
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
    pruef("answer_detail bei Ultra", gs.answer_detail, "detailed",
      "die Werte aendern sich NICHT -- der Slider ist nur eine neue Darstellung");
    pruef("Bezugsblock steht oben", gs.message.indexOf("Context:"), 0);
    pruef("Marke mit UID", gs.message.indexOf("- Brand: Nike (uid: B-77)") > 0, true);
    pruef("Prompt mit UID", gs.message.indexOf("(uid: P-12)") > 0, true);
    pruef("URL als Wert", gs.message.indexOf("- URL: https://nike.com/de/air-max") > 0, true);
    pruef("Frage steht unter dem Bezug",
      gs.message.indexOf("Woran liegt das?") > gs.message.indexOf("Context:"), true);
    pruef("nach dem Senden sind die Bezuege weg", document.querySelectorAll(".am-pick-tag").length, 0);

    kopf("7  KAPUTTE UND LEERE ANTWORTEN  (leer und kaputt sind zwei Dinge)");
    var faelle = [
      ["leere Liste", []],
      ["unlesbarer Text", "{kaputt"],
      ["alle Typen falsch", [{type:"brnad",id:"a"},{type:"brnad",id:"b"}]],
      ["Emoji im Text", '[{"type":"url","url":"https://a.de","title":"A 🎉"}]'],
      ["nacktes yes", '[{"type":"brand","id":"b","name":"X","aktiv":yes}]']
    ];
    for (var fi = 0; fi < faelle.length; fi++){
      g("am-pick-btn").click();
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
      g("am-pick-btn").click();
    }

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
    pruef("6 Umschalter 32px", Math.round(
      g("am-pick-scopes").querySelector(".up-seg").getBoundingClientRect().height), 32);
    pruef("6 Umschalter hebt sich ab", (function(){
      var seg = getComputedStyle(g("am-pick-scopes").querySelector(".up-seg"));
      var pan = getComputedStyle(g("am-pick-panel"));
      var a = (seg.backgroundColor.match(/\d+/g) || []).slice(0,3).map(Number);
      var b = (pan.backgroundColor.match(/\d+/g) || []).slice(0,3).map(Number);
      var d = Math.max.apply(null, a.map(function(v,i){ return Math.abs(v - b[i]); }));
      return { d: d, rand: seg.borderTopWidth };
    })(), function(v){ return v.d >= 5 && v.rand === "1px"; },
      "vorher waren es 2 Kanalstufen und kein Rand -- unsichtbar");
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
    pruef("12 Ruhehinweis: nur der eine Satz",
      g("am-pick-list").textContent.trim(), "Search your workspace");
    pruef("12 mit Datenbank-Zeichen darueber",
      !!document.querySelector(".am-pick-note-ic svg"), true);
    /* 13 -- auf Deutsch geprueft, denn nur dort war es falsch */
    pruef("13 der Umschalter sagt Brands (hier englisch, DE getrennt geprueft)",
      [].map.call(document.querySelectorAll(".am-pick-scope"),
        function(b){ return b.textContent; })[0], "Brands");
    g("am-pick-btn").click();
    /* 8 und 9 -- an ECHTEN Pillen, mit Bild und ohne. Eine Pruefung, die nur nachsieht, ob
       eine Funktion existiert, kann nicht fehlschlagen und ist damit keine. */
    var pixel = "data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 " +
      "viewBox=%220 0 10 10%22%3E%3Crect width=%2210%22 height=%2210%22 fill=%22%23e11%22/%3E%3C/svg%3E";
    g("am-pick-btn").click();
    inp.value = "pillen"; inp.dispatchEvent(new Event("input", { bubbles: true }));
    await warte(UHR);
    window.MiraQuickActions.setResults({
      requestId: window.__gefeuert[window.__gefeuert.length - 1].requestId, items: [
      { type: "brand",  id: "L1", name: "MitLogo", logo: pixel },
      { type: "prompt", id: "L2", prompt_text: "MitFlagge", market: "de" },
      { type: "brand",  id: "L3", name: "OhneLogo", logo: "" }
    ]});
    await warte(80);
    for (var pi = 0; pi < 3; pi++) document.querySelectorAll(".am-pick-row")[pi].click();
    await warte(80);
    var pillen = [].map.call(document.querySelectorAll(".am-pick-tag"), function(t){
      var av = t.querySelector("[class*=am-pick-tag-av]");
      var fb = t.querySelector(".am-pick-tag-av-fb");
      var im = t.querySelector(".am-pick-tag-av img");
      return { bild: !!im, fbSichtbar: fb ? getComputedStyle(fb).display !== "none" : null,
               fbText: fb ? fb.textContent.trim() : "",
               bildBreite: im ? Math.round(im.getBoundingClientRect().width) : 0,
               kachel: Math.round(av.getBoundingClientRect().width) };
    });
    pruef("8 mit Logo: KEIN Buchstabe daneben",
      pillen[0] && pillen[0].bild && !pillen[0].fbSichtbar, true,
      "vorher stand neben dem Logo noch ein N");
    pruef("9 mit Flagge: KEIN Marktkuerzel daneben",
      pillen[1] && pillen[1].bild && !pillen[1].fbSichtbar, true,
      "vorher stand neben der Flagge noch ein D");
    pruef("9 das Bild fuellt die Kachel, ist also nicht gequetscht",
      pillen[0] && pillen[0].bildBreite === pillen[0].kachel, true,
      pillen[0] ? pillen[0].bildBreite + " in " + pillen[0].kachel : "?");
    pruef("GEGENPROBE ohne Logo ist der Buchstabe DA",
      pillen[2] && !pillen[2].bild && pillen[2].fbSichtbar && pillen[2].fbText === "O", true,
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
