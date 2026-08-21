(function(){
  if (window.__tcdSpyAn) return "Spion laeuft schon. Fehler ausloesen, dann __tcdWas()";
  window.__tcdSpyAn = 1; window.__tcdSpy = [];
  window.__tcdDom = function(){
    var r = document.querySelector(".tcd-root:not(.up-portal)"); if (!r) return "keine .tcd-root";
    return { instance: r.getAttribute("data-instance"),
             modus: ((r.querySelector(".tcd-mode-btn.is-active")||{}).textContent||"").trim(),
             zeilen_gesamt: r.querySelectorAll(".tct-row").length,
             davon_skelett: r.querySelectorAll(".tct-row .up-tsk-bar").length ? "JA" : "nein",
             leertext: ((r.querySelector(".up-empty-mini")||{}).textContent||null),
             processing: r.getAttribute("data-processing") };
  };
  ["renderTopCitations","setTopCitationsLoading","resetTopCitations"].forEach(function(n){
    var o = window[n];
    if (typeof o !== "function") return;
    window[n] = function(){
      var p = arguments[0], e = { t: Math.round(performance.now()), fn: n, vorher: window.__tcdDom() };
      try {
        if (p && typeof p === "object"){
          e.instanceId = p.instanceId; e.keys = Object.keys(p).join(",");
          if ("mode" in p) e.mode_im_payload = p.mode;
          ["top_urls","top_domains","types_breakdown","url_types_breakdown"].forEach(function(k){
            if (k in p) e[k] = Array.isArray(p[k]) ? "array:" + p[k].length
                             : typeof p[k] === "string" ? "TEXT(" + p[k].length + " Zeichen): " + p[k].slice(0,60)
                             : String(p[k]);
          });
        } else { e.argumente = [].map.call(arguments, String).join(" | "); }
      } catch(err){ e.spionFehler = String(err); }
      window.__tcdSpy.push(e);
      var r;
      try { r = o.apply(this, arguments); }
      catch(err){ e.WURF = String(err); throw err; }
      setTimeout(function(){ e.danach = window.__tcdDom(); }, 80);
      return r;
    };
  });
  window.__tcdWas = function(){
    var s = [].filter.call(document.scripts, function(x){ return /topcitations-dashboard\.js/.test(x.src||""); })[0];
    return (s ? fetch(s.src).then(function(x){ return x.text(); }).then(function(t){
              return { url: s.src, fix_drin: t.indexOf("halbePost") >= 0, bytes: t.length };
            }).catch(function(e){ return { url: s.src, lesefehler: String(e) }; })
            : Promise.resolve("kein <script src> mit topcitations-dashboard.js gefunden"))
      .then(function(d){
        var txt = JSON.stringify({ datei: d,
          wurzeln_auf_der_seite: [].map.call(document.querySelectorAll(".tcd-root"), function(r){
            return { instance: r.getAttribute("data-instance"), sichtbar: !!r.offsetParent,
                     portal: r.classList.contains("up-portal") }; }),
          jetzt: window.__tcdDom(), aufrufe: window.__tcdSpy }, null, 1);
        console.log(txt); return txt;
      });
  };
  return "Spion an. Jetzt den Fehler ausloesen (Domains -> URLs schalten), dann  __tcdWas()  aufrufen.";
})()
