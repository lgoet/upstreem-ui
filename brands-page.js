/* upstreem brands-page.js -- die Seite Brands als EINE Komponente (11.10.). Praefix ubr.

   Kopf mit Krumen und zwei Reitern (Tracked, Discover), oben rechts "Add Brand" und Aktualisieren,
   darunter Kalender und Filter, dann der Inhalt des Reiters. Die Inhalte sind die ECHTEN Bausteine
   der App im lokalen Modus (brands-overview.js, discover-brands.js): ihr Markup kommt aus den
   Bubble-Vorlagen (.brands_markup.py), ihre Ereignisse kommen als DOM-Ereignis hierher statt an
   Bubble, und diese Seite fuellt sie ueber ihre eigenen Setter. Dieselben Bausteine an anderen
   Orten (ohne data-local) arbeiten unveraendert weiter ueber Bubble.

   DATEN: direkt ueber UC.rpc (PostgREST, Nutzer-JWT). Anfragen und Antwortformen in brands-data.js
   (ohne DOM). Tracked (Chart und Tabelle) laeuft LIVE ueber den Dashboard-Vertrag v1 -- dieselben
   Zahlen wie auf dem Dashboard. Inaktive Marken, Aktivieren/Deaktivieren, Loeschen, Anlegen und
   Discover folgen dem Vertrag Brands v1 (bubble/brands_v1_vertrag.md, Abschnitt 11 ist der gebaute
   Stand), geprueft gegen testdaten/brands_v1/antworten.json.

   FILTER: der Kalender gilt app-weit, Models, Markets und Topics fuer Tracked UND Discover (die
   Discover-Funktion kennt alle vier, Vertrag 6.1).

   ADRESSE: ?br=discover (Tracked ist die Vorgabe und steht nicht drin).
   Zeilen oeffnen den Marken-Drawer der App (brand mit company_id), "Edit" den Marken-Editor. */
(function () {
  "use strict";

  var API_NAMES = ["resetBrandsPage"];
  var Q = (window.__ubrBootQueue = window.__ubrBootQueue || []);
  API_NAMES.forEach(function (n) {
    if (!window[n]) window[n] = function () { Q.push([n, [].slice.call(arguments)]); };
  });

  function ubrBoot(triesLeft) {
    if (!window.UpstreemCore || !window.UpstreemBrandsDaten || !window.UpstreemCitationsDaten || !window.UpstreemDashboardDaten) {
      if (triesLeft > 0) { setTimeout(function () { ubrBoot(triesLeft - 1); }, 100); return; }
      if (window.console) console.error("[brands-page] core.js, brands-data.js, citations-data.js oder dashboard-data.js nicht geladen");
      return;
    }
    ubrStart();
  }

  /* ---- MARKUP ANFANG (erzeugt von .brands_markup.py -- nicht von Hand aendern) ---- */
  var MARKUP = {
    ubo: "<div class=\"up-root ubo-root\" data-local=\"yes\" data-flach=\"yes\" data-leiste=\"yes\" data-instance=\"__UBR_UBO__\" data-cdn-pin=\"\" data-isdark=\"__UBR_DARK__\" data-export-instance=\"\" data-processing=\"no\" data-processing2=\"no\"><div class=\"ubo-unit\"><div class=\"ubo-head\"><div class=\"ubo-heading\">Visibility over Time</div><div class=\"ubo-head-tools\"><div class=\"vc-gran\" role=\"tablist\" aria-label=\"Granularity\"><button class=\"vc-gran-btn is-active\" data-gran=\"day\" type=\"button\" role=\"tab\" data-tip=\"Day\" aria-label=\"Day\">D</button><button class=\"vc-gran-btn\" data-gran=\"week\" type=\"button\" role=\"tab\" data-tip=\"Week\" aria-label=\"Week\">W</button><button class=\"vc-gran-btn\" data-gran=\"month\" type=\"button\" role=\"tab\" data-tip=\"Month\" aria-label=\"Month\">M</button></div><div class=\"ubo-filter\"><button class=\"ubo-filter-btn ubo-iconbtn\" type=\"button\" data-tip=\"Filter brands\" aria-label=\"Filter brands\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M7 21L7 18\"/><path d=\"M17 21L17 15\"/><path d=\"M17 6L17 3\"/><path d=\"M7 9L7 3\"/><path d=\"M7 18C6.06812 18 5.60218 18 5.23463 17.8478C4.74458 17.6448 4.35523 17.2554 4.15224 16.7654C4 16.3978 4 15.9319 4 15C4 14.0681 4 13.6022 4.15224 13.2346C4.35523 12.7446 4.74458 12.3552 5.23463 12.1522C5.60218 12 6.06812 12 7 12C7.93188 12 8.39782 12 8.76537 12.1522C9.25542 12.3552 9.64477 12.7446 9.84776 13.2346C10 13.6022 10 14.0681 10 15C10 15.9319 10 16.3978 9.84776 16.7654C9.64477 17.2554 9.25542 17.6448 8.76537 17.8478C8.39782 18 7.93188 18 7 18Z\"/><path d=\"M17 12C16.0681 12 15.6022 12 15.2346 11.8478C14.7446 11.6448 14.3552 11.2554 14.1522 10.7654C14 10.3978 14 9.93188 14 9C14 8.06812 14 7.60218 14.1522 7.23463C14.3552 6.74458 14.7446 6.35523 15.2346 6.15224C15.6022 6 16.0681 6 17 6C17.9319 6 18.3978 6 18.7654 6.15224C19.2554 6.35523 19.6448 6.74458 19.8478 7.23463C20 7.60218 20 8.06812 20 9C20 9.93188 20 10.3978 19.8478 10.7654C19.6448 11.2554 19.2554 11.6448 18.7654 11.8478C18.3978 12 17.9319 12 17 12Z\"/></svg><span class=\"ubo-filter-badge\"></span></button><div class=\"up-ment-menu\" role=\"menu\" aria-hidden=\"true\"></div></div><div class=\"ubo-yaxis\" role=\"tablist\" aria-label=\"Y axis\"><button class=\"ubo-yaxis-btn is-active\" data-yaxis=\"sentiment\" type=\"button\" role=\"tab\">Sentiment</button><button class=\"ubo-yaxis-btn\" data-yaxis=\"ranking\" type=\"button\" role=\"tab\">Ranking</button></div><div class=\"ubo-seg\" role=\"tablist\" aria-label=\"Chart type\"><button class=\"ubo-seg-btn is-active\" data-chartmode=\"line\" type=\"button\" role=\"tab\">Linechart </button><button class=\"ubo-seg-btn\" data-chartmode=\"landscape\" type=\"button\" role=\"tab\">Landscape </button></div><button class=\"ubo-hide ubo-iconbtn\" type=\"button\" data-tip=\"Hide\" aria-label=\"Hide\"><svg class=\"ic-hide\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M2 8C2 8 6.47715 3 12 3C17.5228 3 22 8 22 8\"/><path d=\"M21.544 13.045C21.848 13.4713 22 13.6845 22 14C22 14.3155 21.848 14.5287 21.544 14.955C20.1779 16.8706 16.6892 21 12 21C7.31078 21 3.8221 16.8706 2.45604 14.955C2.15201 14.5287 2 14.3155 2 14C2 13.6845 2.15201 13.4713 2.45604 13.045C3.8221 11.1294 7.31078 7 12 7C16.6892 7 20.1779 11.1294 21.544 13.045Z\"/><path d=\"M15 14C15 12.3431 13.6569 11 12 11C10.3431 11 9 12.3431 9 14C9 15.6569 10.3431 17 12 17C13.6569 17 15 15.6569 15 14Z\"/></svg><svg class=\"ic-show\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M6.43385 6.51953C4.22009 7.89049 2.93281 9.86457 2.31858 11.0339C2.10621 11.4382 2.00003 11.6403 2 12.0082C1.99997 12.3761 2.10584 12.5777 2.3176 12.981C3.32862 14.9066 6.16702 19.0195 11.9669 19.0195C14.2454 19.0195 16.0669 18.3848 17.5 17.4972\"/><path d=\"M9.87868 9.87868C9.33579 10.4216 9 11.1716 9 12C9 13.6569 10.3431 15 12 15C12.8284 15 13.5784 14.6642 14.1213 14.1213\"/><path d=\"M2 2L22 22\"/><path d=\"M10 5.14847C10.5934 5.05255 11.224 5 11.8936 5C17.7747 5 20.6528 9.05385 21.6779 10.9517C21.8927 11.3492 22 11.548 22 11.9106C22 12.2733 21.8921 12.4727 21.6765 12.8717C21.3678 13.4428 20.8916 14.2085 20.2167 15\"/></svg></button></div></div><div class=\"ubo-box ubo-box-chart\"><div class=\"ubo-panel-body\"><button class=\"ubo-scale-btn\" type=\"button\" data-tip=\"Chart Settings\" aria-label=\"Chart Settings\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M2.5 12C2.5 7.52166 2.5 5.28249 3.89124 3.89124C5.28249 2.5 7.52166 2.5 12 2.5C16.4783 2.5 18.7175 2.5 20.1088 3.89124C21.5 5.28249 21.5 7.52166 21.5 12C21.5 16.4783 21.5 18.7175 20.1088 20.1088C18.7175 21.5 16.4783 21.5 12 21.5C7.52166 21.5 5.28249 21.5 3.89124 20.1088C2.5 18.7175 2.5 16.4783 2.5 12Z\"/><path d=\"M8.5 10C7.67157 10 7 9.32843 7 8.5C7 7.67157 7.67157 7 8.5 7C9.32843 7 10 7.67157 10 8.5C10 9.32843 9.32843 10 8.5 10Z\"/><path d=\"M15.5 17C16.3284 17 17 16.3284 17 15.5C17 14.6716 16.3284 14 15.5 14C14.6716 14 14 14.6716 14 15.5C14 16.3284 14.6716 17 15.5 17Z\"/><path d=\"M10 8.5L17 8.5\"/><path d=\"M14 15.5L7 15.5\"/></svg></button><div class=\"ubo-line-holder\"><div class=\"up-line-wrap\"><canvas class=\"up-line-canvas\"></canvas></div><div class=\"up-legend\"></div></div><div class=\"ubo-mx-holder\"><div class=\"ubo-mx\"><div class=\"ubo-mx-legend-y\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"12\" r=\"10\"></circle><path d=\"M8 14s1.5 2 4 2 4-2 4-2\"></path><path d=\"M9 9h.01\"></path><path d=\"M15 9h.01\"></path></svg><span>Sentiment</span></div><div class=\"ubo-mx-wrap\"><canvas class=\"ubo-mx-canvas\"></canvas></div><div class=\"ubo-mx-spacer\"></div><div class=\"ubo-mx-legend-x\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M3 17L7 13C7.88256 12.1174 8.32385 11.6762 8.86543 11.6274C8.95496 11.6193 9.04504 11.6193 9.13457 11.6274C9.67615 11.6762 10.1174 12.1174 11 13C11.8826 13.8826 12.3238 14.3238 12.8654 14.3726C12.955 14.3807 13.045 14.3807 13.1346 14.3726C13.6762 14.3238 14.1174 13.8826 15 13L20 8\"/><path d=\"M16 7.27657C16 7.27657 20.101 6.65426 20.7234 7.27661C21.3458 7.89896 20.7234 12 20.7234 12\"/></svg><span>Visibility</span></div></div></div></div></div></div><div class=\"ubo-unit\"><div class=\"ubo-head\"><div class=\"ubo-seg\" role=\"tablist\" aria-label=\"Brand status\"><button class=\"ubo-seg-btn is-active\" data-status=\"active\" type=\"button\" role=\"tab\">Active<span class=\"ubo-seg-n\"></span></button><button class=\"ubo-seg-btn\" data-status=\"inactive\" type=\"button\" role=\"tab\">Inactive<span class=\"ubo-seg-n\"></span></button></div><div class=\"ubo-head-tools\"><div class=\"ubo-sort\"><button class=\"ubo-sort-btn ubo-iconbtn\" type=\"button\" data-tip=\"Sort\" aria-label=\"Sort\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m3 16 4 4 4-4\"/><path d=\"M7 20V4\"/><path d=\"m21 8-4-4-4 4\"/><path d=\"M17 4v16\"/></svg></button><div class=\"up-sort-menu\" role=\"menu\" aria-hidden=\"true\"></div></div><div class=\"up-search\"><button class=\"up-search-btn ubo-iconbtn\" type=\"button\" data-tip=\"Search\" aria-label=\"Search\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M17 17L21 21\"/><path d=\"M19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19C15.4183 19 19 15.4183 19 11Z\"/></svg></button><div class=\"up-search-box\"><input class=\"up-search-input\" type=\"text\" placeholder=\"Search brands...\" autocomplete=\"off\" spellcheck=\"false\" aria-label=\"Search brands\"/><button class=\"up-search-clear\" type=\"button\" aria-label=\"Clear search\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 6L6.00081 17.9992M17.9992 18L6 6.00085\"/></svg></button></div></div><div class=\"ubo-cols\"><button class=\"ubo-cols-btn ubo-iconbtn\" type=\"button\" data-tip=\"Table Settings\" aria-label=\"Table settings\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M2.5 12C2.5 7.52166 2.5 5.28249 3.89124 3.89124C5.28249 2.5 7.52166 2.5 12 2.5C16.4783 2.5 18.7175 2.5 20.1088 3.89124C21.5 5.28249 21.5 7.52166 21.5 12C21.5 16.4783 21.5 18.7175 20.1088 20.1088C18.7175 21.5 16.4783 21.5 12 21.5C7.52166 21.5 5.28249 21.5 3.89124 20.1088C2.5 18.7175 2.5 16.4783 2.5 12Z\"/><path d=\"M8.5 10C7.67157 10 7 9.32843 7 8.5C7 7.67157 7.67157 7 8.5 7C9.32843 7 10 7.67157 10 8.5C10 9.32843 9.32843 10 8.5 10Z\"/><path d=\"M15.5 17C16.3284 17 17 16.3284 17 15.5C17 14.6716 16.3284 14 15.5 14C14.6716 14 14 14.6716 14 15.5C14 16.3284 14.6716 17 15.5 17Z\"/><path d=\"M10 8.5L17 8.5\"/><path d=\"M14 15.5L7 15.5\"/></svg><span class=\"ubo-cols-badge\"></span></button><div class=\"up-cols-menu\" role=\"menu\" aria-hidden=\"true\"></div></div><button class=\"up-export\" type=\"button\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M12 15V3\" /><path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\" /><path d=\"m7 10 5 5 5-5\" /></svg><span>Export</span></button></div></div><div class=\"ubo-box\"><div class=\"up-table ubo-table\"></div></div></div></div>",
    udb: "<div class=\"up-root udb-root\" data-local=\"yes\" data-instance=\"__UBR_UDB__\" data-cdn-pin=\"\" data-isdark=\"__UBR_DARK__\" data-sticky-top=\"16\"></div>"
  };
  /* ---- MARKUP ENDE ---- */

  function ubrStart() {
  var UC = window.UpstreemCore, D = window.UpstreemBrandsDaten;
  var esc = UC.esc, t = UC.t || function (x) { return x; };
  var STORE = (window.__ubrStore = window.__ubrStore || {});
  var LADER = (window.__ubrLader = window.__ubrLader || {});

  function isArr(v) { return Object.prototype.toString.call(v) === "[object Array]"; }
  function str(v) { return v == null || typeof v === "object" ? "" : String(v); }
  function liste(s) { return String(s || "").split(",").map(function (x) { return x.trim(); }).filter(Boolean); }
  function team() { try { return (UC.getTeam && UC.getTeam()) || ""; } catch (e) { return ""; } }
  function beiSicht(el, schluessel, fn, test, o) { if (UC.beiSicht) UC.beiSicht(el, schluessel, fn, test, o); else fn(); }
  function messbar(el) { return !UC.messbar || UC.messbar(el); }
  function setter(name) { return typeof window[name] === "function" ? window[name] : function () {}; }
  function toast(text, art, desc) { if (UC.toast) UC.toast(text, { kind: art || "success", desc: desc || "" }); }
  /* Der Wert eines lokalen Ereignisses: brands-overview schickt { value }, discover-brands das
     Objekt selbst (makeFire). */
  function wert(d) { return d && typeof d === "object" && "value" in d ? d.value : d; }
  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  /* Die Reiter wie im bisherigen Seitenkopf (brands-page-header.js). Die Zeichen setzt
     UC.makePageNav ueber den Wert (NAV_ZEICHEN: tracked, discover). */
  var REITER = [
    { value: "tracked", label: "Tracked", icon: "" },
    { value: "discover", label: "Discover", icon: "" }
  ];
  var REFRESH_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /> <path d="M21 3v5h-5" /> <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /> <path d="M8 16H3v5" /></svg>';
  var PLUS_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14" /> <path d="M12 5v14" /></svg>';
  /* Sortierschluessel von brands-overview (Feld + Richtung) -> p_order des Overview-Vertrags. */
  var SORT_OUT = { visibility: "visibility", ranking: "rank", sentiment: "sentiment" };
  var ORDER_OK = ["visibility_desc", "visibility_asc", "rank_asc", "rank_desc", "sentiment_desc", "sentiment_asc"];

  /* ---- Fehler als Satz fuer den Nutzer ----------------------------------------------------------
     Je stabiler message des Vorschlags ein Satz, der sagt, was passiert ist und was man tun kann.
     Keine internen Namen (Regel der App). Die messages stehen im Auftrag (Abschnitt 1.6, 4.3); was
     der Vertrag anders nennt, wird hier nachgezogen. */
  function fehlerSatz(erg, wobei) {
    var m = D.meldung(erg), n = D.hinweisZahl(erg), h = D.hinweis(erg);
    /* Tagesgrenzen (Vertrag 6.6, 10.5): hint "tracked:<Rest>", "deactivations:<Rest>" bzw. fuers
       Loeschen. Bei 0 Rest kein "0 more". */
    if (/daily_limit/.test(m)) {
      if (/^tracked:/.test(h) && n) return { text: t("Daily limit reached"), desc: t("You can add or activate {n} more brands today.").replace("{n}", String(n)) };
      return { text: t("Daily limit reached"), desc: t("Please try again tomorrow.") };
    }
    /* Nach dem Loeschen raeumt die DB noch einige Minuten auf (10.5): solange geht dieselbe Marke
       nicht wieder anzulegen. */
    if (/delete_pending/.test(m)) return { text: t("This brand is still being removed"), desc: t("Please try again in a few minutes.") };
    if (/logo_own_only/.test(m)) return { text: t("Only your own brand can have a logo"), desc: "" };
    if (/inactive:/.test(h) && /limit_reached/.test(m)) return { text: t("Too many inactive brands"), desc: t("Delete inactive brands you no longer need, then try again.") };
    if (/limit_reached/.test(m)) {
      return { text: t("Not enough room in your plan"),
               desc: n ? t("{n} more brands fit into your plan.").replace("{n}", String(n)) : t("Set brands inactive or upgrade your plan.") };
    }
    if (/duplicate/.test(m)) return { text: t("This brand is already in your account"), desc: "" };
    /* brands_forbidden = Rolle (nur Loeschen); "forbidden" ohne Praefix = fremdes Team
       (require_team_access, Vertrag 11.3) -- zwei verschiedene Saetze. */
    if (/^brands_forbidden$/.test(m)) return { text: t("Only owners and admins can delete brands"), desc: "" };
    if (/forbidden/.test(m)) return { text: t("You don't have permission for this"), desc: t("Refresh the page and try again.") };
    if (/own_brand/.test(m)) return { text: t("Your own brand can't be set inactive"), desc: "" };
    if (/invalid_date/.test(m)) return { text: t("Please pick a shorter date range"), desc: "" };
    if (/invalid_param/.test(m) && /^p_name/.test(h)) return { text: t("Use 1 to 75 characters, with at least one letter or digit."), desc: "" };
    if (/invalid_param/.test(m) && /^p_domain/.test(h)) return { text: t("Enter a valid domain, for example apple.com"), desc: "" };
    if (/invalid_param/.test(m)) return { text: t("Please check the name and domain"), desc: "" };
    /* Ratengrenze an message (Status nur zusaetzlich), die Wartezeit aus hint in Sekunden (core). */
    if (/rate_limited/.test(m) || (erg && erg.status === 429)) return { text: t("Too many requests"), desc: UC.warteSatz ? UC.warteSatz(erg, t("Please wait a moment and try again.")) : t("Please wait a moment and try again.") };
    /* team_access_*: bis befunde_db_v1.sql HTTP 500, danach 402 -- an message, wie in Settings. */
    if (/^team_access_/.test(m)) return { text: t("This team has no active plan"), desc: t("Choose a plan in Billing to continue.") };
    if (/not_found/.test(m)) return { text: t("This brand no longer exists"), desc: t("Refresh the page and try again.") };
    return { text: wobei || t("That didn't work"), desc: t("Please try again.") };
  }
  function fehlerToast(erg, wobei) { var f = fehlerSatz(erg, wobei); toast(f.text, "error", f.desc); }
  /* Was noch nicht gebaut ist (D.VORSCHLAG), sagt es -- nie ein Knopf, der still nichts tut. */
  function nochNicht() { toast(t("This isn't available yet"), "neutral", t("It comes with the next update of this page.")); }

  function initRoot(root) {
    if (root.__ubrCtrl) return root.__ubrCtrl;
    var instanceId = str(root.getAttribute("data-instance")).trim() || "brands_page";
    if (instanceId === "INSTANCE_ID") return null;
    var gem = STORE[instanceId] || {};
    var ohneAdresse = root.getAttribute("data-adresse") === "aus";

    var ids = {
      daten: instanceId + "_dates", filter: instanceId + "_filters", modelle: instanceId + "_models",
      maerkte: instanceId + "_markets", topics: instanceId + "_topics",
      ubo: instanceId + "_overview", udb: instanceId + "_discover"
    };
    /* Was brands-overview sich selbst gemerkt hat (Neuaufbau), gilt -- sonst fragte die Seite in
       einer anderen Sortierung oder Granularitaet, als der Baustein anzeigt. */
    function uboVorgabe() {
      var s = (window.__uboSort || {})[ids.ubo] || {}, g = (window.__uboGran || {})[ids.ubo];
      var o = (SORT_OUT[s.field] || "visibility") + "_" + (s.dir === "asc" ? "asc" : "desc");
      return { order: ORDER_OK.indexOf(o) >= 0 ? o : "visibility_desc", gran: g === "week" || g === "month" ? g : "day" };
    }
    var vorgabe = uboVorgabe();
    var state = {
      tab: "tracked",
      f: gem.f || { von: "", bis: "", modelle: null, maerkte: null, topics: null, tagmode: "or" },
      order: gem.order || vorgabe.order,
      gran: gem.gran || vorgabe.gran,
      firmen: gem.firmen || null,
      autoFirmen: gem.autoFirmen || [],
      disc: gem.disc || { matched: true },
      meta: gem.meta || null,
      kalenderDa: false
    };
    state.tab = adresseLesen() || gem.tab || "tracked";
    function persist() {
      STORE[instanceId] = { tab: state.tab, f: state.f, order: state.order, gran: state.gran, firmen: state.firmen,
                            autoFirmen: state.autoFirmen, disc: state.disc, meta: state.meta };
    }
    /* Der Lader lebt am Fenster je Instanz (wie auf den anderen Seiten): ein Neuaufbau beim
       Themenwechsel holt nichts neu, was schon da ist. */
    var lader = LADER[instanceId] || (LADER[instanceId] = D.makeLader({ rufen: function (fn, params, o) { return UC.rpc(fn, params, { signal: o && o.signal, timeoutMs: 30000 }); } }));
    /* Schreiben: XX000 einmal wiederholen (Regel der Seiten-Vertraege), nur was die DB als
       Serverfehler meldet -- ein Grenzen- oder Rechtefehler bleibt, was er ist (wie prompts-page). */
    function schreiben(a) {
      function ruf() { return UC.rpc(a.fn, a.params, { timeoutMs: 30000 }); }
      return ruf().then(function (erg) {
        var c = erg && erg.fehler ? str(erg.fehler.code) : "";
        if (erg && !erg.ok && c === "XX000") return new Promise(function (w) { setTimeout(w, 800); }).then(ruf);
        return erg;
      });
    }

    function isDark() { return (UC.themeParam && UC.themeParam(root.getAttribute("data-isdark"))) || root.getAttribute("data-theme") === "dark"; }
    function einsetzen(m) {
      return String(m || "")
        .split("__UBR_DARK__").join(isDark() ? "yes" : "no")
        .split("__UBR_UBO__").join(esc(ids.ubo))
        .split("__UBR_UDB__").join(esc(ids.udb));
    }
    var dk = isDark() ? "yes" : "no";
    root.innerHTML =
      '<div class="up-ph-top ubr-pagehead">' +
        '<div class="up-ph-left"><h1 class="up-ph-heading">' + esc(t("Brands")) + '</h1>' +
          '<p class="up-ph-desc">' + esc(t("Manage tracked brands, compare performance, and discover untracked competitors")) + '</p></div>' +
        '<div class="ubr-tools">' +
          /* Derselbe Knopf wie im bisherigen Kopf, Etikett ENGLISCH als ganzer Satz (core baut die
             deutsche Fassung daraus, knopfEtikett -- Stueckweise kam "Hinzufuegen Prompts" heraus). */
          '<button class="up-ph-addbtn up-export ubr-add" type="button" aria-label="' + esc(t("Add Brand")) + '">' + PLUS_SVG +
            '<span>Add <span class="up-ph-addbtn-full">Brand</span></span></button>' +
          '<button class="up-ph-iconbtn ubr-refresh" type="button" aria-label="' + esc(t("Refresh")) + '" data-tip="' + esc(t("Refresh Data")) + '">' + REFRESH_SVG + '</button>' +
        '</div>' +
      '</div>' +
      '<div class="up-ph-nav ubr-nav" role="tablist"></div>' +
      '<div class="ubr-filterzeile">' +
        '<div class="up-root udr-root ubr-daten" data-instance="' + esc(ids.daten) + '" data-local="yes" data-isdark="' + dk + '"></div>' +
        /* data-form="gross" (15.10.): die Filterzeile wie auf Prompt Insights -- im Menue "Filters"
           je Filter eine Zeile "Name ...... Wert", die Chips oeffnen beim Klick ihr Untermenue,
           gespeicherte Filter. Sie bleibt UEBER dem Chart (sie gilt fuer Chart und Tabelle) und
           fuer beide Reiter. Einen eigenen Filter der Tabelle gibt es hier nicht: die Markenauswahl
           des Charts waehlt nur, welche Linien er zeichnet -- die Tabelle zeigt immer alle
           Marken --, und bleibt darum im Kopf des Charts wie auf Citations. */
        '<div class="up-root ufb-root ubr-filterleiste" data-instance="' + esc(ids.filter) + '" data-topics-instance="' + esc(ids.topics) + '"' +
          ' data-models-instance="' + esc(ids.modelle) + '" data-markets-instance="' + esc(ids.maerkte) + '" data-form="gross" data-isdark="' + dk + '"></div>' +
        '<div class="up-root utf-root" data-instance="' + esc(ids.topics) + '" data-local="yes" data-isdark="' + dk + '"></div>' +
        '<div class="up-root umf-root" data-instance="' + esc(ids.modelle) + '" data-local="yes" data-isdark="' + dk + '"></div>' +
        '<div class="up-root umk-root" data-instance="' + esc(ids.maerkte) + '" data-local="yes" data-isdark="' + dk + '"></div>' +
      '</div>' +
      '<div class="ubr-main">' +
        '<div class="ubr-tab" data-ubr-tab="tracked">' + einsetzen(MARKUP.ubo) + '</div>' +
        '<div class="ubr-tab" data-ubr-tab="discover">' + einsetzen(MARKUP.udb) + '</div>' +
      '</div>';

    /* VARIANTE A DER LEINWAND "Citations Seitenaufbau" (16.10., fuer Citations und Tracked
       gewaehlt): die eine Leiste der Tabelle steht oben ueber dem Chart und klebt, links
       Active/Inactive, Kalender und Filter, rechts Sortierung, Suche, Display, Export; der
       Spaltenkopf klebt unter ihr, die Gesamtzeile unten, sobald die Tabelle den Bildschirm fuellt.
       Die Umstellung in der Wurzel macht brands-overview.js (core, UC.bandUnterLeiste), hier nur:
       klebender Fuss und Klebkante (16 wie jede Tabelle unter einem Kopf, der wegscrollt) vor dem
       Aufbau der Komponente, und die Filterzeile in die Leiste (filterzeileStellen). Discover hat
       keinen Chart: dort bleibt die Filterzeile ueber der Tabelle. */
    (function () {
      var u = root.querySelector(".ubo-root");
      if (!u) return;
      u.setAttribute("data-kleb-fuss", "yes");
      if (!u.getAttribute("data-sticky-top")) u.setAttribute("data-sticky-top", "16");
    })();
    var elFilterzeile = root.querySelector(".ubr-filterzeile");
    var elNav = root.querySelector(".ubr-nav"), elRefresh = root.querySelector(".ubr-refresh"), elAdd = root.querySelector(".ubr-add");
    function el(sel) { return root.querySelector(sel); }
    var nav = UC.makePageNav ? UC.makePageNav(root, {
      nav: elNav, storeKey: instanceId + "|ubr-nav", selected: state.tab,
      pages: REITER, onSelect: function (v) { reiterOeffnen(v, true); }
    }) : null;
    var krumen = UC.makePageCrumbs ? UC.makePageCrumbs(root, { icon: "squareStack", name: "Brands", quelle: elNav, komponente: true }) : null;
    /* Der Auftritt (core, makeAuftritt): Kopf sofort, der Inhalt erst mit Stylesheets und ersten
       Daten, dann in einem Zug. */
    var auftritt = UC.makeAuftritt ? UC.makeAuftritt(root, { kopf: ".ubr-pagehead, .ubr-nav, .ubr-filterzeile", inhalt: ".ubr-main > .ubr-tab" }) : null;
    /* Bis die Rolle bekannt ist (Seiten-Meta), bietet das Zeilenmenue kein Loeschen an. */
    (function () { var u = root.querySelector(".ubo-root"), r0 = gem.meta && gem.meta.rolle;
      if (u && r0 !== "owner" && r0 !== "admin") u.setAttribute("data-loeschen", "nein"); })();
    if (UC.makeTooltips) UC.makeTooltips(root, isDark);
    if (isDark()) root.setAttribute("data-theme", "dark"); else root.removeAttribute("data-theme");

    /* ---- Reiter und Adresse ------------------------------------------------------------------- */
    /* Der Reiter in der Adresse ueber core (UC.seitenAdresse, 12.10.): nur solange diese Ansicht
       offen ist -- vorher wanderte ?br durch jede andere Ansicht mit. */
    var adr = !ohneAdresse && UC.seitenAdresse ? UC.seitenAdresse(root, "br", function () { return state.tab === "tracked" ? "" : state.tab; }) : null;
    function adresseLesen() {
      if (ohneAdresse) return null;
      try { return new URL(window.location.href).searchParams.get("br") === "discover" ? "discover" : null; }
      catch (e) { return null; }
    }
    function adresseSetzen(neuerEintrag) {
      if (ohneAdresse) return;
      if (adr) { adr.schreiben(neuerEintrag); return; }
      try {
        var u = new URL(window.location.href);
        if (state.tab === "tracked") u.searchParams.delete("br"); else u.searchParams.set("br", state.tab);
        var neu = u.pathname + u.search + u.hash;
        if (neu === window.location.pathname + window.location.search + window.location.hash) return;
        if (neuerEintrag) window.history.pushState(window.history.state, "", neu);
        else window.history.replaceState(window.history.state, "", neu);
      } catch (e) {}
    }
    /* Die Filterzeile in die Leiste der Tabelle (Tracked) bzw. zurueck ueber die Tabelle
       (Discover). Die linke Haelfte der Leiste (.ubo-scope.up-leiste-scope) legt brands-overview.js
       an und stellt Active/Inactive hinein; wer zuerst kommt, legt sie an, der andere findet sie --
       derselbe Name, dieselbe Stelle. Gefunden ueber den Umschalter Active/Inactive, der Kopf des
       Charts heisst ebenfalls .ubo-head. Bewegt wird das vorhandene Element: Kalender und Filter
       behalten Zustand und Handler (Muster: prompts-page.js filterzeileStellen). */
    function filterzeileStellen() {
      if (!elFilterzeile) return;
      var scope = null;
      if (state.tab === "tracked") {
        var knopf = root.querySelector(".ubo-root .ubo-seg [data-status]");
        var kopf = knopf && knopf.closest(".ubo-head");
        if (kopf) {
          scope = kopf.querySelector(":scope > .ubo-scope");
          if (!scope) {
            scope = document.createElement("div");
            scope.className = "ubo-scope up-leiste-scope";
            kopf.insertBefore(scope, kopf.firstChild);
          }
        }
      }
      if (scope) {
        if (elFilterzeile.parentNode !== scope) scope.appendChild(elFilterzeile);
      } else {
        var main = root.querySelector(".ubr-main");
        if (elFilterzeile.parentNode !== root || elFilterzeile.nextSibling !== main) root.insertBefore(elFilterzeile, main);
      }
      elFilterzeile.classList.toggle("is-in-tabelle", !!scope);
    }
    function reiterZeigen() {
      root.querySelectorAll(".ubr-tab").forEach(function (x) { x.hidden = x.getAttribute("data-ubr-tab") !== state.tab; });
      filterzeileStellen();
      root.setAttribute("data-ubr-reiter", state.tab);
      if (krumen && krumen.zeichnen) krumen.zeichnen();
    }
    function reiterOeffnen(v, neuerEintrag) {
      v = v === "discover" ? "discover" : "tracked";
      if (v === state.tab) return;
      state.tab = v;
      if (nav && nav.selectPage) { try { nav.selectPage(v, false); } catch (e) {} }
      persist(); adresseSetzen(neuerEintrag); reiterZeigen();
      bedarf();
    }
    window.addEventListener("popstate", function () {
      if (root.isConnected === false) return;
      /* Zurueck/Vor in einer ANDEREN Ansicht betrifft diese Seite nicht. */
      if (adr && !adr.aktiv()) return;
      var a = adresseLesen() || "tracked";
      if (a !== state.tab) reiterOeffnen(a, false);
    });

    /* ---- Filter (wie prompts-page.js) --------------------------------------------------------- */
    function setzen(feld, w) {
      var alt = JSON.stringify(state.f[feld] == null ? null : state.f[feld]);
      if (alt === JSON.stringify(w == null ? null : w)) return false;
      state.f[feld] = w;
      return true;
    }
    function toArr(x) {
      if (isArr(x)) return x;
      if (x && typeof x === "object") return Object.keys(x).map(function (k) { var v = x[k]; return v && typeof v === "object" ? v : { code: k }; });
      return [];
    }
    function auswahl(feld, d, schluessel) {
      var gew = liste(d && d[schluessel]);
      if (!gew.length) return null;
      if (d.select_mode !== "exclude") return gew;
      var alle = feld === "modelle"
        ? (UC.getModels ? UC.getModels() : []).map(function (m) { return str(m.key || m.model); })
        : (UC.getAllMarkets ? toArr(UC.getAllMarkets()) : []).map(function (m) { return str(m.alpha2 || m.alpha3 || m.code || m.market).toUpperCase(); });
      return alle.filter(function (k) { return k && gew.indexOf(k) < 0; });
    }
    /* Gebuendelt (120ms): "Clear all" der Filterleiste feuert je Filter ein eigenes Ereignis. */
    var filterUhr = null;
    function filterGeaendert() {
      persist();
      clearTimeout(filterUhr);
      filterUhr = setTimeout(function () { filterUhr = null; bedarf(); }, 120);
    }
    root.addEventListener("umf-models", function (e) { if (setzen("modelle", auswahl("modelle", e.detail, "model_keys"))) filterGeaendert(); });
    /* Intent-Filter der App (13.10.): gemeinsamer Stand in core, Ereignis am window. */
    window.addEventListener("up-intentfilter", function () { if (document.contains(root)) filterGeaendert(); });
    /* Intent oder Branded geaendert (Live, 14.10.): die DB hat ihre Caches schon geleert, die Seite
       holt still frisch, sobald die Aenderung ihre Zahlen treffen kann (core, onIntentDaten). */
    if (UC.onIntentDaten) UC.onIntentDaten(function () {
      function holen() { bedarf({ frisch: true, leise: true }); }
      /* Geparkt (andere Ansicht offen): erst holen, wenn die Seite wieder zu sehen ist. */
      if (UC.istSichtbar && !UC.istSichtbar(root) && UC.beiSicht) UC.beiSicht(root, "intentDaten", holen, null, { lang: true });
      else holen();
    }, root);
    root.addEventListener("umk-markets", function (e) { if (setzen("maerkte", auswahl("maerkte", e.detail, "market_codes"))) filterGeaendert(); });
    root.addEventListener("utf-topics", function (e) {
      var d = e.detail || {}, l = liste(d.topic_ids);
      var a = setzen("topics", l.length ? l : null), b = setzen("tagmode", d.tag_mode === "and" ? "and" : "or");
      if (a || (b && l.length)) filterGeaendert();
    });
    function kalender() { var k = el(".ubr-daten"); return k && k.__udrCtrl ? k.__udrCtrl : null; }
    /* Die Stufe des Charts folgt jedem neuen Zeitraum (UC.granFuerZeitraum, wie SET GRAN in Bubble
       und wortgleich wie auf Dashboard und Citations); dazwischen gilt der Klick im Chart. Fehlte
       hier bis zum 13.10. -- gemeldet: "bei Brands Overview stellt sich die Granularitaet nicht
       mehr automatisch um". */
    function zeitraum(von, bis) {
      var a = setzen("von", von), b = setzen("bis", bis);
      state.kalenderDa = true;
      if ((a || b) && UC.granFuerZeitraum) {
        var g = UC.granFuerZeitraum(von, bis);
        if (g) state.gran = g;
      }
      return a || b;
    }
    function kalenderLesen() {
      var c = kalender(), r = null;
      try { r = c && c.getRange ? c.getRange() : null; } catch (e) { r = null; }
      if (!r || !r.from || !r.to) return false;
      return zeitraum(r.from, r.to);
    }
    root.addEventListener("change", function (e) {
      if (!e.target || !e.target.classList || !e.target.classList.contains("ubr-daten")) return;
      var d = e.detail || {};
      if (!d.date_from || !d.date_to) return;
      if (zeitraum(d.date_from, d.date_to)) filterGeaendert();
    });
    function filterAbgleichen() {
      var g = kalenderLesen();
      var m = el(".umf-root"), k = el(".umk-root"), tp = el(".utf-root");
      try { if (m && m.__umfCtrl) g = setzen("modelle", auswahl("modelle", m.__umfCtrl.getSelected(), "model_keys")) || g; } catch (e) {}
      try { if (k && k.__umkCtrl) g = setzen("maerkte", auswahl("maerkte", k.__umkCtrl.getSelected(), "market_codes")) || g; } catch (e) {}
      try {
        if (tp && tp.__utfCtrl) {
          var s = tp.__utfCtrl.getSelected(), l = liste(s.topic_ids);
          g = setzen("topics", l.length ? l : null) || g;
          g = setzen("tagmode", s.tag_mode === "and" ? "and" : "or") || g;
        }
      } catch (e) {}
      return g;
    }

    /* ---- Laden ---------------------------------------------------------------------------------- */
    function sichtbarTest(x) { return x.isConnected !== false && (!UC.istSichtbar || UC.istSichtbar(x)); }
    var warteUhr = null, kalenderVersuche = 0;
    function spaeter(ms) { if (!warteUhr) warteUhr = setTimeout(function () { warteUhr = null; bedarf(); }, ms); }
    function filterStand() { var f = {}, k; for (k in state.f) f[k] = state.f[k]; f.team = team(); return f; }
    function bereit() {
      if (!sichtbarTest(root)) { beiSicht(root, "laden", function () { bedarf(); }, sichtbarTest); return false; }
      if (!team()) return false;
      if (!state.kalenderDa && !kalenderLesen()) {
        /* 30ms, Gesamtfrist 3s (wie die anderen Seiten seit dem 11.10.). */
        if (kalenderVersuche++ < 100) { spaeter(30); return false; }
      }
      return true;
    }
    /* Gemeinsam laden, gemeinsam zeigen (wie die anderen Seiten): alle Auftraege gehen gleichzeitig
       hinaus, gezeichnet wird erst, wenn alle da sind, je Kanal nur aus der juengsten Gruppe. Nur wer
       wirklich holen muss, geht in den Ladezustand. */
    var gruppeNr = 0, juengsteJe = {};
    function gemeinsam(auftraege, o) {
      o = o || {};
      var nr = ++gruppeNr;
      auftraege.forEach(function (a) { juengsteJe[a.kanal] = nr; });
      /* o.leise: Nachladen nach einer Live-Meldung (Intent/Branded) -- der alte Stand bleibt stehen,
         bis der neue da ist, kein Skelett. */
      auftraege.forEach(function (a) { if (!o.leise && (o.frisch || !a.imSpeicher)) a.ladenAn(); });
      var vorab = o.vorab ? Promise.resolve(o.vorab).then(null, function () {}) : Promise.resolve();
      return vorab.then(function () {
        return Promise.all(auftraege.map(function (a) { return a.laden(o.frisch); }));
      }).then(function (zeigen) {
        zeigen.forEach(function (z, i) {
          if (z && juengsteJe[auftraege[i].kanal] === nr) { try { z(); } catch (e) { if (window.console) console.error("[brands-page] " + auftraege[i].kanal + ":", e); } }
        });
        if (auftritt) auftritt.bereit();
      });
    }
    function imSpeicher(l) { return l.every(function (a) { return lader.ausSpeicher(a) !== undefined; }); }
    function bedarf(o) {
      if (!bereit()) return null;
      o = o || {};
      if (state.tab === "discover") return gemeinsam([discoverAuftrag()], o);
      var a = [trackedAuftrag()];
      if (!D.VORSCHLAG && (!state.meta || o.frisch || o.seite)) a.push(seitenAuftrag());
      return gemeinsam(a, o);
    }

    /* TRACKED: Chart (visibility_v1) und Tabelle (overview_v1, alle aktiven Marken) in einem Zug.
       Die Tabelle blaettert, wenn ein Team mehr als 100 Marken hat (hoechstens 5 Seiten) -- still
       bei 100 abzuschneiden waere eine falsche Zahl.
       leise (Sortieren): KEIN Ladezustand -- brands-overview dimmt die stehenden Zeilen selbst
       (makeSoftReload), ein Skelett waere dort ein Sprung. Der Chart kommt dabei aus dem Speicher
       (gleiche Anfrage), es geht nur die Tabelle hinaus. EIN Kanal fuer beides: zwei haetten sich
       gegenseitig ueberholen koennen (neue Granularitaet, dann schnell sortiert). */
    function trackedAuftrag(leise) {
      var f = filterStand();
      var vis = D.chart(f, state.gran, state.firmen), erste = D.tabelle(f, state.order, 0, state.firmen);
      return {
        kanal: "tracked", imSpeicher: imSpeicher([vis, erste]),
        ladenAn: function () { if (!leise) { try { setter("setBrandsOverviewLoading")(ids.ubo, "yes"); } catch (e) {} } },
        laden: function (frisch) {
          var o = { frisch: !!frisch };
          return Promise.all([lader.laden("ubr_chart", vis, o), lader.laden("ubr_tabelle", erste, o)]).then(function (e) {
            if (e[0].ueberholt || e[1].ueberholt) return null;
            var mehr = e[1].ok ? D.weitereSeiten(e[1].daten) : 0, folge = [];
            for (var i = 1; i <= mehr; i++) folge.push(lader.laden("ubr_tabelle_" + i, D.tabelle(f, state.order, i * D.GRENZE.tabelle, state.firmen), o));
            return Promise.all(folge).then(function (rest) {
              if (rest.some(function (x) { return x.ueberholt; })) return null;
              var seiten = [e[1]].concat(rest);
              var alleOk = seiten.every(function (x) { return x.ok; });
              return function () {
                var daten = seiten.map(function (x) { return x.daten; });
                var p = alleOk && e[0].ok ? D.zuTracked(e[0].daten, daten) : null;
                if (!p) {
                  try { setter("renderBrandsOverview")({ instanceId: ids.ubo, __parseError: true }); } catch (err) {}
                } else {
                  if (!state.firmen) { state.autoFirmen = (p.companies || []).map(function (c) { return c.company_id; }); persist(); }
                  p.instanceId = ids.ubo; p.isDark = isDark();
                  /* Gefiltert geladen: ein leeres Ergebnis sagt dann "No matching data" (15.10.). */
                  p.gefiltert = UC.seitenFilterAktiv ? UC.seitenFilterAktiv(f) : false;
                  if (state.meta && state.meta.inaktivZahl != null) p.totalCountInactive = state.meta.inaktivZahl;
                  try { setter("renderBrandsOverview")(p); } catch (err) {}
                }
                /* brands-overview haelt einen AUSDRUECKLICH gesetzten Ladezustand, bis er ebenso
                   ausdruecklich endet (LOADING_EXPLICIT). */
                try { setter("setBrandsOverviewLoading")(ids.ubo, "no"); } catch (err) {}
              };
            });
          });
        }
      };
    }
    /* SEITEN-META (Vorschlag): Rolle, Zaehler, Kontingent, inaktive Marken. */
    function seitenAuftrag() {
      var a = D.seite(team());
      return {
        kanal: "seite", imSpeicher: false, ladenAn: function () {},
        laden: function () {
          return lader.laden("ubr_seite", a, { frisch: true }).then(function (erg) {
            if (erg.ueberholt) return null;
            return function () { seiteAnwenden(erg.ok ? D.zuMeta(erg.daten) : null); };
          });
        }
      };
    }
    function seiteAnwenden(z) {
      if (!z) {
        /* Ohne Meta keine inaktiven Marken: der Reiter Inactive zeigt seinen Lesefehler statt eines
           leeren Rasters (leer und kaputt sehen verschieden aus). */
        try { setter("setBrandsOverviewInactive")(ids.ubo, { __parseError: true }); } catch (e) {}
        return;
      }
      state.meta = z; persist();
      try { setter("setBrandsOverviewInactive")(ids.ubo, z.inaktive); } catch (e) {}
      try { setter("renderBrandsOverview")({ instanceId: ids.ubo, totalCountInactive: z.inaktivZahl }); } catch (e) {}
      /* Loeschen nur owner/admin (Vertrag 10.5, entschieden 11.10.): fuer alle anderen fehlt der
         Menueeintrag. Die DB prueft trotzdem selbst. */
      var ubo = el(".ubo-root");
      if (ubo) { if (z.rolle === "owner" || z.rolle === "admin") ubo.removeAttribute("data-loeschen"); else ubo.setAttribute("data-loeschen", "nein"); }
      /* DIE MARKEN-ABLAGE DER APP fuellt die Seite selbst (Vertrag 5: brands mit role) -- nach
         Anlegen, Aktivieren, Deaktivieren und Loeschen stimmen damit Seitenleiste, Filter und jedes
         Marken-Menue, ohne einen Bubble-Workflow. Ein leerer Stand ueberschreibt nie. */
      if (z.marken.length && typeof window.setUpstreemBrands === "function") { try { window.setUpstreemBrands(z.marken); } catch (e) {} }
    }
    /* DISCOVER (Vorschlag). Bis der Vertrag steht, zeigt der Baustein seinen Lesefehler statt
       "Scanning your AI answers" fuer immer -- der Ladezustand muss enden (Regel der App). */
    function discoverAuftrag() {
      if (D.VORSCHLAG) {
        return { kanal: "discover", imSpeicher: true, ladenAn: function () {},
                 laden: function () { return Promise.resolve(function () { try { setter("renderDiscoverBrands")({ instanceId: ids.udb, __parseError: true }); } catch (e) {} }); } };
      }
      var a = D.discover(filterStand(), { matched: state.disc.matched !== false, suche: state.disc.suche });
      return {
        kanal: "discover", imSpeicher: lader.ausSpeicher(a) !== undefined,
        ladenAn: function () { try { setter("setDiscoverBrandsLoading")(ids.udb, "yes"); } catch (e) {} },
        laden: function (frisch) {
          return lader.laden("ubr_discover", a, { frisch: !!frisch }).then(function (erg) {
            if (erg.ueberholt) return null;
            return function () {
              var z = erg.ok ? D.zuDiscover(erg.daten) : null;
              if (!z) { try { setter("renderDiscoverBrands")({ instanceId: ids.udb, __parseError: true }); } catch (e) {} return; }
              z.instanceId = ids.udb;
              try { setter("renderDiscoverBrands")(z); } catch (e) {}
            };
          });
        }
      };
    }
    /* Einzelteile (eigene Bedienung eines Bausteins), je Teil gebuendelt (80ms, wie das Dashboard). */
    var teilUhren = {};
    function teilLaden(teil) {
      clearTimeout(teilUhren[teil]);
      teilUhren[teil] = setTimeout(function () {
        teilUhren[teil] = null;
        if (!bereit()) return;
        if (teil === "tracked" && state.tab === "tracked") gemeinsam([trackedAuftrag()]);
        else if (teil === "sortieren" && state.tab === "tracked") gemeinsam([trackedAuftrag(true)]);
        else if (teil === "discover" && state.tab === "discover") gemeinsam([discoverAuftrag()]);
      }, 80);
    }
    /* Nach einer Aenderung (Anlegen, Aktivieren, Deaktivieren): alles frisch, die Ablage der Marken
       der App mit (Seitenleiste, Filter, alle Bausteine lesen sie). */
    function nachAenderung() {
      lader.leeren();
      if (bereit()) bedarf({ frisch: true, seite: true });
    }

    /* ---- Ereignisse von Brands Overview (lokal: "ubo-" plus Name, Wert in detail.value) -------- */
    function an(name, fn) { root.addEventListener(name, function (e) { fn(e.detail || {}); }); }
    an("ubo-uboGranularity", function (d) {
      var g = str(wert(d));
      if ((g !== "day" && g !== "week" && g !== "month") || g === state.gran) return;
      state.gran = g; persist(); teilLaden("tracked");
    });
    an("ubo-uboSortTable", function (d) {
      var o = str(wert(d));
      if (ORDER_OK.indexOf(o) < 0 || o === state.order) return;
      state.order = o; persist(); teilLaden("sortieren");
    });
    /* Die Auswahl im Chart (hoechstens 10). Entspricht sie den Top 7 von selbst (das "Reset" im
       Menue schickt genau sie): wieder automatisch -- dieselbe Regel wie im Dashboard, sonst
       wechselte eine Marke ihre Farbe, weil die DB sie nach der Reihenfolge der Auswahl vergibt. */
    an("ubo-uboSubmitBrands", function (d) {
      var l = liste(wert(d)).filter(function (x) { return UUID.test(x); }).slice(0, 10), auto = state.autoFirmen || [];
      var gleich = l.length === auto.length && l.every(function (x) { return auto.indexOf(x) >= 0; });
      var neu = !l.length || gleich ? null : l;
      if (JSON.stringify(neu) === JSON.stringify(state.firmen)) return;
      state.firmen = neu; persist(); teilLaden("tracked");
    });
    /* Active/Inactive: der Baustein zeigt die inaktiven Zeilen selbst (setBrandsOverviewInactive).
       Ohne Vertrag gibt es sie noch nicht -- das sagt er dann ueber seinen Lesefehler. */
    an("ubo-uboStatus", function (d) {
      if (str(wert(d)) !== "inactive") return;
      if (D.VORSCHLAG) { try { setter("setBrandsOverviewInactive")(ids.ubo, { __parseError: true }); } catch (e) {} return; }
      if (!state.meta && bereit()) gemeinsam([seitenAuftrag()]);
    });
    an("ubo-uboRowClick", function (d) { var id = str(wert(d)).trim(); if (UUID.test(id) && UC.drawerOeffnen) UC.drawerOeffnen("brand", id, "brands"); });
    /* "Edit": der Marken-Editor ist der Drawer #drawer-companysettings der App (vom Nutzer am
       11.10. bestaetigt). Steht er nicht auf der Seite, faellt es auf den alten Bubble-Weg zurueck,
       solange es den noch gibt, und sonst sagt es das -- nie ein Knopf, der still nichts tut. */
    var EDITOR_ART = "companysettings";
    an("ubo-uboEdit", function (d) {
      var id = str(wert(d)).trim();
      if (!UUID.test(id)) return;
      /* kernDrawerAktiv: in Next.js legt core die Huelle erst beim Oeffnen an (13.10.), das Element
         fehlt bis dahin -- der Drawer ist trotzdem da. */
      if (((UC.kernDrawerAktiv && UC.kernDrawerAktiv(EDITOR_ART)) || document.getElementById("drawer-" + EDITOR_ART)) && UC.drawerOeffnen) { UC.drawerOeffnen(EDITOR_ART, id, "brands"); return; }
      var alt = UC.resolveBubbleFn ? UC.resolveBubbleFn("bubble_fn_uboEdit") : null;
      if (typeof alt === "function") { try { alt(id); } catch (e) {} return; }
      toast(t("Editing isn't available on this page"), "neutral");
    });
    function statusSetzen(id, ziel) {
      if (!UUID.test(id) || !team()) return;
      if (D.VORSCHLAG) { nochNicht(); return; }
      schreiben(D.status(team(), [id], ziel)).then(function (erg) {
        if (!erg.ok) { fehlerToast(erg, ziel === "active" ? t("The brand could not be activated") : t("The brand could not be set inactive")); return; }
        toast(ziel === "active" ? t("Brand activated") : t("Brand set inactive"), "success",
              ziel === "active" ? "" : t("Its history stays. You can activate it again anytime."));
        nachAenderung();
      }, function () { fehlerToast(null, t("That didn't work")); });
    }
    an("ubo-uboSetInactive", function (d) { statusSetzen(str(wert(d)).trim(), "inactive"); });
    an("ubo-uboActivate", function (d) { statusSetzen(str(wert(d)).trim(), "active"); });
    /* LOESCHEN (Vertrag 10.5): wie bei Prompts -- ein Dialog, der kurz sagt, was wegfaellt, und
       den Ausweg nennt (inaktiv setzen behaelt den Verlauf). Der Knopf ist rot (Gefahr). Die Antwort
       kommt sofort, das Aufraeumen laeuft in der DB im Hintergrund, ohne Anzeige. */
    function markeName(id) {
      var l = (UC.getBrands ? UC.getBrands() : []).concat(state.meta ? state.meta.inaktive : []);
      for (var i = 0; i < l.length; i++) if (l[i] && str(l[i].company_id) === id) return str(l[i].name);
      return "";
    }
    function loeschen(id) {
      if (D.VORSCHLAG) { nochNicht(); return; }
      schreiben(D.loeschen(team(), [id])).then(function (erg) {
        if (!erg.ok) { fehlerToast(erg, t("The brand could not be deleted")); return; }
        toast(t("Brand deleted"), "success");
        nachAenderung();
      }, function () { fehlerToast(null, t("The brand could not be deleted")); });
    }
    an("ubo-uboDelete", function (d) {
      var id = str(wert(d)).trim();
      if (!UUID.test(id) || !team()) return;
      var name = markeName(id);
      var titel = name ? t("Delete {name}?").replace("{name}", name) : t("Delete this brand?");
      /* Ohne den Dialog (alter core) wird NICHT geloescht: Loeschen ohne Rueckfrage gibt es nicht. */
      if (!UC.makeModal) { toast(t("Please reload the page and try again."), "neutral"); return; }
      UC.makeModal({
        titel: titel,
        isDark: isDark,
        inhaltHtml: '<div class="up-modal-saetze">' +
          '<p class="up-modal-hinweis">' + esc(t("This permanently deletes the brand and its history, including mentions, rankings and sentiment. Your reports will no longer include it, for any time period.")) + '</p>' +
          '<p class="up-modal-hinweis">' + esc(t("This can't be undone. To stop tracking but keep the history, set it inactive instead.")) + '</p></div>',
        knoepfe: [
          { id: "abbrechen", text: "Cancel", art: "sec" },
          { id: "ok", text: t("Delete brand"), art: "gefahr", aktion: function () { loeschen(id); } }
        ]
      });
    });
    an("ubo-uboAddBrand", function () { brandOeffnen(); });

    /* ---- Ereignisse von Explore Brands (makeFire, lokal: "udb-" plus Name) -------------------- */
    an("udb-udbMatched", function (d) {
      var m = str(d.matched) !== "no";
      if (m === (state.disc.matched !== false)) return;
      state.disc.matched = m; persist(); teilLaden("discover");
    });
    /* Suche ueber ALLE Kandidaten (Vertrag 6.2: p_search), nicht nur die 30 gezeigten. Der Baustein
       buendelt die Tasten selbst (makeSearch); die Antwort kommt in Millisekunden aus der
       Tagesverdichtung. */
    an("udb-udbSearch", function (d) {
      var q = str(d.query).trim();
      if (q === (state.disc.suche || "")) return;
      state.disc.suche = q; persist(); teilLaden("discover");
    });
    /* "Track" auf einer INAKTIVEN Marke des Teams aktiviert sie direkt, ohne Dialog (Vertrag 10.3). */
    an("udb-udbActivate", function (d) { statusSetzen(str(d.company_id).trim(), "active"); });

    /* ---- Export (wie prompts-page.js) ------------------------------------------------------------
       Brands Overview oeffnet das Export-Fenster der App ueber data-export-instance; die Seite setzt
       es VOR dem Klick (Fangphase), samt Typ. */
    function exportKennung() {
      var k = str(root.getAttribute("data-export-instance")).trim();
      if (k && !/^[A-Z_]{3,}$/.test(k)) return k;
      var e = document.querySelector(".uex-root[data-instance]");
      k = e ? str(e.getAttribute("data-instance")).trim() : "";
      return k && !/^[A-Z_]{3,}$/.test(k) ? k : "";
    }
    root.addEventListener("click", function (e) {
      var b = e.target && e.target.closest ? e.target.closest(".up-export") : null;
      var tab = b && b.closest(".ubo-root");
      if (!tab || !root.contains(tab)) return;
      /* Gesperrt (Inactive, brands-overview exportKnopfSperren): kein Kontext, kein Hinweis -- der
         Grund steht schon als Tooltip am Knopf. */
      if (b.getAttribute("aria-disabled") === "true") return;
      var k = exportKennung();
      if (!k || typeof window.upstreemExportOpen !== "function") {
        e.stopPropagation();
        toast(t("Export isn't available on this page"), "neutral");
        return;
      }
      tab.setAttribute("data-export-instance", k);
      try { if (window.upstreemExportSetContext) window.upstreemExportSetContext(k, exportKontext()); } catch (err) {}
    }, true);
    /* WAS DER EXPORT MITNIMMT (16.10., wie prompts-page.js): Zeitraum, Filter der Leiste und die
       Suche der Tabelle als Chips im Dialog, jeder abwaehlbar; die Sortierung als Reihenfolge. Die
       Suche filtert Brands Overview im Browser (state.query, gemerkt am Fenster je Instanz) -- im
       Export sucht export_brands_v2 dasselbe ueber p_search. */
    function exportKontext() {
      var r = null, c = kalender();
      try { r = c && c.getRange ? c.getRange() : null; } catch (e) { r = null; }
      var p = D.tabelle(filterStand(), state.order, 0).params, ansicht = (window.__uboView || {})[ids.ubo] || {};
      var q = typeof ansicht.query === "string" ? ansicht.query.trim() : "";
      if (q) p.p_search = q.slice(0, 200);
      return {
        export_type: "brands",
        date_from: r && r.from ? r.from : state.f.von, date_to: r && r.to ? r.to : state.f.bis, preset: r && r.preset ? r.preset : "",
        params: { brands: p }
      };
    }

    /* ---- Add Brand ------------------------------------------------------------------------------
       Seit 13.10. speichert der Dialog (add-brand.js) selbst ueber brand_add_v1, auf jeder Seite,
       mit EINER Fehlerliste -- auch fuer "Track" in Explore Brands. Die Seite oeffnet ihn nur und
       laedt nach einer Anlage neu. Fuellt nachAenderung() dabei die Marken-Ablage der App selbst
       (seitenAuftrag: nur sichtbar und auf Tracked), sagt es das dem Dialog per preventDefault --
       sonst holte er brands_page_meta_v1 ein zweites Mal. Auf Explore Brands oder verdeckt fuellt
       der Dialog sie. */
    window.addEventListener("up-brand-added", function (e) {
      if (!root.isConnected) return;
      if (!D.VORSCHLAG && state.tab !== "discover" && sichtbarTest(root) && team()) { try { e.preventDefault(); } catch (err) {} }
      nachAenderung();
    });
    function brandOeffnen(vorab) {
      if (typeof window.openAddBrand !== "function") { toast(t("Adding brands isn't available on this page"), "neutral"); return; }
      var o = {};
      if (vorab) { o.name = vorab.name; o.domain = vorab.domain; }
      window.openAddBrand(o);
    }
    if (elAdd) elAdd.addEventListener("click", function () { brandOeffnen(); });

    /* AKTUALISIEREN = DEN DB-CACHE LEEREN, DANN FRISCH LADEN (Regel jedes Refresh-Knopfs).
       Tracked: clear_dashboard_cache_v1 (dieselben Zahlen wie das Dashboard). Discover: der Weg
       steht im Auftrag (2.4); bis dahin frisch lesen. Einmal zur Zeit. */
    var aktualisiertGerade = false;
    function aktualisieren() {
      if (aktualisiertGerade || !team() || !bereit()) return;
      aktualisiertGerade = true;
      /* Tracked: Dashboard-Cache leeren. Discover: den heutigen Tag neu rechnen (Vertrag 10.2,
         1-3 s; ohne das zeigt Discover den Stand bis gestern). Ein Ratenlimit dort sagt es. */
      var vorab = state.tab === "tracked"
        ? UC.rpc(D.FN.clear, { p_team: team() }).then(function () { lader.leeren(); }, function () { lader.leeren(); })
        : (D.VORSCHLAG ? Promise.resolve(lader.leeren())
          : schreiben(D.discoverNeu(team())).then(function (erg) { if (!erg.ok) fehlerToast(erg, t("Discover could not be refreshed")); lader.leeren(); }));
      var fertig = function () { aktualisiertGerade = false; };
      Promise.resolve(bedarf({ frisch: true, vorab: vorab, seite: true })).then(fertig, fertig);
    }
    if (elRefresh) elRefresh.addEventListener("click", function () {
      if (UC.spinOnce) UC.spinOnce(elRefresh);
      aktualisieren();
    });

    /* Teamwechsel ohne Neuladen: andere Daten, also nichts aus dem Speicher weiterzeigen. */
    if (UC.onTeamChange) UC.onTeamChange(function () {
      lader.leeren(); state.meta = null; state.firmen = null; state.autoFirmen = [];
      persist(); bedarf({ seite: true });
    }, root);

    var ctrl = {
      root: root, state: state, ids: ids,
      reset: function () {
        lader.leeren();
        var v = uboVorgabe();
        state.order = v.order; state.gran = v.gran; state.firmen = null; state.disc = { matched: true };
        persist(); bedarf({ frisch: true, seite: true });
        return true;
      },
      neuLaden: function () { lader.leeren(); bedarf({ seite: true }); }
    };
    root.__ubrCtrl = ctrl;

    reiterZeigen();
    adresseSetzen(false);
    /* Erst nach dem Aufbau der eingebetteten Bausteine: deren Skripte richten sich ueber
       watchRoots ein, der Kalender kennt seinen Zeitraum also erst einen Takt spaeter. */
    setTimeout(function () { filterAbgleichen(); persist(); bedarf(); }, 0);
    return ctrl;
  }

  /* ---- Mount (wie prompts-page.js) ---------------------------------------------------------- */
  function alle() { return [].slice.call(document.querySelectorAll(".ubr-root")); }
  function jede(id, fn) {
    var r = alle().filter(function (x) { return id == null || str(x.getAttribute("data-instance")) === String(id); });
    r.forEach(function (x) { var c = initRoot(x); if (c) fn(c); });
    return r.length > 0;
  }
  window.resetBrandsPage = function (id) { return jede(id, function (c) { c.reset(); }); };
  function einrichten() {
    alle().forEach(function (r) {
      if (r.__ubrCtrl) return;
      if (messbar(r)) { initRoot(r); return; }
      var neu = !(UC.wartetAufSicht && UC.wartetAufSicht(r));
      beiSicht(r, "einrichten", function () { initRoot(r); }, messbar, { lang: neu });
    });
  }
  if (UC.watchRoots) UC.watchRoots("ubr-root", einrichten);
  einrichten();
  Q.splice(0).forEach(function (q) { try { window[q[0]].apply(null, q[1]); } catch (e) {} });
  }

  ubrBoot(30);
})();
