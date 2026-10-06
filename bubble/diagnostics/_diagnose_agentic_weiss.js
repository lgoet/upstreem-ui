/* Diagnose 06.10.: Wo kommt die weisse Flaeche beim Wechsel ins Agentic Dashboard her?
   Gemeldet: "wenn man auf Agent Dashboard wechselt, gibt es einen spuerbaren Delay, wo erst nur
   weisser Screen gezeigt wird, bevor der Content kommt".
   Die Dateien sind es nicht (power-dashboard.js steht im Vorrats-Schnipsel und ist laengst
   geladen), und die Komponente blendet nichts ein (kein opacity 0, keine Animation). Offen ist,
   WELCHES Glied wartet:
     A) Bubble blendet die Gruppe "Power" spaet ein (der dphMode-Workflow setzt dash_mode erst nach
        einem anderen Schritt, z.B. einem RPC) -- erkennbar: "Gruppe sichtbar" kommt spaet,
        .upw-root war schon die ganze Zeit im DOM.
     B) Bubble baut den Inhalt der Gruppe erst beim Einblenden -- erkennbar: ".upw-root im DOM"
        kommt erst NACH "Gruppe sichtbar", dazwischen ist es weiss.
     C) Die Ansicht selbst (view-dashboard) steht noch auf unsichtbar (view-on/Ueberblendung).
     D) Der Main-Thread ist blockiert (BLOCKIERT-Zeilen in der weissen Zeit).
   Zu benutzen: Konsole oeffnen, einfuegen, dann GENAU SO wechseln, wie es weiss wird (Umschalter
   "Agentic" im Dashboard-Kopf, oder ueber die Leiste ins Dashboard). Nach 4 Sekunden steht EIN
   Textblock in der Konsole -- den komplett kopieren. Die Diagnose bleibt scharf fuer weitere
   Wechsel. Veraendert nichts, schaut nur zu. */
(function () {
  if (window.__upAgDiag) { console.log("[agentic-diag] laeuft bereits -- einfach wechseln"); return; }
  window.__upAgDiag = true;
  var LAUF = null, LT = [];
  try { new PerformanceObserver(function (l) {
    l.getEntries().forEach(function (e) { LT.push({ at: e.startTime, ms: Math.round(e.duration) }); });
  }).observe({ entryTypes: ["longtask"] }); } catch (e) {}

  function jetzt() { return LAUF ? Math.round(performance.now() - LAUF.t0) : 0; }
  function ev(s) { if (LAUF) LAUF.ev.push({ t: jetzt(), s: s }); }
  function kurz(el) {
    if (!el) return "-";
    var c = String(el.className && el.className.baseVal != null ? el.className.baseVal : el.className || "");
    var id = el.id ? "#" + el.id : "";
    return el.tagName.toLowerCase() + id + (c ? "." + c.trim().split(/\s+/).slice(0, 3).join(".") : "");
  }
  function sichtbar(el) {
    if (!el || !el.isConnected) return false;
    try { if (el.checkVisibility) return el.checkVisibility({ opacityProperty: true, visibilityProperty: true }) && el.getBoundingClientRect().height > 0; } catch (e) {}
    return el.offsetParent !== null && el.offsetHeight > 0;
  }
  function gruppeVon(el) {
    for (var p = el && el.parentElement; p; p = p.parentElement) if (/\bGroup\b|\bCustomElement\b/.test(String(p.className || ""))) return p;
    return null;
  }
  /* Was sieht man auf der Inhaltsflaeche? Neun Punkte (3x3) im sichtbaren Teil von #main; ein
     Punkt in einer .up-root ist Inhalt -- ausser dem Seitenkopf (.dph-root) und der Leiste, die
     stehen auch waehrend der weissen Zeit da. Ein einzelner Punkt in der Mitte war zu wenig: bei
     kurzem Inhalt traf er die leere Flaeche darunter und meldete "leer", obwohl alles stand. */
  function mitte() {
    var m = document.getElementById("main") || document.body, r = m.getBoundingClientRect();
    var oben = Math.max(r.top, 0), unten = Math.min(r.bottom, innerHeight), treffer = 0, erstes = null, leer = null;
    [0.3, 0.5, 0.7].forEach(function (fy) { [0.3, 0.5, 0.7].forEach(function (fx) {
      var el = document.elementFromPoint(Math.round(r.left + r.width * fx), Math.round(oben + (unten - oben) * fy));
      var w = el && el.closest ? el.closest(".up-root:not(.dph-root):not(.usn-root)") : null;
      if (w && !(el.closest && el.closest(".dph-root"))) { treffer++; if (!erstes) erstes = w; } else if (!leer) leer = el;
    }); });
    return treffer ? "INHALT " + treffer + "/9 " + kurz(erstes).split(".").slice(0, 3).join(".") : "LEER 0/9 " + kurz(leer);
  }
  function stand() {
    var upw = document.getElementsByClassName("upw-root"), w = upw[0] || null, g = gruppeVon(w);
    var v = document.getElementById("view-dashboard");
    return {
      ansicht: v ? (sichtbar(v) ? "sichtbar" : "unsichtbar") + (v.classList.contains("view-on") ? "+view-on" : "") + " op=" + getComputedStyle(v).opacity : "fehlt",
      upwImDom: upw.length,
      upwSichtbar: sichtbar(w),
      gruppe: g ? (sichtbar(g) ? "sichtbar" : "unsichtbar") + " (" + kurz(g) + ", display=" + getComputedStyle(g).display + ", op=" + getComputedStyle(g).opacity + ")" : "-",
      inhalt: !w ? "-" : (w.childElementCount === 0 ? "leer" : (w.querySelector(".upw-sk, .up-tsk") ? "Skelett" : "Daten")),
      mitte: mitte()
    };
  }

  /* Setter und Meldungen mitschreiben, ohne sie zu veraendern. */
  function mitschreiben(n) {
    var orig = window[n];
    if (typeof orig !== "function" || orig.__agDiag) return;
    var f = function () { var a = arguments[1]; ev("JS: " + n + "(" + (a == null ? "" : typeof a === "object" ? "{...}" : String(a).slice(0, 12)) + ")"); return orig.apply(this, arguments); };
    f.__agDiag = 1; window[n] = f;
  }
  ["renderPowerDashboard", "setPowerDashboardLoading", "resetPowerDashboard", "showView", "fadeView"].forEach(mitschreiben);
  var kopf = document.querySelector(".dph-root"), modeFn = kopf && kopf.getAttribute("data-mode-fn");
  if (modeFn) mitschreiben(modeFn);

  function start(anlass) {
    if (LAUF) { ev("weiterer Ausloeser: " + anlass); return; }
    LAUF = { t0: performance.now(), ev: [], ltAb: LT.length, alt: "", resAb: performance.getEntriesByType("resource").length };
    ev("START " + anlass);
    var mo = new MutationObserver(function (l) {
      for (var i = 0; i < l.length; i++) for (var j = 0; j < l[i].addedNodes.length; j++) {
        var n = l[i].addedNodes[j];
        if (n.nodeType === 1 && (n.classList.contains("upw-root") || (n.querySelector && n.querySelector(".upw-root")))) ev(".upw-root neu ins DOM eingefuegt");
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });
    (function bild() {
      if (!LAUF) return;
      var s = stand(), sig = JSON.stringify(s);
      if (sig !== LAUF.alt) { LAUF.alt = sig; ev("Ansicht " + s.ansicht + " | Gruppe " + s.gruppe + " | upw im DOM " + s.upwImDom + ", sichtbar " + s.upwSichtbar + ", " + s.inhalt + " | Mitte: " + s.mitte); }
      if (performance.now() - LAUF.t0 < 4000) requestAnimationFrame(bild);
    })();
    /* rAF steht in einem verdeckten Tab -- dann wenigstens alle 50ms nachsehen. */
    var uhr = setInterval(function () { if (!LAUF) { clearInterval(uhr); return; }
      var s = stand(), sig = JSON.stringify(s);
      if (sig !== LAUF.alt) { LAUF.alt = sig; ev("(Uhr) Ansicht " + s.ansicht + " | Gruppe " + s.gruppe + " | upw " + s.upwImDom + "/" + s.upwSichtbar + "/" + s.inhalt + " | Mitte: " + s.mitte); }
    }, 50);
    setTimeout(function () { mo.disconnect(); clearInterval(uhr); bericht(); }, 4000);
  }

  function bericht() {
    var r = LAUF; LAUF = null;
    if (!r) return;
    var zeilen = r.ev.slice();
    LT.slice(r.ltAb).forEach(function (x) { var t = Math.round(x.at - r.t0); if (t > -200) zeilen.push({ t: t, s: "BLOCKIERT " + x.ms + "ms" }); });
    performance.getEntriesByType("resource").slice(r.resAb).forEach(function (e) {
      var t = Math.round(e.startTime - r.t0);
      zeilen.push({ t: t, s: "Netz " + Math.round(e.duration) + "ms: " + String(e.name).replace(/^https?:\/\/[^/]+/, "").slice(0, 90) });
    });
    zeilen.sort(function (a, b) { return a.t - b.t; });
    /* Die weisse Zeit: vom Start bis zum ersten Bild, in dem die Mitte Inhalt zeigt. */
    var leerAb = null, leerBis = null;
    r.ev.forEach(function (e) {
      if (/Mitte: LEER/.test(e.s) && leerAb == null) leerAb = e.t;
      if (/Mitte: INHALT/.test(e.s) && leerAb != null && leerBis == null) leerBis = e.t;
    });
    var aus = ["[agentic-diag] Pin " + (window.__upPin || "?") + ", Build " + ((window.UpstreemCore && window.UpstreemCore.BUILD) || "?"),
      "Leere Flaeche: " + (leerAb == null ? "nie" : "+" + leerAb + "ms bis " + (leerBis == null ? "Ende (>4s)" : "+" + leerBis + "ms")),
      "Zeitleiste:"];
    zeilen.forEach(function (z) { aus.push("  " + (z.t >= 0 ? "+" : "") + z.t + "ms  " + z.s); });
    console.log(aus.join("\n"));
  }

  document.addEventListener("click", function (e) {
    var t = e.target && e.target.closest ? e.target : null;
    if (!t) return;
    var mb = t.closest(".dph-modebtn");
    if (mb) { start("Klick Umschalter " + mb.getAttribute("data-dph-mode")); return; }
    var leiste = t.closest(".usn-root, [class*='usn-']");
    if (leiste) start("Klick Leiste: " + String(t.textContent || "").trim().slice(0, 30));
  }, true);
  ["pushState", "replaceState"].forEach(function (m) {
    var o = history[m];
    history[m] = function () { var r = o.apply(this, arguments); if (LAUF) ev(m + " " + location.search); return r; };
  });
  console.log("[agentic-diag] aktiv -- jetzt ins Agentic Dashboard wechseln (Umschalter oder Leiste).");
})();
