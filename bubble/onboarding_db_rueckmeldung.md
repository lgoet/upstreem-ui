# Rückmeldung an den Datenbank-Chat: Onboarding v1 (13.10.2026)

Diesen Text in den Datenbank-Chat geben. **Die Lieferung ist angenommen.** Die Onboarding-Seite lädt selbst gegen `ONBOARDING_V1_VERTRAG.md`, gemessen im Prüfstand onb01 mit `onboarding_v1_echte_antworten.json`. Umgeschaltet wird über das Attribut `data-source="db"` am Element; ohne das Attribut läuft die alte Bubble-Seite unverändert weiter.

## 1. Was die Oberfläche tut (gemessen)

- **Laden:**
  - `onboarding_bundle_v1()` mit `Content-Profile: app`. Ohne Onboarding: Formular.
  - Die Listen für Markt und Zeitzone kommen aus `meta.markets` / `meta.timezones`.
  - Die Grenzen kommen aus `meta.limits`: Wettbewerber 5/5, Themen n/8, Prompts n/15, im Zähler und als Sperre.
  - „Select all“ hört bei 15 auf.
- **Start:** `onboarding-start` mit `{company_name, website, market, timezone, business_model}`.
  - Die Website geht so, wie der Nutzer sie getippt hat.
  - Danach der Kanal `onboarding:<id>`. Phasen 2–4 zeichnen das Ladebild, `ready` 5 lädt das Bündel neu und zeigt die Wettbewerber.
- **Fehler beim Start:** `onboarding_invalid` mit hint wird zum Feldfehler (`name_characters` am Namen, `website_blocked` an der Website). `onboarding_restart_limited` erscheint als Satz mit Datum.
- **Auswahl:** `onboarding_select_v1` mit der vollen Auswahl, eine Anfrage je Art zur Zeit; `onboarding_busy` wird still übergangen.
- **Prompts:**
  - Erst die Themenauswahl speichern, dann `onboarding-prompts` mit `new_topics` als Liste. „Live Casino, Roulette“ bleibt **ein** Thema.
  - `ready` 7 lädt neu und zeigt die Prompts (16 echte, davon 1 eigener unter „Other“).
  - `ready` mit `prompts_failed` führt zurück auf Topics, mit Satz. `prompt_runs` erscheint als Satz mit 5 Läufen je Tag.
- **Tarife:** `onboarding_plans_v1`. Die Testphase zeigt die Seite nur monatlich und nur bei `trial_eligible` (`trial_days_effective`). Bei jährlicher Abrechnung lautet der Vorspann „The free trial comes with monthly billing.“
- **Kasse:** `onboarding-checkout` mit `{onboarding_id, plan_id, billing_interval, return_path}`, `return_path` `/onboarding` bzw. `/version-test/onboarding`. Danach Weiterleitung.
  - `onboarding_checkout_open` (paid) zeigt „Creating your workspace“.
  - 502 zeigt einen Satz, der Knopf wird wieder frei.
- **Rückkehr:**
  - `?checkout=success` zeigt sofort „Creating your workspace“ und kein Tor; die Parameter verschwinden aus der Adresse.
  - Bleibt Phase 100 aus, folgt nach 20 s **einmal** `onboarding-checkout-status`.
  - Bei 100 mit `team_id` geht es ins Dashboard.
  - `?checkout=cancelled` führt auf den Plan, gewählter Tarif und Zeitraum aus dem Bündel.
- **Abgeschlossen:** Phase 100 aus dem Kanal führt zu einmal `onboarding_status_v1` (wegen `team_id`), dann ins Dashboard.
- **Fehlertexte:** Jeder `error_code` wird ein Satz, Rohtext erscheint nie im Bild.

## 2. Fragen

1. **Aktives Team nach dem Abschluss:**
   - Die Seite schickt am Ende `uobDashboard`, Bubble geht damit auf `index`.
   - Setzt Finalize das neue Team als aktives Team des Nutzers (`user_settings`)? Sonst landet ein Nutzer, der schon Teams hat („Create new team“), im alten Team.
   - Bitte bestätigen oder sagen, welcher Aufruf das Team umschaltet.
2. **Eigene Prompts** (`onboarding_prompt_add_v1` / `_remove_v1`): Die Seite hat dafür heute keine Eingabe; gebaut ist es nicht. Wenn Bubble die eigenen Prompts bisher an anderer Stelle eingefügt hat, sag mir wo. Dann baue ich die Eingabe im Prompt-Schritt.
3. **Altes Format im Fall „bundle_failed“:** Dort stehen `project` und `restart` oben statt unter `row`/`meta`. Die Seite liest beide Formen. Ist das nur die Kürzung in der Datei, oder antwortet die Funktion so?

## 3. Aufräumen

Erst wenn Lukas die neue Seite live hat und eine Woche lang nichts mehr die alten Wege ruft:
- die alten Webhooks (`ONBOARDING`, `ONBOARDING_PROMPTS`);
- `onboarding_get_bundle` und die drei `set_*_selected`;
- `create-onboarding-checkout`;
- `get_onboarding_completion_status_v1` und die Seite `onboarding-success`;
- SELECT/INSERT für `authenticated` auf den Onboarding-Tabellen (B3 deines Vorschlags).
