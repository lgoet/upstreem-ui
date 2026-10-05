/* Diagnose Shopping-Ansicht (05.10.): warum ist #view-shopping / #viewbody-shopping nicht zu sehen?
   In der Konsole der echten Seite einfuegen, Enter. Schaltet einmal auf Shopping und misst. */
(function () {
  function css(el, p) { try { return getComputedStyle(el)[p]; } catch (e) { return "?"; } }
  function name(el) {
    if (!el || !el.tagName) return String(el);
    var c = (el.className && el.className.baseVal == null ? String(el.className) : "").trim().split(/\s+/).slice(0, 3).join(".");
    return el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (c ? "." + c : "");
  }
  function zeile(el) {
    var r = el.getBoundingClientRect();
    return { element: name(el), display: css(el, "display"), sichtbar: css(el, "visibility"), deckkraft: css(el, "opacity"),
             position: css(el, "position"), hoehe: Math.round(r.height), breite: Math.round(r.width),
             inlineStil: (el.getAttribute("style") || "").slice(0, 80), viewOn: el.classList.contains("view-on"),
             vomViewSkriptVersteckt: !!(el.id && el.id.indexOf("view-") === 0 && !el.classList.contains("view-on")) };
  }
  var befund = [];
  var mitId = document.querySelectorAll('[id="view-shopping"]');
  var aehnlich = [].slice.call(document.querySelectorAll('[id*="shopping" i]')).map(function (e) { return name(e) + (e.classList.contains("view-on") ? " (view-on)" : ""); });
  if (!mitId.length) befund.push("KEIN Element mit id \"view-shopping\". Das Reusable (bzw. die Gruppe) der Ansicht braucht genau diese ID, klein geschrieben. Gefunden mit \"shopping\" in der id: " + (aehnlich.join(", ") || "nichts"));
  if (mitId.length > 1) befund.push("id \"view-shopping\" steht " + mitId.length + "x im Dokument: " + [].map.call(mitId, name).join(" | ") + ". Nur das AEUSSERE Element (Reusable) bekommt view-shopping, die Gruppe darin viewbody-shopping. Das View-Skript schaltet nur das erste, das zweite bleibt versteckt.");
  var roots = [].slice.call(document.querySelectorAll(".ush-root"));
  if (!roots.length) befund.push("Kein Shopping-Element (.ush-root) im Dokument: das HTML-Element aus shopping_bubble.html fehlt oder liegt in einer Gruppe, die Bubble gar nicht aufbaut.");
  if (typeof window.showView !== "function") befund.push("window.showView fehlt: das View-Skript im Seitenkopf laeuft nicht.");
  var vorher = location.search;
  try { if (typeof window.showView === "function") window.showView("shopping"); } catch (e) { befund.push("showView warf: " + e.message); }
  setTimeout(function () {
    var view = document.getElementById("view-shopping");
    var kette = [];
    var root = roots[0];
    if (root) {
      for (var el = root; el && el !== document.body; el = el.parentElement) kette.push(zeile(el));
      if (view && !view.contains(root)) befund.push("Das Shopping-Element liegt NICHT in #view-shopping (" + name(view) + "). Es muss im Reusable/der Gruppe der Ansicht stehen.");
      /* Nur die URSACHE nennen, nicht ihre Folgen: ein verstecktes Kind macht die Eltern 0 hoch,
         ein ausgeblendeter Elternteil die Kinder. Reihenfolge der Schwere, je die aeusserste Stelle. */
      var aussenNachInnen = kette.slice().reverse();
      function erstes(f) { for (var k = 0; k < aussenNachInnen.length; k++) if (f(aussenNachInnen[k])) return aussenNachInnen[k]; return null; }
      var z;
      if ((z = erstes(function (x) { return x.vomViewSkriptVersteckt; })))
        befund.push(z.element + ": id beginnt mit \"view-\", traegt aber kein view-on -- das View-Skript haelt es versteckt (fixed, Deckkraft 0). Diese id umbenennen (z.B. viewbody-shopping) oder entfernen.");
      else if ((z = erstes(function (x) { return x.display === "none"; })))
        befund.push(z.element + " hat display:none" + (z.inlineStil ? " (Inline-Stil: " + z.inlineStil + ")" : "") + " -- in Bubble ist \"This element is visible on page load\" aus oder eine Bedingung blendet es aus.");
      else if ((z = erstes(function (x) { return x.sichtbar === "hidden"; })))
        befund.push(z.element + " hat visibility:hidden -- Bubble-Bedingung/Sichtbarkeit pruefen.");
      else if ((z = erstes(function (x) { return Number(x.deckkraft) === 0; })))
        befund.push(z.element + " hat Deckkraft 0.");
      else {
        /* 0 hoch: die INNERSTE Stelle, deren Kind noch Hoehe hat -- dort wird abgeschnitten. */
        for (var k = 0; k < kette.length - 1; k++) {
          if (kette[k].hoehe > 0 && kette[k + 1].hoehe === 0) { befund.push(kette[k + 1].element + " ist 0 hoch, sein Inhalt " + kette[k].hoehe + "px -- in Bubble \"Fit height to content\" bzw. Hoehe/Container-Layout dieses Elements pruefen."); break; }
        }
      }
      if (!root.__ushController) befund.push("Das Shopping-Element ist da, aber shopping.js hat es nicht gestartet (kein Controller): Vorlade-Snippet mit shopping in welle2 und Pin pruefen, Konsole auf Fehler.");
    }
    if (!befund.length) befund.push("Nichts gefunden: #view-shopping ist an und sichtbar. Dann bitte die Tabelle unten schicken.");
    console.log("URL vorher " + vorher + " -> nachher " + location.search + ", view-shopping an: " + !!(view && view.classList.contains("view-on")));
    console.log("BEFUND:\n- " + befund.join("\n- "));
    if (kette.length && console.table) console.table(kette);
    var ev = document.getElementById("view-events");
    if (ev) console.log("Zum Vergleich view-events: " + JSON.stringify(zeile(ev)));
    window.__shopDiagnose = { befund: befund, kette: kette };
  }, 400);
  return "laeuft, Ergebnis in 0,4 s";
})();
