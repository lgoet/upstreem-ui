/* upstreem landing-boot.js — der Lader der Hero-Sektion.

   WARUM diese Datei ueberhaupt existiert: die Liste der Dateien darf NICHT im Framer-Schnipsel
   stehen. Genau daran ist es einmal gescheitert -- Quick Actions kam dazu, das Schnipsel bekam zwei
   neue Zeilen, in Framer wurde aber nur der Pin getauscht. Ergebnis: das Markup der Palette war da
   (es steckt in landing-hero.js), ihre CSS nicht. Eine Palette ohne Formatierung, und von aussen
   sah es wie ein kaputter Pin aus.

   Jetzt traegt das Schnipsel nur noch die Wurzel und den Pin. Alles andere steht hier, und diese
   Datei kommt aus demselben Pin. Eine neue Komponente im Fenster heisst ab jetzt: eine Zeile HIER,
   neuer Pin in Framer -- und nie wieder ein neues Einsetzen von Hand.

   Der Pin kommt aus der eigenen Adresse (document.currentScript.src) und nicht aus dem Attribut:
   diese Datei ist ja schon vom Pin geladen worden, also steht er dort garantiert richtig. Das
   Attribut bleibt der Rueckfall, falls currentScript fehlt. */
(function(){
  "use strict";

  function basisAusEigenerAdresse(){
    var s = document.currentScript;
    var src = (s && s.src) || "";
    var i = src.lastIndexOf("/");
    return i > 0 ? src.slice(0, i + 1) : "";
  }

  function basisAusAttribut(){
    var el = document.querySelector(".ulh-root");
    var v = el && el.getAttribute("data-cdn-pin");
    var pin = (!v || v === "CDN_PIN") ? "main" : v;
    return "https://cdn.jsdelivr.net/gh/lgoet/upstreem-ui@" + pin + "/";
  }

  var base = basisAusEigenerAdresse() || basisAusAttribut();

  /* Einmal pro Dateiname, nicht pro URL -- dieselbe Buchfuehrung wie in den Bubble-Ladern. Auf der
     Landingpage gibt es zwar nur eine Sektion, aber Framer baut ein Embed bei jeder Navigation neu
     ein, und ohne die Sperre haengen nach ein paar Seitenwechseln vierzehn Kopien im Kopf. */
  var L = window.__upAssetsLoaded || (window.__upAssetsLoaded = {});
  function once(url, make){
    var name = url.slice(url.lastIndexOf("/") + 1);
    if (L[name]) return;
    L[name] = url; make(url);
  }
  function css(f){
    once(base + f, function(u){
      var l = document.createElement("link"); l.rel = "stylesheet"; l.href = u;
      document.head.appendChild(l);
    });
  }
  /* async = false ist PFLICHT und keine Feinheit: ein per createElement eingehaengtes Skript laeuft
     sonst, sobald es da ist, und dann kann visibility-chart.js vor core.js starten und findet
     window.UpstreemCore nicht. Mit async = false halten die Skripte ihre Reihenfolge. */
  function js(f){
    once(base + f, function(u){
      var s = document.createElement("script"); s.src = u; s.async = false;
      document.head.appendChild(s);
    });
  }

  /* Die Komponenten, die im Fenster stehen. Wer eine hinzufuegt, aendert NUR diese zwei Bloecke
     und das Markup in .landing_markup.py -- in Framer bleibt es beim Pin. */
  css("core.css");
  css("sidebar.css");
  css("page-headers/dashboard-page-header.css");
  css("visibility-chart.css");
  css("topcitations-dashboard.css");
  css("quick-actions.css");
  css("ask-mira.css");
  css("page-headers/prompts-page-header.css");
  css("prompts-table.css");
  css("opportunities.css");
  css("landing-hero.css");

  js("core.js");
  js("sidebar.js");
  js("page-headers/dashboard-page-header.js");
  js("visibility-chart.js");
  js("topcitations-dashboard.js");
  js("quick-actions.js");
  js("ask-mira.js");
  js("page-headers/prompts-page-header.js");
  js("prompts-table.js");
  js("page-headers/opportunities-page-header.js");
  js("opportunities.js");
  /* Zuletzt: diese Datei ruft die Setter der anderen. */
  js("landing-hero.js");
})();
