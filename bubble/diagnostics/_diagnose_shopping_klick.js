/* Diagnose 05.10.: was passiert beim ERSTEN Klick auf "Shopping" in der Seitenleiste?
   Gemeldet: die Adresse bekommt ?view=shopping, aber #view-shopping bleibt unsichtbar (inline
   display:none) -- direkt ueber die Adresse geht es, und danach auch per Klick.
   Zu benutzen: Seite NEU laden (nicht auf Shopping), Konsole oeffnen, das hier einfuegen.
   Es klickt selbst und schreibt fuenf Zeilen: vor dem Klick, nach 50, 500, 1500 und 3000 ms.
   Nichts wird veraendert ausser dem Klick selbst. */
(function () {
  var leiste = document.querySelector(".usn-root");
  var item = document.querySelector('.usn-item[data-nav-key="shopping"]');
  if (!item) { console.log("[klick] kein Shopping-Eintrag in der Seitenleiste"); return; }
  var fnName = leiste && leiste.getAttribute("data-nav-fn");
  var aufrufe = [];
  /* Mitschreiben, ohne etwas zu aendern: der Aufruf geht unveraendert an das Original. */
  if (fnName && typeof window[fnName] === "function") {
    var orig = window[fnName];
    window[fnName] = function (v) { aufrufe.push(fnName + "(" + String(v).slice(0, 120) + ")"); return orig.apply(this, arguments); };
    setTimeout(function () { window[fnName] = orig; }, 4000);
  } else aufrufe.push("usnNav-Funktion fehlt: data-nav-fn=" + fnName);
  if (typeof window.showView === "function") {
    var sv = window.showView;
    window.showView = function (n) { aufrufe.push("showView(" + n + ")"); return sv.apply(this, arguments); };
    setTimeout(function () { window.showView = sv; }, 4000);
  }
  var anfang = document.getElementById("view-shopping");
  function stand(t) {
    var v = document.getElementById("view-shopping");
    var cs = v ? getComputedStyle(v) : null;
    console.log("[klick] " + t + "ms", v ? {
      inlineDisplay: v.style.display || "(leer)", display: cs.display, visibility: cs.visibility, opacity: cs.opacity,
      viewOn: v.classList.contains("view-on"), andereMitViewOn: [].map.call(document.querySelectorAll('[id^="view-"].view-on'), function (x) { return x.id; }).join(","),
      gleichesElement: v === anfang, hatShoppingRoot: !!v.querySelector(".ush-root"),
      url: new URL(location.href).searchParams.get("view"), aufrufe: aufrufe.slice()
    } : "kein #view-shopping im Dokument");
  }
  stand(0);
  item.click();
  [50, 500, 1500, 3000].forEach(function (t) { setTimeout(function () { stand(t); }, t); });
})();
