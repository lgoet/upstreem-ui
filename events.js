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

   DATENWEGE (seit 13.10. direkt an Supabase, Vertrag bubble/vor_nextjs_13_10, Abschnitt 1):
     Liste      der Event-Store in core (team_context_v1 ['events'] beim App-Start bzw.
                setUpstreemEvents) -- dieselbe Antwort fuettert die Marker in allen
                Liniendiagrammen. Diese Komponente liest nur; nach jeder gelungenen Aenderung
                ruft sie UC.eventsChanged(), und core laedt den Teil neu.
     Kanal            RPC (UC.rpc, Antwort als normales JSON)   Antwort geht an
       uevDetail        get_impact_event_v3                     setDetail
       uevAnalysis      cached_impact_event_analysis_v3         setAnalysis
       uevScopePreview  preview_impact_event_scope_v2           setVorschau
       uevCreate        create_impact_event_v3                  setDetail (Popup)
       uevUpdate        update_impact_event_v2                  setDetail (Popup)
       uevAddTarget     add_impact_event_target_v1              setDetail (Popup, auch eine URL)
       uevRemoveUrl     remove_impact_event_target_v1           setDetail (Bestaetigung)
       uevRemoveTarget  remove_impact_event_target_v1           setDetail (Bestaetigung)
       uevDelete        delete_impact_event_v2                  setGeloescht
     NUR NOCH v3 (17.10., Frage des DB-Chats: wer ruft noch get_impact_event_v2?): Detail, Analyse
     und Anlegen gehen IMMER an die v3-Fassung, eine URL hinzufuegen und entfernen an die
     Ziel-Funktionen (die kennen url-Ziele mit denselben IDs wie urls[]). Bis 17.10. fielen Detail
     und Analyse bei fehlender v3 still auf v2 zurueck, Anlegen ohne Ziele ging an
     create_impact_event_v2 und eine URL an add/remove_impact_event_url_v2. v3 ist eine echte
     Obermenge von v2 (gelesen 17.10.: _impact_event_detail_v3 und _impact_event_analysis_v3 rufen
     die v2-Rechnung und haengen targets[] an, ohne Regel-Ziele ein leeres targets[]; url-Ziele
     kommen aus impact_event_url, also auch alte Events aus v1/v2). Scheitert v3, zeigt die
     Oberflaeche den Fehlerzustand (CLAUDE.md §2) statt still eine andere Fassung zu fragen.
     update_impact_event_v2, delete_impact_event_v2 und preview_impact_event_scope_v2 haben keinen
     Nachfolger und bleiben. uevAddUrl gibt es nur noch im Klick-Dummy (events-demo.js).
     Direkt, ohne Kanal: die Vorschau
     (preview_impact_event_targets_v1), "Count as your domain" (domain_classify_v1) und die Sitemap
     (Edge Function sitemap-lesen, UC.edge). Was davon fehlt, bietet die Oberflaeche nicht an
     (ZIELE_DA, SITEMAP_DA).
     Fehler kommen als HTTP-Fehler, message = Code, hint = Feld (siehe fehlerText/FELD_VON_HINT).
     RUECKWEG: fehlt eine v2-Funktion noch (404 PGRST202), geht DIESER Kanal fuer den Rest der
     Sitzung wieder als Bubble-Ereignis hinaus (uevDetail, uevCreate, ... mit dem fertigen
     RPC-Body als Text), und die alten Setter antworten wie bisher:
                setEventDetail(id, json, fehler)       setEventAnalysis(id, json, fehler)
                setEventScopePreview(id, json, fehler)  setEventDeleted(id, json, fehler)
                setEventError(id?, message)
     Die Setter bleiben auch sonst stehen -- ein Bubble-Workflow, der sie noch ruft, schadet nicht.
     uevResponses geht weiter an Bubble, ist aber ausgeschaltet (MIT_RESPONSES).

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
  /* Ein Objekt aus Bubble-Text: UC.bubbleObjekt (core, seit 05.10. -- hier stand bis zum 06.10. die
     Vorlage dafuer). Es liest mit readBubble (nicht parseLoose: die Antworten tragen Emojis im Feld
     icon), nimmt aus einer Liste das erste Element und packt den Umschlag {"json": "<Text>"} aus --
     wer in Bubble "Result of step 1" statt "Result of step 1's json" einsetzt, schickt das Ganze
     (04.10. gemessen: "Die Zahl der Prompts konnte nicht geladen werden"). */
  function objekt(raw) { return UC.bubbleObjekt ? UC.bubbleObjekt(raw) : null; }
  function team() { try { return (UC.getTeam && UC.getTeam()) || ""; } catch (e) { return ""; } }
  /* Die Parameter einer RPC: p_team vorn, dann die eigenen. body() ist dieselbe Form als Text --
     so geht sie im Rueckweg an Bubble (makeFire schiebt einem OBJEKT team_id ein, und PostgREST
     lehnt einen Parameter ab, den die Funktion nicht kennt). */
  function mitTeam(o, tm) {
    var b = { p_team: tm != null ? tm : team() };
    for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) b[k] = o[k];
    return b;
  }
  function body(o) { return JSON.stringify(mitTeam(o)); }

  /* ---- Die Regeln der Datenbank, hier noch einmal (13.10., Vertrag Abschnitt 1) -------------
     Seit v2 prueft die Datenbank Name, Beschreibung, Typ, Zeichen, Farbe, Titelbild und URLs.
     Was billig zu pruefen ist, prueft das Popup VORHER, damit die Meldung am Feld steht, bevor
     etwas hinausgeht -- entscheidend bleibt die Antwort des Servers. Laenge in Zeichen wie
     Postgres (char_length zaehlt Codepunkte, .length zaehlt UTF-16 und gaebe einem Emoji zwei). */
  function laenge(s) { return Array.from(String(s == null ? "" : s)).length; }
  var NAME_MAX = 120, TEXT_MAX = 2000, KURZ_MAX = 40, URL_LAENGE_MAX = 2048;
  function urlOk(u) {
    u = String(u == null ? "" : u).trim();
    if (!u || u.length > URL_LAENGE_MAX) return false;
    try { var x = new URL(u); return (x.protocol === "https:" || x.protocol === "http:") && !!x.hostname; } catch (e) { return false; }
  }
  var REGELN = {
    p_name: function (v) { return laenge(String(v).trim()) >= 1 && laenge(v) <= NAME_MAX; },
    p_description: function (v) { return laenge(v) <= TEXT_MAX; },
    p_event_type: function (v) { return /^[a-z0-9_]+$/.test(v) && v.length <= KURZ_MAX; },
    p_icon: function (v) { return v === "" || (/^[a-z0-9_-]+$/.test(v) && v.length <= KURZ_MAX); },
    p_color: function (v) { return v === "" || /^#[0-9a-fA-F]{6}$/.test(v); },
    p_cover: function (v) { return v === "" || /^[a-z0-9_]+$/.test(v) || (/^https:\/\//.test(v) && v.length <= URL_LAENGE_MAX); },
    p_url: urlOk,
    p_urls: function (v) { return isArr(v) && v.every(urlOk); }
  };
  /* Der erste Parameter, der die Regel bricht -- als hint, wie der Server ihn nennen wuerde. null
     heisst "unveraendert" bzw. "nicht gesetzt" und ist immer erlaubt. */
  function paramsPruefen(b) {
    for (var k in REGELN) if (b[k] != null && !REGELN[k](b[k])) return k;
    return "";
  }
  /* Ein eigener Typ als Schluessel (13.10.): p_event_type erlaubt nur [a-z0-9_]. "Podcast Launch"
     wird zu podcast_launch, das core wieder lesbar macht ("Podcast launch"). Umlaute
     ausgeschrieben, statt sie als Unterstrich zu verlieren. */
  function typSchluessel(s) {
    return String(s == null ? "" : s).trim().toLowerCase()
      .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
      .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, KURZ_MAX).replace(/_+$/, "");
  }
  function ersetze(s, o) { return String(s).replace(/\{(\w+)\}/g, function (_, k) { return o[k] != null ? o[k] : ""; }); }
  function tagMs(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ""));
    return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : NaN;
  }
  function isoAus(ms) { return new Date(ms).toISOString().slice(0, 10); }
  /* Der heutige Tag als Kalendertag: der BERLINER Tag. Die Datenbank rechnet Start, Status und
     Tag x von y im Berliner Tag (Teil B: (now() at time zone 'Europe/Berlin')::date) -- mit dem Tag
     des Browsers gab der Kalender in UTC+9 vor 07:00 Ortszeit einen Start frei, den die Datenbank
     als "morgen" ablehnte (Audit EV-13). en-CA schreibt JJJJ-MM-TT; ein Browser ohne die Zeitzone
     faellt auf den lokalen Tag zurueck. */
  var BERLIN_TAG = null;
  function heuteIso() {
    try {
      BERLIN_TAG = BERLIN_TAG || new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" });
      var b = BERLIN_TAG.format(new Date());
      if (/^\d{4}-\d{2}-\d{2}$/.test(b)) return b;
    } catch (e) {}
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function datum(s) { return s ? (UC.fmtDate ? UC.fmtDate(String(s).slice(0, 10)) : String(s).slice(0, 10)) : "–"; }
  function zahl(v) { v = num(v); return v == null ? "–" : (UC.fmtInt ? UC.fmtInt(v) : String(Math.round(v))); }

  /* Typ, Zeichen, Farbe eines Events. Das Zeichen aus dem Typ -- NIE das Feld icon der Datenbank,
     solange es kein bekannter Zeichenname ist: dort stehen Emojis, und Emojis gehoeren nicht in
     die Oberflaeche (Entscheidung 1). */
  function typ(ev) {
    var x = UC.eventTyp ? UC.eventTyp(ev && ev.event_type) : { key: "other", label: "Other", icon: "pin", gruppe: "other" };
    /* Ein eigener Typ ohne Unterstrich ("podcast", seit 13.10. die Schluesselform aus
       typSchluessel) laesst core klein stehen -- dessen Regel macht nur a_b lesbar. Hier mit
       grossem Anfang, als Kopie: das Objekt gehoert dem Zwischenspeicher in core. */
    if (x && x.eigen && /^[a-z0-9]+$/.test(x.label)) {
      var k = {}; for (var f in x) k[f] = x[f];
      k.label = x.label.charAt(0).toUpperCase() + x.label.slice(1);
      return k;
    }
    return x;
  }
  /* DIE ART EINES EINTRAGS (19.10.): "event" (Event Tracking: Datum, Topics, Kontrollgruppe) oder "watch" (Citation Tracking:
     Seiten und Domains beobachten, alle Prompts, ohne Datum und ohne Kohorte). Ohne Feld "kind" (aeltere Datenbank) ist alles ein
     Event. Die Art ist nach dem Anlegen nicht aenderbar. */
  function istWatch(ev) { return !!ev && String(ev.kind || "") === "watch"; }
  var ZEICHEN = {};
  /* Die Zeichen der 19 Typen und eines mehr: mail fuer den Newsletter -- im Popup stehen damit zwei
     volle Reihen zu zehn (03.10. angefordert: "immer einheitlich viele"). */
  var ZEICHEN_EXTRA = ["mail"];
  (UC.EVENT_TYPEN || []).forEach(function (x) { ZEICHEN[x.icon] = 1; });
  ZEICHEN_EXTRA.forEach(function (k) { ZEICHEN[k] = 1; });
  /* p_icon erlaubt seit 13.10. nur [a-z0-9_-]. Die Zeichennamen von core sind camelCase
     (fileText, bookOpenCheck) -- also geht der Name als file-text hinaus und kommt beim Lesen
     wieder zurueck. Aeltere Events tragen noch die camelCase-Form, beide werden gelesen. */
  function iconFuerDb(name) { return name ? String(name).replace(/[A-Z]/g, function (m) { return "-" + m.toLowerCase(); }) : name; }
  function iconAusDb(v) {
    if (!v) return null;
    v = String(v);
    if (ZEICHEN[v]) return v;
    var c = v.replace(/-([a-z0-9])/g, function (_, z) { return z.toUpperCase(); });
    return ZEICHEN[c] ? c : null;
  }
  function zeichen(ev) {
    if (istWatch(ev)) return "eye";   /* Citation Tracking hat kein eigenes Zeichen zur Wahl (19.10.) */
    return iconAusDb(ev && ev.icon) || typ(ev).icon;
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
    var z = zieleZaehlen(ev);
    if (z.regeln) z.teile.forEach(function (x) { l.push(x); });
    else if (z.urls) l.push({ n: z.urls, eins: "{n} URL", viele: "{n} URLs" });
    return l;
  }
  /* Was ein Event trackt, gezaehlt nach Art (15.10.): aus targets[] des Details, aus
     target_count/target_kinds der Liste (list_impact_events_v3) oder -- wie bisher -- aus den
     URLs. teile: je Art eine Angabe ("1 path", "2 URLs"); regeln: ob eine Regel dabei ist. */
  var ART_ZAHL = { url: ["{n} URL", "{n} URLs"], path: ["{n} path", "{n} paths"], host: ["{n} domain", "{n} domains"], host_all: ["{n} domain", "{n} domains"] };
  function zieleZaehlen(ev) {
    var urls = num(ev.affected_url_count != null ? ev.affected_url_count : (isArr(ev.urls) ? ev.urls.length : null));
    var je = {}, regeln = false, gesamt = null;
    if (isArr(ev.targets)) {
      gesamt = ev.targets.length;
      ev.targets.forEach(function (x) { var k = String(x && x.kind || ""); if (!ART_ZAHL[k]) return; je[k === "host_all" ? "host" : k] = (je[k === "host_all" ? "host" : k] || 0) + 1; if (k !== "url") regeln = true; });
    } else if (isArr(ev.target_kinds) && num(ev.target_count) != null) {
      gesamt = num(ev.target_count);
      regeln = ev.target_kinds.some(function (k) { return k && k !== "url"; });
      /* Nur eine Art: die ganze Zahl gehoert ihr ("1 path"). Gemischt sagt die Liste nicht, wie
         viele je Art -- dann "3 targets". */
      if (ev.target_kinds.length === 1 && ART_ZAHL[ev.target_kinds[0]]) je[ev.target_kinds[0] === "host_all" ? "host" : ev.target_kinds[0]] = gesamt;
    }
    var teile = [];
    if (regeln) {
      var arten = Object.keys(je);
      if (arten.length) ["path", "host", "url"].forEach(function (k) { if (je[k]) teile.push({ n: je[k], eins: ART_ZAHL[k][0], viele: ART_ZAHL[k][1] }); });
      else if (gesamt) teile.push({ n: gesamt, eins: "{n} target", viele: "{n} targets" });
    }
    return { regeln: regeln, teile: teile, urls: urls, gesamt: gesamt };
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
  /* Die Hosts, die ein Citation Tracking beobachtet (19.10.): bis zu drei in der Reihenfolge des Hinzufuegens und die Zahl der verschiedenen.
     Aus der Liste (target_hosts, target_host_count) oder aus dem Detail (targets[].host). null, solange keine Quelle es sagt. */
  function watchHosts(ev) {
    if (!ev) return null;
    var hosts = [], n = null;
    if (isArr(ev.target_hosts)) { hosts = ev.target_hosts; n = num(ev.target_host_count); }
    else if (isArr(ev.targets)) ev.targets.forEach(function (x) { var h = x && x.host ? String(x.host).replace(/^www\./, "") : ""; if (h && hosts.indexOf(h) < 0) hosts.push(h); });
    else return null;
    hosts = hosts.filter(Boolean);
    return { hosts: hosts.slice(0, 3), n: n != null && n >= hosts.length ? n : hosts.length };
  }
  function hostFavicon(h) { return favicon("https://" + h); }
  /* Was ein Citation Tracking beobachtet, als eine Angabe: "1 domain", "3 URLs". Leer, solange die Liste es nicht sagt. */
  function ziellText(ev) {
    var z = zieleZaehlen(ev), teile = z.regeln && z.teile.length ? z.teile : (z.urls ? [{ n: z.urls, eins: "{n} URL", viele: "{n} URLs" }] : []);
    return teile.map(function (x) { return ersetze(t(x.n === 1 ? x.eins : x.viele), { n: zahl(x.n) }); }).join(", ");
  }
  /* Datum und Typ -- in der Karte und im Kopf des Details dieselben. Vor dem Datum ein kleines
     Kalender-Zeichen (03.10.), der Typ OHNE Zeichen in einer leisen Marke aus core (03.10.: "den
     Typ ohne Icon davor in einem kleinen Chip"); sein Zeichen steht ohnehin gross im Profilbild. */
  function angabenHtml(ev, klasse) {
    /* Citation Tracking (19.10.): kein Eventdatum, kein Typ, kein Status -- nur, seit wann es das gibt. */
    if (istWatch(ev)) {
      var zt = ziellText(ev);
      return '<div class="uev-angaben' + (klasse ? " " + klasse : "") + '">' +
        (ev.created_at ? '<span class="uev-angabe uev-angabe-datum">' + UC.icon("calendar", 2) + '<span>' + esc(ersetze(t("Created {date}"), { date: datum(ev.created_at) })) + '</span></span>' : '') +
        (zt ? '<span class="uev-angabe">' + UC.icon("link", 2) + '<span>' + esc(zt) + '</span></span>' : '') +
        /* Bei mehreren Seiten bis zu drei Favicons der zuerst hinzugefuegten, als Logoplatten wie die Citation-Chips der Tabellen: ohne Hover, ohne "+N". */
        (function () {
          var wh = watchHosts(ev);
          if (!wh || wh.n < 2 || !wh.hosts.length || !UC.brandStack) return "";
          return UC.brandStack(wh.hosts.map(function (h) { return { name: h, favicon: hostFavicon(h) }; }), wh.hosts.length, { max: 3, fav: true, still: true });
        })() +
      '</div>';
    }
    var tp = typ(ev), st = statusInfo(ev);
    /* Kampagnen (17.10.): der Zeitraum statt des Tages, dahinter der Status als dritte Angabe --
       in der Karte und im Kopf des Details derselbe. Laufend in der Akzent-Tinte (is-laeuft):
       das Einzige, was sich gerade bewegt; geplant und abgeschlossen bleiben leise. */
    return '<div class="uev-angaben' + (klasse ? " " + klasse : "") + '">' +
      '<span class="uev-angabe uev-angabe-datum">' + UC.icon("calendar", 2) + '<span>' + esc(mitEnde(ev) ? zeitraum(ev.event_date, ev.end_date) : datum(ev.event_date)) + '</span></span>' +
      '<span class="up-marke is-leise" data-i18n="' + esc(tp.label) + '">' + esc(t(tp.label)) + '</span>' +
      (st ? '<span class="uev-angabe uev-status is-' + st.s + '">' + UC.icon(st.ic, 2) + '<span>' + esc(st.text) + '</span></span>' : '') +
    '</div>';
  }
  /* NEUE SEITEN AUF DER KARTE (17.10., Teil C): new_page_count und new_page_cited_count aus
     list_impact_events_v3 -- Seiten der Sitemap, die seit dem Event neu sind, und wie viele davon
     schon zitiert werden. null heisst "noch kein Regel-Ziel gelesen" (nichts zeigen, keine 0),
     0 heisst "nichts Neues" (auch nichts zeigen). Eine ruhige Angabe mit Zeichen, keine Pille. */
  function neueSeitenHtml(ev) {
    if (istWatch(ev)) return "";
    var n = num(ev && ev.new_page_count), c = num(ev && ev.new_page_cited_count);
    if (!(n > 0) || (ev.status === "planned")) return "";
    var k = n === 1 ? (c > 0 ? "{n} new page since the event, cited" : "{n} new page since the event, not cited yet")
                    : (c > 0 ? "{n} new pages since the event, {c} cited" : "{n} new pages since the event, none cited yet");
    return '<span class="uev-angabe uev-karte-neu">' + UC.icon("fileText", 2) + '<span>' + esc(ersetze(t(k), { n: zahl(n), c: zahl(c) })) + '</span></span>';
  }
  /* Der Umfang als Kennzahlen-Raster (Vorlage des Nutzers vom 03.10.: Bezeichnung ueber dem Wert).
     Immer drei Zellen an derselben Stelle, auch bei 0 URLs -- in einer Reihe Karten sucht das Auge
     die Zahl dort, wo sie auf der Nachbarkarte stand; der Vertrag (3.1) zeigt die URLs ebenfalls
     immer. Fehlt ein Wert ganz, steht ein Halbgeviertstrich statt einer erfundenen 0. */
  function kennzahlenHtml(ev) {
    var tc = num(ev.selected_topic_count), pc = num(ev.affected_prompt_count);
    var uc = num(ev.affected_url_count != null ? ev.affected_url_count : (isArr(ev.urls) ? ev.urls.length : null));
    /* Mit einer Regel (15.10.) heisst die dritte Zelle "Tracking" und sagt, was getrackt wird
       ("1 path" statt "0 URLs", Vertrag Abschnitt 2). Nur URLs: wie bisher. */
    var zz = zieleZaehlen(ev);
    var dritte = zz.regeln ? ["Tracking", zz.teile.length === 1 ? ersetze(t(zz.teile[0].n === 1 ? zz.teile[0].eins : zz.teile[0].viele), { n: zahl(zz.teile[0].n) })
        : ersetze(t(zz.gesamt === 1 ? "{n} target" : "{n} targets"), { n: zahl(zz.gesamt) })]
      : ["URLs", uc != null ? zahl(uc) : "\u2013"];
    var zellen = [
      ["Topics", ev.scope_mode === "all" ? t("All") : (tc != null ? zahl(tc) : "\u2013")],
      ["Prompts", pc != null ? zahl(pc) : "\u2013"],
      dritte
    ];
    /* Citation Tracking (19.10.): keine Topics, immer alle Prompts -- zwei Zellen: was beobachtet wird und der Umfang. */
    if (istWatch(ev)) zellen = [dritte, ["Prompts", t("All active")]];
    return '<dl class="uev-stats">' + zellen.map(function (z) {
      return '<div class="uev-stat"><dt>' + esc(t(z[0])) + '</dt><dd>' + esc(z[1]) + '</dd></div>';
    }).join("") + '</dl>';
  }
  /* start: die Startseite einer Domain. Ihr Pfad ist "/", und ein einzelner Schraegstrich als
     zweite Zeile las sich wie ein Fehler (04.10.: "was soll das? Dann schreib da doch Homepage
     hin") -- pfadText zeigt dort "Homepage" aus dem Katalog von core ("Startseite"). */
  function hostPfad(url) {
    try {
      var u = new URL(String(url));
      var pfad = (u.pathname || "/") + (u.search || "");
      return { host: u.hostname.replace(/^www\./, ""), pfad: pfad, start: pfad === "/" };
    } catch (e) { return { host: String(url || ""), pfad: "", start: false }; }
  }
  function pfadText(hp) { return hp.start ? t("Homepage") : hp.pfad; }
  /* Der Host genau, wie das Ziel ihn traegt (EV-08): mit www., und http:// nur dort, wo es nicht
     https ist. Nur fuer Zeilen, die sonst gleich aussaehen (hostPfad streicht beides). */
  function hostGenau(url, hp) {
    try { var u = new URL(String(url)); return (u.protocol === "http:" ? "http://" : "") + u.hostname; } catch (e) { return hp.host; }
  }
  /* fremdUrl: in der App ueber die eigene Adresse (core, Datenschutz 14.10.). */
  function favicon(url) {
    var h = hostPfad(url).host;
    var u = h ? "https://www.google.com/s2/favicons?domain=" + encodeURIComponent(h) + "&sz=64" : "";
    return u && UC.fremdUrl ? UC.fremdUrl(u) : u;
  }

  /* Die Analysefenster des Vertrags (3.9): Presets 7 / 30 / 90 / 180 Tage, Standard 30.
     Entscheidung 2: ein Segment, kein Kalender -- ein freier Zeitraum ist hier nicht gefragt. */
  var FENSTER = [7, 30, 90, 180];
  /* Kurz und in der Reihenfolge, in der man die Seite liest: was ein Event ist, womit verglichen
     wird, wie man das Ergebnis liest. */
  var SEITE_SAETZE = [
    { h: "Event Tracking", t: [
      "Measures what a change did, such as a relaunch or a campaign: Upstreem compares your AI performance before and after its date.",
      "Affected prompts are the prompts in the topics you chose. The comparison group is your other active prompts, which the event did not touch. They show what would have happened anyway.",
      "If the affected prompts improve more than the comparison group, the event likely made the difference. The analysis window sets how many days before and after are compared."] },
    { h: "Citation Tracking", t: [
      "Watches pages and domains. It covers all your prompts, including new ones, and shows which of your pages AI answers cite and how their global share changes. There is no date and no comparison group."] }
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
  /* Ein Stueck Linie fuer eine Legende: durchgezogen (betroffene Prompts) oder gestrichelt
     (Vergleichsgruppe). In der Zeichnung der Seite und in der Anleitung (15.10.). */
  function legLinie(gestrichelt) {
    return '<svg class="uev-vis-linie" viewBox="0 0 18 4" aria-hidden="true"><line x1="1" y1="2" x2="17" y2="2" stroke="currentColor" stroke-width="2" stroke-linecap="round"' +
      (gestrichelt ? ' stroke-dasharray="3 3" stroke-opacity=".55"' : '') + '/></svg>';
  }
  function seiteZeichnung() {
    var pin = UC.iconFormen ? UC.iconFormen("tickets") : "";
    var grund = 'style="fill:var(--vc-inverse-ink)"';
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
    zitiert: { h: "First cited", t: "When an AI response first cited this URL for the affected prompts after the event. \u201cBefore event start\u201d means it was also cited in the six months before the event. This always covers all models and markets, whatever the filters say.",
      chips: [{ text: "After 10 days (18. Sep 2026)", ja: true }, { text: "Not yet" }] }
  };
  var METRIKEN = [
    { key: "visibility", label: "Visibility" },
    { key: "rank", label: "Rank" },
    { key: "sentiment", label: "Sentiment" }
  ];

  /* ---- FALLZAHL JE KENNZAHL (17.10., Beschluss 8) -----------------------------------------------
     Unter der Zahl einer Kachel klein "From 3,120 answers": die Laeufe der betroffenen Prompts vor
     und nach dem Event, wie die DB sie im Block confidence.<feld>.affected mitliefert. Das Urteil der
     DB (verdict, reasons) wird bewusst nicht gelesen und nicht gezeigt: kein Wort, kein Zeichen, keine
     Hinweiszeile -- nur die Zahl, auf der der Wert beruht. Ohne den Block (v3, aeltere Analyse) steht
     nichts da. Fuer den Nachlauf einer Kampagne gibt es keine Zeile (der Bericht ist schon voll). */
  function fallBlock(a, feld) {
    var c = a && a.confidence && typeof a.confidence === "object" ? a.confidence[feld] : null;
    return c && typeof c === "object" ? c : null;
  }
  /* Der Block eines Ziels (targets[].confidence.share_of_citations bei einer Regel). */
  function fallZiel(z, feld) {
    var c = z && z.confidence && typeof z.confidence === "object" ? z.confidence[feld] : null;
    return c && typeof c === "object" ? c : null;
  }
  var FALL_FELD = { visibility: "Visibility", rank: "Rank", sentiment: "Sentiment", share_of_citations: "Share of all citations", global_share: "Global share" };
  /* n: Laeufe der betroffenen Seite vorher + nachher (affected.runs_*), beim Rang die Laeufe mit Rang,
     beim Sentiment die im 30-Tage-Fenster -- so liefert es die DB je Kennzahl. Der Tooltip an der Zahl
     nennt die Kennzahl und die zwei Seiten. Ohne beide Zahlen steht nichts da. */
  function fallzahlHtml(c, feld) {
    if (!c) return "";
    var af = c.affected && typeof c.affected === "object" ? c.affected : {};
    var vb = num(af.runs_before), va = num(af.runs_after);
    var n = vb == null && va == null ? null : (vb || 0) + (va || 0);
    if (!n) return "";
    var txt = n === 1 ? t("From 1 answer") : ersetze(t("From {n} answers"), { n: zahl(n) });
    var tip = vb != null && va != null ? ersetze(t("{m}: {a} answers before the event, {b} after"), { m: t(FALL_FELD[feld] || feld), a: zahl(vb), b: zahl(va) }) : "";
    return '<span class="uev-konf"><span class="uev-konf-n"' + (tip ? ' data-tip="' + esc(tip) + '"' : '') + '>' + esc(txt) + '</span></span>';
  }

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
    "impact_event_url_not_found": "This URL is no longer part of the event.",
    /* Neu mit v2 (13.10., Vertrag Abschnitt 1, Faelle E1-E14) */
    "team_forbidden": "You don't have permission to do that.",
    "team_role_required": "You don't have permission to do that.",
    "impact_event_forbidden": "Only the creator of this event or a team admin can do that.",
    "impact_event_limit_reached": "Your team has reached the limit of 200 events. Delete an event to create a new one.",
    /* Kein Code der Datenbank, sondern unserer (rufen): "And" geschickt, die Funktion kennt
       p_tagmode noch nicht. Am Feld der Topics, mit dem, was jetzt geht. */
    "impact_event_tagmode_unavailable": "Matching all topics isn't available yet. Switch to Or to continue.",
    "timeout": "This is taking longer than expected. Please try again.",
    "network": "We could not reach the server. Check your connection and try again.",
    /* Ziele (15.10., Vertrag Abschnitt 3). impact_event_targets_unavailable ist wieder unserer:
       Ziele gewaehlt, aber die Datenbank kennt create_impact_event_v3 noch nicht. */
    "impact_event_invalid_target": "One of the targets can't be used. Please check the address.",
    "impact_event_too_many_targets": "An event can track at most 50 targets.",
    "impact_event_target_duplicate": "This target is already part of the event.",
    "impact_event_target_not_found": "This target is no longer part of the event.",
    "impact_event_targets_unavailable": "Rules aren't available yet. Please use specific URLs instead.",
    /* Kampagnen (17.10., Vertrag B.3). impact_event_invalid_end_date sagt den Grund im hint
       (ENDE_HINT); campaigns_unavailable ist wieder unserer: v4 war da und ist es nicht mehr. */
    "impact_event_invalid_end_date": "Please check the end date.",
    "impact_event_end_date_frozen": "This campaign has ended. Its end date can't be changed anymore.",
    /* Nach dem Start (409, Teil B): Start und Umfang sind fest, auch wenn der Dialog sie nicht
       mehr anbietet -- ein zweiter Tab oder ein Kollege kann den Stand verschoben haben. */
    "impact_event_locked_field": "This can't be changed after the event has started.",
    "impact_event_scope_frozen": "The scope can't be changed after the event has started.",
    "impact_event_campaigns_unavailable": "Date ranges aren't available right now. Please try again later.",
    "impact_event_watch_unavailable": "Citation Tracking isn't available yet. Please try again later."
  };
  /* impact_event_invalid_param nennt das Feld in hint -- je Feld ein eigener Satz, damit am Feld
     steht, WAS nicht passt. */
  var FEHLER_PARAM = {
    p_name: "Please enter a name with at most 120 characters.",
    p_description: "The description can have at most 2,000 characters.",
    p_event_type: "Please choose a different event type.",
    p_icon: "Please choose a different icon.",
    p_color: "Please choose a different color.",
    p_cover: "Please choose a different cover image.",
    p_tagmode: "Please choose Or or And.",
    p_event_date: "The date must be within the last 6 months.",
    p_notify: "The setting could not be saved. Please try again.",
    p_url: "Please enter a valid URL.", p_urls: "Please enter a valid URL.",
    p_targets: "One of the targets can't be used. Please check the address."
  };
  /* impact_event_invalid_target sagt im hint, WELCHES Ziel nicht geht und WARUM (Rueckmeldung
     15.10., Abschnitt 3): "p_targets[i]: <grund>" bzw. "p_urls[i]: <grund>", i ab 0. Je Grund ein
     Satz fuer den Nutzer; die Vorschau nennt dieselben Gruende in per_target[].error (dort dazu
     too_many_targets fuer alles ab dem 51. Eintrag). */
  var ZIEL_GRUND = {
    input_required: "Please enter an address.",
    input_too_long: "This address is too long.",
    unknown_kind: "This kind of target isn't supported.",
    invalid_url: "Please enter a valid URL.",
    invalid_host: "Please enter a valid domain.",
    unexpected_path: "A domain can't include a path. Use a path rule instead.",
    path_required: "Please add a path, e.g. example.com/blog.",
    invalid_entry: "One of the targets can't be used. Please check the address.",
    /* sitemap_url je Ziel (Teil B): nur http(s), hoechstens 2048 Zeichen. */
    invalid_sitemap_url: "The sitemap address can't be used. Please check it.",
    too_many_targets: "An event can track at most 50 targets."
  };
  function zielHint(h) {
    var m = /^(p_targets|p_urls)\[(\d+)\]\s*:\s*([a-z_]+)/.exec(String(h == null ? "" : h).trim());
    return m ? { feld: m[1], i: +m[2], grund: m[3] } : null;
  }
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
    { key: "poly_sand", datei: "poly-sand.svg", pos: "50%", label: "Sand mosaic" },
    /* Die Motive des Citation Tracking (19.10., vom Nutzer, drei von sechs): eigene Reihe, gleiche Logik. grp "watch" -- ein Event bietet sie nicht an
       und ein Citation Tracking nicht die Wellen und Mosaike. pos: die Kante der Huegel liegt je Motiv woanders. */
    { key: "hills_green", datei: "hills-green.svg", pos: "45%", label: "Green hills", grp: "watch" },
    { key: "hills_purple", datei: "hills-purple.svg", pos: "40%", label: "Purple hills", grp: "watch" },
    { key: "hills_blue", datei: "hills-blue.svg", pos: "45%", label: "Blue hills", grp: "watch" }
  ];
  /* Die Motive einer Art: Event Tracking die ersten sechs, Citation Tracking die eigenen. */
  function coversFuer(art) { return COVERS.filter(function (c) { return (c.grp === "watch") === (art === "watch"); }); }
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

  /* Der dritte Wert jedes Setters: Bubbles "error body" (04.10.). Er zaehlt NUR, wenn keine
     brauchbare Antwort da ist (siehe antwortOk): eine fehlgeschlagene RPC hat kein json, eine
     gelungene braucht keinen Fehler-Wert. Gemeldet am 04.10.: richtige Antwort
     {"affected_prompt_count": 16} kam an, der Zaehler zeigte trotzdem den Fehler -- der dritte
     Wert hatte Vorrang vor einer lesbaren Antwort. So braucht der Workflow keinen zweiten Schritt
     mit "Only when", und was immer Bubble bei Erfolg in den dritten Wert schreibt, schadet nicht. */
  function fehlerDa(f) {
    var s = String(f == null ? "" : f).trim().toLowerCase();
    /* "no"/"false": dort steht "returned an error" statt "error body" (04.10. gemessen: mit "no"
       meldete der Zaehler bei einer gueltigen Antwort einen Fehler). Das Feld sagt dasselbe --
       kein Fehler --, also wird es auch so gelesen. "yes" bleibt ein Fehler ohne Text. */
    return s !== "" && s !== "null" && s !== "undefined" && s !== "no" && s !== "false";
  }

  function antwortOk(art, raw) {
    var o = objekt(raw);
    if (!o) return false;
    if (art === "detail") return o.id != null;
    if (art === "analysis") return o.event_id != null || !!o.windows;
    if (art === "preview") return num(o.affected_prompt_count) != null;
    if (art === "delete") return o.ok === true;
    return true;
  }

  function fehlerText(code, hint) {
    var c = String(code == null ? "" : code).trim(), h = String(hint == null ? "" : hint).trim();
    if (/^team_access_/.test(c)) return t("Your team doesn't have access right now.");
    /* Jedes Ratenlimit (<bereich>_rate_limited, 429) sagt dasselbe -- der Bereich ist intern. */
    if (/_rate_limited$/.test(c)) return t(FEHLER.impact_event_rate_limited);
    /* update_impact_event_v3 antwortet als einfaches Mitglied mit forbidden und hint
       creator,owner,admin: dann sagt der Satz, WER es darf, statt eines allgemeinen "kein Recht". */
    if (c === "forbidden" && /creator/.test(h)) return t(FEHLER.impact_event_forbidden);
    /* Der Start (Teil B, hint "p_event_date: today-183 .. today+365"): von heute minus 183 Tagen
       bis heute plus 365, auch als Parameterfehler. Der alte Satz ("within the last 6 months")
       kennt die Zukunft nicht und waere mit Kampagnen falsch. */
    if (c === "impact_event_invalid_date" || (c === "impact_event_invalid_param" && /^p_event_date/.test(h))) return t(STARTFENSTER());
    if (c === "impact_event_invalid_param") return t(FEHLER_PARAM[h.split(":")[0].trim()] || "Please check your input and try again.");
    if (c === "impact_event_invalid_end_date") return t(ENDE_HINT[h] || FEHLER.impact_event_invalid_end_date);
    /* E1b: beim Anlegen steht in hint die URL selbst, die nicht ging -- bei mehreren ist das die
       einzige Stelle, die sagt, welche. Es ist die Eingabe des Nutzers; gezeigt wird sie als Text. */
    if (c === "impact_event_invalid_url" && h && !/^p_/.test(h)) return ersetze(t("This URL can't be used: {url}"), { url: h });
    if (c === "impact_event_invalid_target" && h && !/^p_/.test(h)) return ersetze(t("This can't be used: {wert}"), { wert: h });
    /* Der Grund aus "p_targets[i]: <grund>". Welches Ziel, sagt das Popup dazu (feldFehlerZeigen). */
    var zh = c === "impact_event_invalid_target" ? zielHint(h) : null;
    if (zh) return t(ZIEL_GRUND[zh.grund] || FEHLER.impact_event_invalid_target);
    return t(FEHLER[c] || "Something went wrong. Please try again.");
  }
  /* Welches Feld eines Popups einen Fehler beheben kann: zuerst nach hint (dem Feld, das der
     Server nennt), sonst nach dem Code. */
  var FELD_VON_HINT = { p_name: "name", p_description: "text", p_event_type: "typ", p_icon: "aussehen", p_color: "aussehen",
    p_cover: "cover", p_event_date: "datum", p_end_date: "datum", p_tag_ids: "topics", p_tagmode: "topics", p_scope_mode: "topics", p_urls: "ziele", p_url: "ziele", p_targets: "ziele" };
  /* "ziele" (15.10.): URLs und Regeln stehen in EINEM Feld, Schritt 3 bzw. im Add-Dialog. */
  var FELD_VON_CODE = { impact_event_name_required: "name", impact_event_invalid_date: "datum",
    impact_event_invalid_end_date: "datum", impact_event_end_date_frozen: "datum", impact_event_locked_field: "datum", impact_event_scope_frozen: "topics",
    impact_event_topics_required: "topics", impact_event_invalid_topics: "topics", impact_event_tagmode_unavailable: "topics", impact_event_no_active_prompts: "topics",
    impact_event_invalid_url: "ziele", impact_event_url_duplicate: "ziele", impact_event_too_many_urls: "ziele",
    impact_event_invalid_target: "ziele", impact_event_too_many_targets: "ziele", impact_event_target_duplicate: "ziele", impact_event_targets_unavailable: "ziele" };
  function feldVonFehler(code, hint) {
    var c = String(code == null ? "" : code), h = String(hint == null ? "" : hint);
    if (c === "impact_event_invalid_param" || FELD_VON_CODE[c]) return FELD_VON_HINT[h] || FELD_VON_CODE[c] || "";
    return "";
  }

  /* Kampagnen (17.10.). "Date", "Date range", "Running", "Save", "Edit event" und "Tracking"
     stehen schon in core bzw. oben -- nicht noch einmal (Katalog-Kollision). */
  if (UC.addMessages) UC.addMessages("de", {
    "Planned": "Geplant", "Completed": "Abgeschlossen", "Running, day {n} of {m}": "Läuft, Tag {n} von {m}", "Day {n}": "Tag {n}",
    "Start date": "Startdatum", "End date": "Enddatum", "Since event": "Seit Event",
    "Planned events can be fully edited until they start.": "Geplante Events kannst du bis zum Start komplett ändern.",
    "We compare the campaign with the same number of days before it, and show what happens after it ends.":
      "Wir vergleichen die Kampagne mit gleich vielen Tagen davor und zeigen, was nach ihrem Ende passiert.",
    "We compare the days after this date with the days before it.": "Wir vergleichen die Tage nach diesem Datum mit den Tagen davor.",
    "Starts on {date}": "Startet am {date}", "Results appear from then on.": "Ab dann erscheinen hier die Ergebnisse.",
    "Campaign report, {range}": "Abschlussbericht, {range}",
    "So far, compared with the {n} days before the start": "Bisher, verglichen mit den {n} Tagen vor dem Start",
    "Compared with the {n} days before the event": "Verglichen mit den {n} Tagen vor dem Event",
    "During": "Während", "Follow-up period, until {date}": "Nachlauf, bis {date}",
    "Starts after the campaign ends": "Beginnt nach dem Ende der Kampagne",
    "Start date and scope can't be changed": "Startdatum und Umfang lassen sich nicht ändern",
    "Only the creator of this event or a team admin can change the end date.": "Nur wer das Event angelegt hat oder ein Team-Admin kann das Enddatum ändern.",
    "The start date must be within the last 6 months or the next 12 months.": "Der Start muss in den letzten 6 oder den nächsten 12 Monaten liegen.",
    "Please check the end date.": "Bitte prüf das Enddatum.",
    "The end date can't be before the start date.": "Das Enddatum kann nicht vor dem Start liegen.",
    "A campaign can run for at most 183 days.": "Eine Kampagne kann höchstens 183 Tage laufen.",
    "The end date can't be in the past.": "Das Enddatum kann nicht in der Vergangenheit liegen.",
    "This campaign has ended. Its end date can't be changed anymore.": "Diese Kampagne ist beendet. Ihr Enddatum lässt sich nicht mehr ändern.",
    "Date ranges aren't available right now. Please try again later.": "Zeiträume sind gerade nicht verfügbar. Bitte versuch es später noch einmal.",
    "All active Prompts on the start date": "Alle aktiven Prompts am Starttag",
    "{n} prompt was deleted since this event": "{n} Prompt wurde seit diesem Event gelöscht",
    "{n} prompts were deleted since this event": "{n} Prompts wurden seit diesem Event gelöscht",
    "The prompt selection is fixed on the start date.": "Die Auswahl der Prompts steht am Starttag fest.",
    "{n} of {m} days after the event observed so far": "{n} von {m} Tagen nach dem Event bisher beobachtet",
    "The numbers after the event only use the days that have data so far.": "Die Zahlen nach dem Event nutzen nur die Tage, für die es bisher Daten gibt.",
    "A running event can't switch between a start date and a date range.": "Ein laufendes Event kann nicht zwischen einem Startdatum und einem Zeitraum wechseln.",
    "This can't be changed after the event has started.": "Das lässt sich nach dem Start des Events nicht mehr ändern.",
    "The scope can't be changed after the event has started.": "Der Umfang lässt sich nach dem Start des Events nicht mehr ändern.",
    "The sitemap address can't be used. Please check it.": "Die Sitemap-Adresse kann nicht verwendet werden. Bitte prüf sie."
  });

  /* DER KATALOG IST EINER FUER DIE GANZE APP. Ein Schluessel, den core schon kennt, steht hier
     NICHT noch einmal: addMessages ueberschreibt ihn ueberall. So hatte Teil 2 "Brand" zu "Marke",
     "Overview" zu "Übersicht" und "Event" zu "Event" gemacht -- das letzte stellte die Spalte
     "Ereignis" im Aktivitaetsprotokoll der Teams um. Vor jedem neuen Eintrag in core.js suchen. */

  /* Experimente: Event Tracking und Citation Tracking (19.10.). Die Namen der beiden Arten bleiben englisch (Eigennamen der Abschnitte);
     die Sätze und Felder sind deutsch. "Create" und "Experiments" liegen in core. */
  if (UC.addMessages) UC.addMessages("de", {
    "Event Tracking": "Event Tracking", "Citation Tracking": "Citation Tracking",
    "Create Event Tracking": "Event Tracking erstellen", "Create Citation Tracking": "Citation Tracking erstellen", "Edit Citation Tracking": "Citation Tracking bearbeiten",
    "What do you want to create?": "Was möchtest du erstellen?",
    "Measure what a change did. Compares your AI results before and after a date, against a control group of prompts you didn't change.":
      "Miss, was eine Änderung bewirkt hat. Vergleicht deine AI-Ergebnisse vor und nach einem Datum mit einer Kontrollgruppe unveränderter Prompts.",
    "Keep an eye on pages and domains. See which of them AI answers cite, across all your prompts, including new ones. No before-and-after test.":
      "Behalte Seiten und Domains im Blick. Sieh, welche davon KI-Antworten zitieren, über alle deine Prompts, auch neue. Kein Vorher-Nachher-Test.",
    "Step {n} of 3": "Schritt {n} von 3",
    "e.g. Help center pages": "z. B. Seiten des Hilfecenters", "What do you want to keep an eye on?": "Was möchtest du im Blick behalten?",
    "The type can't be changed later": "Die Art lässt sich später nicht ändern",
    "Citation Tracking created": "Citation Tracking erstellt", "Created {date}": "Erstellt am {date}", "All active": "Alle aktiven",
    "Measure what a change did with Event Tracking, or watch which of your pages AI answers cite with Citation Tracking.":
      "Miss mit Event Tracking, was eine Änderung bewirkt hat, oder beobachte mit Citation Tracking, welche deiner Seiten KI-Antworten zitieren.",
    "Pages and domains you watch. Global share is measured across all your active prompts.": "Seiten und Domains, die du beobachtest. Der Global Share wird über alle deine aktiven Prompts gemessen.",
    "Previous {n} days": "Vorherige {n} Tage", "Last {n} days": "Letzte {n} Tage",
    "No matching entries": "Keine passenden Einträge",
    "Citation Tracking isn't available yet. Please try again later.": "Citation Tracking ist noch nicht verfügbar. Bitte versuche es später noch einmal.",
    "Track an Event": "Event tracken", "Track Citations": "Zitate tracken",
    "Measure the impact of Campaigns, Product Launches or other assets": "Miss die Wirkung von Kampagnen, Produktlaunches oder anderen Assets",
    "Keep an eye on pages and domains with realtime updates": "Behalte Seiten und Domains mit Echtzeit-Updates im Blick",
    "Full overview": "Gesamtübersicht", "Pages only": "Nur Seiten",
    "Previous and last {n} days": "Vorherige und letzte {n} Tage", "Citations ({n}d)": "Zitate ({n} T)",
    "Chart shows": "Chart zeigt",
    "Before this period": "Vor diesem Zeitraum",
    "Track an Event measures what a change did, Track Citations watches which of your pages AI answers cite. You choose when you create.":
      "Event tracken misst, was eine Änderung bewirkt hat, Zitate tracken beobachtet, welche deiner Seiten KI-Antworten zitieren. Du wählst beim Erstellen.",
    "Two ways to track": "Zwei Arten zu tracken",
    "Track an Event: Measure the impact of Campaigns, Product Launches or other assets. Track Citations: Keep an eye on pages and domains with realtime updates. The tour continues with Track an Event.":
      "Event tracken: Miss die Wirkung von Kampagnen, Produktlaunches oder anderen Assets. Zitate tracken: Behalte Seiten und Domains mit Echtzeit-Updates im Blick. Die Tour geht mit Event tracken weiter.",
    "Measures what a change did, such as a relaunch or a campaign: Upstreem compares your AI performance before and after its date.":
      "Misst, was eine Änderung bewirkt hat, etwa ein Relaunch oder eine Kampagne: Upstreem vergleicht deine AI Performance vor und nach dem Datum.",
    "Watches pages and domains. It covers all your prompts, including new ones, and shows which of your pages AI answers cite and how their global share changes. There is no date and no comparison group.":
      "Beobachtet Seiten und Domains. Es umfasst alle deine Prompts, auch neue, und zeigt, welche deiner Seiten KI-Antworten zitieren und wie sich ihr Global Share verändert. Es gibt kein Datum und keine Vergleichsgruppe.",
  });
  if (UC.addMessages) UC.addMessages("de", {
    "Notify me": "Benachrichtige mich",
    "Get a note when a page is cited for the first time.": "Du bekommst eine Nachricht, wenn eine Seite zum ersten Mal zitiert wird.",
    "Get a note when a page is cited for the first time and when the campaign ends.": "Du bekommst eine Nachricht, wenn eine Seite zum ersten Mal zitiert wird und wenn die Kampagne endet.",
    "Notifications on": "Benachrichtigungen an",
    "Notifications off": "Benachrichtigungen aus",
    "The setting could not be saved. Please try again.": "Die Einstellung konnte nicht gespeichert werden. Bitte versuch es noch einmal.",
    "Track important changes and understand how AI performance develops around them.":
      "Halte wichtige Änderungen fest und sieh, wie sich die AI Performance um sie herum entwickelt.",
    "Create event": "Event anlegen", "Search events…": "Events durchsuchen…", "Search events": "Events durchsuchen",
    "Event type": "Event-Typ", "Search types…": "Typen durchsuchen…",
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
    "Pages, articles or external sources associated with this event. Global share is measured in the affected prompts.":
      "Seiten, Artikel oder externe Quellen zu diesem Event. Der Global Share zählt in den betroffenen Prompts.",
    "First cited": "Erstmals zitiert", "Global share before": "Global Share vorher", "Global share after": "Global Share nachher",
    "On event day": "Am Event-Tag", "After {n} days ({date})": "Nach {n} Tagen ({date})", "After 1 day ({date})": "Nach 1 Tag ({date})",
    "Before event start": "Vor Eventstart", "After 10 days (18. Sep 2026)": "Nach 10 Tagen (18. Sep 2026)",
    "When an AI response first cited this URL for the affected prompts after the event. \u201cBefore event start\u201d means it was also cited in the six months before the event. This always covers all models and markets, whatever the filters say.":
      "Wann eine KI-Antwort diese URL nach dem Event zum ersten Mal für die betroffenen Prompts zitiert hat. \u201eVor Eventstart\u201c heißt: auch in den sechs Monaten vor dem Event zitiert. Das gilt immer für alle Modelle und Märkte, egal welche Filter gesetzt sind.",
    "Not yet": "Noch nicht", "Not within 6 months": "Nicht in 6 Monaten",
    "No URLs added yet": "Noch keine URLs",
    "Add pages, articles or external sources associated with this event.":
      "Füge Seiten, Artikel oder externe Quellen zu diesem Event hinzu.",
    "Event scope": "Umfang des Events", "Affected topics": "Betroffene Topics",
    "All active Prompts at event creation": "Alle aktiven Prompts beim Anlegen",
    "Upstreem compares the affected Prompts with other eligible Prompts that were active when this event was created.":
      "Upstreem vergleicht die betroffenen Prompts mit anderen passenden Prompts, die beim Anlegen des Events aktiv waren.",
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
    "vs. comparison": "vs. Vergleich", "Comparison group": "Vergleichsgruppe", "No comparison group": "Keine Vergleichsgruppe",
    "How event analysis works": "So funktioniert die Event-Analyse", "How Impact works": "So funktioniert Impact",
    "An event marks a change, such as a relaunch or a campaign. Upstreem compares your AI performance before and after its date.":
      "Ein Event markiert eine Änderung, etwa einen Relaunch oder eine Kampagne. Upstreem vergleicht deine AI Performance vor und nach dem Datum.",
    "Affected prompts are the prompts in the topics you chose. The comparison group is your other active prompts, which the event did not touch. They show what would have happened anyway.":
      "Betroffene Prompts sind die Prompts in den gewählten Topics. Die Vergleichsgruppe sind deine übrigen aktiven Prompts, die das Event nicht berührt. Sie zeigen, was ohnehin passiert wäre.",
    "If the affected prompts improve more than the comparison group, the event likely made the difference. The analysis window sets how many days before and after are compared.":
      "Steigen die betroffenen Prompts stärker als die Vergleichsgruppe, hat das Event wahrscheinlich den Unterschied gemacht. Das Analysefenster legt fest, wie viele Tage davor und danach verglichen werden.", "Search URLs…": "URLs durchsuchen…", "Filter by URL": "Nach URL filtern",
    "This event could not be loaded.": "Dieses Event konnte nicht geladen werden.",
    "Back to overview": "Zurück zur Übersicht",
    "Delete event": "Event löschen", "Delete this event?": "Dieses Event löschen?",
    "Discard this event?": "Dieses Event verwerfen?", "Discard changes?": "Änderungen verwerfen?",
    "Everything you entered will be lost.": "Alles, was du eingegeben hast, geht verloren.",
    "Your changes won't be saved.": "Deine Änderungen werden nicht gespeichert.", "Keep editing": "Weiter bearbeiten",
    "The event, its scope and its URL list are removed. Prompt history, citations and responses stay untouched.":
      "Das Event, sein Umfang und seine URL-Liste werden entfernt. Prompt-Verlauf, Zitate und Responses bleiben unberührt.",
    "Remove URL": "URL entfernen", "Remove this URL from the event?": "Diese URL aus dem Event entfernen?",
    "Only the link to this event is removed. The URL and its citations stay untouched.":
      "Nur die Zuordnung zu diesem Event wird entfernt. Die URL und ihre Zitate bleiben unberührt.",
    "You don't have permission to do that.": "Dafür fehlt dir die Berechtigung.",
    "Too many requests. Please wait a moment and try again.": "Zu viele Anfragen. Bitte kurz warten und erneut versuchen.",
    "The date must be within the last 6 months.": "Das Datum muss in den letzten 6 Monaten liegen.",
    "Please select at least one topic.": "Bitte mindestens ein Topic wählen.",
    "One of the topics is no longer available.": "Ein Topic ist nicht mehr verfügbar.",
    "The selection contains no active prompts.": "Die Auswahl enthält keine aktiven Prompts.",
    "Please enter a valid URL.": "Bitte eine gültige URL eingeben.",
    "This URL is already part of the event.": "Diese URL ist bereits im Event.",
    "An event can have at most 100 URLs.": "Maximal 100 URLs pro Event.",
    "This event no longer exists.": "Dieses Event existiert nicht mehr.",
    "This URL is no longer part of the event.": "Diese URL gehört nicht mehr zum Event.",
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
    "Change cover": "Titelbild ändern", "Add cover": "Titelbild hinzufügen", "Unpin from sidebar": "Von der Seitenleiste lösen",
    "Blue wave": "Blaue Welle", "Pink wave": "Rosa Welle", "Teal wave": "Petrol-Welle",
    "Blue mosaic": "Blaues Mosaik", "Pink mosaic": "Rosa Mosaik", "Sand mosaic": "Sandfarbenes Mosaik",
    "Step {n} of 3": "Schritt {n} von 3", "URLs & review": "URLs & Prüfen",
    "Select at least one topic.": "Mindestens ein Topic wählen.", "Counting prompts…": "Prompts werden gezählt…",
    "The number of prompts could not be loaded.": "Die Zahl der Prompts konnte nicht geladen werden.",
    "{n} prompt will be included in this event.": "{n} Prompt gehört zu diesem Event.",
    "{n} prompts will be included in this event.": "{n} Prompts gehören zu diesem Event.",
    "{n} active prompt included": "{n} aktiver Prompt enthalten", "{n} active prompts included": "{n} aktive Prompts enthalten",
    "Already in this event": "Schon im Event", "Added": "Hinzugefügt", "Add as new target": "Als neues Ziel hinzufügen",
    "New target": "Neues Ziel",
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
    "Prompts in any of the selected topics": "Prompts in mindestens einem der gewählten Topics",
    "Only prompts in all of these topics": "Nur Prompts, die in allen diesen Topics stehen",
    "Please choose Or or And.": "Bitte wähle Oder oder Und.",
    "Only prompts in all selected topics": "Nur Prompts, die in allen gewählten Topics stehen",
    "Matching all topics isn't available yet. Switch to Or to continue.":
      "Die Verknüpfung mit Und ist noch nicht verfügbar. Wechsle zu Oder, um weiterzumachen.",
    /* 03.10.: Typ-Auswahl mit eigenem Typ, Klick-Dummy, Ende des Wartens */
    "Search types": "Typen durchsuchen", "No types found": "Keine Typen gefunden", "Your type": "Dein Typ",
    "Example data": "Beispieldaten", "Example data. Nothing you do here is saved.": "Beispieldaten. Nichts, was du hier tust, wird gespeichert.",
    "Events could not be loaded": "Events konnten nicht geladen werden", "Please reload the page.": "Bitte lade die Seite neu.",
    /* 13.10.: die Pruefungen von v2 */
    "Please enter a name with at most 120 characters.": "Der Name darf höchstens 120 Zeichen lang sein.",
    "The description can have at most 2,000 characters.": "Die Beschreibung darf höchstens 2.000 Zeichen lang sein.",
    "Please choose a different event type.": "Wähl bitte einen anderen Event-Typ.",
    "Please choose a different icon.": "Wähl bitte ein anderes Symbol.",
    "Please choose a different color.": "Wähl bitte eine andere Farbe.",
    "Please choose a different cover image.": "Wähl bitte ein anderes Titelbild.",
    "Please check your input and try again.": "Prüf deine Eingaben und versuch es noch einmal.",
    "This URL can't be used: {url}": "Diese URL lässt sich nicht verwenden: {url}",
    "Only the creator of this event or a team admin can do that.": "Das kann nur, wer das Event angelegt hat, oder ein Admin des Teams.",
    "Your team has reached the limit of 200 events. Delete an event to create a new one.":
      "Dein Team hat die Grenze von 200 Events erreicht. Lösch ein Event, um ein neues anzulegen."
  });
  /* 15.10.: Ziele, Sitemap, Auswertung je Regel, Anleitung. Jeder Schluessel gegen alle Kataloge
     geprueft (Katalog-Kollision): keiner steht schon in core oder einer anderen Komponente. */
  if (UC.addMessages) UC.addMessages("de", {
    /* Schritte und Ziele */
    "Step {n} of 4": "Schritt {n} von 4", "Step {n} of 2": "Schritt {n} von 2", "Tracking": "Tracking", "Check and create": "Prüfen und anlegen", "Check and save": "Prüfen und speichern",
    "What should we track?": "Was sollen wir tracken?", "Choose what to track.": "Wähl aus, was getrackt werden soll.",
    "URLs, paths or domains": "URLs, Pfade oder Domains", "Add to tracking": "Zum Tracking hinzufügen",
    "Brand metrics only": "Nur Markenwerte", "Visibility, rank and sentiment": "Visibility, Rank und Sentiment",
    "Specific URLs": "Bestimmte URLs", "Everything under a path": "Alles unter einem Pfad",
    "Whole domain": "Ganze Domain", "Include all subdomains": "Alle Subdomains einbeziehen",
    "Path": "Pfad", "Domain and subdomains": "Domain und Subdomains", "e.g.": "z. B.", "and {n} more": "und {n} weitere",
    "Search your URLs or paste links": "Eigene URLs durchsuchen oder Links einfügen",
    "Search or paste a URL, a path or a domain": "URL, Pfad oder Domain suchen oder einfügen",
    "Search or paste a path, e.g. example.com/blog": "Pfad suchen oder einfügen, z. B. example.com/blog",
    "Search or paste a domain, e.g. example.com": "Domain suchen oder einfügen, z. B. example.com",
    "Enter a domain like example.com.": "Gib eine Domain wie example.com ein.",
    "Please add a path, e.g. example.com/blog.": "Gib bitte einen Pfad an, z. B. example.com/blog.",
    "Please enter a valid domain.": "Gib bitte eine gültige Domain ein.",
    "The comparison uses different models": "Der Vergleich nutzt andere Modelle",
    "Based on {n} of {m} affected prompts": "Basiert auf {n} von {m} betroffenen Prompts",
    "Comparison based on {n} of {m} prompts": "Vergleich basiert auf {n} von {m} Prompts",
    "Only prompts with data both before and after the event count in these numbers.": "In diese Zahlen gehen nur Prompts mit Daten vor und nach dem Event ein.",
    "The affected prompts are measured on {a}, the comparison group on {b}.": "Die betroffenen Prompts werden mit {a} gemessen, die Vergleichsgruppe mit {b}.",
    "{ziel}: Please add a path, e.g. example.com/blog.": "{ziel}: Gib bitte einen Pfad an, z. B. example.com/blog.",
    "{ziel}: Enter a domain like example.com.": "{ziel}: Gib eine Domain wie example.com ein.",
    "This can't be used: {wert}": "Das lässt sich nicht verwenden: {wert}",
    "{ziel} is already in the list.": "{ziel} steht schon in der Liste.",
    "{ziel} is also covered by {regel} and gets its own row.": "{ziel} ist auch in {regel} enthalten und bekommt eine eigene Zeile.",
    "Add one URL at a time.": "Füg eine URL nach der anderen hinzu.",
    "This looks like a sitemap.": "Das sieht nach einer Sitemap aus.",
    "This looks like a sitemap. Please add the pages or the domain instead.": "Das sieht nach einer Sitemap aus. Füg stattdessen die Seiten oder die Domain hinzu.",
    "Rules count retroactively, also for pages that were cited before you add them.":
      "Regeln zählen rückwirkend, auch für Seiten, die schon vor dem Hinzufügen zitiert wurden.",
    "One of the targets can't be used. Please check the address.": "Eines der Ziele lässt sich nicht verwenden. Prüf bitte die Adresse.",
    "An event can track at most 50 targets.": "Ein Event kann höchstens 50 Ziele tracken.",
    "This target is already part of the event.": "Dieses Ziel gehört schon zum Event.",
    "This target is no longer part of the event.": "Dieses Ziel gehört nicht mehr zum Event.",
    "Rules aren't available yet. Please use specific URLs instead.": "Regeln sind noch nicht verfügbar. Nimm bitte stattdessen bestimmte URLs.",
    "You can add {n} more targets to this event.": "Du kannst diesem Event noch {n} Ziele hinzufügen.",
    "Added to tracking": "Zum Tracking hinzugefügt",
    "{n} path": "{n} Pfad", "{n} paths": "{n} Pfade", "{n} domain": "{n} Domain", "{n} domains": "{n} Domains",
    "{n} target": "{n} Ziel", "{n} targets": "{n} Ziele",
    /* Rueckmeldung der Datenbank (15.10. spaet): Gruende eines ungueltigen Ziels, Doppelte */
    "Please enter an address.": "Gib bitte eine Adresse ein.",
    "This address is too long.": "Diese Adresse ist zu lang.",
    "This kind of target isn't supported.": "Diese Art von Ziel wird nicht unterstützt.",
    "A domain can't include a path. Use a path rule instead.": "Eine Domain kann keinen Pfad enthalten. Nimm stattdessen eine Pfad-Regel.",
    "These targets are already part of the event.": "Diese Ziele gehören schon zum Event.",
    "{n} target was already tracked.": "{n} Ziel wurde schon getrackt.",
    "{n} targets were already tracked.": "{n} Ziele wurden schon getrackt.",
    /* Live-Vorschau */
    "Checking the last {n} days…": "Die letzten {n} Tage werden geprüft…", "Last {n} days:": "Letzte {n} Tage:",
    "{n} URL matches": "{n} URL passt", "{n} URLs match": "{n} URLs passen",
    "{n} citation": "{n} Zitat", "{n} citations": "{n} Zitate", "in {n} prompt": "in {n} Prompt", "in {n} prompts": "in {n} Prompts",
    "No citations for {alt}. AI answers cite this page as {url}.": "Keine Zitate für {alt}. KI-Antworten zitieren diese Seite als {url}.",
    "Use {url}": "{url} verwenden",
    "We haven't seen this domain in your citations. Did you mean {host}?": "Diese Domain kommt in deinen Zitaten nicht vor. Meintest du {host}?",
    "We haven't seen {alt} in your citations. Did you mean {host}?": "{alt} kommt in deinen Zitaten nicht vor. Meintest du {host}?",
    "Use {host}": "{host} verwenden",
    "This subdomain hasn't been cited yet. It will be counted from its first citation.": "Diese Subdomain wurde noch nicht zitiert. Sie zählt ab dem ersten Zitat.",
    "This domain hasn't been cited yet. It will be counted from its first citation.": "Diese Domain wurde noch nicht zitiert. Sie zählt ab dem ersten Zitat.",
    "No cited page matches yet. Matching pages count from their first citation.": "Noch passt keine zitierte Seite. Passende Seiten zählen ab ihrem ersten Zitat.",
    "{host} doesn't count as your domain yet.": "{host} zählt noch nicht als deine Domain.",
    "Count as your domain": "Als deine Domain zählen",
    "The preview could not be loaded.": "Die Vorschau konnte nicht geladen werden.",
    /* Sitemap */
    "Full Event Overview": "Komplette Event-Übersicht", "Citation Tracking only": "Nur Citation-Tracking",
    "{n} of {m} cited": "{n} von {m} zitiert",
        "Load from sitemap": "Aus Sitemap laden", "Sitemap link or domain": "Sitemap-Link oder Domain", "Load": "Laden",
    "Reading your sitemap": "Deine Sitemap wird gelesen", "Looking for your sitemap…": "Sitemap wird gesucht…",
    "Reading pages…": "Seiten werden gelesen…", "Sorting pages into folders…": "Seiten werden nach Ordnern sortiert…",
    /* 16.10.: je nach Eingabe (Domain oder Datei) ein eigener Satz, jeder sagt, was stattdessen geht */
    "We couldn't find a sitemap for {domain}. Try the full link to your sitemap.xml.": "Für {domain} haben wir keine Sitemap gefunden. Versuch den vollständigen Link zu deiner sitemap.xml.",
    "We couldn't open this sitemap. Check the link, or enter just your domain.": "Diese Sitemap ließ sich nicht öffnen. Prüf den Link oder gib nur deine Domain ein.",
    "This link isn't a sitemap. Enter your domain or the link to your sitemap.xml.": "Dieser Link ist keine Sitemap. Gib deine Domain oder den Link zu deiner sitemap.xml ein.",
    "The website took too long to answer. Please try again later.": "Die Website hat zu lange gebraucht. Versuch es bitte später noch einmal.",
    "This sitemap is too large to read. Try one of the smaller sitemaps it lists.": "Diese Sitemap ist zu groß. Versuch eine der kleineren Sitemaps, die sie auflistet.",
    "This address can't be read. Please use the public address of your website.": "Diese Adresse lässt sich nicht lesen. Nimm bitte die öffentliche Adresse deiner Website.",
    "Too many sitemap requests. Please wait a while and try again.": "Zu viele Sitemap-Abrufe. Warte bitte eine Weile und versuch es dann noch einmal.",
    "Please enter a sitemap link or a domain.": "Gib bitte einen Sitemap-Link oder eine Domain ein.",
    "The sitemap could not be loaded. Please try again.": "Die Sitemap konnte nicht geladen werden. Versuch es bitte noch einmal.",
    "{n} pages from {source}": "{n} Seiten aus {source}", "Only the first {n} pages could be read.": "Nur die ersten {n} Seiten ließen sich lesen.",
    "This sitemap lists no pages.": "Diese Sitemap listet keine Seiten.", "{n} page": "{n} Seite",
    /* 16.10.: Rueckfall von sitemap-lesen Version 5 (angegebene Datei war HTML) */
    "This link isn't a sitemap. {n} pages from {source} instead.": "Dieser Link ist keine Sitemap. Stattdessen {n} Seiten aus {source}.",
    "This link isn't a sitemap. 1 page from {source} instead.": "Dieser Link ist keine Sitemap. Stattdessen eine Seite aus {source}.",
    "1 page from {source}": "Eine Seite aus {source}",
    "This link isn't a sitemap, and {source} lists no pages.": "Dieser Link ist keine Sitemap, und {source} listet keine Seiten.",
    "This link isn't a sitemap, and we couldn't find one for {domain}. Try the full link to your sitemap.xml.": "Dieser Link ist keine Sitemap, und für {domain} haben wir keine gefunden. Versuch den vollständigen Link zu deiner sitemap.xml.",
    "Please enter a valid sitemap link or domain.": "Gib bitte einen gültigen Sitemap-Link oder eine Domain ein.",
    "Loading a sitemap isn't available right now.": "Das Laden einer Sitemap ist gerade nicht verfügbar.",
    "Too many sitemap requests. Please try again in 1 minute.": "Zu viele Sitemap-Abrufe. Versuch es bitte in 1 Minute noch einmal.",
    "Too many sitemap requests. Please try again in {n} minutes.": "Zu viele Sitemap-Abrufe. Versuch es bitte in {n} Minuten noch einmal.",
    "Newest change": "Jüngste Änderung",
    "Included in {ordner}. Clear that folder to choose this page on its own.": "Schon in {ordner} enthalten. Nimm den Ordner ab, um diese Seite einzeln zu wählen.",
    "Track everything under {path}": "Alles unter {path} tracken",
    /* 17.10.: eine Seite unter einer Regel bleibt waehlbar und sagt leise, wo sie schon mitzaehlt (smZustand) */
    "You're tracking the whole domain, so individual pages can't be excluded. To pick specific pages, switch to \u201cEverything under a path\u201d or \u201cSpecific URLs\u201d.":
      "Du trackst die ganze Domain, einzelne Seiten lassen sich daher nicht ausnehmen. Um bestimmte Seiten zu wählen, wechsle zu \u201eAlles unter einem Pfad\u201c oder \u201eBestimmte URLs\u201c.",
    "You're tracking everything under {ziel}, so individual pages can't be excluded. To pick specific pages, switch to \u201cSpecific URLs\u201d.":
      "Du trackst alles unter {ziel}, einzelne Seiten lassen sich daher nicht ausnehmen. Um bestimmte Seiten zu wählen, wechsle zu \u201eBestimmte URLs\u201c.",
    "All {n} pages are covered by {ziel}.": "Alle {n} Seiten sind durch {ziel} abgedeckt.",
    "The page is covered by {ziel}.": "Die Seite ist durch {ziel} abgedeckt.",
    "your targets": "deine Ziele",
    "{n} of {m} URLs": "{n} von {m} URLs", "The URLs couldn't be loaded.": "Die URLs konnten nicht geladen werden.",
    "{n} matching page": "{n} passende Seite", "{n} matching pages": "{n} passende Seiten",
    "Only the pages loaded so far were searched.": "Durchsucht wurden nur die bisher geladenen Seiten.",
    "Show {n} more": "{n} weitere zeigen", "No matching pages": "Keine passenden Seiten", "Add selection": "Auswahl übernehmen",
    /* 17.10.: nichts mehr zu waehlen, weil alles schon getrackt ist (smHoechstens) */
    "Everything in this sitemap is already added.": "Alles aus dieser Sitemap ist bereits hinzugefügt.",
    "Expand": "Aufklappen", "Collapse": "Zuklappen",
    /* 16.10.: der Deckel im Waehler und am Feld (ZIEL_MAX je Event) */
    "You can add {n} more targets. A folder counts as one and covers every page in it.": "Du kannst noch {n} Ziele hinzufügen. Ein Ordner zählt als eins und deckt jede Seite darin ab.",
    "You can add 1 more target. A folder counts as one and covers every page in it.": "Du kannst noch ein Ziel hinzufügen. Ein Ordner zählt als eins und deckt jede Seite darin ab.",
    "That's the most you can add. To cover more pages, select a folder instead.": "Mehr geht nicht. Für weitere Seiten wähl stattdessen einen Ordner.",
    "No more targets fit into this event.": "In dieses Event passen keine weiteren Ziele.",
    "You can add 1 more target to this event.": "Du kannst diesem Event noch ein Ziel hinzufügen.",
    /* Auswertung je Regel */
    "Everything under this path, including pages added later.": "Alles unter diesem Pfad, auch Seiten, die später dazukommen.",
    "Every page on this domain, including pages added later.": "Jede Seite dieser Domain, auch Seiten, die später dazukommen.",
    "Every page on this domain and its subdomains, including pages added later.": "Jede Seite dieser Domain und ihrer Subdomains, auch Seiten, die später dazukommen.",
    "Cited URLs": "Zitierte URLs", "In the whole period": "Im gesamten Zeitraum",
    "Citation count": "Zitate", "Before and after the event": "Vor und nach dem Event",
    "Share of all citations": "Anteil an allen Zitaten", "New URLs": "Neue URLs", "First cited after the event": "Erstmals nach dem Event zitiert",
    "Citations after": "Zitate nachher",
    "First cited, before and after the event": "Erstmals zitiert, vor und nach dem Event",
    "Showing the newest {n} URLs": "Angezeigt werden die neuesten {n} URLs",
    "No cited pages yet": "Noch keine zitierten Seiten",
    "Pages that match this rule appear here as soon as an AI cites them.": "Passende Seiten erscheinen hier, sobald eine KI sie zitiert.",
    "The analysis for this rule isn't available yet.": "Die Auswertung für diese Regel ist noch nicht verfügbar.",
    "Remove this target from the event?": "Dieses Ziel aus dem Event entfernen?",
    "Only the rule is removed. Pages and their citations stay untouched.": "Nur die Regel wird entfernt. Seiten und ihre Zitate bleiben unberührt.",
    "Remove target": "Ziel entfernen",
    /* Anleitung */
    "Step-by-step guide": "Schritt-für-Schritt-Anleitung", "Show guide": "Anleitung zeigen", "Hide guide": "Anleitung ausblenden",
    "Create an event": "Leg ein Event an",
    "An event marks a change, such as a relaunch or a campaign, and Upstreem compares your AI results before and after it.":
      "Ein Event markiert eine Änderung, etwa einen Relaunch oder eine Kampagne, und Upstreem vergleicht deine AI-Ergebnisse davor und danach.",
    "Name, date and type": "Name, Datum und Typ",
    "The date is the comparison point: Upstreem compares the days before it with the days after it.":
      "Das Datum ist der Vergleichspunkt: Upstreem vergleicht die Tage davor mit den Tagen danach.",
    /* 16.10. spaet: die Karte sagt, was fehlt, solange Next gesperrt ist */
    "Pick the type that fits. It sets the icon, and you can filter your events by type.":
      "Wähl den passenden Typ. Er legt das Icon fest, und du kannst deine Events danach filtern.",
    "Select at least one topic, or switch to All active Prompts.": "Wähl mindestens ein Topic oder wechsle zu „Alle aktiven Prompts“.",
    "Add a URL, a path or a domain, or choose Brand metrics only.": "Füg eine URL, einen Pfad oder eine Domain hinzu, oder wähl „Nur Markenwerte“.",
    "Which prompts are affected?": "Welche Prompts sind betroffen?",
    "These prompts are fixed when you create the event, and your other prompts form a comparison group that shows what would have happened anyway.":
      "Diese Prompts werden beim Anlegen festgehalten, und deine übrigen Prompts bilden eine Vergleichsgruppe, die zeigt, was ohnehin passiert wäre.",
    "A rule like example.com/blog/* also counts new articles once an AI cites them, and you can load your sitemap or count a domain as yours right here.":
      "Eine Regel wie example.com/blog/* zählt auch neue Artikel, sobald eine KI sie zitiert, und hier kannst du deine Sitemap laden oder eine Domain als deine zählen.",
    "Pick the pages that belong to this change, or keep it to brand metrics.":
      "Wähl die Seiten, die zu dieser Änderung gehören, oder bleib bei den Markenwerten.",
    "Check the preview and create the event, since date and prompts can't be changed later.":
      "Prüf die Vorschau und leg das Event an, denn Datum und Prompts lassen sich später nicht mehr ändern.",
    "Check the preview and create the event. You can still change everything until it starts.":
      "Prüf die Vorschau und leg das Event an. Bis zum Start kannst du noch alles ändern.",
    "Before and after": "Vorher und nachher",
    "Each number shows how your brand moved since the event, and vs. comparison shows how much more than in your other prompts.":
      "Jede Zahl zeigt, wie sich deine Marke seit dem Event bewegt hat, und vs. Vergleich, um wie viel mehr als in deinen übrigen Prompts.",
    "Compared with the rest": "Im Vergleich zum Rest",
    "The solid line shows the affected prompts and the dashed line the comparison group, so a gap that opens after the event is its effect.":
      "Die durchgezogene Linie zeigt die betroffenen Prompts, die gestrichelte die Vergleichsgruppe: Eine Lücke, die sich nach dem Event öffnet, ist seine Wirkung.",
    "What you track": "Was du trackst",
    "Here you see which of your pages AI answers cited after the event, including new pages that match your rules.":
      "Hier siehst du, welche deiner Seiten KI-Antworten nach dem Event zitiert haben, auch neue Seiten, die zu deinen Regeln passen.",
    "Add pages or rules at any time with Add at the top of the page.":
      "Mit Hinzufügen oben auf der Seite ergänzt du jederzeit Seiten oder Regeln.",
    "{n} new URLs after the event": "{n} neue URLs nach dem Event"
  });
  /* 15.10. nachts: Leerzustaende des Details. Gegen alle Kataloge geprueft (Katalog-Kollision);
     "No data yet" und "Add" stehen in core und werden nur benutzt. */
  if (UC.addMessages) UC.addMessages("de", {
    "Nothing tracked yet": "Noch nichts getrackt",
    "Add pages, paths or domains to see which of them AI answers cite after the event.":
      "Füg Seiten, Pfade oder Domains hinzu, um zu sehen, welche davon KI-Antworten nach dem Event zitieren.",
    "No competitors to compare yet": "Noch keine Wettbewerber zum Vergleichen",
    "Competitors you track appear here with their visibility before and after the event.":
      "Wettbewerber, die du trackst, erscheinen hier mit ihrer Visibility vor und nach dem Event.",
    "Not cited yet": "Noch nicht zitiert",
    "No AI answer has mentioned {url} so far. As soon as one does, you can open its details here.": "Bisher hat keine KI-Antwort {url} erwähnt. Sobald eine das tut, kannst du hier ihre Details öffnen.",
    "No AI answer has mentioned this page so far. As soon as one does, you can open its details here.": "Bisher hat keine KI-Antwort diese Seite erwähnt. Sobald eine das tut, kannst du hier ihre Details öffnen."
  });
  /* 17.10.: Domain mit allen Subdomains als Standard, Suche am Feld, Zahlen in der Vorschau des
     Assistenten. Jeder Schluessel gegen alle Dateien geprueft (Katalog-Kollision): keiner steht in
     core oder einer anderen Komponente; "{n} citation(s)" und "{n} URL(s)" stehen oben und werden
     nur benutzt. */
  if (UC.addMessages) UC.addMessages("de", {
    "Counts {host} and every subdomain, such as {sub}, including pages added later.": "Zählt {host} und jede Subdomain mit, etwa {sub}, auch Seiten, die später dazukommen.",
    "Only {host} itself. Pages on {sub} are not counted.": "Nur {host} selbst. Seiten auf {sub} zählen nicht mit.",
    "Include all of {domain}": "Ganz {domain} einbeziehen",
    "Your domain: {domain}": "Deine Domain: {domain}",
    "Add {ziel}": "{ziel} hinzufügen",
    "on {n} page": "auf {n} Seite", "on {n} pages": "auf {n} Seiten",
    "across {n} hosts": "verteilt auf {n} Hosts",
    "in the last {n} days": "in den letzten {n} Tagen",
    "Show hosts": "Hosts anzeigen", "Show fewer hosts": "Weniger Hosts anzeigen",
    "No citations on {host} itself.": "Auf {host} selbst gibt es keine Zitate.",
    "{n} citation sits on its subdomains.": "{n} Zitat liegt auf den Subdomains.",
    "{n} citations sit on its subdomains.": "{n} Zitate liegen auf den Subdomains.",
    "Include subdomains": "Subdomains einbeziehen", "Keep typing to narrow it down": "Tipp weiter, um die Treffer einzugrenzen",
    "No citations yet for {ziel}. Counting starts with this event.": "Noch keine Zitate für {ziel}. Das Zählen beginnt mit diesem Event.",
    "No citations yet for these targets. Counting starts with this event.": "Noch keine Zitate für diese Ziele. Das Zählen beginnt mit diesem Event."
  });
  /* 17.10.: Seitenabdeckung je Regel (Teil C) und Fallzahl je Kennzahl. Gegen alle Kataloge geprueft;
     "Refresh" und "Show {n} more" stehen schon (core bzw. oben) und werden nur benutzt. */
  if (UC.addMessages) UC.addMessages("de", {
    "From {n} answers": "Aus {n} Antworten",
    "From 1 answer": "Aus 1 Antwort",
    "{m}: {a} answers before the event, {b} after": "{m}: {a} Antworten vor dem Event, {b} danach",
    "You can refresh again at {time}.": "Du kannst um {time} wieder aktualisieren.",
    "{a} of {b} pages cited": "{a} von {b} Seiten zitiert",
    "{a} of {b} page cited": "{a} von {b} Seite zitiert",
    "Last checked {when}": "Zuletzt geprüft {when}",
    "We couldn't read your sitemap. We'll try again tomorrow.": "Wir konnten deine Sitemap nicht lesen. Wir versuchen es morgen wieder.",
    "We're reading your sitemap for the first time.": "Wir lesen deine Sitemap zum ersten Mal.",
    "The {n} most recently updated of {total} pages": "Die {n} zuletzt geänderten von {total} Seiten",
    "Only the {n} most recently updated pages": "Nur die {n} zuletzt geänderten Seiten",
    "plus {n} cited page not in your sitemap": "dazu {n} zitierte Seite, die nicht in deiner Sitemap steht",
    "plus {n} cited pages not in your sitemap": "dazu {n} zitierte Seiten, die nicht in deiner Sitemap stehen",
    "{n} cited page is not in your sitemap": "{n} zitierte Seite steht nicht in deiner Sitemap",
    "{n} cited pages are not in your sitemap": "{n} zitierte Seiten stehen nicht in deiner Sitemap",
    "{n} new page since the event, cited": "{n} neue Seite seit dem Event, zitiert",
    "{n} new page since the event, not cited yet": "{n} neue Seite seit dem Event, noch nicht zitiert",
    "{n} new pages since the event, none cited yet": "{n} neue Seiten seit dem Event, noch keine zitiert",
    "{n} new pages since the event, {c} cited": "{n} neue Seiten seit dem Event, {c} zitiert",
    "First cited and New URLs always cover all models and markets, whatever the filters say.": "\u201eErstmals zitiert\u201c und \u201eNeue URLs\u201c umfassen immer alle Modelle und Märkte, egal welche Filter gesetzt sind.",
    "Not affected by your filters": "Unabhängig von deinen Filtern",
    "The sitemap couldn't be refreshed. Please try again later.": "Die Sitemap ließ sich nicht aktualisieren. Versuch es bitte später noch einmal.",
    "Page coverage couldn't be loaded.": "Die Seitenabdeckung ließ sich nicht laden.",
    "Cited ({n})": "Zitiert ({n})",
    "All ({n})": "Alle ({n})",
    "Cited": "Zitiert",
    "Sitemap": "Sitemap",
    "Refreshing": "Wird aktualisiert",
    "No page from your sitemap is cited yet.": "Noch keine Seite deiner Sitemap wird zitiert.",
    "No pages match this rule": "Keine Seite passt zu dieser Regel",
    "Your sitemap lists no pages": "Deine Sitemap listet keine Seiten",
    "We found nothing to read in your sitemap.": "Wir haben in deiner Sitemap nichts zum Lesen gefunden.",
    "Your sitemap lists another domain.": "Deine Sitemap listet eine andere Domain.",
    "We read {n} pages, {where}. None is on {domain}.": "Wir haben {n} Seiten gelesen, {where}. Keine liegt auf {domain}.",
    "all on {hosts}": "alle auf {hosts}", "mostly on {hosts}": "meist auf {hosts}",
    "Add {host}": "{host} hinzufügen",
    "We read {n} pages. None of them is under {path}.": "Wir haben {n} Seiten gelesen. Keine liegt unter {path}.",
    "None of the pages we read from your sitemap is on {where}.": "Keine der Seiten, die wir aus deiner Sitemap gelesen haben, liegt auf {where}.",
    "None of the pages we read from your sitemap is under {where}.": "Keine der Seiten, die wir aus deiner Sitemap gelesen haben, liegt unter {where}.",
    "Not cited yet ({n})": "Noch nicht zitiert ({n})",
    "Event date": "Eventdatum",
    "New or updated": "Neu oder aktualisiert", "New in the sitemap or updated since the event": "Neu in der Sitemap oder aktualisiert seit dem Event",
    "No longer in sitemap": "Nicht mehr in der Sitemap",
    "Updated {date}": "Aktualisiert am {date}",
    "In sitemap since {date}": "Seit {date} in der Sitemap",
    "Every page from your sitemap is cited.": "Jede Seite deiner Sitemap wird zitiert."
  });
  /* 18.10.: Sperre je Quelle (Runde 3), Modellbasis, gedeckeltes Nachher. Gegen alle Kataloge geprueft. */
  if (UC.addMessages) UC.addMessages("de", {
    "This sitemap is being read right now.": "Diese Sitemap wird gerade gelesen.",
    "Your team has reached its hourly limit for reading sitemaps.": "Dein Team hat die Stundengrenze für das Lesen von Sitemaps erreicht.",
    "We couldn't finish reading this sitemap.": "Diese Sitemap ließ sich nicht fertig lesen.",
    "Your sitemap hasn't been read yet.": "Deine Sitemap wurde noch nicht gelesen.",
    "{host} is already tracked in this event.": "{host} wird in diesem Event schon getrackt.",
    "Based on {models}": "Basiert auf {models}",
    "The before and after numbers and the comparison use the models that both groups have data for.": "Die Zahlen vorher und nachher und der Vergleich nutzen die Modelle, zu denen beide Gruppen Daten haben.",
    "{a} and {b}": "{a} und {b}",
    "Last 12 months": "Letzte 12 Monate",
    "Last {n} days": "Letzte {n} Tage",
    "Since event covers at most the last 12 months. Older days are left out of the numbers after the event.": "Seit Event reicht höchstens 12 Monate zurück. Ältere Tage fehlen in den Zahlen nach dem Event.",
    "Reliable from {date}": "Verlässlich ab {date}",
    "The first day with data after the event.": "Der erste Tag mit Daten nach dem Event.",
    "{n} prompt has no data after the event. It is not part of the before and after numbers.": "{n} Prompt hat keine Daten nach dem Event. Er zählt nicht in die Zahlen vorher und nachher.",
    "{n} prompts have no data after the event. They are not part of the before and after numbers.": "{n} Prompts haben keine Daten nach dem Event. Sie zählen nicht in die Zahlen vorher und nachher.",
    "{n} prompt was measured on different models before and after the event. It is not part of the before and after numbers.": "{n} Prompt wurde vor und nach dem Event mit verschiedenen Modellen gemessen. Er zählt nicht in die Zahlen vorher und nachher.",
    "{n} prompts were measured on different models before and after the event. They are not part of the before and after numbers.": "{n} Prompts wurden vor und nach dem Event mit verschiedenen Modellen gemessen. Sie zählen nicht in die Zahlen vorher und nachher."
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

  /* Die Kanaele (13.10.): Name des alten Bubble-Ereignisses -> v2-RPC. attr ist das Attribut, das
     im Rueckweg den Namen des Bubble-Elements traegt. ms: laenger als die Analyse (E9: 3,4 s
     ungecacht) braucht keine; die Schreibwege so lang wie die Warte-Uhr der Popups (WARTE_MS),
     damit die RPC endet, bevor das Popup "dauert zu lange" sagt. */
  /* NUR NOCH v3 (17.10.): Detail, Analyse und Anlegen kennen genau eine Fassung -- die mit
     Zielen. Kein stiller Rueckfall auf v2 mehr (bis 17.10. fn3/v3immer/RUECKFALL3): der fragte bei
     einer fehlenden v3 eine andere Funktion und zeigte deren Antwort, als waere nichts gewesen.
     Die DB raeumt die alten Funktionen nach dem Abschalten von Bubble auf; ein Aufruf, der sie
     noch braucht, waere dann eine 404 an einer Stelle, die niemand mehr ansieht. nurDirekt: kein
     Rueckweg an Bubble -- die Kanaele gibt es erst seit der App. */
  var KANAL = {
    uevDetail:       { fn: "get_impact_event_v3",             attr: "data-detail-fn",    ms: 20000 },
    uevAnalysis:     { fn: "cached_impact_event_analysis_v3", attr: "data-analysis-fn",  ms: 24000 },
    uevScopePreview: { fn: "preview_impact_event_scope_v2",   attr: "data-preview-fn",   ms: 20000 },
    uevCreate:       { fn: "create_impact_event_v3",          attr: "data-create-fn",    ms: 24000, schreibt: true },
    /* Citation Tracking anlegen (19.10.): eigene Funktion statt eines Parameters p_kind an create_impact_event_v4 -- PostgREST lehnt
       einen unbekannten Parameter ab, und die Event-Funktionen bleiben so unberuehrt. Antwort wie beim Event: das Detail. */
    uevCreateWatch:  { fn: "create_impact_watch_v1",          attr: "", ms: 24000, schreibt: true, nurDirekt: true },
    uevUpdate:       { fn: "update_impact_event_v2",          attr: "data-update-fn",    ms: 24000, schreibt: true },
    /* Nur noch der Klick-Dummy (zielSenden): ausserhalb geht eine URL als url-Ziel an
       add_impact_event_target_v1. fn bleibt fuer den Rueckweg-Vertrag stehen, gerufen wird sie nie. */
    uevAddUrl:       { fn: "add_impact_event_url_v2",         attr: "data-addurl-fn",    ms: 24000, schreibt: true },
    /* Eine URL entfernen (17.10.): remove_impact_event_target_v1 loescht auch url-Ziele, die ID
       ist dieselbe wie urls[].id (gelesen 17.10.). Der Kanal bleibt, weil die Bestaetigung und
       ihr Fehlertext der URL gehoeren (wartend.urlWeg). */
    uevRemoveUrl:    { fn: "remove_impact_event_target_v1",   attr: "data-removeurl-fn", ms: 24000, schreibt: true },
    uevDelete:       { fn: "delete_impact_event_v2",          attr: "data-delete-fn",    ms: 24000, schreibt: true },
    uevAddTarget:    { fn: "add_impact_event_target_v1",      attr: "", ms: 24000, schreibt: true, nurDirekt: true },
    uevRemoveTarget: { fn: "remove_impact_event_target_v1",   attr: "", ms: 24000, schreibt: true, nurDirekt: true }
  };
  /* Kanaele, deren v2-Funktion es (noch) nicht gibt -- je Seitenaufruf gemerkt, fuer alle
     Wurzeln. Nach einem Neuladen wird wieder zuerst v2 versucht: ist das SQL inzwischen
     eingespielt, laeuft der neue Weg ohne Zutun. */
  var RUECKFALL = {};

  /* ---- WAS DIE DATENBANK SCHON KANN (15.10.) ----------------------------------------------
     "Nichts zeigen, was nicht funktioniert": Regel-Ziele (Pfad, Domain) und die Vorschau gibt es
     erst mit preview_impact_event_targets_v1 und den v3-Funktionen, den Sitemap-Waehler erst mit
     der Edge Function sitemap-lesen. Bis dahin bietet Schritt 3 nur "Brand metrics only" und
     "Specific URLs" ueber die v2-Wege, und es gibt keinen Sitemap-Knopf.
     Gefragt wird EINMAL je Seitenaufruf und fuer alle Wurzeln, beim ersten Oeffnen von Anlegen
     oder Detail -- nur mit einem Aufruf, der gelingt und nichts aendert: die Vorschau mit leerer
     Zielliste. Die Edge Function wird NICHT mehr zur Probe gerufen (17.10., Nutzer: im Netzwerk
     stand bei jedem ersten Anlegen ein roter Abruf, 400 invalid_input auf die absichtlich leere
     url -- ein Fehlschlag, den wir selbst bestellen): der Sitemap-Knopf steht mit den Zielen da,
     und was die Function wirklich kann, sagt der erste echte Abruf (smLaden: 404 NOT_FOUND und
     503 not_configured nehmen den Knopf fuer den Rest des Tabs weg und sagen es als Satz, 502
     edge_failed heisst "noch einmal versuchen"). Ebenso kein Aufruf der Analyse mit der Null-
     Kennung mehr (400 invalid_param): siehe KAMPAGNE_DA. Eine fehlende Funktion erkennt
     PostgREST an PGRST202, eine fehlende Edge Function das Gateway von Supabase an 404
     NOT_FOUND ("Requested function was not found"), eine ohne Gate an 503 not_configured (siehe
     edgeFehlt).
     Netzfehler und Zeitablauf heissen "noch unbekannt" -- dann wird beim naechsten Oeffnen noch
     einmal gefragt, und bis dahin gilt der Rueckfall. NICHT ueber UC.ohneBubble: das ist kein
     Rueckweg an Bubble, sondern die Frage, was die Datenbank kann. */
  var ZIELE_DA = { stand: null, laeuft: null }, SITEMAP_DA = { stand: null, laeuft: null };
  /* DER EVENTS-AUSBAU (17.10., bubble/events_ausbau_db_auftrag_17_10.md, Teile C und D) -- die DB
     baut ihn erst noch, die Oberflaeche steht schon gegen die ausgeschriebenen Antwortformen.
     ABD_DA: gibt es get_impact_event_coverage_v1? Gefragt wird mit dem ersten echten Abruf (der
     nichts aendert); PGRST202 heisst "noch nicht eingespielt" und bleibt fuer die ganze Seite --
     dann steht jeder Regel-Abschnitt wie bisher da, ohne Abdeckung, ohne Fehler.
     */
  var ABD_DA = { stand: null };
  /* MELDUNGEN JE EVENT (17.10., Teil A des DB-Auftrags events_ausbau_17_10): gibt es sie? Die
     Antwort kennt core (UC.eventMeldungenDa, aus dem einen Aufruf beim App-Start). Bis sie da ist
     und solange sie nicht true ist, gibt es keinen Schalter "Notify me" -- ein Schalter, der nichts
     bewirkt, waere einer zu viel. MELD_AN: was in dieser Sitzung je Event umgelegt wurde (das Detail
     kommt aus dem Zwischenspeicher und kennt den neuen Stand erst nach dem naechsten Laden). */
  var MELD_DA = { stand: null, warten: [] }, MELD_AN = {};
  function meldDa() { return MELD_DA.stand === true; }
  function meldDaFragen(fertig) {
    if (MELD_DA.stand !== null) { if (fertig) fertig(MELD_DA.stand); return; }
    if (fertig) MELD_DA.warten.push(fertig);
    if (MELD_DA.laeuft || !UC.eventMeldungenDa) return;
    MELD_DA.laeuft = true;
    UC.eventMeldungenDa().then(function (da) {
      MELD_DA.stand = da === true;
      var w = MELD_DA.warten; MELD_DA.warten = [];
      w.forEach(function (f) { try { f(MELD_DA.stand); } catch (e) {} });
    }, function () { MELD_DA.stand = false; });
  }
  function fehltFn(erg) {
    var f = (erg && erg.fehler) || {};
    return !!erg && !erg.ok && (/PGRST202/.test(String(f.code || "")) ||
      (erg.status === 404 && /could not find the function/i.test(String(f.message || "") + " " + String(f.details || ""))));
  }
  /* "Fehlt" heisst auch 503 not_configured. Laut Nachtrag 15.10. (Abschnitt 2, sitemap-lesen
     Version 4) hat sie genau zwei Ursachen: detail "env" -- die Umgebung der Function fehlt; das
     prueft sie als Erstes, vor JWT und Eingabe, also sieht es auch der Pruefaufruf mit leerer url
     --, oder detail "events_ziele_v1.sql missing" -- das Gate fehlt; das kommt erst nach der
     Eingabepruefung, der Pruefaufruf sieht es also nicht (seit events_ziele_v1.sql eingespielt
     ist, nur noch nach dessen Rueckweg). Beide heissen: jeder Abruf scheitert. Unterschieden wird
     nicht, detail zeigt die Oberflaeche nie. Darum bietet sie die Sitemap nur zusammen mit den
     Zielen an (sitemapDa verlangt zieleDa -- Gate und Vorschau kommen aus derselben Datei), und
     eine 503 beim echten Abruf nimmt den Knopf fuer den Rest der Seite weg (smLaden). */
  function edgeFehlt(erg) {
    var f = (erg && erg.fehler) || {};
    if (!erg || erg.ok) return false;
    if (erg.status === 503 && String(f.message || "") === "not_configured") return true;
    return erg.status === 404 &&
      (String(f.code || "") === "NOT_FOUND" || /requested function was not found/i.test(String(f.message || "")));
  }
  function unbekannt(erg) { return !erg || erg.status === 0 || erg.status === 401; }

  /* ---- KAMPAGNEN MIT ZEITRAUM (17.10., bubble/events_ausbau_db_auftrag_17_10.md Teil B und
     Nachtrag) -------------------------------------------------------------------------------
     Ein Event bekommt optional ein Ende (end_date) und darf bis heute + 365 in der Zukunft
     beginnen. Status, Tag x von y und der Abschlussbericht kommen von der Datenbank (status,
     day_number, day_count, report_final_on, report_final) -- gebaut GEGEN den Vertrag, bevor
     die DB ihn liefert. Darum wie ZIELE_DA ein Schalter: KAMPAGNE_DA.stand wird true, sobald
     eine Zeile des Speichers status traegt (kampagneAbleiten); false bei PGRST202 (ein echter
     Aufruf) oder wenn Events da sind und keins einen status hat. Kein Pruefaufruf mehr (17.10.): die
     Analyse mit der Null-Kennung antwortete absichtlich 400 invalid_param und stand als roter Abruf im
     Netzwerk. Hat das Team noch kein Event, gilt Teil B als da (die Datenbank hat ihn seit dem
     17.10.); fehlt er doch, faengt das der erste echte Aufruf ab (PGRST202 in rufen: Rueckfall auf v3
     bzw. ein Satz bei einem Zeitraum). */
  var KAMPAGNE_DA = { stand: null, laeuft: null };
  var KAMPAGNE_FN = { uevAnalysis: "cached_impact_event_analysis_v4", uevCreate: "create_impact_event_v4", uevUpdate: "update_impact_event_v3" };
  /* Vertrag B.1: Laenge hoechstens 183 Tage (Start und Ende zaehlen mit), Start bis heute + 365. */
  var KAMPAGNE_TAGE = 183, ZUKUNFT_TAGE = 365;
  var NULL_ID = "00000000-0000-0000-0000-000000000000";
  function kampagneDa() { return KAMPAGNE_DA.stand === true; }
  /* Eine Zeile mit status kann es nur geben, wenn Teil B eingespielt ist -- dann ist die Frage
     beantwortet, ohne einen Aufruf. */
  function kampagneMerken(ev) {
    if (KAMPAGNE_DA.stand == null && ev && typeof ev.status === "string" && ev.status) KAMPAGNE_DA.stand = true;
  }
  /* Die Frage ohne Aufruf: aus der geladenen Liste. Events da und keins mit status heisst Teil B fehlt;
     keine Events (geladen) heisst nichts Gegenteiliges -- die Datenbank hat ihn, also da. */
  function kampagneAbleiten(l, geladen) {
    if (KAMPAGNE_DA.stand != null) return;
    l.forEach(kampagneMerken);
    if (KAMPAGNE_DA.stand == null && geladen) KAMPAGNE_DA.stand = l.length ? false : true;
  }
  /* Der Status NUR, wenn die Datenbank ihn liefert. Hier abgeleitet waere er eine Angabe, die die
     Datenbank nicht kennt -- ein "Day 45" auf jedem alten Event, bevor es Teil B gibt. */
  function statusVon(ev) {
    var s = ev && typeof ev.status === "string" ? ev.status : "";
    return s === "planned" || s === "running" || s === "completed" ? s : "";
  }
  function mitEnde(ev) { return !!(ev && ev.end_date && !isNaN(tagMs(ev.end_date))); }
  /* Abgeschlossen gibt es nur MIT Ende (Entscheidung des Nutzers 4): ein Tages-Event laeuft offen,
     auch wenn eine Antwort etwas anderes sagte. */
  function istFertig(ev) { return statusVon(ev) === "completed" && mitEnde(ev); }
  function istGeplant(ev) { return statusVon(ev) === "planned"; }
  /* Tag x seit dem Start (Start = 1): day_number der Datenbank, fehlt er, aus dem Datum. */
  function tagNummer(ev) {
    var n = num(ev.day_number);
    if (n != null) return n;
    var a = tagMs(ev.event_date);
    return isNaN(a) ? null : Math.floor((tagMs(heuteIso()) - a) / 864e5) + 1;
  }
  function tagAnzahl(ev) {
    var n = num(ev.day_count);
    if (n != null) return n;
    var a = tagMs(ev.event_date), b = tagMs(ev.end_date);
    return isNaN(a) || isNaN(b) ? null : Math.round((b - a) / 864e5) + 1;
  }
  /* Der Status als Angabe mit Zeichen, wie Datum und Typ -- keine Pille mit Punkt. Wenige
     Woerter, ohne Fachsprache: "Planned", "Running, day 5 of 21", "Completed"; ein offenes
     Tages-Event zaehlt nur seine Tage ("Day 45" -- das Datum steht schon daneben). */
  /* Zeichen "activity", NICHT "timer": core kennt kein "timer" (UC.icon meldete es bei jedem Rendern
     einer laufenden Kampagne und zeichnete eine leere Huelle). */
  function statusInfo(ev) {
    var s = statusVon(ev);
    if (!s) return null;
    if (s === "planned") return { s: s, ic: "clock", text: t("Planned") };
    if (istFertig(ev)) return { s: "completed", ic: "checkCircle", text: t("Completed") };
    var n = tagNummer(ev), m = mitEnde(ev) ? tagAnzahl(ev) : null;
    if (n == null || n < 1) return { s: "running", ic: "activity", text: t("Running") };
    if (m != null) return { s: "running", ic: "activity", text: ersetze(t("Running, day {n} of {m}"), { n: zahl(Math.min(n, m)), m: zahl(m) }) };
    return { s: "running", ic: "activity", text: ersetze(t("Day {n}"), { n: zahl(n) }) };
  }
  /* Ein Zeitraum in einer Zeile: im selben Jahr steht das Jahr nur am Ende. */
  function zeitraum(a, b) {
    var x = datum(a), y = datum(b), jx = /(\d{4})\s*$/.exec(x), jy = /(\d{4})\s*$/.exec(y);
    if (jx && jy && jx[1] === jy[1]) x = x.replace(/[\s,.]*\d{4}\s*$/, "");
    return x + " – " + y;
  }
  /* Der Text eines Fehlers am Enddatum (Vertrag B.3, hint). */
  var ENDE_HINT = {
    "p_end_date: >= p_event_date": "The end date can't be before the start date.",
    "p_end_date: max 183 days": "A campaign can run for at most 183 days.",
    "p_end_date: >= today": "The end date can't be in the past.",
    /* Ein Tages-Event wird keine Kampagne und umgekehrt, sobald es laeuft (Teil B). */
    "p_end_date: day event": "A running event can't switch between a start date and a date range."
  };
  /* Der Satz zum erlaubten Start: mit Kampagnen (v4) bis heute + 365, davor nur zurueck. */
  function STARTFENSTER() {
    return kampagneDa() ? "The start date must be within the last 6 months or the next 12 months." : "The date must be within the last 6 months.";
  }

  /* ---- ZIELE AUS EINER EINGABE (15.10., Vertrag Abschnitt 1) --------------------------------
     Ein Ziel ist eine Regel: url (genau diese Adresse), path (alles unter host/pfad, Pfadgrenze
     an "/"), host (genau dieser Host), host_all (Host und alle Unterdomains). Die Datenbank
     normalisiert selbst (url_norm_v1); hier nur so viel, wie die Oberflaeche zum Zeigen und zum
     Erkennen von Doppelten braucht -- www. weg, Host klein, Schema, Sternchen und Schraegstrich
     am Ende weg. Die SCHREIBWEISE (lee-up.de/blog/*) steht immer sichtbar: sie ist das, was die
     Regel trifft, in einer Zeile. */
  var ZIEL_MAX = 50;
  /* Die Endung darf auch eine Punycode-Endung sein (xn--...): ".中国" wird zu "xn--fiqs8s". */
  function hostOk(h) { return /^(?=.{3,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,63}|xn--[a-z0-9-]{1,59})$/.test(String(h || "")); }
  /* Ein Host mit Umlaut (muller.de mit u-Umlaut, EV-14) wird in Punycode umgewandelt, so wie ihn die
     Zitate der Datenbank tragen (xn--mller-kva.de; gemessen: 17 Domains xn-- in 30 Tagen, 0 mit
     Umlaut). Das Wandeln macht der Browser selbst (URL, IDNA): kein eigener Umwandler, der bei
     einer Sonderregel falsch rechnet. Reines ASCII bleibt unberuehrt; was sich nicht wandeln laesst,
     bleibt stehen und faellt dann an hostOk durch. */
  function hostAscii(h) {
    h = String(h == null ? "" : h);
    if (!/[^\x00-\x7f]/.test(h)) return h;
    try { return new URL("http://" + h).hostname || h; } catch (e) { return h; }
  }
  function zerlegen(s) {
    s = String(s == null ? "" : s).trim();
    if (!s || /\s/.test(s)) return null;
    var schema = /^https?:\/\//i.test(s), rest = s.replace(/^https?:\/\//i, "");
    var alle = /^\*\./.test(rest);
    rest = rest.replace(/^\*\./, "");
    var m = /^([^\/?#]+)([^?#]*)(\?[^#]*)?(#.*)?$/.exec(rest);
    if (!m) return null;
    /* anzeige: der Host so, wie er eingegeben wurde (klein, ohne www); host: derselbe in Punycode,
       der Wert, mit dem verglichen, gesendet und gesucht wird. hostTyp/hostTypAscii: mit www, fuer
       das url-Ziel, das die Schreibweise behaelt. */
    /* Zugangsdaten und Port gehoeren nicht zum Host (url_norm_v1 streicht beides in der Host-Regel):
       "lee-up.de:443/solar" ist der Host lee-up.de, nicht ein ungueltiger Host (EV-07). */
    var anzeige = m[1].toLowerCase().replace(/^[^@]*@/, "").replace(/^www\./, ""), pfad = m[2] || "", port = "";
    var pm = /^(.*):(\d{1,5})$/.exec(anzeige);
    if (pm && parseInt(pm[2], 10) <= 65535) { anzeige = pm[1]; port = pm[2]; }
    /* anzeige: der Host so, wie er eingegeben wurde; host: derselbe in Punycode (EV-14), der Wert,
       mit dem verglichen, gesendet und gesucht wird. */
    var host = hostAscii(anzeige);
    var stern = /\*$/.test(pfad);
    pfad = pfad.replace(/\/?\*$/, "");
    var schraeg = /\/$/.test(pfad);
    pfad = pfad.replace(/\/+$/, "");
    return { schema: schema, host: host, anzeige: anzeige, hostTyp: m[1], hostTypAscii: hostAscii(m[1].toLowerCase()), port: port, pfad: pfad, stern: stern, schraeg: schraeg, alle: alle, query: m[3] || "", roh: s };
  }
  /* Mehrere Eintraege: je Zeile (oder durch Leerzeichen bzw. Komma getrennt) -- eine Adresse
     enthaelt keines davon. */
  function eingabeTeile(text) {
    return String(text == null ? "" : text).split(/[\s,]+/).map(function (x) { return x.trim(); }).filter(Boolean);
  }
  /* Welche Art die Eingabe nahelegt (Entscheidung des Nutzers 15.10.): Host -> Domain,
     Host + Pfad -> Pfad, mehrere Eintraege -> URLs. Eine volle Adresse MIT Schema und einem
     Pfad ohne Schraegstrich am Ende ist eine Seite ("https://lee-up.de/blog/artikel-1"), keine
     Abteilung -- das ist, was jemand aus der Adresszeile kopiert. Eine .xml ist eine Sitemap. */
  /* DIE HAUPTDOMAIN EINES HOSTS (17.10., Beschluss: eine Domain ohne Pfad heisst Domain mit allen
     Subdomains): help.de.example.com -> example.com, blog.example.co.uk -> example.co.uk. Dieselbe
     Regel wie die Datenbank in der Vorschau (letzte zwei Teile, bei co.uk und Verwandten drei: Teil
     vor einer zweibuchstabigen Endung ist co, com, org, net, gov, ac, edu, or, ne oder gv) -- eine
     Unterdomain erkennt die Oberflaeche so an derselben Stelle wie die Datenbank. */
  function hauptDomain(h) {
    var l = String(h || "").toLowerCase().split(".");
    if (l.length <= 2) return l.join(".");
    var drei = /^(co|com|org|net|gov|ac|edu|or|ne|gv)$/.test(l[l.length - 2]) && l[l.length - 1].length === 2;
    return l.slice(drei ? -3 : -2).join(".");
  }
  function artVorschlag(text) {
    var teile = eingabeTeile(text);
    if (!teile.length) return null;
    if (teile.length > 1) return "url";
    var z = zerlegen(teile[0]);
    if (!z || !z.host) return null;
    if (/\.xml(\.gz)?$/i.test(z.pfad)) return "sitemap";
    if (z.alle) return "host_all";
    /* Ohne Pfad: die Hauptdomain meint sie samt Unterdomains, ein Host darunter (help.de.example.com)
       nur sich selbst -- mit dem Angebot, die ganze Hauptdomain zu nehmen (schreibweiseZeigen). */
    if (!z.pfad) return z.host === hauptDomain(z.host) || !hostOk(z.host) ? "host_all" : "host";
    if (z.stern || z.schraeg) return "path";
    if (z.schema || z.query) return "url";
    return "path";
  }
  /* Der Schluessel einer URL wie url_norm_v1 der Datenbank (Rueckmeldung 15.10., Abschnitt 1; Audit
     EV-07 17.10.): Schema und Host klein, Standard-Port (80 bei http, 443 bei https) weg, Fragment weg,
     Punkt-Segmente aufgeloest, "/" am Ende des Pfads weg, Tracking-Parameter (utm_*, gclid, fbclid, ref,
     igshid, mc_cid, mc_eid, t, si, feature, pp, list) weg -- www und Schema BLEIBEN. Ein url-Ziel trifft nur
     genau seine Schreibweise; https://lee-up.de/solar und https://www.lee-up.de/solar sind zwei Ziele
     (gemessen von der Datenbank: 0 gegen 210 Zitate). Bis 17.10. kannte der Schluessel weder Port noch
     Tracking-Parameter: die Oberflaeche zaehlte vier Ziele, wo die Datenbank drei anlegte (die utm-Fassung
     wird dort zur selben Adresse), und eine URL mit :443 galt als ungueltig. Der Pfad bleibt gross/klein,
     wie die Datenbank ihn laesst; Sonderzeichen kodiert sie wie URL.search (urlKodieren). */
  var URL_TRACK = { gclid: 1, fbclid: 1, ref: 1, igshid: 1, mc_cid: 1, mc_eid: 1, t: 1, si: 1, feature: 1, pp: 1, list: 1 };
  function urlKodieren(s, menge) {
    return Array.from(String(s)).map(function (ch) {
      var cp = ch.codePointAt(0);
      if (cp > 126 || cp <= 32 || menge.indexOf(ch) >= 0) return ch === "'" ? "%27" : encodeURIComponent(ch);
      return ch;
    }).join("");
  }
  function urlSchluessel(s) {
    s = String(s == null ? "" : s).replace(/[\x01-\x1F\x7F\u200B-\u200D\uFEFF]/g, "").trim().replace(/#.*$/, "");
    var m = /^(https?):\/*/i.exec(s), sch = "https";
    if (m) { sch = m[1].toLowerCase(); s = s.slice(m[0].length); }
    s = s.replace(/^[\/\\]*/, "");
    var a = /^([^\/\\?]*)([\s\S]*)$/.exec(s), auth = a[1].replace(/^.*@/, ""), rest = a[2];
    var ci = auth.indexOf(":"), host = (ci < 0 ? auth : auth.slice(0, ci)).toLowerCase(), port = ci < 0 ? "" : auth.slice(ci + 1);
    if (/^\d+$/.test(port)) {
      port = String(parseInt(port, 10));
      if ((sch === "http" && port === "80") || (sch === "https" && port === "443")) port = "";
    }
    var qi = rest.indexOf("?"), query = qi < 0 ? "" : rest.slice(qi + 1), pfad = (qi < 0 ? rest : rest.slice(0, qi)).replace(/\\/g, "/");
    if (pfad === "") pfad = "/";
    var segs = pfad.slice(1).split("/"), aus = [];
    segs.forEach(function (sg, i) {
      var l = sg.toLowerCase(), letztes = i === segs.length - 1;
      if (l === ".." || l === ".%2e" || l === "%2e." || l === "%2e%2e") { aus.pop(); if (letztes) aus.push(""); }
      else if (l === "." || l === "%2e") { if (letztes) aus.push(""); }
      else aus.push(sg);
    });
    pfad = urlKodieren("/" + aus.join("/"), '"<>`{}');
    if (pfad !== "/") { pfad = pfad.replace(/\/+$/, ""); if (pfad === "") pfad = "/"; }
    var behalten = [];
    if (query) urlKodieren(query, "\"<>'").split("&").forEach(function (teil) {
      if (teil === "") return;
      var k = teil.indexOf("=") >= 0 ? teil.slice(0, teil.indexOf("=")) : teil, d;
      try { d = decodeURIComponent(k.replace(/\+/g, "%20")); } catch (e) { d = k; }
      d = d.toLowerCase();
      if (d.indexOf("utm_") === 0 || URL_TRACK[d] === 1) return;
      behalten.push(teil);
    });
    return sch + "://" + host + (port ? ":" + port : "") + pfad + (behalten.length ? "?" + behalten.join("&") : "");
  }
  /* So steht ein url-Ziel da: ohne "https://" (der Normalfall), aber MIT www und mit "http://" --
     genau das unterscheidet zwei Schreibweisen, und nur die eine trifft. Der Schraegstrich einer
     reinen Domain bleibt weg (lee-up.de, nicht lee-up.de/). */
  function urlZeigen(s) { return urlSchluessel(s).replace(/^https:\/\//, "").replace(/^((?:http:\/\/)?[^\/]*)\/$/, "$1"); }
  /* Ein Eintrag als Ziel der gewaehlten Art. { kind, input, key, zeigen } oder { fehler }. */
  function zielBauen(text, art) {
    var z = zerlegen(text);
    if (!z || !hostOk(z.host)) return { fehler: "host", roh: String(text || "").trim() };
    if (art === "url") {
      var u0 = (z.schema ? z.roh : "https://" + z.roh).replace(/#.*$/, "");
      /* Gesendet wird der Host in Punycode, gezeigt die Eingabe */
      var u = z.hostTypAscii !== z.hostTyp.toLowerCase() ? u0.replace(z.hostTyp, z.hostTypAscii) : u0;
      if (u.length > 2048) return { fehler: "host", roh: z.roh };
      return { kind: "url", input: u, key: "url|" + urlSchluessel(u), zeigen: urlZeigen(u0) };
    }
    if (art === "path") {
      if (!z.pfad) return { fehler: "pfad", roh: z.roh };
      var v = z.host + z.pfad;
      return { kind: "path", input: v, key: "path|" + v.toLowerCase(), zeigen: z.anzeige + z.pfad + "/*" };
    }
    if (art === "host_all") return { kind: "host_all", input: z.host, key: "host_all|" + z.host, zeigen: "*." + z.anzeige + "/*" };
    return { kind: "host", input: z.host, key: "host|" + z.host, zeigen: z.anzeige + "/*" };
  }
  /* Ein Ziel aus der Datenbank (targets[] von get_impact_event_v3) in derselben Form. value ist
     normalisiert, input die Eingabe des Nutzers -- gezeigt wird value. */
  /* Ein Ziel im Body an create_impact_event_v4, update_impact_event_v3 und add_impact_event_target_v1:
     kind und input, dazu bei einem Regel-Ziel aus der Sitemap-Auswahl die Adresse der Sitemap
     (sitemap_url, Teil B): daraus liest die Seitenabdeckung (Teil C). Fehlt der Schluessel, bleibt
     eine schon gespeicherte Adresse, wie sie ist (update_impact_event_v3: fehlt oder null =
     unveraendert); ein url-Ziel nimmt sie nicht (die Datenbank ignoriert sie dort). Dieselbe
     Pruefung wie dort: http(s), hoechstens 2048 Zeichen. */
  function zielKoerper(z) {
    var o = { kind: z.kind, input: z.input }, sm = String(z.sitemapUrl || "");
    if (sm && z.kind !== "url" && sm.length <= 2048 && /^https?:\/\/[^\/?#\s]+/i.test(sm)) o.sitemap_url = sm;
    return o;
  }
  function zielAusDb(t) {
    if (!t) return null;
    var k = String(t.kind || ""), v = String(t.value || t.input || "");
    var x = zielBauen(v, k === "host_all" ? "host_all" : k);
    if (x.fehler) return { id: t.id, kind: k, input: v, key: k + "|" + v.toLowerCase(), zeigen: v, db: t };
    x.id = t.id; x.db = t;
    return x;
  }
  /* Der Host einer Eingabe, wie die Vorschau ihn einstuft ("Count as your domain"). Ein Ziel aus
     der Datenbank bringt ihn seit get_impact_event_v3 selbst mit (targets[].host, 15.10.). */
  function zielHost(z) {
    if (z && z.db && z.db.host) return String(z.db.host);
    var x = z && zerlegen(z.input);
    return x ? x.host : "";
  }
  /* Zwei Hosts, die sich nur um einen TIPPFEHLER unterscheiden -- fuer "Did you mean ...?" (17.10.,
     Nutzer: "apple.de" schlug "aptly.de" vor). Die Datenbank liefert jede Domain des Teams mit
     Abstand <= 2 (similar_host), egal wie lang der Name ist; bei fuenf Buchstaben sind zwei
     Aenderungen aber schon ein anderes Wort. Darum die Regel aus der Struktur, ohne Wortlisten:
     - Endung (das letzte Label) und Name (alles davor) werden getrennt gelesen.
     - Gleiche Endung: der Abstand der Namen (eine Vertauschung zweier Nachbarzeichen zaehlt eins,
       wie in der Datenbank) darf hoechstens ein Fuenftel der Namenslaenge sein, hoechstens 2. Also
       unter 5 Zeichen gar keiner (bmw/bmx sind zwei Marken), bis 9 Zeichen einer, ab 10 zwei.
     - Andere Endung: nur, wenn der Name gleich ist und die Endungen sich um ein Zeichen
       unterscheiden (lee-up.de, lee-up.dr); ein Tippfehler im Namen UND in der Endung ist keiner.
     - Eine Unterdomain des anderen ist kein Tippfehler: m.lee-up.de liegt zwei Zeichen von
       lee-up.de entfernt und waere sonst ein falscher Vorschlag. */
  function editAbstand(a, b) {
    var m = [], i, j;
    for (i = 0; i <= a.length; i++) { m[i] = [i]; }
    for (j = 0; j <= b.length; j++) m[0][j] = j;
    for (i = 1; i <= a.length; i++) for (j = 1; j <= b.length; j++) {
      m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1));
      if (i > 1 && j > 1 && a.charAt(i - 1) === b.charAt(j - 2) && a.charAt(i - 2) === b.charAt(j - 1)) m[i][j] = Math.min(m[i][j], m[i - 2][j - 2] + 1);
    }
    return m[a.length][b.length];
  }
  function aehnlich(a, b) {
    a = String(a || "").toLowerCase(); b = String(b || "").toLowerCase();
    if (!a || !b || a === b) return false;
    if (a.slice(-(b.length + 1)) === "." + b || b.slice(-(a.length + 1)) === "." + a) return false;
    var ia = a.lastIndexOf("."), ib = b.lastIndexOf(".");
    if (ia < 1 || ib < 1) return false;
    var na = a.slice(0, ia), nb = b.slice(0, ib), ta = a.slice(ia + 1), tb = b.slice(ib + 1);
    if (ta !== tb) return na === nb && ta.length >= 2 && tb.length >= 2 && editAbstand(ta, tb) === 1;
    var d = editAbstand(na, nb);
    return d > 0 && d <= Math.min(2, Math.floor(Math.max(na.length, nb.length) / 5));
  }
  /* "DID YOU MEAN ...?" (15.10. spaet, Nachtrag der Datenbank Abschnitt 3): je Host, den das Team
     nie zitiert hat, hoechstens EIN Vorschlag { alt, neu } -- in der Reihenfolge der Ziele.
     Unbekannt ist ein Host laut per_target[].host_known (je Ziel); das oberste host_known gilt nur
     fuer das erste gueltige Ziel (Nachtrag 4.2) und zaehlt nur, wenn per_target fehlt und alle
     Ziele denselben Host haben (h1).
     MIT events_ziele_v2.sql schlaegt die Datenbank selbst vor: Grund similar_host, Domains des
     Teams im Abstand <= 2, je Ziel bis 3, sortiert nach Abstand, dann Zitaten -- genommen wird der
     erste, dessen target_input zu einem Ziel mit diesem Host gehoert. Ueber den HOST und nicht nur
     ueber die eine Eingabe: die Datenbank fuehrt jede URL nur einmal (distinct je URL), zwei Ziele
     auf demselben vertippten Host (bwm.de/a, bwm.de) bekommen den Vorschlag also nur am ersten.
     Ob die Antwort von v2 kommt, sagt can_classify (steht nur dort) oder ein near_misses-Eintrag
     mit host/distance. Dann gilt NUR der Vorschlag der Datenbank -- sie kennt alle zitierten
     Domains, die Oberflaeche nur die bis zu fuenf Beinahe-Treffer.
     VOR v2 der alte Weg: ein Beinahe-Treffer (other_host, also dieselbe Hauptdomain) hoechstens
     zwei Zeichen vom Host entfernt. Er findet nur Tippfehler in der Unterdomain
     (ratgebr.lee-up.de); einen in der Hauptdomain (lee-upp.de) sieht er nicht. */
  function tippVorschlaege(d, h1) {
    var nahAlle = isArr(d.near_misses) ? d.near_misses.filter(Boolean) : [];
    var pts = isArr(d.per_target) ? d.per_target.filter(Boolean) : [];
    var mitDb = typeof d.can_classify === "boolean" || nahAlle.some(function (x) { return x.distance !== undefined || x.host !== undefined; });
    function hostVon(s) {
      for (var i = 0; i < pts.length; i++) if (String(pts[i].input) === String(s) && pts[i].host) return String(pts[i].host);
      var z = zerlegen(s);
      return z ? z.host : "";
    }
    var unbek = [];
    if (pts.length) pts.forEach(function (pt) {
      var h = pt.host ? String(pt.host) : hostVon(pt.input);
      if (pt.host_known === false && pt.valid !== false && !pt.error && h && unbek.indexOf(h) < 0) unbek.push(h);
    });
    else if (d.host_known === false && h1) unbek.push(h1);
    var aus = [];
    unbek.forEach(function (h) {
      var neu = "";
      nahAlle.forEach(function (x) {
        if (neu) return;
        var passt = x.target_input == null || hostVon(x.target_input) === h;
        if (mitDb) { if (x.reason === "similar_host" && x.target_input != null && passt && x.host && String(x.host) !== h && aehnlich(h, String(x.host))) neu = String(x.host); }
        else if (x.url && passt) { var nh = hostPfad(x.url).host; if (aehnlich(nh, h)) neu = nh; }
      });
      if (neu) aus.push({ alt: h, neu: neu });
    });
    return aus;
  }

  /* ============================================================================================
     Eine Wurzel
     ============================================================================================ */
  function initRoot(root) {
    if (root.__uevController) return root.__uevController;
    var instanceId = root.getAttribute("data-instance") || "default";
    if (/^[A-Z_]{4,}$/.test(instanceId)) return null;   /* Platzhalter noch nicht ersetzt */

    /* data-demo="yes": jedes Ereignis wird hier im Tab aus events-demo.js beantwortet statt
       hinauszugehen (demoAntwort) -- derselbe Weg durch die Antwort-Verteilung wie mit echten
       Daten. */
    var demo = UC.isYes ? UC.isYes(root.getAttribute("data-demo")) : root.getAttribute("data-demo") === "yes";
    /* Bubble-Ereignisse gibt es nur noch fuer den Rueckweg (bubbleRufen) und fuer uevResponses. */
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
    /* kx: wer auf diese Antwort wartet (siehe rufen). Ohne kx (uevResponses) nur die Tabelle. */
    function demoAntwort(name, wert, kx) {
      var b = {};
      try { b = JSON.parse(wert); } catch (e) {}
      demoHolen(function (D) {
        setTimeout(function () {
          if (root.isConnected === false) return;
          var r = D ? (D.antwort(name, b, { topicName: topicName, storeZeile: listeEvent }) || {}) : { fehler: "" };
          if (KANAL[name]) {
            kam(name, r.fehler != null
              ? { ok: false, status: 400, fehler: { code: "", message: String(r.fehler), hint: "", details: "" } }
              : { ok: true, status: 200, daten: r.detail || r.analyse || r.vorschau || r.geloescht || null }, kx || {});
          }
          if (r.responses && window.renderResponsesTable) {
            try { window.renderResponsesTable({ instanceId: respInstanz, rows: r.responses, totalCount: r.total }); } catch (e) {}
          }
          if (r.liste && UC.setEvents) UC.setEvents(JSON.stringify(r.liste), "demo");
        }, DEMO_MS);
      });
    }

    /* ---- DER DATENWEG (13.10.: direkt an Supabase statt ueber Bubble-Workflows) -------------
       rufen(kanal, parameter, kx, spaet): die v2-RPC des Kanals ueber UC.rpc, die Antwort an
       DIESELBEN Handler wie die alten Setter (setDetail, setAnalysis, ...) -- die nehmen ein
       Objekt so gut wie Bubble-Text. kx sagt, wer wartet: { eventId } beim Detail, { sig } bei
       der Analyse, { popup } bei Vorschau und den Popups. Damit landet eine Antwort genau dort,
       wo sie bestellt wurde -- ueber die Setter musste die Komponente raten (eine Lese-Antwort
       konnte ein wartendes Bearbeiten-Popup schliessen, bevor dessen Antwort da war).
       Ein Tiefenlink wartete bisher mit fire.spaet auf Bubbles Empfaenger; hier wartet er nur
       noch auf das Team (UC.teamWarten), das Bubble beim Seitenaufbau eventuell noch nicht
       gesetzt hat. spaet gilt nur noch fuer den Rueckweg an Bubble. */
    /* Ohne Bubble (die App, UC.ohneBubble): kein Rueckweg, sondern der Fehler, den der Aufrufer schon zeigt (14.10.). */
    function funktionFehlt(erg) {
      if (UC.ohneBubble && UC.ohneBubble()) return false;
      var f = (erg && erg.fehler) || {};
      return /PGRST202/.test(String(f.code || "")) ||
        (erg && erg.status === 404 && /could not find the function/i.test(String(f.message || "") + " " + String(f.details || "")));
    }
    function bubbleRufen(kanal, o, spaet) {
      var k = KANAL[kanal], b = body(o);
      if (spaet && fireBubble.spaet) fireBubble.spaet(k.attr, kanal, b); else fireBubble(k.attr, kanal, b);
    }
    function rufen(kanal, o, kx, spaet) {
      kx = kx || {};
      if (demo) { demoAntwort(kanal, body(o), kx); return; }
      var k = KANAL[kanal];
      if (RUECKFALL[kanal] || !UC.rpc) {
        if (k.nurDirekt) { kam(kanal, { ok: false, status: 0, fehler: { code: "", message: "", hint: "", details: "" } }, kx); return; }
        bubbleRufen(kanal, o, spaet);
        return;
      }
      var tm = team();
      /* Kampagnen (17.10.): mit Teil B gehen Analyse, Anlegen und Bearbeiten an die neuen
         Fassungen -- v4 ist fuer ein Tages-Event gleich v3 (Vertrag B.2), also immer. */
      var fn4 = kampagneDa() && KAMPAGNE_FN[kanal] ? KAMPAGNE_FN[kanal] : "";
      (tm ? Promise.resolve(tm) : (UC.teamWarten ? UC.teamWarten(10000) : Promise.resolve(""))).then(function (tm2) {
        /* Kein Team nach 10 s: kein Aufruf ohne p_team (der Server antwortete mit forbidden) --
           die Stelle, die wartet, bekommt den allgemeinen Fehler statt ewig zu laden. */
        if (!tm2) return { ok: false, status: 0, fehler: { code: "", message: "", hint: "", details: "" } };
        return UC.rpc(fn4 || k.fn, mitTeam(o, tm2), { timeoutMs: k.ms });
      }).then(function (erg) {
        erg = erg || { ok: false, status: 0, fehler: {} };
        /* v4 fehlt doch (Rueckweg der DB): fuer den Rest der Seite der heutige Stand. Ein Aufruf,
           der nur mit v4 Sinn hat (Zeitraum, Fenster "Since event", Umfang eines geplanten
           Events), endet mit einem Satz statt still ohne diese Teile zu speichern. */
        if (fn4 && !erg.ok && fehltFn(erg)) {
          KAMPAGNE_DA.stand = false;
          var nurV4 = o && (o.p_end_date != null || o.p_window != null || (kanal === "uevUpdate" && (o.p_event_date != null || o.p_scope_mode != null)));
          /* p_notify (Teil A) kennt nur v4: ohne ihn noch einmal, der Schalter kommt dann nicht an. */
          if (!nurV4) { var o3 = {}; for (var q in o) if (q !== "p_notify") o3[q] = o[q]; rufen(kanal, o3, kx, spaet); return; }
          kam(kanal, { ok: false, status: 400, fehler: { code: "", message: "impact_event_campaigns_unavailable", hint: "", details: "" } }, kx);
          return;
        }
        /* "And" (p_tagmode) und die Funktion kennt den Parameter noch nicht: PostgREST meldet das
           als fehlende Funktion (PGRST202), obwohl es sie gibt. Das ist KEIN Grund fuer den
           Rueckweg zu Bubble -- der wuerde den Kanal fuer die ganze Sitzung umstellen, und Bubble
           kennt "And" ebenso wenig. Still auf "Or" zurueckzufallen waere eine andere Auswahl als
           die gezeigte. Also ein Fehler am Feld der Topics. Sobald die Datenbank p_tagmode
           fuehrt, laeuft derselbe Aufruf ohne Zutun durch. */
        if (!erg.ok && funktionFehlt(erg) && o && o.p_tagmode) {
          kam(kanal, { ok: false, status: 400, fehler: { code: "", message: "impact_event_tagmode_unavailable", hint: "p_tagmode", details: "" } }, kx);
          return;
        }
        /* Citation Tracking (19.10.): die Funktion gibt es noch nicht -- ein Satz statt des allgemeinen Fehlers. */
        if (!erg.ok && kanal === "uevCreateWatch" && funktionFehlt(erg)) {
          kam(kanal, { ok: false, status: 400, fehler: { code: "", message: "impact_event_watch_unavailable", hint: "", details: "" } }, kx);
          return;
        }
        if (!erg.ok && funktionFehlt(erg) && !k.nurDirekt) {
          /* Die v2-Funktion ist noch nicht eingespielt: dieser Kanal geht fuer den Rest der
             Sitzung den alten Weg, ohne jedes Mal erst an der 404 vorbei. */
          RUECKFALL[kanal] = true;
          bubbleRufen(kanal, o, spaet);
          return;
        }
        kam(kanal, erg, kx);
      });
    }
    function kam(kanal, erg, kx) {
      var k = KANAL[kanal];
      if (root.isConnected === false) {
        /* Bubble hat die Wurzel inzwischen neu gebaut (Themenwechsel). Die neue weiss von dieser
           Anfrage nichts -- aber eine gelungene Aenderung gehoert trotzdem in die Liste. */
        if (erg.ok && k.schreibt) listeNeu();
        return;
      }
      if (!erg.ok) { fehlerKam(kanal, erg.fehler || {}, kx); return; }
      var d = erg.daten;
      if (kanal === "uevDetail") {
        /* Die Antwort fuer ein Event, das nicht mehr offen ist: ablegen, aber nichts Offenes als
           Fehler markieren. */
        if (kx.eventId !== state.eventId) { if (d && typeof d === "object" && d.id != null) ctrl.setDetail(d, "lesen"); return; }
        ctrl.setDetail(d, "lesen");
        return;
      }
      /* Eine Analyse fuer Fenster oder Filter von vorhin: setAnalysis legt unter den AKTUELLEN
         Filtern ab -- eine spaete Antwort waere dort falsch einsortiert. Die aktuelle kommt noch. */
      if (kanal === "uevAnalysis") { if (kx.sig === analyseSig()) ctrl.setAnalysis(d, kx.sig); return; }
      if (kanal === "uevScopePreview") { if (popup && popup === kx.popup) ctrl.setVorschau(d); return; }
      if (kanal === "uevDelete") { ctrl.setGeloescht(d); return; }
      /* Anlegen, Bearbeiten, URL hinzufuegen und entfernen antworten mit dem Detail (Vertrag 1,
         Antwort b). Schliesst es kein wartendes Popup mehr (dessen Uhr war abgelaufen), laedt die
         Liste hier neu -- die Aenderung ist trotzdem geschehen. */
      var wartet = kanal === "uevRemoveUrl" ? !!wartend.urlWeg : kanal === "uevRemoveTarget" ? !!wartend.zielWeg : !!(popup && popup === kx.popup && popup.warte);
      if (!ctrl.setDetail(d, "schreiben")) { fehlerKam(kanal, { message: "unreadable_response" }, kx); return; }
      if (!wartet) listeNeu();
    }
    /* Ein Fehler der RPC dort, wo gewartet wird: am Feld eines Popups, im Detail als
       Fehlerzustand, sonst als Toast. Nie der Code selbst (fehlerText). */
    function fehlerKam(kanal, f, kx) {
      var code = String(f.message || ""), hint = String(f.hint || ""), txt = fehlerText(code, hint);
      if (kanal === "uevDetail") {
        if (planOffenNach === kx.eventId) planOffenNach = null;
        if (state.ansicht === "detail" && kx.eventId === state.eventId) ctrl.setFehler(code, "lesen", hint);
        return;
      }
      if (kanal === "uevAnalysis") {
        /* Auch bei impact_event_not_found still: den Toast gibt die Detail-Anfrage, die zur selben
           Zeit dasselbe hoert -- sonst stuenden zwei gleiche untereinander. */
        if (state.ansicht !== "detail" || kx.sig !== analyseSig()) return;
        state.analyseLaden = false; state.analyseFehler = true;
        renderDetail();
        return;
      }
      if (kanal === "uevScopePreview") {
        if (popup && popup === kx.popup) {
          popupVorschauKam(null);
          if (code === "impact_event_tagmode_unavailable") feldFehler("topics", txt);
        }
        return;
      }
      if (kanal === "uevDelete") { loeschFehler(txt); return; }
      /* Seit 17.10. antwortet remove_impact_event_target_v1: "Ziel schon weg" heisst hier "URL schon weg". */
      if (kanal === "uevRemoveUrl") { urlWegFehler(code === "impact_event_target_not_found" ? fehlerText("impact_event_url_not_found", hint) : txt); return; }
      if (kanal === "uevRemoveTarget") {
        zielWegFehler(txt);
        /* impact_event_target_not_found: das Ziel ist schon weg (anderer Tab, Kollege) -- das
           Detail neu laden, sonst stuende sein Abschnitt mit dem Knopf weiter da. */
        if (code === "impact_event_target_not_found" && state.ansicht === "detail" && kx.eventId === state.eventId) detailAnfordern();
        return;
      }
      if (popup && popup === kx.popup && popupFehlerKam(txt, code, hint)) return;
      if (UC.toast) UC.toast(txt, { kind: "error" });
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
        return seiteZeichnung() + '<div class="up-explain-h">' + esc(t("How Impact works")) + '</div>' +
          SEITE_SAETZE.map(function (g) {
            return '<div class="uev-explain-unter">' + esc(t(g.h)) + '</div>' + g.t.map(function (x) { return '<div class="up-explain-t">' + esc(t(x)) + '</div>'; }).join("");
          }).join("");
      } }) : null;
    /* Per Klick (Touch hat kein Zeigen): oeffnen, wenn zu; schliessen tut ein Druck daneben. */
    document.addEventListener("pointerdown", function (e) {
      if (!seitenKarte || !seitenKarte.el.classList.contains("is-on")) return;
      if (e.target.closest && (e.target.closest(".uev-seiteninfo") || seitenKarte.el.contains(e.target))) return;
      seitenKarte.hide();
    }, true);
    function seitenInfoKnopf() {
      return '<button type="button" class="up-iconbtn uev-seiteninfo" aria-label="' + esc(t("How Impact works")) + '">' + UC.icon("info", 2) + '</button>';
    }
    if (UC.widthTiers) UC.widthTiers(root, { narrowAt: 760, vnarrowAt: 520 });
    var respInstanz = String(root.getAttribute("data-responses-instance") || "responses_events").trim();

    /* Der Stand dieser Instanz ueberlebt einen Neuaufbau durch Bubble (Themenwechsel baut das
       Element neu) -- dasselbe Muster wie response-detail. */
    var saved = STORE[instanceId] || null;
    function gemerkt(k, sonst) { return saved && saved[k] != null ? saved[k] : sonst; }
    var state = {
      ansicht: "uebersicht", eventId: null,
      /* Je Abschnitt der Uebersicht eigene Suche, Sortierung (und beim Event der Typ-Filter); die alten Felder gelten fuer Event Tracking. */
      ue: gemerkt("ue", null) || {
        event: { suche: gemerkt("suche", ""), typen: gemerkt("typen", []), sortFeld: gemerkt("sortFeld", "created"), sortRicht: gemerkt("sortRicht", "desc") },
        watch: { suche: "", sortFeld: "created", sortRicht: "desc" }
      },
      detail: gemerkt("detail", {}), detailLaden: false, detailFehler: false,
      analyse: gemerkt("analyse", {}), analyseLaden: false, analyseFehler: false,
      fenster: gemerkt("fenster", 30), seit: gemerkt("seit", false), metrik: gemerkt("metrik", "visibility"),
      modelle: gemerkt("modelle", null), maerkte: gemerkt("maerkte", null),
      respUrl: "", geloescht: {},
      /* Seitenabdeckung je Event (Teil C) und die Wahl des Umschalters je Ziel -- gemerkt wie Detail
         und Analyse, damit ein Neuaufbau (Thema) kein Skelett zeigt. */
      abd: gemerkt("abd", {}), abdSeg: gemerkt("abdSeg", {}),
      /* Citation Tracking: was die Charts der Ziele zeigen, "share" (Anteil an allen Zitaten, Standard) oder "abs" (Zahl der Zitate). */
      zielMetrik: gemerkt("zielMetrik", "share")
    };
    function persist() {
      if (root.isConnected === false) return;
      STORE[instanceId] = { ue: state.ue, detail: state.detail, analyse: state.analyse,
        fenster: state.fenster, seit: state.seit, metrik: state.metrik, modelle: state.modelle, maerkte: state.maerkte,
        abd: state.abd, abdSeg: state.abdSeg, zielMetrik: state.zielMetrik };
    }
    function dieDetail() { return state.eventId ? state.detail[state.eventId] || null : null; }
    /* Der Intent-Filter der App gehoert in die Signatur (13.10.): sonst zeigte ein Wechsel die
       gemerkte Analyse des vorigen Filters. */
    function intentP() { return UC.intentFilterParams ? UC.intentFilterParams() : {}; }
    /* EIN Schluessel fuer Ablegen (setAnalysis) und Finden (dieAnalyse) -- 15.10.: seit dem
       13.10. kam der Intent-Filter nur beim Finden dazu, abgelegt wurde ohne ihn. Die Antwort kam
       an, wurde nie gefunden, und das Detail blieb im Skelett (gemeldet: "Responses kommen an, aber
       es bleibt im Skeleton"). id und fen sind die der Antwort, ohne sie die aktuellen. */
    function analyseSig(id, fen) {
      return [id != null ? id : state.eventId, fen != null ? fen : fensterSig(id), (state.modelle || []).join(","),
              (state.maerkte || []).join(","), JSON.stringify(intentP())].join("|");
    }
    function dieAnalyse() { return state.analyse[analyseSig()] || null; }
    /* Das Fenster einer Anfrage (17.10.): eine Kampagne kennt keins ("k", feste Abschnitte
       Vorher/Waehrend/Danach), ein offenes Event zusaetzlich "Since event" ("seit"). */
    function dasEvent(id) { id = id != null ? id : state.eventId; return state.detail[id] || listeEvent(id); }
    function fensterSig(id) {
      var ev = dasEvent(id);
      if (kampagneDa() && mitEnde(ev)) return "k";
      return seitAktiv(ev) ? "seit" : state.fenster;
    }
    /* "Since event" (Nachtrag 17.10., Abschnitt 2): nur bei einem offenen, schon laufenden Event
       und nur mit v4 -- bei Kampagnen gelten die Abschnitte, ein geplantes hat noch kein Danach. */
    function seitMoeglich(ev) { return kampagneDa() && !!ev && !istWatch(ev) && !mitEnde(ev) && !istGeplant(ev); }
    function seitAktiv(ev) { return !!state.seit && seitMoeglich(ev); }
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
          '<h1 class="up-ph-heading">' + esc(t("Impact")) + '</h1>' +
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
      icon: "cells", name: "Impact", komponente: true,
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
    /* ---- DIE UEBERSICHT: ZWEI ABSCHNITTE (19.10.) ------------------------------------------------------
       Event Tracking (Events mit Datum, Topics und Kontrollgruppe) und Citation Tracking (Seiten und Domains beobachten) stehen
       gestapelt untereinander, jeder mit eigener Leiste (Suche, Sortierung, beim Event zusaetzlich der Typ-Filter) und eigener
       Liste. Ein Abschnitt ohne Eintraege ist gar nicht da; ohne jeden Eintrag steht ein gemeinsamer Leerzustand. Angelegt wird ueber
       EINEN Knopf im Seitenkopf. */
    var ABSCHNITTE = ["event", "watch"];
    var ab = {};
    function abschnitt(art) { return ab[art] || (ab[art] = { el: null, liste: null, zahl: null, suche: null, sucheIn: null, sucheKit: null, typFilter: null, sortPop: null }); }
    function ue(art) { return state.ue[art]; }
    function artVon(ev) { return istWatch(ev) ? "watch" : "event"; }
    var ART_TITEL = { event: "Event Tracking", watch: "Citation Tracking" };
    function baueUebersicht() {
      ab = {};
      root.classList.remove("is-watch-ansicht");
      elAktion.innerHTML = anleitungKnopf() + seitenInfoKnopf() +
        '<button class="up-ph-addbtn up-export uev-anlegen" type="button">' + UC.icon("plus", 1.8) +
          '<span data-i18n="Create">' + esc(t("Create")) + '</span></button>';
      elMain.innerHTML = ABSCHNITTE.map(function (art) {
        return '<section class="uev-abschnitt" data-art="' + art + '">' +
          '<div class="up-head uev-head">' +
            '<span class="up-heading"><span class="up-head-label">' + esc(t(ART_TITEL[art])) + '</span>' +
              '<span class="up-head-sep"></span><span class="up-head-count uev-zahl"></span></span>' +
            '<div class="up-head-tools">' +
              /* Sortieren wie in den Tabellen: Knopf mit Sortierzeichen, davor die Suche (Reihenfolge der Leiste der anderen
                 Seiten), Menue aus UC.sortMenuHtml mit Feldern und Schalter "Descending". */
              '<div class="up-sort uev-sort"><button class="up-sort-btn up-iconbtn" type="button" data-tip="' + esc(t("Sort")) + '" aria-label="' + esc(t("Sort")) + '">' + UC.icon("arrowUpDown", 2) + '</button>' +
                '<div class="up-sort-menu" role="menu" aria-hidden="true"></div></div>' +
              '<div class="up-search uev-suche">' +
                '<button type="button" class="up-iconbtn up-search-btn" aria-label="' + esc(t("Search")) + '" data-tip="' + esc(t("Search")) + '">' + UC.icon("search", 2) + '</button>' +
                '<div class="up-search-box">' +
                  '<input class="up-search-input" type="text" placeholder="' + esc(t(art === "watch" ? "Search…" : "Search events…")) + '" autocomplete="off" spellcheck="false" aria-label="' + esc(t("Search")) + '"/>' +
                  '<button type="button" class="up-search-clear" aria-label="' + esc(t("Clear search")) + '">' + UC.icon("x", 2.2) + '</button>' +
                '</div>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="uev-liste"></div>' +
        '</section>';
      }).join("") + '<div class="uev-leer-gesamt" hidden></div>';
      respSichtbar(false);
      ABSCHNITTE.forEach(function (art) { abschnittBauen(art); });
      renderListe();
    }
    function abschnittBauen(art) {
      var a = abschnitt(art), z = ue(art);
      a.el = elMain.querySelector('.uev-abschnitt[data-art="' + art + '"]');
      a.liste = a.el.querySelector(".uev-liste");
      a.zahl = a.el.querySelector(".uev-zahl");
      a.suche = a.el.querySelector(".uev-suche");
      a.sucheIn = a.el.querySelector(".up-search-input");
      a.sucheIn.value = z.suche || "";
      if (z.suche) a.suche.classList.add("is-open", "has-text");
      a.sucheKit = UC.makeSearch ? UC.makeSearch({
        root: root, box: a.suche, input: a.sucheIn, state: { query: z.suche, page: 1 },
        prefix: "uev-" + art, mobileMax: 560, onRender: function () {}, onFire: function () {}
      }) : null;
      a.sucheIn.addEventListener("input", function () {
        z.suche = a.sucheIn.value || "";
        a.suche.classList.toggle("has-text", !!z.suche);
        persist(); renderListe();
      });
      a.sucheIn.addEventListener("keydown", function (e) { if (e.key === "Escape" && a.sucheKit) { e.stopPropagation(); a.sucheKit.toggle(); } });
      a.el.querySelector(".up-search-btn").addEventListener("click", function (e) { e.stopPropagation(); if (a.sucheKit) a.sucheKit.toggle(); else a.suche.classList.toggle("is-open"); });
      a.el.querySelector(".up-search-clear").addEventListener("click", function (e) {
        e.stopPropagation();
        a.sucheIn.value = ""; z.suche = ""; a.suche.classList.remove("has-text");
        persist(); renderListe();
      });
      /* Der Typ-Filter ist der Marken-Filter der Tabellen (UC.makeAuswahlFilter, 03.10.: "alles
         gleich wie im Selected Brands"). Nur beim Event Tracking: ein Citation Tracking hat keinen Typ. Er zeigt nur Typen, die es in
         der Liste gibt -- ein Filter auf einen Typ ohne Event ist ein toter Eintrag; ein gewaehlter bleibt drin, auch wenn er
         gerade wegfiel. Eigene Typen (frei eingetippt) stehen hinter den festen. */
      if (art === "event") {
        a.typFilter = UC.makeAuswahlFilter ? UC.makeAuswahlFilter({
          klasse: "uev-typfilter", titel: "Event types", alle: "All Types", mehrere: "{n} Types",
          suche: "Search types…", tip: "Event type", gewaehlt: z.typen,
          items: filterTypen,
          onChange: function (keys) { z.typen = keys; persist(); renderListe(); }
        }) : null;
        if (a.typFilter) a.el.querySelector(".up-head-tools").appendChild(a.typFilter.el);
      }
      sortBauen(art);
    }
    /* ---- SORTIERUNG DER LISTE (18.10.): Felder, die die Liste schon hat, keine neue Abfrage. Standard: zuletzt
       erstellt zuerst. Der Stand lebt in state (persist), also ueber Seitenwechsel und Event-Wechsel hinweg. */
    var SORT_FELDER = { event: [{ key: "created", label: "Created" }, { key: "date", label: "Event date" }, { key: "name", label: "Name" }],
                        watch: [{ key: "created", label: "Created" }, { key: "name", label: "Name" }] };
    function sortMenuFuellen(art) {
      var m = abschnitt(art).el && abschnitt(art).el.querySelector(".uev-sort .up-sort-menu");
      if (m && UC.sortMenuHtml) m.innerHTML = UC.sortMenuHtml(SORT_FELDER[art], ue(art).sortFeld, ue(art).sortRicht);
    }
    /* Das Menue haengt mit right: 0 am Knopf (core) und ragt nach links. Steht der Knopf am Telefon weniger als die Menuebreite
       vom linken Rand, schnitte es dort ab (gemessen 375 breit: 11px): dann um genau den Fehlbetrag plus 8px Rand nach rechts. */
    function sortLage(wrap) {
      var m = wrap.querySelector(".up-sort-menu");
      if (!m) return;
      m.style.right = "";
      var l = m.getBoundingClientRect().left;
      if (l < 8) m.style.right = (l - 8) + "px";
    }
    function sortBauen(art) {
      var a = abschnitt(art), wrap = a.el.querySelector(".uev-sort");
      if (!wrap) return;
      sortMenuFuellen(art);
      if (UC.makePopover) a.sortPop = UC.makePopover({ wrap: wrap, menu: wrap.querySelector(".up-sort-menu"), opener: wrap.querySelector(".up-sort-btn") });
      wrap.querySelector(".up-sort-btn").addEventListener("click", function (e) {
        e.stopPropagation();
        if (!a.sortPop) return;
        if (wrap.classList.contains("is-open")) a.sortPop.close(false); else { sortMenuFuellen(art); a.sortPop.open(); sortLage(wrap); }
      });
      wrap.querySelector(".up-sort-menu").addEventListener("click", function (e) {
        e.stopPropagation();
        var f = e.target.closest("[data-sortfield]"), r = e.target.closest("[data-sortdir]"), z = ue(art);
        if (f) z.sortFeld = f.getAttribute("data-sortfield");
        else if (r) z.sortRicht = z.sortRicht === "desc" ? "asc" : "desc";
        else return;
        persist(); sortMenuFuellen(art); renderListe();
      });
    }
    function filterTypen() {
      var da = {};
      (UC.getEvents ? UC.getEvents() : []).forEach(function (ev) { if (!state.geloescht[ev.id] && !istWatch(ev)) da[typ(ev).key] = 1; });
      ue("event").typen.forEach(function (k) { da[k] = 1; });
      var typen = (UC.EVENT_TYPEN || []).filter(function (x) { return da[x.key]; });
      Object.keys(da).forEach(function (k) { var x = typ({ event_type: k }); if (x.eigen) typen.push(x); });
      return typen.map(function (x) { return { key: x.key, label: x.label, icon: x.icon }; });
    }
    function gefiltert(art) {
      var z = ue(art), q = String(z.suche || "").trim().toLowerCase();
      var l = (UC.getEvents ? UC.getEvents() : []).filter(function (ev) {
        if (state.geloescht[ev.id] || artVon(ev) !== art) return false;
        if (art === "event" && z.typen.length && z.typen.indexOf(typ(ev).key) < 0) return false;
        if (!q) return true;
        return (String(ev.name || "") + " " + String(ev.description || "")).toLowerCase().indexOf(q) >= 0;
      });
      /* Standard (18.10., Nutzer): zuletzt erstellt zuerst. Dazu Eventdatum und Name, jeweils mit Richtung; bei
         Gleichstand entscheidet die Anlage, zuletzt die Kennung, damit die Reihenfolge nie flackert. */
      function anlage(a, b) { return String(a.created_at || "").localeCompare(String(b.created_at || "")); }
      var feld = z.sortFeld, mal = z.sortRicht === "asc" ? 1 : -1;
      l.sort(function (a, b) {
        var d = 0;
        if (feld === "date") d = tagMs(a.event_date) - tagMs(b.event_date);
        else if (feld === "name") d = String(a.name || "").localeCompare(String(b.name || ""), undefined, { sensitivity: "base", numeric: true });
        if (!d) d = anlage(a, b);
        if (!d) d = String(a.id || "").localeCompare(String(b.id || ""));
        return d * mal;
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
      /* Citation Tracking: bei genau EINER beobachteten Seite deren Favicon statt des Zeichens (erst wenn es geladen ist, bis dahin und bei einem Fehler steht das Zeichen da);
         bei mehreren das Zeichen. */
      var wh = istWatch(ev) ? watchHosts(ev) : null, fav = wh && wh.n === 1 && wh.hosts.length === 1 ? wh.hosts[0] : "";
      /* Das Favicon erscheint nur als GEPRUEFTES Bild (19.10., Nutzer: Zeichen und Platzhalter-Globus standen nebeneinander und
         flackerten): bis es geprueft ist, und bei Googles Platzhalter, steht allein das Zeichen. Je Host einmal gefragt (avatarFav),
         danach tragen es alle Avatare dieses Hosts sofort -- auch nach jedem Neuzeichnen. */
      var fsrc = fav ? avatarFavHolen(fav) : "";
      return '<span class="uev-avatar' + (groesse ? " is-" + groesse : "") + (fsrc ? " has-fav" : "") + '"' + (f ? ' style="--uev-ton:' + esc(f) + '"' : '') + (fav ? ' data-fav-host="' + esc(fav) + '"' : '') + ' aria-hidden="true">' + UC.icon(zeichen(ev), 2) +
        (fsrc ? avatarFavImg(fsrc) : '') + '</span>';
    }
    var avatarFav = {};
    function avatarFavImg(src) { return '<img class="uev-avatar-fav" src="' + esc(src) + '" alt="" referrerpolicy="no-referrer" onerror="var p=this.parentNode;this.remove();if(p)p.classList.remove(\'has-fav\')"/>'; }
    function avatarFavHolen(h) {
      if (avatarFav[h] != null) return avatarFav[h];
      avatarFav[h] = "";
      favSuchen(h, function (src) {
        avatarFav[h] = src || "";
        if (!src) return;
        var l = document.querySelectorAll('.uev-avatar[data-fav-host="' + h.replace(/"/g, "") + '"]');
        for (var i = 0; i < l.length; i++) {
          if (l[i].classList.contains("has-fav")) continue;
          l[i].insertAdjacentHTML("beforeend", avatarFavImg(src));
          l[i].classList.add("has-fav");
        }
      });
      return "";
    }
    function mehrMenue(ev, wo) {
      var kannLoeschen = ev.can_delete === true;
      return '<span class="uev-mehr" data-mehr-wo="' + wo + '">' +
        '<button type="button" class="up-iconbtn uev-mehrbtn" aria-label="' + esc(t("More")) + '" data-tip="' + esc(t("More")) + '">' + UC.icon("moreHorizontal", 2) + '</button>' +
        /* Das Aktionsmenue aus core (.up-aktionsmenue + .up-optrow), dasselbe wie das Menue der
           Mitgliederliste -- vorher erbten die Zeilen hier die 16px der Seite (03.10. gemessen). */
        '<div class="up-menu uev-mehrmenu up-aktionsmenue" role="menu" aria-hidden="true">' +
          '<button type="button" class="up-optrow" role="menuitem" data-aktion="edit" data-event-id="' + esc(ev.id) + '">' + UC.icon("squarePen", 2) + '<span class="up-aktionsmenue-lbl">' + esc(t("Edit")) + '</span></button>' +
          /* Am Telefon (is-vnarrow) steht das Anheften hier statt als Knopf im Kopf -- dort fehlt
             sonst der Platz fuer die Krume (gemessen 16.10.: "Overview" auf 9px gedrueckt). */
          (wo === "kopf" && pinDa() ? '<button type="button" class="up-optrow uev-mehr-pin" role="menuitem" data-aktion="pin" data-event-id="' + esc(ev.id) + '">' + UC.icon("pin", 2) +
            '<span class="up-aktionsmenue-lbl">' + esc(t(istAngeheftet(ev.id) ? "Unpin from sidebar" : "Pin to sidebar")) + '</span></button>' : '') +
          (wo === "kopf" && !istWatch(ev) ? notifyZeileHtml(ev) : '') +
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
      return '<article class="uev-karte' + (vorschau ? " is-vorschau" : " up-karte-klick") + (cv ? " has-cover" : "") + '"' +
          (vorschau ? ' aria-hidden="true"' : ' role="link" tabindex="0" data-event-id="' + esc(ev.id) + '"') +
          (f ? ' style="--uev-ton:' + esc(f) + '"' : '') + '>' +
        (function () { var ct = coverTeile(cv); return '<div class="uev-karte-band' + ct.klasse + '"' + ct.attr + '></div>'; })() +
        (vorschau ? '' : mehrMenue(ev, "karte")) +
        '<div class="uev-karte-body">' +
          avatarHtml(ev) +
          '<h3 class="uev-karte-titel">' + esc(ev.name || "") + '</h3>' +
          angabenHtml(ev, "uev-karte-meta") +
          (ev.description ? '<p class="uev-karte-text">' + esc(ev.description) + '</p>' : '') +
          (istWatch(ev) ? '' : kennzahlenHtml(ev)) +
        '</div>' +
      '</article>';
    }
    /* EIN WABSCHNITTE, DAS ENDET (Muster brand-detail: 25s, gezaehlt erst, wenn die Uebersicht zu sehen
       ist). Kommt die Liste nie -- der Schritt im Seitenaufbau fehlt, der Workflow brach ab --,
       lief das Skelett sonst fuer immer, und das sieht aus wie "gleich da" (03.10. so gemeldet:
       "ich seh nur Skeleton Loader"). Im Klick-Dummy kommt die Liste aus der Datei, dort keine Uhr. */
    var LISTE_WARTE_MS = 25000, listeUhrId = null;
    function listeGeladen() { return !!(UC.eventsStand && UC.eventsStand().geladen); }
    /* WAS EIN EVENT TRACKT, IN DER UEBERSICHT (15.10. spaet, Rueckmeldung Abschnitt 2). Die Karten
       lesen den Event-Speicher (team_context_v1.events), und der bleibt laut Datenbank OHNE
       target_count/target_kinds -- ein Event mit nur einem Pfad stuende dort als "URLs 0". Bis die
       Datenbank die beiden Felder auch dort liefert (Rueckfrage vom 15.10.), holt die Uebersicht
       sie EINMAL je Lieferung des Speichers aus list_impact_events_v3 (Liste ohne Umschlag, in der
       Datenbank 3 ms) und legt sie nur hier ab. Bringt eine Zeile des Speichers target_count
       selbst mit, faellt der Aufruf von allein weg; fehlt v3 (PGRST202), fuer den Rest der Seite.
       Seit dem Nachtrag 15.10. (Abschnitt 1) liefert team_context_v1 beide Felder mit
       events_ziele_v2.sql, in derselben Form wie list_impact_events_v3 -- danach laeuft der
       Aufruf nicht mehr. Ein Event ohne Ziele traegt dann target_count 0, auch das zaehlt als
       "geliefert".
       Scheitert er, bleibt die Karte wie bisher -- dann ohne Ziele, aber nie mit erfundenen. */
    var LISTE3 = { seq: -1, laeuft: false, fehlt: false, je: {} };
    function liste3Holen() {
      if (demo || !UC.rpc || LISTE3.fehlt || LISTE3.laeuft || ZIELE_DA.stand === false) return;
      var st = listenStand(), l = UC.getEvents ? UC.getEvents() : [];
      if (!st.geladen || !l.length || LISTE3.seq === st.seq) return;
      /* Zwei Gruende, die Liste zu holen: die Ziele (fehlen im Speicher, bis die DB sie dort
         liefert) und die neuen Seiten der Karte (new_page_count steht NICHT im Team-Kontext, nur in
         list_impact_events_v3 -- Rueckmeldung 17.10., Frage 14). Letztere nur, wenn ein Event eine
         Regel traegt: ohne Regel-Ziel gibt es keine Sitemap-Seiten (die DB liefert dann null). */
      var zieleFehlen = !l.some(function (ev) { return ev && ev.target_count != null; });
      var seitenMoeglich = l.some(function (ev) { return ev && (!isArr(ev.target_kinds) || ev.target_kinds.some(function (k) { return k && k !== "url"; })); });
      if (!zieleFehlen && !seitenMoeglich) return;
      LISTE3.laeuft = true; LISTE3.seq = st.seq;
      teamHolen().then(function (tm) {
        return tm ? UC.rpc("list_impact_events_v3", { p_team: tm }, { timeoutMs: 15000 }) : null;
      }).then(function (erg) {
        LISTE3.laeuft = false;
        if (!erg) { LISTE3.seq = -1; return; }
        if (fehltFn(erg)) { LISTE3.fehlt = true; return; }
        if (!erg.ok || !isArr(erg.daten)) { if (unbekannt(erg)) LISTE3.seq = -1; return; }
        var je = {};
        erg.daten.forEach(function (r) {
          if (!r || r.id == null) return;
          var z = {};
          if (num(r.target_count) != null && isArr(r.target_kinds)) { z.target_count = num(r.target_count); z.target_kinds = r.target_kinds; }
          /* Der Schluessel muss da sein (Teil C eingespielt); sein Wert darf null sein. */
          if (Object.prototype.hasOwnProperty.call(r, "new_page_count")) { z.new_page_count = num(r.new_page_count); z.new_page_cited_count = num(r.new_page_cited_count); }
          if (z.target_count != null || z.new_page_count !== undefined) je[String(r.id)] = z;
        });
        LISTE3.je = je;
        if (root.isConnected !== false && state.ansicht === "uebersicht") renderListe();
      });
    }
    /* Eine Zeile des Speichers mit den Zielen aus list_impact_events_v3 -- als Kopie, die Zeile
       gehoert dem Speicher in core. */
    function mitZielen(ev) {
      var z = ev && LISTE3.je[String(ev.id)];
      if (!z) return ev;
      var ziele = z.target_count != null && ev.target_count == null, seiten = z.new_page_count !== undefined;
      if (!ziele && !seiten) return ev;
      var k = {};
      for (var f in ev) if (Object.prototype.hasOwnProperty.call(ev, f)) k[f] = ev[f];
      if (ziele) { k.target_count = z.target_count; k.target_kinds = z.target_kinds; }
      if (seiten) { k.new_page_count = z.new_page_count; k.new_page_cited_count = z.new_page_cited_count; }
      return k;
    }
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
    function zahlSetzen(art, n, laedt) {
      var el = abschnitt(art).zahl;
      if (!el) return;
      var kopf = el.closest(".up-heading");
      el.classList.toggle("is-sk", !!laedt);
      el.textContent = laedt || n == null ? "" : (UC.fmtTotal ? UC.fmtTotal(n) : String(n));
      if (kopf) kopf.classList.toggle("has-count", !!laedt || n != null);
    }
    function abschnittZeigen(art, an) { var a = abschnitt(art); if (a.el) a.el.hidden = !an; }
    function gesamtLeer(html) {
      var g = elMain && elMain.querySelector(".uev-leer-gesamt");
      if (!g) return;
      g.hidden = !html;
      g.innerHTML = html || "";
    }
    function renderListe() {
      if (!abschnitt("event").liste) return;
      var stand = UC.eventsStand ? UC.eventsStand() : { geladen: true, fehler: false };
      ABSCHNITTE.forEach(function (art) { var f = abschnitt(art).typFilter; if (f) f.neu(); });
      /* Nicht geladen, Fehler oder Zeitablauf: EIN Zustand fuer die ganze Seite, im ersten Abschnitt; der zweite ist nicht da. */
      function ganz(html, skelett) {
        ABSCHNITTE.forEach(function (art) { zahlSetzen(art, null, skelett && art === "event"); abschnittZeigen(art, art === "event"); });
        abschnitt("event").liste.className = "uev-liste";
        abschnitt("event").liste.innerHTML = html;
        gesamtLeer("");
      }
      if (stand.fehler && !(UC.getEvents && UC.getEvents().length)) {
        ganz(UC.leseFehlerHtml ? UC.leseFehlerHtml("the event list") : "");
        return;
      }
      if (!stand.geladen) {
        if (state.listeZeitUm) { ganz(UC.leerHtml({ icon: "info", titel: "Events could not be loaded", text: "Please reload the page." })); return; }
        ganz(karteSkelett(), true);
        zahlSetzen("event", null, true);
        rasterSetzen("event", 3);
        listeUhr();
        return;
      }
      var alle = (UC.getEvents ? UC.getEvents() : []).filter(function (ev) { return !state.geloescht[ev.id]; });
      if (!alle.length) {
        ABSCHNITTE.forEach(function (art) { zahlSetzen(art, null); abschnittZeigen(art, false); });
        gesamtLeer(UC.leerHtml({ icon: "cells", titel: "Nothing here yet",
          text: "Measure what a change did with Event Tracking, or watch which of your pages AI answers cite with Citation Tracking.",
          knopf: "Create", knopfAttr: "data-uev-create" }));
        return;
      }
      gesamtLeer("");
      ABSCHNITTE.forEach(function (art) {
        var a = abschnitt(art), da = alle.filter(function (ev) { return artVon(ev) === art; });
        /* Ein Abschnitt ohne einen einzigen Eintrag ist nicht da -- auch nicht mit leerem Kopf. */
        abschnittZeigen(art, da.length > 0);
        if (!da.length) { zahlSetzen(art, null); return; }
        var l = gefiltert(art);
        zahlSetzen(art, l.length);
        a.liste.className = "uev-liste";
        if (!l.length) { a.liste.innerHTML = UC.leerHtml({ gefiltert: true, was: art === "watch" ? "entries" : "events" }); return; }
        /* Nicht l.map(karteHtml): map reicht den Index als zweites Argument durch, und das ist der
           Schalter vorschau -- jede Karte ab der zweiten kam als nicht klickbare Vorschau heraus
           (im Pruefstand am 03.10. gefunden: nur die erste Karte oeffnete das Detail). */
        a.liste.innerHTML = '<div class="uev-karten">' + l.map(function (ev) { return karteHtml(mitZielen(ev), false); }).join("") + '</div>';
        rasterSetzen(art, l.length);
      });
      liste3Holen();
    }
    function rasterSetzen(art, n) {
      var a = abschnitt(art), k = a.liste && a.liste.querySelector(".uev-karten, .uev-karten-sk");
      if (!k) return;
      k.style.setProperty("--uev-cols", spalten(a.liste.clientWidth || root.clientWidth || 1200));
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
      /* "Add" statt "Add URL" (15.10.): derselbe Dialog nimmt jetzt auch Regeln. Ohne Ziele in der
         Datenbank bleibt es beim alten Wort -- der Dialog kann dann nur eine URL. */
      elAktion.innerHTML = anleitungKnopf() + seitenInfoKnopf() +
        '<span class="uev-kopfpin"></span>' +
        '<button class="up-btn-sec uev-addurl-kopf" type="button">' + UC.icon("plus", 1.8) + '<span class="uev-addurl-txt">' + esc(t(zieleDa() ? "Add" : "Add URL")) + '</span></button>' +
        '<span class="uev-kopfmehr"></span>';
      elMain.innerHTML =
        '<div class="uev-detail">' +
          '<div class="uev-dkopf" data-sek="kopf"></div>' +
          /* Ein geplantes Event (17.10.): statt Skelett fuer immer ein klarer Zustand. */
          '<section class="uev-geplant" data-sek="geplant"></section>' +
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
                /* "Since event" (17.10.): nur bei offenen Events mit v4, sonst verborgen (segSetzen). */
                '<button class="up-seg-btn uev-fenster-seit" type="button" data-fenster="seit" hidden>' + esc(t("Since event")) + '</button>' +
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
          /* Ohne Aussenrahmen wie in Shopping und Ads (07.10. angefordert): .up-kpiband.is-offen. */
          '<div class="up-kpiband is-offen uev-kpis" data-sek="kpis"></div>' +
          /* Der Abschlussbericht einer Kampagne (17.10.): Vorher, Waehrend, Danach an der Stelle
             der Kennzahlen -- dieselben drei Kennzahlen je Abschnitt. */
          '<div class="uev-bericht" data-sek="bericht"></div>' +
          '</div>' +
          '<section class="uev-sek uev-sek-chart">' +
            sekKopf("Performance around event", "How your brand developed in the affected prompts before and after the event.",
              '<div class="up-seg uev-metrik" role="group">' +
                METRIKEN.map(function (m) { return '<button class="up-seg-btn" type="button" data-metrik="' + m.key + '">' + esc(t(m.label)) + '</button>'; }).join("") +
              '</div>') +
            '<div class="up-box uev-chartbox"><div class="up-line-wrap uev-linewrap"><canvas></canvas></div>' +
              '<div class="up-legend uev-legende"></div></div>' +
          '</section>' +
          /* DIE ZIELE DIREKT UNTER DEM CHART, VOR DER MARKTBEWEGUNG (15.10. nachts angefordert:
             "die URL-/Quellen-Sektion direkt unters Chart und ueber Marktbewegung"). Was das Event
             trackt, gehoert zu seiner Wirkung oben; der Markt ist der Blick nach aussen danach.
             Seit 17.10. (Beschluss 6): erst die URL-Ziele ("URLs"), DARUNTER die Regel-Ziele (je Ziel ein
             Abschnitt, renderZiele). Faellt "URLs" weg (es gibt nur Regeln), stehen die Regeln oben. */
          '<section class="uev-sek" data-sek="urls"></section>' +
          '<div class="uev-ziele" data-sek="ziele" hidden></div>' +
          '<section class="uev-sek" data-sek="markt"></section>' +
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
        /* Gefiltert leer (Models, Markets, Intent): der Leerzustand mit Lupe, "No matching data"
           (core, chartLeerHtml) -- leer wegen des Filters ist etwas anderes als noch keine Daten. */
        gefiltert: analyseGefiltert,
        markers: chartMarker,
        /* Die anderen Events im Zeitraum leiser (17.10.): das Event dieser Seite ist der Gegenstand. */
        markerDimmen: true,
        /* Das graue Band des Zeitraums nur hier (Beschluss 4): in allen anderen Charts bleibt der Pin. */
        markerBand: true,
        onMarker: function (id) { if (id && id !== state.eventId) oeffnen(id, true); }
      });
      seitenAnlegen();
      elMain.querySelector(".uev-fenster").addEventListener("click", function (e) {
        var b = e.target.closest("[data-fenster]");
        if (!b) return;
        var seit = b.getAttribute("data-fenster") === "seit", f = seit ? state.fenster : parseInt(b.getAttribute("data-fenster"), 10);
        if (f === state.fenster && seit === seitAktiv(dasEvent())) return;
        state.fenster = f; state.seit = seit; persist();
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
    window.addEventListener("up-intentfilter", function () {
      if (!document.contains(root) || !state.eventId) return;
      analyseAnfordern(); renderDetail();
    });
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
    /* Schraenkt ein Filter die Analyse ein? Models und Markets aus der Leiste des Details, dazu der
       Intent-Filter der App -- dieselbe Frage, die die Seiten an UC.seitenFilterAktiv stellen.
       NICHT "gefiltert" nennen: so heisst schon die Liste der Uebersicht (oben), und eine zweite
       Funktionsdeklaration gleichen Namens im selben Bereich ueberschreibt die erste still -- am
       16.10. bekam die Uebersicht dadurch true statt der Liste und zeigte "No matching events". */
    function analyseGefiltert() {
      return UC.seitenFilterAktiv ? UC.seitenFilterAktiv({ modelle: state.modelle, maerkte: state.maerkte })
        : !!((state.modelle && state.modelle.length) || (state.maerkte && state.maerkte.length));
    }
    /* EV-10 (Audit 17.10.): "First cited" und "New URLs" rechnen ueber die ganze Kohorte, alle Modelle
       und alle Maerkte -- auch bei gesetztem Filter, waehrend Global share, Citation count und
       Share of all citations ihm folgen. Eine leise Zeile, nur wenn ein Filter gesetzt ist. */
    var FILTER_HINWEIS = "First cited and New URLs always cover all models and markets, whatever the filters say.";
    function filterHinweisHtml() {
      return analyseGefiltert() ? '<span class="uev-angabe uev-filterhinweis">' + UC.icon("info", 2) + '<span>' + esc(t(FILTER_HINWEIS)) + '</span></span>' : "";
    }
    function segSetzen() {
      var fb = elMain.querySelectorAll(".uev-fenster [data-fenster]"), ev = dasEvent(), seit = seitAktiv(ev);
      for (var i = 0; i < fb.length; i++) {
        var istSeit = fb[i].getAttribute("data-fenster") === "seit";
        if (istSeit) fb[i].hidden = !seitMoeglich(ev);
        fb[i].classList.toggle("is-active", istSeit ? seit : !seit && parseInt(fb[i].getAttribute("data-fenster"), 10) === state.fenster);
      }
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
      if (!d || istWatch(d)) return [];   /* Citation Tracking hat kein Datum und keine Pins (19.10.) */
      /* Eine Kampagne als Band (17.10.): von ihrem ersten bis zum letzten Tag mit phase "during"
         im Verlauf (Vertrag B.2), sonst aus windows, zuletzt aus end_date -- core zeichnet es
         hinter die Linien und kappt es an den Raendern. */
      var ende = null;
      if (mitEnde(d) && kampagneDa()) {
        var tr = a && isArr(a.trend) ? a.trend : [];
        tr.forEach(function (p) { if (p && p.phase === "during") ende = String(p.day).slice(0, 10); });
        if (!ende && a && a.windows) ende = a.windows.effective_during_to || a.windows.during_to || null;
        if (!ende) ende = d.end_date;
      }
      var l = [{ id: d.id, date: d.event_date, ende: ende, name: d.name, type: d.event_type, color: d.color, fokus: true }];
      if (a && isArr(a.overlaps) && (!UC.getPref || UC.getPref("event_markers") !== "off")) {
        a.overlaps.forEach(function (o) {
          l.push({ id: o.event_id, date: o.event_date, ende: o.end_date || null, name: o.name, type: o.event_type, color: o.color });
        });
      }
      return l;
    }

    /* DER KOPF DES DETAILS (03.10. neu): dieselbe Sprache wie die Karte -- Band in der Event-Farbe,
       das Zeichen gross als Profilbild, darunter Name, Datum und Typ als zwei Angaben mit Zeichen,
       die Beschreibung und der Umfang mit betonten Zahlen. Ein Kasten, kein lose stehender Text. */
    function renderKopf() {
      var el = elMain.querySelector('[data-sek="kopf"]');
      var d = dieDetail() || mitZielen(listeEvent(state.eventId));
      if (!d) {
        el.innerHTML = state.detailFehler
          ? '<div class="uev-fehlerkopf">' + (UC.leseFehlerHtml ? UC.leseFehlerHtml("the event") : esc(t("This event could not be loaded."))) +
              '<button type="button" class="up-btn-sec uev-zurueck">' + esc(t("Back to overview")) + '</button></div>'
          : '<div class="up-box uev-hero is-sk"><div class="uev-hero-band uev-sk-band"></div><div class="uev-hero-body">' +
              '<span class="uev-avatar is-gross uev-sk-avatar"></span><span class="uev-sk uev-sk-titel" style="width:36%"></span>' +
              '<span class="uev-sk uev-sk-meta" style="width:22%"></span><span class="uev-sk uev-sk-text" style="width:58%"></span></div></div>';
        elAktion.querySelector(".uev-kopfmehr").innerHTML = "";
        pinKnopfSetzen(null);
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
            (istWatch(d) ? '' : umfangHtml(d, "uev-hero-zahlen")) +
          '</div>' +
        '</div>';
      elAktion.querySelector(".uev-kopfmehr").innerHTML = mehrMenue(d, "kopf");
      pinKnopfSetzen(d);
    }

    /* ---- AN DIE SEITENLEISTE HEFTEN (16.10. angefordert: "im Event-Detail oben in der Kopfleiste
       und direkt in Schritt 4 unter der Vorschau") -----------------------------------------------
       Die Liste gehoert der Seitenleiste (sidebar.js, "Pinned", teamgebunden im localStorage) --
       hier nur derselbe Weg wie aus jedem Drawer (window.upstreemPinToSidebar), dazu Abfrage und
       Abnehmen. Ohne Seitenleiste auf der Seite gibt es weder Knopf noch Schalter: ein Knopf, der
       nichts bewirken kann, waere einer zu viel. Name, Zeichen und Farbe haelt die Leiste selbst
       aktuell (Event-Store), geloeschte Events nimmt sie heraus. */
    function pinDa() { return typeof window.upstreemPinToSidebar === "function"; }

    /* ---- "NOTIFY ME" (17.10., Meldungen je Event) ------------------------------------------
       Je Nutzer und Event (set_impact_event_notify_v1), Standard an. Im Detail als Zeile im Menue
       "..." neben Bearbeiten, Anheften und Loeschen, im Anlegen als Schalter unter "Pin to
       sidebar". Ein Satz sagt, was man bekommt -- ohne Fachwort. Kampagnen (mit Enddatum, Teil B)
       melden zusaetzlich ihren Abschluss. */
    function istKampagne(x) { return !!(x && (x.end_date || x.endDatum || x.ende)); }
    function notifySatz(x) {
      return t(istKampagne(x) ? "Get a note when a page is cited for the first time and when the campaign ends."
        : "Get a note when a page is cited for the first time.");
    }
    function notifyAn(ev) {
      var id = ev && ev.id != null ? String(ev.id) : "";
      if (id && Object.prototype.hasOwnProperty.call(MELD_AN, id)) return MELD_AN[id];
      return !(ev && ev.notify === false);
    }
    /* Einmal je Wurzel nach core fragen; kommt "da" erst nach dem Zeichnen, Kopf und Schritt 4
       nachziehen. */
    var meldGefragt = false;
    function meldAnstossen() {
      if (meldGefragt) return;
      meldGefragt = true;
      meldDaFragen(function (da) {
        if (!da) return;
        try { if (state.eventId && dieDetail()) renderKopf(); } catch (e) {}
        notifyNachtragen();
      });
    }
    function notifyZeileHtml(ev) {
      meldAnstossen();
      if (!meldDa() || !ev || ev.id == null) return "";
      var an = notifyAn(ev);
      return '<button type="button" class="up-optrow uev-mehr-notify" role="menuitemcheckbox" aria-checked="' + an + '" data-aktion="notify" data-event-id="' + esc(ev.id) + '">' +
        UC.icon("bell", 2) +
        '<span class="uev-notify-txt"><span class="up-aktionsmenue-lbl">' + esc(t("Notify me")) + '</span>' +
          '<span class="uev-notify-satz">' + esc(notifySatz(ev)) + '</span></span>' +
        '<span class="up-switch' + (an ? " is-on" : "") + '" aria-hidden="true"></span></button>';
    }
    function notifyZeilenSync(id) {
      [].forEach.call(document.querySelectorAll('.uev-mehr-notify[data-event-id="' + String(id).replace(/"/g, "") + '"]'), function (b) {
        var an = MELD_AN[id] !== false;
        b.setAttribute("aria-checked", String(an));
        var sw = b.querySelector(".up-switch");
        if (sw) sw.classList.toggle("is-on", an);
      });
    }
    /* Sofort umgelegt, dann gespeichert; scheitert es, springt der Schalter zurueck und sagt es
       (das ist eine Handlung des Nutzers -- anders als das stille Holen beim Start). still: nach
       dem Anlegen, ohne eigene Meldung. */
    function notifySetzen(id, an, still) {
      id = String(id);
      var vorher = Object.prototype.hasOwnProperty.call(MELD_AN, id) ? MELD_AN[id] : null;
      MELD_AN[id] = !!an;
      notifyZeilenSync(id);
      var tm = team();
      if (!UC.rpc || !tm) return;
      UC.rpc("set_impact_event_notify_v1", { p_team: tm, p_event_id: id, p_notify: !!an }, { timeoutMs: 15000 }).then(function (erg) {
        if (erg && erg.ok) {
          if (!still && UC.toast) UC.toast(t(an ? "Notifications on" : "Notifications off"));
          return;
        }
        if (vorher === null) delete MELD_AN[id]; else MELD_AN[id] = vorher;
        notifyZeilenSync(id);
        if (UC.toast) UC.toast(t("The setting could not be saved. Please try again."), { kind: "error" });
      });
    }
    function istAngeheftet(id) {
      try { return !!(id != null && window.upstreemIsPinned && window.upstreemIsPinned({ type: "event", id: String(id) })); } catch (e) { return false; }
    }
    function eventAnheften(ev, still) {
      if (!pinDa() || !ev || ev.id == null || ev.id === "") return false;
      try {
        return window.upstreemPinToSidebar({ type: "event", id: String(ev.id), label: String(ev.name || ""), icon: zeichen(ev), color: farbe(ev), still: !!still }) !== false;
      } catch (e) { return false; }
    }
    function eventAbheften(id) {
      try { if (window.upstreemUnpinFromSidebar) window.upstreemUnpinFromSidebar({ type: "event", id: String(id) }); } catch (e) {}
    }
    /* Kein gefuelltes Zeichen fuer "angeheftet": den Zustand zeigt der Knopfgrund (aria-pressed,
       core), der Tooltip sagt, was ein Klick tut. Der Knopf wird nur neu gesetzt, wenn ein anderes
       Event offen ist -- renderKopf laeuft bei jeder Lieferung der Liste, und ein ersetzter Knopf
       verloere den Fokus der Tastatur. */
    function pinKnopfSetzen(d) {
      var w = elAktion.querySelector(".uev-kopfpin");
      if (!w) return;
      var id = d && d.id != null && pinDa() ? String(d.id) : "";
      if (w.getAttribute("data-fuer") !== id) {
        w.setAttribute("data-fuer", id);
        w.innerHTML = id ? '<button type="button" class="up-iconbtn uev-pinknopf" aria-pressed="false">' + UC.icon("pin", 2) + '</button>' : "";
      }
      pinKnopfSync();
    }
    function pinKnopfSync() {
      var b = elAktion && elAktion.querySelector(".uev-pinknopf");
      if (!b) return;
      var an = istAngeheftet(state.eventId), lbl = t(an ? "Unpin from sidebar" : "Pin to sidebar");
      var ml = elAktion.querySelector(".uev-mehr-pin .up-aktionsmenue-lbl");
      if (ml) ml.textContent = lbl;
      b.setAttribute("aria-pressed", String(an));
      b.setAttribute("aria-label", lbl);
      b.setAttribute("data-tip", lbl);
    }
    function pinUmschalten() {
      var id = state.eventId;
      if (!id) return;
      if (istAngeheftet(id)) eventAbheften(id);
      else eventAnheften(dieDetail() || listeEvent(id) || { id: id }, false);
      pinKnopfSync();
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

    /* DIE MODELLBASIS (18.10., Runde 3): Kacheln, Wettbewerber, Vergleich und Verlauf rechnen auf den Modellen, zu
       denen die betroffenen Prompts UND die Vergleichsgruppe Daten haben (cohort.shared_models, models_basis
       "shared"). Die Prompts, die auf dieser Menge vergleichbar sind, zaehlt shared_comparable_prompt_count
       (Vergleichsgruppe: comparison_shared_...); ohne die Felder (aeltere Antwort) die bisherigen Zaehler. */
    function kohorteN(c, vergleich) {
      c = c || {};
      var geteilt = c.models_basis === "shared", v = vergleich
        ? (geteilt && num(c.comparison_shared_comparable_prompt_count) != null ? c.comparison_shared_comparable_prompt_count : c.comparison_comparable_prompt_count)
        : (geteilt && num(c.shared_comparable_prompt_count) != null ? c.shared_comparable_prompt_count : c.comparable_prompt_count);
      return num(v);
    }
    /* "ChatGPT, Gemini and Perplexity" */
    function modellSatz(l) {
      var n = l.map(modellName);
      if (n.length < 2) return n.join("");
      return ersetze(t("{a} and {b}"), { a: n.slice(0, -1).join(", "), b: n[n.length - 1] });
    }
    function renderHinweise() {
      var el = elMain.querySelector('[data-sek="hinweise"]'), a = dieAnalyse();
      if (!a) { el.innerHTML = ""; return; }
      var w = a.windows || {}, h = [], ev = dasEvent();
      /* Angaben wie Datum und Typ im Kopf: Zeichen + Text, leise (03.10.: "warum ist jede
         Information in diesen kleinen Chips mit den Punkten davor? Die habe ich sonst nirgendwo"). */
      function angabe(ic, text, tip) {
        return '<span class="uev-angabe"' + (tip ? ' data-tip="' + esc(tip) + '"' : "") + '>' + UC.icon(ic, 2) + '<span>' + esc(text) + '</span></span>';
      }
      /* WOMIT VERGLICHEN WIRD (17.10.), dort, wo sonst der Fenster-Umschalter steht: eine laufende
         Kampagne "bisher" gegen gleich viele Tage davor, die abgeschlossene als Bericht ueber ihren
         Zeitraum, "Since event" mit der Laenge davor, wenn sie gedeckelt ist (Nachtrag 2). */
      if (kampagneDa() && mitEnde(ev) && !istGeplant(ev)) {
        var lk = num(w.campaign_days) || tagAnzahl(ev);
        if (istFertig(ev)) h.push(angabe("checkCircle", ersetze(t("Campaign report, {range}"), { range: zeitraum(ev.event_date, ev.end_date) })));
        else if (lk) h.push(angabe("activity", ersetze(t("So far, compared with the {n} days before the start"), { n: zahl(lk) })));
      }
      /* "Since event" erkennt die Antwort selbst: windows.window = "since" (sonst "days" bzw. "campaign").
         Das Vorher ist dann gleich lang wie das Nachher, hoechstens 183 Tage -- before_capped sagt,
         dass es gekuerzt wurde, before_days, auf wie viele. */
      if (w.window === "since" && w.before_capped === true) h.push(angabe("info", ersetze(t("Compared with the {n} days before the event"), { n: zahl(num(w.before_days) || KAMPAGNE_TAGE) })));
      /* Ein unvollstaendiges "Nachher" (Audit EV-02): ein Event von gestern mit 30 Tagen waehlen
         zeigt Zahlen aus EINEM Tag -- sie sahen aus wie ein 30-Tage-Vergleich. after_observed_days
         zaehlt die Tage mit Daten, after_days die gewaehlte Laenge; after_complete false heisst
         "noch nicht alle da". Bei Kampagnen sagt es der Satz oben (bisher, Nachlauf). */
      var nach = num(w.after_observed_days), nachSoll = num(w.after_days);
      if (w.mode !== "campaign" && w.after_complete === false && nach != null && nachSoll != null && nach < nachSoll)
        h.push(angabe("info", ersetze(t("{n} of {m} days after the event observed so far"), { n: zahl(nach), m: zahl(nachSoll) }),
          t("The numbers after the event only use the days that have data so far.")));
      /* Auf wie vielen Prompts die Kacheln beruhen (Audit EV-02, zweite Haelfte): "Affected prompts 11" im
         Umfang, aber nur 6 haben vorher UND nachher Laeufe -- die Zahlen daneben stammen aus diesen 6.
         Ohne die Zeile widersprechen sich zwei Zahlen derselben Seite. Nur bei einer Abweichung; bei
         Prompts, die es erst nach dem Event gab, sagt es zusaetzlich der Satz im Umfang. */
      var co = a.cohort || {}, cn = kohorteN(co, false), ca = num(co.affected_in_filter_count != null ? co.affected_in_filter_count : co.affected_prompt_count);
      if (cn != null && ca != null && cn > 0 && cn < ca)
        h.push(angabe("info", ersetze(t("Based on {n} of {m} affected prompts"), { n: zahl(cn), m: zahl(ca) }),
          t("Only prompts with data both before and after the event count in these numbers.")));
      var vn = kohorteN(co, true), va = num(co.comparison_prompt_count);
      if (vn != null && va != null && vn > 0 && vn < va)
        h.push(angabe("info", ersetze(t("Comparison based on {n} of {m} prompts"), { n: zahl(vn), m: zahl(va) }),
          t("Only prompts with data both before and after the event count in these numbers.")));
      if (w.limited_baseline === true) h.push(angabe("info", ersetze(t("Limited baseline ({n} days)"), { n: zahl(w.before_observed_days) }),
        t("Less historical data is available before this event for the selected period.")));
      /* EV-15 (Audit 17.10., Verdacht): "vs. comparison" ist die Differenz zweier Deltas, jedes auf den
         Modellen gerechnet, die auf SEINER Seite vorher UND nachher Daten haben (cohort.comparable_models
         gegen cohort.comparison_comparable_models). Sind die Mengen verschieden, vergleicht die Zahl
         Aepfel mit Birnen -- ohne Hinweis sah sie aus wie ein gleicher Massstab. Die Datenbank soll
         auf der Schnittmenge rechnen (Bericht, "Fuer den DB-Chat"); bis dahin sagt es die Zeile. */
      var cm = a.cohort && a.cohort.comparable_models, cv = a.cohort && a.cohort.comparison_comparable_models;
      /* Seit Runde 3 rechnet die DB selbst auf der Schnittmenge (models_basis): dann gibt es keinen Apfel-Birne-
         Vergleich mehr, und die Zeile "verschiedene Modelle" entfaellt. An ihre Stelle tritt, nur wenn die Basis
         kleiner ist als die Modelle des Teams, EINE leise Angabe "Based on ChatGPT and Gemini" -- ohne Urteil,
         die Erklaerung am Zeiger. Ohne models_basis (aeltere Antwort) bleibt die alte Zeile. */
      var basis = a.cohort && a.cohort.models_basis;
      if (basis === "shared" || basis === "no_shared_models" || basis === "affected") {
        var sm = isArr(a.cohort.shared_models) ? a.cohort.shared_models.filter(Boolean) : [];
        var alle = UC.getModels ? UC.getModels().length : 0;
        if (basis === "shared" && sm.length && (!alle || sm.length < alle))
          h.push(angabe("info", ersetze(t("Based on {models}"), { models: modellSatz(sm) }),
            t("The before and after numbers and the comparison use the models that both groups have data for.")));
      } else if (isArr(cm) && isArr(cv) && cm.length && cv.length && (cm.length !== cv.length || cm.some(function (x) { return cv.indexOf(x) < 0; })))
        h.push(angabe("info", t("The comparison uses different models"), ersetze(t("The affected prompts are measured on {a}, the comparison group on {b}."),
          { a: cm.map(modellName).join(", "), b: cv.map(modellName).join(", ") })));
      /* "Since event" ist seit Runde 3 hoechstens 366 Tage lang (windows.after_capped, after_days): dann steht
         dort die Laenge, nicht ein Datum. ready_from (erster Tag mit Daten nach dem Event) nennt nur der noch
         nicht erreichte Tag: ein Event von heute hat ab morgen Zahlen, ein aelterer hat sie ja schon. */
      if (w.window === "since" && w.after_capped === true) {
        var ad = num(w.after_days);
        h.push(angabe("info", ad != null && ad >= 360 && ad <= 366 ? t("Last 12 months") : ad != null ? ersetze(t("Last {n} days"), { n: zahl(ad) }) : t("Last 12 months"),
          t("Since event covers at most the last 12 months. Older days are left out of the numbers after the event.")));
      }
      var rf = w.ready_from ? tagMs(w.ready_from) : NaN;
      if (isFinite(rf) && rf > tagMs(heuteIso()))
        h.push(angabe("clock", ersetze(t("Reliable from {date}"), { date: datum(String(w.ready_from).slice(0, 10)) }), t("The first day with data after the event.")));
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
      return { wertHtml: kpiWertHtml(feld, m.after), trendHtml: trendHtml(feld, m.delta), fussHtml: fuss };
    }
    /* Der Wert in der Kachel zaehlt hoch wie in Shopping (05.10.): dieselbe Form wie wertHtml, nur
       mit den Zaehl-Markierungen aus core. wertHtml bleibt fuer die Tabellen -- Zellen zaehlen nicht. */
    function kpiWertHtml(feld, v) {
      v = num(v);
      if (v == null || !UC.zaehlHtml) return wertHtml(feld, v);
      if (feld === "sentiment") return UC.sentHtml ? UC.sentHtml(v, { zaehlen: true }) : wertHtml(feld, v);
      if (feld === "rank") return '<span class="up-rank-group">' + HASH + UC.zaehlHtml(v, "num1") + '</span>';
      return UC.zaehlHtml(v, "pct1");
    }
    function renderKpis() {
      var el = elMain.querySelector('[data-sek="kpis"]'), a = dieAnalyse();
      if (!a) {
        el.innerHTML = state.analyseFehler && !state.analyseLaden
          ? '<div class="uev-kpifehler">' + (UC.leseFehlerHtml ? UC.leseFehlerHtml("the analysis") : "") + '</div>'
          : [0, 1, 2].map(function () { return UC.kpiKarteSkelett("uev-kpi"); }).join("");
        return;
      }
      var leer = !(a.cohort && kohorteN(a.cohort, false) > 0);
      el.innerHTML = METRIKEN.map(function (m) {
        var teile = leer ? { wertHtml: '<span class="up-num is-empty">–</span>' } : kpiTeile(m.key, a);
        /* Der Satz unter JEDER Kachel (15.10. nachts): bis dahin stand er nur unter Visibility, und
           Rank und Sentiment zeigten einen nackten Strich ohne Grund. Der Strich bleibt -- er ist der
           Wert einer Kachel ohne Zahl (Vertrag 5: "KPI-Karten - und Noch keine vergleichbaren Daten"). */
        if (leer) teile.fussHtml = esc(t("No comparable data yet"));
        /* Die Fallzahl als zweite Zeile im Fuss: ohne confidence leer. */
        else teile.fussHtml = (teile.fussHtml || "") + fallzahlHtml(fallBlock(a, m.key), m.key);
        /* Nur der Name der Kennzahl (18.10., Nutzer): der Zusatz "(last 30 days)" stand nur hier und passt nicht zum Fenster des
           Events; die Erklaerkarte traegt dann auch den Namen, nicht den Zusatz. */
        teile.label = m.label;
        /* Die drei Kennzahlen in EINEM Kasten: das Kennzahlen-Band aus core (.up-kpiband am
           Behaelter, 04.10.), senkrechte Linien ueber die volle Hoehe. */
        teile.klasse = "uev-kpi";
        return UC.kpiKarte(teile);
      }).join("");
      /* Je Event gemerkt: dasselbe Event noch einmal gezeichnet zaehlt nicht von vorn, ein anderes
         schon. */
      if (UC.hochzaehlen) UC.hochzaehlen(el, "events|" + instanceId + "|" + state.eventId);
    }
    /* ---- GEPLANT UND ABGESCHLOSSEN (17.10., Kampagnen) ---------------------------------------
       Ein geplantes Event hat noch keine Ergebnisse: statt eines Skeletts, das nie endet, der
       Leerzustand aus core mit dem Starttag und dem Weg zum Bearbeiten (geplant ist alles
       aenderbar). Umfang und Ziele stehen darunter im Abschnitt "Event scope". */
    function renderGeplant() {
      var el = elMain.querySelector('[data-sek="geplant"]'), ev = dasEvent();
      if (!el) return;
      if (!istGeplant(ev)) { el.innerHTML = ""; return; }
      el.innerHTML = '<div class="up-box uev-geplant-box">' + UC.leerHtml({ icon: "clock",
        titel: ersetze(t("Starts on {date}"), { date: datum(ev.event_date) }), text: t("Results appear from then on."),
        knopf: t("Edit event"), knopfAttr: 'data-aktion="edit" data-event-id="' + esc(ev.id) + '"' }) + '</div>';
    }
    /* Der Abschlussbericht: drei Abschnitte nebeneinander (am Telefon untereinander), je Abschnitt
       sein Zeitraum und die drei Kennzahlen. "During" und "After" mit dem Trend gegen "Before"
       (delta bzw. delta_post, Vertrag B.2) -- dieselben Chips wie in den Kacheln. Solange der
       Nachlauf laeuft (report_final false), sagt "After" das in einer Zeile. */
    var PHASEN = [
      { key: "before", titel: "Before", wert: "before", delta: "" },
      { key: "during", titel: "During", wert: "after", delta: "delta" },
      { key: "post", titel: "After", wert: "post", delta: "delta_post" }
    ];
    function phasenZeiten(ev, w) {
      var L = num(w.campaign_days) || tagAnzahl(ev) || 0, start = tagMs(w.during_from || ev.event_date);
      var vorL = Math.min(L, 180);
      return {
        before: [w.before_from || (isNaN(start) ? null : isoAus(start - vorL * 864e5)), w.before_to || (isNaN(start) ? null : isoAus(start - 864e5))],
        during: [w.during_from || ev.event_date, w.effective_during_to || w.during_to || ev.end_date],
        post: [w.post_from, w.effective_post_to || w.post_to]
      };
    }
    function renderBericht() {
      var el = elMain.querySelector('[data-sek="bericht"]'), kp = elMain.querySelector('[data-sek="kpis"]');
      var ev = dasEvent(), a = dieAnalyse();
      if (!el) return;
      var an = kampagneDa() && istFertig(ev) && !!a;
      if (kp) kp.hidden = an;
      if (!an) { el.innerHTML = ""; return; }
      var w = a.windows || {}, z = phasenZeiten(ev, w), final = w.report_final === true || ev.report_final === true;
      var leer = !(a.cohort && kohorteN(a.cohort, false) > 0);
      el.innerHTML = PHASEN.map(function (ph) {
        var von = z[ph.key][0], bis = z[ph.key][1];
        var zeilen = METRIKEN.map(function (m) {
          var b = a.affected && a.affected[m.key] ? a.affected[m.key] : {};
          var v = leer ? null : b[ph.wert], d = leer || !ph.delta ? null : num(b[ph.delta]);
          return '<div class="uev-phase-zeile"><dt>' + esc(t(m.label)) + '</dt><dd>' + wertHtml(m.key, v) + (d != null ? trendHtml(m.key, d) : '') + '</dd></div>';
        }).join("");
        var fuss = "";
        /* Bis zum GEPLANTEN Ende des Nachlaufs (post_to), nicht bis heute (effective_post_to). */
        if (ph.key === "post" && !final && (w.post_to || bis)) fuss = ersetze(t("Follow-up period, until {date}"), { date: datum(w.post_to || bis) });
        if (ph.key === "post" && !von) fuss = t("Starts after the campaign ends");
        return '<div class="uev-phase is-' + ph.key + '">' +
          '<div class="uev-phase-kopf"><span class="uev-phase-titel">' + esc(t(ph.titel)) + '</span>' +
            (von && bis ? '<span class="uev-phase-zeit">' + esc(zeitraum(von, bis)) + '</span>' : '') + '</div>' +
          '<dl class="uev-phase-werte">' + zeilen + '</dl>' +
          (fuss ? '<p class="uev-phase-fuss">' + esc(fuss) + '</p>' : '') +
        '</div>';
      }).join("");
    }

    /* Ein Farbwert aus den Marken des Themas -- die Kurve braucht ihn als Zeichenkette. */
    function token(name, sonst) {
      var v = "";
      try { v = String(getComputedStyle(root).getPropertyValue(name) || "").trim(); } catch (e) {}
      return v || sonst;
    }
    /* Traegt irgendeine Reihe wenigstens einen Wert? (null ist eine Luecke, kein Wert.) */
    function mitWert(ds) {
      return ds.some(function (x) { return isArr(x.data) && x.data.some(function (v) { return v != null; }); });
    }
    function renderChart() {
      if (!linie) return;
      var a = dieAnalyse();
      segSetzen();
      if (!a) { if (state.analyseFehler && !state.analyseLaden) linie.meldung(t("This event could not be loaded.")); else linie.skeleton(); return; }
      var tr = isArr(a.trend) ? a.trend : [];
      if (!tr.length) { linie.empty(); return; }
      var feld = state.metrik;
      var aName = (a.affected && a.affected.name) || t("Affected prompts");
      /* Die eigene Linie in der PRIMAERFARBE (03.10.: "Linefarbe in Primaerfarbe. Punkt."): die
         Akzent-Tinte aus core, am Standard die Schriftfarbe des Themas -- dieselbe Quelle wie die
         Kurve in brand-detail. Der Vergleich gestrichelt in der VIERTEN Schriftfarbe (03.10.:
         "heller"). Keine
         Event-Farbe fuer Reihen (Spezifikation 29). */
      var tinte = UC.chartInk ? UC.chartInk(root) : UC.accentInk ? UC.accentInk(root) : token("--vc-text");
      var grau = token("--vc-fourth");
      /* Tage ausserhalb des Beobachtungszeitraums der Marke (trend[].tracked false, 18.10.): kein Wert, keine
         Linie, keine Punkte -- eine Luecke, die Linie bricht ab (__luecken aus core), statt sie zu ueberbruecken
         oder auf 0 zu setzen. Ohne solche Tage bleibt es beim bisherigen Verhalten. */
      var luecken = tr.some(function (p) { return p && p.tracked === false; });
      var ds = [{ label: aName, __id: "affected", __baseColor: tinte, borderColor: tinte, __luecken: luecken,
                  __favicon: a.affected && a.affected.logo_url ? a.affected.logo_url : undefined,
                  data: tr.map(function (p) { return p.tracked === false ? null : num(p["affected_" + feld]); }) }];
      if (a.comparison) {
        ds.push({ label: t("Comparison"), __id: "comparison", __baseColor: grau, borderColor: grau,
                  __dash: true, __luecken: luecken, data: tr.map(function (p) { return p.tracked === false ? null : num(p["comparison_" + feld]); }) });
      }
      /* Tage ohne einen einzigen Wert (alle Laeufe 0, oder die Marke hat in der gewaehlten Kennzahl
         nie einen -- Rank ohne Erwaehnung): sonst ein leeres Achsenkreuz mit dem Pin, eine leere
         Flaeche statt eines Leerzustands (gemessen 15.10. nachts: 61 Tage, 0 Punkte). */
      if (!mitWert(ds)) { linie.empty(); return; }
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
      /* z.info: die Erklaerkarte am Spaltenkopf, wie an jedem Spaltenkopf der App (.up-th-info).
         s: der Schluessel der Sortierung (SORT_ZYKLEN), wie data-sort in Ads und Shopping -- der Kopf
         sortiert im Browser (sortKopfHtml, pagerAnlegen). erste kann { t, s } sein. */
      var e0 = typeof erste === "string" ? { t: erste } : erste;
      return '<div class="up-thead up-vrow"><div class="up-th up-th-vname' + (e0.s ? ' is-sortable" data-sort="' + e0.s : '') + '">' +
          esc(t(e0.t)) + sortZeichenHtml(e0.s) + '</div>' +
        zahlen.map(function (z) {
          return '<div class="up-th uev-th-zahl' + (z.k ? " " + z.k : "") + (z.s ? ' is-sortable" data-sort="' + z.s : '') + '">' + esc(t(z.t)) +
            (z.info ? '<span class="up-th-info uev-erklaer" data-explain="' + esc(z.info) + '">' + UC.icon("info", 2) + '</span>' : '') + sortZeichenHtml(z.s) + '</div>';
        }).join("") + '</div>';
    }
    /* Das Sortierzeichen eines Kopfs: dasselbe Markup wie in Ads und Shopping (.up-thsort, Pfeile aus
       core); den Zustand (is-asc, is-desc, aria-sort) setzt UC.makeHeadSort. */
    function sortZeichenHtml(sort) {
      if (!sort) return "";
      return '<span class="up-thsort" data-for="' + esc(sort) + '">' +
        '<svg class="up-thsort-up" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 15C18 15 13.5811 9.00001 12 9C10.4188 8.99999 6 15 6 15"/></svg>' +
        '<svg class="up-thsort-down" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9"/></svg></span>';
    }
    /* ---- SEITEN STATT SCROLLEN (07.10. angefordert: "die Tabelle Marktbewegung ist scrollbar --
       nicht machen, gleiche Pagination wie in allen anderen Tabellen") -------------------------
       Beide Tabellen des Details (Marktbewegung, URLs) waren .up-vartable mit dem
       scrollenden Koerper aus core (.up-vbody, 7.5 Zeilen). Jetzt der Pager aus core
       (UC.makePager) mit "Rows per page" und Seitenknoepfen, wie in Shopping und Ads.
       Geblaettert wird IM BROWSER: die Analyse liefert competitors[] und urls[] vollstaendig
       (Vertrag 3.9: "jeder Wettbewerber einzeln", "eine Zeile pro Ziel-URL"; kein Limit-Parameter,
       die Mengen sind durch Tarif und impact_event_too_many_urls begrenzt) -- dieselbe Bauart wie
       "Topics with Ads" in ads.js. Das Geruest (Inhalt + Fusszeile) entsteht einmal je Detail in
       baueDetail(), damit der Pager an seiner Fusszeile haengen bleibt; renderMarkt/renderUrls
       schreiben nur noch in den Inhalt. Die Zeilenzahl bleibt beim Wechsel des Events, die Seite
       beginnt wieder bei 1. */
    /* KURZ MIT SEITEN (Beschluss 9, 17.10.): in allen drei Listen des Details (URLs, zitierte URLs je Regel,
       Marktbewegung) 5 Zeilen als Standard und die Groessen 5, 15, 25, 50. Nur hier, ueber cfg.pageSizes --
       die PAGE_SIZES in core gelten fuer die grossen Tabellen der App und bleiben. */
    var SEITEN_GROESSEN = [5, 15, 25, 50], SEITEN_GROESSE = 5;
    var seitenGroesse = {};
    var seiten = {};
    /* DIE SORTIERUNG DER KOEPFE (Beschluss 3): im Browser, die Mengen kommen vollstaendig (hoechstens 200
       je Ziel). Standard: der Wert nach dem Event absteigend, wie bei den Citations. Die Klickfolge je
       Kopf: die sinnvolle Richtung zuerst, dann die andere, dann zurueck zum Standard (UC.makeHeadSort).
       Der Stand lebt je Tabelle (markt, urls, ziel-<id>) ueber den Wechsel von Event und Seite hinaus. */
    var SORT_ZYKLEN = {
      markt: { name: ["name:asc", "name:desc"], before: ["before:desc", "before:asc"], after: ["after:desc", "after:asc"], change: ["change:desc", "change:asc"] },
      urls: { url: ["url:asc", "url:desc"], first: ["first:asc", "first:desc"], gsbefore: ["gsbefore:desc", "gsbefore:asc"],
              gsafter: ["gsafter:desc", "gsafter:asc"], change: ["change:desc", "change:asc"] },
      ziel: { url: ["url:asc", "url:desc"], first: ["first:asc", "first:desc"], citations: ["citations:desc", "citations:asc"],
              prompts: ["prompts:desc", "prompts:asc"], models: ["models:desc", "models:asc"] }
    };
    var SORT_STANDARD = { markt: { field: "after", dir: "desc" }, urls: { field: "gsafter", dir: "desc" }, ziel: { field: "citations", dir: "desc" } };
    var sortStand = {}, sortKit = {};
    function sortArt(n) { return n === "markt" ? "markt" : n === "urls" ? "urls" : "ziel"; }
    function sortVon(n) {
      var a = sortArt(n);
      return sortStand[n] || (sortStand[n] = { sortField: SORT_STANDARD[a].field, sortDir: SORT_STANDARD[a].dir });
    }
    /* Sortiert eine Liste nach dem Stand der Tabelle n. wert(zeile, feld) liefert die Zahl, den Text oder null;
       null steht in jeder Richtung am Ende (kein Wert ist weder gross noch klein), gleiche Werte behalten ihre
       Reihenfolge. */
    function sortiere(n, liste, wert) {
      var st = sortVon(n), f = st.sortField, mal = st.sortDir === "asc" ? 1 : -1;
      return liste.map(function (x, i) { return { x: x, i: i, v: wert(x, f) }; }).sort(function (p, q) {
        var a = p.v, b = q.v;
        if (a == null || b == null) return a == null && b == null ? p.i - q.i : a == null ? 1 : -1;
        var c = typeof a === "string" || typeof b === "string" ? String(a).localeCompare(String(b), undefined, { sensitivity: "base", numeric: true }) : a - b;
        return c ? c * mal : p.i - q.i;
      }).map(function (p) { return p.x; });
    }
    function fussHtml() {
      return '<div class="up-foot uev-foot" hidden>' +
          '<div class="up-pagesize"><span class="up-pagesize-lbl">' + esc(t("Rows per page")) + '</span>' +
            '<div class="up-pagesize-seg" role="group" aria-label="' + esc(t("Rows per page")) + '"></div></div>' +
          '<div class="up-pager"></div>' +
        '</div>';
    }
    function seitenAnlegen() {
      seiten = {};
      ["markt", "urls"].forEach(function (n) {
        var el = elMain.querySelector('[data-sek="' + n + '"]');
        if (!el) return;
        el.innerHTML = '<div class="uev-tabinhalt"></div>' + fussHtml();
        pagerAnlegen(el, n, function () { if (n === "markt") renderMarkt(); else renderUrls(); });
      });
    }
    /* Ein Pager an einem Abschnitt, der Inhalt und Fusszeile schon traegt -- auch fuer die
       Abschnitte der Regel-Ziele, die erst mit dem Detail entstehen (15.10.). */
    function pagerAnlegen(el, n, zeichnen) {
      var st = { page: 1, pageSize: seitenGroesse[n] || SEITEN_GROESSE, totalCount: null, loading: false };
      var neu = function () { seitenGroesse[n] = st.pageSize; st.loading = false; zeichnen(); };
      seiten[n] = { st: st, el: el, kit: UC.makePager ? UC.makePager({ root: el, state: st, onChange: neu, pageSizes: function () { return SEITEN_GROESSEN; } }) : null };
      /* Die Koepfe sortieren (UC.makeHeadSort): ein Wechsel beginnt wieder bei Seite 1. */
      if (UC.makeHeadSort) {
        var ss = sortVon(n), a0 = sortArt(n);
        sortKit[n] = UC.makeHeadSort({ root: el, state: ss, cycles: SORT_ZYKLEN[a0], defaultSort: SORT_STANDARD[a0],
          onSort: function (f, d) { ss.sortField = f; ss.sortDir = d; st.page = 1; st.loading = false; zeichnen(); } });
      }
      /* Die Klicks der Fusszeile wie in Shopping und Ads -- der Pager aus core zeichnet nur. */
      el.addEventListener("click", function (e) {
        var k = seiten[n] && seiten[n].kit;
        var so = e.target.closest && e.target.closest(".up-th.is-sortable[data-sort]");
        if (so && sortKit[n] && el.contains(so)) { sortKit[n].headSortClick(so.getAttribute("data-sort")); return; }
        if (!k || !e.target.closest || !e.target.closest(".uev-foot")) return;
        var ps = e.target.closest("[data-pagesize]");
        if (ps) { k.setPageSize(Number(ps.getAttribute("data-pagesize"))); return; }
        if (e.target.closest(".up-page-prev")) { k.goToPage(st.page - 1); return; }
        if (e.target.closest(".up-page-next")) { k.goToPage(st.page + 1); return; }
        var pg = e.target.closest(".up-page[data-page]");
        if (pg) k.goToPage(Number(pg.getAttribute("data-page")));
      });
    }
    /* Der Inhalt einer Tabelle (Kopf, Tabelle) -- die Fusszeile bleibt stehen. */
    function tabInhalt(n) {
      var el = elMain.querySelector('[data-sek="' + n + '"]');
      return el ? (el.querySelector(".uev-tabinhalt") || el) : null;
    }
    /* Fusszeile zeichnen und den Ausschnitt der aktuellen Seite liefern. total null: keine Fusszeile
       (Skelett, Leerzustand). Wie ueberall: sichtbar, sobald es Zeilen gibt -- auch bei einer Seite. */
    function seitenStand(n, total) {
      var s = seiten[n], el = (s && s.el) || elMain.querySelector('[data-sek="' + n + '"]');
      var foot = el ? el.querySelector(".uev-foot") : null;
      if (foot) foot.hidden = !(total > 0);
      if (!s || !(total > 0)) return { von: 0, bis: total || 0 };
      s.st.totalCount = total; s.st.loading = false;
      var max = Math.max(1, Math.ceil(total / s.st.pageSize));
      if (s.st.page > max) s.st.page = max;
      if (s.kit) { try { s.kit.renderPageSize(); s.kit.renderPager(); } catch (e) {} }
      var von = (s.st.page - 1) * s.st.pageSize;
      return { von: von, bis: von + s.st.pageSize };
    }
    function sortSync(n) { if (sortKit[n]) { try { sortKit[n].syncHeadSorters(); } catch (e) {} } }
    function renderMarkt() {
      var el = elMain.querySelector('[data-sek="markt"]'), a = dieAnalyse();
      var platz = tabInhalt("markt");
      var titel = "Market movement", desc = "Visibility of every tracked brand in the affected prompts, before and after.";
      /* Ohne Analyse wegen eines Fehlers: der Abschnitt faellt weg. Den Fehler sagen schon die
         Kennzahlen und das Diagramm darueber -- ein drittes Mal waere Laerm. */
      if (!a && state.analyseFehler && !state.analyseLaden) { platz.innerHTML = ""; seitenStand("markt", null); el.hidden = true; return; }
      el.hidden = false;
      var kopf = tabKopf({ t: "Brand", s: "name" }, [{ t: "Before", s: "before" }, { t: "After", s: "after" }, { t: "Change", s: "change" }]);
      if (!a) {
        /* Skelett mit DENSELBEN Zellklassen wie die Zeilen, in .up-tbody -- nur dort nimmt core der
           letzten Zeile die Unterkante (sonst doppelt mit dem Rahmen, 03.10. gemeldet). */
        platz.innerHTML = sekKopf(titel, desc) + '<div class="up-vartable uev-markt">' + kopf + '<div class="up-tbody up-vbody">' +
          (UC.skeletonRows ? UC.skeletonRows({ count: 3, rowClass: "up-row up-vrow", cellClass: "up-td",
            cols: [{ w: 110, jitter: 30, logo: true, cls: "up-var-name uev-td-marke" }, { w: 44, cls: "uev-td-zahl", zahl: true }, { w: 44, cls: "uev-td-zahl", zahl: true }, { w: 40, cls: "uev-td-zahl", zahl: true }] }) : "") +
          '</div></div>';
        seitenStand("markt", null);
        sortSync("markt");
        return;
      }
      /* Ohne Wettbewerber keine Tabelle (Spezifikation 85) -- eine Tabelle mit nur der eigenen
         Zeile ist kein Markt. Aber auch kein Verschwinden mehr (15.10. nachts): der Abschnitt hatte
         eben noch sein Skelett gezeigt, und ein Skelett, das wortlos wieder geht, sieht aus wie ein
         Fehler -- und alles darunter rutschte hoch. Stattdessen der Leerzustand aus core im Kasten,
         wie bei den Zielen. Der Satz nennt beide Gruende ohne sie zu unterscheiden: keine
         Wettbewerber getrackt, oder noch keiner in diesen Prompts gesehen. */
      if (!(isArr(a.competitors) && a.competitors.length)) {
        seitenStand("markt", null);
        platz.innerHTML = sekKopf(titel, desc) + '<div class="up-box uev-leerbox">' +
          UC.leerHtml({ icon: "squareStack", titel: "No competitors to compare yet", text: "Competitors you track appear here with their visibility before and after the event." }) + '</div>';
        return;
      }
      var reihen = [], eigene = null;
      if (a.affected) eigene = { du: true, m: a.affected };
      a.competitors.forEach(function (c) { reihen.push({ m: c }); });
      /* Sortiert nach dem Kopf (Standard: After absteigend). Die eigene Marke steht im Standard immer
         oben, darunter der Markt nach After; sortiert der Nutzer nach einer Spalte, ordnet sie sich
         wie jede andere Zeile ein. */
      var sst = sortVon("markt"), standard = sst.sortField === SORT_STANDARD.markt.field && sst.sortDir === SORT_STANDARD.markt.dir;
      var vis = function (r, k) { var v = r.m.visibility || {}; return num(v[k]); };
      var wertMarkt = function (r, f) { return f === "name" ? String(r.m.name || "") : f === "before" ? vis(r, "before") : f === "after" ? vis(r, "after") : vis(r, "delta"); };
      if (eigene && !standard) reihen.push(eigene);
      reihen = sortiere("markt", reihen, wertMarkt);
      if (eigene && standard) reihen.unshift(eigene);
      var ab = seitenStand("markt", reihen.length);
      platz.innerHTML = sekKopf(titel, desc) +
        '<div class="up-vartable uev-markt">' + kopf + '<div class="up-tbody up-vbody">' + reihen.slice(ab.von, ab.bis).map(function (r) {
          var v = r.m.visibility || {};
          /* Ohne Vorher-Wert steht vorher ein Strich und kein Trend -- und kein "Neu getrackt"
             (03.10.: "ein Wert ohne Vorher-Wert ist nicht gleich neu getrackt"). */
          var aend = num(v.before) == null ? "" : trendHtml("visibility", v.delta);
          /* Die Zeile oeffnet die Marke im Drawer der App (04.10.), wie die URL-Zeilen darueber ihr
             URL-Detail -- openDrawer("brand", company_id), derselbe Weg wie url-detail und das
             Power Dashboard. Kein Bubble-Workflow noetig. */
          var cid = r.m.company_id != null ? String(r.m.company_id) : "";
          return '<div class="up-row up-vrow' + (r.du ? " is-du" : "") + (cid ? ' uev-markenzeile" data-company-id="' + esc(cid) + '" role="link" tabindex="0' : "") + '">' +
            '<div class="up-td up-var-name uev-td-marke">' + markeLogo(r.m) + '<span class="up-varname">' + esc(r.m.name || "") + '</span>' +
              (r.du ? '<span class="up-marke up-you">' + esc(t("You")) + '</span>' : '') + '</div>' +
            '<div class="up-td uev-td-zahl">' + wertHtml("visibility", v.before) + '</div>' +
            '<div class="up-td uev-td-zahl">' + wertHtml("visibility", v.after) + '</div>' +
            '<div class="up-td uev-td-zahl">' + aend + '</div></div>';
        }).join("") + '</div></div>';
      sortSync("markt");
    }

    /* "Zuerst zitiert" als leise Marke aus core (.up-marke.is-leise, wie der Typ auf der Karte) --
       03.10.: "in kleinen Chips, einfach nur in Bg, wie sonst auch, und nicht klickbar". Darum kurz:
       die Spalte heisst schon "First cited", der Chip sagt nur noch wann. Nie "noch nie zitiert"
       (Vertrag 5): gezaehlt wird nur in den betroffenen Prompts des eigenen Teams. Zitiert in der
       Schriftfarbe, nicht zitiert zurueckgenommen -- der Text sagt es, die Farbe stuetzt nur. */
    /* still: die Zeile oeffnet nichts (urlZitiert). Der Chip bleibt derselbe wie in jeder anderen Zeile;
       WARUM nichts aufgeht, sagt seit 17.10. erst der Klick auf die Zeile (nichtZitiertHinweis), nicht
       mehr der Zeiger. */
    function beobachtung(o, still) {
      o = o || {};
      var st = o.status, txt, ja = true;
      /* Citation Tracking (19.10.): es gibt keinen Event-Tag -- "zuerst zitiert" ist einfach das Datum, sonst "Not yet". */
      if (istWatch(dasEvent())) {
        /* Vor dem letzten Fenster zitiert: die Rechnung nennt dann kein Datum im Fenster, aber observed_before_event ist wahr. */
        ja = !!o.first_observed_day || o.observed_before_event === true;
        return '<span class="up-marke is-leise uev-beob' + (ja ? " is-ja" : "") + '">' + esc(o.first_observed_day ? datum(o.first_observed_day) : ja ? t("Before this period") : t("Not yet")) + '</span>';
      }
      /* day_number zaehlt die Tage NACH dem Event (Vertrag 3.9: 0 = Event-Tag) -- darum "After 10
         days" und nicht "Day 10", das sich wie ein Wochentag oder ein Zaehler ab 1 las. */
      var n = num(o.day_number);
      if (st === "observed_on_event_day" || (st === "first_observed_after_event" && n === 0 && o.observed_before_event !== true)) txt = t("On event day");
      else if (st === "first_observed_after_event") {
        txt = o.observed_before_event === true ? t("Before event start")
          : ersetze(t(n === 1 ? "After 1 day ({date})" : "After {n} days ({date})"), { n: zahl(n), date: datum(o.first_observed_day) });
      } else if (st === "not_observed_within_6_months") { txt = t("Not within 6 months"); ja = false; }
      else { txt = t("Not yet"); ja = false; }
      return '<span class="up-marke is-leise uev-beob' + (ja ? " is-ja" : "") + '">' + esc(txt) + '</span>';
    }
    /* IST DIESE URL SCHON ZITIERT? (15.10. nachts: "Klick auf eine noch nicht zitierte URL oeffnet
       einen leeren, scheiternden URL-Detail-Drawer"). Das URL-Detail kennt nur Seiten, die das
       eigene Team zitiert hat (url_detail_v1 sonst url_not_found). Zitiert heisst darum: nach dem
       Event beobachtet (first_observed_prompt_run_id, Vertrag 3.9 "Klickbar"), in einem der beiden
       Fenster in Laeufen gesehen (runs_with_url, global_share), in den 183 Tagen davor zitiert
       (observed_before_event) -- oder dem Team schon beim Hinzufuegen bekannt (team_kannte_url).
       Ohne Eintrag in der Analyse (laedt noch, gescheitert, Cache aelter als die URL) zaehlt nur das
       letzte; eine URL, von der niemand weiss, ob es sie zu oeffnen gibt, oeffnet nicht. */
    /* Der Hinweis auf den Klick einer Seite ohne Zitat (Nutzer 17.10.: "Zeile nicht oeffenbar" las sich
       wie ein Fehler). Er sagt, WARUM es noch nichts zu sehen gibt und WANN es etwas gibt: Titel
       "Not cited yet", darunter der Satz. Ein stehender Toast unten, kein Tooltip am Zeiger. */
    function nichtZitiertHinweis(url) {
      /* Die Seite steht mit im Satz, in der Primaerfarbe (Nutzer 18.10.): sonst bleibt offen, WELCHE Zeile gemeint war. */
      var z = url ? urlZeigen(url) : "";
      if (UC.toast) UC.toast(t("Not cited yet"), z
        ? { kind: "neutral", hervor: z, desc: ersetze(t("No AI answer has mentioned {url} so far. As soon as one does, you can open its details here."), { url: z }) }
        : { kind: "neutral", desc: t("No AI answer has mentioned this page so far. As soon as one does, you can open its details here.") });
    }
    function urlZitiert(u, an) {
      if (u && u.team_kannte_url === true) return true;
      if (!an) return false;
      var o = an.observation || {}, r = an.runs_with_url || {}, g = an.global_share || {};
      return !!o.first_observed_prompt_run_id || o.observed_before_event === true ||
        num(r.before) > 0 || num(r.after) > 0 || num(g.before) > 0 || num(g.after) > 0;
    }
    function renderUrls() {
      var el = elMain.querySelector('[data-sek="urls"]'), d = dieDetail(), a = dieAnalyse();
      var platz = tabInhalt("urls");
      /* Ohne Detail kein Abschnitt (statt einer leeren Flaeche mit 40 Abstand darueber): der Kopf
         zeigt sein Skelett, und die Ziele kommen mit dem Detail. */
      if (!d) { platz.innerHTML = ""; seitenStand("urls", null); el.hidden = true; return; }
      var urls = isArr(d.urls) ? d.urls : [];
      if (!urls.length) {
        seitenStand("urls", null);
        /* Nur Regel-Ziele: die stehen als eigene Abschnitte direkt darueber. Ein "No URLs added yet"
           darunter laese sich, als fehle etwas -- der Abschnitt faellt weg. */
        if (regelZiele(d).length) { platz.innerHTML = ""; el.hidden = true; return; }
        el.hidden = false;
        /* Gar kein Ziel: keine leere Analyse-Tabelle (Spezifikation 42), sondern der Leerzustand
           nach Geist im Kasten mit dem Weg, eines anzulegen. Bis 15.10. stand hier die Mini-Form,
           und die laesst Satz und Knopf weg -- uebrig blieb eine graue Zeile ohne Ausweg. Der Knopf
           ist derselbe wie oben im Seitenkopf: ohne Ziele in der Datenbank "Add URL", sonst "Add". */
        var regeln = zieleDa();
        platz.innerHTML = sekKopf("URLs", "") + '<div class="up-box uev-leerbox">' +
          UC.leerHtml({ icon: "link", titel: regeln ? "Nothing tracked yet" : "No URLs added yet",
            text: regeln ? "Add pages, paths or domains to see which of them AI answers cite after the event."
                         : "Add pages, articles or external sources associated with this event.",
            knopf: regeln ? "Add" : "Add URL", knopfAttr: "data-uev-addurl" }) + '</div>';
        return;
      }
      el.hidden = false;
      var proId = {};
      (a && isArr(a.urls) ? a.urls : []).forEach(function (u) { proId[u.id] = u; });
      /* Gescheitert ist die Analyse nur, wenn sie nicht mehr laedt -- dann Striche statt Skelett:
         ein Skelett, das nie endet, sieht aus wie "gleich da" (CLAUDE.md 2). Den Fehler selbst sagen
         Kennzahlen und Diagramm oben. */
      var kaputt = !a && state.analyseFehler && !state.analyseLaden;
      /* Sortiert nach dem Kopf (Standard: Global share after absteigend). Die Werte kommen aus der Analyse;
         ohne sie (laedt noch, gescheitert) bleibt die Reihenfolge der URL-Liste. */
      var wertUrl = function (u, f) {
        var an = proId[u.id], g = an && an.global_share ? an.global_share : null, o = an && an.observation ? an.observation : null;
        if (f === "url") return String(u.url || "");
        if (f === "first") return o ? (o.observed_before_event === true ? -1e15 : o.first_observed_day ? tagMs(String(o.first_observed_day).slice(0, 10)) : null) : null;
        if (f === "gsbefore") return g ? num(g.before) : null;
        if (f === "gsafter") return g ? num(g.after) : null;
        return g ? num(g.delta) : null;
      };
      urls = sortiere("urls", urls, function (u, f) { var v = wertUrl(u, f); return typeof v === "number" && isNaN(v) ? null : v; });
      var ab = seitenStand("urls", urls.length);
      /* EV-08: hostPfad streicht www und Schema -- zwei URL-Ziele, die sich nur darin unterscheiden
         (https://lee-up.de/solar und https://www.lee-up.de/solar: 0 gegen 210 Zitate), stuenden
         sonst gleich da. Nur bei so einer Kollision zeigt die Zeile den Host genau (www., http://). */
      var gleich = {};
      urls.forEach(function (u) { var h = hostPfad(u.url), k = h.host + h.pfad; gleich[k] = (gleich[k] || 0) + 1; });
      var wz = istWatch(d), wtage = num(a && a.windows && a.windows.window_days) || state.fenster || 30;
      platz.innerHTML = sekKopf("URLs", wz ? "Pages and domains you watch. Global share is measured across all your active prompts." : "Pages, articles or external sources associated with this event. Global share is measured in the affected prompts.") +
        '<div class="up-vartable uev-urls">' +
          tabKopf({ t: "URL", s: "url" }, [{ t: "First cited", k: "uev-th-beob", info: wz ? null : "zitiert", s: "first" },
            wz ? { t: ersetze(t("Previous {n} days"), { n: wtage }), s: "gsbefore" } : { t: "Global share before", s: "gsbefore" },
            wz ? { t: ersetze(t("Last {n} days"), { n: wtage }), s: "gsafter" } : { t: "Global share after", s: "gsafter" }, { t: "Change", s: "change" }]) +
          '<div class="up-tbody up-vbody">' + urls.slice(ab.von, ab.bis).map(function (u) {
            var an = proId[u.id], hp = hostPfad(u.url), gs = an && an.global_share ? an.global_share : null;
            var hostTxt = gleich[hp.host + hp.pfad] > 1 ? hostGenau(u.url, hp) : hp.host;
            /* Ohne Eintrag: laedt die Analyse noch, das Skelett; ist sie da, kennt die URL aber
               nicht (gerade hinzugefuegt, Cache aelter), oder ist sie gescheitert, Striche -- und bei
               einer vorhandenen Analyse "Not yet" wie jede nicht beobachtete URL. */
            var sk = !a && !kaputt ? '<span class="up-tsk-bar"></span>' : '<span class="up-num is-empty">–</span>';
            var zit = urlZitiert(u, an);
            var beob = an ? beobachtung(an.observation, !zit) : a ? beobachtung({}, !zit) : sk;
            /* Die ganze Zeile oeffnet das URL-Detail (03.10.), "Remove" faengt seinen Klick selbst ab.
               NICHT ZITIERT (15.10. nachts): eine stille Zeile -- keine Rolle, kein Tab-Halt, kein
               Zeiger, kein Hover-Grund (uev-urlstill in events.css). Der Klick-Weg sucht
               .uev-urlzeile und geht an ihr vorbei; "Remove" bleibt am Hover der Zeile. */
            return '<div class="up-row up-vrow ' + (zit ? 'uev-urlzeile' : 'uev-urlstill') + '" data-url-id="' + esc(u.id) + '" data-url="' + esc(u.url) + '"' + (zit ? ' role="link" tabindex="0"' : '') + '>' +
              /* Der Zeilenknopf sitzt in der ersten Zelle und erscheint am Hover der Zeile -- das
                 Bauteil .up-btn-sec.up-rowbtn aus core, wie "Edit" in brands-overview. Nur "Remove":
                 der Knopf "Responses" filterte die Tabelle darunter und war unverstaendlich (03.10.). */
              '<div class="up-td up-var-name uev-td-url"><span class="up-fav up-logo-box has-img"><img src="' + esc(favicon(u.url)) + '" alt="" loading="lazy" referrerpolicy="no-referrer"/></span>' +
                '<span class="uev-url-txt"><span class="uev-url-haupt" title="' + esc(u.url) + '">' + esc(pfadText(hp)) + '</span>' +
                '<span class="uev-url-host">' + esc(hostTxt) + '</span></span>' +
                '<button type="button" class="up-btn-sec up-rowbtn uev-urlweg" data-url-id="' + esc(u.id) + '" aria-label="' + esc(t("Remove")) + '">' + UC.icon("trash", 2) + '<span>' + esc(t("Remove")) + '</span></button>' +
              '</div>' +
              '<div class="up-td uev-td-zahl uev-td-beob">' + beob + '</div>' +
              '<div class="up-td uev-td-zahl">' + (an ? wertHtml("visibility", gs && gs.before) : sk) + '</div>' +
              '<div class="up-td uev-td-zahl">' + (an ? wertHtml("visibility", gs && gs.after) : sk) + '</div>' +
              '<div class="up-td uev-td-zahl">' + (an ? trendHtml("visibility", gs && gs.delta) : sk) + '</div>' +
            '</div>';
          }).join("") + '</div></div>' +
        (analyseGefiltert() ? '<div class="uev-hinweise uev-urls-hinweis">' + filterHinweisHtml() + '</div>' : '');
      sortSync("urls");
    }

    /* ---- DIE REGEL-ZIELE (15.10., Vertrag Abschnitt 5: targets[] von
       cached_impact_event_analysis_v3) ------------------------------------------------------
       Je Regel (Pfad, Domain) ein eigener Abschnitt: Kopf mit der Schreibweise der Regel, vier
       Kennzahlen im Band aus core (.up-kpiband.is-offen wie oben), der Verlauf (Zitate und neue
       URLs je Tag, UC.makeLine wie das Diagramm darueber, mit dem Pin des Events) und die zitierten
       URLs als .up-vartable mit dem Pager aus core -- dieselben Teile wie der Rest der Seite.
       URL-Ziele behalten die Tabelle "URLs" (urls[], wie bisher).
       Ein Abschnitt entsteht einmal je Ziel und bleibt stehen, solange es das Ziel gibt -- das
       Diagramm darin ueberlebt so jedes Neuzeichnen. */
    var zielLinien = {};
    function regelZiele(d) { return (d && isArr(d.targets) ? d.targets : []).filter(function (x) { return x && x.kind && x.kind !== "url"; }); }
    /* Die Auswertung eines Ziels: nach id (bzw. target_id), sonst nach value, sonst nach der
       Reihenfolge -- der Vertrag nennt die Schluessel je Eintrag nicht ausdruecklich. */
    function zielAuswertung(a, zt, i, alle) {
      var l = a && isArr(a.targets) ? a.targets : null, j;
      if (!l) return null;
      for (j = 0; j < l.length; j++) {
        var x = l[j] || {};
        if ((x.id != null && String(x.id) === String(zt.id)) || (x.target_id != null && String(x.target_id) === String(zt.id))) return x;
      }
      for (j = 0; j < l.length; j++) if (l[j] && l[j].value != null && String(l[j].value) === String(zt.value)) return l[j];
      return l.length === alle.length ? l[i] : null;
    }
    /* Ein Ziel ohne ein einziges Zitat im ganzen Zeitraum: keine zitierte Seite, keine Zitate
       vorher oder nachher, keine neue URL, kein Tag mit Zitaten. matched_url_count wie die Kachel
       "Cited URLs": aus der Auswertung, sonst aus dem Detail. Eine 0 dort ist dann keine Messung,
       die man zeigen muss, sondern "noch nichts da" (15.10. nachts). */
    function zielOhneZitate(z, zt) {
      var mc = z.matched_url_count != null ? num(z.matched_url_count) : num(zt && zt.matched_url_count);
      if (mc > 0 || (isArr(z.cited_urls) && z.cited_urls.length)) return false;
      if (num(z.citations_before) > 0 || num(z.citations_after) > 0 || num(z.new_urls_before) > 0 || num(z.new_urls_after) > 0) return false;
      return !(isArr(z.daily) && z.daily.some(function (p) { return num(p && p.citations) > 0 || num(p && p.new_urls) > 0; }));
    }
    var ART_SATZ = {
      path: "Everything under this path, including pages added later.",
      host: "Every page on this domain, including pages added later.",
      host_all: "Every page on this domain and its subdomains, including pages added later."
    };
    var ART_ZEICHEN = { url: "link", path: "folder", host: "globe", host_all: "globe" };
    /* DAS FAVICON EINES ZIELS (16.10., Nutzer: "Wenn man neue URLs hinzufuegt, die es noch nicht
       gibt, soll er bitte das Favicon mit Google S2 holen. Aktuell zeigt er nur ein Globe-Icon").
       Aus core: UC.faviconUrl (Google S2, Host ohne www, die Unterdomain bleibt -- und immer ueber
       UC.fremdUrl, den Datenschutz-Weg der App) und UC.entityAvatar, die Kachel der Suchzeilen
       direkt darunter. Scheitert das Bild, zeigt die Kachel das Zeichen der Art, wie vorher; die
       Art selbst steht weiter als Text daneben. Gilt fuer jede Art: auch eine Pfad- oder
       Domain-Regel gehoert zu einer Domain. */
    function zielFavUrl(adresse) { return UC.faviconUrl ? UC.faviconUrl(adresse) : ""; }
    function zielKachel(z, rueckfall) {
      var fb = rueckfall || UC.icon(ART_ZEICHEN[z.kind] || "link", 2);
      return UC.entityAvatar ? UC.entityAvatar(zielFavUrl(zielHost(z) || z.input), fb, false, "up-es") : '<span class="uev-ziel-ic">' + fb + '</span>';
    }
    /* Klein, an der Stelle eines 16er-Zeichens (Chip in Schritt 4, Host im Sitemap-Baum): nur das
       Bild. Scheitert es, setzt core den Globus in derselben Groesse an seine Stelle
       (faviconRueckfall, .up-globus-frei) -- keine Luecke, kein zweites Zeichen. */
    function zielFavKlein(adresse, rueckfall) {
      var s = zielFavUrl(adresse);
      return s ? '<img class="uev-fav" src="' + esc(s) + '" width="16" height="16" alt="" loading="lazy" referrerpolicy="no-referrer"/>' : rueckfall;
    }
    function zielShare() { var d = dieDetail() || listeEvent(state.eventId); return istWatch(d) && state.zielMetrik !== "abs"; }
    function zielMetrikSetzen() {
      var bs = elMain.querySelectorAll(".uev-zielmetrik [data-zm]");
      for (var i = 0; i < bs.length; i++) {
        var an = bs[i].getAttribute("data-zm") === (state.zielMetrik === "abs" ? "abs" : "share");
        bs[i].classList.toggle("is-active", an); bs[i].setAttribute("aria-pressed", String(an));
      }
      if (UC.segJetzt) { var sg = elMain.querySelectorAll(".uev-zielmetrik"); for (var j = 0; j < sg.length; j++) { try { UC.segJetzt(sg[j]); } catch (e) {} } }
    }
    /* Die Suche aus core (UC.makeSearch, .up-search) in einer Hinweiszeile: Lupe, die sich zum Feld oeffnet, Esc leert zuerst und schliesst dann,
       eine neue Eingabe beginnt wieder bei Seite 1. st: der Stand der Tabelle (page, query), zeichnen: die Neuanfrage. Genau wie die Suche der
       Werkzeugleisten der Tabellen, mit den Vorgaben des Kerns (ab 2 Zeichen, 400 ms); keine Uebernahme der Zeile (mobileMax 0). */
    function suchenAnlegen(box, st, zeichnen) {
      if (!box) return;
      var input = box.querySelector(".up-search-input");
      st.query = st.query || "";
      var kit = UC.makeSearch ? UC.makeSearch({ root: root, box: box, input: input, state: st, mobileMax: 0, prefix: "uevz",
        onRender: function () {}, onFire: function () { zeichnen(); } }) : null;
      if (!kit) { box.hidden = true; return; }
      box.addEventListener("click", function (e) {
        if (e.target.closest(".up-search-clear")) {
          input.value = ""; st.query = ""; box.classList.remove("has-text");
          kit.cancel(); kit.run();
          try { input.focus(); } catch (x) {}
          return;
        }
        if (e.target.closest(".up-search-btn")) kit.toggle();
      });
      input.addEventListener("input", function () { kit.onInput(); });
      input.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && !input.value) { e.stopPropagation(); if (box.classList.contains("is-open")) kit.toggle(); }
      });
    }
    function zielSekAnlegen(host, zt) {
      var sek = document.createElement("section");
      var x = zielAusDb(zt) || { zeigen: String(zt.value || "") };
      sek.className = "uev-sek uev-zielsek";
      sek.setAttribute("data-ziel-id", String(zt.id));
      sek.innerHTML =
        '<div class="up-sec-head uev-sec-head"><div class="up-sec-titles">' +
            '<span class="up-heading up-sec-h uev-ziel-h"><span class="uev-ziel-ic">' + UC.icon(ART_ZEICHEN[zt.kind] || "link", 2) + '</span>' +
              '<span class="uev-notation is-titel">' + esc(x.zeigen) + '</span></span>' +
            '<span class="up-sec-sub">' + esc(t(ART_SATZ[zt.kind] || ART_SATZ.path)) + '</span>' +
          '</div>' +
          '<button type="button" class="up-btn-sec uev-zielweg" data-ziel-id="' + esc(zt.id) + '">' + UC.icon("trash", 2) + '<span>' + esc(t("Remove")) + '</span></button>' +
        '</div>' +
        '<div class="uev-ziel-block">' +
          /* is-4 aus core: vier Kennzahlen in einer Reihe, schmal zwei mal zwei. Beim Citation Tracking drei (is-3, ohne "New URLs"). */
          '<div class="up-kpiband is-offen ' + (istWatch(dieDetail() || listeEvent(state.eventId)) ? "is-3" : "is-4") + ' uev-zielkpis"></div>' +
          '<div class="up-box uev-chartbox uev-zielchart">' +
            /* Citation Tracking (19.10.): der Share ist die Hauptzahl, die Zahl der Zitate die Option -- bei mehr Prompts steigt sie, ohne dass die Seite besser wird. */
            (istWatch(dieDetail() || listeEvent(state.eventId))
              ? '<div class="up-seg uev-zielmetrik" role="group" aria-label="' + esc(t("Chart shows")) + '">' +
                  '<button type="button" class="up-seg-btn" data-zm="share">' + esc(t("Share")) + '</button>' +
                  '<button type="button" class="up-seg-btn" data-zm="abs">' + esc(t("Citations")) + '</button></div>' : '') +
            '<div class="up-line-wrap uev-linewrap uev-ziel-linie"><canvas></canvas></div><div class="up-legend uev-legende"></div></div>' +
          /* cited_urls_truncated (15.10.): die Tabelle traegt hoechstens 200 URLs, die neuesten. */
          '<div class="uev-hinweise uev-ziel-hinweis" hidden><div class="uev-ziel-info"></div>' +
            '<div class="up-search uev-ziel-suche" hidden>' +
              '<button class="up-iconbtn up-search-btn" type="button" data-tip="' + esc(t("Search URLs")) + '" aria-label="' + esc(t("Search URLs")) + '">' + UC.icon("search", 2) + '</button>' +
              '<div class="up-search-box">' +
                '<input class="up-search-input" type="text" autocomplete="off" spellcheck="false" placeholder="' + esc(t("Search URLs")) + '">' +
                '<button class="up-search-clear" type="button" aria-label="' + esc(t("Clear search")) + '">' + UC.icon("x", 2) + '</button>' +
              '</div>' +
            '</div></div>' +
          '<div class="uev-ziel-tab"><div class="uev-tabinhalt"></div>' + fussHtml() + '</div>' +
          /* Der Leerzustand des ganzen Ziels (zielFuellen, is-leer am Block): statt Kennzahlen,
             Verlauf und Tabelle. Die drei bleiben stehen, nur verborgen -- das Diagramm ueberlebt so
             den Wechsel zurueck, sobald das erste Zitat kommt. */
          '<div class="up-box uev-leerbox uev-zielleer"></div>' +
        '</div>' +
        /* DER ABSCHNITT "SITEMAP" (Beschluss 10, abdFuellen): direkt unter der URL-Tabelle, ausserhalb des
           Blocks -- auch eine Regel ohne ein Zitat (is-leer) hat Seiten, die noch nicht zitiert sind. Verborgen,
           solange die DB die Abdeckung nicht liefert. */
        '<section class="uev-abd-sek" hidden><div class="uev-abd-kopf"></div><div class="uev-abd-satz" hidden></div>' +
          '<div class="uev-abd-zeile"><div class="uev-abd-seg"></div>' +
            '<div class="up-search uev-abd-suche" hidden>' +
              '<button class="up-iconbtn up-search-btn" type="button" data-tip="' + esc(t("Search pages")) + '" aria-label="' + esc(t("Search pages")) + '">' + UC.icon("search", 2) + '</button>' +
              '<div class="up-search-box">' +
                '<input class="up-search-input" type="text" autocomplete="off" spellcheck="false" placeholder="' + esc(t("Search pages")) + '">' +
                '<button class="up-search-clear" type="button" aria-label="' + esc(t("Clear search")) + '">' + UC.icon("x", 2) + '</button>' +
              '</div>' +
            '</div></div>' +
          '<div class="uev-abd-liste"></div></section>';
      host.appendChild(sek);
      var n = "ziel-" + zt.id;
      pagerAnlegen(sek.querySelector(".uev-ziel-tab"), n, function () { renderZiele(); });
      suchenAnlegen(sek.querySelector(".uev-ziel-suche"), seiten[n].st, function () { renderZiele(); });
      suchenAnlegen(sek.querySelector(".uev-abd-suche"), abdSucheSt[String(zt.id)] || (abdSucheSt[String(zt.id)] = { query: "", page: 1, loading: false }), function () { abdAlle(); });
      var lw = sek.querySelector(".uev-ziel-linie");
      zielLinien[zt.id] = UC.makeLine ? UC.makeLine({
        wrap: lw, canvas: lw.querySelector("canvas"), legend: sek.querySelector(".uev-legende"),
        isDark: isDark, gran: function () { return "day"; },
        unit: function () { return zielShare() ? "%" : ""; }, decimals: function () { return zielShare() ? 1 : 0; },
        yOhneDeckel: true, yGanz: true, legendeImmer: true,
        tipLabel: function () { return ""; },
        markers: chartMarker,
        markerDimmen: true,
        /* Das graue Band des Zeitraums nur hier (Beschluss 4): in allen anderen Charts bleibt der Pin. */
        markerBand: true,
        onMarker: function (id) { if (id && id !== state.eventId) oeffnen(id, true); }
      }) : null;
      return sek;
    }
    function renderZiele() {
      var host = elMain.querySelector('[data-sek="ziele"]'), d = dieDetail(), a = dieAnalyse();
      if (!host) return;
      var liste = regelZiele(d), da = {};
      /* Die Abdeckung VOR dem Zeichnen anfragen: so steht e.laedt schon, wenn abdFuellen einen
         gemerkten Stand von vorhin zeigt (die Vorgabe des Umschalters richtet sich nach dem frischen). */
      if (liste.length && state.eventId && !abdGefragt[state.eventId]) { abdGefragt[state.eventId] = 1; abdAnfordern(state.eventId); }
      liste.forEach(function (zt, i) {
        da[String(zt.id)] = 1;
        var sek = null, alle = host.querySelectorAll(".uev-zielsek");
        for (var j = 0; j < alle.length; j++) if (alle[j].getAttribute("data-ziel-id") === String(zt.id)) sek = alle[j];
        if (!sek) sek = zielSekAnlegen(host, zt);
        else if (host.querySelectorAll(".uev-zielsek")[i] !== sek) host.appendChild(sek);   // nur umhaengen, wenn die Reihenfolge es braucht: ein Umhaengen nimmt dem Suchfeld den Fokus
        zielFuellen(sek, zt, zielAuswertung(a, zt, i, liste), a);
        abdFuellen(sek, zt);
      });
      /* Entfernte Ziele: Abschnitt, Diagramm und Pager weg. */
      [].slice.call(host.querySelectorAll(".uev-zielsek")).forEach(function (sek) {
        var id = sek.getAttribute("data-ziel-id");
        if (da[id]) return;
        if (zielLinien[id]) { try { zielLinien[id].destroy(); } catch (e) {} delete zielLinien[id]; }
        delete seiten["ziel-" + id];
        sek.parentNode.removeChild(sek);
      });
      host.hidden = !liste.length;
    }
    function zielFuellen(sek, zt, z, a) {
      var kpis = sek.querySelector(".uev-zielkpis"), linie2 = zielLinien[zt.id], platz = sek.querySelector(".uev-tabinhalt");
      if (istWatch(dieDetail() || listeEvent(state.eventId))) zielMetrikSetzen();
      var n = "ziel-" + zt.id, hinweis = sek.querySelector(".uev-ziel-hinweis");
      /* EV-10: mit gesetztem Filter dazu die leise Zeile, dass "First cited" und "New URLs" ihn nicht
         kennen -- nur, wo die Tabelle und die Kachel auch stehen (nicht im Leerzustand, siehe unten). */
      sek.__filterZeile = z && !zielOhneZitate(z, zt) ? filterHinweisHtml() : "";
      if (hinweis) hinweis.hidden = !sek.__filterZeile;
      var wz = istWatch(dieDetail() || listeEvent(state.eventId)), wtage = num(a && a.windows && a.windows.window_days) || state.fenster || 30;
      /* Citation Tracking: "nachher" gibt es nicht, es gibt das letzte Fenster. */
      var kopf = tabKopf({ t: "URL", s: "url" }, [{ t: "First cited", k: "uev-th-beob", s: "first" },
        { t: wz ? ersetze(t("Citations ({n}d)"), { n: wtage }) : "Citations after", s: "citations" }, { t: "Prompts", s: "prompts" }, { t: "Models", s: "models" }]);
      /* EIN Leerzustand fuer das ganze Ziel statt vier Nullen, einer flachen Linie und einer grauen
         Zeile (15.10. nachts gemessen: so sah ein Ziel ohne ein einziges Zitat aus). html "" zeigt
         Kennzahlen, Verlauf und Tabelle wie bisher. */
      var block = sek.querySelector(".uev-ziel-block"), leerEl = sek.querySelector(".uev-zielleer");
      function leerZeigen(html) {
        if (block) block.classList.toggle("is-leer", !!html);
        if (leerEl) leerEl.innerHTML = html || "";
      }
      var zeichen = ART_ZEICHEN[zt.kind] || "link";
      /* Die Zitate dieser Regel nach URL, fuer die Zahl rechts an den zitierten Seiten im Abschnitt Sitemap. */
      sek.__zitate = {};
      leerZeigen("");
      if (!a) {
        /* Die Analyse laeuft noch (oder ist gescheitert -- das sagen Kennzahlen und Diagramm oben
           schon, hier also leer statt ein drittes Mal). */
        var fehler = state.analyseFehler && !state.analyseLaden;
        kpis.innerHTML = fehler ? "" : [0, 1, 2, 3].map(function () { return UC.kpiKarteSkelett("uev-kpi"); }).join("");
        if (linie2) { if (fehler) linie2.meldung(t("This event could not be loaded.")); else linie2.skeleton(); }
        platz.innerHTML = fehler ? "" : '<div class="up-vartable uev-zielurls">' + kopf + '<div class="up-tbody up-vbody">' +
          (UC.skeletonRows ? UC.skeletonRows({ count: 3, rowClass: "up-row up-vrow", cellClass: "up-td",
            cols: [{ w: 160, jitter: 40, logo: true, cls: "up-var-name uev-td-url" }, { w: 80, cls: "uev-td-zahl uev-td-beob" }, { w: 40, cls: "uev-td-zahl", zahl: true }, { w: 30, cls: "uev-td-zahl", zahl: true }, { w: 30, cls: "uev-td-zahl", zahl: true }] }) : "") +
          '</div></div>';
        seitenStand(n, null);
        sortSync(n);
        return;
      }
      if (!z || zielOhneZitate(z, zt)) {
        /* !z: die Analyse ist da, kennt dieses Ziel aber nicht (v2 ohne targets[], oder das Ziel
           ist gerade erst dazugekommen und der Cache noch alt) -- ein Satz statt erfundener Nullen.
           Noch keine Auswertung ist ein Leerzustand, kein Fehler (15.10.). Sonst: ausgewertet, aber
           noch kein einziges Zitat. Beide im Leerzustand aus core mit dem Zeichen der Regel, wie im
           Kopf des Abschnitts; die Saetze sind die, die hier schon im Katalog standen ("No data yet"
           aus core) -- kein neuer Schluessel fuer dieselbe Aussage. */
        kpis.innerHTML = "";
        platz.innerHTML = "";
        seitenStand(n, null);
        leerZeigen(UC.leerHtml(!z
          ? { icon: zeichen, titel: "No data yet", text: "The analysis for this rule isn't available yet." }
          : { icon: zeichen, titel: "No cited pages yet", text: "Pages that match this rule appear here as soon as an AI cites them." }));
        return;
      }
      /* Der Fuss der Kachel "New URLs": mit gesetztem Filter sagt der Zeiger, dass er sie nicht
         einschraenkt (EV-10). */
      function neuFuss(html) { return analyseGefiltert() ? '<span data-tip="' + esc(t("Not affected by your filters")) + '">' + html + '</span>' : html; }
      var sb = num(z.share_of_citations_before), sa = num(z.share_of_citations_after);
      kpis.classList.toggle("is-3", wz); kpis.classList.toggle("is-4", !wz);
      var fensterFuss = esc(ersetze(t("Previous and last {n} days"), { n: wtage }));
      /* Citation Tracking (19.10.): drei Kennzahlen, der Share vorn (die relative Zahl), die Zahl der Zitate danach, keine "New URLs". */
      if (wz) kpis.innerHTML = [
        UC.kpiKarte({ label: "Cited URLs", wertHtml: zahlWert(z.matched_url_count != null ? z.matched_url_count : zt.matched_url_count), fussHtml: esc(t("In the whole period")), klasse: "uev-kpi" }),
        UC.kpiKarte({ label: "Share of all citations", vorherHtml: wertHtml("visibility", sb), wertHtml: wertHtml("visibility", sa),
          trendHtml: sb != null && sa != null ? trendHtml("visibility", sa - sb) : "", fussHtml: fensterFuss, klasse: "uev-kpi" }),
        UC.kpiKarte({ label: "Citation count", vorherHtml: zahlWert(z.citations_before), wertHtml: zahlWert(z.citations_after), fussHtml: fensterFuss, klasse: "uev-kpi" })
      ].join("");
      else kpis.innerHTML = [
        UC.kpiKarte({ label: "Cited URLs", wertHtml: zahlWert(z.matched_url_count != null ? z.matched_url_count : zt.matched_url_count), fussHtml: esc(t("In the whole period")), klasse: "uev-kpi" }),
        UC.kpiKarte({ label: "Citation count", vorherHtml: zahlWert(z.citations_before), wertHtml: zahlWert(z.citations_after), fussHtml: esc(t("Before and after the event")), klasse: "uev-kpi" }),
        UC.kpiKarte({ label: "Share of all citations", vorherHtml: wertHtml("visibility", sb), wertHtml: wertHtml("visibility", sa),
          trendHtml: sb != null && sa != null ? trendHtml("visibility", sa - sb) : "",
          fussHtml: fallzahlHtml(fallZiel(z, "share_of_citations"), "share_of_citations"), klasse: "uev-kpi" }),
        /* new_urls_before (15.10.): wie die Zitate vorher und nachher -- so sieht man, ob nach dem
           Event mehr neue Seiten zitiert wurden als davor. Ohne das Feld wie bisher nur nachher. */
        num(z.new_urls_before) != null
          ? UC.kpiKarte({ label: "New URLs", vorherHtml: zahlWert(z.new_urls_before), wertHtml: zahlWert(z.new_urls_after), fussHtml: neuFuss(esc(t("First cited, before and after the event"))), klasse: "uev-kpi" })
          : UC.kpiKarte({ label: "New URLs", wertHtml: zahlWert(z.new_urls_after), fussHtml: neuFuss(esc(t("First cited after the event"))), klasse: "uev-kpi" })
      ].join("");
      var tage = isArr(z.daily) ? z.daily : [];
      /* Citation Tracking (20.10.): die DB liefert die Tage beider Fenster (vorher und letzte, bei 30 Tagen 61), die Kennzahlen und die Tabelle
         vergleichen sie. Die Linie zeigt nur das gewaehlte Fenster: unter "30 days" stehen 30 Tage auf der Achse, nicht 60. Der Beginn
         kommt aus der Analyse (actual_first_after), sonst die letzten wtage Tage. */
      if (wz) {
        var ab = String(a && a.windows && (a.windows.actual_first_after || a.windows.requested_after_from) || "").slice(0, 10);
        tage = ab ? tage.filter(function (p) { return String(p.day).slice(0, 10) >= ab; }) : tage.slice(-wtage);
      }
      if (linie2) {
        /* Ohne Tage oder nur mit Tagen ohne Lauf (alles null): der Leerzustand der Charts, nicht ein
           leeres Achsenkreuz (wie renderChart). */
        if (!tage.some(function (p) { return num(p.runs) !== 0 && (num(p.citations) != null || num(p.new_urls) != null); })) linie2.empty();
        else {
          var tinte = UC.chartInk ? UC.chartInk(root) : UC.accentInk ? UC.accentInk(root) : token("--vc-text");
          var grau = token("--vc-fourth");
          /* Ein Tag ohne Lauf (runs 0) hat KEINE Zahl: citations kommt dort als null (Vertrag
             Abschnitt 5, wie v2), und die neuen URLs dieses Tages sind ebenso keine Beobachtung.
             __luecken aus core: die Linie bricht dort ab, statt den Tag zu ueberbruecken -- eine
             Luecke statt einer 0 und statt eines erfundenen Verlaufs. Vor events_ziele_v2.sql
             kam new_urls dort als 0, seitdem als null (Nachtrag 15.10., Abschnitt 4.1); beides
             wird hier zur Luecke.
             MIT FILTER (Markt, Intent, Modelle) folgen runs und citations dem Filter, new_urls
             aber der ganzen Kohorte: eine neue URL kann auf einen Tag ohne gefilterten Lauf fallen.
             Sie fehlt dann im Verlauf, zaehlt aber in new_urls_before/after. Die Kachel "New URLs"
             nimmt deshalb diese beiden Felder und nie die Summe der Tagesreihe. */
          var ohneLauf = function (p) { return num(p.runs) === 0; };
          /* Citation Tracking: die Linie ist der Share je Tag (Zitate der Seiten durch alle Zitate der Prompts an diesem Tag) oder, als Option,
             die Zahl der Zitate -- keine Linie "New URLs". Ein Tag ohne Nenner hat keine Zahl, die Linie bricht dort ab. */
          if (wz) {
            var alsShare = state.zielMetrik !== "abs";
            linie2.render({ labels: tage.map(function (p) { return String(p.day).slice(0, 10); }), datasets: [
              alsShare
                ? { label: t("Share of all citations"), __id: "share", __baseColor: tinte, borderColor: tinte, __luecken: true, data: tage.map(function (p) {
                    var c = num(p.citations), g = num(p.total_citations);
                    return ohneLauf(p) || c == null || !g ? null : Math.round(c * 1000 / g) / 10; }) }
                : { label: t("Citation count"), __id: "zitate", __baseColor: tinte, borderColor: tinte, __luecken: true, data: tage.map(function (p) { return ohneLauf(p) ? null : num(p.citations); }) }
            ] });
          } else
          linie2.render({ labels: tage.map(function (p) { return String(p.day).slice(0, 10); }), datasets: [
            { label: t("Citation count"), __id: "zitate", __baseColor: tinte, borderColor: tinte, __luecken: true, data: tage.map(function (p) { return ohneLauf(p) ? null : num(p.citations); }) },
            { label: t("New URLs"), __id: "neu", __baseColor: grau, borderColor: grau, __dash: true, __luecken: true, data: tage.map(function (p) { return ohneLauf(p) ? null : num(p.new_urls); }) }
          ] });
        }
      }
      var urls = isArr(z.cited_urls) ? z.cited_urls : [];
      urls.forEach(function (u) { if (u && u.url) sek.__zitate[abdUrlSchluessel(u.url)] = { c: u.citations_after, url: u.url }; });
      var ev = dieDetail() || {}, evTag = String(ev.event_date || "").slice(0, 10);
      var sst = seiten[n] ? seiten[n].st : null, frage = sst ? String(sst.query || "").trim() : "";
      var gesamt = z.cited_urls_total != null ? num(z.cited_urls_total) : urls.length;
      /* DIE LISTE KOMMT SEITENWEISE AUS DER DB (20.10.): get_impact_event_urls_v1 -- Suche und Sortierung ueber ALLE URLs der Regel,
         nur die gezeigte Seite im Netz. Solange es die Funktion nicht gibt (PGRST202) oder in der Vorfuehrung rechnet der Browser
         wie bisher mit den URLs der Analyse. */
      if (urls.length && !demo && UC.rpc && URL_SRV.stand !== false && gesamt > 0) {
        urlServerZeigen(sek, zt, n, platz, kopf, wz, evTag, a);
        return;
      }
      if (!urls.length) {
        /* Zitate im Zeitraum, aber keine einzelne Seite in der Liste (selten -- ohne jedes Zitat
           steht oben schon der Leerzustand des Ziels): die Mini-Form aus core, im Kasten an der
           Stelle der Tabelle, damit sie nicht frei unter dem Diagramm schwebt. */
        urlInfo(sek, null);
        seitenStand(n, null);
        platz.innerHTML = '<div class="up-box uev-leerbox">' + UC.leerHtml({ mini: true, titel: "No cited pages yet" }) + '</div>';
        return;
      }
      /* Im Browser: Suche (URL, ohne Gross/Klein), dann sortiert nach dem Kopf (Standard: Citations after absteigend);
         First cited ist der Tag der ersten Beobachtung, Models die Zahl der Modelle nach dem Event. */
      var alle = urls.length;
      if (frage) {
        var fk = frage.toLowerCase();
        urls = urls.filter(function (u) { return String(u && u.url || "").toLowerCase().indexOf(fk) >= 0; });
      }
      urlInfo(sek, { total: urls.length, alle: alle, frage: frage, gekappt: z.cited_urls_truncated === true });
      if (!urls.length) {
        seitenStand(n, null);
        platz.innerHTML = '<div class="up-box uev-leerbox">' + UC.leerHtml({ mini: true, gefiltert: true, was: "URLs" }) + '</div>';
        return;
      }
      urls = sortiere(n, urls, function (u, f) {
        if (f === "url") return String(u.url || "");
        if (f === "first") { var tg = String(u.first_observed_day || "").slice(0, 10); return tg ? tagMs(tg) : null; }
        if (f === "prompts") return num(u.prompts_after);
        if (f === "models") return isArr(u.models_after) ? u.models_after.length : null;
        return num(u.citations_after);
      });
      var ab = seitenStand(n, urls.length);
      platz.innerHTML = urlTabelleHtml(kopf, urls.slice(ab.von, ab.bis), wz, evTag, frage);
      sortSync(n);
    }
    function zahlWert(v) { v = num(v); return v == null ? '<span class="up-num is-empty">\u2013</span>' : '<span class="up-num">' + esc(zahl(v)) + '</span>'; }
    /* Die Zeilen und die Tabelle der URLs einer Regel -- gleich im Browser- und im Serverweg. */
    function urlTabelleHtml(kopf, zeilen, wz, evTag, q) {
      return '<div class="up-vartable uev-zielurls">' + kopf + '<div class="up-tbody up-vbody">' +
        zeilen.map(function (u) {
          var hp = hostPfad(u.url), tag = String(u.first_observed_day || "").slice(0, 10), neu = !wz && !!tag && !!evTag && tag > evTag;
          var modelle = isArr(u.models_after) ? u.models_after : [];
          /* Die Zeile oeffnet das URL-Detail, wie in der Tabelle der URLs (Beschluss 2). Eine Antwort zeigt
             das Event-Detail gar nicht mehr: sie steht im Drawer der URL. */
          return '<div class="up-row up-vrow uev-zitzeile" role="link" tabindex="0" data-url="' + esc(u.url || "") + '">' +
            '<div class="up-td up-var-name uev-td-url"><span class="up-fav up-logo-box has-img"><img src="' + esc(favicon(u.url)) + '" alt="" loading="lazy" referrerpolicy="no-referrer"/></span>' +
              '<span class="uev-url-txt"><span class="uev-url-haupt" title="' + esc(u.url || "") + '">' + UC.highlight(pfadText(hp), q) + '</span>' +
              '<span class="uev-url-host">' + UC.highlight(hp.host, q) + '</span></span></div>' +
            '<div class="up-td uev-td-zahl uev-td-beob">' + (tag ? '<span class="up-marke is-leise uev-beob' + (neu ? " is-ja" : "") + '">' + esc(datum(tag)) + '</span>' : '<span class="up-num is-empty">–</span>') + '</div>' +
            '<div class="up-td uev-td-zahl">' + zahlWert(u.citations_after) + '</div>' +
            '<div class="up-td uev-td-zahl">' + zahlWert(u.prompts_after) + '</div>' +
            '<div class="up-td uev-td-zahl"' + (modelle.length ? ' data-tip="' + esc(modelle.map(modellName).join(", ")) + '"' : '') + '>' + zahlWert(modelle.length) + '</div>' +
          '</div>';
        }).join("") + '</div></div>';
    }
    /* ---- DIE URL-LISTE JE REGEL AUS DER DB (20.10.) --------------------------------------------------------------------
       get_impact_event_urls_v1 (bubble/events_urls_20_10/urls_v1.sql): eine Seite, Suche (URL und Titel) und Sortierung ueber ALLE
       URLs der Regel, mit den Filtern der Analyse (analyseKoerper). Je Tabelle (ziel-<id>) ein Stand: die letzte Anfrage (sig),
       ihre Antwort und ein Zaehler, damit eine langsame frueher gestellte Antwort eine neuere nie ueberschreibt. URL_SRV.stand:
       null unbekannt, true die Funktion gibt es, false sie fehlt (PGRST202) -- dann rechnet der Browser mit den URLs der Analyse. */
    var URL_SRV = { stand: null }, urlAnf = {};
    /* Die Hinweiszeile ueber der Tabelle: links die Zahl (oder "n von m" bei einer Suche) und der Filterhinweis, rechts die Suche. o null:
       keine Tabelle -- dann nur der Filterhinweis, die Suche ist weg. */
    function urlInfo(sek, o) {
      var hin = sek.querySelector(".uev-ziel-hinweis"), info = sek.querySelector(".uev-ziel-info"), suche = sek.querySelector(".uev-ziel-suche");
      if (!hin || !info) return;
      var filter = sek.__filterZeile || "";
      if (!o) { hin.hidden = !filter && !(suche && (suche.classList.contains("has-text") || suche.contains(document.activeElement))); info.innerHTML = filter; if (suche && !suche.classList.contains("has-text") && !suche.contains(document.activeElement)) suche.hidden = true; return; }
      var text = o.frage ? ersetze(t("{n} of {m} URLs"), { n: zahl(o.total), m: zahl(o.alle) })
        : o.gekappt ? ersetze(t("Showing the newest {n} URLs"), { n: zahl(o.alle) })
        : ersetze(t(o.total === 1 ? "{n} URL" : "{n} URLs"), { n: zahl(o.total) });
      info.innerHTML = '<span class="uev-angabe">' + (o.gekappt ? UC.icon("info", 2) : "") + '<span>' + esc(text) + '</span></span>' + filter;
      hin.hidden = false;
      if (suche) suche.hidden = false;
    }
    function urlServerZeigen(sek, zt, n, platz, kopf, wz, evTag, a) {
      var rec = urlAnf[n] || (urlAnf[n] = { seq: 0, sig: null, daten: null, laedt: false, fehler: false, a: null });
      rec.ctx = { sek: sek, zt: zt, n: n, platz: platz, kopf: kopf, wz: wz, evTag: evTag };
      var s = seiten[n] ? seiten[n].st : { page: 1, pageSize: SEITEN_GROESSE, query: "" }, so = sortVon(n), body = analyseKoerper();
      body.p_target_id = zt.id;
      body.p_query = String(s.query || "").trim() || null;
      body.p_sort = so.sortField; body.p_dir = so.sortDir;
      body.p_limit = s.pageSize; body.p_offset = (s.page - 1) * s.pageSize;
      var sig = JSON.stringify(body);
      if (rec.sig !== sig || rec.a !== a) {
        rec.sig = sig; rec.a = a; rec.laedt = true; rec.fehler = false;
        var seq = ++rec.seq;
        abdRpc("get_impact_event_urls_v1", body).then(function (erg) {
          if (seq !== rec.seq) return;
          rec.laedt = false;
          if (fehltFn(erg)) { URL_SRV.stand = false; rec.sig = null; if (root.isConnected !== false && state.ansicht === "detail") renderZiele(); return; }
          var d = erg.ok && erg.daten && isArr(erg.daten.urls) ? erg.daten : null;
          if (d) { URL_SRV.stand = true; rec.daten = d; rec.fehler = false; } else rec.fehler = true;
          if (root.isConnected !== false && state.ansicht === "detail") urlZeichnen(rec);
        });
      }
      urlZeichnen(rec);
    }
    function urlZeichnen(rec) {
      var c = rec.ctx, d = rec.daten, s = seiten[c.n] ? seiten[c.n].st : null;
      if (!c || !c.platz.isConnected) return;
      if (s) s.loading = false;
      c.platz.classList.toggle("is-laedt", !!rec.laedt);
      if (!d) {
        urlInfo(c.sek, null);
        seitenStand(c.n, null);
        c.platz.innerHTML = rec.fehler ? '<div class="up-fehlerzeile is-on"><span>' + esc(t("The URLs couldn't be loaded.")) + '</span></div>' : '<span class="uev-sk uev-abd-sk"></span>';
        return;
      }
      var total = num(d.total) || 0, alle = num(d.total_all) || 0, frage = String(d.query || "");
      urlInfo(c.sek, { total: total, alle: alle, frage: frage, gekappt: false });
      if (!total) {
        seitenStand(c.n, null);
        c.platz.innerHTML = '<div class="up-box uev-leerbox">' + (frage ? UC.leerHtml({ mini: true, gefiltert: true, was: "URLs" })
          : UC.leerHtml({ mini: true, titel: "No cited pages yet" })) + '</div>';
        return;
      }
      seitenStand(c.n, total);
      /* Die Seite lag hinter dem Ende (die Suche hat weniger Treffer): der Pager hat sie zurueckgesetzt, die Liste holt die richtige. */
      if (s && num(d.offset) !== (s.page - 1) * s.pageSize && !rec.laedt) { urlServerZeigen(c.sek, c.zt, c.n, c.platz, c.kopf, c.wz, c.evTag, rec.a); return; }
      c.platz.innerHTML = urlTabelleHtml(c.kopf, d.urls, c.wz, c.evTag, frage);
      sortSync(c.n);
    }
    /* ---- SEITENABDECKUNG JE REGEL (17.10., Auftrag Teil C, Vorbild: "Seitenindexierung" der
       Google Search Console) ------------------------------------------------------------------
       Im Kopf jedes Regel-Abschnitts: "12 of 43 pages cited" mit duennem Balken, wann die Sitemap
       zuletzt gelesen wurde und "Refresh" (hoechstens einmal je Stunde, die DB sagt wann wieder:
       next_refresh_at). Darunter der Umschalter "Cited | Not cited yet": Cited ist die Tabelle der
       zitierten URLs, die es schon gab; Not cited yet die leise Liste der Seiten aus der Sitemap,
       die noch keine Antwort zitiert hat.
       EIN Abruf je Event beim Oeffnen (get_impact_event_coverage_v1, alle Ziele, Filter
       not_cited, die ersten ABD_LIMIT Seiten je Ziel); "Show N more" holt je Ziel nach. Ohne die
       Funktion (PGRST202) bleibt alles wie bisher (ABD_DA). Ein Lesefehler der Sitemap loescht in
       der DB nichts -- darum steht der Satz dann ueber den zuletzt gelesenen Seiten. */
    /* ABD_LIMIT: so viele Seiten je Ziel kommen beim ersten Abruf -- der Baum der Ordner braucht mehr, als er
       zeigt (die DB erlaubt 200). Sichtbar sind ABD_SICHT Eintraege je Ebene (Ordner, Unterordner und Seiten
       zusammen), dann "Show more" (17.10., Nutzer: "standardmaessig immer 10"). */
    var ABD_LIMIT = 100, ABD_MEHR = 50, ABD_SICHT = 10, abdGefragt = {}, abdUhrId = null;
    /* Ein automatischer Refresh je Event und Seitenaufruf (17.10.): die DB erlaubt einen je Stunde und Event,
       die UI fragt nie in einer Schleife. Der Zustand ist nicht gespeichert -- Neuladen darf es einmal neu
       versuchen. abdFehlerSt: der letzte Ausgang eines Refreshs je Event ({ art: "zeit", bis } oder
       { art: "fehler" }), abdBaumZ: aufgeklappte Ordner und gezeigte Eintraege je Ziel. */
    var abdAuto = {}, abdFehlerSt = {}, abdBaumZ = {}, abdLb = {};
    function abdLesbar(d) { return !!d && typeof d === "object" && isArr(d.targets); }
    function abdZiel(d, id, wert) {
      var l = d && isArr(d.targets) ? d.targets : [], i;
      for (i = 0; i < l.length; i++) if (l[i] && l[i].target_id != null && String(l[i].target_id) === String(id)) return l[i];
      for (i = 0; i < l.length; i++) if (l[i] && wert != null && String(l[i].value) === String(wert)) return l[i];
      return null;
    }
    function abdRpc(fn, o) {
      var tm = team();
      return (tm ? Promise.resolve(tm) : (UC.teamWarten ? UC.teamWarten(10000) : Promise.resolve(""))).then(function (tm2) {
        if (!tm2) return { ok: false, status: 0, fehler: { code: "", message: "", hint: "", details: "" } };
        return UC.rpc(fn, mitTeam(o, tm2), { timeoutMs: 20000 });
      }).then(function (erg) { return erg || { ok: false, status: 0, fehler: {} }; });
    }
    function abdAnfordern(eid, danach) {
      if (demo || ABD_DA.stand === false || !UC.rpc || !eid) { if (danach) danach(); return; }
      var e = state.abd[eid] || (state.abd[eid] = { daten: null, fehler: false, mehr: {} });
      e.laedt = true;
      abdRpc("get_impact_event_coverage_v1", { p_event_id: eid, p_target_id: null, p_filter: "all", p_limit: ABD_LIMIT, p_offset: 0 }).then(function (erg) {
        e.laedt = false;
        if (fehltFn(erg)) { ABD_DA.stand = false; delete state.abd[eid]; }
        else if (erg.ok && abdLesbar(erg.daten)) { ABD_DA.stand = true; e.daten = erg.daten; e.fehler = false; e.mehr = {}; e.filt = {}; e.filtFehler = {}; abdAutoPruefen(eid); }
        /* Gescheitert oder unlesbar: mit einem Stand von vorhin bleibt der stehen (die Seiten sind
           ja nicht falsch), ohne einen steht der Satz statt der Zeile -- nie ein endloses Skelett. */
        else e.fehler = !e.daten;
        persist();
        if (danach) danach();
        if (root.isConnected !== false && state.ansicht === "detail" && state.eventId === eid) abdAlle();
      });
    }
    /* DIE SITEMAP GLEICH LADEN (17.10.): ein Ziel mit Sitemap, das noch nie gelesen wurde (status
       "pending"), wartete bisher auf den Knopf "Refresh" oder auf die naechste Nacht -- direkt nach dem
       Anlegen stand der Abschnitt leer da. Jetzt stoesst die Seite EINEN Refresh an, sobald die DB ihn
       erlaubt (can_refresh) und nur einmal je Event und Seitenaufruf (abdAuto): scheitert er, steht der
       Satz dazu und der Knopf "Try again", nie eine Wiederholung von allein. Nach dem Hinzufuegen eines
       Ziels (setDetail) wird abdAuto fuer das Event frei. */
    function abdAutoPruefen(eid) {
      var e = state.abd[eid], d = e && e.daten;
      if (!d || abdAuto[eid] || e.neuLaeuft || !UC.edge || d.can_refresh !== true) return;
      /* Nur wenn ein Ziel noch nie gelesen wurde UND selbst lesbar ist: ein erstes Lesen, das gerade laeuft
         (busy) oder an der Teamgrenze steht, loest keinen zweiten Abruf aus. */
      if (!(isArr(d.targets) && d.targets.some(function (x) { return x && String(x.status || "") === "pending" && abdSperre(e, d, x).art === ""; }))) return;
      abdAuto[eid] = 1;
      abdAktualisieren(true);
    }
    /* Nur die Teile der Abdeckung neu, nicht die ganzen Ziel-Abschnitte (deren Diagramme blieben
       sonst bei jeder Minute der Sperr-Uhr neu gezeichnet). */
    function abdAlle() {
      var host = elMain.querySelector('[data-sek="ziele"]'), d = dieDetail();
      if (!host || !d) return;
      regelZiele(d).forEach(function (zt) {
        var sek = host.querySelector('.uev-zielsek[data-ziel-id="' + String(zt.id).replace(/"/g, "") + '"]');
        if (sek) abdFuellen(sek, zt);
      });
    }
    /* Die Sperr-Uhr: solange irgendein "Refresh" gesperrt ist, hoechstens eine Minute bis zum Neuzeichnen, am Ende
       frei. Jedes Ziel meldet seine Wartezeit; der fruehere Zeitpunkt gewinnt (vorher stellte das letzte Ziel
       die Uhr, und ein Ziel mit kuerzerer Sperre wartete auf das mit der laengeren). */
    var abdUhrBis = 0;
    function abdUhr(warteMs) {
      if (!(warteMs > 0)) return;
      var bis = Date.now() + Math.min(warteMs, 60000) + 50;
      if (abdUhrId && abdUhrBis <= bis) return;
      if (abdUhrId) clearTimeout(abdUhrId);
      abdUhrBis = bis;
      abdUhrId = setTimeout(function () {
        abdUhrId = null; abdUhrBis = 0;
        if (root.isConnected !== false && state.ansicht === "detail") abdAlle();
      }, bis - Date.now());
    }
    function abdWarteMs(d) {
      var nr = d && d.next_refresh_at ? Date.parse(d.next_refresh_at) : NaN;
      return isFinite(nr) ? nr - Date.now() : 0;
    }
    /* DIE SPERRE JE QUELLE (18.10., Runde 3): die Datenbank sperrt nicht mehr das Event, sondern jede Quelle fuer
       sich -- je Ziel refresh_status (read | locked | skipped), refresh_code (first_read, due | recent | busy,
       team_limit) und next_refresh_at. Neu angelegte Quellen werden sofort gelesen, auch wenn eine andere im
       selben Event gerade gelesen wurde (de.holy.com sofort, weareholy.com bis +1 h).
       Gibt { art, bis }: art "" = lesbar, "recent" (in der letzten Stunde gelesen), "busy" (wird gerade gelesen),
       "team" (Stundengrenze des Teams), "pause" (Wartezeit nach einer 429, fuer das ganze Event). Ist der
       Zeitpunkt vorbei, ist die Quelle frei, auch wenn die Antwort noch das Alte sagt. Ohne die Felder (aeltere
       Fassung der DB) sperrt wie bisher das Event (next_refresh_at oben). */
    function abdSperre(e, d, z) {
      var jetzt = Date.now(), pb = e && e.pauseBis > jetzt ? e.pauseBis : 0;
      var nr = z && z.next_refresh_at ? Date.parse(z.next_refresh_at) : NaN;
      if (z && z.refresh_status != null) {
        var st = String(z.refresh_status), code = String(z.refresh_code || "");
        if ((st === "locked" || st === "skipped") && !(isFinite(nr) && nr <= jetzt)) {
          var zb = code === "busy" && e && e.zeitBudget && z.target_id != null && !!e.zeitBudget[String(z.target_id)];
          return { art: code === "busy" ? "busy" : code === "team_limit" ? "team" : "recent", bis: isFinite(nr) ? nr : (pb || 0), zb: zb };
        }
        return pb ? { art: "pause", bis: pb } : { art: "", bis: 0 };
      }
      var w = d && d.can_refresh === true ? 0 : abdWarteMs(d);
      if ("next_refresh_at" in (d || {}) && w > 0) return { art: "recent", bis: jetzt + w };
      return pb ? { art: "pause", bis: pb } : { art: "", bis: 0 };
    }
    /* "plus 3 cited pages not in your sitemap": mit plus hinter der Zahl der zitierten Seiten, ohne
       plus als eigener Satz (keine Seite der Sitemap trifft die Regel). html mit der Zahl betont. */
    function abdPlusSatz(n, mitPlus) {
      var k = mitPlus ? (n === 1 ? "plus {n} cited page not in your sitemap" : "plus {n} cited pages not in your sitemap")
                      : (n === 1 ? "{n} cited page is not in your sitemap" : "{n} cited pages are not in your sitemap");
      return { text: ersetze(t(k), { n: zahl(n) }), html: esc(t(k)).replace("{n}", '<span class="uev-abd-z">' + esc(zahl(n)) + '</span>') };
    }
    /* "wieder moeglich um 14:32" (bei einem anderen Tag mit Datum davor). */
    function abdUm(ms) {
      var x = new Date(ms), zeit = x.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      return x.toDateString() === new Date().toDateString() ? zeit : datum(isoAus(ms)) + " " + zeit;
    }
    /* DER ABSCHNITT "SITEMAP" (Beschluss 10, 17.10.): ein eigener Abschnitt mit Ueberschrift direkt unter der
       URL-Tabelle jeder Regel, nicht mehr eine graue Zeile im Kopf der Regel. Im Kopf des Abschnitts der Satz
       als Text ("12 of 43 pages cited. Last checked 5 minutes ago." -- KEIN Balken, der Nutzer lehnt
       Fortschrittsbalken ab) und rechts "Refresh" als .up-btn-sec wie "Remove" oben. Darunter, wenn es etwas zu
       sagen gibt, EIN Satz: die Pause ("You can refresh again at 14:20."), ein Fehler (roter Satz, kein Kasten)
       oder die Kuerzung der Sitemap.
       DIE ZAHL IST EINE (Rueckfrage 17.10.): "12 of 43 pages cited" im Satz und "Cited (12)" am Reiter nennen
       dieselben Seiten, naemlich die der Sitemap. Bis dahin zaehlte der Reiter die zitierten Seiten ausserhalb
       der Sitemap mit (cited_count + cited_outside_sitemap), der Satz nicht -- zwei Zahlen fuer eine Sache. Die
       Seiten ausserhalb stehen jetzt allein im Satz ("plus 3 cited pages not in your sitemap"); die Tabelle der
       URLs darueber zeigt sie ohnehin alle.
       Die Reiter "All | Cited | Not cited yet": "All" ist der Standard und kommt mit der Abdeckung selbst
       (p_filter "all"), die anderen zwei holt der erste Klick (p_filter "cited" bzw. "not_cited"). */
    var ABD_FILTER = { alle: "all", zitiert: "cited", offen: "not_cited" };
    /* DIE SUCHE IN DER SITEMAP-LISTE (20.10.): get_impact_event_coverage_v1 mit p_query (coverage_suche.sql, Teilstring der URL ueber ALLE
       Seiten der Quelle). Mit Suche steht eine flache Trefferliste statt des Baums (je 50, "Show more"). Je Ziel, Reiter und Suchtext ein
       Eintrag; er gilt nur fuer den Stand der Abdeckung, aus dem er kam (gen). Fehlt die Funktion (PGRST202), filtert der Browser die
       schon geladenen Seiten und sagt es. */
    var ABD_Q = { stand: null }, abdSucheSt = {}, abdSuche = {};
    function abdSucheRec(zt, tab, q) {
      var e = state.abd[state.eventId], key = state.eventId + "|" + zt.id + "|" + tab + "|" + q.toLowerCase(), rec = abdSuche[key];
      if (rec && e && rec.gen !== e.daten) { delete abdSuche[key]; rec = null; }
      return rec || null;
    }
    function abdSucheHolen(zt, tab, q, mehr) {
      var eid = state.eventId, e = state.abd[eid], key = eid + "|" + zt.id + "|" + tab + "|" + q.toLowerCase();
      if (!e) return;
      var rec = abdSuche[key] || (abdSuche[key] = { pages: [], total: null, laedt: false, fehler: false, lokal: false, gen: e.daten });
      if (rec.laedt) return;
      if (ABD_Q.stand === false || demo) {
        var ds = abdDaten(e, tab), z = ds ? abdZiel(ds, zt.id, zt.value) : null, mm = e.mehr && e.mehr[tab] && e.mehr[tab][zt.id];
        var fk = q.toLowerCase(), alle = z ? (isArr(z.pages) ? z.pages : []).concat(mm && isArr(mm.pages) ? mm.pages : []) : [];
        rec.pages = alle.filter(function (p) { return p && String(p.url || "").toLowerCase().indexOf(fk) >= 0; });
        rec.total = rec.pages.length; rec.lokal = true;
        return;
      }
      rec.laedt = true; rec.fehler = false;
      abdRpc("get_impact_event_coverage_v1", { p_event_id: eid, p_target_id: zt.id, p_filter: ABD_FILTER[tab], p_limit: ABD_MEHR, p_offset: mehr ? rec.pages.length : 0, p_query: q }).then(function (erg) {
        rec.laedt = false;
        if (fehltFn(erg)) { ABD_Q.stand = false; delete abdSuche[key]; if (root.isConnected !== false && state.eventId === eid) abdAlle(); return; }
        var z2 = erg.ok && abdLesbar(erg.daten) ? abdZiel(erg.daten, zt.id, null) : null;
        if (z2 && isArr(z2.pages)) { ABD_Q.stand = true; rec.pages = (mehr ? rec.pages : []).concat(z2.pages); rec.total = num(z2.pages_total); rec.fehler = false; }
        else if (mehr) { if (UC.toast) UC.toast(fehlerText(String((erg.fehler || {}).message || ""), ""), { kind: "error" }); }
        else rec.fehler = true;
        if (root.isConnected !== false && state.eventId === eid) abdAlle();
      });
    }
    function abdSucheHtml(zt, tab, q, zitate) {
      var rec = abdSucheRec(zt, tab, q);
      if (!rec) { abdSucheHolen(zt, tab, q, false); rec = abdSucheRec(zt, tab, q); }
      if (!rec || (rec.laedt && !rec.pages.length)) return '<span class="uev-sk uev-abd-sk"></span>';
      if (rec.fehler) return '<div class="up-fehlerzeile is-on"><span>' + esc(t("Page coverage couldn't be loaded.")) + '</span></div>';
      if (!rec.pages.length) return '<div class="up-box uev-leerbox">' + UC.leerHtml({ mini: true, gefiltert: true, was: "pages" }) + '</div>';
      var total = rec.total != null ? rec.total : rec.pages.length, rest = total - rec.pages.length;
      return '<div class="uev-abd-leise">' + esc(ersetze(t(total === 1 ? "{n} matching page" : "{n} matching pages"), { n: zahl(total) })) +
          (rec.lokal ? " " + esc(t("Only the pages loaded so far were searched.")) : "") + '</div>' +
        '<div class="uev-abd-seiten">' + rec.pages.map(function (p) {
          return abdSeiteHtml(zt, p, { tiefe: 0, name: null, spur: tab === "offen" ? "datum" : "zitat", zitate: zitate, tab: tab, q: q });
        }).join("") + '</div>' +
        (rest > 0 ? '<button type="button" class="up-quietbtn uev-abd-mehr uev-abd-such-mehr" data-ziel-id="' + esc(zt.id) + '"' + (rec.laedt ? ' disabled' : '') + '>' +
          (rec.laedt ? UC.icon("loader", 2) : '') + '<span>' + esc(ersetze(t("Show {n} more"), { n: zahl(Math.min(ABD_MEHR, rest)) })) + '</span></button>' : '');
    }
    function abdTab(zid) { var w = state.abdSeg[zid]; return w === "zitiert" || w === "offen" ? w : "alle"; }
    /* Der Datensatz (Antwort der Abdeckung) zu einem Reiter, oder null, solange er nicht da ist. */
    function abdDaten(e, tab) { return tab === "alle" ? e.daten : (e.filt && e.filt[tab]) || null; }
    function abdFilterHolen(eid, tab) {
      var e = state.abd[eid];
      if (!e || tab === "alle" || (e.filt && e.filt[tab]) || (e.filtLaedt && e.filtLaedt[tab]) || (e.filtFehler && e.filtFehler[tab])) return;
      (e.filtLaedt || (e.filtLaedt = {}))[tab] = true;
      abdRpc("get_impact_event_coverage_v1", { p_event_id: eid, p_target_id: null, p_filter: ABD_FILTER[tab], p_limit: ABD_LIMIT, p_offset: 0 }).then(function (erg) {
        e.filtLaedt[tab] = false;
        if (erg.ok && abdLesbar(erg.daten)) (e.filt || (e.filt = {}))[tab] = erg.daten;
        else (e.filtFehler || (e.filtFehler = {}))[tab] = true;
        persist();
        if (root.isConnected !== false && state.ansicht === "detail" && state.eventId === eid) abdAlle();
      });
    }
    /* Die Hosts, aus denen die gelesene Sitemap besteht (source_hosts, Wunsch an die DB 17.10.): die DB nennt
       die haeufigsten mit Anzahl. Die Form ist nicht festgelegt -- Liste von { host, count } oder von Texten,
       oder eine Tabelle host -> Anzahl; alles drei wird gelesen. Ohne das Feld eine leere Liste. */
    function abdQuellHosts(z) {
      var l = z && z.source_hosts, out = [];
      function eins(h, n) { h = String(h || "").trim().replace(/^www\./i, ""); if (h) out.push({ host: h, n: num(n) }); }
      if (isArr(l)) l.forEach(function (x) {
        if (typeof x === "string") eins(x, null);
        else if (x && typeof x === "object") eins(x.host || x.domain || x.name, x.count != null ? x.count : x.n != null ? x.n : x.pages);
      });
      else if (l && typeof l === "object") Object.keys(l).forEach(function (k) { eins(k, l[k]); });
      return out.map(function (x, i) { return { x: x, i: i }; }).sort(function (p, q) {
        var a = p.x.n, b = q.x.n;
        return a == null && b == null ? p.i - q.i : a == null ? 1 : b == null ? -1 : b - a || p.i - q.i;
      }).map(function (p) { return p.x; }).slice(0, 3);
    }
    /* Ein Host wie in der Regel: ohne www, klein. */
    function abdHostNorm(h) { return String(h || "").toLowerCase().replace(/^www\./, ""); }
    /* Der Satz im Kopf: Zahl der zitierten Seiten, dazu wann zuletzt gelesen wurde. */
    function abdSubSatz(d, z, sp, laeuft) {
      var st = String(z.status || ""), pc = num(z.page_count), cc = num(z.cited_count), aussen = num(z.cited_outside_sitemap), teile = [];
      /* Noch nie gelesen: "wir lesen" nur, wenn es auch geschieht. Steht das Ziel an der Teamgrenze, wird nichts
         gelesen -- dann sagt der Satz darunter wann wieder. Dasselbe, wenn die Sperre eines laufenden Lesens
         (busy) abgelaufen ist und noch nichts da ist: dann liest niemand mehr, der Knopf ist frei. */
      if (st === "pending") teile.push(t(laeuft || (sp && sp.art === "busy" && !sp.zb) ? "We're reading your sitemap for the first time." : "Your sitemap hasn't been read yet."));
      else if (pc > 0 && cc != null) {
        teile.push(ersetze(t(pc === 1 ? "{a} of {b} page cited" : "{a} of {b} pages cited"), { a: zahl(cc), b: zahl(pc) }) + (aussen > 0 ? ", " + abdPlusSatz(aussen, true).text : ""));
      }
      var zeit = z.last_checked_at || d.last_checked_at, wann = zeit && UC.relativeTime ? UC.relativeTime(zeit) : "";
      if (wann && st !== "pending") teile.push(ersetze(t("Last checked {when}"), { when: wann }));
      return teile.map(function (x) { return String(x).replace(/[.\s]+$/, ""); }).join(". ") + (teile.length ? "." : "");
    }
    /* "Refresh" rechts im Kopf: .up-btn-sec wie "Remove". Beim Lesen der Standard-Spinner der App im Knopf
       (.up-btn-spin) und "Refreshing", in der Pause gesperrt (der Satz darunter sagt wann wieder), nach einem
       Fehler "Try again". Ohne next_refresh_at im Vertrag gibt es keinen Knopf: ohne die Sperre gaebe es keinen
       Weg, "gesperrt" ehrlich zu zeigen. */
    function abdKnopfHtml(e, d, z) {
      if (!("next_refresh_at" in d) && !(z && z.refresh_status != null)) return "";
      var sp = abdSperre(e, d, z), laeuft = !!e.neuLaeuft, zu = sp.art !== "" || laeuft, fs = abdFehlerSt[state.eventId] || null;
      var retry = !zu && fs && fs.art === "fehler";
      if (sp.bis) abdUhr(sp.bis - Date.now());
      return '<button type="button" class="up-btn-sec uev-abd-neu' + (laeuft ? " is-busy" : "") + '"' + (zu ? " disabled" : "") + (laeuft ? ' aria-busy="true"' : "") + '>' +
        (laeuft ? '<span class="up-btn-spin" aria-hidden="true"></span>' : UC.icon("refreshCw", 2)) +
        '<span>' + esc(t(laeuft ? "Refreshing" : retry ? "Try again" : "Refresh")) + '</span></button>';
    }
    /* Die Saetze unter dem Kopf: Pause, Fehler, Kuerzung -- je eine Zeile, nur wenn es sie gibt. */
    function abdMeldungenHtml(e, d, z, sp) {
      var eid = state.eventId, st = String(z.status || ""), fs = abdFehlerSt[eid] || null, aus = "";
      /* Je Quelle EIN ruhiger Satz, nie ein Code: gesperrt bis wann (recent, pause), wird gerade gelesen (busy),
         Teamgrenze (team); ein Lesen, das das Zeitbudget der Function sprengte (time_budget), sagt es als
         "nicht fertig gelesen". Ein noch nie gelesenes Ziel, das gerade gelesen wird, sagt es schon im Kopf. */
      var sperrZeit = sp && sp.bis ? ersetze(t("You can refresh again at {time}."), { time: abdUm(sp.bis) }) : "";
      var satz = "";
      if (sp && !e.neuLaeuft) {
        var zb = sp.zb;
        if (sp.art === "recent" || sp.art === "pause") satz = sperrZeit;
        else if (sp.art === "busy") satz = zb ? t("We couldn't finish reading this sitemap.") + (sperrZeit ? " " + sperrZeit : "") : (st === "pending" ? "" : t("This sitemap is being read right now."));
        else if (sp.art === "team") satz = t("Your team has reached its hourly limit for reading sitemaps.") + (sperrZeit ? " " + sperrZeit : "");
      }
      if (satz) aus += '<span class="uev-abd-leise">' + esc(satz) + '</span>';
      if (z.truncated === true && num(z.page_limit) > 0) {
        /* Die DB behaelt die zuletzt geaenderten Seiten (lastmod, neueste zuerst), nicht die ersten
           der Datei; matched_total sagt, wie viele die Regel in der Sitemap trifft. */
        var gesamt = num(z.matched_total);
        aus += '<span class="uev-angabe">' + UC.icon("info", 2) + '<span>' + esc(gesamt > num(z.page_limit)
          ? ersetze(t("The {n} most recently updated of {total} pages"), { n: zahl(z.page_limit), total: zahl(gesamt) })
          : ersetze(t("Only the {n} most recently updated pages"), { n: zahl(z.page_limit) })) + '</span></span>';
      }
      /* Lesefehler der Sitemap (not_found, timeout, too_large, invalid_xml, blocked): EIN Satz fuer alle --
         der naechste Versuch kommt ohnehin morgen von selbst. Rot wie jeder Fehler der App
         (.up-fehlerzeile, kein Kasten). Ein gescheiterter Refresh sagt es auch so. */
      var lesefehler = st && st !== "ok" && st !== "pending";
      var satzFehler = fs && fs.art === "fehler" && !e.neuLaeuft ? t("The sitemap couldn't be refreshed. Please try again later.")
        : lesefehler ? (st === "timeout" ? t("The website took too long to answer. Please try again later.") : t("We couldn't read your sitemap. We'll try again tomorrow.")) : "";
      if (satzFehler) aus += '<div class="up-fehlerzeile is-on uev-abd-fehler"><span>' + esc(satzFehler) + '</span></div>';
      return aus;
    }
    /* Der Schluessel einer URL fuer den Abgleich Sitemap und Zitat: ohne www und Schema, klein, ohne
       Schraegstrich am Ende und ohne Query -- dieselbe Regel wie in der DB (Auftrag C.4). */
    function abdUrlSchluessel(u) {
      try { var x = new URL(String(u)); return x.hostname.toLowerCase().replace(/^www\./, "") + (x.pathname || "/").replace(/\/+$/, "").toLowerCase(); } catch (er) { return String(u || ""); }
    }
    /* Der Link einer Seite der Sitemap (18.10.): die echte Adresse in einem neuen Tab, Unterstreichen beim Ueberfahren
       (events.css). Ohne Schema wird https ergaenzt; ohne Adresse gibt es keinen Link, nur den Text. */
    function abdLinkHtml(url, text, q) {
      var u = String(url || "").trim();
      if (!u) return UC.highlight(text, q);
      if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(u)) u = "https://" + u.replace(/^\/+/, "");
      return '<a class="uev-abd-link" href="' + esc(u) + '" target="_blank" rel="noopener noreferrer">' + UC.highlight(text, q) + '</a>';
    }
    /* opt.tiefe/opt.name: im Baum steht die Seite eingerueckt und mit dem Teil des Pfads nach dem Ordner.
       opt.spur: "zitat" (Reiter All und Cited: bei einer zitierten Seite rechts die Zahl der Zitate, bei einer
       nicht zitierten nichts) oder "datum" (Reiter Not cited yet: das Datum der letzten Aenderung). */
    function abdSeiteHtml(zt, p, opt) {
      opt = opt || {};
      var hp = hostPfad(p.url || ""), weg = !!p.missing_since, zit = p.cited === true;
      var pfad = opt.name != null ? opt.name : zt.kind === "host_all" ? hp.host + (hp.start ? "" : hp.pfad) : pfadText(hp);
      var treffer = zit && opt.zitate ? opt.zitate[abdUrlSchluessel(p.url)] : null;
      var rechts = "";
      if (opt.spur === "datum") {
        var wann = p.lastmod ? ersetze(t("Updated {date}"), { date: datum(p.lastmod) })
          : p.first_seen_at ? ersetze(t("In sitemap since {date}"), { date: datum(p.first_seen_at) }) : "";
        if (wann) rechts = '<span class="uev-abd-datum">' + esc(wann) + '</span>';
      } else if (zit) {
        /* Die Zahl der Seite selbst (citations_after, 18.10.) gilt auch jenseits der 200 neuesten URLs der Tabelle
           darueber; ohne sie (aeltere DB) die der Tabelle. 0 sagt nichts ueber "zitiert": dann das Wort. */
        var c = num(p.citations_after) > 0 ? num(p.citations_after) : treffer && num(treffer.c) > 0 ? num(treffer.c) : null;
        rechts = '<span class="uev-abd-datum uev-abd-zitate">' + esc(c != null ? ersetze(t(c === 1 ? "{n} citation" : "{n} citations"), { n: zahl(c) }) : t("Cited")) + '</span>';
      }
      /* Eine zitierte Seite oeffnet das URL-Detail (Beschluss 2), mit der Schreibweise des Zitats, wenn die
         Tabelle sie kennt. Eine nicht zitierte oeffnet nichts: der Hinweis kommt erst beim KLICK auf die Zeile
         (17.10.), nicht mehr bei jedem Ueberfahren: data-abd-seite, events.js Klickweg. */
      /* DIE MARKE (18.10., Nutzer: "Neu seit dem Event" las sich, als sei die Seite schon aufgetaucht): is_new der DB
         heisst nur, dass die Sitemap die Seite nach dem Eventtag neu fuehrt oder ihr lastmod darauf liegt, NICHT dass
         sie zitiert wurde. Eine nicht zitierte Seite sagt darum "Not cited yet" (im Reiter Not cited yet steht das
         schon im Reiter: keine Wiederholung); eine zitierte, neue sagt, was die DB wirklich weiss. */
      var marke = "";
      if (!zit) { if (opt.tab !== "offen") marke = '<span class="up-marke is-leise uev-abd-marke">' + esc(t("Not cited yet")) + '</span>'; }
      else if (p.is_new === true) marke = '<span class="up-marke is-leise uev-abd-marke" data-tip="' + esc(t("New in the sitemap or updated since the event")) + '">' + esc(t("New or updated")) + '</span>';
      var offen = zit ? ' is-zitiert" role="link" tabindex="0" data-url="' + esc(treffer && treffer.url ? treffer.url : p.url || "") : "";
      return '<div class="uev-abd-seite' + (opt.name != null ? " is-im-baum" : "") + (weg ? " is-weg" : "") + offen + '"' + (zit ? "" : ' data-abd-seite="1" data-url="' + esc(p.url || "") + '"') + (opt.tiefe ? ' style="--uev-tiefe:' + opt.tiefe + '"' : '') + '>' +
        zielFavKlein(p.url || "", '<span class="uev-abd-fav0">' + UC.icon("globe", 2) + '</span>') +
        '<span class="uev-abd-pfad" title="' + esc(p.url || "") + '">' + abdLinkHtml(p.url, pfad, opt.q) + '</span>' +
        marke +
        (weg ? '<span class="up-marke is-leise uev-abd-marke">' + esc(t("No longer in sitemap")) + '</span>' : '') +
        rechts +
      '</div>';
    }
    /* DER BAUM DER SEITEN (17.10.): dieselbe Zerlegung wie im Sitemap-Waehler (smBaum, nicht nachgebaut), nur
       ohne Auswahl -- Ordner klappen auf, Seiten stehen darunter. Je Ebene ABD_SICHT Eintraege (Ordner,
       Unterordner und Seiten zusammen), dann "Show more". Ohne Ordner in den geladenen Seiten steht eine flache
       Liste mit derselben Regel. Der Stand (aufgeklappt, mehr gezeigt) gilt je Ziel UND Reiter. */
    function abdBaumSt(zid) {
      var k = String(state.eventId) + "|" + zid + "|" + abdTab(zid);
      return abdBaumZ[k] || (abdBaumZ[k] = { auf: {}, mehr: {} });
    }
    /* Zitierte Seiten unter einem Ordner (18.10.): die Marke cited der Seite, dieselbe, die den Reiter "Cited" zaehlt. */
    function abdOrdnerZitiert(x, nachLoc) {
      var n = 0;
      x.seiten.forEach(function (sp) { var pg = nachLoc[sp.loc]; if (pg && pg.cited === true) n++; });
      x.kinder.forEach(function (k) { n += abdOrdnerZitiert(k, nachLoc); });
      return n;
    }
    function abdOrdnerHtml(x, offen, tiefe, mitZahl, zitiert) {
      var name = x.art === "host" ? x.host : smOrdnerName(x);
      return '<button type="button" class="uev-abd-ordner" data-abd-klapp="' + esc(x.key) + '" aria-expanded="' + offen + '" style="--uev-tiefe:' + tiefe + '">' +
        UC.icon(offen ? "chevronDown" : "chevronRight", 2) + '<span class="uev-abd-ic">' + UC.icon(offen ? "folderOpen" : "folder", 2) + '</span>' +
        '<span class="uev-abd-pfad">' + esc(name) + '</span>' +
        (mitZahl ? '<span class="uev-abd-datum">' + esc(zitiert != null ? ersetze(t("{n} of {m} cited"), { n: zahl(zitiert), m: zahl(x.n) })
          : ersetze(t(x.n === 1 ? "{n} page" : "{n} pages"), { n: zahl(x.n) })) + '</span>' : '') +
      '</button>';
    }
    function abdEintraege(zt, eintraege, key, st, tiefe, nachLoc, mitZahl, eltern, opt) {
      var sicht = ABD_SICHT + (st.mehr[key] || 0), aus = "";
      eintraege.slice(0, sicht).forEach(function (x) {
        if (x.art === "seite") {
          var name = eltern === undefined ? null : (x.pfad === "/" ? t("Homepage") : x.pfad.slice((eltern && eltern.pfad || "").length) || x.pfad);
          aus += abdSeiteHtml(zt, nachLoc[x.loc] || { url: x.loc }, { tiefe: tiefe, name: name, spur: opt.spur, zitate: opt.zitate, tab: opt.tab });
          return;
        }
        var offen = !!st.auf[x.key];
        aus += abdOrdnerHtml(x, offen, tiefe, mitZahl, mitZahl && opt.tab === "alle" ? abdOrdnerZitiert(x, nachLoc) : null);
        if (offen) aus += abdEintraege(zt, x.kinder.concat(x.seiten), x.key, st, tiefe + 1, nachLoc, mitZahl, x, opt);
      });
      if (eintraege.length > sicht) {
        aus += '<button type="button" class="up-quietbtn uev-abd-mehr-baum" data-abd-baum-mehr="' + esc(key) + '" data-ziel-id="' + esc(zt.id) + '" style="--uev-tiefe:' + tiefe + '">' +
          esc(ersetze(t("Show {n} more"), { n: zahl(Math.min(ABD_SICHT, eintraege.length - sicht)) })) + '</button>';
      }
      return aus;
    }
    /* z: das Ziel in der Antwort des Reiters (tab). Die Seiten sind die der Antwort plus die per "Show more"
       nachgeladenen. zitate: URL-Schluessel -> { c, url } aus der Tabelle der zitierten URLs darueber. */
    function abdListeHtml(zt, z, e, tab, zitate) {
      var mm = e.mehr && e.mehr[tab] && e.mehr[tab][zt.id], seiten = (isArr(z.pages) ? z.pages : []).concat(mm && isArr(mm.pages) ? mm.pages : []);
      var total = num(z.pages_total);
      if (!seiten.length) {
        return '<div class="up-box uev-leerbox">' + UC.leerHtml({ mini: true, titel: tab === "offen" ? (total === 0 ? "Every page from your sitemap is cited." : "No data yet")
          : tab === "zitiert" ? (total === 0 ? "No page from your sitemap is cited yet." : "No data yet") : "No data yet" }) + '</div>';
      }
      var rest = total != null ? total - seiten.length : 0, st = abdBaumSt(zt.id);
      var P = { sm: {} }, nachLoc = {};
      seiten.forEach(function (p) { if (p && p.url) nachLoc[p.url] = p; });
      smBaum(P, seiten.filter(function (p) { return p && p.url; }).map(function (p) { return { loc: p.url, lastmod: String(p.lastmod || p.first_seen_at || "").slice(0, 10) }; }));
      /* DIE REIHENFOLGE KOMMT AUS DER DB (18.10.): bei "all" nach Pfadteilen des Seitenschluessels (ein Ordner direkt
         vor seinen Unterseiten), sonst wie die Liste sie liefert. smBaum sortiert fuer den Waehler anders (Ordner nach
         Name, Seiten nach lastmod): hier nicht -- sonst ruecken beim Nachladen von "Show more" neu geladene Seiten
         nach vorn und die sichtbaren Zeilen springen. Darum nach dem Rang der ersten Seite in der Antwort: eine
         Seite hat ihren Rang, ein Ordner den seiner ersten Seite. */
      var rang = {};
      seiten.forEach(function (pg, i) { if (pg && pg.url && rang[pg.url] == null) rang[pg.url] = i; });
      function rangVon(k) {
        if (k.art === "seite") return rang[k.loc] == null ? 1e9 : rang[k.loc];
        var r = 1e9;
        k.kinder.forEach(function (c) { r = Math.min(r, rangVon(c)); });
        k.seiten.forEach(function (c) { r = Math.min(r, rangVon(c)); });
        return (k.__r = r);
      }
      function nachRang(k) {
        k.kinder.sort(function (a, b) { return a.__r - b.__r; });
        k.seiten.sort(function (a, b) { return rangVon(a) - rangVon(b); });
        k.kinder.forEach(nachRang);
      }
      (P.sm.hosts || []).forEach(rangVon);
      (P.sm.hosts || []).forEach(nachRang);
      (P.sm.hosts || []).sort(function (a, b) { return a.__r - b.__r; });
      var hosts = P.sm.hosts || [], mitOrdnern = hosts.length > 1 || hosts.some(function (h) { return h.kinder.length > 0; });
      /* Die Zahl an einem Ordner nur, wenn alle Seiten geladen sind: sonst stuende dort die Zahl der
         bisher geladenen, und "Show more" machte aus ihr eine andere. */
      var mitZahl = rest <= 0, wurzel, eltern;
      if (!mitOrdnern) { wurzel = seiten.filter(function (p) { return p && p.url; }).map(function (p) { return { art: "seite", loc: p.url }; }); eltern = undefined; }
      else if (hosts.length === 1) { wurzel = hosts[0].kinder.concat(hosts[0].seiten); eltern = hosts[0]; }
      else { wurzel = hosts; eltern = null; }
      var sichtbar = ABD_SICHT + (st.mehr.wurzel || 0);
      var opt = { spur: tab === "offen" ? "datum" : "zitat", zitate: zitate, tab: tab };
      return '<div class="uev-abd-seiten">' + abdEintraege(zt, wurzel, "wurzel", st, 0, nachLoc, mitZahl, eltern, opt) + '</div>' +
        (rest > 0 && wurzel.length <= sichtbar ? '<button type="button" class="up-quietbtn uev-abd-mehr" data-ziel-id="' + esc(zt.id) + '"' + (mm && mm.laedt ? ' disabled' : '') + '>' +
          (mm && mm.laedt ? UC.icon("loader", 2) : '') + '<span>' + esc(ersetze(t("Show {n} more"), { n: zahl(Math.min(ABD_MEHR, rest)) })) + '</span></button>' : '');
    }
    /* Keine passende Seite trotz gelesener Sitemap (page_count 0): der Satz nennt den GRUND. Liefert die DB
       source_total und source_hosts, steht da, was gelesen wurde und wo es liegt -- mit dem Weg, die andere
       Domain als eigenes Ziel zu tracken. Ohne die Felder der freundliche Satz ohne Zahlen. */
    function abdNullHtml(zt, z) {
      var total = num(z.source_total), hosts = abdQuellHosts(z), eigen = abdHostNorm(zielHost(zt)), aussen = num(z.cited_outside_sitemap);
      var imPfad = zt.kind === "path";
      var ziel = imPfad ? String((zielAusDb(zt) || {}).zeigen || zt.value || eigen) : (eigen || String(zt.value || ""));
      var plus = aussen > 0 ? " " + abdPlusSatz(aussen, false).text + "." : "";
      if (total === 0) {
        return UC.leerHtml({ icon: "globe", titel: "Your sitemap lists no pages", text: "We found nothing to read in your sitemap." });
      }
      if (total > 0 && hosts.length) {
        var top = hosts[0].host, gleich = top === eigen || top.slice(-(eigen.length + 1)) === "." + eigen || eigen.slice(-(top.length + 1)) === "." + top;
        var alle = hosts.length === 1 || (hosts[0].n != null && hosts[0].n >= total);
        var wohin = alle ? ersetze(t("all on {hosts}"), { hosts: top }) : ersetze(t("mostly on {hosts}"), { hosts: hosts.map(function (h) { return h.host; }).join(", ") });
        if (!gleich) {
          /* Ist dieser Host schon ein Ziel des Events (de.holy.com neben weareholy.com), gibt es nichts hinzuzufuegen:
             der Satz sagt es, der Knopf entfaellt (er liefe im Dialog auf "Already in this event"). */
          var schon = regelZiele(dieDetail()).some(function (x) {
            var h2 = abdHostNorm(zielHost(zielAusDb(x)));
            return h2 === top || (x.kind === "host_all" && top.slice(-(h2.length + 1)) === "." + h2);
          });
          return UC.leerHtml({ icon: "globe", titel: "Your sitemap lists another domain.",
            text: ersetze(t("We read {n} pages, {where}. None is on {domain}."), { n: zahl(total), where: wohin, domain: eigen || ziel }) + plus +
              (schon ? " " + ersetze(t("{host} is already tracked in this event."), { host: top }) : ""),
            knopf: schon ? "" : ersetze(t("Add {host}"), { host: top }), knopfAttr: schon ? "" : 'data-abd-addhost="' + esc(top) + '"' });
        }
        return UC.leerHtml({ icon: "globe", titel: "No pages match this rule",
          text: ersetze(t("We read {n} pages. None of them is under {path}."), { n: zahl(total), path: ziel }) + plus });
      }
      return UC.leerHtml({ icon: "globe", titel: "No pages match this rule",
        text: ersetze(t(imPfad ? "None of the pages we read from your sitemap is under {where}." : "None of the pages we read from your sitemap is on {where}."), { where: ziel }) + plus });
    }
    /* Die Teile des Abschnitts (Kopf, Meldungen, Reiter, Liste) einer Regel zeichnen. */
    function abdFuellen(sek, zt) {
      var wurzel = sek.querySelector(".uev-abd-sek");
      if (!wurzel) return;
      var kopf = wurzel.querySelector(".uev-abd-kopf"), meld = wurzel.querySelector(".uev-abd-satz"), seg = wurzel.querySelector(".uev-abd-seg"), liste = wurzel.querySelector(".uev-abd-liste");
      var suchBox = wurzel.querySelector(".uev-abd-suche");
      if (suchBox && !suchBox.classList.contains("has-text") && !suchBox.contains(document.activeElement)) suchBox.hidden = true;   // mit Text oder Fokus bleibt sie stehen
      var e = state.eventId ? state.abd[state.eventId] : null, d = e && e.daten, z = d ? abdZiel(d, zt.id, zt.value) : null;
      function nurKopf(html, meldHtml) { kopf.innerHTML = html; meld.innerHTML = meldHtml || ""; meld.hidden = !meldHtml; seg.innerHTML = ""; liste.innerHTML = ""; liste.classList.remove("is-laedt"); }
      if (!e || ABD_DA.stand === false || (d && !z)) { wurzel.hidden = true; kopf.innerHTML = ""; meld.innerHTML = ""; seg.innerHTML = ""; liste.innerHTML = ""; return; }
      wurzel.hidden = false;
      if (!d) {
        /* Noch nichts da: eine leise Skelettzeile, solange gefragt wird (sie hat die Hoehe der
           Zeile, die kommt), danach der Satz -- nie beides gleich. */
        if (!e.laedt && !e.fehler) { wurzel.hidden = true; return; }
        nurKopf(sekKopf("Sitemap", ""), e.fehler ? '<div class="up-fehlerzeile is-on"><span>' + esc(t("Page coverage couldn't be loaded.")) + '</span></div>' : '<span class="uev-sk uev-abd-sk"></span>');
        return;
      }
      var sperre = abdSperre(e, d, z);
      kopf.innerHTML = sekKopf("Sitemap", abdSubSatz(d, z, sperre, !!e.neuLaeuft), abdKnopfHtml(e, d, z));
      var m = abdMeldungenHtml(e, d, z, sperre);
      meld.innerHTML = m; meld.hidden = !m;
      var pc = num(z.page_count), cc = num(z.cited_count), st = String(z.status || "");
      var laeuft = !!e.neuLaeuft, keineSeiten = !(pc > 0) || cc == null;
      /* Das erste Lesen: kein Reiter, keine Liste -- der Lader der App (makeLadebild, kompakt, wie der Waehler im
         Anlegen-Dialog) an der Stelle der Liste. Er bleibt stehen, solange der Lauf dauert, und wird nicht bei
         jedem Neuzeichnen neu gebaut (der Bogen liefe sonst von vorn). Mit schon gelesenen Seiten bleibt die
         Liste stehen, gedimmt. */
      if (laeuft && keineSeiten) {
        seg.innerHTML = "";
        if (!liste.querySelector(".up-lb")) {
          liste.innerHTML = '<div class="uev-abd-lb"></div>';
          abdLb[zt.id] = UC.makeLadebild ? UC.makeLadebild(liste.querySelector(".uev-abd-lb"), { icon: "cells", name: "Reading your sitemap",
            saetze: ["Looking for your sitemap…", "Reading pages…", "Sorting pages into folders…"], kompakt: true }) : null;
          if (abdLb[zt.id]) abdLb[zt.id].start();
        }
        liste.classList.remove("is-laedt");
        return;
      }
      if (abdLb[zt.id]) { try { abdLb[zt.id].stop(); } catch (x) {} abdLb[zt.id] = null; }
      if (st === "pending") { seg.innerHTML = ""; liste.innerHTML = ""; return; }
      if (keineSeiten) {
        seg.innerHTML = "";
        liste.innerHTML = pc === 0 && st === "ok" ? '<div class="up-box uev-leerbox">' + abdNullHtml(zt, z) + '</div>' : "";
        liste.classList.remove("is-laedt");
        return;
      }
      var tab = abdTab(zt.id), nicht = Math.max(0, pc - cc);
      function knopf(w, txt, n) {
        return '<button class="up-seg-btn' + (tab === w ? " is-active" : "") + '" type="button" data-abd-seg="' + w + '" data-ziel-id="' + esc(zt.id) + '">' +
          esc(ersetze(t(txt), { n: zahl(n) })) + '</button>';
      }
      seg.innerHTML = '<div class="up-seg uev-abd-schalter" role="group" aria-label="' + esc(t("Pages")) + '">' +
        knopf("alle", "All ({n})", pc) + knopf("zitiert", "Cited ({n})", cc) + knopf("offen", "Not cited yet ({n})", nicht) + '</div>';
      if (UC.segJetzt) { try { UC.segJetzt(seg.querySelector(".up-seg")); } catch (x) {} }
      if (suchBox) suchBox.hidden = false;
      liste.classList.toggle("is-laedt", laeuft);
      /* Mit Suchtext: die flache Trefferliste statt des Baums. */
      var sq = String((abdSucheSt[String(zt.id)] || {}).query || "").trim();
      if (sq) {
        (abdSucheSt[String(zt.id)] || {}).loading = false;
        liste.innerHTML = abdSucheHtml(zt, tab, sq, sek.__zitate || {});
        return;
      }
      var ds = abdDaten(e, tab), zz = ds ? abdZiel(ds, zt.id, zt.value) : null;
      if (!ds) {
        abdFilterHolen(state.eventId, tab);
        var fehl = e.filtFehler && e.filtFehler[tab];
        liste.innerHTML = fehl ? '<div class="up-fehlerzeile is-on"><span>' + esc(t("Page coverage couldn't be loaded.")) + '</span></div>'
          : '<span class="uev-sk uev-abd-sk"></span>';
        return;
      }
      liste.innerHTML = zz ? abdListeHtml(zt, zz, e, tab, sek.__zitate || {}) : "";
    }
    function abdSegWaehlen(zielId, w) {
      if (!zielId || (w !== "alle" && w !== "zitiert" && w !== "offen")) return;
      state.abdSeg[zielId] = w; persist();
      var e = state.eventId ? state.abd[state.eventId] : null;
      if (e && e.filtFehler) delete e.filtFehler[w];
      abdAlle();
    }
    function abdMehr(zielId) {
      var eid = state.eventId, e = eid ? state.abd[eid] : null, tab = abdTab(zielId), ds = e ? abdDaten(e, tab) : null;
      var z = ds ? abdZiel(ds, zielId, null) : null;
      if (!z) return;
      var mt = (e.mehr[tab] || (e.mehr[tab] = {})), mm = mt[zielId] || (mt[zielId] = { pages: [], laedt: false });
      if (mm.laedt) return;
      mm.laedt = true; abdAlle();
      var von = (isArr(z.pages) ? z.pages.length : 0) + mm.pages.length;
      abdRpc("get_impact_event_coverage_v1", { p_event_id: eid, p_target_id: zielId, p_filter: ABD_FILTER[tab], p_limit: ABD_MEHR, p_offset: von }).then(function (erg) {
        mm.laedt = false;
        var z2 = erg.ok && abdLesbar(erg.daten) ? abdZiel(erg.daten, zielId, null) : null;
        if (z2 && isArr(z2.pages)) { mm.pages = mm.pages.concat(z2.pages); abdBaumSt(zielId).mehr.wurzel = (abdBaumSt(zielId).mehr.wurzel || 0) + ABD_SICHT; }
        else if (UC.toast) UC.toast(fehlerText(String((erg.fehler || {}).message || ""), ""), { kind: "error" });
        if (root.isConnected !== false && state.eventId === eid) abdAlle();
      });
    }
    /* "Refresh": die Edge Function sitemap-lesen im Modus event_refresh (Rueckmeldung 17.10.,
       Plattform-Version 9) liest die Quellen des Events und antwortet mit der Abdeckung selbst, im
       Format von get_impact_event_coverage_v1 -- darum dieselben Filter, Seitenzahl und Versatz
       wie beim ersten Abruf mitschicken ("all", der Reiter All), sonst kaeme die Antwort in einer anderen
       Auswahl. Die Reiter Cited und Not cited yet werden danach neu geholt (e.filt leer). Den Rueckweg ueber
       eine RPC gibt es nicht mehr (die DB hat nur diesen Weg gebaut).
       "Zu frueh" (429 impact_event_sitemap_refresh_too_soon, hint und retry_after = Sekunden) ist
       kein Fehler: der Knopf sperrt sich mit der Wartezeit, die die DB nennt, und die Abdeckung wird
       neu geholt -- sie traegt den genauen Zeitpunkt (next_refresh_at). */
    function abdZuFrueh(d, f) {
      var sek = num(f.retry_after);
      if (!(sek > 0) && /^\d+$/.test(String(f.hint || ""))) sek = parseInt(f.hint, 10);
      if (!(sek > 0)) sek = 3600;
      d.next_refresh_at = new Date(Date.now() + sek * 1000).toISOString();
    }
    /* auto: von abdAutoPruefen angestossen -- Fehler stehen dann als Satz im Abschnitt (abdFehlerSt), nie als
       Toast mitten in der Seite; derselbe Weg gilt fuer den Knopf. */
    function abdAktualisieren(auto) {
      var eid = state.eventId, e = eid ? state.abd[eid] : null, d = e && e.daten;
      if (!d || e.neuLaeuft || (d.can_refresh === true ? 0 : abdWarteMs(d)) > 0 || e.pauseBis > Date.now()) return;
      delete abdFehlerSt[eid];
      e.zeitBudget = {};
      e.neuLaeuft = true; abdAlle();
      function fertig(fehler) {
        e.neuLaeuft = false;
        if (fehler) abdFehlerSt[eid] = fehler; else delete abdFehlerSt[eid];
        persist();
        if (root.isConnected !== false && state.eventId === eid) abdAlle();
      }
      function zuFrueh(f) { return String(f.message || "") === "impact_event_sitemap_refresh_too_soon"; }
      teamHolen().then(function (tm) {
        if (!tm || !UC.edge) return { ok: false, status: 0, fehler: { message: "network" } };
        return UC.edge("sitemap-lesen", { team_id: tm, event_id: eid, mode: "event_refresh", filter: "all", limit: ABD_LIMIT, offset: 0 }, { timeoutMs: 120000 });
      }).then(function (erg) {
        erg = erg || { ok: false, status: 0, fehler: {} };
        var f = erg.fehler || {}, dd = erg.daten && erg.daten.ok === false ? erg.daten : null;
        if (erg.ok && erg.daten && erg.daten.ok !== false && abdLesbar(erg.daten)) {
          /* Quellen, die die Function nicht mehr schaffte (refresh.sources[].code time_budget): je Ziel gemerkt,
             damit der Satz es sagt statt "wird gerade gelesen". */
          var rq = erg.daten.refresh && isArr(erg.daten.refresh.sources) ? erg.daten.refresh.sources : [];
          rq.forEach(function (q) {
            if (q && q.code === "time_budget" && isArr(q.target_ids)) q.target_ids.forEach(function (tid) { e.zeitBudget[String(tid)] = true; });
          });
          e.pauseBis = 0;
          e.daten = erg.daten; e.mehr = {}; e.filt = {}; e.filtFehler = {}; abdBaumZ = {}; fertig(null); return;
        }
        /* Zu frueh (Refresh 1 je Stunde und Event) oder zu viele Abrufe (10 je Minute und Nutzer): kein
           Fehler und kein Wiederholen, nur die Zeit, ab der es wieder geht. */
        var code = dd ? String(dd.error || "") : String(f.message || "");
        var sperrCode = code === "impact_event_sitemap_refresh_too_soon" || code === "impact_event_sitemap_rate_limited";
        if (zuFrueh(f) || sperrCode || code === "rate_limited" || code === "impact_event_rate_limited" || erg.status === 429) {
          var sek = num(f.retry_after) || num(dd && dd.retry_after);
          if (!(sek > 0) && /^\d+$/.test(String(f.hint || (dd && dd.hint) || ""))) sek = parseInt(f.hint || dd.hint, 10);
          var nr = (dd && dd.next_refresh_at) || (f.details && f.details.next_refresh_at) || "";
          if (nr && isFinite(Date.parse(nr))) d.next_refresh_at = nr;
          else abdZuFrueh(d, { retry_after: sek > 0 ? sek : 0, hint: "" });
          /* Die Wartezeit gilt fuer das ganze Event, bis die Abdeckung den Zustand je Quelle neu nennt. */
          e.pauseBis = Date.parse(d.next_refresh_at) || (Date.now() + (sek > 0 ? sek : 3600) * 1000);
          /* 429 nur, wenn keine Quelle lesbar ist (zu frueh oder Teamgrenze): der Zustand je Quelle steht in der
             Abdeckung -- einmal neu holen, der Knopf bleibt bis dahin im Lauf (kein Aufblitzen "Refresh"). */
          if (state.eventId === eid && (zuFrueh(f) || sperrCode)) abdAnfordern(eid, function () { fertig({ art: "zeit" }); });
          else fertig({ art: "zeit" });
          return;
        }
        fertig({ art: "fehler" });
      });
    }

    function modellName(k) {
      var l = UC.getModels ? UC.getModels() : [];
      for (var i = 0; i < l.length; i++) if (String(l[i].key || l[i].model || "") === String(k)) return String(l[i].display_name || l[i].name || k);
      return String(k);
    }

    /* Die Topics des Events wie in response-detail (topicChip): der statische Chip aus core in der
       Farbe des Topics, mit seinem Zeichen. Ein geloeschtes Topic (Vertrag 3.2: "Chip ausgegraut")
       steht zurueckgenommen da und sagt am Zeiger, warum -- KEIN Durchstreichen, das las sich wie
       "falsch" (03.10. gefragt: "was soll das?"). */
    function topicChipHtml(tp) {
      var eigen = topicsAlle().filter(function (x) { return String(x.id) === String(tp.id); })[0];
      var fb = eigen ? topicFarbe(eigen) : "", emo = (eigen && eigen.emoji) || tp.emoji || "";
      /* Geloescht: is-weg aus core (grauer Punkt, leiser Name, 06.10.); uev-topic-weg als Alias. */
      return '<span class="up-topicchip is-static' + (tp.deleted ? " is-weg uev-topic-weg" : "") + '"' +
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
      /* Solange die Kohorte offen ist (cohort_pending, ein geplantes Event), zaehlt die Auswahl am
         STARTTAG, nicht am Tag des Anlegens: der Cron friert sie erst dann ein (Entscheidung 1). */
      var offen = d.cohort_pending === true || istGeplant(d);
      if (d.scope_mode === "all") zeilen.push(zeile("Scope", '<span class="uev-scope-wert">' + esc(t(offen ? "All active Prompts on the start date" : "All active Prompts at event creation")) + '</span>'));
      else {
        /* Mit And verknuepft (13.10., Spalte tag_mode): darunter in einem Satz, dass nur Prompts in
           ALLEN Topics zaehlen -- die Chips allein lesen sich als "irgendeins davon", und genau das
           ist das Gewohnte. Or bleibt ohne Satz, wie bisher. Ein Topic: And ist dort Or. */
        var modus = String(d.tag_mode || (d.scope && d.scope.tag_mode) || "or").toLowerCase();
        zeilen.push(zeile("Affected topics", '<div class="uev-scope-topics"><div class="uev-scope-chips">' + topics.map(topicChipHtml).join("") + '</div>' +
          (modus === "and" && topics.length > 1 ? '<span class="uev-scope-modus">' + esc(t("Only prompts in all of these topics")) + '</span>' : '') + '</div>'));
      }
      zeilen.push(zeile("Affected prompts", '<span class="uev-scope-wert">' + esc(prompts(d.affected_prompt_count)) + '</span>'));
      /* Geplant (17.10.): die Ziele hier, weil die Abschnitte mit ihren Kennzahlen erst ab dem
         Start erscheinen -- sonst sagte die Seite nicht, was getrackt werden wird. */
      if (istGeplant(d) && isArr(d.targets) && d.targets.length) {
        zeilen.push(zeile("Tracking", '<div class="uev-scope-chips">' + d.targets.map(function (x) {
          var z = zielAusDb(x);
          return z ? '<span class="up-marke is-leise">' + esc(z.zeigen) + '</span>' : '';
        }).join("") + '</div>'));
      }
      var vgl = num(d.comparison_prompt_count);
      zeilen.push(zeile("Comparison group", '<span class="uev-scope-wert">' + esc(vgl ? prompts(vgl) : t("No comparison group")) + '</span>', vgl ? "vergleich" : ""));
      /* Was nicht in die Vorher/Nachher-Zahlen eingeht, in ganzen Saetzen: Prompts, die es vor dem
         Event noch nicht gab, haben keinen Vorher-Wert und zaehlen nur in der Kurve (Vertrag 3.9,
         cohort.post_only_prompt_count). */
      var neben = [];
      if (num(c.post_only_prompt_count) > 0) neben.push(ersetze(t(num(c.post_only_prompt_count) === 1
        ? "{n} prompt was added after the event. It appears in the chart, but not in the before and after numbers."
        : "{n} prompts were added after the event. They appear in the chart, but not in the before and after numbers."), { n: zahl(c.post_only_prompt_count) }));
      /* Prompts, die zwar vor dem Event Daten haben, aber danach (noch) keine, und solche, die vor und nach dem Event
         auf verschiedenen Modellen liefen (cohort.pre_only_prompt_count, mixed_models_prompt_count, 18.10.): sie
         schliessen die Rechnung "vergleichbar + nur danach + nur davor + gemischt + ohne Daten = betroffene Prompts"
         und erklaeren, warum die Kacheln auf weniger Prompts beruhen, als der Umfang nennt. */
      if (num(c.pre_only_prompt_count) > 0) neben.push(ersetze(t(num(c.pre_only_prompt_count) === 1
        ? "{n} prompt has no data after the event. It is not part of the before and after numbers."
        : "{n} prompts have no data after the event. They are not part of the before and after numbers."), { n: zahl(c.pre_only_prompt_count) }));
      if (num(c.mixed_models_prompt_count) > 0) neben.push(ersetze(t(num(c.mixed_models_prompt_count) === 1
        ? "{n} prompt was measured on different models before and after the event. It is not part of the before and after numbers."
        : "{n} prompts were measured on different models before and after the event. They are not part of the before and after numbers."), { n: zahl(c.mixed_models_prompt_count) }));
      /* Geloeschte Prompts zaehlen in der eingefrorenen Kohorte weiter als betroffen (Vertrag, cohort.
         deleted_prompt_count): ohne den Satz wuerde die Zahl der betroffenen Prompts groesser
         wirken als das, was heute in der Liste steht. Nur bei > 0, leise wie die Saetze darueber. */
      if (num(c.deleted_prompt_count) > 0) neben.push(ersetze(t(num(c.deleted_prompt_count) === 1
        ? "{n} prompt was deleted since this event"
        : "{n} prompts were deleted since this event"), { n: zahl(c.deleted_prompt_count) }));
      if (d.cohort_pending === true) neben.push(t("The prompt selection is fixed on the start date."));
      el.innerHTML = sekKopf("Event scope", "") + '<div class="uev-scope">' + zeilen.join("") +
        (neben.length ? '<div class="uev-scope-neben">' + neben.map(function (x) { return '<span>' + esc(x) + '</span>'; }).join("") + '</div>' : '') + '</div>';
    }

    /* RESPONSES GIBT ES IM EVENT-DETAIL NICHT MEHR (Beschluss 2, 17.10.: "ich will da gar keine Responses
       sehen, die sehe ich beim Klick auf die URL im Drawer"). Kein Abschnitt, kein URL-Filter, keine
       Antwort als Ziel eines Klicks. Geblieben ist nur, was der Vertrag mit Bubble nennt (uevResponses,
       setEventResponses): MIT_RESPONSES bleibt false, damit keine Anfrage rausgeht, und eine
       Responses-Tabelle, die doch auf der Seite steht, bleibt versteckt (respSichtbar). */
    var MIT_RESPONSES = false;
    function renderResp() {
      var el = elMain.querySelector('[data-sek="resp"]');
      respSichtbar(false);
      if (el) { el.innerHTML = ""; el.hidden = true; }
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

    /* DER MODUS "Citation Tracking only" (18.10.): ein Schalter im Seitenkopf (UC.bandAus, derselbe wie in
       Citations und Brands, nur mit eigenen Etiketten). Aus sind Kennzahlen, Bericht, Chart und
       Marktbewegung (.is-band-aus am Detail, die Regeln in events.css); die Seite beginnt dann bei den
       Zielen. Gemerkt je Event im Browser, nicht in der Datenbank: ein anderes Event darf anders stehen. */
    function modusId(id) { return "events_detail_" + id; }
    function modusStellen() {
      var box = elMain.querySelector(".uev-detail");
      if (!box || !UC.bandAus || state.ansicht !== "detail" || !state.eventId) return;
      var id = state.eventId, aus = !!(UC.bandAusGemerkt && UC.bandAusGemerkt(modusId(id)));
      var war = box.classList.contains("is-band-aus");
      /* Die Beschriftung folgt der Art (19.10.): "Citation Tracking" ist jetzt ein Eintrag, kein Modus. Event: ganze Seite oder nur die Seiten;
         Citation Tracking: Chart und Tabelle oder nur die Tabelle (wie auf Citations und Brands). */
      var wahlen = istWatch(dasEvent()) ? [{ label: "Chart and table" }, { label: "Table only" }] : [{ label: "Full overview" }, { label: "Pages only" }];
      UC.bandAus(box, aus, { id: "events_detail", wahlen: wahlen,
        setzen: function (neu) {
          if (UC.bandAusMerken) UC.bandAusMerken(modusId(state.eventId), !!neu);
          modusStellen();
        } });
      var sw = root.querySelector(".up-bandsw[data-band=\"events_detail\"]");
      if (sw && elAktion && sw.parentNode !== elAktion) elAktion.insertBefore(sw, elAktion.firstChild);
      /* Wieder eingeblendet: ein Canvas, das ausgeblendet gemessen wurde, hat Breite 0. */
      if (war && !aus && linie && linie.resize) setTimeout(function () { try { linie.resize(); linie.relayoutLegend && linie.relayoutLegend(); } catch (e) {} }, 60);
    }
    function modusWeg() {
      var sw = root.querySelector(".up-bandsw[data-band=\"events_detail\"]");
      if (sw && sw.parentNode) sw.parentNode.removeChild(sw);
    }
    function renderDetail() {
      var box = elMain.querySelector(".uev-detail");
      if (!box) return;
      /* Die Gestalt nach dem Status (17.10.): geplant ohne Steuerung, Chart und Ergebnisse (es gibt
         noch keine), eine Kampagne ohne Fenster-Umschalter (ihre Abschnitte stehen fest), die
         abgeschlossene als Bericht. Ohne Teil B traegt kein Event einen Status -- alles wie bisher. */
      var ev = dasEvent();
      box.classList.toggle("is-geplant", istGeplant(ev));
      /* Citation Tracking (19.10.): die Marken-Teile (Kennzahlen, Bericht, Chart, Marktbewegung, Hinweise, Umfang) gibt es nicht -- kein
         Schalter, die Ansicht ist fest die Beobachtung der Seiten. */
      box.classList.toggle("is-watch", istWatch(ev));
      root.classList.toggle("is-watch-ansicht", istWatch(ev));   /* ohne Anleitung: ihre Detail-Schritte fuehren durch Teile, die es hier nicht gibt */
      box.classList.toggle("is-kampagne", kampagneDa() && mitEnde(ev) && !istGeplant(ev));
      box.classList.toggle("is-bericht", istFertig(ev));
      krumenNeu();
      modusStellen();
      renderKopf(); renderGeplant(); renderHinweise(); renderKpis(); renderBericht(); renderChart(); renderMarkt(); renderZiele(); renderUrls(); renderScope(); renderResp();
      if (anleitung && anleitung.laeuft()) anleitung.neu();
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
      rufen("uevDetail", { p_event_id: state.eventId }, { eventId: state.eventId }, spaet);
    }
    /* Die Filter der Analyse als Parameter (Fenster, Modelle, Maerkte, Intent): dieselben gehen an die URL-Liste je Regel
       (get_impact_event_urls_v1), damit beide dieselben Zahlen rechnen. */
    function analyseKoerper() {
      var body = { p_event_id: state.eventId, p_window_days: state.fenster,
                   p_models: state.modelle && state.modelle.length ? state.modelle : null,
                   p_markets: state.maerkte && state.maerkte.length ? state.maerkte : null };
      /* Intent-Filter der App (13.10.; cached_impact_event_analysis_v2 kennt p_intents/p_branded).
         Die Kohorte bleibt die beim Anlegen eingefrorene -- gefiltert wird innerhalb. */
      var ip = intentP();
      for (var k in ip) if (Object.prototype.hasOwnProperty.call(ip, k)) body[k] = ip[k];
      /* "Since event" (Nachtrag 17.10.): die Form waehlt die DB, Vorschlag p_window = "since"
         ohne Fensterlaenge. Bei einer Kampagne ignoriert v4 p_window_days (Vertrag B.2). */
      kampagneMerken(dasEvent());
      if (seitAktiv(dasEvent())) { body.p_window_days = null; body.p_window = "since"; }
      return body;
    }
    function analyseAnfordern(spaet) {
      state.analyseLaden = true; state.analyseFehler = false;
      detailUhr();
      var body = analyseKoerper();
      state.analyseSigLief = analyseSig();
      rufen("uevAnalysis", body, { sig: state.analyseSigLief }, spaet);
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
      if (!MIT_RESPONSES) return;
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
      modusWeg();
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
      if (!schonOffen) { delete abdGefragt[id]; delete abdFehlerSt[id]; baueDetail(); }
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
      else if (state.ansicht !== "uebersicht" || !abschnitt("event").liste) zurUebersicht(false);
    }

    /* ---- Klicks --------------------------------------------------------------------------- */
    /* Ueber das Popover aus core schliessen, nicht selbst (04.10.): close() nimmt den Fokus aus dem
       Menue, BEVOR es aria-hidden setzt, und meldet die Escape-Bindung ab. Vorher setzte diese
       Funktion aria-hidden direkt, waehrend "Delete" noch den Fokus hatte -- Chrome meldete
       "Blocked aria-hidden ... its descendant retained focus". Die Schleife faengt den Rest ab. */
    var mehrPop = null;
    function mehrSchliessen() {
      if (mehrPop) { var pz = mehrPop; mehrPop = null; try { pz.close(); } catch (e) {} }
      var offen = root.querySelectorAll(".uev-mehr.is-open");
      for (var i = 0; i < offen.length; i++) {
        offen[i].classList.remove("is-open");
        var m = offen[i].querySelector(".uev-mehrmenu");
        if (m) { m.classList.remove("is-shown"); m.setAttribute("aria-hidden", "true"); }
      }
    }
    root.addEventListener("click", function (e) {
      if (!e.target.closest) return;
      if (e.target.closest(".uev-anlegen, [data-uev-create]")) { e.preventDefault(); popupArt(); return; }
      if (e.target.closest(".uev-zurueck")) { zurUebersicht(true); return; }
      var zm = e.target.closest("[data-zm]");
      if (zm) { state.zielMetrik = zm.getAttribute("data-zm") === "abs" ? "abs" : "share"; persist(); zielMetrikSetzen(); renderZiele(); return; }
      if (e.target.closest(".uev-pinknopf")) { pinUmschalten(); return; }
      var si = e.target.closest(".uev-seiteninfo");
      if (si) { if (seitenKarte && !seitenKarte.el.classList.contains("is-on")) seitenKarte.show(si); return; }
      /* Der Knopf im gefilterten Leerzustand (UC.leerHtml traegt data-clearall): Suche und
         Typ-Filter zuruecksetzen. */
      var ca = e.target.closest("[data-clearall]");
      if (ca) {
        /* Der Abschnitt, in dem der Knopf steht: Suche und (beim Event) Typ-Filter zuruecksetzen. */
        var sek = ca.closest(".uev-abschnitt"), kart = sek ? sek.getAttribute("data-art") : "event", za = abschnitt(kart);
        ue(kart).suche = "";
        if (kart === "event") { ue("event").typen = []; if (za.typFilter) za.typFilter.setGewaehlt([]); }
        if (za.sucheIn) za.sucheIn.value = "";
        if (za.suche) za.suche.classList.remove("has-text");
        persist(); renderListe();
        return;
      }
      var mb = e.target.closest(".uev-mehrbtn");
      if (mb) {
        e.stopPropagation();
        var w = mb.closest(".uev-mehr"), war = w.classList.contains("is-open");
        mehrSchliessen();
        if (!war && UC.makePopover) {
          mehrPop = UC.makePopover({ wrap: w, menu: w.querySelector(".uev-mehrmenu"), opener: mb });
          mehrPop.open();
        }
        return;
      }
      var ak = e.target.closest("[data-aktion]");
      if (ak && ak.getAttribute("data-aktion") === "notify") {
        /* Ein Schalter im Menue schliesst es nicht: man sieht, dass er umgelegt ist. */
        e.stopPropagation();
        var nid = ak.getAttribute("data-event-id");
        notifySetzen(nid, ak.getAttribute("aria-checked") !== "true", false);
        return;
      }
      if (ak) {
        e.stopPropagation(); mehrSchliessen();
        var eid = ak.getAttribute("data-event-id");
        if (ak.getAttribute("data-aktion") === "edit") popupBearbeiten(eid);
        if (ak.getAttribute("data-aktion") === "delete") loeschenFragen(eid);
        if (ak.getAttribute("data-aktion") === "pin") pinUmschalten();
        return;
      }
      if (e.target.closest(".uev-mehr")) return;
      var uw = e.target.closest(".uev-urlweg");
      if (uw) { urlEntfernenFragen(uw.getAttribute("data-url-id")); return; }
      var zw = e.target.closest(".uev-zielweg");
      if (zw) { zielEntfernenFragen(zw.getAttribute("data-ziel-id")); return; }
      /* Seitenabdeckung (17.10., Teil C): Umschalter, "Refresh", "Show N more". */
      var asg = e.target.closest("[data-abd-seg]");
      if (asg) { abdSegWaehlen(asg.getAttribute("data-ziel-id"), asg.getAttribute("data-abd-seg")); return; }
      var anu = e.target.closest(".uev-abd-neu");
      if (anu) { abdAktualisieren(); return; }
      var asm = e.target.closest(".uev-abd-such-mehr");
      if (asm) {
        var azid = asm.getAttribute("data-ziel-id"), azt = regelZiele(dieDetail()).filter(function (x) { return String(x.id) === azid; })[0];
        var aq = String((abdSucheSt[azid] || {}).query || "").trim();
        if (azt && aq) { abdSucheHolen(azt, abdTab(azid), aq, true); abdAlle(); }
        return;
      }
      var amh = e.target.closest(".uev-abd-mehr");
      if (amh) { abdMehr(amh.getAttribute("data-ziel-id")); return; }
      /* Der Baum der Seiten (17.10.): Ordner auf und zu, "Show more" je Ebene. */
      /* Der Link einer Seite der Sitemap oeffnet die Seite im neuen Tab (Browser); die Zeilenaktion (URL-Detail bzw.
         Hinweis) bleibt der Zeile ausserhalb des Textes. */
      if (e.target.closest("a.uev-abd-link")) return;
      var akl = e.target.closest("[data-abd-klapp]");
      if (akl) {
        var asek = akl.closest(".uev-zielsek"), ast = abdBaumSt(asek ? asek.getAttribute("data-ziel-id") : ""), ak = akl.getAttribute("data-abd-klapp");
        ast.auf[ak] = !ast.auf[ak]; abdAlle(); return;
      }
      var abm = e.target.closest("[data-abd-baum-mehr]");
      if (abm) { var ast2 = abdBaumSt(abm.getAttribute("data-ziel-id")), ak2 = abm.getAttribute("data-abd-baum-mehr"); ast2.mehr[ak2] = (ast2.mehr[ak2] || 0) + ABD_SICHT; abdAlle(); return; }
      /* Eine zitierte Seite der Sitemap oeffnet das URL-Detail; eine, die noch nicht zitiert ist, oeffnet
         sich nicht: das sagt die Zeile erst auf den Klick. */
      var azl = e.target.closest(".uev-abd-seite.is-zitiert[data-url]");
      if (azl) { if (UC.drawerOeffnen) UC.drawerOeffnen("url", azl.getAttribute("data-url"), "events"); return; }
      var aas = e.target.closest("[data-abd-seite]");
      if (aas) { nichtZitiertHinweis(aas.getAttribute("data-url")); return; }
      var aah = e.target.closest("[data-abd-addhost]");
      if (aah) { popupZiel(aah.getAttribute("data-abd-addhost")); return; }
      /* Dasselbe fuer eine stille Zeile der Tabelle "URLs" (uev-urlstill): erst der Klick
         sagt es, nicht der Zeiger. "Remove" in der Zeile behaelt seinen eigenen Weg. */
      if (e.target.closest(".uev-urlstill") && !e.target.closest(".uev-urlweg")) { nichtZitiertHinweis(e.target.closest(".uev-urlstill").getAttribute("data-url")); return; }
      if (e.target.closest(".uev-anl-toggle")) { anleitungUmschalten(); return; }
      /* Zitierte URL einer Regel: die Antwort, in der sie zuerst zitiert wurde (15.10.). */
      var zz = e.target.closest(".uev-zitzeile[data-url]");
      if (zz) { if (UC.drawerOeffnen) UC.drawerOeffnen("url", zz.getAttribute("data-url"), "events"); return; }
      /* Zeile der URL-Tabelle: das URL-Detail im Drawer der App. Kennung ist die URL selbst -- so
         nimmt der URL-Drawer sie (Drawer-System der Host-App: "IDs koennen ganze URLs sein"). */
      var uz = e.target.closest(".uev-urlzeile[data-url]");
      if (uz) { if (UC.drawerOeffnen) UC.drawerOeffnen("url", uz.getAttribute("data-url"), "events"); return; }
      var mz = e.target.closest(".uev-markenzeile[data-company-id]");
      if (mz) { if (UC.drawerOeffnen) UC.drawerOeffnen("brand", mz.getAttribute("data-company-id"), "events"); return; }
      if (e.target.closest(".uev-addurl-kopf, [data-uev-addurl]")) { popupZiel(); return; }
      var k = e.target.closest(".uev-karte[data-event-id]");
      if (k && !k.classList.contains("is-sk")) oeffnen(k.getAttribute("data-event-id"), true);
    });
    root.addEventListener("keydown", function (e) {
      if (e.key !== "Enter" && e.key !== " ") return;
      var k = e.target.closest && e.target.closest(".uev-karte[data-event-id]");
      if (k && e.target === k) { e.preventDefault(); oeffnen(k.getAttribute("data-event-id"), true); return; }
      var uz = e.target.closest && e.target.closest(".uev-urlzeile[data-url]");
      if (uz && e.target === uz) { e.preventDefault(); if (UC.drawerOeffnen) UC.drawerOeffnen("url", uz.getAttribute("data-url"), "events"); return; }
      var mz = e.target.closest && e.target.closest(".uev-markenzeile[data-company-id]");
      if (mz && e.target === mz) { e.preventDefault(); if (UC.drawerOeffnen) UC.drawerOeffnen("brand", mz.getAttribute("data-company-id"), "events"); return; }
      var azl = e.target.closest && e.target.closest(".uev-abd-seite.is-zitiert[data-url]");
      if (azl && e.target === azl) { e.preventDefault(); if (UC.drawerOeffnen) UC.drawerOeffnen("url", azl.getAttribute("data-url"), "events"); return; }
      var zz = e.target.closest && e.target.closest(".uev-zitzeile[data-url]");
      if (zz && e.target === zz) { e.preventDefault(); if (UC.drawerOeffnen) UC.drawerOeffnen("url", zz.getAttribute("data-url"), "events"); }
    });

    /* ---- Loeschen und URL entfernen: bestaetigen im allgemeinen Popup --------------------- */
    var wartend = { del: null, urlWeg: null, zielWeg: null };
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
    /* EV-09 (Audit 17.10.): Escape, X und ein Klick auf den Schleier verwarfen den Assistenten samt Namen,
       Zielen und Sitemap-Auswahl ohne Nachfrage. Wie in gaengigen Apps (Linear, Notion, Vercel) fragt
       das Popup jetzt nach -- aber nur, wenn etwas eingegeben wurde; ein leeres Formular schliesst sofort.
       "Etwas eingegeben" heisst: anders als beim Oeffnen (p.start), nicht "irgendwann etwas angefasst",
       damit ein Event, das nur geoeffnet und wieder zugemacht wird, nie fragt. */
    function popupStand(p) {
      var e = p.e;
      if (p.art === "ziel") return JSON.stringify([e.ziele.map(function (z) { return z.key; }), String(e.eingabe || "").trim()]);
      if (p.art === "bearbeiten") return JSON.stringify([e.name, e.typ, e.text, e.icon || null, e.farbe || null, e.cover || null, e.ende || null]);
      return JSON.stringify([e.name.trim(), e.text.trim(), e.typ, e.icon || null, e.farbe || null, e.cover || null, e.datum, e.ende || null, !!e.bereich,
        e.modus, e.topics, e.tagModus, e.ziele.map(function (z) { return z.key; }), String(e.eingabe || "").trim()]);
    }
    function popupGeaendert(p) { return !!p && p.start != null && popupStand(p) !== p.start; }
    /* Das Popup fragt vor dem Schliessen (cfg.vorSchliessen in makeModal). true: es darf zu; false: es
       bleibt, und die Rueckfrage steht davor. Die Rueckfrage selbst schliesst Escape als "Weiter
       bearbeiten"; der Escape des Popups darunter laeuft zuerst (aelterer Zuhoerer), sieht sie offen
       und tut nichts -- sonst stuenden zwei Fragen uebereinander. */
    function popupDarfZu() {
      var p = popup;
      if (!p || !popupGeaendert(p)) return true;
      if (p.verwerfenFrage) return false;
      var neuesEvent = p.art === "anlegen" && !p.planEventId;
      var m = UC.makeModal({
        titel: neuesEvent ? "Discard this event?" : "Discard changes?", isDark: isDark,
        inhaltHtml: '<p class="uev-popup-text">' + esc(t(neuesEvent ? "Everything you entered will be lost." : "Your changes won't be saved.")) + '</p>',
        knoepfe: [{ id: "behalten", text: "Keep editing", art: "sec" },
                  { id: "weg", text: "Discard", art: "gefahr", aktion: function () { p.start = null; p.api.schliessen(); } }],
        onClose: function () { p.verwerfenFrage = null; var f = p.api.el.querySelector("input:not([type=hidden]), textarea"); try { if (f && popup === p) f.focus(); } catch (e0) {} }
      });
      p.verwerfenFrage = m;
      return false;
    }
    function loeschenFragen(eid) {
      var ev = (state.detail[eid]) || listeEvent(eid);
      if (!ev || ev.can_delete !== true) return;
      var m = UC.makeModal({
        titel: "Delete this event?", isDark: isDark,
        inhaltHtml: '<p class="uev-popup-text">' + esc(t("The event, its scope and its URL list are removed. Prompt history, citations and responses stay untouched.")) + '</p>',
        knoepfe: [{ id: "abbrechen", text: "Cancel", art: "sec" },
                  { id: "ok", text: "Delete event", art: "gefahr", aktion: function (api) {
                    /* Doppelklick: der Knopf ist ab dem ersten Klick gesperrt (busy), und eine
                       zweite Anfrage geht auch dann nicht hinaus, wenn ihn etwas wieder frei gibt. */
                    if (wartend.del) return false;
                    api.busy("ok", true); api.fehler("");
                    wartend.del = { id: eid, api: api, uhr: warteUhr("del", api), seq: listenStand().seq };
                    rufen("uevDelete", { p_event_id: eid }, { eventId: eid });
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
                    if (wartend.urlWeg) return false;
                    api.busy("ok", true); api.fehler("");
                    wartend.urlWeg = { eventId: d.id, urlId: urlId, api: api, uhr: warteUhr("urlWeg", api) };
                    /* Der Klick-Dummy (events-demo.js) kennt den alten Parameter, die Datenbank den neuen. */
                    rufen("uevRemoveUrl", demo ? { p_event_id: d.id, p_url_id: urlId } : { p_event_id: d.id, p_target_id: urlId }, { eventId: d.id });
                    return false;
                  } }],
        onClose: function () { if (wartend.urlWeg && wartend.urlWeg.api === m) wartend.urlWeg = null; }
      });
    }
    /* Eine Regel entfernen (15.10.): dieselbe Bestaetigung wie bei einer URL, remove_impact_event_target_v1. */
    function zielEntfernenFragen(zielId) {
      var d = dieDetail();
      if (!d) return;
      var zt = regelZiele(d).filter(function (x) { return String(x.id) === String(zielId); })[0];
      if (!zt) return;
      var x = zielAusDb(zt) || { zeigen: String(zt.value || "") };
      var m = UC.makeModal({
        titel: "Remove this target from the event?", isDark: isDark,
        inhaltHtml: '<p class="uev-popup-url">' + esc(x.zeigen) + '</p><p class="uev-popup-text">' + esc(t("Only the rule is removed. Pages and their citations stay untouched.")) + '</p>',
        knoepfe: [{ id: "abbrechen", text: "Cancel", art: "sec" },
                  { id: "ok", text: "Remove target", art: "gefahr", aktion: function (api) {
                    if (wartend.zielWeg) return false;
                    api.busy("ok", true); api.fehler("");
                    wartend.zielWeg = { eventId: d.id, zielId: zielId, api: api, uhr: warteUhr("zielWeg", api) };
                    rufen("uevRemoveTarget", { p_event_id: d.id, p_target_id: zielId }, { eventId: d.id });
                    return false;
                  } }],
        onClose: function () { if (wartend.zielWeg && wartend.zielWeg.api === m) wartend.zielWeg = null; }
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
    /* Die Kopfzeile des Kalenders in der Sprache der App, wie in date-range.js (UC.kalenderNamen);
       ohne die Funktion das Englische. */
    var WOCHENTAGE = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
    function kalNamen() { return UC.kalenderNamen ? UC.kalenderNamen() : { mon: MONATE.map(function (m) { return t(m); }), dow: WOCHENTAGE }; }
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
    function grenzen(e) {
      var heute = tagAus(heuteIso());
      /* Mit Kampagnen (17.10., Vertrag B.1) darf der Start bis heute + 365 liegen. Beim Waehlen des
         Endes: ab dem Start, hoechstens 183 Tage lang (Start und Ende zaehlen mit). */
      var hi = kampagneDa() ? new Date(heute.getFullYear(), heute.getMonth(), heute.getDate() + ZUKUNFT_TAGE) : heute;
      var lo = new Date(heute.getFullYear(), heute.getMonth(), heute.getDate() - DATUM_TAGE);
      if (e && e.endeAb) lo = tagAus(e.endeAb);
      if (e && e.bereich && e.wahlEnde && e.datum) {
        var s = tagAus(e.datum);
        return { lo: lo, hi: new Date(s.getFullYear(), s.getMonth(), s.getDate() + KAMPAGNE_TAGE - 1), heute: heute, start: s };
      }
      return { lo: lo, hi: hi, heute: heute };
    }
    /* Ob eine Eingabe eine Adresse ist und welche Art Ziel, sagen seit 15.10. zerlegen,
       artVorschlag und zielBauen (oben, ausserhalb der Wurzel). */

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
    /* key (13.10.): das Feld bekommt seine Fehlerzeile aus core (.up-fehlerzeile, roter Satz ohne
       Kasten) -- dort steht, was die Datenbank oder die Pruefung vorab an DIESEM Feld meldet. */
    function feld(label, inhalt, optional, key) {
      return '<div class="up-topicmodal-field">' +
        '<span class="up-topicmodal-label">' + esc(t(label)) +
          (optional ? ' <span class="uev-optional">' + esc(t("Optional")) + '</span>' : '') + '</span>' +
        inhalt + (key ? feldFehlerHtml(key) : '') + '</div>';
    }
    function feldFehlerHtml(key) {
      return '<div class="up-fehlerzeile uev-feldfehler" data-feldfehler="' + esc(key) + '" role="alert"><span></span></div>';
    }
    /* Setzt (text) oder nimmt (leer) die Meldung an einem Feld des offenen Popups. false, wenn das
       Popup dieses Feld nicht hat -- dann muss die Meldung woanders hin. */
    function feldFehler(key, text) {
      var el = key ? im('[data-feldfehler="' + key + '"]') : null;
      if (!el) return false;
      el.firstChild.textContent = text || "";
      el.classList.toggle("is-on", !!text);
      return true;
    }
    function feldFehlerWeg() {
      var l = popup ? popup.api.el.querySelectorAll(".uev-feldfehler.is-on") : [];
      for (var i = 0; i < l.length; i++) { l[i].classList.remove("is-on"); l[i].firstChild.textContent = ""; }
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
    /* Bis 13.10. 48 wie die eigene Branche (IND_MAX in settings-brand); seit v2 nimmt p_event_type
       hoechstens 40 Zeichen. */
    var TYP_MAX = KURZ_MAX;
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
    /* Seit 13.10. als Schluessel (typSchluessel): "Podcast Launch" und "podcast launch" sind
       derselbe Typ, und ein Text ohne einen einzigen Buchstaben oder Ziffer ist keiner. */
    function typEigenOk(p) {
      var inp = im(".uev-typeigen");
      var v = inp ? inp.value.trim() : "", k = typSchluessel(v);
      if (!k) return false;
      var da = typListe(p.e.typ).da;
      return !da[v.toLowerCase()] && !da[k] && !da[String(typVon(k).label).toLowerCase()];
    }
    function typEigenNehmen() {
      var p = popup, inp = im(".uev-typeigen");
      if (!p || !inp || !typEigenOk(p)) return;
      p.e.typ = typSchluessel(inp.value);
      inp.value = "";
      feldFehler("typ", "");
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
      var g = grenzen(e), m = e.monat || tagAus(e.datum) || g.heute;
      var monat = new Date(m.getFullYear(), m.getMonth(), 1);
      var boden = new Date(g.lo.getFullYear(), g.lo.getMonth(), 1), decke = new Date(g.hi.getFullYear(), g.hi.getMonth(), 1);
      var vor = new Date(monat.getFullYear(), monat.getMonth() - 1, 1) >= boden;
      var nach = new Date(monat.getFullYear(), monat.getMonth() + 1, 1) <= decke;
      var start = new Date(monat.getFullYear(), monat.getMonth(), 1 - (monat.getDay() + 6) % 7);
      var heute = tagIso(g.heute), zellen = "";
      /* Ein Zeitraum (17.10.) wie im Kalender aus date-range.js: Anfang und Ende gefuellt, die Tage
         dazwischen im Band (is-in), die Ecken je Wochenzeile (is-edge-l/-r). Ohne Ende ist der
         Anfang eine Zelle mit beiden Ecken -- wie der einzelne Tag. */
      var bis = e.bereich && e.ende ? e.ende : e.datum;
      for (var i = 0; i < 42; i++) {
        var d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
        if (d.getMonth() !== monat.getMonth()) { zellen += '<span class="udr-day is-out" aria-hidden="true"></span>'; continue; }
        var iso = tagIso(d), aus = d < g.lo || d > g.hi, drin = !!e.datum && iso >= e.datum && iso <= bis;
        var spalte = i % 7, kl = "";
        if (drin) {
          kl = iso === e.datum ? " is-start" : iso === bis ? " is-end" : " is-in";
          if (iso === e.datum && iso === bis) kl = " is-start is-end";
          if (spalte === 0 || iso === e.datum || d.getDate() === 1) kl += " is-edge-l";
          if (spalte === 6 || iso === bis || new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getMonth() !== d.getMonth()) kl += " is-edge-r";
        }
        zellen += '<button type="button" class="udr-day' + (iso === heute ? " is-today" : "") + kl + '" data-tag="' + iso + '"' + (aus ? " disabled" : "") + '>' + d.getDate() + '</button>';
      }
      return '<div class="udr-month">' +
        '<div class="udr-month-head">' +
          '<button type="button" class="udr-nav udr-prev" data-monat="-1" aria-label="' + esc(t("Previous month")) + '"' + (vor ? "" : " disabled") + '>' + UC.icon("chevronLeft", 1.8) + '</button>' +
          '<span class="udr-month-title">' + esc(kalNamen().mon[monat.getMonth()]) + ' ' + monat.getFullYear() + '</span>' +
          '<button type="button" class="udr-nav udr-next" data-monat="1" aria-label="' + esc(t("Next month")) + '"' + (nach ? "" : " disabled") + '>' + UC.icon("chevronRight", 1.8) + '</button>' +
        '</div>' +
        '<div class="udr-dows">' + kalNamen().dow.map(function (w) { return '<span class="udr-dow">' + w + '</span>'; }).join("") + '</div>' +
        '<div class="udr-grid">' + zellen + '</div></div>';
    }
    /* Die Texte der Wahlknoepfe: der Start, das Ende. Jeder zeigt nur SEIN Datum -- mit Zeitraum
       stehen zwei Felder da (Nutzer 17.10.: "niemand errät, dass man im Kalender eine Spanne
       ziehen kann"), und jedes sagt ueber seinem Knopf, was es ist. */
    function datumText(e) { return e.datum ? datum(e.datum) : t("Select a date"); }
    function endeText(e) { return e.ende ? datum(e.ende) : t("Select a date"); }
    function datumModus(e) { return e.bereich ? "bereich" : "tag"; }
    /* Das Feld des Starts, mit dem Kalender darunter. */
    function startWahl(e) {
      return '<div class="up-filter uev-wahl" data-wahlwrap="datum">' + wahlKnopf("datum", "calendar", datumText(e), !e.datum) +
        '<div class="up-menu uev-wahlmenu uev-datumwahl" aria-hidden="true">' + kalender(e) + '</div></div>';
    }
    /* Einzeln: ein Feld. Zeitraum: zwei Felder nebeneinander, Startdatum und Enddatum; beide oeffnen
       einen Kalender mit demselben Band, die Wahl im einen fuellt das andere mit (datumKlick). */
    function datumInhalt(e) {
      if (!e.bereich) return startWahl(e);
      return '<div class="uev-datumpaar">' +
        '<div class="uev-datumfach"><span class="uev-datum-lbl">' + esc(t("Start date")) + '</span>' + startWahl(e) + '</div>' +
        '<div class="uev-datumfach"><span class="uev-datum-lbl">' + esc(t("End date")) + '</span>' + endeFeld(e) + '</div></div>';
    }
    function datumFeld(e) {
      /* "Start date | Date range" (17.10.) nur mit Kampagnen in der Datenbank; das Segment aus core
         (.up-seg) wie der Umschalter Or/And der Topics. Ein geplantes Event, das schon begonnen
         haette, gibt es nicht -- im Bearbeiten geplanter Events ist beides frei. */
      var seg = kampagneDa() ? '<div class="up-seg uev-datummodus" role="group" aria-label="' + esc(t("Date")) + '">' +
          '<button class="up-seg-btn' + (!e.bereich ? " is-active" : "") + '" type="button" data-datummodus="tag" aria-pressed="' + !e.bereich + '">' + esc(t("Start date")) + '</button>' +
          '<button class="up-seg-btn' + (e.bereich ? " is-active" : "") + '" type="button" data-datummodus="bereich" aria-pressed="' + !!e.bereich + '">' + esc(t("Date range")) + '</button>' +
        '</div>' : '';
      return '<div class="uev-datumfeld">' + seg +
        '<div class="uev-datuminhalt" data-modus="' + datumModus(e) + '">' + datumInhalt(e) + '</div>' +
        (kampagneDa() ? '<span class="uev-datumhilfe">' + esc(datumHilfe(e)) + '</span>' : '') + '</div>';
    }
    /* Das Ende: ab dem Start, hoechstens 183 Tage lang (Vertrag B.1/B.3). Im Bearbeiten einer
       LAUFENDEN Kampagne steht der Start fest (e.start) und das Ende gilt ab heute; im Anlegen ist
       es der gerade gewaehlte Start (e.datum), und das Ende darf auch in der Vergangenheit liegen
       (eine schon beendete Kampagne). Derselbe Kalender, der Zeitraum als Band. */
    function endeKalender(e) {
      var s = e.start || e.datum;
      return kalender({ bereich: true, wahlEnde: true, datum: s, ende: e.ende, monat: e.endeMonat || tagAus(e.ende) || tagAus(s), endeAb: e.start ? heuteIso() : s });
    }
    function endeFeld(e) {
      return '<div class="up-filter uev-wahl" data-wahlwrap="ende">' + wahlKnopf("ende", "calendar", endeText(e), !e.ende) +
        '<div class="up-menu uev-wahlmenu uev-endewahl" aria-hidden="true">' + endeKalender(e) + '</div></div>';
    }
    function endeNeu() {
      var p = popup, b = im('[data-wahl="ende"]');
      if (!p) return;
      if (b) {
        var tx = b.querySelector(".up-modal-wahl-txt");
        tx.textContent = endeText(p.e);
        tx.classList.toggle("is-leer", !p.e.ende);
      }
      var m = im(".uev-endewahl");
      if (m) m.innerHTML = endeKalender(p.e);
    }
    /* Ein Satz unter dem Feld: was der Zeitraum bewirkt bzw. was ein Start in der Zukunft heisst --
       ohne Fachwort, damit niemand raten muss, was "Date range" aendert. */
    function datumHilfe(e) {
      if (e.datum && e.datum > heuteIso()) return t("Planned events can be fully edited until they start.");
      return t(e.bereich ? "We compare the campaign with the same number of days before it, and show what happens after it ends."
        : "We compare the days after this date with the days before it.");
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
      /* Citation Tracking (19.10.): nur Name und Beschreibung -- kein Datum, kein Typ, kein Aussehen (keine Pins, keine Kohorte). */
      if (e.art === "watch") {
        return feld("Name", '<input type="text" class="up-topicmodal-name" data-feld="name" maxlength="' + NAME_MAX + '" autocomplete="off" spellcheck="false"' +
            ' placeholder="' + esc(t("e.g. Help center pages")) + '" value="' + esc(e.name) + '"/>', false, "name") +
          feld("Description", '<textarea class="up-topicmodal-name up-modal-text" data-feld="text" rows="3" placeholder="' + esc(t("What do you want to keep an eye on?")) + '">' + esc(e.text) + '</textarea>', true, "text");
      }
      return feld("Name", '<input type="text" class="up-topicmodal-name" data-feld="name" maxlength="' + NAME_MAX + '" autocomplete="off" spellcheck="false"' +
          ' placeholder="' + esc(t("e.g. Website relaunch")) + '" value="' + esc(e.name) + '"/>', false, "name") +
        (mitDatum ? feld("Date", datumFeld(e), false, "datum") : "") +
        feld("Type", typFeld(e), false, "typ") +
        /* Ohne maxlength: das Feld schnitte einen eingefuegten Text still ab. Ueber 2000 Zeichen
           sagt es die Fehlerzeile, und der Knopf bleibt gesperrt (schrittOk). */
        feld("Description", '<textarea class="up-topicmodal-name up-modal-text" data-feld="text" rows="3" placeholder="' + esc(t("What changed?")) + '">' + esc(e.text) + '</textarea>', true, "text") +
        feld("Appearance", '<div class="uev-aussehen">' + aussehen(e) + '</div>', false, "aussehen");
    }
    /* DER TITELBILD-PICKER: die sechs Motive als Kacheln im Format des Bands, drei je Reihe (immer
       gleich viele je Reihe). Gewaehlt traegt die Kachel den Ring in der Akzent-Tinte und den Haken
       in einem runden Grund -- dieselbe Sprache wie die Farbwahl darueber (Haken auf dem Feld).
       Ein zweiter Klick auf die gewaehlte Kachel nimmt sie ab; "Remove cover" klappt darunter auf,
       sobald eine gewaehlt ist (200ms wie jedes Aufklappen im Popup). Ohne Titelbild steht das Band
       in der Event-Farbe -- das zeigt die Vorschau darunter. */
    function coverKacheln(e) {
      return coversFuer(e.art).map(function (c) {
        var an = e.cover === c.key, ct = coverTeile(c);
        return '<button type="button" class="uev-cover' + (an ? " is-on" : "") + (ct.klasse.indexOf("is-laedt") >= 0 ? " is-laedt" : "") + '" data-cover="' + c.key + '" aria-pressed="' + an + '"' +
            ' aria-label="' + esc(t(c.label)) + '" data-tip="' + esc(t(c.label)) + '"' + ct.attr + '>' +
          '<span class="uev-cover-haken" aria-hidden="true">' + UC.icon("check", 3) + '</span></button>';
      }).join("");
    }
    function coverFeld(e) {
      return feld("Cover image",
        '<div class="uev-cover-raster" role="group" aria-label="' + esc(t("Cover image")) + '">' + coverKacheln(e) + '</div>' +
        klapp(!!e.cover, '<div class="uev-cover-fuss"><button type="button" class="up-quietbtn uev-cover-weg">' + esc(t("Remove cover")) + '</button></div>', "uev-cover-klapp"), true, "cover");
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
    /* OR/AND (13.10. angefordert, "wie im Topics-Filter"): derselbe Umschalter aus core
       (.up-seg) an derselben Stelle wie dort, links im Fuss der Liste. Immer bedienbar, auch
       unter zwei Topics -- wie im Filter: ein Regler, der sich selbst ausgraut, liest sich als
       kaputt. Or = Prompts in irgendeinem der Topics, And = nur Prompts, die in allen stehen. */
    function topicsFuss(p) {
      var n = p.e.topics.length, alle = topicsAlle().length, m = p.e.tagModus === "and" ? "and" : "or";
      return '<span class="up-seg uev-tagmodus" role="group" aria-label="' + esc(t("Match mode")) + '">' +
          '<button class="up-seg-btn' + (m === "or" ? " is-active" : "") + '" type="button" data-tagmodus="or" aria-pressed="' + (m === "or") + '"' +
            ' data-tip="' + esc(t("Prompts in any of the selected topics")) + '">' + esc(t("Or")) + '</button>' +
          '<button class="up-seg-btn' + (m === "and" ? " is-active" : "") + '" type="button" data-tagmodus="and" aria-pressed="' + (m === "and") + '"' +
            ' data-tip="' + esc(t("Only prompts in all selected topics")) + '">' + esc(t("And")) + '</button>' +
        '</span>' +
        '<span class="uev-topicfuss-r">' +
          '<span class="uev-topicfuss-zahl">' + esc(ersetze(t("{n} of {total} selected"), { n: n, total: alle })) + '</span>' +
          (alle ? '<button type="button" class="up-quietbtn uev-topicalle">' + esc(t(n === alle ? "Clear" : "Select all")) + '</button>' : '') +
        '</span>';
    }
    function topicsZeigen() {
      var p = popup, l = im(".uev-topicliste"), f = im(".uev-topicfuss");
      if (l) l.innerHTML = topicZeilen(p);
      if (f) f.innerHTML = topicsFuss(p);
    }
    /* DIE TOPICS KOMMEN SPAETER ALS DER SCHRITT (17.10., Nutzer: nach einem Besuch auf Brands stand
       Schritt 2 ohne Liste da). Schritt 2 zeichnet die Liste einmal beim ersten Zeigen; ist der
       Speicher der Seite dann noch leer (frisch geladen, gerade neu befuellt), stand dort fuer immer
       "No topics found", auch wenn die Topics eine Sekunde spaeter eintrafen -- gemessen: Speicher
       13, Zeilen 0. Darum haengt das Popup am Speicher (UC.onTopics) und zeichnet nach, sobald er
       sich aendert. Hat sich dabei geaendert, ob das Suchfeld ueber der Liste steht (ab sieben), wird
       der Block neu gebaut: er entscheidet das nur beim Bau. Bereits Gewaehltes bleibt gewaehlt. */
    function topicsNeu(p) {
      if (!p || popup !== p || p.art !== "anlegen") return;
      var box = p.api.body.querySelector('.uev-schritt[data-schritt="2"]');
      if (!box || !box.__uevGebaut) return;
      var hatSuche = !!box.querySelector(".uev-topicsuche");
      if (hatSuche !== (topicsAlle().length > 6)) {
        box.innerHTML = umfangFelder(p.e);
        var ts = box.querySelector(".uev-topicsuche");
        if (ts) ts.value = p.topicSuche || "";
      }
      topicsZeigen(); umfangNeu(); vorschauAnfordern(); knoepfeSync();
    }
    function topicUmschalten(id) {
      var p = popup;
      if (!p || id == null) return;
      id = String(id);
      var i = p.e.topics.indexOf(id);
      if (i >= 0) p.e.topics.splice(i, 1); else p.e.topics.push(id);
      feldFehler("topics", "");
      topicsZeigen();
      /* Der Fokus bleibt auf der Zeile, die gerade umgeschaltet wurde -- sie ist neu gezeichnet. */
      var z = im('.uev-topicitem[data-topic-id="' + id.replace(/"/g, "") + '"]');
      try { if (z && document.activeElement && document.activeElement.classList && document.activeElement.classList.contains("uev-topicitem")) z.focus(); } catch (e) {}
      vorschauAnfordern();
    }
    function umfangFelder(e) {
      var viele = topicsAlle().length > 6;
      /* Immer genau EINE Stufe gewaehlt: ein Wert ausserhalb von topics/all (aus einem alten Stand)
         liesse beide Knoepfe ohne Streifen stehen und die Liste zu (17.10., Nutzer: "keine der beiden
         Optionen ausgewaehlt"). Topics ist der Vorgang des Anlegens. */
      /* Event Tracking misst gegen eine Kontrollgruppe -- die gibt es nur mit Topics (19.10.). "All active Prompts" ist weg: wer alle
         Prompts beobachten will, legt ein Citation Tracking an. */
      e.modus = "topics";
      return feld("Affected scope",
        '<div class="uev-umfang">' +
          '<div class="uev-klapp uev-umfang-klapp is-offen"><div class="uev-klapp-in"><div class="uev-umfang-topics uev-topicbox">' +
            (viele ? '<div class="up-ment-searchwrap uev-topicsuche-w">' +
              '<input class="up-ment-search uev-topicsuche" type="text" placeholder="' + esc(t("Search topics")) + '" autocomplete="off" spellcheck="false" aria-label="' + esc(t("Search topics")) + '"/>' +
              '<button class="up-ment-searchclear uev-topicsuche-x" type="button" aria-label="' + esc(t("Clear search")) + '">' + UC.icon("x", 2) + '</button></div>' : '') +
            '<div class="up-filter-list uev-topicliste" role="group" aria-label="' + esc(t("Topics")) + '"></div>' +
            '<div class="uev-topicfuss"></div>' +
          '</div></div></div>' +
          '<p class="uev-umfang-zahl" aria-live="polite"></p>' +
        '</div>', false, "topics");
    }
    /* ---- SCHRITT 3: "WHAT SHOULD WE TRACK?" (15.10.) ---------------------------------------
       Ein EIGENER Schritt (Nutzer: "weil man das sonst haeufig uebersieht"). Seit dem 15.10. spaet
       (Nutzer: "Die URL-Eingabe muss der primaere Input sein, die Auswahlen eher sekundaer
       darunter") von oben nach unten: EIN Eingabefeld, darunter die Schreibweise der Regel, dann
       die Wahl der Art, zuletzt Liste und Vorschau. Das Feld schlaegt die passende Art vor (Host ->
       Domain, Host + Pfad -> Pfad, mehrere Eintraege -> URLs), bis jemand selbst eine waehlt --
       nichts ist vorgewaehlt, "Continue" wartet auf eine Entscheidung, auch wenn sie "Brand metrics
       only" heisst. Mehrere Ziele gehen, jedes einzeln entfernbar. Mit Zielen in der Datenbank
       kommen die Live-Vorschau (preview_impact_event_targets_v1, verzoegert beim Tippen), "Count
       as your domain" und der Sitemap-Waehler dazu. Dieselben Teile stehen im Add-Dialog eines
       Events (p.art "ziel"), dort ohne "Brand metrics only". */
    /* "Brand metrics only" steht ZULETZT (Nutzer 15.10. spaet): es heisst "keine URLs" und ist
       damit die Ausnahme zu dem, was das Feld darueber anbietet. */
    var ARTEN = [
      { k: "url", titel: "Specific URLs", ic: "link", bsp: "example.com/blog/launch" },
      { k: "path", titel: "Everything under a path", ic: "folder", bsp: "example.com/blog/*" },
      { k: "host", titel: "Whole domain", ic: "globe", bsp: "example.com/*" },
      { k: "marke", titel: "Brand metrics only", ic: "chartSpline", satz: "Visibility, rank and sentiment" }
    ];
    var ART_NAME = { url: "URL", path: "Path", host: "Domain", host_all: "Domain and subdomains" };
    var ART_PLATZHALTER = { url: "Search your URLs or paste links", path: "Search or paste a path, e.g. example.com/blog",
      host: "Search or paste a domain, e.g. example.com", "": "Search or paste a URL, a path or a domain" };
    function zieleDa() { return !demo && ZIELE_DA.stand === true; }
    /* Ohne Regeln in der Datenbank gibt es nur URLs -- dann darf das Feld auch nicht "a path or a
       domain" anbieten (gemessen 15.10. spaet im Rueckfall: der Platzhalter versprach Pfad und
       Domain, eingetragen wurde beides als URL). */
    function platzhalter(art) { return t(ART_PLATZHALTER[art || (zieleDa() ? "" : "url")]); }
    /* Da, solange nichts Gegenteiliges feststeht (SITEMAP_DA.stand false erst nach einem echten Abruf). */
    function sitemapDa() { return zieleDa() && SITEMAP_DA.stand !== false; }
    function artenFuer(p) {
      return ARTEN.filter(function (a) {
        if (a.k === "marke") return p.art === "anlegen" && !(p.e && p.e.art === "watch");
        return a.k === "url" || zieleDa();
      });
    }
    /* Die Art, als die eine Eingabe gelesen wird: "host" mit dem Schalter wird host_all. Ist noch
       keine gewaehlt, gilt der Vorschlag aus der Eingabe -- das Feld steht schon vor der Wahl da,
       damit es die Art vorschlagen kann. */
    function leseArt(e) {
      var a = e.zielArt;
      if (!a || a === "marke") {
        var v = artVorschlag(e.eingabe);
        /* Ohne Regeln in der Datenbank ist jede Eingabe eine URL (gemessen 15.10.: sonst landete
           "lee-up.de/blog" als Pfad in der Liste, den v2 gar nicht kennt). */
        return v && v !== "sitemap" && (v === "url" || zieleDa()) ? v : "url";
      }
      return a === "host" && e.unterdomains ? "host_all" : a;
    }
    /* Wie viele Ziele noch dazukommen duerfen (16.10.). Die Datenbank rechnet je EVENT, nicht je
       Dialog: add_impact_event_target_v1 lehnt ab, wenn vorhandene URLs + Regeln + neue mehr als
       ZIEL_MAX sind (gelesen 16.10.; targets[] von get_impact_event_v3 traegt beide). Bis 16.10.
       zaehlte die Oberflaeche im Add-Dialog nur die eigene Liste -- bei 45 vorhandenen liessen sich
       50 sammeln, und erst "Add" scheiterte. Ohne Regeln in der Datenbank (v2): URL_MAX je Event,
       im Add-Dialog eine URL auf einmal, wie bisher. */
    function zielZahlImEvent(p) {
      var d = p.art === "ziel" ? state.detail[p.eventId] : null;
      if (!d) return 0;
      if (zieleDa() && isArr(d.targets)) return d.targets.length;
      return isArr(d.urls) ? d.urls.length : 0;
    }
    function zielFrei(p) {
      var frei = (zieleDa() ? ZIEL_MAX : URL_MAX) - zielZahlImEvent(p) - p.e.ziele.length;
      if (!zieleDa() && p.art === "ziel") frei = Math.min(frei, 1 - p.e.ziele.length);
      return Math.max(0, frei);
    }
    /* Der Satz, wenn mehr kommen sollen, als frei ist: wie viele noch gehen, oder dass keins mehr
       geht. */
    function zuVielText(p) {
      var frei = zielFrei(p);
      if (!zieleDa()) return p.art === "ziel" && frei ? t("Add one URL at a time.") : fehlerText("impact_event_too_many_urls");
      if (!frei) return fehlerText("impact_event_too_many_targets");
      return frei === 1 ? t("You can add 1 more target to this event.") : ersetze(t("You can add {n} more targets to this event."), { n: zahl(frei) });
    }
    /* Der Satz unter dem Schalter sagt, was er bewirkt -- mit dem Host aus dem Feld, solange einer
       dasteht (17.10., Beschluss: eine Domain ohne Pfad heisst mit allen Subdomains). */
    function unterSatz(e) {
      var tl = eingabeTeile(e.eingabe), z = tl.length === 1 ? zerlegen(tl[0]) : null, h = z && hostOk(z.host) ? z.anzeige : "example.com";
      /* Das Beispiel nennt die Unterdomain, die mitzaehlt oder nicht (18.10., Nutzer: die alte Fassung zeigte blog.example.com/*
         als Beispiel der GANZEN Domain und die Domain ohne Sub als Ergebnis des Schalters, also verkehrt herum). */
      return ersetze(t(e.unterdomains ? "Counts {host} and every subdomain, such as {sub}, including pages added later." : "Only {host} itself. Pages on {sub} are not counted."), { host: h, sub: "blog." + h });
    }
    function unterSatzNeu(p) {
      var el = im(".uev-unter-satz");
      if (el) el.textContent = unterSatz(p.e);
    }
    function artenHtml(p) {
      var l = artenFuer(p), e = p.e;
      /* Im Add-Dialog ohne Regeln bleibt nur "Specific URLs" -- eine Wahl mit einer Moeglichkeit
         ist keine. */
      if (p.art === "ziel" && l.length < 2) return "";
      var fokusbar = l.some(function (a) { return a.k === e.zielArt; }) ? e.zielArt : l[0].k;
      return '<div class="uev-arten" role="radiogroup" aria-label="' + esc(t("What should we track?")) + '">' + l.map(function (a) {
        var an = a.k === e.zielArt;
        var unter = a.k === "host" ? klapp(an, '<div class="uev-unter"><span class="uev-unter-lbl" id="uev-unter-' + instanceId + '">' + esc(t("Include all subdomains")) + '</span>' +
          '<span class="up-switch' + (e.unterdomains ? " is-on" : "") + '" role="switch" tabindex="0" aria-checked="' + !!e.unterdomains + '" aria-labelledby="uev-unter-' + instanceId + '" data-unterdomains></span></div>' +
          '<p class="uev-unter-satz" aria-live="polite">' + esc(unterSatz(e)) + '</p>', "uev-unter-klapp") : "";
        return '<div class="uev-art-w' + (an ? " is-on" : "") + '" data-art-w="' + a.k + '">' +
          '<button type="button" class="uev-art' + (an ? " is-on" : "") + '" role="radio" aria-checked="' + an + '" tabindex="' + (a.k === fokusbar ? 0 : -1) + '" data-art="' + a.k + '">' +
            '<span class="uev-art-punkt" aria-hidden="true"></span>' +
            '<span class="uev-art-ic" aria-hidden="true">' + UC.icon(a.ic, 2) + '</span>' +
            '<span class="uev-art-txt"><span class="uev-art-t">' + esc(t(a.titel)) + '</span>' +
              (a.satz ? '<span class="uev-art-s">' + esc(t(a.satz)) + '</span>'
                      : '<span class="uev-notation is-leise uev-art-bsp">' + esc(a.bsp) + '</span>') +
            '</span>' +
          '</button>' + unter +
        '</div>';
      }).join("") + '</div>';
    }
    /* Das Feld: Eingabe und "Add" gleich hoch (40, --up-h-gross; Nutzer 15.10. spaet: "der
       Add-Button ist kleiner als das Inputfeld, sieht inkonsistent aus"). Darunter die
       Schreibweise, die Fehlerzeile und die Treffer der URL-Suche -- direkt am Feld, zu dem sie
       gehoeren. "Load from sitemap" steht NICHT mehr hier, sondern rechts im Kopf des Feldes
       (zielKopf): zwischen Eingabe und Ergebnissen unterbrach es den Fluss.
       DIE VORSCHLAEGE DER VORSCHAU (17.10., Nutzer: "unters Feld und aufgeraeumter") stehen in
       derselben Spalte wie das Feld (.uev-feldspalte) und damit genau so breit wie es, nicht wie
       Feld plus "Add" -- siehe vorschlaegeZeigen. */
    function eingabeHtml(p) {
      var e = p.e, art = e.zielArt && e.zielArt !== "marke" ? e.zielArt : "";
      return '<div class="uev-zieleingabe">' +
          '<div class="uev-zielzeile">' +
            '<div class="uev-feldspalte">' +
              '<div class="uev-urlsuche"><span class="uev-urlsuche-ic">' + UC.icon(ART_ZEICHEN[art] || "link", 2) + '</span>' +
                '<textarea class="up-topicmodal-name uev-urlein uev-zielein" rows="1" placeholder="' + esc(platzhalter(art)) + '" autocomplete="off" spellcheck="false" inputmode="url"' +
                  ' aria-label="' + esc(platzhalter(art)) + '" role="combobox" aria-expanded="false" aria-autocomplete="list" aria-haspopup="listbox">' + esc(e.eingabe || "") + '</textarea></div>' +
              klapp(false, '<div class="uev-urltreffer" role="listbox"></div>', "uev-treffer-klapp") +
              klapp(false, '<div class="uev-vorschlaege" aria-live="polite"></div>', "uev-vorschlag-klapp") +
            '</div>' +
            '<button type="button" class="up-btn-sec is-lg uev-zielhinzu" disabled>' + esc(t("Add")) + '</button>' +
          '</div>' +
          '<div class="uev-schreibweise" aria-live="polite"></div>' +
          feldFehlerHtml("ziele") +
        '</div>';
    }
    /* Der Kopf des Feldes: links das Etikett, rechts "Load from sitemap" als leiser Knopf -- ein
       zweiter Weg zu derselben Eingabe, darum neben ihrem Etikett und nicht im Fluss darunter.
       Die Huelle .uev-sm-knopfzeile bleibt: smZeichnen blendet sie bei offenem Waehler aus, und
       fehlt die Function, nimmt smLaden sie ganz heraus. Zeichen seit dem 16.10. FolderTree
       (Nutzer bestellt; vorher "folders", das Team-Symbol der Leiste). */
    function zielKopf(p) {
      var lbl = zieleDa() ? "URLs, paths or domains" : p.art === "ziel" ? "URL" : "URLs";
      return '<div class="uev-zielkopf"><span class="up-topicmodal-label">' + esc(t(lbl)) + '</span>' +
        (sitemapDa() ? '<span class="uev-sm-knopfzeile"><button type="button" class="up-quietbtn uev-sm-auf">' + UC.icon("folderTree", 2) + '<span>' + esc(t("Load from sitemap")) + '</span></button></span>' : '') +
      '</div>';
    }
    /* Vier Teile untereinander, ohne Kasten im Kasten (Nutzer 15.10. spaet: "mehr Raum zu atmen,
       trenne wenn noetig mit Separatoren"): Eingabe, Art, Ergebnis (Liste und Vorschau), der
       offene Sitemap-Waehler. Zwischen zwei sichtbaren Teilen eine Linie; ein leerer Teil steht
       gar nicht da (CSS, :has) -- so traegt keine Aenderung irgendwo eine Linie ueber nichts. Der
       Sitemap-Waehler steht ZULETZT: offen reisst er Eingabe und Vorschau nicht auseinander. */
    function zielFelder(p) {
      var e = p.e;
      return '<div class="uev-ziel">' +
          '<div class="up-topicmodal-field uev-ziel-teil uev-eingabe-teil">' + zielKopf(p) +
            (p.art === "ziel" ? '<p class="up-modal-hinweis">' + esc(t(zieleDa() ? "Rules count retroactively, also for pages that were cited before you add them."
              : "Observations are counted from the event date, also for URLs you add now.")) + '</p>' : '') +
            '<div class="uev-eingabe-ort">' + eingabeHtml(p) + '</div>' +
          '</div>' +
          '<div class="up-topicmodal-field uev-ziel-teil uev-arten-teil">' +
            '<span class="up-topicmodal-label">' + esc(t("What should we track?")) + '</span>' +
            '<div class="uev-arten-ort">' + artenHtml(p) + '</div>' +
            '<p class="up-modal-hinweis uev-arthinweis"' + (e.zielArt ? ' hidden' : '') + '>' + esc(t("Choose what to track.")) + '</p>' +
          '</div>' +
          '<div class="uev-ziel-teil uev-ergebnis">' +
            '<div class="uev-zielliste"></div>' +
            '<div class="uev-vz" aria-live="polite"></div>' +
          '</div>' +
          '<div class="uev-sm-ort"></div>' +
        '</div>';
    }
    /* Schritt 4 (16.10. umgebaut, Nutzer: "Der Picker der Titelbilder ist mir zu prominent"):
       OBEN die Vorschau der Karte, schon mit einem zufaelligen Titelbild (coverZufall). Das Bild
       aendert ein kleiner Knopf unten rechts im Band, der beim Ueberfahren erscheint; er klappt die
       Kacheln unter der Vorschau auf, dort auch "Remove cover". Darunter der Schalter fuer die
       Seitenleiste, dann was getrackt wird (kurz) und das Schloss. Der Bearbeiten-Dialog behaelt
       das offene Raster (coverFeld): er hat keine Vorschau, an der ein Knopf stehen koennte. */
    function pruefFelder(e) {
      if (e.art === "watch") return feld("Name", '<input type="text" class="up-topicmodal-name" data-feld="name" maxlength="' + NAME_MAX + '" autocomplete="off" spellcheck="false"' +
          ' placeholder="' + esc(t("e.g. Help center pages")) + '" value="' + esc(e.name) + '"/>', false, "name") +
        '<div class="uev-vorschaublock"><div class="uev-pruef"></div>' + coverWahlHtml(e) + anheftenHtml(e) + '</div>' + feld("Tracking", '<div class="uev-pruefziele"></div>') + gesperrtHinweis("The type can't be changed later");
      return '<div class="uev-vorschaublock"><div class="uev-pruef"></div>' + coverWahlHtml(e) + anheftenHtml(e) + notifySchalterHtml(e) + '</div>' +
        feld("Tracking", '<div class="uev-pruefziele"></div>') +
        gesperrtHinweis(startSatz(e));
    }
    /* Der Satz unter dem Pruefen: ein Event, das erst beginnt, ist bis dahin komplett aenderbar --
       "can't be changed later" stimmt nur fuer einen Start bis heute (Audit EV-05). */
    function startSatz(e) {
      return kampagneDa() && e && e.datum && e.datum > heuteIso() ? "Planned events can be fully edited until they start." : "Date and scope can't be changed later";
    }
    /* Die Kacheln unter der Vorschau, zugeklappt bis zum Klick auf den Knopf im Band. Dieselben
       Kacheln und dieselbe Fusszeile wie coverFeld -- coverNeu stellt beide gleich. Die
       Fehlerzeile des Felds "cover" steht hier; ein Fehler klappt die Wahl auf (feldFehlerZeigen). */
    function coverWahlHtml(e) {
      return klapp(false, '<div class="uev-cover-wahl-in" id="uev-cover-wahl-' + esc(instanceId) + '">' +
          '<div class="uev-cover-raster" role="group" aria-label="' + esc(t("Cover image")) + '">' + coverKacheln(e) + '</div>' +
          klapp(!!e.cover, '<div class="uev-cover-fuss"><button type="button" class="up-quietbtn uev-cover-weg">' + esc(t("Remove cover")) + '</button></div>', "uev-cover-klapp") +
          feldFehlerHtml("cover") +
        '</div>', "uev-cover-wahl");
    }
    /* Der Knopf im Band der Vorschau. Ohne Titelbild heisst er "Add cover" und steht an derselben
       Stelle -- der Weg zurueck zu einem Bild ist derselbe. */
    function coverKnopfHtml(p) {
      var offen = !!p.coverOffen;
      return '<div class="uev-cover-aktion' + (offen ? " is-offen" : "") + '">' +
        '<button type="button" class="up-btn-sec uev-cover-knopf" aria-expanded="' + offen + '" aria-controls="uev-cover-wahl-' + esc(instanceId) + '">' +
          UC.icon("image", 2) + '<span>' + esc(t(p.e.cover ? "Change cover" : "Add cover")) + '</span></button></div>';
    }
    function coverWahlSchalten(p, auf) {
      p.coverOffen = !!auf;
      klappen(im(".uev-cover-wahl"), p.coverOffen);
      var a = im(".uev-cover-aktion"), b = im(".uev-cover-knopf");
      if (a) a.classList.toggle("is-offen", p.coverOffen);
      if (b) b.setAttribute("aria-expanded", String(p.coverOffen));
    }
    /* EIN ZUFAELLIGES TITELBILD, EINMAL (16.10.): beim ersten Oeffnen von Schritt 4, und nur, wenn
       noch keins gewaehlt ist. Danach ist entschieden -- Zurueck und wieder Vor wuerfelt nicht neu,
       und ein bewusst entferntes Bild bleibt weg. Das Motiv steht schon beim Oeffnen des Popups
       fest (popupAnlegen) und laedt dort vor, damit die Vorschau es ohne Skelett zeigt. Nur im
       Anlegen: ein bestehendes Event bekommt nie ein Bild aus dem Zufall. */
    /* Welches Motiv (18.10., Nutzer): erst eins, das kein Event des Teams schon traegt; sind alle vergeben, das am
       seltensten vergebene. Unter gleich seltenen entscheidet der Zufall wie bisher. Gezaehlt wird die schon geladene
       Liste, keine neue Abfrage. */
    function coverWahl(art) {
      var n = {}, satz = coversFuer(art);
      satz.forEach(function (c) { n[c.key] = 0; });
      (UC.getEvents ? UC.getEvents() : []).forEach(function (ev) { if (ev && !state.geloescht[ev.id] && n[ev.cover] != null) n[ev.cover]++; });
      var min = Infinity;
      satz.forEach(function (c) { if (n[c.key] < min) min = n[c.key]; });
      var frei = satz.filter(function (c) { return n[c.key] === min; });
      return frei[Math.floor(Math.random() * frei.length)].key;
    }
    function coverZufall(p) {
      if (p.art !== "anlegen" || p.e.coverEntschieden) return;
      p.e.coverEntschieden = true;
      if (!p.e.cover && p.zufallsCover) p.e.cover = p.zufallsCover;
    }
    /* Der Schalter unter der Vorschau. Angeheftet wird erst, wenn das Anlegen gelungen ist und die
       Kennung da ist (popupDetailKam) -- scheitert es, haengt nichts in der Leiste. */
    function anheftenHtml(e) {
      if (!pinDa()) return "";
      return '<button type="button" class="uev-anheften" role="switch" aria-checked="' + !!e.anheften + '" data-anheften>' +
        '<span class="uev-anheften-txt">' + esc(t("Pin to sidebar")) + '</span>' +
        '<span class="up-switch' + (e.anheften ? " is-on" : "") + '" aria-hidden="true"></span></button>';
    }
    /* "Notify me" unter "Pin to sidebar": derselbe Baustein, dazu der Satz unter der Beschriftung. */
    function notifySchalterHtml(e) {
      meldAnstossen();
      if (!meldDa()) return "";
      var an = e.notify !== false;
      return '<button type="button" class="uev-anheften uev-notify" role="switch" aria-checked="' + an + '" data-notify>' +
        '<span class="uev-anheften-txt uev-notify-txt"><span>' + esc(t("Notify me")) + '</span>' +
          '<span class="uev-notify-satz">' + esc(notifySatz(e)) + '</span></span>' +
        '<span class="up-switch' + (an ? " is-on" : "") + '" aria-hidden="true"></span></button>';
    }
    function notifyNeu(p) {
      var b = im("[data-notify]");
      if (!b) return;
      b.setAttribute("aria-checked", String(p.e.notify !== false));
      var sw = b.querySelector(".up-switch");
      if (sw) sw.classList.toggle("is-on", p.e.notify !== false);
    }
    /* Kam die Antwort aus core erst nach dem Zeichnen von Schritt 4: den Schalter nachtragen. */
    function notifyNachtragen() {
      var blk = im(".uev-vorschaublock");
      if (!blk || !popup || blk.querySelector("[data-notify]")) return;
      blk.insertAdjacentHTML("beforeend", notifySchalterHtml(popup.e));
    }
    function anheftenNeu(p) {
      var b = im("[data-anheften]");
      if (!b) return;
      b.setAttribute("aria-checked", String(!!p.e.anheften));
      var sw = b.querySelector(".up-switch");
      if (sw) sw.classList.toggle("is-on", !!p.e.anheften);
    }
    function pruefZieleZeigen() {
      var p = popup, el = im(".uev-pruefziele");
      if (!el) return;
      var e = p.e;
      if (e.zielArt !== "marke" && e.ziele.length) {
        el.innerHTML = '<div class="uev-pruefliste">' + e.ziele.map(function (z) {
          return '<span class="uev-pruefziel"><span class="uev-ziel-ic">' + zielFavKlein(zielHost(z) || z.input, UC.icon(ART_ZEICHEN[z.kind] || "link", 2)) + '</span>' +
            '<span class="uev-notation">' + esc(z.zeigen) + '</span></span>';
        }).join("") + '</div>';
      } else el.innerHTML = '<span class="uev-pruefmarke">' + UC.icon("chartSpline", 2) + '<span>' + esc(t("Brand metrics only")) + '</span></span>';
    }

    /* Ein Eintrag als Ziel der Art, in der er gelesen wird. Eine Domain hat keinen Pfad: unter "Whole
       domain" gaebe zielBauen sonst still nur den Host zurueck und liesse den Pfad weg -- jetzt gilt der
       Eintrag als nicht passend, und die Zeile unter dem Feld sagt (vorhandener Text), was erwartet
       wird. */
    function zielLesen(text, art) {
      if (art === "host" || art === "host_all") {
        var z = zerlegen(text);
        if (z && z.pfad) return { fehler: "host", roh: String(text || "").trim() };
      }
      return zielBauen(text, art);
    }
    /* Die Eingabe lesen: jeder Eintrag als Ziel der gewaehlten Art. */
    function eingabeLesen(p) {
      var e = p.e, art = leseArt(e), teile = eingabeTeile(e.eingabe), gut = [], schlecht = [];
      teile.forEach(function (x) { var z = zielLesen(x, art); if (z.fehler) schlecht.push(z); else gut.push(z); });
      return { teile: teile, gut: gut, schlecht: schlecht, vorschlag: artVorschlag(e.eingabe) };
    }
    /* Steht dieses Ziel schon in der Liste oder (im Add-Dialog) schon im Event? */
    function zielImEvent(p, z) {
      if (p.art !== "ziel") return false;
      var d = state.detail[p.eventId];
      if (!d) return false;
      if (isArr(d.targets) && d.targets.some(function (x) { var y = zielAusDb(x); return y && y.key === z.key; })) return true;
      return z.kind === "url" && isArr(d.urls) && d.urls.some(function (u) { return "url|" + urlSchluessel(u.url) === z.key; });
    }
    /* Faellt dieses Ziel (im Add-Dialog) unter eine Regel, die das Event schon hat? Gibt die Regel
       zurueck, sonst null -- nur fuer den leisen Satz am Feld, es sperrt nicht (warum: deckendeRegel). */
    function zielInEventRegel(p, z) {
      if (p.art !== "ziel") return null;
      var d = state.detail[p.eventId];
      if (!d || !isArr(d.targets)) return null;
      var l = [];
      d.targets.forEach(function (x) { var y = zielAusDb(x); if (y && y.kind !== "url") l.push(y); });
      return deckendeRegel(l, z);
    }
    function zielGewaehlt(p, z) { return p.e.ziele.some(function (x) { return x.key === z.key; }); }
    /* Wie viele Eintraege der Eingabe NEU waeren (nicht schon in der Liste oder im Event, jeder
       einmal) -- daran misst der Deckel eine eingefuegte Liste, bevor jemand "Add" drueckt. */
    function eingabeNeu(p, r) {
      var da = {};
      return r.gut.filter(function (z) { if (da[z.key] || zielInListe(p, z) || zielImEvent(p, z)) return false; da[z.key] = 1; return true; }).length;
    }
    /* Steht GENAU dieses Ziel schon in der Liste? Gibt den Eintrag zurueck, sonst null. Genau heisst
       derselbe Schluessel (zielBauen): Gross/Klein am Host, Schraegstrich am Ende, Fragment und
       Sternchen zaehlen nicht, www und Schema bei einer URL schon (url_norm_v1) -- das sind zwei
       Ziele. Ein Ziel UNTER einer Regel der Liste ist seit 17.10. kein Doppel mehr (deckendeRegel). */
    function zielInListe(p, z) {
      var l = p.e.ziele, i;
      for (i = 0; i < l.length; i++) if (l[i].key === z.key) return l[i];
      return null;
    }
    /* Die Regel der Liste oder des Events, unter die z schon faellt -- fuer den leisen Satz. */
    function zielUnterRegel(p, z) { return deckendeRegel(p.e.ziele, z) || zielInEventRegel(p, z); }
    /* Die Regel einer Liste, unter die z faellt (ohne genau gleiche Eintraege), sonst null. Dieselbe
       Pfadgrenze wie die Datenbank und der Sitemap-Waehler (smVorhanden, Vertrag Abschnitt 1):
       /blog deckt /blog und /blog/..., nicht /blogger; die Query zaehlt nicht; host_all deckt jede
       Unterdomain, host nur genau diesen Host.
       GEDECKT IST KEIN DOPPEL (17.10., Nutzer: "Bitte ja, alles konsistent machen."): das Detail
       wertet JEDES Ziel fuer sich aus -- ein url-Ziel bekommt seine eigene Zeile in "URLs"
       mit First cited, Global share vorher und nachher und Change (auch ungezitiert), ein Pfad
       seinen eigenen Abschnitt mit Kennzahlen und Verlauf (get_impact_event_v3 targets[],
       analysis_v3 je Ziel, Responses je p_event_target_id). Die Domain-Regel zeigt dieselbe Seite
       erst, sobald sie zitiert ist, und ohne eigenen Vorher-Wert. Eine Seite unter einer Regel ist
       also eine eigene Zeile mit eigenem Vorher-Wert: sie kommt dazu -- am Feld, im Assistenten wie
       im Add-Dialog, und im Sitemap-Waehler --, und es steht nur leise da, unter welcher Regel sie
       schon mitzaehlt. Doppel sind allein genau gleiche Ziele (zielInListe, zielImEvent). */
    function deckendeRegel(l, z) {
      var i, a = zerlegen(z.input);
      if (!a || !a.host) return null;
      for (i = 0; i < l.length; i++) {
        var x = l[i], r = x.kind === "url" || x.key === z.key ? null : zerlegen(x.input);
        if (!r || !r.host) continue;
        if (x.kind === "host_all" ? !(a.host === r.host || a.host.slice(-r.host.length - 1) === "." + r.host) : a.host !== r.host) continue;
        if (x.kind === "path") {
          if (z.kind !== "host" && z.kind !== "host_all" && (a.pfad === r.pfad || a.pfad.indexOf(r.pfad + "/") === 0)) return x;
          continue;
        }
        if (x.kind === "host" && z.kind === "host_all") continue;
        return x;
      }
      return null;
    }
    function schlechtText(z) {
      if (z.fehler === "pfad") return t("Please add a path, e.g. example.com/blog.");
      return z.roh ? ersetze(t("This can't be used: {wert}"), { wert: z.roh }) : t("Please enter a valid domain.");
    }
    /* Der Satz am Feld, wenn Eintraege der Eingabe nicht gehen (EV-07): er NENNT sie. Bis 17.10. stand
       dort "Enter a domain like example.com." ohne zu sagen, welche Zeile gemeint war, und ein einziger
       Eintrag sperrte "Add" fuer alle uebrigen. */
    function schlechteNennen(schlecht) {
      var z = schlecht[0], satz = z.fehler === "pfad" ? ersetze(t("{ziel}: Please add a path, e.g. example.com/blog."), { ziel: z.roh })
        : ersetze(t("{ziel}: Enter a domain like example.com."), { ziel: z.roh });
      return schlecht.length > 1 ? satz + " " + ersetze(t("and {n} more"), { n: schlecht.length - 1 }) : satz;
    }
    /* Die Eingabe in die Liste uebernehmen (Knopf "Add", Enter, "Continue"). false: es gab einen
       Grund, nichts zu uebernehmen -- er steht am Feld, die Eingabe bleibt stehen. */
    function eingabeUebernehmen(p) {
      var r = eingabeLesen(p);
      if (!r.teile.length) return true;
      if (r.vorschlag === "sitemap") {
        if (sitemapDa()) { smOeffnen(p, r.teile[0], true); return false; }
        feldFehler("ziele", t("This looks like a sitemap. Please add the pages or the domain instead."));
        return false;
      }
      /* Nur der betroffene Eintrag bekommt den Fehler (EV-07): die uebrigen gueltigen kommen in die Liste,
         der ungueltige bleibt im Feld stehen, mit Namen. Gar nichts Gueltiges: der Fehler allein. */
      if (r.schlecht.length && !r.gut.length) { feldFehler("ziele", r.schlecht.length > 1 ? schlechteNennen(r.schlecht) : schlechtText(r.schlecht[0])); return false; }
      /* EIN DOPPEL SPERRT NICHTS MEHR (16.10. spaet, Nutzer: nach Back aus Schritt 4 dieselbe URL
         noch einmal eingegeben -> "Dieses Ziel steht schon in der Liste.", und Continue ging erst
         nach dem Leeren des Feldes weiter). Was GENAU so schon in der Liste steht, faellt still
         heraus: das Feld wird leer, die vorhandene Zeile leuchtet kurz auf und kommt ins Bild, und
         am Feld steht leise, wo es schon ist -- kein Fehler, denn das Ziel ist ja getrackt. Ebenso
         im Add-Dialog ein Ziel, das das Event schon hat; nur wenn dort NICHTS Neues bleibt und die
         Liste leer ist, sagt der Fehler, dass es nichts hinzuzufuegen gibt (sonst schlosse "Add"
         den Dialog, ohne etwas zu tun). Ein Ziel unter einer Regel der Liste oder des Events kommt
         seit 17.10. dazu (deckendeRegel), mit leisem Satz. */
      var neu = [], schon = [], imEvent = 0, da = {}, regelNotiz = null;
      p.schreibNotiz = null;
      r.gut.forEach(function (z) {
        if (da[z.key]) return;
        da[z.key] = 1;
        var x = zielInListe(p, z);
        if (x) { if (schon.indexOf(x) < 0) schon.push(x); if (!p.schreibNotiz) p.schreibNotiz = { z: z, x: x }; }
        else if (zielImEvent(p, z)) { imEvent++; if (!p.schreibNotiz) p.schreibNotiz = { z: z }; }
        else {
          neu.push(z);
          var rg = zielUnterRegel(p, z);
          if (rg && !regelNotiz) regelNotiz = { z: z, x: rg, eigen: true };
        }
      });
      /* Die Notiz zum Doppel geht vor (sie erklaert, warum etwas NICHT dazukam); sonst die zur
         eigenen Zeile unter einer Regel der Liste oder des Events. */
      if (!p.schreibNotiz) p.schreibNotiz = regelNotiz;
      if (!neu.length && imEvent && !p.e.ziele.length) { p.schreibNotiz = null; feldFehler("ziele", fehlerText(zieleDa() ? "impact_event_target_duplicate" : "impact_event_url_duplicate")); return false; }
      if (neu.length > zielFrei(p)) { p.schreibNotiz = null; feldFehler("ziele", zuVielText(p)); return false; }
      neu.forEach(function (z) { p.e.ziele.push(z); });
      if (neu.length) artNachZiel(p, neu[0]);
      /* Ungueltige Eintraege bleiben im Feld (je Zeile), damit sie sich korrigieren lassen. */
      p.e.eingabe = r.schlecht.map(function (z) { return z.roh; }).join("\n");
      var inp = im(".uev-zielein");
      if (inp) { inp.value = p.e.eingabe; feldHoehe(inp); }
      p.such.frage = ""; p.such.treffer = null; p.such.laedt = false; p.such.fehler = ""; p.such.fuer = ""; p.such.aktiv = -1;
      if (p.maschine) p.maschine.abbrechen();
      p.api.fehler("");
      zieleZeigen(p);
      if (!neu.length && schon.length) zielBlitz(p, schon);
      if (r.schlecht.length) { feldFehler("ziele", schlechteNennen(r.schlecht)); return false; }
      feldFehler("ziele", "");
      return true;
    }
    /* Die vorhandenen Zeilen kurz hervorheben und ins Bild holen (nearest: wer zu sehen ist,
       bleibt). Ueber die Stelle in der Liste, nicht ueber einen Text: zwei Ziele koennen gleich
       aussehen. */
    function zielBlitz(p, eintraege) {
      var reihen = p.api.el.querySelectorAll(".uev-zielliste .uev-urlwahl"), erste = null;
      eintraege.forEach(function (x) {
        var r = reihen[p.e.ziele.indexOf(x)];
        if (!r) return;
        r.classList.remove("is-blitz");
        void r.offsetWidth;   /* die Animation laeuft auch beim zweiten Mal von vorn */
        r.classList.add("is-blitz");
        if (!erste) erste = r;
      });
      try { if (erste) erste.scrollIntoView({ block: "nearest" }); } catch (e) {}
    }
    /* Ein Ziel kam dazu, aber noch keine Art ist gewaehlt (oder "Brand metrics only"): dann ist es
       jetzt die Art dieses Ziels -- sonst stuende ein Ziel in einer Liste, die nicht gilt. */
    function artNachZiel(p, z) {
      if (!z || (p.e.zielArt && p.e.zielArt !== "marke")) return;
      if (z.kind === "host" || z.kind === "host_all") { if (p.e.unterdomains !== (z.kind === "host_all")) unterdomainsUmschalten(p); }
      artWaehlen(p, z.kind === "host_all" ? "host" : z.kind, false);
    }
    /* Ein mehrzeiliges Feld waechst mit seinem Inhalt (bis fuenf Zeilen, dann scrollt es). */
    function feldHoehe(inp) {
      try { inp.style.height = ""; inp.style.height = Math.min(inp.scrollHeight + 2, 116) + "px"; } catch (e) {}
    }
    /* Alles in Schritt 3 neu: Wahl, Eingabe, Liste, Vorschau, Knoepfe. */
    function zieleZeigen(p, artenAuch) {
      if (!p || popup !== p) return;
      if (artenAuch) { var ao = im(".uev-arten-ort"); if (ao) ao.innerHTML = artenHtml(p); }
      var e = p.e, offen = e.zielArt !== "marke";
      var hw = im(".uev-arthinweis");
      if (hw) hw.hidden = !!e.zielArt;
      /* Das Feld bleibt auch bei "Brand metrics only" stehen (15.10. spaet): es steht jetzt OBEN,
         zugeklappt zoege es die Wahl darunter samt der eben geklickten Zeile unter dem Zeiger weg.
         Was dort getippt wird, schlaegt wie immer seine Art vor; Liste und Vorschau zeigen bei
         "Brand metrics only" weiter nichts (zielListeZeigen, vzListe). */
      var inp = im(".uev-zielein");
      if (inp) {
        var art = offen && e.zielArt ? e.zielArt : "";
        inp.placeholder = platzhalter(art); inp.setAttribute("aria-label", platzhalter(art));
        feldFavicon(p);
      }
      schreibweiseZeigen(p);
      zielListeZeigen(p);
      trefferZeigen();
      vzAnfordern(p);
      pruefenZeigen();
      knoepfeSync();
      /* Die Liste hat sich geaendert, der Waehler ist offen: sein Deckel und was "Already added"
         ist, haengen an ihr (16.10.: ein entferntes Ziel stand sonst bis zum naechsten Klick im
         Baum als getrackt da). */
      if (p.sm && p.sm.offen && p.sm.antwort && !p.sm.laeuft) smZeichnen(p);
    }
    /* DAS FAVICON IM FELD (16.10. spaet, Nutzer: "soll der Globus daneben direkt das Google-S2-
       Favicon dieser Domain anzeigen, wenn erreichbar"). Dieselbe Quelle wie die Zeilen der Liste
       (zielFavUrl: UC.faviconUrl, Google S2 ueber UC.fremdUrl). Damit beim Tippen nichts flackert:
       erst FELD_FAV_MS nach dem letzten Zeichen und nur fuer einen lesbaren Host (hostOk), und das
       Bild wird VORHER geladen, ausserhalb des Dokuments. Erst wenn es da ist und nicht Googles
       16px-Platzhalter ist (UC.favPlatzhalter, dieselbe Regel wie der Rueckfall in core), tritt es
       an die Stelle des Zeichens; sonst bleibt das Zeichen der Art (bei einer Domain der Globus).
       Ein Bild, das im Feld selbst scheitert, liesse den freien Globus aus core NEBEN dem Zeichen
       stehen. Je Host einmal gefragt (favGeprueft), auch ueber Dialoge hinweg. Mehrere Eintraege
       zeigen ein Favicon nur, wenn alle denselben Host haben. */
    var FELD_FAV_MS = 300, favGeprueft = {};
    function feldHost(p) {
      var tl = eingabeTeile(p.e.eingabe), h = "";
      for (var i = 0; i < tl.length; i++) {
        var z = zerlegen(tl[i]);
        if (!z || !hostOk(z.host) || (h && z.host !== h)) return "";
        h = z.host;
      }
      return h;
    }
    function feldZeichen(p) {
      var ic = im(".uev-zieleingabe .uev-urlsuche-ic");
      if (!ic) return;
      var art = p.e.zielArt && p.e.zielArt !== "marke" ? p.e.zielArt : "";
      var h = feldHost(p), src = h && favGeprueft[h] ? favGeprueft[h] : "";
      var sig = src || "ic:" + (ART_ZEICHEN[art] || "link");
      if (ic.getAttribute("data-zeichen") === sig) return;
      ic.setAttribute("data-zeichen", sig);
      ic.classList.toggle("has-fav", !!src);
      ic.innerHTML = src ? '<img class="uev-fav" src="' + esc(src) + '" width="16" height="16" alt="" referrerpolicy="no-referrer"/>' : UC.icon(ART_ZEICHEN[art] || "link", 2);
    }
    /* Sucht das Favicon eines Hosts, bei einer Unterdomain ohne eigenes (Googles Platzhalter oder
       ein Fehler) das der Eltern-Domain, dann das der naechsten (UC.faviconEltern, dieselbe Regel
       wie der Rueckfall der Bilder in core). fertig(src): die Adresse des ersten echten Bildes, "" wenn
       keines da ist -- dann bleibt das Zeichen der Art. */
    function favSuchen(h, fertig) {
      var src = zielFavUrl(h);
      if (!src) { fertig(""); return; }
      var img = new Image();
      img.referrerPolicy = "no-referrer";
      function weiter() {
        var el = UC.faviconEltern ? UC.faviconEltern(h) : "";
        if (el) favSuchen(el, fertig); else fertig("");
      }
      img.onload = function () {
        if (img.naturalWidth > 0 && !(UC.favPlatzhalter && UC.favPlatzhalter(img))) fertig(src); else weiter();
      };
      img.onerror = weiter;
      img.src = src;
    }
    function feldFavicon(p) {
      if (!p) return;
      clearTimeout(p.favUhr);
      feldZeichen(p);
      var h = feldHost(p);
      if (!h || favGeprueft[h] != null) return;
      p.favUhr = setTimeout(function () {
        if (popup !== p || feldHost(p) !== h || favGeprueft[h] != null) return;
        favSuchen(h, function (src) {
          favGeprueft[h] = src;
          if (popup === p) feldZeichen(p);
        });
      }, FELD_FAV_MS);
    }
    function artWaehlen(p, k, vonHand) {
      if (!p) return;
      /* EINE AUSDRUECKLICH GEWAEHLTE ART HAELT (17.10., Nutzer: "wie unglaublich unintuitiv waere es,
         wenn er dann wieder auf Domain umspringt"): ein Klick auf ein Radio setzt "von Hand" unabhaengig
         vom Feldinhalt, auch auf die schon gewaehlte, und es bleibt bis das Popup zu ist -- leeres Feld,
         Add und neue Eingabe aendern daran nichts. Nur wer nie gewaehlt hat, bekommt die Art aus der
         Eingabe vorgeschlagen (artVorschlag). */
      if (vonHand) p.e.artVonHand = true;
      if (k === p.e.zielArt) return;
      p.e.zielArt = k;
      feldFehler("ziele", "");
      var ws = p.api.el.querySelectorAll("[data-art]");
      for (var i = 0; i < ws.length; i++) {
        var an = ws[i].getAttribute("data-art") === k;
        ws[i].classList.toggle("is-on", an); ws[i].setAttribute("aria-checked", String(an)); ws[i].tabIndex = an ? 0 : -1;
        var w = ws[i].closest(".uev-art-w");
        if (w) w.classList.toggle("is-on", an);
      }
      klappen(im(".uev-unter-klapp"), k === "host");
      /* Die Suche folgt der Art: dieselbe Eingabe, anderer Bereich. */
      if (String(p.e.eingabe || "").trim()) sucheStarten(p);
      zieleZeigen(p);
    }
    /* Die Schreibweise der Eingabe, immer sichtbar: leer das Beispiel der gewaehlten Art, sonst
       das, was die Regel trifft. Eine .xml bekommt den Weg zum Sitemap-Waehler. */
    function schreibweiseZeigen(p) {
      var el = im(".uev-schreibweise"), knopf = im(".uev-zielhinzu");
      if (!el) return;
      var e = p.e, r = eingabeLesen(p), html = "", zuViel = false;
      var nz = p.schreibNotiz;
      unterSatzNeu(p);
      /* Der Satz zur eigenen Zeile gilt, solange Ziel UND Regel noch da sind -- eine entfernte
         Regel der Liste nimmt ihn mit. */
      if (!r.teile.length && nz && (nz.eigen ? zielGewaehlt(p, nz.z) && (zielGewaehlt(p, nz.x) || !!zielInEventRegel(p, nz.z)) : nz.x ? e.ziele.indexOf(nz.x) >= 0 : true) && e.zielArt !== "marke") {
        /* Das eben Eingegebene stand schon da (eingabeUebernehmen): leise sagen, wo -- bis zur
           naechsten Eingabe, und nur, solange der Eintrag noch in der Liste steht. */
        html = '<span class="uev-schreib-satz">' + esc(!nz.x ? fehlerText(zieleDa() ? "impact_event_target_duplicate" : "impact_event_url_duplicate")
          : nz.eigen ? ersetze(t("{ziel} is also covered by {regel} and gets its own row."), { ziel: nz.z.zeigen, regel: nz.x.zeigen })
          : ersetze(t("{ziel} is already in the list."), { ziel: nz.z.zeigen })) + '</span>';
      } else if (!r.teile.length) {
        var a = ARTEN.filter(function (x) { return x.k === e.zielArt; })[0];
        html = a && a.bsp ? '<span class="uev-schreib-lbl">' + esc(t("e.g.")) + '</span><span class="uev-notation is-leise">' + esc(a.bsp) + '</span>' : "";
        /* Die eigene Domain als ein Klick, solange sie noch nicht dabei ist. */
        var ed = e.zielArt !== "marke" && zieleDa() && artenFuer(p).some(function (x) { return x.k === "host"; }) ? eigeneDomain() : "";
        if (ed) {
          var edz = [zielBauen(ed, "host_all"), zielBauen(ed, "host")];
          if (!edz.some(function (z) { return !z.fehler && (zielGewaehlt(p, z) || zielImEvent(p, z)); }))
            html += '<button type="button" class="up-quietbtn uev-eigen-chip" data-eigene-domain="' + esc(ed) + '">' +
              '<span class="uev-ziel-ic">' + zielFavKlein(ed, UC.icon("globe", 2)) + '</span><span>' + esc(ersetze(t("Your domain: {domain}"), { domain: ed })) + '</span></button>';
        }
      } else if (r.vorschlag === "sitemap") {
        html = '<span class="uev-schreib-satz">' + esc(t("This looks like a sitemap.")) + '</span>' +
          (sitemapDa() ? '<button type="button" class="up-quietbtn uev-sm-auf" data-sm-url="' + esc(r.teile[0]) + '">' + UC.icon("folderTree", 2) + '<span>' + esc(t("Load from sitemap")) + '</span></button>' : '');
      } else if (r.schlecht.length && !r.gut.length) {
        html = '<span class="uev-schreib-satz">' + esc(r.schlecht.length === 1 && r.teile.length === 1 ? (r.schlecht[0].fehler === "pfad" ? t("Please add a path, e.g. example.com/blog.") : t("Enter a domain like example.com.")) : schlechteNennen(r.schlecht)) + '</span>';
      } else {
        /* Gezaehlt wird, was in die Liste kaeme: gleiche Schluessel nur einmal (fuenf Schreibweisen derselben
           Adresse sind ein Ziel, wie in der Datenbank; EV-07). */
        var da = {}, eig = r.gut.filter(function (z) { if (da[z.key]) return false; da[z.key] = 1; return true; });
        html = '<span class="up-marke is-leise">' + esc(eig.length > 1 ? ersetze(t("{n} URLs"), { n: zahl(eig.length) }) : t(ART_NAME[eig[0].kind])) + '</span>' +
          eig.slice(0, 3).map(function (z) { return '<span class="uev-notation">' + esc(z.zeigen) + '</span>'; }).join("") +
          (eig.length > 3 ? '<span class="uev-schreib-satz">' + esc(ersetze(t("and {n} more"), { n: eig.length - 3 })) + '</span>' : '');
        /* Ein ungueltiger Eintrag neben gueltigen sperrt "Add" nicht: "Add" nimmt die gueltigen, der
           ungueltige bleibt im Feld und steht hier mit Namen (EV-07). */
        if (r.schlecht.length) html += '<span class="uev-ziel-fehler">' + esc(schlechteNennen(r.schlecht)) + '</span>';
        /* Ein Host unter einer Hauptdomain (help.de.example.com) gilt nur fuer sich -- mit dem Angebot,
           die ganze Hauptdomain zu nehmen. */
        if (eig.length === 1 && eig[0].kind === "host") {
          var hz = zerlegen(eingabeTeile(e.eingabe)[0]), hd = hz ? hauptDomain(hz.host) : "";
          if (hd && hd !== hz.host && hostOk(hd)) html += '<button type="button" class="up-quietbtn" data-haupt="' + esc(hd) + '"><span>' + esc(ersetze(t("Include all of {domain}"), { domain: hd })) + '</span></button>';
        }
        /* Mehr eingefuegt, als frei ist (16.10.): der Grund steht SOFORT da, "Add" ist aus -- bis
           16.10. kam er erst nach dem Klick. */
        zuViel = eingabeNeu(p, r) > zielFrei(p);
        if (zuViel) html += '<span class="uev-ziel-fehler">' + esc(zuVielText(p)) + '</span>';
      }
      el.innerHTML = html;
      if (knopf) knopf.disabled = !r.gut.length || r.vorschlag === "sitemap" || zuViel;
    }
    function zielListeZeigen(p) {
      var el = im(".uev-zielliste");
      if (!el) return;
      var e = p.e, vz = vzErgebnis(p), je = {};
      if (vz && vz.d && isArr(vz.d.per_target)) vz.d.per_target.forEach(function (x) { if (x) je[String(x.kind) + "|" + String(x.input)] = x; });
      /* Bei "Brand metrics only" bleiben die Ziele erhalten (nichts geht verloren), stehen aber
         nicht da und gehen nicht hinaus -- gezeigt wird, was gilt. */
      if (!e.ziele.length || e.zielArt === "marke") { el.innerHTML = ""; return; }
      el.innerHTML = '<div class="uev-urlwahl-liste">' + e.ziele.map(function (z, i) {
        var pt = je[z.kind + "|" + z.input];
        /* Keine "N URLs" am Ziel mehr (18.10., Nutzer: "0 URLs" bei einer Domain verwirrt): die Zahl zaehlt nur URLs, die schon
           zitiert wurden, und eine Regel zaehlt auch kuenftige; sie sagte "0" und meinte "noch nichts gesehen". Die Zeile der
           Vorschau (Zitate, Seiten, Hosts) sagt, was gilt. */
        /* Der Grund steht am Ziel selbst (15.10.): aus der Antwort des Servers (p.zielFehler, hint
           "p_targets[i]: <grund>") oder aus der Vorschau (per_target[].error, dieselben Gruende). */
        var sf = p.zielFehler && p.zielFehler.key === z.key ? p.zielFehler.satz : "";
        var zahlTxt = z.kind !== "url" && !zieleDa() ? '<span class="uev-ziel-fehler">' + esc(fehlerText("impact_event_targets_unavailable")) + '</span>'
          : sf ? '<span class="uev-ziel-fehler">' + esc(sf) + '</span>'
          : pt && pt.error ? '<span class="uev-ziel-fehler">' + esc(t(ZIEL_GRUND[pt.error] || FEHLER.impact_event_invalid_target)) + '</span>'
          : '';
        return '<div class="uev-urlwahl">' +
          zielKachel(z) +
          '<span class="uev-url-txt"><span class="uev-notation">' + esc(z.zeigen) + '</span>' +
            '<span class="uev-url-pfad">' + esc(t(ART_NAME[z.kind])) + '</span></span>' + zahlTxt +
          '<button type="button" class="up-iconbtn uev-urlwahl-weg" data-url-weg="' + i + '" aria-label="' + esc(t("Remove")) + '" data-tip="' + esc(t("Remove")) + '">' + UC.icon("x", 2) + '</button></div>';
      }).join("") + '</div>';
    }

    /* ---- DIE LIVE-VORSCHAU (preview_impact_event_targets_v1, Vertrag Abschnitt 4) -----------
       Fuer alle Ziele der Liste plus die gueltige Eingabe, 400ms nach dem letzten Tastendruck,
       sofort nach Hinzufuegen und Entfernen. Je Zielliste gemerkt -- wer hin und her schaltet,
       fragt nicht zweimal. Es zaehlt nur die Antwort auf die aktuelle Liste; was vorher bestellt
       war, landet im Speicher, wird aber nicht gezeigt. Ein Fehler der Vorschau sperrt nichts:
       sie ist Hilfe, keine Bedingung. */
    var VZ_TAGE = 90;
    function vzListe(p) {
      var e = p.e;
      if (!zieleDa() || e.zielArt === "marke") return [];
      var r = eingabeLesen(p), l = e.ziele.slice(), da = {};
      /* Eine Eingabe, die nicht mehr hineinpasst, fragt die Vorschau nicht an: sie kaeme nie in die
         Liste, und die Funktion lehnt ueber 200 Eintraege ohnehin ab. */
      if (r.vorschlag !== "sitemap" && eingabeNeu(p, r) <= zielFrei(p)) r.gut.forEach(function (z) { l.push(z); });
      return l.filter(function (z) { if (da[z.key]) return false; da[z.key] = 1; return true; });
    }
    /* DER ENGE UMFANG FRAGT DEN WEITEN MIT (17.10.): steht genau EIN Ziel in der Vorschau und es ist ein
       einzelner Host, geht dieselbe Domain mit allen Subdomains im selben Aufruf mit (preview_impact_
       event_targets_v1 nimmt bis 200 Ziele, per_target[] liefert je Ziel Seiten und Zitate). Hat der
       Host keine Treffer, die Unterdomains aber, sagt die Vorschau das und bietet den weiten Umfang an
       -- ohne zweiten Aufruf und ohne Liste. Bei mehreren Zielen gaebe es kein sauberes Mass fuer die
       Summe (die Gesamtzahlen der Antwort zaehlen die Begleiter mit), darum dann nicht. */
    function vzBegleiter(l) {
      return l.length === 1 && l[0].kind === "host" ? [{ kind: "host_all", input: l[0].input }] : [];
    }
    /* Wie ein Ziel in einem Satz heisst: der Host bzw. Pfad ohne die Schreibweise der Regel
       (*.example.com/*), die URL wie gezeigt. */
    function zielName(z) { return z.kind === "url" ? z.zeigen : String(z.zeigen || "").replace(/^\*\./, "").replace(/\/\*$/, ""); }
    function vzErgebnis(p) { return p.zv && p.zv.akt ? p.zv.ergebnisse[p.zv.akt] || null : null; }
    function vzAnfordern(p, sofort) {
      if (!p) return;
      p.zv = p.zv || { ergebnisse: {}, akt: null, soll: null, uhr: null };
      var l = vzListe(p);
      clearTimeout(p.zv.uhr);
      if (!l.length) { p.zv.soll = null; p.zv.akt = null; vzZeigen(p); return; }
      var liste = l.concat(vzBegleiter(l)).map(function (z) { return { kind: z.kind, input: z.input }; });
      var sig = JSON.stringify(liste);
      p.zv.soll = sig;
      if (p.zv.ergebnisse[sig]) { p.zv.akt = sig; vzZeigen(p); return; }
      p.zv.uhr = setTimeout(function () { vzLos(p, sig, liste); }, sofort ? 0 : 400);
      vzZeigen(p);
    }
    function teamHolen() {
      var tm = team();
      return tm ? Promise.resolve(tm) : (UC.teamWarten ? UC.teamWarten(10000) : Promise.resolve(""));
    }
    function vzLos(p, sig, liste) {
      if (popup !== p) return;
      teamHolen().then(function (tm) {
        if (!tm) return { ok: false, status: 0, fehler: {} };
        return UC.rpc("preview_impact_event_targets_v1", { p_team: tm, p_targets: liste, p_days: VZ_TAGE }, { timeoutMs: 15000 });
      }).then(function (erg) {
        if (popup !== p) return;
        var d = erg && erg.ok ? erg.daten : null;
        if (isArr(d) && d.length === 1) d = d[0];
        p.zv.ergebnisse[sig] = d && typeof d === "object" && !isArr(d) ? { d: d } : { fehler: true };
        if (p.zv.soll === sig) { p.zv.akt = sig; vzZeigen(p); zielListeZeigen(p); }
      });
    }
    function vzZeigen(p) {
      var el = im(".uev-vz");
      if (!el || popup !== p) return;
      var l = vzListe(p);
      if (!l.length) { el.innerHTML = ""; el.hidden = true; vorschlaegeZeigen(p, l, []); return; }
      el.hidden = false;
      var res = p.zv && p.zv.soll && p.zv.akt === p.zv.soll ? vzErgebnis(p) : null;
      if (!res) {
        /* Waehrend die Vorschau neu fragt, bleiben die Vorschlaege stehen (beim Tippen fragt sie je
           Zeichen neu -- sonst klappten sie bei jedem Zeichen zu und wieder auf); nur was nicht mehr
           in der Liste steht, faellt sofort weg (vorschlaegeZeigen). */
        vorschlaegeZeigen(p, l, null);
        el.innerHTML = '<p class="uev-vz-laeuft"><span class="up-modal-spin"></span><span>' + esc(ersetze(t("Checking the last {n} days…"), { n: VZ_TAGE })) + '</span></p>';
        return;
      }
      if (res.fehler) {
        vorschlaegeZeigen(p, l, []);
        el.innerHTML = '<div class="up-fehlerzeile is-on"><span>' + esc(t("The preview could not be loaded.")) + '</span></div>';
        return;
      }
      var d = res.d, tage = num(d.days) || VZ_TAGE, pts = isArr(d.per_target) ? d.per_target.filter(Boolean) : [];
      var bg = vzBegleiter(l), n = num(d.matched_url_count) || 0, c = num(d.citation_count) || 0, nBreit = 0, cBreit = 0;
      /* Mit Begleiter zaehlen die Gesamtzahlen der Antwort ihn mit: dann gelten die Zahlen des einen
         echten Ziels (per_target), und der Begleiter liefert nur den weiten Umfang. */
      if (bg.length) {
        var ptR = null, ptB = null;
        pts.forEach(function (pt) {
          if (String(pt.input) !== l[0].input) return;
          if (pt.kind === l[0].kind) ptR = pt; else if (pt.kind === bg[0].kind) ptB = pt;
        });
        n = ptR ? num(ptR.matched_url_count) || 0 : 0; c = ptR ? num(ptR.citation_count) || 0 : 0;
        nBreit = ptB ? num(ptB.matched_url_count) || 0 : 0; cBreit = ptB ? num(ptB.citation_count) || 0 : 0;
      }
      function mitZahl(schl, v) { return esc(t(schl)).replace("{n}", '<span class="uev-vz-n">' + esc(zahl(v)) + '</span>'); }
      /* DIE HOSTS (18.10., w3_wizard): die Datenbank liefert sie je Ziel -- per_target[].hosts =
         [{ host, matched_url_count, citation_count }], nach Zitaten absteigend, hoechstens 10, dazu
         host_count (alle Hosts des Ziels). Ein ungueltiges Ziel hat null, eines ohne Treffer []/0.
         - Mit Begleiter oder bei genau einem Ziel gelten die Hosts dieses einen Ziels.
         - Bei mehreren Zielen werden die Listen nur zusammengelegt, wenn jede vollstaendig ist (host_count
           nicht groesser als die Liste): sonst laesse sich die Zahl der Hosts nicht ehrlich nennen, und
           geraten wird nicht. Ein Host, den zwei Ziele treffen, zaehlt einmal, mit dem groesseren Wert
           (eine Regel kann die andere ganz enthalten, www.adac.de und adac.de).
         Frueherer Weg bleibt als Rueckfall: ein hosts[] ganz oben (altere Fassung), und dort, wo die
         Beispiele alle getroffenen Seiten tragen (hoechstens fuenf), diese. */
      var hostListe = null, hostZahl = null;
      function hostEintraege(l2) {
        return l2.filter(function (x) { return x && x.host; }).map(function (x) {
          return { host: String(x.host), c: num(x.citation_count != null ? x.citation_count : x.citations), n: num(x.matched_url_count != null ? x.matched_url_count : x.url_count) };
        });
      }
      var ptEins = null;
      if (bg.length) { pts.forEach(function (pt) { if (String(pt.input) === l[0].input && pt.kind === l[0].kind) ptEins = pt; }); }
      else if (pts.length === 1) ptEins = pts[0];
      var gueltigeHosts = pts.filter(function (pt) { return pt && !pt.error && pt.valid !== false && isArr(pt.hosts); });
      if (ptEins && isArr(ptEins.hosts)) {
        hostListe = hostEintraege(ptEins.hosts);
        hostZahl = Math.max(hostListe.length, num(ptEins.host_count) || 0);
      } else if (!ptEins && !bg.length && gueltigeHosts.length > 1 && gueltigeHosts.every(function (pt) { return (num(pt.host_count) || 0) <= pt.hosts.length; })) {
        var gem = {}, reihe0 = [];
        gueltigeHosts.forEach(function (pt) {
          hostEintraege(pt.hosts).forEach(function (x) {
            var v = gem[x.host];
            if (!v) { gem[x.host] = v = { host: x.host, c: x.c, n: x.n }; reihe0.push(x.host); return; }
            if ((x.c || 0) > (v.c || 0)) v.c = x.c;
            if ((x.n || 0) > (v.n || 0)) v.n = x.n;
          });
        });
        hostListe = reihe0.map(function (h) { return gem[h]; }).sort(function (x, y) { return (y.c || 0) - (x.c || 0); });
        hostZahl = hostListe.length;
      } else if (isArr(d.hosts) && d.hosts.length) {
        hostListe = hostEintraege(d.hosts);
        hostZahl = num(d.host_count) != null ? num(d.host_count) : hostListe.length;
      } else if (n && bg.length) {
        hostListe = [{ host: zielHost(l[0]), c: c, n: n }]; hostZahl = 1;
      } else if (n && !bg.length && isArr(d.examples) && d.examples.length >= n) {
        var je = {}, reihe = [];
        d.examples.forEach(function (x) {
          var h = hostPfad(x.url).host;
          if (!je[h]) { je[h] = { host: h, c: 0, n: 0 }; reihe.push(h); }
          je[h].c += num(x.citations) || 0; je[h].n++;
        });
        hostListe = reihe.map(function (h) { return je[h]; }).sort(function (x, y) { return y.c - x.c; });
        hostZahl = hostListe.length;
      }
      var html = "";
      if (n) {
        html += '<p class="uev-vz-kopf">' + mitZahl(c === 1 ? "{n} citation" : "{n} citations", c) + ' ' + mitZahl(n === 1 ? "on {n} page" : "on {n} pages", n) +
          (hostZahl > 1 ? ' ' + mitZahl("across {n} hosts", hostZahl) : '') +
          ' <span class="uev-vz-zeit">' + esc(ersetze(t("in the last {n} days"), { n: zahl(tage) })) + '</span></p>';
        /* Die Hosts, hoechstens drei, je Zeile ein Host mit seinen Zitaten rechts; "Show hosts" nur,
           wenn es mehr gibt. */
        if (hostListe && hostListe.length > 1) {
          var sichtbar = p.vzHostsAlle ? hostListe : hostListe.slice(0, 3);
          html += '<div class="uev-vz-liste">' + sichtbar.map(function (x) {
            return '<div class="uev-vz-reihe"><span class="uev-ziel-ic">' + zielFavKlein(x.host, UC.icon("globe", 2)) + '</span>' +
              '<span class="uev-vz-url" title="' + esc(x.host) + '">' + esc(x.host) + '</span>' +
              (x.c != null ? '<span class="uev-vz-wert" title="' + esc(ersetze(t(x.c === 1 ? "{n} citation" : "{n} citations"), { n: zahl(x.c) })) + '">' + esc(zahl(x.c)) + '</span>' : '') + '</div>';
          }).join("") + '</div>';
          if (hostListe.length > 3) html += '<div><button type="button" class="up-quietbtn uev-vz-hosts-mehr" data-vz-hosts>' +
            '<span>' + esc(t(p.vzHostsAlle ? "Show fewer hosts" : "Show hosts")) + '</span></button></div>';
        }
      }
      /* similar_host (v2) zeigt auf eine DOMAIN: dort darf url fehlen (die Datenbank nimmt die
         meistzitierte URL der Domain, sonst die zuletzt zitierte -- und fuehrt den Eintrag ueber
         die Domain weiter, wenn es keine gibt). */
      var nahAlle = isArr(d.near_misses) ? d.near_misses.filter(function (x) { return x && (x.url || (x.reason === "similar_host" && x.host)); }) : [];
      var hosts = {};
      l.forEach(function (z) { var h = zielHost(z); if (h) hosts[h] = 1; });
      var hl = Object.keys(hosts), h1 = hl.length === 1 ? hl[0] : "";
      /* DIESELBE SEITE IN ANDERER SCHREIBWEISE (Rueckmeldung 15.10., Abschnitt 1 und 4): ein
         url-Ziel trifft nur genau seine Schreibweise. Hat es 0 Treffer und meldet die Vorschau
         dieselbe Seite mit Zitaten als url_variant (http/https, mit oder ohne www bzw. "/" am
         Ende), bietet sie diese Schreibweise an -- wie "Use {host}" bei einem Tippfehler. Echtes
         Beispiel der Datenbank: https://lee-up.de/solar 0, https://www.lee-up.de/solar 210. */
      var varianten = [];
      pts.forEach(function (pt) {
        if (pt.kind !== "url" || pt.error || num(pt.matched_url_count) !== 0) return;
        var best = null;
        nahAlle.forEach(function (x) {
          if (x.reason === "url_variant" && String(x.target_input) === String(pt.input) && num(x.citations) > 0 &&
              (!best || num(x.citations) > num(best.citations))) best = x;
        });
        if (best && !varianten.some(function (v) { return v.alt === String(pt.input); })) varianten.push({ alt: String(pt.input), neu: String(best.url) });
      });
      var vorschlaege = varianten.map(function (v) {
        return { art: "variante", alt: v.alt, neu: v.neu,
          satz: ersetze(t("No citations for {alt}. AI answers cite this page as {url}."), { alt: urlZeigen(v.alt), url: urlZeigen(v.neu) }),
          knopf: ersetze(t("Use {url}"), { url: urlZeigen(v.neu) }) };
      });
      /* Tippfehler im Host: je unbekanntem Host ein Vorschlag (tippVorschlaege, 15.10. spaet) --
         wie die Schreibweisen oben auch dann, wenn ein anderes Ziel schon trifft. Bei EINEM Host
         der Satz wie bisher ("this domain"), bei mehreren nennt er den Host. */
      var tipps = tippVorschlaege(d, h1);
      tipps.forEach(function (v) {
        vorschlaege.push({ art: "host", alt: v.alt, neu: v.neu,
          satz: h1 ? ersetze(t("We haven't seen this domain in your citations. Did you mean {host}?"), { host: v.neu })
            : ersetze(t("We haven't seen {alt} in your citations. Did you mean {host}?"), { alt: v.alt, host: v.neu }),
          knopf: ersetze(t("Use {host}"), { host: v.neu }) });
      });
      /* Die Vorschlaege stehen seit dem 17.10. unter dem Feld (vorschlaegeZeigen), nicht mehr hier --
         im Vorschaubereich keine Doppelung. Bei null Treffern ersetzt ein Vorschlag weiter den Satz
         darunter: er sagt schon, warum nichts trifft, und was man tun kann.
         Der leise Satz "Only pages that AI answers ... can be counted" ist seit dem 16.10. spaet weg
         (Nutzer: entfernen) -- er stand unter jedem Null-Treffer und sagte nichts, was man tun kann. */
      vorschlaegeZeigen(p, l, vorschlaege);
      if (!n && !vorschlaege.length) {
        /* Null Treffer (17.10.): ein ruhiger Satz, kein Fehler -- gezaehlt wird ab dem Event. Hat nur der
           enge Umfang keine Treffer und der weite schon (Host ohne Seiten, Unterdomains mit), sagt der
           Satz das und bietet den weiten Umfang an, ohne Liste. Nur bei gueltigen Zielen: ein
           ungueltiges steht mit seinem Grund an der Zeile. */
        var ungueltig = pts.some(function (pt) { return pt.error || pt.valid === false; });
        if (!ungueltig && bg.length && cBreit > 0) {
          html += '<p class="uev-vz-satz"><span>' + esc(ersetze(t("No citations on {host} itself."), { host: zielName(l[0]) })) + ' ' +
            esc(ersetze(t(cBreit === 1 ? "{n} citation sits on its subdomains." : "{n} citations sit on its subdomains."), { n: zahl(cBreit) })) + '</span>' +
            '<button type="button" class="up-quietbtn" data-weiten="' + esc(zielHost(l[0])) + '"><span>' + esc(t("Include subdomains")) + '</span></button></p>';
        } else if (!ungueltig) {
          html += '<p class="uev-vz-satz">' + esc(l.length === 1 ? ersetze(t("No citations yet for {ziel}. Counting starts with this event."), { ziel: zielName(l[0]) })
            : t("No citations yet for these targets. Counting starts with this event.")) + '</p>';
        }
      }
      /* "SIMILAR, BUT NOT MATCHING" IST WEG (16.10. spaet, Nutzer: "Die Plakette unten bringt nichts,
         weil man nichts damit machen kann"). Die Beinahe-Treffer, mit denen man etwas tun kann,
         stehen schon oben als Vorschlag mit Knopf: dieselbe Seite in anderer Schreibweise
         (url_variant -> "Use {url}") und der Tippfehler im Host (similar_host bzw. vor v2 ein
         aehnlicher other_host -> "Did you mean ...? Use {host}"). Der Rest (path_boundary, ein
         anderer Host derselben Domain) war nur eine Liste ohne Handgriff. */
      /* "Count as your domain" (Nutzer 15.10.: "JA, das soll direkt angeboten werden"): nur fuer
         EINEN Host -- bei mehreren sagt die Vorschau nicht, welcher gemeint ist. Eingestuft wird
         genau dieser Host, auch bei host_all: jede Unterdomain ist eine eigene domain_norm, die
         Einstufung gilt nur fuer sie (Rueckmeldung Abschnitt 8.1).
         NUR FUER owner UND admin (Abschnitt 8.2, wie can_override im Domain-Drawer). Seit
         events_ziele_v2.sql entscheidet die Datenbank: can_classify in der Antwort der Vorschau
         (Nachtrag Abschnitt 5, true fuer owner/admin nach der Regel von domain_classify_v1). Fehlt
         das Feld (vor v2), gilt wie bisher die Rolle aus dem App-Start (UC.teamRolle); unbekannt
         ("" -- Bubble, Start gescheitert) heisst dort anbieten: die Datenbank prueft selbst und
         antwortet mit dem Satz des Drawers; ein Knopf, der einem owner faelschlich fehlt, waere
         schlimmer (dieselbe Abwaegung wie prompts-data.js).
         Die Rolle des Hosts aus per_target (je Ziel); das oberste host_role nur, wenn per_target
         den Host nicht fuehrt -- bei EINEM Host ist das erste gueltige Ziel dann ohnehin seins.
         NICHT NEBEN EINEM TIPPFEHLER (Nutzer 16.10.): steht fuer diesen Host oben "Did you mean
         ...?" (tipps, also similar_host der Datenbank), ist er wahrscheinlich vertippt.
         domain_classify_v1 prueft nicht, ob die Domain je zitiert wurde, und gilt rueckwirkend --
         ein Klick truege die falsch geschriebene Domain dauerhaft als eigene ein. Nach "Use {host}"
         oder einer anderen Eingabe fragt die Vorschau neu, und fuer das dann eingetragene Ziel gilt
         wieder diese Regel. Verglichen wird ueber den Host wie bei tipps selbst (www weg, klein). */
      var darf = typeof d.can_classify === "boolean" ? d.can_classify : (UC.teamRolle ? UC.teamRolle() : "") !== "member";
      var vertippt = !!h1 && tipps.some(function (v) { return v.alt === h1; });
      var hostRolle = d.host_role, je1 = pts.filter(function (pt) { return pt.host && String(pt.host) === h1; });
      if (je1.length) hostRolle = je1.some(function (pt) { return pt.host_role === "own"; }) ? "own" : je1[0].host_role;
      /* NICHT FUER EINEN GETRACKTEN WETTBEWERBER (16.10. spaet, Nutzer: "Natuerlich"): host_role
         "competitor" kommt aus derselben Einstufung wie im Domain-Drawer (_citations_g_domtype_v1,
         Competition), und domain_classify_v1 lehnt genau diese Domains ab (tracked_competitor) --
         der Knopf fuehrte nur zu einer Fehlermeldung. */
      if (h1 && darf && !vertippt && hostRolle !== "own" && hostRolle !== "competitor" && !(p.eigen && p.eigen[h1])) {
        html += '<div class="uev-vz-eigen"><span>' + esc(ersetze(t("{host} doesn't count as your domain yet."), { host: h1 })) + '</span>' +
          '<button type="button" class="up-btn-sec uev-vz-eigenbtn" data-eigen-host="' + esc(h1) + '"' + (p.eigenLaeuft ? ' disabled' : '') + '>' +
            (p.eigenLaeuft ? '<span class="up-modal-spin"></span>' : '') + '<span>' + esc(t("Count as your domain")) + '</span></button></div>';
      }
      el.innerHTML = html;
    }
    /* DIE VORSCHLAEGE UNTER DEM FELD (17.10.): je Vorschlag eine Zeile -- Zeichen, Satz, rechts der
       leise Knopf "Use ...". Kein Kasten, keine Pille (wie die Fehlerzeile aus core nur Text); der
       Platz entsteht erst mit einem Vorschlag und klappt weich auf (klapp, wie die Treffer der
       Suche), also kein Sprung beim Erscheinen. Hoechstens drei.
       neu: die Vorschlaege einer frischen Antwort; [] keine; null die Vorschau fragt gerade neu --
       dann bleiben die alten stehen, aber nur, solange ihr Ziel noch in der Liste bzw. im Feld
       steht (l = vzListe). So verschwindet ein Vorschlag nach "Use ..." sofort, und beim Tippen
       flackert nichts. */
    function vorschlaegeZeigen(p, l, neu) {
      var kl = im(".uev-vorschlag-klapp"), box = kl && kl.querySelector(".uev-vorschlaege");
      if (!box) return;
      if (neu) p.vorschlaege = neu;
      var hosts = {}, urls = {};
      l.forEach(function (z) { var h = zielHost(z); if (h) hosts[h] = 1; if (z.kind === "url") urls[z.key] = 1; });
      var liste = (p.vorschlaege || []).filter(function (v) {
        return v.art === "host" ? !!hosts[v.alt] : !!urls["url|" + urlSchluessel(v.alt)];
      }).slice(0, 3);
      var sig = liste.map(function (v) { return v.art + "|" + v.alt + "|" + v.neu; }).join(" ");
      if (box.getAttribute("data-sig") !== sig) {
        box.setAttribute("data-sig", sig);
        /* Zugeklappt bleibt der alte Inhalt stehen, bis die Bewegung vorbei ist (sonst fiele die
           Hoehe sofort auf 0); er ist dann unsichtbar und ohne Fokus (visibility). */
        if (liste.length) box.innerHTML = liste.map(function (v) {
          var a = v.art === "host" ? "statt" : "variante";
          return '<div class="uev-vorschlag"><span class="uev-vorschlag-ic">' + UC.icon("bulb", 2) + '</span>' +
            '<span class="uev-vorschlag-satz">' + esc(v.satz) + '</span>' +
            '<button type="button" class="up-quietbtn uev-vorschlag-knopf" data-' + a + '-alt="' + esc(v.alt) + '" data-' + a + '-neu="' + esc(v.neu) + '" title="' + esc(v.knopf) + '">' +
              '<span>' + esc(v.knopf) + '</span></button></div>';
        }).join("");
      }
      klappen(kl, !!liste.length);
    }
    /* "Include subdomains" (Vorschau eines einzelnen Hosts ohne Treffer, dessen Unterdomains zitiert
       sind): das Ziel mit diesem Host wird zur Domain mit allen Subdomains -- in der Liste und, wenn
       er noch im Feld steht, ueber den Schalter. */
    function umfangWeiten(p, host) {
      if (!p || !host) return;
      var da = {};
      p.e.ziele = p.e.ziele.map(function (z) {
        if (z.kind !== "host" || zielHost(z) !== host) return z;
        var x = zielBauen(z.input, "host_all");
        return x.fehler ? z : x;
      }).filter(function (z) { if (da[z.key]) return false; da[z.key] = 1; return true; });
      var tl = eingabeTeile(p.e.eingabe), fz = tl.length === 1 ? zerlegen(tl[0]) : null;
      /* Steht derselbe Host noch im Feld, folgt der Schalter, sonst wuerde "Add" ihn wieder eng lesen. */
      if (fz && fz.host === host && p.e.zielArt === "host" && !p.e.unterdomains) { p.e.unterVonHand = true; unterdomainsUmschalten(p); return; }
      zieleZeigen(p);
    }
    /* Einen Host als eigene Domain zaehlen: derselbe Weg wie "Count as: Your own site" im
       Domain-Drawer (domain_classify_v1, p_role "own"). Die Datenbank leert ihre Caches selbst;
       hier faellt der Speicher der Vorschau, und sie fragt neu. Die Saetze der Fehler sind die
       des Drawers (Katalog in core). */
    function alsEigeneZaehlen(p, host) {
      if (!p || p.eigenLaeuft || !host) return;
      p.eigenLaeuft = host;
      vzZeigen(p);
      teamHolen().then(function (tm) {
        if (!tm) return { ok: false, status: 0, fehler: {} };
        return UC.rpc("domain_classify_v1", { p_team: tm, p_domain: host, p_role: "own" }, { timeoutMs: 30000 });
      }).then(function (erg) {
        p.eigenLaeuft = null;
        if (popup !== p) return;
        if (!erg || !erg.ok) {
          var fe = (erg && erg.fehler) || {}, code = String(fe.message || fe.code || ""), hint = String(fe.hint || ""), wer = String(fe.details || "");
          var satz = code === "domain_classify_forbidden" ? t("Only owners and admins can change how a domain counts.")
            : /rate_limited$/.test(code) ? t("Too many changes in a short time. Please wait a moment.")
            : code === "domain_classify_invalid" && hint === "tracked_competitor" ? t("This domain belongs to {brand}, a competitor.").replace("{brand}", wer || "?")
            : code === "domain_classify_invalid" && hint === "own_brand" ? t("This is the domain of your brand {brand}.").replace("{brand}", wer || "?")
            : code === "domain_classify_invalid" && hint === "limit" ? t("Your team can assign up to {n} domains.").replace("{n}", wer || "100")
            : t("This change could not be saved. Please try again.");
          if (UC.toast) UC.toast(satz, { kind: "error" });
          vzZeigen(p);
          return;
        }
        p.eigen = p.eigen || {};
        p.eigen[host] = true;
        if (UC.toast) UC.toast(t("This domain now counts as your own site."), { kind: "success" });
        p.zv.ergebnisse = {};
        vzAnfordern(p, true);
      });
    }
    /* "Did you mean ...?" -> "Use {host}": in jedem Ziel mit dem Host alt den Host durch neu
       ersetzen, in der Liste und im Feld. Art, Pfad, Schema und www bleiben (youtube.con/watch als
       Pfad wird youtube.com/watch als Pfad). Ersetzt wird genau der Host vorn in der Eingabe, ohne
       Ruecksicht auf Gross/Klein -- bis 15.10. ersetzte ein reines Textersetzen auch denselben
       Text an anderer Stelle (abwm.de neben bwm.de) und liess HTTPS://BWM.DE stillschweigend
       stehen. Wird ein Ziel dadurch zu einem, das schon in der Liste steht, bleibt es einmal. */
    function hostTauschen(s, alt, neu) {
      var m = /^((?:https?:\/\/)?(?:\*\.)?(?:www\.)?)([^\/?#\s]+)([\s\S]*)$/i.exec(String(s == null ? "" : s));
      return m && m[2].toLowerCase() === alt ? m[1] + neu + m[3] : null;
    }
    function hostErsetzen(p, alt, neu) {
      if (!p || !alt || !neu) return;
      var da = {};
      p.e.ziele = p.e.ziele.map(function (z) {
        if (zielHost(z) !== alt) return z;
        var s = hostTauschen(z.input, alt, neu), x = s == null ? null : zielBauen(s, z.kind);
        return !x || x.fehler ? z : x;
      }).filter(function (z) { if (da[z.key]) return false; da[z.key] = 1; return true; });
      var tl = eingabeTeile(p.e.eingabe), neuTl = tl.map(function (s) { var x = hostTauschen(s, alt, neu); return x == null ? s : x; });
      if (neuTl.join("\n") !== tl.join("\n")) {
        p.e.eingabe = neuTl.join("\n");
        var inp = im(".uev-zielein");
        if (inp) { inp.value = p.e.eingabe; feldHoehe(inp); }
      }
      zieleZeigen(p);
    }
    /* "Use <Schreibweise>" (url_variant, 15.10.): das url-Ziel mit der Eingabe alt durch die
       zitierte Schreibweise ersetzen -- in der Liste oder, wenn es noch im Feld steht, dort. Stand
       die neue Schreibweise schon in der Liste, bleibt sie einmal. */
    function urlErsetzen(p, alt, neu) {
      if (!p || !alt || !neu) return;
      var kAlt = "url|" + urlSchluessel(alt), x = zielBauen(neu, "url");
      if (x.fehler) return;
      var drin = false, da = {};
      p.e.ziele = p.e.ziele.map(function (z) { if (z.kind === "url" && z.key === kAlt) { drin = true; return x; } return z; })
        .filter(function (z) { if (da[z.key]) return false; da[z.key] = 1; return true; });
      if (!drin && leseArt(p.e) === "url") {
        var tl = eingabeTeile(p.e.eingabe), neuTl = tl.map(function (s) { var z = zielBauen(s, "url"); return !z.fehler && z.key === kAlt ? neu : s; });
        if (neuTl.join("\n") !== tl.join("\n")) {
          p.e.eingabe = neuTl.join("\n");
          var inp = im(".uev-zielein");
          if (inp) { inp.value = p.e.eingabe; feldHoehe(inp); }
        }
      }
      if (p.zielFehler && p.zielFehler.key === kAlt) p.zielFehler = null;
      zieleZeigen(p);
    }

    /* ---- DER SITEMAP-WAEHLER (Edge Function sitemap-lesen, Vertrag Abschnitt 6) -------------
       In Schritt 3 und im Add-Dialog, unter dem Eingabefeld. Gelesen wird ueber den Weg der App
       fuer Edge Functions (UC.edge); gespeichert wird NICHTS ausser den Zielen, die man danach
       uebernimmt. Die Seiten stehen als Baum nach Host und Ordnern, je Ordner die Zahl der Seiten
       und das juengste lastmod; ein Ordner waehlt eine Regel (Pfad, beim Host die ganze Domain),
       eine Seite eine URL. Es gibt KEIN "Select all in folder" mehr (17.10., Nutzer: der Ordner hatte
       danach keinen Auswahlzustand): wer viele Seiten will, waehlt den Ordner, und der ist EINE Regel.
       Was ein gewaehlter
       Ordner schon enthaelt, steht gewaehlt und gesperrt. Gezeichnet werden nur aufgeklappte
       Ordner und je Ordner zuerst 50 Seiten -- eine Sitemap darf 50 000 haben.
       Laden mit dem Ladebild aus core (Spinner, kein Skelett: der Abschnitt ist selten). Jeder
       Fehlercode bekommt einen eigenen Satz, als roter Satz ohne Kasten.
       Seit dem 16.10. mit Deckel (Nutzer: "4000 Seiten gefunden und ich koennte die per Klick
       einfach uebernehmen. Das darf nicht sein."): die Datenbank nimmt hoechstens ZIEL_MAX Ziele
       je Event (create_impact_event_v3, add_impact_event_target_v1, beide gelesen 16.10.) -- der
       Waehler zaehlt schon bei der AUSWAHL dagegen, nicht erst beim Uebernehmen (smDeckel). */
    /* not_found und invalid_xml heissen je nach dem, was gefragt wurde, etwas anderes (16.10.):
       nach einer DOMAIN hat sie robots.txt, /sitemap.xml und /sitemap_index.xml probiert -- ein
       invalid_xml ist dort fast immer eine HTML-Seite, die ein Server fuer jede unbekannte Adresse
       liefert, also schlicht "keine Sitemap da". Nach einer DATEI ist es der Link selbst. Bis
       16.10. stand fuer beide derselbe Satz ("This file isn't a sitemap we can read"), und der
       las sich nach einer eingegebenen Seiten-URL so, als ginge nur eine sitemap.xml -- dabei geht
       die Domain genauso. Darum sagt jeder Satz, was stattdessen geht. */
    var SM_FEHLER_HOST = "We couldn't find a sitemap for {domain}. Try the full link to your sitemap.xml.";
    var SM_FEHLER_DATEI = {
      not_found: "We couldn't open this sitemap. Check the link, or enter just your domain.",
      invalid_xml: "This link isn't a sitemap. Enter your domain or the link to your sitemap.xml."
    };
    /* DER RUECKFALL (sitemap-lesen Version 5, live 16.10.): liefert eine ausdruecklich angegebene
       Datei HTML, liest die Function einmal die Sitemap derselben Domain (robots.txt, dann
       /sitemap.xml und /sitemap_index.xml) und sagt das mit fallback: "host" -- auch, wenn auch das
       scheitert. Dann ist der Link gar keine Sitemap UND die Domain hat keine auffindbare; der Satz
       sagt beides und, wie die anderen, was stattdessen geht. Gelingt der Rueckfall, steht er in der
       Quellzeile (smZeichnen): die Seiten kommen dann aus einer anderen Datei, als eingegeben war. */
    var SM_FEHLER_RUECKFALL = "This link isn't a sitemap, and we couldn't find one for {domain}. Try the full link to your sitemap.xml.";
    var SM_FEHLER = {
      timeout: "The website took too long to answer. Please try again later.",
      too_large: "This sitemap is too large to read. Try one of the smaller sitemaps it lists.",
      blocked: "This address can't be read. Please use the public address of your website.",
      rate_limited: "Too many sitemap requests. Please wait a while and try again.",
      network: "We could not reach the server. Check your connection and try again.",
      leer: "Please enter a sitemap link or a domain.",
      ungueltig: "Please enter a valid domain.",
      /* Die HTTP-Antworten der Function (Rueckmeldung 15.10., Abschnitt 7). detail zeigt die
         Oberflaeche NIE: laut Vertrag nur zur Fehlersuche, und Entwicklertexte gehoeren nicht ins
         UI. 401 und 403 sagen dasselbe wie dieselben Codes der RPCs. */
      invalid_input: "Please enter a valid sitemap link or domain.",
      unauthorized: "Please sign in again.",
      forbidden: "You don't have permission to do that.",
      not_configured: "Loading a sitemap isn't available right now.",
      /* 502 edge_failed (sitemap-lesen Version 4, Nachtrag 15.10. Abschnitt 2): ein unerwarteter
         Fehler in der Function, jetzt mit CORS statt als stummer Abbruch. Fuer den Nutzer heisst
         das nur "noch einmal versuchen" -- der Knopf bleibt, detail (der technische Grund) steht
         nie da. */
      edge_failed: "The sitemap could not be loaded. Please try again."
    };
    /* 429 rate_limited traegt retry_after in Sekunden (20 Abrufe je Stunde und Team, 10 je Minute
       und Nutzer) -- der Satz nennt die Wartezeit in ganzen Minuten, aufgerundet. */
    function smWarteText(s) {
      s = num(s);
      if (!s || s <= 0) return smFehlerText("rate_limited");
      var min = Math.max(1, Math.ceil(s / 60));
      return ersetze(t(min === 1 ? "Too many sitemap requests. Please try again in 1 minute." : "Too many sitemap requests. Please try again in {n} minutes."), { n: zahl(min) });
    }
    var SM_SEITEN = 50, SM_MEHR = 100, SM_TREFFER = 200;
    /* Sieht die Eingabe nach einer Sitemap-DATEI aus? .xml, .xml.gz, .txt (die Text-Sitemap, die
       sitemap-lesen auch liest), .gz, oder "sitemap" irgendwo in Pfad oder Query -- so heissen
       auch die Adressen der Plugins (index.php?sitemap=1, /sitemap/). */
    function smDateiArtig(z) { return !!z && (/\.(xml|txt)(\.gz)?$|\.gz$/i.test(z.pfad) || /sitemap/i.test(z.pfad + z.query)); }
    /* Was an sitemap-lesen geht (16.10., Nutzer: "Ich wuerde erwarten, dass er zumindest
       versucht, die Domain aus der URL zu holen"). Die Function liest eine Eingabe mit Pfad als
       DATEI (core.ts readOnce: Host-Modus nur bei Pfad "/" ohne Query) -- eine Seiten-URL kam
       als HTML zurueck und scheiterte mit invalid_xml. Darum geht bei einer Seite nur ihr Host
       hinaus, mit dem Schema und genau der Schreibweise, die getippt wurde: die Unterdomain
       bleibt, www bleibt, wie es bei einer getippten Domain schon immer blieb (die Function
       folgt Weiterleitungen selbst; ein fremdes www- oder Nicht-www-Ziel koennte es gar nicht
       geben). Eine Datei geht unveraendert hinaus, und ihr Fehler bleibt ihr Fehler -- ausser die
       Function ist selbst auf die Domain zurueckgefallen (Version 5, fallback "host", siehe
       SM_FEHLER_RUECKFALL). Seiten gehen trotzdem weiter als Host hinaus: das spart den Umweg.
       { url, modus: "host" | "datei", domain (zum Zeigen, ohne www), umgestellt } oder null. */
    function smAnfrage(roh) {
      roh = String(roh == null ? "" : roh).trim();
      var z = zerlegen(roh);
      if (!z || !hostOk(z.host)) return null;
      if (smDateiArtig(z)) return { url: roh, modus: "datei", domain: z.host, umgestellt: false };
      var m = /^(https?:\/\/)?([^\/?#]+)/i.exec(roh);
      var ursprung = ((m && m[1]) || "").toLowerCase() + ((m && m[2]) || z.host).toLowerCase().replace(/^\*\./, "");
      return { url: ursprung, modus: "host", domain: z.host, umgestellt: !!(z.pfad || z.query) };
    }
    function smVorschlag(p) {
      var r = eingabeTeile(p.e.eingabe), z = r.length ? zerlegen(r[0]) : null;
      if (z && hostOk(z.host)) return smDateiArtig(z) ? r[0] : z.host;
      for (var i = 0; i < p.e.ziele.length; i++) { var h = zielHost(p.e.ziele[i]); if (h) return h; }
      return "";
    }
    /* Der Waehler zu einer Eingabe. DAS FELD FOLGT DER EINGABE (17.10., Nutzer: eine Domain
       eingegeben, den Waehler geoeffnet und zugemacht, eine ANDERE eingegeben und wieder geoeffnet:
       dort stand die alte). p.sm blieb nach dem Schliessen stehen, samt Adresse, geladener Sitemap,
       Auswahl und Fehler. Jetzt merkt sich p.sm.vorschlag, aus welcher Eingabe er zuletzt kam
       (smVorschlag): ist es beim Oeffnen eine andere, beginnt der Waehler von vorn -- Adresse,
       Baum, Auswahl, Suche und Fehler gehoeren zur alten Sitemap und gelten nicht fuer die neue. Ist es
       dieselbe, bleibt alles stehen, auch was jemand im Feld des Waehlers selbst getippt hat. */
    function smNeu() {
      return { offen: false, laeuft: false, fehler: "", antwort: null, knoten: {}, hosts: [], vorh: null, auf: {}, wahl: { ordner: {}, urls: {} }, suche: "", mehr: {}, url: "", vorschlag: null, seq: 0 };
    }
    function smOeffnen(p, url, laden) {
      if (!p || !sitemapDa()) return;
      var jetzt = smVorschlag(p);
      if (!p.sm) p.sm = smNeu();
      else if (p.sm.vorschlag !== jetzt) {
        /* Eine laufende Anfrage der alten Eingabe verfaellt (seq), ihr Ladebild geht mit. */
        if (p.sm.lb) { try { p.sm.lb.stop(); } catch (e) {} }
        var seq = (p.sm.seq || 0) + 1;
        p.sm = smNeu();
        p.sm.seq = seq;
      }
      p.sm.vorschlag = jetzt;
      p.sm.offen = true;
      if (url) p.sm.url = url; else if (!p.sm.url) p.sm.url = jetzt;
      smZeichnen(p);
      /* Steht der Waehler schon da (der Hinweis "This looks like a sitemap" oeffnet ihn mit einer neuen
         Adresse), zeigt sein Feld die neue -- smZeichnen setzt sie nur beim ersten Bauen. */
      var fe = im(".uev-sm-ein");
      if (fe && fe.value !== p.sm.url) fe.value = p.sm.url;
      smInSicht();
      if (laden && p.sm.url) smLaden(p);
      /* preventScroll: den Weg dorthin macht smInSicht -- ein zweiter, sofortiger Sprung des
         Fokus braeche die weiche Bewegung mittendrin ab. */
      else setTimeout(function () { var f = im(".uev-sm-ein"); try { if (f) f.focus({ preventScroll: true }); } catch (e) {} }, 30);
    }
    /* Der Waehler steht seit dem 15.10. spaet am Ende des Schritts, sein Knopf oben im Kopf des
       Feldes: ohne diesen Zug oeffnete er womoeglich unterhalb des Sichtbaren. Gezogen wird beim
       Oeffnen, beim Laden (Ladebild) und wenn die Antwort da ist -- erst dann ist er gross
       (gemessen 800 x 1000: mit Baum 278 hoch, das Popup darunter 128 zu lang, und nur der
       Zug beim Oeffnen liess ihn halb verdeckt). "nearest": steht er schon ganz da, bewegt sich nichts; ist er hoeher als das
       Sichtbare, kommt seine Oberkante nach oben. Nicht bei jedem Neuzeichnen -- wer im Baum
       waehlt, soll nicht weggezogen werden. */
    function smInSicht() {
      var el = im(".uev-sm");
      var ruhig = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      try { if (el) el.scrollIntoView({ block: "nearest", behavior: ruhig ? "auto" : "smooth" }); } catch (e) {}
    }
    function smZu(p) {
      if (!p || !p.sm) return;
      smSperreWeg(p);
      p.sm.offen = false;
      if (p.sm.lb) { try { p.sm.lb.stop(); } catch (e) {} p.sm.lb = null; }
      var ort = im(".uev-sm-ort");
      if (ort) ort.innerHTML = "";
      var kz = im(".uev-sm-knopfzeile");
      if (kz) kz.hidden = false;
      var k = im(".uev-sm-knopfzeile .uev-sm-auf");
      try { if (k) k.focus(); } catch (e) {}
    }
    /* rueckfall: die Antwort trug fallback "host" (Version 5) -- der Fehler gehoert dann der Domain,
       nicht mehr der eingegebenen Datei. timeout, too_large und blocked sagen auch danach, was den
       Abruf aufgehalten hat; nur "nicht gefunden" braucht den Hinweis auf den Link. */
    function smFehlerText(code, anf, rueckfall) {
      if (anf && (code === "not_found" || code === "invalid_xml")) {
        if (rueckfall) return ersetze(t(SM_FEHLER_RUECKFALL), { domain: anf.domain });
        return anf.modus === "datei" ? t(SM_FEHLER_DATEI[code]) : ersetze(t(SM_FEHLER_HOST), { domain: anf.domain });
      }
      return t(SM_FEHLER[code] || "The sitemap could not be loaded. Please try again.");
    }
    function smLaden(p) {
      var inp = im(".uev-sm-ein"), url = String(inp ? inp.value : p.sm.url || "").trim();
      p.sm.url = url;
      var anf = smAnfrage(url);
      if (!sitemapDa()) { p.sm.fehler = smFehlerText("not_configured"); smZeichnen(p); return; }
      if (!url) { p.sm.fehler = smFehlerText("leer"); smZeichnen(p); return; }
      if (!anf) { p.sm.fehler = smFehlerText("ungueltig"); smZeichnen(p); return; }
      p.sm.laeuft = true; p.sm.fehler = ""; p.sm.antwort = null;
      smZeichnen(p);
      smInSicht();
      var seq = p.sm.seq = (p.sm.seq || 0) + 1;
      teamHolen().then(function (tm) {
        if (!tm) return { ok: false, status: 0, fehler: { message: "network" } };
        return UC.edge("sitemap-lesen", { team_id: tm, url: anf.url }, { timeoutMs: 35000 });
      }).then(function (erg) {
        if (popup !== p || !p.sm || p.sm.seq !== seq) return;
        p.sm.laeuft = false;
        var d = erg && erg.ok ? erg.daten : null;
        if (d && d.ok === true && isArr(d.urls)) {
          p.sm.antwort = d;
          smBaum(p, d.urls);
        } else {
          var fe = (erg && erg.fehler) || {};
          var code = d && d.ok === false ? String(d.error || "") : String(fe.message || "");
          /* Function weg (404) oder ohne Gate (503 not_configured): fuer den Rest der Seite kein
             Knopf mehr, im offenen Waehler der Satz dazu, "Load" gesperrt. */
          if (edgeFehlt(erg)) {
            SITEMAP_DA.stand = false; code = "not_configured";
            var kz0 = im(".uev-sm-knopfzeile");
            if (kz0) kz0.parentNode.removeChild(kz0);
            schreibweiseZeigen(p);
          }
          p.sm.fehler = code === "rate_limited" ? smWarteText(fe.retry_after) : smFehlerText(code, anf, !!d && d.fallback === "host");
        }
        smZeichnen(p);
        smInSicht();
      });
    }
    function smBaum(p, urls) {
      var knoten = {}, hosts = [];
      function neu(key, host, pfad, tiefe, art, eltern) {
        var k = { key: key, host: host, pfad: pfad, tiefe: tiefe, art: art, eltern: eltern, kinder: [], kinderJe: {}, seiten: [], n: 0, neu: "" };
        knoten[key] = k;
        if (eltern) { eltern.kinderJe[key] = k; eltern.kinder.push(k); } else hosts.push(k);
        return k;
      }
      urls.forEach(function (u) {
        var loc = String(u && u.loc || "").trim(), x = null;
        try { x = new URL(loc); } catch (e) { x = null; }
        if (!x || !/^https?:$/.test(x.protocol)) return;
        var host = x.hostname.toLowerCase().replace(/^www\./, ""), teile = x.pathname.split("/").filter(Boolean);
        var lm = String(u.lastmod || "").slice(0, 10);
        var k = knoten["h:" + host] || neu("h:" + host, host, "", 0, "host", null);
        function zaehl(n) { n.n++; if (lm > n.neu) n.neu = lm; }
        zaehl(k);
        for (var i = 0; i < teile.length - 1; i++) {
          var pfad = "/" + teile.slice(0, i + 1).join("/"), key = "p:" + host + pfad;
          k = k.kinderJe[key] || neu(key, host, pfad, i + 1, "ordner", k);
          zaehl(k);
        }
        if (knoten["u:" + loc]) return;
        var s = { key: "u:" + loc, loc: loc, host: host, pfad: x.pathname + (x.search || ""), lastmod: lm, eltern: k, tiefe: k.tiefe + 1, art: "seite" };
        knoten[s.key] = s;
        k.seiten.push(s);
      });
      function ordnen(k) {
        k.kinder.sort(function (a, b) { return a.pfad < b.pfad ? -1 : a.pfad > b.pfad ? 1 : 0; });
        k.seiten.sort(function (a, b) { return a.lastmod !== b.lastmod ? (a.lastmod < b.lastmod ? 1 : -1) : (a.pfad < b.pfad ? -1 : 1); });
        k.kinder.forEach(ordnen);
      }
      hosts.sort(function (a, b) { return b.n - a.n; });
      hosts.forEach(ordnen);
      p.sm.knoten = knoten; p.sm.hosts = hosts; p.sm.vorh = null;
      p.sm.auf = {}; p.sm.wahl = { ordner: {}, urls: {} }; p.sm.mehr = {}; p.sm.suche = "";
      /* Ein Host: gleich aufgeklappt -- sonst stuende eine einzelne Zeile da. */
      if (hosts.length === 1) p.sm.auf[hosts[0].key] = true;
    }
    /* Gedeckt: ein Vorfahr ist als Regel gewaehlt -- die Seite ist darin schon enthalten. */
    function smGedecktDurch(p, k) {
      for (var e = k.eltern; e; e = e.eltern) if (p.sm.wahl.ordner[e.key]) return e;
      return null;
    }
    function smGedeckt(p, k) { return !!smGedecktDurch(p, k); }
    /* Gewaehlt und zaehlt: nicht in einem gewaehlten Ordner und nicht schon getrackt. */
    function smGewaehlt(p) {
      var v = smVorhanden(p);
      function zaehlt(k) { return p.sm.knoten[k] && !v.an[k] && !v.regel[k] && !smGedeckt(p, p.sm.knoten[k]); }
      return { ordner: Object.keys(p.sm.wahl.ordner).filter(zaehlt), urls: Object.keys(p.sm.wahl.urls).filter(zaehlt) };
    }
    /* Das Ziel, das ein Knoten beim Uebernehmen wird: Host -> ganze Domain, Ordner -> Pfad, Seite -> URL. */
    function smZielVon(k) {
      return k.art === "seite" ? zielBauen(k.loc, "url") : k.art === "host" ? zielBauen(k.host, "host") : zielBauen(k.host + k.pfad, "path");
    }
    /* Was schon getrackt wird -- die Liste dieses Dialogs und im Add-Dialog die Ziele des Events
       (16.10.). Ein Knoten, der GENAU so schon drin ist (derselbe Schluessel wie smZielVon),
       steht gewaehlt und gesperrt da ("Already added") und zaehlt nicht gegen den Deckel: bis
       16.10. zaehlte die Auswahl ihn mit, und smUebernehmen liess ihn dann still fallen. Ein
       Knoten UNTER einer Regel davon bleibt seit 17.10. waehlbar -- er wird eine eigene Zeile mit
       eigenem Vorher-Wert (deckendeRegel); er traegt nur leise, unter welcher Regel er schon
       mitzaehlt. Bis dahin stand bei einem Event mit ganzer Domain jede Seite gesperrt da und der
       Satz "Everything in this sitemap is already added.". Gerechnet einmal je Stand der Liste
       (sig) und je geladener Sitemap, nicht bei jedem Zeichnen -- eine Sitemap darf 50 000 Seiten
       haben. an[key]: der Knoten selbst; regel[key]: die Regel,
       unter die er faellt (nur, wenn er nicht selbst drin ist). */
    function smVorhanden(p) {
      var l = p.e.ziele.slice(), d = p.art === "ziel" ? state.detail[p.eventId] : null;
      if (d && isArr(d.targets)) d.targets.forEach(function (x) { var y = zielAusDb(x); if (y) l.push(y); });
      else if (d && isArr(d.urls)) d.urls.forEach(function (u) { var y = zielBauen(u && u.url, "url"); if (!y.fehler) l.push(y); });
      var sig = l.map(function (z) { return z.key; }).join("\n");
      if (p.sm.vorh && p.sm.vorh.sig === sig && p.sm.vorh.knoten === p.sm.knoten) return p.sm.vorh;
      var v = p.sm.vorh = { sig: sig, knoten: p.sm.knoten, an: {}, regel: {} };
      if (!l.length) return v;
      /* Je Art die Schluessel: smZielVon laeuft nur fuer Knoten, deren Art ueberhaupt drin ist --
         bei 50 000 Seiten und keinem url-Ziel also kein zielBauen je Seite. */
      var schl = { seite: {}, ordner: {}, host: {} }, mit = {}, regeln = [];
      l.forEach(function (z) {
        var art = z.kind === "url" ? "seite" : z.kind === "path" ? "ordner" : z.kind === "host" ? "host" : "";
        if (art) { schl[art][z.key] = 1; mit[art] = true; }
        if (z.kind === "url") return;
        var x = zerlegen(z.input);
        if (x && x.host) regeln.push({ z: z, kind: z.kind, host: x.host, pfad: z.kind === "path" ? x.pfad : "" });
      });
      /* Genannt wird die engste Regel: ein Pfad vor der Domain, ein laengerer Pfad vor einem kuerzeren. */
      var RANG = { path: 0, host: 1, host_all: 2 };
      regeln.sort(function (a, b) { return RANG[a.kind] - RANG[b.kind] || b.pfad.length - a.pfad.length; });
      /* Dieselbe Pfadgrenze wie die Datenbank (Vertrag Abschnitt 1): /blog trifft /blog und
         /blog/..., nicht /blogger; die Query zaehlt nicht. */
      function deckt(k) {
        var pfad = k.art === "seite" ? k.pfad.split("?")[0].replace(/\/+$/, "") : k.pfad;
        for (var i = 0; i < regeln.length; i++) {
          var r = regeln[i];
          if (r.kind === "host_all" ? (k.host === r.host || k.host.slice(-r.host.length - 1) === "." + r.host)
              : k.host === r.host && (r.kind === "host" || (k.art !== "host" && (pfad === r.pfad || pfad.indexOf(r.pfad + "/") === 0)))) return r.z;
        }
        return null;
      }
      Object.keys(p.sm.knoten).forEach(function (key) {
        var k = p.sm.knoten[key], art = k.art === "seite" || k.art === "host" ? k.art : "ordner";
        if (mit[art] && schl[art][smZielVon(k).key]) {
          v.an[key] = true;
          return;
        }
        var r = deckt(k);
        if (r) v.regel[key] = r;
      });
      return v;
    }
    /* ---- DER DECKEL IM WAEHLER (16.10.) -------------------------------------------------------
       Je Zeichnen einmal: wie viele Ziele die Auswahl ergibt (anzahl), wie viele hineinpassen
       (frei, zielFrei), und je Ordner, wie viele gewaehlte Ziele darunter liegen. Daraus folgt:
       eine Seite geht, solange anzahl < frei; ein Ordner geht, wenn er nach dem Ersetzen dessen,
       was er enthaelt, noch passt (bei voller Auswahl ein Tausch vieler Seiten gegen eine Regel).
       Die Auswahl ist selbst gedeckelt, die Schleife also kurz. */
    function smDeckel(p) {
      var v = smVorhanden(p), gew = smGewaehlt(p), dk = { v: v, gew: gew, anzahl: gew.ordner.length + gew.urls.length, frei: zielFrei(p), unter: {} };
      function hoch(key) {
        for (var e = p.sm.knoten[key].eltern; e; e = e.eltern) dk.unter[e.key] = (dk.unter[e.key] || 0) + 1;
      }
      gew.ordner.forEach(hoch);
      gew.urls.forEach(hoch);
      return dk;
    }
    /* Wie viele Ziele diese Sitemap HOECHSTENS noch hergibt, ohne den Deckel (17.10.). Bis dahin
       stand unten "0 of 49 selected", auch wenn eine gewaehlte Domain jede Seite schon deckte
       (Nutzer: "wirkt verwirrend") -- der Nenner war der freie Platz im Event, nicht das, was
       hier ueberhaupt waehlbar ist. Gezaehlt wie die Auswahl selbst: ein Ordner zaehlt eins,
       seine Seiten einzeln zaehlen mehr, beides zugleich geht nicht (smGedeckt) -- je Ordner
       also das Groessere. Ein getrackter Knoten gibt selbst nichts her, was darunter liegt aber
       schon (seit 17.10.: eine Seite unter einer Regel ist eine eigene Zeile, deckendeRegel) --
       bei einem Event mit ganzer Domain also jede Seite. Ein Ordner, dessen Seiten alle schon als
       URL drin sind, bleibt waehlbar: seine Regel zaehlt auch Seiten, die erst spaeter dazukommen.
       Einmal je v (smVorhanden). */
    function smHoechstens(p, v) {
      if (v.max != null) return v.max;
      function geh(k) {
        var s = 0;
        k.seiten.forEach(function (x) { if (!v.an[x.key] && !v.regel[x.key]) s++; });
        k.kinder.forEach(function (c) { s += geh(c); });
        return v.an[k.key] || v.regel[k.key] ? s : Math.max(1, s);
      }
      var n = 0;
      (p.sm.hosts || []).forEach(function (h) { n += geh(h); });
      return (v.max = n);
    }
    /* Passt dieser (noch nicht gewaehlte) Knoten dazu? Ein Ordner ersetzt, was darunter gewaehlt ist. */
    function smPasst(dk, k) { return dk.anzahl + 1 - (k.art === "seite" ? 0 : dk.unter[k.key] || 0) <= dk.frei; }
    function smOrdnerName(k) { return k.art === "host" ? k.host : k.pfad.slice(k.pfad.lastIndexOf("/")) ; }
    /* Der Zustand einer Zeile (16.10.): getrackt ("Already added", aus core), im gewaehlten Ordner
       enthalten, gewaehlt -- oder VOLL: nicht gewaehlt und passt nicht mehr hinein. Voll ist
       gesperrt wie gedeckt, aber ohne Haken, und sagt im Tooltip warum. Seit 17.10. dazu REGEL:
       faellt unter eine Regel der Liste oder des Events, bleibt aber waehlbar (eigene Zeile,
       deckendeRegel) -- der Tooltip sagt es, und in der Zeile steht leise "In {regel}". */
    function smZustand(p, dk, k) {
      /* UNTER EINER REGEL (18.10., Nutzer): steht die ganze Domain (oder ein Pfad) schon als Ziel da, ist alles darunter
         enthalten -- die Zeile steht gewaehlt UND gesperrt, wie eine im gewaehlten Ordner. Bis 17.10. blieb sie waehlbar
         ("eigene Zeile"), stand aber ungewaehlt unter einer gewaehlten Domain, und der Fuss sagte "0 of 9 selected". */
      var vorh = !!dk.v.an[k.key], gedeckt = !vorh && smGedeckt(p, k), regel = !vorh && !gedeckt ? dk.v.regel[k.key] || null : null;
      var gesperrt = vorh || gedeckt || !!regel;
      var an = gesperrt || !!(k.art === "seite" ? p.sm.wahl.urls[k.key] : p.sm.wahl.ordner[k.key]);
      var voll = !an && !smPasst(dk, k);
      /* tip: der Tooltip der Zeile, NUR fuer eine waehlbare Seite unter einer Regel (sie bleibt bedienbar).
         hinweis: warum eine gesperrte Zeile sich nicht aendern laesst -- er steht erst nach einem KLICK
         darauf (smSperre), nie beim Ueberfahren: Zeilen unter einem gewaehlten Ordner stehen gewaehlt und
         gedaempft da, und ein Tooltip auf jeder davon deckte beim Hinunterfahren die naechsten zu. */
      var ord = gedeckt ? smGedecktDurch(p, k) : null;
      /* Kein Tooltip an der Zeile: die gesperrte, gewaehlte Zeile sagt es selbst, der Satz kommt auf den Klick. */
      return { an: an, gesperrt: gesperrt, vorh: vorh, voll: voll, regel: regel, tip: "",
        hinweis: vorh ? t("Already added") : regel ? smRegelHinweis(regel) : gedeckt ? ersetze(t("Included in {ordner}. Clear that folder to choose this page on its own."), { ordner: ord ? ord.host + (ord.pfad || "") : "" })
          : voll ? t("No more targets fit into this event.") : "" };
    }
    /* Der Name eines Ziels in einem Satz: ratgeber.lee-up.de oder lee-up.de/blog, ohne Schema, Stern und "/*" der Schreibweise. */
    function smZielName(z) {
      return String(z && (z.input || z.zeigen) || "").replace(/^https?:\/\//i, "").replace(/^\*\./, "").replace(/\/\*$/, "");
    }
    function smRegelHinweis(r) {
      if (r.kind === "path") return ersetze(t("You're tracking everything under {ziel}, so individual pages can't be excluded. To pick specific pages, switch to \u201cSpecific URLs\u201d."), { ziel: smZielName(r) });
      return t("You're tracking the whole domain, so individual pages can't be excluded. To pick specific pages, switch to \u201cEverything under a path\u201d or \u201cSpecific URLs\u201d.");
    }
    function smReihe(p, k, flach, dk) {
      var z = smZustand(p, dk, k), tiefe = flach ? 0 : k.tiefe;
      var klassen = (z.an ? " is-checked" : "") + (z.gesperrt ? " is-gedeckt" : "") + (z.voll ? " is-voll" : "");
      var aria = ' aria-selected="' + z.an + '"' + (z.gesperrt || z.voll ? ' aria-disabled="true"' : '') + (z.tip ? ' data-tip="' + esc(z.tip) + '"' : '');
      if (k.art === "seite") {
        /* Im Baum der Teil nach dem Ordner ("/artikel-1" unter "/blog"), in der Suche der ganze. */
        var name = flach ? k.host + k.pfad : (k.pfad === "/" ? t("Homepage") : k.pfad.slice((k.eltern && k.eltern.pfad || "").length) || k.pfad);
        return '<div class="up-filter-item uev-sm-reihe is-seite' + klassen + '" role="treeitem" aria-level="' + (tiefe + 1) + '"' + aria +
            ' tabindex="-1" data-sm-wahl="' + esc(k.key) + '" style="--uev-tiefe:' + tiefe + '">' +
          '<span class="uev-sm-auf-platz" aria-hidden="true"></span>' +
          '<span class="up-filter-check">' + UC.icon("check", 3) + '</span>' +
          '<span class="uev-sm-name" title="' + esc(k.loc) + '">' + esc(name) + '</span>' +
          (k.lastmod ? '<span class="uev-sm-angaben"><span class="uev-sm-datum" data-tip="' + esc(t("Newest change")) + '">' + esc(datum(k.lastmod)) + '</span></span>' : '') +
        '</div>';
      }
      var offen = !!p.sm.auf[k.key] && !flach;
      var titel = k.art === "host" ? k.host : (flach ? k.host + k.pfad : smOrdnerName(k));
      return '<div class="up-filter-item uev-sm-reihe is-ordner' + klassen + '" role="treeitem" aria-level="' + (tiefe + 1) + '"' + aria +
          (flach ? '' : ' aria-expanded="' + offen + '"') + ' tabindex="-1" data-sm-wahl="' + esc(k.key) + '" style="--uev-tiefe:' + tiefe + '"' +
          ' aria-label="' + esc(ersetze(t("Track everything under {path}"), { path: k.host + (k.pfad || "") })) + '">' +
        (flach ? '<span class="uev-sm-auf-platz" aria-hidden="true"></span>'
          : '<button type="button" class="up-iconbtn is-20 is-quiet uev-sm-klapp" data-sm-klapp="' + esc(k.key) + '" tabindex="-1" aria-label="' + esc(t(offen ? "Collapse" : "Expand")) + '">' + UC.icon(offen ? "chevronDown" : "chevronRight", 2) + '</button>') +
        '<span class="up-filter-check">' + UC.icon("check", 3) + '</span>' +
        '<span class="uev-sm-ic">' + (k.art === "host" ? zielFavKlein(k.host, UC.icon("globe", 2)) : UC.icon(offen ? "folderOpen" : "folder", 2)) + '</span>' +
        '<span class="uev-sm-name">' + esc(titel) + '</span>' +
        '<span class="uev-sm-angaben"><span class="uev-sm-n">' + esc(ersetze(t(k.n === 1 ? "{n} page" : "{n} pages"), { n: zahl(k.n) })) + '</span>' +
          (k.neu ? '<span class="uev-sm-datum" data-tip="' + esc(t("Newest change")) + '">' + esc(datum(k.neu)) + '</span>' : '') + '</span>' +
      '</div>';
    }
    function smReihen(p, dk) {
      var aus = [], q = String(p.sm.suche || "").trim().toLowerCase();
      if (q) {
        /* Suche: flach -- passende Ordner und Seiten mit vollem Pfad. */
        var n = 0;
        Object.keys(p.sm.knoten).forEach(function (key) {
          var k = p.sm.knoten[key];
          if (n >= SM_TREFFER) return;
          var text = (k.art === "seite" ? k.loc : k.host + (k.pfad || "")).toLowerCase();
          if (text.indexOf(q) >= 0) { aus.push(smReihe(p, k, true, dk)); n++; }
        });
        return aus.length ? aus.join("") : '<div class="up-ment-noresult">' + esc(t("No matching pages")) + '</div>';
      }
      function geh(k) {
        aus.push(smReihe(p, k, false, dk));
        if (!p.sm.auf[k.key]) return;
        k.kinder.forEach(geh);
        var max = SM_SEITEN + (p.sm.mehr[k.key] || 0);
        k.seiten.slice(0, max).forEach(function (s) { aus.push(smReihe(p, s, false, dk)); });
        if (k.seiten.length > max) aus.push('<button type="button" class="up-quietbtn uev-sm-mehr" data-sm-mehr="' + esc(k.key) + '" style="--uev-tiefe:' + (k.tiefe + 1) + '">' +
          esc(ersetze(t("Show {n} more"), { n: zahl(Math.min(SM_MEHR, k.seiten.length - max)) })) + '</button>');
      }
      (p.sm.hosts || []).forEach(geh);
      return aus.join("");
    }
    function smZeichnen(p) {
      var ort = im(".uev-sm-ort");
      if (!ort || !p.sm) return;
      /* Der Knopf "Load from sitemap" steht nicht doppelt ueber dem offenen Waehler. */
      var kz = im(".uev-sm-knopfzeile");
      if (kz) kz.hidden = !!p.sm.offen;
      if (!p.sm.offen) { ort.innerHTML = ""; return; }
      var sm = p.sm;
      if (!ort.querySelector(".uev-sm")) {
        ort.innerHTML = '<div class="uev-sm" role="group" aria-label="' + esc(t("Load from sitemap")) + '">' +
          '<div class="uev-sm-kopf"><span class="uev-sm-titel">' + UC.icon("folderTree", 2) + '<span>' + esc(t("Load from sitemap")) + '</span></span>' +
            '<button type="button" class="up-iconbtn uev-sm-zu" aria-label="' + esc(t("Close")) + '" data-tip="' + esc(t("Close")) + '">' + UC.icon("x", 2) + '</button></div>' +
          '<div class="uev-sm-zeile"><input type="text" class="up-topicmodal-name uev-sm-ein" placeholder="' + esc(t("Sitemap link or domain")) + '" aria-label="' + esc(t("Sitemap link or domain")) + '" autocomplete="off" spellcheck="false" inputmode="url"/>' +
            '<button type="button" class="up-btn-sec uev-sm-laden">' + esc(t("Load")) + '</button></div>' +
          '<div class="up-fehlerzeile uev-sm-fehler" role="alert"><span></span></div>' +
          '<div class="uev-sm-inhalt"></div>' +
        '</div>';
        ort.querySelector(".uev-sm-ein").value = sm.url || "";
      }
      var fe = ort.querySelector(".uev-sm-fehler");
      fe.firstChild.textContent = sm.fehler || "";
      fe.classList.toggle("is-on", !!sm.fehler);
      var knopf = ort.querySelector(".uev-sm-laden");
      knopf.disabled = !!sm.laeuft || !sitemapDa();
      var inh = ort.querySelector(".uev-sm-inhalt");
      if (sm.laeuft) {
        if (!inh.querySelector(".up-lb")) {
          inh.innerHTML = '<div class="uev-sm-lb"></div>';
          /* kompakt: ein Teilschritt im Dialog, kein ganzer Bildschirm (Kreis 40 statt 48, core 16.10.). */
          sm.lb = UC.makeLadebild ? UC.makeLadebild(inh.querySelector(".uev-sm-lb"), { icon: "cells", name: "Reading your sitemap",
            saetze: ["Looking for your sitemap…", "Reading pages…", "Sorting pages into folders…"], kompakt: true }) : null;
          if (sm.lb) sm.lb.start();
        }
        return;
      }
      if (sm.lb) { try { sm.lb.stop(); } catch (e) {} sm.lb = null; }
      if (!sm.antwort) { inh.innerHTML = ""; return; }
      var d = sm.antwort, total = num(d.total) != null ? num(d.total) : d.urls.length, quelle = String(d.source || "");
      var dk = smDeckel(p), anzahl = dk.anzahl;
      if (!inh.querySelector(".uev-sm-baum")) {
        inh.innerHTML =
          '<div class="uev-sm-saetze"><p class="up-modal-hinweis uev-sm-quelle"></p>' +
            '<p class="up-modal-hinweis uev-sm-deckel" aria-live="polite"></p></div>' +
          '<div class="up-ment-searchwrap uev-sm-suchw"><input class="up-ment-search uev-sm-suche" type="text" placeholder="' + esc(t("Search pages…")) + '" aria-label="' + esc(t("Search pages…")) + '" autocomplete="off" spellcheck="false"/>' +
            '<button class="up-ment-searchclear uev-sm-suche-x" type="button" aria-label="' + esc(t("Clear search")) + '">' + UC.icon("x", 2) + '</button></div>' +
          '<div class="up-filter-list uev-sm-baum" role="tree" aria-multiselectable="true" aria-label="' + esc(t("Pages")) + '"></div>' +
          '<p class="up-modal-hinweis uev-sm-sperre" aria-live="polite" hidden></p>' +
          '<div class="uev-sm-fuss"><span class="uev-sm-zahl"></span><button type="button" class="up-btn-pri uev-sm-nehmen">' + esc(t("Add selection")) + '</button></div>';
      }
      var hq = inh.querySelector(".uev-sm-quelle");
      /* Rueckfall (fallback "host", Version 5): der Link war keine Sitemap, gelesen wurde die der
         Domain -- das steht VOR der Zahl, sonst haelt man die Seiten fuer die des eingegebenen Links.
         Die Quelle nennt die Zeile ohnehin. */
      var rueck = d.fallback === "host", qName = hostPfad(quelle).host + (hostPfad(quelle).start ? "" : hostPfad(quelle).pfad);
      /* Eine Seite in der Einzahl: der echte Fall aus Version 5 (excalidraw.com, total 1) las
         sonst "1 pages". */
      var eins = total === 1;
      hq.textContent = (d.urls.length
          ? ersetze(t(rueck ? (eins ? "This link isn't a sitemap. 1 page from {source} instead." : "This link isn't a sitemap. {n} pages from {source} instead.")
              : (eins ? "1 page from {source}" : "{n} pages from {source}")), { n: zahl(total), source: qName })
          : (rueck ? ersetze(t("This link isn't a sitemap, and {source} lists no pages."), { source: qName }) : t("This sitemap lists no pages.")))
        + (d.truncated === true ? " " + ersetze(t("Only the first {n} pages could be read."), { n: zahl(d.urls.length) }) : "");
      var suche = inh.querySelector(".uev-sm-suche");
      if (suche && suche.value !== sm.suche && document.activeElement !== suche) suche.value = sm.suche;
      inh.querySelector(".uev-sm-suchw").classList.toggle("has-text", !!sm.suche);
      var baum = inh.querySelector(".uev-sm-baum"), oben = baum.scrollTop;
      baum.innerHTML = d.urls.length ? smReihen(p, dk) : "";
      baum.scrollTop = oben;
      var roving = baum.querySelector('.uev-sm-reihe[tabindex="-1"]');
      if (roving && !baum.querySelector('.uev-sm-reihe[tabindex="0"]')) roving.tabIndex = 0;
      /* Eine Sitemap ohne Seiten: nur der Satz oben. Suchfeld, leerer Baum und "0 of 48 selected"
         standen bis 17.10. trotzdem da. */
      var fuss = inh.querySelector(".uev-sm-fuss");
      inh.querySelector(".uev-sm-suchw").hidden = baum.hidden = !d.urls.length;
      /* Wie viele noch gehen, VOR dem Waehlen (16.10.): oben der Satz, unten "3 of 50 selected".
         Seit 17.10. ist der Nenner das, was hier wirklich noch geht -- der freie Platz im Event
         ODER was die Sitemap hergibt (smHoechstens), das Kleinere. Gibt sie nichts her (alles
         schon getrackt) oder ist das Event voll, gibt es nichts zu waehlen: dann weder Zahl noch
         Knopf, oben steht der Grund. Der Satz zum Deckel steht nur, wenn der Deckel hier
         ueberhaupt greifen kann -- bei drei waehlbaren Seiten stand sonst "You can add 48 more
         targets" neben "0 of 3 selected". */
      var hoechst = smHoechstens(p, dk.v), nenner = Math.min(dk.frei, hoechst);
      var rest = dk.frei - anzahl, dl = inh.querySelector(".uev-sm-deckel");
      /* Alles unter einer Regel des Events oder der Liste (18.10.): der Fuss sagt es ruhig statt "0 of 9 selected", ohne
         Knopf (es gibt nichts zu waehlen). Gemischt mit einzeln getrackten Seiten: der allgemeine Satz. */
      var gedeckt = smGedecktText(p, dk.v);
      dl.textContent = !d.urls.length ? "" : !hoechst ? (gedeckt ? "" : t("Everything in this sitemap is already added."))
        : !dk.frei ? fehlerText("impact_event_too_many_targets")
        : hoechst <= dk.frei ? ""
        : rest <= 0 ? t("That's the most you can add. To cover more pages, select a folder instead.")
        : rest === 1 ? t("You can add 1 more target. A folder counts as one and covers every page in it.")
        : ersetze(t("You can add {n} more targets. A folder counts as one and covers every page in it."), { n: zahl(rest) });
      dl.hidden = !dl.textContent;
      fuss.hidden = !d.urls.length || !nenner;
      var nimm = inh.querySelector(".uev-sm-nehmen");
      if (d.urls.length && !hoechst && gedeckt) { fuss.hidden = false; nimm.hidden = true; inh.querySelector(".uev-sm-zahl").textContent = gedeckt; nimm.disabled = true; return; }
      nimm.hidden = false;
      inh.querySelector(".uev-sm-zahl").textContent = nenner ? ersetze(t("{n} of {total} selected"), { n: zahl(anzahl), total: zahl(nenner) }) : "";
      nimm.disabled = !anzahl || anzahl > dk.frei;
    }
    /* "All 9 pages are covered by ratgeber.lee-up.de": alle Seiten der Sitemap liegen unter Regeln (Domain, Pfad), keine ist
       frei. Eine Regel: ihr Name; mehrere: "your targets". Gibt es auch nur eine einzeln getrackte Seite, bleibt es beim
       allgemeinen Satz (leer hier). */
    function smGedecktText(p, v) {
      var n = 0, namen = {}, anz = 0;
      Object.keys(p.sm.knoten).forEach(function (key) {
        var k = p.sm.knoten[key];
        if (k.art !== "seite") return;
        n++;
        if (v.regel[key]) { namen[smZielName(v.regel[key])] = 1; anz++; }
        else if (!v.an[key]) anz = -1e9;
      });
      if (!n || anz !== n) return "";
      var l = Object.keys(namen);
      return ersetze(t(n === 1 ? "The page is covered by {ziel}." : "All {n} pages are covered by {ziel}."), { n: zahl(n), ziel: l.length === 1 ? l[0] : t("your targets") });
    }
    /* Der Grund, warum eine Zeile gesperrt ist: ein Satz unter dem Baum, nach einem Klick darauf, vier Sekunden. */
    function smSperre(p, text) {
      var el = im(".uev-sm-sperre");
      if (!el) return;
      clearTimeout(p.sm.sperreUhr);
      el.textContent = text || "";
      el.hidden = !text;
      if (text) p.sm.sperreUhr = setTimeout(function () { smSperreWeg(p); }, 4000);
    }
    function smSperreWeg(p) {
      if (p && p.sm) clearTimeout(p.sm.sperreUhr);
      var el = im(".uev-sm-sperre");
      if (el) { el.textContent = ""; el.hidden = true; }
    }
    function smUmschalten(p, key) {
      var k = p.sm.knoten[key];
      if (!k) return;
      /* Gesperrt (getrackt, im Ordner) oder voll: nichts aendern -- auch nicht per Tastatur. */
      var z = smZustand(p, smDeckel(p), k);
      if (z.gesperrt || z.voll) { smSperre(p, z.hinweis); return; }
      smSperreWeg(p);
      if (k.art === "seite") { if (p.sm.wahl.urls[key]) delete p.sm.wahl.urls[key]; else p.sm.wahl.urls[key] = true; }
      else {
        if (p.sm.wahl.ordner[key]) delete p.sm.wahl.ordner[key];
        else {
          p.sm.wahl.ordner[key] = true;
          /* Was darin schon einzeln gewaehlt war, ist jetzt in der Regel enthalten. */
          Object.keys(p.sm.wahl.urls).concat(Object.keys(p.sm.wahl.ordner)).forEach(function (kk) {
            var x = p.sm.knoten[kk];
            if (x && x !== k && smGedeckt(p, x)) { delete p.sm.wahl.urls[kk]; delete p.sm.wahl.ordner[kk]; }
          });
        }
      }
      smZeichnen(p);
      smFokus(p, key);
    }
    function smFokus(p, key) {
      var b = im(".uev-sm-baum");
      if (!b) return;
      var l = b.querySelectorAll(".uev-sm-reihe");
      for (var i = 0; i < l.length; i++) {
        var an = l[i].getAttribute("data-sm-wahl") === key;
        l[i].tabIndex = an ? 0 : -1;
        if (an) { try { l[i].focus({ preventScroll: false }); } catch (e) {} }
      }
    }
    /* Die Auswahl als Ziele in die Liste (smZielVon). */
    function smUebernehmen(p) {
      var gew = smGewaehlt(p), neu = [];
      /* Die Sitemap, aus der die Auswahl kommt, geht mit jedem Regel-Ziel mit (zielKoerper). */
      var quelle = String(p.sm.antwort && p.sm.antwort.source || "");
      gew.ordner.concat(gew.urls).forEach(function (key) { var z = smZielVon(p.sm.knoten[key]); if (!z.fehler) { if (quelle) z.sitemapUrl = quelle; neu.push(z); } });
      neu = neu.filter(function (z) { return !zielGewaehlt(p, z) && !zielImEvent(p, z); });
      /* Kam etwas unter einer Regel dazu, steht am Feld derselbe leise Satz wie nach der Eingabe
         (eingabeUebernehmen) -- gefragt VOR dem Hinzufuegen, sonst deckte die Auswahl sich selbst. */
      p.schreibNotiz = null;
      for (var i = 0; i < neu.length && !p.schreibNotiz; i++) {
        var rg = zielUnterRegel(p, neu[i]);
        if (rg) p.schreibNotiz = { z: neu[i], x: rg, eigen: true };
      }
      /* Die letzte Wache: die Auswahl ist schon gedeckelt (smDeckel), aber uebernommen wird nie
         mehr, als in diesem Event noch frei ist -- auch nicht aus einem aelteren Bild. */
      if (neu.length > zielFrei(p)) {
        p.schreibNotiz = null;
        p.sm.fehler = zuVielText(p);
        smZeichnen(p);
        return;
      }
      neu.forEach(function (z) { p.e.ziele.push(z); });
      if (!p.e.zielArt || p.e.zielArt === "marke") p.e.zielArt = gew.ordner.length ? "path" : "url";
      smZu(p);
      feldFehler("ziele", "");
      zieleZeigen(p, true);
      klappen(im(".uev-unter-klapp"), p.e.zielArt === "host");
    }

    /* ---- Zeichnen in einem offenen Popup --------------------------------------------------- */
    function im(sel) { return popup ? popup.api.el.querySelector(sel) : null; }
    /* Vier Schritte seit 15.10.: die Ziele sind ein eigener Schritt, das Pruefen der letzte. */
    /* Die Schritte eines Ablaufs: das Event hat vier, das Citation Tracking zwei (nur Tracking und Pruefen, 19.10.: kein Detail-Schritt, der Name steht oben im ersten). */
    function reiheVon(p) { return p && p.e && p.e.art === "watch" ? [3, 4] : [1, 2, 3, 4]; }
    function vor(p, richtung) {
      var r = reiheVon(p), i = r.indexOf(p.schritt) + richtung;
      return r[Math.max(0, Math.min(r.length - 1, i))];
    }
    function schrittText(n) {
      /* Beim Bearbeiten eines geplanten Events heisst der letzte Schritt "Check and save" (Audit EV-05). */
      var r = reiheVon(popup), i = Math.max(0, r.indexOf(n));
      return ersetze(t(r.length === 2 ? "Step {n} of 2" : "Step {n} of 4"), { n: i + 1 }) + ": " + t(["Details", "Prompts", "Tracking", popup && popup.planEventId ? "Check and save" : "Check and create"][n - 1]);
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
      if (!p) return;
      /* Kampagnen kamen erst nach dem Aufbau (Pruefaufruf): das Feld einmal ganz neu, mit
         Umschalter und Satz. Das Menue ist dann zu -- geoeffnet wird es erst nach dem Aufbau. */
      var fd = im(".uev-datumfeld");
      if (fd && kampagneDa() !== !!fd.querySelector(".uev-datummodus")) {
        var tmp = document.createElement("div");
        tmp.innerHTML = datumFeld(p.e);
        fd.parentNode.replaceChild(tmp.firstChild, fd);
        return;
      }
      /* Einzeln oder Zeitraum: die Felder darunter wechseln, der Umschalter bleibt stehen (sein Schieber
         faehrt sonst nicht). Offene Menues vorher zu -- ihre Huelle ist gleich weg. */
      var inh = im(".uev-datuminhalt");
      if (inh && inh.getAttribute("data-modus") !== datumModus(p.e)) {
        menueZu("datum"); menueZu("ende");
        inh.setAttribute("data-modus", datumModus(p.e));
        inh.innerHTML = datumInhalt(p.e);
        b = im('[data-wahl="datum"]');
      }
      if (b) {
        var tx = b.querySelector(".up-modal-wahl-txt");
        tx.textContent = datumText(p.e);
        tx.classList.toggle("is-leer", !p.e.datum);
      }
      var m = im(".uev-datumwahl");
      if (m) m.innerHTML = kalender(p.e);
      endeNeu();
      var sg = im(".uev-datummodus");
      if (sg) {
        var sb = sg.querySelectorAll("[data-datummodus]");
        for (var i = 0; i < sb.length; i++) {
          var an = (sb[i].getAttribute("data-datummodus") === "bereich") === !!p.e.bereich;
          sb[i].classList.toggle("is-active", an); sb[i].setAttribute("aria-pressed", String(an));
        }
        if (UC.segJetzt) { try { UC.segJetzt(sg); } catch (e) {} }
      }
      var hf = im(".uev-datumhilfe");
      if (hf) hf.textContent = datumHilfe(p.e);
    }
    function aussehenNeu() { var el = im(".uev-aussehen"); if (el) el.innerHTML = aussehen(popup.e); }
    function menueZu(art) {
      var p = popup, pop = p && p.pops[art];
      if (pop) pop.close();
      var b = im('[data-wahl="' + art + '"]');
      if (b) b.setAttribute("aria-expanded", "false");
    }
    function umfangSig(e) { return e.modus === "all" ? "all" : "topics|" + tagModusWirkt(e) + "|" + e.topics.slice().sort().join(","); }
    /* "And" wirkt erst ab zwei Topics -- mit einem ist "alle" dasselbe wie "eins". Dann geht der
       Parameter gar nicht erst hinaus (und die Zahl von eben gilt weiter). */
    function tagModusWirkt(e) { return e.modus === "topics" && e.tagModus === "and" && e.topics.length > 1 ? "and" : "or"; }
    function umfangParameter(e) {
      if (e.modus === "all") return { p_scope_mode: "all" };
      var o = { p_scope_mode: "topics", p_tag_ids: e.topics.slice() };
      /* Nur bei "And": "Or" ist das, was die Datenbank ohne den Parameter tut, und so bleibt jeder
         Aufruf mit "Or" gueltig, auch solange sie p_tagmode noch nicht kennt (wie p_cover). */
      if (tagModusWirkt(e) === "and") o.p_tagmode = "and";
      return o;
    }
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
        for (var i = 0; i < bs.length; i++) {
          var an = bs[i].getAttribute("data-modus") === p.e.modus;
          bs[i].classList.toggle("is-active", an); bs[i].setAttribute("aria-pressed", String(an));
        }
        if (UC.segJetzt) {
          try { UC.segJetzt(seg); } catch (e) {}
          /* Der Streifen misst nur, was sichtbar ist. Steht der Schritt gerade erst auf (das Popup
             blendet noch ein, ein Neuaufbau der Seite dahinter), kann das erste Messen ins Leere
             gehen -- der Streifen bliebe weg, bis etwas anderes ihn anstoesst. Darum ein zweites
             Mal, nachdem die Bewegung steht. */
          setTimeout(function () { if (popup === p && seg.isConnected) { try { UC.segJetzt(seg); } catch (e2) {} } }, 320);
        }
      }
      klappen(im(".uev-umfang-klapp"), p.e.modus === "topics");
      zahlZeigen();
    }
    /* ---- DIE SUCHE AM FELD (17.10., Nutzer: "mit einem Dropdown zur Suche ... mach wie die anderen
       Tools") ------------------------------------------------------------------------------------
       KEIN neuer Umschalter: die Wahl der Art in Schritt 3 (Specific URLs, Path, Domain) bestimmt,
       WAS gesucht wird. Domain (host und host_all) sucht Domains (quick_search_v1, scope domain), URL
       sucht URLs (scope url), Pfad sucht URLs und fasst die Treffer zu ihren Ordnern zusammen -- ein
       Pfad-Ziel ist ein Ordner, kein Dokument. Die Maschine ist dieselbe wie in Palette und Mira
       (UC.makeEntitySearch, Zeilen UC.entityRow); ab zwei Zeichen, ein Eintrag im Feld.
       Das Dropdown steht in der Spalte des Feldes direkt darunter: oben die Zeile "Add ..." mit dem
       erkannten Umfang rechts (Enter fuegt hinzu), darunter die Treffer. Bei null Treffern bleibt
       es still bei der Zeile "Add ..."; kein Ladebalken, keine "No results"-Wand.
       Die Treffer tragen EINE Gruppe (je Art ein Bereich), also gibt es keine Ueberschriften. */
    function sucheBereich(e) { var a = leseArt(e); return a === "url" || a === "path" ? "url" : "domain"; }
    /* Was gesucht wird: die Eingabe WIE GETIPPT. Seit dem 18.10. findet quick_search_v1 auch Eingaben mit www.,
       Schema und Umlaut-Label (www.adac.de: 0 auf 5 Treffer), die Normalisierung macht die Datenbank in einer
       Hand -- die Oberflaeche schneidet vorher nichts mehr ab (sonst gaebe es zwei Regeln fuer dieselbe
       Eingabe). Nur was gar keine Adresse ergibt, sucht nichts. Mehrere Eintraege und eine Sitemap suchen nichts. */
    function sucheFrage(e) {
      var tl = eingabeTeile(e.eingabe);
      if (tl.length !== 1 || artVorschlag(e.eingabe) === "sitemap") return "";
      var a = leseArt(e), z = zerlegen(tl[0]);
      if (!z) return a === "url" ? tl[0] : "";
      return tl[0];
    }
    /* Die Suche neu anstossen, auch nach einem Wechsel der Art (anderer Bereich, gleiche Eingabe).
       Alte Treffer fallen sofort weg: sie gehoeren zur anderen Art. */
    function sucheStarten(p) {
      var q = sucheFrage(p.e), fuer = sucheBereich(p.e) + "|" + q;
      p.such.frage = q; p.such.zu = false; p.such.aktiv = -1;
      if (p.such.fuer !== fuer && p.such.fuerBereich !== sucheBereich(p.e)) { p.such.treffer = null; p.such.fehler = ""; }
      p.such.fuer = fuer; p.such.fuerBereich = sucheBereich(p.e);
      if (p.maschine) p.maschine.tippen(q);
    }
    /* Die Zeilen des Dropdowns: { item, text, art, rechts } -- text geht an zielBauen, art ist die
       Art des Ziels. */
    function sucheZeilen(p) {
      var art = leseArt(p.e), raw = p.such.treffer || [], aus = [];
      if (art === "host" || art === "host_all") {
        raw.forEach(function (it) { if (it && it.type === "domain" && it.domain) aus.push({ item: it, text: String(it.domain), art: art, rechts: "" }); });
      } else if (art === "url") {
        raw.forEach(function (it) { if (it && it.type === "url" && it.url) aus.push({ item: it, text: String(it.url), art: "url", rechts: "" }); });
      } else {
        /* Pfad: je URL der Ordner davor (alles bis auf das letzte Stueck), je Ordner einmal, die
           haeufigsten zuerst. Eine URL direkt unter der Domain hat keinen Ordner. Keine Zahl dahinter:
           die Antwort ist begrenzt, eine Zaehlung daraus waere irrefuehrend. */
        var je = {}, reihe = [];
        raw.forEach(function (it) {
          if (!it || it.type !== "url" || !it.url) return;
          var z = zerlegen(it.url);
          if (!z) return;
          var teile = z.pfad.split("/").filter(Boolean);
          if (teile.length < 2) return;
          var ordner = z.anzeige + "/" + teile.slice(0, -1).join("/");
          if (!je[ordner]) { je[ordner] = { n: 0, host: z.host }; reihe.push(ordner); }
          je[ordner].n++;
        });
        reihe.sort(function (a, b) { return je[b].n - je[a].n; }).forEach(function (o) {
          aus.push({ item: { type: "domain", domain: o, favicon: zielFavUrl(je[o].host) }, text: o, art: "path",
            rechts: "" });
        });
      }
      return aus;
    }
    function zeilenKnoepfe() {
      var el = im(".uev-urltreffer");
      return el ? [].slice.call(el.querySelectorAll("[data-neu-url], [data-ziel-text]")) : [];
    }
    function trefferAktiv(p, i) {
      var l = zeilenKnoepfe();
      p.such.aktiv = Math.max(-1, Math.min(l.length - 1, i));
      l.forEach(function (b, k) { b.classList.toggle("is-active", k === p.such.aktiv); b.setAttribute("aria-selected", String(k === p.such.aktiv)); });
      var a = l[p.such.aktiv];
      var inp = im(".uev-zielein");
      if (inp) { if (a) inp.setAttribute("aria-activedescendant", a.id); else inp.removeAttribute("aria-activedescendant"); }
      try { if (a) a.scrollIntoView({ block: "nearest" }); } catch (e) {}
    }
    /* "Add {ziel}" mit gekuerztem Ziel: Verb und Ziel stehen in eigenen Teilen, damit bei wenig Platz
       (375 breit, lange URL) das Ziel mit "..." endet und das Verb bleibt -- im Deutschen steht es
       hinter dem Ziel ("{ziel} hinzufuegen"). */
    function addSatz(ziel) {
      var tl = t("Add {ziel}").split("{ziel}");
      return '<span class="uev-neuziel-teil">' + esc(tl[0] || "") + '</span><span class="uev-neuziel-ziel">' + esc(ziel) + '</span><span class="uev-neuziel-teil">' + esc(tl[1] || "") + '</span>';
    }
    function trefferZeigen() {
      var p = popup, el = im(".uev-urltreffer");
      if (!el) return;
      var s = p.such, q = String(s.frage || "").trim(), html = "";
      var kl = el.closest(".uev-klapp");
      var art = leseArt(p.e), inp = im(".uev-zielein");
      /* Beim Zuklappen bleibt der Inhalt stehen, bis der Behaelter zu ist -- sonst faellt die Hoehe
         sofort auf 0 und es gibt nichts zu animieren. */
      if (!q || q.length < 2 || s.zu || p.e.zielArt === "marke" || eingabeTeile(p.e.eingabe).length !== 1) {
        klappen(kl, false);
        if (inp) { inp.setAttribute("aria-expanded", "false"); inp.removeAttribute("aria-activedescendant"); }
        return;
      }
      var voll = !zielFrei(p);
      var zeilen = sucheZeilen(p);
      function zustand(text, kind) {
        var z = zielBauen(text, kind);
        if (!z.fehler && zielImEvent(p, z)) return { txt: t("Already in this event"), klasse: "is-taken" };
        if (!z.fehler && zielGewaehlt(p, z)) return { txt: t("Added"), klasse: "is-taken" };
        return { txt: "", klasse: voll ? "is-taken" : "" };
      }
      /* Ganz oben, was eingegeben ist -- mit dem erkannten Umfang rechts: dasselbe wie "Add" neben
         dem Feld, an der Stelle, an der man nach dem Tippen hinsieht (wie "Create ..." im Command
         Menu). Nur fuer eine Eingabe, die ein Ziel dieser Art ergibt. */
      var tipp = eingabeTeile(p.e.eingabe)[0], neuZ = zielLesen(tipp, art), idn = "uev-tr-" + instanceId + "-";
      var zeile = 0;
      if (!neuZ.fehler && (art === "url" || /\./.test(q))) {
        var zn = zustand(neuZ.input, neuZ.kind);
        html += '<button type="button" id="' + idn + (zeile++) + '" role="option" aria-label="' + esc(ersetze(t("Add {ziel}"), { ziel: tipp })) + '" class="up-es-row uev-neuziel' + (zn.klasse ? " " + zn.klasse : "") + '" data-neu-url="' + esc(tipp) + '">' +
          /* Das Favicon der getippten Domain; scheitert es, das "+". */
          zielKachel(neuZ, UC.icon("plus", 2)) +
          '<span class="up-es-main"><span class="up-es-primary">' + addSatz(tipp) + '</span></span>' +
          '<span class="up-es-type">' + esc(zn.txt || t(ART_NAME[neuZ.kind])) + '</span></button>';
      }
      /* Treffer, die genau das Eingegebene sind, nicht doppelt: die Zeile "Add" ist schon diese. */
      var vorhanden = zeilen.filter(function (zl) { var z2 = zielBauen(zl.text, zl.art); return neuZ.fehler || z2.fehler || z2.key !== neuZ.key; });
      if (s.fehler && !vorhanden.length) {
        html += '<p class="up-modal-hinweis uev-urlnote">' + esc(s.fehler) + '</p>';
      } else {
        s.zeilen = vorhanden;
        html += vorhanden.map(function (zl, zi) {
          var z = zustand(zl.text, zl.art), it = zl.item;
          /* Bringt die Suche kein Favicon mit, holt es die Zeile wie jedes Ziel ueber Google S2. */
          var mitBild = it;
          if (it && !it.favicon && (it.url || it.domain)) { mitBild = {}; for (var kk in it) mitBild[kk] = it[kk]; mitBild.favicon = zielFavUrl(it.url || it.domain); }
          return UC.entityRow(mitBild, { prefix: "up-es", query: q, index: zi, rechts: z.txt || zl.rechts, typLabel: false, klasse: z.klasse })
            .replace(/^<button/, '<button id="' + idn + (zeile++) + '" data-ziel-text="' + esc(zl.text) + '" data-ziel-art="' + esc(zl.art) + '"');
        }).join("");
      }
      /* Ist die Antwort voll (so viele Treffer wie das Limit), gibt es vermutlich mehr: eine ruhige Zeile
         statt Scrollen oder "Mehr laden". */
      if (!s.fehler && (s.treffer || []).length >= SUCHE_LIMIT) html += '<p class="uev-urlnote uev-urlmehr">' + esc(t("Keep typing to narrow it down")) + '</p>';
      if (html) el.innerHTML = html;
      klappen(kl, !!html);
      if (inp) inp.setAttribute("aria-expanded", String(!!html));
      if (s.aktiv != null && s.aktiv >= 0) trefferAktiv(p, s.aktiv);
    }
    /* DIE VORSCHAU (03.10. angefordert): im letzten Schritt die Karte, wie sie danach in der
       Uebersicht steht -- dieselbe karteHtml, gefuellt aus dem Entwurf, ohne Menue und ohne Klick.
       Sie ersetzt die Zusammenfassung: alles, was dort stand, steht auf der Karte. Seit 15.10. mit
       den Zielen (die Karte zaehlt sie nach Art) und der Liste der Ziele darueber. */
    function pruefenZeigen() {
      var p = popup, el = im(".uev-pruef");
      if (!el || p.art !== "anlegen") return;
      var e = p.e, v = dieVorschau(p), mit = e.zielArt && e.zielArt !== "marke" ? e.ziele : [];
      var ev = { id: "", kind: e.art === "watch" ? "watch" : "event", name: e.name.trim() || t("Untitled event"), event_date: e.datum, event_type: e.typ,
        icon: e.icon, color: e.farbe, cover: e.cover, description: e.text.trim() || null, scope_mode: e.modus,
        selected_topic_count: e.modus === "topics" ? e.topics.length : null,
        affected_prompt_count: v && !v.fehler ? v.n : null,
        affected_url_count: mit.filter(function (z) { return z.kind === "url"; }).length,
        /* host: das Favicon des Avatars (Citation Tracking, genau eine Domain) steht schon in der Vorschau, nicht erst nach dem Anlegen. */
        targets: mit.map(function (z) { return { kind: z.kind, host: zielHost(z) }; }) };
      /* Eine Kampagne zeigt in der Vorschau ihren Zeitraum und ihren Stand, wie die Karte danach
         (Audit EV-05: nur der Starttag stand da). Der Stand nur mit v4 -- sonst kennt die Karte
         keinen Status. Tag x von y rechnet statusInfo aus den Daten, solange kein day_number da ist. */
      if (kampagneDa()) {
        ev.end_date = e.ende || null;
        ev.status = e.datum > heuteIso() ? "planned" : "running";
      }
      el.innerHTML = '<span class="up-topicmodal-label">' + esc(t("Preview")) + '</span>' +
        '<div class="uev-vorschau">' + karteHtml(ev, true) + coverKnopfHtml(p) + '</div>';
      pruefZieleZeigen();
    }
    /* Schritt 3 ist bereit: eine Art ist gewaehlt, und ausser bei "Brand metrics only" steht ein
       Ziel in der Liste oder eine gueltige Eingabe im Feld (die "Continue" dann uebernimmt). */
    function zieleOk(p) {
      var e = p.e;
      if (p.art === "anlegen") {
        if (!e.zielArt) return false;
        if (e.zielArt === "marke") return true;
      }
      /* Regeln in der Liste, aber die Datenbank kann sie (noch) nicht: nicht weiter -- sonst
         gingen sie beim Anlegen still verloren. Die Liste sagt es an jeder Regel. */
      if (!zieleDa() && e.ziele.some(function (z) { return z.kind !== "url"; })) return false;
      if (e.ziele.length) return true;
      var r = eingabeLesen(p);
      return r.gut.length > 0 && r.vorschlag !== "sitemap" && r.gut.length <= zielFrei(p);
    }
    function schrittOk(p) {
      var e = p.e;
      if (p.art === "ziel") return zieleOk(p);
      if (p.art === "bearbeiten") return !!e.name.trim() && laenge(e.text.trim()) <= TEXT_MAX;
      if (p.schritt === 1 && e.art === "watch") return !!e.name.trim() && laenge(e.text.trim()) <= TEXT_MAX;
      if (p.schritt === 1) return !!e.name.trim() && !!e.datum && (!e.bereich || !!e.ende) && !!e.typ && laenge(e.text.trim()) <= TEXT_MAX;
      if (p.schritt === 2) {
        if (e.modus === "topics" && !e.topics.length) return false;
        var v = dieVorschau(p);
        /* Waehrend gezaehlt wird, wartet der Knopf; konnte nicht gezaehlt werden, darf es weiter
           -- der Server prueft beim Anlegen selbst (impact_event_no_active_prompts). */
        if (p.vorschauLaeuft || !v) return false;
        return v.fehler || v.n !== 0;
      }
      if (p.schritt === 3) return zieleOk(p);
      if (p.schritt === 4 && e.art === "watch") return !!e.name.trim() && laenge(e.text.trim()) <= TEXT_MAX;
      return true;
    }
    function knoepfeSync() {
      var p = popup;
      if (!p || p.warte) return;
      var b = p.api.knopf(p.knopf);
      if (b) b.disabled = !schrittOk(p);
      if (p.art === "anlegen") {
        var z = p.api.knopf("zurueck");
        if (z) z.hidden = p.schritt === reiheVon(p)[0];
        /* "Create without URLs?" (03.10.) ist seit 15.10. die ausdrueckliche Wahl "Brand metrics
           only" in Schritt 3 -- ein Event ohne Ziele entsteht nie mehr aus Versehen. */
        var lbl = p.schritt === 4 ? (p.planEventId ? "Save" : p.e.art === "watch" ? "Create" : "Create event") : "Continue", tx = b && b.querySelector(".up-modal-knopftxt");
        if (tx) { tx.textContent = t(lbl); tx.setAttribute("data-i18n", lbl); }
      }
      if (anleitung && anleitung.laeuft()) anleitung.neu();
    }
    function schritt(n, fehlerBehalten) {
      var p = popup;
      if (!p || n < 1 || n > 4) return;
      p.schritt = n;
      if (!fehlerBehalten) p.api.fehler("");
      var st = p.api.body.querySelectorAll(".uev-schritt");
      for (var i = 0; i < st.length; i++) st[i].hidden = parseInt(st[i].getAttribute("data-schritt"), 10) !== n;
      /* Schritt 2 bis 4 entstehen erst, wenn sie gezeigt werden: der Topics-Filter baut sich nur
         in einer sichtbaren Wurzel (makeMount), und in einem verdeckten Schritt stuende er erst
         nach dem naechsten Blick des Waechters da. */
      var box = p.api.body.querySelector('.uev-schritt[data-schritt="' + n + '"]');
      /* Vor dem Bau: die Kacheln zeigen das gewuerfelte Bild schon als gewaehlt. */
      /* Citation Tracking (20.10.): der Name steht im letzten Schritt und ist mit der Domain des ersten Ziels vorbelegt, solange niemand
         selbst einen getippt hat. */
      if (n === 4 && p.e.art === "watch" && !p.nameVonHand && p.e.zielArt && p.e.zielArt !== "marke") {
        var h0 = p.e.ziele.length ? String(zielHost(p.e.ziele[0]) || "").replace(/^www\./, "") : "";
        if (h0) p.e.name = h0;
      }
      if (n === 4) coverZufall(p);
      if (box && !box.__uevGebaut) {
        box.__uevGebaut = 1;
        if (n === 2) { box.innerHTML = umfangFelder(p.e); topicsZeigen(); }
        if (n === 3) box.innerHTML = zielFelder(p);
        if (n === 4) box.innerHTML = pruefFelder(p.e);
      }
      /* Der Satz unter der Vorschau folgt dem Datum, auch wenn der Schritt schon einmal gebaut war. */
      if (n === 4 && box && p.e.art !== "watch") { var gs = box.querySelector(".uev-gesperrt > span:last-child"); if (gs) gs.textContent = t(startSatz(p.e)); }
      var sub = p.api.el.querySelector(".up-topicmodal-sub");
      if (sub) sub.textContent = schrittText(n);
      if (n === 2) { umfangNeu(); vorschauAnfordern(); }
      if (n === 3) {
        zieleZeigen(p, true);
        /* Der Fokus dorthin, wo die naechste Handlung ist: ins Feld -- es ist seit dem 15.10. spaet
           der erste und wichtigste Teil des Schritts --, nur bei "Brand metrics only" auf die Wahl. */
        setTimeout(function () {
          var f = p.e.zielArt !== "marke" ? im(".uev-zielein") : im('.uev-art[tabindex="0"]');
          try { if (f) f.focus(); } catch (e) {}
        }, 30);
      }
      if (n === 4) pruefenZeigen();
      if (n === 4 && p.e.art === "watch") { var nm4 = im('[data-feld="name"]'); if (nm4 && nm4.value !== p.e.name) { nm4.value = p.e.name; pruefenZeigen(); } setTimeout(function () { try { if (nm4 && popup === p) { nm4.focus({ preventScroll: true }); nm4.select(); } } catch (e) {} }, 30); }
      if (n === 1) { var nm = im('[data-feld="name"]'); setTimeout(function () { try { if (nm) nm.focus(); } catch (e) {} }, 30); }
      try { p.api.karte.scrollTop = 0; } catch (e) {}
      knoepfeSync();
      anleitungFolgen();
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
        rufen("uevScopePreview", umfangParameter(e), { popup: p });
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
    var SUCHE_LIMIT = 8;
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
        prefix: "uev", limit: SUCHE_LIMIT,
        filters: function () { return { scope: popup === p ? sucheBereich(p.e) : "url" }; },
        onLoading: function () { if (popup !== p) return; p.such.laedt = true; p.such.fehler = ""; },
        /* Eine Antwort auf eine andere Frage (weitergetippt waehrend der Anfrage) wird nicht gezeigt;
           eine fuer den anderen Bereich (Art gewechselt) faengt sucheZeilen am Typ der Treffer ab. */
        onResults: function (items, meta) {
          if (popup !== p) return;
          if (meta && String(meta.query || "") !== String(p.such.frage || "")) return;
          p.such.laedt = false; p.such.treffer = items || []; trefferZeigen();
        },
        onError: function () {
          if (popup !== p) return;
          p.such.laedt = false; p.such.treffer = null;
          p.such.fehler = t("Search is not available right now. You can still paste a full link.");
          trefferZeigen();
        },
        onIdle: function () { if (popup !== p) return; p.such.laedt = false; p.such.treffer = null; p.such.fehler = ""; trefferZeigen(); }
      });
    }
    /* Ein Treffer der Suche (oder die Zeile "Add ...") als Ziel der Art, in der gesucht wurde. */
    function zielNehmen(text, art) {
      var p = popup;
      if (!p || !text) return;
      var z = zielLesen(text, art || "url");
      /* Nur http(s), hoechstens 2048 Zeichen (13.10., wie der Server: impact_event_invalid_url) --
         die Meldung am Feld, statt erst beim Anlegen. */
      if (z.fehler || (z.kind === "url" && !urlOk(z.input))) { feldFehler("ziele", z.fehler === "pfad" ? t("Please add a path, e.g. example.com/blog.") : fehlerText("impact_event_invalid_url")); return; }
      if (zielGewaehlt(p, z) || zielImEvent(p, z)) return;
      if (!zielFrei(p)) { feldFehler("ziele", zuVielText(p)); return; }
      p.e.ziele.push(z);
      artNachZiel(p, z);
      p.e.eingabe = "";
      var inp = im(".uev-zielein");
      if (inp) { inp.value = ""; feldHoehe(inp); }
      p.such.frage = ""; p.such.treffer = null; p.such.laedt = false; p.such.fehler = ""; p.such.fuer = ""; p.such.aktiv = -1;
      if (p.maschine) p.maschine.abbrechen();
      try { if (inp) inp.focus(); } catch (e) {}
      feldFehler("ziele", "");
      p.api.fehler("");
      zieleZeigen(p);
    }
    function urlNehmen(url) { zielNehmen(url, "url"); }
    /* Eine Eingabe von aussen ins Feld legen und so behandeln, als waere sie getippt (Art, Schalter,
       Suche, Vorschau folgen ihr). */
    function eingabeSetzen(p, text) {
      var inp = im(".uev-zielein");
      if (!p || !inp) return;
      p.e.unterVonHand = false;
      if (!p.e.unterdomains) unterdomainsUmschalten(p);
      inp.value = text;
      inp.dispatchEvent(new Event("input", { bubbles: true }));
      try { inp.focus(); } catch (e) {}
    }
    /* DIE EIGENE DOMAIN ALS EIN KLICK (17.10.): bei leerem Feld steht "Your domain: <domain>" da,
       aus den Marken der Seite (Rolle own, Feld domain) -- ohne Abruf beim Oeffnen. Ein Klick legt
       sie als Domain mit allen Subdomains an (oder nur als Host, wenn der Schalter aus ist). */
    function eigeneDomain() {
      var l = UC.getBrands ? UC.getBrands() : [];
      for (var i = 0; i < l.length; i++) {
        var b = l[i];
        if (!b || b.role !== "own" || !b.domain) continue;
        var z = zerlegen(String(b.domain));
        if (z && hostOk(z.host)) return z.anzeige;
      }
      return "";
    }
    function eigeneDomainNehmen(p, domain) {
      if (!p || !domain) return;
      if (p.e.zielArt !== "host") artWaehlen(p, "host", false);
      zielNehmen(domain, p.e.unterdomains ? "host_all" : "host");
    }

    /* ---- Senden und Antworten -------------------------------------------------------------- */
    function warten(p, art) {
      p.warte = art;
      p.api.fehler("");
      feldFehlerWeg();
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
    /* Vor dem Senden (13.10.): dieselben Regeln wie die Datenbank (paramsPruefen). Bricht ein
       Parameter sie, steht die Meldung am Feld, und nichts geht hinaus. Durch die Bedienung kann
       das kaum entstehen (Laengen begrenzt, Typ als Schluessel, Zeichen und Farbe aus Listen) --
       die Probe ist das Netz fuer das, was aus aelteren Daten kommt. */
    function vorabPruefen(p, b) {
      var h = paramsPruefen(b);
      if (!h) return true;
      feldFehlerZeigen(p, "impact_event_invalid_param", h, fehlerText("impact_event_invalid_param", h));
      knoepfeSync();
      return false;
    }
    function anlegenSenden() {
      var p = popup;
      /* Doppelklick: der Knopf ist busy, und ohne laufende Antwort geht nichts zweimal hinaus. */
      if (!p || p.warte) return;
      var e = p.e;
      /* Citation Tracking (19.10.): eigene Funktion, nur Name, Beschreibung und Ziele -- keine Prompts-Wahl, kein Datum. */
      if (e.art === "watch") {
        var wb = { p_name: e.name.trim(), p_description: e.text.trim() || null };
        if (e.cover) wb.p_cover = e.cover;
        var wmit = e.zielArt && e.zielArt !== "marke" ? e.ziele : [];
        p.zielFehler = null; p.gesendet = wmit.slice();
        wb.p_targets = wmit.map(zielKoerper);
        if (!vorabPruefen(p, wb)) return;
        warten(p, "anlegen");
        rufen("uevCreateWatch", wb, { popup: p });
        return;
      }
      var b = {
        p_name: e.name.trim(), p_event_date: e.datum, p_scope_mode: e.modus,
        p_tag_ids: e.modus === "topics" ? e.topics.slice() : null,
        p_urls: null,
        p_description: e.text.trim() || null, p_event_type: e.typ,
        p_icon: e.icon ? iconFuerDb(e.icon) : null, p_color: e.farbe ? String(e.farbe).toLowerCase() : null
      };
      /* p_cover NUR, wenn ein Titelbild gewaehlt ist (04.10.): PostgREST lehnt einen Aufruf mit
         einem Parameter ab, den die Funktion nicht kennt -- und solange die Datenbank p_cover noch
         nicht fuehrt, haette sonst JEDES Anlegen gescheitert, auch ohne Titelbild. */
      if (e.cover) b.p_cover = e.cover;
      if (tagModusWirkt(e) === "and") b.p_tagmode = "and";
      /* DIE ZIELE (15.10.): mit Zielen in der Datenbank als p_targets an create_impact_event_v3
         (auch URLs, als kind "url" -- die Datenbank macht daraus dieselben Ziele wie aus p_urls),
         sonst wie bisher als p_urls an v2. "Brand metrics only" schickt keines von beiden, auch
         wenn vorher Ziele eingetragen waren -- es gilt, was gewaehlt ist. */
      var mit = e.zielArt && e.zielArt !== "marke" ? e.ziele : [];
      /* p.gesendet: dieselbe Reihenfolge wie p_targets bzw. p_urls -- der hint eines Fehlers
         ("p_targets[i]: ...") zeigt so auf das Ziel in der Liste. */
      p.zielFehler = null; p.gesendet = null;
      if (mit.length && zieleDa()) { delete b.p_urls; b.p_targets = mit.map(zielKoerper); p.gesendet = mit.slice(); }
      else if (mit.length) { p.gesendet = mit.filter(function (z) { return z.kind === "url"; }); b.p_urls = p.gesendet.map(function (z) { return z.input; }); }
      /* Der Zeitraum (17.10.): p_end_date an create_impact_event_v4 -- ohne Ende steht der
         Parameter gar nicht im Body, v4 setzt null (Vertrag B.3). */
      if (kampagneDa() && e.bereich && e.ende) b.p_end_date = e.ende;
      /* p_notify NUR an create_impact_event_v4 (Teil B/A): v3 kennt den Parameter nicht, und
         PostgREST lehnt einen unbekannten mit PGRST202 ab -- das Anlegen schluege fehl. Mit v3
         geht ein "aus" nach dem Anlegen ueber set_impact_event_notify_v1 (popupDetailKam).
         v4 geht ueber KAMPAGNE_FN, sobald kampagneDa() (rufen) -- KANAL.uevCreate.fn bleibt v3. */
      p.notifyGesendet = false;
      if (meldDa() && !p.planEventId && (kampagneDa() || /_v4$/.test(String(KANAL.uevCreate.fn)))) { b.p_notify = e.notify !== false; p.notifyGesendet = true; }
      if (!vorabPruefen(p, b)) return;
      /* Ein GEPLANTES Event bearbeiten (17.10.): derselbe Assistent, derselbe Body, dazu die
         Kennung -- an update_impact_event_v3 (Vertrag B.3: Umfangs-Parameter wie create v4).
         p_targets ist die VOLLE neue Liste (auch leer = "Brand metrics only"), nicht ein Zusatz.
         Aus einer Kampagne wird ein Tag: p_clear_end_date (Vertrag B.3 nennt ihn als Option;
         Rueckfrage an den DB-Chat, ob er fuer planned kommt). */
      if (p.planEventId) {
        b.p_event_id = p.planEventId;
        delete b.p_urls;
        /* Im Bearbeiten heisst null "unveraendert" (Vertrag 3.5) -- hier steht der volle Stand,
           also "" fuer geleert (Beschreibung, Zeichen, Farbe, Titelbild). */
        b.p_description = e.text.trim(); b.p_icon = e.icon ? iconFuerDb(e.icon) : ""; b.p_color = e.farbe ? String(e.farbe).toLowerCase() : "";
        b.p_cover = e.cover || "";
        b.p_targets = mit.map(zielKoerper);
        p.gesendet = mit.slice();
        /* Der volle Stand auch beim Verknuepfen der Topics: null heisst dort "unveraendert", und
           ein von "And" auf "Or" gestelltes Event bliebe mit dem Weglassen auf "And" (gemessen am
           Quelltext von update_impact_event_v3: v_mode = e.tag_mode bei null). */
        b.p_tagmode = tagModusWirkt(e);
        /* Aus Zeitraum wird Einzeltag: p_clear_end_date, NIE zusammen mit p_end_date (die Datenbank
           antwortet sonst impact_event_invalid_param, hint p_clear_end_date). */
        if (!(e.bereich && e.ende) && p.alt && p.alt.ende) { b.p_clear_end_date = true; delete b.p_end_date; }
        warten(p, "bearbeiten");
        rufen("uevUpdate", b, { popup: p });
        return;
      }
      warten(p, "anlegen");
      rufen("uevCreate", b, { popup: p });
    }
    /* Vertrag 3.5: null heisst unveraendert, "" leert (Beschreibung, Zeichen, Farbe). Ein leerer
       Name ist nicht erlaubt -- der Knopf ist dann gar nicht erst frei. */
    function speichern() {
      var p = popup;
      if (!p || p.warte) return;
      var e = p.e, a = p.alt;
      var name = e.name.trim(), text = e.text.trim();
      var b = {
        p_event_id: p.eventId,
        p_name: name !== a.name.trim() ? name : null,
        p_description: text !== a.text.trim() ? text : null,
        p_event_type: e.typ !== a.typ ? e.typ : null,
        p_icon: e.icon !== a.icon ? (e.icon ? iconFuerDb(e.icon) : "") : null,
        p_color: e.farbe !== a.farbe ? (e.farbe ? String(e.farbe).toLowerCase() : "") : null
      };
      /* Wie Zeichen und Farbe (Vertrag 3.5): "" nimmt das Titelbild ab. Unveraendert steht p_cover
         gar nicht im Body -- aus demselben Grund wie beim Anlegen (unbekannter Parameter). */
      if (e.cover !== a.cover) b.p_cover = e.cover || "";
      /* Das Ende einer laufenden Kampagne (17.10.) nur, wenn es sich geaendert hat -- dann an
         update_impact_event_v3; p.endeGesendet sagt dem Fehler, dass forbidden das Ende meint. */
      p.endeGesendet = !!(e.ende && e.ende !== a.ende);
      if (p.endeGesendet) b.p_end_date = e.ende;
      if (b.p_name == null && b.p_description == null && b.p_event_type == null && b.p_icon == null && b.p_color == null && !("p_cover" in b) && !p.endeGesendet) { p.api.schliessen(); return; }
      if (!vorabPruefen(p, b)) return;
      warten(p, "bearbeiten");
      rufen("uevUpdate", b, { popup: p });
    }
    /* Der Add-Dialog (15.10.): alle auf einmal ueber add_impact_event_target_v1 (auch eine Auswahl
       aus der Sitemap). Seit 17.10. auch dann, wenn die Regel-Ziele (noch) nicht angeboten werden:
       eine URL ist dort ein url-Ziel, add_impact_event_url_v2 braucht die App nicht mehr. Nur der
       Klick-Dummy geht den alten Weg (genau eine URL, uevAddUrl). Was noch im Feld steht, kommt
       vorher dazu. */
    function zielSenden() {
      var p = popup;
      if (!p || p.warte) return;
      if (String(p.e.eingabe || "").trim() && !eingabeUebernehmen(p)) return;
      if (!p.e.ziele.length) return;
      var d = state.detail[p.eventId];
      if (!demo) {
        var schon = d && isArr(d.targets) ? d.targets.length : 0;
        if (schon + p.e.ziele.length > ZIEL_MAX) { feldFehlerZeigen(p, "impact_event_too_many_targets", "", fehlerText("impact_event_too_many_targets")); return; }
        p.zielFehler = null; p.gesendet = p.e.ziele.slice();
        warten(p, "ziel");
        rufen("uevAddTarget", { p_event_id: p.eventId, p_targets: p.e.ziele.map(zielKoerper) }, { popup: p });
        return;
      }
      /* 100 URLs je Event (409 impact_event_too_many_urls) -- das Detail kennt die Zahl schon. */
      if (d && isArr(d.urls) && d.urls.length >= URL_MAX) {
        feldFehlerZeigen(p, "impact_event_too_many_urls", "", fehlerText("impact_event_too_many_urls"));
        return;
      }
      var b = { p_event_id: p.eventId, p_url: p.e.ziele[0].input };
      if (!vorabPruefen(p, b)) return;
      warten(p, "url");
      rufen("uevAddUrl", b, { popup: p });
    }
    /* Nach jeder gelungenen Aenderung: Bubble laedt die Liste neu (upEventsChanged, 04.10.) --
       Uebersicht und Pins zeigen sonst Name, Farbe, Titelbild und URL-Zahl von vorher. Im
       Klick-Dummy nicht: dort fuellt events-demo.js die Liste selbst, und eine echte Liste wuerde
       die Beispiele ersetzen. */
    function listeNeu() {
      if (demo || !UC.eventsChanged) return;
      try { UC.eventsChanged(); } catch (e) {}
    }
    function listenStand() {
      try { return (UC.eventsStand && UC.eventsStand()) || {}; } catch (e) { return {}; }
    }
    function geloeschtFertig(id, listeFrisch) {
      state.geloescht[id] = 1;
      /* Sofort, nicht erst mit der naechsten Liste (die Leiste gleicht sonst selbst ab). */
      eventAbheften(id);
      delete state.detail[id];
      persist();
      if (wartend.del) { var api2 = wartend.del.api; clearTimeout(wartend.del.uhr); wartend.del = null; api2.schliessen(); }
      if (!listeFrisch) listeNeu();
      if (state.ansicht === "detail" && state.eventId === id) zurUebersicht(true); else renderListe();
    }
    /* Loeschen oder URL entfernen ist gescheitert (13.10.): die Bestaetigung geht zu, der Grund
       steht als Toast -- dort hat sie kein Feld, an dem er stehen koennte, und die Frage "wirklich
       loeschen?" ist beantwortet. Bis 13.10. blieb sie offen mit dem Satz darin. */
    function loeschFehler(txt) {
      var w = wartend.del;
      if (w) { clearTimeout(w.uhr); wartend.del = null; w.api.busy("ok", false); w.api.schliessen(); }
      if (UC.toast) UC.toast(txt || fehlerText(""), { kind: "error" });
    }
    function urlWegFehler(txt) {
      var w = wartend.urlWeg;
      if (w) { clearTimeout(w.uhr); wartend.urlWeg = null; w.api.busy("ok", false); w.api.schliessen(); }
      if (UC.toast) UC.toast(txt || fehlerText(""), { kind: "error" });
    }
    function zielWegFehler(txt) {
      var w = wartend.zielWeg;
      if (w) { clearTimeout(w.uhr); wartend.zielWeg = null; w.api.busy("ok", false); w.api.schliessen(); }
      if (UC.toast) UC.toast(txt || fehlerText(""), { kind: "error" });
    }
    /* Ist seit dem Klick schon eine neue Liste gekommen, entscheidet sie sofort; sonst wird eine
       angefordert (upEventsChanged), und das Abo unten entscheidet, wenn sie da ist. Kommt keine,
       endet das Warten an der Uhr des Dialogs. */
    function loeschPruefen() {
      var w = wartend.del;
      if (!w) return;
      var st = listenStand();
      if (st.geladen && w.seq != null && st.seq !== w.seq) { loeschEntscheiden(); return; }
      w.pruefen = true;
      listeNeu();
    }
    function loeschEntscheiden() {
      var w = wartend.del;
      if (!w) return;
      var st = listenStand();
      var noch = !!st.fehler || (UC.getEvents ? UC.getEvents() : []).some(function (e) { return String(e.id) === String(w.id); });
      if (noch) loeschFehler(); else geloeschtFertig(w.id, true);
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
      /* Die Anleitung geht im Detail weiter (Kennzahlen, Vergleich, Ziele) -- das Schliessen des
         Popups darf sie darum nicht beenden (popupZu fragt anleitungImDetail). */
      if (art === "anlegen" && anleitung && anleitung.laeuft()) anlInsDetail = true;
      p.api.schliessen();
      listeNeu();
      if (art === "anlegen") {
        /* Erst jetzt, mit der Kennung aus der Antwort, an die Leiste (Schalter in Schritt 4). Die
           Meldung nennt es mit, statt einen zweiten Toast zu zeigen. */
        var wa = p.e.art === "watch";
        /* Ein Citation Tracking hat keine Meldungen (19.10.), aber einen Pin. */
        var angeheftet = !!p.e.anheften && eventAnheften(d, true);
        if (wa) { /* nichts */ }
        else if (meldDa() && p.e.notify === false && !p.notifyGesendet && id) notifySetzen(id, false, true);
        else if (meldDa() && id) MELD_AN[String(id)] = p.e.notify !== false;
        if (UC.toast) UC.toast(t(wa ? "Citation Tracking created" : "Event created"), angeheftet ? { desc: t("Pinned to sidebar") } : undefined);
        oeffnen(id, true, false, true);
        if (anlInsDetail) setTimeout(function () { anlInsDetail = false; anleitungZeige("d1"); }, 60);
      }
      else if (UC.toast) {
        /* add_impact_event_target_v1 ueberspringt, was schon da ist, und sagt wie viele
           (skipped_duplicates, Rueckmeldung Abschnitt 3) -- das steht als zweite Zeile dabei. */
        var sd = art === "ziel" ? num(d.skipped_duplicates) : null;
        UC.toast(t(art === "url" ? "URL added" : art === "ziel" ? "Added to tracking" : "Event updated"),
          sd > 0 ? { desc: ersetze(t(sd === 1 ? "{n} target was already tracked." : "{n} targets were already tracked."), { n: zahl(sd) }) } : undefined);
      }
    }
    /* Welcher Schritt einen Fehler beheben kann -- dorthin springt das Popup, die Meldung bleibt. */
    var FEHLER_SCHRITT = {
      impact_event_name_required: 1, impact_event_invalid_date: 1, impact_event_invalid_end_date: 1, impact_event_end_date_frozen: 1,
      impact_event_topics_required: 2, impact_event_invalid_topics: 2, impact_event_no_active_prompts: 2,
      impact_event_invalid_url: 3, impact_event_too_many_urls: 3,
      impact_event_invalid_target: 3, impact_event_too_many_targets: 3, impact_event_target_duplicate: 3, impact_event_targets_unavailable: 3
    };
    /* Der Schritt des Anlegen-Popups, in dem ein Feld steht (13.10.: das Feld aus hint). */
    var FELD_SCHRITT = { name: 1, datum: 1, typ: 1, text: 1, aussehen: 1, topics: 2, ziele: 3, cover: 4 };
    /* Eine Meldung an ihr Feld: im Anlegen-Popup erst in den Schritt, der es zeigt (die Meldung
       unten bleibt dann leer), sonst direkt. Hat das Popup das Feld nicht (ein Topic-Fehler im
       Bearbeiten), steht sie in der Fehlerzeile des Popups. */
    function feldFehlerZeigen(p, code, hint, txt) {
      /* WELCHES Ziel (15.10.): "p_targets[i]: <grund>" zeigt auf den i-ten gesendeten Eintrag
         (p.gesendet, in derselben Reihenfolge wie p_targets). Der Grund steht am Ziel in der
         Liste, am Feld mit dessen Schreibweise davor. */
      var zh = code === "impact_event_invalid_target" ? zielHint(hint) : null;
      var gz = zh && p.gesendet ? p.gesendet[zh.i] : null;
      if (gz) { p.zielFehler = { key: gz.key, satz: txt }; txt = gz.zeigen + ": " + txt; }
      /* Alle schon da (impact_event_target_duplicate): bei mehreren Zielen in der Mehrzahl. */
      if (code === "impact_event_target_duplicate" && p.gesendet && p.gesendet.length > 1) txt = t("These targets are already part of the event.");
      var f = feldVonFehler(code, hint);
      var n = p.art === "anlegen" ? (FELD_SCHRITT[f] || FEHLER_SCHRITT[code] || 0) : 0;
      if (n && n !== p.schritt) schritt(n, true);
      /* Regeln gibt es nicht (create v3 fehlt): Schritt 3 bietet ab jetzt nur noch, was geht. */
      if (code === "impact_event_targets_unavailable" && f === "ziele") {
        if (p.e.zielArt && p.e.zielArt !== "url" && p.e.zielArt !== "marke") p.e.zielArt = "url";
        zieleZeigen(p, true);
      }
      if (gz) zielListeZeigen(p);
      if (f === "cover" && p.art === "anlegen") coverWahlSchalten(p, true);
      if (!feldFehler(f, txt)) p.api.fehler(txt);
    }
    function popupFehlerKam(txt, code, hint) {
      var p = popup;
      if (!p) return false;
      if (p.warte) {
        clearTimeout(p.warteUhr);
        p.warte = null;
        p.api.busy(p.knopf, false);
        /* Das Ende darf nur, wer auch loeschen darf (Vertrag B.3) -- am Feld des Endes, mit Grund. */
        if (p.endeGesendet && (code === "forbidden" || code === "impact_event_forbidden")) {
          txt = t("Only the creator of this event or a team admin can change the end date."); code = "impact_event_invalid_end_date"; hint = "";
        }
        feldFehlerZeigen(p, code, hint, txt);
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
      if (p.zv) clearTimeout(p.zv.uhr);
      if (p.sm && p.sm.lb) { try { p.sm.lb.stop(); } catch (e) {} }
      if (p.sm) clearTimeout(p.sm.sperreUhr);
      if (p.maschine) p.maschine.abbrechen();
      if (p.topicAbo) { try { p.topicAbo(); } catch (e1) {} p.topicAbo = null; }
      if (p.escAbo) { window.removeEventListener("keydown", p.escAbo, true); p.escAbo = null; }
      popup = null;
      /* Die Anleitung steht noch in einem Schritt des Popups (nicht auf dem Weg ins Detail):
         mit dem Popup ist sie zu Ende. */
      if (anleitung && anleitung.laeuft() && !anleitungImDetail()) anleitung.stop("popup");
    }
    function popupAufbauen(p) {
      popup = p;
      var el = p.api.el;
      if (UC.makeTooltips) UC.makeTooltips(el, isDark);
      el.addEventListener("click", popupKlick);
      el.addEventListener("input", popupEingabe);
      el.addEventListener("keydown", popupTaste);
      el.addEventListener("focusout", popupFokusWeg);
      if (UC.onTopics && p.art === "anlegen") p.topicAbo = UC.onTopics(function () { topicsNeu(p); }, el);
      /* Escape im Feld schliesst zuerst das Dropdown der Treffer, erst das zweite das Popup. Der
         Zuhoerer des Popups (core, Einfangphase am Dokument) laeuft vor jedem am Element, darum steht
         dieser am Fenster, noch davor. */
      p.escAbo = function (ev) {
        if (ev.key !== "Escape" || popup !== p || p.verwerfenFrage) return;
        var kl = im(".uev-treffer-klapp"), fa = document.activeElement;
        if (kl && kl.classList.contains("is-offen") && fa && fa.closest && fa.closest(".uev-feldspalte")) {
          ev.stopPropagation(); ev.preventDefault();
          p.such.zu = true; trefferZeigen();
        }
      };
      window.addEventListener("keydown", p.escAbo, true);
      /* Mit der Maus auf eine Trefferzeile: der Fokus bleibt im Feld (sonst schlosse das Verlassen
         des Feldes das Dropdown vor dem Klick). */
      el.addEventListener("mousedown", function (ev) { if (ev.target.closest && ev.target.closest(".uev-urltreffer .up-es-row")) ev.preventDefault(); });
      el.addEventListener("focusin", function (ev) {
        var x = ev.target;
        if (popup === p && x && x.matches && x.matches(".uev-zielein") && p.such.zu && String(p.e.eingabe || "").trim()) { p.such.zu = false; trefferZeigen(); }
      });
      knoepfeSync();
    }
    /* Das Namensfeld wird mit Inhalt verlassen: von hier an zeigt die Anleitung auf den Typ
       (anlW1Feld). Nur im Anlegen; einmal gesetzt, bleibt es -- ein leerer Name geht ohnehin vor. */
    function popupFokusWeg(ev) {
      var p = popup, x = ev.target;
      if (p && x && x.matches && x.matches(".uev-zielein") && !(ev.relatedTarget && ev.relatedTarget.closest && ev.relatedTarget.closest(".uev-feldspalte"))) {
        p.such.zu = true; trefferZeigen();
      }
      if (!p || p.art !== "anlegen" || p.anlNameFertig || !x || !x.matches || !x.matches('[data-feld="name"]') || !p.e.name.trim()) return;
      p.anlNameFertig = true;
      anlW1Folgen();
    }
    /* Hoechstens 200 Events je Team (409 impact_event_limit_reached, 13.10.): steht die Liste
       schon bei 200, sagt es der Knopf, bevor jemand drei Schritte ausfuellt. Entscheidend bleibt
       der Server -- die Liste kann einen Takt alt sein. */
    var EVENTS_MAX = 200;
    /* planEid (17.10.): ein GEPLANTES Event im vollen Assistenten bearbeiten -- vorbelegt aus dem
       Detail (Name, Typ, Datum bzw. Zeitraum, Umfang, Ziele, Aussehen), gespeichert ueber
       update_impact_event_v3 (anlegenSenden). Bis zum Starttag ist alles frei (Entscheidung des
       Nutzers 17.10.). */
    function planVorlage(ev) {
      var zl = (isArr(ev.targets) ? ev.targets : []).map(zielAusDb).filter(Boolean);
      var tps = (isArr(ev.topics) ? ev.topics : []).map(function (x) { return x && x.id != null ? String(x.id) : null; }).filter(Boolean);
      var kinds = zl.map(function (z) { return z.kind === "host_all" ? "host" : z.kind; });
      return { name: String(ev.name || ""), datum: String(ev.event_date || "").slice(0, 10) || heuteIso(), ende: mitEnde(ev) ? String(ev.end_date).slice(0, 10) : null,
               bereich: mitEnde(ev), wahlEnde: false, monat: null, typ: typ(ev).key, text: String(ev.description || ""),
               icon: iconAusDb(ev.icon), farbe: farbe(ev) || null, cover: coverVon(ev) ? ev.cover : null, coverEntschieden: true, offen: null,
               modus: ev.scope_mode === "all" ? "all" : "topics", topics: tps, tagModus: String(ev.tag_mode || "or").toLowerCase() === "and" ? "and" : "or",
               zielArt: zl.length ? (kinds.every(function (k) { return k === kinds[0]; }) ? kinds[0] : "url") : "marke",
               unterdomains: zl.some(function (z) { return z.kind === "host_all"; }) || !zl.some(function (z) { return z.kind === "host"; }), ziele: zl, eingabe: "", artVonHand: true };
    }
    /* ---- SCHRITT 0: DIE ART (19.10.) -------------------------------------------------------------------
       "Create" fragt zuerst, was angelegt wird: Event Tracking (Wirkung messen, mit Kontrollgruppe) oder Citation Tracking
       (Seiten beobachten). Zwei Zeilen im Format der Zielarten (.uev-art), "Continue" bleibt gesperrt, bis eine gewaehlt ist. */
    var KIND_WAHL = [
      { k: "event", ic: "cells", titel: "Track an Event", satz: "Measure the impact of Campaigns, Product Launches or other assets", invers: true },
      { k: "watch", ic: "globe", titel: "Track Citations", satz: "Keep an eye on pages and domains with realtime updates", invers: false }
    ];
    function popupArt() {
      if (popup) return;
      if (!demo && listeGeladen() && (UC.getEvents ? UC.getEvents() : []).filter(function (x) { return !state.geloescht[x.id]; }).length >= EVENTS_MAX) {
        if (UC.toast) UC.toast(fehlerText("impact_event_limit_reached"), { kind: "error" });
        return;
      }
      /* Zwei Karten nebeneinander (19.10., Vorlage des Nutzers): Bau der Karten von Vercel (Template-Karten): Text oben, darunter eine grosse Tafel, die bei 15 % von links und 55 % von oben beginnt und rechts und unten
         abgeschnitten wird, mit einer breiten Karte darin, die zu zwei Dritteln sichtbar ist. Links Event Tracking in den Farben des anderen Themas, rechts Citation Tracking. Ein Klick waehlt und geht weiter -- kein "Continue". */
      var karten = '<div class="uev-wk-raster" role="group" aria-label="' + esc(t("What do you want to create?")) + '">' + KIND_WAHL.map(function (a) {
        return '<button type="button" class="uev-wk' + (a.invers ? " is-invers" : "") + '" data-kind="' + a.k + '">' +
          '<span class="uev-wk-kopf"><span class="uev-wk-t">' + esc(t(a.titel)) + '</span><span class="uev-wk-pfeil" aria-hidden="true">' + UC.icon("arrowUpRight", 2) + '</span></span>' +
          '<span class="uev-wk-s">' + esc(t(a.satz)) + '</span>' +
          '<span class="uev-wk-tafel" aria-hidden="true"><span class="uev-wk-feld">' + UC.icon(a.ic, 1.8) + '</span></span>' +
        '</button>';
      }).join("") + '</div>';
      var api = UC.makeModal({
        titel: "Create", unter: t("What do you want to create?"), isDark: isDark,
        inhaltHtml: '<div class="uev-schritt uev-kindwahl">' + karten + '</div>',
        knoepfe: [],
        onClose: popupZu, vorSchliessen: function () { return true; }
      });
      api.karte.classList.add("uev-kind-karte");
      var p = { art: "art", api: api, e: {}, knopf: "weiter", pops: {} };
      popup = p;
      try { api.karte.style.maxWidth = "min(920px, calc(100vw - 32px))"; } catch (e) {}
      var box = api.body.querySelector(".uev-kindwahl");
      function weiter(k) {
        api.schliessen();
        setTimeout(function () { popupAnlegen(null, k); }, 0);
      }
      box.addEventListener("click", function (ev) { var b = ev.target.closest("[data-kind]"); if (b) weiter(b.getAttribute("data-kind")); });
      box.addEventListener("keydown", function (ev) {
        var b = ev.target.closest("[data-kind]");
        if (!b) return;
        var l = [].slice.call(box.querySelectorAll("[data-kind]")), i = l.indexOf(b);
        if (ev.key === "ArrowRight" || ev.key === "ArrowDown") { ev.preventDefault(); l[(i + 1) % l.length].focus(); }
        else if (ev.key === "ArrowLeft" || ev.key === "ArrowUp") { ev.preventDefault(); l[(i + l.length - 1) % l.length].focus(); }
      });
      setTimeout(function () { var f = box.querySelector("[data-kind]"); try { if (f && popup === p) f.focus(); } catch (e) {} }, 30);
      if (anleitung && anleitung.laeuft()) anleitungZeige("art");
    }
    function popupAnlegen(planEid, art) {
      if (popup) return;
      var planEv = planEid != null ? (state.detail[planEid] || listeEvent(planEid)) : null;
      if (planEid != null && !planEv) return;
      if (!planEv && !demo && listeGeladen() && (UC.getEvents ? UC.getEvents() : []).filter(function (x) { return !state.geloescht[x.id]; }).length >= EVENTS_MAX) {
        if (UC.toast) UC.toast(fehlerText("impact_event_limit_reached"), { kind: "error" });
        return;
      }
      var e = planEv ? planVorlage(planEv) : { art: art === "watch" ? "watch" : "event", name: "", datum: heuteIso(), ende: null, bereich: false, wahlEnde: false, monat: null, typ: "", text: "", icon: null, farbe: null, cover: null, offen: null,
                modus: "topics", topics: [], tagModus: "or", zielArt: null, unterdomains: true, ziele: [], eingabe: "", artVonHand: false };
      var api = UC.makeModal({
        titel: planEv ? "Edit event" : e.art === "watch" ? "Create Citation Tracking" : "Create Event Tracking", unter: schrittText(1), breit: true, isDark: isDark,
        inhaltHtml: '<div class="uev-schritt" data-schritt="1"' + (e.art === "watch" ? " hidden" : "") + '>' + (e.art === "watch" ? "" : detailFelder(e, true)) + '</div>' +
          '<div class="uev-schritt" data-schritt="2" hidden></div>' +
          '<div class="uev-schritt" data-schritt="3" hidden></div>' +
          '<div class="uev-schritt" data-schritt="4" hidden></div>',
        knoepfe: [{ id: "zurueck", text: "Back", art: "sec", aktion: function () { schritt(vor(popup, -1)); return false; } },
                  { id: "weiter", text: "Continue", art: "pri", aktion: function () { weiterImPopup(); return false; } }],
        onClose: popupZu, vorSchliessen: popupDarfZu
      });
      api.body.querySelector('.uev-schritt[data-schritt="1"]').__uevGebaut = 1;
      var p = { art: "anlegen", api: api, e: e, schritt: 1, knopf: "weiter", pops: {}, vorschauen: {}, topicSuche: "" };
      if (planEv) { p.planEventId = String(planEv.id); p.eventId = p.planEventId; p.alt = { ende: e.ende }; }
      /* Das Titelbild fuer Schritt 4 (coverZufall) jetzt schon waehlen und vorladen. */
      p.zufallsCover = coverWahl(e.art);
      coverLaden(coverVon({ cover: p.zufallsCover }));
      sucheBauen(p);
      popupAufbauen(p);
      schritt(reiheVon(p)[0]);
      if (e.art === "watch") { var wsub = api.el.querySelector(".up-topicmodal-sub"); if (wsub) wsub.textContent = schrittText(p.schritt); }
      p.start = popupStand(p);
      verfuegbarkeitHolen(function () {
        var b3 = p.api.body.querySelector('.uev-schritt[data-schritt="3"]');
        if (popup === p && b3 && b3.__uevGebaut) zieleNeuBauen(p);
      });
      /* Beim ERSTEN Anlegen laeuft die Anleitung von selbst mit (gemerkt je Nutzer), ohne den
         Fokus aus dem Namensfeld zu nehmen. */
      if (!planEv && !demo && e.art !== "watch" && !anleitungGesehen() && !(anleitung && anleitung.laeuft())) { anleitungMerken(); anleitungStarten("w1", false); }
    }
    /* "Continue" (und Next der Anleitung): im Schritt der Ziele zuerst die Eingabe uebernehmen --
       was im Feld steht, geht nicht verloren. */
    function weiterImPopup() {
      var p = popup;
      if (!p || p.art !== "anlegen") return;
      if (p.schritt === 3 && p.e.zielArt && p.e.zielArt !== "marke" && String(p.e.eingabe || "").trim() && !eingabeUebernehmen(p)) return;
      if (!schrittOk(p)) return;
      if (p.schritt < 4) { schritt(vor(p, 1)); return; }
      anlegenSenden();
    }
    /* Die Verfuegbarkeit kam, nachdem Schritt 3 schon stand: Wahl und Eingabe neu bauen, die
       Eingaben bleiben (sie stehen in p.e). */
    function zieleNeuBauen(p) {
      var ort = p.api.body.querySelector(".uev-ziel");
      if (!ort) return;
      if (p.e.zielArt && !artenFuer(p).some(function (a) { return a.k === p.e.zielArt; })) p.e.zielArt = p.art === "ziel" ? "url" : null;
      /* Seit dem 15.10. spaet ist .uev-ziel selbst die aeusserste Huelle (vier Teile, kein Feld
         drumherum) -- ersetzt wird also sie. */
      var tmp = document.createElement("div");
      tmp.innerHTML = zielFelder(p);
      if (tmp.firstChild) ort.parentNode.replaceChild(tmp.firstChild, ort);
      if (p.sm && p.sm.offen) smZeichnen(p);
      zieleZeigen(p, false);
    }
    /* Das geplante Event, dessen Assistent wartet, bis sein Detail da ist (planAssistent). */
    var planOffenNach = null;
    function popupBearbeiten(eid) {
      if (popup) return;
      var ev = state.detail[eid] || listeEvent(eid);
      if (!ev) return;
      /* Geplant (17.10.): der volle Assistent, alles aenderbar bis zum Start. */
      if (kampagneDa() && istGeplant(ev)) {
        /* Die Zeile der Uebersicht (list_impact_events_v3) kennt weder Topics noch Ziele, nur deren Zahl.
           Der Assistent aus so einer Zeile zeigte keine Ziele ("Brand metrics only") und keine Topics --
           und "Save" schickte p_targets: [] und ueberschrieb die gespeicherten (Audit 17.10., im
           Pruefstand gemessen: 3 Ziele vorher, p_targets leer im Aufruf). Darum erst das Detail lesen
           (das Event oeffnet sich, wie bei einem Klick auf die Karte), dann der Assistent. */
        if (!(state.detail[eid] && isArr(state.detail[eid].targets) && isArr(state.detail[eid].topics))) { planOffenNach = String(eid); oeffnen(eid); return; }
        popupAnlegen(eid); return;
      }
      var e = { art: istWatch(ev) ? "watch" : "event", name: String(ev.name || ""), typ: typ(ev).key, text: String(ev.description || ""),
                icon: iconAusDb(ev.icon), farbe: farbe(ev) || null, cover: coverVon(ev) ? ev.cover : null, offen: null, urls: [] };
      /* Eine laufende Kampagne: das Ende laesst sich verlaengern oder auf heute verkuerzen
         (Vertrag B.3); eine abgeschlossene nicht mehr. Ob man es darf (Ersteller, owner, admin),
         sagt erst die Datenbank -- forbidden steht dann am Feld (popupFehlerKam). */
      var endeFrei = kampagneDa() && mitEnde(ev) && statusVon(ev) === "running";
      if (endeFrei) { e.ende = String(ev.end_date).slice(0, 10); e.start = String(ev.event_date).slice(0, 10); e.endeMonat = null; }
      var alt = { name: e.name, typ: e.typ, text: e.text, icon: e.icon, farbe: e.farbe, cover: e.cover, ende: e.ende || null };
      var api = UC.makeModal({
        titel: e.art === "watch" ? "Edit Citation Tracking" : "Edit event", breit: true, isDark: isDark,
        inhaltHtml: '<div class="uev-schritt">' + detailFelder(e, false) + (endeFrei ? feld("End date", endeFeld(e), false, "datum") : '') + coverFeld(e) +
          (e.art === "watch" ? gesperrtHinweis("The type can't be changed later")
            : gesperrtHinweis(endeFrei ? "Start date and scope can't be changed" : "Date and scope can't be changed")) + '</div>',
        knoepfe: [{ id: "abbrechen", text: "Cancel", art: "sec" },
                  { id: "speichern", text: "Save", art: "pri", aktion: function () { if (schrittOk(popup)) speichern(); return false; } }],
        onClose: popupZu, vorSchliessen: popupDarfZu
      });
      var pb = { art: "bearbeiten", api: api, e: e, alt: alt, eventId: String(ev.id), knopf: "speichern", pops: {} };
      pb.start = popupStand(pb);
      popupAufbauen(pb);
    }
    /* ADD (15.10., vorher "Add URL"): dieselben Ziel-Arten wie Schritt 3, ohne "Brand metrics
       only", mit Sitemap-Waehler. Ohne Ziele in der Datenbank genau der alte Dialog: eine URL.
       Titel "Add to tracking" seit dem 15.10. spaet: "What should we track?" ist jetzt das
       Etikett der Wahl IM Dialog und stuende sonst zweimal untereinander. */
    /* vorgabe: ein Text fuers Feld, z. B. die Domain, die die Sitemap einer Regel stattdessen auflistet
       ("Add de.holy.com" im Abschnitt Sitemap). */
    function popupZiel(vorgabe) {
      if (popup) return;
      var d = dieDetail();
      if (!d) return;
      var regeln = zieleDa();
      var e = { zielArt: "url", unterdomains: true, ziele: [], eingabe: typeof vorgabe === "string" ? vorgabe : "", artVonHand: false };
      var p = { art: "ziel", e: e, eventId: String(d.id), knopf: "hinzu", pops: {} };
      var api = UC.makeModal({
        titel: regeln ? "Add to tracking" : "Add URL", breit: true, isDark: isDark,
        inhaltHtml: '<div class="uev-schritt">' + zielFelder(p) + '</div>',
        knoepfe: [{ id: "abbrechen", text: "Cancel", art: "sec" },
                  { id: "hinzu", text: regeln ? "Add" : "Add URL", art: "pri", aktion: function () { zielSenden(); return false; } }],
        onClose: popupZu, vorSchliessen: popupDarfZu
      });
      p.api = api;
      sucheBauen(p);
      p.start = popupStand(p);
      popupAufbauen(p);
      zieleZeigen(p, false);
      verfuegbarkeitHolen(function () { if (popup === p && zieleDa() !== regeln) zieleNeuBauen(p); });
      /* Ein Text aus dem Abschnitt Sitemap wird behandelt wie getippt: Art vorschlagen, Schreibweise und
         Vorschau anfordern -- derselbe Weg wie jede Eingabe (popupEingabe). */
      if (typeof vorgabe === "string" && vorgabe) {
        var vf = im(".uev-zielein");
        try { if (vf) vf.dispatchEvent(new Event("input", { bubbles: true })); } catch (er) {}
      }
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
        if (art === "ende") { p.e.endeMonat = null; endeNeu(); }
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
      if (to) { p.e.typ = to.getAttribute("data-typ-wahl"); feldFehler("typ", ""); menueZu("typ"); typNeu(); pruefenZeigen(); knoepfeSync(); return; }
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
      /* Das Ende einer laufenden Kampagne (17.10.): eigener Kalender im Bearbeiten-Popup. */
      if (mo && x.closest(".uev-endewahl")) {
        if (mo.disabled) return;
        var ak2 = p.e.endeMonat || tagAus(p.e.ende) || tagAus(p.e.start || p.e.datum) || grenzen().heute;
        p.e.endeMonat = new Date(ak2.getFullYear(), ak2.getMonth() + parseInt(mo.getAttribute("data-monat"), 10), 1);
        endeNeu();
        return;
      }
      var te = x.closest(".uev-endewahl [data-tag]");
      if (te) {
        if (te.disabled) return;
        p.e.ende = te.getAttribute("data-tag"); feldFehler("datum", ""); menueZu("ende"); datumNeu(); knoepfeSync(); return;
      }
      if (mo) {
        if (mo.disabled) return;
        var akt = p.e.monat || tagAus(p.e.datum) || grenzen().hi;
        p.e.monat = new Date(akt.getFullYear(), akt.getMonth() + parseInt(mo.getAttribute("data-monat"), 10), 1);
        var dm = im(".uev-datumwahl");
        if (dm) dm.innerHTML = kalender(p.e);
        return;
      }
      var tg = x.closest(".uev-datumwahl [data-tag]");
      if (tg) {
        if (tg.disabled) return;
        var tag = tg.getAttribute("data-tag");
        feldFehler("datum", "");
        p.e.datum = tag;
        /* Mit Zeitraum (17.10.): ein Ende, das nicht mehr zum neuen Start passt (davor, oder laenger als
           183 Tage), faellt weg; fehlt das Ende, geht gleich der Kalender des Endes auf -- der Start
           fuellt das Feld, und das Ende ist das, was noch fehlt. */
        if (p.e.bereich && p.e.ende && (p.e.ende < tag || Math.round((tagAus(p.e.ende) - tagAus(tag)) / 86400000) + 1 > KAMPAGNE_TAGE)) p.e.ende = null;
        p.e.endeMonat = null;
        menueZu("datum"); datumNeu(); knoepfeSync();
        if (p.e.bereich && !p.e.ende) setTimeout(function () {
          var eb = popup === p ? im('[data-wahl="ende"]') : null;
          if (eb && !eb.closest(".uev-wahl").classList.contains("is-open")) eb.click();
        }, 0);
        return;
      }
      var dmo = x.closest("[data-datummodus]");
      if (dmo) {
        var ber = dmo.getAttribute("data-datummodus") === "bereich";
        if (ber === !!p.e.bereich) return;
        /* Das Ende ist nach dem Umschalten leer, in beide Richtungen; der Start bleibt. */
        p.e.bereich = ber; p.e.ende = null; p.e.wahlEnde = false; p.e.monat = null; p.e.endeMonat = null;
        feldFehler("datum", ""); datumNeu(); knoepfeSync(); return;
      }
      var cvk = x.closest("[data-cover]");
      if (cvk) { var ck = cvk.getAttribute("data-cover"); p.e.cover = p.e.cover === ck ? null : ck; p.e.coverEntschieden = true; feldFehler("cover", ""); coverNeu(); pruefenZeigen(); knoepfeSync(); return; }
      if (x.closest(".uev-cover-weg")) {
        p.e.cover = null; p.e.coverEntschieden = true; coverNeu(); pruefenZeigen(); knoepfeSync();
        /* Der Knopf klappt mit dem Bild weg -- der Fokus geht an den Knopf im Band, nicht ins Leere. */
        var ck2 = im(".uev-cover-knopf"); if (ck2) { try { ck2.focus({ preventScroll: true }); } catch (e) {} }
        return;
      }
      if (x.closest(".uev-cover-knopf")) { coverWahlSchalten(p, !p.coverOffen); return; }
      if (x.closest("[data-anheften]")) { p.e.anheften = !p.e.anheften; anheftenNeu(p); return; }
      if (x.closest("[data-notify]")) { p.e.notify = p.e.notify === false; notifyNeu(p); return; }
      var pk = x.closest("[data-pick]");
      if (pk) { var k = pk.getAttribute("data-pick"); p.e.offen = p.e.offen === k ? null : k; aussehenKlappen(); return; }
      var ze = x.closest("[data-zeichen]");
      if (ze) {
        var z = ze.getAttribute("data-zeichen");
        /* Das Zeichen des Typs ist keine eigene Wahl: dann folgt es dem Typ weiter. */
        p.e.icon = z === typVon(p.e.typ).icon ? null : z;
        feldFehler("aussehen", "");
        aussehenNeu(); pruefenZeigen();
        return;
      }
      var fa = x.closest("[data-farbe]");
      if (fa) { p.e.farbe = fa.getAttribute("data-farbe") || null; feldFehler("aussehen", ""); aussehenNeu(); pruefenZeigen(); return; }
      var ti = x.closest(".uev-topicitem");
      if (ti) { topicUmschalten(ti.getAttribute("data-topic-id")); return; }
      if (x.closest(".uev-topicalle")) {
        var alleIds = topicsAlle().map(function (y) { return String(y.id); });
        p.e.topics = p.e.topics.length === alleIds.length ? [] : alleIds;
        feldFehler("topics", "");
        topicsZeigen(); vorschauAnfordern();
        return;
      }
      if (x.closest(".uev-topicsuche-x")) {
        p.topicSuche = ""; var tsx = im(".uev-topicsuche"); if (tsx) { tsx.value = ""; try { tsx.focus(); } catch (e2) {} }
        topicsZeigen();
        return;
      }
      var tmo = x.closest("[data-tagmodus]");
      if (tmo) {
        var tw = tmo.getAttribute("data-tagmodus") === "and" ? "and" : "or";
        if (tw === p.e.tagModus) return;
        p.e.tagModus = tw; feldFehler("topics", ""); topicsZeigen(); vorschauAnfordern();
        return;
      }
      var mod = x.closest("[data-modus]");
      if (mod) {
        var mw = mod.getAttribute("data-modus");
        if (mw === p.e.modus) return;
        p.e.modus = mw; feldFehler("topics", ""); umfangNeu(); vorschauAnfordern();
        return;
      }
      var nz = x.closest("[data-neu-url]");
      /* Die Zeile "Add ...": dasselbe wie "Add" neben dem Feld (die Eingabe als Ziel der gewaehlten Art). */
      /* Die Zeile gehoert zu dem, was im Feld steht (eine Zeile, die einen Takt alt ist, tut nichts). */
      if (nz) { if (!nz.classList.contains("is-taken") && nz.getAttribute("data-neu-url") === eingabeTeile(p.e.eingabe)[0] && eingabeUebernehmen(p)) { var fz = im(".uev-zielein"); try { if (fz) fz.focus(); } catch (e0) {} } return; }
      var hit = x.closest(".uev-urltreffer [data-ziel-text]");
      if (hit) {
        var zl = (p.such.zeilen || [])[parseInt(hit.getAttribute("data-esi"), 10)];
        if (zl && !hit.classList.contains("is-taken")) zielNehmen(zl.text, zl.art);
        return;
      }
      var wt = x.closest("[data-weiten]");
      if (wt) { umfangWeiten(p, wt.getAttribute("data-weiten")); return; }
      var vh = x.closest("[data-vz-hosts]");
      if (vh) { p.vzHostsAlle = !p.vzHostsAlle; vzZeigen(p); return; }
      var hd = x.closest("[data-haupt]");
      if (hd) { eingabeSetzen(p, hd.getAttribute("data-haupt")); return; }
      var ed = x.closest("[data-eigene-domain]");
      if (ed) { eigeneDomainNehmen(p, ed.getAttribute("data-eigene-domain")); return; }
      /* ---- Ziele (15.10.) ---- */
      var art = x.closest("[data-art]");
      if (art) { artWaehlen(p, art.getAttribute("data-art"), true); return; }
      var ud = x.closest("[data-unterdomains]");
      if (ud) { p.e.unterVonHand = true; unterdomainsUmschalten(p); return; }
      if (x.closest(".uev-zielhinzu")) { if (eingabeUebernehmen(p)) { var f0 = im(".uev-zielein"); try { if (f0) f0.focus(); } catch (e0) {} } return; }
      /* data-url-weg wie vor dem 15.10.: die Liste traegt jetzt Ziele, der Knopf ist derselbe. */
      var zw = x.closest("[data-url-weg]");
      if (zw) {
        p.e.ziele.splice(parseInt(zw.getAttribute("data-url-weg"), 10), 1);
        feldFehler("ziele", "");
        zieleZeigen(p);
        var f1 = im(".uev-zielein");
        try { if (f1) f1.focus(); } catch (e1) {}
        return;
      }
      var eb = x.closest("[data-eigen-host]");
      if (eb) { if (!eb.disabled) alsEigeneZaehlen(p, eb.getAttribute("data-eigen-host")); return; }
      var st = x.closest("[data-statt-alt]");
      /* Nach "Use ..." verschwindet der Knopf mit seinem Vorschlag -- der Fokus geht ins Feld
         zurueck, statt mit dem Knopf aus dem Dialog zu fallen. */
      var va = x.closest("[data-variante-alt]");
      if (st || va) {
        if (st) hostErsetzen(p, st.getAttribute("data-statt-alt"), st.getAttribute("data-statt-neu"));
        else urlErsetzen(p, va.getAttribute("data-variante-alt"), va.getAttribute("data-variante-neu"));
        var f3 = im(".uev-zielein");
        try { if (f3) f3.focus({ preventScroll: true }); } catch (e3) {}
        return;
      }
      /* ---- Sitemap ---- */
      var sa = x.closest(".uev-sm-auf");
      if (sa) { smOeffnen(p, sa.getAttribute("data-sm-url") || "", !!sa.getAttribute("data-sm-url")); return; }
      if (x.closest(".uev-sm-zu")) { smZu(p); return; }
      if (x.closest(".uev-sm-laden")) { smLaden(p); return; }
      if (x.closest(".uev-sm-nehmen")) { smUebernehmen(p); return; }
      if (x.closest(".uev-sm-suche-x")) { p.sm.suche = ""; var sx = im(".uev-sm-suche"); if (sx) { sx.value = ""; try { sx.focus(); } catch (e2) {} } smZeichnen(p); return; }
      var sk = x.closest("[data-sm-klapp]");
      if (sk) { var kk = sk.getAttribute("data-sm-klapp"); p.sm.auf[kk] = !p.sm.auf[kk]; smZeichnen(p); smFokus(p, kk); return; }
      var sme = x.closest("[data-sm-mehr]");
      if (sme) { var km = sme.getAttribute("data-sm-mehr"); p.sm.mehr[km] = (p.sm.mehr[km] || 0) + SM_MEHR; smZeichnen(p); return; }
      var sw = x.closest("[data-sm-wahl]");
      if (sw) { smUmschalten(p, sw.getAttribute("data-sm-wahl")); return; }
    }
    function unterdomainsUmschalten(p) {
      p.e.unterdomains = !p.e.unterdomains;
      var sw = im("[data-unterdomains]");
      if (sw) { sw.classList.toggle("is-on", p.e.unterdomains); sw.setAttribute("aria-checked", String(p.e.unterdomains)); }
      unterSatzNeu(p);
      zieleZeigen(p);
    }
    function popupEingabe(ev) {
      var p = popup, x = ev.target;
      if (!p || !x || !x.matches) return;
      if (x.matches('[data-feld="name"]')) {
        p.e.name = x.value; p.nameVonHand = !!x.value.trim(); feldFehler("name", ""); knoepfeSync();
        /* Der Titel der Vorschau folgt dem Feld beim Tippen (nur der Text, die Karte wird nicht neu gebaut). */
        var vt = im(".uev-pruef .uev-karte-titel"); if (vt) vt.textContent = p.e.name.trim() || t("Untitled event");
        return;
      }
      /* Die Beschreibung sagt die Grenze beim Tippen (2000 Zeichen, v2), nicht erst beim Senden. */
      if (x.matches('[data-feld="text"]')) {
        p.e.text = x.value;
        feldFehler("text", laenge(x.value.trim()) > TEXT_MAX ? fehlerText("impact_event_invalid_param", "p_description") : "");
        knoepfeSync();
        return;
      }
      if (x.matches(".uev-typsuche")) { p.typSuche = x.value; typListeZeigen(); return; }
      if (x.matches(".uev-topicsuche")) { p.topicSuche = x.value; topicsZeigen(); return; }
      if (x.matches(".uev-typeigen")) { var add = im(".uev-typeigen-add"); if (add) add.disabled = !typEigenOk(p); return; }
      if (x.matches(".uev-zielein")) {
        feldFehler("ziele", "");
        p.schreibNotiz = null;
        feldHoehe(x);
        p.e.eingabe = x.value;
        /* Die passende Art vorschlagen, solange niemand selbst eine gewaehlt hat (15.10.). Leer
           gibt die Wahl wieder frei. */
        if (!String(x.value).trim()) {
          /* Ein leeres Feld stellt auch den Standard der Domain wieder her (alle Subdomains), wenn ihn
             nur ein Host unter einer Hauptdomain ausgeschaltet hatte -- nicht, wenn jemand den
             Schalter selbst bedient hat. */
          if (!p.e.unterVonHand && !p.e.unterdomains) unterdomainsUmschalten(p);
          p.e.unterVonHand = false;
        }
        var vs = artVorschlag(x.value);
        if (!p.e.artVonHand && vs && vs !== "sitemap") {
          var k = vs === "host_all" ? "host" : vs;
          if (artenFuer(p).some(function (a) { return a.k === k; })) {
            /* "*.host" schaltet die Unterdomains an, ein blosser Host wieder aus -- solange
               niemand den Schalter selbst bedient hat. */
            if (k === "host" && !p.e.unterVonHand && p.e.unterdomains !== (vs === "host_all")) unterdomainsUmschalten(p);
            if (k !== p.e.zielArt) artWaehlen(p, k, false);
          }
        }
        sucheStarten(p);
        schreibweiseZeigen(p);
        trefferZeigen();
        vzAnfordern(p);
        feldFavicon(p);
        knoepfeSync();
        return;
      }
      if (x.matches(".uev-sm-suche")) { p.sm.suche = x.value; smSperreWeg(p); smZeichnen(p); return; }
      /* Was im Feld des Waehlers steht, bleibt beim Zu- und Wiederaufmachen stehen (smOeffnen). */
      if (x.matches(".uev-sm-ein")) { p.sm.url = x.value; return; }
    }
    /* Enter: im Namen weiter zum naechsten Schritt (wie Speichern im Topic-Dialog), in der Suche
       die eingefuegte Adresse als neues Ziel uebernehmen. */
    function popupTaste(ev) {
      var p = popup, x = ev.target;
      if (p && ev.key === " " && x && x.matches && x.matches(".uev-topicitem")) { ev.preventDefault(); topicUmschalten(x.getAttribute("data-topic-id")); return; }
      if (p && x && x.matches && zieleTaste(p, ev, x)) return;
      /* Die Treffer am Feld: Pfeile gehen durch die Zeilen (die erste ist "Add ..."), Enter nimmt die
         aktive, ohne aktive die Eingabe. */
      if (p && x && x.matches && x.matches(".uev-zielein") && (ev.key === "ArrowDown" || ev.key === "ArrowUp")) {
        var zk = zeilenKnoepfe(), offen = !!zk.length && !!im(".uev-treffer-klapp.is-offen");
        if (offen) {
          ev.preventDefault();
          var nx = p.such.aktiv + (ev.key === "ArrowDown" ? 1 : -1);
          trefferAktiv(p, ev.key === "ArrowDown" ? Math.min(nx, zk.length - 1) : Math.max(nx, -1));
          return;
        }
        if (ev.key === "ArrowDown" && String(p.e.eingabe || "").trim()) { p.such.zu = false; trefferZeigen(); }
        return;
      }
      if (p && x && x.matches && x.matches(".uev-zielein") && ev.key === "Enter" && !ev.shiftKey && p.such.aktiv >= 0 && im(".uev-treffer-klapp.is-offen")) {
        var ak = zeilenKnoepfe()[p.such.aktiv];
        if (ak && !ak.classList.contains("is-taken")) { ev.preventDefault(); ak.click(); return; }
      }
      if (!p || ev.key !== "Enter" || !x || !x.matches) return;
      if (x.matches(".uev-typeigen")) { ev.preventDefault(); typEigenNehmen(); return; }
      if (x.matches(".uev-typitem")) { ev.preventDefault(); x.click(); return; }
      if (x.matches(".uev-topicitem")) { ev.preventDefault(); topicUmschalten(x.getAttribute("data-topic-id")); return; }
      if (x.matches('[data-feld="name"]')) {
        ev.preventDefault();
        var b = p.api.knopf(p.knopf);
        if (b && !b.disabled) { b.click(); return; }
        /* Gesperrt, weil der Typ fehlt (16.10. spaet): Enter fuehrt dorthin, statt nichts zu tun.
           Die Anleitung geht hier selbst mit -- ein focusout kommt nicht verlaesslich (gemessen: in
           einem Fenster ohne Fokus blieb es bei focus() aus). */
        if (p.art === "anlegen" && p.e.name.trim() && !p.e.typ) {
          var tb = im('[data-wahl="typ"]');
          try { if (tb) tb.focus(); } catch (e) {}
          if (!p.anlNameFertig) { p.anlNameFertig = true; anlW1Folgen(); }
        }
        return;
      }
      /* Enter im Zielfeld uebernimmt die Eingabe; Umschalt+Enter ist eine neue Zeile (mehrere URLs). */
      if (x.matches(".uev-zielein") && !ev.shiftKey) { ev.preventDefault(); eingabeUebernehmen(p); return; }
      if (x.matches(".uev-sm-ein")) { ev.preventDefault(); smLaden(p); return; }
    }

    /* Tastatur in Schritt 3 (15.10.): die Wahl ist eine Radiogruppe (Pfeile wechseln, wie in jeder
       Radiogruppe), der Schalter reagiert auf Leertaste und Enter, der Baum der Sitemap auf
       Pfeile (hoch/runter: Zeile, rechts/links: auf- und zuklappen) und Leertaste/Enter (waehlen). */
    function zieleTaste(p, ev, x) {
      var k = ev.key;
      if (x.matches("[data-art]")) {
        if (k === "ArrowDown" || k === "ArrowRight" || k === "ArrowUp" || k === "ArrowLeft") {
          var l = [].slice.call(p.api.el.querySelectorAll("[data-art]")), i = l.indexOf(x);
          var j = (i + (k === "ArrowDown" || k === "ArrowRight" ? 1 : -1) + l.length) % l.length;
          ev.preventDefault();
          artWaehlen(p, l[j].getAttribute("data-art"), true);
          try { l[j].focus(); } catch (e) {}
          return true;
        }
        if (k === " " || k === "Enter") { ev.preventDefault(); artWaehlen(p, x.getAttribute("data-art"), true); return true; }
        return false;
      }
      if (x.matches("[data-unterdomains]") && (k === " " || k === "Enter")) { ev.preventDefault(); p.e.unterVonHand = true; unterdomainsUmschalten(p); return true; }
      if (x.matches(".uev-sm-reihe") && p.sm) {
        var reihen = [].slice.call(p.api.el.querySelectorAll(".uev-sm-baum .uev-sm-reihe")), n = reihen.indexOf(x), key = x.getAttribute("data-sm-wahl");
        if (k === "ArrowDown" || k === "ArrowUp") {
          ev.preventDefault();
          var z = reihen[n + (k === "ArrowDown" ? 1 : -1)];
          if (z) smFokus(p, z.getAttribute("data-sm-wahl"));
          return true;
        }
        var kn = p.sm.knoten[key];
        if ((k === "ArrowRight" || k === "ArrowLeft") && kn && kn.art !== "seite") {
          ev.preventDefault();
          var auf = k === "ArrowRight";
          if (!!p.sm.auf[key] !== auf) { p.sm.auf[key] = auf; smZeichnen(p); smFokus(p, key); }
          return true;
        }
        if (k === " " || k === "Enter") { ev.preventDefault(); smUmschalten(p, key); return true; }
      }
      return false;
    }

    /* Einmal je Seitenaufruf fragen, was die Datenbank kann (siehe ZIELE_DA oben). fertig laeuft
       danach -- auch dann, wenn schon alles bekannt war. */
    /* Was die Zeilen des Speichers (team_context_v1.events) schon verraten, OHNE Aufruf (Audit
       EV-12: bis dahin 1 bis 3 Pruefaufrufe je Seitenaufruf, darunter ein Edge-Aufruf): status heisst
       "Kampagnen da" (Teil B), target_count/target_kinds heisst "Ziele da" (events_ziele). Eine
       Zeile, die es nicht gibt, kann nicht von einer Datenbank ohne diese Felder kommen. */
    function flagsAusListe() {
      var l = UC.getEvents ? UC.getEvents() : [];
      featuresAnwenden();
      kampagneAbleiten(l, listeGeladen());
      if (ZIELE_DA.stand == null && l.some(function (ev) { return ev && (ev.target_count != null || isArr(ev.target_kinds)); })) ZIELE_DA.stand = true;
    }
    /* meta.features aus app_start_v1/team_context_v1 (18.10., {targets, sitemap, campaigns, notices, coverage}):
       die Datenbank sagt selbst, was sie kann -- das ersetzt die Probe (Vorschau mit leerer Zielliste, erster
       echter Abruf der Abdeckung). Ein Wert true oder false zaehlt; fehlt er (aelterer Stand der DB, Antwort
       eines Teamwechsels), bleibt es beim Alten: aus einem fehlenden features wird nie "aus". false darf einen
       frueheren Schluss "da" ueberstimmen (Recht entzogen), true setzt nur, was noch unbekannt ist. */
    function featuresAnwenden() {
      var f = UC.eventFeatures ? UC.eventFeatures() : null;
      if (!f) return;
      function setz(st, v) { if (typeof v === "boolean" && (st.stand == null || v === false)) st.stand = v; }
      setz(ZIELE_DA, f.targets); setz(SITEMAP_DA, f.sitemap); setz(KAMPAGNE_DA, f.campaigns); setz(ABD_DA, f.coverage);
    }
    /* Was eine Probe festgestellt hat, gilt fuer die Sitzung des Tabs (sessionStorage, je Team): ein
       Neuladen fragt nicht noch einmal. Nur eindeutige Antworten (true/false), nie "unbekannt" --
       und ein "fehlt" haelt bis der Tab zu ist, auch wenn die Datenbank inzwischen nachzieht. */
    var DA_SCHL = "up_events_da_v1";
    function daLesen(tm) {
      try { var o = JSON.parse(window.sessionStorage.getItem(DA_SCHL) || "null"); return o && o.team === tm ? o : null; } catch (e) { return null; }
    }
    function daMerken(tm) {
      try {
        window.sessionStorage.setItem(DA_SCHL, JSON.stringify({ team: tm,
          ziele: ZIELE_DA.stand, sitemap: SITEMAP_DA.stand, kampagne: KAMPAGNE_DA.stand }));
      } catch (e) {}
    }
    /* Beim Start der Ansicht und nach jeder neuen Liste: erst aus dem Speicher ableiten. Nur wenn
       Events da sind (ihre Karten und Details haengen an den Schaltern) und etwas offen bleibt, geht
       ein Aufruf hinaus -- OHNE die Edge Function: der Sitemap-Knopf steht erst im Anlegen- und im
       Add-Dialog, und die beiden fragen selbst (verfuegbarkeitHolen(fertig)). Ein Team ohne Events
       fragt gar nichts, bis jemand "Create event" drueckt. */
    function verfuegbarkeitStart() {
      if (demo || !UC.rpc) return;
      flagsAusListe();
      /* Kam die Liste erst nach dem Oeffnen des Anlegens, gibt es den Zeitraum jetzt (kampagneAbleiten). */
      if (popup && popup.art === "anlegen" && !popup.planEventId) datumNeu();
      if (!(UC.getEvents ? UC.getEvents() : []).length) return;
      if (ZIELE_DA.stand == null) verfuegbarkeitHolen(null);
    }
    function verfuegbarkeitHolen(fertig) {
      if (demo || !UC.rpc) return;
      flagsAusListe();
      teamHolen().then(function (tm) {
        if (!tm) return null;
        var da = daLesen(tm);
        if (da) {
          if (ZIELE_DA.stand == null && typeof da.ziele === "boolean") ZIELE_DA.stand = da.ziele;
          if (SITEMAP_DA.stand == null && typeof da.sitemap === "boolean") SITEMAP_DA.stand = da.sitemap;
          if (KAMPAGNE_DA.stand == null && typeof da.kampagne === "boolean") KAMPAGNE_DA.stand = da.kampagne;
        }
        var a = ZIELE_DA.stand != null ? null : (ZIELE_DA.laeuft || (ZIELE_DA.laeuft =
          UC.rpc("preview_impact_event_targets_v1", { p_team: tm, p_targets: [], p_days: VZ_TAGE }, { timeoutMs: 15000 }).then(function (erg) {
            ZIELE_DA.laeuft = null;
            if (fehltFn(erg)) ZIELE_DA.stand = false; else if (!unbekannt(erg)) ZIELE_DA.stand = true;
          })));
        return a ? a.then(function () { daMerken(tm); }) : (daMerken(tm), null);
      }).then(function () {
        if (root.isConnected === false) return;
        /* Hat die Antwort das Fenster des offenen Events veraendert (Kampagne, "Since event"),
           gehoert die laufende Analyse nicht mehr dazu -- neu anfordern statt im Skelett zu
           warten. Ebenso Schritt 1 eines offenen Anlegen-Popups: erst jetzt gibt es den Zeitraum. */
        if (state.ansicht === "detail" && state.eventId && !dieAnalyse() && state.analyseSigLief && state.analyseSigLief !== analyseSig()) { analyseAnfordern(); renderDetail(); }
        if (popup && popup.art === "anlegen" && !popup.planEventId) datumNeu();
        /* Der Kopf des Details sagt "Add" erst, wenn der Dialog mehr als eine URL kann. */
        var tx = elAktion.querySelector(".uev-addurl-txt");
        if (tx) tx.textContent = t(zieleDa() ? "Add" : "Add URL");
        if (fertig) { try { fertig(); } catch (e) {} }
      });
    }

    /* ---- DIE ANLEITUNG (15.10., UC.makeAnleitung aus core) ---------------------------------
       Laeuft beim ERSTEN Anlegen eines Events von selbst mit (gemerkt je Nutzer, localStorage
       wie die anderen Vorlieben dieses Geraets), und der Knopf im Seitenkopf schaltet sie an und
       aus. Sie fuehrt durch die vier Schritte des Anlegens und danach kurz durch das Detail:
       Kennzahlen, Vergleich, Ziele. Wo man gerade ist, dort beginnt sie: in der Uebersicht am
       Knopf "Create event", im offenen Popup bei dessen Schritt, im Detail bei den Kennzahlen.
       Im Popup ist ihr Next dasselbe wie "Continue" (gesperrt, solange Continue gesperrt ist),
       im letzten Schritt heisst er wie der Knopf des Popups: "Create event". Die Karte haengt
       neben dem Popup (rahmen), auf schmalen Bildschirmen unten am Fenster. */
    var ANL_KEY = "up_anleitung_v1", anleitung = null, anlInsDetail = false;
    function anlNutzer() { try { return (UC.nutzerId && UC.nutzerId()) || "_"; } catch (e) { return "_"; } }
    function anlLesen() { try { var o = JSON.parse(window.localStorage.getItem(UC.prefKey ? UC.prefKey(ANL_KEY) : ANL_KEY) || "{}"); return o && typeof o === "object" ? o : {}; } catch (e) { return {}; } }
    function anleitungGesehen() { var o = anlLesen()[anlNutzer()]; return !!(o && o.events); }
    function anleitungMerken() {
      var o = anlLesen(), k = anlNutzer();
      o[k] = o[k] && typeof o[k] === "object" ? o[k] : {};
      o[k].events = 1;
      try { window.localStorage.setItem(UC.prefKey ? UC.prefKey(ANL_KEY) : ANL_KEY, JSON.stringify(o)); } catch (e) {}
    }
    function anlZeile(ic, txt) { return '<span class="up-explain-row">' + UC.icon(ic, 2) + '<span>' + esc(txt) + '</span></span>'; }
    function anlLegende() {
      return '<span class="up-explain-row">' + legLinie(false) + '<span>' + esc(t("Affected prompts")) + '</span></span>' +
        '<span class="up-explain-row">' + legLinie(true) + '<span>' + esc(t("Comparison group")) + '</span></span>';
    }
    function popupKarte() { return popup ? popup.api.karte : null; }
    function anlImPopup(id) { return { mount: popupKarte, rahmen: popupKarte, seiten: ["rechts", "links"],
      weiter: function () { weiterImPopup(); },
      weiterAus: function () { return !popup || popup.art !== "anlegen" || !!popup.warte || !schrittOk(popup); },
      zurueck: id === "w1" ? false : function () { if (popup) schritt(vor(popup, -1)); } }; }
    function anlSchritt(o, extra) { for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) o[k] = extra[k]; return o; }
    /* SCHRITT w1 WANDERT ZUM OFFENEN FELD (16.10. spaet, Nutzer: "Wenn man den Namen eingegeben hat,
       kann man nicht auf Weiter klicken"). Pflicht sind Name, Datum und Typ; das Datum steht von Haus
       aus auf heute, der Typ hat keine Vorbelegung, und Next ist gesperrt wie Continue. Bis dahin
       zeigte die Karte weiter auf den fertigen Namen -- eine Sackgasse. Jetzt wie in einer
       Produkttour: solange man tippt, bleibt sie am Namen; ist das Feld verlassen (Tab, Klick,
       Enter), zeigt sie auf das naechste offene Pflichtfeld und sagt, was es tut. Nach der Wahl
       bleibt sie dort stehen, Next ist frei -- kein Zurueckspringen unter dem Zeiger. */
    function anlW1Feld() {
      var p = popup;
      if (!p || p.art !== "anlegen" || !p.e.name.trim()) return "name";
      if (!p.e.datum) return "datum";
      return p.anlNameFertig ? "typ" : "name";
    }
    function anlW1Ziel() {
      var f = anlW1Feld();
      return im(f === "typ" ? '[data-wahl="typ"]' : f === "datum" ? '[data-wahl="datum"]' : '[data-feld="name"]');
    }
    /* Der Name ist fertig: die Karte geht mit, falls sie noch in w1 steht. Das Feld darunter holt
       sie selbst ins Bild (nearest: wer schon zu sehen ist, bleibt). */
    function anlW1Folgen() {
      if (!anleitung || !anleitung.laeuft() || anleitung.index() !== anleitung.indexVon("w1")) return;
      var z = anlW1Ziel();
      try { if (z) z.scrollIntoView({ block: "nearest" }); } catch (e) {}
      anleitung.neu();
    }
    var ANL_SCHRITTE = [
      { id: "kopf", seiten: ["unten", "links"], zurueck: false,
        ziel: function () { return elAktion.querySelector(".uev-anlegen"); },
        titel: "Create",
        text: "Track an Event measures what a change did, Track Citations watches which of your pages AI answers cite. You choose when you create.",
        vis: function () { return anlZeile("cells", t("Track an Event")) + anlZeile("globe", t("Track Citations")); },
        weiter: function () { popupArt(); } },
      /* Die Wahl der Art (19.10.): beide Arten in einer Karte. Danach geht die Anleitung mit Event Tracking weiter, der Art mit
         den vier Schritten; Citation Tracking hat drei einfache und braucht keine Fuehrung. */
      anlSchritt({ id: "art", ziel: function () { return im(".uev-wk-raster"); },
        titel: "Two ways to track",
        text: "Track an Event: Measure the impact of Campaigns, Product Launches or other assets. Track Citations: Keep an eye on pages and domains with realtime updates. The tour continues with Track an Event.",
        vis: function () { return anlZeile("cells", t("Track an Event")) + anlZeile("globe", t("Track Citations")); } },
        { mount: popupKarte, rahmen: popupKarte, seiten: ["rechts", "links"], zurueck: false,
          weiter: function () { if (popup && popup.art === "art") { popup.api.schliessen(); setTimeout(function () { popupAnlegen(null, "event"); }, 0); } },
          weiterAus: function () { return !popup || popup.art !== "art"; } }),
      anlSchritt({ id: "w1", ziel: anlW1Ziel,
        titel: "Name, date and type",
        text: function () { return anlW1Feld() === "typ" && !popup.e.typ ? "Pick the type that fits. It sets the icon, and you can filter your events by type."
          : "The date is the comparison point: Upstreem compares the days before it with the days after it."; },
        vis: function () {
          if (anlW1Feld() === "typ" && !popup.e.typ) return anlZeile("globe", t("Website relaunch")) + anlZeile("rocket", t("Product launch"));
          return anlZeile("calendar", datum(heuteIso())) + '<span class="up-explain-row"><span>' + esc(t("Before")) + '</span>' + UC.icon("arrowRight", 2) + '<span>' + esc(t("After")) + '</span></span>'; } }, anlImPopup("w1")),
      /* Gesperrt sagt die Karte, was fehlt (16.10. spaet): ohne Topic blieb Next aus, und der Satz
         erklaerte nur die Vergleichsgruppe -- der Hinweis im Popup steht unter der Liste, auf
         kleinen Fenstern ausserhalb des Bildes. */
      anlSchritt({ id: "w2", ziel: function () { return im(".uev-umfang"); },
        titel: "Which prompts are affected?",
        text: function () {
          var s = "These prompts are fixed when you create the event, and your other prompts form a comparison group that shows what would have happened anyway.";
          return popup && popup.e.modus === "topics" && !popup.e.topics.length ? t(s) + " " + t("Select at least one topic, or switch to All active Prompts.") : s;
        },
        vis: anlLegende }, anlImPopup("w2")),
      /* Ziel ist das Feld oben (15.10. spaet umgestellt): der Satz spricht von der Regel, die man
         dort eintippt, und von der Sitemap, die rechts in seinem Kopf steht. */
      anlSchritt({ id: "w3", ziel: function () { return im(".uev-eingabe-teil") || im(".uev-ziel"); },
        titel: "What should we track?",
        text: function () {
          if (!zieleDa()) return "Pick the pages that belong to this change, or keep it to brand metrics.";
          var s = "A rule like example.com/blog/* also counts new articles once an AI cites them, and you can load your sitemap or count a domain as yours right here.";
          /* Wie in w2: gesperrt steht dabei, womit es weitergeht. */
          return popup && !schrittOk(popup) ? t(s) + " " + t("Add a URL, a path or a domain, or choose Brand metrics only.") : s;
        },
        vis: function () { return zieleDa() ? anlZeile("folder", "example.com/blog/*") + anlZeile("globe", "example.com/*") : anlZeile("link", "example.com/blog/launch"); } }, anlImPopup("w3")),
      anlSchritt({ id: "w4", ziel: function () { return im(".uev-vorschau") || im(".uev-pruef"); },
        titel: "Check and create",
        text: function () {
          return popup && popup.e && startSatz(popup.e) !== "Date and scope can't be changed later"
            ? "Check the preview and create the event. You can still change everything until it starts."
            : "Check the preview and create the event, since date and prompts can't be changed later.";
        },
        vis: function () { return anlZeile("lock", t(startSatz(popup && popup.e))); },
        knopf: "Create event" }, anlImPopup("w4")),
      { id: "d1", seiten: ["unten", "oben"], zurueck: false,
        ziel: function () { return elMain.querySelector('[data-sek="kpis"]'); },
        titel: "Before and after",
        text: "Each number shows how your brand moved since the event, and vs. comparison shows how much more than in your other prompts.",
        vis: function () {
          return '<span class="up-explain-row"><span>' + esc(UC.fmtPct ? UC.fmtPct(34.3, 1) : "34.3%") + '</span><span class="up-explain-up">+' + esc(UC.fmtPct ? UC.fmtPct(4.7, 1) : "4.7%") + '</span></span>' +
            '<span class="up-explain-row"><span>' + esc(t("vs. comparison")) + '</span><span class="up-explain-up">+' + esc(UC.fmtPct ? UC.fmtPct(2.1, 1) : "2.1%") + '</span></span>';
        } },
      { id: "d2", seiten: ["oben", "unten", "rechts", "links"],
        ziel: function () { return elMain.querySelector(".uev-sek-chart .uev-chartbox"); },
        titel: "Compared with the rest",
        text: "The solid line shows the affected prompts and the dashed line the comparison group, so a gap that opens after the event is its effect.",
        vis: anlLegende },
      /* Der Kopf des Abschnitts, nicht der Abschnitt: der ist mit Kennzahlen, Verlauf und Tabelle
         hoeher als das Fenster, und die Karte fand daneben keinen Platz (gemessen: angedockt). */
      { id: "d3", seiten: ["unten", "oben", "rechts", "links"],
        ziel: function () { return elMain.querySelector(".uev-zielsek .uev-sec-head") || elMain.querySelector('[data-sek="urls"] .uev-sec-head'); },
        titel: "What you track",
        text: function () { return regelZiele(dieDetail()).length || (dieDetail() && isArr(dieDetail().urls) && dieDetail().urls.length)
          ? "Here you see which of your pages AI answers cited after the event, including new pages that match your rules."
          : "Add pages or rules at any time with Add at the top of the page."; },
        vis: function () { return anlZeile("folder", "example.com/blog/*") + anlZeile("fileText", ersetze(t("{n} new URLs after the event"), { n: 3 })); } }
    ];
    function anleitungBauen() {
      if (anleitung || !UC.makeAnleitung) return anleitung;
      anleitung = UC.makeAnleitung({
        schritte: ANL_SCHRITTE, getIsDark: isDark,
        onSchritt: function () { anleitungKnopfSync(); },
        onEnde: function () { anlInsDetail = false; anleitungKnopfSync(); }
      });
      return anleitung;
    }
    function anleitungStarten(id, fokus) {
      var a = anleitungBauen();
      if (!a) return;
      var i = a.indexVon(id);
      if (i >= 0) a.start(i, { fokus: !!fokus });
      /* Wer sie einmal gesehen hat (auch ueber den Knopf), bekommt sie nicht mehr von selbst. */
      anleitungMerken();
      anleitungKnopfSync();
    }
    function anleitungZeige(id) {
      if (!anleitung || !anleitung.laeuft()) return;
      var i = anleitung.indexVon(id);
      if (i >= 0 && i !== anleitung.index()) anleitung.zeige(i);
    }
    /* Das Popup hat den Schritt gewechselt (Continue, Back, ein Fehler): die Anleitung folgt. */
    function anleitungFolgen() {
      if (!anleitung || !anleitung.laeuft() || !popup || popup.art !== "anlegen" || popup.e.art === "watch") return;
      anleitungZeige("w" + popup.schritt);
    }
    function anleitungImDetail() { return anlInsDetail; }
    function anleitungUmschalten() {
      if (anleitung && anleitung.laeuft()) { anleitung.stop("aus"); return; }
      if (popup && popup.art === "anlegen" && popup.e.art === "watch") return;
      if (popup && popup.art === "anlegen") anleitungStarten("w" + popup.schritt, true);
      else if (state.ansicht === "detail") anleitungStarten("d1", true);
      else anleitungStarten("kopf", true);
    }
    /* Das Zeichen ist das der Anleitung im Onboarding (libraryBig, das offene Buch) -- 15.10. spaet:
       vorher signpost, das schon den Intent der Prompts traegt ("ist das gleiche wie fuer Intents"). */
    function anleitungKnopf() {
      var an = !!(anleitung && anleitung.laeuft());
      return '<button type="button" class="up-iconbtn uev-anl-toggle" aria-pressed="' + an + '" aria-label="' + esc(t("Step-by-step guide")) + '"' +
        ' data-tip="' + esc(t(an ? "Hide guide" : "Show guide")) + '">' + UC.icon("libraryBig", 2) + '</button>';
    }
    function anleitungKnopfSync() {
      var b = elAktion && elAktion.querySelector(".uev-anl-toggle");
      if (!b) return;
      var an = !!(anleitung && anleitung.laeuft());
      b.setAttribute("aria-pressed", String(an));
      b.setAttribute("data-tip", t(an ? "Hide guide" : "Show guide"));
    }

    /* ---- Abos ----------------------------------------------------------------------------- */
    if (UC.onEvents) UC.onEvents(function () {
      verfuegbarkeitStart();
      if (wartend.del && wartend.del.pruefen) loeschEntscheiden();
      state.listeZeitUm = false;
      if (listeUhrId) { clearTimeout(listeUhrId); listeUhrId = null; }
      if (state.ansicht === "uebersicht") renderListe(); else { krumenNeu(); renderKopf(); }
    }, root);
    /* Nur, solange die Events offen sind (06.10.): ausserhalb steht ?event nicht mehr in der Adresse
       (UC.ansichtsParameter), und ein popstate auf dem Dashboard haette das offene Detail sonst
       zur Uebersicht gemacht -- beim Zurueckkommen waere es weg gewesen. */
    function aufEvents() { var v = UC.currentView ? UC.currentView() : ""; return !v || v === "events"; }
    window.addEventListener("popstate", function () { if (root.isConnected && aufEvents()) adresseLesen(false); });
    /* Die Leiste aendert ihre Liste auch ohne uns (x an der Zeile, der elfte Pin draengt den
       aeltesten hinaus, Teamwechsel) -- der Knopf im Kopf zeigt dann den neuen Stand. */
    window.addEventListener("up-pins-change", function () { if (root.isConnected) pinKnopfSync(); });
    window.addEventListener("up-event-open", function (e) {
      if (!root.isConnected || !e.detail) return;
      oeffnen(e.detail.id, false);
    });
    if (UC.onViewChange) UC.onViewChange(function (name) {
      if (name === "events" && root.isConnected) setTimeout(function () { adresseLesen(true); }, 0);
    });
    /* Akzent gewechselt (06.10., "Standard + Blau"): die Kurve traegt ihre Farbe aus UC.chartInk, die
       Farbe steht beim Zeichnen fest -- also neu zeichnen. Andere Einstellungen zeichnet makeLine selbst. */
    if (UC.onPrefs) UC.onPrefs(function (d) {
      if (root.isConnected === false || (d && d.name && d.name !== "accent")) return;
      if (state.ansicht === "detail") renderChart();
    });
    if (UC.onResize) UC.onResize(root, function () {
      if (state.ansicht === "uebersicht" && abschnitt("event").liste) {
        ABSCHNITTE.forEach(function (art) {
          var n = abschnitt(art).liste ? abschnitt(art).liste.querySelectorAll(".uev-karte:not(.is-sk)").length : 0;
          rasterSetzen(art, n || 3);
        });
      }
    });

    /* ---- Setter --------------------------------------------------------------------------- */
    var ctrl = {
      /* quelle (13.10.): "lesen" -- die Antwort auf get_impact_event_v3 (bis 17.10. v2), sie schliesst kein
         wartendes Popup und keine Bestaetigung; "schreiben" -- die Antwort einer Aenderung. Ohne
         quelle (die alten Bubble-Setter) wie bisher: jedes Detail darf beides. raw darf Text
         (Bubble) oder schon ein Objekt (UC.rpc) sein -- objekt() nimmt beides. */
      setDetail: function (raw, quelle) {
        var d = objekt(raw), lesen = quelle === "lesen";
        if (!d || d.id == null) {
          state.detailLaden = false;
          if (state.ansicht === "detail" && !dieDetail()) state.detailFehler = true;
          renderDetail();
          return false;
        }
        var id = String(d.id), neu = !state.detail[id], alt = state.detail[id];
        /* Eine Antwort OHNE targets[] (v2: Bearbeiten, URL hinzufuegen und entfernen laufen weiter
           ueber v2) auf ein Detail MIT Zielen: die Regeln bleiben, die URL-Ziele kommen aus den
           neuen urls[] -- sonst verschwaenden die Abschnitte der Regeln nach jedem Umbenennen. */
        if (alt && isArr(alt.targets) && !isArr(d.targets)) {
          var behalten = alt.targets.filter(function (x) { return x && x.kind !== "url"; });
          d.targets = behalten.concat((isArr(d.urls) ? d.urls : []).map(function (u) { return { id: u.id, kind: "url", value: u.url, input: u.url_input || u.url, created_at: u.created_at }; }));
        }
        /* Hat sich die URL-Liste geaendert (URL hinzugefuegt oder entfernt), stimmt die Analyse
           nicht mehr -- Vertrag 3.9: "nach einer URL-Aenderung einfach neu laden". Das macht die
           Komponente selbst, Bubble braucht dafuer keinen zweiten Schritt. Seit 15.10. zaehlen
           die Ziele mit (eine Regel dazu oder weg). */
        function urlSatz(x) {
          var l = (x && isArr(x.urls) ? x.urls.map(function (u) { return "u" + u.id; }) : []);
          if (x && isArr(x.targets)) x.targets.forEach(function (z) { if (z && z.kind !== "url") l.push("z" + z.id); });
          return l.sort().join(",");
        }
        var urlsNeu = !neu && urlSatz(alt) !== urlSatz(d);
        state.detail[id] = d;
        state.detailLaden = false; state.detailFehler = false;
        persist();
        var planAuf = lesen && planOffenNach === id && isArr(d.targets) && isArr(d.topics);
        if (planAuf) planOffenNach = null;
        /* Ein Detail-Objekt ist auch die Antwort auf Anlegen, Bearbeiten, URL hinzufuegen und
           entfernen -- also schliesst es ein wartendes Popup dieser Art. */
        if (!lesen && wartend.urlWeg && wartend.urlWeg.eventId === id) { var api1 = wartend.urlWeg.api; clearTimeout(wartend.urlWeg.uhr); wartend.urlWeg = null; api1.busy("ok", false); api1.schliessen(); listeNeu(); }
        if (!lesen && wartend.zielWeg && wartend.zielWeg.eventId === id) { var api3 = wartend.zielWeg.api; clearTimeout(wartend.zielWeg.uhr); wartend.zielWeg = null; api3.busy("ok", false); api3.schliessen(); listeNeu(); }
        if (!lesen) popupDetailKam(d, neu);
        if (state.ansicht === "detail" && state.eventId === id) {
          if (urlsNeu) { delete abdGefragt[id]; delete abdAuto[id]; analyseAnfordern(); responsesAnfordern(false, true); }
          renderDetail();
          if (!urlsNeu && isArr(d.urls) && d.urls.length) responsesAnfordern();
        }
        if (planAuf && state.ansicht === "detail" && state.eventId === id) popupAnlegen(id);
        return true;
      },
      setAnalysis: function (raw, bestellt) {
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
        /* bestellt (17.10.): die Signatur der eigenen Anfrage -- eine Kampagne und das Fenster
           "Since event" tragen keine Fensterlaenge, an der sich die Antwort einsortieren liesse. */
        var sig = typeof bestellt === "string" && bestellt ? bestellt : analyseSig(id, fen);
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
      setFehler: function (code, wo, hint) {
        /* Nimmt den Code ODER den ganzen Fehler-Body der RPC (04.10.): Bubble liefert bei "Include
           errors in response" den Body als Text -- {"code":"P0001","message":"impact_event_...",...}.
           Dann steht der Code in message; so muss in Bubble kein Feld einzeln zugeordnet werden. */
        var roh = String(code == null ? "" : code).trim();
        if (roh.charAt(0) === "{") {
          /* objekt() wie setEventDetail -- UC.readBubble allein liest als Liste und gaebe [ {...} ]. */
          var o = objekt(roh);
          if (o && o.message != null) code = String(o.message);
          if (o && o.hint != null && hint == null) hint = String(o.hint);
        }
        var txt = fehlerText(code, hint), weg = String(code) === "impact_event_not_found";
        /* wo "lesen" (13.10.): die RPC get_impact_event_v3 (bis 17.10. v2) ist gescheitert, und genau sie -- kein
           Popup wartet darauf. Ein Event, das es nicht mehr gibt, verliert dabei sein gemerktes
           Detail (sonst stuende es weiter im Kopf), und die Liste laedt neu. */
        if (wo === "lesen") {
          state.detailLaden = false;
          if (weg && state.eventId) { delete state.detail[state.eventId]; persist(); listeNeu(); }
          if (weg || !dieDetail()) state.detailFehler = true;
          if (weg) { state.analyseLaden = false; state.analyseFehler = true; }
          renderDetail();
          if (txt !== fehlerText("") && UC.toast) UC.toast(txt, { kind: "error" });
          return true;
        }
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
        if (wartend.del && (ohneWo || wo === "delete")) { loeschFehler(txt); return true; }
        if (wartend.urlWeg && mitDetail) { urlWegFehler(txt); return true; }
        if (mitDetail && popupFehlerKam(txt, code, hint)) return true;
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
        /* Nennt der Satz eine URL (impact_event_invalid_url, hint = die Eingabe), steht sie in der Primaerfarbe. */
        var urlHv = String(code) === "impact_event_invalid_url" && hint && !/^p_/.test(String(hint)) ? String(hint) : "";
        if (UC.toast) UC.toast(txt, urlHv ? { kind: "error", hervor: urlHv } : { kind: "error" });
        return true;
      },
      /* Die Responses-Tabelle gehoert nicht dieser Komponente: bei Erfolg geht der Text unveraendert
         an renderResponsesTable. Bei einem Fehler-Body bekommt sie ihren Lesefehler ueber den
         dokumentierten Weg (__parseError, responses-table.js) -- ohne das bliebe das Skelett
         stehen, das responsesAnfordern eingeschaltet hat; die Tabelle hat keine eigene Warte-Uhr. */
      setResponses: function (raw, f) {
        if (!window.renderResponsesTable) return false;
        /* Wie bei den anderen Settern: lesbare Zeilen gewinnen gegen den Fehler-Wert. */
        var o = objekt(raw), zeilenDa = !!(o && isArr(o.rows));
        try {
          if (!zeilenDa && fehlerDa(f)) window.renderResponsesTable({ instanceId: respInstanz, __parseError: true });
          else window.renderResponsesTable(raw);
        } catch (e) {}
        return true;
      },
      setGeloescht: function (raw) {
        var r = objekt(raw);
        var id = r && r.ok === true ? String(r.deleted_event_id || (wartend.del && wartend.del.id) || "") : "";
        if (id) { geloeschtFertig(id, false); return true; }
        if (!wartend.del) return false;
        /* LEER ODER UNLESBAR heisst "unklar", nicht "fehlgeschlagen" (04.10. gemeldet und im Log
           belegt: setEventDeleted("events_page", "", ""), das Event war in der Datenbank aber weg,
           und der Dialog sagte "Da ist etwas schiefgegangen"). Dann entscheidet die Liste: steht
           das Event nach dem Loeschen nicht mehr darin, war es erfolgreich. Nur eine Antwort, die
           gelesen wurde und NICHT ok ist, ist ein Fehler. */
        if (!r) { loeschPruefen(); return false; }
        loeschFehler();
        return false;
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
    /* ?event gehoert der Events-Ansicht (06.10., gemeldet: "der Param bleibt bei Pagereloads und
       sogar beim Teamwechsel"): ausserhalb nicht in der Adresse, beim Zurueckkommen wieder da, nach
       einem Teamwechsel weg -- auch ueber ein Neuladen hinweg. Vor dem ersten Stand, damit ein
       Parameter aus einem anderen Team gar nicht erst geoeffnet wird. */
    /* Was die Datenbank schon kann (Ziele, Kampagnen): aus der Liste abgeleitet, ein Aufruf nur,
       wenn etwas offen bleibt (verfuegbarkeitStart); die Sitemap fragt der Dialog selbst. */
    verfuegbarkeitStart();
    if (UC.ansichtsParameter) UC.ansichtsParameter({ ansicht: "events", schluessel: ["event"], owner: root,
      onTeamWechsel: function () { if (state.ansicht === "detail") zurUebersicht(false); } });
    /* Erster Stand: die Adresse entscheidet. spaet=true fuer einen Tiefenlink: seit 13.10. wartet
       der direkte Weg dafuer nur auf das Team (rufen); fire.spaet -- warten, bis Bubbles
       Empfaenger stehen -- gilt nur noch, wenn ein Kanal auf den Rueckweg an Bubble faellt. */
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
      setEventDetail:       function (id, p, f) { return jede(id, p, function (c, v) { if (!antwortOk("detail", v) && fehlerDa(f)) c.setFehler(f, "detail"); else c.setDetail(v); }); },
      setEventAnalysis:     function (id, p, f) { return jede(id, p, function (c, v) { if (!antwortOk("analysis", v) && fehlerDa(f)) c.setFehler(f, "analysis"); else c.setAnalysis(v); }); },
      setEventScopePreview: function (id, p, f) { return jede(id, p, function (c, v) { if (!antwortOk("preview", v) && fehlerDa(f)) c.setFehler(f, "preview"); else c.setVorschau(v); }); },
      setEventDeleted:      function (id, p, f) { return jede(id, p, function (c, v) { if (!antwortOk("delete", v) && fehlerDa(f)) c.setFehler(f, "delete"); else c.setGeloescht(v); }); },
      setEventResponses:    function (id, p, f) { return jede(id, p, function (c, v) { c.setResponses(v, f); }); },
      /* setEventError("impact_event_url_duplicate") -- so steht es im Vertrag (1.1), ohne Instanz.
         Mit zwei Argumenten wie jeder andere Setter: (instanz, code). */
      setEventError:        function (a, b) {
        /* Ein LEERER Fehler-Body ist kein Fehler (04.10.): laeuft ein alter setEventError-Schritt
           ohne greifendes "Only when" auch bei Erfolg, kam hier "" an -- und brach die laufende
           Zaehlung ab, bevor deren richtige Antwort da war. */
        if (b === undefined) return fehlerDa(a) ? alle(function (c) { c.setFehler(a); }) : false;
        if (!fehlerDa(b)) return false;
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
