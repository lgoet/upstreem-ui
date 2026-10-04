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
  /* Woher diese Datei kam: daneben liegen die Beispieldaten des Klick-Dummys (events-demo.js).
     currentScript gibt es nur waehrend des ersten Durchlaufs -- darum hier ganz oben. */
  var EIGENE_URL = (document.currentScript && document.currentScript.src) || "";

  /* ---- Boot-Stubs (STYLEGUIDE §25), VOR der core-Pruefung ---------------------------------- */
  var API_NAMES = ["setEventDetail", "setEventAnalysis", "setEventScopePreview", "setEventError",
                   "setEventDeleted", "setEventResponses", "setEventsLoading", "resetEvents"];
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
    /* Der Umschlag der RPC ({"json": "<Text>"}) statt seines Feldes json (04.10.): wer in Bubble
       "Result of step 1" statt "Result of step 1's json" einsetzt, schickt das Ganze. Gemessen
       ergab das "Die Zahl der Prompts konnte nicht geladen werden" -- der Inhalt steckt aber
       vollstaendig darin, also wird er ausgepackt statt verworfen. */
    if (v && typeof v === "object" && !isArr(v) && v.json != null && Object.keys(v).length === 1) {
      return typeof v.json === "object" ? v.json : objekt(v.json);
    }
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
  function datum(s) { return s ? (UC.fmtDate ? UC.fmtDate(String(s).slice(0, 10)) : String(s).slice(0, 10)) : "–"; }
  function zahl(v) { v = num(v); return v == null ? "–" : (UC.fmtInt ? UC.fmtInt(v) : String(Math.round(v))); }

  /* Typ, Zeichen, Farbe eines Events. Das Zeichen aus dem Typ -- NIE das Feld icon der Datenbank,
     solange es kein bekannter Zeichenname ist: dort stehen Emojis, und Emojis gehoeren nicht in
     die Oberflaeche (Entscheidung 1). */
  function typ(ev) { return UC.eventTyp ? UC.eventTyp(ev && ev.event_type) : { key: "other", label: "Other", icon: "pin", gruppe: "other" }; }
  var ZEICHEN = {};
  /* Die Zeichen der 19 Typen und eines mehr: mail fuer den Newsletter -- im Popup stehen damit zwei
     volle Reihen zu zehn (03.10. angefordert: "immer einheitlich viele"). */
  var ZEICHEN_EXTRA = ["mail"];
  (UC.EVENT_TYPEN || []).forEach(function (x) { ZEICHEN[x.icon] = 1; });
  ZEICHEN_EXTRA.forEach(function (k) { ZEICHEN[k] = 1; });
  function zeichen(ev) {
    var ic = ev && ev.icon;
    return ic && ZEICHEN[ic] ? ic : typ(ev).icon;
  }
  function farbe(ev) {
    var c = ev && ev.color;
    return c && /^#[0-9a-f]{6}$/i.test(String(c)) ? String(c) : "";
  }
  /* Der Umfang nach dem Vertrag (3.1): Topics, Prompts, URLs -- als einzelne Angaben, die Zahl
     betont, getrennt durch Abstand (03.10.: keine Mittelpunkte als Trenner). Bei "all" steht "All
     active Prompts" statt der Topics; ohne URLs faellt der Teil weg statt "0 URLs" zu sagen
     (Spezifikation 15). */
  function umfangTeile(ev) {
    var l = [];
    if (ev.scope_mode === "all") l.push({ text: t("All active Prompts") });
    else if (num(ev.selected_topic_count) != null) l.push({ n: num(ev.selected_topic_count), eins: "{n} Topic", viele: "{n} Topics" });
    if (num(ev.affected_prompt_count) != null) l.push({ n: num(ev.affected_prompt_count), eins: "{n} Prompt", viele: "{n} Prompts" });
    var u = num(ev.affected_url_count != null ? ev.affected_url_count : (isArr(ev.urls) ? ev.urls.length : null));
    if (u) l.push({ n: u, eins: "{n} URL", viele: "{n} URLs" });
    return l;
  }
  /* Als reiner Text (Tooltips, Vorlesen): mit Komma. */
  function umfang(ev) {
    return umfangTeile(ev).map(function (x) { return x.text || ersetze(t(x.n === 1 ? x.eins : x.viele), { n: zahl(x.n) }); }).join(", ");
  }
  function umfangHtml(ev, klasse) {
    return '<span class="uev-zahlen' + (klasse ? " " + klasse : "") + '">' + umfangTeile(ev).map(function (x) {
      if (x.text) return '<span class="uev-zahl-teil">' + esc(x.text) + '</span>';
      return '<span class="uev-zahl-teil">' + esc(t(x.n === 1 ? x.eins : x.viele)).replace("{n}", '<span class="uev-zahl-n">' + esc(zahl(x.n)) + '</span>') + '</span>';
    }).join("") + '</span>';
  }
  /* Datum und Typ -- in der Karte und im Kopf des Details dieselben. Vor dem Datum ein kleines
     Kalender-Zeichen (03.10.), der Typ OHNE Zeichen in einer leisen Marke aus core (03.10.: "den
     Typ ohne Icon davor in einem kleinen Chip"); sein Zeichen steht ohnehin gross im Profilbild. */
  function angabenHtml(ev, klasse) {
    var tp = typ(ev);
    return '<div class="uev-angaben' + (klasse ? " " + klasse : "") + '">' +
      '<span class="uev-angabe uev-angabe-datum">' + UC.icon("calendar", 2) + '<span>' + esc(datum(ev.event_date)) + '</span></span>' +
      '<span class="up-marke is-leise" data-i18n="' + esc(tp.label) + '">' + esc(t(tp.label)) + '</span>' +
    '</div>';
  }
  /* Der Umfang als Kennzahlen-Raster (Vorlage des Nutzers vom 03.10.: Bezeichnung ueber dem Wert).
     Immer drei Zellen an derselben Stelle, auch bei 0 URLs -- in einer Reihe Karten sucht das Auge
     die Zahl dort, wo sie auf der Nachbarkarte stand; der Vertrag (3.1) zeigt die URLs ebenfalls
     immer. Fehlt ein Wert ganz, steht ein Halbgeviertstrich statt einer erfundenen 0. */
  function kennzahlenHtml(ev) {
    var tc = num(ev.selected_topic_count), pc = num(ev.affected_prompt_count);
    var uc = num(ev.affected_url_count != null ? ev.affected_url_count : (isArr(ev.urls) ? ev.urls.length : null));
    var zellen = [
      ["Topics", ev.scope_mode === "all" ? t("All") : (tc != null ? zahl(tc) : "\u2013")],
      ["Prompts", pc != null ? zahl(pc) : "\u2013"],
      ["URLs", uc != null ? zahl(uc) : "\u2013"]
    ];
    return '<dl class="uev-stats">' + zellen.map(function (z) {
      return '<div class="uev-stat"><dt>' + esc(t(z[0])) + '</dt><dd>' + esc(z[1]) + '</dd></div>';
    }).join("") + '</dl>';
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
  /* Kurz und in der Reihenfolge, in der man die Seite liest: was ein Event ist, womit verglichen
     wird, wie man das Ergebnis liest. */
  var SEITE_SAETZE = [
    "An event marks a change, such as a relaunch or a campaign. Upstreem compares your AI performance before and after its date.",
    "Affected prompts are the prompts in the topics you chose. The comparison group is your other active prompts, which the event did not touch. They show what would have happened anyway.",
    "If the affected prompts improve more than the comparison group, the event likely made the difference. The analysis window sets how many days before and after are compared."
  ];
  /* DIE ZEICHNUNG IM HELLEN FELD DER KARTE (03.10., dritte Fassung). Wie das Liniendiagramm der
     App im Kleinen: weiche Kurven (Catmull-Rom, als Bezier vorgerechnet), leise Hilfslinien, unter
     der betroffenen Kurve eine Flaeche, die nach unten auslaeuft, Endpunkte wie die Kurvenenden im
     Chart, der Event-Pin wie im echten Diagramm (Kachel 22, Radius 6, Zeichen der Events) mit
     punktierter Linie. Die beiden Kurven laufen vor dem Event mit Abstand nebeneinander (12px) und
     gehen danach deutlich auseinander -- ohne Beschriftung "Effect", das Bild sagt es selbst
     (03.10.: "nicht noetig", "die Linien liegen zu nah beieinander").
     Alles in currentColor (die Schrift des hellen Felds), Kachel und Ring in dessen Grund
     (--vc-inverse-ink) -- dreht also mit hell und dunkel. Das Zeichen im Pin kommt aus core. */
  var VIS_VGL = "M8,92 C17.2,91.7 44.7,89.8 63,90 C81.3,90.2 99.7,92.8 118,93 C136.3,93.2 154.7,91.5 173,91 C191.3,90.5 209.7,90 228,90 C246.3,90 264.7,91 283,91 C301.3,91 319.7,90 338,90 C356.3,90 374.7,91 393,91 C411.3,91 438.8,90.2 448,90";
  var VIS_BET = "M8,79 C17.2,78.7 44.7,76.8 63,77 C81.3,77.2 99.7,79.8 118,80 C136.3,80.2 154.7,78.5 173,78 C191.3,77.5 209.7,79 228,77 C246.3,75 264.7,69.7 283,66 C301.3,62.3 319.7,58.5 338,55 C356.3,51.5 374.7,48 393,45 C411.3,42 438.8,38.3 448,37";
  function seiteZeichnung() {
    var pin = UC.iconFormen ? UC.iconFormen("tickets") : "";
    var grund = 'style="fill:var(--vc-inverse-ink)"';
    function legLinie(gestrichelt) {
      return '<svg class="uev-vis-linie" viewBox="0 0 18 4" aria-hidden="true"><line x1="1" y1="2" x2="17" y2="2" stroke="currentColor" stroke-width="2" stroke-linecap="round"' +
        (gestrichelt ? ' stroke-dasharray="3 3" stroke-opacity=".55"' : '') + '/></svg>';
    }
    return '<div class="up-explain-vis uev-seite-vis">' +
      '<svg class="uev-vis-chart" viewBox="0 0 456 124" aria-hidden="true">' +
        '<defs><linearGradient id="uevVisFlaeche" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0" stop-color="currentColor" stop-opacity=".12"/><stop offset="1" stop-color="currentColor" stop-opacity="0"/>' +
        '</linearGradient></defs>' +
        '<line x1="0" y1="44" x2="456" y2="44" stroke="currentColor" stroke-opacity=".07" stroke-dasharray="2 4"/>' +
        '<line x1="0" y1="74" x2="456" y2="74" stroke="currentColor" stroke-opacity=".07" stroke-dasharray="2 4"/>' +
        '<line x1="0" y1="104.5" x2="456" y2="104.5" stroke="currentColor" stroke-opacity=".16"/>' +
        '<path d="' + VIS_BET + ' L448,104 L8,104 Z" fill="url(#uevVisFlaeche)"/>' +
        '<line x1="228" y1="33" x2="228" y2="104" stroke="currentColor" stroke-opacity=".4" stroke-width="1.5" stroke-dasharray="0.5 4" stroke-linecap="round"/>' +
        '<path d="' + VIS_VGL + '" fill="none" stroke="currentColor" stroke-opacity=".5" stroke-width="2" stroke-dasharray="4 4" stroke-linecap="round"/>' +
        '<path d="' + VIS_BET + '" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"/>' +
        '<circle cx="448" cy="90" r="3.5" ' + grund + ' stroke="currentColor" stroke-opacity=".55" stroke-width="1.5"/>' +
        '<circle cx="448" cy="37" r="4.5" fill="currentColor" stroke="var(--vc-inverse-ink)" stroke-width="2"/>' +
        '<rect x="217" y="8.5" width="22" height="22" rx="6" ' + grund + ' stroke="currentColor" stroke-opacity=".22"/>' +
        '<svg x="222" y="13.5" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity=".85">' + pin + '</svg>' +
        '<text x="118" y="121" text-anchor="middle" fill="currentColor" fill-opacity=".5" font-size="11" font-weight="500">' + esc(t("Before")) + '</text>' +
        '<text x="338" y="121" text-anchor="middle" fill="currentColor" fill-opacity=".5" font-size="11" font-weight="500">' + esc(t("After")) + '</text>' +
      '</svg>' +
      '<div class="uev-seite-legende">' +
        '<span class="uev-vis-eintrag">' + legLinie(false) + esc(t("Affected prompts")) + '</span>' +
        '<span class="uev-vis-eintrag">' + legLinie(true) + esc(t("Comparison group")) + '</span>' +
      '</div></div>';
  }
  var ERKLAERUNG = {
    vergleich: { h: "Comparison", t: "Upstreem compares the affected Prompts with other eligible Prompts that were active when this event was created." },
    /* Die Spalte "First cited" der URL-Tabelle (03.10.: "bitte einen Explainer, der die Metrik
       erklaert"). Beispielwerte oben wie in jeder Spaltenerklaerung. */
    zitiert: { h: "First cited", t: "When an AI response first cited this URL for the affected prompts after the event. \u201cAlready cited before\u201d means it was also cited in the six months before the event.",
      chips: [{ text: "After 10 days (18. Sep 2026)", ja: true }, { text: "Not yet" }] }
  };
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
  /* ---- Der Klick-Dummy (data-demo="yes", 03.10. angefordert) -----------------------------
     Die Beispieldaten liegen in einer eigenen Datei neben dieser und kommen nur, wenn eine
     Komponente sie will -- 100 KB, die sonst jede Seite der App mitlaedt. Der Pfad ist der dieser
     Datei: aus dem Loader (__upAssetsLoaded, auch bei .min.js) oder aus currentScript. */
  var DEMO_WARTE = [], demoLaeuft = false, DEMO_MS = 350;
  /* Eine Datei NEBEN dieser (Beispieldaten, Titelbilder): derselbe Pin wie events.js. */
  function nebenUrl(datei) {
    var geladen = window.__upAssetsLoaded && window.__upAssetsLoaded["events.js"];
    var u = String(geladen || EIGENE_URL || "").replace(/[?#].*$/, "");
    return /events(\.min)?\.js$/.test(u) ? u.replace(/events(\.min)?\.js$/, datei) : datei;
  }
  function demoUrl() { return nebenUrl("events-demo.js"); }

  /* DIE TITELBILDER (03.10.: "ein Titelbild fuer die Events, dort wo jetzt der Hintergrund mit
     wenig Deckkraft steht -- die Auswahl aus den SVGs anbei"). Sechs Motive des Nutzers, als
     Dateien neben dieser (event-covers/), gespeichert wird nur der Schluessel (Feld cover).
     pos ist die senkrechte Lage im Band: das Band ist viel flacher als das Bild (16:9), und bei den
     Wellen soll die Kante zu sehen sein -- sie liegt je Motiv woanders (Mitte der Welle in Prozent
     der Bildhoehe). Die Mosaike sind ueberall gleich dicht, dort die Mitte. */
  var COVERS = [
    { key: "wave_blue", datei: "wave-blue.svg", pos: "55%", label: "Blue wave" },
    { key: "wave_pink", datei: "wave-pink.svg", pos: "78%", label: "Pink wave" },
    { key: "wave_teal", datei: "wave-teal.svg", pos: "70%", label: "Teal wave" },
    { key: "poly_blue", datei: "poly-blue.svg", pos: "50%", label: "Blue mosaic" },
    { key: "poly_pink", datei: "poly-pink.svg", pos: "50%", label: "Pink mosaic" },
    { key: "poly_sand", datei: "poly-sand.svg", pos: "50%", label: "Sand mosaic" }
  ];
  function coverVon(ev) {
    var k = ev && ev.cover;
    for (var i = 0; i < COVERS.length; i++) if (COVERS[i].key === k) return COVERS[i];
    return null;
  }
  /* Ein unbekannter Schluessel (aelterer Stand, Tippfehler in der Datenbank) ergibt kein Bild --
     dann steht das Band in der Event-Farbe wie ohne Titelbild. */
  function coverUrl(c) { return nebenUrl("event-covers/" + c.datei); }
  function coverStil(c) {
    return c ? "background-image:url(" + coverUrl(c) + ");background-position:50% " + c.pos : "";
  }
  /* MIT SKELETT, BIS DAS BILD DA IST (03.10.): ein Hintergrundbild meldet nicht, wann es geladen
     ist -- also laedt jedes Motiv EINMAL ueber ein Image-Objekt vor, und bis dahin steht an seiner
     Stelle das Skelett aus core (--vc-sk, uutpulse; Klasse is-laedt). Ist es da, bekommen alle
     Elemente mit diesem Motiv (data-cover-bild) das Bild auf einen Schlag; was danach gezeichnet
     wird, bekommt es sofort. Laedt ein Motiv nicht, faellt das Band auf die Event-Farbe zurueck
     (has-cover weg) statt grau zu bleiben. */
  var COVER_STAND = {};
  function coverLaden(c) {
    if (!c || COVER_STAND[c.key]) return;
    COVER_STAND[c.key] = "laedt";
    var img = new Image();
    img.onload = function () { COVER_STAND[c.key] = "da"; coverEinsetzen(c); };
    img.onerror = function () { COVER_STAND[c.key] = "fehler"; coverEinsetzen(c); };
    img.src = coverUrl(c);
  }
  function coverEinsetzen(c) {
    var els = document.querySelectorAll('[data-cover-bild="' + c.key + '"]');
    for (var i = 0; i < els.length; i++) {
      els[i].classList.remove("is-laedt");
      if (COVER_STAND[c.key] === "da") { els[i].style.backgroundImage = "url(" + coverUrl(c) + ")"; els[i].style.backgroundPosition = "50% " + c.pos; }
      else els[i].classList.remove("has-cover");
    }
  }
  /* Klasse und Attribute eines Elements, das ein Motiv zeigt: das Bild nur, wenn es schon geladen
     ist, sonst das Skelett. */
  function coverTeile(c) {
    if (!c) return { klasse: "", attr: "" };
    coverLaden(c);
    var st = COVER_STAND[c.key];
    return { klasse: st === "da" ? " has-cover" : (st === "fehler" ? "" : " has-cover is-laedt"),
             attr: ' data-cover-bild="' + c.key + '"' + (st === "da" ? ' style="' + esc(coverStil(c)) + '"' : '') };
  }
  function demoHolen(fertig) {
    if (window.__uevDemo) { fertig(window.__uevDemo); return; }
    DEMO_WARTE.push(fertig);
    if (demoLaeuft) return;
    demoLaeuft = true;
    function alle() {
      demoLaeuft = false;
      var l = DEMO_WARTE; DEMO_WARTE = [];
      l.forEach(function (f) { try { f(window.__uevDemo || null); } catch (e) {} });
    }
    var sc = document.createElement("script");
    sc.src = demoUrl(); sc.async = true; sc.onload = alle; sc.onerror = alle;
    (document.head || document.documentElement).appendChild(sc);
  }

  /* Der dritte Wert jedes Setters: Bubbles "error body" (04.10.). Bei Erfolg ist er leer -- dann
     zaehlt allein die Antwort. So braucht der Workflow keinen zweiten Schritt mit "Only when". */
  function fehlerDa(f) {
    var s = String(f == null ? "" : f).trim().toLowerCase();
    /* "no"/"false": dort steht "returned an error" statt "error body" (04.10. gemessen: mit "no"
       meldete der Zaehler bei einer gueltigen Antwort einen Fehler). Das Feld sagt dasselbe --
       kein Fehler --, also wird es auch so gelesen. "yes" bleibt ein Fehler ohne Text. */
    return s !== "" && s !== "null" && s !== "undefined" && s !== "no" && s !== "false";
  }

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
    "Event type": "Event-Typ", "Event types": "Event-Typen", "Search types…": "Typen durchsuchen…",
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
    "Affected URLs": "Betroffene URLs",
    "Pages, articles or external sources associated with this event. Global share is measured in the affected prompts.":
      "Seiten, Artikel oder externe Quellen zu diesem Event. Der Global Share zählt in den betroffenen Prompts.",
    "First cited": "Erstmals zitiert", "Global share before": "Global Share vorher", "Global share after": "Global Share nachher",
    "On event day": "Am Event-Tag", "After {n} days ({date})": "Nach {n} Tagen ({date})", "After 1 day ({date})": "Nach 1 Tag ({date})",
    "Already cited before": "Schon vorher zitiert", "After 10 days (18. Sep 2026)": "Nach 10 Tagen (18. Sep 2026)",
    "When an AI response first cited this URL for the affected prompts after the event. \u201cAlready cited before\u201d means it was also cited in the six months before the event.":
      "Wann eine KI-Antwort diese URL nach dem Event zum ersten Mal für die betroffenen Prompts zitiert hat. \u201eSchon vorher zitiert\u201c heißt: auch in den sechs Monaten vor dem Event.",
    "Not yet": "Noch nicht", "Not within 6 months": "Nicht in 6 Monaten",
    "No URLs added yet": "Noch keine URLs",
    "Add pages, articles or external sources associated with this event.":
      "Füge Seiten, Artikel oder externe Quellen zu diesem Event hinzu.",
    "Event scope": "Umfang des Events", "Affected topics": "Betroffene Topics",
    "All active Prompts at event creation": "Alle aktiven Prompts beim Anlegen",
    "Upstreem compares the affected Prompts with other eligible Prompts that were active when this event was created.":
      "Upstreem vergleicht die betroffenen Prompts mit anderen passenden Prompts, die beim Anlegen des Events aktiv waren.",
    "Responses citing affected URLs": "Responses mit betroffenen URLs",
    "Tracked AI responses that cite one or more URLs associated with this event.":
      "Getrackte AI-Antworten, die eine oder mehrere URLs dieses Events zitieren.",
    "All affected URLs": "Alle betroffenen URLs",
    "Limited baseline ({n} days)": "Begrenzte Vergleichsbasis ({n} Tage)",
    "Less historical data is available before this event for the selected period.":
      "Vor diesem Event gibt es für den gewählten Zeitraum weniger historische Daten.",
    "No comparable data yet": "Noch keine vergleichbaren Daten",
    "{n} other event in this period": "{n} weiteres Event in diesem Zeitraum",
    "{n} other events in this period": "{n} weitere Events in diesem Zeitraum",
    "{n} prompt was added after the event. It appears in the chart, but not in the before and after numbers.":
      "{n} Prompt kam erst nach dem Event dazu. Er steht in der Kurve, aber nicht in den Vorher-Nachher-Zahlen.",
    "{n} prompts were added after the event. They appear in the chart, but not in the before and after numbers.":
      "{n} Prompts kamen erst nach dem Event dazu. Sie stehen in der Kurve, aber nicht in den Vorher-Nachher-Zahlen.",
    "This topic was deleted after the event was created. Its prompts still count.":
      "Dieses Topic wurde nach dem Anlegen des Events gelöscht. Seine Prompts zählen weiter.",
    "{n} Prompts deleted since": "{n} Prompts inzwischen gelöscht",
    "vs. comparison": "vs. Vergleich", "Comparison group": "Vergleichsgruppe", "No comparison group": "Keine Vergleichsgruppe",
    "How event analysis works": "So funktioniert die Event-Analyse",
    "An event marks a change, such as a relaunch or a campaign. Upstreem compares your AI performance before and after its date.":
      "Ein Event markiert eine Änderung, etwa einen Relaunch oder eine Kampagne. Upstreem vergleicht deine AI Performance vor und nach dem Datum.",
    "Affected prompts are the prompts in the topics you chose. The comparison group is your other active prompts, which the event did not touch. They show what would have happened anyway.":
      "Betroffene Prompts sind die Prompts in den gewählten Topics. Die Vergleichsgruppe sind deine übrigen aktiven Prompts, die das Event nicht berührt. Sie zeigen, was ohnehin passiert wäre.",
    "If the affected prompts improve more than the comparison group, the event likely made the difference. The analysis window sets how many days before and after are compared.":
      "Steigen die betroffenen Prompts stärker als die Vergleichsgruppe, hat das Event wahrscheinlich den Unterschied gemacht. Das Analysefenster legt fest, wie viele Tage davor und danach verglichen werden.", "Search URLs…": "URLs durchsuchen…", "Filter by URL": "Nach URL filtern",
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
    "Optional": "Optional", "Select a date": "Datum wählen",
    "Event icon": "Event-Symbol", "Event color": "Event-Farbe", "e.g. Website relaunch": "z. B. Website-Relaunch",
    "What changed?": "Was hat sich geändert?", "Description": "Beschreibung", "Selected topics": "Ausgewählte Topics",
    "Affected scope": "Betroffener Umfang", "Edit event": "Event bearbeiten",
    "Search your URLs or paste a link": "Eigene URLs durchsuchen oder Link einfügen",
    "Date and scope can't be changed later": "Datum und Umfang später nicht änderbar",
    "Date and scope can't be changed": "Datum und Umfang nicht änderbar",
    "Select a type": "Typ wählen", "Create without URLs?": "Ohne URLs anlegen?",
    "Cover image": "Titelbild", "Remove cover": "Titelbild entfernen",
    "Blue wave": "Blaue Welle", "Pink wave": "Rosa Welle", "Teal wave": "Petrol-Welle",
    "Blue mosaic": "Blaues Mosaik", "Pink mosaic": "Rosa Mosaik", "Sand mosaic": "Sandfarbenes Mosaik",
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
      "Beobachtungen zählen ab dem Event-Datum, auch für URLs, die du jetzt hinzufügst.",
    "{n} days": "{n} Tage", "Preview": "Vorschau", "Untitled event": "Unbenanntes Event",
    "{n} of {total} selected": "{n} von {total} ausgewählt",
    /* 03.10.: Typ-Auswahl mit eigenem Typ, Klick-Dummy, Ende des Wartens */
    "Search types": "Typen durchsuchen", "No types found": "Keine Typen gefunden", "Your type": "Dein Typ",
    "Example data": "Beispieldaten", "Example data. Nothing you do here is saved.": "Beispieldaten. Nichts, was du hier tust, wird gespeichert.",
    "Events could not be loaded": "Events konnten nicht geladen werden", "Please reload the page.": "Bitte lade die Seite neu."
  });

  /* Spaltenzahl der Karten: nach dem PLATZ (wie response-detail.spalten -- dieselben Schwellen,
     dieselbe Begruendung: ein springendes Raster ist schlimmer als eine kurze letzte Reihe). */
  /* NICHT nach der Zahl der Karten (03.10.: eine einzelne Karte zog sich ueber den ganzen
     Bildschirm). Die Spalten richten sich nur nach dem Platz; eine Karte steht dann in EINER
     Spalte eines Rasters, das fuer mehr gedacht ist -- 300 bis gut 400px breit. */
  /* DIE MITTE der beiden letzten Fassungen (03.10.): erst 300 bis 430px je Karte ("zu schmal"),
     dann 480 bis 620 ("zu breit"). Jetzt hoechstens 500 (events.css) und eine neue Spalte, sobald
     jede mindestens 440 breit waere -- eine Karte liegt damit zwischen rund 390 und 500px. */
  function spalten(breite) {
    return breite >= 1880 ? 4 : breite >= 1360 ? 3 : breite >= 800 ? 2 : 1;
  }

  /* ============================================================================================
     Eine Wurzel
     ============================================================================================ */
  function initRoot(root) {
    if (root.__uevController) return root.__uevController;
    var instanceId = root.getAttribute("data-instance") || "default";
    if (/^[A-Z_]{4,}$/.test(instanceId)) return null;   /* Platzhalter noch nicht ersetzt */

    /* data-demo="yes": jedes Ereignis wird hier im Tab aus events-demo.js beantwortet statt an
       Bubble zu gehen (demoAntwort) -- derselbe Weg durch die Setter wie mit echten Daten. */
    var demo = UC.isYes ? UC.isYes(root.getAttribute("data-demo")) : root.getAttribute("data-demo") === "yes";
    var fireBubble = UC.makeFire(root, { label: "events", eventPrefix: "uev" });
    function fire(attr, name, wert) {
      if (demo) { demoAntwort(name, wert); return true; }
      return fireBubble(attr, name, wert);
    }
    fire.spaet = function (attr, name, wert) {
      if (demo) { demoAntwort(name, wert); return true; }
      return fireBubble.spaet ? fireBubble.spaet(attr, name, wert) : fireBubble(attr, name, wert);
    };
    function topicName(id) {
      var l = UC.getTopics ? UC.getTopics() : [];
      for (var i = 0; i < l.length; i++) if (String(l[i].id) === String(id)) return l[i].name || "";
      return "";
    }
    function demoAntwort(name, wert) {
      var b = {};
      try { b = JSON.parse(wert); } catch (e) {}
      demoHolen(function (D) {
        setTimeout(function () {
          if (root.isConnected === false) return;
          if (!D) { ctrl.setFehler(""); return; }
          var r = D.antwort(name, b, { topicName: topicName, storeZeile: listeEvent }) || {};
          if (r.fehler) ctrl.setFehler(r.fehler);
          if (r.detail) ctrl.setDetail(JSON.stringify(r.detail));
          if (r.analyse) ctrl.setAnalysis(JSON.stringify(r.analyse));
          if (r.vorschau) ctrl.setVorschau(JSON.stringify(r.vorschau));
          if (r.geloescht) ctrl.setGeloescht(JSON.stringify(r.geloescht));
          if (r.responses && window.renderResponsesTable) {
            try { window.renderResponsesTable({ instanceId: respInstanz, rows: r.responses, totalCount: r.total }); } catch (e) {}
          }
          if (r.liste && UC.setEvents) UC.setEvents(JSON.stringify(r.liste), "demo");
        }, DEMO_MS);
      });
    }
    function isDark() { return UC.themeParam(root.getAttribute("data-isdark")) || root.getAttribute("data-theme") === "dark"; }
    if (isDark()) root.setAttribute("data-theme", "dark"); else root.removeAttribute("data-theme");
    var tips = UC.makeTooltips ? UC.makeTooltips(root, isDark) : null;
    /* Die Erklaerkarte aus core (UC.makeExplain), dieselbe wie an jedem Spaltenkopf der App: Titel
       und Satz statt einer langen Tooltip-Zeile. */
    if (UC.makeExplain) UC.makeExplain({ root: root, triggerSel: ".uev-erklaer", getIsDark: isDark,
      html: function (key) {
        var e = ERKLAERUNG[key];
        if (!e) return "";
        /* Beispielwerte als die Chips der Tabelle (.up-marke.is-leise, 03.10. angefordert). Die
           Marken stehen an :root und [data-theme] -- die Karte am <body> sieht dieselben Werte. */
        var vis = e.chips ? '<div class="up-explain-vis uev-explain-chips">' + e.chips.map(function (x) {
          return '<span class="up-marke is-leise uev-beob' + (x.ja ? " is-ja" : "") + '">' + esc(t(x.text)) + '</span>'; }).join("") + '</div>' : "";
        return vis + '<div class="up-explain-h">' + esc(t(e.h)) + '</div><div class="up-explain-t">' + esc(t(e.t)) + '</div>';
      } });
    /* DIE ERKLAERUNG DER SEITE (03.10.): ein Info-Knopf links neben der Hauptaktion im Kopf, am
       Zeiger UND per Klick. Die Erklaerkarte aus core, doppelt so breit (496 statt 248, cls
       uev-explain-breit), oben im hellen Feld eine kleine Zeichnung: zwei Kurven, die bis zum
       Event gleichauf laufen und danach auseinandergehen -- genau das, was die Seite misst. */
    var seitenKarte = UC.makeExplain ? UC.makeExplain({ root: root, triggerSel: ".uev-seiteninfo", cls: "uev-explain-breit", getIsDark: isDark,
      html: function () {
        return seiteZeichnung() + '<div class="up-explain-h">' + esc(t("How event analysis works")) + '</div>' +
          SEITE_SAETZE.map(function (x) { return '<div class="up-explain-t">' + esc(t(x)) + '</div>'; }).join("");
      } }) : null;
    /* Per Klick (Touch hat kein Zeigen): oeffnen, wenn zu; schliessen tut ein Druck daneben. */
    document.addEventListener("pointerdown", function (e) {
      if (!seitenKarte || !seitenKarte.el.classList.contains("is-on")) return;
      if (e.target.closest && (e.target.closest(".uev-seiteninfo") || seitenKarte.el.contains(e.target))) return;
      seitenKarte.hide();
    }, true);
    function seitenInfoKnopf() {
      return '<button type="button" class="up-iconbtn uev-seiteninfo" aria-label="' + esc(t("How event analysis works")) + '">' + UC.icon("info", 2) + '</button>';
    }
    if (UC.widthTiers) UC.widthTiers(root, { narrowAt: 760, vnarrowAt: 520 });
    var respInstanz = String(root.getAttribute("data-responses-instance") || "responses_events").trim();

    /* Der Stand dieser Instanz ueberlebt einen Neuaufbau durch Bubble (Themenwechsel baut das
       Element neu) -- dasselbe Muster wie response-detail. */
    var saved = STORE[instanceId] || null;
    function gemerkt(k, sonst) { return saved && saved[k] != null ? saved[k] : sonst; }
    var state = {
      ansicht: "uebersicht", eventId: null,
      suche: gemerkt("suche", ""), typen: gemerkt("typen", []),
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
        '<div class="uev-kopfrechts">' +
          /* Im Klick-Dummy sagt der Kopf es selbst -- sonst haelt jemand die Beispiele fuer die
             eigenen Events. Die Hinweis-Pille der Seite (.up-pille wie "Limited baseline"). */
          (demo ? '<span class="up-sent up-pille uev-hinweis uev-demo" data-tip="' + esc(t("Example data. Nothing you do here is saved.")) + '">' +
            UC.icon("info", 2) + '<span class="up-sent-val">' + esc(t("Example data")) + '</span></span>' : '') +
          '<div class="uev-kopfaktion"></div>' +
        '</div>' +
      '</div>' +
      '<div class="uev-main"></div>';
    var elMain = root.querySelector(".uev-main"), elAktion = root.querySelector(".uev-kopfaktion");
    var krumen = UC.makePageCrumbs ? UC.makePageCrumbs(root, {
      icon: "tickets", name: "Events", komponente: true,
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
    var elListe = null, elZahl = null, elSucheIn = null, elSuche = null, sucheKit = null, typFilter = null;
    function baueUebersicht() {
      elAktion.innerHTML = seitenInfoKnopf() +
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
      /* Der Typ-Filter ist der Marken-Filter der Tabellen (UC.makeAuswahlFilter, 03.10.: "alles
         gleich wie im Selected Brands"). Er zeigt nur Typen, die es in der Liste gibt -- ein Filter
         auf einen Typ ohne Event ist ein toter Eintrag; ein gewaehlter bleibt drin, auch wenn er
         gerade wegfiel. Eigene Typen (frei eingetippt) stehen hinter den festen. */
      typFilter = UC.makeAuswahlFilter ? UC.makeAuswahlFilter({
        klasse: "uev-typfilter", titel: "Event types", alle: "All Types", mehrere: "{n} Types",
        suche: "Search types…", tip: "Event type", gewaehlt: state.typen,
        items: filterTypen,
        onChange: function (keys) { state.typen = keys; persist(); renderListe(); }
      }) : null;
      if (typFilter) elMain.querySelector(".up-head-tools").appendChild(typFilter.el);
      renderListe();
    }
    function filterTypen() {
      var da = {};
      (UC.getEvents ? UC.getEvents() : []).forEach(function (ev) { if (!state.geloescht[ev.id]) da[typ(ev).key] = 1; });
      state.typen.forEach(function (k) { da[k] = 1; });
      var typen = (UC.EVENT_TYPEN || []).filter(function (x) { return da[x.key]; });
      Object.keys(da).forEach(function (k) { var x = typ({ event_type: k }); if (x.eigen) typen.push(x); });
      return typen.map(function (x) { return { key: x.key, label: x.label, icon: x.icon }; });
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
    /* Das "Profilbild" eines Events: sein Zeichen in einer weissen Kachel, in seiner Farbe (ohne
       Farbe in der Schriftfarbe). In der Karte und im Kopf des Details halb ueber dem Farbband. */
    function avatarHtml(ev, groesse) {
      var f = farbe(ev);
      return '<span class="uev-avatar' + (groesse ? " is-" + groesse : "") + '"' + (f ? ' style="--uev-ton:' + esc(f) + '"' : '') + ' aria-hidden="true">' + UC.icon(zeichen(ev), 2) + '</span>';
    }
    function mehrMenue(ev, wo) {
      var kannLoeschen = ev.can_delete === true;
      return '<span class="uev-mehr" data-mehr-wo="' + wo + '">' +
        '<button type="button" class="up-iconbtn uev-mehrbtn" aria-label="' + esc(t("More")) + '" data-tip="' + esc(t("More")) + '">' + UC.icon("moreHorizontal", 2) + '</button>' +
        /* Das Aktionsmenue aus core (.up-aktionsmenue + .up-optrow), dasselbe wie das Menue der
           Mitgliederliste -- vorher erbten die Zeilen hier die 16px der Seite (03.10. gemessen). */
        '<div class="up-menu uev-mehrmenu up-aktionsmenue" role="menu" aria-hidden="true">' +
          '<button type="button" class="up-optrow" role="menuitem" data-aktion="edit" data-event-id="' + esc(ev.id) + '">' + UC.icon("squarePen", 2) + '<span class="up-aktionsmenue-lbl">' + esc(t("Edit")) + '</span></button>' +
          (kannLoeschen ? '<div class="up-aktionsmenue-div"></div><button type="button" class="up-optrow is-gefahr" role="menuitem" data-aktion="delete" data-event-id="' + esc(ev.id) + '">' + UC.icon("trash", 2) + '<span class="up-aktionsmenue-lbl">' + esc(t("Delete")) + '</span></button>' : '') +
        '</div></span>';
    }
    /* DIE KARTE (03.10., nach der Vorlage des Nutzers, einer Profilkarte): oben, mit Abstand zum
       Rand, ein einfarbiges Band in der Event-Farbe mit wenig Deckkraft; darueber halb das Zeichen
       als Profilbild mit einem Ring im Kartengrund. Darunter mit Luft: Name, Datum und Typ als
       Angaben mit Zeichen, die Beschreibung, unten der Umfang als Raster (Bezeichnung ueber dem
       Wert). Das Menue nur beim Ueberfahren -- eine Nebenhandlung, kein Knopf auf der Karte.
       vorschau: dieselbe Karte im Anlegen-Popup, ohne Menue und ohne Klick. */
    function karteHtml(ev, vorschau) {
      var f = farbe(ev), cv = coverVon(ev);
      return '<article class="uev-karte' + (vorschau ? " is-vorschau" : "") + (cv ? " has-cover" : "") + '"' +
          (vorschau ? ' aria-hidden="true"' : ' role="link" tabindex="0" data-event-id="' + esc(ev.id) + '"') +
          (f ? ' style="--uev-ton:' + esc(f) + '"' : '') + '>' +
        (function () { var ct = coverTeile(cv); return '<div class="uev-karte-band' + ct.klasse + '"' + ct.attr + '></div>'; })() +
        (vorschau ? '' : mehrMenue(ev, "karte")) +
        '<div class="uev-karte-body">' +
          avatarHtml(ev) +
          '<h3 class="uev-karte-titel">' + esc(ev.name || "") + '</h3>' +
          angabenHtml(ev, "uev-karte-meta") +
          (ev.description ? '<p class="uev-karte-text">' + esc(ev.description) + '</p>' : '') +
          kennzahlenHtml(ev) +
        '</div>' +
      '</article>';
    }
    /* EIN WARTEN, DAS ENDET (Muster brand-detail: 25s, gezaehlt erst, wenn die Uebersicht zu sehen
       ist). Kommt die Liste nie -- der Schritt im Seitenaufbau fehlt, der Workflow brach ab --,
       lief das Skelett sonst fuer immer, und das sieht aus wie "gleich da" (03.10. so gemeldet:
       "ich seh nur Skeleton Loader"). Im Klick-Dummy kommt die Liste aus der Datei, dort keine Uhr. */
    var LISTE_WARTE_MS = 25000, listeUhrId = null;
    function listeGeladen() { return !!(UC.eventsStand && UC.eventsStand().geladen); }
    function listeUhr() {
      if (listeUhrId || demo || state.listeZeitUm) return;
      listeUhrId = setTimeout(listeAblauf, LISTE_WARTE_MS);
    }
    function listeAblauf() {
      listeUhrId = null;
      if (root.isConnected === false || listeGeladen()) return;
      if (UC.istSichtbar && !UC.istSichtbar(root)) { listeUhrId = setTimeout(listeVerdeckt, 1000); return; }
      state.listeZeitUm = true;
      if (state.ansicht === "uebersicht") renderListe();
    }
    function listeVerdeckt() {
      listeUhrId = null;
      if (root.isConnected === false || listeGeladen()) return;
      if (UC.istSichtbar && UC.istSichtbar(root)) listeUhr(); else listeUhrId = setTimeout(listeVerdeckt, 1000);
    }
    /* DER ZAEHLER IM KOPF wie in jeder Tabelle (brands-overview): sichtbar nur mit has-count an
       .up-heading -- ohne die Klasse blendet core ihn aus, und genau so stand er hier bisher
       unsichtbar im Markup (03.10. gemeldet). Beim Laden das Skelett aus core (.is-sk), danach die
       Zahl der gezeigten Events. */
    function zahlSetzen(n, laedt) {
      if (!elZahl) return;
      var kopf = elZahl.closest(".up-heading");
      elZahl.classList.toggle("is-sk", !!laedt);
      elZahl.textContent = laedt || n == null ? "" : (UC.fmtTotal ? UC.fmtTotal(n) : String(n));
      if (kopf) kopf.classList.toggle("has-count", !!laedt || n != null);
    }
    function renderListe() {
      if (!elListe) return;
      var stand = UC.eventsStand ? UC.eventsStand() : { geladen: true, fehler: false };
      if (typFilter) typFilter.neu();
      if (stand.fehler && !(UC.getEvents && UC.getEvents().length)) {
        zahlSetzen(null);
        elListe.className = "uev-liste";
        elListe.innerHTML = UC.leseFehlerHtml ? UC.leseFehlerHtml("events") : "";
        return;
      }
      if (!stand.geladen) {
        zahlSetzen(null, !state.listeZeitUm);
        if (state.listeZeitUm) {
          elListe.className = "uev-liste";
          elListe.innerHTML = UC.leerHtml({ icon: "info", titel: "Events could not be loaded", text: "Please reload the page." });
          return;
        }
        elListe.className = "uev-liste";
        elListe.innerHTML = karteSkelett();
        rasterSetzen(3);
        listeUhr();
        return;
      }
      var alle = (UC.getEvents ? UC.getEvents() : []).filter(function (ev) { return !state.geloescht[ev.id]; });
      var l = gefiltert();
      zahlSetzen(l.length);
      elListe.className = "uev-liste";
      if (!alle.length) {
        elListe.innerHTML = UC.leerHtml({ icon: "tickets", titel: "No events yet",
          text: "Add important launches, content changes, campaigns or other changes to understand how your AI performance develops around them.",
          knopf: "Create event", knopfAttr: "data-uev-create" });
        return;
      }
      if (!l.length) {
        elListe.innerHTML = UC.leerHtml({ gefiltert: true, was: "events" });
        return;
      }
      /* Nicht l.map(karteHtml): map reicht den Index als zweites Argument durch, und das ist der
         Schalter vorschau -- jede Karte ab der zweiten kam als nicht klickbare Vorschau heraus
         (im Pruefstand am 03.10. gefunden: nur die erste Karte oeffnete das Detail). */
      elListe.innerHTML = '<div class="uev-karten">' + l.map(function (ev) { return karteHtml(ev, false); }).join("") + '</div>';
      rasterSetzen(l.length);
    }
    function rasterSetzen(n) {
      var k = elListe && elListe.querySelector(".uev-karten, .uev-karten-sk");
      if (!k) return;
      k.style.setProperty("--uev-cols", spalten(elListe.clientWidth || root.clientWidth || 1200));
    }
    function karteSkelett() {
      /* Dieselbe Form wie die Karte: Band, Profilbild, Name, Angaben, Text, das Raster. */
      var zelle = '<div class="uev-stat"><span class="uev-sk" style="width:48%"></span><span class="uev-sk uev-sk-wert" style="width:32%"></span></div>';
      var eine = '<div class="uev-karte is-sk"><div class="uev-karte-band uev-sk-band"></div><div class="uev-karte-body">' +
        '<span class="uev-avatar uev-sk-avatar"></span><span class="uev-sk uev-sk-titel" style="width:62%"></span>' +
        '<span class="uev-sk uev-sk-meta" style="width:42%"></span><span class="uev-sk uev-sk-text" style="width:90%"></span><span class="uev-sk" style="width:64%"></span>' +
        '<div class="uev-stats">' + zelle + zelle + zelle + '</div></div></div>';
      return '<div class="uev-karten uev-karten-sk">' + eine + eine + eine + '</div>';
    }

    /* ============================================================================================
       Detail
       ============================================================================================ */
    var linie = null, elChartWrap = null, elLegende = null;
    function baueDetail() {
      linie = null;
      elAktion.innerHTML = seitenInfoKnopf() +
        '<button class="up-btn-sec uev-addurl-kopf" type="button">' + UC.icon("plus", 1.8) + '<span>' + esc(t("Add URL")) + '</span></button>' +
        '<span class="uev-kopfmehr"></span>';
      elMain.innerHTML =
        '<div class="uev-detail">' +
          '<div class="uev-dkopf" data-sek="kopf"></div>' +
          /* Steuerzeile und Kennzahlen als EINE Gruppe (04.10.): Zeitraum und Filter gehoeren zu den
             Zahlen darunter, mit 16px wie zwischen den Karten -- nicht mit den 40 zwischen den
             Abschnitten, mit denen die Zeile vorher zwischen Kopf und Zahlen schwebte. */
          '<div class="uev-steuerblock">' +
          '<div class="uev-steuer">' +
            '<div class="uev-steuer-links">' +
              '<div class="up-seg is-lg uev-fenster" role="group" aria-label="' + esc(t("Analysis window")) + '">' +
                /* "7 days" statt "7D" (03.10.: mit dem grossen D war nicht zu erkennen, was das ist). */
                FENSTER.map(function (f) {
                  return '<button class="up-seg-btn" type="button" data-fenster="' + f + '">' + esc(ersetze(t("{n} days"), { n: f })) + '</button>';
                }).join("") +
              '</div>' +
              /* Models und Markets in der Filterleiste der App (filters/filter-bar.js, "Filters") --
                 dieselbe wie auf jeder Seite (03.10. angefordert). Die Leiste zieht die zwei lokalen
                 Filter ueber ihre Instanz-Ids zu sich; ihre Ereignisse steigen weiter bis elMain. */
              '<div class="uev-filter">' +
                '<div class="up-root ufb-root uev-filterleiste" data-instance="' + esc(instanceId) + '_filters"' +
                  ' data-models-instance="' + esc(instanceId) + '_models" data-markets-instance="' + esc(instanceId) + '_markets"' +
                  ' data-isdark="' + (isDark() ? "yes" : "no") + '"></div>' +
                '<div class="up-root umf-root uev-modelle" data-instance="' + esc(instanceId) + '_models" data-local="yes" data-isdark="' + (isDark() ? "yes" : "no") + '"></div>' +
                '<div class="up-root umk-root uev-maerkte" data-instance="' + esc(instanceId) + '_markets" data-local="yes" data-isdark="' + (isDark() ? "yes" : "no") + '"></div>' +
              '</div>' +
            '</div>' +
            '<div class="uev-hinweise" data-sek="hinweise"></div>' +
          '</div>' +
          '<div class="uev-kpis" data-sek="kpis"></div>' +
          '</div>' +
          '<section class="uev-sek uev-sek-chart">' +
            sekKopf("Performance around event", "How your brand developed in the affected prompts before and after the event.",
              '<div class="up-seg uev-metrik" role="group">' +
                METRIKEN.map(function (m) { return '<button class="up-seg-btn" type="button" data-metrik="' + m.key + '">' + esc(t(m.label)) + '</button>'; }).join("") +
              '</div>') +
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
        /* Die Legende IMMER (04.10.): erst sie sagt, welche Linie die betroffenen Prompts und
           welche die Vergleichsgruppe ist -- unabhaengig von "Legende zeigen" in den Preferences. */
        legendeImmer: true,
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

    /* DER KOPF DES DETAILS (03.10. neu): dieselbe Sprache wie die Karte -- Band in der Event-Farbe,
       das Zeichen gross als Profilbild, darunter Name, Datum und Typ als zwei Angaben mit Zeichen,
       die Beschreibung und der Umfang mit betonten Zahlen. Ein Kasten, kein lose stehender Text. */
    function renderKopf() {
      var el = elMain.querySelector('[data-sek="kopf"]');
      var d = dieDetail() || listeEvent(state.eventId);
      if (!d) {
        el.innerHTML = state.detailFehler
          ? '<div class="uev-fehlerkopf">' + (UC.leseFehlerHtml ? UC.leseFehlerHtml("event") : esc(t("This event could not be loaded."))) +
              '<button type="button" class="up-btn-sec uev-zurueck">' + esc(t("Back to overview")) + '</button></div>'
          : '<div class="up-box uev-hero is-sk"><div class="uev-hero-band uev-sk-band"></div><div class="uev-hero-body">' +
              '<span class="uev-avatar is-gross uev-sk-avatar"></span><span class="uev-sk uev-sk-titel" style="width:36%"></span>' +
              '<span class="uev-sk uev-sk-meta" style="width:22%"></span><span class="uev-sk uev-sk-text" style="width:58%"></span></div></div>';
        elAktion.querySelector(".uev-kopfmehr").innerHTML = "";
        return;
      }
      var f = farbe(d), cv = coverVon(d);
      el.innerHTML =
        '<div class="up-box uev-hero"' + (f ? ' style="--uev-ton:' + esc(f) + '"' : '') + '>' +
          (function () { var ct = coverTeile(cv); return '<div class="uev-hero-band' + ct.klasse + '"' + ct.attr + '></div>'; })() +
          '<div class="uev-hero-body">' +
            avatarHtml(d, "gross") +
            '<h2 class="uev-dkopf-titel">' + esc(d.name || "") + '</h2>' +
            angabenHtml(d, "uev-hero-meta") +
            (d.description ? '<p class="uev-dkopf-text">' + esc(d.description) + '</p>' : '') +
            umfangHtml(d, "uev-hero-zahlen") +
          '</div>' +
        '</div>';
      elAktion.querySelector(".uev-kopfmehr").innerHTML = mehrMenue(d, "kopf");
    }

    /* ============================================================================================
       DIE TEILE DES DETAILS SIND DIE DER APP (03.10. neu gebaut, nachdem der Nutzer zu Recht
       gemeldet hatte, dass hier fast nichts aus core kam). Je Teil das Vorbild:
         Abschnittskopf        .up-sec-head / .up-sec-titles / .up-sec-h / .up-sec-sub (core,
                               variationsSection) -- Titel 14/500, Untertitel 12 in --vc-muted
         Hinweise              .up-sent.up-pille mit Punkt (core) -- wie Tarif und Status
         Kennzahl              UC.kpiKarte; Werte wie in jeder Tabellenzelle: .up-num, UC.sentHtml,
                               .up-rank-group mit Raute; Trend UC.trendChip, "%" statt "pp"
                               (CLAUDE.md 2b, wie brand-detail und brands-overview)
         Tabellen              .up-vartable (core, die Tabelle der Detailseiten): Kopf 40, Zeile 55
         Marke in der Zeile    .up-logo-box + Name, "You" als .up-marke.up-you (core, aus team-orga)
         Zeilenknoepfe         .up-btn-sec.up-rowbtn (core), am Hover der Zeile, in der ersten Zelle
                               wie "Edit" in brands-overview
         Topics                .up-topicchip.is-static mit Topic-Farbe (wie response-detail)
         Erklaerung            .up-th-info + UC.makeExplain (die Karte jeder Spaltenerklaerung)
         URL-Auswahl           UC.makeAuswahlFilter (Bauart "Selected Brands"), Einzelwahl
       ============================================================================================ */
    var HASH = UC.HASH_ICON ? UC.HASH_ICON.replace("<svg ", '<svg class="up-hash" ') : "";
    /* Ein Wert in der Form, die er in jeder Tabellenzelle der App hat. */
    function wertHtml(feld, v) {
      v = num(v);
      if (v == null) return '<span class="up-num is-empty">–</span>';
      if (feld === "sentiment") return UC.sentHtml ? UC.sentHtml(v) : '<span class="up-num">' + Math.round(v) + '</span>';
      if (feld === "rank") {
        /* Rang IMMER mit einer Stelle, auch bei glatt 3 (CLAUDE.md 2b). */
        return '<span class="up-rank-group">' + HASH + '<span class="up-num">' +
          (UC.fmt1 ? UC.fmt1(v) : (Math.round(v * 10) / 10).toFixed(1)) + '</span></span>';
      }
      return '<span class="up-num">' + (UC.fmtPct ? UC.fmtPct(v, 1) : v.toFixed(1) + "%") + '</span>';
    }
    /* Der Trend: beim Prozentwert mit "%", beim Rang umgekehrt (kleiner ist besser), eine Stelle.
       Liefert "" bei 0 -- wie ueberall in der App steht dann kein Chip. */
    function trendHtml(feld, d) {
      return UC.trendChip ? UC.trendChip(d, { decimals: true, inverted: feld === "rank", suffix: feld === "visibility" ? "%" : "" }) : "";
    }
    function sekKopf(titel, desc, rechts, erklaerung) {
      return '<div class="up-sec-head uev-sec-head"><div class="up-sec-titles">' +
          '<span class="up-heading up-sec-h">' + esc(t(titel)) +
            (erklaerung ? '<span class="up-th-info uev-erklaer" data-explain="' + esc(erklaerung) + '">' + UC.icon("info", 2) + '</span>' : '') + '</span>' +
          (desc ? '<span class="up-sec-sub">' + esc(t(desc)) + '</span>' : '') +
        '</div>' + (rechts || '') + '</div>';
    }

    function renderHinweise() {
      var el = elMain.querySelector('[data-sek="hinweise"]'), a = dieAnalyse();
      if (!a) { el.innerHTML = ""; return; }
      var w = a.windows || {}, h = [];
      /* Angaben wie Datum und Typ im Kopf: Zeichen + Text, leise (03.10.: "warum ist jede
         Information in diesen kleinen Chips mit den Punkten davor? Die habe ich sonst nirgendwo"). */
      function angabe(ic, text, tip) {
        return '<span class="uev-angabe"' + (tip ? ' data-tip="' + esc(tip) + '"' : "") + '>' + UC.icon(ic, 2) + '<span>' + esc(text) + '</span></span>';
      }
      if (w.limited_baseline === true) h.push(angabe("info", ersetze(t("Limited baseline ({n} days)"), { n: zahl(w.before_observed_days) }),
        t("Less historical data is available before this event for the selected period.")));
      var ov = isArr(a.overlaps) ? a.overlaps.length : 0;
      if (ov) h.push(angabe("tickets", ersetze(t(ov === 1 ? "{n} other event in this period" : "{n} other events in this period"), { n: ov })));
      el.innerHTML = h.join("");
    }

    function kpiTeile(feld, a) {
      var m = a && a.affected && a.affected[feld] ? a.affected[feld] : {};
      var cd = a && a.comparison_delta ? num(a.comparison_delta[feld]) : null;
      /* Der Vergleich als Trend-Chip aus core, in derselben Einheit wie der Trend neben der Zahl.
         Gleich viel bewegt (Chip leer): ein Strich, kein erfundenes "+0". */
      var fuss = cd == null ? "" : '<span>' + esc(t("vs. comparison")) + '</span>' + (trendHtml(feld, cd) || '<span class="up-num is-empty">–</span>');
      /* Wie die Overview im Agentic Dashboard (03.10.: "aufraeumen, nicht in Cards"): die Zahl mit
         ihrem Trend gegen vorher, darunter EINE Angabe -- der Vergleich mit der Vergleichsgruppe.
         Der Vorher-Wert steht nicht mehr davor; der Trend sagt, wie weit es von dort ging. */
      return { wertHtml: wertHtml(feld, m.after), trendHtml: trendHtml(feld, m.delta), fussHtml: fuss };
    }
    function renderKpis() {
      var el = elMain.querySelector('[data-sek="kpis"]'), a = dieAnalyse();
      if (!a) {
        el.innerHTML = state.analyseFehler && !state.analyseLaden
          ? '<div class="uev-kpifehler">' + (UC.leseFehlerHtml ? UC.leseFehlerHtml("analysis") : "") + '</div>'
          : [0, 1, 2].map(function () { return UC.kpiKarteSkelett("up-box uev-kpi"); }).join("");
        return;
      }
      var leer = !(a.cohort && num(a.cohort.comparable_prompt_count) > 0);
      el.innerHTML = METRIKEN.map(function (m) {
        var teile = leer ? { wertHtml: '<span class="up-num is-empty">–</span>' } : kpiTeile(m.key, a);
        if (leer && m.key === "visibility") teile.fussHtml = esc(t("No comparable data yet"));
        teile.label = m.label;
        /* Je Kennzahl eine Karte, der Kasten aus core (.up-box), Inhalt linksbuendig (04.10.). */
        teile.klasse = "up-box uev-kpi";
        return UC.kpiKarte(teile);
      }).join("");
    }

    /* Ein Farbwert aus den Marken des Themas -- die Kurve braucht ihn als Zeichenkette. */
    function token(name, sonst) {
      var v = "";
      try { v = String(getComputedStyle(root).getPropertyValue(name) || "").trim(); } catch (e) {}
      return v || sonst;
    }
    function renderChart() {
      if (!linie) return;
      var a = dieAnalyse();
      segSetzen();
      if (!a) { if (state.analyseFehler && !state.analyseLaden) linie.empty(t("This event could not be loaded.")); else linie.skeleton(); return; }
      var tr = isArr(a.trend) ? a.trend : [];
      if (!tr.length) { linie.empty(); return; }
      var feld = state.metrik;
      var aName = (a.affected && a.affected.name) || t("Affected prompts");
      /* Die eigene Linie in der PRIMAERFARBE (03.10.: "Linefarbe in Primaerfarbe. Punkt."): die
         Akzent-Tinte aus core, am Standard die Schriftfarbe des Themas -- dieselbe Quelle wie die
         Kurve in brand-detail. Der Vergleich gestrichelt in der VIERTEN Schriftfarbe (03.10.:
         "heller"). Keine
         Event-Farbe fuer Reihen (Spezifikation 29). */
      var tinte = UC.accentInk ? UC.accentInk(root) : token("--vc-text", "#1f1f1b");
      var grau = token("--vc-fourth", "#80858e");
      var ds = [{ label: aName, __id: "affected", __baseColor: tinte, borderColor: tinte,
                  __favicon: a.affected && a.affected.logo_url ? a.affected.logo_url : undefined,
                  data: tr.map(function (p) { return num(p["affected_" + feld]); }) }];
      if (a.comparison) {
        ds.push({ label: t("Comparison"), __id: "comparison", __baseColor: grau, borderColor: grau,
                  __dash: true, data: tr.map(function (p) { return num(p["comparison_" + feld]); }) });
      }
      linie.render({ labels: tr.map(function (p) { return String(p.day).slice(0, 10); }), datasets: ds });
    }

    /* Logo und Name einer Marke wie in brands-overview und power-dashboard (.up-logo-box; laedt das
       Bild nicht, steht der Buchstabe). */
    function markeLogo(m) {
      var ltr = '<span class="up-logo-ltr">' + esc(String(m.name || "?").trim().charAt(0).toUpperCase() || "?") + '</span>';
      return m.logo_url ? '<span class="up-logo-box has-img"><img src="' + esc(m.logo_url) + '" alt="" loading="lazy" referrerpolicy="no-referrer"/>' + ltr + '</span>'
                        : '<span class="up-logo-box">' + ltr + '</span>';
    }
    /* Kopf einer .up-vartable: die erste Spalte waechst (.up-th-vname aus core), die Zahlen stehen
       fest (.uev-th-zahl, Breite in events.css -- core laesst die Spaltenbreiten bewusst bei der
       Komponente). */
    function tabKopf(erste, zahlen) {
      /* z.info: die Erklaerkarte am Spaltenkopf, wie an jedem Spaltenkopf der App (.up-th-info). */
      return '<div class="up-thead up-vrow"><div class="up-th up-th-vname">' + esc(t(erste)) + '</div>' +
        zahlen.map(function (z) {
          return '<div class="up-th uev-th-zahl' + (z.k ? " " + z.k : "") + '">' + esc(t(z.t)) +
            (z.info ? '<span class="up-th-info uev-erklaer" data-explain="' + esc(z.info) + '">' + UC.icon("info", 2) + '</span>' : '') + '</div>';
        }).join("") + '</div>';
    }
    function renderMarkt() {
      var el = elMain.querySelector('[data-sek="markt"]'), a = dieAnalyse();
      var titel = "Market movement", desc = "Visibility of every tracked brand in the affected prompts, before and after.";
      /* Ohne Analyse wegen eines Fehlers: der Abschnitt faellt weg. Den Fehler sagen schon die
         Kennzahlen und das Diagramm darueber -- ein drittes Mal waere Laerm. */
      if (!a && state.analyseFehler && !state.analyseLaden) { el.innerHTML = ""; el.hidden = true; return; }
      el.hidden = false;
      var kopf = tabKopf("Brand", [{ t: "Before" }, { t: "After" }, { t: "Change" }]);
      if (!a) {
        /* Skelett mit DENSELBEN Zellklassen wie die Zeilen, in .up-tbody -- nur dort nimmt core der
           letzten Zeile die Unterkante (sonst doppelt mit dem Rahmen, 03.10. gemeldet). */
        el.innerHTML = sekKopf(titel, desc) + '<div class="up-vartable uev-markt">' + kopf + '<div class="up-tbody up-vbody">' +
          (UC.skeletonRows ? UC.skeletonRows({ count: 3, rowClass: "up-row up-vrow", cellClass: "up-td",
            cols: [{ w: 110, jitter: 30, logo: true, cls: "up-var-name uev-td-marke" }, { w: 44, cls: "uev-td-zahl" }, { w: 44, cls: "uev-td-zahl" }, { w: 40, cls: "uev-td-zahl" }] }) : "") +
          '</div></div>';
        return;
      }
      /* Ohne Wettbewerber faellt der Abschnitt weg (Spezifikation 85) -- eine Tabelle mit nur der
         eigenen Zeile ist kein Markt. */
      if (!(isArr(a.competitors) && a.competitors.length)) { el.innerHTML = ""; el.hidden = true; return; }
      var reihen = [];
      if (a.affected) reihen.push({ du: true, m: a.affected });
      a.competitors.forEach(function (c) { reihen.push({ m: c }); });
      el.innerHTML = sekKopf(titel, desc) +
        '<div class="up-vartable uev-markt">' + kopf + '<div class="up-tbody up-vbody">' + reihen.map(function (r) {
          var v = r.m.visibility || {};
          /* Ohne Vorher-Wert steht vorher ein Strich und kein Trend -- und kein "Neu getrackt"
             (03.10.: "ein Wert ohne Vorher-Wert ist nicht gleich neu getrackt"). */
          var aend = num(v.before) == null ? "" : trendHtml("visibility", v.delta);
          return '<div class="up-row up-vrow' + (r.du ? " is-du" : "") + '">' +
            '<div class="up-td up-var-name uev-td-marke">' + markeLogo(r.m) + '<span class="up-varname">' + esc(r.m.name || "") + '</span>' +
              (r.du ? '<span class="up-marke up-you">' + esc(t("You")) + '</span>' : '') + '</div>' +
            '<div class="up-td uev-td-zahl">' + wertHtml("visibility", v.before) + '</div>' +
            '<div class="up-td uev-td-zahl">' + wertHtml("visibility", v.after) + '</div>' +
            '<div class="up-td uev-td-zahl">' + aend + '</div></div>';
        }).join("") + '</div></div>';
    }

    /* "Zuerst zitiert" als leise Marke aus core (.up-marke.is-leise, wie der Typ auf der Karte) --
       03.10.: "in kleinen Chips, einfach nur in Bg, wie sonst auch, und nicht klickbar". Darum kurz:
       die Spalte heisst schon "First cited", der Chip sagt nur noch wann. Nie "noch nie zitiert"
       (Vertrag 5): gezaehlt wird nur in den betroffenen Prompts des eigenen Teams. Zitiert in der
       Schriftfarbe, nicht zitiert zurueckgenommen -- der Text sagt es, die Farbe stuetzt nur. */
    function beobachtung(o) {
      o = o || {};
      var st = o.status, txt, ja = true;
      /* day_number zaehlt die Tage NACH dem Event (Vertrag 3.9: 0 = Event-Tag) -- darum "After 10
         days" und nicht "Day 10", das sich wie ein Wochentag oder ein Zaehler ab 1 las. */
      var n = num(o.day_number);
      if (st === "observed_on_event_day" || (st === "first_observed_after_event" && n === 0 && o.observed_before_event !== true)) txt = t("On event day");
      else if (st === "first_observed_after_event") {
        txt = o.observed_before_event === true ? t("Already cited before")
          : ersetze(t(n === 1 ? "After 1 day ({date})" : "After {n} days ({date})"), { n: zahl(n), date: datum(o.first_observed_day) });
      } else if (st === "not_observed_within_6_months") { txt = t("Not within 6 months"); ja = false; }
      else { txt = t("Not yet"); ja = false; }
      return '<span class="up-marke is-leise uev-beob' + (ja ? " is-ja" : "") + '">' + esc(txt) + '</span>';
    }
    function renderUrls() {
      var el = elMain.querySelector('[data-sek="urls"]'), d = dieDetail(), a = dieAnalyse();
      if (!d) { el.innerHTML = ""; return; }
      var urls = isArr(d.urls) ? d.urls : [];
      /* Ohne URLs keine leere Analyse-Tabelle (Spezifikation 42) -- der Leerzustand aus core mit
         dem Weg, eine anzulegen. Mit URLs steht "Add URL" schon im Seitenkopf: kein zweiter Knopf. */
      if (!urls.length) {
        el.innerHTML = sekKopf("Affected URLs", "") +
          UC.leerHtml({ mini: true, icon: "link", titel: "No URLs added yet", text: "Add pages, articles or external sources associated with this event.",
            knopf: "Add URL", knopfAttr: "data-uev-addurl" });
        return;
      }
      var proId = {};
      (a && isArr(a.urls) ? a.urls : []).forEach(function (u) { proId[u.id] = u; });
      el.innerHTML = sekKopf("Affected URLs", "Pages, articles or external sources associated with this event. Global share is measured in the affected prompts.") +
        '<div class="up-vartable uev-urls">' +
          tabKopf("URL", [{ t: "First cited", k: "uev-th-beob", info: "zitiert" }, { t: "Global share before" }, { t: "Global share after" }, { t: "Change" }]) +
          '<div class="up-tbody up-vbody">' + urls.map(function (u) {
            var an = proId[u.id], hp = hostPfad(u.url), gs = an && an.global_share ? an.global_share : null;
            var sk = '<span class="up-tsk-bar"></span>';
            /* Die ganze Zeile oeffnet das URL-Detail (03.10.), "Remove" faengt seinen Klick selbst ab. */
            return '<div class="up-row up-vrow uev-urlzeile" data-url-id="' + esc(u.id) + '" data-url="' + esc(u.url) + '" role="link" tabindex="0">' +
              /* Der Zeilenknopf sitzt in der ersten Zelle und erscheint am Hover der Zeile -- das
                 Bauteil .up-btn-sec.up-rowbtn aus core, wie "Edit" in brands-overview. Nur "Remove":
                 der Knopf "Responses" filterte die Tabelle darunter und war unverstaendlich (03.10.). */
              '<div class="up-td up-var-name uev-td-url"><span class="up-fav up-logo-box has-img"><img src="' + esc(favicon(u.url)) + '" alt="" loading="lazy" referrerpolicy="no-referrer"/></span>' +
                '<span class="uev-url-txt"><span class="uev-url-host">' + esc(hp.host) + '</span>' +
                '<span class="uev-url-pfad" title="' + esc(u.url) + '">' + esc(hp.pfad) + '</span></span>' +
                '<button type="button" class="up-btn-sec up-rowbtn uev-urlweg" data-url-id="' + esc(u.id) + '" aria-label="' + esc(t("Remove")) + '">' + UC.icon("trash", 2) + '<span>' + esc(t("Remove")) + '</span></button>' +
              '</div>' +
              '<div class="up-td uev-td-zahl uev-td-beob">' + (an ? beobachtung(an.observation) : sk) + '</div>' +
              '<div class="up-td uev-td-zahl">' + (an ? wertHtml("visibility", gs && gs.before) : sk) + '</div>' +
              '<div class="up-td uev-td-zahl">' + (an ? wertHtml("visibility", gs && gs.after) : sk) + '</div>' +
              '<div class="up-td uev-td-zahl">' + (an ? trendHtml("visibility", gs && gs.delta) : sk) + '</div>' +
            '</div>';
          }).join("") + '</div></div>';
    }

    /* Die Topics des Events wie in response-detail (topicChip): der statische Chip aus core in der
       Farbe des Topics, mit seinem Zeichen. Ein geloeschtes Topic (Vertrag 3.2: "Chip ausgegraut")
       steht zurueckgenommen da und sagt am Zeiger, warum -- KEIN Durchstreichen, das las sich wie
       "falsch" (03.10. gefragt: "was soll das?"). */
    function topicChipHtml(tp) {
      var eigen = topicsAlle().filter(function (x) { return String(x.id) === String(tp.id); })[0];
      var fb = eigen ? topicFarbe(eigen) : "", emo = (eigen && eigen.emoji) || tp.emoji || "";
      return '<span class="up-topicchip is-static' + (tp.deleted ? " uev-topic-weg" : "") + '"' +
          (fb ? ' style="--ust-tag-color:' + esc(fb) + '"' : '') +
          (tp.deleted ? ' data-tip="' + esc(t("This topic was deleted after the event was created. Its prompts still count.")) + '"' : '') + '>' +
        (emo ? '<span class="up-topicchip-e">' + esc(emo) + '</span>' : '') +
        '<span class="up-topicchip-lbl">' + esc(tp.name || "") + '</span></span>';
    }
    function renderScope() {
      var el = elMain.querySelector('[data-sek="scope"]'), d = dieDetail(), a = dieAnalyse();
      if (!d) { el.innerHTML = ""; return; }
      var c = (a && a.cohort) || {}, zeilen = [];
      var topics = isArr(d.topics) ? d.topics : [];
      /* OHNE KASTEN und kurz (03.10.: "aufraeumen, nicht in eine Card packen"): links die
         Bezeichnung, rechts nur der Wert -- die Saetze ("14 affected Prompts", "47 comparison Prompts
         are used as a workspace benchmark") wiederholten die Bezeichnung. Was die Vergleichsgruppe
         ist, sagt die Erklaerkarte am Zeichen. */
      function zeile(lbl, wertHtml, erklaerung) {
        return '<div class="uev-scope-zeile"><span class="uev-scope-lbl">' + esc(t(lbl)) +
          (erklaerung ? '<span class="up-th-info uev-erklaer" data-explain="' + esc(erklaerung) + '">' + UC.icon("info", 2) + '</span>' : '') +
          '</span>' + wertHtml + '</div>';
      }
      function prompts(n) { n = num(n); return n == null ? "–" : ersetze(t(n === 1 ? "{n} Prompt" : "{n} Prompts"), { n: zahl(n) }); }
      if (d.scope_mode === "all") zeilen.push(zeile("Scope", '<span class="uev-scope-wert">' + esc(t("All active Prompts at event creation")) + '</span>'));
      else zeilen.push(zeile("Affected topics", '<div class="uev-scope-chips">' + topics.map(topicChipHtml).join("") + '</div>'));
      zeilen.push(zeile("Affected prompts", '<span class="uev-scope-wert">' + esc(prompts(d.affected_prompt_count)) + '</span>'));
      var vgl = num(d.comparison_prompt_count);
      zeilen.push(zeile("Comparison group", '<span class="uev-scope-wert">' + esc(vgl ? prompts(vgl) : t("No comparison group")) + '</span>', vgl ? "vergleich" : ""));
      /* Was nicht in die Vorher/Nachher-Zahlen eingeht, in ganzen Saetzen: Prompts, die es vor dem
         Event noch nicht gab, haben keinen Vorher-Wert und zaehlen nur in der Kurve (Vertrag 3.9,
         cohort.post_only_prompt_count). */
      var neben = [];
      if (num(c.post_only_prompt_count) > 0) neben.push(ersetze(t(num(c.post_only_prompt_count) === 1
        ? "{n} prompt was added after the event. It appears in the chart, but not in the before and after numbers."
        : "{n} prompts were added after the event. They appear in the chart, but not in the before and after numbers."), { n: zahl(c.post_only_prompt_count) }));
      if (num(c.deleted_prompt_count) > 0) neben.push(ersetze(t("{n} Prompts deleted since"), { n: zahl(c.deleted_prompt_count) }));
      el.innerHTML = sekKopf("Event scope", "") + '<div class="uev-scope">' + zeilen.join("") +
        (neben.length ? '<div class="uev-scope-neben">' + neben.map(function (x) { return '<span>' + esc(x) + '</span>'; }).join("") + '</div>' : '') + '</div>';
    }

    /* Die URL-Auswahl der Responses: der Filter aus core in der Bauart "Selected Brands" (03.10.:
       "so wie Selected Brands. Punkt."), mit Einzelwahl -- die RPC nimmt genau eine URL oder
       keine (p_event_url_id). Er bleibt ueber das Neuzeichnen hinweg derselbe Knoten. */
    var respFilterKit = null;
    function respUrls() { var d = dieDetail(); return d && isArr(d.urls) ? d.urls : []; }
    function renderResp() {
      var el = elMain.querySelector('[data-sek="resp"]');
      var urls = respUrls();
      /* Ohne URLs gibt es nichts, was zitiert sein koennte. Ohne das Tabellen-Element darunter
         (eigenes Element in Bubble, Entscheidung 5) gaebe es nur eine Ueberschrift ueber nichts --
         dann faellt der Abschnitt weg und kommt, sobald die Tabelle da ist (respWarten). */
      var tabelle = respWurzel();
      respSichtbar(!!urls.length);
      if (!urls.length || !tabelle) { el.innerHTML = ""; el.hidden = true; if (urls.length) respWarten(); return; }
      el.hidden = false;
      if (state.respUrl && !urls.some(function (u) { return u.id === state.respUrl; })) state.respUrl = "";
      if (!el.querySelector(".uev-sec-head")) {
        el.innerHTML = sekKopf("Responses citing affected URLs", "Tracked AI responses that cite one or more URLs associated with this event.", '<span class="uev-respfilter-ort"></span>');
        respFilterKit = UC.makeAuswahlFilter ? UC.makeAuswahlFilter({
          klasse: "uev-respfilter", einzeln: true, titel: "Affected URLs", alle: "All affected URLs",
          suche: "Search URLs…", tip: "Filter by URL",
          items: function () {
            return respUrls().map(function (u) { var hp = hostPfad(u.url); return { key: u.id, label: hp.host + hp.pfad, titel: u.url }; });
          },
          gewaehlt: state.respUrl ? [state.respUrl] : [],
          onChange: function (keys) { respFilter(keys[0] || "", false); }
        }) : null;
        if (respFilterKit) el.querySelector(".uev-respfilter-ort").appendChild(respFilterKit.el);
      } else if (respFilterKit) {
        respFilterKit.setGewaehlt(state.respUrl ? [state.respUrl] : []);
      }
    }
    var respWarteUhr = null, respWarteN = 0;
    function respWarten() {
      if (respWarteUhr || respWarteN > 20) return;
      respWarteUhr = setTimeout(function () {
        respWarteUhr = null; respWarteN++;
        if (state.ansicht === "detail" && root.isConnected !== false) renderResp();
      }, 1000);
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
    /* EIN WARTEN, DAS ENDET -- auch im Detail (03.10. gemeldet: "seh immer noch nur Skeleton beim
       Navigieren auf die Event-Detail-Ansichten"). Fehlt der Workflow fuer uevDetail oder
       uevAnalysis, kam nie eine Antwort, und das Skelett lief fuer immer -- das sieht aus wie
       "gleich da". Dieselbe Uhr wie bei der Liste: 25s, gezaehlt erst, wenn die Ansicht zu sehen
       ist; jede neue Anfrage (Fenster, Filter, URL) zieht sie neu auf. Laeuft sie ab, steht der
       Lesefehler, wo das Skelett stand. */
    var DETAIL_WARTE_MS = 25000, detailUhrId = null;
    function detailUhr() {
      if (detailUhrId) clearTimeout(detailUhrId);
      detailUhrId = setTimeout(detailAblauf, DETAIL_WARTE_MS);
    }
    function detailAblauf() {
      detailUhrId = null;
      if (root.isConnected === false || state.ansicht !== "detail") return;
      var ohneDetail = !dieDetail(), ohneAnalyse = !dieAnalyse();
      if (!ohneDetail && !ohneAnalyse) return;
      if (UC.istSichtbar && !UC.istSichtbar(root)) { detailUhrId = setTimeout(detailVerdeckt, 1000); return; }
      if (ohneDetail) { state.detailLaden = false; state.detailFehler = true; }
      if (ohneAnalyse) { state.analyseLaden = false; state.analyseFehler = true; }
      renderDetail();
    }
    function detailVerdeckt() {
      detailUhrId = null;
      if (root.isConnected === false || state.ansicht !== "detail") return;
      if (UC.istSichtbar && UC.istSichtbar(root)) detailUhr(); else detailUhrId = setTimeout(detailVerdeckt, 1000);
    }
    function detailAnfordern(spaet) {
      state.detailFehler = false;
      detailUhr();
      var b = body({ p_event_id: state.eventId });
      if (spaet && fire.spaet) fire.spaet("data-detail-fn", "uevDetail", b); else fire("data-detail-fn", "uevDetail", b);
    }
    function analyseAnfordern(spaet) {
      state.analyseLaden = true; state.analyseFehler = false;
      detailUhr();
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
      if (detailUhrId) { clearTimeout(detailUhrId); detailUhrId = null; }
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
      var si = e.target.closest(".uev-seiteninfo");
      if (si) { if (seitenKarte && !seitenKarte.el.classList.contains("is-on")) seitenKarte.show(si); return; }
      /* Der Knopf im gefilterten Leerzustand (UC.leerHtml traegt data-clearall): Suche und
         Typ-Filter zuruecksetzen. */
      if (e.target.closest("[data-clearall]")) {
        state.suche = ""; state.typen = [];
        if (typFilter) typFilter.setGewaehlt([]);
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
      var uw = e.target.closest(".uev-urlweg");
      if (uw) { urlEntfernenFragen(uw.getAttribute("data-url-id")); return; }
      /* Zeile der URL-Tabelle: das URL-Detail im Drawer der App. Kennung ist die URL selbst -- so
         nimmt der URL-Drawer sie (Drawer-System der Host-App: "IDs koennen ganze URLs sein"). */
      var uz = e.target.closest(".uev-urlzeile[data-url]");
      if (uz) { if (UC.drawerOeffnen) UC.drawerOeffnen("url", uz.getAttribute("data-url"), "events"); return; }
      if (e.target.closest(".uev-addurl-kopf, [data-uev-addurl]")) { popupUrl(); return; }
      var k = e.target.closest(".uev-karte[data-event-id]");
      if (k && !k.classList.contains("is-sk")) oeffnen(k.getAttribute("data-event-id"), true);
    });
    root.addEventListener("keydown", function (e) {
      if (e.key !== "Enter" && e.key !== " ") return;
      var k = e.target.closest && e.target.closest(".uev-karte[data-event-id]");
      if (k && e.target === k) { e.preventDefault(); oeffnen(k.getAttribute("data-event-id"), true); return; }
      var uz = e.target.closest && e.target.closest(".uev-urlzeile[data-url]");
      if (uz && e.target === uz) { e.preventDefault(); if (UC.drawerOeffnen) UC.drawerOeffnen("url", uz.getAttribute("data-url"), "events"); }
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
    var popup = null;

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
      ZEICHEN_EXTRA.forEach(function (k) { if (!da[k]) { da[k] = 1; l.push(k); } });
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
    /* DIE TYP-AUSWAHL in der Bauart der Branche in Your Brand (settings-brand, makeDropdown):
       Titel, Suchfeld, Liste mit Haken, darunter "Not listed? Add your own" mit Feld und Add. Der
       Vertrag fuehrt event_type als freien Text -- ein eigener Typ ist also ein gueltiger Wert.
       In der Liste: die 19 Typen nach Gruppen, dann die eigenen Typen, die es schon gibt (aus
       dem Event-Store), dann der gerade gewaehlte -- wie die eigene Branche, die in die Liste
       wandert, damit sie beim naechsten Oeffnen dabeisteht. */
    var TYP_MAX = 48;           /* wie die eigene Branche (IND_MAX in settings-brand) */
    function typListe(akt) {
      var l = [], da = {};
      function merk(x) { da[String(x.key).toLowerCase()] = 1; da[String(t(x.label)).toLowerCase()] = 1; da[String(x.label).toLowerCase()] = 1; }
      typenGeordnet().forEach(function (g) { g.forEach(function (x) { l.push(x); merk(x); }); });
      function eigen(k) {
        k = String(k == null ? "" : k).trim();
        if (!k || da[k.toLowerCase()]) return;
        var x = typVon(k);
        if (!x.eigen) return;
        l.push(x); merk(x);
      }
      (UC.getEvents ? UC.getEvents() : []).forEach(function (ev) { eigen(ev.event_type); });
      eigen(akt);
      return { liste: l, da: da };
    }
    function typListeHtml(p) {
      var q = String(p.typSuche || "").trim().toLowerCase();
      var l = typListe(p.e.typ).liste.filter(function (x) {
        return !q || String(t(x.label)).toLowerCase().indexOf(q) >= 0 || String(x.label).toLowerCase().indexOf(q) >= 0;
      });
      if (!l.length) return '<div class="up-ment-noresult">' + esc(t("No types found")) + '</div>';
      return l.map(function (x) {
        var an = x.key === p.e.typ;
        return '<div class="up-filter-item uev-typitem' + (an ? " is-checked" : "") + '" role="option" tabindex="0" aria-selected="' + an + '" data-typ-wahl="' + esc(x.key) + '">' +
          '<span class="up-filter-check">' + UC.icon("check", 3) + '</span>' +
          /* Zeichen und Name mit den Klassen des Marken-Filters (.up-ment-zeichen, .up-ment-name:
             13/500) -- vorher eigene mit 13/400, das Menue sah dadurch fremd aus (03.10.). */
          '<span class="up-ment-zeichen">' + UC.icon(x.icon, 2) + '</span>' +
          '<span class="up-ment-name">' + esc(t(x.label)) + '</span></div>';
      }).join("");
    }
    /* Der Typ ist eine PFLICHTWAHL ohne Vorbelegung (03.10.: "es soll nicht 'Andere' vorselektiert
       sein") -- leer steht der Knopf wie das leere Datum: Platzhalter in der vierten Farbe, und
       "Continue" bleibt gesperrt, bis ein Typ gewaehlt ist (schrittOk). */
    function typFeld(e) {
      var tp = typVon(e.typ);
      return '<div class="up-filter uev-wahl" data-wahlwrap="typ">' + (e.typ ? wahlKnopf("typ", tp.icon, t(tp.label)) : wahlKnopf("typ", "tags", t("Select a type"), true)) +
        '<div class="up-ment-menu uev-wahlmenu uev-typwahl" role="menu" aria-hidden="true" data-up-feldbreit>' +
          '<div class="up-filter-head"><span class="up-filter-title">' + esc(t("Event type")) + '</span></div>' +
          '<div class="up-ment-searchwrap">' +
            '<input class="up-ment-search uev-typsuche" type="text" placeholder="' + esc(t("Search types")) + '" autocomplete="off" spellcheck="false" aria-label="' + esc(t("Search types")) + '"/>' +
            '<button class="up-ment-searchclear uev-typsuche-x" type="button" aria-label="' + esc(t("Clear search")) + '">' + UC.icon("x", 2) + '</button>' +
          '</div>' +
          '<div class="up-filter-list up-ment-list uev-typliste"></div>' +
          '<div class="up-ddcustom">' +
            '<div class="up-filter-title">' + esc(t("Not listed? Add your own")) + '</div>' +
            '<div class="up-ddcustom-row">' +
              '<span class="up-ddcustom-field">' +
                '<input class="up-ment-search up-ddcustom-in uev-typeigen" type="text" maxlength="' + TYP_MAX + '" placeholder="' + esc(t("Your type")) + '" autocomplete="off" spellcheck="false" aria-label="' + esc(t("Your type")) + '"/>' +
                '<button class="up-iconbtn is-20 is-quiet up-ddcustom-clear uev-typeigen-x" type="button" aria-label="' + esc(t("Clear")) + '">' + UC.icon("x", 2) + '</button>' +
              '</span>' +
              '<button class="up-btn-pri uev-typeigen-add" type="button" disabled>' + esc(t("Add")) + '</button>' +
            '</div>' +
          '</div>' +
        '</div></div>';
    }
    /* Ein eigener Typ ist erlaubt, wenn das Feld nicht leer ist und der Text nicht schon in der
       Liste steht -- sonst entsteht ein Doppel, das sich nur in der Schreibung unterscheidet. */
    function typEigenOk(p) {
      var inp = im(".uev-typeigen");
      var v = inp ? inp.value.trim() : "";
      return !!v && !typListe(p.e.typ).da[v.toLowerCase()];
    }
    function typEigenNehmen() {
      var p = popup, inp = im(".uev-typeigen");
      if (!p || !inp || !typEigenOk(p)) return;
      p.e.typ = inp.value.trim().slice(0, TYP_MAX);
      inp.value = "";
      menueZu("typ"); typNeu(); pruefenZeigen(); knoepfeSync();
    }
    function typListeZeigen() {
      var el = im(".uev-typliste");
      if (el) el.innerHTML = typListeHtml(popup);
      var add = im(".uev-typeigen-add");
      if (add) add.disabled = !typEigenOk(popup);
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
       offenen. Ohne eigene Wahl folgt das Zeichen dem Typ und die Farbe bleibt leer (Vertrag:
       p_icon und p_color sind optional). Leer heisst "Default" und ist die SCHRIFTFARBE (03.10.:
       "nenn es Standard, aber belasse es bei Font color") -- die erste Zelle zeigt sie gefuellt,
       und Karte, Kopf und Zusammenfassung malen ein Event ohne Farbe in ihr. */
    function aussehenPanel(e) {
      var ic = e.icon || typVon(e.typ).icon, f = e.farbe, panel = "";
      if (e.offen === "icon") {
        panel = '<div class="up-topicmodal-pickpanel"><div class="up-topicmodal-colorgrid uev-zeichenraster">' +
          zeichenListe().map(function (k) {
            var an = k === ic;
            return '<button type="button" class="up-topicmodal-colorcell uev-zeichenzelle' + (an ? " is-on" : "") + '" data-zeichen="' + esc(k) + '" aria-pressed="' + an + '">' + UC.icon(k, 2) + '</button>';
          }).join("") + '</div></div>';
      } else if (e.offen === "farbe") {
        /* Eine Farbe ausserhalb der Reihe (aus der Datenbank, der Vertrag zeigt #22aa55) steht als
           eigene Zelle hinten -- wie paletteMit im Topic-Dialog. Sonst waere nichts gewaehlt. */
        var toene = FARBEN.slice();
        if (f && !toene.some(function (hx) { return hx.toLowerCase() === f.toLowerCase(); })) toene.push(f);
        panel = '<div class="up-topicmodal-pickpanel"><div class="up-topicmodal-colorgrid uev-farbraster" style="grid-template-columns:repeat(' + (toene.length + 1) + ',minmax(0,32px))">' +
          '<button type="button" class="up-topicmodal-colorcell" data-farbe="" aria-pressed="' + !f + '" aria-label="' + esc(t("Default")) + '" data-tip="' + esc(t("Default")) + '">' +
            '<span class="up-topicmodal-colorblob uev-standardfarbe">' + (!f ? UC.icon("check", 3) : "") + '</span></button>' +
          toene.map(function (hx) {
            var an = !!f && hx.toLowerCase() === f.toLowerCase();
            return '<button type="button" class="up-topicmodal-colorcell" data-farbe="' + esc(hx) + '" aria-pressed="' + an + '" aria-label="' + esc(hx) + '">' +
              '<span class="up-topicmodal-colorblob" style="background:' + esc(hx) + '">' + (an ? UC.icon("check", 3) : "") + '</span></button>';
          }).join("") + '</div></div>';
      }
      return panel;
    }
    function aussehen(e) {
      var ic = e.icon || typVon(e.typ).icon, f = e.farbe;
      return '<div class="up-topicmodal-approw">' +
          '<button type="button" class="up-topicmodal-pickbtn' + (e.offen === "icon" ? " is-open" : "") + '" data-pick="icon" aria-expanded="' + (e.offen === "icon") + '"' +
            ' aria-label="' + esc(t("Event icon")) + '" data-tip="' + esc(t("Event icon")) + '"' + (f ? ' style="color:' + esc(f) + '"' : '') + '>' + UC.icon(ic, 2) + '</button>' +
          '<button type="button" class="up-topicmodal-pickbtn' + (e.offen === "farbe" ? " is-open" : "") + '" data-pick="farbe" aria-expanded="' + (e.offen === "farbe") + '"' +
            ' aria-label="' + esc(t("Event color")) + '" data-tip="' + esc(t("Event color")) + '">' +
            '<span class="up-topicmodal-pickswatch' + (f ? "" : " uev-standardfarbe") + '"' + (f ? ' style="background:' + esc(f) + '"' : '') + '></span></button>' +
        '</div>' + klapp(!!e.offen, aussehenPanel(e), "uev-aussehen-klapp");
    }
    /* AUF- UND ZUKLAPPEN MIT 200ms (03.10.: "alle Actions, wo das Popup auf- und zuklappt, mit
       200ms ease animieren, wie ueberall"). Ein Behaelter, der seine Zeile von 0fr auf 1fr zieht:
       die Hoehe folgt dem Inhalt, ohne dass sie jemand misst. Dauer und Kurve aus den Marken
       (--up-t-2, --up-ease). Zugeklappt ist der Inhalt unsichtbar UND nicht fokussierbar
       (visibility, nach der Dauer). */
    function klapp(offen, inhalt, klasse) {
      return '<div class="uev-klapp' + (klasse ? " " + klasse : "") + (offen ? " is-offen" : "") + '"><div class="uev-klapp-in">' + inhalt + '</div></div>';
    }
    function klappen(el, offen) {
      if (!el || el.classList.contains("is-offen") === !!offen) return;
      if (offen) void el.offsetHeight;   /* vom geschlossenen Stand aus anlaufen lassen */
      el.classList.toggle("is-offen", !!offen);
    }
    /* Zeichen oder Farbe auf- und zuklappen: nur das Panel tauschen und den Behaelter schalten --
       ein Neuzeichnen des ganzen Blocks (aussehenNeu) haette den Behaelter ohne Bewegung ersetzt. */
    function aussehenKlappen() {
      var p = popup, box = im(".uev-aussehen");
      if (!p || !box) return;
      var bs = box.querySelectorAll("[data-pick]");
      for (var i = 0; i < bs.length; i++) {
        var an = bs[i].getAttribute("data-pick") === p.e.offen;
        bs[i].classList.toggle("is-open", an); bs[i].setAttribute("aria-expanded", String(an));
      }
      var kl = box.querySelector(".uev-aussehen-klapp");
      if (p.e.offen) kl.querySelector(".uev-klapp-in").innerHTML = aussehenPanel(p.e);
      klappen(kl, !!p.e.offen);
    }
    function detailFelder(e, mitDatum) {
      return feld("Name", '<input type="text" class="up-topicmodal-name" data-feld="name" maxlength="120" autocomplete="off" spellcheck="false"' +
          ' placeholder="' + esc(t("e.g. Website relaunch")) + '" value="' + esc(e.name) + '"/>') +
        (mitDatum ? feld("Date", datumFeld(e)) : "") +
        feld("Type", typFeld(e)) +
        feld("Description", '<textarea class="up-topicmodal-name up-modal-text" data-feld="text" rows="3" placeholder="' + esc(t("What changed?")) + '">' + esc(e.text) + '</textarea>', true) +
        feld("Appearance", '<div class="uev-aussehen">' + aussehen(e) + '</div>');
    }
    /* DER TITELBILD-PICKER: die sechs Motive als Kacheln im Format des Bands, drei je Reihe (immer
       gleich viele je Reihe). Gewaehlt traegt die Kachel den Ring in der Akzent-Tinte und den Haken
       in einem runden Grund -- dieselbe Sprache wie die Farbwahl darueber (Haken auf dem Feld).
       Ein zweiter Klick auf die gewaehlte Kachel nimmt sie ab; "Remove cover" klappt darunter auf,
       sobald eine gewaehlt ist (200ms wie jedes Aufklappen im Popup). Ohne Titelbild steht das Band
       in der Event-Farbe -- das zeigt die Vorschau darunter. */
    function coverKacheln(e) {
      return COVERS.map(function (c) {
        var an = e.cover === c.key, ct = coverTeile(c);
        return '<button type="button" class="uev-cover' + (an ? " is-on" : "") + (ct.klasse.indexOf("is-laedt") >= 0 ? " is-laedt" : "") + '" data-cover="' + c.key + '" aria-pressed="' + an + '"' +
            ' aria-label="' + esc(t(c.label)) + '" data-tip="' + esc(t(c.label)) + '"' + ct.attr + '>' +
          '<span class="uev-cover-haken" aria-hidden="true">' + UC.icon("check", 3) + '</span></button>';
      }).join("");
    }
    function coverFeld(e) {
      return feld("Cover image",
        '<div class="uev-cover-raster" role="group" aria-label="' + esc(t("Cover image")) + '">' + coverKacheln(e) + '</div>' +
        klapp(!!e.cover, '<div class="uev-cover-fuss"><button type="button" class="up-quietbtn uev-cover-weg">' + esc(t("Remove cover")) + '</button></div>', "uev-cover-klapp"), true);
    }
    function coverNeu() {
      var p = popup, r = im(".uev-cover-raster");
      if (!p || !r) return;
      var ks = r.querySelectorAll("[data-cover]");
      for (var i = 0; i < ks.length; i++) {
        var an = ks[i].getAttribute("data-cover") === p.e.cover;
        ks[i].classList.toggle("is-on", an); ks[i].setAttribute("aria-pressed", String(an));
      }
      klappen(im(".uev-cover-klapp"), !!p.e.cover);
    }
    /* Ein leiser Chip OHNE Rahmen und ohne Punkt: Flaeche wie der Zaehler in der Karte der
       Event-Pins (--up-sel-bg), davor das Schloss. Die Punkt-Pille sah hier "vibecodig" aus und
       passte nicht zur App (03.10.). */
    function gesperrtHinweis(text) {
      return '<span class="uev-gesperrt">' + UC.icon("lock", 2) + '<span>' + esc(t(text)) + '</span></span>';
    }
    /* Umschalter, Topics und die Zahl als EINE Gruppe: die Zahl gehoert zur Auswahl darueber und
       steht darum nicht 32px entfernt wie ein eigenes Feld. Kein Wort ueber die Vergleichsgruppe
       (Spezifikation 55) -- die legt der Server selbst fest. */
    /* DIE TOPICS ALS SICHTBARE LISTE (03.10.: der Filter-Knopf "Topics" war im Popup "richtig
       unintuitiv"). Alle Topics stehen offen da, jede Zeile mit dem Kaestchen aus core
       (.up-filter-item / .up-filter-check, dieselben Zeilen wie im Topics-Filter), Zeichen oder
       Farbpunkt, Name und Zahl der Prompts. Ab sieben Topics ein Suchfeld darueber, darunter die
       Zahl der gewaehlten und "Select all" bzw. "Clear". Die Topics kommen aus dem Store der Seite. */
    function topicsAlle() { return (UC.getTopics ? UC.getTopics() : []).filter(function (x) { return x && x.id != null; }); }
    function topicFarbe(x) { return (isDark() ? (x.hex_dark || x.hex_light) : (x.hex_light || x.hex_dark)) || ""; }
    function topicZeilen(p) {
      var alle = topicsAlle(), q = String(p.topicSuche || "").trim().toLowerCase();
      if (!alle.length) return '<div class="up-ment-noresult">' + esc(t("No topics found")) + '</div>';
      var l = alle.filter(function (x) { return !q || String(x.name || "").toLowerCase().indexOf(q) >= 0; });
      if (!l.length) return '<div class="up-ment-noresult">' + esc(t("No topics found")) + '</div>';
      return l.map(function (x) {
        var an = p.e.topics.indexOf(String(x.id)) >= 0, fb = topicFarbe(x);
        return '<div class="up-filter-item uev-topicitem' + (an ? " is-checked" : "") + '" role="checkbox" tabindex="0" aria-checked="' + an + '" data-topic-id="' + esc(x.id) + '">' +
          '<span class="up-filter-check">' + UC.icon("check", 3) + '</span>' +
          (x.emoji ? '<span class="uev-topic-zeichen">' + esc(x.emoji) + '</span>'
                   : '<span class="uev-topic-punkt"' + (fb ? ' style="background:' + esc(fb) + '"' : '') + '></span>') +
          '<span class="up-ment-name uev-topic-name">' + esc(x.name || "") + '</span>' +
          (num(x.prompt_count) != null ? '<span class="uev-topic-zahl">' + esc(zahl(x.prompt_count)) + '</span>' : '') +
        '</div>';
      }).join("");
    }
    function topicsFuss(p) {
      var n = p.e.topics.length, alle = topicsAlle().length;
      return '<span class="uev-topicfuss-zahl">' + esc(ersetze(t("{n} of {total} selected"), { n: n, total: alle })) + '</span>' +
        (alle ? '<button type="button" class="up-quietbtn uev-topicalle">' + esc(t(n === alle ? "Clear" : "Select all")) + '</button>' : '');
    }
    function topicsZeigen() {
      var p = popup, l = im(".uev-topicliste"), f = im(".uev-topicfuss");
      if (l) l.innerHTML = topicZeilen(p);
      if (f) f.innerHTML = topicsFuss(p);
    }
    function topicUmschalten(id) {
      var p = popup;
      if (!p || id == null) return;
      id = String(id);
      var i = p.e.topics.indexOf(id);
      if (i >= 0) p.e.topics.splice(i, 1); else p.e.topics.push(id);
      topicsZeigen();
      /* Der Fokus bleibt auf der Zeile, die gerade umgeschaltet wurde -- sie ist neu gezeichnet. */
      var z = im('.uev-topicitem[data-topic-id="' + id.replace(/"/g, "") + '"]');
      try { if (z && document.activeElement && document.activeElement.classList && document.activeElement.classList.contains("uev-topicitem")) z.focus(); } catch (e) {}
      vorschauAnfordern();
    }
    function umfangFelder(e) {
      var viele = topicsAlle().length > 6;
      return feld("Affected scope",
        '<div class="uev-umfang">' +
          '<div class="up-seg uev-umfangseg" role="group">' +
            '<button type="button" class="up-seg-btn' + (e.modus === "topics" ? " is-active" : "") + '" data-modus="topics">' + esc(t("Selected topics")) + '</button>' +
            '<button type="button" class="up-seg-btn' + (e.modus === "all" ? " is-active" : "") + '" data-modus="all">' + esc(t("All active Prompts")) + '</button>' +
          '</div>' +
          '<div class="uev-klapp uev-umfang-klapp' + (e.modus === "topics" ? " is-offen" : "") + '"><div class="uev-klapp-in"><div class="uev-umfang-topics uev-topicbox">' +
            (viele ? '<div class="up-ment-searchwrap uev-topicsuche-w">' +
              '<input class="up-ment-search uev-topicsuche" type="text" placeholder="' + esc(t("Search topics")) + '" autocomplete="off" spellcheck="false" aria-label="' + esc(t("Search topics")) + '"/>' +
              '<button class="up-ment-searchclear uev-topicsuche-x" type="button" aria-label="' + esc(t("Clear search")) + '">' + UC.icon("x", 2) + '</button></div>' : '') +
            '<div class="up-filter-list uev-topicliste" role="group" aria-label="' + esc(t("Topics")) + '"></div>' +
            '<div class="uev-topicfuss"></div>' +
          '</div></div></div>' +
          '<p class="uev-umfang-zahl" aria-live="polite"></p>' +
        '</div>');
    }
    function urlSuche() {
      return '<div class="uev-urlsuche"><span class="uev-urlsuche-ic">' + UC.icon("search", 2) + '</span>' +
          '<input type="text" class="up-topicmodal-name uev-urlein" placeholder="' + esc(t("Search your URLs or paste a link")) + '" autocomplete="off" spellcheck="false" inputmode="url"/></div>' +
        klapp(false, '<div class="uev-urltreffer" role="listbox"></div>', "uev-treffer-klapp");
    }
    function urlFelder(e) {
      return feld("Affected URLs",
          '<p class="up-modal-hinweis">' + esc(t("Add pages, articles or external sources associated with this event.")) + '</p>' +
          urlSuche() + '<div class="uev-urlauswahl"></div>', true) +
        coverFeld(e) +
        '<div class="uev-pruef"></div>' +
        gesperrtHinweis("Date and scope can't be changed later");
    }

    /* ---- Zeichnen in einem offenen Popup --------------------------------------------------- */
    function im(sel) { return popup ? popup.api.el.querySelector(sel) : null; }
    function schrittText(n) {
      return ersetze(t("Step {n} of 3"), { n: n }) + ": " + t(["Details", "Scope", "URLs & review"][n - 1]);
    }
    function typNeu() {
      var p = popup, tp = typVon(p.e.typ), b = im('[data-wahl="typ"]');
      if (b) {
        b.querySelector(".up-modal-wahl-ic").innerHTML = UC.icon(p.e.typ ? tp.icon : "tags", 2);
        var tx = b.querySelector(".up-modal-wahl-txt");
        tx.textContent = p.e.typ ? t(tp.label) : t("Select a type");
        tx.classList.toggle("is-leer", !p.e.typ);
      }
      typListeZeigen();
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
      klappen(im(".uev-umfang-klapp"), p.e.modus === "topics");
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
      var kl = el.closest(".uev-klapp");
      /* Beim Zuklappen bleibt der Inhalt stehen, bis der Behaelter zu ist -- sonst faellt die Hoehe
         sofort auf 0 und es gibt nichts zu animieren. */
      if (!q) { klappen(kl, false); return; }
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
      if (html) el.innerHTML = html;
      klappen(kl, !!html);
    }
    function auswahlZeigen() {
      var p = popup, el = im(".uev-urlauswahl");
      if (!el) return;
      p.ohneUrlsFrage = false;
      var l = p.e.urls;
      el.innerHTML = !l.length ? "" :
        '<div class="uev-urlwahl-liste">' + l.map(function (u, i) {
          var hp = hostPfad(u.url);
          return '<div class="uev-urlwahl">' +
            '<span class="up-fav up-logo-box has-img"><img src="' + esc(favicon(u.url)) + '" alt="" loading="lazy" referrerpolicy="no-referrer"/></span>' +
            '<span class="uev-url-txt"><span class="uev-url-host">' + esc(hp.host) + '</span><span class="uev-url-pfad" title="' + esc(u.url) + '">' + esc(hp.pfad) + '</span></span>' +
            (u.neu ? '<span class="uev-urlwahl-neu">' + esc(t("New target")) + '</span>' : '') +
            '<button type="button" class="up-iconbtn uev-urlwahl-weg" data-url-weg="' + i + '" aria-label="' + esc(t("Remove")) + '" data-tip="' + esc(t("Remove")) + '">' + UC.icon("x", 2) + '</button></div>';
        }).join("") + '</div>';
    }
    /* DIE VORSCHAU (03.10. angefordert): im letzten Schritt die Karte, wie sie danach in der
       Uebersicht steht -- dieselbe karteHtml, gefuellt aus dem Entwurf, ohne Menue und ohne Klick.
       Sie ersetzt die Zusammenfassung: alles, was dort stand, steht auf der Karte. */
    function pruefenZeigen() {
      var p = popup, el = im(".uev-pruef");
      if (!el || p.art !== "anlegen") return;
      var e = p.e, v = dieVorschau(p);
      var ev = { id: "", name: e.name.trim() || t("Untitled event"), event_date: e.datum, event_type: e.typ,
        icon: e.icon, color: e.farbe, cover: e.cover, description: e.text.trim() || null, scope_mode: e.modus,
        selected_topic_count: e.modus === "topics" ? e.topics.length : null,
        affected_prompt_count: v && !v.fehler ? v.n : null, affected_url_count: e.urls.length };
      el.innerHTML = '<span class="up-topicmodal-label">' + esc(t("Preview")) + '</span>' +
        '<div class="uev-vorschau">' + karteHtml(ev, true) + '</div>';
    }
    function schrittOk(p) {
      var e = p.e;
      if (p.art === "url") return e.urls.length === 1;
      if (p.art === "bearbeiten") return !!e.name.trim();
      if (p.schritt === 1) return !!e.name.trim() && !!e.datum && !!e.typ;
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
      /* Ohne URLs fragt der Knopf einmal nach (03.10.): erst "Create without URLs?", der zweite
         Klick legt an. Jede Aenderung an der Auswahl oder ein Schrittwechsel nimmt die Frage zurueck. */
      var lbl = p.schritt === 3 ? (p.ohneUrlsFrage ? "Create without URLs?" : "Create event") : "Continue", tx = b && b.querySelector(".up-modal-knopftxt");
      if (tx) { tx.textContent = t(lbl); tx.setAttribute("data-i18n", lbl); }
    }
    function schritt(n, fehlerBehalten) {
      var p = popup;
      if (!p || n < 1 || n > 3) return;
      p.schritt = n;
      p.ohneUrlsFrage = false;
      if (!fehlerBehalten) p.api.fehler("");
      var st = p.api.body.querySelectorAll(".uev-schritt");
      for (var i = 0; i < st.length; i++) st[i].hidden = parseInt(st[i].getAttribute("data-schritt"), 10) !== n;
      /* Schritt 2 und 3 entstehen erst, wenn sie gezeigt werden: der Topics-Filter baut sich nur
         in einer sichtbaren Wurzel (makeMount), und in einem verdeckten Schritt stuende er erst
         nach dem naechsten Blick des Waechters da. */
      var box = p.api.body.querySelector('.uev-schritt[data-schritt="' + n + '"]');
      if (box && !box.__uevGebaut) {
        box.__uevGebaut = 1;
        if (n === 2) { box.innerHTML = umfangFelder(p.e); topicsZeigen(); }
        if (n === 3) box.innerHTML = urlFelder(p.e);
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
      /* Im Klick-Dummy sucht die Datei: dieselben Zeitpunkte wie die Maschine aus core (ab zwei
         Zeichen, 300ms Ruhe), aber ohne Bubble. */
      if (demo) {
        var uhr = 0;
        p.maschine = {
          tippen: function (q) {
            clearTimeout(uhr);
            q = String(q || "").trim();
            if (q.length < 2) { p.such.laedt = false; p.such.treffer = null; trefferZeigen(); return; }
            uhr = setTimeout(function () {
              p.such.laedt = true; trefferZeigen();
              demoHolen(function (D) {
                setTimeout(function () {
                  if (popup !== p) return;
                  p.such.laedt = false; p.such.treffer = D ? D.suche(q) : []; trefferZeigen();
                }, DEMO_MS);
              });
            }, 300);
          },
          abbrechen: function () { clearTimeout(uhr); }
        };
        return;
      }
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
      var b = {
        p_name: e.name.trim(), p_event_date: e.datum, p_scope_mode: e.modus,
        p_tag_ids: e.modus === "topics" ? e.topics.slice() : null,
        p_urls: e.urls.length ? e.urls.map(function (u) { return u.url; }) : null,
        p_description: e.text.trim() || null, p_event_type: e.typ,
        p_icon: e.icon || null, p_color: e.farbe || null
      };
      /* p_cover NUR, wenn ein Titelbild gewaehlt ist (04.10.): PostgREST lehnt einen Aufruf mit
         einem Parameter ab, den die Funktion nicht kennt -- und solange die Datenbank p_cover noch
         nicht fuehrt, haette sonst JEDES Anlegen gescheitert, auch ohne Titelbild. */
      if (e.cover) b.p_cover = e.cover;
      fire("data-create-fn", "uevCreate", body(b));
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
      /* Wie Zeichen und Farbe (Vertrag 3.5): "" nimmt das Titelbild ab. Unveraendert steht p_cover
         gar nicht im Body -- aus demselben Grund wie beim Anlegen (unbekannter Parameter). */
      if (e.cover !== a.cover) b.p_cover = e.cover || "";
      if (b.p_name == null && b.p_description == null && b.p_event_type == null && b.p_icon == null && b.p_color == null && !("p_cover" in b)) { p.api.schliessen(); return; }
      warten(p, "bearbeiten");
      fire("data-update-fn", "uevUpdate", body(b));
    }
    function urlSenden() {
      var p = popup;
      if (!p.e.urls.length) return;
      warten(p, "url");
      fire("data-addurl-fn", "uevAddUrl", body({ p_event_id: p.eventId, p_url: p.e.urls[0].url }));
    }
    /* Nach jeder gelungenen Aenderung: Bubble laedt die Liste neu (upEventsChanged, 04.10.) --
       Uebersicht und Pins zeigen sonst Name, Farbe, Titelbild und URL-Zahl von vorher. Im
       Klick-Dummy nicht: dort fuellt events-demo.js die Liste selbst, und eine echte Liste wuerde
       die Beispiele ersetzen. */
    function listeNeu() {
      if (demo || !UC.eventsChanged) return;
      try { UC.eventsChanged(); } catch (e) {}
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
      listeNeu();
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
      knoepfeSync();
    }
    function popupAnlegen() {
      if (popup) return;
      var e = { name: "", datum: heuteIso(), monat: null, typ: "", text: "", icon: null, farbe: null, cover: null, offen: null,
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
                    if (p.schritt < 3) { schritt(p.schritt + 1); return false; }
                    if (!p.e.urls.length && !p.ohneUrlsFrage) { p.ohneUrlsFrage = true; knoepfeSync(); return false; }
                    anlegenSenden();
                    return false;
                  } }],
        onClose: popupZu
      });
      api.body.querySelector('.uev-schritt[data-schritt="1"]').__uevGebaut = 1;
      var p = { art: "anlegen", api: api, e: e, schritt: 1, knopf: "weiter", pops: {}, vorschauen: {}, topicSuche: "" };
      sucheBauen(p);
      popupAufbauen(p);
      schritt(1);
    }
    function popupBearbeiten(eid) {
      if (popup) return;
      var ev = state.detail[eid] || listeEvent(eid);
      if (!ev) return;
      var e = { name: String(ev.name || ""), typ: typ(ev).key, text: String(ev.description || ""),
                icon: ZEICHEN[ev.icon] ? ev.icon : null, farbe: farbe(ev) || null, cover: coverVon(ev) ? ev.cover : null, offen: null, urls: [] };
      var alt = { name: e.name, typ: e.typ, text: e.text, icon: e.icon, farbe: e.farbe, cover: e.cover };
      var api = UC.makeModal({
        titel: "Edit event", breit: true, isDark: isDark,
        inhaltHtml: '<div class="uev-schritt">' + detailFelder(e, false) + coverFeld(e) +
          gesperrtHinweis("Date and scope can't be changed") + '</div>',
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
        if (art === "typ") {
          p.typSuche = "";
          var ts = w.querySelector(".uev-typsuche"), te = w.querySelector(".uev-typeigen");
          if (ts) ts.value = "";
          if (te) te.value = "";
          typListeZeigen();
        }
        p.pops[art] = UC.makePopover({ wrap: w, menu: w.querySelector(".uev-wahlmenu"), opener: wb,
          onClose: function () { wb.setAttribute("aria-expanded", "false"); } });
        p.pops[art].open();
        wb.setAttribute("aria-expanded", "true");
        if (art === "typ") setTimeout(function () { var f = w.querySelector(".uev-typsuche"); try { if (f) f.focus(); } catch (e) {} }, 0);
        return;
      }
      var to = x.closest("[data-typ-wahl]");
      if (to) { p.e.typ = to.getAttribute("data-typ-wahl"); menueZu("typ"); typNeu(); pruefenZeigen(); knoepfeSync(); return; }
      if (x.closest(".uev-typsuche-x")) {
        p.typSuche = ""; var ts2 = im(".uev-typsuche"); if (ts2) { ts2.value = ""; try { ts2.focus(); } catch (e) {} }
        typListeZeigen();
        return;
      }
      if (x.closest(".uev-typeigen-x")) {
        var te2 = im(".uev-typeigen"); if (te2) { te2.value = ""; try { te2.focus(); } catch (e) {} }
        typListeZeigen();
        return;
      }
      if (x.closest(".uev-typeigen-add")) { typEigenNehmen(); return; }
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
      var cvk = x.closest("[data-cover]");
      if (cvk) { var ck = cvk.getAttribute("data-cover"); p.e.cover = p.e.cover === ck ? null : ck; coverNeu(); pruefenZeigen(); knoepfeSync(); return; }
      if (x.closest(".uev-cover-weg")) { p.e.cover = null; coverNeu(); pruefenZeigen(); knoepfeSync(); return; }
      var pk = x.closest("[data-pick]");
      if (pk) { var k = pk.getAttribute("data-pick"); p.e.offen = p.e.offen === k ? null : k; aussehenKlappen(); return; }
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
      var ti = x.closest(".uev-topicitem");
      if (ti) { topicUmschalten(ti.getAttribute("data-topic-id")); return; }
      if (x.closest(".uev-topicalle")) {
        var alleIds = topicsAlle().map(function (y) { return String(y.id); });
        p.e.topics = p.e.topics.length === alleIds.length ? [] : alleIds;
        topicsZeigen(); vorschauAnfordern();
        return;
      }
      if (x.closest(".uev-topicsuche-x")) {
        p.topicSuche = ""; var tsx = im(".uev-topicsuche"); if (tsx) { tsx.value = ""; try { tsx.focus(); } catch (e2) {} }
        topicsZeigen();
        return;
      }
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
      if (x.matches(".uev-typsuche")) { p.typSuche = x.value; typListeZeigen(); return; }
      if (x.matches(".uev-topicsuche")) { p.topicSuche = x.value; topicsZeigen(); return; }
      if (x.matches(".uev-typeigen")) { var add = im(".uev-typeigen-add"); if (add) add.disabled = !typEigenOk(p); return; }
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
      if (p && ev.key === " " && x && x.matches && x.matches(".uev-topicitem")) { ev.preventDefault(); topicUmschalten(x.getAttribute("data-topic-id")); return; }
      if (!p || ev.key !== "Enter" || !x || !x.matches) return;
      if (x.matches(".uev-typeigen")) { ev.preventDefault(); typEigenNehmen(); return; }
      if (x.matches(".uev-typitem")) { ev.preventDefault(); x.click(); return; }
      if (x.matches(".uev-topicitem")) { ev.preventDefault(); topicUmschalten(x.getAttribute("data-topic-id")); return; }
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
      state.listeZeitUm = false;
      if (listeUhrId) { clearTimeout(listeUhrId); listeUhrId = null; }
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
        if (wartend.urlWeg && wartend.urlWeg.eventId === id) { var api1 = wartend.urlWeg.api; clearTimeout(wartend.urlWeg.uhr); wartend.urlWeg = null; api1.schliessen(); listeNeu(); }
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
      setFehler: function (code, wo) {
        /* Nimmt den Code ODER den ganzen Fehler-Body der RPC (04.10.): Bubble liefert bei "Include
           errors in response" den Body als Text -- {"code":"P0001","message":"impact_event_...",...}.
           Dann steht der Code in message; so muss in Bubble kein Feld einzeln zugeordnet werden. */
        var roh = String(code == null ? "" : code).trim();
        if (roh.charAt(0) === "{") {
          /* objekt() wie setEventDetail -- UC.readBubble allein liest als Liste und gaebe [ {...} ]. */
          var o = objekt(roh);
          if (o && o.message != null) code = String(o.message);
        }
        var txt = fehlerText(code), weg = String(code) === "impact_event_not_found";
        /* wo: welcher Setter den Fehler mitbrachte (der dritte Wert, 04.10.). Dann ist bekannt, wer
           gewartet hat, und die Meldung landet nur dort -- eine fehlgeschlagene Vorschau-Zahl darf
           nicht das Anlegen abbrechen, das zufaellig zur selben Zeit wartet. Ohne wo
           (setEventError) wie bisher: das Erste, was wartet. */
        if (wo === "preview") { popupVorschauKam(null); return true; }
        if (wo === "analysis" && !weg) {
          state.analyseLaden = false; state.analyseFehler = true;
          if (state.ansicht === "detail") renderDetail();
          return true;
        }
        /* Loeschen antwortet ueber setEventDeleted; URL entfernen und jedes Popup ueber setEventDetail. */
        var ohneWo = wo == null, mitDetail = ohneWo || wo === "detail";
        if (wartend.del && (ohneWo || wo === "delete")) { clearTimeout(wartend.del.uhr); wartend.del.api.busy("ok", false); wartend.del.api.fehler(txt); wartend.del = null; return true; }
        if (wartend.urlWeg && mitDetail) { clearTimeout(wartend.urlWeg.uhr); wartend.urlWeg.api.busy("ok", false); wartend.urlWeg.api.fehler(txt); wartend.urlWeg = null; return true; }
        if (mitDetail && popupFehlerKam(txt, code)) return true;
        /* Kein offenes Popup wartet: das Event selbst ist weg oder nicht erreichbar. Kam der Fehler
           auf die Detail-Anfrage und steht noch kein Detail, ersetzt der Fehlerzustand das Skelett
           -- sonst liefe es bis zur Warte-Uhr. Den Toast gibt es dazu nur, wenn er mehr sagt als
           der Fehlerzustand (ein bekannter Code, nicht der allgemeine Satz). */
        if (state.ansicht === "detail" && (weg || (wo === "detail" && !dieDetail()))) {
          state.detailLaden = false; state.detailFehler = true;
          if (weg) { state.analyseLaden = false; state.analyseFehler = true; }
          renderDetail();
          if (!weg && txt === fehlerText("")) return true;
        }
        if (UC.toast) UC.toast(txt);
        return true;
      },
      /* Die Responses-Tabelle gehoert nicht dieser Komponente: bei Erfolg geht der Text unveraendert
         an renderResponsesTable. Bei einem Fehler-Body bekommt sie ihren Lesefehler ueber den
         dokumentierten Weg (__parseError, responses-table.js) -- ohne das bliebe das Skelett
         stehen, das responsesAnfordern eingeschaltet hat; die Tabelle hat keine eigene Warte-Uhr. */
      setResponses: function (raw, f) {
        if (!window.renderResponsesTable) return false;
        try {
          if (fehlerDa(f)) window.renderResponsesTable({ instanceId: respInstanz, __parseError: true });
          else window.renderResponsesTable(raw);
        } catch (e) {}
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
        listeNeu();
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

    /* Klick-Dummy: die Beispielliste in den Event-Store -- aber nur, wenn noch keine echte Liste
       mit Events da ist. Kommt danach eine echte, gewinnt sie. */
    if (demo) demoHolen(function (D) {
      if (!D || root.isConnected === false) return;
      if (!listeGeladen() || !(UC.getEvents && UC.getEvents().length)) UC.setEvents(JSON.stringify(D.liste()), "demo");
    });
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
      /* Der dritte Wert ist Bubbles "error body" (04.10.): ist er gefuellt, gilt die Antwort als
         Fehler, und die Komponente zeigt ihn dort, wo gewartet wird. Im Workflow steht damit EIN
         Schritt ohne "Only when". Mit zwei Werten wie bisher. */
      setEventDetail:       function (id, p, f) { return jede(id, p, function (c, v) { if (fehlerDa(f)) c.setFehler(f, "detail"); else c.setDetail(v); }); },
      setEventAnalysis:     function (id, p, f) { return jede(id, p, function (c, v) { if (fehlerDa(f)) c.setFehler(f, "analysis"); else c.setAnalysis(v); }); },
      setEventScopePreview: function (id, p, f) { return jede(id, p, function (c, v) { if (fehlerDa(f)) c.setFehler(f, "preview"); else c.setVorschau(v); }); },
      setEventDeleted:      function (id, p, f) { return jede(id, p, function (c, v) { if (fehlerDa(f)) c.setFehler(f, "delete"); else c.setGeloescht(v); }); },
      setEventResponses:    function (id, p, f) { return jede(id, p, function (c, v) { c.setResponses(v, f); }); },
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
