# An Claude Code: Antwort auf die Rückmeldung Onboarding v1 (13.10.2026)

Die Umsetzung passt zum Vertrag. Antworten auf die drei Fragen:

## 1. Aktives Team nach dem Abschluss
- **Ja, Finalize schaltet das Team um.** Am Ende schreibt `onboarding_finalize_after_billing_v1` `app.user_settings.last_team_id = <neues Team>` (Insert oder Update). Das gilt auch für Nutzer, die schon Teams haben („Create new team“).
- **So liest die App es:** `get_my_teams_v4()` liefert in jeder Zeile `last_team_id`, die App wählt danach das aktive Team.
- **Wenn das nicht greift, liegt es an Bubble:** Bubble merkt sich das aktive Team in einem eigenen Zustand (State, Cookie). Dann muss `uobDashboard` diesen Zustand vor dem Wechsel auf `index` auf das `team_id` aus `onboarding_status_v1` setzen (bzw. leeren, damit `index` neu aus `get_my_teams_v4` liest).
- Einen eigenen RPC zum Umschalten braucht es dafür nicht.

## 2. Eigene Prompts
- **Bubble hat eigene Prompts im Prompt-Schritt angelegt**, und zwar direkt per REST-INSERT in `app.onboarding_suggested_prompt`: Felder `market`, `onboarding_id`, `prompt_text`, `selected`. Laut Statistik 51 Aufrufe. Wo genau in Bubble der Knopf sitzt, sieht Lukas im Prompt-Schritt.
- **Bitte die Eingabe im Prompt-Schritt bauen**, mit `onboarding_prompt_add_v1` / `onboarding_prompt_remove_v1`:
  - eigene Prompts unter „Other“;
  - Zähler aus `meta.limits.own_prompts_max` (10);
  - neu angelegt sind sie ausgewählt und zählen bei den 15 mit.
- **Fehler** als Feldfehler:
  - `prompt_empty`, `prompt_too_long`, `prompt_characters`, `prompt_duplicate`;
  - `too_many_prompts` (10 eigene erreicht), `too_many_prompts_selected` (15 ausgewählt).
- Danach braucht Bubble den REST-INSERT nicht mehr; er wird beim Aufräumen entzogen.

## 3. Format „bundle_failed“
- **Nur die Kürzung in der Datei.** `onboarding_bundle_v1` antwortet immer mit `{meta, row}`.
- Ich habe den Fall in `onboarding_v1_echte_antworten.json` korrigiert, er steht jetzt als `{meta: {restart}, row: {project}}`. Die zweite Lesart in der Seite kann weg.

## Aufräumen
Deine Liste stimmt mit dem Register überein (`settings_11_10/AUFRAEUMEN_NACH_UMBAU.md`, Abschnitt Onboarding). Erst eine Woche nach dem Livegang, ohne Aufrufe der alten Wege.
