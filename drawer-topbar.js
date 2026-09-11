/* upstreem drawer-topbar.js — die kleine Navigationsleiste ueber jedem Detail-Drawer (Praefix
   `utb`). Braucht core.js.

   Eine Zeile, 32px hoch, volle Breite: links der Zuruecklink und die Brotkrume
   "TYP / Logo / Name", rechts Bearbeiten (nur bei Marken), Anheften und das Kreuz.

   ── Woher die Daten kommen ──────────────────────────────────────────────────────
   ZWEI WEGE, und der Setter gewinnt:

       setDrawerTopbar(id, payload)   der EMPFOHLENE Weg. Ein Run-JS-Schritt, der alles fuellt:
                                      { "type": "...", "name": "...", "logo": "...",
                                        "item_id": "...", "market": "DE" }
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
       data-market     der Markt, zweistellig (DE, US, ...). Nur fuer EINE Sache da: heftet man
                       einen Prompt an die Seitenleiste, ist die Flagge dieses Marktes dort das
                       Bild -- so wie es Quick Actions macht. Fehlt er, bleibt das Bild leer und
                       die Leiste zeigt den ersten Buchstaben; in der Brotkrume hier aendert er
                       nichts (dort steht beim Prompt das zap).

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
   data-prompt-fn  "bubble_fn_utbPrompt_[id]"  nur bei data-type="response", das zap links vom
                                              Pin: "zum uebergeordneten Prompt". Wie beim
                                              Globus schickt die Leiste die Kennung der Antwort
                                              und NICHT die des Prompts -- welcher Prompt
                                              darueber steht, weiss das Datenmodell.
                                              { type, item_id }
   data-domain-fn  "bubble_fn_utbDomain_[id]"  nur bei data-type="url", der Globus links vom
                                              Pin: "zur uebergeordneten Domain". Die Leiste
                                              weiss NICHT, welche Domain das ist -- sie schickt
                                              die Kennung der URL, und der Workflow loest sie
                                              auf. Alles andere waere ein zweiter Ort, an dem
                                              das Datenmodell der App steht. { type, item_id }
   Anheften meldet NICHTS an Bubble: es ruft window.upstreemPinToSidebar, dieselbe Funktion, die
   Quick Actions aus seinem Zeilenmenue ruft. Die Seitenleiste besitzt diese Liste, und ein
   zweiter Weg dorthin waere ein zweiter Zustand.
   BEI data-type="response" UND "brand editor" GIBT ES DEN PIN NICHT: die Seitenleiste fuehrt
   Orte, zu denen man zurueckkehrt. Eine einzelne KI-Antwort ist das Ergebnis eines Laufs, und
   der Editor ist eine Ansicht auf eine Marke -- die Marke selbst ist anheftbar.

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
  /* ---- Wo es kein Anheften gibt (07.09. angefordert) ----
     Die Seitenleiste fuehrt ORTE, zu denen man zurueckkehrt. Zwei Typen sind keine:
       response       das Ergebnis eines Laufs, kein Ort.
       brand editor   eine ANSICHT auf eine Marke, nicht die Marke. Die ist selbst anheftbar,
                      und von hier aus anzuheften ergaebe einen zweiten Weg zu demselben
                      Eintrag -- oder, schlimmer, einen zweiten Eintrag daneben.
     Eine Liste und nicht zwei ODER-Vergleiche: ein dritter Fall ist dann eine Zeile hier und
     sonst nichts. */
  var OHNE_PIN = { response: 1, "brand editor": 1 };
  /* ---- Wo es den Mira-Knopf gibt (11.09. angefordert) ----
     Er haengt die offene Entitaet als Bezug an Mira. Zuerst nur domain, am selben Tag um
     brand, prompt und url erweitert -- genau die vier Typen, die Miras eigene Suche kennt. Die
     Form des Bezugs je Typ steht in miraBezug() darunter.
     NICHT bei brand editor und response: der Editor ist eine Ansicht auf eine Marke (die Marke
     selbst hat den Knopf), und eine einzelne Antwort ist kein Bezug, den Miras Suche fuehrt --
     ein Bezug, den man ueber das Plus nicht waehlen kann, haette kein Format fuer den Agenten. */
  var MIT_MIRA = { domain: 1, brand: 1, prompt: 1, url: 1 };
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
    /* Der Markt, zweistellig. Er steht NUR fuer eine Sache da: beim Anheften eines Prompts ist
       die Flagge des Marktes das Bild in der Seitenleiste -- so macht es Quick Actions, und
       gemeldet wurde am 08.09., dass die zwei Wege unterschiedlich aussehen. In der Brotkrume
       dieser Leiste bleibt beim Prompt das zap: dort sagt das Zeichen, WAS es ist, in der
       Seitenleiste sagt die Flagge, WELCHER Prompt. */
    function markt() { return feld("market", "data-market"); }

    var elType, elLogo, elName, elEdit, elDomain, elPin, elPrompt, elMira;
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
        /* Nur bei einer KI-Antwort, und links vom Pin (so angefordert): der Weg zurueck zum
           Prompt, der sie erzeugt hat. Dasselbe zap wie im Prompts-Seitenkopf und wie vor dem
           Namen einer Prompt-Zeile -- damit ist ohne Beschriftung zu sehen, wohin es geht. */
        '<button type="button" class="up-iconbtn utb-prompt" data-utb-prompt hidden ' +
          'data-tip="' + esc(UC.t("Go to parent prompt")) + '" ' +
          'aria-label="' + esc(UC.t("Go to parent prompt")) + '">' +
          UC.icon("zap", 2) + '</button>' +
        /* Mira: dasselbe Zeichen wie der Mira-Punkt in der Seitenleiste (blend), damit ohne
           Beschriftung zu sehen ist, wohin es geht. LINKS vom Pin, so angefordert. */
        '<button type="button" class="up-iconbtn utb-mira" data-utb-mira hidden ' +
          'data-tip="' + esc(UC.t("Ask Mira about this")) + '" ' +
          'aria-label="' + esc(UC.t("Ask Mira about this")) + '">' +
          UC.icon("blend", 2) + '</button>' +
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
      elPrompt = root.querySelector("[data-utb-prompt]");
      elMira = root.querySelector("[data-utb-mira]");
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
      /* ANHEFTEN NUR, WO ES EINEN ORT GIBT -- welche Typen keiner sind, steht bei OHNE_PIN
         oben, mit der Begruendung je Typ.
         OHNE laedt, anders als beim Stift und beim Globus: der Pin ist sonst IMMER bedienbar,
         auch im Ladezustand (so gebaut und so geprueft -- er haengt an nichts, was geladen
         werden muesste). Steht der Typ schon fest, ist er trotzdem gleich weg, statt einmal
         aufzublitzen. */
      elPin.hidden = !!OHNE_PIN[t];
      /* Der Weg zum uebergeordneten Prompt gibt es nur bei einer KI-Antwort -- sie ist das
         einzige Element, das einen Prompt UEBER sich hat. Im Ladezustand weg, wie Stift und
         Globus: welcher Typ kommt, weiss die Leiste da noch nicht. */
      elPrompt.hidden = laedt || (t !== "response");
      /* Der Mira-Knopf nur, wenn der Bezug VOLLSTAENDIG ist -- miraBezug() entscheidet das, an
         einer Stelle: bei der Domain reicht der Name, Marke und Prompt brauchen zusaetzlich ihre
         Kennung, die URL ihre Adresse. Ein Knopf, dessen Klick nichts tut, waere schlimmer als
         keiner. Im Ladezustand weg, aus demselben Grund wie Stift und Globus. */
      if (elMira) elMira.hidden = laedt || !miraBezug();
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
      ["type", "name", "logo", "market"].forEach(function (k) {
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
      if (t.closest("[data-utb-prompt]")) {
        fire("data-prompt-fn", "utbPrompt", { type: typ(), item_id: itemId() });
        return;
      }
      if (t.closest("[data-utb-pin]")) { anheften(); return; }
      if (t.closest("[data-utb-mira]")) { zuMira(); return; }
    });

    /* ---- Mira (11.09. angefordert) ----
       Drei Dinge, in dieser Reihenfolge:
         1. Der Bezug geht an Mira. Ist Mira auf der Seite, direkt ueber askMiraAddReference.
            Ist sie es NICHT, ueber den sessionStorage: Bubble schaltet auf view=mira, und je
            nach Aufbau der Seite ist das ein Seitenwechsel -- ein Aufruf ins Leere waere dann
            verloren. Mira liest den Eintrag beim Start und loescht ihn.
            NUR EINER der beiden Wege: mit beiden kaeme der Bezug bei Mira zweimal an, und ein
            Eintrag im Speicher, den niemand abholt, stuende beim naechsten Laden einer ganz
            anderen Seite wieder im Feld.
         2. Das Ereignis an Bubble. Drawer schliessen und auf view=mira schalten KANN nur Bubble:
            die Drawer sind Bubble-Gruppen, und eine URL-Aenderung per JavaScript bemerkt Bubble
            nicht -- es liest die Parameter beim Seitenaufbau und bei seinem eigenen "Go to
            page". Also dasselbe Muster wie Schliessen, Stift und Globus: ein Ereignis, und der
            Workflow tut den Rest.
         3. Nichts weiter hier. Den Ausgangszustand in Mira (Startschirm, leeres Feld, Fokus)
            stellt askMiraAddReference selbst her -- an einer Stelle, nicht an zweien. */
    /* DIE FORM JE TYP ist die eines Treffers aus Miras Suche (UC.entityItems) -- dieselben
       Felder, die UC.entityId, UC.entityLabel und UC.entityBild lesen. So entsteht dieselbe
       Pille und dieselbe Zeile fuer den Agenten, als haette der Nutzer den Eintrag ueber das Plus
       gewaehlt:
         brand   id = Kennung,  name = Name,         logo = Logo       -> "- Brand: N (uid: …)"
         prompt  id = Kennung,  prompt_text = Text,  market = Markt    -> "- Prompt: "…" (uid: …)"
         domain  domain = Name, favicon = Bild                         -> "- Domain: adac.de"
         url     url = Kennung, title = Name,        favicon = Bild    -> "- URL: … (Titel)"
       Bei der URL ist data-item-id die ADRESSE: die ist der Schluessel der Tabelle, und genau
       diesen Wert heftet der Pin schon heute an -- derselbe, den Quick Actions fuer eine URL
       anheftet (it.url). Der Name ist ihr Titel und keine Adresse.
       Fehlt, was der Typ braucht, gibt es keinen Bezug -- und damit keinen Knopf (render). */
    function miraBezug() {
      var t = typ(), n = name(), id = itemId();
      if (!MIT_MIRA[t] || !n) return null;
      if (t === "domain") return { type: "domain", domain: n, name: n, favicon: logo(),
                                   id: id || n };
      if (!id) return null;
      if (t === "brand")  return { type: "brand", id: id, name: n, logo: logo() };
      if (t === "prompt") return { type: "prompt", id: id, prompt_text: n, name: n,
                                   market: markt() };
      if (t === "url") {
        /* Eine Bubble-Kennung ("1712849302914x392") ist keine Adresse. Mit ihr stuende im Text an
           den Agenten "URL: 1712849302914x392" -- eine Zeile, mit der er nichts anfangen kann, und
           der Nutzer saehe davon nichts. Also kein Knopf, und die Konsole sagt einmal, warum. */
        if (!/[.\/]/.test(id)) {
          if (!state.urlGewarnt && window.console) console.warn("[drawer-topbar] data-item-id " +
            "ist bei einer URL keine Adresse (\"" + id + "\") -- der Mira-Knopf bleibt weg.");
          state.urlGewarnt = true;
          return null;
        }
        return { type: "url", url: id, title: n, name: n, favicon: logo() };
      }
      return null;
    }
    function zuMira() {
      var bezug = miraBezug();
      if (!bezug) return;
      /* 1. ALLE OFFENEN DRAWER ZU -- selbst, nicht ueber Bubble (11.09. gemeldet: "der Drawer
         schliesst sich nicht, der View wechselt nicht"). Die Host-App schliesst Drawer mit
         closeDrawer(art), und core weiss seit heute, welche offen sind. Der eigene Typ geht
         zusaetzlich mit: der Drawer, in dem diese Leiste steht, ist ganz sicher offen, auch wenn
         er geoeffnet wurde, bevor core openDrawer eingewickelt hatte. */
      try {
        if (UC.closeAllDrawers) UC.closeAllDrawers([typ()]);
        else if (typeof window.closeDrawer === "function") window.closeDrawer(typ());
      } catch (e) {}
      /* 2. DIE ANSICHT WECHSELN, mit dem Weg der App: showView("mira"). Das ist dieselbe
         Funktion, mit der die Host-App jede Ansicht umschaltet -- und core meldet den Wechsel
         ueber seine Einwicklung an alle Komponenten, die aufraeumen muessen. */
      try { if (typeof window.showView === "function") window.showView("mira"); } catch (e) {}
      /* 3. DER BEZUG AN MIRA. Nach dem Wechsel und nicht davor: ist Mira auf der Seite, steht sie
         jetzt sichtbar da, und der Fokus trifft ein sichtbares Feld. Ist sie es nicht, liegt der
         Bezug im sessionStorage und Mira holt ihn beim Start ab.
         Nur EINER der zwei Wege: mit beiden kaeme er zweimal an, und ein Eintrag, den niemand
         abholt, stuende beim naechsten Laden einer ganz anderen Seite wieder im Feld. */
      var wurzel = document.getElementById("ask-mira");
      var miraDa = !!(wurzel && wurzel.__askMiraInit) && typeof window.askMiraAddReference === "function";
      if (miraDa) {
        try { window.askMiraAddReference(bezug); } catch (e) {}
      } else {
        try { sessionStorage.setItem("am_pending_ref", JSON.stringify(bezug)); } catch (e) {}
      }
      /* Das Ereignis bleibt -- als Haken fuer alles, was Bubble zusaetzlich tun will. Noetig ist
         es nicht mehr: Drawer und Ansicht erledigt die Leiste oben selbst. */
      fire("data-mira-fn", "utbMira", { type: typ(), item_id: itemId(), name: name() });
    }

    /* ---- Anheften. Wortgleich die Uebergabe, die Quick Actions benutzt: Typ, Kennung,
       Beschriftung, Bild. Die Seitenleiste zeichnet daraus ihre Zeile, und weil die Kennung
       dieselbe ist, die auch in unseren Ereignissen steht, liefert ein Klick in der Leiste
       spaeter denselben Wert wie dieser Drawer. */
    function anheften() {
      /* Bei diesen Typen ist der Knopf gar nicht da (siehe render und OHNE_PIN). Diese Zeilen
         sind der Riegel dahinter: wer die Funktion auf einem anderen Weg erreicht, heftet
         nichts an eine Liste, die es nicht zeigen kann. Eine Liste, zwei Wirkungen -- und
         beide nennen denselben Grund. */
      if (OHNE_PIN[typ()]) {
        if (window.console) console.warn("[drawer-topbar] Typ \"" + typ() + "\" wird nicht an " +
          "die Seitenleiste geheftet -- die Leiste fuehrt Orte, zu denen man zurueckkehrt.");
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
      /* Das Bild fuer die Seitenleiste. Beim Prompt die Flagge seines Marktes, sonst das Logo
         oder Favicon -- genau die Zuordnung, die Quick Actions in pinToSidebar() trifft. Die
         Adresse kommt aus UC.flagUrl, der einen Quelle der App; hier eine zweite zu bauen war
         der Grund, warum die zwei Wege verschieden aussahen. */
      var bild = logo();
      if (typ() === "prompt" && markt() && UC.flagUrl) bild = UC.flagUrl(markt()) || bild;
      try { fn({ type: typ(), id: id, label: name() || id, logo: bild }); } catch (e) {}
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
        attributeFilter: ["data-type", "data-name", "data-logo", "data-item-id", "data-market"],
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
