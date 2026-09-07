/* upstreem drawer-topbar.js — die kleine Navigationsleiste ueber jedem Detail-Drawer (Praefix
   `utb`). Braucht core.js.

   Eine Zeile, 32px hoch, volle Breite: links der Zuruecklink und die Brotkrume
   "TYP / Logo / Name", rechts Bearbeiten (nur bei Marken), Anheften und das Kreuz.

   ── Woher die Daten kommen ──────────────────────────────────────────────────────
   ALLES ueber Attribute, kein Setter. Das ist die ganze Schnittstelle:

       data-type       "brand" | "prompt" | "domain" | "url"   bestimmt die Beschriftung links
                       UND ob der Bearbeiten-Knopf da ist (nur bei brand)
       data-name       der Name, der rechts vom Trenner steht. Bei einer Marke ihr Name, bei
                       einer URL ihr Titel -- was da hineingehoert, entscheidet der Drawer, nicht
                       diese Leiste.
       data-logo       Bild fuer die Platte davor (Markenlogo oder Favicon). Fehlt es, steht der
                       erste Buchstabe des Namens dort.
       data-item-id    die Kennung, die in jedem Ereignis mitgeht und die auch angeheftet wird.

   Warum Attribute und kein Setter: die Leiste hat keinen Zustand, den sie sich merken muesste.
   Sie zeigt genau das, was gerade im Drawer offen ist -- und WELCHES das ist, weiss Bubble
   ohnehin, weil es den Drawer selbst oeffnet. Ein Setter waere ein zweiter Weg zu derselben
   Angabe. Alle vier werden LIVE mitgelesen (MutationObserver unten): wechselt der Drawer sein
   Element, aendert Bubble die Attribute, und die Leiste zieht nach, ohne dass ein Workflow etwas
   rufen muss.

   ── Was die Leiste meldet ───────────────────────────────────────────────────────
   data-close-fn   "bubble_fn_utbClose_[id]"   Zurueck ODER Kreuz. EIN Ereignis fuer beide:
                                              beide bedeuten "Drawer zu", und zwei Ereignisse
                                              fuer dieselbe Absicht waeren zwei Workflows, die
                                              auseinanderlaufen. Payload { type, item_id }.
   data-edit-fn    "bubble_fn_utbEdit_[id]"    nur bei data-type="brand". { type, item_id }
   Anheften meldet NICHTS an Bubble: es ruft window.upstreemPinToSidebar, dieselbe Funktion, die
   Quick Actions aus seinem Zeilenmenue ruft. Die Seitenleiste besitzt diese Liste, und ein
   zweiter Weg dorthin waere ein zweiter Zustand.

   ── Was aus core kommt ──────────────────────────────────────────────────────────
   UC.makeMount, UC.makeFire, UC.esc, UC.icon, UC.makeTooltips, UC.widthTiers, UC.themeParam
   .up-iconbtn, .up-logo-box, .up-tip   die Bauteile
   Neu ist hier nur die Anordnung. */
(function () {
  "use strict";

  /* Boot-Stubs (STYLEGUIDE §25) braucht diese Komponente NICHT: sie hat keinen Setter, den ein
     Workflow vor dem Laden dieser Datei rufen koennte. Was Bubble ihr sagt, steht in Attributen,
     und die stehen im Markup, bevor irgendein Skript laeuft. */

  function utbBoot(triesLeft) {
    if (!window.UpstreemCore) {
      /* Dieselbe Wiederholung wie in jeder anderen Komponente: Bubble haengt die Skripte per
         jQuery .html() ein, und die Reihenfolge der Ausfuehrung ist dabei nicht garantiert. */
      if (triesLeft > 0) { setTimeout(function () { utbBoot(triesLeft - 1); }, 100); return; }
      if (window.console) console.error("UpstreemCore (core.js) not loaded");
      return;
    }
    utbStart();
  }

  function utbStart() {
  var UC = window.UpstreemCore;
  var esc = UC.esc;

  /* Die vier Typen und ihre Beschriftung. Ueber t() und nicht fest, damit sie im deutschen
     Setting mitgeht -- die Woerter selbst stehen im Katalog von core.
     Ein unbekannter Typ verschluckt die Leiste NICHT: er wird gezeigt, wie er kam. Ein Drawer
     ohne Beschriftung waere schlimmer als eine, die "widget" sagt. */
  var TYPEN = { brand: "Brand", prompt: "Prompt", domain: "Domain", url: "URL" };
  function typLabel(t) {
    var k = String(t == null ? "" : t).toLowerCase().trim();
    var w = TYPEN[k] || k;
    return w ? (UC.t ? UC.t(w) : w) : "";
  }

  function initRoot(root) {
    if (!root || root.__utbController) return root && root.__utbController;
    var instanceId = root.getAttribute("data-instance") || "default";

    function attr(n) { return root.getAttribute(n) || ""; }
    function typ() { return String(attr("data-type")).toLowerCase().trim(); }
    function name() { return attr("data-name").trim(); }
    function logo() {
      var w = attr("data-logo").trim();
      /* Die Platzhalter, die Bubble stehen laesst, wenn ein Feld leer ist. Sie als Bildquelle zu
         nehmen ergibt ein gebrochenes Bild -- der Buchstabe ist dann die richtige Antwort. */
      return (!w || w === "LOGO" || w === "BRAND_LOGO" || w === "FAVICON") ? "" : w;
    }
    function itemId() { return attr("data-item-id").trim(); }

    /* Das Markup baut die Komponente selbst. In Bubble steht nur die leere Wurzel -- die Leiste
       hat keine Zellen, die jemand von Hand anpassen wollte, und ein von Hand eingefuegter
       Aufbau waere eine Kopie, die beim naechsten Pin nicht mitwandert. */
    root.innerHTML =
      '<button type="button" class="up-iconbtn utb-back" data-utb-close ' +
        'data-tip="' + esc(UC.t("Back")) + '" aria-label="' + esc(UC.t("Back")) + '">' +
        UC.icon("chevronLeft", 2) + '</button>' +
      '<div class="utb-crumb">' +
        '<span class="utb-type" data-utb-type></span>' +
        '<span class="utb-sep" aria-hidden="true">/</span>' +
        '<span class="up-logo-box utb-logo" data-utb-logo></span>' +
        '<span class="utb-name" data-utb-name></span>' +
      '</div>' +
      '<div class="utb-tools">' +
        '<button type="button" class="up-iconbtn utb-edit" data-utb-edit hidden ' +
          'data-tip="' + esc(UC.t("Edit brand")) + '" aria-label="' + esc(UC.t("Edit brand")) + '">' +
          UC.icon("squarePen", 2) + '</button>' +
        '<button type="button" class="up-iconbtn utb-pin" data-utb-pin ' +
          'data-tip="' + esc(UC.t("Pin to sidebar")) + '" aria-label="' + esc(UC.t("Pin to sidebar")) + '">' +
          UC.icon("pin", 2) + '</button>' +
        '<button type="button" class="up-iconbtn utb-close" data-utb-close ' +
          'data-tip="' + esc(UC.t("Close")) + '" aria-label="' + esc(UC.t("Close")) + '">' +
          UC.icon("x", 2) + '</button>' +
      '</div>';

    var elType = root.querySelector("[data-utb-type]");
    var elLogo = root.querySelector("[data-utb-logo]");
    var elName = root.querySelector("[data-utb-name]");
    var elEdit = root.querySelector("[data-utb-edit]");

    var fire = UC.makeFire(root, { label: "drawer-topbar", eventPrefix: "utb" });

    function dunkelJetzt() {
      /* UC.themeParam statt isYes: kennt core ein Thema, gewinnt core -- dasselbe Muster wie in
         den anderen Komponenten. */
      return root.getAttribute("data-theme") === "dark" || UC.themeParam(attr("data-isdark"));
    }

    function render() {
      var t = typ(), n = name(), l = logo();
      elType.textContent = typLabel(t);
      /* Ohne Typ faellt auch der Trenner weg: "/ ADAC" waere ein Satzzeichen ohne Satz. */
      root.classList.toggle("is-notype", !elType.textContent);

      /* Das Logo: Bild, wenn eine Quelle da ist, sonst der erste Buchstabe des Namens. Bricht das
         Bild, bleibt der Buchstabe stehen -- er liegt schon darunter, .has-img versteckt ihn nur. */
      var buchst = (n.charAt(0) || "?").toUpperCase();
      elLogo.className = "up-logo-box utb-logo" + (l ? " has-img" : "");
      elLogo.innerHTML = '<span class="up-logo-ltr">' + esc(buchst) + '</span>' +
        (l ? '<img alt="" src="' + esc(l) + '" ' +
             'onerror="this.parentNode.classList.remove(&quot;has-img&quot;);this.remove()"/>' : "");

      /* Kein Name heisst LAEDT und nicht LEER: die Leiste steht schon, waehrend der Drawer seine
         Daten holt. Ein Skelett sagt das; ein leerer Streifen saehe aus wie ein Fehler, und ein
         erfundener Text ("Unbenannt") waere eine Behauptung ueber Daten, die es nicht gibt. */
      if (n) elName.textContent = n;
      else elName.innerHTML = '<span class="utb-name-sk"></span>';

      /* Bearbeiten NUR bei Marken (angefordert). hidden UND die CSS-Zeile dazu: [hidden] kommt
         aus dem Stylesheet des Browsers und wird von jeder eigenen display-Regel geschlagen --
         hier gibt es keine, aber .up-iconbtn traegt display: inline-flex, also braucht es sie. */
      elEdit.hidden = (t !== "brand");
    }

    /* ---- Klicks. Delegiert an der Wurzel, damit ein Neubau des Markups die Bindung nicht
       verliert -- render() schreibt nur Text und Bild, aber das ist eine Zusage, die man leicht
       bricht. */
    root.addEventListener("click", function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      if (t.closest("[data-utb-close]")) {
        fire("data-close-fn", "utbClose", { type: typ(), item_id: itemId() });
        return;
      }
      if (t.closest("[data-utb-edit]")) {
        fire("data-edit-fn", "utbEdit", { type: typ(), item_id: itemId() });
        return;
      }
      if (t.closest("[data-utb-pin]")) { anheften(); return; }
    });

    /* ---- Anheften. Wortgleich die Uebergabe, die Quick Actions benutzt: Typ, Kennung,
       Beschriftung, Bild. Die Seitenleiste zeichnet daraus ihre Zeile, und weil die Kennung
       dieselbe ist, die auch in unseren Ereignissen steht, liefert ein Klick in der Leiste
       spaeter denselben Wert wie dieser Drawer. */
    function anheften() {
      var id = itemId();
      if (!id) {
        /* Ohne Kennung waere der Pin eine Zeile, die auf nichts zeigt. Das sagt die Konsole --
           sichtbar im UI hat es keinen Platz, und stumm nichts tun ist die schlechteste Antwort
           (§46). */
        if (window.console) console.warn("[drawer-topbar] data-item-id fehlt -- ohne Kennung " +
          "kann nichts angeheftet werden.");
        return;
      }
      var fn = window.upstreemPinToSidebar ||
               (window.parent && window.parent.upstreemPinToSidebar) ||
               (window.top && window.top.upstreemPinToSidebar);
      if (typeof fn !== "function") {
        if (window.console) console.warn("[drawer-topbar] keine Sidebar auf dieser Seite -- " +
          "window.upstreemPinToSidebar fehlt, der Eintrag wurde nicht angeheftet.");
        return;
      }
      try { fn({ type: typ(), id: id, label: name() || id, logo: logo() }); } catch (e) {}
    }

    /* ---- Live mitlesen. Genau die vier Attribute, die das Bild bestimmen. Ein Drawer, der sein
       Element wechselt, aendert sie -- ohne diesen Beobachter stuende der alte Name da, bis
       irgendetwas anderes die Seite anfasst. */
    if (window.MutationObserver) {
      new MutationObserver(render).observe(root, {
        attributes: true,
        attributeFilter: ["data-type", "data-name", "data-logo", "data-item-id"]
      });
    }

    /* Schmale Breiten: die Schwellen stehen in drawer-topbar.css begruendet. Gemessen wird die
       EIGENE Breite der Leiste, nicht die des Fensters -- sie steht in einem Drawer, und der ist
       auf dem Telefon schmal, auf dem Schreibtisch nicht. */
    if (UC.widthTiers) UC.widthTiers(root, { narrowAt: 356, vnarrowAt: 260 });
    if (UC.makeTooltips) UC.makeTooltips(root, dunkelJetzt);

    render();
    /* Ein Themenwechsel aendert hier nichts am Markup -- die Farben haengen alle an Tokens. Die
       Sprache dagegen steckt in Beschriftungen, die beim Aufbau geschrieben wurden: Typ, und die
       drei data-tip. Also bei einem Sprachwechsel neu aufbauen. */
    if (UC.onPrefs) UC.onPrefs(function (d) {
      if (d && d.name && d.name !== "locale") return;
      var alt = root.__utbController;
      root.__utbController = null;
      root.innerHTML = "";
      var neu = initRoot(root);
      if (!neu) root.__utbController = alt;
    });

    var api = {
      render: render,
      /* Fuer Prueftaende und fuer einen Workflow, der die Leiste von aussen anstossen will, ohne
         ein Attribut zu aendern. Bewusst KEIN window-Setter: es gibt nichts zu setzen. */
      refresh: render
    };
    root.__utbController = api;
    return api;
  }

  function each(id, fn) {
    var roots = document.getElementsByClassName("utb-root");
    for (var i = 0; i < roots.length; i++) {
      var r = roots[i];
      if (id != null && (r.getAttribute("data-instance") || "default") !== String(id)) continue;
      var c = r.__utbController || initRoot(r);
      if (c) fn(c);
    }
  }

  UC.makeMount({
    rootClass: "utb-root", notPortal: true,
    ctrlProp: "__utbController",
    resolveLocal: "__utbResolveLocal",
    initRoot: initRoot,
    api: {
      /* Ein einziger Name nach aussen, und der ist eine Notbremse: wer die Attribute ueber einen
         Weg aendert, den der Beobachter nicht sieht (etwa als Ganzes ersetztes Markup), kann die
         Leiste damit nachziehen. */
      refreshDrawerTopbar: function (id) { return each(id, function (c) { c.refresh(); }); }
    }
  });

  if (UC.watchRoots) UC.watchRoots("utb-root", function () {
    var roots = document.getElementsByClassName("utb-root");
    for (var i = 0; i < roots.length; i++) initRoot(roots[i]);
  });
  [0, 100, 400, 1200].forEach(function (ms) {
    setTimeout(function () {
      var roots = document.getElementsByClassName("utb-root");
      for (var i = 0; i < roots.length; i++) initRoot(roots[i]);
    }, ms);
  });
  }

  utbBoot(50);
})();
