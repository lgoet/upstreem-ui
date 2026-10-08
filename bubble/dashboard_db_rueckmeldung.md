# Rückmeldung an den Datenbank-Chat: Dashboard-Vertrag (Stand 08.10.2026)

Antwort auf „Dashboard v1 – Vertrag (VORSCHLAG)“. Gegen die Oberfläche geprüft. **Freigabe zum
Bau** mit diesen Entscheidungen und Änderungen.

## 1. Entscheidungen (Abschnitt 8)

| # | Entscheidung |
|---|---|
| 1 | **Sentiment über den ganzen Zeitraum** (dein Vorschlag). Dann gleich in der ganzen App; `meta.sentiment_from` ist damit nicht nötig. |
| 2 | **Eigene Marke nur in `own`** (dein Vorschlag). Die Oberfläche hängt sie im Agentic selbst an die Top-Liste an, wie heute. Die Visibility-Tabelle hat sie heute ohnehin nicht angeheftet. |
| 3 | **Ja:** Dashboard `PT429`, Citations bleibt bis zu einer `_v2` bei `P0429`. Die Oberfläche prüft auf `message` `*_rate_limited`. |
| 4 | **Nein:** Das Dashboard hat keinen Prompt-Filter. `p_prompt_id` bitte aus den Dashboard-Funktionen weglassen; Citations v1 bleibt wie es ist. |

## 2. Änderungen am Zuschnitt

1. **`cached_dashboard_agentic_v1` entfällt.** Die Oberfläche ruft für Agentic dieselben Funktionen
   wie für Analytic, parallel:
   - `cached_dashboard_overview_v1` mit `p_limit: 5`, `p_order: visibility_desc` (own, field, Top 5);
   - `cached_citations_domains_v1` / `_urls_v1` mit `p_limit: 5`, `p_order: share_delta_desc`.

   Chats kommen weiter aus Ask Mira (`askMiraRecentChats`), Opportunities aus ihrer eigenen
   Komponente. Weniger Funktionen, und beide Ansichten zeigen sicher dieselben Zahlen.
2. **`p_series_limit: 0` in `cached_citations_overview_v1`: ja, bitte.** Top Citations braucht nur
   `kpis` und `types`.
3. **Cache ist Pflicht** für alle Dashboard-Funktionen, dieselbe Mechanik wie `app.citations_cache`
   (versioniert, stale-while-revalidate, Hintergrund-Job, Coalescing). Ohne ihn sieht der Nutzer bei
   jedem neuen Run wieder die kalten Zeiten.
4. **`clear_dashboard_cache_v1`** wie vorgeschlagen, inklusive `clear_citations_cache_v1`. Das ist
   der Aktualisieren-Knopf (Regel: Cache leeren, dann frisch laden).
5. **Tage ohne Runs: `visibility_pct: null`** so lassen. Das ist richtig, die Oberfläche zeichnet
   dort eine Lücke statt 0.
6. **Responses:** `p_order` mit den Werten aus v21 (`run_at_desc|asc`, `rank_asc|desc`,
   `sentiment_asc|desc`). Der Rang-Filter der Oberfläche schickt bei „20+“ kein `p_rank_max`.

## 3. Was ich nach dem Bau brauche

1. **`dashboard_v1_beispiele.sql`:** vollständige, ungekürzte echte Antworten (Team 877c):
   - overview: Seite 1 (`visibility_desc`), `rank_asc`, `p_limit: 5`;
   - visibility: `day` 30 Tage, `week` 90 Tage, `month` 180 Tage, und einmal mit `p_companies`;
   - responses: Seite 1, Seite 2, mit Suche, mit `p_mentioned: yes`, mit Rang- und
     Sentiment-Filter, eine leere Antwort;
   - clear: eine Antwort;
   - Fehler: je ein Beispiel für `dashboard_invalid_param`, `dashboard_invalid_date`,
     `dashboard_team_required`, `dashboard_rate_limited`, `forbidden`.
2. Die Laufzeiten aus `dashboard_bestand_3.sql` (90 Tage), kalt und aus dem Cache.
3. Die Rechtekorrektur für den Bestand (Abschnitt 6) als eigene Datei. Eingespielt wird sie, sobald
   Bubble umgestellt ist.
