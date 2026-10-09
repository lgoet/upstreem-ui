# Anfrage an den Datenbank-Chat: echte Antworten für A Performance (09.10.2026)

Die Performance-Seite ist gegen Vertrag A gebaut (Fassung 2, Abschnitt 4 und 11). Getestet ist sie
bisher nur mit der Form deiner Beispiele aus Abschnitt 11. Für den Test mit echten Daten brauche ich
die **vollständigen, ungekürzten Antworten** (kein „…“, alle Zeilen) aus Prod, Team 877c, Nutzer
aea6e317…, wie bei deinen Prod-Tests (`app.warming = on`, Rollback, keine Schreibaktion).

**Form:** eine JSON-Datei, je Fall ein Eintrag:

```json
{ "team": "877c649c-…", "erstellt": "<ISO-Zeit>", "faelle": [
  { "fall": "radar Vorgabe", "funktion": "performance_radar_v1", "params": { … }, "ms": 123,
    "status": 200, "antwort": { … vollständig … }, "fehler": null }
] }
```

Bei einem Fehlerfall `antwort: null` und in `fehler` genau das, was PostgREST zurückgäbe
(`code`, `message`, `hint`, `details`) plus der HTTP-Status.

**Die Fälle** (Zeitraum immer die Vorgabe, also die letzten 30 Tage):

1. `performance_radar_v1(p_team)`: Vorgabe 12/12.
2. `performance_radar_v1` mit `p_companies` = die ersten 3 Marken aus Fall 1 in **umgekehrter**
   Reihenfolge und `p_topics` = die ersten 3 Topics.
3. Für die **eigene Marke** auf dem ersten Topic, auf dem sie Erwähnungen hat, mit `p_date_from` /
   `p_date_to` aus `meta` von Fall 1 und `p_tag_ids = [topic_id]`:
   - `performance_company_chart_v1` (`p_mode` visibility, `p_granularity` day),
   - `performance_brand_variations_v1` (`p_limit` 1000, `p_offset` 0),
   - `cached_citations_urls_v1` (`p_mentioned_brands = [company_id]`, `p_order` share_desc,
     `p_limit` 15, `p_offset` 0).
4. Dasselbe wie 3 für einen **Wettbewerber** auf einem Topic mit Erwähnungen.
5. Wenn es im Zeitraum eine Marke-Topic-Kombination mit **Tagen ohne Läufe** gibt: die Kurve dazu
   (damit `value: null` einmal echt vorkommt). Sonst bitte sagen, dass es keine gibt.
6. Fehlerfall: `performance_company_chart_v1` mit einer Marke, die nicht zum Team gehört
   (`performance_not_found`).
7. Fehlerfall: `performance_radar_v1` mit `p_company_limit` 0 (`performance_invalid_param`).
