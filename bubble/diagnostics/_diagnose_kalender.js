/* upstreem -- Kalender-Diagnose (01.10.). In die Konsole der echten Seite einfuegen.
   Sammelt ALLE Namen, die fuer den Kalender zusammenpassen muessen, und prueft sie gegeneinander:
     Ansichten       #view-<name>, offen (view-on), bubble_fn_view_first_<name>, Boot-Kanal
     Drawer          bubble_fn_drawer_<art>, welcher Boot-Kanal nach Name bzw. gelernt dazu passt
     Kalender        jede .udr-root: Instanz, Ort (Ansicht / fixierter Behaelter), jedes data-*-fn
                     und ob es als Funktion existiert, abgeleiteter Boot-Kanal, Sichtbarkeit (mit
                     GRUND, wenn nicht: display, visibility, opacity, ausserhalb des Fensters)
     Kanaele         udr_date_boot_*, udr_date_range_*, udr_apply_* -- und zu welchem Kalender
     Zustand         Apply to all, Preset, ?range=, offene Drawer, gelernte Zuordnungen, Spur
   Danach, fuer einen Drawer, der nicht will:
     upstreemKalenderBeobachten()   zeichnet 12 Sekunden lang alle 50ms auf, was sich aendert
                                    (Boot-Kanaele, Kalenderwurzeln und ihre Sichtbarkeit, Spur).
                                    Aufrufen, DANN den Drawer oeffnen. Die Zeitleiste zeigt, ob
                                    der Kalender vor oder erst nach dem Drawer-Workflow entsteht. */
(function () {
  var W = window, D = document;
  function fnDa(n) { try { return typeof W[n] === "function"; } catch (e) { return false; } }
  function wort(t) { return String(t || "").toLowerCase().replace(/[^a-z0-9]/g, ""); }
  function kurz(el) {
    if (!el) return "";
    var s = el.tagName.toLowerCase();
    if (el.id) s += "#" + el.id;
    var k = String(el.className || "").trim().split(/\s+/).filter(Boolean).slice(0, 3);
    if (k.length) s += "." + k.join(".");
    return s;
  }
  /* Sichtbar? Und wenn nicht, WARUM -- der erste Vorfahr, der es verhindert. */
  function sicht(el) {
    for (var x = el, n = 0; x && x.nodeType === 1 && n < 60; x = x.parentElement, n++) {
      var cs = getComputedStyle(x);
      if (cs.display === "none") return "nein: display none an " + kurz(x);
      if (cs.visibility === "hidden") return "nein: visibility hidden an " + kurz(x);
      if (parseFloat(cs.opacity) < 0.05) return "nein: opacity " + cs.opacity + " an " + kurz(x);
    }
    var r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return "nein: 0 gross (" + Math.round(r.width) + "x" + Math.round(r.height) + ")";
    var h = W.innerHeight, w = W.innerWidth;
    if (!(r.bottom > 0 && r.top < h && r.right > 0 && r.left < w))
      return "nein: ausserhalb des Fensters (" + Math.round(r.left) + "," + Math.round(r.top) + ")";
    var geparkt = el.closest && el.closest('[id^="view-"]:not(.view-on)');
    if (geparkt) return "nein: geparkte Ansicht " + geparkt.id;
    return "ja";
  }
  function fixierterBehaelter(el) {
    for (var x = el.parentElement; x && x !== D.body; x = x.parentElement) {
      if (getComputedStyle(x).position === "fixed") return kurz(x);
    }
    return "";
  }
  function fns(p) {
    return Object.keys(W).filter(function (k) { return k.indexOf(p) === 0 && fnDa(k); })
      .map(function (k) { return k.slice(p.length); });
  }
  function aufnahme() {
    var BOOT = fns("bubble_fn_udr_date_boot_"), RANGE = fns("bubble_fn_udr_date_range_"),
        APPLY = fns("bubble_fn_udr_apply_"), DRAWER = fns("bubble_fn_drawer_"), VFIRST = fns("bubble_fn_view_first_");
    var views = [].map.call(D.querySelectorAll('[id^="view-"]'), function (v) {
      return { name: v.id.slice(5), offen: v.classList.contains("view-on") };
    });
    var wurzeln = [].slice.call(D.querySelectorAll(".udr-root, [data-udr-root]"));
    var kal = wurzeln.map(function (w) {
      var inst = String(w.getAttribute("data-instance") || "");
      var endung = inst.replace(/^dates_v2_/, "");
      var box = w.closest && w.closest('[id^="view-"]');
      var fn = {};
      [].forEach.call(w.attributes, function (a) {
        if (/^data-.*-fn$/.test(a.name)) fn[a.name] = a.value + (fnDa(a.value) ? " (da)" : " (FEHLT)");
      });
      var bootName = w.getAttribute("data-boot-fn") || ("bubble_fn_udr_date_boot_" + endung);
      var c = w.__udrCtrl, preset = "";
      try { preset = c && c.getRange ? c.getRange().preset : ""; } catch (e) {}
      return { instanz: inst, ort: box ? "Ansicht " + box.id.slice(5) : ("fixiert in " + (fixierterBehaelter(w) || "-")),
               boot: bootName + (fnDa(bootName) ? " (da)" : " (FEHLT)"), fn: fn, gemountet: !!c,
               preset: preset, sichtbar: sicht(w) };
    });
    var gelernt = W.__udrDrawerKanal || (function () {
      try { return JSON.parse(localStorage.getItem("udr_drawer_kanal_2") || "{}"); } catch (e) { return {}; }
    })();
    return { BOOT: BOOT, RANGE: RANGE, APPLY: APPLY, DRAWER: DRAWER, VFIRST: VFIRST, views: views, kal: kal, wurzeln: wurzeln, gelernt: gelernt };
  }
  var A = aufnahme(), P = [];
  /* Doppelte Instanzen und doppelt belegte Boot-Kanaele */
  var zahl = {};
  A.kal.forEach(function (k) { zahl[k.instanz] = (zahl[k.instanz] || 0) + 1; });
  Object.keys(zahl).forEach(function (i) { if (zahl[i] > 1) P.push("Kalender-Instanz " + i + " steht " + zahl[i] + "x im Dokument"); });
  /* Jeder Boot-Kanal braucht einen Kalender mit dieser Endung */
  A.BOOT.forEach(function (b) {
    var hat = A.kal.some(function (k) { return k.instanz.replace(/^dates_v2_/, "") === b; });
    if (!hat) P.push("Boot-Kanal udr_date_boot_" + b + " ohne Kalender dates_v2_" + b + " im Dokument");
  });
  /* Jeder Kalender (ausser Export) braucht seinen Boot-Kanal */
  A.kal.forEach(function (k) {
    if (/export/i.test(k.instanz)) return;
    if (/FEHLT/.test(k.boot)) P.push("Kalender " + k.instanz + ": Boot-Kanal fehlt (" + k.boot + ")");
    Object.keys(k.fn).forEach(function (a) { if (/FEHLT/.test(k.fn[a])) P.push("Kalender " + k.instanz + ": " + a + " = " + k.fn[a]); });
  });
  /* Jede Ansicht: view_first und Boot-Kanal. Eine Ansicht ohne einen einzigen Kalender im
     Dokument ist noch nie geoeffnet worden -- Bubble baut sie erst dann, das ist kein Fehler. */
  var nieGeoeffnet = [];
  A.views.forEach(function (v) {
    var box = D.getElementById("view-" + v.name);
    if (box && !box.querySelector(".udr-root, [data-udr-root]")) { nieGeoeffnet.push(v.name); return; }
    if (!fnDa("bubble_fn_view_first_" + v.name)) P.push("Ansicht " + v.name + ": bubble_fn_view_first_" + v.name + " fehlt");
    if (!fnDa("bubble_fn_udr_date_boot_" + v.name)) P.push("Ansicht " + v.name + ": bubble_fn_udr_date_boot_" + v.name + " fehlt");
  });
  /* Jeder Drawer: welcher Kalender gehoert dazu -- nach Name, sonst gelernt */
  var drawerZeilen = A.DRAWER.map(function (art) {
    var w = wort(art);
    var nachName = A.BOOT.filter(function (b) { return wort(b).indexOf(w) >= 0 && !D.getElementById("view-" + b); });
    var g = A.gelernt[art];
    var weg = nachName.length ? "nach Name: udr_date_boot_" + nachName.join(", udr_date_boot_")
            : (g ? "gelernt: " + g + (fnDa(g) ? " (da)" : " (FEHLT jetzt)")
            : (g === "" ? "gelernt: KEIN Kalender" : "KEINER -- weder Name noch gelernt"));
    return { drawer: art, kalender: weg };
  });
  var UC = W.UpstreemCore, pref = function (k) { try { return UC && UC.getPref ? UC.getPref(k) : "?"; } catch (e) { return "?"; } };
  console.log("%cKalender-Diagnose", "font-weight:bold;font-size:14px");
  console.log("core BUILD " + (UC && UC.BUILD) + " | Apply to all: " + pref("date_sync") + " | Preset: " + pref("date_preset") +
    " | ?range=" + (new URLSearchParams(location.search).get("range") || "-") +
    " | offene Drawer: " + (UC && UC.openDrawers ? JSON.stringify(UC.openDrawers()) : "?"));
  console.log("Ansichten:"); console.table(A.views);
  console.log("Kalender:"); console.table(A.kal.map(function (k) {
    return { instanz: k.instanz, ort: k.ort, boot: k.boot, gemountet: k.gemountet, preset: k.preset, sichtbar: k.sichtbar,
             "range-fn": k.fn["data-range-fn"] || "-", "apply-fn": k.fn["data-range-apply-fn"] || "-" };
  }));
  console.log("Drawer -> Kalender:"); console.table(drawerZeilen);
  console.log("Kanaele: boot " + JSON.stringify(A.BOOT) + "\n         range " + JSON.stringify(A.RANGE) +
    "\n         apply " + JSON.stringify(A.APPLY) + "\n         view_first " + JSON.stringify(A.VFIRST));
  console.log("Gelernt (udr_drawer_kanal_2): " + JSON.stringify(A.gelernt));
  if (nieGeoeffnet.length) console.log("Noch nie geoeffnet (ohne Kalender, normal): " + nieGeoeffnet.join(", "));
  console.log(P.length ? "%cAUFFAELLIG (" + P.length + "):\n  " + P.join("\n  ") : "%cNichts auffaellig.", "color:" + (P.length ? "#b0200c" : "#2ea84a"));
  if (W.upstreemDatesDrawerSpur) console.log("Spur:\n" + W.upstreemDatesDrawerSpur().join("\n"));

  /* ---- Die Zeitleiste eines Oeffnens -------------------------------------------------------- */
  W.upstreemKalenderBeobachten = function (ms) {
    ms = ms || 12000;
    var t0 = performance.now(), zeilen = [], vorher = {}, spurLaenge = W.upstreemDatesDrawerSpur ? W.upstreemDatesDrawerSpur().length : 0;
    function stand() {
      var o = {};
      fns("bubble_fn_udr_date_boot_").forEach(function (b) { o["boot " + b] = "da"; });
      [].forEach.call(D.querySelectorAll(".udr-root, [data-udr-root]"), function (w) {
        o["kalender " + (w.getAttribute("data-instance") || "?")] = sicht(w);
      });
      if (UC && UC.openDrawers) o["offene Drawer"] = JSON.stringify(UC.openDrawers());
      return o;
    }
    vorher = stand();
    console.log("Beobachte " + (ms / 1000) + "s -- jetzt den Drawer oeffnen.");
    (function tick() {
      var t = Math.round(performance.now() - t0), jetzt = stand(), k;
      for (k in jetzt) if (vorher[k] !== jetzt[k]) zeilen.push(t + "ms  " + k + ": " + (vorher[k] || "(neu)") + " -> " + jetzt[k]);
      for (k in vorher) if (!(k in jetzt)) zeilen.push(t + "ms  " + k + ": weg");
      if (W.upstreemDatesDrawerSpur) {
        var sp = W.upstreemDatesDrawerSpur();
        for (var i = spurLaenge; i < sp.length; i++) zeilen.push(t + "ms  SPUR " + sp[i].replace(/^\S+\s+/, ""));
        spurLaenge = sp.length;
      }
      vorher = jetzt;
      if (t >= ms) {
        console.log("%cZeitleiste", "font-weight:bold");
        console.log(zeilen.length ? zeilen.join("\n") : "(nichts geaendert)");
        return;
      }
      setTimeout(tick, 50);
    })();
    return "laeuft";
  };
  console.log("Fuer einen Drawer, der nicht will: upstreemKalenderBeobachten() aufrufen, dann den Drawer oeffnen.");
})();
