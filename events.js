/* upstreem events.js -- Impact Events: Uebersicht und Event-Detail (02.10.).

   Ein Event ist ein Tag mit Kontext: eine Website ging neu online, ein Artikel erschien, eine
   Kampagne lief. Die Komponente zeigt, was es gibt (Uebersicht) und wie sich die bestehenden
   Kennzahlen um diesen Tag herum entwickelt haben (Detail). Sie rechnet NICHTS selbst: jede Zahl
   kommt aus den RPCs des Backend-Vertrags (bubble/events_backend_vertrag.md), und wo eine Zahl
   fehlt, steht ein Strich -- nie eine geschaetzte.

   ZWEI ZUSTAENDE, eine Komponente (Entscheidung 6 des Nutzers: der Kopf gehoert hinein):
     ?view=events                 Uebersicht -- Karten oder Liste, Suche, Typ-Filter
     ?view=events&event=<uuid>    Detail -- Kennzahlen, Verlauf, Markt, URLs, Umfang, Responses
   Die Adresse fuehrt: ?event= schreibt die Komponente selbst (pushState), Zurueck im Browser
   fuehrt zurueck, und ein Marker in einem fremden Diagramm oeffnet ueber UC.eventOeffnen.

   DATENWEGE (alles ueber Run-JS-Schritte, wie jede Komponente der App):
     Liste      der Event-Store in core (setUpstreemEvents) -- dieselbe Antwort fuettert die
                Marker in allen Liniendiagrammen. Diese Komponente liest nur.
     Detail     setEventDetail(id, json)      get_impact_event_v1 (auch Antwort von Create/
                                              Update/Add-URL/Remove-URL)
                setEventAnalysis(id, json)    cached_impact_event_analysis_v1
                setEventScopePreview(id, json) preview_impact_event_scope_v1
                setEventDeleted(id, json)     delete_impact_event_v1
                setEventError(id?, message)   der message-Code einer fehlgeschlagenen RPC
     Ereignisse an Bubble tragen den FERTIGEN RPC-Body als Text ({"p_team": ..., ...}) -- der
     Workflow gibt ihn unveraendert als Body an den API Connector. Als Text und nicht als Objekt:
     makeFire schiebt einem Objekt team_id vorn ein, und PostgREST lehnt einen Parameter ab, den
     die Funktion nicht kennt.

   Was fehlt, sagt die Oberflaeche ausdruecklich: unlesbare Antwort -> Fehlerzustand, keine Daten
   -> Leerzustand, noch nicht da -> Skelett. Die drei sehen nie gleich aus. */
(function () {
  "use strict";

  /* ---- Boot-Stubs (STYLEGUIDE §25), VOR der core-Pruefung ---------------------------------- */
  var API_NAMES = ["setEventDetail", "setEventAnalysis", "setEventScopePreview", "setEventError",
                   "setEventDeleted", "setEventsLoading", "resetEvents"];
  var Q = (window.__uevBootQueue = window.__uevBootQueue || []);
  API_NAMES.forEach(function (n) {
    if (!window[n]) window[n] = function () { Q.push([n, [].slice.call(arguments)]); };
  });

  function uevBoot(triesLeft) {
    if (!window.UpstreemCore) {
      if (triesLeft > 0) { setTimeout(function () { uevBoot(triesLeft - 1); }, 100); return; }
      if (window.console) console.error("UpstreemCore (core.js) not loaded");
      return;
    }
    uevStart();
  }

  function uevStart() {
  var UC = window.UpstreemCore;
  var esc = UC.esc, t = UC.t || function (x) { return x; };
  var STORE = (window.__uevStore = window.__uevStore || {});

  /* ---- Kleine Helfer -------------------------------------------------------------------------- */
  function isArr(v) { return Object.prototype.toString.call(v) === "[object Array]"; }
  function num(v) { if (v == null || v === "") return null; var n = Number(v); return isFinite(n) ? n : null; }
  /* Ein Objekt aus Bubble-Text. readBubble (nicht parseLoose): die Antworten tragen Emojis im Feld
     icon, und parseLoose scheitert an Emojis. readBubble gibt fuer Text eine Liste -- ein Objekt
     kommt als ihr erstes Element. */
  function objekt(raw) {
    var v = UC.readBubble ? UC.readBubble(raw) : null;
    if (isArr(v)) v = v.length ? v[0] : null;
    return v && typeof v === "object" ? v : null;
  }
  function team() { try { return (UC.getTeam && UC.getTeam()) || ""; } catch (e) { return ""; } }
  function body(o) {
    var b = { p_team: team() };
    for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) b[k] = o[k];
    return JSON.stringify(b);
  }
  function ersetze(s, o) { return String(s).replace(/\{(\w+)\}/g, function (_, k) { return o[k] != null ? o[k] : ""; }); }
  function tagMs(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ""));
    return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : NaN;
  }
  function isoAus(ms) { return new Date(ms).toISOString().slice(0, 10); }
  /* Der heutige Tag als Kalendertag. Der Vertrag rechnet im Berliner Tag; im Browser zaehlt der
     Tag des Nutzers -- fuer das Ende des Responses-Fensters reicht das, die Analyse begrenzt
     ohnehin selbst auf "heute". */
  function heuteIso() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function pct(v) { v = num(v); return v == null ? "–" : (UC.fmtPct ? UC.fmtPct(v, 1) : v.toFixed(1) + "%"); }
  function rang(v) { v = num(v); return v == null ? "–" : (UC.fmt1 ? UC.fmt1(v) : v.toFixed(1)); }
  function sent(v) { v = num(v); return v == null ? "–" : (UC.fmtInt ? UC.fmtInt(v) : String(Math.round(v))); }
  function datum(s) { return s ? (UC.fmtDate ? UC.fmtDate(String(s).slice(0, 10)) : String(s).slice(0, 10)) : "–"; }
  function zahl(v) { v = num(v); return v == null ? "–" : (UC.fmtInt ? UC.fmtInt(v) : String(Math.round(v))); }

  /* Typ, Zeichen, Farbe eines Events. Das Zeichen aus dem Typ -- NIE das Feld icon der Datenbank,
     solange es kein bekannter Zeichenname ist: dort stehen Emojis, und Emojis gehoeren nicht in
     die Oberflaeche (Entscheidung 1). */
  function typ(ev) { return UC.eventTyp ? UC.eventTyp(ev && ev.event_type) : { key: "other", label: "Other", icon: "pin", gruppe: "other" }; }
  var ZEICHEN = {};
  (UC.EVENT_TYPEN || []).forEach(function (x) { ZEICHEN[x.icon] = 1; });
  function zeichen(ev) {
    var ic = ev && ev.icon;
    return ic && ZEICHEN[ic] ? ic : typ(ev).icon;
  }
  function farbe(ev) {
    var c = ev && ev.color;
    return c && /^#[0-9a-f]{6}$/i.test(String(c)) ? String(c) : "";
  }
  /* Die Umfangszeile, genau nach dem Vertrag (3.1): "3 Topics · 24 Prompts · 5 URLs", bei "all"
     "All active Prompts · 61 Prompts". Ohne URLs faellt der Teil weg statt "0 URLs" zu sagen
     (Spezifikation 15). */
  function umfang(ev) {
    var teile = [];
    if (ev.scope_mode === "all") teile.push(t("All active Prompts"));
    else if (num(ev.selected_topic_count) != null) teile.push(ersetze(t(num(ev.selected_topic_count) === 1 ? "{n} Topic" : "{n} Topics"), { n: zahl(ev.selected_topic_count) }));
    if (num(ev.affected_prompt_count) != null) teile.push(ersetze(t(num(ev.affected_prompt_count) === 1 ? "{n} Prompt" : "{n} Prompts"), { n: zahl(ev.affected_prompt_count) }));
    var u = num(ev.affected_url_count != null ? ev.affected_url_count : (isArr(ev.urls) ? ev.urls.length : null));
    if (u) teile.push(ersetze(t(u === 1 ? "{n} URL" : "{n} URLs"), { n: zahl(u) }));
    return teile.join(" · ");
  }
  function hostPfad(url) {
    try {
      var u = new URL(String(url));
      return { host: u.hostname.replace(/^www\./, ""), pfad: (u.pathname || "/") + (u.search || "") };
    } catch (e) { return { host: String(url || ""), pfad: "" }; }
  }
  function favicon(url) {
    var h = hostPfad(url).host;
    return h ? "https://www.google.com/s2/favicons?domain=" + encodeURIComponent(h) + "&sz=64" : "";
  }

  /* Die Analysefenster des Vertrags (3.9): Presets 7 / 30 / 90 / 180 Tage, Standard 30.
     Entscheidung 2: ein Segment, kein Kalender -- ein freier Zeitraum ist hier nicht gefragt. */
  var FENSTER = [7, 30, 90, 180];
  var METRIKEN = [
    { key: "visibility", label: "Visibility" },
    { key: "rank", label: "Rank" },
    { key: "sentiment", label: "Sentiment" }
  ];

  /* Die Fehler-Codes des Vertrags (Tabelle 4) als Satz fuer den Nutzer. Nie der Code selbst,
     nie ein Funktionsname -- unbekanntes ist "Something went wrong". */
  var FEHLER = {
    "not authenticated": "Please sign in again.",
    "forbidden": "You don't have permission to do that.",
    "impact_event_rate_limited": "Too many requests. Please wait a moment and try again.",
    "impact_event_name_required": "Please enter a name.",
    "impact_event_invalid_date": "The date must be within the last 6 months.",
    "impact_event_topics_required": "Please select at least one topic.",
    "impact_event_invalid_topics": "One of the topics is no longer available.",
    "impact_event_no_active_prompts": "The selection contains no active prompts.",
    "impact_event_invalid_url": "Please enter a valid URL.",
    "impact_event_url_duplicate": "This URL is already part of the event.",
    "impact_event_too_many_urls": "An event can have at most 100 URLs.",
    "impact_event_not_found": "This event no longer exists.",
    "impact_event_url_not_found": "This URL is no longer part of the event."
  };
  function fehlerText(code) {
    var c = String(code == null ? "" : code).trim();
    if (/^team_access_/.test(c)) return t("Your team doesn't have access right now.");
    return t(FEHLER[c] || "Something went wrong. Please try again.");
  }

  /* DER KATALOG IST EINER FUER DIE GANZE APP. Ein Schluessel, den core schon kennt, steht hier
     NICHT noch einmal: addMessages ueberschreibt ihn ueberall. So hatte Teil 2 "Brand" zu "Marke",
     "Overview" zu "Übersicht" und "Event" zu "Event" gemacht -- das letzte stellte die Spalte
     "Ereignis" im Aktivitaetsprotokoll der Teams um. Vor jedem neuen Eintrag in core.js suchen. */

  if (UC.addMessages) UC.addMessages("de", {
    "Track important changes and understand how AI performance develops around them.":
      "Halte wichtige Änderungen fest und sieh, wie sich die AI Performance um sie herum entwickelt.",
    "Create event": "Event anlegen", "Search events…": "Events durchsuchen…", "Search events": "Events durchsuchen",
    "Event type": "Event-Typ", "Cards": "Karten",
    "No events yet": "Noch keine Events",
    "Add important launches, content changes, campaigns or other changes to understand how your AI performance develops around them.":
      "Lege wichtige Launches, Content-Änderungen, Kampagnen oder andere Änderungen an, um zu sehen, wie sich deine AI Performance um sie herum entwickelt.",
    "events": "Events",
    "All active Prompts": "Alle aktiven Prompts", "{n} Topic": "{n} Topic", "{n} Topics": "{n} Topics",
    "{n} Prompt": "{n} Prompt", "{n} Prompts": "{n} Prompts", "{n} URL": "{n} URL", "{n} URLs": "{n} URLs",
    "Scope": "Umfang", "Add URL": "URL hinzufügen",
    "Analysis window": "Analysefenster",
    "Performance around event": "Performance rund um das Event",
    "How your brand developed in the affected prompts before and after the event.":
      "Wie sich deine Marke in den betroffenen Prompts vor und nach dem Event entwickelt hat.",
    "Affected prompts": "Betroffene Prompts",
    "Market movement": "Marktbewegung",
    "Visibility of every tracked brand in the affected prompts, before and after.":
      "Visibility jeder getrackten Marke in den betroffenen Prompts, vorher und nachher.",
    "Before": "Vorher", "After": "Nachher", "Change": "Veränderung",
    "Newly tracked": "Neu getrackt", "Unchanged": "Unverändert",
    "Affected URLs": "Betroffene URLs",
    "Pages, articles or external sources associated with this event. Global share is measured in the affected prompts.":
      "Seiten, Artikel oder externe Quellen zu diesem Event. Der Global Share zählt in den betroffenen Prompts.",
    "Observation": "Beobachtung", "Global share before": "Global Share vorher", "Global share after": "Global Share nachher",
    "Observed on event day": "Am Event-Tag beobachtet",
    "First observed after event · {date} · day {n}": "Erstmals beobachtet nach Event · {date} · Tag {n}",
    "Still cited · from day {n}": "Weiter zitiert seit Tag {n}",
    "Not observed since event": "Seit dem Event noch nicht beobachtet",
    "Not observed within 6 months": "In 6 Monaten nach dem Event nicht beobachtet",
    "Open the response with the first observation": "Response mit der ersten Beobachtung öffnen",
    "View responses": "Responses ansehen",
    "No URLs added yet": "Noch keine URLs",
    "Add pages, articles or external sources associated with this event.":
      "Füge Seiten, Artikel oder externe Quellen zu diesem Event hinzu.",
    "Event scope": "Umfang des Events", "Affected topics": "Betroffene Topics",
    "{n} affected Prompts": "{n} betroffene Prompts",
    "All active Prompts at event creation": "Alle aktiven Prompts beim Anlegen",
    "{n} comparison Prompts are used as a workspace benchmark.": "{n} Vergleichs-Prompts dienen als Benchmark im Workspace.",
    "Upstreem compares the affected Prompts with other eligible Prompts that were active when this event was created.":
      "Upstreem vergleicht die betroffenen Prompts mit anderen passenden Prompts, die beim Anlegen des Events aktiv waren.",
    "No comparison benchmark available": "Kein Vergleichs-Benchmark verfügbar",
    "Responses citing affected URLs": "Responses mit betroffenen URLs",
    "Tracked AI responses that cite one or more URLs associated with this event.":
      "Getrackte AI-Antworten, die eine oder mehrere URLs dieses Events zitieren.",
    "All affected URLs": "Alle betroffenen URLs",
    "Still running · data until {date}": "Läuft noch · Daten bis {date}",
    "Limited baseline ({n} days)": "Begrenzte Vergleichsbasis ({n} Tage)",
    "Less historical data is available before this event for the selected period.":
      "Vor diesem Event gibt es für den gewählten Zeitraum weniger historische Daten.",
    "No comparable data yet": "Noch keine vergleichbaren Daten",
    "{n} other event in this period": "{n} weiteres Event in diesem Zeitraum",
    "{n} other events in this period": "{n} weitere Events in diesem Zeitraum",
    "{n} Prompts only after the event, shown in the trend only": "{n} Prompts erst nach dem Event, nur im Verlauf",
    "{n} Prompts deleted since": "{n} Prompts inzwischen gelöscht",
    "vs. comparison {d}": "vs. Vergleich {d}",
    "This event could not be loaded.": "Dieses Event konnte nicht geladen werden.",
    "Back to overview": "Zurück zur Übersicht",
    "Delete event": "Event löschen", "Delete this event?": "Dieses Event löschen?",
    "The event, its scope and its URL list are removed. Prompt history, citations and responses stay untouched.":
      "Das Event, sein Umfang und seine URL-Liste werden entfernt. Prompt-Verlauf, Zitate und Responses bleiben unberührt.",
    "Remove URL": "URL entfernen", "Remove this URL from the event?": "Diese URL aus dem Event entfernen?",
    "Only the link to this event is removed. The URL and its citations stay untouched.":
      "Nur die Zuordnung zu diesem Event wird entfernt. Die URL und ihre Zitate bleiben unberührt.",
    "Please sign in again.": "Bitte neu anmelden.",
    "You don't have permission to do that.": "Dafür fehlt dir die Berechtigung.",
    "Too many requests. Please wait a moment and try again.": "Zu viele Anfragen. Bitte kurz warten und erneut versuchen.",
    "Please enter a name.": "Bitte einen Namen eingeben.",
    "The date must be within the last 6 months.": "Das Datum muss in den letzten 6 Monaten liegen.",
    "Please select at least one topic.": "Bitte mindestens ein Topic wählen.",
    "One of the topics is no longer available.": "Ein Topic ist nicht mehr verfügbar.",
    "The selection contains no active prompts.": "Die Auswahl enthält keine aktiven Prompts.",
    "Please enter a valid URL.": "Bitte eine gültige URL eingeben.",
    "This URL is already part of the event.": "Diese URL ist bereits im Event.",
    "An event can have at most 100 URLs.": "Maximal 100 URLs pro Event.",
    "This event no longer exists.": "Dieses Event existiert nicht mehr.",
    "This URL is no longer part of the event.": "Diese URL gehört nicht mehr zum Event.",
    "Your team doesn't have access right now.": "Dein Team hat gerade keinen Zugang.",
    /* Die Popups (Teil 3) */
    "Optional": "Optional", "Select a date": "Datum wählen", "Default color": "Standardfarbe",
    "Event icon": "Event-Symbol", "Event color": "Event-Farbe", "e.g. Website relaunch": "z. B. Website-Relaunch",
    "What changed?": "Was hat sich geändert?", "Description": "Beschreibung", "Selected topics": "Ausgewählte Topics",
    "Affected scope": "Betroffener Umfang", "Edit event": "Event bearbeiten",
    "Search your URLs or paste a link": "Eigene URLs durchsuchen oder Link einfügen",
    "The event date and affected scope can't be changed after creation.":
      "Datum und Umfang des Events lassen sich nach dem Anlegen nicht mehr ändern.",
    "The event date and affected scope can't be changed.": "Datum und Umfang des Events lassen sich nicht ändern.",
    "Step {n} of 3": "Schritt {n} von 3", "URLs & review": "URLs & Prüfen",
    "Select at least one topic.": "Mindestens ein Topic wählen.", "Counting prompts…": "Prompts werden gezählt…",
    "The number of prompts could not be loaded.": "Die Zahl der Prompts konnte nicht geladen werden.",
    "{n} prompt will be included in this event.": "{n} Prompt gehört zu diesem Event.",
    "{n} prompts will be included in this event.": "{n} Prompts gehören zu diesem Event.",
    "{n} active prompt included": "{n} aktiver Prompt enthalten", "{n} active prompts included": "{n} aktive Prompts enthalten",
    "Already in this event": "Schon im Event", "Added": "Hinzugefügt", "Add as new target": "Als neues Ziel hinzufügen",
    "Previously observed": "Bereits beobachtet", "New target": "Neues Ziel",
    "No matching URLs. Paste a full link to add it as a new target.":
      "Keine passenden URLs. Füge einen vollständigen Link ein, um ihn als neues Ziel hinzuzufügen.",
    "{n} of {max} URLs": "{n} von {max} URLs", "{n} URL target": "{n} URL-Ziel", "{n} URL targets": "{n} URL-Ziele",
    "No URL targets": "Keine URL-Ziele",
    "Search is not available right now. You can still paste a full link.":
      "Die Suche ist gerade nicht verfügbar. Ein vollständiger Link lässt sich trotzdem einfügen.",
    "This is taking longer than expected. Please try again.": "Das dauert länger als erwartet. Bitte erneut versuchen.",
    "Event created": "Event angelegt", "URL added": "URL hinzugefügt", "Event updated": "Event aktualisiert",
    "Observations are counted from the event date, also for URLs you add now.":
      "Beobachtungen zählen ab dem Event-Datum, auch für URLs, die du jetzt hinzufügst."
  });

  /* Spaltenzahl der Karten: nach dem PLATZ (wie response-detail.spalten -- dieselben Schwellen,
     dieselbe Begruendung: ein springendes Raster ist schlimmer als eine kurze letzte Reihe). */
  function spalten(breite, anzahl) {
    if (anzahl <= 1) return 1;
    var max = breite >= 1308 ? 4 : breite >= 976 ? 3 : breite >= 664 ? 2 : 1;
    return Math.max(1, Math.min(max, anzahl));
  }

  /* ============================================================================================
     Eine Wurzel
     ============================================================================================ */
  function initRoot(root) {
    if (root.__uevController) return root.__uevController;
    var instanceId = root.getAttribute("data-instance") || "default";
    if (/^[A-Z_]{4,}$/.test(instanceId)) return null;   /* Platzhalter noch nicht ersetzt */

    var fire = UC.makeFire(root, { label: "events", eventPrefix: "uev" });
    function isDark() { return UC.themeParam(root.getAttribute("data-isdark")) || root.getAttribute("data-theme") === "dark"; }
    if (isDark()) root.setAttribute("data-theme", "dark"); else root.removeAttribute("data-theme");
    var tips = UC.makeTooltips ? UC.makeTooltips(root, isDark) : null;
    if (UC.widthTiers) UC.widthTiers(root, { narrowAt: 760, vnarrowAt: 520 });
    var respInstanz = String(root.getAttribute("data-responses-instance") || "responses_events").trim();

    /* Der Stand dieser Instanz ueberlebt einen Neuaufbau durch Bubble (Themenwechsel baut das
       Element neu) -- dasselbe Muster wie response-detail. */
    var saved = STORE[instanceId] || null;
    function gemerkt(k, sonst) { return saved && saved[k] != null ? saved[k] : sonst; }
    var DARST_KEY = "uevDarstellung__" + instanceId;
    var state = {
      ansicht: "uebersicht", eventId: null,
      suche: gemerkt("suche", ""), typen: gemerkt("typen", []),
      darstellung: (function () {
        var v = null;
        try { v = UC.prefGet ? UC.prefGet(UC.prefKey ? UC.prefKey(DARST_KEY) : DARST_KEY) : null; } catch (e) {}
        return v === "list" ? "list" : "cards";
      })(),
      detail: gemerkt("detail", {}), detailLaden: false, detailFehler: false,
      analyse: gemerkt("analyse", {}), analyseLaden: false, analyseFehler: false,
      fenster: gemerkt("fenster", 30), metrik: gemerkt("metrik", "visibility"),
      modelle: gemerkt("modelle", null), maerkte: gemerkt("maerkte", null),
      respUrl: "", geloescht: {}
    };
    function persist() {
      if (root.isConnected === false) return;
      STORE[instanceId] = { suche: state.suche, typen: state.typen, detail: state.detail, analyse: state.analyse,
        fenster: state.fenster, metrik: state.metrik, modelle: state.modelle, maerkte: state.maerkte };
    }
    function dieDetail() { return state.eventId ? state.detail[state.eventId] || null : null; }
    function analyseSig() { return [state.eventId, state.fenster, (state.modelle || []).join(","), (state.maerkte || []).join(",")].join("|"); }
    function dieAnalyse() { return state.analyse[analyseSig()] || null; }
    function listeEvent(id) {
      var l = UC.getEvents ? UC.getEvents() : [];
      for (var i = 0; i < l.length; i++) if (String(l[i].id) === String(id)) return l[i];
      return null;
    }

    /* ---- Seitenkopf ------------------------------------------------------------------------ */
    root.classList.add("up-sidebar-clear");
    root.innerHTML =
      '<div class="up-ph-top uev-pagehead">' +
        '<div class="up-ph-left">' +
          '<h1 class="up-ph-heading">' + esc(t("Events")) + '</h1>' +
          '<p class="up-ph-desc" data-i18n="Track important changes and understand how AI performance develops around them.">' +
            esc(t("Track important changes and understand how AI performance develops around them.")) + '</p>' +
        '</div>' +
        '<div class="uev-kopfaktion"></div>' +
      '</div>' +
      '<div class="uev-main"></div>';
    var elMain = root.querySelector(".uev-main"), elAktion = root.querySelector(".uev-kopfaktion");
    var krumen = UC.makePageCrumbs ? UC.makePageCrumbs(root, {
      icon: "flag", name: "Events", komponente: true,
      klick: function () { zurUebersicht(true); },
      klickWenn: function () { return state.ansicht === "detail"; },
      stufen: function () {
        if (state.ansicht !== "detail") return [{ name: "Overview", uebersetzen: true }];
        var d = dieDetail() || listeEvent(state.eventId);
        return [{ name: "Overview", uebersetzen: true, klick: function () { zurUebersicht(true); } },
                { name: d ? d.name : "…" }];
      }
    }) : null;
    function krumenNeu() { if (krumen && krumen.zeichnen) krumen.zeichnen(); }

    /* ---- Adresse --------------------------------------------------------------------------- */
    function adresseEvent() {
      try { return new URLSearchParams(window.location.search).get("event") || ""; } catch (e) { return ""; }
    }
    function adresseSetzen(id, neuerEintrag) {
      try {
        var u = new URL(window.location.href);
        if (id) u.searchParams.set("event", id); else u.searchParams.delete("event");
        var neu = u.pathname + u.search + u.hash;
        if (neu === window.location.pathname + window.location.search + window.location.hash) return;
        if (neuerEintrag) window.history.pushState(window.history.state, "", neu);
        else window.history.replaceState(window.history.state, "", neu);
      } catch (e) {}
    }

    /* ============================================================================================
       Uebersicht
       ============================================================================================ */
    var elListe = null, elZahl = null, elSucheIn = null, elSuche = null, sucheKit = null, typPop = null;
    function baueUebersicht() {
      elAktion.innerHTML =
        '<button class="up-ph-addbtn up-export uev-anlegen" type="button">' + UC.icon("plus", 1.8) +
          '<span data-i18n="Create event">' + esc(t("Create event")) + '</span></button>';
      elMain.innerHTML =
        '<div class="up-head uev-head">' +
          '<span class="up-heading"><span class="up-head-label">' + esc(t("Events")) + '</span>' +
            '<span class="up-head-sep"></span><span class="up-head-count uev-zahl"></span></span>' +
          '<div class="up-head-tools">' +
            '<div class="up-search uev-suche">' +
              '<button type="button" class="up-iconbtn up-search-btn" aria-label="' + esc(t("Search")) + '" data-tip="' + esc(t("Search")) + '">' + UC.icon("search", 2) + '</button>' +
              '<div class="up-search-box">' +
                '<input class="up-search-input" type="text" placeholder="' + esc(t("Search events…")) + '" autocomplete="off" spellcheck="false" aria-label="' + esc(t("Search events")) + '"/>' +
                '<button type="button" class="up-search-clear" aria-label="' + esc(t("Clear search")) + '">' + UC.icon("x", 2.2) + '</button>' +
              '</div>' +
            '</div>' +
            '<div class="up-filter uev-typfilter">' +
              '<button type="button" class="up-iconbtn uev-typbtn" aria-label="' + esc(t("Event type")) + '" data-tip="' + esc(t("Event type")) + '">' +
                UC.icon("listFilter", 2) + '<span class="up-badge uev-typbadge"></span></button>' +
              '<div class="up-menu uev-typmenu" role="menu" aria-hidden="true"></div>' +
            '</div>' +
            '<div class="up-seg uev-darst" role="group" aria-label="' + esc(t("View")) + '">' +
              '<button class="up-seg-btn" type="button" data-darst="cards" data-tip="' + esc(t("Cards")) + '" aria-label="' + esc(t("Cards")) + '">' + UC.icon("card", 2) + '</button>' +
              '<button class="up-seg-btn" type="button" data-darst="list" data-tip="' + esc(t("List")) + '" aria-label="' + esc(t("List")) + '">' + UC.icon("listIcon", 2) + '</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="uev-liste"></div>';
      elListe = elMain.querySelector(".uev-liste");
      elZahl = elMain.querySelector(".uev-zahl");
      respSichtbar(false);
      elSuche = elMain.querySelector(".uev-suche");
      elSucheIn = elMain.querySelector(".up-search-input");
      elSucheIn.value = state.suche || "";
      if (state.suche) elSuche.classList.add("is-open", "has-text");
      sucheKit = UC.makeSearch ? UC.makeSearch({
        root: root, box: elSuche, input: elSucheIn, state: { query: state.suche, page: 1 },
        prefix: "uev", mobileMax: 560, onRender: function () {}, onFire: function () {}
      }) : null;
      elSucheIn.addEventListener("input", function () {
        state.suche = elSucheIn.value || "";
        elSuche.classList.toggle("has-text", !!state.suche);
        persist(); renderListe();
      });
      elSucheIn.addEventListener("keydown", function (e) { if (e.key === "Escape" && sucheKit) { e.stopPropagation(); sucheKit.toggle(); } });
      elMain.querySelector(".up-search-btn").addEventListener("click", function (e) { e.stopPropagation(); if (sucheKit) sucheKit.toggle(); else elSuche.classList.toggle("is-open"); });
      elMain.querySelector(".up-search-clear").addEventListener("click", function (e) {
        e.stopPropagation();
        elSucheIn.value = ""; state.suche = ""; elSuche.classList.remove("has-text");
        persist(); renderListe();
      });
      var wrap = elMain.querySelector(".uev-typfilter"), menu = elMain.querySelector(".uev-typmenu");
      typPop = UC.makePopover ? UC.makePopover({ wrap: wrap, menu: menu, opener: wrap.querySelector(".uev-typbtn") }) : null;
      wrap.querySelector(".uev-typbtn").addEventListener("click", function (e) { e.stopPropagation(); typMenu(); if (typPop) typPop.toggle(); });
      menu.addEventListener("click", function (e) {
        var it = e.target.closest("[data-typ]");
        if (it) {
          var k = it.getAttribute("data-typ"), i = state.typen.indexOf(k);
          if (i >= 0) state.typen.splice(i, 1); else state.typen.push(k);
        } else if (e.target.closest("[data-typ-alle]")) state.typen = [];
        else return;
        persist(); typMenu(); renderListe();
      });
      elMain.querySelector(".uev-darst").addEventListener("click", function (e) {
        var b = e.target.closest("[data-darst]");
        if (!b) return;
        state.darstellung = b.getAttribute("data-darst");
        try { if (UC.prefSet) UC.prefSet(UC.prefKey ? UC.prefKey(DARST_KEY) : DARST_KEY, state.darstellung); } catch (err) {}
        renderListe();
      });
      renderListe();
    }
    /* Das Typ-Menue zeigt nur Typen, die es in der Liste gibt -- ein Filter auf einen Typ ohne
       Event ist ein toter Eintrag. Ein gewaehlter Typ bleibt drin, auch wenn er gerade wegfiel. */
    function typMenu() {
      var menu = elMain && elMain.querySelector(".uev-typmenu");
      if (!menu) return;
      var da = {};
      (UC.getEvents ? UC.getEvents() : []).forEach(function (ev) { da[typ(ev).key] = 1; });
      state.typen.forEach(function (k) { da[k] = 1; });
      var typen = (UC.EVENT_TYPEN || []).filter(function (x) { return da[x.key]; });
      menu.innerHTML =
        '<div class="up-filter-list">' +
          typen.map(function (x) {
            var an = state.typen.indexOf(x.key) >= 0;
            return '<div class="up-filter-item uev-typitem' + (an ? " is-active" : "") + '" role="menuitemcheckbox" aria-checked="' + an + '" data-typ="' + esc(x.key) + '">' +
              '<span class="up-filter-check' + (an ? " is-on" : "") + '">' + (an ? UC.icon("check", 3) : "") + '</span>' +
              '<span class="uev-typitem-ic">' + UC.icon(x.icon, 2) + '</span>' +
              '<span class="uev-typitem-lbl" data-i18n="' + esc(x.label) + '">' + esc(t(x.label)) + '</span></div>';
          }).join("") +
        '</div>' +
        (state.typen.length ? '<div class="up-filter-item uev-typalle" data-typ-alle="1">' + esc(t("Clear filters")) + '</div>' : '');
      var badge = elMain.querySelector(".uev-typbadge");
      if (badge) { badge.textContent = state.typen.length ? String(state.typen.length) : ""; badge.classList.toggle("is-on", !!state.typen.length); }
    }
    function gefiltert() {
      var q = String(state.suche || "").trim().toLowerCase();
      var l = (UC.getEvents ? UC.getEvents() : []).filter(function (ev) {
        if (state.geloescht[ev.id]) return false;
        if (state.typen.length && state.typen.indexOf(typ(ev).key) < 0) return false;
        if (!q) return true;
        return (String(ev.name || "") + " " + String(ev.description || "")).toLowerCase().indexOf(q) >= 0;
      });
      /* Vertrag 3.1 sortiert schon so -- hier trotzdem: event_date absteigend, bei gleichem Tag die
         zuletzt angelegten zuerst. Ein rueckdatiertes Event steht damit an seinem echten Tag. */
      l.sort(function (a, b) {
        var d = tagMs(b.event_date) - tagMs(a.event_date);
        return d || String(b.created_at || "").localeCompare(String(a.created_at || ""));
      });
      return l;
    }
    /* Die Grafik einer Karte: eine von acht Varianten nach Typgruppe. Muster aus CSS (Raster,
       Linien, Punkte, Ringe ...) unter dem Zeichen des Typs auf einer Kachel -- das gaengige Muster
       fuer Vorlagen-Karten, kein gezeichnetes Bild (Entscheidung 4). Die Farbe des Events toent
       sie nur. */
    function kunst(ev, klein) {
      var f = farbe(ev);
      return '<div class="uev-kunst uev-kunst-' + esc(typ(ev).gruppe) + (klein ? " is-klein" : "") + '"' + (f ? ' style="--uev-ton:' + esc(f) + '"' : '') + ' aria-hidden="true">' +
        '<span class="uev-kunst-kachel">' + UC.icon(zeichen(ev), 2) + '</span></div>';
    }
    function mehrMenue(ev, wo) {
      var kannLoeschen = ev.can_delete === true;
      return '<span class="uev-mehr" data-mehr-wo="' + wo + '">' +
        '<button type="button" class="up-iconbtn uev-mehrbtn" aria-label="' + esc(t("More")) + '" data-tip="' + esc(t("More")) + '">' + UC.icon("moreHorizontal", 2) + '</button>' +
        '<div class="up-menu uev-mehrmenu" role="menu" aria-hidden="true">' +
          '<div class="up-filter-item" role="menuitem" data-aktion="edit" data-event-id="' + esc(ev.id) + '">' + UC.icon("squarePen", 2) + '<span>' + esc(t("Edit")) + '</span></div>' +
          (kannLoeschen ? '<div class="up-filter-item uev-gefahr" role="menuitem" data-aktion="delete" data-event-id="' + esc(ev.id) + '">' + UC.icon("trash", 2) + '<span>' + esc(t("Delete")) + '</span></div>' : '') +
        '</div></span>';
    }
    function karteHtml(ev) {
      var tp = typ(ev);
      return '<article class="uev-karte" role="link" tabindex="0" data-event-id="' + esc(ev.id) + '">' +
        kunst(ev) +
        '<div class="uev-karte-body">' +
          '<div class="uev-karte-oben">' +
            '<span class="uev-typ">' + UC.icon(zeichen(ev), 2) + '<span data-i18n="' + esc(tp.label) + '">' + esc(t(tp.label)) + '</span></span>' +
            mehrMenue(ev, "karte") +
          '</div>' +
          '<h3 class="uev-karte-titel">' + esc(ev.name || "") + '</h3>' +
          '<div class="uev-karte-datum">' + esc(datum(ev.event_date)) + '</div>' +
          (ev.description ? '<p class="uev-karte-text">' + esc(ev.description) + '</p>' : '') +
          '<div class="uev-karte-umfang">' + esc(umfang(ev)) + '</div>' +
        '</div>' +
      '</article>';
    }
    var LISTE_COLS = "56px minmax(220px, 1fr) minmax(120px, 160px) 120px minmax(150px, 220px) 72px";
    function zeileHtml(ev) {
      var tp = typ(ev);
      return '<div class="up-row is-dense uev-zeile" role="link" tabindex="0" data-event-id="' + esc(ev.id) + '">' +
        '<div class="up-td uev-td-kunst">' + kunst(ev, true) + '</div>' +
        '<div class="up-td uev-td-name"><span class="uev-zeile-titel">' + esc(ev.name || "") + '</span>' +
          (ev.description ? '<span class="uev-zeile-text">' + esc(ev.description) + '</span>' : '') + '</div>' +
        '<div class="up-td uev-td-typ"><span class="uev-typ">' + UC.icon(zeichen(ev), 2) + '<span data-i18n="' + esc(tp.label) + '">' + esc(t(tp.label)) + '</span></span></div>' +
        '<div class="up-td uev-td-datum">' + esc(datum(ev.event_date)) + '</div>' +
        '<div class="up-td uev-td-umfang">' + esc(umfang(ev)) + '</div>' +
        '<div class="up-td up-td-act uev-td-act">' + mehrMenue(ev, "zeile") +
          '<span class="uev-chev" aria-hidden="true">' + UC.icon("chevronRight", 2) + '</span></div>' +
      '</div>';
    }
    function renderListe() {
      if (!elListe) return;
      var stand = UC.eventsStand ? UC.eventsStand() : { geladen: true, fehler: false };
      var seg = elMain.querySelectorAll(".uev-darst [data-darst]");
      for (var i = 0; i < seg.length; i++) seg[i].classList.toggle("is-active", seg[i].getAttribute("data-darst") === state.darstellung);
      if (UC.segJetzt) { try { UC.segJetzt(elMain.querySelector(".uev-darst")); } catch (e) {} }
      typMenu();
      if (stand.fehler && !(UC.getEvents && UC.getEvents().length)) {
        elZahl.textContent = "";
        elListe.className = "uev-liste";
        elListe.innerHTML = UC.leseFehlerHtml ? UC.leseFehlerHtml("events") : "";
        return;
      }
      if (!stand.geladen) {
        elZahl.textContent = "";
        elListe.className = "uev-liste is-" + state.darstellung;
        elListe.innerHTML = state.darstellung === "list" ? listeSkelett() : karteSkelett();
        rasterSetzen(3);
        return;
      }
      var alle = (UC.getEvents ? UC.getEvents() : []).filter(function (ev) { return !state.geloescht[ev.id]; });
      var l = gefiltert();
      elZahl.textContent = alle.length ? String(l.length === alle.length ? alle.length : l.length + " / " + alle.length) : "";
      elListe.className = "uev-liste is-" + state.darstellung;
      if (!alle.length) {
        elListe.innerHTML = UC.leerHtml({ icon: "flag", titel: "No events yet",
          text: "Add important launches, content changes, campaigns or other changes to understand how your AI performance develops around them.",
          knopf: "Create event", knopfAttr: "data-uev-create" });
        return;
      }
      if (!l.length) {
        elListe.innerHTML = UC.leerHtml({ gefiltert: true, was: "events" });
        return;
      }
      if (state.darstellung === "list") {
        elListe.innerHTML = '<div class="up-box"><div class="up-table uev-tabelle" style="--up-cols:' + LISTE_COLS + '">' +
          '<div class="up-thead">' +
            '<div class="up-th"></div>' +
            '<div class="up-th"><span class="up-th-txt">' + esc(t("Name")) + '</span></div>' +
            '<div class="up-th"><span class="up-th-txt">' + esc(t("Type")) + '</span></div>' +
            '<div class="up-th"><span class="up-th-txt">' + esc(t("Date")) + '</span></div>' +
            '<div class="up-th"><span class="up-th-txt">' + esc(t("Scope")) + '</span></div>' +
            '<div class="up-th"></div>' +
          '</div>' +
          '<div class="up-tbody">' + l.map(zeileHtml).join("") + '</div></div></div>';
      } else {
        elListe.innerHTML = '<div class="uev-karten">' + l.map(karteHtml).join("") + '</div>';
        rasterSetzen(l.length);
      }
    }
    function rasterSetzen(n) {
      var k = elListe && elListe.querySelector(".uev-karten, .uev-karten-sk");
      if (!k) return;
      k.style.setProperty("--uev-cols", spalten(elListe.clientWidth || root.clientWidth || 1200, n));
    }
    function karteSkelett() {
      var eine = '<div class="uev-karte is-sk"><div class="uev-kunst uev-sk-kunst"></div><div class="uev-karte-body">' +
        '<span class="uev-sk" style="width:38%"></span><span class="uev-sk uev-sk-titel" style="width:72%"></span>' +
        '<span class="uev-sk" style="width:30%"></span><span class="uev-sk" style="width:88%"></span><span class="uev-sk" style="width:54%"></span></div></div>';
      return '<div class="uev-karten uev-karten-sk">' + eine + eine + eine + '</div>';
    }
    function listeSkelett() {
      return UC.skeletonRows ? '<div class="up-box"><div class="up-table" style="--up-cols:' + LISTE_COLS + '">' +
        UC.skeletonRows({ count: 4, rowClass: "up-row is-dense", cols: [32, { w: 60, jitter: 20 }, 40, 50, 60, 20] }) + '</div></div>' : '';
    }

    /* ============================================================================================
       Detail
       ============================================================================================ */
    var linie = null, elChartWrap = null, elLegende = null;
    function baueDetail() {
      linie = null;
      elAktion.innerHTML =
        '<button class="up-btn-sec uev-addurl-kopf" type="button">' + UC.icon("plus", 1.8) + '<span>' + esc(t("Add URL")) + '</span></button>' +
        '<span class="uev-kopfmehr"></span>';
      elMain.innerHTML =
        '<div class="uev-detail">' +
          '<div class="uev-dkopf" data-sek="kopf"></div>' +
          '<div class="uev-steuer">' +
            '<div class="uev-steuer-links">' +
              '<div class="up-seg is-lg uev-fenster" role="group" aria-label="' + esc(t("Analysis window")) + '">' +
                FENSTER.map(function (f) {
                  return '<button class="up-seg-btn" type="button" data-fenster="' + f + '">' + f + 'D</button>';
                }).join("") +
              '</div>' +
              '<div class="uev-filter">' +
                '<div class="up-root umf-root uev-modelle" data-instance="' + esc(instanceId) + '_models" data-local="yes"></div>' +
                '<div class="up-root umk-root uev-maerkte" data-instance="' + esc(instanceId) + '_markets" data-local="yes"></div>' +
              '</div>' +
            '</div>' +
            '<div class="uev-hinweise" data-sek="hinweise"></div>' +
          '</div>' +
          '<div class="up-box uev-kpis" data-sek="kpis"></div>' +
          '<section class="uev-sek uev-sek-chart">' +
            '<div class="uev-sekkopf">' +
              '<div class="uev-sektxt"><span class="uev-sektitel">' + esc(t("Performance around event")) + '</span>' +
                '<span class="uev-sekdesc">' + esc(t("How your brand developed in the affected prompts before and after the event.")) + '</span></div>' +
              '<div class="up-seg uev-metrik" role="group">' +
                METRIKEN.map(function (m) { return '<button class="up-seg-btn" type="button" data-metrik="' + m.key + '">' + esc(t(m.label)) + '</button>'; }).join("") +
              '</div>' +
            '</div>' +
            '<div class="up-box uev-chartbox"><div class="up-line-wrap uev-linewrap"><canvas></canvas></div>' +
              '<div class="up-legend uev-legende"></div></div>' +
          '</section>' +
          '<section class="uev-sek" data-sek="markt"></section>' +
          '<section class="uev-sek" data-sek="urls"></section>' +
          '<section class="uev-sek" data-sek="scope"></section>' +
          '<section class="uev-sek uev-sek-resp" data-sek="resp"></section>' +
        '</div>';
      elChartWrap = elMain.querySelector(".uev-linewrap");
      elLegende = elMain.querySelector(".uev-legende");
      linie = UC.makeLine({
        wrap: elChartWrap, canvas: elChartWrap.querySelector("canvas"), legend: elLegende,
        isDark: isDark, gran: function () { return "day"; },
        unit: function () { return state.metrik === "visibility" ? "%" : ""; },
        decimals: function () { return state.metrik === "sentiment" ? 0 : 1; },
        tipLabel: function () { return t(state.metrik === "rank" ? "Rank:" : state.metrik === "sentiment" ? "Sentiment:" : "Visibility:"); },
        reverse: function () { return state.metrik === "rank"; },
        markers: chartMarker,
        onMarker: function (id) { if (id && id !== state.eventId) oeffnen(id, true); }
      });
      elMain.querySelector(".uev-fenster").addEventListener("click", function (e) {
        var b = e.target.closest("[data-fenster]");
        if (!b) return;
        var f = parseInt(b.getAttribute("data-fenster"), 10);
        if (f === state.fenster) return;
        state.fenster = f; persist();
        analyseAnfordern(); responsesAnfordern(); renderDetail();
      });
      elMain.querySelector(".uev-metrik").addEventListener("click", function (e) {
        var b = e.target.closest("[data-metrik]");
        if (!b) return;
        state.metrik = b.getAttribute("data-metrik"); persist();
        renderChart(); segSetzen();
      });
      /* Die zwei Filter sind lokale Instanzen der App-Filter (data-local): ihre Auswahl verlaesst
         die Seite nicht, sie kommt als DOM-Ereignis hierher (Entscheidung 7). */
      elMain.addEventListener("umf-models", function (e) { filterUebernehmen("modelle", e.detail, "model_keys"); });
      elMain.addEventListener("umk-markets", function (e) { filterUebernehmen("maerkte", e.detail, "market_codes"); });
    }
    /* Eine Auswahl der Filter als Liste fuer die RPC. "include" mit Eintraegen -> genau die; ohne
       Eintraege oder bei "exclude" ohne Eintraege -> null (= alle). "exclude" mit Eintraegen ->
       alle bekannten ausser diesen, denn die RPC kennt nur eine Positivliste. */
    function filterUebernehmen(feld, d, schluessel) {
      if (!d) return;
      var gew = String(d[schluessel] || "").split(",").map(function (x) { return x.trim(); }).filter(Boolean);
      var liste = null;
      if (gew.length && d.select_mode !== "exclude") liste = gew;
      else if (gew.length) {
        var alle = feld === "modelle"
          ? (UC.getModels ? UC.getModels() : []).map(function (m) { return String(m.key || m.model || ""); })
          : (UC.getAllMarkets ? UC.getAllMarkets() : (UC.getMarkets ? UC.getMarkets() : [])).map(function (m) { return String(m.code || m.market || ""); });
        liste = alle.filter(function (k) { return k && gew.indexOf(k) < 0; });
      }
      var alt = (state[feld] || []).join(",");
      if (alt === (liste || []).join(",") && (state[feld] == null) === (liste == null)) return;
      state[feld] = liste; persist();
      analyseAnfordern(); renderDetail();
    }
    function segSetzen() {
      var fb = elMain.querySelectorAll(".uev-fenster [data-fenster]");
      for (var i = 0; i < fb.length; i++) fb[i].classList.toggle("is-active", parseInt(fb[i].getAttribute("data-fenster"), 10) === state.fenster);
      var mb = elMain.querySelectorAll(".uev-metrik [data-metrik]");
      for (var j = 0; j < mb.length; j++) mb[j].classList.toggle("is-active", mb[j].getAttribute("data-metrik") === state.metrik);
      if (UC.segJetzt) { try { UC.segJetzt(elMain.querySelector(".uev-fenster")); UC.segJetzt(elMain.querySelector(".uev-metrik")); } catch (e) {} }
    }
    /* Die Pins im eigenen Diagramm: das Event selbst (Fokus, immer -- das ganze Diagramm handelt
       von ihm, Spezifikation 77; seine Hilfslinie ist durchgezogen) und die anderen Events im
       Zeitraum aus overlaps als gewoehnliche Pins -- die folgen der Einstellung "Show event
       markers" wie in jedem anderen Diagramm. */
    function chartMarker() {
      var d = dieDetail() || listeEvent(state.eventId), a = dieAnalyse();
      if (!d) return [];
      var l = [{ id: d.id, date: d.event_date, name: d.name, type: d.event_type, color: d.color, fokus: true }];
      if (a && isArr(a.overlaps) && (!UC.getPref || UC.getPref("event_markers") !== "off")) {
        a.overlaps.forEach(function (o) {
          l.push({ id: o.event_id, date: o.event_date, name: o.name, type: o.event_type, color: o.color });
        });
      }
      return l;
    }

    function renderKopf() {
      var el = elMain.querySelector('[data-sek="kopf"]');
      var d = dieDetail() || listeEvent(state.eventId);
      if (!d) {
        el.innerHTML = state.detailFehler
          ? '<div class="uev-fehlerkopf">' + (UC.leseFehlerHtml ? UC.leseFehlerHtml("event") : esc(t("This event could not be loaded."))) +
              '<button type="button" class="up-btn-sec uev-zurueck">' + esc(t("Back to overview")) + '</button></div>'
          : '<div class="uev-dkopf-sk"><span class="uev-sk uev-sk-ic"></span><span class="uev-sk uev-sk-titel" style="width:40%"></span><span class="uev-sk" style="width:24%"></span></div>';
        elAktion.querySelector(".uev-kopfmehr").innerHTML = "";
        return;
      }
      var tp = typ(d), f = farbe(d);
      el.innerHTML =
        '<div class="uev-dkopf-reihe">' +
          '<span class="uev-dkopf-ic"' + (f ? ' style="--uev-ton:' + esc(f) + '"' : '') + '>' + UC.icon(zeichen(d), 2) + '</span>' +
          '<div class="uev-dkopf-txt">' +
            '<h2 class="uev-dkopf-titel">' + esc(d.name || "") + '</h2>' +
            '<div class="uev-dkopf-meta">' + esc(datum(d.event_date)) + ' · <span data-i18n="' + esc(tp.label) + '">' + esc(t(tp.label)) + '</span>' +
              (umfang(d) ? ' · ' + esc(umfang(d)) : '') + '</div>' +
          '</div>' +
        '</div>' +
        (d.description ? '<p class="uev-dkopf-text">' + esc(d.description) + '</p>' : '');
      elAktion.querySelector(".uev-kopfmehr").innerHTML = mehrMenue(d, "kopf");
    }

    function renderHinweise() {
      var el = elMain.querySelector('[data-sek="hinweise"]'), a = dieAnalyse();
      if (!a) { el.innerHTML = ""; return; }
      var w = a.windows || {}, c = a.cohort || {}, h = [];
      /* Die Pille mit Rahmen aus core (.up-sent.up-pille, "fuer das, was kein Messwert ist"):
         dieselbe Hoehe, derselbe Rahmen, dieselbe Schrift wie Tarif und "Active". Nur das Zeichen
         steht statt des Punktes -- ein Hinweis ist keine Stufe mit Farbe. */
      function pille(ic, text, tip, klasse) {
        return '<span class="up-sent up-pille uev-hinweis' + (klasse ? " " + klasse : "") + '"' + (tip ? ' data-tip="' + esc(tip) + '"' : "") + '>' +
          UC.icon(ic, 2) + '<span class="up-sent-val">' + esc(text) + '</span></span>';
      }
      if (w.after_complete === false) h.push(pille("clock", ersetze(t("Still running · data until {date}"), { date: datum(w.effective_after_to) }), "", "is-lauf"));
      if (w.limited_baseline === true) h.push(pille("info", ersetze(t("Limited baseline ({n} days)"), { n: zahl(w.before_observed_days) }),
        t("Less historical data is available before this event for the selected period.")));
      var ov = isArr(a.overlaps) ? a.overlaps.length : 0;
      if (ov) h.push(pille("flag", ersetze(t(ov === 1 ? "{n} other event in this period" : "{n} other events in this period"), { n: ov })));
      el.innerHTML = h.join("");
    }

    function kpiTeile(feld, a) {
      var m = a && a.affected && a.affected[feld] ? a.affected[feld] : {};
      var fmt = feld === "visibility" ? pct : (feld === "rank" ? rang : sent);
      var chipOpt = feld === "visibility" ? { decimals: true, suffix: " pp" } : (feld === "rank" ? { decimals: true, inverted: true } : { decimals: true });
      var chip = num(m.delta) == null ? "" : (UC.trendChip(m.delta, chipOpt) || '<span class="uev-gleich">' + esc(t("Unchanged")) + '</span>');
      var cd = a && a.comparison_delta && num(a.comparison_delta[feld]) != null ? num(a.comparison_delta[feld]) : null;
      var fuss = "";
      if (cd != null) {
        var txt = (cd > 0 ? "+" : cd < 0 ? "−" : "±") + (Math.round(Math.abs(cd) * 10) / 10).toFixed(1) + (feld === "visibility" ? " pp" : "");
        fuss = esc(ersetze(t("vs. comparison {d}"), { d: "\u0000" })).replace("\u0000", "<strong>" + esc(txt) + "</strong>");
      }
      return { vorherHtml: m.before == null ? "" : esc(fmt(m.before)), wertHtml: esc(fmt(m.after)), trendHtml: chip, fussHtml: fuss };
    }
    function renderKpis() {
      var el = elMain.querySelector('[data-sek="kpis"]'), a = dieAnalyse();
      if (!a) {
        el.innerHTML = state.analyseFehler && !state.analyseLaden
          ? '<div class="uev-kpifehler">' + (UC.leseFehlerHtml ? UC.leseFehlerHtml("analysis") : "") + '</div>'
          : [0, 1, 2].map(function () { return UC.kpiKarteSkelett(); }).join("");
        return;
      }
      var leer = !(a.cohort && num(a.cohort.comparable_prompt_count) > 0);
      el.innerHTML = METRIKEN.map(function (m) {
        var teile = leer ? { wertHtml: "–" } : kpiTeile(m.key, a);
        if (leer && m.key === "visibility") teile.fussHtml = esc(t("No comparable data yet"));
        teile.label = m.label;
        return UC.kpiKarte(teile);
      }).join("");
    }

    function renderChart() {
      if (!linie) return;
      var a = dieAnalyse();
      segSetzen();
      if (!a) { if (state.analyseFehler && !state.analyseLaden) linie.empty(t("This event could not be loaded.")); else linie.skeleton(); return; }
      var tr = isArr(a.trend) ? a.trend : [];
      if (!tr.length) { linie.empty(); return; }
      var feld = state.metrik;
      var d = dieDetail() || listeEvent(state.eventId) || {};
      var aName = (a.affected && a.affected.name) || t("Affected prompts");
      /* Die eigene Marke in der ersten Farbe der Linien-Palette, der Vergleich grau und gestrichelt
         -- keine eigene Event-Farbe fuer Reihen (Spezifikation 29). */
      var ds = [{ label: aName, __id: "affected", __baseColor: "#14b8a6", borderColor: "#14b8a6",
                  __favicon: a.affected && a.affected.logo_url ? a.affected.logo_url : undefined,
                  data: tr.map(function (p) { return num(p["affected_" + feld]); }) }];
      if (a.comparison) {
        ds.push({ label: t("Comparison"), __id: "comparison", __baseColor: isDark() ? "#8a8f98" : "#80858e", borderColor: isDark() ? "#8a8f98" : "#80858e",
                  __dash: true, data: tr.map(function (p) { return num(p["comparison_" + feld]); }) });
      }
      linie.render({ labels: tr.map(function (p) { return String(p.day).slice(0, 10); }), datasets: ds });
      void d;
    }

    function tabelleKopf(spalten) {
      return '<div class="up-thead">' + spalten.map(function (s) {
        return '<div class="up-th' + (s.rechts ? " is-num" : "") + '"><span class="up-th-txt">' + esc(s.t ? t(s.t) : "") + '</span></div>';
      }).join("") + '</div>';
    }
    function sekKopf(titel, desc, rechts) {
      return '<div class="uev-sekkopf"><div class="uev-sektxt"><span class="uev-sektitel">' + esc(t(titel)) + '</span>' +
        (desc ? '<span class="uev-sekdesc">' + esc(t(desc)) + '</span>' : '') + '</div>' + (rechts || '') + '</div>';
    }
    var MARKT_COLS = "minmax(180px, 1fr) 110px 110px 130px";
    function renderMarkt() {
      var el = elMain.querySelector('[data-sek="markt"]'), a = dieAnalyse();
      if (!a) {
        el.innerHTML = sekKopf("Market movement", "Visibility of every tracked brand in the affected prompts, before and after.") +
          '<div class="up-box"><div class="up-table" style="--up-cols:' + MARKT_COLS + '">' + (UC.skeletonRows ? UC.skeletonRows({ count: 3, rowClass: "up-row is-dense", cols: [{ w: 50, logo: true }, 40, 40, 40] }) : "") + '</div></div>';
        return;
      }
      var reihen = [];
      if (a.affected) reihen.push({ du: true, m: a.affected });
      (isArr(a.competitors) ? a.competitors : []).forEach(function (c) { reihen.push({ m: c }); });
      /* Ohne Wettbewerber faellt der Abschnitt weg (Spezifikation 85) -- eine Tabelle mit nur der
         eigenen Zeile ist kein Markt. */
      if (!(isArr(a.competitors) && a.competitors.length)) { el.innerHTML = ""; el.hidden = true; return; }
      el.hidden = false;
      el.innerHTML = sekKopf("Market movement", "Visibility of every tracked brand in the affected prompts, before and after.") +
        '<div class="up-box"><div class="up-table uev-markt" style="--up-cols:' + MARKT_COLS + '">' +
          tabelleKopf([{ t: "Brand" }, { t: "Before" }, { t: "After" }, { t: "Change" }]) +
          '<div class="up-tbody">' + reihen.map(function (r) {
            var v = r.m.visibility || {}, neu = v.before == null && r.m.total_runs && num(r.m.total_runs.before) === 0;
            /* Der Logo-Kasten aus core. Laedt das Bild nicht, nimmt der Favicon-Zuhoerer in core
               has-img ab, und es steht der Buchstabe da -- bei Marken gewollt ("K fuer Kestrel ist
               eine Aussage"). Mit einem eigenen Kasten kannte der Zuhoerer ihn nicht und setzte
               einen freien Globus neben den verdeckten Buchstaben. */
            var logo = '<span class="up-logo-box' + (r.m.logo_url ? ' has-img' : '') + '">' +
              (r.m.logo_url ? '<img src="' + esc(r.m.logo_url) + '" alt="" loading="lazy" referrerpolicy="no-referrer"/>' : '') +
              '<span class="up-logo-ltr">' + esc(String(r.m.name || "?").charAt(0).toUpperCase()) + '</span></span>';
            var aend = neu ? '<span class="uev-neugetrackt">' + esc(t("Newly tracked")) + '</span>'
              : (num(v.delta) == null ? "–" : (UC.trendChip(v.delta, { decimals: true, suffix: " pp" }) || '<span class="uev-gleich">' + esc(t("Unchanged")) + '</span>'));
            return '<div class="up-row is-dense uev-marktzeile' + (r.du ? " is-du" : "") + '">' +
              '<div class="up-td uev-td-marke">' + logo + '<span class="uev-marke">' + esc(r.m.name || "") + '</span>' +
                (r.du ? '<span class="uev-du">' + esc(t("You")) + '</span>' : '') + '</div>' +
              '<div class="up-td up-num">' + esc(pct(v.before)) + '</div>' +
              '<div class="up-td up-num">' + esc(pct(v.after)) + '</div>' +
              '<div class="up-td">' + aend + '</div></div>';
          }).join("") + '</div></div></div>';
    }

    /* Ein Beobachtungsstatus als Pille mit Punkt. Formulierung nach dem Vertrag 5 -- nie "noch
       nie zitiert": gezaehlt wird nur in den betroffenen Prompts des eigenen Teams. */
    function beobachtung(o) {
      o = o || {};
      var st = o.status, txt, art;
      if (st === "observed_on_event_day") { txt = t("Observed on event day"); art = "is-ja"; }
      else if (st === "first_observed_after_event") {
        art = "is-ja";
        txt = o.observed_before_event === true
          ? ersetze(t("Still cited · from day {n}"), { n: zahl(o.day_number) })
          : ersetze(t("First observed after event · {date} · day {n}"), { date: datum(o.first_observed_day), n: zahl(o.day_number) });
      } else if (st === "not_observed_within_6_months") { txt = t("Not observed within 6 months"); art = "is-lange"; }
      else { txt = t("Not observed since event"); art = "is-nein"; }
      var klick = o.first_observed_prompt_run_id;
      var inhalt = '<span class="up-sent-dot"></span><span class="up-sent-val">' + esc(txt) + '</span>';
      return klick
        ? '<button type="button" class="up-sent up-pille uev-beob ' + art + ' is-klick" data-run="' + esc(klick) + '" data-tip="' + esc(t("Open the response with the first observation")) + '">' + inhalt + '</button>'
        : '<span class="up-sent up-pille uev-beob ' + art + '">' + inhalt + '</span>';
    }
    var URL_COLS = "minmax(220px, 1.4fr) minmax(200px, 1.2fr) 100px 100px 120px 76px";
    function renderUrls() {
      var el = elMain.querySelector('[data-sek="urls"]'), d = dieDetail(), a = dieAnalyse();
      var knopf = '<button type="button" class="up-btn-sec uev-addurl">' + UC.icon("plus", 1.8) + '<span>' + esc(t("Add URL")) + '</span></button>';
      if (!d) { el.innerHTML = ""; return; }
      var urls = isArr(d.urls) ? d.urls : [];
      /* Ohne URLs keine leere Analyse-Tabelle (Spezifikation 42) -- nur der Weg, eine anzulegen. */
      if (!urls.length) {
        el.innerHTML = sekKopf("Affected URLs", "", knopf) +
          UC.leerHtml({ mini: true, icon: "link", titel: "No URLs added yet", text: "Add pages, articles or external sources associated with this event." });
        return;
      }
      var proId = {};
      (a && isArr(a.urls) ? a.urls : []).forEach(function (u) { proId[u.id] = u; });
      el.innerHTML = sekKopf("Affected URLs", "Pages, articles or external sources associated with this event. Global share is measured in the affected prompts.", knopf) +
        '<div class="up-box"><div class="up-table uev-urls" style="--up-cols:' + URL_COLS + '">' +
          tabelleKopf([{ t: "URL" }, { t: "Observation" }, { t: "Before" }, { t: "After" }, { t: "Change" }, {}]) +
          '<div class="up-tbody">' + urls.map(function (u) {
            var an = proId[u.id], hp = hostPfad(u.url), gs = an && an.global_share ? an.global_share : null;
            var wartet = !an;
            var sk = '<span class="uev-sk" style="width:60%"></span>';
            var aend = wartet ? sk : (num(gs && gs.delta) == null ? "–"
              : (UC.trendChip(gs.delta, { decimals: true, suffix: " pp" }) || '<span class="uev-gleich">' + esc(t("Unchanged")) + '</span>'));
            return '<div class="up-row is-dense uev-urlzeile" data-url-id="' + esc(u.id) + '">' +
              /* .up-fav am Logo-Kasten aus core: laedt das Favicon nicht, zeichnet core einen
                 Globus in den Kasten (eine Seite, keine Marke). Den Rueckfall uebernimmt der
                 Zuhoerer in core, ein eigenes onerror braucht es nicht. */
              '<div class="up-td uev-td-url"><span class="up-fav up-logo-box has-img"><img src="' + esc(favicon(u.url)) + '" alt="" loading="lazy" referrerpolicy="no-referrer"/></span>' +
                '<span class="uev-url-txt"><span class="uev-url-host">' + esc(hp.host) + '</span>' +
                '<span class="uev-url-pfad" title="' + esc(u.url) + '">' + esc(hp.pfad) + '</span></span></div>' +
              '<div class="up-td uev-td-beob">' + (wartet ? sk : beobachtung(an.observation)) + '</div>' +
              '<div class="up-td up-num">' + (wartet ? sk : esc(pct(gs && gs.before))) + '</div>' +
              '<div class="up-td up-num">' + (wartet ? sk : esc(pct(gs && gs.after))) + '</div>' +
              '<div class="up-td">' + aend + '</div>' +
              '<div class="up-td up-td-act uev-td-urlakt">' +
                '<button type="button" class="up-rowbtn uev-urlresp" data-url-id="' + esc(u.id) + '" data-tip="' + esc(t("View responses")) + '" aria-label="' + esc(t("View responses")) + '">' + UC.icon("messageCircle", 2) + '</button>' +
                '<button type="button" class="up-rowbtn uev-urlweg" data-url-id="' + esc(u.id) + '" data-tip="' + esc(t("Remove")) + '" aria-label="' + esc(t("Remove")) + '">' + UC.icon("trash", 2) + '</button>' +
              '</div></div>';
          }).join("") + '</div></div></div>';
    }

    function renderScope() {
      var el = elMain.querySelector('[data-sek="scope"]'), d = dieDetail(), a = dieAnalyse();
      if (!d) { el.innerHTML = ""; return; }
      var c = (a && a.cohort) || {}, zeilen = [];
      var topics = isArr(d.topics) ? d.topics : [];
      var chips = d.scope_mode === "all"
        ? '<span class="uev-scope-alle">' + esc(t("All active Prompts at event creation")) + '</span>'
        : topics.map(function (tp) {
            return '<span class="up-topicchip uev-topic' + (tp.deleted ? " is-geloescht" : "") + '">' + esc(tp.name || "") + '</span>';
          }).join("");
      zeilen.push('<div class="uev-scope-zeile"><span class="uev-scope-lbl">' + esc(t(d.scope_mode === "all" ? "Scope" : "Affected topics")) + '</span>' +
        '<div class="uev-scope-chips">' + chips + '</div></div>');
      zeilen.push('<div class="uev-scope-zeile"><span class="uev-scope-lbl">' + esc(t("Affected prompts")) + '</span><span class="uev-scope-wert">' +
        esc(ersetze(t("{n} affected Prompts"), { n: zahl(d.affected_prompt_count) })) + '</span></div>');
      var vgl = num(d.comparison_prompt_count);
      zeilen.push('<div class="uev-scope-zeile"><span class="uev-scope-lbl">' + esc(t("Comparison")) + '</span><span class="uev-scope-wert">' +
        (vgl ? esc(ersetze(t("{n} comparison Prompts are used as a workspace benchmark."), { n: zahl(vgl) })) +
            ' <span class="uev-info" data-tip="' + esc(t("Upstreem compares the affected Prompts with other eligible Prompts that were active when this event was created.")) + '">' + UC.icon("info", 2) + '</span>'
          : esc(t("No comparison benchmark available"))) + '</span></div>');
      var neben = [];
      if (num(c.post_only_prompt_count) > 0) neben.push(ersetze(t("{n} Prompts only after the event, shown in the trend only"), { n: zahl(c.post_only_prompt_count) }));
      if (num(c.deleted_prompt_count) > 0) neben.push(ersetze(t("{n} Prompts deleted since"), { n: zahl(c.deleted_prompt_count) }));
      if (neben.length) zeilen.push('<div class="uev-scope-neben">' + neben.map(esc).join(" · ") + '</div>');
      el.innerHTML = sekKopf("Event scope", "") + '<div class="up-box uev-scope">' + zeilen.join("") + '</div>';
    }

    function renderResp() {
      var el = elMain.querySelector('[data-sek="resp"]'), d = dieDetail();
      var urls = d && isArr(d.urls) ? d.urls : [];
      respSichtbar(!!urls.length);
      if (!urls.length) { el.innerHTML = ""; el.hidden = true; return; }
      el.hidden = false;
      if (state.respUrl && !urls.some(function (u) { return u.id === state.respUrl; })) state.respUrl = "";
      var gew = urls.filter(function (u) { return u.id === state.respUrl; })[0];
      el.innerHTML = sekKopf("Responses citing affected URLs", "Tracked AI responses that cite one or more URLs associated with this event.",
        '<span class="uev-respfilter">' +
          '<button type="button" class="up-ddtrigger uev-respbtn">' + '<span class="uev-respbtn-lbl">' + esc(gew ? hostPfad(gew.url).host + hostPfad(gew.url).pfad : t("All affected URLs")) + '</span>' + UC.icon("chevronDown", 2) + '</button>' +
          '<div class="up-menu uev-respmenu" role="menu" aria-hidden="true">' +
            '<div class="up-optrow' + (!state.respUrl ? " is-active" : "") + '" data-resp-url="">' + esc(t("All affected URLs")) + '</div>' +
            urls.map(function (u) {
              var hp = hostPfad(u.url);
              return '<div class="up-optrow' + (state.respUrl === u.id ? " is-active" : "") + '" data-resp-url="' + esc(u.id) + '" title="' + esc(u.url) + '">' + esc(hp.host + hp.pfad) + '</div>';
            }).join("") +
          '</div></span>');
    }
    /* Die Responses-Tabelle ist ein EIGENES Element unter dieser Komponente (Entscheidung 5) --
       sichtbar nur im Detail eines Events mit URLs. Gefunden ueber ihre Instanz. */
    function respWurzel() {
      try { return document.querySelector('.urt-root[data-instance="' + respInstanz.replace(/"/g, "") + '"]'); } catch (e) { return null; }
    }
    /* Zwei Wege, weil die Tabelle ein fremdes Element ist, das Bubble auch NACH dieser Komponente
       bauen kann (im Pruefstand gemessen: nach dem einmaligen Verstecken war sie in der Uebersicht
       sichtbar). Das Attribut an der eigenen Wurzel traegt eine Regel in events.css (:has) fuer die
       Vorgabe-Instanz -- die greift auch fuer eine Tabelle, die erst spaeter kommt. hidden am
       Element deckt jede andere Instanz ab, sobald sie da ist. */
    function respSichtbar(an) {
      root.setAttribute("data-uev-resp", an ? "an" : "aus");
      var r = respWurzel();
      if (!r) return;
      r.hidden = !an;
      /* OHNE klebende Kopfzeile. Die Tabelle malt sonst ueber ihrem Kopf einen Streifen in der
         Seitenfarbe, so hoch wie data-sticky-top (171) -- "unconditionally part of .up-head's box,
         not scroll-triggered" (core.css). Auf der Prompts-Seite steht darueber nichts; hier steht
         der Umfang des Events darueber, und im Pruefstand war er bis auf die erste Zeile
         zugedeckt. applySticky liest data-sticky bei jedem Lauf, also bleibt es aus. */
      if (r.getAttribute("data-sticky") !== "no") { r.setAttribute("data-sticky", "no"); r.classList.remove("up-sticky"); }
    }

    function renderDetail() {
      if (!elMain.querySelector(".uev-detail")) return;
      krumenNeu();
      renderKopf(); renderHinweise(); renderKpis(); renderChart(); renderMarkt(); renderUrls(); renderScope(); renderResp();
    }

    /* ---- Anforderungen an Bubble (fertige RPC-Bodies) --------------------------------------- */
    function detailAnfordern(spaet) {
      state.detailFehler = false;
      var b = body({ p_event_id: state.eventId });
      if (spaet && fire.spaet) fire.spaet("data-detail-fn", "uevDetail", b); else fire("data-detail-fn", "uevDetail", b);
    }
    function analyseAnfordern(spaet) {
      state.analyseLaden = true; state.analyseFehler = false;
      var b = body({ p_event_id: state.eventId, p_window_days: state.fenster,
                     p_models: state.modelle && state.modelle.length ? state.modelle : null,
                     p_markets: state.maerkte && state.maerkte.length ? state.maerkte : null });
      if (spaet && fire.spaet) fire.spaet("data-analysis-fn", "uevAnalysis", b); else fire("data-analysis-fn", "uevAnalysis", b);
    }
    /* Das Fenster der Responses: ab dem Event-Tag bis zum Ende des Analysefensters, hoechstens
       heute (Vertrag 3.10: "das gewaehlte Analyse-Fenster uebergeben"). Ab dem Event-Tag und nicht
       ab dem Vorher-Fenster: der Abschnitt fragt, wo die URLs NACH dem Event auftauchen. */
    function respFenster() {
      var d = dieDetail() || listeEvent(state.eventId);
      if (!d) return null;
      var start = tagMs(d.event_date), ende = Math.min(start + state.fenster * 864e5, tagMs(heuteIso()));
      return { von: isoAus(start), bis: isoAus(Math.max(start, ende)) };
    }
    /* Ohne URLs gibt es nichts, was zitiert sein koennte -- dann keine Anfrage (im Pruefstand
       gemessen: das Event "Markenkampagne TV" ohne URLs fragte trotzdem). Die Zahl kommt aus dem
       Detail oder, vor dessen Ankunft, aus der Liste (affected_url_count). Kommen spaeter URLs dazu,
       holt setDetail die Anfrage nach (respGefragt). */
    var respGefragt = "";
    function urlAnzahl() {
      var d = dieDetail();
      if (d) return isArr(d.urls) ? d.urls.length : 0;
      var l = listeEvent(state.eventId);
      return l ? (num(l.affected_url_count) || 0) : -1;
    }
    /* Einmal je Event, Fenster und URL-Filter -- im Pruefstand ging sie beim Tiefenlink zweimal
       raus (einmal mit dem Detail, einmal aus dem Takt in oeffnen). erzwingen: nach einer
       Aenderung der URL-Liste, dort ist dieselbe Signatur trotzdem veraltet. */
    function responsesAnfordern(spaet, erzwingen) {
      var f = respFenster();
      if (!f || urlAnzahl() === 0) return;
      var sig = [state.eventId, state.fenster, state.respUrl].join("|");
      if (!erzwingen && respGefragt === sig) return;
      respGefragt = sig;
      var b = body({ p_event_id: state.eventId, p_event_url_id: state.respUrl || null,
                     p_date_from: f.von, p_date_to: f.bis, p_limit: 15, p_offset: 0 });
      try { if (window.setResponsesTableLoading) window.setResponsesTableLoading(respInstanz, "yes"); } catch (e) {}
      if (spaet && fire.spaet) fire.spaet("data-responses-fn", "uevResponses", b); else fire("data-responses-fn", "uevResponses", b);
    }

    /* ---- Navigation ----------------------------------------------------------------------- */
    function zurUebersicht(neuerEintrag) {
      state.ansicht = "uebersicht"; state.eventId = null; state.respUrl = "";
      adresseSetzen("", neuerEintrag);
      respSichtbar(false);
      if (linie) { try { linie.destroy(); } catch (e) {} linie = null; }
      baueUebersicht(); krumenNeu();
    }
    /* frisch: das Detail-Objekt ist gerade erst gekommen (die Antwort auf Anlegen IST das Detail,
       Vertrag 3.4) -- dann nicht gleich noch einmal danach fragen. */
    function oeffnen(id, neuerEintrag, spaet, frisch) {
      id = String(id || "").trim();
      if (!id) return;
      var schonOffen = state.ansicht === "detail" && state.eventId === id;
      state.ansicht = "detail"; state.eventId = id; state.respUrl = "";
      adresseSetzen(id, neuerEintrag);
      if (!schonOffen) { baueDetail(); }
      var ohneAbruf = frisch && !!state.detail[id];
      state.detailLaden = !ohneAbruf;
      renderDetail();
      if (!ohneAbruf) detailAnfordern(spaet);
      setTimeout(function () { analyseAnfordern(spaet); renderDetail(); }, 150);
      setTimeout(function () { responsesAnfordern(spaet); }, 300);
      try { window.scrollTo && document.getElementById("main") && (document.getElementById("main").scrollTop = 0); } catch (e) {}
    }
    function adresseLesen(spaet) {
      var id = adresseEvent();
      if (id) { if (!(state.ansicht === "detail" && state.eventId === id)) oeffnen(id, false, spaet); }
      else if (state.ansicht !== "uebersicht" || !elListe) zurUebersicht(false);
    }

    /* ---- Klicks --------------------------------------------------------------------------- */
    function mehrSchliessen() {
      var offen = root.querySelectorAll(".uev-mehr.is-open");
      for (var i = 0; i < offen.length; i++) {
        offen[i].classList.remove("is-open");
        var m = offen[i].querySelector(".uev-mehrmenu");
        if (m) { m.classList.remove("is-shown"); m.setAttribute("aria-hidden", "true"); }
      }
    }
    root.addEventListener("click", function (e) {
      if (!e.target.closest) return;
      if (e.target.closest(".uev-anlegen, [data-uev-create]")) { e.preventDefault(); popupAnlegen(); return; }
      if (e.target.closest(".uev-zurueck")) { zurUebersicht(true); return; }
      /* Der Knopf im gefilterten Leerzustand (UC.leerHtml traegt data-clearall): Suche und
         Typ-Filter zuruecksetzen. */
      if (e.target.closest("[data-clearall]")) {
        state.suche = ""; state.typen = [];
        if (elSucheIn) elSucheIn.value = "";
        if (elSuche) elSuche.classList.remove("has-text");
        persist(); renderListe();
        return;
      }
      var mb = e.target.closest(".uev-mehrbtn");
      if (mb) {
        e.stopPropagation();
        var w = mb.closest(".uev-mehr"), war = w.classList.contains("is-open");
        mehrSchliessen();
        if (!war && UC.makePopover) {
          var pop = UC.makePopover({ wrap: w, menu: w.querySelector(".uev-mehrmenu"), opener: mb });
          pop.open();
        }
        return;
      }
      var ak = e.target.closest("[data-aktion]");
      if (ak) {
        e.stopPropagation(); mehrSchliessen();
        var eid = ak.getAttribute("data-event-id");
        if (ak.getAttribute("data-aktion") === "edit") popupBearbeiten(eid);
        if (ak.getAttribute("data-aktion") === "delete") loeschenFragen(eid);
        return;
      }
      if (e.target.closest(".uev-mehr")) return;
      var beob = e.target.closest(".uev-beob.is-klick");
      if (beob) {
        /* Die erste Beobachtung im bestehenden Response-Detail -- derselbe Drawer wie ueberall. */
        if (UC.drawerOeffnen) UC.drawerOeffnen("response", beob.getAttribute("data-run"), "events");
        return;
      }
      var ur = e.target.closest(".uev-urlresp");
      if (ur) { respFilter(ur.getAttribute("data-url-id"), true); return; }
      var uw = e.target.closest(".uev-urlweg");
      if (uw) { urlEntfernenFragen(uw.getAttribute("data-url-id")); return; }
      if (e.target.closest(".uev-addurl, .uev-addurl-kopf")) { popupUrl(); return; }
      var rb = e.target.closest(".uev-respbtn");
      if (rb) {
        e.stopPropagation();
        var rw = rb.closest(".uev-respfilter");
        if (UC.makePopover) { var p2 = UC.makePopover({ wrap: rw, menu: rw.querySelector(".uev-respmenu"), opener: rb }); p2.toggle(); }
        return;
      }
      var ro = e.target.closest("[data-resp-url]");
      if (ro) {
        var rw2 = ro.closest(".uev-respfilter");
        if (rw2) { rw2.classList.remove("is-open"); var mm = rw2.querySelector(".uev-respmenu"); if (mm) { mm.classList.remove("is-shown"); } }
        respFilter(ro.getAttribute("data-resp-url"), false);
        return;
      }
      var k = e.target.closest(".uev-karte[data-event-id], .uev-zeile[data-event-id]");
      if (k && !k.classList.contains("is-sk")) oeffnen(k.getAttribute("data-event-id"), true);
    });
    root.addEventListener("keydown", function (e) {
      if (e.key !== "Enter" && e.key !== " ") return;
      var k = e.target.closest && e.target.closest(".uev-karte[data-event-id], .uev-zeile[data-event-id]");
      if (k && e.target === k) { e.preventDefault(); oeffnen(k.getAttribute("data-event-id"), true); }
    });
    function respFilter(urlId, rollen) {
      state.respUrl = urlId || "";
      renderResp();
      responsesAnfordern();
      if (rollen) {
        var el = elMain.querySelector('[data-sek="resp"]');
        try { if (el && el.scrollIntoView) el.scrollIntoView({ behavior: "smooth", block: "start" }); } catch (e) {}
      }
    }

    /* ---- Loeschen und URL entfernen: bestaetigen im allgemeinen Popup --------------------- */
    var wartend = { del: null, urlWeg: null };
    /* Antwortet Bubble nie, haengt der Knopf sonst fuer immer -- und ein beschaeftigtes Popup
       laesst sich weder mit Escape noch ueber den Schleier schliessen. 25s wie unten (WARTE_MS). */
    function warteUhr(art, api) {
      return setTimeout(function () {
        if (!wartend[art] || wartend[art].api !== api) return;
        wartend[art] = null;
        api.busy("ok", false);
        api.fehler(t("This is taking longer than expected. Please try again."));
      }, 25000);
    }
    function loeschenFragen(eid) {
      var ev = (state.detail[eid]) || listeEvent(eid);
      if (!ev || ev.can_delete !== true) return;
      var m = UC.makeModal({
        titel: "Delete this event?", isDark: isDark,
        inhaltHtml: '<p class="uev-popup-text">' + esc(t("The event, its scope and its URL list are removed. Prompt history, citations and responses stay untouched.")) + '</p>',
        knoepfe: [{ id: "abbrechen", text: "Cancel", art: "sec" },
                  { id: "ok", text: "Delete event", art: "gefahr", aktion: function (api) {
                    api.busy("ok", true); api.fehler("");
                    wartend.del = { id: eid, api: api, uhr: warteUhr("del", api) };
                    fire("data-delete-fn", "uevDelete", body({ p_event_id: eid }));
                    return false;
                  } }],
        onClose: function () { if (wartend.del && wartend.del.api === m) wartend.del = null; }
      });
    }
    function urlEntfernenFragen(urlId) {
      var d = dieDetail();
      if (!d) return;
      var u = (isArr(d.urls) ? d.urls : []).filter(function (x) { return x.id === urlId; })[0];
      if (!u) return;
      var m = UC.makeModal({
        titel: "Remove this URL from the event?", isDark: isDark,
        inhaltHtml: '<p class="uev-popup-url">' + esc(u.url) + '</p><p class="uev-popup-text">' + esc(t("Only the link to this event is removed. The URL and its citations stay untouched.")) + '</p>',
        knoepfe: [{ id: "abbrechen", text: "Cancel", art: "sec" },
                  { id: "ok", text: "Remove URL", art: "gefahr", aktion: function (api) {
                    api.busy("ok", true); api.fehler("");
                    wartend.urlWeg = { eventId: d.id, urlId: urlId, api: api, uhr: warteUhr("urlWeg", api) };
                    fire("data-removeurl-fn", "uevRemoveUrl", body({ p_event_id: d.id, p_url_id: urlId }));
                    return false;
                  } }],
        onClose: function () { if (wartend.urlWeg && wartend.urlWeg.api === m) wartend.urlWeg = null; }
      });
    }
    /* ---- Anlegen, Bearbeiten, URL hinzufuegen (Spezifikation 48-67) ------------------------
       Alle drei im allgemeinen Popup aus core (UC.makeModal) und mit den Feldern des Topic-
       Dialogs: Etikett, Namensfeld, Aussehen-Knoepfe, Farbraster (.up-topicmodal-*). Ein Event
       anlegen soll sich anfuehlen wie ein Topic anlegen -- dieselbe Huelle, dieselben Masse.
       Hoechstens EIN Popup ist offen (popup). Es wartet hoechstens auf EINE gespeicherte Antwort
       (popup.warte: "anlegen" | "bearbeiten" | "url"), die Zahl der Prompts im Umfang kommt
       daneben ueber popupVorschauKam. Gespeichert wird nur auf den Hauptknopf, nie beim Tippen
       (Vertrag 3.6). */
    var URL_MAX = 100;          /* Vertrag 3.4 und Tabelle 4 */
    var DATUM_TAGE = 183;       /* Vertrag 3.4: heute minus 183 Tage bis heute, keine Zukunft */
    var WARTE_MS = 25000;       /* wie die Warte-Uhren der Drawer: laenger braucht keine RPC hier */
    var MONATE = ["January", "February", "March", "April", "May", "June", "July", "August",
                  "September", "October", "November", "December"];
    /* Wie im Kalender von date-range.js und ebenso unuebersetzt: dieselben Zellen, dieselben Koepfe. */
    var WOCHENTAGE = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
    /* Die erste Reihe der Topic-Palette: die kraeftigen Toene. Eine Event-Farbe ist auch die Farbe
       des Markers in jedem Diagramm, eine 1,5px-Linie auf hellem UND dunklem Grund -- die blassen
       und die tiefen Reihen verschwinden dort auf je einem der beiden (Spezifikation 50). */
    var FARBEN = (UC.TOPIC_COLOR_PALETTE || []).slice(0, 10);
    var popup = null, popupNr = 0;

    function tagAus(iso) {
      var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
      return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
    }
    function tagIso(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
    function grenzen() {
      var hi = tagAus(heuteIso());
      return { lo: new Date(hi.getFullYear(), hi.getMonth(), hi.getDate() - DATUM_TAGE), hi: hi };
    }
    /* Sieht die Eingabe wie eine Adresse aus? Ein Punkt im Host, eine Endung aus Buchstaben, keine
       Leerzeichen: "photovoltaik kosten" ist eine Suche, "sonnenkraft.de/preise" eine Adresse. Ob
       sie gilt, entscheidet der Server (impact_event_invalid_url) -- er normalisiert auch. */
    function istUrl(s) { return /^(https?:\/\/)?[^\s\/?#]+\.[a-z]{2,}(:\d+)?([\/?#]\S*)?$/i.test(String(s || "").trim()); }
    function mitSchema(s) { s = String(s || "").trim(); return /^https?:\/\//i.test(s) ? s : "https://" + s; }
    /* Nur fuer "schon in der Liste?" im Popup. Der Server dedupliziert ohnehin nach url_norm_v1. */
    function urlSchluessel(s) {
      return String(s || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/#.*$/, "").replace(/\/+$/, "");
    }

    /* Die Typen nach Gruppen: die Liste in core folgt dem Vertrag, und dort steht die Landingpage
       zwischen den Content-Typen. Innerhalb einer Gruppe bleibt die Reihenfolge, zwischen den
       Gruppen steht ein Trenner und keine Ueberschrift -- die Namen der Typen sagen genug. */
    function typenGeordnet() {
      var reihe = [], gruppen = {};
      (UC.EVENT_TYPEN || []).forEach(function (x) {
        if (!gruppen[x.gruppe]) { gruppen[x.gruppe] = []; reihe.push(x.gruppe); }
        gruppen[x.gruppe].push(x);
      });
      return reihe.map(function (g) { return gruppen[g]; });
    }
    function zeichenListe() {
      var l = [], da = {};
      (UC.EVENT_TYPEN || []).forEach(function (x) { if (!da[x.icon]) { da[x.icon] = 1; l.push(x.icon); } });
      return l;
    }
    function typVon(key) { return typ({ event_type: key }); }

    /* Ein Feld des Topic-Dialogs: Etikett ueber dem Inhalt. "Optional" steht im Etikett und nicht
       im Platzhalter -- ein Platzhalter ist weg, sobald jemand tippt (Spezifikation 56). */
    function feld(label, inhalt, optional) {
      return '<div class="up-topicmodal-field">' +
        '<span class="up-topicmodal-label">' + esc(t(label)) +
          (optional ? ' <span class="uev-optional">' + esc(t("Optional")) + '</span>' : '') + '</span>' +
        inhalt + '</div>';
    }
    function wahlKnopf(art, ic, txt, leer) {
      return '<button type="button" class="up-topicmodal-name up-modal-wahl" data-wahl="' + art + '" aria-expanded="false">' +
        '<span class="up-modal-wahl-ic">' + UC.icon(ic, 2) + '</span>' +
        '<span class="up-modal-wahl-txt' + (leer ? " is-leer" : "") + '">' + esc(txt) + '</span>' +
        '<span class="up-modal-wahl-chev">' + UC.icon("chevronDown", 2) + '</span></button>';
    }
    function typOptionen(akt) {
      return typenGeordnet().map(function (g) {
        return g.map(function (x) {
          var an = x.key === akt;
          return '<div class="up-pop-opt' + (an ? " is-active" : "") + '" role="option" aria-selected="' + an + '" data-typ-wahl="' + esc(x.key) + '">' +
            '<span class="uev-typopt"><span class="uev-typitem-ic">' + UC.icon(x.icon, 2) + '</span>' + esc(t(x.label)) + '</span>' +
            '<span class="up-check">' + UC.icon("check", 2) + '</span></div>';
        }).join("");
      }).join('<div class="up-pop-div"></div>');
    }
    function typFeld(e) {
      var tp = typVon(e.typ);
      return '<div class="up-filter uev-wahl" data-wahlwrap="typ">' + wahlKnopf("typ", tp.icon, t(tp.label)) +
        '<div class="up-menu uev-wahlmenu uev-typwahl" role="listbox" aria-hidden="true" data-up-feldbreit>' + typOptionen(e.typ) + '</div></div>';
    }
    /* Ein Monat in der Bauart des Kalenders aus date-range.js (.udr-month, .udr-day) -- dessen
       Regeln stehen ohne Elternklasse in date-range.css, die Zellen sehen also genau so aus. Der
       gewaehlte Tag ist Anfang und Ende zugleich, mit beiden Ecken: ein Band aus einer Zelle. */
    function kalender(e) {
      var g = grenzen(), m = e.monat || tagAus(e.datum) || g.hi;
      var monat = new Date(m.getFullYear(), m.getMonth(), 1);
      var boden = new Date(g.lo.getFullYear(), g.lo.getMonth(), 1), decke = new Date(g.hi.getFullYear(), g.hi.getMonth(), 1);
      var vor = new Date(monat.getFullYear(), monat.getMonth() - 1, 1) >= boden;
      var nach = new Date(monat.getFullYear(), monat.getMonth() + 1, 1) <= decke;
      var start = new Date(monat.getFullYear(), monat.getMonth(), 1 - (monat.getDay() + 6) % 7);
      var heute = tagIso(g.hi), zellen = "";
      for (var i = 0; i < 42; i++) {
        var d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
        if (d.getMonth() !== monat.getMonth()) { zellen += '<span class="udr-day is-out" aria-hidden="true"></span>'; continue; }
        var iso = tagIso(d), aus = d < g.lo || d > g.hi;
        zellen += '<button type="button" class="udr-day' + (iso === heute ? " is-today" : "") +
          (iso === e.datum ? " is-start is-end is-edge-l is-edge-r" : "") + '" data-tag="' + iso + '"' + (aus ? " disabled" : "") + '>' + d.getDate() + '</button>';
      }
      return '<div class="udr-month">' +
        '<div class="udr-month-head">' +
          '<button type="button" class="udr-nav udr-prev" data-monat="-1" aria-label="' + esc(t("Previous month")) + '"' + (vor ? "" : " disabled") + '>' + UC.icon("chevronLeft", 1.8) + '</button>' +
          '<span class="udr-month-title">' + esc(t(MONATE[monat.getMonth()])) + ' ' + monat.getFullYear() + '</span>' +
          '<button type="button" class="udr-nav udr-next" data-monat="1" aria-label="' + esc(t("Next month")) + '"' + (nach ? "" : " disabled") + '>' + UC.icon("chevronRight", 1.8) + '</button>' +
        '</div>' +
        '<div class="udr-dows">' + WOCHENTAGE.map(function (w) { return '<span class="udr-dow">' + w + '</span>'; }).join("") + '</div>' +
        '<div class="udr-grid">' + zellen + '</div></div>';
    }
    function datumFeld(e) {
      return '<div class="up-filter uev-wahl" data-wahlwrap="datum">' + wahlKnopf("datum", "calendar", e.datum ? datum(e.datum) : t("Select a date"), !e.datum) +
        '<div class="up-menu uev-wahlmenu uev-datumwahl" aria-hidden="true">' + kalender(e) + '</div></div>';
    }
    /* Zeichen und Farbe wie Emoji und Farbe im Topic-Dialog: zwei Knoepfe, darunter das Raster des
       offenen. Ohne eigene Wahl folgt das Zeichen dem Typ und die Farbe bleibt leer -- dann malt
       jede Stelle ihren Grundton (Vertrag: p_icon und p_color sind optional). */
    function aussehen(e) {
      var ic = e.icon || typVon(e.typ).icon, f = e.farbe, panel = "";
      if (e.offen === "icon") {
        panel = '<div class="up-topicmodal-pickpanel"><div class="up-topicmodal-colorgrid">' +
          zeichenListe().map(function (k) {
            var an = k === ic;
            return '<button type="button" class="up-topicmodal-colorcell uev-zeichenzelle' + (an ? " is-on" : "") + '" data-zeichen="' + esc(k) + '" aria-pressed="' + an + '">' + UC.icon(k, 2) + '</button>';
          }).join("") + '</div></div>';
      } else if (e.offen === "farbe") {
        /* Eine Farbe ausserhalb der Reihe (aus der Datenbank, der Vertrag zeigt #22aa55) steht als
           eigene Zelle hinten -- wie paletteMit im Topic-Dialog. Sonst waere nichts gewaehlt. */
        var toene = FARBEN.slice();
        if (f && !toene.some(function (hx) { return hx.toLowerCase() === f.toLowerCase(); })) toene.push(f);
        panel = '<div class="up-topicmodal-pickpanel"><div class="up-topicmodal-colorgrid uev-farbraster" style="grid-template-columns:repeat(' + (toene.length + 1) + ',1fr)">' +
          '<button type="button" class="up-topicmodal-colorcell" data-farbe="" aria-pressed="' + !f + '" aria-label="' + esc(t("Default color")) + '" data-tip="' + esc(t("Default color")) + '">' +
            '<span class="up-topicmodal-colorblob uev-ohnefarbe">' + (!f ? UC.icon("check", 3) : "") + '</span></button>' +
          toene.map(function (hx) {
            var an = !!f && hx.toLowerCase() === f.toLowerCase();
            return '<button type="button" class="up-topicmodal-colorcell" data-farbe="' + esc(hx) + '" aria-pressed="' + an + '" aria-label="' + esc(hx) + '">' +
              '<span class="up-topicmodal-colorblob" style="background:' + esc(hx) + '">' + (an ? UC.icon("check", 3) : "") + '</span></button>';
          }).join("") + '</div></div>';
      }
      return '<div class="up-topicmodal-approw">' +
          '<button type="button" class="up-topicmodal-pickbtn' + (e.offen === "icon" ? " is-open" : "") + '" data-pick="icon" aria-expanded="' + (e.offen === "icon") + '"' +
            ' aria-label="' + esc(t("Event icon")) + '" data-tip="' + esc(t("Event icon")) + '"' + (f ? ' style="color:' + esc(f) + '"' : '') + '>' + UC.icon(ic, 2) + '</button>' +
          '<button type="button" class="up-topicmodal-pickbtn' + (e.offen === "farbe" ? " is-open" : "") + '" data-pick="farbe" aria-expanded="' + (e.offen === "farbe") + '"' +
            ' aria-label="' + esc(t("Event color")) + '" data-tip="' + esc(t("Event color")) + '">' +
            '<span class="up-topicmodal-pickswatch' + (f ? "" : " uev-ohnefarbe") + '"' + (f ? ' style="background:' + esc(f) + '"' : '') + '></span></button>' +
        '</div>' + panel;
    }
    function detailFelder(e, mitDatum) {
      return feld("Name", '<input type="text" class="up-topicmodal-name" data-feld="name" maxlength="120" autocomplete="off" spellcheck="false"' +
          ' placeholder="' + esc(t("e.g. Website relaunch")) + '" value="' + esc(e.name) + '"/>') +
        (mitDatum ? feld("Date", datumFeld(e)) : "") +
        feld("Type", typFeld(e)) +
        feld("Description", '<textarea class="up-topicmodal-name up-modal-text" data-feld="text" rows="3" placeholder="' + esc(t("What changed?")) + '">' + esc(e.text) + '</textarea>', true) +
        feld("Appearance", '<div class="uev-aussehen">' + aussehen(e) + '</div>');
    }
    function gesperrtHinweis(text) {
      return '<p class="up-modal-hinweis uev-gesperrt">' + UC.icon("lock", 2) + '<span>' + esc(t(text)) + '</span></p>';
    }
    /* Umschalter, Topics und die Zahl als EINE Gruppe: die Zahl gehoert zur Auswahl darueber und
       steht darum nicht 32px entfernt wie ein eigenes Feld. Kein Wort ueber die Vergleichsgruppe
       (Spezifikation 55) -- die legt der Server selbst fest. */
    function umfangFelder(e, topicsId) {
      return feld("Affected scope",
        '<div class="uev-umfang">' +
          '<div class="up-seg uev-umfangseg" role="group">' +
            '<button type="button" class="up-seg-btn' + (e.modus === "topics" ? " is-active" : "") + '" data-modus="topics">' + esc(t("Selected topics")) + '</button>' +
            '<button type="button" class="up-seg-btn' + (e.modus === "all" ? " is-active" : "") + '" data-modus="all">' + esc(t("All active Prompts")) + '</button>' +
          '</div>' +
          '<div class="uev-umfang-topics"' + (e.modus === "topics" ? "" : " hidden") + '>' +
            '<div class="up-root utf-root uev-topicwahl" data-instance="' + esc(topicsId) + '" data-local="yes" data-newtopic="no" data-isdark="' + (isDark() ? "yes" : "no") + '"></div>' +
          '</div>' +
          '<p class="uev-umfang-zahl" aria-live="polite"></p>' +
        '</div>');
    }
    function urlSuche() {
      return '<div class="uev-urlsuche"><span class="uev-urlsuche-ic">' + UC.icon("search", 2) + '</span>' +
          '<input type="text" class="up-topicmodal-name uev-urlein" placeholder="' + esc(t("Search your URLs or paste a link")) + '" autocomplete="off" spellcheck="false" inputmode="url"/></div>' +
        '<div class="uev-urltreffer" role="listbox" hidden></div>';
    }
    function urlFelder() {
      return feld("Affected URLs",
          '<p class="up-modal-hinweis">' + esc(t("Add pages, articles or external sources associated with this event.")) + '</p>' +
          urlSuche() + '<div class="uev-urlauswahl"></div>', true) +
        '<div class="uev-pruef"></div>' +
        gesperrtHinweis("The event date and affected scope can't be changed after creation.");
    }

    /* ---- Zeichnen in einem offenen Popup --------------------------------------------------- */
    function im(sel) { return popup ? popup.api.el.querySelector(sel) : null; }
    function schrittText(n) {
      return ersetze(t("Step {n} of 3"), { n: n }) + " · " + t(["Details", "Scope", "URLs & review"][n - 1]);
    }
    function typNeu() {
      var p = popup, tp = typVon(p.e.typ), b = im('[data-wahl="typ"]');
      if (b) {
        b.querySelector(".up-modal-wahl-ic").innerHTML = UC.icon(tp.icon, 2);
        b.querySelector(".up-modal-wahl-txt").textContent = t(tp.label);
      }
      var m = im(".uev-typwahl");
      if (m) m.innerHTML = typOptionen(p.e.typ);
      aussehenNeu();
    }
    function datumNeu() {
      var p = popup, b = im('[data-wahl="datum"]');
      if (b) {
        var tx = b.querySelector(".up-modal-wahl-txt");
        tx.textContent = p.e.datum ? datum(p.e.datum) : t("Select a date");
        tx.classList.toggle("is-leer", !p.e.datum);
      }
      var m = im(".uev-datumwahl");
      if (m) m.innerHTML = kalender(p.e);
    }
    function aussehenNeu() { var el = im(".uev-aussehen"); if (el) el.innerHTML = aussehen(popup.e); }
    function menueZu(art) {
      var p = popup, pop = p && p.pops[art];
      if (pop) pop.close();
      var b = im('[data-wahl="' + art + '"]');
      if (b) b.setAttribute("aria-expanded", "false");
    }
    function umfangSig(e) { return e.modus === "all" ? "all" : "topics|" + e.topics.slice().sort().join(","); }
    /* Je Auswahl die gezaehlte Zahl: wer zwischen "Selected topics" und "All" hin und her schaltet,
       loest keine neue Anfrage aus fuer etwas, das schon gezaehlt ist. */
    function dieVorschau(p) { return (p.vorschauen && p.vorschauen[umfangSig(p.e)]) || null; }
    function zahlZeigen() {
      var p = popup, el = im(".uev-umfang-zahl");
      if (!el) return;
      var e = p.e, v = dieVorschau(p), txt, art = "";
      if (e.modus === "topics" && !e.topics.length) txt = t("Select at least one topic.");
      else if (p.vorschauLaeuft || !v) { txt = t("Counting prompts…"); art = "is-laeuft"; }
      else if (v.fehler) { txt = t("The number of prompts could not be loaded."); art = "is-fehler"; }
      else if (v.n === 0) { txt = t("The selection contains no active prompts."); art = "is-fehler"; }
      else txt = ersetze(t(e.modus === "all"
        ? (v.n === 1 ? "{n} prompt will be included in this event." : "{n} prompts will be included in this event.")
        : (v.n === 1 ? "{n} active prompt included" : "{n} active prompts included")), { n: zahl(v.n) });
      el.className = "uev-umfang-zahl" + (art ? " " + art : "");
      el.innerHTML = (art === "is-laeuft" ? '<span class="up-modal-spin"></span>' : art === "is-fehler" ? UC.icon("info", 2) : "") + '<span>' + esc(txt) + '</span>';
    }
    function umfangNeu() {
      var p = popup, seg = im(".uev-umfangseg");
      if (seg) {
        var bs = seg.querySelectorAll("[data-modus]");
        for (var i = 0; i < bs.length; i++) bs[i].classList.toggle("is-active", bs[i].getAttribute("data-modus") === p.e.modus);
        if (UC.segJetzt) { try { UC.segJetzt(seg); } catch (e) {} }
      }
      var tw = im(".uev-umfang-topics");
      if (tw) tw.hidden = p.e.modus !== "topics";
      zahlZeigen();
    }
    function imEvent(p, url) {
      if (p.art !== "url") return false;
      var d = state.detail[p.eventId], k = urlSchluessel(url);
      return !!(d && isArr(d.urls) && d.urls.some(function (u) { return urlSchluessel(u.url) === k; }));
    }
    function gewaehlt(p, url) {
      var k = urlSchluessel(url);
      return p.e.urls.some(function (u) { return urlSchluessel(u.url) === k; });
    }
    function trefferZeigen() {
      var p = popup, el = im(".uev-urltreffer");
      if (!el) return;
      var s = p.such, q = String(s.frage || "").trim(), html = "";
      if (!q) { el.innerHTML = ""; el.hidden = true; return; }
      var voll = p.art === "anlegen" && p.e.urls.length >= URL_MAX;
      var treffer = s.treffer || [];
      function zustand(url) {
        if (imEvent(p, url)) return { txt: t("Already in this event"), klasse: "is-taken" };
        if (gewaehlt(p, url)) return { txt: t("Added"), klasse: "is-taken" };
        return { txt: "", klasse: voll ? "is-taken" : "" };
      }
      /* Eine getippte Adresse, die kein Treffer ist, wird als neues Ziel angeboten (Spezifikation
         60) -- OBEN, weil sie genau das ist, was jemand gerade eingefuegt hat. */
      var neu = istUrl(q) ? mitSchema(q) : "";
      if (neu && !treffer.some(function (it) { return urlSchluessel(it.url) === urlSchluessel(neu); })) {
        var z = zustand(neu);
        html += '<button type="button" class="up-es-row uev-neuziel' + (z.klasse ? " " + z.klasse : "") + '" data-neu-url="' + esc(neu) + '">' +
          (UC.entityAvatar ? UC.entityAvatar("", UC.icon("plus", 2), false, "up-es") : "") +
          '<span class="up-es-main"><span class="up-es-primary">' + esc(neu) + '</span></span>' +
          '<span class="up-es-type">' + esc(z.txt || t("Add as new target")) + '</span></button>';
      }
      if (s.laedt) {
        html += [0, 1].map(function () {
          return '<div class="uev-urlsk"><span class="uev-sk uev-urlsk-av"></span><span class="uev-urlsk-txt"><span class="uev-sk"></span><span class="uev-sk"></span></span></div>';
        }).join("");
      } else if (s.fehler) {
        html += '<p class="up-modal-hinweis uev-urlnote">' + esc(s.fehler) + '</p>';
      } else if (s.treffer) {
        html += treffer.map(function (it, i) {
          var z = zustand(it.url);
          return UC.entityRow(it, { prefix: "up-es", query: q, index: i, rechts: z.txt || t("Previously observed"), klasse: z.klasse });
        }).join("");
        if (!treffer.length && !neu) html += '<p class="up-modal-hinweis uev-urlnote">' + esc(t("No matching URLs. Paste a full link to add it as a new target.")) + '</p>';
      }
      el.innerHTML = html;
      el.hidden = !html;
    }
    function auswahlZeigen() {
      var p = popup, el = im(".uev-urlauswahl");
      if (!el) return;
      var l = p.e.urls;
      el.innerHTML = !l.length ? "" :
        '<div class="uev-urlwahl-liste">' + l.map(function (u, i) {
          var hp = hostPfad(u.url);
          return '<div class="uev-urlwahl">' +
            '<span class="up-fav up-logo-box has-img"><img src="' + esc(favicon(u.url)) + '" alt="" loading="lazy" referrerpolicy="no-referrer"/></span>' +
            '<span class="uev-url-txt"><span class="uev-url-host">' + esc(hp.host) + '</span><span class="uev-url-pfad" title="' + esc(u.url) + '">' + esc(hp.pfad) + '</span></span>' +
            (u.neu ? '<span class="uev-urlwahl-neu">' + esc(t("New target")) + '</span>' : '') +
            '<button type="button" class="up-iconbtn uev-urlwahl-weg" data-url-weg="' + i + '" aria-label="' + esc(t("Remove")) + '" data-tip="' + esc(t("Remove")) + '">' + UC.icon("x", 2) + '</button></div>';
        }).join("") + '</div>' +
        (p.art === "anlegen" ? '<p class="up-modal-hinweis uev-urlzahl">' + esc(ersetze(t("{n} of {max} URLs"), { n: l.length, max: URL_MAX })) + '</p>' : '');
    }
    function pruefenZeigen() {
      var p = popup, el = im(".uev-pruef");
      if (!el || p.art !== "anlegen") return;
      var e = p.e, tp = typVon(e.typ), v = dieVorschau(p);
      var umf = e.modus === "all" ? t("All active Prompts") : ersetze(t(e.topics.length === 1 ? "{n} Topic" : "{n} Topics"), { n: e.topics.length });
      var pr = v && !v.fehler && v.n != null ? ersetze(t(v.n === 1 ? "{n} Prompt" : "{n} Prompts"), { n: zahl(v.n) }) : "";
      var ur = e.urls.length ? ersetze(t(e.urls.length === 1 ? "{n} URL target" : "{n} URL targets"), { n: e.urls.length }) : t("No URL targets");
      el.innerHTML =
        '<div class="uev-pruef-kopf"><span class="uev-pruef-ic"' + (e.farbe ? ' style="--uev-ton:' + esc(e.farbe) + '"' : '') + '>' + UC.icon(e.icon || tp.icon, 2) + '</span>' +
          '<span class="uev-pruef-name">' + esc(e.name.trim()) + '</span></div>' +
        '<div class="uev-pruef-zeile">' + esc(datum(e.datum)) + ' · ' + esc(t(tp.label)) + '</div>' +
        '<div class="uev-pruef-zeile">' + [umf, pr, ur].filter(Boolean).map(esc).join(" · ") + '</div>';
    }
    function schrittOk(p) {
      var e = p.e;
      if (p.art === "url") return e.urls.length === 1;
      if (p.art === "bearbeiten") return !!e.name.trim();
      if (p.schritt === 1) return !!e.name.trim() && !!e.datum;
      if (p.schritt === 2) {
        if (e.modus === "topics" && !e.topics.length) return false;
        var v = dieVorschau(p);
        /* Waehrend gezaehlt wird, wartet der Knopf; konnte nicht gezaehlt werden, darf es weiter
           -- der Server prueft beim Anlegen selbst (impact_event_no_active_prompts). */
        if (p.vorschauLaeuft || !v) return false;
        return v.fehler || v.n !== 0;
      }
      return true;
    }
    function knoepfeSync() {
      var p = popup;
      if (!p || p.warte) return;
      var b = p.api.knopf(p.knopf);
      if (b) b.disabled = !schrittOk(p);
      if (p.art !== "anlegen") return;
      var z = p.api.knopf("zurueck");
      if (z) z.hidden = p.schritt === 1;
      var lbl = p.schritt === 3 ? "Create event" : "Continue", tx = b && b.querySelector(".up-modal-knopftxt");
      if (tx) { tx.textContent = t(lbl); tx.setAttribute("data-i18n", lbl); }
    }
    function schritt(n, fehlerBehalten) {
      var p = popup;
      if (!p || n < 1 || n > 3) return;
      p.schritt = n;
      if (!fehlerBehalten) p.api.fehler("");
      var st = p.api.body.querySelectorAll(".uev-schritt");
      for (var i = 0; i < st.length; i++) st[i].hidden = parseInt(st[i].getAttribute("data-schritt"), 10) !== n;
      /* Schritt 2 und 3 entstehen erst, wenn sie gezeigt werden: der Topics-Filter baut sich nur
         in einer sichtbaren Wurzel (makeMount), und in einem verdeckten Schritt stuende er erst
         nach dem naechsten Blick des Waechters da. */
      var box = p.api.body.querySelector('.uev-schritt[data-schritt="' + n + '"]');
      if (box && !box.__uevGebaut) {
        box.__uevGebaut = 1;
        if (n === 2) box.innerHTML = umfangFelder(p.e, p.topicsId);
        if (n === 3) box.innerHTML = urlFelder();
      }
      var sub = p.api.el.querySelector(".up-topicmodal-sub");
      if (sub) sub.textContent = schrittText(n);
      if (n === 2) { umfangNeu(); vorschauAnfordern(); }
      if (n === 3) {
        auswahlZeigen(); trefferZeigen(); pruefenZeigen();
        var inp = im(".uev-urlein");
        setTimeout(function () { try { if (inp) inp.focus(); } catch (e) {} }, 30);
      }
      if (n === 1) { var nm = im('[data-feld="name"]'); setTimeout(function () { try { if (nm) nm.focus(); } catch (e) {} }, 30); }
      try { p.api.karte.scrollTop = 0; } catch (e) {}
      knoepfeSync();
    }

    /* ---- Die Zahl der Prompts im Umfang (preview_impact_event_scope_v1) ---------------------
       Die Antwort nennt ihre Auswahl nicht. Darum laeuft hoechstens EINE Anfrage: was sich
       waehrenddessen aendert, merkt sich vorschauSoll und geht hinaus, sobald die laufende da ist
       -- so gehoert jede Antwort sicher zu der Auswahl, fuer die sie bestellt war. */
    function vorschauAnfordern() {
      var p = popup;
      if (!p || p.art !== "anlegen") return;
      var e = p.e, sig = umfangSig(e);
      p.vorschauSoll = sig;
      if (!(e.modus === "topics" && !e.topics.length) && !p.vorschauLaeuft && !(dieVorschau(p) && !dieVorschau(p).fehler)) {
        p.vorschauLaeuft = sig;
        clearTimeout(p.vorschauUhr);
        p.vorschauUhr = setTimeout(function () { if (popup === p && p.vorschauLaeuft === sig) popupVorschauKam(null); }, WARTE_MS);
        fire("data-preview-fn", "uevScopePreview", body(e.modus === "all" ? { p_scope_mode: "all" } : { p_scope_mode: "topics", p_tag_ids: e.topics.slice() }));
      }
      zahlZeigen(); pruefenZeigen(); knoepfeSync();
    }
    function popupVorschauKam(n) {
      var p = popup;
      if (!p || p.art !== "anlegen" || !p.vorschauLaeuft) return false;
      var sig = p.vorschauLaeuft;
      p.vorschauLaeuft = null;
      clearTimeout(p.vorschauUhr);
      p.vorschauen[sig] = { sig: sig, n: n, fehler: n == null };
      if (p.vorschauSoll !== sig) { vorschauAnfordern(); return true; }
      zahlZeigen(); pruefenZeigen(); knoepfeSync();
      return true;
    }

    /* ---- Die URL-Suche: die Maschine aus core, derselbe Weg wie in Ask Mira ----------------
       UC.makeEntitySearch schickt ueber bubble_fn_quick_actions_search, denselben Workflow wie
       Palette und Mira (search_quick_actions_v2 zeigt nur URLs des eigenen Teams, Vertrag 3.6) --
       in Bubble ist dafuer nichts Neues zu bauen. */
    function sucheBauen(p) {
      p.such = { frage: "", treffer: null, laedt: false, fehler: "" };
      if (!UC.makeEntitySearch) return;
      p.maschine = UC.makeEntitySearch({
        prefix: "uev", limit: 8,
        filters: function () { return { scope: "url" }; },
        onLoading: function () { if (popup !== p) return; p.such.laedt = true; p.such.fehler = ""; trefferZeigen(); },
        onResults: function (items) { if (popup !== p) return; p.such.laedt = false; p.such.treffer = items || []; trefferZeigen(); },
        onError: function () {
          if (popup !== p) return;
          p.such.laedt = false; p.such.treffer = null;
          p.such.fehler = t("Search is not available right now. You can still paste a full link.");
          trefferZeigen();
        },
        onIdle: function () { if (popup !== p) return; p.such.laedt = false; p.such.treffer = null; p.such.fehler = ""; trefferZeigen(); }
      });
    }
    function urlNehmen(url, neu) {
      var p = popup;
      if (!p || !url || gewaehlt(p, url) || imEvent(p, url)) return;
      if (p.art === "url") p.e.urls = [{ url: url, neu: neu }];
      else if (p.e.urls.length < URL_MAX) p.e.urls.push({ url: url, neu: neu });
      else return;
      var inp = im(".uev-urlein");
      if (inp) inp.value = "";
      p.such.frage = ""; p.such.treffer = null; p.such.laedt = false; p.such.fehler = "";
      if (p.maschine) p.maschine.abbrechen();
      try { if (inp) inp.focus(); } catch (e) {}
      p.api.fehler("");
      auswahlZeigen(); trefferZeigen(); pruefenZeigen(); knoepfeSync();
    }

    /* ---- Senden und Antworten -------------------------------------------------------------- */
    function warten(p, art) {
      p.warte = art;
      p.api.fehler("");
      p.api.busy(p.knopf, true);
      clearTimeout(p.warteUhr);
      /* Antwortet Bubble nie, haengt der Knopf sonst fuer immer -- und ein beschaeftigtes Popup
         laesst sich nicht schliessen. */
      p.warteUhr = setTimeout(function () {
        if (popup !== p || p.warte !== art) return;
        p.warte = null;
        p.api.busy(p.knopf, false);
        p.api.fehler(t("This is taking longer than expected. Please try again."));
        knoepfeSync();
      }, WARTE_MS);
    }
    function anlegenSenden() {
      var p = popup, e = p.e;
      warten(p, "anlegen");
      fire("data-create-fn", "uevCreate", body({
        p_name: e.name.trim(), p_event_date: e.datum, p_scope_mode: e.modus,
        p_tag_ids: e.modus === "topics" ? e.topics.slice() : null,
        p_urls: e.urls.length ? e.urls.map(function (u) { return u.url; }) : null,
        p_description: e.text.trim() || null, p_event_type: e.typ,
        p_icon: e.icon || null, p_color: e.farbe || null
      }));
    }
    /* Vertrag 3.5: null heisst unveraendert, "" leert (Beschreibung, Zeichen, Farbe). Ein leerer
       Name ist nicht erlaubt -- der Knopf ist dann gar nicht erst frei. */
    function speichern() {
      var p = popup, e = p.e, a = p.alt;
      var name = e.name.trim(), text = e.text.trim();
      var b = {
        p_event_id: p.eventId,
        p_name: name !== a.name.trim() ? name : null,
        p_description: text !== a.text.trim() ? text : null,
        p_event_type: e.typ !== a.typ ? e.typ : null,
        p_icon: e.icon !== a.icon ? (e.icon || "") : null,
        p_color: e.farbe !== a.farbe ? (e.farbe || "") : null
      };
      if (b.p_name == null && b.p_description == null && b.p_event_type == null && b.p_icon == null && b.p_color == null) { p.api.schliessen(); return; }
      warten(p, "bearbeiten");
      fire("data-update-fn", "uevUpdate", body(b));
    }
    function urlSenden() {
      var p = popup;
      if (!p.e.urls.length) return;
      warten(p, "url");
      fire("data-addurl-fn", "uevAddUrl", body({ p_event_id: p.eventId, p_url: p.e.urls[0].url }));
    }
    function popupDetailKam(d, neu) {
      var p = popup;
      if (!p || !p.warte || !d) return;
      var id = String(d.id);
      if (p.warte === "anlegen" ? !neu : id !== p.eventId) return;
      var art = p.warte;
      clearTimeout(p.warteUhr);
      p.warte = null;
      p.api.busy(p.knopf, false);
      p.api.schliessen();
      if (art === "anlegen") { if (UC.toast) UC.toast(t("Event created")); oeffnen(id, true, false, true); }
      else if (UC.toast) UC.toast(t(art === "url" ? "URL added" : "Event updated"));
    }
    /* Welcher Schritt einen Fehler beheben kann -- dorthin springt das Popup, die Meldung bleibt. */
    var FEHLER_SCHRITT = {
      impact_event_name_required: 1, impact_event_invalid_date: 1,
      impact_event_topics_required: 2, impact_event_invalid_topics: 2, impact_event_no_active_prompts: 2,
      impact_event_invalid_url: 3, impact_event_too_many_urls: 3
    };
    function popupFehlerKam(txt, code) {
      var p = popup;
      if (!p) return false;
      if (p.warte) {
        clearTimeout(p.warteUhr);
        p.warte = null;
        p.api.busy(p.knopf, false);
        if (p.art === "anlegen" && FEHLER_SCHRITT[code]) schritt(FEHLER_SCHRITT[code], true);
        p.api.fehler(txt);
        knoepfeSync();
        return true;
      }
      if (p.vorschauLaeuft) return popupVorschauKam(null);
      return false;
    }

    /* ---- Ein Popup oeffnen ------------------------------------------------------------------- */
    function popupZu() {
      var p = popup;
      if (!p) return;
      clearTimeout(p.warteUhr); clearTimeout(p.vorschauUhr);
      if (p.maschine) p.maschine.abbrechen();
      popup = null;
    }
    function popupAufbauen(p) {
      popup = p;
      var el = p.api.el;
      if (UC.makeTooltips) UC.makeTooltips(el, isDark);
      el.addEventListener("click", popupKlick);
      el.addEventListener("input", popupEingabe);
      el.addEventListener("keydown", popupTaste);
      /* Der Topics-Filter meldet seine Auswahl als DOM-Ereignis (data-local="yes"): kommagetrennte
         ids in topic_ids. */
      el.addEventListener("utf-topics", function (ev) {
        if (popup !== p || !ev.detail) return;
        p.e.topics = String(ev.detail.topic_ids || "").split(",").map(function (x) { return x.trim(); }).filter(Boolean);
        vorschauAnfordern();
      });
      knoepfeSync();
    }
    function popupAnlegen() {
      if (popup) return;
      var e = { name: "", datum: heuteIso(), monat: null, typ: "other", text: "", icon: null, farbe: null, offen: null,
                modus: "topics", topics: [], urls: [] };
      var api = UC.makeModal({
        titel: "Create event", unter: schrittText(1), breit: true, isDark: isDark,
        inhaltHtml: '<div class="uev-schritt" data-schritt="1">' + detailFelder(e, true) + '</div>' +
          '<div class="uev-schritt" data-schritt="2" hidden></div>' +
          '<div class="uev-schritt" data-schritt="3" hidden></div>',
        knoepfe: [{ id: "zurueck", text: "Back", art: "sec", aktion: function () { schritt(popup.schritt - 1); return false; } },
                  { id: "weiter", text: "Continue", art: "pri", aktion: function () {
                    var p = popup;
                    if (!schrittOk(p)) return false;
                    if (p.schritt < 3) schritt(p.schritt + 1); else anlegenSenden();
                    return false;
                  } }],
        onClose: popupZu
      });
      api.body.querySelector('.uev-schritt[data-schritt="1"]').__uevGebaut = 1;
      /* Eine eigene Instanz des Topics-Filters je Popup: der Filter merkt sich seine Auswahl je
         Instanz, und ein neues Event soll leer anfangen und nicht mit den Topics des letzten. */
      var p = { art: "anlegen", api: api, e: e, schritt: 1, knopf: "weiter", pops: {}, vorschauen: {},
                topicsId: instanceId + "_neu_" + (++popupNr) };
      sucheBauen(p);
      popupAufbauen(p);
      schritt(1);
    }
    function popupBearbeiten(eid) {
      if (popup) return;
      var ev = state.detail[eid] || listeEvent(eid);
      if (!ev) return;
      var e = { name: String(ev.name || ""), typ: typ(ev).key, text: String(ev.description || ""),
                icon: ZEICHEN[ev.icon] ? ev.icon : null, farbe: farbe(ev) || null, offen: null, urls: [] };
      var alt = { name: e.name, typ: e.typ, text: e.text, icon: e.icon, farbe: e.farbe };
      var api = UC.makeModal({
        titel: "Edit event", breit: true, isDark: isDark,
        inhaltHtml: '<div class="uev-schritt">' + detailFelder(e, false) +
          gesperrtHinweis("The event date and affected scope can't be changed.") + '</div>',
        knoepfe: [{ id: "abbrechen", text: "Cancel", art: "sec" },
                  { id: "speichern", text: "Save", art: "pri", aktion: function () { if (schrittOk(popup)) speichern(); return false; } }],
        onClose: popupZu
      });
      popupAufbauen({ art: "bearbeiten", api: api, e: e, alt: alt, eventId: String(ev.id), knopf: "speichern", pops: {} });
    }
    function popupUrl() {
      if (popup) return;
      var d = dieDetail();
      if (!d) return;
      var api = UC.makeModal({
        titel: "Add URL", breit: true, isDark: isDark,
        inhaltHtml: '<div class="uev-schritt">' +
          '<p class="up-modal-hinweis">' + esc(t("Observations are counted from the event date, also for URLs you add now.")) + '</p>' +
          urlSuche() + '<div class="uev-urlauswahl"></div></div>',
        knoepfe: [{ id: "abbrechen", text: "Cancel", art: "sec" },
                  { id: "hinzu", text: "Add URL", art: "pri", aktion: function () { if (schrittOk(popup)) urlSenden(); return false; } }],
        onClose: popupZu
      });
      var p = { art: "url", api: api, e: { urls: [] }, eventId: String(d.id), knopf: "hinzu", pops: {} };
      sucheBauen(p);
      popupAufbauen(p);
    }

    /* ---- Eingaben im Popup ------------------------------------------------------------------ */
    function popupKlick(ev) {
      var p = popup, x = ev.target;
      if (!p || !x || !x.closest) return;
      var wb = x.closest("[data-wahl]");
      if (wb) {
        var art = wb.getAttribute("data-wahl"), w = wb.closest(".uev-wahl");
        if (!w || !UC.makePopover) return;
        if (w.classList.contains("is-open")) { menueZu(art); return; }
        if (art === "datum") { p.e.monat = null; datumNeu(); }
        p.pops[art] = UC.makePopover({ wrap: w, menu: w.querySelector(".uev-wahlmenu"), opener: wb,
          onClose: function () { wb.setAttribute("aria-expanded", "false"); } });
        p.pops[art].open();
        wb.setAttribute("aria-expanded", "true");
        return;
      }
      var to = x.closest("[data-typ-wahl]");
      if (to) { p.e.typ = to.getAttribute("data-typ-wahl"); menueZu("typ"); typNeu(); pruefenZeigen(); return; }
      var mo = x.closest("[data-monat]");
      if (mo) {
        if (mo.disabled) return;
        var akt = p.e.monat || tagAus(p.e.datum) || grenzen().hi;
        p.e.monat = new Date(akt.getFullYear(), akt.getMonth() + parseInt(mo.getAttribute("data-monat"), 10), 1);
        var dm = im(".uev-datumwahl");
        if (dm) dm.innerHTML = kalender(p.e);
        return;
      }
      var tg = x.closest(".uev-datumwahl [data-tag]");
      if (tg) { if (tg.disabled) return; p.e.datum = tg.getAttribute("data-tag"); menueZu("datum"); datumNeu(); knoepfeSync(); return; }
      var pk = x.closest("[data-pick]");
      if (pk) { var k = pk.getAttribute("data-pick"); p.e.offen = p.e.offen === k ? null : k; aussehenNeu(); return; }
      var ze = x.closest("[data-zeichen]");
      if (ze) {
        var z = ze.getAttribute("data-zeichen");
        /* Das Zeichen des Typs ist keine eigene Wahl: dann folgt es dem Typ weiter. */
        p.e.icon = z === typVon(p.e.typ).icon ? null : z;
        aussehenNeu(); pruefenZeigen();
        return;
      }
      var fa = x.closest("[data-farbe]");
      if (fa) { p.e.farbe = fa.getAttribute("data-farbe") || null; aussehenNeu(); pruefenZeigen(); return; }
      var mod = x.closest("[data-modus]");
      if (mod) {
        var mw = mod.getAttribute("data-modus");
        if (mw === p.e.modus) return;
        p.e.modus = mw; umfangNeu(); vorschauAnfordern();
        return;
      }
      var nz = x.closest("[data-neu-url]");
      if (nz) { urlNehmen(nz.getAttribute("data-neu-url"), true); return; }
      var hit = x.closest(".uev-urltreffer [data-esi]");
      if (hit) { var it = (p.such.treffer || [])[parseInt(hit.getAttribute("data-esi"), 10)]; if (it) urlNehmen(it.url, false); return; }
      var weg = x.closest("[data-url-weg]");
      if (weg) {
        p.e.urls.splice(parseInt(weg.getAttribute("data-url-weg"), 10), 1);
        auswahlZeigen(); trefferZeigen(); pruefenZeigen(); knoepfeSync();
      }
    }
    function popupEingabe(ev) {
      var p = popup, x = ev.target;
      if (!p || !x || !x.matches) return;
      if (x.matches('[data-feld="name"]')) { p.e.name = x.value; knoepfeSync(); return; }
      if (x.matches('[data-feld="text"]')) { p.e.text = x.value; return; }
      if (x.matches(".uev-urlein")) {
        p.such.frage = x.value;
        if (p.maschine) p.maschine.tippen(x.value);
        trefferZeigen();
      }
    }
    /* Enter: im Namen weiter zum naechsten Schritt (wie Speichern im Topic-Dialog), in der Suche
       die eingefuegte Adresse als neues Ziel uebernehmen. */
    function popupTaste(ev) {
      var p = popup, x = ev.target;
      if (!p || ev.key !== "Enter" || !x || !x.matches) return;
      if (x.matches('[data-feld="name"]')) {
        ev.preventDefault();
        var b = p.api.knopf(p.knopf);
        if (b && !b.disabled) b.click();
        return;
      }
      if (x.matches(".uev-urlein")) {
        ev.preventDefault();
        var nz = im(".uev-urltreffer [data-neu-url]:not(.is-taken)");
        if (nz) urlNehmen(nz.getAttribute("data-neu-url"), true);
      }
    }

    /* ---- Abos ----------------------------------------------------------------------------- */
    if (UC.onEvents) UC.onEvents(function () {
      if (state.ansicht === "uebersicht") renderListe(); else { krumenNeu(); renderKopf(); }
    }, root);
    window.addEventListener("popstate", function () { if (root.isConnected) adresseLesen(false); });
    window.addEventListener("up-event-open", function (e) {
      if (!root.isConnected || !e.detail) return;
      oeffnen(e.detail.id, false);
    });
    if (UC.onViewChange) UC.onViewChange(function (name) {
      if (name === "events" && root.isConnected) setTimeout(function () { adresseLesen(true); }, 0);
    });
    if (UC.onResize) UC.onResize(root, function () {
      if (state.ansicht === "uebersicht" && elListe) {
        var n = elListe.querySelectorAll(".uev-karte:not(.is-sk)").length;
        rasterSetzen(n || 3);
      }
    });

    /* ---- Setter --------------------------------------------------------------------------- */
    var ctrl = {
      setDetail: function (raw) {
        var d = objekt(raw);
        if (!d || d.id == null) {
          state.detailLaden = false;
          if (state.ansicht === "detail" && !dieDetail()) state.detailFehler = true;
          renderDetail();
          return false;
        }
        var id = String(d.id), neu = !state.detail[id];
        /* Hat sich die URL-Liste geaendert (URL hinzugefuegt oder entfernt), stimmt die Analyse
           nicht mehr -- Vertrag 3.9: "nach einer URL-Aenderung einfach neu laden". Das macht die
           Komponente selbst, Bubble braucht dafuer keinen zweiten Schritt. */
        function urlSatz(x) { return (x && isArr(x.urls) ? x.urls.map(function (u) { return u.id; }) : []).sort().join(","); }
        var urlsNeu = !neu && urlSatz(state.detail[id]) !== urlSatz(d);
        state.detail[id] = d;
        state.detailLaden = false; state.detailFehler = false;
        persist();
        /* Ein Detail-Objekt ist auch die Antwort auf Anlegen, Bearbeiten, URL hinzufuegen und
           entfernen -- also schliesst es ein wartendes Popup dieser Art. */
        if (wartend.urlWeg && wartend.urlWeg.eventId === id) { var api1 = wartend.urlWeg.api; clearTimeout(wartend.urlWeg.uhr); wartend.urlWeg = null; api1.schliessen(); }
        popupDetailKam(d, neu);
        if (state.ansicht === "detail" && state.eventId === id) {
          if (urlsNeu) { analyseAnfordern(); responsesAnfordern(false, true); }
          renderDetail();
          if (!urlsNeu && isArr(d.urls) && d.urls.length) responsesAnfordern();
        }
        return true;
      },
      setAnalysis: function (raw) {
        var a = objekt(raw);
        state.analyseLaden = false;
        if (!a || (a.event_id == null && !a.windows)) {
          state.analyseFehler = true;
          if (state.ansicht === "detail") renderDetail();
          return false;
        }
        state.analyseFehler = false;
        var w = a.windows || {};
        var id = String(a.event_id || state.eventId), fen = num(w.window_days) || state.fenster;
        /* Unter dem Schluessel ablegen, fuer den sie bestellt war: Event, Fenster, Filter. Eine
           Antwort fuer ein anderes Fenster (spaete Antwort nach schnellem Umschalten) ueberschreibt
           so nicht die aktuelle. */
        var sig = [id, fen, (state.modelle || []).join(","), (state.maerkte || []).join(",")].join("|");
        state.analyse[sig] = a;
        persist();
        if (state.ansicht === "detail" && state.eventId === id) renderDetail();
        return true;
      },
      setVorschau: function (raw) {
        var v = objekt(raw);
        popupVorschauKam(v && num(v.affected_prompt_count) != null ? num(v.affected_prompt_count) : null);
        return !!v;
      },
      setFehler: function (code) {
        var txt = fehlerText(code);
        if (wartend.del) { clearTimeout(wartend.del.uhr); wartend.del.api.busy("ok", false); wartend.del.api.fehler(txt); wartend.del = null; return true; }
        if (wartend.urlWeg) { clearTimeout(wartend.urlWeg.uhr); wartend.urlWeg.api.busy("ok", false); wartend.urlWeg.api.fehler(txt); wartend.urlWeg = null; return true; }
        if (popupFehlerKam(txt, code)) return true;
        /* Kein offenes Popup wartet: das Event selbst ist weg oder nicht erreichbar. */
        if (String(code) === "impact_event_not_found" && state.ansicht === "detail") { state.detailFehler = true; renderDetail(); }
        if (UC.toast) UC.toast(txt);
        return true;
      },
      setGeloescht: function (raw) {
        var r = objekt(raw);
        var id = r && r.ok === true ? String(r.deleted_event_id || (wartend.del && wartend.del.id) || "") : "";
        if (!id) { if (wartend.del) { clearTimeout(wartend.del.uhr); wartend.del.api.busy("ok", false); wartend.del.api.fehler(fehlerText("")); wartend.del = null; } return false; }
        state.geloescht[id] = 1;
        delete state.detail[id];
        persist();
        if (wartend.del) { var api2 = wartend.del.api; clearTimeout(wartend.del.uhr); wartend.del = null; api2.schliessen(); }
        if (state.ansicht === "detail" && state.eventId === id) zurUebersicht(true); else renderListe();
        return true;
      },
      setLoading: function (teil, v) {
        var an = UC.isYes ? UC.isYes(v) : (v === true || v === "yes");
        if (teil === "analysis") { state.analyseLaden = an; if (an) state.analyseFehler = false; }
        if (teil === "detail") { state.detailLaden = an; if (an) state.detailFehler = false; }
        if (state.ansicht === "detail") renderDetail();
        return true;
      },
      reset: function () {
        state.detail = {}; state.analyse = {}; state.respUrl = ""; state.geloescht = {};
        persist();
        zurUebersicht(false);
        return true;
      },
      oeffnen: function (id) { oeffnen(id, true); return true; },
      state: state, root: root, fire: fire, body: body, isDark: isDark, typ: typ, zeichen: zeichen, farbe: farbe,
      dieDetail: dieDetail, analyseAnfordern: analyseAnfordern, responsesAnfordern: responsesAnfordern,
      renderDetail: renderDetail, renderListe: renderListe, oeffnenIntern: oeffnen
    };
    root.__uevController = ctrl;

    /* Erster Stand: die Adresse entscheidet. fire.spaet fuer einen Tiefenlink -- beim
       Seitenaufbau stehen Bubbles Empfaenger oft noch nicht. */
    if (adresseEvent()) oeffnen(adresseEvent(), false, true); else baueUebersicht();
    krumenNeu();
    if (spaet && spaet.drain) spaet.drain(instanceId, ctrl);
    return ctrl;
  }

  /* Aufrufe, deren Instanz noch nicht im Dokument steht, warten hier und werden nachgeholt. */
  var spaet = UC.makeLate ? UC.makeLate("events", ".uev-root") : null;

  var mount;
  mount = UC.makeMount({
    onMount: function (m) { mount = m; },
    rootClass: "uev-root", notPortal: true,
    ctrlProp: "__uevController",
    resolveLocal: "__uevResolveLocal",
    queue: "__uevBootQueue",
    initRoot: initRoot,
    api: {
      setEventDetail:       function (id, p) { return jede(id, p, function (c, v) { c.setDetail(v); }); },
      setEventAnalysis:     function (id, p) { return jede(id, p, function (c, v) { c.setAnalysis(v); }); },
      setEventScopePreview: function (id, p) { return jede(id, p, function (c, v) { c.setVorschau(v); }); },
      setEventDeleted:      function (id, p) { return jede(id, p, function (c, v) { c.setGeloescht(v); }); },
      /* setEventError("impact_event_url_duplicate") -- so steht es im Vertrag (1.1), ohne Instanz.
         Mit zwei Argumenten wie jeder andere Setter: (instanz, code). */
      setEventError:        function (a, b) {
        if (b === undefined) return alle(function (c) { c.setFehler(a); });
        return jede(a, b, function (c, v) { c.setFehler(v); });
      },
      setEventsLoading:     function (id, teil, v) { return jede(id, teil, function (c, x) { c.setLoading(x, v); }); },
      resetEvents:          function (id) { return jede(id, null, function (c) { c.reset(); }); }
    }
  });
  function jede(id, wert, fn) {
    var roots = mount.rootsWithId(String(id == null ? "default" : id).trim());
    if (!roots.length) {
      if (spaet) return spaet.park(id == null ? "default" : id, function (c) { fn(c, wert); });
      return false;
    }
    roots.forEach(function (r) { var c = initRoot(r); if (c) fn(c, wert); });
    return true;
  }
  function alle(fn) {
    var roots = mount.roots ? mount.roots() : [];
    roots.forEach(function (r) { var c = initRoot(r); if (c) fn(c); });
    return roots.length > 0;
  }
  if (UC.watchRoots) UC.watchRoots("uev-root", function () {
    [].forEach.call(document.querySelectorAll(".uev-root"), initRoot);
  });
  }

  uevBoot(30);
})();
