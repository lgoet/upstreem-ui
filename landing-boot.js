/* upstreem landing-boot.js — der Lader der Hero-Sektion.

   WARUM diese Datei ueberhaupt existiert: die Liste der Dateien darf NICHT im Framer-Schnipsel
   stehen. Genau daran ist es einmal gescheitert -- Quick Actions kam dazu, das Schnipsel bekam zwei
   neue Zeilen, in Framer wurde aber nur der Pin getauscht. Ergebnis: das Markup der Palette war da
   (es steckt in landing-hero.js), ihre CSS nicht. Eine Palette ohne Formatierung, und von aussen
   sah es wie ein kaputter Pin aus.

   Jetzt traegt das Schnipsel nur noch die Wurzel und den Pin. Alles andere steht hier, und diese
   Datei kommt aus demselben Pin. Eine neue Komponente im Fenster heisst ab jetzt: eine Zeile HIER,
   neuer Pin in Framer -- und nie wieder ein neues Einsetzen von Hand.

   Der Pin kommt aus der eigenen Adresse (document.currentScript.src) und nicht aus dem Attribut:
   diese Datei ist ja schon vom Pin geladen worden, also steht er dort garantiert richtig. Das
   Attribut bleibt der Rueckfall, falls currentScript fehlt. */
(function(){
  "use strict";

  function basisAusEigenerAdresse(){
    var s = document.currentScript;
    var src = (s && s.src) || "";
    var i = src.lastIndexOf("/");
    return i > 0 ? src.slice(0, i + 1) : "";
  }

  function basisAusAttribut(){
    var el = document.querySelector(".ulh-root");
    var v = el && el.getAttribute("data-cdn-pin");
    var pin = (!v || v === "CDN_PIN") ? "main" : v;
    return "https://cdn.jsdelivr.net/gh/lgoet/upstreem-ui@" + pin + "/";
  }

  var base = basisAusEigenerAdresse() || basisAusAttribut();

  /* Einmal pro Dateiname, nicht pro URL -- dieselbe Buchfuehrung wie in den Bubble-Ladern. Auf der
     Landingpage gibt es zwar nur eine Sektion, aber Framer baut ein Embed bei jeder Navigation neu
     ein, und ohne die Sperre haengen nach ein paar Seitenwechseln vierzehn Kopien im Kopf. */
  var L = window.__upAssetsLoaded || (window.__upAssetsLoaded = {});
  function once(url, make){
    var name = url.slice(url.lastIndexOf("/") + 1);
    if (L[name]) return;
    L[name] = url; make(url);
  }
  /* ZWEITER WEG BEI EINEM FEHLER (01.10.). Gemeldet: "die Landingpage ist komplett kaputt,
     unformatierte Icons". Sechs Dateien des Pins kamen als 404 "Couldn't find the requested file":
     GitHub hatte jsDelivr beim ersten Abruf gedrosselt (429), und jsDelivr merkt sich den Fehlschlag
     einen Tag lang -- an seinem Rand UND im Browser (max-age 86400). Ohne sidebar.js und
     opportunities.js lief die Sektion nie an.
     Faellt eine Datei aus, kommt sie jetzt einmal ueber den zweiten Rechner von jsDelivr
     (fastly.jsdelivr.net) -- derselbe Pin, derselbe Inhalt, aber ein eigener Zwischenspeicher im
     Browser und am Rand. Ein Stylesheet kommt an DERSELBEN Stelle wieder hinein, sonst stuende
     core.css ploetzlich hinter landing-hero.css und schluege dessen Regeln gleicher Spezifitaet. */
  function zweiterWeg(u){ return u.indexOf("https://cdn.jsdelivr.net/") === 0 ? u.replace("https://cdn.jsdelivr.net/", "https://fastly.jsdelivr.net/") : ""; }
  function css(f){
    once(base + f, function(u){
      var l = document.createElement("link"); l.rel = "stylesheet"; l.href = u;
      l.onerror = function(){
        var u2 = zweiterWeg(u); if (!u2) return;
        var r = document.createElement("link"); r.rel = "stylesheet"; r.href = u2;
        if (l.parentNode){ l.parentNode.insertBefore(r, l.nextSibling); l.parentNode.removeChild(l); }
        else document.head.appendChild(r);
      };
      document.head.appendChild(l);
    });
  }
  /* async = false ist PFLICHT und keine Feinheit: ein per createElement eingehaengtes Skript laeuft
     sonst, sobald es da ist, und dann kann visibility-chart.js vor core.js starten und findet
     window.UpstreemCore nicht. Mit async = false halten die Skripte ihre Reihenfolge. */
  /* Ein Skript, das ueber den zweiten Weg nachkommt, laeuft nach den anderen -- die Reihenfolge ist
     dann nicht mehr zu halten. Das tragen die Komponenten: jede wartet beim Start auf core, und
     landing-hero.js wartet bis zu zehn Sekunden, bis alles da ist (bereit()). */
  function js(f){
    once(base + f, function(u){
      var s = document.createElement("script"); s.src = u; s.async = false;
      s.onerror = function(){
        var u2 = zweiterWeg(u); if (!u2) return;
        var r = document.createElement("script"); r.src = u2; r.async = false;
        document.head.appendChild(r);
        if (s.parentNode) s.parentNode.removeChild(s);
      };
      document.head.appendChild(s);
    });
  }

  /* ══ DER RIEGEL GEGEN DEN FREMDEN RAHMEN (21.09.) ═══════════════════════════════════════════
     Gemeldet: auf der echten Seite blieb ab dem Dashboard alles leer. Die Konsole sagte es
     genau:

       SecurityError: Failed to read a named property 'dphMode' from 'Window':
       Blocked a frame with origin "...framercanvas.com" from accessing a cross-origin frame.
           at resolveBubbleFn (core.js) ... at fuellen (landing-hero.js)

     Warum das passiert: die Komponenten melden Ereignisse an Bubble, und core sucht die Funktion
     dafuer so -- ERSTE Zeile von resolveBubbleFn:

       window[fnName] || (window.parent && window.parent[fnName]) || (window.top && window.top[fnName])

     In Bubble ist der Rahmen gleichen Ursprungs, da ist das harmlos. In Framer liegt das Embed
     auf framercanvas.com und die Seite darueber auf framer.com -- ein Zugriff auf
     window.parent[...] WIRFT dort, und zwar ungefangen. Der Wurf reisst den Aufrufer mit; bei
     uns war das fuellen(), und ab dieser Zeile blieb jede Komponente im Ladezustand.

     Die Landingpage hat KEINE Rueckwege nach Bubble und will keine: sie ist eine Vorfuehrung,
     kein Programm. Also bekommt sie hier fuer jeden Namen, den die Komponenten suchen koennten,
     eine Funktion, die NICHTS tut. Damit trifft schon der erste Term (window[fnName]), der Rest
     des Ausdrucks wird nie ausgewertet, und es gibt nichts mehr, was werfen koennte.

     Das ist der richtige Ort dafuer: diese Datei laeuft VOR jeder Komponente. Und es ist ein
     Eingriff, der ausschliesslich die Landingpage betrifft -- in der App existiert keine dieser
     Zeilen.

     Die Liste ist aus den Komponenten UND den Bubble-Vorlagen gezogen, beide Schreibweisen (mit
     und ohne bubble_fn_-Praefix, denn core faellt auf den Praefix zurueck, wenn der nackte Name
     nichts findet). Kommt eine Komponente mit einem neuen Namen dazu und fehlt er hier, ist der
     Schaden ab jetzt klein: es gibt seit demselben Tag eine Warnung in landing-hero.js, die
     sagt, dass fuellen() geworfen hat. */
  var STUMM = [
    /* Seitenkoepfe */
    "bphAdd","bphNav","bphRefresh","cphNav","cphRefresh","dphDocs","dphMode","dphRefresh",
    "dphSearch","ophSearch","pphAdd","pphNav","pphRefresh","sphNav",
    /* Domain-Detail, Performance */
    "uddGran","uddMode","uhmMetric","uhmSelect",
    /* Prompts-Tabelle */
    "uptAddTopics","uptApplyBulkTopics","uptBrand","uptBulkDelete","uptBulkStatus","uptEditTopics",
    "uptGenerateMore","uptGroupOpen","uptGroups","uptMentioned","uptPage","uptRowClick","uptSearch",
    "uptSelect","uptSort","uptStatus",
    /* Antworten- und Domaintabelle */
    "urtBrand","urtFilter","urtMentioned","urtPage","urtRowClick","urtSearch","urtSort","urtView",
    "udtBrand","udtFilter","udtMentioned","udtOpenUrl","udtPage","udtRowClick","udtSearch",
    "udtShowPages","udtSort",
    /* Seitenleiste */
    "usnAccount","usnLogout","usnNav","usnNewTeam","usnPinned","usnState","usnTeam","usnTheme",
    /* Visibility-Chart und Zitatteil -- diese zwei melden mit vollem Namen */
    "votExportTable","votGoTo","votGranularity","votRowClick","votSortTable","votSubmitCompanies",
    "tcdApplyTypeFilter","tcdBrandMentioned","tcdExportTable","tcdFilterDimension","tcdGoTo",
    "tcdMode","tcdRowClick",
    /* Chancenbrett */
    "opportunity_change_status","opportunity_competitor_click","opportunity_create_with_ai",
    "opportunity_ignore","opportunity_move_all","opportunity_open_url",
    /* Mira */
    "ask_mira_create_opportunity","ask_mira_create_project","ask_mira_export_pdf",
    "ask_mira_feedback","ask_mira_more_chats","ask_mira_move_opportunity_status",
    "ask_mira_new_chat","ask_mira_open_evidence","ask_mira_opportunity_created",
    "ask_mira_refresh_chat","ask_mira_rename_chat","ask_mira_select_chat","ask_mira_send",
    "ask_mira_settings_change","ask_mira_suggested_question","ask_mira_voice","miraAction",
    /* Quick Actions */
    "qa_add_brand","qa_add_prompt","qa_edit_brand","qa_export_data","qa_select_brand",
    "qa_select_domain","qa_select_prompt","qa_select_url","quick_actions_search",
    /* Shopping (sechste Szene): die vier Anfragen. Die Daten kommen aus landing-hero.js. */
    "shopOverview","shopProducts","shopProductDetail","shopMerchants"
  ];
  function stumm(){}
  for (var si = 0; si < STUMM.length; si++){
    var nm = STUMM[si];
    try {
      if (typeof window[nm] !== "function") window[nm] = stumm;
      var mit = "bubble_fn_" + nm;
      if (typeof window[mit] !== "function") window[mit] = stumm;
    } catch (e){}
  }
  /* HIER STAND EINMAL EIN ZWEITER GRIFF: window.parent auf das eigene Fenster umschreiben, damit
     auch ein Name, den die Liste oben nicht kennt, nicht mehr werfen kann. Er ist wieder raus.
     Gemessen: damit zeigt parent auf das eigene Fenster, und jedes parent.postMessage landet bei
     einem selbst statt bei der Seite darueber -- die Verbindung zum Gastgeber waere weg, fuer
     alles, was sie je brauchen koennte. Ein Riegel, der eine Tuer zumauert, ist der falsche
     Riegel. Die Liste oben deckt die Namen ab, die wirklich feuern; kommt einer dazu, sagt es
     die Warnung in landing-hero.js. */

  /* ══ KEIN THEMA AUS CORE BEIM START (06.10.) ════════════════════════════════════════════════
     core stellt beim Laden selbst ein Thema her (themeBeimStart): aus der gespeicherten Wahl oder,
     ohne sie, aus dem Betriebssystem. Auf einem dunkel gestellten Rechner hiess das: core setzte
     "dark", schrieb pref_theme=dark und data-up-pagetheme=dark an das <html> der fremden Seite, und
     erst landing-hero.js (themaHell) drehte es danach auf hell -- ein Umweg ueber Dunkel bei jedem
     Besuch, mit Neuzeichnen aller Abonnenten. Die Landingpage ist immer hell und sagt das selbst;
     die Marke, mit der core seinen Start ueberspringt, steht deshalb hier, VOR core.js.
     (Der Wechsel zweier Schreiber an data-theme, der die Zeilen von Shopping stocken liess, lag an
     hellHalten in landing-hero.js -- Begruendung dort.) In der App steht die Zeile nicht. */
  try { window.__upThemeBooted = true; } catch (e){}

  /* ══ KEIN APP-START AUF DER LANDINGPAGE (13.10.) ═══════════════════════════════════════════
     Seit 2ea3ef9 (12.10.) startet core die App von selbst, sobald eine Seitenleiste (.usn-root)
     auf der Seite steht (appAutostart): app_start_v1, und ohne Anmeldung nach 1,5 s
     location.assign("/signup"). Die Landingpage zeigt eine ECHTE Seitenleiste im Fenster -- also
     lief genau das. Gemessen im Pruefstand am 13.10.: das Embed (Stand HEAD) landete nach wenigen
     Sekunden auf /signup. Im Rahmen ist das "nur" ein leeres Embed; seit die Seite in der
     Framer-Seite selbst steht, waere es die ganze Seite upstreem.ai.
     core legt seinen Zustand in window.__upApp an und uebernimmt einen, der schon da ist. Steht er
     auf "laeuft", kehrt appStart() sofort zurueck; "aktiv: false" laesst jeden anderen Weg so, wie
     er ohne App-Start ist. Dieselbe Bauart wie __upThemeBooted direkt darueber. In der App steht die
     Zeile nicht. Seit dem 13.10. prueft auch core selbst (appAutostart ignoriert eine Seitenleiste
     in .ulh-root) -- diese Zeile bleibt als Netz fuer einen aelteren core am selben Pin. */
  try {
    if (!window.__upApp) window.__upApp = { aktiv: false, laeuft: true, team: "", start: null,
                                            themaVonStart: false, nachStart: 0, landing: true };
  } catch (e){}

  /* ══ KEINE ECHTE TASTE ERREICHT DAS SCHAUSTUECK (13.10.) ════════════════════════════════════
     Quick Actions oeffnet seine Palette mit Cmd/Ctrl+K und hoert darauf am DOCUMENT, in der
     Einfangphase (quick-actions.js). Im Embed-Rahmen war das harmlos: die Taste kam nur an, wenn
     der Rahmen den Fokus hatte. Seit die Seite als Code-Komponente IN der Framer-Seite steht
     (UpstreemLanding.tsx), ist das Document das der Seite -- ein Cmd+K irgendwo auf upstreem.ai
     haette die Palette im Fenster geoeffnet und dem Browser die Taste weggenommen.
     Der Riegel sitzt am WINDOW, ebenfalls in der Einfangphase: das window kommt vor dem document,
     also erreicht die Taste den Zuhoerer der Palette nie. Nur die Weitergabe wird gestoppt, kein
     preventDefault -- der Browser tut mit der Taste, was er ohne die Sektion taete. Die Szenen
     oeffnen die Palette nicht per Taste, ihnen fehlt also nichts. In der App steht die Zeile nicht. */
  try {
    window.addEventListener("keydown", function(e){
      var k = (e.key || "").toLowerCase();
      if ((e.metaKey || e.ctrlKey) && (k === "k" || e.code === "KeyK")) e.stopPropagation();
    }, true);
  } catch (e){}

  /* Die Komponenten, die im Fenster stehen. Wer eine hinzufuegt, aendert NUR diese zwei Bloecke
     und das Markup in .landing_markup.py -- in Framer bleibt es beim Pin. */
  css("core.css");
  css("sidebar.css");
  /* DIE SEITEN DER APP ALS GANZES (16.10.): seit Oktober baut die App jede Seite als EINE
     Komponente (dashboard-page.js ...), mit Kopf, Kalender und Filterleiste und den flachen
     Baendern. Das Fenster zeigt sie genauso. Die Filterleiste braucht ihre fuenf Bausteine. */
  css("filters/date-range.css");
  css("filters/filter-bar.css");
  css("filters/models-filter.css");
  css("filters/topics-filter.css");
  css("filters/markets-filter.css");
  css("dashboard-page.css");
  css("visibility-chart.css");
  css("topcitations-dashboard.css");
  css("quick-actions.css");
  css("ask-mira.css");
  css("prompts-page.css");
  css("prompts-table.css");
  css("topics-manager.css");
  css("opportunities-page.css");
  css("opportunities.css");
  /* Nur fuer das kleine Fenster rechts: eine Antwortkarte. */
  css("responses-table.css");
  /* Nur fuer die Vorschau in der dritten Karte: die Domaintabelle mit ihrem Drilldown. Ihre CSS
     allein -- die Vorschau ist statisches Markup mit ihren Klassen, aufgeklappt wird dort nichts. */
  css("domains-table.css");
  /* Die vierte Sektion zeigt eine echte Domain-Detail-Seite: hier braucht es die Komponente ganz,
     CSS und JS -- anders als die Vorschauen in den Karten ist sie nicht statisch, sie rechnet ihre
     Charts selbst. */
  css("domain-detail.css");
  css("performance-page.css");
  css("performance-radar.css");
  css("performance-detail.css");
  css("urls-table.css");
  /* Sechste Szene: die Shopping-Seite, Komponente ganz (CSS und JS) wie Domain Detail. */
  css("shopping.css");
  /* Der Block "Events": die Event-Karte ist statisches Markup mit den Klassen von events.js. */
  css("events.css");
  css("landing-hero.css");

  js("core.js");
  js("sidebar.js");
  js("filters/date-range.js");
  js("filters/filter-bar.js");
  js("filters/models-filter.js");
  js("filters/topics-filter.js");
  js("filters/markets-filter.js");
  /* Die Datenmodule der Seiten (ohne DOM). Die Seiten warten beim Start auf sie; ihre Abfragen
     gehen auf der Landingpage nie hinaus (landing-hero.js, seitenLaderStill). */
  js("citations-data.js");
  js("dashboard-data.js");
  js("visibility-chart.js");
  js("topcitations-dashboard.js");
  js("quick-actions.js");
  js("ask-mira.js");
  js("prompts-data.js");
  js("prompts-table.js");
  js("topics-manager.js");
  js("opportunities-data.js");
  js("opportunities.js");
  js("responses-table.js");
  js("performance-data.js");
  js("performance-radar.js");
  js("performance-detail.js");
  js("urls-table.js");
  js("domain-detail.js");
  js("shopping.js");
  js("dashboard-page.js");
  js("prompts-page.js");
  js("opportunities-page.js");
  js("performance-page.js");
  /* Das Verhalten von Leiste und Fuss (13.10.): dieselbe Datei laden die eigenen Komponenten
     UpstreemTopbar.tsx und UpstreemFooter.tsx auf den anderen Seiten. VOR landing-hero.js, das
     sie ruft. */
  js("landing-teile.js");
  /* Zuletzt: diese Datei ruft die Setter der anderen. */
  js("landing-hero.js");
})();
