<!-- Backend-Vertrag Impact Events, vom Nutzer am 02.10.2026 geliefert, unveraendert abgelegt.
     Massgeblich fuer events.js und _h_uev_daten.js. -->

# Impact Events – vollständiger Backend-Vertrag für das Frontend

**Stand: final. Dieses Dokument ersetzt alle früheren Event-Dokumente** (`IMPACT_EVENTS_API.md`, `IMPACT_EVENTS_EXPECTED_RESPONSES.md`, `IMPACT_EVENTS_UI_KIT.md`).
Alle Namen hier sind die echten, implementierten Namen. Es gibt keine Platzhalter.

---

## 0. Grundregeln

1. **Ein Event speichert nur Kontext, keine Kennzahlen:** Datum, eingefrorene Prompt-Kohorten (betroffen und Vergleich), gewählte Topics und Ziel-URLs.
   Alle Zahlen werden bei jedem Aufruf aus den bestehenden Upstreem-Daten berechnet.
2. **Eingefroren beim Anlegen:** Die betroffene Kohorte besteht aus den Prompts, die *zum Zeitpunkt des Anlegens* aktiv sind (`prompt.is_active`), entweder alle oder die aus den gewählten Topics.
   - Später aktivierte, neu angelegte oder umsortierte Prompts kommen nie dazu.
   - Datum, Scope, Topics und beide Kohorten sind in der Datenbank gesperrt.
   - Ein falsch angelegtes Event löschen und neu anlegen.
3. **Vergleichs-Kohorte:** Wird einmal beim Anlegen festgelegt. Sie enthält aktive Prompts außerhalb der gewählten Topics und nur aus Märkten, die auch in der betroffenen Kohorte vorkommen.
   Bei „alle aktiven Prompts“ ist sie leer. Das ist gültig und kein Fehler.
4. **Kennzahlen:** Visibility, Rank, Sentiment und Global Share werden exakt wie im Rest von Upstreem berechnet. Geprüft ist das gegen
   `get_competition_overview_v24` (Vorher/Nachher), `get_company_detailed_chart_v4` (Tages-Trend) und `get_url_bundle_v7` (Global Share).
5. **Datumslogik:** Es gilt der Berliner Tag.
   - Vorher = `event − N … event − 1`, Nachher = `event + 1 … min(event + N, heute)`. Der **Event-Tag zählt weder vorher noch nachher**.
   - Der Tages-Trend zeigt den Event-Tag trotzdem als normalen Datenpunkt (`is_event_day = true`).
   - N geht von 1 bis 183.
6. **Vergleichbarkeit:** Vorher/Nachher nutzt nur Modelle, die auf beiden Seiten Daten haben, und davon nur Prompts mit Daten auf beiden Seiten.
   Ein später hinzugefügtes Modell und Prompts, die es erst nach dem Event gibt, verfälschen den Vergleich deshalb nicht. Sie erscheinen nur im Trend.
7. **URLs:** Ziel-URLs werden genauso normalisiert wie im n8n-Citation-Workflow (`app.url_norm_v1`).
   - Abgeglichen wird immer über die normalisierte URL. Dadurch werden auch URLs, die zum Zeitpunkt des Hinzufügens noch nie zitiert wurden, automatisch erkannt, sobald sie zitiert werden. Kein Nachpflegen nötig.
   - Event-URLs erzeugen nie Einträge in `source_url` oder den Citation-Tabellen.
8. **Team-Trennung:** Jede Beobachtung, jeder Share und jede Response stammt nur aus den Daten des eigenen Teams.
   Dass eine URL global bekannt ist, zählt nie als Beobachtung.
9. **Keine Kausalität:** Feldnamen und Texte beschreiben Beobachtungen („vorher/nachher“, „Entwicklung“), nie Ursachen.

---

## 1. Aufrufkonventionen

- **Aufruf:** Alle RPCs liegen im Schema `app` und werden aus Bubble mit dem Nutzer-JWT aufgerufen (Supabase/PostgREST).
- **Parameter:** Sie werden **per Name** übergeben. Optionale Parameter weglassen oder `null` setzen.
- **Datentypen:**

  | Typ | Format |
  |---|---|
  | Datum | `"YYYY-MM-DD"` |
  | Zeitstempel | ISO 8601 mit Zeitzone |
  | IDs | UUID-Strings |
  | Prozentwerte | Zahl mit 2 Nachkommastellen (`39.87` = 39,87 %) |

- **Deltas:** immer `after − before`. Bei Visibility und Global Share also in Prozentpunkten, beim Rank gilt kleiner = besser.
- **Zugriff:** Jede RPC prüft `app.require_team_access(p_team)`: angemeldet, Mitglied und Team mit aktivem Zugang.
- **Strings:** Alle Text-Antworten laufen durch `app.js_safe`. Backticks, Backslashes und `${` sind entfernt bzw. entschärft, die Texte können also direkt in JavaScript-Template-Strings.

### 1.1 Fehler: was Bubble bekommt und was an den Error-Setter geht

- **Fehlerformat:** Fehler werden in Postgres als Exception geworfen. PostgREST antwortet mit HTTP-Status ≠ 200 und diesem Body:
  ```json
  {"code": "P0001", "details": null, "hint": null, "message": "impact_event_url_duplicate"}
  ```
- **Was weitergeben:** Im API Connector „Include errors in response and allow workflow actions to continue“ aktivieren. Dann aus dem Fehler-Body **nur `message`** an den Error-Setter der Event-Komponente geben, zum Beispiel `setEventError("impact_event_url_duplicate")`.
- **Worauf man sich verlassen kann:** Die `message` ist ein **stabiler Code** (Tabelle 4). HTTP-Status und `code` sind nicht stabil, darauf nichts aufbauen. Freie Postgres-Texte muss niemand parsen: Doppelte URLs (auch bei gleichzeitigen Anfragen) und Rate-Limits sind auf stabile Codes abgebildet.
- **Alles andere:** Jede `message`, die nicht in Tabelle 4 steht, als generischen Fehler anzeigen („Etwas ist schiefgelaufen“).

---

## 2. Übersicht

| Zweck | RPC | Typ |
|---|---|---|
| Event-Übersicht (Karten/Liste) **und** Event-Marker in Diagrammen | `app.list_impact_events_v1` | lesen |
| Event-Kopf, Topics, URL-Verwaltung | `app.get_impact_event_v1` | lesen |
| Anlegen-Dialog: „47 aktive Prompts enthalten“ | `app.preview_impact_event_scope_v1` | lesen |
| Event-Analyse: KPIs, Vergleich, Wettbewerber, URLs, Trend, Überschneidungen | `app.cached_impact_event_analysis_v1` | lesen (Cache) |
| Responses-Tabelle (normal **und** „Responses mit betroffenen URLs“) | `app.cached_mentions_overview_v1` | lesen (Cache) |
| Response-Detail öffnen | `app.get_mention_detail_v7` (bestehend, unverändert) | lesen |
| Anlegen | `app.create_impact_event_v1` | schreiben |
| Name/Beschreibung/Typ/Icon/Farbe ändern | `app.update_impact_event_v1` | schreiben |
| URL hinzufügen / entfernen | `app.add_impact_event_url_v1` / `app.remove_impact_event_url_v1` | schreiben |
| Löschen | `app.delete_impact_event_v1` | schreiben |

Daneben gibt es `get_impact_event_analysis_v1` und `get_mentions_overview_v21`. Das sind die ungecachten Basisfunktionen, das Frontend ruft immer die Wrapper oben.

---

## 3. Die RPCs im Detail

### 3.1 `app.list_impact_events_v1` – Übersicht und Diagramm-Marker

**Zweck:** Alle Events des Teams, leichtgewichtig, ohne Analyse. Dieselbe Antwort reicht für die Event-Marker in bestehenden Diagrammen (`event_date`, `name`, `icon`, `color`, `event_type`).

| Parameter | Typ | Pflicht | Default | Bedeutung |
|---|---|---|---|---|
| `p_team` | uuid | ja | – | Team |
| `p_date_from` | date | nein | `null` | nur Events mit `event_date >= p_date_from` (für Marker: Diagramm-Start) |
| `p_date_to` | date | nein | `null` | nur Events mit `event_date <= p_date_to` |

**Antwort:** JSON-Array, sortiert nach `event_date` absteigend, bei gleichem Datum nach `created_at` absteigend. Kein Paging, ein Team hat wenige Events. Gibt es keine, kommt `[]`.

| Feld | Typ | null | Bedeutung |
|---|---|---|---|
| `id` | uuid | nein | Event-ID |
| `event_date` | date | nein | Tag der Änderung |
| `name` | text | nein | |
| `description` | text | ja | vollständig, nicht gekürzt. Kürzen macht die UI |
| `event_type` | text | nein | freier Typ-Schlüssel, Standard `"other"` (Liste in 6.2) |
| `icon` | text | ja | z. B. Emoji |
| `color` | text | ja | Hex `#rrggbb` |
| `cover` | text | ja | **Neu 03.10.** Titelbild, einer von `wave_blue`, `wave_pink`, `wave_teal`, `poly_blue`, `poly_pink`, `poly_sand`. `null` = kein Titelbild (Band in `color`). Die Bilder liefert das Frontend, gespeichert wird nur der Schlüssel |
| `scope_mode` | text | nein | `"topics"` (gewählte Topics) oder `"all"` (alle aktiven Prompts beim Anlegen) |
| `selected_topic_count` | int | **ja** | Anzahl gewählter Topics. **`null` bei `scope_mode = "all"`** (nicht anwendbar) |
| `affected_prompt_count` | int | nein | Prompts der eingefrorenen betroffenen Kohorte |
| `comparison_prompt_count` | int | nein | Prompts der eingefrorenen Vergleichs-Kohorte (bei `"all"` = 0) |
| `affected_url_count` | int | nein | Anzahl Ziel-URLs am Event (nicht: beobachtete URLs) |
| `created_by` | uuid | nein | Ersteller |
| `created_at` | timestamptz | nein | |
| `can_delete` | bool | nein | Darf der aktuelle Nutzer löschen? (Ersteller, owner oder admin) |

`can_delete` liefert der Server, weil die Regel den Ersteller einbezieht. Das Muster entspricht `can_manage_billing` aus `get_team_plan_quota_v3`. Ein `can_edit` gibt es nicht: Bearbeiten und URLs pflegen darf jedes Teammitglied.

UI-Zeile: `"topics"` → „{selected_topic_count} Topics · {affected_prompt_count} Prompts · {affected_url_count} URLs“, `"all"` → „Alle aktiven Prompts · {affected_prompt_count} Prompts · {affected_url_count} URLs“.

**Beispiel-Request:** `{"p_team": "877c649c-f5f2-44e9-bb04-155f5bf44e70"}`
**Beispiel-Antwort:** Topics-Event, Alle-Event und Event ohne URLs:
```json
[
  {
    "id": "7a3f2e5d-cccc-4b80-9c9d-0000000000c3",
    "event_date": "2026-10-01",
    "name": "Produktlaunch Speicher X",
    "description": "Launch des neuen Heimspeichers Speicher X mit eigener Landingpage und Pressemitteilung.",
    "event_type": "product_launch",
    "icon": "🚀",
    "color": "#7c3aed",
    "scope_mode": "topics",
    "selected_topic_count": 1,
    "affected_prompt_count": 9,
    "comparison_prompt_count": 52,
    "affected_url_count": 1,
    "created_by": "3f2a9c1e-7b44-4d0a-9e61-2c8d5f1a0b77",
    "created_at": "2026-10-01T16:22:09.101+00:00",
    "can_delete": true
  },
  {
    "id": "8b4a3f6e-dddd-4c91-8dae-0000000000d4",
    "event_date": "2026-09-08",
    "name": "PR-Kampagne Herbst",
    "description": "Drei Gastbeiträge in Fachmagazinen zum Thema Eigenverbrauch.",
    "event_type": "pr_campaign",
    "icon": "📰",
    "color": "#f59e0b",
    "scope_mode": "topics",
    "selected_topic_count": 2,
    "affected_prompt_count": 14,
    "comparison_prompt_count": 47,
    "affected_url_count": 3,
    "created_by": "51d0e2aa-90c3-4b1f-8a77-6e2b9c4d1f08",
    "created_at": "2026-09-09T07:45:00.000+00:00",
    "can_delete": false
  },
  {
    "id": "5e1d0c3b-aaaa-4f6e-9a7b-0000000000a1",
    "event_date": "2026-09-01",
    "name": "Website Relaunch",
    "description": "Neue Website mit überarbeiteten Produkt- und Preisseiten, neue Ratgeber-Sektion.",
    "event_type": "website_relaunch",
    "icon": "🌐",
    "color": "#22aa55",
    "scope_mode": "topics",
    "selected_topic_count": 3,
    "affected_prompt_count": 24,
    "comparison_prompt_count": 38,
    "affected_url_count": 5,
    "created_by": "3f2a9c1e-7b44-4d0a-9e61-2c8d5f1a0b77",
    "created_at": "2026-09-03T08:14:22.512+00:00",
    "can_delete": true
  },
  {
    "id": "6f2e1d4c-bbbb-4a7f-8b8c-0000000000b2",
    "event_date": "2026-03-25",
    "name": "Markenkampagne TV",
    "description": null,
    "event_type": "brand_campaign",
    "icon": "📣",
    "color": null,
    "scope_mode": "all",
    "selected_topic_count": null,
    "affected_prompt_count": 61,
    "comparison_prompt_count": 0,
    "affected_url_count": 0,
    "created_by": "3f2a9c1e-7b44-4d0a-9e61-2c8d5f1a0b77",
    "created_at": "2026-04-02T12:00:00.000+00:00",
    "can_delete": true
  }
]
```

### 3.2 `app.get_impact_event_v1` – Event-Detail (Stammdaten)

| Parameter | Typ | Pflicht | Default |
|---|---|---|---|
| `p_team` | uuid | ja | – |
| `p_event_id` | uuid | ja | – |

**Antwort:** ein Objekt. Create, Update sowie URL hinzufügen und entfernen liefern **dasselbe Objekt** zurück.

| Feld | Typ | null | Bedeutung |
|---|---|---|---|
| `id`, `team_id` | uuid | nein | |
| `name` | text | nein | |
| `description` | text | ja | mehrzeilig möglich |
| `event_type` | text | nein | |
| `event_date` | date | nein | |
| `icon`, `color` | text | ja | |
| `cover` | text | ja | **Neu 03.10.** wie in 3.1 |
| `scope_mode` | text | nein | `"topics"` / `"all"` |
| `created_by` | uuid | nein | |
| `created_at`, `updated_at` | timestamptz | nein | |
| `can_delete` | bool | nein | wie in 3.1 |
| `topics[]` | array | nein | gewählte Topics. Bei `"all"` ist das `[]` |
| `topics[].id` | uuid | nein | Tag-ID |
| `topics[].name` | text | nein | aktueller Name, oder der Name beim Anlegen, falls das Topic gelöscht wurde |
| `topics[].deleted` | bool | nein | Topic existiert nicht mehr (Chip ausgegraut). Die Kohorte bleibt trotzdem unverändert |
| `selected_topic_count` | int | ja | `null` bei `"all"` |
| `affected_prompt_count`, `comparison_prompt_count`, `affected_url_count` | int | nein | wie in 3.1 |
| `urls[]` | array | nein | Ziel-URLs, sortiert nach Hinzufügedatum, `[]` wenn keine |
| `urls[].id` | uuid | nein | **Event-URL-ID**: für Entfernen, für den Response-Filter `p_event_url_id` und als Inhalt von `matched_event_url_ids` |
| `urls[].url` | text | nein | normalisierte URL (anzeigen) |
| `urls[].url_input` | text | nein | Eingabe des Nutzers |
| `urls[].team_kannte_url` | bool | nein | War die URL beim Hinzufügen schon in den Team-Daten? Nur Info |
| `urls[].created_at` | timestamptz | nein | |

Mit Topics und URLs:
```json
{
  "id": "5e1d0c3b-aaaa-4f6e-9a7b-0000000000a1",
  "team_id": "877c649c-f5f2-44e9-bb04-155f5bf44e70",
  "name": "Website Relaunch",
  "description": "Neue Website mit überarbeiteten Produkt- und Preisseiten, neue Ratgeber-Sektion.",
  "event_type": "website_relaunch",
  "event_date": "2026-09-01",
  "icon": "🌐",
  "color": "#22aa55",
  "scope_mode": "topics",
  "created_by": "3f2a9c1e-7b44-4d0a-9e61-2c8d5f1a0b77",
  "created_at": "2026-09-03T08:14:22.512+00:00",
  "updated_at": "2026-09-10T15:02:41.097+00:00",
  "can_delete": true,
  "topics": [
    {
      "id": "e1f2a3b4-0001-4c5d-8e6f-000000000001",
      "name": "Photovoltaik Kosten",
      "deleted": false
    },
    {
      "id": "e1f2a3b4-0002-4c5d-8e6f-000000000002",
      "name": "Solaranbieter Vergleich",
      "deleted": false
    },
    {
      "id": "e1f2a3b4-0003-4c5d-8e6f-000000000003",
      "name": "Stromspeicher",
      "deleted": true
    }
  ],
  "selected_topic_count": 3,
  "affected_prompt_count": 24,
  "comparison_prompt_count": 38,
  "affected_url_count": 5,
  "urls": [
    {
      "id": "9c8b7a6d-0001-4e5f-8a9b-000000000001",
      "url": "https://www.sonnenkraft.de/preise",
      "url_input": "https://www.sonnenkraft.de/preise/?utm_source=newsletter",
      "team_kannte_url": true,
      "created_at": "2026-09-03T08:14:22.512+00:00"
    },
    {
      "id": "9c8b7a6d-0002-4e5f-8a9b-000000000002",
      "url": "https://www.sonnenkraft.de/ratgeber/photovoltaik-kosten",
      "url_input": "sonnenkraft.de/ratgeber/photovoltaik-kosten",
      "team_kannte_url": false,
      "created_at": "2026-09-03T08:14:22.512+00:00"
    },
    {
      "id": "9c8b7a6d-0003-4e5f-8a9b-000000000003",
      "url": "https://de.wikipedia.org/wiki/Photovoltaikanlage",
      "url_input": "https://de.wikipedia.org/wiki/Photovoltaikanlage",
      "team_kannte_url": true,
      "created_at": "2026-09-03T08:14:22.512+00:00"
    },
    {
      "id": "9c8b7a6d-0004-4e5f-8a9b-000000000004",
      "url": "https://www.energie-magazin.de/test/solaranbieter-2026",
      "url_input": "https://www.energie-magazin.de/test/solaranbieter-2026#fazit",
      "team_kannte_url": false,
      "created_at": "2026-09-12T10:41:05.330+00:00"
    },
    {
      "id": "9c8b7a6d-0005-4e5f-8a9b-000000000005",
      "url": "https://www.sonnenkraft.de/stromspeicher",
      "url_input": "https://www.sonnenkraft.de/stromspeicher",
      "team_kannte_url": true,
      "created_at": "2026-09-15T09:00:13.774+00:00"
    }
  ]
}
```
Alle aktiven Prompts, ohne URLs:
```json
{
  "id": "6f2e1d4c-bbbb-4a7f-8b8c-0000000000b2",
  "team_id": "877c649c-f5f2-44e9-bb04-155f5bf44e70",
  "name": "Markenkampagne TV",
  "description": null,
  "event_type": "brand_campaign",
  "event_date": "2026-03-25",
  "icon": "📣",
  "color": null,
  "scope_mode": "all",
  "created_by": "3f2a9c1e-7b44-4d0a-9e61-2c8d5f1a0b77",
  "created_at": "2026-04-02T12:00:00.000+00:00",
  "updated_at": "2026-04-02T12:00:00.000+00:00",
  "can_delete": true,
  "topics": [],
  "selected_topic_count": null,
  "affected_prompt_count": 61,
  "comparison_prompt_count": 0,
  "affected_url_count": 0,
  "urls": []
}
```

### 3.3 `app.preview_impact_event_scope_v1` – Vorschau im Anlegen-Dialog

**Zweck:** zeigt vor dem Anlegen „47 aktive Prompts enthalten“. Vorschau und Anlegen nutzen **denselben Resolver** (`app.impact_resolve_scope_prompts_v1`).
Die Zahl entspricht also exakt der Kohorte, die ein sofortiges Anlegen einfrieren würde. Ein Prompt in mehreren gewählten Topics zählt **einmal**. Es zählt der *heutige* Aktiv-Status, auch bei rückdatiertem Event.

| Parameter | Typ | Pflicht | Default | Bedeutung |
|---|---|---|---|---|
| `p_team` | uuid | ja | – | |
| `p_scope_mode` | text | ja | – | `"topics"` oder `"all"` |
| `p_tag_ids` | uuid[] | nein | `null` | gewählte Topics (Tags). Bei `"all"` wird es ignoriert |

**Antwort:** `{"affected_prompt_count": <int>}`. `0` ist eine normale Antwort, kein Fehler: dann „Anlegen“ deaktivieren.
Nur ein ungültiger `p_scope_mode` wirft `impact_event_invalid_scope`.

| Request | Antwort |
|---|---|
| `{"p_team": "…", "p_scope_mode": "topics", "p_tag_ids": ["e1f2…0001", "e1f2…0002"]}` | `{"affected_prompt_count": 47}` |
| `{"p_team": "…", "p_scope_mode": "all"}` | `{"affected_prompt_count": 84}` |
| `{"p_team": "…", "p_scope_mode": "topics", "p_tag_ids": []}` | `{"affected_prompt_count": 0}` |
| `{"p_team": "…", "p_scope_mode": "topics", "p_tag_ids": ["<Topic nur mit inaktiven Prompts>"]}` | `{"affected_prompt_count": 0}` |

### 3.4 `app.create_impact_event_v1` – Anlegen

| Parameter | Typ | Pflicht | Default | Bedeutung |
|---|---|---|---|---|
| `p_team` | uuid | ja | – | |
| `p_name` | text | ja | – | 1–120 Zeichen |
| `p_event_date` | date | ja | – | heute − 183 Tage … heute (Berliner Tag), keine Zukunft |
| `p_scope_mode` | text | ja | – | `"topics"` / `"all"` |
| `p_tag_ids` | uuid[] | bei `"topics"` | `null` | Topics des Teams |
| `p_urls` | text[] | nein | `null` | 0–100 URLs. Werden normalisiert und dedupliziert. Ohne Schema eingegeben wird `https://` ergänzt |
| `p_description` | text | nein | `null` | |
| `p_event_type` | text | nein | `"other"` | |
| `p_icon` | text | nein | `null` | |
| `p_color` | text | nein | `null` | `#rrggbb` |
| `p_cover` | text | nein | `null` | **Neu 03.10.** Schlüssel des Titelbilds (Liste in 3.1). Unbekannte Werte als `null` speichern |

Alles läuft in einer Transaktion. Bei einem Fehler entsteht nichts. **Erfolg:** das Detail-Objekt (3.2).
Mögliche Fehler: `impact_event_name_required`, `impact_event_invalid_date`, `impact_event_invalid_scope`, `impact_event_topics_required`,
`impact_event_invalid_topics`, `impact_event_invalid_url`, `impact_event_too_many_urls`, `impact_event_no_active_prompts`, `impact_event_rate_limited`, Zugriffsfehler.

Beispiel-Request:
```json
{
  "p_team": "877c649c-f5f2-44e9-bb04-155f5bf44e70",
  "p_name": "Website Relaunch",
  "p_event_date": "2026-09-01",
  "p_scope_mode": "topics",
  "p_tag_ids": [
    "e1f2a3b4-0001-4c5d-8e6f-000000000001",
    "e1f2a3b4-0002-4c5d-8e6f-000000000002",
    "e1f2a3b4-0003-4c5d-8e6f-000000000003"
  ],
  "p_urls": [
    "https://www.sonnenkraft.de/preise/?utm_source=newsletter",
    "sonnenkraft.de/ratgeber/photovoltaik-kosten",
    "https://de.wikipedia.org/wiki/Photovoltaikanlage"
  ],
  "p_description": "Neue Website mit überarbeiteten Produkt- und Preisseiten, neue Ratgeber-Sektion.",
  "p_event_type": "website_relaunch",
  "p_icon": "🌐",
  "p_color": "#22aa55"
}
```

### 3.5 `app.update_impact_event_v1` – Stammdaten ändern

| Parameter | Typ | Pflicht | Default | Bedeutung |
|---|---|---|---|---|
| `p_team`, `p_event_id` | uuid | ja | – | |
| `p_name` | text | nein | `null` | `null` = unverändert. Leerer String ist nicht erlaubt (`impact_event_name_required`) |
| `p_description`, `p_event_type`, `p_icon`, `p_color`, `p_cover` | text | nein | `null` | `null` = unverändert, `""` = leeren (Typ fällt dann auf `"other"` zurück; `p_cover` ist **neu seit 03.10.**) |

Datum, Scope und Topics sind **nicht** änderbar, dafür gibt es keinen Parameter. **Erfolg:** das Detail-Objekt. Fehler: `impact_event_not_found`, `impact_event_name_required`, `impact_event_rate_limited`.

### 3.6 `app.add_impact_event_url_v1` / 3.7 `app.remove_impact_event_url_v1`

| RPC | Parameter | Erfolg | Fehler |
|---|---|---|---|
| `add_impact_event_url_v1` | `p_team`, `p_event_id`, `p_url` (text) | Detail-Objekt | `impact_event_not_found`, `impact_event_invalid_url`, `impact_event_url_duplicate`, `impact_event_too_many_urls`, `impact_event_rate_limited` |
| `remove_impact_event_url_v1` | `p_team`, `p_event_id`, `p_url_id` (uuid = `urls[].id`) | Detail-Objekt | `impact_event_not_found`, `impact_event_url_not_found`, `impact_event_rate_limited` |

Hinzufügen ist auch nachträglich möglich. Die Analyse wertet die URL trotzdem ab dem Event-Datum aus, nicht ab dem Hinzufügen.
Entfernen löscht nur die Zuordnung, nie Citation-Daten. Erst beim Klick auf „Hinzufügen“ speichern, nie beim Tippen.
Für Vorschläge beim Tippen die bestehende Suche nutzen (`search_quick_actions_v2`, zeigt nur Team-URLs).

### 3.8 `app.delete_impact_event_v1` – Löschen

Parameter: `p_team`, `p_event_id`. **Erfolg:** `{"ok": true, "deleted_event_id": "<uuid>"}`.
Fehler: `impact_event_not_found`, `forbidden` (weder Ersteller noch owner/admin), `impact_event_rate_limited`. Mit dem Event verschwinden Kohorten, Topics und URLs, die Citation-Daten bleiben unberührt.

### 3.9 `app.cached_impact_event_analysis_v1` – Event-Analyse

| Parameter | Typ | Pflicht | Default | Bedeutung |
|---|---|---|---|---|
| `p_team`, `p_event_id` | uuid | ja | – | |
| `p_window_days` | int | nein | `30` | Länge jeder Seite, 1–183 (Werte darüber werden auf 183 begrenzt). Presets: 7 / 30 / 90 / 180 |
| `p_models` | text[] | nein | `null` | Modell-Filter (wie überall) |
| `p_markets` | text[] | nein | `null` | Markt-Filter, schränkt die Kohorten ein |

**Cache:** Die Analyse wird pro Team, Event, Fenster, Filter und aktueller URL-Liste gespeichert. Kleine/neue Teams 10 Minuten, sonst 75 Minuten, mit Vorberechnung im Hintergrund. Nach einer URL-Änderung ändert sich der Schlüssel, einfach neu laden.

#### Oberste Ebene
| Feld | Typ | null | Bedeutung |
|---|---|---|---|
| `event_id`, `event_date` | | nein | |
| `windows` | object | nein | Fenster und tatsächlich belegte Tage |
| `cohort` | object | nein | Größe der Kohorten und Vergleichbarkeit |
| `affected` | object | ja* | eigene Marke, betroffene Kohorte, vorher/nachher |
| `comparison` | object | **ja** | eigene Marke, Vergleichs-Kohorte. **`null`**, wenn keine Vergleichs-Kohorte existiert oder darin nichts vergleichbar ist |
| `comparison_delta` | object | **ja** | `affected.delta − comparison.delta`. `null`, wenn `comparison` `null` ist |
| `competitors[]` | array | nein | jeder Wettbewerber einzeln (Marktbewegung), sortiert nach Visibility nachher absteigend |
| `urls[]` | array | nein | eine Zeile pro Ziel-URL, `[]` ohne URLs |
| `trend[]` | array | nein | ein Eintrag pro Tag von `requested_before_from` bis `effective_after_to`, Event-Tag eingeschlossen |
| `overlaps[]` | array | nein | andere Events des Teams im Analysezeitraum |

\* nur `null`, wenn das Team keine eigene Marke hat.

#### `windows`
| Feld | Typ | null | Bedeutung |
|---|---|---|---|
| `window_days` | int | nein | |
| `requested_before_from` / `requested_before_to` | date | nein | `event − N` / `event − 1` |
| `requested_after_from` / `requested_after_to` | date | nein | `event + 1` / `event + N` |
| `effective_after_to` | date | nein | `min(event + N, heute)` |
| `after_complete` | bool | nein | `false`: Nachher-Seite läuft noch |
| `actual_first_before`, `actual_last_before`, `actual_first_after`, `actual_last_after` | date | ja | erster und letzter Tag mit Daten je Seite |
| `before_observed_days`, `after_observed_days` | int | nein | Tage mit Daten. Die Seiten dürfen ungleich lang sein, die Nachher-Daten werden nicht gekürzt |
| `limited_baseline` | bool | nein | vorher weniger als 7 Tage mit Daten → Hinweis „Begrenzte Vergleichsbasis“ |
| `sentiment_before_from`, `sentiment_after_from` | date | after: ja | Sentiment gilt wie überall für die letzten 30 Tage einer Seite, ab diesem Tag |

#### `cohort`
| Feld | Bedeutung |
|---|---|
| `affected_prompt_count` | eingefrorene betroffene Kohorte |
| `affected_in_filter_count` | davon im Markt-Filter |
| `comparable_prompt_count` | davon mit Daten vorher **und** nachher. Nur diese zählen für die KPI-Karten |
| `post_only_prompt_count` | nur Daten nach dem Event, nur im Trend |
| `no_data_prompt_count` | keine Daten in beiden Fenstern |
| `deleted_prompt_count` | inzwischen gelöschte Prompts |
| `comparable_models` | text[]: Modelle mit Daten auf beiden Seiten |
| `comparison_prompt_count`, `comparison_comparable_prompt_count`, `comparison_comparable_models` | dasselbe für die Vergleichs-Kohorte |

#### Kennzahlen-Block (`affected`, `comparison`, jedes `competitors[]`-Element)
| Feld | Typ | null | Bedeutung |
|---|---|---|---|
| `visibility.before/after/delta` | number | ja | Prozent der Runs mit Erwähnung, Delta in pp |
| `rank.before/after/delta` | number | ja | Ø-Position, kleiner = besser, Delta roh |
| `sentiment.before/after/delta` | number | ja | 0–100 |
| `mention_runs.before/after`, `total_runs.before/after` | int | ja | Kontext, nicht als Haupt-KPI zeigen (die Seiten können verschieden lang sein) |
| `company_id`, `name`, `logo_url` | | logo: ja | **nur** bei `affected` und `competitors` |

Ein Wettbewerber, der erst nach dem Event getrackt wird, hat `before = null` und `total_runs.before = 0`. In der UI dann „neu getrackt“ statt Delta.

#### `urls[]`
| Feld | Typ | null | Bedeutung |
|---|---|---|---|
| `id` | uuid | nein | Event-URL-ID |
| `url`, `url_input`, `team_kannte_url` | | nein | wie in 3.2 |
| `global_share.before/after/delta` | number | ja | Global Share wie im Rest von Upstreem, pro URL. **Nie summieren.** `0` = nicht zitiert, `null` = keine vergleichbaren Daten |
| `runs_with_url.before/after` | int | ja | |
| `observation.status` | text | nein | `observed_on_event_day` · `first_observed_after_event` · `not_observed_since_event` · `not_observed_within_6_months` |
| `observation.first_observed_day` | date | ja | Tag der ersten Beobachtung ab dem Event-Tag |
| `observation.first_observed_at` | timestamptz | ja | Zeitpunkt dieses Runs |
| `observation.first_observed_prompt_run_id` | uuid | ja | **der konkrete Run** dieser Beobachtung. Damit `get_mention_detail_v7` öffnen |
| `observation.day_number` | int | ja | Tage nach dem Event (0 = Event-Tag) |
| `observation.observed_before_event` | bool | nein | in den 183 Tagen vorher schon zitiert (bestehende URL) |
| `observation.search_until` | date | nein | bis wann gesucht wurde (höchstens Event + 183 Tage) |

**Regeln der ersten Beobachtung:**
- **Wer zählt:** nur Runs der eingefrorenen betroffenen Kohorte des eigenen Teams, deren Response die URL zitiert. Zeitraum: Event-Tag bis höchstens 183 Tage danach.
- **Welcher Run:** der früheste nach `run_at`, bei Gleichstand nach Run-ID.
- **Zusammengehörig:** `first_observed_day`, `first_observed_at` und `first_observed_prompt_run_id` beschreiben immer **denselben** Run.
- **Klickbar:** Die Zeile ist genau dann klickbar, wenn `first_observed_prompt_run_id` nicht `null` ist. Bei `observed_on_event_day` und `first_observed_after_event` ist das immer der Fall.
- **Unabhängig vom Fenster:** Das gewählte Analyse-Fenster ändert daran nichts. Am 17.02. beobachtet heißt „Tag 47“, auch in der 30-Tage-Ansicht.
- **Gleiche Prüfung wie die Responses:** Derselbe URL-Abgleich steckt in den Event-Responses (3.10). Der Run der ersten Beobachtung erscheint dort, sobald sein Tag im Datumsfenster der Responses-Tabelle liegt und die übrigen Filter ihn zulassen.
- **Formulierung:** nie „erstes Zitat überhaupt“, sondern „erstmals beobachtet nach dem Event“.

#### `trend[]`
| Feld | Typ | null | Bedeutung |
|---|---|---|---|
| `day` | date | nein | |
| `is_event_day` | bool | nein | genau ein Tag. Dort den senkrechten Event-Marker setzen |
| `affected_visibility` | number | ja | Tages-Visibility der eigenen Marke in der betroffenen Kohorte (inkl. Prompts nur mit Nachher-Daten) |
| `affected_rank` | number | ja | Tages-Ø-Rank |
| `affected_sentiment` | number | ja | Tages-Ø-Sentiment |
| `affected_runs` | int | nein | Runs an dem Tag, 0 = keine Daten |
| `comparison_visibility`, `comparison_rank`, `comparison_sentiment` | number | ja | dasselbe für die Vergleichs-Kohorte |
| `comparison_runs` | int | **ja** | **`null` = es gibt keine Vergleichs-Kohorte**, 0 = keine Daten an dem Tag |

Die Tagesformeln sind dieselben wie in `get_company_detailed_chart_v4` (Tag), so ist es auch getestet.
**Fehlende Daten sind `null`, nie `0`:**
- Tage ohne Runs haben `affected_visibility = null`. Der Firmen-Chart zeigt dort `0`.
- Tage ohne Rank- oder Sentiment-Werte haben `null`.
- Ohne Vergleichs-Kohorte sind alle `comparison_*` `null`.

Für die Kennzahl-Umschaltung im Diagramm einfach die Felder wechseln: Visibility nutzt `*_visibility`, Rank `*_rank`, Sentiment `*_sentiment`. Beim Rank die Y-Achse umdrehen.

#### `overlaps[]`
| Feld | Bedeutung |
|---|---|
| `event_id`, `event_date`, `name`, `icon`, `color`, `event_type` | anderes Event mit Datum im Analysezeitraum (`requested_before_from` … `effective_after_to`) |
| `shared_affected_prompt_count` | gemeinsame betroffene Prompts (0 = anderes Thema) |

**Beispiel A** (Topics-Event mit Vergleich, Wettbewerbern, URLs aller Status, Überschneidung). Der `trend` ist hier auf 6 Tage gekürzt, die vollständigen 61 Tage stehen in Anhang A.1:
```json
{
  "event_id": "5e1d0c3b-aaaa-4f6e-9a7b-0000000000a1",
  "event_date": "2026-09-01",
  "windows": {
    "window_days": 30,
    "event_date": "2026-09-01",
    "requested_before_from": "2026-08-02",
    "requested_before_to": "2026-08-31",
    "requested_after_from": "2026-09-02",
    "requested_after_to": "2026-10-01",
    "effective_after_to": "2026-10-01",
    "after_complete": true,
    "actual_first_before": "2026-08-02",
    "actual_last_before": "2026-08-31",
    "actual_first_after": "2026-09-02",
    "actual_last_after": "2026-10-01",
    "before_observed_days": 30,
    "after_observed_days": 30,
    "limited_baseline": false,
    "sentiment_before_from": "2026-08-02",
    "sentiment_after_from": "2026-09-02"
  },
  "cohort": {
    "affected_prompt_count": 24,
    "affected_in_filter_count": 24,
    "comparable_prompt_count": 21,
    "post_only_prompt_count": 2,
    "no_data_prompt_count": 1,
    "deleted_prompt_count": 0,
    "comparable_models": [
      "chatgpt",
      "gemini",
      "google_ai_overview"
    ],
    "comparison_prompt_count": 38,
    "comparison_comparable_prompt_count": 36,
    "comparison_comparable_models": [
      "chatgpt",
      "gemini",
      "google_ai_overview"
    ]
  },
  "affected": {
    "visibility": {
      "before": 32.14,
      "after": 39.87,
      "delta": 7.73
    },
    "rank": {
      "before": 4.21,
      "after": 3.34,
      "delta": -0.87
    },
    "sentiment": {
      "before": 72.4,
      "after": 76.15,
      "delta": 3.75
    },
    "mention_runs": {
      "before": 567,
      "after": 702
    },
    "total_runs": {
      "before": 1764,
      "after": 1761
    },
    "company_id": "a1c3e5f7-1111-4a2b-8c9d-000000000001",
    "name": "SonnenKraft",
    "logo_url": "https://www.google.com/s2/favicons?domain=sonnenkraft.de&sz=64"
  },
  "comparison": {
    "visibility": {
      "before": 35.02,
      "after": 37.11,
      "delta": 2.09
    },
    "rank": {
      "before": 3.88,
      "after": 3.79,
      "delta": -0.09
    },
    "sentiment": {
      "before": 70.1,
      "after": 70.62,
      "delta": 0.52
    },
    "mention_runs": {
      "before": 1060,
      "after": 1121
    },
    "total_runs": {
      "before": 3027,
      "after": 3021
    }
  },
  "comparison_delta": {
    "visibility": 5.64,
    "rank": -0.78,
    "sentiment": 3.23
  },
  "competitors": [
    {
      "visibility": {
        "before": 41.5,
        "after": 43.92,
        "delta": 2.42
      },
      "rank": {
        "before": 2.71,
        "after": 2.65,
        "delta": -0.06
      },
      "sentiment": {
        "before": 68.3,
        "after": 69.0,
        "delta": 0.7
      },
      "mention_runs": {
        "before": 732,
        "after": 773
      },
      "total_runs": {
        "before": 1764,
        "after": 1761
      },
      "company_id": "b2d4f6a8-2222-4b3c-9d0e-000000000002",
      "name": "HelioTech",
      "logo_url": "https://www.google.com/s2/favicons?domain=heliotech.de&sz=64"
    },
    {
      "visibility": {
        "before": 28.06,
        "after": 26.3,
        "delta": -1.76
      },
      "rank": {
        "before": 3.95,
        "after": 4.12,
        "delta": 0.17
      },
      "sentiment": {
        "before": 74.9,
        "after": 73.4,
        "delta": -1.5
      },
      "mention_runs": {
        "before": 495,
        "after": 463
      },
      "total_runs": {
        "before": 1764,
        "after": 1761
      },
      "company_id": "c3e5a7b9-3333-4c4d-8e1f-000000000003",
      "name": "SolarPlus",
      "logo_url": "https://www.google.com/s2/favicons?domain=solarplus.de&sz=64"
    },
    {
      "visibility": {
        "before": null,
        "after": 12.4,
        "delta": null
      },
      "rank": {
        "before": null,
        "after": 5.6,
        "delta": null
      },
      "sentiment": {
        "before": null,
        "after": 66.0,
        "delta": null
      },
      "mention_runs": {
        "before": 0,
        "after": 218
      },
      "total_runs": {
        "before": 0,
        "after": 1761
      },
      "company_id": "d4f6b8ca-4444-4d5e-9f20-000000000004",
      "name": "Voltaro",
      "logo_url": null
    }
  ],
  "urls": [
    {
      "id": "9c8b7a6d-0001-4e5f-8a9b-000000000001",
      "url": "https://www.sonnenkraft.de/preise",
      "url_input": "https://www.sonnenkraft.de/preise/?utm_source=newsletter",
      "team_kannte_url": true,
      "global_share": {
        "before": 3.12,
        "after": 8.74,
        "delta": 5.62
      },
      "runs_with_url": {
        "before": 43,
        "after": 121
      },
      "observation": {
        "status": "first_observed_after_event",
        "first_observed_day": "2026-09-02",
        "first_observed_at": "2026-09-02T06:41:12.338+00:00",
        "first_observed_prompt_run_id": "f0e1d2c3-0101-4b5a-9c8d-000000000101",
        "day_number": 1,
        "observed_before_event": true,
        "search_until": "2026-10-02"
      }
    },
    {
      "id": "9c8b7a6d-0002-4e5f-8a9b-000000000002",
      "url": "https://www.sonnenkraft.de/ratgeber/photovoltaik-kosten",
      "url_input": "sonnenkraft.de/ratgeber/photovoltaik-kosten",
      "team_kannte_url": false,
      "global_share": {
        "before": 0.0,
        "after": 4.33,
        "delta": 4.33
      },
      "runs_with_url": {
        "before": 0,
        "after": 60
      },
      "observation": {
        "status": "first_observed_after_event",
        "first_observed_day": "2026-09-11",
        "first_observed_at": "2026-09-11T08:14:03.912+00:00",
        "first_observed_prompt_run_id": "f0e1d2c3-0102-4b5a-9c8d-000000000102",
        "day_number": 10,
        "observed_before_event": false,
        "search_until": "2026-10-02"
      }
    },
    {
      "id": "9c8b7a6d-0003-4e5f-8a9b-000000000003",
      "url": "https://de.wikipedia.org/wiki/Photovoltaikanlage",
      "url_input": "https://de.wikipedia.org/wiki/Photovoltaikanlage",
      "team_kannte_url": true,
      "global_share": {
        "before": 11.85,
        "after": 12.03,
        "delta": 0.18
      },
      "runs_with_url": {
        "before": 164,
        "after": 167
      },
      "observation": {
        "status": "observed_on_event_day",
        "first_observed_day": "2026-09-01",
        "first_observed_at": "2026-09-01T05:58:47.120+00:00",
        "first_observed_prompt_run_id": "f0e1d2c3-0103-4b5a-9c8d-000000000103",
        "day_number": 0,
        "observed_before_event": true,
        "search_until": "2026-10-02"
      }
    },
    {
      "id": "9c8b7a6d-0004-4e5f-8a9b-000000000004",
      "url": "https://www.energie-magazin.de/test/solaranbieter-2026",
      "url_input": "https://www.energie-magazin.de/test/solaranbieter-2026#fazit",
      "team_kannte_url": false,
      "global_share": {
        "before": 0.0,
        "after": 0.0,
        "delta": 0.0
      },
      "runs_with_url": {
        "before": 0,
        "after": 0
      },
      "observation": {
        "status": "not_observed_since_event",
        "first_observed_day": null,
        "first_observed_at": null,
        "first_observed_prompt_run_id": null,
        "day_number": null,
        "observed_before_event": false,
        "search_until": "2026-10-02"
      }
    },
    {
      "id": "9c8b7a6d-0005-4e5f-8a9b-000000000005",
      "url": "https://www.sonnenkraft.de/stromspeicher",
      "url_input": "https://www.sonnenkraft.de/stromspeicher",
      "team_kannte_url": true,
      "global_share": {
        "before": 1.94,
        "after": 1.88,
        "delta": -0.06
      },
      "runs_with_url": {
        "before": 27,
        "after": 26
      },
      "observation": {
        "status": "first_observed_after_event",
        "first_observed_day": "2026-09-04",
        "first_observed_at": "2026-09-04T07:02:55.006+00:00",
        "first_observed_prompt_run_id": "f0e1d2c3-0104-4b5a-9c8d-000000000104",
        "day_number": 3,
        "observed_before_event": true,
        "search_until": "2026-10-02"
      }
    }
  ],
  "trend": [
    {
      "day": "2026-08-02",
      "is_event_day": false,
      "affected_visibility": 33.15,
      "affected_rank": 4.18,
      "affected_sentiment": 71.88,
      "affected_runs": 56,
      "comparison_visibility": 36.41,
      "comparison_rank": 3.87,
      "comparison_sentiment": 71.03,
      "comparison_runs": 100
    },
    {
      "day": "2026-08-31",
      "is_event_day": false,
      "affected_visibility": 33.51,
      "affected_rank": 4.24,
      "affected_sentiment": 73.02,
      "affected_runs": 56,
      "comparison_visibility": 35.19,
      "comparison_rank": 3.98,
      "comparison_sentiment": 69.87,
      "comparison_runs": 101
    },
    {
      "day": "2026-09-01",
      "is_event_day": true,
      "affected_visibility": 33.08,
      "affected_rank": 4.21,
      "affected_sentiment": 72.91,
      "affected_runs": 59,
      "comparison_visibility": 35.24,
      "comparison_rank": 3.81,
      "comparison_sentiment": 70.85,
      "comparison_runs": 97
    },
    {
      "day": "2026-09-02",
      "is_event_day": false,
      "affected_visibility": 33.11,
      "affected_rank": 4.15,
      "affected_sentiment": 71.66,
      "affected_runs": 60,
      "comparison_visibility": 35.94,
      "comparison_rank": 3.84,
      "comparison_sentiment": 70.62,
      "comparison_runs": 101
    },
    {
      "day": "2026-09-15",
      "is_event_day": false,
      "affected_visibility": 39.12,
      "affected_rank": 3.43,
      "affected_sentiment": 76.29,
      "affected_runs": 55,
      "comparison_visibility": 36.16,
      "comparison_rank": 3.71,
      "comparison_sentiment": 71.51,
      "comparison_runs": 103
    },
    {
      "day": "2026-10-01",
      "is_event_day": false,
      "affected_visibility": 41.21,
      "affected_rank": 3.38,
      "affected_sentiment": 77.24,
      "affected_runs": 60,
      "comparison_visibility": 38.06,
      "comparison_rank": 3.73,
      "comparison_sentiment": 70.04,
      "comparison_runs": 98
    }
  ],
  "overlaps": [
    {
      "event_id": "8b4a3f6e-dddd-4c91-8dae-0000000000d4",
      "event_date": "2026-09-08",
      "name": "PR-Kampagne Herbst",
      "icon": "📰",
      "color": "#f59e0b",
      "event_type": "pr_campaign",
      "shared_affected_prompt_count": 11
    }
  ]
}
```

**Beispiel B** (alle aktiven Prompts: ohne Vergleich, ohne URLs, kurze Vorher-Basis). Gezeigt sind nur die Felder, die von A abweichen:
```json
{
  "windows": {
    "window_days": 90,
    "event_date": "2026-03-25",
    "requested_before_from": "2025-12-25",
    "requested_before_to": "2026-03-24",
    "requested_after_from": "2026-03-26",
    "requested_after_to": "2026-06-23",
    "effective_after_to": "2026-06-23",
    "after_complete": true,
    "actual_first_before": "2026-03-19",
    "actual_last_before": "2026-03-24",
    "actual_first_after": "2026-03-26",
    "actual_last_after": "2026-06-23",
    "before_observed_days": 6,
    "after_observed_days": 90,
    "limited_baseline": true,
    "sentiment_before_from": "2026-02-23",
    "sentiment_after_from": "2026-05-25"
  },
  "cohort": {
    "affected_prompt_count": 61,
    "affected_in_filter_count": 61,
    "comparable_prompt_count": 44,
    "post_only_prompt_count": 15,
    "no_data_prompt_count": 0,
    "deleted_prompt_count": 2,
    "comparable_models": [
      "chatgpt",
      "google_ai_overview"
    ],
    "comparison_prompt_count": 0,
    "comparison_comparable_prompt_count": 0,
    "comparison_comparable_models": []
  },
  "comparison": null,
  "comparison_delta": null,
  "urls": [],
  "overlaps": [],
  "trend (Ausschnitt)": [
    {
      "day": "2026-03-18",
      "is_event_day": false,
      "affected_visibility": null,
      "affected_rank": null,
      "affected_sentiment": null,
      "affected_runs": 0,
      "comparison_visibility": null,
      "comparison_rank": null,
      "comparison_sentiment": null,
      "comparison_runs": null
    },
    {
      "day": "2026-03-19",
      "is_event_day": false,
      "affected_visibility": 16.16,
      "affected_rank": 5.08,
      "affected_sentiment": 68.99,
      "affected_runs": 94,
      "comparison_visibility": null,
      "comparison_rank": null,
      "comparison_sentiment": null,
      "comparison_runs": null
    },
    {
      "day": "2026-03-25",
      "is_event_day": true,
      "affected_visibility": 18.86,
      "affected_rank": 5.04,
      "affected_sentiment": 69.33,
      "affected_runs": 97,
      "comparison_visibility": null,
      "comparison_rank": null,
      "comparison_sentiment": null,
      "comparison_runs": null
    },
    {
      "day": "2026-06-23",
      "is_event_day": false,
      "affected_visibility": 26.83,
      "affected_rank": 4.4,
      "affected_sentiment": 71.51,
      "affected_runs": 98,
      "comparison_visibility": null,
      "comparison_rank": null,
      "comparison_sentiment": null,
      "comparison_runs": null
    }
  ]
}
```

**URL-Status „In 6 Monaten nicht beobachtet“** (älteres Event):
```json
{
  "id": "9c8b7a6d-0021-4e5f-8a9b-000000000021",
  "url": "https://www.solar-verzeichnis.de/anbieter/sonnenkraft",
  "url_input": "https://www.solar-verzeichnis.de/anbieter/sonnenkraft",
  "team_kannte_url": false,
  "global_share": {
    "before": 0.0,
    "after": 0.0,
    "delta": 0.0
  },
  "runs_with_url": {
    "before": 0,
    "after": 0
  },
  "observation": {
    "status": "not_observed_within_6_months",
    "first_observed_day": null,
    "first_observed_at": null,
    "first_observed_prompt_run_id": null,
    "day_number": null,
    "observed_before_event": false,
    "search_until": "2026-09-24"
  }
}
```

**Event von gestern** (Nachher-Seite noch leer). Abweichende Felder:
```json
{
  "windows": {
    "window_days": 30,
    "event_date": "2026-10-01",
    "requested_before_from": "2026-09-01",
    "requested_before_to": "2026-09-30",
    "requested_after_from": "2026-10-02",
    "requested_after_to": "2026-10-31",
    "effective_after_to": "2026-10-02",
    "after_complete": false,
    "actual_first_before": "2026-09-01",
    "actual_last_before": "2026-09-30",
    "actual_first_after": null,
    "actual_last_after": null,
    "before_observed_days": 30,
    "after_observed_days": 0,
    "limited_baseline": false,
    "sentiment_before_from": "2026-09-01",
    "sentiment_after_from": "2026-10-02"
  },
  "cohort": {
    "comparable_prompt_count": 0,
    "comparable_models": [],
    "comparison_comparable_prompt_count": 0
  },
  "affected": {
    "company_id": "a1c3e5f7-1111-4a2b-8c9d-000000000001",
    "name": "SonnenKraft",
    "logo_url": "https://www.google.com/s2/favicons?domain=sonnenkraft.de&sz=64",
    "visibility": {
      "before": null,
      "after": null,
      "delta": null
    },
    "rank": {
      "before": null,
      "after": null,
      "delta": null
    },
    "sentiment": {
      "before": null,
      "after": null,
      "delta": null
    },
    "mention_runs": {
      "before": null,
      "after": null
    },
    "total_runs": {
      "before": null,
      "after": null
    }
  },
  "comparison": null,
  "comparison_delta": null
}
```

### 3.10 `app.cached_mentions_overview_v1` – Responses-Tabelle (normal und Event-Modus)

**Das ist die normale, bestehende Responses-Liste. Es gibt keine eigene Event-Responses-RPC.**
Der Wrapper behält Namen und Verhalten, intern läuft jetzt `get_mentions_overview_v21`. Neu sind nur die zwei optionalen Parameter am Ende.

| Parameter | Typ | Default | Bedeutung |
|---|---|---|---|
| `p_team` | uuid | – | Pflicht |
| `p_tag_ids` | uuid[] | `null` | Topics |
| `p_tagmode` | text | `"or"` | `"or"` / `"and"` |
| `p_markets` | text[] | `null` | |
| `p_models` | text[] | `null` | |
| `p_limit` | int | `15` | 1–50 |
| `p_offset` | int | `0` | |
| `p_order` | text | `"run_at_desc"` | `run_at_desc`, `run_at_asc`, `rank_asc`, `rank_desc`, `sentiment_asc`, `sentiment_desc` |
| `p_mentioned` | text | `"all"` | `"yes"` / `"no"` / `"all"` |
| `p_prompt_id` | uuid | `null` | einzelner Prompt |
| `p_date_from` / `p_date_to` | date | heute − 29 / heute | **gilt auch im Event-Modus.** Für die Event-Ansicht das gewählte Analyse-Fenster übergeben |
| `p_domain` | text | `null` | nur Responses, die diese Domain zitieren |
| `p_url` | text | `null` | nur Responses, die diese URL zitieren |
| `p_company`, `p_company_ids` | uuid / uuid[] | `null` | Marken-Filter. `p_company` bestimmt auch, wessen Rank und Sentiment in der Zeile steht |
| `p_sentiment_min/max`, `p_rank_min/max` | smallint / int | `null` | |
| `p_brand_name_raw_search`, `p_search` | text | `null` | |
| **`p_event_id`** | uuid | `null` | **Event-Modus** |
| **`p_event_url_id`** | uuid | `null` | **nur mit `p_event_id`:** auf genau eine Event-URL (`urls[].id`) einschränken |

**Normaler Modus** (`p_event_id = null`): Ergebnis, Sortierung, Paging und `total_count` sind exakt wie bisher. Auf echten Daten ist das gegen die alte Fassung geprüft, die Zeilen haben **kein** Feld `matched_event_url_ids`.

**Event-Modus** (`p_event_id` gesetzt): Alle normalen Filter gelten weiter (UND). Zusätzlich gilt:
1. Das Event muss zum Team gehören, sonst `impact_event_not_found`.
2. Nur Runs der **eingefrorenen betroffenen Prompts** des Events.
3. Nur Responses, die **mindestens eine Event-URL zitieren**, mit `p_event_url_id` genau diese URL. Geprüft wird über die Citation-Daten des eigenen Teams (`staged_citation_urls`) und dieselbe normalisierte URL wie bei der ersten Beobachtung.
4. Jede Response kommt **genau einmal**, auch wenn sie mehrere Event-URLs zitiert.
5. Kombination mit `p_url`/`p_domain`: beides muss zutreffen (Schnittmenge).

**Fehler im Event-Modus:**
- `impact_event_not_found`: Event unbekannt oder gehört zu einem anderen Team.
- `impact_event_url_not_found`: `p_event_url_id` gehört nicht zum Event, oder `p_event_url_id` ohne `p_event_id`.

**Antwort:** JSON-Array der Zeilen einer Seite. Sortierung: `p_order`, danach `run_at desc` und Run-ID (stabil beim Blättern).

| Feld | Typ | null | Bedeutung |
|---|---|---|---|
| `prompt_run_id` | uuid | nein | **damit das Response-Detail öffnen:** `app.get_mention_detail_v7(p_prompt_run_id, p_team)` |
| `run_at` | timestamptz | nein | |
| `model` | text | nein | |
| `prompt_id`, `prompt_text` | | nein | |
| `user_rank` | int | ja | Rank der eigenen Marke (bzw. von `p_company`), `null` = nicht erwähnt |
| `user_sentiment` | int | ja | |
| `has_user_brand` | text | nein | `"yes"` / `"no"` |
| `companies_preview_totalcount` | int | nein | erwähnte getrackte Marken gesamt |
| `companies_preview[]` | array | nein | bis zu 4: `company_id`, `name`, `favicon_url`, `rank`, `brand_name_raw` |
| `sources_totalcount` | int | nein | zitierte URLs gesamt |
| `sources_preview[]` | array | nein | bis zu 5: `url`, `domain`, `title`, `favicon`, `pos` |
| `total_count` | int | nein | Anzahl **aller** Treffer vor limit/offset, in jeder Zeile gleich. Im Event-Modus = Responses, die alle Filter **und** die Event-Bedingungen erfüllen |
| `response_preview` | text | nein | erste 100 Zeichen der Antwort |
| `matched_event_url_ids` | uuid[] | – | **nur im Event-Modus vorhanden:** alle Event-URL-IDs (`urls[].id`), die diese Response zitiert. Auch mit `p_event_url_id` stehen hier alle getroffenen Event-URLs, nicht nur die gefilterte |

**Paging:** Für die nächste Seite `p_offset += p_limit`. Fertig ist es, wenn `p_offset + Zeilen ≥ total_count`. Bei 0 Treffern ist die Antwort `[]`, dann gibt es auch kein `total_count`.

Event-Modus, alle Event-URLs. Die erste Zeile zitiert zwei Event-URLs:
```json
[
  {
    "prompt_run_id": "f0e1d2c3-0201-4b5a-9c8d-000000000201",
    "run_at": "2026-09-30T07:12:44.120+00:00",
    "model": "chatgpt",
    "prompt_id": "0a1b2c3d-0011-4e5f-8a9b-000000000011",
    "prompt_text": "Was kostet eine Photovoltaikanlage für ein Einfamilienhaus?",
    "user_rank": 2,
    "user_sentiment": 81,
    "has_user_brand": "yes",
    "companies_preview_totalcount": 3,
    "companies_preview": [
      {
        "company_id": "b2d4f6a8-2222-4b3c-9d0e-000000000002",
        "name": "HelioTech",
        "favicon_url": "https://www.google.com/s2/favicons?domain=heliotech.de&sz=64",
        "rank": 1,
        "brand_name_raw": "HelioTech"
      },
      {
        "company_id": "a1c3e5f7-1111-4a2b-8c9d-000000000001",
        "name": "SonnenKraft",
        "favicon_url": "https://www.google.com/s2/favicons?domain=sonnenkraft.de&sz=64",
        "rank": 2,
        "brand_name_raw": "SonnenKraft"
      },
      {
        "company_id": "c3e5a7b9-3333-4c4d-8e1f-000000000003",
        "name": "SolarPlus",
        "favicon_url": "https://www.google.com/s2/favicons?domain=solarplus.de&sz=64",
        "rank": 3,
        "brand_name_raw": "Solar Plus"
      }
    ],
    "sources_totalcount": 5,
    "sources_preview": [
      {
        "url": "https://de.wikipedia.org/wiki/Photovoltaikanlage",
        "domain": "de.wikipedia.org",
        "title": "Photovoltaikanlage – Wikipedia",
        "favicon": "https://www.google.com/s2/favicons?domain=de.wikipedia.org&sz=64",
        "pos": 1
      },
      {
        "url": "https://www.sonnenkraft.de/preise",
        "domain": "[www.sonnenkraft.de](https://www.sonnenkraft.de)",
        "title": "Preise | SonnenKraft",
        "favicon": "https://www.google.com/s2/favicons?domain=www.sonnenkraft.de&sz=64",
        "pos": 2
      },
      {
        "url": "https://www.verbraucherzentrale.de/pv-kosten",
        "domain": "[www.verbraucherzentrale.de](https://www.verbraucherzentrale.de)",
        "title": "Was kostet eine PV-Anlage?",
        "favicon": "https://www.google.com/s2/favicons?domain=www.verbraucherzentrale.de&sz=64",
        "pos": 3
      }
    ],
    "total_count": 87,
    "response_preview": "Eine Photovoltaikanlage für ein Einfamilienhaus kostet 2026 je nach Größe zwischen 12.000 und 20.000 Euro. Anbieter wie He",
    "matched_event_url_ids": [
      "9c8b7a6d-0001-4e5f-8a9b-000000000001",
      "9c8b7a6d-0003-4e5f-8a9b-000000000003"
    ]
  },
  {
    "prompt_run_id": "f0e1d2c3-0202-4b5a-9c8d-000000000202",
    "run_at": "2026-09-29T09:41:02.517+00:00",
    "model": "gemini",
    "prompt_id": "0a1b2c3d-0012-4e5f-8a9b-000000000012",
    "prompt_text": "Welcher Solaranbieter ist 2026 am besten?",
    "user_rank": 4,
    "user_sentiment": 70,
    "has_user_brand": "yes",
    "companies_preview_totalcount": 5,
    "companies_preview": [
      {
        "company_id": "b2d4f6a8-2222-4b3c-9d0e-000000000002",
        "name": "HelioTech",
        "favicon_url": "https://www.google.com/s2/favicons?domain=heliotech.de&sz=64",
        "rank": 1,
        "brand_name_raw": "HelioTech"
      },
      {
        "company_id": "c3e5a7b9-3333-4c4d-8e1f-000000000003",
        "name": "SolarPlus",
        "favicon_url": "https://www.google.com/s2/favicons?domain=solarplus.de&sz=64",
        "rank": 2,
        "brand_name_raw": "SolarPlus"
      },
      {
        "company_id": "d4f6b8ca-4444-4d5e-9f20-000000000004",
        "name": "Voltaro",
        "favicon_url": "https://www.google.com/s2/favicons?domain=voltaro.de&sz=64",
        "rank": 3,
        "brand_name_raw": "Voltaro"
      },
      {
        "company_id": "a1c3e5f7-1111-4a2b-8c9d-000000000001",
        "name": "SonnenKraft",
        "favicon_url": "https://www.google.com/s2/favicons?domain=sonnenkraft.de&sz=64",
        "rank": 4,
        "brand_name_raw": "SonnenKraft"
      }
    ],
    "sources_totalcount": 4,
    "sources_preview": [
      {
        "url": "https://www.sonnenkraft.de/ratgeber/photovoltaik-kosten",
        "domain": "[www.sonnenkraft.de](https://www.sonnenkraft.de)",
        "title": "Photovoltaik Kosten 2026",
        "favicon": "https://www.google.com/s2/favicons?domain=www.sonnenkraft.de&sz=64",
        "pos": 1
      },
      {
        "url": "https://www.test-solar.de/vergleich",
        "domain": "[www.test-solar.de](https://www.test-solar.de)",
        "title": "Solaranbieter im Vergleich",
        "favicon": "https://www.google.com/s2/favicons?domain=www.test-solar.de&sz=64",
        "pos": 2
      }
    ],
    "total_count": 87,
    "response_preview": "Zu den bekanntesten Solaranbietern gehören HelioTech, SolarPlus und Voltaro. Für eine individuelle Beratung empfiehlt sich",
    "matched_event_url_ids": [
      "9c8b7a6d-0002-4e5f-8a9b-000000000002"
    ]
  },
  {
    "prompt_run_id": "f0e1d2c3-0203-4b5a-9c8d-000000000203",
    "run_at": "2026-09-29T06:03:18.004+00:00",
    "model": "google_ai_overview",
    "prompt_id": "0a1b2c3d-0013-4e5f-8a9b-000000000013",
    "prompt_text": "Lohnt sich ein Stromspeicher für PV?",
    "user_rank": null,
    "user_sentiment": null,
    "has_user_brand": "no",
    "companies_preview_totalcount": 2,
    "companies_preview": [
      {
        "company_id": "b2d4f6a8-2222-4b3c-9d0e-000000000002",
        "name": "HelioTech",
        "favicon_url": "https://www.google.com/s2/favicons?domain=heliotech.de&sz=64",
        "rank": 1,
        "brand_name_raw": "HelioTech"
      },
      {
        "company_id": "c3e5a7b9-3333-4c4d-8e1f-000000000003",
        "name": "SolarPlus",
        "favicon_url": "https://www.google.com/s2/favicons?domain=solarplus.de&sz=64",
        "rank": 2,
        "brand_name_raw": "SolarPlus"
      }
    ],
    "sources_totalcount": 3,
    "sources_preview": [
      {
        "url": "https://de.wikipedia.org/wiki/Photovoltaikanlage",
        "domain": "de.wikipedia.org",
        "title": "Photovoltaikanlage – Wikipedia",
        "favicon": "https://www.google.com/s2/favicons?domain=de.wikipedia.org&sz=64",
        "pos": 1
      }
    ],
    "total_count": 87,
    "response_preview": "Ein Stromspeicher lohnt sich vor allem, wenn der Eigenverbrauch erhöht werden soll. Typische Speichergrößen liegen bei 5",
    "matched_event_url_ids": [
      "9c8b7a6d-0003-4e5f-8a9b-000000000003"
    ]
  }
]
```
Request dazu:
```json
{
  "p_team": "877c649c-f5f2-44e9-bb04-155f5bf44e70",
  "p_date_from": "2026-09-02",
  "p_date_to": "2026-10-01",
  "p_limit": 15,
  "p_offset": 0,
  "p_event_id": "5e1d0c3b-aaaa-4f6e-9a7b-0000000000a1"
}
```
Nur eine Event-URL (`p_event_url_id` = Wikipedia-URL), `total_count` 31:
```json
[
  {
    "prompt_run_id": "f0e1d2c3-0201-4b5a-9c8d-000000000201",
    "run_at": "2026-09-30T07:12:44.120+00:00",
    "model": "chatgpt",
    "prompt_id": "0a1b2c3d-0011-4e5f-8a9b-000000000011",
    "prompt_text": "Was kostet eine Photovoltaikanlage für ein Einfamilienhaus?",
    "user_rank": 2,
    "user_sentiment": 81,
    "has_user_brand": "yes",
    "companies_preview_totalcount": 3,
    "companies_preview": [
      {
        "company_id": "b2d4f6a8-2222-4b3c-9d0e-000000000002",
        "name": "HelioTech",
        "favicon_url": "https://www.google.com/s2/favicons?domain=heliotech.de&sz=64",
        "rank": 1,
        "brand_name_raw": "HelioTech"
      },
      {
        "company_id": "a1c3e5f7-1111-4a2b-8c9d-000000000001",
        "name": "SonnenKraft",
        "favicon_url": "https://www.google.com/s2/favicons?domain=sonnenkraft.de&sz=64",
        "rank": 2,
        "brand_name_raw": "SonnenKraft"
      },
      {
        "company_id": "c3e5a7b9-3333-4c4d-8e1f-000000000003",
        "name": "SolarPlus",
        "favicon_url": "https://www.google.com/s2/favicons?domain=solarplus.de&sz=64",
        "rank": 3,
        "brand_name_raw": "Solar Plus"
      }
    ],
    "sources_totalcount": 5,
    "sources_preview": [
      {
        "url": "https://de.wikipedia.org/wiki/Photovoltaikanlage",
        "domain": "de.wikipedia.org",
        "title": "Photovoltaikanlage – Wikipedia",
        "favicon": "https://www.google.com/s2/favicons?domain=de.wikipedia.org&sz=64",
        "pos": 1
      },
      {
        "url": "https://www.sonnenkraft.de/preise",
        "domain": "[www.sonnenkraft.de](https://www.sonnenkraft.de)",
        "title": "Preise | SonnenKraft",
        "favicon": "https://www.google.com/s2/favicons?domain=www.sonnenkraft.de&sz=64",
        "pos": 2
      },
      {
        "url": "https://www.verbraucherzentrale.de/pv-kosten",
        "domain": "[www.verbraucherzentrale.de](https://www.verbraucherzentrale.de)",
        "title": "Was kostet eine PV-Anlage?",
        "favicon": "https://www.google.com/s2/favicons?domain=www.verbraucherzentrale.de&sz=64",
        "pos": 3
      }
    ],
    "total_count": 31,
    "response_preview": "Eine Photovoltaikanlage für ein Einfamilienhaus kostet 2026 je nach Größe zwischen 12.000 und 20.000 Euro. Anbieter wie He",
    "matched_event_url_ids": [
      "9c8b7a6d-0001-4e5f-8a9b-000000000001",
      "9c8b7a6d-0003-4e5f-8a9b-000000000003"
    ]
  },
  {
    "prompt_run_id": "f0e1d2c3-0203-4b5a-9c8d-000000000203",
    "run_at": "2026-09-29T06:03:18.004+00:00",
    "model": "google_ai_overview",
    "prompt_id": "0a1b2c3d-0013-4e5f-8a9b-000000000013",
    "prompt_text": "Lohnt sich ein Stromspeicher für PV?",
    "user_rank": null,
    "user_sentiment": null,
    "has_user_brand": "no",
    "companies_preview_totalcount": 2,
    "companies_preview": [
      {
        "company_id": "b2d4f6a8-2222-4b3c-9d0e-000000000002",
        "name": "HelioTech",
        "favicon_url": "https://www.google.com/s2/favicons?domain=heliotech.de&sz=64",
        "rank": 1,
        "brand_name_raw": "HelioTech"
      },
      {
        "company_id": "c3e5a7b9-3333-4c4d-8e1f-000000000003",
        "name": "SolarPlus",
        "favicon_url": "https://www.google.com/s2/favicons?domain=solarplus.de&sz=64",
        "rank": 2,
        "brand_name_raw": "SolarPlus"
      }
    ],
    "sources_totalcount": 3,
    "sources_preview": [
      {
        "url": "https://de.wikipedia.org/wiki/Photovoltaikanlage",
        "domain": "de.wikipedia.org",
        "title": "Photovoltaikanlage – Wikipedia",
        "favicon": "https://www.google.com/s2/favicons?domain=de.wikipedia.org&sz=64",
        "pos": 1
      }
    ],
    "total_count": 31,
    "response_preview": "Ein Stromspeicher lohnt sich vor allem, wenn der Eigenverbrauch erhöht werden soll. Typische Speichergrößen liegen bei 5",
    "matched_event_url_ids": [
      "9c8b7a6d-0003-4e5f-8a9b-000000000003"
    ]
  }
]
```
Normaler Modus (unverändert, ohne `matched_event_url_ids`):
```json
[
  {
    "prompt_run_id": "f0e1d2c3-0201-4b5a-9c8d-000000000201",
    "run_at": "2026-09-30T07:12:44.120+00:00",
    "model": "chatgpt",
    "prompt_id": "0a1b2c3d-0011-4e5f-8a9b-000000000011",
    "prompt_text": "Was kostet eine Photovoltaikanlage für ein Einfamilienhaus?",
    "user_rank": 2,
    "user_sentiment": 81,
    "has_user_brand": "yes",
    "companies_preview_totalcount": 3,
    "companies_preview": [
      {
        "company_id": "b2d4f6a8-2222-4b3c-9d0e-000000000002",
        "name": "HelioTech",
        "favicon_url": "https://www.google.com/s2/favicons?domain=heliotech.de&sz=64",
        "rank": 1,
        "brand_name_raw": "HelioTech"
      },
      {
        "company_id": "a1c3e5f7-1111-4a2b-8c9d-000000000001",
        "name": "SonnenKraft",
        "favicon_url": "https://www.google.com/s2/favicons?domain=sonnenkraft.de&sz=64",
        "rank": 2,
        "brand_name_raw": "SonnenKraft"
      },
      {
        "company_id": "c3e5a7b9-3333-4c4d-8e1f-000000000003",
        "name": "SolarPlus",
        "favicon_url": "https://www.google.com/s2/favicons?domain=solarplus.de&sz=64",
        "rank": 3,
        "brand_name_raw": "Solar Plus"
      }
    ],
    "sources_totalcount": 5,
    "sources_preview": [
      {
        "url": "https://de.wikipedia.org/wiki/Photovoltaikanlage",
        "domain": "de.wikipedia.org",
        "title": "Photovoltaikanlage – Wikipedia",
        "favicon": "https://www.google.com/s2/favicons?domain=de.wikipedia.org&sz=64",
        "pos": 1
      },
      {
        "url": "https://www.sonnenkraft.de/preise",
        "domain": "[www.sonnenkraft.de](https://www.sonnenkraft.de)",
        "title": "Preise | SonnenKraft",
        "favicon": "https://www.google.com/s2/favicons?domain=www.sonnenkraft.de&sz=64",
        "pos": 2
      },
      {
        "url": "https://www.verbraucherzentrale.de/pv-kosten",
        "domain": "[www.verbraucherzentrale.de](https://www.verbraucherzentrale.de)",
        "title": "Was kostet eine PV-Anlage?",
        "favicon": "https://www.google.com/s2/favicons?domain=www.verbraucherzentrale.de&sz=64",
        "pos": 3
      }
    ],
    "total_count": 1214,
    "response_preview": "Eine Photovoltaikanlage für ein Einfamilienhaus kostet 2026 je nach Größe zwischen 12.000 und 20.000 Euro. Anbieter wie He"
  },
  {
    "prompt_run_id": "f0e1d2c3-0202-4b5a-9c8d-000000000202",
    "run_at": "2026-09-29T09:41:02.517+00:00",
    "model": "gemini",
    "prompt_id": "0a1b2c3d-0012-4e5f-8a9b-000000000012",
    "prompt_text": "Welcher Solaranbieter ist 2026 am besten?",
    "user_rank": 4,
    "user_sentiment": 70,
    "has_user_brand": "yes",
    "companies_preview_totalcount": 5,
    "companies_preview": [
      {
        "company_id": "b2d4f6a8-2222-4b3c-9d0e-000000000002",
        "name": "HelioTech",
        "favicon_url": "https://www.google.com/s2/favicons?domain=heliotech.de&sz=64",
        "rank": 1,
        "brand_name_raw": "HelioTech"
      },
      {
        "company_id": "c3e5a7b9-3333-4c4d-8e1f-000000000003",
        "name": "SolarPlus",
        "favicon_url": "https://www.google.com/s2/favicons?domain=solarplus.de&sz=64",
        "rank": 2,
        "brand_name_raw": "SolarPlus"
      },
      {
        "company_id": "d4f6b8ca-4444-4d5e-9f20-000000000004",
        "name": "Voltaro",
        "favicon_url": "https://www.google.com/s2/favicons?domain=voltaro.de&sz=64",
        "rank": 3,
        "brand_name_raw": "Voltaro"
      },
      {
        "company_id": "a1c3e5f7-1111-4a2b-8c9d-000000000001",
        "name": "SonnenKraft",
        "favicon_url": "https://www.google.com/s2/favicons?domain=sonnenkraft.de&sz=64",
        "rank": 4,
        "brand_name_raw": "SonnenKraft"
      }
    ],
    "sources_totalcount": 4,
    "sources_preview": [
      {
        "url": "https://www.sonnenkraft.de/ratgeber/photovoltaik-kosten",
        "domain": "[www.sonnenkraft.de](https://www.sonnenkraft.de)",
        "title": "Photovoltaik Kosten 2026",
        "favicon": "https://www.google.com/s2/favicons?domain=www.sonnenkraft.de&sz=64",
        "pos": 1
      },
      {
        "url": "https://www.test-solar.de/vergleich",
        "domain": "[www.test-solar.de](https://www.test-solar.de)",
        "title": "Solaranbieter im Vergleich",
        "favicon": "https://www.google.com/s2/favicons?domain=www.test-solar.de&sz=64",
        "pos": 2
      }
    ],
    "total_count": 1214,
    "response_preview": "Zu den bekanntesten Solaranbietern gehören HelioTech, SolarPlus und Voltaro. Für eine individuelle Beratung empfiehlt sich"
  }
]
```

---

## 4. Fehler-Codes (`message`) → Error-Setter

| `message` | Kommt von | Bedeutung | UI-Text (Vorschlag) |
|---|---|---|---|
| `not authenticated` | alle | nicht angemeldet | „Bitte neu anmelden.“ |
| `forbidden` | alle; delete | kein Teammitglied bzw. darf nicht löschen | „Dafür fehlt dir die Berechtigung.“ |
| `team_access_<state>` (z. B. `team_access_ended`) | alle | Team ohne aktiven Zugang | bestehende Zugangs-Sperre zeigen |
| `impact_event_rate_limited` | alle Event-RPCs | zu viele Aufrufe pro Minute | „Kurz warten und erneut versuchen.“ |
| (Rate-Limit der Responses-Tabelle) | `cached_mentions_overview_v1` | unverändert wie bisher, kein Event-Code | wie bisher in der Responses-Tabelle |
| `impact_event_name_required` | create, update | Name fehlt | „Bitte einen Namen eingeben.“ |
| `impact_event_invalid_date` | create | Datum nicht zwischen heute − 6 Monaten und heute | „Das Datum muss in den letzten 6 Monaten liegen.“ |
| `impact_event_invalid_scope` | create, preview | `p_scope_mode` weder `topics` noch `all` | technischer Fehler |
| `impact_event_topics_required` | create | `topics` ohne Topic | „Bitte mindestens ein Topic wählen.“ |
| `impact_event_invalid_topics` | create | Topic gehört nicht zum Team | „Ein Topic ist nicht mehr verfügbar.“ |
| `impact_event_no_active_prompts` | create | gewählter Scope hat 0 aktive Prompts | „Die Auswahl enthält keine aktiven Prompts.“ |
| `impact_event_invalid_url` | create, add_url | keine gültige http(s)-URL | „Bitte eine gültige URL eingeben.“ |
| `impact_event_url_duplicate` | add_url | URL (normalisiert) schon im Event | „Diese URL ist bereits im Event.“ |
| `impact_event_too_many_urls` | create, add_url | mehr als 100 URLs | „Maximal 100 URLs pro Event.“ |
| `impact_event_not_found` | get, update, add/remove_url, delete, analysis, responses | Event unbekannt oder anderes Team | „Event nicht gefunden.“ |
| `impact_event_url_not_found` | remove_url, responses | Event-URL unbekannt oder gehört zu einem anderen Event | „URL nicht gefunden.“ |
| `invalid date range` | responses | `p_date_to < p_date_from` | technischer Fehler |
| alles andere | | unerwartet | „Etwas ist schiefgelaufen.“ |

---

## 5. UI-Zustände

| Zustand | erkennbar an | Anzeige |
|---|---|---|
| Event zu jung | `windows.after_complete = false` | „Läuft noch · Daten bis {effective_after_to}“ |
| Kaum Vorlauf | `windows.limited_baseline = true` | „Begrenzte Vergleichsbasis ({before_observed_days} Tage)“ |
| Nichts vergleichbar | `cohort.comparable_prompt_count = 0` | KPI-Karten „–“ und „Noch keine vergleichbaren Daten“, Trend trotzdem zeigen |
| Kein Vergleich | `comparison = null` | Vergleichs-Karte ausblenden (bei `scope_mode = "all"` normal) |
| Überschneidungen | `overlaps.length > 0` | „{n} weitere Events in diesem Zeitraum“, im Trend zusätzliche gestrichelte Marker |
| Prompts nur nachher | `cohort.post_only_prompt_count > 0` | „{n} Prompts erst nach dem Event – nur im Trend“ |
| Gelöschte Prompts | `cohort.deleted_prompt_count > 0` | „{n} Prompts inzwischen gelöscht“ |
| Wettbewerber neu getrackt | `visibility.before = null` und `total_runs.before = 0` | „neu getrackt“ |
| Gelöschtes Topic | `topics[].deleted = true` | Chip ausgegraut |
| Erste Beobachtung klickbar | `first_observed_prompt_run_id != null` | Klick → `get_mention_detail_v7` |
| Delete-Button | `can_delete` | nur bei `true` zeigen |

**URL-Status-Texte:**
- `observed_on_event_day` → „Am Event-Tag beobachtet“.
- `first_observed_after_event` → „Erstmals beobachtet nach Event · {first_observed_day} · Tag {day_number}“. Bei `observed_before_event = true` passt besser „Weiter zitiert seit Tag {day_number}“.
- `not_observed_since_event` → „Seit dem Event noch nicht beobachtet“.
- `not_observed_within_6_months` → „In 6 Monaten nach dem Event nicht beobachtet“.

**Formatierung:**
- Prozent mit 1 Nachkommastelle und „pp“ für Deltas.
- Beim Rank ist ein negatives Delta grün und heißt „besser“.
- `null` wird als „–“ angezeigt.
- Global Share mehrerer URLs nie addieren.

---

## 6. Statische Fixtures (zum direkten Übernehmen)

### 6.1 Abdeckung
| # | Fall | Wo |
|---|---|---|
| 1 | Übersicht mit mehreren Events | 3.1 |
| 2 | Event-Detail mit Vergleich | 3.9 Beispiel A |
| 3 | Event-Detail ohne Vergleich | 3.9 Beispiel B |
| 4 | Event ohne URLs | 3.2 (zweites Beispiel), 3.9 Beispiel B |
| 5 | URL nach dem Event beobachtet | 3.9 A, `urls[0]`, `urls[1]` |
| 6 | URL am Event-Tag beobachtet | 3.9 A, `urls[2]` |
| 7 | URL nicht beobachtet | 3.9 A, `urls[3]`, plus „In 6 Monaten nicht beobachtet“ |
| 8 | Trend mit Visibility/Rank/Sentiment | Anhang A.1 (61 Tage), ohne Vergleich: 3.9 B |
| 9 | Wettbewerber / Marktbewegung | 3.9 A, `competitors` |
| 10 | Response mit einer Event-URL | 3.10, Event-Modus, Zeilen 2 und 3 |
| 11 | Response mit mehreren Event-URLs | 3.10, Event-Modus, Zeile 1 |
| 12 | Scope-Vorschau | 3.3 |
| 13 | Diagramm-Marker | 3.1 (Felder `event_date`, `name`, `icon`, `color`, `event_type`) |
| 14 | Mutationen | Create/Update/Add/Remove → Objekt 3.2; Delete → `{"ok": true, "deleted_event_id": "…"}` |

### 6.2 Event-Typen (Vorschlag, `event_type` ist freier Text)
`website_relaunch` 🌐 Website-Relaunch · `new_website` 🆕 Neue Website · `blog_article` 📝 Neuer Blogartikel · `content_update` ✏️ Content-Update ·
`landing_page` 🧭 Landingpage · `product_launch` 🚀 Produktlaunch · `feature_launch` ✨ Feature-Launch · `pricing_change` 💶 Preisänderung ·
`pr_campaign` 📰 PR-Kampagne · `paid_editorial` 🗞️ Bezahlter Artikel · `wikipedia_new` 📚 Neue Wikipedia-Seite · `wikipedia_update` 📖 Wikipedia-Update ·
`directory_profile` ⭐ G2/Capterra/Verzeichnis · `event_page` 🎟️ Event-Seite · `brand_campaign` 📣 Markenkampagne · `offline_campaign` 🪧 Offline-Kampagne ·
`rebranding` 🎨 Rebranding · `partnership` 🤝 Partnerschaft · `other` 📌 Sonstiges.
Illustrationen ordnet das Frontend über `event_type` zu, das Backend liefert dafür keine URLs.

---

## Anhang A.1 – vollständiger Trend aus Beispiel A (61 Tage)
```json
[
  {
    "day": "2026-08-02",
    "is_event_day": false,
    "affected_visibility": 33.15,
    "affected_rank": 4.18,
    "affected_sentiment": 71.88,
    "affected_runs": 56,
    "comparison_visibility": 36.41,
    "comparison_rank": 3.87,
    "comparison_sentiment": 71.03,
    "comparison_runs": 100
  },
  {
    "day": "2026-08-03",
    "is_event_day": false,
    "affected_visibility": 33.08,
    "affected_rank": 4.12,
    "affected_sentiment": 71.21,
    "affected_runs": 56,
    "comparison_visibility": 36.19,
    "comparison_rank": 3.86,
    "comparison_sentiment": 69.39,
    "comparison_runs": 102
  },
  {
    "day": "2026-08-04",
    "is_event_day": false,
    "affected_visibility": 33.23,
    "affected_rank": 4.26,
    "affected_sentiment": 72.25,
    "affected_runs": 56,
    "comparison_visibility": 35.39,
    "comparison_rank": 3.77,
    "comparison_sentiment": 69.76,
    "comparison_runs": 103
  },
  {
    "day": "2026-08-05",
    "is_event_day": false,
    "affected_visibility": 32.08,
    "affected_rank": 4.24,
    "affected_sentiment": 73.45,
    "affected_runs": 58,
    "comparison_visibility": 34.3,
    "comparison_rank": 3.96,
    "comparison_sentiment": 69.35,
    "comparison_runs": 97
  },
  {
    "day": "2026-08-06",
    "is_event_day": false,
    "affected_visibility": 31.05,
    "affected_rank": 4.22,
    "affected_sentiment": 72.02,
    "affected_runs": 55,
    "comparison_visibility": 33.93,
    "comparison_rank": 3.92,
    "comparison_sentiment": 70.04,
    "comparison_runs": 104
  },
  {
    "day": "2026-08-07",
    "is_event_day": false,
    "affected_visibility": 30.13,
    "affected_rank": 4.11,
    "affected_sentiment": 72.82,
    "affected_runs": 56,
    "comparison_visibility": 33.75,
    "comparison_rank": 3.87,
    "comparison_sentiment": 70.75,
    "comparison_runs": 98
  },
  {
    "day": "2026-08-08",
    "is_event_day": false,
    "affected_visibility": 30.83,
    "affected_rank": 4.09,
    "affected_sentiment": 72.49,
    "affected_runs": 56,
    "comparison_visibility": 34.22,
    "comparison_rank": 3.87,
    "comparison_sentiment": 69.87,
    "comparison_runs": 101
  },
  {
    "day": "2026-08-09",
    "is_event_day": false,
    "affected_visibility": 31.51,
    "affected_rank": 4.06,
    "affected_sentiment": 71.42,
    "affected_runs": 58,
    "comparison_visibility": 34.07,
    "comparison_rank": 3.78,
    "comparison_sentiment": 70.3,
    "comparison_runs": 104
  },
  {
    "day": "2026-08-10",
    "is_event_day": false,
    "affected_visibility": 31.95,
    "affected_rank": 4.23,
    "affected_sentiment": 72.54,
    "affected_runs": 59,
    "comparison_visibility": 34.76,
    "comparison_rank": 3.8,
    "comparison_sentiment": 69.8,
    "comparison_runs": 98
  },
  {
    "day": "2026-08-11",
    "is_event_day": false,
    "affected_visibility": 32.78,
    "affected_rank": 4.23,
    "affected_sentiment": 71.94,
    "affected_runs": 57,
    "comparison_visibility": 35.11,
    "comparison_rank": 3.98,
    "comparison_sentiment": 69.45,
    "comparison_runs": 98
  },
  {
    "day": "2026-08-12",
    "is_event_day": false,
    "affected_visibility": 33.07,
    "affected_rank": 4.26,
    "affected_sentiment": 72.82,
    "affected_runs": 58,
    "comparison_visibility": 35.59,
    "comparison_rank": 4.0,
    "comparison_sentiment": 71.02,
    "comparison_runs": 100
  },
  {
    "day": "2026-08-13",
    "is_event_day": false,
    "affected_visibility": 32.22,
    "affected_rank": 4.15,
    "affected_sentiment": 72.41,
    "affected_runs": 59,
    "comparison_visibility": 36.21,
    "comparison_rank": 3.82,
    "comparison_sentiment": 70.22,
    "comparison_runs": 100
  },
  {
    "day": "2026-08-14",
    "is_event_day": false,
    "affected_visibility": 33.06,
    "affected_rank": 4.28,
    "affected_sentiment": 72.36,
    "affected_runs": 58,
    "comparison_visibility": 34.62,
    "comparison_rank": 3.82,
    "comparison_sentiment": 69.68,
    "comparison_runs": 101
  },
  {
    "day": "2026-08-15",
    "is_event_day": false,
    "affected_visibility": 31.32,
    "affected_rank": 4.17,
    "affected_sentiment": 73.29,
    "affected_runs": 58,
    "comparison_visibility": 35.48,
    "comparison_rank": 3.94,
    "comparison_sentiment": 70.06,
    "comparison_runs": 99
  },
  {
    "day": "2026-08-16",
    "is_event_day": false,
    "affected_visibility": 30.51,
    "affected_rank": 4.25,
    "affected_sentiment": 73.39,
    "affected_runs": 57,
    "comparison_visibility": 33.77,
    "comparison_rank": 3.81,
    "comparison_sentiment": 70.78,
    "comparison_runs": 104
  },
  {
    "day": "2026-08-17",
    "is_event_day": false,
    "affected_visibility": 31.59,
    "affected_rank": 4.23,
    "affected_sentiment": 72.22,
    "affected_runs": 56,
    "comparison_visibility": 34.01,
    "comparison_rank": 3.89,
    "comparison_sentiment": 69.65,
    "comparison_runs": 104
  },
  {
    "day": "2026-08-18",
    "is_event_day": false,
    "affected_visibility": 30.22,
    "affected_rank": 4.26,
    "affected_sentiment": 73.49,
    "affected_runs": 60,
    "comparison_visibility": 34.07,
    "comparison_rank": 3.84,
    "comparison_sentiment": 69.6,
    "comparison_runs": 97
  },
  {
    "day": "2026-08-19",
    "is_event_day": false,
    "affected_visibility": 31.53,
    "affected_rank": 4.25,
    "affected_sentiment": 73.0,
    "affected_runs": 59,
    "comparison_visibility": 34.23,
    "comparison_rank": 3.78,
    "comparison_sentiment": 69.29,
    "comparison_runs": 99
  },
  {
    "day": "2026-08-20",
    "is_event_day": false,
    "affected_visibility": 32.66,
    "affected_rank": 4.29,
    "affected_sentiment": 71.37,
    "affected_runs": 55,
    "comparison_visibility": 35.4,
    "comparison_rank": 3.79,
    "comparison_sentiment": 70.18,
    "comparison_runs": 98
  },
  {
    "day": "2026-08-21",
    "is_event_day": false,
    "affected_visibility": 32.84,
    "affected_rank": 4.32,
    "affected_sentiment": 72.69,
    "affected_runs": 57,
    "comparison_visibility": 35.11,
    "comparison_rank": 3.85,
    "comparison_sentiment": 70.52,
    "comparison_runs": 99
  },
  {
    "day": "2026-08-22",
    "is_event_day": false,
    "affected_visibility": 33.76,
    "affected_rank": 4.23,
    "affected_sentiment": 72.41,
    "affected_runs": 59,
    "comparison_visibility": 36.13,
    "comparison_rank": 3.76,
    "comparison_sentiment": 70.03,
    "comparison_runs": 97
  },
  {
    "day": "2026-08-23",
    "is_event_day": false,
    "affected_visibility": 32.93,
    "affected_rank": 4.22,
    "affected_sentiment": 73.25,
    "affected_runs": 55,
    "comparison_visibility": 35.26,
    "comparison_rank": 3.93,
    "comparison_sentiment": 69.73,
    "comparison_runs": 100
  },
  {
    "day": "2026-08-24",
    "is_event_day": false,
    "affected_visibility": 32.09,
    "affected_rank": 4.1,
    "affected_sentiment": 72.94,
    "affected_runs": 55,
    "comparison_visibility": 35.71,
    "comparison_rank": 3.95,
    "comparison_sentiment": 70.08,
    "comparison_runs": 101
  },
  {
    "day": "2026-08-25",
    "is_event_day": false,
    "affected_visibility": 31.09,
    "affected_rank": 4.23,
    "affected_sentiment": 72.42,
    "affected_runs": 59,
    "comparison_visibility": 35.48,
    "comparison_rank": 3.83,
    "comparison_sentiment": 70.5,
    "comparison_runs": 102
  },
  {
    "day": "2026-08-26",
    "is_event_day": false,
    "affected_visibility": 31.65,
    "affected_rank": 4.11,
    "affected_sentiment": 72.68,
    "affected_runs": 59,
    "comparison_visibility": 35.12,
    "comparison_rank": 3.85,
    "comparison_sentiment": 69.74,
    "comparison_runs": 102
  },
  {
    "day": "2026-08-27",
    "is_event_day": false,
    "affected_visibility": 30.2,
    "affected_rank": 4.07,
    "affected_sentiment": 71.38,
    "affected_runs": 58,
    "comparison_visibility": 34.29,
    "comparison_rank": 3.99,
    "comparison_sentiment": 70.46,
    "comparison_runs": 104
  },
  {
    "day": "2026-08-28",
    "is_event_day": false,
    "affected_visibility": 30.97,
    "affected_rank": 4.21,
    "affected_sentiment": 72.13,
    "affected_runs": 60,
    "comparison_visibility": 33.78,
    "comparison_rank": 3.77,
    "comparison_sentiment": 70.42,
    "comparison_runs": 103
  },
  {
    "day": "2026-08-29",
    "is_event_day": false,
    "affected_visibility": 31.18,
    "affected_rank": 4.26,
    "affected_sentiment": 73.16,
    "affected_runs": 55,
    "comparison_visibility": 34.66,
    "comparison_rank": 3.82,
    "comparison_sentiment": 69.87,
    "comparison_runs": 103
  },
  {
    "day": "2026-08-30",
    "is_event_day": false,
    "affected_visibility": 31.88,
    "affected_rank": 4.32,
    "affected_sentiment": 72.77,
    "affected_runs": 58,
    "comparison_visibility": 35.13,
    "comparison_rank": 3.88,
    "comparison_sentiment": 70.53,
    "comparison_runs": 97
  },
  {
    "day": "2026-08-31",
    "is_event_day": false,
    "affected_visibility": 33.51,
    "affected_rank": 4.24,
    "affected_sentiment": 73.02,
    "affected_runs": 56,
    "comparison_visibility": 35.19,
    "comparison_rank": 3.98,
    "comparison_sentiment": 69.87,
    "comparison_runs": 101
  },
  {
    "day": "2026-09-01",
    "is_event_day": true,
    "affected_visibility": 33.08,
    "affected_rank": 4.21,
    "affected_sentiment": 72.91,
    "affected_runs": 59,
    "comparison_visibility": 35.24,
    "comparison_rank": 3.81,
    "comparison_sentiment": 70.85,
    "comparison_runs": 97
  },
  {
    "day": "2026-09-02",
    "is_event_day": false,
    "affected_visibility": 33.11,
    "affected_rank": 4.15,
    "affected_sentiment": 71.66,
    "affected_runs": 60,
    "comparison_visibility": 35.94,
    "comparison_rank": 3.84,
    "comparison_sentiment": 70.62,
    "comparison_runs": 101
  },
  {
    "day": "2026-09-03",
    "is_event_day": false,
    "affected_visibility": 34.7,
    "affected_rank": 3.97,
    "affected_sentiment": 72.78,
    "affected_runs": 55,
    "comparison_visibility": 35.41,
    "comparison_rank": 3.89,
    "comparison_sentiment": 69.55,
    "comparison_runs": 102
  },
  {
    "day": "2026-09-04",
    "is_event_day": false,
    "affected_visibility": 34.5,
    "affected_rank": 3.95,
    "affected_sentiment": 72.62,
    "affected_runs": 55,
    "comparison_visibility": 35.86,
    "comparison_rank": 3.86,
    "comparison_sentiment": 69.68,
    "comparison_runs": 99
  },
  {
    "day": "2026-09-05",
    "is_event_day": false,
    "affected_visibility": 33.27,
    "affected_rank": 3.91,
    "affected_sentiment": 74.54,
    "affected_runs": 60,
    "comparison_visibility": 34.93,
    "comparison_rank": 3.84,
    "comparison_sentiment": 70.57,
    "comparison_runs": 104
  },
  {
    "day": "2026-09-06",
    "is_event_day": false,
    "affected_visibility": 33.39,
    "affected_rank": 3.84,
    "affected_sentiment": 73.21,
    "affected_runs": 60,
    "comparison_visibility": 35.7,
    "comparison_rank": 3.78,
    "comparison_sentiment": 69.98,
    "comparison_runs": 100
  },
  {
    "day": "2026-09-07",
    "is_event_day": false,
    "affected_visibility": 35.52,
    "affected_rank": 3.88,
    "affected_sentiment": 72.87,
    "affected_runs": 60,
    "comparison_visibility": 35.13,
    "comparison_rank": 3.82,
    "comparison_sentiment": 70.21,
    "comparison_runs": 97
  },
  {
    "day": "2026-09-08",
    "is_event_day": false,
    "affected_visibility": 36.69,
    "affected_rank": 3.64,
    "affected_sentiment": 75.43,
    "affected_runs": 55,
    "comparison_visibility": 35.69,
    "comparison_rank": 3.92,
    "comparison_sentiment": 70.09,
    "comparison_runs": 100
  },
  {
    "day": "2026-09-09",
    "is_event_day": false,
    "affected_visibility": 37.37,
    "affected_rank": 3.81,
    "affected_sentiment": 74.41,
    "affected_runs": 56,
    "comparison_visibility": 36.07,
    "comparison_rank": 3.8,
    "comparison_sentiment": 71.15,
    "comparison_runs": 97
  },
  {
    "day": "2026-09-10",
    "is_event_day": false,
    "affected_visibility": 38.01,
    "affected_rank": 3.71,
    "affected_sentiment": 75.67,
    "affected_runs": 56,
    "comparison_visibility": 37.41,
    "comparison_rank": 3.7,
    "comparison_sentiment": 70.59,
    "comparison_runs": 104
  },
  {
    "day": "2026-09-11",
    "is_event_day": false,
    "affected_visibility": 39.32,
    "affected_rank": 3.66,
    "affected_sentiment": 76.29,
    "affected_runs": 55,
    "comparison_visibility": 36.73,
    "comparison_rank": 3.81,
    "comparison_sentiment": 70.51,
    "comparison_runs": 100
  },
  {
    "day": "2026-09-12",
    "is_event_day": false,
    "affected_visibility": 40.13,
    "affected_rank": 3.48,
    "affected_sentiment": 76.11,
    "affected_runs": 59,
    "comparison_visibility": 36.8,
    "comparison_rank": 3.72,
    "comparison_sentiment": 70.07,
    "comparison_runs": 102
  },
  {
    "day": "2026-09-13",
    "is_event_day": false,
    "affected_visibility": 40.22,
    "affected_rank": 3.55,
    "affected_sentiment": 74.63,
    "affected_runs": 60,
    "comparison_visibility": 36.67,
    "comparison_rank": 3.7,
    "comparison_sentiment": 71.19,
    "comparison_runs": 98
  },
  {
    "day": "2026-09-14",
    "is_event_day": false,
    "affected_visibility": 39.46,
    "affected_rank": 3.23,
    "affected_sentiment": 74.82,
    "affected_runs": 57,
    "comparison_visibility": 36.51,
    "comparison_rank": 3.86,
    "comparison_sentiment": 70.36,
    "comparison_runs": 104
  },
  {
    "day": "2026-09-15",
    "is_event_day": false,
    "affected_visibility": 39.12,
    "affected_rank": 3.43,
    "affected_sentiment": 76.29,
    "affected_runs": 55,
    "comparison_visibility": 36.16,
    "comparison_rank": 3.71,
    "comparison_sentiment": 71.51,
    "comparison_runs": 103
  },
  {
    "day": "2026-09-16",
    "is_event_day": false,
    "affected_visibility": 38.75,
    "affected_rank": 3.4,
    "affected_sentiment": 75.51,
    "affected_runs": 58,
    "comparison_visibility": 36.71,
    "comparison_rank": 3.81,
    "comparison_sentiment": 70.87,
    "comparison_runs": 97
  },
  {
    "day": "2026-09-17",
    "is_event_day": false,
    "affected_visibility": 39.05,
    "affected_rank": 3.36,
    "affected_sentiment": 76.19,
    "affected_runs": 60,
    "comparison_visibility": 36.97,
    "comparison_rank": 3.77,
    "comparison_sentiment": 69.64,
    "comparison_runs": 99
  },
  {
    "day": "2026-09-18",
    "is_event_day": false,
    "affected_visibility": 40.49,
    "affected_rank": 3.22,
    "affected_sentiment": 76.87,
    "affected_runs": 57,
    "comparison_visibility": 37.44,
    "comparison_rank": 3.75,
    "comparison_sentiment": 71.48,
    "comparison_runs": 98
  },
  {
    "day": "2026-09-19",
    "is_event_day": false,
    "affected_visibility": 41.42,
    "affected_rank": 3.15,
    "affected_sentiment": 75.84,
    "affected_runs": 60,
    "comparison_visibility": 37.37,
    "comparison_rank": 3.84,
    "comparison_sentiment": 70.89,
    "comparison_runs": 101
  },
  {
    "day": "2026-09-20",
    "is_event_day": false,
    "affected_visibility": 40.98,
    "affected_rank": 3.44,
    "affected_sentiment": 76.2,
    "affected_runs": 56,
    "comparison_visibility": 37.2,
    "comparison_rank": 3.9,
    "comparison_sentiment": 70.71,
    "comparison_runs": 103
  },
  {
    "day": "2026-09-21",
    "is_event_day": false,
    "affected_visibility": 42.32,
    "affected_rank": 3.41,
    "affected_sentiment": 75.87,
    "affected_runs": 58,
    "comparison_visibility": 37.45,
    "comparison_rank": 3.8,
    "comparison_sentiment": 70.3,
    "comparison_runs": 98
  },
  {
    "day": "2026-09-22",
    "is_event_day": false,
    "affected_visibility": 42.34,
    "affected_rank": 3.26,
    "affected_sentiment": 75.31,
    "affected_runs": 60,
    "comparison_visibility": 38.32,
    "comparison_rank": 3.89,
    "comparison_sentiment": 71.11,
    "comparison_runs": 97
  },
  {
    "day": "2026-09-23",
    "is_event_day": false,
    "affected_visibility": 41.69,
    "affected_rank": 3.37,
    "affected_sentiment": 75.51,
    "affected_runs": 60,
    "comparison_visibility": 37.99,
    "comparison_rank": 3.78,
    "comparison_sentiment": 69.85,
    "comparison_runs": 102
  },
  {
    "day": "2026-09-24",
    "is_event_day": false,
    "affected_visibility": 40.82,
    "affected_rank": 3.33,
    "affected_sentiment": 76.11,
    "affected_runs": 56,
    "comparison_visibility": 37.35,
    "comparison_rank": 3.82,
    "comparison_sentiment": 70.11,
    "comparison_runs": 104
  },
  {
    "day": "2026-09-25",
    "is_event_day": false,
    "affected_visibility": 40.45,
    "affected_rank": 3.22,
    "affected_sentiment": 76.15,
    "affected_runs": 58,
    "comparison_visibility": 36.65,
    "comparison_rank": 3.77,
    "comparison_sentiment": 69.67,
    "comparison_runs": 97
  },
  {
    "day": "2026-09-26",
    "is_event_day": false,
    "affected_visibility": 39.67,
    "affected_rank": 3.39,
    "affected_sentiment": 76.77,
    "affected_runs": 57,
    "comparison_visibility": 37.08,
    "comparison_rank": 3.75,
    "comparison_sentiment": 70.39,
    "comparison_runs": 100
  },
  {
    "day": "2026-09-27",
    "is_event_day": false,
    "affected_visibility": 40.12,
    "affected_rank": 3.41,
    "affected_sentiment": 75.71,
    "affected_runs": 55,
    "comparison_visibility": 36.03,
    "comparison_rank": 3.71,
    "comparison_sentiment": 71.07,
    "comparison_runs": 104
  },
  {
    "day": "2026-09-28",
    "is_event_day": false,
    "affected_visibility": 40.44,
    "affected_rank": 3.16,
    "affected_sentiment": 77.2,
    "affected_runs": 58,
    "comparison_visibility": 36.76,
    "comparison_rank": 3.77,
    "comparison_sentiment": 70.38,
    "comparison_runs": 99
  },
  {
    "day": "2026-09-29",
    "is_event_day": false,
    "affected_visibility": 40.76,
    "affected_rank": 3.37,
    "affected_sentiment": 75.17,
    "affected_runs": 60,
    "comparison_visibility": 37.54,
    "comparison_rank": 3.75,
    "comparison_sentiment": 70.1,
    "comparison_runs": 101
  },
  {
    "day": "2026-09-30",
    "is_event_day": false,
    "affected_visibility": 42.05,
    "affected_rank": 3.43,
    "affected_sentiment": 75.48,
    "affected_runs": 58,
    "comparison_visibility": 38.14,
    "comparison_rank": 3.68,
    "comparison_sentiment": 70.22,
    "comparison_runs": 102
  },
  {
    "day": "2026-10-01",
    "is_event_day": false,
    "affected_visibility": 41.21,
    "affected_rank": 3.38,
    "affected_sentiment": 77.24,
    "affected_runs": 60,
    "comparison_visibility": 38.06,
    "comparison_rank": 3.73,
    "comparison_sentiment": 70.04,
    "comparison_runs": 98
  }
]
```
