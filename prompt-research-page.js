/* upstreem prompt-research-page.js -- die Prompt-Research-Seite als EINE Komponente (09.10.).
   Praefix urs.

   Wie Citations, Dashboard, Performance, Opportunities und Teams: die Seite laedt und schreibt
   selbst (UC.rpc / UC.edge, Login des Nutzers) und bettet die ECHTE Komponente ein
   (prompt-research.js, lokaler Modus -- ihre Ereignisse gehen an window, nicht an Bubble).
   Vertrag C in bubble/seiten_db_vorschlag_2.md (Abschnitte 7 und 14); Anfragen und Umformung in
   prompt-research-data.js.

   LISTE (Previous Researches): prompt_research_jobs_v1 beim Aufbau, nach jeder Aenderung und bei
   jedem Teamwechsel. Laufende und gescheiterte Recherchen stehen mit drin.
   MAERKTE UND THEMEN kommen aus den Ablagen von core (setUpstreemAllMarkets, setUpstreemTopics),
   nicht aus einem eigenen Aufruf.
   START: start-job (Edge Function) legt den Job an und stoesst n8n an. Danach fragt die Seite alle
   3 s prompt_research_result_v1 nach genau diesem Job: bei success stehen die Vorschlaege schon in
   der Antwort, bei error steht der Grund unter dem Eingabefeld. Laeuft beim Aufbau schon ein Job
   (Neuladen, anderer Tab), zeigt die Seite das Ladebild und fragt weiter.
   ENTSCHEIDEN: Track / Ignore / alle -> prompt_research_decide_v1, danach das Ergebnis neu. Das
   Kontingent aus der Antwort geht an setUpstreemQuota, und die Maerkte und Themen der App melden
   sich ueber die bekannten Signale neu (marketsChanged, topicsChanged).
   Schreiben laeuft nacheinander. Ein XX000 (Vertrag 1, Abschnitt 12) wird einmal wiederholt --
   die Transaktion ist dann abgebrochen, es wurde nichts gespeichert. */
(function () {
  "use strict";

  var API_NAMES = ["resetPromptResearchPage"];
  var Q = (window.__ursBootQueue = window.__ursBootQueue || []);
  API_NAMES.forEach(function (n) {
    if (!window[n]) window[n] = function () { Q.push([n, [].slice.call(arguments)]); };
  });

  function ursBoot(triesLeft) {
    if (!window.UpstreemCore || !window.UpstreemPromptResearchDaten || !window.UpstreemCitationsDaten) {
      if (triesLeft > 0) { setTimeout(function () { ursBoot(triesLeft - 1); }, 100); return; }
      if (window.console) console.error("[prompt-research-page] core.js, prompt-research-data.js oder citations-data.js nicht geladen");
      return;
    }
    ursStart();
  }

  /* ---- MARKUP ANFANG (erzeugt von .prompt_research_markup.py -- nicht von Hand aendern) ---- */
  var MARKUP = {
    upr: "<div class=\"up-root upr-root\" data-local=\"yes\" id=\"upstreem-prompt-research\" data-instance=\"__URS_UPR__\" data-cdn-pin=\"\" data-isdark=\"__URS_DARK__\"><div class=\"upr-shell\"><!-- ---------- start screen ---------- --><div class=\"upr-content\"><div class=\"upr-research-mark\" aria-hidden=\"true\"><div class=\"upr-research-orb\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M19 9.5V8.3C18.992 5.49713 18.9051 4.0112 17.967 3.05442C16.9332 2 15.2694 2 11.9416 2L10.0592 2C6.73147 2 5.0676 2 4.0338 3.05442C3 4.10883 3 5.80589 3 9.2L3 13.8C3 17.1941 3 18.8912 4.0338 19.9456C4.95155 20.8816 6.36586 20.9867 9 20.9985\"/><path d=\"M18.6753 19.6886L21 22M20 16.5C20 14.0147 17.9853 12 15.5 12C13.0147 12 11 14.0147 11 16.5C11 18.9853 13.0147 21 15.5 21C17.9853 21 20 18.9853 20 16.5Z\"/><path d=\"M7 7H15\"/><path d=\"M7 11H10\"/></svg></div><span class=\"upr-float-point p1\"></span><span class=\"upr-float-point p2\"></span><span class=\"upr-float-point p3\"></span><span class=\"upr-float-point p4\"></span><span class=\"upr-float-spark s1\">\u2726</span><span class=\"upr-float-spark s2\">\u2726</span></div><h1 class=\"upr-title\">Start your prompt research</h1><p class=\"upr-subtitle\">Enter keywords, topics, or context to uncover high-intent prompt themes and related opportunities.</p><div class=\"upr-suggestions-skeleton\" id=\"upr-suggestions-skeleton\" aria-hidden=\"true\"><span class=\"upr-skeleton-chip\" style=\"width:82px;\"></span><span class=\"upr-skeleton-chip\" style=\"width:108px;\"></span><span class=\"upr-skeleton-chip\" style=\"width:68px;\"></span><span class=\"upr-skeleton-chip\" style=\"width:124px;\"></span><span class=\"upr-skeleton-chip\" style=\"width:90px;\"></span><span class=\"upr-skeleton-chip\" style=\"width:76px;\"></span><span class=\"upr-skeleton-chip\" style=\"width:116px;\"></span><span class=\"upr-skeleton-chip\" style=\"width:60px;\"></span><span class=\"upr-skeleton-chip\" style=\"width:98px;\"></span><span class=\"upr-skeleton-chip\" style=\"width:88px;\"></span></div><div class=\"upr-suggestions\" id=\"upr-suggestions\" aria-label=\"Suggested keywords\" style=\"display:none;\"></div><div class=\"upr-history-entry\"><button class=\"upr-secondary-btn\" type=\"button\" id=\"upr-open-history\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"upr-leiste-ic\"><path d=\"M11 3H13C16.7712 3 18.6569 3 19.8284 4.17157C21 5.34315 21 7.22876 21 11V13C21 16.7712 21 18.6569 19.8284 19.8284C18.6569 21 16.7712 21 13 21H11C7.22876 21 5.34315 21 4.17157 19.8284C3 18.6569 3 16.7712 3 13V11C3 7.22876 3 5.34315 4.17157 4.17157C5.34315 3 7.22876 3 11 3Z\"/><path d=\"M8.00488 16.0049L8.00488 8.00488\"/></svg> Previous Researches </button></div><div class=\"upr-composer-area\"><div class=\"upr-composer-shell\"><div class=\"upr-composer\"><textarea class=\"upr-textarea\" rows=\"3\" maxlength=\"300\" placeholder=\"Enter keywords, topics, or context for prompt research...\"></textarea><button class=\"upr-clear-input\" type=\"button\" id=\"upr-clear-input\" data-tip=\"Clear input\" aria-label=\"Clear input\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M19.5 5.5L18.8803 15.5251C18.7219 18.0864 18.6428 19.3671 18.0008 20.2879C17.6833 20.7431 17.2747 21.1273 16.8007 21.416C15.8421 22 14.559 22 11.9927 22C9.42312 22 8.1383 22 7.17905 21.4149C6.7048 21.1257 6.296 20.7408 5.97868 20.2848C5.33688 19.3626 5.25945 18.0801 5.10461 15.5152L4.5 5.5\"/><path d=\"M3 5.5H21M16.0557 5.5L15.3731 4.09173C14.9196 3.15626 14.6928 2.68852 14.3017 2.39681C14.215 2.3321 14.1231 2.27454 14.027 2.2247C13.5939 2 13.0741 2 12.0345 2C10.9688 2 10.436 2 9.99568 2.23412C9.8981 2.28601 9.80498 2.3459 9.71729 2.41317C9.32164 2.7167 9.10063 3.20155 8.65861 4.17126L8.05292 5.5\"/><path d=\"M9.5 16.5L9.5 10.5\"/><path d=\"M14.5 16.5L14.5 10.5\"/></svg></button><div class=\"upr-actions\"><button class=\"up-iconbtn upr-settings-toggle\" type=\"button\" id=\"upr-settings-toggle\" data-tip=\"Research settings\" aria-label=\"Open research settings\" aria-expanded=\"false\"><svg viewBox=\"0 0 24 24\" class=\"upr-ic-fader\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"><line x1=\"4\" y1=\"8\" x2=\"20\" y2=\"8\"></line><circle cx=\"9\" cy=\"8\" r=\"2.2\"></circle><line x1=\"4\" y1=\"16\" x2=\"20\" y2=\"16\"></line><circle cx=\"15\" cy=\"16\" r=\"2.2\"></circle></svg></button><button class=\"upr-start-btn\" type=\"button\" id=\"upr-start-button\" aria-label=\"Start Research\" data-tip=\"Start Research\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M8.87038 6.13264L14.7327 4.19538C18.033 3.10476 19.6831 2.55945 20.5579 3.43426C21.4327 4.30907 20.8874 5.95922 19.7968 9.25953L17.8595 15.1218C16.6236 18.8619 16.0056 20.7319 14.8796 20.9603C14.6411 21.0087 14.3955 21.0129 14.1549 20.9727C13.019 20.7832 12.3132 18.9359 10.9016 15.2413C10.6328 14.5376 10.4983 14.1858 10.2574 13.9127C10.2018 13.8497 10.1424 13.7903 10.0795 13.7348C9.80638 13.4938 9.45455 13.3594 8.75089 13.0906C5.05627 11.679 3.20896 10.9732 3.01945 9.83727C2.97931 9.59669 2.98353 9.35108 3.03189 9.11259C3.26025 7.98657 5.13029 7.36859 8.87038 6.13264Z\"/><path d=\"M12.8008 11.1865L15.498 8.48926\"/></svg><span>Start Research</span></button></div></div><div class=\"upr-settings-panel\" id=\"upr-settings-panel\"><div class=\"upr-settings-inner\"><div class=\"upr-settings-header\"><p class=\"upr-settings-title\">Research settings</p><p class=\"upr-settings-desc\">Configure market, business model and optional persona for generated prompt themes.</p></div><div class=\"upr-settings-grid\"><div class=\"upr-field\"><span class=\"upr-label\">Market</span><div class=\"upr-dd\" data-name=\"market\" id=\"upr-market-dd\"><button class=\"upr-dd-trigger\" type=\"button\"><span class=\"upr-dd-value\" data-dd-value><span class=\"upr-flag\"></span><span>Loading markets\u2026</span></span><svg class=\"upr-dd-chevron\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9\"/></svg></button><div class=\"upr-dd-menu\"><div class=\"upr-dd-search-row\"><div class=\"upr-dd-search-wrap\"><input class=\"upr-dd-search\" type=\"text\" placeholder=\"Search for Markets\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M17 17L21 21\"/><path d=\"M19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19C15.4183 19 19 15.4183 19 11Z\"/></svg></div><button class=\"upr-dd-clear\" type=\"button\">Clear</button></div><div class=\"upr-dd-list\" data-dd-list><div class=\"upr-dd-loading\">Loading markets\u2026</div><div class=\"upr-dd-empty\">No markets found</div></div></div></div></div><div class=\"upr-field\"><span class=\"upr-label\">Business model</span><div class=\"upr-dd\" data-name=\"business_model\"><button class=\"upr-dd-trigger\" type=\"button\"><span class=\"upr-dd-value\" data-dd-value><span>B2C</span></span><svg class=\"upr-dd-chevron\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9\"/></svg></button><div class=\"upr-dd-menu\"><div class=\"upr-dd-list\" data-dd-list><button class=\"upr-dd-option is-selected\" type=\"button\" data-value=\"b2c\" data-label=\"B2C\"><span class=\"upr-dd-check\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M5 13.2592L7.58583 15.9568C8.2525 16.6523 8.58583 17 9.00004 17C9.41425 17 9.74759 16.6523 10.4143 15.9568L19 7\"/></svg></span><span class=\"upr-dd-optlabel\">B2C</span><span></span></button><button class=\"upr-dd-option\" type=\"button\" data-value=\"b2b\" data-label=\"B2B\"><span class=\"upr-dd-check\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M5 13.2592L7.58583 15.9568C8.2525 16.6523 8.58583 17 9.00004 17C9.41425 17 9.74759 16.6523 10.4143 15.9568L19 7\"/></svg></span><span class=\"upr-dd-optlabel\">B2B</span><span></span></button><button class=\"upr-dd-option\" type=\"button\" data-value=\"hybrid\" data-label=\"Hybrid\"><span class=\"upr-dd-check\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M5 13.2592L7.58583 15.9568C8.2525 16.6523 8.58583 17 9.00004 17C9.41425 17 9.74759 16.6523 10.4143 15.9568L19 7\"/></svg></span><span class=\"upr-dd-optlabel\">Hybrid <span class=\"upr-dd-meta\">(B2B &amp; B2C)</span></span><span></span></button><div class=\"upr-dd-empty\">No options found</div></div></div></div></div><div class=\"upr-field\"><span class=\"upr-label\">Persona optional</span><div class=\"upr-dd\" data-name=\"persona\"><button class=\"upr-dd-trigger\" type=\"button\"><span class=\"upr-dd-value\" data-dd-value><span>No specific persona</span></span><svg class=\"upr-dd-chevron\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9\"/></svg></button><div class=\"upr-dd-menu\"><div class=\"upr-dd-list\" data-dd-list><button class=\"upr-dd-option is-selected\" type=\"button\" data-value=\"\" data-label=\"No specific persona\"><span class=\"upr-dd-check\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M5 13.2592L7.58583 15.9568C8.2525 16.6523 8.58583 17 9.00004 17C9.41425 17 9.74759 16.6523 10.4143 15.9568L19 7\"/></svg></span><span class=\"upr-dd-optlabel\">No specific persona</span><span></span></button><button class=\"upr-dd-option\" type=\"button\" data-value=\"student\" data-label=\"Student\"><span class=\"upr-dd-check\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M5 13.2592L7.58583 15.9568C8.2525 16.6523 8.58583 17 9.00004 17C9.41425 17 9.74759 16.6523 10.4143 15.9568L19 7\"/></svg></span><span class=\"upr-dd-optlabel\">Student</span><span></span></button><button class=\"upr-dd-option\" type=\"button\" data-value=\"entrepreneur\" data-label=\"Entrepreneur\"><span class=\"upr-dd-check\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M5 13.2592L7.58583 15.9568C8.2525 16.6523 8.58583 17 9.00004 17C9.41425 17 9.74759 16.6523 10.4143 15.9568L19 7\"/></svg></span><span class=\"upr-dd-optlabel\">Entrepreneur</span><span></span></button><button class=\"upr-dd-option\" type=\"button\" data-value=\"smb_owner\" data-label=\"SMB owner\"><span class=\"upr-dd-check\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M5 13.2592L7.58583 15.9568C8.2525 16.6523 8.58583 17 9.00004 17C9.41425 17 9.74759 16.6523 10.4143 15.9568L19 7\"/></svg></span><span class=\"upr-dd-optlabel\">SMB owner</span><span></span></button><button class=\"upr-dd-option\" type=\"button\" data-value=\"parent_family\" data-label=\"Parent / Family\"><span class=\"upr-dd-check\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M5 13.2592L7.58583 15.9568C8.2525 16.6523 8.58583 17 9.00004 17C9.41425 17 9.74759 16.6523 10.4143 15.9568L19 7\"/></svg></span><span class=\"upr-dd-optlabel\">Parent / Family</span><span></span></button><button class=\"upr-dd-option\" type=\"button\" data-value=\"tech_enthusiast\" data-label=\"Tech enthusiast\"><span class=\"upr-dd-check\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M5 13.2592L7.58583 15.9568C8.2525 16.6523 8.58583 17 9.00004 17C9.41425 17 9.74759 16.6523 10.4143 15.9568L19 7\"/></svg></span><span class=\"upr-dd-optlabel\">Tech enthusiast</span><span></span></button><div class=\"upr-dd-empty\">No personas found</div></div></div></div></div></div></div></div></div><p class=\"upr-tip\">Tip: Be specific for better results. You can enter multiple keywords or a full topic description.</p></div></div><!-- ---------- results ---------- --><div class=\"upr-results-stage\" id=\"upr-results-stage\"><div class=\"upr-results-nav\"><button class=\"upr-secondary-btn\" type=\"button\" id=\"upr-back-to-start\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m12 19-7-7 7-7\" /><path d=\"M19 12H5\" /></svg> Back to start </button><div class=\"upr-results-nav-right\"><button class=\"upr-secondary-btn\" type=\"button\" id=\"upr-open-history-results\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"upr-leiste-ic\"><path d=\"M11 3H13C16.7712 3 18.6569 3 19.8284 4.17157C21 5.34315 21 7.22876 21 11V13C21 16.7712 21 18.6569 19.8284 19.8284C18.6569 21 16.7712 21 13 21H11C7.22876 21 5.34315 21 4.17157 19.8284C3 18.6569 3 16.7712 3 13V11C3 7.22876 3 5.34315 4.17157 4.17157C5.34315 3 7.22876 3 11 3Z\"/><path d=\"M8.00488 16.0049L8.00488 8.00488\"/></svg> Previous Researches </button></div></div><div class=\"up-head\"><div class=\"up-heading has-count\" id=\"upr-results-heading\"><span class=\"up-head-label\">Suggested prompts</span><span class=\"up-head-sep\"></span><span class=\"up-head-count\" id=\"upr-results-count\">0</span></div><div class=\"upr-results-context\" id=\"upr-results-context\"></div><div class=\"up-head-tools\"><span class=\"upr-spinner\" aria-hidden=\"true\"></span><button class=\"upr-switchbtn is-on\" type=\"button\" id=\"upr-accept-with-tags\" aria-pressed=\"true\" data-tip=\"Track accepted prompts with their suggested tags\"><span>Accept with Tags</span><span class=\"up-switch is-on\" aria-hidden=\"true\"></span></button><div class=\"upr-menu-wrap\" id=\"upr-table-menu\"><button class=\"up-iconbtn\" type=\"button\" id=\"upr-table-menu-trigger\" data-tip=\"More actions\" aria-label=\"Open suggested prompt actions\" aria-expanded=\"false\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M6.00449 12.5V12M18.0045 12.5V12M12.0045 12.5V12M7.00449 12.5C7.00449 11.9477 6.55677 11.5 6.00449 11.5C5.4522 11.5 5.00449 11.9477 5.00449 12.5C5.00449 13.0523 5.4522 13.5 6.00449 13.5C6.55677 13.5 7.00449 13.0523 7.00449 12.5ZM19.0045 12.5C19.0045 11.9477 18.5568 11.5 18.0045 11.5C17.4522 11.5 17.0045 11.9477 17.0045 12.5C17.0045 13.0523 17.4522 13.5 18.0045 13.5C18.5568 13.5 19.0045 13.0523 19.0045 12.5ZM13.0045 12.5C13.0045 11.9477 12.5568 11.5 12.0045 11.5C11.4522 11.5 11.0045 11.9477 11.0045 12.5C11.0045 13.0523 11.4522 13.5 12.0045 13.5C12.5568 13.5 13.0045 13.0523 13.0045 12.5Z\"/></svg></button><div class=\"up-menu\" id=\"upr-table-menu-popover\" aria-hidden=\"true\"><button class=\"up-filter-item upr-menu-item\" type=\"button\" id=\"upr-accept-all-prompts\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"10\" /><path d=\"m9 12 2 2 4-4\" /></svg><!-- Der Text in EIGENEM Element, getrennt vom Zaehler: ein Satz aus zwei Knoten laesst sich nicht uebersetzen. prompt-research.js zieht das bei bereits eingebauten Elementen zur Laufzeit nach (etikettTrennen). --><span><span>Accept all Prompts</span><span data-count-label>(0)</span></span></button><button class=\"up-filter-item upr-menu-item is-danger\" type=\"button\" id=\"upr-delete-all-prompts\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M19.5 5.5L18.8803 15.5251C18.7219 18.0864 18.6428 19.3671 18.0008 20.2879C17.6833 20.7431 17.2747 21.1273 16.8007 21.416C15.8421 22 14.559 22 11.9927 22C9.42312 22 8.1383 22 7.17905 21.4149C6.7048 21.1257 6.296 20.7408 5.97868 20.2848C5.33688 19.3626 5.25945 18.0801 5.10461 15.5152L4.5 5.5\"/><path d=\"M3 5.5H21M16.0557 5.5L15.3731 4.09173C14.9196 3.15626 14.6928 2.68852 14.3017 2.39681C14.215 2.3321 14.1231 2.27454 14.027 2.2247C13.5939 2 13.0741 2 12.0345 2C10.9688 2 10.436 2 9.99568 2.23412C9.8981 2.28601 9.80498 2.3459 9.71729 2.41317C9.32164 2.7167 9.10063 3.20155 8.65861 4.17126L8.05292 5.5\"/><path d=\"M9.5 16.5L9.5 10.5\"/><path d=\"M14.5 16.5L14.5 10.5\"/></svg><span><span>Delete all Prompts</span><span data-count-label>(0)</span></span></button></div></div></div></div><div class=\"up-box upr-box\"><div class=\"up-table\"><div class=\"up-thead\"><div class=\"up-th\"><svg class=\"upr-th-icon\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M21 5H3\" /><path d=\"M15 12H3\" /><path d=\"M17 19H3\" /></svg> Prompt </div><div class=\"up-th\">Tags</div><div class=\"up-th\">Est. Volume<span class=\"up-th-info\" data-explain=\"volume\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M12 16V12\"/><path d=\"M12.125 8.25H12M12.25 8.25C12.25 8.11193 12.1381 8 12 8C11.8619 8 11.75 8.11193 11.75 8.25C11.75 8.38807 11.8619 8.5 12 8.5C12.1381 8.5 12.25 8.38807 12.25 8.25Z\"/></svg></span></div><div class=\"up-th\">Actions</div></div><div class=\"up-tbody\" id=\"upr-results-body\"></div></div></div><div class=\"upr-results-empty\"><div class=\"up-box\"><div class=\"up-empty\"><div class=\"up-empty-ic\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M3 7V5a2 2 0 0 1 2-2h2\"></path><path d=\"M17 3h2a2 2 0 0 1 2 2v2\"></path><path d=\"M21 17v2a2 2 0 0 1-2 2h-2\"></path><path d=\"M7 21H5a2 2 0 0 1-2-2v-2\"></path><circle cx=\"12\" cy=\"12\" r=\"3\"></circle><path d=\"m16 16-1.9-1.9\"></path></svg></div><div class=\"up-empty-h\">No suggested prompts found</div><div class=\"up-empty-t\">Start a new prompt research to generate suggestions.</div></div></div></div></div><!-- ---------- loader ---------- --><div class=\"upr-loading-stage\" aria-hidden=\"true\"><!-- Das Ladebild baut prompt-research.js beim Start (ladebildSetzen, UC.makeLadebild aus core, seit dem 01.10.) -- auch in einem schon eingebauten Element, dessen Kasten noch die alte Fassung mit Balken traegt: der Kasten wird dabei geleert. Hier steht darum nur, was bleibt: der Platz fuer die Themen-Chips. --><div class=\"upr-loading-inner\"><div class=\"upr-tl-tags\" id=\"upr-tl-tags\"></div></div></div></div><!-- ---------- previous researches sidebar ---------- Stays inside the root in the markup so it is easy to find; the script moves it to <body> on init (see the note at the top). Do not reparent it by hand. --><div class=\"upr-side-scrim\"></div><aside class=\"upr-side\" role=\"dialog\" aria-modal=\"true\" aria-label=\"Previous researches\"><div class=\"upr-side-head\"><div class=\"up-heading has-count\"><span class=\"up-head-label\">Previous researches</span><span class=\"up-head-sep\"></span><span class=\"up-head-count\" id=\"upr-history-count\">0</span></div><div class=\"up-head-tools\"><button class=\"up-iconbtn\" type=\"button\" id=\"upr-close-history\" data-tip=\"Close\" aria-label=\"Close previous researches\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 6L6.00081 17.9992M17.9992 18L6 6.00085\"/></svg></button></div></div><div class=\"upr-side-body\" id=\"upr-history-list\"></div></aside><!-- Optional server-rendered seeds. Leave them as empty arrays and use setMarkets()/setTags() instead unless you really want the data in the initial HTML. --><script class=\"upr-json\" id=\"upr-markets-json\" type=\"application/json\">[]</script><script class=\"upr-json\" id=\"upr-suggested-keywords-json\" type=\"application/json\">[]</script></div>"
  };
  /* ---- MARKUP ENDE ---- */

  function ursStart() {
  var UC = window.UpstreemCore, D = window.UpstreemPromptResearchDaten, C = window.UpstreemCitationsDaten;
  var esc = UC.esc, t = UC.t || function (x) { return x; };
  /* Je Instanz ueber einen Neuaufbau hinweg (Themenwechsel): der Lader, das Team, ein laufender
     Job samt Abfrage, das geoeffnete Ergebnis. Die Abfrage gehoert NICHT der Wurzel -- sie spricht
     mit window.upstreemPromptResearch, und das gehoert immer der zuletzt aufgebauten. */
  var STORE = (window.__ursStore = window.__ursStore || {});

  function str(v) { return v == null || typeof v === "object" ? "" : String(v); }
  function team() { try { return (UC.getTeam && UC.getTeam()) || ""; } catch (e) { return ""; } }
  function satz(txt, icon) { if (UC.toast) UC.toast(t(txt), icon ? { icon: icon } : undefined); }
  function beiSicht(el, schluessel, fn, test, o) { if (UC.beiSicht) UC.beiSicht(el, schluessel, fn, test, o); else fn(); }
  function messbar(el) { return !UC.messbar || UC.messbar(el); }
  /* Die Komponente ist ein Einzelstueck mit Namensraum; jeder Aufruf geht ueber sie. */
  function pr(name) {
    var a = window.upstreemPromptResearch, args = [].slice.call(arguments, 1);
    if (!a || typeof a[name] !== "function") return;
    try { a[name].apply(null, args); } catch (e) { if (window.console) console.error("[prompt-research-page] " + name + ":", e); }
  }
  function warte(ms) { return new Promise(function (w) { setTimeout(w, ms); }); }
  /* Schreiben mit EINER Wiederholung bei XX000 nach 300 ms (Vertrag 1). */
  function schreiben(a) {
    function einmal() { return UC.rpc(a.fn, a.params, { timeoutMs: 20000 }); }
    return einmal().then(function (erg) {
      if (!erg.ok && erg.fehler && erg.fehler.code === "XX000") return warte(300).then(einmal);
      return erg;
    });
  }

  /* Die Ereignisse der Komponente gehen an window -- EINMAL je Seite verdrahtet, sie landen beim
     aktuellen Steuerteil. */
  var aktiv = null;

  function initRoot(root) {
    if (root.__ursCtrl) return root.__ursCtrl;
    var instanceId = str(root.getAttribute("data-instance")).trim() || "prompt_research_page";
    if (instanceId === "INSTANCE_ID") return null;
    var neu = !STORE[instanceId];
    var gem = STORE[instanceId] || (STORE[instanceId] = {});
    var lader = gem.lader || (gem.lader = C.makeLader({
      rufen: function (fn, params, o) { return UC.rpc(fn, params, { signal: o && o.signal, timeoutMs: 20000 }); }
    }));

    function isDark() { return (UC.themeParam && UC.themeParam(root.getAttribute("data-isdark"))) || root.getAttribute("data-theme") === "dark"; }
    root.innerHTML = String(MARKUP.upr || "").split("__URS_UPR__").join(esc(instanceId + "_research"))
      .split("__URS_DARK__").join(isDark() ? "yes" : "no");

    /* ---- Maerkte und Themen aus core ------------------------------------------------------
       Beim ersten Aufbau einmal hinein, danach jede Aenderung. Nach einem Neuaufbau nicht noch
       einmal: die Komponente bringt ihren Stand dann selbst aus ihrem Vorrat mit. */
    function maerkteGeben(liste) { if (liste && liste.length) pr("setMarkets", liste); }
    function themenGeben(liste) { pr("setTags", liste || []); }
    if (neu) {
      if (UC.getAllMarkets) maerkteGeben(UC.getAllMarkets());
      if (UC.getTopics && UC.topicsAge && UC.topicsAge() !== Infinity) themenGeben(UC.getTopics());
    }
    if (UC.onAllMarkets) UC.onAllMarkets(maerkteGeben, root);
    if (UC.onTopics) UC.onTopics(themenGeben, root);

    /* ---- Liste der Recherchen --------------------------------------------------------------- */
    function sichtbarTest(el) { return el.isConnected !== false && (!UC.istSichtbar || UC.istSichtbar(el)); }
    function jobsLaden(frisch) {
      var tm = team();
      if (!tm) return Promise.resolve(null);
      return lader.laden("jobs", D.jobs(tm), { frisch: !!frisch }).then(function (erg) {
        if (erg.ueberholt || tm !== team()) return null;
        var j = erg.ok ? D.zuJobs(erg.daten) : null;
        if (!j) { pr("setHistoryError"); return null; }
        pr("setPreviousResearches", j.rows);
        /* Ein Job, den diese Seite noch nicht beobachtet (Neuladen waehrend des Laufs, anderer
           Tab, ein Start, den die DB als "reused" beantwortet hat): Ladebild und Abfrage. */
        if (j.laufend && (!gem.lauf || gem.lauf.id !== str(j.laufend.job_id))) beobachten(j.laufend, tm);
        return j;
      });
    }
    function laden(frisch) {
      if (!sichtbarTest(root)) { beiSicht(root, "laden", function () { laden(frisch); }, sichtbarTest); return; }
      jobsLaden(frisch);
    }

    /* ---- Laufender Job ---------------------------------------------------------------------- */
    var TAKT = 3000;
    /* Der Aufraeumer der DB setzt einen Job nach 10 min ohne Aenderung auf error (Vertrag 3.5);
       zwei Minuten darueber gibt die Seite auf, falls auch das ausbleibt. */
    var HOECHSTENS = 12 * 60 * 1000;
    var FEHLVERSUCHE = 5;
    function abfrageStop() { if (gem.abfrage) { clearTimeout(gem.abfrage); gem.abfrage = null; } }
    function laufEnde() { abfrageStop(); gem.lauf = null; }
    function beobachten(job, tm) {
      laufEnde();
      gem.lauf = { id: str(job.job_id), team: tm, seit: Date.now(), fehl: 0 };
      pr("setResearchMeta", job);
      pr("setRunning");
      abfragen();
    }
    function abfragen() {
      abfrageStop();
      var lauf = gem.lauf;
      if (!lauf) return;
      gem.abfrage = setTimeout(function () {
        gem.abfrage = null;
        if (gem.lauf !== lauf) return;
        if (lauf.team !== team()) { laufEnde(); return; }
        if (Date.now() - lauf.seit > HOECHSTENS) {
          laufEnde();
          pr("setError", t(D.jobFehlerSatz("timeout")));
          jobsLaden(true);
          return;
        }
        var a = D.ergebnis(lauf.team, lauf.id);
        UC.rpc(a.fn, a.params, { timeoutMs: 15000 }).then(function (erg) {
          if (gem.lauf !== lauf) return;
          var z = erg.ok ? D.zuErgebnis(erg.daten) : null;
          if (!z) {
            var art = D.fehlerArt(erg);
            if (erg.ok || art === "weg") {
              laufEnde();
              pr("setError", t(erg.ok ? "The research could not be read. Please reload the page." : "The research was deleted."));
              jobsLaden(true);
              return;
            }
            /* Ein Rate-Limit oder ein Aussetzer: weiterfragen, nach FEHLVERSUCHE am Stueck aufgeben. */
            if (art !== "rate" && ++lauf.fehl >= FEHLVERSUCHE) {
              laufEnde();
              pr("setError", t("The research status could not be loaded. Please reload the page."));
              return;
            }
            abfragen();
            return;
          }
          lauf.fehl = 0;
          if (D.istLauf(z.status)) { abfragen(); return; }
          laufEnde();
          if (z.status === "success") ergebnisZeigen(lauf.id, z, true);
          else pr("setError", t(D.jobFehlerSatz(z.fehlerCode)));
          jobsLaden(true);
        });
      }, TAKT);
    }

    /* ---- Ergebnis --------------------------------------------------------------------------- */
    function kontingent(meta) {
      var k = D.zuKontingent(meta);
      if (!k || !UC.setQuota) return;
      var q = (UC.getQuota && UC.getQuota()) || {};
      if (q.used === k.used && q.total === k.total) return;
      q.used = k.used; q.total = k.total;
      UC.setQuota(q, "prompt-research-page");
    }
    /* frischGelaufen: das Ergebnis eines eben beendeten Laufs -- ohne neue Vorschlaege sagt die
       Seite das, statt still zum Start zurueckzukehren. */
    function ergebnisZeigen(jobId, z, frischGelaufen) {
      gem.offen = z.rows.length ? jobId : null;
      kontingent(z.meta);
      pr("setPrompts", z.rows, z.meta);
      if (!z.rows.length && frischGelaufen) satz("The research found no new prompts.", "info");
    }
    function oeffnen(jobId) {
      var tm = team();
      if (!tm || !jobId) return;
      gem.offen = jobId;
      lader.laden("ergebnis", D.ergebnis(tm, jobId), { frisch: true }).then(function (erg) {
        if (erg.ueberholt || tm !== team() || gem.offen !== jobId) return;
        var z = erg.ok ? D.zuErgebnis(erg.daten) : null;
        if (z) { ergebnisZeigen(jobId, z, false); return; }
        gem.offen = null;
        var art = D.fehlerArt(erg);
        pr("setError", t(art === "weg" ? "This research no longer exists." : "The research could not be loaded. Please try again."));
        if (art === "weg") jobsLaden(true);
      });
    }

    /* ---- Start ------------------------------------------------------------------------------ */
    function starten(d) {
      var tm = team();
      if (!tm) { pr("setError", t("The research could not be started. Please reload the page.")); return; }
      var body = D.startBody(tm, d);
      if (!body.params.keywords.length) { pr("setError", t("Enter at least one keyword to start a research.")); return; }
      if (!body.params.market) { pr("setError", t("Choose a market in the research settings.")); return; }
      if (gem.lauf) return;
      if (!UC.edge) { pr("setError", t("Prompt research is not available yet.")); return; }
      gem.offen = null;
      /* Ein Platzhalter, bis die Antwort die Id bringt: ein zweiter Start in dieser Zeit tut nichts. */
      gem.lauf = { id: "", team: tm, seit: Date.now(), fehl: 0 };
      var lauf = gem.lauf;
      UC.edge("start-job", body, { timeoutMs: 30000 }).then(function (erg) {
        if (gem.lauf !== lauf) return;
        var d2 = erg.ok && erg.daten && typeof erg.daten === "object" ? erg.daten : null;
        if (!d2 || !str(d2.job_id)) {
          laufEnde();
          var art = D.fehlerArt(erg), frei = D.hinweisZahl(erg);
          pr("setError", art === "limit"
            ? (frei ? t("Only {n} prompt slots are left in your plan.").replace("{n}", frei) : t("There are no prompt slots left in your plan."))
            : art === "rate" ? t("Too many researches in a short time. Please wait a minute and try again.")
            : art === "nichtDa" ? t("Prompt research is not available yet.")
            : art === "eingabe" ? t("Use 1 to 20 keywords with at most 300 characters in total, and choose a market.")
            : art === "rechte" ? t("You do not have access to this team.")
            : t("The research could not be started. Please try again."));
          return;
        }
        lauf.id = str(d2.job_id);
        /* reused: im Team lief schon eine Recherche, und genau die kommt zurueck -- mit IHREN
           Begriffen, nicht den eben getippten. Die Liste bringt sie mit, jobsLaden zeigt sie. */
        if (d2.reused === true) {
          laufEnde();
          satz("A research is already running for this team.", "info");
          jobsLaden(true);
          return;
        }
        abfragen();
        jobsLaden(true);
      });
    }

    /* ---- Entscheiden und Loeschen (nacheinander) -------------------------------------------- */
    function inReihe(fn) {
      gem.kette = (gem.kette || Promise.resolve()).then(fn, fn);
      return gem.kette;
    }
    function entscheiden(aktion, d) {
      var ids = (d && d.suggested_prompt_ids) || [];
      if (!ids.length) return;
      var akzeptieren = aktion === "accept" || aktion === "accept_all";
      inReihe(function () {
        var tm = team(), jobId = gem.offen;
        if (!tm) return null;
        pr("setActionLoading", true);
        return schreiben(D.entscheiden(tm, akzeptieren ? "accept" : "ignore", ids, d.accept_with_tags)).then(function (erg) {
          if (!erg.ok) {
            pr("setActionLoading", false);
            var art = D.fehlerArt(erg), frei = D.hinweisZahl(erg);
            satz(art === "limit"
              ? (frei ? t("Only {n} prompt slots are left in your plan.").replace("{n}", frei) : t("There are no prompt slots left in your plan."))
              : art === "rate" ? "Too many changes in a short time. Please wait a minute and try again."
              : "The change could not be saved. Please try again.", "info");
            return null;
          }
          var m = erg.daten && erg.daten.meta ? erg.daten.meta : null;
          kontingent(m);
          var n = m ? Number(akzeptieren ? m.accepted : m.ignored) || 0 : 0;
          if (akzeptieren && n) {
            satz(n === 1 ? "1 prompt is now tracked." : t("{n} prompts are now tracked.").replace("{n}", n));
            /* Neue Prompts aendern die Zaehler der Maerkte und Themen der App -- dieselben Signale,
               mit denen jede andere Stelle das meldet. */
            if (UC.marketsChanged) UC.marketsChanged();
            if (UC.topicsChanged) UC.topicsChanged();
          } else if (aktion === "delete_all" && n) satz("Prompts removed.");
          jobsLaden(true);
          if (!jobId || tm !== team()) { pr("setActionLoading", false); return null; }
          return lader.laden("ergebnis", D.ergebnis(tm, jobId), { frisch: true }).then(function (e2) {
            pr("setActionLoading", false);
            if (e2.ueberholt || gem.offen !== jobId) return;
            var z = e2.ok ? D.zuErgebnis(e2.daten) : null;
            if (z) ergebnisZeigen(jobId, z, false);
            else if (D.fehlerArt(e2) === "weg") { gem.offen = null; pr("setIdle"); }
          });
        });
      });
    }
    function loeschen(d) {
      var jobId = str(d && d.job_id);
      if (!jobId) return;
      inReihe(function () {
        var tm = team();
        if (!tm) return null;
        pr("setActionLoading", true);
        return schreiben(D.loeschen(tm, jobId)).then(function (erg) {
          if (!erg.ok && D.fehlerArt(erg) !== "weg") {
            pr("setActionLoading", false);
            satz(D.fehlerArt(erg) === "rate" ? "Too many changes in a short time. Please wait a minute and try again."
                                             : "The research could not be deleted. Please try again.", "info");
            return null;
          }
          satz("Research deleted.");
          if (gem.offen === jobId) { gem.offen = null; pr("setIdle"); }
          /* setPreviousResearches gibt die Knoepfe wieder frei. */
          return jobsLaden(true).then(function (j) { if (!j) pr("setActionLoading", false); });
        });
      });
    }

    /* ---- Teamwechsel: frisch, die Ergebnisse gehoeren zum alten Team ------------------------ */
    if (UC.onTeamChange) UC.onTeamChange(function () {
      if (gem.team === team()) return;
      gem.team = team();
      laufEnde();
      gem.offen = null;
      lader.leeren();
      pr("closeHistory");
      pr("setIdle");
      laden(true);
    }, root);

    var ctrl = {
      root: root,
      starten: starten, oeffnen: oeffnen, entscheiden: entscheiden, loeschen: loeschen,
      neuLaden: function () { lader.leeren(); laden(true); },
      reset: function () { laufEnde(); gem.offen = null; lader.leeren(); pr("setIdle"); laden(true); return true; }
    };
    root.__ursCtrl = ctrl;
    aktiv = ctrl;
    gem.team = gem.team || team();
    /* Nach einem Neuaufbau aus dem Speicher; ein laufender Job fragt schon weiter. */
    setTimeout(function () { laden(false); }, 0);
    return ctrl;
  }

  function steuer() { return aktiv && aktiv.root.isConnected !== false ? aktiv : null; }
  if (!window.__ursVerdrahtet) {
    window.__ursVerdrahtet = true;
    function an(name, fn) {
      window.addEventListener(name, function (e) { var c = steuer(); if (c) fn(c, (e && e.detail) || {}); });
    }
    an("upstreem:start-prompt-research", function (c, d) { c.starten(d); });
    an("upstreem:open-prompt-research-job", function (c, d) { c.oeffnen(str(d.job_id)); });
    an("upstreem:delete-prompt-research", function (c, d) { c.loeschen(d); });
    ["accept", "ignore", "accept_all", "delete_all"].forEach(function (k) {
      an("upstreem:suggested-prompt:" + k, function (c, d) { c.entscheiden(k, d); });
    });
  }

  function alle() { return [].slice.call(document.querySelectorAll(".urs-root")); }
  window.resetPromptResearchPage = function (id) {
    alle().filter(function (x) { return id == null || str(x.getAttribute("data-instance")) === String(id); })
      .forEach(function (x) { var c = initRoot(x); if (c) c.reset(); });
  };
  function einrichten() {
    alle().forEach(function (r) {
      if (r.__ursCtrl) return;
      if (messbar(r)) { initRoot(r); return; }
      var neu = !(UC.wartetAufSicht && UC.wartetAufSicht(r));
      beiSicht(r, "einrichten", function () { initRoot(r); }, messbar, { lang: neu });
    });
  }
  if (UC.watchRoots) UC.watchRoots("urs-root", einrichten);
  einrichten();
  Q.splice(0).forEach(function (q) { try { window[q[0]].apply(null, q[1]); } catch (e) {} });
  }

  ursBoot(30);
})();
