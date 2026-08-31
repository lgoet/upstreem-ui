
(function(){
  /* ---- Boot-Stubs, VOR dem Nachladen ------------------------------------------------------
     Bubble ruft die Setter im Page-Load-Workflow, regelmaessig BEVOR teams.js geladen ist. Die
     Warteschlange in teams.js entsteht erst mit dieser Datei; davor ist window.renderTeams
     undefined, der Run-JS-Schritt laeuft in seinen typeof-Waechter und der Aufruf ist WEG -- die
     Seite steht danach im Skelett, ohne dass irgendwo ein Fehler steht. Gemessen im Harness
     _h_uts_frueh.html: ohne diesen Block 0 Aufrufe in der Queue und 5 Skelettzeilen fuer immer.
     Dieselbe Loesung wie beim Marken-Store in domains_table_bubble.html: hier stubben, teams.js
     erkennt es an __utsBootStubbed und laesst die Namen stehen, makeMount arbeitet die Queue in
     der Reihenfolge ab, in der Bubble gerufen hat.
     Wer das Snippet bubble/page_header_preload.html im Seitenkopf hat, ist doppelt abgesichert --
     dort stehen dieselben drei Namen in UP_API. */
  window.__utsBootQueue = window.__utsBootQueue || [];
  if (!window.__utsBootStubbed){
    window.__utsBootStubbed = true;
    ["renderTeams", "setTeamsLoading", "resetTeams"].forEach(function(n){
      if (typeof window[n] === "function") return;   /* das Snippet im Seitenkopf war schneller */
      window[n] = function(){ window.__utsBootQueue.push([n, [].slice.call(arguments)]); };
    });
  }

  /* Loader nach STYLEGUIDE §26: den Pin ueber getElementsByClassName lesen, NIEMALS ueber
     document.currentScript -- Bubble fuehrt Scripts nicht in DOM-Reihenfolge aus. */
  function echterPin(p){
    /* trim: ein Leerzeichen aus der Bubble-Konstante ergaebe sonst .../upstreem-ui@ abc /core.js,
       jsDelivr antwortet mit 404, und weder CSS noch JS landen. Ohne trim greift auch kein
       Rueckfall, weil "   " truthy ist.
       Gespaltener Platzhalter: wer "CDN_PIN" global im Element ersetzt, wuerde sonst auch diesen
       Waechter treffen, und der Loader liefe dauerhaft auf @main, obwohl ein Pin gesetzt ist. */
    p = String(p == null ? "" : p).trim();
    return (p && p !== "CDN_" + "PIN") ? p : "";
  }
  function readPin(cls){
    var i, p, els = document.getElementsByClassName(cls);
    for (i = 0; i < els.length; i++){
      p = echterPin(els[i].getAttribute("data-cdn-pin"));
      if (p) return (window.__upPin = p);
    }
    /* ---- Rueckfall: einen Pin nehmen, der auf DIESER Seite schon gilt ----------------------
       Gemeldet am 31.08. mit drei Stapelspuren, alle aus einem solchen Loader: "core.css ist
       schon von einem anderen Pin geladen ... ignoriert wird @main" -- obwohl der Pin am Element
       stand. Der Grund ist die Reihenfolge: Bubble baut ein Element bei jedem Rerender neu und
       fuehrt Scripts nicht in DOM-Reihenfolge aus, dieser Loader lief also, waehrend seine eigene
       Wurzel noch nicht im Dokument stand -- die Klasse oben fand nichts.
       Und das war mehr als eine Warnung: core kam durch die Entdoppelung unten noch aus dem Pin,
       die Dateien DIESER Komponente aber tatsaechlich von @main. Eine Seite, die zur Haelfte auf
       @main laeuft, ist genau das, was ein Pin verhindern soll.
       Geraten wird nichts: jede der drei Stufen liest einen Pin, der auf dieser Seite schon in
       Gebrauch ist. */
    if (echterPin(window.__upPin)) return window.__upPin;
    var alle = document.querySelectorAll ? document.querySelectorAll("[data-cdn-pin]") : [];
    for (i = 0; i < alle.length; i++){
      p = echterPin(alle[i].getAttribute("data-cdn-pin"));
      if (p) return (window.__upPin = p);
    }
    /* Aus einer schon geladenen Datei ablesen. Diese Stufe greift auch dann, wenn alle anderen
       Elemente der Seite noch die ALTE Fassung dieses Loaders tragen -- die fuellen
       __upAssetsLoaded genauso. "main" wird NICHT gemerkt: das ist kein Pin, und die naechste
       Komponente wuerde ihn sonst fuer einen halten. */
    var L0 = window.__upAssetsLoaded, k, m;
    for (k in L0){
      if (!Object.prototype.hasOwnProperty.call(L0, k)) continue;
      m = String(L0[k] || "").match(/upstreem-ui@([^/]+)\//);
      if (m && m[1] && m[1] !== "main") return (window.__upPin = m[1]);
    }
    return "main";
  }
  var base = "https://cdn.jsdelivr.net/gh/lgoet/upstreem-ui@" + readPin("uts-root") + "/";
  var L = window.__upAssetsLoaded || (window.__upAssetsLoaded = {});
  function once(url, make){
    var name = url.slice(url.lastIndexOf("/") + 1);
    if (L[name]){
      if (L[name] !== url && window.console) console.warn("upstreem: " + name +
        " ist schon von einem anderen Pin geladen. Geladen bleibt " + L[name] +
        ", ignoriert wird " + url + ". Setzt alle Elemente auf denselben Pin.");
      return;
    }
    L[name] = url; make(url);
  }
  function css(f){ once(base + f, function(u){ var l = document.createElement("link"); l.rel = "stylesheet"; l.href = u; document.head.appendChild(l); }); }
  function js(f){ once(base + f, function(u){ var s = document.createElement("script"); s.src = u; s.async = false; document.head.appendChild(s); }); }

  css("core.css");   js("core.js");
  css("teams.css");  js("teams.js");
})();
