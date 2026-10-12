# Sammelnachricht an den Datenbank-Chat (13.10.2026)

Diesen Text in den Datenbank-Chat geben. Er fasst alles zusammen, was seit den letzten Lieferungen offen ist. **Gebaut werden muss nichts Neues**; es gibt eine Rückfrage (A.3) und zwei Beobachtungsaufträge (A.4, D).

---

## A. App-Start v1: angenommen

Gebaut gegen `APP_START_V1_VERTRAG.md`, gemessen im Prüfstand app01 mit allen 26 Fällen aus `app_start_v1_echte_antworten.json`. Pin `2360373`.

**1. Was core tut:**
- **Auslöser:** Der Start läuft von selbst, sobald die Seitenleiste auf der Seite steht. Das ist nur die Hauptseite, ohne Bubble-Workflow.
- **`p_team_hint`:** `?teamid=` aus der Adresse, sonst das Team dieses Tabs (`sessionStorage`). So behält jeder Tab sein Team, wie im Vertrag (1) beschrieben. `?teamid=` wird nach dem Start aus der Adresse entfernt.
- **Ablauf:**
  - `row: null` → `/onboarding`.
  - `has_access: false` → Gate, keine weiteren Team-Aufrufe (Fall 06).
  - Sonst `team_context_v1` (alle Teile), `user_notification_v1` und `markets_all_v1` parallel. `markets_all_v1` einmal je Sitzung.
  - Danach `drawersReady()` und die Seitenleiste.
- **Teamwechsel** (Seitenleiste und Gate): `team_switch_v1`, dann Neuladen mit `?teamid=`. Fehler als Satz: `team_forbidden`, `app_rate_limited`.
- **Nachladen nach eigenen Änderungen:** `team_context_v1(team, [teil])` statt der Bubble-REFRESH-Workflows. Gemessen: nur `["topics"]` (Fall 04).
- **Wegklicken:** `user_notification_dismiss_v1` mit `close` | `secondary` | `primary`.
- **Thema:** `user_settings_set_v1('theme', …)` bei jedem echten Wechsel, nicht beim Anwenden des Werts aus dem Start.
- **HTTP 402 `team_access_*` aus irgendeinem RPC:** Der Start läuft einmal neu (höchstens alle 30 s) und zeigt das Gate.
- **Ohne Anmeldung:** einmal nach 1,5 s nachfassen, dann `/signup`.
- **Token für Profilbild und Namen** (GoTrue, Storage): frisch aus der Sitzung des Plugins. `setUpstreemAuth` aus Bubble entfällt.
- **Rückfall:** Gibt es `app_start_v1` noch nicht (404/PGRST202), bleibt alles beim Bubble-Weg. So schadet ein Pin, der vor der SQL eingespielt wird, nicht.

**2. Eine Abweichung:** Gelöschte Teams (`access_state: 'deleted'`, nur für den Owner) zeigt die Seitenleiste nicht. Ein Wechsel dorthin führt ins Leere, weil der Start sie nie als aktives Team nimmt (Fall 12, 13).

**3. Frage zur Wiederherstellung:** Wo soll ein Owner ein gelöschtes Team wiederherstellen? Ich würde es auf die Teams-Seite legen (`teams_portfolio_v1`). Gibt es dafür schon eine Funktion, oder gehört sie in die Einstellungen-Runde?

**4. Beobachtung (Bitte):** Lukas löscht nach dem Einspielen den alten Pageload-Workflow und die Workflows `usnTeam`, `uagTeam`, `uncDismiss`, `up*Changed`. Bitte die Aufrufe dieser Funktionen eine Woche lang beobachten und erst dann in die Aufräumliste übernehmen:
- `get_my_teams_v4`, `get_team_brand_header_v9`, `get_team_plan_quota*`;
- `get_markets_v2`, `get_tags*`, `get_team_companies_v1`, `get_team_model_settings_v1`;
- `get_active_user_notification_v1`, `dismiss_user_notification_v1`;
- REST auf `user_settings`.

Übergangsweise laufen Bubble-Start und core-Start parallel, solange der alte Workflow noch steht.

## B. Onboarding v1: Antwort 1 angenommen

- **Zu 1 (aktives Team):** passt jetzt ohne Bubble-Zustand. Nach dem Abschluss geht die Seite mit `uobDashboard` auf `index`. Dort startet core mit `app_start_v1` ohne Hinweis und nimmt `last_team_id`, also das Team, das Finalize gesetzt hat. Bubble merkt sich kein Team mehr.
- **Zu 2 (eigene Prompts):** baue ich als Nächstes im Prompt-Schritt, mit `onboarding_prompt_add_v1`/`_remove_v1`, Fehlern am Feld und dem Zähler aus `own_prompts_max`. Für dich ist nichts zu tun.
- **Zu 3 (Format):** Die zweite Lesart fliegt raus. Danke für die korrigierte Datei.

## C. Marken-Editor: `brand_log_v1` mit `p_company` angenommen

Steht ausführlich in `domain_editor_db_rueckmeldung.md`, Abschnitt 4. Kurz:
- Das Protokoll im Editor ruft `p_company` und blättert über `next_before`.
- Die Domain-Einträge stehen lesbar da.
- Fremde und unbekannte Marken ergeben einen Leerzustand.
- `team_role_required` ergibt einen Satz.

**Für dich:** In `AUFRAEUMEN_NACH_UMBAU.md` steht noch „`brand_log_v1`: live, die Oberfläche fehlt noch“. Das ist überholt.

## D. Add Brand: überall `brand_add_v1` (Beobachtung)

- Seit Pin `6949f2b` speichert der Dialog auf jeder Seite selbst über `brand_add_v1` (Fehlerliste aus Brands v1, 11.3). `bubble_fn_uabAddBrand` feuert nicht mehr, der n8n-Weg wird also nicht mehr ausgelöst.
- **Bitte:** die Aufrufe von `add_competitor_v4` beobachten. Nach einer Woche ohne Aufrufe wie angekündigt `add_competitor_v1`–`v4` und `add_team_competitor_v1` absichern und später löschen, samt anon-Recht. Lukas deaktiviert dann den n8n-Workflow für das Anlegen von Marken.

## E. Vorschau: die nächsten Runden

Noch kein Auftrag, nur damit du planen kannst. Vor dem Wechsel auf Next.js hängen noch drei Teile an Bubble-Workflows:
1. **Quick-Actions-Suche:** `search_quick_actions` über Bubble, Antwort über `setResults`.
2. **Einstellungen-Popup:** `umsPrefs` (Sprache, Zahlen- und Datumsformat, Thema), Name, Avatar.
3. **Exporte:** Die Export-Workflows in Bubble rufen die Export-RPCs mit dem Nutzer-Token. Diese Aufrufe wandern nach `export-data.js`.

Die Aufträge dazu kommen einzeln.
