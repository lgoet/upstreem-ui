/* Diagnose 05.10. (2): Wie ist #view-shopping in Bubble gebaut -- verglichen mit den Ansichten, die
   beim ersten Leistenklick aufgehen?
   Der Klick-Test zeigte: usnNav und showView laufen, die Adresse und view-on stimmen, aber Bubbles
   EIGENES display:none (inline) bleibt an #view-shopping stehen. Der Kopf geht davon aus, dass
   Bubble eine Ansicht nie so versteckt ("kein display:none -- sonst baut Bubble die Elemente darin
   nicht auf"); dafuer parkt er sie selbst per CSS. Diese Tabelle zeigt, worin sich #view-shopping
   von den anderen unterscheidet: Elementart, doppelte Ids, Bubbles Sichtbarkeit beim Laden.
   Zu benutzen: Seite NEU laden, NICHT auf Shopping, Konsole oeffnen, einfuegen. Aendert nichts. */
(function () {
  function art(el) {
    var c = String((el && el.className) || "");
    if (/\bCustomElement\b/.test(c)) return "Reusable";
    if (/\bRepeatingGroup\b/.test(c)) return "RepeatingGroup";
    if (/\bGroup\b/.test(c)) return "Group";
    if (/\bHTML\b/.test(c)) return "HTML";
    return c.split(/\s+/).slice(0, 2).join(" ") || el.tagName.toLowerCase();
  }
  var zeilen = [].map.call(document.querySelectorAll('[id^="view-"]'), function (v) {
    var cs = getComputedStyle(v), eltern = v.parentElement;
    return {
      id: v.id,
      gleicheIds: document.querySelectorAll('[id="' + v.id + '"]').length,
      art: art(v),
      inlineDisplay: v.style.display || "(leer)",
      visibility: cs.visibility,
      viewOn: v.classList.contains("view-on"),
      kinder: v.childElementCount,
      reusablesDarin: v.querySelectorAll(".CustomElement").length,
      elternArt: eltern ? art(eltern) : "",
      elternId: (eltern && eltern.id) || "",
      viewFirstDa: typeof window["bubble_fn_view_first_" + v.id.replace(/^view-/, "")] === "function"
    };
  });
  if (console.table) console.table(zeilen); else console.log(zeilen);
})();
