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
  function css(f){
    once(base + f, function(u){
      var l = document.createElement("link"); l.rel = "stylesheet"; l.href = u;
      document.head.appendChild(l);
    });
  }
  /* async = false ist PFLICHT und keine Feinheit: ein per createElement eingehaengtes Skript laeuft
     sonst, sobald es da ist, und dann kann visibility-chart.js vor core.js starten und findet
     window.UpstreemCore nicht. Mit async = false halten die Skripte ihre Reihenfolge. */
  function js(f){
    once(base + f, function(u){
      var s = document.createElement("script"); s.src = u; s.async = false;
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
    "qa_select_domain","qa_select_prompt","qa_select_url","quick_actions_search"
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

  /* Die Komponenten, die im Fenster stehen. Wer eine hinzufuegt, aendert NUR diese zwei Bloecke
     und das Markup in .landing_markup.py -- in Framer bleibt es beim Pin. */
  css("core.css");
  css("sidebar.css");
  css("page-headers/dashboard-page-header.css");
  css("visibility-chart.css");
  css("topcitations-dashboard.css");
  css("quick-actions.css");
  css("ask-mira.css");
  css("page-headers/prompts-page-header.css");
  css("prompts-table.css");
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
  css("performance-radar.css");
  css("landing-hero.css");

  js("core.js");
  js("sidebar.js");
  js("page-headers/dashboard-page-header.js");
  js("visibility-chart.js");
  js("topcitations-dashboard.js");
  js("quick-actions.js");
  js("ask-mira.js");
  js("page-headers/prompts-page-header.js");
  js("prompts-table.js");
  js("page-headers/opportunities-page-header.js");
  js("opportunities.js");
  js("responses-table.js");
  js("page-headers/performance-page-header.js");
  js("performance-radar.js");
  js("domain-detail.js");
  /* Zuletzt: diese Datei ruft die Setter der anderen. */
  js("landing-hero.js");
})();
