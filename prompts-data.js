/* upstreem prompts-data.js -- der Datenteil der Seite Prompt Insights (10.10.), OHNE DOM.

   WARUM EIN EIGENER TEIL: wie citations-data.js und dashboard-data.js. Was hier steht, kennt weder
   Elemente noch Bubble -- nur den Filterstand, die RPCs des Vertrags und die Form, in der die
   eingebetteten Bausteine (prompts-table, topics-manager, responses-table) ihre Daten lesen.

   VERTRAG: Vorschlag des Datenbank-Chats vom 10.10. (Abschnitt 6), mit der Rueckmeldung
   bubble/prompts_db_rueckmeldung.md. STAND: GEBAUT GEGEN DEN VORSCHLAG, NOCH OHNE ECHTE ANTWORTEN.
   Feldnamen, die die Datenbank beim Bau aendert, werden NUR hier nachgezogen -- die Seite und die
   Bausteine sehen weiter dieselbe Form.

   Der Filterstand f: { team, von, bis, modelle[], maerkte[], topics[], tagmode }.
   Der Tabellenstand s: { status, suche, order, limit, offset, erwaehnt, firmen[] }.

   Exportiert als window.UpstreemPromptsDaten. Braucht window.UpstreemCitationsDaten (Lader,
   Fehlerart) und window.UpstreemDashboardDaten (Responses, wie im Dashboard). */
(function () {
  "use strict";
  if (window.UpstreemPromptsDaten) return;

  function isArr(v) { return Object.prototype.toString.call(v) === "[object Array]"; }
  function str(v) { return v == null || typeof v === "object" ? "" : String(v); }
  function num(v) { if (v == null || v === "" || typeof v === "boolean") return null; var n = Number(v); return isFinite(n) ? n : null; }
  function liste(a) { a = isArr(a) ? a.map(str).map(function (x) { return x.trim(); }).filter(Boolean) : []; return a.length ? a : null; }
  function ganz(v, vorgabe, min, max) { var n = num(v); n = n == null ? vorgabe : Math.round(n); return Math.max(min, Math.min(max, n)); }
  function mit(o, x) { for (var k in x) if (Object.prototype.hasOwnProperty.call(x, k)) o[k] = x[k]; return o; }
  /* Eine uuid und nichts anderes: was nicht so aussieht, lehnte die DB mit 22P02 ab -- und damit
     den ganzen Aufruf statt nur den einen Eintrag (dieselbe Regel wie dashboard-data.js). */
  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  function uuids(a, max) {
    var l = (liste(a) || []).filter(function (x) { return UUID.test(x); });
    var gesehen = {};
    l = l.filter(function (x) { var k = x.toLowerCase(); if (gesehen[k]) return false; gesehen[k] = true; return true; });
    if (max) l = l.slice(0, max);
    return l.length ? l : null;
  }
  function C() { return window.UpstreemCitationsDaten; }
  function DD() { return window.UpstreemDashboardDaten; }

  var FN = {
    liste: "cached_prompts_list_v1",
    gruppen: "cached_prompts_groups_v1",
    seite: "prompts_page_meta_v1",
    anlegen: "prompts_add_v1",
    topicsSetzen: "prompt_topics_set_v1",
    sammel: "prompts_bulk_v1",
    topicSpeichern: "topic_save_v1",
    topicLoeschen: "topic_delete_v1",
    aktualisieren: "prompts_refresh_v1"
  };
  /* Die Sortierungen der Tabelle (prompts-table.js, ORDER_MAP) -- dieselben Schluessel im Vertrag. */
  var ORDER = ["visibility_desc", "visibility_asc", "rank_asc", "rank_desc", "sentiment_desc", "sentiment_asc",
               "name_asc", "name_desc", "created_at_desc", "created_at_asc"];
  /* Grenzen des Vertrags (6.4) -- hier nur, damit die Seite nichts schickt, was sicher abgelehnt
     wird. Geprueft wird in der Datenbank. */
  var GRENZE = { topicsFilter: 20, firmen: 50, suche: 200, limit: 100, gruppen: 10, gruppenTopics: 3,
                 gruppenName: 60, anlegen: 100, topicsJePrompt: 5, ids: 500, ausgeschlossen: 500 };

  function anfrage(art, params) { return { art: art, fn: FN[art], params: params, sig: FN[art] + "|" + JSON.stringify(params) }; }

  /* ---- Gemeinsame Filter (Vertrag 6.1) ----------------------------------------------------------
     unbenannt: p_untagged (Gruppe "ohne Topic"). Der Vertrag erlaubt p_untagged NICHT zusammen mit
     p_tag_ids -- in der Gruppenansicht ist der Topic-Filter der Seite aus, eine Gruppe bringt ihre
     eigenen Topics mit. Kommen trotzdem beide, gewinnt die Gruppe. */
  function basis(f, o) {
    f = f || {}; o = o || {};
    var mk = liste(f.maerkte);
    var p = {
      p_team: str(f.team), p_date_from: str(f.von) || null, p_date_to: str(f.bis) || null,
      p_models: liste(f.modelle), p_markets: mk ? mk.map(function (m) { return m.toUpperCase(); }) : null,
      p_tag_ids: uuids(o.tagIds || f.topics, GRENZE.topicsFilter),
      p_tagmode: (o.tagmode || f.tagmode) === "and" ? "and" : "or"
    };
    if (o.ohneTopic) { p.p_untagged = true; p.p_tag_ids = null; }
    return p;
  }
  function tabelle(s) {
    s = s || {};
    var q = str(s.suche).trim();
    return {
      p_status: s.status === "inactive" ? "inactive" : "active",
      p_search: q ? q.slice(0, GRENZE.suche) : null,
      p_mentioned: s.erwaehnt === "yes" || s.erwaehnt === "no" ? s.erwaehnt : "all",
      p_company_ids: uuids(s.firmen, GRENZE.firmen)
    };
  }

  /* Die flache Liste. g (optional): die aufgeklappte Gruppe { tagIds[], tagmode, ohneTopic }. */
  function liste_(f, s, g) {
    s = s || {};
    var o = str(s.order);
    return anfrage("liste", mit(mit(basis(f, g), tabelle(s)), {
      p_order: ORDER.indexOf(o) >= 0 ? o : ORDER[0],
      p_limit: ganz(s.limit, 15, 1, GRENZE.limit),
      p_offset: ganz(s.offset, 0, 0, 1e9)
    }));
  }
  /* Die Gruppenkoepfe. eigene: [{key, tag_ids}] aus dem Browser (ausgeblendete schickt der
     Aufrufer gar nicht erst). modus: both | custom | topics. Sie laden immer mit denselben Filtern
     wie die Tabelle (Vertrag 6.2), also auch mit Suche und Marken. */
  function gruppen(f, s, modus, eigene) {
    var gs = (isArr(eigene) ? eigene : []).map(function (x) {
      var key = str(x && x.key).trim().slice(0, GRENZE.gruppenName);
      var t = uuids(x && x.tag_ids, GRENZE.gruppenTopics);
      return key && t ? { key: key, tag_ids: t } : null;
    }).filter(Boolean).slice(0, GRENZE.gruppen);
    return anfrage("gruppen", mit(mit(basis(f), tabelle(s)), {
      p_mode: modus === "custom" || modus === "topics" ? modus : "both",
      p_groups: gs.length ? gs : null
    }));
  }
  function seite(team) { return anfrage("seite", { p_team: str(team) }); }

  /* ---- Schreiben -------------------------------------------------------------------------------
     Ohne Signatur: Schreibanfragen gehen nie in den Speicher des Laders. */
  function schreiben(art, params) { return { art: art, fn: FN[art], params: params, sig: "" }; }
  /* Der Dialog liefert prompt_texts und markets als gleich lange Listen (add-prompts.js). Ein
     leerer Markt heisst "Standardmarkt des Teams" (null), die Datenbank waehlt ihn. */
  function anlegen(team, d) {
    d = d || {};
    var texte = isArr(d.prompt_texts) ? d.prompt_texts : [], maerkte = isArr(d.markets) ? d.markets : [];
    var items = texte.slice(0, GRENZE.anlegen).map(function (t, i) {
      var m = str(maerkte[i]).trim().toUpperCase();
      return { text: str(t), market: /^[A-Z]{2}$/.test(m) ? m : null };
    });
    var tags = uuids(String(d.tag_ids || "").split(","), GRENZE.topicsJePrompt);
    return schreiben("anlegen", { p_team: str(team), p_items: items, p_tag_ids: tags || [],
      p_input_method: d.input_method === "csv" ? "csv" : "manual" });
  }
  function topicsSetzen(team, promptId, tagIds) {
    return schreiben("topicsSetzen", { p_team: str(team), p_prompt_id: str(promptId),
      p_tag_ids: uuids(tagIds, GRENZE.topicsJePrompt) || [] });
  }
  /* Sammelaktion. aktion: add_topics | set_active | set_inactive | delete.
     ziel: { ids[] } ODER { filter: true, f, s, gruppe, ausgeschlossen[], erwartet }.
     Im Filtermodus gehen GENAU die Filter der Liste mit (Vertrag 6.3) -- die Auswahl "Alle N" ist
     die Menge, die der Nutzer gesehen hat, nicht mehr. p_expected_count ist Pflicht: weicht die
     Datenbank davon ab, aendert sie nichts (prompts_selection_changed). */
  function sammel(team, aktion, ziel, tagIds) {
    ziel = ziel || {};
    var p = { p_team: str(team), p_action: aktion };
    if (aktion === "add_topics") p.p_tag_ids = uuids(tagIds, GRENZE.topicsJePrompt) || [];
    if (ziel.filter) {
      mit(p, basis(ziel.f, ziel.gruppe));
      mit(p, tabelle(ziel.s));
      p.p_target = "filter";
      p.p_excluded_ids = uuids(ziel.ausgeschlossen, GRENZE.ausgeschlossen) || [];
      p.p_expected_count = ganz(ziel.erwartet, 0, 0, 1e6);
    } else {
      p.p_target = "ids";
      p.p_ids = uuids(ziel.ids, GRENZE.ids) || [];
    }
    return schreiben("sammel", p);
  }
  /* Topic anlegen (tagId leer) oder bearbeiten. Die Farbe genau #rrggbb (Vertrag 6.4). */
  function farbe(h) { h = str(h).trim(); if (h && h.charAt(0) !== "#") h = "#" + h; return /^#[0-9a-fA-F]{6}$/.test(h) ? h.toLowerCase() : null; }
  function topicSpeichern(team, d) {
    d = d || {};
    var hell = farbe(d.hex_light), dunkel = farbe(d.hex_dark) || hell;
    return schreiben("topicSpeichern", { p_team: str(team), p_tag_id: UUID.test(str(d.id)) ? str(d.id) : null,
      p_name: str(d.name).trim().slice(0, 60), p_emoji: str(d.emoji).trim() || null,
      p_hex_light: hell, p_hex_dark: dunkel });
  }
  function topicLoeschen(team, tagId) { return schreiben("topicLoeschen", { p_team: str(team), p_tag_id: str(tagId) }); }
  function aktualisieren(team) { return schreiben("aktualisieren", { p_team: str(team) }); }

  /* ---- Antworten in die Form der Bausteine -------------------------------------------------- */
  function meta(d) { return d && d.meta && typeof d.meta === "object" ? d.meta : {}; }
  function zeilen(d) { return d && isArr(d.rows) ? d.rows.filter(function (r) { return r && typeof r === "object"; }) : null; }
  /* Logos und Favicons nur absolut (Befund M7: teils protokollrelativ). Was nicht http(s) ist,
     gehoert nicht in ein <img src>. */
  function absolut(u) { u = str(u).trim(); if (/^\/\//.test(u)) u = "https:" + u; return /^https?:\/\//i.test(u) ? u : ""; }
  function topic(t) {
    var id = str(t.tag_id || t.id);
    return { id: id, tag_id: id, name: str(t.name), emoji: str(t.emoji),
             hex_light: str(t.hex_light), hex_dark: str(t.hex_dark || t.hex_light) };
  }

  /* Eine Zeile der Prompt-Tabelle in den Feldern, die prompts-table.js liest (rowHtml):
     avg_sentiment_30d (heisst im Vertrag avg_sentiment), companies_preview_totalcount (heisst
     companies_mentioned_count), top_mentions mit favicon_url (Vertrag: logo_url), tags mit id. */
  function promptZeile(r) {
    return {
      prompt_id: str(r.prompt_id), prompt_text: str(r.prompt_text), market: str(r.market),
      is_active: r.is_active !== false, created_at: str(r.created_at),
      visibility_pct: num(r.visibility_pct), avg_rank: num(r.avg_rank),
      avg_sentiment_30d: num(r.avg_sentiment != null ? r.avg_sentiment : r.avg_sentiment_30d),
      runs_total: num(r.runs_total),
      top_mentions: (isArr(r.top_mentions) ? r.top_mentions : []).filter(function (m) { return m && typeof m === "object"; })
        .map(function (m) { var l = absolut(m.logo_url || m.favicon_url || m.favicon); return { name: str(m.name), favicon_url: l, favicon: l, company_id: str(m.company_id) }; }),
      companies_preview_totalcount: num(r.companies_mentioned_count != null ? r.companies_mentioned_count : r.companies_preview_totalcount),
      tags: (isArr(r.tags) ? r.tags : []).filter(function (t) { return t && typeof t === "object"; }).map(topic)
    };
  }
  /* Die flache Liste: Zeilen plus die Kopfzahlen. Die Tabelle blaettert im Reiter Active mit
     totalCount, im Reiter Inactive mit totalCountInactive (prompts-table.js, currentTotal) --
     meta.counts traegt beide unter denselben Filtern (ausser dem Status), die Zahl "ohne Topic"
     dazu. Fehlt counts, gilt total_count fuer den gefragten Status. */
  function zuListe(d, status) {
    var r = zeilen(d);
    if (!r) return null;
    var m = meta(d), c = m.counts && typeof m.counts === "object" ? m.counts : {};
    var total = num(m.total_count);
    var aktiv = num(c.active), inaktiv = num(c.inactive);
    if (status === "inactive") { if (inaktiv == null) inaktiv = total; } else if (aktiv == null) aktiv = total;
    return {
      rows: r.map(promptZeile),
      totalCount: aktiv, totalCountInactive: inaktiv,
      without_topic: num(c.untagged_active),
      total: total == null ? r.length : total
    };
  }
  /* Die Zeilen einer aufgeklappten Gruppe: group_total_count auf jeder Zeile (prompts-table.js
     liest es von der ersten). total_count bleibt WEG -- die Tabelle wuerde damit ihre Kopfzahl
     ueberschreiben, und die Zahl der Gruppe ist nicht die der Seite. */
  function zuGruppenZeilen(d) {
    var r = zeilen(d);
    if (!r) return null;
    var total = num(meta(d).total_count);
    return r.map(function (x) { var z = promptZeile(x); z.group_total_count = total == null ? r.length : total; return z; });
  }
  /* Gruppenkoepfe in der Form von prompts-table (setPromptsTableGroups). group_key: der Vertrag
     trennt topic:<id>, custom:<key> und untagged (Befund H5, gleichnamige Gruppen verschmolzen).
     Die Tabelle braucht fuer eine eigene Gruppierung ihren SCHLUESSEL aus dem Browser (Ausblenden,
     Bearbeiten, Loeschen gehen darueber) -- also custom: ohne Praefix. Topic-Gruppen behalten den
     vollen Schluessel: er ist eindeutig, und die Tabelle liest ihre Topics aus tag_id. */
  function gruppenSchluessel(x) {
    var k = str(x.group_key), typ = str(x.group_type);
    if (typ === "custom" || /^custom:/.test(k)) return k.replace(/^custom:/, "");
    return k;
  }
  function zuGruppen(d) {
    var r = zeilen(d);
    if (!r) return null;
    return r.map(function (x) {
      var typ = str(x.group_type) || (/^custom:/.test(str(x.group_key)) ? "custom" : str(x.group_key) === "untagged" ? "untagged" : "topic");
      return {
        group_key: gruppenSchluessel(x), group_type: typ,
        tag_id: str(x.tag_id), tag_ids: liste(x.tag_ids) || [],
        tag_name: str(x.name != null ? x.name : x.tag_name), tag_emoji: str(x.emoji != null ? x.emoji : x.tag_emoji),
        tag_hex_light: str(x.hex_light || x.tag_hex_light), tag_hex_dark: str(x.hex_dark || x.tag_hex_dark || x.hex_light),
        is_custom: typ === "custom", is_untagged: typ === "untagged",
        prompts_count: num(x.prompts_count), prompts_count_inactive: num(x.prompts_count_inactive),
        visibility_pct: num(x.visibility_pct), avg_rank: num(x.avg_rank), avg_sentiment: num(x.avg_sentiment)
      };
    });
  }
  function abgelegteTopics(d) { var l = meta(d).dropped_tag_ids; return isArr(l) ? l.map(str).filter(Boolean) : []; }

  /* Seiten-Meta: Kontingent, Topics, Maerkte, Rolle (Vertrag 6.2 plus Rueckmeldung 2.1).
     topics: fuer topics-manager und den Topic-Editor der Tabelle. prompt_count = aktiv + inaktiv,
     wie get_tags_v2 heute zaehlt (so stehen die Zahlen in der Verwaltung wie bisher).
     kontingent: in der Form des Kontingent-Stores von core ({used, total, plan}). */
  function zuSeite(d) {
    if (!d || typeof d !== "object" || isArr(d)) return null;
    var q = d.quota && typeof d.quota === "object" ? d.quota : null;
    var topics = isArr(d.topics) ? d.topics.filter(function (t) { return t && typeof t === "object" && (t.tag_id || t.id); }) : null;
    if (!topics) return null;
    var rolle = str(meta(d).role || d.role).toLowerCase();
    return {
      topics: topics.map(function (t) {
        var o = topic(t), a = num(t.prompt_count_active), i = num(t.prompt_count_inactive);
        o.prompt_count = a == null && i == null ? num(t.prompt_count) : (a || 0) + (i || 0);
        o.prompt_count_active = a; o.prompt_count_inactive = i;
        o.created_at = str(t.created_at); o.is_active = t.is_active !== false;
        return o;
      }),
      kontingent: q && num(q.prompts_active) != null && num(q.prompts_limit) != null
        ? { used: num(q.prompts_active), total: num(q.prompts_limit), plan: str(q.plan), remaining: num(q.prompts_remaining) } : null,
      maerkteAlle: (isArr(d.markets_all) ? d.markets_all : []).filter(function (m) { return m && m.alpha2; })
        .map(function (m) { return { alpha2: str(m.alpha2).toLowerCase(), name: str(m.name), flag_url: absolut(m.flag_url) }; }),
      /* Unbekannt heisst: nicht ausblenden. Die Datenbank prueft ohnehin; ein Knopf, der einem
         owner faelschlich fehlt, waere schlimmer als einer, der einem member eine klare
         Fehlermeldung bringt. */
      rolle: rolle === "owner" || rolle === "admin" || rolle === "member" ? rolle : "",
      darfLoeschen: rolle !== "member"
    };
  }
  function kontingentAus(m) {
    var q = m && m.quota && typeof m.quota === "object" ? m.quota : null;
    if (!q || num(q.prompts_active) == null || num(q.prompts_limit) == null) return null;
    return { used: num(q.prompts_active), total: num(q.prompts_limit), remaining: num(q.prompts_remaining) };
  }
  /* Ergebnis der Anlage: Zahlen fuer den Satz an den Nutzer. */
  function zuAnlage(d) {
    if (!d || typeof d !== "object") return null;
    var m = meta(d), r = zeilen(d) || [];
    var gruende = {};
    r.forEach(function (x) { if (str(x.result) === "skipped") { var g = str(x.reason) || "other"; gruende[g] = (gruende[g] || 0) + 1; } });
    return {
      angelegt: num(m.created) != null ? num(m.created) : r.filter(function (x) { return str(x.result) === "created"; }).length,
      uebersprungen: num(m.skipped) != null ? num(m.skipped) : r.filter(function (x) { return str(x.result) === "skipped"; }).length,
      umgeschrieben: r.filter(function (x) { return x.rewritten === true; }).length,
      gruende: gruende, kontingent: kontingentAus(m)
    };
  }
  function zuSammel(d) {
    if (!d || typeof d !== "object") return null;
    var m = meta(d);
    return { geaendert: num(m.changed), unveraendert: num(m.unchanged), ziel: num(m.target_count), kontingent: kontingentAus(m) };
  }
  /* topic_save_v1: meta.topic (wie in der Seiten-Meta), meta.created. */
  function zuTopic(d) {
    var m = meta(d), t = m.topic && typeof m.topic === "object" ? m.topic : null;
    return t ? { topic: topic(t), neu: m.created === true } : null;
  }

  /* ---- Fehler ----------------------------------------------------------------------------------
     Die Fehlerart (wie citations-data.js) und die stabile message des Vertrags. */
  function fehlerArt(erg) { return C() && C().fehlerArt ? C().fehlerArt(erg) : "x"; }
  function meldung(erg) { return erg && erg.fehler ? str(erg.fehler.message) : ""; }
  function hinweis(erg) { return erg && erg.fehler ? str(erg.fehler.hint) : ""; }
  function hinweisZahl(erg) { var m = /-?\d+/.exec(hinweis(erg)); return m ? Number(m[0]) : null; }

  function responses(f, r) { return DD().responsesTeile(f, r); }
  function zuResponses(teile) { return DD().zuResponses(teile); }
  function makeLader(o) { return C().makeLader(o); }

  window.UpstreemPromptsDaten = {
    FN: FN, ORDER: ORDER, GRENZE: GRENZE,
    liste: liste_, gruppen: gruppen, seite: seite,
    anlegen: anlegen, topicsSetzen: topicsSetzen, sammel: sammel,
    topicSpeichern: topicSpeichern, topicLoeschen: topicLoeschen, aktualisieren: aktualisieren,
    responses: responses, zuResponses: zuResponses,
    zuListe: zuListe, zuGruppenZeilen: zuGruppenZeilen, zuGruppen: zuGruppen, abgelegteTopics: abgelegteTopics,
    zuSeite: zuSeite, zuAnlage: zuAnlage, zuSammel: zuSammel, zuTopic: zuTopic,
    fehlerArt: fehlerArt, meldung: meldung, hinweis: hinweis, hinweisZahl: hinweisZahl,
    makeLader: makeLader
  };
})();
