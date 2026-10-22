/* upstreem mira-page.js -- die Mira-Seite als EINE Komponente (10.10.). Praefix umi.

   Wie die anderen Seiten: die Seite laedt und schreibt selbst und bettet die ECHTE Komponente ein
   (ask-mira.js, lokaler Modus). Die Komponente bleibt, wie sie ist -- die Seite uebernimmt genau
   die Rolle, die bisher Bubbles Workflows hatten: sie hoert auf die Daten-Ereignisse der
   Komponente (upstreem:askmira { name, wert }, dieselben Namen und Nutzlasten wie die
   bubble_fn_ask_mira_*) und antwortet ueber dieselben Setter (askMiraSetMessages,
   askMiraSetPreviousChats, askMiraRealtime, ...).
   Vertrag D in bubble/seiten_db_vorschlag_2.md, Abschnitt 15; Anfragen in mira-data.js.

   REALTIME: EIN privater Kanal user:<uid> (UC.kanal mit privat), beim Oeffnen und vor dem ersten
   Senden. Ereignisse eines anderen Teams fallen weg. Die Seite fuehrt je Chat die Nachrichten mit
   (Laden beim Oeffnen, dazu user_message und message aus den Ereignissen) und beantwortet damit
   das Nachfassen der Komponente (refresh_chat) OHNE Netz -- Abrufe gibt es nur beim Oeffnen eines
   Chats, nach einem Wiederverbinden (mira_turn_status_v1, bei Aenderung die Nachrichten), einmal
   nach 11 Minuten, falls eine Antwort dann noch laeuft, und bei content_omitted.

   BLEIBT BEI BUBBLE: alles, was Navigation in der App ist -- Evidence oeffnen, Opportunity anlegen
   oder verschieben, Mira-Aktionen, die Entitaetssuche im Plus (Quick Actions). */
(function () {
  "use strict";

  var API_NAMES = ["resetMiraPage"];
  var Q = (window.__umiBootQueue = window.__umiBootQueue || []);
  API_NAMES.forEach(function (n) {
    if (!window[n]) window[n] = function () { Q.push([n, [].slice.call(arguments)]); };
  });

  function umiBoot(triesLeft) {
    if (!window.UpstreemCore || !window.UpstreemMiraDaten || !window.UpstreemCitationsDaten) {
      if (triesLeft > 0) { setTimeout(function () { umiBoot(triesLeft - 1); }, 100); return; }
      if (window.console) console.error("[mira-page] core.js, mira-data.js oder citations-data.js nicht geladen");
      return;
    }
    umiStart();
  }

  /* ---- MARKUP ANFANG (erzeugt von .mira_markup.py -- nicht von Hand aendern) ---- */
  var MARKUP = {
    am: "<div class=\"up-root am-root\" data-local=\"yes\" id=\"ask-mira\" data-instance=\"__UMI_AM__\" data-cdn-pin=\"\" data-isdark=\"__UMI_DARK__\"><div class=\"am-shell\"><!-- ===================== HERO ===================== --><header class=\"am-hero\"><div class=\"am-hero-inner\"><div class=\"am-hero-text\"><div class=\"am-title-row\"><span class=\"am-brand\"><span class=\"am-logo-mark\" aria-hidden=\"true\"></span><span class=\"am-wordmark\">mira</span></span><span class=\"am-status-pill\" id=\"am-status-pill\"><span class=\"am-status-dot\"></span><span id=\"am-status-text\">Ready</span></span></div><p class=\"am-subline\">Chat with your AI Search data.</p></div><div class=\"am-chat-titlebar\" id=\"am-chat-titlebar\" aria-hidden=\"true\"><button class=\"am-ct-back\" id=\"am-ct-back\" type=\"button\" aria-label=\"Back to start\" data-tip=\"Back to start\"><svg width=\"24\" height=\"24\" viewBox=\"0 0 24 24\"><path d=\"M15 6C15 6 9.00001 10.4189 9 12C8.99999 13.5812 15 18 15 18\"/></svg></button><button class=\"am-ct-name\" id=\"am-ct-name\" type=\"button\" data-tip=\"Rename chat\"><span class=\"am-ct-text\" id=\"am-ct-text\"></span><span class=\"am-ct-skeleton\" id=\"am-ct-skeleton\" aria-hidden=\"true\"></span></button><button class=\"am-ct-chev\" id=\"am-ct-chev\" type=\"button\" aria-label=\"Chat options\" aria-haspopup=\"menu\"><svg width=\"24\" height=\"24\" viewBox=\"0 0 24 24\"><path d=\"M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9\"/></svg></button><input class=\"am-ct-input\" id=\"am-ct-input\" type=\"text\" maxlength=\"120\" aria-label=\"Chat name\"><span class=\"am-ct-edit-actions\" id=\"am-ct-edit-actions\"><button class=\"am-ct-mini\" id=\"am-ct-save\" type=\"button\" data-tip=\"Save\"><svg width=\"24\" height=\"24\" viewBox=\"0 0 24 24\"><path d=\"M5 13.2592L7.58583 15.9568C8.2525 16.6523 8.58583 17 9.00004 17C9.41425 17 9.74759 16.6523 10.4143 15.9568L19 7\"/></svg></button><button class=\"am-ct-mini\" id=\"am-ct-discard\" type=\"button\" data-tip=\"Discard\"><svg width=\"24\" height=\"24\" viewBox=\"0 0 24 24\"><path d=\"M18 6L6.00081 17.9992M17.9992 18L6 6.00085\"/></svg></button></span></div><button class=\"am-ghost-btn am-prev-btn\" type=\"button\" id=\"am-open-prev\"><svg width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" class=\"am-ic am-prev-ic\"><path d=\"M11 3H13C16.7712 3 18.6569 3 19.8284 4.17157C21 5.34315 21 7.22876 21 11V13C21 16.7712 21 18.6569 19.8284 19.8284C18.6569 21 16.7712 21 13 21H11C7.22876 21 5.34315 21 4.17157 19.8284C3 18.6569 3 16.7712 3 13V11C3 7.22876 3 5.34315 4.17157 4.17157C5.34315 3 7.22876 3 11 3Z\"/><path d=\"M8.00488 16.0049L8.00488 8.00488\"/></svg><span class=\"am-prev-label-full\">All Chats</span><span class=\"am-prev-label-short\">Chats</span></button></div></header><!-- ===================== CHAT VIEW ===================== --><main class=\"am-chat\" id=\"am-chat\"><div class=\"am-messages\" id=\"am-messages\"></div><!-- Suggested questions (shown when empty) --><div class=\"am-suggested\" id=\"am-suggested\"><div class=\"am-welcome\"><h2 class=\"am-welcome-title\" id=\"am-welcome-title\">How can I help you today?</h2></div><p class=\"am-suggested-label\" id=\"am-suggested-label\">Try asking</p><div class=\"am-suggested-grid\" id=\"am-suggested-grid\"></div><div class=\"am-quick\" id=\"am-quick\" aria-label=\"Quick actions\"></div></div></main><!-- ===================== COMPOSER ===================== --><footer class=\"am-composer-area\"><button class=\"am-scroll-bottom\" type=\"button\" id=\"am-scroll-bottom\" aria-label=\"Scroll to latest\"><svg width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9\"/></svg></button><div class=\"am-composer-shell\" id=\"am-composer-shell\"><!-- ZWEITE FASSUNG (08.09.). Was hier stand: Textzeile und Aktionsspalte nebeneinander, ein Fader-Knopf und darunter ein ausklappbares Fach mit \"Answer detail\" und der Modellwahl. Beides ist weg -- Modell UND Aufwand liegen jetzt in EINER Schaltflaeche unten links, deren Menue nach oben aufgeht, und links davon ein Plus fuer den Entitaets-Picker. WICHTIG FUER EINEN BESTEHENDEN EINBAU: ask-mira.js baut das alte Markup zur Laufzeit selbst auf diese Fassung um (composerUmbauen). Wer sein Element in Bubble nicht anfasst, bekommt die neue Leiste trotzdem -- dieses Markup hier ist die Aufraeumarbeit fuer NEUINSTALLATIONEN, keine Voraussetzung. --><div class=\"am-composer is-v2\" id=\"am-composer\" data-am-composer=\"v5\"><!-- Der Picker: oberhalb des Feldes, auf seiner ganzen Breite. Er haengt AN .am-composer (position: relative) und nicht am Koerper: im Top Layer waere die volle Breite des Feldes nicht mehr herstellbar. --><div class=\"am-pick-panel\" id=\"am-pick-panel\" aria-hidden=\"true\"><div class=\"am-pick-search\"><svg width=\"24\" height=\"24\" class=\"am-pick-sic\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M17 17L21 21\"/><path d=\"M19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19C15.4183 19 19 15.4183 19 11Z\"/></svg><span class=\"am-pick-chips\" id=\"am-pick-chips\"></span><span class=\"am-pick-inwrap\"><input class=\"am-pick-input\" id=\"am-pick-input\" type=\"text\" autocomplete=\"off\" spellcheck=\"false\" aria-label=\"Search your workspace\"></span><span class=\"am-pick-count\" id=\"am-pick-count\"></span></div><!-- Ueberschrift UND Chips in EINER Zeile, 16px auseinander, links ausgerichtet. --><div class=\"am-pick-crow\" id=\"am-pick-crow\"><p class=\"am-pick-h\" id=\"am-pick-h\"></p><!-- An der Stelle des frueheren Umschalters: die Befehle als Chips -- Brand, Prompt, Domain, URL. Getippt werden sie ueber \"/\" wie in Quick Actions. --><div class=\"am-pick-cmds\" id=\"am-pick-cmds\"></div></div><div class=\"am-pick-scroll\" id=\"am-pick-scroll\"><div class=\"am-pick-list\" id=\"am-pick-list\" role=\"listbox\" aria-live=\"polite\"></div></div></div><div class=\"am-quote-slot\" id=\"am-quote-slot\"></div><div class=\"am-input-wrap\"><!-- Die uebernommenen Bezuege stehen IM Textfeld, als erstes -- wie in Prompt Research (11.09.). Der Text geht direkt hinter der letzten Pille weiter: das Textfeld bekommt dafuer einen Einzug, den ask-mira.js aus der Lage der Pillen rechnet. ask-mira.js haengt den Streifen auch in einem aelteren eingebauten Element hierher um -- diese Stelle ist die Aufraeumarbeit fuer Neuinstallationen. --><div class=\"am-picks\" id=\"am-picks\"></div><textarea class=\"am-textarea\" id=\"am-textarea\" rows=\"1\" maxlength=\"2800\" placeholder=\"\"></textarea><div class=\"am-ph-loop\" id=\"am-ph-loop\" aria-hidden=\"true\"><span class=\"am-ph-text\" id=\"am-ph-text\">Ask Mira...</span></div></div><div class=\"am-actions\"><div class=\"am-act-l\"><button class=\"am-icon-action am-pick-btn\" type=\"button\" id=\"am-pick-btn\" aria-label=\"Add a reference\" aria-expanded=\"false\" data-tip=\"Add a reference\"><svg width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" class=\"am-ic\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M11.9922 4.00012V20.0001M19.9922 12.0001H3.99222\"/></svg></button></div><div class=\"am-act-r\"><div class=\"am-eff\" id=\"am-eff\"><button class=\"am-eff-btn\" type=\"button\" id=\"am-eff-btn\" aria-haspopup=\"true\" aria-expanded=\"false\"><span class=\"am-eff-name\" id=\"am-eff-name\"></span><span class=\"am-eff-lvl\" id=\"am-eff-lvl\"></span><svg width=\"24\" height=\"24\" class=\"am-eff-chev\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9\"/></svg></button><div class=\"am-eff-menu\" id=\"am-eff-menu\" role=\"dialog\" aria-label=\"Model and effort\"><button class=\"am-eff-head\" type=\"button\" id=\"am-eff-head\" aria-expanded=\"false\"><span class=\"am-eff-hname\" id=\"am-eff-hname\"></span><span class=\"am-eff-hlvl\" id=\"am-eff-hlvl\"></span><svg width=\"24\" height=\"24\" class=\"am-eff-hchev\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M9.00005 18C9.00005 18 15 13.5811 15 12C15 10.4188 9 6 9 6\"/></svg></button><!-- EIN Rumpf um beide Ansichten; seine Hoehe setzt ask-mira.js gemessen, damit das Menue beim Umschalten weich waechst statt zu springen. --><div class=\"am-eff-body\" id=\"am-eff-body\"><div class=\"am-eff-pane am-eff-slider\" id=\"am-eff-slider\"><div class=\"am-eff-track\" id=\"am-eff-track\" role=\"slider\" tabindex=\"0\" aria-valuemin=\"0\" aria-valuemax=\"2\" aria-valuenow=\"1\"><span class=\"am-eff-fill\" id=\"am-eff-fill\"></span><span class=\"am-eff-ultra\" id=\"am-eff-ultra\" aria-hidden=\"true\"><!-- Die Punkte in EIGENER Schicht: nur sie tragen den Ausblender nach links, der Verlauf darunter steht auf ganzer Breite. --><span class=\"am-eff-dots\" id=\"am-eff-dots\"></span></span><span class=\"am-eff-dot\" data-i=\"0\"></span><span class=\"am-eff-dot\" data-i=\"1\"></span><span class=\"am-eff-dot\" data-i=\"2\"></span><span class=\"am-eff-thumb\" id=\"am-eff-thumb\"></span></div><div class=\"am-eff-labels\" id=\"am-eff-labels\"></div></div><div class=\"am-eff-pane am-eff-models\" id=\"am-eff-models\"></div><p class=\"am-eff-note\" id=\"am-eff-note\"></p></div></div></div><button class=\"am-icon-action am-mic\" type=\"button\" id=\"am-mic\" aria-label=\"Voice input\"><svg width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" class=\"am-ic\"><path d=\"M7 6.5C7 4.01472 9.01472 2 11.5 2C13.9853 2 16 4.01472 16 6.5V11.5C16 13.9853 13.9853 16 11.5 16C9.01472 16 7 13.9853 7 11.5V6.5Z\"/><path d=\"M11.5 19H11.0828C7.57267 19 4.57706 16.4623 4 13M11.5 19H11.9172C15.4273 19 18.4229 16.4623 19 13M11.5 19V22\"/></svg></button><button class=\"am-send\" type=\"button\" id=\"am-send\" aria-label=\"Send message\"><svg width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" class=\"am-ic am-ic-send\"><path d=\"M12 19V5\"/><path d=\"M5 12L12 5L19 12\"/></svg><span class=\"am-send-spinner\" aria-hidden=\"true\"></span></button></div></div><div class=\"am-rec\" id=\"am-rec\" aria-hidden=\"true\"><span class=\"am-rec-live\"><span class=\"am-rec-dot\"></span><span class=\"am-rec-time\" id=\"am-rec-time\">0:00</span></span><div class=\"am-rec-wave\"><canvas class=\"am-rec-canvas\" id=\"am-rec-canvas\"></canvas></div><span class=\"am-rec-spring\"></span><div class=\"am-rec-actions\"><button class=\"am-rec-btn am-rec-cancel\" type=\"button\" id=\"am-rec-cancel\" aria-label=\"Discard recording\"><svg width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" class=\"am-ic\"><path d=\"M18 6L6.00081 17.9992M17.9992 18L6 6.00085\"/></svg></button><button class=\"am-rec-btn am-rec-confirm\" type=\"button\" id=\"am-rec-confirm\" aria-label=\"Send recording\"><svg width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" class=\"am-ic\"><path d=\"M5 13.2592L7.58583 15.9568C8.2525 16.6523 8.58583 17 9.00004 17C9.41425 17 9.74759 16.6523 10.4143 15.9568L19 7\"/></svg></button></div></div></div><div class=\"am-rec-note\" id=\"am-rec-note\" role=\"status\" aria-live=\"polite\"></div></div></footer><!-- ===================== PREVIOUS CHATS PANEL ===================== --><div class=\"am-prev-scrim\" id=\"am-prev-scrim\" hidden></div><aside class=\"am-prev-panel\" id=\"am-prev-panel\" aria-hidden=\"true\"><div class=\"am-prev-head\"><p class=\"am-prev-title\">Previous chats</p><button class=\"am-icon-btn\" type=\"button\" id=\"am-close-prev\" aria-label=\"Close\"><svg width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" class=\"am-ic\"><path d=\"M18 6L6.00081 17.9992M17.9992 18L6 6.00085\"/></svg></button></div><div class=\"am-prev-toolbar\"><button class=\"am-newchat\" type=\"button\" id=\"am-new-chat\"><svg width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" class=\"am-ic\"><path d=\"M11.9922 4.00012V20.0001M19.9922 12.0001H3.99222\"/></svg><span>New Chat</span></button><button class=\"am-settings-btn\" type=\"button\" id=\"am-settings-btn\" aria-label=\"Settings\" data-tip=\"Settings\" aria-expanded=\"false\"></button></div><div class=\"am-hl-panel\" id=\"am-hl-settings-panel\"><div class=\"am-set-row\"><label class=\"am-set-label\">Brand Highlights</label><div class=\"am-dd\" id=\"am-dd-brand\" data-set=\"brand\"><button class=\"am-dd-trigger\" type=\"button\" aria-haspopup=\"listbox\" aria-expanded=\"false\"><span class=\"am-dd-value\">Logo</span><svg width=\"24\" height=\"24\" class=\"am-dd-chev\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9\"/></svg></button><div class=\"am-dd-menu\" role=\"listbox\"><button class=\"am-dd-opt\" type=\"button\" role=\"option\" data-value=\"logo\"><span class=\"am-dd-check\"></span><span>Logo</span><span></span></button><button class=\"am-dd-opt\" type=\"button\" role=\"option\" data-value=\"icon\"><span class=\"am-dd-check\"></span><span>Icon</span><span></span></button><button class=\"am-dd-opt\" type=\"button\" role=\"option\" data-value=\"none\"><span class=\"am-dd-check\"></span><span>No Highlight</span><span></span></button></div></div></div><div class=\"am-set-row\"><label class=\"am-set-label\">Citation Highlights</label><div class=\"am-dd\" id=\"am-dd-citation\" data-set=\"citation\"><button class=\"am-dd-trigger\" type=\"button\" aria-haspopup=\"listbox\" aria-expanded=\"false\"><span class=\"am-dd-value\">Icon</span><svg width=\"24\" height=\"24\" class=\"am-dd-chev\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9\"/></svg></button><div class=\"am-dd-menu\" role=\"listbox\"><button class=\"am-dd-opt\" type=\"button\" role=\"option\" data-value=\"icon\"><span class=\"am-dd-check\"></span><span>Icon</span><span></span></button><button class=\"am-dd-opt\" type=\"button\" role=\"option\" data-value=\"favicon\"><span class=\"am-dd-check\"></span><span>Favicon</span><span></span></button><button class=\"am-dd-opt\" type=\"button\" role=\"option\" data-value=\"none\"><span class=\"am-dd-check\"></span><span>No Highlight</span><span></span></button></div></div></div><div class=\"am-set-row\"><label class=\"am-set-label\">Response Highlights</label><div class=\"am-dd\" id=\"am-dd-response\" data-set=\"response\"><button class=\"am-dd-trigger\" type=\"button\" aria-haspopup=\"listbox\" aria-expanded=\"false\"><span class=\"am-dd-value\">Logo</span><svg width=\"24\" height=\"24\" class=\"am-dd-chev\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9\"/></svg></button><div class=\"am-dd-menu\" role=\"listbox\"><button class=\"am-dd-opt\" type=\"button\" role=\"option\" data-value=\"logo\"><span class=\"am-dd-check\"></span><span>Logo</span><span></span></button><button class=\"am-dd-opt\" type=\"button\" role=\"option\" data-value=\"icon\"><span class=\"am-dd-check\"></span><span>Icon</span><span></span></button><button class=\"am-dd-opt\" type=\"button\" role=\"option\" data-value=\"none\"><span class=\"am-dd-check\"></span><span>No Highlight</span><span></span></button></div></div></div></div><div class=\"am-prev-list\" id=\"am-prev-list\"></div></aside></div></div>"
  };
  /* ---- MARKUP ENDE ---- */

  function umiStart() {
  var UC = window.UpstreemCore, D = window.UpstreemMiraDaten, C = window.UpstreemCitationsDaten;
  var esc = UC.esc, t = UC.t || function (x) { return x; };
  /* Die Saetze, die beim Senden an die Stelle der allgemeinen Meldung treten. Bis zum 13.10. ohne
     deutsche Fassung -- auf Deutsch kamen sie englisch. Keiner der Schluessel steht in core. */
  if (UC.addMessages) UC.addMessages("de", {
    "Mira is still answering in this chat. Wait for the answer, then send again.":
      "Mira antwortet in diesem Chat noch. Warte auf die Antwort und sende dann erneut.",
    "Too many messages in a short time. Wait a minute and try again.":
      "Zu viele Nachrichten in kurzer Zeit. Warte eine Minute und versuch es noch einmal.",
    "Too many messages in a short time.": "Zu viele Nachrichten in kurzer Zeit.",
    "Mira couldn't start this answer. Try again.": "Mira konnte diese Antwort nicht starten. Versuch es noch einmal.",
    "This message couldn't be sent. Shorten it and try again.":
      "Diese Nachricht konnte nicht gesendet werden. Kürze sie und versuch es noch einmal.",
    "You don't have access to this team.": "Du hast keinen Zugriff auf dieses Team.",
    "Mira couldn't be reached. Check your connection and try again.":
      "Mira ist gerade nicht erreichbar. Prüf deine Verbindung und versuch es noch einmal.",
    "Mira is taking too long to respond. Try again in a moment.":
      "Mira braucht gerade zu lange. Versuch es gleich noch einmal.",
    /* Neuer Weg (P2, /api/mira) */
    "Your team has used this month's Mira allowance.": "Dein Team hat das Mira-Kontingent für diesen Monat aufgebraucht.",
    "It resets on {datum}.": "Es wird am {datum} zurückgesetzt.",
    "You've reached today's limit for Mira. Try again tomorrow.": "Du hast das heutige Limit für Mira erreicht. Versuch es morgen noch einmal.",
    "Mira is already answering two of your questions. Wait for one of them, then send again.":
      "Mira beantwortet schon zwei deiner Fragen. Warte auf eine davon und sende dann erneut.",
    "This message is already being answered.": "Diese Nachricht wird schon beantwortet.",
    "Your session has expired. Reload the page and sign in again.": "Deine Sitzung ist abgelaufen. Lade die Seite neu und melde dich wieder an.",
    "This answer couldn't be saved": "Diese Antwort konnte nicht gespeichert werden",
    "Couldn't start this action": "Diese Aktion konnte nicht gestartet werden",
    "This action isn't available yet.": "Diese Aktion ist noch nicht verfügbar.",
    "This can no longer be undone.": "Das lässt sich nicht mehr rückgängig machen.",
    "This action has already been started.": "Diese Aktion wurde schon gestartet.",
    "You already have a research running.": "Bei dir läuft schon eine Recherche.",
    "Your plan has no free brand slots.": "Dein Tarif hat keinen freien Markenplatz mehr.",
    "Mira couldn't hear anything. Try again a little louder.": "Mira hat nichts verstanden. Versuch es etwas lauter noch einmal.",
    "Voice messages can be up to 30 seconds long.": "Sprachnachrichten dürfen höchstens 30 Sekunden lang sein.",
    "This browser can't convert the recording. Type your question instead.": "Dieser Browser kann die Aufnahme nicht umwandeln. Tippe deine Frage stattdessen."
  });
  /* Je Instanz ueber einen Neuaufbau hinweg (Themenwechsel): Lader, Kanal, die Nachrichten je
     Chat, laufende Antworten. Nichts davon gehoert der Wurzel. */
  var STORE = (window.__umiStore = window.__umiStore || {});

  function str(v) { return v == null || typeof v === "object" ? "" : String(v); }
  function team() { try { return (UC.getTeam && UC.getTeam()) || ""; } catch (e) { return ""; } }
  function satz(txt, art, desc) { if (UC.toast) UC.toast(t(txt), { kind: art || "success", desc: desc ? t(desc) : "" }); }
  function beiSicht(el, schluessel, fn, test, o) { if (UC.beiSicht) UC.beiSicht(el, schluessel, fn, test, o); else fn(); }
  function am(name) {
    var f = window[name], args = [].slice.call(arguments, 1);
    if (typeof f !== "function") return undefined;
    try { return f.apply(null, args); } catch (e) { if (window.console) console.error("[mira-page] " + name + ":", e); }
    return undefined;
  }
  function zustand() { return window.askMiraState || {}; }
  function offenerChat() { return str(zustand().activeChatId); }
  function lesen(wert) {
    if (wert == null) return {};
    if (typeof wert === "object") return wert;
    try { return JSON.parse(String(wert)); } catch (e) { return { wert: String(wert) }; }
  }
  function warte(ms) { return new Promise(function (w) { setTimeout(w, ms); }); }
  /* Schreiben mit EINER Wiederholung bei XX000 (Vertrag 1). */
  function schreiben(a) {
    function einmal() { return UC.rpc(a.fn, a.params, { timeoutMs: 20000 }); }
    return einmal().then(function (erg) {
      if (!erg.ok && erg.fehler && erg.fehler.code === "XX000") return warte(300).then(einmal);
      return erg;
    });
  }

  var aktiv = null;

  function initRoot(root) {
    if (root.__umiCtrl) return root.__umiCtrl;
    var instanceId = str(root.getAttribute("data-instance")).trim() || "mira_page";
    if (instanceId === "INSTANCE_ID") return null;
    var neu = !STORE[instanceId];
    var gem = STORE[instanceId] || (STORE[instanceId] = { cache: {}, laufend: {}, uhren: {} });
    var lader = gem.lader || (gem.lader = C.makeLader({
      rufen: function (fn, params, o) { return UC.rpc(fn, params, { signal: o && o.signal, timeoutMs: 20000 }); }
    }));

    function isDark() { return (UC.themeParam && UC.themeParam(root.getAttribute("data-isdark"))) || root.getAttribute("data-theme") === "dark"; }
    /* DIE HUELLE HAT KEINEN EIGENEN KASTEN (10.10. gemeldet: "Mira hat teils doppelt bis dreifach
       so viel Hoehe wie die Seite, die Leiste klappt unglaublich weit auf"). Mira nimmt ihre Hoehe
       per height: 100% von ihrem Elternteil -- bis heute direkt Bubbles HTML-Element. Mit der
       Huelle dazwischen hing das an deren Hoehe, und stand die nicht fest, wuchs Mira mit ihrer
       Chatliste. display: contents stellt genau den alten Aufbau her: Mira ist wieder Kind des
       HTML-Elements, die Hoehe kommt wie vorher von Bubble. Inline UND in mira-page.css, damit es
       nicht davon abhaengt, dass die CSS-Datei ankommt. */
    root.style.display = "contents";
    root.innerHTML = String(MARKUP.am || "").split("__UMI_AM__").join(esc(instanceId + "_mira"))
      .split("__UMI_DARK__").join(isDark() ? "yes" : "no");
    /* DER UMSCHALTER DER SEITENLEISTE (16.10.): Mira hat keinen Seitenkopf aus core, ihre oberste
       Zeile ist .am-hero-inner ("Chats" rechts, im Chat Zurueck und Name). Dort ganz links derselbe
       Knopf wie in jedem Seitenkopf -- sichtbar nur, wenn die Seitenleiste ganz ausgeblendet ist
       (core.css). Hier und nicht in ask-mira.js: nur die Seite steht in einer Ansicht der App; im
       Power Dashboard (Launcher) ist Miras Kopf ohnehin ausgeblendet. Die Vorlage bleibt, wie
       .mira_markup.py sie erzeugt. */
    var heroZeile = root.querySelector(".am-hero-inner");
    if (heroZeile && UC.seitenleistenKnopfEinsetzen) UC.seitenleistenKnopfEinsetzen(heroZeile, heroZeile.firstElementChild);
    /* Sichtbarkeit an Mira selbst messen: eine Huelle ohne Kasten ist nie "sichtbar". */
    /* Mira wird festgehalten, sobald sie einmal gefunden ist (10.10.): das Power Dashboard leiht
       sie beim Seitenaufbau aus und haengt sie in seinen Platz. Danach steht sie NICHT mehr in
       dieser Huelle -- die Suche darin fand nichts, laden() pruefte statt ihrer die Huelle selbst
       (display: contents, also nie sichtbar) und wartete fuer immer. Im Pruefstand gemessen:
       Dashboard zuerst, dann Mira -- 0 Abrufe, leere Chatliste. */
    var amEl = null;
    function innen() {
      if (!amEl || amEl.isConnected === false) amEl = root.querySelector(".am-root");
      return amEl || root;
    }

    /* ---- Modelle und Themen aus core (bisher Bubble-Schritte) ---------------------------- */
    function modelleGeben(l) { if (l && l.length) am("askMiraSetModels", l); }
    function themenGeben(l) { am("askMiraSetTopics", l || []); }
    if (neu) {
      if (UC.getModels) modelleGeben(UC.getModels());
      if (UC.getTopics && UC.topicsAge && UC.topicsAge() !== Infinity) themenGeben(UC.getTopics());
    }
    if (UC.onModels) UC.onModels(modelleGeben, root);
    if (UC.onTopics) UC.onTopics(themenGeben, root);

    /* ---- Chatliste ---------------------------------------------------------------------- */
    function sichtbarTest(el) { return el.isConnected !== false && (!UC.istSichtbar || UC.istSichtbar(el)); }
    /* Der rote Satz gehoert in die Mira-Ansicht, nicht auf eine fremde Seite, die Mira nur mitfuehrt. */
    function miraOffen() {
      try {
        /* Beim ersten Aufruf der Adresse kennt core die Ansicht noch nicht (""): dann zaehlt die Adresse. */
        var v = UC.currentView ? UC.currentView() : "";
        return v ? v === "mira" : /[?&]view=mira(&|$)/.test(window.location.search);
      } catch (e) { return true; }
    }
    function listeLaden(frisch, leise) {
      var tm = team();
      if (!tm) return Promise.resolve(null);
      return lader.laden("chats", D.chats(tm, 0), { frisch: !!frisch }).then(function (erg) {
        if (erg.ueberholt || tm !== team()) return null;
        var z = erg.ok ? D.zuChats(erg.daten, true) : null;
        /* leise: das Nachfassen im Hintergrund -- scheitert es, bleibt die Liste, die schon da steht,
           und es kommt kein roter Satz aus dem Nichts.
           LEER IST NICHT KAPUTT (17.10., QS-04): die Liste bekommt den Fehlerzustand mit "Try again"
           (sonst stand "No recent chats"). Der rote Satz hoechstens einmal je Ausfall und nur, wo man
           die Liste sieht (Mira-Ansicht): auf dem Dashboard kam er schon beim Start, in 4 von 6 Laeufen
           doppelt (onTeamChange und beiSicht fragen beide). */
        if (!z) {
          am("askMiraSetChatsError", true);
          if (!leise && !gem.chatsFehlerGezeigt && miraOffen()) { gem.chatsFehlerGezeigt = true; satz("Couldn't load your chats", "error", "Try again."); }
          return null;
        }
        gem.chatsFehlerGezeigt = false;
        gem.offset = z.zeilen; gem.mehr = z.mehr; gem.listeFuer = tm;
        am("askMiraSetProjects", z.projekte);
        am("askMiraSetPreviousChats", z.chats);
        return z;
      });
    }
    function weitereChats() {
      var tm = team();
      if (!tm || !gem.mehr) { am("askMiraAppendPreviousChats", []); return; }
      lader.laden("mehr", D.chats(tm, gem.offset || 0), { frisch: true }).then(function (erg) {
        if (erg.ueberholt || tm !== team()) return;
        var z = erg.ok ? D.zuChats(erg.daten, false) : null;
        /* Scheitert die Seite, NICHT das Ende melden (leere Liste) -- sonst fragte die Leiste nie
           wieder. Sie fragt beim naechsten Scrollen erneut. */
        if (!z) return;
        gem.offset = (gem.offset || 0) + z.zeilen; gem.mehr = z.mehr;
        am("askMiraAppendPreviousChats", z.chats);
      });
    }
    function einstellungenLaden() {
      UC.rpc(D.FN.einstellungen, {}, { timeoutMs: 15000 }).then(function (erg) {
        var e = erg.ok ? D.zuEinstellungen(erg.daten) : null;
        if (e) am("askMiraSetSettings", e);
      });
    }

    /* ---- Nachrichten je Chat ----------------------------------------------------------- */
    function cacheSetzen(chat, rows) { gem.cache[chat] = (rows || []).slice(); }
    function cacheEin(chat, msg) {
      var l = gem.cache[chat];
      if (!l || !msg || typeof msg !== "object" || !str(msg.id)) return;
      for (var i = 0; i < l.length; i++) if (str(l[i].id) === str(msg.id)) { l[i] = msg; return; }
      l.push(msg);
    }
    function nachrichtenLaden(chat, zeigen) {
      var tm = team();
      if (!tm || !chat) return Promise.resolve(null);
      /* Ein Kanal je Chat: das Oeffnen von A darf nicht das Nachladen von B abbrechen. */
      /* mira_messages_v2 (P2): wie v1, dazu blocks der Antworten des neuen Wegs -- ohne sie stuende eine
         neue Antwort nach dem Oeffnen nur als reiner Text da. Alte Antworten kommen gleich (content_html). */
      return lader.laden("nachrichten_" + chat, D.nachrichtenNeu(tm, chat), { frisch: true }).then(function (erg) {
        if (erg.ueberholt || tm !== team()) return null;
        var n = erg.ok ? D.zuNachrichten(erg.daten) : null;
        if (!n) {
          if (D.fehlerArt(erg) === "weg") {
            delete gem.cache[chat];
            if (offenerChat() === chat) { satz("This chat no longer exists", "neutral"); am("askMiraNeuerChat"); }
            listeLaden(true);
          } else if (zeigen) satz("Couldn't load this chat", "error", "Try again.");
          return null;
        }
        cacheSetzen(chat, n.rows);
        if (zeigen || offenerChat() === chat) { am("askMiraSetMessages", n.rows.slice(), chat); jobUhrStellen(false); }
        /* Laeuft die letzte Antwort noch (Neuladen, zweiter Tab), haengt sich das Fenster an ihren
           Stream (Q13); geht das nicht, kommt sie wie bisher ueber Realtime. */
        var letzte = n.rows[n.rows.length - 1];
        if (letzte && letzte.role === "assistant" && /^(running|queued)$/.test(str(letzte.status))) anhaengen(chat, str(letzte.id));
        return n;
      });
    }

    /* ---- Der private Kanal ------------------------------------------------------------- */
    function kanalAuf() {
      if (gem.kanal || !UC.kanal) return;
      var uid = UC.nutzerId ? UC.nutzerId() : "";
      if (!uid) return;
      gem.kanalBereit = false;
      gem.kanal = UC.kanal("user:" + uid, {
        privat: true,
        on: { "*": ereignis },
        status: function (art, info) {
          if (art === "verbunden") {
            gem.kanalBereit = true;
            warterLoesen();
            if (info && info.wieder) nachVerbinden();
          } else if (art === "fehler") {
            /* Ohne Kanal kommt keine Antwort per Ereignis: Senden nicht blockieren, die
               Komponente zeigt nach ihrer Frist selbst, dass man den Chat neu oeffnen soll. */
            warterLoesen();
          }
        }
      });
    }
    function kanalNeu() {
      if (gem.kanal) { gem.kanal.stop(); gem.kanal = null; }
      kanalAuf();
    }
    gem.warter = gem.warter || [];
    function warterLoesen() { var w = gem.warter.splice(0); w.forEach(function (f) { try { f(); } catch (e) {} }); }
    /* Vor dem ersten Senden muss der Kanal stehen (Vertrag 15.4) -- hoechstens 3 s warten. */
    function kanalBereit() {
      kanalAuf();
      if (gem.kanalBereit || !gem.kanal) return Promise.resolve();
      return new Promise(function (fertig) {
        gem.warter.push(fertig);
        setTimeout(fertig, 3000);
      });
    }
    /* Ein Ereignis des Kanals: erst den eigenen Stand, dann an die Komponente. */
    function ereignis(p) {
      if (!p || typeof p !== "object") return;
      var art = str(p.event), chat = str(p.session_id);
      /* Fremdes Team: weg. Seit mira_v1_fix_1.sql traegt jedes Ereignis team_id, auch
         mira_progress. Kommt doch eins ohne (aeltere Fassung), zaehlt es nur fuer einen Chat, den
         diese Seite kennt (laufend oder offen). */
      if (p.team_id) { if (str(p.team_id) !== team()) return; }
      else if (!(chat && (gem.laufend[chat] || chat === offenerChat()))) return;
      if (art === "mira_turn_started") {
        gem.laufend[chat] = { amid: str(p.assistant_message_id), seit: Date.now() };
        if (p.user_message) cacheEin(chat, p.user_message);
        notfristStellen(chat);
        /* Gestartet von einem anderen Tab oder Geraet: live mitlesen, wenn dieser Chat offen ist. Die
           eigene Sendung liest ihren Stream schon selbst (gem.sendung). */
        if (chat === offenerChat() && !(gem.sendung && Date.now() - gem.sendung < 60000)) {
          var amidS = str(p.assistant_message_id);
          setTimeout(function () { anhaengen(chat, amidS); }, 800);
        }
      } else if (art === "mira_message_success" || art === "mira_message_error") {
        delete gem.laufend[chat];
        notfristWeg(chat);
        /* Eine Antwort des neuen Wegs (content_html leer): das Ereignis traegt keine Bloecke (DB-Vertrag
           P0, _mira_message_json_v1). Kamen sie schon ueber den Stream, gehen sie hier an die Nachricht;
           sonst wie bei content_omitted einmal mira_messages_v2 holen. */
        var pm = p.message;
        if (art === "mira_message_success" && pm && typeof pm === "object" && pm.role === "assistant" && !pm.content_html && !pm.blocks) {
          var bekannt = gem.bloecke[str(pm.id)];
          if (bekannt) pm.blocks = bekannt;
          else if (gem.cache[chat] || chat === offenerChat()) {
            nachrichtenLaden(chat, false).then(function () { am("askMiraRealtime", p); });
            return;
          }
        }
        if (p.content_omitted === true) {
          /* Zu gross fuer das Ereignis: einmal die Nachrichten holen, DANN weiterreichen -- das
             Nachfassen der Komponente liest dann schon den neuen Stand. */
          if (gem.cache[chat] || chat === offenerChat()) {
            nachrichtenLaden(chat, false).then(function () { am("askMiraRealtime", p); });
            return;
          }
        } else if (p.message) cacheEin(chat, p.message);
      }
      am("askMiraRealtime", p);
    }
    /* Die Sicherung zum Aufraeumer der DB (10 min): einmal nach 11 min nachsehen. */
    function notfristStellen(chat) {
      notfristWeg(chat);
      gem.uhren[chat] = setTimeout(function () {
        delete gem.uhren[chat];
        if (gem.laufend[chat]) standPruefen(chat);
      }, 11 * 60 * 1000);
    }
    function notfristWeg(chat) { if (gem.uhren[chat]) { clearTimeout(gem.uhren[chat]); delete gem.uhren[chat]; } }
    /* Hat sich der Stand der letzten Antwort geaendert, die Nachrichten holen (Vertrag 15.4). */
    function standPruefen(chat) {
      var tm = team();
      if (!tm || !chat) return;
      var a = D.stand(tm, chat);
      UC.rpc(a.fn, a.params, { timeoutMs: 15000 }).then(function (erg) {
        var s = erg.ok ? D.zuStand(erg.daten) : null;
        if (!s || tm !== team()) return;
        var war = gem.laufend[chat];
        if (s.laeuft) { if (!war) gem.laufend[chat] = { amid: s.amid, seit: Date.now() }; return; }
        if (war || !gem.cache[chat]) {
          delete gem.laufend[chat];
          nachrichtenLaden(chat, false);
        }
      });
    }
    function nachVerbinden() {
      var chat = offenerChat();
      if (chat) standPruefen(chat);
      Object.keys(gem.laufend).forEach(function (c) { if (c !== chat) standPruefen(c); });
    }

    /* ---- Senden -------------------------------------------------------------------------- */
    function gesendet(g, text) {
      if (!gem.cache[g.chatId]) gem.cache[g.chatId] = [];
      /* Die eigene Frage gleich in den Stand, mit der Kennung aus der 202: kam mira_turn_started,
         bevor der Kanal stand (ein privater Beitritt braucht gemessen bis zu einigen Sekunden),
         fehlte sie sonst, sobald die Antwort aus dem Stand gezeichnet wird. Das Ereignis ersetzt
         sie spaeter ueber dieselbe Kennung. */
      if (text && g.userId) cacheEin(g.chatId, { id: g.userId, role: "user", status: "success", content: text,
        session_id: g.chatId, created_at: new Date().toISOString() });
      gem.laufend[g.chatId] = gem.laufend[g.chatId] || { amid: g.amid, seit: Date.now() };
      notfristStellen(g.chatId);
      /* Ein neuer Chat: die Kennung ist sofort da (Vertrag 15.3). Steht der Nutzer noch auf
         dem leeren Chat, ist das jetzt dieser. */
      if (g.neu && !offenerChat()) am("askMiraSetActiveChat", g.chatId, false, "");
    }
    /* hint der Kontingentsperre: Sekunden bis zum Monatswechsel (Berlin) -> Datum in der Sprache der App. */
    function resetDatum(erg) {
      var s = Number(erg && erg.fehler && erg.fehler.hint);
      if (!isFinite(s) || s <= 0 || s > 40 * 86400) return "";
      try { return new Date(Date.now() + s * 1000).toLocaleDateString(UC.getPref && String(UC.getPref("locale") || "").toLowerCase() === "de" ? "de-DE" : "en-GB", { day: "numeric", month: "long", timeZone: "Europe/Berlin" }); }
      catch (e) { return ""; }
    }
    function sendeFehlerSatz(erg, neu) {
      var art = neu ? D.fehlerArtNeu(erg) : D.fehlerArt(erg);
      /* Nur der neue Weg kennt diese (upstreem-app lib/mira/db.ts, rpc_lexikon 22_mira "Mira-Agent"). */
      if (art === "kontingent") { var am2 = resetDatum(erg); return t("Your team has used this month's Mira allowance.") + (am2 ? " " + t("It resets on {datum}.").replace("{datum}", am2) : ""); }
      if (art === "tag") return t("You've reached today's limit for Mira. Try again tomorrow.");
      if (art === "beschaeftigt") return t("Mira is already answering two of your questions. Wait for one of them, then send again.");
      if (art === "doppelt") return t("This message is already being answered.");
      if (art === "anmeldung") return t("Your session has expired. Reload the page and sign in again.");
      if (art === "laeuft") return t("Mira is still answering in this chat. Wait for the answer, then send again.");
      /* Mit hint (Sekunden bis zum naechsten Minutenfenster) die genaue Wartezeit (16.10.). */
      if (art === "rate") return UC.warteSekunden && UC.warteSekunden(erg)
        ? t("Too many messages in a short time.") + " " + UC.warteSatz(erg)
        : t("Too many messages in a short time. Wait a minute and try again.");
      if (art === "start") return t("Mira couldn't start this answer. Try again.");
      if (art === "eingabe") return t("This message couldn't be sent. Shorten it and try again.");
      /* Der Satz der App fuer team_access_* (core) -- das Gate kommt dazu (core, edge()). */
      if (art === "zugang") return t("Your team doesn't have access right now.");
      if (art === "rechte") return t("You don't have access to this team.");
      if (art === "netz") return t("Mira couldn't be reached. Check your connection and try again.");
      if (art === "zeit") return t("Mira is taking too long to respond. Try again in a moment.");
      return null;
    }
    /* ---- Der neue Weg (P2): /api/mira, Antwort als Stream ------------------------------------ */
    gem.bloecke = gem.bloecke || {};   /* amid -> Bloecke aus dem Stream, bis die DB-Fassung da ist */
    gem.leser = gem.leser || {};       /* amid -> laufender Leser (ein Stream je Antwort) */
    var STILL_MS = 180000;             /* so lange ohne jedes Teil = haengende Verbindung (Ultra denkt bis 60 s ohne Teil) */
    function folgen(antwort, st) {
      if (st.amid) gem.leser[st.amid] = true;
      return D.streamLesen(antwort, function (teil) {
        var typ = str(teil.type), dd = teil.data && typeof teil.data === "object" ? teil.data : {};
        if (typ === "data-mira-start") {
          st.amid = str(dd.assistant_message_id); st.chat = str(dd.session_id) || st.chat;
          if (st.amid) gem.leser[st.amid] = true;
          if (st.neu) gesendet({ chatId: st.chat, userId: str(dd.user_message_id), amid: st.amid, neu: dd.is_new_session === true }, st.frage);
          am("askMiraStreamStart", st.chat, st.amid, str(dd.user_message_id));
          return;
        }
        /* Der Text zaehlt je Runde: was das Modell vor einem weiteren Werkzeugaufruf schreibt, ist
           Vorrede (dasselbe Ende wie im Arbeitsprotokoll, ask-mira.js runAnwenden). */
        if (typ === "start-step") { st.text = ""; am("askMiraRunEvent", teil); return; }
        if (typ === "text-delta") { st.text += str(teil.delta); am("askMiraStreamText", st.chat, st.amid, st.text); return; }
        if (typ === "data-mira-refs") { am("askMiraStreamRefs", st.chat, st.amid, dd.items || []); return; }
        if (typ === "data-mira-chart") { am("askMiraStreamChart", st.chat, st.amid, dd); return; }
        if (typ === "data-mira") {
          st.fertig = true;
          if (st.amid && Array.isArray(dd.bloecke)) gem.bloecke[st.amid] = dd.bloecke;
          am("askMiraStreamFertig", st.chat, st.amid, dd);
          return;
        }
        if (typ === "data-mira-saved") {
          if (dd.ok === false) satz("This answer couldn't be saved", "error", "Try again.");
          return;
        }
        if (typ === "error") { st.fertig = true; am("askMiraStreamFehler", st.chat, st.amid, str(teil.errorText)); return; }
        am("askMiraRunEvent", teil);
      }, { still: STILL_MS }).then(function (r) {
        if (st.amid) delete gem.leser[st.amid];
        if (st.fertig) return;
        if (!st.amid) { am("askMiraSendFailed", t("Mira couldn't be reached. Check your connection and try again.")); return; }
        /* Verbindung weg oder still, die Antwort laeuft auf dem Server weiter: einmal neu anhaengen,
           sonst bringt Realtime sie (mira_message_success), notfalls die 11-Minuten-Frist. */
        if (!st.wieder) anhaengen(st.chat, st.amid);
      });
    }
    function anhaengen(chat, amid) {
      if (!chat || !amid || gem.leser[amid] || !UC.sitzungsToken) return;
      gem.leser[amid] = true;
      D.weg().then(function (w) {
        if (w !== "neu") { delete gem.leser[amid]; return null; }
        return UC.sitzungsToken().then(function (token) { return token ? D.wiederanhaengen(token, amid) : null; });
      }).then(function (antwort) {
        if (!antwort) { delete gem.leser[amid]; return; }
        am("askMiraStreamAnhaengen", chat, amid);
        folgen(antwort, { chat: chat, amid: amid, text: "", wieder: true });
      }, function () { delete gem.leser[amid]; });
    }
    function sendenNeu(tm, d) {
      var body = D.sendeBodyNeu(tm, d, zustand());
      var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
      var zeitAus = false;
      /* Bis die Antwort beginnt (Kopfzeilen), wie bisher bei mira-send 30 s. */
      var uhr = setTimeout(function () { zeitAus = true; if (ctrl) ctrl.abort(); }, 30000);
      gem.sendung = Date.now();
      kanalBereit().then(function () { return UC.sitzungsToken ? UC.sitzungsToken() : ""; }).then(function (token) {
        if (!token) return { ok: false, status: 401, fehler: { code: "", message: "edge_unauthorized", hint: "" } };
        return D.sendenNeu(token, body, { signal: ctrl && ctrl.signal, zeitAus: function () { return zeitAus; } });
      }).then(function (erg) {
        clearTimeout(uhr);
        if (!erg.ok) { am("askMiraSendFailed", sendeFehlerSatz(erg, true)); return; }
        folgen(erg.antwort, { neu: true, frage: body.message, chat: str(body.session_id), amid: "", text: "" });
      });
    }

    function senden(d) {
      var tm = team();
      if (!tm) { am("askMiraSendFailed"); return; }
      D.weg().then(function (w) { if (w === "neu") sendenNeu(tm, d); else sendenAlt(tm, d); });
    }
    function sendenAlt(tm, d) {
      if (!UC.edge) { am("askMiraSendFailed"); return; }
      var body = D.sendeBody(tm, d, zustand());
      kanalBereit().then(function () {
        return UC.edge(D.FN.senden, body, { timeoutMs: 30000 });
      }).then(function (erg) {
        var g = erg && erg.ok ? D.zuGesendet(erg.daten) : null;
        if (!g) { am("askMiraSendFailed", erg ? sendeFehlerSatz(erg) : null); return; }
        gesendet(g, body.message);
      });
    }
    /* Sprache auf dem neuen Weg (Q19): im Browser zu WAV, Text von /api/mira/sprache, die Blase der Frage
       bekommt ihn, dann geht er wie getippt an /api/mira. */
    function spracheNeu(tm, d, mid) {
      var fehlschlag = function (satzText) { am("askMiraRejectVoice", mid); satz("The voice message couldn't be sent", "error", satzText || "Try again."); };
      D.wavAus(str(d.audio_base64), str(d.mime_type)).then(function (w) {
        return UC.sitzungsToken().then(function (token) {
          var lang = UC.getPref && String(UC.getPref("locale") || "").toLowerCase() === "de" ? "de" : "";
          return D.transkribieren(token, { team_id: tm, audio_base64: w.b64, format: "wav", language: lang || undefined });
        });
      }).then(function (erg) {
        if (!erg.ok) {
          var m = str(erg.fehler && erg.fehler.message);
          fehlschlag(m === "mira_audio_empty" ? t("Mira couldn't hear anything. Try again a little louder.")
            : m === "mira_audio_too_long" ? t("Voice messages can be up to 30 seconds long.")
            : sendeFehlerSatz(erg, true));
          return;
        }
        am("askMiraResolveVoice", erg.text, mid);
        sendenNeu(tm, { chat_id: str(d.chat_id), message: erg.text });
      }, function () { fehlschlag(t("This browser can't convert the recording. Type your question instead.")); });
    }
    function sprache(d) {
      var tm = team();
      var mid = str(d.message_id);
      if (tm && str(d.audio_base64) && UC.sitzungsToken) {
        D.weg().then(function (w) { if (w === "neu") spracheNeu(tm, d, mid); else spracheAlt(tm, d, mid); });
        return;
      }
      spracheAlt(tm, d, mid);
    }
    function spracheAlt(tm, d, mid) {
      if (!tm || !UC.edge || !str(d.audio_base64)) {
        am("askMiraRejectVoice", mid);
        satz("The voice message couldn't be sent", "error", "Try again.");
        return;
      }
      var body = D.sprachBody(tm, d, zustand());
      kanalBereit().then(function () {
        /* Sprache dauert laenger: n8n transkribiert, bevor die Function antwortet. */
        return UC.edge(D.FN.senden, body, { timeoutMs: 120000 });
      }).then(function (erg) {
        var g = erg && erg.ok ? D.zuGesendet(erg.daten) : null;
        if (!g) {
          am("askMiraRejectVoice", mid);
          var s = erg ? sendeFehlerSatz(erg) : null;
          satz("The voice message couldn't be sent", "error", s || "Try again.");
          return;
        }
        gesendet(g);
      });
    }

    /* ---- Verwalten (nacheinander) -------------------------------------------------------- */
    function inReihe(fn) {
      gem.kette = (gem.kette || Promise.resolve()).then(fn, fn);
      return gem.kette;
    }
    /* Die Komponente hat die Aenderung schon gezeigt. Lehnt der Server ab: sagen und die Liste
       neu laden, dann steht wieder die Wahrheit da. */
    function verwalten(a, nachher, fehlerTitel) {
      inReihe(function () {
        return schreiben(a).then(function (erg) {
          if (!erg.ok) {
            var art = D.fehlerArt(erg);
            /* Die Wartezeit aus hint (Sekunden, core warteSatz), sonst wie bisher. */
            if (art === "rate") satz("Too many changes in a short time", "error", UC.warteSatz ? UC.warteSatz(erg, t("Wait a minute and try again.")) : "Wait a minute and try again.");
            else if (art === "zugang") satz(fehlerTitel, "error", "Your team doesn't have access right now.");
            else satz(fehlerTitel, "error", "Try again.");
            return listeLaden(true);
          }
          return nachher ? nachher(erg.daten) : null;
        });
      });
    }
    function pdf(d) {
      var tm = team(), amid = str(d.assistant_message_id), chat = str(d.session_id) || offenerChat();
      if (!tm || !amid || !chat) { am("askMiraSetExportPending", amid, false); return; }
      /* Neuer Weg (Q20): /api/mira/pdf druckt alte und neue Antworten (Bloecke und content_html). Der alte
         (mira-export-pdf, n8n) kennt die Bloecke nicht und bleibt nur fuer den alten Weg. */
      D.weg().then(function (w) {
        var body = { team_id: tm, session_id: chat, assistant_message_id: amid };
        if (w === "neu" && UC.sitzungsToken) return UC.sitzungsToken().then(function (token) { return D.pdf(token, body); });
        if (!UC.edge) return { ok: false, status: 0, fehler: { message: "network" } };
        return UC.edge(D.FN.pdf, body, { datei: true, timeoutMs: 150000 });
      }).then(function (erg) {
        am("askMiraSetExportPending", amid, false);
        if (!erg.ok || !erg.daten || !erg.daten.blob) {
          var artP = D.fehlerArt(erg);
          satz("Couldn't create the PDF", "error", artP === "weg" ? "This answer no longer exists."
            : artP === "zugang" ? "Your team doesn't have access right now."
            : artP === "rate" && UC.warteSatz ? UC.warteSatz(erg, t("Wait a minute and try again.")) : "Try again.");
          return;
        }
        try {
          var url = URL.createObjectURL(erg.daten.blob);
          var a = document.createElement("a");
          a.href = url; a.download = erg.daten.name || "mira.pdf";
          a.style.display = "none";
          document.body.appendChild(a); a.click(); a.remove();
          setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
        } catch (e) { satz("Couldn't save the PDF", "error", "Try again."); }
      });
    }

    /* Aktionskarte (P2/P3, upstreem-app mira/AKTIONSKARTE.md 5): Start bzw. Rueckgaengig an die Route
       der App, der neue Stand der Karte zurueck ans Fenster. */
    function aktionSatz(erg) {
      var m = str(erg.fehler && erg.fehler.message);
      if (erg.status === 404 && (m === "not_found" || m === "http_404")) return t("This action isn't available yet.");
      if (m === "action_undo_expired") return t("This can no longer be undone.");
      if (m === "action_not_startable") return t("This action has already been started.");
      if (m === "page_audit_quota_exhausted" && UC.pageAuditFehlerSatz) return UC.pageAuditFehlerSatz(erg);
      if (m === "prompt_research_user_busy") return t("You already have a research running.");
      if (m === "brands_limit_reached") return t("Your plan has no free brand slots.");
      if (/_rate_limited$/.test(m) || erg.status === 429) return UC.warteSatz ? UC.warteSatz(erg, t("Wait a minute and try again.")) : t("Wait a minute and try again.");
      if (/^team_access_/.test(m) || erg.status === 402) return t("Your team doesn't have access right now.");
      if (erg.status === 403) return t("You don't have access to this team.");
      if (erg.status === 0) return t("Mira couldn't be reached. Check your connection and try again.");
      return t("Try again.");
    }
    function aktion(d) {
      var tm = team(), amid = str(d.assistant_message_id), aid = str(d.action_id);
      if (!tm || !amid || !aid || !UC.sitzungsToken) return;
      var body = { team_id: tm, session_id: str(d.session_id) || offenerChat(), assistant_message_id: amid,
                   action_id: aid, op: d.op === "undo" ? "undo" : "start", client_key: D.kennung() };
      UC.sitzungsToken().then(function (token) { return D.aktion(token, body); }).then(function (erg) {
        var j = erg.daten || {};
        if (j.card) am("askMiraActionCard", amid, j.card, j.opportunity || null);
        if (erg.ok) { jobUhrStellen(false); return; }
        am("askMiraActionFailed", amid, aid, t("Couldn't start this action") + ". " + aktionSatz(erg));
      });
    }

    function handle(name, wert) {
      var tm = team();
      var d = lesen(wert);
      switch (name) {
        case "send": senden(d); return;
        case "voice": sprache(d); return;
        case "select_chat": {
          var id = str(d.wert || d.chat_id || wert);
          if (id) nachrichtenLaden(id, true);
          return;
        }
        case "refresh_chat": {
          /* Das Nachfassen der Komponente: aus dem eigenen Stand, ohne Netz. Nur wenn der Chat
             hier noch gar nicht geladen ist, einmal holen. */
          var rid = str(d.wert || d.chat_id || wert) || offenerChat();
          if (!rid) return;
          if (gem.cache[rid]) am("askMiraSetMessages", gem.cache[rid].slice(), rid);
          else nachrichtenLaden(rid, false);
          return;
        }
        case "more_chats": weitereChats(); return;
        case "realtime_resubscribe": kanalNeu(); return;
        case "rename_chat": verwalten(D.chatAendern(tm, d.chat_id, { title: d.title }), null, "Couldn't rename the chat"); return;
        case "pin_chat": verwalten(D.chatAendern(tm, d.chat_id, { is_pinned: true }), null, "Couldn't pin the chat"); return;
        case "unpin_chat": verwalten(D.chatAendern(tm, d.chat_id, { is_pinned: false }), null, "Couldn't unpin the chat"); return;
        case "move_chat":
          verwalten(D.chatAendern(tm, d.chat_id, d.new_project_id ? { project_id: d.new_project_id } : { clear_project: true }),
            null, "Couldn't move the chat");
          return;
        case "delete_chat":
          delete gem.cache[str(d.chat_id)];
          verwalten(D.chatLoeschen(tm, d.chat_id), null, "Couldn't delete the chat");
          return;
        case "create_project":
          verwalten(D.projektSpeichern(tm, null, D.NEUES_PROJEKT), function () { return listeLaden(true); }, "Couldn't create the project");
          return;
        case "create_project_with_chat":
          verwalten(D.projektSpeichern(tm, null, D.NEUES_PROJEKT, d.chat_id), function () { return listeLaden(true); }, "Couldn't create the project");
          return;
        case "rename_project": verwalten(D.projektSpeichern(tm, d.project_id, d.title), null, "Couldn't rename the project"); return;
        case "delete_project":
          verwalten(D.projektLoeschen(tm, d.project_id), function () { return listeLaden(true); }, "Couldn't delete the project");
          return;
        case "settings_change": {
          var a = D.einstellungenSetzen(d);
          UC.rpc(a.fn, a.params, { timeoutMs: 15000 }).then(function (erg) {
            if (!erg.ok) satz("Couldn't save your settings", "error", "Try again.");
          });
          return;
        }
        case "export_pdf": pdf(d); return;
        case "action": aktion(d); return;
        /* Die Komponente fragt die Liste neu an, wenn der Tab 20s und laenger weg war, nach "online",
           nach pageshow und nach einem Wiederverbinden. Der Kanal haelt die Liste nur, solange er
           verbunden ist -- was in der Pause kam (neuer Chat auf einem anderen Geraet, ein Titel),
           fehlte bis zum Neuladen (Bestand 13.10.). */
        case "refresh_chats": listeLaden(true, true); return;
        /* new_chat, voice_start/_cancel/_error: hier nichts zu tun -- die Komponente setzt sich
           selbst zurueck. */
        default: return;
      }
    }

    /* ---- Fertige Jobs (P3, Q22): beim Oeffnen von Mira und, solange im offenen Chat ein Job einer
       Aktionskarte laeuft, jede Minute. Die Zusammenfassung kommt danach wie jede Antwort ueber Realtime. ---- */
    var JOB_TAKT = 60000;
    function jobsAnstossen() {
      var tm = team();
      if (!tm || !UC.sitzungsToken) return;
      D.weg().then(function (w) {
        if (w !== "neu") return null;
        return UC.sitzungsToken().then(function (token) { return token ? D.jobs(token, tm) : null; });
      }).then(function (j) {
        if (j && Number(j.waiting) > 0) jobUhrStellen(true);
      });
    }
    function jobUhrStellen(sofort) {
      if (gem.jobUhr) return;
      if (!sofort && !(am("askMiraLaufendeJobs") > 0)) return;
      gem.jobUhr = setTimeout(function () {
        gem.jobUhr = null;
        if (am("askMiraLaufendeJobs") > 0 || sofort) { jobsAnstossen(); jobUhrStellen(false); }
      }, JOB_TAKT);
    }

    /* ---- Laden, Teamwechsel ---------------------------------------------------------------- */
    function laden(frisch) {
      var el = innen();
      if (!sichtbarTest(el)) { beiSicht(el, "laden", function () { laden(frisch); }, sichtbarTest); return; }
      kanalAuf();
      if (frisch || gem.listeFuer !== team()) { listeLaden(!!frisch); jobsAnstossen(); }
      if (!gem.einstellungen) { gem.einstellungen = true; einstellungenLaden(); }
    }
    if (UC.onTeamChange) UC.onTeamChange(function () {
      if (gem.team === team()) return;
      gem.team = team();
      gem.cache = {}; gem.laufend = {};
      Object.keys(gem.uhren).forEach(notfristWeg);
      lader.leeren();
      am("askMiraNeuerChat");
      laden(true);
    }, root);

    var ctrl = {
      root: root, handle: handle,
      reset: function () { lader.leeren(); gem.cache = {}; gem.listeFuer = null; laden(true); return true; }
    };
    root.__umiCtrl = ctrl;
    aktiv = ctrl;
    gem.team = gem.team || team();
    setTimeout(function () { laden(false); }, 0);
    return ctrl;
  }

  function steuer() { return aktiv && aktiv.root.isConnected !== false ? aktiv : null; }
  if (!window.__umiVerdrahtet) {
    window.__umiVerdrahtet = true;
    window.addEventListener("upstreem:askmira", function (e) {
      var c = steuer(), d = (e && e.detail) || {};
      if (c && d.name) c.handle(String(d.name), d.wert);
    });
  }

  function alle() { return [].slice.call(document.querySelectorAll(".umi-root")); }
  window.resetMiraPage = function (id) {
    alle().filter(function (x) { return id == null || str(x.getAttribute("data-instance")) === String(id); })
      .forEach(function (x) { var c = initRoot(x); if (c) c.reset(); });
  };
  /* Sofort einrichten, auch in einer verdeckten Ansicht: das alte Mira-Element stand immer mit
     seinem Markup im Dokument, und das Dashboard leiht sich Mira von dort aus (Launcher). Laden
     wartet trotzdem, bis Mira zu sehen ist (laden). Eine Huelle mit display: contents liesse sich
     ohnehin nie als "messbar" pruefen. */
  function einrichten() {
    alle().forEach(function (r) { if (!r.__umiCtrl) initRoot(r); });
  }
  if (UC.watchRoots) UC.watchRoots("umi-root", einrichten);
  einrichten();
  Q.splice(0).forEach(function (q) { try { window[q[0]].apply(null, q[1]); } catch (e) {} });
  }

  umiBoot(30);
})();
