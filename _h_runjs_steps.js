/* ==============================================================================================
   upstreem -- die Run-JS-Schritte fuer JEDE Komponente, in der Bauart, die einen leeren
   Bubble-Ausdruck ueberlebt.

   ── WOFUER DIESE DATEI DA IST ─────────────────────────────────────────────────────────────
   Die Dateien unter bubble/ sind Vorlagen fuer NEUE Installationen. Ein Element, das in Bubble
   schon steht, erreichen Aenderungen daran nicht. Die Schritte hier sind zum Kopieren in die
   bestehenden Workflows gedacht -- einer nach dem anderen, in der Reihenfolge, in der es dir
   passt.

   ── WARUM UEBERHAUPT ──────────────────────────────────────────────────────────────────────
   Ein Objektliteral im Schritt wird vom Browser GEPARST, bevor eine einzige Zeile laeuft. Ist
   ein Bubble-Ausdruck leer, steht dort

       "avg_visibility_prev_pct": ,

   und das ist kein gueltiges JavaScript: "Uncaught SyntaxError: Unexpected token ','". Der
   Schritt stirbt beim Parsen -- also laufen auch alle Aufrufe DARUNTER nicht mehr, und deren
   Komponenten bleiben im Ladezustand stehen. Kein Sanitizer und kein Code im Kit kann das
   abfangen, weil nichts davon zur Ausfuehrung kommt.

   Im Backtick ist derselbe leere Wert nur Text. Die erste Ersetzung macht daraus null, die
   zweite quotiert Bubbles unquotiertes yes/no. BEIDE Zeilen sind Pflicht.

   ── DREI REGELN, DIE IN JEDEM SCHRITT UNTEN STECKEN ───────────────────────────────────────
   1. "instanceId" steht als ERSTES Feld. Bricht der Payload mitten ab, findet core die Id noch
      im Rohtext und die RICHTIGE Platzierung zeigt den Fehler. Steht sie hinten, ist sie mit
      abgeschnitten -- auf einer Seite mit zwei Platzierungen meldet dann die falsche.
   2. Jeder Aufruf hat sein EIGENES try. Faellt ein Ausdruck aus, nimmt er die anderen nicht mit.
   3. window.<name> statt des nackten Namens. Haengt das Element noch an einem aelteren Pin, ist
      der Name schlicht undefined statt ein ReferenceError, der den ganzen Schritt mitnimmt.

   Zahlen bleiben OHNE Anfuehrungszeichen -- 3.0, nicht "3.0". Sonst kommt der Wert als Text an
   und jede Rechnung darauf geht daneben. Texte dagegen IMMER in Anfuehrungszeichen.

   Der einzige Zeichensatz, der im Backtick selbst gefaehrlich bleibt, ist ein Backtick oder ein
   Dollar mit geschweifter Klammer in einem WERT. Beides kommt in Marken-, Domain- und
   Themennamen nicht vor; Anfuehrungszeichen, Apostrophe, Umlaute, Zeilenumbrueche und Emoji
   traegt er unbeschadet.

   ── WAS DIE KOMPONENTE JETZT BEI EINEM UNLESBAREN PAYLOAD TUT ─────────────────────────────
   Sie beendet den Ladezustand und schreibt "The data could not be read. Please reload the page."
   an die Stelle der Daten. Ein WIRKLICH leerer Payload ("" oder "[]") bleibt der normale
   Leerzustand. Ein neuer Ladeversuch raeumt die Meldung weg.

   Das gilt fuer: visibility-chart, citations-combo-chart, top-citations, prompts-table,
   urls-table, domains-table, responses-table, topics-manager, brands-overview, discover-brands,
   performance-detail, performance-radar, settings-brand, url-detail, brand-detail, domain-detail,
   response-detail.

   NOCH NICHT fuer die seitenweiten Setter (setUpstreemBrands, setUpstreemTopics,
   setUpstreemMarkets, setUpstreemNotifications), opportunities, ask-mira, prompt-research und
   create-with-ai. Dort ist der Backtick unten die EINZIGE Absicherung.
   ============================================================================================== */


/* ══ 0. Der Baustein, den jeder Schritt benutzt ═══════════════════════════════════════════════
   Nicht kopieren -- nur zum Nachschlagen. In den Schritten unten steht er ausgeschrieben, damit
   jeder fuer sich vollstaendig ist. */
//   var ROH = `…Bubble-Ausdruecke…`
//     .replace(/:\s*([,}\]])/g, ": null$1")
//     .replace(/:\s*(yes|no)\s*([,}\]])/g, function (_, v, t) { return ": " + (v === "yes") + t; });


/* ══ 1. DASHBOARD ════════════════════════════════════════════════════════════════════════════ */

/* --- Visibility Chart --------------------------------------------------------------------- */
(function () {
  var ROH = `{
    "instanceId": "INSTANCE_ID",
    "granularity": "day",
    "series": [BUBBLE: Ergebnis des Visibility-Serien-RPC],
    "table": [BUBBLE: Ergebnis des Top-Brands-RPC],
    "companies": [BUBBLE: Markenliste],
    "totalCount":
  }`
    .replace(/:\s*([,}\]])/g, ": null$1")
    .replace(/:\s*(yes|no)\s*([,}\]])/g, function (_, v, t) { return ": " + (v === "yes") + t; });
  try { if (window.renderVisibilityChart) window.renderVisibilityChart(ROH); } catch (e) {}
  /* setLoading nimmt zwei einfache Werte und braucht keinen Backtick. */
  try { if (window.setVisibilityChartLoading) window.setVisibilityChartLoading("INSTANCE_ID", "no"); } catch (e) {}
})();

/* --- Top Citations Dashboard --------------------------------------------------------------- */
/* ACHTUNG: liefern zwei Workflows je eine Haelfte (einer die Domains, einer die URLs), braucht
   JEDER seinen eigenen Schritt -- und die jeweils andere Haelfte gar nicht mitgeben, auch nicht
   als leere Liste. Eine leere Liste NEBEN einer gefuellten loescht die gute Haelfte. */
(function () {
  var ROH = `{
    "instanceId": "INSTANCE_ID",
    "mode": "domain",
    "top_domains": [BUBBLE: Ergebnis des Top-Domains-RPC],
    "types_breakdown": [BUBBLE: Ergebnis des Zitationstyp-RPC],
    "citations_total":
  }`
    .replace(/:\s*([,}\]])/g, ": null$1")
    .replace(/:\s*(yes|no)\s*([,}\]])/g, function (_, v, t) { return ": " + (v === "yes") + t; });
  try { if (window.renderTopCitations) window.renderTopCitations(ROH); } catch (e) {}
  try { if (window.setTopCitationsLoading) window.setTopCitationsLoading("INSTANCE_ID", "no"); } catch (e) {}
})();

/* --- Citations Combo Chart ----------------------------------------------------------------- */
(function () {
  var ROH = `{
    "instanceId": "INSTANCE_ID",
    "granularity": "day",
    "dataMode": "domain",
    "series": [BUBBLE: Ergebnis des Zitations-Serien-RPC],
    "types": [BUBBLE: Ergebnis des Typ-RPC],
    "domains": [BUBBLE: Domainliste mit favicon_url],
    "total":
  }`
    .replace(/:\s*([,}\]])/g, ": null$1")
    .replace(/:\s*(yes|no)\s*([,}\]])/g, function (_, v, t) { return ": " + (v === "yes") + t; });
  try { if (window.renderComboChart) window.renderComboChart(ROH); } catch (e) {}
  try { if (window.setComboChartLoading) window.setComboChartLoading("INSTANCE_ID", "no"); } catch (e) {}
})();


/* ══ 2. TABELLEN ═════════════════════════════════════════════════════════════════════════════
   Alle vier haben dieselbe Bauart. "rows" ist das RPC-Ergebnis, "totalCount" die Gesamtzahl
   ueber alle Seiten -- ohne sie bleibt die Blaetterung auf einer Seite stehen. */

/* --- Prompts Table -------------------------------------------------------------------------- */
(function () {
  var ROH = `{
    "instanceId": "INSTANCE_ID",
    "view_active": "yes",
    "rows": [BUBBLE: RPC-Ergebnis],
    "totalCount":
  }`
    .replace(/:\s*([,}\]])/g, ": null$1")
    .replace(/:\s*(yes|no)\s*([,}\]])/g, function (_, v, t) { return ": " + (v === "yes") + t; });
  try { if (window.renderPromptsTable) window.renderPromptsTable(ROH); } catch (e) {}
})();

/* --- URLs Table ----------------------------------------------------------------------------- */
(function () {
  var ROH = `{
    "instanceId": "INSTANCE_ID",
    "rows": [BUBBLE: RPC-Ergebnis],
    "totalCount":
  }`
    .replace(/:\s*([,}\]])/g, ": null$1")
    .replace(/:\s*(yes|no)\s*([,}\]])/g, function (_, v, t) { return ": " + (v === "yes") + t; });
  try { if (window.renderUrlsTable) window.renderUrlsTable(ROH); } catch (e) {}
})();

/* --- Domains Table -------------------------------------------------------------------------- */
(function () {
  var ROH = `{
    "instanceId": "INSTANCE_ID",
    "rows": [BUBBLE: RPC-Ergebnis],
    "totalCount":
  }`
    .replace(/:\s*([,}\]])/g, ": null$1")
    .replace(/:\s*(yes|no)\s*([,}\]])/g, function (_, v, t) { return ": " + (v === "yes") + t; });
  try { if (window.renderDomainsTable) window.renderDomainsTable(ROH); } catch (e) {}
})();

/* --- Responses Table ------------------------------------------------------------------------ */
(function () {
  var ROH = `{
    "instanceId": "INSTANCE_ID",
    "rows": [BUBBLE: RPC-Ergebnis],
    "totalCount":
  }`
    .replace(/:\s*([,}\]])/g, ": null$1")
    .replace(/:\s*(yes|no)\s*([,}\]])/g, function (_, v, t) { return ": " + (v === "yes") + t; });
  try { if (window.renderResponsesTable) window.renderResponsesTable(ROH); } catch (e) {}
})();

/* --- Topics Manager ------------------------------------------------------------------------- */
(function () {
  var ROH = `{
    "instanceId": "INSTANCE_ID",
    "topics": [BUBBLE: RPC-Ergebnis]
  }`
    .replace(/:\s*([,}\]])/g, ": null$1")
    .replace(/:\s*(yes|no)\s*([,}\]])/g, function (_, v, t) { return ": " + (v === "yes") + t; });
  try { if (window.renderTopicsManager) window.renderTopicsManager(ROH); } catch (e) {}
})();


/* ══ 3. MARKEN ═══════════════════════════════════════════════════════════════════════════════ */

/* --- Brands Overview ------------------------------------------------------------------------
   ERSETZT die alte toArr/toNum-Konstruktion. Die baute mit eval() nach, was core laengst kann,
   und lieferte bei einem Lesefehler ein leeres Array -- also genau die Verwechslung von "leer"
   und "kaputt", die sie vermeiden sollte. */
(function () {
  var ROH = `{
    "instanceId": "INSTANCE_ID",
    "granularity": "day",
    "rows": [BUBBLE: Ergebnis des Marken-RPC],
    "series": [BUBBLE: Ergebnis des Serien-RPC],
    "companies": [BUBBLE: Markenliste],
    "totalCount":
  }`
    .replace(/:\s*([,}\]])/g, ": null$1")
    .replace(/:\s*(yes|no)\s*([,}\]])/g, function (_, v, t) { return ": " + (v === "yes") + t; });
  try { if (window.renderBrandsOverview) window.renderBrandsOverview(ROH); } catch (e) {}
  try { if (window.setBrandsOverviewLoading) window.setBrandsOverviewLoading("INSTANCE_ID", "no"); } catch (e) {}
})();

/* --- Brand Detail ---------------------------------------------------------------------------
   Zwei RPCs, also ZWEI Backticks und zwei try. Nicht zusammenfassen: eine Zeichenkette fuer zwei
   Antworten ist wieder eine Stelle, an der beides zugleich kippt. */
(function () {
  var COMPANY = `[{
    "company_id": "BUBBLE",
    "name": "BUBBLE",
    "logo_url": "BUBBLE",
    "domain": "BUBBLE",
    "avg_visibility_pct": , "avg_visibility_prev_pct": ,
    "avg_rank": , "avg_rank_prev": , "avg_rank_delta": ,
    "avg_sentiment": , "avg_sentiment_prev": , "avg_sentiment_delta": ,
    "total_runs_now": , "mentions_now":
  }]`
    .replace(/:\s*([,}\]])/g, ": null$1")
    .replace(/:\s*(yes|no)\s*([,}\]])/g, function (_, v, t) { return ": " + (v === "yes") + t; });

  var SERIES = `{
    "mode": "visibility",
    "series": [BUBBLE: Ergebnis des Serien-RPC],
    "granularity": "day"
  }`
    .replace(/:\s*([,}\]])/g, ": null$1")
    .replace(/:\s*(yes|no)\s*([,}\]])/g, function (_, v, t) { return ": " + (v === "yes") + t; });

  try { if (window.setBrandDetailCompany) window.setBrandDetailCompany("INSTANCE_ID", COMPANY); } catch (e) {}
  try { if (window.setBrandDetailSeries)  window.setBrandDetailSeries("INSTANCE_ID", SERIES); } catch (e) {}
})();

/* --- Discover Brands ------------------------------------------------------------------------ */
(function () {
  var ROH = `{
    "instanceId": "INSTANCE_ID",
    "rows": [BUBBLE: RPC-Ergebnis],
    "total_responses":
  }`
    .replace(/:\s*([,}\]])/g, ": null$1")
    .replace(/:\s*(yes|no)\s*([,}\]])/g, function (_, v, t) { return ": " + (v === "yes") + t; });
  try { if (window.renderDiscoverBrands) window.renderDiscoverBrands(ROH); } catch (e) {}
})();


/* ══ 4. PERFORMANCE ══════════════════════════════════════════════════════════════════════════ */

/* --- Performance Radar -----------------------------------------------------------------------
   ERSETZT die JSON.parse-Fassung. JSON.parse wirft an allem, was Bubble ausser leeren Werten und
   yes/no noch verbiegt -- ein nacktes Emoji in einem Themennamen genuegt. */
(function () {
  var ROH = `{
    "instanceId": "INSTANCE_ID",
    "cells": [BUBBLE: RPC-Ergebnis]
  }`
    .replace(/:\s*([,}\]])/g, ": null$1")
    .replace(/:\s*(yes|no)\s*([,}\]])/g, function (_, v, t) { return ": " + (v === "yes") + t; });
  try { if (window.renderPerformanceRadar) window.renderPerformanceRadar(ROH); } catch (e) {}
  try { if (window.setPerformanceRadarLoading) window.setPerformanceRadarLoading("INSTANCE_ID", "no"); } catch (e) {}
})();

/* --- Performance Detail ---------------------------------------------------------------------- */
(function () {
  var AUSWAHL = `{
    "instanceId": "INSTANCE_ID",
    "company": {BUBBLE: die Zeile der Marke},
    "topic": {BUBBLE: die Zeile des Themas},
    "cell": {BUBBLE: die Zeile der Zelle},
    "topic_column": [BUBBLE: alle Marken zu diesem Thema],
    "brand_row": [BUBBLE: alle Themen dieser Marke]
  }`
    .replace(/:\s*([,}\]])/g, ": null$1")
    .replace(/:\s*(yes|no)\s*([,}\]])/g, function (_, v, t) { return ": " + (v === "yes") + t; });

  var SERIEN = `{
    "topic": [BUBBLE: Serie fuer dieses Thema],
    "global": [BUBBLE: Serie ueber alle Themen]
  }`
    .replace(/:\s*([,}\]])/g, ": null$1")
    .replace(/:\s*(yes|no)\s*([,}\]])/g, function (_, v, t) { return ": " + (v === "yes") + t; });

  try { if (window.renderPerformanceDetail)      window.renderPerformanceDetail(AUSWAHL); } catch (e) {}
  try { if (window.setPerformanceDetailSeries)   window.setPerformanceDetailSeries("INSTANCE_ID", SERIEN); } catch (e) {}
  try { if (window.setPerformanceDetailLoading)  window.setPerformanceDetailLoading("INSTANCE_ID", "no"); } catch (e) {}
})();


/* ══ 5. DETAILSEITEN ═════════════════════════════════════════════════════════════════════════
   Hier steht die instanceId im ERSTEN ARGUMENT, nicht im Payload. */

/* --- URL Detail ------------------------------------------------------------------------------ */
(function () {
  var SEITE = `{
    "url": "BUBBLE",
    "domain": "BUBBLE",
    "title": "BUBBLE",
    "mentions": , "citations":
  }`
    .replace(/:\s*([,}\]])/g, ": null$1")
    .replace(/:\s*(yes|no)\s*([,}\]])/g, function (_, v, t) { return ": " + (v === "yes") + t; });

  var ZUSAMMENFASSUNG = `{
    "markdown_summary": "BUBBLE"
  }`
    .replace(/:\s*([,}\]])/g, ": null$1")
    .replace(/:\s*(yes|no)\s*([,}\]])/g, function (_, v, t) { return ": " + (v === "yes") + t; });

  try { if (window.setUrlDetail)        window.setUrlDetail("INSTANCE_ID", SEITE); } catch (e) {}
  try { if (window.setUrlDetailSummary) window.setUrlDetailSummary("INSTANCE_ID", ZUSAMMENFASSUNG); } catch (e) {}
})();

/* --- Domain Detail --------------------------------------------------------------------------- */
(function () {
  var ROH = `{
    "header": {BUBBLE: Kopfzeile der Domain},
    "timeseries": {BUBBLE: die Serien},
    "funnel": {BUBBLE: der Funnel},
    "types": [BUBBLE: Zitationstypen]
  }`
    .replace(/:\s*([,}\]])/g, ": null$1")
    .replace(/:\s*(yes|no)\s*([,}\]])/g, function (_, v, t) { return ": " + (v === "yes") + t; });
  try { if (window.setDomainDetail) window.setDomainDetail("INSTANCE_ID", ROH); } catch (e) {}
})();

/* --- Response Detail -------------------------------------------------------------------------- */
(function () {
  var ROH = `{
    "response_id": "BUBBLE",
    "prompt_text": "BUBBLE",
    "model": "BUBBLE",
    "answer_markdown": "BUBBLE",
    "mentions": [BUBBLE: Markennennungen],
    "citations": [BUBBLE: Zitate]
  }`
    .replace(/:\s*([,}\]])/g, ": null$1")
    .replace(/:\s*(yes|no)\s*([,}\]])/g, function (_, v, t) { return ": " + (v === "yes") + t; });
  try { if (window.setResponseDetail) window.setResponseDetail("INSTANCE_ID", ROH); } catch (e) {}
})();


/* ══ 6. EINSTELLUNGEN UND SEITENWEITE LISTEN ═════════════════════════════════════════════════ */

/* --- Settings: Your Brand --------------------------------------------------------------------- */
(function () {
  var ROH = `{
    "instanceId": "INSTANCE_ID",
    "brand": {BUBBLE: Marke},
    "team": {BUBBLE: Team},
    "models": [BUBBLE: Modellzeilen]
  }`
    .replace(/:\s*([,}\]])/g, ": null$1")
    .replace(/:\s*(yes|no)\s*([,}\]])/g, function (_, v, t) { return ": " + (v === "yes") + t; });
  try { if (window.renderSettingsBrand)   window.renderSettingsBrand(ROH); } catch (e) {}
  try { if (window.setSettingsBrandLoading) window.setSettingsBrandLoading("INSTANCE_ID", "no"); } catch (e) {}
})();

/* --- Seitenweite Listen ------------------------------------------------------------------------
   Ein Aufruf pro SEITE, nicht pro Platzierung -- jede Komponente mit einer Marken-, Themen- oder
   Marktauswahl zieht daraus. Diese Setter haben noch KEINEN Lesefehler-Zustand: ein unlesbarer
   Payload landet als leere Liste. Der Backtick ist hier die einzige Absicherung. */
(function () {
  var MARKEN = `[BUBBLE: Markenliste]`
    .replace(/:\s*([,}\]])/g, ": null$1")
    .replace(/:\s*(yes|no)\s*([,}\]])/g, function (_, v, t) { return ": " + (v === "yes") + t; });

  var THEMEN = `[BUBBLE: Themenliste]`
    .replace(/:\s*([,}\]])/g, ": null$1")
    .replace(/:\s*(yes|no)\s*([,}\]])/g, function (_, v, t) { return ": " + (v === "yes") + t; });

  var MAERKTE = `[BUBBLE: Marktliste]`
    .replace(/:\s*([,}\]])/g, ": null$1")
    .replace(/:\s*(yes|no)\s*([,}\]])/g, function (_, v, t) { return ": " + (v === "yes") + t; });

  try { if (window.setUpstreemBrands)  window.setUpstreemBrands(MARKEN); } catch (e) {}
  try { if (window.setUpstreemTopics)  window.setUpstreemTopics(THEMEN); } catch (e) {}
  try { if (window.setUpstreemMarkets) window.setUpstreemMarkets(MAERKTE); } catch (e) {}
})();

/* --- Notifications ------------------------------------------------------------------------------ */
(function () {
  var ROH = `[BUBBLE: RPC-Ergebnis der Benachrichtigungen]`
    .replace(/:\s*([,}\]])/g, ": null$1")
    .replace(/:\s*(yes|no)\s*([,}\]])/g, function (_, v, t) { return ": " + (v === "yes") + t; });
  try { if (window.setUpstreemNotifications) window.setUpstreemNotifications("INSTANCE_ID", ROH); } catch (e) {}
})();

/* --- Opportunities -------------------------------------------------------------------------------- */
(function () {
  var ROH = `[BUBBLE: RPC-Ergebnis]`
    .replace(/:\s*([,}\]])/g, ": null$1")
    .replace(/:\s*(yes|no)\s*([,}\]])/g, function (_, v, t) { return ": " + (v === "yes") + t; });
  try { if (window.opportunitiesSetItems) window.opportunitiesSetItems(ROH); } catch (e) {}
})();

/* --- Export-Dialog ---------------------------------------------------------------------------------
   upstreemExportSetContext nimmt seit dem 24.08. auch rohen Text -- vorher ging nur ein Objekt,
   und damit war dieser Schritt zwangslaeufig die riskante Bauart. */
(function () {
  var ROH = `{
    "export_type": "BUBBLE",
    "export_accesstoken": "BUBBLE"
  }`
    .replace(/:\s*([,}\]])/g, ": null$1")
    .replace(/:\s*(yes|no)\s*([,}\]])/g, function (_, v, t) { return ": " + (v === "yes") + t; });
  try { if (window.upstreemExportSetContext) window.upstreemExportSetContext("INSTANCE_ID", ROH); } catch (e) {}
})();

/* --- Create With AI ---------------------------------------------------------------------------------
   setYouUrls warf vorher an jedem Titel mit Anfuehrungszeichen, Umlaut oder Emoji und lieferte
   still eine leere Liste -- der Baukasten sagte dann "No pages found". */
(function () {
  var KONTEXT = `{
    "url": "BUBBLE",
    "citation_type": "BUBBLE",
    "lead_title": "BUBBLE",
    "lead_domain": "BUBBLE",
    "own_brand_name": "BUBBLE",
    "own_brand_summary": "BUBBLE"
  }`
    .replace(/:\s*([,}\]])/g, ": null$1")
    .replace(/:\s*(yes|no)\s*([,}\]])/g, function (_, v, t) { return ": " + (v === "yes") + t; });

  var QUELLEN = `[BUBBLE: Liste der Seiten]`
    .replace(/:\s*([,}\]])/g, ": null$1")
    .replace(/:\s*(yes|no)\s*([,}\]])/g, function (_, v, t) { return ": " + (v === "yes") + t; });

  try { if (window.createWithAiSetContext)  window.createWithAiSetContext("INSTANCE_ID", KONTEXT); } catch (e) {}
  try { if (window.createWithAiSetYouUrls)  window.createWithAiSetYouUrls("INSTANCE_ID", QUELLEN); } catch (e) {}
})();
