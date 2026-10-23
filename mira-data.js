/* upstreem mira-data.js -- der Datenteil der Mira-Seite (10.10.), OHNE DOM.

   Gleiche Bauart wie die Datenmodule der anderen Seiten: Anfragen und Umformung fuer Vertrag D
   (bubble/seiten_db_vorschlag_2.md, Abschnitt 15, ersetzt bei Abweichungen Abschnitt 8).
   Die Felder der Chats und Nachrichten gehen unveraendert an ask-mira.js -- sie heissen schon so,
   wie die Komponente sie aus get_mira_chat_messages_v2 kennt.

   Exportiert als window.UpstreemMiraDaten. */
(function () {
  "use strict";
  if (window.UpstreemMiraDaten) return;

  function isArr(v) { return Object.prototype.toString.call(v) === "[object Array]"; }
  function str(v) { return v == null || typeof v === "object" ? "" : String(v); }
  function obj(v) { return v && typeof v === "object" && !isArr(v) ? v : null; }

  var FN = {
    chats: "mira_sessions_v1", nachrichten: "mira_messages_v1", stand: "mira_turn_status_v1",
    chatAendern: "mira_session_update_v1", chatLoeschen: "mira_session_delete_v1",
    projektSpeichern: "mira_project_save_v1", projektLoeschen: "mira_project_delete_v1",
    einstellungen: "mira_settings_v1", einstellungenSetzen: "mira_settings_set_v1",
    senden: "mira-send", pdf: "mira-export-pdf"
  };
  /* Eine Seite Chats ohne Projekt: 50 (Vorgabe der DB). Die Projekte kommen immer vollstaendig. */
  var SEITE = 50;
  var NEUES_PROJEKT = "New project";

  function anfrage(fn, p) { return { fn: fn, params: p, sig: fn + "|" + JSON.stringify(p) }; }
  function chats(team, offset) { return anfrage(FN.chats, { p_team: str(team), p_limit: SEITE, p_offset: Math.max(0, Number(offset) || 0) }); }
  function nachrichten(team, chatId) { return anfrage(FN.nachrichten, { p_team: str(team), p_session_id: str(chatId), p_limit: 200 }); }
  function stand(team, chatId) { return anfrage(FN.stand, { p_team: str(team), p_session_id: str(chatId) }); }
  function chatAendern(team, chatId, felder) {
    var p = { p_team: str(team), p_session_id: str(chatId) };
    felder = felder || {};
    if (felder.title != null) p.p_title = String(felder.title).trim().slice(0, 80);
    if (felder.is_pinned != null) p.p_is_pinned = !!felder.is_pinned;
    if (felder.project_id) p.p_project_id = str(felder.project_id);
    if (felder.clear_project) p.p_clear_project = true;
    return anfrage(FN.chatAendern, p);
  }
  function chatLoeschen(team, chatId) { return anfrage(FN.chatLoeschen, { p_team: str(team), p_session_id: str(chatId) }); }
  function projektSpeichern(team, projektId, titel, chatId) {
    var p = { p_team: str(team), p_project_id: projektId ? str(projektId) : null };
    var t = String(titel == null ? "" : titel).trim();
    p.p_title = t || NEUES_PROJEKT;
    if (chatId) p.p_session_id = str(chatId);
    return anfrage(FN.projektSpeichern, p);
  }
  function projektLoeschen(team, projektId) { return anfrage(FN.projektLoeschen, { p_team: str(team), p_project_id: str(projektId) }); }
  function einstellungen() { return anfrage(FN.einstellungen, {}); }
  function einstellungenSetzen(e) {
    e = obj(e) || {};
    var p = {};
    ["brand", "citation", "response"].forEach(function (k) { if (str(e[k])) p["p_" + k] = str(e[k]).toLowerCase(); });
    return anfrage(FN.einstellungenSetzen, p);
  }

  /* Die Komponente schickt den Aufwand als Medium / High / Ultra (und alte Werte); die Edge
     Function nimmt medium | high | ultra. */
  function aufwand(v) {
    var s = str(v).trim().toLowerCase();
    if (s === "ultra" || s === "detailed") return "ultra";
    if (s === "medium" || s === "mid" || s === "short") return "medium";
    return "high";
  }
  function modell(v) { return str(v).trim().toLowerCase() === "flash" ? "flash" : "pro"; }
  /* Body fuer mira-send (Vertrag 15.3). chat_id leer -> null: neuer Chat. */
  function sendeBody(team, d, zustand) {
    d = obj(d) || {};
    zustand = obj(zustand) || {};
    return {
      team_id: str(team), chat_id: str(d.chat_id).trim() || null, message: str(d.message),
      answer_detail: aufwand(d.answer_detail || zustand.answerDetail), model: modell(d.model || zustand.model)
    };
  }
  function sprachBody(team, d, zustand) {
    d = obj(d) || {};
    zustand = obj(zustand) || {};
    return {
      team_id: str(team), type: "voice", chat_id: str(d.chat_id).trim() || null,
      audio_base64: str(d.audio_base64), mime_type: str(d.mime_type) || "audio/webm",
      message_id: str(d.message_id), duration_ms: Number(d.duration_ms) || 0,
      answer_detail: aufwand(zustand.answerDetail), model: modell(zustand.model)
    };
  }

  /* mira_sessions_v1 -> { chats, projekte, mehr, naechster, zeilen }.
     chats ist die FLACHE Liste, die die Komponente fuehrt: die Chats ohne Projekt dieser Seite
     und dazu (nur auf der ersten Seite) alle Chats der Projekte, mit project_id/project_title. */
  function zuChats(d, ersteSeite) {
    var o = obj(d);
    if (!o || !isArr(o.rows)) return null;
    var m = obj(o.meta) || {};
    var zeilen = o.rows.filter(obj);
    var projekte = (isArr(o.projects) ? o.projects : []).filter(obj);
    var flach = zeilen.slice();
    if (ersteSeite) projekte.forEach(function (pj) {
      (isArr(pj.sessions) ? pj.sessions : []).filter(obj).forEach(function (c) {
        var k = {}, x;
        for (x in c) if (Object.prototype.hasOwnProperty.call(c, x)) k[x] = c[x];
        if (!k.project_id) k.project_id = pj.id;
        if (!k.project_title) k.project_title = pj.title;
        flach.push(k);
      });
    });
    return {
      chats: flach, zeilen: zeilen.length,
      projekte: projekte.map(function (pj) { return { id: pj.id, title: pj.title, status: pj.status, created_at: pj.created_at, updated_at: pj.updated_at, session_count: pj.session_count }; }),
      mehr: m.has_more === true, naechster: Number(m.next_offset) || 0
    };
  }
  function zuNachrichten(d) {
    var o = obj(d);
    if (!o || !isArr(o.rows)) return null;
    return { rows: o.rows.filter(obj), meta: obj(o.meta) || {} };
  }
  function zuStand(d) {
    var m = obj(d) && obj(d.meta);
    if (!m) return null;
    return { amid: str(m.assistant_message_id), status: str(m.status), laeuft: m.is_running === true, fehler: str(m.error_code) };
  }
  function zuEinstellungen(d) { var m = obj(d) && obj(d.meta); return m ? { brand: str(m.brand), citation: str(m.citation), response: str(m.response) } : null; }
  /* Antwort von mira-send (202). */
  function zuGesendet(d) {
    var o = obj(d);
    if (!o || !str(o.chat_id)) return null;
    return { chatId: str(o.chat_id), userId: str(o.user_message_id), amid: str(o.assistant_message_id), neu: o.is_new_session === true };
  }

  /* "zugang" (16.10.): team_access_* heisst, der Zugang des Teams ist weg (Tarif, Abo) -- etwas
     anderes als "rechte" (kein Mitglied, 42501). Erkannt an message: require_team_access kam bis
     befunde_db_v1.sql als P0403 = HTTP 500 und landete hier ueber den Code in "rechte"; danach
     PT402 = 402 und waere ohne diese Zeile in "sonst" gefallen. mira-send und mira-export-pdf
     reichen beide Fassungen unveraendert durch. */
  function fehlerArt(erg) {
    var f = (erg && erg.fehler) || {}, m = str(f.message), c = str(f.code), s = erg ? erg.status : 0;
    if (/_rate_limited$/.test(m) || c === "PT429" || s === 429) return "rate";
    if (/^team_access_/.test(m) || c === "PT402" || s === 402) return "zugang";
    if (m === "mira_turn_running" || s === 409) return "laeuft";
    if (m === "mira_not_found" || c === "PT404" || s === 404) return "weg";
    if (m === "mira_invalid_param" || m === "edge_invalid_body" || s === 400) return "eingabe";
    if (s === 502 || m === "mira_start_failed" || m === "edge_upstream_failed") return "start";
    if (c === "42501" || s === 403) return "rechte";
    /* Status 0: die Anfrage kam nie an. Fuer die Seite sieht ein vom Browser geblockter Aufruf
       (CORS: die Function kennt die Adresse der App nicht, 13.10. auf localhost gemessen) genauso
       aus wie ein Netzausfall -- und in den Logs der Function steht dann NICHTS. */
    if (s === 0 && m === "timeout") return "zeit";
    if (s === 0 && m === "network") return "netz";
    return "sonst";
  }

  /* ================= DER NEUE WEG: /api/mira (P2, 22.10.) ===================================
     Plan bubble/mira_agent_22_10/UMSETZUNGSPLAN.md, Abschnitt 3: das Fenster fragt den Agenten der App
     (upstreem-app app/api/mira/route.ts) statt der Edge Function mira-send (n8n). Die Antwort kommt als
     Stream im Protokoll des AI SDK (Server-Sent Events) zurueck: Werkzeugschritte, Text, Bezuege, Charts,
     am Ende das gepruefte Ergebnis mit den Bloecken. Gespeichert wird auf dem Server; die DB meldet das
     Ende wie bisher ueber Realtime (mira_message_success).

     Welcher Weg gilt, sagt die App (GET /api/mira, Schalter MIRA_NEU, "eine Einstellung fuer alle",
     Q17). Scheitert die Frage, bleibt es beim alten Weg -- n8n ist der Rueckfall bis P6. Die Antwort
     wird je Seitenaufruf einmal geholt. */
  var API = "/api/mira";
  var _weg = null;
  function weg() {
    if (_weg) return _weg;
    /* Nur ein Netzfehler darf beim naechsten Senden neu fragen; eine Antwort der App (auch 404 einer
       aelteren App ohne die Route) gilt bis zum Neuladen. */
    _weg = fetch(API, { method: "GET", credentials: "same-origin", cache: "no-store" }).then(function (r) {
      return r.ok ? r.json().catch(function () { return null; }) : null;
    }).then(function (j) { return j && j.fenster === "neu" ? "neu" : "alt"; }, function () { _weg = null; return "alt"; });
    return _weg;
  }
  /* Neu werden Nachrichten mit den Bloecken geladen (mira_messages_v2: wie v1, dazu blocks, Texte roh). */
  function nachrichtenNeu(team, chatId) { return anfrage("mira_messages_v2", { p_team: str(team), p_session_id: str(chatId), p_limit: 200 }); }

  function kennung() {
    try { if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID(); } catch (e) {}
    return "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }
  /* Body fuer POST /api/mira (route.ts). message ist der Text, wie er in der Blase steht (mit Bezuegen
     und Zitat davor, wie bisher -- so sieht der Chat nach dem Neuladen gleich aus); references traegt die
     Bezuege des Pickers zusaetzlich mit Kennung, damit der Agent sie ohne Raten aufloest. */
  function sendeBodyNeu(team, d, zustand) {
    d = obj(d) || {};
    zustand = obj(zustand) || {};
    var refs = (isArr(d.references) ? d.references : []).filter(obj).slice(0, 3).map(function (r) {
      var o = { type: str(r.type), id: str(r.id), label: str(r.label).slice(0, 300) };
      /* Ein Page Audit nennt den gezeigten Lauf und seinen Zeitpunkt (ask-mira.js picksRefs, 23.10.). */
      if (str(r.run_id)) o.run_id = str(r.run_id);
      if (str(r.run_at)) o.run_at = str(r.run_at).slice(0, 40);
      return o;
    }).filter(function (r) { return r.type && r.id; });
    var b = {
      team_id: str(team), session_id: str(d.chat_id).trim() || null, message: str(d.message),
      answer_detail: aufwand(d.answer_detail || zustand.answerDetail),
      mode: modell(d.model || zustand.model) === "flash" ? "fast" : "thorough",
      client_message_id: str(d.client_message_id) || kennung()
    };
    if (refs.length) b.references = refs;
    return b;
  }

  /* Der Stream: liest Server-Sent Events ("data: {json}\n\n") und reicht jedes Teil an teil(o). Gibt
     { ende } zurueck: "fertig" (finish kam), "abbruch" (Verbindung endete vorher) oder "angehalten"
     (signal). Wirft nie. still: Millisekunden ohne jedes Teil, nach denen der Leser aufgibt (haengende
     Verbindung; die Antwort laeuft auf dem Server weiter). */
  function streamLesen(antwort, teil, o) {
    o = o || {};
    if (!antwort || !antwort.body || !antwort.body.getReader) return Promise.resolve({ ende: "abbruch" });
    var leser = antwort.body.getReader();
    var dekoder = new TextDecoder();
    var puffer = "", fertig = false, uhr = 0, stumm = false;
    function wecker() {
      if (!o.still) return;
      if (uhr) clearTimeout(uhr);
      uhr = setTimeout(function () { stumm = true; try { leser.cancel(); } catch (e) {} }, o.still);
    }
    function block(b) {
      var zeilen = b.split("\n");
      for (var i = 0; i < zeilen.length; i++) {
        var z = zeilen[i];
        if (z.indexOf("data:") !== 0) continue;
        var roh = z.slice(5).replace(/^ /, "");
        if (!roh || roh === "[DONE]") continue;
        var x;
        try { x = JSON.parse(roh); } catch (e) { continue; }
        if (!obj(x)) continue;
        if (x.type === "finish") fertig = true;
        try { teil(x); } catch (e) { if (window.console) console.error("[mira-data] Stream-Teil:", e); }
      }
    }
    wecker();
    return (function weiter() {
      return leser.read().then(function (r) {
        if (r.done) return null;
        wecker();
        puffer += dekoder.decode(r.value, { stream: true });
        var k;
        while ((k = puffer.indexOf("\n\n")) >= 0) { block(puffer.slice(0, k)); puffer = puffer.slice(k + 2); }
        return weiter();
      });
    })().then(function () {
      if (puffer.trim()) block(puffer);
      if (uhr) clearTimeout(uhr);
      return { ende: fertig ? "fertig" : stumm ? "still" : "abbruch" };
    }, function () {
      if (uhr) clearTimeout(uhr);
      return { ende: o.signal && o.signal.aborted ? "angehalten" : stumm ? "still" : "abbruch" };
    });
  }

  /* Abschicken. token: das der Sitzung (UC.sitzungsToken). Antwort { ok, status, antwort } bzw.
     { ok:false, status, fehler:{ code, message, hint } } in der Form von UC.edge -- damit fehlerArt und
     die Saetze der Seite fuer beide Wege gelten. */
  function senden(token, body, o) {
    o = o || {};
    return fetch(API, {
      method: "POST", credentials: "same-origin", signal: o.signal,
      headers: { "content-type": "application/json", authorization: "Bearer " + str(token) },
      body: JSON.stringify(body)
    }).then(function (r) {
      if (r.ok && r.body) return { ok: true, status: r.status, antwort: r };
      return r.text().then(function (t) {
        var j = null;
        try { j = t ? JSON.parse(t) : null; } catch (e) {}
        j = obj(j) || {};
        return { ok: false, status: r.status, fehler: { code: str(j.code), message: str(j.code || j.message || ("http_" + r.status)), hint: str(j.hint), details: "" } };
      });
    }, function (e) {
      var weg = e && e.name === "AbortError";
      return { ok: false, status: 0, fehler: { code: "", message: weg ? (o.zeitAus && o.zeitAus() ? "timeout" : "aborted") : "network", hint: "", details: "" } };
    });
  }
  function wiederanhaengen(token, amid, o) {
    o = o || {};
    return fetch(API + "?resume=" + encodeURIComponent(str(amid)), {
      method: "GET", credentials: "same-origin", cache: "no-store", signal: o.signal,
      headers: { authorization: "Bearer " + str(token) }
    }).then(function (r) { return r.status === 200 && r.body ? r : null; }, function () { return null; });
  }

  /* Aktionskarte: Start und Rueckgaengig (upstreem-app mira/AKTIONSKARTE.md, 5). Antwort wie senden(). */
  function aktion(token, body) {
    return fetch(API + "/aktion", {
      method: "POST", credentials: "same-origin",
      headers: { "content-type": "application/json", authorization: "Bearer " + str(token) },
      body: JSON.stringify(body)
    }).then(function (r) {
      return r.text().then(function (t) {
        var j = null;
        try { j = t ? JSON.parse(t) : null; } catch (e) {}
        j = obj(j) || {};
        if (r.ok && j.ok === true) return { ok: true, status: r.status, daten: j };
        return { ok: false, status: r.status, daten: j, fehler: { code: str(j.code), message: str(j.code || j.message || ("http_" + r.status)), hint: str(j.hint), details: "" } };
      });
    }, function () {
      return { ok: false, status: 0, daten: {}, fehler: { code: "", message: "network", hint: "", details: "" } };
    });
  }

  /* SPRACHE (Q19): die Aufnahme (webm/opus aus MediaRecorder) wird im Browser zu WAV, 16 kHz, mono, 16 bit --
     so im Plan entschieden: ein Format, das jeder Anbieter liest, und ein Viertel der Groesse von 44,1 kHz
     Stereo. Gibt { b64, sekunden } oder wirft. */
  function wavAus(b64, mime) {
    var AC = window.AudioContext || window.webkitAudioContext;
    var OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!AC || !OAC || !b64) return Promise.reject(new Error("audio_unsupported"));
    var roh = atob(String(b64).replace(/^data:[^,]*,/, ""));
    var bytes = new Uint8Array(roh.length);
    for (var i = 0; i < roh.length; i++) bytes[i] = roh.charCodeAt(i);
    var ac = new AC();
    return ac.decodeAudioData(bytes.buffer).then(function (audio) {
      try { ac.close(); } catch (e) {}
      var rate = 16000, n = Math.max(1, Math.ceil(audio.duration * rate));
      var off = new OAC(1, n, rate);
      var quelle = off.createBufferSource();
      quelle.buffer = audio; quelle.connect(off.destination); quelle.start(0);
      return off.startRendering();
    }).then(function (r) {
      var pcm = r.getChannelData(0), n = pcm.length, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
      function txt(o, t) { for (var k = 0; k < t.length; k++) v.setUint8(o + k, t.charCodeAt(k)); }
      txt(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); txt(8, "WAVE"); txt(12, "fmt ");
      v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, r.sampleRate, true);
      v.setUint32(28, r.sampleRate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
      txt(36, "data"); v.setUint32(40, n * 2, true);
      for (var j = 0; j < n; j++) { var x = Math.max(-1, Math.min(1, pcm[j])); v.setInt16(44 + j * 2, x < 0 ? x * 0x8000 : x * 0x7fff, true); }
      var b = new Uint8Array(buf), aus = "";
      for (var p = 0; p < b.length; p += 0x8000) aus += String.fromCharCode.apply(null, b.subarray(p, p + 0x8000));
      return { b64: btoa(aus), sekunden: n / r.sampleRate };
    });
  }
  /* POST /api/mira/sprache (upstreem-app): { text } bzw. Fehler in der Form von senden(). */
  function transkribieren(token, body) {
    return fetch(API + "/sprache", {
      method: "POST", credentials: "same-origin",
      headers: { "content-type": "application/json", authorization: "Bearer " + str(token) },
      body: JSON.stringify(body)
    }).then(function (r) {
      return r.text().then(function (t) {
        var j = null;
        try { j = t ? JSON.parse(t) : null; } catch (e) {}
        j = obj(j) || {};
        if (r.ok && typeof j.text === "string") return { ok: true, status: r.status, text: j.text };
        return { ok: false, status: r.status, fehler: { code: str(j.code), message: str(j.code || ("http_" + r.status)), hint: str(j.hint), details: "" } };
      });
    }, function () { return { ok: false, status: 0, fehler: { code: "", message: "network", hint: "", details: "" } }; });
  }

  /* PDF (Q20): POST /api/mira/pdf, Antwort die Datei. { ok, status, daten:{ blob, name } } wie UC.edge mit datei. */
  function pdf(token, body) {
    return fetch(API + "/pdf", {
      method: "POST", credentials: "same-origin",
      headers: { "content-type": "application/json", authorization: "Bearer " + str(token) },
      body: JSON.stringify(body)
    }).then(function (r) {
      var typ = String(r.headers.get("content-type") || "");
      if (r.ok && typ.indexOf("application/pdf") === 0) {
        var cd = String(r.headers.get("content-disposition") || "");
        var m = /filename\*=UTF-8''([^;]+)/i.exec(cd);
        var name = "";
        try { name = m ? decodeURIComponent(m[1]) : ""; } catch (e) {}
        return r.blob().then(function (b) { return { ok: true, status: r.status, daten: { blob: b, name: name || "agent.pdf" } }; });
      }
      return r.text().then(function (t) {
        var j = null;
        try { j = t ? JSON.parse(t) : null; } catch (e) {}
        j = obj(j) || {};
        return { ok: false, status: r.status, fehler: { code: str(j.code), message: str(j.code || ("http_" + r.status)), hint: str(j.hint), details: "" } };
      });
    }, function () { return { ok: false, status: 0, fehler: { code: "", message: "network", hint: "", details: "" } }; });
  }

  /* Fertige Jobs zusammenfassen lassen (P3, Q22/Q33 = c: das Fenster stoesst es mit frischem Token an):
     POST /api/mira/jobs { team_id } -> { ok, summarized, waiting }. Fehler zaehlen hier nicht -- es ist ein
     Nachfassen, und eine App ohne die Route (vor P3) antwortet 404. */
  function jobs(token, team) {
    return fetch(API + "/jobs", {
      method: "POST", credentials: "same-origin",
      headers: { "content-type": "application/json", authorization: "Bearer " + str(token) },
      body: JSON.stringify({ team_id: str(team) })
    }).then(function (r) { return r.ok ? r.json().catch(function () { return null; }) : null; }, function () { return null; });
  }

  /* Die Fehler des neuen Wegs, zusaetzlich zu fehlerArt: Kontingent und Tagesgrenze (Q11), ein zweiter
     laufender Chat (mira_user_busy), eine schon laufende gleiche Frage (mira_duplicate), Anmeldung. */
  function fehlerArtNeu(erg) {
    var f = (erg && erg.fehler) || {}, m = str(f.message), s = erg ? erg.status : 0;
    if (m === "mira_quota_exhausted") return "kontingent";
    if (m === "mira_user_day_limit") return "tag";
    if (m === "mira_user_busy") return "beschaeftigt";
    if (m === "mira_duplicate") return "doppelt";
    if (m === "edge_unauthorized" || s === 401) return "anmeldung";
    if (m === "team_forbidden" || m === "forbidden" || m === "mira_turn_forbidden") return "rechte";
    if (s === 503 || /^mira_(tools|model)_missing$/.test(m) || m === "mira_start_failed" || m === "mira_db_unreachable") return "start";
    return fehlerArt(erg);
  }

  window.UpstreemMiraDaten = {
    FN: FN, SEITE: SEITE, NEUES_PROJEKT: NEUES_PROJEKT,
    chats: chats, nachrichten: nachrichten, stand: stand, chatAendern: chatAendern, chatLoeschen: chatLoeschen,
    projektSpeichern: projektSpeichern, projektLoeschen: projektLoeschen,
    einstellungen: einstellungen, einstellungenSetzen: einstellungenSetzen,
    aufwand: aufwand, modell: modell, sendeBody: sendeBody, sprachBody: sprachBody,
    zuChats: zuChats, zuNachrichten: zuNachrichten, zuStand: zuStand, zuEinstellungen: zuEinstellungen, zuGesendet: zuGesendet,
    fehlerArt: fehlerArt,
    weg: weg, nachrichtenNeu: nachrichtenNeu, sendeBodyNeu: sendeBodyNeu, streamLesen: streamLesen,
    sendenNeu: senden, wiederanhaengen: wiederanhaengen, fehlerArtNeu: fehlerArtNeu, kennung: kennung, aktion: aktion,
    wavAus: wavAus, transkribieren: transkribieren, pdf: pdf, jobs: jobs
  };
})();
