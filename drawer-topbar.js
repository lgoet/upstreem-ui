/* upstreem drawer-topbar.js — die kleine Navigationsleiste ueber jedem Detail-Drawer (Praefix
   `utb`). Braucht core.js.

   Eine Zeile, 32px hoch, volle Breite: links der Zuruecklink und die Brotkrume
   "TYP / Logo / Name", rechts Bearbeiten (nur bei Marken), Anheften und das Kreuz.

   ── Woher die Daten kommen ──────────────────────────────────────────────────────
   ZWEI WEGE, und der Setter gewinnt:

       setDrawerTopbar(id, payload)   der EMPFOHLENE Weg. Ein Run-JS-Schritt, der alles fuellt:
                                      { "type": "...", "name": "...", "logo": "...",
                                        "item_id": "..." }
                                      Fehlt ein Feld im Payload, bleibt der bisherige Wert
                                      stehen -- so kann ein Schritt auch nur das Bild nachtragen.

   Die Attribute unten funktionieren weiter und sind der Anfangszustand. Sie waren der erste
   Entwurf und ausdruecklich als "kein Setter noetig" begruendet -- das hat zwei Runden gekostet:
   Bubble hat data-name und data-type nachgezogen, data-logo aber nicht, und die Leiste zeigte
   das alte Bild zu einem neuen Namen. Ob das an einem Ausdruck in Bubble lag oder am Element,
   ist von hier aus nicht zu sehen -- und das ist genau der Grund, warum jede andere Komponente
   dieses Hauses einen Setter hat. Ein Wert, den ein Workflow schickt, kommt an oder nicht; ein
   Attribut, das jemand aendern SOLLTE, ist eine Hoffnung.

   Die Attribute:

       data-type       "brand" | "brand editor" | "prompt" | "domain" | "url" | "response"
                       bestimmt die Beschriftung links, welches Bild oder Zeichen davor steht
                       UND welcher Knopf rechts dazukommt: der Stift nur bei brand, der Globus
                       ("zur uebergeordneten Domain") nur bei url.
                       brand, brand editor, domain und url zeigen data-logo (Logo oder Favicon),
                       prompt und response ein Zeichen (zap / scan) -- die haben kein Bild.
                       Zweiwortige Typen darf man auch "brand_editor" oder "brand-editor"
                       schreiben; die Leiste normt das.
       data-name       der Name, der rechts vom Trenner steht. Bei einer Marke ihr Name, bei
                       einer URL ihr Titel -- was da hineingehoert, entscheidet der Drawer, nicht
                       diese Leiste.
       data-logo       Bild fuer die Platte davor (Markenlogo oder Favicon). Fehlt es, steht der
                       erste Buchstabe des Namens dort. Bei prompt und response wird es nicht
                       gelesen: dort steht das Zeichen des Typs.
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
   data-domain-fn  "bubble_fn_utbDomain_[id]"  nur bei data-type="url", der Globus links vom
                                              Pin: "zur uebergeordneten Domain". Die Leiste
                                              weiss NICHT, welche Domain das ist -- sie schickt
                                              die Kennung der URL, und der Workflow loest sie
                                              auf. Alles andere waere ein zweiter Ort, an dem
                                              das Datenmodell der App steht. { type, item_id }
   Anheften meldet NICHTS an Bubble: es ruft window.upstreemPinToSidebar, dieselbe Funktion, die
   Quick Actions aus seinem Zeilenmenue ruft. Die Seitenleiste besitzt diese Liste, und ein
   zweiter Weg dorthin waere ein zweiter Zustand.
   BEI data-type="response" GIBT ES DEN PIN NICHT: die Seitenleiste fuehrt Orte, zu denen man
   zurueckkehrt, und eine einzelne KI-Antwort ist ein Ergebnis eines Laufs, kein Ort.

   ── Die Setter ──────────────────────────────────────────────────────────────────
   setDrawerTopbar(id, p) fuellt Typ, Name, Bild und Kennung. Siehe oben.
   resetDrawerTopbar(id)   zurueck auf das Skelett. Gehoert in den Workflow, der den Drawer auf
                           ein anderes Element umstellt, und zwar VOR das Laden: sonst zeigt die
                           Leiste solange den alten Namen mit dem alten Bild, und das ist eine
                           Falschaussage ueber ein Element, das schon nicht mehr offen ist.
                           Er loescht die Attribute NICHT -- die gehoeren Bubble. Sobald ein
                           data-name ankommt, ist der Ladezustand von selbst vorbei.
   refreshDrawerTopbar(id) Notbremse fuer Attributaenderungen, die der Beobachter nicht sieht.

   OHNE DATEN STEHT EIN SKELETT, an drei Stellen: Typ, Logoplatte und Name. Woran die Leiste das
   erkennt, ist der leere data-name -- ein Logo kann echt fehlen (eine URL ohne Favicon), ein
   Name nicht.

   ── Was aus core kommt ──────────────────────────────────────────────────────────
   UC.makeMount, UC.makeFire, UC.esc, UC.icon, UC.makeTooltips, UC.widthTiers, UC.themeParam
   .up-iconbtn, .up-logo-box, .up-tip   die Bauteile
   Neu ist hier nur die Anordnung. */
(function () {
  "use strict";

  /* ---- Boot-Stubs (STYLEGUIDE §25), VOR der core-Pruefung ---------------------------------
     Seit es resetDrawerTopbar gibt, kann ein Workflow rufen, bevor diese Datei geladen ist --
     ohne Stub wirft der erste Aufruf und reisst den ganzen Run-JS-Step mit, also auch die Setter
     der anderen Komponenten darunter. Alles ANDERE steht weiter in Attributen; die sind im
     Markup, bevor irgendein Skript laeuft. */
  var API_NAMES = ["setDrawerTopbar", "resetDrawerTopbar", "refreshDrawerTopbar"];
  var Q = (window.__utbBootQueue = window.__utbBootQueue || []);
  API_NAMES.forEach(function (n) {
    if (!window[n]) window[n] = function () { Q.push([n, [].slice.call(arguments)]); };
  });

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

  /* Die Typen und ihre Beschriftung. Ueber t() und nicht fest, damit sie im deutschen Setting
     mitgeht -- die Woerter selbst stehen im Katalog von core.
     Ein unbekannter Typ verschluckt die Leiste NICHT: er wird gezeigt, wie er kam. Ein Drawer
     ohne Beschriftung waere schlimmer als eine, die "widget" sagt.
     "brand editor" ist der Drawer, in dem eine Marke BEARBEITET wird (07.09. angefordert). Er
     zeigt dasselbe Markenlogo wie "brand" -- es ist dieselbe Sache, nur eine andere Ansicht
     davon -- aber KEINEN Stift: dort ist man schon. */
  var TYPEN = { brand: "Brand", prompt: "Prompt", domain: "Domain", url: "URL",
                response: "Response", "brand editor": "Brand Editor" };
  /* ---- Ein Typ, mehrere Schreibweisen ----
     Aus Bubble kommt der Wert als Text aus einem Ausdruck, und ein zweiwortiger Typ schreibt
     sich dort erfahrungsgemaess mal "brand_editor", mal "brand-editor", mal "Brand Editor".
     Alle drei meinen dasselbe, also werden alle drei zu einem Wert -- sonst faellt der Typ auf
     "wird gezeigt, wie er kam" zurueck und die Leiste sagt "brand_editor". Ein Unterstrich in
     einer Brotkrume ist ein Fehler, den niemand melden muss.
     Genormt wird auch, was in den EREIGNISSEN mitgeht: ein Workflow, der auf den Typ verzweigt,
     soll nicht drei Faelle fuer eine Sache brauchen. Fuer die alten Typen aendert das nichts,
     sie normen sich auf sich selbst. */
  function typNorm(t) {
    return String(t == null ? "" : t).toLowerCase().trim()
      .replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  }
  /* ---- Zwei Typen haben kein Bild, sondern ein Zeichen (07.09. angefordert) ----
     Ein Prompt und eine KI-Antwort sind keine Sache mit Logo: es gibt kein Markenbild und kein
     Favicon dazu, und der erste Buchstabe des Namens waere hier eine Behauptung ("W" fuer
     "Welche Anbieter..."). Genommen werden genau die Zeichen, die der Prompts-Seitenkopf fuer
     seine zwei Abschnitte fuehrt -- zap fuer die Prompts, scan fuer die Responses (so heisst es
     in core; im Seitenkopf und in Miras Protokoll ist es dasselbe Zeichen). Damit steht in der
     Leiste dasselbe Zeichen wie in der Navigation, aus der man kommt.
     Ein mitgeschicktes data-logo wird fuer diese zwei Typen NICHT verwendet: das Zeichen sagt
     den Typ, und zwei Quellen fuer dieselbe Stelle waeren die naechste Meldung. */
  var TYP_ZEICHEN = { prompt: "zap", response: "scan" };
  function typLabel(t) {
    var k = typNorm(t);
    var w = TYPEN[k] || k;
    return w ? (UC.t ? UC.t(w) : w) : "";
  }

  function initRoot(root) {
    if (!root || root.__utbController) return root && root.__utbController;
    var instanceId = root.getAttribute("data-instance") || "default";

    function attr(n) { return root.getAttribute(n) || ""; }
    /* Der Setter schreibt in daten; ist ein Feld dort nicht gesetzt (undefined), gilt das
       Attribut. So bleibt der Anfangszustand aus dem Markup gueltig, und ein Schritt, der nur
       das Bild nachtraegt, loescht nicht den Namen. */
    var daten = {};
    function feld(schluessel, attrName) {
      var w = daten[schluessel] != null ? daten[schluessel] : attr(attrName);
      return String(w == null ? "" : w).trim();
    }
    function typ() { return typNorm(feld("type", "data-type")); }
    function name() { return feld("name", "data-name"); }
    function logo() {
      var w = feld("logo", "data-logo");
      /* Die Platzhalter, die Bubble stehen laesst, wenn ein Feld leer ist. Sie als Bildquelle zu
         nehmen ergibt ein gebrochenes Bild -- der Buchstabe ist dann die richtige Antwort. */
      return (!w || w === "LOGO" || w === "BRAND_LOGO" || w === "FAVICON") ? "" : w;
    }
    function itemId() { return feld("item_id", "data-item-id"); }

    var elType, elLogo, elName, elEdit, elDomain, elPin;
    var state = { leer: true };

    /* Das Markup baut die Komponente selbst. In Bubble steht nur die leere Wurzel -- die Leiste
       hat keine Zellen, die jemand von Hand anpassen wollte, und ein von Hand eingefuegter
       Aufbau waere eine Kopie, die beim naechsten Pin nicht mitwandert.
       EIGENE FUNKTION, damit sie sich WIEDERHOLEN laesst: Bubble baut ein Element bei jedem
       Rerender neu und ersetzt dabei auch schon einmal dessen Inhalt. Danach zeigen elName und
       die anderen auf abgehaengte Knoten, und jedes Zeichnen schreibt ins Leere -- das Bild blieb
       stehen, obwohl der Drawer laengst ein anderes Element zeigte. Genau so gemeldet: "das Bild
       updatet beim Wechseln nicht zuverlaessig". */
    function aufbauen() {
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
        /* Nur bei einer URL, und LINKS vom Pin (so angefordert). Er steht damit an derselben
           Stelle wie der Stift bei einer Marke: beide sind der EINE typabhaengige Knopf, und
           zwei verschiedene Plaetze fuer dieselbe Rolle waeren zwei Orte, an denen der Nutzer
           suchen muss. */
        '<button type="button" class="up-iconbtn utb-domain" data-utb-domain hidden ' +
          'data-tip="' + esc(UC.t("Go to parent domain")) + '" ' +
          'aria-label="' + esc(UC.t("Go to parent domain")) + '">' +
          UC.icon("globe", 2) + '</button>' +
        '<button type="button" class="up-iconbtn utb-pin" data-utb-pin ' +
          'data-tip="' + esc(UC.t("Pin to sidebar")) + '" aria-label="' + esc(UC.t("Pin to sidebar")) + '">' +
          UC.icon("pin", 2) + '</button>' +
        '<button type="button" class="up-iconbtn utb-close" data-utb-close ' +
          'data-tip="' + esc(UC.t("Close")) + '" aria-label="' + esc(UC.t("Close")) + '">' +
          UC.icon("x", 2) + '</button>' +
      '</div>';

      elType = root.querySelector("[data-utb-type]");
      elLogo = root.querySelector("[data-utb-logo]");
      elName = root.querySelector("[data-utb-name]");
      elEdit = root.querySelector("[data-utb-edit]");
      elDomain = root.querySelector("[data-utb-domain]");
      elPin = root.querySelector("[data-utb-pin]");
    }
    aufbauen();

    var fire = UC.makeFire(root, { label: "drawer-topbar", eventPrefix: "utb" });

    function dunkelJetzt() {
      /* UC.themeParam statt isYes: kennt core ein Thema, gewinnt core -- dasselbe Muster wie in
         den anderen Komponenten. */
      return root.getAttribute("data-theme") === "dark" || UC.themeParam(attr("data-isdark"));
    }

    function render() {
      /* SELBSTHEILUNG ZUERST. Sind unsere Knoten nicht mehr im Baum, hat sie jemand ersetzt --
         dann wird neu gebaut, statt in abgehaengte Knoten zu schreiben. Das ist die Ursache des
         "das Bild updatet nicht zuverlaessig": es stand noch da, weil das sichtbare Logo ein
         anderer Knoten war als der, den diese Funktion beschrieben hat. */
      if (!elName || !root.contains(elName)) aufbauen();

      var t = typ(), n = name(), l = logo();
      /* NOCH KEINE DATEN heisst SKELETT -- fuer den Namen UND fuer das Bild (07.09. angefordert).
         Woran man es erkennt: kein Name. Der Typ allein genuegt nicht, den kennt der Drawer schon
         beim Oeffnen; und ein Logo kann echt fehlen (eine URL ohne Favicon), ein Name nicht.
         state.leer kommt dazu: reset() setzt es, damit die Leiste auch dann leer aussieht, wenn
         die alten Attribute noch am Element stehen. */
      var laedt = state.leer || !n;

      elType.innerHTML = laedt ? '<span class="utb-sk utb-sk-type"></span>' : esc(typLabel(t));
      /* Ohne Typ faellt auch der Trenner weg: "/ ADAC" waere ein Satzzeichen ohne Satz. Im
         Ladezustand bleibt er stehen -- dort steht links davon ja ein Skelett. */
      root.classList.toggle("is-notype", !laedt && !typLabel(t));

      if (laedt) {
        /* Die Platte behaelt ihre Groesse und traegt den Skelettton -- im Ladezustand ist sie
           kein Bild und kein Buchstabe, sondern ein Platzhalter. Auch bei den Zeichentypen: der
           Typ ist zwar frueh bekannt, aber ein Zeichen neben zwei Skeletten saehe aus wie halb
           geladen. */
        elLogo.className = "up-logo-box utb-logo is-sk";
        elLogo.innerHTML = "";
      } else if (TYP_ZEICHEN[t]) {
        /* Kein Bild, keine Platte, nur das Zeichen des Typs. */
        elLogo.className = "up-logo-box utb-logo is-zeichen";
        elLogo.innerHTML = UC.icon(TYP_ZEICHEN[t], 2);
      } else {
        /* Das Logo: Bild, wenn eine Quelle da ist, sonst der erste Buchstabe des Namens. Bricht
           das Bild, bleibt der Buchstabe stehen -- er liegt schon darunter, .has-img versteckt
           ihn nur. */
        var buchst = (n.charAt(0) || "?").toUpperCase();
        elLogo.className = "up-logo-box utb-logo" + (l ? " has-img" : "");
        elLogo.innerHTML = '<span class="up-logo-ltr">' + esc(buchst) + '</span>' +
          (l ? '<img alt="" src="' + esc(l) + '" ' +
               'onerror="this.parentNode.classList.remove(&quot;has-img&quot;);this.remove()"/>' : "");
      }

      /* Kein Name heisst LAEDT und nicht LEER: die Leiste steht schon, waehrend der Drawer seine
         Daten holt. Ein Skelett sagt das; ein leerer Streifen saehe aus wie ein Fehler, und ein
         erfundener Text ("Unbenannt") waere eine Behauptung ueber Daten, die es nicht gibt. */
      if (laedt) elName.innerHTML = '<span class="utb-sk utb-sk-name"></span>';
      else elName.textContent = n;

      /* Bearbeiten NUR bei Marken (angefordert). hidden UND die CSS-Zeile dazu: [hidden] kommt
         aus dem Stylesheet des Browsers und wird von jeder eigenen display-Regel geschlagen --
         hier gibt es keine, aber .up-iconbtn traegt display: inline-flex, also braucht es sie.
         Im Ladezustand bleibt er weg: welcher Typ kommt, weiss die Leiste noch nicht, und ein
         Knopf, der gleich wieder verschwindet, ist schlimmer als einer, der spaeter erscheint. */
      elEdit.hidden = laedt || (t !== "brand");
      /* Und der Globus nur bei einer URL -- aus demselben Grund wie oben: im Ladezustand weiss
         die Leiste den Typ noch nicht, und ein Knopf, der gleich wieder verschwindet, ist
         schlimmer als einer, der spaeter erscheint. */
      elDomain.hidden = laedt || (t !== "url");
      /* ANHEFTEN GIBT ES BEI EINER KI-ANTWORT NICHT (07.09. angefordert: "das soll da nicht
         gehen"). Und das passt zur Sache: die Seitenleiste heftet Dinge an, zu denen man
         zurueckkehrt -- eine Marke, eine Domain, eine URL, einen Prompt. Eine einzelne Antwort
         ist ein Ergebnis eines Laufs, kein Ort.
         OHNE laedt, anders als beim Stift und beim Globus: der Pin ist sonst IMMER bedienbar,
         auch im Ladezustand (so gebaut und so geprueft -- er haengt an nichts, was geladen
         werden muesste). Steht der Typ schon auf response, ist er trotzdem gleich weg, statt
         einmal aufzublitzen. */
      elPin.hidden = (t === "response");
    }

    /* ---- Zuruecksetzen (07.09. angefordert) ----
       Ein Workflow, der den Drawer auf ein anderes Element umstellt, ruft das VOR dem Laden --
       dann steht das Skelett, waehrend die neuen Daten kommen, und nicht der alte Name mit dem
       alten Bild. Ohne das waere der Zwischenzustand eine Falschaussage: die Leiste zeigte ein
       Element, das im Drawer schon nicht mehr offen ist.
       state.leer und NICHT das Loeschen der Attribute: die gehoeren Bubble. Sobald ein Name
       ankommt, ist der Zustand von selbst vorbei (siehe der Beobachter). */
    function reset() { state.leer = true; daten = {}; render(); }

    /* ---- Der Setter (07.09.) ----
       readBubble und nicht JSON.parse: ein Bubble-Ausdruck liefert regelmaessig doppelt
       verpacktes JSON, unquotierte yes/no und leere Werte hinter einem Doppelpunkt -- readBubble
       kennt all das (siehe core), JSON.parse wirft. Und ein Payload, der NICHT lesbar war, darf
       nicht stumm verpuffen (§46): dann bleibt stehen, was die Attribute sagen, der Ladezustand
       endet trotzdem, und die Konsole sagt warum. Endloses Skelett waere die schlechteste
       Antwort -- es sieht aus wie "gleich da". */
    function setzen(p) {
      var o = UC.readBubble ? UC.readBubble(p) : (typeof p === "object" ? p : null);
      /* readBubble liefert bei TEXT eine LISTE zurueck -- parseBubbleJson verpackt auch ein
         einzelnes Objekt in ein Array, weil seine Aufrufer Zeilen erwarten. Ein Objekt, das
         direkt hereinkommt, gibt es unveraendert weiter. Beide Formen kommen hier an, also wird
         hier ausgepackt. Ohne diese drei Zeilen ging der Setter durch die Pruefung darunter
         (ein Array IST typeof "object"), setzte aber kein einziges Feld: o.name war undefined,
         und die Leiste zeigte weiter die Attribute. Genau so gemeldet ("das Logo bleibt
         bestehen") und im Prueftand mit fuenf FALSCH belegt. */
      if (Array.isArray(o)) o = o.length ? o[0] : null;
      if (!o || typeof o !== "object" || Array.isArray(o)) {
        if (window.console) console.warn("[drawer-topbar] setDrawerTopbar: der Payload war nicht " +
          "lesbar. Es bleibt stehen, was in den Attributen steht. Payload: " + String(p).slice(0, 200));
        state.leer = false;
        render();
        return;
      }
      /* Nur die vier Felder, die es gibt, und nur die MITGESCHICKTEN. item_id auch als "id":
         so heisst das Feld in den Ereignissen dieser Leiste und in jedem Payload der App. */
      ["type", "name", "logo"].forEach(function (k) {
        if (o[k] != null) daten[k] = String(o[k]);
      });
      if (o.item_id != null) daten.item_id = String(o.item_id);
      else if (o.id != null) daten.item_id = String(o.id);
      /* Der Ladezustand endet, sobald ein Name da ist -- dieselbe Regel wie am Attributweg. */
      if (name()) state.leer = false;
      render();
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
      if (t.closest("[data-utb-domain]")) {
        fire("data-domain-fn", "utbDomain", { type: typ(), item_id: itemId() });
        return;
      }
      if (t.closest("[data-utb-pin]")) { anheften(); return; }
    });

    /* ---- Anheften. Wortgleich die Uebergabe, die Quick Actions benutzt: Typ, Kennung,
       Beschriftung, Bild. Die Seitenleiste zeichnet daraus ihre Zeile, und weil die Kennung
       dieselbe ist, die auch in unseren Ereignissen steht, liefert ein Klick in der Leiste
       spaeter denselben Wert wie dieser Drawer. */
    function anheften() {
      /* Der Knopf ist bei einer KI-Antwort gar nicht da (siehe render). Diese Zeile ist der
         Riegel dahinter: wer die Funktion auf einem anderen Weg erreicht, heftet keine Antwort
         an eine Liste, die sie nicht zeigen kann. Eine Sichtbarkeit, eine Regel -- und beide
         nennen denselben Grund. */
      if (typ() === "response") {
        if (window.console) console.warn("[drawer-topbar] eine KI-Antwort wird nicht an die " +
          "Seitenleiste geheftet -- die Leiste fuehrt Orte, zu denen man zurueckkehrt.");
        return;
      }
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
      new MutationObserver(function () {
        /* Ein Name, der ankommt, beendet den Ladezustand. Bleibt er leer, bleibt das Skelett --
           auch wenn Typ oder Bild sich aendern: ohne Namen ist nichts vollstaendig da. */
        if (name()) state.leer = false;
        render();
      }).observe(root, {
        attributes: true,
        attributeFilter: ["data-type", "data-name", "data-logo", "data-item-id"],
        /* childList DAZU: ersetzt jemand den Inhalt der Wurzel (Bubble tut das bei einem
           Rerender), zeigen unsere Knoten ins Nichts. render() baut dann neu auf -- aber nur,
           wenn es ueberhaupt gerufen wird, und dafuer braucht es diese Zeile. */
        childList: true
      });
    }

    /* Schmale Breiten: die Schwellen stehen in drawer-topbar.css begruendet. Gemessen wird die
       EIGENE Breite der Leiste, nicht die des Fensters -- sie steht in einem Drawer, und der ist
       auf dem Telefon schmal, auf dem Schreibtisch nicht. */
    if (UC.widthTiers) UC.widthTiers(root, { narrowAt: 356, vnarrowAt: 260 });
    if (UC.makeTooltips) UC.makeTooltips(root, dunkelJetzt);

    /* Der erste Zustand: steht schon ein Name am Element, ist die Leiste fertig -- sonst laedt
       sie. Dieselbe Regel wie im Beobachter, damit es nur eine gibt. */
    if (name()) state.leer = false;
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

    var api = { render: render, refresh: render, reset: reset, set: setzen };
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
    queue: "__utbBootQueue",
    api: {
      /* Der Hauptweg: ein Schritt fuellt alles. */
      setDrawerTopbar: function (id, p) { return each(id, function (c) { c.set(p); }); },
      /* Zurueck auf das Skelett. Gehoert VOR das Laden der neuen Daten, in denselben Workflow,
         der den Drawer umstellt. */
      resetDrawerTopbar: function (id) { return each(id, function (c) { c.reset(); }); },
      /* Notbremse: wer die Attribute ueber einen Weg aendert, den der Beobachter nicht sieht,
         kann die Leiste damit nachziehen. Im Normalbetrieb nicht noetig. */
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
