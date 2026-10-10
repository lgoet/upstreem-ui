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

  function fehlerArt(erg) {
    var f = (erg && erg.fehler) || {}, m = str(f.message), c = str(f.code), s = erg ? erg.status : 0;
    if (/_rate_limited$/.test(m) || c === "PT429" || s === 429) return "rate";
    if (m === "mira_turn_running" || s === 409) return "laeuft";
    if (m === "mira_not_found" || c === "PT404" || s === 404) return "weg";
    if (m === "mira_invalid_param" || m === "edge_invalid_body" || s === 400) return "eingabe";
    if (s === 502 || m === "mira_start_failed" || m === "edge_upstream_failed") return "start";
    if (c === "42501" || c === "P0403" || s === 403) return "rechte";
    return "sonst";
  }

  window.UpstreemMiraDaten = {
    FN: FN, SEITE: SEITE, NEUES_PROJEKT: NEUES_PROJEKT,
    chats: chats, nachrichten: nachrichten, stand: stand, chatAendern: chatAendern, chatLoeschen: chatLoeschen,
    projektSpeichern: projektSpeichern, projektLoeschen: projektLoeschen,
    einstellungen: einstellungen, einstellungenSetzen: einstellungenSetzen,
    aufwand: aufwand, modell: modell, sendeBody: sendeBody, sprachBody: sprachBody,
    zuChats: zuChats, zuNachrichten: zuNachrichten, zuStand: zuStand, zuEinstellungen: zuEinstellungen, zuGesendet: zuGesendet,
    fehlerArt: fehlerArt
  };
})();
