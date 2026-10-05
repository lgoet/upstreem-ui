/* Diagnose 05.10. (3): Warum geht #view-shopping / #view-events beim ersten Leistenklick nicht auf?
   Bekannt: usnNav feuert, showView laeuft, Adresse und view-on stimmen -- aber Bubbles EIGENES
   display:none bleibt am Element. Diese Diagnose entscheidet zwischen zwei Ursachen:
     A) Die Bedingung des Elements liest die ADRESSE ("Get data from page URL: view"). Bubble
        bemerkt eine Adressaenderung per JavaScript nicht -- erst beim Laden oder bei eigener
        Navigation. Erkennbar: nach dem kuenstlichen popstate (Schritt 3) geht das Element auf.
     B) Der usnNav-Workflow setzt den State fuer diesen Schluessel nicht (fehlender Zweig, Bedingung,
        Option Set ohne diesen Wert). Erkennbar: KEIN zweites showView aus dem Workflow, und auch der
        popstate aendert nichts.
   Zu benutzen: Seite NEU laden, auf einer ANDEREN Ansicht (nicht shopping/events), Konsole oeffnen,
   ZIEL unten setzen ("shopping" oder "events"), einfuegen. Am Ende steht EIN Textblock -- den
   komplett kopieren. Veraendert nichts ausser dem Klick und einem popstate-Ereignis. */
(function () {
  var ZIEL = "shopping";
  var zeilen = [];
  function log(s) { zeilen.push(s); }
  function art(el) {
    var c = String((el && el.className) || "");
    if (/\bCustomElement\b/.test(c)) return "Reusable";
    if (/\bGroup\b/.test(c)) return "Group";
    return c.split(/\s+/).slice(0, 2).join(" ") || (el ? el.tagName.toLowerCase() : "-");
  }
  function view(n) {
    var v = document.getElementById("view-" + n);
    if (!v) return n + ": FEHLT";
    var cs = getComputedStyle(v);
    return n + ": art=" + art(v) + " inline=" + (v.style.display || "-") + " display=" + cs.display +
      " visibility=" + cs.visibility + " viewOn=" + v.classList.contains("view-on") +
      " kinder=" + v.childElementCount + " eltern=" + art(v.parentElement) +
      " gleicheIds=" + document.querySelectorAll('[id="view-' + n + '"]').length;
  }
  var namen = [].map.call(document.querySelectorAll('[id^="view-"]'), function (v) { return v.id.slice(5); });
  log("URL vorher: " + location.search);
  log("--- 1. Alle Ansichten vor dem Klick ---");
  namen.forEach(function (n) { log(view(n)); });

  /* Mitschreiben: das Ereignis an Bubble und jedes showView (das erste aus der Leiste, ein zweites
     aus dem usnNav-Workflow -- kommt es, ist der Workflow gelaufen). */
  var leiste = document.querySelector(".usn-root");
  var fnName = leiste && leiste.getAttribute("data-nav-fn");
  var aufrufe = [];
  if (fnName && typeof window[fnName] === "function") {
    var orig = window[fnName];
    window[fnName] = function (v) { aufrufe.push("usnNav(" + String(v) + ")"); return orig.apply(this, arguments); };
    setTimeout(function () { window[fnName] = orig; }, 6000);
  } else aufrufe.push("usnNav-Funktion FEHLT (data-nav-fn=" + fnName + ")");
  var sv = window.showView;
  if (typeof sv === "function") {
    window.showView = function (n) { aufrufe.push("showView(" + n + ") @" + Math.round(performance.now() - t0) + "ms"); return sv.apply(this, arguments); };
    setTimeout(function () { window.showView = sv; }, 6000);
  }
  var item = document.querySelector('.usn-item[data-nav-key="' + ZIEL + '"]');
  if (!item) { console.log("[klick2] kein Leisteneintrag fuer " + ZIEL); return; }
  var t0 = performance.now();
  item.click();
  setTimeout(function () {
    log("--- 2. 2s nach dem Klick ---");
    log("URL: " + location.search);
    log(view(ZIEL));
    log("Aufrufe: " + aufrufe.join(" | "));
    var vz = document.getElementById("view-" + ZIEL);
    if (vz && getComputedStyle(vz).display !== "none") {
      log("ERGEBNIS: geht auf -- Fehler heute nicht nachgestellt.");
      return fertig();
    }
    /* 3. Bubble die Adresse neu lesen lassen. */
    try { window.dispatchEvent(new PopStateEvent("popstate", { state: history.state })); } catch (e) { log("popstate warf: " + e.message); }
    setTimeout(function () {
      log("--- 3. 2s nach popstate ---");
      log(view(ZIEL));
      var auf = vz && getComputedStyle(vz).display !== "none";
      var workflow = aufrufe.filter(function (a) { return a.indexOf("showView(" + ZIEL + ")") === 0; }).length >= 2;
      log("Zweites showView aus dem Workflow: " + (workflow ? "ja" : "NEIN"));
      if (auf) log("ERGEBNIS A: die Bedingung liest die ADRESSE -- auf den State umstellen.");
      else if (!workflow) log("ERGEBNIS B: der usnNav-Workflow ist fuer '" + ZIEL + "' nicht bis zum showView gelaufen (Zweig/Bedingung im Workflow).");
      else log("ERGEBNIS C: Workflow lief, Element bleibt aus -- die Bedingung des Elements selbst pruefen (State-Wert, Option Set).");
      fertig();
    }, 2000);
  }, 2000);
  function fertig() { console.log("[klick2]\n" + zeilen.join("\n")); }
})();
