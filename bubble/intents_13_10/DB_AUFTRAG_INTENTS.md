# DB-Auftrag: Prompt-Intents und Branded

Stand 13.10.2026. Zum Weiterleiten an den DB-Chat. Die Recherche dazu steht in
`bubble/recherche_13_10/PROMPT_INTENTS_RECHERCHE.md`.

## 0 Worum es geht

Jeder Prompt bekommt zwei neue Eigenschaften:

1. **Intent:** genau einer von `informational`, `recommendation`, `transactional`, `other`.
   - Die KI vergibt ihn.
   - Der Nutzer kann ihn überschreiben, und eine Überschreibung fasst keine spätere Klassifikation wieder an.
2. **Branded:** Der Prompt nennt die **eigene Marke oder einen getrackten Wettbewerber** (Name oder Alias).
   - Das entscheidet ein Namensabgleich, keine KI.
   - Gleiche Logik wie der Abgleich im Modell-Workflow, der heute die Erwähnungen in den Antworten findet.
   - Der Nutzer kann auch das überschreiben.

**Branded fließt nicht in die Auswertungen ein.** Ein Prompt, der eine Marke nennt, bringt diese Marke fast sicher in die Antwort und verfälscht Visibility und Share of Voice. Alle auswertenden Funktionen bekommen deshalb einen Filter `p_branded`. Die Oberfläche schickt standardmäßig `non_branded`.

**Abgrenzung der Intents.** Entscheidend ist, **welche Antwort verlangt wird**. Genau ein Label je Prompt.

| Wert | verlangt | Beispiele |
|---|---|---|
| `informational` | Wissen, Erklärung, keine Anbieterwahl | „What is lead scoring?“, „Wie lange hält ein E-Auto-Akku?“ |
| `recommendation` | eine Liste von Optionen. Filter wie Preisgrenze, Zielgruppe oder „Alternative zu X“ ändern daran nichts, und Vergleiche („X vs Y“) zählen hierher | „best CRM for agencies“, „best cheap CRM under $20“, „HubSpot vs Pipedrive“ |
| `transactional` | Konditionen oder den nächsten Schritt für ein Angebot: Preis, Tarif, Rabatt, Testversion, Leasing, Finanzierung, Händler, Kauf, Buchung, Anmeldung | „Pipedrive pricing per user“, „GLC Leasing ohne Anzahlung“, „CRM free trial“ |
| `other` | passt in keine Stufe: Login, Support zu einem vorhandenen Produkt, Navigation | „HubSpot login“, „How to import contacts into HubSpot“ |

## 1 Spalten an `prompts`

| Spalte | Typ | Bedeutung |
|---|---|---|
| `intent` | text null, check auf die vier Werte | `null` = noch nicht klassifiziert |
| `intent_source` | text null, `'ai'` / `'user'` | `'user'` schützt vor jeder Neuklassifikation |
| `intent_status` | text not null default `'pending'`, `'pending'` / `'done'` / `'failed'` | siehe 2.3 |
| `intent_set_at` | timestamptz null | |
| `intent_model` | text null | Modell und Version des Klassifizierers, für spätere Läufe |
| `branded` | boolean null | `null` = noch nicht geprüft |
| `branded_brand_ids` | uuid[] not null default `'{}'` | welche Marken gefunden wurden (eigene und Wettbewerber). Die Oberfläche zeigt deren Favicons |
| `branded_source` | text null, `'match'` / `'user'` | `'user'` schützt vor dem Neuabgleich |

Mit Rückweg-SQL wie immer.

## 2 Klassifizieren

### 2.1 Wo

| Anlass | Wie |
|---|---|
| Einzelner Prompt (`prompts_add_v1` mit einem Eintrag) | sofort nach dem Anlegen ein Aufruf für diesen Prompt |
| Bulk (`prompts_add_v1` mit mehreren Einträgen, CSV) | **ein** Aufruf für die ganze Liste, das Modell antwortet je Zeile |
| Onboarding (n8n `ONBOARDING_PROMPTS_V1`) und Prompt Research | im **bestehenden** Schritt, der heute Text und Topic erzeugt. Das Ausgabeschema bekommt ein Feld `intent` |
| Bestand | einmaliger Backfill über alle Prompts mit `intent is null` |

### 2.2 Der Aufruf

- **Systemanweisung kurz:** die Tabelle aus Abschnitt 0, „Answer with exactly one of: informational, recommendation, transactional, other.“ Bei Bulk eine JSON-Liste `[{ "i": 0, "intent": "…" }]` in derselben Reihenfolge.
- Kleines Modell, Temperatur 0.
- **Harte Prüfung danach:** Der Wert wird kleingeschrieben, getrimmt und gegen die vier Werte geprüft. **Kein anderer Wert wird gespeichert, keine eigenen Labels.** Fehlt eine Zeile oder ist sie ungültig, gilt sie als Fehlschlag (2.3). Nie raten, nie `other` als Ersatz.
- Beim Onboarding und in der Prompt Research gilt dieselbe Prüfung. Ein ungültiger Wert wird zu `intent = null`, `intent_status = 'pending'`, und der Hintergrundlauf holt ihn nach.

### 2.3 Zustand und Wiederholung

- `pending` beim Anlegen.
- `done`, sobald ein gültiger Wert gespeichert ist.
- Höchstens **3 Versuche** mit Abstand. Danach `failed`. **Ein Prompt darf nie dauerhaft auf `pending` stehen,** sonst zeigt die Oberfläche endlos „Classifying“.
- `failed` zeigt die Oberfläche als „Not classified“, und der Nutzer setzt den Intent von Hand.
- `intent_source = 'user'`: Kein Lauf fasst den Prompt an, auch der Backfill nicht.

### 2.4 Branded

- Abgleich beim Anlegen, gegen Namen und Aliasse der eigenen Marke und **aller getrackten Wettbewerber**. Wortgrenzen und Groß/Klein wie im Modell-Workflow.
- **Neuabgleich**, wenn sich die Marken des Teams ändern (Wettbewerber neu, entfernt, Alias geändert), für alle Prompts mit `branded_source is distinct from 'user'`. Sonst veraltet der Wert.
- Danach die Caches des Teams leeren wie bei jeder Schreibaktion.

## 3 Schreiben

`prompt_intent_set_v1`

| Parameter | |
|---|---|
| `p_team` | uuid |
| `p_target` | `'ids'` / `'filter'`, wie `prompts_bulk_v1` (Ausschluss-Modell, `p_excluded_ids`, `p_expected_count`, alle Filter aus 5) |
| `p_ids` | uuid[] |
| `p_intent` | einer der vier Werte, oder `null` = zurück an die KI (`intent_source = null`, `intent_status = 'pending'`, wird neu klassifiziert) |

Beispiel:
`{"p_team":"877c649c-f5f2-44e9-bb04-155f5bf44e70","p_target":"ids","p_ids":["<uuid>"],"p_intent":"transactional"}`
liefert `{"updated":1}`.

Ein unbekannter Wert ergibt 400, `message = prompt_intent_invalid`, `hint = p_intent`.

`prompt_branded_set_v1`: dieselbe Form mit `p_branded boolean | null`. `null` heißt zurück an den Abgleich.

Lieber als neue Aktionen in `prompts_bulk_v1` (`set_intent`, `set_branded` mit `p_intent` / `p_branded`), wenn das für euch einfacher ist. Dann bitte zurückmelden, welche Form gilt.

Beide leeren dieselben Caches wie `prompts_bulk_v1`.

## 4 Lesen: Prompts

**`cached_prompts_list_v1`**, je Zeile zusätzlich:

```json
{ "intent": "recommendation", "intent_source": "ai", "intent_status": "done",
  "branded": true, "branded_source": "match",
  "branded_brands": [ { "company_id": "…", "name": "HubSpot", "logo_url": "https://…" } ] }
```

**`cached_prompts_groups_v1`**, neuer Parameter `p_group_by text default 'topic'`, Werte `'topic'` und `'intent'`.

- Bei `'intent'` je Intent eine Gruppe in derselben Form wie heute:
  - `group_key` ist der Wert (`informational` …);
  - `prompts_count`, `prompts_count_inactive`, Visibility usw. wie bei Topics.
- Dazu eine Gruppe `group_key = "pending"` für noch nicht klassifizierte und fehlgeschlagene Prompts, falls es welche gibt.
- `p_mode` und `p_groups` (eigene Gruppierungen) werden bei `'intent'` ignoriert.
- Feste Reihenfolge: informational, recommendation, transactional, other, pending.

Zum Aufklappen einer Intent-Gruppe ruft die Oberfläche `cached_prompts_list_v1` mit `p_intents = ["<wert>"]` auf (siehe 5). Für die Gruppe „pending“ geht `p_intents = ["pending"]`.

`prompts_page_meta_v1`: zusätzlich `intent_counts` `{ "informational": 18, "recommendation": 42, "transactional": 9, "other": 3, "pending": 2 }` (aktive Prompts).

## 5 Filter auf allen auswertenden Funktionen

Die Oberfläche schickt beide Parameter erst, wenn der Gastgeber sie freigibt (`NEXT_PUBLIC_UP_INTENTS=1`, also `window.__upIntentsLive`). Bis dahin ändert sich an keinem Aufruf etwas. Bitte zurückmelden, sobald **alle** Funktionen unten sie kennen. Eine einzige fehlende antwortet mit 404 PGRST202, und ihr Teil der Seite bleibt leer.

Zwei neue optionale Parameter, **überall, wo heute `p_tag_ids` / `p_models` / `p_markets` ankommen**:

| Parameter | Werte | fehlt |
|---|---|---|
| `p_intents` | text[] aus den vier Werten plus `"pending"` | alle |
| `p_branded` | `'non_branded'` / `'branded'` / `'all'` | `'all'`, also wie heute. Kein Aufruf bricht, solange die Oberfläche ihn noch nicht schickt |

Nach unserem Stand betrifft das mindestens:

- **Prompts:** `cached_prompts_list_v1`, `cached_prompts_groups_v1`, `prompts_bulk_v1` (Filtermodus)
- **Dashboard:** `cached_dashboard_overview_v1`, `cached_dashboard_visibility_v1`, `cached_dashboard_responses_v1`
- **Citations:** `cached_citations_overview_v1`, `cached_citations_domains_v1`, `cached_citations_urls_v1`, `cached_citations_domain_urls_v1`
- **Performance:** `performance_company_chart_v1`, `performance_radar_v1`
- **Drawer:** `domain_detail_stats_v1`, `domain_url_share_v1`, dazu Brand, URL, Response und Prompt Detail
- **Shopping und Ads:** `cached_shopping_*_v2`, `get_ads_*_v2` / `list_ads_*_v2`
- **Opportunities:** `dashboard_opportunities_v1`
- **Events:** `cached_impact_event_analysis_v2`

Bitte selbst vervollständigen. Wichtig ist nur: **Jede Funktion, die über Prompts aggregiert, filtert dieselbe Prompt-Menge.** Die Cache-Schlüssel enthalten beide Parameter.

Ungültige Werte ergeben 400, `hint = p_intents` bzw. `p_branded`.

## 6 Onboarding (n8n `ONBOARDING_PROMPTS_V1` und `onboarding_bundle_v1`)

- **Keine Branded-Prompts.** Erzeugte Prompts, die den Abgleich aus 2.4 treffen, werden verworfen und ersetzt, nicht nur markiert.
- **Feste Verteilung** über die Buyer Journey, zum Beispiel bei 15 Prompts:
  - 4 `informational`
  - 7 `recommendation`
  - 4 `transactional`

  Kein `other`. Bei anderer Gesamtzahl im selben Verhältnis.
- Die heutige Vorgabe „only buying / vendor evaluation intent“ entfällt dafür.
- Jedes Prompt-Objekt im Bundle bekommt `intent`. Die Oberfläche lässt im Onboarding wahlweise nach Topic oder nach Intent gruppieren.
- Gespeichert wird mit `intent_source = 'ai'`, `intent_status = 'done'`, `branded = false`, `branded_source = 'match'`.

## 7 Prompt Research

`prompt_research_result_v1`: Jeder Vorschlag bekommt `intent` (gleiche Prüfung) und `branded`. Beim Übernehmen (`prompt_research_decide_v1`) werden beide Werte mitgespeichert, also kein zweiter Klassifikationslauf.

## 7b Für die nächste Runde: „Visibility by intent“

Für eine Dashboard-Ansicht wie bei Conductor oder Peec (je Intent Visibility, Share of Voice, Rang, Sentiment, eigene Marke gegen Wettbewerber, immer mit Anzahl der Prompts) bitte eine Funktion vorschlagen. Sie nimmt dieselben Filter wie `cached_dashboard_overview_v1` (also auch `p_branded`) und liefert eine Zeile je Intent und Marke. Das muss nicht in dieser Runde gebaut werden. Die Form reicht, damit die Oberfläche danach gebaut werden kann.

## 8 Bitte zurückmelden

1. Das SQL und das Rückweg-SQL.
2. **Echte Antworten** (Team 877c) für:
   - `cached_prompts_list_v1` (zwei Zeilen, davon eine `pending`);
   - `cached_prompts_groups_v1` mit `p_group_by: "intent"`;
   - `prompts_page_meta_v1`;
   - `cached_dashboard_overview_v1` einmal mit `p_branded: "non_branded"` und einmal ohne;
   - `prompt_intent_set_v1` (Erfolg und ungültiger Wert).
3. Wie viele Prompts der Backfill je Intent ergeben hat und wie viele `branded` sind.
4. Die Form aus 3: eigene Funktionen oder Aktionen in `prompts_bulk_v1`.
