(function () {
  var r = document.querySelector(".uob-root");
  if (!r) { console.log("KEIN .uob-root auf der Seite"); return; }
  var pin = r.getAttribute("data-cdn-pin") || "(kein data-cdn-pin)";
  var src = "";
  [].forEach.call(document.querySelectorAll("script[src]"), function (s) {
    if (s.src.indexOf("onboarding-page.js") >= 0) src = s.src;
  });

  function feld(sel) { var e = r.querySelector(sel); return e ? (e.textContent || "").trim() : null; }
  var dom = {
    bereich:        (r.querySelector(".uob-pane:not(.is-off)") || {}).dataset
                      ? r.querySelector(".uob-pane:not(.is-off)").getAttribute("data-pane") : null,
    marke:          feld(".uob-load-name"),
    DOMAIN:         feld(".uob-load-dom"),
    zeitkasten_da:  !!r.querySelector(".uob-res-meta"),
    zeilen_neu:     [].map.call(r.querySelectorAll(".uob-res-row"), function (x) { return (x.textContent || "").trim(); }),
    zeilen_alt_dl:  [].map.call(r.querySelectorAll(".uob-res-meta > div"), function (x) { return (x.textContent || "").trim(); })
  };

  console.log("== TOR ==================================================");
  console.log("pin am Element:", pin);
  console.log("geladene Datei:", src || "(inline, kein src)");
  console.table(dom);
  console.log("Wenn DOMAIN null ist: das Projekt war beim Zeichnen nicht da.");
  console.log("Wenn DOMAIN gefuellt und zeitkasten_da false: das Projekt kam OHNE Datumsfelder.");

  if (src) {
    fetch(src, { cache: "no-store" }).then(function (x) { return x.text(); }).then(function (t) {
      console.log("== DATEI ================================================");
      console.table({
        bytes: t.length,
        hat_ersteZeit:   t.indexOf("function ersteZeit") >= 0,
        hat_res_row:     t.indexOf("uob-res-row") >= 0,
        hat_viewResume:  t.indexOf("function viewResume") >= 0,
        hat_dayKey_fix:  t.indexOf("var day = dayKey(p.day)") >= 0,
        hat_planKnopf:   t.indexOf("function planKnopfText") >= 0
      });
      console.log("Alles false/alt = der Pin ist aelter als der Fix.");
    });
  }

  var name = "setOnboardingBundle";
  if (typeof window[name] === "function" && !window.__uobSpion) {
    var echt = window[name];
    window.__uobSpion = true;
    window[name] = function (id, payload) {
      try {
        var t = String(payload == null ? "" : payload);
        var o = null;
        try { o = JSON.parse(t); } catch (e) {}
        if (o && Array.isArray(o)) o = o[0];
        var pr = o && o.project;
        console.log("== PAYLOAD am Setter ====================================");
        console.log("Laenge:", t.length, "| Schluessel:", o ? Object.keys(o).join(", ") : "(nicht als JSON lesbar)");
        console.log("project-Schluessel:", pr ? Object.keys(pr).join(", ") : "(kein project)");
        console.log("alles mit 'creat'/'updat'/'date'/'time':",
          pr ? Object.keys(pr).filter(function (k) { return /creat|updat|date|time|_at$/i.test(k); })
                 .map(function (k) { return k + "=" + pr[k]; }).join(" | ") || "(NICHTS)" : "-");
      } catch (e) { console.log("Spion-Fehler:", e && e.message); }
      return echt.apply(this, arguments);
    };
    console.log("== SPION AKTIV ==========================================");
    console.log("Jetzt etwas anklicken, das deinen Refresh-Workflow ausloest (ein Topic, ein Prompt).");
    console.log("Beim naechsten setOnboardingBundle steht hier, was WIRKLICH ankommt.");
  }
})();
