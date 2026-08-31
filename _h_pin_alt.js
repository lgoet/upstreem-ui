
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
  function readPin(cls){
    var els = document.getElementsByClassName(cls), i, p;
    for (i = 0; i < els.length; i++){
      p = (els[i].getAttribute("data-cdn-pin") || "").trim();
      /* Gespaltener Platzhalter: wer "CDN_PIN" global im Element ersetzt, wuerde sonst auch
         diesen Waechter treffen, und der Loader liefe dauerhaft auf @main. */
      if (p && p !== "CDN_" + "PIN") return p;
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
