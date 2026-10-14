# An den DB-Chat: Audit Intents/Branded und Prompt Research (14.10.)

Die UI ist gebaut und im Prüfstand gegen nachgestellte Antworten getestet. Was der Prüfstand nicht
zeigen kann, steht hier: zuerst zwei neue Aufträge (Prompt Research), dann Prüffragen an das, was
schon live ist. Bitte jede Antwort mit einer **echten Antwort** (JSON, gekürzt ist ok) belegen –
die UI wird gegen genau diese Antworten noch einmal geprüft.

---

## A. Neue Aufträge: Prompt Research

### A1. `start-job` – zwei neue Felder in `params`

Die Seite schickt ab Pin `8d99835` zusätzlich `intents` und `branded`. Body-Feldname wie bisher
`params`, Beispiel:

```json
{
  "kind": "prompt_research",
  "team_id": "877c649c-f5f2-44e9-bb04-155f5bf44e70",
  "params": {
    "keywords": ["SUV", "Hybrid"],
    "market": "DE",
    "business_model": "b2c",
    "persona": null,
    "intents": ["recommendation", "informational"],
    "branded": "non_branded"
  }
}
```

- **`intents`**: `null` oder eine Liste aus `informational`, `recommendation`, `transactional`
  (ohne Doppelte, `other` wird nie geschickt). Gewünscht: die Zahl der Vorschläge **gleichmäßig**
  auf die gewählten Intents verteilen (bei 2 Intents und 20 Vorschlägen je 10; Rest an den
  ersten). `null` = wie bisher, ohne Vorgabe.
- **`branded`**: `"non_branded"` (Vorgabe) oder `"all"`. Bei `"non_branded"` sollen die
  Vorschläge **keine** Marke nennen – weder die eigene noch einen getrackten Wettbewerber
  (dieselbe Regel wie `branded` an `team_prompts`). Bei `"all"` dürfen sie.
- Beide Felder bitte am Job speichern und in `prompt_research_jobs_v1` je Zeile mit ausgeben
  (`intents`, `branded`), damit „Previous researches“ sie später zeigen kann.
- Unbekannte Werte: `22023` mit `hint` wie bei den anderen Parametern.

### A2. `prompt_research_result_v1` – Intent und Branded je Vorschlag

Die Ergebnistabelle hat jetzt die Spalten **Intent** und **Branded**. Bitte je Zeile dieselben
Felder wie in `cached_prompts_list_v1`:

```json
{
  "id": "…",
  "prompt_text": "Mercedes GLC Hybrid Leasing ohne Anzahlung",
  "market": "DE",
  "estimated_volume": 41,
  "tags": [ … ],
  "intent": "transactional",
  "intent_status": "done",
  "intent_source": "ai",
  "branded": true,
  "branded_source": "match",
  "branded_brands": [{ "company_id": "…", "name": "Mercedes Benz", "logo_url": "…" }]
}
```

- Fehlen die Felder, zeigt die UI einen Strich – nichts geht kaputt, es sieht nur leer aus.
- Bei vorgegebenem Intent ist der Intent schon beim Erzeugen bekannt: `intent_status: "done"`.

### A3. `prompt_research_decide_v1` – beim Tracken übernehmen

Beim Akzeptieren bitte `intent` und `branded` des Vorschlags auf den neuen Prompt übernehmen
(`intent_source: "ai"`, `branded_source: "match"`), damit er nicht als „Wird zugeordnet“ in der
Tabelle landet und neu klassifiziert werden muss. Frage: Ist das ohne Weiteres möglich, oder
klassifiziert der Trigger auf `team_prompts` ohnehin neu?

---

## B. Prüffragen an das, was live ist

Bitte jede Frage mit Ja/Nein **und** einer echten Antwort beantworten.

1. **Zurück an die KI**: `prompt_intent_set_v1` mit `p_intent: null` – setzt das
   `intent_status: "pending"`, stößt die Klassifizierung an und sendet danach `prompt_intents`
   auf `team_prompts:<team>`? Wie lange dauert es im Mittel (gemessen waren einmal ~5 s)?
2. **Sammelaktion**: `prompt_intent_set_v1` mit `p_target: "filter"` und `p_excluded_ids` –
   greift dieselbe Filterlogik wie `cached_prompts_list_v1` (Suche, Marken, Topics, Märkte,
   `p_intents`, `p_branded`)? Bitte eine Antwort mit `updated`-Zahl.
3. **Branded zurück an den Abgleich**: `prompt_branded_set_v1` mit `p_branded: null` – wird der
   Abgleich sofort neu gerechnet (Antwort enthält dann `branded` und `branded_brands`), und kommt
   dafür auch ein Realtime-Ereignis?
4. **Gruppen nach Intent**: `cached_prompts_groups_v1` mit `p_group_by: "intent"` – kommt die
   Gruppe `group_key: "pending"` mit? Die UI blendet sie seit heute aus (ein Zwischenzustand von
   Sekunden ist keine wählbare Gruppe). Bitte bestätigen, dass die Zahlen der anderen Gruppen
   davon nicht abhängen.
5. **Alle Lesefunktionen mit `p_intents`/`p_branded`**: Bitte für jede der folgenden einmal mit
   `p_intents: ["informational"]` und `p_branded: "all"` aufrufen und bestätigen, dass gefiltert
   wird (Zahlen kleiner als ohne Filter):
   `cached_dashboard_overview_v1`, `cached_dashboard_visibility_v1`,
   `cached_dashboard_responses_v1`, `cached_citations_overview_v1`, `cached_citations_domains_v1`,
   `cached_citations_urls_v1`, `cached_citations_domain_urls_v1`, `cached_discover_brands_v1`,
   `performance_company_chart_v1`, `performance_radar_v1`, `performance_brand_variations_v1`,
   `domain_detail_v1`, `domain_detail_stats_v1`, `domain_url_share_v1`, `get_ads_overview_v2`,
   `list_ads_advertisers_v2`, `list_ads_library_v2`, `list_ads_prompts_v2`,
   `cached_shopping_overview_v2`, `cached_shopping_products_v2`, `cached_shopping_merchants_v2`.
   Fällt eine heraus, bitte nennen – die UI schickt die Parameter an alle.
6. **Cache**: Ändert ein Intent oder Branded die Zahlen der gecachten Funktionen sofort, oder erst
   nach `clear_*_cache_v1`? (Nach einer Änderung lädt die Prompts-Seite still nach; das Dashboard
   nicht.)
7. **Realtime**: Sendet `prompt_intents` auch bei Branded-Änderungen und bei Sammelaktionen
   (mit allen `prompt_ids`)? Wie groß wird die Nutzlast bei 500 Prompts?
8. **Fehlgeschlagen**: Wann steht `intent_status: "failed"`, und wird automatisch neu versucht?
9. **Standardmarkt**: Liefert `app_start` für **jedes** Team `default_market.alpha2`? Was kommt bei
   einem Team ohne Standardmarkt? (Prompt Research nimmt ihn jetzt als Vorgabe.)
10. **Leistung**: Gibt es Indizes für `intent` und `branded` auf `team_prompts`? Bitte die Laufzeit
    von `cached_prompts_list_v1` mit und ohne `p_intents` für das größte Team nennen.

---

## C. Was die UI schickt (zum Abgleich)

| Stelle | Funktion | Neue Parameter |
|---|---|---|
| Intent-Label, Menü | `prompt_intent_set_v1` | `p_target: "ids"`, `p_ids`, `p_intent` (`null` = KI) |
| Branded-Spalte, Menü | `prompt_branded_set_v1` | `p_target: "ids"`, `p_ids`, `p_branded` (`true`/`false`/`null`) |
| Sammelleiste | `prompt_intent_set_v1` | `p_target: "ids"` oder `"filter"`, `p_excluded_ids` |
| Branded-Schalter der Tabelle | `cached_prompts_list_v1` | `p_branded` (`"branded"`/`"non_branded"`, fehlt = alle) |
| Schreiben mit Filter-Zielmenge | `prompt_intent_set_v1`, `prompt_branded_set_v1` | `p_branded_filter` (der Filter), `p_branded` ist dort der Wert |
| Globaler Filter (alle Seiten) | alle Lesefunktionen | `p_intents`, `p_branded` |
| Gruppieren nach Intent | `cached_prompts_groups_v1` | `p_group_by: "intent"` |
| Prompt Research | `start-job` | `params.intents`, `params.branded` |
