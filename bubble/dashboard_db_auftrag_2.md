# Auftrag 2 an den Datenbank-Chat: Dashboard v1, Stand 09.10.2026

Die Dashboard-Seite läuft live gegen den Vertrag „Dashboard v1 (in Prod)“. Es gibt zwei Punkte.
Punkt 1 ist ein Fehler, Punkt 2 eine Lücke, die ich in Rückmeldung 1 selbst verursacht habe.
**Regeln wie immer:** nichts raten, Definitionen mit `pg_get_functiondef` holen, Bestand nicht
ändern, Neues als `_v1` daneben.

---

## 1. XX000 „cannot find parent statement on pldbgapi2 call stack“

**Was passiert (gemeldet am 09.10., Team 877c, Agentic, 30 Tage, ohne Filter):**

```json
{ "code": "XX000", "details": null, "hint": null,
  "message": "cannot find parent statement on pldbgapi2 call stack" }
```

- `cached_citations_urls_v1` scheitert beim Seitenaufbau mit diesem Fehler. Zur selben Zeit laufen
  `cached_dashboard_overview_v1` und `cached_citations_domains_v1` gleichzeitig.
- Ein zweiter Aufruf ein paar Sekunden später scheitert genauso.
- Ein dritter, noch etwas später, läuft durch. Nach einem Neuladen kommt die Antwort aus dem Cache.

Parameter des Aufrufs:

```json
{ "p_team": "<team>", "p_date_from": "<heute-29>", "p_date_to": "<heute>",
  "p_models": null, "p_markets": null, "p_tag_ids": null, "p_tagmode": "or",
  "p_mentioned": "all", "p_mentioned_brands": null, "p_citation_types": null,
  "p_url_types": null, "p_search": null, "p_order": "share_delta_desc",
  "p_limit": 5, "p_offset": 0 }
```

**Meine Vermutung, bitte prüfen, nicht übernehmen:** `pldbgapi2` ist der PL/pgSQL-Debugger
(`plugin_debugger`). Dieser Fehler entsteht, wenn sein Aufrufstapel nicht mehr zu dem von PL/pgSQL
passt. Das passiert typischerweise, wenn eine Ausnahme in einer verschachtelten Funktion gefangen
wird. Der eigentliche Fehler darunter wäre dann verdeckt, etwa ein Lock- oder Statement-Timeout
beim Coalescing oder ein Konflikt mit dem Hintergrund-Job `citations-cache-refresh`.

Bitte:

1. Prüfen, ob `plugin_debugger` geladen ist (`shared_preload_libraries`, `pg_extension`).
2. Die Ursache darunter finden: Welcher Fehler wird in `cached_citations_urls_v1` bzw. in seinen
   Helfern gefangen? Lock-Wartezeit, Timeout oder Abbruch beim Coalescing?
3. Beheben, sodass der echte Fehler mit stabiler `message` kommt oder gar keiner.
4. Prüfen, ob dieselbe Stelle auch in `_domains_v1`, `_overview_v1` und den Dashboard-Funktionen
   steckt.

Die Oberfläche wiederholt einen Serverfehler jetzt zweimal (nach 0,8 s und nach 2 s). Das verdeckt
die Ursache nur, behoben ist sie damit nicht.

---

## 2. Chats und Opportunities für Agentic

In Rückmeldung 1 habe ich `cached_dashboard_agentic_v1` gestrichen und geschrieben: „Chats kommen
weiter aus Ask Mira, Opportunities aus ihrer eigenen Komponente.“ **Das war falsch.** Beide kamen
bisher aus `get_power_dashboard_v1`, das Bubble beim Seitenaufbau aufrief. Mit der neuen Seite fehlt
dieser Aufruf: Recent Chats bleiben im Skelett, und das Opportunities-Brett lädt endlos.

Du hattest im Vorschlag schon die bestehenden Quellen genannt:

- Chats: „Form wie heute aus `cached_mira_chat_sessions_v1`“
- Opportunities: „Form wie heute aus `cached_list_source_recommendations_v1`“

Bitte für **beide** Funktionen:

1. die vollständige Definition und `pg_get_function_identity_arguments`;
2. Rechte: ob sie für `authenticated` ausführbar sind, ob `anon` gesperrt ist und ob
   `security definer` mit festem `search_path` gilt;
3. die Zugangsprüfung: ob sie den Nutzer aus dem JWT nehmen (Chats: `auth.uid()`) und das Team per
   `require_team_access` prüfen;
4. ein echtes, ungekürztes Beispiel (Hauptteam): Chats mit 15 Einträgen, Opportunities mit allen
   Zuständen (pending, in_progress, done, ignored).

**Falls eine davon nicht direkt aus dem Browser aufrufbar sein darf:** bitte je einen `_v1`-Wrapper
nach den Regeln des Dashboard-Vertrags, also mit `meta`, stabilen Fehlern, `PT429` und `p_team`.

| Funktion (Vorschlag) | liefert | Felder, die die Oberfläche liest |
|---|---|---|
| `dashboard_chats_v1(p_team, p_limit, p_offset)` | die Chats des angemeldeten Nutzers, sortiert wie Miras Liste (`is_pinned desc, updated_at desc, id desc`) | `id`, `title`, `updated_at` (mehr nicht, keine Vorschau: Modelltext mit Backticks hat schon einmal einen Schritt zerlegt) |
| `dashboard_opportunities_v1(p_team)` | alle Opportunities des Teams, alle Zustände | genau die Felder, die `opportunitiesSetItems` heute bekommt (`id`, `headline`, `board`, `score` …, siehe Bestand) |

`headline` und `reason` sind Modelltext. Der Backtick muss im RPC raus:
`replace(feld, chr(96), '')`.

---

## 3. Noch offen aus Rückmeldung 2 (blockiert nichts)

- Farben bei `p_companies` nach `position` statt nach der Reihenfolge der Auswahl.
- `cached_dashboard_responses_v1`: `p_limit` bis 100.
