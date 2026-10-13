# Prompt-Intents und Branded: Antwort an Claude Code (13.10.2026)

**Gebaut:**
- `intents_v1.sql`, Rückweg `intents_v1_rueckweg.sql`
- Edge-Funktion `prompt-intents-kick` (deployt)
- n8n `n8n/PROMPT_INTENTS_V1.json` (neu) und `n8n/ONBOARDING_PROMPTS_V1.json` (geändert)
- Änderungsliste für Prompt_Creator v2 in `n8n/AENDERUNGEN_UND_IMPORT.md`

**Getestet:**
- Zwei Läufe in Produktion, jeweils in einer Transaktion mit Rollback. Gespeichert wurde nichts.
- Der Rückweg wurde im selben Lauf geprüft: alle 62 Funktionen danach exakt wie vorher, also Definition, Signatur und Rechte.
- Echte Antworten in `intents_v1_echte_antworten.json`.

## Zu Punkt 4: Die Form

Es sind **eigene Funktionen** geworden: `prompt_intent_set_v1` und `prompt_branded_set_v1`. `prompts_bulk_v1` bekommt keine neuen Aktionen. Die Zielmenge (`ids` oder `filter`) prüfen beide genau wie `prompts_bulk_v1`.

## 1 Neue Felder

**An jeder Prompt-Zeile** von `cached_prompts_list_v1` und an `prompt_detail_v1.row`:

```json
{ "intent": "recommendation", "intent_source": "ai", "intent_status": "done",
  "branded": true, "branded_source": "match",
  "branded_brands": [ { "company_id": "…", "name": "HubSpot", "logo_url": "https://…" } ] }
```

**Wertebereiche:**

| Feld | Werte |
|---|---|
| `intent` | `informational`, `recommendation`, `transactional`, `other` oder `null` (nicht klassifiziert) |
| `intent_source` | `ai`, `user` oder `null` |
| `intent_status` | `pending`, `done` oder `failed` |
| `branded_source` | `match` oder `user` |

**Anzeige:**
- `pending` zeigt „Classifying“, `failed` zeigt „Not classified“. In beiden Fällen ist `intent` `null`.
- `branded_brands` ist nur gefüllt, wenn `branded` true ist. Es sind die gefundenen Marken, die eigene zuerst. Setzt der Nutzer `branded` von Hand auf true, kann die Liste leer sein.

**Weitere Stellen:**
- **`prompts_page_meta_v1`:** neu `intent_counts {informational, recommendation, transactional, other, pending}`. Gezählt werden die aktiven Prompts, `pending` umfasst noch offene und fehlgeschlagene.
- **`onboarding_bundle_v1`:** Jedes Objekt in `row.prompts` hat `intent`. Eigene Prompts des Nutzers haben `null`, sie werden nach dem Abschluss klassifiziert.
- **`prompt_research_result_v1`:** Jede Zeile hat `intent` (oder `null`) und `branded`.

## 2 Gruppen nach Intent

`cached_prompts_groups_v1` hat den neuen Parameter `p_group_by` (`topic`, Default, oder `intent`). Ein anderer Wert ergibt 400 `prompts_invalid_param`, hint `p_group_by: topic, intent`.

Bei `intent`:
- **Gruppen:** immer vier Gruppen in fester Reihenfolge: informational, recommendation, transactional, other. Dazu kommt `pending` als fünfte, wenn es offene oder fehlgeschlagene gibt.
- **Form wie bei Topics:** `group_type: "intent"`, `group_key` und `name` sind der Wert, `tag_id` ist `null`, `tag_ids` ist `[]`. Gezählt wird wie bisher.
- **`p_mode` und `p_groups`** werden ignoriert und nicht geprüft.
- **`meta`:** neu `group_by: "intent"`, dazu `mode: "intent"`. Bei Topics kommt `group_by: "topic"`, `mode` bleibt wie bisher.

Aufklappen einer Gruppe: `cached_prompts_list_v1` mit `p_intents: ["recommendation"]` bzw. `["pending"]`.

## 3 Filter `p_intents` und `p_branded`

**Die 32 Funktionen**, jeweils mit `p_intents text[]` und `p_branded text` am Ende, beide mit Default:

- **Prompts:** `cached_prompts_list_v1`, `cached_prompts_groups_v1`, `prompts_bulk_v1` (Filtermodus), `export_prompts_v1`
- **Dashboard:** `cached_dashboard_overview_v1`, `cached_dashboard_visibility_v1`, `cached_dashboard_responses_v1`, `export_responses_v1`
- **Citations:**
  - `cached_citations_overview_v1`, `cached_citations_domains_v1`, `cached_citations_urls_v1`, `cached_citations_domain_urls_v1`
  - `export_citations_domains_v1`, `export_citations_urls_v1`
  - `domain_detail_stats_v1`, `domain_url_share_v1`
- **Performance:** `performance_company_chart_v1`, `performance_radar_v1`, `performance_brand_variations_v1`
- **URL-Drawer:** `url_detail_v1`
- **Shopping:** `cached_shopping_overview_v2`, `cached_shopping_products_v2`, `cached_shopping_merchants_v2`, `cached_shopping_product_detail_v2`
- **Ads:** `get_ads_overview_v2`, `get_ads_advertiser_detail_v2`, `list_ads_advertisers_v2`, `list_ads_library_v2`, `list_ads_prompts_v2`
- **Events:** `cached_impact_event_analysis_v2`
- **Marken:** `export_brands_v2`, `cached_discover_brands_v1`

**Brand-, Prompt- und Response-Drawer:** Sie laufen über diese Funktionen mit `p_brand` bzw. `p_prompt_id`.
- `prompt_detail_v1` und `response_detail_v1` zeigen nur einen Prompt bzw. eine Antwort und bekommen keinen Filter.

**Werte:**
- **`p_intents`:** eine Liste aus `informational`, `recommendation`, `transactional`, `other`, `pending`.
  - `pending` meint ohne Intent, also offen oder fehlgeschlagen.
  - Groß- und Kleinschreibung sowie Leerzeichen sind egal.
  - Eine leere Liste oder alle fünf Werte bedeuten kein Filter.
- **`p_branded`:** `non_branded`, `branded` oder `all`.
  - `null` oder fehlend bedeutet `all`, also wie heute.
  - `non_branded` schließt alle Prompts mit `branded = true` aus. Noch nicht geprüfte zählen als nicht branded.

**Fehler:**
- Ungültige Werte ergeben 400. `message` ist der Fehlercode der jeweiligen Seite (`dashboard_invalid_param`, `citations_invalid_param`, `prompts_invalid_param`, `performance_invalid_param`, `shopping_invalid_param`, `ads_invalid_param`, `impact_event_invalid_param`, `exports_invalid_param`, `brands_invalid_param`).
- `hint` ist `p_intents` bzw. `p_branded`.
- `url_detail_v1` meldet `dashboard_invalid_param`, wie bei seinen anderen Filtern.

**Gleiche Prompt-Menge überall:** Der Filter sitzt an jeder Stelle, an der heute Markt- und Topic-Filter die Prompts wählen. Auch die Cache-Nachrechnung im Hintergrund nutzt ihn.
- Beispiel 877c mit `["recommendation"]`: Dashboard-Übersicht, Sichtbarkeit, Antworten und Liste zeigen je die 86 Runs dieses einen Prompts.

**Cache:**
- Der Filter ist Teil des Schlüssels. Ohne Filter bleibt der Schlüssel wie bisher, bestehende Caches gelten weiter.
- Der erste Aufruf mit einem neuen Filter wird frisch gerechnet. Beispiel: Übersicht 877c mit `non_branded` brauchte 2,7 s, danach kommt sie aus dem Cache.
- Hat ein Team keinen branded Prompt, liefert `non_branded` dieselben Zahlen wie ohne Filter und nimmt den schnellen Weg über die Team-Summen.

**Ohne Filter:** `dashboard_opportunities_v1` hat keine Prompt-Menge. `get_ads_filter_options_v2` hat keine Filter. Bubble-Funktionen sind unverändert.

## 4 Schreiben

```
POST /rest/v1/rpc/prompt_intent_set_v1
{ "p_team": "…", "p_target": "ids", "p_ids": ["…"], "p_intent": "transactional" }   -> {"updated": 1}
```

- **`p_intent`:**
  - Einer der vier Werte setzt `intent_source = 'user'` und `intent_status = 'done'`. Kein späterer Lauf fasst den Prompt dann noch an.
  - `null` heißt zurück an die KI: `intent` und `intent_source` werden `null`, der Status `pending`, und die Klassifikation startet sofort neu. Das ist auch der Weg für `failed`.
  - Ein unbekannter Wert ergibt 400 `prompt_intent_invalid`, hint `p_intent`.
- **`updated`** zählt geänderte Prompts. Derselbe Wert ein zweites Mal ergibt `{"updated":0}`.
- **Zielmenge** wie `prompts_bulk_v1`:
  - `p_target: "ids"` mit `p_ids` (1–500).
  - `p_target: "filter"` mit allen Filtern der Liste (`p_date_from` … `p_status`, `p_intents`, `p_branded`), `p_excluded_ids` (höchstens 500) und Pflicht `p_expected_count`.
  - Höchstens 1000 Prompts. Weicht die Zahl ab, kommt 409 `prompts_selection_changed`, hint ist die echte Zahl.
  - Fremde oder gelöschte IDs ergeben 404 `prompts_not_found`.
- **Wer darf:** jedes Teammitglied mit Zugang, wie bei `prompts_bulk_v1`. Das Limit liegt bei 30 Aufrufen je Minute.

`prompt_branded_set_v1` hat dieselbe Form:
- **`p_branded`** (boolean) ist der Wert. Weil der Name schon belegt ist, heißt der Filter hier **`p_branded_filter`**.
- **`true` oder `false`** setzt `branded_source = 'user'`. Ein späterer Neuabgleich lässt den Prompt dann in Ruhe.
- **`null`** heißt zurück an den Abgleich.

Beide leeren die Prompt-Caches des Teams und alle Caches, deren Filter vom geänderten Wert abhängt.

## 5 Live-Stand ohne Polling

Wenn ein Lauf Intents geschrieben hat oder Prompts auf `failed` gingen, sendet die Datenbank einen Broadcast:
- **Kanal:** privat, `team_prompts:<team_id>`, nur für Teammitglieder.
- **Event:** `prompt_intents`.
- **Payload:** `{ team_id, prompt_ids, intent_counts }`.

Die Oberfläche lädt daraufhin Liste und Gruppen neu. Die Caches sind dann schon geleert.

## 6 Wann klassifiziert wird

- **Anlegen:** Jeder neue Prompt startet auf `pending`, egal ob einzeln, als CSV, aus der Prompt Research ohne Intent oder als eigener Onboarding-Prompt.
  - Die Datenbank stößt sofort an. n8n holt bis zu 50 offene Prompts je Runde und schickt sie in einem Aufruf ans Modell (gpt-4o-mini, Temperatur 0).
  - Eine CSV mit 200 Prompts braucht also 4 Aufrufe, je 50 Prompts.
- **Wiederholung:**
  - Höchstens 3 Versuche, mit 2 bzw. 4 Minuten Abstand. Danach `failed`.
  - Nach 24 h ohne Ergebnis wird auf jeden Fall `failed` gesetzt. Nichts bleibt dauerhaft auf `pending`.
- **Bestand:** Mit dem Einspielen stehen alle Prompts auf `pending`. Der Cron stößt jede Minute an, bis alle klassifiziert sind.
- **Textänderung:** Ändert sich der Text, wird neu klassifiziert und neu abgeglichen. Was der Nutzer selbst gesetzt hat, bleibt.

## 7 Branded

**Abgleich:** gegen Namen, Anzeigenamen und Aliasse der eigenen Marke und aller getrackten Wettbewerber.
- Ganze Wörter, Groß- und Kleinschreibung sowie Satzzeichen sind egal. „Mercedes-Benz“ trifft „mercedes benz“, „Audi“ trifft nicht „Audiophile“.
- Aliasse mit `contains_ci` gelten als Teiltext, `regex` als Muster.

**Neuabgleich:** wenn sich die Marken des Teams ändern, also Wettbewerber neu oder weg, Name, Anzeigename oder Alias geändert. Er gilt für alle Prompts ohne Nutzerentscheidung und für offene Research-Vorschläge. Danach werden die betroffenen Caches geleert.

**Abgleich im Modell-Workflow:** Seinen Code kann ich in der Datenbank nicht sehen. Der Prompt-Abgleich arbeitet mit Wortgrenzen und ohne Groß/Klein. Weicht der Modell-Workflow davon ab, bitte melden.

## 8 Onboarding und Prompt Research

**Onboarding:**
- n8n erzeugt 20 Vorschläge mit `intent` und ohne Markennamen.
- `onboarding_run_finish_prompts_v1` wählt daraus 15:
  - Es verwirft, was die eigene Marke (Name, Domain) oder einen Kandidaten-Wettbewerber nennt, außerdem `other`.
  - Die Verteilung ist fest: 4 informational, 7 recommendation, 4 transactional. Jedes Topic kommt möglichst einmal vor.
- Beim Abschluss werden die Prompts mit diesem Intent gespeichert (`intent_source = 'ai'`, `done`). Branded prüft der Abgleich gegen die Marken und Aliasse des neuen Teams. Das ergibt `false`, außer ein Alias wie „Mercedes“ trifft, den es im Onboarding noch nicht gab.
- Die heutige Version des Workflows ohne `intent` funktioniert weiter. Dann landen alle 15 auf `pending`.

**Prompt Research:** Die Vorschläge haben `intent` und `branded`. Beim Übernehmen werden beide mitgespeichert, ohne zweiten Lauf.

## Zu Punkt 3: Zahlen

- **Branded:**
  - Von 622 Prompts aller Teams nennt **1** eine getrackte Marke („welche Rösterei bietet Omni-Roasts …“).
  - Team 877c: **0 von 102** aktiven Prompts.
  - Die Onboarding-Generierung hat Markennamen bisher also schon weitgehend gemieden.
- **Intents je Wert:** Die gibt es erst nach dem n8n-Lauf. Vorher steht jeder Prompt auf `pending`. Abfrage für danach:

```sql
select coalesce(intent, intent_status) as wert, count(*)
from app.prompt where deleted_at is null group by 1 order by 2 desc;
```
