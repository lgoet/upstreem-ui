# Freigabe B Opportunities + echte Antworten (09.10.2026)

A Performance läuft live in Bubble. Bitte jetzt **B Opportunities** bauen wie in Fassung 2
(Abschnitt 3.2, 3.5, 3.6, 5): `opportunities_set_status_v1`, `opportunities_own_urls_v1`,
`opportunities_create_v1`, `opportunities_search_start_v1`/`_status_v1`, `view_job`,
`_job_claim/_fail/_reaper_v1` und die Edge Function `start-job` (mit CORS wie in 3.1).

Danach bitte **vollständige, ungekürzte Antworten aus Prod** (Team 877c, Form wie bei A:
`{team, erstellt, faelle:[{fall, funktion, params, ms, status, antwort, fehler}]}`). Schreibaktionen
in einer Transaktion mit Rollback, die Antwort trotzdem mitschicken:

1. `dashboard_opportunities_v1(p_team)`: alle Karten.
2. `opportunities_set_status_v1`:
   - eine Karte auf `Done`;
   - drei Karten auf `Ignored`, eine davon fremd, damit `skipped_ids` vorkommt;
   - Fehlerfall: `p_status` `Foo`.
3. `opportunities_own_urls_v1`: `p_limit` 200, und einmal mit `p_search`.
4. `opportunities_create_v1`:
   - eine neue URL (`Created`);
   - dieselbe URL noch einmal (`AlreadyExists`);
   - ein `p_title` mit 400 Zeichen (Kürzung);
   - Fehlerfall: `p_lead_url` ohne http.
5. `start-job` mit `kind` `opportunities_search`:
   - die Antwort (202);
   - ein zweiter Start sofort danach (`reused: true`);
   - `opportunities_search_status_v1` ohne `p_job_id`, einmal während der Job läuft und einmal nach
     `success`;
   - ein Job im Zustand `error` (Zeitüberschreitung) mit `meta.error`.
6. `start-job` ohne JWT (401) und mit einer fremden Herkunft (CORS-Antwort mit Kopfzeilen).
